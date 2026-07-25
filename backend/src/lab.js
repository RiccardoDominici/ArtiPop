// LAB DI TUNING — genera archi USA-E-GETTA per tarare i range.
//
// Data una coppia CONCEPT (schema di evoluzione) × ELEMENT (soggetto), genera un
// arco di prova e restituisce, giorno per giorno, le sei misure del cambiamento.
// Serve a due cose:
//   1. vedere la distribuzione reale delle misure per quella coppia, così si
//      scelgono i range con dati alla mano invece che a intuito;
//   2. provare combinazioni mai viste ("timelapse di una pianta", "un dipinto
//      che si compone per accumulo") prima di metterle in produzione.
//
// NON tocca lo stato né l'archivio di produzione: le immagini finiscono in chiavi
// KV `lab:img:*` con scadenza automatica (si autocancellano dopo un'ora).

import { CONFIG } from "./config.js";
import { combine } from "./concepts.js";
import { resolveProfilo, loadTuning } from "./profiles.js";
import { FAMILIES } from "./families.js";
import { allFamilies } from "./catalog.js";
import { generateDay } from "./daygen.js";
import { clausesFor } from "./story.js";
import { encodeFingerprint, formatMeasures } from "./metrics.js";

const LAB_TTL = 3600; // le immagini di prova vivono un'ora, poi spariscono da sole
const labKey = (runId, n) => `lab:img:${runId}:${n}`;

/**
 * Genera un arco di prova. `gate` true = applica il cancello coi range correnti
 * (comportamento di produzione, mostra quanti tentativi servono); false = una
 * sola generazione al giorno, misura grezza — è la modalità giusta per TARARE,
 * perché mostra dove cadono naturalmente le misure senza che il cancello le
 * spinga dentro il range.
 *
 * `catalog` (facoltativo, vedi catalog.js) allarga entrambi gli assi ai
 * concept/element custom: il lab prova qualunque coppia, anche mista.
 */
export async function runLabArc(env, { familyId, elementId, days = 7, gate = false, runId, catalog = null }) {
  const fams = catalog ? allFamilies(catalog) : FAMILIES;
  const fam = fams[familyId];
  if (!fam) throw new Error(`concept (schema) sconosciuto: "${familyId}"`);
  const nGiorni = Math.min(Math.max(Number(days) || 7, 2), 7);

  // Range effettivi = default del codice (o del catalogo) + eventuale override
  // di tuning già in KV: così il collaudo del lab riflette i valori che si
  // stanno tarando.
  const tuning = await loadTuning(env);
  const profiloEff = resolveProfilo(fam, tuning);
  const concept = combine(familyId, elementId, profiloEff, catalog);

  const channel = { id: "lab" }; // finto: non tocca KV perché passiamo i byte in memoria
  const giorni = [];
  let prevBytes = null, anchorBytes = null, improntaPrec = null, improntaAncora = null, occupazione = 0;

  for (let n = 0; n < nGiorni; n++) {
    const state = {
      dayInArc: n,
      stage: Math.min(n, concept.tappe.length - 1),
      extraIndex: null,
      dosePartenza: 0,
      seed: concept.seed ?? 1234 + n,
      lastDate: `lab-${n}`,
      prevDate: n > 0 ? `lab-${n - 1}` : null,
      anchorDate: "lab-0",
      improntaPrec,
      improntaAncora,
      occupazione,
      scene: clausesFor(concept, Math.min(n, concept.tappe.length - 1), 0, null).join(". "),
    };

    const img = await generateDay(env, channel, concept, state, {
      prevBytes, anchorBytes,
      maxAttempts: gate ? CONFIG.MAX_ATTEMPTS : 1,
    });

    await env.KV.put(labKey(runId, n), img.bytes, {
      expirationTtl: LAB_TTL,
      metadata: { contentType: img.contentType || "image/png" },
    });

    giorni.push({
      n,
      tappa: state.stage + 1,
      descrizione: state.scene,
      model: img.model,
      tentativi: img.tentativi,
      misure: img.misure || null,
      riga: img.misure ? formatMeasures(img.misure) : null,
      collaudo: img.verdetto ? { ok: img.verdetto.ok, motivi: img.verdetto.motivi } : null,
    });

    console.log(`[lab] ${runId} g${n} (t${state.stage + 1}): ${img.misure ? formatMeasures(img.misure) : "keyframe"}`);

    prevBytes = img.bytes;
    if (n === 0) { anchorBytes = img.bytes; occupazione = 0; }
    else if (typeof img.misure?.occupazione === "number") occupazione = img.misure.occupazione;
    improntaPrec = img.impronta ? encodeFingerprint(img.impronta) : null;
    if (n === 0 && img.impronta) improntaAncora = encodeFingerprint(img.impronta);
  }

  return {
    runId,
    concept: {
      schema: familyId,
      element: elementId,
      nome: concept.nome,
      virtuale: Boolean(concept.virtuale),
      profilo: profiloEff,
    },
    giorni,
  };
}

/** Legge un'immagine di prova dal KV (o null). */
export async function getLabImage(env, runId, n) {
  const res = await env.KV.getWithMetadata(labKey(runId, n), { type: "stream" });
  if (!res || !res.value) return null;
  return { stream: res.value, meta: res.metadata || {} };
}
