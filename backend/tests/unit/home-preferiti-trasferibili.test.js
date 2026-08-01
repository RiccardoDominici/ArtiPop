// feat-porta-i-tuoi-preferiti-su-un-altro-telefono: le date preferite
// (feat-segna-i-giorni-che-ti-piacciono, ciclo 98) vivono solo nel
// localStorage del dispositivo; questo piano dà loro una via d'uscita
// (link ?c=<canale>&fav=<date>) e una via d'ingresso (import all'avvio).
// Stessa tecnica di home-giorni-preferiti.test.js per il markup/regex, più
// un sandbox con localStorage finto per eseguire davvero importaPreferiti/
// linkPreferiti — nessun browser, nessuna devDependency nuova.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function journeySection() {
  return html.match(/<section class="journey">[\s\S]*?<\/section>/)[0];
}

// localStorage minimo, sincrono, di sola memoria — basta a leggiPreferiti/
// scriviPreferiti (getItem/setItem), come lo stub che ci si aspetta in
// un test unitario senza browser.
function fakeLocalStorage(iniziale = {}) {
  const store = { ...iniziale };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    _store: store,
  };
}

// Estrae ed esegue in sandbox le funzioni pure sui preferiti (leggi/scrivi/
// preferitiDi/linkPreferiti/dataValida/importaPreferiti), con ORIGIN e
// localStorage stubbati — nessun binding a document/rete.
function sandboxPreferiti(iniziale = {}) {
  const nomi = [
    "leggiPreferiti",
    "scriviPreferiti",
    "preferitiDi",
    "linkPreferiti",
    "dataValida",
    "importaPreferiti",
  ];
  const chiave = html.match(/const PREFERITI_KEY = "artipop:preferiti";/)[0];
  const src =
    chiave +
    "\n" +
    nomi.map((n) => html.match(new RegExp(`function ${n}\\([\\s\\S]*?\\n\\}`))[0]).join("\n");
  const localStorage = fakeLocalStorage(iniziale);
  const fn = new Function(
    "localStorage",
    "ORIGIN",
    `${src}\nreturn { leggiPreferiti, scriviPreferiti, preferitiDi, linkPreferiti, dataValida, importaPreferiti };`
  );
  const api = fn(localStorage, "https://example.com");
  return { api, localStorage };
}

