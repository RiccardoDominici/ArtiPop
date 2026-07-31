// Pagina 404 per percorsi HTML sconosciuti: un utente che sbaglia a digitare
// un indirizzo (o segue un vecchio link) deve ricevere una pagina umana, non
// il JSON grezzo `{"error":"not found"}` (CLAUDE.md, principio usabilità).
// I client API (Accept assente o application/json) mantengono il contratto
// JSON invariato — vedi router-errori.test.js, non toccato da questo file.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("404 su percorso sconosciuto — negoziazione formato", () => {
  it("con Accept: text/html risponde 404 HTML con i link di uscita", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/percorso-inesistente", {
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("Pagina non trovata");
    expect(body).toContain('href="/"');
    expect(body).toContain('href="/aiuto"');
  });

  it("con Accept: application/json risponde 404 JSON", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/percorso-inesistente", {
      headers: { accept: "application/json" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("senza header Accept risponde 404 JSON (nessuna regressione)", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/percorso-inesistente");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("la risposta HTML porta gli header di sicurezza e no-store", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/percorso-inesistente", {
      headers: { accept: "text/html" },
    });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBeTruthy();
    expect(res.headers.get("x-frame-options")).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("il corpo HTML non espone dettagli tecnici", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/percorso-inesistente", {
      headers: { accept: "text/html" },
    });
    const body = await res.text();
    expect(body.toLowerCase()).not.toContain("error");
    expect(body).not.toContain("percorso-inesistente");
  });
});
