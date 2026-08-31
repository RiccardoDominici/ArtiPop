// EVOLUZIONE DELLA STORIA di un flusso, giorno per giorno.
//
// Un arco dura esattamente CONFIG.ARC_LENGTH_DAYS giorni (7). Il settimo giorno
// la storia chiude e l'ottavo il flusso pesca un CONCEPT NUOVO dalla libreria:
// mondo nuovo, stile nuovo, soggetto nuovo. Non si riprende mai il concept di
// prima — è la differenza centrale rispetto alla versione precedente, dove un
// canale restava un'isola per sempre e cambiava solo l'edificio.
//
// Due principi guidano la scelta di cosa mostrare ogni giorno:
//
//   1. NIENTE LINGUAGGIO DA CALENDARIO NEL PROMPT. Il modello non sa e non deve
//      sapere che giorno è. Riceve l'immagine di ieri e la descrizione di cosa
//      cambia. Il calendario è affar nostro, non suo.
//
//   2. IL PIANO SI ADATTA A CIÒ CHE SI VEDE. Quale tappa mostrare oggi si
//      decide guardando a che punto è arrivata davvero ieri, secondo l'esito
//      misurato da metrics.classify (non più letto guardando l'immagine, vedi
//      il commento in testa a index.js), non contando i giorni. Se ieri è
//      rimasta indietro si recupera; se ha corso avanti non si sta fermi a
//      guardare.

import { CONFIG } from "./config.js";
// Il pool di produzione include ora anche gli element custom pubblicati: si
// passa il catalogo, non si legge più solo poolFor() (built-in-only, resta in
// channels.js per i controlli a caricamento modulo). resolveConcept sostituisce
// getConcept ovunque si riprenda lo stato di un flusso salvato, perché quello
// stato può puntare a una combinazione pubblicata dal catalogo.
import { poolForWith, resolveConcept } from "./catalog.js";

/** Hash FNV-1a → intero positivo stabile: seed riproducibile per flusso+arco. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2147483647;
}

/** Data di "oggi" nel fuso configurato, formato YYYY-MM-DD. */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Giorni interi trascorsi dall'epoch per una data YYYY-MM-DD. Usata solo qui dentro. */
function dayNumberOf(dateKey) {
  return Math.floor(Date.parse(dateKey + "T00:00:00Z") / 86400000);
}

/* ===================== SCELTA DEL CONCEPT SETTIMANALE ===================== */

/**
 * Pesca il concept del nuovo arco fra quelli dell'indole del flusso, evitando
 * quelli usati di recente. Quando il serbatoio si esaurisce si riparte da capo,
 * escludendo solo l'ultimo visto: così non capita mai lo stesso concept due
 * settimane di fila, nemmeno al giro di boa.
 *
 * `catalog` (facoltativo) allarga il pool con gli element custom pubblicati
 * su questo flusso (vedi catalog.js: poolForWith). Senza catalogo si pesca
 * solo fra i built-in, come prima.
 *
 * `preferito` (facoltativo) impone il concept del nuovo arco: è il punto in
 * cui un concept inventato apposta per quest'arco entra nella storia. Se è
 * una stringa presente nel pool vince su qualunque pescata — è una richiesta
 * ESPLICITA per quest'arco, quindi vale anche se il suo id era già in `usati`.
 * Fuori dal pool (o non una stringa) si ignora e si pesca come sempre: meglio
 * un concept di libreria che uno che il flusso non saprebbe mostrare.
 */
