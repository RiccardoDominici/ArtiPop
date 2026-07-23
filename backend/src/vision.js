// LETTURA DELL'IMMAGINE DI IERI.
//
// È il pezzo che chiude l'anello. Prima, il sistema avanzava a occhi chiusi:
// "oggi è il quarto giorno, quindi tocca la quarta tappa", senza sapere se
// l'immagine di ieri fosse arrivata alla terza o già alla sesta. Da quel
// disallineamento nascevano ENTRAMBI i difetti osservati nell'archivio:
//
//   - il modello corre avanti (l'isola era già tutta verde il primo giorno)
//     → nei giorni dopo non resta niente da fare → giorni identici;
//   - il modello resta indietro → il giorno dopo deve recuperare tutto in una
//     volta → salto brusco.
//
// Qui un modello che sa guardare le immagini dice a che tappa è arrivata
// DAVVERO la storia. Il risultato non entra mai nel prompt: serve solo a
// scegliere quale tappa descrivere oggi.

import { CONFIG } from "./config.js";

/** Estrae il primo intero compreso fra 1 e `max` da una risposta libera. */
function parseStageNumber(text, max) {
  const m = String(text ?? "").match(/\d+/g);
  if (!m) return null;
  for (const raw of m) {
    const n = Number(raw);
    if (n >= 1 && n <= max) return n - 1; // le tappe sono numerate da 1 per il modello
  }
  return null;
}

/**
 * Chiede a un modello di visione a quale tappa del piano corrisponde
 * l'immagine data. Ritorna l'indice (0-based) oppure null se non è stato
 * possibile saperlo — in quel caso il chiamante torna a fidarsi del calendario,
 * che è esattamente il comportamento vecchio: si perde il miglioramento, non
 * si rompe niente.
 *
 * `imageBytes` va passata già rimpicciolita (vedi generate.js): i modelli di
 * visione non hanno bisogno della risoluzione piena e le richieste sono più
 * veloci ed economiche.
 */
export async function readStage(env, concept, imageBytes, traccia = null) {
  const elenco = concept.tappe
    .map((frasi, i) => `${i + 1}. ${frasi.join(", ")}`)
    .join("\n");

  const prompt =
    `This image is one frame of a slow visual story that unfolds in ${concept.tappe.length} steps.\n` +
    `The steps are:\n${elenco}\n\n` +
    `Look carefully at the image and decide which step number it currently shows. ` +
    `Judge only by what is actually visible. ` +
    `Answer with the step number alone, nothing else.`;

  const bytes = Array.from(imageBytes);

  for (const model of CONFIG.VISION_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const t0 = Date.now();
        const res = await env.AI.run(model, { prompt, image: bytes, max_tokens: 12 });
        const stage = parseStageNumber(res?.response, concept.tappe.length);
        traccia?.push({ model, ms: Date.now() - t0, byte: bytes.length, risposta: res?.response ?? null });
        if (stage === null) {
          console.warn(`[vision] ${model}: risposta illeggibile "${res?.response}"`);
          break; // riprovare lo stesso modello non aiuta: si passa al successivo
        }
        console.log(`[vision] ${model}: ieri mostra la tappa ${stage + 1}/${concept.tappe.length}`);
        return stage;
      } catch (err) {
        const msg = String(err?.message ?? err);
        // Llama 3.2 Vision richiede un'accettazione di licenza una tantum per
        // account. Invece di pretendere un passaggio manuale, la si manda al
        // volo al primo rifiuto e si riprova: il sistema resta autonomo.
        if (attempt === 1 && /agree|licen[sc]e|terms/i.test(msg)) {
          console.log(`[vision] ${model}: accetto la licenza e riprovo`);
          try {
            await env.AI.run(model, { prompt: "agree" });
          } catch (e2) {
            console.warn(`[vision] accettazione licenza fallita: ${e2.message}`);
          }
          continue;
        }
        traccia?.push({ model, errore: msg.slice(0, 300) });
        console.warn(`[vision] ${model} fallito: ${msg}`);
        break;
      }
    }
  }
  console.warn("[vision] nessun modello di visione disponibile: si usa il calendario");
  return null;
}
