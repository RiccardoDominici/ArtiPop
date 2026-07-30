// Protegge il "cancello" di collaudo: le misure che decidono se un'immagine
// generata rientra nel profilo del suo concept. Le impronte sono costruite a
// mano (nessuna immagine vera, nessun binding Images/KV): array di luminanze
// 48x96 con pattern noti, per cui il risultato atteso si calcola con
// aritmetica semplice invece di essere ricopiato dall'implementazione.
import { describe, it, expect } from "vitest";
import {
  compare,
  verdict,
  classify,
  occupancy,
  formatMeasures,
  encodeFingerprint,
  decodeFingerprint,
} from "../../src/metrics.js";
import { CONFIG } from "../../src/config.js";

const THUMB_W = 48;
const THUMB_H = 96;
const THUMB_N = THUMB_W * THUMB_H; // 4608

function uniform(value) {
  return new Uint8Array(THUMB_N).fill(value);
}

describe("compare", () => {
  it("due impronte identiche non misurano alcun cambiamento", () => {
    const prev = uniform(100);
    const next = uniform(100);
    expect(compare(prev, next)).toEqual({
      estensione: 0,
      intensita: 0,
      compattezza: 0,
      deriva: 0,
      degrado: 0,
    });
  });

  it("cambiamento localizzato e concentrato: estensione/intensita/compattezza/deriva coerenti coi conti a mano", () => {
    // prev uniforme a 100. next: le prime 576 celle (12.5% di 4608) salgono
    // a 180 (+80), il resto resta 100. Con soglia CONFIG.CHANGE_THRESHOLD=10
    // e questi numeri, le celle "cambiate" secondo la soglia sono ESATTAMENTE
    // le 576 modificate (i conti sono scelti apposta per cadere sopra/sotto
    // soglia in modo netto, non per un pelo).
    const K = 576;
    const D = 80;
    const prev = uniform(100);
    const next = uniform(100);
    next.fill(100 + D, 0, K);

    const mNext = 100 + (D * K) / THUMB_N; // media pesata: 110
    const localCambiate = D - (D * K) / THUMB_N; // |next-mNext| sulle celle cambiate: 70
    const localInvariate = (D * K) / THUMB_N; // |next-mNext| sulle celle invariate: 10 (= soglia, non conta)
    expect(localInvariate).toBe(CONFIG.CHANGE_THRESHOLD); // precondizione della fixture: esattamente al bordo

    const m = compare(prev, next);
    expect(m.estensione).toBeCloseTo((K / THUMB_N) * 100, 9); // 12.5%
    expect(m.intensita).toBeCloseTo((localCambiate / 255) * 100, 9);
    expect(m.deriva).toBeCloseTo((Math.abs(mNext - 100) / 255) * 100, 9);
    expect(m.degrado).toBe(0); // prev uniforme → nitidezza di partenza zero

    // Compattezza: il "top 10%" (461 celle) sta interamente dentro le 576
    // cambiate, tutte con lo stesso valore locale: sumTop/sumAll è quindi
    // esattamente la proporzione fra le celle contate in ciascun gruppo.
    const sumAll = K * localCambiate + (THUMB_N - K) * localInvariate;
    const top = Math.round(THUMB_N * 0.1);
    const sumTop = top * localCambiate;
    expect(m.compattezza).toBeCloseTo(sumTop / sumAll, 9);
  });

  it("cambiamento sparso su tutta l'immagine (checkerboard): compattezza bassa, vicina al minimo teorico", () => {
    // prev uniforme a 100. next alterna +20/-20 su OGNI cella: la media resta
    // 100 (nessuna deriva), ma tutte le 4608 celle hanno lo stesso |local|=20
    // sopra soglia: estensione 100%, e la compattezza (sparsa il più
    // possibile) coincide con la sola frazione "top 10%" sul totale, perché
    // con un local uniforme non c'è nessun sottoinsieme più mosso degli altri.
    const prev = uniform(100);
    const next = new Uint8Array(THUMB_N);
    for (let i = 0; i < THUMB_N; i++) next[i] = i % 2 === 0 ? 120 : 80;

    const m = compare(prev, next);
    expect(m.estensione).toBeCloseTo(100, 9);
    expect(m.deriva).toBeCloseTo(0, 9);
    const top = Math.round(THUMB_N * 0.1);
    expect(m.compattezza).toBeCloseTo(top / THUMB_N, 9);
  });

  it("degrado: un'immagine che perde nitidezza rispetto a ieri misura ~100% di perdita", () => {
    // prev ha un pattern a strisce verticali (forte energia nei dettagli fini,
    // sharpness(prev) > 0). next è completamente piatta: sharpness(next) = 0.
    // Con sn=0 il rapporto (sp-sn)/sp vale 1 qualunque sia sp>0: degrado=100%
    // esatto, senza dover calcolare sp a mano.
    const prev = new Uint8Array(THUMB_N);
    for (let y = 0; y < THUMB_H; y++) {
      for (let x = 0; x < THUMB_W; x++) prev[y * THUMB_W + x] = x % 2 === 0 ? 50 : 200;
    }
    const next = uniform(125);

    const m = compare(prev, next);
    expect(m.degrado).toBeCloseTo(100, 9);
  });
});

