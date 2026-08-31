// Configurazione centrale di ArtiPop v3.
// Tutti i "numeri magici" del sistema vivono qui, con il perché di ogni scelta.

export const CONFIG = {
  // Fuso orario di riferimento per il concetto di "oggi".
  TIMEZONE: "Europe/Rome",

  // Risoluzioni tentate in ordine, in ratio ~6:13 (iPhone moderni sono 1290x2796).
  // Verificato empiricamente: flux-2-klein-4b accetta al massimo 2048 di altezza
  // (errore 3030 oltre), quindi 960x2048 è il massimo alla proporzione giusta.
  // Costo: ~290 neuroni a immagine (klein) → 3 canali ≈ 600-900 neuroni su 10.000 gratuiti/giorno.
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

  // Modelli TESTO Workers AI, per INVENTARE il concept della settimana
  // (inventa.js): il primario è il più capace, il fallback è piccolo ed
  // economico per quando il primario non risponde. Tornano qui dopo che
  // TEXT_MODELS era stato rimosso per inutilizzo (zero riferimenti nel repo):
  // ora un consumatore reale c'è, quindi la costante torna ad avere senso.
  // Niente response_format / JSON schema: NON è garantito su questi modelli —
  // il JSON si chiede nel prompt e la risposta si interpreta in modo
  // tollerante (interpretaRisposta in inventa.js).
  TEXT_MODEL_PRIMARY: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  TEXT_MODEL_FALLBACK: "@cf/meta/llama-3.1-8b-instruct-fast",

  // Tentativi complessivi per l'invenzione di un concept (primario + fallback
  // = 2): l'invenzione è un arricchimento opzionale del giro settimanale, non
  // deve mai mangiare tempo né budget — se fallisce si pesca dalla libreria
  // fissa e all'utente non arriva niente di rotto.
  INVENZIONE_MAX_TENTATIVI: 2,

  // Quanti element generati dalla macchina (auto:true) tenere AL MASSIMO per
  // canale nel catalogo: è la soglia `tieni` che il generatore settimanale
  // passa a potaGenerati() (catalog.js) dopo ogni invenzione. È ciò che tiene
  // `catalogo:custom` (UNA chiave KV) da crescere all'infinito: 40 archi
  // settimanali per canale di storia prima che la pota cominci a circolare.
  GENERATI_PER_CANALE: 40,

  // NOTA: qui vivevano anche VISION_MODELS (il modello che
  // leggeva lo sfondo di ieri per capire a che tappa fosse arrivata la
  // storia, sostituito dalle misure di metrics.js — vedi il commento in
  // testa a index.js — e rimosso insieme a vision.js e alle sue sonde
  // /test-vision, /test-ask). Quelli restano rimossi: nessun consumatore.

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

// --- FAMIGLIE SOSPESE DAI POOL DI PESCA (M9) ---
// Le famiglie qui elencate sono escluse dalla PESCA di un concept nuovo
// (vedi poolForWith in catalog.js, il punto unico che applica il filtro):
// una famiglia sospesa resta nel codice, e un arco già in corso o già
// archiviato su di essa non viene toccato — il filtro agisce solo a monte,
// sulla scelta di un concept NUOVO.
//
// M10 (2026-07-31): `attraversamento` tarata via lab su preview e riammessa.
// Il difetto sistemico (families.js la documentava: un edit diluito su gran
// parte della scena invece che concentrato sul soggetto, non un edit troppo
// forte) è risolto dalla riformulazione delle tappe in cancella-e-ridipingi.
// Arco gated di verifica (attraversamento×veliero, 7 giorni): 1.83 tentativi/
// giorno in media, sotto la soglia di 2 richiesta.
// Riserva nota, lasciata come materiale per un ciclo POLISH (budget standard
// da 10 generazioni/ciclo): solo veliero è stato validato con un arco gated
// completo; gli altri 8 element del roster (a parte canoa, vedi
// ELEMENT_SOSPESI sotto) non sono stati testati. Il cancello pubblica
// comunque il candidato migliore quando i tentativi finiscono (vedi
// generateWithGate in generate.js), quindi il rischio su questi element è di
// qualità/budget nei giorni in cui vengono pescati, non di rottura.
export const FAMIGLIE_SOSPESE = [];

// --- ELEMENT SOSPESI DAI POOL DI PESCA (granularità ELEMENT, non FAMIGLIA) ---
// M10 (2026-07-31): misurato che `canoa` non passa il cancello nemmeno dopo
// la riformulazione delle tappe che ha invece tarato `attraversamento`
// (estensione ~33% fuori dal massimo del profilo, compattezza 0.35 sotto il
// minimo) — un flusso che la pesca brucia tutti i tentativi dell'arco e
// pubblica comunque il candidato migliore: sfondo degradato per l'utente
// reale. Stesso meccanismo di FAMIGLIE_SOSPESE ma a granularità ELEMENT (vedi
// poolForWith in catalog.js, l'UNICO punto che applica anche questo filtro):
// canoa resta nel roster (concepts.js, archivio, raggiungibile per id dal
// lab) — sparisce solo dalla pesca casuale finché un arco lab gated su
// preview non la riporta dentro il profilo, come già fatto per
// attraversamento in M10. Condizione di uscita: rimuovere "canoa" da questa
// lista quando quell'arco gated è verde.
export const ELEMENT_SOSPESI = ["canoa"];
