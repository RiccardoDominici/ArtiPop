// feat-le-date-d-archivio-si-leggono-in-italiano: la data d'archivio si
// legge in forma estesa italiana dentro un <time datetime="YYYY-MM-DD">,
// coerente con l'anteprima social (dataEstesaItaliana, head.js) — invece
// della chiave calendario grezza mostrata finora.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio, renderArchiviPage } from "../../src/archivi.js";

describe("date d'archivio in forma leggibile", () => {
  it("renderGiornoArchivio: intestazione in forma estesa italiana dentro <time>", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2026-08-02", date: ["2026-08-02"] });
    expect(html).toContain('<time datetime="2026-08-02">2 agosto 2026</time>');
    expect(html).not.toContain('<p class="sub">2026-08-02</p>');
  });

  it("renderArchiviPage: intervallo prima → ultima in forma estesa italiana, ciascuna col proprio datetime", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 100, prima: "2026-01-31", ultima: "2026-08-02" },
    ]);
    expect(html).toContain('<time datetime="2026-01-31">31 gennaio 2026</time>');
    expect(html).toContain('<time datetime="2026-08-02">2 agosto 2026</time>');
    expect(html).toContain(
      '<span class="intervallo"><time datetime="2026-01-31">31 gennaio 2026</time> → <time datetime="2026-08-02">2 agosto 2026</time></span>',
    );
  });

  it("guardia: data non valida non genera mai 'Invalid Date' né 'NaN', la pagina si compone comunque", () => {
    const htmlNonData = renderGiornoArchivio({ id: "island", data: "non-una-data", date: [] });
    expect(htmlNonData).not.toContain("Invalid Date");
    expect(htmlNonData).not.toContain("NaN");
    expect(htmlNonData).toContain("non-una-data");

    const htmlNull = renderGiornoArchivio({ id: "island", data: null, date: [] });
    expect(htmlNull).not.toContain("Invalid Date");
    expect(htmlNull).not.toContain("NaN");
  });

  it("contratto §2.2: un solo <script>, quello delle scorciatoie da tastiera, nessuna fetch( nell'HTML del giorno d'archivio", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2026-08-02", date: ["2026-08-02"] });
    expect((html.match(/<script/g) || []).length).toBe(1); // solo le scorciatoie da tastiera (§2.2)
    expect(html).not.toContain("fetch(");
  });
});
