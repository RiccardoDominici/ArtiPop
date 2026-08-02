// feat-l-archivio-chiama-i-canali-col-loro-nome: le pagine d'archivio mostrano il
// nome vero del canale ATTIVO (con la sua tagline in card) al posto dell'id nudo,
// come fa già la home — coerente con `getChannel`/CHANNELS di channels.js. I canali
// storici (senza `name`) restano come oggi: id come nome, nessuna tagline. Nessun
// binding, nessuna rete: chiamata diretta come gli altri test di questo modulo.
import { describe, it, expect } from "vitest";
import { renderArchiviPage, renderGiornoArchivio } from "../../src/archivi.js";
import { CHANNELS } from "../../src/channels.js";

const natura = CHANNELS.find((c) => c.id === "natura");

describe("renderArchiviPage — nome e tagline del canale attivo", () => {
  it("un canale attivo mostra il name e la tagline di CHANNELS, non l'id nudo", () => {
    const html = renderArchiviPage([
      { id: "natura", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", attivo: true },
    ]);
    expect(html).toContain(`<span class="nome">${natura.name}</span>`);
    expect(html).toContain(`<div class="soggetto">${natura.tagline}</div>`);
  });

  it("un canale storico (island) mostra l'id come nome e nessuna tagline", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
    ]);
    expect(html).toContain(`<span class="nome">island</span>`);
    expect(html).not.toContain(natura.tagline);
  });
});

describe("renderGiornoArchivio — nome del canale attivo", () => {
  it("un canale attivo ha <h1> col name", () => {
    const html = renderGiornoArchivio({ id: "natura", data: "2025-01-02", date: ["2025-01-02"] });
    expect(html).toContain(`<h1>${natura.name}</h1>`);
  });

  it("un canale storico (island) ha <h1> con l'id", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: ["2025-01-02"] });
    expect(html).toContain("<h1>island</h1>");
  });

  it("<title> e description restano sull'id grezzo anche per un canale attivo", () => {
    const html = renderGiornoArchivio({ id: "natura", data: "2025-01-02", date: ["2025-01-02"] });
    expect(html).toContain("<title>ArtiPop — natura, 2025-01-02</title>");
    expect(html).toContain('content="Il giorno 2025-01-02 dell\'archivio storico di natura."');
  });

  it("nessuno <script> né in /archivi né nella pagina del giorno di un canale attivo", () => {
    const htmlElenco = renderArchiviPage([
      { id: "natura", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", attivo: true },
    ]);
    const htmlGiorno = renderGiornoArchivio({ id: "natura", data: "2025-01-02", date: ["2025-01-02"] });
    expect(htmlElenco).not.toContain("<script");
    expect(htmlElenco).not.toContain("fetch(");
    expect(htmlGiorno).not.toContain("<script");
    expect(htmlGiorno).not.toContain("fetch(");
  });
});
