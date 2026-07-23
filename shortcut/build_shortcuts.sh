#!/bin/bash
# Genera, firma e VERIFICA un file .shortcut per ogni canale ArtiPop (richiede macOS).
#
# I file firmati con --mode anyone sono importabili da chiunque aprendoli su iOS
# (Safari/AirDrop -> Scorciatoie -> Aggiungi). Unica avvertenza per chi importa:
# serve "Impostazioni -> Scorciatoie -> Consenti scorciatoie non attendibili".
#
# "Mostra anteprima" ora è spenta DENTRO il file (WFWallpaperShowPreview=false nel
# template): era il motivo per cui la shortcut funzionava a mano ma non in
# automazione. Dopo la firma, verify_shortcuts.py riapre i file firmati e
# controlla che la chiave ci sia davvero — se qualcuno tocca il template e la
# perde, la build fallisce qui invece che sull'iPhone di un utente.

set -euo pipefail
cd "$(dirname "$0")"

BASE_URL="https://artipop.riccardo-dominici.workers.dev/w"
CHANNELS=(studio island bloom random)
OUT_DIR="dist"

mkdir -p "$OUT_DIR"

# Due varianti per canale:
#   <canale>       = template-poster (4 azioni): aggiorna SEMPRE il primo sfondo
#                    della schermata di blocco — è quella distribuita dal sito;
#   <canale>-base  = template (2 azioni): lascia a iOS la scelta dello sfondo,
#                    piano B documentato nella pagina /aiuto.
build_one() {
  local ch="$1" suffix="$2" template="$3"
  # Nota: `shortcuts sign` richiede che anche il file di input abbia
  # estensione .shortcut (con .xml fallisce con "isn't in the correct format").
  local unsigned="$OUT_DIR/ArtiPop-$ch$suffix.unsigned.shortcut"
  local signed="$OUT_DIR/ArtiPop-$ch$suffix.shortcut"

  # Sostituisce l'URL del canale nel template e converte in plist binario:
  # verificato empiricamente che `shortcuts sign` rifiuta l'XML ("isn't in the
  # correct format") ma accetta il binario.
  sed "s|__ARTIPOP_URL__|$BASE_URL/$ch|" "$template" > "$unsigned"
  plutil -convert binary1 "$unsigned"

  # Firma per la distribuzione a chiunque.
  shortcuts sign --mode anyone --input "$unsigned" --output "$signed"
  rm "$unsigned"
  echo "✓ $signed"
}

for ch in "${CHANNELS[@]}"; do
  build_one "$ch" ""      template-poster.shortcut.xml
  build_one "$ch" "-base" template.shortcut.xml
done

echo
echo "Verifica dei file firmati:"
# Se la verifica fallisce lo script esce con errore (set -e): i file NON vanno
# distribuiti e non vanno caricati in KV.
python3 "$(dirname "$0")/verify_shortcuts.py"

echo "Fatto: $(ls "$OUT_DIR" | wc -l | tr -d ' ') file in $OUT_DIR/"
echo "Caricali sul Worker con:"
for ch in "${CHANNELS[@]}"; do
  for suffix in "" "-base"; do
    echo "  npx wrangler kv key put --namespace-id 1209455c5d09479ba4051e9e8777c67a \"shortcut:$ch$suffix\" --path \"$OUT_DIR/ArtiPop-$ch$suffix.shortcut\" --remote"
  done
done
