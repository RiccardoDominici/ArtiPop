# 🌅 ArtiPop — Un wallpaper nuovo ogni giorno, che evolve

Ogni sera al tramonto il tuo iPhone cambia sfondo da solo, con un'immagine
generata dall'AI **quella notte stessa**. E non è mai un'immagine a caso:
ogni canale è un **viaggio che evolve giorno dopo giorno** — la valle alpina di
ieri oggi è un po' più in alto sul sentiero, la città neon ha acceso nuove insegne.

**Gratis. Senza app. Senza account.** Solo una Shortcut.

👉 **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)**
— sfoglia i canali (swipe!), guarda la preview sulla lock screen e l'archivio del viaggio

## 🎨 I canali attivi

| Canale | Cosa succede, giorno dopo giorno | URL |
|---|---|---|
| 🏝️ **Isola** | un'isola fluttuante prende vita: roccia nuda → prato → alberi → cascata → una casetta con le luci accese | `/w/island` |
| 📚 **Studio** | una scrivania vuota si riempie di vita, un oggetto al giorno | `/w/studio` |
| 🌸 **Bloom** | una pianta cresce dal seme alla fioritura nello stesso vaso | `/w/bloom` |
| 🎲 **Random** | ogni giorno un canale a sorpresa | `/w/random` |

Tutti gli URL iniziano con `https://artipop.riccardo-dominici.workers.dev`.
Ogni giorno cambia UN pezzo della scena (una pennellata, una foglia nuova) e il
resto resta identico: non è un'immagine diversa, è la stessa storia che avanza.
Altri canali "viaggio" (🏔️ Horizon, 🌃 Neon, 🪐 Cosmos, 🌊 Depths, 🎨 Aurora)
sono pronti nel codice, in pausa: si attivano con una riga.

## ⬇️ Scarica la Shortcut

Shortcut già pronte, con l'URL del canale dentro — scarica, apri, importa:

**[🏝️ Isola](https://artipop.riccardo-dominici.workers.dev/s/island.shortcut)** ·
**[📚 Studio](https://artipop.riccardo-dominici.workers.dev/s/studio.shortcut)** ·
**[🌸 Bloom](https://artipop.riccardo-dominici.workers.dev/s/bloom.shortcut)** ·
**[🎲 Random](https://artipop.riccardo-dominici.workers.dev/s/random.shortcut)**

> Se iOS blocca l'import: *Impostazioni → Scorciatoie → Consenti scorciatoie non
> attendibili* (il toggle appare dopo aver eseguito una scorciatoia qualsiasi).
>
> ⚠️ Il vecchio link iCloud del README precedente puntava al backend AWS dismesso:
> non usarlo, scaricava immagini che non si aggiornano più.

## 📲 Attivalo in 2 minuti

1. **Scarica la Shortcut** del tuo canale (link qui sopra, o dal sito) e importala:
   ha già dentro URL, anteprima spenta e ritaglio automatico spento.
   Preferisci farla a mano? 2 azioni: *Ottieni contenuto da URL* (incolla il link
   del canale) + *Imposta sfondo* (**disattiva "Mostra anteprima"**, o in
   automazione non funzionerà).
2. **Automazioni** → *Ora del giorno* → **Tramonto** → *Esegui immediatamente*.
3. Fine: da stasera cambia da solo.

ArtiPop aggiorna sempre l'**ultimo** sfondo della schermata di blocco: se in
fondo hai uno sfondo a cui tieni, aggiungine uno nuovo qualsiasi e sarà quello.

- Passo-passo, uso quotidiano e manuale del maintainer → **[GUIDA.md](GUIDA.md)**
- Problemi e FAQ, sempre aggiornati → **[pagina /aiuto](https://artipop.riccardo-dominici.workers.dev/aiuto)**

## 🧠 Come funziona

- Ogni notte un cron su **Cloudflare Workers** (piano free) fa avanzare la
  storia di ogni canale: un arco = un progetto di 7 giorni (piano di tappe
  curate), e l'immagine di oggi è un **edit additivo** di quella di ieri
  (FLUX.2 klein con doppio riferimento: ieri = contenuto da preservare,
  keyframe dell'arco = àncora di qualità) — cambia solo il pezzo del giorno.
- L'immagine è generata da **FLUX.2 klein-4b** (Workers AI) a 960x2048.
- **Niente va perso**: ogni wallpaper finisce in un archivio permanente,
  consultabile dal sito ("Il viaggio finora") o via `…/w/horizon?date=YYYY-MM-DD`.
- Se una generazione fallisce resta l'immagine di ieri: la Shortcut non si
  rompe mai.
- Tutto dentro i limiti gratuiti: ~500 neuroni/giorno su 10.000, nessun costo
  possibile nemmeno per sbaglio.

## 🛠 Per sviluppatori e maintainer

- **[GUIDA.md](GUIDA.md)** — guida completa: uso, gestione, operazioni comuni,
  limiti free tier e cosa fare quando l'archivio cresce.
- **[backend/README.md](backend/README.md)** — architettura del Worker
  (~700 righe commentate), costi in neuroni, deploy, endpoint admin.
- **[shortcut/README.md](shortcut/README.md)** — file `.shortcut` firmati per
  canale (sperimentali) e pipeline per rigenerarli.
