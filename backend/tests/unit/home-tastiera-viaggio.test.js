// feat-sfoglia-il-viaggio-con-la-tastiera: le frecce da tastiera dentro "Il
// viaggio finora" devono muovere il giorno mostrato (stepDay), non far
// volare via la card del canale (advance) come fa invece il listener
// globale su window. Test puro su renderPage() — nessun binding, nessuna
// rete, stessa tecnica dei test home-*.test.js già presenti.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — sfoglia il viaggio con la tastiera", () => {
  it("esiste un listener keydown registrato su journeyEl, oltre a quello su window", () => {
    expect(html).toContain('const journeyEl = document.querySelector(".journey")');
    expect(html).toContain("journeyEl.addEventListener(\"keydown\"");
    // Il listener globale sul mazzo dei canali resta presente e invariato.
    expect(html).toContain('window.addEventListener("keydown"');
  });

  it("il gestore del viaggio chiama stepDay(-1) su ArrowLeft e stepDay(1) su ArrowRight", () => {
    const fnBody = html.match(/journeyEl\.addEventListener\("keydown", \(e\) => \{[\s\S]*?\n\}\);/)[0];
    expect(fnBody).toContain('stepDay(e.key === "ArrowLeft" ? -1 : 1)');
  });

  it("il gestore del viaggio chiama preventDefault e stopPropagation, così l'evento non arriva ad advance", () => {
    const fnBody = html.match(/journeyEl\.addEventListener\("keydown", \(e\) => \{[\s\S]*?\n\}\);/)[0];
    expect(fnBody).toContain("e.preventDefault()");
    expect(fnBody).toContain("e.stopPropagation()");
  });

  it("il gestore si arresta con un modificatore (meta/ctrl/alt) o quando #daynav è nascosto", () => {
    const fnBody = html.match(/journeyEl\.addEventListener\("keydown", \(e\) => \{[\s\S]*?\n\}\);/)[0];
    expect(fnBody).toContain("if (e.metaKey || e.ctrlKey || e.altKey) return");
    expect(fnBody).toContain("if (daynavEl.hidden) return");
  });

  it("regressione: il listener globale su window continua a chiamare advance(1)/advance(-1)", () => {
    const fnBody = html.match(/window\.addEventListener\("keydown", \(e\) => \{[\s\S]*?\n\}\);/)[0];
    expect(fnBody).toContain('if (e.key === "ArrowRight") advance(1);');
    expect(fnBody).toContain('if (e.key === "ArrowLeft") advance(-1);');
  });
});
