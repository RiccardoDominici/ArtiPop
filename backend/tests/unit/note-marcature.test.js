// Copre backend/src/note.js: prima di questo ciclo il modulo non era
// importato da NESSUN test (verificato a grep). Oltre alle quattro funzioni
// esportate, il caso di regressione principale è che `loadNote` non deve più
// far crashare le scritture quando gli array del documento contengono voci
// sporche (`null`/non-oggetto) — vedi IMPROVEMENTS.md per l'obiettivo.

import { describe, it, expect } from "vitest";
import { makeEnv, makeKV, kvChePerdeLeLetture } from "../helpers/fakeEnv.js";
import { loadNote, putGiornoNota, putAssetto, removeAssetto } from "../../src/note.js";

const NOTE_KEY = "note:marcature";

async function seed(kv, doc) {
  await kv.put(NOTE_KEY, JSON.stringify(doc));
}

describe("note.js — loadNote", () => {
  it("KV vuoto → documento vuoto", async () => {
    const env = makeEnv();
    expect(await loadNote(env)).toEqual({ version: 1, updatedAt: null, giorni: [], assetti: [] });
  });

  it("KV che lancia in lettura → documento vuoto, nessuna eccezione propagata", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });
    expect(await loadNote(env)).toEqual({ version: 1, updatedAt: null, giorni: [], assetti: [] });
  });

  it("documento sporco → solo le voci oggetto sopravvivono", async () => {
    const kv = makeKV();
    await seed(kv, { version: 1, updatedAt: "2026-01-01T00:00:00.000Z", giorni: [null, { canale: "island", data: "2026-01-01" }, 42], assetti: [] });
    const env = makeEnv({ KV: kv });
    const doc = await loadNote(env);
    expect(doc.giorni).toEqual([{ canale: "island", data: "2026-01-01" }]);
  });
});

describe("note.js — putGiornoNota", () => {
  it("caso felice: crea e poi aggiorna in loco la stessa voce", async () => {
    const env = makeEnv();
    const r1 = await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: "buono", nota: "bello" });
    expect(r1).toEqual({ ok: true });

    const r2 = await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: "scarto", nota: "no" });
    expect(r2).toEqual({ ok: true });

    const doc = await loadNote(env);
    expect(doc.giorni).toHaveLength(1);
    expect(doc.giorni[0]).toEqual({ canale: "island", data: "2026-01-01", giudizio: "scarto", nota: "no" });
  });

  it("giudizio:null su voce esistente rimuove la marcatura", async () => {
    const env = makeEnv();
    await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: "buono", nota: "" });
    const r = await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: null });
    expect(r).toEqual({ ok: true });
    const doc = await loadNote(env);
    expect(doc.giorni).toEqual([]);
  });

  it("errori di validazione: nessuna scrittura sul KV", async () => {
    const env = makeEnv();

    expect(await putGiornoNota(env, null)).toEqual({ ok: false, errori: expect.any(Array) });
    expect(await putGiornoNota(env, "non-oggetto")).toMatchObject({ ok: false });

    const r1 = await putGiornoNota(env, { canale: "non-esiste", data: "2026-01-01", giudizio: "buono" });
    expect(r1.ok).toBe(false);
    expect(r1.errori.length).toBeGreaterThan(0);

    const r2 = await putGiornoNota(env, { canale: "island", data: "01-01-2026", giudizio: "buono" });
    expect(r2.ok).toBe(false);

    const r3 = await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: "ottimo" });
    expect(r3.ok).toBe(false);

    const r4 = await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: "buono", nota: "x".repeat(501) });
    expect(r4.ok).toBe(false);

    expect(await loadNote(env)).toEqual({ version: 1, updatedAt: null, giorni: [], assetti: [] });
  });

  it("regressione: documento sporco non fa lanciare putGiornoNota", async () => {
    const kv = makeKV();
    await seed(kv, { version: 1, updatedAt: null, giorni: [null], assetti: [null] });
    const env = makeEnv({ KV: kv });
    const r = await putGiornoNota(env, { canale: "island", data: "2026-01-01", giudizio: "buono", nota: "" });
    expect(r).toEqual({ ok: true });
  });
});

describe("note.js — putAssetto", () => {
  const profiliValidi = {
    concettoA: { estensione: [10, 20], intensita: [10, 20], compattezza: [0.1, 0.5], monotona: true },
  };

  it("caso felice: crea, poi ri-salva mantenendo creatoIl", async () => {
    const env = makeEnv();
    const r1 = await putAssetto(env, { id: "assetto-1", nome: "Primo", profili: profiliValidi });
    expect(r1.ok).toBe(true);
    expect(r1.id).toBe("assetto-1");

    const doc1 = await loadNote(env);
    expect(doc1.assetti).toHaveLength(1);
    const creatoIl = doc1.assetti[0].creatoIl;

    const r2 = await putAssetto(env, { id: "assetto-1", nome: "Primo aggiornato", profili: profiliValidi });
    expect(r2.ok).toBe(true);

    const doc2 = await loadNote(env);
    expect(doc2.assetti).toHaveLength(1);
    expect(doc2.assetti[0].creatoIl).toBe(creatoIl);
    expect(doc2.assetti[0].nome).toBe("Primo aggiornato");
  });

  it("errori di validazione", async () => {
    const env = makeEnv();

    const r1 = await putAssetto(env, { id: "ID_MAIUSCOLO", nome: "x", profili: profiliValidi });
    expect(r1.ok).toBe(false);

    const r2 = await putAssetto(env, { id: "assetto-2", nome: "", profili: profiliValidi });
    expect(r2.ok).toBe(false);

    const r3 = await putAssetto(env, { id: "assetto-3", nome: "x" });
    expect(r3.ok).toBe(false);

    const r4 = await putAssetto(env, { id: "assetto-4", nome: "x", profili: {} });
    expect(r4.ok).toBe(false);
  });

  it("regressione: documento sporco non fa lanciare putAssetto", async () => {
    const kv = makeKV();
    await seed(kv, { version: 1, updatedAt: null, giorni: [null], assetti: [null] });
    const env = makeEnv({ KV: kv });
    const r = await putAssetto(env, { id: "assetto-ok", nome: "x", profili: profiliValidi });
    expect(r.ok).toBe(true);
  });
});

describe("note.js — removeAssetto", () => {
  it("id assente → ok:false", async () => {
    const env = makeEnv();
    expect(await removeAssetto(env, "")).toEqual({ ok: false, errori: expect.any(Array) });
  });

  it("id inesistente → ok:false", async () => {
    const env = makeEnv();
    expect(await removeAssetto(env, "non-esiste")).toEqual({ ok: false, errori: expect.any(Array) });
  });

  it("id esistente → rimosso", async () => {
    const env = makeEnv();
    await putAssetto(env, {
      id: "assetto-rimuovi",
      nome: "x",
      profili: { concettoA: { estensione: [10, 20], intensita: [10, 20], compattezza: [0.1, 0.5], monotona: true } },
    });
    const r = await removeAssetto(env, "assetto-rimuovi");
    expect(r).toEqual({ ok: true, rimosso: "assetto-rimuovi" });
    const doc = await loadNote(env);
    expect(doc.assetti).toEqual([]);
  });
});
