// ciclo 36 (POLISH): anti-drift fra le liste di sospensione (config.js) e la
// documentazione (GUIDA.md). Se domani si aggiunge una sospensione senza
// documentarla, questa suite fallisce — vedi §2.5 «Come sono fatti i
// canali» per il blocco che il test verifica riga per riga.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FAMIGLIE_SOSPESE, ELEMENT_SOSPESI } from "../../src/config.js";

const GUIDA_PATH = fileURLToPath(new URL("../../../GUIDA.md", import.meta.url));
const GUIDA = readFileSync(GUIDA_PATH, "utf8");

/* Estrae il blocco sulle sospensioni: dalla riga "Famiglie ed element
   sospesi" fino all'Invariante che chiude §2.5 (vedi GUIDA.md). Ogni id
   sospeso deve comparire come voce puntata dentro questo blocco, non in un
   punto qualsiasi del documento (evita falsi positivi da menzioni sparse). */
function blocccoSospensioni(testo) {
  const inizio = testo.indexOf("Famiglie ed element sospesi dalla pesca");
  const fine = testo.indexOf("> **Invariante:**", inizio);
  if (inizio === -1 || fine === -1) return "";
  return testo.slice(inizio, fine);
}

function ogniIdDocumentato(ids, testoBlocco) {
  if (ids.length === 0) return true;
  return ids.every((id) => new RegExp("`" + id + "`", "u").test(testoBlocco));
}

describe("GUIDA.md documenta le sospensioni dai pool di pesca", () => {
  const blocco = blocccoSospensioni(GUIDA);

  it("il blocco sulle sospensioni esiste in §2.5", () => {
    expect(blocco.length).toBeGreaterThan(0);
  });

  it("nomina ELEMENT_SOSPESI, FAMIGLIE_SOSPESE e config.js", () => {
    expect(blocco).toMatch(/ELEMENT_SOSPESI/);
    expect(blocco).toMatch(/FAMIGLIE_SOSPESE/);
    expect(blocco).toMatch(/config\.js/);
  });

  it("ogni id in ELEMENT_SOSPESI e FAMIGLIE_SOSPESE compare nel blocco (anti-drift)", () => {
    expect(ogniIdDocumentato(ELEMENT_SOSPESI, blocco)).toBe(true);
    expect(ogniIdDocumentato(FAMIGLIE_SOSPESE, blocco)).toBe(true);
  });

  it("il controllo di anti-drift non è vacuo: un id inesistente in GUIDA.md fa fallire il controllo", () => {
    expect(ogniIdDocumentato(["un-id-che-non-esiste-in-guida"], blocco)).toBe(false);
  });

  it("nomina lo stato odierno (canoa) e il campo `sospeso` di GET /catalogo", () => {
    expect(blocco).toMatch(/`canoa`/);
    expect(blocco).toMatch(/`sospeso`/);
    expect(blocco).toMatch(/GET \/catalogo/);
  });

  it("il runbook §2.9 spiega l'element che non esce mai dalla pesca", () => {
    const runbook = GUIDA.slice(
      GUIDA.indexOf("## 2.9 Runbook"),
      GUIDA.indexOf("## 2.10 Lezioni imparate"),
    );
    expect(runbook).toMatch(/Un element non esce mai dalla pesca/);
    expect(runbook).toMatch(/#25-come-sono-fatti-i-canali/);
  });
});
