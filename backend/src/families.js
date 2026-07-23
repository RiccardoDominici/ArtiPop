// FAMIGLIE DI CONCEPT — la "forma" che una storia di 7 giorni può avere.
//
// Una famiglia definisce due cose, ed è la seconda quella nuova:
//
//   1. Le SETTE TAPPE: la tappa 0 è lo stato di partenza (descrizione assoluta,
//      usata per generare il keyframe pulito); le tappe 1..6 descrivono il
//      CAMBIAMENTO di quel giorno rispetto all'immagine del giorno prima, che il
//      modello ha davanti come riferimento. Ogni tappa è una lista di frasi
//      (di solito due): servono a dosare, perché quando il cancello dice
//      "hai cambiato troppo poco" si aggiunge una frase della tappa successiva,
//      e quando dice "troppo" si tiene solo la prima.
//
//   2. Il PROFILO DI CAMBIAMENTO: l'intervallo entro cui deve stare la
//      variazione misurata da un giorno all'altro (vedi metrics.js). È qui che
//      vive l'intuizione che regge tutto il redesign: "quanto cambia" non è un
//      numero solo. Un timelapse di città cambia POCO ma DAPPERTUTTO; una barca
//      che attraversa un lago cambia TANTO ma in un francobollo d'immagine.
//      Con un solo numero i due casi sono indistinguibili; con estensione +
//      intensità + compattezza si separano nettamente.
//
// I valori dei profili non sono inventati: sono tarati sulle misure reali dei
// 12 giorni d'archivio dei canali vecchi (vedi /test-metrics). In particolare i
// due giorni in cui Studio è "impazzito" misuravano estensione 74-79% con
// intensità 10 e compattezza 0,27 — cioè esattamente la firma che qui è
// assegnata al timelapse urbano. I due assi separano davvero i comportamenti.
//
// {s} viene sostituito col nome breve del soggetto (vedi concepts.js).

