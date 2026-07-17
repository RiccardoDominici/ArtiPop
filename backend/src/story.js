// Evoluzione giornaliera della "storia" di un canale.
//
// Ogni canale ha uno stato persistente in KV:
//   { dayNumber, arcIndex, dayInArc, arcTheme, scene, seed, lastDate, history }
//
// Ogni giorno la scena evolve leggermente (stesso mondo, il tempo passa, il viaggio
// avanza di qualche passo). Ogni ARC_LENGTH_DAYS giorni si apre un nuovo arco:
// nuovo tema (dalla lista `journey` del canale) e nuovo seed.
//
// COERENZA STRUTTURALE — il sistema ha tre livelli di garanzia, in cascata:
//   1. Identità fissa nel prompt immagine: `style` + `palette` del canale entrano in
//      OGNI prompt, quindi anche una scena "creativa" resta nel look del canale.
//   2. LLM vincolato: riceve tema dell'arco + ultime scene, con regole esplicite
//      ("stesso luogo, cambia solo 1-2 dettagli") e poca libertà.
//   3. Validazione anti-deriva: la scena proposta dall'LLM viene ACCETTATA solo se
//      resta ancorata al vocabolario del canale/arco e non è un duplicato; in caso
//      contrario si usa la composizione deterministica (tappa + momento + meteo),
//      che è coerente per costruzione. Il canale non può "fare quello che gli pare".

import { CONFIG } from "./config.js";

/** Hash FNV-1a → intero positivo stabile: seed riproducibile per canale+arco. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2147483647;
}

/** Data di "oggi" nel fuso configurato, formato YYYY-MM-DD. */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Giorni interi trascorsi dall'epoch per una data YYYY-MM-DD (per indici deterministici). */
export function dayNumberOf(dateKey) {
  return Math.floor(Date.parse(dateKey + "T00:00:00Z") / 86400000);
}

/** Parole "di contenuto" (>3 lettere) di un testo, minuscole, senza punteggiatura. */
function contentWords(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-zà-ù\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length > 3)
  );
}

/** Pulisce la risposta dell'LLM: una riga, senza virgolette/markdown, lunghezza sana. */
function sanitizeScene(text) {
  if (typeof text !== "string") return null;
  let t = text
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'\s`*#>-]+|["'\s`*]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  t = t.replace(/^(scene|description|today|tomorrow)\s*[:\-]\s*/i, "").trim();
  if (t.length < 15 || t.length > 400) return null;
  return t;
}

/**
 * Guardia anti-deriva: la scena proposta è accettabile solo se
 *   a. condivide almeno una parola di contenuto con l'ancora del canale/arco
 *      (tema dell'arco + stile del canale + scena di ieri), e
 *   b. non è identica (o quasi) a una delle scene recenti, e
 *   c. non contiene elementi vietati per un wallpaper (testo, watermark, persone note).
 * Ritorna true se la scena è coerente.
 */
function isCoherent(scene, channel, arcTheme, history) {
  const sceneWords = contentWords(scene);

  // (a) ancoraggio: overlap col vocabolario di canale+arco+ieri
  const anchor = contentWords(`${arcTheme} ${channel.style} ${history[0] ?? ""}`);
  let overlap = 0;
  for (const w of sceneWords) if (anchor.has(w)) overlap++;
  if (overlap === 0) return false;

  // (b) anti-ristagno: non ripetere quasi-identica una scena recente
  for (const past of history) {
    const pastWords = contentWords(past);
    if (pastWords.size === 0) continue;
    let same = 0;
    for (const w of sceneWords) if (pastWords.has(w)) same++;
    const similarity = same / Math.max(sceneWords.size, 1);
    if (similarity > 0.85) return false;
  }

  // (c) contenuti vietati nel wallpaper
  if (/\b(text|watermark|logo|signature|caption|lyrics)\b/i.test(scene)) return false;

  return true;
}

/** Prova i modelli testo in ordine; ritorna la scena evoluta o null se tutti falliscono. */
async function evolveWithLLM(env, channel, arcTheme, history, isNewArc) {
  const recent = history.slice(0, 3);
  const system =
    "You continue a slow visual story told through one phone wallpaper per day. " +
    "You write a single, concise, purely visual scene description. " +
    "Hard rules: stay in the SAME world and place type; keep the same color mood; " +
    "no readable text in the scene, no faces, no violence. " +
    "Reply with ONLY the description, one line, max 35 words.";

  const user = isNewArc
    ? `World identity: ${channel.style}. Palette: ${channel.palette}. ` +
      `A new chapter begins, theme: "${arcTheme}". The previous chapter ended with: "${recent[0] ?? channel.firstScene}". ` +
      `Write the OPENING scene of the new chapter: a fresh place, same world and style.`
    : `World identity: ${channel.style}. Palette: ${channel.palette}. Chapter theme: "${arcTheme}". ` +
      `The last days were:\n` +
      recent.map((s, i) => `- ${i === 0 ? "yesterday" : `${i + 1} days ago`}: "${s}"`).join("\n") +
      `\nWrite TODAY's scene: the same place one day later. The journey advances a few steps; ` +
      `change EXACTLY 1 or 2 details (light, weather, vantage point). Keep everything else identical.`;

  for (const model of CONFIG.TEXT_MODELS) {
    try {
      const res = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 120,
        temperature: 0.8,
      });
      const scene = sanitizeScene(res?.response);
      if (!scene) {
        console.warn(`[story] ${channel.id}: risposta non valida da ${model}`);
        continue;
      }
      if (!isCoherent(scene, channel, arcTheme, history)) {
        console.warn(`[story] ${channel.id}: scena RIFIUTATA dalla guardia anti-deriva: "${scene}"`);
        continue;
      }
      console.log(`[story] ${channel.id}: scena evoluta con ${model}`);
      return scene;
    } catch (err) {
      console.warn(`[story] ${channel.id}: ${model} fallito: ${err.message}`);
    }
  }
  return null;
}

