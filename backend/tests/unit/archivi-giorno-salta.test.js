// feat-dal-giorno-d-archivio-si-salta-a-qualunque-data: renderGiornoArchivio
// riusa lo stesso componente «tutti i N giorni» già presente nell'elenco
// /archivi (VISUAL_SPECS §2.1/§2.2), così dalla pagina di un giorno si salta
// a qualunque altra data del canale senza tornare all'elenco. Il giorno
// mostrato compare nell'elenco ma non come link verso se stesso.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — elenco di tutti i giorni", () => {
  it("con più giorni: <details class=\"giorni\">, summary «tutti i N giorni» e un link per ogni data diversa da quella mostrata", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('<details class="giorni">');
    expect(html).toContain("tutti i 3 giorni");
    expect(html).toContain('href="/archivi/island?date=2025-01-01"');
    expect(html).toContain('href="/archivi/island?date=2025-01-03"');
  });

  it("la data mostrata compare nell'elenco ma non come link verso se stessa, marcata aria-current=\"page\"", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain('href="/archivi/island?date=2025-01-02"');
    expect(html).toContain('<span aria-current="page">2025-01-02</span>');
  });

  it("con un solo giorno in archivio: singolare «tutti i 1 giorno», nessun link verso l'unica data", () => {
    const html = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    expect(html).toContain("tutti i 1 giorno");
    expect(html).not.toContain('href="/archivi/bloom?date=2025-02-01"');
    expect(html).toContain('<span aria-current="page">2025-02-01</span>');
  });

  it("con date vuoto o assente: nessun <details class=\"giorni\">, pagina comunque valida", () => {
    const htmlVuoto = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: [] });
    expect(htmlVuoto).not.toContain('<details class="giorni">');
    expect(htmlVuoto).toContain("island");

    const htmlAssente = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: undefined });
    expect(htmlAssente).not.toContain('<details class="giorni">');
    expect(htmlAssente).toContain("island");
  });

  it("il link di salvataggio ↓ resta presente per ogni giorno dell'elenco, incluso quello mostrato", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/w/island?date=2025-01-01&amp;dl=1"');
    expect(html).toContain('href="/w/island?date=2025-01-02&amp;dl=1"');
    expect(html).toContain('href="/w/island?date=2025-01-03&amp;dl=1"');
  });

  it("id e date con caratteri speciali restano escapati/encodati: nessuna iniezione nel markup", () => {
    const html = renderGiornoArchivio({
      id: "<b>x",
      data: "2025-01-01&x=<y>",
      date: ["2025-01-01&x=<y>", "2025-02-02"],
    });
    expect(html).not.toContain("<b>x");
    expect(html).toContain("&lt;b&gt;x");
    expect(html).toContain(
      'href="/archivi/%3Cb%3Ex?date=2025-02-02"'
    );
    expect(html).not.toContain("<y>\"");
  });

  it("nessuno <script> né fetch( nell'HTML: contratto §2.2 invariato", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});
