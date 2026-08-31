// INVENTA CONCEPT — un element nuovo a settimana per canale, scritto da un LLM.
//
// Ogni 7 giorni un canale apre un "arco" nuovo e finora pescava il concept da
// una libreria FISSA di 60 element scritti a mano (concepts.js). Dopo ~20
// settimane la libreria girava al buio e si ripeteva. Questo modulo la
// allarga: chiama un modello di testo di Workers AI, gli fa INVENTARE un
// soggetto con il suo mondo (nome, s, soggetto, setting, style, palette) e
// salva l'element nel catalogo custom (saveElement in catalog.js) pubblicato
// sul canale — da lì in poi è materializzato come qualunque altro element e
// la pesca normale (poolForWith) lo trova senza sapere che è nato da un LLM.
//
// == PERCHÉ LE TAPPE NON SI INVENTANO (la decisione più importante del modulo)
//
// L'LLM inventa SOLO il soggetto e il suo mondo. Le SETTE TAPPE della storia
// NON si inventano: l'element nasce con `tappe: null` ed eredita quelle della
// sua FAMIGLIA, esattamente come fanno 58 dei 60 element built-in (le due
// eccezioni curate a mano sono felce e cactus, vedi concepts.js).
//
// Il motivo sta nel "cancello" che collauda ogni immagine (generate.js): misura
// quanto è cambiata la scena fra un giorno e il prossimo e la confronta con un
// profilo di range TARATO A MANO sulla famiglia (families.js: estensione,
// intensità, compattezza). Quel profilo dipende dalle tappe — una crescita di
// pianta cambia poco e in un punto solo, un timelapse urbano cambia tanto e
// dappertutto — e i range sono calibrati proprio sulle misure reali di quei
// comportamenti. Tappe della famiglia ⇒ il concept nuovo, misurato, si
// comporta come gli altri della sua famiglia ⇒ i range tarati restano validi.
// Se l'LLM inventasse anche le tappe, ogni arco sarebbe una regola nuova senza
// taratura: il cancello brucerebbe i suoi tentativi (budget AI) per poi
// pubblicare comunque il candidato meno peggiore. Per lo stesso motivo il
// prompt costringe il `setting` inventato a CONTENERE gli elementi che la
// famiglia dichiara immutabili (`conserva`): le tappe descrivono una scena
// precisa (un vaso vuoto, una superficie sgombra), e un setting che non la
// contiene farebbe collaudare immagini di una scena che non esiste.
//
// == FALLIMENTO = NIENTE INVENZIONE, MAI UN CRASH
//
// Chi chiama (il generatore settimanale) usa l'esito come concept "preferito"
// per l'arco: se qui ritorna null si ripiega sulla pesca normale dalla
// libreria e l'utente non vede niente di rotto (principio 3 di CLAUDE.md).
// Per questo NESSUNA funzione di questo modulo lancia: ogni errore — modello
// inesistente, quota finita, rete giù, JSON illeggibile, KV che rifiuta la
// scrittura — si logga e si torna null.
//
// Tutte le funzioni pure (famigliaDelTurno, idInventato, esempiPerFamiglia,
// costruisciPrompt, interpretaRisposta, normalizzaElement, nomiRecenti) non
// toccano la rete e sono testate una per una; solo inventaElement parla con
// env.AI e, per il salvataggio, col KV.

import { CONFIG, FAMIGLIE_SOSPESE } from "./config.js";
import { ELEMENTS, getElement } from "./concepts.js";
import { allFamilies, saveElement } from "./catalog.js";
import { LIMITI_ELEMENT } from "./validazione.js";

/* ===================== FUNZIONI PURE (nessuna rete) ===================== */

/**
 * La famiglia di quest'arco per un canale: le sue due famiglie (`famiglie`,
 * la sua "indole") meno quelle sospese (FAMIGLIE_SOSPESE in config.js), poi
 * `lista[arcIndex % lista.length]` — così le due si alternano nel tempo al
 * crescere degli archi.
 *
 * Se il filtro sospensioni svuota la lista si ripiega su `channel.famiglie[0]`:
 * stessa filosofia del ripiego di poolForWith (catalog.js) — meglio una
 * famiglia sospesa che nessun concept, tanto il cancello collauda comunque.
 * Non lancia mai.
 */
