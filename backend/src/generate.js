// Generazione dell'immagine del giorno, con catena di fallback per non fermarsi mai:
//
//   1. Workers AI @cf/black-forest-labs/flux-2-klein-4b  (qualità FLUX.2, ~290 neuroni)
//      → tenta le risoluzioni di CONFIG.IMAGE_SIZES in ordine decrescente
//   2. Workers AI @cf/black-forest-labs/flux-1-schnell    (~90 neuroni, max 1024px)
//   3. Pollinations.ai (gratuito senza chiavi, risoluzione ridotta — ultima spiaggia)
//
// Se TUTTO fallisce, il chiamante mantiene l'immagine di ieri: la Shortcut non si rompe mai.

import { CONFIG } from "./config.js";

/** Decodifica base64 → Uint8Array (atob è nativo e veloce nei Workers). */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Legge interamente un ReadableStream in Uint8Array. */
async function streamToBytes(stream) {
  const chunks = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/**
 * Normalizza l'output dei modelli immagine di Workers AI, che a seconda del modello
 * può essere: { image: base64 }, una stringa base64, o un ReadableStream binario.
 * Ritorna { bytes: Uint8Array, contentType }.
 */
async function normalizeImageOutput(out) {
  if (out && typeof out === "object" && typeof out.image === "string") {
    return { bytes: base64ToBytes(out.image), contentType: sniffType(out.image) };
  }
  if (typeof out === "string") {
    return { bytes: base64ToBytes(out), contentType: sniffType(out) };
  }
  if (out instanceof ReadableStream) {
    const bytes = await streamToBytes(out);
    return { bytes, contentType: sniffBytes(bytes) };
  }
  if (out instanceof Uint8Array) {
    return { bytes: out, contentType: sniffBytes(out) };
  }
  throw new Error(`output del modello non riconosciuto: ${typeof out}`);
}

/** Riconosce PNG/JPEG dai primi byte del base64 ("iVBOR" = PNG, "/9j/" = JPEG). */
function sniffType(b64) {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  return "image/png";
}

/** Riconosce PNG/JPEG dai magic bytes. */
function sniffBytes(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "image/png";
}

/** Probe pubblico (usato da /test-size): un tentativo klein a una risoluzione precisa. */
export async function tryKleinSize(env, prompt, size) {
  return tryKlein(env, prompt, 1, size);
}

/**
 * Scarica l'immagine di riferimento (ieri) ridotta a <512px via resizer esterno
 * gratuito. Ritorna i byte oppure null (in quel caso si genera senza riferimento).
 * L'URL d'archivio è immutabile e già propagato da ieri: nessun rischio di
 * leggere una scrittura appena fatta.
 */
export async function fetchReferenceImage(env, publicImageUrl, attempts = 2) {
  // Cache-buster per non farci servire un eventuale errore messo in cache dal resizer.
  const bust = `&cb=${publicImageUrl.length}`;
  const url =
    CONFIG.REF_RESIZER +
    encodeURIComponent(publicImageUrl) +
    `&w=${CONFIG.REF_WIDTH}&h=${CONFIG.REF_HEIGHT}&fit=cover&output=jpg` + bust;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 2000) throw new Error("risposta troppo piccola");
      return bytes;
    } catch (err) {
      console.warn(`[generate] resize riferimento tentativo ${attempt} fallito: ${err.message}`);
      // Il backfill legge un URL scritto pochi secondi fa: piccola attesa tra i
      // tentativi per dare tempo alla propagazione KV (solo I/O, non CPU).
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 8000 * attempt));
    }
  }
  return null;
}

/**
 * Tentativo con FLUX.2 klein: input multipart (vedi changelog Cloudflare).
 * Con `refBytes` l'immagine di ieri entra come input_image_0 (deve essere <512x512):
 * il modello mantiene composizione e palette e applica solo il cambiamento chiesto.
 */
