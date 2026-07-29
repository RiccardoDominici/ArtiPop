# Redesign del tool di tuning — specifica vincolante

Questo documento è la specifica UX del tool (`tuning/`). È la fonte di verità per
qualunque intervento sull'interfaccia: il piano tecnico la decompone in task, non
la reinterpreta.

## Diagnosi (perché il tool oggi non funziona bene)

1. **La coppia concept×element non esiste come oggetto nell'interfaccia.** È
   l'unità mentale con cui si ragiona ("quali combinazioni sono venute bene"),
   ma il Lab butta via i run appena cambi tab, l'Archivio è una pellicola piatta
   di giorni, Concept ed Element sono due liste CRUD scollegate. Ogni esperimento
   riparte da zero contesto.
2. **La provenienza esiste nei dati ma non nell'interfaccia.** Il backend salva
   per ogni giorno la "carta d'identità" completa (concept, element, tappa,
   misure, profilo in vigore, collaudo), ma il tool la mostra solo in parte,
   la degrada a "combinazione non nota" senza distinguere i casi, e non offre
   nessuna strada dal dato all'immagine o viceversa.
3. **Nessuna navigazione incrociata.** Non si può andare da un concept alle sue
   generazioni, da un element ai suoi archi, da un giorno d'archivio al Lab.
   Le tab rispecchiano la forma delle API, non il flusso di lavoro reale
   (guarda cos'è successo → giudica → sperimenta → tara → pubblica).

## Principio guida

**La coppia concept×element diventa l'oggetto centrale.** Ovunque compaia, è
rappresentata dallo stesso componente cliccabile (chip), e ogni vista sa
rispondere a "dove ancora è usata questa cosa?" con un click.

---

## Architettura dell'informazione

Quattro tab, in quest'ordine (il primo è la home):

| Tab | Domanda a cui risponde |
|---|---|
| **Archivio** | "Cos'ha prodotto il sistema, e come è nato ciascuno sfondo?" |
| **Lab** | "Proviamo una combinazione — sapendo cosa è già successo con lei" |
| **Catalogo** | "Quali concept ed element esistono, e chi è usato dove?" (fonde le vecchie tab Concept + Element) |
| **Range** | "Come giudica il cancello, e cosa rischio se cambio i valori?" |

La tab attiva e i filtri vivono nell'hash dell'URL (`#archivio?concept=crescita`):
ricaricare la pagina non perde il posto, e ogni vista può *linkare* le altre.

### Livello dati condiviso (`STORE`)

Un unico modulo client carica **in parallelo** e tiene in memoria: canali
(attivi + storici, dal backend — le liste hardcoded `CANALI`/`CANALI_STORICI`
spariscono), archivi per canale, catalogo, note, profili. Tutte le tab leggono
da qui; un solo "↻ Aggiorna" globale nell'header, con indicatore di caricamento
per sezione e rendering progressivo (ogni canale appare appena arriva la sua
risposta, senza aspettare gli altri).

Da `STORE` si deriva client-side l'**indice degli usi**: per ogni concept e
ogni element → archi in cui compare, giorni generati, canali, giudizi
buono/scarto dalle note. Nessun nuovo aggregato lato backend.

---

## Vista per vista

### 1. Archivio (home)

**Struttura: da pellicola piatta a archi raggruppati.** Dentro ogni canale, i
giorni sono raggruppati per arco (stessa coppia + stesso `arco`):

```
▾ natura                                      [oggi: card grande come ora]
   Arco 3 · 🌱 crescita × 🌿 felce · 12–18 lug · 6 giorni · 5 ok / 1 scarto   [⚗ riprova nel Lab]
   [f1][f2][f3][f4][f5][f6]           ← pellicola di quell'arco
   Arco 2 · 🏗 costruzione × 🏝 isola · 5–11 lug · …
   [f1][f2]…
   Giorni senza arco noto (provenienza ricostruita o assente)
   [f][f][f]…
```

L'intestazione di ogni arco porta: chip della coppia, intervallo date, conteggi,
e il bottone **"⚗ riprova nel Lab"** che apre il Lab con quella coppia già
selezionata.

**Barra filtri globale** (sostituisce il solo filtro canale): canale ·
concept · element · giudizio (buoni/scarti/non marcati). I filtri si attivano
anche cliccando qualunque chip in qualunque punto del tool.

**Ogni fotogramma** mostra sempre, senza eccezioni: data, chip coppia (o il suo
stato degradato, vedi sotto), tappa, marcatura. Le misure restano al livello di
dettaglio.

**Click sul fotogramma → scheda del giorno** (overlay/lightbox, si chiude con
Esc o click fuori): immagine grande + carta d'identità completa — data, canale,
arco/giorno/tappa con `testoTappa`, chip coppia, profilo in vigore quel giorno
(le 3 misure con range e guardie), misure effettive colorate su quel profilo,
verdetto del collaudo coi motivi, modello e tentativi, origine, e la marcatura
buono/scarto con nota modificabile direttamente lì.

**Stati degradati onesti** (mai più un generico "combinazione non nota"):
- `origine: registrata` → tutto visibile;
- `origine: ricostruita` → chip coppia con badge "dedotta"; tappa/misure
  dichiarate "non registrate all'epoca";
- `origine: assente` → "provenienza non registrata (giorno precedente al
  tracciamento)". Il messaggio dice *perché* manca il dato, non solo che manca.

