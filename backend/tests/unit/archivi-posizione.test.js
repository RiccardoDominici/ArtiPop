// feat-il-giorno-d-archivio-dice-a-che-punto-della-storia-sei: la pagina
// del giorno d'archivio aggiunge la riga di posizione (arco · giorno ·
// tappa) fra il soggetto e il racconto, riusando `soggetto.arco`,
// `soggetto.giornoNellArco` e `soggetto.tappa` già letti dalla carta
// d'identità — zero letture KV in più, zero JS. Stesso schema di
// archivi-racconto.test.js.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — riga della posizione", () => {
  it("carta completa: arco mostrato base-uno, giorno e tappa invariati", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { arco: 1, giornoNellArco: 3, tappa: 2 },
    });
    expect(html).toContain("arco 2");
    expect(html).toContain("giorno 3");
    expect(html).toContain("tappa 2");
  });

  it("primo giorno del primo arco (tutti zero/uno): lo zero non è scambiato per assente", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { arco: 0, giornoNellArco: 1, tappa: 1 },
    });
    expect(html).toContain("arco 1");
    expect(html).toContain("giorno 1");
    expect(html).toContain("tappa 1");
  });

  it("giorno ricostruito/assente (arco/giornoNellArco/tappa: null): nessuna voce di posizione in più", () => {
    const conSoggetto = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { elementNome: "Isola", arco: null, giornoNellArco: null, tappa: null },
    });
    // con solo elementNome, l'unico class="soggetto" emesso è quello della
    // riga del soggetto stessa: nessuna riga di posizione aggiuntiva.
    expect(conSoggetto.split('class="soggetto"').length - 1).toBe(1);
    expect(conSoggetto).not.toContain("arco ");
    expect(conSoggetto).not.toContain("tappa ");

    const senzaSoggetto = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(senzaSoggetto).not.toContain('class="soggetto"');
    expect(senzaSoggetto).not.toContain("arco ");
    expect(senzaSoggetto).not.toContain("tappa ");
  });

  it("carta parziale (solo tappa): solo la voce disponibile, nessun separatore orfano", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { tappa: 3, arco: null, giornoNellArco: null },
    });
    const idxDiv = html.indexOf('<div class="soggetto">tappa 3</div>');
    expect(idxDiv).toBeGreaterThan(-1);
    expect(html).not.toContain("arco ");
    expect(html).not.toContain(" · tappa 3");
    expect(html).not.toContain("tappa 3 · ");
  });

  it("l'HTML della pagina ha un solo <script>, quello delle scorciatoie da tastiera, e nessuna fetch( anche con posizione presente", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { arco: 1, giornoNellArco: 3, tappa: 2 },
    });
    expect((html.match(/<script/g) || []).length).toBe(1); // solo le scorciatoie da tastiera (§2.2)
    expect(html).not.toContain("fetch(");
  });

  it("ordine: soggetto → posizione → racconto → figure", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: {
        elementNome: "Isola", conceptNome: "Costruzione",
        arco: 1, giornoNellArco: 3, tappa: 2,
        testoTappa: "Racconto del giorno.",
      },
    });
    const idxSoggetto = html.indexOf('class="soggetto"');
    const idxPosizione = html.indexOf('class="soggetto"', idxSoggetto + 1);
    const idxRacconto = html.indexOf('class="racconto"');
    const idxFigure = html.indexOf('<figure class="foto"');
    expect(idxSoggetto).toBeGreaterThan(-1);
    expect(idxPosizione).toBeGreaterThan(idxSoggetto);
    expect(idxRacconto).toBeGreaterThan(idxPosizione);
    expect(idxFigure).toBeGreaterThan(idxRacconto);
  });
});
