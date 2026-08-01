// Copre la persistenza di runChannel (src/handlers.js): se `putImage` riesce
// ma `putState` lancia (guasto transitorio KV) l'immagine di oggi è comunque
// in archivio — buttarla via ripetendo la generazione sarebbe il comportamento
// peggiore possibile (principio 1, CLAUDE.md). Prima di questo ciclo l'errore
// propagava da runChannel: /run/<flusso> rispondeva 500, il ritentativo del
// cron (ciclo 14, fanOutAll) richiamava runChannel trovando `lastDate` ancora a
// ieri e RIGENERAVA una seconda immagine con l'AI, sovrascrivendo quella già
// pubblicata sotto l'utente. Zero generazioni reali: AI/IMAGES sono finti.
import { describe, it, expect } from "vitest";
import { runChannel, fanOutAll } from "../../src/handlers.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { todayKey } from "../../src/story.js";
import { makeEnv, makeKV, callWorker, stubSelf } from "../helpers/fakeEnv.js";

// Byte PNG minimi (magic number): normalizeImageOutput (generate.js) li
// riconosce come Uint8Array e non tenta altro parsing.
const PNG_FINTO = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

// AI che risponde sempre con un'immagine finta valida: basta per il primo
// giorno dell'arco (dayInArc === 0, generateImage senza riferimenti, vedi
// daygen.js) di un canale mai generato prima. IMAGES resta assente (undefined,
// non lo stub che lancia): sia resizeForModel (generate.js) sia
// fingerprintFromStream (metrics.js) tornano `null` a binding assente, invece
// di lanciare — così il keyframe si pubblica senza bisogno del binding Images.
function envDiGenerazione(overrides = {}) {
  return makeEnv({
    AI: { run: async () => PNG_FINTO },
    IMAGES: undefined,
    ...overrides,
  });
}

describe("runChannel: putState guasto dopo putImage riuscita", () => {
  it("putState lancia → runChannel NON lancia, ritorna statoNonSalvato:true e l'immagine di oggi è in archivio", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const oggi = todayKey();
    const kv = makeKV({ putFallisce: (chiave) => chiave === `state:${canale}` });
    const env = envDiGenerazione({ KV: kv });

    const res = await runChannel(env, canale);

    expect(res.statoNonSalvato).toBe(true);
    expect(res.channel).toBe(canale);
    const archiviata = await kv.get(`archive:${canale}:${oggi}`);
    expect(archiviata).not.toBeNull();
  });

  it("stesso caso via /run/<flusso>: risposta 200 (non 500), corpo JSON", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV({ putFallisce: (chiave) => chiave === `state:${canale}` });
    const env = envDiGenerazione({ KV: kv });

    const res = await callWorker(env, `/run/${canale}`, {
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.statoNonSalvato).toBe(true);
  });

  it("putImage che lancia → runChannel lancia ancora (comportamento invariato)", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV({ putFallisce: (chiave) => chiave.startsWith(`archive:${canale}:`) });
    const env = envDiGenerazione({ KV: kv });

    await expect(runChannel(env, canale)).rejects.toThrow();
  });

  it("percorso felice: il risultato NON contiene `statoNonSalvato` e lo stato è salvato", async () => {
    const canale = ACTIVE_CHANNELS[0].id;
    const kv = makeKV();
    const env = envDiGenerazione({ KV: kv });

    const res = await runChannel(env, canale);

    expect("statoNonSalvato" in res).toBe(false);
    const stato = await kv.get(`state:${canale}`, { type: "json" });
    expect(stato).not.toBeNull();
    expect(stato.lastDate).toBe(todayKey());
  });
});

describe("fanOutAll: nessun ritentativo se il solo problema è lo stato non salvato", () => {
  it("un canale con putState rotto risponde 200 al primo colpo: una sola chiamata a /run/<canale>, mai `ritentato`", async () => {
    const bersaglio = ACTIVE_CHANNELS[0].id;
    const conteggio = new Map();
    const kv = makeKV({ putFallisce: (chiave) => chiave === `state:${bersaglio}` });
    const envInterno = envDiGenerazione({ KV: kv });

    const env = makeEnv({
      SELF: stubSelf(async (url, init) => {
        const s = String(url);
        conteggio.set(s, (conteggio.get(s) ?? 0) + 1);
        const path = s.replace("https://artipop.internal", "");
        const risposta = await callWorker(envInterno, path, init);
        return { status: risposta.status, json: async () => risposta.json() };
      }),
    });

    const res = await fanOutAll(env);

    const risultatoBersaglio = res.find((r) => r.channel === bersaglio);
    expect(risultatoBersaglio.status).toBe(200);
    expect("ritentato" in risultatoBersaglio).toBe(false);

    const chiamateBersaglio = [...conteggio.keys()].filter((u) => u.includes(`/run/${bersaglio}`));
    expect(chiamateBersaglio.length).toBe(1);
  });
});
