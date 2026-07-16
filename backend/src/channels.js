// Definizione dei canali ("ondate") di ArtiPop.
//
// Ogni canale è un mondo visivo con un'identità fissa (style + palette) che lo rende
// riconoscibile, e una storia che evolve giorno per giorno: la scena di oggi nasce
// da quella di ieri, e ogni ~12 giorni si apre un nuovo "arco" (capitolo) del viaggio.
//
// - `style` e `palette` entrano in OGNI prompt: garantiscono coerenza visiva nel tempo.
// - `firstScene` è il capitolo 1 in assoluto del canale.
// - `journey` è la lista di tappe/temi: ispira i nuovi archi (e guida il fallback
//   deterministico quando l'LLM non è disponibile).
// - `moments` e `weathers` sono variazioni giornaliere per il fallback deterministico.

export const CHANNELS = [
  {
    id: "atelier",
    name: "Atelier",
    emoji: "🎨",
    active: true,
    accent: ["#e8b04b", "#a34a2b"],
    tagline: "Un quadro che si dipinge da solo, pennellata dopo pennellata",
    taglineEn: "A painting painting itself, brushstroke by brushstroke",
    mode: "progression",
    style:
      "cozy artist studio interior, warm window light, cinematic still-life photography, shallow depth of field",
    palette: "warm wood tones and cream canvas, the painting's own colors emerging day by day",
    setting:
      "a large blank canvas on a wooden easel in a cozy sunlit artist studio, brushes and a palette on a small side table",
    projects: [
      { subject: "an oil painting of a mountain landscape at sunrise" },
      { subject: "an oil painting of a stormy sea with a small lighthouse" },
      { subject: "an impressionist painting of a red poppy field under summer clouds" },
      { subject: "a moody watercolor of a rainy city street at dusk" },
      { subject: "a detailed painting of a red fox sitting in falling snow" },
      { subject: "a warm painting of a tuscan hillside with cypress trees" },
    ],
    stageTemplates: [
      "the canvas is still blank; a pencil rests on the easel ledge — {s} is about to begin",
      "the first faint pencil sketch lines of {s} appear on the canvas",
      "the sketch of {s} is complete; a few new paint tubes lie on the side table",
      "the first thin wash of background color covers the top of the canvas of {s}",
      "large soft blocks of underpainting fill half the canvas of {s}",
      "the whole canvas of {s} is covered in rough underpainting; a used rag hangs on the easel",
      "the main shapes of {s} are painted with real color and form",
      "rich details emerge across {s}; the palette on the table is now crowded with mixed colors",
      "fine details and highlights bring {s} to life; brushes soak in a jar of cloudy water",
      "deep shadows and glazes give {s} depth; the painting is nearly finished",
      "the final luminous touches are placed on {s}",
      "{s} is finished on the easel, glowing in the studio light, brushes resting at last",
    ],
  },
  {
    id: "horizon",
    name: "Horizon",
    emoji: "🏔️",
    active: false, // in pausa: si riattiva mettendo true
    accent: ["#7ec8a9", "#2b5f8a"], // gradiente ambient del sito per questo canale
    tagline: "Un viaggio senza fine attraverso i paesaggi della Terra",
    taglineEn: "A never-ending journey through Earth's landscapes",
    style:
      "cinematic landscape photography, soft natural light, atmospheric depth, gentle haze",
    palette: "earthy natural tones with one vivid accent color",
    firstScene:
      "a misty alpine valley at dawn, a winding path disappearing toward distant snow peaks",
    journey: [
      "alpine valleys and snow peaks",
      "high mountain passes above the clouds",
      "ancient pine forests",
      "still lake shores with mirror reflections",
      "rolling flower meadows",
      "dramatic coastal cliffs",
      "golden desert dunes",
      "deep canyon lands",
      "arctic tundra under vast skies",
      "volcanic highlands with black sand",
    ],
    moments: ["at dawn", "in soft morning light", "at golden hour", "at dusk", "under a starry sky", "in pale moonlight"],
    weathers: ["clear and calm", "with drifting mist", "after gentle rain", "with dramatic clouds", "with light falling snow", "in warm summer haze"],
  },
  {
    id: "neon",
    name: "Neon",
    emoji: "🌃",
    active: false, // in pausa: si riattiva mettendo true
    accent: ["#b06ab3", "#4568dc"],
    tagline: "Una megalopoli futura che cresce notte dopo notte",
    taglineEn: "A future megacity growing night after night",
    style:
      "cyberpunk cityscape, cinematic night photography, neon glow, wet reflective streets, volumetric light",
    palette: "deep blues and purples with electric neon accents",
    firstScene:
      "a quiet neon-lit alley in a rainy future city, holographic signs reflecting on wet asphalt",
    journey: [
      "rainy neon alleys",
      "elevated train lines between glass towers",
      "rooftop gardens above the smog line",
      "floating market districts",
      "monorail stations at midnight",
      "skyline views from a high balcony",
      "underground arcades and light tunnels",
      "harbor docks with robotic cranes",
      "hovercar highways in light trails",
      "the city seen from above the clouds",
    ],
    moments: ["at midnight", "in the blue hour", "just after sunset", "in the last light of dusk", "before dawn", "under a full moon"],
    weathers: ["in pouring rain", "with rising steam", "in thin fog", "after the rain, streets still wet", "with drifting snow", "under a clear night sky"],
  },
  {
    id: "cosmos",
    name: "Cosmos",
    emoji: "🪐",
    active: false, // in pausa: si riattiva mettendo true (riparte al cron successivo)
    accent: ["#5b4b8a", "#1a1a40"],
    tagline: "Una traversata interstellare, un giorno alla volta",
    taglineEn: "An interstellar crossing, one day at a time",
    style:
      "epic space art, ultra-detailed astrophotography style, sense of vast scale, soft cosmic glow",
    palette: "deep space blacks and indigos with luminous nebula colors",
    firstScene:
      "leaving a pale blue planet behind, its thin atmosphere glowing against the darkness of space",
    journey: [
      "leaving the home planet",
      "crossing an asteroid field",
      "approaching a ringed gas giant",
      "slingshot around a red dwarf star",
      "drifting through a luminous nebula",
      "passing a frozen wandering moon",
      "witnessing a distant supernova remnant",
      "skirting the edge of a black hole",
      "entering an uncharted star cluster",
      "arriving at a twin-sun system",
    ],
    moments: ["in deep silence", "at maximum velocity", "during a slow drift", "at the moment of arrival", "while turning back for one last look", "in the glow of distant stars"],
    weathers: ["among sparse stardust", "in a storm of micro-meteors", "bathed in nebula light", "in perfect starlight clarity", "crossing a comet's tail", "within an aurora of charged particles"],
  },
  {
    id: "bloom",
    name: "Bloom",
    emoji: "🌸",
    active: true,
    accent: ["#f6a5c0", "#8fd3b6"],
    tagline: "Una pianta che cresce giorno dopo giorno, dal seme al fiore",
    taglineEn: "A plant growing day by day, from seed to flower",
    // Canale A PROGRESSIONE: ogni arco è un "progetto" che si completa in 12
    // giorni; ogni giorno aggiunge UN cambiamento visibile alla stessa scena.
    mode: "progression",
    setting:
      "a terracotta pot of dark soil on a stone windowsill in soft morning light, blurred garden behind the glass",
    projects: [
      { subject: "a single sunflower growing from a seed to a tall full golden bloom" },
      { subject: "a cherry branch in a glass vase going from bare wood to full pink blossom" },
      { subject: "a climbing rose slowly colonizing an old wooden trellis with leaves and red roses" },
      { subject: "a fern unfurling from a tight spiral into wide green fronds" },
      { subject: "a cactus slowly growing and finally opening one bright pink flower" },
      { subject: "an amaryllis bulb sending up a stalk that opens into huge red trumpet flowers" },
    ],
    // Fallback deterministico: 12 tappe generiche con {s} = soggetto del progetto.
    stageTemplates: [
      "the pot of bare dark soil, nothing has sprouted yet — the very beginning of {s}",
      "a tiny pale green sprout has just broken through the soil of {s}",
      "the sprout of {s} stands taller, its first two seed leaves open",
      "{s}: a slim stem rises, the first true leaf unfolding",
      "{s}: the stem thickens, three or four young leaves catch the light",
      "{s}: clearly taller now, a healthy cluster of leaves",
      "{s}: the first tight bud has formed at the top",
      "{s}: the bud swells, a hint of color showing at its tip",
      "{s}: the bud has begun to open, first petals visible",
      "{s}: half open now, the flower's color is unmistakable",
      "{s}: almost fully open, petals spreading wide",
      "{s}: in full glorious bloom, complete and radiant",
    ],
    style:
      "delicate botanical illustration, soft focus macro, dreamy minimalism, gentle bokeh",
    palette: "soft pastels with fresh botanical greens",
    firstScene:
      "a single cherry branch in early bloom against a soft pastel morning sky",
    journey: [
      "cherry blossoms of early spring",
      "wild tulip fields",
      "a pond of water lilies",
      "summer wildflower meadows",
      "lavender rows at dusk",
      "sunflowers turning with the light",
      "maple leaves catching autumn fire",
      "chrysanthemums in morning fog",
      "frost patterns on winter branches",
      "the first snowdrops piercing the snow",
    ],
    moments: ["in early morning dew", "in soft noon light", "at golden afternoon", "at dusk", "under a paper moon", "in first light"],
    weathers: ["with petals drifting in the breeze", "after light rain, drops on petals", "in gentle sunshine", "in thin morning fog", "with the first frost", "under a warm haze"],
  },
  {
    id: "depths",
    name: "Depths",
    emoji: "🌊",
    active: false, // in pausa: si riattiva mettendo true (riparte al cron successivo)
    accent: ["#2193b0", "#0b3954"],
    tagline: "Una discesa lenta negli abissi dell'oceano",
    taglineEn: "A slow descent into the ocean's abyss",
    style:
      "underwater photography, rays of light through water, suspended particles, serene deep blue mood",
    palette: "gradient of ocean blues from turquoise to abyssal navy",
    firstScene:
      "sunlit turquoise shallows above a coral garden, light rays dancing on the sand",
    journey: [
      "sunlit coral shallows",
      "seagrass meadows with sea turtles",
      "a school of silver fish in open blue",
      "the edge of the continental shelf",
      "a slow descent along a reef wall",
      "kelp forest cathedral light",
      "manta rays gliding in twilight waters",
      "bioluminescent creatures of the midnight zone",
      "an ancient shipwreck claimed by coral",
      "the silent abyssal plain",
    ],
    moments: ["in bright midday light", "in slanted afternoon rays", "at the blue hour of the deep", "in twilight waters", "in bioluminescent darkness", "at first light filtering down"],
    weathers: ["in crystal-clear water", "among drifting plankton", "with a gentle current", "in a cloud of tiny bubbles", "in deep still silence", "with shafts of storm light from above"],
  },
  {
    id: "aurora",
    name: "Aurora",
    emoji: "🎨",
    active: false, // in pausa: si riattiva mettendo true (riparte al cron successivo)
    accent: ["#f7b733", "#fc4a67"],
    tagline: "Forme e colori astratti in lenta metamorfosi",
    taglineEn: "Abstract shapes and colors in slow metamorphosis",
    style:
      "abstract minimal art, smooth flowing gradients, silk-like forms, elegant negative space",
    palette: "a slowly rotating harmony of two or three complementary hues",
    firstScene:
      "soft waves of rose and amber silk flowing diagonally through empty space",
    journey: [
      "flowing silk waves",
      "layered translucent glass panes",
      "slow liquid marble swirls",
      "drifting gradient dunes",
      "aurora curtains of pure color",
      "floating ink clouds in water",
      "folded paper light and shadow",
      "melting color fields",
      "threads of light weaving patterns",
      "breathing gradient horizons",
    ],
    moments: ["in warm tones", "in cool tones", "in twilight tones", "in muted pastel tones", "in deep jewel tones", "in monochrome with one accent"],
    weathers: ["flowing gently", "almost still", "in slow rotation", "dissolving at the edges", "sharpening into focus", "breathing in and out"],
  },
];

/** Solo i canali attivi: il cron genera e il sito mostra soltanto questi.
 * I canali con active:false restano definiti (e il loro archivio resta in KV):
 * per riattivarli basta rimettere active:true e rideployare. */
export const ACTIVE_CHANNELS = CHANNELS.filter((c) => c.active);

/** Ritorna il canale con l'id dato, oppure undefined. */
export function getChannel(id) {
  return CHANNELS.find((c) => c.id === id);
}
