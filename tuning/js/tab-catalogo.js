// TAB CONCEPT + TAB ELEMENT: due sezioni distinte in questo file (la fusione in
// un'unica tab "Catalogo" è il redesign del task 8, non questo). Leggono/scrivono
// il catalogo utente (concept ed element custom) tramite AP.store.dati.catalogo;
// la lista dei canali attivi (per il campo "canale" dell'element) viene da
// AP.store.dati.canali — non più dalla vecchia costante CANALI scritta a mano.
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
let CATALOGO_ERROR = null; // messaggio se /catalogo non risponde (Worker più vecchio)
// AP.store.dati.catalogo parte già valorizzato con {concepts:[],elements:[]} (mai
// null, vedi store.js): un array vuoto è "vero" in JS, quindi senza questo flag
// non sapremmo distinguere "non ancora arrivato" da "arrivato e genuinamente vuoto".
let catalogoArrivato = false;

/* validazione lato client — rispecchia le regole del Worker per dare un riscontro
   immediato; il Worker resta comunque l'autorità finale (i suoi errori, se
   arrivano, si aggiungono a questi). */
function idAlreadyTaken(id, isNew, items) {
  if (!isNew || !id) return false;
  return Array.isArray(items) && items.some((it) => it.id === id);
}
function showIdFieldError(inputEl, errEl, msg) {
  if (inputEl) inputEl.classList.toggle("invalid", !!msg);
  if (errEl) { errEl.textContent = msg || ""; errEl.style.display = msg ? "" : "none"; }
}
function readNum(el, errs, label) {
  const v = parseFloat(el.value);
  if (!Number.isFinite(v)) { el.classList.add("invalid"); errs.push(`${label}: numero non valido`); return 0; }
  el.classList.remove("invalid");
  return v;
}
function readOptionalNum(el, errs, label) {
  const raw = el.value.trim();
  if (raw === "") { el.classList.remove("invalid"); return null; }
  const v = strictNumber(raw);
  if (!Number.isFinite(v)) {
    el.classList.add("invalid");
    errs.push(`${label}: "${raw}" non è un numero valido (lascia il campo vuoto per usare la guardia di default)`);
    return null;
  }
  el.classList.remove("invalid");
  return v;
}

function canaliAttiviOptions(selezionato) {
  return (AP.store.dati.canali || []).filter((c) => !c.storico)
    .map((c) => `<option value="${esc(c.id)}" ${c.id === selezionato ? 'selected' : ''}>${esc(c.id)}</option>`).join("");
}

/* dopo una scrittura riuscita conviene ricaricare l'intero STORE: il catalogo
   incide sull'indice degli usi (concept/element "in produzione") e sui menu del
   Lab, non solo sulle liste di questa tab. */
async function ricaricaDopoScrittura() { await AP.store.carica(); }

/* ================================================================== */
/* ---------- TAB CONCEPT ---------- */
/* ================================================================== */
let conceptSel = null;    // id del concept selezionato in lista (null = nessuna selezione)
let conceptForm = null;   // stato in edit: null finché non si sceglie/crea qualcosa
let conceptIsNew = false;

function renderConceptList() {
  const wrap = $("conceptList");
  const cat = AP.store.dati.catalogo;
  if (CATALOGO_ERROR) { wrap.innerHTML = `<div class="hint">${esc(CATALOGO_ERROR)}</div>`; return; }
  if (!catalogoArrivato) { wrap.innerHTML = `<div class="hint">catalogo non ancora caricato.</div>`; return; }
  wrap.innerHTML = "";
  const items = [...cat.concepts].sort((a, b) => (a.custom === b.custom ? 0 : a.custom ? 1 : -1) || a.nome.localeCompare(b.nome));
  for (const c of items) {
    const row = document.createElement("div");
    row.className = "itemrow" + (c.id === conceptSel ? " active" : "");
    row.innerHTML = `<span>${esc(c.nome)}<br><code>${esc(c.id)}</code></span>
      <span class="badges"><span class="badge ${c.custom ? 'custom' : ''}">${c.custom ? 'custom' : 'built-in'}</span></span>`;
    row.onclick = () => selectConcept(c.id);
    wrap.appendChild(row);
  }
  if (!items.length) wrap.innerHTML = `<div class="hint">nessun concept nel catalogo.</div>`;
}

