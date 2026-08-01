// feat-la-home-dice-quando-sei-senza-rete: chi apre l'app installata senza
// rete vede la copia in cache ma l'archivio non si sfoglia (/api/* esclusa
// dalla cache) — la home deve dirlo, non tacere. Test puro su renderPage(),
// nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — dice quando sei senza rete", () => {
  it("l'HTML servito contiene un solo #netstate, class=hint, nascosto (chi è online non vede nulla di nuovo)", () => {
    const matches = html.match(/id="netstate"/g);
    expect(matches).toHaveLength(1);
    const match = html.match(/<p class="hint" id="netstate" hidden>([^<]*)<\/p>/);
    expect(match).not.toBeNull();
  });

  it("il testo nomina sia la copia salvata sia il ritorno della rete", () => {
    const match = html.match(/<p class="hint" id="netstate" hidden>([^<]*)<\/p>/);
    const testo = match[1].toLowerCase();
    expect(testo).toContain("copia salvata");
    expect(testo).toContain("rete");
  });

  it("il JS della pagina registra sia 'online' sia 'offline' su window", () => {
    expect(html).toContain('window.addEventListener("online", aggiornaStatoRete)');
    expect(html).toContain('window.addEventListener("offline", aggiornaStatoRete)');
  });

  it("aggiornaStatoRete mostra/nasconde #netstate in base a navigator.onLine, senza fetch di sondaggio", () => {
    const scriptMatch = html.match(/function aggiornaStatoRete\(\)[\s\S]*?\n\}/);
    expect(scriptMatch).not.toBeNull();
    const src = scriptMatch[0];
    expect(src).toContain("navigator.onLine");
    expect(src).not.toContain("fetch(");
  });

  it("nessuna classe CSS fuori da quelle già definite: solo class=\"hint\"", () => {
    const match = html.match(/<p class="hint" id="netstate" hidden>/);
    expect(match).not.toBeNull();
  });
});
