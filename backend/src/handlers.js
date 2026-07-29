// L'ORCHESTRAZIONE DI UN GIORNO DI PRODUZIONE, INDIPENDENTE DALL'HTTP.
//
// Qui non si sa nulla di Request/Response: si conoscono solo env, canali e
// concept. index.js resta il router (auth, CORS, dispatch delle rotte,
// traduzione in Response); questo modulo decide COSA succede in un giorno di
// generazione — runChannel, backfillChannel, fanOutAll, la rigenerazione
// mirata di un giorno (regenDay) e la ricostruzione storica dell'archivio.
//
// Estratto da index.js (arrivato a ~900 righe mescolando le due
// responsabilità) SENZA cambiare una riga di comportamento: stessi status,
// stessi messaggi, stesso ordine di operazioni. La verifica è stata un
// confronto a scatola nera delle risposte HTTP prima/dopo lo spostamento.

import { ACTIVE_CHANNELS, requireActiveChannel } from "./channels.js";
import { evolveStory, clausesFor, todayKey } from "./story.js";
import { generateDay } from "./daygen.js";
import { getState, putState, putImage, getGiorno, listArchiveDates } from "./storage.js";
import { classify, encodeFingerprint, formatMeasures } from "./metrics.js";
import { buildInfoGiorno } from "./giorno.js";
import { loadTuning, resolveProfilo } from "./profiles.js";
import { getElement } from "./concepts.js";
import { FAMILIES } from "./families.js";
import { loadCatalog, resolveConcept } from "./catalog.js";

/**
 * Errore "di dominio": porta con sé lo status HTTP che il router deve usare.
 * Serve a tenere i codici di risposta attaccati alla causa invece di
 * ricostruirli nel router con una catena di if.
 */
export class ErroreDominio extends Error {
  constructor(messaggio, status = 400) {
    super(messaggio);
    this.name = "ErroreDominio";
    this.status = status;
  }
}

/**
 * Canali storici a tema fisso (vedi CONTRATTO): prima della carta d'identità,
 * ogni giorno di questi canali era sempre la stessa coppia concept×element —
 * è l'unico caso in cui ricostruirla a posteriori è ONESTO. Tappa, misure,
 * tentativi e profilo NON sono deducibili e restano null: erano scelti giorno
 * per giorno, non fissi.
 * I tre flussi attivi (natura/citta/quiete) NON sono qui apposta: pescano un
 * concept diverso ogni settimana, quindi per i loro giorni senza carta
 * d'identità registrata non c'è niente di onesto da ricostruire (→ "assente").
 */
const RICOSTRUZIONE_STORICA = {
  island: { concept: "costruzione", element: "isola" },
  bloom: { concept: "crescita", element: "girasole" },
  studio: { concept: "accumulo", element: "studio" },
  neon: { concept: "timelapse", element: "neon" },
};

/** Carta d'identità di un giorno per cui non esiste `giorno:<canale>:<data>` in KV. */
function giornoRicostruito(canale, data) {
  const base = {
    data, canale,
    concept: null, conceptNome: null, element: null, elementNome: null,
    arco: null, giornoNellArco: null, tappa: null, testoTappa: null,
    modello: null, tentativi: null, misure: null, collaudo: null, profilo: null,
    origine: "assente",
  };
  const ric = RICOSTRUZIONE_STORICA[canale];
  if (!ric) return base;
  const fam = FAMILIES[ric.concept];
  const el = getElement(ric.element);
  if (!fam || !el) return base; // difensivo: non dovrebbe succedere
  return {
    ...base,
    concept: ric.concept, conceptNome: fam.nome,
    element: ric.element, elementNome: el.nome,
    origine: "ricostruita",
  };
}

/**
 * Archivio di un flusso: le date disponibili con la carta d'identità di
 * ognuna. Per i giorni senza `giorno:<canale>:<data>` registrata si ripiega
 * sulla ricostruzione onesta (vedi sopra): mai inventare numeri, solo
 * concept/element quando il canale era a tema fisso (vedi CONTRATTO).
 */
