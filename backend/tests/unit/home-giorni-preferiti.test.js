// feat-segna-i-giorni-che-ti-piacciono: la home permette di segnare con una
// stella il giorno mostrato e di ritrovare i giorni segnati in un elenco,
// salvati solo su questo dispositivo (localStorage). Test puro su
// renderPage() — nessun binding, nessuna rete, sullo stile di
// home-salta-a-una-data.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function journeySection() {
  return html.match(/<section class="journey">[\s\S]*?<\/section>/)[0];
}

describe("home — segna i giorni che ti piacciono", () => {
  it("il markup espone #dayfav dentro .journey, inizialmente hidden, con aria-pressed", () => {
    const journey = journeySection();
    const tag = journey.match(/<button class="btn ghost" id="dayfav"[^>]*>/)[0];
    expect(tag).toContain("hidden");
    expect(tag).toContain('aria-pressed="false"');
  });

  it("il markup espone #favpick e #favlist (.arcstory), entrambi hidden di default", () => {
    const journey = journeySection();
    const pickTag = journey.match(/<button class="btn ghost" id="favpick"[^>]*>/)[0];
    expect(pickTag).toContain("hidden");
    const listTag = journey.match(/<div class="arcstory" id="favlist"[^>]*>/)[0];
    expect(listTag).toContain("hidden");
  });

  it("renderJourney nasconde #dayfav, #favpick e #favlist insieme agli altri comandi quando !hasJourney", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayFavEl.hidden = !hasJourney");
    const noJourneyBranch = fnBody.match(/if \(!hasJourney\) \{[\s\S]*?\n {2}\}/)[0];
    expect(noJourneyBranch).toContain("favPickEl.hidden = true");
    expect(noJourneyBranch).toContain("favListEl.hidden = true");
  });

  it("leggiPreferiti è racchiusa in try/catch e ripiega su oggetto vuoto quando il JSON è illeggibile", () => {
    const fnBody = html.match(/function leggiPreferiti\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("try {");
    expect(fnBody).toContain("} catch {");
    expect(fnBody).toContain("return {};");
    expect(fnBody).toContain("typeof parsed === \"object\"");
  });

  it("togglePreferito scrive su localStorage sotto artipop:preferiti, indicizzato per canale", () => {
    expect(html).toContain('const PREFERITI_KEY = "artipop:preferiti"');
    const fnBody = html.match(/function togglePreferito\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("scriviPreferiti(tutti)");
    expect(fnBody).toContain("tutti[chId]");
  });

  it("renderFavList nasconde #favpick quando il canale mostrato non ha preferiti", () => {
    const fnBody = html.match(/function renderFavList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("favPickEl.hidden = preferiti.length === 0");
  });

  it("il click su una riga di #favlist riusa goToArc (stesso percorso di salto di #dayPick), nessuna seconda implementazione del salto d'arco", () => {
    const fnBody = html.match(/function renderFavList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("arcs.findIndex((arc) => arc.includes(d))");
    expect(fnBody).toContain("goToArc(chId, arcIdx, d)");
  });

  it("nessun riferimento orfano: dayFavEl, favPickEl e favListEl sono sia dichiarati sia usati", () => {
    expect(html).toContain('const dayFavEl = document.getElementById("dayfav")');
    expect(html).toContain('const favPickEl = document.getElementById("favpick")');
    expect(html).toContain('const favListEl = document.getElementById("favlist")');
    expect(html.match(/dayFavEl/g).length).toBeGreaterThan(1);
    expect(html.match(/favPickEl/g).length).toBeGreaterThan(1);
    expect(html.match(/favListEl/g).length).toBeGreaterThan(1);
  });
});
