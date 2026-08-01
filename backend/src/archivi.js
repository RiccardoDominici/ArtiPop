// Pagina /archivi — riapre i canali storici (island, bloom, studio, neon, …)
// che non sono più attivi ma restano consultabili via /w/<id>?date=<data>.
//
// Sta in un modulo separato da page.js e help.js per lo stesso motivo di
// help.js: ciclo di vita diverso (cambia solo quando cambia l'elenco degli
// archivi, mai insieme al deck della home). Nessun JavaScript, nessuna
// `fetch`: la lista arriva già pronta da chi chiama (index.js), la pagina si
// limita a renderla — coerente con la guardia `fetches.length === 1` sulla
// home, che questo modulo non tocca.

import { FAVICON_TAG, metaAnteprima } from "./head.js";
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
      const flussoErede = erede(c.id);
      const riga3 = flussoErede
        ? `
        <div class="riga3 continua">la storia continua in <a class="continua" href="/?c=${encodeURIComponent(flussoErede.id)}">${esc(flussoErede.emoji)} ${esc(flussoErede.name)} →</a></div>`
        : "";
      const elencoGiorni =
        Array.isArray(c.date) && c.date.length > 0
          ? `
        <details class="giorni">
          <summary aria-label="tutti i ${c.date.length} giorn${c.date.length === 1 ? "o" : "i"} di ${esc(c.id)}">tutti i ${c.date.length} giorn${c.date.length === 1 ? "o" : "i"}</summary>
          <ul class="date">${c.date
            .map(
              (d) =>
                `<li><a href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(d)}">${esc(d)}</a><a class="salva-giorno" href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(d)}&amp;dl=1" aria-label="Salva il wallpaper del ${esc(d)}">↓</a></li>`
            )
            .join("")}</ul>
        </details>`
          : "";
      const copertina = c.ultima
        ? `
        <a class="copertina" aria-hidden="true" tabindex="-1" href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}"><img src="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}" alt="" loading="lazy" decoding="async" width="60" height="128" /></a>`
        : "";
      const salva = c.ultima
        ? `<a class="salva" href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}&amp;dl=1" aria-label="Salva l'ultimo wallpaper di ${esc(c.id)}">Salva</a>`
        : "";
      const soggetto =
        c.elementNome || c.conceptNome
          ? `
        <div class="soggetto">${[c.elementNome, c.conceptNome].filter(Boolean).map(esc).join(" · ")}</div>`
          : "";
      return `
      <li>${copertina}
        <div class="contenuto">
        <div class="riga1"><span class="nome">${esc(c.id)}</span><span class="giorni">${c.giorni} giorn${c.giorni === 1 ? "o" : "i"}</span></div>${soggetto}
        <div class="riga2">
          <span class="intervallo">${esc(c.prima)} → ${esc(c.ultima)}</span>
          <a class="riapri" href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}" aria-label="Riapri l'ultimo giorno di ${esc(c.id)}">Riapri l'ultimo giorno →</a>${salva}
        </div>${elencoGiorni}${riga3}
        </div>
      </li>`;
    })
    .join("");
  return `<ul class="archivi">${righe}</ul>`;
}

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
<meta name="theme-color" content="#0a0b10" />
${FAVICON_TAG}
${origin && dataOggi ? metaAnteprima(origin, dataOggi, "ArtiPop — archivi storici", "I canali storici di ArtiPop non più attivi, con i loro giorni in archivio.", null, "/archivi") : ""}
<style>
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
  .soggetto { color: #9aa3b8; font-size: .88rem; margin-top: 2px; }
  .riga2 { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px; }
  .intervallo { color: #9aa3b8; font-size: .88rem; }
  .riga3 { margin-top: 6px; font-size: .88rem; color: #9aa3b8; }
  .riga3 a.continua { color: #8fd3ff; }
  details.giorni { margin-top: 8px; }
  details.giorni summary { color: #9aa3b8; font-size: .88rem; cursor: pointer; }
  details.giorni ul.date { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 16px; }
  details.giorni ul.date li { display: flex; align-items: center; gap: 6px; }
  details.giorni ul.date a { color: #8fd3ff; font-size: .88rem; display: inline-flex; align-items: center; min-height: 44px; }
  a.riapri {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
    text-decoration: none; font-weight: 600; flex-shrink: 0;
  }
  a.salva, a.salva-giorno {
    color: #8fd3ff; display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
    text-decoration: none; font-weight: 600; flex-shrink: 0;
  }
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; color: #9aa3b8; }
  footer a { display: inline-block; padding: 12px 6px; }
</style>
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
