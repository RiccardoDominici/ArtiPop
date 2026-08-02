// feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-archivio: /archivi
// smette di nascondere i canali attivi. Una voce con `attivo: true` mostra la
// riga «canale in corso — vai a …» al posto della riga erede (che per un
// canale attivo non esiste comunque: LEGACY_ALIASES non ha chiavi attive), e
// il resto della card resta identico a quello di un canale storico. Nessun
// binding, nessuna rete: chiamata diretta come archivi-eredita.test.js.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";

const canale = ACTIVE_CHANNELS[0];

describe("renderArchiviPage — canali attivi", () => {
  it("una voce attiva mostra la riga «canale in corso» col link /?c=<id> e NON la riga erede", () => {
    const html = renderArchiviPage([
      { id: canale.id, giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", attivo: true },
    ]);
    expect(html).toContain("canale in corso");
    expect(html).toContain(`href="/?c=${canale.id}"`);
    expect(html).toContain(canale.emoji);
    expect(html).toContain(canale.name);
    expect(html).not.toContain("la storia continua in");
  });

  it("una voce storica con erede attivo continua a produrre la sola riga erede, invariata", () => {
    const html = renderArchiviPage([
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12", attivo: false },
    ]);
    expect(html).toContain("la storia continua in");
    expect(html).toContain('href="/?c=natura"');
    expect(html).not.toContain("canale in corso");
  });

  it("una voce attiva con id non risolvibile non produce alcuna riga aggiuntiva", () => {
    const html = renderArchiviPage([
      { id: "sconosciuto", giorni: 2, prima: "2025-01-01", ultima: "2025-01-02", attivo: true },
    ]);
    expect(html).not.toContain("canale in corso");
    expect(html).not.toContain("la storia continua in");
    expect(html).toContain("sconosciuto");
  });

  it("la card di un canale attivo ha gli stessi componenti di quella storica", () => {
    const html = renderArchiviPage([
      {
        id: canale.id, giorni: 2, prima: "2025-01-01", ultima: "2025-01-02", attivo: true,
        date: ["2025-01-02", "2025-01-01"],
      },
    ]);
    expect(html).toContain(`/w/${canale.id}?date=2025-01-02`);
    expect(html).toContain(`<span class="intervallo">`);
    expect(html).toContain(`<details class="giorni">`);
    expect(html).toContain(`&amp;dl=1`);
  });

  it("l'HTML servito non contiene né <script né fetch(", () => {
    const html = renderArchiviPage([
      { id: canale.id, giorni: 3, prima: "2025-01-01", ultima: "2025-01-03", attivo: true },
      { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12", attivo: false },
    ]);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });
});
