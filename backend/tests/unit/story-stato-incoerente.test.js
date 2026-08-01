// Protegge evolveStory contro uno stato KV leggibile (JSON valido) ma con
// campi di tipo sbagliato (es. `dayNumber:"abc"`, `stage:{}`): prima di
// questa difesa un campo del genere faceva crashare il flusso con "base is
// not iterable" e teneva il canale fermo per sempre, perché lo stato rotto
// non veniva mai riscritto. Qui si verifica solo il comportamento sui campi
// corrotti: la copertura dei percorsi validi resta in story.test.js e non va
// duplicata.
import { describe, it, expect } from "vitest";
import { evolveStory } from "../../src/story.js";
import { CONFIG } from "../../src/config.js";

const ULTIMA_TAPPA = CONFIG.ARC_LENGTH_DAYS - 1; // 6

/* ===================== CATALOGO FITTIZIO IN MEMORIA =====================
   Stessa forma minima usata in story.test.js: un solo concept custom con
   ARC_LENGTH_DAYS tappe, così l'arco può essere portato fino alla tappa
   finale senza dipendere dai concept reali di produzione. */
function famigliaFittizia() {
  return {
    id: "fam-test",
    nome: "Famiglia Test",
    conserva: "niente",
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

function setupFittizio(n) {
  const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
  const catalog = {
    concepts: { "fam-test": famigliaFittizia() },
    elements: Object.fromEntries(ids.map((id) => [id, elementoFittizio(id, "fake-channel")])),
  };
  const channel = { id: "fake-channel", famiglie: [] };
  return { channel, catalog };
}

describe("evolveStory con stato incoerente (campi di tipo sbagliato)", () => {
  it.each([["abc"], [NaN], [1.5]])("dayNumber non intero (%p): non lancia e produce dayInArc/stage interi", (v) => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const corrotto = { ...s1, dayNumber: v };

    expect(() => evolveStory(channel, corrotto, "2026-07-02", "ok", catalog)).not.toThrow();
    const s2 = evolveStory(channel, corrotto, "2026-07-02", "ok", catalog);
    expect(Number.isInteger(s2.dayInArc)).toBe(true);
    expect(Number.isInteger(s2.stage)).toBe(true);
  });

  it.each([["x"], [{}]])("stage non intero (%p): non lancia e la scena resta una stringa non vuota", (v) => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);
    const corrotto = { ...s2, stage: v };

    expect(() => evolveStory(channel, corrotto, "2026-07-03", "ok", catalog)).not.toThrow();
    const s3 = evolveStory(channel, corrotto, "2026-07-03", "ok", catalog);
    expect(Number.isInteger(s3.stage)).toBe(true);
    expect(typeof s3.scene).toBe("string");
    expect(s3.scene.length).toBeGreaterThan(0);
  });

  it("dayInArc non intero (\"2\"): non provoca il rollover d'arco spurio, il concept resta quello di ieri", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);
    const corrotto = { ...s2, dayInArc: "2" };

    const s3 = evolveStory(channel, corrotto, "2026-07-03", "ok", catalog);
    expect(Number.isInteger(s3.arcIndex)).toBe(true);
    expect(s3.arcIndex).toBe(s2.arcIndex); // nessun rollover spurio
    expect(s3.conceptId).toBe(s2.conceptId); // stesso arco di ieri, non uno nuovo
  });

  it("arcIndex non intero: il rollover a fine arco produce comunque uno stato con arcIndex intero", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const corrotto = { ...s1, arcIndex: "abc" };

    const rollover = evolveStory(channel, corrotto, "2026-07-08", null, catalog); // +7 giorni: rollover
    expect(rollover.dayInArc).toBe(0);
    expect(Number.isInteger(rollover.arcIndex)).toBe(true);
    expect(rollover.arcIndex).toBe(1); // ripiego 0 (campo corrotto) + 1
  });

  it("extraIndex non intero su un arco a tappa finale bloccata: l'extraIndex risultante è un intero >= 0", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    // Stato costruito a mano: già alla tappa finale (stage = ultimaTappa),
    // un giorno prima del rollover (dayInArc 5 + elapsed 1 = 6 < 7), con
    // extraIndex corrotto.
    const bloccato = {
      ...s1,
      dayInArc: ULTIMA_TAPPA - 1,
      stage: ULTIMA_TAPPA,
      arcIndex: 0,
      extraIndex: "z",
    };

    const s2 = evolveStory(channel, bloccato, "2026-07-02", null, catalog);
    expect(s2.stage).toBe(ULTIMA_TAPPA);
    expect(Number.isInteger(s2.extraIndex)).toBe(true);
    expect(s2.extraIndex).toBeGreaterThanOrEqual(0);
  });
});
