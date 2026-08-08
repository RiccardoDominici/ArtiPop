// feat-segui-tutti-i-canali-con-un-solo-import: renderOpml compone un OPML
// 2.0 a mano, senza rete né KV — stesso stile di feed-render.test.js. Copre
// CRITERI 1-4 del piano più il contratto di totalità su cui si appoggia il
// ripiego della rotta (index.js).
import { describe, it, expect } from "vitest";
import { renderOpml, OPML_VUOTO } from "../../src/opml.js";
import { ACTIVE_CHANNELS, displayName } from "../../src/channels.js";

describe("renderOpml", () => {
  it("apre con la dichiarazione XML e contiene <opml version=\"2.0\"> e l'head", () => {
    const xml = renderOpml({ canali: ACTIVE_CHANNELS, origin: "https://artipop.test" });
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain("<head><title>ArtiPop</title></head>");
  });

  it("un <outline> per ogni canale attivo, tutti type=\"rss\"", () => {
    const xml = renderOpml({ canali: ACTIVE_CHANNELS, origin: "https://artipop.test" });
    const outlines = xml.match(/<outline /g) || [];
    expect(outlines).toHaveLength(ACTIVE_CHANNELS.length);
    expect(xml.match(/type="rss"/g)).toHaveLength(ACTIVE_CHANNELS.length);
  });

  it("xmlUrl e htmlUrl assoluti, coerenti con la rotta feed esistente", () => {
    const xml = renderOpml({ canali: ACTIVE_CHANNELS, origin: "https://artipop.test" });
    for (const c of ACTIVE_CHANNELS) {
      expect(xml).toContain(`xmlUrl="https://artipop.test/feed/${c.id}.xml"`);
      expect(xml).toContain(`htmlUrl="https://artipop.test/?c=${c.id}"`);
    }
  });

  it("text/title portano displayName(id) per ogni canale attivo", () => {
    const xml = renderOpml({ canali: ACTIVE_CHANNELS, origin: "https://artipop.test" });
    for (const c of ACTIVE_CHANNELS) {
      const nome = displayName(c.id);
      expect(xml).toContain(`text="${nome}"`);
      expect(xml).toContain(`title="${nome}"`);
    }
  });

  it("escapa & < > \" nel nome del canale", () => {
    const xml = renderOpml({ canali: [{ id: "x", name: 'Nat & <ura> "q"' }], origin: "https://t" });
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;ura&gt;");
    expect(xml).toContain("&quot;");
    expect(xml).not.toContain("<ura>");
  });

  it("canali vuoto: documento valido con <body></body>, nessun <outline", () => {
    const xml = renderOpml({ canali: [], origin: "https://artipop.test" });
    expect(xml).toContain("<body></body>");
    expect(xml).not.toContain("<outline");
  });

  it("canali null/undefined e chiamata senza argomenti: non lanciano, stesso documento del caso vuoto", () => {
    const conNull = renderOpml({ canali: null, origin: "https://artipop.test" });
    const conUndefined = renderOpml({ canali: undefined, origin: "https://artipop.test" });
    const senzaArgomenti = renderOpml();
    expect(() => renderOpml({ canali: null })).not.toThrow();
    expect(conNull).toContain("<body></body>");
    expect(conUndefined).toContain("<body></body>");
    expect(senzaArgomenti).toContain("<body></body>");
    expect(senzaArgomenti.startsWith("<?xml")).toBe(true);
  });

  it("voce senza id valido viene scartata: nessun <outline> emesso", () => {
    const xml = renderOpml({ canali: [{ name: "x" }, { id: "" }], origin: "https://t" });
    expect(xml).not.toContain("<outline");
  });

  it("OPML_VUOTO è un documento valido e vuoto, pronto all'uso senza chiamare renderOpml", () => {
    expect(OPML_VUOTO.startsWith("<?xml")).toBe(true);
    expect(OPML_VUOTO).toContain('<opml version="2.0">');
    expect(OPML_VUOTO).toContain("<body></body>");
  });
});
