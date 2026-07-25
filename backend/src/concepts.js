// LIBRERIA DEI CONCEPT — ogni voce è una storia di 7 giorni, completa e a sé.
//
// Un concept porta TUTTO: il mondo (setting), il look (style + palette), il
// soggetto ({s}) e la famiglia da cui eredita le tappe e il profilo di
// cambiamento. Ogni settimana un flusso ne pesca uno nuovo e non lo rivede
// finché non ha esaurito gli altri.
//
// È il cambiamento più grosso rispetto a prima: un canale non "è" più un'isola
// per sempre. Isola, Bloom e Studio sopravvivono qui dentro come tre concept
// fra sessanta — il loro archivio resta al suo posto, ma non tornano ogni
// settimana.
//
// Aggiungere un concept = aggiungere una riga a questo file. Niente altro.
// Un concept può sovrascrivere `tappe` e `profilo` della famiglia quando il
// soggetto lo richiede; quasi nessuno ne ha bisogno.

import { FAMILIES } from "./families.js";
// Vedi la nota in cima a catalog.js sul ciclo fra questo file e quello: è
// innocuo perché nessuno dei due usa questi import al livello superiore del
// modulo, solo dentro combine() qui sotto, eseguita a richiesta avvenuta.
import { allFamilies, allElements, resolveConcept } from "./catalog.js";

