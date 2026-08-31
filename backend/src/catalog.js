// CATALOGO — concept ed element creati dall'utente, sopra la libreria fissa nel codice.
//
// families.js e concepts.js restano la libreria di partenza, curata a mano e
// deployata col codice: è la base solida su cui tutto è stato tarato. Questo
// modulo aggiunge un SECONDO strato, scritto da fuori (uno strumento admin,
// non ancora costruito) e salvato in una singola chiave KV (`catalogo:custom`):
// nuovi concept (schemi di evoluzione) e nuovi element (soggetti), nella
// STESSA forma dei loro equivalenti built-in, così il resto del sistema non
// deve sapere se una cosa è "di fabbrica" o aggiunta a mano.
//
// Tre scelte di fondo:
//
//   1. UNA SOLA CHIAVE KV, non due. Concept ed element custom si creano e si
//      cancellano insieme più spesso di quanto non si pensi (un element nuovo
//      spesso porta con sé un concept nuovo su misura), e una sola scrittura
//      evita che i due elenchi vadano fuori sincrono per una scrittura a metà.
//
//   2. LE FUNZIONI DI LETTURA NON LANCIANO MAI PER KV ILLEGGIBILE. Un JSON
//      corrotto in KV non deve mai togliere di mezzo l'intera libreria
//      built-in: si torna a un catalogo custom vuoto e si continua a servire
//      quello che c'è nel codice. Solo la VALIDAZIONE in scrittura è severa
//      (è lì che ha senso essere severi: un admin sta scrivendo apposta, e un
//      errore silenzioso in scrittura sarebbe molto peggio di un 400 chiaro).
//
//   3. "MATERIALIZZARE" UN ELEMENT CUSTOM SIGNIFICA COSTRUIRE UN OGGETTO
//      IDENTICO, CAMPO PER CAMPO, A UN CONCEPT RISOLTO DI concepts.js. Da lì
//      in poi (story.js, generate.js, il cancello) non c'è più alcuna
//      differenza fra un concept che viene dal codice e uno nato nel
//      catalogo: entrambi hanno tappe risolte, setting, style, palette,
//      famiglia e profilo. `resolveConcept` è l'unico punto che fa questa
//      magia; il resto del sistema lo chiama e basta, senza mai sapere se sta
//      leggendo built-in o custom.
//
// PUT è un upsert per default (crea se l'id non c'è, sovrascrive se c'è): è
// il comportamento giusto per SALVARE modifiche a qualcosa di già esistente.
// Per una CREAZIONE, dove sovrascrivere per sbaglio un id esistente sarebbe un
// errore silenzioso pericoloso, il corpo della PUT accetta un campo
// facoltativo `soloSeNuovo: true` (sia in saveConcept che in saveElement):
// se l'id esiste già nel catalogo custom, la richiesta fallisce con un errore
// di validazione invece di sovrascrivere. Senza il campo (o con `false`), il
// comportamento resta l'upsert di sempre.
//
// Nota sulla dipendenza circolare con concepts.js: questo file importa da
// concepts.js (ELEMENTS, getConcept, getElement, conceptsForFamilies) per
// unire built-in e custom, e concepts.js importa da qui (allFamilies,
// allElements, resolveConcept) perché combine() deve poter lavorare col
// catalogo. È un ciclo, ma innocuo: nessuno dei due file usa le funzioni
// dell'altro al livello superiore del modulo (fuori da un corpo di
// funzione) — solo dentro funzioni, eseguite a richiesta avvenuta, quando
// entrambi i moduli sono già completamente caricati. È il modo standard con
// cui i moduli ES risolvono un ciclo del genere: non toccarlo per "pulizia"
// senza aver riletto questa nota.

import { CONFIG, FAMIGLIE_SOSPESE, ELEMENT_SOSPESI } from "./config.js";
import { FAMILIES } from "./families.js";
import { ELEMENTS, getConcept, getElement, conceptsForFamilies } from "./concepts.js";
import { validaRangeProfilo, validaMonotona, validaScalareONull } from "./validazione.js";

const CATALOG_KEY = "catalogo:custom";

// I tre flussi esistenti (vedi channels.js). Valore fisso, non importato da
// channels.js apposta: importarlo aprirebbe una SECONDA catena circolare
// (channels.js → concepts.js → questo file) che, a differenza della prima,
// avrebbe codice eseguito al livello superiore del modulo — i controlli a
// fine channels.js chiamano poolFor() appena il file viene caricato — e lì
// il ciclo NON sarebbe innocuo (leggerebbe un binding non ancora inizializzato).
const CANALI_VALIDI = new Set(["natura", "citta", "quiete"]);

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;

