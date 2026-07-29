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

import { CONFIG } from "./config.js";
import { ACTIVE_CHANNELS, CHANNELS, resolveChannel, LEGACY_ALIASES } from "./channels.js";
import {
  buildKeyframePrompt, buildDailyPrompt, buildCumulativePrompt,
  buildRealignPrompt, todayKey,
} from "./story.js";
import {
  getImage, getMeta, listChannelsWithArchive,
} from "./storage.js";
import {
  fingerprintFromBytes, fingerprintFromArchive, compare, verdict,
  decodeFingerprint, formatMeasures, diagnose,
} from "./metrics.js";
import { effectiveProfiles, saveTuning, clearTuning, defaultProfiles } from "./profiles.js";
import { runLabArc, getLabImage } from "./lab.js";
import { ELEMENTS, combine } from "./concepts.js";
import { FAMILIES } from "./families.js";
// Il catalogo (concept/element aggiunti dall'utente, vedi catalog.js): si
// carica UNA volta per richiesta e si passa in giro, invece di rileggere KV
// a ogni chiamata a resolveConcept/poolForWith dentro lo stesso giro.
import {
  loadCatalog, saveConcept, saveElement, removeConcept, removeElement,
  resolveConcept, poolForWith,
} from "./catalog.js";
import { loadNote, putGiornoNota, putAssetto, removeAssetto } from "./note.js";
import { renderPage } from "./page.js";
import { renderHelpPage } from "./help.js";
// L'orchestrazione di un giorno di produzione (runChannel, backfillChannel,
// fanOutAll, regenDay, la ricostruzione storica dell'archivio) vive qui:
// index.js resta il router, handlers.js sa come si genera un giorno. Vedi la
// testa di handlers.js per il perché della separazione.
import {
  runChannel, backfillChannel, fanOutAll, regenDay, archivioCanale,
} from "./handlers.js";

