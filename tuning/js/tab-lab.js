// TAB LAB: genera un arco di prova (concept × element, cancello on/off), propone
// range al Range tarati sui risultati, o pubblica la combinazione in produzione.
// I selettori pescano da AP.store.dati.catalogo (o dal fallback /tuning se il
// catalogo non è disponibile su un Worker più vecchio) invece delle liste
// hardcoded di un tempo.
//
// DESIGN.md, "2. Lab": lo storico dei run è persistente (AP.store.labRuns, in
// localStorage — vedi store.js), il pannello "Questa coppia finora" mostra il
// contesto PRIMA di generare, e "proponi range"/"pubblica" hanno una gerarchia
// del rischio diversa (la seconda è distruttiva e chiede conferma esplicita).
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

/* ---------- selettori concept/element ---------- */
function fillLabSelectors() {
  const cSel = $("labConcept"), eSel = $("labElement");
  if (!cSel || !eSel) return;
  const prevC = cSel.value, prevE = eSel.value;
  const cat = AP.store.dati.catalogo;
  const tuning = AP.store.dati.tuning;
  let concepts, elements;
  if (cat && cat.concepts && cat.concepts.length) {
    // fonte preferita: /catalogo, include già built-in + custom con il flag `custom`
    concepts = cat.concepts.map((c) => ({ id: c.id, nome: c.nome, custom: c.custom }));
    elements = cat.elements.map((e) => ({ id: e.id, nome: e.nome, famigliaNativa: e.famigliaNativa, custom: e.custom }));
  } else if (tuning && tuning.concepts && Object.keys(tuning.concepts).length) {
    // fallback finché /catalogo non è disponibile: solo i built-in di /tuning
    concepts = Object.entries(tuning.concepts).map(([id, p]) => ({ id, nome: p.nome, custom: false }));
    elements = (tuning.elements || []).map((e) => ({ id: e.id, nome: e.nome, famigliaNativa: e.famigliaNativa, custom: false }));
  } else return;
  cSel.innerHTML = concepts.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}${c.custom ? ' · custom' : ''}</option>`).join("");
  eSel.innerHTML = elements.map((e) =>
    `<option value="${esc(e.id)}" data-nat="${esc(e.famigliaNativa)}">${esc(e.nome)} · ${esc(e.famigliaNativa)}${e.custom ? ' · custom' : ''}</option>`).join("");
  // prova a ripristinare la selezione precedente, se ancora presente nell'elenco
  if (prevC && concepts.some((c) => c.id === prevC)) cSel.value = prevC;
  if (prevE && elements.some((e) => e.id === prevE)) eSel.value = prevE;
  // il cambio di selezione (utente o ripristino qui sopra) aggiorna SEMPRE il
  // contesto: idempotente, sicuro da riassegnare a ogni chiamata (niente
  // addEventListener che si accumulerebbe a ogni ricarica del catalogo).
  cSel.onchange = renderContesto;
  eSel.onchange = renderContesto;
}

/* ==================================================================
   PANNELLO "QUESTA COPPIA FINORA" — sotto i selettori, PRIMA di generare
   (DESIGN.md, "2. Lab": "Contesto prima di generare"). Creato una volta sola,
   agganciato al DOM subito prima di #labResult (niente markup nuovo in
   index.html: stesso approccio della lightbox in components.js).
   ================================================================== */
function ensureContestoEl() {
  let el = $("labContesto");
  if (el) return el;
  el = document.createElement("div");
  el.id = "labContesto";
  const risultati = $("labResult");
  risultati.parentNode.insertBefore(el, risultati);
  return el;
}

function renderContesto() {
  const wrap = ensureContestoEl();
  const cSel = $("labConcept"), eSel = $("labElement");
  const c = cSel?.value, el = eSel?.value;
  if (!c || !el) { wrap.innerHTML = ""; return; }

  const nativa = AP.comp.isNativePairing(c, el);
  const conceptNome = AP.comp.conceptNomeById(c);
  const elementNome = AP.comp.elementNomeById(el);
  const coppiaHTML = AP.comp.chipCoppia(c, el, { nativa });

  const runsPrecedenti = AP.store.labRuns.list().filter((r) => r.concept === c && r.element === el);
  const usi = AP.store.usiCoppia(c, el);
  const nienteStoria = !runsPrecedenti.length && !usi.archi.length && !usi.buoni && !usi.scarti;

  let natTxt = "";
  if (nativa === true) natTxt = `accoppiata nativa di "${esc(conceptNome)}"`;
  else if (nativa === false) natTxt = `combinazione libera — "${esc(elementNome)}" è nativo di un altro concept`;

  let corpo;
  if (nienteStoria) {
    corpo = `<div class="hint">Mai provata nel Lab, mai generata in produzione: sarebbe il primo esperimento con questa coppia.</div>`;
  } else {
    const rigaRun = runsPrecedenti.length
      ? `<div class="row-info">🧪 ${runsPrecedenti.length} run precedent${runsPrecedenti.length === 1 ? "e" : "i"} nel Lab (l'ultimo il ${esc(new Date(runsPrecedenti[0].quando).toLocaleString())}).</div>`
      : `<div class="row-info hint">Nessun run precedente nel Lab per questa coppia.</div>`;
    const rigaArchi = usi.archi.length
      ? `<div class="row-info">📦 ${usi.archi.length} arc${usi.archi.length === 1 ? "o" : "hi"} in produzione (${usi.giorni} giorni) su ${esc(usi.canali.join(", "))}.</div>`
      : `<div class="row-info hint">Nessun arco in produzione con questa coppia.</div>`;
    const rigaGiudizi = (usi.buoni || usi.scarti)
      ? `<div class="row-info">⚖ ${usi.buoni} buon${usi.buoni === 1 ? "o" : "i"} · ${usi.scarti} scart${usi.scarti === 1 ? "o" : "i"}.</div>`
      : `<div class="row-info hint">Nessun giudizio ancora raccolto per questa coppia.</div>`;
    corpo = rigaRun + rigaArchi + rigaGiudizi;
  }

  const linkArchivio = usi.archi.length ? `<button class="ghost" data-act="vaiArchivio">vedi in archivio</button>` : "";

  wrap.innerHTML = `<div class="card contesto-coppia">
    <h3 style="margin-bottom:4px">Questa coppia finora</h3>
    <div style="margin:4px 0 6px">${coppiaHTML}</div>
    ${natTxt ? `<div class="hint" style="margin-bottom:8px">${natTxt}</div>` : ""}
    ${corpo}
    ${linkArchivio ? `<div class="formactions" style="margin-top:10px">${linkArchivio}</div>` : ""}
  </div>`;

  const btnArchivio = wrap.querySelector('[data-act="vaiArchivio"]');
  if (btnArchivio) btnArchivio.onclick = () => AP.util.route.vai("archivio", { concept: c, element: el });
}

