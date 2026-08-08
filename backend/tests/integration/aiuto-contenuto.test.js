// Contenuto testuale di /aiuto: le istruzioni devono corrispondere a ciò che
// la home mostra davvero, non a elementi rimossi (striscia di miniature,
// archivio integrale dentro "Il viaggio finora"). CLAUDE.md, principio 1
// (utilizzabilità) — un'istruzione che rimanda a un elemento inesistente non
// è eseguibile dall'utente.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("/aiuto — contenuto allineato alla home attuale", () => {
  it("non cita più la striscia di miniature, rimossa dalla home", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/aiuto");
    const body = await res.text();
    expect(body.toLowerCase()).not.toContain("miniatur");
  });

  it('non promette più di riscaricare "ogni giorno passato" da "Il viaggio finora"', async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/aiuto");
    const body = await res.text();
    expect(body).not.toContain("riscaricare ogni giorno passato");
  });

  it("conserva l'indirizzo diretto d'archivio e il rimando a \"Il viaggio finora\"", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/aiuto");
    const body = await res.text();
    expect(body).toContain("?date=");
    expect(body).toContain("Il viaggio finora");
  });

  it("la FAQ sull'orario di generazione nomina esplicitamente UTC", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/aiuto");
    const body = await res.text();
    expect(body).toMatch(/3:00\s*UTC/);
  });

  it("risponde 200 text/html con lo stesso numero di voci di prima (7 problemi + 9 FAQ)", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/aiuto");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    const summaryCount = (body.match(/<summary>/g) || []).length;
    expect(summaryCount).toBe(16);
  });
});
