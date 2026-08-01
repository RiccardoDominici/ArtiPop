// ciclo 41 (POLISH): il worker legge env.KV, env.AI, env.IMAGES, env.SELF e
// il secret env.ADMIN_KEY, ma nulla legava l'elenco dei binding usati dal
// codice a ciò che backend/wrangler.jsonc dichiara — né in produzione né in
// env.preview, che non eredita nulla dal top level. Un binding aggiunto nel
// codice e dichiarato in un solo ambiente passerebbe il deploy e farebbe
// crashare il worker a runtime sull'ambiente scoperto: robustezza (principio
// 3 di CLAUDE.md) sulla catena di deploy. Questo test deriva l'elenco dai
// sorgenti con una regex, non da una lista scritta a mano, per non poter
// marcire in silenzio quando i binding cambiano.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { leggiWrangler } from "../helpers/jsonc.js";

const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));

// Secret che il codice legge da env.* ma che non possono comparire in
// wrangler.jsonc (finirebbero in chiaro nel repository): vanno impostati con
// `wrangler secret put` per ciascun ambiente. Il valore del secret non è mai
// letto, stampato o asserito qui — solo il suo NOME va escluso dal confronto
// con i binding di configurazione.
const SECRETS_ALLOWLIST = new Set(["ADMIN_KEY"]);

// Estrae tutti i nomi env.<NOME> (solo MAIUSCOLO, per non raccogliere
// proprietà locali come env.something) da ogni file di backend/src/.
function estraiBindingUsati() {
  const nomi = new Set();
  for (const file of readdirSync(SRC_DIR)) {
    if (!file.endsWith(".js")) continue;
    const testo = readFileSync(`${SRC_DIR}/${file}`, "utf8");
    for (const match of testo.matchAll(/env\.([A-Z][A-Z0-9_]*)\b/g)) {
      nomi.add(match[1]);
    }
  }
  return nomi;
}

// Ricava i nomi dei binding dichiarati in un blocco d'ambiente di
// wrangler.jsonc (top level oppure env.preview): kv_namespaces[].binding,
// ai.binding, images.binding, services[].binding, più le chiavi di vars.
function bindingDichiarati(blocco) {
  const nomi = new Set();
  for (const kv of blocco.kv_namespaces ?? []) nomi.add(kv.binding);
  if (blocco.ai?.binding) nomi.add(blocco.ai.binding);
  if (blocco.images?.binding) nomi.add(blocco.images.binding);
  for (const s of blocco.services ?? []) nomi.add(s.binding);
  for (const nomeVar of Object.keys(blocco.vars ?? {})) nomi.add(nomeVar);
  return nomi;
}

const BINDING_USATI = estraiBindingUsati();
const { config: CONFIG } = leggiWrangler();

describe("config-binding-completi", () => {
  it("l'estrazione dai sorgenti non è vuota e contiene i binding noti (guardia contro il falso verde)", () => {
    expect(BINDING_USATI.size).toBeGreaterThan(0);
    expect(BINDING_USATI.has("KV")).toBe(true);
    expect(BINDING_USATI.has("AI")).toBe(true);
    expect(BINDING_USATI.has("IMAGES")).toBe(true);
    expect(BINDING_USATI.has("SELF")).toBe(true);
  });

  it("l'allowlist dei secret contiene solo nomi effettivamente usati dal codice", () => {
    for (const nome of SECRETS_ALLOWLIST) {
      expect(BINDING_USATI.has(nome)).toBe(true);
    }
  });

  it("ogni binding usato dal codice è dichiarato in produzione (top level) o è un secret in allowlist", () => {
    const dichiaratiProd = bindingDichiarati(CONFIG);
    for (const nome of BINDING_USATI) {
      if (SECRETS_ALLOWLIST.has(nome)) continue;
      expect(dichiaratiProd.has(nome)).toBe(true);
    }
  });

  it("ogni binding usato dal codice è dichiarato in env.preview o è un secret in allowlist", () => {
    const dichiaratiPreview = bindingDichiarati(CONFIG.env.preview);
    for (const nome of BINDING_USATI) {
      if (SECRETS_ALLOWLIST.has(nome)) continue;
      expect(dichiaratiPreview.has(nome)).toBe(true);
    }
  });
});
