# VISUAL_SPECS.md — Linguaggio visivo di ArtiPop v3

Criteri oggettivi per il verifier. Ogni giudizio visivo si esprime come conformità
a queste regole, mai come gusto personale. Tre superfici, tre sistemi:
**Sito** (`/` e pagine servite dal worker), **Aiuto** (`/aiuto`), **Tuning tool**
(`tuning/index.html`, aperto via file://).

## 1. Sito worker — `/` (sorgente: backend/src/page.js)

### 1.1 Palette (esatta, custom properties)
| Token | Valore | Uso |
|---|---|---|
| `--bg` | `#0a0b10` | sfondo pagina e `theme-color` |
| `--card` | `rgba(255,255,255,.055)` | fondo card |
| `--card-border` | `rgba(255,255,255,.12)` | bordo card |
| `--text` | `#f2f3f8` | testo primario |
| `--dim` | `#9aa3b8` | testo secondario |
| `--a1`/`--a2` | dinamici per canale | accenti (gradiente) |

Accenti per canale (da channels.js): natura `#7ec8a9→#f2b878` ·
città `#4568dc→#b06ab3` · quiete `#c98d5a→#8a7fb5`.
**Regola**: nessun colore nuovo fuori da questi token senza aggiornare questa spec.

### 1.2 Tipografia
- Stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`. Nessun webfont.
- Scala: h1 `clamp(2.6rem,7vw,3.6rem)/800` con gradient-clip · hero p `1.02rem/1.55` ·
  card h2 `1.28rem/750` · tagline `.84rem` · scene `.8rem` corsivo ·
  setup h2 `1.6rem/750` · step h4 `1rem` · journey h3 `.82rem` uppercase ls `.12em` ·
  hint/footer `.78rem`.
- **Regola**: nuove dimensioni solo se già presenti nella scala; altrimenti proporre modifica alla spec.

### 1.3 Layout e spaziatura
- Mobile-first, `viewport-fit=cover` (safe-area rispettata sempre).
- Colonna singola centrata, `main max-width:1100px`; deck `min(340px,86vw)`, `360px` da 760px.
- Raggio card: `--radius: 26px`.

### 1.4 Componenti canonici
Deck di card trascinabili + dots · mockup iPhone (dynamic island, orologio live) ·
bottoni pill primary (gradiente canale) e ghost (vetro, `backdrop-filter: blur(14px)`) ·
step numerati con badge a gradiente · toast pill bottom-center · blob ambient animati ·
nota di freschezza (`.stale`, testo `.8rem` colore `--dim`, dentro `.cinfo` subito dopo
`.scene`): compare solo quando il canale è in ritardo (l'ultima immagine in archivio è
di un giorno precedente a oggi), dice la data reale; invisibile e senza alcun nodo nel
DOM quando il canale è aggiornato.

Elenco-tappe (`.arcstory`, feat-leggi-la-storia-dell-arco): righe testuali toccabili
dentro `.journey`, dietro il comando ghost `#storytoggle` ("leggi la storia"), chiuso di
default. Ogni riga (`.arcrow`, `<button>`, tap target min 44px) mostra la data breve
(`.arcdate`, `.74rem`, grassetto) e il testo della tappa (`.arctext`, `.8rem`); colore
`--dim` per le righe non correnti, testo pieno (classe `.on`) per la tappa del giorno
mostrato — nessun colore nuovo, stessa coppia già usata da `.stale`. Comando e blocco
invisibili quando la journey non è attiva o nessun giorno dell'arco ha testo narrativo.

Elenco-archi (`.arcstory` riusata su `#arclist`, feat-scegli-l-arco-dall-elenco): stessa
forma dell'elenco-tappe — righe `.arcrow` (tap target min 44px) dietro il comando ghost
`#arcpick` ("scegli l'arco"), chiuso di default. Ogni riga mostra l'intervallo di date
dell'arco (`.arcdate`) e il nome del concept (`.arctext`), con testo di ripiego se manca;
la riga dell'arco mostrato è evidenziata con `.on`. Comando invisibile con meno di due
archi o senza archivio disponibile — nessun colore o misura nuovi.

Archivio completo del canale (`#archlink`, feat-l-archivio-completo-del-canale-a-un-tocco —
proposta ai sensi di §7): comando ghost dentro `.journey`, subito dopo la didascalia "Solo
questa settimana…" — stessa pill `.btn.ghost` già canonica, nessun colore, token o misura
nuovi. Porta a `/archivi/<canale mostrato>`, l'archivio permanente (tutti i giorni, mese per
mese) del canale in cima alla pila; segue lo stesso canale di `#feedlink` e si aggiorna
insieme ad esso a ogni cambio card. Sempre visibile: è un `<a href>` reale, funzionante anche
senza JavaScript.

Ripiego senza JavaScript (`<noscript>`, feat-la-home-si-vede-anche-senza-javascript): un
elenco testuale (`.ns-list`) con una voce (`.ns-item`) per canale attivo — nome, wallpaper
di oggi in miniatura quando c'è un meta con data, link alla Shortcut del canale e link
diretto al wallpaper — più i rimandi a `/aiuto` e `/archivi`. Solo i token §1.1 (testo
`--text`, dim `--dim`, bordo `--card-border`, fondo `--card`, raggio `--radius`) e i tap
target da 44px già in uso altrove nella pagina. Zero `<script>`, zero `fetch`, zero
gestori inline: invisibile e senza alcun costo di rete quando il JavaScript è attivo,
perché il browser non renderizza né scarica il contenuto di `<noscript>` in quel caso.

