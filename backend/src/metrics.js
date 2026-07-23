// MISURA DEL CAMBIAMENTO fra l'immagine di ieri e quella di oggi.
//
// È il cuore del "cancello": prima di pubblicare un'immagine il sistema la
// confronta con quella del giorno prima e verifica che il cambiamento rientri
// nel profilo previsto per quel tipo di sfondo. Un timelapse di città deve
// cambiare POCO ma DAPPERTUTTO; una figura che attraversa un paesaggio deve
// cambiare TANTO ma in un PEZZETTINO solo. Sono due cose che un singolo numero
// non sa distinguere: per questo le misure sono cinque.
//
// Tutto si calcola su una miniatura in scala di grigi 48x96 (4.608 celle):
// abbastanza per vedere la STRUTTURA del cambiamento, abbastanza piccola perché
// il rumore di compressione JPEG sparisca da solo e perché la decodifica costi
// pochi millisecondi di CPU (il piano free del Worker ne concede pochissimi).

import { CONFIG } from "./config.js";
import { getImage } from "./storage.js";

export const THUMB_W = 48;
export const THUMB_H = 96;
const THUMB_N = THUMB_W * THUMB_H;

/* ============================ MINIATURA ============================ */

/**
 * Riduce un'immagine a una griglia THUMB_W x THUMB_H di luminanze 0-255.
 *
 * Due strade, in ordine:
 *   1. binding Images di Cloudflare — lavora sui BYTE IN MEMORIA. È l'unica che
 *      funziona su un'immagine CANDIDATA, non ancora pubblicata: senza questa
 *      il cancello non potrebbe esistere (il resizer esterno pretende un URL
 *      pubblico, quindi bisognerebbe pubblicare prima di sapere se accettare).
 *   2. resizer esterno per URL — solo per immagini già in archivio (fallback).
 *
 * Ritorna Uint8Array(THUMB_N) oppure null se non è stato possibile misurare.
 * `null` non è un errore fatale: il chiamante pubblica senza cancello.
 */
export async function fingerprintFromStream(env, stream) {
  if (!env.IMAGES) {
    console.warn("[metrics] binding IMAGES assente: impossibile misurare");
    return null;
  }
  try {
    const res = await env.IMAGES.input(stream)
      .transform({ width: THUMB_W, height: THUMB_H, fit: "cover" })
      .output({ format: "image/png" });
    const png = new Uint8Array(await res.response().arrayBuffer());
    return await decodePngToGray(png);
  } catch (err) {
    console.warn(`[metrics] miniatura via binding Images fallita: ${err.message}`);
    return null;
  }
}

/** Impronta a partire dai byte in memoria (il caso del candidato appena generato). */
export async function fingerprintFromBytes(env, bytes) {
  return fingerprintFromStream(env, new Response(bytes).body);
}

/**
 * Impronta di un giorno già archiviato, letta DIRETTAMENTE da KV.
 * Volutamente non si passa dall'URL pubblico: un Worker non può chiamare il
 * proprio hostname (la richiesta non gli torna indietro), e comunque il giro di
 * rete sarebbe inutile visto che i byte sono già a portata di mano.
 */
export async function fingerprintFromArchive(env, channelId, date) {
  const img = await getImage(env, channelId, date);
  if (!img) {
    console.warn(`[metrics] nessuna immagine in archivio per ${channelId} ${date}`);
    return null;
  }
  return fingerprintFromStream(env, img.stream);
}

/**
 * Diagnostica passo-passo della catena di misura, usata dalla sonda /test-metrics.
 * Riporta dove esattamente si rompe, invece di un generico "non ha funzionato".
 */
