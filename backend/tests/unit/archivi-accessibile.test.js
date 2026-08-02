// feat-l-archivio-storico-si-legge-anche-con-lo-screen-reader: i link
// ripetuti fra le card di /archivi ("Riapri l'ultimo giorno", "Salva",
// l'immagine di copertina duplicata) annunciano di quale canale parlano,
// invece di essere tutti identici per lo screen reader.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";

const DUE_CARD = [
  {
    id: "island",
    giorni: 3,
    prima: "2025-01-01",
    ultima: "2025-01-03",
    date: ["2025-01-03", "2025-01-02", "2025-01-01"],
  },
  {
    id: "bloom",
    giorni: 1,
    prima: "2025-02-01",
    ultima: "2025-02-01",
    date: ["2025-02-01"],
  },
];

describe("renderArchiviPage(storici) — accessibilità screen reader", () => {
  it("ogni a.copertina è nascosto alle tecnologie assistive (link-immagine duplicato)", () => {
    const html = renderArchiviPage(DUE_CARD);
    const occorrenze = html.match(/class="copertina"/g) || [];
    expect(occorrenze.length).toBe(2);
    expect(html).toContain('<a class="copertina" aria-hidden="true" tabindex="-1" href="/archivi/island?date=2025-01-03">');
    expect(html).toContain('<a class="copertina" aria-hidden="true" tabindex="-1" href="/archivi/bloom?date=2025-02-01">');
  });

  it("ogni a.riapri ha un aria-label con l'id del proprio canale, diverso fra le card", () => {
    const html = renderArchiviPage(DUE_CARD);
    expect(html).toContain('aria-label="Riapri l\'ultimo giorno di island"');
    expect(html).toContain('aria-label="Riapri l\'ultimo giorno di bloom"');
  });

  it("ogni a.salva ha un aria-label con l'id del proprio canale, diverso fra le card", () => {
    const html = renderArchiviPage(DUE_CARD);
    expect(html).toContain('aria-label="Salva l\'ultimo wallpaper di island"');
    expect(html).toContain('aria-label="Salva l\'ultimo wallpaper di bloom"');
  });

  it("il summary dell'elenco giorni ha un aria-label con id e conteggio, plurale coerente", () => {
    const html = renderArchiviPage(DUE_CARD);
    expect(html).toContain('aria-label="tutti i 3 giorni di island"');
    expect(html).toContain('aria-label="tutti i 1 giorno di bloom"');
  });

  it("un id con caratteri da escapare finisce escapato nei nuovi attributi", () => {
    const html = renderArchiviPage([
      {
        id: 'a"b',
        giorni: 1,
        prima: "2025-03-01",
        ultima: "2025-03-01",
        date: ["2025-03-01"],
      },
    ]);
    expect(html).not.toContain('di a"b"');
    expect(html).toContain('aria-label="Riapri l\'ultimo giorno di a&quot;b"');
    expect(html).toContain('aria-label="Salva l\'ultimo wallpaper di a&quot;b"');
    expect(html).toContain('aria-label="tutti i 1 giorno di a&quot;b"');
  });

  it("storici === []: nessun attributo orfano, messaggio umano invariato", () => {
    const html = renderArchiviPage([]);
    expect(html).toContain("Nessun archivio storico da mostrare.");
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("aria-label=\"Riapri");
    expect(html).not.toContain("aria-label=\"Salva l'ultimo wallpaper");
  });

  it("storici === null: nessun attributo orfano, messaggio umano invariato", () => {
    const html = renderArchiviPage(null);
    expect(html).toContain("Archivi momentaneamente non disponibili.");
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("aria-label=\"Riapri");
    expect(html).not.toContain("aria-label=\"Salva l'ultimo wallpaper");
  });
});
