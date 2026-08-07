# CHANGELOG.md — ArtiPop v3

Una voce per ciclo del sistema autonomo (o per intervento manuale), datata, che spiega il perché
delle modifiche — non solo il cosa. Scritta dall'Executor ad ogni ciclo che produce codice.

## Formato

```
## YYYY-MM-DD — <slug-obiettivo-del-ciclo>
- <modifica 1: cosa e perché>
- <modifica 2: cosa e perché>
```

<!-- ## 2026-08-01 — m2-test-auth-rotte-protette
- Aggiunti test su tutte le rotte protette (401/403): era il criterio mancante per chiudere M2.
- Mock manuale dei binding KV invece di @cloudflare/vitest-pool-workers: meno dipendenze, sufficiente
  per il caso d'uso attuale (essenzialità). -->

## 2026-08-07 — feat-il-giorno-d-archivio-si-condivide-con-un-tocco
- La pagina di un giorno d'archivio ha ora un bottone «condividi» nella barra `nav.giorni-nav`: il
  link canonico del giorno esisteva già (ciclo 158, `canonicalTag`) ma dal telefono si poteva solo
  pescare dalla barra del browser, mentre la home ha lo stesso gesto da tempo (`#dayshare`,
  `page.js`).
- Via primaria `navigator.share` (è la semantica vera dello slug: "si condivide", non "si copia"),
  con `navigator.clipboard.writeText` come ripiego dove il foglio nativo non c'è o fallisce — stesso
  doppio binario già collaudato sulla home. Il bottone compare (`hidden` rimosso via script) se
  ALMENO UNO dei due canali è disponibile.
- `TASTIERA_SCRIPT` rinominato `GIORNO_SCRIPT`: resta un solo `<script>` (impone §2.2), ora con due
  IIFE indipendenti — scorciatoie da tastiera e condivisione. `hidden` nel markup più regola CSS
  esplicita `[hidden] { display:none }`, altrimenti `display:inline-flex` lo scoprirebbe mostrando
  un comando morto senza JavaScript.

## 2026-08-03 — feat-il-giorno-d-archivio-si-sfoglia-con-la-tastiera
- La pagina di un giorno d'archivio (`/archivi/<id>?date=…`) risponde ora a `←`/`→` (giorno
  precedente/successivo) e `Home`/`Fine` (primo/ultimo giorno): sfogliare molti giorni di fila da
  computer costava un click mirato a ogni giorno, mentre la home aveva già la stessa navigazione da
  tastiera (feat-sfoglia-il-viaggio-con-la-tastiera).
- Un solo `keydown` che segue i link GIÀ presenti nel markup (`.precedente`, `.successivo`,
  `.estremo` — quest'ultimo ora marcato `data-nav="primo"`/`"ultimo"` per non dipendere dall'ordine
  dei nodi): zero elementi visibili aggiunti, zero rotte, zero dati nuovi. Stesse guardie della
  home: ignora tasti modificatori (`meta`/`ctrl`/`alt`) e il fuoco in un campo di testo.
- Il contratto §2.2 passa da «nessuno `<script>`» a «un solo `<script>`, quello delle scorciatoie»:
  gli 11 test che presidiavano l'assenza di JS ora contano esattamente uno invece di zero. Nessuna
  soglia abbassata, nessun test cancellato. Miglioramento progressivo: senza JS la pagina resta
  identica.

## 2026-08-03 — feat-dal-giorno-d-archivio-si-salta-al-primo-e-all-ultimo
- La barra «Sfoglia i giorni dell'archivio» della pagina `/archivi/<id>?date=…` porta ora «⇤ primo
  giorno» e «ultimo giorno ⇥»: su un canale con centinaia di giorni tornare all'inizio della storia
  costava decine di click o due aperture di `<details>`, era l'unico movimento di navigazione che
  mancava.
- Nuova riga «giorno N di M dell'archivio»: la pagina dice dove ti trovi, informazione che prima si
  poteva solo dedurre contando le voci dell'elenco.
- Interamente server-rendered (due `<a>` e un `<p>` in più, zero JS, zero rete): l'array `date` era
  già in memoria nella funzione di render — nessuna rotta nuova, nessuna lettura KV in più, contratto
  §2.2 «nessuno `<script>`, nessuna `fetch(`» invariato.

## 2026-08-02 — feat-l-archivio-del-mese-si-sfoglia-a-colpo-d-occhio
- Ogni voce di giorno nell'elenco per mese di `/archivi` (`<details class="mese">`) porta ora una
  miniatura `44×94` del wallpaper di quella data, dentro il link già esistente: si riconosce a
  occhio il giorno da riaprire invece di leggere una colonna di sole date. `src` è
  `/w/<id>?date=<data>`, già byte-stabile e cacheata `immutable`, quindi zero letture KV in più.
  Le voci vivono dentro `<details>` chiusi (`.giorni` → `.mese`): nessun browser scarica le
  immagini di un mese che l'utente non apre. Miniatura decorativa (`alt=""`, `loading="lazy"`,
  `decoding="async"`): il nome accessibile della voce resta la sola data, invariato per lo screen
  reader. Riuso dei token già in VISUAL_SPECS §2.1 (`object-fit:cover`, bordo, sfondo) — nessun
  colore o dimensione nuovi.

## 2026-08-02 — feat-il-giorno-d-archivio-mostra-dove-porta-il-passo-avanti
- I comandi «← giorno precedente» / «giorno successivo →» nella pagina di un giorno d'archivio
  portano ora anche una miniatura `60×128` del wallpaper di quel giorno, sopra il testo: si vede
  dove si sta andando prima di cliccare, invece di sfogliare alla cieca fra due date. Riuso
  integrale del token `.copertina` già in VISUAL_SPECS §2.1 (stesso `object-fit:cover`, raggio,
  bordo) — zero componenti nuovi, zero letture KV in più (l'URL si ricava dalla data già in mano
  al render), zero JS aggiunto (contratto §2.2 «nessun `<script>`, nessuna `fetch(`» intatto).
  Miniature decorative (`alt=""`), il nome accessibile del link resta il testo.

## 2026-08-02 — feat-riscopri-un-giorno-a-caso-dall-archivio
- Nuovo comando «un giorno a caso» nella barra della pagina di un giorno d'archivio
  (`/archivi/<id>?date=casuale`): pesca a sorte una data fra quelle già in archivio per il
  canale e redirige (302, `Cache-Control: no-store`) — così chi non sa che data cercare ha un
  modo per esplorare un canale storico, invece di doverne conoscere già una. Emesso solo con
  almeno 2 giorni in archivio: con un giorno solo porterebbe sempre alla pagina già aperta.
  Nuova funzione pura `scegliDataACaso` in `rotazione.js`, accanto a `scegliDataRotazione` (che
  resta invariata e deterministica per la Shortcut): qui `Math.random()` è lecito perché la
  risposta è un redirect HTML mai cacheato, non un'immagine `/w/`. Zero letture KV in più (si
  riusa la lista di date già caricata dal ramo `/archivi/<id>`), zero JS aggiunto.

## 2026-08-02 — feat-l-aiuto-spiega-come-salvare-e-condividere-un-giorno
- La FAQ «Che fine fanno gli sfondi vecchi?» in `help.js` si arricchisce con la spiegazione dei
  tre gesti già esistenti sul sito per salvare o condividere il giorno che si sta guardando (anche
  passato o d'archivio): salvataggio dell'immagine con nome file leggibile, copia del link esatto
  del giorno, condivisione diretta dell'immagine dove il browser lo permette. Nessuna voce FAQ
  nuova — arricchita quella esistente, stesso schema già usato per feed/archivi, per non rompere i
  test di conteggio voci hardcoded nelle altre suite (lo stesso motivo per cui il piano opus del
  ciclo 135, con una voce nuova, era finito FALLITO(EXEC) sulle baseline).

## 2026-08-02 — feat-dall-archivio-si-segue-il-canale-col-lettore-di-feed
- `archivi.js` guadagna, nella pagina di un giorno d'archivio, l'autodiscovery `<link
  rel="alternate" type="application/rss+xml">` nel `<head>` (`feedLinkTag`, riusata da `head.js`) e
  un comando visibile «segui col lettore di feed» nella barra precedente/successivo/Salva, entrambi
  verso `/feed/<id>.xml`: chi atterra sull'archivio (motori di ricerca inclusi, dai cicli 127/129)
  non doveva più passare dalla home per abbonarsi. Nessuna lettura KV in più, nessun `<script>`
  aggiunto — pagina server-rendered come prima.

## 2026-08-02 — feat-l-archivio-completo-del-canale-a-un-tocco
- `page.js` guadagna il comando ghost `#archlink` dentro `.journey`, subito dopo la didascalia
  "Solo questa settimana…": punta a `/archivi/<canale mostrato>`, l'archivio permanente (tutti i
  giorni, mese per mese) che dal ciclo 130 esiste anche per i canali attivi ma dalla home non
  era raggiungibile. Segue lo stesso canale di `#feedlink` (stesso aggiornamento in
  `updateChrome`, `encodeURIComponent(ch.id)`). Nessuna rotta nuova, nessun `fetch` in più: link
  statico risolto dal server-render.

## 2026-08-02 — feat-un-solo-indirizzo-ufficiale-per-ogni-pagina
- `head.js` guadagna `canonicalTag(origin, percorso)`, funzione pura (stessa guardia di
  `feedLinkTag`: stringa vuota senza `origin`) che compone `<link rel="canonical">`.
- Inserito in `renderPage` (fisso su `/`, non segue `?c=`/`?d=`), `renderHelpPage` (`/aiuto`,
  così i tre alias `/aiuto`, `/aiuto.html`, `/help` dichiarano lo stesso indirizzo ufficiale),
  `renderArchiviPage` (`/archivi`) e `renderGiornoArchivio` (il proprio percorso completo di
  `?date=`). Perché ora: robots.txt dice cosa non visitare (ciclo 127) e sitemap.xml cosa esiste
  (ciclo 129), ma nessuno dei due dice quale indirizzo, fra più copie della stessa pagina, è
  quello preferito — canonical chiude quella terza gamba.

## 2026-08-02 — feat-la-home-dice-da-dove-viene-questo-canale
- `channelData` in `page.js` guadagna il campo `eredita: [id, ...]`, calcolato invertendo
  `LEGACY_ALIASES` (già importata, oggi usata solo per risolvere `?c=<alias>`): zero fetch nuove,
  zero letture KV, gli id sono già pubblici nella costante `ALIAS` serializzata in pagina.
- `cardHTML` rende, in coda a `.cinfo` dopo l'eventuale `.stale`, la riga `.eredita` con l'elenco
  leggibile (nuovo helper client-side `elencoIt`, "e" finale) dei vecchi canali ereditati e un link
  a `/archivi` — così chi arriva da una Shortcut storica (island/bloom/studio/…) capisce dove sono
  finiti i suoi vecchi wallpaper. Assente per i canali senza alias.
- Escalation rispetto al tentativo fallito in EXEC (ciclo 123, planner opus): quel piano imponeva
  una `fetch('/api/channels?all=1')`, in conflitto con la guardia "regressione anti-ciclo-77" che
  impone esattamente UNA occorrenza di `fetch(` nell'HTML reso — questo piano non tocca la rete.
- `VISUAL_SPECS.md` §1.4: voce «Riga dell'eredità» (proposta ai sensi di §7), stessa coppia di
  token di `.stale` per il testo, `--a1` per il link (già in uso in pagina).

## 2026-08-02 — feat-il-giorno-d-archivio-dice-a-che-punto-della-storia-sei
- `rigaPosizione(arco, giornoNellArco, tappa)` in `archivi.js`, accanto a `rigaSoggetto()` e
  `rigaRacconto()`: restituisce `<div class="soggetto">` con «arco N · giorno M · tappa K» (solo le
  voci disponibili, `Number.isFinite` e non un test di verità perché 0 è un giorno/arco valido), o
  stringa vuota se nessuna delle tre è disponibile.
- Conversione base-zero → base-uno solo per `arco` (`arco + 1`): `giornoNellArco` e `tappa` arrivano
  già base-uno dalla carta d'identità (`storage.js:84-98`), `arco` no — l'unico punto in cui era
  facile sbagliare, documentato in un commento sopra la funzione.
- `renderGiornoArchivio` inserisce la riga subito dopo il soggetto e prima del racconto: prima dove
  sei nella storia, poi cosa succede. I tre campi arrivavano già dalla carta d'identità passata a
  `soggetto` e venivano buttati via, esattamente come `testoTappa` prima del ciclo 120 — zero letture
  KV in più, zero JS, zero fetch, nessuna modifica a `index.js`.
- `VISUAL_SPECS.md` §2.2: voce «Riga della posizione», stesso `<div class="soggetto">` già in uso,
  nessun token nuovo.

## 2026-08-02 — feat-le-date-d-archivio-si-leggono-in-italiano
- `dataEstesaItaliana` (`head.js`) esportata invece di restare privata: era già la funzione usata
  dall'anteprima social di un giorno condiviso («ArtiPop — <canale>, 2 agosto 2026»), ma le pagine
  d'archivio mostravano ancora la chiave grezza `2026-08-02` — incoerenza fra anteprima e pagina
  aperta per lo stesso link.
- `rigaData(dataKey)` in `archivi.js`: restituisce `<time datetime="...">` con la data in forma
  estesa italiana; con una chiave non conforme a `YYYY-MM-DD` ripiega sul testo grezzo escapato,
  mai `<time>` e mai «Invalid Date».
- Usata nell'intestazione di `renderGiornoArchivio` (`<p class="sub">`) e nell'intervallo
  `prima → ultima` di `renderElenco`: zero letture KV in più, zero JS, zero fetch, zero token
  nuovi — solo il testo dentro elementi già specificati in `VISUAL_SPECS.md` §2.1/§2.2.
- Restano in forma `YYYY-MM-DD` per scelta (fuori perimetro): `<title>`, `description`, `alt`
  dell'immagine, link e voci del `<details class="giorni">` — identificatori/indice compatto, il
  valore macchina resta comunque nel `datetime` del `<time>`.

## 2026-08-02 — feat-il-giorno-d-archivio-racconta-la-sua-tappa
- `rigaRacconto(testoTappa)` in `archivi.js`, accanto a `rigaSoggetto()`: restituisce
  `<p class="racconto">` col testo della tappa (sfuggito con `esc()`), o stringa vuota se il testo
  non è disponibile — mai un paragrafo vuoto per i giorni ricostruiti che hanno `testoTappa: null`.
- `renderGiornoArchivio` inserisce la riga subito dopo il soggetto e prima della `<figure>`: il dato
  arrivava già dalla carta d'identità letta per la riga element·concept e veniva buttato via —
  zero letture KV in più, zero JS, zero fetch aggiunti.
- `VISUAL_SPECS.md` §2.2: voce «Riga del racconto», stesso `--text #f2f3f8`, nessun colore o
  dimensione nuovi.

## 2026-08-02 — feat-un-giorno-d-archivio-sbagliato-mostra-quelli-giusti
- `renderArchivioNonTrovato(id, date)`: secondo parametro opzionale e retrocompatibile con le date
  d'archivio reali del canale. Quando `?date=` in un link non è in archivio (vecchio bookmark, link
  condiviso e copiato male, giorno mai esistito), la pagina 404 elenca ora i giorni che il canale ha
  davvero con lo stesso `<details class="giorni">` già usato dall'elenco e dalla pagina del giorno,
  invece di lasciare l'utente in un vicolo cieco col solo link a «Tutti gli archivi».
- `.sub` distingue le due formulazioni (canale senza archivio / giorno fuori dall'archivio) invece
  della frase precedente con «o» che copriva entrambi i casi al ribasso.
- `index.js`: il ramo 404 di `/archivi/<id>` passa `date` (già letto sopra, nessuna lettura KV in
  più) a `renderArchivioNonTrovato`.
- `VISUAL_SPECS.md` §2.2 esteso, ai sensi di §7: nessun colore, componente o dimensione nuovi
  rispetto a §2/§2.1, riuso integrale di `elencoGiorni`.

## 2026-08-02 — feat-dal-giorno-d-archivio-si-salta-a-qualunque-data
- `archivi.js`: estratta `elencoGiorni(id, date, dataCorrente)`, condivisa fra `renderElenco` (che
  la usava già, inline) e `renderGiornoArchivio` — dalla pagina di un giorno si salta ora a
  qualunque altra data del canale in un clic invece di sfogliare precedente/successivo N volte.
- La voce del giorno mostrato nell'elenco è testo non cliccabile con `aria-current="page"` (mai un
  link verso la pagina in cui si è già), mantenendo comunque il link di salvataggio `↓`.
- CSS `details.giorni` spostato da `ARCHIVI_STYLE` a `BASE_STYLE` (condiviso dalle due pagine):
  nessun token nuovo, solo la stessa regola resa visibile anche su `/archivi/<id>`.
- `VISUAL_SPECS.md` §2.2 aggiornato con il bullet del componente, ai sensi di §7.

## 2026-08-02 — feat-il-giorno-d-archivio-si-apre-dentro-il-sito
- Nuova pagina `/archivi/<id>[?date=]` (`renderGiornoArchivio` in `archivi.js`): mostra il
  wallpaper del giorno con data, canale e comandi «giorno precedente / successivo», invece dello
  scaricare i vecchi archivi a un vicolo cieco — prima ogni link di `/archivi` (copertina, "Riapri
  l'ultimo giorno", ogni data dell'elenco espandibile) puntava al binario grezzo di `/w/`, senza
  titolo, data né modo di continuare a sfogliare se non col tasto indietro del browser.
- `/archivi` ora fa puntare a `/archivi/<id>?date=…` gli stessi tre link; il link "Salva" (`&dl=1`)
  resta su `/w/…`, perché è un download e non una pagina.
- Nessuna scansione globale: le date del canale arrivano da `listArchiveDates` (per-canale, come
  `/feed/<flusso>.xml`), e il soggetto da `cartaDiIdentita` — nessuna funzione nuova, solo riuso.
- Id sconosciuto, canale senza archivio, `?date=` malformata o non presente in archivio: pagina
  HTML 404 con link a `/archivi`, mai JSON né la pagina d'errore generica di Cloudflare.
- `VISUAL_SPECS.md` §2.2: nuova sottosezione per la pagina, che riusa senza eccezioni i token già
  in vigore per `/archivi` (§2.1) — nessun colore o componente nuovo.

## 2026-08-02 — feat-condividere-un-giorno-d-archivio-mostra-quel-giorno
- `metaAnteprima` (`head.js`): `condiviso` e `percorso` ora si compongono invece di escludersi —
  l'`og:url` segue sempre `percorso` quando presente (anche con `condiviso` valorizzato), così una
  pagina con un indirizzo proprio dichiara quell'indirizzo invece di ricadere sulla home.
- `renderGiornoArchivio` (`archivi.js`) passa `{ canale: id, data }` a `metaAnteprima`: chi
  condivide il link di un giorno d'archivio ora vede in anteprima proprio quel wallpaper, non il
  wallpaper di oggi del canale natura (bug ereditato dalla pagina nata al ciclo precedente).
  Home, `/aiuto` e `/archivi` restano invariati: nessuno dei loro chiamanti passa entrambi gli
  argomenti.

## 2026-08-02 — feat-riscopri-un-giorno-a-caso
- Nuovo comando ghost `#dayrand` ("🎲 un giorno a caso") nella fila dei comandi di "Il viaggio
  finora": con centinaia di giorni in archivio, chi non sa cosa rivedere oggi non aveva nessun
  modo di farsi sorprendere — le frecce muovono di un giorno alla volta, `#dayPick` richiede di
  sapere già quale data cercare.
- Nuova funzione pura `scegliGiornoACaso(date, dataCorrente, sorteggio)` in `page.js`: pesca una
  data diversa da quella mostrata dall'archivio noto del canale (sorteggio iniettabile, default
  `Math.random`, `null` sugli input degenerati). Il click riusa `goToArc` — lo stesso percorso di
  salto di `#dayPick`, `#arclist` e dell'elenco dei preferiti, nessuna seconda implementazione.
- `renderJourney` mostra `#dayrand` con lo stesso `hasJourney` degli altri comandi, IN AND con
  l'archivio noto (arcsCache appiattito) che conta almeno 2 date: con una sola data conosciuta
  non c'è nessun altro giorno da riscoprire.
- VISUAL_SPECS §1.4: paragrafo nuovo per `#dayrand`, nessun colore/token/misura nuovo (pill
  `.btn.ghost` già canonica). Baseline `home-mobile.png`/`home-desktop.png` rigenerate contro il
  dev server locale (wrangler dev, KV locale) — cambio visivo dichiarato dal piano.

## 2026-08-01 — feat-l-aiuto-resta-leggibile-anche-se-non-l-hai-mai-aperto
- Il service worker conserva `/aiuto` già alla propria installazione (`PRECACHE` in
  `backend/src/sw.js`, ascoltatore `install` in `event.waitUntil`): prima si poteva rivedere una
  pagina offline solo se già visitata online, ma /aiuto è esattamente la pagina che serve quando
  qualcosa non va (spesso la rete stessa) — chi installa l'icona e va offline prima di averla mai
  aperta oggi trovava la pagina d'errore del browser sulle istruzioni per rimediare.
- Ogni voce di `PRECACHE` è protetta da un try/catch proprio (nessun `cache.addAll`, che fallisce in
  blocco): una rete assente durante l'installazione non impedisce l'attivazione del worker né la
  conservazione delle altre voci. `self.skipWaiting()` resta fuori dalla `waitUntil`.
- `/` e i wallpaper restano fuori dal precaching: sono contenuto del giorno, dinamico — congelarlo
  all'installazione mostrerebbe un giorno sbagliato. Comportamento network-first invariato.

