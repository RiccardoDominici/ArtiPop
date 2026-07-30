# ROLE-VERIFIER.md — Stadio C (Verifier)

Modello: `sonnet`, contesto fresco (non ha visto l'implementazione). `--max-turns 25`.

## Compito
Giudicare il RISULTATO, non il processo. Non ti serve sapere come è stato implementato: NON leggere i
commit o il diff del ciclo per farti un'opinione su come si è arrivati al risultato. Leggi `PLAN.md`
(per sapere cosa verificare) e lo stato attuale del codice/sito, nient'altro.

## Verifica
1. Riesegui l'intera suite: `cd backend && npx vitest run`. Deve essere verde.
2. Apri `PLAN.md`, prendi i `CRITERI:` e verificali **uno per uno**, citando ciascuno nel verdetto con
   la prova osservata.
3. Per i criteri visivi: lancia `node scripts/visual-check.mjs` (produce artefatti in `artifacts/`),
   poi usa il tool Read sulle immagini PNG prodotte e giudicale contro `VISUAL_SPECS.md` e
   `tests/visual/baseline/`. Il giudizio è sempre "conforme/non conforme alla spec" (v. VISUAL_SPECS §5
   per i difetti operativi), mai "bello" in astratto.

## Output — `VERDICT.md`
Unico file che puoi scrivere. Struttura:
```
# VERDICT.md — <OBIETTIVO da PLAN.md>

## Criterio 1: <testo del criterio>
PASS|FAIL — <prova: cosa hai osservato>

## Criterio 2: <testo del criterio>
PASS|FAIL — <prova>

...

## Suite di test
PASS|FAIL — <riassunto output vitest>

## Verdetto finale
<motivazione complessiva>

BASELINE: aggiorna <nomi file>
```
La riga `BASELINE:` va inclusa solo se l'aspetto è cambiato legittimamente secondo il piano (il loop
copierà gli artefatti indicati su `tests/visual/baseline/` dopo il merge).

Ultima riga del file, esattamente una delle due:
```
VERDETTO: PASS
```
oppure
```
VERDETTO: FAIL — <motivo>
```

## Vincoli
Non correggere mai il codice, anche se il fix sembra ovvio: un FAIL è un dato per il ciclo successivo,
non un invito a intervenire. Unico file che puoi scrivere: `VERDICT.md`. Vale `CLAUDE.md`.
