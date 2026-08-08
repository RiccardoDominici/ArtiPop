// TAB CATALOGO: fonde le vecchie tab Concept ed Element in un'unica vista
// (DESIGN.md, "3. Catalogo") — selettore Concept|Element sopra una sola
// colonna lista a sinistra, form di modifica a destra. I form (validazione,
// campi, salvataggio) sono quelli di sempre, invariati: qui cambia solo
// l'orchestrazione attorno a loro (quale tipo è attivo, cosa mostra la lista,
// il pannello "Dove è usato" in testa al form). Leggono/scrivono il catalogo
// utente (concept ed element custom) tramite AP.store.dati.catalogo; la lista
// dei canali attivi (per il campo "canale" dell'element) viene da
// AP.store.dati.canali — non più dalla vecchia costante CANALI scritta a mano.
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;
let CATALOGO_ERROR = null; // messaggio se /catalogo non risponde (Worker più vecchio)
// AP.store.dati.catalogo parte già valorizzato con {concepts:[],elements:[]} (mai
// null, vedi store.js): un array vuoto è "vero" in JS, quindi senza questo flag
// non sapremmo distinguere "non ancora arrivato" da "arrivato e genuinamente vuoto".
let catalogoArrivato = false;

/* ---------- quale metà del catalogo è attiva ----------
   Unica sorgente di verità per "cosa mostra la lista/il form adesso": letta e
   scritta insieme all'hash (#catalogo?tipo=concept|element&id=...), così un
   link da un'altra tab (o un vecchio #concept/#element, vedi util.js) può
   selezionare direttamente il pannello giusto. */
let catTipo = "concept";

/* testo del campo di ricerca (#catCerca): UNO solo per entrambi i tipi, apposta —
   chi cerca "notte" vuole vederlo sia fra i concept sia fra gli element, e il cambio
   di segmented non deve azzerargli la ricerca sotto le mani. */
let catCerca = "";

function syncSegButtons() {
  document.querySelectorAll("#catTipoSel .segbtn").forEach((b) => b.classList.toggle("active", b.dataset.tipo === catTipo));
}
/* scrive l'hash dallo stato corrente (tipo + eventuale selezione): richiamata
   da OGNI azione che cambia cosa si sta guardando (selezione, nuovo, duplica,
   cambio tipo), così l'indirizzo resta sempre coerente con lo schermo — stessa
   idea di scriviHashDaFiltri in tab-archivio.js. `skipHashWrite` evita il giro
   quando lo stato è già stato impostato PARTENDO dall'hash (onShow): altrimenti
   si riscriverebbe un hash già corretto, innocuo ma inutile. */
function scriviHashCatalogo(opts = {}) {
  if (opts.skipHashWrite) return;
  const id = catTipo === "concept" ? conceptSel : elementSel;
  const params = { tipo: catTipo };
  if (id) params.id = id;
  AP.util.route.vai("catalogo", params);
}
/* ridisegna lista + form + pannello "dove è usato" e aggiorna l'hash: il punto
   unico da cui passano tutte le azioni di selezione/creazione/duplicazione, sia
   per i concept sia per gli element (il dispatch fra i due lo fanno renderCatList/
   renderCatForm leggendo `catTipo`, già impostato dal chiamante prima di invocare
   questa funzione). */
function afterCatSelectionChange(opts = {}) {
  syncSegButtons();
  renderCatList();
  renderCatForm();
  renderDoveUsato();
  scriviHashCatalogo(opts);
}

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

/* ==================================================================
   USI: le stringhe che ogni riga della lista porta con sé (DESIGN.md, "3.
   Catalogo": "ogni riga della lista porta i suoi usi"). Derivate SEMPRE da
   AP.store.usi (l'indice già calcolato in store.js), mai un aggregato nuovo
   qui. Chi non è mai stato usato lo dice esplicitamente ("mai generato") al
   posto di un silenzioso "0 archi · 0 giorni", che sembrerebbe un dato mancante
   invece di un fatto onesto.
   ================================================================== */
