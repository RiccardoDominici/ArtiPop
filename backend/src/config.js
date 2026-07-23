// Configurazione centrale di ArtiPop v3.
// Tutti i "numeri magici" del sistema vivono qui, con il perché di ogni scelta.

export const CONFIG = {
  // Fuso orario di riferimento per il concetto di "oggi".
  TIMEZONE: "Europe/Rome",

  // Risoluzioni tentate in ordine, in ratio ~6:13 (iPhone moderni sono 1290x2796).
  // Verificato empiricamente: flux-2-klein-4b accetta al massimo 2048 di altezza
  // (errore 3030 oltre), quindi 960x2048 è il massimo alla proporzione giusta.
  // Costo: ~200 neuroni a immagine → 6 canali ≈ 1.200 neuroni su 10.000 gratuiti/giorno.
  // Se il modello rifiuta una risoluzione, si passa automaticamente alla successiva.
  IMAGE_SIZES: [
    { width: 960, height: 2048 },
    { width: 928, height: 2016 },
    { width: 768, height: 1664 },
  ],

  // Modelli immagine Workers AI in ordine di preferenza.
  // klein-4b: qualità FLUX.2, ~290 neuroni a immagine ad alta risoluzione.
  // flux-1-schnell: fallback ultra-economico (~90 neuroni), max 1024px.
  IMAGE_MODEL_PRIMARY: "@cf/black-forest-labs/flux-2-klein-4b",
  IMAGE_MODEL_FALLBACK: "@cf/black-forest-labs/flux-1-schnell",

  // Ultimo fallback esterno (gratuito, senza chiavi): Pollinations.
  // Il tier anonimo serve immagini a risoluzione ridotta: meglio di niente,
  // e comunque il giorno dopo si torna al modello primario.
  POLLINATIONS_URL: "https://image.pollinations.ai/prompt/",

  // Modelli testo per l'evoluzione giornaliera della storia, in ordine di preferenza.
  TEXT_MODELS: [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/meta/llama-3.2-3b-instruct",
  ],

  // Modelli che sanno GUARDARE un'immagine: servono a leggere lo sfondo di ieri
  // e capire a che punto della storia è arrivato DAVVERO, invece di fidarsi del
  // calendario. Llama 3.2 Vision richiede un'accettazione di licenza una tantum
  // (vedi vision.js: la gestisce da solo al primo errore).
  VISION_MODELS: [
    "@cf/meta/llama-3.2-11b-vision-instruct",
    "@cf/llava-hf/llava-1.5-7b-hf",
  ],

  // --- CANCELLO DI COLLAUDO (vedi metrics.js) ---
  // Quanti tentativi al massimo per far rientrare il cambiamento nel profilo del
  // concept. Esauriti i tentativi si pubblica il candidato più vicino al bersaglio:
  // meglio uno sfondo imperfetto che nessuno sfondo.
  MAX_ATTEMPTS: 3,

  // Tempo massimo che il cancello può spendere in rigenerazioni per un flusso.
  // Oltre, si tiene il candidato migliore ottenuto fin lì: uno sfondo imperfetto
  // pubblicato vale più di un tentativo perfetto interrotto a metà.
  GATE_DEADLINE_MS: 100000,

  // Soglia (su 255) oltre la quale una cella della miniatura è considerata
  // "cambiata". 10 tiene fuori il rumore di ricompressione senza perdere
  // cambiamenti reali, verificato sull'archivio esistente.
  CHANGE_THRESHOLD: 10,

  // GUARDIE ASSOLUTE, valide per ogni concept.
  // Deriva: quanto può spostarsi la luminosità dell'INTERA scena da un giorno
  // all'altro. È così che si impone "dentro l'arco la luce non cambia": non lo
  // si chiede per favore nel prompt, lo si verifica e si rifiuta.
  MAX_DERIVA: 3.5,
  // Degrado: quanta nitidezza può perdere l'immagine in un giorno prima di
  // essere considerata "sciolta" dall'editing ripetuto. Tarato sull'archivio
  // reale: nei 33 confronti misurati il degrado positivo (perdita vera di
  // dettaglio) si è visto solo nel giorno in cui Studio si è rilluminato di
  // colpo, a +16. Sotto i 12 restano solo i giorni sani.
  MAX_DEGRADO: 12,

  // Arretramento: quanto può "tornare indietro" l'occupazione della scena
  // rispetto a ieri prima che il giorno sia considerato una regressione (in
  // punti percentuali). Un margine serve, perché il modello ridisegna e qualche
  // punto oscilla sempre; ma un calo netto significa che qualcosa è stato
  // cancellato, ed è successo davvero al primo collaudo (la pianta rimpicciolita
  // fra il terzo e il quarto giorno).
  MAX_ARRETRAMENTO: 4,

  // CICLO DI VITA DI UNO SFONDO: dopo esattamente N giorni il flusso chiude la
  // storia e ne pesca una COMPLETAMENTE NUOVA dalla libreria (nuovo mondo, nuovo
  // stile, nuovo soggetto), senza mai riprendere quella di prima.
  // 7 = una settimana esatta: l'utente vede un ciclo completo ogni settimana, e
  // la catena di editing resta cortissima (max 6 passaggi dal keyframe), quindi
  // la degradazione iterativa non ha il tempo di accumularsi.
  // INVARIANTE: ogni famiglia deve avere esattamente ARC_LENGTH_DAYS tappe —
  // verificato a caricamento modulo in channels.js.
  ARC_LENGTH_DAYS: 7,

  // --- Continuità visiva (image-conditioned generation) ---
  // Ogni giorno l'immagine di IERI entra come riferimento (input_image_0) nella
  // generazione di oggi: FLUX.2 klein mantiene composizione e palette e applica
  // solo il cambiamento descritto. Il giorno 1 di ogni arco è invece una
  // generazione pulita (keyframe): le catene di editing restano corte (max 11
  // passaggi) e la degradazione iterativa non si accumula mai oltre l'arco.
  //
  // klein accetta input < 512x512. Il ridimensionamento avviene con il binding
  // Images di Cloudflare, sui byte in memoria: prima ci si appoggiava al
  // servizio esterno images.weserv.nl, che pero' andava chiamato con un URL
  // pubblico e teneva in cache le miniature per URL, restituendo immagini
  // vecchie alle rigenerazioni. Quella dipendenza non c'e' piu'.
  REF_WIDTH: 236,   // ~stesso ratio 6:13 dell'output, entrambi i lati < 512
  REF_HEIGHT: 504,

  // Suffisso di composizione aggiunto a ogni prompt: tiene il soggetto centrato,
  // lascia pulita la fascia alta per l'orologio della lock screen, evita testo/watermark.
  WALLPAPER_SUFFIX:
    "vertical phone wallpaper, centered composition, calm uncluttered upper third, " +
    "no text, no watermark, no logo, no borders, no UI elements, " +
    "crisp detail, high quality, cohesive colors",
};
