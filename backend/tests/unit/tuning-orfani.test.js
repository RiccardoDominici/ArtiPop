// Robustezza (CLAUDE.md, principio 3): DELETE /catalogo/concept cancellava il
// concept dal catalogo ma lasciava il suo override in `tuning:profili`. Se lo
// stesso id veniva ricreato in seguito, resolveProfilo/effectiveProfiles gli
// applicavano in silenzio i range tarati per il concept vecchio — un range
// fantasma mai impostato dall'utente per il nuovo soggetto. Questo file
// esercita dropTuningProfilo (src/profiles.js) attraverso la rotta
// DELETE /catalogo/concept (src/index.js).
import { describe, it, expect } from "vitest";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

// 7 tappe (CONFIG.ARC_LENGTH_DAYS), stessa forma di admin-robuste.test.js.
function concept(id, overrides = {}) {
  return {
    id,
    nome: "Concept di prova",
    conserva: "conserva un elemento per il test di tuning orfano",
    tappe: Array.from({ length: 7 }, (_, i) => [`tappa numero ${i + 1}`]),
    extra: [],
    profilo: { estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1], monotona: false },
    maxDeriva: null,
    maxDegrado: null,
    ...overrides,
  };
}

async function putConcept(env, c) {
  const res = await callWorker(env, "/catalogo/concept", {
    method: "PUT", headers: { "x-artipop-key": env.ADMIN_KEY }, body: JSON.stringify(c),
  });
  if (res.status !== 200) throw new Error(`seed concept fallito: ${res.status}`);
}
async function putTuning(env, profili) {
  const res = await callWorker(env, "/tuning", {
    method: "PUT", headers: { "x-artipop-key": env.ADMIN_KEY }, body: JSON.stringify({ profili }),
  });
  if (res.status !== 200) throw new Error(`seed tuning fallito: ${res.status}`);
}
async function getTuning(env) {
  const res = await callWorker(env, "/tuning", { headers: { "x-artipop-key": env.ADMIN_KEY } });
  return res.json();
}
async function deleteConcept(env, id) {
  return callWorker(env, `/catalogo/concept?id=${id}`, {
    method: "DELETE", headers: { "x-artipop-key": env.ADMIN_KEY },
  });
}

describe("cancellare un concept non lascia range fantasma nel tuning", () => {
  it("id riusato dopo la cancellazione riparte dai range del NUOVO concept, non da quelli vecchi", async () => {
    const env = makeEnv();
    await putConcept(env, concept("prova", { profilo: { estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1], monotona: false } }));
    await putTuning(env, { prova: { estensione: [10, 20] } });

    const delRes = await deleteConcept(env, "prova");
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).ok).toBe(true);

    // Ricreato con lo stesso id ma range di catalogo diversi.
    await putConcept(env, concept("prova", { profilo: { estensione: [40, 60], intensita: [0, 100], compattezza: [0, 1], monotona: false } }));

    const tuning = await getTuning(env);
    expect(tuning.concepts.prova.overridden).toBe(false);
    expect(tuning.concepts.prova.estensione).toEqual([40, 60]);
  });

  it("la purga è chirurgica: l'override di un concept built-in sopravvive alla cancellazione di un altro concept", async () => {
    const env = makeEnv();
    await putConcept(env, concept("da-cancellare"));
    await putTuning(env, {
      "da-cancellare": { estensione: [10, 20] },
      crescita: { estensione: [5, 95] },
    });

    const delRes = await deleteConcept(env, "da-cancellare");
    expect(delRes.status).toBe(200);

    const tuning = await getTuning(env);
    expect(tuning.concepts.crescita.overridden).toBe(true);
    expect(tuning.concepts.crescita.estensione).toEqual([5, 95]);
  });

  it("un guasto nella scrittura di tuning:profili non trasforma una cancellazione riuscita in un 500", async () => {
    // Semina con KV sano (anche tuning:profili si scrive normalmente), poi
    // guasta la SOLA scrittura di tuning:profili per il DELETE vero e proprio
    // — altrimenti la semina stessa fallirebbe sulla stessa chiave.
    const kvSano = makeKV();
    const envSemina = makeEnv({ KV: kvSano });
    await putConcept(envSemina, concept("prova-guasto"));
    await putTuning(envSemina, { "prova-guasto": { estensione: [10, 20] } });

    const kvGuastoSuTuning = {
      ...kvSano,
      async put(key, value, opts) {
        if (key === "tuning:profili") throw new Error("KV.put su \"tuning:profili\" non disponibile (simulato)");
        return kvSano.put(key, value, opts);
      },
    };
    const env = makeEnv({ KV: kvGuastoSuTuning, ADMIN_KEY: envSemina.ADMIN_KEY });

    const delRes = await deleteConcept(env, "prova-guasto");
    expect(delRes.status).toBe(200);
    const body = await delRes.json();
    expect(body).toEqual({ ok: true, rimosso: "prova-guasto" });
    // Nessun dettaglio tecnico nella risposta.
    expect(JSON.stringify(body)).not.toMatch(/error|Error|stack/i);

    const catalogo = await callWorker(env, "/catalogo").then((r) => r.json());
    expect(catalogo.concepts.some((c) => c.id === "prova-guasto")).toBe(false);
  });

  it("cancellare un concept mai tarato non altera il documento tuning:profili", async () => {
    const env = makeEnv();
    await putConcept(env, concept("mai-tarato"));
    await putTuning(env, { crescita: { estensione: [5, 95] } });

    const prima = await env.KV.get("tuning:profili", { type: "json" });

    const delRes = await deleteConcept(env, "mai-tarato");
    expect(delRes.status).toBe(200);

    const dopo = await env.KV.get("tuning:profili", { type: "json" });
    expect(dopo.profili).toEqual(prima.profili);
  });
});
