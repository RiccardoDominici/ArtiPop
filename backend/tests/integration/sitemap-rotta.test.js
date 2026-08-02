// feat-i-motori-di-ricerca-trovano-anche-gli-archivi: GET /sitemap.xml deve
// rispondere senza chiave admin, elencare i canali storici trovati in KV e
// non rompersi mai — stesso schema di archivi-rotta.test.js. Vedi
// sitemap-xml.test.js per la copertura pura di renderSitemap().
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

describe("GET /sitemap.xml", () => {
  it("200, content-type application/xml, corpo che inizia con <?xml", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");

    const res = await callWorker(env, "/sitemap.xml");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const corpo = await res.text();
    expect(corpo.startsWith("<?xml")).toBe(true);
    expect(corpo).toContain("<loc>https://artipop.test/archivi/island</loc>");
    expect(corpo).toContain("<lastmod>2025-01-01</lastmod>");
  });

  it("non elenca i canali attivi, solo quelli storici", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put(`archive:${ACTIVE_CHANNELS[0].id}:2025-01-01`, "1");

    const res = await callWorker(env, "/sitemap.xml");
    const corpo = await res.text();

    expect(corpo).not.toContain(`<loc>https://artipop.test/archivi/${ACTIVE_CHANNELS[0].id}</loc>`);
  });

  it("KV.list che lancia sulla scansione: sempre 200 XML valido, mai 500, mai JSON", async () => {
    const kv = makeKV();
    const env = makeEnv({
      KV: { ...kv, async list() { throw new Error("KV.list non disponibile (simulato)"); } },
    });

    const res = await callWorker(env, "/sitemap.xml");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const corpo = await res.text();
    expect(corpo.startsWith("<?xml")).toBe(true);
    expect(() => JSON.parse(corpo)).toThrow();
    expect(corpo).toContain("<loc>https://artipop.test/</loc>");
    expect(corpo).toContain("<loc>https://artipop.test/aiuto</loc>");
    expect(corpo).toContain("<loc>https://artipop.test/archivi</loc>");
  });

  it("gli header di sicurezza sono presenti come sulle altre rotte pubbliche", async () => {
    const env = makeEnv();

    const res = await callWorker(env, "/sitemap.xml");

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});
