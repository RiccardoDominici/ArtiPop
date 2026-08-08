// feat-il-promemoria-del-wallpaper-va-nel-calendario: un calendario
// iCalendar sottoscrivibile (RFC 5545) ricorda quando arriva il wallpaper
// nuovo. Modulo puro (nessun accesso a KV/rete), stesso stile di opml.js.

function ottetti(s) {
  return new TextEncoder().encode(String(s ?? "")).length;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Escape dei valori TEXT secondo RFC 5545. Ordine vincolante: la barra
 * rovescia per prima, altrimenti si ri-scappano quelle appena introdotte.
 */
export function escIcs(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Ripiegamento RFC 5545 §3.1: spezza una riga di contenuto in pezzi da al
 * massimo 75 ottetti, i pezzi dal secondo in poi preceduti da uno spazio.
 * Iterazione per code point: un carattere multi-byte non va mai spezzato
 * a metà.
 */
function piega(riga) {
  const s = String(riga ?? "");
  const righe = [];
  let corrente = "";
  let limite = 75;
  for (const ch of s) {
    const costo = ottetti(ch);
    if (ottetti(corrente) + costo > limite) {
      righe.push(corrente);
      corrente = " " + ch;
      limite = 75;
    } else {
      corrente += ch;
    }
  }
  righe.push(corrente);
  return righe;
}

const ANCORA_UTC = "20260101";

/**
 * Compone il calendario iCalendar. Funzione TOTALE: nessun ramo può
 * lanciare, per nessun input — è il presupposto del ripiego della rotta e
 * di PROMEMORIA_VUOTO.
 */
export function renderPromemoria(opts) {
  const { canale, origin, oraCronUtc, adesso } = opts ?? {};
  const base = String(origin ?? "").replace(/[\r\n]/g, "");
  const id = String(canale?.id ?? "").replace(/[^a-z0-9_-]/gi, "");
  const nome = typeof canale?.name === "string" && canale.name ? canale.name : "";

  const n = Number(oraCronUtc);
  const ore = Number.isFinite(n) ? Math.min(23, Math.max(0, Math.trunc(n))) : 0;

  const stamp = adesso instanceof Date && !Number.isNaN(adesso.getTime()) ? adesso : new Date();
  const dtstamp =
    `${stamp.getUTCFullYear()}${pad2(stamp.getUTCMonth() + 1)}${pad2(stamp.getUTCDate())}` +
    `T${pad2(stamp.getUTCHours())}${pad2(stamp.getUTCMinutes())}${pad2(stamp.getUTCSeconds())}Z`;

  const uid = `promemoria-${id || "tutti"}@artipop`;

  const summary = id
    ? `Nuovo wallpaper ArtiPop — ${nome || id}`
    : "Nuovo wallpaper ArtiPop";
  const description = id
    ? `Il canale ${nome || id} pubblica il wallpaper del giorno.`
    : "ArtiPop pubblica il wallpaper del giorno.";

  const url = id ? `${base}/?c=${id}` : `${base}/`;

  const righe = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ArtiPop//Promemoria//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${ANCORA_UTC}T${pad2(ore)}0000Z`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    `SUMMARY:${escIcs(summary)}`,
    `DESCRIPTION:${escIcs(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return righe.flatMap(piega).join("\r\n") + "\r\n";
}

/** Calendario valido e vuoto: il ripiego della rotta, gemella di OPML_VUOTO. */
export const PROMEMORIA_VUOTO = renderPromemoria({
  canale: null,
  origin: "",
  oraCronUtc: 0,
  adesso: new Date(0),
});
