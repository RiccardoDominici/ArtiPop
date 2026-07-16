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
