// feat-segui-il-canale-dal-lettore-di-feed: vista RSS 2.0 sui giorni già
// serviti da /w/<flusso>?date= e /archivi. Nessuna dipendenza: XML composto a
// mano, sulla falsariga di archivi.js (stesso escape minimo, stesso stile).

/** Escape XML minimo per il testo dinamico interpolato (concept, tagline, id…). */
function escXml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[c]);
}

/**
 * Data YYYY-MM-DD → RFC 822/1123 (`Thu, 01 Jan 2026 12:00:00 GMT`), il
 * formato richiesto da `<pubDate>`. Mezzogiorno UTC fisso, stessa scelta di
 * `dataEstesaItaliana` (head.js): la data è una chiave calendario, non un
 * istante, e non deve scivolare di giorno per via del fuso.
 */
function dataRfc822(dataKey) {
  return new Date(`${dataKey}T12:00:00Z`).toUTCString();
}

/**
 * Compone il feed RSS 2.0 di un canale, o del feed aggregato di tutti i
 * canali (feat-un-solo-feed-per-tutti-i-canali). `canale` = { id, name,
 * tagline }: per un flusso attivo sono i suoi dati (channels.js); per un
 * alias storico `id` e `name` sono l'id richiesto (stessa convenzione di
 * `/api/channels?all=1` per i canali storici — mai il nome del flusso erede,
 * che ha un'altra identità); per un flusso sconosciuto `tagline` porta il
 * messaggio umano da mostrare al posto della descrizione; per il feed
 * aggregato `id` è vuoto e `link`/`self` puntano alla home invece che a un
 * canale.
 * `voci` = array di carte d'identità (`cartaDiIdentita`/`giornoRicostruito`,
 * handlers.js), una per giorno, più recente prima: bastano `data`,
 * `conceptNome`, `elementNome` (gli altri campi non servono al feed). Una
 * voce può portare anche `canaleNome`/`canaleId`: quando presenti, il titolo
 * antepone il nome del canale e link/guid/enclosure usano `canaleId` invece
 * dell'id del canale del feed — così un feed aggregato può mescolare voci di
 * più canali. Quando assenti il comportamento è quello di sempre (voci di un
 * feed per canale singolo, invariate).
 * Nessuna rete, nessun accesso a KV qui dentro: solo composizione di stringhe.
 */
export function renderFeed({ canale, voci, origin, oggi }) {
  const linkCanale = canale.id ? `${origin}/?c=${canale.id}` : `${origin}/`;
  const selfUrl = canale.id ? `${origin}/feed/${canale.id}.xml` : `${origin}/feed.xml`;
  const descrizione = canale.tagline || "Un flusso di wallpaper AI di ArtiPop, un giorno nuovo alla volta.";

  const items = (voci || [])
    .map((v) => {
      const idVoce = v.canaleId ?? canale.id;
      const soggetto = v.conceptNome && v.elementNome ? `${v.conceptNome} · ${v.elementNome}` : null;
      const titoloBase = soggetto ? `${v.data} — ${soggetto}` : v.data;
      const titolo = v.canaleNome ? `${v.canaleNome} — ${titoloBase}` : titoloBase;
      const link = `${origin}/?c=${idVoce}&d=${v.data}`;
      const immagine = `${origin}/w/${idVoce}?date=${v.data}`;
      return `<item>
<title>${escXml(titolo)}</title>
<link>${escXml(link)}</link>
<guid isPermaLink="false">${escXml(link)}</guid>
<pubDate>${dataRfc822(v.data)}</pubDate>
<description><![CDATA[<img src="${immagine}" alt="${titolo.replace(/"/g, "&quot;")}" />]]></description>
<enclosure url="${escXml(immagine)}" type="image/png" />
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escXml(`ArtiPop — ${canale.name}`)}</title>
<link>${escXml(linkCanale)}</link>
<description>${escXml(descrizione)}</description>
<language>it-IT</language>
<atom:link href="${escXml(selfUrl)}" rel="self" type="application/rss+xml" />
<lastBuildDate>${dataRfc822(oggi)}</lastBuildDate>
${items}
</channel>
</rss>`;
}
