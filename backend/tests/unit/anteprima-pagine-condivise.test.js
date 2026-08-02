// feat-condividere-aiuto-e-archivi-mostra-l-anteprima: chi manda il link di
// /aiuto o /archivi vedeva un'anteprima nuda, perché solo la home aveva i
// tag Open Graph. Puro su renderArchiviPage/renderHelpPage/metaAnteprima,
// nessun binding — vedi anteprima-social.test.js per la copertura end-to-end
// sulle rotte.
import { describe, it, expect } from "vitest";
import { renderArchiviPage, renderGiornoArchivio } from "../../src/archivi.js";
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

    expect(estraiMeta(html, "og:title")).toContain("archivi");
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

  it("con condiviso E percorso, og:url segue percorso e og:image segue condiviso (componibili)", () => {
    const condiviso = { canale: "natura", data: "2026-06-01" };
    const html = metaAnteprima(ORIGIN, OGGI, "Titolo", "Descrizione", condiviso, "/archivi/natura?date=2026-06-01");

    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/archivi/natura?date=2026-06-01`);
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?date=2026-06-01`);
  });

  it("solo condiviso (senza percorso, caso home) non cambia: og:url resta /?c=&d=", () => {
    const condiviso = { canale: "natura", data: "2026-06-01" };
    const html = metaAnteprima(ORIGIN, OGGI, "Titolo", "Descrizione", condiviso);

    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/?c=natura&d=2026-06-01`);
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?date=2026-06-01`);
  });
});

describe("renderGiornoArchivio: anteprima social", () => {
  const BASE = { id: "natura", data: "2026-06-01", date: ["2026-06-02", "2026-06-01", "2026-05-31"] };

  it("con origin espone og:image sul wallpaper di quel giorno e og:url sul percorso della pagina", () => {
    const html = renderGiornoArchivio({ ...BASE, origin: ORIGIN });

    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?date=2026-06-01`);
    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/archivi/natura?date=2026-06-01`);
  });

  it("senza origin non emette alcun tag og:", () => {
    const html = renderGiornoArchivio(BASE);

    expect(html).not.toContain("og:");
  });

  it("l'HTML della pagina giorno resta senza <script>", () => {
    const html = renderGiornoArchivio({ ...BASE, origin: ORIGIN });

    expect(html).not.toContain("<script");
  });
});
