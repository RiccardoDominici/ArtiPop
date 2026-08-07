// feat-il-giorno-d-archivio-si-condivide-con-un-tocco: la pagina di un
// giorno d'archivio guadagna un comando «copia link» che mette negli
// appunti l'indirizzo canonico di quel giorno — miglioramento progressivo,
// visibile solo se il browser espone `navigator.clipboard`. Lo script vive
// nello STESSO blocco `<script>` delle scorciatoie da tastiera
// (v. archivi-tastiera.test.js), mai un secondo blocco.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio, renderArchiviPage, renderArchivioNonTrovato } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

const blocco = (html) => html.match(/<script>[\s\S]*?<\/script>/)[0];

describe("renderGiornoArchivio — copia link", () => {
  it("il bottone .copia-link è nel markup, hidden di default", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('<button class="salva copia-link" type="button" hidden');
    expect(html).toContain(">copia link</button>");
  });

  it("aria-label cita data e nome del canale", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('aria-label="Copia il link del giorno 2025-01-02 di island"');
  });

  it("id/data ostili restano escapati, e lo script resta identico (nessun valore interpolato)", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const htmlOstile = renderGiornoArchivio({
      id: '<b>x"',
      data: '2025-01-01"><img>',
      date: DATE,
    });
    expect(htmlOstile).not.toContain('<b>x"');
    expect(htmlOstile).not.toContain('"><img>');
    expect(htmlOstile).toContain("&lt;b&gt;x&quot;");
    expect(blocco(htmlOstile)).toBe(blocco(html));
  });

  it("lo script legge il canonical con ripiego su location.href", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const s = blocco(html);
    expect(s).toContain('link[rel="canonical"]');
    expect(s).toContain("location.href");
    expect(s).toContain("navigator.clipboard");
  });

  it("gestisce l'errore di copia senza eccezioni non gestite", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const s = blocco(html);
    expect(s).toContain("copia non riuscita");
    expect(s).toContain("link copiato");
    expect(s).toContain("try");
    expect(s).toContain("catch");
  });

  it("un solo <script> nella pagina del giorno (contratto §2.2)", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1);
  });

  it("il bottone c'è anche senza origin (canonical assente, il ripiego copre il caso)", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('class="salva copia-link"');
    expect(html).not.toContain('<link rel="canonical"');
  });

  it("l'elenco /archivi resta invariato: nessun bottone, nessuno script", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", date: DATE },
    ]);
    expect(html).not.toContain("copia-link");
    expect(html).not.toContain("<script");
  });

  it("la pagina «archivio non trovato» resta invariata: nessun bottone, nessuno script", () => {
    const htmlConGiorni = renderArchivioNonTrovato("island", DATE);
    const htmlIgnoto = renderArchivioNonTrovato("ignoto");
    expect(htmlConGiorni).not.toContain("copia-link");
    expect(htmlConGiorni).not.toContain("<script");
    expect(htmlIgnoto).not.toContain("copia-link");
    expect(htmlIgnoto).not.toContain("<script");
  });
});
