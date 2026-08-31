// Protegge inventa.js: l'invenzione del concept settimanale via LLM.
//
// Il contratto più importante del modulo è DOPPIO:
//   1. l'element inventato nasce con `tappe: null` (eredita quelle della
//      famiglia, vedi il ragionamento sui range tarati in testa al modulo) e
//      finisce nel catalogo come un element qualunque — pescabile da
//      poolForWith e materializzabile da resolveConcept;
//   2. NIENTE funzione lancia MAI: qualunque guasto (modello giù, risposta
//      illeggibile, catalogo che rifiuta) vale null e il chiamante ripiega
//      sulla pesca dalla libreria fissa.
//
// Stile della casa: nessun mock di modulo. L'env parte da makeEnv (fakeEnv.js)
// con il binding AI SOVRASCRITTO — l'AI dell'helper lancia apposta, quindi il
// caso "modello irraggiungibile" viene gratis; per gli altri casi si passa un
// AI finto come oggetto letterale, esattamente come si fa con il catalogo.
import { describe, it, expect, vi } from "vitest";
import {
  famigliaDelTurno,
  idInventato,
  esempiPerFamiglia,
  costruisciPrompt,
  interpretaRisposta,
  normalizzaElement,
  nomiRecenti,
  inventaElement,
} from "../../src/inventa.js";
import { CONFIG, FAMIGLIE_SOSPESE } from "../../src/config.js";
import { FAMILIES } from "../../src/families.js";
import { ELEMENTS } from "../../src/concepts.js";
import { loadCatalog, poolForWith } from "../../src/catalog.js";
import { LIMITI_ELEMENT } from "../../src/validazione.js";
import { makeEnv } from "../helpers/fakeEnv.js";

// Stessa regex del contratto di catalogo (catalog.js, ID_RE): qui serve per
// ASSERIRE, non per validare — la validazione vera resta in saveElement.
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;

const CANALE_NATURA = { id: "natura", famiglie: ["crescita", "costruzione"] };
const ADESSO = "2026-08-31T06:00:00.000Z";
const CATALOGO_VUOTO = { concepts: {}, elements: {} };

// Risposta "buona" di un modello che ha capito il compito: tutti i sei campi
// richiesti, con il setting che contiene gli immutabili della famiglia crescita.
const RISPOSTA_BUONA = {
  nome: "Bollitore di rame",
  s: "the copper kettle",
  soggetto: "a copper kettle",
  setting:
    "a small copper kettle on a bare wooden surface against a smooth plain warm-cream wall, " +
    "soft window light from the left, the surface completely empty around it",
  style: "cozy interior still-life photography, warm soft window light",
  palette: "copper, warm wood and cream",
};

/** AI finto che risponde sempre lo stesso JSON e registra le chiamate. */
function aiCheRisponde(json, registra = []) {
  return {
    run: async (modello, params) => {
      registra.push({ modello, params });
      return { response: JSON.stringify(json) };
    },
  };
}

/* ===================== famigliaDelTurno ===================== */

describe("famigliaDelTurno", () => {
  it("alterna le due famiglie del canale al crescere di arcIndex", () => {
    expect(famigliaDelTurno(CANALE_NATURA, 0)).toBe("crescita");
    expect(famigliaDelTurno(CANALE_NATURA, 1)).toBe("costruzione");
    expect(famigliaDelTurno(CANALE_NATURA, 2)).toBe("crescita");
    expect(famigliaDelTurno(CANALE_NATURA, 3)).toBe("costruzione");
  });

  it("salta le famiglie sospese", () => {
    FAMIGLIE_SOSPESE.push("crescita");
    try {
      // Con crescita sospesa resta solo costruzione: ogni arco cade su di lei.
      expect(famigliaDelTurno(CANALE_NATURA, 0)).toBe("costruzione");
      expect(famigliaDelTurno(CANALE_NATURA, 1)).toBe("costruzione");
    } finally {
      FAMIGLIE_SOSPESE.pop(); // mai inquinare il modulo condiviso per gli altri test
    }
  });

  it("se il filtro svuota la lista, ripiega sulla prima famiglia del canale (meglio una sospesa che nessuna)", () => {
    const canale = { id: "natura", famiglie: ["crescita"] };
    FAMIGLIE_SOSPESE.push("crescita");
    try {
      expect(famigliaDelTurno(canale, 5)).toBe("crescita");
    } finally {
      FAMIGLIE_SOSPESE.pop();
    }
  });

  it("non lancia mai, nemmeno con un canale corrotto", () => {
    expect(famigliaDelTurno(null, 0)).toBeNull();
    expect(famigliaDelTurno({}, 0)).toBeNull();
    expect(famigliaDelTurno({ id: "x", famiglie: [] }, 0)).toBeNull();
    expect(famigliaDelTurno({ id: "x", famiglie: "non-una-lista" }, 0)).toBeNull();
  });
});

