// feat-il-giorno-d-archivio-mostra-dove-porta-il-passo-avanti: i comandi
// «← giorno precedente» / «giorno successivo →» portano una miniatura del
// wallpaper di quel giorno, riuso del token `.copertina` 60×128 di §2.1.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — miniature dei giorni adiacenti", () => {
  it("giorno centrale: due <img> con src verso i giorni adiacenti, decorative e dimensionate", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });

    expect(html).toContain('<img class="mini" src="/w/island?date=2025-01-01"');
    expect(html).toContain('<img class="mini" src="/w/island?date=2025-01-03"');

    const miniature = [...html.matchAll(/<img class="mini"[^>]*>/g)];
    expect(miniature).toHaveLength(2);
    for (const [tag] of miniature) {
      expect(tag).toContain('alt=""');
      expect(tag).toContain('loading="lazy"');
      expect(tag).toContain('decoding="async"');
      expect(tag).toContain('width="60"');
      expect(tag).toContain('height="128"');
    }

    // ciascuna miniatura è dentro l'<a> che punta alla stessa data
    expect(html).toMatch(
      /<a class="precedente" href="\/archivi\/island\?date=2025-01-01"><img class="mini" src="\/w\/island\?date=2025-01-01"/
    );
    expect(html).toMatch(
      /<a class="successivo" href="\/archivi\/island\?date=2025-01-03"><img class="mini" src="\/w\/island\?date=2025-01-03"/
    );
  });

  it("al giorno più recente (bordo): nessuna miniatura del giorno successivo né src orfano", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-03", date: DATE });
    const miniature = [...html.matchAll(/<img class="mini"[^>]*>/g)];
    expect(miniature).toHaveLength(1);
    expect(html).not.toContain('<img class="mini" src="/w/island?date=2025-01-03"');
  });

  it("al giorno più vecchio (bordo): nessuna miniatura del giorno precedente né src orfano", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-01", date: DATE });
    const miniature = [...html.matchAll(/<img class="mini"[^>]*>/g)];
    expect(miniature).toHaveLength(1);
    expect(html).not.toContain('<img class="mini" src="/w/island?date=2025-01-01"');
  });

  it("archivio di un solo giorno: nessuna miniatura nella barra di navigazione", () => {
    const html = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    expect(html).not.toContain('<img class="mini"');
  });

  it("date da percent-encodare: src e href restano codificati e coerenti fra loro", () => {
    const date = ["2025/01+03", "2025-01-02", "2025/01+01"];
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date });

    expect(html).toContain(
      '<a class="precedente" href="/archivi/island?date=2025%2F01%2B01"><img class="mini" src="/w/island?date=2025%2F01%2B01"'
    );
    expect(html).toContain(
      '<a class="successivo" href="/archivi/island?date=2025%2F01%2B03"><img class="mini" src="/w/island?date=2025%2F01%2B03"'
    );
  });
});
