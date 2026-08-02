// feat-un-solo-indirizzo-ufficiale-per-ogni-pagina: gli alias di rotta
// (/aiuto, /aiuto.html, /help) e le varianti per-query della home (/?c=&d=)
// rispondono tutti con lo stesso HTML della loro forma primaria — qui si
// copre che dichiarino anche lo stesso indirizzo canonico, end-to-end sulle
// rotte reali del worker.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

const ORIGIN = "https://artipop.test";

function estraiCanonical(html) {
  const m = html.match(/<link rel="canonical" href="([^"]+)" \/>/);
  return m ? m[1] : null;
}

describe("canonical su / e i suoi alias", () => {
  it("GET / risponde 200 con canonical sulla home", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(estraiCanonical(html)).toBe(`${ORIGIN}/`);
  });

  it("GET /index.html risponde 200 con lo stesso canonical della home", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/index.html");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(estraiCanonical(html)).toBe(`${ORIGIN}/`);
  });

  it("GET /?c=natura&d=<data> mantiene il canonical invariato su '/', non segue i parametri", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/?c=natura&d=2026-07-28");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(estraiCanonical(html)).toBe(`${ORIGIN}/`);
  });
});

describe("canonical su /aiuto e i suoi alias", () => {
  it("GET /aiuto, /aiuto.html e /help rispondono 200 tutte con canonical su /aiuto", async () => {
    for (const path of ["/aiuto", "/aiuto.html", "/help"]) {
      const env = makeEnv();
      const res = await callWorker(env, path);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(estraiCanonical(html)).toBe(`${ORIGIN}/aiuto`);
    }
  });
});

describe("canonical su /archivi", () => {
  it("GET /archivi risponde 200 con canonical su /archivi", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(estraiCanonical(html)).toBe(`${ORIGIN}/archivi`);
  });

  it("GET /archivi/<id>?date=<data> ha canonical sul proprio percorso completo di ?date=", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(estraiCanonical(html)).toBe(`${ORIGIN}/archivi/island?date=2025-01-02`);
  });
});
