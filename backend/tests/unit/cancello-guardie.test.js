// Copre la regressione delle guardie assolute (maxDeriva/maxDegrado) di
// verdict(): con soglia 0, negativa o non numerica il divisore usato per
// calcolare il contributo alla distanza non deve più essere la soglia
// grezza (Infinity, contributo negativo, o guardia spenta in silenzio).
// Unit puro: nessun binding, nessuna rete, nessuna generazione.
import { describe, it, expect } from "vitest";
import { verdict } from "../../src/metrics.js";
import { CONFIG } from "../../src/config.js";

const dentro = { estensione: 15, intensita: 15, compattezza: 0.5 };
const profileBase = { estensione: [10, 20], intensita: [10, 20], compattezza: [0.3, 0.7] };

describe("cancello: guardie assolute con soglia 0, negativa o non numerica", () => {
  it("maxDeriva: 0 con deriva alta → distanza finita e > 0, ok false (non più Infinity)", () => {
    const m = { ...dentro, deriva: 50, degrado: 2 };
    const v = verdict(m, { ...profileBase, maxDeriva: 0 });
    expect(v.ok).toBe(false);
    expect(Number.isFinite(v.distanza)).toBe(true);
    expect(v.distanza).toBeGreaterThan(0);
  });

  it("maxDeriva: 0, due derive diverse → la distanza della peggiore è strettamente maggiore (generate.js:310 discrimina di nuovo)", () => {
    const profile = { ...profileBase, maxDeriva: 0 };
    const migliore = verdict({ ...dentro, deriva: 5, degrado: 2 }, profile);
    const peggiore = verdict({ ...dentro, deriva: 20, degrado: 2 }, profile);
    expect(peggiore.distanza).toBeGreaterThan(migliore.distanza);
  });

  it("maxDeriva: -5 (raggiungibile via concept custom) → nessun contributo negativo, distanza > 0, ok false", () => {
    const m = { ...dentro, deriva: 3, degrado: 2 };
    const v = verdict(m, { ...profileBase, maxDeriva: -5 });
    expect(v.ok).toBe(false);
    expect(v.distanza).toBeGreaterThan(0);
  });

  it("estensione fuori range + guardia negativa su maxDeriva → i due contributi non si annullano: ok resta false", () => {
    // Prima della guardia, un contributo negativo su deriva poteva compensare
    // esattamente quello positivo di estensione e portare distanza a 0.
    const m = { estensione: 30, intensita: 15, compattezza: 0.5, deriva: 3, degrado: 2 };
    const v = verdict(m, { ...profileBase, maxDeriva: -5 });
    expect(v.ok).toBe(false);
    expect(v.distanza).toBeGreaterThan(0);
  });

  it("maxDegrado: 0 con degrado alto → distanza finita e > 0, ok false", () => {
    const m = { ...dentro, deriva: 1, degrado: 40 };
    const v = verdict(m, { ...profileBase, maxDegrado: 0 });
    expect(v.ok).toBe(false);
    expect(Number.isFinite(v.distanza)).toBe(true);
    expect(v.distanza).toBeGreaterThan(0);
  });

  it("maxDegrado: -5 → nessun contributo negativo, distanza > 0, ok false", () => {
    const m = { ...dentro, deriva: 1, degrado: 3 };
    const v = verdict(m, { ...profileBase, maxDegrado: -5 });
    expect(v.ok).toBe(false);
    expect(v.distanza).toBeGreaterThan(0);
  });

  it("maxDeriva: NaN, maxDegrado: 'molto' → ricadono sui default di CONFIG, la guardia resta attiva", () => {
    const m = {
      ...dentro,
      deriva: CONFIG.MAX_DERIVA + 1,
      degrado: CONFIG.MAX_DEGRADO + 1,
    };
    const v = verdict(m, { ...profileBase, maxDeriva: NaN, maxDegrado: "molto" });
    expect(v.ok).toBe(false);
    expect(v.motivi.some((s) => /cambiata la luce/.test(s))).toBe(true);
    expect(v.motivi.some((s) => /perso dettaglio/.test(s))).toBe(true);
  });

  it("non regressione: profilo e misure normali → ok true, distanza 0, nessun motivo", () => {
    const m = { ...dentro, deriva: 1, degrado: 2 };
    const v = verdict(m, profileBase);
    expect(v).toEqual({ ok: true, distanza: 0, motivi: [] });
  });
});
