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
- **POLISH**: nessuna milestone APERTA. Percorso a due passi.
  1. Cerca un miglioramento misurabile su uno dei quattro principi di `CLAUDE.md`, rispettandone
     l'ordine di priorità.
  2. Se il passo 1 non produce nulla di proponibile (tutto scartato dalla deduplica), non concludere
     subito con NESSUNA PROPOSTA: passa all'invenzione di una feature nuova — v. «Invenzione di
     feature (brainstorming di elementi)» qui sotto.

## Invenzione di feature (brainstorming di elementi)
Si applica solo in POLISH, al passo 2 sopra: quando la ricerca di un miglioramento misurabile non
produce nulla di proponibile. Ogni elemento delle liste si ricava dal prodotto reale con Grep mirati
su `GUIDA.md`, `README.md` e le rotte esistenti — mai a memoria, mai in astratto.

1. Costruisci tre liste di elementi, 4-6 voci ciascuna, radicate nel prodotto reale:
   - **A. persone e momenti d'uso** — es. chi imposta lo sfondo con la Shortcut al tramonto, chi apre
     il sito e sfoglia i canali, chi segue la storia narrativa di un arco, chi regola il tuning dei
     range, chi riscarica l'archivio di un vecchio canale, ...
   - **B. materia prima già esistente** — es. wallpaper giornalieri, flussi/canali e i loro alias
     storici, catalogo concept/element, meta e storia dell'arco, le chiavi KV, il cron giornaliero,
     le rotte `/api/*`, la pagina `/aiuto`, le Shortcut firmate, ...
   - **C. forme di valore** — es. vedere/rivedere, confrontare due giorni, condividere, personalizzare,
     capire cosa succede, ricevere al momento giusto, esplorare l'archivio, ...
2. Combina gli elementi (A × B × C) e genera almeno 8 idee, una riga ciascuna (titolo + una frase).
   Questo è lavoro di brutta: non va incollato integralmente in `PLAN.md`.
3. Screma nell'ordine dei principi di `CLAUDE.md`: 1 utilizzabilità reale per l'utente, 2 conformità
   a `VISUAL_SPECS.md` per tutto ciò che si vede, 3 robustezza, 4 essenzialità della realizzazione.
   Se l'idea introduce un componente/colore/dimensione non previsto da `VISUAL_SPECS.md`, questo NON
   è motivo di scarto al criterio 2: applica `VISUAL_SPECS §7` — dichiara in `MOTIVAZIONE` la
   "proposta di modifica VISUAL_SPECS §X", includi `VISUAL_SPECS.md` fra i `FILE:` e cita il paragrafo
   aggiornato nei criteri visivi.
   Vincoli duri che eliminano subito un'idea:
   - richiede una dipendenza runtime nuova;
   - richiede più di un ciclo di lavoro (in tal caso proponi solo la prima fetta verticale,
     utilizzabile da sola);
   - budget oltre 10 generazioni AI, o generazioni fuori dall'ambiente preview;
   - qualunque scrittura sul KV di produzione;
   - vive nell'infrastruttura del loop invece che nel prodotto: le feature riguardano il worker
     `artipop` e i suoi asset, mai gli strumenti che lo sviluppano (`run-loop.sh`, `monitor.py`,
     `ROLE-*.md` e gli altri file nei Divieti di `CLAUDE.md`, che nessun ruolo può toccare).
