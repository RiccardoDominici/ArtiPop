// feat-segui-tutti-i-canali-con-un-solo-import: GET /canali.opml è l'elenco
// pubblico dei feed per canale, da importare in blocco nel lettore di feed.
// Stesso stile di robustezza di feed-rotta.test.js: zero KV, guasti simulati,
// zero generazioni AI (contratto makeEnv/stubAI/stubImages).
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

describe("GET /canali.opml", () => {
  it("200, content-type text/x-opml, cache-control e header di sicurezza, corpo XML valido", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/canali.opml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/x-opml");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain('<opml version="2.0">');
  });

  it("un <outline> per ogni canale attivo, con xmlUrl assoluto verso /feed/<id>.xml", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/canali.opml");
    const xml = await res.text();
    for (const c of ACTIVE_CHANNELS) {
      expect(xml).toContain(`xmlUrl="https://artipop.test/feed/${c.id}.xml"`);
    }
    expect(xml.match(/<outline /g)).toHaveLength(ACTIVE_CHANNELS.length);
  });

  it("gli xmlUrl emessi sono indirizzi che la rotta feed serve davvero", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/canali.opml");
    const xml = await res.text();
    const xmlUrls = [...xml.matchAll(/xmlUrl="([^"]+)"/g)].map((m) => m[1]);
    expect(xmlUrls.length).toBe(ACTIVE_CHANNELS.length);
    for (const xmlUrl of xmlUrls) {
      const path = new URL(xmlUrl).pathname;
      const feedRes = await callWorker(env, path);
      expect(feedRes.status).toBe(200);
      expect(feedRes.headers.get("content-type")).toContain("application/rss+xml");
    }
  });

  it("senza chiave admin: comunque 200 (rotta pubblica, nessuna auth)", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    const res = await callWorker(env, "/canali.opml");
    expect(res.status).toBe(200);
  });

  it("KV completamente rotto: comunque 200, OPML valido, mai JSON né 500", async () => {
    const kv = makeKV();
    const env = makeEnv({
      KV: {
        ...kv,
        async list() { throw new Error("KV.list non disponibile (simulato)"); },
        async get() { throw new Error("KV.get non disponibile (simulato)"); },
        async getWithMetadata() { throw new Error("KV.getWithMetadata non disponibile (simulato)"); },
      },
    });

    const res = await callWorker(env, "/canali.opml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/x-opml");
    expect(res.headers.get("content-type")).not.toContain("application/json");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain('<opml version="2.0">');
  });

  it("zero generazioni AI: gli stub lanciano se invocati, il test resta verde", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/canali.opml");
    expect(res.status).toBe(200);
  });
});

describe("regressione rotte vicine con /canali.opml presente", () => {
  it("/feed.xml e /feed/<id>.xml restano 200 application/rss+xml, /canali resta 404", async () => {
    const env = makeEnv();
    const id = ACTIVE_CHANNELS[0].id;
    const [feedAggregato, feedCanale, canali] = await Promise.all([
      callWorker(env, "/feed.xml"),
      callWorker(env, `/feed/${id}.xml`),
      callWorker(env, "/canali"),
    ]);
    expect(feedAggregato.status).toBe(200);
    expect(feedAggregato.headers.get("content-type")).toContain("application/rss+xml");
    expect(feedCanale.status).toBe(200);
    expect(feedCanale.headers.get("content-type")).toContain("application/rss+xml");
    expect(canali.status).toBe(404);
  });
});
