// Task #7 tondi Mio/Scarta e rimozione emoji: l'HTML reso dalle tre pagine
// (home, aiuto, archivi) non contiene emoji — solo testo. Il campo `emoji`
// di channels.js RESTA nei dati (lo serve /api/channels per Shortcut/feed e
// tuning via file://), quindi qui si controlla solo l'HTML reso, mai i dati.
// Test puro su renderPage/renderHelpPage/renderArchiviPage/renderGiornoArchivio.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";
import { renderHelpPage } from "../../src/help.js";
import { renderArchiviPage, renderGiornoArchivio } from "../../src/archivi.js";
import { ICON_MIO, ICON_SCARTA } from "../../src/icons.js";

// Range del brief task #7: pittografici/ideografici/simboli che il sito non
// deve piu rendere. I segni direzionali (U+2039 ‹, U+203A ›, U+2192 →,
// U+21D4, U+2AF3) e il play (U+25B6 ▶) sono fuori range e restano permessi.
const EMOJI_RE = /[🀀-🫿☀-⛿✀-➿⬀-⯿]/u;

const home = renderPage({}, "https://example.com", "2026-08-01");
const aiuto = renderHelpPage();
const archivi = renderArchiviPage([
  { id: "natura", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", attivo: true },
  { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12", attivo: false },
]);
const giorno = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: ["2025-01-03", "2025-01-02", "2025-01-01"] });

describe("home senza emoji", () => {
  it("renderPage non contiene emoji", () => {
    expect(home).not.toMatch(EMOJI_RE);
  });

  it("i tondi home usano le icone timbro data-URI come <img> con alt vuoto e aria-label sul bottone", () => {
    expect(home).toContain(`<button class="ctrl" id="prev" aria-label="Scarta"><img src="${ICON_SCARTA}" alt="">`);
    expect(home).toContain(`<button class="ctrl" id="next" aria-label="Mio"><img src="${ICON_MIO}" alt="">`);
  });

  it("l'hint nomina Scarta e Mio a parole, senza pollici", () => {
    expect(home).toContain("Scarta: trascina a sinistra per cambiare canale");
    expect(home).toContain("Mio: per scaricare e attivare");
  });
});

describe("aiuto e archivi senza emoji", () => {
  it("renderHelpPage non contiene emoji", () => {
    expect(aiuto).not.toMatch(EMOJI_RE);
  });

  it("renderArchiviPage non contiene emoji", () => {
    expect(archivi).not.toMatch(EMOJI_RE);
  });

  it("renderGiornoArchivio non contiene emoji", () => {
    expect(giorno).not.toMatch(EMOJI_RE);
  });

  it("le righe erede/in-corso tengono la freccia testuale verso il nome", () => {
    expect(archivi).toContain("la storia continua in");
    expect(archivi).toContain('href="/?c=natura"');
    expect(archivi).toContain("canale in corso");
  });
});
