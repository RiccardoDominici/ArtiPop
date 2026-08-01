// Ciclo "la chiave admin non viaggia più nell'indirizzo": la query string
// finisce nei log di Cloudflare, nella cronologia del browser e nei proxy, non
// è un trasporto sicuro per l'unica credenziale che spende neuroni AI e
// scrive nel KV di produzione. Da qui in poi isAuthorized legge SOLO
// l'header x-artipop-key, salvo l'eccezione esplicita di GET /lab/img (un
// <img src> non può portare header custom). Riusa ROTTE_PROTETTE da
// router-auth.test.js: l'elenco delle rotte non si riscrive a memoria.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { ROTTE_PROTETTE } from "./router-auth.test.js";

describe("chiave corretta ma solo in ?key=: rifiutata su tutte le rotte protette", () => {
  it.each(ROTTE_PROTETTE)("%s %s rifiuta la chiave corretta se arriva solo da ?key=", async (method, path) => {
    const env = makeEnv();
    const res = await callWorker(env, `${path}?key=${env.ADMIN_KEY}`, { method });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("x-artipop-key");
    expect(body.error).not.toContain(env.ADMIN_KEY);
  });
});

describe("chiave corretta nell'header: esegue come prima su rotte rappresentative", () => {
  it("PUT /tuning con chiave nell'header → non 403", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/tuning", {
      method: "PUT",
      headers: { "x-artipop-key": env.ADMIN_KEY },
      body: JSON.stringify({ profili: { crescita: { estensione: [10, 50] } } }),
    });
    expect(res.status).not.toBe(403);
  });

  it("DELETE /catalogo/concept con chiave nell'header → non 403", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/catalogo/concept?id=non-esiste", {
      method: "DELETE",
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });
    expect(res.status).not.toBe(403);
  });

  it("GET /run/natura con chiave nell'header → non 403", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/run/natura", {
      method: "GET",
      headers: { "x-artipop-key": env.ADMIN_KEY },
    });
    expect(res.status).not.toBe(403);
  });
});

describe("GET /lab/img: eccezione ammessa, ?key= continua a funzionare", () => {
  it("con ?key= corretta e run inesistente → 404 (non 403): l'eccezione funziona", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/lab/img?run=run-inesistente&n=0&key=${env.ADMIN_KEY}`);
    expect(res.status).toBe(404);
  });

  it("senza alcuna chiave → 403", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/lab/img?run=qualsiasi&n=0");
    expect(res.status).toBe(403);
  });
});

describe("messaggio del 403 causato da ?key=: forma e contenuto", () => {
  it("è JSON, nomina x-artipop-key e non contiene mai il valore della chiave", async () => {
    const env = makeEnv();
    const res = await callWorker(env, `/tuning?key=${env.ADMIN_KEY}`, { method: "PUT" });
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain("x-artipop-key");
    expect(body.error).not.toContain(env.ADMIN_KEY);
    expect(JSON.stringify(body)).not.toContain(env.ADMIN_KEY);
  });
});
