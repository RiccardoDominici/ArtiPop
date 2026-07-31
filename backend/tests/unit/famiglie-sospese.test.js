// Protegge il MECCANISMO di sospensione introdotto da M9 (FAMIGLIE_SOSPESE in
// config.js + filtro in poolForWith, catalog.js): una famiglia elencata lì
// sparisce dalla pesca CASUALE di un concept nuovo, senza toccare un arco già
// aperto né l'accesso esplicito per id (combine()/resolveConcept()), che è la
// via con cui /lab/arc e /catalogo lavorano.
//
// M10 (2026-07-31) ha tarato `attraversamento` via lab su preview (vedi
// families.js e il commento su FAMIGLIE_SOSPESE in config.js per i numeri) e
// l'ha rimossa dalla lista: la lista reale in produzione è ORA VUOTA. Questa
// suite continua a proteggere il MECCANISMO — non più osservabile sui dati
// reali, quindi i blocchi (a) e (b) lo esercitano con FAMIGLIE_SOSPESE
// mockata di nuovo a `["attraversamento"]` — e in più collauda il RISULTATO
// concreto della riammissione nel blocco (d): con la lista reale (vuota), la
// pesca su 'città' include di nuovo concept attraversamento.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
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
  it("M10: non sospende più nessuna famiglia — lista vuota (precondizione degli altri test di questa suite)", () => {
    expect(FAMIGLIE_SOSPESE).toEqual([]);
  });
});

describe("(a)+(b) MECCANISMO — se 'attraversamento' fosse di nuovo in FAMIGLIE_SOSPESE, la pesca la escluderebbe ovunque", () => {
  // La lista reale è vuota dopo M10: qui si mocka una sospensione per
  // continuare a collaudare il FILTRO in sé (poolForWith/pickConcept),
  // indipendentemente da cosa contenga la lista in produzione oggi.
  let poolForWithSospeso, pickConceptSospeso, canaliSospesi;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../src/config.js", async () => {
      const vero = await vi.importActual("../../src/config.js");
      return { ...vero, FAMIGLIE_SOSPESE: ["attraversamento"] }; // simula una nuova sospensione
    });
    ({ poolForWith: poolForWithSospeso } = await import("../../src/catalog.js"));
    ({ pickConcept: pickConceptSospeso } = await import("../../src/story.js"));
    ({ ACTIVE_CHANNELS: canaliSospesi } = await import("../../src/channels.js"));
  });

  afterAll(() => {
    vi.doUnmock("../../src/config.js");
    vi.resetModules();
  });

  describe("(a) nessun canale attivo ha concept di famiglia attraversamento nel pool pescabile", () => {
    it.each(ACTIVE_CHANNELS.map((c) => c.id))("flusso '%s': poolForWith non contiene concept attraversamento", (id) => {
      const channel = canaliSospesi.find((c) => c.id === id);
      const pool = poolForWithSospeso(channel, catalogVuoto);
      expect(pool.length).toBeGreaterThan(0); // precondizione: il pool non è vuoto per un altro motivo
      const sospesi = pool.filter((c) => c.famiglia.id === "attraversamento");
      expect(sospesi).toEqual([]);
    });

    it("il flusso 'città' (indole timelapse + attraversamento) perde SOLO i concept attraversamento, non quelli timelapse", () => {
      const citta = canaliSospesi.find((c) => c.famiglie.includes("attraversamento"));
      expect(citta).toBeDefined(); // precondizione: esiste un flusso della giusta indole
      const pool = poolForWithSospeso(citta, catalogVuoto);
      expect(pool.every((c) => c.famiglia.id === "timelapse")).toBe(true);
      expect(pool.some((c) => c.famiglia.id === "timelapse")).toBe(true);
    });
  });

  describe("(b) pickConcept non può mai restituire un concept attraversamento", () => {
    it("su un catalog reale (vuoto di custom), molte pescate consecutive sul flusso 'città' non pescano mai attraversamento", () => {
      const citta = canaliSospesi.find((c) => c.famiglie.includes("attraversamento"));
      let state = null;
      for (let arcIndex = 0; arcIndex < 60; arcIndex++) {
        const { concept, usati } = pickConceptSospeso(citta, state, arcIndex, catalogVuoto);
        expect(concept.famiglia.id).not.toBe("attraversamento");
        state = { usati };
      }
    });

    it("stesso collaudo su TUTTI i flussi attivi, non solo 'città'", () => {
      for (const channel of canaliSospesi) {
        let state = null;
        for (let arcIndex = 0; arcIndex < 15; arcIndex++) {
          const { concept, usati } = pickConceptSospeso(channel, state, arcIndex, catalogVuoto);
          expect(concept.famiglia.id).not.toBe("attraversamento");
          state = { usati };
        }
      }
    });
  });
});

