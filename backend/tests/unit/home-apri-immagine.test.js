// feat-apri-il-wallpaper-del-giorno-a-schermo-intero: la home deve esporre un
// link che apre il file vero del giorno mostrato, alla sua risoluzione piena
// (srcFor(), la stessa URL già usata dal crossfade del mockup). Test puro su
// renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — apri l'immagine del giorno a schermo intero", () => {
  const html = renderPage({}, "https://example.com", "2026-08-01");

  it("il markup espone l'ancora #dayopen accanto a #dayshare, pill ghost, target=_blank, rel=noopener, inizialmente nascosta", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const aTag = journey.match(/<a class="btn ghost" id="dayopen"[^>]*>/)[0];
    expect(aTag).toContain('target="_blank"');
    expect(aTag).toContain('rel="noopener"');
    expect(aTag).toContain("hidden");
  });

  it("l'ancora segue lo stato di #daynav e #dayshare: nascosta/mostrata insieme in renderJourney", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("daynavEl.hidden = !hasJourney");
    expect(fnBody).toContain("dayshareEl.hidden = !hasJourney");
    expect(fnBody).toContain("dayopenEl.hidden = !hasJourney");
  });

  it("updateDayNav aggancia dayopen.href a srcFor(chId, date, date === TODAY)", () => {
    const fnBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayopenEl.href = srcFor(chId, date, date === TODAY)");
  });

  it("srcFor produce /w/<canale> (con cache-buster) per oggi, /w/<canale>?date=<data> per un giorno d'archivio", () => {
    const fnBody = html.match(/function srcFor\([\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/isToday \? `\/w\/\$\{chId\}\?v=\$\{TODAY\}` : `\/w\/\$\{chId\}\?date=\$\{date\}`/);
  });

  it("la pagina non contiene mai ?date=undefined né date=null", () => {
    expect(html).not.toContain("?date=undefined");
    expect(html).not.toContain("date=null");
  });

  it("nessuna nuova regola CSS per #dayopen: riusa .btn e .btn.ghost esistenti", () => {
    expect(html).not.toMatch(/#dayopen\s*\{/);
  });
});