## 2026-08-01 — feat-condividi-l-immagine-del-giorno
- Nuovo comando ghost `#dayshareimg` ("condividi l'immagine") accanto a "salva l'immagine": passa
  il file JPEG del giorno mostrato al foglio di condivisione di sistema (Web Share API con `files`)
  invece del solo link — il caso d'uso reale è mandare il wallpaper in chat senza doverlo prima
  salvare e riallegare a mano.
- Il file condiviso è ricavato ridisegnando su un `<canvas>` l'immagine già a schermo nella card in
  cima (`catturaFrameCorrente`), non riscaricandola: la guardia anti-ciclo-77 ammette una sola
  occorrenza di `fetch(` in tutta la pagina, già occupata dall'archivio, e questa via è anche più
  veloce (nessuna seconda richiesta di rete per un'immagine già arrivata).
- Visibile solo quando `navigator.share`/`navigator.canShare({files})` dichiarano supporto (valutato
  una sola volta in `supportaCondivisioneFile`, in try/catch): invisibile nel Chromium headless di
  `visual-check`, che non implementa `canShare` — nessuna baseline da rigenerare.
- Robustezza: annullamento dell'utente (`AbortError`) silenzioso, qualunque altro errore (immagine
  non ancora pronta, `toBlob` nullo, `share` che lancia) ripiega su `shareLink()` (copia link, il
  comportamento di oggi); il bottone si disabilita durante l'operazione per impedire il doppio tocco.

## 2026-08-01 — feat-i-preferiti-si-rivedono-anche-senza-rete
- I giorni segnati preferiti ora restano leggibili offline: al momento del toggle, page.js chiede
  al service worker (postMessage, non una seconda fetch in pagina) di conservare `/w/<canale>?date=<data>`
  — la forma esatta con cui il pannello preferiti riapre i giorni (page.js:1082), diversa da quella
  già in cache passivamente (`?v=<oggi>`), da cui il cache miss che perdeva il giorno preferito.
- Direzione diversa dal tentativo fallito del ciclo 111 (che rompeva la guardia anti-ciclo-77 con una
  seconda `fetch(` nell'HTML reso): qui la fetch di conservazione vive dentro sw.js (ascoltatore
  `message`), riusando `inCache` come unico punto di verità per gli URL ammessi.

## 2026-08-01 — feat-l-aiuto-spiega-cosa-funziona-senza-rete
- I cicli 104-109 hanno costruito il comportamento «app installata senza rete» (manifest,
  service worker network-first, riga di stato sulla home), ma /aiuto non ne parlava: chi tocca
  l'icona in metropolitana non sapeva se avrebbe visto l'ultima copia, un errore o nulla.
- Estesa la FAQ esistente «Quanto costa?» (`backend/src/help.js`) con un capoverso finale:
  aggiunta alla schermata Home, ArtiPop riapre senza rete l'ultimo giorno già visto; le pagine
  mai aperte prima non ci sono; l'immagine nuova arriva al ritorno della connessione. Nessuna
  voce nuova, nessun componente: solo testo dentro un `<details>` già presente, aspetto della
  pagina invariato.

## 2026-08-01 — feat-la-home-dice-quando-sei-senza-rete
- Chi apre l'app installata senza rete vedeva la copia in cache identica all'originale ma con
  l'archivio muto (`/api/*` esclusa dalla cache del ciclo 108): ora una riga `.hint` sotto
  `#nextdrop` compare quando `navigator.onLine` è `false` e spiega che si guarda l'ultima copia
  salvata — sparisce da sola al ritorno della rete, senza ricaricare la pagina.
- Nessun `fetch` di sondaggio: solo gli eventi `online`/`offline` del browser. Online e senza JS
  la riga resta `hidden`, quindi la home non cambia aspetto (baseline visive invariate).

## 2026-08-01 — feat-aggiungi-artipop-alla-schermata-home
- Chi apre ArtiPop da telefono ogni giorno può ora installarlo sulla schermata Home invece di
  tenerlo in un tab del browser: nuove rotte pubbliche `GET /manifest.webmanifest` e
  `GET /icona.svg` (`backend/src/manifest.js`), e nuovi tag in `<head>` (manifest, `theme-color`,
  meta Apple) esposti da `INSTALL_TAGS` in `backend/src/head.js` e inseriti nelle quattro pagine
  HTML del worker (`/`, `/aiuto`, `/archivi`, pagina 404).
- L'icona è la stessa `ICON_SVG` già disegnata per la favicon (estratta come costante condivisa,
  nessun disegno nuovo); `theme_color`/`background_color` riusano il token `--bg` #0a0b10 di
  VISUAL_SPECS §1.1, nessun colore nuovo.
- Limite dichiarato: su iOS l'icona della schermata Home resta lo screenshot finché non esiste un
  `apple-touch-icon` PNG — fetta separata, non in questo ciclo. Questo ciclo porta comunque
  l'apertura a tutto schermo e il nome breve su iOS, e anche l'icona su Android/desktop.

## 2026-08-01 — feat-l-aiuto-spiega-i-giorni-preferiti
- Il tentativo precedente (ciclo 101) provava ad aggiungere una voce nuova all'accordion di /aiuto
  e cadeva su un conteggio (15) blindato da asserzioni hardcoded in sei file di test: revert
  obbligato. Questa versione non tocca il conteggio — arricchisce la risposta già esistente della
  FAQ «Che fine fanno gli sfondi vecchi?» (`backend/src/help.js`), la casa naturale del tema.
- La voce ora spiega come segnare un giorno con «☆ segna preferito», dove rivederli (pannello
  «i tuoi preferiti»), che la memoria è nel localStorage per canale solo su quel
  dispositivo/browser, e come portarli su un altro telefono col link di trasferimento introdotto
  nel ciclo precedente. Nuovo test `aiuto-preferiti.test.js`, nessuna baseline visiva toccata
  (accordion chiuso di default).

## 2026-08-01 — feat-l-aiuto-spiega-come-aggiungere-artipop-alla-home
- Il ciclo 105 (planner opus) provava ad aggiungere una voce FAQ nuova e cadeva sullo stesso
  conteggio blindato (15) di sei test preesistenti: revert obbligato, escalation a fable. Questa
  versione non tocca il conteggio — riscrive la risposta della FAQ esistente «Quanto costa?»
  (`backend/src/help.js`), che dal ciclo 104 (manifest e tag d'installazione) era rimasta
  incoerente: affermava ancora «non c'è app da installare».
- La risposta ora chiarisce che non serve installare nulla per usare ArtiPop, ma spiega come
  aggiungerlo alla schermata Home su iPhone/iPad (Safari → Condividi → «Aggiungi a schermata
  Home») e su Android (Chrome → menu ⋮ → «Aggiungi a schermata Home»). Nuovo test
  `aiuto-installazione.test.js`, nessuna baseline visiva toccata (accordion chiuso di default).

## 2026-08-01 — feat-porta-i-tuoi-preferiti-su-un-altro-telefono
- I giorni segnati preferiti (ciclo 98) vivevano solo nel localStorage del browser: cambiando
  telefono, o svuotando i dati di Safari, si perdevano senza preavviso e senza modo di rifarli.
- `page.js`: il pannello «i tuoi preferiti» (`#favlist`) ha ora, come ultima riga, un comando che
  copia un link `?c=<canale>&fav=<date>` con tutte le date preferite del canale (`linkPreferiti`).
  All'avvio, se l'indirizzo porta un parametro `fav`, `importaPreferiti` ne applica le date valide
  al canale mostrato: unione con i preferiti già presenti, mai sostituzione, così riaprire lo
  stesso link non produce doppioni. Nessun bottone nuovo in barra comandi, nessuna nuova classe
  CSS: solo `.arcrow`/`.arcdate`/`.arctext` già in VISUAL_SPECS §1.4.

## 2026-08-01 — feat-il-feed-racconta-il-giorno
- L'`<item>` del feed RSS (`/feed/<flusso>.xml` e `/feed.xml`) portava solo un `<img>` muto: il
  racconto del giorno e la posizione nell'arco, che la home sa già mostrare, non arrivavano a chi
  segue ArtiPop da un lettore di feed.
- `feed.js`: la `description` aggiunge ora, quando la carta d'identità della voce li porta, un
  paragrafo col racconto della tappa (`testoTappa`) e uno con la posizione nell'arco (`arco` +
  `giornoNellArco`, in forma «arco N, giorno M»). Ogni pezzo è opzionale e indipendente: un giorno
  ricostruito di canale storico (dove questi campi sono `null` per contratto) produce la stessa
  description di sempre, solo `<img>`. `escXml` sul testo interpolato neutralizza anche `]]>`
  (ogni `>` diventa `&gt;`), che altrimenti chiuderebbe il CDATA in anticipo.

## 2026-08-01 — feat-l-aiuto-spiega-il-feed-del-canale
- `/aiuto` non nominava mai la rotta `/feed/<canale>.xml` pubblicata nel ciclo precedente: chi non
  usa la Shortcut non aveva modo di scoprire dal sito che può seguire il canale da un lettore RSS.
- `help.js`: la risposta della FAQ esistente «Posso cambiare canale?» si arricchisce con un
  paragrafo finale che spiega `/feed/<canale>.xml` (esempio `/feed/natura.xml`, ultimi 20 giorni,
  funziona anche coi vecchi indirizzi dei canali rinominati). Nessuna domanda toccata, nessuna
  voce FAQ aggiunta o rimossa: il conteggio delle 15 voci e gli id delle ancore restano identici,
  così i test di conteggio esistenti (`aiuto-ancore`, `aiuto-archivi`, `aiuto-ricerca`,
  `aiuto-viaggio`) non si toccano.

## 2026-08-01 — feat-condividere-aiuto-e-archivi-mostra-l-anteprima
- Chi mandava in chat il link di `/aiuto` o di `/archivi` — i due modi in cui ArtiPop si passa fra
  persone, "ti spiego come si installa" e "guarda i canali vecchi" — vedeva arrivare un link nudo:
  solo la home aveva i tag Open Graph/Twitter Card, quindi chi riceveva il link non capiva cosa
  stava per aprire.
- `head.js`, `metaAnteprima`: nuovo parametro opzionale `percorso`, usato solo nel ramo senza
  `condiviso` per comporre `og:url` come `${origin}${percorso}` invece della sola origin — un
  `og:url` che punta sempre alla home mentre si condivide un'altra pagina è peggio dell'assenza
  del tag. Omesso, la home non cambia di una virgola.
- `archivi.js`/`help.js`, `renderArchiviPage`/`renderHelpPage`: nuovi parametri opzionali `origin`
  e `dataOggi` che, se entrambi presenti, aggiungono `metaAnteprima(...)` nel `<head>` riusando
  alla lettera `<title>` e `<meta name="description">` già presenti nella pagina. Le pagine
  d'errore (`renderPaginaNonTrovata`, `renderErroreTemporaneo`, `renderShortcutMancante`) restano
  senza tag `og:`: non si condividono, un'anteprima lì sarebbe grasso.
- `index.js`: le rotte `/aiuto` e `/archivi` passano `url.origin` e `todayKey()` (già disponibili
  nello scope) alle due funzioni di rendering.

## 2026-08-01 — feat-la-home-si-vede-anche-senza-javascript
- Chi apre ArtiPop col JavaScript bloccato (content blocker, Lockdown Mode, proxy aziendali)
  vedeva un riquadro vuoto: il deck dei canali è costruito interamente lato client
  (`<div id="deck">` vuoto nel markup). Il server ha già in mano tutto il necessario
  (`renderPage` riceve i `metas` di ogni canale), quindi ora emette un `<noscript>` statico
  con nome, wallpaper di oggi e link alla Shortcut di ogni canale attivo, più i rimandi a
  `/aiuto` e `/archivi`.
- `page.js`, `noscriptBlocco()`: nuova funzione che costruisce il blocco a partire da
  `ACTIVE_CHANNELS` e `metas`; senza meta (o senza data) la voce resta valida ma senza
  `<img>`/`?v=`, mai un src verso un giorno inesistente. Aggiunta anche `esc()` (come in
  `archivi.js`/`help.js`) usata solo qui: i campi del template client-side restano invariati,
  come da nota nel file.
- Il blocco è invisibile e senza costo di rete quando il JS gira (il browser non renderizza
  né scarica `<noscript>`), quindi le baseline visive non cambiano — solo i token §1.1 e i
  tap target da 44px già in uso. Nuovo paragrafo «Ripiego senza JavaScript» in VISUAL_SPECS §1.4.

## 2026-08-01 — feat-l-archivio-storico-si-legge-anche-con-lo-screen-reader
- Su /archivi ogni card ripeteva link identici fra loro ("Riapri l'ultimo giorno", "Salva",
  l'immagine di copertina che duplica lo stesso link) senza dire di quale canale parlava: chi usa
  uno screen reader sentiva la stessa coppia di annunci per ogni riga della lista, senza modo di
  distinguerle.
- `archivi.js`, `renderElenco`: `a.copertina` (link-immagine duplicato di `a.riapri`, stessa
  destinazione) nascosto alle tecnologie assistive con `aria-hidden="true" tabindex="-1"` (tecnica
  WCAG standard per link ridondanti); `a.riapri`, `a.salva` e il `summary` dell'elenco giorni
  hanno ora un `aria-label` che include l'id del canale (e per il summary anche il conteggio, con
  lo stesso plurale del testo visibile) — id sempre passato da `esc()`.
- Nessun cambio a CSS, testo visibile o struttura dei tag: il diff tocca solo attributi, l'aspetto
  della pagina resta identico (VISUAL_SPECS.md non toccato).
- Nuovo `archivi-accessibile.test.js` copre i quattro criteri più i casi `storici=[]`/`null`;
  aggiornata l'unica asserzione esatta rotta dal nuovo attributo in `archivi-salva.test.js`.

## 2026-08-01 — feat-l-archivio-storico-dice-cosa-si-vedeva
- Su /archivi ogni card di un canale storico mostrava solo un id tecnico ("neon", "atelier",
  "island"): la pagina diceva quanti giorni conserva e quando, ma mai COSA si vedeva — l'unica
  informazione che decide se vale la pena riaprire quell'archivio.
- `handlers.js`: estratta `cartaDiIdentita(env, canale, data)` dalla riga già presente dentro
  `archivioCanale` (KV `giorno:<canale>:<data>` con ripiego sulla ricostruzione onesta per i
  canali a tema fisso) — una sola fonte di verità, riusata sia da `/api/archive/<canale>` che
  dal nuovo arricchimento di /archivi. Nessun cambio di comportamento per la rotta esistente.
- `index.js`, rotta `/archivi`: dopo aver costruito l'elenco, ogni voce viene arricchita col
  soggetto (`elementNome`/`conceptNome`) dell'ultimo giorno via `cartaDiIdentita`, in un
  `try/catch` proprio e separato dalla scansione KV — un guasto qui lascia la pagina identica a
  prima (elenco completo, senza soggetto), mai un 500.
