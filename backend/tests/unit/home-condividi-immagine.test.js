// feat-condividi-l-immagine-del-giorno: accanto a "salva l'immagine" la home
// deve esporre un comando ghost che passa il file vero del giorno mostrato al
// foglio di condivisione di sistema (Web Share API con `files`), con ripiego
// sul comportamento di oggi (shareLink) quando il browser non offre la
// condivisione di file o l'operazione fallisce. Il file è ricavato da un
// canvas che ridisegna l'immagine già a schermo (catturaFrameCorrente), non
// da una seconda fetch — deve restare vera la guardia anti-ciclo-77 (una sola
// occorrenza di fetch( in tutto l'HTML reso), verificata a parte in
// home-preferiti-senza-rete.test.js/home-racconto-del-giorno.test.js/
// home-sfoglia-senza-attesa.test.js. Test puro su renderPage() — nessun
// browser vero, navigator/canvas/deckEl stubbati in sandbox, sulla falsariga
// di home-salva-immagine.test.js e home-preferiti-trasferibili.test.js.
import { describe, it, expect, vi } from "vitest";
import { renderPage } from "../../src/page.js";

const html = renderPage({}, "https://example.com", "2026-08-01");

function journeySection() {
  return html.match(/<section class="journey">[\s\S]*?<\/section>/)[0];
}

// Estrae ed esegue in sandbox catturaFrameCorrente/condividiImmagine con
// navigator/document/CHANNELS/order/previewDate/TODAY/deckEl/shareLink finti.
function sandboxCondividi({ navigator, documentImpl, deckEl, shareLinkSpy } = {}) {
  const src =
    html.match(/function catturaFrameCorrente\(img\)[\s\S]*?\n\}/)[0] +
    "\n" +
    html.match(/async function condividiImmagine\(\)[\s\S]*?\n\}/)[0];
  const fn = new Function(
    "navigator",
    "document",
    "CHANNELS",
    "order",
    "previewDate",
    "TODAY",
    "shareLink",
    "dayShareImgEl",
    "deckEl",
    `${src}\nreturn { catturaFrameCorrente, condividiImmagine };`
  );
  const dayShareImgEl = { disabled: false };
  const CHANNELS = [{ id: "natura" }];
  const order = [0];
  const shareLink = shareLinkSpy ?? vi.fn();
  const api = fn(
    navigator,
    documentImpl,
    CHANNELS,
    order,
    "2026-08-01",
    "2026-08-01",
    shareLink,
    dayShareImgEl,
    deckEl
  );
  return { api, dayShareImgEl, shareLink };
}

// canvas/context/img finti: toBlob invoca subito il callback col blob dato
// (o null per simulare un fallimento di codifica).
function fakeCanvasDocument(blob) {
  const ctx = { drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: vi.fn((cb) => cb(blob)),
  };
  return { createElement: () => canvas, canvas, ctx };
}

function fakeImg({ complete = true, naturalWidth = 960 } = {}) {
  return { complete, naturalWidth, naturalHeight: 2048 };
}

