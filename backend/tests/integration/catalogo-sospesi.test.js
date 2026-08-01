// ciclo 29 (POLISH): GET /catalogo deve dire la verità sugli element/concept
// sospesi (ELEMENT_SOSPESI/FAMIGLIE_SOSPESE, config.js) — prima di questa
// modifica il tuning tool mostrava "canoa" come una voce pescabile qualsiasi,
// col badge "pubblicato", pur essendo già esclusa dai pool (poolForWith,
// catalog.js). Verifica sia il risultato concreto (canoa) sia il meccanismo
// generico (famigliaNativa sospesa su un element custom, senza cablare l'id).
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";

describe("GET /catalogo: campo sospeso", () => {
  it("l'element 'canoa' ha sospeso:true, un altro built-in ha sospeso:false, il campo è booleano ovunque", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/catalogo");
    expect(res.status).toBe(200);
    const body = await res.json();

    const canoa = body.elements.find((e) => e.id === "canoa");
    expect(canoa).toBeDefined();
    expect(canoa.sospeso).toBe(true);

    const nonSospeso = body.elements.find((e) => e.id !== "canoa" && e.sospeso === false);
    expect(nonSospeso).toBeDefined();

    for (const c of body.concepts) expect(typeof c.sospeso).toBe("boolean");
    for (const e of body.elements) expect(typeof e.sospeso).toBe("boolean");
  });
});

describe("GET /catalogo: meccanismo generico, non cablato sul solo id 'canoa'", () => {
  // Stesso schema di element-sospesi.test.js (d): mocka ELEMENT_SOSPESI e
  // FAMIGLIE_SOSPESE, così un element custom con famigliaNativa sospesa
  // risulta sospeso:true anche se il suo id non compare in ELEMENT_SOSPESI.
  let workerMockato;

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../src/config.js", async () => {
      const vero = await vi.importActual("../../src/config.js");
      return { ...vero, ELEMENT_SOSPESI: [], FAMIGLIE_SOSPESE: ["attraversamento"] };
    });
    ({ default: workerMockato } = await import("../../src/index.js"));
  });

  afterAll(() => {
    vi.doUnmock("../../src/config.js");
    vi.resetModules();
  });

  it("un element custom con famigliaNativa in FAMIGLIE_SOSPESE è sospeso:true pur non essendo in ELEMENT_SOSPESI", async () => {
    const env = makeEnv();
    const ctxFittizio = { waitUntil() {} };
    const putRes = await workerMockato.fetch(
      new Request("https://artipop.test/catalogo/element", {
        method: "PUT",
        headers: { "x-artipop-key": env.ADMIN_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          id: "test-sospeso-mock",
          nome: "Test sospeso mock",
          s: "un soggetto qualsiasi",
          setting: "un contesto qualsiasi",
          style: "uno stile qualsiasi",
          palette: "una palette qualsiasi",
          famigliaNativa: "attraversamento",
          pubblicato: false,
        }),
      }),
      env,
      ctxFittizio,
    );
    expect(putRes.status).toBe(200);

    const res = await workerMockato.fetch(new Request("https://artipop.test/catalogo"), env, ctxFittizio);
    expect(res.status).toBe(200);
    const body = await res.json();

    const custom = body.elements.find((e) => e.id === "test-sospeso-mock");
    expect(custom).toBeDefined();
    expect(custom.sospeso).toBe(true);
  });
});