/* ===================== idInventato ===================== */

describe("idInventato", () => {
  it("produce un id gen-<canale>-<arco> che rispetta la regex del catalogo", () => {
    const id = idInventato("natura", 3, CATALOGO_VUOTO);
    expect(id).toBe("gen-natura-3");
    expect(ID_RE.test(id)).toBe(true);
  });

  it("evita le collisioni col catalogo aggiungendo un suffisso -2, -3, …", () => {
    const catalog = { elements: { "gen-natura-0": { id: "gen-natura-0" } } };
    const id = idInventato("natura", 0, catalog);
    expect(id).toBe("gen-natura-0-2");
    expect(ID_RE.test(id)).toBe(true);
  });

  it("ritorna null quando base e tutti i suffissi sono presi (catalogo saturo)", () => {
    const elements = { "gen-natura-0": { id: "gen-natura-0" } };
    for (let n = 2; n <= 9; n++) elements[`gen-natura-0-${n}`] = { id: `gen-natura-0-${n}` };
    expect(idInventato("natura", 0, { elements })).toBeNull();
  });

  it("con un catalogo assente o corrotto non lancia e usa il base", () => {
    expect(idInventato("natura", 1, null)).toBe("gen-natura-1");
    expect(idInventato("natura", 1, {})).toBe("gen-natura-1");
  });
});

/* ===================== esempiPerFamiglia ===================== */

describe("esempiPerFamiglia", () => {
  it("ritorna due element built-in della famiglia richiesta", () => {
    const esempi = esempiPerFamiglia("crescita", 0, ELEMENTS);
    expect(esempi).toHaveLength(2);
    for (const e of esempi) expect(e.famigliaNativa).toBe("crescita");
    // Sono element veri della libreria, non copie smontate.
    expect(ELEMENTS).toContain(esempi[0]);
    expect(ELEMENTS).toContain(esempi[1]);
  });

  it("la scelta varia con arcIndex ma resta deterministica a parità di arco", () => {
    const arco0 = esempiPerFamiglia("crescita", 0, ELEMENTS);
    const arco1 = esempiPerFamiglia("crescita", 1, ELEMENTS);
    expect(arco1).not.toEqual(arco0); // il few-shot non suggerisce sempre gli stessi due
    expect(esempiPerFamiglia("crescita", 0, ELEMENTS)).toEqual(arco0); // e non è casuale
  });

  it("con meno di due element ritorna quelli che ci sono; famiglia vuota → array vuoto", () => {
    const unico = [{ id: "solo", famigliaNativa: "fam-x" }];
    expect(esempiPerFamiglia("fam-x", 4, [unico[0]])).toEqual([unico[0]]);
    expect(esempiPerFamiglia("fam-sconosciuta", 4, ELEMENTS)).toEqual([]);
    expect(esempiPerFamiglia("crescita", 0, null)).toEqual([]);
  });
});

/* ===================== costruisciPrompt ===================== */

