// Pagina /archivi — riapre i canali storici (island, bloom, studio, neon, …)
// che non sono più attivi ma restano consultabili via /w/<id>?date=<data>.
//
// Sta in un modulo separato da page.js e help.js per lo stesso motivo di
// help.js: ciclo di vita diverso (cambia solo quando cambia l'elenco degli
// archivi, mai insieme al deck della home). Nessun JavaScript, nessuna
// `fetch`: la lista arriva già pronta da chi chiama (index.js), la pagina si
// limita a renderla — coerente con la guardia `fetches.length === 1` sulla
// home, che questo modulo non tocca.

import { INSTALL_TAGS, metaAnteprima } from "./head.js";
import { LEGACY_ALIASES, getChannel } from "./channels.js";

/** Escape minimo per il testo dinamico inserito nell'HTML (id canale, date). */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Il flusso attivo che ha raccolto l'eredità di un canale storico, o `null`
 * se l'id non ha alias o l'erede non è (più) attivo.
 */
function erede(id) {
  const targetId = LEGACY_ALIASES[id];
  if (!targetId) return null;
  const channel = getChannel(targetId);
  if (!channel || !channel.active) return null;
  return channel;
}

/**
 * Riga «la storia continua in …», condivisa fra l'elenco (`renderElenco`) e
 * la pagina di un singolo giorno (`renderGiornoArchivio`): stesso markup,
 * un solo punto che sa come chiamare `erede()`.
 */
function rigaErede(id) {
  const flussoErede = erede(id);
  if (!flussoErede) return "";
  return `
        <div class="riga3 continua">la storia continua in <a class="continua" href="/?c=${encodeURIComponent(flussoErede.id)}">${esc(flussoErede.emoji)} ${esc(flussoErede.name)} →</a></div>`;
}

/**
 * Riga del soggetto (`elementNome · conceptNome`), condivisa fra le card
 * dell'elenco e la pagina di un giorno: emessa solo se almeno uno dei due
 * nomi è disponibile.
 */
function rigaSoggetto(elementNome, conceptNome) {
  if (!elementNome && !conceptNome) return "";
  return `
        <div class="soggetto">${[elementNome, conceptNome].filter(Boolean).map(esc).join(" · ")}</div>`;
}

/**
 * Blocco `<details class="giorni">` con l'elenco di tutti i giorni di un
 * canale, condiviso fra l'elenco (`renderElenco`) e la pagina di un singolo
 * giorno (`renderGiornoArchivio`): stesso summary «tutti i N giorn(o|i)»,
 * stessi link `/archivi/<id>?date=<data>` e di salvataggio `↓`, stesso ordine
 * dalla più recente alla più vecchia. Se `dataCorrente` corrisponde a una
 * voce, quella riga viene emessa come testo non cliccabile con
 * `aria-current="page"` (VISUAL_SPECS §2.2) invece che come link verso se
 * stessa. Restituisce stringa vuota se `date` non è un array non vuoto.
 */
function elencoGiorni(id, date, dataCorrente = null) {
  if (!Array.isArray(date) || date.length === 0) return "";
  return `
        <details class="giorni">
          <summary aria-label="tutti i ${date.length} giorn${date.length === 1 ? "o" : "i"} di ${esc(id)}">tutti i ${date.length} giorn${date.length === 1 ? "o" : "i"}</summary>
          <ul class="date">${date
            .map((d) => {
              const voce =
                d === dataCorrente
                  ? `<span aria-current="page">${esc(d)}</span>`
                  : `<a href="/archivi/${encodeURIComponent(id)}?date=${encodeURIComponent(d)}">${esc(d)}</a>`;
              return `<li>${voce}<a class="salva-giorno" href="/w/${encodeURIComponent(id)}?date=${encodeURIComponent(d)}&amp;dl=1" aria-label="Salva il wallpaper del ${esc(d)}">↓</a></li>`;
            })
            .join("")}</ul>
        </details>`;
}

