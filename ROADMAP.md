# ROADMAP.md — ArtiPop v3

Modalità BUILD finché esistono milestone APERTE; poi POLISH sui quattro principi.
Stati: APERTA · FATTA · BLOCCATA(motivo). Id stabili, mai riusati.
Validata da Riccardo il 2026-07-30.

## Milestone

### M1 — Pipeline di deploy completa · FATTA
Ambiente `preview` in wrangler (worker `artipop-preview`, KV namespace dedicato,
nessun cron, ADMIN_KEY proprio) + `smoke-test.sh` (HTTP 200 su `/health`, `/`,
`/aiuto`, `/api/channels`; stringhe attese; soglia tempi <3s) + rollback provato
realmente (wrangler rollback su preview E production).
**Fatta quando**: deploy preview→smoke→production→smoke tutto verde in un solo
comando, e un rollback reale è stato eseguito e verificato.
*Nota: completata insieme a Riccardo durante il setup (2026-07-31), prima dell'avvio del loop:
deploy preview+seed+smoke verdi; deploy production di prova `f77c23c4` con smoke 5/5;
rollback reale alla versione `1fe2f82b` eseguito dal container e verificato con smoke 5/5.*

### M2 — Test d'integrazione su router e orchestrazione · APERTA
Oltre la base minima pure-logic del setup: test con binding simulati
(@cloudflare/vitest-pool-workers o mock manuali di KV/AI/IMAGES/SELF) per:
auth su tutte le rotte protette (401/403), 404 fallback, CORS, idempotenza di
`runChannel` (stesso giorno → skip), `/w/<flusso>?date=` byte-stabile,
body malformati → 400 con messaggio chiaro.
**Fatta quando**: le rotte critiche hanno almeno un test felice + un test d'errore ciascuna, suite verde.

### M3 — Scritture admin robuste · APERTA
try/catch attorno a ogni scrittura KV in `/tuning`, `/catalogo/*`, `/note/*`
(index.js:139-285) → 500 JSON uniforme con messaggio umano (mai la pagina d'errore
generica di Cloudflare); `GET /lab/img` protetto da `isAuthorized` come il resto del blocco.
**Fatta quando**: test che simula KV.put che lancia → risposta 500 JSON; test 401 su /lab/img senza chiave.

### M4 — `/w/<flusso>` non restituisce mai JSON a una Shortcut · APERTA
Quando l'archivio è vuoto (canale mai generato o data inesistente): rispondere
con un'immagine placeholder statica 960×2048 (generata una volta, hardcoded nel
worker come asset, NON generata con AI a richiesta) e status 200, content-type
immagine — la Shortcut "Imposta sfondo" non deve mai ricevere JSON.
`?date=` inesistente può restare 404 ma con content-type immagine (placeholder).
**Fatta quando**: test su canale/data senza immagine → bytes immagine validi, mai JSON.

### M5 — Il cancello non si spegne mai in silenzio · APERTA
Se `IMAGES` è assente/fallisce o il PNG non è decodificabile (metrics.js:40-55,
138-244), oggi il collaudo si disattiva con un semplice console.warn. Portare lo
stato del cancello in superficie: `/health` espone per canale l'ultima esecuzione
(gate attivo sì/no, tentativi usati, verdetto misure), salvato nel meta di stato.
**Fatta quando**: /health mostra il campo; test con IMAGES stub rotto → il campo segnala gate disattivo.

### M6 — `/aiuto` allineato al linguaggio del sito · APERTA
Adottare i token del sito (testo `#f2f3f8`, dim `#9aa3b8`, stack font identico);
`#8fd3ff` resta il colore link. Design piatto e accordion invariati (VISUAL_SPECS §2).
**Fatta quando**: visual-check conforme a VISUAL_SPECS §2, nessun difetto §5, baseline aggiornata.

### M7 — `/api/channels` espone le famiglie per canale · APERTA
Requisito di tuning/DESIGN.md ("Modifiche backend minime") da verificare nel
codice: se manca, aggiungere il campo `famiglie` per canale; verificare che il
tuning tool lo consumi correttamente (tab Catalogo/Lab).
**Fatta quando**: campo presente e testato; se già implementato → chiudere come verificata con test di regressione.

### M8 — Header di sicurezza sulle pagine HTML · APERTA
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options` (o
`frame-ancestors`) su `/` e `/aiuto`. CSP solo se compatibile con l'inline
JS/CSS esistente senza riscritture (altrimenti niente CSP: essenzialità).
NON introdurre escaping in page.js (decisione riservata all'autore — v. Esclusioni).
**Fatta quando**: test sugli header presenti; pagine funzionanti identiche (visual-check invariato).

### M9 — Famiglia `attraversamento` sospesa dai pool · APERTA
Oggi dichiaratamente non tarata (families.js:146-154): sfora i range e consuma
tutti i tentativi ogni giorno. Escluderla dai pool di pesca (nessun canale può
pescarla) finché M10 non la riporta in range. La famiglia resta nel codice,
gli archi già generati restano validi in archivio.
**Fatta quando**: test di regressione che nessun `pickConcept` può restituire
concept di famiglia `attraversamento`; suite verde.

### M10 — Famiglia `attraversamento` tarata via lab · APERTA
Dipende da M9. Sessioni lab SOLO su preview, entro il budget di 10 generazioni
AI per ciclo: riformulare i range (ed eventualmente le tappe descrittive) finché
un arco lab completo passa il cancello senza esaurire i tentativi. Poi riammetterla
nei pool (rimuovendo la sospensione di M9, con aggiornamento dei test).
**Fatta quando**: un arco lab di 7 giorni su preview passa con ≤2 tentativi/giorno
in media; famiglia riammessa; test aggiornati e verdi.

## Definition of Done di produzione

1. Tutte le M1–M10 FATTE (o BLOCCATE con motivo registrato).
2. Suite completa verde + smoke production verde dopo l'ultimo deploy.
3. Rollback eseguito con successo almeno una volta (non solo teorico).
4. visual-check senza difetti VISUAL_SPECS §5 su tutte le superfici chiave.
5. README/GUIDA aggiornati dove il comportamento pubblico è cambiato.
Raggiunta la DoD → modalità POLISH (utilizzabilità > bellezza > robustezza > essenzialità).

## Esclusioni esplicite (il loop NON deve toccarle)

- Nuovi canali, famiglie, concept, element: curatela creativa riservata a Riccardo.
- Escaping/`esc()` in page.js: l'autore l'ha esplicitamente riservata a una decisione a parte (page.js:21-25).
- Light mode / redesign delle pagine.
- Migrazione archivio a R2 o GitHub (se ne riparla quando KV si avvicina a 800 MB).
- Import Shortcut one-tap via iCloud e pipeline di firma delle Shortcut (richiedono un device fisico).
- Domini custom, DNS, zone, qualsiasi risorsa Cloudflare fuori dal progetto artipop.
- Nuove dipendenze runtime nel worker (resta zero-dependency; devDependencies di test ok se previste dal piano).
- Modifica dello schedule cron di produzione e qualunque operazione di scrittura sul KV di produzione da parte dei cicli.
- Rate limiting / WAF applicativo.

## Regole di budget AI (vincolanti per ogni ciclo)

- Max 10 generazioni AI per ciclo, solo su ambiente preview (mai contro la produzione).
- Il cron di produzione consuma ~600-900 neuroni/giorno su 10.000: il loop non deve mai metterlo a rischio.
- Smoke test di produzione: sole letture (nessun /run, /backfill, /lab su produzione).