function selectConcept(id) {
  const c = AP.store.dati.catalogo?.concepts.find((x) => x.id === id);
  if (!c) return;
  conceptSel = id;
  conceptIsNew = false;
  conceptForm = deepClone(c);
  renderConceptList();
  renderConceptForm();
}

function newConcept() {
  conceptSel = null;
  conceptIsNew = true;
  conceptForm = {
    id: "", nome: "", custom: true, conserva: "",
    tappe: Array.from({ length: 7 }, () => [""]),
    extra: [],
    profilo: { estensione: [7, 28], intensita: [9, 26], compattezza: [0.4, 0.85], monotona: true },
    maxDeriva: null, maxDegrado: null,
  };
  renderConceptList();
  renderConceptForm();
}

function duplicateConcept() {
  if (!conceptForm) return alert("Seleziona prima un concept dalla lista da usare come base.");
  const base = deepClone(conceptForm);
  base.id = "";
  base.nome = (base.nome || "") + " (copia)";
  base.custom = true;
  conceptSel = null;
  conceptIsNew = true;
  conceptForm = base;
  renderConceptList();
  renderConceptForm();
}

function renderConceptForm() {
  const box = $("conceptForm");
  if (!conceptForm) {
    box.innerHTML = `<div class="hint">Seleziona un concept dalla lista per vederne i dettagli, crea un "Nuovo" concept da zero,
      oppure seleziona un built-in e premi "Duplica" per partire da uno schema già scritto.</div>`;
    return;
  }
  const f = conceptForm;
  const readOnly = !conceptIsNew && !f.custom; // built-in esistente: sola lettura
  const idLocked = !conceptIsNew;              // id modificabile solo alla creazione
  const dis = readOnly ? "disabled" : "";
  const idDis = (readOnly || idLocked) ? "disabled" : "";

  box.innerHTML = `
    ${readOnly ? `<div class="readonly-banner">Questo è un concept <b>built-in</b>, scritto nel codice: è di sola lettura qui.
      Usa "Duplica" per crearne una tua versione modificabile.</div>` : ""}
    <div id="conceptErrors"></div>
    <div class="field">
      <label>id ${idLocked ? '<span class="lock">(non modificabile dopo la creazione)</span>' : ''}</label>
      <input type="text" id="f-c-id" value="${esc(f.id)}" ${idDis} placeholder="es. spirale" />
      ${idLocked ? "" : `<div class="help">minuscolo, solo lettere/numeri/- /_, 2-32 caratteri. Non deve coincidere con un concept già esistente.</div>
      <div class="help" id="f-c-idErr" style="color:var(--bad);display:none"></div>`}
    </div>
    <div class="field">
      <label>nome</label>
      <input type="text" id="f-c-nome" value="${esc(f.nome)}" ${dis} maxlength="40" placeholder="es. Spirale" />
    </div>
    <div class="field">
      <label>conserva</label>
      <input type="text" id="f-c-conserva" value="${esc(f.conserva || '')}" ${dis} maxlength="300"
        placeholder="the pot, the background and the light" />
      <div class="help">In inglese: cosa NON deve mai cambiare nell'immagine durante l'arco — è la frase che tiene ferma
        la scena per il modello immagine, ad ogni tappa.</div>
    </div>
    <div class="field">
      <label>le 7 tappe</label>
      <div class="help">Ogni tappa è una fase dell'evoluzione: scrivi 1-3 frasi alternative (una per riga), il
        generatore ne sceglie una a caso quando l'arco raggiunge quel giorno.</div>
      <div class="tappe-grid">
        ${f.tappe.map((righe, i) => `
          <div class="tappa-row">
            <label>tappa ${i + 1}</label>
            <textarea data-tappa="${i}" ${dis} placeholder="una frase per riga, max 3">${esc((righe || []).join("\n"))}</textarea>
          </div>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>extra (facoltative, 0-6)</label>
      <textarea id="f-c-extra" ${dis} placeholder="una frase per riga">${esc((f.extra || []).join("\n"))}</textarea>
      <div class="help">Frasi aggiuntive usate come varianti extra oltre alle tappe, una per riga.</div>
    </div>
    <div class="field">
      <label>range: estensione %</label>
      <div class="range">
        <input type="number" id="f-c-est-0" value="${f.profilo.estensione[0]}" ${dis} step="1" min="0" max="100"/>
        <span class="sep">→</span>
        <input type="number" id="f-c-est-1" value="${f.profilo.estensione[1]}" ${dis} step="1" min="0" max="100"/>
        <span class="def">quanta parte dell'immagine cambia</span>
      </div>
    </div>
    <div class="field">
      <label>range: intensità</label>
      <div class="range">
        <input type="number" id="f-c-int-0" value="${f.profilo.intensita[0]}" ${dis} step="1" min="0" max="100"/>
        <span class="sep">→</span>
        <input type="number" id="f-c-int-1" value="${f.profilo.intensita[1]}" ${dis} step="1" min="0" max="100"/>
        <span class="def">quanto è marcato il cambiamento</span>
      </div>
    </div>
    <div class="field">
      <label>range: compattezza</label>
      <div class="range">
        <input type="number" id="f-c-cmp-0" value="${f.profilo.compattezza[0]}" ${dis} step="0.01" min="0" max="1"/>
        <span class="sep">→</span>
        <input type="number" id="f-c-cmp-1" value="${f.profilo.compattezza[1]}" ${dis} step="0.01" min="0" max="1"/>
        <span class="def">evento localizzato ↔ diffuso</span>
      </div>
    </div>
    <div class="flags">
      <label><input type="checkbox" id="f-c-mono" ${f.profilo.monotona ? 'checked' : ''} ${dis}/> monotona (la scena non torna indietro)</label>
      <label>maxDeriva <input type="text" inputmode="decimal" id="f-c-maxd" value="${f.maxDeriva ?? ''}" placeholder="auto" style="width:64px;text-align:right" ${dis}/></label>
      <label>maxDegrado <input type="text" inputmode="decimal" id="f-c-maxg" value="${f.maxDegrado ?? ''}" placeholder="auto" style="width:64px;text-align:right" ${dis}/></label>
    </div>
    ${readOnly ? "" : `
    <div class="formactions">
      <button id="conceptSave" class="primary">💾 Salva nel Worker</button>
      ${(!conceptIsNew && f.custom) ? '<button id="conceptDelete" class="ghost">🗑 Elimina</button>' : ""}
      <span class="status" id="conceptFormStatus"></span>
    </div>`}
  `;
  if (!readOnly) {
    $("conceptSave").onclick = saveConcept;
    const del = $("conceptDelete"); if (del) del.onclick = deleteConcept;
    // in creazione: appena l'utente ritocca l'id, l'eventuale segnalazione "id già
    // esistente" non è più detto che valga ancora — la si toglie e si rifà il
    // controllo vero al prossimo tentativo di salvataggio.
    if (conceptIsNew) $("f-c-id").oninput = () => showIdFieldError($("f-c-id"), $("f-c-idErr"), "");
  }
}

function showConceptErrors(list) {
  $("conceptErrors").innerHTML = list.length
    ? `<div class="errbox"><b>Il Worker segnala:</b><ul>${list.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
}

function validateConceptLocal(b) {
  const errs = [];
  if (!ID_RE.test(b.id)) errs.push("id: minuscolo, lettere/numeri/-/_, 2-32 caratteri, non iniziare con - o _");
  if (!b.nome || b.nome.length > 40) errs.push("nome: obbligatorio, 1-40 caratteri");
  if (!b.conserva || b.conserva.length > 300) errs.push("conserva: obbligatorio, max 300 caratteri");
  if (!Array.isArray(b.tappe) || b.tappe.length !== 7) errs.push("tappe: servono esattamente 7 tappe");
  else b.tappe.forEach((righe, i) => {
    if (!righe.length || righe.length > 3) errs.push(`tappa ${i + 1}: serve 1-3 frasi`);
    if (righe.some((r) => r.length > 400)) errs.push(`tappa ${i + 1}: una frase supera i 400 caratteri`);
  });
  if (b.extra.length > 6) errs.push("extra: massimo 6 frasi");
  if (b.extra.some((r) => r.length > 400)) errs.push("extra: una frase supera i 400 caratteri");
  const [elo, ehi] = b.profilo.estensione;
  if (!(elo >= 0 && ehi <= 100 && elo <= ehi)) errs.push("estensione: range non valido (0-100, min ≤ max)");
  const [ilo, ihi] = b.profilo.intensita;
  if (!(ilo >= 0 && ihi <= 100 && ilo <= ihi)) errs.push("intensità: range non valido (0-100, min ≤ max)");
  const [clo, chi] = b.profilo.compattezza;
  if (!(clo >= 0 && chi <= 1 && clo <= chi)) errs.push("compattezza: range non valido (0-1, min ≤ max)");
  return errs;
}

async function saveConcept() {
  if (!key()) return setStatus($("conceptFormStatus"), "serve la chiave admin");
  const idInput = $("f-c-id");
  const id = idInput.value.trim();

  const allIds = AP.store.dati.catalogo ? [...AP.store.dati.catalogo.concepts] : [];
  if (idAlreadyTaken(id, conceptIsNew, allIds)) {
    showIdFieldError(idInput, $("f-c-idErr"),
      `esiste già un concept con id "${id}" — scegli un id diverso, oppure apri quello esistente dalla lista per modificarlo.`);
    return;
  }
  showIdFieldError(idInput, $("f-c-idErr"), "");

  const errs = [];
  const nome = $("f-c-nome").value.trim();
  const conserva = $("f-c-conserva").value.trim();
  const tappe = [...document.querySelectorAll('[data-tappa]')]
    .sort((a, b) => +a.dataset.tappa - +b.dataset.tappa)
    .map((ta) => ta.value.split("\n").map((s) => s.trim()).filter(Boolean));
  const extra = $("f-c-extra").value.split("\n").map((s) => s.trim()).filter(Boolean);
  const profilo = {
    estensione: [readNum($("f-c-est-0"), errs, "estensione min"), readNum($("f-c-est-1"), errs, "estensione max")],
    intensita: [readNum($("f-c-int-0"), errs, "intensità min"), readNum($("f-c-int-1"), errs, "intensità max")],
    compattezza: [readNum($("f-c-cmp-0"), errs, "compattezza min"), readNum($("f-c-cmp-1"), errs, "compattezza max")],
    monotona: $("f-c-mono").checked,
  };
  const maxDeriva = readOptionalNum($("f-c-maxd"), errs, "maxDeriva");
  const maxDegrado = readOptionalNum($("f-c-maxg"), errs, "maxDegrado");
  if (errs.length) return showConceptErrors(errs);

  const body = { id, nome, conserva, tappe, extra, profilo, maxDeriva, maxDegrado, soloSeNuovo: conceptIsNew };
  const localErrs = validateConceptLocal(body);
  if (localErrs.length) return showConceptErrors(localErrs);

  try {
    setStatus($("conceptFormStatus"), "salvo…");
    showConceptErrors([]);
    const res = await api("/catalogo/concept", { method: "PUT", body: JSON.stringify(body) });
    setStatus($("conceptFormStatus"), "salvato ✓");
    toast(`concept "${nome}" salvato`, "ok");
    conceptIsNew = false;
    const savedId = res.id || id;
    await ricaricaDopoScrittura();
    selectConcept(savedId);
  } catch (e) {
    showConceptErrors(errFromCatch(e));
    setStatus($("conceptFormStatus"), "");
    toastErrore(e, "salvataggio concept");
  }
}

async function deleteConcept() {
  if (!key()) return setStatus($("conceptFormStatus"), "serve la chiave admin");
  if (!conceptForm || !conceptForm.id) return;
  if (!confirm(`Eliminare il concept "${conceptForm.nome}"? Se qualche element lo usa come nativo, il Worker rifiuterà.`)) return;
  try {
    setStatus($("conceptFormStatus"), "elimino…");
    await api(`/catalogo/concept?id=${encodeURIComponent(conceptForm.id)}`, { method: "DELETE" });
    conceptForm = null; conceptSel = null;
    await ricaricaDopoScrittura();
    renderConceptForm();
  } catch (e) {
    showConceptErrors(errFromCatch(e));
    setStatus($("conceptFormStatus"), "");
  }
}

$("conceptNew").onclick = newConcept;
$("conceptDup").onclick = duplicateConcept;
$("conceptReload").onclick = () => AP.store.carica();

/* ================================================================== */
/* ---------- TAB ELEMENT ---------- */
/* ================================================================== */
let elementSel = null;
let elementForm = null;
let elementIsNew = false;

function renderElementList() {
  const wrap = $("elementList");
  const cat = AP.store.dati.catalogo;
  if (CATALOGO_ERROR) { wrap.innerHTML = `<div class="hint">${esc(CATALOGO_ERROR)}</div>`; return; }
  if (!catalogoArrivato) { wrap.innerHTML = `<div class="hint">catalogo non ancora caricato.</div>`; return; }
  wrap.innerHTML = "";
  const items = [...cat.elements].sort((a, b) => (a.custom === b.custom ? 0 : a.custom ? 1 : -1) || a.nome.localeCompare(b.nome));
  for (const e of items) {
    const row = document.createElement("div");
    row.className = "itemrow" + (e.id === elementSel ? " active" : "");
    row.innerHTML = `<span>${esc(e.nome)}<br><code>${esc(e.id)}</code></span>
      <span class="badges">
        <span class="badge ${e.custom ? 'custom' : ''}">${e.custom ? 'custom' : 'built-in'}</span>
        ${e.pubblicato ? `<span class="badge pub">${esc(e.canale || 'pubblicato')}</span>` : ''}
      </span>`;
    row.onclick = () => selectElement(e.id);
    wrap.appendChild(row);
  }
  if (!items.length) wrap.innerHTML = `<div class="hint">nessun element nel catalogo.</div>`;
}

function selectElement(id) {
  const e = AP.store.dati.catalogo?.elements.find((x) => x.id === id);
  if (!e) return;
  elementSel = id;
  elementIsNew = false;
  elementForm = deepClone(e);
  renderElementList();
  renderElementForm();
}

function newElement() {
  elementSel = null;
  elementIsNew = true;
  elementForm = {
    id: "", nome: "", custom: true, s: "", soggetto: "",
    setting: "", style: "", palette: "",
    famigliaNativa: AP.store.dati.catalogo?.concepts?.[0]?.id || "",
    tappe: null, extra: null, pubblicato: false, canale: null,
  };
  renderElementList();
  renderElementForm();
}

function duplicateElement() {
  if (!elementForm) return alert("Seleziona prima un element dalla lista da usare come base.");
  const base = deepClone(elementForm);
  base.id = "";
  base.nome = (base.nome || "") + " (copia)";
  base.custom = true;
  base.pubblicato = false;
  base.canale = null;
  elementSel = null;
  elementIsNew = true;
  elementForm = base;
  renderElementList();
  renderElementForm();
}

function renderElementForm() {
  const box = $("elementForm");
  if (!elementForm) {
    box.innerHTML = `<div class="hint">Seleziona un element dalla lista per vederne i dettagli, crea un "Nuovo" element da zero,
      oppure seleziona un built-in e premi "Duplica" per partire da un soggetto già scritto.</div>`;
    return;
  }
  const f = elementForm;
  const readOnly = !elementIsNew && !f.custom;
  const idLocked = !elementIsNew;
  const dis = readOnly ? "disabled" : "";
  const idDis = (readOnly || idLocked) ? "disabled" : "";
  const conceptOptions = (AP.store.dati.catalogo?.concepts || [])
    .map((c) => `<option value="${esc(c.id)}" ${c.id === f.famigliaNativa ? 'selected' : ''}>${esc(c.nome)}${c.custom ? ' · custom' : ''}</option>`)
    .join("");
  const tappeVal = (f.tappe && f.tappe.length === 7) ? f.tappe : Array.from({ length: 7 }, () => []);
  const canaliOpts = canaliAttiviOptions(f.canale);
  const nativeConceptNome = (AP.store.dati.catalogo?.concepts || []).find((c) => c.id === f.famigliaNativa)?.nome || f.famigliaNativa;
  const coppiaHTML = (f.famigliaNativa && f.id)
    ? `<div class="hint" style="font-size:13px;color:var(--text);margin-bottom:12px">${coppiaLabelHTML(nativeConceptNome, f.famigliaNativa, f.nome, f.id, true)}</div>`
    : "";

  box.innerHTML = `
    ${readOnly ? `<div class="readonly-banner">Questo è un element <b>built-in</b>, scritto nel codice: è di sola lettura qui.
      Usa "Duplica" per crearne una tua versione modificabile.</div>` : ""}
    ${coppiaHTML}
    <div id="elementErrors"></div>
    <div class="field">
      <label>id ${idLocked ? '<span class="lock">(non modificabile dopo la creazione)</span>' : ''}</label>
      <input type="text" id="f-e-id" value="${esc(f.id)}" ${idDis} placeholder="es. faro" />
      ${idLocked ? "" : `<div class="help">minuscolo, solo lettere/numeri/- /_, 2-32 caratteri. Non deve coincidere con un element già esistente.</div>
      <div class="help" id="f-e-idErr" style="color:var(--bad);display:none"></div>`}
    </div>
    <div class="field"><label>nome</label>
      <input type="text" id="f-e-nome" value="${esc(f.nome)}" ${dis} maxlength="40" placeholder="es. Faro" /></div>
    <div class="field"><label>soggetto inglese (s)</label>
      <input type="text" id="f-e-s" value="${esc(f.s || f.soggetto || '')}" ${dis} maxlength="120" placeholder="the lighthouse" />
      <div class="help">Come viene nominato nei prompt in inglese, es. "the sunflower". Risolve i posti dove le frasi
        del concept usano <code>{s}</code>.</div></div>
    <div class="field"><label>setting</label>
      <textarea id="f-e-setting" ${dis} maxlength="400" placeholder="dove si trova, il contesto della scena">${esc(f.setting || '')}</textarea></div>
    <div class="field"><label>style</label>
      <textarea id="f-e-style" ${dis} maxlength="400" placeholder="stile visivo/artistico">${esc(f.style || '')}</textarea></div>
    <div class="field"><label>palette</label>
      <textarea id="f-e-palette" ${dis} maxlength="400" placeholder="colori dominanti">${esc(f.palette || '')}</textarea></div>
    <div class="field"><label>concept nativo</label>
      <select id="f-e-fam" ${dis}>${conceptOptions}</select>
      <div class="help">Lo schema di evoluzione che questo soggetto segue di default (usato anche quando le
        tappe qui sotto sono vuote).</div></div>
    <div class="field">
      <label>tappe dedicate (facoltative)</label>
      <div class="help">Lascia tutte le 7 vuote per ereditare le tappe del concept nativo. Se ne compili anche
        solo una, andranno compilate tutte e 7 — una frase per riga, 1-3 righe.</div>
      <div class="tappe-grid">
        ${tappeVal.map((righe, i) => `
          <div class="tappa-row">
            <label>tappa ${i + 1}</label>
            <textarea data-etappa="${i}" ${dis} placeholder="vuoto = eredita dal concept">${esc((righe || []).join("\n"))}</textarea>
          </div>`).join("")}
      </div>
    </div>
    <div class="field"><label>extra dedicate (facoltative)</label>
      <textarea id="f-e-extra" ${dis} placeholder="vuoto = eredita dal concept">${esc((f.extra || []).join("\n"))}</textarea>
      <div class="help">Vuoto = eredita gli extra del concept nativo.</div></div>
    <div class="flags">
      <label><input type="checkbox" id="f-e-pub" ${f.pubblicato ? 'checked' : ''} ${dis}/> pubblicato sul sito</label>
      <label>canale <select id="f-e-canale" ${dis || (!f.pubblicato ? 'disabled' : '')}>
        <option value="">—</option>${canaliOpts}</select></label>
    </div>
    ${readOnly ? "" : `
    <div class="formactions">
      <button id="elementSave" class="primary">💾 Salva nel Worker</button>
      ${(!elementIsNew && f.custom) ? '<button id="elementDelete" class="ghost">🗑 Elimina</button>' : ""}
      <span class="status" id="elementFormStatus"></span>
    </div>`}
  `;
  if (!readOnly) {
    $("elementSave").onclick = saveElement;
    const del = $("elementDelete"); if (del) del.onclick = deleteElement;
    $("f-e-pub").onchange = (ev) => { $("f-e-canale").disabled = !ev.target.checked; };
    if (elementIsNew) $("f-e-id").oninput = () => showIdFieldError($("f-e-id"), $("f-e-idErr"), "");
  }
}

function showElementErrors(list) {
  $("elementErrors").innerHTML = list.length
    ? `<div class="errbox"><b>Il Worker segnala:</b><ul>${list.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : "";
}

function validateElementLocal(b) {
  const errs = [];
  if (!ID_RE.test(b.id)) errs.push("id: minuscolo, lettere/numeri/-/_, 2-32 caratteri, non iniziare con - o _");
  if (!b.nome || b.nome.length > 40) errs.push("nome: obbligatorio, 1-40 caratteri");
  if (!b.s || b.s.length > 120) errs.push("soggetto (s): obbligatorio, max 120 caratteri");
  if (!b.setting || b.setting.length > 400) errs.push("setting: obbligatorio, max 400 caratteri");
  if (!b.style || b.style.length > 400) errs.push("style: obbligatorio, max 400 caratteri");
  if (!b.palette || b.palette.length > 400) errs.push("palette: obbligatorio, max 400 caratteri");
  if (!b.famigliaNativa) errs.push("concept nativo: obbligatorio");
  if (b.tappe) {
    if (b.tappe.length !== 7) errs.push("tappe dedicate: se le compili servono esattamente 7 tappe");
    else b.tappe.forEach((righe, i) => { if (!righe.length || righe.length > 3) errs.push(`tappa ${i + 1}: serve 1-3 frasi`); });
  }
  if (b.extra && b.extra.length > 6) errs.push("extra dedicate: massimo 6 frasi");
  if (b.pubblicato && !b.canale) errs.push("canale: obbligatorio se l'element è pubblicato");
  return errs;
}

async function saveElement() {
  if (!key()) return setStatus($("elementFormStatus"), "serve la chiave admin");
  const idInput = $("f-e-id");
  const id = idInput.value.trim();

  const allIds = AP.store.dati.catalogo ? [...AP.store.dati.catalogo.elements] : [];
  if (idAlreadyTaken(id, elementIsNew, allIds)) {
    showIdFieldError(idInput, $("f-e-idErr"),
      `esiste già un element con id "${id}" — scegli un id diverso, oppure apri quello esistente dalla lista per modificarlo.`);
    return;
  }
  showIdFieldError(idInput, $("f-e-idErr"), "");

  const nome = $("f-e-nome").value.trim();
  const s = $("f-e-s").value.trim();
  const setting = $("f-e-setting").value.trim();
  const style = $("f-e-style").value.trim();
  const palette = $("f-e-palette").value.trim();
  const famigliaNativa = $("f-e-fam").value;
  const tappeRaw = [...document.querySelectorAll('[data-etappa]')]
    .sort((a, b) => +a.dataset.etappa - +b.dataset.etappa)
    .map((ta) => ta.value.split("\n").map((s) => s.trim()).filter(Boolean));
  const tappe = tappeRaw.some((r) => r.length) ? tappeRaw : null;
  const extraRaw = $("f-e-extra").value.split("\n").map((s) => s.trim()).filter(Boolean);
  const extra = extraRaw.length ? extraRaw : null;
  const pubblicato = $("f-e-pub").checked;
  const canale = pubblicato ? ($("f-e-canale").value || null) : null;

  const body = { id, nome, s, soggetto: s, setting, style, palette, famigliaNativa, tappe, extra, pubblicato, canale, soloSeNuovo: elementIsNew };
  const localErrs = validateElementLocal(body);
  if (localErrs.length) return showElementErrors(localErrs);

  try {
    setStatus($("elementFormStatus"), "salvo…");
    showElementErrors([]);
    const res = await api("/catalogo/element", { method: "PUT", body: JSON.stringify(body) });
    setStatus($("elementFormStatus"), "salvato ✓");
    toast(`element "${nome}" salvato`, "ok");
    elementIsNew = false;
    const savedId = res.id || id;
    await ricaricaDopoScrittura();
    selectElement(savedId);
  } catch (e) {
    showElementErrors(errFromCatch(e));
    setStatus($("elementFormStatus"), "");
    toastErrore(e, "salvataggio element");
  }
}

async function deleteElement() {
  if (!key()) return setStatus($("elementFormStatus"), "serve la chiave admin");
  if (!elementForm || !elementForm.id) return;
  if (!confirm(`Eliminare l'element "${elementForm.nome}"?`)) return;
  try {
    setStatus($("elementFormStatus"), "elimino…");
    await api(`/catalogo/element?id=${encodeURIComponent(elementForm.id)}`, { method: "DELETE" });
    elementForm = null; elementSel = null;
    await ricaricaDopoScrittura();
    renderElementForm();
  } catch (e) {
    showElementErrors(errFromCatch(e));
    setStatus($("elementFormStatus"), "");
  }
}

$("elementNew").onclick = newElement;
$("elementDup").onclick = duplicateElement;
$("elementReload").onclick = () => AP.store.carica();

/* ---------- reazioni agli eventi dello STORE ---------- */
AP.store.on("catalogo", () => {
  CATALOGO_ERROR = null;
  catalogoArrivato = true;
  const cat = AP.store.dati.catalogo;
  setStatus($("conceptStatus"), `caricato · ${cat.concepts.length} concept (${cat.concepts.filter((c) => c.custom).length} custom)`);
  setStatus($("elementStatus"), `caricato · ${cat.elements.length} element (${cat.elements.filter((e) => e.custom).length} custom)`);
  renderConceptList();
  renderElementList();
  // se la selezione corrente si riferisce a un item sparito (es. eliminato da
  // un'altra scheda), il form torna al placeholder invece di mostrare dati stantii.
  if (conceptSel && !cat.concepts.some((c) => c.id === conceptSel)) { conceptSel = null; conceptForm = null; renderConceptForm(); }
  if (elementSel && !cat.elements.some((e) => e.id === elementSel)) { elementSel = null; elementForm = null; renderElementForm(); }
});
AP.store.on("errore", (info) => {
  if (info.sezione === "catalogo") {
    CATALOGO_ERROR = `questo Worker non espone ancora /catalogo: aggiornalo per creare concept ed element. `
      + `(dettaglio: ${info.errore.message}) — Range e Lab restano comunque usabili nel frattempo.`;
    setStatus($("conceptStatus"), CATALOGO_ERROR);
    setStatus($("elementStatus"), CATALOGO_ERROR);
    renderConceptList();
    renderElementList();
  }
});
AP.store.on("canali", () => {
  // i canali attivi alimentano il <select> "canale" dell'element pubblicato: se
  // arrivano DOPO il catalogo, il form va ridisegnato per mostrarli.
  if (elementForm) renderElementForm();
});

AP.tabs.catalogo = {
  concept: { onShow() { renderConceptList(); renderConceptForm(); } },
  element: { onShow() { renderElementList(); renderElementForm(); } },
};
