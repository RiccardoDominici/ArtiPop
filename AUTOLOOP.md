# AUTOLOOP.md — guida operativa del loop autonomo

Per Riccardo, quando torna dopo giorni/settimane e deve ricordarsi come funziona tutto questo.

## Architettura in 10 righe
1. `run-loop.sh` orchestra cicli continui dentro un container Docker che monta questo repo.
2. Ogni ciclo crea un branch `auto/<timestamp UTC>` da `auto/production` e invoca tre stadi Claude Code.
3. Stadio A — Planner (`opus`, escalation `fable`): legge `ROADMAP.md` e `IMPROVEMENTS.md`, sceglie UN obiettivo, scrive `PLAN.md`.
4. Stadio B — Executor (`sonnet`): implementa il piano, scrive/esegue i test, committa sul branch di ciclo.
5. Stadio C — Verifier (`sonnet`, contesto fresco): riesegue i test, verifica i criteri del piano e il visual-check, scrive `VERDICT.md`.
6. `VERDETTO: PASS` → merge `--no-ff` su `auto/production`, poi deploy automatico (preview → smoke → produzione → smoke, con rollback automatico se qualcosa fallisce).
7. Ogni esito (FATTO, DUPLICATO, SCARTATO, FALLITO(*), BLOCCATO) diventa una riga in `IMPROVEMENTS.md`: il registro che il prossimo Planner legge per non ripetersi.
8. `monitor.py`, eseguito FUORI dal container sullo stesso Mac, mostra lo stato in tempo reale leggendo `logs/state.json`, `IMPROVEMENTS.md`, `ROADMAP.md`.
9. Il file `CONTROL` (in root, montato) permette pausa/stop/kill dall'esterno senza toccare il container.
10. Il loop si ferma da solo a `MAX_RUNS`, oppure quando tutte le milestone sono FATTE/BLOCCATE e il POLISH non trova più nulla da proporre (5 esiti consecutivi tra DUPLICATO/SCARTATO/NESSUNA-PROPOSTA).

## Mappa file
| File | Ruolo |
|---|---|
| `run-loop.sh` | orchestratore del ciclo (non modificabile dai ruoli AI) |
| `monitor.py` | TUI di sola lettura, va lanciata sull'host, non nel container |
| `CLAUDE.md` | contesto caricato ad ogni stadio: principi, divieti, comandi |
| `ROLE-PLANNER.md` / `ROLE-EXECUTOR.md` / `ROLE-VERIFIER.md` | istruzioni dei tre stadi |
| `ROADMAP.md` | milestone e loro stato (APERTA/FATTA/BLOCCATA) |
| `VISUAL_SPECS.md` | criteri oggettivi per il giudizio visivo |
| `IMPROVEMENTS.md` | registro di ogni ciclo eseguito (memoria del sistema) |
| `CHANGELOG.md` | changelog leggibile delle modifiche al codice |
| `PLAN.md` / `VERDICT.md` | output effimeri di un ciclo (gitignorati, vivono sul branch di ciclo) |
| `smoke-test.sh` | verifica post-deploy (sole letture) |
| `scripts/deploy.sh` | deploy meccanico preview→prod con rollback |
| `scripts/visual-check.mjs` | screenshot Playwright + confronto con `tests/visual/baseline/` |
| `Dockerfile` | immagine generica del loop (repo montato, non copiato) |
| `logs/` | `state.json`, `stage-context.txt`, log grezzi per run e stadio (gitignorato) |
| `artifacts/` | screenshot prodotti dal visual-check (gitignorato) |
| `CONTROL` | file di comando per monitor.py → loop (gitignorato) |
| `.runcount` | contatore run persistente (gitignorato) |

## Avvio
Build dell'immagine (una tantum, o dopo modifiche al `Dockerfile`):
```bash
cd "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3"
docker build -t artipop-loop .
```

Avvio del loop. `caffeinate -s` davanti al comando impedisce al Mac di andare in sospensione durante
run lunghi (in alternativa, apri un terminale separato con `caffeinate -s` prima di avviare):
```bash
caffeinate -s docker run -it --rm \
  --name artipop-loop \
  -v "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3:/work" \
  -v artipop-nm-root:/work/node_modules \
  -v artipop-nm-backend:/work/backend/node_modules \
  -v "$HOME/.claude:/root/.claude" \
  -v "$HOME/.claude.json:/root/.claude.json" \
  -v "$HOME/Library/Preferences/.wrangler:/root/.config/.wrangler" \
  --env-file "$HOME/.artipop-loop.env" \
  --dns 1.1.1.1 --dns 8.8.8.8 \
  -e IS_SANDBOX=1 \
  -e MAX_RUNS=20 \
  artipop-loop
```
Note:
- `-v "$HOME/.claude:/root/.claude"` e `-v "$HOME/.claude.json:/root/.claude.json"` portano dentro
  il container l'autenticazione già fatta sull'host: niente login interattivo nel container.
