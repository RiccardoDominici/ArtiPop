// Helper generici del tool di tuning: selettore DOM breve, connessione al Worker
// (URL + chiave admin), escape/clone, chiamate HTTP, hash-router e toast.
// Nessuna logica di dominio qui dentro: solo fondamenta usate da tutti gli altri file.
//
// Script classico (niente <script type="module">, bloccato da file://): le funzioni
// qui sotto sono dichiarazioni `function` in cima allo script, quindi diventano
// proprietà dell'oggetto globale (come `var`) e restano richiamabili SENZA prefisso
// da ogni file caricato dopo di questo (util.js è il primo <script src>, vedi
// index.html). In più, ognuna viene anche agganciata a `AP.util.*`: è il namespace
// esplicito richiesto da tuning/DESIGN.md, quello su cui i file successivi (store,
// componenti, tab) possono contare quando serve un riferimento qualificato (es. per
// le COSTANTI condivise, che invece — a differenza delle funzioni — non è garantito
// restino visibili "nude" da uno script tag all'altro).
window.AP = window.AP || {};
AP.util = AP.util || {};

/* ---------- selettore DOM breve, usato ovunque nel tool ---------- */
function $(id) { return document.getElementById(id); }
AP.util.$ = $;

/* ---------- connessione: URL del Worker + chiave admin ---------- */
const DEFAULT_BASE = "https://artipop.riccardo-dominici.workers.dev";
const LS = { base: "artipop_base", key: "artipop_key" };
AP.util.DEFAULT_BASE = DEFAULT_BASE;
AP.util.LS = LS;

function base() { return ($("base").value || DEFAULT_BASE).replace(/\/+$/, ""); }
function key() { return $("key").value.trim(); }
AP.util.base = base;
AP.util.key = key;

/* carica le credenziali salvate nei campi dell'header; se non c'è nulla di salvato
   il campo "base" mostra comunque DEFAULT_BASE — così il tool si connette DA SOLO
   al Worker di default appena apre (le GET pubbliche non richiedono chiave, vedi
   app.js), invece di restare bianco finché l'utente non sceglie qualcosa lui stesso. */
function loadCreds() {
  $("base").value = localStorage.getItem(LS.base) || DEFAULT_BASE;
  $("key").value = localStorage.getItem(LS.key) || "";
}
function saveCreds() {
  localStorage.setItem(LS.base, base());
  localStorage.setItem(LS.key, key());
}
AP.util.loadCreds = loadCreds;
AP.util.saveCreds = saveCreds;

/* ---------- riga di stato per-sezione ---------- */
/* Aggiorna una riga di stato. Attenzione: NON si riscrive `className` da zero.
   Alcuni di questi elementi portano anche una classe che serve a RITROVARLI
   (`.archSectionStatus`, uno per ogni sezione dell'archivio): azzerando le classi,
   al primo messaggio scritto quell'elemento sparirebbe dalle ricerche per
   selettore. Qui si tocca solo la classe "tipo" (l'ultima applicata viene tolta,
   la nuova aggiunta). */
function setStatus(el, msg, kind = "") {
  el.textContent = msg;
  el.classList.add("status");
  if (el.dataset.statusKind) el.classList.remove(el.dataset.statusKind);
  if (kind) el.classList.add(kind);
  el.dataset.statusKind = kind || "";
}
AP.util.setStatus = setStatus;

/* ---------- util generici ---------- */
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
// escape sicuro sia per attributi (value="...") che per contenuto testuale (incl.
// dentro <textarea>): le entità HTML vengono ri-decodificate dal parser in entrambi
// i contesti, quindi è universale.
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
// parseFloat("3.5xyz") === 3.5: troppo permissivo per una guardia di cui l'utente
// deve potersi fidare che non sia stata troncata in silenzio. Qui l'INTERA stringa
// deve essere un numero, non solo il suo prefisso.
function strictNumber(raw) { return /^-?\d*\.?\d+$/.test(raw) ? Number(raw) : NaN; }
AP.util.deepClone = deepClone;
AP.util.esc = esc;
AP.util.strictNumber = strictNumber;

