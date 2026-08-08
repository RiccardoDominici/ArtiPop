// feat-l-elenco-degli-archivi-si-ordina-come-vuoi: ordinaStorici(storici, ordina)
// è pura e testabile senza env — gemella di filtraStorici (filtri, testata
// solo via renderArchiviPage). Copre i tre criteri ("recenti" | "giorni" |
// "nome"), la ricaduta robusta su "recenti" per qualunque valore inatteso, la
// purezza (nessuna mutazione dell'array ricevuto) e la composizione col form
// e con la ricerca in renderArchiviPage.
import { describe, it, expect } from "vitest";
import { renderArchiviPage, ordinaStorici } from "../../src/archivi.js";
import { ACTIVE_CHANNELS } from "../../src/channels.js";

const TRE = [
  { id: "bloom", giorni: 3, prima: "2025-02-01", ultima: "2025-02-10" },
  { id: "island", giorni: 12, prima: "2025-01-01", ultima: "2025-01-12" },
  { id: "neon", giorni: 3, prima: "2025-03-01", ultima: "2025-03-05" },
];

describe("ordinaStorici", () => {
  it('"giorni": island (12) primo, poi neon e bloom a pari 3 giorni risolti per ultima decrescente', () => {
    expect(ordinaStorici(TRE, "giorni").map((c) => c.id)).toEqual(["island", "neon", "bloom"]);
  });

  it('"giorni": parità piena di giorni e ultima risolta per id, indipendente dall\'ordine d\'ingresso', () => {
    const zeta = { id: "zeta", giorni: 5, prima: "2025-01-01", ultima: "2025-01-05" };
    const alfa = { id: "alfa", giorni: 5, prima: "2025-01-01", ultima: "2025-01-05" };
    expect(ordinaStorici([zeta, alfa], "giorni").map((c) => c.id)).toEqual(["alfa", "zeta"]);
    expect(ordinaStorici([alfa, zeta], "giorni").map((c) => c.id)).toEqual(["alfa", "zeta"]);
  });

  it('"nome": ordina per nome visibile, stessa regola dell\'oracolo localeCompare("it")', () => {
    const canale = ACTIVE_CHANNELS[0];
    const lista = [
      { id: "neon", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" },
      { id: canale.id, giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" },
      { id: "bloom", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" },
    ];
    const nomi = (arr) => arr.map((c) => String(c.id));
    const atteso = [...lista]
      .sort((a, b) => a.id.localeCompare(b.id, "it", { sensitivity: "base" }))
      .map((c) => c.id);
    expect(nomi(ordinaStorici(lista, "nome"))).toEqual(atteso);
  });

  it('"nome": insensibile a maiuscole e accenti', () => {
    const lista = [
      { id: "Ètna", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" },
      { id: "alba", giorni: 1, prima: "2025-01-01", ultima: "2025-01-01" },
    ];
    expect(ordinaStorici(lista, "nome").map((c) => c.id)).toEqual(["alba", "Ètna"]);
  });

  it.each(["", null, undefined, "pippo", 42, {}])(
    "valore non riconosciuto (%j): non lancia e restituisce l'ordine ricevuto invariato",
    (v) => {
      expect(() => ordinaStorici(TRE, v)).not.toThrow();
      expect(ordinaStorici(TRE, v)).toEqual(TRE);
    }
  );

  it("è pura: non muta l'array ricevuto e restituisce una nuova lista", () => {
    const copia = JSON.parse(JSON.stringify(TRE));
    const risultato = ordinaStorici(TRE, "giorni");
    expect(TRE).toEqual(copia);
    expect(risultato).not.toBe(TRE);
  });

  it("storici non-array: restituito invariato, senza lanciare", () => {
    expect(ordinaStorici(null, "giorni")).toBe(null);
    expect(ordinaStorici(undefined, "nome")).toBe(undefined);
  });
});

describe("renderArchiviPage — ordinamento (?ordina=)", () => {
  it('?ordina=giorni: <option value="giorni" selected> e card nell\'ordine per giorni', () => {
    const html = renderArchiviPage(TRE, null, null, "", "giorni");
    expect(html).toContain('<option value="giorni" selected>');
    expect(html.indexOf("/archivi/island?date=")).toBeLessThan(html.indexOf("/archivi/neon?date="));
    expect(html.indexOf("/archivi/neon?date=")).toBeLessThan(html.indexOf("/archivi/bloom?date="));
  });

  it("senza ordina: selected su recenti, non su giorni", () => {
    const html = renderArchiviPage(TRE);
    expect(html).toContain('<option value="recenti" selected>');
    expect(html).not.toContain('<option value="giorni" selected>');
  });

  it("composizione: cerca + ordina=giorni mostra solo le card filtrate, ordinate per giorni", () => {
    const html = renderArchiviPage(TRE, null, null, "o", "giorni");
    expect(html).toContain("/archivi/neon?date=");
    expect(html).toContain("/archivi/bloom?date=");
    expect(html).not.toContain("/archivi/island?date=");
    expect(html.indexOf("/archivi/neon?date=")).toBeLessThan(html.indexOf("/archivi/bloom?date="));
  });

  it("nessuno <script> né fetch( nell'HTML anche col select presente", () => {
    const html = renderArchiviPage(TRE, null, null, "", "giorni");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("fetch(");
  });

  it("nessuna iniezione: un valore di ordina con caratteri speciali non finisce mai nell'HTML", () => {
    const html = renderArchiviPage(TRE, null, null, "", '"><script>alert(1)</script>');
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("alert(1)");
    expect(html).toContain('<option value="recenti" selected>');
  });

  it("storici null: nessun name=\"ordina\" nell'HTML, messaggio di indisponibilità", () => {
    const html = renderArchiviPage(null, null, null, "", "giorni");
    expect(html).not.toContain('name="ordina"');
    expect(html).toContain("Archivi momentaneamente non disponibili.");
  });
});
