// Percorsi d'errore del router: fallback 404, CORS sul preflight delle rotte
// tool, e body malformato (JSON illeggibile o forma non valida) sulle
// scritture admin — devono sempre tornare 400 con un messaggio, mai un 500
// grezzo o una pagina d'errore generica (CLAUDE.md, principio robustezza).
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("404 fallback", () => {
  it("un percorso sconosciuto risponde 404 con corpo JSON", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/questo-percorso-non-esiste");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });
});

describe("CORS sul preflight di una rotta tool", () => {
  it("OPTIONS /tuning risponde 204 con gli header CORS", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/tuning", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(res.headers.get("access-control-allow-headers")).toContain("x-artipop-key");
  });
});

describe("body malformato su scritture admin → 400", () => {
  // Due forme distinte di malformazione, per ciascuna delle 3 rotte:
  //  - JSON illeggibile (testo che non fa nemmeno JSON.parse);
  //  - JSON valido ma di forma sbagliata/incompleta (campi mancanti).
  const CASI = [
    { path: "/tuning", corpoIllegibile: "{questo non è JSON", corpoIncompleto: "null" },
    { path: "/catalogo/concept", corpoIllegibile: "{questo non è JSON", corpoIncompleto: "{}" },
    { path: "/note/giorno", corpoIllegibile: "{questo non è JSON", corpoIncompleto: "{}" },
  ];

  for (const { path, corpoIllegibile, corpoIncompleto } of CASI) {
    it(`PUT ${path} con JSON illeggibile → 400 con messaggio d'errore`, async () => {
      const env = makeEnv();
      const res = await callWorker(env, path, {
        method: "PUT",
        headers: { "x-artipop-key": env.ADMIN_KEY },
        body: corpoIllegibile,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      const messaggio = body.error ?? (Array.isArray(body.errori) ? body.errori.join("; ") : "");
      expect(messaggio.length).toBeGreaterThan(0);
    });

    it(`PUT ${path} con campi mancanti (JSON valido, forma incompleta) → 400 con messaggio d'errore`, async () => {
      const env = makeEnv();
      const res = await callWorker(env, path, {
        method: "PUT",
        headers: { "x-artipop-key": env.ADMIN_KEY },
        body: corpoIncompleto,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      const messaggio = body.error ?? (Array.isArray(body.errori) ? body.errori.join("; ") : "");
      expect(messaggio.length).toBeGreaterThan(0);
    });
  }
});