const CONCEPTS_RAW = [
  /* ===================== CRESCITA (piante) ===================== */
  { id: "girasole", famiglia: "crescita", nome: "Girasole", s: "the sunflower",
    setting: "a terracotta pot of dark soil on a stone windowsill, soft morning light, a blurred garden beyond the glass",
    style: "delicate botanical illustration, soft focus macro, dreamy minimalism, gentle bokeh",
    palette: "soft pastels with fresh botanical greens" },
  { id: "ciliegio", famiglia: "crescita", nome: "Ciliegio", s: "the cherry blossoms",
    setting: "a slim glass vase on a pale wooden table against a plain warm wall, diffused daylight",
    style: "quiet japanese still-life photography, soft natural light, generous empty space",
    palette: "chalk white, pale pink and warm grey" },
  // Le felci non hanno steli, boccioli né petali: il copione generico della
  // famiglia (foglie embrionali → bocciolo → fioritura) qui non descrive niente
  // di reale, e il modello produceva ibridi assurdi. Tappe dedicate.
  { id: "felce", famiglia: "crescita", nome: "Felce", s: "the fern fronds",
    setting: "a mossy clay pot on a dark slate ledge in a shaded greenhouse, humid air, deep green blur behind",
    style: "moody botanical photography, low key, dewy detail, soft rim light",
    palette: "deep forest greens with cool silver highlights",
    tappe: [
      ["an empty clay pot of freshly poured dark soil, just filled and not yet planted: the surface is smooth and completely bare, with no plant, no shoot and no frond anywhere in the scene"],
      ["one tight green spiral, curled like a snail shell, has pushed up through the moss"],
      ["the spiral has TRIPLED in height on a slender stalk", "a second smaller spiral has appeared beside it"],
      ["the first spiral has half uncurled, showing its feathered edge", "there are now FOUR stalks in the pot"],
      ["two fronds have fully opened into wide feathered blades", "the remaining spirals stand at full height"],
      ["every stalk has uncurled: {s} now form a dense arching crown", "the fronds have DOUBLED in width"],
      ["{s} fill the whole pot and spill over its rim, deep green and glossy", "tiny new spirals have started at the base"],
    ],
    extra: [
      "a drop of water now clings to one of the fronds",
      "a small patch of new moss has spread on the soil",
      "one frond has arched further out over the ledge",
    ] },
  { id: "orchidea", famiglia: "crescita", nome: "Orchidea", s: "the white orchid flowers",
    setting: "a white ceramic pot on a pale marble shelf, bright overcast light from a tall window",
    style: "clean editorial still-life, crisp minimal composition, soft even light",
    palette: "cool whites and pale greys with a single green accent" },
  { id: "tulipano", famiglia: "crescita", nome: "Tulipano", s: "the red tulip",
    setting: "a small enamel pot of dark earth on a painted blue windowsill, spring light, sheer curtain behind",
    style: "warm painterly still-life, visible brushwork, gentle impressionist light",
    palette: "cobalt blue, cream and vivid red" },
  { id: "lavanda", famiglia: "crescita", nome: "Lavanda", s: "the lavender spikes",
    setting: "a rough terracotta pot on a sun-warmed stone wall, dry provençal afternoon light",
    style: "sunlit mediterranean photography, warm haze, shallow depth of field",
    palette: "dusty violet, bleached stone and olive green" },
  // Un cactus non fa steli né foglie: cresce in altezza a segmenti e fiorisce
  // in cima. Col copione generico usciva un cactus con foglioline da fagiolo.
  // Anche il `setting` è stato ripulito dalla parola "desert": da sola bastava
  // a far comparire un cactus nel vaso che il testo dichiarava vuoto.
  { id: "cactus", famiglia: "crescita", nome: "Cactus", s: "the bright pink cactus flower",
    setting: "a small pale stone pot of sandy gravel on a plain warm-toned shelf, hard clean sunlight, smooth empty background",
    style: "graphic still-life photography, bold clean shapes, strong directional sun",
    palette: "sand, terracotta and hot pink",
    tappe: [
      ["an empty stone pot of freshly poured sandy gravel, just filled and not yet planted: the gravel surface is smooth, flat and completely bare, with no plant, no shoot and no green anywhere in the scene"],
      ["one small round green shoot, the size of a marble, has pushed up through the gravel"],
      ["the shoot has TRIPLED in size into a firm ribbed green globe", "fine pale spines now cover its ridges"],
      ["the globe has grown upward into a short column at HALF its final height", "the ribs are deep and evenly spaced"],
      ["the column stands at FULL height", "TWO smaller arms have budded from its base"],
      ["a tight woolly bud has swollen at the very top of the column", "the arms have DOUBLED in length"],
      ["{s} has opened wide at the crown, silky petals fully spread", "a second bud is swelling on one of the arms"],
    ],
    extra: [
      "a few small pebbles now sit on the gravel surface",
      "a third arm has budded low on the column",
      "a second flower has opened on the tallest arm",
    ] },
  { id: "glicine", famiglia: "crescita", nome: "Glicine", s: "the wisteria clusters",
    setting: "a weathered wooden planter against an old plaster wall, dappled light through a pergola",
    style: "romantic garden photography, soft dappled light, dreamy atmosphere",
    palette: "lilac, weathered wood and pale gold" },
  { id: "ortensia", famiglia: "crescita", nome: "Ortensia", s: "the blue hydrangea blooms",
    setting: "a wide zinc pot on a grey stone step, cool cloudy northern light, blurred hedge behind",
    style: "soft nordic photography, cool diffused light, muted calm palette",
    palette: "powder blue, zinc grey and sage" },
  { id: "amarillide", famiglia: "crescita", nome: "Amarillide", s: "the red amaryllis flowers",
    setting: "a dark glazed pot on a walnut sideboard in a dim room, a single warm lamp from the side",
    style: "chiaroscuro still-life painting, deep shadows, one warm light source",
    palette: "near-black background with deep crimson and gold" },

  /* ===================== COSTRUZIONE (luoghi) ===================== */
  { id: "isola", famiglia: "costruzione", nome: "Isola", s: "a tiny stone cottage with a red roof",
    setting: "a small floating island drifting in a vast soft pastel sky above distant clouds, seen from slightly below",
    style: "whimsical fantasy illustration, painterly, soft volumetric light, sense of gentle wonder",
    palette: "soft sky pastels with warm golden accents" },
  { id: "faro", famiglia: "costruzione", nome: "Faro", s: "a white-and-red lighthouse",
    setting: "a rocky headland jutting into a calm grey sea, low horizon, wide overcast sky",
    style: "cinematic coastal photography, cool atmospheric haze, quiet vastness",
    palette: "slate grey, sea green and a single warm beacon red" },
  { id: "serra", famiglia: "costruzione", nome: "Serra", s: "a small glass greenhouse",
    setting: "a flat clearing in a walled garden, soft late-afternoon light, old brick wall in the background",
    style: "warm english garden photography, golden low sun, gentle grain",
    palette: "brick red, moss green and warm amber" },
  { id: "osservatorio", famiglia: "costruzione", nome: "Osservatorio", s: "a stone observatory with a copper dome",
    setting: "a bare rounded hilltop under an enormous clear twilight sky, distant ranges on the horizon",
    style: "epic landscape illustration, crisp air, deep atmospheric perspective",
    palette: "indigo sky, cold stone and verdigris copper" },
  { id: "casadialbero", famiglia: "costruzione", nome: "Casa sull'albero", s: "a wooden treehouse",
    setting: "one enormous ancient oak alone in a misty green meadow, soft morning fog at its roots",
    style: "storybook illustration, soft mist, warm painterly light",
    palette: "mossy greens and warm honey browns" },
  { id: "molo", famiglia: "costruzione", nome: "Molo", s: "a long wooden pier with a small hut at its end",
    setting: "the still shore of a wide mountain lake at dawn, mirror water, dark pines on the far side",
    style: "serene minimalist landscape photography, glassy reflections, cool dawn light",
    palette: "pale blue, pine black and soft rose" },
  { id: "mulino", famiglia: "costruzione", nome: "Mulino", s: "a wooden windmill",
    setting: "a low green rise above a patchwork of flat fields, big open sky with drifting clouds",
    style: "dutch landscape painting style, wide sky, soft even daylight",
    palette: "field greens, cloud white and weathered timber" },
  { id: "campanile", famiglia: "costruzione", nome: "Campanile", s: "a slender stone bell tower",
    setting: "a dry terraced hillside above a hazy valley, warm mediterranean light, cypresses on the ridge",
    style: "tuscan landscape painting, warm haze, soft golden atmosphere",
    palette: "ochre, cypress green and dusty gold" },
  { id: "rifugio", famiglia: "costruzione", nome: "Rifugio", s: "a small timber mountain hut",
    setting: "a snowfield on a high alpine shoulder, jagged peaks behind, thin cold blue light",
    style: "crisp alpine photography, cold clean air, hard shadows on snow",
    palette: "snow white, glacial blue and dark timber" },
  { id: "casadate", famiglia: "costruzione", nome: "Casa da tè", s: "a wooden tea house with paper windows",
    setting: "a small mossy island in a still garden pond, maples leaning over the water",
    style: "japanese garden photography, soft even light, quiet balanced composition",
    palette: "moss green, still water grey and warm paper cream" },

  /* ===================== ACCUMULO (interni) ===================== */
  { id: "studio", famiglia: "accumulo", nome: "Studio", s: "a vintage typewriter",
    setting: "a sturdy wooden desk against a smooth plain warm-cream wall with no texture, seen straight on, soft window light from the left",
    style: "cozy interior still-life photography, warm soft window light, clean minimal background, shallow depth of field",
    palette: "warm wood, cream and amber tones" },
  { id: "botanico", famiglia: "accumulo", nome: "Botanico", s: "a glass terrarium of small ferns",
    setting: "a long pale workbench against a soft sage-green wall, cool north light from the left",
    style: "airy naturalist still-life, cool even daylight, uncluttered background",
    palette: "sage green, pale ash wood and glass" },
  { id: "orologiaio", famiglia: "accumulo", nome: "Orologiaio", s: "a watchmaker's loupe and a tray of tiny gears",
    setting: "a narrow dark wooden bench against a deep olive wall, a tight pool of warm lamplight",
    style: "intimate low-key still-life, single warm lamp, deep surrounding shadow",
    palette: "olive dark, brass gold and warm amber" },
  { id: "pittore", famiglia: "accumulo", nome: "Pittore", s: "a wooden paint box with tubes and brushes",
    setting: "a paint-spattered table against a whitewashed studio wall, bright diffused north light",
    style: "bright artist-studio photography, clean white light, honest texture",
    palette: "whitewash, raw linen and scattered primary colours" },
  { id: "astronomo", famiglia: "accumulo", nome: "Astronomo", s: "a small brass telescope",
    setting: "a dark oak desk against a deep midnight-blue wall, one cool lamp and a hint of moonlight",
    style: "moody nocturnal still-life, cool blue shadow with a warm accent light",
    palette: "midnight blue, dark oak and brass" },
  { id: "fotografo", famiglia: "accumulo", nome: "Fotografo", s: "a vintage film camera on a small tripod",
    setting: "a grey steel table against a plain charcoal wall, hard directional light from one side",
    style: "graphic monochrome-leaning still-life, hard side light, strong shadows",
    palette: "charcoal, steel grey and one warm ochre accent" },
  { id: "cartografo", famiglia: "accumulo", nome: "Cartografo", s: "an unrolled old map and a brass compass",
    setting: "a wide leather-topped desk against a warm parchment-coloured wall, soft late daylight",
    style: "classic warm still-life, aged materials, soft golden light",
    palette: "parchment, oxblood leather and brass" },
  { id: "musicista", famiglia: "accumulo", nome: "Musicista", s: "a wooden violin on a small stand",
    setting: "a dark walnut table against a deep burgundy wall, one soft warm light from above",
    style: "rich romantic still-life, deep colour, gentle falloff into shadow",
    palette: "burgundy, walnut and warm rosin gold" },
  { id: "ceramista", famiglia: "accumulo", nome: "Ceramista", s: "a half-finished bowl on a small potter's wheel",
    setting: "a raw concrete bench against a pale clay-coloured wall, flat overcast daylight",
    style: "earthy documentary still-life, matte surfaces, soft flat light",
    palette: "wet clay grey, unglazed terracotta and chalk" },
  { id: "profumiere", famiglia: "accumulo", nome: "Profumiere", s: "a rack of small glass bottles of amber liquid",
    setting: "a pale stone counter against a soft blush-coloured wall, bright gentle daylight",
    style: "luminous delicate still-life, glass and light, airy composition",
    palette: "blush pink, clear glass and pale amber" },

  /* ===================== TIMELAPSE (insediamenti) ===================== */
  { id: "portocitta", famiglia: "timelapse", nome: "Città di porto", s: "the tall harbour crane",
    setting: "a wide bay seen from a fixed hillside vantage point, calm water, headlands on both sides, flat daylight",
    style: "detailed isometric-leaning illustration, clear flat daylight, fine architectural detail",
    palette: "harbour blue, pale stone and warm roof terracotta" },
  { id: "cittamontagna", famiglia: "timelapse", nome: "Città di montagna", s: "the stone clock tower",
    setting: "a steep alpine valley floor seen from the opposite slope, peaks framing both sides, cool clear light",
    style: "crisp detailed illustration, cold clear mountain air, fine linework",
    palette: "slate blue, snow white and dark timber" },
  { id: "cittafiume", famiglia: "timelapse", nome: "Città sul fiume", s: "the great arched bridge",
    setting: "a wide river bend seen from a fixed high bank, flat green floodplain on both sides, soft overcast light",
    style: "detailed illustrated map-like view, even soft light, patient detail",
    palette: "river green, wet stone and pale sky" },
  { id: "oasi", famiglia: "timelapse", nome: "Oasi", s: "the tallest palm-shaded tower",
    setting: "a shallow desert basin around a small lake, dunes closing the horizon, hard clean sun",
    style: "warm graphic desert illustration, strong sun, crisp shadows",
    palette: "sand gold, oasis green and deep shade blue" },
  { id: "cittaghiaccio", famiglia: "timelapse", nome: "Città di ghiaccio", s: "the domed ice hall",
    setting: "a flat frozen plain under a low pale sun, distant ice ridges on the horizon",
    style: "cold minimal illustration, long low light, vast emptiness",
    palette: "ice white, pale cyan and low-sun amber" },
  { id: "neon", famiglia: "timelapse", nome: "Neon", s: "the tallest neon-crowned tower",
    setting: "a flat coastal plain at night seen from a fixed rooftop, dark sea behind, no moon",
    style: "cyberpunk cityscape illustration, neon glow, wet reflective surfaces, volumetric light",
    palette: "deep blues and purples with electric neon accents" },
  { id: "borgo", famiglia: "timelapse", nome: "Borgo", s: "the hilltop church tower",
    setting: "a rolling hillside seen from a facing ridge, olive terraces below, warm even afternoon light",
    style: "warm pastoral illustration, soft golden light, gentle detail",
    palette: "ochre, olive green and terracotta" },
  { id: "scogliera", famiglia: "timelapse", nome: "Città sulle scogliere", s: "the tallest cliff-edge villa",
    setting: "a tall sea cliff face seen from a boat's fixed viewpoint, deep blue water below, bright sky",
    style: "vivid mediterranean illustration, bright clear light, saturated colour",
    palette: "deep sea blue, white lime walls and bougainvillea pink" },
  { id: "cittalago", famiglia: "timelapse", nome: "Città sul lago", s: "the long stilted boathouse",
    setting: "a calm lake shore seen from a fixed jetty, still water, wooded hills behind, soft morning light",
    style: "quiet detailed illustration, mirror reflections, soft light",
    palette: "lake grey-blue, timber brown and misty green" },
  { id: "cittanuvole", famiglia: "timelapse", nome: "Città tra le nuvole", s: "the tallest spire above the clouds",
    setting: "a broad flat cloud plateau seen from a fixed floating vantage, open sky above and below",
    style: "airy fantasy illustration, luminous cloud, soft volumetric light",
    palette: "cloud white, pale gold and soft sky blue" },

  /* ===================== ATTRAVERSAMENTO (viaggi) ===================== */
  { id: "veliero", famiglia: "attraversamento", nome: "Veliero", s: "a small white sailing boat",
    setting: "a wide calm lake under a big soft sky, dark wooded shores far on both sides, the water almost still",
    style: "serene wide landscape photography, soft even light, great sense of space",
    palette: "pale blue water, soft grey sky and dark green shore" },
  { id: "mongolfiera", famiglia: "attraversamento", nome: "Mongolfiera", s: "a striped hot-air balloon",
    setting: "a broad valley of patchwork fields seen from above, morning mist in the hollows, clear sky",
    style: "warm aerial landscape photography, soft morning haze, gentle colour",
    palette: "field green, mist white and warm balloon red" },
  { id: "treno", famiglia: "attraversamento", nome: "Treno", s: "a small dark steam train",
    setting: "a wide alpine valley with a viaduct crossing it, steep forested slopes, cool overcast light",
    style: "cinematic mountain photography, cool atmosphere, fine distant detail",
    palette: "forest green, stone grey and a single warm ember glow" },
  { id: "cammello", famiglia: "attraversamento", nome: "Carovana", s: "a lone camel and its rider",
    setting: "an enormous field of smooth sand dunes under a hard clear sky, long shadows, no vegetation",
    style: "graphic desert photography, strong sun, clean sculpted dune shapes",
    palette: "warm sand gold and deep shadow blue" },
  { id: "dirigibile", famiglia: "attraversamento", nome: "Dirigibile", s: "a silver airship",
    setting: "a vast open sky above a flat sea of low clouds, one distant mountain peak breaking through",
    style: "luminous retro-futurist illustration, clean air, soft gradients",
    palette: "sky blue, cloud white and polished silver" },
  { id: "slitta", famiglia: "attraversamento", nome: "Slitta", s: "a small dog sled team",
    setting: "an endless flat snow plain under a low arctic sun, faint blue shadows, distant ice ridge",
    style: "cold minimal photography, long low light, huge empty space",
    palette: "snow white, shadow blue and one warm parka red" },
  { id: "canoa", famiglia: "attraversamento", nome: "Canoa", s: "a narrow wooden canoe",
    setting: "a still fjord between tall dark cliffs, glassy black water, thin mist high above",
    style: "moody nordic photography, deep still water, muted cool tones",
    palette: "black water, cliff charcoal and pale mist" },
  { id: "aliante", famiglia: "attraversamento", nome: "Aliante", s: "a white glider",
    setting: "a huge open sky above a distant golden plain, a few high thin clouds, nothing else",
    style: "clean minimal aerial photography, vast empty sky, soft light",
    palette: "pale sky blue with a distant warm gold horizon" },
  { id: "carro", famiglia: "attraversamento", nome: "Carro", s: "a small covered wagon",
    setting: "an immense grass plain under a towering cloudscape, a faint track running left to right",
    style: "epic pastoral painting, dramatic clouds, warm raking light",
    palette: "prairie gold, storm grey and warm canvas cream" },
  { id: "peschereccio", famiglia: "attraversamento", nome: "Peschereccio", s: "a small red fishing boat",
    setting: "an open grey sea under a heavy overcast sky, a low distant coastline on the horizon",
    style: "muted maritime photography, flat sea light, quiet melancholy",
    palette: "sea grey, sky pewter and one warm boat red" },

  /* ===================== METAMORFOSI (astratto) ===================== */
  { id: "seta", famiglia: "metamorfosi", nome: "Seta", s: "silk",
    setting: "an empty soft-lit space with no horizon and no objects, only the material itself",
    style: "abstract minimal art, smooth flowing gradients, silk-like forms, elegant negative space",
    palette: "rose, amber and warm cream" },
  { id: "inchiostro", famiglia: "metamorfosi", nome: "Inchiostro", s: "ink in water",
    setting: "a clear volume of still water lit from behind, nothing else in frame",
    style: "high-contrast fluid photography, backlit translucency, fine tendril detail",
    palette: "deep indigo and black on luminous white" },
  { id: "marmo", famiglia: "metamorfosi", nome: "Marmo liquido", s: "liquid marble",
    setting: "a flat pool of slowly turning pigment seen straight down, edge to edge, no background",
    style: "macro fluid-art photography, glossy surface, rich swirling detail",
    palette: "teal, gold veins and pearl white" },
  { id: "aurora", famiglia: "metamorfosi", nome: "Aurora", s: "a curtain of aurora light",
    setting: "an empty night sky with no ground and no stars, only the light itself",
    style: "luminous abstract art, soft glowing bands, deep black surround",
    palette: "electric green, violet and deep night black" },
  { id: "vetro", famiglia: "metamorfosi", nome: "Vetro", s: "layered translucent glass",
    setting: "an empty bright space holding only overlapping panes of coloured glass",
    style: "clean geometric abstraction, translucent overlaps, crisp edges",
    palette: "cool cyan, soft rose and clear white" },
  { id: "fumo", famiglia: "metamorfosi", nome: "Fumo", s: "drifting smoke",
    setting: "a black void lit by one narrow side light, nothing but the smoke",
    style: "dramatic low-key photography, single hard side light, deep black",
    palette: "near-black with luminous smoke grey and one warm ember tone" },
  { id: "dune", famiglia: "metamorfosi", nome: "Dune", s: "gradient dunes",
    setting: "a soft abstract field of smooth overlapping gradient shapes, no horizon",
    style: "soft geometric abstraction, matte gradients, calm balance",
    palette: "dusk orange, mauve and deep plum" },
  { id: "carta", famiglia: "metamorfosi", nome: "Carta", s: "folded paper",
    setting: "an empty pale space holding only sheets of folded paper and their shadows",
    style: "tactile minimal photography, soft raking light, precise shadow edges",
    palette: "warm paper white, soft grey shadow and one muted ochre" },
  { id: "cera", famiglia: "metamorfosi", nome: "Cera", s: "molten wax",
    setting: "a dark warm space holding only slow-moving translucent wax, lit from within",
    style: "glowing organic abstraction, internal light, soft molten forms",
    palette: "amber, deep red and warm gold" },
  { id: "filidiluce", famiglia: "metamorfosi", nome: "Fili di luce", s: "threads of light",
    setting: "a deep black space crossed only by fine luminous filaments",
    style: "long-exposure light-painting abstraction, fine bright lines, pure black ground",
    palette: "pure black with cyan, magenta and white light" },
];

