// feat-leggi-la-storia-dell-arco: la home mostra le tappe dell'arco
// visualizzato una sotto l'altra, con salto diretto al giorno toccato.
// Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — comando 'leggi la storia'", () => {
  it("il markup espone #storytoggle e #arcstory nella sezione .journey, entrambi nascosti", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const toggleTag = journey.match(/<button class="btn ghost" id="storytoggle"[^>]*>/)[0];
    expect(toggleTag).toContain("hidden");
    const storyTag = journey.match(/<div class="arcstory" id="arcstory"[^>]*>/)[0];
    expect(storyTag).toContain("hidden");
  });

  it("renderArcStory è agganciata a renderJourney, goToPreviousArc e goToNextArc", () => {
    const renderJourneyBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(renderJourneyBody).toContain("renderArcStory(chId)");
    const goToPreviousArcBody = html.match(/function goToPreviousArc\([\s\S]*?\n\}/)[0];
    expect(goToPreviousArcBody).toContain("renderArcStory(chId)");
    const goToNextArcBody = html.match(/function goToNextArc\([\s\S]*?\n\}/)[0];
    expect(goToNextArcBody).toContain("renderArcStory(chId)");
  });

  it("le righe sono costruite con createElement/textContent, mai testoTappa o nomi di catalogo dentro innerHTML", () => {
    const fnBody = html.match(/function renderArcStory\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("document.createElement");
    expect(fnBody).toContain("g.testoTappa");
    expect(fnBody).toContain(".textContent");
    // L'unico innerHTML nella funzione è lo svuotamento iniziale, mai testo del catalogo.
    const innerHTMLUses = fnBody.match(/\.innerHTML\s*=/g) || [];
    expect(innerHTMLUses.length).toBe(1);
    expect(fnBody).toContain('arcstoryEl.innerHTML = ""');
  });

  it("i giorni senza testoTappa vengono omessi, mai una riga 'undefined'", () => {
    const fnBody = html.match(/function renderArcStory\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("if (!g || !g.testoTappa) continue");
  });

  it("l'elenco si legge dal più vecchio al più recente senza mutare la cache (copia, non reverse in place)", () => {
    const fnBody = html.match(/function renderArcStory\([\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/\.slice\(\)\.reverse\(\)/);
    expect(fnBody).not.toMatch(/arcsCache\[chId\]\[idx\]\.reverse\(\)/);
    expect(fnBody).not.toMatch(/archiveCache\[chId\]\.reverse\(\)/);
  });

  it("il click su una riga chiama stopPlayback prima di previewDay", () => {
    const fnBody = html.match(/function renderArcStory\([\s\S]*?\n\}/)[0];
    const clickHandler = fnBody.match(/row\.addEventListener\("click", \(\) => \{[\s\S]*?\}\);/)[0];
    const stopIdx = clickHandler.indexOf("stopPlayback()");
    const previewIdx = clickHandler.indexOf("previewDay(chId, d, d === TODAY)");
    expect(stopIdx).toBeGreaterThan(-1);
    expect(previewIdx).toBeGreaterThan(stopIdx);
  });

  it("la riga mostrata viene evidenziata da updateArcStoryHighlight, chiamata da updateDayNav ad ogni cambio di giorno", () => {
    const updateDayNavBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(updateDayNavBody).toContain("updateArcStoryHighlight(date)");
    const highlightBody = html.match(/function updateArcStoryHighlight\([\s\S]*?\n\}/)[0];
    expect(highlightBody).toContain('classList.toggle("on", row.dataset.date === date)');
  });

  it("senza journey (hasJourney falso) sia #storytoggle sia #arcstory restano nascosti", () => {
    const renderJourneyBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    const guardBlock = renderJourneyBody.match(/if \(!hasJourney\) \{[\s\S]*?\n  \}/)[0];
    expect(guardBlock).toContain("storytoggleEl.hidden = true");
    expect(guardBlock).toContain("arcstoryEl.hidden = true");
  });

  it("nessun comando apre un blocco vuoto: storytoggle resta nascosto se non ci sono righe", () => {
    const fnBody = html.match(/function renderArcStory\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("storytoggleEl.hidden = !hasRows");
    expect(fnBody).toContain("if (!hasRows) arcstoryEl.hidden = true");
  });
});
