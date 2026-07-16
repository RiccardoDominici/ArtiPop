// Accesso a KV: stato della storia, immagini e metadati di ogni canale.
//
// Layout delle chiavi:
//   state:<canale>            → JSON dello stato narrativo (vedi story.js)
//   img:<canale>:latest       → byte dell'immagine di oggi (con metadata KV)
//   archive:<canale>:<data>   → ARCHIVIO PERMANENTE: una copia per ogni giorno
//                               (YYYY-MM-DD). Niente viene mai buttato.
//   meta:<canale>             → JSON leggero per la pagina web (data, scena, …)
//
// Capacità archivio: ~1,1 MB a immagine × 2 canali attivi ≈ 2,2 MB/giorno →
// il GB gratuito di KV copre ~15 mesi. Prima di riempirlo le opzioni sono
// abilitare R2 (10 GB gratuiti, richiede attivazione in dashboard) o spostare
// lo storico su un repo GitHub: vedi README del backend.

const stateKey = (ch) => `state:${ch}`;
const latestKey = (ch) => `img:${ch}:latest`;
const archiveKey = (ch, date) => `archive:${ch}:${date}`;
const metaKey = (ch) => `meta:${ch}`;
const ARCHIVE_PREFIX = (ch) => `archive:${ch}:`;

/** Stato narrativo del canale (o null al primo giorno). */
export async function getState(env, channelId) {
  return env.KV.get(stateKey(channelId), { type: "json" });
}

export async function putState(env, channelId, state) {
  await env.KV.put(stateKey(channelId), JSON.stringify(state));
}

/**
 * Salva l'immagine del giorno: aggiorna `latest`, scrive la copia PERMANENTE
 * nell'archivio per data e i metadati per la pagina.
 */
export async function putImage(env, channelId, img, info) {
  const kvMeta = {
    contentType: img.contentType,
    date: info.date,
    model: img.model,
    width: img.width,
    height: img.height,
  };

  await env.KV.put(latestKey(channelId), img.bytes, { metadata: kvMeta });
  await env.KV.put(archiveKey(channelId, info.date), img.bytes, { metadata: kvMeta });
  await env.KV.put(
    metaKey(channelId),
    JSON.stringify({
      date: info.date,
      scene: info.scene,
      arcTheme: info.arcTheme,
      arcIndex: info.arcIndex,
      dayInArc: info.dayInArc,
      model: img.model,
      width: img.width,
      height: img.height,
      generatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Legge un'immagine come stream (efficiente: nessuna copia in memoria).
 * `date` opzionale (YYYY-MM-DD) per pescare dall'archivio permanente.
 * Ritorna { stream, meta } o null.
 */
export async function getImage(env, channelId, date = null) {
  const key = date == null ? latestKey(channelId) : archiveKey(channelId, date);
  const res = await env.KV.getWithMetadata(key, { type: "stream" });
  if (!res || !res.value) return null;
  return { stream: res.value, meta: res.metadata || {} };
}

/**
 * Elenca le date presenti in archivio per un canale, dalla più recente.
 * KV lista in ordine lessicografico (= cronologico per YYYY-MM-DD), quindi
 * si pagina fino in fondo e si inverte; con ~450 chiavi/anno resta 1-2 letture.
 */
export async function listArchiveDates(env, channelId, limit = 60) {
  const prefix = ARCHIVE_PREFIX(channelId);
  const dates = [];
  let cursor = undefined;
  for (;;) {
    const page = await env.KV.list({ prefix, cursor, limit: 1000 });
    for (const k of page.keys) dates.push(k.name.slice(prefix.length));
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  dates.sort(); // difensivo: garantisce ordine cronologico
  return dates.reverse().slice(0, limit);
}

/** Metadati leggeri del canale per la pagina web (o null se mai generato). */
export async function getMeta(env, channelId) {
  return env.KV.get(metaKey(channelId), { type: "json" });
}
