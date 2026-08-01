// feat-sfoglia-i-giorni-con-il-dito: dentro "Il viaggio finora" uno
// scorrimento orizzontale del dito deve muovere il giorno mostrato
// (stepDay), mai il canale (advance/flyOut) — stesso idioma di
// attachDrag ma agganciato a journeyEl, non alla card in cima al mazzo.
// Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — sfoglia i giorni col dito", () => {
  it("il hint del viaggio dichiara il gesto col simbolo ↔", () => {
    expect(html).toContain(
      "Solo questa settimana, giorno per giorno — ↔ scorri o usa le frecce."
    );
  });

  it("attachJourneySwipe esiste ed è invocata una volta nel corpo dello script", () => {
    expect(html).toContain("function attachJourneySwipe()");
    const calls = html.match(/^attachJourneySwipe\(\);$/gm) || [];
    expect(calls.length).toBe(1);
    expect(html).toMatch(/\nattachJourneySwipe\(\);\nbuildDeck\(\);/);
  });

  it("aggancia pointerdown/pointermove/pointerup/pointercancel a journeyEl, non a deckEl", () => {
    const fnBody = html.match(
      /function attachJourneySwipe\(\) \{[\s\S]*?\n\}/
    )[0];
    expect(fnBody).toContain('journeyEl.addEventListener("pointerdown"');
    expect(fnBody).toContain('journeyEl.addEventListener("pointermove"');
    expect(fnBody).toContain('journeyEl.addEventListener("pointerup"');
    expect(fnBody).toContain('journeyEl.addEventListener("pointercancel"');
    expect(fnBody).not.toContain("deckEl.addEventListener");
  });

  it("ha le guardie daynavEl.hidden e closest(\"button, a\")", () => {
    const fnBody = html.match(
      /function attachJourneySwipe\(\) \{[\s\S]*?\n\}/
    )[0];
    expect(fnBody).toContain("if (daynavEl.hidden) return");
    expect(fnBody).toContain('e.target.closest("button, a")');
  });

  it("chiama stepDay(-1) e stepDay(1), mai advance( o flyOut(", () => {
    const fnBody = html.match(
      /function attachJourneySwipe\(\) \{[\s\S]*?\n\}/
    )[0];
    expect(fnBody).toContain("stepDay(dx > 0 ? -1 : 1)");
    expect(fnBody).not.toContain("advance(");
    expect(fnBody).not.toContain("flyOut(");
  });

  it("non chiama preventDefault nel ramo pointermove: lo scorrimento verticale resta libero", () => {
    const fnBody = html.match(
      /function attachJourneySwipe\(\) \{[\s\S]*?\n\}/
    )[0];
    const moveBranch = fnBody.match(
      /journeyEl\.addEventListener\("pointermove", \(e\) => \{[\s\S]*?\n  \}\);/
    )[0];
    expect(moveBranch).not.toContain("preventDefault()");
  });

  it("il gesto è vincolato all'asse orizzontale: confronta Math.abs(dx) con Math.abs(dy)", () => {
    const fnBody = html.match(
      /function attachJourneySwipe\(\) \{[\s\S]*?\n\}/
    )[0];
    expect(fnBody).toContain("Math.abs(dx) <= Math.abs(dy)");
  });

  it("regressione: attachDrag resta agganciata alla card in cima e il keydown su journeyEl è ancora presente", () => {
    expect(html).toContain('deckEl.querySelector(".card.top")');
    expect(html).toContain("journeyEl.addEventListener(\"keydown\"");
  });
});
