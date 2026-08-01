// Pagina /aiuto — troubleshooting e FAQ di ArtiPop.
//
// Sta in un modulo separato da page.js (la landing) perché ha un ciclo di vita
// diverso: la landing cambia quando cambiano i canali, questa cambia quando
// impariamo qualcosa di nuovo sui bug di iOS. Tenerle separate evita che una
// modifica al troubleshooting rischi di rompere il deck swipeabile.
//
// Contenuto: solo cose verificate. Ogni voce dice il SINTOMO (come lo vede
// l'utente), la CAUSA e il RIMEDIO — in quest'ordine, perché chi arriva qui sta
// cercando il proprio sintomo, non una spiegazione.

import { ACTIVE_CHANNELS } from "./channels.js";
import { CONFIG } from "./config.js";
import { FAVICON_TAG } from "./head.js";

/** Voci di troubleshooting: sintomo → causa → rimedio. `priority` le mette in cima. */
const PROBLEMI = [
  {
    priority: true,
    sintomo: "A mano funziona, ma in automazione non succede niente",
    causa: `È <em>il</em> problema classico degli sfondi automatici su iPhone, e nel 99% dei casi
      la causa è una sola: l'interruttore <strong>"Mostra anteprima"</strong> lasciato acceso
      dentro l'azione <strong>Imposta sfondo</strong>. Con l'anteprima accesa l'azione deve
      mostrarti un foglio di conferma: quando lanci la Shortcut a mano tu tocchi "Imposta"
      (spesso senza farci caso) e sembra tutto a posto. Ma un'automazione a orario gira in
      background, di solito a telefono bloccato, dove <strong>nessuna schermata può
      comparire</strong>: l'azione si ferma lì e non vedi nessun errore.`,
    rimedio: `Le Shortcut scaricate da questo sito hanno già l'anteprima spenta dentro il file:
      se la tua è vecchia, riscaricala. Se te la sei creata a mano: apri la Shortcut →
      azione <strong>Imposta sfondo</strong> → espandi le opzioni con la freccetta →
      spegni <strong>Mostra anteprima</strong>. Controlla anche che l'automazione sia su
      <strong>Esegui immediatamente</strong>.`,
  },
  {
    sintomo: "Ogni tanto lo sfondo non cambia, ma altre volte sì",
    causa: `Con l'anteprima già spenta resta un bug intermittente di Apple sull'azione
      "Imposta sfondo" quando parte da un'automazione (nei log compare come
      <code>extensionKit error 2</code>). È noto almeno da iOS 18, non dipende da ArtiPop e
      su alcuni modelli di iPhone capita più spesso che su altri.`,
    rimedio: `Workaround collaudato: <strong>duplica l'automazione</strong> e sfalsala di un
      minuto (es. tramonto e tramonto +1'). Se il primo tentativo fallisce, passa il secondo.
      Non consuma niente: se lo sfondo è già quello di oggi, la seconda esecuzione lo
      reimposta identico.`,
  },
  {
    sintomo: "Cambia lo sfondo sbagliato",
    causa: `ArtiPop aggiorna sempre l'<strong>ultimo</strong> sfondo della schermata di blocco,
      cioè l'ultima scheda della galleria in Impostazioni → Sfondo. Se in fondo c'è uno sfondo
      a cui tieni, viene sovrascritto quello. (Puntiamo all'ultimo e non al primo proprio
      perché il primo posto è quasi sempre già occupato e iOS non permette di riordinare le
      schede: l'ultimo, invece, te lo puoi creare quando vuoi.)`,
    rimedio: `Crea uno sfondo dedicato ad ArtiPop e lascialo per ultimo: in
      <em>Impostazioni → Sfondo</em> aggiungine uno nuovo qualsiasi — finisce in fondo alla
      galleria e da lì in poi sarà quello aggiornato ogni giorno. Se invece preferisci
      lasciare la scelta a iOS, scarica la
      <a href="/s/natura-base.shortcut">versione base della Shortcut</a>, che non aggancia
      nessuna scheda e aggiorna lo sfondo attivo.`,
  },
  {
    sintomo: "Ho toccato \"Scarica la Shortcut\" ma non si è aperto niente",
    causa: `Safari non sa aprire da solo un file <code>.shortcut</code>: lo passa al sistema, e a
      seconda delle impostazioni te lo mostra subito con un foglio di condivisione oppure te lo
      salva nei <strong>Download</strong>. Non è un errore: il file è arrivato, manca solo
      l'ultimo passo.`,
    rimedio: `Tocca l'icona dei <strong>Download</strong> in Safari (la freccia verso il basso
      accanto alla barra dell'indirizzo) e tocca il file appena scaricato: si apre
      <strong>Comandi rapidi</strong> con la schermata "Aggiungi comando". In alternativa lo
      trovi nell'app <em>File</em> → <em>Download</em>. Se iOS dice che la scorciatoia non è
      attendibile, vedi la voce qui sotto.`,
  },
  {
    sintomo: "iOS non mi fa importare il file",
    causa: `Le Shortcut distribuite come file (non tramite link iCloud) sono considerate
      "non attendibili" finché non abiliti l'opzione apposta.`,
    rimedio: `Vai in <em>Impostazioni → Scorciatoie</em> e attiva
      <strong>Consenti scorciatoie non attendibili</strong>. Se non vedi la voce, esegui prima
      una scorciatoia qualsiasi (anche una che non c'entra) e poi riprova.`,
  },
  {
    sintomo: "Lo sfondo è uguale a ieri",
    causa: `Ogni giorno cambia <strong>un pezzo</strong> della scena, non tutta la scena: è il
      punto di ArtiPop. Se però è identico identico, può essere che la generazione notturna
      sia fallita — in quel caso ArtiPop tiene l'immagine del giorno prima invece di
      rompersi.`,
    rimedio: `Guarda sotto il mockup sulla home: se la data del fotogramma dice "oggi" (e la
      posizione è "N di M" più aggiornata, sfogliabile con le frecce), l'immagine c'è ed è il
      tuo iPhone che non l'ha scaricata (rilancia la Shortcut a mano). Se la data di oggi non
      compare, riprova più tardi: la generazione riparte da sola la notte successiva.`,
  },
  {
    sintomo: "L'automazione parte ma la rete non c'è",
    causa: `Se al momento dell'automazione l'iPhone è senza connessione, il download
      dell'immagine fallisce e la Shortcut si ferma prima di arrivare all'azione sfondo.`,
    rimedio: `Scegli per l'automazione un orario in cui sei di norma sotto WiFi o in copertura
      (il tramonto va bene per quasi tutti). Il giorno saltato non si perde: l'indomani
      riprende con l'immagine nuova, e quella di ieri resta comunque nell'archivio.`,
  },
];