Selettore di data (`#dayPick`, `<input type="date">`, feat-salta-al-giorno-che-cerchi —
proposta ai sensi di §7): campo nativo nella riga di navigazione del giorno, accanto alle
frecce ‹ ›. Sfondo `--bg`, testo `--text`, bordo `--dim`, `color-scheme: dark` per far
rendere in scuro anche i controlli nativi del browser (calendario/frecce del picker),
altezza minima pari a quella di `.dayctrl` (`2.3rem`). Nessun colore o token nuovo oltre
§1.1. `min`/`max`/`value` seguono sempre l'archivio del canale mostrato (più vecchio, più
recente, giorno corrente); invisibile insieme al resto di `.daynav` quando non c'è un
viaggio da sfogliare (meno di due giorni in archivio).

Preferiti (`#dayfav`/`#favpick`/`#favlist`, feat-segna-i-giorni-che-ti-piacciono — proposta ai
sensi di §7): comando ghost `#dayfav` nella fila dei comandi ghost del pannello, accanto a
"salva l'immagine" — etichetta e `aria-pressed` seguono se il giorno mostrato è segnato o no.
Comando ghost `#favpick` ("i tuoi preferiti") ed elenco `#favlist` che riusano integralmente
`.arcstory`/`.arcrow` (stessa forma dell'elenco-tappe e dell'elenco-archi: cambia il contenuto,
non la forma), chiuso di default. `--dim` per le righe non correnti, `.on` per quella del giorno
mostrato — nessun colore, token o misura nuovi. `#dayfav` invisibile insieme al resto dei comandi
del giorno quando non c'è un viaggio da sfogliare; `#favpick`/`#favlist` invisibili quando il
canale mostrato non ha alcun giorno segnato.

Componente aggiuntivo «miniatura di riga» (proposta ai sensi di §7,
feat-i-preferiti-si-riconoscono-a-colpo-d-occhio): in ogni riga `.arcrow` dell'elenco `#favlist`,
prima dei due `<span>` di testo, un `<img class="favmini">` `30×64` — esattamente metà della
`.copertina` `60×128` di §2.1, stesso rapporto 15:32 del wallpaper — `object-fit:cover`, raggio
`10px`, bordo `rgba(255,255,255,.10)`: stessi token già fissati per `.copertina`, nessun colore
nuovo. `alt=""` (decorativa: il nome accessibile della riga resta il testo data + concept),
`loading="lazy"`, `decoding="async"`. La riga passa a `display:flex; align-items:center;
gap:.6rem` per accostare miniatura e testo, conservando l'area di tocco ≥44px già richiesta per
`.arcrow`. Presente solo quando l'indirizzo dell'immagine è disponibile: senza, la riga resta di
solo testo come oggi, mai un `<img src="">`. La riga «↗ copia il link dei tuoi preferiti» non è
un giorno e non riceve miniatura. Componente proposto, pannello `#favlist` chiuso di default:
le baseline `home-mobile.png`/`home-desktop.png` non cambiano.

Righe degli altri canali (proposta ai sensi di §7, feat-i-preferiti-degli-altri-canali-non-si-
perdono): in coda a `#favlist`, dopo la riga «↗ copia il link dei tuoi preferiti», una `.arcrow`
per ciascun altro canale con almeno un giorno segnato — stessa forma delle righe esistenti (tap
target min 44px), senza miniatura: la riga riassume più giorni, non ne rappresenta uno solo.
Colonna `.arcdate`: l'emoji del canale se ancora fra le card mostrate, altrimenti il segno «⤳».
Colonna `.arctext`: il nome del canale se noto, altrimenti l'id, seguito da «— N giorni segnati»
(singolare/plurale corretti). Al tocco porta al preferito più recente di quel canale: `/?c=<id>&
d=<data>` (stesso meccanismo dei link condivisi) se il canale è ancora fra le card, `/archivi/<id
>?date=<data>` se è stato ritirato. `#favpick`/`#favlist` restano visibili anche quando il canale
mostrato non ha preferiti propri ma ne esistono altrove — in tal caso il pannello contiene solo
queste righe, nessuna riga «copia il link» (non ci sarebbe nulla da trasferire). Nessun colore,
token o componente nuovo: cambia solo il contenuto della riga.

Un giorno a caso (`#dayrand`, feat-riscopri-un-giorno-a-caso — proposta ai sensi di §7):
comando ghost `#dayrand` ("🎲 un giorno a caso") nella fila dei comandi del pannello, accanto
a "segna preferito" — stessa pill `.btn.ghost` già canonica, nessun colore, token o misura
nuovi. Invisibile insieme al resto dei comandi del giorno quando non c'è un viaggio da
sfogliare, E quando l'archivio noto del canale mostrato ha meno di due date. Al tocco apre un
giorno d'archivio diverso da quello mostrato, pescato a caso; se non ce n'è nessun altro un
toast avvisa e la vista non cambia.

