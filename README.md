# 🌅 ArtiPop — Un wallpaper nuovo ogni giorno, che evolve

Ogni sera al tramonto il tuo iPhone cambia sfondo da solo, con un'immagine
generata dall'AI **quella notte stessa**. E non è mai un'immagine a caso:
ogni canale è un **viaggio che evolve giorno dopo giorno** — la valle alpina di
ieri oggi è un po' più in alto sul sentiero, la città neon ha acceso nuove insegne.

**Gratis. Senza app. Senza account.** Solo una Shortcut.

👉 **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)**
— sfoglia i canali (swipe!), guarda la preview sulla lock screen e l'archivio del viaggio

## 🎨 I canali attivi

| Canale | Il viaggio | URL |
|---|---|---|
| 🏔️ **Horizon** | i paesaggi della Terra, dall'alba delle Alpi ai deserti | `/w/horizon` |
| 🌃 **Neon** | una megalopoli futura che cresce notte dopo notte | `/w/neon` |
| 🎲 **Random** | ogni giorno un canale a sorpresa | `/w/random` |

Tutti gli URL iniziano con `https://artipop.riccardo-dominici.workers.dev`.
Altri quattro canali (🪐 Cosmos, 🌸 Bloom, 🌊 Depths, 🎨 Aurora) sono già pronti
nel codice, in pausa: si attivano con una riga.

## 📲 Attivalo in 2 minuti

1. **Copia il link** del tuo canale dal sito.
2. **Comandi rapidi** → nuovo comando con 2 azioni: *Ottieni contenuto da URL*
   (incolla il link) + *Imposta sfondo* (**disattiva "Mostra anteprima"**).
3. **Automazioni** → *Ora del giorno* → **Tramonto** → *Esegui immediatamente*.

Passo-passo dettagliato, FAQ e soluzioni ai problemi: **[GUIDA.md](GUIDA.md)**.

## 🧠 Come funziona

- Ogni notte un cron su **Cloudflare Workers** (piano free) fa avanzare la
  storia di ogni canale: un LLM riscrive la scena "un giorno dopo", con una
  guardia anti-deriva che garantisce coerenza strutturale nel tempo.
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
