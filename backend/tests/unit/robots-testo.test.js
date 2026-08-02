// feat-il-sito-si-fa-trovare-solo-dove-serve: copertura pura di
// renderRobots() — vedi robots-rotta.test.js per la copertura end-to-end
// sulla rotta.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderRobots } from "../../src/robots.js";

const ROTTE_DI_SERVIZIO = [
  "/tuning",
  "/lab/",
  "/catalogo",
  "/note",
  "/api/",
  "/health",
  "/backfill",
  "/regen-day",
  "/run-all",
  "/test-metrics",
  "/test-size",
];

describe("renderRobots", () => {
  const corpo = renderRobots();
  const righe = corpo.split("\n").filter((riga) => riga.length > 0);

  it("contiene esattamente una direttiva User-agent: *", () => {
    const occorrenze = righe.filter((riga) => riga === "User-agent: *");
    expect(occorrenze.length).toBe(1);
  });

  it("contiene Allow: /", () => {
    expect(righe).toContain("Allow: /");
  });

  it("contiene una riga Disallow per ciascuna delle 11 rotte di servizio", () => {
    for (const path of ROTTE_DI_SERVIZIO) {
      expect(righe).toContain(`Disallow: ${path}`);
    }
  });

  it("non contiene alcuna Disallow che blocchi /w/ né la radice Disallow: / da sola", () => {
    expect(righe).not.toContain("Disallow: /w/");
    expect(righe).not.toContain("Disallow: /");
    for (const riga of righe) {
      if (riga.startsWith("Disallow:")) {
        expect(riga.startsWith("Disallow: /w/")).toBe(false);
      }
    }
  });

  it("ogni riga non vuota rispetta la forma Chiave: valore", () => {
    for (const riga of righe) {
      expect(riga).toMatch(/^[A-Za-z-]+: .+$/);
    }
  });

  it("ogni path citato in una Disallow corrisponde a una rotta realmente presente in index.js", () => {
    const indexPath = fileURLToPath(new URL("../../src/index.js", import.meta.url));
    const sorgente = readFileSync(indexPath, "utf-8");
    for (const path of ROTTE_DI_SERVIZIO) {
      expect(sorgente).toContain(path);
    }
  });
});
