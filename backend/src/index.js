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
import { evolveStory, buildImagePrompt, todayKey } from "./story.js";
import { generateImage } from "./generate.js";
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

  // 2. Generazione immagine (catena di fallback interna).
  const prompt = buildImagePrompt(channel, state.scene);
  const img = await generateImage(env, prompt, state.seed);

  // 3. Persistenza: immagine + metadati + stato narrativo.
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
    const prompt = buildImagePrompt(channel, state.scene);
    const img = await generateImage(env, prompt, state.seed);
    await putImage(env, channelId, img, {
      date,
      scene: state.scene,
      arcTheme: state.arcTheme,
      arcIndex: state.arcIndex,
      dayInArc: state.dayInArc,
    });
    await putState(env, channelId, state);
    console.log(`[backfill] ${channelId} ${date}: "${state.scene}" (${img.model})`);
    results.push({ date, scene: state.scene, model: img.model, size: `${img.width}x${img.height}` });
  }
  return results;
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
      const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 2), 14);
      try {
        const results = await backfillChannel(env, ch, days);
        return json({ channel: ch, days, results });
      } catch (err) {
        console.error(`[backfill] ${ch} fallito: ${err.message}`);
        return json({ error: err.message }, 500);
      }
    }

    // ---- Generazione manuale di tutti i canali: /run-all?[force=1] ----
    if (path === "/run-all") {
      if (!isAuthorized(request, env)) return json({ error: "non autorizzato" }, 403);
      const results = await fanOutAll(env, { force: url.searchParams.get("force") === "1" });
      return json(results);
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
