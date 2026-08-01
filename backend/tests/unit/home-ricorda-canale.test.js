// feat-la-home-ricorda-il-tuo-canale: la home riapre sull'ultimo canale portato
// in cima, ricordato in localStorage (solo su questo dispositivo, mai un
// cookie, nessun dato inviato al worker). Test puro su renderPage() —
// nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — ricorda il canale visto l'ultima volta", () => {
  const html = renderPage({}, "https://example.com", "2026-08-01");

  it("usa la chiave artipop:canale e definisce leggiCanaleRicordato/ricordaCanale", () => {
    expect(html).toContain('"artipop:canale"');
    expect(html).toMatch(/function leggiCanaleRicordato\(\)/);
    expect(html).toMatch(/function ricordaCanale\(id\)/);
  });

  it("ogni accesso a localStorage è racchiuso in try/catch: nessun crash con storage inaccessibile", () => {
    const leggiBody = html.match(/function leggiCanaleRicordato\(\)[\s\S]*?\n\}/)[0];
    const ricordaBody = html.match(/function ricordaCanale\(id\)[\s\S]*?\n\}/)[0];
    expect(leggiBody).toMatch(/try\s*\{[\s\S]*localStorage\.getItem/);
    expect(leggiBody).toMatch(/catch\s*\{/);
    expect(ricordaBody).toMatch(/try\s*\{[\s\S]*localStorage\.setItem/);
    expect(ricordaBody).toMatch(/catch\s*\{/);
  });

  it("ricordaCanale è invocata dentro updateChrome, al cambio della card in cima", () => {
    const fnBody = html.match(/function updateChrome\(\)[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("ricordaCanale(ch.id)");
  });

  it("il canale ricordato viene applicato solo se sharedChannelId è assente, dopo la verifica in CHANNELS", () => {
    expect(html).toMatch(/if \(!sharedChannelId\) \{[\s\S]*?leggiCanaleRicordato\(\)/);
    expect(html).toMatch(/CHANNELS\.findIndex\(\(c\) => c\.id === rememberedId\)/);
    expect(html).toContain("order = [idx, ...order.filter((i) => i !== idx)]");
  });
});
