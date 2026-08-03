// feat-il-wallpaper-d-archivio-si-apre-a-grandezza-piena: sulla home lo stesso
// bisogno è già risolto da <a id="dayopen" target="_blank" rel="noopener">
// (feat-apri-il-wallpaper-del-giorno-a-schermo-intero); qui replichiamo lo
// stesso gesto per /archivi/<id>, dove il wallpaper resta l'unico motivo per
// cui si apre la pagina.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — apri il wallpaper a grandezza piena", () => {
  it("l'<img> della <figure class=\"foto\"> è avvolta da un <a> verso /w/<id>?date=<data>", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const figureIdx = html.indexOf('<figure class="foto"');
    const aIdx = html.indexOf('<a class="apri"', figureIdx);
    const imgIdx = html.indexOf("<img", aIdx);
    const aCloseIdx = html.indexOf("</a>", imgIdx);
    const figureCloseIdx = html.indexOf("</figure>", figureIdx);
    expect(figureIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeGreaterThan(figureIdx);
    expect(imgIdx).toBeGreaterThan(aIdx);
    expect(aCloseIdx).toBeGreaterThan(imgIdx);
    expect(aCloseIdx).toBeLessThan(figureCloseIdx);
    const linkTag = html.slice(aIdx, html.indexOf(">", aIdx) + 1);
    expect(linkTag).toContain('href="/w/island?date=2025-01-02"');
    expect(linkTag).toContain('target="_blank"');
    expect(linkTag).toContain('rel="noopener"');
  });

  it("il link ha un aria-label non vuoto che cita id e data", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const match = html.match(/<a class="apri"[^>]*aria-label="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(match[1].length).toBeGreaterThan(0);
    expect(match[1]).toContain("island");
    expect(match[1]).toContain("2025-01-02");
  });

  it("id e data con caratteri da escapare non rompono href/aria-label: nessuna iniezione", () => {
    const html = renderGiornoArchivio({
      id: '<b>"x', data: '2025-01-01&x=<y>"', date: ['2025-01-01&x=<y>"'],
    });
    const match = html.match(/<a class="apri"[^>]*>/);
    expect(match).not.toBeNull();
    const linkTag = match[0];
    const hrefMatch = linkTag.match(/href="([^"]*)"/);
    expect(hrefMatch).not.toBeNull();
    expect(hrefMatch[1]).not.toContain("<");
    expect(hrefMatch[1]).not.toContain('"');
    expect(linkTag).not.toContain("<b>");
    const ariaMatch = linkTag.match(/aria-label="([^"]*)"/);
    expect(ariaMatch).not.toBeNull();
    expect(ariaMatch[1]).not.toContain("<b>");
    expect(ariaMatch[1]).not.toContain('"x');
  });

  it("contratto §2.2: un solo <script>, quello delle scorciatoie da tastiera, e nessuna fetch( nell'HTML del giorno d'archivio", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1); // solo le scorciatoie da tastiera (§2.2)
    expect(html).not.toContain("fetch(");
  });

  it("l'immagine conserva loading, decoding e l'alt descrittivo esistente", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const imgMatch = html.match(/<img[^>]*>/);
    expect(imgMatch).not.toBeNull();
    const img = imgMatch[0];
    expect(img).toContain('loading="lazy"');
    expect(img).toContain('decoding="async"');
    const altMatch = img.match(/alt="([^"]*)"/);
    expect(altMatch).not.toBeNull();
    expect(altMatch[1].length).toBeGreaterThan(0);
  });
});
