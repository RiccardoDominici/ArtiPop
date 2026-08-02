// feat-riscopri-un-giorno-a-caso-dall-archivio: il comando «un giorno a
// caso» nella barra nav.giorni-nav, emesso solo con almeno 2 giorni in
// archivio (con un solo giorno porterebbe sempre alla pagina già aperta).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — un giorno a caso", () => {
  it("con almeno 2 date: link presente dentro nav.giorni-nav, classe salva e aria-label", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const navMatch = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/);
    expect(navMatch).not.toBeNull();
    const nav = navMatch[0];
    expect(nav).toContain('href="/archivi/island?date=casuale"');
    expect(nav).toContain('class="salva"');
    expect(nav).toContain("un giorno a caso");
    const linkMatch = nav.match(/<a[^>]*href="\/archivi\/island\?date=casuale"[^>]*>/);
    expect(linkMatch).not.toBeNull();
    expect(linkMatch[0]).toContain("aria-label=");
  });

  it("con una sola data: nessun link ?date=casuale", () => {
    const html = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    expect(html).not.toContain("date=casuale");
  });

  it("id con caratteri da percent-encodare", () => {
    const html = renderGiornoArchivio({
      id: "isola blu", data: "2025-01-02", date: ["2025-01-02", "2025-01-01"],
    });
    expect(html).toContain(`href="/archivi/${encodeURIComponent("isola blu")}?date=casuale"`);
  });
});