- `archivi.js`: nuova riga `<div class="soggetto">` sotto riga1, «{element} · {concept}» (un solo
  nome se l'altro manca), emessa solo quando almeno un nome è disponibile — card senza dati resta
  identica a quella del ciclo 86, mai un contenitore vuoto o un `·` orfano.
- VISUAL_SPECS §2.1 aggiornata (proposta ai sensi di §7): componente «riga del soggetto», stessi
  token già in uso nella sezione (`#9aa3b8`, `.88rem`) — nessun colore o misura nuovi.
- Nuovo `archivi-soggetto.test.js` (unit, puro su `renderArchiviPage`) e `archivi-rotta.test.js`
  esteso (integrazione, KV con e senza carta d'identità, guasto durante l'arricchimento).

## 2026-08-01 — feat-il-giorno-d-archivio-si-salva-con-un-nome-che-si-capisce
- La rotta `/w/<id>?date=…&dl=1` produce da tempo un download col nome parlante
  `artipop-<canale>-<data>.png` (content-disposition, index.js:616), ma su /archivi non era
  raggiungibile da nessuna parte: chi riapriva un canale storico riceveva un PNG nudo e per
  tenerselo doveva arrangiarsi col menu contestuale del browser.
- `archivi.js`: aggiunto un link "Salva" in `riga2` accanto a "Riapri l'ultimo giorno →" (presente
  solo con `ultima` valorizzato) e un link "↓" (con `aria-label` che nomina la data) accanto a ogni
  voce dell'elenco `<details class="giorni">`. Entrambi riusano la rotta esistente, nessuna logica
  nuova lato server. `riga2` ora va a capo (`flex-wrap: wrap`) sui viewport stretti invece di
  comprimere i link.
- VISUAL_SPECS §2.1 aggiornata (proposta ai sensi di §7): componente «link di salvataggio»,
  stessi token già in uso nella sezione (link `#8fd3ff`, area di tocco ≥44px) — nessun colore o
  componente nuovo.
- Nuovo `archivi-salva.test.js`: presenza/conteggio dei link con `dl=1`, assenza quando
  `ultima`/`date` mancano, invarianti di robustezza (`null`, lista vuota) e assenza di `<script>`.

## 2026-08-01 — feat-l-aiuto-dice-dove-sono-finiti-i-canali-vecchi
- Chi cercava un canale rinominato o sostituito (island, bloom, studio, neon, …) non trovava in
  /aiuto nessuna traccia di dove fosse finito: la pagina /archivi che li elenca con i loro eredi
  esisteva già ma non era collegata da nessuna parte nell'aiuto.
- `help.js`: la voce FAQ esistente «Che fine fanno gli sfondi vecchi?» ora rimanda a
  `<a href="/archivi">Archivi storici</a>`, spiegando che anche i canali non più attivi restano
  sfogliabili lì. Nessuna voce nuova (il conteggio di 15 <details> è un invariante asserito da più
  test di regressione), solo testo dentro un accordion chiuso di default: nessun impatto visivo.
- Nuovo `aiuto-archivi.test.js`: verifica il link, il conteggio invariato e l'id/permalink
  invariato della voce arricchita.

## 2026-08-01 — feat-l-archivio-storico-si-riconosce-a-colpo-d-occhio
- Su /archivi ogni canale storico era identificato dal solo id testuale (island, bloom, studio,
  neon, …): id che non esistono in CHANNELS (solo in LEGACY_ALIASES), quindi senza nome né emoji.
  Chi riapriva un vecchio archivio doveva indovinare com'era il canale invece di vederlo.
- `archivi.js`: ogni card mostra ora una miniatura dell'ultimo giorno del canale, riusando
  l'immagine già servita e cacheata da `/w/<id>?date=<ultima>` — nessuna generazione nuova, nessun
  dato nuovo (`ultima` era già nel payload). `loading="lazy"` per non scaricare più immagini
  960×2048 in una volta. Assente quando il canale non ha un `ultima`: mai un contenitore vuoto.
- VISUAL_SPECS §2.1 aggiornata (proposta ai sensi di §7): componente «miniatura di copertina»,
  60×128, stessi token di bordo/raggio/sfondo già in uso nella sezione — nessun colore nuovo.
- Nuovo `archivi-copertina.test.js`: presenza/assenza della miniatura, escaping di id/data
  nell'`src`, invarianti di robustezza (lista vuota, scansione fallita) e assenza di `<script>`.

## 2026-08-01 — feat-la-home-mostra-il-giorno-nuovo-quando-torni
- Chi lascia la scheda della home aperta (sera prima, telefono in tasca) al ritorno la ritrovava
  ferma al wallpaper di ieri, ancora etichettato "oggi": `TODAY` è una costante congelata dal
  server e nulla la rivedeva finché non si ricaricava a mano — disattendendo la promessa fatta
  dal conto alla rovescia ("il wallpaper cambia da solo ogni notte").
- `page.js`: aggiunta `giornoNuovoDisponibile(todayServito, ora)`, pura, che confronta la data UTC
  corrente per valore (non per differenza numerica, regge il cambio di mese/anno) e verifica che
  l'ora UTC abbia già superato `ORA_CRON_UTC` — prima di quel momento il cron non ha ancora
  consegnato e un reload mostrerebbe un canale "in ritardo" al posto del giorno di ieri.
- Un solo listener `visibilitychange` chiama la funzione al ritorno in primo piano e ricarica solo
  se serve; nessun polling, nessun timer nuovo. Se l'utente sta esplorando un giorno d'archivio
  (`previewDate` diverso da oggi) il reload è sospeso per non perdere la sua posizione nel viaggio;
  il corpo è avvolto in try/catch così un errore qui non rompe il resto dello script.

## 2026-08-01 — feat-il-viaggio-si-sfoglia-senza-attesa
- Sfogliare "Il viaggio finora" era il gesto più frequente della navigazione appena costruita
  (cicli 62-78) ma anche il più lento: `previewDay` scaricava il giorno richiesto SOLO quando
  l'utente lo chiedeva, con la card ferma all'opacità precedente finché il PNG da 960×2048 non
  arrivava — attrito pagato a ogni singolo passo, soprattutto da mobile in mobilità.
- `page.js`: aggiunta `precaricaAdiacenti(chId, date)`, che precarica in silenzio solo i due
  giorni immediatamente adiacenti a quello mostrato (mai l'arco intero, per non far pagare a chi
  apre il viaggio e non lo sfoglia il peso di tutte le immagini) usando `new Image()` — mai
  `fetch`, per non rompere la guardia `fetches.length === 1` di altri test. Un `Set` a livello di
  modulo evita di richiedere due volte lo stesso URL nella stessa visita; il corpo è avvolto in
  try/catch perché un precaricamento è un lusso, non deve mai poter interrompere lo sfoglio.
- Chiamata da `previewDay` (dopo ogni cambio di giorno) e da `renderJourney` su `TODAY` (quando il
  viaggio è sfogliabile), così anche il primissimo passo dell'utente parte già precaricato.

## 2026-08-01 — feat-il-viaggio-si-racconta-anche-a-chi-non-vede
- Chi sfoglia il viaggio con VoiceOver/TalkBack non aveva modo di sapere quale giorno stava
  guardando: `previewDay()` aggiornava `top.src` ma mai `top.alt` (restava quello statico
  "wallpaper di oggi" anche su un giorno di tre archi fa), e il cambio di `#ddate`/`#dpos` non
  veniva mai annunciato — le frecce hanno già `aria-label`, mancava solo l'esito dell'azione.
- `page.js`: aggiunti `aria-live="polite"` e `aria-atomic="true"` sul contenitore `.dayinfo` di
  `#daynav`, così l'aggiornamento di `updateDayNav()` viene letto dagli screen reader.
- Estratta la formula della descrizione del wallpaper in `descrizioneWallpaper(ch, date, isToday)`,
  riusata sia da `cardHTML()` (alt iniziale, comportamento invariato) sia da `previewDay()`, che ora
  assegna `top.alt` dentro `pre.onload`, sotto la stessa guardia `pendingPreviewSrc` già presente.
  Il ramo `pre.onerror` non tocca `alt`: l'immagine mostrata resta quella precedente, quindi la sua
  descrizione deve restarlo anche lei.
- Nessun cambiamento d'aspetto: solo due attributi ARIA e un refactor JS, `VISUAL_SPECS.md` invariato.

## 2026-08-01 — feat-il-link-condiviso-apre-il-giorno-anche-di-un-arco-passato
- Un link condiviso (`/?c=<canale>&d=<data>`) veniva onorato solo se la data cadeva nella finestra
  dell'arco in corso: qualunque link riletto più di ~7 giorni dopo (il caso normale) veniva scartato
  in silenzio, e chi lo apriva vedeva il timelapse di oggi senza sapere perché — un link che il sito
  stesso produce e di cui genera l'anteprima social, ma poi non onora.
- `page.js`: `goToArc` accetta ora un terzo parametro opzionale `dataTarget` per posizionarsi su una
  data precisa dell'arco di destinazione (senza il parametro il comportamento resta invariato).
  `renderJourney`, quando la data condivisa non è nella finestra corrente, la cerca in `arcsCache` e
  salta all'arco che la contiene, fermo su quel giorno (nessun autoplay, come per il caso già gestito);
  se la data non è in nessun arco archiviato, un `toast` lo dice esplicitamente invece di tacere.
- Nessuna nuova fetch: `arcsCache` è già popolato da `loadArchive` per ogni canale.

## 2026-08-01 — feat-i-vecchi-indirizzi-aprono-il-canale-erede
- Un link con un vecchio nome di canale (`?c=island`, `?c=studio`, …) apriva la home sul canale
  di default, ignorando l'alias: `channels.js` dichiara che quegli indirizzi "devono continuare a
  funzionare per sempre" e ogni rotta di generazione già li risolve, ma la home no — chi ha una
  Shortcut vecchia o un link salvato arrivava su un canale che non aveva chiesto, senza avviso.
- `page.js`: iniettata la mappa `LEGACY_ALIASES` nello script client (`ALIAS`); il blocco che legge
  `?c=` ora tenta la traduzione via alias solo se l'id non è già un flusso attivo, e conserva
  `pendingSharedDate` quando la traduzione riesce (la guardia esistente in `renderJourney` scarta
  da sé un giorno assente dall'archivio del canale erede).
- `index.js`: `risolviCondiviso` accetta anche un alias storico (via `resolveChannel`), ma l'og:image
  continua a leggere l'archivio dell'id RICHIESTO, non del canale erede — coerente con `/w/<alias>`
  che serve già l'archivio storico intatto.
- Nessuna modifica visiva: la home apre semplicemente un'altra card in cima, nessuna baseline
  toccata.

## 2026-08-01 — feat-il-titolo-della-scheda-dice-cosa-guardi
- Il titolo della scheda del browser (`<title>`) era una costante scritta una volta in `page.js` e
  mai toccata dal JS client: chi apriva due canali in due schede vedeva due etichette identiche, un
  segnalibro su un giorno condiviso non diceva né canale né data, e la cronologia era una colonna di
  righe uguali. È anche l'unico segnale che gli screen reader annunciano quando la vista cambia senza
  cambiare pagina.
- `page.js`: nuova `aggiornaTitolo()`, che legge `TITOLO_BASE` da `document.title` all'avvio (mai
  duplicata a mano, così non si disallinea dal `<title>` server-side) e compone canale in cima al
  deck + giorno guardato (via `fmtDataEstesa`, quando `previewDate` è valorizzato) o solo canale
  (giorno corrente); ripiego esplicito a `TITOLO_BASE` se il canale non è determinabile.
  L'assegnazione è dentro un try/catch: un errore sul titolo non può mai interrompere il resto
  dell'aggiornamento della vista.
- Chiamata da `updateChrome()` (cambio canale) e `updateDayNav()` (cambio giorno): tutti i percorsi
  che cambiano cosa si sta guardando (deck, frecce, dots, drag, tastiera, salto d'arco, "torna a
  oggi", riproduzione, giorno condiviso) convergono lì.
- Nessuna modifica visiva: `document.title` non è renderizzato nel viewport, nessuna baseline
  toccata.

## 2026-08-01 — feat-cerca-il-tuo-problema-nell-aiuto
- `/aiuto` ha 14 voci tutte chiuse per default e il sottotitolo promette «Cerca il tuo sintomo
  qui sotto», ma finora nessuno strumento manteneva quella promessa: bisognava aprire le
  `<details>` una alla volta per trovare il proprio caso.
- Nuovo campo `<input type="search">` nell'header, sotto il sottotitolo: filtra le voci mentre si
  scrive, cercando anche dentro sintomo, causa e rimedio. Nasce `hidden` nel markup servito e
  compare solo se lo script della pagina gira (progressive enhancement): senza JavaScript la
  pagina resta identica a prima (robustezza, principio 3).
- Query vuota ripristina tutte le voci e tutte le sezioni; nessuna corrispondenza mostra un
  messaggio esplicito invece di una colonna vuota. `apriDaHash()` azzera il filtro prima di
  aprire una voce, così un link permanente resta sempre raggiungibile anche a filtro attivo.
- Nessun `id`/permalink toccato. `VISUAL_SPECS.md` §2 aggiornato con il nuovo componente, che
  riusa solo token già in spec (bordo, sfondo, raggio, colori testo/placeholder, altezza minima).

## 2026-08-01 — feat-torna-a-oggi-da-qualunque-giorno
- Tutti i comandi di navigazione della home muovono di UN passo (`stepDay` un giorno,
  `goToNextArc` un arco) e `#arcnext` è nascosto quando si è già nell'arco in corso: chi è sceso
  di più giorni o più archi indietro non aveva alcun percorso diretto per tornare al wallpaper di
  oggi, doveva martellare `›` o ricaricare la pagina (principio 1, utilizzabilità reale).
- Nuovo bottone `#daytoday` ("torna a oggi") nella sezione `.journey`, stessa pill ghost canonica
  già usata da `#arcprev`/`#arcnext`/`#storytoggle` (VISUAL_SPECS §1.4): nessun colore, font o
  componente nuovo. Nasce `hidden`, quindi le baseline `home-mobile.png`/`home-desktop.png` non
  cambiano.
- `goToToday()` riporta in un solo passaggio alla finestra dell'arco in corso (indice 0, mai
  unendo archi — stessa meccanica di `goToNextArc`) e al giorno di oggi, fermando l'eventuale
  riproduzione; se il canale è in ritardo e oggi non è ancora in archivio, si ferma sul giorno più
  recente disponibile invece di puntare a una data mai archiviata.
- Visibilità governata da `updateDayNav`: nascosto solo quando si guarda già oggi nell'arco in
  corso, così resta coerente anche navigando fra archi senza duplicare logica.

## 2026-08-01 — feat-quando-arriva-il-prossimo-wallpaper
- L'orario del cron di generazione (`0 3 * * *` UTC, `backend/wrangler.jsonc`) viveva solo in
  GUIDA.md §2.2, cioè per il maintainer: chi aveva attivato la Shortcut non aveva modo di sapere
  a che ora aspettarsi il wallpaper nuovo, né dalla home né da `/aiuto`.
- Nuova riga `.hint#nextdrop` sotto le azioni: testo servito dal server indipendente dal fuso
  ("Il wallpaper cambia da solo ogni notte."), sostituito lato client da `testoProssimoWallpaper`
  con l'orario tradotto nel fuso locale del dispositivo — frase senza "oggi"/"domani" così resta
  identica per tutto il giorno (baseline visiva stabile). Se il calcolo fallisce (try/catch),
  resta il testo servito dal server: nessuna frase monca.
- `ORA_CRON_UTC` in `page.js` è specchio del cron di produzione; nuovo test
  `config-cron-coerente.test.js` lega i due valori così uno spostamento del cron senza aggiornare
  la pagina rompe la suite invece di lasciare la home a mentire.
- Nessun componente/colore nuovo: riuso di `.hint` così com'è, nessuna modifica a
  `VISUAL_SPECS.md`. Baseline `home-{mobile,desktop}.png` rigenerate contro il dev server locale
  per includere la riga in più.

## 2026-08-01 — feat-rivedi-l-arco-precedente
- `loadArchive` scaricava `?limit=30` da `/api/archive/<canale>` ma teneva solo la finestra
  dell'arco in corso (`dates.slice(0, ch.giorno)`, ciclo 47): chi aveva seguito l'arco della
  settimana scorsa non aveva più alcun modo dal sito di rivederlo, anche se i dati erano già
  scaricati e mai usati — un caso di materia prima in pagina ma irraggiungibile.
- Nuova `computeArcs(dates, cap)`, pura: raggruppa le date (dal più recente al più vecchio) in
  blocchi contigui per `conceptNome`; un giorno senza dati narrativi (giorno ricostruito) non apre
  un blocco nuovo — resta in quello in cui si trova, così un buco del cron non spezza in due la
  stessa storia. `loadArchive` la applica sull'intero archivio scaricato (`fullArchiveCache`,
  `arcsCache`) prima di restringere la finestra iniziale, comportamento invariato al primo carico.
- Nuovo bottone `#arcprev` (`.btn.ghost`, già canonica in VISUAL_SPECS §1.4) sotto il day-nav:
  visibile solo quando esiste un arco più vecchio oltre l'indice mostrato (`updateArcPrev`). Al
  click (`goToPreviousArc`) la finestra sfogliabile diventa esattamente le date dell'arco
  precedente — mai unita a quella corrente, la regola "un arco alla volta" del ciclo 47 resta
  intatta — e si posiziona sul giorno più recente del nuovo arco.
- Nessuna fetch nuova, nessuna rotta nuova: la feature lavora solo sui dati già in
  `archiveCache`/`capCache` popolati dall'unica chiamata a `/api/archive/`.
- Nuovo `backend/tests/unit/home-arco-precedente.test.js`: raggruppamento (due archi, un solo
  arco, giorno senza dati in mezzo o prima di un cambio concept) verificato eseguendo davvero
  `computeArcs` estratta dallo script, più i controlli sul markup e sul cablaggio del comando.

## 2026-08-01 — feat-torna-all-arco-in-corso
- `goToPreviousArc` (ciclo 54) apriva un vicolo cieco: incrementava `arcIndexCache[chId]` e
  sostituiva `archiveCache[chId]` con l'arco più vecchio, ma nessuna funzione lo decrementava e
  non esisteva alcun comando che riportasse avanti — chi era tornato indietro restava bloccato
  su una settimana passata (persino cambiando canale, perché `loadArchive` ricostruisce la
  finestra solo se `!archiveCache[chId]`) fino al ricaricamento della pagina.
- Nuovo bottone `#arcnext` (`.btn.ghost`, già canonica in VISUAL_SPECS §1.4) accanto ad `#arcprev`:
  visibile solo dopo essere scesi in un arco passato. Al click (`goToNextArc`, speculare a
  `goToPreviousArc`) la finestra sfogliabile risale esattamente all'arco immediatamente più
  recente — mai unita a quella corrente — e si posiziona sul giorno più recente del nuovo arco.
- `updateArcPrev` diventa `updateArcNav`: un'unica funzione governa la visibilità di entrambi i
  comandi (`arcPrevEl.hidden = idx >= arcs.length - 1`, `arcNextEl.hidden = idx <= 0`), richiamata
  da `renderJourney`, `goToPreviousArc` e `goToNextArc`.
- Nuovo `backend/tests/unit/home-arco-successivo.test.js`: markup, guardia `idx <= 0`, simmetria
  con `arcprev` sotto `updateArcNav`, nessun riferimento residuo a `updateArcPrev`. Aggiornate le
  due asserzioni di `home-arco-precedente.test.js` che citavano il vecchio nome della funzione
  (stesso comportamento verificato, solo il nome è cambiato).

## 2026-08-01 — feat-apri-il-wallpaper-del-giorno-a-schermo-intero
- Nuova ancora `#dayopen` (`btn ghost`, `target="_blank"`, `rel="noopener"`) accanto a `#dayshare`
  nella sezione «Il viaggio finora»: apre il file vero del giorno mostrato nel mockup, alla sua
  risoluzione piena — prima l'unica strada per ottenere l'immagine era conoscere a memoria la
  sintassi `/w/<canale>?date=<data>`.
- `updateDayNav()` — l'unico punto che già conosce canale e data correnti — aggancia
  `dayopen.href` a `srcFor(chId, date, date === TODAY)`: stessa URL già usata dal crossfade
  dell'anteprima, nessun calcolo nuovo.
- Visibilità legata allo stesso `hasJourney` di `#dayshare` in `renderJourney()`: nessun link
  penzolante quando non c'è navigazione fra giorni.
- Nessuna nuova regola CSS: riusa `.btn` e `.btn.ghost` già in VISUAL_SPECS §1.4.

## 2026-08-01 — feat-la-home-dice-se-il-canale-e-in-ritardo
- `renderPage` calcola `inRitardo` per ogni canale confrontando `metas[c.id]?.date` con `dateKey`:
  vero solo se esiste un meta con una data reale precedente a oggi (un canale senza meta ricade su
  `dateKey` e resta false, per non sommarsi al ripiego "in preparazione…").
- La card mostra, quando `inRitardo` è vero, una nota `.stale` (`.8rem`, `var(--dim)`, dentro
  `.cinfo` dopo `.scene`) con la data reale dell'ultima immagine, e l'`alt` del wallpaper non dice
  più "di oggi" in quel caso: prima il sito affermava sempre che l'immagine era odierna anche
  quando il cron di un canale saltava e in archivio restava solo un giorno vecchio.
- Nessuna nuova fetch/binding: il dato (`ch.date`) era già in memoria e già passato al client.

## 2026-08-01 — s-il-preview-non-puo-mai-scrivere-sul-kv-di-produzione
- Nuovo `backend/tests/unit/config-preview-isolato.test.js`: legge `backend/wrangler.jsonc` dal
  filesystem (nessuna copia inline) e verifica gli invarianti di isolamento fra `env.preview` e
  la produzione — namespace KV distinto, binding `SELF` verso `artipop-preview` (mai verso
  `artipop`), `PUBLIC_ORIGIN` preview distinto, e presenza di tutti i binding (`kv_namespaces`,
  `ai`, `images`, `services`, `vars`) dentro `env.preview` visto che wrangler non li eredita dal
  top level per un environment nominato. Prima di questo test nessuna riga della suite leggeva
  `wrangler.jsonc`: un futuro cambiamento distratto nella configurazione del cron o del deploy
  poteva far scrivere il loop autonomo sul KV di produzione senza che nulla se ne accorgesse.
  Zero generazioni AI, nessuna modifica a `wrangler.jsonc` o a `scripts/deploy.sh`.

## 2026-08-01 — s-il-deploy-punta-sempre-al-worker-configurato
- Nuovo `backend/tests/unit/config-deploy-coerente.test.js`: legge `scripts/deploy.sh` come testo
  (mai eseguito, mai modificato — file vietato) ed estrae con una regex le quattro costanti
  `WORKER_PROD`, `WORKER_PREVIEW`, `URL_PROD`, `URL_PREVIEW`, poi le confronta con `name`,
  `env.preview.name`, `vars.PUBLIC_ORIGIN` ed `env.preview.vars.PUBLIC_ORIGIN` di
  `backend/wrangler.jsonc`. Prima di questo test le due fonti (script di deploy e configurazione
  del worker) potevano divergere in silenzio: il loop avrebbe deployato un worker e fatto lo smoke
  test (o il rollback) su un altro. La regex fallisce esplicitamente se una costante non viene
  trovata, invece di confrontare due `undefined`. Zero generazioni AI, nessuna modifica a
  `wrangler.jsonc` o a `scripts/deploy.sh`.

## 2026-08-01 — s-i-ripieghi-del-generatore-sono-sotto-test
- Nuovo `backend/tests/unit/daygen-ripieghi.test.js`: `generateDay` (`backend/src/daygen.js`) è
  l'anello che decide se cron, backfill e lab producono o no l'immagine del giorno, ma nessun test
  lo chiamava mai direttamente — la strada felice di `orchestrazione.test.js` lo tocca solo di
  striscio. Ora sono coperti i quattro ripieghi che oggi nessun test esegue: keyframe senza
  riferimento a se stesso, riallineamento del keyframe accettato e scartato (misure fuori soglia),
  giorno normale senza riferimenti recuperabili (sia "nessuno dei due" sia "solo ieri manca" →
  prompt cumulativo dall'àncora), più l'invariante che lega `state.seed`/`state.dayInArc` al seme
  passato a `generateWithGate`. Zero generazioni AI reali: stub locali di `env.AI`/`env.IMAGES` che
  ricostruiscono il multipart per leggere prompt/seed/riferimenti senza mockare `generate.js`.
  Nessun difetto trovato in `daygen.js`: la suite (396 test, prima 390) è verde senza modifiche al
  modulo.

## 2026-08-01 — s-i-link-dell-aiuto-si-toccano-anche-col-pollice
- `backend/src/help.js`: `.permalink` (il `#` di ogni voce di `/aiuto`) era un glifo `.74rem` senza
  padding, ~12×19 px — sotto il minimo di 44×44 px di VISUAL_SPECS §5.5. Ora è centrato in flex con
  `min-width`/`min-height: 44px`, compensato con `margin-right: -8px` così resta otticamente dov'era;
  il `summary` è già alto ~57 px quindi la riga non cresce.
- `.back` («← torna ad ArtiPop») e i link del footer nelle quattro pagine servite dallo stesso
  modulo (`/aiuto` e le tre pagine di servizio: Shortcut non disponibile, errore temporaneo, pagina
  non trovata) erano alti ~24 px e ~22 px. Ora `.back` è `inline-flex` con `min-height: 44px` e i
  link del footer hanno `padding: 12px 6px` (~46 px effettivi), senza toccare colori, tipografia o
  design piatto (VISUAL_SPECS §2).
- Nuovo `backend/tests/unit/aiuto-tocco.test.js`: aree di tocco ≥44px sulle quattro pagine, più
  regressione sui token visivi e sui permalink esistenti (`aiuto-ancore.test.js` invariato).

## 2026-08-01 — s-ogni-voce-dell-aiuto-ha-un-indirizzo-suo
- `backend/src/help.js`: ogni voce di `/aiuto` (15 fra problemi e FAQ) ha ora un `id` stabile
  (`p-<slug>`/`d-<slug>`, derivato dal testo con `slugVoce()`) e un link permanente `#` discreto
  nel `summary`. Prima nessuna voce era indirizzabile: un link condiviso riapriva la pagina
  dall'inizio con l'accordion chiuso, senza modo di puntare alla voce giusta (principio 1).
- Script inline minimo che apre la voce corrispondente al frammento dell'URL al caricamento e a
  ogni `hashchange`, perché un `<details>` chiuso non si apre da solo alla navigazione per
  frammento. Nessuna risorsa esterna, nessuna dipendenza nuova.
- Nuovo `backend/tests/unit/aiuto-ancore.test.js`: id univoci e stabili, permalink corrispondenti,
  nessuna regressione su contenuti/token visivi.

## 2026-08-01 — s-eliminare-dal-catalogo-dice-prima-cosa-si-perde
- `tuning/js/tab-catalogo.js`: `deleteElement()`/`deleteConcept()` ora compongono il `confirm()` con
  `messaggioEliminaElement`/`messaggioEliminaConcept`, due funzioni pure che leggono `AP.store.usi` (già
  disponibile, usato da `usoElementTxt`/`usoConceptTxt`) e dicono in anticipo cosa si perde: canale di
  pubblicazione e riavvio dell'arco in corso, archi/giorni già generati (con le immagini d'archivio che
  restano), o l'assenza esplicita di uso. Prima il `confirm()` era generico e non avvisava di nulla —
  unica azione irreversibile del tool, principio 1 di CLAUDE.md.
- Nuovo `backend/tests/unit/tuning-catalogo-elimina.test.js`.

## 2026-08-01 — s-le-note-private-non-sono-piu-leggibili-da-chiunque
- `backend/src/index.js`, `GET /note`: ora richiede la chiave admin come tutte le altre rotte
  `/note*`. Prima chiunque conoscesse l'indirizzo del Worker leggeva l'intero documento
  `note:marcature` — giudizi buono/scarto con note libere fino a 500 caratteri sui giorni
  d'archivio, più tutti gli assetti di taratura salvati — un'asimmetria rimasta indietro rispetto
  alle scritture (`PUT /note/giorno`, `PUT`/`DELETE /note/assetto`), già admin-only.
- `tuning/js/tab-range.js`: in caso di 403 su `/note` il messaggio ora nomina la chiave admin
  mancante invece di suggerire un Worker vecchio che "non espone ancora /note" — il tool manda già
  `x-artipop-key` su ogni chiamata quando il campo chiave è compilato, quindi basta inserirla in
  alto per tornare a vedere giorni e assetti.
- `tuning/js/app.js`, `GUIDA.md`: tolta `/note` dall'elenco delle rotte GET pubbliche.
- Impatto sul tool: senza chiave admin inserita in alto, la tab "Range" non mostra più marcature
  né assetti salvati (comportamento voluto, non un difetto).