export async function archivioCanale(env, canale, limit) {
  const dates = await listArchiveDates(env, canale, limit);
  const giorni = await Promise.all(
    dates.map(async (data) => (await getGiorno(env, canale, data)) ?? giornoRicostruito(canale, data))
  );
  return { channel: canale, dates, giorni };
}

/**
 * Genera (se serve) l'immagine di oggi per un flusso.
 * Idempotente: se l'immagine di oggi esiste già e non è richiesto `force`, esce.
 */
export async function runChannel(env, channelId, { force = false } = {}) {
  // Risolve anche gli alias storici (/run/island → flusso "natura"): da qui in
  // poi si usa SEMPRE `id` (il flusso REALE), mai `channelId` (l'id richiesto),
  // altrimenti si scriverebbero stato e immagini sotto un canale fantasma.
  const channel = requireActiveChannel(channelId);
  const id = channel.id;

  const date = todayKey();
  const prevState = await getState(env, id);

  if (!force && prevState?.lastDate === date) {
    console.log(`[run] ${id}: già generato per ${date}, salto`);
    return { channel: id, date, skipped: true };
  }

  // 1. Com'e' andato ieri? Lo dicono le misure salvate ieri stesso, confrontate
  //    col profilo del concept: "ok", "poco" (tappa non saldata), "troppo" (il
  //    modello e' corso avanti). E' il segnale con cui il piano si corregge.
  // I range del cancello possono essere stati tarati da fuori (KV `tuning:profili`,
  // vedi profiles.js): li si legge una volta sola e li si usa sia per capire
  // com'e' andata ieri sia per collaudare oggi. Il catalogo (concept/element
  // custom, vedi catalog.js) si legge una volta sola per la stessa ragione: un
  // flusso puo' pescare o essere a meta' arco su una combinazione pubblicata.
  const catalog = await loadCatalog(env);
  const tuning = await loadTuning(env);
  const conceptPrec = prevState?.conceptId ? resolveConcept(prevState.conceptId, catalog) : null;
  const esito = conceptPrec
    ? classify(prevState?.misure, resolveProfilo(conceptPrec.famiglia, tuning))
    : null;

  // 2. La storia avanza di un giorno, tenendo conto dell'esito.
  const state = evolveStory(channel, prevState, date, esito, catalog);
  const conceptBase = resolveConcept(state.conceptId, catalog);
  const concept = { ...conceptBase, profilo: resolveProfilo(conceptBase.famiglia, tuning) };
  state.improntaPrec = prevState?.impronta ?? null;

  console.log(
    `[run] ${id} ${date}: concept "${concept.id}" arco ${state.arcIndex} ` +
    `giorno ${state.dayInArc} tappa ${state.stage + 1}/${concept.tappe.length} — "${state.scene}"`
  );

  // 3. Generazione con collaudo.
  const img = await generateDay(env, channel, concept, state);

  // 4. Persistenza: immagine, metadati, stato (con l'impronta per domani).
  // La carta d'identità del giorno (giorno:<canale>:<data>, vedi storage.js e
  // CONTRATTO) vuole anche l'element, il testo della tappa, il verdetto del
  // collaudo e il PROFILO EFFETTIVO usato — quello già risolto con
  // resolveProfilo (default più override di tuning) dentro `concept.profilo`.
  // La forma dell'oggetto è decisa in UN SOLO posto (giorno.js): vedi lì il
  // perché.
  await putImage(env, id, img, buildInfoGiorno({ date, concept, state, img }));

  const { improntaPrec, ...statoDaSalvare } = state;
  await putState(env, id, {
    ...statoDaSalvare,
    impronta: img.impronta ? encodeFingerprint(img.impronta) : null,
    // L'impronta del keyframe resta per tutto l'arco: e' il metro con cui si
    // misura se la storia sta andando avanti o indietro.
    improntaAncora: img.ancora && img.impronta
      ? encodeFingerprint(img.impronta)
      : (state.improntaAncora ?? null),
    occupazione: img.ancora ? 0 : (img.misure?.occupazione ?? state.occupazione ?? 0),
    misure: img.misure ?? null,
  });

  return {
    channel: id,
    date,
    concept: concept.id,
    famiglia: concept.famiglia.id,
    scene: state.scene,
    arc: `${state.arcIndex}/${state.dayInArc}`,
    tappa: `${state.stage + 1}/${concept.tappe.length}`,
    ieri: esito,
    model: img.model,
    tentativi: img.tentativi,
    collaudo: img.verdetto ? (img.verdetto.ok ? "passato" : "ripiego: " + img.verdetto.motivi.join("; ")) : "non applicabile",
    misure: img.misure ? formatMeasures(img.misure) : null,
    size: `${img.width}x${img.height}`,
    bytes: img.bytes.length,
  };
}