Condividi l'immagine (`#dayshareimg`, feat-condividi-l-immagine-del-giorno — proposta ai sensi
di §7): comando ghost nella fila dei comandi del pannello, accanto a "salva l'immagine" —
stessa pill `.btn.ghost` già canonica, nessun colore, token o misura nuovi. Invisibile insieme
al resto dei comandi del giorno quando non c'è un viaggio da sfogliare, E dove il browser non
dichiara di saper condividere file (`navigator.share`/`navigator.canShare({files})`) — compreso
il Chromium headless di `visual-check`, che non implementa `canShare`: per questo le baseline
`home-mobile.png`/`home-desktop.png` restano invariate. Al tocco passa il file immagine del
giorno mostrato (stessa URL di "apri l'immagine") al foglio di condivisione di sistema, con
ripiego sul comportamento di `#dayshare` (copia link) per qualunque errore diverso
dall'annullamento dell'utente.

Riga dell'eredità (`.eredita`, feat-la-home-dice-da-dove-viene-questo-canale — proposta ai
sensi di §7): dentro `.cinfo`, in coda dopo l'eventuale `.stale` — stessa coppia di token
(testo `.8rem`, colore `--dim`). Elenca i vecchi id che il canale ha ereditato, con un
link sottolineato (colore `--a1`, già in uso per i link della pagina) a `/archivi`.
Assente e senza alcun nodo nel DOM per i canali senza alias storici.

Nota di connessione (`#netstate`, feat-la-home-dice-quando-sei-senza-rete): riga `.hint`
dentro l'hero, subito dopo `#nextdrop` — stesso posto, stesso registro di linguaggio della
nota di freschezza. Compare (toglie `hidden`) solo quando il browser dichiara l'assenza di
rete (`navigator.onLine === false`), e sparisce da sola al ritorno della rete, senza
ricaricare la pagina; nessun colore o misura nuovi oltre `.hint` (`.78rem`, colore `--dim`).
Invisibile nell'HTML servito (`hidden`) a chi è online e a chi ha JavaScript disattivato.

Fila dei comandi (`.actions`, proposta ai sensi di §7, feat-i-comandi-del-viaggio-non-si-
accavallano): contenitore canonico di ogni gruppo di pill `.btn` — `display:flex; gap:.6rem;
flex-wrap:wrap; justify-content:center` — già in uso sotto il deck e, da questo ciclo, anche
dentro `.journey`, dove i comandi erano figli diretti della sezione (elementi inline, senza gap
né controllo dell'andata a capo: si accalcavano fino a toccarsi, §5.4, con area di tocco sotto
i 44px, §5.5). Dentro `.journey` le file sono quattro, separate da `margin-top:.8rem` (stessa
misura già usata da `.jhead`, `.dcap` e `.arcstory`): (1) archivio del canale — il solo
`#archlink`, subito dopo la didascalia «Solo questa settimana…»; (2) navigazione nel viaggio —
`#dayPick`, `#arcprev`, `#arcnext`, subito sotto `.daynav`; (3) comandi del giorno mostrato —
`#dayshare`, `#dayopen`, `#daysave`, `#dayshareimg`, `#dayfav`, `#dayrand`, `#daytoday`;
(4) pannelli — `#storytoggle`, `#arcpick`, `#favpick`, con i tre elenchi `.arcstory`
(`#arcstory`, `#arclist`, `#favlist`) impilati subito sotto la fila, nello stesso ordine dei
rispettivi comandi: un pannello aperto compare sotto la fila che lo comanda, come già oggi.
Ogni pill `.btn` porta `min-height:44px` — misura già canonica in questa spec per `.arcrow` e
per le voci `.ns-item a` — così l'area di tocco rispetta §5.5 anche dove l'etichetta è corta.
Nessun colore, token o dimensione nuovi: cambia il contenitore, non le pill.
Le pill (`.btn:not([hidden])`) sono `display:inline-flex` con contenuto centrato, per allineare
verticalmente sia `<button>` sia `<a class="btn ...">` nella stessa fila; il `:not([hidden])`
è la guardia obbligatoria che evita di rendere visibili i comandi ancora nascosti. Una fila
`.journey .actions` senza alcun figlio visibile (`:not(:has(> :not([hidden])))`) collassa a
`display:none`, così da non lasciare spazio vuoto prima che il JS tolga gli `hidden`.
`.daynav` e `.arcstory` portano la regola esplicita `[hidden]{display:none}`, perché il loro
display autore flex/grid vincerebbe sullo stile UA e li mostrerebbe anche da nascosti — è ciò
che teneva i pannelli sempre aperti.

Blob ambient (aggiornamento ai sensi di §7, stesso ciclo): i due `.blob` cambiano colore
insieme al canale in cima **senza dissolvenza** (via la `transition: background 1.2s`). La
dissolvenza obbligava il browser a ricalcolare per 1,2 s un `blur(90px)` su due superfici da
65vmax proprio mentre la card vola via, e rendeva scattoso il cambio canale: principio 1
(utilizzabilità) prima del principio 2. Il passaggio graduale resta dove non costa nulla —
`h1` con gradient-clip e pill `.btn` conservano la loro `transition: background 1.2s ease`.
Geometria, opacità e token dei blob restano identici.

### 1.5 Modalità colore
Solo dark, hardcoded. Introdurre light mode è FUORI SCOPE (v. Esclusioni ROADMAP).

## 2. Pagina `/aiuto` (sorgente: backend/src/help.js)

Stato attuale: foglio di stile autonomo, parzialmente disallineato dal sito
(testo `#e9e9f0` vs `#f2f3f8`; stack font senza "SF Pro Display"; link `#8fd3ff`).

