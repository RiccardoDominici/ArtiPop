// Componenti condivisi: la coppia concept×element (chip cliccabili), il
// fotogramma dell'Archivio (COME È NATO quel giorno, mai il generico
// messaggio ombrello del vecchio tool) e la lightbox scheda-giorno con la
// carta d'identità completa. Nel vecchio file la coppia era triplicata (buildFrameHTML,
// writeMeasuresOnFrame, renderLab) — qui vive in un solo posto, letto da tutte
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

/* ---------- coppia concept×element: nomi e nativitità, letti dal catalogo ---------- */
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
// mancava nel vecchio file (solo elementNomeById esisteva): chipCoppia ha bisogno
// anche del nome del concept per il caso in cui il chiamante non lo passi già
// (es. un arco letto da AP.store.archiDi, che non porta con sé conceptNome).
function conceptNomeById(id) {
  const fromCat = AP.store.dati.catalogo?.concepts?.find((c) => c.id === id);
  if (fromCat) return fromCat.nome;
  const fromTuning = AP.store.dati.tuning?.concepts?.[id];
  return fromTuning ? fromTuning.nome : id;
}
AP.comp.isNativePairing = isNativePairing;
AP.comp.elementNomeById = elementNomeById;
AP.comp.conceptNomeById = conceptNomeById;

/* ---------- chipCoppia: UNICO modo di mostrare una coppia in tutto il tool ----------
   Sostituisce la vecchia coppiaLabelHTML (rimossa: i suoi chiamanti — Lab,
   Archivio, quaderno, Catalogo — passano tutti da qui). Ritorna due chip
   affiancati, ciascuno con un `data-` che identifica concept/element: un solo
   listener delegato (vedi in fondo al file) li rende cliccabili ovunque
   compaiano, senza che ogni tab debba agganciare il proprio.
   Opzioni:
     conceptNome/elementNome — override esplicito (la carta d'identità del
       giorno porta già il nome in vigore all'epoca; solo se assente si
       ricade sul catalogo/tuning correnti, che potrebbero essere cambiati nel
       frattempo);
     nativa   — true forza il pallino "accoppiata nativa" (altrimenti calcolato
                da isNativePairing);
     dedotta  — badge "dedotta": la provenienza è ricostruita, non registrata
                puntualmente all'epoca (vedi DESIGN.md, stati degradati onesti). */
function chipCoppia(conceptId, elementId, opzioni = {}) {
  if (!conceptId && !elementId) {
    return `<span class="hint">${esc(opzioni.vuoto || "coppia non disponibile")}</span>`;
  }
  const conceptNome = opzioni.conceptNome || (conceptId ? conceptNomeById(conceptId) : null) || conceptId || "—";
  const elementNome = opzioni.elementNome || (elementId ? elementNomeById(elementId) : null) || elementId || "—";
  const nativa = "nativa" in opzioni ? opzioni.nativa : isNativePairing(conceptId, elementId);
  const dedotta = !!opzioni.dedotta;

  const chipConcept = conceptId
    ? `<span class="chip" data-chip="concept" data-concept="${esc(conceptId)}" title="filtra l'archivio su questo concept">${nativa === true ? '<span class="chipdot" title="accoppiata nativa: element × concept di famiglia"></span>' : ""}${esc(conceptNome)}</span>`
    : `<span class="chip chip-vuoto">—</span>`;
  const chipElement = elementId
    ? `<span class="chip" data-chip="element" data-element="${esc(elementId)}" title="filtra l'archivio su questo element">${esc(elementNome)}</span>`
    : `<span class="chip chip-vuoto">—</span>`;
  const badgeDedotta = dedotta
    ? `<span class="pill" title="provenienza ricostruita: non era registrata puntualmente all'epoca">dedotta</span>`
    : "";
  return `<span class="chipcoppia">${chipConcept}<span class="chip-x">×</span>${chipElement}${badgeDedotta}</span>`;
}
AP.comp.chipCoppia = chipCoppia;

