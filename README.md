# 🌅 ArtiPop — Un wallpaper nuovo ogni giorno, che evolve

Ogni sera al tramonto il tuo iPhone cambia sfondo da solo, con un'immagine
generata dall'AI **quella notte stessa**. E non è mai un'immagine a caso:
ogni canale è un **viaggio che evolve giorno dopo giorno** — la valle alpina di
ieri oggi è un po' più in alto sul sentiero, la città neon ha acceso nuove insegne.

**Gratis. Senza app. Senza account.** Solo una Shortcut.

👉 **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)**
— sfoglia i canali (swipe!), guarda la preview sulla lock screen e l'archivio del viaggio

## 🎨 I canali attivi

Un canale non è più un tema fisso: è un'**indole**, e ogni settimana pesca
dalla libreria una storia diversa (schema di evoluzione + soggetto) da quella
indole — cambia la sceneggiatura dei 7 giorni, non il carattere del canale.

| Canale | Indole (cosa può capitare) | URL |
|---|---|---|
| 🌿 **Natura** | cose che nascono e si costruiscono: una pianta che cresce, un'isola o un edificio che prende forma | `/w/natura` |
| 🌆 **Città** | luoghi abitati che evolvono nel tempo, e viaggi che li attraversano | `/w/citta` |
| 🕯️ **Quiete** | spazi intimi che si riempiono di vita, forme che si trasformano | `/w/quiete` |
| 🎲 **Random** | ogni giorno uno dei tre canali sopra, a sorpresa | `/w/random` |

Tutti gli URL iniziano con `https://artipop.riccardo-dominici.workers.dev`.
Ogni giorno cambia UN pezzo della scena (una pennellata, una foglia nuova) e il
resto resta identico: non è un'immagine diversa, è la stessa storia che avanza.
Isola, Studio e Bloom — i canali della versione precedente — vivono ora come
tre delle tante storie che Natura e Quiete possono pescare; i loro vecchi
indirizzi (`/w/island`, `/w/studio`, `/w/bloom`) restano attivi e il loro
archivio resta consultabile per sempre. Dettagli: [GUIDA.md §2.5](GUIDA.md#25-come-sono-fatti-i-canali).

## ⬇️ Scarica la Shortcut

Shortcut già pronte, con l'URL del canale dentro — scarica, apri, importa:

**[🌿 Natura](https://artipop.riccardo-dominici.workers.dev/s/natura.shortcut)** ·
**[🌆 Città](https://artipop.riccardo-dominici.workers.dev/s/citta.shortcut)** ·
**[🕯️ Quiete](https://artipop.riccardo-dominici.workers.dev/s/quiete.shortcut)** ·
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
  consultabile dal sito ("Il viaggio finora") o via `…/w/natura?date=YYYY-MM-DD`
  (anche per l'archivio storico dei vecchi canali, es. `…/w/island?date=…`).
- Se una generazione fallisce resta l'immagine di ieri: la Shortcut non si
  rompe mai.
- Tutto dentro i limiti gratuiti: ~600-900 neuroni/giorno su 10.000 (3 canali, di più nei giorni di cambio base), nessun costo
  possibile nemmeno per sbaglio.

## 🛠 Per sviluppatori e maintainer

- **[GUIDA.md](GUIDA.md)** — guida completa: uso, gestione, operazioni comuni,
  limiti free tier e cosa fare quando l'archivio cresce.
- **[backend/README.md](backend/README.md)** — architettura del Worker,
  costi in neuroni, deploy, endpoint admin.
- **[shortcut/README.md](shortcut/README.md)** — file `.shortcut` firmati per
  canale e pipeline per rigenerarli.
- **[tuning/README.md](tuning/README.md)** — lo strumento locale per osservare
  l'archivio, provare combinazioni e tarare i range di produzione.