Il "Quaderno di laboratorio" resta in cima, ma ogni voce usa i chip cliccabili
e linka la scheda del giorno.

### 2. Lab

**Colonna di controllo + storico persistente dei run.** Il run non è più un
oggetto usa-e-getta nella closure di un click:

- Ogni run viene salvato in `localStorage` (coppia, parametri, misure per
  giorno, verdetti, `runId`, timestamp; tetto ~100 run, i più vecchi escono).
  Le immagini scadono dopo 1h lato server: un run scaduto mostra le misure con
  segnaposto "immagini scadute" al posto delle immagini, e resta utile.
- I run compaiono come card impilate (il più recente in alto): chip coppia,
  parametri, pellicola, misure, verdetto, azioni. Un bottone "↻ rigenera"
  rilancia lo stesso run.

**Contesto prima di generare.** Appena selezioni concept + element, sotto i
selettori appare il pannello **"Questa coppia finora"**: nativa o libera, run
di Lab precedenti (dallo storico), archi in produzione (da `STORE`), giudizi
buono/scarto, link "vedi in archivio". Mai più esperimenti alla cieca.

**Gerarchia del rischio.** Le due azioni oggi adiacenti si separano:
- "⤵ Proponi range" resta un bottone normale; se in Range ci sono modifiche
  manuali non lanciate per lo stesso concept, mostra il diff e chiede conferma
  prima di sovrascrivere (oggi sovrascrive in silenzio).
- "📌 Pubblica in produzione" diventa visivamente *distruttiva* (colore warn) e
  apre una conferma esplicita che mostra: la frase "Da stasera il canale X
  userà anche «concept × element» nella rotazione settimanale", e il pool
  attuale di quel canale (indole + element già pubblicati), così si vede in
  cosa si sta entrando.

### 3. Catalogo (fonde Concept + Element)

Layout a tre zone:
- **Selettore lista** (Concept | Element) sopra un'unica colonna lista a
  sinistra; form di modifica a destra (i form attuali restano, già buoni).
- **Ogni riga della lista porta i suoi usi**, calcolati dall'indice:
  - concept: `4 element nativi · 12 archi · 47 giorni · natura, quiete`
  - element: `nativo di crescita · pubblicato su natura · 5 archi · 18 giorni`
