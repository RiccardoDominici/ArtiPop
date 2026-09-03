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
import { INSTALL_TAGS, metaAnteprima, feedLinkTag, canonicalTag } from "./head.js";
import { esc } from "./util.js";

// feat-quando-arriva-il-prossimo-wallpaper: specchio di triggers.crons in
// backend/wrangler.jsonc (ambiente di produzione) — il cron di generazione
// gira alle 03:00 UTC. Se quell'orario cambia senza aggiornare questa
// costante, la home mostrerebbe un orario sbagliato all'utente: il test
// backend/tests/unit/config-cron-coerente.test.js rompe apposta in quel caso.
// Esportata perché è anche l'unica fonte dell'ora per la rotta
// GET /promemoria.ics (feat-il-promemoria-del-wallpaper-va-nel-calendario).
export const ORA_CRON_UTC = 3;

// NOTA: qui viveva esc(), un escape HTML mai chiamato nel file — i campi del
// template (ch.name, ch.tagline, ch.scene, ch.concept) vengono inseriti senza
// escaping già oggi. Rimuovere la funzione morta non cambia questo: NON
// iniziare a usarla sui campi del template senza che sia una scelta a parte,
// perché cambierebbe cosa il sito mostra.


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
  // Mappa inversa di LEGACY_ALIASES (flusso attivo → vecchi id che vi
  // puntano, nell'ordine di dichiarazione): feat-la-home-dice-da-dove-viene-
  // questo-canale, per dire in home quali canali storici un flusso ha
  // ereditato. Stessi id già pubblici in ALIAS, nessun dato nuovo.
  const legacyByTarget = {};
  for (const [oldId, targetId] of Object.entries(LEGACY_ALIASES)) {
    (legacyByTarget[targetId] ||= []).push(oldId);
  }

  // Dati pubblici passati al JS client (niente campi interni).
  const channelData = ACTIVE_CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    accent: c.accent,
    tagline: c.tagline,
    eredita: legacyByTarget[c.id] || [],
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
${INSTALL_TAGS}
${canonicalTag(origin, "/")}
${feedLinkTag(feedUrl)}
${metaAnteprima(origin, dateKey, pageTitle, pageDescription, condiviso)}
<style>
  :root {
    /* Palette Salvia (mockup "Salvia" — Biglietto Swipe, proposta §7 ciclo
       feat-home-salvia): fondo salvia polveroso, carta crema verdastra,
       inchiostro bosco spento, erba secca e muschio come accenti. */
    --bg: #DCE2D2;
    --card: #F6F8F1;
    --card-border: #2B3028;
    --text: #2B3028;
    --dim: #68725F;
    --soft: #5C6552;
    --erba: #7A7A52;
    --muschio: #5C6E58;
    --dots: #B3BBA4;
    --guida: #C6CDB6;
    --radius: 26px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { scroll-behavior: smooth; color-scheme: light; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }

  /* ---------- sfondo ambient ----------
     Salvia: carta tinta unita, niente blob — la regola resta (unico posto in
     cui .blob è definito) ma spenta, così il markup .ambient non cambia. */
  .ambient { position: fixed; inset: 0; z-index: -1; overflow: hidden; display: none; }
  .blob {
    position: absolute; width: 65vmax; height: 65vmax; border-radius: 50%;
    filter: blur(90px); opacity: .32; display: none;
    /* Nessuna transizione sul colore: interpolare il background per 1.2s
       obbligava il browser a ricalcolare un blur(90px) su 65vmax × 2 per ~70
       fotogrammi, proprio mentre la card vola via — il cambio canale scattava
       lì. Il colore ora cambia in un solo passaggio (un rasterize, non 70).
       La gradualità resta dove non costa niente: h1 e .btn conservano la loro
       transition su background (VISUAL_SPECS §1.4). */
  }
  .blob.b1 { background: var(--muschio); top: -25vmax; left: -15vmax; animation: drift1 26s ease-in-out infinite alternate; }
  .blob.b2 { background: var(--muschio); bottom: -30vmax; right: -18vmax; animation: drift2 32s ease-in-out infinite alternate; }
  @keyframes drift1 { to { transform: translate(9vmax, 7vmax) scale(1.12); } }
  @keyframes drift2 { to { transform: translate(-8vmax, -6vmax) scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .blob { animation: none; } }

  main { max-width: 560px; margin: 0 auto; padding: max(2rem, env(safe-area-inset-top)) 1.2rem 4rem; }

  /* ---------- header (Salvia: colonna 560px, inchiostro pieno, lede secondaria) ---------- */
  header.hero { text-align: left; margin: 1.2rem 0 0; }
  .hero .route {
    font-size: .72rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: .7rem; color: var(--dim);
  }
  .hero .route .stamp {
    color: var(--muschio); border: 2px solid var(--muschio); border-radius: 8px;
    padding: .05rem .45rem; transform: rotate(3deg);
  }
  .hero h1 {
    font-size: clamp(2rem, 7vw, 2.6rem); font-weight: 800; letter-spacing: -.01em;
    line-height: 1.05; color: var(--text);
  }
  .hero p { color: var(--dim); max-width: 30rem; margin: .5rem auto 0; font-size: .93rem; line-height: 1.6; }
  .hero p strong { color: var(--text); font-weight: 600; }

  /* ---------- deck (Salvia: Biglietto Swipe — carta crema, bordo inchiostro 1.5px, ombra offset) ---------- */
  .deck-wrap { display: grid; justify-items: center; gap: 1.1rem; }
  .deck {
    position: relative;
    width: min(320px, 86vw);
    height: calc(min(320px, 86vw) * 2.02); /* telefono (~1.47) + info (~0.45) */
    touch-action: pan-y;
    margin-top: 1.4rem;
  }
  .card {
    position: absolute; inset: 0;
    border-radius: 22px;
    /* fondo OPACO: le card dietro nella pila non devono trasparire */
    background: var(--card);
    border: 1.5px solid var(--card-border);
    box-shadow: 4px 4px 0 var(--card-border);
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

  /* ---------- mockup iPhone ----------
     Salvia: il mockup resta il phone reale (wall veri, orologio live) ma la
     cornice scura diventa inchiostro Salvia — stesso componente canonico. */
  .phone {
    position: relative; width: 66%; aspect-ratio: 6 / 13;
    border-radius: 13% / 6%;
    background: #000; border: 3px solid var(--card-border);
    overflow: hidden; flex-shrink: 0;
    box-shadow: 4px 4px 0 rgba(43,48,40,.3), inset 0 0 0 2px #000;
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

  /* ---------- info canale (Salvia: meta riga nome + "giorno N di 7", secondari soft) ---------- */
  .cinfo { width: 100%; text-align: center; margin-top: .85rem; display: grid; gap: .3rem; }
  .cinfo h2 { font-size: .9rem; font-weight: 800; letter-spacing: -.01em; }
  .cinfo .tag { color: var(--dim); font-size: .84rem; line-height: 1.4; }
  .cinfo .scene { font-size: .75rem; color: var(--dim); font-weight: 500; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .cinfo .scene b { color: var(--text); font-weight: 600; font-style: normal; }
  .cinfo .stale { font-size: .8rem; color: var(--dim); line-height: 1.45; }
  .cinfo .eredita { font-size: .8rem; color: var(--soft); line-height: 1.45; }
  .cinfo .eredita a { color: var(--muschio); text-decoration: underline; }

  /* ---------- controlli deck (Salvia: tondi inchiostro/carta, dots salvia) ---------- */
  .controls { display: flex; align-items: center; gap: 1rem; }
  .ctrl {
    width: 3.5rem; height: 3.5rem; border-radius: 50%;
    border: 1.5px solid var(--card-border); background: var(--card);
    color: var(--text); font-size: 1.3rem;
    cursor: pointer; transition: transform .15s ease, background .2s ease;
    display: grid; place-items: center;
  }
  .ctrl:hover { transform: scale(1.09); }
  .ctrl:active { transform: scale(.94); }
  .ctrl#next { background: var(--muschio); color: #F6F8F1; border-color: var(--muschio); }
  .dots { display: flex; gap: .4rem; }
  .dot { width: 8px; height: 8px; border-radius: 99px; background: var(--dots); transition: all .3s ease; }
  .dot.on { width: 26px; background: var(--text); }
  .pick { text-align: center; font-size: .82rem; font-weight: 700; }
  .pick b { color: var(--muschio); }
  .hint { color: var(--dim); font-size: .78rem; opacity: .8; }
  .hint a { color: var(--muschio); text-decoration: underline; }

  /* ---------- azioni canale (Salvia: CTA rettangolari inchiostro/carta, ombra offset) ---------- */
  .actions { display: grid; gap: .6rem; justify-items: stretch; }
  .btn {
    border-radius: 12px; padding: .9rem;
    font-size: .93rem; font-weight: 800; cursor: pointer; text-align: center;
    min-height: 48px; /* §5.5: tap target mobile */
    transition: transform .15s ease, filter .2s ease;
  }
  .btn:active { transform: scale(.96); }
  .btn.primary { background: var(--text); color: var(--card); border: 1.5px solid var(--text); box-shadow: 3px 3px 0 rgba(43,48,40,.3); }
  .btn.primary:hover { filter: brightness(1.12); }
  .btn.ghost { background: transparent; border: 1.5px solid var(--text); color: var(--text); }
  /* min-height:44px centra il testo nei <button>, ma le pill <a class="btn ...">
     (#archlink, #dayopen, #daysave, ecc.) restano inline e lasciano il testo
     ancorato in alto: ~2px di sfasamento verticale fra pill adiacenti. Il
     :not([hidden]) è OBBLIGATORIO: le regole dell'autore battono lo style
     dell'user agent [hidden]{display:none} a prescindere dalla specificità
     (origine prima di specificità in cascata), quindi una .btn{display:...}
     senza questa guardia renderebbe visibili anche i comandi del viaggio
     che devono restare nascosti finché il JS non toglie l'attributo. */
  .btn:not([hidden]) { display: inline-flex; align-items: center; justify-content: center; }

  /* ---------- galleria/viaggio: sfogliata dentro l'anteprima ---------- */
  section.journey { margin-top: 1.6rem; text-align: center; }
  .journey .jhead { display: flex; align-items: center; justify-content: center; gap: .8rem; margin-bottom: .8rem; }
  .journey h3 { font-size: .82rem; font-weight: 650; color: var(--dim); text-transform: uppercase; letter-spacing: .12em; }
  .playbtn {
    border: 1px solid var(--card-border); background: var(--card); color: var(--text);
    border-radius: 999px; padding: .4rem .9rem; font-size: .78rem; font-weight: 650;
    cursor: pointer; transition: all .2s ease;
  }
  .playbtn:hover { background: rgba(43,48,40,.08); }
  .playbtn.playing { background: var(--muschio); border-color: var(--muschio); color: #F6F8F1; }
  /* Le file di comandi del viaggio riusano .actions (la fila canonica sotto
     il deck): prima erano pill inline figlie dirette della sezione — nessun
     gap, andate a capo incontrollate, si toccavano (VISUAL_SPECS §5.4/§5.5).
     Qui serve solo lo stacco verticale FRA una fila e l'altra: .8rem è la
     stessa misura già usata da .jhead, .dcap e .arcstory, nessuna misura nuova. */
  .journey .actions { margin-top: .8rem; }
  /* Una fila con tutti i comandi hidden (prima che il JS giri, o quando
     l'archivio non è sfogliabile) non deve occupare spazio: senza questa
     regola resterebbe un flex container vuoto con margin-top:.8rem, ~2.4rem
     di vuoto morto sommando le quattro file. :has() è supportato dai browser
     evergreen; dove non lo è il degrado è solo estetico (spazio in più),
     nessuna funzione persa. */
  .journey .actions:not(:has(> :not([hidden]))) { display: none; }
  /* Niente più striscia di miniature (era ridondante: il mockup già scorre
     l'archivio col timelapse). Al suo posto, solo i comandi per sfogliare
     l'anteprima giorno per giorno e capire a che punto del viaggio si è. */
  .daynav { display: flex; align-items: center; justify-content: center; gap: .9rem; }
  .dayctrl {
    width: 2.3rem; height: 2.3rem; border-radius: 50%;
    border: 1px solid var(--card-border); background: var(--card);
    color: var(--text); font-size: 1.05rem;
    cursor: pointer; transition: transform .15s ease, background .2s ease;
    display: grid; place-items: center;
  }
  .dayctrl:hover { transform: scale(1.09); background: rgba(43,48,40,.08); }
  .dayctrl:active { transform: scale(.94); }
  .dayctrl:disabled { opacity: .35; cursor: default; transform: none; }
  .dayinfo { min-width: 8rem; display: grid; gap: .1rem; }
  .dayinfo .ddate { font-size: .92rem; font-weight: 650; text-transform: capitalize; }
  .dayinfo .dpos { font-size: .74rem; color: var(--dim); }
  .daypick {
    min-height: 2.3rem; padding: 0 .6rem; border-radius: 999px;
    border: 1px solid var(--dim); background: var(--bg); color: var(--text);
    font: inherit; color-scheme: light;
  }
  .dcap { color: var(--dim); font-size: .78rem; line-height: 1.5; margin: .8rem auto 0; max-width: 26rem; }
  .dcap strong { color: var(--text); font-weight: 650; }
  /* feat-leggi-la-storia-dell-arco: elenco delle tappe dell'arco visualizzato,
     nascosto finché non lo si apre da #storytoggle. Nessun colore nuovo: --dim
     per il testo secondario, il testo pieno per la tappa corrente — stessa
     coppia già usata da .stale per la nota di freschezza. */
  .arcstory { margin: .8rem auto 0; max-width: 26rem; text-align: left; display: grid; gap: .2rem; }
  /* .daynav è flex e .arcstory è grid per l'autore: come per .btn qui sopra,
     le regole dell'autore battono lo style dell'user agent [hidden]{display:none}
     a prescindere dalla specificità (origine prima di specificità in cascata).
     Senza questa regola esplicita #daynav resta visibile a HTML anche con
     l'attributo hidden (frecce del giorno orfane quando l'archivio non è
     sfogliabile) e i tre pannelli #arcstory/#arclist/#favlist restano sempre
     aperti una volta popolati — i toggle non chiudono nulla visivamente.
     Difetto verificato su screenshot reali, sia in anteprima che in produzione. */
  .daynav[hidden], .arcstory[hidden] { display: none; }
  .arcrow {
    display: block; width: 100%; min-height: 44px; padding: .5rem .2rem;
    border: 0; border-top: 1px solid var(--card-border); background: none;
    color: var(--dim); font: inherit; text-align: left; cursor: pointer;
  }
  .arcrow:first-child { border-top: 0; }
  .arcrow .arcdate { display: block; font-size: .74rem; font-weight: 650; text-transform: capitalize; }
  .arcrow .arctext { display: block; font-size: .8rem; line-height: 1.4; }
  .arcrow.on { color: var(--text); }
  /* feat-i-preferiti-si-riconoscono-a-colpo-d-occhio: solo le righe con
     miniatura passano a riga orizzontale — le altre .arcrow (tappe, archi)
     restano invariate. .arctxt tiene arcdate/arctext impilati come oggi. */
  .arcrow:has(.favmini) { display: flex; align-items: center; gap: .6rem; }
  .arcrow .favmini {
    width: 30px; height: 64px; object-fit: cover; border-radius: 10px;
    border: 1px solid var(--guida); flex: none;
  }
  .arcrow .arctxt { display: block; min-width: 0; }

  /* ---------- ripiego senza JavaScript (invisibile col JS attivo) ---------- */
  .ns { margin-top: 1.6rem; text-align: center; color: var(--text); }
  .ns h2 { font-size: 1.15rem; font-weight: 700; }
  .ns > p { color: var(--dim); font-size: .85rem; margin-top: .4rem; }
  .ns-list { list-style: none; margin: 1.2rem auto 0; padding: 0; display: grid; gap: 1rem; max-width: 22rem; }
  .ns-item { border: 1px solid var(--card-border); border-radius: var(--radius); background: var(--card); padding: 1rem; }
  .ns-item strong { display: block; margin-bottom: .6rem; }
  .ns-item img { max-width: 100%; border-radius: 12px; display: block; margin: 0 auto .6rem; }
  .ns-item a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 .6rem; color: var(--text); }

  /* ---------- setup (Salvia: card guida carta, passi numerati inchiostro, connettore guida) ---------- */
  section.setup {
    margin-top: 1.6rem; background: var(--card); border: 1.5px solid var(--card-border);
    border-radius: 18px; box-shadow: 4px 4px 0 rgba(43,48,40,.3); padding: 1.3rem;
  }
  .setup h2 { font-size: 1.2rem; font-weight: 800; }
  .setup .sub { color: var(--dim); margin-bottom: .8rem; font-size: .85rem; }
  .steps { list-style: none; }
  .step { position: relative; padding: 0 0 1rem 2.6rem; font-size: .87rem; color: var(--soft); }
  .step:not(:last-child)::after {
    content: ""; position: absolute; left: .82rem;
    top: 1.9rem; bottom: .1rem; width: 2px; background: var(--guida);
  }
  .step .n {
    position: absolute; left: 0; top: 0;
    width: 1.7rem; height: 1.7rem; border-radius: 50%; display: grid; place-items: center;
    background: var(--text); color: var(--bg);
    font-weight: 800; font-size: .8rem;
  }
  .step h4 { font-size: .93rem; margin-bottom: .15rem; color: var(--text); display: block; }
  .step p { color: var(--soft); font-size: .87rem; line-height: 1.55; }
  .step p strong { color: var(--text); }
  .step p code { background: var(--guida); border-radius: 6px; padding: .1rem .4rem; font-size: .78rem; word-break: break-all; }
  .note { margin-top: .4rem; font-size: .8rem; border-top: 1px dashed var(--guida); padding-top: .8rem; color: var(--soft); line-height: 1.6; }
  .note a { color: var(--muschio); font-weight: 700; }

  /* ---------- home minimale (2026-09-03, richiesta utente) ----------
     La home mostra solo: anteprima (deck + mockup), nome canale, i due
     comandi "Scarica la Shortcut"/"Come si attiva" e la guida #setup.
     Tutto il resto del testo è nascosto via CSS, NON rimosso dal DOM: i
     test home-*.test.js asseriscono la presenza del markup (journey,
     noscript, hint, footer) e restano verdi; cambia solo ciò che si vede.
     La card centra il contenuto in verticale: senza tag/scene in .cinfo
     resterebbe un vuoto in basso. */
  /* Titolo + spiegazione sopra l'anteprima: richiesti dall'utente (2026-09-03),
     restano visibili. */  .card { justify-content: center; }
  .cinfo .tag, .cinfo .scene, .cinfo .stale, .cinfo .eredita { display: none; }
  .hint { display: none; }
  /* Stato offline: non è contenuto ma un segnale d'errore, resta visibile. */
  #netstate:not([hidden]) { display: block; }
  section.journey { display: none; }
  #copyurl, #feedlink { display: none; }
  footer { display: none; }

  footer { margin-top: 3.2rem; text-align: center; color: var(--dim); font-size: .78rem; }
  footer a { color: var(--muschio); text-decoration: none; }

  /* toast copia (Salvia: inchiostro pieno, testo carta) */
  #toast {
    position: fixed; left: 50%; bottom: max(1.4rem, env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(20px);
    background: var(--text); border: 1.5px solid var(--text); color: var(--card);
    padding: .7rem 1.2rem; border-radius: 999px; font-size: .85rem; opacity: 0;
    transition: all .3s ease; pointer-events: none; z-index: 50;
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
    <div class="route"><span>Sera · Tramonto · iPhone</span><span class="stamp">Gratis</span></div>
    <h1>ArtiPop, il tramonto quotidiano</h1>
    <p>Un wallpaper nuovo ogni sera al tramonto, generato dall'AI quella notte.
    Ogni canale è <strong>un viaggio che evolve giorno dopo giorno</strong>.
    Gratis, senza app: solo una Shortcut. <strong>Trascina le card</strong> per sfogliare i canali.</p>
  </header>

  <div class="deck-wrap">
    <div class="deck" id="deck" aria-label="Canali — trascina per sfogliare"></div>

    <div class="controls">
      <button class="ctrl" id="prev" aria-label="Scarta">👎</button>
      <div class="dots" id="dots"></div>
      <button class="ctrl" id="next" aria-label="Mio">👍</button>
    </div>
    <p class="pick">Canale scelto: <b id="pick"></b></p>
    <p class="hint">👈 trascina una card di lato · oppure tocca i pulsanti</p>

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
    <p class="hint" id="netstate" hidden>Sei senza rete: questa è l'ultima copia salvata. L'archivio torna sfogliabile quando la rete ritorna.</p>
    <p class="hint"><a id="icslink" href="/promemoria.ics?c=${esc(feedChannelId)}">aggiungi il promemoria al calendario</a></p>

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
      <!-- fila 1 — archivio del canale: prima queste pill erano figlie dirette
           di .journey (nessun gap, andavano a capo incontrollate e si
           toccavano, VISUAL_SPECS §5.4/§5.5) — .actions è il contenitore
           canonico già in uso sotto il deck, qui riusato senza CSS nuovo. -->
      <div class="actions">
        <!-- Il viaggio qui sopra mostra solo l'arco/settimana in corso (vedi
             didascalia sopra); l'archivio permanente del canale — tutti i
             giorni, mese per mese — vive su /archivi/<id> dal ciclo 130.
             #archlink ci porta con un tocco e segue lo stesso ciclo di vita
             di #feedlink: stesso canale in cima alla pila, stesso aggiornamento. -->
        <a class="btn ghost" id="archlink" href="/archivi/${esc(feedChannelId)}">tutti i giorni di questo canale</a>
      </div>
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
      <!-- fila 2 — navigazione nel viaggio: salto a una data e cambio d'arco. -->
      <div class="actions">
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
      </div>
      <!-- fila 3 — comandi del giorno mostrato. -->
      <div class="actions">
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
        <!-- feat-condividi-l-immagine-del-giorno: stesso hasJourney di #daysave,
             IN AND con PUO_CONDIVIDERE_FILE (v. supportaCondivisioneFile) —
             progressive enhancement: nascosto dove il browser non offre la
             condivisione di file (compreso il Chromium headless di
             visual-check), nessun comportamento diverso dal ripiego #dayshare
             in quel caso. -->
        <button class="btn ghost" id="dayshareimg" hidden>condividi l'immagine</button>
        <!-- feat-segna-i-giorni-che-ti-piacciono: stesso hasJourney di
             #dayshare/#dayopen — nessun giorno da sfogliare, nessun giorno da
             segnare. Etichetta e aria-pressed seguono lo stato del giorno
             mostrato (v. renderJourney/updateDayNav). -->
        <button class="btn ghost" id="dayfav" aria-pressed="false" hidden>☆ segna preferito</button>
        <!-- feat-riscopri-un-giorno-a-caso: stesso hasJourney degli altri
             comandi, IN AND con l'archivio noto (arcsCache, fallback
             archiveCache) che ha almeno 2 date — con una sola data nota non
             c'è nessun altro giorno da riscoprire (v. renderJourney). -->
        <button class="btn ghost" id="dayrand" hidden>🎲 un giorno a caso</button>
        <!-- feat-torna-a-oggi-da-qualunque-giorno: nessun percorso di ritorno
             diretto esisteva prima di questo ciclo — stepDay muove di un
             giorno, goToNextArc di un arco: chi è sceso di più passi doveva
             martellare le frecce. Nascosto quando si guarda già oggi
             nell'arco in corso (v. updateDayNav). -->
        <button class="btn ghost" id="daytoday" hidden>torna a oggi</button>
      </div>
      <p class="dcap" id="dcap" hidden></p>
      <!-- fila 4 — pannelli: i tre comandi che aprono un elenco. I tre
           .arcstory sotto non sono più adiacenti al proprio toggle nel DOM
           (deviazione dichiarata in VISUAL_SPECS §1.4): dentro .actions,
           flex-wrap, un pannello .arcstory con max-width:26rem finirebbe
           accanto a una pill invece che su una riga propria. Impilati subito
           sotto la fila, nello stesso ordine dei comandi, l'esito visivo resta
           identico a oggi — un pannello aperto compare sotto la fila che lo
           comanda. -->
      <div class="actions">
        <!-- feat-leggi-la-storia-dell-arco: chiuso di default (la home non deve
             allungarsi per chi non lo apre); comando e blocco compaiono solo
             quando renderArcStory trova almeno una tappa con testoTappa. -->
        <button class="btn ghost" id="storytoggle" hidden>leggi la storia</button>
        <!-- feat-scegli-l-arco-dall-elenco: unico modo, oggi, di raggiungere un
             arco lontano nell'archivio era martellare #arcprev un arco alla
             volta. Visibile solo con più di un arco (updateArcNav) — con un
             solo arco il salto non ha senso. Riusa .arcstory/.arcrow (stessa
             forma dell'elenco-tappe, VISUAL_SPECS §1.4): il componente cambia
             contenuto, non forma. -->
        <button class="btn ghost" id="arcpick" hidden>scegli l'arco</button>
        <!-- feat-segna-i-giorni-che-ti-piacciono: visibile solo quando il
             canale mostrato ha almeno un preferito (v. renderFavList). Riusa
             .arcstory/.arcrow, stessa forma di elenco-tappe ed elenco-archi:
             cambia il contenuto, non la forma. Chiuso di default come #arcpick. -->
        <button class="btn ghost" id="favpick" hidden>i tuoi preferiti</button>
      </div>
      <div class="arcstory" id="arcstory" hidden></div>
      <div class="arcstory" id="arclist" hidden></div>
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
const dayShareImgEl = document.getElementById("dayshareimg");
const dayFavEl = document.getElementById("dayfav");
const dayRandEl = document.getElementById("dayrand");
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

/* ---------- import dei preferiti da link (?fav=<date>) ----------
   feat-porta-i-tuoi-preferiti-su-un-altro-telefono: applicato una sola
   volta all'avvio, sul canale portato in cima da uno dei due blocchi sopra
   (order[0]) — PRIMA del primo renderFavList, che legge già i preferiti
   salvati. Stesso principio difensivo del resto del modulo: un import
   fallito non deve mai rompere la home. */
try {
  const favParam = sharedParams.get("fav");
  if (favParam) importaPreferiti(CHANNELS[order[0]].id, favParam);
} catch {
  /* import fallito: la home resta usabile, i preferiti restano quelli già salvati */
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
// feat-i-preferiti-degli-altri-canali-non-si-perdono: voci degli ALTRI
// canali (mai chId) che hanno almeno una data preferita valida, nell'ordine
// in cui leggiPreferiti() le trova — non un ordinamento nuovo, solo un
// filtro. Le date di ogni voce sono ordinate dal più recente al più vecchio
// come preferitiDi. Stesso filtro dataValida di importaPreferiti: uno
// storage scritto da una versione futura non deve produrre righe assurde.
function preferitiAltrove(chId) {
  const tutti = leggiPreferiti();
  const risultato = [];
  for (const id in tutti) {
    if (id === chId) continue;
    const date = (Array.isArray(tutti[id]) ? tutti[id] : []).filter(dataValida);
    if (date.length === 0) continue;
    date.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    risultato.push({ id, giorni: date });
  }
  return risultato;
}
function togglePreferito(chId, date) {
  const tutti = leggiPreferiti();
  const attuali = Array.isArray(tutti[chId]) ? tutti[chId] : [];
  tutti[chId] = attuali.includes(date)
    ? attuali.filter((d) => d !== date)
    : [...attuali, date];
  scriviPreferiti(tutti);
}

// feat-i-preferiti-si-rivedono-anche-senza-rete: chiede al service worker
// di conservare in cache il giorno appena segnato preferito, nella stessa
// forma "?date=" con cui il pannello preferiti lo riapre (v. addrGiorno).
// Nessuna richiesta di rete qui in pagina: la conservazione vera avviene
// dentro il service worker (backend/src/sw.js, ascoltatore "message"), così
// la guardia anti-ciclo-77 sull'unica occorrenza della chiamata di rete
// nella pagina resta verde.
// Senza service worker attivo (browser vecchio, SW non registrato) questa
// funzione non fa nulla: la home resta identica a oggi.
function conservaOffline(chId, date) {
  try {
    const url = "/w/" + chId + "?date=" + date;
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ tipo: "conserva", url });
    }
  } catch {
    /* SW assente o postMessage non disponibile: nessun problema, si resta al comportamento di oggi */
  }
}

// Link di trasferimento: le date preferite di un canale, in un solo
// parametro leggibile da importaPreferiti su un altro dispositivo. Nessun
// link per un canale senza preferiti — non c'è nulla da trasferire.
function linkPreferiti(chId) {
  const date = preferitiDi(chId);
  if (date.length === 0) return "";
  return ORIGIN + "/?c=" + chId + "&fav=" + date.join(",");
}
// Vero solo per date in formato YYYY-MM-DD che esistono davvero nel
// calendario — un controllo di solo formato lascerebbe passare assurdità
// come "2026-13-99", che è comunque quattro-due-due cifre.
function dataValida(s) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
// Importa in preferitiDi(chId) le date valide contenute nel parametro fav
// (stringa separata da virgole): unione con quanto già salvato, mai
// sostituzione — un secondo import della stessa URL non deve né duplicare
// né perdere i preferiti presenti. Ritorna quante date sono state aggiunte
// davvero; con niente da aggiungere non tocca lo storage.
function importaPreferiti(chId, grezzo) {
  if (!grezzo) return 0;
  const candidate = [...new Set(grezzo.split(",").map((s) => s.trim()).filter(dataValida))];
  if (candidate.length === 0) return 0;
  const tutti = leggiPreferiti();
  const attuali = Array.isArray(tutti[chId]) ? tutti[chId] : [];
  const nuove = candidate.filter((d) => !attuali.includes(d));
  if (nuove.length === 0) return 0;
  tutti[chId] = [...attuali, ...nuove];
  scriviPreferiti(tutti);
  return nuove.length;
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

/* feat-condividi-l-immagine-del-giorno: vera solo se il browser dichiara di
   saper condividere file veri (non solo link) — Safari/Chrome mobile sì,
   Chromium headless (visual-check) e i browser desktop più vecchi no. In
   try/catch: un browser che lancia su new File(...) o su canShare non
   deve rompere il resto della pagina (principio 3). Valutata una sola volta
   all'avvio: il supporto non cambia durante la sessione. */
function supportaCondivisioneFile() {
  try {
    if (!navigator.share || !navigator.canShare) return false;
    const finto = new File(["x"], "prova.jpg", { type: "image/jpeg" });
    return navigator.canShare({ files: [finto] });
  } catch {
    return false;
  }
}
const PUO_CONDIVIDERE_FILE = supportaCondivisioneFile();

/* Ricava il blob JPEG dell'immagine già a schermo nella card in cima,
   ridisegnandola su un canvas invece di riscaricarla — la guardia
   anti-ciclo-77 (backend/tests/unit/home-preferiti-senza-rete.test.js e
   affini) ammette una sola chiamata di rete in tutta la pagina, già
   occupata dall'archivio; il file da condividere è quindi la stessa
   immagine che previewDay ha già assegnato a top.src = srcFor(...), senza
   una seconda richiesta di rete (più veloce, e nessuna rottura della
   guardia). Stesso dominio del worker: nessun problema di canvas taintato. */
function catturaFrameCorrente(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob nullo"))),
      "image/jpeg",
      0.92
    );
  });
}

/* Passa il file vero del giorno mostrato al foglio di condivisione di
   sistema, invece del solo link (v. shareLink) — il caso d'uso è mandare il
   wallpaper in chat senza doverlo prima salvare e riallegare a mano.
   Ripiego su shareLink() per qualunque fallimento diverso dall'annullamento
   dell'utente, così l'utente ottiene comunque qualcosa (principio 3). */
async function condividiImmagine() {
  if (dayShareImgEl.disabled) return; // doppio tocco: l'operazione è già in corso
  dayShareImgEl.disabled = true;
  try {
    const chId = CHANNELS[order[0]].id;
    const date = previewDate ?? TODAY;
    const img = deckEl.querySelector(".card.top .wall");
    if (!img || !img.complete || !img.naturalWidth) throw new Error("immagine non pronta");
    const blob = await catturaFrameCorrente(img);
    const file = new File([blob], \`ArtiPop-\${chId}-\${date}.jpg\`, { type: "image/jpeg" });
    await navigator.share({ files: [file], title: "ArtiPop", text: "Il wallpaper di oggi" });
  } catch (err) {
    if (err && err.name === "AbortError") return; // annullato dall'utente: nessun toast, nessun ripiego
    await shareLink();
  } finally {
    dayShareImgEl.disabled = false;
  }
}
dayShareImgEl.addEventListener("click", condividiImmagine);

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
// feat-la-home-dice-da-dove-viene-questo-canale: elenco leggibile con "e"
// finale, riusato per gli id ereditati nella riga .eredita della card.
function elencoIt(ids) {
  return ids.length < 2 ? ids.join("") : ids.slice(0, -1).join(", ") + " e " + ids[ids.length - 1];
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
      \${ch.eredita.length > 0 ? '<p class="eredita">Raccoglie l\\'eredità di ' + elencoIt(ch.eredita) + ' — <a href="/archivi">sfoglia i loro archivi</a></p>' : ""}
    </div>\`;
}

function buildDeck() {
  deckEl.innerHTML = "";
  // Renderizza dal fondo alla cima così la card in cima resta ultima nel DOM.
  for (let i = order.length - 1; i >= 0; i--) {
    const ch = CHANNELS[order[i]];
    const el = document.createElement("article");
    // "animated" fin dalla nascita (ma il primo paint non transiziona,
    // perché la classe è già presente all'appendChild): da qui in poi
    // rotateDeck può ruotare il mazzo SENZA ricostruirlo, e le card dietro
    // devono scivolare verso la nuova posizione invece di saltarci — v.
    // rotateDeck per il perché la ricostruzione andava evitata.
    el.className = "card animated " + (i === 0 ? "top" : "behind");
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

/* La card che lascia la cima può essere ferma su un giorno d'archivio
   (previewDay le ha riscritto src e alt). Finché la rotazione ricostruiva il
   deck da zero, buildDeck riportava ogni card a oggi da sé (cardHTML parte
   sempre da ch.date); ora i nodi sopravvivono nel DOM (v. rotateDeck) e va
   fatto a mano — in USCITA dalla cima, non al rientro: le card dietro sono
   comunque visibili nella pila, e mostrerebbero il fotogramma di una
   vecchia esplorazione se non si riportassero subito a oggi. Stessa URL e
   stesso alt di cardHTML(): stringa identica quando già a oggi, quindi
   nessuna richiesta di rete e nessuna decodifica in più in quel caso. */
function ripristinaOggi(card) {
  const ch = CHANNELS.find((c) => c.id === card.dataset.channel);
  const wall = card.querySelector(".wall");
  if (!ch || !wall) return;
  // NON srcFor(): per un canale inRitardo produrrebbe "?v=TODAY" invece di
  // "?v=<ch.date>" — l'URL che cardHTML ha davvero assegnato, e un download
  // in più per un file che il worker già serve sotto un altro indirizzo.
  const src = "/w/" + ch.id + "?v=" + ch.date;
  if (wall.getAttribute("src") !== src) {
    wall.src = src;
    wall.alt = descrizioneWallpaper(ch, ch.date, !ch.inRitardo);
  }
  wall.style.opacity = "";
}

/* Aggiorna colori ambient, dots, hint e galleria per il canale in cima. */
function updateChrome() {
  const ch = CHANNELS[order[0]];
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
  // "tutti i giorni di questo canale" punta all'archivio permanente del
  // canale in cima: stesso ciclo di vita di #feedlink, sempre in sync.
  const archlinkEl = document.getElementById("archlink");
  if (archlinkEl) archlinkEl.href = "/archivi/" + encodeURIComponent(ch.id);
  // Il promemoria da calendario segue lo stesso canale in cima al mazzo.
  const icslinkEl = document.getElementById("icslink");
  if (icslinkEl) icslinkEl.href = "/promemoria.ics?c=" + encodeURIComponent(ch.id);
  dotsEl.innerHTML = CHANNELS.map((c) =>
    \`<span class="dot\${c.id === ch.id ? " on" : ""}"></span>\`).join("");
  /* Biglietto Swipe: "Canale scelto" sotto i dots, stesso canale in cima. */
  const pickEl = document.getElementById("pick");
  if (pickEl) pickEl.textContent = ch.emoji + " " + ch.name;
  previewDate = null;
  loadArchive(ch.id);
  ricordaCanale(ch.id); // memorizza il canale in cima: alla prossima visita si riapre da qui
  aggiornaTitolo();
}

/* ---------- drag stile Tinder ---------- */
let drag = null;
// I listener si agganciano UNA VOLTA SOLA a ogni card, alla costruzione del
// mazzo (buildDeck, mai da rotateDeck). Finché la rotazione ricostruiva il
// DOM da zero i nodi erano sempre nuovi, e riagganciare ad ogni giro era
// corretto; ora i nodi sopravvivono (v. rotateDeck), e riagganciare
// significherebbe accumulare un listener in più per ogni sfogliata — dopo
// dieci swipe la stessa card reagirebbe dieci volte a un solo tocco. La
// guardia dataset.drag impedisce il doppio aggancio sullo stesso nodo; le
// card dietro non ricevono comunque eventi (.card.behind { pointer-events:
// none }), ma dentro pointerdown si ricontrolla anche "top" — seconda rete
// per il caso in cui una card cambi ruolo mentre il dito è ancora giù.
function attachDrag() {
  const top = deckEl.querySelector(".card.top");
  if (!top) return; // mazzo vuoto: niente da agganciare
  for (const card of deckEl.children) agganciaDrag(card);
}

function agganciaDrag(el) {
  if (el.dataset.drag) return; // già agganciata: mai due volte sullo stesso nodo
  el.dataset.drag = "1";
  el.addEventListener("pointerdown", (e) => {
    if (!el.classList.contains("top")) return;
    if (el.dataset.involo) return; // già in volo verso rotateDeck (v. flyOut): ignora un secondo tocco sulla stessa card
    if (e.target.closest("button, a")) return;
    drag = { el, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, pointerId: e.pointerId };
    el.classList.remove("animated");
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || drag.el !== el) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    drag.el.style.transform =
      \`translate(\${drag.dx}px, \${drag.dy * 0.25}px) rotate(\${drag.dx * 0.055}deg)\`;
  });
  const end = () => {
    if (!drag || drag.el !== el) return;
    const { el: card, dx } = drag;
    drag = null;
    const threshold = Math.min(120, deckEl.offsetWidth * 0.34);
    card.classList.add("animated");
    if (Math.abs(dx) > threshold) flyOut(card, Math.sign(dx));
    else card.style.transform = ""; // depth 0 = trasformazione identità
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* La card vola fuori, poi torna in fondo al mazzo. */
function flyOut(el, dir) {
  // Idempotente per card: la classe "top" resta finché rotateDeck non gira
  // (280ms), quindi un secondo advance/swipe ravvicinato sulla STESSA card
  // (doppio click su #next, doppia freccia, auto-repeat di ArrowRight, un
  // secondo tocco che ruba la pointer capture) chiamerebbe flyOut due volte:
  // due rotateDeck in coda avanzano order[] di due posti ma il DOM di uno
  // solo (il prepend del secondo giro è un no-op), disallineando
  // permanentemente order[0] dalla card visibile in cima. La guardia
  // dataset.involo rende il secondo flyOut un no-op finché rotateDeck non
  // lo ripulisce.
  if (el.dataset.involo) return;
  el.dataset.involo = "1";
  el.style.transform = \`translate(\${dir * (deckEl.offsetWidth + 220)}px, -30px) rotate(\${dir * 22}deg)\`;
  el.style.opacity = 0;
  setTimeout(() => rotateDeck(el), 280);
}

/* Ruota il mazzo RIORDINANDO i nodi già in pagina, mai ricostruendoli. Prima
   qui si chiamava buildDeck(), che azzerava deckEl.innerHTML: ogni
   <img class="wall"> (PNG 960×2048) tornava nel DOM da zero e veniva
   ridecodificata mentre l'animazione di volo era ancora in corso e veniva
   troncata a metà — la causa principale per cui il cambio canale scattava.
   Riordinando, le immagini non vengono mai ricreate: le card che restano
   scivolano nella nuova posizione (classe .animated, transizione di sola
   transform — lavoro del compositore, non del thread principale). */
function rotateDeck(el) {
  delete el.dataset.involo; // la card può tornare a ricevere un nuovo volo (v. guardia in flyOut)
  if (drag && drag.el === el) {
    // Un secondo tocco aveva preso la pointer capture sulla card ancora in
    // volo (bypassando .card.behind { pointer-events: none }): rilasciarla
    // e annullare il drag PRIMA di spostare la card in fondo alla pila,
    // altrimenti il dito continuerebbe a trascinare la card di fondo sopra
    // il mazzo.
    try { el.releasePointerCapture(drag.pointerId); } catch {}
    drag = null;
  }
  order.push(order.shift());
  stopPlayback();            // il timelapse del canale che se ne va non deve proseguire sulla nuova cima
  pendingPreviewSrc = null;  // scarta un'immagine d'archivio in arrivo per la card che lascia la cima
  el.classList.remove("animated"); // il rientro in fondo alla pila è un salto, non un volo di ritorno
  ripristinaOggi(el);
  deckEl.prepend(el);        // il fondo della pila è il PRIMO figlio (v. buildDeck, che renderizza dal fondo)
  const cards = [...deckEl.children]; // dal fondo alla cima, stesso ordine di buildDeck
  cards.forEach((card, i) => {
    const depth = cards.length - 1 - i;
    card.classList.toggle("top", depth === 0);
    card.classList.toggle("behind", depth !== 0);
    applyStackTransform(card, depth);
  });
  void el.offsetWidth;          // reflow: fissa la posizione di partenza della card rientrata...
  el.classList.add("animated"); // ...così al giro dopo scivolerà come le altre invece di saltare
  autoplayDaRotazione = true;   // v. startPlayback: il timelapse riparte con un attimo di respiro
  updateChrome();
  tickClock();
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

// feat-la-home-dice-quando-sei-senza-rete: chi apre l'app installata senza
// rete vede la copia in cache (feat-l-app-installata-si-apre-anche-senza-rete)
// ma /api/* resta esclusa dalla cache, quindi l'archivio non si sfoglia e i
// comandi restano muti senza spiegazione. Nessun fetch di sondaggio: solo
// l'evento del browser (navigator.onLine può mancare — allora la riga resta
// nascosta, comportamento identico a oggi).
function aggiornaStatoRete() {
  const el = document.getElementById("netstate");
  if (!el) return;
  el.hidden = navigator.onLine !== false;
}
try {
  aggiornaStatoRete();
  window.addEventListener("online", aggiornaStatoRete);
  window.addEventListener("offline", aggiornaStatoRete);
} catch {
  // Riga lasciata nascosta: nessuna eccezione visibile all'utente.
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

// feat-riscopri-un-giorno-a-caso: pesca una data diversa da quella mostrata
// dall'elenco delle date d'archivio note. Pura e testata: sorteggio
// iniettabile (default Math.random), mai la data corrente, null sugli input
// degenerati (elenco vuoto, elenco con la sola data corrente, non-array).
function scegliGiornoACaso(date, dataCorrente, sorteggio = Math.random) {
  if (!Array.isArray(date)) return null;
  const candidati = date.filter((d) => d !== dataCorrente);
  if (!candidati.length) return null;
  const i = Math.min(Math.floor(sorteggio() * candidati.length), candidati.length - 1);
  return candidati[i];
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
  dayShareImgEl.hidden = !hasJourney || !PUO_CONDIVIDERE_FILE;
  dayFavEl.hidden = !hasJourney;
  playEl.hidden = !hasJourney;
  jmsgEl.hidden = hasJourney;
  // feat-riscopri-un-giorno-a-caso: l'archivio noto (arcsCache appiattito,
  // fallback la finestra corrente) può contenere più date di quelle già
  // sfogliate ora — è quell'elenco intero a decidere se c'è un altro giorno
  // da riscoprire, non solo hasJourney.
  const knownDates = (arcsCache[chId] || []).flat();
  const knownCount = knownDates.length ? knownDates.length : dates.length;
  dayRandEl.hidden = !hasJourney || knownCount < 2;
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
  const eraGiaPreferito = isPreferito(chId, date);
  togglePreferito(chId, date);
  updateDayFavButton(chId, date);
  renderFavList(chId);
  if (!eraGiaPreferito) conservaOffline(chId, date);
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
    // Miniatura di riga: stessa src del viaggio (srcFor), mai una seconda
    // costruzione di URL. Senza indirizzo utilizzabile, riga di solo testo.
    const miniSrc = srcFor(chId, d, d === TODAY);
    if (miniSrc) {
      const mini = document.createElement("img");
      mini.className = "favmini";
      mini.src = miniSrc;
      mini.alt = "";
      mini.loading = "lazy";
      mini.decoding = "async";
      row.appendChild(mini);
    }
    const textWrap = document.createElement("span");
    textWrap.className = "arctxt";
    const label = document.createElement("span");
    label.className = "arcdate";
    label.textContent = formatDayLabel(d);
    const text = document.createElement("span");
    text.className = "arctext";
    text.textContent = (g && g.conceptNome) || "giorno preferito";
    textWrap.appendChild(label);
    textWrap.appendChild(text);
    row.appendChild(textWrap);
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
  // Ultima riga del pannello: copia il link di trasferimento dei preferiti
  // di questo canale (feat-porta-i-tuoi-preferiti-su-un-altro-telefono).
  // Stessa .arcrow delle righe dei giorni — nessun componente nuovo — e
  // solo quando c'è almeno un preferito da trasferire.
  if (preferiti.length > 0) {
    const copyRow = document.createElement("button");
    copyRow.type = "button";
    copyRow.className = "arcrow";
    const label = document.createElement("span");
    label.className = "arcdate";
    label.textContent = "↗";
    const text = document.createElement("span");
    text.className = "arctext";
    text.textContent = "copia il link dei tuoi preferiti";
    copyRow.appendChild(label);
    copyRow.appendChild(text);
    copyRow.addEventListener("click", async () => {
      const link = linkPreferiti(chId);
      try {
        await copiaNegliAppunti(link);
        toast("link copiato");
      } catch {
        toast(link);
      }
    });
    favListEl.appendChild(copyRow);
  }
  // feat-i-preferiti-degli-altri-canali-non-si-perdono: in coda al pannello,
  // una riga per ciascun altro canale con giorni segnati — mai una
  // miniatura, la riga non rappresenta un giorno singolo. Il click riapre il
  // preferito più recente di quel canale: sulla home (stesso percorso di
  // ?c=/?d= dei link condivisi) se il canale è ancora fra le card mostrate,
  // in archivio altrimenti — un canale ritirato non torna mai fra le card.
  const altrove = preferitiAltrove(chId);
  for (const voce of altrove) {
    const ch = CHANNELS.find((c) => c.id === voce.id);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "arcrow";
    const label = document.createElement("span");
    label.className = "arcdate";
    label.textContent = ch ? ch.emoji : "⤳";
    const text = document.createElement("span");
    text.className = "arctext";
    const n = voce.giorni.length;
    text.textContent = (ch ? ch.name : voce.id) + " — " + n + (n === 1 ? " giorno segnato" : " giorni segnati");
    row.appendChild(label);
    row.appendChild(text);
    row.addEventListener("click", () => {
      const piuRecente = voce.giorni[0];
      if (ch) {
        location.href = "/?c=" + encodeURIComponent(voce.id) + "&d=" + encodeURIComponent(piuRecente);
      } else {
        location.href = "/archivi/" + encodeURIComponent(voce.id) + "?date=" + encodeURIComponent(piuRecente);
      }
    });
    favListEl.appendChild(row);
  }
  // Nessun preferito, né su questo canale né altrove: niente comando,
  // niente elenco — stessa regola di #arcpick con meno di due archi.
  favPickEl.hidden = preferiti.length === 0 && altrove.length === 0;
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

// feat-riscopri-un-giorno-a-caso: pesca una data a caso dall'archivio noto
// del canale mostrato (arcsCache appiattito, fallback archiveCache) e salta
// lì, riusando goToArc — lo stesso percorso di #dayPick, #arclist e
// dell'elenco dei preferiti, nessuna seconda implementazione del salto.
// Se non c'è nessun altro giorno, o l'arco della data estratta non si
// trova più, si avvisa e la vista non cambia: mai uno schermo nero.
dayRandEl.addEventListener("click", () => {
  const chId = CHANNELS[order[0]].id;
  const arcs = arcsCache[chId] || [];
  const known = arcs.flat();
  const date = known.length ? known : (archiveCache[chId] || []);
  const d = scegliGiornoACaso(date, previewDate ?? TODAY);
  const arcIdx = d === null ? -1 : arcs.findIndex((arc) => arc.includes(d));
  if (d === null || arcIdx === -1) {
    toast("nessun altro giorno da riaprire");
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
  // Il file del giorno è 960×2048: assegnarlo a top.src senza averlo prima
  // decodificato sposta la decodifica sul thread principale, dentro il paint
  // successivo — a 900ms di cadenza durante il timelapse si vede come scatto,
  // e sommata all'animazione del deck (rotateDeck) è il colpo di grazia.
  // decoding="async" è solo un suggerimento al browser (nessuna garanzia).
  // pre.decode() invece la garantisce, MA la sua promise dipende dagli stessi
  // dati che fanno scattare "load" (la decodifica parte dopo il fetch): nel
  // percorso comune "load" arriva prima che decode() risolva, quindi è
  // onload — non decode() — ad applicare il fotogramma qui sotto. decode()
  // resta comunque utile: se risolve per primo (cache calda, decodifica
  // già pronta) applica subito senza aspettare "load", e in ogni caso il
  // browser tiene comunque traccia della richiesta di decodifica async.
  pre.decoding = "async";
  let applicato = false; // decode() e onload possono risolvere entrambi: si applica una volta sola
  pre.onload = () => {
    if (pendingPreviewSrc !== src) return; // l'utente ha già cambiato giorno: non sovrascrivere
    if (applicato) return; // già mostrato dal percorso decode() qui sotto
    applicato = true;
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
  // Ripiego esplicito: dove decode() non esiste o rifiuta (browser vecchi,
  // immagine corrotta), resta onload — che il browser chiama comunque anche
  // senza decode riuscito. Mai un fotogramma perso, mai un errore in console
  // (l'immagine mancante è già gestita da pre.onerror sopra).
  if (pre.decode) pre.decode().then(() => pre.onload()).catch(() => {});
  updateDayNav(chId);
  precaricaAdiacenti(chId, date); // i prossimi due passi (avanti/indietro) sono già in cache al ritorno
}

/* ---------- timelapse "GIF" del viaggio nel mockup ---------- */
const prefersStill = matchMedia("(prefers-reduced-motion: reduce)").matches;
let playTimer = null;
let playing = false;
// Ritardo di cortesia prima del primo fotogramma quando il timelapse parte
// da solo dopo un cambio di canale (mai quando lo si chiede col tasto ▶):
// chi sfoglia due o tre card di fila non deve pagare il download del canale
// che sta già lasciando. Il timer è playTimer, quindi stopPlayback() — che
// rotateDeck chiama a ogni giro — lo annulla: se l'utente sfoglia ancora,
// non parte nulla finché non si ferma su una card.
const RITARDO_AUTOPLAY_MS = 700;
let autoplayDaRotazione = false;

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
  // NIENTE preload dell'intero arco: era una raffica di N richieste e N
  // decodifiche ad ogni cambio canale (rotateDeck), il singolo costo più
  // alto del cambio card. Si precarica solo il PRIMO fotogramma — altrimenti
  // il timelapse partirebbe su un mockup vuoto, previewDay porta l'opacità a
  // 0 in attesa; gli altri arrivano uno alla volta da previewDay →
  // precaricaAdiacenti, che durante la riproduzione precarica sempre il
  // fotogramma successivo e riusa il Set "precaricati" — nessuna immagine
  // chiesta due volte, nemmeno al secondo giro o rientrando sullo stesso canale.
  const primo = srcFor(chId, dates[0], dates[0] === TODAY);
  if (!precaricati.has(primo)) {
    precaricati.add(primo);
    const im = new Image();
    im.src = primo;
  }
  let i = 0;
  const step = () => {
    if (!playing || CHANNELS[order[0]].id !== chId) { stopPlayback(); return; } // card cambiata
    const d = dates[i];
    previewDay(chId, d, d === TODAY);
    const isLast = i === dates.length - 1;
    i = (i + 1) % dates.length; // loop infinito, come una GIF
    playTimer = setTimeout(step, isLast ? 2000 : 900); // su "oggi" si ferma un po' di più
  };
  // Il respiro sopra si applica solo all'autoplay partito da rotateDeck: col
  // tasto ▶ l'utente ha già scelto di guardare, il primo fotogramma parte subito.
  const ritardo = autoplayDaRotazione ? RITARDO_AUTOPLAY_MS : 0;
  autoplayDaRotazione = false;
  if (ritardo) playTimer = setTimeout(step, ritardo);
  else step();
}

playEl.addEventListener("click", () => {
  // Azzera il flag prima della richiesta esplicita: il ritardo di RITARDO_AUTOPLAY_MS
  // è pensato solo per l'autoplay che riparte da rotateDeck, mai per il click su ▶ —
  // altrimenti un flag rimasto true (autoplay saltato per prefers-reduced-motion,
  // canale con <2 date, o archivio non disponibile) farebbe pagare il ritardo anche qui.
  autoplayDaRotazione = false;
  playing ? stopPlayback() : startPlayback();
});

attachJourneySwipe();
buildDeck();
</script>
</body>
</html>`;
}
