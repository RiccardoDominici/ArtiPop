// feat-il-giorno-d-archivio-si-sfoglia-col-dito: una strisciata orizzontale
// del dito segue gli stessi link precedente/successivo già presenti nel
// markup, con le stesse guardie di attachJourneySwipe sulla home (page.js).
// Lo stesso blocco <script> (GIORNO_SCRIPT) ospita anche la prima IIFE di
// feat-il-giorno-d-archivio-si-sfoglia-con-la-tastiera (v.
// archivi-tastiera.test.js) e la seconda di
// feat-il-giorno-d-archivio-si-condivide-con-un-tocco (v.
// archivi-condividi.test.js).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio, renderArchiviPage, renderArchivioNonTrovato } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];
const blocco = (html) => html.match(/<script>[\s\S]*?<\/script>/)[0];

describe("renderGiornoArchivio — sfogliare col dito", () => {
  it("aggancia pointerdown/pointerup/pointercancel", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);
    expect(script).toContain("pointerdown");
    expect(script).toContain("pointerup");
    expect(script).toContain("pointercancel");
  });

  it("segue i link già in pagina, non ricostruisce URL", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);
    expect(script).toContain("a.successivo");
    expect(script).toContain("a.precedente");

    const terzaIife = script.slice(script.lastIndexOf("(function () {"));
    expect(terzaIife).not.toContain("?date=");

    const nav = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/)[0];
    expect(nav).toContain('class="precedente"');
    expect(nav).toContain('class="successivo"');
  });

  it("guardie: soglia orizzontale, dominanza |dx|>|dy|, pointerType, elementi interattivi esclusi", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);

    expect(script).toMatch(/Math\.abs\(dx\) *< *(SOGLIA|48)/);
    expect(script).toContain("48");
    expect(script).toMatch(/Math\.abs\(dx\) *<= *Math\.abs\(dy\)/);
    expect(script).toContain("pointerType");
    expect(script).toContain('"touch"');
    expect(script).toContain('"pen"');

    const guardia = script.match(/closest\("([^"]+)"\)/)[1];
    for (const tag of ["a", "button", "input", "textarea", "select", "summary", "details", "contenteditable"]) {
      expect(guardia).toContain(tag);
    }
  });

  it("contratto §2.2: un solo <script>, nessuna fetch(, nessun gestore inline", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1);
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("onclick");
  });

  it("/archivi e la pagina d'errore restano senza <script>", () => {
    const listaHtml = renderArchiviPage([{ id: "island", giorni: 3, ultima: "2025-01-03", date: DATE }]);
    const erroreHtml = renderArchivioNonTrovato("island", DATE);
    expect(listaHtml).not.toContain("<script");
    expect(listaHtml).not.toContain("pointerdown");
    expect(erroreHtml).not.toContain("<script");
    expect(erroreHtml).not.toContain("pointerdown");
  });

  it("nessun elemento visibile nuovo rispetto al markup esistente", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const htmlSenzaScript = html.replace(/<script>[\s\S]*?<\/script>/, "");
    expect(htmlSenzaScript).not.toContain("swipe");
    expect(htmlSenzaScript).not.toContain("data-swipe");
    expect(htmlSenzaScript).not.toContain("overlay");
    expect((htmlSenzaScript.match(/<button/g) || []).length).toBe(1);
  });

  it("al bordo dell'archivio (giorno singolo) il gesto non trova link: script comunque identico", () => {
    const htmlSolo = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: ["2025-02-01"] });
    const htmlPieno = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(htmlSolo).not.toContain('class="precedente"');
    expect(htmlSolo).not.toContain('class="successivo"');
    expect(blocco(htmlSolo)).toBe(blocco(htmlPieno));
  });
});