- **Pannello "Dove è usato"** in testa al form dell'elemento selezionato:
  canali in cui è nel pool di produzione (e perché: indole del canale o
  pubblicazione esplicita), archi generati (ognuno linka l'Archivio filtrato),
  ultimo uso, riepilogo giudizi. Due bottoni: "vedi in archivio" (filtra) e
  "⚗ prova nel Lab" (preseleziona).

La "mappa degli usi" non è una vista separata da mantenere: è la somma di
questi badge + il pannello, sempre aggiornati dall'indice.

### 4. Range

- Ogni card concept guadagna una riga "usato da": n. element nativi, n.
  pubblicati, canali attivi coinvolti — con ⚠ "in produzione" se il concept è
  nel pool di un canale attivo (cambiar range ha effetto stanotte).
- **"🚀 Lancia solo questo concept"** per card (fonde lo stato attuale del
  server con la sola modifica di quel concept), accanto al lancio globale che
  resta per i cambi di massa.
- I due segnali di modifica oggi indipendenti (badge "tarato" vs testo di
  stato) si unificano in uno solo, derivato da un'unica funzione di confronto
  `EDIT` vs stato server.

---

## Componenti condivisi

- **`chipCoppia(conceptId, elementId)`** — l'unico modo di mostrare una coppia
  ovunque (Lab, Archivio, Catalogo, quaderno, lightbox): chip concept + chip
  element, entrambi cliccabili (→ Archivio filtrato), pallino "nativa" quando
  l'accoppiata è quella di famiglia, badge "dedotta" quando ricostruita.
- **Lightbox scheda-giorno** — unico componente, usato dall'Archivio e dal
  quaderno.
- **Toast/status unificato** — un solo meccanismo di feedback (successo /
  errore con dettaglio del campo quando il Worker riporta `errori[]`),
  al posto dei tanti `setStatus` indipendenti.
- **Connessione**: la barra credenziali resta nell'header ma compatta; alla
  prima apertura senza base URL usa il default e si connette da sola (la
  chiave admin serve solo per scrivere/generare, e viene chiesta contestualmente
  se manca al momento del bisogno).

## Struttura dei file (niente build, deve funzionare da `file://`)

Il tool resta apribile con doppio click. Niente moduli ES (bloccati da
`file://`), niente bundler: script classici con namespace condiviso.

```
tuning/
  index.html        (solo markup + <script src> in ordine)
  tool.css
  js/util.js        (esc, api(), toast, hash-router)
  js/store.js       (STORE: fetch paralleli, indice usi, lab history)
  js/components.js  (chipCoppia, lightbox, film, misure)
  js/tab-archivio.js
  js/tab-lab.js
  js/tab-catalogo.js
  js/tab-range.js
```

`tuning/` entra nel repo (via il blocco in `.gitignore`): è uno strumento del
progetto e va versionato come il resto. Resta fuori dal deploy del Worker.

## Modifiche backend minime richieste

Additive e non-breaking (nessun contratto esistente cambia):

1. `GET /api/channels?all=1` → include anche i canali storici (quelli con
   almeno un archivio in KV), ognuno marcato `storico: true`. Elimina le liste
   hardcoded nel client.
2. `GET /api/channels`: ogni canale attivo espone anche `famiglie` (l'indole),
   così il client calcola "concept → canali di produzione" senza duplicare
   logica.
3. `GET /api/archive/<id>`: accettare `limit` fino a 400 (oggi il client chiede
   60 e l'indice usi vedrebbe solo l'archivio recente).

## Cosa NON cambia

- Il visual language: dark theme, palette, tipografia e componenti CSS attuali
  (card, pill, film, frame) — il redesign riorganizza, non riverniciare.
- I contratti degli endpoint esistenti (Shortcut `/w/*`, `/s/*`, sito).
- La logica di generazione e del cancello: il tool la osserva, non la modifica.
- Il funzionamento da `file://` con chiave admin per le scritture.

## Criteri di accettazione (checklist per il collaudo)

1. Apro l'Archivio: ogni canale mostra archi raggruppati con intestazione
   coppia+date+conteggi; nessun fotogramma dice "combinazione non nota" — ogni
   giorno ha chip coppia oppure uno stato degradato che spiega il perché.
2. Click su un fotogramma → lightbox con carta d'identità completa e marcatura
   modificabile.
3. Click sul chip di un concept (ovunque) → Archivio filtrato su quel concept;
   l'hash dell'URL riflette il filtro e sopravvive al reload.
4. In Catalogo ogni riga mostra i conteggi d'uso; selezionato un element, il
   pannello "Dove è usato" linka archivio e Lab.
5. Nel Lab, selezionata una coppia già usata, compare "Questa coppia finora"
   con storia reale; dopo un run, il run resta nello storico anche cambiando
   tab e ricaricando la pagina.
6. "Pubblica in produzione" richiede la conferma esplicita col pool del canale;
   "Proponi range" avvisa se sovrascriverebbe modifiche manuali non lanciate.
7. In Range le card mostrano "usato da" e il lancio per singolo concept
   funziona (verificabile via GET /tuning prima/dopo).
8. Il tool si apre da `file://` senza errori console e si connette da solo al
   Worker di default; l'archivio si carica in parallelo con rendering
   progressivo.
