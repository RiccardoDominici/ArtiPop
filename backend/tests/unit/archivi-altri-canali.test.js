// feat-quel-giorno-negli-altri-canali: renderGiornoArchivio riceve
// `altriCanali` (array di id di canali attivi che hanno la STESSA data in
// archivio, calcolato in index.js) e, se non vuoto, emette un blocco
// server-side con miniatura e link verso `/archivi/<altroId>?date=<data>`,
// stesso pattern delle miniature precedente/successivo (archivi-giorno.test.js).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — quel giorno negli altri canali", () => {
  it("con altriCanali: mostra il blocco con link e miniatura verso l'altro canale, stessa data", () => {
    const html = renderGiornoArchivio({
      id: "natura", data: "2025-01-02", date: DATE, altriCanali: ["beta"],
    });
    expect(html).toContain('<nav class="altri-canali"');
    expect(html).toContain('href="/archivi/beta?date=2025-01-02"');
    expect(html).toContain('src="/w/beta?date=2025-01-02"');
    expect(html).toContain('width="60"');
    expect(html).toContain('height="128"');
  });

  it("con più canali: un link per ciascuno", () => {
    const html = renderGiornoArchivio({
      id: "natura", data: "2025-01-02", date: DATE, altriCanali: ["citta", "quiete"],
    });
    expect(html).toContain('href="/archivi/citta?date=2025-01-02"');
    expect(html).toContain('href="/archivi/quiete?date=2025-01-02"');
  });

  it("con altriCanali: [] (esplicito), nessun blocco", () => {
    const html = renderGiornoArchivio({
      id: "natura", data: "2025-01-02", date: DATE, altriCanali: [],
    });
    expect(html).not.toContain('<nav class="altri-canali"');
  });

  it("senza altriCanali (parametro assente): retrocompatibile, nessun blocco", () => {
    const html = renderGiornoArchivio({ id: "natura", data: "2025-01-02", date: DATE });
    expect(html).not.toContain('<nav class="altri-canali"');
  });

  it("nessuno <script> introdotto dal blocco: resta server-rendered senza JS", () => {
    const html = renderGiornoArchivio({
      id: "natura", data: "2025-01-02", date: DATE, altriCanali: ["beta"],
    });
    expect(html).not.toContain("<script");
  });
});
