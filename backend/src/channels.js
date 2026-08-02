// I FLUSSI di ArtiPop.
//
// Un flusso NON è più un tema permanente: è un contenitore che ogni settimana
// pesca un concept diverso dalla libreria (vedi concepts.js). Una settimana
// un'isola che si costruisce, la successiva un fiore che cresce, poi una città
// che evolve. Quello che distingue un flusso da un altro non è più il soggetto
// — è l'INDOLE, cioè da quali famiglie di storie pesca.
//
// Tre flussi, tre indoli disgiunte. La disgiunzione non è estetica: garantisce
// che due flussi non possano mai capitare sullo stesso concept nella stessa
// settimana, senza bisogno di alcun coordinamento fra loro.

import { CONFIG } from "./config.js";
import { FAMILIES } from "./families.js";
import { conceptsForFamilies } from "./concepts.js";

export const CHANNELS = [
  {
    id: "natura",
    name: "Natura",
    emoji: "🌿",
    active: true,
    accent: ["#7ec8a9", "#f2b878"],
    tagline: "Cose che nascono e si costruiscono, una settimana alla volta",
    taglineEn: "Things that grow and get built, one week at a time",
    famiglie: ["crescita", "costruzione"],
  },
  {
    id: "citta",
    name: "Città",
    emoji: "🌆",
    active: true,
    accent: ["#4568dc", "#b06ab3"],
    tagline: "Luoghi abitati che evolvono e viaggi che li attraversano",
    taglineEn: "Inhabited places that evolve, and journeys across them",
    famiglie: ["timelapse", "attraversamento"],
  },
  {
    id: "quiete",
    name: "Quiete",
    emoji: "🕯️",
    active: true,
    accent: ["#c98d5a", "#8a7fb5"],
    tagline: "Spazi intimi che si riempiono e forme che si trasformano",
    taglineEn: "Intimate spaces filling up, and forms transforming",
    famiglie: ["accumulo", "metamorfosi"],
  },
];

/**
 * Vecchi identificativi di canale → flusso che ne raccoglie l'eredità.
 *
 * Le Shortcut già installate sugli iPhone puntano a /w/island, /w/bloom e
 * /w/studio: quegli indirizzi devono continuare a funzionare per sempre, o si
 * romperebbero installazioni che non possiamo aggiornare. Ogni vecchio canale
 * viene instradato sul flusso che ha ereditato la sua famiglia di storie
 * (isola e fiore erano natura, la scrivania era accumulo → quiete).
 *
 * Attenzione: l'alias vale solo per l'immagine DI OGGI. Le richieste con
 * ?date= continuano a leggere l'archivio storico del vecchio canale, che resta
 * intatto e consultabile.
 */
export const LEGACY_ALIASES = {
  island: "natura",
  bloom: "natura",
  studio: "quiete",
  // Canali mai distribuiti agli utenti, mappati per completezza.
  // `neon` mancava e i suoi sette giorni d'archivio erano irraggiungibili:
  // /w/neon?date=... rispondeva "flusso sconosciuto" invece di servirli.
  // Era una città al neon, cioè un timelapse urbano → l'eredità è di `citta`.
  neon: "citta",
  horizon: "natura",
  atelier: "quiete",
  cosmos: "citta",
  depths: "natura",
  aurora: "quiete",
};

/** Solo i flussi attivi: il cron genera e il sito mostra soltanto questi. */
export const ACTIVE_CHANNELS = CHANNELS.filter((c) => c.active);

/** Il flusso con quell'id, o undefined. */
export function getChannel(id) {
  return CHANNELS.find((c) => c.id === id);
}

/**
 * Nome da mostrare all'utente per un id di flusso: il nome vero (`name`) se
 * l'id è un flusso attivo, l'id ricevuto invariato altrimenti (canale
 * storico o id sconosciuto — l'id resta la loro unica identità, stessa
 * convenzione di `/api/channels?all=1`). Non lancia mai, non ritorna mai
 * `null` o stringa vuota: sempre un testo mostrabile.
 */
export function displayName(id) {
  const channel = getChannel(id);
  return channel && channel.active ? channel.name : id;
}

/**
 * Risolve un id in un flusso reale, seguendo gli alias storici.
 * Ritorna { channel, isLegacy, requestedId } — `isLegacy` serve a chi deve
 * decidere in quale archivio andare a pescare.
 */
export function resolveChannel(id) {
  const direct = getChannel(id);
  if (direct) return { channel: direct, isLegacy: false, requestedId: id };
  const target = LEGACY_ALIASES[id];
  if (target) return { channel: getChannel(target), isLegacy: true, requestedId: id };
  return { channel: undefined, isLegacy: false, requestedId: id };
}

/**
 * Risolve un id di flusso — anche un alias storico (island, bloom, studio,
 * neon, …) — nel flusso ATTIVO che ne ha raccolto l'eredità. Lancia un errore
 * parlante se l'id non esiste o se il flusso è in pausa.
 * È il punto unico usato da tutte le rotte che GENERANO (/run, /backfill,
 * /regen-day): prima chiamavano getChannel() diretto e "/run/island" —
 * documentato in GUIDA.md — falliva con "flusso sconosciuto: island" mentre
 * /w/island funzionava benissimo.
 */
export function requireActiveChannel(id) {
  const { channel, isLegacy } = resolveChannel(id);
  if (!channel) throw new Error(`flusso sconosciuto: ${id}`);
  if (!channel.active) throw new Error(`flusso in pausa: ${id}`);
  if (isLegacy) console.log(`[channels] alias storico "${id}" → flusso "${channel.id}"`);
  return channel;
}

/**
 * I concept fra cui questo flusso può pescare (solo built-in: chi ha bisogno
 * anche dei custom pubblicati usa poolForWith in catalog.js). Usata solo qui
 * dentro, dai self-check a caricamento modulo qui sotto: mai importata
 * altrove (verificato con grep), quindi resta privata.
 */
function poolFor(channel) {
  return conceptsForFamilies(channel.famiglie);
}

/* ===================== VERIFICHE A CARICAMENTO =====================
   Non lanciano eccezioni: loggano, così un errore di configurazione si vede in
   `wrangler tail` senza mai mettere offline un flusso. */

for (const [id, fam] of Object.entries(FAMILIES)) {
  if (fam.tappe.length !== CONFIG.ARC_LENGTH_DAYS) {
    console.error(
      `[channels] famiglia ${id}: ${fam.tappe.length} tappe invece di ${CONFIG.ARC_LENGTH_DAYS} (ciclo di vita)`
    );
  }
}

for (const ch of ACTIVE_CHANNELS) {
  const pool = poolFor(ch);
  if (pool.length === 0) {
    console.error(`[channels] flusso ${ch.id}: nessun concept disponibile per ${ch.famiglie.join("+")}`);
  } else {
    console.log(`[channels] flusso ${ch.id}: ${pool.length} concept (${pool.length} settimane prima di ripetersi)`);
  }
}

// Nessun concept può appartenere a due flussi: è ciò che rende impossibile la
// collisione fra flussi nella stessa settimana.
{
  const visti = new Map();
  for (const ch of ACTIVE_CHANNELS) {
    for (const c of poolFor(ch)) {
      if (visti.has(c.id)) {
        console.error(`[channels] concept ${c.id} condiviso fra ${visti.get(c.id)} e ${ch.id}`);
      }
      visti.set(c.id, ch.id);
    }
  }
}
