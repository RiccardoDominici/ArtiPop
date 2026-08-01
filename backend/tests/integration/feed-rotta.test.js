// feat-segui-il-canale-dal-lettore-di-feed: GET /feed/<flusso>.xml è una
// vista RSS pubblica sui giorni già serviti da /w/ e /archivi. Stesso stile
// di robustezza di archivi-rotta.test.js: KV preseminato, guasti simulati,
// zero generazioni AI (contratto `makeEnv`/`stubAI`/`stubImages`).
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

describe("GET /feed/<flusso>.xml", () => {
  it("200, content-type application/rss+xml, corpo che si apre con <?xml", async () => {
    const env = makeEnv();
    const id = ACTIVE_CHANNELS[0].id;
    await env.KV.put(`archive:${id}:2026-07-30`, "1");

    const res = await callWorker(env, `/feed/${id}.xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("alias storico: 200 e item dell'archivio di quell'id, non del flusso erede", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put(`archive:${ACTIVE_CHANNELS[0].id}:2025-06-01`, "1");

    const res = await callWorker(env, "/feed/island.xml");
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("/w/island?date=2025-01-02");
    expect(xml).not.toContain(`/w/${ACTIVE_CHANNELS[0].id}?date=2025-06-01`);
  });

  it("flusso inesistente: 404 ma corpo XML, mai JSON né HTML", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/feed/nonesiste.xml");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<rss");
  });

  it("KV.list che lancia: comunque 200 con un feed valido e zero item", async () => {
    const kv = makeKV();
    const env = makeEnv({
      KV: { ...kv, async list() { throw new Error("KV.list non disponibile (simulato)"); } },
    });

    const res = await callWorker(env, `/feed/${ACTIVE_CHANNELS[0].id}.xml`);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml.match(/<item>/g)).toBeNull();
  });

  it("cartaDiIdentita che lancia: 200 con item presenti e soli titoli-data", async () => {
    const kv = makeKV();
    const id = ACTIVE_CHANNELS[0].id;
    await kv.put(`archive:${id}:2026-07-30`, "1");
    const env = makeEnv({
      KV: {
        ...kv,
        async get(key, opts) {
          if (key.startsWith("giorno:")) throw new Error("KV.get non disponibile (simulato)");
          return kv.get(key, opts);
        },
      },
    });

    const res = await callWorker(env, `/feed/${id}.xml`);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain("<title>2026-07-30</title>");
  });

  it("senza chiave admin: comunque 200 (rotta pubblica, nessuna auth)", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    const res = await callWorker(env, `/feed/${ACTIVE_CHANNELS[0].id}.xml`);
    expect(res.status).toBe(200);
  });

  it("zero generazioni AI: gli stub lanciano se invocati, il test resta verde", async () => {
    const env = makeEnv(); // AI.run/IMAGES.input lanciano per contratto (fakeEnv.js)
    await env.KV.put(`archive:${ACTIVE_CHANNELS[0].id}:2026-07-30`, "1");
    const res = await callWorker(env, `/feed/${ACTIVE_CHANNELS[0].id}.xml`);
    expect(res.status).toBe(200);
  });
});

// feat-un-solo-feed-per-tutti-i-canali: /feed.xml unisce gli ultimi giorni di
// tutti i canali attivi in un solo feed. Stesso stile di robustezza della
// rotta per canale.
describe("GET /feed.xml", () => {
  it("200, content-type application/rss+xml, cache-control e header di sicurezza", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/feed.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
  });

  it("giorni finti su due canali: gli <item> sono ordinati dalla data più recente e nominano entrambi i canali", async () => {
    const env = makeEnv();
    const [a, b] = ACTIVE_CHANNELS;
    await env.KV.put(`archive:${a.id}:2026-07-28`, "1");
    await env.KV.put(`archive:${b.id}:2026-07-30`, "1");
    await env.KV.put(`archive:${a.id}:2026-07-29`, "1");

    const res = await callWorker(env, "/feed.xml");
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml.match(/<item>/g)).toHaveLength(3);
    const date = [...xml.matchAll(/<title>[^<]*?(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
    expect(date).toEqual([...date].sort().reverse());
    expect(xml).toContain(a.name);
    expect(xml).toContain(b.name);
  });

  it("listArchiveDates che lancia per UN canale: 200 XML con le voci degli altri canali, mai JSON né 500", async () => {
    const kv = makeKV();
    const id0 = ACTIVE_CHANNELS[0].id;
    const id1 = ACTIVE_CHANNELS[1].id;
    await kv.put(`archive:${id1}:2026-07-30`, "1");
    const env = makeEnv({
      KV: {
        ...kv,
        async list(opts) {
          if (opts?.prefix === `archive:${id0}:`) throw new Error("KV.list non disponibile (simulato)");
          return kv.list(opts);
        },
      },
    });

    const res = await callWorker(env, "/feed.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("KV completamente rotto: risposta XML valida, mai content-type application/json", async () => {
    const kv = makeKV();
    const env = makeEnv({
      KV: { ...kv, async list() { throw new Error("KV.list non disponibile (simulato)"); } },
    });

    const res = await callWorker(env, "/feed.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).not.toContain("application/json");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml.match(/<item>/g)).toBeNull();
  });

  it("zero generazioni AI: gli stub lanciano se invocati, il test resta verde", async () => {
    const env = makeEnv();
    await env.KV.put(`archive:${ACTIVE_CHANNELS[0].id}:2026-07-30`, "1");
    const res = await callWorker(env, "/feed.xml");
    expect(res.status).toBe(200);
  });
});

describe("regressione /feed/<flusso>.xml con /feed.xml presente", () => {
  it("GET /feed/natura.xml resta invariato", async () => {
    const env = makeEnv();
    await env.KV.put("archive:natura:2026-07-30", "1");
    const res = await callWorker(env, "/feed/natura.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });
});

describe("regressione rel=alternate", () => {
  it("/aiuto e /archivi restano privi del tag feed, la home lo espone una volta sola", async () => {
    const env = makeEnv();
    const [aiuto, archivi, home] = await Promise.all([
      callWorker(env, "/aiuto"),
      callWorker(env, "/archivi"),
      callWorker(env, "/"),
    ]);
    const [htmlAiuto, htmlArchivi, htmlHome] = await Promise.all([aiuto.text(), archivi.text(), home.text()]);
    expect(htmlAiuto).not.toContain('rel="alternate"');
    expect(htmlArchivi).not.toContain('rel="alternate"');
    expect(htmlHome.match(/rel="alternate"/g)).toHaveLength(1);
    expect(htmlHome).toContain(`/feed/${ACTIVE_CHANNELS[0].id}.xml`);
  });
});