- I due volumi `artipop-nm-*` COPRONO i node_modules del mount: quelli dell'host sono binari
  macOS/arm64 e in Linux non girano. Al primo avvio l'entrypoint li popola con `npm ci`
  (persistono tra i riavvii; per forzare la reinstallazione: `docker volume rm artipop-nm-root
  artipop-nm-backend` a container fermo).
- `--dns 1.1.1.1 --dns 8.8.8.8`: il DNS del router di casa si è dimostrato inaffidabile con
  *.workers.dev; il container parla direttamente coi resolver pubblici e non eredita il problema.
- `-v ".../.wrangler:/root/.config/.wrangler"` porta nel container l'OAuth wrangler del Mac
  (scelta esplicita di Riccardo al setup, al posto del token scoped: meno passi ma permessi ampi —
  la protezione del perimetro è affidata ai divieti di CLAUDE.md). `/root/.config/.wrangler` è il
  path che wrangler risolve via XDG su Linux. Per passare al token scoped in futuro: aggiungi
  `CLOUDFLARE_API_TOKEN=...` a `~/.artipop-loop.env` e togli questo mount (l'env ha la precedenza).
- `--env-file "$HOME/.artipop-loop.env"` (chmod 600, fuori dal repo) porta `PREVIEW_ADMIN_KEY`
  (ed eventualmente `CLOUDFLARE_API_TOKEN`). Non committare mai questo file, non esiste nel repo.
- `MAX_RUNS` limita il numero di cicli: per un dry-run supervisionato usa `-e MAX_RUNS=1`.
- Il repo montato con `-v` è l'unica copia che conta: i branch `auto/*` creati dal loop sono commit
  locali su questo stesso repo, non su una copia isolata.

## Quota (finestra 5h)
Se i token finiscono, il loop NON registra fallimenti: una sonda economica rileva il limite
prima di aprire ogni ciclo e le attese si allineano alla fine del blocco 5h (letta dai log
locali via `ccusage`), poi riparte da solo. Durante l'attesa lo STOP dal CONTROL resta ascoltato.

In più c'è un margine PREVENTIVO stimato: prima di ogni ciclo e di ogni stadio il loop
confronta i token grezzi del blocco 5h corrente col massimo storico dei tuoi blocchi
(`ccusage blocks`); sopra `QUOTA_MARGIN_PCT` (default 90, cioè ~10% di riserva) attende il
refresh invece di partire. È una STIMA su metrica omogenea, non il numero vero (che Anthropic
non espone): conservativa se il mix di cache differisce. Per cambiarla: `-e QUOTA_MARGIN_PCT=85`
nel docker run; `0` la disabilita (resta il solo ping reattivo).

## Arresto
Pulito (aspetta la fine dello stadio corrente e chiude in ordine): dall'host, con il repo montato,
scrivi `STOP` nel file `CONTROL` in root — o premi `s` dentro `monitor.py`.
```bash
echo "STOP" > "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3/CONTROL"
```
Brusco (solo se il loop non risponde): `docker stop artipop-loop`. Può lasciare un branch di ciclo
a metà: v. Troubleshooting sotto.

## Lettura della TUI (`monitor.py`, fuori dal container)
Via facile: doppio click su `monitor.command` dal Finder (o `./monitor.command`).
Equivalente a mano:
```bash
cd "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3"
python3 monitor.py
```
Legge `logs/state.json` + `IMPROVEMENTS.md` + `ROADMAP.md` ogni 2s, non scrive mai nel repo (tranne
`CONTROL`). Mostra: stato generale (esecuzione/attesa quota/pausa/fermo), stadio attivo con modello
(`PLAN·opus` → `EXEC·sonnet` → `VERIFY·sonnet`, badge se è intervenuto `fable`), riquadro deploy
(versione live, url, esito smoke, ora), avanzamento roadmap x/y e modalità, run N/MAX, uptime,
countdown al prossimo retry, contatori esiti, ultime 10 righe di registro colorate, tail del log
dello stadio corrente.

Tasti (scrivono solo nel file `CONTROL`, mai nel repo o su Cloudflare):
- `p` = PAUSE (il loop attende, poll ogni 30s, finché il file non cambia)
- `s` = STOP (il loop esce pulito a fine ciclo)
- `k` = KILL (il loop fa revert del ciclo corrente e si ferma)
- `l` = log completo dello stadio in corso
- `q` = esci dalla TUI (chiede conferma — non tocca il loop)

## Dove sono i log
Tutto sotto `logs/` (gitignorato): `logs/state.json` (stato macchina, riscritto ad ogni transizione),
`logs/stage-context.txt` (contesto passato allo stadio corrente), `logs/run<N>-<stadio>.jsonl` e
`.err` (output grezzo di ogni invocazione Claude Code, uno per run e stadio).

## Review al ritorno
```bash
cd "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3"
git log main..auto/production --oneline    # cosa è stato fatto, ciclo per ciclo
git diff main auto/production               # diff completo da rivedere
```
Nulla è mai stato pushato: tutto è locale finché non decidi tu. Due strade:
- **Merge in blocco**, se ti fidi dell'insieme: `git checkout main && git merge --no-ff auto/production`.
- **Cherry-pick selettivo**, se vuoi scegliere: `git checkout main && git cherry-pick <sha1> <sha2> ...`
  (usa gli sha da `git log auto/production --oneline` sopra).

Solo dopo aver fatto tu la review — il loop non pusha mai da solo.

## Stato deploy
- Produzione: `https://artipop.riccardo-dominici.workers.dev`
- Preview: `https://artipop-preview.riccardo-dominici.workers.dev`
- Account Cloudflare: `d6886aa91f37af4da724e3b0693f04fe`

Versione e url dell'ultimo deploy sono in `logs/state.json` → `last_deploy` (e nella colonna `deploy`
di `IMPROVEMENTS.md`).

