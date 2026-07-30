// Protegge profiles.js: la fusione fra default del codice e override di
// tuning salvato in KV. Il caso critico documentato nel modulo stesso è la
// guardia maxDeriva/maxDegrado che può vivere sull'oggetto famiglia di primo
// livello (fuori da `profilo`) invece che dentro: raccoglierla dal posto
// sbagliato la fa tornare silenziosamente alla guardia globale invece che
// alla sua — è un bug reale già successo (vedi commento in famBase()).
import { describe, it, expect } from "vitest";
import { resolveProfilo, defaultProfiles, effectiveProfiles, loadTuning } from "../../src/profiles.js";
import { FAMILIES } from "../../src/families.js";

// Famiglia fittizia con la stessa forma di catalog.concepts (vedi catalog.js
// saveConcept): maxDeriva/maxDegrado di PRIMO LIVELLO, non dentro `profilo`
// — esattamente il caso che famBase() deve raccogliere correttamente.
function famigliaFittizia(overrides = {}) {
  return {
    id: "fam-test",
    nome: "Famiglia Test",
    conserva: "niente",
    tappe: [],
    extra: [],
    profilo: { estensione: [10, 50], intensita: [5, 40], compattezza: [0.2, 0.8], monotona: true },
    maxDeriva: 9,
    maxDegrado: null,
    ...overrides,
  };
}

function catalogConFamiglia(famiglia) {
  return { concepts: { [famiglia.id]: famiglia }, elements: {} };
}

function fakeEnv(tuningDoc) {
  return { KV: { get: async () => tuningDoc } };
}

describe("resolveProfilo", () => {
  it("senza override torna il default della famiglia, raccogliendo maxDeriva dal primo livello", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, {});
    expect(p.estensione).toEqual([10, 50]);
    expect(p.intensita).toEqual([5, 40]);
    expect(p.compattezza).toEqual([0.2, 0.8]);
    expect(p.monotona).toBe(true);
    expect(p.maxDeriva).toBe(9); // dal campo di primo livello, non da profilo.maxDeriva (assente)
    expect(p.maxDegrado).toBeNull();
  });

  it("con tuning assente per quella famiglia (tuning undefined) si comporta come nessun override", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, undefined);
    expect(p.maxDeriva).toBe(9);
  });

  it("fonde un override parziale: i campi non specificati restano al default", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": { estensione: [20, 60] } });
    expect(p.estensione).toEqual([20, 60]);
    expect(p.intensita).toEqual([5, 40]); // invariato
    expect(p.monotona).toBe(true); // invariato
  });

  it("normalizza un range invertito nell'override (min>max)", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": { estensione: [60, 20] } });
    expect(p.estensione).toEqual([20, 60]);
  });

  it("un override con maxDeriva:null torna esplicitamente alla guardia globale (undefined)", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": { maxDeriva: null } });
    expect(p.maxDeriva).toBeUndefined();
  });

  it("un override con maxDegrado numerico sovrascrive il default", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": { maxDegrado: 15 } });
    expect(p.maxDegrado).toBe(15);
  });

  it("un override con monotona booleano sovrascrive il default", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": { monotona: false } });
    expect(p.monotona).toBe(false);
  });

  it("ignora campi malformati nell'override (tipo sbagliato) e tiene il default", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": { estensione: "10-20", intensita: [1, 2, 3] } });
    expect(p.estensione).toEqual([10, 50]);
    expect(p.intensita).toEqual([5, 40]);
  });

  it("un override non-oggetto (es. null) viene ignorato: torna il default puro", () => {
    const fam = famigliaFittizia();
    const p = resolveProfilo(fam, { "fam-test": null });
    expect(p).toEqual({
      estensione: [10, 50],
      intensita: [5, 40],
      compattezza: [0.2, 0.8],
      monotona: true,
      maxDeriva: 9,
      maxDegrado: null,
    });
  });
});

describe("defaultProfiles", () => {
  it("senza catalogo copre esattamente le famiglie built-in di FAMILIES", () => {
    const out = defaultProfiles();
    expect(Object.keys(out).sort()).toEqual(Object.keys(FAMILIES).sort());
  });

  it("regressione sul caso reale che ha ispirato il bug: metamorfosi ha maxDeriva 9 (di primo livello nel codice)", () => {
    // FAMILIES.metamorfosi.maxDeriva vive fuori da `profilo` (vedi families.js):
    // se famBase() lo cercasse solo dentro profilo tornerebbe alla guardia
    // globale 3.5 invece della sua 9. Questo è esattamente il caso di
    // produzione, non solo la fixture sintetica sopra.
    const out = defaultProfiles();
    expect(out.metamorfosi.maxDeriva).toBe(9);
  });

  it("con un catalogo include anche i concept custom, accanto ai built-in", () => {
    const fam = famigliaFittizia();
    const out = defaultProfiles(catalogConFamiglia(fam));
    expect(out["fam-test"]).toBeDefined();
    expect(out["fam-test"].nome).toBe("Famiglia Test");
    expect(out["fam-test"].maxDeriva).toBe(9);
    // I built-in restano tutti presenti: il catalogo si aggiunge, non sostituisce.
    expect(Object.keys(out)).toEqual(expect.arrayContaining(Object.keys(FAMILIES)));
  });
});

describe("loadTuning", () => {
  it("torna la mappa dei profili quando KV contiene un documento valido", async () => {
    const env = fakeEnv({ version: 1, profili: { natura: { estensione: [1, 2] } } });
    const tuning = await loadTuning(env);
    expect(tuning).toEqual({ natura: { estensione: [1, 2] } });
  });

  it("torna {} quando KV non ha nulla salvato (null)", async () => {
    const tuning = await loadTuning(fakeEnv(null));
    expect(tuning).toEqual({});
  });

  it("torna {} quando il documento non ha il campo 'profili'", async () => {
    const tuning = await loadTuning(fakeEnv({ version: 1 }));
    expect(tuning).toEqual({});
  });

  it("torna {} senza lanciare quando KV.get rifiuta (JSON corrotto)", async () => {
    const env = { KV: { get: async () => { throw new Error("KV illeggibile"); } } };
    const tuning = await loadTuning(env);
    expect(tuning).toEqual({});
  });
});

describe("effectiveProfiles", () => {
  it("senza tuning salvato, torna i default con overridden:false ovunque", async () => {
    const out = await effectiveProfiles(fakeEnv(null));
    expect(out.metamorfosi.maxDeriva).toBe(9);
    expect(out.metamorfosi.overridden).toBe(false);
    expect(Object.values(out).every((p) => p.overridden === false)).toBe(true);
  });

  it("applica l'override di tuning solo alla famiglia interessata, marcandola overridden:true", async () => {
    const env = fakeEnv({ profili: { crescita: { estensione: [1, 2], monotona: false } } });
    const out = await effectiveProfiles(env);
    expect(out.crescita.estensione).toEqual([1, 2]);
    expect(out.crescita.monotona).toBe(false);
    expect(out.crescita.overridden).toBe(true);
    // Le altre famiglie non sono toccate.
    expect(out.costruzione.overridden).toBe(false);
  });

  it("con un catalogo, la famiglia custom compare accanto alle built-in con overridden coerente", async () => {
    const fam = famigliaFittizia();
    const env = fakeEnv({ profili: { "fam-test": { monotona: false } } });
    const out = await effectiveProfiles(env, catalogConFamiglia(fam));
    expect(out["fam-test"].monotona).toBe(false);
    expect(out["fam-test"].overridden).toBe(true);
  });
});
