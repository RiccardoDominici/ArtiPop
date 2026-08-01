// feat-copia-l-indirizzo-del-canale: la home deve offrire un bottone che
// copia l'indirizzo stabile del canale in cima (senza query string), quello
// da incollare nell'azione "Ottieni contenuto da URL" quando la Shortcut si
// crea a mano. Test puro su renderPage() — nessun binding, nessuna rete.
import { describe, it, expect } from "vitest";
import { renderPage } from "../../src/page.js";

describe("home — copia l'indirizzo del canale", () => {
  const html = renderPage({}, "https://example.com", "2026-08-01");

  it("il markup espone il bottone #copyurl, pill ghost, dentro .actions", () => {
    const actionsMatch = html.match(/<div class="actions">[\s\S]*?<\/div>/);
    expect(actionsMatch).not.toBeNull();
    const actions = actionsMatch[0];
    expect(actions).toMatch(
      /<button class="btn ghost" id="copyurl">copia l'indirizzo del canale<\/button>/,
    );
  });

  it("copyChannelUrl compone <origin>/w/<canale in cima> senza query string", () => {
    const fnBody = html.match(/async function copyChannelUrl\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain('ORIGIN + "/w/" + chId');
    expect(fnBody).toContain("CHANNELS[order[0]].id");
    expect(fnBody).not.toMatch(/\?date=|\?v=/);
  });

  it("l'handler è agganciato al bottone #copyurl", () => {
    expect(html).toContain('copyurlEl.addEventListener("click", copyChannelUrl)');
  });

  it("se la clipboard non è disponibile o rifiuta, mostra l'indirizzo in chiaro nel toast — mai un errore non gestito", () => {
    const fnBody = html.match(/async function copyChannelUrl\([\s\S]*?\n\}/)[0];
    expect(fnBody).toMatch(/catch\s*\{/);
    expect(fnBody).toContain("toast(link)");
    expect(fnBody).not.toMatch(/alert\(/);
  });

  it("la copia condivisa (copiaNegliAppunti) è un'unica funzione: un solo blocco writeText in tutto page.js", () => {
    const writeTextCalls = html.match(/navigator\.clipboard\.writeText\(/g) || [];
    expect(writeTextCalls.length).toBe(1);
    expect(html).toMatch(/async function copiaNegliAppunti\(link\)/);
    const fnBody = html.match(/async function copyChannelUrl\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("await copiaNegliAppunti(link)");
  });

  it("in cardHTML non resta la variabile url morta (rimossa, non più usata)", () => {
    const fnBody = html.match(/function cardHTML\(ch\)[\s\S]*?\n\}/)[0];
    expect(fnBody).not.toContain('const url = ORIGIN + "/w/" + ch.id');
  });
});
