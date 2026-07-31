// Header di sicurezza sulle due pagine HTML pubbliche (ROADMAP M8): /
// e /aiuto devono portare X-Content-Type-Options, Referrer-Policy e
// X-Frame-Options. NIENTE CSP (decisione registrata in ROADMAP: l'inline
// JS/CSS di page.js/help.js la renderebbe una riscrittura). Le risposte
// non-HTML (JSON, immagine) restano come oggi: nessuna aspettativa che
// portino questi header.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

const HEADER_ATTESI = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
};

describe("header di sicurezza su / e /aiuto", () => {
  it.each([["/"], ["/aiuto"]])("%s porta i 3 header attesi", async (path) => {
    const env = makeEnv();
    const res = await callWorker(env, path);
    expect(res.status).toBe(200);
    for (const [nome, valore] of Object.entries(HEADER_ATTESI)) {
      expect(res.headers.get(nome)).toBe(valore);
    }
  });

  it("il corpo di / resta quello di sempre (contiene ancora \"ArtiPop\")", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/");
    const corpo = await res.text();
    expect(corpo).toContain("ArtiPop");
  });
});

describe("header di sicurezza assenti sulle risposte non-HTML", () => {
  it("una risposta JSON (/health) non porta gli header da pagina HTML", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
    for (const nome of Object.keys(HEADER_ATTESI)) {
      expect(res.headers.get(nome)).toBeNull();
    }
  });

  it("una risposta immagine (/w/natura?date=) non porta gli header da pagina HTML", async () => {
    const env = makeEnv();
    const data = "2026-01-15";
    // Stesso seme di orchestrazione.test.js: chiave archive:<canale>:<data>.
    await env.KV.put(`archive:natura:${data}`, new Uint8Array([137, 80, 78, 71, 1, 2, 3]), {
      metadata: { contentType: "image/png", date: data, model: "test" },
    });
    const res = await callWorker(env, `/w/natura?date=${data}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    for (const nome of Object.keys(HEADER_ATTESI)) {
      expect(res.headers.get(nome)).toBeNull();
    }
  });
});
