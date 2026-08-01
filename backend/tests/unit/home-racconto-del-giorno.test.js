// feat-il-viaggio-racconta-il-giorno: sfogliando "Il viaggio finora" la home
// deve dire COSA succede quel giorno (soggetto + testo della tappa), non solo
// data e "N di M". Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — didascalia narrativa del giorno nel viaggio", () => {
  const html = renderPage({}, "https://example.com", "2026-08-01");

  it("il markup contiene <p id=\"dcap\"> dentro la sezione .journey, inizialmente nascosto", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    expect(journey).toContain('id="dcap"');
    const dcapTag = journey.match(/<p class="dcap" id="dcap"[^>]*>/)[0];
    expect(dcapTag).toContain("hidden");
  });

  it("lo script client legge giorni[] dalla risposta di /api/archive/ e popola la didascalia dentro updateDayNav", () => {
    expect(html).toMatch(/body\.giorni/);
    expect(html).toMatch(/capCache\[chId\] = cap/);
    // updateDayCaption è chiamata da updateDayNav, così vale anche per frecce e timelapse.
    const updateDayNavBody = html.match(/function updateDayNav\([\s\S]*?\n\}/)[0];
    expect(updateDayNavBody).toContain("updateDayCaption(chId, date)");
  });

  it("con dati narrativi mancanti (giorno ricostruito) la didascalia si nasconde, mai stringa vuota o null in markup statico", () => {
    const fnBody = html.match(/function updateDayCaption\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dcapEl.hidden = true");
    expect(fnBody).toContain('dcapEl.textContent = ""');
    // Nessun fallback che stamperebbe "null"/"undefined" quando i campi mancano.
    expect(fnBody).not.toMatch(/\+\s*null/);
  });

  it("la regola .dcap usa solo token già in VISUAL_SPECS (var(--dim), .78rem), nessun colore/dimensione nuovi", () => {
    const rule = html.match(/\.dcap\s*\{[^}]*\}/)[0];
    expect(rule).toContain("var(--dim)");
    expect(rule).toContain(".78rem");
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("nessuna richiesta HTTP nuova: l'unico fetch dell'archivio resta /api/archive/<canale>?limit=30", () => {
    const fetches = html.match(/fetch\(/g) || [];
    expect(fetches.length).toBe(1);
    expect(html).toContain("/api/archive/${chId}?limit=30");
  });
});
