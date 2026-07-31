# IMPROVEMENTS.md — registro dei cicli del sistema autonomo

Unico file letto integralmente a ogni ciclo: righe di tabella, niente prosa.
Solo append (eccetto la compattazione: oltre 150 righe il planner compatta lo
storico più vecchio in righe riassuntive, preservando slug ed esiti).
Le sezioni descrittive stanno qui in alto e la tabella è l'ULTIMA sezione del
file: le righe nuove si appendono in coda e devono cadere dentro la tabella.

## Vocabolario chiuso delle aree

deploy · test · rotte-api · generazione · cancello-misure · storia-narrativa ·
catalogo-tuning · sito-web · pagina-aiuto · tuning-tool · sicurezza · docs

## Aree esaurite

(nessuna)

## Registro

| data | tipo | area | obiettivo | file | planner | esito | branch | deploy |
|---|---|---|---|---|---|---|---|---|
<!-- | 2026-07-30 12:00 UTC | BUILD | rotte-api | m3-scritture-admin-robuste — try/catch sulle scritture KV | backend/src/index.js, backend/tests/unit/admin.test.js | opus | FATTO | auto/20260730-120000 | 1a2b3c4d-... | -->
| 2026-07-31 10:00 UTC | BUILD | test | m2-banco-di-prova-e-rotte-protette | backend/tests/helpers/fakeEnv.js, backend/tests/integration/router-auth.test.js, backend/tests/integration/router-errori.test.js, backend/vitest.config.js | opus | FALLITO(VERIFY) | auto/20260731-094734 | — |
