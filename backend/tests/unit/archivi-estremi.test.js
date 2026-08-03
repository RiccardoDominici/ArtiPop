// feat-dal-giorno-d-archivio-si-salta-al-primo-e-all-ultimo: dal giorno
// d'archivio si raggiunge in un tocco il primo e l'ultimo giorno del canale,
// e la pagina dice a che punto dell'archivio ti trovi («giorno N di M»).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — salto agli estremi e posizione nell'archivio", () => {
  it("giorno centrale: entrambi i link estremo e riga «giorno 2 di 3»", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const navMatch = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/);
    expect(navMatch).not.toBeNull();
    const nav = navMatch[0];
    expect(nav).toContain('<a class="estremo" href="/archivi/island?date=2025-01-01"');
    expect(nav).toContain('<a class="estremo" href="/archivi/island?date=2025-01-03"');
    expect(nav).toContain("⇤ primo giorno");
    expect(nav).toContain("ultimo giorno ⇥");
    expect((nav.match(/aria-label="[^"]+"/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('<p class="posizione-archivio">giorno 2 di 3 dell\'archivio</p>');
  });

  it("giorno più recente: solo «primo giorno», riga «giorno 3 di 3»", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-03", date: DATE });
    const nav = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/)[0];
    expect(nav).toContain("primo giorno");
    expect(nav).not.toContain("ultimo giorno");
    expect((nav.match(/class="estremo"/g) || []).length).toBe(1);
    expect(html).toContain('<p class="posizione-archivio">giorno 3 di 3 dell\'archivio</p>');
  });

  it("giorno più vecchio: solo «ultimo giorno», riga «giorno 1 di 3»", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-01", date: DATE });
    const nav = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/)[0];
    expect(nav).toContain("ultimo giorno");
    expect(nav).not.toContain("primo giorno");
    expect((nav.match(/class="estremo"/g) || []).length).toBe(1);
    expect(html).toContain('<p class="posizione-archivio">giorno 1 di 3 dell\'archivio</p>');
  });

  it("un solo giorno in archivio: nessun link estremo, riga «giorno 1 di 1»", () => {
    const html = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    expect(html).not.toContain('class="estremo"');
    expect(html).toContain('<p class="posizione-archivio">giorno 1 di 1 dell\'archivio</p>');
  });

  it("date vuoto, assente o data non presente: nessun link/riga, pagina HTML valida", () => {
    const vuoto = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: [] });
    expect(vuoto).not.toContain('class="estremo"');
    expect(vuoto).not.toContain('class="posizione-archivio"');
    expect(vuoto).toContain("<!doctype html>");
    expect(vuoto).toContain("<title>");
    expect(vuoto).toContain('href="/archivi"');

    const assente = renderGiornoArchivio({ id: "island", data: "2025-01-02" });
    expect(assente).not.toContain('class="estremo"');
    expect(assente).not.toContain('class="posizione-archivio"');
    expect(assente).toContain("<!doctype html>");

    const fuori = renderGiornoArchivio({ id: "island", data: "2030-01-01", date: DATE });
    expect(fuori).not.toContain('class="estremo"');
    expect(fuori).not.toContain('class="posizione-archivio"');
    expect(fuori).toContain("<!doctype html>");
  });

  it("id e date con caratteri speciali: nessuna iniezione nel markup", () => {
    const html = renderGiornoArchivio({
      id: "<b>x",
      data: "2025-01-02",
      date: ["2025-01-03", "2025-01-02", "2025-01-01&x=<y>"],
    });
    expect(html).toContain(`date=${encodeURIComponent("2025-01-01&x=<y>")}`);
    expect(html).not.toContain("<b>x");
    expect(html).not.toContain("<y>\"");
    expect(html).toContain("&lt;b&gt;x");
  });

  it("guardia di contratto §2.2: nessuno script né fetch(", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});
