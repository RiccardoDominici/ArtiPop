// Verifica che il form di concept/element della tab Catalogo non butti più via
// in silenzio le modifiche dell'utente quando un'azione ridisegna form/lista
// (click su un'altra riga, Nuovo, Duplica, cambio Concept↔Element, "↻ Carica
// dal Worker", "↻ Aggiorna" globale, salvataggio credenziali, cambio tab).
// Copre due cose distinte, stessa tecnica sandbox di tuning-ambiente.test.js:
// 1. la logica pura di confronto (js/util.js: AP.util.formSporco), valutata
//    in sandbox senza alcuno stub DOM, perché il suo corpo non ne usa;
// 2. il cablaggio — presenza di confermaAbbandono() ed esposizione su
//    AP.tabs.catalogo, invocazione da parte delle cinque azioni del passo 5 e
//    dei tre handler di app.js — verificato a grep sul sorgente.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (rel) => fileURLToPath(new URL(`../../../tuning/${rel}`, import.meta.url));

describe("AP.util.formSporco", () => {
  let AP;

  beforeAll(() => {
    const src = readFileSync(path("js/util.js"), "utf8");
    const window = {};
    const document = {};
    const fn = new Function("window", "document", "AP", `${src}\nreturn AP;`);
    AP = fn(window, document, {});
  });

  it("due istantanee identiche non sono sporche", () => {
    const snap = { "f-c-nome": "Spirale", "f-c-conserva": "the pot" };
    expect(AP.util.formSporco(snap, { ...snap })).toBe(false);
  });

  it("un valore cambiato rende il form sporco", () => {
    const iniziale = { "f-c-nome": "Spirale", "f-c-conserva": "the pot" };
    const corrente = { "f-c-nome": "Spirale mutata", "f-c-conserva": "the pot" };
    expect(AP.util.formSporco(iniziale, corrente)).toBe(true);
  });

  it("un campo aggiunto o rimosso rende il form sporco", () => {
    const iniziale = { "f-c-nome": "Spirale" };
    const conAggiunta = { "f-c-nome": "Spirale", "tappa-0": "una frase" };
    expect(AP.util.formSporco(iniziale, conAggiunta)).toBe(true);
    expect(AP.util.formSporco(conAggiunta, iniziale)).toBe(true);
  });

  it("iniziale null o undefined non è mai sporco, qualunque sia corrente", () => {
    expect(AP.util.formSporco(null, { "f-c-nome": "qualcosa" })).toBe(false);
    expect(AP.util.formSporco(undefined, { "f-c-nome": "qualcosa" })).toBe(false);
  });
});

describe("cablaggio tab Catalogo — guardia confermaAbbandono", () => {
  it("tab-catalogo.js definisce confermaAbbandono e la espone su AP.tabs.catalogo", () => {
    const src = readFileSync(path("js/tab-catalogo.js"), "utf8");
    expect(src).toMatch(/function confermaAbbandono\s*\(/);
    expect(src).toMatch(/AP\.tabs\.catalogo\s*=\s*\{[^}]*confermaAbbandono/s);
  });

  it("le cinque azioni che ridisegnano form/lista passano da confermaAbbandono()", () => {
    const src = readFileSync(path("js/tab-catalogo.js"), "utf8");
    // click di riga in entrambe le liste
    expect((src.match(/if \(confermaAbbandono\(\)\) selectConcept\(c\.id\)/g) || []).length).toBe(1);
    expect((src.match(/if \(confermaAbbandono\(\)\) selectElement\(e\.id\)/g) || []).length).toBe(1);
    // #catNew, #catDup, #catReload
    const iCatNew = src.indexOf('$("catNew").onclick');
    const iCatDup = src.indexOf('$("catDup").onclick');
    const iCatReload = src.indexOf('$("catReload").onclick');
    expect(iCatNew).toBeGreaterThan(-1);
    expect(iCatDup).toBeGreaterThan(-1);
    expect(iCatReload).toBeGreaterThan(-1);
    expect(src.slice(iCatNew, iCatNew + 120)).toMatch(/confermaAbbandono\(\)/);
    expect(src.slice(iCatDup, iCatDup + 120)).toMatch(/confermaAbbandono\(\)/);
    expect(src.slice(iCatReload, iCatReload + 120)).toMatch(/confermaAbbandono\(\)/);
    // .segbtn di #catTipoSel
    const iSegBtn = src.lastIndexOf('#catTipoSel .segbtn');
    expect(iSegBtn).toBeGreaterThan(-1);
    expect(src.slice(iSegBtn, iSegBtn + 200)).toMatch(/confermaAbbandono\(\)/);
  });

  it("app.js invoca la guardia (con optional chaining) in #globalReload, #saveCreds e nel click sulle .tab", () => {
    const src = readFileSync(path("js/app.js"), "utf8");
    const guardia = 'AP.tabs.catalogo?.confermaAbbandono?.()';
    const iTab = src.indexOf('.tab").forEach');
    const iSaveCreds = src.indexOf('$("saveCreds").onclick');
    const iGlobalReload = src.indexOf('$("globalReload").onclick');
    expect(iTab).toBeGreaterThan(-1);
    expect(iSaveCreds).toBeGreaterThan(-1);
    expect(iGlobalReload).toBeGreaterThan(-1);
    expect(src.slice(iTab, iSaveCreds)).toContain(guardia);
    expect(src.slice(iSaveCreds, iGlobalReload)).toContain(guardia);
    expect(src.slice(iGlobalReload)).toContain(guardia);
  });
});

describe("regressione — ordine di caricamento", () => {
  it("util.js resta caricato per primo in index.html, prima di tab-catalogo.js", () => {
    const html = readFileSync(path("index.html"), "utf8");
    const iUtil = html.indexOf('<script src="js/util.js">');
    const iTabCatalogo = html.indexOf('<script src="js/tab-catalogo.js">');
    expect(iUtil).toBeGreaterThan(-1);
    expect(iTabCatalogo).toBeGreaterThan(-1);
    expect(iTabCatalogo).toBeGreaterThan(iUtil);
  });
});
