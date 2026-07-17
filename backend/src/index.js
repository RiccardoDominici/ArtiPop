// ArtiPop v3 — Worker Cloudflare.
//
// Due responsabilità:
//   1. `scheduled` (cron giornaliero): per ogni canale, fa una richiesta interna a
//      /run/<canale> tramite il binding SELF, così ogni canale gira in una invocazione
//      separata (budget CPU indipendente sul piano free) e in parallelo.
//   2. `fetch` (HTTP): serve le immagini (/w/<canale>), la landing page (/),
//      l'API JSON (/api/channels) e gli endpoint di generazione protetti (/run/...).
//
// Robustezza: se la generazione di un canale fallisce, l'immagine precedente resta
// al suo posto — la Shortcut degli utenti non si rompe mai.

import { ACTIVE_CHANNELS, getChannel } from "./channels.js";
import { evolveStory, buildImagePrompt, buildEditPrompt, buildProgressPrompt, buildCumulativePrompt, todayKey } from "./story.js";
import { generateImage, fetchReferenceImage } from "./generate.js";
import { getState, putState, putImage, getImage, getMeta, listArchiveDates } from "./storage.js";
import { renderPage } from "./page.js";

/** Confronto sicuro della chiave admin (query ?key= oppure header x-artipop-key). */
function isAuthorized(request, env) {
  if (!env.ADMIN_KEY) return false; // senza secret configurato, gli endpoint admin sono chiusi
  const url = new URL(request.url);
  const provided = request.headers.get("x-artipop-key") || url.searchParams.get("key") || "";
  return provided === env.ADMIN_KEY;
}

/**
 * Genera (se serve) l'immagine di oggi per un canale.
 * Idempotente: se l'immagine di oggi esiste già e non è richiesto `force`, non fa nulla.
 */
async function runChannel(env, channelId, { force = false } = {}) {
  const channel = getChannel(channelId);
  if (!channel) throw new Error(`canale sconosciuto: ${channelId}`);
  if (!channel.active) throw new Error(`canale in pausa: ${channelId}`);

  const date = todayKey();
  const prevState = await getState(env, channelId);

  if (!force && prevState?.lastDate === date) {
    console.log(`[run] ${channelId}: già generato per ${date}, salto`);
    return { channel: channelId, date, skipped: true };
  }

  // 1. La storia avanza di un giorno (LLM con fallback deterministico).
  const state = await evolveStory(env, channel, prevState, date);
  console.log(`[run] ${channelId} ${date}: arco ${state.arcIndex} giorno ${state.dayInArc} — "${state.scene}"`);

  // 2-3. Generazione con continuità (vedi generateDay).
  if (!state.prevDate && prevState?.lastDate && prevState.lastDate !== date) {
    state.prevDate = prevState.lastDate;
  }
  const img = await generateDay(env, channel, channelId, state, date);

  // 4. Persistenza: immagine + metadati + stato narrativo.
  await putImage(env, channelId, img, {
    date,
    scene: state.scene,
    arcTheme: state.arcTheme,
    arcIndex: state.arcIndex,
    dayInArc: state.dayInArc,
  });
  await putState(env, channelId, state);

  return {
    channel: channelId,
    date,
    scene: state.scene,
    arc: `${state.arcIndex}/${state.dayInArc}`,
    model: img.model,
    continuity: img.usedReference ? "ref-ieri" : "keyframe",
    size: `${img.width}x${img.height}`,
    bytes: img.bytes.length,
  };
}

/**
 * Backfill: simula `days` giorni consecutivi di storia FINO A OGGI, come se il
 * canale girasse da una settimana. Riparte da zero (stato azzerato): giorno 1 =
 * oggi-(days-1) con la firstScene, poi un'evoluzione al giorno; ogni immagine
 * viene archiviata sotto la sua data passata e l'ultima diventa il "latest".
 * Un'invocazione per canale (LLM+klein+KV ≈ 6 subrequest/giorno, cap free 50).
 */
