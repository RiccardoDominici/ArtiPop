// Protegge la previsione dell'apertura d'arco e il concept preferito, i due
// punti d'aggancio con cui il chiamante può far nascere un arco su un concept
// apposta inventato (invece che pescato dalla libreria).
//
// Il problema che previene: se serveConceptNuovo disdice il comportamento
// reale di evolveStory, l'invenzione del concept avviene nei giorni sbagliati
// (spesa a vuoto) o mai (l'arco si apre senza concept nuovo); se pickConcept
// ignorasse il preferito, l'intera invenzione sarebbe un costo pagato e un
// risultato che non compare mai. Qui si legano insieme previsione e fatto, e
// si garantisce che il preferito valga solo quando sta davvero nel pool del
// flusso — mai come una via d'accesso a concept che il flusso non saprebbe
// mostrare.
//
// Stile della casa: nessun mock di modulo — catalogo fittizio passato come
// ARGOMENTO (come in story.test.js) e date fisse come argomento, quindi zero
// dipendenza dall'orologio di sistema.
import { describe, it, expect } from "vitest";
import { serveConceptNuovo, pickConcept, evolveStory } from "../../src/story.js";
import { CONFIG } from "../../src/config.js";

const ULTIMA_TAPPA = CONFIG.ARC_LENGTH_DAYS - 1; // 6: indice dell'ultima tappa

/* ===================== CATALOGO FITTIZIO IN MEMORIA =====================
   Stessa forma minima usata in story.test.js: un flusso con `famiglie: []`
   (quindi nessun built-in nel pool) e `n` element custom pubblicati su di
   esso — il pool è interamente sotto controllo del test. */

function famigliaFittizia() {
  return {
    id: "fam-test",
    nome: "Famiglia Test",
    conserva: "niente",
    // Esattamente CONFIG.ARC_LENGTH_DAYS tappe, come richiede catalog.js.
    tappe: Array.from({ length: CONFIG.ARC_LENGTH_DAYS }, (_, i) => [`tappa ${i}`]),
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

/** Flusso + catalogo fittizi con `n` concept fra cui pescare, tutti sul flusso "fake-channel". */
function setupFittizio(n) {
  const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)); // "a","b","c",...
  const catalog = {
    concepts: { "fam-test": famigliaFittizia() },
    elements: Object.fromEntries(ids.map((id) => [id, elementoFittizio(id, "fake-channel")])),
  };
  const channel = { id: "fake-channel", famiglie: [] };
  return { channel, catalog, ids };
}

describe("serveConceptNuovo", () => {
  it("primo giorno in assoluto (stato assente o senza conceptId): true", () => {
    const { catalog } = setupFittizio(3);
    expect(serveConceptNuovo(null, "2026-07-01", catalog)).toBe(true);
    expect(serveConceptNuovo({}, "2026-07-01", catalog)).toBe(true);
    // Uno stato senza conceptId è equivalente a nessuno stato: apre comunque un arco.
    expect(serveConceptNuovo({ usati: ["a"] }, "2026-07-01", catalog)).toBe(true);
  });

  it("stessa data già salvata (elapsed 0): false — rigenerare con ?force=1 non apre archi né fa inventare nulla", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    expect(serveConceptNuovo(s1, "2026-07-01", catalog)).toBe(false);
    // Vale anche a metà arco: la data comanda, non il punto raggiunto.
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);
    expect(serveConceptNuovo(s2, "2026-07-02", catalog)).toBe(false);
  });

  it("rollover settimanale (l'arco raggiunge o supera i suoi giorni): true", () => {
    const { channel, catalog } = setupFittizio(3);
    // Sette giorni di arco: lo stato è alla vigilia del cambio mondo (dayInArc 6).
    let stato = null;
    for (let g = 1; g <= CONFIG.ARC_LENGTH_DAYS; g++) {
      stato = evolveStory(channel, stato, `2026-07-0${g}`, null, catalog);
    }
    expect(stato.dayInArc).toBe(ULTIMA_TAPPA);
    expect(serveConceptNuovo(stato, "2026-07-08", catalog)).toBe(true);
    // Anche quando il cron ha saltato giorni e l'arco è stato SUPERATO, non solo raggiunto.
    expect(serveConceptNuovo(stato, "2026-07-20", catalog)).toBe(true);
  });

  it("concept orfano (l'id nello stato non risolve più nel catalogo): true", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const orfano = { ...s1, conceptId: "id-mai-esistito-nel-catalogo" };
    expect(serveConceptNuovo(orfano, "2026-07-02", catalog)).toBe(true);
  });

  it("giorno normale di un arco in corso (concept vivo, data avanzata, arco non concluso): false", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", null, catalog);
    expect(serveConceptNuovo(s2, "2026-07-03", catalog)).toBe(false);
  });

  it("non lancia mai, nemmeno con input corrotti: risponde sempre un booleano", () => {
    const { catalog } = setupFittizio(3);
    const statiCorrotti = [
      null,
      {},
      { conceptId: "qualunque" }, // senza dayNumber: si ripiega su "un giorno solo"
      { conceptId: "qualunque", dayNumber: "abc" }, // campo di tipo sbagliato
      { conceptId: "qualunque", dayNumber: NaN, dayInArc: "7" },
      "una stringa invece di uno stato",
    ];
    for (const stato of statiCorrotti) {
      let esito;
      expect(() => {
        esito = serveConceptNuovo(stato, "data-che-non-e-una-data", catalog);
      }).not.toThrow();
      expect(typeof esito).toBe("boolean");
    }
  });
});

