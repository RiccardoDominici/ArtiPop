// feat-l-anteprima-del-link-condiviso-mostra-quel-giorno: quando il link di
// un giorno specifico (?c=<canale>&d=<data>, ciclo 48) viene condiviso,
// l'anteprima Open Graph deve mostrare QUEL wallpaper, non sempre quello di
// oggi di natura. Puro su renderPage/metaAnteprima, nessun binding — vedi
// anteprima-social.test.js per la copertura end-to-end sulla rotta `/`.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const ORIGIN = "https://artipop.test";
const OGGI = "2026-07-30";

function estraiMeta(html, prop) {
  const re = new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : null;
}

describe("renderPage: anteprima social senza giorno condiviso (invariata)", () => {
  it("og:image resta /w/natura?v=<oggi> e og:url resta l'origin", () => {
    const html = renderPage({}, ORIGIN, OGGI);

    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?v=${OGGI}`);
    expect(estraiMeta(html, "og:url")).toBe(ORIGIN);
  });
});

describe("renderPage: anteprima social con giorno condiviso", () => {
  const condiviso = { canale: "citta", data: "2026-07-28" };
  const htmlCondiviso = renderPage({}, ORIGIN, OGGI, condiviso);
  const htmlDefault = renderPage({}, ORIGIN, OGGI);

  it("og:image punta all'archivio del canale e giorno condivisi", () => {
    expect(estraiMeta(htmlCondiviso, "og:image")).toBe(`${ORIGIN}/w/citta?date=2026-07-28`);
  });

  it("og:url porta allo stesso link per-giorno condiviso", () => {
    expect(estraiMeta(htmlCondiviso, "og:url")).toBe(`${ORIGIN}/?c=citta&d=2026-07-28`);
  });

  it("og:title cita il canale e la data condivisi", () => {
    const titolo = estraiMeta(htmlCondiviso, "og:title");
    expect(titolo).toContain("citta");
    expect(titolo).toContain("28 luglio 2026");
  });

  it("il resto del documento (deck, comandi del viaggio, link apri/salva) è invariato", () => {
    const normalizza = (html) =>
      html.replace(/<meta property="og:(title|url|image)"[^>]*>\n?/g, "");

    // Solo i tre tag og: toccati differiscono; il body, gli script inline e
    // le altre meta (favicon, description, twitter:card) restano identici.
    expect(normalizza(htmlCondiviso)).toBe(normalizza(htmlDefault));

    for (const html of [htmlCondiviso, htmlDefault]) {
      expect(html).toContain('id="deck"');
      expect(html).toContain("apri l'immagine");
      expect(html).toContain("salva l'immagine");
    }
  });
});