export function pickConcept(channel, prevState, arcIndex, catalog = null, preferito = null) {
  const pool = poolForWith(channel, catalog);
  if (pool.length === 0) throw new Error(`flusso ${channel.id}: nessun concept disponibile`);

  const usati = Array.isArray(prevState?.usati) ? prevState.usati : [];
  const liberi = pool.filter((c) => !usati.includes(c.id));
  const ultimo = usati[usati.length - 1];
  const scelti = liberi.length > 0 ? liberi : pool.filter((c) => c.id !== ultimo);
  const candidati = scelti.length > 0 ? scelti : pool;

  const voluto = typeof preferito === "string" ? pool.find((c) => c.id === preferito) : undefined;
  let concept;
  if (voluto) {
    console.log(`[story] ${channel.id}: uso il concept preferito "${preferito}" per l'arco ${arcIndex}`);
    concept = voluto;
  } else {
    if (typeof preferito === "string") {
      console.log(`[story] ${channel.id}: concept preferito "${preferito}" ignorato: non è nel pool di questo flusso`);
    }
    concept = candidati[fnv1a(`${channel.id}:arc:${arcIndex}`) % candidati.length];
  }

  // Memoria dei visti: si tiene una finestra lunga quanto il serbatoio meno uno,
  // così resta sempre almeno un concept libero da pescare.
  const nuoviUsati = [...usati.filter((id) => id !== concept.id), concept.id]
    .slice(-Math.max(1, pool.length - 1));

  console.log(
    `[story] ${channel.id}: nuovo concept "${concept.id}" (${concept.famiglia.id}) — ` +
    `${liberi.length} liberi su ${pool.length}`
  );
  return { concept, usati: nuoviUsati };
}

/* ===================== SCELTA DELLA TAPPA DI OGGI ===================== */

/**
 * Quale tappa mostrare oggi, sapendo a che tappa è arrivata davvero ieri.
 *
 * Il passo si ricalcola ogni giorno spalmando le tappe che mancano sui giorni
 * che restano: è questo che garantisce che l'arco chiuda sempre in tempo anche
 * se qualche giorno è andato storto, senza mai concentrare tutto il recupero in
 * un salto solo. L'ultimo giorno la tappa finale è obbligatoria, comunque siano
 * andati i sei prima.
 *
 * Mai importata fuori da questo modulo (verificato con grep): privata.
 */
function targetStage(prevStage, dayInArc, ultimaTappa) {
  if (dayInArc >= ultimaTappa) return ultimaTappa;
  const giorniRimasti = ultimaTappa - dayInArc + 1; // oggi compreso
  const tappeRimaste = ultimaTappa - prevStage;
  const passo = Math.max(1, Math.ceil(tappeRimaste / giorniRimasti));
  return Math.min(ultimaTappa, prevStage + passo);
}

/**
 * La tappa di oggi, tenendo conto di COM'È ANDATA IERI (vedi metrics.classify).
 *
 * È qui che l'anello si chiude. Prima il piano avanzava di una tappa al giorno
 * qualunque cosa mostrasse l'immagine, e gli scarti si accumulavano finché non
 * si scaricavano tutti insieme: da lì venivano sia i giorni identici sia i
 * salti bruschi. Ora:
 *
 *   - se ieri non ha saldato la sua tappa, oggi la si RIPETE (con più forza)
 *     invece di passare oltre lasciando un buco;
 *   - se ieri è corso avanti, oggi si SALTA una tappa, o i giorni successivi
 *     non avrebbero più niente da mostrare;
 *   - in ogni caso non si può restare così indietro da non chiudere in tempo:
 *     il vincolo di recupero ha sempre l'ultima parola, e il settimo giorno la
 *     tappa finale è obbligatoria.
 *
 * La ripetizione non può incastrarsi: dopo un giorno ripetuto il calendario
 * avanza comunque, quindi la condizione `prevStage >= dayInArc` diventa falsa
 * e la tappa successiva riparte per forza.
 */
export function nextStage(prevStage, dayInArc, ultimaTappa, esito) {
  if (dayInArc >= ultimaTappa) return ultimaTappa;
  const recupero = targetStage(prevStage, dayInArc, ultimaTappa);
  if (esito === "troppo") return Math.min(ultimaTappa, Math.max(recupero, prevStage + 2));
  if (esito === "poco" && prevStage >= dayInArc) return prevStage;
  return recupero;
}

