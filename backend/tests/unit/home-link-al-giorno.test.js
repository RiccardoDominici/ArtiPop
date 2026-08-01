// feat-condividi-il-giorno-che-stai-guardando: la home deve restituire un
// indirizzo condivisibile al giorno esatto mostrato (/?c=<canale>&d=<data>),
// e riaprirlo quando arriva da quell'indirizzo. Test puro su renderPage() —
// nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — link condivisibile al giorno mostrato", () => {
  const html = renderPage({}, "https://example.com", "2026-08-01");

  it("il markup espone il bottone #dayshare accanto a #daynav, pill ghost, inizialmente nascosto", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const btnTag = journey.match(/<button class="btn ghost" id="dayshare"[^>]*>/)[0];
    expect(btnTag).toContain("hidden");
  });

  it("il bottone segue lo stato di #daynav: nascosto/mostrato insieme in renderJourney", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("daynavEl.hidden = !hasJourney");
    expect(fnBody).toContain("dayshareEl.hidden = !hasJourney");
  });

  it("shareLink compone <origin>/?c=<canale in cima>&d=<data mostrata>", () => {
    const fnBody = html.match(/async function shareLink\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('ORIGIN + "/?c=" + chId + "&d=" + date');
    expect(fnBody).toContain("CHANNELS[order[0]].id");
    expect(fnBody).toContain("previewDate ?? TODAY");
  });

  it("se la clipboard non è disponibile o rifiuta, mostra l'indirizzo in chiaro nel toast — mai un errore non gestito", () => {
    const fnBody = html.match(/async function shareLink\([\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/catch\s*\{/);
    expect(fnBody).toContain("toast(link)");
    expect(fnBody).not.toMatch(/alert\(/);
    expect(html).not.toMatch(/alert\(/);
  });

  it("all'avvio legge c/d da location.search con URLSearchParams", () => {
    expect(html).toMatch(/new URLSearchParams\(location\.search\)/);
    expect(html).toMatch(/sharedParams\.get\("c"\)/);
    expect(html).toMatch(/sharedParams\.get\("d"\)/);
  });

  it("canale noto in cima al deck, canale sconosciuto ignorato senza toccare la data", () => {
    expect(html).toMatch(/CHANNELS\.findIndex\(\(c\) => c\.id === sharedChannelId\)/);
    expect(html).toContain("order = [idx, ...order.filter((i) => i !== idx)]");
    expect(html).toContain("else pendingSharedDate = null");
  });

  it("data condivisa valida in archivio: mostrata ferma (previewDay), niente autoplay; altrimenti autoplay come prima", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("pendingSharedDate && dates.includes(pendingSharedDate)");
    expect(fnBody).toContain("previewDay(chId, d, d === TODAY)");
    expect(fnBody).toMatch(/if \(!playing && !prefersStill\) startPlayback\(\);/);
  });

  it("il formato data atteso è YYYY-MM-DD", () => {
    expect(html).toContain("/^\\d{4}-\\d{2}-\\d{2}$/");
  });

  it("nessuna rotta nuova nel worker: zero occorrenze di fetch verso indirizzi diversi da /api/archive/", () => {
    const fetches = html.match(/fetch\(/g) || [];
    expect(fetches.length).toBe(1);
  });
});