function usoConceptTxt(id) {
  const u = AP.store.usi?.concept?.[id] || { elementiNativi: [], archi: [], giorni: 0, canaliProduzione: [] };
  const nNativi = u.elementiNativi.length;
  const nativiTxt = `${nNativi} element nativ${nNativi === 1 ? "o" : "i"}`;
  const genTxt = u.giorni ? `${u.archi.length} arc${u.archi.length === 1 ? "o" : "hi"} · ${u.giorni} giorn${u.giorni === 1 ? "o" : "i"}` : "mai generato";
  const canaliTxt = u.canaliProduzione.length ? esc(u.canaliProduzione.join(", ")) : "nessun canale attivo";
  return `${nativiTxt} · ${genTxt} · ${canaliTxt}`;
}
function usoElementTxt(id) {
  const u = AP.store.usi?.element?.[id] || { concept: null, pubblicatoSu: null, archi: [], giorni: 0 };
  const nativoTxt = u.concept ? `nativo di ${esc(AP.comp.conceptNomeById(u.concept))}` : "senza concept nativo";
  const pubTxt = u.pubblicatoSu ? `pubblicato su ${esc(u.pubblicatoSu)}` : "non pubblicato";
  const genTxt = u.giorni ? `${u.archi.length} arc${u.archi.length === 1 ? "o" : "hi"} · ${u.giorni} giorn${u.giorni === 1 ? "o" : "i"}` : "mai generato";
  return `${nativoTxt} · ${pubTxt} · ${genTxt}`;
}

/* Messaggi di conferma per le cancellazioni (azione irreversibile, v. PLAN.md
   ciclo POLISH "eliminare dal catalogo dice prima cosa si perde"): stessa
   fonte dati di usoElementTxt/usoConceptTxt (AP.store.usi), nessuna chiamata
   di rete né scrittura di stato. Se AP.store.usi manca o non ha la voce
   (tool aperto prima che gli usi siano stati costruiti, o Worker muto),
   degradano alla sola domanda base: la cancellazione resta possibile. */
function messaggioEliminaElement(id, nome) {
  const base = `Eliminare l'element "${nome}"?`;
  const u = AP.store.usi?.element?.[id];
  if (!u) return base;
  const righe = [];
  if (u.pubblicatoSu) {
    righe.push(`È pubblicato su "${u.pubblicatoSu}": uscirà dal pool di produzione di quel canale e l'arco eventualmente in corso su di lui ripartirà da capo.`);
  }
  if (u.giorni > 0) {
    const nArchi = (u.archi || []).length;
    righe.push(`Ha già generato ${nArchi} arc${nArchi === 1 ? "o" : "hi"} · ${u.giorni} giorn${u.giorni === 1 ? "o" : "i"}: le immagini già in archivio restano.`);
  }
  if (!u.pubblicatoSu && !(u.giorni > 0)) {
    righe.push("Non è pubblicato su nessun canale · mai generato.");
  }
  return righe.length ? `${base}\n\n${righe.join("\n")}` : base;
}
function messaggioEliminaConcept(id, nome) {
  const base = `Eliminare il concept "${nome}"?`;
  const u = AP.store.usi?.concept?.[id];
  if (!u) return base;
  const righe = [];
  const nativi = u.elementiNativi || [];
  if (nativi.length) {
    righe.push(`Element custom che lo hanno come nativo (il Worker rifiuterà la cancellazione): ${nativi.join(", ")}.`);
  }
  const canali = u.canaliProduzione || [];
  if (canali.length) {
    righe.push(`Canali attivi che lo pescano per indole: ${canali.join(", ")}.`);
  }
  if (u.giorni > 0) {
    const nArchi = (u.archi || []).length;
    righe.push(`Ha già generato ${nArchi} arc${nArchi === 1 ? "o" : "hi"} · ${u.giorni} giorn${u.giorni === 1 ? "o" : "i"}.`);
  }
  return righe.length ? `${base}\n\n${righe.join("\n")}` : base;
}

