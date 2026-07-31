#!/bin/bash
# Avvio comodo della TUI di monitoraggio ArtiPop: doppio click dal Finder
# (o ./monitor.command dal terminale). Apre monitor.py nella cartella giusta,
# qualunque sia la cwd di partenza; path con spazio gestito dal dirname.
cd "$(dirname "$0")" || exit 1

# rich è richiesta: se manca, spiega come procurarsela senza toccare il repo.
if ! python3 -c "import rich" 2>/dev/null; then
    echo "Manca la libreria Python 'rich' (la TUI ne ha bisogno)."
    echo "Installala in un ambiente utente:  python3 -m pip install --user rich"
    read -r -p "Premi Invio per chiudere..."
    exit 1
fi

exec python3 monitor.py
