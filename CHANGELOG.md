# CHANGELOG.md — ArtiPop v3

Una voce per ciclo del sistema autonomo (o per intervento manuale), datata, che spiega il perché
delle modifiche — non solo il cosa. Scritta dall'Executor ad ogni ciclo che produce codice.

## Formato

```
## YYYY-MM-DD — <slug-obiettivo-del-ciclo>
- <modifica 1: cosa e perché>
- <modifica 2: cosa e perché>
```

<!-- ## 2026-08-01 — m2-test-auth-rotte-protette
- Aggiunti test su tutte le rotte protette (401/403): era il criterio mancante per chiudere M2.
- Mock manuale dei binding KV invece di @cloudflare/vitest-pool-workers: meno dipendenze, sufficiente
  per il caso d'uso attuale (essenzialità). -->

## 2026-07-31 — m2-recupero-suite-orfana-ciclo-3
- `backend/tests/helpers/fakeEnv.js`: KV in-memory (get/getWithMetadata/put/delete/list) più stub
  AI/IMAGES/SELF che lanciano se invocati — garanzia strutturale di zero generazioni AI nel ciclo,
  senza aggiungere alcuna devDependency (niente @cloudflare/vitest-pool-workers).
- `backend/tests/integration/router-auth.test.js`: le 16 rotte guardate da `isAuthorized` (contate a
  grep, non a memoria) rifiutano senza chiave con 403 JSON; `GET`/`PUT /tuning` hanno anche il caso
  felice autorizzato; verificato anche il rifiuto quando `ADMIN_KEY` non è configurato.
- `backend/tests/integration/router-errori.test.js`: 404 sul fallback, header CORS sul preflight di
  una rotta tool, e 400 con messaggio chiaro su JSON illeggibile o di forma incompleta per
  `/tuning`, `/catalogo/concept`, `/note/giorno`.
- `backend/tests/integration/orchestrazione.test.js`: idempotenza di `runChannel` (stesso giorno →
  `skipped: true`, generazione mai invocata) e byte-stabilità di `/w/<flusso>?date=` fra due letture
  dello stesso archivio.
- `backend/vitest.config.js`: `include` allargato a `tests/**/*.test.js` per raccogliere anche
  `tests/integration/`, finora invisibile alla suite.
- M2 chiusa in `ROADMAP.md`: era l'ultima milestone APERTA. I tre tentativi precedenti erano caduti
  per cause procedurali (perimetro dei `FILE:` dichiarati, falso negativo del parser sulla
  sentinella), mai per il merito dell'impianto di test — questo ciclo ha recuperato via cherry-pick
  (commit `c53d572`, `a095daa`) il lavoro verde e orfano lasciato dal ciclo 3, verificato con
  `git fsck` e applicato senza conflitti (`git merge-tree`), invece di riscrivere la suite da zero.
