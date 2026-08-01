// Copre TUTTE le rotte guardate da isAuthorized in src/index.js: 16 occorrenze
// (contate con `grep -c "isAuthorized" src/index.js` meno la definizione della
// funzione), una per riga qui sotto — enumerate dal codice, non a memoria.
// isAuthorized confronta ?key=/x-artipop-key con env.ADMIN_KEY: senza chiave
// (o senza ADMIN_KEY configurato) ogni rotta deve rifiutare, MAI eseguire.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

export const ROTTE_PROTETTE = [
  ["PUT", "/tuning"],
  ["DELETE", "/tuning"],
  ["PUT", "/catalogo/concept"],
  ["DELETE", "/catalogo/concept"],
  ["PUT", "/catalogo/element"],
  ["DELETE", "/catalogo/element"],
  ["PUT", "/note/giorno"],
  ["PUT", "/note/assetto"],
  ["DELETE", "/note/assetto"],
  ["GET", "/lab/arc"],
  ["GET", "/run/natura"],
  ["GET", "/backfill"],
  ["GET", "/regen-day"],
  ["GET", "/run-all"],
  ["GET", "/test-metrics"],
  ["GET", "/test-size"],
];

describe("rotte protette: senza chiave → 403", () => {
  it.each(ROTTE_PROTETTE)("%s %s rifiuta senza ?key=/x-artipop-key", async (method, path) => {
    const env = makeEnv();
    const res = await callWorker(env, path, { method });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

describe("GET/PUT /tuning: caso felice autorizzato", () => {
  it("GET /tuning (pubblica) risponde 200 con concept/default/element", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/tuning", { method: "GET" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.concepts).toBe("object");
    expect(typeof body.defaults).toBe("object");
    expect(Array.isArray(body.elements)).toBe(true);
  });

  it("PUT /tuning con body valido e chiave corretta nell'header → 200", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/tuning", {
      method: "PUT",
      headers: { "x-artipop-key": env.ADMIN_KEY },
      body: JSON.stringify({ profili: { crescita: { estensione: [10, 50] } } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("senza ADMIN_KEY configurato: le rotte protette restano chiuse", () => {
  it("PUT /tuning rifiuta comunque, anche fornendo una chiave qualsiasi", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    const res = await callWorker(env, "/tuning?key=qualsiasi-valore", { method: "PUT" });
    expect(res.status).toBe(403);
  });

  it("GET /run/natura rifiuta comunque, anche fornendo una chiave qualsiasi", async () => {
    const env = makeEnv({ ADMIN_KEY: undefined });
    const res = await callWorker(env, "/run/natura?key=qualsiasi-valore", { method: "GET" });
    expect(res.status).toBe(403);
  });
});
