// feat-il-giorno-d-archivio-si-sfoglia-con-la-tastiera: ←/→ e Home/Fine
// seguono i link precedente/successivo/estremo già presenti nel markup della
// pagina di un giorno d'archivio, con le stesse guardie di robustezza della
// navigazione da tastiera della home (feat-sfoglia-il-viaggio-con-la-tastiera).
import { describe, it, expect } from "vitest";
import { renderGiornoArchivio } from "../../src/archivi.js";

const DATE = ["2025-01-03", "2025-01-02", "2025-01-01"];

const blocco = (html) => html.match(/<script>[\s\S]*?<\/script>/)[0];

describe("renderGiornoArchivio — scorciatoie da tastiera", () => {
  it("un solo <script>, con addEventListener(\"keydown\" e i quattro tasti", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect((html.match(/<script/g) || []).length).toBe(1);
    const script = blocco(html);
    expect(script).toContain('addEventListener("keydown"');
    expect(script).toContain("ArrowLeft");
    expect(script).toContain("ArrowRight");
    expect(script).toContain("Home");
    expect(script).toContain("End");
  });

  it("i selettori dello script combaciano col markup emesso (nessun selettore orfano)", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);
    const nav = html.match(/<nav class="giorni-nav"[\s\S]*?<\/nav>/)[0];

    const ATTESI = [
      { tasto: "ArrowLeft", selettore: "a.precedente", markup: 'class="precedente"' },
      { tasto: "ArrowRight", selettore: "a.successivo", markup: 'class="successivo"' },
      { tasto: "Home", selettore: 'a.estremo[data-nav="primo"]', markup: 'data-nav="primo"' },
      { tasto: "End", selettore: 'a.estremo[data-nav="ultimo"]', markup: 'data-nav="ultimo"' },
    ];
    for (const { tasto, selettore, markup } of ATTESI) {
      expect(script).toContain(tasto);
      expect(script).toContain(selettore);
      expect(nav).toContain(markup);
    }

    // verso opposto: nessun selettore CSS (fra i valori mappati sui tasti) che non
    // abbia riscontro nel markup — cerca solo dentro stringhe fra virgolette, non
    // negli accessi a proprietà come `a.href`.
    const selettoriUsati = script.match(/["']a\.[a-z]+(?:\[[^\]]+\])?["']/g).map((s) => s.slice(1, -1));
    expect(selettoriUsati.length).toBeGreaterThan(0);
    for (const sel of selettoriUsati) {
      const classe = sel.match(/^a\.([a-z]+)/)[1];
      expect(nav).toContain(`class="${classe}"`);
      const attr = sel.match(/\[([a-z-]+)="([^"]+)"\]/);
      if (attr) {
        expect(nav).toContain(`${attr[1]}="${attr[2]}"`);
      }
    }

    // i link puntano alle date giuste: Home → più vecchia, End → più recente
    expect(nav).toContain('data-nav="primo" aria-label="Vai al primo giorno dell\'archivio di island, 2025-01-01"');
    expect(nav).toContain('href="/archivi/island?date=2025-01-01" data-nav="primo"');
    expect(nav).toContain('href="/archivi/island?date=2025-01-03" data-nav="ultimo"');
  });

  it("guardie: modificatori, campi di testo, e preventDefault solo dopo il controllo sul link", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    const script = blocco(html);
    expect(script).toContain("metaKey");
    expect(script).toContain("ctrlKey");
    expect(script).toContain("altKey");
    expect(script).toContain("isContentEditable");
    expect(script).toContain('"input"');
    expect(script).toContain('"textarea"');
    expect(script).toContain('"select"');
    expect(script.indexOf("preventDefault")).toBeGreaterThan(script.indexOf("querySelector"));
  });

  it("archivio di un solo giorno: nessun errore, nessun link prec/succ/estremo, script comunque ben formato", () => {
    const config = { id: "bloom", data: "2025-02-01", date: ["2025-02-01"] };
    expect(() => renderGiornoArchivio(config)).not.toThrow();
    const html = renderGiornoArchivio(config);
    expect(html).not.toContain('class="precedente"');
    expect(html).not.toContain('class="successivo"');
    expect(html).not.toContain('class="estremo"');
    expect((html.match(/<script>/g) || []).length).toBe(1);
    expect((html.match(/<\/script>/g) || []).length).toBe(1);
    expect(blocco(html)).toBe(blocco(renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE })));
  });

  it("date vuote o assenti: pagina renderizzata senza errori, script identico", () => {
    expect(() =>
      renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: [] }),
    ).not.toThrow();
    expect(() =>
      renderGiornoArchivio({ id: "bloom", data: "2025-02-01" }),
    ).not.toThrow();
    const htmlVuoto = renderGiornoArchivio({ id: "bloom", data: "2025-02-01", date: [] });
    const htmlAssente = renderGiornoArchivio({ id: "bloom", data: "2025-02-01" });
    const riferimento = blocco(renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE }));
    expect(blocco(htmlVuoto)).toBe(riferimento);
    expect(blocco(htmlAssente)).toBe(riferimento);
  });

  it("contratto §2.2: nessuna fetch(, nessun gestore inline, script statico anche con id/data ostili", () => {
    const html = renderGiornoArchivio({ id: "island", data: "2025-01-02", date: DATE });
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onkeydown");

    const htmlOstile = renderGiornoArchivio({
      id: '<b>x',
      data: '2025-01-01"><script>alert(1)</script>',
      date: DATE,
    });
    expect(blocco(htmlOstile)).toBe(blocco(html));
    expect(htmlOstile).not.toContain("<script>alert(1)</script>");
  });
});
