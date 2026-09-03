// s-anteprima-e-icona-quando-il-link-viene-condiviso: unica fonte di verità
// per i tag di `<head>` condivisi da più pagine (icona + anteprima social),
// così le quattro pagine HTML del worker non duplicano lo stesso markup.
//
// Solo token già presenti in VISUAL_SPECS §1.1 (`--bg` #DCE2D2 Salvia,
// goccia muschio #5C6E58, sole erba #7A7A52): nessun colore nuovo, nessuna
// risorsa esterna.

// Icona: cerchio inchiostro Salvia con un glifo a goccia muschio/erba.
// `ICON_SVG` è la sorgente unica (markup SVG vero, `#` non
// codificato) — serve sia come file a sé (feat-aggiungi-artipop-alla-
// schermata-home: rotta `/icona.svg` per il manifest, che non può puntare a
// un `data:` inline) sia per la favicon inline qui sotto.
export const ICON_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
  `<circle cx='32' cy='32' r='32' fill='#2B3028'/>` +
  `<path d='M32 12c10 12 16 20 16 28a16 16 0 1 1-32 0c0-8 6-16 16-28z' fill='#5C6E58'/>` +
  `<circle cx='32' cy='42' r='8' fill='#7A7A52'/>` +
  `</svg>`;

// Data-URI URL-encoded a mano (niente encodeURIComponent qui: servono solo
// i caratteri che romperebbero l'attributo href).
const FAVICON_SVG = ICON_SVG.replace(/#/g, "%23");

export const FAVICON_TAG = `<link rel="icon" href="data:image/svg+xml,${FAVICON_SVG}" />`;

/**
 * Tag d'installazione sulla schermata Home
 * (feat-aggiungi-artipop-alla-schermata-home): manifest, colore della
 * barra di stato, e i meta Apple che su iOS abilitano l'apertura a tutto
 * schermo e il nome breve sotto l'icona (l'icona vera resta lo screenshot
 * finché non esiste un `apple-touch-icon` PNG — fetta separata, non qui).
 */
export const INSTALL_TAGS = `${FAVICON_TAG}
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#DCE2D2" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ArtiPop" />`;

/**
 * Registrazione del service worker (backend/src/sw.js, rotta /sw.js): tag
 * inline in try/catch e dietro un controllo di supporto, così con JavaScript
 * disattivato o service worker non supportati non cambia nulla. NON fa parte
 * di `INSTALL_TAGS`: quel testo è condiviso anche da `renderArchiviPage`
 * (archivi.js), la cui suite impone "nessuno <script> nell'HTML" come
 * garanzia di funzionamento senza JS — la funzione pura deve restare
 * script-free. La rotta le inserisce direttamente nella risposta finale
 * (vedi index.js), dove può scegliere in quali pagine iniettarlo senza
 * toccare quell'invariante.
 */
export const SW_REGISTER_TAG =
  `<script>if("serviceWorker" in navigator){try{navigator.serviceWorker.register("/sw.js")}catch(e){}}</script>`;

/**
 * `<link rel="alternate">` verso il feed RSS di un canale
 * (feat-segui-il-canale-dal-lettore-di-feed): assente se `feedUrl` non è
 * passato, così `/aiuto` e `/archivi` (che non lo passano) restano invariati.
 */
export function feedLinkTag(feedUrl) {
  if (!feedUrl) return "";
  return `<link rel="alternate" type="application/rss+xml" title="ArtiPop" href="${feedUrl}" />`;
}

/**
 * `<link rel="canonical">`: dichiara l'indirizzo ufficiale della pagina
 * (feat-un-solo-indirizzo-ufficiale-per-ogni-pagina), così i suoi alias
 * (es. `/aiuto.html`, `/help` → `/aiuto`) e le varianti per-query (`?c=`/`?d=`
 * sulla home) non appaiono ai motori come copie senza indirizzo preferito.
 * Stringa vuota se `origin` è assente, stessa guardia di `feedLinkTag`: mai
 * un indirizzo finto inventato.
 */
export function canonicalTag(origin, percorso = "/") {
  if (!origin) return "";
  return `<link rel="canonical" href="${origin}${percorso}" />`;
}

// Data YYYY-MM-DD → "28 luglio 2026". Mezzogiorno UTC fisso per non far
// scivolare il giorno per via del fuso (vedi CONFIG.TIMEZONE altrove): qui
// la data è già una chiave calendario, non un istante da localizzare.
// Esportata perché condivisa anche dalle pagine d'archivio (archivi.js),
// che la usano per mostrare la data in forma estesa invece della chiave grezza.
export function dataEstesaItaliana(dataKey) {
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
 *
 * `percorso` (opzionale) = il path della pagina che sta condividendo il
 * link (es. "/aiuto", oppure "/archivi/<id>?date=<data>" per un giorno
 * d'archivio). Componibile con `condiviso`: una pagina con un indirizzo
 * proprio deve dichiarare QUEL indirizzo anche quando l'anteprima segue
 * `condiviso`, altrimenti chi apre il link finisce sulla home di un canale
 * che non è più attivo. Senza `percorso`, l'`og:url` del ramo `condiviso`
 * resta `/?c=&d=` come oggi (comportamento della home, invariato). Senza
 * `condiviso` né `percorso`, il comportamento resta identico a oggi.
 */
export function metaAnteprima(origin, todayKey, title, description, condiviso = null, percorso = "") {
  const image = condiviso
    ? `${origin}/w/${condiviso.canale}?date=${condiviso.data}`
    : `${origin}/w/natura?v=${todayKey}`;
  const url = percorso
    ? `${origin}${percorso}`
    : condiviso
      ? `${origin}/?c=${condiviso.canale}&d=${condiviso.data}`
      : origin;
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
