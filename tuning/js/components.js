// Componenti condivisi: la coppia concept×element (etichetta + verifica se è
// nativa) e il rendering delle misure, che nel vecchio file era triplicato fra
// buildFrameHTML (Archivio), writeMeasuresOnFrame (Archivio, misurazione a
// posteriori) e renderLab (Lab) — qui vive in un solo posto, letto da entrambe
// le tab. Legge lo stato da AP.store (mai fetch propri).
window.AP = window.AP || {};
AP.comp = AP.comp || {};

/* ---------- le 3 misure tarabili + le loro etichette/scale ---------- */
const MEAS = ["estensione", "intensita", "compattezza"];
const MEAS_LABEL = { estensione: "estensione %", intensita: "intensità", compattezza: "compattezza" };
const MEAS_MAX = { estensione: 100, intensita: 100, compattezza: 1 };
AP.comp.MEAS = MEAS;
AP.comp.MEAS_LABEL = MEAS_LABEL;
AP.comp.MEAS_MAX = MEAS_MAX;

/* ---------- coppia concept×element: unica formulazione, usata in Lab/Archivio/Element ---------- */
function coppiaLabelHTML(conceptNome, conceptId, elementNome, elementId, nativo) {
  if (!conceptId && !elementId) return `<span class="hint">combinazione non nota</span>`;
  const c = esc(conceptNome || conceptId || "—");
  const e = esc(elementNome || elementId || "—");
  const badge = nativo === true ? '<span class="pill">nativa</span>'
    : nativo === false ? '<span class="pill">combinazione libera</span>' : '';
  return `concept <b>${c}</b> applicato all'element <b>${e}</b> ${badge}`;
}
/* true/false solo se determinabile dal catalogo (o dal fallback /tuning), null se
   non determinabile — mai indovinato. */
function isNativePairing(conceptId, elementId) {
  if (!conceptId || !elementId) return null;
  const fromCat = AP.store.dati.catalogo?.elements?.find((e) => e.id === elementId);
  if (fromCat) return fromCat.famigliaNativa === conceptId;
  const fromTuning = (AP.store.dati.tuning?.elements || []).find((e) => e.id === elementId);
  if (fromTuning) return fromTuning.famigliaNativa === conceptId;
  return null;
}
function elementNomeById(id) {
  const fromCat = AP.store.dati.catalogo?.elements?.find((e) => e.id === id);
  if (fromCat) return fromCat.nome;
  const fromTuning = (AP.store.dati.tuning?.elements || []).find((e) => e.id === id);
  return fromTuning ? fromTuning.nome : id;
}
AP.comp.coppiaLabelHTML = coppiaLabelHTML;
AP.comp.isNativePairing = isNativePairing;
AP.comp.elementNomeById = elementNomeById;

/* ---------- colorazione di un valore rispetto a un range/guardia ---------- */
function inRange(val, range) {
  if (val == null) return "neutral";
  return (val >= range[0] && val <= range[1]) ? "in" : "out";
}
// guardia superiore (maxDeriva/maxDegrado): senza guardia nota resta neutro, non
// si inventa un range che il Worker non ha mai dichiarato.
function inGuard(val, maxGuard) {
  if (val == null || !Number.isFinite(maxGuard)) return "neutral";
  return val <= maxGuard ? "in" : "out";
}
AP.comp.inRange = inRange;
AP.comp.inGuard = inGuard;

/* ---------- fotogramma dell'Archivio: dice COME È NATO quel giorno ----------
   Usa la carta d'identità `g` (da AP.store.giorno) quando c'è, degrada
   onestamente quando non c'è — mai numeri inventati. Il markup del giudizio
   (buono/scarto/nota) resta qui dentro: chi lo scrive/legge (findNota, ecc.)
   vive in tab-range.js insieme al resto delle marcature condivise. */
