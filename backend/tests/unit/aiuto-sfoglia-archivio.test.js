// feat-l-aiuto-spiega-come-si-sfoglia-l-archivio: la pagina di un giorno
// d'archivio ha guadagnato in cicli successivi lo sfoglio col dito, le
// scorciatoie da tastiera (frecce, Home/End), il salto a una data tramite
// «tutti i N giorni» e il giorno a caso — ma nessuno di questi gesti era
// documentato nell'aiuto. Si arricchisce la FAQ già esistente «Che fine
// fanno gli sfondi vecchi?»: nessuna voce nuova, stesso schema collaudato
// di aiuto-archivi/aiuto-salva-e-condividi, per non rompere i test di
// conteggio voci hardcoded nelle altre suite. Test puro su renderHelpPage()
// — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — come si sfoglia un giorno d'archivio", () => {
  const html = renderHelpPage();
  const domanda = "Che fine fanno gli sfondi vecchi?";

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it("la voce spiega lo sfoglio col dito", () => {
    const voce = estraiVoce(html, domanda);
    for (const termine of ["dito", "strisciando"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la voce spiega le scorciatoie da tastiera", () => {
    const voce = estraiVoce(html, domanda);
    for (const termine of ["frecce ←/→", "Home/End", "primo", "ultimo"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la voce spiega come saltare a una data", () => {
    const voce = estraiVoce(html, domanda);
    for (const termine of ["saltare a una data", "tutti i N giorni"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la voce rimanda alla pagina degli archivi", () => {
    const voce = estraiVoce(html, domanda);
    expect(voce).toContain('<a href="/archivi">');
  });

  it("il numero di voci <details> resta invariato (15)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(15);
  });

  it("l'id dell'ancora della voce arricchita è invariato", () => {
    const idx = html.indexOf(domanda);
    const inizioDetails = html.lastIndexOf("<details", idx);
    const tag = html.slice(inizioDetails, html.indexOf(">", inizioDetails) + 1);
    const m = tag.match(/id="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe("d-che-fine-fanno-gli-sfondi-vecchi");
  });
});
