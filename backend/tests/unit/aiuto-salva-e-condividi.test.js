// feat-l-aiuto-spiega-come-salvare-e-condividere-un-giorno: la FAQ esistente
// «Che fine fanno gli sfondi vecchi?» si arricchisce con la spiegazione dei
// tre gesti già esistenti sul sito per salvare/condividere il giorno che si
// sta guardando: salvataggio dell'immagine (nome leggibile), copia del link
// del giorno (anche d'archivio) e condivisione dell'immagine. Nessuna voce
// nuova: si tocca solo la risposta, non la domanda — stesso schema collaudato
// di aiuto-archivi/aiuto-feed, per non rompere i test di conteggio voci
// hardcoded nelle altre suite. Test puro su renderHelpPage() — nessun
// binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — salvare o condividere un giorno", () => {
  const html = renderHelpPage();
  const domanda = "Che fine fanno gli sfondi vecchi?";

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it("la voce cita il salvataggio con nome file leggibile", () => {
    const voce = estraiVoce(html, domanda);
    for (const termine of ["salva l'immagine", "nome leggibile"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la voce cita la condivisione del link del giorno esatto, anche d'archivio", () => {
    const voce = estraiVoce(html, domanda);
    for (const termine of ["copia link", "d'archivio"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la voce cita la condivisione diretta dell'immagine", () => {
    const voce = estraiVoce(html, domanda);
    expect(voce).toContain("condividi l'immagine");
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
