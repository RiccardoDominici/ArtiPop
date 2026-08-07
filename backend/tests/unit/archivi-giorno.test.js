// feat-il-giorno-d-archivio-si-apre-dentro-il-sito: renderGiornoArchivio è
// pura e testabile senza env, stesso schema di renderArchiviPage. Mostra il
// wallpaper di UN giorno con data/canale e la barra precedente/successivo,
// calcolata dall'array `date` (dalla più recente alla più vecchia).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — struttura di base", () => {
  it("mostra la data, il nome del canale e l'immagine con alt non vuoto", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain("island");
    expect(html).toContain("2025-01-02");
    expect(html).toContain('<img src="/w/island?date=2025-01-02"');
    const altMatch = html.match(/<img[^>]*alt="([^"]*)"/);
    expect(altMatch).not.toBeNull();
    expect(altMatch[1].length).toBeGreaterThan(0);
  });

  it("un solo <script> (scorciatoie + copia link) e nessuna fetch( nell'HTML: pagina server-rendered", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1); // tastiera + copia link, stesso blocco (§2.2)
    expect(html).not.toContain("fetch(");
  });

  it("link verso l'elenco /archivi", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/archivi"');
  });
});

describe("renderGiornoArchivio — precedente/successivo", () => {
  it("a metà archivio: entrambi i comandi presenti, verso le date corrette", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/archivi/island?date=2025-01-01"');
    expect(html).toContain('href="/archivi/island?date=2025-01-03"');
    expect(html).toContain("giorno precedente");
    expect(html).toContain("giorno successivo");
  });

  it("al giorno più recente (bordo): nessun comando 'successivo', 'precedente' presente", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-03", date: DATE });
    expect(html).toContain('href="/archivi/island?date=2025-01-02"');
    expect(html).toContain("giorno precedente");
    expect(html).not.toContain("giorno successivo");
  });

  it("al giorno più vecchio (bordo): nessun comando 'precedente', 'successivo' presente", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-01", date: DATE });
    expect(html).toContain('href="/archivi/island?date=2025-01-02"');
    expect(html).toContain("giorno successivo");
    expect(html).not.toContain("giorno precedente");
  });

  it("archivio di un solo giorno: né precedente né successivo", () => {
    const html = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    expect(html).not.toContain("giorno precedente");
    expect(html).not.toContain("giorno successivo");
  });
});

describe("renderGiornoArchivio — soggetto ed erede", () => {
  it("soggetto con entrambi i nomi: riga soggetto presente", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE,
      soggetto: { elementNome: "Isola", conceptNome: "Costruzione" },
    });
    expect(html).toContain('<div class="soggetto">Isola · Costruzione</div>');
  });

  it("soggetto assente: nessuna riga class=\"soggetto\"", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain('class="soggetto"');
  });

  it("island ha un erede attivo (natura): riga con link /?c=natura", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/?c=natura"');
  });

  it("un id senza alias non mostra alcun link /?c=", () => {
    const html = renderGiornoArchivio({ id: "sconosciuto", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("/?c=");
  });
});

describe("renderGiornoArchivio — salvataggio ed escaping", () => {
  it("link di salvataggio verso /w/<id>?date=<data>&dl=1", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/w/island?date=2025-01-02&amp;dl=1"');
  });

  it("id e date con caratteri da escapare: nessuna iniezione HTML", () => {
    const html = renderGiornoArchivio({
      id: "<b>x", data: "2025-01-01&x=<y>", date: ["2025-01-01&x=<y>"],
      soggetto: { elementNome: "<i>El</i>", conceptNome: "A&B" },
    });
    expect(html).not.toContain("<b>x");
    expect(html).not.toContain("<i>El</i>");
    expect(html).not.toContain("<y>\"");
    expect(html).toContain("&lt;b&gt;x");
    expect(html).toContain("&lt;i&gt;El&lt;/i&gt;");
  });
});