export async function diagnose(env, channelId, date) {
  const steps = {};
  try {
    steps.bindingPresente = Boolean(env.IMAGES);
    const img = await getImage(env, channelId, date);
    if (!img) return { ...steps, errore: `nessuna immagine in archivio per ${channelId} ${date}` };
    const bytes = new Uint8Array(await new Response(img.stream).arrayBuffer());
    steps.byteSorgente = bytes.length;

    if (!env.IMAGES) return { ...steps, errore: "binding IMAGES assente" };

    let out;
    try {
      out = await env.IMAGES.input(new Response(bytes).body)
        .transform({ width: THUMB_W, height: THUMB_H, fit: "cover" })
        .output({ format: "image/png" });
    } catch (err) {
      return { ...steps, errore: `trasformazione fallita: ${err.name}: ${err.message}` };
    }

    const png = new Uint8Array(await out.response().arrayBuffer());
    steps.bytePng = png.length;
    steps.firmaPng = Array.from(png.subarray(0, 8)).join(",");

    // Rilettura dell'header senza decodificare, per capire il formato ricevuto.
    if (png.length > 26) {
      steps.header = {
        larghezza: u32(png, 16),
        altezza: u32(png, 20),
        profondita: png[24],
        tipoColore: png[25],
        interlacciata: png[28],
      };
    }
    const gray = await decodePngToGray(png);
    steps.decodifica = gray ? `ok (${gray.length} celle)` : "fallita";
    return steps;
  } catch (err) {
    return { ...steps, errore: `${err.name}: ${err.message}` };
  }
}

/* ====================== DECODIFICA PNG MINIMA ======================
   Il Worker non ha decoder d'immagine. Per una PNG di 48x96 però la
   decodifica è banale: si legge l'header, si concatenano i blocchi IDAT, si
   scompatta con DecompressionStream (nativo, quindi gratis in CPU) e si
   annullano i filtri per riga. Nessuna dipendenza esterna. */

/** Legge un intero a 32 bit big-endian. */
function u32(b, o) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/**
 * PNG 8 bit (grigio, grigio+alfa, RGB o RGBA, non interlacciata) → luminanze.
 * Ritorna Uint8Array(THUMB_N) o null se il formato non è quello atteso.
 */
async function decodePngToGray(png) {
  if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50) {
    console.warn("[metrics] non è una PNG");
    return null;
  }

  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];

  while (off + 8 <= png.length) {
    const len = u32(png, off);
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]);
    const dataStart = off + 8;

    if (type === "IHDR") {
      width = u32(png, dataStart);
      height = u32(png, dataStart + 4);
      bitDepth = png[dataStart + 8];
      colorType = png[dataStart + 9];
      interlace = png[dataStart + 12];
    } else if (type === "IDAT") {
      idat.push(png.subarray(dataStart, dataStart + len));
    } else if (type === "IEND") {
      break;
    }
    off = dataStart + len + 4; // salta anche il CRC
  }

  // Canali per pixel secondo il tipo di colore PNG.
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels || bitDepth !== 8 || interlace !== 0 || !width || !height) {
    console.warn(
      `[metrics] PNG non gestita: ${width}x${height} bit=${bitDepth} tipo=${colorType} interlace=${interlace}`
    );
    return null;
  }

  // Scompattazione zlib con l'API nativa del runtime.
  let raw;
  try {
    const total = idat.reduce((n, c) => n + c.length, 0);
    const joined = new Uint8Array(total);
    let p = 0;
    for (const c of idat) { joined.set(c, p); p += c.length; }
    const ds = new DecompressionStream("deflate");
    const out = new Response(joined).body.pipeThrough(ds);
    raw = new Uint8Array(await new Response(out).arrayBuffer());
  } catch (err) {
    console.warn(`[metrics] scompattazione PNG fallita: ${err.message}`);
    return null;
  }

  // Annullamento dei filtri PNG, riga per riga (filtro 0-4 in testa a ogni riga).
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) {
    console.warn("[metrics] dati PNG troppo corti");
    return null;
  }
  const img = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[src + x];
      const a = x >= channels ? img[dst + x - channels] : 0; // pixel a sinistra
      const b = y > 0 ? img[up + x] : 0;                     // pixel sopra
      const c = x >= channels && y > 0 ? img[up + x - channels] : 0; // in diagonale
      let val;
      switch (ft) {
        case 0: val = rawByte; break;
        case 1: val = rawByte + a; break;
        case 2: val = rawByte + b; break;
        case 3: val = rawByte + ((a + b) >> 1); break;
        case 4: {
          // filtro "Paeth": si sceglie il predittore più vicino alla stima a+b-c
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          console.warn(`[metrics] filtro PNG sconosciuto: ${ft}`);
          return null;
      }
      img[dst + x] = val & 0xff;
    }
  }

  // Conversione a luminanza, campionando sulla griglia attesa (il ridimensionatore
  // dovrebbe già darci 48x96, ma non ci fidiamo e ricampioniamo comunque).
  const gray = new Uint8Array(THUMB_N);
  for (let ty = 0; ty < THUMB_H; ty++) {
    const sy = Math.min(height - 1, Math.floor((ty * height) / THUMB_H));
    for (let tx = 0; tx < THUMB_W; tx++) {
      const sx = Math.min(width - 1, Math.floor((tx * width) / THUMB_W));
      const o = sy * stride + sx * channels;
      gray[ty * THUMB_W + tx] =
        channels >= 3
          ? (img[o] * 299 + img[o + 1] * 587 + img[o + 2] * 114) / 1000
          : img[o];
    }
  }
  return gray;
}

