// Generazione dell'immagine del giorno.
//
// Due livelli:
//   - `generateImage`: prova la catena di fallback finché una via funziona
//       1. flux-2-klein-4b (qualità FLUX.2, con riferimenti visivi)
//       2. flux-1-schnell (economico, senza riferimenti)
//       3. Pollinations (gratuito senza chiavi, ultima spiaggia)
//   - `generateWithGate`: genera, MISURA quanto è cambiato rispetto a ieri e
//       rigenera se il cambiamento è fuori dal profilo del concept. Esauriti i
//       tentativi pubblica il candidato più vicino al bersaglio.
//
// Se tutto fallisce, il chiamante mantiene l'immagine di ieri: la Shortcut degli
// utenti non si rompe mai.

import { CONFIG } from "./config.js";
import { getImage } from "./storage.js";
import { fingerprintFromBytes, compare, verdict, occupancy, formatMeasures } from "./metrics.js";

/** Decodifica base64 → Uint8Array (atob è nativo e veloce nei Workers). */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Legge interamente un ReadableStream in Uint8Array. */
async function streamToBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Normalizza l'output dei modelli immagine di Workers AI, che a seconda del
 * modello può essere { image: base64 }, una stringa base64 o uno stream binario.
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

/* ===================== RIFERIMENTI VISIVI ===================== */

/**
 * Rimpicciolisce un'immagine alla misura che il modello accetta come
 * riferimento (klein pretende input sotto i 512 px per lato).
 *
 * Si usa il binding Images, che lavora sui byte in memoria. La versione
 * precedente appaltava questo lavoro a un ridimensionatore esterno passandogli
 * un URL pubblico, con due difetti concreti: dipendeva da un servizio di terzi
 * e la sua cache per URL restituiva miniature vecchie alle rigenerazioni (bug
 * reale, che produceva progressioni caotiche). Ora il giro di rete non c'è più.
 */
async function resizeForModel(env, source) {
  if (!env.IMAGES) return null;
  try {
    const stream = source instanceof ReadableStream ? source : new Response(source).body;
    const out = await env.IMAGES.input(stream)
      .transform({ width: CONFIG.REF_WIDTH, height: CONFIG.REF_HEIGHT, fit: "cover" })
      .output({ format: "image/jpeg", quality: 90 });
    return new Uint8Array(await out.response().arrayBuffer());
  } catch (err) {
    console.warn(`[generate] ridimensionamento riferimento fallito: ${err.message}`);
    return null;
  }
}

/**
 * Riferimento visivo per una data d'archivio. Se i byte sono già in memoria
 * (backfill: l'immagine è stata generata pochi secondi fa in questa stessa
 * invocazione) si usano quelli, senza passare da KV — che è eventualmente
 * consistente e in passato costringeva ad attese di parecchi secondi.
 */
export async function referenceFor(env, channelId, date, cachedBytes = null) {
  if (cachedBytes) return resizeForModel(env, cachedBytes);
  const img = await getImage(env, channelId, date);
  if (!img) {
    console.warn(`[generate] nessuna immagine in archivio per ${channelId} ${date}`);
    return null;
  }
  return resizeForModel(env, img.stream);
}

/* ===================== GENERATORI ===================== */

/**
 * Tentativo con FLUX.2 klein: input multipart.
 * I riferimenti entrano come input_image_0, input_image_1, ... (max 4).
 */
async function tryKlein(env, prompt, seed, size, refs = []) {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(size.width));
  form.append("height", String(size.height));
  if (seed != null) form.append("seed", String(seed));
  refs.forEach((bytes, i) => {
    form.append(`input_image_${i}`, new Blob([bytes], { type: "image/jpeg" }), `ref${i}.jpg`);
  });

  // Trucco documentato da Cloudflare: passare il body multipart tramite una
  // Request fittizia per ottenere stream e boundary corretti.
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

/** Probe pubblico (usato da /test-size): un tentativo klein a una risoluzione precisa. */
export async function tryKleinSize(env, prompt, size) {
  return tryKlein(env, prompt, 1, size);
}

/** Tentativo con FLUX.1 schnell: input JSON, base64 in output. */
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

