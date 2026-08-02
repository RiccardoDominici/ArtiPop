// feat-la-home-dice-da-dove-viene-questo-canale: la card di ogni canale dice
// quali vecchi canali ha ereditato, con un link agli archivi — così chi
// arriva da una Shortcut storica capisce dove sono finiti i vecchi
// wallpaper. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";
import { LEGACY_ALIASES } from "../../src/channels.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function channelJSON(id) {
  const match = html.match(/const CHANNELS = (\[.*?\]);/);
  expect(match).not.toBeNull();
  const channels = JSON.parse(match[1]);
  return channels.find((c) => c.id === id);
}

describe("home — da dove viene questo canale", () => {
  it("cardHTML rende .eredita con gli id ereditati e un link a /archivi, solo se ce ne sono", () => {
    const cardHTMLBody = html.match(/function cardHTML\(ch\) \{[\s\S]*?\n\}/)[0];
    expect(cardHTMLBody).toMatch(/ch\.eredita\.length > 0 \? '<p class="eredita">/);
    expect(cardHTMLBody).toContain('href="/archivi"');
  });

  it("il canale natura eredita island e bloom", () => {
    const ch = channelJSON("natura");
    expect(ch.eredita).toContain("island");
    expect(ch.eredita).toContain("bloom");
  });

  it("il campo eredita di ogni canale riflette l'inverso di LEGACY_ALIASES", () => {
    const inverso = {};
    for (const [oldId, targetId] of Object.entries(LEGACY_ALIASES)) {
      (inverso[targetId] ||= []).push(oldId);
    }
    for (const targetId of Object.keys(inverso)) {
      const ch = channelJSON(targetId);
      if (!ch) continue; // l'id ereditore potrebbe non essere attivo in questa build
      expect(ch.eredita).toEqual(inverso[targetId]);
    }
  });

  it("regressione anti-ciclo-77 (cintura locale): esattamente UNA occorrenza di fetch( in tutto l'HTML reso", () => {
    const matches = html.match(/fetch\(/g) || [];
    expect(matches.length).toBe(1);
  });
});
