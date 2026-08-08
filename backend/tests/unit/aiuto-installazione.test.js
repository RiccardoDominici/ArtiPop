// feat-l-aiuto-spiega-come-aggiungere-artipop-alla-home: la FAQ esistente
// «Quanto costa?» si arricchisce con le istruzioni per aggiungere ArtiPop
// alla schermata Home su iPhone (Safari → Condividi) e Android (Chrome →
// menu). Nessuna voce nuova: si tocca solo la risposta, non la domanda.
// Test puro su renderHelpPage() — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — spiegazione dell'installazione alla schermata Home", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it('la voce "Quanto costa?" spiega come aggiungere ArtiPop alla schermata Home su iPhone', () => {
    const voce = estraiVoce(html, "Quanto costa?");
    expect(voce).toContain("schermata Home");
    expect(voce).toContain("Condividi");
  });

  it('la voce "Quanto costa?" spiega come aggiungere ArtiPop alla schermata Home su Android', () => {
    const voce = estraiVoce(html, "Quanto costa?");
    expect(voce).toContain("Chrome");
    expect(voce).toContain("Aggiungi a schermata Home");
  });

  it("la spiegazione dell'installazione sta dentro il <details> della voce «Quanto costa?» e non altrove", () => {
    const idx = html.indexOf("Quanto costa?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const fineDetails = html.indexOf("</details>", idx);
    const primaOccorrenza = html.indexOf("schermata Home");
    expect(primaOccorrenza).toBeGreaterThan(inizioDetails);
    expect(primaOccorrenza).toBeLessThan(fineDetails);
  });

  it("il numero di voci <details> resta invariato (16)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(16);
  });

  it("la vecchia frase «non c'è app da installare» non compare più", () => {
    expect(html).not.toContain("non c'è app da installare");
  });
});
