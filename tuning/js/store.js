// STORE condiviso: unico punto da cui le tab leggono canali, archivi, catalogo,
// note e profili di tuning. Sostituisce gli stati sparsi (DATA/EDIT/CAT/NOTE/
// ARCH_GIORNI del vecchio index.html monolitico) con un solo oggetto in memoria,
// caricato con fetch IN PARALLELO (mai un await dentro un for) ed eventi per il
// rendering progressivo. Da qui si deriva anche l'indice degli usi (client-side,
// nessun aggregato nuovo lato backend).
//
// Contratto (vedi tuning/DESIGN.md e le istruzioni del task): i nomi e le forme
// qui sotto sono quelli su cui faranno affidamento i redesign delle viste (task
// 6-8) — non rinominarli senza aggiornare anche loro.
window.AP = window.AP || {};
AP.store = AP.store || {};

/* ---------- stato condiviso ---------- */
AP.store.dati = {
  canali: [],                                          // da GET /api/channels?all=1 (attivi + storici)
  archivi: {},                                          // canaleId -> { channel, dates, giorni } da GET /api/archive/<id>, o null se non raggiungibile
  catalogo: { concepts: [], elements: [] },             // da GET /catalogo
  note: { giorni: [], assetti: [] },                    // da GET /note
  tuning: { concepts: {}, defaults: {}, elements: [] }, // da GET /tuning
};
AP.store.edit = {};   // copia di lavoro dei profili (Range e Lab scrivono qui, per questo vive nello store)
AP.store.usi = { concept: {}, element: {} }; // indice derivato, ricalcolato a ogni carica()

/* ---------- mini event emitter (vedi util.js) ---------- */
const _storeEmitter = creaEmitter();
AP.store.on = _storeEmitter.on;
AP.store.emit = _storeEmitter.emit;

/* ---------- fetch dei singoli documenti ----------
   Ognuna aggiorna AP.store.dati e poi emette il proprio evento: sono pensate per
   girare TUTTE in parallelo (vedi carica() più sotto), non in sequenza. Un
   fallimento in una non blocca le altre: si segnala con "errore" e si prosegue —
   esattamente come faceva il vecchio loadAllArchives() canale per canale, ma ora
   per OGNI documento, non solo per gli archivi. */

async function fetchCanali() {
  try {
    const res = await api("/api/channels?all=1");
    AP.store.dati.canali = res.channels || [];
    // emesso SOLO in caso di successo: a differenza di "archivio:<id>" (dove il
    // valore null è comunque un'informazione utile), qui chi ascolta (es. il
    // pill "connesso" in app.js) deve poter fidarsi che "canali" significhi
    // davvero "il Worker ha risposto" — altrimenti un errore verrebbe subito
    // sovrascritto da un evento "successo" con la lista vuota di ripiego.
    AP.store.emit("canali", AP.store.dati.canali);
  } catch (e) {
    AP.store.dati.canali = [];
    AP.store.emit("errore", { sezione: "canali", errore: e });
  }
  return AP.store.dati.canali;
}

async function fetchArchivio(canaleId) {
  try {
    // limit=400 (non 60): l'indice degli usi ha bisogno di vedere l'archivio
    // intero di un canale, non solo il più recente (vedi DESIGN.md).
    const res = await api(`/api/archive/${encodeURIComponent(canaleId)}?limit=400`);
    AP.store.dati.archivi[canaleId] = res;
  } catch (e) {
    AP.store.dati.archivi[canaleId] = null;
    AP.store.emit("errore", { sezione: `archivio:${canaleId}`, errore: e });
  }
  // A differenza di canali/catalogo/note/tuning: qui si emette ANCHE in caso di
  // errore (con valore null). Non c'è ambiguità da risolvere (nessun altro
  // evento "di successo" arriverebbe a sovrascrivere un fallimento): serve
  // solo a dire a tab-archivio.js "questo canale è stato tentato", perché
  // possa smettere di mostrare lo scheletro "carico…" e passare a "non
  // raggiungibile" invece di restare in attesa per sempre.
  AP.store.emit(`archivio:${canaleId}`, AP.store.dati.archivi[canaleId]);
  return AP.store.dati.archivi[canaleId];
}

async function fetchCatalogo() {
  try {
    AP.store.dati.catalogo = await api("/catalogo");
    AP.store.emit("catalogo", AP.store.dati.catalogo); // solo sul successo, stesso motivo di fetchCanali
  } catch (e) {
    AP.store.emit("errore", { sezione: "catalogo", errore: e });
  }
  return AP.store.dati.catalogo;
}

async function fetchNote() {
  try {
    AP.store.dati.note = await api("/note");
    AP.store.emit("note", AP.store.dati.note); // solo sul successo, stesso motivo di fetchCanali
  } catch (e) {
    AP.store.emit("errore", { sezione: "note", errore: e });
  }
  return AP.store.dati.note;
}