/** Ultima spiaggia: Pollinations (nessuna chiave, risoluzione ridotta). */
async function tryPollinations(prompt, seed, size) {
  const url =
    CONFIG.POLLINATIONS_URL +
    encodeURIComponent(prompt) +
    `?width=${size.width}&height=${size.height}&nologo=true&seed=${seed ?? 1}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`pollinations HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 5000) throw new Error("pollinations: risposta troppo piccola");
  return { bytes, contentType: res.headers.get("content-type") || sniffBytes(bytes), model: "pollinations", ...size };
}

/**
 * Genera l'immagine provando l'intera catena di fallback.
 * Ritorna { bytes, contentType, model, width, height, usedReference }.
 * Lancia un errore solo se OGNI via è fallita.
 */
export async function generateImage(env, prompt, seed, refs = []) {
  const errors = [];
  refs = (refs || []).filter(Boolean);

  // klein con riferimenti (continuità visiva), poi senza. Coi riferimenti si
  // prova solo la risoluzione primaria: un errore lì dipende dall'input, non
  // dall'output, e le sottorichieste sono contate (tetto 50).
  for (const withRef of refs.length ? [true, false] : [false]) {
    const sizes = withRef ? [CONFIG.IMAGE_SIZES[0]] : CONFIG.IMAGE_SIZES;
    for (const size of sizes) {
      try {
        const t0 = Date.now();
        const img = await tryKlein(env, prompt, seed, size, withRef ? refs : []);
        console.log(
          `[generate] klein${withRef ? "+ref" : ""} ok ${size.width}x${size.height} ` +
          `in ${Date.now() - t0}ms (${img.bytes.length} byte)`
        );
        return { ...img, usedReference: withRef };
      } catch (err) {
        errors.push(`klein${withRef ? "+ref" : ""} ${size.width}x${size.height}: ${err.message}`);
        console.warn(`[generate] klein${withRef ? "+ref" : ""} ${size.width}x${size.height} fallito: ${err.message}`);
      }
    }
  }

  try {
    const img = await trySchnell(env, prompt, seed);
    console.log(`[generate] schnell ok (${img.bytes.length} byte)`);
    return { ...img, usedReference: false };
  } catch (err) {
    errors.push(`schnell: ${err.message}`);
    console.warn(`[generate] schnell fallito: ${err.message}`);
  }

  try {
    const img = await tryPollinations(prompt, seed, CONFIG.IMAGE_SIZES[0]);
    console.log(`[generate] pollinations ok (${img.bytes.length} byte)`);
    return { ...img, usedReference: false };
  } catch (err) {
    errors.push(`pollinations: ${err.message}`);
    console.warn(`[generate] pollinations fallito: ${err.message}`);
  }

  throw new Error(`tutti i generatori sono falliti: ${errors.join(" | ")}`);
}

/* ===================== IL CANCELLO ===================== */

/**
 * Decide come correggere la dose per il tentativo successivo, guardando in che
 * modo il candidato ha sbagliato.
 *
 * Non è una manopola "intensità" data al modello: cambia QUANTA storia si
 * descrive. Troppo poco cambiamento → si aggiunge materiale della tappa dopo;
 * troppo → si tiene solo la prima frase della tappa. Quando invece il problema
 * è la FORMA del cambiamento (sparso quando doveva essere concentrato) la dose
 * resta, e a cambiare è solo il seme: descrivere di più non aiuterebbe.
 */
function nextDose(m, profile, dose) {
  const troppoPoco = m.estensione < profile.estensione[0] || m.intensita < profile.intensita[0];
  const troppo = m.estensione > profile.estensione[1] || m.intensita > profile.intensita[1];
  if (troppoPoco && !troppo) return Math.min(2, dose + 1);
  if (troppo && !troppoPoco) return Math.max(-1, dose - 1);
  return dose;
}

/**
 * Genera finché il cambiamento non rientra nel profilo del concept.
 *
 * `promptForDose(dose)` costruisce il prompt alla dose richiesta.
 * `prevFingerprint` è l'impronta di ieri; se manca (primo giorno dell'arco,
 * oppure misura non disponibile) il cancello si disattiva da solo e si
 * pubblica il primo risultato: meglio uno sfondo non collaudato che nessuno.
 *
 * Ritorna l'immagine con in più { impronta, misure, verdetto, tentativi, dose }.
 */
