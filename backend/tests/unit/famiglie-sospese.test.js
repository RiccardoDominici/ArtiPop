// Protegge la sospensione M9 della famiglia `attraversamento`: non tarata sul
// campo (vedi families.js:146-154 e il commento su FAMIGLIE_SOSPESE in
// config.js), sfora i range e consuma tutti i tentativi ogni giorno. Finché
// M10 non la riporta in range, nessun flusso può pescarla per un arco nuovo.
//
// Il filtro vive in poolForWith (catalog.js), a valle dell'unione fra
// built-in e custom, e SOLO lì: qui si collauda che (a) nessun pool di
// produzione la contenga, (b) pickConcept non la restituisca mai su molte
// pescate, (c) un arco già in corso su di essa non si rompa (il filtro agisce
// solo sulla pesca CASUALE di un concept NUOVO, mai su resolveConcept di uno
// stato esistente), (d) il percorso di riammissione (togliere la famiglia da
// FAMIGLIE_SOSPESE) funzioni già oggi, per quando M10 lo userà davvero, (e)
// l'accesso ESPLICITO per id — combine()/resolveConcept(), la via con cui
// /lab/arc e /catalogo lavorano — resta intatto: M10 tarerà la famiglia
// proprio passando da qui, e deve poter continuare a farlo mentre M9 è attiva.
import { describe, it, expect, vi } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { poolForWith, resolveConcept, allFamilies } from "../../src/catalog.js";
import { pickConcept, evolveStory } from "../../src/story.js";
import { getConcept, combine } from "../../src/concepts.js";
import { FAMIGLIE_SOSPESE } from "../../src/config.js";
import { FAMILIES } from "../../src/families.js";

// Catalogo custom vuoto: stessa forma di un ambiente reale senza element
// aggiunti dall'admin (vedi loadCatalog in catalog.js).
const catalogVuoto = { concepts: {}, elements: {} };

describe("FAMIGLIE_SOSPESE (config.js)", () => {
  it("sospende esattamente 'attraversamento', per ora (precondizione degli altri test di questa suite)", () => {
    expect(FAMIGLIE_SOSPESE).toEqual(["attraversamento"]);
  });
});

describe("(a) nessun canale attivo ha concept di famiglia attraversamento nel pool pescabile", () => {
  it.each(ACTIVE_CHANNELS.map((c) => [c.id, c]))("flusso '%s': poolForWith non contiene concept attraversamento", (id, channel) => {
    const pool = poolForWith(channel, catalogVuoto);
    expect(pool.length).toBeGreaterThan(0); // precondizione: il pool non è vuoto per un altro motivo
    const sospesi = pool.filter((c) => c.famiglia.id === "attraversamento");
    expect(sospesi).toEqual([]);
  });

  it("il flusso 'citta' (indole timelapse + attraversamento) perde SOLO i concept attraversamento, non quelli timelapse", () => {
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    expect(citta).toBeDefined(); // precondizione: esiste un flusso della giusta indole
    const pool = poolForWith(citta, catalogVuoto);
    expect(pool.every((c) => c.famiglia.id === "timelapse")).toBe(true);
    expect(pool.some((c) => c.famiglia.id === "timelapse")).toBe(true);
  });
});

describe("(b) pickConcept non può mai restituire un concept attraversamento", () => {
  it("su un catalog reale (vuoto di custom), molte pescate consecutive sul flusso 'citta' non pescano mai attraversamento", () => {
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    let state = null;
    for (let arcIndex = 0; arcIndex < 60; arcIndex++) {
      const { concept, usati } = pickConcept(citta, state, arcIndex, catalogVuoto);
      expect(concept.famiglia.id).not.toBe("attraversamento");
      state = { usati };
    }
  });

  it("stesso collaudo su TUTTI i flussi attivi, non solo 'citta'", () => {
    for (const channel of ACTIVE_CHANNELS) {
      let state = null;
      for (let arcIndex = 0; arcIndex < 15; arcIndex++) {
        const { concept, usati } = pickConcept(channel, state, arcIndex, catalogVuoto);
        expect(concept.famiglia.id).not.toBe("attraversamento");
        state = { usati };
      }
    }
  });
});

describe("(c) un arco attraversamento già in corso non si rompe", () => {
  it("resolveConcept di un concept built-in attraversamento (es. 'veliero') resta pienamente risolvibile", () => {
    const concept = resolveConcept("veliero", catalogVuoto);
    expect(concept).toBeDefined();
    expect(concept.famiglia.id).toBe("attraversamento");
    expect(concept.tappe.length).toBe(7);
    // getConcept (concepts.js, letto direttamente da evolveStory in alcuni
    // rami di ripiego) è ugualmente non filtrato: stessa garanzia.
    expect(getConcept("veliero")).toBeDefined();
  });

  it("evolveStory su uno stato che punta a metà arco di un concept attraversamento continua lo STESSO arco, senza rollover forzato", () => {
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    const statoAMano = {
      lastDate: "2026-07-01",
      dayNumber: Math.floor(Date.parse("2026-07-01T00:00:00Z") / 86400000),
      arcIndex: 3,
      dayInArc: 2,
      conceptId: "veliero",
      stage: 2,
      scene: "scena del giorno precedente",
      seed: 12345,
      anchorDate: "2026-06-29",
      prevDate: "2026-06-30",
      usati: ["veliero"],
      extraIndex: null,
      dosePartenza: 0,
    };
    const domani = evolveStory(citta, statoAMano, "2026-07-02", "ok", catalogVuoto);
    // Stesso arco (non è stato interrotto né sostituito da un rollover): la
    // sospensione della famiglia non tocca un arco già aperto.
    expect(domani.conceptId).toBe("veliero");
    expect(domani.arcIndex).toBe(3);
    expect(domani.dayInArc).toBe(3);
  });
});

describe("(d) percorso di riammissione: togliendo la famiglia da FAMIGLIE_SOSPESE il pool la include di nuovo", () => {
  it("con FAMIGLIE_SOSPESE svuotata (mock di config.js), poolForWith torna a includere concept attraversamento", async () => {
    vi.resetModules();
    vi.doMock("../../src/config.js", async () => {
      const vero = await vi.importActual("../../src/config.js");
      return { ...vero, FAMIGLIE_SOSPESE: [] }; // simula M10: famiglia riammessa
    });

    try {
      const { poolForWith: poolForWithRiammesso } = await import("../../src/catalog.js");
      const { ACTIVE_CHANNELS: canaliRiammessi } = await import("../../src/channels.js");
      const citta = canaliRiammessi.find((c) => c.famiglie.includes("attraversamento"));

      const pool = poolForWithRiammesso(citta, catalogVuoto);
      expect(pool.some((c) => c.famiglia.id === "attraversamento")).toBe(true);
    } finally {
      vi.doUnmock("../../src/config.js");
      vi.resetModules();
    }
  });
});