/** Domande frequenti: cose che non sono problemi, ma che tutti chiedono. */
const FAQ = [
  {
    q: "Quanto costa?",
    a: `Niente, e non è una prova gratuita: ArtiPop gira interamente dentro i piani gratuiti di
      Cloudflare. Non c'è account da creare, non c'è app da installare, non ci sono pubblicità.`,
  },
  {
    q: "Come funziona la storia degli sfondi?",
    a: `Ogni canale racconta un progetto che avanza di un pezzo al giorno e si completa in
      <strong>${CONFIG.ARC_LENGTH_DAYS} giorni</strong>. Al settimo giorno il progetto è finito:
      l'ottavo giorno si riparte da una <strong>base nuova</strong> — nuova scena, nuovo progetto —
      e il ciclo ricomincia. Così non vedi mai due settimane uguali.
      <br><br>
      Per sfogliare il viaggio dalla home usa le <strong>frecce</strong> sul mockup e il
      contatore "N di M" per muoverti fra i giorni; <strong>torna a oggi</strong> per rientrare
      al giorno corrente; <strong>arco precedente</strong> e <strong>arco successivo</strong>
      per passare da un progetto all'altro; <strong>scegli l'arco</strong> per saltare
      direttamente a uno dall'elenco; <strong>leggi la storia</strong> per vedere tutte le
      tappe dell'arco in corso. Ogni giorno ha anche un indirizzo diretto e condivisibile
      (<code>?date=</code>).`,
  },
  {
    q: "Posso cambiare canale?",
    a: `Sì: apri la Shortcut e sostituisci l'URL nell'azione "Ottieni contenuto da URL" con
      quello di un altro canale (${ACTIVE_CHANNELS.map((c) => `<code>/w/${c.id}</code>`).join(", ")},
      oppure <code>/w/random</code> per averne uno a sorpresa ogni giorno). Oppure scarica
      direttamente la Shortcut dell'altro canale dalla home.`,
  },
  {
    q: "Posso avere uno sfondo nuovo subito?",
    a: `Tocca la Shortcut manualmente quando vuoi: scarica sempre l'immagine più recente.
      Puoi anche aggiungere una seconda automazione all'alba, così l'aggiornamento arriva
      la mattina invece che la sera.`,
  },
  {
    q: "Che fine fanno gli sfondi vecchi?",
    a: `Restano in archivio per sempre, ma "Il viaggio finora" sulla home mostra solo l'arco in
      corso, non tutto lo storico. Ogni immagine passata ha comunque un suo indirizzo diretto,
      sempre raggiungibile, del tipo <code>/w/natura?date=2026-07-16</code>.`,
  },
  {
    q: "A che ora viene generato lo sfondo del giorno?",
    a: `Ogni notte alle 3:00 UTC (ora italiana le 5:00 d'estate). Quando la tua automazione
      scatta al tramonto, l'immagine del giorno è pronta da un pezzo.`,
  },
  {
    q: "Serve tenere l'iPhone sbloccato?",
    a: `No. Con l'anteprima spenta l'automazione lavora anche a telefono bloccato in tasca:
      è esattamente il motivo per cui quell'interruttore conta tanto.`,
  },
  {
    q: "Consuma batteria o traffico?",
    a: `Pochissimo: un download da circa 1 MB al giorno e nessun processo in background.
      ArtiPop non gira mai sul telefono, se non nei due secondi dell'automazione.`,
  },
];

