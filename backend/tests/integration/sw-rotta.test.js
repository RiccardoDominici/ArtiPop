// feat-l-app-installata-si-apre-anche-senza-rete: rotta pubblica /sw.js,
// stesso trattamento end-to-end di manifest-rotta.test.js.
import { describe, it, expect } from "vitest";
import { makeEnv, makeKV, callWorker } from "../helpers/fakeEnv.js";
import { serviceWorkerJs } from "../../src/sw.js";

describe("GET /sw.js", () => {
  it("risponde 200 con JavaScript, senza chiave admin", async () => {
    const env = makeEnv({ KV: makeKV() });

    const res = await callWorker(env, "/sw.js");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    const corpo = await res.text();
    expect(corpo.length).toBeGreaterThan(0);
    expect(corpo).toBe(serviceWorkerJs());
  });
});

describe("POST /sw.js", () => {
  it("non passa dal ramo pubblico", async () => {
    const env = makeEnv({ KV: makeKV() });

    const res = await callWorker(env, "/sw.js", { method: "POST" });

    expect([404, 405]).toContain(res.status);
  });
});
