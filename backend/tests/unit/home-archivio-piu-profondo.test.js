// feat-l-archivio-non-finisce-a-trenta-giorni: il viaggio in home deve poter
// risalire l'intero archivio permanente, non fermarsi ai soli ultimi 30
// giorni. Test puro sul sorgente di renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — l'archivio non finisce a trenta giorni", () => {
  it("la fetch dell'archivio richiede limit=400", () => {
    expect(html).toContain("/api/archive/${chId}?limit=400");
  });

  it("nel sorgente non resta nessun residuo di limit=30", () => {
    expect(html).not.toContain("limit=30");
  });

  it("il limite richiesto non supera il tetto di 400 accettato dalla rotta /api/archive", () => {
    const cap = 400; // backend/src/index.js: Math.min(..., 400)
    const match = html.match(/\/api\/archive\/\$\{chId\}\?limit=(\d+)/);
    expect(match).not.toBeNull();
    const requested = Number(match[1]);
    expect(requested).toBeLessThanOrEqual(cap);
  });
});
