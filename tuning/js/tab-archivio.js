// TAB ARCHIVIO (home): dentro ogni canale (attivo o storico) i giorni si
// raggruppano per ARCO (stessa coppia concept×element + stesso `arco`, vedi
// AP.store.archiDi), più un gruppo finale per i giorni la cui provenienza non
// permette di dedurre un arco. Canali e archivi arrivano dallo STORE (fetch
// paralleli, non un `await` dentro un `for`): questa tab si limita a costruire
// lo scheletro appena arriva l'elenco canali e a riempire ogni sezione appena
// arriva IL SUO archivio — rendering progressivo, un canale non aspetta
// l'altro. Le marcature buono/scarto (findNota/applyMarkToFrame/
// wireMarkControls) vivono in tab-range.js, caricato prima di questo file:
// vedi il commento in testa a quel file per il perché.
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

const archSectionState = new Map(); // canale -> { abort, measuring }, uno stato indipendente per sezione
const archSubscribed = new Set();   // canali già agganciati all'evento "archivio:<id>" (evita doppie sottoscrizioni sui reload successivi)

/* ---------- date leggibili: "12–18 lug" (stesso mese), "28 lug – 3 ago" (mesi diversi) ---------- */
const MESI_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
function formatDataBreve(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESI_IT[m - 1]}`;
}
function formatIntervallo(dal, al) {
  if (dal === al) return formatDataBreve(dal);
  const [ya, ma] = dal.split("-").map(Number);
  const [yb, mb] = al.split("-").map(Number);
  const a = formatDataBreve(dal), b = formatDataBreve(al);
  if (ya === yb && ma === mb) return `${dal.split("-")[2].replace(/^0/, "")}–${b}`;
  if (ya === yb) return `${a} – ${b}`;
  return `${a} ${ya} – ${b} ${yb}`;
}

/* ================================================================== */
/* ---------- BARRA FILTRI GLOBALE: canale · concept · element · giudizio ----------
   Vive nell'hash (#archivio?concept=…&giudizio=…): ricaricare la pagina non
   perde il filtro, e ogni chip coppia in qualunque punto del tool può
   "atterrare" qui con un solo parametro (vedi il listener delegato in
   components.js). I quattro <select> usano "tutti" come valore sentinella
   (stessa convenzione del vecchio filtro-canale): solo i valori DIVERSI da
   "tutti" finiscono nell'hash. ================================================================== */
const FILTRO_SEL = { canale: "archFiltroCanale", concept: "archFiltroConcept", element: "archFiltroElement", giudizio: "archFiltroGiudizio" };

function leggiFiltriSelect() {
  return {
    canale: $(FILTRO_SEL.canale)?.value || "tutti",
    concept: $(FILTRO_SEL.concept)?.value || "tutti",
    element: $(FILTRO_SEL.element)?.value || "tutti",
    giudizio: $(FILTRO_SEL.giudizio)?.value || "tutti",
  };
}
/* imposta i 4 <select> dai parametri dell'hash: chiamata sia quando la tab
   diventa attiva (onShow) sia dopo aver ricostruito le opzioni di un select
   (canale/concept/element cambiano quando arrivano canali/catalogo) — un
   valore impostato PRIMA che la sua <option> esista verrebbe silenziosamente
   ignorato dal browser, per questo va ripetuto dopo ogni ricostruzione. */
function impostaFiltriSelect(params = {}) {
  if ($(FILTRO_SEL.canale)) $(FILTRO_SEL.canale).value = params.canale || "tutti";
  if ($(FILTRO_SEL.concept)) $(FILTRO_SEL.concept).value = params.concept || "tutti";
  if ($(FILTRO_SEL.element)) $(FILTRO_SEL.element).value = params.element || "tutti";
  if ($(FILTRO_SEL.giudizio)) $(FILTRO_SEL.giudizio).value = params.giudizio || "tutti";
}
function scriviHashDaFiltri() {
  const f = leggiFiltriSelect();
  const params = {};
  if (f.canale !== "tutti") params.canale = f.canale;
  if (f.concept !== "tutti") params.concept = f.concept;
  if (f.element !== "tutti") params.element = f.element;
  if (f.giudizio !== "tutti") params.giudizio = f.giudizio;
  AP.util.route.vai("archivio", params); // triggera hashchange -> onShow(params) -> impostaFiltriSelect + applyArchFilter
}
function riapplicaFiltriDaHash() {
  impostaFiltriSelect(AP.util.route.leggi().params);
  applyArchFilter();
}

/** true se il giorno passa il filtro giudizio corrente. */
function matchGiudizio(filtro, canale, data) {
  if (filtro === "tutti") return true;
  const giud = findNota(canale, data)?.giudizio || null; // findNota: globale da tab-range.js
  if (filtro === "buoni") return giud === "buono";
  if (filtro === "scarti") return giud === "scarto";
  if (filtro === "nonmarcati") return giud == null;
  return true;
}

/* applica i 4 filtri al DOM già costruito: nasconde un intero .arco-block se
   non incrocia canale/concept/element (la coppia è la stessa per TUTTI i
   giorni di un arco, per costruzione — vedi AP.store.archiDi), altrimenti
   nasconde solo i singoli .frame che non incrociano il giudizio. Il gruppo
   "senza arco noto" filtra concept/element/giudizio per singolo giorno,
   perché lì la coppia (quando c'è, provenienza ricostruita) può variare
   giorno per giorno. */
function applyArchFilter() {
  const f = leggiFiltriSelect();
  let anyHistoricalVisible = false;
  document.querySelectorAll("#archSections .arch-section").forEach((sec) => {
    const showSection = f.canale === "tutti" || sec.dataset.channel === f.canale;
    sec.style.display = showSection ? "" : "none";
    if (!showSection) return;
    if (sec.dataset.kind === "storico") anyHistoricalVisible = true;

    sec.querySelectorAll(".arco-block").forEach((blocco) => {
      const okConcept = f.concept === "tutti" || blocco.dataset.concept === f.concept;
      const okElement = f.element === "tutti" || blocco.dataset.element === f.element;
      let anyFrameVisible = false;
      blocco.querySelectorAll(".frame").forEach((fr) => {
        const visible = okConcept && okElement && matchGiudizio(f.giudizio, fr.dataset.canale, fr.dataset.data);
        fr.style.display = visible ? "" : "none";
        if (visible) anyFrameVisible = true;
      });
      blocco.style.display = anyFrameVisible ? "" : "none";
    });

    const senzaArco = sec.querySelector(".senza-arco-block");
    if (senzaArco) {
      let anyVisible = false;
      senzaArco.querySelectorAll(".frame").forEach((fr) => {
        const okConcept = f.concept === "tutti" || fr.dataset.concept === f.concept;
        const okElement = f.element === "tutti" || fr.dataset.element === f.element;
        const visible = okConcept && okElement && matchGiudizio(f.giudizio, fr.dataset.canale, fr.dataset.data);
        fr.style.display = visible ? "" : "none";
        if (visible) anyVisible = true;
      });
      senzaArco.style.display = anyVisible ? "" : "none";
    }
  });
  const hdr = $("archHistoricalHeader");
  if (hdr) hdr.style.display = anyHistoricalVisible ? "" : "none";
}

/* ricalcola solo i conteggi "N ok / N scarto" di ogni intestazione d'arco già
   disegnata (le note possono arrivare dopo che l'arco è già stato costruito:
   rendering progressivo, vedi store.js) — senza ricostruire il DOM, per non
   perdere lo stato di un click/testo in corso altrove nella pagina. */
function aggiornaContiGiudizio() {
  document.querySelectorAll(".arco-block").forEach((blocco) => {
    let buoni = 0, scarti = 0;
    blocco.querySelectorAll(".frame[data-data]").forEach((fr) => {
      const giud = findNota(fr.dataset.canale, fr.dataset.data)?.giudizio;
      if (giud === "buono") buoni++; else if (giud === "scarto") scarti++;
    });
    const el = blocco.querySelector(".arco-giudizi");
    if (el) el.textContent = `${buoni} ok / ${scarti} scarto`;
  });
}

/* popola il filtro canale: opzioni raggruppate attivi/storici, stessa lista
   che finiva prima nel select "archFlusso" del vecchio filtro singolo. */
function buildFiltroCanale(canali) {
  const sel = $(FILTRO_SEL.canale);
  if (!sel) return;
  const attuale = sel.value;
  const attivi = canali.filter((c) => !c.storico);
  const storici = canali.filter((c) => c.storico);
  const optHTML = (c) => `<option value="${esc(c.id)}">${esc(c.emoji || "🗄")} ${esc(c.name || c.id)}</option>`;
  let html = `<option value="tutti">tutti i canali</option>`;
  if (attivi.length) html += `<optgroup label="Attivi">${attivi.map(optHTML).join("")}</optgroup>`;
  if (storici.length) html += `<optgroup label="Storici">${storici.map(optHTML).join("")}</optgroup>`;
  sel.innerHTML = html;
  sel.value = (attuale && [...sel.options].some((o) => o.value === attuale)) ? attuale : "tutti";
}

/* popola i filtri concept/element dal catalogo, con fra parentesi quante
   generazioni ha ciascuno (dall'indice usi, vedi store.js buildUsi — 0 finché
   "usi" non è ancora arrivato, corretto appena arriva). */
function buildFiltroConceptElement() {
  const selC = $(FILTRO_SEL.concept), selE = $(FILTRO_SEL.element);
  if (!selC || !selE) return;
  const cat = AP.store.dati.catalogo || { concepts: [], elements: [] };
  const usi = AP.store.usi || { concept: {}, element: {} };
  const curC = selC.value, curE = selE.value;
  selC.innerHTML = `<option value="tutti">tutti i concept</option>` + (cat.concepts || []).map((c) =>
    `<option value="${esc(c.id)}">${esc(c.nome)} (${usi.concept[c.id]?.giorni || 0})</option>`).join("");
  selE.innerHTML = `<option value="tutti">tutti gli element</option>` + (cat.elements || []).map((e) =>
    `<option value="${esc(e.id)}">${esc(e.nome)} (${usi.element[e.id]?.giorni || 0})</option>`).join("");
  selC.value = (curC && [...selC.options].some((o) => o.value === curC)) ? curC : "tutti";
  selE.value = (curE && [...selE.options].some((o) => o.value === curE)) ? curE : "tutti";
}

/* ================================================================== */
/* ---------- scheletro: una sezione per canale, nell'ordine con cui li elenca /api/channels ---------- */
function buildArchSkeleton(canali) {
  const wrap = $("archSections");
  wrap.innerHTML = "";
  let historicalHeaderEl = null;

  for (const ch of canali) {
    if (ch.storico && !historicalHeaderEl) {
      historicalHeaderEl = document.createElement("div");
      historicalHeaderEl.id = "archHistoricalHeader";
      historicalHeaderEl.className = "arch-historical-header";
      historicalHeaderEl.textContent = 'Archivi storici · canali chiusi, senza generazione "oggi"';
      wrap.appendChild(historicalHeaderEl);
    }
    const root = document.createElement("div");
    root.className = "arch-section";
    root.dataset.channel = ch.id;
    root.dataset.kind = ch.storico ? "storico" : "active";
    root.innerHTML = `
      <div class="arch-section-head">
        <h3 style="margin:0">${esc(ch.emoji || "")} ${esc(ch.name || ch.id)}</h3>
        <span class="hint archSectionCount"><span class="spinner"></span> carico…</span>
      </div>
      <div class="arch-today" style="margin-bottom:10px"></div>
      <div class="arch-body"></div>`;
    wrap.appendChild(root);

    // se lo STORE ha già l'archivio di questo canale in cache (es. la tab non era
    // attiva quando è arrivato), riempilo subito invece di aspettare un evento che
    // non arriverà più.
    const cached = AP.store.dati.archivi[ch.id];
    if (cached !== undefined) fillArchSection(ch, cached);

    if (!archSubscribed.has(ch.id)) {
      archSubscribed.add(ch.id);
      AP.store.on(`archivio:${ch.id}`, (arch) => {
        // rilegge il canale più fresco da AP.store.dati.canali (non la chiusura
        // catturata qui): su un reload successivo il meta "oggi" può essere
        // cambiato, e questa sottoscrizione non viene rifatta da capo.
        const chAggiornato = (AP.store.dati.canali || []).find((c) => c.id === ch.id) || ch;
        fillArchSection(chAggiornato, arch);
      });
    }
  }
  buildFiltroCanale(canali);
  riapplicaFiltriDaHash();
  aggiornaRiepilogo();
}

/* ---------- un fotogramma: immagine + carta d'identità sintetica ----------
   Fabbrica UNICA usata sia dai blocchi-arco sia dal gruppo "senza arco noto":
   marcatura, dataset per il filtro e apertura della lightbox sono identici
   nei due casi. */
function creaFrame(canale, date, g, opts = {}) {
  const imgUrl = `${base()}/w/${encodeURIComponent(canale)}?date=${encodeURIComponent(date)}`;
  const cell = document.createElement("div");
  cell.className = "frame";
  cell.dataset.canale = canale;
  cell.dataset.data = date;
  cell.dataset.concept = (g && g.concept) || "";
  cell.dataset.element = (g && g.element) || "";
  cell.innerHTML = `
    <img loading="lazy" src="${imgUrl}" alt="${esc(date)}" title="clicca per la scheda completa del giorno" />
    <div class="meta">${AP.comp.buildFrameHTML(canale, date, g, opts)}</div>`;
  // click sul fotogramma apre la lightbox — TRANNE quando il click è su un
  // controllo interattivo (bottone/input/chip), che ha il suo proprio comportamento.
  cell.addEventListener("click", (ev) => {
    if (ev.target.closest("button, input, [data-chip]")) return;
    AP.comp.lightboxGiorno(canale, date);
  });
  applyMarkToFrame(cell, canale, date);
  wireMarkControls(cell, canale, date);
  return cell;
}

/* ---------- un blocco-arco: intestazione (coppia, intervallo, conteggi, "riprova nel Lab") + pellicola ---------- */
function buildArcoBlockEl(arco, canale) {
  const el = document.createElement("div");
  el.className = "arco-block";
  el.dataset.concept = arco.concept || "";
  el.dataset.element = arco.element || "";

  let buoni = 0, scarti = 0;
  for (const g of arco.giorni) {
    const giud = findNota(canale, g.data)?.giudizio;
    if (giud === "buono") buoni++; else if (giud === "scarto") scarti++;
  }
  const primo = arco.giorni[0] || {};
  const coppiaHTML = AP.comp.chipCoppia(arco.concept, arco.element, { conceptNome: primo.conceptNome, elementNome: primo.elementNome });

  el.innerHTML = `
    <div class="arco-header">
      <span class="arco-num">Arco ${arco.arco + 1}</span>
      ${coppiaHTML}
      <span class="hint">${esc(formatIntervallo(arco.dal, arco.al))} · ${arco.giorni.length} giorni · <span class="arco-giudizi">${buoni} ok / ${scarti} scarto</span></span>
      <button class="ghost arco-retry">⚗ riprova nel Lab</button>
    </div>
    <div class="film"></div>`;

  const filmEl = el.querySelector(".film");
  for (const g of arco.giorni) filmEl.appendChild(creaFrame(canale, g.data, g));

  const retryBtn = el.querySelector(".arco-retry");
  if (arco.concept && arco.element) {
    retryBtn.onclick = () => AP.util.route.vai("lab", { concept: arco.concept, element: arco.element });
  } else {
    retryBtn.disabled = true;
    retryBtn.title = "coppia non determinabile per questo arco";
  }
  return el;
}

/* ---------- il gruppo finale: giorni la cui provenienza non permette di dedurre un arco ---------- */
function buildSenzaArcoBlockEl(canale, giorniSenzaArco, workerTooOld) {
  const el = document.createElement("div");
  el.className = "senza-arco-block";
  el.innerHTML = `
    <div class="arco-header">
      <span class="hint" style="font-weight:600">Giorni senza arco noto (provenienza ricostruita o assente)</span>
    </div>
    <div class="film"></div>
    <div class="labctl senza-arco-misura" style="margin-top:8px"></div>`;
  const filmEl = el.querySelector(".film");
  for (const { data, giorno } of giorniSenzaArco) filmEl.appendChild(creaFrame(canale, data, giorno, { workerTooOld }));
  return el;
}

/* "misura questo arco" (/test-metrics), ora agganciato al gruppo "senza arco
   noto" (era in cima a ogni sezione): una chiamata per ogni coppia di giorni
   CONSECUTIVI del canale (serve la cronologia INTERA per trovare l'immagine
   di ieri, non solo la sotto-lista senza arco) il cui secondo giorno non ha
   già provenienza registrata. Il profilo storico di questi giorni non è noto,
   quindi le misure restano SENZA colore invece di essere confrontate col
   range di oggi, che sarebbe fuorviante. */
function wireMisuraSenzaArco(blocco, canale, dates) {
  const frameMap = new Map(); // data -> elemento .measures, solo i fotogrammi di questo gruppo lo hanno
  blocco.querySelectorAll(".frame[data-data]").forEach((cell) => {
    const measuresEl = cell.querySelector(".measures");
    if (measuresEl) frameMap.set(cell.dataset.data, measuresEl);
  });
  const missingDates = dates.slice(1).filter((d) => {
    const g = AP.store.giorno(canale, d);
    return !(g && g.origine === "registrata" && g.misure);
  });

  const ctl = blocco.querySelector(".senza-arco-misura");
  ctl.innerHTML = `
    <button class="archSectionMeasure"></button>
    <button class="archSectionStop ghost" style="display:none">⏹ Interrompi</button>
    <span class="status archSectionStatus"></span>`;
  const measureBtn = ctl.querySelector(".archSectionMeasure");
  const stopBtn = ctl.querySelector(".archSectionStop");
  const statusEl = ctl.querySelector(".archSectionStatus");
  measureBtn.textContent = missingDates.length
    ? `📏 Misura i giorni senza dati registrati (${missingDates.length})`
    : `📏 tutti i giorni hanno già misure registrate`;
  measureBtn.disabled = !missingDates.length;

  const state = archSectionState.get(canale) || { abort: false, measuring: false };
  archSectionState.set(canale, state);
  measureBtn.onclick = () => measureArchSection(canale, dates, frameMap, state, measureBtn, stopBtn, statusEl);
  stopBtn.onclick = () => { state.abort = true; };
}

/* ---------- riempie UNA sezione appena il suo archivio è disponibile ---------- */
function fillArchSection(ch, arch) {
  const root = document.querySelector(`.arch-section[data-channel="${ch.id}"]`);
  if (!root) return; // lo scheletro è stato ricostruito con un elenco canali diverso nel frattempo
  const countEl = root.querySelector(".archSectionCount");

  if (!arch || !Array.isArray(arch.dates) || !arch.dates.length) {
    countEl.innerHTML = arch ? "0 giorni" : `<span class="hint">canale non raggiungibile</span>`;
    root.querySelector(".arch-body").innerHTML = "";
    root.querySelector(".arch-today").innerHTML = "";
    aggiornaRiepilogo();
    return;
  }

  const dates = [...arch.dates].reverse(); // l'endpoint risponde dal più recente: qui si legge come una storia, dal più vecchio
  countEl.textContent = `${dates.length} giorni · ${dates[0]} → ${dates[dates.length - 1]}`;

  const todayGiorno = ch.today?.date ? AP.store.giorno(ch.id, ch.today.date) : null;
  root.querySelector(".arch-today").innerHTML = ch.storico ? "" : buildTodayCardHTML(ch, todayGiorno);

  const workerTooOld = !Array.isArray(arch.giorni);
  const body = root.querySelector(".arch-body");
  body.innerHTML = "";

  const archi = workerTooOld ? [] : AP.store.archiDi(ch.id); // più recente prima (vedi store.js)
  for (const arco of archi) body.appendChild(buildArcoBlockEl(arco, ch.id));

  const senzaArco = AP.store.giorniSenzaArco(ch.id); // [{data, giorno}], ascendente
  if (senzaArco.length) {
    const blocco = buildSenzaArcoBlockEl(ch.id, senzaArco, workerTooOld);
    body.appendChild(blocco);
    wireMisuraSenzaArco(blocco, ch.id, dates);
  }

  applyArchFilter(); // riapplica il filtro corrente (utile se era già impostato su questo canale/coppia)
  aggiornaRiepilogo();
}

/* riepilogo complessivo: quanti canali hanno già risposto, quanti sono ancora in
   volo, quanti sono vuoti o irraggiungibili — ricalcolato ogni volta che UNA
   sezione cambia stato, non solo alla fine (rendering progressivo). */
function aggiornaRiepilogo() {
  const canali = AP.store.dati.canali || [];
  let totalDays = 0, shown = 0, pending = 0, empty = 0, errored = 0;
  for (const ch of canali) {
    const arch = AP.store.dati.archivi[ch.id];
    if (arch === undefined) { pending++; continue; }
    if (arch === null) { errored++; continue; }
    if (!arch.dates || !arch.dates.length) { empty++; continue; }
    shown++; totalDays += arch.dates.length;
  }
  if (!canali.length) {
    setStatus($("archStatus"), "in attesa dell'elenco dei flussi…");
    $("archSummary").textContent = "";
  } else if (pending > 0) {
    setStatus($("archStatus"), `carico… (${canali.length - pending}/${canali.length} canali arrivati)`);
  } else if (!shown) {
    setStatus($("archStatus"), (errored === canali.length)
      ? `il Worker non risponde su nessun canale (${canali.length} tentativi falliti) — controlla l'URL del Worker qui sopra. Il resto della pagina resta comunque usabile.`
      : "nessun canale ha ancora un archivio.");
    $("archSummary").textContent = "";
  } else {
    setStatus($("archStatus"), `fatto · ${empty} canali senza archivio, ${errored} non raggiungibili`);
    $("archSummary").textContent = `${totalDays} giorni generati in ${shown} flussi`;
  }
}

