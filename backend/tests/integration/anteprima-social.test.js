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

// feat-l-anteprima-del-link-condiviso-mostra-quel-giorno: il link per-giorno
// (?c=<canale>&d=<data>, ciclo 48) esisteva già lato client — qui si copre la
// rotta intera, con la validazione che riporta al comportamento di oggi
// appena un parametro non torna.
describe("anteprima social con link per-giorno condiviso (/?c=&d=)", () => {
  it("GET /?c=citta&d=<data valida passata> mostra l'anteprima di quel giorno", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/?c=citta&d=2026-07-28");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/citta?date=2026-07-28`);
    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/?c=citta&d=2026-07-28`);
  });

  it("GET /?c=inesistente&d=2026-07-28 ricade sui tag di oggi, mai un 4xx/5xx", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/?c=inesistente&d=2026-07-28");
    const html = await res.text();

    expect(res.status).toBe(200);
    const oggi = todayKey();
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?v=${oggi}`);
    expect(estraiMeta(html, "og:url")).toBe(ORIGIN);
    expect(html).not.toContain("inesistente");
  });

  it("GET /?c=citta&d=non-una-data ricade sui tag di oggi", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/?c=citta&d=non-una-data");
    const html = await res.text();

    expect(res.status).toBe(200);
    const oggi = todayKey();
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?v=${oggi}`);
    expect(html).not.toContain("non-una-data");
  });

  it("GET /?c=citta&d=<data futura> ricade sui tag di oggi", async () => {
    const env = makeEnv();
    const futura = "2999-01-01";
    const res = await callWorker(env, `/?c=citta&d=${futura}`);
    const html = await res.text();

    expect(res.status).toBe(200);
    const oggi = todayKey();
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/natura?v=${oggi}`);
    expect(html).not.toContain(futura);
  });

  // feat-i-vecchi-indirizzi-aprono-il-canale-erede: un alias storico (island →
  // natura) deve produrre l'anteprima come un canale attivo, ma l'og:image
  // continua a leggere l'archivio dell'id RICHIESTO (island), non dell'erede.
  it("GET /?c=island&d=<data valida passata> mostra l'anteprima dell'archivio storico di island", async () => {
    const env = makeEnv();
    const res = await callWorker(env, "/?c=island&d=2026-07-28");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(estraiMeta(html, "og:image")).toBe(`${ORIGIN}/w/island?date=2026-07-28`);
    expect(estraiMeta(html, "og:url")).toBe(`${ORIGIN}/?c=island&d=2026-07-28`);
  });
});
