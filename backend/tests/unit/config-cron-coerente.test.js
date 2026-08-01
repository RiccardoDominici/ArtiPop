// feat-quando-arriva-il-prossimo-wallpaper: la home mostra l'orario del
// prossimo wallpaper ricavandolo da ORA_CRON_UTC in backend/src/page.js.
// Se un domani si sposta l'orario del cron di produzione in
// backend/wrangler.jsonc senza aggiornare quella costante, la home
// continuerebbe a mostrare un orario sbagliato: questo test rompe apposta
// in quel caso, invece di lasciarla mentire all'utente.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leggiWrangler } from "../helpers/jsonc.js";

describe("coerenza — orario del cron di produzione vs. home", () => {
  it("l'ORA_CRON_UTC dichiarata in page.js coincide con l'ora di triggers.crons in produzione", () => {
    const { config } = leggiWrangler();
    const [minuto, ora] = config.triggers.crons[0].split(" ");
    expect(minuto).toBe("0"); // il cron scatta in punto: la home mostra solo HH:00

    const pagePath = fileURLToPath(new URL("../../src/page.js", import.meta.url));
    const pageSrc = readFileSync(pagePath, "utf8");
    const match = pageSrc.match(/const ORA_CRON_UTC = (\d+);/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(ora);
  });
});