export function famigliaDelTurno(channel, arcIndex) {
  const tutte = Array.isArray(channel?.famiglie) ? channel.famiglie : [];
  const lista = tutte.filter((id) => !FAMIGLIE_SOSPESE.includes(id));
  if (lista.length === 0) return tutte[0] ?? null;
  // La forma ((n % len) + len) % len rende positivo anche un arcIndex negativo
  // arrivato da uno stato corrotto: un resto negativo renderebbe `undefined`
  // e chi chiama non avrebbe modo di capire se è "nessuna famiglia".
  return lista[((arcIndex % lista.length) + lista.length) % lista.length];
}

/**
 * L'id dell'element da inventare, nel formato `gen-<canale>-<arco>`: rispetta
 * la regex del catalogo (`^[a-z0-9][a-z0-9_-]{1,31}$`) perché gli id di
 * canale sono minuscolo-alfanumerici per costruzione (channels.js) e arcIndex
 * è un intero. Se quell'id esiste già nel catalogo (capita rigenerando lo
 * stesso arco) si prova `-2`, `-3`, … fino a `-9`; se sono tutti presi si
 * ritorna null e chi chiama ripiegherà sulla pesca normale. La validazione di
 * saveElement (soloSeNuovo) resta comunque l'ultima porta.
 */
export function idInventato(channelId, arcIndex, catalog) {
  const base = `gen-${channelId}-${arcIndex}`;
  const presi = new Set(Object.keys(catalog?.elements || {}));
  if (!presi.has(base)) return base;
  for (let n = 2; n <= 9; n++) {
    const id = `${base}-${n}`;
    if (!presi.has(id)) return id;
  }
  return null;
}

/**
 * Due element BUILT-IN della famiglia richiesta, scelti in modo deterministico
 * ma variando con `arcIndex`: la finestra di due element consecutivi ruota
 * sull'elenco della famiglia, così il few-shot non suggerisce sempre gli
 * stessi due soggetti (che il modello finirebbe per imitare). Con meno di due
 * element si ritornano quelli che ci sono; la famiglia non esiste o è vuota →
 * array vuoto, e il prompt uscirà senza blocco esempi.
 */
export function esempiPerFamiglia(famigliaId, arcIndex, elencoElement) {
  const dellaFamiglia = (Array.isArray(elencoElement) ? elencoElement : [])
    .filter((e) => e?.famigliaNativa === famigliaId);
  if (dellaFamiglia.length === 0) return [];
  if (dellaFamiglia.length === 1) return [dellaFamiglia[0]];
  const inizio = ((arcIndex % dellaFamiglia.length) + dellaFamiglia.length) % dellaFamiglia.length;
  return [dellaFamiglia[inizio], dellaFamiglia[(inizio + 1) % dellaFamiglia.length]];
}

/** La forma JSON dei sei campi chiesti al modello, ricavata da un element. */
function esempioJson(e) {
  return {
    nome: e?.nome ?? "",
    s: e?.s ?? e?.soggetto ?? "",
    soggetto: e?.soggetto ?? e?.s ?? "",
    setting: e?.setting ?? "",
    style: e?.style ?? "",
    palette: e?.palette ?? "",
  };
}

/**
 * Il prompt per l'invenzione, come { system, user }.
 *
 * REGOLA FONDAMENTALE: il prompt si DERIVA dai dati ricevuti. Qui dentro non
 * esiste alcun `if (famigliaId === "crescita")` né alcun nome di famiglia
 * scritto a mano: la forma della storia, gli invarianti e il registro arrivano
 * tutto dall'oggetto famiglia e dagli esempi. Se domani si aggiunge una
 * famiglia (o si cambia una conserva), il prompt si adatta da solo.
 */
