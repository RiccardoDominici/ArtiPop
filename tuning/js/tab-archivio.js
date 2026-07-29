// TAB ARCHIVIO: mostra TUTTO quello che è mai stato generato, un canale (attivo
// o storico) alla volta, impilati. A differenza del vecchio index.html, i canali
// e gli archivi arrivano dallo STORE (fetch paralleli, non un `await` dentro un
// `for`): questa tab si limita a costruire lo scheletro appena arriva l'elenco
// canali e a riempire ogni sezione appena arriva IL SUO archivio — rendering
// progressivo, un canale non aspetta l'altro. Le marcature buono/scarto
// (findNota/applyMarkToFrame/wireMarkControls) vivono in tab-range.js, caricato
// prima di questo file: vedi il commento in testa a quel file per il perché.
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

const archSectionState = new Map(); // canale -> { abort, measuring }, uno stato indipendente per sezione
const archSubscribed = new Set();   // canali già agganciati all'evento "archivio:<id>" (evita doppie sottoscrizioni sui reload successivi)

/* ---------- scheletro: una sezione per canale, nell'ordine con cui li elenca /api/channels ---------- */
function buildArchSkeleton(canali) {
  const wrap = $("archSections");
  wrap.innerHTML = "";
  $("archFlusso").innerHTML = `<option value="tutti">tutti</option>`;
  let historicalHeaderEl = null;

  for (const ch of canali) {
    if (ch.storico && !historicalHeaderEl) {
      historicalHeaderEl = document.createElement("div");
      historicalHeaderEl.id = "archHistoricalHeader";
      historicalHeaderEl.style.cssText = "margin:26px 0 12px;padding-top:16px;border-top:1px solid var(--line);"
        + "color:var(--dim);font-size:12.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase";
      historicalHeaderEl.textContent = 'Archivi storici · canali chiusi, senza generazione "oggi"';
      wrap.appendChild(historicalHeaderEl);
    }
    const root = document.createElement("div");
    root.className = "arch-section";
    root.dataset.channel = ch.id;
    root.dataset.kind = ch.storico ? "storico" : "active";
    root.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <h3 style="margin:0">${esc(ch.emoji || "")} ${esc(ch.name || ch.id)}</h3>
        <span class="hint archSectionCount"><span class="spinner"></span> carico…</span>
      </div>
      <div class="arch-today" style="margin-bottom:10px"></div>
      <div class="labctl" style="margin-bottom:8px;display:none">
        <button class="archSectionMeasure"></button>
        <button class="archSectionStop ghost" style="display:none">⏹ Interrompi</button>
        <span class="status archSectionStatus"></span>
      </div>
      <div class="film"></div>`;
    wrap.appendChild(root);

    const opt = document.createElement("option");
    opt.value = ch.id;
    opt.textContent = `${ch.emoji || ""} ${ch.name || ch.id}`.trim();
    $("archFlusso").appendChild(opt);

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
  applyArchFilter();
  aggiornaRiepilogo();
}

/* ---------- riempie UNA sezione appena il suo archivio è disponibile ---------- */
function fillArchSection(ch, arch) {
  const root = document.querySelector(`.arch-section[data-channel="${ch.id}"]`);
  if (!root) return; // lo scheletro è stato ricostruito con un elenco canali diverso nel frattempo
  const countEl = root.querySelector(".archSectionCount");

  if (!arch || !Array.isArray(arch.dates) || !arch.dates.length) {
    countEl.innerHTML = arch ? "0 giorni" : `<span class="hint">canale non raggiungibile</span>`;
    root.querySelector(".film").innerHTML = "";
    root.querySelector(".arch-today").innerHTML = "";
    root.querySelector(".labctl").style.display = "none";
    aggiornaRiepilogo();
    return;
  }

  const dates = [...arch.dates].reverse(); // l'endpoint risponde dal più recente: qui si legge come una storia, dal più vecchio
  countEl.textContent = `${dates.length} giorni · ${dates[0]} → ${dates[dates.length - 1]}`;

  const todayGiorno = ch.today?.date ? AP.store.giorno(ch.id, ch.today.date) : null;
  root.querySelector(".arch-today").innerHTML = ch.storico ? "" : buildTodayCardHTML(ch, todayGiorno);

  const filmEl = root.querySelector(".film");
  filmEl.innerHTML = "";
  const frameMap = new Map(); // data -> elemento .measures (solo per chi non ha provenienza registrata)
  for (const date of dates) {
    const g = AP.store.giorno(ch.id, date);
    const imgUrl = `${base()}/w/${encodeURIComponent(ch.id)}?date=${encodeURIComponent(date)}`;
    const cell = document.createElement("div");
    cell.className = "frame";
    cell.dataset.canale = ch.id;
    cell.dataset.data = date;
    cell.innerHTML = `
      <img loading="lazy" src="${imgUrl}" alt="${esc(date)}" style="cursor:pointer" title="apri a piena risoluzione in una scheda nuova" />
      <div class="meta">${buildFrameHTML(ch.id, date, g)}</div>`;
    cell.querySelector("img").onclick = () => window.open(imgUrl, "_blank"); // niente lightbox in questo task: solo l'immagine, a piena risoluzione
    const measuresEl = cell.querySelector(".measures");
    if (measuresEl) frameMap.set(date, measuresEl);
    applyMarkToFrame(cell, ch.id, date);
    wireMarkControls(cell, ch.id, date);
    filmEl.appendChild(cell);
  }

  // "misura questo arco" è superfluo per i giorni con provenienza già registrata
  // (misure comprese): resta solo per chi ne è privo.
  const missingDates = dates.slice(1).filter((d) => {
    const g = AP.store.giorno(ch.id, d);
    return !(g && g.origine === "registrata" && g.misure);
  });
  const measureBtn = root.querySelector(".archSectionMeasure");
  const stopBtn = root.querySelector(".archSectionStop");
  const statusEl = root.querySelector(".archSectionStatus");
  measureBtn.textContent = missingDates.length
    ? `📏 Misura i giorni senza dati registrati (${missingDates.length})`
    : `📏 tutti i giorni hanno già misure registrate`;
  measureBtn.disabled = !missingDates.length;
  root.querySelector(".labctl").style.display = "";

  const state = archSectionState.get(ch.id) || { abort: false, measuring: false };
  archSectionState.set(ch.id, state);
  measureBtn.onclick = () => measureArchSection(ch.id, dates, frameMap, state, measureBtn, stopBtn, statusEl);
  stopBtn.onclick = () => { state.abort = true; };

  applyArchFilter(); // riapplica il filtro corrente (utile se era già impostato su un canale)
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

$("archReload").onclick = () => AP.store.carica();
$("archFlusso").onchange = applyArchFilter;

/* filtro facoltativo: "tutti" mostra ogni sezione già caricata, un id isola solo
   quella (e nasconde l'intestazione degli storici se il canale isolato è attivo,
   o viceversa). */
function applyArchFilter() {
  const val = $("archFlusso").value || "tutti";
  let anyHistoricalVisible = false;
  document.querySelectorAll("#archSections .arch-section").forEach((sec) => {
    const show = val === "tutti" || sec.dataset.channel === val;
    sec.style.display = show ? "" : "none";
    if (show && sec.dataset.kind === "storico") anyHistoricalVisible = true;
  });
  const hdr = $("archHistoricalHeader");
  if (hdr) hdr.style.display = anyHistoricalVisible ? "" : "none";
}

/* contenuto del riquadro "oggi": solo per i flussi attivi, legge il meta già
   incluso in /api/channels e, se disponibile, la carta d'identità del giorno
   odierno. Un flusso attivo SENZA generazione oggi ha un messaggio dedicato
   invece di restare vuoto in silenzio. */
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
  const coppia = coppiaLabelHTML(conceptNome, conceptId, elementNome, elementId, isNativePairing(conceptId, elementId));
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

/* "misura questo arco" di UNA sezione: una chiamata /test-metrics per ogni coppia
   di giorni CONSECUTIVI il cui secondo giorno NON ha già provenienza registrata.
   In sequenza (sono trasformazioni immagine, non vanno lanciate tutte insieme),
   interrompibile fra un passaggio e l'altro. Il profilo storico di questi giorni
   non è noto — quindi le misure restano SENZA colore invece di essere confrontate
   col range di oggi, che sarebbe fuorviante. Ogni sezione ha il proprio pulsante e
   il proprio stato: misurare un canale non blocca né interrompe la misurazione
   di un altro. */
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

/* ---------- reazioni agli eventi dello STORE ---------- */
AP.store.on("canali", (canali) => buildArchSkeleton(canali));

AP.tabs.archivio = {
  onShow() {
    // niente da (ri)caricare qui: lo scheletro/le sezioni si aggiornano da soli
    // reagendo agli eventi dello STORE, anche mentre questa tab non è quella
    // visibile. Un riapplica-filtro difensivo è comunque a costo zero.
    applyArchFilter();
  },
};