/* ============================== MISURE ============================== */

/** Media di un'impronta. */
function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

/**
 * "Nitidezza": quanta energia c'è nei dettagli fini (differenza media fra celle
 * vicine). Se crolla da un giorno all'altro, l'immagine è diventata poltiglia —
 * è il degrado da editing ripetuto, quello che aveva sciolto il davanzale di
 * Bloom in una macchia grigia nel giro di cinque giorni.
 */
export function sharpness(a) {
  let s = 0, n = 0;
  for (let y = 0; y < THUMB_H; y++) {
    for (let x = 0; x < THUMB_W; x++) {
      const i = y * THUMB_W + x;
      if (x + 1 < THUMB_W) { s += Math.abs(a[i + 1] - a[i]); n++; }
      if (y + 1 < THUMB_H) { s += Math.abs(a[i + THUMB_W] - a[i]); n++; }
    }
  }
  return n ? s / n : 0;
}

/**
 * Confronta due impronte e ritorna le cinque misure del cambiamento.
 *
 *  estensione   % di celle cambiate in modo percepibile      → QUANTA immagine cambia
 *  intensita    forza media del cambiamento dove è avvenuto  → QUANTO cambia
 *  compattezza  quota del cambiamento nel 10% di celle più   → è UN EVENTO (alto)
 *               mosse, da 0 a 1                                 o RUMORE SPARSO (basso)
 *  deriva       spostamento della luminosità dell'intera     → è cambiata la LUCE
 *               scena, in %                                     di tutta la scena
 *  degrado      perdita di dettaglio fine rispetto a ieri, % → l'immagine si sta
 *                                                               sciogliendo
 *
 * Nota importante: estensione e intensità si calcolano su immagini a media
 * ZERO, cioè dopo aver tolto lo spostamento globale di luminosità. Così un
 * semplice cambio di luce non viene scambiato per "è successo qualcosa": la
 * luce finisce tutta in `deriva`, dove la controlliamo separatamente.
 */
export function compare(prev, next) {
  const mPrev = mean(prev), mNext = mean(next);

  const local = new Float32Array(THUMB_N);
  for (let i = 0; i < THUMB_N; i++) {
    local[i] = Math.abs((next[i] - mNext) - (prev[i] - mPrev));
  }

  const THRESHOLD = CONFIG.CHANGE_THRESHOLD;
  let changed = 0, sumChanged = 0, sumAll = 0;
  for (let i = 0; i < THUMB_N; i++) {
    sumAll += local[i];
    if (local[i] > THRESHOLD) { changed++; sumChanged += local[i]; }
  }

  // Compattezza: si ordinano le celle per quanto sono cambiate e si guarda
  // quanta parte del cambiamento totale sta nel 10% più mosso.
  const top = Math.max(1, Math.round(THUMB_N * 0.1));
  const sorted = Array.from(local).sort((x, y) => y - x);
  let sumTop = 0;
  for (let i = 0; i < top; i++) sumTop += sorted[i];

  return {
    estensione: (changed / THUMB_N) * 100,
    intensita: changed ? (sumChanged / changed / 255) * 100 : 0,
    compattezza: sumAll > 0 ? sumTop / sumAll : 0,
    deriva: (Math.abs(mNext - mPrev) / 255) * 100,
    degrado: (() => {
      const sp = sharpness(prev), sn = sharpness(next);
      return sp > 0 ? ((sp - sn) / sp) * 100 : 0;
    })(),
  };
}

