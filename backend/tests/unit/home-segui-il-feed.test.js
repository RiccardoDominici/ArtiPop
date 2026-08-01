// feat-segui-il-canale-che-stai-guardando: la home deve offrire un comando
// visibile che porta al feed RSS del canale mostrato, e sia il comando sia
// il link di autodiscovery nell'head devono seguire il canale quando
// l'utente sfoglia. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — segui col lettore di feed il canale che stai guardando", () => {
  it("il markup espone il comando #feedlink, pill ghost, dentro .actions, con href /feed/<canale>.xml", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01", null, "https://example.com/feed/natura.xml");
    const actionsMatch = html.match(/<div class="actions">[\s\S]*?<\/div>/);
    expect(actionsMatch).not.toBeNull();
    const actions = actionsMatch[0];
    expect(actions).toMatch(
      /<a class="btn ghost" id="feedlink" href="\/feed\/natura\.xml">segui col lettore di feed<\/a>/,
    );
  });

  it("il canale condiviso (og:*) non tocca il comando #feedlink: segue sempre il canale reso in cima al deck", () => {
    const condiviso = { canale: "geometria", data: "2026-07-30" };
    const html = renderPage({}, "https://example.com", "2026-08-01", condiviso, "https://example.com/feed/geometria.xml");
    expect(html).toContain('id="feedlink" href="/feed/natura.xml"');
  });

  it("renderPage senza feedUrl non produce un href rotto (né null né undefined) e non lancia", () => {
    expect(() => renderPage({}, "https://example.com", "2026-08-01")).not.toThrow();
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const feedlinkMatch = html.match(/<a class="btn ghost" id="feedlink" href="([^"]*)"/);
    expect(feedlinkMatch).not.toBeNull();
    expect(feedlinkMatch[1]).not.toMatch(/null|undefined/);
    expect(feedlinkMatch[1]).toMatch(/^\/feed\/[a-z-]+\.xml$/);
  });

  it("lo script client aggiorna l'href di #feedlink e del link di autodiscovery insieme a #dlShortcut", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const fnBody = html.match(/function updateChrome\(\)[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('document.getElementById("dlShortcut").href');
    expect(fnBody).toContain('document.getElementById("feedlink")');
    expect(fnBody).toContain('querySelector(\'link[type="application/rss+xml"]\')');
    expect(fnBody).toMatch(/if \(feedlinkEl\)/);
    expect(fnBody).toMatch(/if \(feedAutodiscoveryEl\)/);
  });
});