**Target di conformità** (dopo la milestone di allineamento):
- Palette: stessi token del sito (`--bg #0a0b10`, `--text #f2f3f8`, `--dim #9aa3b8`).
- Link: `#8fd3ff` resta il colore link ufficiale della pagina aiuto (unico extra ammesso).
- Tipografia: h1 `clamp(1.8rem,6vw,2.4rem)` · h2 `1.15rem` · label `.74rem` uppercase ls `.1em` ·
  code `ui-monospace, SFMono-Regular, Menlo`.
- Componente distintivo: accordion `<details>/<summary>` con marker `＋/－`;
  variante "hot" con bordo `rgba(143,211,255,.42)`.
- Componente di ricerca: campo `<input type="search">` in cima, sotto il sottotitolo — bordo
  `rgba(255,255,255,.10)`, sfondo `rgba(255,255,255,.03)`, raggio `14px`, testo `#f2f3f8`,
  placeholder `#9aa3b8`, altezza minima `44px` (nessun token nuovo, riuso di quelli esistenti).
  Nasce `hidden` nel markup servito: compare solo se lo script della pagina gira (progressive
  enhancement), così senza JavaScript la pagina resta identica a prima.
- Layout: colonna `max-width:720px`, design piatto (niente blur/gradienti): è una pagina di lettura.
- Blocco stato dei canali (feat-l-aiuto-dice-se-il-canale-e-fermo): elenco piatto (`<ul>` senza
  bullet) subito sotto il campo di ricerca, prima della sezione «Qualcosa non funziona». Una riga
  per canale: nome in `#f2f3f8` a sinistra, esito in `#9aa3b8` a destra ("aggiornato oggi" /
  "fermo da N giorni" / "nessuna immagine ancora"). Separatore `rgba(255,255,255,.08)` fra le
  righe, nessun colore semaforo. Nessun token nuovo. Reso dal server: compare solo quando lo
  stato dei canali è disponibile (assente in caso di errore di lettura — la pagina resta identica
  a prima, mai un contenitore vuoto).

### 2.1 Pagina `/archivi` (sorgente: backend/src/archivi.js)

Adozione integrale dei token e del layout piatto di §2: stesso `--bg #0a0b10`, `--text #f2f3f8`,
`--dim #9aa3b8`, link `#8fd3ff`, stesso stack font, stessa colonna `max-width:720px`. Nessun colore
o componente nuovo.
- Componente distintivo: elenco piatto di card (una per canale con giorni in archivio, storico o
  ancora attivo — proposta ai sensi di §7, feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-
  archivio), bordo `rgba(255,255,255,.10)`, sfondo `rgba(255,255,255,.03)`, raggio `14px` — stesso
  trattamento visivo delle voci `<details>` di §2, senza l'accordion (qui non c'è contenuto da
  comprimere). Riga superiore: nome del canale in `#f2f3f8` a sinistra — proposta ai sensi di §7,
  feat-l-archivio-chiama-i-canali-col-loro-nome: il nome vero (`displayName(id)` di
  backend/src/channels.js, es. «Natura») per un canale ancora attivo, l'id invariato per uno
  storico — conteggio giorni in `#9aa3b8` a destra. Riga inferiore: intervallo date in `#9aa3b8` — ciascuna in forma estesa italiana ("31
  gennaio 2026") dentro un `<time datetime="YYYY-MM-DD">` (proposta ai sensi di §7, feat-le-date-d-
  archivio-si-leggono-in-italiano; con chiave non valida resta il testo grezzo, senza `<time>`) —,
  link "Riapri l'ultimo giorno →" (verso `/archivi/<id>?date=<ultima>`,
  §2.2) in `#8fd3ff`. Terza riga, mutuamente esclusiva, stessi token (`<div class="riga3
  continua">`, testo `#9aa3b8`, link `#8fd3ff`): quando il canale storico ha un erede attivo
  (`LEGACY_ALIASES` di backend/src/channels.js) «la storia continua in {emoji} {nome} →» verso
  `/?c=<erede>`; quando il canale è esso stesso ancora attivo (proposta ai sensi di §7,
  feat-anche-i-canali-di-oggi-hanno-la-loro-pagina-d-archivio) «canale in corso — vai a {emoji}
  {nome} →» verso `/?c=<id>`. Nessuna riga aggiuntiva quando né l'uno né l'altro caso si applica —
  stessi token, nessun colore o componente nuovo.
- Nessun `<script>`, nessuna `fetch(` nell'HTML servito: la lista arriva già pronta dal server
  (contratto CLAUDE.md — scansione KV solo su richiesta esplicita, mai nel giro di produzione).
- Lista vuota o scansione fallita: messaggio umano in `#9aa3b8` al posto dell'elenco, mai un
  contenitore vuoto o una pagina rotta.
