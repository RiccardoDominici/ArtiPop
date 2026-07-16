// Accesso a KV: stato della storia, immagini e metadati di ogni canale.
//
// Layout delle chiavi:
//   state:<canale>        → JSON dello stato narrativo (vedi story.js)
//   img:<canale>:latest   → byte dell'immagine di oggi (con metadata KV)
//   img:<canale>:dow<0-6> → archivio a rotazione settimanale (0=domenica … 6=sabato);
//                           si sovrascrive da solo: nessuna pulizia necessaria.
//   meta:<canale>         → JSON leggero per la pagina web (data, scena, modello, …)

const stateKey = (ch) => `state:${ch}`;
const latestKey = (ch) => `img:${ch}:latest`;
const dowKey = (ch, dow) => `img:${ch}:dow${dow}`;
const metaKey = (ch) => `meta:${ch}`;

/** Stato narrativo del canale (o null al primo giorno). */
export async function getState(env, channelId) {
  return env.KV.get(stateKey(channelId), { type: "json" });
}

export async function putState(env, channelId, state) {
  await env.KV.put(stateKey(channelId), JSON.stringify(state));
}

/**
 * Salva l'immagine del giorno: aggiorna `latest`, la copia del giorno della settimana
 * e i metadati per la pagina. I metadata KV restano sotto il limite di 1024 byte.
 */
export async function putImage(env, channelId, img, info) {
  const kvMeta = {
    contentType: img.contentType,
    date: info.date,
    model: img.model,
    width: img.width,
    height: img.height,
  };
  const dow = new Date(info.date + "T00:00:00Z").getUTCDay();

  await env.KV.put(latestKey(channelId), img.bytes, { metadata: kvMeta });
  await env.KV.put(dowKey(channelId, dow), img.bytes, { metadata: kvMeta });
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
 * `dow` opzionale (0-6) per l'archivio settimanale. Ritorna { stream, meta } o null.
 */
export async function getImage(env, channelId, dow = null) {
  const key = dow == null ? latestKey(channelId) : dowKey(channelId, dow);
  const res = await env.KV.getWithMetadata(key, { type: "stream" });
  if (!res || !res.value) return null;
  return { stream: res.value, meta: res.metadata || {} };
}

/** Metadati leggeri del canale per la pagina web (o null se mai generato). */
export async function getMeta(env, channelId) {
  return env.KV.get(metaKey(channelId), { type: "json" });
}