/**
 * Elenco degli archivi (o messaggio umano se vuoto). `storici`: array già
 * filtrato (nessun canale attivo) e ordinato da chi chiama, forma
 * `[{ id, giorni, prima, ultima, date, elementNome, conceptNome }]` — stessa
 * forma di `listChannelsWithArchive` (storage.js) una volta appiattita la Map
 * in voci con `id`, arricchita da `cartaDiIdentita` (handlers.js). `date`
 * (dalla più recente alla più vecchia), `elementNome` e `conceptNome` sono
 * opzionali: se assenti l'elenco espandibile / la riga del soggetto non
 * vengono emessi (chiamata legacy).
 */
function renderElenco(storici) {
  if (!Array.isArray(storici) || storici.length === 0) {
    return `<p class="msg">Nessun archivio storico da mostrare.</p>`;
  }
  const righe = storici
    .map((c) => {
      const riga3 = rigaErede(c.id);
      const elencoGiorniCard = elencoGiorni(c.id, c.date);
      const copertina = c.ultima
        ? `
        <a class="copertina" aria-hidden="true" tabindex="-1" href="/archivi/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}"><img src="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}" alt="" loading="lazy" decoding="async" width="60" height="128" /></a>`
        : "";
      const salva = c.ultima
        ? `<a class="salva" href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}&amp;dl=1" aria-label="Salva l'ultimo wallpaper di ${esc(c.id)}">Salva</a>`
        : "";
      const soggetto = rigaSoggetto(c.elementNome, c.conceptNome);
      return `
      <li>${copertina}
        <div class="contenuto">
        <div class="riga1"><span class="nome">${esc(c.id)}</span><span class="giorni">${c.giorni} giorn${c.giorni === 1 ? "o" : "i"}</span></div>${soggetto}
        <div class="riga2">
          <span class="intervallo">${esc(c.prima)} → ${esc(c.ultima)}</span>
          <a class="riapri" href="/archivi/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}" aria-label="Riapri l'ultimo giorno di ${esc(c.id)}">Riapri l'ultimo giorno →</a>${salva}
        </div>${elencoGiorniCard}${riga3}
        </div>
      </li>`;
    })
    .join("");
  return `<ul class="archivi">${righe}</ul>`;
}

/** Regole condivise da tutte le pagine di questo modulo (elenco e singolo giorno): la
 * palette, i font, l'header e il footer vivono qui un'unica volta, così §2/§2.1/§2.2
 * di VISUAL_SPECS restano allineati per costruzione invece che per disciplina. */
