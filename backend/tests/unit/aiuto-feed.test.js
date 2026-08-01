// feat-l-aiuto-spiega-il-feed-del-canale: la FAQ esistente «Posso cambiare
// canale?» si arricchisce con la spiegazione di come seguire un canale dal
// lettore di feed (/feed/<canale>.xml). Nessuna voce nuova: si tocca solo la
// risposta, non la domanda. Test puro su renderHelpPage() — nessun binding,
// nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — spiegazione del feed del canale", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it('la voce "Posso cambiare canale?" spiega come seguire il canale dal feed', () => {
    const voce = estraiVoce(html, "Posso cambiare canale?");
    for (const termine of ["/feed/", "/feed/natura.xml", "lettore di feed"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la menzione del feed sta dentro il <details> di quella voce e non altrove", () => {
    const idx = html.indexOf("Posso cambiare canale?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const fineDetails = html.indexOf("</details>", idx);
    const primaOccorrenza = html.indexOf("/feed/");
    expect(primaOccorrenza).toBeGreaterThan(inizioDetails);
    expect(primaOccorrenza).toBeLessThan(fineDetails);
  });

  it("il numero di voci <details> resta invariato (15)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(15);
  });

  it("gli id delle ancore restano tutti distinti", () => {
    const ids = [...html.matchAll(/<details[^>]*\bid="([^"]*)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);
  });

  it('l\'id dell\'ancora della voce arricchita è invariato', () => {
    const idx = html.indexOf("Posso cambiare canale?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const tag = html.slice(inizioDetails, html.indexOf(">", inizioDetails) + 1);
    const m = tag.match(/id="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe("d-posso-cambiare-canale");
  });
});
