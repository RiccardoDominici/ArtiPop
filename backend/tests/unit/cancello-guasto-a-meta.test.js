// Copre il guasto A META' del ciclo dei tentativi in `generateWithGate`
// (src/generate.js): prima di questo ciclo un fallimento totale della catena
// di generatori al 2º/3º tentativo lanciava e buttava via il candidato già
// generato e misurato al 1º, anche se pubblicabile (principio 1, CLAUDE.md).
// Zero generazioni AI reali: AI.run è uno stub che ritorna byte finti o
// lancia, e in nessun test si arriva a chiamare `fetch` verso Pollinations
// senza che sia anch'esso stubbato — coerente col budget AI 0 di questo ciclo.
import { describe, it, expect, afterEach } from "vitest";
import { generateWithGate } from "../../src/generate.js";
import { pngGrigioUniforme, stubImagesConPng } from "../helpers/pngFinto.js";

// Miniatura di metrics.js: 48x96 (privata al modulo, replicata qui solo per
// costruire impronte di test della dimensione giusta — non è un secondo posto
// da tenere sincrono con una regola di dominio, è la dimensione fissa del
// buffer che i test devono produrre).
const THUMB_W = 48;
const THUMB_H = 96;

// Byte minimi riconosciuti da `normalizeImageOutput` (generate.js) come
// Uint8Array senza bisogno di decodifica: quello che produce l'AI, non quello
// che consuma il cancello per la misura (per quello serve una PNG vera, sotto).
const BYTES_AI_FINTI = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

function impronteUniforme(valore) {
  return new Uint8Array(THUMB_W * THUMB_H).fill(valore);
}

const PNG_CANDIDATO = pngGrigioUniforme(THUMB_W, THUMB_H, 200);

function opzioniBase(overrides = {}) {
  return {
    promptForDose: () => "prompt di test",
    seed: 1,
    refs: [],
    label: "test",
    prevFingerprint: impronteUniforme(100),
    profile: { estensione: [5, 100], intensita: [1, 100], compattezza: [0, 1] },
    ...overrides,
  };
}

// `tryPollinations` (generate.js) usa `fetch` globale, non `env`: per
// verificare un guasto TOTALE della catena senza uscire davvero in rete lo si
// sostituisce qui, ripristinandolo subito dopo ogni test.
const fetchOriginale = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginale;
});
function fetchCheLancia() {
  globalThis.fetch = async () => {
    throw new Error("rete non disponibile (simulato)");
  };
}

describe("generateWithGate: guasto a metà ciclo dei tentativi", () => {
  it("1º candidato rifiutato + 2º tentativo con generatori tutti falliti: torna il 1º con ripiego, non lancia", async () => {
    let chiamate = 0;
    const env = {
      AI: {
        run: async () => {
          chiamate++;
          if (chiamate === 1) return BYTES_AI_FINTI; // 1º tentativo: genera
          throw new Error("modello non disponibile (simulato)"); // dal 2º in poi: guasto totale
        },
      },
      IMAGES: stubImagesConPng(PNG_CANDIDATO),
    };
    fetchCheLancia(); // pollinations, ultima spiaggia del 2º tentativo, deve fallire anch'esso

    const res = await generateWithGate(env, opzioniBase({ maxAttempts: 3 }));

    expect(res.ripiego).toBe(true);
    expect(res.tentativi).toBe(1);
    expect(res.verdetto.ok).toBe(false);
  });

  it("guasto al 1º tentativo (nessun candidato in mano): rilancia l'errore, il chiamante tiene l'immagine di ieri", async () => {
    const env = {
      AI: { run: async () => { throw new Error("modello non disponibile (simulato)"); } },
      IMAGES: stubImagesConPng(PNG_CANDIDATO),
    };
    fetchCheLancia();

    await expect(generateWithGate(env, opzioniBase({ maxAttempts: 3 }))).rejects.toThrow(
      /generatori sono falliti/
    );
  });

  it("maxAttempts: 0 con prevFingerprint e profile presenti: errore parlante, mai un TypeError su migliore", async () => {
    const env = {
      AI: { run: async () => { throw new Error("non doveva essere invocato"); } },
      IMAGES: stubImagesConPng(PNG_CANDIDATO),
    };

    await expect(generateWithGate(env, opzioniBase({ maxAttempts: 0 }))).rejects.toThrow(
      /tentativiMax non valido/
    );
  });

  it("cammino felice invariato: candidato accettato al 1º tentativo, nessun ripiego", async () => {
    const env = {
      AI: { run: async () => BYTES_AI_FINTI },
      IMAGES: stubImagesConPng(PNG_CANDIDATO),
    };

    const res = await generateWithGate(
      env,
      opzioniBase({
        maxAttempts: 3,
        // Stessa impronta di ieri e di oggi: nessuna misura esce dal profilo,
        // il candidato è accettato al volo.
        prevFingerprint: impronteUniforme(200),
        profile: { estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1], maxDeriva: 100, maxDegrado: 100 },
      })
    );

    expect(res.ripiego).toBeUndefined();
    expect(res.tentativi).toBe(1);
    expect(res.verdetto.ok).toBe(true);
  });
});
