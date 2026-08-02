// feat-l-archivio-storico-dice-dove-continua-la-storia: renderArchiviPage
// aggiunge, quando esiste, una riga che indica il flusso attivo che ha
// raccolto l'eredità del canale storico (LEGACY_ALIASES di channels.js).
// Nessun binding, nessuna rete: chiamata diretta come archivi-pagina.test.js.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

describe("renderArchiviPage — eredità del canale storico", () => {
  it("island ha un erede attivo (natura): la card contiene il link /?c=natura e il nome Natura", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
    ]);
    expect(html).toContain('href="/?c=natura"');
    expect(html).toContain("Natura");
  });

  it("studio ha un erede attivo (quiete): la card contiene il link /?c=quiete", () => {
    const html = renderArchiviPage([
      { id: "studio", giorni: 5, prima: "2025-01-01", ultima: "2025-01-05" },
    ]);
    expect(html).toContain('href="/?c=quiete"');
    expect(html).toContain("Quiete");
  });

  it("un id senza alias non mostra alcun link /?c= e la card resta valida", () => {
    const html = renderArchiviPage([
      { id: "sconosciuto", giorni: 2, prima: "2025-01-01", ultima: "2025-01-02" },
    ]);
    expect(html).not.toContain("/?c=");
    expect(html).toContain("sconosciuto");
    expect(html).toContain("2 giorni");
    expect(html).toContain('<time datetime="2025-01-01">1 gennaio 2025</time> → <time datetime="2025-01-02">2 gennaio 2025</time>');
    expect(html).toContain("Riapri l'ultimo giorno →");
  });

  it("l'HTML servito continua a non contenere né <script né fetch(", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
      { id: "sconosciuto", giorni: 2, prima: "2025-01-01", ultima: "2025-01-02" },
    ]);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });

  it("lista vuota ([]) e scansione fallita (null) restano invariate", () => {
    expect(renderArchiviPage([])).toContain("Nessun archivio storico da mostrare.");
    expect(renderArchiviPage(null)).toContain("Archivi momentaneamente non disponibili.");
  });
});
