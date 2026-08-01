// feat-torna-all-arco-in-corso: comando speculare a "arco precedente" —
// dopo essere scesi in un arco passato, deve esistere un modo per risalire
// fino all'arco in corso senza ricaricare la pagina. Test puro su
// renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — comando 'arco successivo'", () => {
  it("il markup espone il bottone #arcnext accanto a #arcprev, pill ghost già canonica, inizialmente nascosto", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const arcprevIdx = journey.indexOf('id="arcprev"');
    const arcnextIdx = journey.indexOf('id="arcnext"');
    expect(arcprevIdx).toBeGreaterThan(-1);
    expect(arcnextIdx).toBeGreaterThan(arcprevIdx);
    const btnTag = journey.match(/<button class="btn ghost" id="arcnext"[^>]*>/)[0];
    expect(btnTag).toContain("hidden");
  });

  it("updateArcNav è l'unica funzione che governa sia #arcprev sia #arcnext", () => {
    const fnBody = html.match(/function updateArcNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("arcPrevEl.hidden = idx >= arcs.length - 1");
    expect(fnBody).toContain("arcNextEl.hidden = idx <= 0");
    // Nessuna funzione updateArcPrev residua: il vecchio nome non deve
    // sopravvivere come riferimento orfano dopo il rename.
    expect(html).not.toMatch(/function updateArcPrev\(/);
    expect(html).not.toMatch(/[^.\w]updateArcPrev\(/);
  });

  it("renderJourney e goToPreviousArc chiamano updateArcNav, non un updateArcPrev orfano", () => {
    const renderJourneyBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(renderJourneyBody).toContain("updateArcNav(chId)");
    const goToPreviousArcBody = html.match(/function goToPreviousArc\([\s\S]*?\n\}/)[0];
    expect(goToPreviousArcBody).toContain("updateArcNav(chId)");
  });

  it("goToNextArc riporta la finestra all'arco immediatamente più recente, mai unendo due archi, e mostra il giorno più recente del nuovo arco", () => {
    const fnBody = html.match(/function goToNextArc\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("if (idx <= 0) return");
    expect(fnBody).toContain("arcIndexCache[chId] = idx - 1");
    expect(fnBody).toContain("archiveCache[chId] = arcs[idx - 1]");
    // Mai una fusione fra l'arco corrente e quello successivo.
    expect(fnBody).not.toMatch(/archiveCache\[chId\]\.concat/);
    expect(fnBody).not.toMatch(/\.\.\.archiveCache\[chId\]/);
    expect(fnBody).toContain("stopPlayback()");
    expect(fnBody).toContain("updateArcNav(chId)");
    expect(fnBody).toContain("previewDay(chId, d, d === TODAY)");
    expect(html).toContain('arcNextEl.addEventListener("click", goToNextArc)');
  });

  it("la guardia idx <= 0 impedisce di salire oltre l'arco in corso", () => {
    const fnBody = html.match(/function goToNextArc\([\s\S]*?\n\}/)[0];
    const guardIdx = fnBody.indexOf("if (idx <= 0) return");
    const decrementIdx = fnBody.indexOf("arcIndexCache[chId] = idx - 1");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(decrementIdx); // la guardia precede la mutazione
  });
});
