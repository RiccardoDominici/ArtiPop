// L'INNESTO dell'invenzione in runChannel (src/handlers.js): quando la
// previsione di serveConceptNuovo (story.js) dice che stanotte si apre un arco
// nuovo, il giorno di produzione tenta di INVENTARE il concept (inventa.js)
// prima di far avanzare la storia; se l'invenzione fallisce, la pesca dalla
// libreria built-in deve restare intoccata come ripiego.
//
// Il problema che questo file previene: un guasto del modello di TESTO che si
// trasformasse in un giorno perso (500 su /run, flusso bloccato), oppure — al
// contrario — un innesco dell'invenzione nei giorni in cui non serve (giorno
// normale, rigenerazione ?force=1 della stessa data), che brucerebbe chiamate
// AI e popolerebbe il catalogo di element inutili. Copre anche il contratto
// del profilo di collaudo: il giorno nato da un element inventato va
// collaudato col profilo della FAMIGLIA (più l'override di tuning), non con
// uno inventato.
//
// Zero generazioni reali: il binding AI è finto e sa distinguere i modelli di
// TESTO (TEXT_MODEL_PRIMARY/FALLBACK di config.js, quelli dell'invenzione)
// dai modelli IMMAGINE — i primi falliscono o rispondono col JSON del soggetto,
// i secondi restituiscono sempre byte riconosciuti come PNG. Il catalogo,
// lo stato e le carte d'identità si leggono dal fake KV (fakeEnv.js).
import { describe, it, expect } from "vitest";
import { todayKey } from "../../src/story.js";
import { CONFIG } from "../../src/config.js";
import { getElement } from "../../src/concepts.js";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { pngGrigioUniforme, stubImagesConPng } from "../helpers/pngFinto.js";

// Stessa aritmetica di dayNumberOf (privata in story.js): serve solo per
// seminare stati con `dayNumber` coerenti con la data di ieri/oggi.
function dayNumberOf(data) {
  return Math.floor(Date.parse(data + "T00:00:00Z") / 86400000);
}

const MODELLI_TESTO = [CONFIG.TEXT_MODEL_PRIMARY, CONFIG.TEXT_MODEL_FALLBACK];
const eModelloDiTesto = (m) => MODELLI_TESTO.includes(m);

// Byte riconosciuti da normalizeImageOutput (generate.js) come PNG senza altro
// parsing: ciò che il fake AI risponde per i modelli immagine.
const BYTE_IMMAGINE = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

// La risposta JSON che un modello di testo ben educato produrrebbe: tutti e sei
// i campi obbligatori del contratto di inventa.js (normalizzaElement li esige).
const SOGGETTO_INVENTATO = {
  nome: "Cristallo",
  s: "the glowing crystal",
  soggetto: "crystal",
  setting: "a quiet cave with a glowing crystal on a flat stone pedestal, soft dawn light",
  style: "soft painterly digital art, gentle volumetric light",
  palette: "deep teal, warm amber, soft cream",
};

/**
 * Il binding AI finto del test: registra ogni chiamata per modello, lancia sui
 * modelli di TESTO (a meno che `rispostaTesto` non dia la risposta JSON) e
 * risponde con byte immagine finti su qualunque altro modello.
 */
function aiFinta(chiamate, { rispostaTesto = null } = {}) {
  return {
    async run(modello) {
      chiamate.push(modello);
      if (eModelloDiTesto(modello)) {
        if (rispostaTesto === null) throw new Error("modello di testo non disponibile (simulato)");
        return { response: JSON.stringify(rispostaTesto) };
      }
      return BYTE_IMMAGINE;
    },
  };
}

function envCon(chiamate, opzioni = {}) {
  return makeEnv({
    AI: aiFinta(chiamate, opzioni),
    IMAGES: stubImagesConPng(pngGrigioUniforme(48, 96, 200)),
  });
}

// Stato di un arco al suo ultimo giorno (dayInArc 6): se la data avanza,
// domani c'è rollover e l'invenzione serve; se la data NON avanza, no.
function statoUltimoGiorno(ieri, arcIndex = 0) {
  return {
    conceptId: "girasole",
    lastDate: ieri,
    dayInArc: 6,
    arcIndex,
    usati: ["girasole"],
  };
}

