// feat-i-motori-di-ricerca-trovano-anche-gli-archivi: copertura pura di
// renderSitemap() — vedi sitemap-rotta.test.js per la copertura end-to-end
// sulla rotta.
import { describe, it, expect } from "vitest";
import { renderSitemap } from "../../src/sitemap.js";

const ORIGIN = "https://artipop.test";

describe("renderSitemap", () => {
  it("contiene le tre voci fisse /, /aiuto, /archivi con l'origin passato", () => {
    const corpo = renderSitemap(ORIGIN, null);
    expect(corpo).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(corpo).toContain(`<loc>${ORIGIN}/aiuto</loc>`);
    expect(corpo).toContain(`<loc>${ORIGIN}/archivi</loc>`);
  });

  it("con due canali storici produce due <url> con <loc> giusto e <lastmod> pari alla loro ultima", () => {
    const storici = [
      { id: "quiete", ultima: "2026-01-15" },
      { id: "furore", ultima: "2026-02-03" },
    ];
    const corpo = renderSitemap(ORIGIN, storici);
    expect(corpo).toContain(`<loc>${ORIGIN}/archivi/quiete</loc><lastmod>2026-01-15</lastmod>`);
    expect(corpo).toContain(`<loc>${ORIGIN}/archivi/furore</loc><lastmod>2026-02-03</lastmod>`);
  });

  it("storici = null produce il documento con le sole voci fisse, urlset aperto e chiuso", () => {
    const corpo = renderSitemap(ORIGIN, null);
    expect(corpo).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(corpo.trim().endsWith("</urlset>")).toBe(true);
    const occorrenze = corpo.match(/<url>/g) || [];
    expect(occorrenze.length).toBe(3);
  });

  it("un canale con id contenente un carattere da escapare non produce XML rotto", () => {
    const storici = [{ id: "sole&luna", ultima: "2026-03-01" }];
    const corpo = renderSitemap(ORIGIN, storici);
    expect(corpo).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("una voce senza ultima viene emessa senza lastmod, non scartata", () => {
    const storici = [{ id: "quiete", ultima: null }];
    const corpo = renderSitemap(ORIGIN, storici);
    expect(corpo).toContain(`<loc>${ORIGIN}/archivi/quiete</loc></url>`);
    expect(corpo).not.toContain("<lastmod>null</lastmod>");
  });

  it("nessuna rotta di servizio compare nel documento", () => {
    const storici = [{ id: "quiete", ultima: "2026-01-15" }];
    const corpo = renderSitemap(ORIGIN, storici);
    for (const rotta of ["/tuning", "/api/", "/health", "/lab/"]) {
      expect(corpo).not.toContain(rotta);
    }
  });
});
