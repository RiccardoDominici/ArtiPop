// Helper condiviso dai test di configurazione (ciclo 41, POLISH): prima
// esisteva una copia identica di stripJsonc in config-preview-isolato.test.js
// e config-deploy-coerente.test.js — estratta qui per evitare la duplicazione
// e dare un unico punto da cui leggere backend/wrangler.jsonc.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Rimuove i commenti // e /* */ da un JSONC, preservando le stringhe JSON
// (incluse quelle che contengono "//", come gli URL "https://...").
export function stripJsonc(testo) {
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

const WRANGLER_PATH = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));

// Legge e parsa backend/wrangler.jsonc, così i test di configurazione non
// duplicano né il percorso né la chiamata a stripJsonc + JSON.parse.
export function leggiWrangler() {
  const src = readFileSync(WRANGLER_PATH, "utf8");
  return { src, config: JSON.parse(stripJsonc(src)) };
}
