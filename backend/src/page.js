// Landing page di ArtiPop — redesign "deck".
//
// Concetti chiave:
//  - Deck di card swipeabili stile Tinder (pointer events: touch su iPhone,
//    drag/frecce/bottoni su desktop), una card per canale attivo.
//  - Ogni card mostra il wallpaper di oggi dentro un mockup di iPhone con
//    orologio live: la "preview" reale di come apparirà la lock screen.
//  - "Il viaggio finora": l'archivio permanente si sfoglia SOLO dentro il
//    mockup (niente striscia di miniature, era ridondante col mockup stesso).
//    Sotto al mockup restano data del fotogramma, posizione "N di M" e le
//    frecce giorno prec./succ.; le immagini d'archivio hanno cache lunga.
//    L'anteprima è limitata all'arco (settimana/concept) in corso, non a
//    tutto l'archivio: l'archivio attraversa più concept nel tempo, e
//    sfogliarli tutti di fila mischierebbe storie diverse (es. un cactus
//    seguito di colpo da un'isola volante). Vedi cardHTML/loadArchive.
//  - Sfondo ambient con gradiente animato che segue i colori del canale in cima.
//  - Nessuna risorsa esterna: font di sistema, CSS e JS inline.

import { ACTIVE_CHANNELS, LEGACY_ALIASES } from "./channels.js";
import { FAVICON_TAG, metaAnteprima, feedLinkTag } from "./head.js";

// feat-quando-arriva-il-prossimo-wallpaper: specchio di triggers.crons in
// backend/wrangler.jsonc (ambiente di produzione) — il cron di generazione
// gira alle 03:00 UTC. Se quell'orario cambia senza aggiornare questa
// costante, la home mostrerebbe un orario sbagliato all'utente: il test
// backend/tests/unit/config-cron-coerente.test.js rompe apposta in quel caso.
const ORA_CRON_UTC = 3;

// NOTA: qui viveva esc(), un escape HTML mai chiamato nel file — i campi del
// template (ch.name, ch.tagline, ch.scene, ch.concept) vengono inseriti senza
// escaping già oggi. Rimuovere la funzione morta non cambia questo: NON
// iniziare a usarla sui campi del template senza che sia una scelta a parte,
// perché cambierebbe cosa il sito mostra.

/** Escape minimo per il testo dinamico del blocco <noscript> (stesso di archivi.js/help.js). */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Ripiego statico per chi apre la pagina con JavaScript disattivato (content
 * blocker, Lockdown Mode, proxy aziendali): senza JS il deck resta un
 * `<div id="deck">` vuoto (costruito lato client), quindi qui si ricostruisce
 * a mano — con i `metas` già disponibili al render — il minimo utilizzabile:
 * wallpaper di oggi, nome canale e link alla Shortcut, per ognuno dei
 * canali attivi. Zero fetch, zero script: solo markup e i token §1.1.
 */
function noscriptBlocco(metas) {
  const voci = ACTIVE_CHANNELS.map((c) => {
    const meta = metas[c.id];
    const data = meta?.date || null;
    const img = data
      ? `<img src="/w/${esc(c.id)}?v=${esc(data)}" alt="Wallpaper di oggi del canale ${esc(c.name)} (${esc(data)})" loading="lazy">`
      : "";
    return `<li class="ns-item">
      <strong>${esc(c.emoji)} ${esc(c.name)}</strong>
      ${img}
      <a href="/s/${esc(c.id)}.shortcut">Scarica la Shortcut</a>
      <a href="/w/${esc(c.id)}">Vedi il wallpaper</a>
    </li>`;
  }).join("\n");
  return `<noscript>
    <section class="ns">
      <h2>ArtiPop funziona anche senza JavaScript</h2>
      <p>Ecco il wallpaper di oggi di ogni canale, con il link per scaricarne la Shortcut.</p>
      <ul class="ns-list">${voci}</ul>
      <p><a href="/aiuto">Aiuto e problemi comuni</a> · <a href="/archivi">Archivi</a></p>
    </section>
  </noscript>`;
}

/**
 * Renderizza la pagina. `metas` è una mappa channelId → meta (da storage.getMeta),
 * `origin` è l'origine pubblica del worker, `dateKey` la data di oggi (YYYY-MM-DD).
 * `condiviso` (opzionale) = `{ canale, data }`, già validato da chi chiama
 * (rotta `/` in index.js): fa seguire l'anteprima Open Graph al giorno e
 * canale del link condiviso invece del wallpaper di oggi. Non tocca il
 * `<body>`: il markup visibile resta identico in entrambi i casi.
 * `feedUrl` (opzionale, feat-segui-il-canale-dal-lettore-di-feed): indirizzo
 * del feed RSS del canale reso lato server (`condiviso?.canale` o il primo
 * flusso attivo), emesso come `<link rel="alternate">` invisibile nel
 * `<head>` — nessun elemento visibile, nessuna modifica al CSS.
 */
