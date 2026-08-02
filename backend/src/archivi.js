// Pagina /archivi — riapre tutti i canali con giorni in archivio: sia quelli
// storici (island, bloom, studio, neon, …) non più attivi sia quelli ancora
// in corso, entrambi consultabili via /w/<id>?date=<data>.
//
// Sta in un modulo separato da page.js e help.js per lo stesso motivo di
// help.js: ciclo di vita diverso (cambia solo quando cambia l'elenco degli
// archivi, mai insieme al deck della home). Nessun JavaScript, nessuna
// `fetch`: la lista arriva già pronta da chi chiama (index.js), la pagina si
// limita a renderla — coerente con la guardia `fetches.length === 1` sulla
// home, che questo modulo non tocca.

import { INSTALL_TAGS, metaAnteprima, dataEstesaItaliana, canonicalTag, feedLinkTag } from "./head.js";
import { LEGACY_ALIASES, getChannel } from "./channels.js";

/** Escape minimo per il testo dinamico inserito nell'HTML (id canale, date). */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Data d'archivio in forma leggibile: `<time datetime="YYYY-MM-DD">2 agosto
 * 2026</time>` (feat-le-date-d-archivio-si-leggono-in-italiano), riusata sia
 * dall'intestazione del giorno (`renderGiornoArchivio`) sia dall'intervallo
 * delle card (`renderElenco`). Con una chiave non valida ripiega sul testo
 * grezzo già escapato, senza `<time>`: mai "Invalid Date" in pagina.
 */
function rigaData(dataKey) {
  if (typeof dataKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dataKey)) {
    return esc(dataKey);
  }
  return `<time datetime="${esc(dataKey)}">${esc(dataEstesaItaliana(dataKey))}</time>`;
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
 * Riga «canale in corso — vai a …», gemella di `rigaErede` per un canale
 * ANCORA attivo (feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-archivio):
 * stesso markup/token (`riga3 continua`), mutuamente esclusiva con
 * `rigaErede` — un canale attivo non ha mai un erede. Con id non risolvibile
 * da `getChannel` (dato incoerente) nessuna riga, mai un link rotto.
 */
function rigaInCorso(id) {
  const channel = getChannel(id);
  if (!channel) return "";
  return `
        <div class="riga3 continua">canale in corso — vai a <a class="continua" href="/?c=${encodeURIComponent(channel.id)}">${esc(channel.emoji)} ${esc(channel.name)} →</a></div>`;
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
 * Riga del racconto (testo della tappa) della pagina di un giorno d'archivio:
 * emessa solo se il testo è una stringa non vuota, mai un paragrafo vuoto.
 */
function rigaRacconto(testoTappa) {
  if (typeof testoTappa !== "string" || testoTappa.trim() === "") return "";
  return `
        <p class="racconto">${esc(testoTappa)}</p>`;
}

/**
 * Riga della posizione nella storia («arco N · giorno M · tappa K») della
 * pagina di un giorno d'archivio: stesso pattern di guardia ed escaping di
 * `rigaSoggetto`/`rigaRacconto`, emessa solo con le voci disponibili
 * (`Number.isFinite`, non un test di verità: 0 è un valore valido, non
 * un'assenza). Stringa vuota se nessuno dei tre campi è disponibile — i
 * giorni ricostruiti/assenti di `handlers.js` (`arco/giornoNellArco/tappa:
 * null`) non producono alcun markup.
 *
 * CONFINE base-zero/base-uno (storage.js:84-98): nella carta d'identità
 * `giornoNellArco` e `tappa` sono GIÀ base-uno (`dayInArc + 1`, `stage + 1`)
 * e si mostrano tali qui sotto, mentre `arco` è l'`arcIndex` GREZZO
 * base-zero e va convertito con `arco + 1` — è l'unico punto in cui è facile
 * sbagliare.
 */
function rigaPosizione(arco, giornoNellArco, tappa) {
  const voci = [];
  if (Number.isFinite(arco)) voci.push(`arco ${arco + 1}`);
  if (Number.isFinite(giornoNellArco)) voci.push(`giorno ${giornoNellArco}`);
  if (Number.isFinite(tappa)) voci.push(`tappa ${tappa}`);
  if (voci.length === 0) return "";
  return `
        <div class="soggetto">${voci.join(" · ")}</div>`;
}

/**
 * Chiave e forma estesa italiana del mese di una data d'archivio, usate da
 * `elencoGiorni` per raggruppare — riusa `Intl.DateTimeFormat("it-IT", {
 * month: "long", year: "numeric", timeZone: "UTC" })` a mezzogiorno UTC,
 * stessa scelta e stesso motivo di `dataEstesaItaliana` (head.js:69-76): la
 * data è una chiave calendario, non un istante. Chiavi non conformi a
 * `YYYY-MM-DD` (malformate o mancanti) ricadono nel gruppo condiviso «altri
 * giorni», mai su un "Invalid Date".
 */
function etichettaMese(dataKey) {
  if (typeof dataKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dataKey)) {
    return { chiave: "altri-giorni", label: "altri giorni" };
  }
  const istante = new Date(`${dataKey}T12:00:00Z`);
  if (Number.isNaN(istante.getTime())) {
    return { chiave: "altri-giorni", label: "altri giorni" };
  }
  const label = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(istante);
  return { chiave: dataKey.slice(0, 7), label };
}

/** Riga `<li>` di una singola data dentro `elencoGiorni`: stesso link/aria-current/↓ di sempre. */
function vocegiorno(id, d, dataCorrente) {
  const voce =
    d === dataCorrente
      ? `<span aria-current="page">${esc(d)}</span>`
      : `<a href="/archivi/${encodeURIComponent(id)}?date=${encodeURIComponent(d)}">${esc(d)}</a>`;
  return `<li>${voce}<a class="salva-giorno" href="/w/${encodeURIComponent(id)}?date=${encodeURIComponent(d)}&amp;dl=1" aria-label="Salva il wallpaper del ${esc(d)}">↓</a></li>`;
}

/**
 * Blocco `<details class="giorni">` con l'elenco di tutti i giorni di un
 * canale, condiviso fra l'elenco (`renderElenco`) e la pagina di un singolo
 * giorno (`renderGiornoArchivio`): stesso summary esterno «tutti i N
 * giorn(o|i)», stessi link `/archivi/<id>?date=<data>` e di salvataggio `↓`,
 * stesso ordine dalla più recente alla più vecchia. Se `dataCorrente`
 * corrisponde a una voce, quella riga viene emessa come testo non cliccabile
 * con `aria-current="page"` (VISUAL_SPECS §2.2) invece che come link verso se
 * stessa. Restituisce stringa vuota se `date` non è un array non vuoto.
 *
 * feat-l-archivio-storico-si-sfoglia-per-mese: internamente le date sono
 * raggruppate in `<details class="mese">`, uno per mese di calendario,
 * nell'ordine di prima comparsa (nessun riordino, nessuna deduplica). Le
 * chiavi malformate finiscono tutte nell'ultimo gruppo «altri giorni», mai
 * scartate. Solo il gruppo che contiene `dataCorrente` è aperto di default;
 * con un solo gruppo, quel gruppo resta aperto comunque.
 */
function elencoGiorni(id, date, dataCorrente = null) {
  if (!Array.isArray(date) || date.length === 0) return "";

  const ordine = [];
  const perChiave = new Map();
  let altriGiorni = null;
  for (const d of date) {
    const { chiave, label } = etichettaMese(d);
    if (chiave === "altri-giorni") {
      if (!altriGiorni) altriGiorni = { label, voci: [] };
      altriGiorni.voci.push(d);
      continue;
    }
    let gruppo = perChiave.get(chiave);
    if (!gruppo) {
      gruppo = { label, voci: [] };
      perChiave.set(chiave, gruppo);
      ordine.push(gruppo);
    }
    gruppo.voci.push(d);
  }
  const gruppi = altriGiorni ? [...ordine, altriGiorni] : ordine;
  const unicoGruppo = gruppi.length === 1;

  const blocchiMese = gruppi
    .map((gruppo) => {
      const n = gruppo.voci.length;
      const plurale = n === 1 ? "o" : "i";
      const aperto = unicoGruppo || gruppo.voci.includes(dataCorrente);
      return `
          <details class="mese"${aperto ? " open" : ""}>
            <summary aria-label="${esc(gruppo.label)} — ${n} giorn${plurale} di ${esc(id)}">${esc(gruppo.label)} — ${n} giorn${plurale}</summary>
            <ul class="date">${gruppo.voci.map((d) => vocegiorno(id, d, dataCorrente)).join("")}</ul>
          </details>`;
    })
    .join("");

  return `
        <details class="giorni">
          <summary aria-label="tutti i ${date.length} giorn${date.length === 1 ? "o" : "i"} di ${esc(id)}">tutti i ${date.length} giorn${date.length === 1 ? "o" : "i"}</summary>${blocchiMese}
        </details>`;
}

/**
 * Elenco degli archivi (o messaggio umano se vuoto). `storici`: array
 * ordinato da chi chiama, forma
 * `[{ id, giorni, prima, ultima, date, elementNome, conceptNome, attivo }]` —
 * stessa forma di `listChannelsWithArchive` (storage.js) una volta appiattita
 * la Map in voci con `id`, arricchita da `cartaDiIdentita` (handlers.js) e
 * `attivo` (feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-archivio: `id`
 * è in `ACTIVE_CHANNELS`). Nonostante il nome, l'elenco comprende ora anche i
 * canali ancora attivi che hanno giorni in archivio, non solo quelli
 * storici. `date` (dalla più recente alla più vecchia), `elementNome` e
 * `conceptNome` sono opzionali: se assenti l'elenco espandibile / la riga del
 * soggetto non vengono emessi (chiamata legacy).
 */
function renderElenco(storici) {
  if (!Array.isArray(storici) || storici.length === 0) {
    return `<p class="msg">Nessun archivio storico da mostrare.</p>`;
  }
  const righe = storici
    .map((c) => {
      const riga3 = c.attivo ? rigaInCorso(c.id) : rigaErede(c.id);
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
          <span class="intervallo">${rigaData(c.prima)} → ${rigaData(c.ultima)}</span>
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
  details.mese { margin-top: 6px; }
  details.mese summary { color: #9aa3b8; font-size: .88rem; cursor: pointer; }
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
  .racconto { color: #f2f3f8; margin: 12px 0 0; }
  figure.foto { margin: 24px 0 0; }
  figure.foto a.apri { display: block; }
  figure.foto a.apri:focus-visible { outline: 2px solid #8fd3ff; outline-offset: 2px; border-radius: 14px; }
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
  nav.giorni-nav a.precedente, nav.giorni-nav a.successivo {
    display: inline-flex; flex-direction: column; gap: 6px; align-items: center;
  }
  nav.giorni-nav a .mini {
    width: 60px; height: 128px; object-fit: cover; border-radius: 10px;
    border: 1px solid rgba(255,255,255,.10);
  }
  nav.altri-canali {
    display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start;
    gap: 10px 16px; margin: 20px 0 0; max-width: 420px; margin-left: auto; margin-right: auto;
  }
  nav.altri-canali .sub { flex-basis: 100%; text-align: center; margin: 0 0 4px; }
  nav.altri-canali a {
    display: inline-flex; flex-direction: column; gap: 6px; align-items: center;
    text-decoration: none; font-weight: 600; color: #8fd3ff; min-height: 44px;
  }
  nav.altri-canali a .mini {
    width: 60px; height: 128px; object-fit: cover; border-radius: 10px;
    border: 1px solid rgba(255,255,255,.10);
  }
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
<title>ArtiPop — archivi</title>
<meta name="description" content="Tutti i canali di ArtiPop con giorni in archivio, in corso e non, con i loro giorni consultabili." />
${INSTALL_TAGS}
${canonicalTag(origin, "/archivi")}
${origin && dataOggi ? metaAnteprima(origin, dataOggi, "ArtiPop — archivi", "Tutti i canali di ArtiPop con giorni in archivio, in corso e non, con i loro giorni consultabili.", null, "/archivi") : ""}
<style>${BASE_STYLE}${ARCHIVI_STYLE}</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/">← torna ad ArtiPop</a>
    <h1>Archivi</h1>
    <p class="sub">Tutti i canali con giorni in archivio, in corso e non: qui trovi l'elenco e il link all'ultimo giorno di ciascuno.</p>
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
 *
 * feat-dall-archivio-si-segue-il-canale-col-lettore-di-feed: la barra include
 * anche «segui col lettore di feed» verso `/feed/<id>.xml` (stesso indirizzo
 * di `#feedlink` in `page.js` e della rotta in `index.js`), e il `<head>`
 * porta l'autodiscovery `feedLinkTag` — assente senza `origin`, mai un `href`
 * monco, coerente con `canonicalTag`/`metaAnteprima` qui sopra.
 *
 * feat-riscopri-un-giorno-a-caso-dall-archivio: con almeno 2 giorni in
 * archivio, la barra include anche «un giorno a caso» verso
 * `/archivi/<id>?date=casuale` (rotta gestita in `index.js` con
 * `scegliDataACaso`, rotazione.js). Con un solo giorno il comando non si
 * emette: porterebbe sempre alla pagina già aperta, un link inutile.
 */
