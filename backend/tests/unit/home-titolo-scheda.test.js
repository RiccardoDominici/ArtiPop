// feat-il-titolo-della-scheda-dice-cosa-guardi: <title> era una costante scritta
// una volta in renderPage(), mai toccata dal JS client — chi apriva due canali in
// due schede vedeva due etichette identiche, e un segnalibro su un giorno
// condiviso non diceva né canale né data. Test puro su renderPage() — nessun
// binding, nessuna rete — nello stile di home-torna-a-oggi.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — il titolo della scheda dice cosa guardi", () => {
  it("il markup contiene ancora un solo <title> server-side, con il testo di sempre", () => {
    const titles = html.match(/<title>[^<]*<\/title>/g);
    expect(titles).toHaveLength(1);
    expect(titles[0]).toBe("<title>ArtiPop — un wallpaper nuovo ogni giorno, che evolve</title>");
  });

  it("aggiornaTitolo esiste e legge il titolo base da document.title all'avvio, senza riscriverlo a mano", () => {
    expect(html).toContain("const TITOLO_BASE = document.title;");
    expect(html).toMatch(/function aggiornaTitolo\(/);
  });

  it("aggiornaTitolo distingue il caso con previewDate (usa fmtDataEstesa) da quello senza, con ripiego a TITOLO_BASE quando il canale manca", () => {
    const fnBody = html.match(/function aggiornaTitolo\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("fmtDataEstesa(previewDate)");
    expect(fnBody).toContain("document.title = TITOLO_BASE");
    expect(fnBody).toMatch(/if\s*\(!ch\)/);
  });

  it("l'assegnazione a document.title è protetta: un errore non può impedire l'aggiornamento della vista", () => {
    const fnBody = html.match(/function aggiornaTitolo\([\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/try\s*{/);
    expect(fnBody).toMatch(/catch/);
  });

  it("updateChrome chiama aggiornaTitolo()", () => {
    const fnBody = html.match(/function updateChrome\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("aggiornaTitolo()");
  });

  it("updateDayNav chiama aggiornaTitolo()", () => {
    const fnBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("aggiornaTitolo()");
  });
});
