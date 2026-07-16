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

  // Durata di un "arco narrativo": dopo N giorni il canale apre un nuovo capitolo
  // (nuovo tema dentro l'identità del canale, nuovo seed) per restare sempre fresco.
  ARC_LENGTH_DAYS: 12,

  // Suffisso di composizione aggiunto a ogni prompt: tiene il soggetto centrato,
  // lascia pulita la fascia alta per l'orologio della lock screen, evita testo/watermark.
  WALLPAPER_SUFFIX:
    "vertical phone wallpaper, centered composition, calm uncluttered upper third, " +
    "no text, no watermark, no logo, no borders, no UI elements, " +
    "crisp detail, high quality, cohesive colors",
};
