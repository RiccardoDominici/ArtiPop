// feat-l-aiuto-spiega-cosa-funziona-senza-rete: la FAQ esistente «Quanto
// costa?» si arricchisce con un capoverso finale che spiega cosa resta
// leggibile senza rete quando ArtiPop è installata sulla schermata Home
// (ultimo giorno già visto) e cosa no (pagine mai aperte prima). Nessuna
// voce nuova: si tocca solo la risposta, non la domanda.
// Test puro su renderHelpPage() — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — spiegazione di cosa funziona senza rete", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it('la voce "Quanto costa?" spiega che l\'app riapre l\'ultimo giorno già visto senza rete', () => {
    const voce = estraiVoce(html, "Quanto costa?");
    expect(voce).toContain("senza rete");
    expect(voce).toContain("ultimo giorno");
  });

  it('la voce "Quanto costa?" chiarisce che le pagine mai aperte prima non ci sono', () => {
    const voce = estraiVoce(html, "Quanto costa?");
    expect(voce).toContain("Le pagine mai aperte prima non ci sono");
  });

  it("non promette che le immagini si generino offline", () => {
    const voce = estraiVoce(html, "Quanto costa?");
    expect(voce).not.toMatch(/genera(no)? .*senza rete/i);
  });

  it("il numero di voci <details> resta invariato (15)", () => {
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(15);
  });

  it("la ricerca in /aiuto trova la voce digitando «rete» (filtro su textContent)", () => {
    const voce = estraiVoce(html, "Quanto costa?");
    const testo = voce.replace(/<[^>]+>/g, " ");
    expect(testo).toMatch(/rete/i);
  });
});