function buildFrameHTML(canale, date, g) {
  const nativo = g ? isNativePairing(g.concept, g.element) : null;
  const coppia = (g && (g.concept || g.element))
    ? coppiaLabelHTML(g.conceptNome, g.concept, g.elementNome, g.element, nativo)
    : `<span class="hint">combinazione non nota</span>`;

  let corpo;
  if (g && g.origine === "registrata") {
    const prof = g.profilo || null; // il profilo IN VIGORE quel giorno — mai quello di oggi, sarebbe fuorviante
    const m = g.misure || {};
    const mainRows = MEAS.map((k) => {
      const cls = prof ? inRange(m[k], prof[k]) : "neutral";
      const v = m[k] == null ? "—" : (k === "compattezza" ? m[k].toFixed(2) : m[k].toFixed(1));
      return `<div class="m"><b>${k.slice(0, 3)}</b><span class="val ${cls}">${v}</span></div>`;
    }).join("");
    const guardRows = [["deriva", "maxDeriva"], ["degrado", "maxDegrado"]].map(([k, gk]) => {
      if (m[k] == null) return "";
      const cls = prof ? inGuard(m[k], prof[gk]) : "neutral";
      return `<div class="m"><b>${k.slice(0, 3)}</b><span class="val ${cls}">${m[k].toFixed(1)}</span></div>`;
    }).join("");
    const verd = g.collaudo
      ? `<div class="verdict ${g.collaudo.ok ? "ok" : "no"}">${g.collaudo.ok ? "✓ nel range" : "✗ " + esc((g.collaudo.motivi && g.collaudo.motivi[0]) || "fuori range")}</div>`
      : "";
    corpo = `
      <div class="t">tappa ${g.tappa ?? "—"}/7 · giorno ${g.giornoNellArco ?? "—"}/7 dell'arco</div>
      <div class="t">${esc(g.modello || "—")} · ${g.tentativi ?? "—"} tentativi</div>
      ${mainRows}${guardRows}${verd}
      <div class="hint" style="margin-top:5px">provenienza: registrata</div>`;
  } else if (g && g.origine === "ricostruita") {
    corpo = `
      <div class="hint">tappa e misure non note: non deducibili a posteriori per questo canale.</div>
      <div class="hint" style="margin-top:5px">provenienza: ricostruita</div>
      <div class="measures"></div>`;
  } else {
    corpo = `
      <div class="hint">provenienza non disponibile per questo giorno.</div>
      <div class="measures"></div>`;
  }

  // la nota/giudizio esistente arriva da AP.store.dati.note tramite findNota (in
  // tab-range.js, caricato prima di questo file NO — dopo: la chiamata è dentro una
  // funzione, non a livello di script, quindi la risoluzione del nome avviene solo
  // quando buildFrameHTML gira davvero, a pagina già completamente caricata).
  const n = findNota(canale, date);
  return `
    <div class="t">${esc(date)}</div>
    <div class="markIndicator"></div>
    <div class="coppia" style="font-size:12px;margin-bottom:5px">${coppia}</div>
    ${corpo}
    <div class="markrow">
      <button class="markBtn" data-giud="buono" title="segna questo giorno come buono">✓ buono</button>
      <button class="markBtn" data-giud="scarto" title="segna questo giorno come scarto">✕ scarto</button>
    </div>
    <div class="markrow">
      <input type="text" class="markNota" placeholder="nota libera…" maxlength="300" value="${esc(n?.nota || "")}" />
      <button class="markSaveNota ghost" title="salva la nota">💾</button>
    </div>
    <div class="hint markStatus"></div>`;
}

/* ---------- misure scritte su un fotogramma dopo "misura questo arco" (/test-metrics) ---------- */
function writeMeasuresOnFrame(frameMap, date, res, profilo) {
  const cell = frameMap.get(date);
  if (!cell) return;
  const m = res.misure || {};
  const mainRows = MEAS.map((k) => {
    const cls = profilo ? inRange(m[k], profilo[k]) : "neutral";
    const v = m[k] == null ? "—" : (k === "compattezza" ? m[k].toFixed(2) : m[k].toFixed(1));
    return `<div class="m"><b>${k.slice(0, 3)}</b><span class="val ${cls}">${v}</span></div>`;
  }).join("");
  const guardRows = [["deriva", "maxDeriva"], ["degrado", "maxDegrado"]].map(([k, gk]) => {
    if (m[k] == null) return "";
    const cls = profilo ? inGuard(m[k], profilo[gk]) : "neutral";
    return `<div class="m"><b>${k.slice(0, 3)}</b><span class="val ${cls}">${m[k].toFixed(1)}</span></div>`;
  }).join("");
  const verd = res.verdetto
    ? `<div class="verdict ${res.verdetto.ok ? "ok" : "no"}">${res.verdetto.ok ? "✓ passerebbe il cancello" : "✗ " + esc((res.verdetto.motivi && res.verdetto.motivi[0]) || "fuori range")}</div>`
    : "";
  cell.innerHTML = mainRows + guardRows + verd;
}
function writeMeasureError(frameMap, date, msg) {
  const cell = frameMap.get(date);
  if (!cell) return;
  cell.innerHTML = `<div class="verdict no">✗ ${esc(msg)}</div>`;
}
AP.comp.buildFrameHTML = buildFrameHTML;
AP.comp.writeMeasuresOnFrame = writeMeasuresOnFrame;
AP.comp.writeMeasureError = writeMeasureError;

