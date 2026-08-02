// feat-i-preferiti-si-riconoscono-a-colpo-d-occhio: ogni riga di #favlist
// mostra la miniatura del wallpaper del giorno preferito, non solo data e
// nome del concept. Test puro su renderPage() — nessun binding, nessuna
// rete, sullo stile di home-giorni-preferiti.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — i preferiti si riconoscono a colpo d'occhio", () => {
  it("il CSS espone .favmini con object-fit: cover e misure 30px/64px", () => {
    const rule = html.match(/\.arcrow \.favmini \{[^}]*\}/)[0];
    expect(rule).toContain("object-fit: cover");
    expect(rule).toContain("width: 30px");
    expect(rule).toContain("height: 64px");
  });

  it("renderFavList costruisce un <img class=\"favmini\"> con loading, decoding e alt vuoto", () => {
    const fnBody = html.match(/function renderFavList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('mini.className = "favmini"');
    expect(fnBody).toContain('mini.alt = ""');
    expect(fnBody).toContain('mini.loading = "lazy"');
    expect(fnBody).toContain('mini.decoding = "async"');
  });

  it("la src della miniatura proviene da srcFor, nessun secondo \"/w/\" costruito a mano dentro renderFavList", () => {
    const fnBody = html.match(/function renderFavList\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("srcFor(chId, d, d === TODAY)");
    expect(fnBody).not.toContain('"/w/');
  });

  it("la riga di copia del link dei preferiti non riceve miniatura", () => {
    const fnBody = html.match(/function renderFavList\([\s\S]*?\n\}/)[0];
    const copyBlock = fnBody.match(/copia il link[\s\S]*$/)[0];
    expect(copyBlock).not.toContain("favmini");
  });

  it("regressione: #favlist resta hidden alla costruzione, il pannello resta chiuso di default", () => {
    const listTag = html.match(/<div class="arcstory" id="favlist"[^>]*>/)[0];
    expect(listTag).toContain("hidden");
  });
});
