// Le 4 rotte admin che chiamano AI/KV (lab/arc, run, backfill, test-size)
// devono rispondere 500 con una frase umana costante, MAI col messaggio
// tecnico originale o con `err.stack` nel corpo — quello resta solo nel log
// del Worker (CLAUDE.md, divieto segreti nel corpo HTTP). `/regen-day` è
// escluso apposta: i suoi messaggi sono testo di dominio scritto da noi.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

const SENTINELLA = "SEGRETO-DA-NON-VEDERE";

describe("rotte admin che generano: 500 senza stack né messaggio originale nel corpo", () => {
  const CASI = [
    {
      nome: "/lab/arc",
      path: "/lab/arc?concept=SEGRETO-DA-NON-VEDERE&element=quiete&days=2",
      frase: "generazione di prova non riuscita, controlla i log del worker",
    },
    {
      nome: "/run/<flusso>",
      path: "/run/segretodanonvedere",
      frase: "generazione non riuscita, controlla i log del worker",
    },
    {
      nome: "/backfill",
      path: "/backfill?ch=SEGRETO-DA-NON-VEDERE&days=2",
      frase: "generazione non riuscita, controlla i log del worker",
    },
  ];

  for (const { nome, path, frase } of CASI) {
    it(`${nome} con binding che fallisce → 500, corpo senza sentinella né stack`, async () => {
      const env = makeEnv();
      const res = await callWorker(env, path, {
        headers: { "x-artipop-key": env.ADMIN_KEY },
      });
      expect(res.status).toBe(500);
      expect(res.headers.get("content-type")).toContain("application/json");
      const testo = await res.text();
      expect(testo).not.toContain(SENTINELLA);
      const body = JSON.parse(testo);
      expect(body.ok).toBe(false);
      expect(body.error).toBe(frase);
      expect(body).not.toHaveProperty("stack");
    });
  }

  it("/test-size con AI.run che fallisce → 500, corpo senza sentinella né stack, size preservata", async () => {
    const env = makeEnv({
      AI: { run() { throw new Error(SENTINELLA); } },
    });
    const res = await callWorker(env, "/test-size?w=64&h=64", {
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });
    expect(res.status).toBe(500);
    const testo = await res.text();
    expect(testo).not.toContain(SENTINELLA);
    const body = JSON.parse(testo);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("prova di risoluzione non riuscita, controlla i log del worker");
    expect(body.size).toBe("64x64");
    expect(body).not.toHaveProperty("stack");
  });
});

describe("/regen-day resta sul ramo escluso: 400 col messaggio di dominio invariato", () => {
  it("senza ?ch=/?date= risponde ancora 400 con messaggio di dominio", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/regen-day", {
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    expect(body).not.toHaveProperty("stack");
  });
});
