// Pagina /archivi — riapre i canali storici (island, bloom, studio, neon, …)
// che non sono più attivi ma restano consultabili via /w/<id>?date=<data>.
//
// Sta in un modulo separato da page.js e help.js per lo stesso motivo di
// help.js: ciclo di vita diverso (cambia solo quando cambia l'elenco degli
// archivi, mai insieme al deck della home). Nessun JavaScript, nessuna
// `fetch`: la lista arriva già pronta da chi chiama (index.js), la pagina si
// limita a renderla — coerente con la guardia `fetches.length === 1` sulla
// home, che questo modulo non tocca.

import { FAVICON_TAG } from "./head.js";

/** Escape minimo per il testo dinamico inserito nell'HTML (id canale, date). */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Elenco degli archivi (o messaggio umano se vuoto). `storici`: array già
 * filtrato (nessun canale attivo) e ordinato da chi chiama, forma
 * `[{ id, giorni, prima, ultima }]` — stessa forma di `listChannelsWithArchive`
 * (storage.js) una volta appiattita la Map in voci con `id`.
 */
function renderElenco(storici) {
  if (!Array.isArray(storici) || storici.length === 0) {
    return `<p class="msg">Nessun archivio storico da mostrare.</p>`;
  }
  const righe = storici
    .map(
      (c) => `
      <li>
        <div class="riga1"><span class="nome">${esc(c.id)}</span><span class="giorni">${c.giorni} giorn${c.giorni === 1 ? "o" : "i"}</span></div>
        <div class="riga2">
          <span class="intervallo">${esc(c.prima)} → ${esc(c.ultima)}</span>
          <a class="riapri" href="/w/${encodeURIComponent(c.id)}?date=${encodeURIComponent(c.ultima)}">Riapri l'ultimo giorno →</a>
        </div>
      </li>`
    )
    .join("");
  return `<ul class="archivi">${righe}</ul>`;
}

/**
 * Pagina `/archivi` completa (HTML autoconsistente, nessuna risorsa esterna,
 * nessuno `<script>`). `storici`: array come sopra, `[]` se non ce ne sono,
 * `null` se la scansione KV è fallita — in entrambi i casi la pagina resta
 * 200 e leggibile con un messaggio diverso (vedi CRITERI del piano).
 */
export function renderArchiviPage(storici) {
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
  }
  .riga1 { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
  .riga1 .giorni { color: #9aa3b8; font-weight: 400; }
  .riga2 { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px; }
  .intervallo { color: #9aa3b8; font-size: .88rem; }
  a.riapri {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px;
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