describe("costruisciPrompt", () => {
  it("deriva il copione dalla famiglia: contiene la tappa 0, la conserva, i setting degli esempi e le voci da evitare", () => {
    const famiglia = FAMILIES.crescita;
    const esempi = esempiPerFamiglia("crescita", 0, ELEMENTS);
    const daEvitare = ["Girasole", "Tulipano a pois"];
    const { system, user } = costruisciPrompt({ famiglia, esempi, daEvitare });

    // Il copione fisso è il testo VERO della famiglia, non una parafrasi.
    expect(user).toContain(famiglia.tappe[0].join(". "));
    expect(user).toContain(famiglia.conserva);
    // Gli esempi entrano come JSON completi: il loro setting è nel testo.
    for (const e of esempi) expect(user).toContain(e.setting);
    // Ogni voce da evitare, una per riga.
    for (const n of daEvitare) expect(user).toContain(n);
    // Le chiavi esatte richieste sono dette nel system.
    for (const k of ["nome", "s", "soggetto", "setting", "style", "palette"]) {
      expect(system).toContain(k);
    }
  });

  it("senza voci da evitare omette il blocco, senza rompere il resto", () => {
    const { user } = costruisciPrompt({ famiglia: FAMILIES.crescita, esempi: [], daEvitare: [] });
    expect(user).toContain(FAMILIES.crescita.tappe[0].join(". "));
    expect(user).not.toContain("already been used");
  });

  it("funziona con QUALSIASI famiglia: nessun nome scritto a mano nel codice", () => {
    // La regola fondamentale: il prompt si deriva dai dati. Si prova con una
    // famiglia "diversa da crescifica" e il copione segue i suoi dati.
    const famiglia = { id: "futuro", conserva: "the horizon", tappe: [["an empty stage"]] };
    const { user } = costruisciPrompt({ famiglia, esempi: [], daEvitare: [] });
    expect(user).toContain("an empty stage");
    expect(user).toContain("the horizon");
  });
});

/* ===================== interpretaRisposta ===================== */

describe("interpretaRisposta", () => {
  const buono = { nome: "Lampada", s: "the brass lamp", soggetto: "a brass lamp" };

  it("accetta JSON nudo", () => {
    expect(interpretaRisposta(JSON.stringify(buono))).toEqual(buono);
  });

  it("accetta JSON dentro un fence ```json", () => {
    const testo = "```json\n" + JSON.stringify(buono) + "\n```";
    expect(interpretaRisposta(testo)).toEqual(buono);
  });

  it("accetta JSON con chiacchiere prima e dopo (prima graffa → ultima graffa)", () => {
    const testo = "Certo! Ecco il soggetto richiesto:\n" + JSON.stringify(buono) + "\nSpero vada bene, fammi sapere.";
    expect(interpretaRisposta(testo)).toEqual(buono);
  });

  it("accetta un oggetto già pronto invece di una stringa", () => {
    const oggetto = { ...buono };
    expect(interpretaRisposta(oggetto)).toBe(oggetto);
  });

  it("spazzatura, stringa vuota e null diventano null, mai un lancio", () => {
    expect(interpretaRisposta("bla bla {questo non è json} bla bla")).toBeNull();
    expect(interpretaRisposta("")).toBeNull();
    expect(interpretaRisposta("   ")).toBeNull();
    expect(interpretaRisposta(null)).toBeNull();
    expect(interpretaRisposta(undefined)).toBeNull();
    expect(interpretaRisposta(42)).toBeNull();
  });
});

/* ===================== normalizzaElement ===================== */

describe("normalizzaElement", () => {
  const grezzoBuono = {
    nome: "Bollitore di rame",
    s: "the copper kettle",
    soggetto: "a copper kettle",
    setting: "a small copper kettle on a bare wooden surface",
    style: "cozy still-life, warm light",
    palette: "copper, wood, cream",
  };
  const meta = { id: "gen-natura-0", famigliaNativa: "crescita", canale: "natura", creatoIl: ADESSO };

  it("taglia ogni campo alla lunghezza massima del contratto di saveElement e fa il trim", () => {
    const lungo = {
      ...grezzoBuono,
      nome: "  " + "N".repeat(100) + "  ",
      setting: "s".repeat(500),
      s: "x".repeat(300),
    };
    const corpo = normalizzaElement(lungo, meta);
    expect(corpo.nome).toHaveLength(LIMITI_ELEMENT.nome);
    expect(corpo.setting).toHaveLength(LIMITI_ELEMENT.setting);
    expect(corpo.s).toHaveLength(LIMITI_ELEMENT.s);
    expect(corpo.nome.startsWith("N")).toBe(true); // il trim è avvenuto prima del taglio
  });

  it("rifiuta campi mancanti o vuoti dopo il trim", () => {
    expect(normalizzaElement({ ...grezzoBuono, nome: "   " }, meta)).toBeNull();
    expect(normalizzaElement({ ...grezzoBuono, s: undefined }, meta)).toBeNull();
    expect(normalizzaElement({ ...grezzoBuono, palette: "" }, meta)).toBeNull();
    expect(normalizzaElement({ nome: "solo un campo" }, meta)).toBeNull();
    expect(normalizzaElement({}, meta)).toBeNull();
    expect(normalizzaElement(null, meta)).toBeNull();
    expect(normalizzaElement("una stringa", meta)).toBeNull();
  });

  it("mette sempre i campi fissi del contratto: tappe ereditate, roba della macchina, creazione protetta", () => {
    const corpo = normalizzaElement(grezzoBuono, meta);
    expect(corpo).toMatchObject({
      id: "gen-natura-0",
      famigliaNativa: "crescita",
      canale: "natura",
      creatoIl: ADESSO,
      tappe: null, // le tappe NON si inventano: si ereditano dalla famiglia
      extra: null,
      pubblicato: true,
      auto: true,
      soloSeNuovo: true,
    });
  });
});