- Componente aggiuntivo «tutti i N giorni» (proposta ai sensi di §7): dentro ogni card, dopo la
  riga dell'intervallo, un `<details class="giorni">` — stesso trattamento visivo dell'accordion
  di §2, nessun token nuovo. `<summary>` esterno in `#9aa3b8`; una volta aperto, un
  `<details class="mese">` per ogni mese di calendario delle date del canale (proposta ai sensi di
  §7, feat-l-archivio-storico-si-sfoglia-per-mese), nell'ordine già ricevuto (dalla più recente alla
  più vecchia), stesso trattamento visivo dell'accordion di §2: `<summary>` «{mese} {anno} — N
  giorn(o|i)» in forma estesa italiana, in `#9aa3b8`, nessun colore o dimensione nuovi. Dentro
  ciascun gruppo, lo stesso elenco di link a ogni giorno (`/archivi/<id>?date=<data>`, §2.2, in
  `#8fd3ff`) e lo stesso link di salvataggio `↓` di sempre. Chiavi data non riconoscibili come
  `YYYY-MM-DD` confluiscono nell'ultimo gruppo «altri giorni», mai scartate. Presente solo
  quando la scansione ha raccolto le date del canale (chiamata legacy o `date` vuoto: nessun
  `<details>`, card identica a quella dei cicli 80-81).
  Ogni voce di giorno (proposta ai sensi di §7, feat-l-archivio-del-mese-si-sfoglia-a-colpo-d-occhio)
  porta, dentro lo stesso link/testo `aria-current`, una miniatura `44×94` + data + `↓`:
  `<img class="minigiorno" src="/w/<id>?date=<data>">` — stessi token `.copertina`/`.mini` di questa
  sezione (`object-fit:cover`, raggio `8px`, bordo `rgba(255,255,255,.10)`, sfondo
  `rgba(255,255,255,.03)`), nessun colore o dimensione fuori da quelli già dichiarati in §2.1.
  `alt=""`, `loading="lazy"`, `decoding="async"`: la miniatura è decorativa e sta dentro l'area
  toccabile già esistente, il nome accessibile della voce resta la sola data.
- Componente aggiuntivo «miniatura di copertina» (proposta ai sensi di §7): a sinistra di ogni
  card, un `<a class="copertina">` con dentro `<img>` `60×128`, `object-fit:cover`, raggio `10px`,
  bordo `rgba(255,255,255,.10)`, sfondo `rgba(255,255,255,.03)` — stessi token del bordo/raggio
  già in uso in questa sezione, nessun colore nuovo. `src` resta `/w/<id>?date=<ultima>` (il byte
  dell'immagine), `href` è `/archivi/<id>?date=<ultima>` (§2.2) — stesso indirizzo del link
  "Riapri l'ultimo giorno →", `loading="lazy"`, `decoding="async"`,
  `alt=""` (decorativa: id e link nominano già il canale). Il resto della card (riga1, riga2,
  `<details class="giorni">`, riga3) si dispone a destra della miniatura, invariato nel contenuto.
  Presente solo quando il canale ha un `ultima` non vuoto: card senza miniatura, mai un
  contenitore vuoto o un'immagine rotta.
- Componente aggiuntivo «link di salvataggio» (proposta ai sensi di §7): riusa la rotta
  `/w/<id>?date=<data>&dl=1` (content-disposition con nome parlante, backend/src/index.js:616),
  già raggiungibile dalla home ma non da `/archivi`. Due punti di emissione, stessi token del
  resto della sezione (link `#8fd3ff`, nessun colore o componente nuovo, area di tocco ≥44px,
  `display: inline-flex; align-items: center`): un `<a class="salva">Salva</a>` in `riga2`, subito
  dopo "Riapri l'ultimo giorno →"; e un `<a class="salva-giorno">↓</a>` accanto a ogni data
  dell'elenco `<details class="giorni">`, con `aria-label` che nomina la data (il glifo da solo
  non è autoesplicativo). `riga2` può andare a capo (`flex-wrap: wrap`) sui viewport stretti
  invece di comprimere i link. Presente solo quando `ultima`/`date` sono valorizzati — stessa
  guardia della miniatura di copertina: card senza dati, nessun link di salvataggio.
- Componente aggiuntivo «riga del soggetto» (proposta ai sensi di §7): dentro `.contenuto`, subito
  sotto riga1, un `<div class="soggetto">` in `#9aa3b8`, `font-size:.88rem` — stessi token delle
  altre righe secondarie di questa sezione (`.intervallo`, `.riga3`), nessun colore o misura
  nuovi. Contenuto: nome dell'element e del concept dell'ultimo giorno del canale, separati da
  «·» (`{elementNome} · {conceptNome}`); se solo uno dei due è presente, quel nome da solo, senza
  separatore orfano. Presente solo quando almeno uno dei due nomi è disponibile (carta d'identità
  registrata in KV o ricostruzione onesta per i canali a tema fisso, `RICOSTRUZIONE_STORICA` in
  backend/src/handlers.js): card senza dati, nessuna riga del soggetto, mai un contenitore vuoto.

### 2.2 Pagina giorno d'archivio `/archivi/<id>` (sorgente: backend/src/archivi.js, proposta ai sensi di §7)

Adozione integrale dei token di §2/§2.1: nessun colore, componente o dimensione nuovi — questa
sottosezione fissa solo la composizione. Stesso `--bg #0a0b10`, `--text #f2f3f8`, `--dim #9aa3b8`,
link `#8fd3ff`, stesso stack font, stessa colonna `max-width:720px`, stesso `<head>`
(`INSTALL_TAGS`, `metaAnteprima`).
- Intestazione: link `.back` "← tutti gli archivi" verso `/archivi` — stesso stile del link `.back`
  di §2.1 verso `/`. `<h1>` e `<title>` col nome del canale — proposta ai sensi di §7,
  feat-l-archivio-chiama-i-canali-col-loro-nome: il nome vero (`displayName(id)`) per un canale
  ancora attivo, l'id invariato per uno storico, stessa risoluzione di §2.1 — sotto un
  `<p class="sub">` con la data del giorno mostrato — stessi token di `h1`/`.sub` già in uso in
  §2/§2.1. La data è in forma estesa
  italiana ("2 agosto 2026") dentro un `<time datetime="YYYY-MM-DD">` (proposta ai sensi di §7,
  feat-le-date-d-archivio-si-leggono-in-italiano; con chiave non valida resta il testo grezzo,
  senza `<time>`), coerente con l'anteprima social dello stesso giorno (`dataEstesaItaliana`,
  head.js).
