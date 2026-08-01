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
