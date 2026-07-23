// Definizione dei canali ("ondate") di ArtiPop.
//
// Ogni canale è un mondo visivo con un'identità fissa (style + palette) che lo rende
// riconoscibile, e una storia che evolve giorno per giorno: la scena di oggi nasce
// da quella di ieri, e ogni CONFIG.ARC_LENGTH_DAYS giorni (7 = una settimana) il
// canale cambia BASE e riparte con un nuovo "arco" (progetto/capitolo).
//
// - `style` e `palette` entrano in OGNI prompt: garantiscono coerenza visiva nel tempo.
// - `firstScene` è il capitolo 1 in assoluto del canale.
// - `journey` è la lista di tappe/temi: ispira i nuovi archi (e guida il fallback
//   deterministico quando l'LLM non è disponibile).
// - `moments` e `weathers` sono variazioni giornaliere per il fallback deterministico.

import { CONFIG } from "./config.js";

export const CHANNELS = [
  {
    id: "studio",
    name: "Studio",
    emoji: "📚",
    active: true,
    accent: ["#c98d5a", "#4a6b5d"],
    tagline: "Una scrivania vuota che si riempie di vita, un oggetto al giorno",
    taglineEn: "An empty desk filling with life, one object a day",
    mode: "progression",
    // "anchor-cumulative": ogni giorno si edita il KEYFRAME pulito (mai ieri)
    // con la lista cumulativa degli oggetti fin lì — le scene fotorealistiche
    // lisce accumulano macchie a ogni edit in catena (verificato due volte).
    refMode: "anchor-cumulative",
    // Una voce per giorno del ciclo: elenca ciò che si AGGIUNGE quel giorno.
    // index.js le concatena (slice(1, dayInArc+1)) per comporre la lista
    // cumulativa che descrive la scrivania di oggi partendo dal keyframe vuoto.
    stageSummaries: [
      "",
      "a lit warm desk lamp on the back corner, and a stack of two old books beside it",
      "a small potted green plant on the opposite corner, and a steaming ceramic cup near the front edge",
      "an open notebook with a pen across it in the middle, four more books on the stack, and a framed landscape print leaning against the wall",
      "{s} in the place of honor at the center back",
      "three small objects related to {s} arranged around it, and a string of tiny warm fairy lights on the wall above",
      "a lit candle and a second small plant in the last free corners",
    ],
    // Sfondo LISCIO di proposito: le texture fini (intonaco, pietra) accumulano
    // artefatti a ogni edit della catena (corruzione delle alte frequenze,
    // verificata empiricamente sul muro testurizzato della prima versione).
    style:
      "cozy interior still-life photography, warm soft window light, clean minimal background, shallow depth of field",
    palette: "warm wood, cream and amber tones",
    setting:
      "a sturdy wooden desk against a smooth plain warm-cream wall with no texture, seen straight on from the front, soft window light from the left",
    // Ogni arco la scrivania appartiene a qualcuno di diverso: il `noun` è
    // l'oggetto-firma che arriva a metà arco.
    // 12 progetti = 12 settimane prima che una base si ripeta (con archi da 7
    // giorni la rotazione è doppia rispetto a prima: 6 progetti basterebbero
    // per sole 6 settimane).
    projects: [
      { subject: "a writer's desk coming to life", noun: "a vintage typewriter" },
      { subject: "a botanist's desk coming to life", noun: "a glass terrarium with small ferns" },
      { subject: "a traveler's desk coming to life", noun: "an old globe and a leather journal" },
      { subject: "a musician's desk coming to life", noun: "a wooden violin resting on a small stand" },
      { subject: "an astronomer's desk coming to life", noun: "a small brass telescope" },
      { subject: "a painter's desk coming to life", noun: "a wooden paint box with tubes and brushes" },
      { subject: "a cartographer's desk coming to life", noun: "an unrolled old map and a brass compass" },
      { subject: "a watchmaker's desk coming to life", noun: "a watchmaker's loupe and a tray of tiny gears" },
      { subject: "a photographer's desk coming to life", noun: "a vintage film camera on a small tripod" },
      { subject: "a sailor's desk coming to life", noun: "a brass sextant and a ship in a bottle" },
      { subject: "a poet's desk coming to life", noun: "an inkwell with a feather quill and a bundle of letters" },
      { subject: "a chess player's desk coming to life", noun: "a wooden chess set mid-game" },
    ],
    // 7 tappe = il ciclo di vita di uno sfondo (CONFIG.ARC_LENGTH_DAYS).
    // Rispetto alle vecchie 12 ogni giorno porta DUE aggiunte invece di una:
    // con una settimana sola a disposizione i salti devono essere più grossi,
    // altrimenti l'arco non arriva mai alla scrivania "piena".
    stageTemplates: [
      "the wooden desk is completely empty and clean: bare desktop, bare wall, nothing on it at all",
      "a warm desk lamp is now lit on the back corner, and a stack of two old books stands beside it",
      "a small potted green plant now sits on the opposite corner, and a steaming ceramic cup near the front edge",
      "an open notebook with a pen lies in the middle, the book stack has DOUBLED, and a framed landscape print leans against the wall",
      "{s} now takes the place of honor at the center back of the desk",
      "three small objects related to {s} are arranged around it, and a string of tiny warm fairy lights glows on the wall above",
      "a lit candle and a second small plant fill the last empty corners: the desk is complete, cozy and warmly lit",
    ],
  },
  {
    id: "island",
    name: "Isola",
    emoji: "🏝️",
    active: true,
    accent: ["#7ec8e3", "#f2b878"],
    tagline: "Un'isola fluttuante che prende vita, un pezzo al giorno",
    taglineEn: "A floating island coming alive, one piece a day",
    mode: "progression",
    style:
      "whimsical fantasy illustration, painterly, soft volumetric light, sense of gentle wonder",
    palette: "soft sky pastels with warm golden accents",
    setting:
      "a small floating island drifting in a vast soft pastel sky above distant clouds, seen from slightly below",
    // 12 progetti: una base diversa ogni settimana per tre mesi (vedi nota su `studio`).
    projects: [
      { subject: "a floating island growing a cottage", noun: "a tiny stone cottage with a red roof" },
      { subject: "a floating island growing a lighthouse", noun: "a small white-and-red lighthouse" },
      { subject: "a floating island growing a windmill", noun: "a little wooden windmill" },
      { subject: "a floating island growing a greenhouse", noun: "a small glass greenhouse" },
      { subject: "a floating island growing a tea house", noun: "a tiny wooden tea house with paper windows" },
      { subject: "a floating island growing a bell tower", noun: "a slender stone bell tower" },
      { subject: "a floating island growing a treehouse", noun: "a small wooden treehouse in a big tree" },
      { subject: "a floating island growing an observatory", noun: "a little stone observatory with a copper dome" },
      { subject: "a floating island growing a chapel", noun: "a tiny chapel with a blue door" },
      { subject: "a floating island growing a sky pier", noun: "a wooden pier reaching out over the void" },
      { subject: "a floating island growing a clock tower", noun: "a small clock tower with a golden face" },
      { subject: "a floating island growing a mill house", noun: "a little mill house of pale stone" },
    ],
    // 7 tappe = il ciclo di vita di uno sfondo. Metà arco alla natura (roccia →
    // isola verde), metà alla costruzione di {s}: così ogni giorno il cambiamento
    // è grosso abbastanza da vedersi al primo sguardo.
    stageTemplates: [
      "the floating island is bare grey rock: no plants, no structures, nothing on it at all",
      "green moss and grass now cover HALF of the bare rock, with a few small white wildflowers",
      "grass covers the whole island, THREE young trees have sprouted, and a thin waterfall pours from the edge into the mist below",
      "the stone foundations and the first wooden frame of {s} have appeared among the trees",
      "{s} is HALF built: its walls are up, the roof still missing",
      "{s} is complete, warm light glowing from its windows, and a little stone path leads to it",
      "the island is finished and alive: TWICE as many trees, tiny paper lanterns hanging from the branches, birds circling in the golden-hour sky",
    ],
  },
  {
    id: "atelier",
    name: "Atelier",
    emoji: "🎨",
    active: false, // in pausa su richiesta (l'archivio resta)
    accent: ["#e8b04b", "#a34a2b"],
    tagline: "Un quadro che si dipinge da solo, pennellata dopo pennellata",
    taglineEn: "A painting painting itself, brushstroke by brushstroke",
    mode: "progression",
    style:
      "cozy artist studio interior, warm window light, cinematic still-life photography, shallow depth of field",
    palette: "warm wood tones and cream white canvas",
    setting:
      "a large blank canvas on a wooden easel in a cozy sunlit artist studio, brushes and a palette on a small side table",
    // `subject` descrive il progetto completo (solo per i metadati);
    // `noun` è il riferimento BREVE usato nelle tappe. Le prime tappe non
    // menzionano affatto il soggetto: se il prompt nomina il risultato finale
    // ("dipinto di montagne"), il modello lo disegna subito (leak verificato).
    // `noun` = il soggetto come SCENA (senza la parola "painting"): entra fin
    // dallo schizzo, con guardie esplicite ("solo contorni", "niente colore",
    // "chiaramente incompiuto") che impediscono al modello di completare
    // l'opera in anticipo.
    projects: [
      { subject: "an oil painting of a mountain landscape at sunrise", noun: "the mountain lake scene" },
      { subject: "an oil painting of a stormy sea with a lighthouse", noun: "the stormy sea and lighthouse scene" },
      { subject: "an impressionist painting of a red poppy field", noun: "the red poppy field scene" },
      { subject: "a moody watercolor of a rainy city street at dusk", noun: "the rainy city street scene" },
      { subject: "a detailed painting of a red fox in falling snow", noun: "the red fox in the snow scene" },
      { subject: "a warm painting of a tuscan hillside with cypresses", noun: "the tuscan hillside scene" },
    ],
    stageTemplates: [
      "the canvas is COMPLETELY BLANK: pure white, untouched, nothing painted or drawn on it at all",
      "a few faint pencil lines begin to sketch {s} on the canvas, which is still mostly blank white",
      "the complete light pencil sketch of {s} covers the canvas: thin graphite outlines only, no paint at all",
      "rough underpainting now covers the WHOLE canvas: blurry approximate colors over the sketch, clearly unfinished",
      "the main forms of {s} are now painted with real color, though the details are still missing",
      "fine details, deep shadows and the first luminous highlights sharpen {s}: it looks close to finished",
      "{s} is finished: a complete, detailed painting glowing on the easel",
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
    // 12 progetti: una base diversa ogni settimana per tre mesi (vedi nota su `studio`).
    projects: [
      { subject: "a sunflower growing from seed to golden bloom", noun: "the sunflower" },
      { subject: "a cherry branch blossoming in a glass vase", noun: "the cherry blossoms" },
      { subject: "a climbing rose colonizing a wooden trellis", noun: "the red roses" },
      { subject: "a fern unfurling from a tight spiral", noun: "the fern fronds" },
      { subject: "a cactus opening one bright pink flower", noun: "the pink cactus flower" },
      { subject: "an amaryllis opening huge red trumpet flowers", noun: "the red amaryllis flowers" },
      { subject: "an orchid opening its first flowers", noun: "the white orchid flowers" },
      { subject: "a tulip rising from its bulb", noun: "the red tulip" },
      { subject: "a lavender plant coming into flower", noun: "the lavender spikes" },
      { subject: "a hydrangea turning into a blue globe", noun: "the blue hydrangea blooms" },
      { subject: "a passion flower unfurling on its vine", noun: "the purple passion flower" },
      { subject: "a wisteria dropping its first purple clusters", noun: "the wisteria clusters" },
    ],
    // Tappe deterministiche. Le prime NON nominano il fiore: nominare il
    // risultato finale fa comparire subito la fioritura completa (leak verificato).
    // Ogni tappa dichiara un cambiamento QUANTIFICATO ("raddoppiato",
    // "metà dell'altezza finale"): senza numeri il modello, istruito a
    // preservare tutto, riproduce ieri quasi identico (feedback utente:
    // "i pezzi nuovi compaiono ogni 3 giorni").
    stageTemplates: [
      "the pot holds only bare dark soil: completely empty, nothing has sprouted at all",
      "a tiny pale green sprout has just broken through the soil, barely one centimetre tall",
      "the sprout has TRIPLED in height since yesterday: a slim stem with two open seed leaves and the first true leaf",
      "a growth spurt: the plant now reaches HALF of its final height, with six green leaves catching the light",
      "the plant is now at FULL height, twice as leafy as yesterday, and a small tight green bud has formed at the top",
      "the bud has DOUBLED in size and is opening: the first petals of {s} are clearly unfurling",
      "{s} in full glorious bloom, petals spread wide and radiant",
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

/** Verifica dell'INVARIANTE del ciclo di vita: un canale a progressione deve
 * avere esattamente CONFIG.ARC_LENGTH_DAYS tappe (e altrettante stageSummaries
 * se usa il refMode cumulativo), altrimenti l'arco non chiude sul settimo giorno.
 * Non lancia: logga a caricamento modulo, così l'errore si vede in `wrangler tail`
 * senza mai mettere offline il canale. */
for (const c of CHANNELS) {
  if (c.mode !== "progression") continue;
  const n = CONFIG.ARC_LENGTH_DAYS;
  if (c.stageTemplates?.length !== n) {
    console.error(`[channels] ${c.id}: ${c.stageTemplates?.length} tappe invece di ${n} (ciclo di vita)`);
  }
  if (c.refMode === "anchor-cumulative" && c.stageSummaries?.length !== n) {
    console.error(`[channels] ${c.id}: ${c.stageSummaries?.length} stageSummaries invece di ${n}`);
  }
}

/** Solo i canali attivi: il cron genera e il sito mostra soltanto questi.
 * I canali con active:false restano definiti (e il loro archivio resta in KV):
 * per riattivarli basta rimettere active:true e rideployare. */
export const ACTIVE_CHANNELS = CHANNELS.filter((c) => c.active);

/** Ritorna il canale con l'id dato, oppure undefined. */
export function getChannel(id) {
  return CHANNELS.find((c) => c.id === id);
}
