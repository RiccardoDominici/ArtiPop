# 📖 Guida completa ad ArtiPop

Tutto quello che serve sapere, sia per **usare** ArtiPop sul tuo iPhone sia per
**gestirlo** da maintainer. Aggiornata a luglio 2026.

---

## Parte 1 — Per chi lo usa (2 minuti)

### Che cos'è

Ogni notte ArtiPop genera un nuovo wallpaper con l'AI per ogni canale attivo.
Ogni canale è un *viaggio*: la scena di oggi è l'evoluzione di quella di ieri
(la luce cambia, il progetto avanza) e ogni 7 giorni si cambia base: il ciclo
ricomincia da capo con un progetto nuovo.
Il tuo iPhone scarica l'immagine e la imposta come sfondo **da solo, ogni sera
al tramonto**. Gratis, senza app e senza account.

### Passo 1 — Scegli il canale

Vai su **[artipop.riccardo-dominici.workers.dev](https://artipop.riccardo-dominici.workers.dev)**,
sfoglia le card (swipe!) e copia il link del canale che preferisci:

| Canale | Cosa succede, giorno dopo giorno | URL |
|---|---|---|
| 🏝️ **Isola** | un'isola fluttuante prende vita, un pezzo al giorno | `…/w/island` |
| 📚 **Studio** | una scrivania vuota si riempie di vita, un oggetto al giorno | `…/w/studio` |
| 🌸 **Bloom** | una pianta cresce dal seme alla fioritura, un po' ogni giorno | `…/w/bloom` |
| 🎲 **Random** | ogni giorno un canale a sorpresa | `…/w/random` |

(i canali "viaggio" — Horizon, Neon, Cosmos, Depths, Aurora — restano nel
codice in pausa, riattivabili con una riga)

### Passo 2 — Prendi la Shortcut (una volta sola)

**Via consigliata:** scarica la Shortcut del canale dal sito (pulsante
"⬇️ Scarica la Shortcut") e importala. Ha già dentro l'URL giusto,
**l'anteprima disattivata** e l'aggancio all'**ultimo sfondo** della schermata di
blocco: è pronta per l'automazione e non devi toccare nulla. Se iOS blocca
l'import, attiva *Impostazioni → Scorciatoie → Consenti scorciatoie non
attendibili*.

⚠️ ArtiPop aggiorna sempre l'**ultimo** sfondo della galleria (Impostazioni →
Sfondo). Se in fondo hai uno sfondo a cui tieni, aggiungine uno nuovo qualsiasi:
finisce in coda e diventa quello gestito da ArtiPop. Puntiamo all'ultimo e non al
primo perché il primo posto è quasi sempre occupato e iOS non lascia riordinare
le schede. Se preferisci lasciare la scelta a iOS, c'è la variante base:
`…/s/<canale>-base.shortcut`.

**Se preferisci farla a mano** (3 azioni in croce, ma un dettaglio è critico):

1. Apri l'app **Comandi rapidi** → tab **Comandi** → **+** in alto a destra.
2. Aggiungi l'azione **Ottieni contenuto da URL** e incolla il link del canale,
   es. `https://artipop.riccardo-dominici.workers.dev/w/island`.
3. Aggiungi l'azione **Imposta sfondo** subito dopo:
   - scegli quale sfondo aggiornare (Lock screen, Home, o entrambi);
   - espandi le opzioni (la freccetta) e **disattiva "Mostra anteprima"** ⚠️ —
     è il passaggio più importante di tutta la guida: con l'anteprima attiva
     l'azione apre un foglio di conferma che in automazione **non può
     comparire**, quindi lo sfondo non cambia mai (vedi FAQ).
4. Dai un nome al comando (es. "ArtiPop") e salva.

Provalo subito con un tap: lo sfondo deve cambiare all'istante **e senza
chiederti niente**. Se ti chiede conferma, l'anteprima è ancora accesa.

### Passo 3 — Automatizza al tramonto

