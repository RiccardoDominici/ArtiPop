#!/usr/bin/env bash
#
# smoke-test.sh — verifica rapida e di sole letture che un deploy ArtiPop sia sano.
#
# Uso:   smoke-test.sh <base-url> [--prod]
# Exit:  0 se tutti i check passano, 1 se anche uno solo fallisce.
#
# Check eseguiti sempre:
#   GET /health         -> 200 + corpo JSON con il campo "ok"
#   GET /                -> 200 + contiene la stringa "ArtiPop"
#   GET /aiuto           -> 200
#   GET /api/channels    -> 200 + corpo JSON valido (array oppure oggetto)
#   ogni risposta sopra deve arrivare in < 3s
#
# Check aggiuntivo solo con --prod (in preview il KV puo' essere vuoto/placeholder,
# quindi l'endpoint immagine non e' un indicatore affidabile finche' non si e' fatto
# almeno un run):
#   GET /w/natura        -> 200 + Content-Type image/*
#
# Nessuna chiamata scrive nulla: solo GET su endpoint pubblici, mai su rotte admin.
#
# Fallback DNS: se il resolver di sistema non risolve l'host (curl exit 6, es.
# router domestico con DNS rotto), ogni check riprova UNA volta via DNS-over-
# HTTPS (1.1.1.1). Se il retry salva il check, l'esito riporta "(via DoH)".

set -uo pipefail
# NB: niente "-e" qui di proposito — vogliamo eseguire TUTTI i check e riportare
# un riepilogo completo, non fermarci al primo che fallisce.

# --- argomenti -----------------------------------------------------------
BASE_URL=""
PROD=0
for arg in "$@"; do
  case "$arg" in
    --prod) PROD=1 ;;
    *) BASE_URL="$arg" ;;
  esac
done

if [ -z "$BASE_URL" ]; then
  echo "Uso: $0 <base-url> [--prod]" >&2
  exit 1
fi
BASE_URL="${BASE_URL%/}"  # rimuove uno slash finale, se presente

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS_COUNT=0
FAIL_COUNT=0

