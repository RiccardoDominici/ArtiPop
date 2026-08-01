// feat-salva-il-wallpaper-con-un-nome-che-si-capisce: accanto a "apri l'immagine"
// la home deve esporre un link "salva l'immagine" che punta allo stesso file con
// ?dl=1, per ottenere un nome file parlante invece del blob "natura" senza
// estensione. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — salva l'immagine con un nome che si capisce", () => {
  const html = renderPage({}, "https://example.com", "2026-08-01");

  it("il markup espone l'ancora #daysave accanto a #dayopen, pill ghost, inizialmente nascosta", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const aTag = journey.match(/<a class="btn ghost" id="daysave"[^>]*>/)[0];
    expect(aTag).toContain("hidden");
    expect(journey).toContain("salva l'immagine");
  });

  it("l'ancora segue lo stato di #dayopen: nascosta/mostrata insieme in renderJourney", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayopenEl.hidden = !hasJourney");
    expect(fnBody).toContain("daysaveEl.hidden = !hasJourney");
  });

  it("updateDayNav aggancia daysave.href allo stesso srcFor() di dayopen più ?dl=1", () => {
    const fnBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayopenEl.href = srcFor(chId, date, date === TODAY)");
    expect(fnBody).toContain(
      'daysaveEl.href = srcFor(chId, date, date === TODAY) + "&dl=1"'
    );
  });

  it("nessuna nuova regola CSS per #daysave: riusa .btn e .btn.ghost esistenti", () => {
    expect(html).not.toMatch(/#daysave\s*\{/);
  });
});
