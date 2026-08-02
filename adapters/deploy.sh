#!/usr/bin/env bash
#
# adapters/deploy.sh — pipeline di deploy per ArtiPop v3 (preview + produzione).
#
# Libreria di funzioni pensata per essere chiamata da run-loop.sh, ma anche
# utilizzabile a mano da riga di comando come sottocomandi. NON esegue MAI la
# parte di produzione automaticamente al caricamento: le funzioni che scrivono
# su produzione (deploy_production, rollback_production) vanno invocate in modo
# esplicito.
#
# Autenticazione: se CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID sono presenti
# nell'ambiente (caso container, vedi ~/.artipop-loop.env passato con
# --env-file) wrangler li usa automaticamente; altrimenti ricade sull'OAuth
# gia' autenticato in locale (wrangler login).
#
# Uso da CLI (dalla root del repo o da qualunque cartella):
#   adapters/deploy.sh preview
#   adapters/deploy.sh save-live-version
#   adapters/deploy.sh production
#   adapters/deploy.sh rollback <version-id> [messaggio]
#
# Uso come libreria (senza eseguire nulla al caricamento):
#   source adapters/deploy.sh --lib
#   deploy_preview
#   version="$(save_production_version | grep '^VERSION:' | cut -d' ' -f2)"
#   deploy_production
#   rollback_production "$version" "smoke test produzione fallito"

set -uo pipefail
# NB: niente "-e" globale — ogni funzione gestisce i propri errori e ritorna
# un codice di uscita esplicito, cosi' chi chiama (run-loop.sh) puo' decidere
# cosa fare (es. rollback) senza che lo script si interrompa a meta'.

# REPO_DIR calcolato dalla posizione dello script, non dalla cwd: robusto anche
# se lo script viene invocato con path relativi e a prescindere dallo spazio
# nel nome della cartella del repo ("ArtiPop v3").
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
SMOKE_TEST="$REPO_DIR/adapters/smoke-test.sh"

WORKER_PROD="artipop"
WORKER_PREVIEW="artipop-preview"
URL_PROD="https://artipop.riccardo-dominici.workers.dev"
URL_PREVIEW="https://artipop-preview.riccardo-dominici.workers.dev"

# _wrangler <args...> — esegue wrangler dalla cartella backend/ (gestisce lo
# spazio nel path del repo tramite subshell + cd quotato, senza toccare la cwd
# del chiamante).
_wrangler() {
  ( cd "$BACKEND_DIR" && npx wrangler "$@" )
}

# _extract_version_id — legge da stdin l'output di "wrangler deploy" ed estrae
# lo Version ID dalla riga "Current Version ID: <uuid>".
_extract_version_id() {
  grep -o 'Current Version ID:[[:space:]]*[0-9a-f-]\{36\}' | grep -o '[0-9a-f-]\{36\}' | tail -n1
}

# deploy_preview — deploy dell'ambiente preview + smoke test (senza --prod).
# Stampa "VERSION: <id>" e "URL: <url>" su stdout. Ritorna 0 se deploy e smoke
# sono entrambi ok, 1 altrimenti.
deploy_preview() {
  echo "==> Deploy preview ($WORKER_PREVIEW)"
  local out version
  out="$(_wrangler deploy --env preview 2>&1)" || {
    echo "$out" >&2
    echo "ERRORE: wrangler deploy --env preview fallito" >&2
    return 1
  }
  echo "$out"

  version="$(printf '%s\n' "$out" | _extract_version_id)"
  if [ -z "$version" ]; then
    echo "ERRORE: impossibile estrarre il Version ID dall'output di deploy" >&2
    return 1
  fi
  echo "VERSION: $version"
  echo "URL: $URL_PREVIEW"

  echo "==> Smoke test preview"
  if ! "$SMOKE_TEST" "$URL_PREVIEW"; then
    echo "SMOKE: fail"
    return 1
  fi
  echo "SMOKE: ok"
  return 0
}