export function costruisciPrompt({ famiglia, esempi = [], daEvitare = [] } = {}) {
  const system =
    "You invent the subject of a seven-day visual story for a phone wallpaper. " +
    "Answer with ONE single JSON object and nothing else: no preamble, no explanations, " +
    "no markdown code block. The object has exactly these keys: " +
    "nome, s, soggetto, setting, style, palette.";

  const blocchi = [];

  // 1. La forma della storia, presa dalla famiglia. Il blocco più importante:
  //    le tappe della famiglia descrivono una scena precisa a partire dallo
  //    stato di PARTENZA (tappa 0), e il setting inventato deve già
  //    contenerla, altrimenti il copione fisso descriverebbe una scena che
  //    non esiste.
  const partenza = (Array.isArray(famiglia?.tappe) && Array.isArray(famiglia.tappe[0]))
    ? famiglia.tappe[0].join(". ")
    : "";
  const conserva = typeof famiglia?.conserva === "string" ? famiglia.conserva : "";
  blocchi.push(
    "The shape of the story is FIXED: it comes from its family, and you must not invent it or change it.\n" +
    `Day one always begins from this exact state: ${partenza}\n` +
    `For the whole week, these must stay identical: ${conserva}\n` +
    "The setting you invent MUST already contain every one of those unchangeable things — " +
    "otherwise the fixed script would describe a scene that does not exist."
  );

  // 2. Cosa inventare, campo per campo, coi limiti del contratto di catalogo.
  blocchi.push(
    "You invent ONLY the subject and its world:\n" +
    `- "nome": the human name of the story, in ITALIAN, 1-2 words, at most ${LIMITI_ELEMENT.nome} characters.\n` +
    `- "s": in English, a noun phrase that STARTS WITH AN ARTICLE (for example "the copper kettle"), ` +
    `at most ${LIMITI_ELEMENT.s} characters. It is substituted into the fixed script sentences in place of the subject, ` +
    "so it must read naturally inside them.\n" +
    `- "soggetto": in English, a neutral short name of the subject, at most ${LIMITI_ELEMENT.soggetto} characters.\n` +
    `- "setting": in English, at most ${LIMITI_ELEMENT.setting} characters: the world around the subject ` +
    "(where it stands, the light, what is behind it). It must already contain everything declared unchangeable above, " +
    "and must describe the scene BEFORE the story begins.\n" +
    `- "style": in English, at most ${LIMITI_ELEMENT.style} characters: rendering and light.\n` +
    `- "palette": in English, at most ${LIMITI_ELEMENT.palette} characters: three or four colours.`
  );

  // 3. Due esempi veri della stessa famiglia: danno registro e lunghezza,
  //    non modelli da copiare.
  if (esempi.length > 0) {
    const righe = esempi.map((e) => JSON.stringify(esempioJson(e))).join("\n");
    blocchi.push(
      "Two real examples from the same family, given for register and length only — do not copy them:\n" +
      righe
    );
  }

  // 4. Cosa evitare: i soggetti recenti del canale, uno per riga.
  if (daEvitare.length > 0) {
    blocchi.push(
      "The following subjects have already been used on this channel: do not repeat any of them, " +
      "do not paraphrase any of them, and invent something clearly different from all of them:\n" +
      daEvitare.map((n) => `- ${n}`).join("\n")
    );
  }

  // 5. Divieti di composizione: stessi vincoli del WALLPAPER_SUFFIX usato per
  //    le immagini, espressi per il setting che il modello sta inventando.
  blocchi.push(
    "Composition bans: never any text, letters, numbers, watermark, logo, people, faces, " +
    "animals with faces or recognisable brands in the setting. " +
    "This is a vertical phone wallpaper: keep the upper third clear and uncluttered."
  );

  return { system, user: blocchi.join("\n\n") };
}

/**
 * Interpreta la risposta del modello in modo tollerante: accetta JSON nudo,
 * JSON dentro un blocco ```json, e JSON preceduto o seguito da chiacchiere
 * (in quel caso si prende dalla prima graffa aperta all'ultima chiusa), e
 * anche un oggetto già pronto. Non lancia MAI: spazzatura, stringa vuota,
 * null o undefined diventano null.
 */
export function interpretaRisposta(testo) {
  try {
    // Risposta già oggetto (Workers AI a volte non incatena nulla): OK così.
    if (testo !== null && typeof testo === "object") return testo;
    if (typeof testo !== "string") return null;
    let t = testo.trim();
    if (t === "") return null;

    // Fence ```json ... ```: si estrae il contenuto e si prosegue con quello.
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence) t = fence[1].trim();

    // Parse diretto; se il testo ha chiacchiere attorno, si prova la finestra
    // dalla prima graffa all'ultima (limite noto e accettato: chiacchiere che
    // contengono loro delle graffe rompono la finestra — e in quel caso si
    // ripiega sulla pesca normale, mai un danno irreversibile).
    try {
      return oggettoOParso(JSON.parse(t));
    } catch {
      const inizio = t.indexOf("{");
      const fine = t.lastIndexOf("}");
      if (inizio === -1 || fine <= inizio) return null;
      return oggettoOParso(JSON.parse(t.slice(inizio, fine + 1)));
    }
  } catch {
    return null;
  }
}