Rollback manuale (produzione o preview): dalla cartella `backend/`,
```bash
npx wrangler deployments list          # trova il version-id a cui tornare
npx wrangler rollback <version-id>     # legge la sintassi ESATTA (flag non interattivi inclusi)
                                        # da scripts/deploy.sh quando esiste: quella è la versione
                                        # verificata nel dry-run. Se scripts/deploy.sh non esiste
                                        # ancora, verifica prima con `npx wrangler rollback --help`.
```
Per il preview, ripeti con `--env preview`.

## Promemoria — a fine test
**Revoca il token Cloudflare** (`CLOUDFLARE_API_TOKEN` in `~/.artipop-loop.env`) dalla dashboard
Cloudflare → My Profile → API Tokens, non appena hai finito di far girare il loop. Il file
`~/.artipop-loop.env` resta comunque fuori dal repo e a `chmod 600`.

## Troubleshooting — stato anomalo

**`state.json` dice uno stadio attivo ma nessun processo gira**: il container è morto a metà
(es. `docker stop` brusco, o crash). Controlla `docker ps`: se `artipop-loop` non c'è più, lo stato è
stantio. Il branch di ciclo su cui era rimasto è quasi certamente incompleto (v. punto sotto). Puoi
far ripartire il container: `run-loop.sh` riparte da `auto/production` creando un nuovo branch di
ciclo; quello vecchio va ripulito a mano prima o dopo.

**Branch di ciclo orfano** (`auto/<ts>` esistente, nessun ciclo attivo lo sta usando): controlla prima
cosa contiene, poi eliminalo se non serve.
```bash
git log auto/production..auto/<ts> --oneline   # cosa c'è di diverso
git diff auto/production auto/<ts>              # diff, se vuoi salvare qualcosa
git checkout auto/production
git branch -D auto/<ts>                         # elimina, solo dopo aver controllato
```

**Merge a metà** (conflitto durante un merge automatico interrotto):
```bash
git status                # capisci se sei in mezzo a un merge
git merge --abort         # annulla e torna allo stato precedente su auto/production
```
Poi valuta se far ripartire il loop dal branch successivo o intervenire a mano sul codice.

## Nota
`caffeinate -s docker run ...` (o `caffeinate -s` in un terminale separato prima dell'avvio) impedisce
al Mac di sospendersi durante run lunghi: senza, macOS può mettere in pausa il container a schermo
chiuso e il loop si blocca silenziosamente.
