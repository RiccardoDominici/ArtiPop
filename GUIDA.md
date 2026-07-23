# 📖 Guida ad ArtiPop

Un wallpaper nuovo ogni giorno sull'iPhone, generato dall'AI, che **evolve**:
ogni canale racconta un progetto che avanza di un pezzo al giorno e si completa
in una settimana. Gratis, senza app, senza account.

Questa guida ha due parti indipendenti: la **Parte 1** serve a chi usa ArtiPop
sul telefono, la **Parte 2** a chi lo gestisce. Non serve leggerle entrambe.

---

## Indice

**Parte 1 — Usare ArtiPop** *(5 minuti, una volta sola)*
- [1.1 Come funziona, in breve](#11-come-funziona-in-breve)
- [1.2 Scegliere il canale](#12-scegliere-il-canale)
- [1.3 Installare la Shortcut](#13-installare-la-shortcut)
- [1.4 Accendere l'automazione](#14-accendere-lautomazione)
- [1.5 Uso quotidiano](#15-uso-quotidiano)
- [1.6 Se qualcosa non va](#16-se-qualcosa-non-va)

**Parte 2 — Gestire ArtiPop** *(maintainer)*
- [2.1 Architettura in 30 secondi](#21-architettura-in-30-secondi)
- [2.2 Anatomia di una giornata](#22-anatomia-di-una-giornata)
- [2.3 Mappa del repo](#23-mappa-del-repo)
- [2.4 Operazioni comuni](#24-operazioni-comuni)
- [2.5 Come sono fatti i canali](#25-come-sono-fatti-i-canali)
- [2.6 Come è garantita la coerenza visiva](#26-come-è-garantita-la-coerenza-visiva)
- [2.7 Le Shortcut firmate](#27-le-shortcut-firmate)
- [2.8 Limiti del piano gratuito](#28-limiti-del-piano-gratuito)
- [2.9 Runbook: quando qualcosa si rompe](#29-runbook-quando-qualcosa-si-rompe)
- [2.10 Lezioni imparate (non regredire)](#210-lezioni-imparate-non-regredire)

---
---

# Parte 1 — Usare ArtiPop

## 1.1 Come funziona, in breve

| | |
|---|---|
| **Cosa fa** | Ogni notte ArtiPop genera un wallpaper nuovo per ogni canale |
| **Come arriva sul telefono** | Una Shortcut lo scarica e lo imposta, da sola, ogni sera |
| **Cosa cambia ogni giorno** | Un pezzo della scena: la storia avanza, non riparte |
| **Ogni 7 giorni** | Il progetto è completo → si cambia **base** e ricomincia da capo |
| **Costo** | Zero, per sempre. Nessun account, nessuna app |

## 1.2 Scegliere il canale

Vai su **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)**
e sfoglia le card (si trascinano). Ogni canale è un mondo diverso:

| Canale | Cosa succede, giorno dopo giorno | URL |
|---|---|---|
| 🏝️ **Isola** | un'isola fluttuante prende vita, un pezzo al giorno | `…/w/island` |
| 📚 **Studio** | una scrivania vuota si riempie di vita, un oggetto al giorno | `…/w/studio` |
| 🌸 **Bloom** | una pianta cresce dal seme alla fioritura | `…/w/bloom` |
| 🎲 **Random** | ogni giorno un canale a sorpresa | `…/w/random` |

> I canali "viaggio" (Horizon, Neon, Cosmos, Depths, Aurora) restano nel codice
> in pausa: si riattivano con una riga, vedi [2.4](#24-operazioni-comuni).

## 1.3 Installare la Shortcut

**Passo A — Scarica.** Sul sito, tocca **⬇️ Scarica la Shortcut** con in cima la
card del canale che vuoi. Il file ha già dentro tutto: URL del canale, anteprima
disattivata, ritaglio automatico disattivato.

**Passo B — Apri il file.** Tocca l'icona dei **Download** in Safari (la freccia
in alto) e poi il file appena scaricato: si apre **Comandi rapidi** con la
schermata *Aggiungi comando*. Lo trovi anche in *File → Download*.

> 🔒 Se iOS rifiuta l'importazione, attiva *Impostazioni → Scorciatoie →
> **Consenti scorciatoie non attendibili*** (la voce compare dopo aver eseguito
> almeno una scorciatoia qualsiasi), poi riapri il file.

**Passo C — Prepara lo sfondo da far gestire.** ArtiPop aggiorna sempre
l'**ultimo** sfondo della schermata di blocco — l'ultima scheda in
*Impostazioni → Sfondo*. Se in fondo hai uno sfondo a cui tieni, aggiungine uno
nuovo qualsiasi: finisce in coda e diventa quello di ArtiPop.

> Perché l'ultimo e non il primo: il primo posto è quasi sempre già occupato e
> iOS **non permette di riordinare** le schede. L'ultimo, invece, te lo puoi
> creare quando vuoi.

**✅ Verifica:** tocca la Shortcut. Lo sfondo deve cambiare **subito e senza
chiederti niente**. Se ti chiede conferma, vedi [1.6](#16-se-qualcosa-non-va).

### Preferisci crearla a mano?

Due azioni, ma un dettaglio è critico:

1. **Comandi rapidi** → tab *Comandi* → **+**.
2. Azione **Ottieni contenuto da URL** → incolla l'URL del canale.
3. Azione **Imposta sfondo** → espandi le opzioni con la freccetta e
   **disattiva "Mostra anteprima"** ⚠️ (spiegazione in [1.6](#16-se-qualcosa-non-va))
   e "Ritaglia sul soggetto".
4. Dai un nome al comando e salva.

## 1.4 Accendere l'automazione

1. Tab **Automazioni** → **+** → *Ora del giorno*.
2. **Tramonto** (o l'orario che preferisci) → ripeti **Ogni giorno**.
3. Seleziona **Esegui immediatamente**.
4. Scegli la Shortcut ArtiPop → **Fine**.

Da stasera è tutto automatico. 🌇

## 1.5 Uso quotidiano

| Voglio… | Come |
|---|---|
| Uno sfondo nuovo subito | Tocca la Shortcut a mano: scarica sempre l'ultima immagine |
| Averlo anche la mattina | Aggiungi una seconda automazione all'**Alba** |
| Cambiare canale | Apri la Shortcut e sostituisci l'URL, o scarica quella dell'altro canale |
| Rivedere i giorni passati | Sul sito, sezione **"Il viaggio finora"** |
| Riscaricare un giorno preciso | `…/w/island?date=2026-07-16` |

## 1.6 Se qualcosa non va

Il troubleshooting completo, sempre aggiornato, è sulla pagina
**[artipop…workers.dev/aiuto](https://artipop.riccardo-dominici.workers.dev/aiuto)**.
Il caso di gran lunga più frequente:

> **A mano funziona, in automazione non succede niente.**
> Causa: l'interruttore **"Mostra anteprima"** acceso nell'azione *Imposta
> sfondo*. Con l'anteprima attiva l'azione deve mostrarti un foglio di conferma:
> a mano lo tocchi senza farci caso, ma un'automazione gira in background — di
> norma a telefono bloccato — dove **nessuna schermata può comparire**. L'azione
> si ferma lì, senza errore.
> Rimedio: spegni "Mostra anteprima". Le Shortcut scaricate dal sito ce l'hanno
> già spento; se la tua è vecchia, riscaricala.

---
---

# Parte 2 — Gestire ArtiPop

## 2.1 Architettura in 30 secondi

Un solo **Cloudflare Worker** sul piano gratuito fa tutto:

```
cron 03:00 UTC
      │
      ├─► fan-out: una richiesta interna per canale (binding SELF)
      │        │
      │        ├─ story.js    la storia avanza di un giorno
      │        ├─ generate.js FLUX.2 klein genera l'immagine (960x2048)
      │        └─ storage.js  KV: latest + archivio permanente + stato
      │
      └─► HTTP: /w/<canale> immagine · / sito · /aiuto · /s/… Shortcut · /api/…
```

Dettagli tecnici: [`backend/README.md`](backend/README.md).

## 2.2 Anatomia di una giornata

1. **03:00 UTC** — parte il cron, che fa fan-out con una richiesta per canale
   (ogni canale ha così il proprio budget CPU sul piano free).
2. `evolveStory` avanza di un giorno. Se il ciclo di 7 giorni è finito
   → **nuova base**: nuovo progetto, nuovo keyframe, nuovo seed.
3. `generateDay` genera l'immagine, con o senza riferimento visivo a seconda
   del punto del ciclo (vedi [2.6](#26-come-è-garantita-la-coerenza-visiva)).
4. L'immagine finisce in KV: `img:<ch>:latest`, `archive:<ch>:<data>`, `meta:<ch>`.
5. **Al tramonto** la Shortcut dell'utente scarica `/w/<canale>` e lo imposta.

> Se un passaggio fallisce, resta l'immagine del giorno prima: la Shortcut degli
> utenti non si rompe mai.

## 2.3 Mappa del repo

| Percorso | Cosa c'è |
|---|---|
| `backend/src/index.js` | routing HTTP, cron, orchestrazione per canale |
| `backend/src/channels.js` | definizione dei canali: identità visiva, progetti, tappe |
| `backend/src/story.js` | evoluzione giornaliera e ciclo di vita degli archi |
| `backend/src/generate.js` | catena di generazione immagini con fallback |
| `backend/src/storage.js` | layout delle chiavi KV |
| `backend/src/page.js` | landing page |
| `backend/src/help.js` | pagina `/aiuto` (troubleshooting + FAQ) |
| `backend/src/config.js` | tutti i parametri regolabili, documentati |
| `shortcut/` | template, build e verifica dei file `.shortcut` firmati |

## 2.4 Operazioni comuni

```bash
cd backend
npx wrangler deploy                # deploy di qualsiasi modifica
npx wrangler tail                  # log in tempo reale
npx wrangler secret put ADMIN_KEY  # (ri)genera la chiave admin
```

| Voglio… | Come |
|---|---|
| Rigenerare tutti i canali | `curl "…/run-all?force=1&key=<ADMIN_KEY>"` |
| Rigenerare un canale | `…/run/island?force=1&key=<ADMIN_KEY>` |
| Rigenerare **un solo giorno** venuto male | `…/regen-day?ch=island&date=2026-07-20&key=…` |
| Ricostruire una settimana di storia | `…/backfill?ch=island&days=7&key=…` (azzera lo stato del canale; 7 = un ciclo intero) |
| Attivare/disattivare un canale | `active: true/false` in `channels.js` + deploy. L'archivio resta in KV |
| Aggiungere un canale | nuova voce in `channels.js`. Un canale a progressione vuole **esattamente 7** `stageTemplates` |
| Cambiare l'orario di generazione | `triggers.crons` in `backend/wrangler.jsonc` (UTC) |
| Cambiare la durata del ciclo | `ARC_LENGTH_DAYS` in `config.js` — **e le tappe di ogni canale** |
| Vedere i consumi AI | dash.cloudflare.com → AI → Workers AI |

> La chiave admin è un secret di Wrangler: se la perdi non si recupera, se ne
> genera una nuova con `npx wrangler secret put ADMIN_KEY`
> (es. `openssl rand -hex 20`). Protegge `/run`, `/run-all`, `/backfill`,
> `/regen-day`, `/test-size`, `/test-edit`.

## 2.5 Come sono fatti i canali

Ci sono **due motori**, scelti dal campo `mode`:

**Canali a progressione** (`mode: "progression"` — gli attivi: island, studio, bloom).
Un arco = un **progetto** che si completa in esattamente
`CONFIG.ARC_LENGTH_DAYS` = **7 giorni**. Il piano è deterministico e curato a
mano in `channels.js` (`stageTemplates`, dove `{s}` = nome breve del progetto).
Ogni giorno mostra una tappa: un cambiamento visibile e cumulativo sulla stessa
scena fissa. All'ottavo giorno si cambia base.

**Canali "viaggio"** (nessun `mode` — quelli in pausa). Un LLM riscrive ogni
giorno la scena "un giorno dopo", con una guardia anti-deriva e un fallback
deterministico. Stesso ciclo di 7 giorni.

Due modalità di riferimento visivo (`refMode`):

| refMode | Come genera il giorno N | Quando usarlo |
|---|---|---|
| *(default)* | edit additivo: `input_image_0` = ieri, `input_image_1` = keyframe | scene illustrate/pittoriche |
| `anchor-cumulative` | sempre e solo il keyframe + la lista cumulativa di ciò che c'è | scene fotorealistiche lisce, che in catena accumulano artefatti |

> **Invariante:** un canale a progressione deve avere esattamente
> `ARC_LENGTH_DAYS` `stageTemplates` (e altrettante `stageSummaries` se usa
> `anchor-cumulative`). È verificata a caricamento modulo: se sgarra, lo vedi
> in `wrangler tail` senza che il canale vada offline.

## 2.6 Come è garantita la coerenza visiva

In ordine di importanza:

1. **Àncora visiva — "anchor, don't chain".** Il primo giorno del ciclo è un
   *keyframe* generato pulito; i giorni dopo si edita **il keyframe**, mai
   l'output di ieri. La degradazione da editing iterato (visibile dal 2°-3°
   passaggio in catena) non si accumula mai. Con archi da 7 giorni la catena è
   lunga al massimo 6 passaggi. Il keyframe stesso viene riallineato con un
   auto-edit alla famiglia visiva degli edit.
2. **Identità fissa.** `style` + `palette` del canale entrano in *ogni* prompt.
3. **Seed stabile per arco.** Composizioni imparentate per tutti i 7 giorni;
   nuovo arco → nuovo seed.
4. **Tappe quantificate.** Ogni tappa dichiara un cambiamento misurabile
   ("DOUBLED", "HALF of its final height"): vedi [2.10](#210-lezioni-imparate-non-regredire).
5. **Guardia anti-deriva** (solo canali "viaggio"): la scena proposta dall'LLM
   è accettata solo se resta nel vocabolario del canale, non ripete quasi
   identica una scena recente e non contiene elementi vietati; altrimenti
   scatta il fallback deterministico.

L'immagine di riferimento va ridotta sotto i 512px: lo fa il resizer gratuito
`images.weserv.nl`. Se non risponde, quel giorno si genera senza riferimento —
nessun blocco.

## 2.7 Le Shortcut firmate

In [`shortcut/`](shortcut/README.md): due template, `build_shortcuts.sh` (firma
con `shortcuts sign --mode anyone`, richiede macOS) e `verify_shortcuts.py`.

| Variante | Template | Servita su | Cosa fa |
|---|---|---|---|
| principale | `template-poster.shortcut.xml` | `/s/<ch>.shortcut` | 4 azioni: aggiorna sempre l'**ultimo** sfondo della lock screen |
| base | `template.shortcut.xml` | `/s/<ch>-base.shortcut` | 2 azioni: lascia a iOS la scelta dello sfondo — piano B |

Entrambe impostano nell'azione *Imposta sfondo*:

- `WFWallpaperShowPreview = false` → **la riga che rende usabile l'automazione**;
- `WFWallpaperSmartCrop = false` → niente ritaglio sul soggetto, che sposterebbe
  l'inquadratura composta apposta per la lock screen.

`build_shortcuts.sh` **verifica i file dopo averli firmati**: riapre l'archivio
AEA, ne estrae `Shortcut.wflow` e controlla le invarianti. Se qualcosa non torna
la build fallisce e i file non vanno distribuiti. Dopo la build, caricali in KV
con i comandi `wrangler kv key put` che lo script stampa.

> Dopo ogni modifica ai template: **rigenera, verifica, ricarica in KV.**
> I file in KV sono quelli che gli utenti scaricano.

## 2.8 Limiti del piano gratuito

Con i 3 canali attivi di oggi:

| Risorsa | Uso attuale | Limite free | Margine |
|---|---|---|---|
| Neuroni Workers AI | ~600/giorno (~800 nei giorni di cambio base) | 10.000/giorno | spazio per ~40 canali |
| Scritture KV | ~15/giorno | 1.000/giorno | enorme |
| **Storage KV (archivio)** | ~3,3 MB/giorno | 1 GB | **~10 mesi** ⚠️ |
| Richieste Worker | poche migliaia/giorno | 100.000/giorno | enorme |

L'unico limite che si avvicina davvero è lo **storage dell'archivio**. Quando la
dashboard KV supera ~800 MB, due strade: abilitare R2 (10 GB gratuiti, richiede
attivazione con carta ma resta gratis) e spostarci l'archivio, oppure esportare
lo storico su GitHub e liberare le chiavi `archive:*` più vecchie.

Se i neuroni si esaurissero comunque: le generazioni falliscono, resta
l'immagine del giorno prima, **zero addebiti**.

## 2.9 Runbook: quando qualcosa si rompe

| Sintomo | Prima cosa da guardare | Rimedio |
|---|---|---|
| Oggi nessuna immagine nuova | `npx wrangler tail` durante `…/run/<ch>?force=1` | se è il modello, riprova: klein non è deterministico |
| Un giorno è venuto brutto | — | `…/regen-day?ch=X&date=Y&key=…` |
| Il canale ripete ieri identico | le tappe sono quantificate? | vedi [2.10](#210-lezioni-imparate-non-regredire), punto 5 |
| Il progetto completo compare al giorno 1 | la tappa 1 nomina il risultato finale? | vedi [2.10](#210-lezioni-imparate-non-regredire), punto 1 |
| Miniature di riferimento sbagliate | cache di `images.weserv.nl` | serve un nonce nell'URL sorgente |
| `/backfill` si ferma a metà | è sincrono di proposito | resta connesso, rilancia se cade |
| Il DNS non risolve workers.dev | — | `curl --resolve "artipop.riccardo-dominici.workers.dev:443:172.67.176.123" …` |
| Le Shortcut degli utenti non funzionano in automazione | `python3 shortcut/verify_shortcuts.py` | rigenera e ricarica in KV |

## 2.10 Lezioni imparate (non regredire)

Tutte verificate sul campo. Cambiarle senza motivo rompe cose che funzionano.

1. **Le tappe iniziali non devono nominare il risultato finale** del progetto,
   né usare `{s}`: il modello lo disegnerebbe subito.
2. **`images.weserv.nl` cachea per URL**: serve un nonce nell'URL sorgente, o le
   rigenerazioni ricevono le miniature del run precedente.
3. **klein non è deterministico** nemmeno a seed fisso: per il giorno storto c'è
   `/regen-day`.
4. **Il planner LLM delle tappe è disattivato**: produceva tappe fuori bersaglio.
   Si usano i template curati.
5. **Le tappe devono essere QUANTIFICATE** ("raddoppiato", "metà dell'altezza
   finale"): senza numeri il modello, istruito a preservare tutto il resto,
   riproduce ieri quasi identico.
6. **Le scene fotorealistiche lisce accumulano macchie in catena**: per quelle
   serve `refMode: "anchor-cumulative"`, o uno stile pittorico/bokeh.
7. **`/backfill` deve restare sincrono**: `ctx.waitUntil` viene ucciso dopo
   ~30-60s dalla risposta.
8. **Mai backtick nei commenti dentro `page.js`/`help.js`**: l'HTML sta dentro un
   template literal JS e un backtick lo chiude a metà.
9. **Lo schema `shortcuts://import-workflow` non esiste più**: non compare in
   nessun binario di sistema su macOS 26. Per l'apertura in un tap l'unica via
   sarebbe un link iCloud, che però va generato a mano da un device.
