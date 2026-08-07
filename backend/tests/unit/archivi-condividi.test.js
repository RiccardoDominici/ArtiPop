// feat-il-giorno-d-archivio-si-condivide-con-un-tocco: bottone «condividi»
// nella barra della pagina di un giorno d'archivio — via primaria il foglio
// di condivisione nativo (navigator.share), ripiego negli appunti dove non
// c'è. Stesso doppio binario già collaudato sulla home (#dayshare in
// page.js). Lo script convive con quello delle scorciatoie da tastiera
// (feat-il-giorno-d-archivio-si-sfoglia-con-la-tastiera) nello stesso unico
// <script> (v. archivi-tastiera.test.js).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio, renderArchiviPage, renderArchivioNonTrovato } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

const blocco = (html) => html.match(/<script>[\s\S]*?<\/script>/)[0];

describe("renderGiornoArchivio — condividi con un tocco", () => {
  it("bottone .condividi nella barra, hidden, con aria-label che nomina data e canale", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const nav = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/)[0];
    expect(nav).toContain('<button class="salva condividi" type="button" hidden');
    expect(nav).toContain('aria-label="Condividi il giorno 2025-01-02 di island"');
    expect(nav).toContain(">condividi</button>");
  });

  it("doppio binario nello script: navigator.share e ripiego navigator.clipboard.writeText", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);
    expect(script).toContain("navigator.share");
    expect(script).toContain("navigator.clipboard");
    expect(script).toContain("writeText");
    expect(script).toContain("AbortError");
  });

  it("l'indirizzo condiviso viene dal <link rel=\"canonical\">, con ripiego location.href", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);
    expect(script).toContain('link[rel="canonical"]');
    expect(script).toContain("location.href");
  });

  it("un solo <script> in tutta la pagina, nessuna fetch(", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1);
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("onclick");
  });

  it("l'elenco /archivi e la pagina d'errore restano senza <script> e senza bottone condividi", () => {
    const elenco = renderArchiviPage([
      { id: "island", giorni: 3, ultima: "2025-01-03", date: DATE },
    ]);
    expect(elenco).not.toContain("<script");
    expect(elenco).not.toContain("condividi");

    const errore = renderArchivioNonTrovato("island", DATE);
    expect(errore).not.toContain("<script");
    expect(errore).not.toContain("condividi");
  });

  it("script statico e non iniettabile, aria-label escapato, anche con id/data ostili", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const htmlOstile = renderGiornoArchivio({
      id: "<b>x",
      data: '2025-01-01"><script>alert(1)</script>',
      date: DATE,
    });
    expect(blocco(htmlOstile)).toBe(blocco(html));
    expect(htmlOstile).not.toContain("<script>alert(1)</script>");
    expect(htmlOstile).toContain("&lt;b&gt;x");
  });

  it("bordi: date vuote o assenti, la pagina renderizza senza errori e il bottone c'è comunque", () => {
    expect(() => renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: [] })).not.toThrow();
    expect(() => renderGiornoArchivio({ id: "bloom", data: "2025-02-01" })).not.toThrow();

    const htmlVuoto = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: [] });
    const htmlAssente = renderGiornoArchivio({ id: "bloom", data: "2025-02-01" });
    expect(htmlVuoto).toContain('<button class="salva condividi" type="button" hidden');
    expect(htmlAssente).toContain('<button class="salva condividi" type="button" hidden');
  });
});