/* ---------- colorazione di un valore rispetto a un range/guardia ---------- */
function inRange(val, range) {
  if (val == null || !Array.isArray(range)) return "neutral";
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
   Mostra SEMPRE data, chip coppia (o il suo stato degradato onesto), tappa e
   marcatura (DESIGN.md, "1. Archivio"): le misure sono scese al livello di
   dettaglio (lightboxGiorno), qui non compaiono più. `opts.workerTooOld`
   distingue il caso di un Worker troppo vecchio (la risposta di /api/archive
   non ha ancora il campo `giorni`: allora TUTTI i giorni di quel canale sono
   così, non è un quarto stato di provenienza) dai tre stati onesti che il
   backend dichiara per-giorno (registrata/ricostruita/assente). Il markup del
   giudizio (buono/scarto/nota) resta qui: chi lo scrive/legge (findNota,
   applyMarkToFrame, wireMarkControls) vive in tab-range.js, caricato PRIMA di
   questo file — vedi il commento in testa a quel file per il perché. */
function buildFrameHTML(canale, date, g, opts = {}) {
  let coppiaHTML, corpoHTML;

  if (opts.workerTooOld) {
    coppiaHTML = `<span class="hint">provenienza sconosciuta: questo Worker non include ancora la carta d'identità dei giorni</span>`;
    corpoHTML = `<div class="measures"></div>`;
  } else if (!g) {
    // difensivo: /api/archive dovrebbe sempre restituire una carta d'identità
    // (registrata o ricostruita) per ogni data — non dovrebbe succedere.
    coppiaHTML = `<span class="hint">carta d'identità non disponibile per questo giorno</span>`;
    corpoHTML = `<div class="measures"></div>`;
  } else if (g.origine === "registrata") {
    coppiaHTML = chipCoppia(g.concept, g.element, { conceptNome: g.conceptNome, elementNome: g.elementNome });
    corpoHTML = `<div class="t">tappa ${g.tappa ?? "—"}/7 · giorno ${g.giornoNellArco ?? "—"}/7 dell'arco</div>`;
  } else if (g.origine === "ricostruita") {
    coppiaHTML = chipCoppia(g.concept, g.element, { conceptNome: g.conceptNome, elementNome: g.elementNome, dedotta: true });
    corpoHTML = `
      <div class="hint">tappa e misure non registrate all'epoca.</div>
      <div class="measures"></div>`;
  } else {
    // "assente" (giorno precedente al tracciamento) o un valore di origine non
    // previsto: mai più il generico messaggio ombrello del vecchio tool.
    coppiaHTML = `<span class="hint">provenienza non registrata (giorno precedente al tracciamento)</span>`;
    corpoHTML = `<div class="measures"></div>`;
  }

  const n = findNota(canale, date);
  return `
    <div class="t">${esc(date)}</div>
    <div class="markIndicator"></div>
    <div class="coppia">${coppiaHTML}</div>
    ${corpoHTML}
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

/* ---------- misure scritte su un fotogramma dopo "misura questo arco" (/test-metrics) ----------
   Bersaglio: solo i fotogrammi del gruppo "giorni senza arco noto" (i soli che
   portano ancora un <div class="measures"> nel loro corpo, vedi sopra). */
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

/* ==================================================================
   LIGHTBOX SCHEDA-GIORNO — componente condiviso unico (Archivio + quaderno
   di laboratorio), vedi DESIGN.md "Componenti condivisi". Un solo elemento
   overlay creato pigramente al primo utilizzo e riempito di nuovo a ogni
   apertura: niente stato complesso da tenere sincronizzato, il contenuto si
   ricostruisce sempre da AP.store al momento dell'apertura (o dopo un salvataggio).
   ================================================================== */
let _lightboxEl = null;

function ensureLightboxEl() {
  if (_lightboxEl) return _lightboxEl;
  const el = document.createElement("div");
  el.id = "apLightbox";
  el.className = "lightbox";
  el.innerHTML = `<div class="lightbox-backdrop"><div class="lightbox-card" role="dialog" aria-modal="true"></div></div>`;
  document.body.appendChild(el);
  // click FUORI dalla card (cioè direttamente sul backdrop) chiude: un click
  // dentro la card non deve mai propagarsi a "fuori", perché il target di un
  // click su un discendente non è mai === backdrop.
  el.querySelector(".lightbox-backdrop").addEventListener("click", (ev) => {
    if (ev.target === ev.currentTarget) chiudiLightbox();
  });
  _lightboxEl = el;
  return el;
}
function chiudiLightbox() {
  if (_lightboxEl) _lightboxEl.classList.remove("open");
}
// Esc chiude la lightbox da qualunque punto della pagina, un solo listener globale.
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") chiudiLightbox();
});
AP.comp.chiudiLightbox = chiudiLightbox;

/* corpo "carta d'identità" per un giorno con provenienza registrata: profilo
   in vigore quel giorno (3 range + guardie), misure effettive colorate su
   QUEL profilo (mai su quello di oggi), verdetto con TUTTI i motivi, modello
   e tentativi. Le altre origini (ricostruita/assente/Worker vecchio) restano
   sui messaggi onesti già usati dal fotogramma, qui solo un filo più discorsivi. */
function buildCartaIdentitaHTML(canale, data, g, workerTooOld) {
  if (workerTooOld) {
    return `<div class="hint">Questo Worker non include ancora la carta d'identità dei giorni in <code>/api/archive</code>: aggiornalo per vedere provenienza e misure di questo canale.</div>`;
  }
  if (!g) {
    return `<div class="hint">Carta d'identità non disponibile per questo giorno (dato mancante nella risposta del Worker).</div>`;
  }
  if (g.origine === "assente") {
    return `<div class="hint">Provenienza non registrata: giorno precedente all'introduzione del tracciamento per questo canale.</div>`;
  }
  if (g.origine === "ricostruita") {
    return `<div class="hint">Tappa e misure non sono deducibili a posteriori per questo canale: la coppia sopra è ricostruita solo perché questo canale, prima della carta d'identità, era sempre a tema fisso.</div>`;
  }

  const prof = g.profilo || null;
  const m = g.misure || {};
  const righeMisure = MEAS.map((k) => {
    const cls = prof ? inRange(m[k], prof[k]) : "neutral";
    const v = m[k] == null ? "—" : (k === "compattezza" ? m[k].toFixed(2) : m[k].toFixed(1));
    const rangeTxt = prof && Array.isArray(prof[k]) ? `${prof[k][0]}–${prof[k][1]}` : "guardia non nota";
    return `<div class="row"><label>${esc(MEAS_LABEL[k])}</label><div><span class="val ${cls}">${v}</span> <span class="hint">(range ${esc(rangeTxt)})</span></div></div>`;
  }).join("");
  const righeGuardie = [["deriva", "maxDeriva"], ["degrado", "maxDegrado"]]
    .filter(([k]) => m[k] != null)
    .map(([k, gk]) => {
      const cls = prof ? inGuard(m[k], prof[gk]) : "neutral";
      const guardTxt = (prof && Number.isFinite(prof[gk])) ? `≤ ${prof[gk]}` : "guardia globale di default";
      return `<div class="row"><label>${k}</label><div><span class="val ${cls}">${m[k].toFixed(1)}</span> <span class="hint">(${esc(guardTxt)})</span></div></div>`;
    }).join("");
  const monotonaTxt = prof ? `<div class="hint" style="margin:2px 0 8px">monotona: ${prof.monotona ? "sì (la scena non torna indietro)" : "no"}</div>` : "";
  const verd = g.collaudo
    ? `<div class="verdict ${g.collaudo.ok ? "ok" : "no"}">${g.collaudo.ok ? "✓ collaudo superato" : "✗ collaudo NON superato"}${g.collaudo.motivi && g.collaudo.motivi.length ? ": " + g.collaudo.motivi.map(esc).join("; ") : ""}</div>`
    : `<div class="hint">nessun verdetto registrato</div>`;

  return `
    <div class="row"><label>arco</label><div>arco ${g.arco != null ? g.arco + 1 : "—"} · giorno ${g.giornoNellArco ?? "—"}/7 · tappa ${g.tappa ?? "—"}/7</div></div>
    ${g.testoTappa ? `<div class="hint" style="margin:2px 0 10px">${esc(g.testoTappa)}</div>` : ""}
    <div class="row"><label>modello</label><div>${esc(g.modello || "—")} · ${g.tentativi ?? "—"} tentativi</div></div>
    <div class="hint" style="text-transform:uppercase;font-size:11px;margin:10px 0 4px">misure effettive · profilo in vigore quel giorno</div>
    ${righeMisure}${righeGuardie}${monotonaTxt}${verd}
    <div class="hint" style="margin-top:8px">provenienza: registrata</div>`;
}

