// feat-il-promemoria-del-wallpaper-va-nel-calendario: la home deve offrire
// un link visibile che porta al promemoria da calendario. Test puro su
// renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — link al promemoria da calendario", () => {
  it("l'HTML contiene il link #icslink, dentro un .hint, con href verso /promemoria.ics?c=natura", () => {
    const html = renderPage({}, "https://example.com", "2026-08-08");
    expect(html).toMatch(
      /<p class="hint"><a id="icslink" href="\/promemoria\.ics\?c=natura">aggiungi il promemoria al calendario<\/a><\/p>/,
    );
  });

  it("il nodo #icslink sta dopo #nextdrop e dopo #netstate nell'HTML", () => {
    const html = renderPage({}, "https://example.com", "2026-08-08");
    const iNextdrop = html.indexOf('id="nextdrop"');
    const iNetstate = html.indexOf('id="netstate"');
    const iIcslink = html.indexOf('id="icslink"');
    expect(iNextdrop).toBeGreaterThan(-1);
    expect(iNetstate).toBeGreaterThan(iNextdrop);
    expect(iIcslink).toBeGreaterThan(iNetstate);
  });

  it("updateChrome() aggiorna l'href di #icslink con una guardia, seguendo il canale in cima", () => {
    const html = renderPage({}, "https://example.com", "2026-08-08");
    const fnBody = html.match(/function updateChrome\(\)[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('document.getElementById("icslink")');
    expect(fnBody).toMatch(/if \(icslinkEl\)/);
  });

  it("renderPage non lancia e l'href non contiene null/undefined", () => {
    expect(() => renderPage({}, "https://example.com", "2026-08-08")).not.toThrow();
    const html = renderPage({}, "https://example.com", "2026-08-08");
    const match = html.match(/<a id="icslink" href="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(match[1]).not.toMatch(/null|undefined/);
  });
});
