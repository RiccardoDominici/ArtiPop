# Shortcut ArtiPop — file pronti (sperimentale)

In `dist/` ci sono i file `.shortcut` firmati, uno per canale, generati da
`build_shortcuts.sh` (richiede macOS). Aprendone uno su iPhone si apre
l'app Scorciatoie con la shortcut già pronta (2 azioni, URL del canale già inserito).

## ⚠️ Da sapere prima di distribuirli

1. **Testali su device prima di pubblicizzarli.** Il formato è verificato
   (identifier moderni, firma `--mode anyone` riuscita) ma l'import su iOS non
   è ancora stato provato su un telefono reale.
2. Chi importa deve avere attivo **Impostazioni → Scorciatoie → Consenti
   scorciatoie non attendibili** (il toggle appare dopo aver eseguito almeno
   una scorciatoia qualsiasi).
3. Dopo l'import bisogna aprire l'azione **Imposta sfondo** e **disattivare
   "Mostra anteprima"** (la chiave plist di quel toggle non è documentata,
   quindi non possiamo pre-impostarla): con l'anteprima attiva l'automazione
   al tramonto chiederebbe conferma ogni volta.

## 🏆 La distribuzione migliore resta il link iCloud

Per l'utente finale la via più liscia (nessun toggle, nessun file):
1. importa/crea la shortcut sul tuo iPhone, disattiva "Mostra anteprima",
2. condividila con **Copia link iCloud**,
3. pubblica i link (uno per canale) nel README e sulla landing page.

I link icloud.com/shortcuts sono considerati "attendibili" da iOS e
si importano con un tap.

## Rigenerare i file

```bash
./build_shortcuts.sh   # sostituisce l'URL nel template, converte in plist binario, firma
```
