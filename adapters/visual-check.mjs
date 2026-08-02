#!/usr/bin/env node
// visual-check.mjs — cattura screenshot full-page delle superfici chiave di ArtiPop
// (sito, /aiuto, tuning tool) e verifica automaticamente i "difetti visivi
// meccanici" definiti in VISUAL_SPECS.md §5-6 (overflow orizzontale, errori
// console, status HTTP). Non giudica estetica: quello resta al verifier umano/AI
// che guarda gli screenshot a occhio contro tests/visual/baseline/.
//
// Uso:
//   node adapters/visual-check.mjs [--base-url <url>] [--baseline] [--out <dir>]
//
//   --base-url  origine del worker da fotografare per "/" e "/aiuto"
//               (default: produzione, vedi DEFAULT_BASE sotto).
//   --baseline  oltre a scrivere in <out>/, copia gli screenshot anche in
//               tests/visual/baseline/ (nomi file stabili, sovrascrive).
//   --out       cartella di output per screenshot + report (default: artifacts/).
//
// Exit code: 0 se tutti gli screenshot sono riusciti e nessuna pagina ha
// overflow orizzontale; 1 altrimenti. Gli errori console NON influenzano
// l'exit code (solo riportati in artifacts/visual-report.json).

import { chromium } from "playwright";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// REPO_DIR = radice del repo: questo file vive in adapters/, quindi risaliamo di uno.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(SCRIPT_DIR);

const DEFAULT_BASE_URL = "https://artipop.riccardo-dominici.workers.dev";

// Viewport chiave da VISUAL_SPECS.md §6 (nomi e dimensioni ESATTI, non cambiare
// senza aggiornare anche la spec).
const VIEWPORT_MOBILE = { width: 390, height: 844 };
const VIEWPORT_DESKTOP = { width: 1280, height: 800 };

// Tempo di assestamento dopo networkidle, per animazioni/microtask che non
// generano richieste di rete (es. transizioni CSS avviate da JS all'ultimo giro).
const SETTLE_MS = 800;

/* ---------- parsing argomenti, minimale: --flag valore oppure --flag=valore ---------- */
function parseArgs(argv) {
  const out = { baseUrl: DEFAULT_BASE_URL, baseline: false, outDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--baseline") { out.baseline = true; continue; }
    const eq = a.indexOf("=");
    const key = eq === -1 ? a : a.slice(0, eq);
    const inlineVal = eq === -1 ? null : a.slice(eq + 1);
    const takeVal = () => (inlineVal !== null ? inlineVal : argv[++i]);
    if (key === "--base-url") out.baseUrl = takeVal();
    else if (key === "--out") out.outDir = takeVal();
    else if (key === "--help" || key === "-h") { out.help = true; }
  }
  return out;
}

/* ---------- definizione pagine/viewport da fotografare (VISUAL_SPECS §6) ---------- */
function buildTargets(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");
  const tuningPath = path.join(REPO_DIR, "tuning", "index.html");
  return [
    { name: "home-mobile", url: `${base}/`, viewport: VIEWPORT_MOBILE, mobile: true },
    { name: "home-desktop", url: `${base}/`, viewport: VIEWPORT_DESKTOP, mobile: false },
    { name: "aiuto-mobile", url: `${base}/aiuto`, viewport: VIEWPORT_MOBILE, mobile: true },
    { name: "aiuto-desktop", url: `${base}/aiuto`, viewport: VIEWPORT_DESKTOP, mobile: false },
    {
      name: "tuning-desktop",
      url: pathToFileURL(tuningPath).href,
      viewport: VIEWPORT_DESKTOP,
      mobile: false,
      isTuningTool: true, // file://: niente status HTTP, serve l'euristica connStatus (vedi sotto)
    },
  ];
}

/* CSS per azzerare animazioni/transizioni (prefers-reduced-motion emulato a livello
   di context non ferma le animazioni CSS "a tempo" già in corso, es. i blob ambient
   del sito: qui le schiacciamo a durata ~0 cosi lo screenshot e' deterministico
   senza alterare lo stato finale del layout, a differenza di `animation: none`
   che salterebbe eventuali keyframe che spostano elementi). */
const FREEZE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0.001s !important;
    animation-delay: 0s !important;
    transition-duration: 0.001s !important;
    scroll-behavior: auto !important;
  }
