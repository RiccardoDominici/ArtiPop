// Protegge i quattro ripieghi di `generateDay` (src/daygen.js), l'anello
// centrale che decide se l'utente riceve o no l'immagine del giorno: fino a
// questo ciclo nessun test lo chiamava direttamente (grep su
// backend/tests/ non trovava né `generateDay` né i suoi messaggi di warning).
//
// Zero generazioni AI reali: `env.AI.run` è uno stub che restituisce byte PNG
// finti e cattura i campi del multipart (prompt/seed/riferimenti) per
// verificare COSA daygen.js ha chiesto, senza mockare alcun modulo — stessa
// filosofia di tests/helpers/fakeEnv.js: solo oggetti letterali passati come
// argomenti.
import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { generateDay } from "../../src/daygen.js";
import { pngGrigioUniforme, stubImagesConPng } from "../helpers/pngFinto.js";
import { makeKV } from "../helpers/fakeEnv.js";

// Miniatura di metrics.js: 48x96 (privata al modulo, replicata qui solo per
// costruire immagini finte della dimensione giusta — vedi la stessa nota in
// tests/unit/cancello-guasto-a-meta.test.js).
const THUMB_W = 48;
const THUMB_H = 96;

// Byte minimi riconosciuti da `normalizeImageOutput` (generate.js) come
// Uint8Array senza bisogno di decodifica.
const BYTES_AI_FINTI = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

/* ===================== FIXTURE ===================== */

function conceptFittizio(overrides = {}) {
  return {
    id: "concept-test",
    setting: "una scena di prova",
    style: "stile di prova",
    palette: "palette di prova",
    tappe: Array.from({ length: 7 }, (_, i) => [`tappa ${i}`]),
    extra: ["extra 0", "extra 1"],
    famiglia: { id: "fam-test", conserva: "niente" },
    profilo: { estensione: [10, 50], intensita: [5, 40], compattezza: [0.2, 0.8], monotona: false },
    ...overrides,
  };
}

function stateBase(overrides = {}) {
  return {
    stage: 0,
    dayInArc: 0,
    lastDate: "2026-07-25",
    seed: 12345,
    anchorDate: "2026-07-25",
    prevDate: null,
    dosePartenza: 0,
    extraIndex: null,
    ...overrides,
  };
}

const CANALE = { id: "canale-test" };

/* ===================== STUB AI CHE CATTURA IL MULTIPART ===================== */

// Ricostruisce il FormData spedito da tryKlein (generate.js) a partire dal
// body/contentType passati a env.AI.run, per verificare COSA daygen.js ha
// chiesto (prompt, seed, presenza di riferimenti) senza mockare generate.js.
function stubAICatturaPrompt() {
  const chiamate = [];
  return {
    chiamate,
    async run(model, opts) {
      if (opts?.multipart) {
        const buf = await new Response(opts.multipart.body).arrayBuffer();
        const req = new Request("http://dummy", {
          method: "POST",
          headers: { "content-type": opts.multipart.contentType },
          body: buf,
        });
        const form = await req.formData();
        chiamate.push({
          prompt: form.get("prompt"),
          seed: form.get("seed"),
          haRiferimento: form.has("input_image_0"),
        });
      }
      return BYTES_AI_FINTI;
    },
  };
}

/* ===================== IMAGES: PNG A SCACCHIERA + STUB A SEQUENZA ===================== */

function u32be(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}
function chunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  out.set(u32be(data.length), 0);
  out.set(body, 4);
  return out;
}

// PNG a scacchiera (colorType 0, 8 bit): serve SOLO al test del riallineamento
// scartato. `pngGrigioUniforme` (helper esistente) non basta lì: due sue
// istanze qualunque, per quanto di valore diverso, confrontano sempre a
// estensione/degrado zero — `compare()` (metrics.js) toglie la luminosità
// media prima di misurare, e un'immagine uniforme non ha altro. Serve vera
// TEXTURE per produrre misure fuori soglia.
function pngScacchiera(width, height, chiaro = 220, scuro = 30) {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0; // non interlacciata

  const stride = width;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    for (let x = 0; x < width; x++) {
      const quadretto = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      raw[y * (stride + 1) + 1 + x] = quadretto ? chiaro : scuro;
    }
  }
  const idatData = new Uint8Array(deflateSync(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)));

  const ihdrChunk = chunk("IHDR", ihdr);
  const idatChunk = chunk("IDAT", idatData);
  const iendChunk = chunk("IEND", new Uint8Array(0));

  const out = new Uint8Array(sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let o = 0;
  out.set(sig, o); o += sig.length;
  out.set(ihdrChunk, o); o += ihdrChunk.length;
  out.set(idatChunk, o); o += idatChunk.length;
  out.set(iendChunk, o);
  return out;
}

// Stub IMAGES che risponde con PNG diverse a chiamate successive (clampando
// sull'ultima quando le chiamate superano l'elenco): serve a dare alle DUE
// impronte confrontate da daygen.js (pulito vs riallineato) valori diversi,
// cosa che un singolo `stubImagesConPng` non può fare.
function stubImagesSequenza(pngs) {
  let i = 0;
  return {
    input() {
      const png = pngs[Math.min(i, pngs.length - 1)];
      i++;
      return {
        transform() {
          return { async output() { return { response: () => new Response(png) } } };
        },
      };
    },
  };
}

/* ===================== 1. KEYFRAME (dayInArc 0) ===================== */

