// Protegge il MECCANISMO di sospensione a granularità ELEMENT introdotto da
// M10 (ELEMENT_SOSPESI in config.js + filtro in poolForWith, catalog.js):
// stesso schema di FAMIGLIE_SOSPESE (M9, vedi famiglie-sospese.test.js) ma
// filtrato per id dell'ELEMENT invece che per id della famiglia.
//
// M10 (2026-07-31) ha misurato che `canoa` non passa il cancello nemmeno con
// la riformulazione delle tappe che ha invece tarato `attraversamento`
// (estensione ~33% fuori profilo, compattezza 0.35 sotto il minimo): resta
// nel roster (concepts.js, archivio, id esplicito dal lab) ma sparisce dalla
// pesca CASUALE finché un arco lab gated su preview non la riporta dentro il
// profilo. Questa suite collauda sia il risultato concreto su "canoa" (lista
// reale non vuota) sia il MECCANISMO generico (mockando un altro element),
// per garantire che il filtro non sia cablato sul solo id "canoa".
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { poolForWith, resolveConcept } from "../../src/catalog.js";
import { pickConcept, evolveStory } from "../../src/story.js";
import { ELEMENT_SOSPESI } from "../../src/config.js";

// Catalogo custom vuoto: stessa forma di un ambiente reale senza element
// aggiunti dall'admin (vedi loadCatalog in catalog.js).
const catalogVuoto = { concepts: {}, elements: {} };

describe("ELEMENT_SOSPESI (config.js)", () => {
  it("contiene 'canoa' (precondizione dei test su risultato concreto)", () => {
    expect(ELEMENT_SOSPESI).toEqual(["canoa"]);
  });
});

describe("(a) nessun flusso attivo ha 'canoa' nel pool pescabile, e il pool resta non vuoto", () => {
  it.each(ACTIVE_CHANNELS.map((c) => c.id))("flusso '%s': poolForWith non contiene canoa", (id) => {
    const channel = ACTIVE_CHANNELS.find((c) => c.id === id);
    const pool = poolForWith(channel, catalogVuoto);
    expect(pool.length).toBeGreaterThan(0); // precondizione: il pool non è vuoto per un altro motivo
    expect(pool.some((c) => c.id === "canoa")).toBe(false);
  });
});

describe("(b) pickConcept non può mai restituire 'canoa'", () => {
  it("su ogni flusso attivo, molte pescate consecutive non pescano mai canoa", () => {
    for (const channel of ACTIVE_CHANNELS) {
      let state = null;
      const pool = poolForWith(channel, catalogVuoto);
      for (let arcIndex = 0; arcIndex < pool.length + 2; arcIndex++) {
        const { concept, usati } = pickConcept(channel, state, arcIndex, catalogVuoto);
        expect(concept.id).not.toBe("canoa");
        state = { usati };
      }
    }
  });
});

describe("(c) le due esenzioni deliberate restano aperte per 'canoa'", () => {
  it("resolveConcept('canoa', …) resta risolvibile: la via esplicita del lab non è filtrata", () => {
    const concept = resolveConcept("canoa", catalogVuoto);
    expect(concept).toBeDefined();
    expect(concept.id).toBe("canoa");
    expect(concept.famiglia.id).toBe("attraversamento");
  });

  it("evolveStory su uno stato con conceptId 'canoa' a metà arco prosegue lo STESSO concept, non lo tronca", () => {
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    expect(citta).toBeDefined(); // precondizione: esiste un flusso della giusta indole
    const statoAMano = {
      lastDate: "2026-07-01",
      dayNumber: Math.floor(Date.parse("2026-07-01T00:00:00Z") / 86400000),
      arcIndex: 3,
      dayInArc: 2,
      conceptId: "canoa",
      stage: 2,
      scene: "scena del giorno precedente",
      seed: 12345,
      anchorDate: "2026-06-29",
      prevDate: "2026-06-30",
      usati: ["canoa"],
      extraIndex: null,
      dosePartenza: 0,
    };
    const domani = evolveStory(citta, statoAMano, "2026-07-02", "ok", catalogVuoto);
    expect(domani.conceptId).toBe("canoa");
    expect(domani.arcIndex).toBe(3);
    expect(domani.dayInArc).toBe(3);
  });
});

describe("(d) meccanismo generico: il filtro non è cablato sul solo id 'canoa'", () => {
  // Mocka ELEMENT_SOSPESI su un altro element del roster (built-in, non
  // canoa) per dimostrare che poolForWith filtra per QUALSIASI id elencato,
  // stesso schema già usato per FAMIGLIE_SOSPESE in famiglie-sospese.test.js.
  let poolForWithSospeso, altroElementId, canaliSospesi;

  beforeAll(async () => {
    // Sceglie un element built-in diverso da "canoa" leggendo il pool reale
    // di un flusso qualsiasi, prima di mockare.
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    const poolReale = poolForWith(citta, catalogVuoto);
    const candidato = poolReale.find((c) => c.id !== "canoa");
    expect(candidato).toBeDefined(); // precondizione: esiste un altro element nel pool
    altroElementId = candidato.id;

    vi.resetModules();
    vi.doMock("../../src/config.js", async () => {
      const vero = await vi.importActual("../../src/config.js");
      return { ...vero, ELEMENT_SOSPESI: [altroElementId] };
    });
    ({ poolForWith: poolForWithSospeso } = await import("../../src/catalog.js"));
    ({ ACTIVE_CHANNELS: canaliSospesi } = await import("../../src/channels.js"));
  });

  afterAll(() => {
    vi.doUnmock("../../src/config.js");
    vi.resetModules();
  });

  it("l'element mockato come sospeso sparisce dal pool, e 'canoa' (non elencata nel mock) torna pescabile", () => {
    const citta = canaliSospesi.find((c) => c.famiglie.includes("attraversamento"));
    const pool = poolForWithSospeso(citta, catalogVuoto);
    expect(pool.some((c) => c.id === altroElementId)).toBe(false);
    expect(pool.some((c) => c.id === "canoa")).toBe(true);
  });
});
