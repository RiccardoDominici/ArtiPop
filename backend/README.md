# ArtiPop v3 — Backend (Cloudflare Workers)

Backend completamente gratuito e autonomo: un Worker Cloudflare genera ogni notte
un wallpaper nuovo per ognuno dei **tre canali** (nel codice: *flussi*), facendo
evolvere la "storia" di ciascuno giorno dopo giorno. Nessun server, nessuna carta
di credito, nessuna manutenzione.

**Live:** https://artipop.riccardo-dominici.workers.dev

## Architettura

```
cron (03:00 UTC, ogni notte)
  └─ scheduled() ──fan-out via SELF binding──► /run/<flusso>  (×3, in parallelo)
       per ogni flusso:
         1. story.js    → pesca il concept della settimana (se un arco è finito)
                          e sceglie la tappa di oggi in base a come è andata ieri
                          (families.js = schema di evoluzione, concepts.js/
                          catalog.js = libreria dei soggetti)
         2. generate.js → immagine 960x2048 con FLUX.2 klein-4b, doppio
                          riferimento visivo (ieri + keyframe dell'arco),
                          collaudata da metrics.js (il "cancello")
         3. storage.js  → KV: img:<ch>:latest + archivio permanente + stato

fetch()
  ├─ /                       → landing page auto-aggiornante
  ├─ /w/<canale>              → immagine di oggi (URL stabile per la Shortcut;
  │                             accetta anche i vecchi nomi canale, vedi channels.js)
  ├─ /w/random                → canale a rotazione giornaliera
  ├─ /api/channels[?all=1]    → stato JSON dei canali (?all=1 include gli storici)
  ├─ /api/archive/<canale>    → date + carta d'identità di ogni giorno
  ├─ /tuning, /catalogo, /note, /lab/*  → API per lo strumento di tuning (../tuning)
  └─ /health                  → healthcheck
```

| Modulo | Responsabilità |
|---|---|
| `src/index.js` | routing HTTP: autenticazione, CORS per lo strumento di tuning, dispatch delle rotte, cron |
| `src/handlers.js` | orchestrazione di un giorno di generazione (`runChannel`, `backfillChannel`, `regenDay`, `fanOutAll`), indipendente dall'HTTP |
| `src/channels.js` | i tre flussi (identità visiva, indole = famiglie da cui pescano) e gli alias verso i vecchi canali |
| `src/families.js` | le famiglie di concept: le sette tappe di ognuna e il profilo di cambiamento atteso |
| `src/concepts.js` | la libreria degli element (soggetti): setting, stile, palette, famiglia nativa |
| `src/catalog.js` | concept ed element aggiunti da fuori (KV `catalogo:custom`), sopra la libreria di codice |
| `src/story.js` | pesca del concept settimanale, scelta della tappa, evoluzione giorno per giorno |
| `src/generate.js` | catena di generazione immagini con fallback, e il cancello di collaudo (`generateWithGate`) |
| `src/daygen.js` | genera l'immagine di UN giorno (keyframe o edit), usato da cron/backfill/lab |
| `src/metrics.js` | le sei misure del cambiamento (estensione, intensità, compattezza, deriva, degrado, occupazione) |
| `src/profiles.js` | i range del cancello, con l'override tarabile da fuori (KV `tuning:profili`) |
| `src/giorno.js` | costruisce la carta d'identità di un giorno (`giorno:<canale>:<data>`) — un solo punto |
| `src/validazione.js` | regole di validazione condivise per i profili custom (foglia, nessun import da catalog/profiles/note) |
| `src/storage.js` | layout chiavi KV |
| `src/note.js` | marcature dei giorni (buono/scarto) e assetti di tuning salvati |
| `src/lab.js` | genera un arco di prova usa-e-getta per lo strumento di tuning |
| `src/page.js` | landing page |
| `src/help.js` | pagina `/aiuto` |
| `src/config.js` | tutti i parametri regolabili, documentati |

## Perché è gratis (e resta gratis)

| Risorsa | Uso giornaliero | Limite free |
|---|---|---|
| Workers AI (immagini) | ~600-900 neuroni (3 canali, di più nei giorni di cambio base per il riallineamento del keyframe) | 10.000 neuroni/giorno |
| Scritture KV | ~15 | 1.000/giorno |
| Letture KV | qualche centinaio | 100.000/giorno |
| Richieste Worker | poche migliaia | 100.000/giorno |
| Cron trigger | 1 | 5 per account |

Superare il budget non genera costi: sul piano free le chiamate falliscono
e resta l'immagine del giorno prima.

## Coerenza giorno-per-giorno