export const FAMILIES = {
  /* ---------------------------------------------------------------- */
  crescita: {
    id: "crescita",
    nome: "Crescita",
    // Un evento localizzato e netto ogni giorno, sfondo immobile.
    // Nell'archivio vecchio il giorno migliore di Bloom (la fioritura) misurava
    // est 6,4 / int 18,0 / cmp 0,65; i giorni morti stavano a int 5,4 e cmp 0,30.
    profilo: { estensione: [7, 28], intensita: [9, 26], compattezza: [0.40, 0.85], monotona: true },
    // Cosa NON deve cambiare: e' specifico della famiglia.
    conserva: "the pot, the surface it stands on, the background and the light",
    tappe: [
      ["an empty pot of freshly poured dark soil, just filled and not yet planted: the soil surface is smooth, flat and completely bare, with no plant, no seedling, no stem and no leaf anywhere in the scene"],
      ["a single pale green sprout has broken through the soil, about two centimetres tall"],
      ["the sprout has TRIPLED in height", "two open seed leaves and the first true leaf have appeared"],
      ["the plant has reached HALF of its final height", "six broad green leaves now catch the light"],
      ["the plant stands at FULL height and is twice as leafy", "a tight green bud has formed at the top"],
      ["the bud has DOUBLED in size and is splitting open", "the first petals of {s} are unfurling"],
      ["{s} is in full bloom, petals spread wide and radiant", "a second smaller bud has risen beside it"],
    ],
    // Aggiunte per i giorni in cui la storia è arrivata in anticipo sul calendario.
    extra: [
      "a few fallen petals now rest on the soil",
      "a third flower head has opened lower on the stem",
      "a tiny insect has settled on one of the petals",
    ],
  },

  /* ---------------------------------------------------------------- */
  costruzione: {
    id: "costruzione",
    nome: "Costruzione",
    // Un pezzo nuovo per volta su una scena ferma. Taratura su Isola: i giorni
    // buoni (l'albero, la casa) stavano a est 6-11 / int 11-20 / cmp 0,49-0,55;
    // il giorno morto a est 1,8 / int 5,8.
    profilo: { estensione: [7, 28], intensita: [9, 24], compattezza: [0.38, 0.82], monotona: true },
    // Cosa NON deve cambiare: e' specifico della famiglia.
    conserva: "the viewpoint, the sky, the surrounding landscape and the light",
    tappe: [
      ["the place is completely bare and untouched: no plants, no trees, no buildings, no structures of any kind, nothing built on it at all"],
      ["green moss and grass now cover HALF of the bare ground", "a few small white wildflowers have opened"],
      ["grass covers the whole ground and THREE young trees have taken root", "a thin waterfall spills from the edge"],
      ["the stone foundations and the first wooden frame of {s} now stand among the trees"],
      ["{s} is HALF built: the walls are up, the roof still missing"],
      ["{s} is complete, with warm light glowing from its windows", "a little stone path now leads up to the door"],
      ["there are TWICE as many trees as before", "tiny paper lanterns hang from the branches around {s}"],
    ],
    extra: [
      "a small wooden bench now sits beside the path",
      "a thin curl of smoke rises from the chimney",
      "a low stone wall now borders the near edge",
    ],
  },

  /* ---------------------------------------------------------------- */
  accumulo: {
    id: "accumulo",
    nome: "Accumulo",
    // Uno spazio interno che si riempie: l'oggetto nuovo arriva, gli altri NON
    // si muovono. Nel vecchio Studio questa era la parte che falliva di più
    // (gli oggetti cambiavano identità ogni giorno): il cancello ora la misura.
    profilo: { estensione: [7, 30], intensita: [8, 24], compattezza: [0.40, 0.85], monotona: true },
    // Cosa NON deve cambiare: e' specifico della famiglia.
    conserva: "the furniture, the wall, the light, and every object already present, each in exactly the same position",
    tappe: [
      ["the surface is completely empty and clean: bare top, bare wall, no objects of any kind, nothing on it at all"],
      ["a warm lamp is now lit in the back corner", "a stack of two old books stands beside it"],
      ["a small potted green plant now sits in the opposite corner", "a steaming ceramic cup stands near the front edge"],
      ["an open notebook with a pen lies in the middle", "the stack of books has DOUBLED in height"],
      ["{s} now takes the place of honour at the centre back"],
      ["three small objects belonging with {s} are arranged around it", "a framed print leans against the wall behind"],
      ["a lit candle and a second small plant fill the last empty corners", "a string of tiny warm fairy lights glows on the wall above"],
    ],
    extra: [
      "a folded pair of reading glasses now rests on the notebook",
      "a small saucer of loose change sits near the front corner",
      "a rolled-up cloth now lies under the near edge",
    ],
  },

  /* ---------------------------------------------------------------- */
  timelapse: {
    id: "timelapse",
    nome: "Timelapse urbano",
    // IL CASO OPPOSTO A TUTTI GLI ALTRI: qui si PRETENDE che cambi mezza
    // immagine, ma piano e senza un singolo evento dominante. Compattezza BASSA
    // è un requisito, non un difetto: se il cambiamento si concentra in un punto
    // vuol dire che il modello ha piazzato un edificio gigante invece di far
    // crescere la città.
    profilo: { estensione: [28, 78], intensita: [5, 16], compattezza: [0.12, 0.44], monotona: true },
    // Cosa NON deve cambiare: e' specifico della famiglia.
    conserva: "the viewpoint, the horizon, the terrain and the light",
    tappe: [
      ["the site holds only a handful of small scattered dwellings, most of the ground still empty"],
      ["a dozen more low buildings have appeared across the whole settlement, each one small"],
      ["the settlement has spread to fill HALF the available ground, and the first roads connect the districts"],
      ["buildings now cover the whole ground and many have gained a second and third floor"],
      ["the skyline has risen everywhere: dozens of mid-rise buildings, and {s} stands taller than the rest"],
      ["towers have grown across the entire skyline", "bridges and elevated walkways link them at height"],
      ["the city is dense and complete, lights glowing in thousands of windows across every district"],
    ],
    extra: [
      "another ring of low buildings has spread along the outer edge",
      "rooftop gardens have appeared on many of the towers",
      "a second bridge now spans the far side",
    ],
  },

  /* ---------------------------------------------------------------- */
  attraversamento: {
    id: "attraversamento",
    nome: "Attraversamento",
    // Paesaggio IMMOBILE, un solo soggetto che si sposta. È il profilo più
    // esigente: pochissima immagine cambia, ma dove cambia deve cambiare tanto.
    // La compattezza non arriva a 1 perché il soggetto lascia il punto vecchio
    // e occupa quello nuovo: sono due macchie, non una.
    //
    // ATTENZIONE — è la famiglia meno affidabile, e il profilo qui sotto NON è
    // ancora tarato sul campo. Nel primo giorno di prova (concept "canoa") il
    // modello ha cambiato il 40% dell'immagine invece del 12% massimo: spostare
    // un soggetto significa cancellarlo da un punto e ridisegnarlo in un altro,
    // e un editor a diffusione tende a rifare tutta la scena. Il cancello se ne
    // accorge e pubblica il ripiego, quindi non si rompe niente, ma finché le
    // tappe non saranno riformulate questa famiglia consumerà tutti i tentativi
    // ogni giorno. Il range resta stretto di proposito: allargarlo a 40
    // nasconderebbe il difetto invece di segnalarlo.
    profilo: { estensione: [2, 12], intensita: [13, 42], compattezza: [0.45, 1.0], monotona: false },
    // Cosa NON deve cambiare: e' specifico della famiglia.
    conserva: "the entire landscape, the sky, the horizon and the light — nothing in the scenery moves or changes",
    tappe: [
      ["{s} is just entering the scene at the far left edge, small in the distance"],
      ["{s} has moved a clear step further along, now a third of the way across"],
      ["{s} has advanced to just left of centre and is noticeably closer and larger"],
      ["{s} is at the very centre of the scene, at its largest and most detailed"],
      ["{s} has moved past the centre to the right, beginning to draw away"],
      ["{s} is two thirds of the way across and clearly smaller with distance"],
      ["{s} is far away at the right edge, small again, about to leave the scene"],
    ],
    extra: [
      "{s} has drifted slightly further from the near shore",
      "{s} sits a little lower against the horizon",
      "{s} has turned slightly, showing a different side",
    ],
  },

  /* ---------------------------------------------------------------- */
  metamorfosi: {
    id: "metamorfosi",
    nome: "Metamorfosi",
    // L'unica famiglia a cui è concesso ribollire: forme astratte che si
    // trasformano interamente. Anche la guardia sulla luce è più larga, perché
    // qui il colore È il soggetto e non un effetto collaterale.
    profilo: { estensione: [25, 82], intensita: [11, 40], compattezza: [0.10, 0.50], monotona: false },
    // Cosa NON deve cambiare: e' specifico della famiglia.
    conserva: "the framing and the overall colour range",
    maxDeriva: 9,
    tappe: [
      ["a single calm {s} form rests across the frame, smooth and almost still"],
      ["the {s} form has folded over on itself, doubling the number of visible layers"],
      ["the layers have stretched into long diagonal bands running across the whole frame"],
      ["the bands have begun to curl into slow spirals, half the frame now turning"],
      ["the spirals have opened into wide concentric rings filling the frame"],
      ["the rings have dissolved into a fine drifting mist of the same colours"],
      ["the mist has gathered back into one single {s} form, denser and richer than at the start"],
    ],
    extra: [
      "a thin thread of light now runs through the form",
      "a second smaller form has separated from the main one",
      "the edges have grown softer and more diffuse",
    ],
  },
};

/** Numero di tappe di una famiglia (deve coincidere con CONFIG.ARC_LENGTH_DAYS). */
export function stageCount(family) {
  return family.tappe.length;
}

/** La famiglia con quell'id, o undefined. */
export function getFamily(id) {
  return FAMILIES[id];
}
