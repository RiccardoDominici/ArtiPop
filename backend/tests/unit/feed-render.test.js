// feat-segui-il-canale-dal-lettore-di-feed: renderFeed compone RSS 2.0 a
// mano, senza rete né KV — stesso stile di archivi-copertina.test.js per
// renderElenco. Copre CRITERI 1-3 del piano.
import { describe, it, expect } from "vitest";
import { renderFeed } from "../../src/feed.js";

const CANALE = { id: "natura", name: "Natura", tagline: "Cose che nascono e si costruiscono" };

describe("renderFeed", () => {
  it("apre con la dichiarazione XML e un solo <channel>", () => {
    const xml = renderFeed({ canale: CANALE, voci: [], origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml.match(/<channel>/g)).toHaveLength(1);
  });

  it("escapa & e < in un titolo con caratteri speciali", () => {
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita & Rovine", elementNome: "<felce>" }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("Crescita &amp; Rovine");
    expect(xml).toContain("&lt;felce&gt;");
    expect(xml).not.toMatch(/<title>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("voce senza concept/element: titolo-data e enclosure comunque presenti", () => {
    const voci = [{ data: "2026-07-30", conceptNome: null, elementNome: null }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<title>2026-07-30</title>");
    expect(xml).toContain('<enclosure url="https://artipop.test/w/natura?date=2026-07-30" type="image/png" />');
  });

  it("pubDate in formato RFC 822", () => {
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce" }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    const pubDate = xml.match(/<pubDate>([^<]+)<\/pubDate>/)[1];
    expect(pubDate).toMatch(/^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
  });

  it("un <item> per voce", () => {
    const voci = [
      { data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce" },
      { data: "2026-07-31", conceptNome: "Crescita", elementNome: "Cactus" },
      { data: "2026-07-30", conceptNome: null, elementNome: null },
    ];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml.match(/<item>/g)).toHaveLength(3);
  });

  it("guid e link puntano a /?c=<id>&d=<data>, con & escapato", () => {
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce" }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<link>https://artipop.test/?c=natura&amp;d=2026-08-01</link>");
    expect(xml).toContain('<guid isPermaLink="false">https://artipop.test/?c=natura&amp;d=2026-08-01</guid>');
  });
});

// feat-un-solo-feed-per-tutti-i-canali: estensione di renderFeed per voci
// con canaleNome/canaleId propri, che alimenta il feed aggregato /feed.xml
// senza toccare il comportamento del feed per canale singolo.
describe("renderFeed — voci con canale proprio (feed aggregato)", () => {
  const AGGREGATO = { id: "", name: "tutti i canali", tagline: "Tutti i canali di ArtiPop in un solo feed." };

  it("regressione: una voce senza canaleNome/canaleId produce esattamente lo stesso item di oggi", () => {
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce" }];
    const conCanaleAggregato = renderFeed({ canale: { ...CANALE, id: CANALE.id }, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    const senzaCampiCanale = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    const itemA = conCanaleAggregato.match(/<item>[\s\S]*?<\/item>/)[0];
    const itemB = senzaCampiCanale.match(/<item>[\s\S]*?<\/item>/)[0];
    expect(itemA).toBe(itemB);
  });

  it("una voce con canaleNome/canaleId mette il nome del canale nel titolo e usa il canaleId proprio in link/guid/enclosure", () => {
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce", canaleNome: "Natura", canaleId: "natura" }];
    const xml = renderFeed({ canale: AGGREGATO, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<title>Natura — 2026-08-01 — Crescita · Felce</title>");
    expect(xml).toContain("<link>https://artipop.test/?c=natura&amp;d=2026-08-01</link>");
    expect(xml).toContain('<guid isPermaLink="false">https://artipop.test/?c=natura&amp;d=2026-08-01</guid>');
    expect(xml).toContain('<enclosure url="https://artipop.test/w/natura?date=2026-08-01" type="image/png" />');
  });

  it("nome di canale con & e < viene escapato nel titolo", () => {
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce", canaleNome: "A & B <C>", canaleId: "natura" }];
    const xml = renderFeed({ canale: AGGREGATO, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<title>A &amp; B &lt;C&gt; — 2026-08-01 — Crescita · Felce</title>");
  });

  it("il feed aggregato senza voci resta XML ben formato con <channel> e zero <item>", () => {
    const xml = renderFeed({ canale: AGGREGATO, voci: [], origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml.match(/<channel>/g)).toHaveLength(1);
    expect(xml.match(/<item>/g)).toBeNull();
    expect(xml).toContain('<atom:link href="https://artipop.test/feed.xml" rel="self" type="application/rss+xml" />');
    expect(xml).toContain("<link>https://artipop.test/</link>");
  });
});

// feat-il-feed-di-un-canale-storico-apre-il-giorno-in-archivio: quando il
// canale è marcato storico, la voce non risolve più sulla home del flusso
// erede (giorno inesistente lì) ma sull'archivio letto sotto l'id richiesto.
describe("renderFeed — canale storico apre il giorno in archivio", () => {
  const STORICO = { id: "island", name: "island", tagline: null, storico: true };

  it("con canale.storico, link e guid puntano a /archivi/<id>?date=<data>, mai a /?c=…&d=", () => {
    const voci = [{ data: "2026-06-15", conceptNome: "Crescita", elementNome: "Felce" }];
    const xml = renderFeed({ canale: STORICO, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<link>https://artipop.test/archivi/island?date=2026-06-15</link>");
    expect(xml).toContain('<guid isPermaLink="false">https://artipop.test/archivi/island?date=2026-06-15</guid>');
    expect(xml).not.toContain("/?c=island&amp;d=");
  });

  it("con canale.storico, il <link> del <channel> è /archivi", () => {
    const xml = renderFeed({ canale: STORICO, voci: [], origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<link>https://artipop.test/archivi</link>");
  });

  it("senza canale.storico (assente o falso), link/guid/<link> di canale restano byte-identici a oggi", () => {
    const voci = [{ data: "2026-06-15", conceptNome: "Crescita", elementNome: "Felce" }];
    const senzaFlag = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    const conFlagFalso = renderFeed({ canale: { ...CANALE, storico: false }, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(senzaFlag).toContain("<link>https://artipop.test/?c=natura&amp;d=2026-06-15</link>");
    expect(senzaFlag).toContain("<link>https://artipop.test/?c=natura</link>");
    expect(conFlagFalso).toBe(senzaFlag);
  });

  it("con canale.storico, enclosure e <img> della description restano /w/<id>?date=<data>", () => {
    const voci = [{ data: "2026-06-15", conceptNome: "Crescita", elementNome: "Felce" }];
    const xml = renderFeed({ canale: STORICO, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain('<enclosure url="https://artipop.test/w/island?date=2026-06-15" type="image/png" />');
    expect(xml).toContain('<img src="https://artipop.test/w/island?date=2026-06-15"');
  });

  it("voci con canaleId proprio (feed aggregato) continuano a usare canaleId nel link, invariato", () => {
    const AGGREGATO = { id: "", name: "tutti i canali", tagline: "Tutti i canali di ArtiPop in un solo feed." };
    const voci = [{ data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce", canaleNome: "Natura", canaleId: "natura" }];
    const xml = renderFeed({ canale: AGGREGATO, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).toContain("<link>https://artipop.test/?c=natura&amp;d=2026-08-01</link>");
  });
});

// feat-il-feed-racconta-il-giorno: la description dell'item porta anche il
// racconto della tappa e la posizione nell'arco, quando la carta d'identità
// li ha (criteri 1-4 del piano).
describe("renderFeed — il giorno racconta la tappa e l'arco", () => {
  it("voce con testoTappa + arco + giornoNellArco: la description contiene racconto e posizione, oltre all'img", () => {
    const voci = [{
      data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce",
      testoTappa: "la felce apre la prima fronda", arco: 1, giornoNellArco: 3,
    }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    const item = xml.match(/<item>[\s\S]*?<\/item>/)[0];
    const description = item.match(/<description>([\s\S]*?)<\/description>/)[1];
    expect(description).toContain('<img src="https://artipop.test/w/natura?date=2026-08-01"');
    expect(description).toContain("la felce apre la prima fronda");
    expect(description).toContain("arco 2, giorno 3");
  });

  it("voce senza testoTappa/arco/giornoNellArco (giorno ricostruito): description identica a oggi, solo <img>", () => {
    const voci = [{
      data: "2026-07-30", conceptNome: "Costruzione", elementNome: "Isola",
      testoTappa: null, arco: null, giornoNellArco: null,
    }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    const item = xml.match(/<item>[\s\S]*?<\/item>/)[0];
    const description = item.match(/<description>([\s\S]*?)<\/description>/)[1];
    expect(description).toBe(
      '<![CDATA[<img src="https://artipop.test/w/natura?date=2026-07-30" alt="2026-07-30 — Costruzione · Isola" />]]>'
    );
    expect(description).not.toMatch(/null|undefined/);
  });

  it("testoTappa con ]]> non chiude il CDATA in anticipo: XML ben formato con un solo <description>", () => {
    const voci = [{
      data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce",
      testoTappa: "prima ]]> poi ancora", arco: 0, giornoNellArco: 1,
    }];
    const xml = renderFeed({ canale: CANALE, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
    expect(xml).not.toContain("]]> poi ancora]]>");
    const items = xml.match(/<item>[\s\S]*?<\/item>/g);
    expect(items).toHaveLength(1);
    const description = items[0].match(/<description>([\s\S]*?)<\/description>/)[1];
    expect(description).toContain("prima ]]&gt; poi ancora");
    expect(description.match(/<!\[CDATA\[/g)).toHaveLength(1);
    expect(description.match(/]]>/g)).toHaveLength(1);
  });

  it("regressione: title/link/guid/pubDate/enclosure invariati per una voce con racconto, sia canale singolo che aggregato", () => {
    const vocaSingola = {
      data: "2026-08-01", conceptNome: "Crescita", elementNome: "Felce",
      testoTappa: "racconto del giorno", arco: 0, giornoNellArco: 2,
    };
    const vocaAggregata = { ...vocaSingola, canaleNome: "Natura", canaleId: "natura" };
    const AGGREGATO = { id: "", name: "tutti i canali", tagline: "Tutti i canali di ArtiPop in un solo feed." };

    for (const [canale, voci, titoloAtteso] of [
      [CANALE, [vocaSingola], "2026-08-01 — Crescita · Felce"],
      [AGGREGATO, [vocaAggregata], "Natura — 2026-08-01 — Crescita · Felce"],
    ]) {
      const xml = renderFeed({ canale, voci, origin: "https://artipop.test", oggi: "2026-08-01" });
      expect(xml).toContain(`<title>${titoloAtteso}</title>`);
      expect(xml).toContain("<link>https://artipop.test/?c=natura&amp;d=2026-08-01</link>");
      expect(xml).toContain('<guid isPermaLink="false">https://artipop.test/?c=natura&amp;d=2026-08-01</guid>');
      expect(xml).toMatch(/<pubDate>\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/);
      expect(xml).toContain('<enclosure url="https://artipop.test/w/natura?date=2026-08-01" type="image/png" />');
    }
  });
});