/* ---------- chiamate al Worker ---------- */
// Tre modi distinti in cui una chiamata può fallire, e cosa vede l'utente in
// ciascuno:
// 1. la `fetch` viene RIFIUTATA (host irraggiungibile, DNS, offline, CORS): il
//    browser lancia un TypeError generico ("Failed to fetch"/"Load failed",
//    testo diverso per browser e mai in italiano) — qui lo si intercetta e si
//    rilancia un errore umano che nomina l'indirizzo (`err.rete = true`, niente
//    `err.status`: la richiesta non è mai arrivata a destinazione).
// 2. la risposta arriva ma `!res.ok` (4xx/5xx): comportamento invariato, vedi
//    sotto — `err.status`/`err.payload`/`errori[]` per chi chiama.
// 3. la risposta è `ok` ma il corpo non è JSON valido (es. l'indirizzo punta a
//    un sito qualsiasi, non a un Worker ArtiPop): niente più ripiego silenzioso
//    `{ raw: txt }` spacciato per dato buono — si rigetta con un errore umano.
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (opts.body) headers["content-type"] = "application/json";
  if (key()) headers["x-artipop-key"] = key();
  let res;
  try {
    res = await fetch(base() + path, { ...opts, headers });
  } catch {
    const err = new Error(`Worker non raggiungibile a ${base()}: controlla l'indirizzo in alto o la connessione`);
    err.rete = true;
    throw err;
  }
  const txt = await res.text();
  if (!res.ok) {
    let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    // il Worker risponde 400 con { ok:false, errori:[...] }: non perdere quei
    // dettagli dietro un generico "HTTP 400" — attacca il corpo completo
    // all'errore così chi chiama può mostrarli per campo.
    const msg = json.error || (Array.isArray(json.errori) && json.errori.length ? json.errori.join("; ") : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.payload = json;
    err.status = res.status;
    throw err;
  }
  let json;
  try { json = JSON.parse(txt); }
  catch {
    const err = new Error(`risposta non in formato JSON da ${base()}: l'indirizzo non sembra un Worker ArtiPop`);
    err.status = res.status;
    throw err;
  }
  return json;
}
// estrae dal catch di api() l'elenco di errori del Worker, se presente, altrimenti
// il messaggio generico.
function errFromCatch(e) {
  return (e.payload && Array.isArray(e.payload.errori) && e.payload.errori.length) ? e.payload.errori : [e.message];
}
AP.util.api = api;
AP.util.errFromCatch = errFromCatch;

/* ---------- confronto di un profilo EDIT vs quanto in vigore sul Worker ----------
   Unica funzione di confronto per i due segnali di modifica che in Range erano
   indipendenti (badge "tarato" sulla card e testo di stato "modifiche non
   ancora lanciate", vedi DESIGN.md "4. Range") e che il Lab usa a sua volta
   per decidere se "⤵ Proponi range" sovrascriverebbe in silenzio una modifica
   manuale non ancora lanciata. `edit` e `server` hanno la stessa forma di un
   profilo (estensione/intensita/compattezza/monotona/maxDeriva/maxDegrado —
   vedi AP.store.edit e AP.store.dati.tuning.concepts). Nessuno dei due può
   essere assunto presente (un concept nuovissimo nel catalogo potrebbe non
   avere ancora un pendant sul Worker): senza uno dei due non c'è nulla da
   confrontare, quindi "non modificato" (nessun rischio da segnalare). */
function diffProfilo(edit, server) {
  const campi = [];
  if (!edit || !server) return { modificato: false, campi };
  for (const k of ["estensione", "intensita", "compattezza"]) {
    const e = edit[k] || [], s = server[k] || [];
    if (e[0] !== s[0] || e[1] !== s[1]) campi.push(k);
  }
  if (!!edit.monotona !== !!server.monotona) campi.push("monotona");
  if ((edit.maxDeriva ?? null) !== (server.maxDeriva ?? null)) campi.push("maxDeriva");
  if ((edit.maxDegrado ?? null) !== (server.maxDegrado ?? null)) campi.push("maxDegrado");
  return { modificato: campi.length > 0, campi };
}
AP.util.diffProfilo = diffProfilo;

/* ---------- "il form ha modifiche non salvate?" ----------
   Confronto puro fra due istantanee piatte (id→stringa) di uno stesso form,
   usato dalla tab Catalogo (vedi tab-catalogo.js, istantaneaForm/
   confermaAbbandono) per non buttare via silenziosamente quello che l'utente
   ha scritto quando un'azione ridisegna il form. `iniziale` null/undefined
   significa "nessun form aperto o form in sola lettura": mai "sporco" in quel
   caso. Nessun accesso al DOM qui dentro: la parte testabile in sandbox. */
