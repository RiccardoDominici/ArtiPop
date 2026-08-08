// feat-l-aiuto-dice-dove-sono-finiti-i-canali-vecchi: la FAQ esistente «Che fine
// fanno gli sfondi vecchi?» si arricchisce con il rimando alla pagina /archivi,
// dove i canali non più attivi restano sfogliabili giorno per giorno. Nessuna
// voce nuova: si tocca solo la risposta, non la domanda. Test puro su
// renderHelpPage() — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — rimando all'archivio dei canali vecchi", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it('la voce "Che fine fanno gli sfondi vecchi?" rimanda a /archivi', () => {
    const voce = estraiVoce(html, "Che fine fanno gli sfondi vecchi?");
    expect(voce).toContain('<a href="/archivi">');
    expect(voce).toContain("Archivi storici");
  });

  it("il numero di voci <details> resta invariato (16)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(16);
  });

  it("l'id dell'ancora della voce arricchita è invariato", () => {
    const idx = html.indexOf("Che fine fanno gli sfondi vecchi?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const tag = html.slice(inizioDetails, html.indexOf(">", inizioDetails) + 1);
    const m = tag.match(/id="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe("d-che-fine-fanno-gli-sfondi-vecchi");
  });
});
