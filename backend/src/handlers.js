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
import { evolveStory, clausesFor, todayKey, serveConceptNuovo, prossimoArcIndex } from "./story.js";
// L'invenzione del concept della settimana (inventa.js): chiamata da runChannel
// solo quando serveConceptNuovo prevede che l'arco si apra stanotte.
import { inventaElement, soggettiRecenti } from "./inventa.js";
import { generateDay } from "./daygen.js";
import { getState, putState, putImage, getGiorno, listArchiveDates } from "./storage.js";
import { classify, encodeFingerprint, formatMeasures } from "./metrics.js";
import { buildInfoGiorno } from "./giorno.js";
import { loadTuning, resolveProfilo } from "./profiles.js";
import { getElement } from "./concepts.js";
import { FAMILIES } from "./families.js";
import { loadCatalog, resolveConcept, potaGenerati } from "./catalog.js";
import { CONFIG } from "./config.js";

/**
 * Errore "di dominio": porta con sé lo status HTTP che il router deve usare.
 * Serve a tenere i codici di risposta attaccati alla causa invece di
 * ricostruirli nel router con una catena di if.
 * Interno del modulo: il router la intercetta per tipo, non per import.
 */
class ErroreDominio extends Error {
  constructor(messaggio, status = 400) {
    super(messaggio);
    this.name = "ErroreDominio";
    this.status = status;
  }
}

/**
 * Campo `cancello` da salvare nello stato del canale (ROADMAP M5): rende
 * visibile da /health, senza `wrangler tail`, se il collaudo dell'ultima
 * esecuzione ha potuto misurare qualcosa.
 *
 * Il segnale è `img.impronta`: se fingerprintFromBytes/fingerprintFromStream
 * (metrics.js) non riescono a calcolare un'impronta — IMAGES assente, la
 * trasformazione fallita, il PNG non decodificabile — `impronta` arriva
 * `null` da OGNI punto d'uscita di generateDay/generateWithGate (verificato
 * leggendo daygen.js e generate.js riga per riga: ogni ramo di ritorno porta
 * già impronta/verdetto/tentativi in questa forma, nessuna modifica è
 * servita lì). È l'unico segnale che copre uniformemente tutti quei casi
 * senza doverli enumerare uno per uno qui.
 *
 * `img.verdetto` è `null` sia quando il collaudo è fallito (impronta null)
 * sia quando oggi non era strutturalmente applicabile ma senza alcun guasto
 * (primo giorno dell'arco, nessun riferimento disponibile): in quel secondo
 * caso l'impronta però C'È, quindi si riporta "ok" — il misuratore
 * funziona, semplicemente non c'era nulla da collaudare. Solo l'impronta
 * mancante è un guasto reale (→ "disattivo").
 */
export function buildCancelloState(img, quando = new Date().toISOString()) {
  const tentativi = typeof img?.tentativi === "number" ? img.tentativi : 0;
  if (!img || img.impronta == null) {
    return { attivo: false, tentativi, verdetto: "disattivo", quando };
  }
  if (!img.verdetto) {
    return { attivo: true, tentativi, verdetto: "ok", quando };
  }
  return { attivo: true, tentativi, verdetto: img.verdetto.ok ? "ok" : "fuori-range", quando };
}

/**
 * Campo `freschezza` da esporre in /health: dice se l'ULTIMA generazione di
 * un flusso è di oggi, non solo se il collaudo (cancello) ha misurato
 * qualcosa — un flusso può avere cancello "ok" da giorni e non girare più.
 *
 * `oggi` arriva dal chiamante (`todayKey()`, fuso Europe/Rome di CONFIG) e
 * non da `new Date()` qui dentro: la funzione resta pura e testabile, come
 * `buildCancelloState` qui sopra.
 *
 * Nessun numero inventato: `lastDate` mancante o non riconoscibile come
 * `YYYY-MM-DD` (stato mai scritto, o KV vecchio/corrotto) dà
 * `giorniDiRitardo: null`, mai 0 o un numero a caso — stesso principio di
 * `giornoRicostruito` qui sotto per i giorni non ricostruibili onestamente.
 */
export function buildFreschezzaState(state, oggi) {
  const ultimaData = state?.lastDate ?? null;
  if (typeof ultimaData !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ultimaData)) {
    return { ultimaData: null, aggiornato: false, giorniDiRitardo: null };
  }
  // Mezzogiorno UTC su entrambe le date, come regenDay: evita che un cambio
  // di fuso sposti la differenza di un giorno.
  const giorni = Math.floor(
    (Date.parse(oggi + "T12:00:00Z") - Date.parse(ultimaData + "T12:00:00Z")) / 86400000
  );
  const giorniDiRitardo = Math.max(0, giorni);
  return { ultimaData, aggiornato: giorniDiRitardo === 0, giorniDiRitardo };
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
 * Carta d'identità di un giorno di un canale: legge `giorno:<canale>:<data>`
 * da KV e, se assente, ripiega sulla ricostruzione onesta (vedi sopra) —
 * unica fonte di verità usata sia da `archivioCanale` che dall'arricchimento
 * delle card di /archivi.
 */
