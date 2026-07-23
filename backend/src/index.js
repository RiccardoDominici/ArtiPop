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
import { ACTIVE_CHANNELS, getChannel, resolveChannel, poolFor } from "./channels.js";
import { getConcept } from "./concepts.js";
import {
  evolveStory, buildKeyframePrompt, buildDailyPrompt, buildCumulativePrompt,
  buildRealignPrompt, clausesFor, todayKey,
} from "./story.js";
import { generateImage, generateWithGate, referenceFor } from "./generate.js";
import { getState, putState, putImage, getImage, getMeta, listArchiveDates } from "./storage.js";
import {
  fingerprintFromBytes, fingerprintFromArchive, compare, verdict, classify,
  encodeFingerprint, decodeFingerprint, formatMeasures, diagnose,
} from "./metrics.js";
import { readStage } from "./vision.js";
import { renderPage } from "./page.js";
import { renderHelpPage } from "./help.js";

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

/* ===================== IL GIRO DI UN GIORNO ===================== */

/**
 * Genera l'immagine di un giorno per un flusso, con il cancello di collaudo.
 *
 * `prevBytes` (facoltativo): i byte dell'immagine di ieri, se sono già in
 * memoria — è il caso del backfill, che genera i giorni in sequenza dentro una
 * sola invocazione. Passarli evita di rileggere da KV, che è eventualmente
 * consistente e in passato costringeva ad attese di parecchi secondi.
 */
async function generateDay(env, channel, concept, state, { prevBytes = null, anchorBytes = null, maxAttempts = null } = {}) {
  const label = `${channel.id}/${concept.id} t${state.stage + 1}`;

  /* --- Keyframe: primo giorno dell'arco, generazione pulita --- */
  if (state.dayInArc === 0) {
    const clean = await generateImage(env, buildKeyframePrompt(concept), state.seed);

    // Riallineamento: il keyframe nasce da testo puro, mentre tutti i giorni
    // successivi nascono da un editing. Senza questo passaggio il giorno 1
    // dell'arco risulta visibilmente "di un'altra famiglia" rispetto ai suoi
    // seguiti. Si rigenera partendo da se stesso, e si tiene il risultato SOLO
    // se le misure dicono che non ha perso nulla per strada.
    const selfRef = await referenceFor(env, channel.id, state.lastDate, clean.bytes);
    if (selfRef) {
      try {
        const aligned = await generateImage(env, buildRealignPrompt(concept), state.seed, [selfRef]);
        if (aligned.usedReference) {
          const [fa, fb] = await Promise.all([
            fingerprintFromBytes(env, clean.bytes),
            fingerprintFromBytes(env, aligned.bytes),
          ]);
          if (fa && fb) {
            const m = compare(fa, fb);
            // Il riallineamento deve essere un ritocco, non una reinvenzione.
            if (m.estensione < 45 && m.degrado < 10) {
              console.log(`[gen] ${label}: keyframe riallineato (${formatMeasures(m)})`);
              return { ...aligned, impronta: fb, misure: null, verdetto: null, tentativi: 2, ancora: true };
            }
            console.warn(`[gen] ${label}: riallineamento scartato, ha cambiato troppo (${formatMeasures(m)})`);
          } else {
            return { ...aligned, impronta: null, misure: null, verdetto: null, tentativi: 2, ancora: true };
          }
        }
      } catch (err) {
        console.warn(`[gen] ${label}: riallineamento fallito (${err.message}), tengo l'originale`);
      }
    }
    const impronta = await fingerprintFromBytes(env, clean.bytes);
    return { ...clean, impronta, misure: null, verdetto: null, tentativi: 1, ancora: true };
  }

  /* --- Giorno normale: image 0 = ieri, image 1 = keyframe dell'arco --- */
  const [refIeri, refAncora] = await Promise.all([
    state.prevDate ? referenceFor(env, channel.id, state.prevDate, prevBytes) : null,
    state.anchorDate && state.anchorDate !== state.prevDate
      ? referenceFor(env, channel.id, state.anchorDate, anchorBytes)
      : null,
  ]);

  // L'impronta di ieri: di norma è già nello stato (l'abbiamo salvata ieri), e
  // in quel caso il confronto non costa niente. Se manca, si ricalcola.
  let prevFingerprint = decodeFingerprint(state.improntaPrec);
  if (!prevFingerprint && state.prevDate) {
    prevFingerprint = prevBytes
      ? await fingerprintFromBytes(env, prevBytes)
      : await fingerprintFromArchive(env, channel.id, state.prevDate);
  }

  if (!refIeri && !refAncora) {
    console.warn(`[gen] ${label}: nessun riferimento disponibile, genero da zero`);
    const img = await generateImage(env, buildKeyframePrompt(concept), state.seed);
    const impronta = await fingerprintFromBytes(env, img.bytes);
    return { ...img, impronta, misure: null, verdetto: null, tentativi: 1 };
  }

  if (!refIeri) {
    // Ieri non recuperabile: si riparte dal keyframe e si descrive lo stato
    // cumulativo raggiunto. Niente cancello: il confronto non avrebbe senso.
    console.warn(`[gen] ${label}: ieri non disponibile, uso lo stato cumulativo dall'àncora`);
    const img = await generateImage(env, buildCumulativePrompt(concept, state.stage), state.seed, [refAncora]);
    const impronta = await fingerprintFromBytes(env, img.bytes);
    return { ...img, impronta, misure: null, verdetto: null, tentativi: 1 };
  }

  const refs = [refIeri, refAncora].filter(Boolean);
  return generateWithGate(env, {
    label,
    seed: state.seed + state.dayInArc * 101,
    refs,
    profile: concept.profilo,
    prevFingerprint,
    maxAttempts,
    doseIniziale: state.dosePartenza ?? 0,
    // Riferimenti per la misura di DIREZIONE: quanto la scena si e' allontanata
    // dal keyframe, e se rispetto a ieri e' avanzata o arretrata.
    anchorFingerprint: decodeFingerprint(state.improntaAncora),
    occupazionePrec: typeof state.occupazione === "number" ? state.occupazione : null,
    promptForDose: (dose) =>
      buildDailyPrompt(concept, clausesFor(concept, state.stage, dose, state.extraIndex), refs.length > 1),
  });
}

