// Protegge il RIPIEGO di ultima istanza in poolForWith (catalog.js): le
// sospensioni (FAMIGLIE_SOSPESE/ELEMENT_SOSPESI, config.js) sono una
// preferenza di TARATURA, non una guardia di sicurezza — se svuotano
// l'intero pool di un flusso, poolForWith deve restituire il pool NON
// filtrato (con un log d'errore) invece di far morire il flusso ogni giorno.
// Il caso "pool vuoto di suo" (flusso senza alcun concept) resta invariato:
// lì pickConcept continua a lanciare, vedi story.test.js:117-121.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { poolForWith } from "../../src/catalog.js";
import { pickConcept } from "../../src/story.js";

const catalogVuoto = { concepts: {}, elements: {} };

// Stesso catalogo fittizio di story.test.js: un flusso senza famiglie
// built-in (`famiglie: []`), pescabile SOLO dai 3 element custom qui sotto —
// così ELEMENT_SOSPESI può coprire l'intero pool senza toccare produzione.
function famigliaFittizia() {
  return {
    id: "fam-test",
    nome: "Famiglia Test",
    conserva: "niente",
    tappe: Array.from({ length: 7 }, (_, i) => [`tappa ${i}`]),
    extra: ["dettaglio extra 0", "dettaglio extra 1"],
    profilo: { estensione: [10, 50], intensita: [5, 40], compattezza: [0.2, 0.8], monotona: false },
    maxDeriva: null,
    maxDegrado: null,
  };
}

function elementoFittizio(id, canale) {
  return {
    id,
    nome: id,
    s: id,
    soggetto: id,
    setting: `scena di prova per ${id}`,
    style: "stile di prova",
    palette: "palette di prova",
    famigliaNativa: "fam-test",
    tappe: null,
    extra: null,
    pubblicato: true,
    canale,
  };
}

function setupFittizio(ids) {
  const catalog = {
    concepts: { "fam-test": famigliaFittizia() },
    elements: Object.fromEntries(ids.map((id) => [id, elementoFittizio(id, "fake-channel")])),
  };
  const channel = { id: "fake-channel", famiglie: [] };
  return { channel, catalog };
}

describe("(a) guardia REALE: nessun flusso attivo pesca da un pool vuoto oggi", () => {
  it.each(ACTIVE_CHANNELS.map((c) => c.id))("flusso '%s': poolForWith(config vero, catalog vuoto) non è mai vuoto", (id) => {
    const channel = ACTIVE_CHANNELS.find((c) => c.id === id);
    expect(poolForWith(channel, catalogVuoto).length).toBeGreaterThan(0);
  });
});

