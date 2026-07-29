// BOOTSTRAP del tool: ultimo <script src> caricato (vedi index.html), quindi qui
// esistono già AP.util, AP.store, AP.comp e tutti gli AP.tabs.*. Si occupa di
// tre cose che non appartengono a nessuna singola tab: instradare le tab
// dall'hash dell'URL, disegnare la barra credenziali con il bottone "↻ Aggiorna"
// globale, e avviare il primo caricamento dello STORE.
window.AP = window.AP || {};

/* ---------- tab switching, guidato dall'hash (vedi AP.util.route in util.js) ---------- */
function attivaTab(tab, params) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  AP.util.route.TABS.forEach((t) => { $(`tab-${t}`).style.display = (t === tab) ? "" : "none"; });

  // ogni modulo-tab espone onShow(params): richiamato quando diventa quella
  // attiva, per mostrare sempre lo stato più fresco dello STORE (i dati intanto
  // possono essere arrivati mentre la tab non era visibile).
  if (tab === "range") AP.tabs.range?.onShow(params);
  else if (tab === "concept") AP.tabs.catalogo?.concept.onShow(params);
  else if (tab === "element") AP.tabs.catalogo?.element.onShow(params);
  else if (tab === "archivio") AP.tabs.archivio?.onShow(params);
  else if (tab === "lab") AP.tabs.lab?.onShow(params);
}

document.querySelectorAll(".tab").forEach((t) => t.onclick = () => AP.util.route.vai(t.dataset.tab));
AP.util.route.on(({ tab, params }) => attivaTab(tab, params));

/* ---------- credenziali + bottone "↻ Aggiorna" globale ---------- */
AP.util.loadCreds();
$("saveCreds").onclick = () => {
  AP.util.saveCreds();
  setStatus($("connStatus"), "credenziali salvate");
  $("connStatus").className = "pill on";
  AP.store.carica();
};
$("globalReload").onclick = () => {
  $("globalReload").disabled = true;
  AP.store.carica().finally(() => { $("globalReload").disabled = false; });
};

/* il pill di connessione riflette l'esito del caricamento dei canali: è la
   prima chiamata che parte, ed è quella con cui "il tool parla col Worker" o no. */
AP.store.on("canali", () => {
  $("connStatus").textContent = "connesso";
  $("connStatus").className = "pill on";
});
AP.store.on("errore", (info) => {
  if (info.sezione === "canali") {
    $("connStatus").textContent = "errore";
    $("connStatus").className = "pill off";
  }
  // /catalogo e /note su un Worker più vecchio possono legittimamente mancare: le
  // rispettive tab lo spiegano già per-sezione, un toast qui sarebbe ridondante.
  if (info.sezione !== "catalogo" && info.sezione !== "note") {
    AP.util.toastErrore(info.errore, info.sezione);
  }
});

/* ---------- avvio ----------
   La tab arriva dall'hash (vuoto → "archivio", la home secondo DESIGN.md). Il
   caricamento dello STORE parte SEMPRE, con o senza un base URL salvato: le GET
   pubbliche (/api/channels, /api/archive, /catalogo, /note, /tuning) non
   richiedono la chiave admin, quindi non c'è più motivo di aspettare una scelta
   esplicita dell'utente prima di provarci (a differenza del vecchio index.html:
   vedi "Difetto 3" nella storia del progetto, superato ora che /catalogo è
   stabilmente in produzione). */
const rottaIniziale = AP.util.route.leggi();
attivaTab(rottaIniziale.tab, rottaIniziale.params);
AP.store.carica();
