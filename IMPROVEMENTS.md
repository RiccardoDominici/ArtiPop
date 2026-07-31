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
<!-- ANNULLATA (setup): falso negativo del parser — l'executor aveva chiuso con ESITO: OK dentro un code-fence e il loop leggeva solo l'ultima riga letterale; parser corretto, lavoro rifatto al ciclo successivo. Riga originale: | 2026-07-31 10:15 UTC | BUILD | test | m2-integrazione-completa-router-e-orchestrazione | ... | fable | FALLITO(EXEC) | auto/20260731-100354 | - | -->
<!-- ANNULLATA (setup): secondo falso negativo — il filtro dei fence usava \` che GNU grep interpreta come àncora di buffer, sopprimendo ogni riga: sentinella mai trovata. Pattern corretto. Riga originale: | 2026-07-31 10:29 UTC | BUILD | test | m2-rotte-e-orchestrazione-sotto-test | ... | fable | FALLITO(EXEC) | auto/20260731-101814 | - | -->
| 2026-07-31 10:41 UTC | BUILD | test | m2-recupero-suite-orfana-ciclo-3 | backend/vitest.config.js, backend/tests/helpers/fakeEnv.js, backend/tests/integration/orchestrazione.test.js, backend/tests/integration/router-auth.test.js, backend/tests/integration/router-errori.test.js, ROADMAP.md, CHANGELOG.md | fable | FATTO | auto/20260731-103328 | 41d84476-2e17-42f4-941e-ade4ec6856e1 |
| 2026-07-31 11:08 UTC | BUILD | - | errore-stadio-a | - | opus | FALLITO(EXEC) | auto/20260731-104223 | - |
