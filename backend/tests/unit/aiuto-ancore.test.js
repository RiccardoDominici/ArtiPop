// s-ogni-voce-dell-aiuto-ha-un-indirizzo-suo: ogni voce di /aiuto deve avere
// un id stabile e un link permanente, e il caricamento per hash deve aprirla.
// Test puro su renderHelpPage() — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — indirizzabilità delle voci", () => {
  const html = renderHelpPage();

  function estraiDetails(markup) {
    const re = /<details[^>]*>/g;
    return markup.match(re) ?? [];
  }

  function estraiId(tag) {
    const m = tag.match(/id="([^"]*)"/);
    return m ? m[1] : "";
  }

  it("ogni <details class=\"item…\"> ha un attributo id non vuoto", () => {
    const details = estraiDetails(html);
    expect(details.length).toBeGreaterThan(0);
    for (const tag of details) {
      expect(estraiId(tag)).not.toBe("");
    }
  });

  it("gli id sono 16, tutti distinti fra loro", () => {
    const ids = estraiDetails(html).map(estraiId);
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);
  });

  it("gli id sono slug validi, mai spazi/maiuscole/accenti", () => {
    const ids = estraiDetails(html).map(estraiId);
    for (const id of ids) {
      expect(id).toMatch(/^[pd]-[a-z0-9-]+$/);
    }
  });

  it("stabilità: due render consecutivi producono gli stessi id nello stesso ordine", () => {
    const ids1 = estraiDetails(renderHelpPage()).map(estraiId);
    const ids2 = estraiDetails(renderHelpPage()).map(estraiId);
    expect(ids2).toEqual(ids1);
  });

  it("ogni voce contiene un permalink il cui href punta al proprio id", () => {
    const itemRe = /<details[^>]*id="([^"]*)"[^>]*>[\s\S]*?<\/details>/g;
    let match;
    let count = 0;
    while ((match = itemRe.exec(html))) {
      const [blocco, id] = match;
      const primoSummaryFine = blocco.indexOf("</summary>");
      const summary = blocco.slice(0, primoSummaryFine);
      expect(summary).toContain(`<a class="permalink" href="#${id}"`);
      count++;
    }
    expect(count).toBe(16);
  });

  it("il permalink ha un aria-label", () => {
    expect(html).toContain('aria-label="Link a questa voce"');
  });

  it("lo script inline è presente e reagisce a hashchange", () => {
    expect(html).toContain("hashchange");
    expect(html).toContain(".open = true");
  });

  it("non regressione: contiene ancora 16 <summary>, i marker, la classe item hot", () => {
    const summaryCount = (html.match(/<summary>/g) ?? []).length;
    expect(summaryCount).toBe(16);
    expect(html).toContain("＋");
    expect(html).toContain("－");
    expect(html).toContain("item hot");
  });

  it("non regressione: token colore invariati", () => {
    expect(html).toContain("#f2f3f8");
    expect(html).toContain("#9aa3b8");
    expect(html).toContain("#8fd3ff");
    expect(html).toContain("max-width: 720px");
  });

  it("non regressione: nessun colore nuovo nel CSS della pagina", () => {
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    const css = styleMatch[1];
    const esadecimali = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const attesi = new Set(["#0a0b10", "#f2f3f8", "#9aa3b8", "#8fd3ff"]);
    for (const hex of esadecimali) {
      expect(attesi.has(hex)).toBe(true);
    }
  });
});
