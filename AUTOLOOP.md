# AUTOLOOP.md — guida operativa del loop autonomo (ArtiPop v3)

Per Riccardo, quando torna dopo giorni/settimane e deve ricordarsi come funziona tutto questo.
Questa guida è la versione ArtiPop-specifica (URL, path, budget, valori reali); la meccanica
generale del motore è documentata in `~/Developer/autoloop/docs/` (`DESIGN.md`, `AUTOLOOP.md`,
`LESSONS.md`) e la sua disciplina fissa in `~/Developer/autoloop/ENGINE-CONTRACT.md` — non
ripetute qui.

## Architettura in 10 righe
1. Il motore vive fuori da questo repo, in `~/Developer/autoloop`: montato in sola lettura su
   `/engine` dentro il container. Questo repo contiene solo `loop.config`, `adapters/`,
   `CLAUDE.md`, `Dockerfile.project` e la governance (`IMPROVEMENTS.md`, `VISUAL_SPECS.md`, ecc.).
2. `~/Developer/autoloop/start-loop.sh "<path repo>"` legge `loop.config` e assembla/avvia il
   container Docker: repo montato su `/work` (lettura-scrittura), motore su `/engine` (sola
   lettura).
3. Dentro il container, `run-loop.sh` del motore orchestra cicli continui: ogni ciclo crea un
   branch `auto/<timestamp UTC>` da `auto/production` e invoca tre stadi Claude Code.
4. Stadio A — Planner (`opus`, escalation `fable`): legge `IMPROVEMENTS.md` per intero, sceglie
   UN obiettivo, scrive `PLAN.md`.
5. Stadio B — Executor (`sonnet`): implementa il piano, scrive/esegue i test
   (`cd backend && npx vitest run`), committa sul branch di ciclo.
6. Stadio C — Verifier (`sonnet`, contesto fresco): riesegue i test, verifica i criteri del piano
   e il visual-check, scrive `VERDICT.md`.
7. `VERDETTO: PASS` → merge `--no-ff` su `auto/production`, poi deploy automatico via
   `adapters/deploy.sh` (preview → smoke → produzione → smoke, con rollback automatico se
   qualcosa fallisce).
8. Ogni esito (FATTO, DUPLICATO, SCARTATO, FALLITO(*), BLOCCATO, NESSUNA-PROPOSTA) diventa una
   riga in `IMPROVEMENTS.md`: il registro che il prossimo Planner legge per non ripetersi.
9. Il motore è **POLISH-only**: nessuna nozione di milestone/roadmap nel loop. `ROADMAP.md`
   resta nel repo come documento storico, non è più letto da nessuno stadio.
10. Il loop si ferma da solo a `MAX_RUNS` (20 di default, sovrascrivibile con `--max-runs`),
    oppure quando il Planner non trova più nulla da proporre (5 esiti consecutivi tra
    DUPLICATO/SCARTATO/NESSUNA-PROPOSTA).

## Mappa file
| File | Dove vive | Ruolo |
|---|---|---|
| `run-loop.sh`, `scripts/loop-lib.sh`, `monitor.py`, `start-loop.sh` | motore (`~/Developer/autoloop`) | orchestratore, funzioni pure, TUI, launcher host — non più in questo repo |
| `roles/ROLE-*.md`, `ENGINE-CONTRACT.md` | motore | istruzioni dei tre stadi + disciplina fissa (contesto, git, registro, divieti) |
| `docker/Dockerfile`, `docker/entrypoint.sh` | motore | immagine base `autoloop-base` + entrypoint (npm ci nei workspace, poi `run-loop.sh`) |
| `loop.config` | questo repo | identità, comandi, flag, secret — unica fonte di verità di configurazione |
| `CLAUDE.md` | questo repo | principi, comandi, perimetro cloud, budget, brainstorming (di progetto) |
| `Dockerfile.project` | questo repo | toolchain sopra `autoloop-base`: wrangler + Playwright/Chromium |
| `VISUAL_SPECS.md` | questo repo | criteri oggettivi per il giudizio visivo |
| `IMPROVEMENTS.md` | questo repo | registro di ogni ciclo eseguito (memoria del sistema) |
| `ROADMAP.md` | questo repo | documento storico, non più letto dal loop (motore POLISH-only) |
| `CHANGELOG.md` | questo repo | changelog leggibile delle modifiche al codice |
| `PLAN.md` / `VERDICT.md` | questo repo | output effimeri di un ciclo (gitignorati, vivono sul branch di ciclo) |
| `adapters/deploy.sh` | questo repo | deploy meccanico preview→produzione con rollback |
| `adapters/smoke-test.sh` | questo repo | verifica post-deploy (sole letture) |
| `adapters/visual-check.mjs` | questo repo | screenshot Playwright + confronto con `tests/visual/baseline/` |
| `monitor.command` | questo repo | wrapper: lancia `monitor.py` del motore su questo progetto |
| `logs/` | questo repo | `state.json`, `stage-context.txt`, log grezzi per run e stadio (gitignorato) |
| `artifacts/` | questo repo | screenshot prodotti dal visual-check (gitignorato) |
| `CONTROL` | questo repo | file di comando per `monitor.py` → loop (gitignorato) |
| `.runcount` | questo repo | contatore run persistente (gitignorato) |

