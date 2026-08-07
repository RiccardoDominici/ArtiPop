import { describe, it, expect } from "vitest";
import { renderGiornoArchivio, renderArchiviPage, renderArchivioNonTrovato } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — scelta del giorno da affiancare", () => {
  it("ogni altra data dell'elenco porta il link di confronto verso quella data", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain(
      '<a class="confronta-giorno" href="/archivi/island?date=2025-01-02&amp;confronta=2025-01-01"'
    );
    expect(html).toContain(
      '<a class="confronta-giorno" href="/archivi/island?date=2025-01-02&amp;confronta=2025-01-03"'
    );
    expect((html.match(/class="confronta-giorno"/g) || []).length).toBe(2);
  });

  it("la voce della data mostrata non porta il link", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("confronta=2025-01-02");
  });

  it("in modalità confronto la voce del giorno già affiancato non porta il link", () => {
    const html = renderGiornoArchivio({
      id: "island",
      data: "2025-01-02",
      date: DATE,
      confronta: "2025-01-01",
    });
    expect(html).not.toContain("confronta=2025-01-01");
    expect((html.match(/class="confronta-giorno"/g) || []).length).toBe(1);
    expect(html).toContain(
      '<a class="confronta-giorno" href="/archivi/island?date=2025-01-02&amp;confronta=2025-01-03"'
    );
  });

  it("con un solo giorno in archivio nessun link di confronto viene emesso", () => {
    const html = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    expect(html).not.toContain('class="confronta-giorno"');
    expect(html).not.toContain("confronta=");
  });

  it("la pagina elenco del canale (nessuna data corrente) resta invariata", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", date: DATE },
    ]);
    expect(html).not.toContain('class="confronta-giorno"');
    expect(html).not.toContain("confronta=");
  });

  it("la pagina d'errore (nessuna data corrente) resta invariata", () => {
    const html = renderArchivioNonTrovato("island", DATE);
    expect(html).not.toContain('class="confronta-giorno"');
    expect(html).not.toContain("confronta=");
  });

  it("l'aria-label del comando nomina entrambe le date", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('aria-label="Confronta il giorno 2025-01-02 col 2025-01-03"');
  });

  it("id e date con caratteri da percent-encoding restano codificati negli href", () => {
    const html = renderGiornoArchivio({ id: "isola blu", data: "2025-01-02", date: DATE });
    expect(html).toContain("/archivi/isola%20blu?date=2025-01-02&amp;confronta=2025-01-01");
  });

  it("nessun HTML iniettabile da id o date ostili", () => {
    const html = renderGiornoArchivio({
      id: "<b>x",
      data: "2025-01-01&x=<y>",
      date: ["2025-01-01&x=<y>", "2025-01-02"],
    });
    expect(html).not.toContain("<b>x");
    expect(html).not.toContain('<y>"');
    expect(html).toContain("&lt;b&gt;x");
  });

  it("l'ingresso è server-rendered: nessuno script aggiuntivo, nessun fetch", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1);
    expect(html).not.toContain("fetch(");
  });
});