/* filtro della lista Catalogo: puro, senza DOM e senza stato — tutta la logica di
   ricerca sta qui, così i test la esercitano senza sandbox. Corrispondenza su nome
   O id, senza distinzione di maiuscole. Non lancia MAI: input degeneri degradano
   (non-array -> [], testo non stringa/vuoto -> elenco invariato). */
function filtraVoci(items, cerca) {
  if (!Array.isArray(items)) return [];
  const q = (typeof cerca === "string" ? cerca : "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => {
    const nome = typeof it?.nome === "string" ? it.nome.toLowerCase() : "";
    const id = typeof it?.id === "string" ? it.id.toLowerCase() : "";
    return nome.includes(q) || id.includes(q);
  });
}

/* messaggio della lista vuota: distingue "il catalogo è vuoto" da "il filtro non ha
   trovato nulla" — una lista muta dopo una ricerca sembrerebbe un catalogo sparito. */
function listaVuotaHTML(tuttiCount, vuotoTxt) {
  if (tuttiCount) return `<div class="hint">nessuna voce corrisponde a "${esc(catCerca.trim())}"</div>`;
  return `<div class="hint">${vuotoTxt}</div>`;
}

/* ================================================================== */
/* ---------- LISTA + FORM: CONCEPT ---------- */
/* ================================================================== */
let conceptSel = null;    // id del concept selezionato in lista (null = nessuna selezione)
let conceptForm = null;   // stato in edit: null finché non si sceglie/crea qualcosa
let conceptIsNew = false;

function renderConceptList() {
  const wrap = $("catList");
  const cat = AP.store.dati.catalogo;
  if (CATALOGO_ERROR) { wrap.innerHTML = `<div class="hint">${esc(CATALOGO_ERROR)}</div>`; return; }
  if (!catalogoArrivato) { wrap.innerHTML = `<div class="hint">catalogo non ancora caricato.</div>`; return; }
  wrap.innerHTML = "";
  const tutti = [...cat.concepts].sort((a, b) => (a.custom === b.custom ? 0 : a.custom ? 1 : -1) || a.nome.localeCompare(b.nome));
  const items = filtraVoci(tutti, catCerca);
  for (const c of items) {
    const row = document.createElement("div");
    row.className = "itemrow" + (c.id === conceptSel ? " active" : "");
    row.innerHTML = `<span>${esc(c.nome)}<br><code>${esc(c.id)}</code><br><span class="hint" style="font-size:11px">${usoConceptTxt(c.id)}</span></span>
      <span class="badges"><span class="badge ${c.custom ? 'custom' : ''}">${c.custom ? 'custom' : 'built-in'}</span>${c.sospeso === true ? '<span class="badge sospeso">sospeso</span>' : ''}</span>`;
    row.onclick = () => selectConcept(c.id);
    wrap.appendChild(row);
  }
  if (!items.length) wrap.innerHTML = listaVuotaHTML(tutti.length, "nessun concept nel catalogo.");
}

function selectConcept(id, opts = {}) {
  const c = AP.store.dati.catalogo?.concepts.find((x) => x.id === id);
  if (!c) return;
  catTipo = "concept";
  conceptSel = id;
  conceptIsNew = false;
  conceptForm = deepClone(c);
  afterCatSelectionChange(opts);
}

function newConcept() {
  catTipo = "concept";
  conceptSel = null;
  conceptIsNew = true;
  conceptForm = {
    id: "", nome: "", custom: true, conserva: "",
    tappe: Array.from({ length: 7 }, () => [""]),
    extra: [],
    profilo: { estensione: [7, 28], intensita: [9, 26], compattezza: [0.4, 0.85], monotona: true },
    maxDeriva: null, maxDegrado: null,
  };
  afterCatSelectionChange();
}

