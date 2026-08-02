// feat-i-preferiti-degli-altri-canali-non-si-perdono: chi ha segnato giorni
// preferiti su un canale li ritrova anche mentre guarda un altro — la home
// elenca, in coda al pannello «i tuoi preferiti», una riga per ogni altro
// canale con giorni segnati, e quella riga li riapre (sulla home se il
// canale è ancora attivo, in archivio se è stato ritirato). Stessa tecnica
// di home-preferiti-trasferibili.test.js: sandbox delle funzioni pure sui
// preferiti più verifica testuale del markup/script per la parte che tocca
// il DOM del browser (renderFavList), che qui non si esegue davvero.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function journeySection() {
  return html.match(/<section class="journey">[\s\S]*?<\/section>/)[0];
}

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

// Estrae ed esegue in sandbox le funzioni pure sui preferiti, come
// sandboxPreferiti di home-preferiti-trasferibili.test.js, con in più
// preferitiAltrove.
function sandboxPreferiti(iniziale = {}) {
  const nomi = ["leggiPreferiti", "scriviPreferiti", "preferitiDi", "dataValida", "preferitiAltrove"];
  const chiave = html.match(/const PREFERITI_KEY = "artipop:preferiti";/)[0];
  const src =
    chiave +
    "\n" +
    nomi.map((n) => html.match(new RegExp(`function ${n}\\([\\s\\S]*?\\n\\}`))[0]).join("\n");
  const localStorage = fakeLocalStorage(iniziale);
  const fn = new Function(
    "localStorage",
    `${src}\nreturn { leggiPreferiti, scriviPreferiti, preferitiDi, dataValida, preferitiAltrove };`
  );
  const api = fn(localStorage);
  return { api, localStorage };
}

describe("home — i preferiti degli altri canali non si perdono", () => {
  it("preferitiAltrove è dichiarata e filtra sempre fuori il canale corrente (mai l'elenco completo)", () => {
    expect(html).toMatch(/function preferitiAltrove\(chId\)/);
    const fn = html.match(/function preferitiAltrove\(chId\) \{[\s\S]*?\n\}/)[0];
    expect(fn).toContain("if (id === chId) continue;");
  });

  it("renderFavList emette il ramo /?c= per i canali ancora fra le card e /archivi/ per gli altri, sempre con encodeURIComponent", () => {
    const corpo = html.match(/function renderFavList\(chId\) \{[\s\S]*?\n\}/)[0];
    expect(corpo).toContain('"/?c=" + encodeURIComponent(voce.id) + "&d=" + encodeURIComponent(piuRecente)');
    expect(corpo).toContain(
      '"/archivi/" + encodeURIComponent(voce.id) + "?date=" + encodeURIComponent(piuRecente)'
    );
  });

  it("la visibilità di #favpick tiene conto anche dei preferiti altrove, non più del solo canale mostrato", () => {
    const corpo = html.match(/function renderFavList\(chId\) \{[\s\S]*?\n\}/)[0];
    expect(corpo).not.toContain("favPickEl.hidden = preferiti.length === 0;");
    expect(corpo).toContain("favPickEl.hidden = preferiti.length === 0 && altrove.length === 0;");
  });

  it("le righe degli altri canali riusano .arcrow, nessuna classe o regola CSS nuova nello stile della pagina", () => {
    const corpo = html.match(/function renderFavList\(chId\) \{[\s\S]*?\n\}/)[0];
    const altroveBlocco = corpo.slice(corpo.indexOf("preferitiAltrove(chId)"));
    expect(altroveBlocco).toContain('row.className = "arcrow"');
    expect(altroveBlocco).not.toContain(".favaltrove"); // nessun componente nuovo
    const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
    expect(style).not.toContain(".favaltrove");
  });

  it("preferitiAltrove: nessun preferito altrove torna elenco vuoto", () => {
    const { api } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ natura: ["2026-07-01"] }),
    });
    expect(api.preferitiAltrove("natura")).toEqual([]);
  });

  it("preferitiAltrove: elenca gli altri canali con date ordinate dal più recente al più vecchio", () => {
    const { api } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({
        natura: ["2026-07-01"],
        citta: ["2026-07-02", "2026-07-05", "2026-07-03"],
      }),
    });
    expect(api.preferitiAltrove("natura")).toEqual([
      { id: "citta", giorni: ["2026-07-05", "2026-07-03", "2026-07-02"] },
    ]);
  });

  it("preferitiAltrove non include mai il canale richiesto, anche se ha preferiti", () => {
    const { api } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ natura: ["2026-07-01"], citta: ["2026-07-02"] }),
    });
    const risultato = api.preferitiAltrove("natura");
    expect(risultato.find((v) => v.id === "natura")).toBeUndefined();
  });

  it("preferitiAltrove scarta date non valide e non include canali che, filtrati, restano vuoti", () => {
    const { api } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({
        natura: ["2026-07-01"],
        citta: ["pippo", "2026-13-99"],
        quiete: ["2026-07-02", "pippo"],
      }),
    });
    expect(api.preferitiAltrove("natura")).toEqual([{ id: "quiete", giorni: ["2026-07-02"] }]);
  });

  it("preferitiAltrove su un canale senza preferiti propri include comunque gli altri canali", () => {
    const { api } = sandboxPreferiti({
      "artipop:preferiti": JSON.stringify({ citta: ["2026-07-02"] }),
    });
    expect(api.preferitiAltrove("natura")).toEqual([{ id: "citta", giorni: ["2026-07-02"] }]);
  });

  it("il markup di .journey resta identico a oggi: #favpick chiuso di default, nessun attributo nuovo esposto staticamente", () => {
    const journey = journeySection();
    const tag = journey.match(/<button class="btn ghost" id="favpick"[^>]*>/)[0];
    expect(tag).toContain("hidden");
  });
});
