// feat-il-sito-si-fa-trovare-solo-dove-serve: GET /robots.txt deve rispondere
// senza chiave admin e senza mai toccare il KV — vedi robots-testo.test.js
// per la copertura pura di renderRobots().
import { describe, it, expect } from "vitest";
import { makeEnv, kvChePerdeLeLetture, callWorker } from "../helpers/fakeEnv.js";
import { renderRobots } from "../../src/robots.js";

describe("GET /robots.txt", () => {
  it("risponde 200 con text/plain e corpo non vuoto, senza chiave admin", async () => {
    const env = makeEnv();

    const res = await callWorker(env, "/robots.txt");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const corpo = await res.text();
    expect(corpo.length).toBeGreaterThan(0);
    expect(() => JSON.parse(corpo)).toThrow();
  });

  it("il corpo della risposta è identico a renderRobots()", async () => {
    const env = makeEnv();

    const res = await callWorker(env, "/robots.txt");
    const corpo = await res.text();

    expect(corpo).toBe(renderRobots("https://artipop.test"));
  });

  it("non legge il KV: risponde 200 anche con un binding KV che lancia se interrogato", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });

    const res = await callWorker(env, "/robots.txt");

    expect(res.status).toBe(200);
  });
});