async function backfillChannel(env, channelId, days) {
  const channel = getChannel(channelId);
  if (!channel) throw new Error(`canale sconosciuto: ${channelId}`);
  if (!channel.active) throw new Error(`canale in pausa: ${channelId}`);

  let state = null; // reset: la storia riparte dal capitolo 1
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = todayKey(new Date(Date.now() - i * 86400000));
    state = await evolveStory(env, channel, state, date);

    // Generazione con continuità "anchor, don't chain" (vedi generateDay);
    // più tentativi sul resize: l'àncora è stata scritta pochi secondi fa.
    const img = await generateDay(env, channel, channelId, state, date, 3);

    // Giorni intermedi: solo archivio. L'ultimo giorno scrive anche latest+meta.
    await putImage(env, channelId, img, {
      date,
      scene: state.scene,
      arcTheme: state.arcTheme,
      arcIndex: state.arcIndex,
      dayInArc: state.dayInArc,
    }, { archiveOnly: i > 0 });

    console.log(`[backfill] ${channelId} ${date}: "${state.scene}" (${img.model}${img.usedReference ? ", ref" : ""})`);
    results.push({
      date,
      scene: state.scene,
      model: img.model,
      continuity: img.usedReference ? "ref-ieri" : "keyframe",
      size: `${img.width}x${img.height}`,
    });
  }
  await putState(env, channelId, state); // una sola scrittura di stato, alla fine
  return results;
}


/**
 * Genera l'immagine di un giorno secondo la strategia "anchor, don't chain":
 *  - giorni normali: edit del keyframe dell'arco (immagine pulita, mai catene);
 *  - keyframe (dayInArc 0): generazione pulita seguita da un AUTO-EDIT ("stesso
 *    luogo, stesso momento") che riallinea il keyframe alla famiglia visiva
 *    prodotta dagli edit — senza, il giorno 0 risulterebbe visivamente diverso
 *    dai giorni 1..N che lo usano come riferimento.
 * `retries`: tentativi del resize esterno (di più nel backfill, dove l'àncora
 * è stata scritta pochi secondi fa e deve propagarsi in KV).
 */
async function generateDay(env, channel, channelId, state, date, retries = 2) {
  const refUrl = (d) => `${env.PUBLIC_ORIGIN}/w/${channelId}?date=${d}`;

  // --- Canali a PROGRESSIONE: edit additivo (ieri + àncora di stile) ---
  if (channel.mode === "progression" && state.dayInArc > 0) {
    const [refYesterday, refAnchor] = await Promise.all([
      state.prevDate ? fetchReferenceImage(env, refUrl(state.prevDate), retries) : null,
      state.anchorDate && state.anchorDate !== state.prevDate
        ? fetchReferenceImage(env, refUrl(state.anchorDate), retries)
        : null,
    ]);
    if (refYesterday) {
      // image 0 = ieri (contenuto da preservare + aggiunta di oggi),
      // image 1 = keyframe (àncora di qualità/stile, anti-drift multi-reference).
      const prompt = buildProgressPrompt(channel, state.scene);
      return generateImage(env, prompt, state.seed, [refYesterday, refAnchor]);
    }
    if (refAnchor) {
      // Ieri non recuperabile: si mostra lo stato cumulativo partendo dall'àncora.
      console.warn(`[gen] ${channelId}: ieri non disponibile, uso solo l'àncora`);
      const prompt = buildCumulativePrompt(channel, state.scene, state.dayInArc);
      return generateImage(env, prompt, state.seed, [refAnchor]);
    }
    console.warn(`[gen] ${channelId}: nessun riferimento disponibile, genero da zero`);
    return generateImage(env, buildImagePrompt(channel, state.scene), state.seed);
  }

  // --- Canali "viaggio": edit dell'àncora dell'arco ---
  if (state.dayInArc > 0 && state.anchorDate && state.anchorDate !== date) {
    const refBytes = await fetchReferenceImage(env, refUrl(state.anchorDate), retries);
    if (!refBytes) console.warn(`[gen] ${channelId}: àncora non scaricabile, genero senza`);
    const prompt = refBytes
      ? buildEditPrompt(channel, state.scene, state.dayInArc)
      : buildImagePrompt(channel, state.scene);
    return generateImage(env, prompt, state.seed, refBytes ? [refBytes] : []);
  }

  // --- Keyframe: generazione pulita + auto-edit di riallineamento ---
  const clean = await generateImage(env, buildImagePrompt(channel, state.scene), state.seed);
  // Pubblica provvisoriamente il keyframe in archivio: serve solo da sorgente
  // per il resizer esterno (il Worker non può ridimensionare in locale).
  await putImage(env, channelId, clean, {
    date, scene: state.scene, arcTheme: state.arcTheme,
    arcIndex: state.arcIndex, dayInArc: state.dayInArc,
  }, { archiveOnly: true });
  const selfRef = await fetchReferenceImage(env, refUrl(date), 3);
  if (selfRef) {
    try {
      const aligned = await generateImage(
        env, buildEditPrompt(channel, state.scene, 0), state.seed, [selfRef]
      );
      if (aligned.usedReference) {
        console.log(`[gen] ${channelId}: keyframe riallineato alla famiglia degli edit`);
        return aligned;
      }
    } catch (err) {
      console.warn(`[gen] ${channelId}: auto-edit keyframe fallito (${err.message}), tengo l'originale`);
    }
  }
  return clean;
}

