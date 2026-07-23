# ArtiPop v3 — Backend (Cloudflare Workers)

Backend completamente gratuito e autonomo: un Worker Cloudflare genera ogni notte
un wallpaper nuovo per ognuno dei 6 canali tematici, facendo evolvere la "storia"
di ciascun canale giorno dopo giorno. Nessun server, nessuna carta di credito,
nessuna manutenzione.

**Live:** https://artipop.riccardo-dominici.workers.dev

## Architettura

```
cron (03:00 UTC, ogni notte)
  └─ scheduled() ──fan-out via SELF binding──► /run/<canale>  (×6, in parallelo)
       per ogni canale:
         1. story.js    → la scena evolve di un giorno (LLM llama gratuito,
                          fallback deterministico tappa+momento+meteo)
         2. generate.js → immagine 960x2048 con FLUX.2 klein-4b
                          (fallback: flux-1-schnell → Pollinations)
         3. storage.js  → KV: img:<ch>:latest + archivio settimanale + stato

fetch()
  ├─ /                → landing page auto-aggiornante
  ├─ /w/<canale>      → immagine di oggi (URL stabile per la Shortcut)
  ├─ /w/random        → canale a rotazione giornaliera
  ├─ /api/channels    → stato JSON di tutti i canali
  └─ /health          → healthcheck
```

| Modulo | Responsabilità |
|---|---|
| `src/index.js` | routing HTTP, cron, orchestrazione per-canale |
| `src/channels.js` | definizione dei 6 canali (identità visiva, viaggio, fallback) |
| `src/story.js` | evoluzione giornaliera della storia (archi da 7 giorni, seed stabile per arco) |
| `src/generate.js` | catena di generazione immagini con fallback |
| `src/storage.js` | layout chiavi KV |
| `src/page.js` | landing page |
| `src/config.js` | tutti i parametri regolabili, documentati |

## Perché è gratis (e resta gratis)

| Risorsa | Uso giornaliero | Limite free |
|---|---|---|
| Workers AI (immagini) | ~1.200 neuroni (6 × klein a 960x2048) | 10.000 neuroni/giorno |
| Workers AI (LLM evoluzione) | ~100 neuroni | (stesso budget) |
| Scritture KV | ~20 | 1.000/giorno |
| Letture KV | qualche centinaio | 100.000/giorno |
| Richieste Worker | poche migliaia | 100.000/giorno |
| Cron trigger | 1 | 5 per account |

Superare il budget non genera costi: sul piano free le chiamate falliscono
e resta l'immagine del giorno prima.

## Coerenza giorno-per-giorno

- Ogni canale ha uno **stato narrativo** in KV (`state:<canale>`): arco corrente,
  giorno nell'arco, scena di ieri.
- Ogni notte un LLM riscrive la scena "un giorno dopo" (cambiano 1-2 dettagli:
  la luce, il meteo, il viaggio avanza). Il **seed resta fisso per tutto l'arco**
  (7 giorni), quindi le composizioni restano imparentate.
- Ogni 7 giorni il canale cambia BASE: nuovo keyframe pulito, nuova tappa del
  viaggio, nuovo seed. I canali restano riconoscibili grazie a `style` + `palette` fissi.

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
| `/run/<flusso>?force=1` | rigenera subito un flusso (senza force è idempotente sul giorno) |
| `/run-all?force=1` | rigenera tutti i flussi |
| `/test-size?w=960&h=2048` | verifica se il modello accetta una risoluzione |
| `/test-metrics?ch=X&a=DATA&b=DATA[&concept=Y]` | misura il cambiamento fra due giorni d'archivio |

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
- `GET /lab/img?run=<id>&n=<n>` → serve un'immagine di prova

Lo **strumento visuale** è in `../tuning/index.html` (fuori dal repo, `.gitignore`):
si apre nel browser, edita i range per concept, prova le combinazioni nel lab e
con un tasto li "lancia nel Worker". Il JSON scaricabile è la fonte di verità.

### Aggiungere o modificare un canale

Basta aggiungere una voce in `src/channels.js` (id, stile, palette, prima scena,
tappe del viaggio): al cron successivo il canale parte da solo. Il costo extra è
~200 neuroni/giorno per canale: c'è margine per decine di canali.

## Storia del progetto

- **v0**: app desktop macOS (py2app)
- **v1**: server Flask locale con galleria
- **v3 (prima)**: EC2 + Replicate SD3.5 + S3 — funzionante ma a pagamento e con ~20 step di setup
- **v3 (ora)**: Cloudflare Workers free tier, zero costi, zero manutenzione, canali evolutivi

I file della versione AWS sono nella storia git (`git log -- "for devs"`).
