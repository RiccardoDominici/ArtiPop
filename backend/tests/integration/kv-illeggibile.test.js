// Copre `getState`/`getMeta` (src/storage.js): sono le uniche letture KV del
// progetto FUORI dalla rete di `fetch` (girano nel cron via `scheduled`→
// `fanOutAll`→`runChannel`, handlers.js:163) — senza try/catch una singola
// chiave `state:<canale>` o `meta:<canale>` diventata illeggibile (bit-rot,
// scrittura a metà) blocca quel flusso OGNI giorno, e il ritentativo del
// ciclo 14 ripete lo stesso errore all'infinito. Stesso trattamento già in
// uso per `getGiorno`/`loadCatalog`/`loadNote`: lettura fallita → null, mai
// un'eccezione. Zero generazioni reali: AI/IMAGES sono finti.
import { describe, it, expect } from "vitest";
import { getState, getMeta } from "../../src/storage.js";
import { runChannel } from "../../src/handlers.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { todayKey } from "../../src/story.js";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

const PNG_FINTO = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

function envDiGenerazione(overrides = {}) {
  return makeEnv({
    AI: { run: async () => PNG_FINTO },
    IMAGES: undefined,
    ...overrides,
  });
}

describe("getState/getMeta: KV illeggibile non lancia", () => {
  it("state:<canale> = testo non-JSON → null, nessun throw", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV();
    await kv.put(`state:${canale}`, "non sono JSON {{{");
    const env = makeEnv({ KV: kv });

    await expect(getState(env, canale)).resolves.toBeNull();
  });

  it("meta:<canale> = testo non-JSON → null, nessun throw", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV();
    await kv.put(`meta:${canale}`, "non sono JSON {{{");
    const env = makeEnv({ KV: kv });

    await expect(getMeta(env, canale)).resolves.toBeNull();
  });

  it("state:<canale> JSON valido ma non-oggetto (stringa) → null", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV();
    await kv.put(`state:${canale}`, JSON.stringify("una stringa"));
    const env = makeEnv({ KV: kv });

    expect(await getState(env, canale)).toBeNull();
  });

  it("meta:<canale> JSON valido ma non-oggetto (array) → null", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV();
    await kv.put(`meta:${canale}`, JSON.stringify([1, 2, 3]));
    const env = makeEnv({ KV: kv });

    expect(await getMeta(env, canale)).toBeNull();
  });

  it("documento sano → invariato (regressione)", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV();
    const stato = { lastDate: "2020-01-01", conceptId: "isola" };
    const meta = { date: "2020-01-01", model: "x" };
    await kv.put(`state:${canale}`, JSON.stringify(stato));
    await kv.put(`meta:${canale}`, JSON.stringify(meta));
    const env = makeEnv({ KV: kv });

    expect(await getState(env, canale)).toEqual(stato);
    expect(await getMeta(env, canale)).toEqual(meta);
  });

  it("runChannel su state:<canale> corrotto → non lancia, genera l'immagine di oggi e riscrive uno stato leggibile", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const oggi = todayKey();
    const kv = makeKV();
    await kv.put(`state:${canale}`, "###non-json###");
    const env = envDiGenerazione({ KV: kv });

    const res = await runChannel(env, canale);

    expect(res.channel).toBe(canale);
    expect(res.date).toBe(oggi);
    const archiviata = await kv.get(`archive:${canale}:${oggi}`);
    expect(archiviata).not.toBeNull();
    const statoRiscritto = await getState(env, canale);
    expect(statoRiscritto).not.toBeNull();
    expect(statoRiscritto.lastDate).toBe(oggi);
  });

  it("GET /health con state:<canale> corrotto per tutti i flussi → 200 (non la pagina d'emergenza)", async () => {
    const kv = makeKV();
    for (const c of ACTIVE_CHANNELS) await kv.put(`state:${c.id}`, "###non-json###");
    const env = makeEnv({ KV: kv });

    const res = await callWorker(env, "/health");

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.ok).toBe(true);
  });

  it("GET / con meta:<canale> corrotto per tutti i flussi → 200 (non la pagina d'emergenza)", async () => {
    const kv = makeKV();
    for (const c of ACTIVE_CHANNELS) await kv.put(`meta:${c.id}`, "###non-json###");
    const env = makeEnv({ KV: kv });

    const res = await callWorker(env, "/");

    expect(res.status).toBe(200);
    const testo = await res.text();
    expect(testo).toContain("<html");
  });
});