/**
 * Concept completi: la famiglia fornisce tappe e profilo, il concept può
 * sovrascriverli. `{s}` viene risolto qui una volta per tutte, così il resto
 * del sistema non deve più sapere niente dei segnaposto.
 */
export const CONCEPTS = CONCEPTS_RAW.map((c) => {
  const fam = FAMILIES[c.famiglia];
  if (!fam) throw new Error(`concept ${c.id}: famiglia sconosciuta "${c.famiglia}"`);
  const tappe = (c.tappe ?? fam.tappe).map((frasi) =>
    frasi.map((f) => f.replaceAll("{s}", c.s))
  );
  return {
    ...c,
    famiglia: fam,
    tappe,
    extra: (c.extra ?? fam.extra).map((f) => f.replaceAll("{s}", c.s)),
    profilo: {
      ...(c.profilo ?? fam.profilo),
      maxDeriva: c.maxDeriva ?? fam.maxDeriva,
      maxDegrado: c.maxDegrado ?? fam.maxDegrado,
    },
  };
});

/** Il concept con quell'id, o undefined. */
export function getConcept(id) {
  return CONCEPTS.find((c) => c.id === id);
}

/** Tutti i concept che appartengono a una delle famiglie indicate. */
export function conceptsForFamilies(familyIds) {
  return CONCEPTS.filter((c) => familyIds.includes(c.famiglia.id));
}

