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
    rimedio: `Guarda "Il viaggio finora" sulla home: se l'ultima miniatura ha la data di oggi,
      l'immagine c'è ed è il tuo iPhone che non l'ha scaricata (rilancia la Shortcut a mano).
      Se manca la data di oggi, riprova più tardi: la generazione riparte da sola la notte
      successiva.`,
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
      e il ciclo ricomincia. Così non vedi mai due settimane uguali.`,
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
    a: `Restano in archivio per sempre. Sulla home, in "Il viaggio finora", puoi rivedere e
      riscaricare ogni giorno passato; ogni immagine ha anche un suo indirizzo diretto, del
      tipo <code>/w/natura?date=2026-07-16</code>.`,
  },
  {
    q: "A che ora viene generato lo sfondo del giorno?",
    a: `Ogni notte alle 3:00 (ora italiana le 5:00 d'estate). Quando la tua automazione scatta
      al tramonto, l'immagine del giorno è pronta da un pezzo.`,
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

/** Pagina /aiuto completa (HTML autoconsistente, nessuna risorsa esterna). */
export function renderHelpPage() {
  const problemi = PROBLEMI.map(
    (p) => `
      <details class="item${p.priority ? " hot" : ""}"${p.priority ? " open" : ""}>
        <summary>${esc(p.sintomo)}</summary>
        <div class="body">
          <p class="label">Perché succede</p>
          <p>${p.causa}</p>
          <p class="label">Come si risolve</p>
          <p>${p.rimedio}</p>
        </div>
      </details>`
  ).join("");

  const faq = FAQ.map(
    (f) => `
      <details class="item">
        <summary>${esc(f.q)}</summary>
        <div class="body"><p>${f.a}</p></div>
      </details>`
  ).join("");

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>ArtiPop — aiuto e problemi comuni</title>
<meta name="description" content="Perché l'automazione dello sfondo non parte, e tutte le altre domande su ArtiPop." />
<meta name="theme-color" content="#0a0b10" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 20px 80px;
    background: #0a0b10; color: #e9e9f0;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 720px; margin: 0 auto; }
  a { color: #8fd3ff; }
  header { padding: 48px 0 24px; }
  .back { display: inline-block; margin-bottom: 20px; font-size: .92rem; text-decoration: none; opacity: .8; }
  .back:hover { opacity: 1; }
  h1 { margin: 0 0 10px; font-size: clamp(1.8rem, 6vw, 2.4rem); letter-spacing: -.02em; }
  .sub { margin: 0; opacity: .68; }
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
  footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.08); font-size: .85rem; opacity: .6; }
</style>
</head>
<body>
<main>
  <header>
    <a class="back" href="/">← torna ad ArtiPop</a>
    <h1>Aiuto e problemi comuni</h1>
    <p class="sub">Cerca il tuo sintomo qui sotto: la prima voce copre da sola quasi tutti i casi.</p>
  </header>

  <h2>Qualcosa non funziona</h2>
  ${problemi}

  <h2>Domande frequenti</h2>
  ${faq}

  <footer>
    Non hai trovato il tuo caso? Aprine uno su
    <a href="https://github.com/RiccardoDominici/ArtiPop">GitHub</a>. ·
    <a href="/">Home</a>
  </footer>
</main>
</body>
</html>`;
}