const BASE_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 20px 80px;
    background: #0a0b10; color: #f2f3f8;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 720px; margin: 0 auto; }
  a { color: #8fd3ff; }
  header { padding: 48px 0 24px; }
  .back {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px;
    margin-left: -6px; margin-bottom: 10px; font-size: .92rem; text-decoration: none; opacity: .8;
  }
  .back:hover { opacity: 1; }
  h1 { margin: 0 0 10px; font-size: clamp(1.8rem, 6vw, 2.4rem); letter-spacing: -.02em; }
  .sub { margin: 0; color: #9aa3b8; }
  .msg { color: #9aa3b8; }
  .soggetto { color: #9aa3b8; font-size: .88rem; margin-top: 2px; }
  .riga3 { margin-top: 6px; font-size: .88rem; color: #9aa3b8; }
  .riga3 a.continua { color: #8fd3ff; }
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; color: #9aa3b8; }
  footer a { display: inline-block; padding: 12px 6px; }
  details.giorni { margin-top: 8px; }
  details.giorni summary { color: #9aa3b8; font-size: .88rem; cursor: pointer; }
  details.giorni ul.date { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; }
  details.giorni ul.date li { display: flex; align-items: center; gap: 6px; }
  details.giorni ul.date a { color: #8fd3ff; font-size: .88rem; display: inline-flex; align-items: center; min-height: 44px; }
  details.giorni ul.date [aria-current] { color: #f2f3f8; font-weight: 600; font-size: .88rem; display: inline-flex; align-items: center; min-height: 44px; }
  a.salva, a.salva-giorno {
    color: #8fd3ff; display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
    text-decoration: none; font-weight: 600; flex-shrink: 0;
  }
`;

/** Regole specifiche dell'elenco `/archivi` (card, copertina). */
const ARCHIVI_STYLE = `
  ul.archivi { list-style: none; margin: 32px 0 0; padding: 0; }
  ul.archivi li {
    border: 1px solid rgba(255,255,255,.10); border-radius: 14px;
    background: rgba(255,255,255,.03); margin-bottom: 10px; padding: 14px 18px;
    display: flex; gap: 14px;
  }
  .contenuto { flex: 1; min-width: 0; }
  .copertina { flex-shrink: 0; display: block; }
  .copertina img {
    width: 60px; height: 128px; object-fit: cover; border-radius: 10px;
    border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03);
    display: block;
  }
  .riga1 { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
  .riga1 .giorni { color: #9aa3b8; font-weight: 400; }
  .riga2 { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px; }
  .intervallo { color: #9aa3b8; font-size: .88rem; }
  a.riapri {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
    text-decoration: none; font-weight: 600; flex-shrink: 0;
  }
`;

/** Regole specifiche della pagina di un giorno (foto grande, barra precedente/successivo). */
const GIORNO_STYLE = `
  figure.foto { margin: 24px 0 0; }
  figure.foto img {
    display: block; width: 100%; max-width: 420px; margin: 0 auto;
    border-radius: 14px; border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03);
  }
  nav.giorni-nav {
    display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
    gap: 10px 16px; margin: 20px 0 0; max-width: 420px; margin-left: auto; margin-right: auto;
  }
  nav.giorni-nav a {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
    text-decoration: none; font-weight: 600;
  }
  nav.giorni-nav a.salva { color: #8fd3ff; }
`;

/**
 * Pagina `/archivi` completa (HTML autoconsistente, nessuna risorsa esterna,
 * nessuno `<script>`). `storici`: array come sopra, `[]` se non ce ne sono,
 * `null` se la scansione KV è fallita — in entrambi i casi la pagina resta
 * 200 e leggibile con un messaggio diverso (vedi CRITERI del piano).
 */
export function renderArchiviPage(storici, origin = null, dataOggi = null) {
  const corpo =
    storici === null
      ? `<p class="msg">Archivi momentaneamente non disponibili.</p>`
      : renderElenco(storici);

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — archivi storici</title>
<meta name="description" content="I canali storici di ArtiPop non più attivi, con i loro giorni in archivio." />
${INSTALL_TAGS}
${origin && dataOggi ? metaAnteprima(origin, dataOggi, "ArtiPop — archivi storici", "I canali storici di ArtiPop non più attivi, con i loro giorni in archivio.", null, "/archivi") : ""}
<style>${BASE_STYLE}${ARCHIVI_STYLE}</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/">← torna ad ArtiPop</a>
    <h1>Archivi storici</h1>
    <p class="sub">I canali non più attivi restano tutti consultabili: qui trovi l'elenco e il link all'ultimo giorno di ciascuno.</p>
  </header>
  ${corpo}
  <footer>
    <a href="/">Home</a> · <a href="/aiuto">Aiuto</a>
  </footer>
</main>
</body>
</html>`;
}

/**
 * Pagina di un giorno d'archivio (`/archivi/<id>?date=<data>`): il wallpaper
 * con intestazione (canale + data), soggetto se disponibile, e la barra
 * precedente/successivo per sfogliare l'archivio senza tornare a `/archivi`
 * ogni volta. Server-rendered come `renderArchiviPage`: nessuno `<script>`,
 * nessuna `fetch`.
 *
 * `date`: array di TUTTE le date del canale, dalla più recente alla più
 * vecchia (stessa forma di `storici[].date` sopra) — serve solo a calcolare
 * precedente/successivo, non viene mostrato per intero come in `/archivi`.
 * Al bordo dell'archivio (giorno più vecchio o più recente) il comando
 * assente non viene emesso: mai un link morto.
 */
export function renderGiornoArchivio({ id, data, date, soggetto = {}, origin = null }) {
  const idx = Array.isArray(date) ? date.indexOf(data) : -1;
  const precedente = idx >= 0 && idx + 1 < date.length ? date[idx + 1] : null;
  const successivo = idx > 0 ? date[idx - 1] : null;

  const encId = encodeURIComponent(id);
  const encData = encodeURIComponent(data);

  const linkPrecedente = precedente
    ? `<a class="precedente" href="/archivi/${encId}?date=${encodeURIComponent(precedente)}">← giorno precedente</a>`
    : "";
  const linkSuccessivo = successivo
    ? `<a class="successivo" href="/archivi/${encId}?date=${encodeURIComponent(successivo)}">giorno successivo →</a>`
    : "";

  const rigaSogg = rigaSoggetto(soggetto?.elementNome, soggetto?.conceptNome);
  const elencoGiorniGiorno = elencoGiorni(id, date, data);
  const riga3 = rigaErede(id);

  const titolo = `ArtiPop — ${esc(id)}, ${esc(data)}`;
  const descrizione = `Il giorno ${esc(data)} dell'archivio storico di ${esc(id)}.`;

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${titolo}</title>
<meta name="description" content="${descrizione}" />
${INSTALL_TAGS}
${origin ? metaAnteprima(origin, data, `ArtiPop — ${id}, ${data}`, `Il giorno ${data} dell'archivio storico di ${id}.`, { canale: id, data }, `/archivi/${encId}?date=${encData}`) : ""}
<style>${BASE_STYLE}${GIORNO_STYLE}</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/archivi">← tutti gli archivi</a>
    <h1>${esc(id)}</h1>
    <p class="sub">${esc(data)}</p>
  </header>${rigaSogg}
  <figure class="foto">
    <img src="/w/${encId}?date=${encData}" alt="${esc(id)} — sfondo del ${esc(data)}" loading="lazy" decoding="async" />
  </figure>
  <nav class="giorni-nav" aria-label="Sfoglia i giorni dell'archivio">
    ${linkPrecedente}
    ${linkSuccessivo}
    <a class="salva" href="/w/${encId}?date=${encData}&amp;dl=1" aria-label="Salva il wallpaper del ${esc(data)}">Salva</a>
  </nav>${elencoGiorniGiorno}${riga3}
  <footer>
    <a href="/archivi">Tutti gli archivi</a> · <a href="/">Home</a> · <a href="/aiuto">Aiuto</a>
  </footer>
</main>
</body>
</html>`;
}

/**
 * Pagina HTML 404 per `/archivi/<id>`: id sconosciuto, canale senza archivio
 * o `?date=` non presente in archivio. Mai JSON, mai la pagina d'errore
 * grezza di Cloudflare (principio 3) — stesso trattamento di
 * `renderShortcutMancante` (help.js) per un'altra rotta pubblica.
 *
 * `date` (opzionale, retrocompatibile): le date d'archivio reali del canale,
 * dalla più recente alla più vecchia (stessa forma di `listArchiveDates`).
 * Se non vuoto, la pagina elenca quei giorni con lo stesso
 * `<details class="giorni">` di `elencoGiorni` (nessun `dataCorrente`: nessun
 * giorno dell'elenco è quello mostrato) invece di lasciare l'utente senza
 * uscita — feat-un-giorno-d-archivio-sbagliato-mostra-quelli-giusti.
 */
export function renderArchivioNonTrovato(id, date = []) {
  const haGiorni = Array.isArray(date) && date.length > 0;
  const sub = haGiorni
    ? `«${esc(id)}» ha un archivio, ma il giorno richiesto non ne fa parte — questi sono i giorni che ${esc(id)} ha davvero:`
    : `«${esc(id)}» non ha un archivio consultabile.`;
  const elenco = haGiorni ? elencoGiorni(id, date) : "";
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — giorno non trovato</title>
${INSTALL_TAGS}
<style>${BASE_STYLE}</style>
</head>
<body>
<main>
  <header>
    <h1>Questo giorno non c'è</h1>
    <p class="sub">${sub}</p>
  </header>${elenco}
  <footer>
    <a href="/archivi">Tutti gli archivi</a> · <a href="/">Home</a>
  </footer>
</main>
</body>
</html>`;
}
