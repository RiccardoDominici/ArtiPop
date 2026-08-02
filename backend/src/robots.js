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

/** Corpo del file `/robots.txt`. */
export function renderRobots() {
  const righe = [
    "User-agent: *",
    "Allow: /",
    ...ROTTE_DI_SERVIZIO.map((path) => `Disallow: ${path}`),
  ];
  return righe.join("\n") + "\n";
}
