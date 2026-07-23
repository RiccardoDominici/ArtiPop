// IL GENERATORE DI UN GIORNO.
//
// Data una scena (concept), lo stato dell'arco e (facoltativi) i byte di ieri e
// del keyframe, produce l'immagine di oggi passando dal cancello di collaudo.
// Estratto in un modulo a sé perché lo usano in tre: il cron (index.js), il
// backfill (index.js) e il lab di tuning (lab.js), tutti con la stessa logica.
//
// È una funzione PURA rispetto a KV: non scrive niente. Legge i riferimenti solo
// se non gli vengono passati già in memoria (`prevBytes`/`anchorBytes`); i
// chiamanti che generano più giorni di fila li passano, evitando ogni giro di KV.

import {
  generateImage, generateWithGate, referenceFor,
} from "./generate.js";
import {
  fingerprintFromBytes, fingerprintFromArchive, compare, formatMeasures, decodeFingerprint,
} from "./metrics.js";
import {
  buildKeyframePrompt, buildDailyPrompt, buildCumulativePrompt, buildRealignPrompt, clausesFor,
} from "./story.js";

/**
 * Genera l'immagine di un giorno per un flusso, con il cancello di collaudo.
 * Ritorna { bytes, contentType, model, width, height, impronta, misure,
 *           verdetto, tentativi, ancora? }.
 */
export async function generateDay(env, channel, concept, state, { prevBytes = null, anchorBytes = null, maxAttempts = null } = {}) {
  const label = `${channel.id}/${concept.id} t${state.stage + 1}`;

  /* --- Keyframe: primo giorno dell'arco, generazione pulita --- */
  if (state.dayInArc === 0) {
    const clean = await generateImage(env, buildKeyframePrompt(concept), state.seed);

    // Riallineamento: il keyframe nasce da testo puro, mentre tutti i giorni
    // successivi nascono da un editing. Senza questo passaggio il giorno 1
    // dell'arco risulta visibilmente "di un'altra famiglia" rispetto ai suoi
    // seguiti. Si rigenera partendo da se stesso, e si tiene il risultato SOLO
    // se le misure dicono che non ha perso nulla per strada.
    const selfRef = await referenceFor(env, channel.id, state.lastDate, clean.bytes);
    if (selfRef) {
      try {
        const aligned = await generateImage(env, buildRealignPrompt(concept), state.seed, [selfRef]);
        if (aligned.usedReference) {
          const [fa, fb] = await Promise.all([
            fingerprintFromBytes(env, clean.bytes),
            fingerprintFromBytes(env, aligned.bytes),
          ]);
          if (fa && fb) {
            const m = compare(fa, fb);
            // Il riallineamento deve essere un ritocco, non una reinvenzione.
            if (m.estensione < 45 && m.degrado < 10) {
              console.log(`[gen] ${label}: keyframe riallineato (${formatMeasures(m)})`);
              return { ...aligned, impronta: fb, misure: null, verdetto: null, tentativi: 2, ancora: true };
            }
            console.warn(`[gen] ${label}: riallineamento scartato, ha cambiato troppo (${formatMeasures(m)})`);
          } else {
            return { ...aligned, impronta: null, misure: null, verdetto: null, tentativi: 2, ancora: true };
          }
        }
      } catch (err) {
        console.warn(`[gen] ${label}: riallineamento fallito (${err.message}), tengo l'originale`);
      }
    }
    const impronta = await fingerprintFromBytes(env, clean.bytes);
    return { ...clean, impronta, misure: null, verdetto: null, tentativi: 1, ancora: true };
  }

  /* --- Giorno normale: image 0 = ieri, image 1 = keyframe dell'arco --- */
  const [refIeri, refAncora] = await Promise.all([
    state.prevDate ? referenceFor(env, channel.id, state.prevDate, prevBytes) : null,
    state.anchorDate && state.anchorDate !== state.prevDate
      ? referenceFor(env, channel.id, state.anchorDate, anchorBytes)
      : null,
  ]);

  // L'impronta di ieri: di norma è già nello stato (l'abbiamo salvata ieri), e
  // in quel caso il confronto non costa niente. Se manca, si ricalcola.
  let prevFingerprint = decodeFingerprint(state.improntaPrec);
  if (!prevFingerprint && state.prevDate) {
    prevFingerprint = prevBytes
      ? await fingerprintFromBytes(env, prevBytes)
      : await fingerprintFromArchive(env, channel.id, state.prevDate);
  }

  if (!refIeri && !refAncora) {
    console.warn(`[gen] ${label}: nessun riferimento disponibile, genero da zero`);
    const img = await generateImage(env, buildKeyframePrompt(concept), state.seed);
    const impronta = await fingerprintFromBytes(env, img.bytes);
    return { ...img, impronta, misure: null, verdetto: null, tentativi: 1 };
  }

  if (!refIeri) {
    // Ieri non recuperabile: si riparte dal keyframe e si descrive lo stato
    // cumulativo raggiunto. Niente cancello: il confronto non avrebbe senso.
    console.warn(`[gen] ${label}: ieri non disponibile, uso lo stato cumulativo dall'àncora`);
    const img = await generateImage(env, buildCumulativePrompt(concept, state.stage), state.seed, [refAncora]);
    const impronta = await fingerprintFromBytes(env, img.bytes);
    return { ...img, impronta, misure: null, verdetto: null, tentativi: 1 };
  }

  const refs = [refIeri, refAncora].filter(Boolean);
  return generateWithGate(env, {
    label,
    seed: state.seed + state.dayInArc * 101,
    refs,
    profile: concept.profilo,
    prevFingerprint,
    maxAttempts,
    doseIniziale: state.dosePartenza ?? 0,
    // Riferimenti per la misura di DIREZIONE: quanto la scena si e' allontanata
    // dal keyframe, e se rispetto a ieri e' avanzata o arretrata.
    anchorFingerprint: decodeFingerprint(state.improntaAncora),
    occupazionePrec: typeof state.occupazione === "number" ? state.occupazione : null,
    promptForDose: (dose) =>
      buildDailyPrompt(concept, clausesFor(concept, state.stage, dose, state.extraIndex), refs.length > 1),
  });
}
