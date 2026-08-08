// feat-gli-archivi-storici-si-riaprono-dal-sito: /archivi elenca i canali
// con giorni in archivio (chiavi archive:<canale>:<data> in KV), storici e
// attivi (feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-archivio: un
// canale attivo con giorni in archivio compare anch'esso, marcato «canale
// in corso»). Stesso schema di aiuto-stato-canali.test.js: KV preseminato,
// rotta pubblica (nessuna auth), una lettura KV fallita non deve MAI
// diventare 500.
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

const ORIGIN = "https://artipop.test";

describe("GET /archivi", () => {
  it("200 text/html, elenca island (storico) ed ENTRAMBI col canale attivo marcato «canale in corso»", async () => {
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
    expect(html).toContain(`/archivi/${ACTIVE_CHANNELS[0].id}?date=2025-01-01`);
    expect(html).toContain("canale in corso");
    expect(html).toContain(`/?c=${ACTIVE_CHANNELS[0].id}`);
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

  it("?cerca=<id>: 200 con la sola card che corrisponde, le altre assenti", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:bloom:2025-02-01", "1");

    const res = await callWorker(env, "/archivi?cerca=isl");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("/archivi/island?date=2025-01-01");
    expect(html).not.toContain("/archivi/bloom?date=2025-02-01");
  });

  it("?ordina=giorni: 200 con le card dal più ricco di giorni al meno ricco", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");
    await env.KV.put("archive:bloom:2025-02-01", "1");

    const res = await callWorker(env, "/archivi?ordina=giorni");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<option value="giorni" selected>');
    expect(html.indexOf("/archivi/island?date=")).toBeLessThan(html.indexOf("/archivi/bloom?date="));
  });

  it("?ordina=<valore inventato>: mai 500, ordine di default (recenti)", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:bloom:2025-03-01", "1");

    const res = await callWorker(env, "/archivi?ordina=inventato");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<option value="recenti" selected>');
    expect(html.indexOf("/archivi/bloom?date=")).toBeLessThan(html.indexOf("/archivi/island?date="));
  });

  it("?cerca=isl&ordina=nome: 200 con la sola card che corrisponde e il criterio nome selezionato", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:bloom:2025-02-01", "1");

    const res = await callWorker(env, "/archivi?cerca=isl&ordina=nome");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("/archivi/island?date=2025-01-01");
    expect(html).not.toContain("/archivi/bloom?date=2025-02-01");
    expect(html).toContain('<option value="nome" selected>');
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

  it("?date=X&confronta=Y: la seconda figura arriva fino all'HTML servito", async () => {
    // feat-due-giorni-d-archivio-uno-accanto-all-altro
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");

    const res = await callWorker(env, "/archivi/island?date=2025-01-02&confronta=2025-01-01");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect((html.match(/<figure class="foto"/g) || []).length).toBe(2);
    expect(html).toContain('<img src="/w/island?date=2025-01-01"');
    expect(html).toContain('<div class="confronto">');

    const resInesistente = await callWorker(env, "/archivi/island?date=2025-01-02&confronta=2099-01-01");
    expect(resInesistente.status).toBe(200);
    const htmlInesistente = await resInesistente.text();
    expect((htmlInesistente.match(/<figure class="foto"/g) || []).length).toBe(1);
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

  // feat-il-giorno-d-archivio-mostra-tutto-il-suo-arco
  it("giorni dello stesso arco in KV: la striscia compare con i link agli altri giorni e il giorno mostrato marcato aria-current", async () => {
    const env = makeEnv();
    for (const [d, n] of [["2025-01-01", 1], ["2025-01-02", 2], ["2025-01-03", 3]]) {
      await env.KV.put(`archive:island:${d}`, "1");
      await env.KV.put(
        `giorno:island:${d}`,
        JSON.stringify({ data: d, canale: "island", arco: 2, giornoNellArco: n, tappa: n }),
      );
    }

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<nav class="arco" aria-label="I giorni di questo arco">');
    expect(html).toContain('href="/archivi/island?date=2025-01-01"');
    expect(html).toContain('href="/archivi/island?date=2025-01-03"');
    expect(html).toContain('<span aria-current="page">');
  });

  it("carte d'identità mancanti (arco ricostruito/null): 200 senza striscia", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<nav class="arco"');
  });

  it("KV.get che lancia sulle chiavi giorno: comunque 200, senza striscia e senza dettagli tecnici", async () => {
    const kv = makeKV();
    for (const d of ["2025-01-01", "2025-01-02", "2025-01-03"]) {
      await kv.put(`archive:island:${d}`, "1");
    }
    const env = makeEnv({
      KV: {
        ...kv,
        async get(key, opts) {
          if (key.startsWith("giorno:")) throw new Error("KV.get non disponibile (simulato)");
          return kv.get(key, opts);
        },
      },
    });

    const res = await callWorker(env, "/archivi/island?date=2025-01-02");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<nav class="arco"');
    expect(html).not.toContain("KV.get non disponibile");
  });
});

// feat-riscopri-un-giorno-a-caso-dall-archivio: /archivi/<id>?date=casuale
// pesca una data a sorte fra quelle in archivio e redirige, senza cache.
describe("GET /archivi/<id>?date=casuale", () => {
  it("canale con archivio: 302 verso /archivi/<id>?date=<una data reale>, no-store, corpo mai JSON", async () => {
    const env = makeEnv();
    await env.KV.put("archive:island:2025-01-01", "1");
    await env.KV.put("archive:island:2025-01-02", "1");
    await env.KV.put("archive:island:2025-01-03", "1");

    const res = await callWorker(env, "/archivi/island?date=casuale");
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toMatch(/^\/archivi\/island\?date=2025-01-0[123]$/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.text();
    expect(body).not.toContain('"ok"');
  });

  it("canale senza archivio: 404 HTML renderArchivioNonTrovato, mai JSON", async () => {
    const env = makeEnv();

    const res = await callWorker(env, "/archivi/nonesiste?date=casuale");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).not.toContain('"ok":false');
    expect(html).toContain('href="/archivi"');
  });
});