/* ==================================================================
   STORICO DEI RUN — card impilate, la più recente in alto (DESIGN.md,
   "2. Lab": storico persistente). Ogni run generato o riletto da
   localStorage passa da qui: nessuno stato "corrente" tenuto altrove.
   ================================================================== */

// runId -> l'immagine ha già dato errore in QUESTA sessione: evita di
// ritentare il caricamento a ogni ridisegno (un run scaduto lo resta).
const runsScaduti = new Set();

function isRunScaduto(run) {
  if (runsScaduti.has(run.id)) return true;
  const quando = Date.parse(run.quando || run.salvatoIl || "");
  if (!Number.isFinite(quando)) return false; // data non interpretabile: non si inventa una scadenza
  return (Date.now() - quando) > 3600 * 1000; // stessa TTL delle immagini lato server (lab.js, LAB_TTL)
}

function renderRunList() {
  const out = $("labResult");
  if (!out) return;
  const runs = AP.store.labRuns.list();
  out.innerHTML = "";
  if (!runs.length) {
    out.innerHTML = `<div class="hint">Nessun run ancora in questo browser. Genera un arco di prova qui sopra: resta nello storico anche cambiando tab o ricaricando la pagina.</div>`;
    return;
  }
  for (const run of runs) {
    out.appendChild(AP.comp.buildRunCard(run, {
      scaduto: isRunScaduto(run),
      onImgError: (runId) => runsScaduti.add(runId),
      azioni: { rigenera: rigeneraRun, proponi: proponiRangeDaRun, pubblica: apriDialogoPubblica, rimuovi: rimuoviRun },
    }));
  }
}

