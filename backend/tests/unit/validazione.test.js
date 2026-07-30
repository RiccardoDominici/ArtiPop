// Protegge validazione.js: l'unica fonte di verità per i limiti dei range e
// per le guardie booleane/scalari, condivisa da catalog.js, profiles.js e
// note.js. Un limite cambiato per errore qui romperebbe silenziosamente tutte
// e tre le superfici che lo importano.
import { describe, it, expect } from "vitest";
import {
  LIMITI_RANGE,
  validaRangeProfilo,
  validaMonotona,
  validaScalareONull,
} from "../../src/validazione.js";

describe("LIMITI_RANGE", () => {
  it("espone i tre limiti attesi: unica fonte di verità dei range", () => {
    // Fissiamo la forma esatta: se qualcuno la cambia (aggiunge/toglie un
    // campo, sposta i limiti) tutti i moduli che ne dipendono devono saperlo.
    expect(LIMITI_RANGE).toEqual({
      estensione: [0, 100],
      intensita: [0, 100],
      compattezza: [0, 1],
    });
  });
});

describe("validaRangeProfilo", () => {
  it("accetta un profilo valido e non scrive errori", () => {
    const errori = [];
    const out = validaRangeProfilo(
      { estensione: [10, 20], intensita: [5, 15], compattezza: [0.2, 0.5] },
      "profilo",
      errori
    );
    expect(out).toEqual({ estensione: [10, 20], intensita: [5, 15], compattezza: [0.2, 0.5] });
    expect(errori).toEqual([]);
  });

  it("normalizza min/max invertiti invece di respingerli", () => {
    const errori = [];
    const out = validaRangeProfilo({ estensione: [20, 10], intensita: [5, 15], compattezza: [0.5, 0.2] }, "profilo", errori);
    expect(out.estensione).toEqual([10, 20]);
    expect(out.compattezza).toEqual([0.2, 0.5]);
    expect(errori).toEqual([]);
  });

  it("respinge un campo fuori dai limiti assoluti, col prefisso nel messaggio", () => {
    const errori = [];
    const out = validaRangeProfilo({ estensione: [-5, 50], intensita: [5, 15], compattezza: [0.2, 0.5] }, "profili.natura", errori);
    // Il campo fuori limite non finisce nell'output...
    expect(out.estensione).toBeUndefined();
    // ...ma gli altri due, validi, sì: un campo malformato non deve bloccare gli altri.
    expect(out.intensita).toEqual([5, 15]);
    expect(errori).toEqual(["profili.natura.estensione: fuori dai limiti [0, 100]"]);
  });

  it("respinge compattezza fuori dal suo limite specifico [0,1]", () => {
    const errori = [];
    const out = validaRangeProfilo({ estensione: [10, 20], intensita: [5, 15], compattezza: [0, 1.5] }, "profilo", errori);
    expect(out.compattezza).toBeUndefined();
    expect(errori).toEqual(["profilo.compattezza: fuori dai limiti [0, 1]"]);
  });

  it("respinge un campo non-array con messaggio 'servono [min, max] numerici'", () => {
    const errori = [];
    const out = validaRangeProfilo({ estensione: "10-20", intensita: [5, 15], compattezza: [0.2, 0.5] }, "profilo", errori);
    expect(out.estensione).toBeUndefined();
    expect(errori).toEqual(["profilo.estensione: servono [min, max] numerici"]);
  });

  it("respinge un array di lunghezza diversa da 2", () => {
    const errori = [];
    const out = validaRangeProfilo({ estensione: [10], intensita: [5, 15], compattezza: [0.2, 0.5] }, "profilo", errori);
    expect(out.estensione).toBeUndefined();
    expect(errori).toEqual(["profilo.estensione: servono [min, max] numerici"]);
  });

  it("respinge un array con valori non numerici o non finiti (es. NaN)", () => {
    const errori = [];
    const out = validaRangeProfilo({ estensione: [10, NaN], intensita: [5, 15], compattezza: [0.2, 0.5] }, "profilo", errori);
    expect(out.estensione).toBeUndefined();
    expect(errori).toEqual(["profilo.estensione: servono [min, max] numerici"]);
  });

  it("gestisce un input completamente malformato (null/undefined) senza lanciare", () => {
    const errori = [];
    const out = validaRangeProfilo(null, "profilo", errori);
    expect(out).toEqual({});
    expect(errori).toHaveLength(3); // uno per ciascuno dei tre campi
  });
});

describe("validaMonotona", () => {
  it("accetta true e false, senza scrivere errori", () => {
    const errori = [];
    expect(validaMonotona({ monotona: true }, "profilo", errori)).toBe(true);
    expect(validaMonotona({ monotona: false }, "profilo", errori)).toBe(false);
    expect(errori).toEqual([]);
  });

  it("respinge una stringa 'false': niente Boolean() che la coercerebbe a true", () => {
    const errori = [];
    const out = validaMonotona({ monotona: "false" }, "profilo", errori);
    expect(out).toBeUndefined();
    expect(errori).toEqual([
      'profilo.monotona: deve essere un booleano (true/false), non "false"',
    ]);
  });

  it("respinge un campo assente, col prefisso nel messaggio", () => {
    const errori = [];
    const out = validaMonotona({}, "profili.citta", errori);
    expect(out).toBeUndefined();
    expect(errori).toEqual([
      "profili.citta.monotona: deve essere un booleano (true/false), non undefined",
    ]);
  });
});

describe("validaScalareONull", () => {
  it("accetta null e undefined come 'torna alla guardia globale'", () => {
    const errori = [];
    expect(validaScalareONull(null, "maxDeriva", errori)).toBeNull();
    expect(validaScalareONull(undefined, "maxDeriva", errori)).toBeNull();
    expect(errori).toEqual([]);
  });

  it("accetta un numero finito e lo restituisce invariato", () => {
    const errori = [];
    expect(validaScalareONull(9, "maxDeriva", errori)).toBe(9);
    expect(errori).toEqual([]);
  });

  it("respinge NaN e Infinity, tornando null e segnalando l'errore", () => {
    const errori = [];
    expect(validaScalareONull(NaN, "maxDeriva", errori)).toBeNull();
    expect(validaScalareONull(Infinity, "maxDegrado", errori)).toBeNull();
    expect(errori).toEqual([
      "maxDeriva: deve essere un numero oppure null",
      "maxDegrado: deve essere un numero oppure null",
    ]);
  });

  it("respinge una stringa numerica: nessuna coercizione implicita", () => {
    const errori = [];
    const out = validaScalareONull("9", "maxDeriva", errori);
    expect(out).toBeNull();
    expect(errori).toEqual(["maxDeriva: deve essere un numero oppure null"]);
  });
});
