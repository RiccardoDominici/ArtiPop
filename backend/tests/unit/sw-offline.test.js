// feat-l-app-installata-si-apre-anche-senza-rete: copertura pura di
// `inCache`/`serviceWorkerJs()` — la rotta end-to-end (/sw.js) è in
// sw-rotta.test.js.
import { describe, it, expect } from "vitest";
import { inCache, serviceWorkerJs } from "../../src/sw.js";

describe("inCache", () => {
  it("è vero per le superfici pubbliche di lettura", () => {
    expect(inCache("/")).toBe(true);
    expect(inCache("/aiuto")).toBe(true);
    expect(inCache("/archivi")).toBe(true);
    expect(inCache("/archivi/qualcosa")).toBe(true);
    expect(inCache("/w/veliero")).toBe(true);
  });

  it("è falso per le rotte amministrative/API e i feed", () => {
    expect(inCache("/api/channels")).toBe(false);
    expect(inCache("/health")).toBe(false);
    expect(inCache("/tuning")).toBe(false);
    expect(inCache("/catalogo/concept")).toBe(false);
    expect(inCache("/note/giorno")).toBe(false);
    expect(inCache("/lab/img")).toBe(false);
    expect(inCache("/run-all")).toBe(false);
    expect(inCache("/backfill")).toBe(false);
    expect(inCache("/regen-day")).toBe(false);
    expect(inCache("/feed.xml")).toBe(false);
    expect(inCache("/feed/veliero.xml")).toBe(false);
    expect(inCache("/manifest.webmanifest")).toBe(false);
  });
});

describe("serviceWorkerJs", () => {
  it("incorpora il sorgente di inCache — un solo punto di verità", () => {
    const src = serviceWorkerJs();
    expect(src).toContain(String(inCache));
  });

  it("produce JavaScript sintatticamente valido", () => {
    const src = serviceWorkerJs();
    expect(() => new Function(src)).not.toThrow();
  });

  it("è network-first: la cache è usata solo nel ramo di fallimento del fetch", () => {
    const src = serviceWorkerJs();
    const fetchIdx = src.indexOf("await fetch(request)");
    const cacheMatchIdx = src.indexOf("caches.match(request)");
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(cacheMatchIdx).toBeGreaterThan(-1);
    expect(cacheMatchIdx).toBeGreaterThan(fetchIdx);
  });

  it("activate cancella le cache dal nome diverso da quello corrente", () => {
    const src = serviceWorkerJs();
    expect(src).toContain('nome !== CACHE_NAME');
    expect(src).toContain("caches.delete(nome)");
  });

  it("feat-i-preferiti-si-rivedono-anche-senza-rete: ha un ascoltatore message che valida con inCache e salva solo risposte 200", () => {
    const src = serviceWorkerJs();
    expect(src).toContain('self.addEventListener("message"');
    const msgBody = src.match(/self\.addEventListener\("message", \(event\) => \{[\s\S]*?\n\}\);/)[0];
    expect(msgBody).toContain('dati.tipo !== "conserva"');
    expect(msgBody).toContain("inCache(url.pathname)");
    expect(msgBody).toContain("risposta.status === 200");
    expect(msgBody).toContain("cache.put(url, risposta)");
  });

  it("feat-i-preferiti-si-rivedono-anche-senza-rete: un URL non ammesso da inCache non viene conservato", () => {
    const src = serviceWorkerJs();

    const CACHE_NAME = "artipop-v1";
    let messageHandler;
    const globalObj = {
      location: { origin: "https://example.com" },
      addEventListener: (tipo, handler) => {
        if (tipo === "message") messageHandler = handler;
      },
    };
    const fetchCalls = [];
    const cachePutCalls = [];
    const caches = {
      open: async (nome) => ({
        put: async (url, risposta) => cachePutCalls.push([url, risposta]),
      }),
    };
    const fetch = async (url) => {
      fetchCalls.push(String(url));
      return { status: 200 };
    };
    const fn = new Function(
      "self",
      "caches",
      "fetch",
      `${src}\nreturn self;`
    );
    fn(globalObj, caches, fetch);

    expect(typeof messageHandler).toBe("function");

    let waited = [];
    messageHandler({
      data: { tipo: "conserva", url: "https://example.com/api/channels" },
      waitUntil: (p) => waited.push(p),
    });
    expect(waited.length).toBe(0);
    expect(fetchCalls.length).toBe(0);

    messageHandler({
      data: { tipo: "conserva", url: "https://example.com/w/veliero?date=2026-07-01" },
      waitUntil: (p) => waited.push(p),
    });
    expect(waited.length).toBe(1);
  });
});