/**
 * Genera (se serve) l'immagine di oggi per un flusso.
 * Idempotente: se l'immagine di oggi esiste già e non è richiesto `force`, esce.
 */
async function runChannel(env, channelId, { force = false } = {}) {
  const channel = getChannel(channelId);
  if (!channel) throw new Error(`flusso sconosciuto: ${channelId}`);
  if (!channel.active) throw new Error(`flusso in pausa: ${channelId}`);

  const date = todayKey();
  const prevState = await getState(env, channelId);

  if (!force && prevState?.lastDate === date) {
    console.log(`[run] ${channelId}: già generato per ${date}, salto`);
    return { channel: channelId, date, skipped: true };
  }

  // 1. Com'e' andato ieri? Lo dicono le misure salvate ieri stesso, confrontate
  //    col profilo del concept: "ok", "poco" (tappa non saldata), "troppo" (il
  //    modello e' corso avanti). E' il segnale con cui il piano si corregge.
  const conceptPrec = prevState?.conceptId ? getConcept(prevState.conceptId) : null;
  const esito = conceptPrec ? classify(prevState?.misure, conceptPrec.profilo) : null;

  // 2. La storia avanza di un giorno, tenendo conto dell'esito.
  const state = evolveStory(channel, prevState, date, esito);
  const concept = getConcept(state.conceptId);
  state.improntaPrec = prevState?.impronta ?? null;

  console.log(
    `[run] ${channelId} ${date}: concept "${concept.id}" arco ${state.arcIndex} ` +
    `giorno ${state.dayInArc} tappa ${state.stage + 1}/${concept.tappe.length} — "${state.scene}"`
  );

  // 3. Generazione con collaudo.
  const img = await generateDay(env, channel, concept, state);

  // 4. Persistenza: immagine, metadati, stato (con l'impronta per domani).
  await putImage(env, channelId, img, {
    date,
    scene: state.scene,
    conceptId: concept.id,
    conceptNome: concept.nome,
    famiglia: concept.famiglia.id,
    arcIndex: state.arcIndex,
    dayInArc: state.dayInArc,
    stage: state.stage,
    misure: img.misure,
    tentativi: img.tentativi,
  });

  const { improntaPrec, ...statoDaSalvare } = state;
  await putState(env, channelId, {
    ...statoDaSalvare,
    impronta: img.impronta ? encodeFingerprint(img.impronta) : null,
    // L'impronta del keyframe resta per tutto l'arco: e' il metro con cui si
    // misura se la storia sta andando avanti o indietro.
    improntaAncora: img.ancora && img.impronta
      ? encodeFingerprint(img.impronta)
      : (state.improntaAncora ?? null),
    occupazione: img.ancora ? 0 : (img.misure?.occupazione ?? state.occupazione ?? 0),
    misure: img.misure ?? null,
  });

  return {
    channel: channelId,
    date,
    concept: concept.id,
    famiglia: concept.famiglia.id,
    scene: state.scene,
    arc: `${state.arcIndex}/${state.dayInArc}`,
    tappa: `${state.stage + 1}/${concept.tappe.length}`,
    ieri: esito,
    model: img.model,
    tentativi: img.tentativi,
    collaudo: img.verdetto ? (img.verdetto.ok ? "passato" : "ripiego: " + img.verdetto.motivi.join("; ")) : "non applicabile",
    misure: img.misure ? formatMeasures(img.misure) : null,
    size: `${img.width}x${img.height}`,
    bytes: img.bytes.length,
  };
}

