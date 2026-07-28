// NOTE — cosa l'utente ha segnato sopra l'archivio.
//
// Due cose distinte, nella STESSA chiave KV (`note:marcature`), sul modello di
// catalog.js — una sola scrittura evita che le due liste vadano fuori sincrono:
//
//   1. GIORNI marcati "buono"/"scarto" con una nota libera: è il modo con cui
//      l'utente dice "questo è venuto bene" o "questo è uno scarto", cosa che
//      prima non si poteva fare da nessuna parte.
//   2. ASSETTI: una fotografia con un nome di TUTTI i range di tuning in
//      vigore in un dato momento. Serve a provare una taratura, tornare a
//      quella di prima e confrontarle — senza un nome, un "buon assetto" si
//      perde alla taratura successiva.
//
// Stesse due scelte di fondo di catalog.js:
//   - le funzioni di LETTURA non lanciano mai per KV illeggibile (si torna a
//     un documento vuoto, non si toglie di mezzo nulla);
//   - la VALIDAZIONE in SCRITTURA è severa: niente coercizioni silenziose
//     (niente `Boolean(...)` su input esterno — vedi il commento in catalog.js).

import { CHANNELS, LEGACY_ALIASES } from "./channels.js";

const NOTE_KEY = "note:marcature";

const GIUDIZI_VALIDI = new Set(["buono", "scarto"]);
// Canali validi per una marcatura: i tre flussi attivi PIÙ gli alias storici
// (island, bloom, studio, neon, …) — un giorno d'archivio di un vecchio canale
// resta marcabile, esattamente come resta consultabile da /api/archive.
const CANALI_VALIDI = new Set([...CHANNELS.map((c) => c.id), ...Object.keys(LEGACY_ALIASES)]);

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_ASSETTO_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function isNonEmptyString(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

/** Una nota libera facoltativa: stringa (anche vuota) fino a 500 caratteri. */
function validaNota(v, errori) {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string" || v.length > 500) {
    errori.push("nota: deve essere una stringa di al massimo 500 caratteri");
    return "";
  }
  return v;
}

/* ===================== LETTURA ===================== */

/** Il documento `note:marcature`, o vuoto se assente/illeggibile. */
export async function loadNote(env) {
  try {
    const raw = await env.KV.get(NOTE_KEY, { type: "json" });
    if (raw && typeof raw === "object") {
      return {
        version: 1,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
        giorni: Array.isArray(raw.giorni) ? raw.giorni : [],
        assetti: Array.isArray(raw.assetti) ? raw.assetti : [],
      };
    }
  } catch (err) {
    console.warn(`[note] documento note:marcature illeggibile, riparto vuoto: ${err.message}`);
  }
  return { version: 1, updatedAt: null, giorni: [], assetti: [] };
}

/** Scrive il documento completo in KV (versione + timestamp). */
async function saveNoteDoc(env, doc) {
  const out = {
    version: 1,
    updatedAt: new Date().toISOString(),
    giorni: doc.giorni,
    assetti: doc.assetti,
  };
  await env.KV.put(NOTE_KEY, JSON.stringify(out));
  return out;
}

/* ===================== SCRITTURA: MARCATURA DI UN GIORNO ===================== */

/**
 * Segna (o smarca) un giorno d'archivio. Ritorna `{ ok, errori[] }`.
 *
 * `giudizio`: "buono" | "scarto" | null. `null` TOGLIE la marcatura (elimina
 * la voce se c'era); "buono"/"scarto" la crea o la aggiorna, con la nota.
 */
export async function putGiornoNota(env, body) {
  const errori = [];
  if (!body || typeof body !== "object") return { ok: false, errori: ["corpo mancante o non valido"] };

  const canale = typeof body.canale === "string" ? body.canale : "";
  if (!canale || !CANALI_VALIDI.has(canale)) errori.push(`canale "${canale}": sconosciuto`);

  const data = typeof body.data === "string" ? body.data : "";
  if (!DATA_RE.test(data)) errori.push(`data "${data}": deve essere nel formato AAAA-MM-GG`);

  // NIENTE coercizione: solo "buono"/"scarto"/null sono ammessi. Qualunque
  // altro valore (comprese stringhe vuote o typo) è un errore di validazione
  // esplicito, non viene silenziosamente interpretato come "nessun giudizio".
  let giudizio;
  if (body.giudizio === null || body.giudizio === undefined) {
    giudizio = null;
  } else if (typeof body.giudizio === "string" && GIUDIZI_VALIDI.has(body.giudizio)) {
    giudizio = body.giudizio;
  } else {
    errori.push(`giudizio: deve essere "buono", "scarto" oppure null, non ${JSON.stringify(body.giudizio)}`);
  }

  const nota = validaNota(body.nota, errori);

  if (errori.length > 0) return { ok: false, errori };

  const doc = await loadNote(env);
  const idx = doc.giorni.findIndex((g) => g.canale === canale && g.data === data);

  if (giudizio === null) {
    if (idx >= 0) doc.giorni.splice(idx, 1);
  } else {
    const voce = { canale, data, giudizio, nota };
    if (idx >= 0) doc.giorni[idx] = voce;
    else doc.giorni.push(voce);
  }

  await saveNoteDoc(env, doc);
  console.log(`[note] giorno ${canale}/${data}: giudizio=${giudizio ?? "(rimosso)"}`);
  return { ok: true };
}

