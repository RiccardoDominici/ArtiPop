// s-anteprima-e-icona-quando-il-link-viene-condiviso: quando il link di
// ArtiPop arriva su iMessage/WhatsApp/Telegram deve mostrare titolo,
// descrizione, immagine e icona — non un URL nudo. Copre solo `<head>`,
// nessuna resa visiva da toccare in visual-check.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { todayKey } from "../../src/story.js";

const ORIGIN = "https://artipop.test";
const COLORI_AMMESSI = ["#0a0b10", "#7ec8a9", "#f2b878"];

function estraiHref(html, rel) {
  const m = html.match(new RegExp(`<link rel="${rel}" href="([^"]+)"`));
  return m ? m[1] : null;
}

function estraiMeta(html, prop) {
  const re = new RegExp(
    `<meta (?:property|name)="${prop}" content="([^"]*)"`
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

describe("icona (rel=icon) sulle pagine pubbliche", () => {
  it("GET / dichiara un'icona SVG inline coi soli colori della palette", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/");
    const html = await res.text();

    const href = estraiHref(html, "icon");
    expect(href).toMatch(/^data:image\/svg\+xml,/);

    const decoded = decodeURIComponent(href.slice("data:image/svg+xml,".length));
    const esadecimali = decoded.match(/#[0-9a-fA-F]{6}/g) || [];
    for (const colore of esadecimali) {
      expect(COLORI_AMMESSI).toContain(colore.toLowerCase());
    }
  });

  it("/aiuto dichiara l'icona e NON tag og:", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/aiuto");
    const html = await res.text();

    expect(estraiHref(html, "icon")).toMatch(/^data:image\/svg\+xml,/);
    expect(html).not.toContain("og:");
  });

  it("la pagina 'Shortcut non disponibile' dichiara l'icona e NON tag og:", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/s/natura.shortcut");
    const html = await res.text();

    expect(res.status).toBe(404);
    expect(estraiHref(html, "icon")).toMatch(/^data:image\/svg\+xml,/);
    expect(html).not.toContain("og:");
  });
});

describe("anteprima social (Open Graph / Twitter Card) su /", () => {
  it("GET / espone tutti i tag richiesti con og:url e og:image assoluti", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/");
    const html = await res.text();

    expect(estraiMeta(html, "og:type")).toBe("website");
    expect(estraiMeta(html, "og:site_name")).toBe("ArtiPop");
    expect(estraiMeta(html, "og:title")).toBeTruthy();
    expect(estraiMeta(html, "og:description")).toBeTruthy();
    expect(estraiMeta(html, "og:url")).toBe(ORIGIN);
    expect(estraiMeta(html, "og:image")).toMatch(new RegExp(`^${ORIGIN}/`));
    expect(estraiMeta(html, "twitter:card")).toBe("summary");
  });

  it("og:image punta a /w/natura?v=<oggi> e twitter:card è esattamente 'summary'", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/");
    const html = await res.text();

    const oggi = todayKey();
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?v=${oggi}`);
    expect(estraiMeta(html, "twitter:card")).toBe("summary");
  });

  it("og:title e og:description coincidono carattere per carattere con title/description della pagina", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/");
    const html = await res.text();

    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const description = estraiMeta(html, "description");

    expect(estraiMeta(html, "og:title")).toBe(title);
    expect(estraiMeta(html, "og:description")).toBe(description);
  });
});