- Ogni canale ha uno **stato narrativo** in KV (`state:<canale>`): il concept
  in corso, il giorno nell'arco, l'impronta di ieri (per il cancello).
- Il primo giorno di un arco genera un **keyframe** pulito da testo; ogni
  giorno successivo entrano nel modello **due riferimenti insieme** — l'output
  di ieri (cosa preservare) e il keyframe (l'àncora di qualità) — invece di
  incatenare solo l'editing precedente. Il **seed resta fisso per tutto
  l'arco** (7 giorni), quindi le composizioni restano imparentate.
- Prima di pubblicare, `generateWithGate` misura quanto l'immagine candidata
  è cambiata rispetto a ieri (`metrics.js`) e la accetta solo se rientra nel
  profilo del concept; altrimenti rigenera correggendo la "dose" descrittiva.
- Ogni 7 giorni l'arco chiude: nuovo concept pescato dall'indole del canale
  (mai lo stesso della settimana appena finita), nuovo keyframe, nuovo seed.

## Deploy e gestione

```bash
cd backend
npx wrangler deploy                 # deploy (richiede login Cloudflare)
npx wrangler secret put ADMIN_KEY   # chiave per gli endpoint admin
npx wrangler tail                   # log in tempo reale
```

### Endpoint admin (richiedono `?key=<ADMIN_KEY>` o header `x-artipop-key`)

| Endpoint | Uso |
|---|---|
| `/run/<flusso>?force=1` | rigenera subito un flusso (senza force è idempotente sul giorno); accetta anche gli alias storici (`/run/island`) |
| `/run-all?force=1` | rigenera tutti i flussi |
| `/backfill?ch=<flusso>&days=N[&gate=0]` | ricostruisce N giorni di storia, stato azzerato (sincrono di proposito) |
| `/regen-day?ch=<flusso>&date=YYYY-MM-DD` | rigenera un solo giorno già passato |
| `/test-size?w=960&h=2048` | verifica se il modello accetta una risoluzione |
| `/test-metrics?ch=X&a=DATA&b=DATA[&concept=Y]` | misura il cambiamento fra due giorni d'archivio |

Elenco completo, comprese le API del catalogo/tuning/note e quali sono
pubbliche in lettura: [`../GUIDA.md`](../GUIDA.md#24-operazioni-comuni).

### Tuning dei range del cancello

I range con cui il cancello (`metrics.js`) accetta un'immagine sono nel codice
(`families.js`, uno per **concept** = schema di evoluzione), ma si possono
**tarare da fuori** senza rideployare: un JSON salvato in KV (`tuning:profili`)
viene fuso sopra i default (`profiles.js`).

- `GET /tuning` → default del codice + valori effettivi + elenco element
- `PUT /tuning` (chiave admin) → salva l'override; `DELETE /tuning` → torna ai default
- `GET/POST /lab/arc?concept=<schema>&element=<soggetto>&days=7&gate=0` (chiave) →
  genera un arco USA-E-GETTA (non tocca la produzione, immagini con TTL 1h) e
  restituisce le sei misure giorno per giorno — serve a tarare i range con dati
  alla mano e a provare combinazioni libere (`timelapse`×`girasole`, ecc.)
- `GET /lab/img?run=<id>&n=<n>` (chiave) → serve un'immagine di prova

Lo **strumento visuale** è in [`../tuning/`](../tuning/README.md), dentro il
repo: si apre da `file://` senza build, edita i range per concept, prova le
combinazioni nel Lab e con un tasto le pubblica nel Worker.

### Aggiungere o modificare un canale

Un canale (flusso) è un'indole, non un tema fisso: aggiungerne uno significa
una voce in `src/channels.js` con `famiglie` **disgiunte** da quelle degli
altri canali (nessuna famiglia in comune, o due canali potrebbero pescare lo
stesso soggetto nella stessa settimana). Il costo extra è quello di un flusso
in più (vedi `CONFIG.IMAGE_SIZES` in `config.js`): c'è margine per molti altri.

Aggiungere un nuovo **soggetto** alla libreria (un element: setting, stile,
palette) è un'operazione diversa e più frequente: una riga in `src/concepts.js`
(richiede deploy), oppure `PUT /catalogo/element` a caldo — senza rideploy,
tramite lo strumento di tuning o via API (vedi sopra).

## Storia del progetto

- **v0**: app desktop macOS (py2app)
- **v1**: server Flask locale con galleria
- **v3 (prima)**: EC2 + Replicate SD3.5 + S3 — funzionante ma a pagamento e con ~20 step di setup
- **v3 (ora)**: Cloudflare Workers free tier, zero costi, zero manutenzione, canali evolutivi

I file della versione AWS sono nella storia git (`git log -- "for devs"`).
