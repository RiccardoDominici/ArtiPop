// Copre il ritentativo di fanOutAll (src/handlers.js): i canali falliti al
// primo colpo (reject o status !== 200) vengono richiamati una seconda e
// ULTIMA volta, sempre senza `force`. SELF è finto (nessuna generazione AI,
// budget 0/10 — vedi fakeEnv.js: stubAI/stubImages continuano a lanciare).
import { describe, it, expect } from "vitest";
import { fanOutAll } from "../../src/handlers.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, stubSelf } from "../helpers/fakeEnv.js";

describe("fanOutAll: ritentativo dei canali falliti", () => {
  it("tutti i canali rispondono 200 al primo colpo: una sola chiamata a testa, nessun `ritentato`", async () => {
    const chiamate = [];
    const env = makeEnv({
      SELF: stubSelf(async (url) => {
        chiamate.push(String(url));
        return { status: 200, json: async () => ({ ok: true }) };
      }),
    });

    const res = await fanOutAll(env);

    expect(chiamate.length).toBe(ACTIVE_CHANNELS.length);
    expect(res.every((r) => !("ritentato" in r))).toBe(true);
    expect(res.map((r) => r.channel)).toEqual(ACTIVE_CHANNELS.map((c) => c.id));
  });

  it("un canale risponde 500 al primo colpo e 200 al secondo: successo con `ritentato: true`, gli altri richiamati una volta sola", async () => {
    const bersaglio = ACTIVE_CHANNELS[0].id;
    const conteggio = new Map();
    const env = makeEnv({
      SELF: stubSelf(async (url) => {
        const s = String(url);
        conteggio.set(s, (conteggio.get(s) ?? 0) + 1);
        if (s.includes(`/run/${bersaglio}`) && conteggio.get(s) === 1) {
          return { status: 500, json: async () => ({ error: "boom" }) };
        }
        return { status: 200, json: async () => ({ ok: true }) };
      }),
    });

    const res = await fanOutAll(env);

    const risultatoBersaglio = res.find((r) => r.channel === bersaglio);
    expect(risultatoBersaglio.status).toBe(200);
    expect(risultatoBersaglio.ritentato).toBe(true);

    const altri = ACTIVE_CHANNELS.filter((c) => c.id !== bersaglio);
    for (const ch of altri) {
      const chiamateCanale = [...conteggio.keys()].filter((u) => u.includes(`/run/${ch.id}`));
      expect(chiamateCanale.length).toBe(1);
    }
  });

  it("un canale fallisce entrambe le volte: il risultato finale riporta il fallimento, mai un falso successo, con `ritentato: true` e SOLO 2 chiamate", async () => {
    const bersaglio = ACTIVE_CHANNELS[0].id;
    let chiamateBersaglio = 0;
    const env = makeEnv({
      SELF: stubSelf(async (url) => {
        const s = String(url);
        if (s.includes(`/run/${bersaglio}`)) {
          chiamateBersaglio++;
          return { status: 500, json: async () => ({ error: "sempre giù" }) };
        }
        return { status: 200, json: async () => ({ ok: true }) };
      }),
    });

    const res = await fanOutAll(env);

    const risultatoBersaglio = res.find((r) => r.channel === bersaglio);
    expect(risultatoBersaglio.status).toBe(500);
    expect(risultatoBersaglio.ritentato).toBe(true);
    expect(chiamateBersaglio).toBe(2);
  });

  it("SELF.fetch che rejecta al primo colpo viene comunque ritentato, e fanOutAll non lancia mai verso il chiamante", async () => {
    const bersaglio = ACTIVE_CHANNELS[0].id;
    let primaChiamata = true;
    const env = makeEnv({
      SELF: stubSelf(async (url) => {
        const s = String(url);
        if (s.includes(`/run/${bersaglio}`) && primaChiamata) {
          primaChiamata = false;
          throw new Error("rete assente");
        }
        if (s.includes(`/run/${bersaglio}`)) {
          return { status: 200, json: async () => ({ ok: true }) };
        }
        return { status: 200, json: async () => ({ ok: true }) };
      }),
    });

    const res = await fanOutAll(env);

    const risultatoBersaglio = res.find((r) => r.channel === bersaglio);
    expect(risultatoBersaglio.ritentato).toBe(true);
    expect(risultatoBersaglio.status).toBe(200);
  });

  it("fanOutAll(env, { force: true }) con un canale fallito: la prima passata usa force=1, il ritentativo NO", async () => {
    const bersaglio = ACTIVE_CHANNELS[0].id;
    const urlPerCanale = new Map();
    const env = makeEnv({
      SELF: stubSelf(async (url) => {
        const s = String(url);
        if (s.includes(`/run/${bersaglio}`)) {
          const lista = urlPerCanale.get(bersaglio) ?? [];
          lista.push(s);
          urlPerCanale.set(bersaglio, lista);
          if (lista.length === 1) return { status: 500, json: async () => ({ error: "boom" }) };
          return { status: 200, json: async () => ({ ok: true }) };
        }
        return { status: 200, json: async () => ({ ok: true }) };
      }),
    });

    await fanOutAll(env, { force: true });

    const urls = urlPerCanale.get(bersaglio);
    expect(urls.length).toBe(2);
    expect(urls[0]).toContain("force=1");
    expect(urls[1]).not.toContain("force=1");
  });
});
