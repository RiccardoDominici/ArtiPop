// feat-aggiungi-artipop-alla-schermata-home: web app manifest per
// installare ArtiPop sulla schermata Home (Android/desktop; su iOS
// l'installazione usa i meta tag di `head.js`, non questo file).
//
// L'icona è la stessa `FAVICON_SVG` già disegnata in `head.js`: nessun nuovo
// disegno, solo un'altra rotta (`/icona.svg`) che la serve come file a sé,
// perché un manifest non può puntare a un'icona `data:` inline.
import { ICON_SVG } from "./head.js";

export function iconaSvg() {
  return ICON_SVG;
}

/**
 * Corpo JSON del web app manifest. `background_color`/`theme_color` sono il
 * token `--bg` #0a0b10 già dichiarato in VISUAL_SPECS §1.1: nessun colore
 * nuovo. `description` ripete alla lettera la meta description della home
 * (vedi `page.js`), per coerenza fra le due superfici che l'utente vede.
 */
export function renderManifest() {
  const manifest = {
    name: "ArtiPop",
    short_name: "ArtiPop",
    description:
      "Wallpaper AI gratuiti per iPhone che evolvono giorno per giorno. Nessuna app: solo una Shortcut.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0b10",
    theme_color: "#0a0b10",
    icons: [
      {
        src: "/icona.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any maskable",
      },
    ],
    // feat-l-icona-installata-apre-anche-archivi-e-aiuto: le uniche due rotte
    // pubbliche di lettura diverse da `start_url` (`/`). Niente `icons` per
    // voce: l'unica icona disegnata è già quella del manifest, ripeterla qui
    // non distingue nulla. `url` restano relative per non rompere preview/
    // production (dominio diverso a runtime).
    shortcuts: [
      {
        name: "Archivi storici",
        short_name: "Archivi",
        url: "/archivi",
      },
      {
        name: "Aiuto",
        short_name: "Aiuto",
        url: "/aiuto",
      },
    ],
  };
  return JSON.stringify(manifest);
}