/* ===================== ELEMENT × CONCEPT (combinazione libera) =====================
   Nel vocabolario dello strumento di tuning i due assi sono:
     - CONCEPT  = lo SCHEMA DI EVOLUZIONE (la famiglia: timelapse, crescita, …),
                  che porta le tappe astratte e i range;
     - ELEMENT  = il SOGGETTO (girasole, isola, città…), che porta mondo, stile,
                  palette e un nome breve.
   Uno "sfondo" è una coppia CONCEPT × ELEMENT. In produzione ogni element usa il
   suo concept nativo (con tappe curate); il lab, invece, permette di accoppiare
   QUALSIASI concept con QUALSIASI element, sintetizzando le tappe al volo. */

/**
 * L'elenco degli element (i soggetti), per la UI del lab e per /catalogo.
 *
 * `tappe`/`extra`: quasi nessun element ne porta di proprie (felce e cactus
 * sono le eccezioni, vedi CONCEPTS_RAW sopra) — la stragrande maggioranza
 * eredita quelle della famiglia e qui resta `null`. Quando invece l'element
 * le definisce, vanno esposte GIÀ RISOLTE (stesso `{s}` sostituito di
 * CONCEPTS): è per questo che si legge da CONCEPTS (stesso ordine di
 * CONCEPTS_RAW, uno a uno) invece che da CONCEPTS_RAW grezzo. Senza questo,
 * GET /catalogo tornerebbe `tappe:null` anche per felce/cactus, nascondendo
 * proprio le tappe curate che un utente vorrebbe vedere e duplicare.
 */