function duplicateConcept() {
  if (!conceptForm) return alert("Seleziona prima un concept dalla lista da usare come base.");
  const base = deepClone(conceptForm);
  base.id = "";
  base.nome = (base.nome || "") + " (copia)";
  base.custom = true;
  catTipo = "concept";
  conceptSel = null;
  conceptIsNew = true;
  conceptForm = base;
  afterCatSelectionChange();
}

function renderConceptForm() {
  const box = $("catForm");
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
    ${f.sospeso === true ? `<div class="hint">sospeso dalla pesca: nessun flusso lo pesca finché non è tarato (un arco già aperto o il lab per id continuano a funzionare)</div>` : ""}
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
  if (!confirm(messaggioEliminaConcept(conceptForm.id, conceptForm.nome))) return;
  try {
    setStatus($("conceptFormStatus"), "elimino…");
    await api(`/catalogo/concept?id=${encodeURIComponent(conceptForm.id)}`, { method: "DELETE" });
    conceptForm = null; conceptSel = null;
    await ricaricaDopoScrittura();
    afterCatSelectionChange();
  } catch (e) {
    showConceptErrors(errFromCatch(e));
    setStatus($("conceptFormStatus"), "");
  }
}

/* ================================================================== */
/* ---------- LISTA + FORM: ELEMENT ---------- */
/* ================================================================== */
let elementSel = null;
let elementForm = null;
let elementIsNew = false;

function renderElementList() {
  const wrap = $("catList");
  const cat = AP.store.dati.catalogo;
  if (CATALOGO_ERROR) { wrap.innerHTML = `<div class="hint">${esc(CATALOGO_ERROR)}</div>`; return; }
  if (!catalogoArrivato) { wrap.innerHTML = `<div class="hint">catalogo non ancora caricato.</div>`; return; }
  wrap.innerHTML = "";
  const tutti = [...cat.elements].sort((a, b) => (a.custom === b.custom ? 0 : a.custom ? 1 : -1) || a.nome.localeCompare(b.nome));
  const items = filtraVoci(tutti, catCerca);
  for (const e of items) {
    const row = document.createElement("div");
    row.className = "itemrow" + (e.id === elementSel ? " active" : "");
    row.innerHTML = `<span>${esc(e.nome)}<br><code>${esc(e.id)}</code><br><span class="hint" style="font-size:11px">${usoElementTxt(e.id)}</span></span>
      <span class="badges">
        <span class="badge ${e.custom ? 'custom' : ''}">${e.custom ? 'custom' : 'built-in'}</span>
        ${e.pubblicato ? `<span class="badge pub">${esc(e.canale || 'pubblicato')}</span>` : ''}
        ${e.sospeso === true ? '<span class="badge sospeso">sospeso</span>' : ''}
      </span>`;
    row.onclick = () => selectElement(e.id);
    wrap.appendChild(row);
  }
  if (!items.length) wrap.innerHTML = listaVuotaHTML(tutti.length, "nessun element nel catalogo.");
}

function selectElement(id, opts = {}) {
  const e = AP.store.dati.catalogo?.elements.find((x) => x.id === id);
  if (!e) return;
  catTipo = "element";
  elementSel = id;
  elementIsNew = false;
  elementForm = deepClone(e);
  afterCatSelectionChange(opts);
}

function newElement() {
  catTipo = "element";
  elementSel = null;
  elementIsNew = true;
  elementForm = {
    id: "", nome: "", custom: true, s: "", soggetto: "",
    setting: "", style: "", palette: "",
    famigliaNativa: AP.store.dati.catalogo?.concepts?.[0]?.id || "",
    tappe: null, extra: null, pubblicato: false, canale: null,
  };
  afterCatSelectionChange();
}

