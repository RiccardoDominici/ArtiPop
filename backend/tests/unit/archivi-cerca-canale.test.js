import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";

const ESEMPIO = [
  { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
  { id: "bloom", giorni: 3, prima: "2025-02-01", ultima: "2025-02-03" },
];

describe("renderArchiviPage — ricerca del canale (?cerca=)", () => {
  it("form presente quando storici è un array", () => {
    const html = renderArchiviPage(ESEMPIO);
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/archivi"');
    expect(html).toContain('name="cerca"');
    expect(html).toContain('type="search"');
  });

  it("form assente quando storici è null", () => {
    const html = renderArchiviPage(null);
    expect(html).not.toContain('name="cerca"');
    expect(html).toContain("Archivi momentaneamente non disponibili.");
  });

  it("match sull'id, case-insensitive e per sottostringa", () => {
    const htmlMaiuscolo = renderArchiviPage(ESEMPIO, null, null, "ISL");
    expect(htmlMaiuscolo).toContain('href="/archivi/island?date=2025-01-12"');
    expect(htmlMaiuscolo).not.toContain('href="/archivi/bloom?date=2025-02-03"');

    const htmlSpazi = renderArchiviPage(ESEMPIO, null, null, "  and  ");
    expect(htmlSpazi).toContain('href="/archivi/island?date=2025-01-12"');
    expect(htmlSpazi).not.toContain('href="/archivi/bloom?date=2025-02-03"');
  });

  it("match sul nome visibile di un canale attivo", () => {
    const canale = ACTIVE_CHANNELS[0];
    const frammento = canale.name.slice(0, 3).toLowerCase();
    const fixture = [
      { id: canale.id, giorni: 5, prima: "2025-03-01", ultima: "2025-03-05" },
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
    ];
    const html = renderArchiviPage(fixture, null, null, frammento);
    expect(html).toContain(`href="/archivi/${canale.id}?date=2025-03-05"`);
    expect(html).not.toContain('href="/archivi/island?date=2025-01-12"');
  });

  it("nessuna corrispondenza mostra il messaggio dedicato con link di ritorno", () => {
    const html = renderArchiviPage(ESEMPIO, null, null, "zzz");
    expect(html).toContain("Nessun canale corrisponde");
    expect(html).toContain('href="/archivi"');
    expect(html).not.toContain('<ul class="archivi">');
  });

  it("query ostile viene escapata, mai grezza nell'HTML", () => {
    const html = renderArchiviPage(ESEMPIO, null, null, '<b>&x"');
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain('value="<');
  });

  it("cerca vuota produce lo stesso HTML della chiamata a 1 argomento", () => {
    const senzaArgomento = renderArchiviPage(ESEMPIO);
    const conCercaVuota = renderArchiviPage(ESEMPIO, null, null, "");
    expect(conCercaVuota).toBe(senzaArgomento);
    expect(conCercaVuota).toContain('href="/archivi/island?date=2025-01-12"');
    expect(conCercaVuota).toContain('href="/archivi/bloom?date=2025-02-03"');
  });

  it("nessuno <script> né fetch( in nessun caso (vuota, con match, senza match)", () => {
    const casi = [
      renderArchiviPage(ESEMPIO, null, null, ""),
      renderArchiviPage(ESEMPIO, null, null, "isl"),
      renderArchiviPage(ESEMPIO, null, null, "zzz"),
    ];
    for (const html of casi) {
      expect(html).not.toContain("<script");
      expect(html).not.toContain("fetch(");
    }
  });
});
