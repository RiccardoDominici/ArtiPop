// feat-l-archivio-del-mese-si-sfoglia-a-colpo-d-occhio: ogni voce di giorno
// nell'elenco «tutti i N giorni» porta una miniatura 44×94 (/w/<id>?date=<data>,
// byte-stabile e cacheata immutable), così si riconosce a occhio il wallpaper
// da riaprire senza aprire il giorno. La miniatura vive dentro l'ancora già
// esistente: nessuna nuova area toccabile, nessun doppio annuncio allo
// screen reader (alt="" decorativa, testo accessibile invariato).
import { describe, it, expect } from "vitest";
import {
  renderArchiviPage,
  renderGiornoArchivio,
} from "../../src/archivi.js";

const DATE = ["2026-01-03", "2026-01-02", "2026-01-01"];

function storico(id, date) {
  return [{ id, giorni: date.length, prima: date[date.length - 1], ultima: date[0], date }];
}

describe("miniatura per ogni giorno dell'elenco per mese", () => {
  it("a. ogni data ha una <img class=\"minigiorno\"> col src /w/<id>?date=<data> esatto, lazy e decorativa", () => {
    const html = renderArchiviPage(storico("island", DATE));
    for (const d of DATE) {
      expect(html).toContain(
        `<img class="minigiorno" src="/w/island?date=${d}" alt="" loading="lazy" decoding="async" width="44" height="94" />`,
      );
    }
  });

  it("b. la miniatura sta dentro l'ancora del giorno: nessuna seconda area toccabile, tante minigiorno quante date", () => {
    const html = renderArchiviPage(storico("island", DATE));
    const iApertura = html.indexOf('<details class="giorni">');
    const iChiusura = html.lastIndexOf("</details>");
    const blocco = html.slice(iApertura, iChiusura);
    const minigiorni = blocco.match(/<img class="minigiorno"/g) || [];
    expect(minigiorni.length).toBe(DATE.length);
    for (const d of DATE) {
      const iLink = blocco.indexOf(`href="/archivi/island?date=${d}"`);
      expect(iLink).toBeGreaterThan(-1);
      const iAperturaAncora = blocco.lastIndexOf("<a", iLink);
      const iChiusuraAncora = blocco.indexOf("</a>", iLink);
      const dentroAncora = blocco.slice(iAperturaAncora, iChiusuraAncora);
      expect(dentroAncora).toContain(`<img class="minigiorno" src="/w/island?date=${d}"`);
    }
  });

  it("c. id e data con caratteri speciali sono passati per encodeURIComponent: nessuna iniezione nel src", () => {
    const html = renderArchiviPage(storico('is"land&x', ["2026-01-0<1"]));
    expect(html).toContain(
      `<img class="minigiorno" src="/w/${encodeURIComponent('is"land&x')}?date=${encodeURIComponent("2026-01-0<1")}"`,
    );
    expect(html).not.toContain('src="/w/is"land');
    expect(html).not.toContain("<1\"");
  });

  it("d. archivio vuoto: nessuna minigiorno e nessun crash", () => {
    const html = renderArchiviPage(storico("island", []));
    expect(html).not.toContain('<img class="minigiorno"');
  });

  it("e. le date malformate del gruppo «altri giorni» restano elencate con la loro miniatura", () => {
    const conMalformata = [...DATE, "non-una-data"];
    const html = renderArchiviPage(storico("island", conMalformata));
    expect(html).toContain("altri giorni");
    expect(html).toContain(
      '<a href="/archivi/island?date=non-una-data"><img class="minigiorno" src="/w/island?date=non-una-data"',
    );
  });

  it("la voce del giorno mostrato (span aria-current) porta comunque la sua miniatura", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2026-01-02", date: DATE });
    expect(html).toContain(
      '<span aria-current="page"><img class="minigiorno" src="/w/island?date=2026-01-02" alt="" loading="lazy" decoding="async" width="44" height="94" />2026-01-02</span>',
    );
  });
});
