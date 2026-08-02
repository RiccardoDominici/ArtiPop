# CLAUDE.md — ArtiPop v3 (contesto di progetto, caricato ad ogni stadio)

Vale per Planner, Executor e Verifier, IN AGGIUNTA a `ENGINE-CONTRACT.md` del motore
(disciplina del contesto, strategia git, formato del registro, divieti strutturali —
non ripetuta qui: quella è fissa per ogni progetto, questa è la parte che cambia).

## Principi (in ordine — in caso di conflitto vince quello sopra)
1. **Utilizzabilità** — il sito e le rotte devono funzionare per l'utente reale (Shortcut inclusa).
2. **Bellezza** = conformità a `VISUAL_SPECS.md`. Mai giudizio di gusto: solo aderenza alla spec.
3. **Robustezza** — errori gestiti, mai un crash grezzo esposto all'utente.
4. **Essenzialità** — la soluzione più semplice che risolve il problema; niente aggiunto "perché
   utile". Le feature nuove proposte dal planner (slug `feat-`) non violano questo principio:
   l'essenzialità vincola il *come* (la realizzazione più semplice), non il *cosa*.

## Comandi
- **Test**: `cd backend && npx vitest run` — DEVE combaciare con `TEST_CMD` in `loop.config`:
  sono la stessa cosa scritta in due posti, se li disallinei uno dei due mente.
- **Visual check** (solo se `VISUAL_ENABLED=1`): `node adapters/visual-check.mjs`
- **Smoke test** (solo se `DEPLOY_ENABLED=1`): `./adapters/smoke-test.sh <url>`
- **Linter**: nessuno — scelta deliberata, non aggiungerne.

## Perimetro cloud
- Account: Cloudflare, `d6886aa91f37af4da724e3b0693f04fe`
- Risorse che il loop può toccare: worker `artipop` e `artipop-preview`, e i loro KV
- MAI: DNS/zone/altri progetti/altri worker

## Budget esterno
- Risorsa limitata: generazioni AI immagine
- Tetto per ciclo: 10
- Ambiente consentito: solo preview, mai scritture sul KV di produzione

## Secret
Le variabili elencate in `SECRET_ENV_NAMES` di `loop.config` (oggi: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_ADMIN_KEY`, `ADMIN_KEY`) non vanno MAI stampate, loggate o
committate — vale per planner, executor, verifier, senza eccezioni, env compresi.

## Brainstorming (Planner, fase POLISH)
Il planner incrocia tre liste (A×B×C, meccanismo descritto nel ruolo Planner del motore) per
generare proposte non ovvie invece di girare sempre sulle stesse idee. Liste stabili fra i cicli:

- **A — persone e momenti d'uso**: chi imposta lo sfondo con la Shortcut al tramonto, chi apre
  il sito e sfoglia i canali, chi segue la storia narrativa di un arco, chi regola il tuning dei
  range, chi riscarica l'archivio di un vecchio canale
- **B — materia prima già esistente**: wallpaper giornalieri, flussi/canali e i loro alias
  storici, catalogo concept/element, meta e storia dell'arco, le chiavi KV, il cron giornaliero,
  le rotte `/api/*`, la pagina `/aiuto`, le Shortcut firmate
- **C — forme di valore**: vedere/rivedere, confrontare due giorni, condividere, personalizzare,
  capire cosa succede, ricevere al momento giusto, esplorare l'archivio
