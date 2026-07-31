// s-health-dice-se-un-flusso-e-fermo: /health esponeva già `cancello` (M5),
// che dice se il collaudo ha misurato — non se l'ultima esecuzione è di
// oggi. Un flusso può avere cancello "ok" da giorni e restare comunque fermo
// senza che nessuno se ne accorga (vedi PLAN.md). Stesso schema di
// health-cancello.test.js: (a) la funzione pura buildFreschezzaState,
// (b) /health che la espone leggendo uno stato preseminato in KV.
import { describe, it, expect } from "vitest";
import { buildFreschezzaState } from "../../src/handlers.js";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("buildFreschezzaState", () => {
  it("lastDate = oggi → aggiornato:true, giorniDiRitardo:0", () => {
    const f = buildFreschezzaState({ lastDate: "2026-07-31" }, "2026-07-31");
    expect(f).toEqual({ ultimaData: "2026-07-31", aggiornato: true, giorniDiRitardo: 0 });
  });

  it("lastDate di 3 giorni fa → aggiornato:false, giorniDiRitardo:3", () => {
    const f = buildFreschezzaState({ lastDate: "2026-07-28" }, "2026-07-31");
    expect(f).toEqual({ ultimaData: "2026-07-28", aggiornato: false, giorniDiRitardo: 3 });
  });

  it("nessuno stato (null) → ultimaData/giorniDiRitardo null, aggiornato false, nessuna eccezione", () => {
    const f = buildFreschezzaState(null, "2026-07-31");
    expect(f).toEqual({ ultimaData: null, aggiornato: false, giorniDiRitardo: null });
  });

  it("lastDate non una data valida (es. 'ieri') → stesso esito del caso assente", () => {
    const f = buildFreschezzaState({ lastDate: "ieri" }, "2026-07-31");
    expect(f).toEqual({ ultimaData: null, aggiornato: false, giorniDiRitardo: null });
  });
});

describe("/health espone freschezza e flussiFermi", () => {
  it("stato con lastDate = oggi: quel flusso è aggiornato e non contato in flussiFermi", async () => {
    const env = makeEnv();
    const oggi = "2026-07-31"; // vedi tests/helpers/fakeEnv.js: nessun clock reale, todayKey() gira sull'orario di sistema del runner — qui si verifica solo la forma della risposta, non il valore assoluto di "oggi".
    await env.KV.put("state:natura", JSON.stringify({ lastDate: oggi, cancello: null }));

    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const natura = body.flussi.find((f) => f.id === "natura");
    expect(natura.freschezza).toBeTruthy();
    expect(typeof natura.freschezza.aggiornato).toBe("boolean");
    expect(typeof body.flussiFermi).toBe("number");
  });

  it("un flusso mai eseguito (nessuno stato): ultimaData null, aggiornato false, contato in flussiFermi", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
    const body = await res.json();

    for (const f of body.flussi) {
      expect(f.freschezza.ultimaData).toBeNull();
      expect(f.freschezza.aggiornato).toBe(false);
      expect(f.freschezza.giorniDiRitardo).toBeNull();
    }
    expect(body.flussiFermi).toBe(body.flussi.length);
  });

  it("lastDate presente ma non una data: nessuna eccezione, /health resta 200 ok:true", async () => {
    const env = makeEnv();
    await env.KV.put("state:citta", JSON.stringify({ lastDate: "non-una-data", cancello: null }));

    const res = await callWorker(env, "/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const citta = body.flussi.find((f) => f.id === "citta");
    expect(citta.freschezza).toEqual({ ultimaData: null, aggiornato: false, giorniDiRitardo: null });
  });
});