- Nuovo `backend/tests/integration/note-lettura-protetta.test.js`: copre 403 senza chiave, 403 con
  chiave solo in `?key=`, 403 senza `ADMIN_KEY` configurato, 200 con documento vuoto e 200 con un
  documento seminato (la nota privata è visibile solo con la chiave corretta), più `OPTIONS /note`
  invariato (204, nessuna autenticazione richiesta per il preflight).
- `backend/tests/integration/router-auth.test.js`: aggiunta `["GET", "/note"]` a `ROTTE_PROTETTE`
  (16 → 17 rotte); commento in testa corretto per contare le chiamate a `nonAutorizzato` (non
  `isAuthorized`, che è invocata una sola volta al suo interno) verificate a grep.

## 2026-08-01 — s-il-lab-non-brucia-neuroni-di-produzione-per-sbaglio
- Nuovo `tuning/js/ambiente.js` (`AP.ambiente.classifica`): riconosce se la base a cui il tool
  parla è preview, produzione o sconosciuta, confrontando l'hostname con `artipop-preview.` e con
  `AP.util.DEFAULT_BASE`.
- `tuning/js/tab-lab.js`, `eseguiRun` (unico punto da cui parte `POST /lab/arc`, condiviso dal
  bottone principale e da "↻ rigenera"): fuori da preview chiede ora una conferma esplicita che
  nomina l'host di destinazione e i giorni richiesti, prima di spendere neuroni. Perché: `/lab/arc`
  è l'unica chiamata del tool che consuma neuroni AI, dallo stesso budget del cron giornaliero di
  produzione (ROADMAP «Regole di budget AI») — un clic distratto sulla base sbagliata non deve
  poterlo intaccare in silenzio, come già valeva per "📌 Pubblica in produzione". Annullando: nessuna
  richiesta parte, nessun run entra nello storico, toast neutro "annullato".
- `tuning/index.html`: carica `js/ambiente.js` dopo `js/util.js` e prima di `js/tab-lab.js`.
- Nuovo `backend/tests/unit/tuning-ambiente.test.js`: copre `classifica()` su preview/produzione/
  input non validi e verifica a grep il cablaggio (ordine script, controllo prima della chiamata).

## 2026-08-01 — s-il-tool-dice-la-verita-quando-il-worker-non-risponde
- `tuning/js/util.js`, `api()`: la `fetch` ora è avvolta in try/catch. Se il browser la rigetta
  (Worker spento, DNS, offline, CORS) non lascia più passare nudo il "Failed to fetch" inglese fino
  al toast: rilancia un errore in italiano che nomina l'indirizzo interrogato (`err.rete = true`,
  mai la chiave admin nel messaggio).
- Stesso `api()`: una risposta `ok` il cui corpo non è JSON valido (l'indirizzo non punta a un
  Worker ArtiPop) non risolve più in silenzio con il ripiego `{ raw: txt }` — rigetta con un
  messaggio umano e `err.status`. Il ripiego `{ raw: txt }` resta solo per costruire il messaggio
  degli errori HTTP (`!res.ok`), comportamento invariato.
- Nuovo `backend/tests/unit/tuning-api-errori.test.js`: copre i tre modi in cui la chiamata può
  fallire (rete rifiutata, HTTP non ok, corpo non JSON) e le non-regressioni sul contratto esistente
  (`err.status`, `err.payload`, `errori[]` via `errFromCatch`).

## 2026-08-01 — s-uno-stato-illeggibile-non-blocca-un-flusso-per-sempre
- `backend/src/storage.js`, `getState`/`getMeta`: erano le uniche letture KV del progetto senza
  rete, fuori dal try/catch di `fetch()` (ciclo `s-rete-di-sicurezza-globale-sul-worker`, che protegge
  solo quel percorso) — una chiave `state:<canale>`/`meta:<canale>` diventata illeggibile lanciava
  da dentro `scheduled`→`fanOutAll`→`runChannel` (handlers.js:163) e bloccava quel flusso OGNI
  giorno, con il ritentativo del ciclo precedente che ripeteva lo stesso errore all'infinito. Ora
  entrambe leggono il testo grezzo e lo interpretano a parte (`parseDocumentoOggetto`): JSON non
  valido o di forma sbagliata (stringa, array) → `null` con un `console.warn`, mai un'eccezione — lo
  stato si riscrive da solo al giro successivo (auto-guarigione). Deliberatamente NON un try/catch
  attorno all'intero `env.KV.get(key, { type: "json" })` come `getGiorno`: un `KV.get` fallito PER
  INTERO (connettività, non un singolo valore corrotto) deve continuare a propagare fino alla rete
  di sicurezza globale del router, come verificato da `rete-di-sicurezza.test.js` su `/` e
  `/api/channels`.