/* contenuto del riquadro "oggi": solo per i flussi attivi, legge il meta già
   incluso in /api/channels e, se disponibile, la carta d'identità del giorno
   odierno. Resta com'è per i canali attivi (DESIGN.md): l'unica modifica qui è
   chipCoppia al posto della vecchia coppiaLabelHTML. Un flusso attivo SENZA
   generazione oggi ha un messaggio dedicato invece di restare vuoto in silenzio. */
function buildTodayCardHTML(ch, todayGiorno) {
  const t = ch?.today;
  const g = todayGiorno || null;
  if (!t) {
    return `<div class="card"><div class="hint">Nessuna generazione registrata per oggi su questo flusso (può
      succedere se il modello immagine è temporaneamente fuori uso). L'archivio qui sotto mostra comunque
      tutti i giorni già generati: usalo per decidere cosa è venuto bene finché la generazione non riparte.</div></div>`;
  }
  const conceptId = g?.concept || t.conceptId || null;
  const conceptNome = g?.conceptNome || t.conceptNome || t.conceptId;
  const elementId = g?.element || null;
  const elementNome = g?.elementNome || null;
  const coppia = AP.comp.chipCoppia(conceptId, elementId, { conceptNome, elementNome });
  const m = g?.misure || t.misure || {};
  const misureTxt = AP.comp.MEAS.map((k) =>
    `${AP.comp.MEAS_LABEL[k] || k} ${m[k] == null ? "—" : (k === "compattezza" ? m[k].toFixed(2) : m[k].toFixed(1))}`
  ).join(" · ");
  // se abbiamo la carta d'identità (giorno registrato) tappa/giorno sono già in
  // base uno; altrimenti si ricade sui vecchi indici da zero di /api/channels
  // (dayInArc/stage), +1 per la stessa numerazione.
  const arcoTxt = g
    ? `giorno ${g.giornoNellArco ?? "—"} di 7 · tappa ${g.tappa ?? "—"}`
    : `giorno ${t.dayInArc == null ? "—" : t.dayInArc + 1} di 7 · tappa ${t.stage == null ? "—" : esc(String(t.stage + 1))}`;
  const modello = g?.modello || t.model || "—";
  const tentativi = g?.tentativi ?? t.tentativi ?? "—";
  const origineTxt = g ? (g.origine === "registrata" ? "registrata" : g.origine === "ricostruita" ? "ricostruita" : "non disponibile") : null;
  return `<div class="card">
    <div class="sub">oggi · ${esc(t.date || "")}</div>
    <div class="row"><label>coppia</label><div>${coppia}</div></div>
    <div class="row"><label>arco</label><div>${arcoTxt}</div></div>
    <div class="row"><label>modello</label><div>${esc(modello)} · ${tentativi} tentativi</div></div>
    <div class="row"><label>misure</label><div>${misureTxt || "—"}</div></div>
    ${origineTxt ? `<div class="hint" style="margin-top:6px">provenienza: ${esc(origineTxt)}</div>` : ""}
  </div>`;
}