/* ===================== SCRITTURA: ASSETTI ===================== */

/** Un profilo dentro `profili.<chiave>`, stessi limiti di catalog.js/profiles.js. */
function validaProfiloAssetto(profiloIn, chiave, errori) {
  if (!profiloIn || typeof profiloIn !== "object") {
    errori.push(`profili.${chiave}: profilo non valido`);
    return null;
  }
  const profilo = {};
  const campi = { estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1] };
  for (const [campo, [min, max]] of Object.entries(campi)) {
    const v = profiloIn[campo];
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number" && isFinite(n))) {
      errori.push(`profili.${chiave}.${campo}: servono [min, max] numerici`);
      continue;
    }
    const lo = Math.min(v[0], v[1]);
    const hi = Math.max(v[0], v[1]);
    if (lo < min || hi > max) {
      errori.push(`profili.${chiave}.${campo}: fuori dai limiti [${min}, ${max}]`);
      continue;
    }
    profilo[campo] = [lo, hi];
  }
  // NIENTE Boolean(...): vedi la nota in catalog.js — coercerebbe silenziosamente
  // qualunque valore non vuoto a `true`. Si accetta solo un booleano vero.
  if (typeof profiloIn.monotona !== "boolean") {
    errori.push(`profili.${chiave}.monotona: deve essere un booleano (true/false), non ${JSON.stringify(profiloIn.monotona)}`);
  } else {
    profilo.monotona = profiloIn.monotona;
  }
  for (const campo of ["maxDeriva", "maxDegrado"]) {
    const v = profiloIn[campo];
    if (v === null || v === undefined) {
      profilo[campo] = null;
      continue;
    }
    if (typeof v !== "number" || !isFinite(v)) {
      errori.push(`profili.${chiave}.${campo}: deve essere un numero oppure null`);
      continue;
    }
    profilo[campo] = v;
  }
  return profilo;
}

/**
 * Valida e salva (crea o aggiorna) un assetto: una fotografia con un nome di
 * TUTTI i range in vigore, per poterci tornare e confrontarla. Ritorna
 * `{ ok, id, errori[] }`. `creatoIl` si conserva se l'assetto esisteva già
 * (un salvataggio successivo aggiorna il contenuto, non la data di nascita).
 */
export async function putAssetto(env, body) {
  const errori = [];
  if (!body || typeof body !== "object") return { ok: false, id: null, errori: ["corpo mancante o non valido"] };

  const id = typeof body.id === "string" ? body.id : "";
  if (!ID_ASSETTO_RE.test(id)) errori.push(`id "${id}": deve rispettare ^[a-z0-9][a-z0-9_-]{0,63}$`);

  if (!isNonEmptyString(body.nome, 60)) errori.push("nome: 1..60 caratteri");

  const nota = validaNota(body.nota, errori);

  const profili = {};
  if (
    !body.profili ||
    typeof body.profili !== "object" ||
    Array.isArray(body.profili) ||
    Object.keys(body.profili).length === 0
  ) {
    errori.push("profili: obbligatorio, oggetto non vuoto { <concept>: profilo }");
  } else {
    for (const [chiave, profiloIn] of Object.entries(body.profili)) {
      const p = validaProfiloAssetto(profiloIn, chiave, errori);
      if (p) profili[chiave] = p;
    }
  }

  if (errori.length > 0) return { ok: false, id: id || null, errori };

  const doc = await loadNote(env);
  const idx = doc.assetti.findIndex((a) => a.id === id);
  const creatoIl = idx >= 0 && typeof doc.assetti[idx].creatoIl === "string"
    ? doc.assetti[idx].creatoIl
    : new Date().toISOString();
  const voce = { id, nome: body.nome, nota, creatoIl, profili };
  if (idx >= 0) doc.assetti[idx] = voce;
  else doc.assetti.push(voce);

  await saveNoteDoc(env, doc);
  console.log(`[note] assetto salvato: "${id}" (${Object.keys(profili).length} concept)`);
  return { ok: true, id, errori: [] };
}

/** Cancella un assetto. Ritorna `{ ok, errori[] }` oppure `{ ok, rimosso }`. */
export async function removeAssetto(env, id) {
  if (!id) return { ok: false, errori: ["serve l'id dell'assetto da rimuovere"] };

  const doc = await loadNote(env);
  const idx = doc.assetti.findIndex((a) => a.id === id);
  if (idx < 0) return { ok: false, errori: [`assetto "${id}" non trovato`] };

  doc.assetti.splice(idx, 1);
  await saveNoteDoc(env, doc);
  console.log(`[note] assetto rimosso: "${id}"`);
  return { ok: true, rimosso: id };
}
