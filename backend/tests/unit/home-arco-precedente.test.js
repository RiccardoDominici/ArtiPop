// feat-rivedi-l-arco-precedente: dalla home si deve poter tornare a vedere
// l'arco (settimana/concept) precedente, riusando le date già scaricate da
// /api/archive/<canale>?limit=30 — nessuna fetch nuova. Test puro su
// renderPage() — nessun binding, nessuna rete. La logica di raggruppamento
// (computeArcs) è pura e viene anche eseguita davvero, estraendola dallo
// script renderizzato, per verificarne il comportamento e non solo la forma.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function extractFn(name) {
  const src = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))[0];
  return new Function(`return (${src});`)();
}

describe("home — comando 'arco precedente'", () => {
  it("il markup espone il bottone #arcprev sotto #daynav, pill ghost già canonica, inizialmente nascosto", () => {
    const journeyMatch = html.match(/<section class="journey">[\s\S]*?<\/section>/);
    expect(journeyMatch).not.toBeNull();
    const journey = journeyMatch[0];
    const daynavIdx = journey.indexOf('id="daynav"');
    const arcprevIdx = journey.indexOf('id="arcprev"');
    expect(daynavIdx).toBeGreaterThan(-1);
    expect(arcprevIdx).toBeGreaterThan(daynavIdx); // sotto il day-nav, non sopra
    const btnTag = journey.match(/<button class="btn ghost" id="arcprev"[^>]*>/)[0];
    expect(btnTag).toContain("hidden");
  });

  it("nessuna fetch nuova: computeArcs e la navigazione tra archi lavorano solo su dati già scaricati", () => {
    const fetches = html.match(/fetch\(/g) || [];
    expect(fetches.length).toBe(1);
    expect(html).toContain("/api/archive/${chId}?limit=30");
  });

  describe("computeArcs — raggruppamento per conceptNome", () => {
    const computeArcs = extractFn("computeArcs");

    it("archivio con due archi: la funzione trova due blocchi contigui, senza mescolare le date", () => {
      const dates = [
        "2026-08-01", "2026-07-31", "2026-07-30", "2026-07-29", // arco corrente (Cactus)
        "2026-07-28", "2026-07-27", "2026-07-26", "2026-07-25", "2026-07-24", // arco precedente (Isola)
      ];
      const cap = {};
      for (const d of dates.slice(0, 4)) cap[d] = { conceptNome: "Cactus" };
      for (const d of dates.slice(4)) cap[d] = { conceptNome: "Isola" };

      const arcs = computeArcs(dates, cap);
      expect(arcs.length).toBe(2);
      expect(arcs[0]).toEqual(dates.slice(0, 4));
      expect(arcs[1]).toEqual(dates.slice(4));
      // Nessuna data duplicata o persa fra i due archi.
      expect(arcs.flat()).toEqual(dates);
    });

    it("archivio con un solo arco: un solo blocco con tutte le date", () => {
      const dates = ["2026-08-01", "2026-07-31", "2026-07-30"];
      const cap = {};
      for (const d of dates) cap[d] = { conceptNome: "Cactus" };
      const arcs = computeArcs(dates, cap);
      expect(arcs.length).toBe(1);
      expect(arcs[0]).toEqual(dates);
    });

    it("giorno senza dati narrativi in mezzo a un arco non lo spezza in due", () => {
      const dates = ["2026-08-01", "2026-07-31", "2026-07-30", "2026-07-29"];
      const cap = {
        "2026-08-01": { conceptNome: "Cactus" },
        "2026-07-31": { conceptNome: "Cactus" },
        // "2026-07-30" manca: giorno ricostruito, nessun conceptNome
        "2026-07-29": { conceptNome: "Cactus" },
      };
      const arcs = computeArcs(dates, cap);
      expect(arcs.length).toBe(1);
      expect(arcs[0]).toEqual(dates);
    });

    it("il giorno senza dati narrativi non apre comunque un arco nuovo quando precede un cambio di concept", () => {
      const dates = ["2026-08-01", "2026-07-31", "2026-07-30", "2026-07-29"];
      const cap = {
        "2026-08-01": { conceptNome: "Cactus" },
        // "2026-07-31" manca: resta nel blocco Cactus, non anticipa Isola
        "2026-07-30": { conceptNome: "Isola" },
        "2026-07-29": { conceptNome: "Isola" },
      };
      const arcs = computeArcs(dates, cap);
      expect(arcs.length).toBe(2);
      expect(arcs[0]).toEqual(["2026-08-01", "2026-07-31"]);
      expect(arcs[1]).toEqual(["2026-07-30", "2026-07-29"]);
    });
  });

  it("loadArchive calcola fullArchiveCache/arcsCache dall'archivio intero, prima dello slice sulla finestra corrente", () => {
    const fnBody = html.match(/async function loadArchive\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("fullArchiveCache[chId] = dates");
    expect(fnBody).toContain("arcsCache[chId] = computeArcs(dates, cap)");
    // fullArchiveCache/arcsCache sono calcolati PRIMA dello slice sulla finestra dell'arco corrente.
    expect(fnBody.indexOf("arcsCache[chId] = computeArcs")).toBeLessThan(
      fnBody.indexOf("dates = dates.slice(0, ch.giorno)")
    );
    expect(fnBody).toContain("arcIndexCache[chId] = 0");
  });

  it("updateArcNav mostra 'arco precedente' solo se esiste un arco più vecchio oltre l'indice corrente", () => {
    const fnBody = html.match(/function updateArcNav\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("arcPrevEl.hidden = idx >= arcs.length - 1");
  });

  it("renderJourney aggiorna la visibilità dei comandi ad ogni render", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("updateArcNav(chId)");
  });

  it("goToPreviousArc sostituisce la finestra con l'arco precedente, mai unendola alla corrente, e mostra il giorno più recente del nuovo arco", () => {
    const fnBody = html.match(/function goToPreviousArc\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("archiveCache[chId] = arcs[idx + 1]");
    // Mai una fusione fra l'arco corrente e quello precedente.
    expect(fnBody).not.toMatch(/archiveCache\[chId\]\.concat/);
    expect(fnBody).not.toMatch(/\.\.\.archiveCache\[chId\]/);
    expect(fnBody).toContain("stopPlayback()");
    expect(fnBody).toContain("previewDay(chId, d, d === TODAY)");
    expect(html).toContain('arcPrevEl.addEventListener("click", goToPreviousArc)');
  });
});
