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

// Data YYYY-MM-DD → "28 luglio 2026". Mezzogiorno UTC fisso per non far
// scivolare il giorno per via del fuso (vedi CONFIG.TIMEZONE altrove): qui
// la data è già una chiave calendario, non un istante da localizzare.
function dataEstesaItaliana(dataKey) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dataKey}T12:00:00Z`));
}

/**
 * Tag Open Graph / Twitter Card per l'anteprima quando il link viene
 * condiviso (iMessage/WhatsApp/Telegram). Titolo e descrizione vanno
 * riusati alla lettera da chi chiama, non reinventati qui.
 *
 * `condiviso` (opzionale) = `{ canale, data }`: quando presente e già
 * validato da chi chiama (rotta `/`, vedi index.js), l'anteprima segue il
 * giorno e il canale condivisi invece del wallpaper di oggi di natura —
 * altrimenti chi riceve un link per-giorno vede sempre e solo l'oggi
 * (feat-l-anteprima-del-link-condiviso-mostra-quel-giorno).
 */
export function metaAnteprima(origin, todayKey, title, description, condiviso = null) {
  const image = condiviso
    ? `${origin}/w/${condiviso.canale}?date=${condiviso.data}`
    : `${origin}/w/natura?v=${todayKey}`;
  const url = condiviso ? `${origin}/?c=${condiviso.canale}&d=${condiviso.data}` : origin;
  const titoloOg = condiviso
    ? `ArtiPop — ${condiviso.canale}, ${dataEstesaItaliana(condiviso.data)}`
    : title;
  return `<meta property="og:type" content="website" />
<meta property="og:site_name" content="ArtiPop" />
<meta property="og:title" content="${titoloOg}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary" />`;
}
