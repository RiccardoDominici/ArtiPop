# CLAUDE.md — ArtiPop v3 (contesto di sistema, caricato ad ogni stadio)

Vale per Planner, Executor e Verifier del sistema autonomo. Nessuna eccezione.

## Principi (in ordine — in caso di conflitto vince quello sopra)
1. **Utilizzabilità** — il sito e le rotte devono funzionare per l'utente reale (Shortcut inclusa).
2. **Bellezza** = conformità a `VISUAL_SPECS.md`. Mai giudizio di gusto: solo aderenza alla spec.
3. **Robustezza** — errori gestiti, mai un crash grezzo esposto all'utente.
4. **Essenzialità** — la soluzione più semplice che risolve il problema; niente aggiunto "perché utile".

## Disciplina del contesto
- Localizzare con Grep/Glob, mai esplorare a tappeto.
- Lettura integrale solo dei file che si intende MODIFICARE.
- MAI leggere l'albero completo del repo o un file oltre 1500 righe senza un filtro (Grep/offset).
- `IMPROVEMENTS.md` è l'unico file che si legge sempre per intero: è la memoria del sistema.

## Strategia git
- `main`: intoccabile da questi ruoli. Solo Riccardo vi fonde manualmente, da fuori del loop.
- `auto/production`: base di ogni ciclo e memoria operativa (contiene `IMPROVEMENTS.md` aggiornato).
- Ogni ciclo lavora su un branch `auto/<timestamp UTC>`, creato da `auto/production`.
- **Mai push** su remote, da nessun ruolo, in nessuna circostanza.

## Registro `IMPROVEMENTS.md`
Tabella con colonne: `| data | tipo | area | obiettivo | file | planner | esito | branch | deploy |`
- `data` = `YYYY-MM-DD HH:MM UTC`
- `tipo` ∈ {BUILD, POLISH}
- `planner` ∈ {opus, fable}
- `esito` ∈ {FATTO, DUPLICATO, SCARTATO, FALLITO(EXEC), FALLITO(VERIFY), FALLITO(DEPLOY), BLOCCATO}
- `deploy` = version-id oppure `—`
Solo append, eccetto la compattazione dello storico oltre le 150 righe (ad opera del planner).
Nota: il loop (non i ruoli) può registrare anche l'esito `NESSUNA-PROPOSTA` per i cicli
in cui il planner non ha proposto nulla.

## Divieti (vincolanti per planner, executor, verifier — senza eccezioni)
Non modificare: `run-loop.sh`, `monitor.py`, `CLAUDE.md`, `ROLE-*.md`, `smoke-test.sh`, `scripts/deploy.sh`, `scripts/loop-lib.sh`, `scripts/visual-check.mjs`, `Dockerfile`.
Non toccare `main`. Mai push su remote. Mai nuove dipendenze runtime nel worker; devDependencies solo se previste nel piano.
`IMPROVEMENTS.md` solo append (salvo compattazione planner). Cloudflare: solo worker `artipop`/`artipop-preview`
e i loro KV; MAI DNS/zone/altri progetti. Mai stampare/loggare/committare token o secret (env inclusi).
Mai skip/xfail, mai abbassare soglie, mai cancellare test esistenti. Max 10 generazioni AI/ciclo, solo preview.
Executor: budget 3 tentativi di fix contati ad alta voce; revert immediato senza consumare tentativi se il fix
esce dai FILE dichiarati nel piano, richiede dipendenze nuove, o lo stesso test fallisce 2 volte identico.

## Budget AI
Massimo 10 generazioni AI per ciclo. Solo contro l'ambiente **preview** (mai la produzione).
Mai scritture sul KV di produzione da parte del loop.

## Segreti
Mai stampare, loggare o committare variabili d'ambiente, token o chiavi — incluso `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_ADMIN_KEY`, `ADMIN_KEY`.

## Comandi del progetto
- Test: `cd backend && npx vitest run`
- Visual check: `node scripts/visual-check.mjs`
- Smoke test: `./smoke-test.sh <url>`
- Nessun linter: scelta deliberata, non aggiungerne.