/* lancia /lab/arc e registra il run nello storico persistente — usata sia dal
   bottone principale sia da "↻ rigenera" su una card esistente, così le due
   strade restano IDENTICHE (stesso oggetto salvato, stesso ridisegno). */
async function eseguiRun(concept, element, days, gate) {
  const res = await api(`/lab/arc?concept=${encodeURIComponent(concept)}&element=${encodeURIComponent(element)}&days=${encodeURIComponent(days)}&gate=${gate ? 1 : 0}`, { method: "POST" });
  const run = {
    id: res.runId,
    concept, element,
    days: Number(days), gate: !!gate,
    quando: new Date().toISOString(),
    giorni: res.giorni,
    profilo: res.concept.profilo,
    conceptNome: res.concept.nome,
    virtuale: !!res.concept.virtuale,
  };
  AP.store.labRuns.add(run);
  renderRunList();
  renderContesto(); // il run appena fatto entra subito nella storia della coppia
  return run;
}

$("labRun").onclick = async () => {
  if ($("labRun").disabled) return; // non permettere doppi invii: un run costa tempo (e neuroni) veri
  if (!key()) { setStatus($("labStatus"), "serve la chiave admin"); $("key").focus(); return; }
  const c = $("labConcept").value, el = $("labElement").value;
  if (!c || !el) { setStatus($("labStatus"), "seleziona concept ed element"); return; }
  const days = $("labDays").value, gate = $("labGate").value === "1";
  const nat = $("labElement").selectedOptions[0]?.dataset.nat;
  $("labRun").disabled = true;
  $("labStatus").innerHTML = `<span class="spinner"></span> genero ${esc(c)} × ${esc(el)}${nat !== c ? ' (combinazione libera)' : ''}…`;
  try {
    const run = await eseguiRun(c, el, days, gate);
    setStatus($("labStatus"), `fatto: ${run.giorni.length} giorni${run.virtuale ? ' · combinazione libera (tappe generiche)' : ''}`);
    toast(`arco di prova generato: ${run.giorni.length} giorni`, "ok");
  } catch (e) {
    setStatus($("labStatus"), "");
    toastErrore(e, "generazione arco di prova"); // errori[] del Worker campo per campo, via il toast unificato
  } finally {
    $("labRun").disabled = false;
  }
};

