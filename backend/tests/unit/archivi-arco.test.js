// feat-il-giorno-d-archivio-mostra-tutto-il-suo-arco: la pagina del giorno
// d'archivio aggiunge la striscia dei giorni dello STESSO arco narrativo
// subito dopo la riga di posizione — `renderGiornoArchivio` è pura, nessun
// `env`, stesso schema di archivi-posizione.test.js.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = [
  "2025-01-07", "2025-01-06", "2025-01-05", "2025-01-04",
  "2025-01-03", "2025-01-02", "2025-01-01",
];

const ARCO = [
  { data: "2025-01-01", giornoNellArco: 1, tappa: 1 },
  { data: "2025-01-02", giornoNellArco: 2, tappa: 1 },
  { data: "2025-01-03", giornoNellArco: 3, tappa: 2 },
  { data: "2025-01-04", giornoNellArco: 4, tappa: 2 },
  { data: "2025-01-05", giornoNellArco: 5, tappa: 3 },
  { data: "2025-01-06", giornoNellArco: 6, tappa: 3 },
  { data: "2025-01-07", giornoNellArco: 7, tappa: 4 },
];

function blocco(html) {
  const inizio = html.indexOf('<nav class="arco"');
  const fine = html.indexOf("</nav>", inizio);
  return html.slice(inizio, fine + "</nav>".length);
}

describe("renderGiornoArchivio — striscia dell'arco", () => {
  it("arco di 7 giorni: una sola <nav class=\"arco\">, 7 <li>, un link per ogni data non corrente", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-04", date: DATE, arco: ARCO });
    expect((html.match(/<nav class="arco"/g) || []).length).toBe(1);
    const b = blocco(html);
    expect((b.match(/<li>/g) || []).length).toBe(7);
    for (const v of ARCO) {
      if (v.data === "2025-01-04") continue;
      expect(b).toContain(`href="/archivi/island?date=${v.data}"`);
    }
  });

  it("il giorno corrente è <span aria-current=\"page\"> e non un link, dentro la striscia", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-04", date: DATE, arco: ARCO });
    const b = blocco(html);
    expect(b).toContain('<span aria-current="page">');
    expect(b).not.toContain('href="/archivi/island?date=2025-01-04"');
  });

  it("le etichette riportano il numero di giorno e tappa dell'arco, o ripiegano sulla data", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-04", date: DATE,
      arco: [
        ...ARCO.slice(0, 2),
        { data: "2025-01-03", giornoNellArco: null, tappa: null },
        ...ARCO.slice(3),
      ],
    });
    expect(html).toContain("giorno 4");
    expect(html).toContain("tappa 2");
    const b = blocco(html);
    expect(b).toContain(">2025-01-03<");
  });

  it("con arco assente o con un solo giorno la striscia non si rende", () => {
    const senzaArco = renderGiornoArchivio({ id: "island", data: "2025-01-04", date: DATE, arco: [] });
    expect(senzaArco).not.toContain('<nav class="arco"');

    const unGiorno = renderGiornoArchivio({
      id: "island", data: "2025-01-04", date: DATE,
      arco: [{ data: "2025-01-04", giornoNellArco: 1, tappa: 1 }],
    });
    expect(unGiorno).not.toContain('<nav class="arco"');
  });

  it("la <nav> porta l'aria-label previsto", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-04", date: DATE, arco: ARCO });
    expect(html).toContain('<nav class="arco" aria-label="I giorni di questo arco">');
  });

  it("escaping: id e date con caratteri da escapare non producono markup grezzo", () => {
    const html = renderGiornoArchivio({
      id: 'is"land&x',
      data: "2025-01-01",
      date: ["2025-01-01", "2025-01-0<1"],
      arco: [
        { data: "2025-01-01", giornoNellArco: 1, tappa: 1 },
        { data: "2025-01-0<1", giornoNellArco: 2, tappa: 1 },
      ],
    });
    expect(html).not.toContain('src="/w/is"land');
    const b = blocco(html);
    expect(b).toContain(`date=${encodeURIComponent("2025-01-0<1")}`);
    expect(b).toContain(encodeURIComponent('is"land&x'));
  });

  it("con la striscia presente resta un solo <script> e nessuna fetch(", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-04", date: DATE, arco: ARCO });
    expect((html.match(/<script/g) || []).length).toBe(1);
    expect(html).not.toContain("fetch(");
  });
});