1. Tab **Automazioni** → **+** → **Ora del giorno**.
2. Scegli **Tramonto** (o l'orario che preferisci), ripetizione **Ogni giorno**.
3. Seleziona **Esegui immediatamente** (così non chiede conferma).
4. Scegli il comando "ArtiPop" appena creato → **Fine**.

Da stasera è tutto automatico. 🌇

### Domande frequenti

> Tutte queste risposte (e altre) sono anche online, sempre aggiornate, sulla
> pagina **[artipop…workers.dev/aiuto](https://artipop.riccardo-dominici.workers.dev/aiuto)**.

**Posso cambiare canale?** Sì: apri il comando e sostituisci l'URL.

**Posso avere uno sfondo nuovo subito?** Tocca il comando manualmente,
oppure aggiungi l'automazione anche all'**Alba** per il "turno" del mattino.

**A mano funziona ma in automazione no!** È *il* problema classico, e nel 99%
dei casi la causa è una sola: **"Mostra anteprima" acceso** nell'azione Imposta
sfondo. Con l'anteprima attiva l'azione deve mostrarti un foglio di conferma:
quando lanci il comando a mano tu tocchi "Imposta" (spesso senza farci caso) e
tutto sembra a posto, ma un'automazione a tempo gira in background — di solito
a telefono bloccato — dove nessuna schermata può comparire: l'azione si ferma lì
e non vedi **nessun** errore. Soluzione: apri il comando, espandi l'azione
Imposta sfondo, spegni "Mostra anteprima". Le Shortcut scaricate dal sito da
luglio 2026 hanno già l'anteprima spenta dentro il file.
Controlla anche che l'automazione sia su **Esegui immediatamente**.

**Lo sfondo a volte non cambia lo stesso (iOS 18+)?** Con l'anteprima già
spenta resta un bug intermittente di Apple sull'azione "Imposta sfondo" nelle
automazioni (`extensionKit error 2`), che dipende dal modello di iPhone.
Workaround collaudato: **duplica l'automazione** e sfalsala di un minuto
(tramonto e tramonto +1'): se la prima fallisce, la seconda passa.

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

### I canali a progressione (come funzionano)

Un arco = un **progetto** che si completa in esattamente 7 giorni (un'isola,
una pianta): il piano delle 7 tappe è deterministico e curato in
`channels.js` (`stageTemplates`, con `{s}` = nome breve del progetto).
Ogni giorno l'immagine è un **edit additivo**: klein riceve
`input_image_0` = ieri (contenuto da preservare + la tappa di oggi) e
`input_image_1` = keyframe dell'arco (àncora di qualità), con l'istruzione
"aggiungi SOLO questo cambiamento, tutto il resto resta identico".
Lezioni imparate (verificate empiricamente, non toccare senza motivo):
- le tappe iniziali NON devono nominare il risultato finale, o il modello lo
  disegna subito;
- il resizer esterno va chiamato con un nonce nell'URL sorgente, o le
  rigenerazioni ricevono miniature stantie dalla sua cache;
- se un singolo giorno esce male: `/regen-day?ch=X&date=YYYY-MM-DD&key=…`.

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
5. **Seed stabile per arco** (7 giorni): composizioni imparentate; nuovo arco
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

### File `.shortcut` firmati

In [`shortcut/`](shortcut/README.md): due template plist + `build_shortcuts.sh`
(firma con `shortcuts sign --mode anyone`; richiede macOS) + `verify_shortcuts.py`.

- `template-poster.shortcut.xml` → **variante principale** (4 azioni): aggancia
  sempre l'ultimo sfondo della lock screen (`WFSelectedPoster` = ultimo elemento
  di "Ottieni tutti gli sfondi"). Servita su `/s/<canale>.shortcut`.
- `template.shortcut.xml` → **variante base** (2 azioni): lascia a iOS la scelta
  dello sfondo. Servita su `/s/<canale>-base.shortcut`, è il piano B citato
  nella pagina `/aiuto`.

Entrambi impostano `WFWallpaperShowPreview=false` nell'azione Imposta sfondo:
è la riga che rende le Shortcut usabili in automazione (con l'anteprima accesa
funzionano solo a mano — vedi FAQ della Parte 1 e il README della cartella).

`build_shortcuts.sh` **verifica i file dopo averli firmati**: riapre l'archivio
AEA, ne estrae `Shortcut.wflow` e controlla che l'anteprima sia spenta e l'URL
sostituito. Se qualcosa non torna la build fallisce e i file non vanno caricati.
Dopo la build, carica i `.shortcut` in KV con i comandi che lo script stampa.
