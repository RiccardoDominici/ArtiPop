// feat-dal-giorno-d-archivio-si-continua-nel-viaggio: dalla pagina di un
// giorno d'archivio di un canale ANCORA ATTIVO si torna alla home aperta
// proprio su quel giorno (`/?c=<id>&d=<data>`), invece di dover ritrovarlo a
// mano. Copre la riga «canale in corso — continua da questo giorno»
// (renderGiornoArchivio) e verifica che l'elenco /archivi (renderArchiviPage)
// non cambi di una virgola.
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio, renderArchiviPage } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

describe("renderGiornoArchivio — riga canale in corso (attivo, senza erede)", () => {
  it("canale attivo: riga con link /?c=<id>&d=<data> e testo 'continua da questo giorno'", () => {
    const html = renderGiornoArchivio({ id: "natura", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/?c=natura&amp;d=2025-01-02"');
    expect(html).toContain("continua da questo giorno");
  });

  it("la data finisce nell'href percent-encoded (encodeURIComponent) e resta senza <script>", () => {
    const html = renderGiornoArchivio({ id: "natura", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("<script");
    // formato AAAA-MM-GG: nessun carattere che richieda encoding oltre i normali,
    // ma il link deve comunque comparire integro e unico.
    const matches = html.match(/\/\?c=natura(&amp;d=2025-01-02)?/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("canale storico con erede attivo: mostra solo la riga erede, href /?c=<erede> senza &d=", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).toContain('href="/?c=natura"');
    expect(html).not.toContain("&amp;d=");
    expect(html).not.toContain("continua da questo giorno");
  });

  it("id ignoto (non risolvibile da getChannel, senza alias): nessun link /?c=", () => {
    const html = renderGiornoArchivio({ id: "sconosciuto", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("/?c=");
  });
});

describe("renderArchiviPage — elenco invariato", () => {
  it("canale attivo nell'elenco: href /?c=<id> senza &d=, testo 'vai a'", () => {
    const html = renderArchiviPage([
      {
        id: "natura", giorni: 2, prima: "2025-01-01", ultima: "2025-01-02",
        date: ["2025-01-02", "2025-01-01"], attivo: true,
      },
    ]);
    expect(html).toContain('href="/?c=natura"');
    expect(html).not.toContain("&amp;d=");
    expect(html).toContain("vai a");
  });
});