/**
 * Backfill: simula `days` giorni consecutivi di storia fino a oggi.
 * Riparte da zero (stato azzerato). I byte di ogni giorno restano in memoria e
 * fanno da riferimento per il giorno dopo: nessun giro da KV, nessuna attesa di
 * propagazione.
 */
async function backfillChannel(env, channelId, days, { conGate = true } = {}) {
  const channel = getChannel(channelId);
  if (!channel) throw new Error(`flusso sconosciuto: ${channelId}`);
  if (!channel.active) throw new Error(`flusso in pausa: ${channelId}`);

  let state = null;
  let prevBytes = null;
  let anchorBytes = null;
  let prevFingerprint = null;
  const results = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = todayKey(new Date(Date.now() - i * 86400000));
    // Anche qui l'anello si chiude: l'esito del giorno appena generato decide
    // la tappa del successivo, esattamente come farebbe il cron.
    const conceptPrec = state?.conceptId ? getConcept(state.conceptId) : null;
    const esito = conceptPrec ? classify(state?.misure, conceptPrec.profilo) : null;
    state = evolveStory(channel, state, date, esito);
    const concept = getConcept(state.conceptId);
    state.improntaPrec = prevFingerprint ? encodeFingerprint(prevFingerprint) : null;

    if (state.dayInArc === 0) anchorBytes = null; // arco nuovo: l'àncora sarà questa immagine

    // `gate=0` fa una sola generazione per giorno: sette giorni con tre
    // tentativi ciascuno possono superare i limiti di durata di una richiesta.
    const img = await generateDay(env, channel, concept, state, {
      prevBytes, anchorBytes, maxAttempts: conGate ? null : 1,
    });

    await putImage(env, channelId, img, {
      date,
      scene: state.scene,
      conceptId: concept.id,
      conceptNome: concept.nome,
      famiglia: concept.famiglia.id,
      arcIndex: state.arcIndex,
      dayInArc: state.dayInArc,
      stage: state.stage,
      misure: img.misure,
      tentativi: img.tentativi,
    }, { archiveOnly: i > 0 });

    console.log(
      `[backfill] ${channelId} ${date} (${concept.id} t${state.stage + 1}): ` +
      `${img.model}, ${img.tentativi} tentativi${img.misure ? ", " + formatMeasures(img.misure) : ""}`
    );

    results.push({
      date,
      concept: concept.id,
      tappa: state.stage + 1,
      scene: state.scene,
      model: img.model,
      tentativi: img.tentativi,
      misure: img.misure ? formatMeasures(img.misure) : null,
    });

    prevBytes = img.bytes;
    prevFingerprint = img.impronta ?? null;
    state.misure = img.misure ?? null;
    if (img.ancora && img.impronta) {
      state.improntaAncora = encodeFingerprint(img.impronta);
      state.occupazione = 0;
    } else if (typeof img.misure?.occupazione === "number") {
      state.occupazione = img.misure.occupazione;
    }
    if (state.dayInArc === 0) anchorBytes = img.bytes;
  }

  const { improntaPrec, ...statoDaSalvare } = state;
  await putState(env, channelId, {
    ...statoDaSalvare,
    impronta: prevFingerprint ? encodeFingerprint(prevFingerprint) : null,
  });
  return results;
}

