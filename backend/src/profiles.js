// PROFILI DI CAMBIAMENTO TUNABILI DA FUORI.
//
// I range con cui il cancello (metrics.js) decide se accettare un'immagine sono
// definiti nel codice, famiglia per famiglia (families.js). Questo modulo
// permette di SOVRASCRIVERLI a caldo, senza toccare il codice né rideployare:
// un JSON salvato in KV (`tuning:profili`) viene fuso sopra i default.
//
// La chiave del JSON è l'id della famiglia — che nel vocabolario dello
// strumento di tuning è il "concept" (lo SCHEMA DI EVOLUZIONE): timelapse,
// crescita, accumulo, costruzione, attraversamento, metamorfosi. Il "soggetto"
// (pianta, isola, città…) è l'ELEMENT, e non c'entra con i range: due timelapse
// di soggetti diversi condividono lo stesso profilo.
//
// Flusso previsto: si tarano i valori nell'interfaccia HTML locale (fuori dal
// repo), si salva il JSON, e con un tasto lo si "lancia nel Worker" — cioè si fa
// una PUT su /tuning che scrive qui. Da quel momento ogni generazione usa i
// nuovi range.

import { FAMILIES } from "./families.js";

const TUNING_KEY = "tuning:profili";

/** I campi di un profilo che si possono tarare, con i limiti di validità. */
const CAMPI_RANGE = {
  estensione: { min: 0, max: 100 },
  intensita: { min: 0, max: 100 },
  compattezza: { min: 0, max: 1 },
};
const CAMPI_SCALARI = {
  maxDeriva: { min: 0, max: 100 },
  maxDegrado: { min: 0, max: 100 },
};

/**
 * Profilo di default COMPLETO di una famiglia. Nota importante: le guardie
 * maxDeriva/maxDegrado possono vivere sull'oggetto famiglia (es. metamorfosi ha
 * `maxDeriva: 9` di primo livello) e non dentro `profilo`. Vanno raccolte da
 * entrambi, altrimenti si perdono nella fusione — bug reale: metamorfosi
 * sarebbe tornata alla guardia globale 3.5 invece della sua 9.
 */
function famBase(fam) {
  return {
    estensione: [...fam.profilo.estensione],
    intensita: [...fam.profilo.intensita],
    compattezza: [...fam.profilo.compattezza],
    monotona: Boolean(fam.profilo.monotona),
    // null/undefined = "usa la guardia globale di config"; un numero la sovrascrive.
    maxDeriva: fam.profilo.maxDeriva ?? fam.maxDeriva ?? null,
    maxDegrado: fam.profilo.maxDegrado ?? fam.maxDegrado ?? null,
  };
}

/** Profili di default presi dal codice (famiglia per famiglia). */
export function defaultProfiles() {
  const out = {};
  for (const [id, fam] of Object.entries(FAMILIES)) {
    out[id] = { nome: fam.nome, ...famBase(fam) };
  }
  return out;
}

/** Legge l'override salvato in KV (o {} se non c'è / è illeggibile). */
export async function loadTuning(env) {
  try {
    const raw = await env.KV.get(TUNING_KEY, { type: "json" });
    return raw && typeof raw === "object" && raw.profili ? raw.profili : {};
  } catch (err) {
    console.warn(`[profiles] override di tuning illeggibile: ${err.message}`);
    return {};
  }
}

/**
 * Fonde un override sul profilo di default di UNA famiglia. L'override può
 * essere parziale: quel che non specifica resta al default. Ritorna un profilo
 * pronto per metrics.verdict (stessa forma di family.profilo).
 */
