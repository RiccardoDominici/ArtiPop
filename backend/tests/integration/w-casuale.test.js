// feat-lo-sfondo-di-oggi-puo-venire-da-tutto-l-archivio: /w/<flusso>?date=casuale
// pesca uno sfondo da tutto l'archivio del canale invece del solo giorno
// odierno — pensato per la Shortcut e le automazioni a orario. Nessuna
// generazione AI: gli stub AI/IMAGES di makeEnv lanciano se invocati.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { PLACEHOLDER_PNG_BYTES } from "../../src/placeholder.js";

async function seminaArchivio(env, canale, date) {
  for (const data of date) {
    const byte = new Uint8Array([137, 80, 78, 71, ...Array.from(data).map((c) => c.charCodeAt(0))]);
    await env.KV.put(`archive:${canale}:${data}`, byte, {
      metadata: { contentType: "image/png", date: data, model: "test" },
    });
  }
}

describe("/w/<flusso>?date=casuale: canale con archivio", () => {
  it("200, corpo immagine, x-artipop-date è una delle date d'archivio, cache-control no-store", async () => {
    const env = makeEnv();
    const date = ["2026-01-15", "2026-01-16", "2026-01-17"];
    await seminaArchivio(env, "natura", date);

    const res = await callWorker(env, "/w/natura?date=casuale");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(date).toContain(res.headers.get("x-artipop-date"));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("due chiamate consecutive → stesso x-artipop-date (determinismo)", async () => {
    const env = makeEnv();
    const date = ["2026-01-15", "2026-01-16", "2026-01-17"];
    await seminaArchivio(env, "natura", date);

    const res1 = await callWorker(env, "/w/natura?date=casuale");
    const res2 = await callWorker(env, "/w/natura?date=casuale");

    expect(res1.headers.get("x-artipop-date")).toBe(res2.headers.get("x-artipop-date"));
  });
});

describe("/w/<flusso>?date=casuale: canale senza archivio (ROADMAP M4)", () => {
  it("200 con i byte del placeholder, content-type immagine, mai JSON", async () => {
    const env = makeEnv(); // KV vuoto: nessun archivio seminato

    const res = await callWorker(env, "/w/quiete?date=casuale");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(PLACEHOLDER_PNG_BYTES);
  });
});

describe("/w/<flusso>?date=<data esatta>: nessuna regressione sul ramo archivio esistente", () => {
  it("resta invariato: public, max-age=604800, immutable", async () => {
    const env = makeEnv();
    const data = "2026-01-02";
    await seminaArchivio(env, "natura", [data]);

    const res = await callWorker(env, `/w/natura?date=${data}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800, immutable");
    expect(res.headers.get("x-artipop-date")).toBe(data);
  });
});