- Nuovo `backend/tests/integration/kv-illeggibile.test.js`: valore non-JSON e JSON di forma
  sbagliata su entrambe le chiavi → `null` senza throw, documento sano invariato (regressione),
  `runChannel` su `state:<canale>` corrotto completa e riscrive uno stato leggibile, `/health` e `/`
  rispondono 200 (non la pagina d'emergenza) con le chiavi corrotte per tutti i flussi.

## 2026-08-01 — s-la-pesca-non-resta-mai-a-secco-per-una-sospensione
- `backend/src/catalog.js`, `poolForWith`: le sospensioni (`FAMIGLIE_SOSPESE`/`ELEMENT_SOSPESI`,
  config.js) sono una preferenza di TARATURA, non una guardia di sicurezza — se coprono l'INTERO pool
  pescabile di un flusso (es. `citta`, che pesca solo da `timelapse`+`attraversamento`: sospenderle
  entrambe lo svuoterebbe), prima del fix `pickConcept` lanciava e quel flusso non produceva più
  nulla, ogni giorno, per sempre, senza che il self-check di `channels.js` se ne accorgesse (usa
  `poolFor()` built-in non filtrato). Ora `poolForWith` calcola il pool unito PRIMA dei filtri e, solo
  se il pool unito non era vuoto ma i filtri lo svuotano, ripiega su quello non filtrato con un
  `console.error` che nomina il flusso e quali famiglie/element hanno morso — stessa scelta già fatta
  dal cancello di collaudo in `generate.js`: uno sfondo fuori range vale più di nessuno sfondo. Il
  caso "pool vuoto di suo" (flusso senza alcun concept) resta invariato: lì `pickConcept` continua a
  lanciare "nessun concept disponibile" (story.test.js:117-121, non toccato).
- Nuovo `backend/tests/unit/pool-mai-vuoto.test.js`: guardia sul config reale (nessun flusso attivo
  pesca da un pool vuoto), il ripiego con `FAMIGLIE_SOSPESE`/`ELEMENT_SOSPESI` mockate a coprire
  l'intero pool (sia su `citta` sia su un flusso custom senza built-in pescabili), la non-regressione
  quando la sospensione copre solo una famiglia (il filtro resta pieno, nessun ripiego) e il caso
  pool-vuoto-di-suo (`pickConcept` lancia ancora).

## 2026-08-01 — s-immagine-di-oggi-non-si-perde-se-lo-stato-non-si-salva
- `backend/src/handlers.js`, `runChannel`: avvolta la SOLA `putState` (dopo `putImage` riuscita) in
  try/catch. Prima, un `putState` fallito (KV transitorio) propagava l'eccezione: `/run/<flusso>`
  rispondeva 500, e il ritentativo del cron (ciclo 14, `fanOutAll`) richiamava `runChannel` che —
  trovando `lastDate` ancora a ieri — RIGENERAVA una seconda immagine con l'AI sovrascrivendo quella
  già pubblicata, con l'utente reale che se la vede cambiare sotto lo sfondo scaricato a giornata
  iniziata (CLAUDE.md, principio 1) e una generazione AI bruciata per niente. `putState` fallita ora
  logga (`console.error`, mai stack né variabili d'ambiente) e ritorna `statoNonSalvato: true`;
  `putImage` resta FUORI dal try/catch, invariato — se quella fallisce non c'è nessuna immagine da
  salvare e il 500 attuale resta la risposta giusta, perché è proprio quel caso che il ritentativo
  del cron deve poter riprendere. Sul percorso felice il risultato di `runChannel` non cambia di un
  byte: nessun campo nuovo, quindi `fanOutAll` (che ritenta su `status !== 200`) non ritenta più un
  canale il cui unico problema era lo stato non salvato.
- `backend/tests/helpers/fakeEnv.js`, `makeKV`: nuova opzione facoltativa `putFallisce(chiave)` per
  far fallire una singola `KV.put` per prefisso di chiave (es. solo `state:<canale>`), lasciando sane
  tutte le altre scritture. Default `() => false`: nessun comportamento nuovo per i test esistenti.
- Nuovo `backend/tests/integration/orchestrazione-stato.test.js`: `putState` guasto → `runChannel`
  non lancia, ritorna `statoNonSalvato: true` e l'immagine di oggi è in archivio (anche via
  `/run/<flusso>`, risposta 200 non 500); `putImage` guasto → `runChannel` lancia ancora (invariato);
  percorso felice → nessun campo `statoNonSalvato` nel risultato; `fanOutAll` con `putState` rotto su
  un solo canale → una sola chiamata a `/run/<canale>`, mai `ritentato`, a riprova che non si rigenera
  una seconda immagine.

## 2026-08-01 — s-cron-ritenta-una-volta-il-flusso-fallito
- `backend/src/handlers.js`, `fanOutAll`: estratta la passata singola in `unaPassata(env, canali, {
  force })`; `fanOutAll` ora fa una seconda e ULTIMA passata, solo sui canali falliti al primo colpo
  (reject o `status !== 200`) e sempre senza `force` — `/aiuto` promette il recupero "la notte
  successiva" (help.js:88), ma un errore transitorio (AI/KV, 500) lascia oggi l'utente reale sulla
  lock screen con lo sfondo di ieri per 24 ore. `runChannel` resta idempotente su `lastDate`
  (handlers.js:165-168), quindi il ritentativo non può mai produrre una seconda immagine per un
  giorno già riuscito. I canali riusciti al primo colpo restano identici a oggi, senza campo nuovo;
  quelli ritentati portano `ritentato: true`. Log onesto (`console.log`) prima della seconda
  passata con l'elenco dei canali ritentati, mai stack né variabili d'ambiente.
- `backend/tests/helpers/fakeEnv.js`, `stubSelf`: accetta ora una `fetchImpl` opzionale per simulare
  le risposte di `/run/<canale>` nei test di ritentativo, con lo stesso default "lancia se invocato"
  per tutti i test esistenti — nessuna firma cambiata.
- Nuovo `backend/tests/integration/orchestrazione-ritenta.test.js`: copre successo al primo colpo
  (nessun ritentativo), fallimento poi successo (`ritentato: true`, altri canali chiamati una sola
  volta), doppio fallimento (nessun falso successo, 2 chiamate esatte), reject al primo colpo
  (ritentato comunque, `fanOutAll` non lancia mai), e `force=1` presente solo nella prima passata.
- `GUIDA.md`: descritto il ritentativo nel diagramma del cron, nella nota "se un passaggio fallisce"
  e nella riga di `/run-all`.

## 2026-08-01 — s-element-canoa-fuori-dalla-pesca-finche-non-e-tarato
- `backend/src/config.js`: nuova `ELEMENT_SOSPESI = ["canoa"]`, stesso meccanismo di
  `FAMIGLIE_SOSPESE` ma a granularità ELEMENT — la sessione M10 ha misurato che `canoa` non passa
  il cancello nemmeno con la riformulazione delle tappe che ha invece tarato `attraversamento`
  (estensione ~33% fuori profilo, compattezza 0.35 sotto il minimo): un flusso che la pesca brucia
  tutti i tentativi dell'arco e pubblica comunque il candidato migliore, sfondo degradato per
  l'utente reale (CLAUDE.md, principio 1). `canoa` non viene rimossa dal roster: resta in
  concepts.js, in archivio e raggiungibile per id dal lab — sparisce solo dalla pesca casuale.
  Sospensione temporanea e reversibile con una riga (togliere "canoa" dalla lista) quando un arco
  lab gated su preview la riporta dentro il profilo, come già fatto per `attraversamento` in M10.
- `backend/src/catalog.js`, `poolForWith`: applica anche il filtro `ELEMENT_SOSPESI` (sull'id
  dell'element, `c.id`), nello stesso e unico punto che già filtra `FAMIGLIE_SOSPESE`. Le stesse
  due esenzioni deliberate restano aperte: la combinazione esplicita del lab (`runLabArc`, che non
  passa da `poolForWith`) e il proseguimento di un arco già aperto (`resolveConcept` da
  `evolveStory`).
- Nuovi test in `backend/tests/unit/element-sospesi.test.js`: risultato concreto su "canoa" (pool
  reale su ogni flusso attivo, `pickConcept` su una sequenza consecutiva, `resolveConcept` ed
  `evolveStory` per le esenzioni) più il collaudo del meccanismo generico con `vi.doMock` su un
  altro element, per garantire che il filtro non sia cablato sul solo id "canoa".

## 2026-07-31 — s-health-dice-se-un-flusso-e-fermo
- `backend/src/handlers.js`: nuova `buildFreschezzaState(state, oggi)`, funzione pura accanto a
  `buildCancelloState` — confronta `state.lastDate` con `oggi` (mezzogiorno UTC su entrambe le
  date, come già fa `regenDay`) e ritorna `{ ultimaData, aggiornato, giorniDiRitardo }`; mai un
  numero inventato se `lastDate` manca o non è una data riconoscibile.
- `backend/src/index.js`, rotta `/health`: ogni flusso espone ora anche `freschezza`, più
  `flussiFermi` (numero di flussi con `aggiornato:false`) al livello superiore. Prima `cancello`
  diceva solo se l'ultimo collaudo aveva misurato qualcosa — non se l'ultima generazione era di
  oggi: un flusso poteva essere fermo da giorni senza che comparisse da nessuna parte se non
  guardando la home o `wrangler tail` (CLAUDE.md, principio 3: robustezza).
- `GUIDA.md`: aggiornata la riga `GET /health` con i due campi nuovi.
- Nuovi test in `backend/tests/integration/health-ritardo.test.js` (stato preseminato in KV,
  nessuna generazione AI — budget 0/10 di questo ciclo).

## 2026-07-31 — s-guida-e-readme-allineati-al-comportamento-reale
- `README.md`: corretto "~500 neuroni/giorno" in "~600-900 neuroni/giorno" (3 canali, di più nei
  giorni di cambio base) — dato già misurato e registrato in `backend/README.md`, mai propagato al
  README pubblico. Un numero sbagliato sul budget gratuito è la cosa più costosa da avere per
  iscritto (CLAUDE.md, principio 1).
- `backend/src/config.js`: aggiornato solo il commento di `IMAGE_SIZES` ("6 canali ≈ 1.200
  neuroni" → "3 canali ≈ 600-900 neuroni"): i canali attivi sono 3 (`channels.js`), non 6. Nessun
  valore di `CONFIG` toccato.
- `GUIDA.md` §2.4: la riga `/health` ora elenca i campi realmente restituiti (`famiglie`,
  `concepts`, `cancello`, `misuratore`); `/api/channels` cita il campo `famiglie` (M7). Aggiunte le
  due rotte pubbliche mancanti dalla tabella, `/w/<flusso>` (sempre byte immagine, mai JSON, vedi
  M4) e `/s/<flusso>[-base].shortcut`.
- `GUIDA.md` §2.9: due righe nuove nel runbook — placeholder su `/w/` (canale mai generato o
  `?date=` inesistente) e pagina «errore temporaneo» (rete di sicurezza globale) — entrambe con un
  rimedio eseguibile. Chiude l'ultimo punto scoperto della DoD di produzione: i comportamenti
  pubblici introdotti dai cicli POLISH (placeholder, pagina 404/errore, cache `?v=`, campi nuovi in
  `/health` e `/api/channels`) non erano mai arrivati nei documenti.

## 2026-07-31 — s-indirizzo-sbagliato-pagina-non-json
- `backend/src/help.js`: nuova `renderPaginaNonTrovata()`, stessa struttura/token di
  `renderErroreTemporaneo()` (M6/VISUAL_SPECS §2). Un utente che sbaglia a digitare un indirizzo o
  segue un vecchio link era l'ultimo punto d'uscita pubblico rimasto a mostrare il JSON grezzo
  `{"error":"not found"}`: `/s/<flusso>.shortcut` e le rotte HTML in errore avevano già la loro
  pagina, il fallback 404 generico no (CLAUDE.md, principio 1).
- `backend/src/index.js`: il fallback 404 finale ora negozia sull'header `Accept` della richiesta —
  `text/html` risponde con la nuova pagina (stessi `SECURITY_HEADERS` di `/` e `/aiuto`,
  `cache-control: no-store`), qualunque altro caso (assente o `application/json`) lascia il corpo
  JSON invariato: nessuna rottura di contratto per i client API o la suite esistente.
- `backend/tests/integration/pagina-404.test.js`: nuovo, copre la negoziazione (HTML vs JSON vs
  Accept assente), gli header di sicurezza sulla risposta HTML e l'assenza di dettagli tecnici
  (percorso richiesto, `error`) nel corpo.

## 2026-07-31 — s-aiuto-istruzioni-che-corrispondono-alla-home
- `backend/src/help.js`: tre correzioni di testo in `/aiuto`, nessuna al di fuori dei tre punti
  citati sotto. Il rimedio di «Lo sfondo è uguale a ieri» rimandava a una «ultima miniatura» sulla
  home: la striscia di miniature è stata rimossa (resta solo data del fotogramma + posizione
  «N di M» + frecce sotto il mockup), quindi chi seguiva l'istruzione alla lettera non trovava
  nulla da guardare. La FAQ «Che fine fanno gli sfondi vecchi?» prometteva di «rivedere e
  riscaricare ogni giorno passato» dentro «Il viaggio finora», ma quell'anteprima mostra solo
  l'arco in corso (max 7 giorni): corretto per dire che l'archivio è permanente e sempre
  raggiungibile via indirizzo diretto (`?date=`), ma che «Il viaggio finora» non è quell'archivio
  integrale. La FAQ sull'orario di generazione ora dice esplicitamente «3:00 UTC» invece di «3:00»
  senza fuso, coerente con `backend/wrangler.jsonc` (`"crons": ["0 3 * * *"]`), a scanso di
  ambiguità con l'ora italiana citata subito dopo. Un'istruzione che rimanda a un elemento che la
  pagina non ha più non è un dettaglio estetico: è inutilizzabile (CLAUDE.md, principio 1).
- `backend/tests/integration/aiuto-contenuto.test.js`: nuovo, verifica che «miniatur» sia sparito
  dal testo, che la promessa di riscaricare ogni giorno passato da «Il viaggio finora» sia sparita,
  che l'indirizzo diretto d'archivio e il rimando a «Il viaggio finora» restino presenti, che la
  FAQ sull'orario nomini UTC, e che `/aiuto` resti 200/text/html con lo stesso numero di voci
  (7 problemi + 8 FAQ) — a garanzia che la correzione non abbia fatto sparire contenuto insieme
  al bug.

## 2026-07-31 — s-home-non-riscarica-i-wallpaper-a-ogni-sfogliata
- `backend/src/index.js`: `/w/<flusso>` ora legge anche `?v=<YYYY-MM-DD>` (validato come `?date=`) e
  lo usa per decidere il `cache-control` dell'immagine di oggi: `public, max-age=3600` quando `v` è
  presente e valido, invariato `no-store, must-revalidate` altrimenti. Prima l'intero ramo era
  `no-store` incondizionato — corretto per la Shortcut (deve sempre ricevere il file fresco), ma la
  home usa lo stesso indirizzo dentro il mockup e ricostruisce il deck a ogni sfogliata: senza cache
  ogni swipe riscaricava ~0,9 MB per card. Il sito già mandava `?v=<data del meta>` (page.js), solo
  mai onorato dal worker. I due rami placeholder (canale mai generato, flusso non risolvibile)
  restano `no-store` anche con `?v=`: un canale vuoto non deve restare placeholder in cache dopo la
  prima generazione (ROADMAP M4, mai JSON ma anche mai un placeholder stantio).
- `backend/src/page.js`: commento sopra `<img class="wall">` che dichiara il contratto di `?v=` per
  chi legge il codice in futuro — nessuna modifica al markup o all'URL prodotto, era già corretto.
- `backend/tests/integration/w-cache.test.js`: nuovo, copre i tre casi di cache-control (`?v=` valido,
  nessuna query = Shortcut, `?v=` malformato) più le due regressioni (`?date=` invariato, placeholder
  su KV vuoto anche con `?v=`).

## 2026-07-31 — s-rete-di-sicurezza-globale-sul-worker
- `backend/src/index.js`: l'intero corpo di routing di `fetch()` è ora avvolto in un unico
  try/catch. Prima solo le scritture admin erano protette (`scritturaProtetta`, M3): una lettura
  che lanciava (KV irraggiungibile, valore corrotto) su `/w/`, `/`, `/aiuto`, `/api/channels` e
  dintorni propagava fino a Cloudflare, che serviva la sua pagina d'errore generica 1101 — a
  `/w/<flusso>` la Shortcut riceveva HTML al posto dei byte immagine. Il catch sceglie la risposta
  in base alla rotta (`rispostaDiEmergenza`): placeholder PNG per `/w/`, HTML per le pagine
  pubbliche, JSON per l'API — mai `err.message` o stack nel corpo, solo nel log del Worker.
- `backend/src/help.js`: nuova `renderErroreTemporaneo()`, pagina 500 per le rotte HTML, stessi
  token colore e stack font di `renderShortcutMancante`/`renderHelpPage` (VISUAL_SPECS §2).
- `backend/tests/helpers/fakeEnv.js`: `kvChePerdeLeLetture`, gemello di `kvChePerdeLeScritture` ma
  per `get`/`getWithMetadata`, per esercitare la nuova rete di sicurezza nei test.
- `backend/tests/integration/rete-di-sicurezza.test.js`: nuovo file, verifica che con letture KV
  guaste nessuna rotta esploda un corpo grezzo — `/w/` resta sempre immagine, le pagine pubbliche
  restano HTML, l'API resta JSON senza fughe di dettagli tecnici.

## 2026-07-31 — s-w-flusso-sconosciuto-mai-json
- `backend/src/index.js`: `/w/<flusso>` non risponde più JSON quando l'id non è risolvibile (né
  canale attivo né alias legacy) — terzo e ultimo ramo della rotta che poteva ancora rompere la
  Shortcut "Imposta sfondo" con un errore muto (i due rami precedenti erano già chiusi da M4).
  Stesso placeholder statico già usato per canale vuoto/data inesistente, status 404 perché il
  flusso non esiste davvero, ma il corpo resta sempre un'immagine valida.
- `backend/tests/integration/orchestrazione.test.js`: il test `/w/flusso-inesistente` non verifica
  più solo `body.error` ma content-type immagine, corpo non parsabile come JSON e byte identici al
  placeholder — asserzione più stringente, non allentata.
- `backend/tests/integration/w-placeholder.test.js`: nuovo caso `/w/inventato?date=` a garanzia che
  la regola valga anche con `?date=` in coda, non solo sul percorso nudo.

## 2026-07-31 — s-shortcut-mai-json-al-browser
- `backend/src/help.js`: nuova `renderShortcutMancante(flusso)`, stessa spec visiva di
  `renderHelpPage()` (M6), con i link di download presi da `ACTIVE_CHANNELS` (mai una lista scritta
  a mano) e un rimando a `/aiuto`.
- `backend/src/index.js`: `/s/<flusso>.shortcut` non risponde più JSON grezzo quando la chiave manca
  in KV — stesso difetto già chiuso da M4 su `/w/`, lasciato aperto sulla rotta gemella di download.
  La lettura da KV è in try/catch: se il binding lancia, l'utente vede comunque la pagina 404 HTML e
  non l'errore generico di Cloudflare (principio 3). Header di sicurezza (M8) applicati anche qui.
- `backend/tests/integration/shortcut-download.test.js`: copre chiave assente, KV che lancia, e il
  ramo felice invariato byte per byte.

## 2026-07-31 — m2-recupero-suite-orfana-ciclo-3
- `backend/tests/helpers/fakeEnv.js`: KV in-memory (get/getWithMetadata/put/delete/list) più stub
  AI/IMAGES/SELF che lanciano se invocati — garanzia strutturale di zero generazioni AI nel ciclo,
  senza aggiungere alcuna devDependency (niente @cloudflare/vitest-pool-workers).
- `backend/tests/integration/router-auth.test.js`: le 16 rotte guardate da `isAuthorized` (contate a
  grep, non a memoria) rifiutano senza chiave con 403 JSON; `GET`/`PUT /tuning` hanno anche il caso
  felice autorizzato; verificato anche il rifiuto quando `ADMIN_KEY` non è configurato.
- `backend/tests/integration/router-errori.test.js`: 404 sul fallback, header CORS sul preflight di
  una rotta tool, e 400 con messaggio chiaro su JSON illeggibile o di forma incompleta per
  `/tuning`, `/catalogo/concept`, `/note/giorno`.
- `backend/tests/integration/orchestrazione.test.js`: idempotenza di `runChannel` (stesso giorno →
  `skipped: true`, generazione mai invocata) e byte-stabilità di `/w/<flusso>?date=` fra due letture
  dello stesso archivio.
- `backend/vitest.config.js`: `include` allargato a `tests/**/*.test.js` per raccogliere anche
  `tests/integration/`, finora invisibile alla suite.
- M2 chiusa in `ROADMAP.md`: era l'ultima milestone APERTA. I tre tentativi precedenti erano caduti
  per cause procedurali (perimetro dei `FILE:` dichiarati, falso negativo del parser sulla
  sentinella), mai per il merito dell'impianto di test — questo ciclo ha recuperato via cherry-pick
  (commit `c53d572`, `a095daa`) il lavoro verde e orfano lasciato dal ciclo 3, verificato con
  `git fsck` e applicato senza conflitti (`git merge-tree`), invece di riscrivere la suite da zero.

## 2026-07-31 — sprint manuale M3–M10 (su richiesta di Riccardo, fuori dai cicli del loop)

Chiusura integrale della roadmap per sbloccare la fase POLISH:
- **M3** — scritture admin sotto `scritturaProtetta`: KV che fallisce → 500 JSON umano,
  mai l'error page di Cloudflare; `/lab/img` protetta da chiave (tuning tool adeguato:
  la passa in query, un tag img non può portare header).
- **M4** — `/w/<flusso>` senza immagine risponde col placeholder 960×2048 (gradiente
  della lockscreen del sito): una Shortcut non riceve mai JSON.
- **M5** — stato del cancello (`attivo/tentativi/verdetto`) salvato nello stato canale
  ed esposto in `/health`: il collaudo non si spegne più in silenzio.
- **M6** — `/aiuto` allineato ai token del sito (#f2f3f8, SF Pro Display, dim #9aa3b8).
- **M7** — `famiglie` in `/api/channels` era già implementato: blindato con regressione.
- **M8** — nosniff, Referrer-Policy e X-Frame-Options DENY su `/` e `/aiuto`; niente CSP
  per scelta (essenzialità).
- **M9→M10** — `attraversamento` prima sospesa dai pool, poi tarata sul lab preview
  (tappe erase-and-repaint, range invariati; arco gated 1.83 tent/gg) e riammessa.
  Coda dichiarata: canoa fuori range e 8 element non testati → materiale POLISH.
Suite: 94 → 181 test. Incidente rientrato: i commit dello sprint erano finiti sul branch
di un ciclo del loop avviato per errore in parallelo, recuperati integralmente dal reflog.

## 2026-07-31 — s-anteprima-e-icona-quando-il-link-viene-condiviso
- Nuovo `backend/src/head.js`: unica fonte di verità per `FAVICON_TAG` (icona SVG inline, solo
  colori `--bg`/accenti natura di VISUAL_SPECS §1.1) e `metaAnteprima()` (tag Open Graph +
  Twitter Card). ArtiPop si diffonde per link mandato a un amico: prima arrivava su
  iMessage/WhatsApp/Telegram come URL nudo, niente titolo/immagine/icona in tab.
- `backend/src/page.js`: `<head>` di `/` ora include l'icona e i tag og:/twitter:. `og:image`
  riusa `/w/natura?v=<oggi>` — la variante cacheabile un'ora del ciclo precedente, nessuna
  immagine nuova da generare o mantenere. `twitter:card` è `summary` (non `summary_large_image`):
  l'immagine è verticale 960×2048, il formato large la taglierebbe.
- `backend/src/help.js`: solo `FAVICON_TAG` su `/aiuto`, "Shortcut non disponibile" ed "errore
  temporaneo" — niente Open Graph su queste pagine di servizio, non sono ciò che si condivide, e
  le loro firme non ricevono `origin` (aggiungerlo sarebbe lavoro non richiesto).
- `backend/tests/integration/anteprima-social.test.js`: icona + soli colori ammessi, tag og:
  completi e assoluti, `og:image`/`twitter:card` esatti, coerenza carattere-per-carattere con
  title/description, e le tre pagine di servizio senza tag og:.

## 2026-08-01 — s-la-chiave-admin-non-viaggia-piu-nell-indirizzo
- `backend/src/index.js`: `isAuthorized` ora legge `?key=` in query solo se chiamata con
  `{ chiaveNellUrl: true }` — di default accetta SOLO l'header `x-artipop-key`. La query string
  finisce nei log di Cloudflare, nella cronologia del browser e nei proxy: è il trasporto sbagliato
  per l'unica credenziale che spende neuroni AI e scrive nel KV di produzione. Unica eccezione
  ammessa: `GET /lab/img`, caricata da un `<img src>` che non può portare header custom.
- Nuovo helper `nonAutorizzato`: quando la chiave corretta arriva solo da `?key=` su una rotta che
  non lo ammette, il 403 lo dice esplicitamente («va passata nell'header x-artipop-key»), senza mai
  interpolare il valore della chiave nel messaggio o nei log.
- Migrati al trasporto in header i casi felici esistenti in `router-auth.test.js`,
  `admin-robuste.test.js` e `router-errori.test.js` che usavano `?key=`; l'unico `?key=` rimasto è
  quello di `admin-robuste.test.js:156` (`/lab/img`), l'eccezione ammessa.
- Nuovo `backend/tests/integration/chiave-solo-in-header.test.js`: enumera `ROTTE_PROTETTE`
  (importata da `router-auth.test.js`, non riscritta a memoria) e verifica che la chiave corretta
  in query venga rifiutata ovunque tranne `/lab/img`, che l'header continui a funzionare su rotte
  rappresentative, e che il corpo del 403 non contenga mai il valore della chiave.
- Tradeoff: chi lanciava una rotta admin incollando `?key=…` nella barra del browser deve passare
  a `curl -H`. Costo piccolo e circoscritto, compensato dal fatto che proprio le rotte più costose
  (`/run`, `/backfill`, `/run-all`) non restano più in chiaro nella cronologia.
- `backend/README.md` e `GUIDA.md`: aggiornati gli esempi `curl` e la descrizione degli endpoint
  admin — header obbligatorio, `?key=` ammesso solo su `GET /lab/img`.

## 2026-08-01 — s-cancellare-un-concept-non-lascia-range-fantasma
- Nuovo `dropTuningProfilo(env, id)` in `backend/src/profiles.js`: rimuove il SOLO override di `id`
  da `tuning:profili`, lasciando intatti gli altri. Prima non esisteva alcuna funzione che togliesse
  il profilo di un concept singolo (solo `saveTuning`, riscrittura totale, e `clearTuning`,
  cancellazione totale).
- `backend/src/index.js`, `DELETE /catalogo/concept`: dopo una `removeConcept` andata a buon fine
  chiama `dropTuningProfilo`. Perché: se un id di concept custom veniva riusato dopo la
  cancellazione, ereditava in silenzio i range tarati per il concept vecchio — un "range fantasma"
  mai impostato dall'utente per il nuovo soggetto, e il cancello giudicava con misure sbagliate
  senza alcun segnale nell'interfaccia.
- La pulizia del tuning è avvolta in un try/catch locale (solo `console.warn`, mai `err.message` nel
  corpo della risposta): il concept è già rimosso a quel punto, un override orfano è meno grave di
  una 500 su un'operazione riuscita. Contratto della risposta invariato (`{ ok: true, rimosso: id }`).
- Nuovo `backend/tests/unit/tuning-orfani.test.js`: copre il caso del bug (id riusato riparte dai
  range del nuovo concept), la purga chirurgica (l'override di un concept built-in sopravvive alla
  cancellazione di un altro), la tenuta a un guasto di scrittura su `tuning:profili` (resta 200), e
  il caso senza override da rimuovere (documento invariato).

## 2026-08-01 — s-le-rotte-di-generazione-non-restituiscono-piu-stack
- Nuovo `erroreInterno(etichetta, err, rispondi, frase, extra)` in `backend/src/index.js`, gemello
  di `scritturaProtetta`: logga `err.message`/stack SOLO in `console.error` e risponde 500 con una
  frase umana costante, mai il messaggio originale né lo stack nel corpo. `/lab/arc`, `/run/<flusso>`,
  `/backfill` e `/test-size` erano le ultime quattro rotte che rispondevano ancora con `err.message`
  e `String(err.stack)` grezzi nel corpo HTTP — esattamente le rotte che chiamano il binding AI e KV,
  dove il messaggio di un fetch verso l'upstream è il posto da cui un token o un URL firmato
  finirebbero in una risposta.
- `/regen-day` resta invariata (i suoi messaggi sono `ErroreDominio`, testo di dominio scritto da
  noi, non un errore di sistema); aggiornato solo il commento che ne spiegava la differenza dagli
  altri due, ora non più vera.
- Nuovo `backend/tests/integration/errori-admin-senza-stack.test.js`: per ciascuna delle 4 rotte
  forza un fallimento con un messaggio-sentinella e verifica 500, corpo `{ ok:false, error:<frase> }`
  senza sentinella né campo `stack`, più la non-regressione su `/regen-day` (400 invariato).

## 2026-08-01 — s-uno-stato-incoerente-non-blocca-un-flusso
- Nuova `interoOppure(v, ripiego)` in `backend/src/story.js`: uno stato KV leggibile (JSON valido) ma
  con un campo numerico di tipo sbagliato (es. `dayNumber:"abc"`, `stage:"x"`, `dayInArc:"2"`) non
  deve mai far crashare il flusso o farlo derivare in silenzio. Prima, un valore non numerico in
  `dayNumber` o `stage` faceva crashare `evolveStory` con «base is not iterable» (verificato prima di
  scrivere il piano), e un `dayInArc` non intero causava un rollover d'arco spurio, buttando via un
  arco ancora in corso. Lo stato rotto non veniva mai riscritto, quindi il canale restava fermo per
  sempre — stessa classe di guasto del ciclo 17 (`storia-incoerente` copre lì il JSON NON parsabile
  in `storage.js`; qui il JSON è valido ma i campi hanno il tipo sbagliato).
  `evolveStory` legge ora `dayNumber`, `dayInArc`, `stage`, `arcIndex` ed `extraIndex` di
  `prevState` solo attraverso `interoOppure`, con ESATTAMENTE gli stessi ripieghi già in vigore
  (`dayNumber - 1`, `0`, `dayInArc - 1`, `0`, `-1`): nessun cambio di comportamento sugli stati con
  campi interi validi. `startArc` non tocca nulla: l'unico campo numerico che riceve (`arcIndex`)
  arriva già normalizzato dal chiamante.
- Nuovo `backend/tests/unit/story-stato-incoerente.test.js`: copre ciascuno dei cinque campi con un
  valore non intero, verificando che `evolveStory` non lanci, che lo stato risultante resti con
  `dayInArc`/`stage`/`arcIndex` interi e `scene` una stringa non vuota, che un `dayInArc` corrotto non
  apra un arco nuovo quando quello in corso non è davvero finito, e che un `extraIndex` corrotto su un
  arco bloccato in tappa finale produca comunque un intero ≥ 0.

## 2026-08-01 — s-il-cancello-non-premia-l-immagine-peggiore
- `backend/src/metrics.js`, `verdict()`: le guardie assolute (`maxDeriva`, `maxDegrado`) dividevano il
  contributo alla distanza per la soglia grezza. Con soglia `0` (clampata e salvabile da
  `PUT /tuning`) il contributo va a `Infinity`: `generate.js:310` sceglie il candidato con distanza
  MINIMA quando i tentativi finiscono, quindi con più candidati fuori soglia il cancello smetteva di
  scegliere (tutti `Infinity` → tiene il primo). Con soglia negativa (raggiungibile da un concept
  custom via `validaScalareONull`, che accetta qualunque numero finito) il contributo diventava
  negativo, potendo annullare un contributo positivo su un'altra misura e portare `distanza` a `0`
  cioè `ok: true` su un'immagine fuori range. Con soglia non numerica (`NaN`, stringa) la guardia si
  spegneva in silenzio. Nuova `sogliaGuardia(v, ripiego)` che ricade sul default di `CONFIG` solo per
  input non numerici/non finiti; il contributo ora divide per `Math.max(soglia, 1e-6)` — stesso
  idioma già in uso in `outside()` — così resta sempre finito e ≥ 0, mentre il confronto (`m.deriva >
  soglia`) e il testo dei motivi restano sulla soglia grezza, invariati.
- Nuovo `backend/tests/unit/cancello-guardie.test.js`: soglia 0 (distanza finita e > 0, discrimina
  fra due derive diverse), soglia negativa (nessun contributo negativo, niente cancellazione fra
  contributi), soglia non numerica (ricade su `CONFIG`, guardia attiva), non regressione sul caso
  normale. `backend/tests/unit/metrics.test.js` non toccato.

## 2026-08-01 — s-ricaricare-non-butta-via-le-tarature-non-lanciate
- `tuning/js/store.js`, `fetchTuning()`/`rebuildEdit()`: QUALUNQUE ricarica (bottoni "↻ Aggiorna" e
  "↻ Carica dal Worker", `catReload`/`archReload`, il salvataggio delle credenziali, l'auto-`carica()`
  dopo un lancio riuscito) riassegnava `AP.store.edit` dai valori freschi del server, cancellando in
  silenzio una taratura fatta a mano in Range e non ancora lanciata — un'incoerenza già riconosciuta
  dal codice stesso: tab-lab.js chiede conferma prima di sovrascrivere esattamente quelle modifiche
  ("Sovrascrivere le modifiche non lanciate di …?"), la ricarica no. `fetchTuning()` ora cattura i
  concept del server PRIMA di sovrascriverli e li passa a `rebuildEdit(precedentiServer, opzioni)`:
  per ogni concept presente sia nel vecchio `AP.store.edit` sia nella nuova risposta, il valore di
  lavoro precedente sopravvive SOLO se divergeva già dal server di prima (`AP.util.diffProfilo`) —
  un concept non toccato dall'utente prende comunque il valore fresco (una taratura arrivata da
  un'altra sessione deve poter comparire), e un concept sparito dalla risposta non viene reintrodotto.
- `AP.store.carica(opzioni)` ora inoltra `opzioni` a `fetchTuning` (prima le ignorava).
  `opzioni.scartaModifiche: true` salta il ripristino: è il comportamento del bottone
  "Ripristina default" (`tuning/js/tab-range.js`, `$("reset")`), l'unico punto in cui l'utente chiede
  ESPLICITAMENTE di buttare i valori locali — lì conservarli sarebbe il bug opposto. Tutti gli altri
  call site restano invariati.
- `tuning/index.html`: una riga di aiuto nella sezione Range spiega che la ricarica conserva le
  tarature non ancora lanciate, e solo "Ripristina default" le scarta.
- Nuovo `backend/tests/unit/tuning-modifiche-non-perse.test.js`: un profilo modificato e divergente
  dal server sopravvive a una seconda `carica()`; un profilo non toccato prende il valore nuovo del
  server; `carica({ scartaModifiche: true })` riallinea tutto; un concept sparito dalla risposta non
  riappare; a grep, solo `tab-range.js`/`$("reset")` passa `scartaModifiche: true`.

## 2026-08-01 — s-il-catalogo-dice-quali-element-sono-sospesi
- `backend/src/index.js`, `GET /catalogo`: ogni voce di `concepts` e `elements` (built-in e custom)
  porta ora un campo booleano `sospeso` (`FAMIGLIE_SOSPESE`/`ELEMENT_SOSPESI`, `config.js`). Prima il
  tuning tool mostrava `canoa` identica a qualsiasi altro element, col badge verde "pubblicato su
  citta", mentre il backend la esclude già da ogni pool pescabile (`poolForWith`, `catalog.js`): unico
  strumento di chi lavora sul catalogo, mentiva sull'unica cosa che gli serve sapere per capire perché
  quell'element non esce mai. Un element risulta sospeso anche quando è la sua `famigliaNativa` a
  essere sospesa, non solo per id diretto — stesso doppio filtro già applicato in produzione.
- `tuning/js/tab-catalogo.js`: badge testuale "sospeso" nella lista (Element e Concept) per le voci
  con `sospeso === true`, assente quando il campo manca del tutto (compatibilità con un Worker più
  vecchio); il form della voce selezionata mostra in più una riga che spiega la condizione d'uscita
  (un arco già aperto o il lab per id restano comunque utilizzabili).
- `tuning/tool.css`: `.badge.sospeso` accanto a `.badge.custom`/`.badge.pub`, colore `var(--warn)`
  già in uso altrove nel tool.
- Nuovo `backend/tests/integration/catalogo-sospesi.test.js`: `canoa` ha `sospeso:true`, un altro
  built-in ha `sospeso:false`, il campo è booleano su ogni voce; con `FAMIGLIE_SOSPESE` mockata un
  element custom risulta sospeso via `famigliaNativa`, non via id cablato.
- Nuovo `backend/tests/unit/tuning-catalogo-sospesi.test.js`: il badge compare solo sulla riga con
  `sospeso:true` e non compare quando il campo è assente, sia in lista Element sia in lista Concept.

## 2026-08-01 — s-un-guasto-a-meta-cancello-non-butta-l-immagine-gia-buona
- `backend/src/generate.js`, `generateWithGate`: la generazione di ogni tentativo (chiamata a
  `generateImage` e misura del candidato) è ora avvolta in try/catch dentro il ciclo. Prima, se
  l'intera catena di generatori falliva al 2º o 3º tentativo, l'eccezione usciva dal cancello e
  buttava via il candidato già generato e misurato al 1º tentativo — il flusso del giorno restava
  all'immagine di ieri pur avendo in mano un'immagine pubblicabile, con i neuroni del 1º tentativo
  già spesi e persi. Ora un guasto a metà interrompe il ciclo (senza consumare altri tentativi contro
  un generatore appena fallito del tutto) e, se esiste già un candidato, lo pubblica con
  `ripiego: true` come nel caso "tentativi esauriti". Se `migliore` resta nullo (guasto al 1º
  tentativo, oppure `maxAttempts` non valido) l'errore del generatore viene rilanciato — o, se non ce
  n'è uno, un `Error` con frase parlante — invece di lasciare che `migliore.verdetto` sia dereferenziato
  come `TypeError`.
- Nuovo `backend/tests/helpers/pngFinto.js`: costruisce una PNG 8 bit grigia uniforme non
  interlacciata con `zlib.deflateSync` (`node:zlib`, builtin, nessuna dipendenza nuova), per dare a
  uno stub del binding IMAGES byte davvero decodificabili — cosa che lo stub esistente in
  `fakeEnv.js` non offre (lì `IMAGES` lancia sempre di proposito, per garantire zero generazioni
  reali nei test di orchestrazione).
- Nuovo `backend/tests/unit/cancello-guasto-a-meta.test.js`: guasto al 2º tentativo dopo un 1º
  candidato rifiutato (torna il 1º con `ripiego`, non lancia); guasto al 1º tentativo (rilancia,
  nessun candidato inventato); `maxAttempts: 0` (errore parlante, mai un `TypeError`); cammino felice
  invariato (candidato accettato al 1º tentativo, stesso ritorno di prima). Zero generazioni AI: gli
  stub lanciano invece di chiamare modelli reali, `fetch` globale (usato da Pollinations, l'ultima
  spiaggia della catena) è sostituito nei test e ripristinato subito dopo.

## 2026-08-01 — s-le-marcature-non-si-rompono-su-un-documento-sporco
- `loadNote` (`backend/src/note.js`) ora scarta le voci non-oggetto (`null`, numeri, …) da
  `giorni`/`assetti` al momento della lettura: prima, un documento `note:marcature` con una sola
  voce sporca dentro uno dei due array faceva lanciare `TypeError` a `putGiornoNota`/`putAssetto`
  (via `.findIndex((g) => g.canale === …)` su una voce `null`), rendendo la marcatura non più
  scrivibile per sempre — nessun modo per l'utente di ripararla da sé.
- Nuovo `backend/tests/unit/note-marcature.test.js`: il modulo, unico tra quelli di scrittura admin,
  non era importato da nessun test. Copre le quattro funzioni esportate (`loadNote`, `putGiornoNota`,
  `putAssetto`, `removeAssetto`) con casi felici, errori di validazione e la regressione sul
  documento sporco.

## 2026-08-01 — s-la-guida-spiega-le-sospensioni-dai-pool
- GUIDA.md §2.5 «Come sono fatti i canali» ora spiega `FAMIGLIE_SOSPESE`/`ELEMENT_SOSPESI`
  (`backend/src/config.js`): cosa filtrano (`poolForWith` in `catalog.js`, solo la pesca di un
  concept nuovo — arco in corso e archivio intatti), che oggi l'unica voce sospesa è l'element
  `canoa` e perché, come si toglie una sospensione e dove si vede dal tool/API. Prima nessun
  documento nominava le sospensioni: chi guardava un element che non usciva mai dalla pesca non
  aveva modo di sapere che fosse voluto né dove intervenire.
- §2.9 (runbook): una riga in più per il sintomo «un element non esce mai dalla pesca», che rimanda
  a §2.5 invece di far pensare a un guasto.
- Nuovo `backend/tests/unit/guida-sospensioni.test.js`: anti-drift fra le liste di sospensione in
  `config.js` e il blocco di GUIDA.md — se domani si aggiunge una sospensione senza documentarla,
  la suite fallisce.

## 2026-08-01 — s-la-guida-spiega-lo-sfondo-segnaposto
- GUIDA.md §1.6 «Se qualcosa non va» ora ha una voce sintomo → causa → rimedio per il segnaposto di
  M4: quando `/w/<flusso>` non ha un'immagine da servire (canale appena aggiunto e non ancora
  generato, o `?date=` di un giorno inesistente) risponde comunque con un'immagine valida — mai un
  errore — perché la Shortcut che scarica quei byte per la lock screen non deve mai rompersi. Prima
  questo comportamento era documentato solo nel runbook §2.9 per il maintainer: chi lo incontrava
  dal lato utente (rettangolo scuro senza disegno) non aveva modo di distinguerlo da un guasto.
- §1.5, riga «Riscaricare un giorno preciso»: rimando a §1.6 per il caso della data non presente in
  archivio.
- Nuovo `backend/tests/unit/guida-segnaposto.test.js`: verifica che la voce nomini entrambe le
  cause e dica esplicitamente che la risposta resta un'immagine; anti-drift su `index.js` (il blocco
  `/w/` deve continuare a servire `PLACEHOLDER_PNG_BYTES` su almeno due rami, altrimenti la GUIDA
  smette di essere vera).

## 2026-08-01 — s-ogni-binding-usato-dal-codice-esiste-nei-due-ambienti
- Nuovo `backend/tests/unit/config-binding-completi.test.js`: ricava con una regex l'elenco dei
  binding `env.<NOME>` letti da `backend/src/` e verifica che ognuno sia dichiarato sia al top
  level (produzione) sia in `env.preview` di `backend/wrangler.jsonc` — che non eredita nulla dal
  top level — oppure sia un secret in allowlist (oggi solo `ADMIN_KEY`). Prima nessun test
  derivava l'elenco dei binding dai sorgenti: un binding nuovo usato nel codice e dichiarato in un
  solo ambiente avrebbe superato il deploy per poi far crashare il worker a runtime sull'ambiente
  scoperto. La guardia esplicita sull'estrazione non vuota impedisce che un cambio della regex
  faccia passare il test in silenzio senza controllare nulla.
- Estratta `stripJsonc`/`leggiWrangler` in `backend/tests/helpers/jsonc.js`, prima duplicata
  identica in `config-preview-isolato.test.js` e `config-deploy-coerente.test.js`; entrambi ora la
  importano, stesse asserzioni di prima.

## 2026-08-01 — feat-il-viaggio-racconta-il-giorno
- La home dice finalmente COSA succede nel giorno mostrato da "Il viaggio finora": sotto data e
  "N di M" compare una didascalia (soggetto del giorno + testo della tappa), aggiornata a ogni
  passo delle frecce ‹ › e a ogni fotogramma del timelapse. Prima il sito scaricava già
  `giorni[]` da `/api/archive/<canale>` (soggetto, testo della tappa) e li buttava via tenendo
  solo le date — zero richieste nuove, solo una cache in più (`capCache`) sullo stesso payload.
- Se per il giorno mostrato mancano i dati narrativi (giorno ricostruito, `origine: "assente"`),
  la didascalia resta nascosta invece di mostrare "null"/"undefined" o un blocco vuoto.
- Nuovo `backend/tests/unit/home-racconto-del-giorno.test.js`; baseline visive
  `tests/visual/baseline/home-{mobile,desktop}.png` rigenerate contro il dev server locale (la
  nuova sezione non è ancora in produzione, quindi il confronto va fatto contro il codice del
  ciclo, non contro il sito live).

## 2026-08-01 — feat-condividi-il-giorno-che-stai-guardando
- La home ottiene un link condivisibile al giorno esatto mostrato: un bottone "copia link" (pill
  ghost già canonica) accanto alla navigazione dei giorni compone `<origin>/?c=<canale>&d=<data>`
  per il canale in cima e il giorno effettivamente in anteprima, e lo copia con
  `navigator.clipboard.writeText`, confermando col toast pill già presente (mai usato finora nel
  client). Prima chi condivideva l'indirizzo della home faceva vedere all'amico oggi, non la scena
  che stava guardando — completa "il viaggio racconta il giorno" del ciclo 47 con la sua forma
  raggiungibile.
- Se la clipboard non è disponibile o rifiuta (contesto non sicuro, permesso negato), l'indirizzo
  si mostra in chiaro nel toast invece di lanciare: l'utente può sempre selezionarlo a mano.
- All'avvio la home legge `c`/`d` da `location.search`: un canale noto va in cima al deck, una
  data valida (`YYYY-MM-DD`) e presente nell'archivio di quel canale si mostra ferma (niente
  autoplay, così chi arriva da un link vede subito la scena condivisa). Canale sconosciuto o data
  malformata/assente: home normale su oggi, nessun errore.
