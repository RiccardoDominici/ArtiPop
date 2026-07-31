// ROADMAP M4: /w/<flusso> non deve MAI rispondere JSON a una Shortcut, anche
// quando l'archivio è vuoto o la data richiesta non esiste — deve sempre
// tornare byte immagine validi (il placeholder statico di src/placeholder.js).
// Complementare a orchestrazione.test.js, che copre già la byte-stabilità
// dell'archivio quando l'immagine ESISTE: qui si copre il caso in cui NON esiste.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { PLACEHOLDER_PNG_BYTES } from "../../src/placeholder.js";

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47]; // \x89PNG

describe("/w/<flusso>: canale attivo con archivio vuoto (KV vuoto)", () => {
  it("risponde 200 con i byte del placeholder, content-type image/png", async () => {
    const env = makeEnv(); // KV vuoto: nessuna scrittura seminata
    const res = await callWorker(env, "/w/natura");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte.length).toBeGreaterThan(500);
    expect(Array.from(byte.slice(0, 4))).toEqual(FIRMA_PNG);
    // Sono esattamente i byte del modulo placeholder, non un'immagine improvvisata.
    expect(byte).toEqual(PLACEHOLDER_PNG_BYTES);
  });
});

describe("/w/<flusso>?date=: data inesistente", () => {
  it("risponde 404 ma con content-type image/png e gli stessi byte placeholder (mai JSON)", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/w/natura?date=1999-01-01");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("image/png");

    const byte = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(byte.slice(0, 4))).toEqual(FIRMA_PNG);
    expect(byte).toEqual(PLACEHOLDER_PNG_BYTES);
  });
});

describe("/w/<flusso>: canale con immagine seminata", () => {
  it("la risposta resta invariata: gli stessi byte seminati, non il placeholder", async () => {
    const env = makeEnv();
    const byteSeminati = new Uint8Array([137, 80, 78, 71, 9, 8, 7, 6, 5]);
    // Chiave `img:<canale>:latest` (vedi src/storage.js): quella che /w/<flusso>
    // legge SENZA ?date=.
    await env.KV.put("img:natura:latest", byteSeminati, {
      metadata: { contentType: "image/png", date: "2026-01-15", model: "test" },
    });

    const res = await callWorker(env, "/w/natura");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(byteSeminati);
    expect(byte).not.toEqual(PLACEHOLDER_PNG_BYTES);
  });
});
