// M6 (ROADMAP.md): /aiuto deve adottare i token visivi del sito (VISUAL_SPECS §2)
// senza cambiare design piatto, accordion o layout. Questo test copre solo
// l'allineamento dei token — non ridisegna, non tocca contenuti/testi.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — allineamento visivo al sito (M6)", () => {
  const html = renderHelpPage();

  it("usa il token --text del sito (#f2f3f8) per il testo primario", () => {
    expect(html).toContain("#f2f3f8");
  });

  it("non contiene più il vecchio colore testo disallineato (#e9e9f0)", () => {
    expect(html).not.toContain("#e9e9f0");
  });

  it("usa lo stack font del sito, incluso SF Pro Display", () => {
    expect(html).toContain("SF Pro Display");
  });

  it("mantiene #8fd3ff come colore link (extra ufficiale della pagina, da spec)", () => {
    expect(html).toContain("#8fd3ff");
  });

  it("usa il token --dim del sito (#9aa3b8) per il testo secondario", () => {
    expect(html).toContain("#9aa3b8");
  });

  it("mantiene il layout a colonna singola max-width:720px", () => {
    expect(html).toContain("max-width: 720px");
  });

  it("mantiene i marker dell'accordion ＋/－", () => {
    expect(html).toContain("＋");
    expect(html).toContain("－");
  });

  it("mantiene la variante 'hot' dell'accordion", () => {
    expect(html).toContain("item hot");
    expect(html).toContain(".item.hot");
  });

  it("resta design piatto: nessun blur/gradiente introdotto", () => {
    expect(html).not.toContain("blur(");
    expect(html).not.toContain("gradient");
  });
});