/** Fallback deterministico: scena composta da tappa + momento + meteo, sempre diversa
 *  e coerente per costruzione (usa solo vocabolario del canale). */
function deterministicScene(channel, arcTheme, dayNumber) {
  const moment = channel.moments[dayNumber % channel.moments.length];
  const weather = channel.weathers[(dayNumber + 2) % channel.weathers.length];
  return `${arcTheme}, ${moment}, ${weather}`;
}

/**
 * Calcola lo stato di oggi a partire da quello di ieri (o inizializza il canale).
 * Ritorna il nuovo stato completo, pronto da salvare in KV.
 */
export async function evolveStory(env, channel, prevState, dateKey) {
  // I canali a progressione hanno un motore dedicato (piano fisso di 12 tappe).
  if (channel.mode === "progression") {
    return evolveProgression(env, channel, prevState, dateKey);
  }
  const dayNumber = dayNumberOf(dateKey);

  // Primo giorno in assoluto del canale: si parte dalla firstScene.
  // Questo giorno è il KEYFRAME dell'arco: generazione pulita, e la sua data
  // (anchorDate) farà da àncora visiva per tutti i giorni successivi dell'arco.
  if (!prevState || !prevState.scene) {
    const arcTheme = channel.journey[0];
    return {
      lastDate: dateKey,
      dayNumber,
      arcIndex: 0,
      dayInArc: 0,
      arcTheme,
      scene: channel.firstScene,
      seed: fnv1a(`${channel.id}:arc:0`),
      history: [channel.firstScene],
      anchorDate: dateKey,
    };
  }

  // Giorni trascorsi dall'ultima generazione (di norma 1; di più se il cron ha saltato).
  const elapsed = Math.max(1, dayNumber - (prevState.dayNumber ?? dayNumber - 1));
  let dayInArc = (prevState.dayInArc ?? 0) + elapsed;
  let arcIndex = prevState.arcIndex ?? 0;
  let arcTheme = prevState.arcTheme ?? channel.journey[0];

  // Nuovo arco: capitolo successivo del viaggio, nuovo seed per composizioni fresche.
  const isNewArc = dayInArc >= CONFIG.ARC_LENGTH_DAYS;
  if (isNewArc) {
    arcIndex += 1;
    dayInArc = 0;
    arcTheme = channel.journey[arcIndex % channel.journey.length];
  }

  // Storico recente (più recente per primo) per continuità e guardia anti-deriva.
  const history = Array.isArray(prevState.history)
    ? prevState.history.slice(0, 5)
    : [prevState.scene];

  const llmScene = await evolveWithLLM(env, channel, arcTheme, history, isNewArc);
  const scene = llmScene ?? deterministicScene(channel, arcTheme, dayNumber);
  if (!llmScene) {
    console.warn(`[story] ${channel.id}: uso il fallback deterministico`);
  }

  return {
    lastDate: dateKey,
    dayNumber,
    arcIndex,
    dayInArc,
    arcTheme,
    scene,
    // Seed stabile per tutto l'arco: composizioni imparentate giorno dopo giorno.
    seed: fnv1a(`${channel.id}:arc:${arcIndex}`),
    history: [scene, ...history].slice(0, 5),
    // Àncora visiva: il keyframe dell'arco. "Anchor, don't chain" (letteratura
    // 2025-26 su drift iterativo): ogni giorno si edita il keyframe PULITO, non
    // l'output di ieri, così la degradazione non si accumula mai.
    anchorDate: isNewArc ? dateKey : (prevState.anchorDate ?? prevState.lastDate),
  };
}


