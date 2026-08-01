// Verifica che il tool di tuning non possa più consumare in silenzio i neuroni
// AI del cron di produzione dalla tab Lab. Copre due cose distinte:
// 1. la logica pura di classificazione ambiente (js/ambiente.js), valutata in
//    sandbox con solo gli stub minimi che il file usa davvero;
// 2. il cablaggio — ordine di caricamento in index.html e presenza del controllo
//    prima dell'unica chiamata a /lab/arc in tab-lab.js — verificato a grep sul
//    sorgente, perché non serve un DOM vero per controllare che le righe ci siano.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (rel) => fileURLToPath(new URL(`../../../tuning/${rel}`, import.meta.url));

describe("AP.ambiente.classifica", () => {
  let AP;

  beforeAll(() => {
    const src = readFileSync(path("js/ambiente.js"), "utf8");
    const window = { AP: { util: { DEFAULT_BASE: "https://artipop.riccardo-dominici.workers.dev" } } };
    const fn = new Function("window", "AP", `${src}\nreturn AP;`);
    AP = fn(window, window.AP);
  });

  it("riconosce un host di preview", () => {
    expect(AP.ambiente.classifica("https://artipop-preview.riccardo-dominici.workers.dev")).toBe("preview");
  });

  it("riconosce la base di produzione, con o senza slash finale", () => {
    expect(AP.ambiente.classifica("https://artipop.riccardo-dominici.workers.dev")).toBe("produzione");
    expect(AP.ambiente.classifica("https://artipop.riccardo-dominici.workers.dev/")).toBe("produzione");
  });

  it.each([
    ["stringa vuota", ""],
    ["null", null],
    ["stringa non-URL", "non è un url"],
    ["host terzo qualsiasi", "https://example.com"],
  ])("restituisce sconosciuto per %s", (_desc, input) => {
    expect(AP.ambiente.classifica(input)).toBe("sconosciuto");
  });
});

describe("cablaggio tab Lab", () => {
  it("index.html carica ambiente.js dopo util.js e prima di tab-lab.js", () => {
    const html = readFileSync(path("index.html"), "utf8");
    const iUtil = html.indexOf('<script src="js/util.js">');
    const iAmbiente = html.indexOf('<script src="js/ambiente.js">');
    const iTabLab = html.indexOf('<script src="js/tab-lab.js">');
    expect(iUtil).toBeGreaterThan(-1);
    expect(iAmbiente).toBeGreaterThan(-1);
    expect(iTabLab).toBeGreaterThan(-1);
    expect(iAmbiente).toBeGreaterThan(iUtil);
    expect(iTabLab).toBeGreaterThan(iAmbiente);
  });

  it("il controllo dell'ambiente precede l'unica chiamata a /lab/arc", () => {
    const src = readFileSync(path("js/tab-lab.js"), "utf8");
    const iControllo = src.indexOf("AP.ambiente.classifica(");
    // la chiamata vera e propria, non le menzioni di "/lab/arc" nei commenti sopra.
    const marcatoreChiamata = "api(`/lab/arc";
    const iChiamata = src.indexOf(marcatoreChiamata);
    expect(iControllo).toBeGreaterThan(-1);
    expect(iChiamata).toBeGreaterThan(-1);
    expect(iControllo).toBeLessThan(iChiamata);
    // la chiamata vera compare una volta sola nel file: nessun'altra da coprire.
    expect(src.indexOf(marcatoreChiamata, iChiamata + 1)).toBe(-1);
  });
});