describe("(c) un arco attraversamento già in corso non si rompe, anche se la famiglia tornasse sospesa", () => {
  it("resolveConcept di un concept built-in attraversamento (es. 'veliero') resta pienamente risolvibile", () => {
    const concept = resolveConcept("veliero", catalogVuoto);
    expect(concept).toBeDefined();
    expect(concept.famiglia.id).toBe("attraversamento");
    expect(concept.tappe.length).toBe(7);
    // getConcept (concepts.js, letto direttamente da evolveStory in alcuni
    // rami di ripiego) è ugualmente non filtrato: stessa garanzia.
    expect(getConcept("veliero")).toBeDefined();
  });

  it("evolveStory su uno stato che punta a metà arco di un concept attraversamento continua lo STESSO arco, anche con 'attraversamento' mockata come sospesa", async () => {
    vi.resetModules();
    vi.doMock("../../src/config.js", async () => {
      const vero = await vi.importActual("../../src/config.js");
      return { ...vero, FAMIGLIE_SOSPESE: ["attraversamento"] };
    });

    try {
      const { evolveStory: evolveStorySospeso } = await import("../../src/story.js");
      const { ACTIVE_CHANNELS: canaliSospesi } = await import("../../src/channels.js");
      const citta = canaliSospesi.find((c) => c.famiglie.includes("attraversamento"));
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
      const domani = evolveStorySospeso(citta, statoAMano, "2026-07-02", "ok", catalogVuoto);
      // Stesso arco (non è stato interrotto né sostituito da un rollover): la
      // sospensione della famiglia, reale o mockata, non tocca un arco già aperto.
      expect(domani.conceptId).toBe("veliero");
      expect(domani.arcIndex).toBe(3);
      expect(domani.dayInArc).toBe(3);
    } finally {
      vi.doUnmock("../../src/config.js");
      vi.resetModules();
    }
  });
});

describe("(d) risultato della riammissione M10: col config REALE (lista vuota), 'attraversamento' torna pescabile", () => {
  it("il flusso 'città' include di nuovo concept attraversamento nel pool pescabile, insieme a quelli timelapse", () => {
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    expect(citta).toBeDefined(); // precondizione: esiste un flusso della giusta indole
    const pool = poolForWith(citta, catalogVuoto);
    expect(pool.some((c) => c.famiglia.id === "attraversamento")).toBe(true);
    expect(pool.some((c) => c.famiglia.id === "timelapse")).toBe(true);
  });

  it("pickConcept PUÒ restituire un concept attraversamento sul flusso 'città', su molte pescate consecutive", () => {
    const citta = ACTIVE_CHANNELS.find((c) => c.famiglie.includes("attraversamento"));
    let state = null;
    let vistoAttraversamento = false;
    for (let arcIndex = 0; arcIndex < 60; arcIndex++) {
      const { concept, usati } = pickConcept(citta, state, arcIndex, catalogVuoto);
      if (concept.famiglia.id === "attraversamento") vistoAttraversamento = true;
      state = { usati };
    }
    expect(vistoAttraversamento).toBe(true);
  });
});

describe("(e) l'accesso esplicito per id resta intatto, indipendentemente dallo stato di sospensione", () => {
  it("FAMILIES continua a esporre 'attraversamento' senza alcun filtro: è la fonte di /catalogo, il menu da cui il lab sceglie lo schema", () => {
    expect(FAMILIES.attraversamento).toBeDefined();
    expect(allFamilies(catalogVuoto).attraversamento).toBeDefined();
  });

  it("combine() con familyId='attraversamento' esplicito (coppia NATIVA, es. con 'veliero') resta pienamente funzionante — è esattamente ciò che chiama runLabArc via /lab/arc?concept=attraversamento", () => {
    const concept = combine("attraversamento", "veliero", null, catalogVuoto);
    expect(concept).toBeDefined();
    expect(concept.famiglia.id).toBe("attraversamento");
    expect(concept.tappe.length).toBe(7);
    expect(concept.virtuale).toBeFalsy(); // coppia nativa: è il concept reale, non sintetizzato
  });

  it("combine() con familyId='attraversamento' e un element di un'ALTRA famiglia (coppia LIBERA) funziona ancora: il lab può provare 'attraversamento di un girasole' per continuare a tararla in futuri cicli POLISH", () => {
    const concept = combine("attraversamento", "girasole", null, catalogVuoto);
    expect(concept).toBeDefined();
    expect(concept.famiglia.id).toBe("attraversamento");
    expect(concept.virtuale).toBe(true); // coppia libera: tappe sintetizzate al volo
    expect(concept.tappe.length).toBe(7);
    expect(concept.s).toBe("the sunflower"); // soggetto di girasole, schema di attraversamento
  });

  it("resolveConcept('veliero') resta risolvibile per id esplicito con un profilo di taratura passato dal lab (rangeOverride via combine)", () => {
    // Simula ciò che fa runLabArc: legge il profilo effettivo (qui a mano,
    // invece che da profiles.js/tuning) e lo passa come override a combine.
    const rangeOverride = { estensione: [1, 60], intensita: [0, 50], compattezza: [0, 1], monotona: false };
    const concept = combine("attraversamento", "veliero", rangeOverride, catalogVuoto);
    expect(concept.profilo.estensione).toEqual([1, 60]); // l'override tarato ha vinto, nessun filtro l'ha bloccato
    expect(resolveConcept("veliero", catalogVuoto).famiglia.id).toBe("attraversamento");
  });

  it("GET /catalogo (index.js) costruisce i suoi concept direttamente da FAMILIES, non da poolForWith: verificato qui perché il modulo è fuori scope, ma la lettura diretta di FAMILIES conferma che nessun filtro lo intercetta", () => {
    const idsCatalogo = Object.keys(FAMILIES);
    expect(idsCatalogo).toContain("attraversamento");
  });
});
