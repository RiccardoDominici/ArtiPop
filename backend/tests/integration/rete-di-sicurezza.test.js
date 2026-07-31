// Rete di sicurezza globale del router (CLAUDE.md, principio 3): prima di
// questo ciclo `fetch()` non aveva un try/catch al primo livello, quindi
// un'eccezione imprevista su una LETTURA (KV.get/getWithMetadata) — mai
// protetta come le scritture (kvChePerdeLeScritture, admin-robuste.test.js) —
// propagava fuori dal worker e Cloudflare serviva la sua pagina d'errore
// generica 1101: a /w/<flusso> la Shortcut riceveva HTML al posto dei byte
// immagine, sul sito l'utente vedeva un crash grezzo. Questo file esercita le
// rotte di lettura con kvChePerdeLeLetture (vedi helpers/fakeEnv.js) e
// verifica che rispondano tutte con la forma di emergenza attesa dalla rotta,
// mai JSON su /w/, mai HTML sull'API, mai un dettaglio tecnico nel corpo.
import { describe, it, expect } from "vitest";
import { makeEnv, kvChePerdeLeLetture, callWorker } from "../helpers/fakeEnv.js";

describe("rete di sicurezza globale: KV che perde le letture → mai un crash grezzo", () => {
  it("GET /w/citta con KV guasto → 500, immagine (firma PNG), mai JSON", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    const res = await callWorker(env, "/w/citta");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/^image\//);
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // 'P'
    expect(buf[2]).toBe(0x4e); // 'N'
    expect(buf[3]).toBe(0x47); // 'G'
  });

  it("GET /w/citta?date=2026-01-01 con KV guasto → stesso esito, mai JSON", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    const res = await callWorker(env, "/w/citta?date=2026-01-01");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/^image\//);
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it("GET / con KV guasto → 500 HTML con i token VISUAL_SPECS §2 e gli header di sicurezza", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    const res = await callWorker(env, "/");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await res.text();
    expect(body).toContain("#0a0b10");
    expect(body).toContain("#8fd3ff");
  });

  it("GET /aiuto con KV guasto → non tocca KV, resta 200 HTML (mai JSON, mai crash)", async () => {
    // renderHelpPage() è sincrona e non legge KV: con letture guaste la rotta
    // non lancia affatto, quindi non passa dalla rete di sicurezza globale —
    // resta il 200 di sempre. L'invariante che conta (mai JSON, mai la pagina
    // d'errore generica di Cloudflare) resta comunque verificata.
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    const res = await callWorker(env, "/aiuto");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(() => JSON.parse(body)).toThrow();
  });

  it("GET /s/citta.shortcut con KV guasto → il catch locale già esistente gestisce, 404 HTML (mai JSON)", async () => {
    // /s/ ha già un try/catch locale attorno a KV.get (ciclo 4): con letture
    // guaste cattura lì, prima di raggiungere la rete di sicurezza globale, e
    // risponde con la pagina "Shortcut non disponibile" già prevista — non
    // una regressione, solo un ramo diverso con lo stesso esito (mai JSON).
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    const res = await callWorker(env, "/s/citta.shortcut");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(() => JSON.parse(body)).toThrow();
  });

  it("GET /api/channels con KV guasto → 500 JSON, senza il messaggio d'eccezione simulato", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    const res = await callWorker(env, "/api/channels");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
    const grezzo = JSON.stringify(body);
    expect(grezzo).not.toContain("KV.get non disponibile");
    expect(grezzo).not.toMatch(/simulato/i);
  });
});

describe("non-regressione: KV sano → il wrap non cambia il caso felice", () => {
  it("GET /api/channels con KV sano → 200", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/api/channels");
    expect(res.status).toBe(200);
  });

  it("GET /health con KV sano → 200", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
  });

  it("GET /w/nonesiste con KV sano → 404, corpo immagine", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/w/nonesiste");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^image\//);
  });
});
