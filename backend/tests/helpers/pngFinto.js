// PNG finte per i test del cancello (src/generate.js) e delle misure
// (src/metrics.js): una scala di grigi 8 bit non interlacciata, uniforme,
// costruita con `node:zlib` (builtin, nessuna dipendenza nuova). Il CRC dei
// chunk resta a zero — `decodePngToGray` (metrics.js) non lo verifica, lo
// scarta soltanto scavalcando la lunghezza del chunk.
//
// Serve perché `fakeEnv.js` oggi offre solo uno stub IMAGES che LANCIA (per
// garantire zero generazioni reali nei test di router/orchestrazione): qui
// serve invece un binding che risponda con byte davvero decodificabili, per
// esercitare fino in fondo `fingerprintFromBytes`.

import { deflateSync } from "node:zlib";

function u32be(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function chunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4); // lunghezza + tipo+dati + CRC (a zero)
  out.set(u32be(data.length), 0);
  out.set(body, 4);
  return out;
}

/**
 * PNG grigia (colorType 0, 8 bit, non interlacciata) `width`x`height`,
 * riempita interamente con `valore` (0-255): ogni riga usa il filtro 0
 * (nessuno), così la decodifica non deve annullare alcuna predizione.
 */
export function pngGrigioUniforme(width, height, valore = 128) {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compressione
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // non interlacciata

  const stride = width;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    raw.fill(valore, y * (stride + 1) + 1, (y + 1) * (stride + 1));
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

/**
 * Stub del binding IMAGES che ignora l'input e restituisce sempre la stessa
 * PNG grigia già alla dimensione della miniatura (48x96): basta a
 * `fingerprintFromBytes`, che si fida della forma della catena
 * `.input().transform().output()` ma non guarda i byte in ingresso.
 */
export function stubImagesConPng(png) {
  return {
    input() {
      return {
        transform() {
          return {
            async output() {
              return { response: () => new Response(png) };
            },
          };
        },
      };
    },
  };
}
