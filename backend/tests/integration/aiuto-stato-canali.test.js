// feat-l-aiuto-dice-se-il-canale-e-fermo: /aiuto legge lo stesso stato di
// /health (getState + buildFreschezzaState) e lo mostra in cima alla pagina.
// Stesso schema di health-ritardo.test.js: KV preseminato, nessuna scrittura,
// nessuna chiamata AI/IMAGES (stub di makeEnv lanciano se invocati). Una
// lettura KV fallita non deve MAI trasformarsi in un 500: /aiuto è il posto
// dove si arriva quando qualcosa non va.
import { describe, it, expect } from "vitest";
import { ACTIVE_CHANNELS } from "../../src/channels.js";
import { makeEnv, kvChePerdeLeLetture, kvChePerdeLeScritture, callWorker } from "../helpers/fakeEnv.js";

describe("GET /aiuto — stato dei canali", () => {
  it("con stato in KV: 200 text/html, corpo con il blocco di stato", async () => {
    const env = makeEnv();
    const oggi = new Date().toISOString().slice(0, 10);
    await env.KV.put(`state:${ACTIVE_CHANNELS[0].id}`, JSON.stringify({ lastDate: oggi, cancello: null }));

    const res = await callWorker(env, "/aiuto");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("data-stato-canali");
    expect(html).toContain(ACTIVE_CHANNELS[0].name);
  });

  it("con KV.get che lancia: 200 HTML senza il blocco, mai 500, mai JSON, nessun dettaglio tecnico", async () => {
    const env = makeEnv({ KV: kvChePerdeLeLetture() });

    const res = await callWorker(env, "/aiuto");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).not.toContain("data-stato-canali");
    expect(html).not.toContain("KV.get");
    expect(html).not.toContain("Error");
  });

  it("non esegue nessuna scrittura KV (put/delete lanciano) e non tocca AI/IMAGES (stub che lanciano se invocati)", async () => {
    // KV le cui scritture lanciano: se /aiuto provasse a scrivere, la
    // risposta smetterebbe di essere 200. AI/IMAGES sono già gli stub
    // di makeEnv() che lanciano da soli se invocati.
    const env = makeEnv({ KV: kvChePerdeLeScritture() });
    const res = await callWorker(env, "/aiuto");
    expect(res.status).toBe(200);
  });
});
