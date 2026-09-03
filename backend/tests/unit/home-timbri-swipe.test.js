// feat-timbri-swipe: durante il trascinamento della card compaiono due timbri
// stile Tinder — "Scarica" a destra (Mio), "Scorri" a sinistra (Scarta) —
// con opacità proporzionale a dx, spenti a riposo e a fine swipe. Test puro
// su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — timbri swipe stile Tinder", () => {
  it("ogni card ha i due timbri, decorativi e senza emoji", () => {
    expect(html).toContain('class="swipe-stamp mio" aria-hidden="true">Scarica</div>');
    expect(html).toContain('class="swipe-stamp scarta" aria-hidden="true">Scorri</div>');
  });

  it("a riposo i timbri sono spenti (opacity 0, solo CSS)", () => {
    const css = html.match(/\.swipe-stamp \{[\s\S]*?\n  \}/)[0];
    expect(css).toContain("opacity: 0");
    expect(css).toContain("pointer-events: none");
  });

  it("mostraTimbri accende solo il timbro della direzione, in proporzione a dx", () => {
    const fnBody = html.match(/function mostraTimbri\(card, dx\) \{[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('card.querySelector(".swipe-stamp.mio")');
    expect(fnBody).toContain('card.querySelector(".swipe-stamp.scarta")');
    expect(fnBody).toContain("dx > 0 ? intensita : 0");
    expect(fnBody).toContain("dx < 0 ? intensita : 0");
  });

  it("pointermove pilota i timbri, end li spegne comunque vada", () => {
    const fnBody = html.match(/function agganciaDrag\(el\) \{[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("mostraTimbri(drag.el, drag.dx)");
    expect(fnBody).toContain("nascondiTimbri(card)");
  });
});