/* marcatura buono/scarto + nota, riusa lo stesso PUT /note/giorno del
   fotogramma (findNota/upsertNotaLocal/refreshAllMarks vivono in
   tab-range.js, caricato dopo questo file: riferimento in avanti sicuro,
   perché si risolve solo quando l'utente preme davvero un bottone).
   Ritorna true/false (salvataggio avvenuto o no): il chiamante lo usa per
   decidere se ha senso ridisegnare la card (vedi sotto — un ridisegno dopo un
   fallimento cancellerebbe il messaggio appena scritto in statusEl PRIMA che
   il browser abbia potuto disegnarlo, trasformando la richiesta contestuale
   della chiave admin in un fallimento silenzioso). */
async function lightboxSalvaNota(canale, data, giudizio, nota, statusEl) {
  if (!key()) { statusEl.textContent = "serve la chiave admin (campo in alto) per marcare/salvare"; return false; }
  statusEl.textContent = "salvo…";
  try {
    await api("/note/giorno", { method: "PUT", body: JSON.stringify({ canale, data, giudizio, nota }) });
    upsertNotaLocal(canale, data, giudizio, nota); // aggiornamento ottimistico, stessa copia locale letta ovunque
    refreshAllMarks(); // riflette subito la marcatura anche sul fotogramma da cui si è aperta la lightbox
    if (typeof renderNotebook === "function") renderNotebook();
    statusEl.textContent = "salvato ✓";
    return true;
  } catch (e) {
    statusEl.textContent = "";
    toastErrore(e, "salvataggio marcatura");
    return false;
  }
}