/** Fan-out: una richiesta interna per canale (parallela) tramite il binding SELF. */
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

/** Risposta JSON con status. */
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  /** Cron giornaliero: genera tutti i canali. */
  async scheduled(event, env, ctx) {
    console.log(`[cron] avvio generazione giornaliera (${new Date().toISOString()})`);
    ctx.waitUntil(
      fanOutAll(env).then((results) => {
        console.log(`[cron] completato: ${JSON.stringify(results)}`);
      })
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- Immagine del giorno: /w/<canale> (accetta anche .jpg/.png in coda) ----
    const wMatch = path.match(/^\/w\/([a-z]+)(?:\.(?:jpg|jpeg|png))?$/);
    if (wMatch) {
      const chId = wMatch[1];

      // Canale "random": ogni giorno un canale diverso, deterministico per data.
      let target = chId;
      if (chId === "random") {
        const day = Math.floor(Date.parse(todayKey()) / 86400000);
        target = ACTIVE_CHANNELS[day % ACTIVE_CHANNELS.length].id;
      }

      if (!getChannel(target)) {
        return json({ error: "canale sconosciuto", channels: ACTIVE_CHANNELS.map((c) => c.id).concat("random") }, 404);
      }

      // ?date=YYYY-MM-DD → una data specifica dall'archivio permanente.
      const dateParam = url.searchParams.get("date");
      const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

      const img = await getImage(env, target, date);
      if (!img) return json({ error: "immagine non ancora generata, riprova tra poco" }, 404);

      return new Response(img.stream, {
        headers: {
          "content-type": img.meta.contentType || "image/png",
          // latest: mai in cache (la Shortcut vuole sempre il più recente);
          // archivio per data: immutabile, cache lunga.
          "cache-control": date ? "public, max-age=604800, immutable" : "no-store, must-revalidate",
          "x-artipop-date": img.meta.date || "",
          "x-artipop-model": img.meta.model || "",
        },
      });
    }

    // ---- API JSON: stato di tutti i canali ----
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
          url: `${url.origin}/w/${c.id}`,
          today: metas[i],
        })),
      });
    }

    // ---- API archivio: date disponibili per un canale (più recente per prima) ----
    const archMatch = path.match(/^\/api\/archive\/([a-z]+)$/);
    if (archMatch) {
      if (!getChannel(archMatch[1])) return json({ error: "canale sconosciuto" }, 404);
      const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 365);
      const dates = await listArchiveDates(env, archMatch[1], limit);
      return json(
        { channel: archMatch[1], dates },
        200
      );
    }

    // ---- Generazione manuale/interna di un canale: /run/<canale>?[force=1] ----
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
        return json({ error: err.message }, 500);
      }
    }

    // ---- Backfill storico (admin): /backfill?ch=<canale>&days=7 ----
    if (path === "/backfill") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "";
      const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 2), 7);
      try {
        const results = await backfillChannel(env, ch, days);
        return json({ channel: ch, days, results });
      } catch (err) {
        console.error(`[backfill] ${ch} fallito: ${err.message}`);
        return json({ error: err.message }, 500);
      }
    }

    // ---- Rigenerazione chirurgica di UN giorno: /regen-day?ch=X&date=YYYY-MM-DD ----
    // Utile quando un singolo frame esce male (la generazione non è
    // perfettamente deterministica): ricostruisce lo stato di quel giorno dal
    // piano salvato e rigenera solo quell'immagine, senza toccare il resto.
    if (path === "/regen-day") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "";
      const date = url.searchParams.get("date") || "";
      const channel = getChannel(ch);
      if (!channel || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "servono ?ch= e ?date=" }, 400);
      const state = await getState(env, ch);
      if (!state?.anchorDate || !Array.isArray(state.plan)) {
        return json({ error: "stato non compatibile (serve un canale a progressione già attivo)" }, 400);
      }
      const dayInArc =
        Math.floor(Date.parse(date + "T00:00:00Z") / 86400000) -
        Math.floor(Date.parse(state.anchorDate + "T00:00:00Z") / 86400000);
      if (dayInArc < 0 || dayInArc >= state.plan.length) {
        return json({ error: `data fuori dall'arco corrente (àncora ${state.anchorDate})` }, 400);
      }
      const prevDate = todayKey(new Date(Date.parse(date + "T12:00:00Z") - 86400000));
      const dayState = {
        ...state,
        dayInArc,
        prevDate: dayInArc > 0 ? prevDate : null,
        scene: dayInArc === 0
          ? `${channel.setting}, ${state.plan[0]}`
          : state.plan[Math.min(dayInArc, state.plan.length - 1)],
      };
      try {
        const img = await generateDay(env, channel, ch, dayState, date, 3);
        await putImage(env, ch, img, {
          date,
          scene: dayState.scene,
          arcTheme: state.arcTheme,
          arcIndex: state.arcIndex,
          dayInArc,
        }, { archiveOnly: date !== state.lastDate });
        return json({ channel: ch, date, dayInArc, model: img.model, size: `${img.width}x${img.height}` });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ---- Generazione manuale di tutti i canali: /run-all?[force=1] ----
    if (path === "/run-all") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const results = await fanOutAll(env, { force: url.searchParams.get("force") === "1" });
      return json(results);
    }

    // ---- Probe editing (admin): /test-edit?ch=X&date=YYYY-MM-DD&scene=... ----
    // Genera UN'immagine con riferimento a quella archiviata alla data indicata
    // e la ritorna direttamente (per valutare a occhio la continuità).
    if (path === "/test-edit") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const ch = url.searchParams.get("ch") || "horizon";
      const refDate = url.searchParams.get("date");
      const scene = url.searchParams.get("scene") || "the same place, one day later, slightly warmer light";
      const channel = getChannel(ch);
      if (!channel || !refDate) return json({ error: "servono ?ch= e ?date=" }, 400);
      const refBytes = await fetchReferenceImage(
        env, `${env.PUBLIC_ORIGIN}/w/${ch}?date=${refDate}`, 2
      );
      if (!refBytes) return json({ error: "riferimento non scaricabile" }, 502);
      const img = await generateImage(env, buildEditPrompt(channel, scene), 42, [refBytes]);
      return new Response(img.bytes, {
        headers: {
          "content-type": img.contentType,
          "x-artipop-continuity": img.usedReference ? "ref" : "no-ref",
          "cache-control": "no-store",
        },
      });
    }

    // ---- Probe risoluzione (admin): /test-size?w=1152&h=2496 ----
    // Verifica se il modello primario accetta una data risoluzione, senza toccare KV.
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
    if (path === "/health") return json({ ok: true, activeChannels: ACTIVE_CHANNELS.map((c) => c.id) });

    // ---- Landing page ----
    if (path === "/" || path === "/index.html") {
      const metas = {};
      await Promise.all(
        ACTIVE_CHANNELS.map(async (c) => {
          metas[c.id] = await getMeta(env, c.id);
        })
      );
      return new Response(renderPage(metas, url.origin, todayKey()), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300", // la pagina può stare in cache 5 minuti
        },
      });
    }

    return json({ error: "not found" }, 404);
  },
};