describe("verdict", () => {
  const profileBase = { estensione: [10, 20], intensita: [10, 20], compattezza: [0.3, 0.7] };

  it("misure tutte dentro i range e sotto le guardie: ok, distanza 0, nessun motivo", () => {
    const m = { estensione: 15, intensita: 15, compattezza: 0.5, deriva: 1, degrado: 2 };
    const v = verdict(m, profileBase);
    expect(v).toEqual({ ok: true, distanza: 0, motivi: [] });
  });

  it("estensione sotto il minimo: motivo 'troppo poca immagine' e distanza normalizzata sull'ampiezza", () => {
    const m = { estensione: 5, intensita: 15, compattezza: 0.5, deriva: 1, degrado: 2 };
    const v = verdict(m, profileBase);
    expect(v.ok).toBe(false);
    expect(v.distanza).toBeCloseTo((10 - 5) / (20 - 10), 9);
    expect(v.motivi[0]).toMatch(/cambia troppo poca immagine/);
  });

  it("estensione sopra il massimo: motivo 'cambia troppa immagine'", () => {
    const m = { estensione: 30, intensita: 15, compattezza: 0.5, deriva: 1, degrado: 2 };
    const v = verdict(m, profileBase);
    expect(v.distanza).toBeCloseTo((30 - 20) / (20 - 10), 9);
    expect(v.motivi[0]).toMatch(/cambia troppa immagine/);
  });

  it("intensita fuori range, sotto e sopra", () => {
    const sotto = verdict({ estensione: 15, intensita: 3, compattezza: 0.5, deriva: 1, degrado: 2 }, profileBase);
    expect(sotto.motivi[0]).toMatch(/cambiamento troppo debole/);
    const sopra = verdict({ estensione: 15, intensita: 40, compattezza: 0.5, deriva: 1, degrado: 2 }, profileBase);
    expect(sopra.motivi[0]).toMatch(/cambiamento troppo brusco/);
  });

  it("compattezza fuori range, sparsa e concentrata", () => {
    const sparsa = verdict({ estensione: 15, intensita: 15, compattezza: 0.1, deriva: 1, degrado: 2 }, profileBase);
    expect(sparsa.motivi[0]).toMatch(/sparso invece che concentrato/);
    const concentrata = verdict({ estensione: 15, intensita: 15, compattezza: 0.9, deriva: 1, degrado: 2 }, profileBase);
    expect(concentrata.motivi[0]).toMatch(/troppo concentrato/);
  });

  it("deriva sopra la guardia di default (CONFIG.MAX_DERIVA) fa scattare il motivo", () => {
    const m = { estensione: 15, intensita: 15, compattezza: 0.5, deriva: CONFIG.MAX_DERIVA + 1, degrado: 2 };
    const v = verdict(m, profileBase);
    expect(v.motivi[0]).toMatch(/cambiata la luce/);
  });

  it("un profilo con maxDeriva più permissivo sposta la soglia della guardia", () => {
    const m = { estensione: 15, intensita: 15, compattezza: 0.5, deriva: CONFIG.MAX_DERIVA + 1, degrado: 2 };
    const v = verdict(m, { ...profileBase, maxDeriva: CONFIG.MAX_DERIVA + 5 });
    expect(v.ok).toBe(true); // la stessa deriva che prima falliva ora rientra
  });

  it("degrado sopra la guardia di default (CONFIG.MAX_DEGRADO) fa scattare il motivo", () => {
    const m = { estensione: 15, intensita: 15, compattezza: 0.5, deriva: 1, degrado: CONFIG.MAX_DEGRADO + 1 };
    const v = verdict(m, profileBase);
    expect(v.motivi[0]).toMatch(/perso dettaglio/);
  });

  it("guardia di direzione (monotona): un arretramento oltre CONFIG.MAX_ARRETRAMENTO fa fallire, uno dentro soglia no", () => {
    const base = { estensione: 15, intensita: 15, compattezza: 0.5, deriva: 1, degrado: 2 };
    const profiloMonotono = { ...profileBase, monotona: true };

    // Esattamente al bordo (< stretto): non scatta.
    const alBordo = verdict({ ...base, avanzamento: -CONFIG.MAX_ARRETRAMENTO }, profiloMonotono);
    expect(alBordo.ok).toBe(true);

    // Oltre il bordo: scatta.
    const oltre = verdict({ ...base, avanzamento: -(CONFIG.MAX_ARRETRAMENTO + 1) }, profiloMonotono);
    expect(oltre.ok).toBe(false);
    expect(oltre.motivi[0]).toMatch(/tornata indietro/);
  });

  it("la guardia di direzione non si applica se il profilo non è monotona", () => {
    const base = { estensione: 15, intensita: 15, compattezza: 0.5, deriva: 1, degrado: 2 };
    const v = verdict({ ...base, avanzamento: -50 }, { ...profileBase, monotona: false });
    expect(v.ok).toBe(true);
  });

  it("più violazioni insieme sommano le rispettive distanze", () => {
    const m = { estensione: 5, intensita: 30, compattezza: 0.5, deriva: 1, degrado: 2 };
    const v = verdict(m, profileBase);
    const attesa = (10 - 5) / 10 + (30 - 20) / 10;
    expect(v.distanza).toBeCloseTo(attesa, 9);
    expect(v.motivi).toHaveLength(2);
  });
});