export const ELEMENTS = CONCEPTS_RAW.map((c, i) => {
  const risolto = CONCEPTS[i]; // stesso id, stesso ordine: {s} già sostituito
  return {
    id: c.id,
    nome: c.nome,
    // `soggetto` = nome breve NEUTRO, riusabile con qualunque concept (es. "the
    // island"); se assente si ripiega su `s`, che però può essere legato al
    // concept nativo (es. "a lighthouse") e rendere strane certe combinazioni.
    soggetto: c.soggetto ?? c.s,
    famigliaNativa: c.famiglia,
    setting: c.setting,
    style: c.style,
    palette: c.palette,
    tappe: c.tappe ? risolto.tappe : null,
    extra: c.extra ? risolto.extra : null,
  };
});

/** L'element con quell'id, o undefined. */
export function getElement(id) {
  return ELEMENTS.find((e) => e.id === id);
}

/**
 * Costruisce un concept VIRTUALE accoppiando uno schema di evoluzione (famiglia)
 * con un soggetto (element). È il cuore della combinazione libera del lab.
 *
 * - Coppia NATIVA (l'element appartiene a quella famiglia): si usa il concept
 *   reale, con le sue tappe curate — è esattamente ciò che gira in produzione.
 * - Coppia LIBERA: si sintetizzano le tappe dai template astratti della
 *   famiglia, sostituendo il soggetto. Il risultato è meno curato (avvisato),
 *   ma permette di provare "timelapse di una pianta", "un dipinto che si
 *   compone per accumulo", ecc.
 *
 * `rangeOverride` (facoltativo) è il profilo effettivo già risolto col tuning:
 * così il lab misura e collauda con i range che si stanno tarando.
 *
 * `catalog` (facoltativo) è il catalogo custom già caricato (vedi catalog.js):
 * quando è passato, famiglia ed element si risolvono dalle mappe UNITE
 * (built-in + custom), quindi entrambi gli assi possono essere id custom, in
 * qualsiasi combinazione. Senza `catalog` il comportamento è ESATTAMENTE
 * quello di prima (retrocompatibile: chi non sa nulla del catalogo continua
 * a funzionare senza modifiche).
 */
