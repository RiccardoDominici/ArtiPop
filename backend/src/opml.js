// feat-segui-tutti-i-canali-con-un-solo-import: un lettore di feed importa in
// blocco un feed per canale invece di farsi incollare un indirizzo alla
// volta. Modulo puro (nessun accesso a KV/rete), stesso stile di feed.js.

import { escXml } from "./feed.js";
import { displayName } from "./channels.js";

/**
 * Compone l'elenco OPML 2.0 dei feed per canale. Funzione TOTALE: non lancia
 * mai, per nessun input — è ciò che la rende usabile anche nel ramo di
 * ripiego della rotta (index.js), dove il catch non può richiamare codice
 * che possa fallire una seconda volta.
 * `canali` = array di { id, name } (tipicamente ACTIVE_CHANNELS); voci senza
 * un `id` stringa non vuota vengono scartate (mai un xmlUrl rotto).
 */
export function renderOpml({ canali, origin } = {}) {
  const base = String(origin ?? "");
  const lista = Array.isArray(canali) ? canali : [];

  const outlines = lista
    .filter((c) => c && typeof c.id === "string" && c.id)
    .map((c) => {
      const nome = typeof c.name === "string" && c.name ? c.name : displayName(c.id);
      const xmlUrl = `${base}/feed/${c.id}.xml`;
      const htmlUrl = `${base}/?c=${c.id}`;
      return `<outline type="rss" text="${escXml(nome)}" title="${escXml(nome)}" xmlUrl="${escXml(xmlUrl)}" htmlUrl="${escXml(htmlUrl)}" />`;
    });

  const corpo = outlines.length ? "<body>\n" + outlines.join("\n") + "\n</body>" : "<body></body>";

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
<head><title>ArtiPop</title></head>
${corpo}
</opml>`;
}

/** OPML valido e vuoto: il ripiego della rotta, una stringa già pronta che non può lanciare. */
export const OPML_VUOTO = renderOpml({ canali: [], origin: "" });