- Riga del soggetto: stesso `<div class="soggetto">` di §2.1 (stessi token, stessa guardia —
  presente solo se almeno un nome è disponibile), subito sotto l'intestazione.
- Riga della posizione: stesso `<div class="soggetto">` di §2.1/sopra (stessi token, stessa guardia),
  col testo «arco N · giorno M · tappa K» composto dalle sole voci disponibili (`Number.isFinite`,
  non un test di verità: 0 è un valore valido, non un'assenza) — i giorni ricostruiti di
  `handlers.js` hanno `arco/giornoNellArco/tappa: null`, quindi nessuna riga vuota — subito dopo la
  riga del soggetto e prima della riga del racconto. Nessun token nuovo: riusa `<div class="soggetto">`
  già esistente, nessuna regola CSS, colore o dimensione aggiunti.
- Riga del racconto: `<p class="racconto">` col testo della tappa in `#f2f3f8` (stesso `--text`),
  emessa solo se il testo è disponibile — i giorni ricostruiti di `handlers.js` hanno
  `testoTappa: null`, quindi nessun paragrafo vuoto — subito dopo la riga della posizione e prima
  della riga di posizione nell'archivio. Nessun `font-size` nuovo: stessa dimensione di corpo già
  in uso.
- Immagine: `<figure>` con `<img src="/w/<id>?date=<data>">`, `alt` descrittivo (canale + data),
  `loading="lazy"`, `decoding="async"`. Più grande della miniatura di copertina di §2.1 (non
  `60×128`) ma contenuta: `max-width:420px`, centrata, stesso bordo `rgba(255,255,255,.10)` e
  raggio `14px` delle card di §2.1 (non il `10px` della miniatura). L'`<img>` è avvolta da un
  `<a class="apri" href="/w/<id>?date=<data>" target="_blank" rel="noopener">` verso lo stesso URL
  del `src` — apre il wallpaper a grandezza piena in una nuova scheda, come già il bottone «apri
  l'immagine» della home (proposta ai sensi di §7, feat-il-wallpaper-d-archivio-si-apre-a-grandezza-piena).
  L'`<a>` porta un `aria-label` descrittivo («Apri a grandezza piena il wallpaper di <id> del
  <data>») così lo screen reader non legge due volte l'`alt`, e un focus visibile (`outline: 2px
  solid #8fd3ff`, stesso colore link già in uso). Nessun token nuovo: nessuna dimensione, colore o
  componente oltre a quelli già presenti in §2/§2.1.
- Barra di navigazione: `<nav>` con «← giorno precedente» / «giorno successivo →» in `#8fd3ff`,
  area di tocco ≥44px (`display:inline-flex; align-items:center`) come gli altri link di §2/§2.1.
  Il comando assente al bordo dell'archivio (giorno più vecchio o più recente) non viene emesso:
  mai un link disabilitato o morto. Accanto, un `<a class="salva">Salva</a>` verso
  `/w/<id>?date=<data>&dl=1` — stesso trattamento del link "Salva" di §2.1.
- Miniature dei giorni adiacenti (proposta ai sensi di §7, feat-il-giorno-d-archivio-mostra-dove-porta-il-passo-avanti):
  ciascuno dei due comandi «← giorno precedente» / «giorno successivo →» porta, sopra il testo, una
  `<img class="mini" src="/w/<id>?date=<data adiacente>">` — stesso token `.copertina` `60×128` di
  §2.1 (`object-fit:cover`, raggio `10px`, bordo `rgba(255,255,255,.10)`), nessun colore, dimensione
  o componente nuovi. `alt=""`, `loading="lazy"`, `decoding="async"`: la miniatura è decorativa, il
  nome accessibile del link resta il testo. Il link diventa `display:inline-flex;
  flex-direction:column; gap:6px; align-items:center`, conservando l'area di tocco ≥44px richiesta
  sopra. Stessa guardia del comando che la contiene: al bordo dell'archivio (giorno più vecchio o
  più recente) il comando assente non viene emesso, e con esso la sua miniatura — mai un `src` vuoto
  o riferito a una data non in archivio.
- Segui col lettore di feed (proposta ai sensi di §7, feat-dall-archivio-si-segue-il-canale-col-lettore-di-feed):
  nella stessa barra di navigazione, un `<a class="salva">segui col lettore di feed</a>` verso
  `/feed/<id>.xml` — stesso token `.salva` (colore `#8fd3ff`, area di tocco ≥44px) del link "Salva"
  accanto, nessun colore o dimensione nuovi. Nel `<head>`, accanto a `canonicalTag`, l'autodiscovery
  `<link rel="alternate" type="application/rss+xml" href="<origin>/feed/<id>.xml">` (`feedLinkTag`
  di `head.js`, stessa funzione già usata dalla home) — emessa solo se `origin` è disponibile, come
  `canonicalTag`/`metaAnteprima`: mai un `href` vuoto o assente in modo incoerente.