describe("home — condividi l'immagine del giorno", () => {
  it("il markup espone il bottone #dayshareimg accanto a #daysave, pill ghost, inizialmente nascosto", () => {
    const journey = journeySection();
    const idxDaysave = journey.indexOf('id="daysave"');
    const idxShareImg = journey.indexOf('id="dayshareimg"');
    expect(idxDaysave).toBeGreaterThan(-1);
    expect(idxShareImg).toBeGreaterThan(idxDaysave);
    const btn = journey.match(/<button class="btn ghost" id="dayshareimg"[^>]*>[^<]*<\/button>/)[0];
    expect(btn).toContain("hidden");
    expect(btn).toContain("condividi l'immagine");
  });

  it("renderJourney nasconde il comando sia senza viaggio sia dove la condivisione di file non è supportata", () => {
    const fnBody = html.match(/function renderJourney\([\s\S]*?\n\}/)[0];
    expect(fnBody).toContain("dayShareImgEl.hidden = !hasJourney || !PUO_CONDIVIDERE_FILE");
  });

  it("supportaCondivisioneFile è falso se navigator.share manca", () => {
    const src = html.match(/function supportaCondivisioneFile\(\)[\s\S]*?\n\}/)[0];
    const fn = new Function("navigator", `${src}\nreturn supportaCondivisioneFile();`);
    expect(fn({})).toBe(false);
  });

  it("supportaCondivisioneFile è falso se canShare risponde falso o lancia, vero nel caso completo", () => {
    const src = html.match(/function supportaCondivisioneFile\(\)[\s\S]*?\n\}/)[0];
    const fn = new Function("navigator", `${src}\nreturn supportaCondivisioneFile();`);
    expect(fn({ share: vi.fn(), canShare: () => false })).toBe(false);
    expect(
      fn({
        share: vi.fn(),
        canShare: () => {
          throw new Error("no");
        },
      })
    ).toBe(false);
    expect(fn({ share: vi.fn(), canShare: () => true })).toBe(true);
  });

  it("condividiImmagine — percorso felice: navigator.share riceve esattamente un file col nome parlante, nessuna fetch", () => {
    return (async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      const blob = { type: "image/jpeg" };
      const documentImpl = fakeCanvasDocument(blob);
      const deckEl = { querySelector: () => fakeImg() };
      const { api, shareLink, dayShareImgEl } = sandboxCondividi({
        navigator: { share: shareMock },
        documentImpl,
        deckEl,
      });
      await api.condividiImmagine();
      expect(documentImpl.canvas.toBlob).toHaveBeenCalledTimes(1);
      expect(shareMock).toHaveBeenCalledTimes(1);
      const arg = shareMock.mock.calls[0][0];
      expect(arg.files).toHaveLength(1);
      expect(arg.files[0].name).toBe("ArtiPop-natura-2026-08-01.jpg");
      expect(shareLink).not.toHaveBeenCalled();
      expect(dayShareImgEl.disabled).toBe(false); // riabilitato in finally
    })();
  });

  it("condividiImmagine — annullamento dell'utente (AbortError): nessun ripiego su shareLink", async () => {
    const abortErr = Object.assign(new Error("annullato"), { name: "AbortError" });
    const shareMock = vi.fn().mockRejectedValue(abortErr);
    const documentImpl = fakeCanvasDocument({ type: "image/jpeg" });
    const deckEl = { querySelector: () => fakeImg() };
    const { api, shareLink, dayShareImgEl } = sandboxCondividi({
      navigator: { share: shareMock },
      documentImpl,
      deckEl,
    });
    await api.condividiImmagine();
    expect(shareLink).not.toHaveBeenCalled();
    expect(dayShareImgEl.disabled).toBe(false);
  });

  it("condividiImmagine — immagine non pronta (card assente/non caricata): ripiego su shareLink()", async () => {
    const documentImpl = fakeCanvasDocument({ type: "image/jpeg" });
    const deckEl = { querySelector: () => null };
    const { api, shareLink } = sandboxCondividi({
      navigator: { share: vi.fn() },
      documentImpl,
      deckEl,
    });
    await api.condividiImmagine();
    expect(shareLink).toHaveBeenCalledTimes(1);
  });

  it("condividiImmagine — toBlob nullo (codifica fallita): ripiego su shareLink()", async () => {
    const documentImpl = fakeCanvasDocument(null);
    const deckEl = { querySelector: () => fakeImg() };
    const { api, shareLink } = sandboxCondividi({
      navigator: { share: vi.fn() },
      documentImpl,
      deckEl,
    });
    await api.condividiImmagine();
    expect(shareLink).toHaveBeenCalledTimes(1);
  });

  it("condividiImmagine — share che lancia per altro motivo: ripiego su shareLink()", async () => {
    const shareMock = vi.fn().mockRejectedValue(new Error("qualcos'altro"));
    const documentImpl = fakeCanvasDocument({ type: "image/jpeg" });
    const deckEl = { querySelector: () => fakeImg() };
    const { api, shareLink } = sandboxCondividi({
      navigator: { share: shareMock },
      documentImpl,
      deckEl,
    });
    await api.condividiImmagine();
    expect(shareLink).toHaveBeenCalledTimes(1);
  });

  it("condividiImmagine — doppio tocco: non riparte se il bottone è già disabilitato", async () => {
    const documentImpl = fakeCanvasDocument({ type: "image/jpeg" });
    const deckEl = { querySelector: () => fakeImg() };
    const { api, dayShareImgEl } = sandboxCondividi({
      navigator: { share: vi.fn() },
      documentImpl,
      deckEl,
    });
    dayShareImgEl.disabled = true;
    await api.condividiImmagine();
    expect(documentImpl.canvas.toBlob).not.toHaveBeenCalled();
  });

  it("condividiImmagine non introduce una seconda fetch( nel sorgente della funzione (guardia anti-ciclo-77)", () => {
    const fnBody = html.match(/async function condividiImmagine\(\)[\s\S]*?\n\}/)[0];
    expect(fnBody).not.toMatch(/fetch\(/);
  });

  it("nessuna regola CSS nuova: #dayshareimg riusa .btn.ghost esistente", () => {
    expect(html).not.toMatch(/#dayshareimg\s*\{/);
  });
});
