// feat-la-home-si-vede-anche-senza-javascript: chi apre la home col JS
// bloccato vedeva un riquadro vuoto (il deck è costruito lato client). Qui
// si verifica il ripiego statico emesso da renderPage — un <noscript> con
// nome canale, wallpaper di oggi e link alla Shortcut per ogni canale
// attivo — senza toccare l'aspetto della pagina quando il JS gira (il
// contenuto di <noscript> non viene mai renderizzato dal browser in quel caso).
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";

function noscriptBody(html) {
  const match = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  expect(match).not.toBeNull();
  return match[1];
}

describe("home — ripiego senza JavaScript", () => {
  it("l'HTML contiene esattamente un blocco <noscript>", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const matches = html.match(/<noscript>/g) || [];
    expect(matches.length).toBe(1);
    expect(html).toContain("</noscript>");
  });

  it("una voce per ogni canale attivo, con id/nome e link alla Shortcut", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const body = noscriptBody(html);
    for (const c of ACTIVE_CHANNELS) {
      expect(body).toContain(c.name);
      expect(body).toContain(`/s/${c.id}.shortcut`);
    }
  });

  it("con meta completi ogni voce ha un <img> con src /w/<id>?v=<data> e alt non vuoto", () => {
    const metas = {};
    for (const c of ACTIVE_CHANNELS) metas[c.id] = { date: "2026-07-30", scene: "una scena" };
    const html = renderPage(metas, "https://example.com", "2026-08-01");
    const body = noscriptBody(html);
    for (const c of ACTIVE_CHANNELS) {
      const re = new RegExp(`<img src="/w/${c.id}\\?v=2026-07-30" alt="[^"]+"`);
      expect(body).toMatch(re);
    }
  });

  it("con metas = {} renderPage non lancia, il blocco esiste ancora e non produce ?v= malformati", () => {
    expect(() => renderPage({}, "https://example.com", "2026-08-01")).not.toThrow();
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const body = noscriptBody(html);
    expect(body).not.toContain("?v=undefined");
    for (const c of ACTIVE_CHANNELS) {
      expect(body).not.toContain(`src="/w/${c.id}?v="`);
      // Senza meta niente <img>, ma il link diretto al wallpaper resta valido.
      expect(body).toContain(`/w/${c.id}`);
    }
  });

  it("il blocco offre i collegamenti a /aiuto e /archivi", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const body = noscriptBody(html);
    expect(body).toContain('href="/aiuto"');
    expect(body).toContain('href="/archivi"');
  });

  it("il blocco non contiene script, fetch né gestori inline", () => {
    const html = renderPage({}, "https://example.com", "2026-08-01");
    const body = noscriptBody(html);
    expect(body).not.toContain("<script");
    expect(body).not.toContain("fetch(");
    expect(body).not.toContain("onclick");
  });

  it("l'escaping è applicato: caratteri < e \" nei metas non producono markup grezzo", () => {
    const id = ACTIVE_CHANNELS[0].id;
    const metas = { [id]: { date: '2026-07-30"><script>alert(1)</script>', scene: "x" } };
    const html = renderPage(metas, "https://example.com", "2026-08-01");
    const body = noscriptBody(html);
    expect(body).not.toContain("<script>alert(1)</script>");
  });
});
