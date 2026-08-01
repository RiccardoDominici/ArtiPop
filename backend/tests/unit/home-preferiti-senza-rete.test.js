// feat-i-preferiti-si-rivedono-anche-senza-rete: segnare un giorno preferito
// chiede al service worker di conservarlo in cache, nella forma "?date="
// con cui il pannello preferiti lo riapre. Test puro su renderPage() —
// stessa tecnica dei test home-*.test.js già presenti.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function bodyOf(fnName) {
  const re = new RegExp(`function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`);
  return html.match(re)[0];
}

describe("home — i preferiti si rivedono anche senza rete", () => {
  it("definisce conservaOffline(chId, date)", () => {
    expect(html).toContain("function conservaOffline(chId, date)");
  });

  it("conservaOffline invia un postMessage al service worker con l'URL in forma ?date=", () => {
    const fnBody = bodyOf("conservaOffline");
    expect(fnBody).toContain('"/w/" + chId + "?date=" + date');
    expect(fnBody).toContain("navigator.serviceWorker.controller.postMessage");
    expect(fnBody).toContain('tipo: "conserva"');
  });

  it("conservaOffline è protetta da try/catch e da guardie sull'esistenza di navigator.serviceWorker", () => {
    const fnBody = bodyOf("conservaOffline");
    expect(fnBody).toMatch(/try\s*\{/);
    expect(fnBody).toContain("navigator.serviceWorker &&");
    expect(fnBody).toContain("navigator.serviceWorker.controller");
  });

  it("il click su #dayfav chiama conservaOffline solo nel ramo di attivazione, non alla rimozione", () => {
    const clickBody = html.match(
      /dayFavEl\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/
    )[0];
    expect(clickBody).toContain("eraGiaPreferito");
    expect(clickBody).toMatch(/if \(!eraGiaPreferito\) conservaOffline\(chId, date\);/);
  });

  it("regressione anti-ciclo-77: esattamente UNA occorrenza di fetch( in tutto l'HTML reso", () => {
    const matches = html.match(/fetch\(/g) || [];
    expect(matches.length).toBe(1);
  });
});
