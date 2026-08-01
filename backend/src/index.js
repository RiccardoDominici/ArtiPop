// ArtiPop v3 — Worker Cloudflare.
//
// Due responsabilità:
//   1. `scheduled` (cron giornaliero): per ogni flusso fa una richiesta interna
//      a /run/<flusso> tramite il binding SELF, così ogni flusso gira in una
//      invocazione separata (budget CPU indipendente sul piano free) e in
//      parallelo.
//   2. `fetch` (HTTP): serve le immagini (/w/<flusso>), la landing page, l'API
//      JSON e gli endpoint protetti di generazione.
//
// Il giro di un giorno, per un flusso:
//   a. si legge COM'E' ANDATA IERI dalle misure salvate ieri stesso: la tappa
//      e' stata saldata, oppure il modello e' rimasto indietro o corso avanti;
//   b. si sceglie la tappa di oggi di conseguenza, spalmando cio' che manca sui
//      giorni che restano — il settimo giorno chiude comunque (story.js);
//   c. si genera, si MISURA quanto e' cambiato davvero e si rigenera finche' il
//      cambiamento non rientra nel profilo del concept (generate.js + metrics.js);
//   d. si pubblica, conservando l'impronta di oggi per il confronto di domani.
//
// Il punto (a) usava un modello di visione che leggeva l'immagine. E' stato
// sostituito dalle misure perche' su fotogrammi inequivocabili sbagliava di
// grosso (dettagli e numeri in metrics.js, funzione `classify`).
//
// Robustezza: se un flusso fallisce, l'immagine precedente resta al suo posto —
// la Shortcut degli utenti non si rompe mai.

import { ACTIVE_CHANNELS, CHANNELS, resolveChannel, LEGACY_ALIASES } from "./channels.js";
import { todayKey } from "./story.js";
import {
  getImage, getMeta, getState, listChannelsWithArchive,
} from "./storage.js";
import {
  fingerprintFromArchive, compare, verdict, formatMeasures, diagnose,
} from "./metrics.js";
import { effectiveProfiles, saveTuning, clearTuning, defaultProfiles, dropTuningProfilo } from "./profiles.js";
import { runLabArc, getLabImage } from "./lab.js";
import { ELEMENTS } from "./concepts.js";
import { FAMILIES } from "./families.js";
import { FAMIGLIE_SOSPESE, ELEMENT_SOSPESI } from "./config.js";
// Il catalogo (concept/element aggiunti dall'utente, vedi catalog.js): si
// carica UNA volta per richiesta e si passa in giro, invece di rileggere KV
// a ogni chiamata a resolveConcept/poolForWith dentro lo stesso giro.
import {
  loadCatalog, saveConcept, saveElement, removeConcept, removeElement,
  resolveConcept, poolForWith,
} from "./catalog.js";
import { loadNote, putGiornoNota, putAssetto, removeAssetto } from "./note.js";
import { renderPage } from "./page.js";
import { renderHelpPage, renderShortcutMancante, renderErroreTemporaneo, renderPaginaNonTrovata } from "./help.js";
import { renderArchiviPage } from "./archivi.js";
import { PLACEHOLDER_PNG_BYTES, PLACEHOLDER_CONTENT_TYPE } from "./placeholder.js";
// L'orchestrazione di un giorno di produzione (runChannel, backfillChannel,
// fanOutAll, regenDay, la ricostruzione storica dell'archivio) vive qui:
// index.js resta il router, handlers.js sa come si genera un giorno. Vedi la
// testa di handlers.js per il perché della separazione.
import {
  runChannel, backfillChannel, fanOutAll, regenDay, archivioCanale, buildFreschezzaState,
  cartaDiIdentita,
} from "./handlers.js";

/**
 * Confronto della chiave admin. Di norma solo l'header `x-artipop-key`: la
 * query string finisce nei log di Cloudflare, nella cronologia del browser e
 * nei proxy, quindi non è un trasporto sicuro per una credenziale che spende
 * neuroni AI e scrive nel KV di produzione. L'unica eccezione ammessa è
 * `chiaveNellUrl: true`, usata dal solo `GET /lab/img`: è caricata da un
 * `<img src>`, che non può portare header custom.
 */
function isAuthorized(request, env, { chiaveNellUrl = false } = {}) {
  if (!env.ADMIN_KEY) return false; // senza secret configurato, gli admin sono chiusi
  const url = new URL(request.url);
  const inUrl = chiaveNellUrl ? url.searchParams.get("key") : null;
  const provided = request.headers.get("x-artipop-key") || inUrl || "";
  return provided === env.ADMIN_KEY;
}

/**
 * 403 dedicato al caso in cui la chiave arriva SOLO da `?key=` su una rotta
 * che non lo ammette: spiega dove va messa senza mai stampare il valore.
 */
function nonAutorizzato(request, env, opzioni, respond) {
  if (isAuthorized(request, env, opzioni)) return null;
  const url = new URL(request.url);
  if (!opzioni?.chiaveNellUrl && url.searchParams.get("key")) {
    return respond(
      { error: "non autorizzato: la chiave va passata nell'header x-artipop-key, non in ?key=" },
      403
    );
  }
  return respond({ error: "non autorizzato" }, 403);
}

