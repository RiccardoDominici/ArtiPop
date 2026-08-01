// ciclo 31 (POLISH): la conferma di cancellazione di element/concept nel
// tuning tool deve dichiarare le conseguenze (canale di pubblicazione, archi
// già generati) prima che l'utente prema OK — v. PLAN.md
// "s-eliminare-dal-catalogo-dice-prima-cosa-si-perde". Stessa tecnica
// sandbox di tuning-catalogo-sospesi.test.js: util.js e tab-catalogo.js
// caricati in un'unica sandbox (condividono lo scope globale come due
// <script> classici), con document/AP.store stubbati al minimo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (rel) => fileURLToPath(new URL(`../../../tuning/${rel}`, import.meta.url));
const UTIL_SRC = readFileSync(path("js/util.js"), "utf8");
const TABCAT_SRC = readFileSync(path("js/tab-catalogo.js"), "utf8");

function fakeRow() {
  return { className: "", innerHTML: "", onclick: null, classList: { add() {}, remove() {}, toggle() {} } };
}

function creaSandbox(usi) {
  const catList = { innerHTML: "", appendChild() {} };
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
      usi,
    },
  };
  const fn = new Function(
    "window", "AP", "document",
    `${UTIL_SRC}\n${TABCAT_SRC}\ncatalogoArrivato = true;\nreturn { messaggioEliminaElement, messaggioEliminaConcept };`
  );
  const api = fn({}, AP, documentFinto);
  return { api, AP };
}

describe("tab-catalogo: messaggioEliminaElement", () => {
  it("nomina il canale e dichiara l'uscita dal pool di produzione, se pubblicato", () => {
    const { api } = creaSandbox({ concept: {}, element: { fiore: { concept: null, pubblicatoSu: "natura", archi: [], giorni: 0 } } });
    const msg = api.messaggioEliminaElement("fiore", "Fiore");
    expect(msg).toContain("natura");
    expect(msg.toLowerCase()).toContain("pool di produzione");
  });

  it("riporta archi e giorni generati e dice che l'archivio resta", () => {
    const { api } = creaSandbox({ concept: {}, element: { fiore: { concept: null, pubblicatoSu: null, archi: ["a1", "a2"], giorni: 10 } } });
    const msg = api.messaggioEliminaElement("fiore", "Fiore");
    expect(msg).toContain("2 archi");
    expect(msg).toContain("10 giorni");
    expect(msg.toLowerCase()).toContain("archivio");
  });

  it("dice esplicitamente 'mai generato' e non pubblicato, senza un ambiguo '0 arc'", () => {
    const { api } = creaSandbox({ concept: {}, element: { fiore: { concept: null, pubblicatoSu: null, archi: [], giorni: 0 } } });
    const msg = api.messaggioEliminaElement("fiore", "Fiore");
    expect(msg.toLowerCase()).toContain("non è pubblicato su nessun canale");
    expect(msg).toContain("mai generato");
    expect(msg).not.toContain("0 arc");
  });
});

describe("tab-catalogo: messaggioEliminaConcept", () => {
  it("elenca gli element nativi che bloccherebbero la cancellazione lato Worker", () => {
    const { api } = creaSandbox({ concept: { spirale: { elementiNativi: ["canoa", "faro"], archi: [], giorni: 0, canaliProduzione: [] } }, element: {} });
    const msg = api.messaggioEliminaConcept("spirale", "Spirale");
    expect(msg).toContain("canoa");
    expect(msg).toContain("faro");
  });
});

describe("tab-catalogo: AP.store.usi assente o incompleto", () => {
  it("messaggioEliminaElement ritorna comunque una stringa non vuota col nome, senza lanciare", () => {
    const { api } = creaSandbox(undefined);
    expect(() => {
      const msg = api.messaggioEliminaElement("fiore", "Fiore");
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain("Fiore");
    }).not.toThrow();
  });

  it("messaggioEliminaConcept ritorna comunque una stringa non vuota col nome, senza lanciare", () => {
    const { api } = creaSandbox(undefined);
    expect(() => {
      const msg = api.messaggioEliminaConcept("spirale", "Spirale");
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain("Spirale");
    }).not.toThrow();
  });
});
