# 📖 Guida completa ad ArtiPop

Tutto quello che serve sapere, sia per **usare** ArtiPop sul tuo iPhone sia per
**gestirlo** da maintainer. Aggiornata a luglio 2026.

---

## Parte 1 — Per chi lo usa (2 minuti)

### Che cos'è

Ogni notte ArtiPop genera un nuovo wallpaper con l'AI per ogni canale attivo.
Ogni canale è un *viaggio*: la scena di oggi è l'evoluzione di quella di ieri
(la luce cambia, il percorso avanza) e ogni 12 giorni si apre un capitolo nuovo.
Il tuo iPhone scarica l'immagine e la imposta come sfondo **da solo, ogni sera
al tramonto**. Gratis, senza app e senza account.

### Passo 1 — Scegli il canale

Vai su **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)**,
sfoglia le card (swipe!) e copia il link del canale che preferisci:

| Canale | Il viaggio | URL |
|---|---|---|
| 🏔️ **Horizon** | i paesaggi della Terra, dall'alba delle Alpi ai deserti | `…/w/horizon` |
| 🌃 **Neon** | una megalopoli futura che cresce notte dopo notte | `…/w/neon` |
| 🎲 **Random** | ogni giorno un canale a sorpresa | `…/w/random` |

(altri canali — Cosmos, Bloom, Depths, Aurora — sono già pronti nel codice e
verranno attivati in futuro)

### Passo 2 — Crea la Shortcut (una volta sola)

1. Apri l'app **Comandi rapidi** → tab **Comandi** → **+** in alto a destra.
2. Aggiungi l'azione **Ottieni contenuto da URL** e incolla il link del canale,
   es. `https://artipop.riccardo-dominici.workers.dev/w/horizon`.
3. Aggiungi l'azione **Imposta sfondo** subito dopo:
   - scegli quale sfondo aggiornare (Lock screen, Home, o entrambi);
   - **disattiva "Mostra anteprima"** ⚠️ — è il passaggio più importante:
     con l'anteprima attiva iOS chiederebbe conferma ogni sera.
4. Dai un nome al comando (es. "ArtiPop") e salva.

Provalo subito con un tap: lo sfondo deve cambiare all'istante.

### Passo 3 — Automatizza al tramonto