4. In `MOTIVAZIONE`: prima riga = sintesi umana della feature vincente (è quella che finisce nelle
   notifiche); poi la shortlist delle 3 finaliste (una riga l'una) e perché la vincitrice ha vinto
   sulle altre due. Se la feature cambia l'aspetto di una schermata coperta da
   `tests/visual/baseline/`, dichiaralo esplicitamente nei `CRITERI` (es. "la home mostra il nuovo
   blocco X, conforme a VISUAL_SPECS §1.4; baseline `home-*.png` da aggiornare"): senza questa
   dichiarazione il verifier ha un motivo formale per bocciare il cambio d'aspetto.
5. Slug con prefisso obbligatorio `feat-` (es. `feat-archivio-sfogliabile`), stabile fra i cicli anche
   in caso di fallimento e retry. `TIPO` resta `POLISH`. `AREA` sempre dal vocabolario chiuso di
   `IMPROVEMENTS.md`.
6. La feature vincente passa comunque per i tre controlli di deduplica qui sotto, con le eccezioni
   previste per gli slug `feat-`.
7. Il brainstorming non deve consumare il budget di turni dello stadio (`--max-turns 20`): ricava le
   liste con UNA sola tornata di Grep in parallelo (al massimo 6 ricerche complessive) e sorveglia i
   turni restanti. Se ti avvicini al limite, scrivi comunque `PLAN.md` — con la proposta già matura o,
   in mancanza, con `NESSUNA PROPOSTA` e il motivo: un ciclo che termina senza `PLAN.md` viene
   registrato FALLITO(EXEC) "piano-senza-obiettivo", non conta per l'arresto pulito e non insegna
   nulla al sistema.

## Deduplica — tre controlli obbligatori, da documentare nel PLAN
Prima di proporre qualunque obiettivo, esegui e riporta in `PLAN.md` l'esito di ciascuno dei tre controlli:

1. **Per significato** — scorri `IMPROVEMENTS.md`: un collega direbbe che questo obiettivo è già stato
   tentato, a prescindere dalla formulazione esatta? Vale anche fra le feature (slug `feat-`)
   precedenti. Una riga con esito FATTO, DUPLICATO o BLOCCATO per lo stesso significato → DUPLICATO.
   Una riga FALLITO(EXEC/VERIFY/DEPLOY) NON è un duplicato: ri-proporre lo stesso slug è proprio ciò
   che attiva l'escalation a Fable (v. «Escalation Fable»), purché il piano cambi direzione rispetto
   al tentativo fallito — non che ripeta lo stesso approccio. Eccezione: se per lo stesso slug il
   registro mostra già sia una riga FALLITO sia una riga con planner `fable`, l'obiettivo è esaurito
   → trattalo come DUPLICATO (il loop lo chiuderebbe subito come BLOCCATO, bruciando il ciclo).
2. **Per area** — l'area (dal vocabolario chiuso di `IMPROVEMENTS.md`) è elencata nella sezione
   «Aree esaurite»? Se sì → DUPLICATO, sempre, anche per uno slug `feat-`. In più, solo per i
   miglioramenti (slug non `feat-`): l'area ha già 3 o più righe con esito FATTO? Se sì → DUPLICATO.
   Questa seconda soglia non si applica agli slug `feat-` — una feature aggiunge comportamento nuovo,
   non lucida l'esistente.
3. **Per codice** — Grep sui file che il piano dichiarerebbe di toccare: se il comportamento che vuoi
   introdurre esiste già e funziona → DUPLICATO. Questo controllo ha sempre l'ultima parola: il registro
   può essere incompleto, il codice no.

Se uno qualunque dei controlli applicabili è positivo, non proporre quell'obiettivo: cercane un altro o
concludi senza piano (v. sotto).

## Ricerca
Massimo 3 `WebSearch` di best practice, solo se la feature o la soluzione non è banale. Non procedere
a intuito su decisioni non banali.

## Nessuna proposta
Scrivi `PLAN.md` con **sola** riga 1 `NESSUNA PROPOSTA` e riga 2 il motivo. Quando è lecito:
- **BUILD**: se la deduplica esclude ogni porzione ancora proponibile della milestone corrente.
- **POLISH**: solo quando non resta nulla di proponibile DOPO entrambi i passi — la ricerca del
  miglioramento (passo 1) E l'invenzione della feature (passo 2, v. «Invenzione di feature»). La
  riga 2 deve dare un motivo di merito per entrambi i tentativi — per l'invenzione, es. quali
  vincoli duri hanno eliminato le idee generate — mai "non ho cercato".
Non aggiungere altro al file.

## Formato di `PLAN.md` (esatto — il loop esegue grep letterale su questi campi)
```
OBIETTIVO: <slug-kebab-case-stabile, es. m3-scritture-admin-robuste — per i cicli BUILD
DEVE iniziare con l'id minuscolo della milestone ("m3-"): il loop conta i fallimenti
per milestone tramite quel prefisso>
TIPO: BUILD|POLISH
AREA: <una del vocabolario chiuso in IMPROVEMENTS.md>
MILESTONE: Mx|—
MOTIVAZIONE:
<prima riga: sintesi umana dell'obiettivo (va nelle notifiche); poi perché ora ed esito dei
controlli di deduplica applicabili. Per le feature (slug feat-) aggiungi anche la shortlist
delle 3 finaliste (una riga l'una) e il motivo della vittoria — v. «Invenzione di feature»>
FILE:
<elenco dei file che verranno toccati, su UNA sola riga, separati da virgola.
Includi SEMPRE CHANGELOG.md (l'executor lo aggiorna per dovere d'ufficio) e
ROADMAP.md se il piano completa una milestone>
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
dichiaralo esplicitamente in `MOTIVAZIONE`. In escalation mantieni STABILE l'identificativo con cui
il loop conta i fallimenti: in POLISH è lo slug esatto (identico al piano fallito, `feat-` inclusi —
cambia la direzione, non lo slug); in BUILD è il prefisso di milestone (`mx-`), che deve restare
invariato anche se il resto dello slug cambia. La riga BLOCCATO che chiude un obiettivo esaurito
arriva solo se quel conteggio non si spezza.

## Vincoli
Vale integralmente `CLAUDE.md` (Divieti, budget AI, segreti, disciplina del contesto). Non scrivere
codice. Non modificare file oltre `PLAN.md`.
