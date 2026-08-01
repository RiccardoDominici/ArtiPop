// Classifica l'URL a cui il tool sta parlando (preview / produzione / sconosciuto).
// Motivo per cui esiste: la tab Lab lancia /lab/arc, l'unica chiamata del tool che
// consuma neuroni AI — e li consuma dallo stesso budget giornaliero del cron di
// produzione (ROADMAP «Regole di budget AI»: le sessioni lab vanno SOLO su preview).
// Un clic distratto sulla base sbagliata brucia budget di produzione per un test:
// questo file dà a tab-lab.js il modo di riconoscere "produzione" e fermarsi a
// chiedere conferma prima, invece che scoprirlo dopo dalla fattura dei neuroni.
window.AP = window.AP || {};
AP.ambiente = AP.ambiente || {};

function classifica(baseUrl) {
  if (!baseUrl) return "sconosciuto";
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return "sconosciuto";
  }
  if (url.hostname.startsWith("artipop-preview.")) return "preview";
  let defaultHost;
  try {
    defaultHost = new URL(AP.util.DEFAULT_BASE).hostname;
  } catch {
    defaultHost = null;
  }
  if (defaultHost && url.hostname === defaultHost) return "produzione";
  return "sconosciuto";
}
AP.ambiente.classifica = classifica;

function etichetta(classe) {
  if (classe === "preview") return "preview";
  if (classe === "produzione") return "produzione";
  return "ambiente sconosciuto";
}
AP.ambiente.etichetta = etichetta;