/** Il parse è andato a buon fine: è accettabile solo se è un oggetto vero. */
function oggettoOParso(v) {
  return v !== null && typeof v === "object" ? v : null;
}

/**
 * Dal JSON grezzo del modello al corpo pronto per saveElement, o null.
 *
 * Fa il trim di ogni stringa; se manca un campo obbligatorio o è vuoto dopo
 * il trim ritorna null (il modello ha disobbedito al contratto: si ripiega,
 * non si completa a mano); taglia ogni campo alla lunghezza massima presa da
 * LIMITI_ELEMENT (validazione.js) — la STESSA misura con cui saveElement
 * validerà: nessuna soglia scritta in due posti che può divergere.
 *
 * Il risultato porta SEMPRE i campi fissi del contratto: `tappe: null` (le
 * tappe si ereditano dalla famiglia, vedi il ragionamento in testa al file),
 * `extra: null`, `pubblicato: true` (nasce già sul canale), `auto: true` (è
 * roba della macchina: la pota di potaGenerati lo sa), il canale e il
 * creatoIl ricevuti, e `soloSeNuovo: true` (una creazione non deve mai
 * sovrascrivere per sbaglio un id esistente).
 */
export function normalizzaElement(grezzo, { id, famigliaNativa, canale, creatoIl }) {
  if (!grezzo || typeof grezzo !== "object") return null;
  const taglia = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const nome = taglia(grezzo.nome, LIMITI_ELEMENT.nome);
  const s = taglia(grezzo.s, LIMITI_ELEMENT.s);
  const soggetto = taglia(grezzo.soggetto, LIMITI_ELEMENT.soggetto);
  const setting = taglia(grezzo.setting, LIMITI_ELEMENT.setting);
  const style = taglia(grezzo.style, LIMITI_ELEMENT.style);
  const palette = taglia(grezzo.palette, LIMITI_ELEMENT.palette);
  if (!nome || !s || !soggetto || !setting || !style || !palette) return null;
  return {
    id,
    nome,
    s,
    soggetto,
    setting,
    style,
    palette,
    famigliaNativa,
    tappe: null,
    extra: null,
    pubblicato: true,
    canale,
    auto: true,
    creatoIl,
    soloSeNuovo: true,
  };
}

/**
 * I nomi dei concept già usati di recente sul canale, da passare come
 * `daEvitare`: gli id in `prevState.usati` risolti al loro nome quando
 * possibile (custom dal catalogo, built-in dalla libreria), più i nomi degli
 * element generati dalla macchina (auto === true) già presenti sul canale.
 * Senza duplicati. Non lancia mai; con input vuoti o corrotti ritorna [].
 */
export function nomiRecenti(prevState, catalog, channel) {
  const nomi = [];
  const aggiungi = (n) => {
    if (typeof n === "string" && n.trim() !== "" && !nomi.includes(n)) nomi.push(n);
  };
  try {
    const usati = Array.isArray(prevState?.usati) ? prevState.usati : [];
    for (const id of usati) {
      const custom = catalog?.elements?.[id];
      if (custom?.nome) {
        aggiungi(custom.nome);
        continue;
      }
      const builtin = getElement(id); // undefined per id ignoti: si salta
      if (builtin?.nome) aggiungi(builtin.nome);
    }
    for (const el of Object.values(catalog?.elements || {})) {
      if (el?.auto === true && el?.nome && el?.canale === channel?.id) aggiungi(el.nome);
    }
  } catch (err) {
    // Stato o catalogo corrotti non devono mai fare fallire un arco nuovo:
    // senza elenco "da evitare" si inventa comunque, solo meno informati.
    console.warn(`[inventa] nomiRecenti: elenco incompleto (${err?.message ?? err})`);
  }
  return nomi;
}

/* ===================== L'UNICA FUNZIONE CHE TOCCA LA RETE ===================== */

/**
 * Inventa l'element del nuovo arco: famiglia → id → prompt → modello di testo
 * → normalizza → salva nel catalogo. Ritorna `{ id, nome }` oppure null.
 *
 * Il null non è un errore da gestire ma un ESITO NORMALE: significa "oggi si
 * pesca dalla libreria". Tutti i guasti possibili (modello inesistente, quota
 * finita, rete giù, JSON illeggibile, catalogo che rifiuta la scrittura) si
 * loggano qui e si chiudono in null — mai una eccezione verso il chiamante,
 * che altrimenti dovrebbe conoscere i dettagli della catena di fallback.
 *
 * `catalog` è il catalogo custom già caricato (serve a idInventato per le
 * collisioni); `adesso` è il timestamp ISO che marcherà `creatoIl` — lo passa
 * il chiamante, qui non si legge mai l'orologio di sistema.
 */