describe("home — porta i tuoi preferiti su un altro telefono", () => {
  it("il markup dichiara importaPreferiti e linkPreferiti e legge il parametro fav accanto a c/d", () => {
    expect(html).toMatch(/function importaPreferiti\(chId, grezzo\)/);
    expect(html).toMatch(/function linkPreferiti\(chId\)/);
    expect(html).toContain('sharedParams.get("fav")');
  });

  it("l'import avviene prima del primo renderFavList, sul canale in cima (order[0])", () => {
    const importIdx = html.indexOf('sharedParams.get("fav")');
    const firstRenderFavListCall = html.indexOf("renderFavList(chId)");
    expect(importIdx).toBeGreaterThan(-1);
    expect(firstRenderFavListCall).toBeGreaterThan(-1);
    expect(importIdx).toBeLessThan(firstRenderFavListCall);
    expect(html).toContain("importaPreferiti(CHANNELS[order[0]].id, favParam)");
  });

  it("linkPreferiti produce ?c=<canale>&fav=<date separate da virgola>, ordinate dal più recente", () => {
    const { api } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ natura: ["2026-07-01", "2026-07-03", "2026-07-02"] }),
    });
    expect(api.linkPreferiti("natura")).toBe(
      "https://example.com/?c=natura&fav=2026-07-03,2026-07-02,2026-07-01"
    );
  });

  it("linkPreferiti torna stringa vuota se il canale non ha preferiti", () => {
    const { api } = sandboxPreferiti();
    expect(api.linkPreferiti("natura")).toBe("");
  });

  it("importaPreferiti aggiunge le date valide del parametro ai preferiti del canale", () => {
    const { api, localStorage } = sandboxPreferiti();
    const aggiunte = api.importaPreferiti("natura", "2026-07-01,2026-07-02");
    expect(aggiunte).toBe(2);
    expect(JSON.parse(localStorage._store["artipop:preferiti"])).toEqual({
      natura: ["2026-07-01", "2026-07-02"],
    });
  });

  it("l'import è un'unione con i preferiti già presenti, senza duplicati e senza cancellarli", () => {
    const { api, localStorage } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ natura: ["2026-07-01"] }),
    });
    const aggiunte = api.importaPreferiti("natura", "2026-07-01,2026-07-02");
    expect(aggiunte).toBe(1); // solo la data nuova viene contata
    expect(JSON.parse(localStorage._store["artipop:preferiti"]).natura.sort()).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);
  });

  it("ricaricare lo stesso link è idempotente: un secondo import non produce doppioni", () => {
    const { api, localStorage } = sandboxPreferiti();
    api.importaPreferiti("natura", "2026-07-01,2026-07-02");
    const secondoGiro = api.importaPreferiti("natura", "2026-07-01,2026-07-02");
    expect(secondoGiro).toBe(0);
    expect(JSON.parse(localStorage._store["artipop:preferiti"]).natura).toHaveLength(2);
  });

  it("token non conformi a YYYY-MM-DD o non calendaristici vengono scartati, nessuna scrittura se non ne resta nessuno valido", () => {
    const { api, localStorage } = sandboxPreferiti();
    const aggiunte = api.importaPreferiti("natura", "pippo,2026-13-99,,");
    expect(aggiunte).toBe(0);
    expect(localStorage._store["artipop:preferiti"]).toBeUndefined();
  });

  it("un parametro malformato non svuota né tocca i preferiti già salvati per altri canali", () => {
    const { api, localStorage } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ natura: ["2026-07-01"], cieli: ["2026-06-01"] }),
    });
    const aggiunte = api.importaPreferiti("natura", "pippo,2026-13-99,,");
    expect(aggiunte).toBe(0);
    const salvati = JSON.parse(localStorage._store["artipop:preferiti"]);
    expect(salvati).toEqual({ natura: ["2026-07-01"], cieli: ["2026-06-01"] });
  });

  it("parametro assente o vuoto: nessuna scrittura, ritorno 0", () => {
    const { api: api1, localStorage: ls1 } = sandboxPreferiti();
    expect(api1.importaPreferiti("natura", undefined)).toBe(0);
    expect(ls1._store["artipop:preferiti"]).toBeUndefined();

    const { api: api2, localStorage: ls2 } = sandboxPreferiti();
    expect(api2.importaPreferiti("natura", "")).toBe(0);
    expect(ls2._store["artipop:preferiti"]).toBeUndefined();
  });

  it("un import su un canale non tocca i preferiti già presenti per un altro canale", () => {
    const { api, localStorage } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ cieli: ["2026-06-01"] }),
    });
    api.importaPreferiti("natura", "2026-07-01");
    const salvati = JSON.parse(localStorage._store["artipop:preferiti"]);
    expect(salvati.cieli).toEqual(["2026-06-01"]);
    expect(salvati.natura).toEqual(["2026-07-01"]);
  });

  it("nessuna chiave di storage diversa da artipop:preferiti viene scritta dall'import", () => {
    const { api, localStorage } = sandboxPreferiti();
    api.importaPreferiti("natura", "2026-07-01");
    expect(Object.keys(localStorage._store)).toEqual(["artipop:preferiti"]);
  });

  it("il comando di copia del link è l'ultima riga di #favlist, riusa .arcrow e appare solo con preferiti presenti", () => {
    const fnBody = html.match(/function renderFavList\(chId\)[\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('copyRow.className = "arcrow"');
    expect(fnBody).toContain("linkPreferiti(chId)");
    expect(fnBody).toContain("copiaNegliAppunti(link)");
    // la riga di copia è aggiunta dopo il ciclo sulle date, prima del hidden finale
    const idxLoopEnd = fnBody.indexOf("favListEl.appendChild(row);");
    const idxCopyRow = fnBody.indexOf("copyRow");
    const idxHiddenFinale = fnBody.indexOf("favPickEl.hidden = preferiti.length === 0");
    expect(idxLoopEnd).toBeLessThan(idxCopyRow);
    expect(idxCopyRow).toBeLessThan(idxHiddenFinale);
  });

  it("il fallimento della copia non produce errori in pagina: stesso try/catch di copyChannelUrl", () => {
    const fnBody = html.match(/function renderFavList\(chId\)[\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/try\s*\{[\s\S]*copiaNegliAppunti\(link\)/);
    expect(fnBody).toMatch(/catch\s*\{[\s\S]*toast\(link\)/);
  });

  it("nessun nuovo pulsante nel markup statico della barra comandi: il comando di copia vive solo dentro #favlist, costruito lato client", () => {
    const journey = journeySection();
    expect(journey).not.toMatch(/id="favtransfer"|id="favcopy"/);
  });
});
