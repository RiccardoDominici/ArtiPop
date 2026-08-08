// feat-il-promemoria-del-wallpaper-va-nel-calendario: GET /promemoria.ics è
// un calendario iCalendar sottoscrivibile, pubblico, senza accesso a KV.
// Stesso stile di robustezza di opml-rotta.test.js: guasti simulati, zero
// generazioni AI, mai un errore grezzo verso il client.
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

describe("GET /promemoria.ics", () => {
  it("200, content-type text/calendar, content-disposition, cache-control, header di sicurezza, corpo valido", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/promemoria.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("content-disposition")).toContain("ArtiPop.ics");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const corpo = await res.text();
    expect(corpo.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });

  it("?c=<canale attivo> mette l'URL di quel canale nel corpo", async () => {
    const env = makeEnv();
    const id = ACTIVE_CHANNELS[0].id;
    const res = await callWorker(env, `/promemoria.ics?c=${id}`);
    const corpo = await res.text();
    expect(corpo).toContain(`URL:https://artipop.test/?c=${id}`);
  });

  it("?c= sconosciuto, vuoto o malformato: sempre 200, mai JSON, promemoria generico", async () => {
    const env = makeEnv();
    const casi = ["inesistente", "", "../../etc/passwd", "%00"];
    for (const c of casi) {
      const res = await callWorker(env, `/promemoria.ics?c=${c}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).not.toContain("application/json");
      const corpo = await res.text();
      expect(corpo.startsWith("BEGIN:VCALENDAR")).toBe(true);
      expect(corpo).not.toContain(`?c=${c}`);
    }
  });

  it("senza chiave admin: comunque 200 (rotta pubblica, nessuna auth)", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    const res = await callWorker(env, "/promemoria.ics");
    expect(res.status).toBe(200);
  });

  it("KV completamente rotto: comunque 200, text/calendar, calendario valido", async () => {
    const kv = makeKV();
    const env = makeEnv({
      KV: {
        ...kv,
        async list() { throw new Error("KV.list non disponibile (simulato)"); },
        async get() { throw new Error("KV.get non disponibile (simulato)"); },
        async getWithMetadata() { throw new Error("KV.getWithMetadata non disponibile (simulato)"); },
      },
    });

    const res = await callWorker(env, "/promemoria.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const corpo = await res.text();
    expect(corpo.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });

  it("zero generazioni AI: gli stub lanciano se invocati, il test resta verde", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/promemoria.ics");
    expect(res.status).toBe(200);
  });
});

describe("regressione rotte vicine con /promemoria.ics presente", () => {
  it("/feed.xml, /canali.opml e /feed/<id>.xml restano 200, /promemoria (senza .ics) resta 404", async () => {
    const env = makeEnv();
    const id = ACTIVE_CHANNELS[0].id;
    const [feed, opml, feedCanale, promemoriaSenzaEstensione] = await Promise.all([
      callWorker(env, "/feed.xml"),
      callWorker(env, "/canali.opml"),
      callWorker(env, `/feed/${id}.xml`),
      callWorker(env, "/promemoria"),
    ]);
    expect(feed.status).toBe(200);
    expect(feed.headers.get("content-type")).toContain("application/rss+xml");
    expect(opml.status).toBe(200);
    expect(opml.headers.get("content-type")).toContain("text/x-opml");
    expect(feedCanale.status).toBe(200);
    expect(feedCanale.headers.get("content-type")).toContain("application/rss+xml");
    expect(promemoriaSenzaEstensione.status).toBe(404);
  });
});