describe("generateDay: keyframe (dayInArc 0)", () => {
  it("senza riferimento a se stesso (IMAGES assente): pubblica il pulito, tentativi 1, misure null", async () => {
    const env = { AI: stubAICatturaPrompt() }; // niente IMAGES: resizeForModel torna null → selfRef null
    const res = await generateDay(env, CANALE, conceptFittizio(), stateBase({ dayInArc: 0 }));

    expect(res.tentativi).toBe(1);
    expect(res.ancora).toBe(true);
    expect(res.misure).toBeNull();
    expect(res.verdetto).toBeNull();
    expect(res.bytes.length).toBeGreaterThan(0);
  });

  it("con riallineamento ACCETTATO (stessa impronta prima/dopo): tentativi 2, ancora true", async () => {
    const pngUniforme = pngGrigioUniforme(THUMB_W, THUMB_H, 128);
    const env = { AI: stubAICatturaPrompt(), IMAGES: stubImagesConPng(pngUniforme) };
    const res = await generateDay(env, CANALE, conceptFittizio(), stateBase({ dayInArc: 0 }));

    expect(res.tentativi).toBe(2);
    expect(res.ancora).toBe(true);
    expect(res.misure).toBeNull();
    expect(res.verdetto).toBeNull();
    expect(res.impronta).not.toBeNull();
  });

  it("con riallineamento SCARTATO (misure fuori soglia): si tengono i byte puliti, tentativi 1", async () => {
    const pngPiatta = pngGrigioUniforme(THUMB_W, THUMB_H, 128);
    const pngTexture = pngScacchiera(THUMB_W, THUMB_H);
    // 1ª chiamata: riferimento di sé stesso (ininfluente). 2ª: impronta del
    // pulito (texture). 3ª: impronta del riallineato (piatta) → mismatch.
    const env = {
      AI: stubAICatturaPrompt(),
      IMAGES: stubImagesSequenza([pngPiatta, pngTexture, pngPiatta]),
    };
    const res = await generateDay(env, CANALE, conceptFittizio(), stateBase({ dayInArc: 0 }));

    expect(res.tentativi).toBe(1);
    expect(res.ancora).toBe(true);
    expect(res.misure).toBeNull();
    expect(res.verdetto).toBeNull();
  });
});

/* ===================== 2. GIORNO NORMALE SENZA RIFERIMENTI ===================== */

describe("generateDay: giorno normale (dayInArc > 0) senza riferimenti recuperabili", () => {
  it("prevDate e anchorDate entrambi assenti: rigenera da keyframe, tentativi 1, verdetto null", async () => {
    const env = { AI: stubAICatturaPrompt() };
    const state = stateBase({ dayInArc: 3, stage: 2, prevDate: null, anchorDate: null });

    const res = await generateDay(env, CANALE, conceptFittizio(), state);

    expect(res.tentativi).toBe(1);
    expect(res.verdetto).toBeNull();
    expect(res.misure).toBeNull();
    expect(res.ancora).toBeUndefined();
    expect(env.AI.chiamate[0].haRiferimento).toBe(false);
  });

  it("solo ieri non recuperabile (àncora sì): prompt cumulativo dall'àncora, sempre senza cancello", async () => {
    const pngUniforme = pngGrigioUniforme(THUMB_W, THUMB_H, 128);
    const env = {
      AI: stubAICatturaPrompt(),
      IMAGES: stubImagesConPng(pngUniforme),
      KV: makeKV(), // vuoto: getImage per prevDate non trova nulla → refIeri null
    };
    const state = stateBase({
      dayInArc: 3,
      stage: 2,
      prevDate: "2026-07-24",
      anchorDate: "2026-07-20",
    });

    const res = await generateDay(env, CANALE, conceptFittizio(), state, {
      anchorBytes: new Uint8Array([1, 2, 3, 4]), // in memoria: salta KV per l'àncora
    });

    expect(res.tentativi).toBe(1);
    expect(res.verdetto).toBeNull();
    expect(res.misure).toBeNull();
    const chiamata = env.AI.chiamate[0];
    expect(chiamata.haRiferimento).toBe(true);
    expect(chiamata.prompt).toMatch(/at its beginning/); // firma di buildCumulativePrompt, story.js
  });
});

/* ===================== 3. INVARIANTE: STATO → DETERMINISMO DELLA PESCA ===================== */

describe("generateDay: giorno normale con ieri disponibile", () => {
  it("delega a generateWithGate con seed = state.seed + state.dayInArc * 101 e refs non vuoto", async () => {
    const pngUniforme = pngGrigioUniforme(THUMB_W, THUMB_H, 128);
    const env = { AI: stubAICatturaPrompt(), IMAGES: stubImagesConPng(pngUniforme) };
    const state = stateBase({
      dayInArc: 4,
      stage: 3,
      seed: 1000,
      prevDate: "2026-07-28",
      anchorDate: "2026-07-25",
    });

    const res = await generateDay(env, CANALE, conceptFittizio(), state, {
      prevBytes: new Uint8Array([9, 9, 9]),
      anchorBytes: new Uint8Array([8, 8, 8]),
    });

    // Il cancello è attivo (prevBytes passati → prevFingerprint calcolabile):
    // l'immagine finta è uniforme, quindi ogni tentativo mostra "zero
    // cambiamento" e finisce rifiutato. Non è quello che si sta verificando
    // qui — l'invariante riguarda seed e refs del PRIMO tentativo, che la
    // sequenza di rifiuti non altera.
    expect(res.ripiego).toBe(true);
    const chiamata = env.AI.chiamate[0];
    expect(chiamata.haRiferimento).toBe(true);
    expect(Number(chiamata.seed)).toBe(1000 + 4 * 101);
  });
});
