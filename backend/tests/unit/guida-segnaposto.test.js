// ciclo 37 (POLISH): la voce di GUIDA.md §1.6 sul segnaposto deve restare
// vera rispetto al comportamento reale di /w/<flusso> in index.js — se il
// segnaposto venisse rimosso da uno dei rami di fallimento, questa suite
// fallisce insieme alla documentazione che lo descrive.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GUIDA_PATH = fileURLToPath(new URL("../../../GUIDA.md", import.meta.url));
const GUIDA = readFileSync(GUIDA_PATH, "utf8");

const INDEX_PATH = fileURLToPath(new URL("../../src/index.js", import.meta.url));
const INDEX_SRC = readFileSync(INDEX_PATH, "utf8");

function bloccoSezione16(testo) {
  const inizio = testo.indexOf("## 1.6 Se qualcosa non va");
  const fine = testo.indexOf("---\n---", inizio);
  if (inizio === -1 || fine === -1) return "";
  return testo.slice(inizio, fine);
}

function bloccoSegnaposto(testo) {
  const blocco16 = bloccoSezione16(testo);
  const inizio = blocco16.indexOf("rettangolo scuro senza disegno");
  if (inizio === -1) return "";
  // rimuove i marcatori di blockquote ("> ") a inizio riga, così le frasi
  // spezzate su più righe dal wrapping markdown restano cercabili in blocco.
  return blocco16.slice(inizio).replace(/^>\s?/gm, "");
}

describe("GUIDA.md documenta il segnaposto su /w/<flusso>", () => {
  const blocco = bloccoSegnaposto(GUIDA);

  it("il blocco sul segnaposto esiste in §1.6", () => {
    expect(blocco.length).toBeGreaterThan(0);
  });

  it("nomina entrambe le cause: canale mai generato e data inesistente", () => {
    expect(blocco).toMatch(/canale (è )?appena|canale.{0,40}nuovo|non è ancora stato generato/i);
    expect(blocco).toMatch(/data.{0,60}non esisteva|data inesistente|giorno in cui quel canale non esisteva/i);
  });

  it("dice esplicitamente che la risposta è comunque un'immagine, mai un errore", () => {
    expect(blocco).toMatch(/immagine valida/i);
    expect(blocco).toMatch(/mai (con )?un\s+errore|non.{0,20}errore/i);
  });

  it("§1.5 rimanda a §1.6 sulla riga della data", () => {
    const riga15 = GUIDA
      .slice(GUIDA.indexOf("## 1.5 Uso quotidiano"), GUIDA.indexOf("## 1.6 Se qualcosa non va"))
      .split("\n")
      .find((r) => r.includes("Riscaricare un giorno preciso"));
    expect(riga15).toBeDefined();
    expect(riga15).toMatch(/§1\.6/);
  });

  it("anti-drift: index.js serve ancora il segnaposto su almeno due rami del blocco /w/", () => {
    const inizioW = INDEX_SRC.indexOf('path.match(/^\\/w\\/');
    expect(inizioW).toBeGreaterThan(-1);
    const bloccoW = INDEX_SRC.slice(inizioW);
    const occorrenze = bloccoW.match(/PLACEHOLDER_PNG_BYTES/g) || [];
    expect(occorrenze.length).toBeGreaterThanOrEqual(2);
  });
});