function duplicateElement() {
  if (!elementForm) return alert("Seleziona prima un element dalla lista da usare come base.");
  const base = deepClone(elementForm);
  base.id = "";
  base.nome = (base.nome || "") + " (copia)";
  base.custom = true;
  base.pubblicato = false;
  base.canale = null;
  catTipo = "element";
  elementSel = null;
  elementIsNew = true;
  elementForm = base;
  afterCatSelectionChange();
}

function renderElementForm() {
  const box = $("catForm");
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
    ? `<div class="hint" style="font-size:13px;color:var(--text);margin-bottom:12px">${AP.comp.chipCoppia(f.famigliaNativa, f.id, { conceptNome: nativeConceptNome, elementNome: f.nome, nativa: true })}</div>`
    : "";

  box.innerHTML = `
    ${readOnly ? `<div class="readonly-banner">Questo è un element <b>built-in</b>, scritto nel codice: è di sola lettura qui.
      Usa "Duplica" per crearne una tua versione modificabile.</div>` : ""}
    ${f.sospeso === true ? `<div class="hint">sospeso dalla pesca: nessun flusso lo pesca finché non è tarato (un arco già aperto o il lab per id continuano a funzionare)</div>` : ""}
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
  if (!confirm(messaggioEliminaElement(elementForm.id, elementForm.nome))) return;
  try {
    setStatus($("elementFormStatus"), "elimino…");
    await api(`/catalogo/element?id=${encodeURIComponent(elementForm.id)}`, { method: "DELETE" });
    elementForm = null; elementSel = null;
    await ricaricaDopoScrittura();
    afterCatSelectionChange();
  } catch (e) {
    showElementErrors(errFromCatch(e));
    setStatus($("elementFormStatus"), "");
  }
}

/* ================================================================== */
/* ---------- ORCHESTRAZIONE: selettore tipo, lista e form unificati ---------- */
/* ================================================================== */
function renderCatList() { if (catTipo === "element") renderElementList(); else renderConceptList(); }
function renderCatForm() { if (catTipo === "element") renderElementForm(); else renderConceptForm(); }

document.querySelectorAll("#catTipoSel .segbtn").forEach((b) => {
  b.onclick = () => {
    catTipo = (b.dataset.tipo === "element") ? "element" : "concept";
    afterCatSelectionChange();
  };
});
$("catNew").onclick = () => (catTipo === "element" ? newElement() : newConcept());
$("catDup").onclick = () => (catTipo === "element" ? duplicateElement() : duplicateConcept());
$("catReload").onclick = () => AP.store.carica();
/* ricerca: sola lettura pura sullo stato già in memoria — nessuna chiamata al Worker,
   nessuna scrittura, la selezione corrente e il form di dettaglio restano dove sono
   (si ridisegna solo la lista). */
$("catCerca").oninput = (ev) => {
  catCerca = ev.target.value;
  renderCatList();
};

/* ==================================================================
   PANNELLO "DOVE È USATO" — in testa al form della voce selezionata
   (DESIGN.md, "3. Catalogo"): canali di produzione E PERCHÉ, archi generati
   (ognuno linka l'Archivio filtrato), ultimo uso, giudizi. Due bottoni:
   "vedi in archivio" e "⚗ prova nel Lab" (per un concept, la coppia
   preselezionata nel Lab è quel concept col suo primo element nativo — non
   esiste "il" concept da solo nel Lab, serve sempre un element per generare).
   Sempre derivato da AP.store.usi: non è una vista a sé da mantenere.
   ================================================================== */
function elencoCanaliAttivi() { return (AP.store.dati.canali || []).filter((c) => !c.storico); }

/* canali attivi in cui un CONCEPT è nel pool di produzione, con il motivo:
   indole del canale (ch.famiglie) oppure un element pubblicato su quel canale
   che lo ha come nativo — stessa regola di AP.store.usi (buildUsi in store.js),
   qui solo per spiegarla riga per riga invece che come semplice conteggio. */
function canaliConMotivoPerConcept(conceptId) {
  const risultati = [];
  for (const ch of elencoCanaliAttivi()) {
    const motivi = [];
    if ((ch.famiglie || []).includes(conceptId)) motivi.push("indole del canale");
    const elementiPubblicati = (AP.store.dati.catalogo?.elements || [])
      .filter((e) => e.pubblicato && e.canale === ch.id && e.famigliaNativa === conceptId);
    if (elementiPubblicati.length) motivi.push(`element pubblicat${elementiPubblicati.length === 1 ? 'o' : 'i'}: ${elementiPubblicati.map((e) => esc(e.nome)).join(", ")}`);
    if (motivi.length) risultati.push({ canale: ch, motivi });
  }
  return risultati;
}
/* stesso ragionamento per un ELEMENT: pubblicazione esplicita su un canale, o
   indole del canale che lo raggiunge indirettamente tramite il suo concept nativo. */
function canaliConMotivoPerElement(elementId) {
  const el = (AP.store.dati.catalogo?.elements || []).find((e) => e.id === elementId);
  if (!el) return [];
  const risultati = [];
  for (const ch of elencoCanaliAttivi()) {
    const motivi = [];
    if (el.pubblicato && el.canale === ch.id) motivi.push("pubblicazione esplicita su questo canale");
    if (el.famigliaNativa && (ch.famiglie || []).includes(el.famigliaNativa)) motivi.push(`indole del canale (nativo di "${esc(AP.comp.conceptNomeById(el.famigliaNativa))}")`);
    if (motivi.length) risultati.push({ canale: ch, motivi });
  }
  return risultati;
}

function elencoCanaliHTML(righe) {
  if (!righe.length) return `<div class="hint">non è nel pool di produzione di nessun canale attivo al momento.</div>`;
  return `<ul style="margin:4px 0 10px;padding-left:18px;color:var(--dim);font-size:12.5px;line-height:1.6">
    ${righe.map((r) => `<li>${esc(r.canale.emoji || "")} <b style="color:var(--text)">${esc(r.canale.name || r.canale.id)}</b> — ${r.motivi.join(" · ")}</li>`).join("")}
  </ul>`;
}
/* elenco archi: ognuno linka l'Archivio filtrato sulla coppia ESATTA di
   quell'arco (non sulla sola voce selezionata: per un concept ogni arco può
   avere un element diverso, e viceversa — vedi buildUsi in store.js, dove le
   voci di usi.concept[x].archi portano `element` ma non `concept`, quello di
   usi.element[x].archi il viceversa). `paraPerArco(a)` sa completare la coppia
   per la singola voce, il chiamante lo passa già sapendo qual è il lato fisso. */
function elencoArchiHTML(archi, paraPerArco) {
  if (!archi.length) return `<div class="hint">nessun arco generato finora.</div>`;
  const ordinati = archi.slice().sort((a, b) => (a.al < b.al ? 1 : a.al > b.al ? -1 : 0));
  return `<ul style="margin:4px 0 10px;padding-left:18px;color:var(--dim);font-size:12.5px;line-height:1.7">
    ${ordinati.map((a) => {
      const coppia = paraPerArco(a);
      return `<li><a href="#" class="doveUsatoArco" data-concept="${esc(coppia.concept || "")}" data-element="${esc(coppia.element || "")}">${esc(a.canale)} · arco ${a.arco + 1} · ${esc(a.dal)}–${esc(a.al)} · ${a.nGiorni} giorni</a></li>`;
    }).join("")}
  </ul>`;
}

function doveUsatoConceptHTML(id) {
  const nome = AP.comp.conceptNomeById(id);
  const u = AP.store.usi?.concept?.[id] || { archi: [], giorni: 0, buoni: 0, scarti: 0, elementiNativi: [] };
  const ultimoUso = u.archi.length ? u.archi.reduce((max, a) => (a.al > max ? a.al : max), u.archi[0].al) : null;
  return `<div class="card" style="margin-bottom:14px">
    <h3 style="margin-bottom:6px">Dove è usato · ${esc(nome)}</h3>
    <div class="hint" style="margin-bottom:4px">canali attivi nel cui pool di produzione è presente, e perché:</div>
    ${elencoCanaliHTML(canaliConMotivoPerConcept(id))}
    <div class="hint" style="margin-bottom:4px">archi generati (${u.archi.length}):</div>
    ${elencoArchiHTML(u.archi, (a) => ({ concept: id, element: a.element }))}
    <div class="row"><label>ultimo uso</label><div>${ultimoUso ? esc(ultimoUso) : "mai"}</div></div>
    <div class="row"><label>giudizi</label><div>${u.buoni} buon${u.buoni === 1 ? "o" : "i"} · ${u.scarti} scart${u.scarti === 1 ? "o" : "i"}</div></div>
    <div class="formactions">
      <button class="ghost" data-act="vaiArchivio">vedi in archivio</button>
      <button data-act="provaLab">⚗ prova nel Lab</button>
    </div>
  </div>`;
}
function doveUsatoElementHTML(id) {
  const el = (AP.store.dati.catalogo?.elements || []).find((e) => e.id === id);
  const nome = el?.nome || AP.comp.elementNomeById(id);
  const u = AP.store.usi?.element?.[id] || { archi: [], giorni: 0, buoni: 0, scarti: 0, ultimoUso: null };
  return `<div class="card" style="margin-bottom:14px">
    <h3 style="margin-bottom:6px">Dove è usato · ${esc(nome)}</h3>
    <div class="hint" style="margin-bottom:4px">canali attivi nel cui pool di produzione è presente, e perché:</div>
    ${elencoCanaliHTML(canaliConMotivoPerElement(id))}
    <div class="hint" style="margin-bottom:4px">archi generati (${u.archi.length}):</div>
    ${elencoArchiHTML(u.archi, (a) => ({ concept: a.concept, element: id }))}
    <div class="row"><label>ultimo uso</label><div>${u.ultimoUso ? esc(u.ultimoUso) : "mai"}</div></div>
    <div class="row"><label>giudizi</label><div>${u.buoni} buon${u.buoni === 1 ? "o" : "i"} · ${u.scarti} scart${u.scarti === 1 ? "o" : "i"}</div></div>
    <div class="formactions">
      <button class="ghost" data-act="vaiArchivio">vedi in archivio</button>
      <button data-act="provaLab">⚗ prova nel Lab</button>
    </div>
  </div>`;
}

function wireDoveUsato(box, id) {
  // ogni riga d'arco porta già la coppia ESATTA in data-concept/data-element
  // (vedi elencoArchiHTML): filtra l'Archivio su quella, non sulla sola voce
  // selezionata qui.
  box.querySelectorAll(".doveUsatoArco").forEach((a) => {
    a.onclick = (ev) => {
      ev.preventDefault();
      const params = {};
      if (a.dataset.concept) params.concept = a.dataset.concept;
      if (a.dataset.element) params.element = a.dataset.element;
      AP.util.route.vai("archivio", params);
    };
  });
  const btnArchivio = box.querySelector('[data-act="vaiArchivio"]');
  const btnLab = box.querySelector('[data-act="provaLab"]');
  if (catTipo === "concept") {
    if (btnArchivio) btnArchivio.onclick = () => AP.util.route.vai("archivio", { concept: id });
    if (btnLab) btnLab.onclick = () => {
      const primoNativo = (AP.store.usi?.concept?.[id]?.elementiNativi || [])[0] || null;
      if (!primoNativo) { toast(`"${AP.comp.conceptNomeById(id)}" non ha ancora nessun element nativo: creane uno nel Catalogo, poi prova nel Lab.`, "errore"); return; }
      AP.util.route.vai("lab", { concept: id, element: primoNativo });
    };
  } else {
    if (btnArchivio) btnArchivio.onclick = () => AP.util.route.vai("archivio", { element: id });
    if (btnLab) btnLab.onclick = () => {
      const el = (AP.store.dati.catalogo?.elements || []).find((e) => e.id === id);
      const concettoNativo = el?.famigliaNativa || AP.store.usi?.element?.[id]?.concept || null;
      if (!concettoNativo) { toast("questo element non ha un concept nativo: impossibile aprirlo nel Lab.", "errore"); return; }
      AP.util.route.vai("lab", { concept: concettoNativo, element: id });
    };
  }
}

function renderDoveUsato() {
  const box = $("catDoveUsato");
  if (!box) return;
  const id = catTipo === "concept" ? conceptSel : elementSel;
  if (!id || !catalogoArrivato) { box.innerHTML = ""; return; }
  box.innerHTML = catTipo === "concept" ? doveUsatoConceptHTML(id) : doveUsatoElementHTML(id);
  wireDoveUsato(box, id);
}

/* ---------- reazioni agli eventi dello STORE ---------- */
AP.store.on("catalogo", () => {
  CATALOGO_ERROR = null;
  catalogoArrivato = true;
  const cat = AP.store.dati.catalogo;
  setStatus($("catStatus"), `caricato · ${cat.concepts.length} concept (${cat.concepts.filter((c) => c.custom).length} custom) · ${cat.elements.length} element (${cat.elements.filter((e) => e.custom).length} custom)`);
  // se la selezione corrente si riferisce a un item sparito (es. eliminato da
  // un'altra scheda), il form torna al placeholder invece di mostrare dati stantii.
  if (conceptSel && !cat.concepts.some((c) => c.id === conceptSel)) { conceptSel = null; conceptForm = null; }
  if (elementSel && !cat.elements.some((e) => e.id === elementSel)) { elementSel = null; elementForm = null; }
  renderCatList();
  renderCatForm();
  renderDoveUsato();
});
AP.store.on("errore", (info) => {
  if (info.sezione === "catalogo") {
    CATALOGO_ERROR = `questo Worker non espone ancora /catalogo: aggiornalo per creare concept ed element. `
      + `(dettaglio: ${info.errore.message}) — Range e Lab restano comunque usabili nel frattempo.`;
    setStatus($("catStatus"), CATALOGO_ERROR);
    renderCatList();
  }
});
AP.store.on("canali", () => {
  // i canali attivi alimentano sia il <select> "canale" dell'element pubblicato
  // sia le righe del pannello "dove è usato": se arrivano DOPO il catalogo,
  // form e pannello vanno ridisegnati per mostrarli.
  if (elementForm) renderCatForm();
  renderDoveUsato();
});
// "usi" arriva a fine caricamento (rendering progressivo di TUTTI gli archivi
// concluso, vedi store.js): solo allora i conteggi in lista e il pannello
// "dove è usato" sono completi, non parziali.
AP.store.on("usi", () => { renderCatList(); renderDoveUsato(); });

/* ---------- rotta: #catalogo?tipo=concept|element&id=... ---------- */
AP.tabs.catalogo = {
  onShow(params = {}) {
    catTipo = (params.tipo === "element") ? "element" : "concept";
    syncSegButtons();
    if (params.id) {
      if (catTipo === "element") selectElement(params.id, { skipHashWrite: true });
      else selectConcept(params.id, { skipHashWrite: true });
    } else {
      // nessun id nell'hash: non tocca una selezione già in corso in questa
      // sessione (utile tornando sul Catalogo da un'altra tab), ma ridisegna
      // comunque con lo stato più fresco dello STORE.
      renderCatList();
      renderCatForm();
      renderDoveUsato();
    }
  },
};
