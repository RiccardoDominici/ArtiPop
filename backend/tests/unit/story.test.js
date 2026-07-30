// Protegge story.js: la pesca del concept settimanale (mai una ripetizione
// finché il pool non è esaurito), il ricalcolo giornaliero della tappa
// (recupero spalmato + tappa finale obbligatoria al settimo giorno) e il
// rollover d'arco che chiude una storia e ne apre una nuova.
//
// Tutte le funzioni qui sotto accettano la data/lo stato come argomento
// esplicito (dateKey, prevState, now): zero dipendenza dall'orologio di
// sistema, quindi zero bisogno di vi.setSystemTime — la suite resta
// deterministica passando semplicemente valori fissi.
import { describe, it, expect } from "vitest";
import { todayKey, pickConcept, nextStage, evolveStory } from "../../src/story.js";
import { CONFIG } from "../../src/config.js";

/* ===================== CATALOGO FITTIZIO IN MEMORIA =====================
   Un solo concept custom ("fam-test") con 3 element pubblicati sullo stesso
   flusso fittizio. Il flusso ha `famiglie: []`, quindi conceptsForFamilies([])
   non pesca NULLA dalla libreria built-in (verificato in concepts.js): il
   pool è composto SOLO dai 3 element custom, pienamente sotto controllo del
   test — nessuna dipendenza dai concept reali di produzione. */

const ULTIMA_TAPPA = CONFIG.ARC_LENGTH_DAYS - 1; // 6: indice dell'ultima tappa

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

describe("todayKey", () => {
  it("usa il fuso Europe/Rome, non UTC: un orario dopo mezzanotte locale cade sul giorno successivo", () => {
    // 22:30 UTC di metà luglio + 2h (CEST, ora legale) = 00:30 locale del
    // giorno dopo: se todayKey usasse UTC invece del fuso configurato,
    // tornerebbe ancora "15".
    const now = new Date("2026-07-15T22:30:00Z");
    expect(todayKey(now)).toBe("2026-07-16");
  });

  it("formatta come YYYY-MM-DD anche fuori dall'ora legale (gennaio, CET = UTC+1)", () => {
    const now = new Date("2026-01-05T10:00:00Z");
    expect(todayKey(now)).toBe("2026-01-05");
  });
});

describe("pickConcept", () => {
  it("non ripete mai un concept finché il pool non è esaurito (finestra di pool.length pescate consecutive tutte distinte)", () => {
    const { channel, catalog, ids } = setupFittizio(3);
    let state = null;
    const picks = [];
    for (let arcIndex = 0; arcIndex < 4 * ids.length; arcIndex++) {
      const { concept, usati } = pickConcept(channel, state, arcIndex, catalog);
      picks.push(concept.id);
      state = { usati };
    }
    expect(picks.every((id) => ids.includes(id))).toBe(true);
    for (let i = 0; i + ids.length <= picks.length; i++) {
      const finestra = picks.slice(i, i + ids.length);
      expect(new Set(finestra).size).toBe(ids.length); // nessuna ripetizione dentro la finestra
    }
  });

  it("con un pool di un solo concept, lo ripesca sempre (unica scelta possibile, nessun errore)", () => {
    const { channel, catalog } = setupFittizio(1);
    let state = null;
    for (let arcIndex = 0; arcIndex < 5; arcIndex++) {
      const { concept, usati } = pickConcept(channel, state, arcIndex, catalog);
      expect(concept.id).toBe("a");
      state = { usati };
    }
  });

  it("serbatoio esaurito (usati copre l'intero pool, stato ricostruito a mano): riparte escludendo solo l'ultimo visto", () => {
    const { channel, catalog } = setupFittizio(3);
    // Stato costruito a mano che non potrebbe capitare da un pickConcept
    // normale (usati contiene TUTTI e 3 gli id): copre il ramo difensivo
    // `scelti.length>0 ? scelti : pool` per uno stato salvato anomalo.
    const prevState = { usati: ["a", "b", "c"] };
    const { concept } = pickConcept(channel, prevState, 0, catalog);
    expect(concept.id).not.toBe("c"); // esclude solo l'ultimo visto ("ultimo" = usati[usati.length-1])
  });

  it("lancia un errore parlante se il flusso non ha nessun concept disponibile", () => {
    const channel = { id: "flusso-vuoto", famiglie: [] };
    const catalog = { concepts: {}, elements: {} };
    expect(() => pickConcept(channel, null, 0, catalog)).toThrow("flusso flusso-vuoto: nessun concept disponibile");
  });
});