export function renderPage(metas, origin, dateKey, condiviso = null, feedUrl = null) {
  // Dati pubblici passati al JS client (niente campi interni).
  const channelData = ACTIVE_CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    accent: c.accent,
    tagline: c.tagline,
    scene: metas[c.id]?.scene || null,
    // Il concept della settimana in corso: da questa versione un flusso non è
    // più un tema fisso, quindi va detto all'utente COSA sta guardando adesso.
    concept: metas[c.id]?.conceptNome || null,
    // "Giorno N di 7": N = dayInArc+1. Riusato lato client anche per capire
    // quanti giorni dell'archivio appartengono all'arco in corso (vedi
    // loadArchive) — così l'anteprima "Il viaggio finora" combacia con
    // l'etichetta qui sotto invece di sfogliare concept passati.
    giorno: Number.isInteger(metas[c.id]?.dayInArc) ? metas[c.id].dayInArc + 1 : null,
    date: metas[c.id]?.date || dateKey,
    // Vero solo se esiste un meta con una data reale precedente a oggi: un
    // canale senza meta ricade su dateKey sopra e resta false, per non
    // sommarsi a "in preparazione…" (vedi MOTIVAZIONE ciclo 49).
    inRitardo: !!(metas[c.id]?.date && metas[c.id].date < dateKey),
  }));

  // Stesso canale con cui è resa la card in cima al deck (es. dlShortcut
  // sopra): il canale condiviso tocca solo l'anteprima OG, non il deck
  // visibile, quindi non deve toccare nemmeno questo comando.
  const feedChannelId = ACTIVE_CHANNELS[0].id;

  const pageTitle = "ArtiPop — un wallpaper nuovo ogni giorno, che evolve";
  const pageDescription =
    "Wallpaper AI gratuiti per iPhone che evolvono giorno per giorno. Nessuna app: solo una Shortcut.";
  const noscript = noscriptBlocco(metas);

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${pageTitle}</title>
<meta name="description" content="${pageDescription}" />
<meta name="theme-color" content="#0a0b10" />
${FAVICON_TAG}
${feedLinkTag(feedUrl)}
${metaAnteprima(origin, dateKey, pageTitle, pageDescription, condiviso)}
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
  .cinfo .stale { font-size: .8rem; color: var(--dim); line-height: 1.45; }

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

  /* ---------- galleria/viaggio: sfogliata dentro l'anteprima ---------- */
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
  /* Niente più striscia di miniature (era ridondante: il mockup già scorre
     l'archivio col timelapse). Al suo posto, solo i comandi per sfogliare
     l'anteprima giorno per giorno e capire a che punto del viaggio si è. */
  .daynav { display: flex; align-items: center; justify-content: center; gap: .9rem; }
  .dayctrl {
    width: 2.3rem; height: 2.3rem; border-radius: 50%;
    border: 1px solid var(--card-border); background: var(--card);
    backdrop-filter: blur(14px); color: var(--text); font-size: 1.05rem;
    cursor: pointer; transition: transform .15s ease, background .2s ease;
    display: grid; place-items: center;
  }
  .dayctrl:hover { transform: scale(1.09); background: rgba(255,255,255,.12); }
  .dayctrl:active { transform: scale(.94); }
  .dayctrl:disabled { opacity: .35; cursor: default; transform: none; }
  .dayinfo { min-width: 8rem; display: grid; gap: .1rem; }
  .dayinfo .ddate { font-size: .92rem; font-weight: 650; text-transform: capitalize; }
  .dayinfo .dpos { font-size: .74rem; color: var(--dim); }
  .daypick {
    min-height: 2.3rem; padding: 0 .6rem; border-radius: 999px;
    border: 1px solid var(--dim); background: var(--bg); color: var(--text);
    font: inherit; color-scheme: dark;
  }
  .dcap { color: var(--dim); font-size: .78rem; line-height: 1.5; margin: .8rem auto 0; max-width: 26rem; }
  .dcap strong { color: var(--text); font-weight: 650; }
  /* feat-leggi-la-storia-dell-arco: elenco delle tappe dell'arco visualizzato,
     nascosto finché non lo si apre da #storytoggle. Nessun colore nuovo: --dim
     per il testo secondario, il testo pieno per la tappa corrente — stessa
     coppia già usata da .stale per la nota di freschezza. */
  .arcstory { margin: .8rem auto 0; max-width: 26rem; text-align: left; display: grid; gap: .2rem; }
  .arcrow {
    display: block; width: 100%; min-height: 44px; padding: .5rem .2rem;
    border: 0; border-top: 1px solid var(--card-border); background: none;
    color: var(--dim); font: inherit; text-align: left; cursor: pointer;
  }
  .arcrow:first-child { border-top: 0; }
  .arcrow .arcdate { display: block; font-size: .74rem; font-weight: 650; text-transform: capitalize; }
  .arcrow .arctext { display: block; font-size: .8rem; line-height: 1.4; }
  .arcrow.on { color: var(--text); }

  /* ---------- ripiego senza JavaScript (invisibile col JS attivo) ---------- */
  .ns { margin-top: 1.6rem; text-align: center; color: var(--text); }
  .ns h2 { font-size: 1.15rem; font-weight: 700; }
  .ns > p { color: var(--dim); font-size: .85rem; margin-top: .4rem; }
  .ns-list { list-style: none; margin: 1.2rem auto 0; padding: 0; display: grid; gap: 1rem; max-width: 22rem; }
  .ns-item { border: 1px solid var(--card-border); border-radius: var(--radius); background: var(--card); padding: 1rem; }
  .ns-item strong { display: block; margin-bottom: .6rem; }
  .ns-item img { max-width: 100%; border-radius: 12px; display: block; margin: 0 auto .6rem; }
  .ns-item a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 .6rem; color: var(--text); }

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
      <!-- Niente attributo "download" (attenzione: qui dentro siamo in un
           template literal JS, mai usare backtick nei commenti): forzava Safari
           a salvare il file in silenzio nei Download. Senza, il tap NAVIGA sul
           file e iOS propone di aprirlo — un passaggio in meno prima di
           Comandi rapidi. -->
      <a class="btn primary" id="dlShortcut" href="/s/natura.shortcut">⬇️ Scarica la Shortcut</a>
      <a class="btn ghost" href="#setup">Come si attiva</a>
      <button class="btn ghost" id="copyurl">copia l'indirizzo del canale</button>
      <a class="btn ghost" id="feedlink" href="/feed/${esc(feedChannelId)}.xml">segui col lettore di feed</a>
    </div>
    <p class="hint">La Shortcut scaricata ha già l'URL del canale dentro: aprila e importala.</p>
    <p class="hint" id="nextdrop">Il wallpaper cambia da solo ogni notte.</p>

    <section class="journey">
      <div class="jhead">
        <h3>Il viaggio finora</h3>
        <button class="playbtn" id="play" hidden>▶ riproduci</button>
      </div>
      <!-- Didascalia volutamente corta: prima erano quattro righe per spiegare
           due frecce, e pesavano più dei comandi che descrivevano. Dice solo
           quello che serve: qui si sfoglia l'arco/settimana in corso (max 7
           giorni, un solo concept), non l'intero archivio permanente — che
           attraversa più concept e mischierebbe storie diverse. -->
      <p class="hint">Solo questa settimana, giorno per giorno — ↔ scorri o usa le frecce.</p>
      <!-- Niente più miniature: l'archivio si guarda nel mockup qui sopra.
           Qui restano solo data del fotogramma, posizione nel viaggio e le
           frecce giorno prec./succ. — senza, si perderebbe ogni riferimento
           a quale giorno si sta vedendo. -->
      <p class="hint" id="jmsg" hidden></p>
      <div class="daynav" id="daynav" hidden>
        <button class="dayctrl" id="dayprev" aria-label="Giorno precedente dell'archivio">‹</button>
        <!-- feat-il-viaggio-si-racconta-anche-a-chi-non-vede: aria-live annuncia
             il cambio giorno a chi non vede lo schermo (VoiceOver/TalkBack),
             che altrimenti non saprebbe mai quale giorno sta guardando. -->
        <div class="dayinfo" aria-live="polite" aria-atomic="true">
          <span class="ddate" id="ddate"></span>
          <span class="dpos" id="dpos"></span>
        </div>
        <button class="dayctrl" id="daynext" aria-label="Giorno successivo dell'archivio">›</button>
      </div>
      <!-- feat-salta-al-giorno-che-cerchi: con centinaia di giorni in archivio,
           le frecce e il dito muovono un giorno alla volta — per un giorno
           preciso (il compleanno, il giorno che qualcuno ti ha condiviso)
           serve un salto diretto. min/max/value seguono l'archivio del
           canale mostrato (v. updateDayNav). -->
      <input type="date" class="daypick" id="dayPick" hidden
        aria-label="Vai a un giorno specifico dell'archivio">
      <!-- feat-rivedi-l-arco-precedente: visibile solo quando, oltre alla
           finestra mostrata, esiste almeno un arco (settimana/concept) più
           vecchio scaricato da /api/archive ma non ancora raggiungibile. -->
      <button class="btn ghost" id="arcprev" hidden>‹ arco precedente</button>
      <!-- feat-torna-all-arco-in-corso: visibile solo dopo essere scesi in un
           arco passato con #arcprev — senza questo comando la finestra
           sull'arco vecchio sopravvive in archiveCache anche cambiando
           canale (loadArchive ricostruisce solo se !archiveCache[chId]),
           e l'utente resta bloccato nel passato fino al ricaricamento. -->
      <button class="btn ghost" id="arcnext" hidden>arco successivo ›</button>
      <!-- feat-condividi-il-giorno-che-stai-guardando: segue sempre lo stato
           di #daynav (stesso hasJourney in renderJourney) — niente da
           condividere quando non c'è navigazione fra giorni. -->
      <button class="btn ghost" id="dayshare" hidden>copia link</button>
      <!-- feat-apri-il-wallpaper-del-giorno-a-schermo-intero: stesso hasJourney
           di #dayshare — porta al file vero del giorno mostrato, alla sua
           risoluzione piena (srcFor(), la stessa URL del crossfade). -->
      <a class="btn ghost" id="dayopen" target="_blank" rel="noopener" hidden>apri l'immagine</a>
      <!-- feat-salva-il-wallpaper-con-un-nome-che-si-capisce: stesso hasJourney
           di #dayopen — stesso file, ma con ?dl=1 per farlo arrivare sul disco
           con un nome parlante invece del blob "natura" senza estensione. -->
      <a class="btn ghost" id="daysave" hidden>salva l'immagine</a>
      <!-- feat-segna-i-giorni-che-ti-piacciono: stesso hasJourney di
           #dayshare/#dayopen — nessun giorno da sfogliare, nessun giorno da
           segnare. Etichetta e aria-pressed seguono lo stato del giorno
           mostrato (v. renderJourney/updateDayNav). -->
      <button class="btn ghost" id="dayfav" aria-pressed="false" hidden>☆ segna preferito</button>
      <!-- feat-torna-a-oggi-da-qualunque-giorno: nessun percorso di ritorno
           diretto esisteva prima di questo ciclo — stepDay muove di un
           giorno, goToNextArc di un arco: chi è sceso di più passi doveva
           martellare le frecce. Nascosto quando si guarda già oggi
           nell'arco in corso (v. updateDayNav). -->
      <button class="btn ghost" id="daytoday" hidden>torna a oggi</button>
      <p class="dcap" id="dcap" hidden></p>
      <!-- feat-leggi-la-storia-dell-arco: chiuso di default (la home non deve
           allungarsi per chi non lo apre); comando e blocco compaiono solo
           quando renderArcStory trova almeno una tappa con testoTappa. -->
      <button class="btn ghost" id="storytoggle" hidden>leggi la storia</button>
      <div class="arcstory" id="arcstory" hidden></div>
      <!-- feat-scegli-l-arco-dall-elenco: unico modo, oggi, di raggiungere un
           arco lontano nell'archivio era martellare #arcprev un arco alla
           volta. Visibile solo con più di un arco (updateArcNav) — con un
           solo arco il salto non ha senso. Riusa .arcstory/.arcrow (stessa
           forma dell'elenco-tappe, VISUAL_SPECS §1.4): il componente cambia
           contenuto, non forma. -->
      <button class="btn ghost" id="arcpick" hidden>scegli l'arco</button>
      <div class="arcstory" id="arclist" hidden></div>
      <!-- feat-segna-i-giorni-che-ti-piacciono: visibile solo quando il
           canale mostrato ha almeno un preferito (v. renderFavList). Riusa
           .arcstory/.arcrow, stessa forma di elenco-tappe ed elenco-archi:
           cambia il contenuto, non la forma. Chiuso di default come #arcpick. -->
      <button class="btn ghost" id="favpick" hidden>i tuoi preferiti</button>
      <div class="arcstory" id="favlist" hidden></div>
    </section>
  </div>

  ${noscript}

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
      <em>a mano funziona ma in automazione no</em>.
    </p>
  </section>

  <footer>
    ArtiPop v3 — generato ogni notte da FLUX.2 su Cloudflare Workers AI ·
    <a href="/aiuto">Aiuto</a> ·
    <a href="/archivi">Archivi</a> ·
    <a href="/api/channels">API</a> · <a href="https://github.com/RiccardoDominici/ArtiPop">GitHub</a>
  </footer>
</main>

<div id="toast" role="status"></div>

<script>
"use strict";
// Dati canali resi dal server (solo campi pubblici).
const CHANNELS = ${JSON.stringify(channelData)};
// Vecchi id di canale (Shortcut/link storici) → id del flusso attivo che ne
// ha raccolto l'eredità: serve qui per far aprire ?c=<alias> sul flusso
// erede invece di ignorarlo (feat-i-vecchi-indirizzi-aprono-il-canale-erede).
const ALIAS = ${JSON.stringify(LEGACY_ALIASES)};
const ORIGIN = ${JSON.stringify(origin)};
const TODAY = ${JSON.stringify(dateKey)};
const ORA_CRON_UTC = ${JSON.stringify(ORA_CRON_UTC)};

const deckEl = document.getElementById("deck");
const dotsEl = document.getElementById("dots");
const playEl = document.getElementById("play");
const jmsgEl = document.getElementById("jmsg");
const daynavEl = document.getElementById("daynav");
const ddateEl = document.getElementById("ddate");
const dposEl = document.getElementById("dpos");
const dayPrevEl = document.getElementById("dayprev");
const dayNextEl = document.getElementById("daynext");
const arcPrevEl = document.getElementById("arcprev");
const arcNextEl = document.getElementById("arcnext");
const dcapEl = document.getElementById("dcap");
const storytoggleEl = document.getElementById("storytoggle");
const arcstoryEl = document.getElementById("arcstory");
const arcPickEl = document.getElementById("arcpick");
const arcListEl = document.getElementById("arclist");
const dayshareEl = document.getElementById("dayshare");
const copyurlEl = document.getElementById("copyurl");
const dayopenEl = document.getElementById("dayopen");
const daysaveEl = document.getElementById("daysave");
const dayFavEl = document.getElementById("dayfav");
const favPickEl = document.getElementById("favpick");
const favListEl = document.getElementById("favlist");
const dayTodayEl = document.getElementById("daytoday");
const dayPickEl = document.getElementById("dayPick");
const toastEl = document.getElementById("toast");
const journeyEl = document.querySelector(".journey");

let order = CHANNELS.map((_, i) => i); // ordine corrente del deck (order[0] = card in cima)
let previewDate = null;                 // data in preview nel mockup (null = oggi)
const archiveCache = {};                // channelId → [date, ...] finestra sfogliabile mostrata ora
const fullArchiveCache = {};            // channelId → [date, ...] intero archivio scaricato (?limit=400), non tagliato
const arcsCache = {};                   // channelId → [[date, ...], ...] archi contigui per conceptNome, dal più recente al più vecchio
const arcIndexCache = {};               // channelId → indice (in arcsCache) dell'arco attualmente mostrato in archiveCache
const capCache = {};                    // channelId → { date → {conceptNome, elementNome, tappa, testoTappa, giornoNellArco} }

/* ---------- link condiviso (?c=<canale>&d=<data>) ----------
   Letto una sola volta all'avvio, prima di costruire il deck: se il canale è
   noto lo porta in cima, se la data è nel formato atteso la si applica non
   appena l'archivio di quel canale è caricato (vedi renderJourney) — non si
   può sapere se la data esiste nell'archivio prima del fetch. */
const sharedParams = new URLSearchParams(location.search);
const sharedChannelId = sharedParams.get("c");
const sharedDateParam = sharedParams.get("d");
let pendingSharedDate =
  sharedDateParam && /^\\d{4}-\\d{2}-\\d{2}$/.test(sharedDateParam) ? sharedDateParam : null;
if (sharedChannelId) {
  let idx = CHANNELS.findIndex((c) => c.id === sharedChannelId);
  if (idx === -1 && ALIAS[sharedChannelId]) {
    idx = CHANNELS.findIndex((c) => c.id === ALIAS[sharedChannelId]);
  }
  if (idx !== -1) order = [idx, ...order.filter((i) => i !== idx)];
  else pendingSharedDate = null; // canale sconosciuto (né flusso attivo né alias): home normale su oggi, niente giorno da applicare
}

/* ---------- memoria del canale (localStorage, solo su questo dispositivo) ----------
   Mai un cookie, nessun dato inviato al worker: solo lo storage locale del
   browser. Ogni accesso è protetto da try/catch perché in navigazione privata
   o con storage disabilitato può lanciare — in tal caso si degrada in
   silenzio al comportamento attuale (nessun canale ricordato). */
const REMEMBERED_CHANNEL_KEY = "artipop:canale";
function leggiCanaleRicordato() {
  try {
    return localStorage.getItem(REMEMBERED_CHANNEL_KEY);
  } catch {
    return null;
  }
}
function ricordaCanale(id) {
  try {
    localStorage.setItem(REMEMBERED_CHANNEL_KEY, id);
  } catch {
    /* storage inaccessibile: nessun problema, la home funziona lo stesso */
  }
}
if (!sharedChannelId) {
  const rememberedId = leggiCanaleRicordato();
  if (rememberedId) {
    const idx = CHANNELS.findIndex((c) => c.id === rememberedId);
    if (idx !== -1) order = [idx, ...order.filter((i) => i !== idx)];
  }
}

/* ---------- memoria dei preferiti (localStorage, per canale) ----------
   feat-segna-i-giorni-che-ti-piacciono: stesso principio difensivo della
   memoria del canale sopra — try/catch su ogni accesso, ripiego a oggetto
   vuoto se lo storage non è disponibile o il JSON salvato è illeggibile o
   non è un oggetto (es. un valore scritto da una versione futura). */
const PREFERITI_KEY = "artipop:preferiti";
function leggiPreferiti() {
  try {
    const raw = localStorage.getItem(PREFERITI_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function scriviPreferiti(tutti) {
  try {
    localStorage.setItem(PREFERITI_KEY, JSON.stringify(tutti));
  } catch {
    /* storage inaccessibile: nessun problema, i preferiti restano solo in memoria per questa vista */
  }
}
// Date del canale, ordinate dal più recente al più vecchio.
function preferitiDi(chId) {
  const tutti = leggiPreferiti();
  const date = Array.isArray(tutti[chId]) ? tutti[chId] : [];
  return date.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
function isPreferito(chId, date) {
  return preferitiDi(chId).includes(date);
}
function togglePreferito(chId, date) {
  const tutti = leggiPreferiti();
  const attuali = Array.isArray(tutti[chId]) ? tutti[chId] : [];
  tutti[chId] = attuali.includes(date)
    ? attuali.filter((d) => d !== date)
    : [...attuali, date];
  scriviPreferiti(tutti);
}

/* ---------- toast pill (già in VISUAL_SPECS §1.4, mai usato finora) ---------- */
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

/* Prova a mettere il link negli appunti; lancia se la clipboard non è
   disponibile o rifiuta (contesto non sicuro, permesso negato) — sta ai
   chiamanti decidere il messaggio di ripiego, mai un errore non gestito in
   console. */
async function copiaNegliAppunti(link) {
  if (!navigator.clipboard) throw new Error("clipboard non disponibile");
  await navigator.clipboard.writeText(link);
}
async function shareLink() {
  const chId = CHANNELS[order[0]].id;
  const date = previewDate ?? TODAY;
  const link = ORIGIN + "/?c=" + chId + "&d=" + date;
  try {
    await copiaNegliAppunti(link);
    toast("link copiato");
  } catch {
    toast(link);
  }
}
dayshareEl.addEventListener("click", shareLink);

/* Indirizzo stabile del canale in cima (nessun ?date=/?v=): quello che la
   Shortcut deve chiamare ogni sera, utile a chi crea la Shortcut a mano
   perché iOS blocca l'importazione di quella firmata. */
async function copyChannelUrl() {
  const chId = CHANNELS[order[0]].id;
  const link = ORIGIN + "/w/" + chId;
  try {
    await copiaNegliAppunti(link);
    toast("indirizzo del canale copiato");
  } catch {
    toast(link);
  }
}
copyurlEl.addEventListener("click", copyChannelUrl);

/* ---------- costruzione card ---------- */
// Data leggibile in italiano per la nota di freschezza (stesso approccio di tickClock).
function fmtDataEstesa(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// feat-il-titolo-della-scheda-dice-cosa-guardi: il <title> server-side è letto
// una sola volta all'avvio (mai riscritto a mano) così non può disallinearsi
// dalla stringa vista dal server/anteprima social.
const TITOLO_BASE = document.title;
// Titolo della scheda del browser: segue il canale in cima al deck e, quando
// si sta sfogliando un giorno diverso da oggi, anche quella data. È l'unico
// segnale che cronologia, segnalibri e screen reader hanno di cosa cambia
// senza cambiare pagina — non deve mai poter interrompere il resto
// dell'aggiornamento della vista (principio 3), quindi protetto.
function aggiornaTitolo() {
  try {
    const ch = CHANNELS[order[0]];
    if (!ch) {
      document.title = TITOLO_BASE;
      return;
    }
    document.title = previewDate
      ? \`\${ch.name} — \${fmtDataEstesa(previewDate)} · ArtiPop\`
      : \`\${ch.name} · ArtiPop\`;
  } catch {
    document.title = TITOLO_BASE;
  }
}
// feat-il-viaggio-si-racconta-anche-a-chi-non-vede: unica formula della
// descrizione del wallpaper, riusata da cardHTML() (alt statico) e da
// previewDay() (alt aggiornato a ogni cambio giorno), per non biforcare il testo.
function descrizioneWallpaper(ch, date, isToday) {
  return \`\${ch.name} — wallpaper \${isToday ? "di oggi" : "del " + fmtDataEstesa(date)}\`;
}
function cardHTML(ch) {
  return \`
    <div class="phone" aria-hidden="true">
      <div class="island"></div>
      <div class="lock">
        <div class="ldate"></div>
        <div class="ltime"></div>
        <div class="lbottom"><div class="lbtn">🔦</div><div class="lbtn">📷</div></div>
      </div>
      <!-- ?v=\${ch.date} non è un cache-buster decorativo: è ciò che il worker
           usa per distinguere questa richiesta (il sito, cacheabile un'ora)
           da quella della Shortcut sullo stesso indirizzo senza query
           (sempre no-store, deve ricevere il file fresco). -->
      <img class="wall" src="/w/\${ch.id}?v=\${ch.date}" alt="\${descrizioneWallpaper(ch, ch.date, !ch.inRitardo)}" draggable="false" />
    </div>
    <div class="cinfo">
      <h2>\${ch.emoji} \${ch.name}</h2>
      <div class="tag">\${ch.tagline}</div>
      <div class="scene">\${ch.concept ? "<b>Questa settimana:</b> " + ch.concept + (ch.giorno ? " — giorno " + ch.giorno + " di 7" : "") + "<br>" : ""}\${ch.scene ? ch.scene : "in preparazione…"}</div>
      \${ch.inRitardo ? '<p class="stale">Il wallpaper di oggi non è ancora arrivato: questa è l\\'ultima immagine disponibile, del ' + fmtDataEstesa(ch.date) + ".</p>" : ""}
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
  // Il comando "segui col lettore di feed" e il link di autodiscovery
  // nell'head devono seguire lo stesso canale, non restare fissi su quello
  // reso lato server (guardie if: un nodo assente non deve mai interrompere
  // lo sfoglio dei canali).
  const feedlinkEl = document.getElementById("feedlink");
  if (feedlinkEl) feedlinkEl.href = \`/feed/\${ch.id}.xml\`;
  const feedAutodiscoveryEl = document.querySelector('link[type="application/rss+xml"]');
  if (feedAutodiscoveryEl) feedAutodiscoveryEl.href = \`/feed/\${ch.id}.xml\`;
  dotsEl.innerHTML = CHANNELS.map((c) =>
    \`<span class="dot\${c.id === ch.id ? " on" : ""}"></span>\`).join("");
  previewDate = null;
  loadArchive(ch.id);
  ricordaCanale(ch.id); // memorizza il canale in cima: alla prossima visita si riapre da qui
  aggiornaTitolo();
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

// feat-quando-arriva-il-prossimo-wallpaper: frase pura, senza riferimenti al
// giorno ("oggi"/"domani") così resta identica per tutta la giornata e la
// baseline visiva non cambia da un tick all'altro. Converte l'ora UTC del
// cron nel fuso del dispositivo con Intl — se fallisce, il chiamante tiene
// il testo già servito dal server (vedi sotto).
function testoProssimoWallpaper(oraUtc, ora = new Date()) {
  const d = new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth(), ora.getUTCDate(), oraUtc, 0, 0));
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (!/^\\d{2}:\\d{2}$/.test(time)) throw new Error("orario inatteso");
  return \`Il wallpaper cambia da solo ogni notte, verso le \${time}.\`;
}
try {
  const nextdropEl = document.getElementById("nextdrop");
  nextdropEl.textContent = testoProssimoWallpaper(ORA_CRON_UTC);
} catch {
  // Nodo lasciato com'è: conserva il testo servito dal server (nessuna
  // frase monca, nessun "verso le undefined").
}

// feat-la-home-mostra-il-giorno-nuovo-quando-torni: pura, confronta per data
// (non per differenza numerica) così regge anche il cambio di mese/anno.
// La guardia sull'ora UTC evita di ricaricare prima che il cron notturno
// abbia consegnato: altrimenti la card mostrerebbe il canale "in ritardo"
// al posto del giorno di ieri, un passo indietro percepito dall'utente.
function giornoNuovoDisponibile(todayServito, ora = new Date()) {
  const oggiUtc = \`\${ora.getUTCFullYear()}-\${String(ora.getUTCMonth() + 1).padStart(2, "0")}-\${String(ora.getUTCDate()).padStart(2, "0")}\`;
  return oggiUtc > todayServito && ora.getUTCHours() >= ORA_CRON_UTC;
}
document.addEventListener("visibilitychange", () => {
  try {
    if (document.visibilityState !== "visible") return;
    if (previewDate !== null && previewDate !== TODAY) return; // esplorazione dell'archivio in corso: non interromperla
    if (giornoNuovoDisponibile(TODAY)) location.reload();
  } catch {
    // Nessun reload in caso di errore: la home resta quella già mostrata.
  }
});

/* ---------- viaggio nell'archivio (sfogliato dentro il mockup) ----------
   Niente più striscia di miniature: le date d'archivio servono solo a far
   scorrere l'anteprima avanti/indietro e a mostrare "N di M" sotto al
   mockup, così si capisce a colpo d'occhio dove si è nel viaggio. */
// feat-rivedi-l-arco-precedente: raggruppa le date (dal più recente al più
// vecchio) in blocchi contigui per conceptNome. Un giorno senza dati
// narrativi (conceptNome assente, es. giorno ricostruito) non apre un
// blocco nuovo: resta in quello in cui si trova, così un buco del cron non
// spezza in due la stessa storia.
function computeArcs(dates, cap) {
  const arcs = [];
  let block = [];
  let blockConcept = null;
  for (const d of dates) {
    const concept = (cap[d] || {}).conceptNome || null;
    if (concept && blockConcept && concept !== blockConcept) {
      arcs.push(block);
      block = [];
    }
    if (concept) blockConcept = concept;
    block.push(d);
  }
  if (block.length) arcs.push(block);
  return arcs;
}

async function loadArchive(chId) {
  jmsgEl.hidden = false;
  jmsgEl.textContent = "carico l'archivio…";
  daynavEl.hidden = true;
  playEl.hidden = true;
  arcPrevEl.hidden = true;
  try {
    if (!archiveCache[chId]) {
      const res = await fetch(\`/api/archive/\${chId}?limit=400\`);
      const body = await res.json();
      let dates = body.dates || [];
      // Didascalia ("il viaggio racconta il giorno"): stessa risposta di sopra,
      // giorni[] porta già soggetto e testo della tappa — zero fetch in più.
      const cap = {};
      for (const g of body.giorni || []) {
        if (g && g.data) cap[g.data] = g;
      }
      capCache[chId] = cap;
      fullArchiveCache[chId] = dates;
      arcsCache[chId] = computeArcs(dates, cap);
      // Limita l'anteprima all'arco (settimana/concept) in corso: l'archivio
      // permanente attraversa più arc nel tempo, e sfogliarli tutti di fila
      // mischia storie diverse (es. giorni di un cactus seguiti di colpo da
      // un'isola volante — non un difetto di generazione, solo concept
      // diversi messi in fila come fossero uno). "giorno" (= dayInArc+1,
      // calcolato server-side in renderPage) dice quanti giorni dell'arco
      // corrente esistono; le date arrivano già dal più recente, quindi le
      // prime "giorno" sono esattamente quelle dell'arco in corso. Se
      // l'archivio ne ha meno (es. un giorno saltato dal cron), slice si
      // ferma da sola a quelle disponibili — nessun buco. Se "giorno" manca
      // (meta di oggi non disponibile) non si indovina: si tiene tutto
      // l'archivio, comportamento di prima.
      const ch = CHANNELS.find((c) => c.id === chId);
      if (Number.isInteger(ch?.giorno)) dates = dates.slice(0, ch.giorno);
      archiveCache[chId] = dates;
      // arcsCache[chId][0] contiene sempre la prima data dell'array (la più
      // recente), perché computeArcs parte da lì: è lo stesso arco della
      // finestra iniziale appena calcolata sopra.
      arcIndexCache[chId] = 0;
    }
    renderJourney(chId);
  } catch {
    jmsgEl.hidden = false;
    jmsgEl.textContent = "archivio non disponibile";
  }
}

function srcFor(chId, date, isToday) {
  return isToday ? \`/w/\${chId}?v=\${TODAY}\` : \`/w/\${chId}?date=\${date}\`;
}

// feat-il-viaggio-si-sfoglia-senza-attesa: senza anticipo, ogni passo di
// stepDay mostra la card ferma finché il PNG da 960×2048 non arriva. Qui si
// scaricano in silenzio SOLO i due vicini immediati (il giorno prima e il
// giorno dopo di quello mostrato ora) — mai l'arco intero, per non far
// pagare a chi apre il viaggio e non lo sfoglia il peso di tutte le immagini.
const precaricati = new Set();
function precaricaAdiacenti(chId, date) {
  try {
    const dates = archiveCache[chId] || [];
    const idx = dates.indexOf(date);
    if (idx === -1) return; // giorno fuori dalla finestra dell'arco corrente
    [dates[idx - 1], dates[idx + 1]].forEach((d) => {
      if (!d) return;
      const src = srcFor(chId, d, d === TODAY);
      if (precaricati.has(src)) return;
      precaricati.add(src);
      const im = new Image();
      im.src = src;
    });
  } catch {
    // un precaricamento è un lusso: non deve mai poter interrompere lo sfoglio.
  }
}

function renderJourney(chId) {
  if (CHANNELS[order[0]].id !== chId) return; // nel frattempo l'utente ha cambiato card
  const dates = archiveCache[chId];
  // Con meno di 2 giorni archiviati non c'è nulla da sfogliare: niente
  // frecce, niente tasto play, solo un avviso — evita comandi inutili.
  const hasJourney = !!dates && dates.length >= 2;
  daynavEl.hidden = !hasJourney;
  dayPickEl.hidden = !hasJourney;
  dayshareEl.hidden = !hasJourney;
  dayopenEl.hidden = !hasJourney;
  daysaveEl.hidden = !hasJourney;
  dayFavEl.hidden = !hasJourney;
  playEl.hidden = !hasJourney;
  jmsgEl.hidden = hasJourney;
  updateArcNav(chId);
  if (!hasJourney) {
    jmsgEl.textContent = "il viaggio inizia oggi ✨";
    dcapEl.hidden = true;
    storytoggleEl.hidden = true;
    arcstoryEl.hidden = true;
    arcPickEl.hidden = true;
    arcListEl.hidden = true;
    favPickEl.hidden = true;
    favListEl.hidden = true;
    pendingSharedDate = null;
    return;
  }
  renderArcStory(chId);
  renderArcList(chId);
  renderFavList(chId);
  updateDayNav(chId);
  precaricaAdiacenti(chId, TODAY); // il primo passo dello sfoglio parte già precaricato
  // Link condiviso con una data valida e presente nell'archivio: si mostra
  // subito quella scena, ferma — chi arriva da un link vede ciò che gli è
  // stato condiviso, non un'animazione che glielo porta via. Si applica una
  // sola volta (all'avvio), non ad ogni cambio di canale successivo.
  if (pendingSharedDate && dates.includes(pendingSharedDate)) {
    const d = pendingSharedDate;
    pendingSharedDate = null;
    previewDay(chId, d, d === TODAY);
    return;
  }
  // feat-il-link-condiviso-apre-il-giorno-anche-di-un-arco-passato: la data
  // condivisa non è nella finestra in corso ma può appartenere a un arco già
  // chiuso — un link riletto la settimana dopo è il caso normale, non va
  // scartato in silenzio. Si cerca l'arco che la contiene e ci si sposta,
  // fermi su quel giorno (nessun autoplay, stessa regola del ramo sopra).
  if (pendingSharedDate) {
    const arcs = arcsCache[chId] || [];
    const arcIdx = arcs.findIndex((arc) => arc.includes(pendingSharedDate));
    if (arcIdx !== -1) {
      const d = pendingSharedDate;
      pendingSharedDate = null;
      goToArc(chId, arcIdx, d);
      return;
    }
    // Giorno mai generato, o archivio che non lo contiene più: si avvisa
    // l'utente invece di aprire in silenzio il timelapse di oggi come se
    // nulla fosse successo, e si prosegue con il comportamento odierno.
    pendingSharedDate = null;
    toast("quel giorno non è in archivio — ti mostro oggi");
  }
  // Anteprima "stile GIF": il timelapse parte da solo (salvo motion ridotto).
  if (!playing && !prefersStill) startPlayback();
}

/* Aggiorna data e posizione ("N di M") sotto il mockup, e abilita/disabilita
   le frecce ai bordi dell'archivio (senza ricostruire il DOM). */
function updateDayNav(chId) {
  const dates = archiveCache[chId] || [];
  const date = previewDate ?? TODAY;
  const idx = dates.indexOf(date); // 0 = oggi (più recente) ... length-1 = il giorno più vecchio
  ddateEl.textContent = formatDayLabel(date);
  // Posizione letta come progresso del viaggio: 1 = il giorno più vecchio, M = oggi.
  dposEl.textContent = dates.length ? \`\${idx === -1 ? "?" : dates.length - idx} di \${dates.length}\` : "";
  dayPrevEl.disabled = idx === -1 || idx >= dates.length - 1;
  dayNextEl.disabled = idx <= 0;
  dayopenEl.href = srcFor(chId, date, date === TODAY);
  daysaveEl.href = srcFor(chId, date, date === TODAY) + "&dl=1";
  // Nascosto solo quando si sta già guardando oggi nell'arco in corso —
  // altrimenti (giorno diverso o arco passato) offre il ritorno diretto.
  dayTodayEl.hidden = previewDate === null && (arcIndexCache[chId] ?? 0) === 0;
  // feat-salta-al-giorno-che-cerchi: min/max coprono l'intero archivio noto
  // del canale (unione degli archi, non solo la finestra sfogliata ora),
  // così si può saltare anche a un giorno di un arco già chiuso.
  const known = (arcsCache[chId] || []).flat();
  const range = known.length ? known : dates;
  if (range.length) {
    dayPickEl.min = range.reduce((a, b) => (b < a ? b : a));
    dayPickEl.max = range.reduce((a, b) => (b > a ? b : a));
  }
  dayPickEl.value = date;
  updateDayCaption(chId, date);
  updateArcStoryHighlight(date);
  updateDayFavButton(chId, date);
  updateFavListHighlight(date);
  aggiornaTitolo();
}

// Etichetta breve di una data: stesso formato usato da #ddate, riusato anche
// dalle righe della storia dell'arco (feat-leggi-la-storia-dell-arco).
function formatDayLabel(date) {
  return date === TODAY
    ? "oggi"
    : new Date(date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

/* Didascalia sotto la posizione: soggetto del giorno + testo della tappa.
   Nascosta (non stringa vuota) quando per il giorno mancano i dati narrativi
   (giorno ricostruito, origine "assente") — mai "null"/"undefined" in pagina. */
function updateDayCaption(chId, date) {
  const g = (capCache[chId] || {})[date];
  if (!g || !g.testoTappa) {
    dcapEl.hidden = true;
    dcapEl.textContent = "";
    return;
  }
  dcapEl.innerHTML = "";
  const subjectText = [g.conceptNome, g.elementNome].filter(Boolean).join(" ");
  if (subjectText) {
    const subject = document.createElement("strong");
    subject.textContent = subjectText;
    dcapEl.appendChild(subject);
    dcapEl.appendChild(document.createTextNode(" — " + g.testoTappa));
  } else {
    dcapEl.appendChild(document.createTextNode(g.testoTappa));
  }
  dcapEl.hidden = false;
}

/* feat-leggi-la-storia-dell-arco: ricostruisce l'elenco delle tappe
   dell'arco attualmente mostrato — le date dell'arco (arcsCache, fallback
   archiveCache se gli arc non sono disponibili) lette dal più vecchio al
   più recente su una COPIA (mai .reverse() sull'array in cache, ci
   scorrono anche goToPreviousArc/goToNextArc). Righe costruite con
   createElement/textContent, mai innerHTML con testo del catalogo — stessa
   disciplina di updateDayCaption. I giorni senza testoTappa (giorno
   ricostruito, origine "assente") vengono omessi: mai una riga
   "undefined", mai un comando che apre un blocco vuoto. */
function renderArcStory(chId) {
  arcstoryEl.innerHTML = "";
  const arcs = arcsCache[chId] || [];
  const idx = arcIndexCache[chId] ?? 0;
  const arc = arcs[idx] || archiveCache[chId] || [];
  const dates = arc.slice().reverse(); // dal più vecchio al più recente
  const cap = capCache[chId] || {};
  for (const d of dates) {
    const g = cap[d];
    if (!g || !g.testoTappa) continue;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "arcrow";
    row.dataset.date = d;
    const label = document.createElement("span");
    label.className = "arcdate";
    label.textContent = formatDayLabel(d);
    const text = document.createElement("span");
    text.className = "arctext";
    text.textContent = g.testoTappa;
    row.appendChild(label);
    row.appendChild(text);
    row.addEventListener("click", () => {
      stopPlayback();
      previewDay(chId, d, d === TODAY);
    });
    arcstoryEl.appendChild(row);
  }
  const hasRows = arcstoryEl.children.length > 0;
  storytoggleEl.hidden = !hasRows;
  if (!hasRows) arcstoryEl.hidden = true;
  updateArcStoryHighlight(previewDate ?? TODAY);
}
storytoggleEl.addEventListener("click", () => {
  arcstoryEl.hidden = !arcstoryEl.hidden;
});

/* feat-scegli-l-arco-dall-elenco: elenco degli archi del canale — una riga
   per arco (dal più recente al più vecchio, ordine nativo di arcsCache, mai
   .reverse() sull'array in cache), tocco = salto diretto a quell'arco via
   goToArc. Ricostruita ad ogni cambio di arco/canale (stesse chiamate di
   renderArcStory) così l'evidenziazione ".on" resta corretta senza una
   funzione di highlight separata. Righe con createElement/textContent, mai
   innerHTML con testo del catalogo — stessa disciplina di renderArcStory. */
function renderArcList(chId) {
  arcListEl.innerHTML = "";
  const arcs = arcsCache[chId] || [];
  const cap = capCache[chId] || {};
  const idx = arcIndexCache[chId] ?? 0;
  arcs.forEach((arc, i) => {
    const newest = arc[0];
    const oldest = arc[arc.length - 1];
    const range = newest === oldest
      ? formatDayLabel(newest)
      : \`\${formatDayLabel(oldest)} – \${formatDayLabel(newest)}\`;
    let concept = null;
    for (const d of arc) {
      const g = cap[d];
      if (g && g.conceptNome) { concept = g.conceptNome; break; }
    }
    const row = document.createElement("button");
    row.type = "button";
    row.className = "arcrow" + (i === idx ? " on" : "");
    const label = document.createElement("span");
    label.className = "arcdate";
    label.textContent = range;
    const text = document.createElement("span");
    text.className = "arctext";
    text.textContent = concept || "arco senza titolo";
    row.appendChild(label);
    row.appendChild(text);
    row.addEventListener("click", () => goToArc(chId, i));
    arcListEl.appendChild(row);
  });
  // Con un solo arco (o nessuno) il salto non serve: niente comando, niente
  // elenco. Chiuso di default e richiuso ad ogni ricostruzione (cambio di
  // canale o di arco), come da §1.4.
  arcPickEl.hidden = arcs.length <= 1;
  arcListEl.hidden = true;
}
arcPickEl.addEventListener("click", () => {
  arcListEl.hidden = !arcListEl.hidden;
});

/* feat-segna-i-giorni-che-ti-piacciono: etichetta e aria-pressed di #dayfav
   seguono lo stato del giorno mostrato — chiamata da updateDayNav ad ogni
   cambio di giorno e subito dopo il toggle, così i due percorsi restano
   sempre coerenti senza duplicare la logica di stato. */
function updateDayFavButton(chId, date) {
  const attivo = isPreferito(chId, date);
  dayFavEl.textContent = attivo ? "★ preferito" : "☆ segna preferito";
  dayFavEl.setAttribute("aria-pressed", String(attivo));
}
dayFavEl.addEventListener("click", () => {
  const chId = CHANNELS[order[0]].id;
  const date = previewDate ?? TODAY;
  togglePreferito(chId, date);
  updateDayFavButton(chId, date);
  renderFavList(chId);
});

/* feat-segna-i-giorni-che-ti-piacciono: elenco dei giorni segnati per il
   canale mostrato — stessa forma di renderArcList (righe .arcrow dentro
   .arcstory), dal più recente al più vecchio (preferitiDi già ordina così).
   Il testo di ogni riga è il nome del concept di quel giorno se noto dalla
   cache d'archivio, altrimenti un testo di ripiego — mai "undefined" in
   pagina. Il click riusa goToArc (lo stesso percorso di salto di #dayPick e
   di #arclist), non una seconda implementazione del salto d'arco. */
function renderFavList(chId) {
  favListEl.innerHTML = "";
  const date = previewDate ?? TODAY;
  const cap = capCache[chId] || {};
  const preferiti = preferitiDi(chId);
  for (const d of preferiti) {
    const g = cap[d];
    const row = document.createElement("button");
    row.type = "button";
    row.className = "arcrow" + (d === date ? " on" : "");
    row.dataset.date = d;
    const label = document.createElement("span");
    label.className = "arcdate";
    label.textContent = formatDayLabel(d);
    const text = document.createElement("span");
    text.className = "arctext";
    text.textContent = (g && g.conceptNome) || "giorno preferito";
    row.appendChild(label);
    row.appendChild(text);
    row.addEventListener("click", () => {
      const arcs = arcsCache[chId] || [];
      const arcIdx = arcs.findIndex((arc) => arc.includes(d));
      if (arcIdx === -1) {
        toast("quel giorno non è più in archivio");
        return;
      }
      stopPlayback();
      goToArc(chId, arcIdx, d);
    });
    favListEl.appendChild(row);
  }
  // Nessun preferito per questo canale: niente comando, niente elenco —
  // stessa regola di #arcpick con meno di due archi.
  favPickEl.hidden = preferiti.length === 0;
  favListEl.hidden = true;
}
favPickEl.addEventListener("click", () => {
  favListEl.hidden = !favListEl.hidden;
});

/* Evidenzia la riga del giorno mostrato in #favlist senza ricostruire il
   DOM — stessa meccanica di updateArcStoryHighlight, chiamata da
   updateDayNav ad ogni cambio di giorno. */
function updateFavListHighlight(date) {
  for (const row of favListEl.children) {
    row.classList.toggle("on", row.dataset.date === date);
  }
}

/* Evidenzia la riga della data mostrata senza ricostruire il DOM — chiamata
   da updateDayNav ad ogni cambio di giorno, sia da click sull'elenco sia
   dalle frecce ‹ ›. */
function updateArcStoryHighlight(date) {
  for (const row of arcstoryEl.children) {
    row.classList.toggle("on", row.dataset.date === date);
  }
}

/* Un passo avanti/indietro nell'archivio: dir=-1 giorno precedente (più
   vecchio), dir=+1 giorno successivo (più recente, verso oggi). */
function stepDay(dir) {
  const chId = CHANNELS[order[0]].id;
  const dates = archiveCache[chId] || [];
  const idx = dates.indexOf(previewDate ?? TODAY);
  if (idx === -1) return;
  const targetIdx = idx - dir;
  if (targetIdx < 0 || targetIdx >= dates.length) return; // già al bordo dell'archivio
  stopPlayback();
  const d = dates[targetIdx];
  previewDay(chId, d, d === TODAY);
}
dayPrevEl.addEventListener("click", () => stepDay(-1));
dayNextEl.addEventListener("click", () => stepDay(1));

/* feat-salta-al-giorno-che-cerchi: salto diretto alla data scelta nel
   selettore. Cerca l'arco che la contiene (può essere un arco già chiuso,
   non solo la finestra sfogliata ora) e ci si sposta come fa il link
   condiviso di un giorno passato. Se la data non ha wallpaper, nessun
   salto: si avvisa e il campo torna al giorno mostrato — mai uno schermo
   nero, mai un errore grezzo. */
dayPickEl.addEventListener("change", () => {
  const chId = CHANNELS[order[0]].id;
  const d = dayPickEl.value;
  const arcs = arcsCache[chId] || [];
  const arcIdx = arcs.findIndex((arc) => arc.includes(d));
  if (arcIdx === -1) {
    toast("nessun wallpaper per quel giorno");
    dayPickEl.value = previewDate ?? TODAY;
    return;
  }
  goToArc(chId, arcIdx, d);
});

/* Il listener globale su window (riga 705) manda ArrowLeft/ArrowRight al
   mazzo dei canali: chi ha appena mosso il fuoco dentro "Il viaggio finora"
   (es. cliccando ‹ ›) e continua a freccia perde il canale invece di
   sfogliare il giorno. Qui intercettiamo l'evento prima che risalga a
   window e lo dirottiamo su stepDay, lasciando invariato il comportamento
   fuori dal viaggio. */
journeyEl.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return; // scorciatoie di cronologia del browser
  if (daynavEl.hidden) return; // nessun archivio sfogliabile
  e.preventDefault();
  e.stopPropagation();
  stepDay(e.key === "ArrowLeft" ? -1 : 1);
});

/* Sfoglia i giorni col dito, come il mazzo dei canali (attachDrag, riga 691)
   ma senza trascinare nulla: .journey non è una card, resta ferma. Nessun
   preventDefault su pointermove, così lo scorrimento verticale della pagina
   resta libero; solo un trascinamento prevalentemente orizzontale e ampio
   conta come gesto. */
let journeySwipe = null;
function attachJourneySwipe() {
  journeyEl.addEventListener("pointerdown", (e) => {
    if (daynavEl.hidden) return; // nessun archivio sfogliabile
    if (e.target.closest("button, a")) return;
    journeySwipe = { x0: e.clientX, y0: e.clientY };
  });
  journeyEl.addEventListener("pointermove", (e) => {
    if (!journeySwipe) return;
    journeySwipe.dx = e.clientX - journeySwipe.x0;
    journeySwipe.dy = e.clientY - journeySwipe.y0;
  });
  const end = () => {
    if (!journeySwipe) return;
    const { dx, dy } = journeySwipe;
    journeySwipe = null;
    if (dx === undefined) return;
    if (Math.abs(dx) <= 48 || Math.abs(dx) <= Math.abs(dy)) return;
    stepDay(dx > 0 ? -1 : 1);
  };
  journeyEl.addEventListener("pointerup", end);
  journeyEl.addEventListener("pointercancel", () => { journeySwipe = null; });
}

// Governa insieme "arco precedente" e "arco successivo": arcprev visibile
// solo se esiste un arco più vecchio non ancora raggiunto, arcnext visibile
// solo se si è già scesi in un arco passato (idx > 0, l'arco in corso è 0).
function updateArcNav(chId) {
  const arcs = arcsCache[chId] || [];
  const idx = arcIndexCache[chId] ?? 0;
  arcPrevEl.hidden = idx >= arcs.length - 1;
  arcNextEl.hidden = idx <= 0;
}

// feat-scegli-l-arco-dall-elenco: salto diretto a un indice d'arco
// arbitrario, usato dal click su una riga di #arclist — la stessa
// meccanica di goToPreviousArc/goToNextArc/goToToday (mai unire due archi
// nella stessa finestra sfogliabile, si posiziona sul giorno più recente
// del nuovo arco, salvo l'arco in corso dove punta a oggi se già in
// archivio). Le tre funzioni sotto restano dedicate ai loro comandi
// (frecce ‹ ›, "torna a oggi": test preesistenti ne fissano il corpo) e
// aggiornano #arclist con renderArcList senza passare da qui.
// feat-il-link-condiviso-apre-il-giorno-anche-di-un-arco-passato: terzo
// parametro opzionale dataTarget — se valorizzato e presente nell'arco di
// destinazione, l'anteprima si ferma su quel giorno invece che su "oggi o il
// più recente". Senza il parametro il comportamento resta quello di sempre
// (frecce, elenco archi, "torna a oggi": i loro test non devono cambiare).
function goToArc(chId, idx, dataTarget = null) {
  const arcs = arcsCache[chId] || [];
  if (idx < 0 || idx >= arcs.length) return;
  stopPlayback();
  arcIndexCache[chId] = idx;
  archiveCache[chId] = arcs[idx];
  updateArcNav(chId);
  renderArcStory(chId);
  renderArcList(chId);
  const dates = archiveCache[chId];
  const d = dataTarget && dates.includes(dataTarget)
    ? dataTarget
    : (dates.includes(TODAY) ? TODAY : dates[0]);
  previewDay(chId, d, d === TODAY);
}

// Sposta la finestra sfogliabile sull'arco precedente, mai unendola a quella
// corrente (un arco alla volta, la regola del ciclo 47 resta intatta), e si
// posiziona sul giorno più recente del nuovo arco.
function goToPreviousArc() {
  const chId = CHANNELS[order[0]].id;
  const arcs = arcsCache[chId] || [];
  const idx = arcIndexCache[chId] ?? 0;
  if (idx >= arcs.length - 1) return;
  stopPlayback();
  arcIndexCache[chId] = idx + 1;
  archiveCache[chId] = arcs[idx + 1];
  updateArcNav(chId);
  renderArcStory(chId);
  renderArcList(chId);
  const d = archiveCache[chId][0];
  previewDay(chId, d, d === TODAY);
}
arcPrevEl.addEventListener("click", goToPreviousArc);

// feat-torna-all-arco-in-corso: speculare a goToPreviousArc — senza questo
// comando la finestra sull'arco passato resta in archiveCache anche
// cambiando canale (loadArchive la ricostruisce solo se assente), e chi è
// sceso in un arco vecchio non ha modo di risalire alla settimana in corso.
function goToNextArc() {
  const chId = CHANNELS[order[0]].id;
  const arcs = arcsCache[chId] || [];
  const idx = arcIndexCache[chId] ?? 0;
  if (idx <= 0) return;
  stopPlayback();
  arcIndexCache[chId] = idx - 1;
  archiveCache[chId] = arcs[idx - 1];
  updateArcNav(chId);
  renderArcStory(chId);
  renderArcList(chId);
  const d = archiveCache[chId][0];
  previewDay(chId, d, d === TODAY);
}
arcNextEl.addEventListener("click", goToNextArc);

// feat-torna-a-oggi-da-qualunque-giorno: nessun comando esistente riporta
// direttamente a oggi — stepDay muove di un giorno, goToNextArc di un arco.
// Riallinea in un solo passaggio alla finestra dell'arco in corso (indice 0,
// mai unendo archi, stessa meccanica di goToNextArc) e al giorno di oggi; se
// il canale è in ritardo e oggi non è ancora in archivio, si ferma sul
// giorno più recente disponibile invece di puntare a una data mai archiviata.
function goToToday() {
  const chId = CHANNELS[order[0]].id;
  if (!archiveCache[chId]) return;
  stopPlayback();
  arcIndexCache[chId] = 0;
  archiveCache[chId] = arcsCache[chId][0];
  updateArcNav(chId);
  renderArcStory(chId);
  renderArcList(chId);
  const dates = archiveCache[chId];
  const d = dates.includes(TODAY) ? TODAY : dates[0];
  previewDay(chId, d, d === TODAY);
}
dayTodayEl.addEventListener("click", goToToday);

/* Traccia l'ultima src richiesta a previewDay, per scartare risposte tardive
   (onload/onerror) di richieste ormai superate da un cambio giorno successivo. */
let pendingPreviewSrc = null;

/* Mostra un giorno nel mockup della card in cima (crossfade). */
function previewDay(chId, date, isToday) {
  const top = deckEl.querySelector(".card.top .wall");
  if (!top) return;
  previewDate = isToday ? null : date;
  top.style.opacity = 0;
  const src = srcFor(chId, date, isToday);
  pendingPreviewSrc = src;
  const pre = new Image();
  pre.onload = () => {
    if (pendingPreviewSrc !== src) return; // l'utente ha già cambiato giorno: non sovrascrivere
    top.src = src;
    // feat-il-viaggio-si-racconta-anche-a-chi-non-vede: senza questo, l'alt
    // resta quello statico di cardHTML() ("wallpaper di oggi") anche
    // sfogliando giorni passati — descrive solo l'immagine che è davvero
    // a schermo, mai quella scartata da onerror.
    const ch = CHANNELS.find((c) => c.id === chId);
    if (ch) top.alt = descrizioneWallpaper(ch, date, isToday);
    top.style.opacity = 1;
  };
  // feat-il-viaggio-non-resta-mai-a-schermo-nero: senza onerror, una rete che
  // cade lascia la card nera per sempre (opacity resta 0 e top.src non viene
  // mai assegnato) — tipicamente da mobile, fuori casa. Ripristiniamo l'immagine
  // precedente invece di mostrare il buco nero, e fermiamo il timelapse per non
  // ciclare a vuoto su frame che non arrivano.
  pre.onerror = () => {
    if (pendingPreviewSrc !== src) return; // guardia: l'utente ha già cambiato giorno
    top.style.opacity = 1;
    stopPlayback();
    toast("questo giorno non si carica — controlla la connessione");
  };
  pre.src = src;
  updateDayNav(chId);
  precaricaAdiacenti(chId, date); // i prossimi due passi (avanti/indietro) sono già in cache al ritorno
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

attachJourneySwipe();
buildDeck();
</script>
</body>
</html>`;
}
