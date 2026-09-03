// ELEMENT AUTO-GENERATI: da qui a qualche mese il catalogo (`catalogo:custom`,
// UNA sola chiave KV) verrà riempito anche dalla macchina — un element nuovo
// a settimana per canale. Senza i due campi di questo test (`auto` per
// distinguere la roba della macchina da quella scritta a mano, `creatoIl` per
// decidere chi è il più vecchio) e senza potaGenerati(), quella chiave
// crescerebbe all'infinito e non ci sarebbe modo di sapere cosa si può
// toccare. Il rischio silenzioso che questo file chiude: una coercizione
// lassa di `auto` (la stringa "false" che diventa true) classificherebbe un
// element MANUALE come potabile, e la pota lo cancellerebbe dietro le spalle
// all'utente — per questo `auto` accetta solo booleani veri, come `pubblicato`.
import { describe, it, expect, vi } from "vitest";
import { makeEnv, makeKV, kvChePerdeLeScritture, callWorker } from "../helpers/fakeEnv.js";
import { saveElement, potaGenerati, loadCatalog } from "../../src/catalog.js";

// Corpo valido per saveElement, stessa forma richiesta dalla rotta
// PUT /catalogo/element (vedi catalogo-sospesi.test.js): famigliaNativa
// built-in esistente, canale valido.
function element(id, overrides = {}) {
  return {
    id,
    nome: "Element di prova",
    s: "un soggetto di prova",
    setting: "un contesto di prova",
    style: "uno stile di prova",
    palette: "una palette di prova",
    famigliaNativa: "crescita",
    pubblicato: true,
    canale: "natura",
    ...overrides,
  };
}

describe("saveElement: campi auto e creatoIl", () => {
  it("con auto:true e creatoIl valorizzati li persiste nell'element salvato", async () => {
    const env = makeEnv();
    const res = await saveElement(env, element("auto-a", { auto: true, creatoIl: "2026-08-31T06:00:00.000Z" }));
    expect(res.ok).toBe(true);

    const cat = await loadCatalog(env);
    expect(cat.elements["auto-a"].auto).toBe(true);
    expect(cat.elements["auto-a"].creatoIl).toBe("2026-08-31T06:00:00.000Z");
  });

  it("senza i due campi l'element resta manuale: auto:false e creatoIl:null, senza errori", async () => {
    const env = makeEnv();
    const res = await saveElement(env, element("manuale"));
    expect(res.ok).toBe(true);

    const cat = await loadCatalog(env);
    expect(cat.elements["manuale"].auto).toBe(false);
    expect(cat.elements["manuale"].creatoIl).toBeNull();
  });

  it("un salvataggio manuale sopra un element auto lo riporta a auto:false (l'utente lo adotta)", async () => {
    const env = makeEnv();
    await saveElement(env, element("adottato", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));

    // Il tool di tuning rinvia l'element senza i campi della macchina.
    const res = await saveElement(env, element("adottato", { nome: "Modificato a mano" }));
    expect(res.ok).toBe(true);

    const cat = await loadCatalog(env);
    expect(cat.elements["adottato"].auto).toBe(false);
    expect(cat.elements["adottato"].creatoIl).toBeNull();
    expect(cat.elements["adottato"].nome).toBe("Modificato a mano");
  });

  it("auto di tipo sbagliato (stringa, numero) è errore di validazione e NIENTE finisce in KV", async () => {
    const env = makeEnv();
    const res1 = await saveElement(env, element("auto-str", { auto: "true" }));
    const res2 = await saveElement(env, element("auto-falsa", { auto: "false" }));
    const res3 = await saveElement(env, element("auto-num", { auto: 1 }));

    for (const res of [res1, res2, res3]) {
      expect(res.ok).toBe(false);
      expect(res.errori.some((e) => e.startsWith("auto:"))).toBe(true);
    }
    // Il KV non è stato nemmeno creato: nessun salvataggio parziale.
    expect(await env.KV.get("catalogo:custom")).toBeNull();
  });

  it("creatoIl troppo lungo, vuoto o di tipo sbagliato si salva come null, senza errori", async () => {
    const env = makeEnv();
    const casi = [
      ["cr-lunga", { creatoIl: "x".repeat(41) }], // oltre i 40 caratteri
      ["cr-vuota", { creatoIl: "" }],
      ["cr-num", { creatoIl: 20260831 }],
      ["cr-null", { creatoIl: null }],
    ];
    for (const [id, overrides] of casi) {
      const res = await saveElement(env, element(id, overrides));
      expect(res.ok).toBe(true);
    }

    const cat = await loadCatalog(env);
    for (const [id] of casi) expect(cat.elements[id].creatoIl).toBeNull();
  });
});

