// feat-un-giorno-d-archivio-sbagliato-mostra-quelli-giusti: la pagina 404 di
// /archivi/<id> elenca i giorni realmente disponibili del canale invece di
// lasciare l'utente in un vicolo cieco. `date` (opzionale, retrocompatibile):
// se assente o vuoto la pagina resta quella dei cicli precedenti.
import { describe, it, expect } from "vitest";
import { renderArchivioNonTrovato } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderArchivioNonTrovato(id, date) — recupero dal giorno sbagliato", () => {
  it("con date non vuoto: <details class=\"giorni\">, summary, un link per data e il ↓ di salvataggio", () => {
    const html = renderArchivioNonTrovato("island", DATE);
    expect(html).toContain('<details class="giorni">');
    expect(html).toContain("tutti i 3 giorni");
    expect(html).toContain('<a href="/archivi/island?date=2025-01-03">');
    expect(html).toContain('<a href="/archivi/island?date=2025-01-02">');
    expect(html).toContain('<a href="/archivi/island?date=2025-01-01">');
    expect(html).toContain('href="/w/island?date=2025-01-03&amp;dl=1"');
  });

  it("con date non vuoto: nessun aria-current, il .sub dice che il giorno richiesto non ne fa parte", () => {
    const html = renderArchivioNonTrovato("island", DATE);
    expect(html).not.toContain('aria-current="page"');
    expect(html).toContain("non ne fa parte");
  });

  it("senza secondo argomento: nessun <details>, nessun <ul class=\"date\">, messaggio di canale senza archivio", () => {
    const html = renderArchivioNonTrovato("island");
    expect(html).not.toContain("<details");
    expect(html).not.toContain('<ul class="date"');
    expect(html).toContain("non ha un archivio consultabile");
  });

  it("date vuoto ([]): stesso comportamento di senza secondo argomento", () => {
    const html = renderArchivioNonTrovato("island", []);
    expect(html).not.toContain("<details");
    expect(html).toContain("non ha un archivio consultabile");
  });

  it("l'id viene sempre escapato", () => {
    const html = renderArchivioNonTrovato("<b>x", DATE);
    expect(html).not.toContain("<b>x");
    expect(html).toContain("&lt;b&gt;x");
  });

  it("nessuno <script> e nessuna fetch( nell'HTML", () => {
    const html = renderArchivioNonTrovato("island", DATE);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});