- Un giorno a caso (proposta ai sensi di §7, feat-riscopri-un-giorno-a-caso-dall-archivio): nella
  stessa barra di navigazione, dopo «segui col lettore di feed», un `<a class="salva">un giorno a
  caso</a>` verso `/archivi/<id>?date=casuale` — stesso token `.salva` (colore `#8fd3ff`, area di
  tocco ≥44px) dei link accanto, nessun colore o dimensione nuovi. Emesso solo se l'archivio ha
  almeno 2 giorni: con un giorno solo porterebbe sempre alla pagina già aperta, un link inutile.
- Salto agli estremi e posizione nell'archivio (proposta ai sensi di §7,
  feat-dal-giorno-d-archivio-si-salta-al-primo-e-all-ultimo): nella stessa barra di navigazione,
  dopo «giorno successivo →», due `<a class="estremo">` — «⇤ primo giorno» verso la data più
  vecchia e «ultimo giorno ⇥» verso la più recente dell'archivio del canale — colore `#8fd3ff` e
  area di tocco ≥44px ereditati dalla regola `nav.giorni-nav a` già in uso, nessun colore,
  dimensione o componente nuovi. `aria-label` esplicito che nomina canale e data di destinazione,
  come gli altri link della pagina. Ciascun link è omesso quando punterebbe al giorno già mostrato
  (sul giorno più recente niente «ultimo giorno», sul più vecchio niente «primo giorno», con un
  solo giorno in archivio nessuno dei due): mai un link verso se stessi, stessa regola
  dell'elenco dei giorni. Sotto la riga del racconto, un `<p class="posizione-archivio">` col testo
  «giorno N di M dell'archivio» (M = giorni totali, N = 1 per il più vecchio) negli stessi token
  `.riga3` (`.88rem`, `#9aa3b8`) — assente quando l'archivio è vuoto o il giorno mostrato non vi
  appartiene, mai «giorno 0 di 0».
- Elenco «tutti i N giorni»: stesso componente `<details class="giorni">` di §2.1, raggruppato per
  mese negli stessi `<details class="mese">` (stesso summary «{mese} {anno} — N giorn(o|i)», stessi
  link `/archivi/<id>?date=<data>` e di salvataggio `↓`, stesso ordine dalla più recente alla più
  vecchia), subito dopo la barra di navigazione — presente solo se l'archivio ha almeno un giorno.
  Il gruppo mensile che contiene il giorno mostrato è aperto di default (`open`), gli altri restano
  chiusi; con un solo gruppo, quel gruppo resta aperto comunque. La voce del giorno mostrato non è
  un link verso se stessa: testo semplice marcato `aria-current="page"`, mantenendo comunque il
  link di salvataggio `↓` della riga.
- Riga erede: quando il canale ha un erede attivo, la stessa riga «la storia continua in …» di
  §2.1 (stessi token, stessa guardia), sotto l'elenco dei giorni.
- Riga canale in corso (proposta ai sensi di §7, feat-dal-giorno-d-archivio-si-continua-nel-viaggio):
  quando il canale è ancora attivo (e quindi senza erede — le due righe sono mutuamente esclusive),
  al posto della riga erede una riga «canale in corso — continua da questo giorno» verso
  `/?c=<id>&d=<data>`, con `<data>` quella del giorno mostrato — stessi token `.riga3.continua` e
  colore link `#8fd3ff` della riga erede, nessun componente, colore o dimensione nuovi. Nell'elenco
  `/archivi` (§2.1) la stessa riga resta invariata: href `/?c=<id>` senza `&d=`, testo «canale in
  corso — vai a …», perché lì non esiste un giorno singolo da riprendere.
- Scorciatoie da tastiera (proposta ai sensi di §7, feat-il-giorno-d-archivio-si-sfoglia-con-la-tastiera):
  `←` e `→` seguono i link «giorno precedente» / «giorno successivo», `Home` e `End` i due
  `<a class="estremo">` («⇤ primo giorno» / «ultimo giorno ⇥»), marcati `data-nav="primo"`/
  `data-nav="ultimo"` perché lo script non dipenda dall'ordine dei nodi. **Nessun elemento visibile
  aggiunto, nessun token, colore o dimensione nuovi: l'aspetto della pagina non cambia.**
  Miglioramento progressivo: senza JavaScript la pagina resta identica e tutti i link restano
  cliccabili; al bordo dell'archivio, dove il link non è emesso, il tasto non fa nulla. Lo script
  non agisce con un modificatore premuto (`meta`/`ctrl`/`alt`) né col fuoco in un campo di testo
  (`input`, `textarea`, `select`, `contenteditable`), e chiama `preventDefault()` solo quando
  naviga davvero.
- Copia link (proposta ai sensi di §7, feat-il-giorno-d-archivio-si-condivide-con-un-tocco):
  in coda alla stessa barra di navigazione, dopo «un giorno a caso», un
  `<button class="salva copia-link" type="button">copia link</button>` — stesso trattamento
  del link `.salva` accanto (colore `#8fd3ff`, `font-weight:600`, area di tocco ≥44px,
  `background:transparent`, nessun bordo): nessun colore, dimensione o componente nuovi, il
  bottone si legge come gli altri comandi della barra. `aria-label` esplicito che nomina data e
  canale, come gli altri comandi della pagina. Miglioramento progressivo: nel markup il bottone
  è `hidden` (con regola CSS `[hidden] { display:none }` esplicita, perché la regola
  `display:inline-flex` non lo scopra) e viene mostrato solo se il browser espone
  `navigator.clipboard` — senza JavaScript o in contesto non sicuro l'aspetto della pagina non
  cambia e non compare alcun comando che non funziona. L'indirizzo copiato è quello canonico già
  emesso nel `<head>` (`<link rel="canonical">`), con ripiego su `location.href` quando l'origin
  non è noto al render. Conferma ed errore sono il solo cambio di testo dentro il bottone
  («link copiato» / «copia non riuscita», ~2s poi ritorno a «copia link»): nessun toast, nessun
  overlay, nessun componente nuovo da progettare.
