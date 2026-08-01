// feat-l-app-installata-si-apre-anche-senza-rete: service worker minimo che
// permette all'icona installata (ciclo 104/106/107) di riaprire l'ultimo
// giorno già visto quando la rete manca, invece della pagina d'errore del
// browser. Nessuna dipendenza, sola composizione di stringhe — falsariga di
// `manifest.js`.

/**
 * Predicato PURO: vero solo per le superfici pubbliche di lettura che ha
 * senso rileggere offline. Falso per tutto il resto — in particolare le
 * rotte amministrative/API, che il service worker non deve mai conservare.
 * Viene incorporato per intero (`String(inCache)`) nel sorgente del worker:
 * un solo punto di verità, verificabile a runtime da questo stesso test.
 */
export function inCache(pathname) {
  if (pathname === "/" || pathname === "/aiuto" || pathname === "/archivi") return true;
  if (pathname.startsWith("/archivi/")) return true;
  if (/^\/w\/[a-z]+(?:\.(?:jpg|jpeg|png))?$/.test(pathname)) return true;
  return false;
}

const CACHE_NAME = "artipop-v1";

/**
 * Sorgente del service worker: network-first sulle sole GET di stesso-
 * origine che passano `inCache`. Online l'utente vede sempre il giorno vero
 * (mai una copia in cache); solo se la rete fallisce si risponde dalla
 * cache. Nessun precaching (la home è dinamica) e nessuna pagina "sei
 * offline" inventata: se la rete fallisce e non c'è copia in cache, il
 * `fetch` non intercetta e il browser mostra il suo errore come oggi.
 */
export function serviceWorkerJs() {
  return `const CACHE_NAME = ${JSON.stringify(CACHE_NAME)};
const inCache = ${String(inCache)};

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const nomi = await caches.keys();
      await Promise.all(
        nomi.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))
      );
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!inCache(url.pathname)) return;

  event.respondWith(
    (async () => {
      try {
        const risposta = await fetch(request);
        if (risposta && risposta.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, risposta.clone());
        }
        return risposta;
      } catch (err) {
        const copia = await caches.match(request);
        if (copia) return copia;
        throw err;
      }
    })()
  );
});
`;
}