async function rigeneraRun(run, btn) {
  if (btn.disabled) return; // stesso guardia anti-doppio-invio del bottone principale
  if (!key()) { toast("serve la chiave admin per rigenerare", "errore"); $("key").focus(); return; }
  const originaleHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> rigenero…`;
  try {
    await eseguiRun(run.concept, run.element, run.days, run.gate);
    toast(`rigenerato: nuovo run di "${AP.comp.conceptNomeById(run.concept)} × ${AP.comp.elementNomeById(run.element)}" in cima allo storico`, "ok");
    // sul successo renderRunList() ha già ricostruito tutta la lista: il nodo
    // `btn` non esiste più, niente da ripristinare.
  } catch (e) {
    toastErrore(e, "rigenerazione run");
    btn.disabled = false;
    btn.innerHTML = originaleHTML;
  }
}

function rimuoviRun(run) {
  const etichetta = `"${AP.comp.conceptNomeById(run.concept)} × ${AP.comp.elementNomeById(run.element)}" del ${run.quando ? new Date(run.quando).toLocaleString() : "—"}`;
  if (!confirm(`Rimuovere dallo storico locale il run ${etichetta}?`)) return;
  AP.store.labRuns.remove(run.id);
  renderRunList();
  toast("run rimosso dallo storico", "ok");
}

/* ==================================================================
   "⤵ Proponi range" — resta un bottone normale, ma prima di sovrascrivere
   AP.store.edit controlla se ci sono modifiche manuali non ancora lanciate
   per lo stesso concept (DESIGN.md: "oggi sovrascrive in silenzio", citato
   per nome come uno dei problemi da risolvere).
   ================================================================== */

/* stessa logica di margine di sempre: [min,max] osservati + un margine
   (15% dell'escursione, minimo 1 unità; 0.05 fisso per compattezza, che vive
   in scala 0–1). */
function calcolaValoriProposti(run) {
  const giorni = (run.giorni || []).filter((g) => g.misure);
  const proposti = {};
  for (const k of AP.comp.MEAS) {
    const vals = giorni.map((g) => g.misure[k]).filter((v) => v != null).sort((a, b) => a - b);
    if (!vals.length) continue;
    const lo = vals[0], hi = vals[vals.length - 1];
    const margine = k === "compattezza" ? 0.05 : Math.max(1, (hi - lo) * 0.15);
    proposti[k] = [
      Math.max(0, +(lo - margine).toFixed(k === "compattezza" ? 2 : 1)),
      +(hi + margine).toFixed(k === "compattezza" ? 2 : 1),
    ];
  }
  return proposti;
}

/* "modifiche manuali non ancora lanciate" = l'editor (AP.store.edit, quello
   che Range mostra) differisce da quanto il Worker ha DAVVERO in vigore ORA
   (AP.store.dati.tuning.concepts, già default+override applicato). Se sono
   uguali non c'è nulla che "proponi range" rischierebbe di far perdere.
   Stessa funzione di confronto usata dal badge/testo di stato di Range
   (AP.util.diffProfilo, vedi util.js): un solo posto che decide cosa vuol
   dire "modificato", non due implementazioni che potrebbero disallinearsi. */
function haModificheNonLanciate(conceptId) {
  return AP.util.diffProfilo(AP.store.edit[conceptId], AP.store.dati.tuning?.concepts?.[conceptId]).modificato;
}

function proponiRangeDaRun(run, dialogEl) {
  const id = run.concept;
  if (!AP.store.edit[id]) { toast(`concept "${id}" non in tabella (apri prima la tab Range e ricarica)`, "errore"); return; }
  const proposti = calcolaValoriProposti(run);
  if (!Object.keys(proposti).length) { toast("nessuna misura disponibile in questo run: impossibile proporre un range", "errore"); return; }
  if (haModificheNonLanciate(id)) {
    apriDialogoDiffRange(id, proposti, dialogEl);
  } else {
    applicaRangeProposto(id, proposti); // niente da sovrascrivere: si applica direttamente, come prima
  }
}

function applicaRangeProposto(id, proposti) {
  for (const [k, v] of Object.entries(proposti)) AP.store.edit[id][k] = v;
  setStatus($("rangeStatus"), `proposti i range di "${AP.comp.conceptNomeById(id)}" dai risultati del Lab (non ancora lanciati)`, "changed");
  toast(`range di "${AP.comp.conceptNomeById(id)}" aggiornati nell'editor dal Lab`, "ok");
  AP.util.route.vai("range"); // il cambio di hash fa comparire la tab Range, che si ridisegna da sola leggendo AP.store.edit
}

/* diff campo per campo: valore ATTUALE nell'editor → valore PROPOSTO dal lab.
   Dentro `dialogEl` (non un id fisso): con più card impilate, ognuna può
   avere il proprio dialogo aperto senza collisioni di id. */
