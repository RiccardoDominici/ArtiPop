// feat-il-sito-si-fa-trovare-solo-dove-serve: robots.txt che apre ai crawler
// le pagine di lettura (`/`, `/aiuto`, `/archivi`, `/archivi/<id>`, `/w/...`)
// e chiude le stanze di servizio. Falsariga di `manifest.js`/`sw.js`: modulo
// che espone il corpo, rotta sottile in `index.js`.

/**
 * Rotte di servizio realmente presenti in `index.js` (tool di taratura, lab,
 * catalogo, note, API JSON, health check e le rotte di generazione/backfill
 * protette da chiave admin): un crawler che le indicizzasse porterebbe un
 * lettore su un 401, non su un contenuto. `/w/` NON compare qui: `head.js`
 * lo usa come `og:image` per l'anteprima dei link condivisi (cicli
 * s-anteprima-e-icona-quando-il-link-viene-condiviso,
 * feat-l-anteprima-del-link-condiviso-mostra-quel-giorno,
 * feat-condividere-aiuto-e-archivi-mostra-l-anteprima), bloccarlo romperebbe
 * quell'anteprima.
 */
const ROTTE_DI_SERVIZIO = [
  "/tuning",
  "/lab/",
  "/catalogo",
  "/note",
  "/api/",
  "/health",
  "/backfill",
  "/regen-day",
  "/run-all",
  "/test-metrics",
  "/test-size",
];

/**
 * Corpo del file `/robots.txt`. Con `origin` presente (feat-i-motori-di-
 * ricerca-trovano-anche-gli-archivi) appende in coda la riga `Sitemap:`,
 * come vogliono i crawler; senza origin il file resta identico a prima —
 * mai un indirizzo finto inventato.
 */
export function renderRobots(origin) {
  const righe = [
    "User-agent: *",
    "Allow: /",
    ...ROTTE_DI_SERVIZIO.map((path) => `Disallow: ${path}`),
  ];
  if (origin) {
    righe.push(`Sitemap: ${origin}/sitemap.xml`);
  }
  return righe.join("\n") + "\n";
}