/** Confronto della chiave admin (query ?key= oppure header x-artipop-key). */
function isAuthorized(request, env) {
  if (!env.ADMIN_KEY) return false; // senza secret configurato, gli admin sono chiusi
  const url = new URL(request.url);
  const provided = request.headers.get("x-artipop-key") || url.searchParams.get("key") || "";
  return provided === env.ADMIN_KEY;
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
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ error: "JSON non valido nel corpo della richiesta" }, 400); }
        const catalog = await loadCatalog(env);
        const res = await saveTuning(env, body, catalog);
        return jsonCors(res, res.ok ? 200 : 400);
      }
      if (request.method === "DELETE") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        await clearTuning(env);
        return jsonCors({ ok: true, cleared: true });
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
        })),
        ...Object.values(catalog.concepts).map((c) => ({ ...c, custom: true })),
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
        })),
        ...Object.values(catalog.elements).map((e) => ({ ...e, custom: true })),
      ];

      return jsonCors({ concepts, elements });
    }

    if (path === "/catalogo/concept") {
      if (request.method === "PUT" || request.method === "POST") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ ok: false, id: null, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
        const res = await saveConcept(env, body);
        return jsonCors(res, res.ok ? 200 : 400);
      }
      if (request.method === "DELETE") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        const res = await removeConcept(env, url.searchParams.get("id") || "");
        return jsonCors(res, res.ok ? 200 : 400);
      }
      return jsonCors({ error: "metodo non ammesso" }, 405);
    }

    if (path === "/catalogo/element") {
      if (request.method === "PUT" || request.method === "POST") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ ok: false, id: null, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
        const res = await saveElement(env, body);
        return jsonCors(res, res.ok ? 200 : 400);
      }
      if (request.method === "DELETE") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        const res = await removeElement(env, url.searchParams.get("id") || "");
        return jsonCors(res, res.ok ? 200 : 400);
      }
      return jsonCors({ error: "metodo non ammesso" }, 405);
    }

    // ---- Note: marcature dei giorni e assetti di tuning salvati (vedi note.js) ----
    // GET    /note              → pubblico: l'intero documento note:marcature
    // PUT    /note/giorno       → segna (o smarca) un giorno buono/scarto (admin)
    // PUT    /note/assetto      → salva un assetto di range con un nome (admin)
    // DELETE /note/assetto?id=X → lo rimuove (admin)
    if (path === "/note") {
      if (request.method !== "GET") return jsonCors({ error: "metodo non ammesso" }, 405);
      return jsonCors(await loadNote(env));
    }

    if (path === "/note/giorno") {
      if (request.method !== "PUT" && request.method !== "POST") return jsonCors({ error: "metodo non ammesso" }, 405);
      if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
      let body;
      try { body = await request.json(); }
      catch { return jsonCors({ ok: false, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
      const res = await putGiornoNota(env, body);
      return jsonCors(res, res.ok ? 200 : 400);
    }

    if (path === "/note/assetto") {
      if (request.method === "PUT" || request.method === "POST") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        let body;
        try { body = await request.json(); }
        catch { return jsonCors({ ok: false, id: null, errori: ["JSON non valido nel corpo della richiesta"] }, 400); }
        const res = await putAssetto(env, body);
        return jsonCors(res, res.ok ? 200 : 400);
      }
      if (request.method === "DELETE") {
        if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
        const res = await removeAssetto(env, url.searchParams.get("id") || "");
        return jsonCors(res, res.ok ? 200 : 400);
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
      if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
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
        console.error(`[lab] ${familyId}+${elementId} fallito: ${err.message}`);
        return jsonCors({ error: err.message, stack: String(err.stack).slice(0, 600) }, 500);
      }
    }

    // ---- Lab: serve un'immagine di prova ----
    const labImgMatch = path === "/lab/img";
    if (labImgMatch) {
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
        return json({
          error: "flusso sconosciuto",
          flussi: ACTIVE_CHANNELS.map((c) => c.id).concat("random"),
        }, 404);
      }

      const dateParam = url.searchParams.get("date");
      const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

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
      if (!img) return json({ error: "immagine non ancora generata, riprova tra poco" }, 404);

      return new Response(img.stream, {
        headers: {
          "content-type": img.meta.contentType || "image/png",
          "cache-control": date ? "public, max-age=604800, immutable" : "no-store, must-revalidate",
          "x-artipop-date": img.meta.date || "",
          "x-artipop-model": img.meta.model || "",
        },
      });
    }

    // ---- Download della Shortcut firmata: /s/<flusso>[-base].shortcut ----
    const sMatch = path.match(/^\/s\/([a-z]+(?:-base)?)\.shortcut$/);
    if (sMatch) {
      const file = await env.KV.get(`shortcut:${sMatch[1]}`, { type: "stream" });
      if (!file) return json({ error: "shortcut non disponibile per questo flusso" }, 404);
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
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      try {
        const result = await runChannel(env, runMatch[1], {
          force: url.searchParams.get("force") === "1",
        });
        return json(result);
      } catch (err) {
        console.error(`[run] ${runMatch[1]} fallito: ${err.message}`);
        return json({ error: err.message, stack: String(err.stack).slice(0, 800) }, 500);
      }
    }

    // ---- Backfill storico (admin): /backfill?ch=<flusso>&days=7[&gate=0] ----
    if (path === "/backfill") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
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
        console.error(`[backfill] ${ch} fallito: ${err.message}`);
        return json({ error: err.message, stack: String(err.stack).slice(0, 800) }, 500);
      }
    }

    // ---- Rigenerazione di UN giorno: /regen-day?ch=X&date=YYYY-MM-DD ----
    // Utile quando un singolo fotogramma esce male: ricostruisce lo stato di
    // quel giorno e rigenera solo quell'immagine. Il corpo vive in
    // handlers.regenDay: qui si estraggono solo i query param e si traduce
    // l'esito (o l'ErroreDominio) in una Response.
    if (path === "/regen-day") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "";
      const date = url.searchParams.get("date") || "";
      try {
        const result = await regenDay(env, { ch, date });
        return json(result);
      } catch (err) {
        // ErroreDominio porta il proprio status (400 per input/stato non
        // valido); un fallimento di generazione resta un Error "semplice" e
        // cade sul 500 di default — senza stack, a differenza di /run e
        // /backfill: qui l'errore è quasi sempre di input, non di sistema.
        return json({ error: err.message }, err.status ?? 500);
      }
    }

    // ---- Generazione manuale di tutti i flussi: /run-all?[force=1] ----
    if (path === "/run-all") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const results = await fanOutAll(env, { force: url.searchParams.get("force") === "1" });
      return json(results);
    }

    // ---- Sonda del misuratore (admin): /test-metrics?ch=X&a=DATA&b=DATA ----
    if (path === "/test-metrics") {
      // jsonCors e non json: lo strumento di tuning chiama questa sonda dalla sua
      // tab Archivio per misurare due giorni gia' pubblicati, e gira da file://.
      if (!isAuthorized(request, env)) return jsonCors({ error: "non autorizzato" }, 403);
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
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const w = Number(url.searchParams.get("w"));
      const h = Number(url.searchParams.get("h"));
      if (!w || !h) return json({ error: "servono ?w= e ?h=" }, 400);
      try {
        const { tryKleinSize } = await import("./generate.js");
        const img = await tryKleinSize(env, "a simple gradient test", { width: w, height: h });
        return json({ ok: true, size: `${w}x${h}`, bytes: img.bytes.length });
      } catch (err) {
        return json({ ok: false, size: `${w}x${h}`, error: err.message });
      }
    }

    // ---- Healthcheck ----
    if (path === "/health") {
      const catalog = await loadCatalog(env);
      return json({
        ok: true,
        flussi: ACTIVE_CHANNELS.map((c) => ({
          id: c.id, famiglie: c.famiglie, concepts: poolForWith(c, catalog).length,
        })),
        misuratore: Boolean(env.IMAGES),
      });
    }

    // ---- Pagina di aiuto ----
    if (path === "/aiuto" || path === "/aiuto.html" || path === "/help") {
      return new Response(renderHelpPage(), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
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
      return new Response(renderPage(metas, url.origin, todayKey()), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
      });
    }

    return json({ error: "not found" }, 404);
  },
};
