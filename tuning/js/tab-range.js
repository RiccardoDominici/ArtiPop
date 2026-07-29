// TAB RANGE (per concept) + NOTE: marcature buono/scarto e assetti salvati.
//
// Le marcature/assetti vivono qui insieme al Range e non in tab-archivio.js
// perché sono l'unico documento `note:marcature` condiviso fra le due tab (le
// marcature si SCRIVONO cliccando sui fotogrammi dell'Archivio, ma il "quaderno
// di laboratorio" e gli "assetti salvati" sono letture/scritture pensate per chi
// sta tarando i range) — stessa scelta di posto del vecchio index.html
// monolitico. tab-archivio.js chiama le funzioni di marcatura definite qui
// (findNota, applyMarkToFrame, wireMarkControls): sono funzioni globali normali,
// e questo file viene caricato PRIMA di tab-archivio.js (vedi index.html).
window.AP = window.AP || {};
AP.tabs = AP.tabs || {};

let NOTE_ERROR = null; // messaggio se il Worker non espone ancora /note (build più vecchia)
// AP.store.dati.note parte già valorizzato con {giorni:[],assetti:[]} (mai null,
// vedi store.js): senza questo flag "assetti vuoti" e "non ancora arrivati"
// sarebbero indistinguibili.
let noteArrivato = false;

/* ================================================================== */
/* ---------- RANGE: cards, editor, push/reset, download/upload ---------- */
/* ================================================================== */