describe("classify", () => {
  const profile = { estensione: [10, 20], intensita: [10, 20], compattezza: [0.3, 0.7] };

  it("dentro range: ok", () => {
    expect(classify({ estensione: 15, intensita: 15, compattezza: 0.5 }, profile)).toBe("ok");
  });

  it("estensione o intensita sotto il minimo (e nessuna sopra): poco", () => {
    expect(classify({ estensione: 5, intensita: 15, compattezza: 0.5 }, profile)).toBe("poco");
    expect(classify({ estensione: 15, intensita: 5, compattezza: 0.5 }, profile)).toBe("poco");
  });

  it("estensione o intensita sopra il massimo (e nessuna sotto): troppo", () => {
    expect(classify({ estensione: 30, intensita: 15, compattezza: 0.5 }, profile)).toBe("troppo");
    expect(classify({ estensione: 15, intensita: 30, compattezza: 0.5 }, profile)).toBe("troppo");
  });

  it("compattezza fuori range, quantità (estensione/intensita) dentro: forma", () => {
    expect(classify({ estensione: 15, intensita: 15, compattezza: 0.1 }, profile)).toBe("forma");
  });

  it("caso ambiguo: una misura sotto E un'altra sopra insieme non è né 'poco' né 'troppo'", () => {
    // sotto=true (estensione<min) e sopra=true (intensita>max) allo stesso
    // tempo: né 'sotto && !sopra' né 'sopra && !sotto' sono veri, quindi il
    // ramo cade sul controllo di compattezza (qui dentro range → "ok").
    // Comportamento REALE del codice, verificato esplicitamente qui perché
    // non ovvio leggendo solo il commento della funzione.
    const esito = classify({ estensione: 5, intensita: 30, compattezza: 0.5 }, profile);
    expect(esito).toBe("ok");
  });

  it("torna null se manca la misura o il profilo", () => {
    expect(classify(null, profile)).toBeNull();
    expect(classify({ estensione: 15, intensita: 15, compattezza: 0.5 }, null)).toBeNull();
  });
});