- Nuovo `backend/tests/unit/home-link-al-giorno.test.js`; baseline visive
  `tests/visual/baseline/home-{mobile,desktop}.png` rigenerate per il nuovo bottone.

## 2026-08-01 — feat-la-home-ricorda-il-tuo-canale
- La home riapre sull'ultimo canale portato in cima, invece di ripartire sempre dal primo del
  mazzo: era il primo attrito per chi usa un solo canale (quello della sua Shortcut) e deve
  ri-sfogliare le card a ogni visita.
- `leggiCanaleRicordato()`/`ricordaCanale(id)`, chiave `artipop:canale` in `localStorage`: memoria
  locale al dispositivo, mai un cookie, nessun dato inviato al worker. Ogni accesso è racchiuso in
  try/catch — con storage inaccessibile (navigazione privata) la home degrada in silenzio al
  comportamento attuale.
- `updateChrome()`, unico punto in cui cambia la card in cima, chiama `ricordaCanale(ch.id)` ad
  ogni cambio; all'avvio il canale ricordato è applicato solo se `?c=` non è presente e solo se
  l'id esiste ancora in `CHANNELS` — il link condiviso vince sempre sulla memoria locale.
- Nuovo `backend/tests/unit/home-ricorda-canale.test.js`; nessuna baseline visiva da aggiornare
  (cambia solo quale card è in cima, stato già previsto dal componente deck).

## 2026-08-01 — feat-salva-il-wallpaper-con-un-nome-che-si-capisce
- `GET /w/<flusso>?dl=1` aggiunge `content-disposition: attachment; filename="artipop-<flusso>-<data>.<png|jpg>"`:
  chi salvava un wallpaper dall'archivio si ritrovava un file chiamato "natura", senza estensione
  né data, che su desktop non si apre a doppio clic. Emesso solo quando esiste davvero
  un'immagine — un segnaposto non si scarica con il nome di un wallpaper che non c'è — e l'id del
  flusso è sanificato (`[a-z0-9-]`) prima di finire nell'header.
- La chiamata della Shortcut (nessuna query) e la richiesta senza `?dl=1` restano invariate byte
  per byte e per header: nessuna regressione sulla rotta esistente.
- Nuova ancora `#daysave` ("salva l'immagine", `btn ghost`) accanto a `#dayopen` nella sezione «Il
  viaggio finora»: stessa visibilità (`hasJourney` in `renderJourney()`), `href` agganciato in
  `updateDayNav()` allo stesso `srcFor()` di `#dayopen` più `&dl=1`. Nessuna nuova regola CSS.
- Nuovi `backend/tests/integration/w-download.test.js` e `backend/tests/unit/home-salva-immagine.test.js`;
  baseline visive `tests/visual/baseline/home-{mobile,desktop}.png` rigenerate per il nuovo bottone.

## 2026-08-01 — feat-l-anteprima-del-link-condiviso-mostra-quel-giorno
- Il link per-giorno esisteva dal ciclo 48 (`?c=<canale>&d=<data>`), ma solo lato client:
  `head.js:metaAnteprima` costruiva sempre `og:image=/w/natura?v=<oggi>`, quindi condividere il
  giorno 28 luglio di «citta» in chat mostrava comunque il wallpaper di oggi di «natura» — il link
  portava alla cosa giusta, l'anteprima raccontava un'altra.
- `metaAnteprima(origin, todayKey, title, description, condiviso)` accetta ora un quinto argomento
  opzionale `{ canale, data }`: quando presente, `og:image` diventa `/w/<canale>?date=<data>`,
  `og:url` diventa `/?c=<canale>&d=<data>` e `og:title` cita canale e data estesa in italiano;
  assente, markup identico a prima byte per byte.
- La rotta `/` (`index.js`) legge `?c=`/`?d=` con `risolviCondiviso()`: canale deve essere un flusso
  attivo per id esatto (lo stesso insieme che il deck riconosce lato client), data in formato
  YYYY-MM-DD, calendario reale, non futura — qualunque condizione cada, `condiviso = null` e la
  pagina resta quella di oggi, mai un `og:image` verso una rotta inesistente.
- `renderPage` inoltra `condiviso` a `metaAnteprima` e nient'altro: nessuna modifica al `<body>`,
  nessuna baseline visiva da rigenerare.
- Nuovo `backend/tests/unit/home-anteprima-giorno-condiviso.test.js`; `anteprima-social.test.js`
  esteso con la copertura end-to-end sulla rotta (valida, canale ignoto, data malformata, data
  futura).

## 2026-08-01 — feat-leggi-la-storia-dell-arco
- La home mostrava il testo narrativo (`testoTappa`) una tappa alla volta (`updateDayCaption`):
  chi voleva capire la storia dell'arco doveva sfogliare fino a sette volte e ricordarsela a
  memoria, pur avendo già tutti i dati scaricati in `capCache`/`arcsCache` — materia prima in
  pagina ma irraggiungibile come racconto continuo.
- Nuovo comando `#storytoggle` ("leggi la storia", `.btn.ghost`) sotto la didascalia del giorno,
  chiuso di default: apre `#arcstory`, l'elenco delle tappe dell'arco visualizzato costruito da
  `renderArcStory(chId)` — una riga per giorno (data breve + `testoTappa`), dal più vecchio al più
  recente, letto da `arcsCache[chId][arcIndexCache[chId]]` (fallback `archiveCache[chId]`) su una
  copia, mai un `.reverse()` sull'array in cache. Zero fetch, zero generazioni AI in più.
- I giorni senza `testoTappa` (giorno ricostruito, origine assente) sono omessi, mai una riga
  "undefined"; se dopo il filtro non resta alcuna riga, `#storytoggle` resta nascosto — nessun
  comando che apre un blocco vuoto. Righe costruite con `createElement`/`textContent`, mai
  `innerHTML` con testo del catalogo — stessa disciplina di `updateDayCaption`.
- Il tocco su una riga (`<button>`, tap target ≥44px) chiama `stopPlayback()` poi
  `previewDay(chId, data, ...)`: la home mostra quel giorno, esattamente come le frecce ‹ ›. La
  riga del giorno mostrato è evidenziata da `updateArcStoryHighlight`, chiamata da `updateDayNav`
  ad ogni cambio di giorno — quindi anche seguendo le frecce, non solo il click sull'elenco.
- `renderArcStory` è agganciata a `renderJourney` (nuovo arco/canale) e a `goToPreviousArc`/
  `goToNextArc` (ciclo 54-55): l'elenco mostra sempre le tappe dell'arco effettivamente
  visualizzato, non quello iniziale.
- VISUAL_SPECS §1.4 aggiornata con il nuovo componente `.arcstory`/`.arcrow`: nessun colore nuovo,
  riusa `--dim` per le righe non correnti e il testo pieno per quella corrente (stessa coppia già
  usata da `.stale`).
- Nuovo `backend/tests/unit/home-storia-dell-arco.test.js`; baseline visive
  `tests/visual/baseline/home-{mobile,desktop}.png` rigenerate per il nuovo comando.

## 2026-08-01 — feat-copia-l-indirizzo-del-canale
- La GUIDA (§1.3 "Preferisci crearla a mano?") istruisce a "incollare l'URL del canale" per creare
  la Shortcut a mano, ma quell'indirizzo non era ottenibile da nessuna superficie del prodotto: la
  home offriva solo il download della Shortcut firmata (inutilizzabile su iOS che blocca le
  scorciatoie non attendibili), e `/aiuto` citava i percorsi solo come testo non copiabile e senza
  origine.
- Nuovo bottone `#copyurl` ("copia l'indirizzo del canale", `.btn.ghost`) in `.actions`, accanto a
  "Come si attiva": copia `ORIGIN + "/w/" + <id del canale in cima>`, senza `?date=`/`?v=` —
  l'endpoint stabile che la Shortcut deve chiamare ogni sera, non un giorno specifico.
- Estratta da `shareLink` la parte di clipboard riusabile in `copiaNegliAppunti(link)`: prova
  `navigator.clipboard.writeText` e lancia se assente o rifiutata: sta al chiamante il messaggio di
  ripiego nel toast. Un solo blocco `writeText` in tutto `page.js`, usato sia da `shareLink` sia dal
  nuovo `copyChannelUrl`.
- Rimossa la `url` calcolata in `cardHTML` (ciclo 47, mai resa né usata): era codice morto, ora
  sostituita dal calcolo equivalente dentro `copyChannelUrl`.
- Nuovo `backend/tests/unit/home-copia-indirizzo.test.js`; baseline visive
  `tests/visual/baseline/home-{mobile,desktop}.png` rigenerate per il nuovo bottone.

## 2026-08-01 — feat-scegli-l-arco-dall-elenco
- L'unico modo per raggiungere un arco vecchio era premere «‹ arco precedente» un arco alla
  volta, ricaricando l'anteprima ad ogni tocco e senza mai sapere in quale arco ci si trovasse
  né quanti ce ne fossero: con mesi di archivio (il cron genera ogni notte) il percorso era di
  fatto impraticabile.
- Nuovo comando ghost `#arcpick` ("scegli l'arco") ed elenco `#arclist` dentro `.journey`,
  stessa forma canonica dell'elenco-tappe (`.arcstory`/`.arcrow`, VISUAL_SPECS §1.4 esteso):
  una riga per arco del canale (dal più recente al più vecchio) con l'intervallo di date e il
  nome del concept, ripiego testuale se manca; tocco = salto diretto a quell'arco, evidenziato
  con `.on`. Invisibile con meno di due archi o senza archivio disponibile.