export async function inventaElement(env, channel, { catalog, arcIndex, daEvitare = [], adesso } = {}) {
  try {
    const canaleId = channel?.id ?? "canale-sconosciuto";

    // 1. La famiglia di quest'arco e l'id libero nel catalogo. Se mancano,
    //    si esce subito: chiamare il modello sarebbe un costo buttato.
    const famigliaId = famigliaDelTurno(channel, arcIndex);
    if (!famigliaId) {
      console.warn(`[inventa] ${canaleId}: nessuna famiglia disponibile per l'arco ${arcIndex}, rinuncio`);
      return null;
    }
    const famiglia = allFamilies(catalog)[famigliaId];
    if (!famiglia) {
      console.warn(`[inventa] ${canaleId}: famiglia "${famigliaId}" sconosciuta, rinuncio`);
      return null;
    }
    const id = idInventato(canaleId, arcIndex, catalog);
    if (!id) {
      console.warn(`[inventa] ${canaleId}: nessun id libero nel catalogo per l'arco ${arcIndex}, rinuncio`);
      return null;
    }

    // 2. Il prompt: copione fisso della famiglia + esempi built-in rotanti +
    //    i nomi da evitare. Il modello inventa solo soggetto e mondo.
    const esempi = esempiPerFamiglia(famigliaId, arcIndex, ELEMENTS);
    const { system, user } = costruisciPrompt({ famiglia, esempi, daEvitare });
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    // 3. I tentativi: prima il primario, poi il fallback, al massimo
    //    INVENZIONE_MAX_TENTATIVI chiamate IN TUTTO.
    const modelli = [CONFIG.TEXT_MODEL_PRIMARY, CONFIG.TEXT_MODEL_FALLBACK];
    for (let tentativo = 1; tentativo <= CONFIG.INVENZIONE_MAX_TENTATIVI; tentativo++) {
      const modello = modelli[(tentativo - 1) % modelli.length];
      try {
        const out = await env.AI.run(modello, { messages, max_tokens: 700 });
        // Workers AI risponde di solito { response: "..." }, ma a volte l'oggetto
        // arriva già smontato: entrambe le forme finiscono in interpretaRisposta.
        const grezzo = interpretaRisposta(out?.response !== undefined ? out.response : out);
        if (!grezzo) {
          console.warn(`[inventa] ${canaleId}: risposta illeggibile da ${modello} (tentativo ${tentativo})`);
          continue;
        }
        const corpo = normalizzaElement(grezzo, {
          id,
          famigliaNativa: famigliaId,
          canale: canaleId,
          creatoIl: adesso,
        });
        if (!corpo) {
          console.warn(`[inventa] ${canaleId}: risposta incompleta da ${modello} (tentativo ${tentativo}): manca un campo obbligatorio`);
          continue;
        }

        // 4. Il salvataggio è la validazione severa del catalogo: se rifiuta,
        //    si logga il perché e si usa il tentativo che resta.
        const salvataggio = await saveElement(env, corpo);
        if (!salvataggio.ok) {
          console.error(
            `[inventa] ${canaleId}: saveElement ha rifiutato "${id}" (tentativo ${tentativo}): ` +
            salvataggio.errori.join("; ")
          );
          continue;
        }

        console.log(
          `[inventa] ${canaleId}: inventato "${id}" ("${corpo.nome}", famiglia ${famigliaId}) con ${modello}`
        );
        return { id, nome: corpo.nome };
      } catch (err) {
        console.warn(`[inventa] ${canaleId}: tentativo ${tentativo} su ${modello} fallito: ${err?.message ?? err}`);
      }
    }

    // 5. Tentativi finiti: si rinuncia. Il chiamante pescherà dalla libreria.
    console.warn(
      `[inventa] ${canaleId}: rinuncio a inventare il concept dell'arco ${arcIndex}, ` +
      "il chiamante pescherà dalla libreria"
    );
    return null;
  } catch (err) {
    // Rete di sicurezza finale: QUALUNQUE cosa esploda sopra (incluso un KV
    // che rifiuta la scrittura dentro saveElement) resta qui dentro.
    console.error(`[inventa] invenzione fallita, ripiego sulla pesca normale: ${err?.message ?? err}`);
    return null;
  }
}
