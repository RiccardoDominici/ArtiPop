// ROADMAP M7: /api/channels deve esporre il campo `famiglie` per canale
// (requisito di tuning/DESIGN.md, "Modifiche backend minime"). Già
// implementato in src/index.js (il campo passa da CHANNELS via c.famiglie):
// questo file è SOLO un test di regressione, come richiesto quando la
// milestone risulta già fatta nel codice.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { CHANNELS } from "../../src/channels.js";

describe("/api/channels: campo famiglie per canale attivo", () => {
  it("ogni canale attivo ha famiglie array non vuoto, coerente con CHANNELS", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/api/channels");
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.channels)).toBe(true);
    expect(body.channels.length).toBeGreaterThan(0);

    for (const ch of body.channels) {
      expect(Array.isArray(ch.famiglie)).toBe(true);
      expect(ch.famiglie.length).toBeGreaterThan(0);
      const atteso = CHANNELS.find((c) => c.id === ch.id);
      expect(atteso).toBeTruthy();
      expect(ch.famiglie).toEqual(atteso.famiglie);
    }
  });
});

describe("/api/channels?all=1: resta JSON valido con la regressione delle famiglie", () => {
  it("risponde 200 JSON valido; i canali attivi hanno ancora famiglie non vuoto", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/api/channels?all=1");
    expect(res.status).toBe(200);

    const body = await res.json(); // lancia da sola se non è JSON valido
    expect(Array.isArray(body.channels)).toBe(true);

    const attivi = body.channels.filter((c) => !c.storico);
    expect(attivi.length).toBeGreaterThan(0);
    for (const ch of attivi) {
      expect(Array.isArray(ch.famiglie)).toBe(true);
      expect(ch.famiglie.length).toBeGreaterThan(0);
    }

    // I canali storici (se presenti) restano con famiglie:[] per contratto
    // di /api/channels (vedi index.js): non è regressione delle famiglie, è
    // la forma dichiarata per chi non ha mai avuto un flusso proprio.
    const storici = body.channels.filter((c) => c.storico);
    for (const ch of storici) {
      expect(Array.isArray(ch.famiglie)).toBe(true);
    }
  });
});
