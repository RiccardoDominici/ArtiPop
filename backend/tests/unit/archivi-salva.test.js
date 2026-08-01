// feat-il-giorno-d-archivio-si-salva-con-un-nome-che-si-capisce: ogni giorno
// di un canale storico si può anche SALVARE, non solo aprire — link verso
// /w/<id>?date=<data>&dl=1 (contratto content-disposition già in
// backend/src/index.js:616-629), accanto all'ultimo giorno e a ogni data
// dell'elenco espandibile.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

const CON_ULTIMA_E_DATE = [
  {
    id: "island",
    giorni: 3,
    prima: "2025-01-01",
    ultima: "2025-01-03",
    date: ["2025-01-03", "2025-01-02", "2025-01-01"],
  },
];

describe("renderArchiviPage(storici) — link di salvataggio (dl=1)", () => {
  it("card con ultima valorizzata: link di salvataggio verso /w/<id>?date=<ultima>&dl=1", () => {
    const html = renderArchiviPage(CON_ULTIMA_E_DATE);
    expect(html).toContain('<a class="salva" href="/w/island?date=2025-01-03&amp;dl=1">Salva</a>');
  });

  it("ogni data dell'elenco ha il proprio link con dl=1 e aria-label non vuoto", () => {
    const html = renderArchiviPage(CON_ULTIMA_E_DATE);
    const occorrenze = html.match(/class="salva-giorno"/g) || [];
    expect(occorrenze.length).toBe(3);
    expect(html).toContain('/w/island?date=2025-01-03&amp;dl=1" aria-label="Salva il wallpaper del 2025-01-03"');
    expect(html).toContain('/w/island?date=2025-01-02&amp;dl=1" aria-label="Salva il wallpaper del 2025-01-02"');
    expect(html).toContain('/w/island?date=2025-01-01&amp;dl=1" aria-label="Salva il wallpaper del 2025-01-01"');
  });

  it("canale senza ultima e senza date: nessun dl=1, nessun contenitore vuoto", () => {
    const html = renderArchiviPage([
      { id: "bloom", giorni: 0, prima: "", ultima: "" },
    ]);
    expect(html).not.toContain("dl=1");
    expect(html).not.toContain('class="salva"');
    expect(html).not.toContain('class="salva-giorno"');
  });

  it("storici === null: pagina 200-renderizzabile, messaggio umano, nessun dl=1", () => {
    const html = renderArchiviPage(null);
    expect(html).toContain("Archivi momentaneamente non disponibili.");
    expect(html).not.toContain("dl=1");
  });

  it("storici === []: pagina 200-renderizzabile, messaggio umano, nessun dl=1", () => {
    const html = renderArchiviPage([]);
    expect(html).toContain("Nessun archivio storico da mostrare.");
    expect(html).not.toContain("dl=1");
  });

  it("nessuno <script> e nessuna fetch( nell'HTML anche con i link di salvataggio", () => {
    const html = renderArchiviPage(CON_ULTIMA_E_DATE);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });

  it("i link preesistenti restano presenti e invariati", () => {
    const html = renderArchiviPage(CON_ULTIMA_E_DATE);
    expect(html).toContain("Riapri l'ultimo giorno →");
    expect(html).toContain('class="copertina"');
    expect(html).toContain('<details class="giorni">');
  });
});