export function renderGiornoArchivio({ id, data, date, soggetto = {}, origin = null, altriCanali = [] }) {
  const idx = Array.isArray(date) ? date.indexOf(data) : -1;
  const precedente = idx >= 0 && idx + 1 < date.length ? date[idx + 1] : null;
  const successivo = idx > 0 ? date[idx - 1] : null;

  const encId = encodeURIComponent(id);
  const encData = encodeURIComponent(data);

  const linkPrecedente = precedente
    ? `<a class="precedente" href="/archivi/${encId}?date=${encodeURIComponent(precedente)}"><img class="mini" src="/w/${encId}?date=${encodeURIComponent(precedente)}" alt="" loading="lazy" decoding="async" width="60" height="128" />← giorno precedente</a>`
    : "";
  const linkSuccessivo = successivo
    ? `<a class="successivo" href="/archivi/${encId}?date=${encodeURIComponent(successivo)}"><img class="mini" src="/w/${encId}?date=${encodeURIComponent(successivo)}" alt="" loading="lazy" decoding="async" width="60" height="128" />giorno successivo →</a>`
    : "";

  const linkACaso =
    Array.isArray(date) && date.length >= 2
      ? `<a class="salva" href="/archivi/${encId}?date=casuale" aria-label="Apri un giorno a caso dell'archivio di ${esc(id)}">un giorno a caso</a>`
      : "";

  const rigaSogg = rigaSoggetto(soggetto?.elementNome, soggetto?.conceptNome);
  const rigaPos = rigaPosizione(soggetto?.arco, soggetto?.giornoNellArco, soggetto?.tappa);
  const rigaRacc = rigaRacconto(soggetto?.testoTappa);
  const elencoGiorniGiorno = elencoGiorni(id, date, data);
  const riga3 = rigaErede(id);

  // feat-quel-giorno-negli-altri-canali: con `altriCanali` vuoto (nessun
  // altro canale ha questa data, o il calcolo in index.js è fallito) il
  // blocco non viene emesso affatto — retrocompatibile con ogni chiamata
  // esistente che non passa il parametro.
  const altriCanaliNav =
    Array.isArray(altriCanali) && altriCanali.length > 0
      ? `<nav class="altri-canali" aria-label="Questo giorno negli altri canali">
    <p class="sub">Quel giorno negli altri canali</p>
    ${altriCanali
      .map((altroId) => {
        const encAltro = encodeURIComponent(altroId);
        return `<a href="/archivi/${encAltro}?date=${encData}"><img class="mini" src="/w/${encAltro}?date=${encData}" alt="" loading="lazy" decoding="async" width="60" height="128" />${esc(altroId)}</a>`;
      })
      .join("")}
  </nav>`
      : "";

  const titolo = `ArtiPop — ${esc(id)}, ${esc(data)}`;
  const descrizione = `Il giorno ${esc(data)} dell'archivio storico di ${esc(id)}.`;
  const percorso = `/archivi/${encId}?date=${encData}`;
  const feedPath = `/feed/${encId}.xml`;

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${titolo}</title>
<meta name="description" content="${descrizione}" />
${INSTALL_TAGS}
${canonicalTag(origin, percorso)}
${origin ? feedLinkTag(`${origin}${feedPath}`) : ""}
${origin ? metaAnteprima(origin, data, `ArtiPop — ${id}, ${data}`, `Il giorno ${data} dell'archivio storico di ${id}.`, { canale: id, data }, percorso) : ""}
<style>${BASE_STYLE}${GIORNO_STYLE}</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/archivi">← tutti gli archivi</a>
    <h1>${esc(id)}</h1>
    <p class="sub">${rigaData(data)}</p>
  </header>${rigaSogg}${rigaPos}${rigaRacc}
  <figure class="foto">
    <a class="apri" href="/w/${encId}?date=${encData}" target="_blank" rel="noopener" aria-label="Apri a grandezza piena il wallpaper di ${esc(id)} del ${esc(data)}">
      <img src="/w/${encId}?date=${encData}" alt="${esc(id)} — sfondo del ${esc(data)}" loading="lazy" decoding="async" />
    </a>
  </figure>${altriCanaliNav}
  <nav class="giorni-nav" aria-label="Sfoglia i giorni dell'archivio">
    ${linkPrecedente}
    ${linkSuccessivo}
    <a class="salva" href="/w/${encId}?date=${encData}&amp;dl=1" aria-label="Salva il wallpaper del ${esc(data)}">Salva</a>
    <a class="salva" href="${feedPath}">segui col lettore di feed</a>${linkACaso}
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