export function combine(familyId, elementId, rangeOverride = null, catalog = null) {
  const fams = catalog ? allFamilies(catalog) : FAMILIES;
  const els = catalog ? allElements(catalog) : ELEMENTS;
  const fam = fams[familyId];
  const el = els.find((e) => e.id === elementId);
  if (!fam) throw new Error(`concept (schema) sconosciuto: "${familyId}"`);
  if (!el) throw new Error(`element (soggetto) sconosciuto: "${elementId}"`);

  const nativa = fam.id === el.famigliaNativa;
  if (nativa) {
    // Con catalogo, resolveConcept copre sia i built-in (delega a getConcept)
    // sia un element custom "a casa sua" (con le sue tappe o quelle ereditate
    // dalla famiglia): è la stessa nozione di "coppia nativa", allargata.
    const reale = catalog ? resolveConcept(elementId, catalog) : getConcept(elementId);
    if (reale) {
      return rangeOverride ? { ...reale, profilo: { ...reale.profilo, ...rangeOverride } } : reale;
    }
  }

  const s = el.soggetto;
  const tappe = fam.tappe.map((frasi) => frasi.map((f) => f.replaceAll("{s}", s)));
  const extra = fam.extra.map((f) => f.replaceAll("{s}", s));
  return {
    id: `${fam.id}+${el.id}`,
    nome: `${fam.nome} · ${el.nome}`,
    famiglia: fam,
    setting: el.setting,
    style: el.style,
    palette: el.palette,
    s,
    tappe,
    extra,
    profilo: rangeOverride
      ? { ...fam.profilo, ...rangeOverride }
      : { ...fam.profilo, maxDeriva: fam.maxDeriva, maxDegrado: fam.maxDegrado },
    virtuale: !nativa,
  };
}
