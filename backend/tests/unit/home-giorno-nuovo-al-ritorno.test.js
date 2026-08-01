// feat-la-home-mostra-il-giorno-nuovo-quando-torni: chi lascia la scheda
// aperta durante la notte deve ritrovarla allineata al giorno nuovo quando
// torna, senza dover ricaricare a mano. Test puro su renderPage() — nessun
// binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function extractFn(name) {
  const src = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))[0];
  // giornoNuovoDisponibile chiude su ORA_CRON_UTC (costante globale dello
  // script client): la si porta nello scope valutato dal test.
  return new Function(`const ORA_CRON_UTC = 3; return (${src});`)();
}

describe("home — giorno nuovo al ritorno in primo piano", () => {
  describe("giornoNuovoDisponibile — tabella di verità", () => {
    const giornoNuovoDisponibile = extractFn("giornoNuovoDisponibile");
    const ORA_CRON_UTC = 3;

    it("stesso giorno servito, ore 10 UTC → false", () => {
      expect(
        giornoNuovoDisponibile("2026-08-01", new Date("2026-08-01T10:00:00Z"))
      ).toBe(false);
    });

    it("giorno successivo, ore 01 UTC (prima del cron) → false", () => {
      expect(
        giornoNuovoDisponibile("2026-08-01", new Date("2026-08-02T01:00:00Z"))
      ).toBe(false);
    });

    it("giorno successivo, ore 04 UTC (dopo il cron) → true", () => {
      expect(
        giornoNuovoDisponibile("2026-08-01", new Date("2026-08-02T04:00:00Z"))
      ).toBe(true);
    });

    it("giorno successivo di un anno diverso, ore 05 UTC → true (confronto per data, non per differenza numerica)", () => {
      expect(
        giornoNuovoDisponibile("2026-12-31", new Date("2027-01-01T05:00:00Z"))
      ).toBe(true);
    });

    it("proprio sull'ora del cron (>=) → true", () => {
      expect(
        giornoNuovoDisponibile(
          "2026-08-01",
          new Date(Date.UTC(2026, 7, 2, ORA_CRON_UTC, 0, 0))
        )
      ).toBe(true);
    });
  });

  it("registra esattamente un listener visibilitychange che controlla document.visibilityState e ricarica con location.reload()", () => {
    const matches = html.match(/document\.addEventListener\("visibilitychange"/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1);
    const listenerBody = html.match(
      /document\.addEventListener\("visibilitychange", \(\) => \{[\s\S]*?\n\}\);/
    )[0];
    expect(listenerBody).toContain('document.visibilityState !== "visible"');
    expect(listenerBody).toContain("location.reload()");
  });

  it("il listener non ricarica se si sta guardando un giorno d'archivio diverso da oggi", () => {
    const listenerBody = html.match(
      /document\.addEventListener\("visibilitychange", \(\) => \{[\s\S]*?\n\}\);/
    )[0];
    expect(listenerBody).toContain("previewDate !== null && previewDate !== TODAY");
  });

  it("il corpo del listener è avvolto in try/catch e il catch non contiene un reload", () => {
    const listenerBody = html.match(
      /document\.addEventListener\("visibilitychange", \(\) => \{[\s\S]*?\n\}\);/
    )[0];
    expect(listenerBody).toContain("try {");
    const catchBody = listenerBody.match(/\} catch \{[\s\S]*?\n  \}/)[0];
    expect(catchBody).not.toContain("location.reload()");
  });
});
