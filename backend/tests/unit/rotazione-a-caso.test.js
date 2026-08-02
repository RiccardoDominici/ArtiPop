// feat-riscopri-un-giorno-a-caso-dall-archivio: scegliDataACaso è pura, `r`
// iniettabile rende i test deterministici senza mockare Math.random.
import { describe, it, expect } from "vitest";
import { scegliDataACaso, scegliDataRotazione } from "../../src/rotazione.js";

describe("scegliDataACaso: input degeneri", () => {
  it("array vuoto → null", () => {
    expect(scegliDataACaso([], 0.5)).toBeNull();
  });

  it("non-array → null", () => {
    expect(scegliDataACaso(null, 0.5)).toBeNull();
    expect(scegliDataACaso(undefined, 0.5)).toBeNull();
    expect(scegliDataACaso("2026-01-15", 0.5)).toBeNull();
  });

  it("r non finito → null", () => {
    expect(scegliDataACaso(["2026-01-15"], NaN)).toBeNull();
    expect(scegliDataACaso(["2026-01-15"], Infinity)).toBeNull();
    expect(scegliDataACaso(["2026-01-15"], -Infinity)).toBeNull();
  });

  it("r fuori [0,1) → null", () => {
    expect(scegliDataACaso(["2026-01-15"], 1)).toBeNull();
    expect(scegliDataACaso(["2026-01-15"], 1.5)).toBeNull();
    expect(scegliDataACaso(["2026-01-15"], -0.1)).toBeNull();
  });
});

describe("scegliDataACaso: scelta", () => {
  const date = ["2026-01-15", "2026-01-16", "2026-01-17"];

  it("r = 0 → prima data", () => {
    expect(scegliDataACaso(date, 0)).toBe(date[0]);
  });

  it("r prossimo a 1 → ultima data, mai undefined", () => {
    const scelta = scegliDataACaso(date, 0.999999);
    expect(scelta).toBe(date[date.length - 1]);
    expect(scelta).not.toBeUndefined();
  });

  it("su una griglia di r il risultato è sempre un elemento dell'array", () => {
    for (let i = 0; i < 100; i++) {
      const r = i / 100;
      expect(date).toContain(scegliDataACaso(date, r));
    }
  });

  it("con una sola data → quella data", () => {
    expect(scegliDataACaso(["2026-01-15"], 0)).toBe("2026-01-15");
    expect(scegliDataACaso(["2026-01-15"], 0.999999)).toBe("2026-01-15");
  });

  it("senza r esplicito usa un default e non lancia mai", () => {
    expect(() => scegliDataACaso(date)).not.toThrow();
    expect(date).toContain(scegliDataACaso(date));
  });
});

describe("scegliDataACaso non altera scegliDataRotazione", () => {
  it("scegliDataRotazione resta deterministica per una giornoKey fissa", () => {
    const date = ["2026-01-15", "2026-01-16", "2026-01-17"];
    const a = scegliDataRotazione(date, "2026-03-01");
    const b = scegliDataRotazione(date, "2026-03-01");
    expect(a).toBe(b);
    expect(date).toContain(a);
  });
});