/* ============================== VERDETTO ============================== */

/** Distanza di un valore da un intervallo [lo, hi], normalizzata sull'ampiezza. */
function outside(value, [lo, hi]) {
  const span = Math.max(hi - lo, 1e-6);
  if (value < lo) return (lo - value) / span;
  if (value > hi) return (value - hi) / span;
  return 0;
}

/**
 * Confronta le misure col profilo del concept e decide.
 * Ritorna { ok, distanza, motivi[] }:
 *   - `ok` true se tutto rientra;
 *   - `distanza` quanto si è fuori bersaglio (0 = dentro): serve per scegliere
 *     il candidato MIGLIORE quando i tentativi finiscono e nessuno è passato;
 *   - `motivi` spiegazioni leggibili, che finiscono nei log.
 */
export function verdict(m, profile) {
  const motivi = [];
  let distanza = 0;

  const dExt = outside(m.estensione, profile.estensione);
  if (dExt > 0) {
    distanza += dExt;
    motivi.push(
      m.estensione < profile.estensione[0]
        ? `cambia troppo poca immagine (${m.estensione.toFixed(1)}% < ${profile.estensione[0]}%)`
        : `cambia troppa immagine (${m.estensione.toFixed(1)}% > ${profile.estensione[1]}%)`
    );
  }

  const dInt = outside(m.intensita, profile.intensita);
  if (dInt > 0) {
    distanza += dInt;
    motivi.push(
      m.intensita < profile.intensita[0]
        ? `cambiamento troppo debole (${m.intensita.toFixed(1)} < ${profile.intensita[0]})`
        : `cambiamento troppo brusco (${m.intensita.toFixed(1)} > ${profile.intensita[1]})`
    );
  }

  const dCmp = outside(m.compattezza, profile.compattezza);
  if (dCmp > 0) {
    distanza += dCmp;
    motivi.push(
      m.compattezza < profile.compattezza[0]
        ? `cambiamento sparso invece che concentrato (${m.compattezza.toFixed(2)} < ${profile.compattezza[0]})`
        : `cambiamento troppo concentrato in un punto (${m.compattezza.toFixed(2)} > ${profile.compattezza[1]})`
    );
  }

  // Guardie assolute: valgono per ogni concept, salvo deroga esplicita della
  // famiglia (la metamorfosi astratta ha diritto a spostare il colore, perché
  // lì il colore È il soggetto).
  const maxDeriva = profile.maxDeriva ?? CONFIG.MAX_DERIVA;
  const maxDegrado = profile.maxDegrado ?? CONFIG.MAX_DEGRADO;

  if (m.deriva > maxDeriva) {
    distanza += (m.deriva - maxDeriva) / maxDeriva;
    motivi.push(`è cambiata la luce di tutta la scena (deriva ${m.deriva.toFixed(1)} > ${maxDeriva})`);
  }
  if (m.degrado > maxDegrado) {
    distanza += (m.degrado - maxDegrado) / maxDegrado;
    motivi.push(`l'immagine ha perso dettaglio (degrado ${m.degrado.toFixed(1)}% > ${maxDegrado}%)`);
  }

  // Guardia di DIREZIONE: in una storia che accumula (una pianta che cresce,
  // una scrivania che si riempie) la scena non può tornare indietro. Non vale
  // per le famiglie in cui il soggetto si sposta o si trasforma senza
  // accumulare, dove l'occupazione resta giustamente costante.
  if (profile.monotona && typeof m.avanzamento === "number" && m.avanzamento < -CONFIG.MAX_ARRETRAMENTO) {
    distanza += Math.abs(m.avanzamento) / CONFIG.MAX_ARRETRAMENTO;
    motivi.push(`la scena è tornata indietro (${m.avanzamento.toFixed(1)} punti di occupazione)`);
  }

  return { ok: distanza === 0, distanza, motivi };
}

