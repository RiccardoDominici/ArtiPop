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
<!-- ANNULLATA (setup): limite di spesa MENSILE dell'account raggiunto durante lo stadio A — il messaggio arriva su stdout e il classificatore guardava solo stderr, producendo retry generici e questo FALLITO spurio. Classificatore corretto (ora attende come rate-limit). Riga originale: | 2026-07-31 11:08 UTC | BUILD | - | errore-stadio-a | - | opus | FALLITO(EXEC) | auto/20260731-104223 | - | -->
| 2026-07-31 14:40 UTC | BUILD | rotte-api | m3-scritture-admin-blindate | backend/src/index.js, backend/tests/helpers/fakeEnv.js, backend/tests/integration/router-scritture.test.js, backend/tests/integration/router-auth.test.js, tuning/js/components.js, GUIDA.md, backend/README.md, ROADMAP.md, CHANGELOG.md | opus | FALLITO(VERIFY) | auto/20260731-141502 | - |

<!-- 2026-07-31 16:00-17:30 UTC | sprint MANUALE M3-M10 eseguito da Fable con esecutori Sonnet su richiesta diretta di Riccardo, fuori dai cicli del loop: vedi CHANGELOG.md per il dettaglio. Esiti: M3,M4,M5,M6,M7,M8,M9,M10 tutte FATTA. La riga del ciclo 2 (FALLITO(VERIFY) su m3-scritture-admin-blindate) fu causata dalla collisione col medesimo sprint: il loop girava per errore in parallelo sullo stesso worktree. -->
| 2026-07-31 22:12 UTC | POLISH | rotte-api | s-shortcut-mai-json-al-browser | backend/src/index.js, backend/src/help.js, backend/tests/integration/shortcut-download.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-220521 | dd4885d1-7ba2-4130-9572-a370efa1f6bb |
| 2026-07-31 22:17 UTC | POLISH | rotte-api | s-w-flusso-sconosciuto-mai-json | backend/src/index.js, backend/tests/integration/orchestrazione.test.js, backend/tests/integration/w-placeholder.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-221227 | ebd7f728-64bb-4cba-847a-3336933d798c |
| 2026-07-31 22:26 UTC | POLISH | rotte-api | s-rete-di-sicurezza-globale-sul-worker | backend/src/index.js, backend/src/help.js, backend/tests/helpers/fakeEnv.js, backend/tests/integration/rete-di-sicurezza.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-221755 | 63ff7826-9cf0-4b4b-8def-990661cd7004 |
| 2026-07-31 22:34 UTC | POLISH | sito-web | s-home-non-riscarica-i-wallpaper-a-ogni-sfogliata | backend/src/index.js, backend/src/page.js, backend/tests/integration/w-cache.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-222625 | cd8969ae-7515-48d5-8ef6-faa6dffa3a8b |
| 2026-07-31 22:43 UTC | POLISH | sito-web | s-anteprima-e-icona-quando-il-link-viene-condiviso | backend/src/head.js, backend/src/page.js, backend/src/help.js, backend/src/index.js, backend/tests/integration/anteprima-social.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-223415 | 783c1049-0c62-45bb-817e-0e1360a511d0 |
| 2026-07-31 23:17 UTC | POLISH | pagina-aiuto | s-aiuto-istruzioni-che-corrispondono-alla-home | backend/src/help.js, backend/tests/integration/aiuto-contenuto.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-224326 | 96f2bbcd-e222-499d-b6bb-19b80643e53d |
| 2026-07-31 23:23 UTC | POLISH | sito-web | s-indirizzo-sbagliato-pagina-non-json | backend/src/help.js, backend/src/index.js, backend/tests/integration/pagina-404.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-231805 | ed04f1dd-34b7-4d94-b730-417ebf32c4f7 |
| 2026-07-31 23:30 UTC | POLISH | docs | s-guida-e-readme-allineati-al-comportamento-reale | README.md, GUIDA.md, backend/src/config.js, CHANGELOG.md | opus | FATTO | auto/20260731-232354 | 06ffc3fe-2677-4764-8f63-0d405e7888cc |
| 2026-07-31 23:38 UTC | POLISH | generazione | s-health-dice-se-un-flusso-e-fermo | backend/src/handlers.js, backend/src/index.js, backend/tests/integration/health-ritardo.test.js, backend/tests/integration/health-cancello.test.js, GUIDA.md, CHANGELOG.md | opus | FATTO | auto/20260731-233051 | 14441ad2-09ab-42e8-a160-21248699697b |
| 2026-08-01 00:05 UTC | POLISH | cancello-misure | s-element-canoa-fuori-dalla-pesca-finche-non-e-tarato | backend/src/config.js, backend/src/catalog.js, backend/tests/unit/element-sospesi.test.js, CHANGELOG.md | opus | FATTO | auto/20260731-233845 | d8b5e898-c01e-4b9c-b1b0-5bbb3be51c88 |
| 2026-08-01 00:12 UTC | POLISH | generazione | s-cron-ritenta-una-volta-il-flusso-fallito | backend/src/handlers.js, backend/tests/helpers/fakeEnv.js, backend/tests/integration/orchestrazione-ritenta.test.js, GUIDA.md, CHANGELOG.md | opus | FATTO | auto/20260801-000512 | 1f180805-df2b-48d6-a131-0de0da55d79d |
| 2026-08-01 00:23 UTC | POLISH | generazione | s-immagine-di-oggi-non-si-perde-se-lo-stato-non-si-salva | backend/src/handlers.js, backend/tests/integration/orchestrazione-stato.test.js, backend/tests/helpers/fakeEnv.js, CHANGELOG.md | opus | FATTO | auto/20260801-001255 | 8ccc1643-6bbf-4d1c-a9dd-406e15a26c48 |
| 2026-08-01 00:30 UTC | POLISH | storia-narrativa | s-la-pesca-non-resta-mai-a-secco-per-una-sospensione | backend/src/catalog.js, backend/tests/unit/pool-mai-vuoto.test.js, CHANGELOG.md | opus | FATTO | auto/20260801-002307 | b969b421-099f-48dd-9272-4e93dcf57e31 |
| 2026-08-01 00:37 UTC | POLISH | storia-narrativa | s-uno-stato-illeggibile-non-blocca-un-flusso-per-sempre | backend/src/storage.js, backend/tests/integration/kv-illeggibile.test.js, CHANGELOG.md | opus | FATTO | auto/20260801-003045 | e6c5bf09-4cfd-4016-9042-17bdeb2455df |
