# PORTING.md — rendere il loop autonomo riusabile su un'altra repo

**AGGIORNAMENTO 2026-08-02: porting ESEGUITO — il motore vive in ~/Developer/autoloop, questo
file resta come mappa storica delle decisioni.**

Mappa scritta durante il setup (2026-07-31) su richiesta di Riccardo: NIENTE è stato
refactorato per la portabilità — questo file salva le informazioni chiave per farlo in
futuro senza riscoprire nulla. Fotografa lo stato al momento del setup: prima di usarla,
verificare che i punti citati esistano ancora.

**COSA si porterà (decisione di Riccardo, 2026-07-31): il modulo riusabile è la fase
POLISH** — il motore che cerca da solo miglioramenti guidato dai quattro principi
(utilizzabilità → bellezza-come-spec → robustezza → essenzialità), con deduplica a tre
controlli, verifica indipendente, deploy e stop-di-successo. La fase BUILD (ROADMAP a
milestone concordate) è considerata specifica del singolo progetto: in un port si può
NON portare, o ricreare da zero per il nuovo progetto. Implicazione pratica: nel motore,
la meccanica milestone (roadmap_mode/roadmap_first_open_milestone/slug `mX-`/marcatura
FATTA-BLOCCATA) è separabile — POLISH ne dipende solo per il bivio "c'è una milestone
APERTA?", che in un port POLISH-only si forza a POLISH fisso.

## Architettura a due strati (già rispettata dal codice)

**MOTORE — portabile così com'è, zero logica ArtiPop:**
- `run-loop.sh` — orchestrazione A→B→C→deploy, scelta modello meccanica, escalation Fable,
  registro, quota (sonda + margine stimato + tetto auto-calibrante), CONTROL, state.json.
  Unici riferimenti ad ArtiPop: i TITOLI delle notifiche ntfy ("ArtiPop loop: …"), ~29 stringhe.
- `scripts/loop-lib.sh` — funzioni pure (parsing ROADMAP/PLAN/VERDICT/IMPROVEMENTS, state,
  git helpers, ntfy). 1 solo riferimento ArtiPop (un commento).
- `Dockerfile` — generico per qualunque progetto CF Workers + Claude Code (nota: versione
  playwright PINNATA = quella del package.json di root; tenerle allineate).
- `monitor.py` / `monitor.command` — TUI generica TRANNE il blocco docker-run del tasto
  avvio (path assoluto repo, nome immagine `artipop-loop`, volumi `artipop-nm-*`).

**ADATTATORI — da riscrivere per ogni progetto:**
- `scripts/deploy.sh` — 4 funzioni (deploy_preview, save_production_version,
  deploy_production, rollback_production) + output contract `VERSION:`/`URL:`/`SMOKE:`.
  Dentro: nomi worker artipop/artipop-preview e URL.
- `smoke-test.sh` — endpoint e stringhe attese del progetto (contract: exit 0/1, --prod).
- `scripts/visual-check.mjs` — pagine/viewport del progetto (contract: --base-url,
  --baseline, --out; nomi file stabili da VISUAL_SPECS §6; exit 0/1 su overflow).
- Governance: `ROADMAP.md`, `VISUAL_SPECS.md`, `IMPROVEMENTS.md` (vocabolario aree),
  `CLAUDE.md` (comandi test/build del progetto, budget AI, perimetro cloud), `AUTOLOOP.md`
  (path e URL). I tre `ROLE-*.md` sono riusabili ~95%: citano solo i comandi di CLAUDE.md.

## Contratto che DEVE restare stabile in un port (il motore ci fa grep letterali)

- Sentinelle: `NESSUNA PROPOSTA` (riga 1 di PLAN.md) · `ESITO: OK` / `ESITO: FALLITO(EXEC): …`
  (ultime righe stdout stadio B, cercate con tolleranza ai code-fence) · `VERDETTO: PASS` /
  `VERDETTO: FAIL — …` e `BASELINE: aggiorna <file>` (VERDICT.md).
- Campi PLAN.md: OBIETTIVO (slug `mX-` per BUILD), TIPO, AREA, MILESTONE, MOTIVAZIONE
  (1ª riga = sintesi per le notifiche), FILE (una riga, o riga successiva), PASSI, TEST,
  CRITERI, BUDGET_AI.
- Registro: 9 colonne, tabella ULTIMA sezione del file (append in coda), righe `<!-- -->`
  ignorate dalle statistiche.
- ROADMAP: milestone `### Mx — titolo · APERTA|FATTA|BLOCCATA(...)` (grep del loop).
- state.json schema, branch `auto/production` + `auto/<ts>`, file CONTROL (PAUSE/STOP/KILL),
  `.runcount`, `logs/.quota_ceiling`.

## Refactor proposto quando si farà davvero (stimato: un ciclo di lavoro)

Obiettivo del refactor: estrarre il **motore POLISH** riusabile. Un unico `loop.config`
(bash sourcabile + letto da monitor.py) con: `PROJECT_NAME` (titoli ntfy) · `NTFY_TOPIC`
(oggi hardcoded `riccardo-claude` in loop-lib.sh:ntfy()) · `TEST_CMD` · `DOCKER_IMAGE` ·
`VOLUME_PREFIX` · path repo per il docker-run della TUI · default `MAX_RUNS`/
`QUOTA_MARGIN_PCT` · `MODE=POLISH|AUTO` (POLISH fisso per i port senza roadmap) · path
dei tre adattatori. Poi: sed dei titoli ntfy nel motore → `$PROJECT_NAME`, blocco
docker-run di monitor.py parametrizzato, AUTOLOOP rigenerato. La parte BUILD (parsing
ROADMAP, scelta milestone, marcatura FATTA/BLOCCATA) resta nel motore ma dietro il bivio
`MODE`: i port POLISH-only non la vedono; ROLE-PLANNER va sdoppiato o parametrizzato
(la sezione BUILD non ha senso senza ROADMAP). I quattro principi vanno in loop.config o
in un PRINCIPLES.md per-progetto: sono il cuore di POLISH e cambiano da repo a repo.

## Lezioni pagate (valgono per qualunque port — non ripagarle)

1. `wait` bash funziona solo su figli della STESSA shell: mai lanciare/attendere processi
   background dentro command substitution (dry-run 1).
2. GNU grep interpreta `\`` come àncora di buffer: mai backslash-backtick nei pattern ERE
   (BSD/Mac li tratta da letterali: i test locali mentono) (dry-run 3).
3. Le sentinelle dei modelli vanno CERCATE con tolleranza (code-fence, righe vuote), mai
   pretese come ultima riga letterale (dry-run 2).
4. I limiti di quota Claude arrivano su STDOUT, non stderr; il tetto mensile esiste oltre
   alla finestra 5h (dry-run 5).
5. Container: serve identità git esplicita (env GIT_*), `IS_SANDBOX=1` per
   --dangerously-skip-permissions da root, node_modules su volumi propri (binari host
   macOS ≠ Linux), `--dns` pubblici se il router è inaffidabile, credenziali Claude via
   `claude setup-token` → env (il Keychain macOS non è montabile).
6. macOS non ha `timeout`: ogni test host di funzioni che lo usano va fatto NEL container.