## Avvio
Dall'host (`start-loop.sh` si occupa di tutto: build immagine se manca, mount, DNS, `caffeinate`):
```bash
"$HOME/Developer/autoloop/start-loop.sh" "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3"
```
Flag utili:
- `--max-runs N` — sovrascrive `MAX_RUNS_DEFAULT` (20) per questo avvio, es. `--max-runs 1` per
  un run supervisionato.
- `--build` — forza la ricostruzione dell'immagine `artipop-loop` (da `Dockerfile.project`)
  anche se esiste già: usalo dopo aver cambiato `Dockerfile.project` o la versione di Playwright.
- `--dry-run` — stampa il comando `docker run` risolto (immagine, mount, env) e esce senza
  avviare nulla: utile per controllare che `loop.config` sia interpretato come previsto.

Cosa fa `start-loop.sh` per ArtiPop, letto da `loop.config`: immagine `artipop-loop` (build da
`Dockerfile.project` se assente), monta questo repo su `/work` e `~/Developer/autoloop` su
`/engine:ro`, porta dentro `~/.claude`/`~/.claude.json` (autenticazione già fatta sull'host),
crea/riusa i volumi `artipop-nm-root` e `artipop-nm-backend` per i `node_modules` (i binari
macOS/arm64 dell'host non girano in Linux — l'entrypoint del motore li popola con `npm ci` al
primo avvio), monta `~/Library/Preferences/.wrangler` su `/root/.config/.wrangler` (OAuth
wrangler dell'host), applica `--env-file "$HOME/.artipop-loop.env"`, i DNS pubblici
`1.1.1.1`/`8.8.8.8`, e prefissa `caffeinate -s` se disponibile (macOS) per impedire la
sospensione durante run lunghi.

## Quota (finestra 5h)
Se i token finiscono, il loop NON registra fallimenti: una sonda economica rileva il limite
prima di aprire ogni ciclo e le attese si allineano alla fine del blocco 5h (letta dai log
locali via `ccusage`), poi riparte da solo. Durante l'attesa lo STOP dal `CONTROL` resta ascoltato.

In più c'è un margine PREVENTIVO stimato: prima di ogni ciclo e di ogni stadio il loop confronta
i token grezzi del blocco 5h corrente col massimo storico dei tuoi blocchi (`ccusage blocks`);
sopra `QUOTA_MARGIN_PCT_DEFAULT` (90 in `loop.config`, cioè ~10% di riserva) attende il refresh
invece di partire. È una STIMA su metrica omogenea, non il numero vero (che Anthropic non
espone): conservativa se il mix di cache differisce.

La stima si AUTO-CALIBRA: ogni volta che un limite reale viene toccato (sonda o rate-limit di
stadio), il loop fotografa i token grezzi del blocco corrente in `logs/.quota_ceiling` e da lì
in poi il margine si calcola su quel tetto osservato, non sul massimo storico. Per azzerare la
calibrazione: cancella `logs/.quota_ceiling`.

## Arresto
Pulito (aspetta la fine dello stadio corrente e chiude in ordine): dall'host, con il repo
montato, scrivi `STOP` nel file `CONTROL` in root — o premi `s` dentro `monitor.py`.
```bash
echo "STOP" > "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3/CONTROL"
```
Brusco (solo se il loop non risponde): `docker stop artipop-loop`. Può lasciare un branch di
ciclo a metà: v. Troubleshooting sotto.

## Lettura della TUI (`monitor.py`, fuori dal container)
Via facile: doppio click su `monitor.command` dal Finder (chiede `chmod +x` solo se perso il
bit eseguibile), o da terminale:
```bash
cd "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3"
./monitor.command
```
Equivalente a mano:
```bash
python3 "$HOME/Developer/autoloop/monitor.py" "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3"
```
Legge `logs/state.json` + `IMPROVEMENTS.md` di questo repo ogni 2s, non scrive mai nel repo
(tranne `CONTROL`). Mostra: stato generale (esecuzione/attesa quota/pausa/fermo), stadio attivo
con modello (`PLAN·opus` → `EXEC·sonnet` → `VERIFY·sonnet`, badge se è intervenuto `fable`),
riquadro deploy (versione live, url, esito smoke, ora), run N/MAX, uptime, countdown al
prossimo retry, contatori esiti, ultime righe di registro colorate, tail del log dello stadio
corrente.

Tasti (scrivono solo nel file `CONTROL`, mai nel repo o su Cloudflare):
- `a` = AVVIO (invoca `start-loop.sh` del motore su questo progetto)
- `p` = PAUSE (il loop attende, poll ogni 30s, finché il file non cambia)
- `s` = STOP (il loop esce pulito a fine ciclo)
- `k` = KILL (il loop fa revert del ciclo corrente e si ferma)
- `l` = log completo dello stadio in corso
- `q` = esci dalla TUI (chiede conferma — non tocca il loop)

## Dove sono i log
Tutto sotto `logs/` (gitignorato): `logs/state.json` (stato macchina, riscritto ad ogni
transizione), `logs/stage-context.txt` (contesto passato allo stadio corrente),
`logs/run<N>-<stadio>.jsonl` e `.err` (output grezzo di ogni invocazione Claude Code, uno per
run e stadio).

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

Versione e url dell'ultimo deploy sono in `logs/state.json` → `last_deploy` (e nella colonna
`deploy` di `IMPROVEMENTS.md`).

Rollback manuale (produzione o preview): dalla cartella `backend/`,
```bash
npx wrangler deployments list          # trova il version-id a cui tornare
npx wrangler rollback <version-id>     # legge la sintassi ESATTA (flag non interattivi inclusi)
                                        # da adapters/deploy.sh: quella è la versione
                                        # verificata nel dry-run.
```
Per il preview, ripeti con `--env preview`.

## Promemoria — a fine test
**Revoca il token Cloudflare** (`CLOUDFLARE_API_TOKEN` in `~/.artipop-loop.env`) dalla dashboard
Cloudflare → My Profile → API Tokens, non appena hai finito di far girare il loop. Il file
`~/.artipop-loop.env` resta comunque fuori dal repo e a `chmod 600`.

## Troubleshooting — stato anomalo

**`state.json` dice uno stadio attivo ma nessun processo gira**: il container è morto a metà
(es. `docker stop` brusco, o crash). Controlla `docker ps`: se `artipop-loop` non c'è più, lo
stato è stantio. Il branch di ciclo su cui era rimasto è quasi certamente incompleto (v. punto
sotto). Puoi far ripartire il loop con `start-loop.sh`: riparte da `auto/production` creando un
nuovo branch di ciclo; quello vecchio va ripulito a mano prima o dopo.

**Branch di ciclo orfano** (`auto/<ts>` esistente, nessun ciclo attivo lo sta usando): controlla
prima cosa contiene, poi eliminalo se non serve.
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
`start-loop.sh` prefissa automaticamente `caffeinate -s` (se disponibile su macOS): impedisce
al Mac di sospendersi durante run lunghi. Senza, macOS può mettere in pausa il container a
schermo chiuso e il loop si blocca silenziosamente.
