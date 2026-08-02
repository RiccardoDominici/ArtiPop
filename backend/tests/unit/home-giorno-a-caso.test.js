// feat-riscopri-un-giorno-a-caso: la home guadagna un comando "🎲 un giorno
// a caso" che pesca a caso un giorno qualunque dell'archivio già scaricato
// del canale mostrato e ci salta, riusando goToArc — nessuna fetch nuova,
// nessuna seconda implementazione del salto. Test puro su renderPage() —
// nessun binding, nessuna rete, sullo stile di home-arco-precedente.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function extractFn(name) {
  const src = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))[0];
  return new Function(`return (${src});`)();
}

function journeySection() {
  return html.match(/<section class="journey">[\s\S]*?<\/section>/)[0];
}

describe("home — riscopri un giorno a caso", () => {
  it("il markup espone #dayrand dentro .journey, inizialmente hidden", () => {
    const journey = journeySection();
    const tag = journey.match(/<button class="btn ghost" id="dayrand"[^>]*>/)[0];
    expect(tag).toContain("hidden");
    const full = journey.match(/<button class="btn ghost" id="dayrand"[^>]*>[^<]*<\/button>/)[0];
    expect(full).toContain("un giorno a caso");
  });

  it("renderJourney governa #dayrand con lo stesso hasJourney degli altri comandi", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayRandEl.hidden = !hasJourney");
  });

  describe("scegliGiornoACaso — pesca pura di una data diversa da quella corrente", () => {
    const scegliGiornoACaso = extractFn("scegliGiornoACaso");

    it("con sorteggio deterministico iniettato, ritorna la data attesa", () => {
      const date = ["2026-08-01", "2026-07-31", "2026-07-30", "2026-07-29"];
      // dataCorrente = 2026-08-01 → candidati = le altre tre, in ordine.
      expect(scegliGiornoACaso(date, "2026-08-01", () => 0)).toBe("2026-07-31");
      expect(scegliGiornoACaso(date, "2026-08-01", () => 0.5)).toBe("2026-07-30");
      expect(scegliGiornoACaso(date, "2026-08-01", () => 0.999)).toBe("2026-07-29");
    });

    it("non ritorna mai la data corrente, su tutto l'intervallo del sorteggio", () => {
      const date = ["2026-08-01", "2026-07-31", "2026-07-30"];
      for (let x = 0; x < 1; x += 0.05) {
        expect(scegliGiornoACaso(date, "2026-08-01", () => x)).not.toBe("2026-08-01");
      }
    });

    it("elenco vuoto → null, nessun throw", () => {
      expect(scegliGiornoACaso([], "2026-08-01")).toBeNull();
    });

    it("elenco con la sola data corrente → null, nessun throw", () => {
      expect(scegliGiornoACaso(["2026-08-01"], "2026-08-01")).toBeNull();
    });

    it("argomenti non-array → null, nessun throw", () => {
      expect(scegliGiornoACaso(null, "2026-08-01")).toBeNull();
      expect(scegliGiornoACaso(undefined, "2026-08-01")).toBeNull();
      expect(scegliGiornoACaso("2026-08-01", "2026-08-01")).toBeNull();
    });
  });

  it("il click su #dayrand riusa goToArc (stesso percorso di salto di #dayPick), nessuna seconda implementazione del salto d'arco", () => {
    const src = html.match(/dayRandEl\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/)[0];
    expect(src).toContain("scegliGiornoACaso(");
    expect(src).toContain("goToArc(chId, arcIdx, d)");
  });

  it("se non c'è nessun altro giorno, o l'arco non si trova, avvisa con un toast e non salta", () => {
    const src = html.match(/dayRandEl\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/)[0];
    expect(src).toContain('toast("nessun altro giorno da riaprire")');
  });

  it("nessuna fetch nuova: la scelta lavora solo su arcsCache/archiveCache già in memoria", () => {
    const fetches = html.match(/fetch\(/g) || [];
    expect(fetches.length).toBe(1);
  });
});
