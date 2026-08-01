// feat-l-aiuto-spiega-i-giorni-preferiti: la FAQ esistente «Che fine fanno
// gli sfondi vecchi?» si arricchisce con la spiegazione dei preferiti — come
// si segnano con ☆, dove vivono (localStorage, per canale, su questo
// dispositivo) e come si portano su un altro telefono col link di
// trasferimento. Nessuna voce nuova: si tocca solo la risposta, non la
// domanda. Test puro su renderHelpPage() — nessun binding, nessuna
// generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — spiegazione dei giorni preferiti", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it('la voce "Che fine fanno gli sfondi vecchi?" spiega come segnare un preferito', () => {
    const voce = estraiVoce(html, "Che fine fanno gli sfondi vecchi?");
    for (const termine of ["segna preferito", "i tuoi preferiti"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la stessa voce menziona il link di trasferimento verso un altro dispositivo", () => {
    const voce = estraiVoce(html, "Che fine fanno gli sfondi vecchi?");
    expect(voce).toContain("link di trasferimento");
  });

  it("la stessa voce chiarisce che i preferiti restano solo su questo dispositivo/browser", () => {
    const voce = estraiVoce(html, "Che fine fanno gli sfondi vecchi?");
    expect(voce.toLowerCase()).toContain("questo dispositivo");
  });

  it("la spiegazione dei preferiti sta dentro il <details> di quella voce e non altrove", () => {
    const idx = html.indexOf("Che fine fanno gli sfondi vecchi?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const fineDetails = html.indexOf("</details>", idx);
    const primaOccorrenza = html.indexOf("segna preferito");
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

  it("l'id dell'ancora della voce arricchita è invariato", () => {
    const idx = html.indexOf("Che fine fanno gli sfondi vecchi?");
    const inizioDetails = html.lastIndexOf("<details", idx);
    const tag = html.slice(inizioDetails, html.indexOf(">", inizioDetails) + 1);
    const m = tag.match(/id="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe("d-che-fine-fanno-gli-sfondi-vecchi");
  });
});
