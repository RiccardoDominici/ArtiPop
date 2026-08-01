// Verifica che una ricarica (bottone "↻ Aggiorna", "↻ Carica dal Worker",
// catReload/archReload, salvataggio credenziali, o l'auto-carica() dopo un
// lancio riuscito) non butti più via in silenzio le tarature fatte a mano in
// AP.store.edit e non ancora lanciate nel Worker — a differenza di prima, dove
// fetchTuning() → rebuildEdit() riassegnava sempre AP.store.edit dai valori
// freschi del server. Stessa tecnica sandbox di tuning-ambiente.test.js: carica
// util.js (per AP.util.diffProfilo, api, $) e poi store.js in un'unica sandbox
// (condividono lo scope globale come due <script> classici), con fetch/document
// stubbati.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (rel) => fileURLToPath(new URL(`../../../tuning/${rel}`, import.meta.url));
const UTIL_SRC = readFileSync(path("js/util.js"), "utf8");
const STORE_SRC = readFileSync(path("js/store.js"), "utf8");
const BASE = "https://artipop.riccardo-dominici.workers.dev";

function profilo(estMax) {
  return {
    estensione: [10, estMax], intensita: [0.2, 0.8], compattezza: [0.3, 0.7],
    monotona: false, maxDeriva: null, maxDegrado: null, overridden: false,
  };
}

function jsonRes(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

/* Costruisce una sandbox con AP.store pronta all'uso: /tuning risponde in
   sequenza con i documenti passati in `tuningRisposte` (uno per ogni carica()
   invocata, l'ultimo si ripete se le chiamate superano l'array); canali,
   catalogo e note rispondono sempre vuoti, non sono oggetto del test. */
function creaStore(tuningRisposte) {
  let iTuning = 0;
  const campi = { base: { value: BASE }, key: { value: "" } };
  const documentFinto = { getElementById: (id) => campi[id] };
  const fetchFinta = async (url) => {
    if (url.includes("/tuning")) {
      const doc = tuningRisposte[Math.min(iTuning, tuningRisposte.length - 1)];
      iTuning++;
      return jsonRes(doc);
    }
    if (url.includes("/api/channels")) return jsonRes({ channels: [] });
    if (url.includes("/catalogo")) return jsonRes({ concepts: [], elements: [] });
    if (url.includes("/note")) return jsonRes({ giorni: [], assetti: [] });
    throw new Error(`URL non atteso nello stub: ${url}`);
  };
  const windowFinto = {};
  const fn = new Function(
    "window", "AP", "document", "fetch",
    `${UTIL_SRC}\n${STORE_SRC}\nreturn AP;`
  );
  return fn(windowFinto, {}, documentFinto, fetchFinta);
}

describe("AP.store.carica — conservazione delle modifiche non lanciate", () => {
  it("(a) un profilo modificato a mano e divergente dal server sopravvive a una seconda carica()", async () => {
    const AP = creaStore([
      { concepts: { a: profilo(60) }, defaults: {}, elements: [] },
      { concepts: { a: profilo(60) }, defaults: {}, elements: [] }, // server invariato fra le due chiamate
    ]);
    await AP.store.carica();
    AP.store.edit.a.estensione = [10, 99]; // taratura manuale, diverge dal server
    await AP.store.carica();
    expect(AP.store.edit.a.estensione).toEqual([10, 99]);
  });

  it("(b) un profilo NON toccato dall'utente prende il valore nuovo arrivato dal server", async () => {
    const AP = creaStore([
      { concepts: { b: profilo(60) }, defaults: {}, elements: [] },
      { concepts: { b: profilo(77) }, defaults: {}, elements: [] }, // taratura arrivata da un'altra sessione
    ]);
    await AP.store.carica();
    // nessuna modifica manuale su edit.b
    await AP.store.carica();
    expect(AP.store.edit.b.estensione).toEqual([10, 77]);
  });

  it("(c) carica({ scartaModifiche: true }) riallinea tutto al server, modifiche comprese", async () => {
    const AP = creaStore([
      { concepts: { a: profilo(60) }, defaults: {}, elements: [] },
      { concepts: { a: profilo(60) }, defaults: {}, elements: [] },
    ]);
    await AP.store.carica();
    AP.store.edit.a.estensione = [10, 99]; // taratura manuale
    await AP.store.carica({ scartaModifiche: true });
    expect(AP.store.edit.a.estensione).toEqual([10, 60]);
  });

  it("(d) un concept sparito dalla risposta del server non riappare in AP.store.edit", async () => {
    const AP = creaStore([
      { concepts: { a: profilo(60), c: profilo(50) }, defaults: {}, elements: [] },
      { concepts: { a: profilo(60) }, defaults: {}, elements: [] }, // "c" non più presente
    ]);
    await AP.store.carica();
    expect(AP.store.edit.c).toBeDefined();
    await AP.store.carica();
    expect(AP.store.edit.c).toBeUndefined();
  });
});

describe("cablaggio — unico call site che scarta le modifiche", () => {
  it("(e) solo $(\"reset\") in tab-range.js chiama carica con scartaModifiche: true", () => {
    const filesDaControllare = [
      "js/app.js", "js/tab-range.js", "js/tab-catalogo.js", "js/tab-archivio.js", "js/tab-lab.js",
    ];
    const occorrenze = [];
    for (const f of filesDaControllare) {
      const src = readFileSync(path(f), "utf8");
      if (src.includes("scartaModifiche")) occorrenze.push(f);
    }
    expect(occorrenze).toEqual(["js/tab-range.js"]);

    const srcRange = readFileSync(path("js/tab-range.js"), "utf8");
    const iReset = srcRange.indexOf('$("reset").onclick');
    const iScarta = srcRange.indexOf("scartaModifiche: true");
    expect(iReset).toBeGreaterThan(-1);
    expect(iScarta).toBeGreaterThan(iReset);
    // un'unica occorrenza nel file: nessun altro call site lo passa.
    expect(srcRange.indexOf("scartaModifiche", iScarta + 1)).toBe(-1);
  });
});