/**
 * Le frasi che descrivono il cambiamento di oggi, alla "dose" richiesta.
 *
 * La dose è il modo in cui il cancello corregge il tiro senza mai uscire dal
 * registro descrittivo: se il cambiamento è stato troppo debole si aggiunge
 * roba della tappa successiva, se è stato troppo violento si tiene solo la
 * prima frase. Nessun "cambia di più" rivolto al modello: cambia la DESCRIZIONE,
 * non un'esortazione.
 */
export function clausesFor(concept, stage, dose = 0, extraIndex = null) {
  const tappe = concept.tappe;
  const ultima = tappe.length - 1;

  // Storia già conclusa ma restano giorni: si aggiunge un dettaglio in più.
  if (extraIndex !== null && concept.extra.length > 0) {
    return [concept.extra[extraIndex % concept.extra.length]];
  }

  const base = tappe[Math.min(stage, ultima)];
  if (dose <= -1) return [base[0]];
  if (dose === 0) return [...base];

  const succ = tappe[Math.min(stage + 1, ultima)];
  if (stage >= ultima || !succ) {
    // Non c'è una tappa dopo: si rinforza con un dettaglio extra.
    return concept.extra.length ? [...base, concept.extra[0]] : [...base];
  }
  return dose === 1 ? [...base, succ[0]] : [...base, ...succ];
}

/* ===================== STATO DEL GIORNO ===================== */

// Uno stato KV leggibile (JSON valido) ma con un campo di tipo sbagliato
// (es. `dayNumber:"abc"`) non deve mai far crashare il flusso: si ripiega
// sul valore di default come se il campo non ci fosse.
function interoOppure(v, ripiego) {
  return Number.isInteger(v) ? v : ripiego;
}

/**
 * Apre un arco nuovo: concept nuovo, keyframe pulito, seed nuovo.
 * `arcIndex` cresce all'infinito e serve solo a variare la pescata.
 * `preferito` (facoltativo) viene inoltrato a pickConcept: è come il chiamante
 * impone il concept di quest'arco — per esempio uno inventato al momento —
 * senza dover toccare la pescata di tutti gli altri casi.
 */
function startArc(channel, prevState, dateKey, arcIndex, catalog, preferito = null) {
  const { concept, usati } = pickConcept(channel, prevState, arcIndex, catalog, preferito);
  const dayNumber = dayNumberOf(dateKey);
  return {
    lastDate: dateKey,
    dayNumber,
    arcIndex,
    dayInArc: 0,
    conceptId: concept.id,
    stage: 0,
    scene: `${concept.setting}. ${concept.tappe[0].join(". ")}`,
    seed: fnv1a(`${channel.id}:${concept.id}:${arcIndex}`),
    anchorDate: dateKey,
    prevDate: null,
    usati,
    extraIndex: null,
    dosePartenza: 0,
    // (qui viveva `esitoPrec`: scritto a ogni giorno e mai riletto da
    // nessuno — vedi la nota più sotto in evolveStory. Non reintrodurlo
    // senza un lettore reale.)
  };
}

/**
 * Prevede se a questa data il flusso APRIRA' un arco nuovo — cioè se
 * evolveStory, chiamata ora con questi stessi argomenti, finirebbe in uno dei
 * suoi rami di apertura: primo giorno in assoluto, rollover settimanale o
 * concept orfano. Risponde false anche nel caso in cui evolveStory NON apra
 * nulla: stessa data già salvata (rigenerazione a mano con ?force=1), dove
 * la tappa non si muove e l'arco nemmeno.
 *
 * Perché esiste: chi vuole aprire l'arco con un concept apposta inventato
 * deve saperlo PRIMA di chiamare evolveStory (l'invenzione costa una chiamata
 * di rete, va fatta solo quando davvero serve) e la condizione di apertura
 * dev'essere scritta UNA volta sola — qui. evolveStory non la duplica: la
 * consuma. Due copie della stessa condizione prima o poi diverrebbero due
 * regole diverse, e la previsione smetterebbe di combaciare col fatto.
 *
 * Mai lancia: è una previsione, non un passo del pipeline. In dubbio risponde
 * false — il peggio che può succedere è un arco che si apre pescando dalla
 * libreria invece che sul concept inventato, mai un flusso bloccato.
 */
