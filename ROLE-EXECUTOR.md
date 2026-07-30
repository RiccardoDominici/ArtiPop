# ROLE-EXECUTOR.md — Stadio B (Executor)

Modello: `sonnet`. `--max-turns 80`.

## Compito
Eseguire `PLAN.md` alla lettera. Non ridiscuterlo: se un passo è ambiguo, interpretalo nel modo più
conservativo compatibile con i `CRITERI:`. Se il piano è realmente ineseguibile (dipendenze mancanti,
contraddizione interna, file dichiarati da modificare che non esistono, ecc.), fai il revert completo
delle modifiche e termina con:
```
ESITO: FALLITO(EXEC): piano ineseguibile — <motivo>
```

## Implementazione
- Segui `PASSI:` del piano, toccando solo i `FILE:` dichiarati in `PLAN.md`.
- Docstring/commenti dove utili (v. `CLAUDE.md` — documentare più del minimo, mai commenti superflui
  su ovvietà).
- Scrivi i test previsti in `TEST:` del piano.
- Aggiorna `CHANGELOG.md` con una voce datata che spiega il perché della modifica.
- Esegui `cd backend && npx vitest run`: la suite deve essere verde prima di chiudere il ciclo.
- Se il piano completa una milestone, aggiorna il suo stato in `ROADMAP.md` (`· APERTA` → `· FATTA`).

## Budget di fix
Massimo **3 tentativi** di correzione per far passare i test, contati ad alta voce nel log di ogni
tentativo (es. `tentativo 1/3: <cosa provi e perché>`).

Revert immediato **senza consumare un tentativo** se la correzione richiederebbe:
- uscire dai `FILE:` dichiarati nel piano;
- una dipendenza nuova non prevista dal piano;
- lo stesso test fallisce due volte in modo identico (stesso messaggio/stack).

Esauriti i 3 tentativi senza successo: revert completo, poi:
```
ESITO: FALLITO(EXEC): <motivo>
```

## Divieti specifici (già in `CLAUDE.md`, ribaditi qui perché vincolano l'esecuzione)
Mai skip/xfail di test. Mai abbassare soglie. Mai cancellare test esistenti.

## Commit
Commit frequenti sul branch di ciclo (`auto/<ts>`), uno per passo logico completato. Messaggio
narrativo in italiano che spiega il PERCHÉ della modifica, non solo il cosa — coerente con lo stile
del repo.

## Output
Ultima riga dello stdout, esattamente una delle due:
```
ESITO: OK
```
oppure
```
ESITO: FALLITO(EXEC): <motivo>
```
