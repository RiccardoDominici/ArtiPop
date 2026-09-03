// feat-l-aiuto-elenca-le-scorciatoie-da-tastiera: la FAQ esistente «Come funziona
// la storia degli sfondi?» si arricchisce con l'elenco delle scorciatoie da
// tastiera (frecce, Inizio/Fine, guardie sui campi di testo e sui modificatori).
// Nessuna voce nuova: si tocca solo la risposta, non la domanda. Test puro su
// renderHelpPage() — nessun binding, nessuna generazione AI.
import { describe, it, expect } from "vitest";
import { renderHelpPage } from "../../src/help.js";

describe("renderHelpPage — scorciatoie da tastiera", () => {
  const html = renderHelpPage();

  function estraiVoce(markup, q) {
    const idx = markup.indexOf(`<summary>${q}`);
    expect(idx, `voce "${q}" non trovata`).toBeGreaterThan(-1);
    const fine = markup.indexOf("</details>", idx);
    return markup.slice(idx, fine);
  }

  it("la voce sulla navigazione elenca le frecce sinistra e destra", () => {
    const voce = estraiVoce(html, "Come funziona la storia degli sfondi?");
    for (const termine of ["tastiera", "freccia sinistra", "freccia destra", "giorno precedente"]) {
      expect(voce).toContain(termine);
    }
  });

  it("fuori dal viaggio la destra scarica e la sinistra cambia canale", () => {
    const voce = estraiVoce(html, "Come funziona la storia degli sfondi?");
    expect(voce).toContain("scarica la Shortcut");
    expect(voce).toContain("cambia canale");
  });

  it("nomina Inizio/Fine come salto al primo e all'ultimo giorno", () => {
    const voce = estraiVoce(html, "Come funziona la storia degli sfondi?");
    for (const termine of ["Inizio", "Home", "Fine", "End", "primo", "ultimo", "archivio"]) {
      expect(voce).toContain(termine);
    }
  });

  it("avverte che le scorciatoie non partono mentre si scrive", () => {
    const voce = estraiVoce(html, "Come funziona la storia degli sfondi?");
    for (const termine of ["campo di testo", "Ctrl", "Cmd", "Alt"]) {
      expect(voce).toContain(termine);
    }
  });

  it("la spiegazione sta nella sezione FAQ, non fra i problemi", () => {
    const idxFaq = html.indexOf('<h2 data-sezione="faq">');
    expect(idxFaq).toBeGreaterThan(-1);
    const faq = html.slice(idxFaq);
    const prima = html.slice(0, idxFaq);
    expect(faq).toContain("freccia sinistra");
    expect(prima).not.toContain("freccia sinistra");
  });

  it("non introduce nessun <h2> nuovo", () => {
    const count = (html.match(/<h2\b/g) ?? []).length;
    expect(count).toBe(2);
  });

  it("nessuna voce nuova: i <details> restano 16 con id invariati", () => {
    const details = html.match(/<details/g) ?? [];
    expect(details.length).toBe(16);
    const ids = [...html.matchAll(/<details[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(16);
    expect(new Set(ids).size).toBe(16);
    expect(html).toContain('id="d-come-funziona-la-storia-degli-sfondi"');
  });

  it("il paragrafo non contiene HTML non chiuso né < non sfuggiti", () => {
    const voce = estraiVoce(html, "Come funziona la storia degli sfondi?");
    const apriStrong = (voce.match(/<strong>/g) ?? []).length;
    const chiudiStrong = (voce.match(/<\/strong>/g) ?? []).length;
    expect(apriStrong).toBe(chiudiStrong);
    const apriCode = (voce.match(/<code>/g) ?? []).length;
    const chiudiCode = (voce.match(/<\/code>/g) ?? []).length;
    expect(apriCode).toBe(chiudiCode);
    const tagNoti = ["details", "summary", "a", "div", "p", "strong", "code", "br", "em"];
    for (const m of voce.matchAll(/<(\/?)([a-z0-9]+)/g)) {
      expect(tagNoti).toContain(m[2]);
    }
  });
});
