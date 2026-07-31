// Copre l'orchestrazione di un giorno di produzione (src/handlers.js) e la
// stabilità dell'archivio servito da /w/<flusso>?date= — i due comportamenti
// che il setup pure-logic non poteva toccare perché passano da KV.
import { describe, it, expect } from "vitest";
import { runChannel } from "../../src/handlers.js";
import { todayKey } from "../../src/story.js";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { PLACEHOLDER_PNG_BYTES } from "../../src/placeholder.js";

describe("runChannel: idempotenza", () => {
  it("un giorno già generato torna { skipped: true } e non genera di nuovo", async () => {
    const env = makeEnv();
    const oggi = todayKey();
    // Chiave `state:<canale>` (vedi il layout in testa a src/storage.js):
    // seminarla con lastDate=oggi è lo stesso stato che runChannel scrive dopo
    // una generazione riuscita.
    await env.KV.put("state:natura", JSON.stringify({ lastDate: oggi }));

    // Se lo skip non scattasse prima, runChannel arriverebbe a generateDay →
    // env.AI.run/env.IMAGES.input, che lanciano (vedi fakeEnv.js): il verde di
    // questo test PROVA che non sono mai stati invocati.
    const res = await runChannel(env, "natura");

    expect(res).toEqual({ channel: "natura", date: oggi, skipped: true });
  });
});

describe("/w/<flusso>?date=: byte-stabilità dell'archivio", () => {
  it("due letture della stessa data tornano lo stesso content-type e gli stessi byte", async () => {
    const env = makeEnv();
    const data = "2026-01-15";
    const byteAttesi = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);
    // Chiave `archive:<canale>:<data>` (vedi src/storage.js): l'archivio
    // permanente da cui /w/<flusso>?date= legge quando la data è specificata.
    await env.KV.put(`archive:natura:${data}`, byteAttesi, {
      metadata: { contentType: "image/png", date: data, model: "test" },
    });

    const res1 = await callWorker(env, `/w/natura?date=${data}`);
    const res2 = await callWorker(env, `/w/natura?date=${data}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.headers.get("content-type")).toBe("image/png");
    expect(res2.headers.get("content-type")).toBe("image/png");

    const byte1 = new Uint8Array(await res1.arrayBuffer());
    const byte2 = new Uint8Array(await res2.arrayBuffer());
    expect(byte1).toEqual(byteAttesi);
    expect(byte2).toEqual(byteAttesi);
  });
});

describe("/w/flusso-inesistente", () => {
  it("un flusso che non esiste (né diretto né alias) risponde 404 con byte placeholder, mai JSON", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/w/inventato");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("image/png");

    const testo = await res.clone().text();
    expect(() => JSON.parse(testo)).toThrow();

    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(PLACEHOLDER_PNG_BYTES);
  });
});