/**
 * Backfill: simula `days` giorni consecutivi di storia fino a oggi.
 * Riparte da zero (stato azzerato). I byte di ogni giorno restano in memoria e
 * fanno da riferimento per il giorno dopo: nessun giro da KV, nessuna attesa di
 * propagazione.
 */
export async function backfillChannel(env, channelId, days, { conGate = true } = {}) {
  // Come in runChannel: risolve l'alias storico e da qui in poi usa SEMPRE
  // `id` (il flusso reale) per KV e log, mai `channelId` (l'id richiesto).
  const channel = requireActiveChannel(channelId);
  const id = channel.id;

  const catalog = await loadCatalog(env); // concept/element custom, letti una volta per l'intero backfill
  const tuning = await loadTuning(env); // range tarati da fuori, come nel cron
  let state = null;
  let prevBytes = null;
  let anchorBytes = null;
  let prevFingerprint = null;
  const results = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = todayKey(new Date(Date.now() - i * 86400000));
    // Anche qui l'anello si chiude: l'esito del giorno appena generato decide
    // la tappa del successivo, esattamente come farebbe il cron.
    const conceptPrec = state?.conceptId ? resolveConcept(state.conceptId, catalog) : null;
    const esito = conceptPrec
      ? classify(state?.misure, resolveProfilo(conceptPrec.famiglia, tuning))
      : null;
    state = evolveStory(channel, state, date, esito, catalog);
    const conceptBase = resolveConcept(state.conceptId, catalog);
    const concept = { ...conceptBase, profilo: resolveProfilo(conceptBase.famiglia, tuning) };
    state.improntaPrec = prevFingerprint ? encodeFingerprint(prevFingerprint) : null;

    if (state.dayInArc === 0) anchorBytes = null; // arco nuovo: l'àncora sarà questa immagine

    // `gate=0` fa una sola generazione per giorno: sette giorni con tre
    // tentativi ciascuno possono superare i limiti di durata di una richiesta.
    const img = await generateDay(env, channel, concept, state, {
      prevBytes, anchorBytes, maxAttempts: conGate ? null : 1,
    });

    await putImage(env, id, img, buildInfoGiorno({ date, concept, state, img }), { archiveOnly: i > 0 });

    console.log(
      `[backfill] ${id} ${date} (${concept.id} t${state.stage + 1}): ` +
      `${img.model}, ${img.tentativi} tentativi${img.misure ? ", " + formatMeasures(img.misure) : ""}`
    );

    results.push({
      date,
      concept: concept.id,
      tappa: state.stage + 1,
      scene: state.scene,
      model: img.model,
      tentativi: img.tentativi,
      misure: img.misure ? formatMeasures(img.misure) : null,
    });

    prevBytes = img.bytes;
    prevFingerprint = img.impronta ?? null;
    state.misure = img.misure ?? null;
    if (img.ancora && img.impronta) {
      state.improntaAncora = encodeFingerprint(img.impronta);
      state.occupazione = 0;
    } else if (typeof img.misure?.occupazione === "number") {
      state.occupazione = img.misure.occupazione;
    }
    if (state.dayInArc === 0) anchorBytes = img.bytes;
  }

  const { improntaPrec, ...statoDaSalvare } = state;
  await putState(env, id, {
    ...statoDaSalvare,
    impronta: prevFingerprint ? encodeFingerprint(prevFingerprint) : null,
  });
  return results;
}

