// feat-il-promemoria-del-wallpaper-va-nel-calendario: renderPromemoria è un
// modulo puro che compone un calendario iCalendar (RFC 5545). Verificati:
// struttura, proprietà obbligatorie, CRLF, ripiegamento a 75 ottetti, escape
// dei valori TEXT, URL, stabilità dell'UID e totalità.
import { describe, it, expect } from "vitest";
import { renderPromemoria, escIcs, PROMEMORIA_VUOTO } from "../../src/promemoria.js";

const ott = (s) => new TextEncoder().encode(s).length;

describe("renderPromemoria — struttura", () => {
  it("comincia con BEGIN:VCALENDAR, contiene i marcatori attesi e finisce con END:VCALENDAR", () => {
    const corpo = renderPromemoria({
      canale: { id: "natura", name: "Natura" },
      origin: "https://artipop.test",
      oraCronUtc: 3,
    });
    expect(corpo.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(corpo).toContain("VERSION:2.0");
    expect(corpo).toContain("PRODID:");
    expect(corpo).toContain("BEGIN:VEVENT");
    expect(corpo).toContain("END:VEVENT");
    expect(corpo).toContain("RRULE:FREQ=DAILY");
    expect(corpo.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
});

describe("renderPromemoria — proprietà obbligatorie", () => {
  it("UID, DTSTAMP, DTSTART presenti; DTSTART segue oraCronUtc", () => {
    const c3 = renderPromemoria({ canale: null, origin: "https://artipop.test", oraCronUtc: 3 });
    expect(c3).toMatch(/^UID:.+$/m);
    expect(c3).toMatch(/^DTSTAMP:.+$/m);
    expect(c3).toMatch(/^DTSTART:\d{8}T030000Z$/m);

    const c7 = renderPromemoria({ canale: null, origin: "https://artipop.test", oraCronUtc: 7 });
    expect(c7).toMatch(/^DTSTART:\d{8}T070000Z$/m);
  });
});

describe("renderPromemoria — CRLF", () => {
  it("ogni riga termina con CRLF, nessun LF/CR residuo isolato", () => {
    const corpo = renderPromemoria({ canale: { id: "natura" }, origin: "https://artipop.test", oraCronUtc: 3 });
    expect(corpo.endsWith("\r\n")).toBe(true);
    const pezzi = corpo.split("\r\n");
    for (const p of pezzi) {
      expect(p.includes("\n")).toBe(false);
      expect(p.includes("\r")).toBe(false);
    }
  });
});

describe("renderPromemoria — 75 ottetti", () => {
  it("nessuna riga supera i 75 ottetti, anche con nome canale e origin molto lunghi", () => {
    const nomeLungo = "Canalè con nome davvero lunghissimo è pieno di accénti ".repeat(4);
    const corpo = renderPromemoria({
      canale: { id: "natura", name: nomeLungo },
      origin: "https://un-origin-particolarmente-lungo-per-forzare-il-ripiegamento.example.test",
      oraCronUtc: 3,
    });
    for (const riga of corpo.split("\r\n")) {
      if (riga === "") continue;
      expect(ott(riga)).toBeLessThanOrEqual(75);
    }
  });
});

describe("renderPromemoria — escape", () => {
  it("escIcs scappa backslash, punto e virgola, virgola e a-capo, in quest'ordine", () => {
    expect(escIcs("a\\b")).toBe("a\\\\b");
    expect(escIcs("a;b")).toBe("a\\;b");
    expect(escIcs("a,b")).toBe("a\\,b");
    expect(escIcs("a\r\nb")).toBe("a\\nb");
    expect(escIcs(null)).toBe("");
  });

  it("il corpo contiene le sequenze scappate per un nome canale con caratteri speciali", () => {
    const corpo = renderPromemoria({
      canale: { id: "natura", name: 'Nat;ura, "va" \\ bene\nsecondo rigo' },
      origin: "https://artipop.test",
      oraCronUtc: 3,
    });
    expect(corpo).toContain("\\;");
    expect(corpo).toContain("\\,");
    expect(corpo).toContain("\\\\");
    expect(corpo).toContain("\\n");
  });
});

describe("renderPromemoria — URL", () => {
  it("con canale: URL punta al canale; senza canale: home nuda", () => {
    const conCanale = renderPromemoria({ canale: { id: "natura" }, origin: "https://artipop.test", oraCronUtc: 3 });
    expect(conCanale).toContain("URL:https://artipop.test/?c=natura");

    const senzaCanale = renderPromemoria({ canale: null, origin: "https://artipop.test", oraCronUtc: 3 });
    expect(senzaCanale).toContain("URL:https://artipop.test/");
    expect(senzaCanale).not.toContain("?c=");
  });
});

describe("renderPromemoria — UID stabile", () => {
  it("due chiamate identiche danno lo stesso UID; canali diversi danno UID diversi", () => {
    const a = renderPromemoria({ canale: { id: "natura" }, origin: "https://artipop.test", oraCronUtc: 3 });
    const b = renderPromemoria({ canale: { id: "natura" }, origin: "https://artipop.test", oraCronUtc: 3 });
    const uidA = a.match(/^UID:(.+)$/m)[1];
    const uidB = b.match(/^UID:(.+)$/m)[1];
    expect(uidA).toBe(uidB);

    const c = renderPromemoria({ canale: { id: "cosmo" }, origin: "https://artipop.test", oraCronUtc: 3 });
    const uidC = c.match(/^UID:(.+)$/m)[1];
    expect(uidC).not.toBe(uidA);
  });
});

describe("renderPromemoria — totalità", () => {
  it("non lancia mai, per nessun input, e resta un calendario valido", () => {
    const casi = [
      undefined,
      null,
      { canale: 42, origin: {}, oraCronUtc: "tre" },
      { canale: { id: 7, name: [] } },
      { canale: { id: "natura" }, origin: "https://artipop.test", oraCronUtc: -5 },
      { canale: { id: "natura" }, origin: "https://artipop.test", oraCronUtc: 99 },
    ];
    for (const input of casi) {
      let corpo;
      expect(() => { corpo = renderPromemoria(input); }).not.toThrow();
      expect(corpo.startsWith("BEGIN:VCALENDAR")).toBe(true);
      expect(corpo.endsWith("END:VCALENDAR\r\n")).toBe(true);
      expect(corpo).toMatch(/^DTSTART:\d{8}T\d{6}Z$/m);
    }
  });
});

describe("PROMEMORIA_VUOTO", () => {
  it("è un calendario valido, ogni riga entro i 75 ottetti, tutte separate da CRLF", () => {
    expect(typeof PROMEMORIA_VUOTO).toBe("string");
    expect(PROMEMORIA_VUOTO.length).toBeGreaterThan(0);
    expect(PROMEMORIA_VUOTO.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(PROMEMORIA_VUOTO).toContain("VERSION:2.0");
    expect(PROMEMORIA_VUOTO).toContain("RRULE:FREQ=DAILY");
    for (const riga of PROMEMORIA_VUOTO.split("\r\n")) {
      if (riga === "") continue;
      expect(ott(riga)).toBeLessThanOrEqual(75);
    }
  });
});
