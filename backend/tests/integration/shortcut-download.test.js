// ROADMAP: `/s/<flusso>.shortcut` non deve MAI rispondere JSON grezzo a Safari
// (che apre questa rotta dal bottone "⬇️ Scarica la Shortcut" e dai link del
// README) — stesso principio già chiuso da M4 su `/w/`, qui applicato alla
// rotta gemella di download.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";

describe("/s/<flusso>.shortcut: chiave assente in KV", () => {
  it("risponde 404 HTML (mai JSON), con link ad /aiuto e ai flussi attivi", async () => {
    const env = makeEnv(); // KV vuoto: nessuna scrittura seminata
    const res = await callWorker(env, "/s/random.shortcut");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");

    const body = await res.text();
    expect(() => JSON.parse(body)).toThrow();
    expect(body).toContain("/aiuto");
    for (const c of ACTIVE_CHANNELS) {
      expect(body).toContain(`/s/${c.id}.shortcut`);
    }
  });

  it("porta gli header di sicurezza come / e /aiuto", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/s/random.shortcut");

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBeTruthy();
    expect(res.headers.get("x-frame-options")).toBeTruthy();
  });
});

describe("/s/<flusso>.shortcut: KV.get che lancia", () => {
  it("risponde comunque 404 HTML, nessuna eccezione propagata", async () => {
    const env = makeEnv({
      KV: {
        async get() {
          throw new Error("KV non disponibile (simulato)");
        },
      },
    });

    const res = await callWorker(env, "/s/natura.shortcut");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const body = await res.text();
    expect(() => JSON.parse(body)).toThrow();
  });
});

describe("/s/<flusso>.shortcut: chiave presente in KV (ramo felice)", () => {
  it("risponde 200 con gli stessi byte seminati, invariato", async () => {
    const env = makeEnv();
    const byteSeminati = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await env.KV.put("shortcut:natura", byteSeminati);

    const res = await callWorker(env, "/s/natura.shortcut");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toBe(
      'inline; filename="ArtiPop-natura.shortcut"'
    );
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(byteSeminati);
  });
});