async function fetchTuning() {
  try {
    AP.store.dati.tuning = await api("/tuning");
    rebuildEdit();
    AP.store.emit("tuning", AP.store.dati.tuning); // solo sul successo, stesso motivo di fetchCanali
  } catch (e) {
    AP.store.emit("errore", { sezione: "tuning", errore: e });
  }
  return AP.store.dati.tuning;
}

/* EDIT riparte SEMPRE dai valori EFFETTIVI (default + eventuale override in KV),
   esattamente come il vecchio reload(): è la copia di lavoro che Range modifica
   e che Lab può proporre di sovrascrivere (proponiRange). Si RIASSEGNA (non si
   svuota in place): ogni consumatore legge AP.store.edit al momento dell'uso,
   mai una copia tenuta in una variabile locale a lungo termine. */
function rebuildEdit() {
  const tuning = AP.store.dati.tuning;
  const edit = {};
  if (tuning && tuning.concepts) {
    for (const [id, p] of Object.entries(tuning.concepts)) {
      edit[id] = {
        estensione: [...p.estensione], intensita: [...p.intensita], compattezza: [...p.compattezza],
        monotona: p.monotona, maxDeriva: p.maxDeriva, maxDegrado: p.maxDegrado,
      };
    }
  }
  AP.store.edit = edit;
}

/* ---------- caricamento completo ----------
   Fetch IN PARALLELO: i canali sono un prerequisito per sapere quali archivi
   interrogare, ma catalogo/note/tuning NON dipendono dai canali e partono subito
   insieme a loro; appena i canali arrivano, ogni archivio parte a sua volta in
   parallelo con Promise.all (mai un await dentro un for, a differenza del vecchio
   loadAllArchives). Il rendering progressivo lo fa chi ascolta "archivio:<id>":
   ogni canale appare appena la SUA risposta arriva, senza aspettare gli altri. */
AP.store.carica = async function carica(opzioni = {}) {
  const canaliPromise = fetchCanali();
  const catalogoPromise = fetchCatalogo();
  const notePromise = fetchNote();
  const tuningPromise = fetchTuning();

  const canali = await canaliPromise;
  const archiviPromise = Promise.all(canali.map((ch) => fetchArchivio(ch.id)));

  await Promise.all([archiviPromise, catalogoPromise, notePromise, tuningPromise]);

  AP.store.usi = buildUsi();
  AP.store.emit("usi", AP.store.usi);
};

/* ---------- letture di comodo ---------- */

/** Carta d'identità di un giorno dalla cache, o null se il canale non è ancora
    stato caricato o non contiene quella data. */
AP.store.giorno = function giorno(canale, data) {
  const arch = AP.store.dati.archivi[canale];
  if (!arch || !Array.isArray(arch.giorni)) return null;
  const idx = (arch.dates || []).indexOf(data);
  return idx >= 0 ? (arch.giorni[idx] || null) : null;
};

/** Raggruppa i giorni di un canale in archi (stessa coppia concept+element e
    stesso `arco`): [{canale, arco, concept, element, dal, al, giorni:[...]}].
    I giorni senza arco noto (provenienza ricostruita/assente) restano fuori:
    la vista Archivio li tratta a parte ("giorni senza arco noto"), non è
    onesto inventargli un raggruppamento. */
AP.store.archiDi = function archiDi(canale) {
  const arch = AP.store.dati.archivi[canale];
  if (!arch || !Array.isArray(arch.giorni)) return [];
  const gruppi = new Map(); // "concept|element|arco" -> giorni[]
  for (const g of arch.giorni) {
    if (g.arco == null) continue;
    const chiave = `${g.concept}|${g.element}|${g.arco}`;
    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
    gruppi.get(chiave).push(g);
  }
  const archi = [];
  for (const giorniArco of gruppi.values()) {
    giorniArco.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    const primo = giorniArco[0];
    archi.push({
      canale, arco: primo.arco, concept: primo.concept, element: primo.element,
      dal: giorniArco[0].data, al: giorniArco[giorniArco.length - 1].data,
      giorni: giorniArco,
    });
  }
  // più recente prima: coerente con l'ordine con cui si legge l'archivio nel tool.
  archi.sort((a, b) => (a.dal < b.dal ? 1 : a.dal > b.dal ? -1 : 0));
  return archi;
};

/* ---------- indice degli usi (client-side, da catalogo + archivi + note) ---------- */
/* Un concept è "in produzione" su un canale attivo se è nella sua indole
   (`famiglie`) oppure se un element pubblicato su quel canale lo ha come
   famigliaNativa — stessa regola del Worker (vedi channels.js/poolForWith),
   ricalcolata qui lato client per non introdurre un aggregato nuovo lato server. */
