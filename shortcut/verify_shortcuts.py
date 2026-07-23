#!/usr/bin/env python3
"""Apre i file .shortcut FIRMATI in dist/ e verifica che siano davvero corretti.

Perché serve: `shortcuts sign` non dice nulla sul contenuto, e un errore nel
template (chiave sbagliata, URL non sostituito, anteprima riaccesa) si
scoprirebbe solo sull'iPhone, giorni dopo, come "l'automazione non parte".

Come fa a leggere un file firmato — un .shortcut è un archivio AEA (profilo 0:
firmato ma NON cifrato) che contiene un Apple Archive con dentro Shortcut.wflow:
  1. l'header AEA contiene un bplist con la catena di certificati di firma;
  2. dal certificato foglia si estrae la chiave pubblica (openssl);
  3. `aea decrypt -sign-pub <chiave>` restituisce l'Apple Archive;
  4. `aa extract` ne tira fuori Shortcut.wflow, che è un plist normale.

Uso:  python3 verify_shortcuts.py            (verifica tutti i file in dist/)
      python3 verify_shortcuts.py file.shortcut
"""

import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Invarianti che un file distribuibile DEVE rispettare.
WALLPAPER_ACTION = "is.workflow.actions.wallpaper.set"
DOWNLOAD_ACTION = "is.workflow.actions.downloadurl"
POSTERS_ACTION = "is.workflow.actions.posters.get"
LIST_ITEM_ACTION = "is.workflow.actions.getitemfromlist"
PREVIEW_KEY = "WFWallpaperShowPreview"
POSTER_KEY = "WFSelectedPoster"
SMARTCROP_KEY = "WFWallpaperSmartCrop"


def read_signed_shortcut(path: Path) -> dict:
    """Ritorna il plist del workflow contenuto in un .shortcut firmato."""
    data = path.read_bytes()
    if data[:4] != b"AEA1":
        raise ValueError(f"{path.name}: non è un archivio AEA (magic {data[:4]!r})")

    auth_len = struct.unpack("<I", data[8:12])[0]
    auth = plistlib.loads(data[12 : 12 + auth_len])
    chain = auth.get("SigningCertificateChain")
    if not chain:
        raise ValueError(f"{path.name}: nessuna catena di certificati nell'header")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "leaf.der").write_bytes(chain[0])  # il primo è il certificato di firma
        pub = subprocess.run(
            ["openssl", "x509", "-inform", "DER", "-in", str(tmp / "leaf.der"),
             "-pubkey", "-noout"],
            capture_output=True, check=True,
        ).stdout
        (tmp / "pub.pem").write_bytes(pub)

        subprocess.run(
            ["aea", "decrypt", "-i", str(path), "-o", str(tmp / "payload.aa"),
             "-sign-pub", str(tmp / "pub.pem")],
            capture_output=True, check=True,
        )
        (tmp / "ext").mkdir()
        subprocess.run(
            ["aa", "extract", "-i", str(tmp / "payload.aa"), "-d", str(tmp / "ext")],
            capture_output=True, check=True,
        )
        wflow = tmp / "ext" / "Shortcut.wflow"
        if not wflow.exists():
            raise ValueError(f"{path.name}: nessun Shortcut.wflow nell'archivio")
        return plistlib.loads(wflow.read_bytes())


