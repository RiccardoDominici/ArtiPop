// Landing page di ArtiPop — redesign "deck".
//
// Concetti chiave:
//  - Deck di card swipeabili stile Tinder (pointer events: touch su iPhone,
//    drag/frecce/bottoni su desktop), una card per canale attivo.
//  - Ogni card mostra il wallpaper di oggi dentro un mockup di iPhone con
//    orologio live: la "preview" reale di come apparirà la lock screen.
//  - Galleria "il viaggio": chip con le date dell'archivio permanente; un tap
//    carica quel giorno nel mockup (le immagini d'archivio hanno cache lunga).
//  - Sfondo ambient con gradiente animato che segue i colori del canale in cima.
//  - Nessuna risorsa esterna: font di sistema, CSS e JS inline.

import { ACTIVE_CHANNELS } from "./channels.js";

/** Escape minimo per testo inserito nell'HTML. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Renderizza la pagina. `metas` è una mappa channelId → meta (da storage.getMeta),
 * `origin` è l'origine pubblica del worker, `dateKey` la data di oggi (YYYY-MM-DD).
 */
export function renderPage(metas, origin, dateKey) {
  // Dati pubblici passati al JS client (niente campi interni).
  const channelData = ACTIVE_CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    accent: c.accent,
    tagline: c.tagline,
    scene: metas[c.id]?.scene || null,
    date: metas[c.id]?.date || dateKey,
  }));

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — un wallpaper nuovo ogni giorno, che evolve</title>
<meta name="description" content="Wallpaper AI gratuiti per iPhone che evolvono giorno per giorno. Nessuna app: solo una Shortcut." />
<meta name="theme-color" content="#0a0b10" />
<style>
  :root {
    --bg: #0a0b10;
    --card: rgba(255,255,255,.055);
    --card-border: rgba(255,255,255,.12);
    --text: #f2f3f8;
    --dim: #9aa3b8;
    --a1: #7ec8a9;  /* accenti del canale corrente (animati via JS) */
    --a2: #2b5f8a;
    --radius: 26px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { scroll-behavior: smooth; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  /* ---------- sfondo ambient ---------- */
  .ambient { position: fixed; inset: 0; z-index: -1; overflow: hidden; }
  .blob {
    position: absolute; width: 65vmax; height: 65vmax; border-radius: 50%;
    filter: blur(90px); opacity: .32;
    transition: background 1.2s ease;
  }
  .blob.b1 { background: var(--a1); top: -25vmax; left: -15vmax; animation: drift1 26s ease-in-out infinite alternate; }
  .blob.b2 { background: var(--a2); bottom: -30vmax; right: -18vmax; animation: drift2 32s ease-in-out infinite alternate; }
  @keyframes drift1 { to { transform: translate(9vmax, 7vmax) scale(1.12); } }
  @keyframes drift2 { to { transform: translate(-8vmax, -6vmax) scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .blob { animation: none; } }

  main { max-width: 1100px; margin: 0 auto; padding: max(2rem, env(safe-area-inset-top)) 1.2rem 4rem; }

  /* ---------- header ---------- */
  header.hero { text-align: center; margin: 1.2rem 0 2.2rem; }
  .hero h1 {
    font-size: clamp(2.6rem, 7vw, 3.6rem); font-weight: 800; letter-spacing: -.03em;
    background: linear-gradient(100deg, var(--a1), var(--a2));
    -webkit-background-clip: text; background-clip: text; color: transparent;
    transition: background 1.2s ease;
  }
  .hero p { color: var(--dim); max-width: 30rem; margin: .7rem auto 0; font-size: 1.02rem; line-height: 1.55; }
  .hero p strong { color: var(--text); font-weight: 600; }

  /* ---------- deck ---------- */
  .deck-wrap { display: grid; justify-items: center; gap: 1.1rem; }
  .deck {
    position: relative;
    width: min(340px, 86vw);
    height: calc(min(340px, 86vw) * 2.02); /* telefono (~1.47) + info (~0.45) */
    touch-action: pan-y;
  }
  .card {
    position: absolute; inset: 0;
    border-radius: var(--radius);
    /* fondo OPACO: le card dietro nella pila non devono trasparire */
    background: linear-gradient(180deg, rgb(30,34,46), rgb(17,19,27));
    border: 1px solid var(--card-border);
    box-shadow: 0 24px 60px rgba(0,0,0,.45);
    display: flex; flex-direction: column; align-items: center;
    padding: 1rem 1rem 1.05rem;
    overflow: hidden;
    will-change: transform;
    user-select: none; -webkit-user-select: none;
  }
  .card.top { cursor: grab; }
  .card.top:active { cursor: grabbing; }
  .card.behind { pointer-events: none; }
  .card.animated { transition: transform .45s cubic-bezier(.2,.8,.25,1.1), opacity .45s ease; }

  /* ---------- mockup iPhone ---------- */
  .phone {
    position: relative; width: 66%; aspect-ratio: 6 / 13;
    border-radius: 13% / 6%;
    background: #000; border: 3px solid #2a2d38;
    overflow: hidden; flex-shrink: 0;
    box-shadow: 0 10px 34px rgba(0,0,0,.55), inset 0 0 0 2px #000;
  }
  .phone img.wall {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; transition: opacity .35s ease;
  }
  .phone .island {
    position: absolute; top: 3.2%; left: 50%; transform: translateX(-50%);
    width: 30%; height: 3.4%; background: #000; border-radius: 999px; z-index: 3;
  }
  .lock { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; color: #fff; text-shadow: 0 1px 14px rgba(0,0,0,.45); }
  .lock .ldate { margin-top: 12.5%; font-size: .72rem; font-weight: 600; opacity: .95; text-transform: capitalize; }
  .lock .ltime { font-size: 2.5rem; font-weight: 250; letter-spacing: .01em; line-height: 1.05; font-variant-numeric: tabular-nums; }
  .lock .lbottom { margin-top: auto; margin-bottom: 6%; display: flex; gap: 38%; width: 100%; justify-content: center; }
  .lock .lbtn { width: 2rem; height: 2rem; border-radius: 50%; background: rgba(20,20,25,.55); backdrop-filter: blur(6px); display: grid; place-items: center; font-size: .85rem; }

  /* ---------- info canale ---------- */
  .cinfo { width: 100%; text-align: center; margin-top: .85rem; display: grid; gap: .3rem; }
  .cinfo h2 { font-size: 1.28rem; font-weight: 750; letter-spacing: -.01em; }
  .cinfo .tag { color: var(--dim); font-size: .84rem; line-height: 1.4; }
  .cinfo .scene { font-size: .8rem; color: var(--dim); font-style: italic; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .cinfo .scene b { color: var(--text); font-weight: 600; font-style: normal; }

  /* ---------- controlli deck ---------- */
  .controls { display: flex; align-items: center; gap: 1rem; }
  .ctrl {
    width: 3.2rem; height: 3.2rem; border-radius: 50%;
    border: 1px solid var(--card-border); background: var(--card);
    backdrop-filter: blur(14px); color: var(--text); font-size: 1.25rem;
    cursor: pointer; transition: transform .15s ease, background .2s ease;
    display: grid; place-items: center;
  }
  .ctrl:hover { transform: scale(1.09); background: rgba(255,255,255,.12); }
  .ctrl:active { transform: scale(.94); }
  .dots { display: flex; gap: .45rem; }
  .dot { width: .5rem; height: .5rem; border-radius: 50%; background: rgba(255,255,255,.22); transition: all .3s ease; }
  .dot.on { background: var(--a1); transform: scale(1.35); }
  .hint { color: var(--dim); font-size: .78rem; opacity: .8; }

  /* ---------- azioni canale ---------- */
  .actions { display: flex; gap: .6rem; flex-wrap: wrap; justify-content: center; }
  .btn {
    border: 0; border-radius: 999px; padding: .72rem 1.25rem;
    font-size: .88rem; font-weight: 650; cursor: pointer;
    transition: transform .15s ease, filter .2s ease, background 1.2s ease;
  }
  .btn:active { transform: scale(.96); }
  .btn.primary { background: linear-gradient(100deg, var(--a1), var(--a2)); color: #fff; box-shadow: 0 8px 26px rgba(0,0,0,.35); }
  .btn.primary:hover { filter: brightness(1.12); }
  .btn.ghost { background: var(--card); border: 1px solid var(--card-border); color: var(--text); backdrop-filter: blur(14px); }
  .btn.ghost:hover { background: rgba(255,255,255,.11); }

  /* ---------- galleria/viaggio: pellicola di miniature ---------- */
  section.journey { margin-top: 1.6rem; text-align: center; }
  .journey .jhead { display: flex; align-items: center; justify-content: center; gap: .8rem; margin-bottom: .8rem; }
  .journey h3 { font-size: .82rem; font-weight: 650; color: var(--dim); text-transform: uppercase; letter-spacing: .12em; }
  .playbtn {
    border: 1px solid var(--card-border); background: var(--card); color: var(--text);
    border-radius: 999px; padding: .4rem .9rem; font-size: .78rem; font-weight: 650;
    cursor: pointer; transition: all .2s ease; backdrop-filter: blur(10px);
  }
  .playbtn:hover { background: rgba(255,255,255,.12); }
  .playbtn.playing { background: linear-gradient(100deg, var(--a1), var(--a2)); border-color: transparent; color: #fff; }
  .strip {
    display: flex; gap: .6rem; overflow-x: auto; padding: .2rem .4rem .6rem;
    max-width: min(560px, 92vw); margin-inline: auto; scrollbar-width: none;
    scroll-snap-type: x proximity;
  }
  .strip::-webkit-scrollbar { display: none; }
  .thumb {
    flex: 0 0 auto; width: 64px; aspect-ratio: 6 / 13;
    border-radius: 12px; overflow: hidden; position: relative;
    border: 2px solid var(--card-border); background: var(--card);
    cursor: pointer; padding: 0; scroll-snap-align: center;
    transition: transform .2s ease, border-color .25s ease;
  }
  .thumb:hover { transform: translateY(-3px); }
  .thumb.on { border-color: var(--a1); box-shadow: 0 4px 18px rgba(0,0,0,.4); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb .tdate {
    position: absolute; left: 0; right: 0; bottom: 0; padding: .9rem .2rem .25rem;
    background: linear-gradient(transparent, rgba(0,0,0,.75));
    color: #fff; font-size: .58rem; font-weight: 700; letter-spacing: .02em;
  }

  /* ---------- setup ---------- */
  section.setup { margin-top: 3.4rem; }
  .setup h2 { text-align: center; font-size: 1.6rem; font-weight: 750; letter-spacing: -.02em; }
  .setup .sub { text-align: center; color: var(--dim); margin-top: .35rem; font-size: .92rem; }
  .steps { display: grid; gap: .9rem; margin-top: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .step {
    background: var(--card); border: 1px solid var(--card-border); border-radius: 20px;
    padding: 1.15rem 1.2rem; backdrop-filter: blur(14px);
    transition: transform .2s ease;
  }
  .step:hover { transform: translateY(-3px); }
  .step .n {
    width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center;
    background: linear-gradient(100deg, var(--a1), var(--a2)); color: #fff;
    font-weight: 800; font-size: .95rem; margin-bottom: .7rem;
  }
  .step h4 { font-size: 1rem; margin-bottom: .35rem; }
  .step p { color: var(--dim); font-size: .86rem; line-height: 1.55; }
  .step p code { background: rgba(255,255,255,.09); border-radius: 6px; padding: .1rem .4rem; font-size: .78rem; word-break: break-all; }
  .note { margin-top: 1rem; text-align: center; color: var(--dim); font-size: .8rem; line-height: 1.6; max-width: 44rem; margin-inline: auto; }

  footer { margin-top: 3.2rem; text-align: center; color: var(--dim); font-size: .78rem; }
  footer a { color: var(--a1); text-decoration: none; }

  /* toast copia */
  #toast {
    position: fixed; left: 50%; bottom: max(1.4rem, env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(20px);
    background: rgba(20,22,30,.92); border: 1px solid var(--card-border); color: var(--text);
    padding: .7rem 1.2rem; border-radius: 999px; font-size: .85rem; opacity: 0;
    transition: all .3s ease; pointer-events: none; backdrop-filter: blur(10px); z-index: 50;
  }
  #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  @media (min-width: 760px) {
    .deck-wrap { grid-template-columns: auto; }
    .deck { width: 360px; height: 727px; }
  }
</style>
</head>
<body>
<div class="ambient"><div class="blob b1"></div><div class="blob b2"></div></div>

<main>
  <header class="hero">
    <h1>ArtiPop</h1>
    <p>Un wallpaper nuovo ogni sera al tramonto, generato dall'AI quella notte.
    Ogni canale è <strong>un viaggio che evolve giorno dopo giorno</strong>.<br>
    Gratis, senza app: solo una Shortcut.</p>
  </header>

  <div class="deck-wrap">
    <div class="deck" id="deck" aria-label="Canali — trascina per sfogliare"></div>

    <div class="controls">
      <button class="ctrl" id="prev" aria-label="Canale precedente">‹</button>
      <div class="dots" id="dots"></div>
      <button class="ctrl" id="next" aria-label="Canale successivo">›</button>
    </div>
    <p class="hint" id="hint">↔ trascina la card o usa le frecce</p>

    <div class="actions">
      <a class="btn primary" id="dlShortcut" href="/s/bloom.shortcut" download>⬇️ Scarica la Shortcut</a>
      <a class="btn ghost" href="#setup">Come si attiva</a>
    </div>
    <p class="hint">La Shortcut scaricata ha già l'URL del canale dentro: aprila e importala.</p>

    <section class="journey">
      <div class="jhead">
        <h3>Il viaggio finora</h3>
        <button class="playbtn" id="play" hidden>▶ riproduci</button>
      </div>
      <div class="strip" id="strip"><span class="hint">carico l'archivio…</span></div>
    </section>
  </div>

  <section class="setup" id="setup">
    <h2>Come si imposta lo sfondo</h2>
    <p class="sub">Tre passi, una volta sola. Poi cambia da solo ogni sera, per sempre.</p>
    <div class="steps">
      <div class="step">
        <div class="n">1</div>
        <h4>Scarica e importa la Shortcut</h4>
        <p>Scegli il canale sfogliando le card e tocca
        <strong>⬇️ Scarica la Shortcut</strong>. Apri il file scaricato:
        si apre <strong>Comandi rapidi</strong> → tocca
        <strong>Aggiungi comando</strong>.<br><br>
        🔒 Se iOS la blocca: vai in <em>Impostazioni → Scorciatoie</em> e attiva
        <strong>Consenti scorciatoie non attendibili</strong>
        (se non vedi la voce, esegui prima una scorciatoia qualsiasi), poi
        riapri il file.</p>
      </div>
      <div class="step">
        <div class="n">2</div>
        <h4>Provala con un tap</h4>
        <p>Tocca la Shortcut appena importata: lo sfondo deve cambiare
        <strong>subito e senza chiederti niente</strong>.<br><br>
        ArtiPop aggiorna sempre l'<strong>ultimo sfondo</strong> della tua
        schermata di blocco — quello in fondo alla galleria. Così non tocca
        gli sfondi a cui tieni: se non ne hai ancora uno da dedicargli, vai in
        <em>Impostazioni → Sfondo</em>, aggiungine uno nuovo qualsiasi e sarà
        quello che ArtiPop terrà aggiornato.</p>
      </div>
      <div class="step">
        <div class="n">3</div>
        <h4>Rendila automatica al tramonto</h4>
        <p>Sempre in Comandi rapidi: tab <strong>Automazioni</strong> →
        <strong>+</strong> → <em>Ora del giorno</em> →
        scegli <strong>Tramonto</strong> → ripeti <strong>Ogni giorno</strong> →
        seleziona <strong>Esegui immediatamente</strong> → <em>Avanti</em> →
        scegli la tua Shortcut ArtiPop → <em>Fine</em>.<br><br>
        🌇 Da stasera il tuo sfondo cambia da solo, e ogni giorno la storia
        avanza di un pezzetto.</p>
      </div>
    </div>
    <p class="note">
      💡 Preferisci la mattina? Nell'automazione scegli <em>Alba</em> o un orario fisso.<br>
      🛟 Qualcosa non funziona? C'è una pagina apposta:
      <a href="/aiuto"><strong>Aiuto e problemi comuni</strong></a> — soprattutto se
      <em>a mano funziona ma in automazione no</em>.<br>
      Gli sfondi passati non si perdono mai: sono qui sotto, in "Il viaggio finora".
    </p>
  </section>

  <footer>
    ArtiPop v3 — generato ogni notte da FLUX.2 su Cloudflare Workers AI ·
    <a href="/aiuto">Aiuto</a> ·
    <a href="/api/channels">API</a> · <a href="https://github.com/RiccardoDominici/ArtiPop">GitHub</a>
  </footer>
</main>

<div id="toast" role="status"></div>

<script>
"use strict";
// Dati canali resi dal server (solo campi pubblici).
const CHANNELS = ${JSON.stringify(channelData)};
const ORIGIN = ${JSON.stringify(origin)};
const TODAY = ${JSON.stringify(dateKey)};

const deckEl = document.getElementById("deck");
const dotsEl = document.getElementById("dots");
const stripEl = document.getElementById("strip");
const playEl = document.getElementById("play");
const toastEl = document.getElementById("toast");

let order = CHANNELS.map((_, i) => i); // ordine corrente del deck (order[0] = card in cima)
let previewDate = null;                 // data in preview nel mockup (null = oggi)
const archiveCache = {};                // channelId → [date, ...]

/* ---------- costruzione card ---------- */
function cardHTML(ch) {
  const url = ORIGIN + "/w/" + ch.id;
  return \`
    <div class="phone" aria-hidden="true">
      <div class="island"></div>
      <div class="lock">
        <div class="ldate"></div>
        <div class="ltime"></div>
        <div class="lbottom"><div class="lbtn">🔦</div><div class="lbtn">📷</div></div>
      </div>
      <img class="wall" src="/w/\${ch.id}?v=\${ch.date}" alt="\${ch.name} — wallpaper di oggi" draggable="false" />
    </div>
    <div class="cinfo">
      <h2>\${ch.emoji} \${ch.name}</h2>
      <div class="tag">\${ch.tagline}</div>
      <div class="scene">\${ch.scene ? "<b>Oggi:</b> " + ch.scene : "in preparazione…"}</div>
    </div>\`;
}

function buildDeck() {
  deckEl.innerHTML = "";
  // Renderizza dal fondo alla cima così la card in cima resta ultima nel DOM.
  for (let i = order.length - 1; i >= 0; i--) {
    const ch = CHANNELS[order[i]];
    const el = document.createElement("article");
    el.className = "card " + (i === 0 ? "top" : "behind");
    el.dataset.channel = ch.id;
    el.innerHTML = cardHTML(ch);
    applyStackTransform(el, i);
    deckEl.appendChild(el);
  }
  updateChrome();
  attachDrag();
  tickClock();
}

/* Trasformazioni "a pila": le card dietro sono più piccole e più in basso. */
function applyStackTransform(el, depth) {
  const d = Math.min(depth, 2);
  el.style.transform = \`translateY(\${d * 14}px) scale(\${1 - d * 0.045})\`;
  el.style.opacity = depth > 2 ? 0 : 1;
  el.style.zIndex = 10 - depth;
}

/* Aggiorna colori ambient, dots, hint e galleria per il canale in cima. */
function updateChrome() {
  const ch = CHANNELS[order[0]];
  document.documentElement.style.setProperty("--a1", ch.accent[0]);
  document.documentElement.style.setProperty("--a2", ch.accent[1]);
  // Il bottone di download segue sempre il canale della card in cima.
  document.getElementById("dlShortcut").href = \`/s/\${ch.id}.shortcut\`;
  dotsEl.innerHTML = CHANNELS.map((c) =>
    \`<span class="dot\${c.id === ch.id ? " on" : ""}"></span>\`).join("");
  previewDate = null;
  loadArchive(ch.id);
}

/* ---------- drag stile Tinder ---------- */
let drag = null;
function attachDrag() {
  const top = deckEl.querySelector(".card.top");
  if (!top) return;
  top.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a")) return;
    drag = { el: top, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    top.classList.remove("animated");
    top.setPointerCapture(e.pointerId);
  });
  top.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    drag.el.style.transform =
      \`translate(\${drag.dx}px, \${drag.dy * 0.25}px) rotate(\${drag.dx * 0.055}deg)\`;
  });
  const end = () => {
    if (!drag) return;
    const { el, dx } = drag;
    drag = null;
    const threshold = Math.min(120, deckEl.offsetWidth * 0.34);
    el.classList.add("animated");
    if (Math.abs(dx) > threshold) flyOut(el, Math.sign(dx));
    else el.style.transform = "";
  };
  top.addEventListener("pointerup", end);
  top.addEventListener("pointercancel", end);
}

/* La card vola fuori, poi torna in fondo al mazzo. */
function flyOut(el, dir) {
  el.style.transform = \`translate(\${dir * (deckEl.offsetWidth + 220)}px, -30px) rotate(\${dir * 22}deg)\`;
  el.style.opacity = 0;
  setTimeout(() => {
    order.push(order.shift());
    buildDeck();
  }, 280);
}

function advance(dir) {
  const top = deckEl.querySelector(".card.top");
  if (!top) return;
  top.classList.add("animated");
  flyOut(top, dir);
}
document.getElementById("next").addEventListener("click", () => advance(1));
document.getElementById("prev").addEventListener("click", () => advance(-1));
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") advance(1);
  if (e.key === "ArrowLeft") advance(-1);
});

/* ---------- orologio live nel mockup ---------- */
function tickClock() {
  const now = new Date();
  const time = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  document.querySelectorAll(".ltime").forEach((el) => (el.textContent = time));
  document.querySelectorAll(".ldate").forEach((el) => (el.textContent = date));
}
setInterval(tickClock, 10_000);

/* ---------- galleria del viaggio (archivio permanente) ----------
   Pellicola di miniature: un mini-telefono per ogni giorno archiviato.
   Le immagini d'archivio hanno cache immutabile, quindi dopo la prima
   visita le miniature sono gratis; loading=lazy carica solo le visibili. */
async function loadArchive(chId) {
  stripEl.innerHTML = '<span class="hint">carico l\\'archivio…</span>';
  playEl.hidden = true;
  try {
    if (!archiveCache[chId]) {
      const res = await fetch(\`/api/archive/\${chId}?limit=30\`);
      archiveCache[chId] = (await res.json()).dates || [];
    }
    renderStrip(chId);
  } catch {
    stripEl.innerHTML = '<span class="hint">archivio non disponibile</span>';
  }
}

function srcFor(chId, date, isToday) {
  return isToday ? \`/w/\${chId}?v=\${TODAY}\` : \`/w/\${chId}?date=\${date}\`;
}

function renderStrip(chId) {
  if (CHANNELS[order[0]].id !== chId) return; // nel frattempo l'utente ha cambiato card
  const dates = archiveCache[chId];
  if (!dates || dates.length === 0) {
    stripEl.innerHTML = '<span class="hint">il viaggio inizia oggi ✨</span>';
    return;
  }
  stripEl.innerHTML = "";
  dates.forEach((d) => {
    const isToday = d === TODAY;
    const btn = document.createElement("button");
    btn.className = "thumb" + ((previewDate ?? TODAY) === d ? " on" : "");
    btn.title = d;
    btn.innerHTML =
      \`<img src="\${srcFor(chId, d, isToday)}" loading="lazy" decoding="async" alt="\${d}" draggable="false" />\` +
      \`<span class="tdate">\${isToday ? "oggi" : new Date(d + "T00:00:00")
        .toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>\`;
    btn.dataset.date = d;
    btn.addEventListener("click", () => { stopPlayback(); previewDay(chId, d, isToday); });
    stripEl.appendChild(btn);
  });
  // Il tasto ▶/⏸ ha senso solo con almeno 2 giorni di viaggio.
  playEl.hidden = dates.length < 2;
  // Anteprima "stile GIF": il timelapse parte da solo (salvo motion ridotto).
  if (dates.length >= 2 && !playing && !prefersStill) startPlayback();
}

/* Evidenzia nella pellicola il giorno mostrato nel mockup (senza ricostruire il DOM). */
function highlightStrip(date) {
  stripEl.querySelectorAll(".thumb").forEach((t) =>
    t.classList.toggle("on", t.dataset.date === date));
}

/* Mostra un giorno nel mockup della card in cima (crossfade). */
function previewDay(chId, date, isToday) {
  const top = deckEl.querySelector(".card.top .wall");
  if (!top) return;
  previewDate = isToday ? null : date;
  top.style.opacity = 0;
  const src = srcFor(chId, date, isToday);
  const pre = new Image();
  pre.onload = () => { top.src = src; top.style.opacity = 1; };
  pre.src = src;
  highlightStrip(date);
}

/* ---------- timelapse "GIF" del viaggio nel mockup ---------- */
const prefersStill = matchMedia("(prefers-reduced-motion: reduce)").matches;
let playTimer = null;
let playing = false;

function stopPlayback() {
  playing = false;
  if (playTimer) { clearTimeout(playTimer); playTimer = null; }
  playEl.classList.remove("playing");
  playEl.textContent = "▶ riproduci";
}

function startPlayback() {
  const chId = CHANNELS[order[0]].id;
  const dates = (archiveCache[chId] || []).slice().reverse(); // dal più vecchio a oggi
  if (dates.length < 2) return;
  playing = true;
  playEl.classList.add("playing");
  playEl.textContent = "⏸ pausa";
  // Preload di tutti i frame: dopo il primo giro il loop è fluido (cache immutabile).
  dates.forEach((d) => { const im = new Image(); im.src = srcFor(chId, d, d === TODAY); });
  let i = 0;
  const step = () => {
    if (!playing || CHANNELS[order[0]].id !== chId) { stopPlayback(); return; } // card cambiata
    const d = dates[i];
    previewDay(chId, d, d === TODAY);
    const isLast = i === dates.length - 1;
    i = (i + 1) % dates.length; // loop infinito, come una GIF
    playTimer = setTimeout(step, isLast ? 2000 : 900); // su "oggi" si ferma un po' di più
  };
  step();
}

playEl.addEventListener("click", () => (playing ? stopPlayback() : startPlayback()));

buildDeck();
</script>
</body>
</html>`;
}
