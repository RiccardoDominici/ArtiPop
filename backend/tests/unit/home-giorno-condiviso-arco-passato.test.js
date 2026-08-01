// feat-il-link-condiviso-apre-il-giorno-anche-di-un-arco-passato: un link
// condiviso (/?c=<canale>&d=<data>) deve aprire davvero quel giorno anche
// quando appartiene a un arco già chiuso, non solo quando cade nella
// finestra sfogliabile corrente — e se il giorno non è in archivio lo dice
// invece di tacere. Test puro su renderPage() — nessun binding, nessuna rete,
// sullo stile statico di home-scegli-arco.test.js / home-arco-precedente.test.js.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function extractFn(name) {
  return html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`))[0];
}

describe("home — link condiviso che apre un giorno di un arco passato", () => {
  it("goToArc accetta un terzo parametro opzionale dataTarget", () => {
    const fnBody = extractFn("goToArc");
    expect(fnBody).toMatch(/function goToArc\(chId, idx, dataTarget = null\)/);
  });

  it("goToArc si posiziona sulla data richiesta quando appartiene all'arco di destinazione", () => {
    const fnBody = extractFn("goToArc");
    expect(fnBody).toMatch(/dataTarget && dates\.includes\(dataTarget\)/);
    expect(fnBody).toContain("? dataTarget");
  });

  it("goToArc senza terzo parametro resta 'oggi o il più recente', comportamento invariato", () => {
    const fnBody = extractFn("goToArc");
    expect(fnBody).toContain('dates.includes(TODAY) ? TODAY : dates[0]');
  });

  it("renderJourney cerca l'arco che contiene pendingSharedDate in arcsCache prima di rinunciare", () => {
    const fnBody = extractFn("renderJourney");
    expect(fnBody).toMatch(/arcs\.findIndex\(\(arc\) => arc\.includes\(pendingSharedDate\)\)/);
    expect(fnBody).toMatch(/goToArc\(chId, arcIdx, d\)/);
  });

  it("il ramo giorno fuori finestra azzera pendingSharedDate e non fa autoplay (return subito dopo goToArc)", () => {
    const fnBody = extractFn("renderJourney");
    const branch = fnBody.match(/if \(pendingSharedDate\) \{[\s\S]*?\n  \}/)[0];
    expect(branch).toContain("pendingSharedDate = null");
    expect(branch).toMatch(/goToArc\(chId, arcIdx, d\);\s*\n\s*return;/);
  });

  it("il ramo 'giorno non in archivio' chiama toast con un messaggio non vuoto e azzera pendingSharedDate", () => {
    const fnBody = extractFn("renderJourney");
    expect(fnBody).toMatch(/toast\("[^"]+"\)/);
    const toastCall = fnBody.match(/toast\("([^"]+)"\)/)[1];
    expect(toastCall.length).toBeGreaterThan(0);
    // pendingSharedDate azzerato anche in questo ramo, prima della chiamata a toast.
    const afterArcSearch = fnBody.slice(fnBody.indexOf("arcIdx !== -1"));
    expect(afterArcSearch).toMatch(/pendingSharedDate = null;\s*\n\s*toast\(/);
  });

  it("il ramo 'giorno non in archivio' non innesca un loop: dopo toast prosegue con l'autoplay esistente, non un return isolato", () => {
    const fnBody = extractFn("renderJourney");
    const idx = fnBody.indexOf('toast("');
    const after = fnBody.slice(idx);
    expect(after).toContain("if (!playing && !prefersStill) startPlayback();");
  });

  it("il ramo esistente (giorno dell'arco in corso) resta invariato: nessun autoplay, previewDay diretto", () => {
    const fnBody = extractFn("renderJourney");
    expect(fnBody).toMatch(/if \(pendingSharedDate && dates\.includes\(pendingSharedDate\)\) \{\s*\n\s*const d = pendingSharedDate;\s*\n\s*pendingSharedDate = null;\s*\n\s*previewDay\(chId, d, d === TODAY\);\s*\n\s*return;\s*\n\s*\}/);
  });
});