/** Escape minimo per il testo dinamico inserito nell'HTML. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * Slug kebab-case da un testo di sintomo/domanda: minuscolo, accenti e
 * punteggiatura rimossi, spazi collassati in `-`, tagliato a lunghezza
 * ragionevole. Dipende solo dal testo, così l'id resta lo stesso fra un
 * deploy e l'altro finché il testo non cambia — è la base dei link
 * permanenti (`slugVoce` + prefisso di sezione = `id` pubblico della voce).
 */
function slugVoce(testo) {
  return String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Assegna a ogni voce un id `<prefisso>-<slug>` univoco, appendendo `-2`,
 * `-3`… in ordine di dichiarazione in caso di collisione. L'id è parte del
 * contratto pubblico della pagina (è l'indirizzo di un link condiviso): non
 * va fatto dipendere dall'indice dell'array, solo dal testo della voce.
 */
function assegnaId(voci, prefisso, testoDi) {
  const usati = new Map();
  return voci.map((v) => {
    const base = `${prefisso}-${slugVoce(testoDi(v))}`;
    const n = (usati.get(base) ?? 0) + 1;
    usati.set(base, n);
    return { voce: v, id: n === 1 ? base : `${base}-${n}` };
  });
}

/**
 * Pagina 404 per `/s/<flusso>.shortcut` quando il file non è (ancora) in KV —
 * stesso `<head>`, stack font e token colore di `renderHelpPage()` (M6/
 * VISUAL_SPECS §2), così non nasce una seconda spec visiva da mantenere.
 * I link di download sono presi da `ACTIVE_CHANNELS`, mai scritti a mano: se
 * un flusso viene ritirato o aggiunto, questa pagina si aggiorna da sola.
 */
export function renderShortcutMancante(flusso) {
  const link = ACTIVE_CHANNELS.map(
    (c) => `<li><a href="/s/${esc(c.id)}.shortcut">${esc(c.name)}</a></li>`
  ).join("");

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — Shortcut non disponibile</title>
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
  h2 { margin: 44px 0 14px; font-size: 1.15rem; letter-spacing: .01em; }
  ul.flussi { list-style: none; margin: 0; padding: 0; }
  ul.flussi li {
    border: 1px solid rgba(255,255,255,.10); border-radius: 14px;
    background: rgba(255,255,255,.03); margin-bottom: 10px;
  }
  ul.flussi a { display: block; padding: 16px 18px; font-weight: 600; text-decoration: none; }
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; color: #9aa3b8; }
  footer a { display: inline-block; padding: 12px 6px; }
</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/">← torna ad ArtiPop</a>
    <h1>Shortcut non disponibile</h1>
    <p class="sub">La Shortcut per «${esc(flusso)}» non è disponibile in questo momento. Prova
      uno dei flussi attivi qui sotto, oppure consulta la pagina di aiuto.</p>
  </header>

  <h2>Flussi disponibili</h2>
  <ul class="flussi">${link}</ul>

  <footer>
    <a href="/aiuto">Vai alla pagina di aiuto</a> · <a href="/">Home</a>
  </footer>
</main>
</body>
</html>`;
}

/**
 * Pagina 500 per un'eccezione imprevista sulle rotte HTML pubbliche (/, /aiuto,
 * /s/<flusso>.shortcut) — stesso `<head>`, stack font e token colore di
 * `renderShortcutMancante()`/`renderHelpPage()` (M6/VISUAL_SPECS §2). Nessun
 * dettaglio tecnico: solo un messaggio umano e i due link di uscita, mai
 * `err.message` o uno stack (divieto segreti, vedi CLAUDE.md).
 */
export function renderErroreTemporaneo() {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — qualcosa non ha funzionato</title>
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
  h1 { margin: 0 0 10px; font-size: clamp(1.8rem, 6vw, 2.4rem); letter-spacing: -.02em; }
  .sub { margin: 0; color: #9aa3b8; }
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; color: #9aa3b8; }
  footer a { display: inline-block; padding: 12px 6px; }
</style>
</head>
<body>
<main>
  <header>
    <h1>Qualcosa non ha funzionato</h1>
    <p class="sub">Riprova fra qualche minuto: nel frattempo torna alla home o consulta la
      pagina di aiuto.</p>
  </header>

  <footer>
    <a href="/">Home</a> · <a href="/aiuto">Pagina di aiuto</a>
  </footer>
</main>
</body>
</html>`;
}

/**
 * Pagina 404 per qualunque percorso HTML sconosciuto (link vecchio, indirizzo
 * digitato male) — stesso `<head>`, stack font e token colore di
 * `renderErroreTemporaneo()` (M6/VISUAL_SPECS §2). Nessun dettaglio tecnico:
 * il percorso richiesto non viene mai riflesso nel corpo (divieto segreti).
 */
export function renderPaginaNonTrovata() {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — pagina non trovata</title>
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
  h1 { margin: 0 0 10px; font-size: clamp(1.8rem, 6vw, 2.4rem); letter-spacing: -.02em; }
  .sub { margin: 0; color: #9aa3b8; }
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; color: #9aa3b8; }
  footer a { display: inline-block; padding: 12px 6px; }
</style>
</head>
<body>
<main>
  <header>
    <h1>Pagina non trovata</h1>
    <p class="sub">L'indirizzo richiesto non esiste: torna alla home o consulta la pagina di
      aiuto.</p>
  </header>

  <footer>
    <a href="/">Home</a> · <a href="/aiuto">Pagina di aiuto</a>
  </footer>
</main>
</body>
</html>`;
}

/**
 * Frase di stato per un canale, dato l'esito di `buildFreschezzaState`
 * (stessa forma letta da /health): "aggiornato oggi" se l'ultima esecuzione
 * è di oggi, "fermo da ieri"/"fermo da N giorni" se in ritardo, "nessuna
 * immagine ancora" se il canale non ha mai generato (giorniDiRitardo null).
 */
function fraseStato({ aggiornato, giorniDiRitardo }) {
  if (aggiornato) return "aggiornato oggi";
  if (giorniDiRitardo === null) return "nessuna immagine ancora";
  if (giorniDiRitardo === 1) return "fermo da ieri";
  return `fermo da ${giorniDiRitardo} giorni`;
}

/**
 * Blocco «Stato dei canali» (feat-l-aiuto-dice-se-il-canale-e-fermo): una
 * riga per canale con nome ed esito leggibile. `stato` arriva già nella
 * forma `[{ id, nome, aggiornato, giorniDiRitardo }]` (la stessa lettura di
 * /health, vedi index.js) — qui non si legge KV, solo markup. Vuoto o
 * assente → stringa vuota, cioè nessun contenitore vuoto nella pagina.
 */
function renderStatoCanali(stato) {
  if (!Array.isArray(stato) || stato.length === 0) return "";
  const righe = stato
    .map((c) => `<li><span class="nome">${esc(c.nome)}</span><span class="esito">${esc(fraseStato(c))}</span></li>`)
    .join("");
  return `
  <ul class="stato-canali" data-stato-canali>${righe}</ul>`;
}

/** Pagina /aiuto completa (HTML autoconsistente, nessuna risorsa esterna). `stato`: v. `renderStatoCanali`. */
export function renderHelpPage(stato = null) {
  const problemi = assegnaId(PROBLEMI, "p", (p) => p.sintomo)
    .map(
      ({ voce: p, id }) => `
      <details class="item${p.priority ? " hot" : ""}" id="${id}"${p.priority ? " open" : ""}>
        <summary>${esc(p.sintomo)}<a class="permalink" href="#${id}" aria-label="Link a questa voce">#</a></summary>
        <div class="body">
          <p class="label">Perché succede</p>
          <p>${p.causa}</p>
          <p class="label">Come si risolve</p>
          <p>${p.rimedio}</p>
        </div>
      </details>`
    )
    .join("");

  const faq = assegnaId(FAQ, "d", (f) => f.q)
    .map(
      ({ voce: f, id }) => `
      <details class="item" id="${id}">
        <summary>${esc(f.q)}<a class="permalink" href="#${id}" aria-label="Link a questa voce">#</a></summary>
        <div class="body"><p>${f.a}</p></div>
      </details>`
    )
    .join("");

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — aiuto e problemi comuni</title>
<meta name="description" content="Perché l'automazione dello sfondo non parte, e tutte le altre domande su ArtiPop." />
<meta name="theme-color" content="#0a0b10" />
${FAVICON_TAG}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 20px 80px;
    /* M6/VISUAL_SPECS §2: testo primario allineato al token --text del sito (#f2f3f8) */
    background: #0a0b10; color: #f2f3f8;
    /* Stack font allineato a quello del sito (page.js): stessi fallback, stesso ordine */
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
  /* M6: sottotitolo come testo secondario sul token --dim del sito, non più opacity sul primario */
  .sub { margin: 0; color: #9aa3b8; }
  /* feat-cerca-il-tuo-problema-nell-aiuto: campo di ricerca, soli token già in spec (§2) */
  #cerca {
    display: block; width: 100%; margin-top: 16px; min-height: 44px;
    border: 1px solid rgba(255,255,255,.10); border-radius: 14px;
    background: rgba(255,255,255,.03); color: #f2f3f8;
    padding: 0 16px; font: inherit;
  }
  #cerca::placeholder { color: #9aa3b8; }
  #cerca:focus { outline: none; border-color: rgba(255,255,255,.24); }
  .item.filtrata { display: none; }
  h2.filtrata { display: none; }
  .nessuna-voce { color: #9aa3b8; }
  /* feat-l-aiuto-dice-se-il-canale-e-fermo: elenco piatto, soli token già in spec (§2) */
  ul.stato-canali { list-style: none; margin: 20px 0 0; padding: 0; }
  ul.stato-canali li {
    display: flex; justify-content: space-between; gap: 12px;
    padding: 10px 2px; border-bottom: 1px solid rgba(255,255,255,.08);
  }
  ul.stato-canali li:last-child { border-bottom: none; }
  ul.stato-canali .nome { font-weight: 600; }
  ul.stato-canali .esito { color: #9aa3b8; text-align: right; }
  h2 { margin: 44px 0 14px; font-size: 1.15rem; letter-spacing: .01em; }
  .item {
    border: 1px solid rgba(255,255,255,.10); border-radius: 14px;
    background: rgba(255,255,255,.03); margin-bottom: 10px; overflow: hidden;
  }
  .item.hot { border-color: rgba(143,211,255,.42); background: rgba(143,211,255,.07); }
  summary {
    cursor: pointer; padding: 16px 18px; font-weight: 600; list-style: none;
    display: flex; align-items: center; gap: 10px;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "＋"; opacity: .5; font-weight: 400; }
  .item[open] summary::before { content: "－"; }
  .item[open] summary { border-bottom: 1px solid rgba(255,255,255,.08); }
  /* M8: link permanente per-voce, stessi token della spec (§2) — nessun colore/dimensione nuova */
  .permalink {
    display: flex; align-items: center; justify-content: center;
    min-width: 44px; min-height: 44px; margin-left: auto; margin-right: -8px;
    color: #8fd3ff; font-size: .74rem; text-decoration: none;
    opacity: .45; flex-shrink: 0;
  }
  .permalink:hover, .permalink:focus { opacity: 1; }
  .body { padding: 4px 18px 18px; }
  .body p { margin: 10px 0; opacity: .88; }
  .label {
    margin: 16px 0 2px !important; font-size: .74rem; text-transform: uppercase;
    letter-spacing: .1em; opacity: .5 !important; font-weight: 700;
  }
  code {
    background: rgba(255,255,255,.09); padding: 1px 6px; border-radius: 5px;
    font-size: .88em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  /* M6: footer come testo secondario sul token --dim del sito, non più opacity sul primario */
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; color: #9aa3b8; }
  footer a { display: inline-block; padding: 12px 6px; }
</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/">← torna ad ArtiPop</a>
    <h1>Aiuto e problemi comuni</h1>
    <p class="sub">Cerca il tuo sintomo qui sotto: la prima voce copre da sola quasi tutti i casi.</p>
    <input type="search" id="cerca" hidden placeholder="Cerca un sintomo o una parola" aria-label="Cerca un sintomo o una parola" autocomplete="off" />
  </header>
${renderStatoCanali(stato)}
  <h2 data-sezione="problemi">Qualcosa non funziona</h2>
  ${problemi}

  <h2 data-sezione="faq">Domande frequenti</h2>
  ${faq}
  <p class="nessuna-voce" id="nessuna-voce" hidden></p>

  <footer>
    Non hai trovato il tuo caso? Aprine uno su
    <a href="https://github.com/RiccardoDominici/ArtiPop">GitHub</a>. ·
    <a href="/">Home</a>
  </footer>
</main>
<script>
  // Apre la voce corrispondente al frammento dell'URL: un elemento "details"
  // chiuso non si apre da solo alla navigazione per hash su tutti i browser,
  // quindi un link condiviso porterebbe a una voce ancora chiusa senza questo.
  function apriDaHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var campo = document.getElementById("cerca");
    if (campo && campo.value) {
      campo.value = "";
      filtra("");
    }
    var voce = document.getElementById(id);
    if (voce && voce.tagName === "DETAILS") {
      voce.open = true;
      voce.scrollIntoView();
    }
  }
  document.addEventListener("DOMContentLoaded", apriDaHash);
  window.addEventListener("hashchange", apriDaHash);

  // feat-cerca-il-tuo-problema-nell-aiuto: filtro sul testo delle voci
  // (sintomo, causa e rimedio) mentre l'utente scrive. Progressive
  // enhancement: il campo nasce "hidden" nel markup e compare solo se
  // questo script gira, così senza JS la pagina resta quella di sempre.
  function filtra(query) {
    var q = query.trim().toLowerCase();
    var sezioni = document.querySelectorAll("main > h2[data-sezione]");
    var trovataAlmenoUna = false;
    sezioni.forEach(function (h2) {
      var visibiliInSezione = 0;
      var el = h2.nextElementSibling;
      while (el && el.tagName === "DETAILS") {
        var testo = el.textContent.toLowerCase();
        var corrisponde = q === "" || testo.indexOf(q) !== -1;
        el.classList.toggle("filtrata", !corrisponde);
        if (corrisponde) {
          visibiliInSezione++;
          trovataAlmenoUna = true;
        }
        el = el.nextElementSibling;
      }
      h2.classList.toggle("filtrata", q !== "" && visibiliInSezione === 0);
    });
    var messaggio = document.getElementById("nessuna-voce");
    if (messaggio) {
      if (q !== "" && !trovataAlmenoUna) {
        messaggio.textContent = "Nessuna voce corrisponde a «" + query.trim() + "».";
        messaggio.hidden = false;
      } else {
        messaggio.hidden = true;
      }
    }
  }
  document.addEventListener("DOMContentLoaded", function () {
    var campo = document.getElementById("cerca");
    if (!campo) return;
    campo.hidden = false;
    campo.addEventListener("input", function () {
      filtra(campo.value);
    });
  });
</script>
</body>
</html>`;
}
