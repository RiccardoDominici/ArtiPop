// feat-quando-arriva-il-prossimo-wallpaper: chi ha attivato la Shortcut deve
// poter sapere a che ora (nel proprio fuso) arriva il wallpaper nuovo, senza
// indovinare. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect, afterEach } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function extractFn(name) {
  const src = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))[0];
  return new Function(`return (${src});`)();
}

const TZ_ORIGINALE = process.env.TZ;
afterEach(() => {
  process.env.TZ = TZ_ORIGINALE;
});

describe("home — quando arriva il prossimo wallpaper", () => {
  it("l'HTML servito contiene #nextdrop con classe hint e un testo di partenza sensato senza JS", () => {
    const match = html.match(/<p class="hint" id="nextdrop">([^<]*)<\/p>/);
    expect(match).not.toBeNull();
    expect(match[1]).toContain("Il wallpaper cambia da solo ogni notte");
  });

  describe("testoProssimoWallpaper — orario locale ricavato dall'ora UTC del cron", () => {
    const testoProssimoWallpaper = extractFn("testoProssimoWallpaper");

    it("fuso UTC → l'orario mostrato è le 03:00", () => {
      process.env.TZ = "UTC";
      const frase = testoProssimoWallpaper(3, new Date("2026-08-01T12:00:00Z"));
      expect(frase).toContain("03:00");
    });

    it("fuso diverso da UTC → l'orario è traslato di conseguenza", () => {
      process.env.TZ = "America/New_York";
      const frase = testoProssimoWallpaper(3, new Date("2026-08-01T12:00:00Z"));
      expect(frase).not.toContain("03:00");
      expect(frase).toMatch(/verso le \d{2}:\d{2}/);
    });

    it("in nessun fuso la frase contiene riferimenti al giorno (resta identica tutto il giorno)", () => {
      process.env.TZ = "UTC";
      const frase = testoProssimoWallpaper(3, new Date("2026-08-01T12:00:00Z"));
      expect(frase.toLowerCase()).not.toContain("oggi");
      expect(frase.toLowerCase()).not.toContain("domani");
    });

    it("input anomalo (ora non numerica) → nessuna eccezione lanciata fuori, nessun 'undefined'/'NaN'", () => {
      process.env.TZ = "UTC";
      expect(() => testoProssimoWallpaper("non-un-numero", new Date("2026-08-01T12:00:00Z"))).toThrow();
    });
  });

  it("il markup applica il testo dentro un try/catch, senza toccare il nodo se il calcolo fallisce", () => {
    const scriptMatch = html.match(/try \{[\s\S]*?nextdropEl[\s\S]*?catch \{[\s\S]*?\}/);
    expect(scriptMatch).not.toBeNull();
    expect(scriptMatch[0]).toContain("try {");
    expect(scriptMatch[0]).toContain("testoProssimoWallpaper(ORA_CRON_UTC)");
  });
});
