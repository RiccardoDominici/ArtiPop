// feat-i-vecchi-indirizzi-aprono-il-canale-erede: un link con un vecchio nome
// di canale (island, bloom, studio, neon, …) deve aprire la home sul flusso
// che ne ha ereditato le storie, invece di essere ignorato come un canale
// sconosciuto. Puro su renderPage — il blocco di risoluzione gira lato
// client, quindi qui si verifica lo script iniettato, non un DOM eseguito
// (vedi anteprima-social.test.js per la copertura end-to-end sull'og:image).
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";
import { LEGACY_ALIASES } from "../../src/channels.js";

const ORIGIN = "https://artipop.test";
const OGGI = "2026-07-30";

function estraiScript(html) {
  const m = html.match(/<script>\n"use strict";([\s\S]*?)<\/script>/);
  return m[1];
}

describe("renderPage: mappa degli alias storici iniettata nello script", () => {
  const script = estraiScript(renderPage({}, ORIGIN, OGGI));

  it("dichiara ALIAS con gli alias storici noti (island, neon, …)", () => {
    expect(script).toMatch(/const ALIAS = /);
    for (const [alias, erede] of Object.entries(LEGACY_ALIASES)) {
      expect(script).toContain(`"${alias}":"${erede}"`);
    }
  });

  it("island e neon sono presenti nella mappa (Shortcut storiche e canale mai distribuito)", () => {
    expect(LEGACY_ALIASES.island).toBeDefined();
    expect(LEGACY_ALIASES.neon).toBeDefined();
    expect(script).toContain('"island":"natura"');
    expect(script).toContain('"neon":"citta"');
  });
});

describe("renderPage: blocco di risoluzione di ?c= tenta l'alias prima di rinunciare", () => {
  const script = estraiScript(renderPage({}, ORIGIN, OGGI));

  it("cerca prima un flusso attivo per id esatto, poi ALIAS[sharedChannelId] solo se non trovato", () => {
    const blocco = script.match(/if \(sharedChannelId\) \{[\s\S]*?\n\}/)[0];
    expect(blocco).toContain("CHANNELS.findIndex((c) => c.id === sharedChannelId)");
    expect(blocco).toContain("ALIAS[sharedChannelId]");
    // La traduzione via alias avviene solo quando la ricerca diretta fallisce.
    expect(blocco).toMatch(/idx === -1 && ALIAS\[sharedChannelId\]/);
  });

  it("pendingSharedDate = null resta solo sul ramo in cui idx è ancora -1 dopo il tentativo di alias", () => {
    const blocco = script.match(/if \(sharedChannelId\) \{[\s\S]*?\n\}/)[0];
    const rami = blocco.split("if (idx !== -1)");
    expect(rami.length).toBe(2);
    expect(rami[1]).toContain("pendingSharedDate = null");
  });
});
