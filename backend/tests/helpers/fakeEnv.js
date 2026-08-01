// Ambiente fittizio per i test d'integrazione (router + orchestrazione).
//
// Filosofia invariata rispetto ai test unit esistenti: solo oggetti letterali
// passati come argomenti, NESSUN mock a livello di modulo. `makeKV` implementa
// le sole operazioni KV realmente usate da src/storage.js e src/index.js
// (verificato con `grep -rn "env.KV\." src/*.js`): get/getWithMetadata/put/
// delete/list, con i type "json"/"stream" effettivamente richiesti — nessun
// uso di type "arrayBuffer" su KV nel codice, quindi non simulato qui.
//
// Le chiavi KV (state:<canale>, archive:<canale>:<data>, …) sono documentate
// in testa a src/storage.js: chi semina il fake KV nei test le ricostruisce da
// lì, non da un helper qui — sarebbe un secondo posto da tenere sincrono col
// primo per un solo modulo consumatore (i test di orchestrazione).

import worker from "../../src/index.js";

/** KV in-memory: stessa forma del binding reale, minimo indispensabile. */
export function makeKV() {
  const store = new Map(); // key (string) -> { value: string|Uint8Array, metadata }

  function toStream(value) {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  return {
    async get(key, opts = {}) {
      const entry = store.get(key);
      if (!entry) return null;
      if (opts.type === "json") return JSON.parse(entry.value);
      if (opts.type === "stream") return toStream(entry.value);
      return entry.value;
    },
    async getWithMetadata(key, opts = {}) {
      const entry = store.get(key);
      if (!entry) return { value: null, metadata: null };
      const value = opts.type === "stream" ? toStream(entry.value) : entry.value;
      return { value, metadata: entry.metadata ?? null };
    },
    async put(key, value, opts = {}) {
      store.set(key, { value, metadata: opts.metadata ?? null });
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = "", cursor, limit = 1000 } = {}) {
      const tutte = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const pagina = tutte.slice(start, start + limit);
      const completa = start + limit >= tutte.length;
      return {
        keys: pagina.map((name) => ({ name })),
        list_complete: completa,
        cursor: completa ? undefined : String(start + limit),
      };
    },
  };
}

// KV che legge normalmente ma le cui scritture falliscono: serve a esercitare
// il ramo `scritturaProtetta` (src/index.js) fino in fondo, dopo aver seminato
// stato con un KV sano — get/getWithMetadata/list restano quelli di `kv`.
export function kvChePerdeLeScritture(kv = makeKV()) {
  return {
    ...kv,
    async put() { throw new Error("KV.put non disponibile (simulato)"); },
    async delete() { throw new Error("KV.delete non disponibile (simulato)"); },
  };
}

// AI/IMAGES/SELF lanciano se invocati: garanzia STRUTTURALE (non un conteggio
// a posteriori) che nessun test di router/orchestrazione esegua una
// generazione reale — coerente col budget AI dichiarato 0 di questo ciclo.
// I soli metodi implementati sono quelli realmente chiamati (verificato con
// grep su src/generate.js, src/metrics.js e src/handlers.js): AI.run,
// IMAGES.input, SELF.fetch.
// Gemello di `kvChePerdeLeScritture`: qui a lanciare sono le LETTURE (get,
// getWithMetadata), mentre put/delete/list restano quelli del KV di base —
// serve a esercitare la rete di sicurezza globale su rotte che oggi non
// avvolgono le proprie letture (index.js, il try/catch attorno a `fetch`).
export function kvChePerdeLeLetture(kv = makeKV()) {
  return {
    ...kv,
    async get() { throw new Error("KV.get non disponibile (simulato)"); },
    async getWithMetadata() { throw new Error("KV.getWithMetadata non disponibile (simulato)"); },
  };
}

function stubAI() {
  return { run() { throw new Error("AI.run non doveva essere invocato in questo test"); } };
}
function stubImages() {
  return { input() { throw new Error("IMAGES.input non doveva essere invocato in questo test"); } };
}
// `fetchImpl`, se passata, sostituisce il fetch finto (es. per simulare le
// risposte di /run/<canale> nei test di orchestrazione del ritentativo).
// Default INVARIATO per tutti i test esistenti: lancia se invocato.
export function stubSelf(fetchImpl) {
  return { fetch: fetchImpl ?? (() => { throw new Error("SELF.fetch non doveva essere invocato in questo test"); }) };
}

/** Ambiente fittizio completo; `overrides` sostituisce singoli campi (es. ADMIN_KEY assente). */
export function makeEnv(overrides = {}) {
  return {
    KV: makeKV(),
    ADMIN_KEY: "chiave-di-test",
    AI: stubAI(),
    IMAGES: stubImages(),
    SELF: stubSelf(),
    ...overrides,
  };
}

// ExecutionContext fittizio: `fetch(request, env, ctx)` in src/index.js non
// legge mai `ctx` (solo `scheduled` chiama `ctx.waitUntil`, mai esercitato da
// questi test), ma il worker si aspetta comunque l'argomento.
const ctxFittizio = { waitUntil() {} };

/** Chiama worker.fetch come farebbe Cloudflare, senza toccare la rete. */
export async function callWorker(env, path, init = {}) {
  return worker.fetch(new Request("https://artipop.test" + path, init), env, ctxFittizio);
}