- Un solo `<script>` inline nell'HTML servito — quello delle scorciatoie e della copia del link
  qui sopra, due IIFE nello STESSO blocco, e nessuna `fetch(`: la pagina resta server-rendered e
  non fa rete. §2.1 (`/archivi`) e la pagina d'errore qui sotto restano senza alcuno `<script>`.
- Pagina d'errore (id sconosciuto, canale senza archivio, `?date=` non presente in archivio):
  messaggio umano in `#9aa3b8` e link a `/archivi`, stesso `<head>` e stessa palette — mai JSON,
  mai la pagina d'errore generica di Cloudflare (principio 3 di CLAUDE.md). Quando il canale ha
  almeno un giorno in archivio, la pagina emette in più lo stesso `<details class="giorni">`
  raggruppato per mese di §2.1 (stesso summary esterno e per gruppo, stessi link
  `/archivi/<id>?date=<data>` e di salvataggio `↓`, stesso ordine dalla più recente alla più
  vecchia), senza alcuna voce marcata `aria-current="page"` e senza alcun gruppo `open` (nessun
  giorno dell'elenco è quello mostrato) — salvo il caso di un solo gruppo mensile, che resta aperto
  come in §2.1. Con archivio vuoto o id sconosciuto la pagina resta al solo messaggio, nessun
  `<details>` con zero voci. Nessun `<script>`.

## 3. Tuning tool (sorgente: tuning/tool.css, tuning/index.html)

Tool interno desktop-first: densità alta è una scelta, non un difetto.
- Palette: `--bg #0e0f14` · `--panel #171922` · `--panel2 #1e212d` · `--line #2b2f3d` ·
  `--text #e9ebf2` · `--dim #98a0b6` · `--accent #7ec8a9` · `--accent2 #4568dc` ·
  `--ok #57c98a` · `--warn #e8a13b` · `--bad #e5605e` · `--radius 12px`.
- Tipografia: base `14px`; h1 `18px` · card h3 `15px` · badge/pill `10-12px`.
- Layout: `main max-width:1500px`, header sticky, griglie `auto-fill minmax(340px,1fr)`,
  filmstrip orizzontali; non pensato per mobile (nessun requisito mobile).
- Componenti: card piatte senza ombre · pill di stato on/off/warn · tab piatte ·
  chip con pallino colore · lightbox · segmented a 2 stati · `button.warn`/`.warnbox`
  per azioni distruttive · toast bottom-right · spinner CSS.
- Azioni distruttive (pubblica in produzione, sovrascrivi range): SEMPRE stile warn + conferma.

## 4. Wallpaper generati (endpoint /w/*)

Non si giudica il contenuto artistico (instabile), solo vincoli meccanici:
- Dimensioni esatte 960×2048, formato JPEG, peso < 1.5 MB.
- Nessuna immagine nera/monocroma (varianza minima — già coperta dal cancello a misure del backend).
- `?date=` di un giorno archiviato restituisce sempre la stessa identica immagine (byte-stabile).

## 5. Difetti visivi (definizione operativa — un FAIL su questi è un FAIL del criterio)

1. **Overflow orizzontale**: `scrollWidth > clientWidth` sul body a viewport 390×844 o 1280×800.
2. **Testo troncato**: ellipsis o clipping non intenzionale su titoli/bottoni alle viewport chiave.
3. **Contrasto insufficiente**: testo primario < 4.5:1 sul suo sfondo; testo secondario < 3:1.
4. **Sovrapposizioni**: elementi interattivi che si coprono a vicenda alle viewport chiave.
5. **Tap target**: bottoni/link < 44×44 px effettivi su mobile (sito e /aiuto; il tuning tool è esente).
6. **Colori fuori palette**: hex non presenti in questa spec (tolleranza: ±0 — la spec si aggiorna, non si ignora).
7. **Safe-area violata**: contenuto del sito sotto notch/home-indicator a 390×844 con viewport-fit=cover.
8. **Regressione baseline**: differenza strutturale rispetto a tests/visual/baseline/ non giustificata
   dal piano del ciclo (il verifier confronta a occhio gli screenshot, non pixel-perfect diff:
   layout spostato, sezioni sparite, componenti deformati).

## 6. Viewport chiave per visual-check

| Nome | Dimensioni | Superfici |
|---|---|---|
| mobile | 390×844 (iPhone) | `/`, `/aiuto` |
| desktop | 1280×800 | `/`, `/aiuto`, tuning tool |

Screenshot full-page in artifacts/ con nomi stabili:
`home-mobile.png`, `home-desktop.png`, `aiuto-mobile.png`, `aiuto-desktop.png`,
`tuning-desktop.png`, `w-natura.jpg` (immagine del giorno, solo vincoli §4).

## 7. Processo di modifica della spec

Se un ciclo vuole introdurre un colore/dimensione/componente non previsto:
il planner lo dichiara in PLAN.md come "proposta di modifica VISUAL_SPECS §X",
l'executor aggiorna la spec nello stesso ciclo, il verifier giudica contro la spec aggiornata.
Mai improvvisare fuori spec senza questa trafila.
