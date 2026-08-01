// feat-l-archivio-storico-si-sfoglia-giorno-per-giorno: ogni canale storico
// mostra il link a TUTTI i suoi giorni, non solo all'ultimo. `storici[].date`
// (dalla più recente alla più vecchia) è opzionale: se assente il <details>
// non viene emesso e la card resta quella dei cicli 80-81.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

const CON_DATE = [
  {
    id: "island",
    giorni: 3,
    prima: "2025-01-01",
    ultima: "2025-01-03",
    date: ["2025-01-03", "2025-01-02", "2025-01-01"],
  },
];

describe("renderArchiviPage(storici) — elenco di tutti i giorni", () => {
  it("con date presenti: un <a href> per ciascuna data, in ordine dalla più recente", () => {
    const html = renderArchiviPage(CON_DATE);
    expect(html).toContain('<details class="giorni">');
    expect(html).toContain("tutti i 3 giorni");
    expect(html).toContain('/w/island?date=2025-01-03');
    expect(html).toContain('/w/island?date=2025-01-02');
    expect(html).toContain('/w/island?date=2025-01-01');

    const i3 = html.indexOf("2025-01-03");
    const i2 = html.indexOf("2025-01-02");
    const i1 = html.indexOf("2025-01-01<");
    expect(i3).toBeLessThan(i2);
    expect(i2).toBeLessThan(i1);
  });

  it("summary riporta il conteggio coerente con giorni: 1 → singolare", () => {
    const html = renderArchiviPage([
      { id: "bloom", giorni: 1, prima: "2025-02-01", ultima: "2025-02-01", date: ["2025-02-01"] },
    ]);
    expect(html).toContain("tutti i 1 giorno<");
  });

  it("date assente (chiamata legacy): nessun <details class=\"giorni\">, card invariata", () => {
    const html = renderArchiviPage([
      { id: "bloom", giorni: 3, prima: "2025-02-01", ultima: "2025-02-03" },
    ]);
    expect(html).not.toContain('<details class="giorni">');
    expect(html).toContain("2025-02-01 → 2025-02-03");
  });

  it("date vuoto ([]): nessun <details class=\"giorni\">", () => {
    const html = renderArchiviPage([
      { id: "bloom", giorni: 0, prima: "2025-02-01", ultima: "2025-02-01", date: [] },
    ]);
    expect(html).not.toContain('<details class="giorni">');
  });

  it("nessuno <script> e nessuna fetch( nell'HTML anche con l'elenco dei giorni", () => {
    const html = renderArchiviPage(CON_DATE);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });

  it("date con caratteri inattesi passano da esc()", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 1, prima: "<b>", ultima: "<b>", date: ["<b>"] },
    ]);
    expect(html).not.toContain("<b>2025");
    expect(html).toContain("&lt;b&gt;");
  });
});