- Nuova `goToArc(chId, idx)` per il salto arbitrario da elenco: stessa meccanica già collaudata
  di `goToPreviousArc`/`goToNextArc`/`goToToday` (mai unire due archi, giorno più recente del
  nuovo arco). Le tre funzioni esistenti restano invariate nel corpo (i test preesistenti ne
  fissano l'implementazione letterale) e aggiornano anche `#arclist` con la nuova
  `renderArcList`, chiamata dove già si chiama `renderArcStory`.
- Nuovo `backend/tests/unit/home-scegli-arco.test.js`; baseline visive
  `tests/visual/baseline/home-{mobile,desktop}.png` rigenerate per il nuovo comando.

## 2026-08-01 — feat-l-aiuto-spiega-come-sfogliare-il-viaggio
- Il ciclo 63 aveva provato ad aggiungere una 16ª voce all'accordion per spiegare i comandi di
  sfoglio del viaggio (frecce, archi, torna a oggi), ma i conteggi «15 voci» sono hardcoded in
  tre test (`aiuto-ricerca`, `aiuto-ancore`, `aiuto-contenuto`): perimetro dichiarato troppo
  stretto, revert in EXEC. Questo ciclo cambia direzione senza aggiungere voci.
- La FAQ esistente «Come funziona la storia degli sfondi?» — il posto naturale dell'argomento —
  guadagna un capoverso che spiega come sfogliare il viaggio dalla home: le frecce e il
  contatore «N di M», «torna a oggi», «arco precedente»/«arco successivo», «scegli l'arco»,
  «leggi la storia» e l'indirizzo diretto `?date=`. Domanda, id dell'ancora, numero di voci (15)
  e aspetto ad accordion chiusi restano tutti invariati, quindi zero rischio per i tre test di
  conteggio e zero baseline visive da rigenerare.
- Nuovo `backend/tests/unit/aiuto-viaggio.test.js` verifica il contenuto arricchito e la stabilità
  di conteggio/id.

## 2026-08-01 — feat-il-viaggio-non-resta-mai-a-schermo-nero
- `previewDay` portava `top.style.opacity = 0` e la ripristinava SOLO dentro `pre.onload`: senza
  `onerror`, una rete che cade — il caso tipico di chi sfoglia il viaggio dal telefono, fuori
  casa — lasciava la card nera per sempre, senza spiegazione né modo di recuperare se non
  ricaricando la pagina, con il timelapse che continuava a ciclare a vuoto (principio 1,
  utilizzabilità reale su un percorso già rotto).
- Nuovo `pre.onerror`: ripristina `opacity = 1` (torna visibile l'immagine precedente, mai una
  card vuota), NON assegna `top.src`, chiama `stopPlayback()` per non far proseguire il timelapse
  su frame che non arrivano, e mostra il toast canonico già usato da `shareLink`/`copyChannelUrl`
  con un messaggio umano. Nessun componente, colore o dimensione nuovi: nessuna modifica a
  `VISUAL_SPECS.md`, nessuna baseline da rigenerare (il ripiego compare solo sul percorso
  d'errore, che il visual-check non attraversa).
- I due rami (`onload`/`onerror`) sono resi idempotenti tramite `pendingPreviewSrc`, che traccia
  l'ultima src richiesta: se l'utente cambia giorno prima che una risposta tardiva arrivi, quella
  risposta non sovrascrive più lo stato corrente.
- Nuovo `backend/tests/unit/home-immagine-non-caricata.test.js`.

## 2026-08-01 — feat-l-archivio-non-finisce-a-trenta-giorni
- Il viaggio in home caricava l'archivio con `?limit=30`: chi sfogliava a ritroso trovava il muro
  dei trenta giorni anche se il backend conserva tutto l'archivio permanente su KV, con
  paginazione già pronta fino a 400 giorni (`index.js`, `Math.min(..., 400)`). Elenco archi,
  arco precedente/successivo, frecce giorno e "N di M" già lavoravano su liste di lunghezza
  arbitraria — mancava solo alzare quel tetto.
- Cambiata l'unica fetch dell'archivio in `page.js` da `?limit=30` a `?limit=400`, il massimo
  consentito dalla rotta `/api/archive`. Nessun'altra modifica di logica: niente caricamento
  incrementale, niente stati nuovi, niente UI nuova.
- Nessun impatto visivo: il payload resta JSON di date e didascalie, le immagini si caricano
  comunque una alla volta durante lo sfoglio, con la stessa cache lunga già in essere.
- Nuovo `backend/tests/unit/home-archivio-piu-profondo.test.js`. Aggiornati i due test esistenti
  che citavano incidentalmente `limit=30` come stringa di riferimento (`home-racconto-del-giorno`,
  `home-arco-precedente`): l'assunto reale che verificano — un'unica fetch, nessuna richiesta
  nuova — resta identico, solo il numero nel valore atteso cambia.

## 2026-08-01 — feat-sfoglia-il-viaggio-con-la-tastiera
- Il listener `keydown` globale su `window` (`page.js:705-708`) mandava sempre ArrowLeft/ArrowRight
  al mazzo dei canali (`advance()`), anche con il fuoco dentro "Il viaggio finora": chi aveva
  appena cliccato ‹ ›  e continuava a sfogliare da tastiera perdeva il canale mostrato invece di
  muovere il giorno.
- Nuovo listener `keydown` su `journeyEl` (la sezione `.journey`) che intercetta ArrowLeft/ArrowRight
  prima che risalgano a `window`: chiama `stepDay(-1)`/`stepDay(1)` — lo stesso verso dei bottoni
  `#dayprev`/`#daynext` già presenti — e ferma la propagazione con `stopPropagation()`. Ignora
  l'evento con meta/ctrl/alt (scorciatoie di cronologia del browser) e quando `#daynav` è nascosto
  (nessun archivio sfogliabile). Il listener globale resta invariato: fuori dal viaggio le frecce
  continuano a sfogliare i canali come prima.
- Nessun elemento, `tabindex` o stile nuovo: il fuoco raggiunge già la sezione tramite i bottoni
  esistenti, nessun impatto su `VISUAL_SPECS.md`.
- Nuovo `backend/tests/unit/home-tastiera-viaggio.test.js`.

## 2026-08-01 — feat-sfoglia-i-giorni-con-il-dito
- Il mazzo dei canali si sfoglia col dito (`attachDrag`, `page.js:691`) e i giorni si sfogliano
  con la tastiera (`feat-sfoglia-il-viaggio-con-la-tastiera`), ma su un telefono la tastiera non
  c'è: dentro "Il viaggio finora" restavano solo i due `.dayctrl` ‹ › piccoli, il buco d'ingresso
  più evidente sul dispositivo bersaglio del prodotto (la Shortcut è su iPhone).
- Nuova `attachJourneySwipe()`, agganciata a `journeyEl` (statico, una volta sola all'avvio, non
  ad ogni `buildDeck` come `attachDrag`): `pointerdown`/`pointermove`/`pointerup`/`pointercancel`
  con le stesse guardie di `attachDrag` (`daynavEl.hidden`, `closest("button, a")`), ma senza
  trascinare nulla — `.journey` non è una card — e senza `preventDefault` su `pointermove`, così
  lo scorrimento verticale della pagina resta libero. Il gesto conta solo se orizzontale e ampio
  (`|dx| > 48` e `|dx| > |dy|`, soglia in pixel perché `.journey` non ha la stessa larghezza della
  card): destra → `stepDay(-1)`, sinistra → `stepDay(1)`, stessa direzione delle frecce `#daynav`.
- Il gesto non raggiunge mai `advance()`/`flyOut()`: il canale in cima al mazzo resta invariato,
  solo il giorno mostrato cambia.
- Hint del viaggio aggiornato per dichiarare il gesto: `— ↔ scorri o usa le frecce.` (stessa forma
  di `#hint` sul mazzo). È l'unico cambio visivo di questo ciclo: baseline `home-mobile.png` e
  `home-desktop.png` rigenerate contro il dev server locale (`wrangler dev`, KV locale).
- Nuovo `backend/tests/unit/home-sfoglia-col-dito.test.js`.

## 2026-08-01 — feat-l-aiuto-dice-se-il-canale-e-fermo
- `/health` sa già se un canale è fermo (`freschezza`, `s-health-dice-se-un-flusso-e-fermo`) e la
  home lo dice per il canale che stai sfogliando (`feat-la-home-dice-se-il-canale-e-in-ritardo`), ma
  la pagina `/aiuto` — il posto dove si arriva proprio quando lo sfondo non cambia — non ne sapeva
  nulla: chi apriva l'aiuto non aveva modo di distinguere "è il mio iPhone" da "è il canale fermo".
- `renderHelpPage(stato)` (`backend/src/help.js`) accetta ora uno `stato` opzionale (default `null`,
  forma `[{ id, nome, aggiornato, giorniDiRitardo }]`, la stessa di `/health`): se assente o vuoto
  il markup resta identico a prima. Con `stato` valorizzato, un nuovo blocco «Stato dei canali»
  compare subito sotto il campo di ricerca, prima di «Qualcosa non funziona» — fuori dalle sezioni
  `h2[data-sezione]`, così `filtra()`/`apriDaHash()` restano intatti e il blocco non è filtrabile
  né sparisce durante una ricerca.
- La rotta `/aiuto` (`backend/src/index.js`) legge lo stato con le stesse funzioni di `/health`
  (`getState` + `buildFreschezzaState`, `todayKey()`), dentro un `try/catch`: qualunque errore di
  lettura (KV assente/rotto) ricade su `renderHelpPage()` senza argomento — la pagina resta 200 e
  leggibile, mai un 500. Nessuna scrittura KV, nessuna chiamata AI/IMAGES.
- `VISUAL_SPECS.md` §2 aggiornata col nuovo componente: nessun token di colore o dimensione nuovo,
  solo testo `#f2f3f8`/`#9aa3b8` già in spec. Baseline `aiuto-mobile.png`/`aiuto-desktop.png`
  rigenerate contro il dev server locale (`wrangler dev`, KV locale) — cambio visivo dichiarato.
- Nuovi `backend/tests/unit/aiuto-stato-canali.test.js` e
  `backend/tests/integration/aiuto-stato-canali.test.js`.

## 2026-08-01 — feat-gli-archivi-storici-si-riaprono-dal-sito
- Gli archivi dei canali storici (island, bloom, studio, neon, …) erano raggiungibili solo
  chiamando `/w/<id>?date=...` a mano: nessuna pagina del sito li elencava, quindi chi non
  conosceva già gli id storici non aveva modo di scoprirli o riaprirli.
- Ciclo 77 (opus) aveva tentato una direzione diversa — link costruiti client-side con una
  nuova `fetch()` in `page.js` — ed era FALLITO(EXEC): tre test congelati impongono
  `fetches.length === 1` sull'HTML della home come guardia contro nuove rotte di rete. Questo
  ciclo prende una strada che non tocca affatto quella guardia.
- Nuovo modulo `backend/src/archivi.js` (`renderArchiviPage`): HTML statico, nessun
  JavaScript, nessuna `fetch`, stesso linguaggio visivo di `help.js` (token `--bg #0a0b10`,
  `--text #f2f3f8`, `--dim #9aa3b8`, link `#8fd3ff`). Lista vuota o scansione fallita → sempre
  200 con un messaggio umano, mai una pagina rotta.
- Nuova rotta pubblica `GET /archivi` (`backend/src/index.js`): legge
  `listChannelsWithArchive(env)` — già esistente in `storage.js`, finora usata solo dal
  tuning tool — SOLO quando l'utente visita la pagina, mai nel giro di produzione. Esclude gli
  id di `ACTIVE_CHANNELS`, ordina per data più recente.
- `backend/src/page.js`: un solo link statico `<a href="/archivi">Archivi</a>` nel footer della
  home. Zero nuove `fetch(` nell'HTML reso: i tre test congelati restano intatti e verdi.
- `VISUAL_SPECS.md` §2 estesa con la sottosezione «Pagina /archivi»: adozione integrale dei
  token e del layout piatto già in spec, nessun colore o componente nuovo. `GUIDA.md` aggiorna
  la mappa del repo e la tabella degli endpoint.
- Baseline `home-mobile.png`/`home-desktop.png` rigenerate (footer cambiato); baseline di
  `/aiuto` e del tuning tool byte-identiche. Nuovi
  `backend/tests/unit/archivi-pagina.test.js` e `backend/tests/integration/archivi-rotta.test.js`.

## 2026-08-01 — feat-l-archivio-storico-dice-dove-continua-la-storia
- Chi riapre l'archivio di `island` o `studio` su `/archivi` (ciclo 80) si fermava a un vicolo
  cieco: nessun indizio che quelle storie continuano oggi in Natura e Quiete, pur essendo il dato
  già disponibile server-side in `LEGACY_ALIASES` (`channels.js`).
- `backend/src/archivi.js`: nuova funzione pura `erede(id)` che risolve l'alias storico nel
  flusso attivo corrispondente (o `null` se assente o non più attivo). `renderElenco` aggiunge,
  solo quando l'erede esiste, una terza riga nella card con il link `/?c=<erede>`; nessuna riga
  in più per i canali senza erede attivo. Nessuno `<script>`, nessuna `fetch(` introdotta.
- `VISUAL_SPECS.md` §2.1 aggiornata con la terza riga (testo `#9aa3b8`, link `#8fd3ff`, stessi
  token, nessun colore o componente nuovo).
- Nuovo `backend/tests/unit/archivi-eredita.test.js`: copre island→natura, studio→quiete, un id
  senza alias (nessun link in più), l'assenza di `<script`/`fetch(` e i casi `[]`/`null` invariati.

## 2026-08-01 — feat-l-archivio-storico-si-sfoglia-giorno-per-giorno
- `/archivi` dichiarava "60 giorni · 2026-03-01 → 2026-04-29" ma offriva un solo link, quello
  dell'ultimo giorno: gli altri 59 esistevano già in KV, serviti da `/w/<id>?date=`, senza alcun
  indirizzo raggiungibile dal sito — uno spiraglio sull'archivio, non un archivio.
- `backend/src/storage.js`: `listChannelsWithArchive` accumula ora anche `date: [...]` per
  canale, dalla più recente alla più vecchia — riusando le date già estratte nel giro di
  `KV.list` esistente, nessuna lettura KV aggiuntiva. `giorni`/`prima`/`ultima` restano
  invariati per l'altro chiamante (`index.js:694`).
- `backend/src/archivi.js`: `renderElenco` aggiunge, dopo la riga dell'intervallo, un
  `<details class="giorni">tutti i N giorni</summary>` con un link per ciascuna data — assente
  quando `date` manca o è vuoto (chiamata legacy), lasciando la card invariata. Nessuno
  `<script>`, nessuna `fetch(` introdotta.
- `VISUAL_SPECS.md` §2.1 aggiornata con il nuovo componente (proposta ai sensi di §7): stessi
  token di §2, nessun colore nuovo.
- Nuovo `backend/tests/unit/archivi-giorni.test.js`; `backend/tests/integration/archivi-rotta.test.js`
  esteso a verificare che TUTTI i giorni del canale storico compaiano, non solo l'ultimo.

## 2026-08-01 — feat-salta-al-giorno-che-cerchi
- Dopo `feat-l-archivio-non-finisce-a-trenta-giorni` il viaggio di un canale può contenere
  centinaia di giorni, ma per raggiungerne uno preciso (il wallpaper del giorno che qualcuno ti
  ha condiviso, quello del tuo compleanno) esistevano solo la freccia giorno-per-giorno, lo
  sfoglio col dito, la tastiera e l'elenco degli archi — che salta all'arco, non al giorno.
- `backend/src/page.js`: nuovo `<input type="date" id="dayPick">` nativo nella riga di
  navigazione del giorno, accanto alle frecce ‹ ›; zero dipendenze, zero date-picker custom.
  `updateDayNav` (già chiamata ad ogni cambio giorno/arco/canale) valorizza `min`/`max` con
  l'unione delle date note nell'archivio del canale (`arcsCache`, ripiego `archiveCache`) e
  `value` col giorno mostrato. Sull'evento `change`, se la data appartiene a un arco (anche uno
  già chiuso) → `goToArc(chId, arcIdx, data)`, la stessa meccanica del link condiviso di un
  giorno passato; se non ha wallpaper → nessun salto, un messaggio umano (`toast`) e il campo
  torna al giorno mostrato — mai uno schermo nero, mai un errore grezzo.
- `VISUAL_SPECS.md` §1.4 estesa col nuovo componente (proposta ai sensi di §7): solo token
  §1.1 (`--bg`, `--text`, `--dim`), `color-scheme: dark` per rendere in scuro anche i controlli
  nativi del browser, stessa altezza minima di tocco di `.dayctrl`.
- Baseline `home-mobile.png`/`home-desktop.png` rigenerate contro il dev server locale
  (`wrangler dev`, KV locale).
- Nuovo `backend/tests/unit/home-salta-a-una-data.test.js`.

## 2026-08-01 — feat-segui-il-canale-dal-lettore-di-feed
- Fino ad oggi l'unico modo di sapere che è uscito il wallpaper nuovo era tornare sul sito o
  avere la Shortcut su iPhone: chi segue un canale da desktop, o vuole seguirne l'arco come una
  serie, doveva ricordarsi di controllare. Nuova rotta pubblica `GET /feed/<flusso>.xml`: un
  feed RSS 2.0 sugli ultimi 20 giorni d'archivio di un canale, iscrivibile da un lettore feed
  qualsiasi.
- Nuovo `backend/src/feed.js` (`renderFeed`): compone l'XML a mano, nessuna dipendenza. Ogni
  testo interpolato passa da un `escXml` locale; `pubDate` in RFC 822/1123 via `Date#toUTCString`.
- `backend/src/index.js`: la rotta risolve l'id con `resolveChannel` (un alias storico come
  `island` serve il feed della sua stessa storia, non quella del flusso erede — stessa
  convenzione di `/w/?date=`), legge le date con `listArchiveDates` e arricchisce ogni voce con
  `cartaDiIdentita` in un try/catch separato dalla lettura delle date (stesso schema di
  `/archivi`): un guasto KV degrada il feed a "zero item" o "soli titoli-data", mai a un 500.
  L'intera rotta ha un try/catch proprio (non quello globale, che risponderebbe JSON): un feed
  RSS deve sempre ricevere XML, anche nel caso peggiore. Flusso inesistente → 404 con corpo XML.
  Deviazione dal testo del piano: i link punteggiano `/?c=<canale>&d=<data>` e non `/?ch=`,
  perché è `c` il parametro che la home legge davvero (`risolviCondiviso`, index.js) — un link
  con `?ch=` sarebbe stato un feed sintatticamente valido ma con collegamenti morti, contro il
  principio 1 (Utilizzabilità) di CLAUDE.md.
- `backend/src/head.js`: nuovo `feedLinkTag(feedUrl)`, un `<link rel="alternate"
  type="application/rss+xml">` emesso solo se `feedUrl` è passato — `/aiuto` e `/archivi`
  restano invariati, non lo passano.
- `backend/src/page.js`: `renderPage` accetta un `feedUrl` opzionale (quinto parametro), verso
  il feed del canale reso lato server (quello del link condiviso, o il primo flusso attivo).
  Nessun elemento visibile aggiunto, nessuna modifica al CSS: il tag vive solo nel `<head>`.
- Nuovi `backend/tests/unit/feed-render.test.js` e `backend/tests/integration/feed-rotta.test.js`;
  `node scripts/visual-check.mjs` (contro `wrangler dev` locale) senza difetti e baseline
  invariate, coerente con una modifica invisibile.

## 2026-08-01 — feat-segui-il-canale-che-stai-guardando
- Il feed introdotto al ciclo 93 (`/feed/<canale>.xml`) e spiegato in `/aiuto` al ciclo 95 non
  era raggiungibile da nessun punto visibile dell'interfaccia: l'unico modo per abbonarsi era
  digitare a mano l'indirizzo letto nella guida. In più, il `<link rel="alternate">`
  nell'`<head>` restava fisso sul canale reso lato server anche dopo che l'utente sfogliava su
  un altro canale — chi si abbonava dal browser finiva sul canale sbagliato.
- Nuovo comando `#feedlink` ("segui col lettore di feed", `.btn.ghost`) in `.actions`, accanto a
  `#copyurl`: punta a `/feed/<canale>.xml` del canale con cui è resa la card in cima al deck
  (stesso canale di `#dlShortcut`, non quello dell'anteprima OG di un link condiviso — i due
  restano indipendenti, come già per `dlShortcut`).
- La stessa funzione client che risincronizza `#dlShortcut` per canale (`updateChrome`) ora
  aggiorna anche l'href di `#feedlink` e quello del `<link rel="alternate"
  type="application/rss+xml">` dell'head, con guardie `if (el)`: un nodo assente non deve mai
  interrompere lo sfoglio dei canali.
- Deviazione dal testo del piano: niente `rel="alternate"`/`type="application/rss+xml"` sul
  nuovo `<a>` — un test di regressione esistente (`feed-rotta.test.js`, fuori dai `FILE:` del
  piano) conta esattamente un `rel="alternate"` nella home; il criterio del piano non richiede
  quegli attributi sul comando visibile, solo `href` e testo.
- Nuovo `backend/tests/unit/home-segui-il-feed.test.js`; baseline `home-{mobile,desktop}.png`
  rigenerate contro `wrangler dev` locale per includere il nuovo comando (stesso metodo dei
  cicli precedenti).

## 2026-08-01 — feat-un-solo-feed-per-tutti-i-canali
- Chi seguiva ArtiPop con un lettore di feed doveva iscriversi a tre indirizzi separati, uno per
  canale (`/feed/<flusso>.xml`, ciclo 93). Nuova rotta pubblica `GET /feed.xml`: unisce gli
  ultimi giorni di tutti i canali attivi in un solo feed, ordinati dal più recente, con il nome
  del canale in testa a ogni voce — una sola iscrizione invece di tre.
- `renderFeed` (`backend/src/feed.js`) ora accetta voci con `canaleNome`/`canaleId` propri: se
  presenti, il titolo antepone il nome del canale e link/guid/enclosure puntano al canale della
  voce invece che a quello del feed; le voci senza questi campi restano identiche a prima
  (regressione su `/feed/<flusso>.xml` verde, byte per byte).
- Stessa robustezza della rotta per canale: ogni lettura di `listArchiveDates` è isolata in un
  try/catch proprio (un canale che fallisce non azzera gli altri) e la rotta risponde sempre
  XML valido, mai JSON né un 500 grezzo, anche a KV completamente rotto.
- `/aiuto` cita `/feed.xml` come iscrizione unica, nella stessa risposta che già nomina
  `/feed/<canale>.xml`; nessun accordion nuovo. `GUIDA.md` §2.4 elenca la nuova rotta.

## 2026-08-01 — feat-segna-i-giorni-che-ti-piacciono
- Ogni comando "Il viaggio finora" serviva a MUOVERSI nell'archivio (frecce, selettore di data,
  elenco archi), ma nessuno a TORNARE su un giorno che piace: con l'archivio ormai profondo, chi
  trova bella l'immagine di oggi non aveva modo di ritrovarla fra due mesi se non ricordandone la
  data a memoria. Nuovo comando ghost `#dayfav` ("☆ segna preferito" / "★ preferito") accanto a
  "salva l'immagine": segna il giorno mostrato in `localStorage` sotto `artipop:preferiti`,
  indicizzato per canale — stesso pattern difensivo (try/catch, ripiego a oggetto vuoto) già
  usato dalla memoria del canale (`REMEMBERED_CHANNEL_KEY`).
- Nuovo comando ghost `#favpick` ("i tuoi preferiti") ed elenco `#favlist`, visibili solo quando
  il canale mostrato ha almeno un giorno segnato: riusano integralmente `.arcstory`/`.arcrow`
  (stessa forma dell'elenco-tappe e dell'elenco-archi già in pagina), nessun colore o token
  nuovo. Il tocco su una riga riusa `goToArc` — lo stesso percorso di salto di `#dayPick` e di
  `#arclist` — così un preferito di un arco passato apre l'arco giusto senza una seconda
  implementazione del salto.
- Nuovo `backend/tests/unit/home-giorni-preferiti.test.js`; `VISUAL_SPECS.md` §1.4 aggiornata
  con il paragrafo «Preferiti» (proposta ai sensi di §7); baseline `home-{mobile,desktop}.png`
  rigenerate contro `wrangler dev` locale, con un piccolo archivio seminato a mano nel KV locale
  (mai remoto, mai produzione) per far comparire il nuovo comando nello screenshot.

## 2026-08-01 — feat-l-icona-installata-apre-anche-archivi-e-aiuto
- Da quando l'icona di ArtiPop sta sulla schermata Home (ciclo 104) sa fare una cosa sola: aprire
  `start_url` `/`. Aggiunto il campo `shortcuts` a `renderManifest()` (`backend/src/manifest.js`)
  con le due sole rotte pubbliche di lettura diverse dalla home — «Archivi storici» → `/archivi`
  e «Aiuto» → `/aiuto` — così tenere premuta l'icona installata apre direttamente una delle due
  senza passare dalla home. Nessuna icona per voce (l'unica disegnata è già quella del manifest,
  ripeterla non distingue nulla); `url` restano relative per non rompere preview/production.
- Esteso `backend/tests/unit/manifest-app.test.js`: `shortcuts` è un array di due voci nell'ordine
  dichiarato, ciascuna con `name`/`short_name` non vuoti e `url` dentro `scope`; test di
  regressione che i campi preesistenti del manifest restano identici a prima del ciclo.

## 2026-08-01 — feat-l-app-installata-si-apre-anche-senza-rete
- Chi ha installato ArtiPop sulla schermata Home apriva l'icona anche dove la rete manca (metro,
  aereo, cantina) e trovava la pagina d'errore del browser: aggiunto un service worker minimo
  (`backend/src/sw.js`, rotta pubblica `GET /sw.js`) che fa da rete di sicurezza — network-first
  su home, `/aiuto`, `/archivi` e le immagini `/w/<flusso>`, così l'ultimo giorno già visto si
  riapre invece dell'errore. Online l'utente vede sempre la rete (mai una copia stantia): la
  cache interviene solo quando il `fetch` fallisce, e resta fuori da ogni rotta amministrativa o
  API (`inCache`, testato in `backend/tests/unit/sw-offline.test.js`).
- La registrazione (`SW_REGISTER_TAG`, `backend/src/head.js`) resta FUORI da `INSTALL_TAGS`
  condiviso, perché quella costante alimenta anche `renderArchiviPage` (archivi.js), la cui suite
  impone "zero `<script>`" come garanzia che la pagina resti leggibile senza JavaScript: la
  funzione pura di rendering resta invariata, ed è invece `index.js` (`conServiceWorker`) a
  iniettare il tag nella risposta HTTP finale delle tre pagine — nessuna rottura dell'invariante
  esistente, nessuna modifica a `archivi.js`/`page.js`/`help.js`.
- Nessun elemento visibile aggiunto: `node scripts/visual-check.mjs` invariato, nessuna baseline
  da toccare.

