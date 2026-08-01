// Ciclo "le note private non sono più leggibili da chiunque": GET /note
// restituiva l'intero documento note:marcature (giudizi buono/scarto con note
// libere fino a 500 caratteri, più tutti gli assetti di taratura salvati)
// senza alcun controllo — mentre le scritture sulle stesse note (PUT
// /note/giorno, PUT/DELETE /note/assetto) erano già admin-only. Da qui in
// poi la lettura richiede la stessa chiave admin della scrittura, come le
// altre rotte protette (vedi router-auth.test.js).
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("GET /note: protetta come la scrittura", () => {
  it("senza chiave → 403 e il corpo non espone il documento", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/note", { method: "GET" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    expect(body.giorni).toBeUndefined();
    expect(body.assetti).toBeUndefined();
  });

  it("senza ADMIN_KEY configurato → 403 anche fornendo una chiave qualsiasi", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    const res = await callWorker(env, "/note?key=qualsiasi-valore", { method: "GET" });
    expect(res.status).toBe(403);
  });

  it("con x-artipop-key corretta e KV vuoto → 200 con documento vuoto", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/note", {
      method: "GET",
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.giorni)).toBe(true);
    expect(Array.isArray(body.assetti)).toBe(true);
    expect(body.giorni.length).toBe(0);
    expect(body.assetti.length).toBe(0);
  });

  it("con x-artipop-key corretta e un documento seminato → 200 con la nota privata visibile", async () => {
    const env = makeEnv();
    const doc = {
      version: 1,
      updatedAt: "2026-08-01T00:00:00.000Z",
      giorni: [{ canale: "natura", data: "2026-07-30", giudizio: "buono", nota: "appunto privato di Riccardo" }],
      assetti: [{ id: "prova", nome: "Prova", nota: "", creatoIl: "2026-08-01T00:00:00.000Z", profili: {} }],
    };
    await env.KV.put("note:marcature", JSON.stringify(doc));

    const res = await callWorker(env, "/note", {
      method: "GET",
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.giorni).toHaveLength(1);
    expect(body.giorni[0].nota).toBe("appunto privato di Riccardo");
    expect(body.assetti).toHaveLength(1);
    expect(body.assetti[0].id).toBe("prova");
  });

  it("chiave solo in ?key= (non nell'header) → 403: la nota non si vede", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/note?key=${env.ADMIN_KEY}`, { method: "GET" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("x-artipop-key");
  });

  it("OPTIONS /note → 204 con gli header CORS, senza chiedere la chiave", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/note", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
