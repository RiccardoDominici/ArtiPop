// Accesso a KV: stato della storia, immagini e metadati di ogni canale.
//
// Layout delle chiavi:
//   state:<canale>            → JSON dello stato narrativo (vedi story.js)
//   img:<canale>:latest       → byte dell'immagine di oggi (con metadata KV)
//   archive:<canale>:<data>   → ARCHIVIO PERMANENTE: una copia per ogni giorno
//                               (YYYY-MM-DD). Niente viene mai buttato.
//   meta:<canale>             → JSON leggero per la pagina web (data, scena, …)
//   giorno:<canale>:<data>    → CARTA D'IDENTITÀ del giorno: provenienza completa
//                               (concept, element, tappa, misure, profilo in
//                               vigore) per poter sperimentare capendo perché un
//                               giorno fu accettato o bocciato. Vedi CONTRATTO.
//
// Capacità archivio: ~1,1 MB a immagine × 2 canali attivi ≈ 2,2 MB/giorno →
// il GB gratuito di KV copre ~15 mesi. Prima di riempirlo le opzioni sono
// abilitare R2 (10 GB gratuiti, richiede attivazione in dashboard) o spostare
// lo storico su un repo GitHub: vedi README del backend.

const stateKey = (ch) => `state:${ch}`;
const latestKey = (ch) => `img:${ch}:latest`;
const archiveKey = (ch, date) => `archive:${ch}:${date}`;
const metaKey = (ch) => `meta:${ch}`;
const giornoKey = (ch, date) => `giorno:${ch}:${date}`;
const ARCHIVE_PREFIX = (ch) => `archive:${ch}:`;

/** Stato narrativo del canale (o null al primo giorno). */
export async function getState(env, channelId) {
  return env.KV.get(stateKey(channelId), { type: "json" });
}

export async function putState(env, channelId, state) {
  await env.KV.put(stateKey(channelId), JSON.stringify(state));
}

/**
 * Costruisce la carta d'identità di un giorno (chiave `giorno:<canale>:<data>`,
 * vedi CONTRATTO). Vive in una chiave JSON A PARTE dai metadata KV
 * dell'immagine: quelli hanno un limite di 1024 byte, e misure + testoTappa +
 * profilo lo sforerebbero.
 *
 * Nota sul vocabolario (vedi CONTRATTO): in produzione `info.conceptId` è
 * l'id dell'ELEMENT (es. "isola") e `info.famiglia` è il CONCEPT (es.
 * "costruzione"). Qui vanno nei campi giusti — `element`/`concept` — senza
 * propagare la confusione ai consumatori di questo documento.
 */
function buildGiorno(channelId, img, info) {
  const profiloIn = info.profilo || null;
  return {
    data: info.date,
    canale: channelId,
    concept: info.famiglia ?? null,
    conceptNome: info.famigliaNome ?? null,
    element: info.conceptId ?? null,
    elementNome: info.conceptNome ?? null,
    arco: typeof info.arcIndex === "number" ? info.arcIndex : null,
    // CONFINE base-zero → base-uno: `dayInArc`/`stage` arrivano GREZZI da
    // story.js (0 al primo giorno dell'arco), esattamente come li usa lo
    // stato interno. Ma questo documento è quello che ESCE all'esterno (sito,
    // /backfill, strumento di tuning), e lì la numerazione è sempre base uno
    // (lab.js: `tappa: state.stage + 1`; log e risposta di /backfill: idem).
    // La conversione va fatta QUI e in un solo punto, perché questa funzione è
    // l'unico confine fra i due mondi — non spostarla in story.js (romperebbe
    // la logica interna, che confronta stage/dayInArc fra loro) né duplicarla
    // nei chiamanti (è già successo: si erano dimenticati /api/archive).
    // `typeof ... === "number"` e non un test di verità: 0 è un valore valido
    // (primo giorno/prima tappa) e deve diventare 1, non restare "assente";
    // solo l'ASSENZA del campo (undefined) deve restare `null`.
    giornoNellArco: typeof info.dayInArc === "number" ? info.dayInArc + 1 : null,
    tappa: typeof info.stage === "number" ? info.stage + 1 : null,
    testoTappa: typeof info.testoTappa === "string" ? info.testoTappa : null,
    modello: img.model ?? null,
    tentativi: typeof info.tentativi === "number" ? info.tentativi : null,
    misure: info.misure ?? null,
    collaudo: info.verdetto
      ? { ok: Boolean(info.verdetto.ok), motivi: Array.isArray(info.verdetto.motivi) ? info.verdetto.motivi : [] }
      : null,
    // PROFILO EFFETTIVO usato per il collaudo di oggi (default più eventuale
    // override di tuning, già risolto da chi chiama): senza questo non si può
    // capire a posteriori perché un giorno fu accettato o bocciato.
    profilo: profiloIn
      ? {
          estensione: profiloIn.estensione ?? null,
          intensita: profiloIn.intensita ?? null,
          compattezza: profiloIn.compattezza ?? null,
          monotona: Boolean(profiloIn.monotona),
          maxDeriva: profiloIn.maxDeriva ?? null,
          maxDegrado: profiloIn.maxDegrado ?? null,
        }
      : null,
    origine: "registrata",
  };
}

