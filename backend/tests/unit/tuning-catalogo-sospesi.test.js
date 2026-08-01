// ciclo 29 (POLISH): il badge "sospeso" nella lista Element/Concept del
// tuning tool deve comparire SOLO per le voci con sospeso:true, e non deve
// comparire affatto quando il campo manca (Worker più vecchio che non lo
// manda ancora, vedi CATALOGO_ERROR/catalogoArrivato in tab-catalogo.js).
// Stessa tecnica sandbox di tuning-modifiche-non-perse.test.js: util.js e
// tab-catalogo.js caricati in un'unica sandbox (condividono lo scope
// globale come due <script> classici), con document stubbato al minimo che
// renderElementList/renderConceptList usano davvero.
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
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return row;
}

/* Costruisce una sandbox con un solo elemento DOM reale: #catList, dove
   renderElementList/renderConceptList appendono le righe create con
   document.createElement. Ogni riga finta accumula il suo innerHTML in un
   array condiviso, così il test può ispezionarlo senza un DOM vero. */
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
      on() {}, // registra solo: nessun evento viene emesso in questo test
      dati: { catalogo: { concepts: [], elements: [] }, canali: [] },
      usi: { concept: {}, element: {} },
    },
  };
  const fn = new Function(
    "window", "AP", "document",
    // `catalogoArrivato` è privata al modulo (flag "il catalogo è arrivato
    // almeno una volta", vedi tab-catalogo.js): la si forza qui via closure,
    // stesso ruolo del vero handler AP.store.on("catalogo", ...) ma senza
    // trascinarsi dietro tutto ciò che quell'handler tocca (status, dove-usato).
    `${UTIL_SRC}\n${TABCAT_SRC}\ncatalogoArrivato = true;\nreturn { renderElementList, renderConceptList };`
  );
  const api = fn({}, AP, documentFinto);
  return { api, AP, righe, catList };
}

describe("tab-catalogo: badge 'sospeso' nella lista Element", () => {
  it("compare solo per l'element con sospeso:true", () => {
    const { api, AP, righe } = creaSandbox();
    AP.store.dati.catalogo.elements = [
      { id: "canoa", nome: "Canoa", custom: false, pubblicato: true, canale: "citta", sospeso: true },
      { id: "faro", nome: "Faro", custom: false, pubblicato: true, canale: "citta", sospeso: false },
    ];
    api.renderElementList();
    expect(righe.length).toBe(2);
    const canoaRow = righe.find((r) => r.innerHTML.includes(">canoa<") || r.innerHTML.includes("Canoa"));
    const faroRow = righe.find((r) => r.innerHTML.includes(">faro<") || r.innerHTML.includes("Faro"));
    expect(canoaRow.innerHTML).toContain('badge sospeso">sospeso</span>');
    expect(faroRow.innerHTML).not.toContain("badge sospeso");
  });

  it("non compare affatto quando il campo sospeso manca (Worker più vecchio)", () => {
    const { api, righe, AP } = creaSandbox();
    AP.store.dati.catalogo.elements = [
      { id: "faro", nome: "Faro", custom: false, pubblicato: true, canale: "citta" }, // niente campo sospeso
    ];
    api.renderElementList();
    expect(righe[0].innerHTML).not.toContain("badge sospeso");
  });
});

describe("tab-catalogo: badge 'sospeso' nella lista Concept", () => {
  it("compare solo per il concept con sospeso:true", () => {
    const { api, AP, righe } = creaSandbox();
    AP.store.dati.catalogo.concepts = [
      { id: "attraversamento", nome: "Attraversamento", custom: false, sospeso: true },
      { id: "spirale", nome: "Spirale", custom: false, sospeso: false },
    ];
    api.renderConceptList();
    expect(righe.length).toBe(2);
    const sospesoRow = righe.find((r) => r.innerHTML.includes("Attraversamento"));
    const altroRow = righe.find((r) => r.innerHTML.includes("Spirale"));
    expect(sospesoRow.innerHTML).toContain('badge sospeso">sospeso</span>');
    expect(altroRow.innerHTML).not.toContain("badge sospeso");
  });

  it("non compare affatto quando il campo sospeso manca (Worker più vecchio)", () => {
    const { api, righe, AP } = creaSandbox();
    AP.store.dati.catalogo.concepts = [
      { id: "spirale", nome: "Spirale", custom: false }, // niente campo sospeso
    ];
    api.renderConceptList();
    expect(righe[0].innerHTML).not.toContain("badge sospeso");
  });
});
