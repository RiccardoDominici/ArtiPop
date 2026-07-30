// Protegge channels.js sul punto più delicato: gli alias storici. Le
// Shortcut già installate sugli iPhone puntano a /w/island, /w/bloom,
// /w/studio — se resolveChannel smettesse di instradarli sul flusso giusto,
// installazioni che non possiamo più aggiornare smetterebbero di funzionare.
import { describe, it, expect } from "vitest";
import { resolveChannel, requireActiveChannel, CHANNELS } from "../../src/channels.js";

describe("resolveChannel", () => {
  it("risolve un id diretto senza passare per un alias", () => {
    const { channel, isLegacy, requestedId } = resolveChannel("natura");
    expect(channel?.id).toBe("natura");
    expect(isLegacy).toBe(false);
    expect(requestedId).toBe("natura");
  });

  it.each([
    ["island", "natura"],
    ["bloom", "natura"],
    ["studio", "quiete"],
  ])("instrada l'alias storico '%s' sul flusso '%s' che ne ha raccolto l'eredità", (alias, atteso) => {
    const { channel, isLegacy, requestedId } = resolveChannel(alias);
    expect(channel?.id).toBe(atteso);
    expect(isLegacy).toBe(true);
    expect(requestedId).toBe(alias);
  });

  it("torna undefined per un id che non è né un flusso né un alias noto", () => {
    const { channel, isLegacy, requestedId } = resolveChannel("questo-flusso-non-esiste");
    expect(channel).toBeUndefined();
    expect(isLegacy).toBe(false);
    expect(requestedId).toBe("questo-flusso-non-esiste");
  });
});

describe("requireActiveChannel", () => {
  it("ritorna il flusso attivo per un id diretto", () => {
    const ch = requireActiveChannel("natura");
    expect(ch.id).toBe("natura");
    expect(ch.active).toBe(true);
  });

  it("segue l'alias storico e ritorna il flusso attivo che ne ha raccolto l'eredità", () => {
    // /run/island (rotte che GENERANO) deve funzionare esattamente come
    // /run/natura: prima del fix chiamava getChannel() diretto e falliva.
    const ch = requireActiveChannel("island");
    expect(ch.id).toBe("natura");
  });

  it("lancia un errore parlante per un canale inesistente", () => {
    expect(() => requireActiveChannel("canale-fantasma")).toThrow(
      "flusso sconosciuto: canale-fantasma"
    );
  });

  it("tutti i flussi dichiarati sono attualmente attivi (precondizione di questa suite)", () => {
    // Non possiamo collaudare il ramo 'flusso in pausa' senza un flusso
    // active:false nella configurazione reale: qui verifichiamo solo che
    // l'assunzione (nessun flusso in pausa oggi) resti vera nel tempo.
    expect(CHANNELS.every((c) => c.active)).toBe(true);
  });
});
