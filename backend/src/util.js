// Utilità condivise fra i moduli che rendono pagine HTML.
//
// Nato dall'unificazione delle tre copie identiche di esc() che stavano in
// page.js, archivi.js e help.js (stessa funzione byte per byte, tre volte).

/** Escape minimo per il testo dinamico inserito nell'HTML. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