/**
 * OCCUPAZIONE: quanta parte della scena si è discostata dal keyframe, cioè
 * dalla scena vuota di partenza. È la sesta misura, e serve a dare una
 * DIREZIONE al cambiamento.
 *
 * Le altre cinque misurano quanto e come si è mossa l'immagine, ma sono cieche
 * al verso: un giorno in cui la pianta cresce e un giorno in cui rimpicciolisce
 * si assomigliano moltissimo. Nel primo collaudo del sistema è successo davvero
 * — al quarto giorno la pianta era tornata più piccola del terzo e nessuna
 * misura poteva accorgersene. Confrontando invece ogni giorno con la scena
 * INIZIALE si ottiene un numero che, in una storia che accumula, deve solo
 * salire: se scende, qualcosa è stato cancellato e il giorno va rifatto.
 */
export function occupancy(anchor, img) {
  if (!anchor || !img) return null;
  const mA = mean(anchor), mI = mean(img);
  let changed = 0;
  for (let i = 0; i < THUMB_N; i++) {
    if (Math.abs((img[i] - mI) - (anchor[i] - mA)) > CONFIG.CHANGE_THRESHOLD) changed++;
  }
  return (changed / THUMB_N) * 100;
}

/**
 * Classifica COME è andato ieri, in una parola. È il segnale con cui il piano
 * si corregge il giorno dopo (vedi story.js):
 *
 *   "ok"     il cambiamento previsto è arrivato → si avanza di una tappa
 *   "poco"   la tappa non è stata saldata      → la si ripete, con più forza
 *   "troppo" il modello è corso avanti          → si salta una tappa, o i
 *                                                 giorni dopo sarebbero vuoti
 *   "forma"  la quantità va bene ma la forma no (sparso invece che concentrato):
 *            non è un problema di ritmo, quindi il piano avanza normalmente
 *
 * Questo segnale ha sostituito la lettura dell'immagine con un modello di
 * visione. Motivo, misurato: su fotogrammi d'archivio inequivocabili
 * llama-3.2-11b-vision ha letto "roccia grigia nuda" come tappa 6 di 7 e
 * "girasole in piena fioritura" come tappa 4, sbagliando anche le domande
 * binarie ("c'è un edificio?" su un'isola deserta → "sì"). Le misure, invece,
 * non hanno opinioni.
 */
export function classify(m, profile) {
  if (!m || !profile) return null;
  const sotto = m.estensione < profile.estensione[0] || m.intensita < profile.intensita[0];
  const sopra = m.estensione > profile.estensione[1] || m.intensita > profile.intensita[1];
  if (sotto && !sopra) return "poco";
  if (sopra && !sotto) return "troppo";
  if (outside(m.compattezza, profile.compattezza) > 0) return "forma";
  return "ok";
}

/** Riga di log compatta con tutte le misure. */
export function formatMeasures(m) {
  const base =
    `est ${m.estensione.toFixed(1)}% | int ${m.intensita.toFixed(1)} | ` +
    `cmp ${m.compattezza.toFixed(2)} | deriva ${m.deriva.toFixed(1)} | degr ${m.degrado.toFixed(1)}%`;
  return typeof m.occupazione === "number"
    ? `${base} | occ ${m.occupazione.toFixed(1)}% (${m.avanzamento >= 0 ? "+" : ""}${(m.avanzamento ?? 0).toFixed(1)})`
    : base;
}

/* ===================== SERIALIZZAZIONE PER KV =====================
   L'impronta di ogni giorno pubblicato viene conservata nello stato: domani
   il confronto è gratuito (nessuna trasformazione, nessuna richiesta di rete)
   e in più resta lo storico dei numeri, utile per tarare i profili. */

export function encodeFingerprint(gray) {
  let bin = "";
  const CHUNK = 4096; // a blocchi: String.fromCharCode con 4.608 argomenti esplode
  for (let i = 0; i < gray.length; i += CHUNK) {
    bin += String.fromCharCode(...gray.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function decodeFingerprint(b64) {
  if (typeof b64 !== "string" || !b64) return null;
  try {
    const bin = atob(b64);
    if (bin.length !== THUMB_N) return null;
    const out = new Uint8Array(THUMB_N);
    for (let i = 0; i < THUMB_N; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