describe("potaGenerati", () => {
  it("tiene i più recenti per canale e rimuove i più vecchi; chi non ha creatoIl conta come il più vecchio", async () => {
    const env = makeEnv();
    await saveElement(env, element("n-vecchio", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));
    await saveElement(env, element("n-medio", { auto: true, creatoIl: "2026-08-15T00:00:00.000Z" }));
    await saveElement(env, element("n-nuovo", { auto: true, creatoIl: "2026-08-30T00:00:00.000Z" }));
    await saveElement(env, element("n-senza-data", { auto: true }));
    // Altro canale: la sua soglia è indipendente, non fa spazio ai grandi.
    await saveElement(env, element("c-unico", { canale: "citta", auto: true, creatoIl: "2026-08-10T00:00:00.000Z" }));

    const rimossi = await potaGenerati(env, { tieni: 2 });

    expect(rimossi.sort()).toEqual(["n-senza-data", "n-vecchio"]);
    const cat = await loadCatalog(env);
    expect(cat.elements["n-medio"]).toBeDefined();
    expect(cat.elements["n-nuovo"]).toBeDefined();
    expect(cat.elements["c-unico"]).toBeDefined();
  });

  it("non tocca gli element manuali (auto:false), nemmeno pubblicati sugli stessi canali", async () => {
    const env = makeEnv();
    await saveElement(env, element("m-uno"));
    await saveElement(env, element("m-due", { creatoIl: "2026-07-01T00:00:00.000Z" })); // manuale con data: comunque intoccabile
    await saveElement(env, element("a-uno", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));

    const rimossi = await potaGenerati(env, { tieni: 1 });

    expect(rimossi).toEqual([]); // un solo element auto, dentro soglia
    const cat = await loadCatalog(env);
    expect(cat.elements["m-uno"]).toBeDefined();
    expect(cat.elements["m-due"]).toBeDefined();
    expect(cat.elements["a-uno"]).toBeDefined();
  });

  it("rispetta protetti: un id protetto sopravvive anche quando sarebbe tra i più vecchi", async () => {
    const env = makeEnv();
    await saveElement(env, element("in-arco", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));
    await saveElement(env, element("libero", { auto: true, creatoIl: "2026-08-02T00:00:00.000Z" }));
    await saveElement(env, element("fresco", { auto: true, creatoIl: "2026-08-30T00:00:00.000Z" }));

    const rimossi = await potaGenerati(env, { tieni: 1, protetti: ["in-arco"] });

    // Con tieni:1 resterebbe solo "fresco": i due più vecchi sono candidati,
    // ma "in-arco" è protetto (un arco in corso lo sta usando) e si rimuove
    // solo l'altro. La potatura degli altri non si blocca per il protetto.
    expect(rimossi).toEqual(["libero"]);
    const cat = await loadCatalog(env);
    expect(cat.elements["in-arco"]).toBeDefined();
    expect(cat.elements["fresco"]).toBeDefined();
  });

  it("non scrive affatto in KV quando non c'è nulla da potare", async () => {
    const kv = makeKV();
    let scritture = 0;
    const putOriginale = kv.put.bind(kv);
    kv.put = async (...args) => {
      scritture += 1;
      return putOriginale(...args);
    };
    const env = makeEnv({ KV: kv });

    await saveElement(env, element("m-uno")); // manuale: non potabile
    await saveElement(env, element("a-uno", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));
    await saveElement(env, element("a-due", { auto: true, creatoIl: "2026-08-02T00:00:00.000Z" }));
    scritture = 0; // il salvataggio di semina non conta: qui si conta solo la potatura

    const rimossi = await potaGenerati(env, { tieni: 3 });

    expect(rimossi).toEqual([]);
    expect(scritture).toBe(0);
  });

  it("non lancia se il KV rifiuta la scrittura: logga l'errore e torna array vuoto", async () => {
    const kv = makeKV();
    const env = makeEnv({ KV: kv });
    await saveElement(env, element("k-vecchio", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));
    await saveElement(env, element("k-nuovo", { auto: true, creatoIl: "2026-08-02T00:00:00.000Z" }));

    // Stesso KV, ma le scritture da qui in poi falliscono: la potatura C'è
    // (tieni:1 con due element auto) e il put deve poter esplodere senza
    // portare giù il chiamante.
    const envRotto = { ...env, KV: kvChePerdeLeScritture(kv) };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(potaGenerati(envRotto, { tieni: 1 })).resolves.toEqual([]);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[catalog] potaGenerati"));

    errSpy.mockRestore();
  });

  it("con una soglia tieni assurda non pota nulla invece di cancellare tutto", async () => {
    const env = makeEnv();
    await saveElement(env, element("a-uno", { auto: true, creatoIl: "2026-08-01T00:00:00.000Z" }));

    // undefined/NaN come soglia farebbe di slice() un "tieni zero" silenzioso:
    // meglio annullare la potatura che svuotare il catalogo per un bug a monte.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await potaGenerati(env, {})).toEqual([]);
    expect((await loadCatalog(env)).elements["a-uno"]).toBeDefined();
    errSpy.mockRestore();
  });
});

describe("GET /catalogo: campo auto su ogni element (integrazione)", () => {
  it("i built-in portano auto:false e un element custom auto:true lo riporta, booleano ovunque", async () => {
    const env = makeEnv();
    const put = await callWorker(env, "/catalogo/element", {
      method: "PUT",
      headers: { "x-artipop-key": env.ADMIN_KEY, "content-type": "application/json" },
      body: JSON.stringify(element("auto-int", { auto: true, creatoIl: "2026-08-31T06:00:00.000Z" })),
    });
    expect(put.status).toBe(200);

    const res = await callWorker(env, "/catalogo");
    expect(res.status).toBe(200);
    const body = await res.json();

    // Ogni element porta il campo, come già fa `sospeso`: il tuning tool non
    // deve dover difendersi dall'assenza per capire se è roba della macchina.
    for (const e of body.elements) expect(typeof e.auto).toBe("boolean");

    expect(body.elements.find((e) => e.id === "auto-int").auto).toBe(true);
    expect(body.elements.find((e) => e.custom === false).auto).toBe(false);
  });
});