function renderLightboxContent(el, canale, data) {
  const card = el.querySelector(".lightbox-card");
  const arch = AP.store.dati.archivi[canale];
  const workerTooOld = !!(arch && Array.isArray(arch.dates) && !Array.isArray(arch.giorni));
  const g = AP.store.giorno(canale, data);
  const imgUrl = `${base()}/w/${encodeURIComponent(canale)}?date=${encodeURIComponent(data)}`;

  const coppiaHTML = (!workerTooOld && g && (g.concept || g.element))
    ? chipCoppia(g.concept, g.element, { conceptNome: g.conceptNome, elementNome: g.elementNome, dedotta: g.origine === "ricostruita" })
    : "";

  const n = findNota(canale, data);
  card.innerHTML = `
    <button class="ghost lightbox-close" title="chiudi (Esc)">✕ chiudi</button>
    <div class="lightbox-body">
      <div class="lightbox-img"><img src="${imgUrl}" alt="${esc(data)}" /></div>
      <div class="lightbox-info">
        <div style="font-size:15px;font-weight:600;margin-bottom:2px">${esc(data)} · ${esc(canale)}</div>
        ${coppiaHTML ? `<div class="coppia" style="margin:8px 0">${coppiaHTML}</div>` : ""}
        ${buildCartaIdentitaHTML(canale, data, g, workerTooOld)}
        <div class="markrow" style="margin-top:14px">
          <button class="markBtn ${n?.giudizio === "buono" ? "primary" : ""}" data-giud="buono">✓ buono</button>
          <button class="markBtn ${n?.giudizio === "scarto" ? "primary" : ""}" data-giud="scarto">✕ scarto</button>
        </div>
        <div class="markrow">
          <input type="text" class="markNota" maxlength="300" placeholder="nota libera…" value="${esc(n?.nota || "")}" />
          <button class="markSaveNota ghost">💾 salva nota</button>
        </div>
        <div class="hint lightboxStatus"></div>
      </div>
    </div>`;

  const statusEl = card.querySelector(".lightboxStatus");
  card.querySelector(".lightbox-close").onclick = chiudiLightbox;
  card.querySelectorAll(".markBtn").forEach((b) => {
    b.onclick = async () => {
      const current = findNota(canale, data);
      const nextGiud = current?.giudizio === b.dataset.giud ? null : b.dataset.giud;
      const notaVal = card.querySelector(".markNota")?.value || "";
      const salvato = await lightboxSalvaNota(canale, data, nextGiud, notaVal, statusEl);
      // ridisegna SOLO se il salvataggio è davvero avvenuto: farlo comunque
      // ricostruirebbe la card (e con essa statusEl) subito dopo aver scritto
      // "serve la chiave admin…", cancellando il messaggio prima ancora che
      // l'utente possa vederlo — vedi il commento su lightboxSalvaNota.
      if (salvato) renderLightboxContent(el, canale, data);
    };
  });
  card.querySelector(".markSaveNota").onclick = async () => {
    const current = findNota(canale, data);
    const notaVal = card.querySelector(".markNota").value;
    await lightboxSalvaNota(canale, data, current?.giudizio ?? null, notaVal, statusEl);
  };
}

/** AP.comp.lightboxGiorno(canale, data) — apre la scheda-giorno completa. */
function lightboxGiorno(canale, data) {
  const el = ensureLightboxEl();
  renderLightboxContent(el, canale, data);
  el.classList.add("open");
}
AP.comp.lightboxGiorno = lightboxGiorno;

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
  header.innerHTML = chipCoppia(res.concept.schema, elId, { conceptNome: res.concept.nome, elementNome: elementNomeById(elId) });
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

/* ---------- listener delegato UNICO per tutti i chip coppia del tool ----------
   Un solo posto che sa cosa fare quando si clicca un chip concept/element,
   ovunque compaia (Archivio, quaderno, lightbox, Lab, Catalogo): naviga
   sull'Archivio filtrato su quell'id (vedi DESIGN.md, criterio di accettazione
   3). Chiude prima un'eventuale lightbox aperta: si sta lasciando la scheda del
   giorno per andare a guardare una lista filtrata, non avrebbe senso restare
   sull'overlay. */
document.addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-chip]");
  if (!chip) return;
  chiudiLightbox();
  if (chip.dataset.chip === "concept" && chip.dataset.concept) {
    AP.util.route.vai("archivio", { concept: chip.dataset.concept });
  } else if (chip.dataset.chip === "element" && chip.dataset.element) {
    AP.util.route.vai("archivio", { element: chip.dataset.element });
  }
});
