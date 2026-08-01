// feat-cerca-il-tuo-problema-nell-aiuto: la pagina /aiuto guadagna un campo di
// ricerca che filtra le voci mentre l'utente scrive. Test puro su
// renderHelpPage() — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — campo di ricerca", () => {
  const html = renderHelpPage();

  it("contiene un <input type=\"search\"> con id stabile, aria-label non vuoto e hidden nel markup servito", () => {
    const m = html.match(/<input[^>]*type="search"[^>]*>/);
    expect(m).not.toBeNull();
    const tag = m[0];
    expect(tag).toMatch(/id="[^"]+"/);
    const ariaLabel = tag.match(/aria-label="([^"]*)"/);
    expect(ariaLabel).not.toBeNull();
    expect(ariaLabel[1].trim()).not.toBe("");
    expect(tag).toContain("hidden");
  });

  it("lo script contiene la logica di filtro e il ripristino su query vuota", () => {
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const script = scriptMatch[1];
    expect(script).toContain('addEventListener("input"');
    expect(script).toContain(".hidden = false");
    expect(script).toMatch(/q\s*===\s*""/);
  });

  it("ogni <h2> di sezione porta un attributo che lo lega alle sue voci", () => {
    const h2s = html.match(/<h2[^>]*>/g) ?? [];
    expect(h2s.length).toBeGreaterThan(0);
    for (const tag of h2s) {
      expect(tag).toMatch(/data-sezione="[^"]+"/);
    }
  });

  it("il numero di voci <details> rese è invariato (15)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(15);
  });

  it("gli id delle voci e i permalink restano invariati", () => {
    const idRe = /<details[^>]*id="([^"]*)"[^>]*>/g;
    let match;
    const ids = [];
    while ((match = idRe.exec(html))) ids.push(match[1]);
    expect(ids).toHaveLength(15);
    for (const id of ids) {
      expect(html).toContain(`<a class="permalink" href="#${id}"`);
    }
  });

  it("nessun colore o dimensione fuori dai token dichiarati in VISUAL_SPECS §2 nella regola del campo", () => {
    const blocco = html.match(/#cerca\s*\{[^}]*\}/);
    expect(blocco).not.toBeNull();
    expect(blocco[0]).toContain("rgba(255,255,255,.10)");
    expect(blocco[0]).toContain("rgba(255,255,255,.03)");
    expect(blocco[0]).toContain("14px");
    expect(blocco[0]).toContain("#f2f3f8");
    expect(blocco[0]).toContain("min-height: 44px");
    const esadecimali = blocco[0].match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    for (const hex of esadecimali) {
      expect(["#f2f3f8"]).toContain(hex);
    }
  });
});
