// feat-l-archivio-storico-si-riconosce-a-colpo-d-occhio: ogni card di
// /archivi mostra una miniatura dell'ultimo giorno (stessa immagine già
// servita da /w/<id>?date=<ultima>), così chi riapre un vecchio archivio
// vede subito com'era il canale invece di indovinare da un id nudo.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

describe("renderArchiviPage(storici) — miniatura di copertina", () => {
  it("una voce storica con ultima: <img> lazy con src /w/<id>?date=<ultima> e alt vuoto", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
    ]);
    expect(html).toContain('<img src="/w/island?date=2025-01-12"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt=""');
  });

  it("una voce senza ultima (stringa vuota): nessun <img> di copertina, pagina resta valida", () => {
    const html = renderArchiviPage([
      { id: "bloom", giorni: 2, prima: "2025-02-01", ultima: "" },
    ]);
    expect(html).not.toContain("<img");
    expect(html).toContain("bloom");
    expect(html).toContain("2 giorni");
  });

  it("id e data con caratteri da codificare: src percent-encoded, nessuna iniezione HTML", () => {
    const html = renderArchiviPage([
      { id: "<b>x", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01&x=<y>" },
    ]);
    expect(html).toContain(
      `src="/w/${encodeURIComponent("<b>x")}?date=${encodeURIComponent("2025-01-01&x=<y>")}"`
    );
    expect(html).not.toContain("<img src=\"/w/<b>x");
    expect(html).not.toContain("<y>\"");
  });

  it("renderArchiviPage([]): messaggio umano invariato, nessun <img> di copertina", () => {
    const html = renderArchiviPage([]);
    expect(html).toContain("Nessun archivio storico da mostrare.");
    expect(html).not.toContain("<img");
  });

  it("renderArchiviPage(null): messaggio umano invariato, nessun <img> di copertina", () => {
    const html = renderArchiviPage(null);
    expect(html).toContain("Archivi momentaneamente non disponibili.");
    expect(html).not.toContain("<img");
  });

  it("nessuno <script> e nessuna fetch( nell'HTML: pagina resta senza JS", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
    ]);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});