export function mergeProfilo(famProfilo, override) {
  const base = {
    estensione: [...famProfilo.estensione],
    intensita: [...famProfilo.intensita],
    compattezza: [...famProfilo.compattezza],
    monotona: Boolean(famProfilo.monotona),
    maxDeriva: famProfilo.maxDeriva,
    maxDegrado: famProfilo.maxDegrado,
  };
  if (!override || typeof override !== "object") return base;

  for (const campo of Object.keys(CAMPI_RANGE)) {
    const v = override[campo];
    if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && isFinite(n))) {
      base[campo] = [Math.min(v[0], v[1]), Math.max(v[0], v[1])];
    }
  }
  if (typeof override.monotona === "boolean") base.monotona = override.monotona;
  for (const campo of Object.keys(CAMPI_SCALARI)) {
    if (override[campo] === null) base[campo] = undefined; // "torna alla guardia globale"
    else if (typeof override[campo] === "number" && isFinite(override[campo])) base[campo] = override[campo];
  }
  return base;
}

/**
 * Risolve il profilo effettivo di una famiglia: default del codice + override KV.
 * `tuning` è la mappa già caricata (loadTuning), così un intero run fa UNA sola
 * lettura di KV invece di una per giorno.
 */
export function resolveProfilo(family, tuning) {
  return mergeProfilo(famBase(family), tuning?.[family.id]);
}

/** Profili effettivi di TUTTE le famiglie (per la GET /tuning e la UI). */
export async function effectiveProfiles(env) {
  const tuning = await loadTuning(env);
  const out = {};
  for (const [id, fam] of Object.entries(FAMILIES)) {
    const p = mergeProfilo(famBase(fam), tuning[id]);
    out[id] = {
      nome: fam.nome,
      estensione: p.estensione,
      intensita: p.intensita,
      compattezza: p.compattezza,
      monotona: p.monotona,
      maxDeriva: p.maxDeriva ?? null,
      maxDegrado: p.maxDegrado ?? null,
      // Utile alla UI per mostrare il "quanto ti sei discostato dal default".
      overridden: Boolean(tuning[id]),
    };
  }
  return out;
}

/**
 * Valida e salva un JSON di tuning in KV. Ritorna { ok, errori[] }.
 * Accetta un oggetto { profili: { <famigliaId>: {...} } } oppure direttamente
 * la mappa dei profili. Ignora le chiavi che non sono famiglie note.
 */
export async function saveTuning(env, incoming) {
  const errori = [];
  const profiliIn = incoming?.profili && typeof incoming.profili === "object" ? incoming.profili : incoming;
  if (!profiliIn || typeof profiliIn !== "object") {
    return { ok: false, errori: ["JSON non valido: manca l'oggetto dei profili"] };
  }

  const puliti = {};
  for (const [id, prof] of Object.entries(profiliIn)) {
    if (!FAMILIES[id]) { errori.push(`concept sconosciuto ignorato: "${id}"`); continue; }
    if (!prof || typeof prof !== "object") { errori.push(`${id}: profilo non valido`); continue; }

    const p = {};
    for (const [campo, lim] of Object.entries(CAMPI_RANGE)) {
      const v = prof[campo];
      if (v === undefined) continue;
      if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number" && isFinite(n))) {
        errori.push(`${id}.${campo}: serve [min, max] numerici`); continue;
      }
      let [lo, hi] = [Math.min(v[0], v[1]), Math.max(v[0], v[1])];
      lo = Math.max(lim.min, lo); hi = Math.min(lim.max, hi);
      p[campo] = [lo, hi];
    }
    if (typeof prof.monotona === "boolean") p.monotona = prof.monotona;
    for (const [campo, lim] of Object.entries(CAMPI_SCALARI)) {
      if (prof[campo] === null) { p[campo] = null; continue; }
      if (prof[campo] === undefined) continue;
      if (typeof prof[campo] !== "number" || !isFinite(prof[campo])) {
        errori.push(`${id}.${campo}: serve un numero o null`); continue;
      }
      p[campo] = Math.min(lim.max, Math.max(lim.min, prof[campo]));
    }
    puliti[id] = p;
  }

  const doc = { version: 1, updatedAt: new Date().toISOString(), profili: puliti };
  await env.KV.put(TUNING_KEY, JSON.stringify(doc));
  return { ok: true, errori, salvati: Object.keys(puliti), doc };
}

/** Cancella l'override (torna ai default del codice). */
export async function clearTuning(env) {
  await env.KV.delete(TUNING_KEY);
}
