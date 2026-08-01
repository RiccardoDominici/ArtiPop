// feat-l-aiuto-spiega-come-sfogliare-il-viaggio: la FAQ esistente «Come funziona
// la storia degli sfondi?» si arricchisce con la spiegazione di come sfogliare
// il viaggio dalla home (frecce, archi, torna a oggi). Nessuna voce nuova: si
// tocca solo la risposta, non la domanda. Test puro su renderHelpPage() —
// nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — spiegazione dello sfoglio del viaggio", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it('la voce "Come funziona la storia degli sfondi?" spiega lo sfoglio del viaggio', () => {
    const voce = estraiVoce(html, "Come funziona la storia degli sfondi?");
    for (const termine of [
      "frecce",
      "torna a oggi",
      "arco precedente",
      "arco successivo",
      "scegli l'arco",
      "leggi la storia",
      "?date=",
    ]) {
      expect(voce).toContain(termine);
    }
  });

  it("il numero di voci <details> resta invariato (15)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(15);
  });

  it("l'id dell'ancora della voce arricchita è invariato", () => {
    const idx = html.indexOf("Come funziona la storia degli sfondi?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const tag = html.slice(inizioDetails, html.indexOf(">", inizioDetails) + 1);
    const m = tag.match(/id="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe("d-come-funziona-la-storia-degli-sfondi");
  });
});