/* ===================== LETTURA ===================== */

/** Il catalogo custom salvato in KV, o `{ concepts:{}, elements:{} }` se assente/illeggibile. */
export async function loadCatalog(env) {
  try {
    const raw = await env.KV.get(CATALOG_KEY, { type: "json" });
    if (raw && typeof raw === "object") {
      return {
        concepts: raw.concepts && typeof raw.concepts === "object" ? raw.concepts : {},
        elements: raw.elements && typeof raw.elements === "object" ? raw.elements : {},
      };
    }
  } catch (err) {
    console.warn(`[catalog] catalogo custom illeggibile, riparto vuoto: ${err.message}`);
  }
  return { concepts: {}, elements: {} };
}

/** Scrive il documento completo in KV (versione + timestamp, per debug futuro). */
async function saveCatalogDoc(env, catalog) {
  const doc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    concepts: catalog.concepts,
    elements: catalog.elements,
  };
  await env.KV.put(CATALOG_KEY, JSON.stringify(doc));
}

/* ===================== VALIDAZIONE (condivisa fra concept ed element) ===================== */

function isNonEmptyString(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

/** Esattamente CONFIG.ARC_LENGTH_DAYS tappe, ognuna 1..3 frasi non vuote <=400 caratteri. */
function validaTappe(tappe, errori) {
  if (!Array.isArray(tappe) || tappe.length !== CONFIG.ARC_LENGTH_DAYS) {
    errori.push(`tappe: servono esattamente ${CONFIG.ARC_LENGTH_DAYS} tappe`);
    return;
  }
  tappe.forEach((frasi, i) => {
    if (!Array.isArray(frasi) || frasi.length < 1 || frasi.length > 3) {
      errori.push(`tappe[${i}]: ogni tappa vuole 1..3 frasi`);
      return;
    }
    frasi.forEach((f, j) => {
      if (!isNonEmptyString(f, 400)) {
        errori.push(`tappe[${i}][${j}]: frase vuota o oltre 400 caratteri`);
      }
    });
  });
}

/** 0..6 frasi non vuote <=400 caratteri. */
function validaExtra(extra, errori) {
  if (!Array.isArray(extra) || extra.length > 6) {
    errori.push("extra: al massimo 6 frasi");
    return;
  }
  extra.forEach((f, i) => {
    if (!isNonEmptyString(f, 400)) {
      errori.push(`extra[${i}]: frase vuota o oltre 400 caratteri`);
    }
  });
}

/**
 * { estensione, intensita, compattezza, monotona }: range e guardia
 * booleana, validati dal modulo condiviso validazione.js (stessi limiti e
 * stessi messaggi di prima — vedi lì).
 */
function validaProfilo(profiloIn, errori) {
  if (!profiloIn || typeof profiloIn !== "object") {
    errori.push("profilo: obbligatorio");
    return null;
  }
  const profilo = validaRangeProfilo(profiloIn, "profilo", errori);
  // NIENTE Boolean(...): su un input esterno coercerebbe silenziosamente
  // QUALUNQUE stringa non vuota (compresa la stringa "false"!) a `true`. Si
  // accetta solo un booleano vero; qualunque altro tipo è un errore di
  // validazione esplicito, non una coercizione silenziosa. validaMonotona
  // spinge già l'errore quando serve; qui si scrive comunque SEMPRE il
  // campo (comportamento invariato rispetto a prima del refactor).
  validaMonotona(profiloIn, "profilo", errori);
  profilo.monotona = profiloIn.monotona === true;
  return profilo;
}

/* ===================== SCRITTURA: CONCEPT ===================== */

/**
 * Valida e salva (crea o aggiorna) un concept custom. Ritorna
 * `{ ok, id, errori[] }`. Non scrive nulla se la validazione fallisce.
 *
 * `obj.soloSeNuovo` (facoltativo, booleano): quando `true`, la richiesta
 * fallisce con un errore chiaro se `id` esiste GIÀ nel catalogo custom,
 * invece di sovrascriverlo silenziosamente. Serve a distinguere una
 * CREAZIONE (che non deve poter calpestare qualcosa per sbaglio) da un
 * SALVATAGGIO di modifiche (l'upsert normale, comportamento di default
 * quando il campo è assente o `false`).
 */
export async function saveConcept(env, obj) {
  const errori = [];
  if (!obj || typeof obj !== "object") return { ok: false, id: null, errori: ["corpo mancante o non valido"] };

  const id = typeof obj.id === "string" ? obj.id : "";
  if (!ID_RE.test(id)) errori.push(`id "${id}": deve rispettare ^[a-z0-9][a-z0-9_-]{1,31}$`);
  else if (FAMILIES[id]) errori.push(`id "${id}": collide con una famiglia predefinita, scegline un altro`);

  if (!isNonEmptyString(obj.nome, 40)) errori.push("nome: 1..40 caratteri");
  if (!isNonEmptyString(obj.conserva, 300)) errori.push("conserva: obbligatorio, fino a 300 caratteri");

  validaTappe(obj.tappe, errori);
  validaExtra(obj.extra, errori);
  const profilo = validaProfilo(obj.profilo, errori);
  const maxDeriva = validaScalareONull(obj.maxDeriva, "maxDeriva", errori);
  const maxDegrado = validaScalareONull(obj.maxDegrado, "maxDegrado", errori);

  if (errori.length > 0) return { ok: false, id: id || null, errori };

  const catalog = await loadCatalog(env);
  if (obj.soloSeNuovo === true && catalog.concepts[id]) {
    return { ok: false, id, errori: [`esiste già un concept con id "${id}"`] };
  }
  catalog.concepts[id] = {
    id,
    nome: obj.nome,
    conserva: obj.conserva,
    tappe: obj.tappe,
    extra: obj.extra,
    profilo,
    maxDeriva,
    maxDegrado,
  };
  await saveCatalogDoc(env, catalog);
  console.log(`[catalog] concept custom salvato: "${id}"`);
  return { ok: true, id, errori: [] };
}

/**
 * Cancella un concept custom. Rifiuta un built-in, e rifiuta un concept
 * ancora usato come `famigliaNativa` da un element (built-in o custom).
 */
export async function removeConcept(env, id) {
  if (!id) return { ok: false, errori: ["serve l'id del concept da rimuovere"] };
  if (FAMILIES[id]) return { ok: false, errori: [`"${id}" è una famiglia predefinita: non si può cancellare`] };

  const catalog = await loadCatalog(env);
  if (!catalog.concepts[id]) return { ok: false, errori: [`concept custom "${id}" non trovato`] };

  const usatoDa = Object.values(catalog.elements)
    .filter((el) => el.famigliaNativa === id)
    .map((el) => el.id);
  if (usatoDa.length > 0) {
    return { ok: false, errori: [`concept "${id}" ancora usato da: ${usatoDa.join(", ")}`] };
  }

  delete catalog.concepts[id];
  await saveCatalogDoc(env, catalog);
  console.log(`[catalog] concept custom rimosso: "${id}"`);
  return { ok: true, rimosso: id };
}

/* ===================== SCRITTURA: ELEMENT ===================== */

/**
 * Valida e salva (crea o aggiorna) un element custom. Ritorna
 * `{ ok, id, errori[] }`. `famigliaNativa` deve esistere già, built-in o
 * custom che sia — per questo si carica il catalogo prima di validare.
 *
 * `obj.soloSeNuovo` (facoltativo, booleano): stessa semantica di
 * `saveConcept` — con `true`, un `id` già presente nel catalogo custom fa
 * fallire la richiesta invece di sovrascriverlo. Assente o `false`: upsert
 * normale, comportamento di sempre.
 *
 * `obj.auto` e `obj.creatoIl` (facoltativi): i due campi che distinguono un
 * element creato DALLA MACCHINA (una generazione automatica, uno a settimana
 * per canale, non ancora costruita) da uno scritto a mano. Vedi i commenti
 * inline più avanti per le regole precise di validazione e per il perché del
 * "un salvataggio manuale riporta l'element a auto:false".
 */
export async function saveElement(env, obj) {
  const errori = [];
  if (!obj || typeof obj !== "object") return { ok: false, id: null, errori: ["corpo mancante o non valido"] };

  const id = typeof obj.id === "string" ? obj.id : "";
  if (!ID_RE.test(id)) errori.push(`id "${id}": deve rispettare ^[a-z0-9][a-z0-9_-]{1,31}$`);
  else if (getElement(id)) errori.push(`id "${id}": collide con un element predefinito, scegline un altro`);

  if (!isNonEmptyString(obj.nome, 40)) errori.push("nome: 1..40 caratteri");
  if (!isNonEmptyString(obj.s, 120)) errori.push("s: obbligatorio, fino a 120 caratteri");
  if (obj.soggetto !== undefined && obj.soggetto !== null && !isNonEmptyString(obj.soggetto, 120)) {
    errori.push("soggetto: se presente, fino a 120 caratteri");
  }
  if (!isNonEmptyString(obj.setting, 400)) errori.push("setting: obbligatorio, fino a 400 caratteri");
  if (!isNonEmptyString(obj.style, 400)) errori.push("style: obbligatorio, fino a 400 caratteri");
  if (!isNonEmptyString(obj.palette, 400)) errori.push("palette: obbligatorio, fino a 400 caratteri");

  const catalog = await loadCatalog(env);
  const famiglie = allFamilies(catalog);
  if (typeof obj.famigliaNativa !== "string" || !famiglie[obj.famigliaNativa]) {
    errori.push(`famigliaNativa "${obj.famigliaNativa}": concept sconosciuto (né predefinito né custom)`);
  }

  const haTappe = obj.tappe !== null && obj.tappe !== undefined;
  if (haTappe) validaTappe(obj.tappe, errori);
  const haExtra = obj.extra !== null && obj.extra !== undefined;
  if (haExtra) validaExtra(obj.extra, errori);

  // NIENTE Boolean(...): su un input esterno coercerebbe silenziosamente
  // QUALUNQUE stringa non vuota (compresa la stringa "false"!) a `true`, e un
  // element finirebbe nel pool di produzione senza che nessuno l'abbia
  // davvero pubblicato. Si accetta solo un booleano vero; qualunque altro
  // tipo è un errore di validazione esplicito.
  if (typeof obj.pubblicato !== "boolean") {
    errori.push(`pubblicato: deve essere un booleano (true/false), non ${JSON.stringify(obj.pubblicato)}`);
  }
  const pubblicato = obj.pubblicato === true;
  let canale = null;
  if (pubblicato) {
    if (typeof obj.canale !== "string" || !CANALI_VALIDI.has(obj.canale)) {
      errori.push(`canale: obbligatorio fra ${[...CANALI_VALIDI].join("/")} quando pubblicato è true`);
    } else {
      canale = obj.canale;
    }
  }

  // `auto` marca gli element nati dalla macchina: è la bandierina che
  // potaGenerati() usa per sapere cosa è potabile — un element scritto a mano
  // non si tocca mai. NIENTE Boolean(...): stessa ragione di `pubblicato`
  // poco sopra — su un input esterno coercerebbe silenziosamente QUALUNQUE
  // stringa non vuota (compresa la stringa "false"!) a `true`, e un element
  // finirebbe classificato come roba della macchina senza che nessuno l'abbia
  // davvero deciso. Si accetta solo un booleano vero; qualunque altro tipo è
  // un errore di validazione esplicito. UNICA differenza da `pubblicato`:
  // qui l'ASSENZA del campo è lecita e vale `false`, perché è il caso
  // normale di un salvataggio fatto dall'utente dal tool di tuning, che di
  // `auto` non sa e non deve saperne. E la conseguenza è VOLUTA: chi modifica
  // a mano un element generato lo sta adottando — non è più roba della
  // macchina, e da quel momento la pota non lo tocca più.
  if (obj.auto !== undefined && typeof obj.auto !== "boolean") {
    errori.push(`auto: deve essere un booleano (true/false), non ${JSON.stringify(obj.auto)}`);
  }
  const auto = obj.auto === true;

  // `creatoIl` è il marchio temporale dei soli element generati (timestamp
  // ISO: in 40 caratteri ci sta comodo) — serve a potaGenerati() per decidere
  // chi sono i più vecchi da rimuovere. Un element manuale non lo manda e NON
  // è un errore: assente, null o senza senso (tipo sbagliato, oltre 40
  // caratteri, vuoto) si salva come `null`. Per un element che non è auto la
  // data è irrilevante (la pota non lo guarda mai); per uno auto, mancare di
  // data lo pone nel gruppo dei più vecchi — scelta prudente: non sapendo
  // quando è nato, non ha titoli per restare a spese dei più giovani.
  const creatoIl = isNonEmptyString(obj.creatoIl, 40) ? obj.creatoIl : null;

  if (obj.soloSeNuovo === true && catalog.elements[id]) {
    errori.push(`esiste già un element con id "${id}"`);
  }

  if (errori.length > 0) return { ok: false, id: id || null, errori };

  const soggetto = isNonEmptyString(obj.soggetto, 120) ? obj.soggetto : obj.s;
  catalog.elements[id] = {
    id,
    nome: obj.nome,
    s: obj.s,
    soggetto,
    setting: obj.setting,
    style: obj.style,
    palette: obj.palette,
    famigliaNativa: obj.famigliaNativa,
    tappe: haTappe ? obj.tappe : null,
    extra: haExtra ? obj.extra : null,
    pubblicato,
    canale,
    auto,
    creatoIl,
  };
  await saveCatalogDoc(env, catalog);
  console.log(`[catalog] element custom salvato: "${id}"${pubblicato ? ` (pubblicato su ${canale})` : ""}${auto ? " (auto)" : ""}`);
  return { ok: true, id, errori: [] };
}

/** Cancella un element custom. Rifiuta un built-in. */
export async function removeElement(env, id) {
  if (!id) return { ok: false, errori: ["serve l'id dell'element da rimuovere"] };
  if (getElement(id)) return { ok: false, errori: [`"${id}" è un element predefinito: non si può cancellare`] };

  const catalog = await loadCatalog(env);
  if (!catalog.elements[id]) return { ok: false, errori: [`element custom "${id}" non trovato`] };

  delete catalog.elements[id];
  await saveCatalogDoc(env, catalog);
  console.log(`[catalog] element custom rimosso: "${id}"`);
  return { ok: true, rimosso: id };
}

/* ===================== POTATURA: ELEMENT AUTO-GENERATI ===================== */

/**
 * Pota gli element AUTO-GENERATI (auto === true) più vecchi oltre soglia,
 * ragionando PER CANALE: per ogni canale tiene i `tieni` element auto più
 * recenti (deciso su `creatoIl`; chi non ce l'ha conta come il più vecchio di
 * tutti) e rimuove gli altri. Gli element scritti a mano e i built-in non si
 * toccano mai, e un id che compare in `protetti` non viene MAI rimosso — è
 * l'elenco degli element che un arco in corso sta ancora usando: toglierglielo
 * da sotto i piedi romperebbe la ripresa dell'arco.
 *
 * Chiamata dal futuro generatore settimanale subito dopo aver creato un
 * element nuovo: è l'unico modo per tenere il catalogo (`catalogo:custom`,
 * UNA sola chiave KV) da crescere all'infinito. Ritorna l'array degli id
 * rimossi. Non lancia MAI: un errore (KV illeggibile, scrittura rifiutata,
 * argomento fuori forma) si logga e vale array vuoto — una potatura che non
 * parte non è un danno, il catalogo può anche aspettare la settimana dopo;
 * se invece lanciasse, porterebbe giù la generazione che l'ha chiamata.
 *
 * Se non c'è niente da rimuovere NON scrive affatto in KV: una scrittura
 * inutile su ogni tick settimanale è solo usura (e rischio) senza beneficio.
 * Quando c'è da rimuovere, una SOLA scrittura: saveCatalogDoc è già l'unità
 * atomica di questo modulo (vedi la scelta n.1 in testa al file).
 */
export async function potaGenerati(env, { tieni, protetti = [] } = {}) {
  try {
    // Guardia su `tieni`: undefined/NaN passato per sbaglio altrimenti farebbe
    // di slice() un "tieni zero" silenzioso — cioè cancellare TUTTI gli
    // element generati. Meglio non potare affatto che potare tutto.
    if (!Number.isInteger(tieni) || tieni < 0) {
      console.error(`[catalog] potaGenerati: soglia "tieni" non valida (${JSON.stringify(tieni)}), potatura annullata`);
      return [];
    }
    const protettiSet = new Set(Array.isArray(protetti) ? protetti : []);
    const catalog = await loadCatalog(env);

    // Solo gli element della macchina: quelli scritti a mano (auto !== true,
    // inclusi i vecchi salvati prima che `auto` esistesse) restano fuori.
    const generati = Object.values(catalog.elements).filter((el) => el.auto === true);

    // Raggruppa per canale: la generazione è uno a settimana PER canale, quindi
    // senza il raggruppamento un canale molto produttivo mangerebbe i posti
    // dei canali più lenti. Un element auto senza canale (mai pubblicato)
    // finisce nel gruppo "" e viene potato lì, con le sue stesse regole.
    const perCanale = new Map();
    for (const el of generati) {
      const canale = el.canale ?? "";
      if (!perCanale.has(canale)) perCanale.set(canale, []);
      perCanale.get(canale).push(el);
    }

    const daRimuovere = new Set();
    for (const gruppo of perCanale.values()) {
      // "Più recente" su creatoIl letto come data (Date.parse), non come
      // stringa: più onesto se un giorno cambiasse formato; chi non ce l'ha —
      // o ce l'ha illeggibile — vale -Infinity, cioè il più vecchio di tutti.
      // Tiebreak su id così che a parità di data l'esito sia deterministico.
      const ordinati = gruppo
        .map((el) => ({ el, t: el.creatoIl ? Date.parse(el.creatoIl) : NaN }))
        .sort((a, b) => {
          const ta = Number.isNaN(a.t) ? -Infinity : a.t;
          const tb = Number.isNaN(b.t) ? -Infinity : b.t;
          if (tb !== ta) return tb - ta;
          return a.el.id < b.el.id ? -1 : a.el.id > b.el.id ? 1 : 0;
        });
      for (const { el } of ordinati.slice(tieni)) {
        if (protettiSet.has(el.id)) continue; // un arco in corso lo sta usando
        daRimuovere.add(el.id);
      }
    }

    if (daRimuovere.size === 0) return [];

    for (const id of daRimuovere) delete catalog.elements[id];
    await saveCatalogDoc(env, catalog);
    console.log(`[catalog] potati ${daRimuovere.size} element auto-generati: ${[...daRimuovere].join(", ")}`);
    return [...daRimuovere];
  } catch (err) {
    console.error(`[catalog] potaGenerati fallita, niente rimosso: ${err.message}`);
    return [];
  }
}

/* ===================== VISTE UNIFICATE (built-in + custom) ===================== */

/** Mappa id→famiglia che unisce FAMILIES e i concept custom, stessa forma di FAMILIES. */
export function allFamilies(catalog) {
  const out = { ...FAMILIES };
  for (const c of Object.values(catalog?.concepts || {})) {
    out[c.id] = {
      id: c.id,
      nome: c.nome,
      conserva: c.conserva,
      tappe: c.tappe,
      extra: c.extra,
      profilo: { ...c.profilo },
      maxDeriva: c.maxDeriva ?? null,
      maxDegrado: c.maxDegrado ?? null,
    };
  }
  return out;
}

/** Array che unisce ELEMENTS e gli element custom, stessa forma di ELEMENTS. */
export function allElements(catalog) {
  const custom = Object.values(catalog?.elements || {}).map((e) => ({
    id: e.id,
    nome: e.nome,
    soggetto: e.soggetto ?? e.s,
    famigliaNativa: e.famigliaNativa,
    setting: e.setting,
    style: e.style,
    palette: e.palette,
  }));
  return [...ELEMENTS, ...custom];
}

/**
 * Il concept completo (forma di concepts.js: tappe risolte, setting, style,
 * palette, famiglia, profilo) per un id built-in oppure un element custom.
 * `undefined` se ignoto o se la sua famigliaNativa è sparita dal catalogo.
 *
 * Un id built-in torna direttamente da getConcept (già risolto, invariato).
 * Un id di un element custom viene MATERIALIZZATO qui: le sue tappe/extra
 * (se presenti) o quelle della famiglia fanno da base, e {s} viene risolto
 * con `s` — lo stesso segnaposto e la stessa sostituzione di concepts.js.
 */
export function resolveConcept(id, catalog) {
  const builtin = getConcept(id);
  if (builtin) return builtin;

  const el = catalog?.elements?.[id];
  if (!el) return undefined;
  const fam = allFamilies(catalog)[el.famigliaNativa];
  if (!fam) return undefined; // famiglia nativa rinominata/rimossa: non risolvibile

  const s = el.s || el.soggetto || "";
  const tappeRaw = el.tappe ?? fam.tappe;
  const extraRaw = el.extra ?? fam.extra;
  const tappe = tappeRaw.map((frasi) => frasi.map((f) => f.replaceAll("{s}", s)));
  const extra = extraRaw.map((f) => f.replaceAll("{s}", s));

  return {
    id: el.id,
    nome: el.nome,
    s,
    soggetto: el.soggetto ?? s,
    famiglia: fam,
    setting: el.setting,
    style: el.style,
    palette: el.palette,
    tappe,
    extra,
    profilo: {
      ...fam.profilo,
      maxDeriva: fam.maxDeriva ?? null,
      maxDegrado: fam.maxDegrado ?? null,
    },
    custom: true,
  };
}

/**
 * I concept fra cui un flusso può pescare: i built-in della sua indole PIÙ
 * gli element custom pubblicati su quel flusso, materializzati come concept
 * veri e propri. È il pool di PRODUZIONE — poolFor() in channels.js resta
 * built-in-only apposta, per i controlli a caricamento modulo.
 *
 * FAMIGLIE SOSPESE (M9, vedi config.js): il filtro vive QUI, dopo aver unito
 * built-in e custom, non dentro conceptsForFamilies — è il primo punto in cui
 * le due sorgenti sono già nello stesso array, quindi un ipotetico element
 * custom con famigliaNativa in una famiglia sospesa viene coperto insieme ai
 * built-in, con un solo filtro invece di due sparsi. È anche il punto che
 * copre sia la pesca settimanale di produzione (story.js: pickConcept, unico
 * chiamante di produzione) sia le informazioni di pool che il lab/tuning tool
 * legge da qui (index.js: /health, /api/channels contano poolForWith().length
 * per canale). NON copre invece — di proposito — il lab quando testa una
 * combinazione ESPLICITA (runLabArc → combine(familyId, elementId, ...) in
 * lab.js, che non passa da poolForWith): M10 deve poter continuare a chiedere
 * esplicitamente "attraversamento" per tararla, anche mentre è sospesa qui.
 *
 * ELEMENT SOSPESI (M10, vedi config.js): stessa logica ma a granularità
 * ELEMENT invece che FAMIGLIA — filtrata qui, nello stesso punto e con le
 * stesse due esenzioni deliberate: la combinazione ESPLICITA del lab
 * (runLabArc in lab.js, che non passa da poolForWith) e il proseguimento di
 * un arco già aperto (resolveConcept chiamata da evolveStory) restano
 * raggiungibili — la taratura futura deve poter chiedere canoa per id. Nel
 * concept combinato `c.id` è l'id dell'ELEMENT (vedi il commento di
 * giorno.js:33), quindi il filtro confronta contro quello, non contro
 * `c.famiglia.id`.
 *
 * Agisce SOLO sulla pesca di un concept NUOVO: resolveConcept() di uno stato
 * ESISTENTE (story.js: evolveStory, quando riprende l'arco di ieri) non passa
 * da questa funzione, quindi un arco già in corso su una famiglia o un
 * element sospeso continua a evolvere e chiude comunque i suoi 7 giorni.
 */
export function poolForWith(channel, catalog) {
  const builtins = conceptsForFamilies(channel.famiglie);
  const customi = Object.values(catalog?.elements || {})
    .filter((el) => el.pubblicato === true && el.canale === channel.id)
    .map((el) => resolveConcept(el.id, catalog))
    .filter(Boolean);
  const unito = [...builtins, ...customi];
  const filtrato = unito
    .filter((c) => !FAMIGLIE_SOSPESE.includes(c.famiglia.id))
    .filter((c) => !ELEMENT_SOSPESI.includes(c.id));

  // Ripiego di ultima istanza: la sospensione è una preferenza di TARATURA,
  // non una guardia di sicurezza (stessa scelta già fatta dal cancello in
  // generate.js:8-13) — uno sfondo fuori range vale più di nessuno sfondo,
  // e il rischio di range resta comunque contenuto dal cancello di collaudo.
  // Se il pool unito non era vuoto di suo ma le sospensioni lo svuotano,
  // meglio pescare non filtrato che far morire il flusso ogni giorno.
  if (unito.length > 0 && filtrato.length === 0) {
    const famiglieMorse = [...new Set(unito.map((c) => c.famiglia.id).filter((id) => FAMIGLIE_SOSPESE.includes(id)))];
    const elementMorsi = [...new Set(unito.map((c) => c.id).filter((id) => ELEMENT_SOSPESI.includes(id)))];
    console.error(
      `poolForWith: flusso '${channel.id}' svuotato dalle sospensioni (famiglie: ${famiglieMorse.join(", ") || "—"}; element: ${elementMorsi.join(", ") || "—"}) — ripiego sul pool non filtrato`,
    );
    return unito;
  }

  return filtrato;
}