`;

/**
 * Fotografa un singolo target: naviga, aspetta l'assestamento, misura overflow
 * orizzontale, raccoglie errori console/pageerror, salva screenshot full-page.
 * Non lancia mai: gli errori finiscono nel campo `error` del risultato, cosi'
 * un target rotto non impedisce di fotografare gli altri.
 */
async function captureTarget(browser, target, outDir) {
  const consoleErrors = [];
  let status = null;
  let overflow = null;
  let error = null;
  let tuningConnStatus = null;

  const context = await browser.newContext({
    viewport: target.viewport,
    isMobile: target.mobile,
    hasTouch: target.mobile,
    reducedMotion: "reduce", // emula prefers-reduced-motion: reduce
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[uncaught] ${err.message}`);
  });

  try {
    const response = await page.goto(target.url, { waitUntil: "networkidle", timeout: 30000 });
    status = response ? response.status() : null; // null per file:// (nessuna risposta HTTP)

    await page.addStyleTag({ content: FREEZE_ANIMATIONS_CSS });
    await page.waitForTimeout(SETTLE_MS);

    overflow = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });

    // Euristica specifica per il tuning tool aperto via file://: il pill
    // #connStatus riflette se AP.store.carica() e' riuscito a raggiungere le
    // API di produzione (vedi tuning/js/app.js). Se resta "non connesso" o
    // passa a "errore", la pagina e' comunque fotografata ma va annotato che
    // i dati potrebbero non essere renderizzati (scheletro vuoto).
    if (target.isTuningTool) {
      tuningConnStatus = await page.evaluate(() => {
        const pill = document.getElementById("connStatus");
        return pill ? { text: pill.textContent, className: pill.className } : null;
      });
    }

    const outPath = path.join(outDir, `${target.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
  } catch (err) {
    error = err.message;
  } finally {
    await context.close();
  }

  const result = {
    name: target.name,
    url: target.url,
    viewport: `${target.viewport.width}x${target.viewport.height}`,
    overflow,
    consoleErrors,
    status,
  };
  if (error) result.error = error;
  if (target.isTuningTool) {
    result.tuningNote = tuningConnStatus
      ? tuningConnStatus.className.includes("on")
        ? `dati di produzione caricati (pill: "${tuningConnStatus.text}")`
        : `pill #connStatus = "${tuningConnStatus.text}" (classe: ${tuningConnStatus.className}) — probabile scheletro senza dati, vedi consoleErrors`
      : "pill #connStatus non trovato nel DOM (markup cambiato?)";
  }
  return result;
}

/** Scarica /w/natura e verifica i vincoli meccanici di VISUAL_SPECS.md §4
 * (content-type image/*, peso file). Non è uno screenshot: non entra nell'exit
 * code (la spec di visual-check limita l'exit code a screenshot+overflow), ma
 * viene riportato per intero nel JSON e stampato a schermo. */
async function checkWNatura(baseUrl, outDir) {
  const url = `${baseUrl.replace(/\/+$/, "")}/w/natura`;
  const result = { url, ok: false };
  try {
    const res = await fetch(url);
    result.status = res.status;
    result.contentType = res.headers.get("content-type") || null;
    const buf = Buffer.from(await res.arrayBuffer());
    result.bytes = buf.length;
    if (res.ok) {
      await writeFile(path.join(outDir, "w-natura.jpg"), buf);
    }
    const contentTypeOk = Boolean(result.contentType && result.contentType.startsWith("image/"));
    const sizeOk = buf.length > 30 * 1024; // >30KB richiesti dal team lead
    result.contentTypeOk = contentTypeOk;
    result.sizeOk = sizeOk;
    result.ok = res.ok && contentTypeOk && sizeOk;
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Uso: node adapters/visual-check.mjs [--base-url <url>] [--baseline] [--out <dir>]");
    process.exit(0);
  }

  const outDir = args.outDir
    ? path.resolve(REPO_DIR, args.outDir)
    : path.join(REPO_DIR, "artifacts");
  const baselineDir = path.join(REPO_DIR, "tests", "visual", "baseline");

  await mkdir(outDir, { recursive: true });

  console.log(`[visual-check] base-url = ${args.baseUrl}`);
  console.log(`[visual-check] out dir  = ${outDir}`);

  const targets = buildTargets(args.baseUrl);
  const browser = await chromium.launch();

  const pages = [];
  for (const target of targets) {
    console.log(`[visual-check] → ${target.name} (${target.viewport.width}x${target.viewport.height}) ${target.url}`);
    const result = await captureTarget(browser, target, outDir);
    pages.push(result);
    const badge = result.error ? "ERRORE" : result.overflow ? "OVERFLOW" : "ok";
    console.log(`  [${badge}] status=${result.status} consoleErrors=${result.consoleErrors.length}${result.error ? ` — ${result.error}` : ""}`);
  }

  await browser.close();

  console.log(`[visual-check] → download /w/natura`);
  const wNatura = await checkWNatura(args.baseUrl, outDir);
  console.log(`  [${wNatura.ok ? "ok" : "FALLITO"}] status=${wNatura.status} content-type=${wNatura.contentType} bytes=${wNatura.bytes}`);

  const report = {
    pages,
    wNatura,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, "visual-report.json"), JSON.stringify(report, null, 2));

  // Copia in baseline SOLO gli screenshot png (non w-natura.jpg: cambia ogni
  // giorno per disegno, non è un riferimento di regressione strutturale).
  if (args.baseline) {
    await mkdir(baselineDir, { recursive: true });
    for (const target of targets) {
      const file = `${target.name}.png`;
      await copyFile(path.join(outDir, file), path.join(baselineDir, file));
      console.log(`[visual-check] baseline aggiornata: tests/visual/baseline/${file}`);
    }
  }

  const screenshotsOk = pages.every((p) => !p.error);
  const noOverflow = pages.every((p) => p.overflow !== true);
  const success = screenshotsOk && noOverflow;

  console.log(`[visual-check] esito: ${success ? "OK" : "FALLITO"} (screenshot ok=${screenshotsOk}, overflow assente=${noOverflow})`);
  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error("[visual-check] errore fatale:", err);
  process.exit(1);
});