/** Fan-out: una richiesta interna per flusso (parallela) tramite il binding SELF. */
async function fanOutAll(env, { force = false } = {}) {
  const results = await Promise.allSettled(
    ACTIVE_CHANNELS.map((ch) =>
      env.SELF.fetch(`https://artipop.internal/run/${ch.id}${force ? "?force=1" : ""}`, {
        headers: { "x-artipop-key": env.ADMIN_KEY || "" },
      }).then(async (r) => ({ status: r.status, body: await r.json() }))
    )
  );
  return ACTIVE_CHANNELS.map((ch, i) => {
    const r = results[i];
    return r.status === "fulfilled"
      ? { channel: ch.id, ...r.value }
      : { channel: ch.id, error: String(r.reason) };
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
      const metas = await Promise.all(ACTIVE_CHANNELS.map((c) => getMeta(env, c.id)));
      return json({
        channels: ACTIVE_CHANNELS.map((c, i) => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          accent: c.accent,
          tagline: c.tagline,
          taglineEn: c.taglineEn,
          famiglie: c.famiglie,
          concepts: poolFor(c).length,
          url: `${url.origin}/w/${c.id}`,
          today: metas[i],
        })),
      });
    }

    // ---- API archivio: date disponibili per un flusso ----
    const archMatch = path.match(/^\/api\/archive\/([a-z]+)$/);
    if (archMatch) {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 365);
      const dates = await listArchiveDates(env, archMatch[1], limit);
      return json({ channel: archMatch[1], dates });
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
    // quel giorno e rigenera solo quell'immagine.
    if (path === "/regen-day") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "";
      const date = url.searchParams.get("date") || "";
      const channel = getChannel(ch);
      if (!channel || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "servono ?ch= e ?date=" }, 400);

      const state = await getState(env, ch);
      const concept = state?.conceptId ? getConcept(state.conceptId) : null;
      if (!state?.anchorDate || !concept) {
        return json({ error: "stato non compatibile (serve un flusso già attivo)" }, 400);
      }
      const dayInArc =
        Math.floor(Date.parse(date + "T00:00:00Z") / 86400000) -
        Math.floor(Date.parse(state.anchorDate + "T00:00:00Z") / 86400000);
      if (dayInArc < 0 || dayInArc >= concept.tappe.length) {
        return json({ error: `data fuori dall'arco corrente (àncora ${state.anchorDate})` }, 400);
      }
      const prevDate = todayKey(new Date(Date.parse(date + "T12:00:00Z") - 86400000));
      const dayState = {
        ...state,
        dayInArc,
        stage: dayInArc,
        extraIndex: null,
        lastDate: date,
        prevDate: dayInArc > 0 ? prevDate : null,
        improntaPrec: null,
        scene: clausesFor(concept, dayInArc, 0, null).join(". "),
      };
      try {
        const img = await generateDay(env, channel, concept, dayState);
        await putImage(env, ch, img, {
          date,
          scene: dayState.scene,
          conceptId: concept.id,
          conceptNome: concept.nome,
          famiglia: concept.famiglia.id,
          arcIndex: state.arcIndex,
          dayInArc,
          stage: dayInArc,
          misure: img.misure,
          tentativi: img.tentativi,
        }, { archiveOnly: date !== state.lastDate });
        return json({
          channel: ch, date, dayInArc, model: img.model, tentativi: img.tentativi,
          misure: img.misure ? formatMeasures(img.misure) : null,
        });
      } catch (err) {
        return json({ error: err.message }, 500);
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
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "natura";
      const a = url.searchParams.get("a");
      const b = url.searchParams.get("b");
      if (!a || !b) return json({ error: "servono ?a= e ?b= (due date YYYY-MM-DD)" }, 400);
      const t0 = Date.now();
      const [fa, fb] = await Promise.all([
        fingerprintFromArchive(env, ch, a),
        fingerprintFromArchive(env, ch, b),
      ]);
      if (!fa || !fb) {
        return json({ ok: false, bindingPresente: Boolean(env.IMAGES), diagnosi: await diagnose(env, ch, a) }, 502);
      }
      const m = compare(fa, fb);
      // Se si indica anche ?concept= si vede il verdetto che avrebbe dato il cancello.
      const conceptId = url.searchParams.get("concept");
      const concept = conceptId ? getConcept(conceptId) : null;
      return json({
        ok: true, ch, a, b, ms: Date.now() - t0,
        misure: m, riga: formatMeasures(m),
        verdetto: concept ? verdict(m, concept.profilo) : null,
      });
    }

    // ---- Sonda del lettore di immagini (admin): /test-vision?ch=X&date=D ----
    if (path === "/test-vision") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "";
      const date = url.searchParams.get("date") || "";
      const conceptId = url.searchParams.get("concept");
      const concept = conceptId ? getConcept(conceptId) : getConcept((await getState(env, ch))?.conceptId);
      if (!concept) return json({ error: "servono ?concept= oppure un flusso già attivo" }, 400);
      const ref = await referenceFor(env, ch, date || null);
      if (!ref) return json({ error: "immagine non recuperabile" }, 404);
      const t0 = Date.now();
      const traccia = [];
      const stage = await readStage(env, concept, ref, traccia);
      return json({
        ch, date, concept: concept.id, ms: Date.now() - t0,
        tappaLetta: stage === null ? null : stage + 1,
        traccia,
        tappe: concept.tappe.map((f, i) => `${i + 1}. ${f.join(", ")}`),
      });
    }

    // ---- Sonda domanda libera al lettore (admin): /test-ask?ch=X&date=D&q=... ----
    // Serve a capire QUALE forma di domanda regge il modello di visione: la
    // scelta fra 7 alternative si è rivelata inaffidabile, una domanda binaria
    // potrebbe non esserlo.
    if (path === "/test-ask") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "";
      const date = url.searchParams.get("date") || "";
      const q = url.searchParams.get("q") || "";
      if (!q) return json({ error: "serve ?q=" }, 400);
      const ref = await referenceFor(env, ch, date || null);
      if (!ref) return json({ error: "immagine non recuperabile" }, 404);
      const out = [];
      for (const model of CONFIG.VISION_MODELS) {
        const t0 = Date.now();
        try {
          const res = await env.AI.run(model, { prompt: q, image: Array.from(ref), max_tokens: 24 });
          out.push({ model, ms: Date.now() - t0, risposta: res?.response });
        } catch (err) {
          out.push({ model, errore: String(err.message).slice(0, 200) });
        }
      }
      return json({ ch, date, q, risposte: out });
    }

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
      return json({
        ok: true,
        flussi: ACTIVE_CHANNELS.map((c) => ({
          id: c.id, famiglie: c.famiglie, concepts: poolFor(c).length,
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