describe("(b)+(c) ripiego quando le sospensioni svuotano l'intero pool", () => {
  let poolForWithMocked, pickConceptMocked, canaliMocked, erroreSpy;

  afterEach(() => {
    erroreSpy?.mockRestore();
  });

  describe("FAMIGLIE_SOSPESE copre entrambe le famiglie di 'citta'", () => {
    beforeAll(async () => {
      vi.resetModules();
      vi.doMock("../../src/config.js", async () => {
        const vero = await vi.importActual("../../src/config.js");
        return { ...vero, FAMIGLIE_SOSPESE: ["timelapse", "attraversamento"] };
      });
      ({ poolForWith: poolForWithMocked } = await import("../../src/catalog.js"));
      ({ pickConcept: pickConceptMocked } = await import("../../src/story.js"));
      ({ ACTIVE_CHANNELS: canaliMocked } = await import("../../src/channels.js"));
    });

    afterAll(() => {
      vi.doUnmock("../../src/config.js");
      vi.resetModules();
    });

    it("poolForWith(citta) non è vuoto e coincide col pool non filtrato", async () => {
      erroreSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const citta = canaliMocked.find((c) => c.id === "citta");
      const { conceptsForFamilies } = await import("../../src/concepts.js");
      const nonFiltrato = conceptsForFamilies(citta.famiglie);

      const pool = poolForWithMocked(citta, catalogVuoto);

      expect(pool.length).toBeGreaterThan(0);
      expect(pool.map((c) => c.id).sort()).toEqual(nonFiltrato.map((c) => c.id).sort());
      expect(erroreSpy).toHaveBeenCalledTimes(1);
      expect(erroreSpy.mock.calls[0][0]).toContain("citta");
    });

    it("pickConcept(citta) non lancia e restituisce un concept del flusso", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const citta = canaliMocked.find((c) => c.id === "citta");
      const { concept } = pickConceptMocked(citta, null, 0, catalogVuoto);
      expect(concept).toBeDefined();
      expect(["timelapse", "attraversamento"]).toContain(concept.famiglia.id);
    });
  });

  describe("ELEMENT_SOSPESI copre tutti gli element di un flusso senza built-in pescabili", () => {
    beforeAll(async () => {
      vi.resetModules();
      vi.doMock("../../src/config.js", async () => {
        const vero = await vi.importActual("../../src/config.js");
        return { ...vero, ELEMENT_SOSPESI: ["a", "b", "c"] };
      });
      ({ poolForWith: poolForWithMocked } = await import("../../src/catalog.js"));
      ({ pickConcept: pickConceptMocked } = await import("../../src/story.js"));
    });

    afterAll(() => {
      vi.doUnmock("../../src/config.js");
      vi.resetModules();
    });

    it("poolForWith non è vuoto e coincide col pool non filtrato", () => {
      erroreSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { channel, catalog } = setupFittizio(["a", "b", "c"]);

      const pool = poolForWithMocked(channel, catalog);

      expect(pool.length).toBe(3);
      expect(pool.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
      expect(erroreSpy).toHaveBeenCalledTimes(1);
      expect(erroreSpy.mock.calls[0][0]).toContain("fake-channel");
    });

    it("pickConcept non lancia e restituisce un concept del flusso", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { channel, catalog } = setupFittizio(["a", "b", "c"]);
      const { concept } = pickConceptMocked(channel, null, 0, catalog);
      expect(concept).toBeDefined();
      expect(["a", "b", "c"]).toContain(concept.id);
    });
  });
});

describe("(d) non-regressione: sospendendo UNA sola delle due famiglie di 'citta', il ripiego non si attiva", () => {
  let poolForWithMocked, canaliMocked;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../src/config.js", async () => {
      const vero = await vi.importActual("../../src/config.js");
      return { ...vero, FAMIGLIE_SOSPESE: ["timelapse"] };
    });
    ({ poolForWith: poolForWithMocked } = await import("../../src/catalog.js"));
    ({ ACTIVE_CHANNELS: canaliMocked } = await import("../../src/channels.js"));
  });

  afterAll(() => {
    vi.doUnmock("../../src/config.js");
    vi.resetModules();
  });

  it("il filtro resta attivo: nessun concept 'timelapse' nel pool, nessun log d'errore", () => {
    const erroreSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const citta = canaliMocked.find((c) => c.id === "citta");

    const pool = poolForWithMocked(citta, catalogVuoto);

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((c) => c.famiglia.id !== "timelapse")).toBe(true);
    expect(erroreSpy).not.toHaveBeenCalled();
    erroreSpy.mockRestore();
  });
});

describe("(e) pool vuoto DI SUO: il ripiego non si attiva, pickConcept lancia ancora", () => {
  it("poolForWith → [] e pickConcept lancia 'nessun concept disponibile'", () => {
    const erroreSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const channel = { id: "flusso-vuoto", famiglie: [] };
    const catalog = { concepts: {}, elements: {} };

    expect(poolForWith(channel, catalog)).toEqual([]);
    expect(() => pickConcept(channel, null, 0, catalog)).toThrow("flusso flusso-vuoto: nessun concept disponibile");
    expect(erroreSpy).not.toHaveBeenCalled();
    erroreSpy.mockRestore();
  });
});