export async function cartaDiIdentita(env, canale, data) {
  return (await getGiorno(env, canale, data)) ?? giornoRicostruito(canale, data);
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
    dates.map((data) => cartaDiIdentita(env, canale, data))
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
  // `let` e non `const`: se l'invenzione qui sotto riesce, il catalogo viene
  // RICARICATO per includere l'element appena scritto.
  let catalog = await loadCatalog(env);
  const tuning = await loadTuning(env);
  const conceptPrec = prevState?.conceptId ? resolveConcept(prevState.conceptId, catalog) : null;
  const esito = conceptPrec
    ? classify(prevState?.misure, resolveProfilo(conceptPrec.famiglia, tuning))
    : null;

  // 2-bis. Se stanotte si apre un arco nuovo, PRIMA di avanzare la storia si
  // prova a INVENTARE il concept dell'arco (inventa.js): un element nuovo
  // scritto da un modello di testo, salvato nel catalogo e imposto al nuovo
  // arco tramite `preferito`.
  //
  // Perché l'invenzione sta QUI e non dentro il pool (poolForWith/pickConcept):
  // la pesca è SINCRONA e viene chiamata dentro i .map() delle rotte di sola
  // lettura /api/channels e /health, dove il pool serve solo a CONTARE i
  // concept disponibili. Renderla asincrona — mettere una chiamata al modello
  // di testo in mezzo a un conteggio — romperebbe una decina di file di test
  // e due rotte che oggi non toccano mai la rete. Qui invece l'invenzione
  // gira una volta al giorno per canale, e solo sul ramo in cui l'arco si
  // apre davvero: nei giorni normali questo blocco non esiste.
  //
  // Perché il fallimento è silenzioso: inventaElement non lancia mai (contratto
  // in testa a inventa.js) — se l'invenzione non va in porto, `preferito`
  // resta null ed evolveStory pesca dalla libreria come ha sempre fatto. È il
  // RIPIEGO voluto: uno sfondo preso dalla libreria vale infinitamente più di
  // nessuno sfondo (principio 3 di CLAUDE.md), quindi nessun guasto di questo
  // blocco deve potersi trasformare in un giorno perso. Il try/catch è la
  // rete di sicurezza finale sul contratto: anche se un domani qualcosa qui
  // lanciasse, il chiamante (cron o /run) deve comunque ottenere il suo
  // sfondo di oggi.
  let preferito = null;
  if (serveConceptNuovo(prevState, date, catalog)) {
    try {
      const inventato = await inventaElement(env, channel, {
        catalog,
        // Lo STESSO indice che evolveStory assegnerà all'arco che si apre:
        // il conto vive in un solo posto (prossimoArcIndex, vedi story.js),
        // altrimenti l'element potrebbe nascere con l'id di un arco diverso.
        arcIndex: prossimoArcIndex(prevState),
        daEvitare: soggettiRecenti(prevState, catalog, channel),
        adesso: new Date().toISOString(),
      });
      if (inventato) {
        preferito = inventato.id;
        // Ricarico il catalogo: l'element appena salvato in KV esiste solo lì
        // dentro, e solo così il pool lo contiene e pickConcept può sceglierlo.
        catalog = await loadCatalog(env);
      }
    } catch (err) {
      console.error(`[run] ${id}: invenzione del concept fallita, ripiego sulla libreria: ${err?.message ?? err}`);
    }
  }

  // 2. La storia avanza di un giorno, tenendo conto dell'esito. `preferito`
  //    (null nei giorni normali) impone il concept dell'arco nuovo quando
  //    l'invenzione è riuscita.
  const state = evolveStory(channel, prevState, date, esito, catalog, preferito);
  const conceptBase = resolveConcept(state.conceptId, catalog);
  const concept = { ...conceptBase, profilo: resolveProfilo(conceptBase.famiglia, tuning) };
  state.improntaPrec = prevState?.impronta ?? null;

  // "INVENTATO" solo se il concept di oggi è davvero quello appena inventato:
  // il confronto con `preferito` è la prova, perché `preferito` può combaciare
  // solo con l'id nato in questo run. Se pickConcept avesse ignorato il veto
  // (non dovrebbe mai accadere: il catalogo è stato appena ricaricato), qui si
  // leggerebbe PESCATO — e sarebbe la verità.
  const origineConcept = preferito === concept.id ? "INVENTATO" : "PESCATO";
  console.log(
    `[run] ${id} ${date}: concept "${concept.id}" (${origineConcept}) arco ${state.arcIndex} ` +
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
  let statoNonSalvato = false;
  try {
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
      // Segnale del cancello dell'ultima esecuzione, letto da /health (ROADMAP M5).
      cancello: buildCancelloState(img),
    });
  } catch (err) {
    // L'immagine di oggi è già in archivio: se è lo stato a non salvarsi non è
    // il caso in cui il ritentativo del cron (fanOutAll) debba rigenerare —
    // rigenerare qui sovrascriverebbe uno sfondo già pubblicato e brucerebbe
    // una generazione AI per niente (vedi PLAN.md di questo ciclo).
    console.error(`[run] ${id} ${date}: immagine pubblicata ma stato non salvato: ${err.message}`);
    statoNonSalvato = true;
  }

  // 5. Potatura degli element generati (catalog.js), SOLO se oggi ne è stato
  //    inventato uno — nei giorni normali non c'è nulla da potare e si
  //    risparmia pure la lettura del catalogo. E SOLO adesso, dopo che
  //    immagine e stato sono stati salvati: l'immagine del giorno è già
  //    pubblicata, quindi una potatura che fallisce non deve trasformarsi in
  //    un errore del run (stessa ragione del try/catch qui sopra per lo
  //    stato). `protetti` raccoglie il conceptId corrente di TUTTI i canali
  //    attivi: un arco in corso su un altro canale sta ancora usando il suo
  //    element, e potarlo glielo toglierebbe da sotto i piedi alla ripresa di
  //    domani. Quello di questo canale c'è già di diritto: il suo stato è
  //    stato salvato due righe fa e punta al concept appena aperto.
  if (preferito !== null) {
    try {
      const protetti = [];
      for (const ch of ACTIVE_CHANNELS) {
        const statoAltro = await getState(env, ch.id);
        if (statoAltro?.conceptId) protetti.push(statoAltro.conceptId);
      }
      await potaGenerati(env, { tieni: CONFIG.GENERATI_PER_CANALE, protetti });
    } catch (err) {
      console.error(`[run] ${id} ${date}: potatura post-invenzione fallita (ignorata): ${err?.message ?? err}`);
    }
  }

  const risultato = {
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
  if (statoNonSalvato) risultato.statoNonSalvato = true;
  return risultato;
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
  let lastImg = null; // per il campo `cancello` finale (ROADMAP M5): serve fuori dal loop
  const results = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = todayKey(new Date(Date.now() - i * 86400000));
    // Anche qui l'anello si chiude: l'esito del giorno appena generato decide
    // la tappa del successivo, esattamente come farebbe il cron.
    const conceptPrec = state?.conceptId ? resolveConcept(state.conceptId, catalog) : null;
    const esito = conceptPrec
      ? classify(state?.misure, resolveProfilo(conceptPrec.famiglia, tuning))
      : null;
    // NIENTE invenzione qui, a differenza di runChannel: il backfill
    // ricostruisce giorni PASSATI — spendere chiamate al modello per inventare
    // concept (o creare element nel catalogo) sarebbe un costo buttato e
    // cambierebbe la storia che si sta rifacendo. I rollover del backfill
    // pescano dalla libreria come hanno sempre fatto, e nessun `preferito`
    // viene imposto a evolveStory.
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
    lastImg = img;
  }

  const { improntaPrec, ...statoDaSalvare } = state;
  await putState(env, id, {
    ...statoDaSalvare,
    impronta: prevFingerprint ? encodeFingerprint(prevFingerprint) : null,
    // Stesso segnale di runChannel, riferito all'ultimo giorno generato dal
    // backfill (il più recente, i=0): vedi buildCancelloState.
    cancello: lastImg ? buildCancelloState(lastImg) : null,
  });
  return results;
}

