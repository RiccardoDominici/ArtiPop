// feat-l-aiuto-spiega-il-promemoria-nel-calendario: la rotta /promemoria.ics
// (index.js) e il link della home (page.js:459) esistono dal ciclo 179 ma non
// erano nominati in /aiuto. Test puro su renderHelpPage() — nessun binding,
// nessuna rete, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — la FAQ spiega il promemoria da calendario", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, ago) {
    const idx = markup.indexOf(ago);
    const inizio = markup.lastIndexOf("<details", idx);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(inizio, fine);
  }

  const voce = estraiVoce(html, "/promemoria.ics");

  it("contiene le parole cercabili «promemoria» e «calendario»", () => {
    expect(voce).toContain("promemoria");
    expect(voce).toContain("calendario");
  });

  it("nomina l'indirizzo /promemoria.ics e il fatto che segue il canale scelto", () => {
    expect(voce).toContain("/promemoria.ics");
    expect(voce).toMatch(/promemoria\.ics\?c=/);
  });

  it("ha un id stabile d-<slug> e il suo permalink", () => {
    const match = voce.match(/<details[^>]*\bid="([^"]+)"/);
    expect(match).not.toBeNull();
    const id = match[1];
    expect(id).toMatch(/^d-[a-z0-9-]+$/);
    expect(voce).toContain(`<a class="permalink" href="#${id}"`);
  });

  it("è dentro la sezione «Domande frequenti», non fra i problemi", () => {
    const idxFaq = html.indexOf('<h2 data-sezione="faq">');
    expect(idxFaq).toBeGreaterThan(-1);
    expect(html.indexOf("/promemoria.ics")).toBeGreaterThan(idxFaq);
    expect(html.slice(0, idxFaq)).not.toContain("/promemoria.ics");
  });

  it("il render resta stabile fra due chiamate e non introduce colori nuovi", () => {
    expect(renderHelpPage()).toBe(html);

    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    const colori = styleMatch[1].match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const ammessi = new Set(["#0a0b10", "#f2f3f8", "#9aa3b8", "#8fd3ff"]);
    for (const colore of colori) {
      expect(ammessi.has(colore)).toBe(true);
    }
  });

  it("i tag <strong>/<code> nella voce sono bilanciati e solo tag noti", () => {
    const apertiStrong = (voce.match(/<strong>/g) ?? []).length;
    const chiusiStrong = (voce.match(/<\/strong>/g) ?? []).length;
    expect(apertiStrong).toBe(chiusiStrong);

    const apertiCode = (voce.match(/<code>/g) ?? []).length;
    const chiusiCode = (voce.match(/<\/code>/g) ?? []).length;
    expect(apertiCode).toBe(chiusiCode);

    const tagNoti = ["details", "summary", "a", "div", "p", "strong", "code", "br"];
    const tagTrovati = [...voce.matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1]);
    for (const tag of tagTrovati) {
      expect(tagNoti).toContain(tag);
    }
  });
});