/**
 * Legge `?c=<canale>&d=<data>` sulla rotta `/` (feat-condividi-il-giorno-
 * che-stai-guardando, ciclo 48; esteso agli alias storici in feat-i-vecchi-
 * indirizzi-aprono-il-canale-erede) e li valida per l'anteprima social.
 * `canale` accetta sia un id di flusso ATTIVO sia un alias storico (island,
 * bloom, studio, …, vedi LEGACY_ALIASES): deve risolversi in un flusso attivo
 * — lo stesso che il deck lato client riconosce in page.js. L'id restituito è
 * però quello RICHIESTO, non quello del flusso erede: l'og:image legge
 * l'archivio storico di quell'id (vedi channels.js:59-62), non quello del
 * flusso che ne ha raccolto l'eredità. La data deve avere formato
 * YYYY-MM-DD, essere una data di calendario reale (non "2026-02-30") e non
 * futura rispetto a oggi. Una condizione qualsiasi che cade → `null`, mai un
 * `og:image` verso una rotta che non esiste.
 */
function risolviCondiviso(url, oggi) {
  const canale = url.searchParams.get("c");
  const data = url.searchParams.get("d");
  if (!canale || !data) return null;
  const { channel } = resolveChannel(canale);
  if (!channel || !channel.active) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const [anno, mese, giorno] = data.split("-").map(Number);
  const parsed = new Date(Date.UTC(anno, mese - 1, giorno));
  const dataReale =
    parsed.getUTCFullYear() === anno &&
    parsed.getUTCMonth() === mese - 1 &&
    parsed.getUTCDate() === giorno;
  if (!dataReale) return null;
  if (data > oggi) return null;
  return { canale, data };
}

/** Risposta JSON con status. */
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/* ===================== HTTP ===================== */