export function serveConceptNuovo(prevState, dateKey, catalog = null) {
  try {
    // Primo giorno in assoluto: nessuno stato, o uno stato che non punta a
    // nessun concept.
    if (!prevState || !prevState.conceptId) return true;

    // Stessa aritmetica di evolveStory, stessa difesa per gli stati salvati
    // da versioni prive di `dayNumber` (ripiengo "un giorno solo").
    const dayNumber = dayNumberOf(dateKey);
    const prevDayNumber = interoOppure(prevState.dayNumber, dayNumber - 1);
    const elapsed = Math.max(0, dayNumber - prevDayNumber);

    // Stessa data già salvata: né tappa né arco si muovono, non si inventa nulla.
    if (elapsed === 0) return false;

    const dayInArc = interoOppure(prevState.dayInArc, 0) + elapsed;

    // Arco concluso (o superato perché il cron ha saltato dei giorni): rollover.
    if (dayInArc >= CONFIG.ARC_LENGTH_DAYS) return true;

    // Concept sparito dalla libreria (rinominato o rimosso): orfano.
    return !resolveConcept(prevState.conceptId, catalog);
  } catch (e) {
    console.error(`[story] serveConceptNuovo: previsione fallita (${e?.message ?? e}), rispondo false`);
    return false;
  }
}

/**
 * Calcola lo stato di oggi a partire da quello di ieri.
 *
 * `esito` è come è andato ieri secondo le misure ("ok" | "poco" | "troppo" |
 * "forma" | null). Con `null` il piano avanza a calendario, cioè esattamente il
 * comportamento della versione precedente: è il ripiego per il primo giorno di
 * un arco e per quando la misura non è disponibile.
 *
 * `catalog` (facoltativo) è il catalogo custom già caricato: serve sia per
 * pescare il concept di un arco nuovo (pickConcept) sia per risolvere lo
 * stato di ieri quando punta a una combinazione pubblicata dal catalogo
 * (resolveConcept) — un flusso può benissimo essere a metà arco su un
 * element custom.
 *
 * `preferito` (facoltativo) viene inoltrato ai rami di apertura d'arco: è
 * come il chiamante fa sì che l'arco nuovo nasca su un concept specifico
 * (per esempio uno inventato al momento), sempre che sia nel pool del
 * flusso. Nei giorni normali è ignorato.
 *
 * IDEMPOTENZA SULLO STESSO GIORNO. Il cron normale chiama questa funzione al
 * più una volta per `dateKey` (la guardia sta in runChannel, index.js), ma
 * `/run/<ch>?force=1` e `/backfill` possono richiamarla più volte sulla
 * STESSA data, per rifare a mano un giorno venuto male. In quel caso il
 * calendario non è avanzato di niente, e prima questa funzione avanzava
 * comunque l'arco di una tappa (un `Math.max(1, ...)` che imponeva un minimo
 * di un giorno): bastavano poche rigenerazioni per chiudere l'arco settimanale
 * con giorni di calendario ancora avanzati, rompendo la promessa "un ciclo
 * completo ogni settimana" di cui sopra. Rigenerare lo stesso giorno resta
 * però utile per rifarlo MEGLIO: la DOSE (quanto insistere sul cambiamento,
 * vedi dosePartenza) continua quindi ad aggiornarsi in base all'esito anche a
 * tappa ferma — è la sola cosa per cui una rigenerazione ha senso.
 */