function buildUsi() {
  const cat = AP.store.dati.catalogo || { concepts: [], elements: [] };
  const usiConcept = {};
  const usiElement = {};
  const vociVuoteConcept = () => ({ elementiNativi: [], elementiPubblicati: [], archi: [], giorni: 0, canali: [], canaliProduzione: [], buoni: 0, scarti: 0 });
  const vociVuoteElement = () => ({ concept: null, pubblicatoSu: null, archi: [], giorni: 0, canali: [], ultimoUso: null, buoni: 0, scarti: 0 });

  for (const c of cat.concepts || []) usiConcept[c.id] = vociVuoteConcept();
  for (const e of cat.elements || []) {
    const ue = vociVuoteElement();
    ue.concept = e.famigliaNativa || null;
    ue.pubblicatoSu = e.pubblicato ? (e.canale || null) : null;
    usiElement[e.id] = ue;
    if (e.famigliaNativa) {
      if (!usiConcept[e.famigliaNativa]) usiConcept[e.famigliaNativa] = vociVuoteConcept();
      usiConcept[e.famigliaNativa].elementiNativi.push(e.id);
      if (e.pubblicato) usiConcept[e.famigliaNativa].elementiPubblicati.push(e.id);
    }
  }

  const canaliAttivi = (AP.store.dati.canali || []).filter((c) => !c.storico);
  for (const ch of canaliAttivi) {
    const inProduzione = new Set(ch.famiglie || []);
    for (const e of cat.elements || []) {
      if (e.pubblicato && e.canale === ch.id && e.famigliaNativa) inProduzione.add(e.famigliaNativa);
    }
    for (const conceptId of inProduzione) {
      if (!usiConcept[conceptId]) usiConcept[conceptId] = vociVuoteConcept();
      if (!usiConcept[conceptId].canaliProduzione.includes(ch.id)) usiConcept[conceptId].canaliProduzione.push(ch.id);
    }
  }

  const noteGiorni = (AP.store.dati.note || {}).giorni || [];
  const giudizioDi = (canale, data) => {
    const n = noteGiorni.find((x) => x.canale === canale && x.data === data);
    return n ? n.giudizio : null;
  };

  for (const [canaleId, arch] of Object.entries(AP.store.dati.archivi || {})) {
    if (!arch || !Array.isArray(arch.giorni)) continue;
    for (const g of arch.giorni) {
      if (!g.concept && !g.element) continue; // provenienza assente: non contribuisce all'indice
      const giud = giudizioDi(canaleId, g.data);
      if (g.concept) {
        if (!usiConcept[g.concept]) usiConcept[g.concept] = vociVuoteConcept();
        const uc = usiConcept[g.concept];
        uc.giorni++;
        if (!uc.canali.includes(canaleId)) uc.canali.push(canaleId);
        if (giud === "buono") uc.buoni++; else if (giud === "scarto") uc.scarti++;
      }
      if (g.element) {
        if (!usiElement[g.element]) usiElement[g.element] = vociVuoteElement();
        const ue = usiElement[g.element];
        ue.giorni++;
        if (!ue.canali.includes(canaleId)) ue.canali.push(canaleId);
        if (giud === "buono") ue.buoni++; else if (giud === "scarto") ue.scarti++;
        if (!ue.ultimoUso || g.data > ue.ultimoUso) ue.ultimoUso = g.data;
      }
    }
  }

  for (const canaleId of Object.keys(AP.store.dati.archivi || {})) {
    for (const arco of AP.store.archiDi(canaleId)) {
      const nGiorni = arco.giorni.length;
      if (arco.concept && usiConcept[arco.concept]) {
        usiConcept[arco.concept].archi.push({ canale: canaleId, arco: arco.arco, element: arco.element, dal: arco.dal, al: arco.al, nGiorni });
      }
      if (arco.element && usiElement[arco.element]) {
        usiElement[arco.element].archi.push({ canale: canaleId, arco: arco.arco, concept: arco.concept, dal: arco.dal, al: arco.al, nGiorni });
      }
    }
  }

  return { concept: usiConcept, element: usiElement };
}

/* ---------- storico dei run del Lab (localStorage) ---------- */
/* Persistente fra ricariche e cambi di tab: la UI che lo mostra arriva nel
   redesign del Lab (task 6), qui nasce solo il magazzino. Tetto ~100 run: i più
   vecchi escono (unshift + troncamento, il più recente resta sempre in testa). */
const LAB_RUNS_KEY = "artipop_lab_runs";
const LAB_RUNS_MAX = 100;

function labRunsList() {
  try {
    const raw = localStorage.getItem(LAB_RUNS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn("[store] storico Lab illeggibile, considerato vuoto:", e.message);
    return [];
  }
}
function labRunsAdd(run) {
  const list = labRunsList();
  const conId = run.id || `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const voce = { ...run, id: conId, salvatoIl: run.salvatoIl || new Date().toISOString() };
  list.unshift(voce);
  if (list.length > LAB_RUNS_MAX) list.length = LAB_RUNS_MAX;
  localStorage.setItem(LAB_RUNS_KEY, JSON.stringify(list));
  return voce;
}
function labRunsRemove(id) {
  const list = labRunsList().filter((r) => r.id !== id);
  localStorage.setItem(LAB_RUNS_KEY, JSON.stringify(list));
}
function labRunsClear() { localStorage.removeItem(LAB_RUNS_KEY); }

AP.store.labRuns = { list: labRunsList, add: labRunsAdd, remove: labRunsRemove, clear: labRunsClear };
