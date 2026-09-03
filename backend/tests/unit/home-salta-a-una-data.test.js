// feat-salta-al-giorno-che-cerchi: con centinaia di giorni in archivio le
// frecce e il dito muovono un giorno alla volta — serve un salto diretto a
// una data scelta. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — selettore di data 'salta al giorno che cerchi'", () => {
  it("il markup espone #dayPick, input nativo type=date con aria-label, dentro .journey, inizialmente nascosto", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const inputTag = journey.match(/<input type="date" class="daypick" id="dayPick"[^>]*>/)[0];
    expect(inputTag).toContain("hidden");
    expect(inputTag).toContain('aria-label="Vai a un giorno specifico dell\'archivio"');
  });

  it("il CSS di .daypick usa solo i token §1.1 e color-scheme: light", () => {
    const cssMatch = html.match(/\.daypick \{[\s\S]*?\n\s*\}/)[0];
    expect(cssMatch).toContain("var(--bg)");
    expect(cssMatch).toContain("var(--text)");
    expect(cssMatch).toContain("var(--dim)");
    expect(cssMatch).toContain("color-scheme: light");
  });

  it("updateDayNav valorizza min/max/value del selettore sull'unione delle date note del canale", () => {
    const fnBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("(arcsCache[chId] || []).flat()");
    expect(fnBody).toContain("dayPickEl.min = range.reduce");
    expect(fnBody).toContain("dayPickEl.max = range.reduce");
    expect(fnBody).toContain("dayPickEl.value = date");
  });

  it("renderJourney nasconde #dayPick insieme al resto di .daynav quando non c'è viaggio da sfogliare", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayPickEl.hidden = !hasJourney");
  });

  it("il listener 'change' di #dayPick salta all'arco che contiene la data scelta", () => {
    const listenerMatch = html.match(/dayPickEl\.addEventListener\("change", \(\) => \{[\s\S]*?\n\}\);/)[0];
    expect(listenerMatch).toContain("arcs.findIndex((arc) => arc.includes(d))");
    expect(listenerMatch).toContain("goToArc(chId, arcIdx, d)");
  });

  it("data senza wallpaper: nessun salto, messaggio umano, il campo torna al giorno mostrato", () => {
    const listenerMatch = html.match(/dayPickEl\.addEventListener\("change", \(\) => \{[\s\S]*?\n\}\);/)[0];
    expect(listenerMatch).toContain('if (arcIdx === -1) {');
    expect(listenerMatch).toContain('toast("nessun wallpaper per quel giorno")');
    expect(listenerMatch).toContain("dayPickEl.value = previewDate ?? TODAY");
    expect(listenerMatch).not.toMatch(/goToArc\(chId, -1/);
  });

  it("nessun riferimento orfano: dayPickEl è sia dichiarato sia usato", () => {
    expect(html).toContain('const dayPickEl = document.getElementById("dayPick")');
    expect(html.match(/dayPickEl/g).length).toBeGreaterThan(1);
  });
});
