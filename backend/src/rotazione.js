// feat-lo-sfondo-di-oggi-puo-venire-da-tutto-l-archivio: `?date=casuale` su
// `/w/<flusso>` pesca uno sfondo da tutto l'archivio del canale invece del
// solo giorno odierno. Falsariga di `robots.js`/`sitemap.js`: modulo puro,
// nessun accesso a `env`, nessuna rete — la lettura KV resta in `index.js`.

/**
 * Sceglie una data dall'archivio in modo deterministico per `giornoKey`
 * (stesso schema già in uso per `/w/random`, index.js): la scelta resta
 * stabile per tutta la giornata e cambia da sé al giorno dopo. Deliberatamente
 * NON `Math.random`: un valore che cambia a ogni richiesta renderebbe la
 * risposta non cacheabile e farebbe cambiare lo sfondo a ogni retry della
 * Shortcut.
 *
 * @param {string[]} date - date `YYYY-MM-DD` come le restituisce `listArchiveDates`.
 * @param {string} giornoKey - chiave del giorno corrente (`todayKey()`), `YYYY-MM-DD`.
 * @returns {string|null} una data dell'array, o `null` su input degeneri (mai un'eccezione).
 */
export function scegliDataRotazione(date, giornoKey) {
  if (!Array.isArray(date) || date.length === 0) return null;
  const day = Date.parse(giornoKey);
  if (Number.isNaN(day)) return null;
  const indice = Math.floor(day / 86400000) % date.length;
  return date[indice];
}

/**
 * Sceglie una data a caso dall'archivio, per il comando «un giorno a caso»
 * della pagina `/archivi/<id>`. Qui, a differenza di `scegliDataRotazione`,
 * `Math.random()` è lecito: la risposta è un redirect HTML `no-store` (mai
 * cacheato) e non un'immagine `/w/` che una Shortcut potrebbe ritentare —
 * niente si rompe se due tocchi consecutivi pescano date diverse.
 *
 * @param {string[]} date - date `YYYY-MM-DD` come le restituisce `listArchiveDates`.
 * @param {number} [r] - numero in [0,1), iniettabile per rendere i test deterministici.
 * @returns {string|null} una data dell'array, o `null` su input degeneri (mai un'eccezione).
 */
export function scegliDataACaso(date, r = Math.random()) {
  if (!Array.isArray(date) || date.length === 0) return null;
  if (typeof r !== "number" || !Number.isFinite(r) || r < 0 || r >= 1) return null;
  const indice = Math.floor(r * date.length);
  return date[indice];
}
