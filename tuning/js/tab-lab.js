// TAB LAB: genera un arco di prova (concept × element, cancello on/off), propone
// range al Range tarati sui risultati, o pubblica la combinazione in produzione.
// I selettori pescano da AP.store.dati.catalogo (o dal fallback /tuning se il
// catalogo non è disponibile su un Worker più vecchio) invece delle liste
// hardcoded di un tempo.
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

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
}

$("labRun").onclick = async () => {
  if (!key()) return setStatus($("labStatus"), "serve la chiave admin");
  const c = $("labConcept").value, el = $("labElement").value;
  const days = $("labDays").value, gate = $("labGate").value;
  const nat = $("labElement").selectedOptions[0]?.dataset.nat;
  $("labStatus").innerHTML = `<span class="spinner"></span> genero ${c} × ${el}${nat !== c ? ' (combinazione libera)' : ''}…`;
  $("labRun").disabled = true;
  try {
    const res = await api(`/lab/arc?concept=${c}&element=${el}&days=${days}&gate=${gate}`, { method: "POST" });
    AP.comp.renderLab(res, el);
    setStatus($("labStatus"), `fatto: ${res.giorni.length} giorni${res.concept.virtuale ? ' · combinazione libera (tappe generiche)' : ''}`);
    // Storico persistente del run (localStorage): la UI che lo mostra arriva col
    // redesign del Lab (task 6) — qui si registra soltanto perché nel frattempo
    // non vada perso cambiando tab o ricaricando la pagina.
    AP.store.labRuns.add({
      concept: c, element: el, days: Number(days), gate: gate === "1",
      runId: res.runId, giorni: res.giorni, rispostaConcept: res.concept,
    });
  } catch (e) {
    setStatus($("labStatus"), "errore: " + e.message);
    toastErrore(e, "generazione arco di prova");
  }
  $("labRun").disabled = false;
};

/* prende le misure dei giorni (esclude il keyframe) e propone [min,max] con
   margine, scrivendo direttamente in AP.store.edit — la stessa copia di lavoro
   che la tab Range mostra e lancia. */
function proposeRange(res) {
  const id = res.concept.schema;
  if (!AP.store.edit[id]) return alert('concept non in tabella (apri prima la tab "Range per concept" e ricarica)');
  const giorni = res.giorni.filter((g) => g.misure);
  for (const k of AP.comp.MEAS) {
    const vals = giorni.map((g) => g.misure[k]).filter((v) => v != null).sort((a, b) => a - b);
    if (!vals.length) continue;
    const lo = vals[0], hi = vals[vals.length - 1];
    const margine = k === "compattezza" ? 0.05 : Math.max(1, (hi - lo) * 0.15);
    AP.store.edit[id][k] = [
      Math.max(0, +(lo - margine).toFixed(k === "compattezza" ? 2 : 1)),
      +(hi + margine).toFixed(k === "compattezza" ? 2 : 1),
    ];
  }
  setStatus($("rangeStatus"), `proposti i range di ${id} dai risultati del lab (non ancora lanciati)`, "changed");
  AP.util.route.vai("range"); // il cambio di hash fa comparire la tab Range, che si ridisegna da sola leggendo AP.store.edit
}

/* "Pubblica questa combinazione": salva l'element provato con pubblicato:true e
   famigliaNativa = il concept appena testato. È il ponte fra "ho provato una
   cosa bella nel lab" e "è nel pool di produzione del sito". */
function showPublishPanel(res) {
  const elId = $("labElement").value;
  const conceptId = res.concept.schema;
  const panel = $("publishPanel");
  const canaliOpts = (AP.store.dati.canali || []).filter((c) => !c.storico)
    .map((c) => `<option value="${esc(c.id)}">${esc(c.id)}</option>`).join("");
  panel.innerHTML = `
    <div class="card" style="max-width:440px;margin-top:6px">
      <h3 style="margin-bottom:8px">Pubblica "${esc(elementNomeById(elId))}"</h3>
      <div class="hint" style="margin-bottom:12px">
        Salva questo element con <code>pubblicato:true</code> e concept nativo = <code>${esc(conceptId)}</code>
        (quello appena provato). Da quel momento la combinazione entra nel pool di produzione del canale scelto.
      </div>
      <div class="field"><label>canale</label>
        <select id="pubCanale">${canaliOpts}</select>
      </div>
      <div id="pubErrors"></div>
      <div class="formactions">
        <button id="pubConfirm" class="primary">Conferma pubblicazione</button>
        <span class="status" id="pubStatus"></span>
      </div>
    </div>`;
  $("pubConfirm").onclick = () => confirmPublish(elId, conceptId);
}

async function confirmPublish(elId, conceptId) {
  if (!key()) return setStatus($("pubStatus"), "serve la chiave admin");
  const canale = $("pubCanale").value;
  const full = AP.store.dati.catalogo?.elements.find((e) => e.id === elId);
  if (!full) { $("pubErrors").innerHTML = `<div class="errbox">element non trovato nel catalogo — ricarica il catalogo e riprova.</div>`; return; }
  const body = {
    id: full.id, nome: full.nome, s: full.s || full.soggetto, soggetto: full.soggetto || full.s,
    setting: full.setting, style: full.style, palette: full.palette,
    famigliaNativa: conceptId, tappe: full.tappe ?? null, extra: full.extra ?? null,
    pubblicato: true, canale,
  };
  try {
    setStatus($("pubStatus"), "pubblico…");
    await api("/catalogo/element", { method: "PUT", body: JSON.stringify(body) });
    setStatus($("pubStatus"), `pubblicato ✓ (canale ${canale})`);
    toast(`"${full.nome}" pubblicato su ${canale}`, "ok");
    await AP.store.carica();
  } catch (e) {
    $("pubErrors").innerHTML = `<div class="errbox"><b>Il Worker segnala:</b><ul>${errFromCatch(e).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    setStatus($("pubStatus"), "");
  }
}

/* ---------- reazioni agli eventi dello STORE ---------- */
AP.store.on("catalogo", fillLabSelectors);
AP.store.on("tuning", fillLabSelectors);

AP.tabs.lab = {
  // params.concept/element: chi arriva da un link esterno (il bottone "⚗ riprova
  // nel Lab" di un blocco-arco in Archivio, o un chip coppia — vedi DESIGN.md,
  // "1. Archivio" e criterio di accettazione 3) si aspetta i due selettori GIÀ
  // impostati sulla coppia di provenienza, non un Lab vuoto da ricompilare a
  // mano. Il pannello "Questa coppia finora" arriva col redesign del Lab (task
  // 7): qui, in questo task, si preseleziona soltanto.
  onShow(params = {}) {
    fillLabSelectors();
    const cSel = $("labConcept"), eSel = $("labElement");
    if (params.concept && cSel && [...cSel.options].some((o) => o.value === params.concept)) {
      cSel.value = params.concept;
    }
    if (params.element && eSel && [...eSel.options].some((o) => o.value === params.element)) {
      eSel.value = params.element;
    }
  },
};
