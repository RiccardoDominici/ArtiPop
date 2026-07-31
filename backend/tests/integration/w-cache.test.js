// s-home-non-riscarica-i-wallpaper-a-ogni-sfogliata: /w/<flusso> onora ?v=
// (la data del meta mandata dal sito) per rendere cacheabile un'ora la
// richiesta della home, senza toccare la Shortcut, che chiama lo stesso
// indirizzo senza query e deve restare no-store (mai una cache tra lei e il
// worker: lo sfondo del giorno deve sempre essere fresco).
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { PLACEHOLDER_PNG_BYTES } from "../../src/placeholder.js";

async function seminaImmagineDiOggi(env, canale, dataOggi) {
  const byteAttesi = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);
  // Chiave `img:<canale>:latest` (vedi src/storage.js): quella che /w/<flusso>
  // legge SENZA ?date=, la stessa da cui il sito prende l'immagine di oggi.
  await env.KV.put(`img:${canale}:latest`, byteAttesi, {
    metadata: { contentType: "image/png", date: dataOggi, model: "test" },
  });
  return byteAttesi;
}

describe("/w/<flusso>?v=<oggi>: richiesta del sito, cacheabile un'ora", () => {
  it("risponde public, max-age=3600 con gli stessi byte dell'immagine di oggi", async () => {
    const env = makeEnv();
    const oggi = "2026-01-15";
    const byteAttesi = await seminaImmagineDiOggi(env, "natura", oggi);

    const res = await callWorker(env, `/w/natura?v=${oggi}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(byteAttesi);
  });
});

describe("/w/<flusso>: richiesta della Shortcut (nessuna query)", () => {
  it("resta no-store, must-revalidate: la freschezza dello sfondo non è toccata", async () => {
    const env = makeEnv();
    const oggi = "2026-01-15";
    await seminaImmagineDiOggi(env, "natura", oggi);

    const res = await callWorker(env, "/w/natura");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store, must-revalidate");
  });
});

describe("/w/<flusso>?v=pippo: v malformato", () => {
  it("è trattato come assente → no-store, must-revalidate (fallback sicuro)", async () => {
    const env = makeEnv();
    const oggi = "2026-01-15";
    await seminaImmagineDiOggi(env, "natura", oggi);

    const res = await callWorker(env, "/w/natura?v=pippo");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store, must-revalidate");
  });
});

describe("/w/<flusso>?date=: archivio, resta byte-stabile e immutable", () => {
  it("non regredisce: public, max-age=604800, immutable anche con la modifica a ?v=", async () => {
    const env = makeEnv();
    const data = "2026-01-15";
    const byteAttesi = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);
    await env.KV.put(`archive:natura:${data}`, byteAttesi, {
      metadata: { contentType: "image/png", date: data, model: "test" },
    });

    const res = await callWorker(env, `/w/natura?date=${data}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800, immutable");
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(byteAttesi);
  });
});

describe("/w/<flusso>?v=<oggi> su KV vuoto (ROADMAP M4)", () => {
  it("placeholder con no-store e content-type immagine, mai JSON", async () => {
    const env = makeEnv(); // KV vuoto: nessuna scrittura seminata
    const oggi = "2026-01-15";

    const res = await callWorker(env, `/w/quiete?v=${oggi}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toBe("image/png");
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(PLACEHOLDER_PNG_BYTES);
  });
});
