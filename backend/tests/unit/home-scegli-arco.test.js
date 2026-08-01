// feat-scegli-l-arco-dall-elenco: la home mostra l'elenco di tutti gli archi
// del canale, tocco = salto diretto a quell'arco — senza più martellare
// "arco precedente" un passo alla volta. Test puro su renderPage() —
// nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — comando 'scegli l'arco'", () => {
  it("il markup espone #arcpick e #arclist dentro .journey, entrambi nascosti", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const pickTag = journey.match(/<button class="btn ghost" id="arcpick"[^>]*>/)[0];
    expect(pickTag).toContain("hidden");
    const listTag = journey.match(/<div class="arcstory" id="arclist"[^>]*>/)[0];
    expect(listTag).toContain("hidden");
  });

  it("renderArcList riusa .arcrow/.arcstory, nessuna classe o colore nuovi", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('"arcrow"');
    expect(html).not.toMatch(/#arclist\s*\{[^}]*color/);
  });

  it("le righe sono costruite con createElement/textContent, mai innerHTML con testo del catalogo", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("document.createElement");
    expect(fnBody).toContain(".textContent");
    // L'unico innerHTML nella funzione è lo svuotamento iniziale.
    const innerHTMLUses = fnBody.match(/\.innerHTML\s*=/g) || [];
    expect(innerHTMLUses.length).toBe(1);
    expect(fnBody).toContain('arcListEl.innerHTML = ""');
  });

  it("ogni riga mostra l'intervallo di date e il nome del concept, con ripiego testuale se manca", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("formatDayLabel(newest)");
    expect(fnBody).toContain("formatDayLabel(oldest)");
    expect(fnBody).toContain("g.conceptNome");
    expect(fnBody).toContain('concept || "arco senza titolo"');
  });

  it("l'elenco si legge nell'ordine nativo di arcsCache (dal più recente al più vecchio), senza mutare la cache", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).not.toMatch(/arcsCache\[chId\]\.reverse\(\)/);
    expect(fnBody).not.toMatch(/arcs\.reverse\(\)/);
    expect(fnBody).toContain("arcs.forEach((arc, i) =>");
  });

  it("#arcpick è visibile solo con più di un arco", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("arcPickEl.hidden = arcs.length <= 1");
  });

  it("il click su una riga chiama goToArc con l'indice dell'arco", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/row\.addEventListener\("click", \(\) => goToArc\(chId, i\)\)/);
  });

  it("goToArc rifiuta indici fuori range senza toccare le cache, e mai unisce due archi", () => {
    const fnBody = html.match(/function goToArc\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("if (idx < 0 || idx >= arcs.length) return");
    expect(fnBody).toContain("stopPlayback()");
    expect(fnBody).toContain("arcIndexCache[chId] = idx");
    expect(fnBody).toContain("archiveCache[chId] = arcs[idx]");
    expect(fnBody).toContain("renderArcStory(chId)");
    expect(fnBody).toContain("renderArcList(chId)");
    expect(fnBody).toContain("previewDay(chId, d, d === TODAY)");
    expect(fnBody).not.toMatch(/archiveCache\[chId\]\.concat/);
    expect(fnBody).not.toMatch(/\.\.\.archiveCache\[chId\]/);
  });

  it("il toggle #arcpick apre/chiude #arclist come #storytoggle fa con #arcstory", () => {
    expect(html).toMatch(/arcPickEl\.addEventListener\("click", \(\) => \{\s*arcListEl\.hidden = !arcListEl\.hidden;\s*\}\);/);
  });

  it("la riga dell'arco mostrato è evidenziata con .on al momento della costruzione", () => {
    const fnBody = html.match(/function renderArcList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('"arcrow" + (i === idx ? " on" : "")');
  });

  it("goToPreviousArc, goToNextArc e goToToday aggiornano anche #arclist chiamando renderArcList", () => {
    const goToPreviousArcBody = html.match(/function goToPreviousArc\([\s\S]*?\n\}/)[0];
    expect(goToPreviousArcBody).toContain("renderArcList(chId)");
    const goToNextArcBody = html.match(/function goToNextArc\([\s\S]*?\n\}/)[0];
    expect(goToNextArcBody).toContain("renderArcList(chId)");
    const goToTodayBody = html.match(/function goToToday\([\s\S]*?\n\}/)[0];
    expect(goToTodayBody).toContain("renderArcList(chId)");
  });

  it("senza journey (hasJourney falso) sia #arcpick sia #arclist restano nascosti", () => {
    const renderJourneyBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    const guardBlock = renderJourneyBody.match(/if \(!hasJourney\) \{[\s\S]*?\n  \}/)[0];
    expect(guardBlock).toContain("arcPickEl.hidden = true");
    expect(guardBlock).toContain("arcListEl.hidden = true");
  });

  it("renderArcList è agganciata a renderJourney, come renderArcStory", () => {
    const renderJourneyBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(renderJourneyBody).toContain("renderArcList(chId)");
  });
});
