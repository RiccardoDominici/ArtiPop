// ciclo 39 (POLISH): l'ambiente env.preview di backend/wrangler.jsonc deve
// restare isolato dalla produzione — KV distinto, SELF verso il worker
// preview, origine pubblica preview — altrimenti un cambiamento distratto
// nella configurazione farebbe scrivere il loop autonomo sul KV di
// produzione, la violazione più grave prevista da CLAUDE.md § Budget AI.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WRANGLER_PATH = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));
const WRANGLER_SRC = readFileSync(WRANGLER_PATH, "utf8");

// Rimuove i commenti // e /* */ da un JSONC, preservando le stringhe JSON
// (incluse quelle che contengono "//", come gli URL "https://...").
function stripJsonc(testo) {
  let risultato = "";
  let inStringa = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    const c2 = testo[i + 1];

    if (inStringa) {
      risultato += c;
      if (c === "\\") {
        // copia anche il carattere escapato così da non interpretare
        // erroneamente un '"' dopo un backslash come fine stringa.
        risultato += c2 ?? "";
        i++;
        continue;
      }
      if (c === '"') inStringa = false;
      continue;
    }

    if (c === '"') {
      inStringa = true;
      risultato += c;
      continue;
    }

    if (c === "/" && c2 === "/") {
      while (i < testo.length && testo[i] !== "\n") i++;
      risultato += "\n";
      continue;
    }

    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < testo.length && !(testo[i] === "*" && testo[i + 1] === "/")) i++;
      i++; // consuma la '/' finale del blocco
      continue;
    }

    risultato += c;
  }
  return risultato;
}

const CONFIG = JSON.parse(stripJsonc(WRANGLER_SRC));

describe("config-preview-isolato", () => {
  it("stripJsonc conserva le stringhe con // (https://) e produce JSON valido", () => {
    const pulito = stripJsonc(WRANGLER_SRC);
    expect(pulito).toContain("https://artipop.riccardo-dominici.workers.dev");
    expect(pulito).toContain("https://artipop-preview.riccardo-dominici.workers.dev");
    expect(() => JSON.parse(pulito)).not.toThrow();
  });

  it("env.preview.name è distinto dal worker di produzione", () => {
    expect(CONFIG.env.preview.name).toBeTruthy();
    expect(CONFIG.env.preview.name).not.toBe(CONFIG.name);
  });

  it("env.preview usa un namespace KV diverso da quello di produzione", () => {
    const kvProd = CONFIG.kv_namespaces[0].id;
    const kvPreview = CONFIG.env.preview.kv_namespaces[0].id;
    expect(kvProd).toBeTruthy();
    expect(kvPreview).toBeTruthy();
    expect(kvPreview).not.toBe(kvProd);
  });

  it("il binding SELF di env.preview punta al worker preview, mai alla produzione", () => {
    const selfPreview = CONFIG.env.preview.services.find((s) => s.binding === "SELF");
    expect(selfPreview).toBeTruthy();
    expect(selfPreview.service).toBe(CONFIG.env.preview.name);
    expect(selfPreview.service).not.toBe(CONFIG.name);
  });

  it("PUBLIC_ORIGIN di env.preview è distinto e nomina il worker preview", () => {
    const originProd = CONFIG.vars.PUBLIC_ORIGIN;
    const originPreview = CONFIG.env.preview.vars.PUBLIC_ORIGIN;
    expect(originPreview).not.toBe(originProd);
    expect(originPreview).toContain(CONFIG.env.preview.name);
  });

  it("env.preview dichiara per intero tutti i binding (nessuna eredità implicita)", () => {
    const preview = CONFIG.env.preview;
    expect(preview.ai).toBeTruthy();
    expect(preview.images).toBeTruthy();
    expect(Array.isArray(preview.kv_namespaces)).toBe(true);
    expect(preview.kv_namespaces.length).toBeGreaterThan(0);
    expect(Array.isArray(preview.services)).toBe(true);
    expect(preview.services.length).toBeGreaterThan(0);
    expect(preview.vars).toBeTruthy();
  });
});
