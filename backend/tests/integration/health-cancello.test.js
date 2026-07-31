// ROADMAP M5: il cancello (metrics.js) non deve spegnersi in silenzio quando
// IMAGES manca/fallisce. Due livelli, come da piano — orchestrare una
// runChannel vera userebbe env.AI/env.IMAGES che in fakeEnv.js LANCIANO
// apposta (budget AI 0 di questo ciclo), quindi si isola:
//  (a) la funzione pura che costruisce il campo `cancello` da un `img` con
//      impronta null (src/handlers.js, buildCancelloState);
//  (b) /health che espone quel campo leggendolo da uno stato preseminato.
import { describe, it, expect } from "vitest";
import { buildCancelloState } from "../../src/handlers.js";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("buildCancelloState: impronta null → cancello disattivato", () => {
  it("IMAGES assente/rotto (impronta: null) → attivo:false, verdetto:'disattivo'", () => {
    const img = { impronta: null, verdetto: null, tentativi: 3 };
    const c = buildCancelloState(img, "2026-07-29T06:00:00.000Z");
    expect(c).toEqual({
      attivo: false, tentativi: 3, verdetto: "disattivo", quando: "2026-07-29T06:00:00.000Z",
    });
  });

  it("img assente del tutto → comunque disattivato, mai un lancio", () => {
    const c = buildCancelloState(null, "2026-07-29T06:00:00.000Z");
    expect(c.attivo).toBe(false);
    expect(c.verdetto).toBe("disattivo");
  });
});

describe("buildCancelloState: impronta presente", () => {
  it("collaudo passato (verdetto.ok true) → attivo:true, verdetto:'ok'", () => {
    const img = { impronta: new Uint8Array([1]), verdetto: { ok: true, motivi: [] }, tentativi: 1 };
    const c = buildCancelloState(img, "2026-07-29T06:00:00.000Z");
    expect(c).toEqual({ attivo: true, tentativi: 1, verdetto: "ok", quando: "2026-07-29T06:00:00.000Z" });
  });

  it("tentativi esauriti fuori range (verdetto.ok false) → verdetto:'fuori-range'", () => {
    const img = { impronta: new Uint8Array([1]), verdetto: { ok: false, motivi: ["troppo"] }, tentativi: 3 };
    const c = buildCancelloState(img, "2026-07-29T06:00:00.000Z");
    expect(c).toEqual({ attivo: true, tentativi: 3, verdetto: "fuori-range", quando: "2026-07-29T06:00:00.000Z" });
  });

  it("verdetto null ma impronta calcolata (keyframe/primo giorno) → 'ok', non 'disattivo'", () => {
    // Giorno strutturalmente senza collaudo (es. dayInArc===0 in daygen.js):
    // il misuratore FUNZIONA (impronta c'è), semplicemente oggi non doveva
    // giudicare nulla — non è lo stesso guasto di IMAGES rotto.
    const img = { impronta: new Uint8Array([1]), verdetto: null, tentativi: 1 };
    const c = buildCancelloState(img, "2026-07-29T06:00:00.000Z");
    expect(c.attivo).toBe(true);
    expect(c.verdetto).toBe("ok");
  });
});

describe("/health espone il campo cancello per flusso", () => {
  it("uno stato preseminato con cancello compare identico nel JSON di /health", async () => {
    const env = makeEnv();
    const cancelloSeminato = { attivo: false, tentativi: 3, verdetto: "disattivo", quando: "2026-07-29T06:00:00.000Z" };
    // Chiave `state:<canale>` (vedi src/storage.js): quella che runChannel
    // scrive con `cancello` dopo ogni esecuzione (handlers.js).
    await env.KV.put("state:natura", JSON.stringify({ lastDate: "2026-07-29", cancello: cancelloSeminato }));

    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
    const body = await res.json();

    const natura = body.flussi.find((f) => f.id === "natura");
    expect(natura).toBeTruthy();
    expect(natura.cancello).toEqual(cancelloSeminato);
  });

  it("un flusso mai eseguito (nessuno stato) espone cancello: null, non lancia", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const f of body.flussi) {
      expect(f.cancello).toBeNull();
    }
  });
});