describe("coerenza fra serveConceptNuovo ed evolveStory", () => {
  it("per una manciata di stati diversi: la previsione è true se e solo se lo stato risultante apre l'arco (dayInArc 0 e stage 0)", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", null, catalog); // giorno 2 dell'arco
    // Alla vigilia del rollover: sette giorni di arco, dayInArc 6.
    let vigilia = null;
    for (let g = 1; g <= CONFIG.ARC_LENGTH_DAYS; g++) {
      vigilia = evolveStory(channel, vigilia, `2026-07-0${g}`, null, catalog);
    }
    // Lo stato già scritto oggi: una sua rigenerazione non apre nulla.
    const giaScritto = evolveStory(channel, s2, "2026-07-03", null, catalog);

    const casi = [
      ["primo giorno in assoluto", null, "2026-07-03"],
      ["stato senza conceptId", {}, "2026-07-03"],
      ["giorno 2 di un arco vivo", s2, "2026-07-03"],
      ["vigilia del rollover", vigilia, "2026-07-08"],
      ["concept orfano", { ...s2, conceptId: "id-mai-esistito-nel-catalogo" }, "2026-07-03"],
      ["stessa data già salvata", giaScritto, "2026-07-03"],
    ];
    for (const [nome, stato, data] of casi) {
      const previsione = serveConceptNuovo(stato, data, catalog);
      const risultato = evolveStory(channel, stato, data, null, catalog);
      expect(previsione, nome).toBe(risultato.dayInArc === 0 && risultato.stage === 0);
    }
  });
});

describe("pickConcept con preferito", () => {
  it("preferito presente nel pool: è lui il concept scelto, e `usati` si aggiorna con la regola di sempre", () => {
    const { channel, catalog } = setupFittizio(3);
    const { concept, usati } = pickConcept(channel, null, 0, catalog, "b");
    expect(concept.id).toBe("b");
    expect(usati).toEqual(["b"]);
  });

  it("preferito presente nel pool anche se già usato di recente: vale comunque, è una richiesta esplicita per quest'arco", () => {
    const { channel, catalog } = setupFittizio(3);
    const { concept, usati } = pickConcept(channel, { usati: ["b", "a"] }, 0, catalog, "b");
    expect(concept.id).toBe("b");
    // Stessa regola di sempre: il vistato esce dalla finestra e rientra in coda.
    expect(usati).toEqual(["a", "b"]);
  });

  it("preferito NON presente nel pool: stesso identico risultato della chiamata senza il parametro", () => {
    const { channel, catalog } = setupFittizio(3);
    const senza = pickConcept(channel, { usati: ["a"] }, 5, catalog);
    const con = pickConcept(channel, { usati: ["a"] }, 5, catalog, "id-inventato-inesistente");
    expect(con.concept.id).toBe(senza.concept.id);
    expect(con.usati).toEqual(senza.usati);
  });

  it("preferito non-stringa (null, il default): ignorato, pesca normale come sempre", () => {
    const { channel, catalog } = setupFittizio(3);
    const senza = pickConcept(channel, null, 2, catalog);
    const con = pickConcept(channel, null, 2, catalog, null);
    expect(con.concept.id).toBe(senza.concept.id);
    expect(con.usati).toEqual(senza.usati);
  });
});

describe("evolveStory con preferito", () => {
  it("al rollover l'arco nuovo si apre sul concept preferito, con lo stesso stato pulito di sempre", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const rollover = evolveStory(channel, s1, "2026-07-08", null, catalog, "c");
    expect(rollover.conceptId).toBe("c");
    expect(rollover.dayInArc).toBe(0);
    expect(rollover.stage).toBe(0);
    expect(rollover.arcIndex).toBe(s1.arcIndex + 1);
    expect(rollover.prevDate).toBeNull(); // niente riferimento a "ieri": è un mondo nuovo
    // `usati` cresce con la regola di sempre: il preferito entra in coda.
    expect(rollover.usati[rollover.usati.length - 1]).toBe("c");
    expect(rollover.usati).toContain(s1.conceptId);
  });

  it("anche nel primo giorno in assoluto il preferito è onorato: l'apertura è la stessa cosa", () => {
    const { channel, catalog } = setupFittizio(3);
    const primo = evolveStory(channel, null, "2026-07-01", null, catalog, "b");
    expect(primo.conceptId).toBe("b");
    expect(primo.arcIndex).toBe(0);
    expect(primo.dayInArc).toBe(0);
    expect(primo.stage).toBe(0);
  });

  it("nella rigenerazione della stessa data il preferito è ignorato: non si apre nessun arco", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);
    const rigen = evolveStory(channel, s2, "2026-07-02", "poco", catalog, "c");
    expect(rigen.conceptId).toBe(s2.conceptId); // stessa storia, non un arco nuovo
    expect(rigen.dayInArc).toBe(s2.dayInArc);
    expect(rigen.stage).toBe(s2.stage);
    expect(rigen.dosePartenza).toBe(1); // solo la dose risente dell'esito "poco"
  });
});