ok()  { printf '  \xe2\x9c\x93 %s\n' "$1"; PASS_COUNT=$((PASS_COUNT + 1)); }
bad() { printf '  \xe2\x9c\x97 %s\n' "$1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# DoH di riserva: usato solo quando il resolver DNS di sistema non risolve
# *.workers.dev (curl exit 6) — capita coi resolver dei router domestici.
DOH_URL="https://1.1.1.1/dns-query"

# _fetch <path>
# Scarica <base-url><path> in $TMP_DIR/body (+ header in $TMP_DIR/headers) e
# imposta le variabili globali: FETCH_OK (0/1), FETCH_CODE, FETCH_TIME,
# FETCH_ERR, FETCH_VIA_DOH (1 se il check e' passato solo grazie al retry DoH).
_fetch() {
  local path="$1"
  local out curl_status
  FETCH_ERR=""
  FETCH_VIA_DOH=0

  out="$(curl -sS -D "$TMP_DIR/headers" -o "$TMP_DIR/body" -w '%{http_code} %{time_total}' -m 10 \
        "$BASE_URL$path" 2>"$TMP_DIR/curl_err")"
  curl_status=$?

  if [ "$curl_status" -eq 6 ]; then
    # Host non risolto dal resolver di sistema: un solo retry via DNS-over-HTTPS
    # prima di arrendersi, cosi' il loop non resta bloccato da un router rotto.
    out="$(curl -sS --doh-url "$DOH_URL" -D "$TMP_DIR/headers" -o "$TMP_DIR/body" -w '%{http_code} %{time_total}' -m 10 \
          "$BASE_URL$path" 2>"$TMP_DIR/curl_err")"
    curl_status=$?
    [ "$curl_status" -eq 0 ] && FETCH_VIA_DOH=1
  fi

  if [ "$curl_status" -ne 0 ]; then
    FETCH_OK=1
    FETCH_ERR="$(cat "$TMP_DIR/curl_err" 2>/dev/null)"
    FETCH_CODE=""
    FETCH_TIME=""
    return
  fi
  FETCH_OK=0
  FETCH_CODE="${out%% *}"
  FETCH_TIME="${out##* }"
}

# _time_ok <time_total> -> exit 0 se < 3s
_time_ok() {
  awk -v t="$1" 'BEGIN { exit !(t < 3) }'
}

# _doh_suffix -> " (via DoH)" se l'ultimo _fetch e' riuscito solo col retry DoH
_doh_suffix() {
  [ "${FETCH_VIA_DOH:-0}" -eq 1 ] && printf ' (via DoH)'
  return 0
}

echo "Smoke test su $BASE_URL$( [ "$PROD" -eq 1 ] && echo ' (--prod)' )"
echo

# --- /health: 200 + json con campo "ok" -----------------------------------
_fetch "/health"
if [ "$FETCH_OK" -ne 0 ]; then
  bad "/health — richiesta fallita ($FETCH_ERR)"
elif [ "$FETCH_CODE" != "200" ]; then
  bad "/health — status $FETCH_CODE atteso 200"
elif ! node -e '
      const fs = require("fs");
      try {
        const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        process.exit(data && typeof data === "object" && "ok" in data ? 0 : 1);
      } catch (e) { process.exit(1); }
    ' "$TMP_DIR/body" 2>/dev/null; then
  bad "/health — corpo non è JSON con campo \"ok\""
elif ! _time_ok "$FETCH_TIME"; then
  bad "/health — risposta lenta (${FETCH_TIME}s >= 3s)"
else
  ok "/health (200, ${FETCH_TIME}s, campo \"ok\" presente)$(_doh_suffix)"
fi

# --- /: 200 + contiene "ArtiPop" -----------------------------------------
_fetch "/"
if [ "$FETCH_OK" -ne 0 ]; then
  bad "/ — richiesta fallita ($FETCH_ERR)"
elif [ "$FETCH_CODE" != "200" ]; then
  bad "/ — status $FETCH_CODE atteso 200"
elif ! grep -q "ArtiPop" "$TMP_DIR/body"; then
  bad "/ — corpo non contiene \"ArtiPop\""
elif ! _time_ok "$FETCH_TIME"; then
  bad "/ — risposta lenta (${FETCH_TIME}s >= 3s)"
else
  ok "/ (200, ${FETCH_TIME}s, contiene \"ArtiPop\")$(_doh_suffix)"
fi

# --- /aiuto: 200 -----------------------------------------------------------
_fetch "/aiuto"
if [ "$FETCH_OK" -ne 0 ]; then
  bad "/aiuto — richiesta fallita ($FETCH_ERR)"
elif [ "$FETCH_CODE" != "200" ]; then
  bad "/aiuto — status $FETCH_CODE atteso 200"
elif ! _time_ok "$FETCH_TIME"; then
  bad "/aiuto — risposta lenta (${FETCH_TIME}s >= 3s)"
else
  ok "/aiuto (200, ${FETCH_TIME}s)$(_doh_suffix)"
fi

# --- /api/channels: 200 + json valido (array/oggetto) ----------------------
_fetch "/api/channels"
if [ "$FETCH_OK" -ne 0 ]; then
  bad "/api/channels — richiesta fallita ($FETCH_ERR)"
elif [ "$FETCH_CODE" != "200" ]; then
  bad "/api/channels — status $FETCH_CODE atteso 200"
elif ! node -e '
      const fs = require("fs");
      try {
        const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        process.exit(data !== null && typeof data === "object" ? 0 : 1);
      } catch (e) { process.exit(1); }
    ' "$TMP_DIR/body" 2>/dev/null; then
  bad "/api/channels — corpo non è JSON valido (array/oggetto)"
elif ! _time_ok "$FETCH_TIME"; then
  bad "/api/channels — risposta lenta (${FETCH_TIME}s >= 3s)"
else
  ok "/api/channels (200, ${FETCH_TIME}s, JSON valido)$(_doh_suffix)"
fi

# --- solo produzione: /w/natura -> 200 + Content-Type image/* --------------
if [ "$PROD" -eq 1 ]; then
  _fetch "/w/natura"
  if [ "$FETCH_OK" -ne 0 ]; then
    bad "/w/natura — richiesta fallita ($FETCH_ERR)"
  elif [ "$FETCH_CODE" != "200" ]; then
    bad "/w/natura — status $FETCH_CODE atteso 200"
  elif ! grep -qi '^content-type: *image/' "$TMP_DIR/headers"; then
    bad "/w/natura — Content-Type non è image/*"
  elif ! _time_ok "$FETCH_TIME"; then
    bad "/w/natura — risposta lenta (${FETCH_TIME}s >= 3s)"
  else
    ok "/w/natura (200, ${FETCH_TIME}s, image/*)$(_doh_suffix)"
  fi
fi

echo
echo "Risultato: $PASS_COUNT ok, $FAIL_COUNT falliti"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
