// feat-aggiungi-artipop-alla-schermata-home: `renderManifest()` produce un
// web app manifest valido, e le quattro pagine HTML del worker (home,
// /aiuto, /archivi, pagina 404) espongono i tag d'installazione — vedi
// manifest-rotta.test.js per la copertura end-to-end sulle rotte.
import { describe, it, expect } from "vitest";
import { renderManifest, iconaSvg } from "../../src/manifest.js";
import { renderPage } from "../../src/page.js";
import { renderArchiviPage } from "../../src/archivi.js";
import { renderHelpPage, renderPaginaNonTrovata } from "../../src/help.js";

describe("renderManifest", () => {
  it("produce JSON valido con i campi attesi", () => {
    const json = JSON.parse(renderManifest());

    expect(json.name).toBe("ArtiPop");
    expect(json.short_name).toBe("ArtiPop");
    expect(json.start_url).toBe("/");
    expect(json.display).toBe("standalone");
    expect(json.theme_color).toBe("#0a0b10");
    expect(json.background_color).toBe("#0a0b10");
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThan(0);
    expect(json.icons[0].src).toBe("/icona.svg");
    expect(json.icons[0].type).toBe("image/svg+xml");
  });

  it("shortcuts contiene Archivi storici e Aiuto, in quest'ordine, dentro scope", () => {
    const json = JSON.parse(renderManifest());

    expect(Array.isArray(json.shortcuts)).toBe(true);
    expect(json.shortcuts.length).toBe(2);

    const [archivi, aiuto] = json.shortcuts;
    expect(archivi.url).toBe("/archivi");
    expect(aiuto.url).toBe("/aiuto");

    for (const voce of json.shortcuts) {
      expect(voce.name.length).toBeGreaterThan(0);
      expect(voce.short_name.length).toBeGreaterThan(0);
      expect(voce.url.startsWith(json.scope)).toBe(true);
    }
  });

  it("il campo shortcuts non cambia i campi preesistenti (nessuna regressione sull'installabilità)", () => {
    const json = JSON.parse(renderManifest());

    expect(json.name).toBe("ArtiPop");
    expect(json.start_url).toBe("/");
    expect(json.scope).toBe("/");
    expect(json.display).toBe("standalone");
    expect(json.background_color).toBe("#0a0b10");
    expect(json.theme_color).toBe("#0a0b10");
    expect(json.icons).toEqual([
      {
        src: "/icona.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any maskable",
      },
    ]);
  });
});

describe("iconaSvg", () => {
  it("è un markup SVG vero (non URL-encoded)", () => {
    const svg = iconaSvg();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#0a0b10");
  });
});

describe("tag d'installazione sulle quattro pagine HTML", () => {
  const pagine = {
    "home (renderPage)": renderPage({}, "https://artipop.example", "2026-08-01"),
    "/aiuto (renderHelpPage)": renderHelpPage(),
    "/archivi (renderArchiviPage)": renderArchiviPage([]),
    "pagina 404 (renderPaginaNonTrovata)": renderPaginaNonTrovata(),
  };

  for (const [nome, html] of Object.entries(pagine)) {
    it(`${nome} contiene rel="manifest" e theme-color esattamente una volta`, () => {
      const manifestMatches = html.match(/rel="manifest"/g) || [];
      const themeColorMatches = html.match(/name="theme-color"/g) || [];
      expect(manifestMatches.length).toBe(1);
      expect(themeColorMatches.length).toBe(1);
      expect(html).toContain('href="/manifest.webmanifest"');
    });
  }
});
