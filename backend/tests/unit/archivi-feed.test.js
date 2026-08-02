// feat-dall-archivio-si-segue-il-canale-col-lettore-di-feed: renderGiornoArchivio
// espone il feed RSS del canale mostrato — autodiscovery nel <head> (se `origin`
// è disponibile) e un comando visibile nella barra dei comandi, entrambi verso
// /feed/<id>.xml. Pura, zero rete, zero KV, stesso schema di archivi-giorno.test.js.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — autodiscovery del feed", () => {
  it("con origin emette esattamente un <link rel=alternate> verso /feed/<id>.xml", () => {
    const html = renderGiornoArchivio({
      id: "island",
      data: "2025-01-02",
      date: DATE,
      origin: "https://artipop.example",
    });
    const match = html.match(/<link rel="alternate" type="application\/rss\+xml"[^>]*>/g);
    expect(match).not.toBeNull();
    expect(match.length).toBe(1);
    const hrefMatch = match[0].match(/href="([^"]*)"/);
    expect(hrefMatch).not.toBeNull();
    expect(hrefMatch[1]).toBe("https://artipop.example/feed/island.xml");
  });

  it("senza origin il tag di autodiscovery non viene emesso, mai un href monco", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain('rel="alternate"');
    expect(html).not.toContain('href=""');
    expect(html).not.toContain("undefined");
  });
});

describe("renderGiornoArchivio — comando visibile per il feed", () => {
  it("mostra un <a> verso /feed/<id>.xml che nomina il lettore di feed", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/feed/island.xml"');
    expect(html).toMatch(/<a[^>]*href="\/feed\/island\.xml"[^>]*>[^<]*lettore di feed[^<]*<\/a>/);
  });

  it("l'id del canale è encodato nel comando visibile, anche fuori dall'alfabeto atteso", () => {
    const html = renderGiornoArchivio({ id: "nome strano", data: "2025-01-02", date: DATE, origin: "https://artipop.example" });
    expect(html).toContain('href="/feed/nome%20strano.xml"');
    expect(html).not.toContain('href="/feed/nome strano.xml"');
  });

  it("nessuno <script> nell'HTML anche con il comando del feed presente", () => {
    const html = renderGiornoArchivio({
      id: "island",
      data: "2025-01-02",
      date: DATE,
      origin: "https://artipop.example",
    });
    expect(html).not.toContain("<script");
  });
});