/* ---------- risultato di un run del Lab ----------
   Stessa funzione di sempre (compresi i due pulsanti d'azione): "proponiRange" e
   "showPublishPanel" sono definite in tab-lab.js, caricato DOPO questo file, ma
   qui vengono chiamate solo dentro gli onclick — cioè quando l'utente le preme
   davvero, a pagina già completamente caricata — non mentre questo script gira,
   quindi il riferimento in avanti è sicuro (è una normale funzione globale,
   risolta per nome al momento della chiamata). */
function renderLab(res, elId) {
  const prof = res.concept.profilo;
  const header = document.createElement("div");
  header.className = "hint";
  header.style.cssText = "font-size:13px;color:var(--text);margin-bottom:12px";
  header.innerHTML = coppiaLabelHTML(res.concept.nome, res.concept.schema, elementNomeById(elId), elId, isNativePairing(res.concept.schema, elId));
  const film = document.createElement("div"); film.className = "film";
  for (const g of res.giorni) {
    const m = g.misure || {};
    const cell = document.createElement("div"); cell.className = "frame";
    const rows = MEAS.map((k) => {
      const cls = inRange(m[k], prof[k]);
      const v = m[k] == null ? "—" : (k === "compattezza" ? m[k].toFixed(2) : m[k].toFixed(1));
      return `<div class="m"><b>${k.slice(0, 3)}</b><span class="val ${cls}">${v}</span></div>`;
    }).join("");
    const extra = m.occupazione != null
      ? `<div class="m"><b>occ</b><span class="val neutral">${m.occupazione.toFixed(0)}% (${m.avanzamento >= 0 ? '+' : ''}${(m.avanzamento || 0).toFixed(0)})</span></div>` : "";
    const verd = g.collaudo ? `<div class="verdict ${g.collaudo.ok ? 'ok' : 'no'}">${g.collaudo.ok ? '✓ nel range' : '✗ ' + (g.collaudo.motivi[0] || 'fuori')}</div>` : "";
    cell.innerHTML = `
      <img loading="lazy" src="${base()}/lab/img?run=${encodeURIComponent(res.runId)}&n=${g.n}" alt="giorno ${g.n}" />
      <div class="meta">
        <div class="t">giorno ${g.n} · tappa ${g.tappa} · ${g.tentativi}t</div>
        ${rows}${extra}${verd}
      </div>`;
    film.appendChild(cell);
  }
  // pannello "proponi range" + "pubblica questa combinazione"
  const actions = document.createElement("div");
  actions.style.cssText = "margin:14px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center";

  const btnRange = document.createElement("button");
  btnRange.textContent = `⤵ Proponi range per "${res.concept.nome.split(' · ')[0]}" da questi valori`;
  btnRange.onclick = () => proposeRange(res);
  actions.appendChild(btnRange);

  // AP.store.dati.catalogo parte già valorizzato con {concepts:[],elements:[]}
  // (mai null, vedi store.js): un catalogo genuinamente caricato ha SEMPRE almeno
  // i concept built-in, quindi la lunghezza è l'indicatore giusto di "disponibile
  // davvero" — un semplice check di verità non lo sarebbe più.
  if (AP.store.dati.catalogo?.concepts?.length) {
    const btnPub = document.createElement("button");
    btnPub.className = "primary";
    btnPub.textContent = "📌 Pubblica questa combinazione";
    btnPub.onclick = () => showPublishPanel(res);
    actions.appendChild(btnPub);
  } else {
    const note = document.createElement("span");
    note.className = "hint";
    note.textContent = "(pubblicare richiede il catalogo — non ancora disponibile)";
    actions.appendChild(note);
  }

  const out = $("labResult"); out.innerHTML = "";
  out.appendChild(header); out.appendChild(film); out.appendChild(actions);
  const panel = document.createElement("div"); panel.id = "publishPanel"; out.appendChild(panel);
}
AP.comp.renderLab = renderLab;
