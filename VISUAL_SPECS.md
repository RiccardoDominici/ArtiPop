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
- Componente distintivo: elenco piatto di card (una per canale storico), bordo
  `rgba(255,255,255,.10)`, sfondo `rgba(255,255,255,.03)`, raggio `14px` — stesso trattamento
  visivo delle voci `<details>` di §2, senza l'accordion (qui non c'è contenuto da comprimere).
  Riga superiore: id canale in `#f2f3f8` a sinistra, conteggio giorni in `#9aa3b8` a destra. Riga
  inferiore: intervallo date in `#9aa3b8`, link "Riapri l'ultimo giorno →" in `#8fd3ff`.
- Nessun `<script>`, nessuna `fetch(` nell'HTML servito: la lista arriva già pronta dal server
  (contratto CLAUDE.md — scansione KV solo su richiesta esplicita, mai nel giro di produzione).
- Lista vuota o scansione fallita: messaggio umano in `#9aa3b8` al posto dell'elenco, mai un
  contenitore vuoto o una pagina rotta.

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