export async function generateWithGate(env, opts) {
  const {
    promptForDose, seed, refs = [], profile, prevFingerprint, label = "",
    maxAttempts = null, doseIniziale = 0, anchorFingerprint = null, occupazionePrec = null,
  } = opts;
  const tentativiMax = maxAttempts ?? CONFIG.MAX_ATTEMPTS;

  // Senza metro non c'è cancello: si genera una volta e si pubblica.
  if (!prevFingerprint || !profile) {
    const img = await generateImage(env, promptForDose(0), seed, refs);
    const impronta = await fingerprintFromBytes(env, img.bytes);
    return { ...img, impronta, misure: null, verdetto: null, tentativi: 1, dose: 0 };
  }

  // La dose di partenza arriva dal giorno prima: se ieri era rimasto in debito
  // si comincia gia' spingendo, senza sprecare un tentativo per scoprirlo.
  let dose = doseIniziale;
  let migliore = null;
  let fatti = 0;
  const scadenza = Date.now() + CONFIG.GATE_DEADLINE_MS;

  for (let tentativo = 1; tentativo <= tentativiMax; tentativo++) {
    // Salvaguardia sui tempi: il cron ha una finestra, e uno sfondo imperfetto
    // pubblicato vale infinitamente più di un tentativo perfetto interrotto a
    // metà. Se il tempo è finito ci si ferma e si tiene il migliore finora.
    if (tentativo > 1 && Date.now() > scadenza) {
      console.warn(`[gate] ${label}: tempo esaurito dopo ${tentativo - 1} tentativi`);
      break;
    }
    const prompt = promptForDose(dose);
    // Il seme cambia a ogni tentativo: klein non è deterministico nemmeno a
    // seme fisso, ma variarlo evita di riottenere esattamente lo stesso scarto.
    const img = await generateImage(env, prompt, seed + tentativo - 1, refs);
    fatti = tentativo;

    const impronta = await fingerprintFromBytes(env, img.bytes);
    if (!impronta) {
      console.warn(`[gate] ${label}: impronta non calcolabile, pubblico senza collaudo`);
      return { ...img, impronta: null, misure: null, verdetto: null, tentativi: tentativo, dose };
    }

    const misure = compare(prevFingerprint, impronta);

    // Sesta misura: quanto la scena si e' allontanata dal keyframe, e se
    // rispetto a ieri e' andata avanti o INDIETRO. Le altre cinque non
    // distinguono una pianta che cresce da una che rimpicciolisce.
    const occ = occupancy(anchorFingerprint, impronta);
    if (occ !== null) {
      misure.occupazione = occ;
      misure.avanzamento = occupazionePrec === null ? 0 : occ - occupazionePrec;
    }

    const v = verdict(misure, profile);
    const candidato = { ...img, impronta, misure, verdetto: v, tentativi: tentativo, dose };

    console.log(
      `[gate] ${label} tentativo ${tentativo}/${tentativiMax} (dose ${dose}): ` +
      `${formatMeasures(misure)} → ${v.ok ? "ACCETTATO" : "rifiutato: " + v.motivi.join("; ")}`
    );

    if (v.ok) return candidato;
    if (!migliore || v.distanza < migliore.verdetto.distanza) migliore = candidato;
    dose = nextDose(misure, profile, dose);
  }

  console.warn(
    `[gate] ${label}: tentativi esauriti, pubblico il più vicino al bersaglio ` +
    `(distanza ${migliore.verdetto.distanza.toFixed(2)}, ${formatMeasures(migliore.misure)})`
  );
  // `tentativi` conta quanti se ne sono fatti in TUTTO, non a quale apparteneva
  // il candidato scelto: altrimenti un ripiego trovato al primo colpo e poi
  // rifiutato due volte verrebbe riportato come "1 tentativo, tutto liscio".
  return { ...migliore, tentativi: fatti, ripiego: true };
}