export default {
  /** Cron giornaliero: genera tutti i flussi. */
  async scheduled(event, env, ctx) {
    console.log(`[cron] avvio generazione giornaliera (${new Date().toISOString()})`);
    ctx.waitUntil(
      fanOutAll(env).then((results) => {
        console.log(`[cron] completato: ${JSON.stringify(results)}`);
      })
    );
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- CORS per lo strumento di tuning (gira da file:// → origine "null") ----
    // Gli endpoint /tuning, /lab e /catalogo servono la UI locale, quindi
    // devono rispondere cross-origin. La scrittura resta protetta dalla
    // chiave admin: CORS permette solo di *tentare* la richiesta, non di
    // autenticarsi.
    const CORS = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, x-artipop-key",
      "access-control-max-age": "86400",
    };
    // Header di sicurezza sulle DUE pagine HTML pubbliche (/ e /aiuto). Niente
    // CSP: la pagina usa JS/CSS inline (page.js/help.js) e introdurla senza
    // riscriverle sarebbe una modifica ben oltre l'essenzialità (ROADMAP M8).
    const SECURITY_HEADERS = {
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-frame-options": "DENY",
    };

    // Anche le API di sola lettura servono lo strumento: la sua tab "Archivio"
    // elenca i flussi (/api/channels), le date in archivio (/api/archive/...) e
    // misura due giorni già pubblicati (/test-metrics). Senza CORS quelle fetch
    // partono da un'origine "null" e il browser le blocca, quindi la tab resta
    // vuota pur essendo tutto raggiungibile. Le immagini no: i tag <img> non
    // passano dal controllo di origine, e infatti quelle si vedevano già.
    const isTool =
      path === "/tuning" || path.startsWith("/lab/") ||
      path === "/catalogo" || path === "/catalogo/concept" || path === "/catalogo/element" ||
      path === "/api/channels" || path.startsWith("/api/archive/") || path === "/test-metrics" ||
      path === "/note" || path === "/note/giorno" || path === "/note/assetto";
    if (isTool && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const jsonCors = (data, status = 200) =>
      new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", ...CORS },
      });

    // Avvolge una scrittura admin (KV.put/delete e dintorni): se `fn` lancia
    // (es. KV irraggiungibile), risponde 500 con una frase UMANA costante,
    // uguale per tutte e 9 le rotte — mai `err.message`/stack/env nel corpo
    // (divieto segreti), il dettaglio tecnico va solo nel log del Worker.
    const scritturaProtetta = async (etichetta, fn) => {
      try { return await fn(); }
      catch (err) {
        console.error(`[scrittura] ${etichetta} fallita: ${err.message}`);
        return jsonCors({ ok: false, error: "salvataggio non riuscito, riprova" }, 500);
      }
    };

    // Gemello di `scritturaProtetta` per le rotte admin che chiamano il
    // binding AI/KV fuori da una scrittura (lab/arc, run, backfill, test-size):
    // stesso divieto, `err.message`/stack/env restano SOLO nel log del
    // Worker, mai nel corpo HTTP — è lì che un token o un URL firmato
    // dell'upstream finirebbero altrimenti dritti nella risposta.
    const erroreInterno = (etichetta, err, rispondi, frase, extra = {}) => {
      console.error(`[${etichetta}] fallito: ${err.message}`, err.stack);
      return rispondi({ ok: false, error: frase, ...extra }, 500);
    };

    // Sceglie il corpo di emergenza in base alla rotta, quando un'eccezione
    // imprevista sfugge da tutto il routing sottostante (rete di sicurezza
    // globale, vedi il try/catch che segue): mai un corpo JSON o l'errore
    // generico di Cloudflare verso /w/ (la Shortcut si aspetta byte immagine),
    // mai HTML verso l'API. Nessun `err.message`/stack qui dentro: solo una
    // frase umana costante, come già fa `scritturaProtetta` per le scritture.
    const rispostaDiEmergenza = (percorso) => {
      if (percorso.match(/^\/w\/([a-z]+)(?:\.(?:jpg|jpeg|png))?$/)) {
        return new Response(PLACEHOLDER_PNG_BYTES, {
          status: 500,
          headers: { "content-type": PLACEHOLDER_CONTENT_TYPE, "cache-control": "no-store" },
        });
      }
      const rottaHtml =
        percorso === "/" || percorso === "/index.html" ||
        percorso === "/aiuto" || percorso === "/aiuto.html" || percorso === "/help" ||
        percorso === "/archivi" ||
        percorso.match(/^\/s\/([a-z]+(?:-base)?)\.shortcut$/);
      if (rottaHtml) {
        return new Response(renderErroreTemporaneo(), {
          status: 500,
          headers: {
            "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
            ...SECURITY_HEADERS,
          },
        });
      }
      return jsonCors({ ok: false, error: "errore temporaneo, riprova" }, 500);
    };

    // Rete di sicurezza globale (CLAUDE.md, principio 3): tutto il routing
    // sottostante vive qui dentro, così una qualsiasi eccezione imprevista
    // (KV irraggiungibile, valore corrotto, bug su un ramo non ancora coperto)
    // non fa più esplodere il worker fino alla pagina d'errore generica di
    // Cloudflare — risponde sempre `rispostaDiEmergenza`, nella forma che la
    // rotta chiamata si aspetta. `url`, `path`, `CORS`, `SECURITY_HEADERS`,
    // `jsonCors`, `scritturaProtetta` restano definiti fuori: il catch li usa.
    try {

    // ---- Tuning dei range (concept = schema di evoluzione) ----
    // GET  /tuning        → default del codice + valori effettivi + elenco element
    // PUT  /tuning        → salva l'override in KV (protetto)
    // DELETE /tuning      → torna ai default del codice (protetto)
    if (path === "/tuning") {
      if (request.method === "GET") {
        // Il catalogo entra qui SOLO per i concept (i range dei custom vanno
        // tarati come quelli built-in). L'elenco `elements` resta quello di
        // sempre: la forma della risposta è invariata a posta, come da contratto.
        const catalog = await loadCatalog(env);
        return jsonCors({
          concepts: await effectiveProfiles(env, catalog),
          defaults: defaultProfiles(catalog),
          elements: ELEMENTS.map((e) => ({
            id: e.id, nome: e.nome, soggetto: e.soggetto, famigliaNativa: e.famigliaNativa,
          })),
        });
      }
      if (request.method === "PUT" || request.method === "POST") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ error: "JSON non valido nel corpo della richiesta" }, 400); }
        return scritturaProtetta("PUT /tuning", async () => {
          const catalog = await loadCatalog(env);
          const res = await saveTuning(env, body, catalog);
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      if (request.method === "DELETE") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        return scritturaProtetta("DELETE /tuning", async () => {
          await clearTuning(env);
          return jsonCors({ ok: true, cleared: true });
        });
      }
      return jsonCors({ error: "metodo non ammesso" }, 405);
    }

    // ---- Catalogo: concept ed element creati dall'utente (vedi catalog.js) ----
    // GET    /catalogo                  → pubblico: built-in + custom, uniti
    // PUT    /catalogo/concept          → crea/aggiorna un concept custom (admin)
    // DELETE /catalogo/concept?id=X     → lo rimuove (admin)
    // PUT    /catalogo/element          → crea/aggiorna un element custom (admin)
    // DELETE /catalogo/element?id=X     → lo rimuove (admin)
    if (path === "/catalogo") {
      if (request.method !== "GET") return jsonCors({ error: "metodo non ammesso" }, 405);
      const catalog = await loadCatalog(env);

      // I concept built-in sono le famiglie: stessa forma dei custom, con
      // `custom:false`. Le tappe restano GREZZE (con {s}): è l'element,
      // quando ne porta di proprie, a risolverle — qui i built-in non le
      // portano (vedi ELEMENTS in concepts.js), quindi restano null.
      const concepts = [
        ...Object.entries(FAMILIES).map(([id, fam]) => ({
          id,
          nome: fam.nome,
          custom: false,
          conserva: fam.conserva,
          tappe: fam.tappe,
          extra: fam.extra,
          profilo: {
            estensione: fam.profilo.estensione,
            intensita: fam.profilo.intensita,
            compattezza: fam.profilo.compattezza,
            monotona: Boolean(fam.profilo.monotona),
          },
          maxDeriva: fam.profilo.maxDeriva ?? fam.maxDeriva ?? null,
          maxDegrado: fam.profilo.maxDegrado ?? fam.maxDegrado ?? null,
          sospeso: FAMIGLIE_SOSPESE.includes(id),
        })),
        ...Object.values(catalog.concepts).map((c) => ({
          ...c, custom: true, sospeso: FAMIGLIE_SOSPESE.includes(c.id),
        })),
      ];

      const elements = [
        // `tappe`/`extra` vengono da ELEMENTS (concepts.js): null per la
        // stragrande maggioranza (ereditano quelle della famiglia), già
        // risolte ({s} sostituito) per i pochi element — felce, cactus — che
        // ne portano di proprie e dedicate.
        ...ELEMENTS.map((e) => ({
          id: e.id,
          nome: e.nome,
          custom: false,
          s: e.soggetto,
          soggetto: e.soggetto,
          setting: e.setting,
          style: e.style,
          palette: e.palette,
          famigliaNativa: e.famigliaNativa,
          tappe: e.tappe,
          extra: e.extra,
          pubblicato: true,
          canale: CHANNELS.find((c) => c.famiglie.includes(e.famigliaNativa))?.id ?? null,
          sospeso: ELEMENT_SOSPESI.includes(e.id) || FAMIGLIE_SOSPESE.includes(e.famigliaNativa),
        })),
        ...Object.values(catalog.elements).map((e) => ({
          ...e,
          custom: true,
          sospeso: ELEMENT_SOSPESI.includes(e.id) || FAMIGLIE_SOSPESE.includes(e.famigliaNativa),
        })),
      ];

      return jsonCors({ concepts, elements });
    }

    if (path === "/catalogo/concept") {
      if (request.method === "PUT" || request.method === "POST") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ ok: false, id: null, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
        return scritturaProtetta("PUT /catalogo/concept", async () => {
          const res = await saveConcept(env, body);
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      if (request.method === "DELETE") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        return scritturaProtetta("DELETE /catalogo/concept", async () => {
          const res = await removeConcept(env, url.searchParams.get("id") || "");
          if (res.ok === true) {
            // Il concept è già rimosso: un override di tuning orfano è meno
            // grave di una 500 su un'operazione riuscita, quindi non deve
            // mai far fallire la risposta.
            try {
              await dropTuningProfilo(env, res.rimosso);
            } catch (err) {
              console.warn(`[index] pulizia tuning per concept "${res.rimosso}" fallita: ${err.message}`);
            }
          }
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      return jsonCors({ error: "metodo non ammesso" }, 405);
    }

    if (path === "/catalogo/element") {
      if (request.method === "PUT" || request.method === "POST") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ ok: false, id: null, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
        return scritturaProtetta("PUT /catalogo/element", async () => {
          const res = await saveElement(env, body);
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      if (request.method === "DELETE") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        return scritturaProtetta("DELETE /catalogo/element", async () => {
          const res = await removeElement(env, url.searchParams.get("id") || "");
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      return jsonCors({ error: "metodo non ammesso" }, 405);
    }

    // ---- Note: marcature dei giorni e assetti di tuning salvati (vedi note.js) ----
    // GET    /note              → admin: come la scrittura, sono note libere e assetti privati dell'autore
    // PUT    /note/giorno       → segna (o smarca) un giorno buono/scarto (admin)
    // PUT    /note/assetto      → salva un assetto di range con un nome (admin)
    // DELETE /note/assetto?id=X → lo rimuove (admin)
    if (path === "/note") {
      if (request.method !== "GET") return jsonCors({ error: "metodo non ammesso" }, 405);
      {
        const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
        if (rifiuto) return rifiuto;
      }
      return jsonCors(await loadNote(env));
    }

    if (path === "/note/giorno") {
      if (request.method !== "PUT" && request.method !== "POST") return jsonCors({ error: "metodo non ammesso" }, 405);
      {
        const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
        if (rifiuto) return rifiuto;
      }
      let body;
      try { body = await request.json(); }
      catch { return jsonCors({ ok: false, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
      return scritturaProtetta("PUT /note/giorno", async () => {
        const res = await putGiornoNota(env, body);
        return jsonCors(res, res.ok ? 200 : 400);
      });
    }

    if (path === "/note/assetto") {
      if (request.method === "PUT" || request.method === "POST") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ ok: false, id: null, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
        return scritturaProtetta("PUT /note/assetto", async () => {
          const res = await putAssetto(env, body);
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      if (request.method === "DELETE") {
        {
          const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
          if (rifiuto) return rifiuto;
        }
        return scritturaProtetta("DELETE /note/assetto", async () => {
          const res = await removeAssetto(env, url.searchParams.get("id") || "");
          return jsonCors(res, res.ok ? 200 : 400);
        });
      }
      return jsonCors({ error: "metodo non ammesso" }, 405);
    }

    // NOTA: qui viveva /lab/elements, un elenco concept+element per i menu
    // della UI di tuning. Soppiantato da /catalogo, che è la stessa fonte da
    // cui il tool costruisce già i suoi menu (built-in + custom uniti):
    // tenerne due significava rischiare che divergessero.

    // ---- Lab: genera un arco di prova (protetto) ----
    // GET/POST /lab/arc?concept=<schema>&element=<soggetto>&days=7&gate=0
    if (path === "/lab/arc") {
      {
        const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
        if (rifiuto) return rifiuto;
      }
      const familyId = url.searchParams.get("concept") || "";
      const elementId = url.searchParams.get("element") || "";
      const days = Number(url.searchParams.get("days")) || 7;
      const gate = url.searchParams.get("gate") === "1";
      // runId senza Date.now-in-workflow: qui siamo in un Worker normale, Date.now
      // è disponibile. Il runId identifica le immagini temporanee in KV.
      const runId = `${familyId}-${elementId}-${Date.now().toString(36)}`;
      try {
        const catalog = await loadCatalog(env);
        const res = await runLabArc(env, { familyId, elementId, days, gate, runId, catalog });
        return jsonCors(res);
      } catch (err) {
        return erroreInterno(`lab ${familyId}+${elementId}`, err, jsonCors,
          "generazione di prova non riuscita, controlla i log del worker");
      }
    }

    // ---- Lab: serve un'immagine di prova ----
    const labImgMatch = path === "/lab/img";
    if (labImgMatch) {
      const rifiuto = nonAutorizzato(request, env, { chiaveNellUrl: true }, jsonCors);
      if (rifiuto) return rifiuto;
      const runId = url.searchParams.get("run") || "";
      const n = Number(url.searchParams.get("n"));
      const img = await getLabImage(env, runId, n);
      if (!img) return jsonCors({ error: "immagine di prova non trovata o scaduta" }, 404);
      return new Response(img.stream, {
        headers: {
          "content-type": img.meta.contentType || "image/png",
          "cache-control": "no-store",
          ...CORS,
        },
      });
    }

    // ---- Immagine del giorno: /w/<flusso> (accetta anche .jpg/.png in coda) ----
    const wMatch = path.match(/^\/w\/([a-z]+)(?:\.(?:jpg|jpeg|png))?$/);
    if (wMatch) {
      const chId = wMatch[1];

      // "random": ogni giorno un flusso diverso, deterministico per data.
      let requested = chId;
      if (chId === "random") {
        const day = Math.floor(Date.parse(todayKey()) / 86400000);
        requested = ACTIVE_CHANNELS[day % ACTIVE_CHANNELS.length].id;
      }

      const { channel, isLegacy } = resolveChannel(requested);
      if (!channel) {
        // Flusso non risolvibile (id ritirato, refuso nell'URL): MAI JSON qui
        // (ROADMAP M4) — è lo stesso indirizzo da cui la Shortcut scarica i
        // byte da applicare alla lock screen, quindi anche questo terzo ramo
        // di fallimento (oltre a "canale mai generato" e "?date= inesistente"
        // più sotto) serve il placeholder statico invece di un corpo JSON.
        return new Response(PLACEHOLDER_PNG_BYTES, {
          status: 404,
          headers: {
            "content-type": PLACEHOLDER_CONTENT_TYPE,
            "cache-control": "no-store",
          },
        });
      }

      const dateParam = url.searchParams.get("date");
      const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
      const vParam = url.searchParams.get("v");
      const v = vParam && /^\d{4}-\d{2}-\d{2}$/.test(vParam) ? vParam : null;
      const dl = url.searchParams.get("dl") === "1";

      // Con ?date= si legge l'archivio dell'id RICHIESTO: la storia dei vecchi
      // canali resta consultabile per sempre sotto il suo nome. Senza data si
      // segue l'alias e si serve l'immagine di oggi del flusso erede.
      const sorgente = date ? requested : channel.id;
      let img = await getImage(env, sorgente, date);

      // Rete di sicurezza per le Shortcut già installate: se il flusso erede
      // non ha ancora prodotto nulla (subito dopo un cambio di nomi, prima del
      // primo cron), si serve comunque l'ultima immagine del vecchio canale
      // invece di un 404. Meglio uno sfondo di ieri che uno sfondo rotto.
      if (!img && isLegacy) img = await getImage(env, requested, date);
      if (!img && date && isLegacy) img = await getImage(env, channel.id, date);

      // Nessuna immagine trovata (canale attivo mai generato, o ?date=
      // inesistente): MAI JSON qui (ROADMAP M4). La Shortcut "Imposta sfondo"
      // scarica byte da questo indirizzo e li applica alla lock screen — un
      // corpo JSON non è un'immagine valida e l'utente vede un errore muto.
      // Su /w/ il corpo è SEMPRE un'immagine, qualunque sia il motivo del
      // fallimento: flusso inesistente (sopra), canale mai generato, o
      // ?date= inesistente (qui sotto). Si serve sempre il placeholder
      // statico (vedi placeholder.js): 200 se il canale è semplicemente
      // vuoto (nessuna data richiesta), 404 se era stata chiesta una data
      // che non esiste — lo status racconta la verità, il corpo resta
      // comunque un'immagine valida.
      if (!img) {
        return new Response(PLACEHOLDER_PNG_BYTES, {
          status: date ? 404 : 200,
          headers: {
            "content-type": PLACEHOLDER_CONTENT_TYPE,
            "cache-control": "no-store",
          },
        });
      }

      // cache-control a tre vie: l'archivio (?date=) è byte-stabile e si
      // cachea per sempre; il sito manda ?v=<data del meta> per distinguersi
      // dalla Shortcut, che chiama lo stesso indirizzo senza query e deve
      // sempre ricevere il file fresco (mai una cache tra lei e il worker).
      const cacheControl = date
        ? "public, max-age=604800, immutable"
        : v
          ? "public, max-age=3600"
          : "no-store, must-revalidate";

      const headers = {
        "content-type": img.meta.contentType || "image/png",
        "cache-control": cacheControl,
        "x-artipop-date": img.meta.date || "",
        "x-artipop-model": img.meta.model || "",
      };

      // ?dl=1: consegna il file con un nome parlante invece del blob "natura"
      // senza estensione che il browser userebbe di default (principio 1).
      // Solo quando esiste davvero un'immagine: un segnaposto non si scarica
      // con il nome di un wallpaper che non c'è.
      if (dl) {
        const idPulito = channel.id.replace(/[^a-z0-9-]/g, "");
        const dataFile = img.meta.date || date;
        const est = img.meta.contentType === "image/jpeg" ? "jpg" : "png";
        if (idPulito) {
          const nome = dataFile
            ? `artipop-${idPulito}-${dataFile}.${est}`
            : `artipop-${idPulito}.${est}`;
          headers["content-disposition"] = `attachment; filename="${nome}"`;
        }
      }

      return new Response(img.stream, { headers });
    }

    // ---- Download della Shortcut firmata: /s/<flusso>[-base].shortcut ----
    const sMatch = path.match(/^\/s\/([a-z]+(?:-base)?)\.shortcut$/);
    if (sMatch) {
      // Stessa pagina 404 sia se la chiave manca sia se il binding KV lancia
      // (principio 3, robustezza): mai un JSON grezzo né l'errore generico di
      // Cloudflare al posto della Shortcut (coerente con M4 su /w/).
      let file = null;
      try {
        file = await env.KV.get(`shortcut:${sMatch[1]}`, { type: "stream" });
      } catch {
        file = null;
      }
      if (!file) {
        return new Response(renderShortcutMancante(sMatch[1]), {
          status: 404,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            ...SECURITY_HEADERS,
          },
        });
      }
      return new Response(file, {
        headers: {
          "content-type": "application/octet-stream",
          // `inline` e non `attachment`: con attachment Safari su iOS salva il
          // file nei Download senza dire niente. Con inline il tap apre il
          // foglio di sistema, da cui iOS propone direttamente Comandi rapidi.
          "content-disposition": `inline; filename="ArtiPop-${sMatch[1]}.shortcut"`,
          "cache-control": "public, max-age=3600",
        },
      });
    }

    // ---- API JSON: stato di tutti i flussi ----
    if (path === "/api/channels") {
      const catalog = await loadCatalog(env);
      const metas = await Promise.all(ACTIVE_CHANNELS.map((c) => getMeta(env, c.id)));
      const channels = ACTIVE_CHANNELS.map((c, i) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        accent: c.accent,
        tagline: c.tagline,
        taglineEn: c.taglineEn,
        famiglie: c.famiglie,
        // Pool VERO: built-in più gli element custom pubblicati su questo flusso.
        concepts: poolForWith(c, catalog).length,
        storico: false,
        url: `${url.origin}/w/${c.id}`,
        today: metas[i],
      }));

      // `?all=1`: in coda anche i canali storici che hanno un archivio ma non
      // sono più attivi (island, bloom, studio, neon…), per lo strumento di
      // tuning — che così scopre i canali dall'API invece di tenerne una
      // lista scritta a mano. SENZA `?all=1` la risposta resta byte per byte
      // quella di sempre, perché la consuma anche il sito (page.js).
      if (url.searchParams.get("all") === "1") {
        const attivi = new Set(ACTIVE_CHANNELS.map((c) => c.id));
        const storici = await listChannelsWithArchive(env);
        for (const [id, info] of storici) {
          if (attivi.has(id)) continue;
          channels.push({
            id,
            name: id,
            emoji: "🗄",
            accent: null,
            tagline: null,
            taglineEn: null,
            famiglie: [],
            concepts: 0,
            storico: true,
            ereditaDa: LEGACY_ALIASES[id] ?? null,
            giorni: info.giorni,
            prima: info.prima,
            ultima: info.ultima,
            url: `${url.origin}/w/${id}`,
            today: null,
          });
        }
      }

      return jsonCors({ channels });
    }

    // ---- API archivio: date disponibili per un flusso, con la carta d'identità di ognuna ----
    const archMatch = path.match(/^\/api\/archive\/([a-z]+)$/);
    if (archMatch) {
      const canale = archMatch[1];
      // 400 e non 365: l'indice degli usi del tool di tuning ha bisogno di
      // vedere l'archivio intero di un canale, non solo il più recente
      // (il default resta 60, invariato per chi non lo specifica).
      const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 400);
      return jsonCors(await archivioCanale(env, canale, limit));
    }

    // ---- Generazione manuale/interna di un flusso: /run/<flusso>?[force=1] ----
    const runMatch = path.match(/^\/run\/([a-z]+)$/);
    if (runMatch) {
      {
        const rifiuto = nonAutorizzato(request, env, {}, json);
        if (rifiuto) return rifiuto;
      }
      try {
        const result = await runChannel(env, runMatch[1], {
          force: url.searchParams.get("force") === "1",
        });
        return json(result);
      } catch (err) {
        return erroreInterno(`run ${runMatch[1]}`, err, json,
          "generazione non riuscita, controlla i log del worker");
      }
    }

    // ---- Backfill storico (admin): /backfill?ch=<flusso>&days=7[&gate=0] ----
    if (path === "/backfill") {
      {
        const rifiuto = nonAutorizzato(request, env, {}, json);
        if (rifiuto) return rifiuto;
      }
      const ch = url.searchParams.get("ch") || "";
      const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 2), 7);
      const conGate = url.searchParams.get("gate") !== "0";
      // SINCRONO di proposito: la richiesta aperta tiene vivo il worker per
      // tutta la durata. Con waitUntil il runtime chiude il lavoro dopo ~30-60s
      // dalla risposta (verificato: backfill morti a 2/7 giorni).
      try {
        const results = await backfillChannel(env, ch, days, { conGate });
        return json({ channel: ch, days, conGate, results });
      } catch (err) {
        return erroreInterno(`backfill ${ch}`, err, json,
          "generazione non riuscita, controlla i log del worker");
      }
    }

    // ---- Rigenerazione di UN giorno: /regen-day?ch=X&date=YYYY-MM-DD ----
    // Utile quando un singolo fotogramma esce male: ricostruisce lo stato di
    // quel giorno e rigenera solo quell'immagine. Il corpo vive in
    // handlers.regenDay: qui si estraggono solo i query param e si traduce
    // l'esito (o l'ErroreDominio) in una Response.
    if (path === "/regen-day") {
      {
        const rifiuto = nonAutorizzato(request, env, {}, json);
        if (rifiuto) return rifiuto;
      }
      const ch = url.searchParams.get("ch") || "";
      const date = url.searchParams.get("date") || "";
      try {
        const result = await regenDay(env, { ch, date });
        return json(result);
      } catch (err) {
        // ErroreDominio porta il proprio status (400 per input/stato non
        // valido); un fallimento di generazione resta un Error "semplice" e
        // cade sul 500 di default. `err.message` qui è sempre un testo di
        // dominio scritto da noi (mai un errore d'upstream), a differenza
        // di /run e /backfill: resta nel corpo, invariato.
        return json({ error: err.message }, err.status ?? 500);
      }
    }

    // ---- Generazione manuale di tutti i flussi: /run-all?[force=1] ----
    if (path === "/run-all") {
      {
        const rifiuto = nonAutorizzato(request, env, {}, json);
        if (rifiuto) return rifiuto;
      }
      const results = await fanOutAll(env, { force: url.searchParams.get("force") === "1" });
      return json(results);
    }

    // ---- Sonda del misuratore (admin): /test-metrics?ch=X&a=DATA&b=DATA ----
    if (path === "/test-metrics") {
      // jsonCors e non json: lo strumento di tuning chiama questa sonda dalla sua
      // tab Archivio per misurare due giorni gia' pubblicati, e gira da file://.
      {
        const rifiuto = nonAutorizzato(request, env, {}, jsonCors);
        if (rifiuto) return rifiuto;
      }
      const ch = url.searchParams.get("ch") || "natura";
      const a = url.searchParams.get("a");
      const b = url.searchParams.get("b");
      if (!a || !b) return jsonCors({ error: "servono ?a= e ?b= (due date YYYY-MM-DD)" }, 400);
      const t0 = Date.now();
      const [fa, fb] = await Promise.all([
        fingerprintFromArchive(env, ch, a),
        fingerprintFromArchive(env, ch, b),
      ]);
      if (!fa || !fb) {
        return jsonCors({ ok: false, bindingPresente: Boolean(env.IMAGES), diagnosi: await diagnose(env, ch, a) }, 502);
      }
      const m = compare(fa, fb);
      // Se si indica anche ?concept= si vede il verdetto che avrebbe dato il cancello.
      // resolveConcept copre anche un id custom (built-in o element pubblicato).
      const conceptId = url.searchParams.get("concept");
      const concept = conceptId ? resolveConcept(conceptId, await loadCatalog(env)) : null;
      return jsonCors({
        ok: true, ch, a, b, ms: Date.now() - t0,
        misure: m, riga: formatMeasures(m),
        verdetto: concept ? verdict(m, concept.profilo) : null,
      });
    }

    // NOTA: qui vivevano /test-vision e /test-ask, le sonde del modello di
    // visione che leggeva l'immagine di ieri per capire a che tappa fosse
    // arrivata la storia (vedi il commento in testa al file). Rimosse insieme
    // a vision.js quando le misure di metrics.js le hanno sostituite.

    // ---- Probe risoluzione (admin): /test-size?w=1152&h=2496 ----
    if (path === "/test-size") {
      {
        const rifiuto = nonAutorizzato(request, env, {}, json);
        if (rifiuto) return rifiuto;
      }
      const w = Number(url.searchParams.get("w"));
      const h = Number(url.searchParams.get("h"));
      if (!w || !h) return json({ error: "servono ?w= e ?h=" }, 400);
      try {
        const { tryKleinSize } = await import("./generate.js");
        const img = await tryKleinSize(env, "a simple gradient test", { width: w, height: h });
        return json({ ok: true, size: `${w}x${h}`, bytes: img.bytes.length });
      } catch (err) {
        return erroreInterno(`test-size ${w}x${h}`, err, json,
          "prova di risoluzione non riuscita, controlla i log del worker", { size: `${w}x${h}` });
      }
    }

    // ---- Healthcheck ----
    if (path === "/health") {
      const catalog = await loadCatalog(env);
      // Stato per flusso (chiave state:<canale>, vedi storage.js): ci vive il
      // campo `cancello` dell'ultima esecuzione (ROADMAP M5), scritto da
      // runChannel/backfillChannel in handlers.js. Letto qui e non altrove:
      // così il cancello disattivato (impronte null, IMAGES assente/rotto) è
      // visibile senza `wrangler tail`.
      const states = await Promise.all(ACTIVE_CHANNELS.map((c) => getState(env, c.id)));
      // `freschezza` (accanto a `cancello`, stesso spirito): il cancello dice
      // se l'ultima esecuzione ha misurato, freschezza dice se l'ultima
      // esecuzione è di OGGI — un flusso può avere entrambe "ok" e cancello
      // "ok" da giorni senza che nessuno se ne accorga (vedi PLAN.md).
      const oggi = todayKey();
      const flussi = ACTIVE_CHANNELS.map((c, i) => ({
        id: c.id, famiglie: c.famiglie, concepts: poolForWith(c, catalog).length,
        cancello: states[i]?.cancello ?? null,
        freschezza: buildFreschezzaState(states[i], oggi),
      }));
      return json({
        ok: true,
        flussi,
        flussiFermi: flussi.filter((f) => !f.freschezza.aggiornato).length,
        misuratore: Boolean(env.IMAGES),
      });
    }

    // ---- Pagina di aiuto ----
    if (path === "/aiuto" || path === "/aiuto.html" || path === "/help") {
      // feat-l-aiuto-dice-se-il-canale-e-fermo: stesso stato di /health
      // (getState + buildFreschezzaState), letto qui SOLO per mostrarlo —
      // nessuna scrittura KV, nessuna chiamata AI/IMAGES. Qualunque lettura
      // fallita (KV assente/rotto) riporta alla pagina di sempre: /aiuto è
      // il posto dove si arriva quando qualcosa non va, non deve MAI essere
      // lei stessa a rompersi.
      let stato = null;
      try {
        const states = await Promise.all(ACTIVE_CHANNELS.map((c) => getState(env, c.id)));
        const oggi = todayKey();
        stato = ACTIVE_CHANNELS.map((c, i) => ({
          id: c.id, nome: c.name, ...buildFreschezzaState(states[i], oggi),
        }));
      } catch (err) {
        console.error(`[aiuto] stato canali non disponibile: ${err.message}`);
        stato = null;
      }
      return new Response(renderHelpPage(stato), {
        headers: {
          "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600",
          ...SECURITY_HEADERS,
        },
      });
    }

    // ---- Pagina archivi storici ----
    if (path === "/archivi") {
      // feat-gli-archivi-storici-si-riaprono-dal-sito: scansione KV SOLO su
      // richiesta esplicita di questa pagina, mai nel giro di produzione
      // (contratto di listChannelsWithArchive, storage.js). Una scansione
      // fallita non deve mai rompere la pagina: null → messaggio umano,
      // stesso trattamento di /aiuto per lo stato canali.
      let storici = null;
      try {
        const attivi = new Set(ACTIVE_CHANNELS.map((c) => c.id));
        const mappa = await listChannelsWithArchive(env);
        storici = [...mappa]
          .filter(([id]) => !attivi.has(id))
          .map(([id, info]) => ({ id, ...info }))
          .sort((a, b) => (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0));
      } catch (err) {
        console.error(`[archivi] scansione KV non disponibile: ${err.message}`);
        storici = null;
      }
      // feat-l-archivio-storico-dice-cosa-si-vedeva: arricchimento col
      // soggetto dell'ultimo giorno in un try/catch proprio, separato dalla
      // scansione sopra — un errore qui non deve mai degradare l'elenco già
      // costruito, solo lasciarlo senza soggetto (mai un 500, mai una card vuota).
      if (storici) {
        try {
          storici = await Promise.all(
            storici.map(async (voce) => {
              const { conceptNome, elementNome } = await cartaDiIdentita(env, voce.id, voce.ultima);
              return { ...voce, conceptNome, elementNome };
            })
          );
        } catch (err) {
          console.error(`[archivi] soggetto non disponibile: ${err.message}`);
        }
      }
      return new Response(renderArchiviPage(storici), {
        headers: {
          "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600",
          ...SECURITY_HEADERS,
        },
      });
    }

    // ---- Landing page ----
    if (path === "/" || path === "/index.html") {
      const metas = {};
      await Promise.all(
        ACTIVE_CHANNELS.map(async (c) => {
          metas[c.id] = await getMeta(env, c.id);
        })
      );
      // Link per-giorno (?c=<canale>&d=<data>, feat-condividi-il-giorno-che-
      // stai-guardando ciclo 48): se validi, l'anteprima social segue quel
      // giorno invece del wallpaper di oggi. Validazione restrittiva — ogni
      // condizione che cade riporta a `condiviso = null`, mai un og:image
      // verso una rotta che non esiste.
      const oggi = todayKey();
      const condiviso = risolviCondiviso(url, oggi);
      return new Response(renderPage(metas, url.origin, oggi, condiviso), {
        headers: {
          "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300",
          ...SECURITY_HEADERS,
        },
      });
    }

    // Percorso HTML sconosciuto (link vecchio, indirizzo digitato male): una
    // pagina umana per il browser, JSON invariato per i client API (contratto
    // esistente, vedi router-errori.test.js).
    if ((request.headers.get("accept") || "").includes("text/html")) {
      return new Response(renderPaginaNonTrovata(), {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
          ...SECURITY_HEADERS,
        },
      });
    }
    return json({ error: "not found" }, 404);

    } catch (err) {
      console.error(`[fetch] ${path} fallito: ${err.message}`);
      return rispostaDiEmergenza(path);
    }
  },
};