# save_production_version — legge (SENZA deployare) la versione attualmente
# live in produzione, per poterla usare come bersaglio di un eventuale
# rollback_production successivo. Stampa "VERSION: <id>" su stdout.
save_production_version() {
  echo "==> Lettura versione live di produzione ($WORKER_PROD)" >&2
  local json version
  json="$(_wrangler deployments list --name "$WORKER_PROD" --json 2>&1)" || {
    echo "ERRORE: wrangler deployments list fallito: $json" >&2
    return 1
  }

  # "deployments list" torna un array ordinato dal piu' vecchio al piu'
  # recente: l'ultimo elemento e' il deployment attualmente live (100% del
  # traffico). ATTENZIONE: il campo top-level ".id" di ogni elemento e' l'id
  # del *deployment*, NON lo Version ID che "wrangler rollback" si aspetta —
  # quello va letto dentro ".versions[].version_id" (strategia "percentage").
  # Se non lo troviamo li' non si usa MAI ".id" come ripiego: meglio fallire
  # che fare un rollback verso l'id sbagliato.
  version="$(printf '%s' "$json" | node -e '
    let data = "";
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => {
      try {
        const deployments = JSON.parse(data);
        const list = Array.isArray(deployments) ? deployments : [];
        if (!list.length) { process.exit(1); }
        const last = list[list.length - 1];
        let id = null;
        if (Array.isArray(last.versions) && last.versions.length) {
          const full = last.versions.find((v) => v.percentage === 100) || last.versions[0];
          id = full && full.version_id;
        }
        id = id || last.version_id || last.versionId || null;
        if (!id) { process.exit(1); }
        console.log(id);
      } catch (e) {
        process.exit(1);
      }
    });
  ' 2>/dev/null)"

  if [ -z "$version" ]; then
    echo "ERRORE: impossibile determinare la versione live di produzione" >&2
    return 1
  fi
  echo "VERSION: $version"
  return 0
}

# deploy_production — deploy di PRODUZIONE (worker "artipop") + smoke test con
# --prod. ATTENZIONE: scrive sul worker di produzione. Da chiamare solo dopo
# che deploy_preview e' andato a buon fine e dopo aver salvato la versione
# live con save_production_version (per poter fare rollback se serve).
# Stampa "VERSION: <id>" su stdout.
deploy_production() {
  echo "==> Deploy produzione ($WORKER_PROD)"
  local out version
  out="$(_wrangler deploy 2>&1)" || {
    echo "$out" >&2
    echo "ERRORE: wrangler deploy (produzione) fallito" >&2
    return 1
  }
  echo "$out"

  version="$(printf '%s\n' "$out" | _extract_version_id)"
  if [ -z "$version" ]; then
    echo "ERRORE: impossibile estrarre il Version ID dall'output di deploy" >&2
    return 1
  fi
  echo "VERSION: $version"
  echo "URL: $URL_PROD"

  echo "==> Smoke test produzione (--prod)"
  if ! "$SMOKE_TEST" "$URL_PROD" --prod; then
    echo "SMOKE: fail"
    return 1
  fi
  echo "SMOKE: ok"
  return 0
}

# rollback_production <version-id> [messaggio] — rollback non interattivo di
# produzione alla versione indicata (tipicamente quella salvata in precedenza
# con save_production_version). ATTENZIONE: scrive sul worker di produzione.
rollback_production() {
  local version_id="${1:-}"
  local message="${2:-rollback automatico ArtiPop loop}"
  if [ -z "$version_id" ]; then
    echo "ERRORE: rollback_production richiede un version-id" >&2
    return 1
  fi
  echo "==> Rollback produzione ($WORKER_PROD) alla versione $version_id"
  local out
  out="$(_wrangler rollback "$version_id" --name "$WORKER_PROD" --message "$message" --yes 2>&1)" || {
    echo "$out" >&2
    echo "ERRORE: wrangler rollback fallito" >&2
    return 1
  }
  echo "$out"
  echo "VERSION: $version_id"
  return 0
}

# --- dispatch da riga di comando --------------------------------------------

_usage() {
  cat >&2 <<'EOF'
Uso: adapters/deploy.sh <comando> [argomenti]

Comandi:
  preview                            Deploy ambiente preview + smoke test
  save-live-version                  Legge (senza deployare) la versione live di produzione
  production                         Deploy produzione + smoke test --prod   (scrive su prod!)
  rollback <version-id> [messaggio]  Rollback produzione alla versione indicata (scrive su prod!)

In alternativa lo script puo' essere caricato come libreria di funzioni senza
eseguire nulla:
  source adapters/deploy.sh --lib
EOF
}

_main() {
  local cmd="${1:-}"
  case "$cmd" in
    preview) deploy_preview ;;
    save-live-version) save_production_version ;;
    production) deploy_production ;;
    rollback) shift; rollback_production "$@" ;;
    ""|-h|--help) _usage; exit 1 ;;
    *) echo "Comando sconosciuto: $cmd" >&2; _usage; exit 1 ;;
  esac
}

# Se lo script viene "sorgente" con --lib, definisce solo le funzioni sopra e
# si ferma qui (nessuna esecuzione). Se invece viene eseguito direttamente
# (./adapters/deploy.sh <comando> oppure bash adapters/deploy.sh <comando>),
# fa il dispatch del sottocomando.
if [ "${1:-}" = "--lib" ]; then
  return 0 2>/dev/null || exit 0
fi
if [[ "${BASH_SOURCE[0]:-$0}" == "${0}" ]]; then
  _main "$@"
fi