export function evolveStory(channel, prevState, dateKey, esito = null, catalog = null, preferito = null) {
  const dayNumber = dayNumberOf(dateKey);

  // Primo giorno in assoluto del flusso.
  if (!prevState || !prevState.conceptId) return startArc(channel, prevState, dateKey, 0, catalog, preferito);

  // Il ripiego a `dayNumber - 1` copre solo gli stati salvati da versioni
  // precedenti prive del campo `dayNumber`: lì non si sa quanti giorni siano
  // passati davvero, quindi si assume "un giorno solo", cioè il comportamento
  // di sempre. Quando `dayNumber` c'è (il caso normale, ormai), si contano i
  // giorni VERI trascorsi, senza alcun minimo forzato: può essere zero.
  const prevDayNumber = interoOppure(prevState.dayNumber, dayNumber - 1);
  const elapsed = Math.max(0, dayNumber - prevDayNumber);

  // Stessa data già salvata, rigenerata a mano (vedi il commento della
  // funzione): la TAPPA non si muove, cambia solo la DOSE in base all'esito.
  if (elapsed === 0) {
    const dosePartenza = esito === "poco" ? 1 : esito === "troppo" ? -1 : 0;
    return {
      ...prevState,
      lastDate: dateKey,
      dayNumber,
      dosePartenza,
      // (esitoPrec rimosso: campo di stato scritto e mai riletto, vedi sotto)
    };
  }

  const dayInArc = interoOppure(prevState.dayInArc, 0) + elapsed;

  // Arco concluso (o superato perché il cron ha saltato dei giorni) oppure
  // concept sparito dalla libreria (rinominato o rimosso): in entrambi i casi
  // si cambia mondo invece di rompersi o "recuperare" i giorni persi di un
  // arco finito — la settimana successiva comincia comunque da un keyframe
  // pulito. La CONDIZIONE di apertura non sta qui: vive tutta in
  // serveConceptNuovo, che la offre anche a chi deve PREVEDERE l'apertura
  // prima che accada; due copie della stessa condizione prima o poi diverrebbero
  // due regole diverse. Qui resta solo la differenza fra i due motivi: l'orfano
  // avvisa in log, il rollover tace. `arcIndex` è per entrambi il precedente + 1.
  if (serveConceptNuovo(prevState, dateKey, catalog)) {
    if (!resolveConcept(prevState.conceptId, catalog)) {
      console.warn(`[story] ${channel.id}: concept "${prevState.conceptId}" non più in libreria, riparto`);
    }
    return startArc(channel, prevState, dateKey, interoOppure(prevState.arcIndex, 0) + 1, catalog, preferito);
  }

  // Qui il concept esiste di sicuro: serveConceptNuovo false esclude l'orfano.
  const concept = resolveConcept(prevState.conceptId, catalog);

  const ultimaTappa = concept.tappe.length - 1;
  const tappaIeri = interoOppure(prevState.stage, dayInArc - 1);
  const stage = nextStage(tappaIeri, dayInArc, ultimaTappa, esito);

  // Storia arrivata in fondo con giorni ancora da coprire: si passa ai dettagli
  // in più, uno al giorno, invece di ripubblicare la stessa scena.
  const bloccata = stage === ultimaTappa && tappaIeri >= ultimaTappa;
  const extraIndex = bloccata ? interoOppure(prevState.extraIndex, -1) + 1 : null;

  // Se ieri e' rimasto in debito, oggi si riparte gia' con una dose piu' alta:
  // ripetere la stessa descrizione com'era servirebbe a poco.
  const dosePartenza = esito === "poco" ? 1 : esito === "troppo" ? -1 : 0;

  if (esito && esito !== "ok") {
    console.log(
      `[story] ${channel.id}: ieri "${esito}" → ` +
      (stage === tappaIeri
        ? `oggi si RIPETE la tappa ${stage + 1} con piu' forza`
        : `oggi tappa ${stage + 1} (ieri era ${tappaIeri + 1})`)
    );
  }

  return {
    ...prevState,
    lastDate: dateKey,
    dayNumber,
    dayInArc,
    stage,
    extraIndex,
    dosePartenza,
    // NOTA: qui si scriveva anche `esitoPrec: esito ?? null`, un campo dello
    // stato mai riletto da nessuna parte (verificato con grep su tutto il
    // repo): lo stato di oggi si ricostruisce sempre da `esito` fresco,
    // passato a evolveStory ogni volta. Rimosso come codice morto; gli stati
    // già salvati in KV che lo contengono restano innocui, il campo sparisce
    // da solo alla prossima scrittura.
    scene: clausesFor(concept, stage, 0, extraIndex).join(". "),
    prevDate: prevState.lastDate,
    // seed e anchorDate restano quelli dell'arco
  };
}

