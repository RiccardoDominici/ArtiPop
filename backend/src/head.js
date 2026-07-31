// s-anteprima-e-icona-quando-il-link-viene-condiviso: unica fonte di verità
// per i tag di `<head>` condivisi da più pagine (icona + anteprima social),
// così le quattro pagine HTML del worker non duplicano lo stesso markup.
//
// Solo token già presenti in VISUAL_SPECS §1.1 (`--bg` #0a0b10, accenti
// natura #7ec8a9/#f2b878): nessun colore nuovo, nessuna risorsa esterna.

// Icona inline: cerchio di sfondo `--bg` con un glifo a goccia nel gradiente
// natura. Data-URI URL-encoded a mano (niente encodeURIComponent qui: servono
// solo i caratteri che romperebbero l'attributo href).
const FAVICON_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
  `<circle cx='32' cy='32' r='32' fill='%230a0b10'/>` +
  `<path d='M32 12c10 12 16 20 16 28a16 16 0 1 1-32 0c0-8 6-16 16-28z' fill='%237ec8a9'/>` +
  `<circle cx='32' cy='42' r='8' fill='%23f2b878'/>` +
  `</svg>`;

export const FAVICON_TAG = `<link rel="icon" href="data:image/svg+xml,${FAVICON_SVG}" />`;

/**
 * Tag Open Graph / Twitter Card per l'anteprima quando il link viene
 * condiviso (iMessage/WhatsApp/Telegram). Titolo e descrizione vanno
 * riusati alla lettera da chi chiama, non reinventati qui.
 */
export function metaAnteprima(origin, todayKey, title, description) {
  const url = origin;
  // Immagine del giorno: si riusa /w/natura?v=<oggi>, la variante cacheabile
  // un'ora del ciclo 7 — mai un asset nuovo da mantenere.
  const image = `${origin}/w/natura?v=${todayKey}`;
  return `<meta property="og:type" content="website" />
<meta property="og:site_name" content="ArtiPop" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary" />`;
}
