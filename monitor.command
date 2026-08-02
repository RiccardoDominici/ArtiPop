#!/bin/bash
# monitor.command — avvia il monitor TUI per QUESTO progetto.
# Copia (o linka) questo file nella root del progetto, accanto a loop.config.
# I file .command sono eseguibili: Finder lo apre in Terminal al doppio click
# (serve `chmod +x` una tantum dopo la copia). Risolve ENGINE_DIR dal
# loop.config della propria directory e lancia monitor.py del motore puntato
# a questo progetto — nessuna logica propria oltre alla risoluzione del path.
set -e
cd "$(dirname "$0")"

if [ ! -f loop.config ]; then
    echo "ERRORE: loop.config non trovato in $(pwd)" >&2
    exit 1
fi

# Sourcing in subshell isolata: stessa cautela di start-loop.sh, non vogliamo
# che variabili/funzioni del loop.config del progetto sporchino questa shell.
ENGINE_DIR="$(
    # shellcheck disable=SC1091
    source loop.config
    printf '%s' "${ENGINE_DIR:-$HOME/Developer/autoloop}"
)"

if [ ! -f "$ENGINE_DIR/monitor.py" ]; then
    echo "ERRORE: monitor.py non trovato in $ENGINE_DIR (controlla ENGINE_DIR in loop.config)" >&2
    exit 1
fi

exec python3 "$ENGINE_DIR/monitor.py" "$(pwd)"