function apriDialogoDiffRange(id, proposti, dialogEl) {
  const edit = AP.store.edit[id];
  const righe = AP.comp.MEAS.filter((k) => proposti[k]).map((k) => {
    const attuale = edit[k], nuovo = proposti[k];
    const cambiato = attuale[0] !== nuovo[0] || attuale[1] !== nuovo[1];
    return `<div class="row"><label>${esc(AP.comp.MEAS_LABEL[k])}</label>
      <div>${attuale[0]}–${attuale[1]} → <b class="${cambiato ? "diff-changed" : ""}">${nuovo[0]}–${nuovo[1]}</b></div></div>`;
  }).join("");
  dialogEl.innerHTML = `
    <div class="warnbox">
      <h4>Sovrascrivere le modifiche non lanciate di "${esc(AP.comp.conceptNomeById(id))}"?</h4>
      <div class="hint" style="margin:6px 0 10px">In Range ci sono valori modificati a mano per questo concept, non ancora lanciati nel Worker.
        Proponendo i range da questo run li sostituiresti (valore attuale nell'editor → proposto dal Lab):</div>
      ${righe}
      <div class="formactions">
        <button class="warn" data-act="diffOk">Sovrascrivi con i valori del Lab</button>
        <button class="ghost" data-act="diffAnnulla">Annulla</button>
      </div>
    </div>`;
  dialogEl.querySelector('[data-act="diffOk"]').onclick = () => { dialogEl.innerHTML = ""; applicaRangeProposto(id, proposti); };
  dialogEl.querySelector('[data-act="diffAnnulla"]').onclick = () => { dialogEl.innerHTML = ""; };
}

/* ==================================================================
   "📌 Pubblica in produzione" — visivamente distruttiva (bottone .warn, non
   .primary): apre una conferma esplicita col pool attuale del canale prima
   di scrivere davvero (DESIGN.md: "così si vede in cosa si sta entrando").
   ================================================================== */

/* pool attuale di un canale = indole (campo `famiglie`) + element già
   pubblicati esplicitamente su di esso — la stessa regola di poolForWith in
   backend/src/catalog.js, ricalcolata qui lato client sui dati già in STORE
   (stessa fonte di AP.store.usi, vedi buildUsi in store.js). */
function poolAttualeDelCanale(canaleId) {
  const ch = (AP.store.dati.canali || []).find((c) => c.id === canaleId);
  const famiglie = (ch?.famiglie || []).map((id) => AP.comp.conceptNomeById(id));
  const elementiPubblicati = (AP.store.dati.catalogo?.elements || [])
    .filter((e) => e.pubblicato && e.canale === canaleId)
    .map((e) => `${e.nome} (${AP.comp.conceptNomeById(e.famigliaNativa)})`);
  return { famiglie, elementiPubblicati };
}

function apriDialogoPubblica(run, dialogEl) {
  const canali = (AP.store.dati.canali || []).filter((c) => !c.storico);
  if (!canali.length) { toast("nessun canale attivo disponibile per la pubblicazione", "errore"); return; }
  if (!AP.store.dati.catalogo?.concepts?.length) { toast("catalogo non disponibile: impossibile pubblicare", "errore"); return; }
  renderDialogoPubblica(dialogEl, run, canali[0].id, canali);
}

