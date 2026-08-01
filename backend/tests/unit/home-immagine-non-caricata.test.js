// feat-il-viaggio-non-resta-mai-a-schermo-nero: se il wallpaper di un giorno
// non si carica, previewDay deve gestire l'errore invece di lasciare la card
// nera per sempre. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");
const fnBody = html.match(/function previewDay\([\s\S]*?\n\}/)[0];

describe("home — il viaggio non resta mai a schermo nero", () => {
  it("previewDay definisce un handler pre.onerror oltre a pre.onload", () => {
    expect(fnBody).toContain("pre.onerror");
    expect(fnBody).toContain("pre.onload");
  });

  it("il ramo d'errore ripristina l'opacità e NON assegna top.src", () => {
    const errorBranch = fnBody.match(/pre\.onerror = \(\) => \{[\s\S]*?\n  \};/)[0];
    expect(errorBranch).toContain("top.style.opacity = 1");
    expect(errorBranch).not.toContain("top.src =");
  });

  it("il ramo d'errore ferma il timelapse con stopPlayback()", () => {
    const errorBranch = fnBody.match(/pre\.onerror = \(\) => \{[\s\S]*?\n  \};/)[0];
    expect(errorBranch).toContain("stopPlayback()");
  });

  it("il ramo d'errore mostra il toast canonico con un messaggio non vuoto", () => {
    const errorBranch = fnBody.match(/pre\.onerror = \(\) => \{[\s\S]*?\n  \};/)[0];
    const toastCall = errorBranch.match(/toast\(("[^"]+")\)/);
    expect(toastCall).not.toBeNull();
    expect(toastCall[1].length).toBeGreaterThan(2);
  });

  it("il ramo felice pre.onload resta intatto: assegna top.src e riporta l'opacità a 1", () => {
    const loadBranch = fnBody.match(/pre\.onload = \(\) => \{[\s\S]*?\n  \};/)[0];
    expect(loadBranch).toContain("top.src = src");
    expect(loadBranch).toContain("top.style.opacity = 1");
  });
});