## 2026-08-02 — feat-il-wallpaper-d-archivio-si-apre-a-grandezza-piena
- `renderGiornoArchivio` (`archivi.js`): l'`<img>` della `<figure class="foto">` è ora avvolta in
  un `<a class="apri" href="/w/<id>?date=<data>" target="_blank" rel="noopener">` — stesso URL già
  usato dal `src`, stessa coppia `target`/`rel` del bottone «apri l'immagine» della home
  (`feat-apri-il-wallpaper-del-giorno-a-schermo-intero`, page.js). Sulla pagina di un giorno
  d'archivio il wallpaper era l'unico motivo per aprirla ma non si poteva ingrandire: la home
  aveva già questo gesto, l'archivio no.
- `aria-label` descrittivo sull'`<a>` («Apri a grandezza piena il wallpaper di <id> del <data>»)
  perché lo screen reader non legga due volte l'`alt` dell'immagine, invariata (`alt`,
  `loading="lazy"`, `decoding="async"`).
- `GIORNO_STYLE`: `figure.foto a.apri { display: block; }` perché l'ancora non alteri il layout
  dell'immagine centrata, più una regola di focus visibile (`outline` in `#8fd3ff`, colore link
  già in uso) per la navigazione da tastiera — nessun colore, dimensione o componente nuovo.
- `VISUAL_SPECS.md` §2.2 aggiornato (voce «Immagine», proposta ai sensi di §7).
- Nuovo `backend/tests/unit/archivi-apri-immagine.test.js`: struttura del link (posizione dentro
  `<figure>`, `href`/`target`/`rel`), `aria-label` non vuoto, escaping su id/data con caratteri
  speciali, contratto «zero `<script>`/`fetch(`» invariato, attributi dell'immagine invariati.

## 2026-08-02 — feat-il-feed-di-un-canale-storico-apre-il-giorno-in-archivio
- `renderFeed` (`feed.js`): quando `canale.storico` è vero, `link`/`guid` di ogni `<item>` e il
  `<link>` del `<channel>` puntano rispettivamente a `/archivi/<id>?date=<data>` e `/archivi`
  invece che a `/?c=<id>&d=<data>` e `/?c=<id>` — chi segue un canale storico dal lettore di feed
  finiva sulla home del flusso erede, su un giorno che quel canale non ha mai avuto (l'archivio
  si legge sotto l'id richiesto, ma la home lo risolve sull'erede). `enclosure` e `<img>` della
  description non cambiano: puntavano già, correttamente, a `/w/<id>?date=<data>`.
- `index.js`: la rotta `/feed/<flusso>.xml`, nel ramo `isLegacy`, marca il canale con
  `storico: true`; il ramo del flusso attivo e il feed aggregato `/feed.xml` restano invariati.
- Test estesi in `feed-render.test.js` e `feed-rotta.test.js`: comportamento nuovo per
  `canale.storico`, non-regressione byte-per-byte per i feed dei flussi attivi e per il feed
  aggregato.

## 2026-08-02 — feat-il-sito-si-fa-trovare-solo-dove-serve
- Nuova rotta pubblica `GET /robots.txt` (`backend/src/robots.js`, falsariga di `manifest.js`):
  `Allow: /` per le pagine di lettura (`/`, `/aiuto`, `/archivi`, `/archivi/<id>`, `/w/...`) e una
  `Disallow` per ciascuna delle 11 rotte di servizio (`/tuning`, `/lab/`, `/catalogo`, `/note`,
  `/api/`, `/health`, `/backfill`, `/regen-day`, `/run-all`, `/test-metrics`, `/test-size`). Prima
  d'ora non esisteva alcun `robots.txt`: un crawler poteva indicizzare anche le stanze di servizio,
  portando un lettore su un 401 invece che su un contenuto.
  `/w/` resta volutamente aperto: `head.js` lo usa come `og:image` per l'anteprima dei link
  condivisi, bloccarlo l'avrebbe rotta.
- Nuovi `backend/tests/unit/robots-testo.test.js` e `backend/tests/integration/robots-rotta.test.js`:
  contenuto di `renderRobots()` (una sola `User-agent: *`, `Allow: /`, le 11 `Disallow`, nessun
  blocco su `/w/`, coerenza dei path con le rotte realmente presenti in `index.js`) e la rotta
  end-to-end (200, `text/plain`, zero letture KV).
- `GUIDA.md`: nuova riga nella tabella delle rotte pubbliche per `GET /robots.txt`.

## 2026-08-02 — feat-l-archivio-storico-si-sfoglia-per-mese
- `elencoGiorni()` (`backend/src/archivi.js`), condivisa dalle tre superfici che elencano i giorni
  di un canale storico (card di `/archivi`, pagina di un giorno, pagina d'errore), ora raggruppa le
  date in `<details class="mese">` per mese di calendario invece di stamparle tutte in un unico
  `<ul class="date">` piatto: `listArchiveDates` arriva fino a 400 date, e una colonna di 400
  righe tutte uguali è il primo attrito reale di chi riscarica l'archivio di un vecchio canale.
  Nuova `etichettaMese()` deriva chiave e forma estesa italiana del mese riusando lo stesso pattern
  di `dataEstesaItaliana` (head.js): mezzogiorno UTC, la data è una chiave calendario non un
  istante. Le chiavi malformate (o con data invalida, es. `2026-13-99`) confluiscono nell'ultimo
  gruppo «altri giorni», mai scartate e mai un "Invalid Date" in pagina. Il gruppo che contiene il
  giorno mostrato (pagina di un giorno) è aperto di default; con un solo mese quel gruppo resta
  aperto comunque; nella card di `/archivi` e nella pagina d'errore, senza un giorno corrente,
  nessun gruppo è aperto. Zero JS, zero letture KV in più: stesso numero di chiamate a
  `listChannelsWithArchive`/`listArchiveDates` di prima.
- Nuovo `backend/tests/unit/archivi-giorni-per-mese.test.js`: raggruppamento su tre mesi diversi,
  singolare/plurale del conteggio, ordine complessivo invariato, apertura del solo gruppo corretto
  (o dell'unico gruppo), chiavi malformate senza "Invalid Date"/"NaN", `date` vuoto/assente
  invariato, nessuno `<script>`/`fetch(`. I test esistenti (`archivi-giorni`, `archivi-accessibile`,
  `archivi-salva`, `archivi-non-trovato`, `archivi-giorno-salta`, integrazione `archivi-rotta`)
  restano verdi senza modifiche: le loro date di prova cadono tutte in un solo mese, quindi la
  nidificazione non cambia la forma attesa.
- `VISUAL_SPECS.md` §2.1 e §2.2 aggiornate ai sensi di §7: il `<details class="mese">` riusa il
  trattamento visivo dell'accordion già fissato in §2, `<summary>` in `#9aa3b8`, link in `#8fd3ff`
  — nessun colore, componente o dimensione nuovi.

## 2026-08-02 — feat-i-motori-di-ricerca-trovano-anche-gli-archivi
- Nuova rotta pubblica `GET /sitemap.xml` (`backend/src/sitemap.js`, `renderSitemap` puro, falsariga
  di `robots.js`/`feed.js`): dichiara `/`, `/aiuto`, `/archivi` e una `<url>` per ogni canale storico
  con archivio, con `<lastmod>` pari alla data del suo ultimo giorno — la scansione KV è la stessa
  già fatta da `/archivi` (`listChannelsWithArchive`), senza l'arricchimento col soggetto che qui
  non serve. Perché ora: `robots.txt` (ciclo `feat-il-sito-si-fa-trovare-solo-dove-serve`) dice ai
  crawler dove non entrare, ma nessuno gli diceva quali pagine esistono e quando cambiano — un
  canale storico che guadagna giorni non veniva mai ri-visitato.
  Scansione KV fallita → documento con le sole tre voci fisse, mai un 500, mai un corpo vuoto.
- `renderRobots()` (`backend/src/robots.js`) accetta ora un `origin` opzionale: quando presente
  appende `Sitemap: <origin>/sitemap.xml` in coda al file; senza origin il corpo resta identico a
  prima. `index.js` passa `url.origin` alla chiamata già esistente.
- `escXml` (`backend/src/feed.js`) esportata invece che privata al modulo: `sitemap.js` la riusa
  per l'escaping degli URL, invece di riscriverne una seconda copia.
- Nuovi `backend/tests/unit/sitemap-xml.test.js` (copertura pura di `renderSitemap`, incluse voci
  fisse, `lastmod`, `storici = null`, id con carattere da escapare, nessuna rotta di servizio) e
  `backend/tests/integration/sitemap-rotta.test.js` (200 XML, esclusione dei canali attivi,
  `KV.list` che lancia → sempre 200, header di sicurezza). `robots-testo.test.js` esteso con la
  coppia origin/nessun-origin; `robots-rotta.test.js` aggiornato per il nuovo argomento di
  `renderRobots` (l'origin fittizio del test).
- `GUIDA.md` § «Endpoint, in breve»: riga per `/sitemap.xml` e nota della riga `Sitemap:` in quella
  di `/robots.txt`.
- Nessuna superficie visibile cambia (`sitemap.xml` non è una pagina resa, come `robots.txt` e
  `feed.xml`): `VISUAL_SPECS.md` non toccato.

## 2026-08-02 — feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-archivio
- `/archivi` (`index.js`) smette di filtrare via i canali attivi (`filter(([id]) => !attivi.has(id))`
  tolto): l'elenco ora marca ogni voce con `attivo: <l'id è in ACTIVE_CHANNELS>` invece di
  escluderla. Perché ora: la rotta `/archivi/<id>` funziona già per qualunque canale con giorni in
  archivio, ma nessun link ci arrivava per un canale in corso — chi ha JavaScript disattivato (il
  `<noscript>` di `page.js` rimanda a `/archivi`, che di un canale attivo non diceva nulla), uno
  screen reader statico o un motore di ricerca restavano fuori dall'archivio più recente.
  Ordinamento invariato (per `ultima` decrescente): i canali in corso finiscono naturalmente in
  cima, nessun codice d'ordine nuovo.
- `archivi.js`: nuova `rigaInCorso(id)`, gemella di `rigaErede`, che emette «canale in corso — vai a
  {emoji} {nome} →» verso `/?c=<id>` riusando esattamente il markup/i token di `rigaErede`
  (`<div class="riga3 continua">`). `renderElenco` sceglie fra le due in base a `voce.attivo`: le
  due righe sono mutuamente esclusive per costruzione (un canale attivo non ha mai un erede). Con
  id non risolvibile da `getChannel`, nessuna riga — mai un contenitore vuoto. Resto della card
  (copertina, riga1, intervallo, `<details class="giorni">`, link di salvataggio, riga soggetto)
  condiviso e invariato fra canali storici e attivi.
- `renderArchiviPage`: titolo, `<h1>`, sottotitolo e `<meta name="description">`/anteprima social
  non promettono più i soli canali storici («archivi storici» → «archivi»): l'elenco ora comprende
  anche i canali in corso.
- `VISUAL_SPECS.md` §2.1: la terza riga della card (mutuamente esclusiva, stessi token) documenta
  ora entrambi i casi — erede storico e canale ancora attivo.
- `GUIDA.md`: le righe su `archivi.js` e su `GET /archivi` (tabella file, tabella endpoint)
  aggiornate per dire che l'elenco comprende anche i canali in corso.
- Nuovo `backend/tests/unit/archivi-canali-attivi.test.js`: riga «canale in corso» con link
  corretto e assenza della riga erede, card storica invariata, id non risolvibile senza riga
  aggiuntiva, componenti della card identici fra canale attivo e storico, nessuno `<script>`/`fetch(`.
  Assertion aggiornate in `anteprima-pagine-condivise.test.js` (title `og:title` ora contiene solo
  "archivi") e `archivi-rotta.test.js` (un canale attivo con giorni in archivio compare in `/archivi`,
  marcato «canale in corso», invece di essere escluso). Messaggio dell'elenco vuoto lasciato
  invariato ("Nessun archivio storico da mostrare.") per non uscire dai file dichiarati nel piano
  (`archivi-accessibile.test.js`/`archivi-salva.test.js` lo asseriscono e non erano fra i `FILE:`).

## 2026-08-02 — feat-lo-sfondo-di-oggi-puo-venire-da-tutto-l-archivio
- `GET /w/<flusso>?date=casuale`: pesca un giorno a caso da tutto l'archivio del canale invece
  del solo giorno odierno — l'archivio (mesi di wallpaper per canale, `listArchiveDates` già
  scritto) era raggiungibile solo da un browser; la Shortcut, il momento d'uso principale, può
  ora chiederlo con un solo valore di query, senza una generazione AI in più.
- Nuovo modulo puro `backend/src/rotazione.js` (`scegliDataRotazione`): sceglie la data
  deterministicamente dalla chiave del giorno (stesso schema già in uso per `/w/random`), non
  `Math.random` — un valore che cambia a ogni richiesta renderebbe la risposta non cacheabile e
  farebbe cambiare lo sfondo a ogni retry della Shortcut. Su input degeneri (array vuoto,
  non-array, data malformata) restituisce `null` senza mai lanciare.
- `index.js`: `?date=casuale` è riconosciuto prima della validazione stretta del formato data;
  se l'archivio è vuoto o assente si ricade sul percorso "canale vuoto" già esistente (placeholder
  200, mai JSON — ROADMAP M4). `cache-control` distingue ora la data *esplicita* (`?date=<data>`,
  invariata: `public, max-age=604800, immutable`) dalla data *sorteggiata*, che non è byte-stabile
  per sempre e resta `no-store, must-revalidate` come la chiamata senza query.
- `help.js`: la voce già dedicata a `/w/random` menziona anche `?date=casuale`, poche parole nel
  paragrafo esistente — nessun componente/token nuovo (`VISUAL_SPECS.md` §2). `GUIDA.md`
  aggiornato nella tabella "Uso quotidiano" e nella riga della tabella endpoint.
- Nuovi `backend/tests/unit/rotazione-archivio.test.js` (funzione pura: input degeneri,
  determinismo, rotazione che avanza sui giorni) e `backend/tests/integration/w-casuale.test.js`
  (200 con data d'archivio valorizzata e `no-store`, determinismo entro la giornata, canale senza
  archivio → placeholder 200, `?date=<data esatta>` invariato — nessuna regressione).

## 2026-08-02 — feat-i-preferiti-si-riconoscono-a-colpo-d-occhio
- Ogni riga del pannello «i tuoi preferiti» mostra ora la miniatura `30×64` del wallpaper del
  giorno segnato, accanto a data e nome del concept: chi ha messo da parte più giorni li
  riconosce per l'immagine, non deve riaprirli uno per uno per ricordare cosa fossero. Miniatura
  `.favmini`, metà esatta della `.copertina` `60×128` già in VISUAL_SPECS §2.1 (stesso rapporto
  15:32, stesso raggio `10px`, stesso bordo `rgba(255,255,255,.10)`) — nessun colore nuovo.
  `src` prodotta dalla stessa `srcFor` già usata dal viaggio, mai una seconda costruzione di URL;
  senza indirizzo utilizzabile la riga resta di solo testo come oggi. Miniatura decorativa
  (`alt=""`), il nome accessibile della riga resta "data + concept". La riga «↗ copia il link»
  non è un giorno e non riceve miniatura. Il pannello resta chiuso di default: le baseline
  `home-mobile.png`/`home-desktop.png` non cambiano.

## 2026-08-02 — feat-dal-giorno-d-archivio-si-continua-nel-viaggio
- La pagina di un giorno d'archivio di un canale ANCORA ATTIVO mostrava, in fondo, la stessa riga
  `riga3` calcolata solo con `rigaErede(id)` — vuota per costruzione per un canale attivo (nessun
  alias in `LEGACY_ALIASES`). Chi arrivava lì da `/archivi`, dal feed o da un link condiviso non
  aveva modo di tornare al canale vivo su quel giorno preciso: doveva rientrare in home e
  ricercare la data a mano, perdendo l'accesso a preferiti/storia dell'arco/condivisione/tastiera.
- `renderGiornoArchivio` calcola ora `riga3` come `rigaErede(id) || rigaInCorso(id, data)`: le due
  righe restano mutuamente esclusive (un canale attivo non ha mai erede). `rigaInCorso` accetta
  una `data` opzionale — con una stringa `AAAA-MM-GG` valida il link diventa
  `/?c=<id>&d=<data>` (la home già sa aprirsi su quel giorno via `sharedChannelId`/
  `sharedDateParam` in `page.js`) e il testo diventa «canale in corso — continua da questo
  giorno»; senza `data` (chiamata dall'elenco `/archivi`, dove non esiste un giorno singolo) il
  comportamento resta identico a prima, `href="/?c=<id>"` e testo «vai a …» — zero regressioni
  sull'elenco. La riga erede resta invece SENZA `&d=`: la data appartiene all'archivio del canale
  storico, non a quello dell'erede.
- Zero componenti/colori nuovi: stesso token `.riga3.continua`, stesso link `#8fd3ff` della riga
  erede (`VISUAL_SPECS.md` §2.2 aggiornato). Zero JS: `archivi.js` resta senza `<script>`.
- Nuovo `backend/tests/unit/archivi-giorno-continua.test.js`: canale attivo → link con `&d=` e
  testo «continua da questo giorno»; canale storico con erede → sola riga erede senza `&d=`; id
  ignoto → nessun link `/?c=`; elenco `/archivi` invariato.

## 2026-08-02 — feat-l-archivio-chiama-i-canali-col-loro-nome
- Le pagine d'archivio (`/archivi` e `/archivi/<id>`) chiamavano ogni canale col suo id tecnico
  (`natura`, `citta`, `quiete`) invece del nome vero (Natura, Città, Quiete): la card, l'`<h1>`
  e `<title>` della pagina del giorno, la meta description, l'anteprima condivisa e gli
  aria-label che citano il canale mostravano/leggevano l'id grezzo — un dettaglio implementativo
  esposto all'utente. Un tentativo precedente (ciclo 142) aveva provato ad aggiungere una riga
  tagline visiva; qui zero componenti nuovi, cambia solo il testo dentro i token già esistenti.
- Nuovo `displayName(id)` esportato da `backend/src/channels.js`: risolve col nome vero
  (`channel.name`) per un canale ancora attivo, l'id invariato per uno storico o sconosciuto —
  mai `null`, mai stringa vuota, coerente con la stessa convenzione già in uso su
  `/api/channels?all=1`.
- `backend/src/archivi.js` usa `displayName` ovunque il canale compare come testo per l'utente:
  `.nome` della card, aria-label di «Salva», «Riapri l'ultimo giorno», «un giorno a caso» e
  «Apri a grandezza piena…», l'`alt` dell'immagine del giorno, `<h1>`, `<title>`, meta
  description e i parametri testuali di `metaAnteprima`. Gli `href` e i parametri di query
  restano sempre sull'id tecnico: cambia solo ciò che si legge, mai dove porta il link.
- `VISUAL_SPECS.md` §2.1 e §2.2 aggiornati: la riga superiore della card e l'`<h1>`/`<title>`
  della pagina del giorno documentano ora la risoluzione nome-vero/id-storico.
- Nuovo `backend/tests/unit/archivi-nome-canale.test.js`: canale attivo → nome vero in card,
  h1, title, description e aria-label; canale storico e id sconosciuto → id invariato ovunque,
  nessun crash; href sempre sull'id tecnico anche quando il testo mostra il nome.

## 2026-08-02 — feat-i-preferiti-degli-altri-canali-non-si-perdono
- `renderFavList` (home) mostrava solo i giorni preferiti del canale in vista (`preferitiDi(chId)`)
  e nascondeva il comando «i tuoi preferiti» quando quel canale non ne aveva: chi segnava giorni
  su un canale e apriva la home su un altro (o vi arrivava dal canale ricordato) non vedeva alcuna
  traccia dei propri preferiti — né sapeva che esistevano. Peggio: se il canale coi preferiti era
  stato ritirato, quei giorni restavano irraggiungibili dalla home pur essendo ancora salvati in
  `localStorage` e pur avendo una pagina valida in `/archivi/<id>?date=`.
- Nuovo `preferitiAltrove(chId)` in `page.js`: legge `leggiPreferiti()` e restituisce le voci degli
  ALTRI canali (mai `chId`) con almeno una data valida (stesso filtro `dataValida` di
  `importaPreferiti`), date ordinate dal più recente al più vecchio come già fa `preferitiDi`.
- `renderFavList` aggiunge, in coda al pannello dopo la riga «copia il link», una `.arcrow` per
  ciascuna voce di `preferitiAltrove`: emoji del canale se ancora fra le card mostrate (altrimenti
  «⤳»), nome se noto (altrimenti l'id) seguito da «— N giorni segnati». Nessuna miniatura: la riga
  riassume più giorni, non ne rappresenta uno solo. Il click riapre il preferito più recente di
  quel canale riusando i percorsi già esistenti — mai una seconda implementazione del cambio
  canale: `/?c=<id>&d=<data>` (stesso meccanismo dei link condivisi) se il canale è ancora fra le
  card, `/archivi/<id>?date=<data>` se è stato ritirato. Id e data sempre `encodeURIComponent`.
- Corretta la visibilità di `#favpick`: nascosto solo quando non c'è alcun preferito né su questo
  canale né altrove, non più solo in base al canale mostrato. Con preferiti solo altrove il
  pannello contiene le sole righe degli altri canali, senza la riga «copia il link» (che
  trasferisce i preferiti di questo canale e non avrebbe nulla da copiare).
- `VISUAL_SPECS.md` §1.4 esteso: le righe degli altri canali riusano `.arcrow` senza introdurre
  alcun componente, colore o dimensione nuovi.
- Nuovo `backend/tests/unit/home-preferiti-altri-canali.test.js`: `preferitiAltrove` esclude
  sempre il canale corrente, ordina le date del più recente al più vecchio, scarta date non
  valide e canali che ne restano privi; `renderFavList` emette i due rami `/?c=`/`/archivi/` con
  `encodeURIComponent`; la nuova condizione di visibilità di `#favpick`; nessuna classe CSS nuova.