/** Fan-out: una richiesta interna per flusso (parallela) tramite il binding SELF. */
export async function fanOutAll(env, { force = false } = {}) {
  const results = await Promise.allSettled(
    ACTIVE_CHANNELS.map((ch) =>
      env.SELF.fetch(`https://artipop.internal/run/${ch.id}${force ? "?force=1" : ""}`, {
        headers: { "x-artipop-key": env.ADMIN_KEY || "" },
      }).then(async (r) => ({ status: r.status, body: await r.json() }))
    )
  );
  return ACTIVE_CHANNELS.map((ch, i) => {
    const r = results[i];
    return r.status === "fulfilled"
      ? { channel: ch.id, ...r.value }
      : { channel: ch.id, error: String(r.reason) };
  });
}

/**
 * Rigenera UN giorno già passato: utile quando un singolo fotogramma esce
 * male, ricostruisce lo stato di quel giorno e rigenera solo quell'immagine.
 * A differenza di runChannel/backfillChannel non tocca `lastDate` dello stato
 * corrente a meno che `date` non sia proprio l'ultimo giorno generato (vedi
 * `archiveOnly` più sotto).
 *
 * Il router (index.js) ha già estratto `ch`/`date` dalla query string: qui si
 * fa solo la validazione di dominio. Ogni condizione non soddisfatta lancia
 * un ErroreDominio col messaggio e lo status che il router deve rispondere;
 * un fallimento della generazione vera e propria resta un Error "semplice"
 * (nessuno status), che il router traduce in 500 senza stack.
 */
export async function regenDay(env, { ch, date }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ErroreDominio("servono ?ch= e ?date=", 400);
  }
  // Risolve anche gli alias storici (/regen-day?ch=island): un id sconosciuto
  // dà così "flusso sconosciuto: xxx" invece del generico messaggio sopra, che
  // ora riguarda solo la data mancante/malformata.
  let channel;
  try {
    channel = requireActiveChannel(ch);
  } catch (err) {
    throw new ErroreDominio(err.message, 400);
  }
  const id = channel.id;

  const catalog = await loadCatalog(env);
  const tuning = await loadTuning(env);
  const state = await getState(env, id);
  const conceptBase = state?.conceptId ? resolveConcept(state.conceptId, catalog) : null;
  if (!state?.anchorDate || !conceptBase) {
    throw new ErroreDominio("stato non compatibile (serve un flusso già attivo)", 400);
  }
  // Stesso profilo EFFETTIVO del cron/backfill: default più override di
  // tuning. Senza questo /regen-day collaudava (e avrebbe registrato) col
  // profilo di default anche quando un tuning era in vigore.
  const concept = { ...conceptBase, profilo: resolveProfilo(conceptBase.famiglia, tuning) };
  const dayInArc =
    Math.floor(Date.parse(date + "T00:00:00Z") / 86400000) -
    Math.floor(Date.parse(state.anchorDate + "T00:00:00Z") / 86400000);
  if (dayInArc < 0 || dayInArc >= concept.tappe.length) {
    throw new ErroreDominio(`data fuori dall'arco corrente (àncora ${state.anchorDate})`, 400);
  }
  const prevDate = todayKey(new Date(Date.parse(date + "T12:00:00Z") - 86400000));
  const dayState = {
    ...state,
    dayInArc,
    stage: dayInArc,
    extraIndex: null,
    lastDate: date,
    prevDate: dayInArc > 0 ? prevDate : null,
    improntaPrec: null,
    scene: clausesFor(concept, dayInArc, 0, null).join(". "),
  };

  const img = await generateDay(env, channel, concept, dayState);
  await putImage(
    env, id, img,
    buildInfoGiorno({ date, concept, state: dayState, img, testoTappa: dayState.scene }),
    { archiveOnly: date !== state.lastDate }
  );
  return {
    channel: id, date, dayInArc, model: img.model, tentativi: img.tentativi,
    misure: img.misure ? formatMeasures(img.misure) : null,
  };
}
