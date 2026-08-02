// feat-un-solo-indirizzo-ufficiale-per-ogni-pagina: ogni pagina di lettura
// dichiara il proprio indirizzo ufficiale con <link rel="canonical">, così
// gli alias (/aiuto.html, /help) e le varianti per-query della home non
// appaiono ai motori come copie senza un indirizzo preferito. Puro su
// canonicalTag/renderPage/renderHelpPage/renderArchiviPage/renderGiornoArchivio,
// nessun binding — vedi indirizzo-canonico.test.js in tests/integration per
// la copertura end-to-end sulle rotte.
import { describe, it, expect } from "vitest";
import { canonicalTag } from "../../src/head.js";
import { renderPage } from "../../src/page.js";
import { renderHelpPage } from "../../src/help.js";
import {
  renderArchiviPage,
  renderGiornoArchivio,
  renderArchivioNonTrovato,
} from "../../src/archivi.js";

const ORIGIN = "https://artipop.example";
const OGGI = "2026-08-01";

function estraiCanonical(html) {
  const tutti = html.match(/<link rel="canonical"[^>]*>/g) || [];
  return tutti;
}

describe("canonicalTag", () => {
  it("con origin ritorna il tag atteso", () => {
    expect(canonicalTag(ORIGIN, "/aiuto")).toBe(`<link rel="canonical" href="${ORIGIN}/aiuto" />`);
  });

  it("con percorso di default ('/') e origin ritorna il canonical della home", () => {
    expect(canonicalTag(ORIGIN)).toBe(`<link rel="canonical" href="${ORIGIN}/" />`);
  });

  it("senza origin ritorna stringa vuota", () => {
    expect(canonicalTag(null, "/aiuto")).toBe("");
    expect(canonicalTag(undefined, "/aiuto")).toBe("");
    expect(canonicalTag("", "/aiuto")).toBe("");
  });
});

describe("renderPage: canonical", () => {
  it("con origin espone esattamente un canonical su '/'", () => {
    const html = renderPage([], ORIGIN, OGGI);
    const tag = estraiCanonical(html);
    expect(tag).toHaveLength(1);
    expect(tag[0]).toBe(`<link rel="canonical" href="${ORIGIN}/" />`);
  });

  it("il canonical non segue condiviso: resta '/' anche con un giorno condiviso", () => {
    const condiviso = { canale: "natura", data: "2026-06-01" };
    const html = renderPage([], ORIGIN, OGGI, condiviso);
    expect(estraiCanonical(html)).toEqual([`<link rel="canonical" href="${ORIGIN}/" />`]);
  });
});

describe("renderHelpPage: canonical", () => {
  it("con origin espone esattamente un canonical su '/aiuto'", () => {
    const html = renderHelpPage(null, ORIGIN, OGGI);
    const tag = estraiCanonical(html);
    expect(tag).toHaveLength(1);
    expect(tag[0]).toBe(`<link rel="canonical" href="${ORIGIN}/aiuto" />`);
  });

  it("senza origin non emette alcun canonical", () => {
    const html = renderHelpPage();
    expect(estraiCanonical(html)).toHaveLength(0);
  });
});

describe("renderArchiviPage: canonical", () => {
  it("con origin espone esattamente un canonical su '/archivi'", () => {
    const html = renderArchiviPage([], ORIGIN, OGGI);
    const tag = estraiCanonical(html);
    expect(tag).toHaveLength(1);
    expect(tag[0]).toBe(`<link rel="canonical" href="${ORIGIN}/archivi" />`);
  });

  it("senza origin non emette alcun canonical", () => {
    const html = renderArchiviPage([]);
    expect(estraiCanonical(html)).toHaveLength(0);
  });

  it("continua a non contenere nessun <script> (invariante della sua suite)", () => {
    const html = renderArchiviPage([], ORIGIN, OGGI);
    expect(html).not.toContain("<script");
  });
});

describe("renderGiornoArchivio: canonical", () => {
  const BASE = { id: "natura", data: "2026-06-01", date: ["2026-06-02", "2026-06-01", "2026-05-31"] };

  it("con origin espone esattamente un canonical col percorso completo, incluso ?date=", () => {
    const html = renderGiornoArchivio({ ...BASE, origin: ORIGIN });
    const tag = estraiCanonical(html);
    expect(tag).toHaveLength(1);
    expect(tag[0]).toBe(`<link rel="canonical" href="${ORIGIN}/archivi/natura?date=2026-06-01" />`);
  });

  it("senza origin non emette alcun canonical", () => {
    const html = renderGiornoArchivio(BASE);
    expect(estraiCanonical(html)).toHaveLength(0);
  });
});

describe("pagine d'errore: nessun canonical", () => {
  it("renderArchivioNonTrovato non contiene alcun canonical", () => {
    const html = renderArchivioNonTrovato("natura", []);
    expect(estraiCanonical(html)).toHaveLength(0);
  });
});
