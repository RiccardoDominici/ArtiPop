// feat-l-archivio-chiama-i-canali-col-loro-nome: card, titolo del giorno,
// title, description, anteprima condivisa e aria-label che citano un canale
// devono mostrare il nome vero (Natura, Città, Quiete) per i canali ancora
// attivi, l'id invariato per gli storici — mai gli href o i parametri di
// query, che restano sempre sull'id tecnico. Nessun binding, nessuna rete:
// chiamata diretta come archivi-pagina.test.js.
import { describe, it, expect } from "vitest";
import { renderArchiviPage, renderGiornoArchivio } from "../../src/archivi.js";

describe("renderArchiviPage — nome del canale nella card", () => {
  it("canale attivo (natura): .nome mostra «Natura», non l'id", () => {
    const html = renderArchiviPage([
      { id: "natura", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", attivo: true },
    ]);
    expect(html).toContain('<span class="nome">Natura</span>');
    expect(html).not.toContain('<span class="nome">natura</span>');
  });

  it("canale storico (island): .nome resta sull'id", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03" },
    ]);
    expect(html).toContain('<span class="nome">island</span>');
  });

  it("id sconosciuto: .nome resta sull'id, nessun crash", () => {
    const html = renderArchiviPage([
      { id: "sconosciuto", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" },
    ]);
    expect(html).toContain('<span class="nome">sconosciuto</span>');
  });

  it("canale attivo: aria-label di Salva e Riapri citano il nome vero, gli href restano sull'id", () => {
    const html = renderArchiviPage([
      { id: "quiete", giorni: 2, prima: "2025-01-01", ultima: "2025-01-02", attivo: true },
    ]);
    expect(html).toContain(`aria-label="Salva l'ultimo wallpaper di Quiete"`);
    expect(html).toContain(`aria-label="Riapri l'ultimo giorno di Quiete"`);
    expect(html).toContain('href="/w/quiete?date=2025-01-02&amp;dl=1"');
    expect(html).toContain('href="/archivi/quiete?date=2025-01-02"');
  });
});

describe("renderGiornoArchivio — nome del canale nel titolo e nelle etichette", () => {
  const BASE = { id: "citta", data: "2026-06-01", date: ["2026-06-02", "2026-06-01", "2026-05-31"] };

  it("canale attivo: <h1> e <title> mostrano il nome vero", () => {
    const html = renderGiornoArchivio(BASE);
    expect(html).toContain("<h1>Città</h1>");
    expect(html).toContain("<title>ArtiPop — Città, 2026-06-01</title>");
  });

  it("canale attivo: la meta description cita il nome vero", () => {
    const html = renderGiornoArchivio(BASE);
    expect(html).toContain('<meta name="description" content="Il giorno 2026-06-01 dell\'archivio storico di Città.')
  });

  it("canale attivo: aria-label di apri immagine e alt citano il nome vero, l'href resta sull'id", () => {
    const html = renderGiornoArchivio(BASE);
    expect(html).toContain(`aria-label="Apri a grandezza piena il wallpaper di Città del 2026-06-01"`);
    expect(html).toContain(`alt="Città — sfondo del 2026-06-01"`);
    expect(html).toContain('href="/w/citta?date=2026-06-01"');
  });

  it("canale attivo con almeno 2 giorni: aria-label di «un giorno a caso» cita il nome vero", () => {
    const html = renderGiornoArchivio(BASE);
    expect(html).toContain(`aria-label="Apri un giorno a caso dell'archivio di Città"`);
  });

  it("canale storico (island): <h1>, <title> e aria-label restano sull'id", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-01", date: ["2025-01-01"] });
    expect(html).toContain("<h1>island</h1>");
    expect(html).toContain("<title>ArtiPop — island, 2025-01-01</title>");
  });

  it("id sconosciuto: nessun crash, id invariato in <h1>", () => {
    const html = renderGiornoArchivio({ id: "sconosciuto", data: "2025-01-01", date: ["2025-01-01"] });
    expect(html).toContain("<h1>sconosciuto</h1>");
  });
});
