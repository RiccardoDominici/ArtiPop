// feat-i-motori-di-ricerca-trovano-anche-gli-archivi: `/sitemap.xml` che
// dichiara le pagine di lettura realmente esistenti, falsariga di
// `robots.js`/`feed.js`: modulo puro che espone il corpo, rotta sottile in
// `index.js`. Complementare a `robots.js` (ciclo
// feat-il-sito-si-fa-trovare-solo-dove-serve): lì si dice cosa evitare, qui
// cosa esiste e quando è cambiato.

import { escXml } from "./feed.js";

/**
 * Compone il documento `/sitemap.xml`. `storici` = array di `{ id, ultima }`
 * (stessa forma già filtrata/ordinata dalla rotta `/archivi`, storage.js) o
 * `null` quando la scansione KV non è disponibile: in quel caso il documento
 * contiene solo le tre voci fisse, mai un corpo vuoto o un errore (principio
 * 3). Funzione PURA: nessun accesso a `env`, nessuna rete.
 */
export function renderSitemap(origin, storici) {
  const fisse = ["/", "/aiuto", "/archivi"].map(
    (path) => `<url><loc>${escXml(`${origin}${path}`)}</loc></url>`
  );
  const dinamiche = (storici || []).map((voce) => {
    const loc = `${origin}/archivi/${encodeURIComponent(voce.id)}`;
    const lastmod = voce.ultima ? `<lastmod>${escXml(voce.ultima)}</lastmod>` : "";
    return `<url><loc>${escXml(loc)}</loc>${lastmod}</url>`;
  });
  const urls = [...fisse, ...dinamiche].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