describe("occupancy", () => {
  it("torna null se manca l'ancora o l'immagine", () => {
    const img = uniform(100);
    expect(occupancy(null, img)).toBeNull();
    expect(occupancy(img, null)).toBeNull();
    expect(occupancy(null, null)).toBeNull();
  });

  it("nessuno scostamento dal keyframe: 0%", () => {
    const anchor = uniform(100);
    const img = uniform(100);
    expect(occupancy(anchor, img)).toBe(0);
  });

  it("scostamento parziale: stessa aritmetica di compare().estensione, applicata ad ancora/oggi", () => {
    const K = 576;
    const D = 80;
    const anchor = uniform(100);
    const img = uniform(100);
    img.fill(100 + D, 0, K);
    expect(occupancy(anchor, img)).toBeCloseTo((K / THUMB_N) * 100, 9);
  });
});

describe("formatMeasures", () => {
  it("formatta le cinque misure base con le cifre decimali attese", () => {
    const riga = formatMeasures({ estensione: 12.34, intensita: 7.89, compattezza: 0.512, deriva: 2.11, degrado: 0.98 });
    expect(riga).toBe("est 12.3% | int 7.9 | cmp 0.51 | deriva 2.1 | degr 1.0%");
  });

  it("aggiunge occupazione/avanzamento quando presenti, col segno + per un avanzamento non negativo", () => {
    const riga = formatMeasures({
      estensione: 12.34, intensita: 7.89, compattezza: 0.512, deriva: 2.11, degrado: 0.98,
      occupazione: 34.567, avanzamento: 5.678,
    });
    expect(riga).toBe("est 12.3% | int 7.9 | cmp 0.51 | deriva 2.1 | degr 1.0% | occ 34.6% (+5.7)");
  });

  it("un avanzamento negativo non porta il segno +", () => {
    const riga = formatMeasures({
      estensione: 12.34, intensita: 7.89, compattezza: 0.512, deriva: 2.11, degrado: 0.98,
      occupazione: 10, avanzamento: -3.21,
    });
    expect(riga).toBe("est 12.3% | int 7.9 | cmp 0.51 | deriva 2.1 | degr 1.0% | occ 10.0% (-3.2)");
  });
});

describe("encodeFingerprint / decodeFingerprint", () => {
  it("round-trip: decodeFingerprint(encodeFingerprint(x)) ritorna la stessa impronta", () => {
    const gray = new Uint8Array(THUMB_N);
    for (let i = 0; i < THUMB_N; i++) gray[i] = (i * 37) % 256; // copre tutto il range 0-255
    const encoded = encodeFingerprint(gray);
    expect(typeof encoded).toBe("string");
    const decoded = decodeFingerprint(encoded);
    expect(decoded).toEqual(gray);
  });

  it("round-trip su un'impronta uniforme (caso degenere)", () => {
    const gray = uniform(255);
    expect(decodeFingerprint(encodeFingerprint(gray))).toEqual(gray);
  });

  it("decodeFingerprint torna null per input non stringa, vuoto, o non decodificabile", () => {
    expect(decodeFingerprint(null)).toBeNull();
    expect(decodeFingerprint(undefined)).toBeNull();
    expect(decodeFingerprint("")).toBeNull();
    expect(decodeFingerprint("non e' base64 valido !!!")).toBeNull();
  });

  it("decodeFingerprint torna null se la lunghezza decodificata non è THUMB_N", () => {
    const troppoCorta = btoa("solo pochi byte");
    expect(decodeFingerprint(troppoCorta)).toBeNull();
  });
});