/**
 * Una passata di fan-out: una richiesta interna per canale (parallela) tramite
 * il binding SELF. Ritorna, per ogni canale, `{ channel, status, body }` in
 * caso di risposta oppure `{ channel, error }` in caso di reject.
 */
async function unaPassata(env, canali, { force } = {}) {
  const results = await Promise.allSettled(
    canali.map((ch) =>
      env.SELF.fetch(`https://artipop.internal/run/${ch.id}${force ? "?force=1" : ""}`, {
        headers: { "x-artipop-key": env.ADMIN_KEY || "" },
      }).then(async (r) => ({ status: r.status, body: await r.json() }))
    )
  );
  return canali.map((ch, i) => {
    const r = results[i];
    return r.status === "fulfilled"
      ? { channel: ch.id, ...r.value }
      : { channel: ch.id, error: String(r.reason) };
  });
}

/**
 * Fan-out: una richiesta interna per flusso (parallela) tramite il binding SELF.
 * I canali falliti al primo colpo (reject oppure `status !== 200`) vengono
 * ritentati UNA sola volta, sempre senza `force`: `runChannel` è idempotente
 * (salta se `lastDate` è già oggi, vedi riga ~165), quindi il ritentativo non
 * può mai produrre una seconda immagine per un giorno già riuscito.
 */
export async function fanOutAll(env, { force = false } = {}) {
  const prima = await unaPassata(env, ACTIVE_CHANNELS, { force });

  const falliti = ACTIVE_CHANNELS.filter((ch, i) => {
    const r = prima[i];
    return Boolean(r.error) || r.status !== 200;
  });
  if (falliti.length === 0) return prima;

  console.log(`[fan-out] ritento ${falliti.length} canale/i falliti: ${falliti.map((ch) => ch.id).join(", ")}`);
  const ritentativo = await unaPassata(env, falliti, { force: false });
  const perCanale = new Map(ritentativo.map((r) => [r.channel, r]));

  return prima.map((r) => (perCanale.has(r.channel) ? { ...perCanale.get(r.channel), ritentato: true } : r));
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
