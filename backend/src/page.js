// Landing page di ArtiPop: mostra i canali con l'immagine di oggi e le istruzioni
// per installare la Shortcut. Si aggiorna da sola: le anteprime puntano a /w/<canale>
// con la data come cache-buster, quindi ogni giorno la pagina è nuova senza deploy.

import { CHANNELS } from "./channels.js";

/** Escape minimo per testo inserito nell'HTML. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Renderizza la pagina. `metas` è una mappa channelId → meta (da storage.getMeta),
 * `origin` è l'origine pubblica del worker (es. https://artipop.xxx.workers.dev).
 */
export function renderPage(metas, origin, dateKey) {
  const cards = CHANNELS.map((ch) => {
    const meta = metas[ch.id];
    const imgUrl = `/w/${ch.id}?v=${encodeURIComponent(meta?.date || dateKey)}`;
    const scene = meta?.scene ? esc(meta.scene) : "In preparazione — torna tra poco!";
    return `
    <article class="card" id="${ch.id}">
      <a class="shot" href="/w/${ch.id}" title="Apri l'immagine di oggi">
        <img src="${imgUrl}" alt="${esc(ch.name)} — wallpaper di oggi" loading="lazy" />
      </a>
      <div class="body">
        <h3>${ch.emoji} ${esc(ch.name)}</h3>
        <p class="tag">${esc(ch.tagline)}</p>
        <p class="scene">Oggi: <em>${scene}</em></p>
        <div class="url">
          <code>${esc(origin)}/w/${ch.id}</code>
          <button onclick="navigator.clipboard.writeText('${esc(origin)}/w/${ch.id}').then(()=>{this.textContent='✓ copiato';setTimeout(()=>this.textContent='copia',1500)})">copia</button>
        </div>
      </div>
    </article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ArtiPop — un wallpaper nuovo ogni giorno, che evolve</title>
<meta name="description" content="Wallpaper AI gratuiti per iPhone che evolvono giorno per giorno. Nessuna app: solo una Shortcut." />
<style>
  :root {
    --bg: #0b0d12; --card: #141824; --text: #e8eaf0; --dim: #9aa3b5;
    --accent: #7c8cff; --radius: 18px;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg: #f4f5f9; --card: #ffffff; --text: #171a22; --dim: #5b6272; }
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: var(--bg); color: var(--text);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 2rem 1rem 4rem;
  }
  main { max-width: 1080px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 2.5rem; }
  header h1 { font-size: 2.4rem; letter-spacing: -0.02em; }
  header h1 span { color: var(--accent); }
  header p.sub { color: var(--dim); max-width: 34rem; margin: 0.6rem auto 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.2rem; }
  .card { background: var(--card); border-radius: var(--radius); overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.18); }
  .shot { display: block; aspect-ratio: 6 / 13; max-height: 420px; overflow: hidden; background: #1b1f2c; }
  .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .body { padding: 1rem 1.1rem 1.2rem; }
  .body h3 { font-size: 1.15rem; }
  .tag { color: var(--dim); font-size: .88rem; margin-top: .15rem; }
  .scene { font-size: .85rem; margin-top: .55rem; color: var(--dim); }
  .scene em { color: var(--text); font-style: italic; }
  .url { display: flex; gap: .5rem; align-items: center; margin-top: .7rem; }
  .url code { flex: 1; font-size: .72rem; background: rgba(124,140,255,.1); border-radius: 8px; padding: .45rem .55rem; overflow-x: auto; white-space: nowrap; }
  .url button { border: 0; border-radius: 8px; padding: .45rem .7rem; background: var(--accent); color: #fff; font-size: .75rem; cursor: pointer; }
  section.setup { margin-top: 3.5rem; background: var(--card); border-radius: var(--radius); padding: 1.6rem 1.6rem 1.8rem; }
  section.setup h2 { font-size: 1.4rem; margin-bottom: .8rem; }
  section.setup ol { padding-left: 1.3rem; display: grid; gap: .55rem; }
  section.setup li strong { color: var(--accent); }
  footer { text-align: center; color: var(--dim); font-size: .8rem; margin-top: 3rem; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <header>
    <h1>Arti<span>Pop</span></h1>
    <p class="sub">Un wallpaper nuovo ogni giorno sul tuo iPhone, generato dall'AI.
    Ogni canale è un viaggio che <strong>evolve giorno dopo giorno</strong>.
    Gratis, senza app: solo una Shortcut.</p>
  </header>

  <div class="grid">
${cards}
  </div>

  <section class="setup">
    <h2>📲 Attivalo in 2 minuti</h2>
    <ol>
      <li><strong>Scegli un canale</strong> qui sopra e copia il suo link.</li>
      <li>Apri <strong>Comandi rapidi</strong> (Shortcuts) sull'iPhone e crea un nuovo comando con due sole azioni:<br>
        ① <em>Ottieni contenuto da URL</em> → incolla il link del canale<br>
        ② <em>Imposta sfondo</em> → scegli lo sfondo da aggiornare e disattiva l'anteprima.</li>
      <li>Vai su <strong>Automazioni</strong> → <em>+</em> → <strong>Ora del giorno → Tramonto</strong> → <em>Esegui immediatamente</em> → scegli il tuo comando.</li>
    </ol>
    <p style="margin-top:.9rem;color:var(--dim);font-size:.88rem">
      Da quel momento è tutto automatico: ogni sera al tramonto il tuo sfondo cambia,
      e la storia del tuo canale va avanti di un capitolo. 🌇
    </p>
  </section>

  <footer>
    ArtiPop v3 — generato ogni giorno alle 05:00 (Europa/Roma) da FLUX.2 su Cloudflare Workers AI ·
    <a href="/api/channels">API</a>
  </footer>
</main>
</body>
</html>`;
}
