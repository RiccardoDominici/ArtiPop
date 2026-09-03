// feat-mio-scarica-scarta-cambia-canale: 👍 / swipe a destra sul canale
// in cima scarica la Shortcut e scende al tutorial (#setup), 👎 / swipe a
// sinistra cambia davvero canale (flyOut). Test puro su renderPage() —
// nessun binding, nessuna rete, stessa tecnica dei test home-*.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — Mio scarica, Scarta cambia canale", () => {
  it("scegliCanale esiste: clicca #dlShortcut e scorre a #setup", () => {
    const fnBody = html.match(/function scegliCanale\(\) \{[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('document.getElementById("dlShortcut")');
    expect(fnBody).toContain("dl.click()");
    expect(fnBody).toContain('document.getElementById("setup")');
    expect(fnBody).toContain("scrollIntoView");
  });

  it("advance(1) chiama scegliCanale, advance(-1) vola via con flyOut", () => {
    const fnBody = html.match(/function advance\(dir\) \{[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("if (dir > 0) { scegliCanale(); return; }");
    expect(fnBody).toContain("flyOut(top, dir)");
  });

  it("il drag a destra Sceglie (snap back + scegliCanale), a sinistra Scarta (flyOut)", () => {
    const fnBody = html.match(
      /function agganciaDrag\(el\) \{[\s\S]*?\n\}/
    )[0];
    expect(fnBody).toContain("if (dx > threshold) { card.style.transform =");
    expect(fnBody).toContain("scegliCanale();");
    expect(fnBody).toContain("else if (dx < -threshold) flyOut(card, -1);");
  });

  it("i pulsanti e le frecce passano ancora da advance", () => {
    expect(html).toContain('document.getElementById("next").addEventListener("click", () => advance(1));');
    expect(html).toContain('document.getElementById("prev").addEventListener("click", () => advance(-1));');
    expect(html).toContain('if (e.key === "ArrowRight") advance(1);');
    expect(html).toContain('if (e.key === "ArrowLeft") advance(-1);');
  });

  it("l'hint spiega i due versi: sinistra cambia, destra scarica", () => {
    expect(html).toContain("trascina a sinistra per cambiare canale");
    expect(html).toContain("per scaricare e attivare");
  });
});