1. Tab **Automazioni** → **+** → **Ora del giorno**.
2. Scegli **Tramonto** (o l'orario che preferisci), ripetizione **Ogni giorno**.
3. Seleziona **Esegui immediatamente** (così non chiede conferma).
4. Scegli il comando "ArtiPop" appena creato → **Fine**.

Da stasera è tutto automatico. 🌇

### Domande frequenti

**Posso cambiare canale?** Sì: apri il comando e sostituisci l'URL.

**Posso avere uno sfondo nuovo subito?** Tocca il comando manualmente,
oppure aggiungi l'automazione anche all'**Alba** per il "turno" del mattino.

**Lo sfondo a volte non cambia (iOS 18)?** È un bug intermittente di Apple
sull'azione "Imposta sfondo" nelle automazioni (`extensionKit error 2`),
dipende dal modello di iPhone. Workaround collaudato: **duplica l'automazione**
e sfalsala di un minuto (tramonto e tramonto +1'): se la prima fallisce,
la seconda passa.

**Dove finiscono gli sfondi vecchi?** In archivio, per sempre: sulla pagina
del sito, sezione "Il viaggio finora", puoi rivedere ogni giorno passato.
Ogni immagine d'archivio resta scaricabile: `…/w/horizon?date=2026-07-16`.

---

## Parte 2 — Per chi lo gestisce (maintainer)

### Architettura in una riga

Un **Cloudflare Worker** (piano free) con cron notturno genera le immagini con
**Workers AI** (FLUX.2 klein-4b), le salva in **KV** (ultimo giorno + archivio
permanente per data + stato narrativo) e serve sito, API e immagini.
Dettagli tecnici completi: [`backend/README.md`](backend/README.md).

### Comandi essenziali

```bash
cd backend
npx wrangler deploy              # deploy di qualsiasi modifica
npx wrangler tail                # log in tempo reale
npx wrangler secret put ADMIN_KEY  # (ri)genera la chiave admin
```

### Operazioni comuni

| Voglio… | Come |
|---|---|
| Rigenerare subito tutti i canali | `curl "https://artipop.…workers.dev/run-all?force=1&key=<ADMIN_KEY>"` |
| Rigenerare un canale | `…/run/horizon?force=1&key=<ADMIN_KEY>` |
| Attivare/disattivare un canale | in `backend/src/channels.js` cambia `active: true/false`, poi `npx wrangler deploy`. L'archivio dei canali in pausa resta in KV. |
| Aggiungere un canale nuovo | aggiungi una voce in `channels.js` (id, stile, palette, prima scena, tappe del viaggio, accent). Costo: ~200 neuroni/giorno. |
| Cambiare l'orario di generazione | `triggers.crons` in `backend/wrangler.jsonc` (ora in UTC) |
| Verificare una risoluzione del modello | `…/test-size?w=960&h=2048&key=<ADMIN_KEY>` |
| Vedere i consumi AI | dash.cloudflare.com → AI → Workers AI (neuroni/giorno) |

### La coerenza nel tempo (come è garantita)

1. **Àncora visiva — "anchor, don't chain"** (la garanzia più forte): il primo
   giorno di ogni arco è un *keyframe* generato pulito; ogni giorno successivo
   viene generato da FLUX.2 klein **con il keyframe come immagine di
   riferimento** (`input_image_0`, ridotta <512px via images.weserv.nl) e
   un'istruzione "stesso luogo, N giorni dopo: cambia solo luce/meteo/piccole
   evoluzioni". Si edita sempre il keyframe pulito, mai l'output di ieri: la
   degradazione da editing iterato (visibile dal 2°-3° edit in catena, severa
   dal 4°-8° — letteratura 2025-26) non si accumula mai. Il keyframe stesso
   viene "riallineato" con un auto-edit alla famiglia visiva degli edit.
2. **Identità fissa**: `style` + `palette` del canale entrano in ogni prompt.
3. **LLM vincolato**: riceve il tema del capitolo + le ultime 3 scene, con
   la regola "stesso luogo, cambia solo 1-2 dettagli".
4. **Guardia anti-deriva** (`story.js`): la scena proposta è accettata solo se
   resta ancorata al vocabolario del canale/arco, non ripete quasi-identica una
   scena recente e non contiene elementi vietati; altrimenti scatta il fallback
   deterministico (tappa + momento + meteo), coerente per costruzione.
5. **Seed stabile per arco** (12 giorni): composizioni imparentate; nuovo arco
   → nuovo keyframe, nuovo seed e nuova tappa del viaggio.

Se il resizer esterno non risponde, quel giorno si genera senza riferimento
(la storia testuale mantiene comunque la continuità) — nessun blocco.

### Limiti free tier e cosa fare quando…

| Risorsa | Uso attuale | Limite free | Quando si avvicina… |
|---|---|---|---|
| Neuroni Workers AI | ~500/giorno (2 canali) | 10.000/giorno | c'è spazio per ~40 canali: non succede |
| Scritture KV | ~10/giorno | 1.000/giorno | idem |
| **Storage KV (archivio)** | ~2,2 MB/giorno | 1 GB | **~15 mesi di archivio**: quando il dashboard KV segna >800 MB, o si abilita R2 (10 GB gratuiti, richiede attivazione in dashboard con carta — resta gratis) spostandoci l'archivio, o si esporta lo storico su GitHub e si liberano le chiavi `archive:*` più vecchie |
| Richieste Worker | poche migliaia/giorno | 100.000/giorno | non succede |

Se il budget neuroni si esaurisse comunque (impossibile con 2 canali):
le generazioni falliscono, resta l'immagine del giorno prima, zero addebiti.

### Chiave admin persa?

`npx wrangler secret put ADMIN_KEY` con un valore nuovo (es. `openssl rand -hex 20`).
Gli endpoint `/run`, `/run-all` e `/test-size` usano quella.

### File `.shortcut` firmati (sperimentale)

In [`shortcut/`](shortcut/README.md): template plist + `build_shortcuts.sh`
(firma con `shortcuts sign --mode anyone`; richiede macOS). I file in `dist/`
sono pronti ma **non ancora testati su un iPhone reale** — prima di
distribuirli, provane uno. La via consigliata per gli utenti resta la
creazione manuale o un link iCloud pubblicato da te.