function renderDialogoPubblica(dialogEl, run, canaleId, canali) {
  const conceptNome = AP.comp.conceptNomeById(run.concept);
  const elementNome = AP.comp.elementNomeById(run.element);
  const pool = poolAttualeDelCanale(canaleId);
  const opts = canali.map((c) => `<option value="${esc(c.id)}" ${c.id === canaleId ? "selected" : ""}>${esc(c.id)}</option>`).join("");
  dialogEl.innerHTML = `
    <div class="warnbox">
      <h4>Pubblicare "${esc(elementNome)}" in produzione?</h4>
      <div class="field" style="margin:10px 0"><label>canale</label><select data-role="canale">${opts}</select></div>
      <div class="hint" style="margin-bottom:8px">Da stasera il canale <b>${esc(canaleId)}</b> userà anche «${esc(conceptNome)} × ${esc(elementNome)}» nella rotazione settimanale.</div>
      <div class="hint" style="margin-bottom:4px">Pool attuale di <b>${esc(canaleId)}</b>:</div>
      <ul style="margin:0 0 12px;padding-left:18px;color:var(--dim);font-size:12.5px;line-height:1.6">
        <li>indole: ${pool.famiglie.length ? esc(pool.famiglie.join(", ")) : "nessuna (canale senza indole propria)"}</li>
        <li>element già pubblicati: ${pool.elementiPubblicati.length ? esc(pool.elementiPubblicati.join(", ")) : "nessuno ancora"}</li>
      </ul>
      <div class="hint labrun-dialog-status"></div>
      <div class="formactions">
        <button class="warn" data-act="pubOk">Conferma pubblicazione</button>
        <button class="ghost" data-act="pubAnnulla">Annulla</button>
      </div>
    </div>`;
  dialogEl.querySelector('[data-role="canale"]').onchange = (ev) => renderDialogoPubblica(dialogEl, run, ev.target.value, canali);
  dialogEl.querySelector('[data-act="pubAnnulla"]').onclick = () => { dialogEl.innerHTML = ""; };
  dialogEl.querySelector('[data-act="pubOk"]').onclick = () => confermaPubblica(run, canaleId, dialogEl);
}

async function confermaPubblica(run, canaleId, dialogEl) {
  const statusEl = dialogEl.querySelector(".labrun-dialog-status");
  if (!key()) { statusEl.textContent = "serve la chiave admin (campo in alto) per pubblicare"; $("key").focus(); return; }
  const full = AP.store.dati.catalogo?.elements.find((e) => e.id === run.element);
  if (!full) { statusEl.textContent = "element non trovato nel catalogo — ricarica e riprova."; return; }
  const body = {
    id: full.id, nome: full.nome, s: full.s || full.soggetto, soggetto: full.soggetto || full.s,
    setting: full.setting, style: full.style, palette: full.palette,
    famigliaNativa: run.concept, tappe: full.tappe ?? null, extra: full.extra ?? null,
    pubblicato: true, canale: canaleId,
  };
  const btn = dialogEl.querySelector('[data-act="pubOk"]');
  btn.disabled = true;
  statusEl.textContent = "pubblico…";
  try {
    await api("/catalogo/element", { method: "PUT", body: JSON.stringify(body) });
    statusEl.textContent = `pubblicato ✓ (canale ${canaleId})`;
    toast(`"${full.nome}" pubblicato su ${canaleId}`, "ok");
    dialogEl.innerHTML = "";
    await AP.store.carica();
    renderContesto(); // il pool/gli usi di questa coppia sono cambiati: il pannello di contesto lo riflette subito
  } catch (e) {
    toastErrore(e, "pubblicazione"); // errori[] del Worker campo per campo, via il toast unificato
    statusEl.textContent = errFromCatch(e).join(" · ");
    btn.disabled = false;
  }
}

/* ---------- reazioni agli eventi dello STORE ---------- */
function onDatiAggiornati() { fillLabSelectors(); renderContesto(); }
AP.store.on("catalogo", onDatiAggiornati);
AP.store.on("tuning", onDatiAggiornati);
// "usi" arriva a caricamento completo di TUTTI gli archivi (vedi store.js):
// solo allora archi/giudizi della coppia sono completi, non parziali.
AP.store.on("usi", renderContesto);

AP.tabs.lab = {
  // params.concept/element: chi arriva da un link esterno (il bottone "⚗ riprova
  // nel Lab" di un blocco-arco in Archivio, o un chip coppia) si aspetta i due
  // selettori GIÀ impostati sulla coppia di provenienza.
  onShow(params = {}) {
    fillLabSelectors();
    const cSel = $("labConcept"), eSel = $("labElement");
    if (params.concept && cSel && [...cSel.options].some((o) => o.value === params.concept)) {
      cSel.value = params.concept;
    }
    if (params.element && eSel && [...eSel.options].some((o) => o.value === params.element)) {
      eSel.value = params.element;
    }
    renderContesto();
    renderRunList();
  },
};
