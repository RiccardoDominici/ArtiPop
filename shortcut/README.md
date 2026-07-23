# Shortcut ArtiPop — file pronti

In `dist/` ci sono i file `.shortcut` firmati, generati da `build_shortcuts.sh`
(richiede macOS): **due varianti per canale**, con URL già inserito e
**l'anteprima dell'azione "Imposta sfondo" già disattivata**.

| File | Template | Cosa fa |
|---|---|---|
| `ArtiPop-<ch>.shortcut` | `template-poster.shortcut.xml` | 4 azioni: aggiorna **sempre l'ultimo sfondo** della schermata di blocco (`WFSelectedPoster`) |
| `ArtiPop-<ch>-base.shortcut` | `template.shortcut.xml` | 2 azioni: lascia a iOS la scelta dello sfondo — piano B |

La prima è quella servita dal sito su `/s/<canale>.shortcut`; la seconda su
`/s/<canale>-base.shortcut` ed è linkata dalla pagina `/aiuto`.

### Come si aggancia "sempre l'ultimo sfondo"

```
Ottieni contenuto da URL  ──────────────────────────┐
Ottieni tutti gli sfondi   (WFPosterType = All)     │
Ottieni elemento dall'elenco (WFItemSpecifier =     │
                              "Last Item")   ──┐    │
Imposta sfondo  (WFSelectedPoster = ┘, WFInput = ┘, anteprima OFF)
```

L'azione `is.workflow.actions.posters.get` è documentata da Apple come «Gets all
of your Lock Screen wallpapers, and returns them as output **so you can use them
with other actions**», e `wallpaper.set` ha una variante di summary dedicata —
«Set `${WFSelectedPoster}` to `${WFInput}` for `${WFWallpaperLocation}`» — che
applica l'immagine a uno sfondo **esistente** invece di crearne uno nuovo.
`WFItemSpecifier` accetta `First Item`, `Last Item`, `Random Item`,
`Item At Index`, `Items in Range`.

**Perché l'ultimo e non il primo:** il primo posto della galleria è quasi sempre
già occupato da uno sfondo dell'utente e iOS non permette di riordinare le
schede — puntare al primo significherebbe sovrascrivere qualcosa di suo.
L'ultimo posto invece l'utente se lo può creare a comando, aggiungendo un nuovo
sfondo qualsiasi.

## ⚠️ Il dettaglio che rendeva le Shortcut inutilizzabili in automazione

L'azione `is.workflow.actions.wallpaper.set` ha un parametro booleano
**`WFWallpaperShowPreview`**, che nella UI è l'interruttore "Mostra anteprima" e
di default vale **true**. Con l'anteprima attiva l'azione presenta un foglio di
conferma: lanciata a mano l'utente tocca "Imposta" e sembra funzionare tutto,
ma un'automazione "Ora del giorno" gira headless (di norma a telefono bloccato),
dove nessuna UI può essere presentata — l'azione si ferma lì, **senza errore**.
Sintomo: *"a mano funziona, in automazione no"*.

Il template ora scrive esplicitamente:

```xml
<key>WFWallpaperShowPreview</key><false/>
```

È un boolean plist nudo (niente `WFSerializationType`). Chiave verificata su
tre fonti indipendenti: le stringhe di ActionKit nella dyld shared cache di
macOS 26.1 (`is.workflow.actions.wallpaper.set` → `WFSetWallpaperAction` →
`WFWallpaperShowPreview` → "Show Preview"), il decompilato di
`WFSetWallpaperAction.m` (`parameterValueForKey:@"WFWallpaperShowPreview"`) e i
corpus pubblici di shortcut.

Gli altri parametri dell'azione — `WFWallpaperLocation` (array di
`"Lock Screen"` / `"Home Screen"`), `WFWallpaperSmartCrop`,
`WFWallpaperLegibilityBlur`, `WFWallpaperPerspectiveZoom` — sono lasciati
**assenti** di proposito: l'azione usa i suoi default e non rischiamo errori di
tipo su valori che non possiamo provare su macOS. L'unico parametro opzionale
che valorizziamo è `WFSelectedPoster`, e solo nel template principale.

## Rigenerare i file

```bash
./build_shortcuts.sh   # sostituisce l'URL, converte in plist binario, firma, VERIFICA
```

La build fallisce se la verifica non passa, così una regressione nel template
non arriva mai sull'iPhone di un utente. Poi carica i file sul Worker con i
comandi `wrangler kv key put` che lo script stampa alla fine.

## Verificare un file `.shortcut` firmato (anche non nostro)

```bash
python3 verify_shortcuts.py                 # tutti i file in dist/
python3 verify_shortcuts.py qualcosa.shortcut
```

Un file firmato non è una scatola nera: è un archivio **AEA profilo 0** (firmato
ma *non* cifrato). `verify_shortcuts.py` lo apre così:

1. legge l'header AEA, che contiene un bplist con la catena di certificati;
2. estrae la chiave pubblica dal certificato foglia (`openssl x509 -pubkey`);
3. `aea decrypt -sign-pub <chiave>` → Apple Archive;
4. `aa extract` → `Shortcut.wflow`, che è un plist leggibile con `plutil -p`.

Serve anche per ispezionare la shortcut di un utente ("ma l'anteprima è davvero
spenta?") senza doverla aprire sul telefono.

## Note per chi importa

Chi importa deve avere attivo **Impostazioni → Scorciatoie → Consenti
scorciatoie non attendibili** (il toggle appare dopo aver eseguito almeno una
scorciatoia qualsiasi). In alternativa si può pubblicare un link
icloud.com/shortcuts, che iOS considera attendibile e si importa con un tap.