/* ===================== COSTRUZIONE DEI PROMPT =====================
   Regola unica: il prompt DESCRIVE. Non nomina mai giorni, tappe, numeri di
   sequenza né "rispetto a ieri è passato tanto tempo". L'unico riferimento
   consentito è all'immagine che il modello ha davvero davanti (image 0), e le
   uniche frasi non descrittive sono i vincoli di formato del wallpaper. */

/** Keyframe: generazione pulita, senza riferimenti. Descrizione assoluta. */
export function buildKeyframePrompt(concept) {
  return (
    `${concept.tappe[0].join(". ")}. This is the scene: ${concept.setting}. ` +
    `Style: ${concept.style}. Colors: ${concept.palette}. ${CONFIG.WALLPAPER_SUFFIX}`
  );
}

/**
 * Giorno normale: image 0 = ieri, image 1 (facoltativa) = keyframe dell'arco.
 *
 * Sparisce la contraddizione della versione precedente, che chiedeva insieme
 * "cambia SOLO questo, tutto il resto identico" e "rendilo CHIARAMENTE VISIBILE
 * a colpo d'occhio": due ordini opposti che il modello risolveva a caso, un
 * giorno congelandosi e un giorno ridisegnando mezza scena. Ora la visibilità
 * non si implora nel prompt — si misura dopo, e se non basta si rigenera.
 */
export function buildDailyPrompt(concept, clauses, hasKeyframe) {
  return (
    `Image 0 is this exact scene. Now: ${clauses.join(". ")}. ` +
    `Keep unchanged from image 0: ${concept.famiglia.conserva}. ` +
    (hasKeyframe ? `Match the crisp clean quality of image 1. ` : "") +
    CONFIG.WALLPAPER_SUFFIX
  );
}

/**
 * Riallineamento del keyframe.
 *
 * Il primo giorno di un arco nasce da testo puro; tutti i giorni successivi
 * nascono invece da un editing di un'immagine. Sono due processi diversi e si
 * vede: senza questo passaggio il giorno 1 stona rispetto ai suoi stessi
 * seguiti. Qui si rigenera il keyframe partendo da se stesso, così entra nella
 * stessa "famiglia visiva" degli altri sei giorni. La descrizione resta quella
 * della scena, senza chiedere alcun cambiamento.
 */
export function buildRealignPrompt(concept) {
  return (
    `Image 0 is this exact scene: ${concept.setting}. ${concept.tappe[0].join(". ")}. ` +
    `Show the same scene with the same viewpoint, framing, light and colours, ` +
    `rendered with crisp clean detail. ` +
    `Style: ${concept.style}. Colors: ${concept.palette}. ${CONFIG.WALLPAPER_SUFFIX}`
  );
}

/**
 * Ripiego per quando l'immagine di ieri non è recuperabile: si riparte dal
 * keyframe e si descrive lo stato cumulativo raggiunto, sempre senza contare
 * giorni.
 */
export function buildCumulativePrompt(concept, stage) {
  const fin_qui = concept.tappe
    .slice(1, stage + 1)
    .flat()
    .join("; ");
  return (
    `Image 0 shows this scene at its beginning. Show the EXACT same scene, same ` +
    `viewpoint and same framing, in which all of the following are now true: ${fin_qui}. ` +
    `Style: ${concept.style}. ${CONFIG.WALLPAPER_SUFFIX}`
  );
}