describe("nextStage / targetStage (recupero spalmato)", () => {
  // targetStage() è privata (mai esportata, verificato con grep in story.js):
  // la si collauda passando per nextStage con esito che non altera il
  // recupero (null, "ok", "forma" prendono tutti la stessa via `return recupero`).

  it("settimo giorno: la tappa finale è sempre obbligatoria, qualunque esito o tappa di ieri", () => {
    expect(nextStage(2, ULTIMA_TAPPA, ULTIMA_TAPPA, null)).toBe(ULTIMA_TAPPA);
    expect(nextStage(0, ULTIMA_TAPPA, ULTIMA_TAPPA, "poco")).toBe(ULTIMA_TAPPA);
    expect(nextStage(5, ULTIMA_TAPPA, ULTIMA_TAPPA, "troppo")).toBe(ULTIMA_TAPPA);
    // Il cron ha saltato giorni: dayInArc supera ultimaTappa, non solo la raggiunge.
    expect(nextStage(1, ULTIMA_TAPPA + 3, ULTIMA_TAPPA, null)).toBe(ULTIMA_TAPPA);
  });

  it("il passo si ricalcola spalmando le tappe mancanti sui giorni rimasti, non è fisso a 1/giorno", () => {
    // prevStage=0, dayInArc=3, ultima=6 → giorniRimasti=4, tappeRimaste=6, passo=ceil(6/4)=2
    expect(nextStage(0, 3, ULTIMA_TAPPA, null)).toBe(2);
    // prevStage=1, dayInArc=1, ultima=6 → giorniRimasti=6, tappeRimaste=5, passo=ceil(5/6)=1
    expect(nextStage(1, 1, ULTIMA_TAPPA, null)).toBe(2);
    // già quasi arrivato: un passo minimo di 1 basta, il risultato resta clampato a ultimaTappa
    expect(nextStage(5, 3, ULTIMA_TAPPA, null)).toBe(6);
  });

  it("esito 'troppo': salta almeno due tappe rispetto a ieri (il recupero da solo non basterebbe)", () => {
    // recupero(2,3,6)=3 (vedi test sopra sullo stesso schema), ma prevStage+2=4 vince
    expect(nextStage(2, 3, ULTIMA_TAPPA, "troppo")).toBe(4);
    // clamp a ultimaTappa quando prevStage+2 lo supererebbe
    expect(nextStage(5, 1, ULTIMA_TAPPA, "troppo")).toBe(6);
  });

  it("esito 'poco': ripete la tappa SOLO se il calendario non l'ha già superata (prevStage >= dayInArc)", () => {
    expect(nextStage(3, 3, ULTIMA_TAPPA, "poco")).toBe(3); // ripete
    // prevStage(2) < dayInArc(3): la ripetizione non può incastrarsi, si
    // riparte dal recupero invece di restare bloccati.
    expect(nextStage(2, 3, ULTIMA_TAPPA, "poco")).toBe(3);
  });

  it("esito 'ok', 'forma' e null usano tutti lo stesso recupero spalmato", () => {
    expect(nextStage(0, 3, ULTIMA_TAPPA, "ok")).toBe(2);
    expect(nextStage(0, 3, ULTIMA_TAPPA, "forma")).toBe(2);
    expect(nextStage(0, 3, ULTIMA_TAPPA, null)).toBe(2);
  });
});

