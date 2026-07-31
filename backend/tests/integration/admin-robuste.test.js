// Robustezza delle scritture admin (CLAUDE.md, principio 3): oggi un
// KV.put/delete che lancia dentro /tuning, /catalogo/*, /note/* propagava
// l'eccezione fuori dal fetch handler invece di tornare un JSON. Questo file
// esercita le 9 rotte di scrittura admin con un KV le cui scritture falliscono
// (kvChePerdeLeScritture, vedi helpers/fakeEnv.js) e verifica che rispondano
// tutte con la stessa forma di 500, mai un'eccezione che sfugge da
// worker.fetch. Copre anche /lab/img, portata dietro la stessa chiave admin
// in questo stesso ciclo.
import { describe, it, expect } from "vitest";
import { makeEnv, makeKV, kvChePerdeLeScritture, callWorker } from "../helpers/fakeEnv.js";

const TUNING_VALIDO = { profili: { crescita: { estensione: [10, 50] } } };

// 7 tappe (CONFIG.ARC_LENGTH_DAYS): esattamente quel che chiede validaTappe.
const CONCEPT_VALIDO = {
  id: "concept-scritture-test",
  nome: "Concept di prova",
  conserva: "conserva un elemento per il test di scrittura",
  tappe: Array.from({ length: 7 }, (_, i) => [`tappa numero ${i + 1}`]),
  extra: [],
  profilo: { estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1], monotona: false },
  maxDeriva: null,
  maxDegrado: null,
};

// pubblicato:false evita di dover fornire anche un `canale` valido.
const ELEMENT_VALIDO = {
  id: "element-scritture-test",
  nome: "Element di prova",
  s: "un soggetto di prova",
  setting: "un posto di prova",
  style: "uno stile di prova",
  palette: "una palette di prova",
  famigliaNativa: "crescita",
  pubblicato: false,
};

const NOTA_GIORNO_VALIDA = { canale: "natura", data: "2026-01-01", giudizio: "buono", nota: "" };

const ASSETTO_VALIDO = {
  id: "assetto-scritture-test",
  nome: "Assetto di prova",
  nota: "",
  profili: {
    crescita: {
      estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1],
      monotona: false, maxDeriva: null, maxDegrado: null,
    },
  },
};

async function seedConcept(env) {
  const res = await callWorker(env, `/catalogo/concept?key=${env.ADMIN_KEY}`, {
    method: "PUT", body: JSON.stringify(CONCEPT_VALIDO),
  });
  if (res.status !== 200) throw new Error(`seed concept fallito: ${res.status}`);
}
async function seedElement(env) {
  const res = await callWorker(env, `/catalogo/element?key=${env.ADMIN_KEY}`, {
    method: "PUT", body: JSON.stringify(ELEMENT_VALIDO),
  });
  if (res.status !== 200) throw new Error(`seed element fallito: ${res.status}`);
}
async function seedAssetto(env) {
  const res = await callWorker(env, `/note/assetto?key=${env.ADMIN_KEY}`, {
    method: "PUT", body: JSON.stringify(ASSETTO_VALIDO),
  });
  if (res.status !== 200) throw new Error(`seed assetto fallito: ${res.status}`);
}

// Le tre DELETE rispondono 400 su id inesistente (catalog.js:215-232,
// note.js:203-214) PRIMA di scrivere: senza semina non eserciterebbero mai il
// KV.delete guasto. Le altre 6 rotte non hanno bisogno di stato preesistente:
// /tuning e /note/giorno funzionano anche a documento assente, e i due PUT di
// creazione (concept/element) sono upsert che scrivono al primo colpo.
const ROTTE_SCRITTURA = [
  { method: "PUT", path: "/tuning", body: TUNING_VALIDO, seed: null },
  { method: "DELETE", path: "/tuning", body: null, seed: null },
  { method: "PUT", path: "/catalogo/concept", body: CONCEPT_VALIDO, seed: null },
  { method: "DELETE", path: `/catalogo/concept?id=${CONCEPT_VALIDO.id}`, body: null, seed: seedConcept },
  { method: "PUT", path: "/catalogo/element", body: ELEMENT_VALIDO, seed: null },
  { method: "DELETE", path: `/catalogo/element?id=${ELEMENT_VALIDO.id}`, body: null, seed: seedElement },
  { method: "PUT", path: "/note/giorno", body: NOTA_GIORNO_VALIDA, seed: null },
  { method: "PUT", path: "/note/assetto", body: ASSETTO_VALIDO, seed: null },
  { method: "DELETE", path: `/note/assetto?id=${ASSETTO_VALIDO.id}`, body: null, seed: seedAssetto },
];

describe("scritture admin: KV che perde le scritture → 500 uniforme", () => {
  for (const { method, path, body, seed } of ROTTE_SCRITTURA) {
    it(`${method} ${path} risponde 500 { ok:false, error } senza propagare l'eccezione`, async () => {
      const kv = makeKV();
      const envSano = makeEnv({ KV: kv });
      if (seed) await seed(envSano);
      const envGuasto = makeEnv({ KV: kvChePerdeLeScritture(kv), ADMIN_KEY: envSano.ADMIN_KEY });

      const separatore = path.includes("?") ? "&" : "?";
      const url = `${path}${separatore}key=${envGuasto.ADMIN_KEY}`;
      const init = { method, ...(body ? { body: JSON.stringify(body) } : {}) };

      const res = await callWorker(envGuasto, url, init);

      expect(res.status).toBe(500);
      expect(res.headers.get("content-type")).toContain("application/json");
      const risposta = await res.json();
      expect(risposta.ok).toBe(false);
      expect(typeof risposta.error).toBe("string");
      expect(risposta.error.length).toBeGreaterThan(0);
      // Nessun dettaglio tecnico nella risposta: solo la frase umana costante.
      expect(risposta.error).not.toMatch(/KV\.|Error|stack/i);
    });
  }
});

describe("non-regressione: KV sano → il wrap non cambia il caso felice", () => {
  it("PUT /tuning con KV sano → 200 ok:true", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/tuning?key=${env.ADMIN_KEY}`, {
      method: "PUT", body: JSON.stringify(TUNING_VALIDO),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("PUT /catalogo/concept con KV sano → 200 ok:true", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/catalogo/concept?key=${env.ADMIN_KEY}`, {
      method: "PUT", body: JSON.stringify(CONCEPT_VALIDO),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("PUT /note/giorno con KV sano → 200 ok:true", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/note/giorno?key=${env.ADMIN_KEY}`, {
      method: "PUT", body: JSON.stringify(NOTA_GIORNO_VALIDA),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("/lab/img: protetta come il resto del blocco admin", () => {
  it("senza chiave → 403 JSON, nessuna lettura dell'immagine", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/lab/img?run=qualsiasi&n=0");
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("con chiave corretta e run inesistente → 404 come oggi", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/lab/img?run=run-inesistente&n=0&key=${env.ADMIN_KEY}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });
});
