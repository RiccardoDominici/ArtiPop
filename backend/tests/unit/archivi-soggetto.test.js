// feat-l-archivio-storico-dice-cosa-si-vedeva: ogni card di /archivi mostra
// il soggetto (element + concept) dell'ultimo giorno del canale, così si
// capisce cosa si sta per aprire prima di aprirlo — non solo un id tecnico.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

describe("renderArchiviPage(storici) — riga del soggetto", () => {
  it("voce con elementNome e conceptNome: riga soggetto con entrambi i nomi", () => {
    const html = renderArchiviPage([
      {
        id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12",
        elementNome: "Isola", conceptNome: "Costruzione",
      },
    ]);
    expect(html).toContain('<div class="soggetto">Isola · Costruzione</div>');
  });

  it("voce senza elementNome né conceptNome: nessuna riga class=\"soggetto\"", () => {
    const html = renderArchiviPage([
      { id: "horizon", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03" },
    ]);
    expect(html).not.toContain('class="soggetto"');
  });

  it("voce con un solo nome presente: riga emessa, nessun separatore orfano", () => {
    const html = renderArchiviPage([
      {
        id: "bloom", giorni: 2, prima: "2025-02-01", ultima: "2025-02-02",
        elementNome: "Girasole", conceptNome: "",
      },
    ]);
    expect(html).toContain('<div class="soggetto">Girasole</div>');
    expect(html).not.toContain("Girasole ·");
    expect(html).not.toContain("· Girasole");
  });

  it("nomi con caratteri speciali: escapati, nessun tag iniettato", () => {
    const html = renderArchiviPage([
      {
        id: "neon", giorni: 5, prima: "2025-01-01", ultima: "2025-01-05",
        elementNome: "<b>Neon</b>", conceptNome: "Tim&Lapse's",
      },
    ]);
    expect(html).not.toContain("<b>Neon</b>");
    expect(html).toContain("&lt;b&gt;Neon&lt;/b&gt;");
    expect(html).toContain("Tim&amp;Lapse&#39;s");
  });

  it("chiamata legacy (voci prive dei nuovi campi): HTML invariato rispetto ai cicli 80-86", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
    ]);
    expect(html).toContain("island");
    expect(html).toContain("12 giorni");
    expect(html).not.toContain('class="soggetto"');
  });
});
