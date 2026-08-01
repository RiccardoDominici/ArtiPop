// POLISH (VISUAL_SPECS §5.5): i controlli tappabili della pagina /aiuto e delle
// pagine di servizio dello stesso modulo devono avere aree di tocco effettive
// ≥44×44 px su mobile. Copre solo spaziatura/box — nessun colore, dimensione di
// font o componente nuovo (design piatto invariato, VISUAL_SPECS §2).
import { describe, it, expect } from "vitest";
import {
  renderHelpPage,
  renderShortcutMancante,
  renderErroreTemporaneo,
  renderPaginaNonTrovata,
} from "../../src/help.js";

describe("renderHelpPage — aree di tocco ≥44×44 px (VISUAL_SPECS §5.5)", () => {
  const html = renderHelpPage();

  it("il permalink '.permalink' ha min-width e min-height di 44px, centrato flex", () => {
    const blocco = html.match(/\.permalink\s*\{[^}]*\}/)[0];
    expect(blocco).toContain("min-width: 44px");
    expect(blocco).toContain("min-height: 44px");
    expect(blocco).toContain("display: flex");
    expect(blocco).toContain("justify-content: center");
  });

  it("il link '.back' ha min-height di 44px", () => {
    const blocco = html.match(/\.back\s*\{[^}]*\}/)[0];
    expect(blocco).toContain("min-height: 44px");
  });

  it("i link del footer ('footer a') hanno un padding verticale ≥12px", () => {
    const blocco = html.match(/footer a\s*\{[^}]*\}/)[0];
    const match = blocco.match(/padding:\s*(\d+)px/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeGreaterThanOrEqual(12);
  });
});

describe("pagine di servizio — stesse regole di tocco di renderHelpPage", () => {
  const pagine = [
    ["renderShortcutMancante", renderShortcutMancante("natura")],
    ["renderErroreTemporaneo", renderErroreTemporaneo()],
    ["renderPaginaNonTrovata", renderPaginaNonTrovata()],
  ];

  it.each(pagine)("%s: i link del footer hanno un padding verticale ≥12px", (_nome, html) => {
    const blocco = html.match(/footer a\s*\{[^}]*\}/)[0];
    const match = blocco.match(/padding:\s*(\d+)px/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeGreaterThanOrEqual(12);
  });

  it("renderShortcutMancante: il link '.back' ha min-height di 44px", () => {
    const blocco = renderShortcutMancante("natura").match(/\.back\s*\{[^}]*\}/)[0];
    expect(blocco).toContain("min-height: 44px");
  });
});

describe("pagine di servizio e /aiuto — regressione visiva (VISUAL_SPECS §2)", () => {
  const pagine = [
    renderHelpPage(),
    renderShortcutMancante("natura"),
    renderErroreTemporaneo(),
    renderPaginaNonTrovata(),
  ];

  it.each(pagine)("mantiene i token visivi del sito e il design piatto", (html) => {
    expect(html).toContain("#f2f3f8");
    expect(html).toContain("#9aa3b8");
    expect(html).toContain("#8fd3ff");
    expect(html).toContain("max-width: 720px");
    expect(html).not.toContain("blur(");
    expect(html).not.toContain("gradient");
  });
});
