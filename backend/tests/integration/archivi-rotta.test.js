// feat-gli-archivi-storici-si-riaprono-dal-sito: /archivi elenca i canali
// storici (chiavi archive:<canale>:<data> in KV) esclusi quelli attivi.
// Stesso schema di aiuto-stato-canali.test.js: KV preseminato, rotta
// pubblica (nessuna auth), una lettura KV fallita non deve MAI diventare 500.
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

const ORIGIN = "https://artipop.test";

describe("GET /archivi", () => {
  it("200 text/html, elenca island (storico) ma NON il canale attivo", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put(`archive:${ACTIVE_CHANNELS[0].id}:2025-01-01`, "1");

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const html = await res.text();
    expect(html).toContain("island");
    expect(html).toContain("/archivi/island?date=2025-01-02");
    expect(html).toContain("/archivi/island?date=2025-01-01");
    expect(html).not.toContain(`/archivi/${ACTIVE_CHANNELS[0].id}?date=2025-01-01`);
  });

  it("senza chiave admin: comunque 200 (rotta pubblica, nessuna auth)", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    await env.KV.put("archive:island:2025-01-01", "1");

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
  });

  it("nessun archivio storico: 200 con messaggio umano, mai una pagina rotta", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Nessun archivio storico da mostrare.");
  });

  it("KV.list che lancia: comunque 200 con un messaggio umano, mai 500, mai dettagli tecnici", async () => {
    // listChannelsWithArchive (storage.js) intercetta già i guasti di KV.list
    // e degrada a "nessun archivio" (vedi il suo stesso try/catch): il punto
    // qui non è distinguere il messaggio, ma che /archivi resti 200 e leggibile
    // qualunque cosa succeda alla scansione — mai un 500, mai `err.message`.
    const kv = makeKV();
    const env = makeEnv({
      KV: { ...kv, async list() { throw new Error("KV.list non disponibile (simulato)"); } },
    });

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("KV.list non disponibile");
    expect(html).not.toContain("Error");
  });

  it("carta d'identità dell'ultimo giorno in KV: la card mostra i nomi di quel giorno", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put(
      "giorno:island:2025-01-02",
      JSON.stringify({ data: "2025-01-02", canale: "island", conceptNome: "Costruzione", elementNome: "Isola" })
    );

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div class="soggetto">Isola · Costruzione</div>');
  });

  it("KV.get che lancia durante l'arricchimento (canale senza ricostruzione onesta): comunque 200 con l'elenco completo, senza riga soggetto", async () => {
    // getGiorno (storage.js) intercetta già i guasti di KV.get e degrada a
    // "assente" (stesso trattamento di KV.list sopra): il punto qui non è la
    // provenienza del fallimento, ma che l'arricchimento non porti mai a un
    // 500 né a una card con soggetto inventato — "horizon" non è in
    // RICOSTRUZIONE_STORICA, quindi resta senza nomi.
    const kv = makeKV();
    await kv.put("archive:horizon:2025-01-01", "1");
    const env = makeEnv({
      KV: {
        ...kv,
        async get(key, opts) {
          if (key.startsWith("giorno:")) throw new Error("KV.get non disponibile (simulato)");
          return kv.get(key, opts);
        },
      },
    });

    const res = await callWorker(env, "/archivi");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("horizon");
    expect(html).not.toContain('class="soggetto"');
  });
});

// feat-il-giorno-d-archivio-si-apre-dentro-il-sito: /archivi/<id> apre UN
// giorno dentro il sito invece del binario grezzo di /w/, con la barra
// precedente/successivo per sfogliare l'archivio senza tornare indietro.
describe("GET /archivi/<id>", () => {
  it("200 text/html con la data più recente quando ?date= non è specificata", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");

    const res = await callWorker(env, "/archivi/island");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const html = await res.text();
    expect(html).toContain("2025-01-03");
    expect(html).toContain('<img src="/w/island?date=2025-01-03"');
  });

  it("?date= esplicita: mostra quel giorno, con precedente e successivo corretti", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("2025-01-02");
    expect(html).toContain('<img src="/w/island?date=2025-01-02"');
    expect(html).toContain('href="/archivi/island?date=2025-01-01"');
    expect(html).toContain('href="/archivi/island?date=2025-01-03"');
  });

  it("?date= esplicita: og:image mostra quel giorno, og:url punta al percorso della pagina", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    const html = await res.text();
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/w/island?date=2025-01-02" />`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/archivi/island?date=2025-01-02" />`);
  });

  it("?date= malformata: HTML 404 con link a /archivi, mai JSON", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");

    const res = await callWorker(env, "/archivi/island?date=non-una-data");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('href="/archivi"');
  });

  it("?date= inesistente nell'archivio del canale: HTML 404 con link a /archivi e ai giorni realmente disponibili", async () => {
    // feat-un-giorno-d-archivio-sbagliato-mostra-quelli-giusti
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");

    const res = await callWorker(env, "/archivi/island?date=2025-06-15");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain('href="/archivi"');
    expect(html).toContain('<details class="giorni">');
    expect(html).toContain('<a href="/archivi/island?date=2025-01-02">');
    expect(html).toContain('<a href="/archivi/island?date=2025-01-01">');
  });

  it("canale sconosciuto (mai avuto un archivio): HTML 404, mai JSON, senza elenco di giorni", async () => {
    const env = makeEnv();

    const res = await callWorker(env, "/archivi/nonesiste");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).not.toContain('"ok":false');
    expect(html).toContain('href="/archivi"');
    expect(html).not.toContain('<details class="giorni">');
  });

  it("KV che lancia durante la lettura delle date: pagina leggibile, mai un 500 grezzo", async () => {
    const kv = makeKV();
    const env = makeEnv({
      KV: { ...kv, async list() { throw new Error("KV.list non disponibile (simulato)"); } },
    });

    const res = await callWorker(env, "/archivi/island");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).not.toContain("KV.list non disponibile");
    expect(html).not.toContain("Error");
  });

  it("carta d'identità del giorno mostrato: la pagina riporta i nomi di quel giorno", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put(
      "giorno:island:2025-01-02",
      JSON.stringify({ data: "2025-01-02", canale: "island", conceptNome: "Costruzione", elementNome: "Isola" })
    );

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div class="soggetto">Isola · Costruzione</div>');
  });

  it("header di sicurezza presenti come sulle altre pagine HTML pubbliche", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");

    const res = await callWorker(env, "/archivi/island");
    expect(res.headers.get("x-frame-options")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
