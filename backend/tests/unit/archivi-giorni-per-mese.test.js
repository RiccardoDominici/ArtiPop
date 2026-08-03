// feat-l-archivio-storico-si-sfoglia-per-mese: l'elenco «tutti i N giorni»
// raggruppa le date per mese di calendario in <details class="mese">, così
// un archivio lungo si sfoglia invece di scorrere una colonna piatta.
// Copre le tre funzioni che condividono elencoGiorni() (archivi.js).
import { describe, it, expect } from "vitest";
import {
  renderArchiviPage,
  renderGiornoArchivio,
  renderArchivioNonTrovato,
} from "../../src/archivi.js";

const TRE_MESI = [
  "2026-08-02",
  "2026-08-01",
  "2026-07-15",
  "2026-06-01",
];

function storico(date) {
  return [
    {
      id: "island",
      giorni: date.length,
      prima: date[date.length - 1],
      ultima: date[0],
      date,
    },
  ];
}

describe("elencoGiorni — raggruppamento per mese (renderArchiviPage)", () => {
  it("tre mesi diversi → tre <details class=\"mese\"> nell'ordine ricevuto, con conteggio e singolare/plurale corretti", () => {
    const html = renderArchiviPage(storico(TRE_MESI));
    const occorrenze = html.match(/<details class="mese"/g) || [];
    expect(occorrenze.length).toBe(3);
    expect(html).toContain("agosto 2026 — 2 giorni");
    expect(html).toContain("luglio 2026 — 1 giorno");
    expect(html).toContain("giugno 2026 — 1 giorno");

    const iAgosto = html.indexOf("agosto 2026 — 2 giorni");
    const iLuglio = html.indexOf("luglio 2026 — 1 giorno");
    const iGiugno = html.indexOf("giugno 2026 — 1 giorno");
    expect(iAgosto).toBeLessThan(iLuglio);
    expect(iLuglio).toBeLessThan(iGiugno);
  });

  it("ogni data compare una e una sola volta come voce dell'elenco, ordine complessivo dalla più recente alla più vecchia", () => {
    const html = renderArchiviPage(storico(TRE_MESI));
    for (const d of TRE_MESI) {
      const occorrenze = html.split(d).length - 1;
      expect(occorrenze).toBeGreaterThanOrEqual(1);
    }
    const indici = TRE_MESI.map((d) => html.indexOf(`>${d}<`));
    for (let i = 1; i < indici.length; i++) {
      expect(indici[i - 1]).toBeLessThan(indici[i]);
    }
  });

  it("un solo mese: quel gruppo resta aperto (open) anche senza dataCorrente", () => {
    const html = renderArchiviPage(storico(["2026-08-02", "2026-08-01"]));
    expect(html).toContain('<details class="mese" open>');
    expect((html.match(/<details class="mese"/g) || []).length).toBe(1);
  });

  it("senza dataCorrente (card di /archivi): con più mesi nessun gruppo è open", () => {
    const html = renderArchiviPage(storico(TRE_MESI));
    expect(html).not.toContain('<details class="mese" open>');
  });

  it("chiave malformata: nessun 'Invalid Date'/'NaN' nell'HTML, finisce nel gruppo «altri giorni» ancora cliccabile", () => {
    const html = renderArchiviPage(storico(["2026-08-01", "2026-13-99", "non-una-data"]));
    expect(html).not.toContain("Invalid Date");
    expect(html).not.toContain("NaN");
    expect(html).toContain("altri giorni");
    expect(html).toContain('<a href="/archivi/island?date=2026-13-99">');
    expect(html).toContain('<a href="/archivi/island?date=non-una-data">');
  });

  it("date vuoto o non array: nessun <details> emesso (comportamento invariato)", () => {
    const htmlVuoto = renderArchiviPage([
      { id: "bloom", giorni: 0, prima: "", ultima: "", date: [] },
    ]);
    expect(htmlVuoto).not.toContain("<details");

    const htmlAssente = renderArchiviPage([
      { id: "bloom", giorni: 0, prima: "", ultima: "" },
    ]);
    expect(htmlAssente).not.toContain("<details");
  });

  it("nessuno <script> e nessuna fetch( nell'HTML", () => {
    const html = renderArchiviPage(storico(TRE_MESI));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});

describe("elencoGiorni — raggruppamento per mese (renderGiornoArchivio)", () => {
  it("dataCorrente nel secondo mese: solo quel <details class=\"mese\"> è open, la voce corrente è uno span non cliccabile con il suo ↓", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2026-07-15", date: TRE_MESI });
    expect((html.match(/<details class="mese" open>/g) || []).length).toBe(1);

    const iOpen = html.indexOf('<details class="mese" open>');
    const iFineGruppo = html.indexOf("</details>", iOpen);
    const blocco = html.slice(iOpen, iFineGruppo);
    expect(blocco).toContain("luglio 2026");
    expect(blocco).toContain(
      '<span aria-current="page"><img class="minigiorno" src="/w/island?date=2026-07-15" alt="" loading="lazy" decoding="async" width="44" height="94" />2026-07-15</span>',
    );
    expect(blocco).toContain('href="/w/island?date=2026-07-15&amp;dl=1"');
    expect(html).not.toContain('href="/archivi/island?date=2026-07-15"');
  });

  it("un solo <script>, quello delle scorciatoie da tastiera, e nessuna fetch( nell'HTML anche con più mesi", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2026-07-15", date: TRE_MESI });
    expect((html.match(/<script/g) || []).length).toBe(1); // solo le scorciatoie da tastiera (§2.2)
    expect(html).not.toContain("fetch(");
  });
});

describe("elencoGiorni — raggruppamento per mese (renderArchivioNonTrovato)", () => {
  it("più mesi, nessuna dataCorrente: nessun gruppo open, nessun 'Invalid Date'", () => {
    const html = renderArchivioNonTrovato("island", TRE_MESI);
    expect(html).not.toContain('<details class="mese" open>');
    expect(html).not.toContain("Invalid Date");
    expect(html).not.toContain("NaN");
  });

  it("nessuno <script> né fetch( nell'HTML", () => {
    const html = renderArchivioNonTrovato("island", TRE_MESI);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});
