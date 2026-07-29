// GIORNO — un solo posto per costruire la carta d'identità di un'immagine.
//
// L'oggetto `info` che accompagna ogni immagine generata (e da cui
// storage.js:buildGiorno ricava la carta d'identità `giorno:<canale>:<data>`)
// era scritto A MANO, identico, in tre punti di index.js: runChannel,
// backfillChannel e l'handler /regen-day. Aggiungere un campo voleva dire
// ricordarsene tre volte — ed è già andata male una volta (vedi il commento
// in storage.js righe 56-67, sul giorno in cui ci si è dimenticati di
// convertire base-zero/base-uno in uno dei tre punti).
//
// Da qui in poi c'è UN SOLO posto che decide quali campi accompagnano
// un'immagine generata: chi genera (runChannel, backfillChannel, /regen-day)
// chiama questa funzione e passa il risultato a putImage, senza più scrivere
// la forma dell'oggetto a mano.

import { clausesFor } from "./story.js";

/**
 * Costruisce l'oggetto `info` da passare a putImage (storage.js): l'UNICO
 * punto in cui si decide quali campi accompagnano un'immagine generata.
 * @param {object}  a
 * @param {string}  a.date        giorno generato, YYYY-MM-DD
 * @param {object}  a.concept     concept risolto CON dentro `profilo` già effettivo
 *                                (default + override di tuning, vedi profiles.js)
 * @param {object}  a.state       stato del giorno: arcIndex, dayInArc, stage, scene, extraIndex
 * @param {object}  a.img         risultato di generateDay: misure, tentativi, verdetto
 * @param {string} [a.testoTappa] testo della tappa; se assente si ricava da clausesFor
 */
export function buildInfoGiorno({ date, concept, state, img, testoTappa }) {
  return {
    date,
    scene: state.scene,
    conceptId: concept.id,          // ATTENZIONE: qui `conceptId` è l'id dell'ELEMENT
    conceptNome: concept.nome,      // (vocabolario interno invertito, vedi storage.js:41-44)
    famiglia: concept.famiglia.id,  // …e `famiglia` è il vero CONCEPT/schema
    famigliaNome: concept.famiglia.nome,
    arcIndex: state.arcIndex,
    dayInArc: state.dayInArc,
    stage: state.stage,
    testoTappa: typeof testoTappa === "string"
      ? testoTappa
      : clausesFor(concept, state.stage, 0, state.extraIndex).join(". "),
    misure: img.misure,
    tentativi: img.tentativi,
    verdetto: img.verdetto,
    profilo: concept.profilo,
  };
}
