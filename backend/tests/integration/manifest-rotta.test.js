// feat-aggiungi-artipop-alla-schermata-home: le due rotte pubbliche per
// installare ArtiPop sulla schermata Home devono rispondere senza chiave
// admin e senza mai toccare il KV — vedi manifest-app.test.js per la
// copertura pura di renderManifest()/iconaSvg() e dei tag nelle pagine HTML.
import { describe, it, expect } from "vitest";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";

function kvConSpiaScritture(kv = makeKV()) {
  let scritture = 0;
  return {
    kv: {
      ...kv,
      async put(...args) {
        scritture += 1;
        return kv.put(...args);
      },
    },
    conteggioScritture: () => scritture,
  };
}

describe("GET /manifest.webmanifest", () => {
  it("risponde 200 con JSON valido, senza chiave admin", async () => {
    const { kv, conteggioScritture } = kvConSpiaScritture();
    const env = makeEnv({ KV: kv });

    const res = await callWorker(env, "/manifest.webmanifest");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    const corpo = await res.text();
    const json = JSON.parse(corpo);
    expect(json.start_url).toBe("/");
    expect(json.display).toBe("standalone");
    expect(conteggioScritture()).toBe(0);
  });
});

describe("GET /icona.svg", () => {
  it("risponde 200 con SVG, senza chiave admin", async () => {
    const { kv, conteggioScritture } = kvConSpiaScritture();
    const env = makeEnv({ KV: kv });

    const res = await callWorker(env, "/icona.svg");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    const corpo = await res.text();
    expect(corpo.startsWith("<svg")).toBe(true);
    expect(conteggioScritture()).toBe(0);
  });
});
