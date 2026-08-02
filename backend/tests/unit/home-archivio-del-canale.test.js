// feat-l-archivio-completo-del-canale-a-un-tocco: dalla home, un tocco deve
// aprire l'archivio permanente del canale mostrato (/archivi/<canale>),
// senza passare dall'elenco generale. Test puro su renderPage() — nessun
// binding, nessuna rete. Stesso stile di home-segui-il-feed.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — l'archivio completo del canale a un tocco", () => {
  it("il markup espone #archlink, pill ghost, dentro .journey, con href /archivi/<canale>", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01", null, "https://example.com/feed/natura.xml");
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    expect(journey).toMatch(
      /<a class="btn ghost" id="archlink" href="\/archivi\/natura">tutti i giorni di questo canale<\/a>/,
    );
  });

  it("renderPage non produce un href rotto (né null né undefined) e non lancia", () => {
    expect(() => renderPage({}, "https://example.com", "2026-08-01")).not.toThrow();
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const archlinkMatch = html.match(/<a class="btn ghost" id="archlink" href="([^"]*)"/);
    expect(archlinkMatch).not.toBeNull();
    expect(archlinkMatch[1]).not.toMatch(/null|undefined/);
    expect(archlinkMatch[1]).toMatch(/^\/archivi\/[a-z-]+$/);
  });

  it("lo script client aggiorna l'href di #archlink con encodeURIComponent(ch.id), a fianco di #feedlink", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const fnBody = html.match(/function updateChrome\(\)[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('document.getElementById("archlink")');
    expect(fnBody).toMatch(/if \(archlinkEl\)/);
    expect(fnBody).toContain('archlinkEl.href = "/archivi/" + encodeURIComponent(ch.id)');
  });
});
