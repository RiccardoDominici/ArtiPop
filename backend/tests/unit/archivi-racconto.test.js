// feat-il-giorno-d-archivio-racconta-la-sua-tappa: la pagina del giorno
// d'archivio aggiunge la riga del racconto (testoTappa) fra il soggetto e
// la figura, riusando il dato già presente in `soggetto` — zero letture KV
// in più, zero JS. Stesso schema di archivi-giorno.test.js.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — riga del racconto", () => {
  it("testoTappa valorizzato: la riga class=\"racconto\" compare col testo", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { testoTappa: "Oggi l'isola ha costruito il primo molo." },
    });
    expect(html).toContain('<p class="racconto">');
    expect(html).toContain("isola ha costruito il primo molo.</p>");
  });

  it("la riga del racconto sta dopo la riga del soggetto e prima della figure", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { elementNome: "Isola", conceptNome: "Costruzione", testoTappa: "Racconto del giorno." },
    });
    const idxSoggetto = html.indexOf('class="soggetto"');
    const idxRacconto = html.indexOf('class="racconto"');
    const idxFigure = html.indexOf('<figure class="foto"');
    expect(idxSoggetto).toBeGreaterThan(-1);
    expect(idxRacconto).toBeGreaterThan(idxSoggetto);
    expect(idxFigure).toBeGreaterThan(idxRacconto);
  });

  it("testoTappa assente: nessuna riga class=\"racconto\"", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain('class="racconto"');
  });

  it("testoTappa null: nessuna riga class=\"racconto\"", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { elementNome: "Isola", testoTappa: null },
    });
    expect(html).not.toContain('class="racconto"');
  });

  it("testoTappa stringa vuota: nessuna riga class=\"racconto\" (nessun paragrafo vuoto)", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { testoTappa: "" },
    });
    expect(html).not.toContain('class="racconto"');
  });

  it("testoTappa con <script> e &: l'output è sfuggito, nessuno <script> letterale", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { testoTappa: "<script>alert(1)</script> A & B" },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("l'HTML della pagina ha un solo <script>, quello delle scorciatoie da tastiera, e nessuna fetch( anche con racconto presente", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { testoTappa: "Racconto del giorno." },
    });
    expect((html.match(/<script/g) || []).length).toBe(1); // solo le scorciatoie da tastiera (§2.2)
    expect(html).not.toContain("fetch(");
  });
});
