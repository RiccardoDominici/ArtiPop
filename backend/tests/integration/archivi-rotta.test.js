// feat-gli-archivi-storici-si-riaprono-dal-sito: /archivi elenca i canali
// storici (chiavi archive:<canale>:<data> in KV) esclusi quelli attivi.
// Stesso schema di aiuto-stato-canali.test.js: KV preseminato, rotta
// pubblica (nessuna auth), una lettura KV fallita non deve MAI diventare 500.
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

describe("GET /archivi", () => {
  it("200 text/html, elenca island (storico) ma NON il canale attivo", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put(`archive:${ACTIVE_CHANNELS[0].id}:2025-01-01`, "1");

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const html = await res.text();
    expect(html).toContain("island");
    expect(html).toContain("/w/island?date=2025-01-02");
    expect(html).not.toContain(`/w/${ACTIVE_CHANNELS[0].id}?date=2025-01-01`);
  });

  it("senza chiave admin: comunque 200 (rotta pubblica, nessuna auth)", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    await env.KV.put("archive:island:2025-01-01", "1");

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
  });

  it("nessun archivio storico: 200 con messaggio umano, mai una pagina rotta", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Nessun archivio storico da mostrare.");
  });

  it("KV.list che lancia: comunque 200 con un messaggio umano, mai 500, mai dettagli tecnici", async () => {
    // listChannelsWithArchive (storage.js) intercetta già i guasti di KV.list
    // e degrada a "nessun archivio" (vedi il suo stesso try/catch): il punto
    // qui non è distinguere il messaggio, ma che /archivi resti 200 e leggibile
    // qualunque cosa succeda alla scansione — mai un 500, mai `err.message`.
    const kv = makeKV();
    const env = makeEnv({
      KV: { ...kv, async list() { throw new Error("KV.list non disponibile (simulato)"); } },
    });

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("KV.list non disponibile");
    expect(html).not.toContain("Error");
  });
});
