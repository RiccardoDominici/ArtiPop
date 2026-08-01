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
