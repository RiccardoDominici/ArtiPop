# ArtiPop v3 — immagine del loop autonomo.
# Immagine generica: NON contiene il repo. Il repo (con run-loop.sh) viene montato a runtime
# con `docker run -v "<repo>:/work" ...`. Nessuna credenziale in questa immagine: token e chiavi
# arrivano solo a runtime via --env-file (v. AUTOLOOP.md).
FROM node:22-slim

# Strumenti di base: git per i branch di ciclo, python3 per monitor.py e per script di supporto,
# curl per le notifiche ntfy e gli smoke test, ca-certificates per HTTPS verso Cloudflare/Anthropic.
# python3-rich dal repository apt (non pip): Debian bookworm lo fornisce già pacchettizzato,
# evita l'errore "externally-managed-environment" di pip su questa base image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    python3-rich \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# CLI di Claude Code (esegue i tre stadi del ciclo: planner/executor/verifier) e wrangler (deploy
# Cloudflare Workers). Installati globali perché servono a run-loop.sh, non al codice del repo.
RUN npm install -g @anthropic-ai/claude-code wrangler

# Chromium per il visual-check (Playwright), con le sue dipendenze di sistema. Versione PINNATA
# alla stessa del package.json di root (1.62.0): i browser scaricati qui devono corrispondere
# alla revision attesa dalla libreria playwright installata a runtime con npm ci, altrimenti
# lo script fallirebbe con "browser revision not found".
RUN npx --yes playwright@1.62.0 install --with-deps chromium

WORKDIR /work

# Il repo viene montato qui: -v "/Users/riccardo/Developer/Python/ArtiPop/ArtiPop v3:/work".
# I node_modules NON arrivano dal mount: sull'host sono compilati per macOS/arm64 (esbuild,
# binari nativi) e in Linux non funzionerebbero. Il docker run (v. AUTOLOOP.md) monta due
# volumi dedicati su /work/node_modules e /work/backend/node_modules; qui, al primo avvio
# (o dopo un cambio di lockfile), li popoliamo con npm ci prima di lanciare il loop.
ENTRYPOINT ["/bin/bash", "-lc", "set -e; \
  for d in . backend; do \
    if [ ! -f \"$d/node_modules/.docker-install-ok\" ] || [ \"$d/package-lock.json\" -nt \"$d/node_modules/.docker-install-ok\" ]; then \
      echo \"[entrypoint] npm ci in $d (node_modules del container non aggiornati)\"; \
      (cd \"$d\" && npm ci --no-audit --no-fund && touch node_modules/.docker-install-ok); \
    fi; \
  done; \
  exec ./run-loop.sh"]