/* ===================== nomiRecenti ===================== */

describe("nomiRecenti", () => {
  it("unisce i nomi degli usati (custom e built-in) e quelli degli element auto del canale, senza duplicati", () => {
    const catalog = {
      concepts: {},
      elements: {
        "gen-natura-1": { id: "gen-natura-1", nome: "Lampada", auto: true, canale: "natura" },
        // Stesso nome di un built-in usato di recente: il duplicato sparisce.
        "gen-natura-3": { id: "gen-natura-3", nome: "Girasole", auto: true, canale: "natura" },
        "gen-citta-9": { id: "gen-citta-9", nome: "Torre", auto: true, canale: "citta" },
        manuale: { id: "manuale", nome: "Fatto a mano", auto: false, canale: "natura" },
      },
    };
    const prevState = { usati: ["gen-natura-1", "girasole", "id-mai-esistito"] };

    const nomi = nomiRecenti(prevState, catalog, CANALE_NATURA);

    expect(nomi).toContain("Lampada"); // usato di recente, custom → nome dal catalogo
    expect(nomi).toContain("Girasole"); // usato di recente, built-in → nome dalla libreria
    expect(nomi.filter((n) => n === "Girasole")).toHaveLength(1); // senza duplicati
    expect(nomi).not.toContain("Torre"); // auto ma su un altro canale
    expect(nomi).not.toContain("Fatto a mano"); // scritto a mano: non è roba della macchina
  });

  it("con input vuoti o corrotti ritorna array vuoto senza lanciare", () => {
    expect(nomiRecenti(null, null, null)).toEqual([]);
    expect(nomiRecenti({}, {}, {})).toEqual([]);
    expect(nomiRecenti({ usati: "non-una-lista" }, null, null)).toEqual([]);
    expect(nomiRecenti({ usati: [null, 42, {}] }, CATALOGO_VUOTO, CANALE_NATURA)).toEqual([]);
  });
});

/* ===================== inventaElement (l'unica con la rete) ===================== */