function formSporco(iniziale, corrente) {
  if (!iniziale) return false;
  const chiavi = new Set([...Object.keys(iniziale), ...Object.keys(corrente || {})]);
  for (const k of chiavi) {
    if (iniziale[k] !== (corrente || {})[k]) return true;
  }
  return false;
}
AP.util.formSporco = formSporco;

/* ---------- mini event emitter, usato da AP.store (vedi store.js) ---------- */
// Non è un EventTarget del DOM di proposito: deve funzionare anche per dati che
// non sono nodi (l'intero STORE), ed è più semplice da leggere per chi arriva dopo.
function creaEmitter() {
  const handlers = {};
  return {
    on(evento, cb) {
      (handlers[evento] = handlers[evento] || []).push(cb);
      return () => { handlers[evento] = (handlers[evento] || []).filter((h) => h !== cb); };
    },
    emit(evento, dato) {
      (handlers[evento] || []).forEach((cb) => {
        try { cb(dato); }
        catch (e) { console.error(`[emitter] un handler per "${evento}" è fallito:`, e); }
      });
    },
  };
}
AP.util.creaEmitter = creaEmitter;

/* ---------- hash-routing: tab attiva e filtri vivono nell'URL ---------- */
// #<tab>?<filtri>, es. "#archivio?concept=crescita". Quattro tab finali (DESIGN.md,
// "Architettura dell'informazione"): Archivio (home) · Lab · Catalogo · Range.
// Hash vuoto/non valido → "archivio", MAI un'eccezione: un link rotto non deve
// mai lasciare il tool su una schermata bianca.
const ROUTE_TABS = ["archivio", "lab", "catalogo", "range"];
const ROUTE_DEFAULT = "archivio";
// "concept" ed "element" erano tab a sé finché il task 8 non le ha fuse in
// Catalogo (selettore Concept|Element, vedi tab-catalogo.js): un vecchio
// segnalibro o link con quell'hash non deve atterrare su una pagina bianca, si
// traduce nella rotta equivalente (#catalogo?tipo=concept|element), portando
// con sé eventuali altri parametri già presenti (es. ?id=...).
const LEGACY_TAB_TO_TIPO = { concept: "concept", element: "element" };

function routeLeggi() {
  const raw = (location.hash || "").replace(/^#/, "");
  const [tabRaw, qs] = raw.split("?");
  const params = {};
  if (qs) for (const [k, v] of new URLSearchParams(qs)) params[k] = v;
  if (tabRaw in LEGACY_TAB_TO_TIPO) {
    return { tab: "catalogo", params: { ...params, tipo: LEGACY_TAB_TO_TIPO[tabRaw] } };
  }
  const tab = ROUTE_TABS.includes(tabRaw) ? tabRaw : ROUTE_DEFAULT;
  return { tab, params };
}
function routeVai(tab, params = {}) {
  const t = ROUTE_TABS.includes(tab) ? tab : ROUTE_DEFAULT;
  const qs = new URLSearchParams(params).toString();
  location.hash = `#${t}${qs ? "?" + qs : ""}`;
}
function routeOn(cb) {
  window.addEventListener("hashchange", () => cb(routeLeggi()));
}
AP.util.route = { leggi: routeLeggi, vai: routeVai, on: routeOn, TABS: ROUTE_TABS, DEFAULT: ROUTE_DEFAULT };

/* ---------- toast/status unificato ---------- */
// Un solo meccanismo di feedback (successo/errore/attesa), capace di mostrare gli
// `errori[]` che il Worker restituisce nelle risposte 400. I `setStatus` per-sezione
// esistenti restano finché i task successivi non li sostituiscono (vedi task 5,
// istruzioni): qui serve solo che il meccanismo NUOVO esista e funzioni davvero.
let _toastTimer = null;
function toast(messaggio, tipo = "ok") {
  const el = $("toast");
  if (!el) { console.log(`[toast:${tipo}] ${messaggio}`); return; } // difensivo: mai rompere il chiamante se il markup non ha il contenitore
  el.textContent = messaggio;
  el.className = `toast show ${tipo}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.classList.remove("show"); }, tipo === "errore" ? 6000 : 3200);
}
// scorciatoia per il caso più comune: un errore catturato da api(), con gli
// eventuali errori[] del Worker già estratti da errFromCatch.
function toastErrore(e, prefisso) {
  const lista = errFromCatch(e).join(" · ");
  toast(`${prefisso ? prefisso + ": " : ""}${lista}`, "errore");
}
AP.util.toast = toast;
AP.util.toastErrore = toastErrore;
