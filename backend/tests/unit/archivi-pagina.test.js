// feat-gli-archivi-storici-si-riaprono-dal-sito: renderArchiviPage(storici)
// è pura e testabile senza env, stesso schema di aiuto-stato-canali.test.js
// per help.js. `storici`: array [{ id, giorni, prima, ultima }] già filtrato
// e ordinato da index.js, oppure `null` se la scansione KV è fallita.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

const ESEMPIO = [
  { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
  { id: "bloom", giorni: 3, prima: "2025-02-01", ultima: "2025-02-03" },
];

describe("renderArchiviPage(storici)", () => {
  it("con una lista di esempio: nome, giorni, intervallo e link /archivi/<id>?date=<ultima> per ogni canale", () => {
    const html = renderArchiviPage(ESEMPIO);
    expect(html).toContain("island");
    expect(html).toContain("12 giorni");
    expect(html).toContain("2025-01-01 → 2025-01-12");
    expect(html).toContain('href="/archivi/island?date=2025-01-12"');

    expect(html).toContain("bloom");
    expect(html).toContain("3 giorni");
    expect(html).toContain("2025-02-01 → 2025-02-03");
    expect(html).toContain('href="/archivi/bloom?date=2025-02-03"');
  });

  it("nessuno <script> e nessuna fetch( nell'HTML: pagina server-rendered senza JS", () => {
    const html = renderArchiviPage(ESEMPIO);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });

  it("lista vuota ([]): pagina completa con messaggio umano", () => {
    const html = renderArchiviPage([]);
    expect(html).toContain("Nessun archivio storico da mostrare.");
    expect(html).not.toContain("<ul class=\"archivi\">");
  });

  it("null (scansione fallita): pagina completa con messaggio di indisponibilità", () => {
    const html = renderArchiviPage(null);
    expect(html).toContain("Archivi momentaneamente non disponibili.");
  });

  it("token §2 presenti: colore testo #f2f3f8 e colore link #8fd3ff", () => {
    const html = renderArchiviPage(ESEMPIO);
    expect(html).toContain("#f2f3f8");
    expect(html).toContain("#8fd3ff");
  });

  it("un id canale con caratteri speciali esce escapato, mai HTML grezzo", () => {
    const html = renderArchiviPage([{ id: "<b>x", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" }]);
    expect(html).not.toContain("<b>x</span>");
    expect(html).toContain("&lt;b&gt;x");
  });

  it("giorni: 1 → singolare 'giorno' (non 'giorni')", () => {
    const html = renderArchiviPage([{ id: "island", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" }]);
    expect(html).toContain("1 giorno<");
  });
});