async function tryKlein(env, prompt, seed, size, refs = []) {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(size.width));
  form.append("height", String(size.height));
  if (seed != null) form.append("seed", String(seed));
  // Riferimenti visivi (max 4, ognuno <512x512): input_image_0, input_image_1, ...
  refs.forEach((bytes, i) => {
    form.append(`input_image_${i}`, new Blob([bytes], { type: "image/jpeg" }), `ref${i}.jpg`);
  });

  // Trucco documentato da Cloudflare: passare il body multipart tramite una Request
  // fittizia per ottenere lo stream e il boundary corretto del content-type.
  const formRequest = new Request("http://dummy", { method: "POST", body: form });
  const out = await env.AI.run(CONFIG.IMAGE_MODEL_PRIMARY, {
    multipart: {
      body: formRequest.body,
      contentType: formRequest.headers.get("content-type") || "multipart/form-data",
    },
  });
  const img = await normalizeImageOutput(out);
  return { ...img, model: CONFIG.IMAGE_MODEL_PRIMARY, ...size };
}

/** Tentativo con FLUX.1 schnell: input JSON, 4-8 steps, base64 in output.
 *  Lo schema documentato accetta solo prompt+steps: proviamo prima col seed
 *  (utile per la continuità) e, se la validazione lo rifiuta, senza. */
async function trySchnell(env, prompt, seed) {
  let out;
  try {
    out = await env.AI.run(CONFIG.IMAGE_MODEL_FALLBACK, { prompt, steps: 8, seed });
  } catch {
    out = await env.AI.run(CONFIG.IMAGE_MODEL_FALLBACK, { prompt, steps: 8 });
  }
  const img = await normalizeImageOutput(out);
  return { ...img, model: CONFIG.IMAGE_MODEL_FALLBACK, width: 1024, height: 1024 };
}

/** Ultima spiaggia: Pollinations (nessuna chiave; il tier anonimo riduce la risoluzione). */
async function tryPollinations(prompt, seed, size) {
  const url =
    CONFIG.POLLINATIONS_URL +
    encodeURIComponent(prompt) +
    `?width=${size.width}&height=${size.height}&nologo=true&seed=${seed ?? 1}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`pollinations HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 5000) throw new Error("pollinations: risposta troppo piccola, probabile errore");
  return {
    bytes,
    contentType: res.headers.get("content-type") || sniffBytes(bytes),
    model: "pollinations",
    ...size,
  };
}

/**
 * Genera l'immagine del giorno provando l'intera catena di fallback.
 * `refBytes` (opzionale): immagine di ieri <512px come riferimento di continuità.
 * Ritorna { bytes, contentType, model, width, height, usedReference }.
 * Lancia un errore solo se OGNI via è fallita.
 */
export async function generateImage(env, prompt, seed, refs = []) {
  const errors = [];
  refs = (refs || []).filter(Boolean);

  // 1) FLUX.2 klein con riferimenti (continuità visiva), poi senza.
  //    Coi riferimenti si prova solo la risoluzione primaria: un errore lì è
  //    legato all'input, non all'output, e i subrequest sono contati (cap 50).
  for (const withRef of refs.length ? [true, false] : [false]) {
    const sizes = withRef ? [CONFIG.IMAGE_SIZES[0]] : CONFIG.IMAGE_SIZES;
    for (const size of sizes) {
      try {
        const t0 = Date.now();
        const img = await tryKlein(env, prompt, seed, size, withRef ? refs : []);
        console.log(
          `[generate] klein${withRef ? "+ref" : ""} ok ${size.width}x${size.height} in ${Date.now() - t0}ms (${img.bytes.length} byte)`
        );
        return { ...img, usedReference: withRef };
      } catch (err) {
        errors.push(`klein${withRef ? "+ref" : ""} ${size.width}x${size.height}: ${err.message}`);
        console.warn(
          `[generate] klein${withRef ? "+ref" : ""} ${size.width}x${size.height} fallito: ${err.message}`
        );
      }
    }
  }

  // 2) FLUX.1 schnell.
  try {
    const img = await trySchnell(env, prompt, seed);
    console.log(`[generate] schnell ok (${img.bytes.length} byte)`);
    return img;
  } catch (err) {
    errors.push(`schnell: ${err.message}`);
    console.warn(`[generate] schnell fallito: ${err.message}`);
  }

  // 3) Pollinations.
  try {
    const img = await tryPollinations(prompt, seed, CONFIG.IMAGE_SIZES[0]);
    console.log(`[generate] pollinations ok (${img.bytes.length} byte)`);
    return img;
  } catch (err) {
    errors.push(`pollinations: ${err.message}`);
    console.warn(`[generate] pollinations fallito: ${err.message}`);
  }

  throw new Error(`tutti i generatori sono falliti: ${errors.join(" | ")}`);
}
