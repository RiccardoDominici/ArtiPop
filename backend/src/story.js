// Evoluzione giornaliera della "storia" di un canale.
//
// Ogni canale ha uno stato persistente in KV:
//   { dayNumber, arcIndex, dayInArc, arcTheme, scene, seed, lastDate }
//
// Ogni giorno la scena evolve leggermente (stesso mondo, il tempo passa, il viaggio
// avanza di qualche passo). Ogni ARC_LENGTH_DAYS giorni si apre un nuovo arco:
// nuovo tema (ispirato alla lista `journey` del canale) e nuovo seed.
//
// L'evoluzione usa un LLM gratuito di Workers AI; se non disponibile, un fallback
// deterministico compone comunque una scena sempre diversa (tappa + momento + meteo
// derivati dal numero del giorno), quindi il sistema non si ferma mai.

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

/** Pulisce la risposta dell'LLM: una riga, senza virgolette/markdown, lunghezza sana. */
function sanitizeScene(text) {
  if (typeof text !== "string") return null;
  let t = text
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'\s`*#>-]+|["'\s`*]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Alcuni modelli antepongono "Scene:" o simili — rimuoviamo etichette ovvie.
  t = t.replace(/^(scene|description|today|tomorrow)\s*[:\-]\s*/i, "").trim();
  if (t.length < 15 || t.length > 400) return null;
  return t;
}

/** Prova i modelli testo in ordine; ritorna la scena evoluta o null se tutti falliscono. */
async function evolveWithLLM(env, channel, arcTheme, prevScene, isNewArc) {
  const system =
    "You write a single, concise, purely visual scene description for an AI-generated phone wallpaper. " +
    "No people's faces, no text in the scene, no violence. Reply with ONLY the description, one line, max 35 words.";

  const user = isNewArc
    ? `Channel identity: ${channel.style}. New chapter theme: "${arcTheme}". ` +
      `Previous chapter ended with: "${prevScene}". ` +
      `Write the OPENING scene of the new chapter: a fresh place within the same world and style.`
    : `Channel identity: ${channel.style}. Current chapter theme: "${arcTheme}". ` +
      `Yesterday's scene: "${prevScene}". ` +
      `Write TODAY's scene: the same world one day later — advance the journey slightly ` +
      `(light changes, weather shifts, we move a little further). Keep strong continuity, change only 1-2 details.`;

  for (const model of CONFIG.TEXT_MODELS) {
    try {
      const res = await env.AI.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 120,
        temperature: 0.85,
      });
      const scene = sanitizeScene(res?.response);
      if (scene) {
        console.log(`[story] ${channel.id}: scena evoluta con ${model}`);
        return scene;
      }
      console.warn(`[story] ${channel.id}: risposta non valida da ${model}`);
    } catch (err) {
      console.warn(`[story] ${channel.id}: ${model} fallito: ${err.message}`);
    }
  }
  return null;
}

/** Fallback deterministico: scena composta da tappa + momento + meteo, sempre diversa. */
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

  const llmScene = await evolveWithLLM(env, channel, arcTheme, prevState.scene, isNewArc);
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
  };
}

/** Prompt finale per il generatore di immagini. */
export function buildImagePrompt(channel, scene) {
  return `${scene}. Style: ${channel.style}. Colors: ${channel.palette}. ${CONFIG.WALLPAPER_SUFFIX}`;
}
