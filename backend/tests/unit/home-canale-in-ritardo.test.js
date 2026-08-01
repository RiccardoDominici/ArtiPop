// feat-la-home-dice-se-il-canale-e-in-ritardo: se il cron di un canale salta,
// la home non deve spacciare per "di oggi" l'ultima immagine realmente in
// archivio. Test puro su renderPage() — nessun binding, nessuna rete.
// Nota: cardHTML è un template client-side eseguito nel browser, quindi la
// sua sorgente (incluso il ramo .stale) è sempre presente nell'HTML restituito
// da renderPage a prescindere dai metas passati: qui si verifica (a) che
// channelData calcoli inRitardo/date correttamente per ogni caso di metas, e
// (b) una volta sola che il template client-side branchi davvero su
// ch.inRitardo per nota e alt.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";

const firstId = ACTIVE_CHANNELS[0].id;

function channelJSON(html, id) {
  const match = html.match(/const CHANNELS = (\[.*?\]);/);
  expect(match).not.toBeNull();
  const channels = JSON.parse(match[1]);
  return channels.find((c) => c.id === id);
}

describe("home — nota di freschezza quando il canale è in ritardo", () => {
  it("meta con date precedente a dateKey → inRitardo true e date è la data reale dell'ultima immagine", () => {
    const metas = { [firstId]: { date: "2026-07-30", scene: "una scena" } };
    const html = renderPage(metas, "https://example.com", "2026-08-01");
    const ch = channelJSON(html, firstId);
    expect(ch.inRitardo).toBe(true);
    expect(ch.date).toBe("2026-07-30");
  });

  it("meta con date uguale a dateKey → inRitardo false", () => {
    const metas = { [firstId]: { date: "2026-08-01", scene: "una scena" } };
    const html = renderPage(metas, "https://example.com", "2026-08-01");
    const ch = channelJSON(html, firstId);
    expect(ch.inRitardo).toBe(false);
    expect(ch.date).toBe("2026-08-01");
  });

  it("nessun meta per il canale → inRitardo resta false, date ricade su dateKey (niente doppio avviso su 'in preparazione…')", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const ch = channelJSON(html, firstId);
    expect(ch.inRitardo).toBe(false);
    expect(ch.date).toBe("2026-08-01");
  });

  it("il template client-side emette la nota .stale con la data leggibile SOLO quando ch.inRitardo è vero", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const cardHTMLBody = html.match(/function cardHTML\(ch\) \{[\s\S]*?\n\}/)[0];
    expect(cardHTMLBody).toMatch(/ch\.inRitardo \? '<p class="stale">/);
    expect(cardHTMLBody).toContain("fmtDataEstesa(ch.date)");
  });

  it("il template client-side sceglie l'alt in base a ch.inRitardo, senza mai toccare src/?v=", () => {
    // feat-il-viaggio-si-racconta-anche-a-chi-non-vede: la formula dell'alt è
    // stata estratta in descrizioneWallpaper(ch, date, isToday) per essere
    // riusata anche da previewDay() — cardHTML() ora la invoca con
    // isToday=!ch.inRitardo, stesso comportamento reso di prima.
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const descrizioneBody = html.match(/function descrizioneWallpaper\(ch, date, isToday\) \{[\s\S]*?\n\}/)[0];
    expect(descrizioneBody).toContain("di oggi");
    expect(descrizioneBody).toMatch(/isToday \? "di oggi" : "del " \+ fmtDataEstesa\(date\)/);
    const cardHTMLBody = html.match(/function cardHTML\(ch\) \{[\s\S]*?\n\}/)[0];
    const altExpr = cardHTMLBody.match(/alt="\$\{descrizioneWallpaper\(ch, ch\.date, !ch\.inRitardo\)\}"/);
    expect(altExpr).not.toBeNull();
    expect(cardHTMLBody).toContain('src="/w/${ch.id}?v=${ch.date}"');
  });

  it("la regola .stale usa solo var(--dim) e .8rem, nessun colore nuovo", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const rule = html.match(/\.cinfo \.stale\s*\{[^}]*\}/)[0];
    expect(rule).toContain("var(--dim)");
    expect(rule).toContain(".8rem");
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
