// feat-il-viaggio-si-sfoglia-senza-attesa: precaricare in silenzio i due
// giorni adiacenti a quello mostrato, così i passi successivi dello sfoglio
// (frecce, dito, tastiera) non aspettano il download del wallpaper. Test
// puro su renderPage() — nessun binding, nessuna rete, stessa tecnica dei
// test home-*.test.js già presenti.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function bodyOf(fnName) {
  const re = new RegExp(`function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`);
  return html.match(re)[0];
}

describe("home — il viaggio si sfoglia senza attesa", () => {
  it("definisce precaricaAdiacenti(chId, date)", () => {
    expect(html).toContain("function precaricaAdiacenti(chId, date)");
  });

  it("usa new Image() e mai fetch(", () => {
    const fnBody = bodyOf("precaricaAdiacenti");
    expect(fnBody).toContain("new Image()");
    expect(fnBody).not.toContain("fetch(");
  });

  it("guarda solo i due vicini (idx - 1 e idx + 1), non l'intero archivio", () => {
    const fnBody = bodyOf("precaricaAdiacenti");
    expect(fnBody).toContain("idx - 1");
    expect(fnBody).toContain("idx + 1");
    expect(fnBody).not.toMatch(/dates\.forEach/);
    expect(fnBody).not.toMatch(/for \(const/);
  });

  it("esce senza effetti quando indexOf restituisce -1", () => {
    const fnBody = bodyOf("precaricaAdiacenti");
    expect(fnBody).toContain("idx === -1");
    expect(fnBody).toContain("return");
  });

  it("consulta un insieme di URL già precaricati prima di istanziare l'immagine", () => {
    expect(html).toContain("const precaricati = new Set()");
    const fnBody = bodyOf("precaricaAdiacenti");
    expect(fnBody).toContain("precaricati.has(src)");
    expect(fnBody).toContain("precaricati.add(src)");
  });

  it("previewDay e renderJourney chiamano precaricaAdiacenti", () => {
    const previewBody = bodyOf("previewDay");
    expect(previewBody).toContain("precaricaAdiacenti(chId, date)");
    const journeyBody = html.match(/function renderJourney\(chId\) \{[\s\S]*?\nfunction updateDayNav/)[0];
    expect(journeyBody).toContain("precaricaAdiacenti(chId, TODAY)");
  });

  it("regressione anti-ciclo-77: esattamente UNA occorrenza di fetch( in tutto l'HTML reso", () => {
    const matches = html.match(/fetch\(/g) || [];
    expect(matches.length).toBe(1);
  });

  it("regressione: previewDay conserva pendingPreviewSrc, pre.onload e pre.onerror con stopPlayback()", () => {
    const previewBody = bodyOf("previewDay");
    expect(previewBody).toContain("pendingPreviewSrc = src");
    expect(previewBody).toContain("pre.onload = ()");
    expect(previewBody).toContain("pre.onerror = ()");
    expect(previewBody).toContain("stopPlayback()");
  });
});