/* =====================  CANALI A PROGRESSIONE  =====================
   Un arco = un "progetto" (un quadro che si dipinge, una pianta che cresce)
   che si completa in esattamente 12 giorni. All'inizio dell'arco si scrive un
   PIANO di 12 tappe (LLM, con fallback ai template del canale): ogni giorno
   mostra la tappa corrispondente — un cambiamento visibile e cumulativo,
   mentre il resto della scena resta fermo. */

/** Applica {s} = nome breve del progetto ai template deterministici del canale.
 *  Si usa il `noun` (es. "the sunflower"), MAI il subject completo: nominare il
 *  risultato finale nelle prime tappe fa generare subito il progetto completo. */
function stagesFromTemplates(channel, project) {
  const name = project.noun ?? project.subject;
  return channel.stageTemplates.map((t) => t.replaceAll("{s}", name));
}

/** Chiede all'LLM un piano di 12 tappe visive; null se non utilizzabile. */
async function makePlanWithLLM(env, channel, subject) {
  const sys =
    "You plan a slow visual story told in 12 daily images of the SAME fixed scene. " +
    "Reply with EXACTLY 12 numbered lines. Each line: one clearly visible new change " +
    "(something appears, grows or gets completed), purely visual, max 18 words. " +
    "Line 1 = the very beginning (almost nothing yet). Line 12 = complete. " +
    "No text in the scene, no people, no violence.";
  const usr =
    `Scene (never changes): ${channel.setting}. ` +
    `Project that progresses day by day: ${subject}. ` +
    `Write the 12 daily steps.`;
  for (const model of CONFIG.TEXT_MODELS) {
    try {
      const res = await env.AI.run(model, {
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        max_tokens: 600,
        temperature: 0.7,
      });
      const lines = String(res?.response || "")
        .split(/\n+/)
        .map((l) => l.replace(/^\s*\d+[\).\:\-]?\s*/, "").trim())
        .filter((l) => l.length >= 8 && l.length <= 160);
      if (lines.length >= 10) {
        console.log(`[story] piano di progressione scritto da ${model} (${lines.length} tappe)`);
        return lines.slice(0, 12);
      }
      console.warn(`[story] piano LLM non valido da ${model} (${lines.length} righe utili)`);
    } catch (err) {
      console.warn(`[story] piano LLM fallito con ${model}: ${err.message}`);
    }
  }
  return null;
}

