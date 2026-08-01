// feat-l-aiuto-dice-se-il-canale-e-fermo: renderHelpPage(stato) è pura e
// testabile senza env — stato arriva già nella forma [{ id, nome, aggiornato,
// giorniDiRitardo }] (la stessa di /health). Nessun argomento → pagina di
// sempre, invariata, per non rompere aiuto-contenuto.test.js e affini.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage(stato)", () => {
  it("senza argomento: nessun blocco stato canali nell'HTML", () => {
    const html = renderHelpPage();
    expect(html).not.toContain("data-stato-canali");
  });

  it("stato vuoto ([]): nessun blocco (nessun contenitore vuoto)", () => {
    const html = renderHelpPage([]);
    expect(html).not.toContain("data-stato-canali");
  });

  it("canale aggiornato oggi: nome e 'aggiornato oggi' nel markup", () => {
    const html = renderHelpPage([{ id: "natura", nome: "Natura", aggiornato: true, giorniDiRitardo: 0 }]);
    expect(html).toContain("data-stato-canali");
    expect(html).toContain("Natura");
    expect(html).toContain("aggiornato oggi");
  });

  it("giorniDiRitardo: 3 → 'fermo da 3 giorni'", () => {
    const html = renderHelpPage([{ id: "citta", nome: "Città", aggiornato: false, giorniDiRitardo: 3 }]);
    expect(html).toContain("fermo da 3 giorni");
  });

  it("giorniDiRitardo: 1 → 'fermo da ieri' (non 'fermo da 1 giorni')", () => {
    const html = renderHelpPage([{ id: "citta", nome: "Città", aggiornato: false, giorniDiRitardo: 1 }]);
    expect(html).toContain("fermo da ieri");
    expect(html).not.toContain("fermo da 1 giorni");
  });

  it("giorniDiRitardo: null (mai generato) → 'nessuna immagine ancora'", () => {
    const html = renderHelpPage([{ id: "quiete", nome: "Quiete", aggiornato: false, giorniDiRitardo: null }]);
    expect(html).toContain("nessuna immagine ancora");
  });

  it("il blocco compare prima del primo <h2 data-sezione=\"problemi\">", () => {
    const html = renderHelpPage([{ id: "natura", nome: "Natura", aggiornato: true, giorniDiRitardo: 0 }]);
    const indiceBlocco = html.indexOf("data-stato-canali");
    const indiceProblemi = html.indexOf('<h2 data-sezione="problemi">');
    expect(indiceBlocco).toBeGreaterThan(-1);
    expect(indiceProblemi).toBeGreaterThan(-1);
    expect(indiceBlocco).toBeLessThan(indiceProblemi);
  });

  it("un nome con caratteri speciali esce escapato, mai HTML grezzo", () => {
    const html = renderHelpPage([{ id: "x", nome: "<b>x", aggiornato: true, giorniDiRitardo: 0 }]);
    expect(html).not.toContain("<b>x");
    expect(html).toContain("&lt;b&gt;x");
  });
});
