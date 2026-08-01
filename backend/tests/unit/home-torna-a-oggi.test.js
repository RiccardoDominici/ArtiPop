// feat-torna-a-oggi-da-qualunque-giorno: nessun comando esistente riporta
// direttamente a oggi — stepDay muove di un giorno, goToNextArc di un arco.
// Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — comando 'torna a oggi'", () => {
  it("il markup espone il bottone #daytoday nella sezione .journey, pill ghost canonica, inizialmente nascosto", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const btnTag = journey.match(/<button class="btn ghost" id="daytoday"[^>]*>[^<]*<\/button>/)[0];
    expect(btnTag).toContain("hidden");
    expect(btnTag).toContain("torna a oggi");
  });

  it("goToToday azzera l'indice d'arco, riallinea archiveCache all'arco in corso e ferma la riproduzione", () => {
    const fnBody = html.match(/function goToToday\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("stopPlayback()");
    expect(fnBody).toContain("arcIndexCache[chId] = 0");
    expect(fnBody).toContain("archiveCache[chId] = arcsCache[chId][0]");
    expect(fnBody).toContain("updateArcNav(chId)");
    expect(fnBody).toContain("renderArcStory(chId)");
    expect(fnBody).toContain("previewDay(chId, d, d === TODAY)");
    // Ritorno diretto, non iterato: mai passando da stepDay.
    expect(fnBody).not.toMatch(/stepDay\(/);
  });

  it("goToToday gestisce il canale in ritardo: se oggi non è in archivio, si ferma sul giorno più recente disponibile", () => {
    const fnBody = html.match(/function goToToday\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dates.includes(TODAY)");
    expect(fnBody).toMatch(/dates\[0\]/);
  });

  it("il listener #daytoday chiama goToToday", () => {
    expect(html).toContain('dayTodayEl.addEventListener("click", goToToday)');
  });

  it("updateDayNav governa #daytoday: nascosto solo quando si guarda già oggi nell'arco in corso", () => {
    const fnBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain(
      "dayTodayEl.hidden = previewDate === null && (arcIndexCache[chId] ?? 0) === 0"
    );
  });

  it("nessun riferimento orfano: dayTodayEl e goToToday sono sia dichiarati sia usati", () => {
    expect(html).toContain('const dayTodayEl = document.getElementById("daytoday")');
    expect(html.match(/dayTodayEl/g).length).toBeGreaterThan(1);
    expect(html.match(/goToToday/g).length).toBeGreaterThan(1);
  });
});