describe("inventaElement", () => {
  it("con una risposta buona scrive nel catalogo e l'element è poi pescabile da poolForWith con le tappe della famiglia", async () => {
    const chiamate = [];
    const env = makeEnv({ AI: aiCheRisponde(RISPOSTA_BUONA, chiamate) });

    const esito = await inventaElement(env, CANALE_NATURA, {
      catalog: CATALOGO_VUOTO,
      arcIndex: 0,
      daEvitare: ["Girasole"],
      adesso: ADESSO,
    });

    expect(esito).toEqual({ id: "gen-natura-0", nome: "Bollitore di rame" });

    // La chiamata al modello: primario, due messaggi, tetto di token.
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0].modello).toBe(CONFIG.TEXT_MODEL_PRIMARY);
    expect(chiamate[0].params.max_tokens).toBe(700);
    expect(chiamate[0].params.messages[0].role).toBe("system");
    expect(chiamate[0].params.messages[1].role).toBe("user");
    // I nomi da evitare sono arrivati nel prompt.
    expect(chiamate[0].params.messages[1].content).toContain("Girasole");

    // Scritto nel catalogo come roba della macchina, pubblicato sul canale.
    const cat = await loadCatalog(env);
    const salvato = cat.elements["gen-natura-0"];
    expect(salvato).toBeDefined();
    expect(salvato.auto).toBe(true);
    expect(salvato.pubblicato).toBe(true);
    expect(salvato.canale).toBe("natura");
    expect(salvato.creatoIl).toBe(ADESSO);
    expect(salvato.tappe).toBeNull();

    // E ora la prova sul fatto: il pool di produzione lo trova, materializzato
    // con le TAPPE DELLA FAMIGLIA ({s} risolto col soggetto inventato) — è la
    // proprietà che tiene validi i range tarati a mano.
    const pool = poolForWith(CANALE_NATURA, cat);
    const nelPool = pool.find((c) => c.id === "gen-natura-0");
    expect(nelPool).toBeDefined();
    expect(nelPool.famiglia.id).toBe("crescita");
    expect(nelPool.s).toBe("the copper kettle");
    const attese = FAMILIES.crescita.tappe.map((frasi) =>
      frasi.map((f) => f.replaceAll("{s}", "the copper kettle"))
    );
    expect(nelPool.tappe).toEqual(attese);
  });

  it("con un AI che lancia ritorna null, non scrive nulla e non lascia trapelare l'eccezione", async () => {
    const env = makeEnv(); // l'AI dell'helper lancia apposta a ogni run
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const esito = await inventaElement(env, CANALE_NATURA, {
      catalog: CATALOGO_VUOTO,
      arcIndex: 0,
      adesso: ADESSO,
    });

    expect(esito).toBeNull();
    expect(await loadCatalog(env)).toEqual(CATALOGO_VUOTO); // nessuna scrittura
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[inventa]"));
    warnSpy.mockRestore();
  });

  it("con una risposta illeggibile esaurisce i tentativi e ritorna null", async () => {
    const chiamate = [];
    const env = makeEnv({
      AI: {
        run: async (modello, params) => {
          chiamate.push({ modello, params });
          return { response: "Ecco cosa ho inventato: una cosa bellissima! Nessun JSON qui dentro." };
        },
      },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const esito = await inventaElement(env, CANALE_NATURA, {
      catalog: CATALOGO_VUOTO,
      arcIndex: 0,
      adesso: ADESSO,
    });

    expect(esito).toBeNull();
    // Entrambi i tentativi previsti dalla configurazione, poi ci si ferma.
    expect(chiamate).toHaveLength(CONFIG.INVENZIONE_MAX_TENTATIVI);
    expect(await loadCatalog(env)).toEqual(CATALOGO_VUOTO);
    warnSpy.mockRestore();
  });

  it("quando il primario fallisce prova il fallback e ci riesce", async () => {
    const chiamate = [];
    const env = makeEnv({
      AI: {
        run: async (modello, params) => {
          chiamate.push({ modello, params });
          if (modello === CONFIG.TEXT_MODEL_PRIMARY) throw new Error("quota primaria finita");
          return { response: JSON.stringify(RISPOSTA_BUONA) };
        },
      },
    });

    const esito = await inventaElement(env, CANALE_NATURA, {
      catalog: CATALOGO_VUOTO,
      arcIndex: 0,
      adesso: ADESSO,
    });

    expect(esito).toEqual({ id: "gen-natura-0", nome: "Bollitore di rame" });
    expect(chiamate.map((c) => c.modello)).toEqual([
      CONFIG.TEXT_MODEL_PRIMARY,
      CONFIG.TEXT_MODEL_FALLBACK,
    ]);
    const cat = await loadCatalog(env);
    expect(cat.elements["gen-natura-0"]).toBeDefined();
  });

  it("se saveElement rifiuta (id collisione scoperta dopo) logga gli errori, esaurisce i tentativi e ritorna null", async () => {
    // Il catalogo passato è vuoto, ma in KV esiste GIA' l'id che idInventato
    // sta per scegliere: simula la corsa fra due invenzioni quasi simultanee.
    // saveElement con soloSeNuovo:true deve rifiutare, e l'invenzione deve
    // ripiegare senza scrivere nulla.
    const env = makeEnv({ AI: aiCheRisponde(RISPOSTA_BUONA) });
    await env.KV.put(
      "catalogo:custom",
      JSON.stringify({ version: 1, concepts: {}, elements: { "gen-natura-0": { id: "gen-natura-0" } } })
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const esito = await inventaElement(env, CANALE_NATURA, {
      catalog: CATALOGO_VUOTO,
      arcIndex: 0,
      adesso: ADESSO,
    });

    expect(esito).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("saveElement ha rifiutato"));
    const cat = await loadCatalog(env);
    // L'element preesistente non è stato sovrascritto dalla macchina.
    expect(Object.keys(cat.elements)).toEqual(["gen-natura-0"]);
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