function renderCards() {
  const tuning = AP.store.dati.tuning;
  const wrap = $("cards"); wrap.innerHTML = "";
  if (!tuning || !tuning.concepts) return;
  for (const [id, p] of Object.entries(tuning.concepts)) {
    const def = tuning.defaults[id];
    const e = AP.store.edit[id];
    if (!e) continue; // difensivo: un concept apparso in /tuning ma non ancora rispecchiato in EDIT (non dovrebbe succedere)
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${p.nome} ${p.overridden ? '<span class="pill on">tarato</span>' : ''}</h3>
      <div class="sub">concept · <code>${id}</code></div>`;
    for (const k of AP.comp.MEAS) {
      const step = k === "compattezza" ? 0.01 : 1;
      const row = document.createElement("div");
      row.innerHTML = `
        <div class="row">
          <label>${AP.comp.MEAS_LABEL[k]}</label>
          <div class="range">
            <input type="number" step="${step}" data-c="${id}" data-k="${k}" data-i="0" value="${e[k][0]}" />
            <span class="sep">→</span>
            <input type="number" step="${step}" data-c="${id}" data-k="${k}" data-i="1" value="${e[k][1]}" />
            <span class="def">def ${def[k][0]}–${def[k][1]}</span>
          </div>
        </div>
        <div class="bar" id="bar-${id}-${k}"></div>`;
      card.appendChild(row);
    }
    const flags = document.createElement("div");
    flags.className = "flags";
    flags.innerHTML = `
      <label><input type="checkbox" data-c="${id}" data-flag="monotona" ${e.monotona ? 'checked' : ''}/> monotona (non torna indietro)</label>
      <label>maxDeriva <input type="text" inputmode="decimal" data-c="${id}" data-flag="maxDeriva" value="${e.maxDeriva ?? ''}" placeholder="auto" style="width:64px;text-align:right"/></label>
      <label>maxDegrado <input type="text" inputmode="decimal" data-c="${id}" data-flag="maxDegrado" value="${e.maxDegrado ?? ''}" placeholder="auto" style="width:64px;text-align:right"/></label>`;
    card.appendChild(flags);
    wrap.appendChild(card);
    AP.comp.MEAS.forEach((k) => drawBar(id, k));
  }
  wrap.querySelectorAll('input[type=number][data-k]').forEach((inp) => inp.oninput = onRangeInput);
  wrap.querySelectorAll('input[data-flag]').forEach((inp) => inp.oninput = onFlagInput);
}

function drawBar(id, k) {
  const bar = $(`bar-${id}-${k}`); if (!bar) return;
  const max = AP.comp.MEAS_MAX[k];
  const e = AP.store.edit[id][k], d = AP.store.dati.tuning.defaults[id][k];
  bar.innerHTML = `<div class="fill" style="left:${e[0] / max * 100}%;width:${(e[1] - e[0]) / max * 100}%"></div>
    <div class="defmark" style="left:${d[0] / max * 100}%;width:${(d[1] - d[0]) / max * 100}%"></div>`;
}

/* BUGFIX: un campo vuoto o non numerico (es. l'utente ha svuotato il campo per
   riscriverlo) non deve mai scrivere NaN in EDIT — altrimenti la barra sparisce e
   buildDoc() manda null al Worker, che scarta il campo in silenzio. Teniamo
   l'ultimo valore valido e segnaliamo solo visivamente il campo incompleto. */
function onRangeInput(ev) {
  const { c, k, i } = ev.target.dataset;
  const raw = ev.target.value;
  const v = parseFloat(raw);
  if (raw.trim() === "" || !Number.isFinite(v)) {
    ev.target.classList.add("invalid");
    markChanged(c);
    return; // EDIT[c][k][i] resta al suo ultimo valore valido
  }
  ev.target.classList.remove("invalid");
  AP.store.edit[c][k][+i] = v;
  drawBar(c, k);
  markChanged(c);
}
function onFlagInput(ev) {
  const { c, flag } = ev.target.dataset;
  if (flag === "monotona") { AP.store.edit[c].monotona = ev.target.checked; markChanged(c); return; }
  // per maxDeriva/maxDegrado un campo VUOTO è un valore legittimo (= guardia globale
  // di default, non un errore); solo un valore non-numerico va segnalato.
  const raw = ev.target.value.trim();
  if (raw === "") { AP.store.edit[c][flag] = null; ev.target.classList.remove("invalid"); markChanged(c); return; }
  const v = strictNumber(raw);
  if (!Number.isFinite(v)) { ev.target.classList.add("invalid"); markChanged(c); return; } // EDIT[c][flag] resta al suo ultimo valore valido: MAI azzerato in silenzio
  ev.target.classList.remove("invalid");
  AP.store.edit[c][flag] = v;
  markChanged(c);
}
function markChanged() { setStatus($("rangeStatus"), "modifiche non ancora lanciate ·", "changed"); }

/* costruisce il documento JSON dei profili dallo stato AP.store.edit */
function buildDoc() {
  const profili = {};
  for (const [id, e] of Object.entries(AP.store.edit)) {
    const def = AP.store.dati.tuning.defaults[id] || {};
    profili[id] = {
      estensione: sanitizePair(e.estensione, def.estensione),
      intensita: sanitizePair(e.intensita, def.intensita),
      compattezza: sanitizePair(e.compattezza, def.compattezza),
      monotona: !!e.monotona,
      maxDeriva: Number.isFinite(e.maxDeriva) ? e.maxDeriva : null,
      maxDegrado: Number.isFinite(e.maxDegrado) ? e.maxDegrado : null,
    };
  }
  return { version: 1, profili };
}
// rete di sicurezza finale: mai NaN/null al posto di un numero — si ricade sul
// default del concept (o 0 se manca pure quello).
function sanitizePair(pair, fallback) {
  let [a, b] = [Number(pair[0]), Number(pair[1])];
  if (!Number.isFinite(a)) a = fallback ? fallback[0] : 0;
  if (!Number.isFinite(b)) b = fallback ? fallback[1] : 0;
  return [a, b];
}

$("reload").onclick = () => AP.store.carica(); // bottone storico: ora ricarica l'intero STORE, non solo /tuning (vedi istruzioni task 5)
$("download").onclick = () => {
  const blob = new Blob([JSON.stringify(buildDoc(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "artipop-range.json"; a.click();
};
$("uploadBtn").onclick = () => $("upload").click();
$("upload").onchange = (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const doc = JSON.parse(r.result);
      const profili = doc.profili || doc;
      for (const [id, p] of Object.entries(profili)) {
        if (!AP.store.edit[id]) continue;
        for (const k of AP.comp.MEAS) if (Array.isArray(p[k])) AP.store.edit[id][k] = p[k].map(Number);
        if (typeof p.monotona === "boolean") AP.store.edit[id].monotona = p.monotona;
        if ("maxDeriva" in p) AP.store.edit[id].maxDeriva = p.maxDeriva;
        if ("maxDegrado" in p) AP.store.edit[id].maxDegrado = p.maxDegrado;
      }
      renderCards();
      setStatus($("rangeStatus"), "JSON caricato (non ancora lanciato)", "changed");
    } catch (e) { setStatus($("rangeStatus"), "JSON non valido: " + e.message); }
  };
  r.readAsText(f);
};
$("push").onclick = async () => {
  if (!key()) return setStatus($("rangeStatus"), "serve la chiave admin");
  try {
    setStatus($("rangeStatus"), "lancio nel Worker…");
    const res = await api("/tuning", { method: "PUT", body: JSON.stringify(buildDoc()) });
    setStatus($("rangeStatus"), `lanciato ✓ (${res.salvati?.length || 0} concept)` + (res.errori?.length ? ` · ${res.errori.join('; ')}` : ''));
    toast("range lanciati nel Worker", "ok");
    setTimeout(() => AP.store.carica(), 800);
  } catch (e) { setStatus($("rangeStatus"), "errore: " + e.message); toastErrore(e, "lancio range"); }
};
$("reset").onclick = async () => {
  if (!key()) return setStatus($("rangeStatus"), "serve la chiave admin");
  if (!confirm("Cancellare l'override e tornare ai default del codice?")) return;
  try { await api("/tuning", { method: "DELETE" }); setStatus($("rangeStatus"), "ripristinati i default"); AP.store.carica(); }
  catch (e) { setStatus($("rangeStatus"), "errore: " + e.message); }
};

/* ================================================================== */
/* ---------- NOTE: marcature buono/scarto + assetti salvati ---------- */
/* ================================================================== */

function findNota(canale, data) {
  return (AP.store.dati.note?.giorni || []).find((g) => g.canale === canale && g.data === data) || null;
}
/* aggiorna lo stato locale SUBITO dopo una PUT riuscita, così l'UI non deve
   aspettare un reload per riflettere la marcatura appena scritta. */
function upsertNotaLocal(canale, data, giudizio, nota) {
  if (!AP.store.dati.note) AP.store.dati.note = { version: 1, updatedAt: new Date().toISOString(), giorni: [], assetti: [] };
  const note = AP.store.dati.note;
  const idx = note.giorni.findIndex((g) => g.canale === canale && g.data === data);
  if (giudizio == null && !nota) {
    if (idx >= 0) note.giorni.splice(idx, 1);
    return;
  }
  const entry = { canale, data, giudizio: giudizio ?? null, nota: nota || "" };
  if (idx >= 0) note.giorni[idx] = entry; else note.giorni.push(entry);
}

/* rimette a posto i badge/bordi/note di TUTTI i fotogrammi già renderizzati
   nell'archivio — utile perché lo STORE e le tab possono aggiornarsi in ordine
   qualunque (rendering progressivo). */
function refreshAllMarks() {
  document.querySelectorAll("#archSections .frame[data-canale]").forEach((cell) => {
    applyMarkToFrame(cell, cell.dataset.canale, cell.dataset.data);
  });
}

function applyMarkToFrame(cell, canale, data) {
  const n = findNota(canale, data);
  cell.classList.remove("marked-buono", "marked-scarto");
  const ind = cell.querySelector(".markIndicator");
  if (n?.giudizio === "buono") { cell.classList.add("marked-buono"); if (ind) ind.innerHTML = '<span class="pill on">✓ buono</span>'; }
  else if (n?.giudizio === "scarto") { cell.classList.add("marked-scarto"); if (ind) ind.innerHTML = '<span class="pill off">✕ scarto</span>'; }
  else if (ind) ind.innerHTML = "";
  const notaInput = cell.querySelector(".markNota");
  // non sovrascrivere mentre l'utente ci sta scrivendo dentro
  if (notaInput && document.activeElement !== notaInput) notaInput.value = n?.nota || "";
}

function wireMarkControls(cell, canale, data) {
  const statusEl = cell.querySelector(".markStatus");
  cell.querySelectorAll(".markBtn").forEach((b) => {
    b.onclick = () => onMarkClick(canale, data, b.dataset.giud, cell, statusEl);
  });
  const notaInput = cell.querySelector(".markNota");
  const notaBtn = cell.querySelector(".markSaveNota");
  if (notaBtn) notaBtn.onclick = () => onNotaSave(canale, data, notaInput.value, cell, statusEl);
}

/* click su "buono"/"scarto": un secondo click sullo STESSO giudizio lo toglie (torna a null). */
async function onMarkClick(canale, data, giud, cell, statusEl) {
  if (!key()) { statusEl.textContent = "serve la chiave admin per marcare"; return; }
  const current = findNota(canale, data);
  const nextGiud = current?.giudizio === giud ? null : giud;
  const notaVal = cell.querySelector(".markNota")?.value || "";
  statusEl.textContent = "salvo…";
  try {
    await api("/note/giorno", { method: "PUT", body: JSON.stringify({ canale, data, giudizio: nextGiud, nota: notaVal }) });
    upsertNotaLocal(canale, data, nextGiud, notaVal);
    applyMarkToFrame(cell, canale, data);
    renderNotebook();
    statusEl.textContent = "salvato ✓";
  } catch (e) {
    statusEl.textContent = "errore: " + e.message;
  }
}
async function onNotaSave(canale, data, notaVal, cell, statusEl) {
  if (!key()) { statusEl.textContent = "serve la chiave admin per salvare la nota"; return; }
  const current = findNota(canale, data);
  statusEl.textContent = "salvo…";
  try {
    await api("/note/giorno", { method: "PUT", body: JSON.stringify({ canale, data, giudizio: current?.giudizio ?? null, nota: notaVal }) });
    upsertNotaLocal(canale, data, current?.giudizio ?? null, notaVal);
    applyMarkToFrame(cell, canale, data);
    renderNotebook();
    statusEl.textContent = "salvato ✓";
  } catch (e) {
    statusEl.textContent = "errore: " + e.message;
  }
}

/* "quaderno di laboratorio": i giorni segnati buono, con la combinazione e i
   range in vigore quel giorno. Vive in #archNotebook (markup della tab Archivio)
   ma si aggiorna sia da qui sia da tab-archivio.js (via AP.store.giorno). */
function renderNotebook() {
  const box = $("archNotebook");
  if (!box) return;
  if (NOTE_ERROR) { box.innerHTML = `<div class="card"><h3 style="margin-bottom:4px">📓 Quaderno di laboratorio</h3><div class="hint">${esc(NOTE_ERROR)}</div></div>`; return; }
  if (!noteArrivato) { box.innerHTML = `<div class="card"><h3 style="margin-bottom:4px">📓 Quaderno di laboratorio</h3><div class="hint">note non ancora caricate…</div></div>`; return; }
  const note = AP.store.dati.note;
  const buoni = (note.giorni || []).filter((g) => g.giudizio === "buono")
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0) || a.canale.localeCompare(b.canale));
  if (!buoni.length) {
    box.innerHTML = `<div class="card"><h3 style="margin-bottom:4px">📓 Quaderno di laboratorio</h3>
      <div class="hint">Nessun giorno ancora segnato "buono". Segna un fotogramma qui sotto per iniziare a
      costruire la tua raccolta dei migliori parametri.</div></div>`;
    return;
  }
  const rows = buoni.map((n) => {
    const g = AP.store.giorno(n.canale, n.data);
    const coppia = g ? AP.comp.coppiaLabelHTML(g.conceptNome, g.concept, g.elementNome, g.element, AP.comp.isNativePairing(g.concept, g.element))
      : `<span class="hint">combinazione non nota (apri "↻ Aggiorna" in alto)</span>`;
    const profTxt = (g && g.origine === "registrata" && g.profilo)
      ? AP.comp.MEAS.map((k) => `${AP.comp.MEAS_LABEL[k]} ${g.profilo[k][0]}–${g.profilo[k][1]}`).join(" · ")
      : `<span class="hint">range non disponibili (provenienza ${esc(g?.origine || "non disponibile")})</span>`;
    return `<div style="padding:9px 0;border-bottom:1px solid var(--line)">
      <div><b>${esc(n.canale)}</b> · ${esc(n.data)} — ${coppia}</div>
      <div class="hint" style="margin-top:3px">${profTxt}</div>
      ${n.nota ? `<div style="margin-top:3px">${esc(n.nota)}</div>` : ""}
    </div>`;
  }).join("");
  box.innerHTML = `<div class="card">
    <h3 style="margin-bottom:4px">📓 Quaderno di laboratorio · ${buoni.length} giorni segnati "buono"</h3>
    <div class="hint" style="margin-bottom:8px">Le combinazioni e i range in vigore nel giorno in cui il
      fotogramma fu generato.</div>
    ${rows}
  </div>`;
}

/* ---------- assetti salvati (tab Range) ---------- */
function renderAssettiList() {
  const box = $("assettiList");
  if (!box) return;
  if (NOTE_ERROR) { box.innerHTML = `<div class="hint">${esc(NOTE_ERROR)}</div>`; return; }
  if (!noteArrivato) { box.innerHTML = `<div class="hint">assetti non ancora caricati · premi "↻ Aggiorna" in alto.</div>`; return; }
  const note = AP.store.dati.note;
  const assetti = note.assetti || [];
  if (!assetti.length) {
    box.innerHTML = `<div class="hint">Nessun assetto salvato ancora. Regola i range qui sopra e usa "💾 Salva questo assetto" per fotografarli con un nome.</div>`;
    return;
  }
  box.innerHTML = `<h3 style="font-size:14px;margin:0 0 10px">Assetti salvati</h3>` + assetti.map((a) => `
    <div class="itemrow" style="cursor:default;margin-bottom:6px">
      <span>
        <b>${esc(a.nome)}</b><br>
        <code>${esc(a.id)}</code>${a.creatoIl ? ` · ${esc(new Date(a.creatoIl).toLocaleString())}` : ""}
        ${a.nota ? `<div class="hint" style="margin-top:3px">${esc(a.nota)}</div>` : ""}
      </span>
      <span class="badges" style="flex-direction:row;gap:6px">
        <button class="ghost assettoLoad" data-id="${esc(a.id)}">↧ carica nell'editor</button>
        <button class="ghost assettoDelete" data-id="${esc(a.id)}">🗑</button>
      </span>
    </div>`).join("");
  box.querySelectorAll(".assettoLoad").forEach((b) => b.onclick = () => loadAssettoIntoEditor(b.dataset.id));
  box.querySelectorAll(".assettoDelete").forEach((b) => b.onclick = () => deleteAssetto(b.dataset.id));
}

/* carica un assetto salvato dentro AP.store.edit SENZA lanciarlo: solo dopo un
   "🚀 Lancia nel Worker" esplicito diventa effettivo, esattamente come un JSON
   caricato da file. */
function loadAssettoIntoEditor(id) {
  const a = (AP.store.dati.note?.assetti || []).find((x) => x.id === id);
  if (!a) return;
  for (const [fam, prof] of Object.entries(a.profili || {})) {
    if (!AP.store.edit[fam]) continue; // l'assetto può nominare famiglie non presenti nel catalogo corrente: si ignorano, non si inventano
    AP.store.edit[fam] = {
      estensione: [...prof.estensione], intensita: [...prof.intensita], compattezza: [...prof.compattezza],
      monotona: !!prof.monotona, maxDeriva: prof.maxDeriva ?? null, maxDegrado: prof.maxDegrado ?? null,
    };
  }
  renderCards();
  setStatus($("rangeStatus"), `assetto "${a.nome}" caricato nell'editor (non ancora lanciato)`, "changed");
}

async function deleteAssetto(id) {
  if (!key()) { setStatus($("rangeStatus"), "serve la chiave admin"); return; }
  if (!confirm("Eliminare questo assetto salvato?")) return;
  try {
    await api(`/note/assetto?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await fetchNoteEQuietRefresh();
    setStatus($("rangeStatus"), "assetto eliminato");
  } catch (e) {
    setStatus($("rangeStatus"), "errore: " + e.message);
  }
}

function slugify(s) {
  return (String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32)) || "assetto";
}

function showSaveAssettoPanel() {
  const existing = $("assettoSavePanel");
  if (existing) { existing.remove(); return; } // premuto di nuovo: chiudi il pannello
  const panel = document.createElement("div");
  panel.id = "assettoSavePanel";
  panel.className = "card";
  panel.style.cssText = "max-width:480px;margin:14px 0";
  panel.innerHTML = `
    <h3 style="margin-bottom:8px">Salva l'assetto corrente</h3>
    <div class="hint" style="margin-bottom:12px">Fotografa TUTTI i range attuali nell'editor (anche quelli non
      ancora lanciati nel Worker) con un nome, per poterci tornare o confrontarli in seguito.</div>
    <div class="field"><label>nome</label><input type="text" id="assettoNome" maxlength="60" placeholder="es. taratura conservativa luglio" /></div>
    <div class="field"><label>nota</label><textarea id="assettoNota" maxlength="300" placeholder="perché la salvi…"></textarea></div>
    <div id="assettoErrors"></div>
    <div class="formactions">
      <button id="assettoConfirm" class="primary">Salva</button>
      <span class="status" id="assettoSaveStatus"></span>
    </div>`;
  $("cards").insertAdjacentElement("afterend", panel);
  $("assettoConfirm").onclick = confirmSaveAssetto;
}

async function confirmSaveAssetto() {
  if (!key()) { setStatus($("assettoSaveStatus"), "serve la chiave admin"); return; }
  const nome = $("assettoNome").value.trim();
  const nota = $("assettoNota").value.trim();
  if (!nome) { $("assettoErrors").innerHTML = `<div class="errbox">nome: obbligatorio</div>`; return; }
  $("assettoErrors").innerHTML = "";
  const id = slugify(nome) + "-" + Date.now().toString(36).slice(-4); // suffisso: evita collisioni fra nomi simili
  const profili = buildDoc().profili; // TUTTI i profili correnti, stessa forma già usata da /tuning PUT
  try {
    setStatus($("assettoSaveStatus"), "salvo…");
    await api("/note/assetto", { method: "PUT", body: JSON.stringify({ id, nome, nota, profili }) });
    setStatus($("assettoSaveStatus"), "salvato ✓");
    $("assettoSavePanel")?.remove();
    await fetchNoteEQuietRefresh();
  } catch (e) {
    $("assettoErrors").innerHTML = `<div class="errbox"><b>Il Worker segnala:</b><ul>${errFromCatch(e).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    setStatus($("assettoSaveStatus"), "");
  }
}
$("assettoSave").onclick = showSaveAssettoPanel;

/* dopo una scrittura su /note/assetto o /note/giorno conviene rileggere il
   documento intero (altri campi potrebbero essere cambiati nel frattempo da
   un'altra scheda) invece di limitarsi all'aggiornamento ottimistico locale:
   un mini-reload mirato, senza passare per l'intero AP.store.carica(). */
async function fetchNoteEQuietRefresh() {
  try {
    AP.store.dati.note = await api("/note");
    NOTE_ERROR = null;
    noteArrivato = true;
    AP.store.emit("note", AP.store.dati.note); // solo sul successo (vedi store.js, fetchCanali)
  } catch (e) {
    NOTE_ERROR = `questo Worker non espone ancora /note: aggiornalo per segnare giorni e salvare assetti. (dettaglio: ${e.message})`;
  }
  renderAssettiList();
  renderNotebook();
  refreshAllMarks();
}

/* ---------- reazioni agli eventi dello STORE ---------- */
AP.store.on("tuning", () => { renderCards(); setStatus($("rangeStatus"), "caricato"); });
AP.store.on("note", () => { NOTE_ERROR = null; noteArrivato = true; renderAssettiList(); renderNotebook(); refreshAllMarks(); });
AP.store.on("errore", (info) => {
  if (info.sezione === "note") {
    NOTE_ERROR = `questo Worker non espone ancora /note: aggiornalo per segnare giorni e salvare assetti. (dettaglio: ${info.errore.message})`;
    renderAssettiList();
    renderNotebook();
  }
  if (info.sezione === "tuning") setStatus($("rangeStatus"), "errore: " + info.errore.message);
});
// "usi" arriva dopo che TUTTI gli archivi sono stati elaborati (rendering
// progressivo terminato): è il momento in cui il quaderno può arricchirsi con la
// combinazione/profilo di ogni giorno segnato "buono" (AP.store.giorno ora sa
// rispondere per ogni canale, non solo per quelli caricati per primi).
AP.store.on("usi", () => { renderNotebook(); });

AP.tabs.range = {
  onShow() {
    renderCards();
    renderAssettiList();
    renderNotebook();
  },
};
