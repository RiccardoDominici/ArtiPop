// feat-il-catalogo-si-cerca-per-nome: il campo #catCerca nella barra strumenti
// del Catalogo filtra le liste Concept/Element per pezzo di nome o di id.
// Stessa tecnica sandbox di tuning-catalogo-sospesi.test.js: util.js e
// tab-catalogo.js caricati in un'unica sandbox, document stubbato al minimo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (rel) => fileURLToPath(new URL(`../../../tuning/${rel}`, import.meta.url));
const UTIL_SRC = readFileSync(path("js/util.js"), "utf8");
const TABCAT_SRC = readFileSync(path("js/tab-catalogo.js"), "utf8");

function fakeRow() {
  const row = {
    className: "",
    innerHTML: "",
    onclick: null,
    value: "",
    oninput: null,
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return row;
}

function creaSandbox() {
  const righe = [];
  const catList = {
    innerHTML: "",
    appendChild(row) { righe.push(row); },
  };
  const elementiFinti = { catList };
  const documentFinto = {
    getElementById: (id) => elementiFinti[id] || (elementiFinti[id] = fakeRow()),
    createElement: () => fakeRow(),
    querySelectorAll: () => [],
  };
  const AP = {
    store: {
      on() {},
      dati: { catalogo: { concepts: [], elements: [] }, canali: [] },
      usi: { concept: {}, element: {} },
    },
  };
  const fn = new Function(
    "window", "AP", "document",
    `${UTIL_SRC}\n${TABCAT_SRC}\ncatalogoArrivato = true;\nreturn { renderElementList, renderConceptList, renderCatList, filtraVoci };`
  );
  const api = fn({}, AP, documentFinto);
  return {
    api,
    AP,
    righe,
    svuotaRighe: () => { righe.length = 0; catList.innerHTML = ""; },
    catList,
    el: (id) => elementiFinti[id] || (elementiFinti[id] = fakeRow()),
  };
}

describe("filtraVoci — input degeneri", () => {
  const items = [{ id: "faro", nome: "Faro" }, { id: "canoa", nome: "Canoa" }];

  it("testo vuoto o solo spazi restituisce tutte le voci", () => {
    const { api } = creaSandbox();
    expect(api.filtraVoci(items, "")).toEqual(items);
    expect(api.filtraVoci(items, "   ")).toEqual(items);
  });

  it("testo non stringa restituisce l'elenco invariato", () => {
    const { api } = creaSandbox();
    expect(api.filtraVoci(items, null)).toEqual(items);
    expect(api.filtraVoci(items, 42)).toEqual(items);
  });

  it("items non array restituisce [] senza lanciare", () => {
    const { api } = creaSandbox();
    expect(() => api.filtraVoci(null, "x")).not.toThrow();
    expect(api.filtraVoci(null, "x")).toEqual([]);
    expect(api.filtraVoci(undefined, "x")).toEqual([]);
    expect(api.filtraVoci("nonarray", "x")).toEqual([]);
  });
});

describe("filtraVoci — corrispondenze", () => {
  const items = [
    { id: "faro", nome: "Faro" },
    { id: "canoa_notte", nome: "Canoa" },
    { id: "spirale", nome: "Notte alta" },
  ];

  it("trova per pezzo di nome o di id, ignorando maiuscole/minuscole", () => {
    const { api } = creaSandbox();
    expect(api.filtraVoci(items, "far").map((i) => i.id)).toEqual(["faro"]);
    const nott = api.filtraVoci(items, "NOTT").map((i) => i.id).sort();
    expect(nott).toEqual(["canoa_notte", "spirale"]);
  });

  it("scarta le voci che non corrispondono", () => {
    const { api } = creaSandbox();
    expect(api.filtraVoci(items, "zzz")).toEqual([]);
  });
});

describe("tab-catalogo: ricerca condivisa nella lista Concept/Element", () => {
  it("renderConceptList filtra, mostra il messaggio di nessuna corrispondenza, e torna intera a testo vuoto", () => {
    const { api, AP, svuotaRighe, righe, catList, el } = creaSandbox();
    AP.store.dati.catalogo.concepts = [
      { id: "faro", nome: "Faro", custom: false },
      { id: "canoa_notte", nome: "Canoa", custom: false },
      { id: "spirale", nome: "Notte alta", custom: false },
    ];
    const catCercaEl = el("catCerca");

    svuotaRighe();
    catCercaEl.value = "far";
    catCercaEl.oninput({ target: catCercaEl }); // aggancio dell'input: aggiorna catCerca e ridisegna
    expect(righe.length).toBe(1);
    expect(righe[0].innerHTML).toContain("Faro");

    svuotaRighe();
    catCercaEl.value = "zzz";
    catCercaEl.oninput({ target: catCercaEl });
    expect(righe.length).toBe(0);
    expect(catList.innerHTML).toContain('nessuna voce corrisponde a "zzz"');

    svuotaRighe();
    catCercaEl.value = "";
    catCercaEl.oninput({ target: catCercaEl });
    expect(righe.length).toBe(3);
  });

  it("con catalogo genuinamente vuoto e ricerca vuota, resta il messaggio storico", () => {
    const { api, AP, catList } = creaSandbox();
    AP.store.dati.catalogo.concepts = [];
    api.renderConceptList();
    expect(catList.innerHTML).toContain("nessun concept nel catalogo.");
  });

  it("renderElementList filtra con lo stesso testo di ricerca (condiviso fra i due tipi)", () => {
    const { api, AP, el } = creaSandbox();
    AP.store.dati.catalogo.elements = [
      { id: "faro", nome: "Faro", custom: false },
      { id: "canoa_notte", nome: "Canoa", custom: false },
      { id: "spirale", nome: "Notte alta", custom: false },
    ];
    const catCercaEl = el("catCerca");
    catCercaEl.value = "nott";
    catCercaEl.oninput({ target: catCercaEl });

    api.renderElementList();
    const ids = api.filtraVoci(AP.store.dati.catalogo.elements, "nott").map((i) => i.id).sort();
    expect(ids).toEqual(["canoa_notte", "spirale"]);
  });
});