/* "misura questo arco" di UNA sezione: vedi wireMisuraSenzaArco più sopra per
   come viene invocata (bersaglio: solo i giorni del gruppo "senza arco noto",
   ma la ricerca delle coppie [ieri, oggi] usa SEMPRE la cronologia intera del
   canale). In sequenza (sono trasformazioni immagine, non vanno lanciate tutte
   insieme), interrompibile fra un passaggio e l'altro. */
async function measureArchSection(canale, dates, frameMap, state, btn, stopBtn, statusEl) {
  if (state.measuring) return;
  if (!key()) return setStatus(statusEl, "serve la chiave admin (campo in alto): /test-metrics è un endpoint protetto");
  if (dates.length < 2) return setStatus(statusEl, "servono almeno 2 giorni in archivio per misurare un passaggio");

  const pairs = [];
  for (let i = 1; i < dates.length; i++) {
    const b = dates[i];
    const g = AP.store.giorno(canale, b);
    if (!(g && g.origine === "registrata" && g.misure)) pairs.push([dates[i - 1], b]);
  }
  if (!pairs.length) { setStatus(statusEl, "tutti i giorni hanno già misure registrate: nulla da misurare"); return; }

  setStatus(statusEl, "misure grezze, senza confronto con un profilo storico (sconosciuto per questi giorni)…");
  state.abort = false;
  state.measuring = true;
  btn.disabled = true;
  stopBtn.style.display = "";

  let done = 0;
  for (const [a, b] of pairs) {
    if (state.abort) break;
    setStatus(statusEl, `misuro ${done + 1}/${pairs.length}…`);
    try {
      const path = `/test-metrics?ch=${encodeURIComponent(canale)}&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
      const res = await api(path);
      writeMeasuresOnFrame(frameMap, b, res, null); // nessun profilo storico noto: mai colorare rispetto al range di oggi
    } catch (e) {
      writeMeasureError(frameMap, b, e.message);
    }
    done++;
  }
  state.measuring = false;
  btn.disabled = false;
  stopBtn.style.display = "none";
  setStatus(statusEl, state.abort
    ? `interrotto a ${done}/${pairs.length}`
    : `fatto: misurati ${done}/${pairs.length} passaggi senza dati registrati`);
}

/* ---------- wiring statico della barra filtri (elementi presenti fin dal markup) ---------- */
Object.values(FILTRO_SEL).forEach((id) => { if ($(id)) $(id).onchange = scriviHashDaFiltri; });
if ($("archFiltriPulisci")) $("archFiltriPulisci").onclick = () => AP.util.route.vai("archivio", {});
$("archReload").onclick = () => AP.store.carica();

/* ---------- reazioni agli eventi dello STORE ---------- */
AP.store.on("canali", (canali) => buildArchSkeleton(canali));
AP.store.on("catalogo", () => { buildFiltroConceptElement(); riapplicaFiltriDaHash(); });
AP.store.on("usi", () => { buildFiltroConceptElement(); riapplicaFiltriDaHash(); });
// le note (giudizi) possono arrivare prima o dopo che un arco sia già stato
// disegnato: ricalcola solo i conteggi e riapplica il filtro giudizio, senza
// ricostruire il DOM (vedi aggiornaContiGiudizio).
AP.store.on("note", () => { aggiornaContiGiudizio(); applyArchFilter(); });

AP.tabs.archivio = {
  onShow(params = {}) {
    impostaFiltriSelect(params);
    applyArchFilter();
  },
};