describe("rollover d'arco con l'invenzione che fallisce", () => {
  it("il giorno si completa comunque: concept pescato dalla libreria built-in, catalogo custom vuoto", async () => {
    const chiamate = [];
    const env = envCon(chiamate); // nessuna rispostaTesto: i modelli di testo lanciano
    const oggi = todayKey();
    const ieri = todayKey(new Date(Date.now() - 86400000));
    await env.KV.put("state:natura", JSON.stringify(statoUltimoGiorno(ieri)));

    const res = await callWorker(env, "/run/natura", {
      headers: { "x-artipop-key": "chiave-di-test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // L'invenzione è stata TENTATA (i modelli di testo sono stati toccati) ma
    // il run non ne ha risentito: nessun 500, nessuna eccezione esposta.
    expect(chiamate.some(eModelloDiTesto)).toBe(true);
    expect(body.arc).toBe("1/0");
    // Il concept del nuovo arco è un element BUILT-IN: pescato dalla libreria,
    // non qualcosa nato dall'invenzione fallita.
    expect(getElement(body.concept)).toBeDefined();
    // Il catalogo custom resta vuoto: nessun element salvato, nessun residuo.
    expect(await env.KV.get("catalogo:custom", { type: "json" })).toBeNull();
    const stato = JSON.parse(await env.KV.get("state:natura"));
    expect(stato.conceptId).toBe(body.concept);
    expect(stato.arcIndex).toBe(1);
    expect(stato.dayInArc).toBe(0);
  });
});

describe("rollover d'arco con l'invenzione che riesce", () => {
  it("il nuovo arco nasce sull'element inventato, salvato nel catalogo con auto:true e collaudato col profilo della famiglia", async () => {
    const chiamate = [];
    const env = envCon(chiamate, { rispostaTesto: SOGGETTO_INVENTATO });
    const oggi = todayKey();
    const ieri = todayKey(new Date(Date.now() - 86400000));
    await env.KV.put("state:natura", JSON.stringify(statoUltimoGiorno(ieri)));
    // Override di tuning sulla famiglia che toccherà all'arco 1 (con
    // arcIndex precedente 0, prossimoArcIndex dà 1 → costruzione, la seconda
    // delle due famiglie di natura): il giorno deve essere collaudato con
    // QUESTO range, non con uno inventato dal modello di testo.
    await env.KV.put("tuning:profili", JSON.stringify({
      profili: { costruzione: { estensione: [11, 22] } },
    }));

    const res = await callWorker(env, "/run/natura", {
      headers: { "x-artipop-key": "chiave-di-test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.concept).toBe("gen-natura-1");

    // L'element inventato è nel catalogo, marcato come roba della macchina...
    const catalogo = await env.KV.get("catalogo:custom", { type: "json" });
    const inventato = catalogo?.elements?.["gen-natura-1"];
    expect(inventato).toBeDefined();
    expect(inventato.auto).toBe(true);
    expect(inventato.pubblicato).toBe(true);
    expect(inventato.canale).toBe("natura");
    expect(inventato.famigliaNativa).toBe("costruzione");
    expect(inventato.nome).toBe(SOGGETTO_INVENTATO.nome);

    // ...è il conceptId dello stato appena salvato (l'arco è partito su di lui)...
    const stato = JSON.parse(await env.KV.get("state:natura"));
    expect(stato.conceptId).toBe("gen-natura-1");
    expect(stato.arcIndex).toBe(1);
    expect(stato.dayInArc).toBe(0);

    // ...e la carta d'identità del giorno porta il profilo della FAMIGLIA
    // (default di costruzione) fuso con l'override di tuning: nessun profilo
    // inventato, perché le tappe sono quelle della famiglia e i range tarati
    // devono restare validi (vedi il perché in testa a inventa.js).
    const giorno = await env.KV.get(`giorno:natura:${oggi}`, { type: "json" });
    expect(giorno.element).toBe("gen-natura-1");
    expect(giorno.elementNome).toBe(SOGGETTO_INVENTATO.nome);
    expect(giorno.concept).toBe("costruzione");
    expect(giorno.profilo).toEqual({
      estensione: [11, 22],
      intensita: [9, 24],
      compattezza: [0.38, 0.82],
      monotona: true,
      maxDeriva: null,
      maxDegrado: null,
    });
  });
});

describe("giorno normale, nessun rollover", () => {
  it("il modello di testo non viene chiamato affatto: solo l'immagine di oggi", async () => {
    const chiamate = [];
    const env = envCon(chiamate, { rispostaTesto: SOGGETTO_INVENTATO });
    const ieri = todayKey(new Date(Date.now() - 86400000));
    // Arco a metà (dayInArc 2 su 7): nessun rollover, nessun orfano — il
    // blocco d'invenzione non deve nemmeno attivarsi, e la risposta del
    // modello di testo (che qui ci sarebbe, se fosse stato chiamato) deve
    // rimanere inutilizzata.
    await env.KV.put("state:natura", JSON.stringify({
      conceptId: "girasole",
      lastDate: ieri,
      dayNumber: dayNumberOf(ieri),
      dayInArc: 2,
      arcIndex: 3,
      stage: 2,
      anchorDate: ieri,
      usati: ["girasole"],
    }));

    const res = await callWorker(env, "/run/natura", {
      headers: { "x-artipop-key": "chiave-di-test" },
    });

    expect(res.status).toBe(200);
    expect(chiamate.filter(eModelloDiTesto)).toEqual([]);
    // L'immagine invece è stata generata: almeno un modello immagine toccato.
    expect(chiamate.length).toBeGreaterThan(0);
    const stato = JSON.parse(await env.KV.get("state:natura"));
    expect(stato.conceptId).toBe("girasole");
    expect(stato.dayInArc).toBe(3);
    expect(await env.KV.get("catalogo:custom", { type: "json" })).toBeNull();
  });
});

describe("rigenerazione della stessa data (?force=1)", () => {
  it("non inventa nulla: nessuna chiamata al modello di testo, arco e concept fermi", async () => {
    const chiamate = [];
    const env = envCon(chiamate, { rispostaTesto: SOGGETTO_INVENTATO });
    const oggi = todayKey();
    // Stato all'ULTIMO giorno dell'arco e con lastDate = OGGI: la versione
    // tagliente del caso — se la data avanza anche di un giorno qui si apre
    // un arco nuovo e l'invenzione parte; con elapsed 0 non deve partire.
    await env.KV.put("state:natura", JSON.stringify({
      ...statoUltimoGiorno(oggi, 3),
      dayNumber: dayNumberOf(oggi),
      stage: 6,
      anchorDate: todayKey(new Date(Date.now() - 7 * 86400000)),
    }));

    const res = await callWorker(env, "/run/natura?force=1", {
      headers: { "x-artipop-key": "chiave-di-test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(chiamate.filter(eModelloDiTesto)).toEqual([]);
    expect(body.concept).toBe("girasole");
    expect(body.arc).toBe("3/6");
    expect(await env.KV.get("catalogo:custom", { type: "json" })).toBeNull();
    const stato = JSON.parse(await env.KV.get("state:natura"));
    expect(stato.conceptId).toBe("girasole");
    expect(stato.arcIndex).toBe(3);
    expect(stato.dayInArc).toBe(6);
  });
});
