// feat-lo-sfondo-di-oggi-puo-venire-da-tutto-l-archivio: scegliDataRotazione
// è pura (niente env, niente rete, niente Math.random) — la si testa senza
// alcun mock, solo array letterali.
import { describe, it, expect } from "vitest";
import { scegliDataRotazione } from "../../src/rotazione.js";

describe("scegliDataRotazione: input degeneri", () => {
  it("array vuoto → null", () => {
    expect(scegliDataRotazione([], "2026-01-15")).toBeNull();
  });

  it("non-array → null", () => {
    expect(scegliDataRotazione(null, "2026-01-15")).toBeNull();
    expect(scegliDataRotazione(undefined, "2026-01-15")).toBeNull();
    expect(scegliDataRotazione("2026-01-15", "2026-01-15")).toBeNull();
  });

  it("giornoKey malformata → null", () => {
    expect(scegliDataRotazione(["2026-01-15", "2026-01-16"], "non-una-data")).toBeNull();
  });
});

describe("scegliDataRotazione: determinismo", () => {
  const date = ["2026-01-15", "2026-01-16", "2026-01-17"];

  it("stessa giornoKey → stessa data su due chiamate", () => {
    const a = scegliDataRotazione(date, "2026-03-01");
    const b = scegliDataRotazione(date, "2026-03-01");
    expect(a).toBe(b);
  });

  it("la data restituita appartiene sempre all'array", () => {
    for (const giorno of ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"]) {
      expect(date).toContain(scegliDataRotazione(date, giorno));
    }
  });

  it("su giorni consecutivi la rotazione avanza davvero", () => {
    const scelte = new Set([
      scegliDataRotazione(date, "2026-03-01"),
      scegliDataRotazione(date, "2026-03-02"),
      scegliDataRotazione(date, "2026-03-03"),
    ]);
    expect(scelte.size).toBe(3);
  });
});
