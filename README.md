# 🌅 ArtiPop — Un wallpaper nuovo ogni giorno, che evolve

Ogni sera al tramonto il tuo iPhone cambia sfondo da solo, con un'immagine
generata dall'AI **quella notte stessa**. E non è mai un'immagine a caso:
ogni canale è un **viaggio che evolve giorno dopo giorno** — la valle alpina di
ieri oggi è un po' più in alto sul sentiero, la città neon ha acceso nuove insegne.

**Gratis. Senza app. Senza account.** Solo una Shortcut.

👉 **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)** — guarda i canali di oggi

## 🎨 I canali

Ogni canale è un mondo con la sua storia. Scegli quello che ti somiglia:

| Canale | Il viaggio | URL |
|---|---|---|
| 🏔️ **Horizon** | i paesaggi della Terra, dall'alba delle Alpi ai deserti | `/w/horizon` |
| 🌃 **Neon** | una megalopoli futura che cresce notte dopo notte | `/w/neon` |
| 🪐 **Cosmos** | una traversata interstellare, un giorno alla volta | `/w/cosmos` |
| 🌸 **Bloom** | un giardino segreto attraverso le stagioni | `/w/bloom` |
| 🌊 **Depths** | una discesa lenta negli abissi dell'oceano | `/w/depths` |
| 🎨 **Aurora** | forme e colori astratti in metamorfosi | `/w/aurora` |
| 🎲 **Random** | ogni giorno un canale diverso | `/w/random` |

Tutti gli URL iniziano con `https://artipop.riccardo-dominici.workers.dev`.

## 📲 Attivalo in 2 minuti

1. **Crea la Shortcut** (una volta sola). Apri **Comandi rapidi** sull'iPhone →
   **+** → aggiungi due azioni:
   - **Ottieni contenuto da URL** → incolla l'URL del tuo canale
     (es. `https://artipop.riccardo-dominici.workers.dev/w/horizon`)
   - **Imposta sfondo** → scegli quale sfondo aggiornare e **disattiva l'anteprima**
2. **Automatizzala.** Tab **Automazioni** → **+** → **Ora del giorno** →
   **Tramonto** → **Esegui immediatamente** (senza chiedere) → scegli la tua Shortcut.
3. **Fine.** Da stasera il tuo sfondo cambia da solo, ogni sera, per sempre.

> 💡 Preferisci la mattina? Imposta l'automazione su **Alba** o su un orario fisso.
> Vuoi uno sfondo nuovo subito? Tocca la Shortcut manualmente.

## ❓ FAQ

**Quanto costa?** Niente. Il backend gira sul piano gratuito di Cloudflare e
i modelli AI rientrano nel budget gratuito giornaliero. Nessun abbonamento, mai.

**Devo installare un'app?** No. Basta l'app Comandi rapidi già presente su iOS.

**Mi chiederà conferma ogni giorno?** No, se disattivi "Chiedi prima di eseguire"
nell'automazione.

**Che cosa significa "evolve"?** Ogni canale ha una storia persistente: ogni notte
l'AI riscrive la scena "un giorno dopo" (la luce cambia, il viaggio avanza) e ogni
12 giorni si apre un capitolo nuovo. Stesso mondo, sempre diverso.

**E se la generazione fallisce?** Resta lo sfondo del giorno prima: la Shortcut
non si rompe mai.

**Lo sfondo a volte non cambia (iOS 18)?** Su alcuni dispositivi iOS 18 l'azione
"Imposta sfondo" ha un bug intermittente nelle automazioni
(`extensionKit error 2`). Workaround collaudato: duplica l'automazione e sfalsala
di un minuto (es. tramonto e tramonto+1'): se la prima fallisce, la seconda passa.

## 🛠 Per sviluppatori

Tutto il backend (Cloudflare Worker, ~600 righe commentate) è in
[`backend/`](backend/README.md): architettura, costi, deploy e come
aggiungere un canale in 10 righe.
