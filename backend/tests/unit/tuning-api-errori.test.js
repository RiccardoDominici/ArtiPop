// Verifica che AP.util.api() dica la verità quando il Worker non risponde:
// oggi (prima di questa modifica) una fetch rifiutata dal browser (host
// irraggiungibile, offline, CORS) passava nuda fino al toast in inglese, e una
// risposta 200 con corpo non-JSON veniva spacciata per dato buono ({ raw }).
// Carica tuning/js/util.js in sandbox — stessa tecnica di tuning-ambiente.test.js —
// stubbando solo document.getElementById per i campi "base"/"key" e una fetch finta.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (rel) => fileURLToPath(new URL(`../../../tuning/${rel}`, import.meta.url));
const SRC = readFileSync(path("js/util.js"), "utf8");
const BASE = "https://artipop.riccardo-dominici.workers.dev";
const KEY_SEGRETA = "chiave-super-segreta";

function creaAP(fetchFinta) {
  const campi = { base: { value: BASE }, key: { value: KEY_SEGRETA } };
  const documentFinto = { getElementById: (id) => campi[id] };
  const windowFinto = {};
  const fn = new Function("window", "AP", "document", "fetch", `${SRC}\nreturn AP;`);
  return fn(windowFinto, {}, documentFinto, fetchFinta);
}

describe("AP.util.api — errori", () => {
  let AP;

  it("(a) fetch rifiutata → messaggio umano con l'indirizzo, mai il testo del browser", async () => {
    AP = creaAP(async () => { throw new TypeError("Failed to fetch"); });
    await expect(AP.util.api("/api/channels")).rejects.toMatchObject({
      message: expect.stringContaining(BASE),
    });
    try {
      await AP.util.api("/api/channels");
      throw new Error("doveva rigettare");
    } catch (e) {
      expect(e.message).not.toContain("Failed to fetch");
    }
  });

  it("(f) il messaggio dell'errore di rete non contiene la chiave admin", async () => {
    AP = creaAP(async () => { throw new TypeError("Failed to fetch"); });
    try {
      await AP.util.api("/api/channels");
      throw new Error("doveva rigettare");
    } catch (e) {
      expect(e.message).not.toContain(KEY_SEGRETA);
    }
  });

  it("(b) risposta ok con corpo non-JSON → rigetta, non risolve con { raw }", async () => {
    AP = creaAP(async () => ({
      ok: true,
      status: 200,
      text: async () => "<html>ciao</html>",
    }));
    await expect(AP.util.api("/api/channels")).rejects.toMatchObject({
      status: 200,
      message: expect.stringContaining(BASE),
    });
  });

  it("(c) non-regressione: 400 con { errori: [...] } resta leggibile da errFromCatch", async () => {
    AP = creaAP(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ ok: false, errori: ["a", "b"] }),
    }));
    try {
      await AP.util.api("/api/channels");
      throw new Error("doveva rigettare");
    } catch (e) {
      expect(e.payload.errori).toEqual(["a", "b"]);
      expect(AP.util.errFromCatch(e)).toEqual(["a", "b"]);
    }
  });

  it("(d) non-regressione: 403 con { error } → messaggio e status preservati", async () => {
    AP = creaAP(async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: "non autorizzato" }),
    }));
    try {
      await AP.util.api("/api/channels");
      throw new Error("doveva rigettare");
    } catch (e) {
      expect(e.message).toBe("non autorizzato");
      expect(e.status).toBe(403);
    }
  });

  it("(e) non-regressione: 200 con JSON valido → risolve con l'oggetto parsato", async () => {
    AP = creaAP(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, dato: 42 }),
    }));
    await expect(AP.util.api("/api/channels")).resolves.toEqual({ ok: true, dato: 42 });
  });
});
