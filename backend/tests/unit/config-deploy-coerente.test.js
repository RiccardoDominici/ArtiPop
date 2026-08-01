// ciclo 40 (POLISH): scripts/deploy.sh fissa a mano i nomi dei worker e gli
// URL (WORKER_PROD, WORKER_PREVIEW, URL_PROD, URL_PREVIEW), mentre la verità
// sui nomi e sull'origine sta in backend/wrangler.jsonc. Se le due fonti
// divergono il loop deploya un worker e fa smoke (o rollback) su un altro, in
// silenzio: questo test lega le due fonti senza cambiare nessuna
// configurazione.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WRANGLER_PATH = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));
const WRANGLER_SRC = readFileSync(WRANGLER_PATH, "utf8");

const DEPLOY_SH_PATH = fileURLToPath(new URL("../../../scripts/deploy.sh", import.meta.url));
const DEPLOY_SH_SRC = readFileSync(DEPLOY_SH_PATH, "utf8");

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

// Estrae il valore di un'assegnazione NOME="valore" da scripts/deploy.sh.
// Fallisce esplicitamente (stringa vuota) se la costante non viene trovata,
// così il test la segnala invece di confrontare in silenzio due `undefined`.
function estraiCostante(nome) {
  const match = DEPLOY_SH_SRC.match(new RegExp(`^${nome}="([^"]*)"`, "m"));
  return match ? match[1] : "";
}

const WORKER_PROD = estraiCostante("WORKER_PROD");
const WORKER_PREVIEW = estraiCostante("WORKER_PREVIEW");
const URL_PROD = estraiCostante("URL_PROD");
const URL_PREVIEW = estraiCostante("URL_PREVIEW");

describe("config-deploy-coerente", () => {
  it("l'estrazione delle costanti da scripts/deploy.sh trova tutti e quattro i valori, non vuoti", () => {
    expect(WORKER_PROD).not.toBe("");
    expect(WORKER_PREVIEW).not.toBe("");
    expect(URL_PROD).not.toBe("");
    expect(URL_PREVIEW).not.toBe("");
  });

  it("WORKER_PROD di scripts/deploy.sh coincide con il name di produzione in wrangler.jsonc", () => {
    expect(WORKER_PROD).toBe(CONFIG.name);
  });

  it("WORKER_PREVIEW di scripts/deploy.sh coincide con env.preview.name, ed è distinto da WORKER_PROD", () => {
    expect(WORKER_PREVIEW).toBe(CONFIG.env.preview.name);
    expect(WORKER_PREVIEW).not.toBe(WORKER_PROD);
  });

  it("URL_PROD di scripts/deploy.sh coincide con vars.PUBLIC_ORIGIN di produzione", () => {
    expect(URL_PROD).toBe(CONFIG.vars.PUBLIC_ORIGIN);
  });

  it("URL_PREVIEW di scripts/deploy.sh coincide con env.preview.vars.PUBLIC_ORIGIN, ed è distinto da URL_PROD", () => {
    expect(URL_PREVIEW).toBe(CONFIG.env.preview.vars.PUBLIC_ORIGIN);
    expect(URL_PREVIEW).not.toBe(URL_PROD);
  });
});