/** Evoluzione per canali a progressione: piano fisso, una tappa al giorno. */
async function evolveProgression(env, channel, prevState, dateKey) {
  const dayNumber = dayNumberOf(dateKey);
  const stagesCount = channel.stageTemplates.length; // 12

  const startArc = async (arcIndex) => {
    const project = channel.projects[arcIndex % channel.projects.length];
    // Piano = template curati del canale (deterministici, descrivono esplicitamente
    // il progetto che avanza). Il planner LLM (makePlanWithLLM) è disattivato:
    // nei test produceva piani fuori bersaglio (oggetti di contorno invece del
    // progetto). Riattivabile qui quando ci sarà un validatore più severo.
    const plan = stagesFromTemplates(channel, project);
    void makePlanWithLLM; // referenza per evitare warning di funzione inutilizzata
    return {
      lastDate: dateKey,
      dayNumber,
      arcIndex,
      dayInArc: 0,
      arcTheme: project.subject,
      plan,
      scene: `${channel.setting}, ${plan[0]}`,
      seed: fnv1a(`${channel.id}:arc:${arcIndex}`),
      anchorDate: dateKey,
    };
  };

  // Primo giorno in assoluto del canale.
  if (!prevState || !prevState.scene) return startArc(0);

  const elapsed = Math.max(1, dayNumber - (prevState.dayNumber ?? dayNumber - 1));
  let dayInArc = (prevState.dayInArc ?? 0) + elapsed;

  // Progetto completato: si apre il successivo (nuovo keyframe, nuova àncora).
  if (dayInArc >= stagesCount) return startArc((prevState.arcIndex ?? 0) + 1);

  const plan = Array.isArray(prevState.plan) && prevState.plan.length >= 10
    ? prevState.plan
    : stagesFromTemplates(channel, channel.projects[(prevState.arcIndex ?? 0) % channel.projects.length]);

  return {
    ...prevState,
    lastDate: dateKey,
    dayNumber,
    dayInArc,
    plan,
    scene: plan[Math.min(dayInArc, plan.length - 1)],
    prevDate: prevState.lastDate, // data di ieri: serve come riferimento visivo
  };
}

/**
 * Prompt di EDIT ADDITIVO per canali a progressione:
 * image 0 = ieri (contenuto da preservare), image 1 = keyframe (qualità/stile).
 */
export function buildProgressPrompt(channel, stageText) {
  return (
    `Image 0 is yesterday's state of this scene. Today one visible change happens: ${stageText}. ` +
    `Add ONLY this change on top of image 0. Every other part of image 0 stays exactly identical: ` +
    `same viewpoint, same framing, same objects, same light, same colors. ` +
    `The change affects only its own subject; the rest of the scene remains a realistic photograph. ` +
    `Match the crisp clean quality of image 1. ${CONFIG.WALLPAPER_SUFFIX}`
  );
}

/** Variante con la sola àncora (se l'immagine di ieri non è recuperabile). */
export function buildCumulativePrompt(channel, stageText, dayInArc) {
  return (
    `Image 0 is this scene at its very beginning. Show the same exact scene ${dayInArc} days later ` +
    `in its story, when: ${stageText}. All earlier progress has already happened. ` +
    `Keep the viewpoint, framing and light of image 0 identical. ` +
    `Style: ${channel.style}. ${CONFIG.WALLPAPER_SUFFIX}`
  );
}

/** Prompt per generazione PULITA (keyframe: primo giorno assoluto o nuovo arco). */
export function buildImagePrompt(channel, scene) {
  return `${scene}. Style: ${channel.style}. Colors: ${channel.palette}. ${CONFIG.WALLPAPER_SUFFIX}`;
}

/**
 * Prompt per generazione CON RIFERIMENTO (image 0 = keyframe dell'arco).
 * FLUX.2 è un editor guidato da istruzioni: si dichiara il delta cumulativo
 * rispetto all'àncora ("N giorni dopo") e si chiede esplicitamente di
 * preservare luogo, composizione e inquadratura ("change X / keep Y",
 * pattern raccomandato dalla prompting guide di Black Forest Labs).
 */
export function buildEditPrompt(channel, scene, daysSinceAnchor = 1) {
  const when =
    daysSinceAnchor === 0 ? "at the very same moment"
    : daysSinceAnchor <= 1 ? "one day later"
    : `${daysSinceAnchor} days later`;
  return (
    `This is the exact same place as image 0, seen ${when} in its slow story: ${scene}. ` +
    `Keep the location, composition, camera angle and framing of image 0 unchanged; ` +
    `change only the light, weather and the small evolutions described. ` +
    `Style: ${channel.style}. ${CONFIG.WALLPAPER_SUFFIX}`
  );
}
