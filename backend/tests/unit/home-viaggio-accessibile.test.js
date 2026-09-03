// feat-il-viaggio-si-racconta-anche-a-chi-non-vede: chi sfoglia il viaggio con
// VoiceOver/TalkBack deve sapere quale giorno sta guardando. Due controlli:
// (a) #daynav annuncia il cambio giorno (aria-live) — le frecce hanno già
// aria-label, mancava solo l'esito dell'azione; (b) l'alt del wallpaper resta
// sincronizzato col giorno mostrato, non solo con quello iniziale. Test puro
// su renderPage() — nessun binding, nessuna rete, stessa tecnica degli altri
// home-*.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

describe("home — il viaggio si racconta anche a chi non vede", () => {
  it("il contenitore .dayinfo di #daynav ha aria-live e aria-atomic, per annunciare ddate/dpos a ogni cambio giorno", () => {
    const daynav = html.match(/<div class="daynav" id="daynav"[\s\S]*?<\/div>\s*<\/div>/)[0];
    const dayinfo = daynav.match(/<div class="dayinfo"[^>]*>/)[0];
    expect(dayinfo).toContain('aria-live="polite"');
    expect(dayinfo).toContain('aria-atomic="true"');
  });

  it("le frecce giorno restano invariate: aria-label già presenti, nessuna modifica di classi o testo", () => {
    expect(html).toContain('id="dayprev" aria-label="Giorno precedente dell\'archivio"');
    expect(html).toContain('id="daynext" aria-label="Giorno successivo dell\'archivio"');
  });

  it("descrizioneWallpaper esiste ed è l'unica formula usata sia da cardHTML() sia da previewDay()", () => {
    expect(html).toMatch(/function descrizioneWallpaper\(ch, date, isToday\) \{/);
    const cardHTMLBody = html.match(/function cardHTML\(ch\) \{[\s\S]*?\n\}/)[0];
    expect(cardHTMLBody).toContain("descrizioneWallpaper(ch, ch.date, !ch.inRitardo)");
    // nessuna formula duplicata: cardHTML non ricostruisce la stringa a mano
    expect(cardHTMLBody).not.toMatch(/wallpaper \$\{/);
  });

  it("previewDay assegna top.alt dentro pre.onload, sotto la guardia pendingPreviewSrc, usando descrizioneWallpaper", () => {
    const previewDayBody = html.match(/function previewDay\(chId, date, isToday\) \{[\s\S]*?\n\}/)[0];
    const onloadBody = previewDayBody.match(/pre\.onload = \(\) => \{[\s\S]*?\n  \};/)[0];
    const guardIdx = onloadBody.indexOf("if (pendingPreviewSrc !== src) return");
    const altIdx = onloadBody.indexOf("top.alt =");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(altIdx).toBeGreaterThan(guardIdx);
    expect(onloadBody).toContain("descrizioneWallpaper(ch, date, isToday)");
  });

  it("il ramo pre.onerror di previewDay non tocca mai .alt: l'immagine precedente resta con la sua descrizione", () => {
    const previewDayBody = html.match(/function previewDay\(chId, date, isToday\) \{[\s\S]*?\n\}/)[0];
    const onerrorBody = previewDayBody.match(/pre\.onerror = \(\) => \{[\s\S]*?\n  \};/)[0];
    expect(onerrorBody).not.toContain(".alt");
  });

  it("regressione: l'alt statico di cardHTML() continua a produrre 'wallpaper di oggi' quando il canale non è in ritardo", () => {
    const match = html.match(/const CHANNELS = (\[.*?\]);/);
    const ch = JSON.parse(match[1])[0];
    expect(ch.inRitardo).toBe(false);
    const descrizioneBody = html.match(/function descrizioneWallpaper\(ch, date, isToday\) \{[\s\S]*?\n\}/)[0];
    expect(descrizioneBody).toMatch(/\$\{ch\.name\} — wallpaper \$\{isToday/);
  });

  it("regressione: nessun token colore/misura nuovo, i token Salvia (proposta §7 feat-home-salvia) restano invariati", () => {
    expect(html).toMatch(/--bg:\s*#DCE2D2/);
    expect(html).toMatch(/--card:\s*#F6F8F1/);
    expect(html).toMatch(/--text:\s*#2B3028/);
    expect(html).toMatch(/--dim:\s*#68725F/);
  });
});
