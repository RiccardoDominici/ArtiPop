// feat-due-giorni-d-archivio-uno-accanto-all-altro: sulla pagina di un giorno
// d'archivio si affianca un secondo giorno dello stesso canale con
// `?confronta=<data>` — due wallpaper uno accanto all'altro, per vedere come
// è cambiato il canale fra due date. Tutto server-rendered, nessun JS.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — confronto fra due giorni", () => {
  it("con confronta valida: due <figure> coi src attesi", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE, confronta: "2025-01-01",
    });
    expect((html.match(/<figure class="foto"/g) || []).length).toBe(2);
    expect(html).toContain('<img src="/w/island?date=2025-01-02"');
    expect(html).toContain('<img src="/w/island?date=2025-01-01"');
    expect(html).toContain('<div class="confronto">');
  });

  it("due date estese in <figcaption>", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE, confronta: "2025-01-01",
    });
    expect((html.match(/<figcaption>/g) || []).length).toBe(2);
    expect(html).toContain('<time datetime="2025-01-02">');
    expect(html).toContain('<time datetime="2025-01-01">');
  });

  it("identità: confronta assente, malformata, uguale al giorno o non in archivio → pagina identica", () => {
    const args = { id: "island", data: "2025-01-02", date: DATE };
    const base = renderGiornoArchivio(args);
    expect(renderGiornoArchivio({ ...args, confronta: undefined })).toBe(base);
    expect(renderGiornoArchivio({ ...args, confronta: "non-una-data" })).toBe(base);
    expect(renderGiornoArchivio({ ...args, confronta: "2025-01-02" })).toBe(base);
    expect(renderGiornoArchivio({ ...args, confronta: "2024-12-31" })).toBe(base);
  });

  it("link d'ingresso: solo con un precedente e fuori confronto", () => {
    const barra = (html) => html.slice(html.indexOf('<nav class="giorni-nav"'), html.indexOf("</nav>"));

    const conPrecedente = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(conPrecedente).toContain("confronta=2025-01-01");
    expect(conPrecedente).toContain("confronta col precedente");

    const senzaPrecedente = renderGiornoArchivio({ id: "island", data: "2025-01-01", date: DATE });
    expect(barra(senzaPrecedente)).not.toContain("confronta=");
    expect(senzaPrecedente).not.toContain("confronta col precedente");

    const inConfronto = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE, confronta: "2025-01-01",
    });
    expect(barra(inConfronto)).not.toContain("confronta=");
    expect(inConfronto).not.toContain("confronta col precedente");
  });

  it("link d'uscita: «chiudi il confronto» verso il giorno singolo", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE, confronta: "2025-01-01",
    });
    expect(html).toContain('<a class="salva chiudi" href="/archivi/island?date=2025-01-02">');
    expect(html).toContain("chiudi il confronto");
  });

  it("contratto script: un solo <script>, nessuna fetch(", () => {
    const html = renderGiornoArchivio({
      id: "island", data: "2025-01-02", date: DATE, confronta: "2025-01-01",
    });
    expect((html.match(/<script/g) || []).length).toBe(1);
    expect(html).not.toContain("fetch(");
  });

  it("escaping/encoding: id con spazio nel link d'ingresso", () => {
    const html = renderGiornoArchivio({ id: "isola blu", data: "2025-01-02", date: DATE });
    expect(html).toContain(
      `/archivi/${encodeURIComponent("isola blu")}?date=2025-01-02&amp;confronta=${encodeURIComponent("2025-01-01")}`,
    );
  });
});
