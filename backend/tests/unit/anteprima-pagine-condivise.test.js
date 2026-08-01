// feat-condividere-aiuto-e-archivi-mostra-l-anteprima: chi manda il link di
// /aiuto o /archivi vedeva un'anteprima nuda, perché solo la home aveva i
// tag Open Graph. Puro su renderArchiviPage/renderHelpPage/metaAnteprima,
// nessun binding — vedi anteprima-social.test.js per la copertura end-to-end
// sulle rotte.
import { describe, it, expect } from "vitest";
import { renderArchiviPage } from "../../src/archivi.js";
import { renderHelpPage } from "../../src/help.js";
import { metaAnteprima, FAVICON_TAG } from "../../src/head.js";

const ORIGIN = "https://artipop.example";
const OGGI = "2026-08-01";

function estraiMeta(html, prop) {
  const re = new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : null;
}

describe("renderArchiviPage: anteprima social", () => {
  it("con origin e dataOggi espone i tag og: coerenti col title/description della pagina", () => {
    const html = renderArchiviPage([], ORIGIN, OGGI);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const description = estraiMeta(html, "description");

    expect(estraiMeta(html, "og:title")).toContain("archivi storici");
    expect(estraiMeta(html, "og:title")).toBe(title);
    expect(estraiMeta(html, "og:description")).toBe(description);
    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/archivi`);
    expect(estraiMeta(html, "og:image")).toMatch(new RegExp(`^${ORIGIN}/w/natura`));
    expect(estraiMeta(html, "twitter:card")).toBe("summary");
  });

  it("senza origin (chiamata legacy) resta una pagina valida senza tag og:, con l'icona", () => {
    const html = renderArchiviPage([]);

    expect(html).not.toContain("og:");
    expect(html).toContain(FAVICON_TAG);
  });
});

describe("renderHelpPage: anteprima social", () => {
  it("con origin e dataOggi espone i tag og: coerenti col title/description della pagina", () => {
    const html = renderHelpPage(null, ORIGIN, OGGI);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const description = estraiMeta(html, "description");

    expect(estraiMeta(html, "og:title")).toBe(title);
    expect(estraiMeta(html, "og:description")).toBe(description);
    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/aiuto`);
    expect(estraiMeta(html, "og:image")).toMatch(new RegExp(`^${ORIGIN}/w/natura`));
    expect(estraiMeta(html, "twitter:card")).toBe("summary");
  });

  it("senza origin (chiamata legacy) resta una pagina valida senza tag og:, con l'icona", () => {
    const html = renderHelpPage();

    expect(html).not.toContain("og:");
    expect(html).toContain(FAVICON_TAG);
  });
});

describe("metaAnteprima: retrocompatibilità del parametro percorso", () => {
  it("senza percorso produce ancora og:url = origin (la home non regredisce)", () => {
    const html = metaAnteprima(ORIGIN, OGGI, "Titolo", "Descrizione");

    expect(estraiMeta(html, "og:url")).toBe(ORIGIN);
  });

  it("con percorso produce og:url = origin + percorso", () => {
    const html = metaAnteprima(ORIGIN, OGGI, "Titolo", "Descrizione", null, "/aiuto");

    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/aiuto`);
  });
});
