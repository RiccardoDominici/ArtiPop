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
    id: "horizon",
    name: "Horizon",
    emoji: "🏔️",
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
    tagline: "Un giardino segreto che cambia con le stagioni",
    taglineEn: "A secret garden drifting through the seasons",
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

/** Ritorna il canale con l'id dato, oppure undefined. */
export function getChannel(id) {
  return CHANNELS.find((c) => c.id === id);
}