describe("evolveStory", () => {
  it("primo giorno assoluto (prevState nullo): apre un arco nuovo, dayInArc/stage a 0, nessuna immagine di ieri", () => {
    const { channel, catalog, ids } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    expect(s1.dayInArc).toBe(0);
    expect(s1.stage).toBe(0);
    expect(s1.arcIndex).toBe(0);
    expect(s1.prevDate).toBeNull();
    expect(s1.dosePartenza).toBe(0);
    expect(ids).toContain(s1.conceptId);
    expect(s1.usati).toEqual([s1.conceptId]);
    expect(typeof s1.scene).toBe("string");
  });

  it("uno stato senza conceptId (es. {}) è equivalente a prevState nullo: apre comunque un arco nuovo", () => {
    const { channel, catalog } = setupFittizio(3);
    const s = evolveStory(channel, {}, "2026-07-01", null, catalog);
    expect(s.dayInArc).toBe(0);
    expect(s.arcIndex).toBe(0);
  });

  it("giorno normale: la tappa avanza secondo nextStage e prevDate diventa il lastDate di ieri", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);

    expect(s2.dayNumber).toBe(s1.dayNumber + 1);
    expect(s2.dayInArc).toBe(1);
    expect(s2.conceptId).toBe(s1.conceptId); // stesso arco
    expect(s2.prevDate).toBe(s1.lastDate); // "2026-07-01"
    expect(s2.dosePartenza).toBe(0); // esito "ok"
    // Recupero spalmato atteso: nextStage(0, 1, 6, "ok") = 1 (vedi describe precedente).
    expect(s2.stage).toBe(nextStage(s1.stage, 1, ULTIMA_TAPPA, "ok"));
  });

  it("stessa data rigenerata (elapsed 0): tappa e dayInArc invariati, cambia solo la dose secondo l'esito", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);

    const rigenPoco = evolveStory(channel, s2, "2026-07-02", "poco", catalog);
    expect(rigenPoco.dayInArc).toBe(s2.dayInArc);
    expect(rigenPoco.stage).toBe(s2.stage);
    expect(rigenPoco.conceptId).toBe(s2.conceptId);
    expect(rigenPoco.dosePartenza).toBe(1);

    const rigenTroppo = evolveStory(channel, s2, "2026-07-02", "troppo", catalog);
    expect(rigenTroppo.dosePartenza).toBe(-1);

    const rigenOk = evolveStory(channel, s2, "2026-07-02", "ok", catalog);
    expect(rigenOk.dosePartenza).toBe(0);
  });

  it("non muta lo stato precedente: prevState resta un oggetto puro dopo la chiamata", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const s2 = evolveStory(channel, s1, "2026-07-02", "ok", catalog);
    const istantanea = JSON.parse(JSON.stringify(s2));

    evolveStory(channel, s2, "2026-07-03", "poco", catalog);

    expect(s2).toEqual(istantanea); // l'oggetto passato come prevState non è stato toccato
  });

  it("rollover d'arco dopo 7 giorni: pesca un concept nuovo (mai quello di prima) e riparte da un keyframe pulito", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);

    const rollover = evolveStory(channel, s1, "2026-07-08", null, catalog); // +7 giorni esatti
    expect(rollover.dayInArc).toBe(0);
    expect(rollover.stage).toBe(0);
    expect(rollover.arcIndex).toBe(s1.arcIndex + 1);
    expect(rollover.prevDate).toBeNull(); // niente riferimento a "ieri": è un mondo nuovo
    expect(rollover.conceptId).not.toBe(s1.conceptId);
  });

  it("rollover anche quando il cron ha saltato giorni e dayInArc SUPERA 7, non solo lo raggiunge", () => {
    const { channel, catalog } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const saltato = evolveStory(channel, s1, "2026-07-20", null, catalog); // ben oltre un arco
    expect(saltato.dayInArc).toBe(0);
    expect(saltato.arcIndex).toBe(s1.arcIndex + 1);
  });

  it("concept sparito dalla libreria (id orfano nello stato salvato): riparte con un arco nuovo invece di rompersi", () => {
    const { channel, catalog, ids } = setupFittizio(3);
    const s1 = evolveStory(channel, null, "2026-07-01", null, catalog);
    const statoOrfano = { ...s1, conceptId: "id-mai-esistito-nel-catalogo" };

    const recuperato = evolveStory(channel, statoOrfano, "2026-07-02", null, catalog);
    expect(recuperato.dayInArc).toBe(0);
    expect(recuperato.arcIndex).toBe(statoOrfano.arcIndex + 1);
    expect(ids).toContain(recuperato.conceptId);
  });
});
