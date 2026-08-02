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
e sfoglia le card (si trascinano). Un canale non è più un tema fisso: è
un'**indole**, e ogni settimana pesca dalla libreria una storia diversa —
cambia la sceneggiatura dei 7 giorni, non cambia il carattere del canale.

| Canale | Indole (cosa può capitare) | URL |
|---|---|---|
| 🌿 **Natura** | cose che nascono e si costruiscono: una pianta che cresce, un'isola o un edificio che prende forma | `…/w/natura` |
| 🌆 **Città** | luoghi abitati che evolvono nel tempo, e viaggi che li attraversano | `…/w/citta` |
| 🕯️ **Quiete** | spazi intimi che si riempiono di vita, forme che si trasformano | `…/w/quiete` |
| 🎲 **Random** | ogni giorno uno dei tre canali sopra, a sorpresa | `…/w/random` |

> Isola, Studio e Bloom — i canali della versione precedente — non sono
> spariti: sono diventati tre delle tante storie che i canali di oggi possono
> pescare (Isola e Bloom sotto Natura, Studio sotto Quiete). I loro vecchi
> indirizzi funzionano ancora — `…/w/island`, `…/w/studio`, `…/w/bloom`
> mostrano l'immagine di oggi del canale che ne ha raccolto l'eredità — e il
> loro archivio resta consultabile per sempre sotto il nome di allora
> (`…/w/island?date=…`, vedi [1.5](#15-uso-quotidiano)).

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
| Riscaricare un giorno preciso | `…/w/island?date=2026-07-16` (data inesistente? → §1.6) |
| Seguire un canale da un lettore di feed | Iscrivi il tuo lettore RSS a `…/feed/<canale>.xml` |

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

> **Lo sfondo è diventato un rettangolo scuro senza disegno.**
> Causa: l'indirizzo ha risposto, ma per quel canale/data non c'è ancora
> un'immagine — il canale è nuovo e non è ancora stato generato, oppure hai
> chiesto `?date=` di un giorno in cui quel canale non esisteva. Per scelta di
> progetto l'indirizzo risponde sempre con un'immagine valida, mai con un
> errore: meglio uno sfondo segnaposto che una Shortcut rotta.
> Rimedio: se hai usato `?date=`, togli il parametro o scegli una data
> presente in **"Il viaggio finora"** sul sito; se il canale è appena stato
> aggiunto, aspetta il cron della notte perché produca la prima immagine.

---
---

# Parte 2 — Gestire ArtiPop

## 2.1 Architettura in 30 secondi

Un solo **Cloudflare Worker** sul piano gratuito fa tutto:

```
cron 03:00 UTC
      │
      ├─► fan-out: una richiesta interna per canale (binding SELF),
      │            i canali falliti al primo colpo vengono ritentati una volta
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

> Se un passaggio fallisce (errore transitorio di AI/KV, 500 interno), il
> fan-out ritenta quel canale una volta, sempre senza `force` — recupera la
> classe di guasti più comune senza rischiare doppie generazioni (`runChannel`
> è idempotente su `lastDate`). Se anche il ritentativo fallisce, resta
> l'immagine del giorno prima: la Shortcut degli utenti non si rompe mai.

## 2.3 Mappa del repo

| Percorso | Cosa c'è |
|---|---|
| `backend/src/index.js` | routing HTTP: autenticazione, CORS, dispatch delle rotte, cron (fan-out) |
| `backend/src/handlers.js` | orchestrazione di un giorno di generazione: `runChannel`, `backfillChannel`, `regenDay` |
| `backend/src/channels.js` | i tre flussi (natura, città, quiete) e gli alias verso i vecchi canali (island, studio, bloom, …) |
| `backend/src/story.js` | evoluzione giornaliera e ciclo di vita degli archi |
| `backend/src/generate.js` | catena di generazione immagini con fallback |
| `backend/src/storage.js` | layout delle chiavi KV |
| `backend/src/page.js` | landing page |
| `backend/src/help.js` | pagina `/aiuto` (troubleshooting + FAQ) |
| `backend/src/archivi.js` | pagina `/archivi` (elenco dei canali con giorni in archivio, storici e in corso) e `/archivi/<id>` (un giorno d'archivio con precedente/successivo) |
| `backend/src/config.js` | tutti i parametri regolabili, documentati |
| `shortcut/` | template, build e verifica dei file `.shortcut` firmati |
| `tuning/` | strumento locale per il maintainer — vedi [`tuning/README.md`](tuning/README.md) |

Dettagli su tutti i moduli (compresi quelli del catalogo e delle misure):
[`backend/README.md`](backend/README.md).

## 2.4 Operazioni comuni

```bash
cd backend
npx wrangler deploy                # deploy di qualsiasi modifica
npx wrangler tail                  # log in tempo reale
npx wrangler secret put ADMIN_KEY  # (ri)genera la chiave admin
```

| Voglio… | Come |
|---|---|
| Rigenerare tutti i canali | `curl -H "x-artipop-key: <ADMIN_KEY>" "…/run-all?force=1"` |
| Rigenerare un canale | `curl -H "x-artipop-key: <ADMIN_KEY>" "…/run/natura?force=1"` |
| Rigenerare **un solo giorno** venuto male | `curl -H "x-artipop-key: …" "…/regen-day?ch=natura&date=2026-07-20"` |
| Ricostruire una settimana di storia | `curl -H "x-artipop-key: …" "…/backfill?ch=natura&days=7"` (azzera lo stato del canale; 7 = un ciclo intero) |
| Attivare/disattivare un canale | `active: true/false` in `channels.js` + deploy. L'archivio resta in KV |
| Aggiungere un soggetto alla libreria | riga in `concepts.js` (rideploy), **oppure** `PUT /catalogo/element` a caldo, senza rideploy |
| Aggiungere un canale | nuova voce in `channels.js` con `famiglie` **disgiunte** da quelle degli altri canali |
| Cambiare l'orario di generazione | `triggers.crons` in `backend/wrangler.jsonc` (UTC) |
| Cambiare la durata del ciclo | `ARC_LENGTH_DAYS` in `config.js` — **e le sette tappe di ogni famiglia in `families.js`** |
| Vedere i consumi AI | dash.cloudflare.com → AI → Workers AI |

> Gli endpoint che generano accettano anche gli **alias storici**:
> `…/run/island?force=1` funziona di nuovo (era rotto: rispondeva "flusso
> sconosciuto" pur essendo qui documentato) e viene instradato sul canale che
> ne ha raccolto l'eredità — l'immagine di oggi finisce nell'archivio di
> **natura**, non sotto `island`. Stesso comportamento per `/backfill?ch=island`
> e `/regen-day?ch=island`.

> La chiave admin è un secret di Wrangler: se la perdi non si recupera, se ne
> genera una nuova con `npx wrangler secret put ADMIN_KEY`
> (es. `openssl rand -hex 20`).

### Endpoint, in breve

Tutte le scritture e le generazioni vogliono l'header `x-artipop-key:
<ADMIN_KEY>` (mai `?key=` in query: finirebbe nei log e nella cronologia del
browser — unica eccezione `GET /lab/img`, caricata da un `<img src>` che non
può portare header); quelle marcate *pubblico* no — sono le stesse GET che
usano il sito e lo strumento di tuning in sola lettura.

| Endpoint | Cosa fa |
|---|---|
| `/run/<flusso>?force=1` | genera l'immagine di oggi (idempotente senza `force`; accetta alias storici) |
| `/run-all?force=1` | genera tutti i canali attivi; i canali falliti al primo colpo vengono ritentati una volta, sempre senza `force` |
| `/backfill?ch=<flusso>&days=N[&gate=0]` | ricostruisce N giorni di storia, stato azzerato |
| `/regen-day?ch=<flusso>&date=YYYY-MM-DD` | rigenera un solo giorno già passato |
| `/test-size?w=&h=` | verifica se il modello accetta una risoluzione |
| `/test-metrics?ch=&a=&b=[&concept=]` | misura il cambiamento fra due giorni d'archivio |
| `GET /tuning` *(pubblico)* · `PUT`/`DELETE /tuning` | range del cancello: lettura libera, scrittura protetta |
| `GET /catalogo` *(pubblico)* · `PUT`/`DELETE /catalogo/concept`, `/catalogo/element` | concept/element aggiunti da fuori, senza rideploy |
| `GET /note` · `PUT /note/giorno` · `PUT`/`DELETE /note/assetto` — tutte protette dalla chiave admin | marcature dei giorni e assetti di tuning salvati |
| `GET/POST /lab/arc?concept=&element=&days=&gate=` | genera un arco di prova (non tocca la produzione) |
| `GET /lab/img?run=&n=` | serve un'immagine di prova del Lab |
| `GET /api/channels[?all=1]` *(pubblico)* | stato dei canali attivi, incluso `famiglie` per canale; con `all=1` anche i canali storici, marcati `storico:true` |
| `GET /api/archive/<canale>[?limit=]` *(pubblico)* | date + carta d'identità del canale; `limit` fino a 400 (default 60) |
| `GET /health` *(pubblico)* | per flusso: `id`, `famiglie`, `concepts`, `cancello` dell'ultima esecuzione, `freschezza` (`ultimaData`, `aggiornato`, `giorniDiRitardo` rispetto a oggi); più `flussiFermi` (numero di flussi con `freschezza.aggiornato:false`) e `misuratore` (booleano, binding Images disponibile) |
| `GET /w/<flusso>[.jpg\|.png][?date=\|?v=][&dl=1]` *(pubblico)* | immagine del giorno per la lock screen; il corpo è **sempre** byte immagine, **mai** JSON — se il canale non ha ancora generato nulla o `?date=` non esiste, risponde con il placeholder statico. Con `?dl=1` la risposta aggiunge `content-disposition: attachment` con un nome file parlante (`artipop-<flusso>-<data>.png`/`.jpg`), per far arrivare il salvataggio su disco con un nome riconoscibile invece del blob senza estensione — non emesso sul placeholder |
| `GET /s/<flusso>[-base].shortcut` *(pubblico)* | Shortcut firmata da installare (variante principale o base, vedi [2.7](#27-le-shortcut-firmate)) |
| `GET /archivi` *(pubblico)* | pagina HTML: tutti i canali con giorni in archivio, storici (island, bloom, studio, neon, …) e ancora attivi, con intervallo date e link per riaprire l'ultimo giorno di ciascuno — copertina, "Riapri l'ultimo giorno" e ogni data dell'elenco espandibile aprono `/archivi/<id>`, non più il binario grezzo di `/w/`; la card di un canale attivo porta anche il link «canale in corso» verso `/?c=<id>` |
| `GET /archivi/<id>[?date=]` *(pubblico)* | pagina HTML di un giorno d'archivio: wallpaper, data, canale e comandi «giorno precedente / successivo» per sfogliare senza tornare a `/archivi`; senza `?date=` mostra il giorno più recente; `?date=` malformata o non in archivio, o id sconosciuto → HTML 404 con link a `/archivi`, mai JSON |
| `GET /feed/<flusso>.xml` *(pubblico)* | feed RSS 2.0 degli ultimi 20 giorni d'archivio (accetta alias storici); un `<item>` per giorno con titolo, link, `pubDate` ed enclosure verso `/w/<flusso>?date=`; flusso inesistente → 404 con corpo XML, mai JSON |
| `GET /feed.xml` *(pubblico)* | feed RSS 2.0 aggregato: gli ultimi giorni di tutti i canali attivi in un solo feed, ordinati dal più recente, ogni `<item>` col nome del canale nel titolo e link/enclosure verso il proprio canale |
| `GET /robots.txt` *(pubblico)* | testo semplice per i crawler: apre le pagine di lettura (`/`, `/aiuto`, `/archivi`, `/archivi/<id>`, `/w/...`) e chiude le stanze di servizio (`/tuning`, `/lab/`, `/catalogo`, `/note`, `/api/`, `/health`, `/backfill`, `/regen-day`, `/run-all`, `/test-metrics`, `/test-size`); annuncia `/sitemap.xml` con una riga `Sitemap:` |
| `GET /sitemap.xml` *(pubblico)* | XML sitemaps.org 0.9: `/`, `/aiuto`, `/archivi` e una `<url>` per ogni canale storico con archivio, con `<lastmod>` pari alla data del suo ultimo giorno |

## 2.5 Come sono fatti i canali

Un canale (nel codice, un **flusso**: `backend/src/channels.js`) non è
legato a un tema fisso. È un'**indole**: un insieme di famiglie di storie da
cui pescare. Ogni volta che un ciclo di 7 giorni si chiude, il canale ne
pesca una nuova, diversa dalle ultime usate, e non la rivede finché non ha
esaurito le altre (`pickConcept` in `story.js`).

Il vocabolario, dal più generale al più specifico:

- **CONCEPT** = una **FAMIGLIA** (`backend/src/families.js`): la *forma* di
  una storia di 7 giorni. Definisce le sette tappe (tappa 0 = stato di
  partenza; 1-6 = il cambiamento di quel giorno rispetto a ieri) e il
  *profilo di cambiamento* con cui il cancello giudica se un'immagine è
  cambiata abbastanza, e non troppo (vedi [2.6](#26-come-è-garantita-la-coerenza-visiva)
  e `metrics.js`). Esempi: crescita, costruzione, timelapse, attraversamento,
  accumulo, metamorfosi.
- **ELEMENT** (`backend/src/concepts.js`) = il *soggetto* che riempie quella
  forma: setting, stile, palette, e il nome breve che sostituisce `{s}`
  nelle tappe. Girasole, Isola, Studio, Neon sono tutti element: ciascuno
  pesca dalla propria famiglia nativa, e può portare tappe proprie quando il
  copione generico della famiglia non gli si addice (le felci non hanno
  petali: vedi il commento in testa a `concepts.js`).
- Un canale ha un'**indole**: le famiglie da cui può pescare (`famiglie` in
  `channels.js`). Le indoli sono **disgiunte** — nessuna famiglia appartiene
  a due canali — così due canali non possono mai pescare lo stesso element
  nella stessa settimana, senza bisogno di coordinamento fra loro.

| Canale | Indole (famiglie) |
|---|---|
| natura | crescita, costruzione |
| città | timelapse, attraversamento |
| quiete | accumulo, metamorfosi |

La libreria di element è **estendibile a caldo, senza rideploy**: oltre a
quelli scritti nel codice (`concepts.js`), un secondo strato in KV
(`backend/src/catalog.js`) accetta nuovi concept e nuovi element creati da
fuori — è lo strumento di tuning (tab **Catalogo**) a scriverci, tramite
`PUT /catalogo/concept` e `PUT /catalogo/element` (vedi
[2.4](#24-operazioni-comuni)). Da quel momento non c'è più differenza fra un
element "di fabbrica" e uno custom: `resolveConcept` li tratta allo stesso
modo ovunque nel sistema.

**Famiglie ed element sospesi dalla pesca.** `FAMIGLIE_SOSPESE` e
`ELEMENT_SOSPESI` (`backend/src/config.js`) sono due liste di id esclusi
dalla pesca di un concept **nuovo**. Il filtro agisce in un unico punto
(`poolForWith` in `catalog.js`): un arco già in corso chiude comunque i suoi
7 giorni e l'archivio non viene toccato — la voce sospesa resta raggiungibile
per id dal lab in ogni momento, sparisce solo dall'estrazione casuale. Oggi
l'unica voce sospesa è l'element `canoa` (`ELEMENT_SOSPESI`): fuori dal
profilo di cambiamento della sua famiglia, brucia tutti i tentativi
dell'arco e pubblica comunque il candidato migliore — uno sfondo degradato
per l'utente reale. `FAMIGLIE_SOSPESE` è vuota dopo M10.

Elenco delle voci sospese oggi:

- `canoa` (element)

Si toglie una sospensione rimuovendo l'id dalla lista in `config.js`, dopo
un arco lab gated verde su preview (come già fatto per `attraversamento` in
M10). La si vede dal tool nel tab **Catalogo** (badge «sospeso» sulla voce)
e dall'API nel campo booleano `sospeso` di `GET /catalogo`.

> **Invariante:** ogni famiglia deve avere esattamente `ARC_LENGTH_DAYS`
> (oggi 7) tappe in `families.js`. È verificata a caricamento modulo
> (`channels.js`): se una famiglia sgarra, lo si vede in `wrangler tail`
> senza che nessun canale vada offline.

## 2.6 Come è garantita la coerenza visiva

In ordine di importanza:

1. **Doppio riferimento visivo.** Il primo giorno del ciclo è un *keyframe*
   generato pulito (poi riallineato con un auto-edit alla famiglia visiva
   degli edit, tenuto solo se le misure dicono che non ha perso nulla per
   strada). Ogni giorno successivo entrano nel modello **due** immagini
   insieme: quella di ieri (cosa preservare) e il keyframe dell'arco (l'àncora
   di qualità da cui non allontanarsi troppo) — mai il solo editing a catena
   dell'output precedente. Se ieri non è recuperabile si riparte dal solo
   keyframe descrivendo lo stato cumulativo raggiunto; se manca anche quello,
   si genera da zero, senza riferimento.
2. **Identità fissa.** `style` + `palette` dell'element entrano in *ogni* prompt.
3. **Seed stabile per arco.** Composizioni imparentate per tutti i 7 giorni;
   nuovo arco → nuovo seed.
4. **Tappe quantificate.** Ogni tappa dichiara un cambiamento misurabile
   ("DOUBLED", "HALF of its final height"): vedi [2.10](#210-lezioni-imparate-non-regredire).
5. **Il cancello di collaudo** (`metrics.js` + `generate.js`, funzione
   `generateWithGate`). Prima di pubblicare, l'immagine candidata si confronta
   con quella di ieri su sei misure (estensione, intensità, compattezza,
   deriva, degrado, occupazione) e si accetta solo se rientra nel profilo
   della famiglia; se no si rigenera correggendo la "dose" di descrizione
   (fino a `MAX_ATTEMPTS` tentativi, poi si pubblica il candidato più vicino
   al bersaglio). Prima riguardava solo alcuni canali; ora si applica SEMPRE,
   a ogni canale e ogni giorno.

L'immagine di riferimento va ridotta sotto i 512px perché il modello la
accetti: se ne occupa il **binding Images di Cloudflare**, sui byte già in
memoria — nessun servizio esterno, nessuna cache che possa restituire a una
rigenerazione la miniatura di un run precedente (era un problema reale con
l'approccio iniziale, vedi [2.10](#210-lezioni-imparate-non-regredire), punto 2).

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
| Un giorno è venuto brutto | — | `curl -H "x-artipop-key: …" "…/regen-day?ch=X&date=Y"` |
| Il canale ripete ieri identico | le tappe sono quantificate? | vedi [2.10](#210-lezioni-imparate-non-regredire), punto 5 |
| Il progetto completo compare al giorno 1 | la tappa 1 nomina il risultato finale? | vedi [2.10](#210-lezioni-imparate-non-regredire), punto 1 |
| `/backfill` si ferma a metà | è sincrono di proposito | resta connesso, rilancia se cade |
| Il DNS non risolve workers.dev | — | `curl --resolve "artipop.riccardo-dominici.workers.dev:443:172.67.176.123" …` |
| Le Shortcut degli utenti non funzionano in automazione | `python3 shortcut/verify_shortcuts.py` | rigenera e ricarica in KV |
| Lo sfondo è un gradiente scuro senza disegno | `/health` (canale mai generato o `?date=` inesistente) | `curl -H "x-artipop-key: …" "…/run/<ch>?force=1"` |
| Una pagina dice «errore temporaneo» | rete di sicurezza globale del worker (`index.js`) | `npx wrangler tail` |
| Un element non esce mai dalla pesca | badge sospeso nel tab Catalogo / `ELEMENT_SOSPESI` in `config.js` | è voluto: vedi [2.5](#25-come-sono-fatti-i-canali) |

## 2.10 Lezioni imparate (non regredire)

Tutte verificate sul campo. Cambiarle senza motivo rompe cose che funzionano.

1. **Le tappe iniziali non devono nominare il risultato finale** del progetto,
   né usare `{s}`: il modello lo disegnerebbe subito.
2. **Un resizer esterno per URL cachea per URL**: la prima versione del
   ridimensionamento del riferimento passava da un servizio esterno chiamato
   con un URL pubblico, che restituiva alle rigenerazioni la miniatura del
   run precedente. Risolto spostando il ridimensionamento sul binding Images
   di Cloudflare, che lavora sui byte già in memoria — quella dipendenza non
   c'è più. Se in futuro serve di nuovo un resizer esterno per URL, aspettati
   lo stesso problema: serve un nonce nell'URL sorgente.
3. **klein non è deterministico** nemmeno a seed fisso: per il giorno storto c'è
   `/regen-day`.
4. **Il planner LLM delle tappe è stato rimosso**: produceva tappe fuori
   bersaglio. Si usano le tappe curate a mano in `families.js`.
5. **Le tappe devono essere QUANTIFICATE** ("raddoppiato", "metà dell'altezza
   finale"): senza numeri il modello, istruito a preservare tutto il resto,
   riproduce ieri quasi identico.
6. **Le scene fotorealistiche lisce accumulano macchie in catena**: per questo
   ogni giorno normale usa DUE riferimenti insieme (ieri + keyframe
   dell'arco, vedi [2.6](#26-come-è-garantita-la-coerenza-visiva)) invece del
   solo editing a catena — non è una modalità da scegliere per famiglia, è il
   comportamento di sempre.
7. **`/backfill` deve restare sincrono**: `ctx.waitUntil` viene ucciso dopo
   ~30-60s dalla risposta.
8. **Mai backtick nei commenti dentro `page.js`/`help.js`**: l'HTML sta dentro un
   template literal JS e un backtick lo chiude a metà.
9. **Lo schema `shortcuts://import-workflow` non esiste più**: non compare in
   nessun binario di sistema su macOS 26. Per l'apertura in un tap l'unica via
   sarebbe un link iCloud, che però va generato a mano da un device.