def check(path: Path) -> list[str]:
    """Ritorna la lista degli errori trovati (vuota = file a posto)."""
    errors = []
    wf = read_signed_shortcut(path)
    actions = wf.get("WFWorkflowActions", [])
    by_id = {a.get("WFWorkflowActionIdentifier"): a.get("WFWorkflowActionParameters", {})
             for a in actions}

    dl = by_id.get(DOWNLOAD_ACTION)
    if dl is None:
        errors.append(f"manca l'azione {DOWNLOAD_ACTION}")
    else:
        url = dl.get("WFURL", "")
        if "__ARTIPOP_URL__" in url:
            errors.append("l'URL segnaposto non è stato sostituito")
        elif not url.startswith("https://"):
            errors.append(f"URL sospetto: {url!r}")

    wp = by_id.get(WALLPAPER_ACTION)
    if wp is None:
        errors.append(f"manca l'azione {WALLPAPER_ACTION}")
    else:
        preview = wp.get(PREVIEW_KEY, "ASSENTE")
        if preview is not False:
            errors.append(
                f"{PREVIEW_KEY} = {preview!r} invece di False → l'anteprima resta "
                "accesa e l'automazione NON funzionerà"
            )
        crop = wp.get(SMARTCROP_KEY, "ASSENTE")
        if crop is not False:
            errors.append(
                f"{SMARTCROP_KEY} = {crop!r} invece di False → iOS ritaglierebbe "
                "l'immagine attorno al soggetto, cambiando l'inquadratura"
            )
        # L'immagine deve arrivare dall'azione di download, non da altro.
        src = wp.get("WFInput", {}).get("Value", {})
        if src.get("Type") != "ActionOutput":
            errors.append("l'input dell'azione sfondo non è l'output del download")

    # Variante "ultimo sfondo": se c'è l'aggancio al poster, la catena
    # Ottieni sfondi → ultimo elemento → WFSelectedPoster deve essere completa,
    # altrimenti l'azione punterebbe a uno sfondo inesistente.
    if wp is not None and POSTER_KEY in wp:
        posters = by_id.get(POSTERS_ACTION)
        item = by_id.get(LIST_ITEM_ACTION)
        if posters is None:
            errors.append(f"{POSTER_KEY} è valorizzato ma manca l'azione {POSTERS_ACTION}")
        elif posters.get("WFPosterType") != "All":
            errors.append(f"WFPosterType = {posters.get('WFPosterType')!r} invece di 'All'")
        if item is None:
            errors.append(f"{POSTER_KEY} è valorizzato ma manca l'azione {LIST_ITEM_ACTION}")
        elif item.get("WFItemSpecifier") != "Last Item":
            errors.append(
                f"WFItemSpecifier = {item.get('WFItemSpecifier')!r} invece di 'Last Item': "
                "non verrebbe aggiornato l'ultimo sfondo"
            )
        elif item.get("WFInput", {}).get("Value", {}).get("OutputUUID") != posters.get("UUID"):
            errors.append("l'elenco di 'ultimo elemento' non è collegato a 'ottieni tutti gli sfondi'")
        poster_ref = wp[POSTER_KEY].get("Value", {}) if isinstance(wp[POSTER_KEY], dict) else {}
        if item is not None and poster_ref.get("OutputUUID") != item.get("UUID"):
            errors.append(f"{POSTER_KEY} non è collegato all'ultimo elemento della lista")

    return errors


def main() -> int:
    for tool in ("aea", "aa", "openssl"):
        if shutil.which(tool) is None:
            print(f"✗ manca lo strumento di sistema '{tool}' (serve macOS)")
            return 2

    targets = [Path(a) for a in sys.argv[1:]] or sorted((HERE / "dist").glob("*.shortcut"))
    if not targets:
        print("Nessun file da verificare: lancia prima ./build_shortcuts.sh")
        return 2

    failed = 0
    for path in targets:
        try:
            errors = check(path)
        except Exception as err:  # file illeggibile = file da rifare
            print(f"✗ {path.name}: {err}")
            failed += 1
            continue
        if errors:
            failed += 1
            print(f"✗ {path.name}")
            for e in errors:
                print(f"    - {e}")
        else:
            variante = "aggancia l'ultimo sfondo" if "-base" not in path.name else "sfondo scelto da iOS"
            print(f"✓ {path.name}: anteprima spenta, URL sostituito, {variante}")

    print()
    print("Tutti i file sono distribuibili." if not failed
          else f"{failed} file DA NON DISTRIBUIRE.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
