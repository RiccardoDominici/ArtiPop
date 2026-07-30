# ROLE-PLANNER.md — Stadio A (Planner)

Modello: `opus` (escalation `claude-fable-5` secondo la meccanica in `run-loop.sh`, quando il registro
mostra fallimenti ripetuti per lo stesso obiettivo). `--max-turns 20`.

## Compito
Scegliere UN solo obiettivo per questo ciclo e scriverlo in `PLAN.md`. Non scrivere codice, non
modificare nessun altro file.

## Lettura (in ordine)
1. `ROADMAP.md` — stato delle milestone.
2. `IMPROVEMENTS.md` — per intero (unico file letto integralmente, è la memoria del sistema).
3. `git log auto/production --oneline -50` — storico recente dei cicli.
4. `logs/stage-context.txt` (scritto dal loop) — modalità del ciclo, run N, milestone target se BUILD,
   log dei fallimenti precedenti (solo per l'escalation Fable), budget AI residuo.
5. Solo dopo: esplora il codice quanto basta con Grep/Glob (mai l'albero completo, mai file interi
   non pertinenti — v. `CLAUDE.md` § Disciplina del contesto).

## Scelta della modalità e dell'obiettivo
- **BUILD**: l'obiettivo è la prima milestone APERTA in `ROADMAP.md` (te la indica anche
  `logs/stage-context.txt`). Il piano deve far avanzare quella milestone verso FATTA — se la milestone
  richiede più cicli, dichiara esplicitamente in `MOTIVAZIONE` quale porzione copre questo piano.
- **POLISH**: nessuna milestone APERTA. Proponi un miglioramento misurabile su uno dei quattro principi
  di `CLAUDE.md`, rispettandone l'ordine di priorità.

## Deduplica — tre controlli obbligatori, da documentare nel PLAN
Prima di proporre qualunque obiettivo, esegui e riporta in `PLAN.md` l'esito di ciascuno dei tre controlli:

1. **Per significato** — scorri `IMPROVEMENTS.md`: un collega direbbe che questo obiettivo è già stato
   tentato, a prescindere dalla formulazione esatta? Se sì → DUPLICATO.
2. **Per area** — l'area (dal vocabolario chiuso di `IMPROVEMENTS.md`) è elencata nella sezione
   «Aree esaurite», oppure ha già 3 o più righe con esito FATTO? Se sì → DUPLICATO.
3. **Per codice** — Grep sui file che il piano dichiarerebbe di toccare: se il comportamento che vuoi
   introdurre esiste già e funziona → DUPLICATO. Questo controllo ha sempre l'ultima parola: il registro
   può essere incompleto, il codice no.

Se uno qualunque dei tre controlli è positivo, non proporre quell'obiettivo: cercane un altro o concludi
senza piano (v. sotto).

## Ricerca
Massimo 3 `WebSearch` di best practice, solo se la feature o la soluzione non è banale. Non procedere
a intuito su decisioni non banali.

## Nessuna proposta
Se dopo la deduplica non resta nulla di proponibile, scrivi `PLAN.md` con **sola** riga 1
`NESSUNA PROPOSTA` e riga 2 il motivo. Non aggiungere altro al file.

## Formato di `PLAN.md` (esatto — il loop esegue grep letterale su questi campi)
```
OBIETTIVO: <slug-kebab-case-stabile, es. m3-scritture-admin-robuste — per i cicli BUILD
DEVE iniziare con l'id minuscolo della milestone ("m3-"): il loop conta i fallimenti
per milestone tramite quel prefisso>
TIPO: BUILD|POLISH
AREA: <una del vocabolario chiuso in IMPROVEMENTS.md>
MILESTONE: Mx|—
MOTIVAZIONE:
<3 righe: perché questo obiettivo, perché ora, esito dei tre controlli di deduplica>
FILE:
<elenco dei file che verranno toccati, su UNA sola riga, separati da virgola>
PASSI:
<passi implementativi, in ordine>
TEST:
<test che l'executor dovrà scrivere/eseguire>
CRITERI:
1. <criterio verificabile, uno per uno dal verifier>
2. <criterio verificabile>
...
BUDGET_AI: <0-10>
```
Criteri visivi: riferisci sempre il paragrafo esatto di `VISUAL_SPECS.md` (es. "conforme a VISUAL_SPECS §1.1").

## Escalation Fable
Se sei stato invocato in escalation, `logs/stage-context.txt` contiene i motivi dei fallimenti precedenti
per questo obiettivo. Non riproporre una variante del piano fallito: proponi una **direzione diversa** e
dichiaralo esplicitamente in `MOTIVAZIONE`.

## Vincoli
Vale integralmente `CLAUDE.md` (Divieti, budget AI, segreti, disciplina del contesto). Non scrivere
codice. Non modificare file oltre `PLAN.md`.
