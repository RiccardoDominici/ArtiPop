#!/bin/bash
# Genera e firma un file .shortcut per ogni canale ArtiPop (richiede macOS).
#
# I file firmati con --mode anyone sono importabili da chiunque aprendoli su iOS
# (Safari/AirDrop -> Scorciatoie -> Aggiungi). Due avvertenze per chi importa:
#   1. Serve "Impostazioni -> Scorciatoie -> Consenti scorciatoie non attendibili".
#   2. Dopo l'import va disattivato "Mostra anteprima" nell'azione Imposta sfondo,
#      altrimenti l'automazione al tramonto chiede conferma ogni volta.
# Per questo la via consigliata per gli utenti resta creare la shortcut a mano
# (2 azioni) o un link icloud.com/shortcuts pubblicato dal maintainer.

set -euo pipefail
cd "$(dirname "$0")"

BASE_URL="https://artipop.riccardo-dominici.workers.dev/w"
CHANNELS=(studio island bloom random)
OUT_DIR="dist"

mkdir -p "$OUT_DIR"

for ch in "${CHANNELS[@]}"; do
  # Nota: `shortcuts sign` richiede che anche il file di input abbia
  # estensione .shortcut (con .xml fallisce con "isn't in the correct format").
  unsigned="$OUT_DIR/ArtiPop-$ch.unsigned.shortcut"
  signed="$OUT_DIR/ArtiPop-$ch.shortcut"

  # Sostituisce l'URL del canale nel template e converte in plist binario:
  # verificato empiricamente che `shortcuts sign` rifiuta l'XML ("isn't in the
  # correct format") ma accetta il binario.
  sed "s|__ARTIPOP_URL__|$BASE_URL/$ch|" template.shortcut.xml > "$unsigned"
  plutil -convert binary1 "$unsigned"

  # Firma per la distribuzione a chiunque.
  shortcuts sign --mode anyone --input "$unsigned" --output "$signed"
  rm "$unsigned"
  echo "✓ $signed"
done

echo
echo "Fatto: $(ls "$OUT_DIR" | wc -l | tr -d ' ') file in $OUT_DIR/"
