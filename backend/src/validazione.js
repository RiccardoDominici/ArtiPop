// VALIDAZIONE — le regole sui profili (range, monotona, guardie), in un solo posto.
//
// Le stesse regole erano scritte tre volte: catalog.js (validaProfilo /
// validaScalareONull), note.js (validaProfiloAssetto) e ancora una volta,
// sotto forma di limiti, in profiles.js (CAMPI_RANGE/CAMPI_SCALARI). Nessuno
// dei tre importava dagli altri: un limite cambiato in un posto poteva
// restare diverso negli altri due senza che nessun errore lo segnalasse.
//
// Questo modulo è una FOGLIA apposta: NON deve importare da
// catalog.js/profiles.js/note.js/channels.js. Motivo (vedi il commento in
// testa a catalog.js): channels.js esegue codice al caricamento del modulo
// (il self-check con poolFor()), e catalog.js↔concepts.js hanno già un ciclo
// di import voluto e innocuo — aggiungerne un altro qui, in un modulo che
// tutti e tre gli altri devono poter importare senza pensieri, lo renderebbe
// molto meno innocuo. Chi ha bisogno dei limiti o delle regole importa da
// qui; qui non si importa da nessuno di loro.

/** Limiti dei tre range tarabili: unica fonte di verità, condivisa da catalogo, note e tuning. */
export const LIMITI_RANGE = { estensione: [0, 100], intensita: [0, 100], compattezza: [0, 1] };

/**
 * Valida i tre range di un profilo. Scrive in uscita solo i campi validi;
 * gli errori vanno in `errori` con il prefisso indicato (es. "profilo" o
 * "profili.<id>"). Non scrive `monotona`: se ne occupa validaMonotona.
 */
export function validaRangeProfilo(profiloIn, prefisso, errori) {
  const profilo = {};
  for (const [campo, [min, max]] of Object.entries(LIMITI_RANGE)) {
    const v = profiloIn?.[campo];
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number" && isFinite(n))) {
      errori.push(`${prefisso}.${campo}: servono [min, max] numerici`);
      continue;
    }
    const lo = Math.min(v[0], v[1]);
    const hi = Math.max(v[0], v[1]);
    if (lo < min || hi > max) {
      errori.push(`${prefisso}.${campo}: fuori dai limiti [${min}, ${max}]`);
      continue;
    }
    profilo[campo] = [lo, hi];
  }
  return profilo;
}

/**
 * Valida `monotona`. NIENTE Boolean(): su input esterno coercerebbe
 * qualunque stringa non vuota (compresa "false") a true. Ritorna il
 * booleano, oppure undefined dopo aver spinto l'errore.
 */
export function validaMonotona(profiloIn, prefisso, errori) {
  if (typeof profiloIn?.monotona !== "boolean") {
    errori.push(`${prefisso}.monotona: deve essere un booleano (true/false), non ${JSON.stringify(profiloIn?.monotona)}`);
    return undefined;
  }
  return profiloIn.monotona;
}

/**
 * Un numero finito, oppure null/assente ("torna alla guardia globale").
 * `nome` è il nome completo del campo per il messaggio d'errore.
 */
export function validaScalareONull(v, nome, errori) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !isFinite(v)) {
    errori.push(`${nome}: deve essere un numero oppure null`);
    return null;
  }
  return v;
}