/**
 * Salva l'immagine del giorno: aggiorna `latest`, scrive la copia PERMANENTE
 * nell'archivio per data, la carta d'identità del giorno e i metadati per la
 * pagina.
 * `archiveOnly`: usato dal backfill per i giorni intermedi (latest e meta
 * interessano solo per l'ultimo giorno; si risparmiano subrequest, cap free 50).
 * La carta d'identità invece si scrive SEMPRE, anche per i giorni intermedi:
 * è proprio lì che serve la provenienza, altrimenti resterebbero silenziosi.
 */
export async function putImage(env, channelId, img, info, { archiveOnly = false } = {}) {
  const kvMeta = {
    contentType: img.contentType,
    date: info.date,
    model: img.model,
    width: img.width,
    height: img.height,
  };

  await env.KV.put(archiveKey(channelId, info.date), img.bytes, { metadata: kvMeta });
  await env.KV.put(giornoKey(channelId, info.date), JSON.stringify(buildGiorno(channelId, img, info)));
  if (archiveOnly) return;

  await env.KV.put(latestKey(channelId), img.bytes, { metadata: kvMeta });
  // I metadati alimentano il sito e le diagnosi: si passa `info` per intero
  // (contiene concept, famiglia, tappa e misure del collaudo) invece di
  // riscriverne a mano un sottoinsieme, che a ogni campo nuovo andava
  // aggiornato qui e veniva puntualmente dimenticato.
  await env.KV.put(
    metaKey(channelId),
    JSON.stringify({
      ...info,
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

/**
 * Id dei canali che hanno almeno un giorno in archivio (`archive:<canale>:<data>`),
 * inclusi quelli storici ormai spenti (island, bloom, studio, neon…). Serve al
 * tool di tuning per smettere di tenere due liste di canali scritte a mano.
 * Costa una scansione delle chiavi `archive:*` (poche migliaia): la si fa SOLO
 * su richiesta esplicita (/api/channels?all=1), mai nel giro di produzione.
 * Ritorna una Map id → { giorni, prima, ultima }.
 */
export async function listChannelsWithArchive(env) {
  const risultato = new Map();
  try {
    const re = /^archive:([a-z0-9_-]+):(\d{4}-\d{2}-\d{2})$/;
    let cursor = undefined;
    for (;;) {
      const page = await env.KV.list({ prefix: "archive:", cursor, limit: 1000 });
      for (const k of page.keys) {
        const m = re.exec(k.name);
        if (!m) continue; // chiave imprevista: ignorata in silenzio
        const [, canale, data] = m;
        const voce = risultato.get(canale) ?? { giorni: 0, prima: data, ultima: data };
        voce.giorni += 1;
        if (data < voce.prima) voce.prima = data;
        if (data > voce.ultima) voce.ultima = data;
        risultato.set(canale, voce);
      }
      if (page.list_complete) break;
      cursor = page.cursor;
    }
  } catch (err) {
    console.warn(`[storage] listChannelsWithArchive fallita, considerata vuota: ${err.message}`);
    return new Map();
  }
  return risultato;
}

/** Metadati leggeri del canale per la pagina web (o null se mai generato). */
export async function getMeta(env, channelId) {
  return env.KV.get(metaKey(channelId), { type: "json" });
}

/**
 * Carta d'identità di UN giorno (o null se non registrata / illeggibile, vedi
 * CONTRATTO). Come `loadCatalog` (catalog.js) e `loadNote` (note.js): le
 * letture non lanciano MAI per KV illeggibile. Senza questo try/catch, una
 * sola voce `giorno:<canale>:<data>` corrotta fa fallire con 500 l'INTERA
 * risposta di `/api/archive/<canale>` (il `??` del chiamante non intercetta
 * un'eccezione) — un giorno rotto abbatterebbe l'intero archivio invece di
 * degradare da solo a "assente".
 */
export async function getGiorno(env, channelId, date) {
  try {
    return await env.KV.get(giornoKey(channelId, date), { type: "json" });
  } catch (err) {
    console.warn(`[storage] giorno:${channelId}:${date} illeggibile, considerato assente: ${err.message}`);
    return null;
  }
}
