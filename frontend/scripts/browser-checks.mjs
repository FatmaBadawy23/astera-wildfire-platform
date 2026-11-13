#!/usr/bin/env node
/**
 * Stage F2 real-browser checks (no extra dependencies: Node built-ins + headless Edge/Chrome via the
 * DevTools protocol). Run against the dev server:
 *
 *   npm run dev                                   # in another terminal
 *   node scripts/browser-checks.mjs [outputDir]   # report.json + screenshots
 *
 * Env: BASE_URL (default http://localhost:5173), BROWSER_PATH (default: Microsoft Edge on Windows).
 *
 * Checks (both themes): direct URL loads, Back/Forward, axe-core with real CSS (incl. colour contrast),
 * every Tab stop (visible ≥2px indicator, ≥3:1 against the adjacent background, not obscured),
 * layout geometry (banner/header never overlap <main>), sidebar widths at 1440/1024/390, drawer focus
 * trap / Esc / navigation / resize-while-open, short-screen layout, and Login/Register storage + network
 * audit after form interaction. Explorer (F-Explorer): real MapLibre map with software WebGL, no external
 * requests, keyboard markers, selection/Esc, a clicked detection point, layer info and switches, filters and
 * search, focus rings, storage, and the 390px layout. Exit code 1 if anything fails.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
const OUT = resolve(process.argv[2] ?? join(tmpdir(), "astera-browser-checks"));
const PORT = 9333;
const BROWSER =
  process.env.BROWSER_PATH ??
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].find((p) => existsSync(p));
const AXE_SRC = readFileSync(join(here, "../node_modules/axe-core/axe.min.js"), "utf8");
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const ALLOWED_STORAGE_KEYS = ["astera-theme", "astera-sidebar"];
const SECRET = "secret-P4ssword@example.com";

const SHELL_ROUTES = [
  ["/explorer", "Global Fire Explorer"],
  ["/events", "Fire Event Details"],
  ["/events/E-123", "Fire Event Details"],
  ["/availability", "Data Availability"],
  ["/analysis", "SAR Analysis"],
  ["/reports", "Reports & Insights"],
  ["/assistant", "AI Scientific Assistant"],
  ["/methodology", "Data & Methodology"],
];
const STANDALONE_ROUTES = [
  ["/", "Monitor wildfire surface change with satellite radar", "Welcome"],
  ["/login", "Log in", "Log in"],
  ["/register", "Create account", "Create account"],
  ["/no/such/page", "Page not found", "Page not found"],
];

// ---------------------------------------------------------------- in-page probe (runs in the browser)
const PROBE = String.raw`
window.__aw = {
  rgba(color) {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1); x.fillStyle = "rgba(0,0,0,0)"; x.fillStyle = color; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  },
  effectiveBg(el) {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = this.rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    let out = [255, 255, 255];
    for (const c of layers.reverse()) out = out.map((v, i) => c[i] * c[3] + v * (1 - c[3]));
    return out;
  },
  lum([r, g, b]) {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  },
  contrast(a, b) { const [x, y] = [this.lum(a), this.lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); },
  name(el) {
    return (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 50);
  },
  focusInfo() {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return { none: true };
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const width = parseFloat(cs.outlineWidth) || 0, offset = parseFloat(cs.outlineOffset) || 0;
    const adjacent = offset < 0 ? this.effectiveBg(el) : this.effectiveBg(el.parentElement || el);
    const ring = this.rgba(cs.outlineColor);
    const ringOnBg = ring.slice(0, 3).map((v, i) => v * ring[3] + adjacent[i] * (1 - ring[3]));
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const inViewport = r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5;
    let overlapsChrome = false;
    if (el.closest("main")) {
      for (const b of document.querySelectorAll('[aria-label="Data mode notice"], header')) {
        if (b.contains(el)) continue;
        const q = b.getBoundingClientRect();
        if (r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) overlapsChrome = true;
      }
    }
    return {
      name: this.name(el), tag: el.tagName.toLowerCase(),
      visible: cs.outlineStyle !== "none" && width >= 2, width, offset,
      ratio: Math.round(this.contrast(ringOnBg, adjacent) * 100) / 100,
      topmost: !!hit && (hit === el || el.contains(hit)), inViewport, overlapsChrome,
      inDialog: !!el.closest('[role="dialog"]'),
    };
  },
  /** Waits until CSS transitions/animations on the focused element have finished, then measures. */
  async focusInfoSettled() {
    const el = document.activeElement;
    if (el && el.getAnimations) await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return this.focusInfo();
  },
  layout() {
    const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    return {
      banner: rect('[aria-label="Data mode notice"]'), header: rect("header"),
      sidebar: rect('[data-sidebar="docked"]'), main: rect("main"),
      scrollWidth: document.documentElement.scrollWidth, innerWidth,
      mode: document.querySelector("[data-shell-mode]")?.getAttribute("data-shell-mode") ?? null,
    };
  },
};`;

// ---------------------------------------------------------------- DevTools protocol client
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) fail(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
        else ok(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers.get(msg.method) ?? []) h(msg.params);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, fail) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", fail, { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }));
  }
  on(method, handler) {
    this.handlers.set(method, [...(this.handlers.get(method) ?? []), handler]);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- results
const results = [];
function check(id, pass, detail = "") {
  results.push({ id, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}${detail ? `  (${detail})` : ""}`);
}

// ---------------------------------------------------------------- main
async function main() {
  if (!BROWSER) throw new Error("No Edge/Chrome found; set BROWSER_PATH.");
  mkdirSync(join(OUT, "screens"), { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "astera-edge-"));
  const browser = spawn(
    BROWSER,
    ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run",
      "--no-default-browser-check", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--disable-extensions", "about:blank"],
    { stdio: "ignore" },
  );

  let version;
  for (let i = 0; i < 100 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    } catch {
      await sleep(150);
    }
  }
  if (!version) throw new Error("Browser did not start.");
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const cdp = await Cdp.connect(page.webSocketDebuggerUrl);

  const exceptions = [];
  let netLog = null; // array while recording form-interaction requests
  cdp.on("Runtime.exceptionThrown", (p) => exceptions.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
  cdp.on("Network.requestWillBeSent", (p) => netLog?.push(`${p.request.method} ${p.request.url}`));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: AXE_SRC + "\n" + PROBE });

  // --- helpers
  async function evaluate(expression) {
    const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }
  async function waitFor(expression, timeout = 6000, label = expression) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        if (await evaluate(expression)) return true;
      } catch {
        /* page navigating */
      }
      await sleep(50);
    }
    throw new Error(`timeout waiting for: ${label}`);
  }
  async function viewport(width, height) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(150);
  }
  async function goto(path, theme) {
    const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}theme=${theme}`;
    await cdp.send("Page.navigate", { url });
    await waitFor("document.readyState === 'complete' && !!window.__aw && !!document.querySelector('[data-page-heading]')", 10000, `load ${path}`);
    await sleep(100);
  }
  const KEYS = { Tab: 9, Enter: 13, Escape: 27, " ": 32, a: 65 };
  async function press(key, { shift = false } = {}) {
    const base = { key, code: key === " " ? "Space" : key, windowsVirtualKeyCode: KEYS[key], modifiers: shift ? 8 : 0 };
    const text = key === "Enter" ? "\r" : key === " " || key === "a" ? key : undefined;
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(text ? { text } : {}) });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await sleep(40);
  }
  async function shot(name) {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, "screens", `${name}.png`), Buffer.from(data, "base64"));
  }
  async function clickAt(selector) {
    const pt = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!pt) return false;
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
      await cdp.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    }
    await sleep(60);
    return true;
  }
  /** Presses Tab until focus leaves the page or `max` stops; returns focus info for each stop. */
  async function tabWalk(max = 40, { stopInDialogAfter = 0 } = {}) {
    const stops = [];
    for (let i = 0; i < max; i++) {
      await press("Tab");
      const info = await evaluate("window.__aw.focusInfoSettled()");
      if (info.none) break;
      stops.push(info);
      if (stopInDialogAfter && stops.length >= stopInDialogAfter) break;
    }
    return stops;
  }
  function judgeStops(id, stops) {
    const bad = stops.filter((s) => !s.visible || s.ratio < 3 || !s.topmost || !s.inViewport || s.overlapsChrome);
    check(
      id,
      stops.length > 0 && bad.length === 0,
      bad.length
        ? `failing stops: ${bad.map((s) => `${s.name} [vis=${s.visible} w=${s.width} ratio=${s.ratio} top=${s.topmost} inView=${s.inViewport} overlap=${s.overlapsChrome}]`).join("; ")}`
        : `${stops.length} stops, min contrast ${Math.min(...stops.map((s) => s.ratio)).toFixed(2)}`,
    );
    return stops;
  }
  async function runAxe() {
    return evaluate(`axe.run(document, { runOnly: { type: "tag", values: ${JSON.stringify(WCAG_TAGS)} } }).then((r) => ({
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) })),
      incompleteContrast: (r.incomplete.find((i) => i.id === "color-contrast") || { nodes: [] }).nodes.length,
    }))`);
  }
  async function layoutCheck(id, { expectSidebar, expectBanner = true }) {
    const l = await evaluate("window.__aw.layout()");
    const problems = [];
    if (l.scrollWidth > l.innerWidth) problems.push(`horizontal scroll ${l.scrollWidth}>${l.innerWidth}`);
    if (!l.header || Math.round(l.header.height) !== 56) problems.push(`header height ${l.header?.height}`);
    if (expectBanner && (!l.banner || l.banner.bottom > l.header.top + 0.5)) problems.push("banner overlaps header");
    if (l.main.top < l.header.bottom - 0.5) problems.push("main starts under the header");
    if (expectSidebar === null && l.sidebar) problems.push("docked sidebar present");
    if (typeof expectSidebar === "number" && (!l.sidebar || Math.round(l.sidebar.width) !== expectSidebar))
      problems.push(`sidebar width ${l.sidebar?.width} (expected ${expectSidebar})`);
    if (l.sidebar && l.sidebar.top < l.header.bottom - 0.5) problems.push("sidebar under the header");
    check(id, problems.length === 0, problems.join("; ") || `mode=${l.mode}, sidebar=${l.sidebar ? Math.round(l.sidebar.width) : "none"}, main.top=${Math.round(l.main.top)}`);
  }

  for (const theme of ["light", "dark"]) {
    console.log(`\n===== theme: ${theme} =====`);

    // 1. Direct URL loads + axe with real CSS (1440)
    await viewport(1440, 900);
    for (const [path, h1] of SHELL_ROUTES) {
      await goto(path, theme);
      const s = await evaluate(`({ h1: document.querySelector("h1")?.textContent, title: document.title, active: document.activeElement === document.body, banner: !!document.querySelector('[aria-label="Data mode notice"]'), theme: document.documentElement.dataset.theme })`);
      check(`${theme} direct ${path}`, s.h1 === h1 && s.title === `${h1} · Astera Watch` && s.active && s.banner && s.theme === theme, JSON.stringify(s));
      const axe = await runAxe();
      check(`${theme} axe ${path}`, axe.violations.length === 0, axe.violations.length ? JSON.stringify(axe.violations) : `0 violations; contrast undetermined nodes: ${axe.incompleteContrast}`);
    }
    for (const [path, h1, title] of STANDALONE_ROUTES) {
      await goto(path, theme);
      const s = await evaluate(`({ h1: document.querySelector("h1")?.textContent, title: document.title, active: document.activeElement === document.body, banner: !!document.querySelector('[aria-label="Data mode notice"]'), sidebar: !!document.querySelector('[data-sidebar]') })`);
      check(`${theme} direct ${path} (standalone, no banner)`, s.h1 === h1 && s.title === `${title} · Astera Watch` && s.active && !s.banner && !s.sidebar, JSON.stringify(s));
      const axe = await runAxe();
      check(`${theme} axe ${path}`, axe.violations.length === 0, axe.violations.length ? JSON.stringify(axe.violations) : `0 violations; contrast undetermined nodes: ${axe.incompleteContrast}`);
      const tag = path === "/" ? "welcome" : path === "/no/such/page" ? "404" : path.slice(1);
      await shot(`${theme}-${tag}-1440`);
      const pageStops = judgeStops(`${theme} focus ${path} @1440`, await tabWalk());
      if (path === "/login" || path === "/register") {
        // The logo is not a link; "Back to welcome" is a visible, focusable text link that works with Enter.
        const logoIsLink = await evaluate(`!!document.querySelector("main img")?.closest("a")`);
        const back = pageStops.find((s) => s.name === "Back to welcome");
        await goto(path, theme);
        let reached = false;
        for (let i = 0; i < 12 && !reached; i++) {
          await press("Tab");
          reached = (await evaluate("window.__aw.focusInfoSettled()")).name === "Back to welcome";
        }
        await press("Enter");
        let navigated = true;
        try {
          await waitFor(`location.pathname === "/" && document.activeElement?.tagName === "H1"`, 5000, "Back to welcome → Welcome h1");
        } catch {
          navigated = false;
        }
        check(`${theme} ${path}: logo not a link; "Back to welcome" focusable (ring ${back?.ratio}) and Enter goes to Welcome with focus on h1`, !logoIsLink && !!back && reached && navigated, `logoIsLink=${logoIsLink} reached=${reached} navigated=${navigated}`);
      }
    }

    // 1b. F3 development gallery /dev/science (dev builds only) + mock scenarios
    {
      const LIVE = `section[aria-label="Live mock query: synthetic events"]`;
      await goto("/dev/science", theme);
      await waitFor(`document.querySelectorAll('${LIVE} > ul > li').length === 6 && document.body.textContent.includes("Analysis allowed")`, 8000, "gallery data");
      const g = await evaluate(`({ h1: document.querySelector("h1")?.textContent, banner: !!document.querySelector('[aria-label="Data mode notice"]'), mockFirst: [...document.querySelectorAll('ul[aria-label="Data source"]')].every((u) => u.querySelector("li")?.textContent === "MOCK DATA"), lists: document.querySelectorAll('ul[aria-label="Data source"]').length })`);
      check(`${theme} /dev/science renders in the shell; every badge list starts with MOCK DATA`, g.h1 === "Science components (development preview)" && g.banner && g.mockFirst && g.lists > 0, JSON.stringify(g));
      const axe = await runAxe();
      check(`${theme} axe /dev/science`, axe.violations.length === 0, axe.violations.length ? JSON.stringify(axe.violations) : `0 violations; contrast undetermined nodes: ${axe.incompleteContrast}`);
      judgeStops(`${theme} focus /dev/science`, await tabWalk(60));
      await viewport(1440, 4300);
      await sleep(300);
      await shot(`${theme}-dev-science-full`);
      await viewport(1440, 900);

      for (const [scenario, expected] of [["error", "error"], ["empty", "empty"], ["unavailable", "unavailable"]]) {
        await goto(`/dev/science?mockScenario=${scenario}`, theme);
        let state;
        try {
          await waitFor(`document.querySelector('${LIVE} [data-state="${expected}"]') !== null`, 6000, scenario);
          state = expected;
        } catch {
          state = await evaluate(`document.querySelector('${LIVE} [data-state]')?.getAttribute("data-state") ?? "none"`);
        }
        const axeS = await runAxe();
        check(`${theme} mockScenario=${scenario} shows the ${expected} state; axe 0`, state === expected && axeS.violations.length === 0, `state=${state} axe=${JSON.stringify(axeS.violations)}`);
        if (theme === "light" || scenario === "error") await shot(`${theme}-dev-science-${scenario}`);
      }
      await goto(`/dev/science?mockScenario=slow`, theme);
      const loadingSeen = await evaluate(`document.querySelector('${LIVE} [data-state="loading"]') !== null`);
      let loaded = true;
      try {
        await waitFor(`document.querySelectorAll('${LIVE} > ul > li').length === 6`, 6000, "slow scenario data");
      } catch {
        loaded = false;
      }
      check(`${theme} mockScenario=slow shows loading, then the data`, loadingSeen && loaded, `loadingSeen=${loadingSeen} loaded=${loaded}`);
    }

    // 1c. Explorer page: real MapLibre map (software WebGL), markers, selection, layers, filters, detections.
    {
      const MAP = "[data-explorer-map]";
      const mapReady = `!!document.querySelector('${MAP} .maplibregl-canvas') && document.querySelectorAll('[data-event-marker]').length === 6 && !!document.querySelector('${MAP}')?.dataset.zoom && document.querySelectorAll('[data-event-item]').length === 6`;
      await viewport(1440, 900);
      netLog = [];
      await goto("/explorer", theme);
      await waitFor(mapReady, 20000, "explorer map + 6 markers + 6 list items");
      await sleep(800);
      const external = netLog.filter((r) => !r.includes(" " + BASE) && !r.includes(" data:") && !r.includes(" blob:"));
      netLog = null;
      check(`${theme} explorer: map loads with no external requests (local basemap only)`, external.length === 0, external.length ? external.slice(0, 5).join(" | ") : "all requests same-origin");
      const e0 = await evaluate(`({
        markers: [...document.querySelectorAll('[data-event-marker]')].map((m) => m.getAttribute("aria-label")),
        chip: document.querySelector('[data-demo-chip]')?.textContent,
        summary: document.querySelector('[data-results-summary]')?.textContent,
        zoom: Number(document.querySelector('${MAP}').dataset.zoom),
        mockFirst: [...document.querySelectorAll('[data-event-item] ul[aria-label="Data source"]')].every((u) => u.querySelector("li")?.textContent === "MOCK DATA"),
      })`);
      check(
        `${theme} explorer: 6 keyboard markers labelled demo + not confirmed; DEMO chip; MOCK DATA first on every card`,
        e0.markers.every((l) => l.includes("not a confirmed wildfire") && l.includes("Demo data")) && e0.chip === "DEMO DATA · invented locations, not real fires" && e0.mockFirst && e0.summary.startsWith("Showing 6 candidate events and 612 heat detections"),
        JSON.stringify({ chip: e0.chip, summary: e0.summary, zoom: e0.zoom, firstMarker: e0.markers[0] }),
      );
      const axeE = await runAxe();
      check(`${theme} axe /explorer (map loaded)`, axeE.violations.length === 0, axeE.violations.length ? JSON.stringify(axeE.violations) : `0 violations; contrast undetermined nodes: ${axeE.incompleteContrast}`);
      await shot(`${theme}-explorer-page-1440`);

      // Keyboard (real Tab presses, each assertion logged separately): marker ring, Enter selects + zooms, Esc.
      async function tabTo(match, max = 90) {
        for (let i = 0; i < max; i++) {
          await press("Tab");
          const info = await evaluate("window.__aw.focusInfoSettled()");
          if (info.none) return null;
          if (match(info)) return info;
        }
        return null;
      }
      async function waitOk(expression, timeout) {
        try {
          await waitFor(expression, timeout);
          return true;
        } catch {
          return false;
        }
      }
      const ringOk = (i) => !!i && i.visible && i.ratio >= 3 && i.topmost && i.inViewport && !i.overlapsChrome;
      const ringText = (i) => (i ? `vis=${i.visible} w=${i.width} ratio=${i.ratio} top=${i.topmost} inView=${i.inViewport}` : "not reached");
      const marker = await tabTo((i) => i.name.startsWith("SYN-01:"));
      check(`${theme} explorer: SYN-01 marker reached with Tab`, !!marker, marker ? marker.name : "not reached");
      check(`${theme} explorer: marker focus ring visible, ≥3:1, not covered`, ringOk(marker), ringText(marker));
      await press("Enter");
      const selected = await waitOk(`new URLSearchParams(location.search).get("event") === "SYN-01" && document.querySelector('[data-event-marker="SYN-01"]').getAttribute("aria-pressed") === "true"`, 5000);
      check(`${theme} explorer: Enter on the marker selects SYN-01 (URL + aria-pressed)`, selected, await evaluate("location.search"));
      const zoomed = await waitOk(`Number(document.querySelector('${MAP}').dataset.zoom) >= 6`, 8000);
      check(`${theme} explorer: map zooms to the selected event`, zoomed, `zoom ${await evaluate(`document.querySelector('${MAP}').dataset.zoom`)}`);
      await sleep(600);
      const card = await evaluate(`(() => { const c = [...document.querySelectorAll('[data-selection="event"]')].filter((x) => x.getClientRects().length > 0); return { visible: c.length, text: c[0]?.textContent ?? "", href: c[0]?.querySelector("a")?.getAttribute("href") ?? null }; })()`);
      check(`${theme} explorer: exactly one visible card, says "not confirmed", Open event → /events/SYN-01`, card.visible === 1 && card.text.includes("Candidate event · not confirmed") && card.href === "/events/SYN-01", JSON.stringify({ visible: card.visible, href: card.href }));
      await shot(`${theme}-explorer-selected-1440`);
      const focusAfterEnter = await evaluate(`document.activeElement?.dataset?.eventMarker ?? null`);
      await press("Escape");
      await sleep(250);
      const afterEscape = await evaluate(`({ event: new URLSearchParams(location.search).get("event"), card: !!document.querySelector('[data-selection]'), focus: document.activeElement?.dataset?.eventMarker ?? null })`);
      check(`${theme} explorer: Esc clears the selection`, afterEscape.event === null && !afterEscape.card, JSON.stringify(afterEscape));
      check(`${theme} explorer: focus stays on the marker after Enter and Esc`, focusAfterEnter === "SYN-01" && afterEscape.focus === "SYN-01", `afterEnter=${focusAfterEnter} afterEsc=${afterEscape.focus}`);

      // A real detection point on the canvas (zoom ≥ 9): click it → detection card.
      await evaluate(`(() => { const m = document.querySelector('${MAP}').__awMap; m.jumpTo({ center: [-120.62, 38.91], zoom: 10 }); return true; })()`);
      await sleep(1200);
      const pt = await evaluate(`(() => { const m = document.querySelector('${MAP}').__awMap; const f = m.queryRenderedFeatures({ layers: ["detection-points"] }); if (!f.length) return null; const p = m.project(f[0].geometry.coordinates); const r = m.getCanvas().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y, n: f.length }; })()`);
      if (pt) for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
      await sleep(400);
      const det = await evaluate(`document.querySelector('[data-selection="detection"]')?.textContent ?? null`);
      check(`${theme} explorer: clicking a rendered detection point opens its card ("not a confirmed wildfire and not burned area", UTC time)`, !!pt && !!det && det.includes("not a confirmed wildfire and not burned area") && det.includes("UTC"), pt ? `${pt.n} points rendered; card=${!!det}` : "no detection points rendered at zoom 10");
      await shot(`${theme}-explorer-detection-1440`);

      // Layer explanations + switches.
      await goto("/explorer", theme);
      await waitFor(mapReady, 20000, "explorer reload");
      const infoFocus = await tabTo((i) => i.name === "About the layer: Heat detection density");
      check(`${theme} explorer: layer info button reached with Tab`, !!infoFocus, infoFocus ? infoFocus.name : "not reached");
      check(`${theme} explorer: layer info focus ring visible, ≥3:1, not covered`, ringOk(infoFocus), ringText(infoFocus));
      await press("Enter");
      const opened = await waitOk(`!!document.querySelector('[role="dialog"]')`, 4000);
      const pop = opened ? await evaluate(`document.querySelector('[role="dialog"]').textContent`) : "";
      check(`${theme} explorer: Enter opens the layer explanation with "Shows" and "Does not show"`, opened && pop.includes("Shows:") && pop.includes("Does not show:"), pop.slice(0, 120));
      const axeP = await runAxe();
      check(`${theme} axe /explorer with layer explanation open`, axeP.violations.length === 0, JSON.stringify(axeP.violations));
      await shot(`${theme}-explorer-layer-info-1440`);
      await press("Escape");
      await sleep(200);
      const back = await evaluate(`({ dialog: !!document.querySelector('[role="dialog"]'), focus: document.activeElement?.getAttribute("aria-label") })`);
      check(`${theme} explorer: Esc closes the explanation and returns focus to its button`, !back.dialog && back.focus === "About the layer: Heat detection density", JSON.stringify(back));
      await clickAt("#layer-events");
      await sleep(200);
      const hidden = await evaluate(`[...document.querySelectorAll('[data-event-marker]')].every((m) => getComputedStyle(m).display === "none") && !document.querySelector('#layer-events').checked`);
      await clickAt("#layer-events");
      await sleep(200);
      const shown = await evaluate(`document.querySelectorAll('[data-event-marker]').length === 6 && [...document.querySelectorAll('[data-event-marker]')].every((m) => getComputedStyle(m).display !== "none")`);
      check(`${theme} explorer: "Candidate events" switch hides and shows the markers`, hidden && shown, `hidden=${hidden} shown=${shown}`);

      // Country names: approved zoom tiers, no overlaps, never over points/markers/controls, above density squares.
      const SETTLED = `(() => { const m = document.querySelector('${MAP}').__awMap; return m.loaded() && !m.isMoving() && m.areTilesLoaded(); })()`;
      const NAMES = `(() => {
        const ov = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const R = (e) => e.getBoundingClientRect();
        const map = document.querySelector('${MAP}'); const m = map.__awMap; const box = R(map); const z = m.getZoom();
        const max = z < 1.5 ? -1 : z < 2.5 ? 2 : z < 3.5 ? 3 : z < 4.5 ? 4 : Infinity;
        const placed = [...document.querySelectorAll('[data-country-label][data-placed="true"]')];
        const rects = placed.map(R);
        let overlaps = 0; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (ov(rects[i], rects[j])) overlaps++;
        const obst = [...document.querySelectorAll('[data-map-frame] [data-map-overlay]')].map(R).filter((r) => r.width > 0);
        for (const mk of document.querySelectorAll('[data-event-marker]')) if (mk.style.display !== 'none') for (const el of [mk, ...mk.querySelectorAll('*')]) { const r = R(el); if (r.width > 0) obst.push(r); }
        let points = 0;
        if (z >= 9) for (const f of m.queryRenderedFeatures({ layers: ['detection-points'] })) { const p = m.project(f.geometry.coordinates); obst.push({ left: box.left + p.x - 6, right: box.left + p.x + 6, top: box.top + p.y - 6, bottom: box.top + p.y + 6 }); points++; }
        const onDensity = placed.filter((el) => { const r = R(el); return m.queryRenderedFeatures([[r.left - box.left, r.top - box.top], [r.right - box.left, r.bottom - box.top]], { layers: ['density-fill'] }).length > 0; }).map((el) => el.textContent);
        const layer = document.querySelector('[data-country-labels]');
        const kids = layer ? [...layer.parentElement.children] : [];
        const hit = rects[0] ? document.elementFromPoint((rects[0].left + rects[0].right) / 2, (rects[0].top + rects[0].bottom) / 2) : null;
        return { zoom: +z.toFixed(2), placed: placed.length, tierOk: placed.every((el) => Number(el.dataset.minLabel) <= max), overlaps,
          onObstacle: rects.filter((r) => obst.some((o) => ov(r, o))).length, outside: rects.filter((r) => r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom).length,
          points, onDensity, ariaHidden: layer?.getAttribute('aria-hidden'), pointerEvents: layer ? getComputedStyle(layer).pointerEvents : null,
          aboveCanvasBelowMarkers: !!layer && layer.previousElementSibling?.tagName === 'CANVAS' && kids.indexOf(layer) < kids.findIndex((c) => c.matches('[data-event-marker]')),
          clickThrough: hit ? !hit.closest('[data-country-labels]') : null, font: placed[0] ? getComputedStyle(placed[0]).fontFamily.split(',')[0] : null,
          sample: placed.slice(0, 6).map((e) => e.textContent).join(', ') };
      })()`;
      const namesAt = async (lon, lat, zoom) => {
        if (zoom !== null) await evaluate(`document.querySelector('${MAP}').__awMap.jumpTo({ center: [${lon}, ${lat}], zoom: ${zoom} }), true`);
        await sleep(300);
        await waitFor(SETTLED, 10000, "map settled");
        await sleep(500);
        return evaluate(NAMES);
      };
      const namesOk = (s) => s.tierOk && s.overlaps === 0 && s.onObstacle === 0 && s.outside === 0;
      const namesText = (s) => `zoom ${s.zoom}: ${s.placed} names (${s.sample}) overlaps=${s.overlaps} onObstacle=${s.onObstacle} outside=${s.outside}${s.points ? ` points=${s.points}` : ""}`;
      await goto("/explorer", theme);
      await waitFor(mapReady, 20000, "explorer reload (names)");
      await waitFor(`!!document.querySelector('[data-country-labels]')`, 8000, "country names layer");
      const world = await namesAt(0, 0, null);
      check(`${theme} explorer names: none at world view (zoom < 1.5)`, world.placed === 0 && world.zoom < 1.5, namesText(world));
      check(`${theme} explorer names: decorative layer above the density, below markers; hidden from screen readers; not clickable`,
        world.ariaHidden === "true" && world.pointerEvents === "none" && world.aboveCanvasBelowMarkers, JSON.stringify({ ariaHidden: world.ariaHidden, pointerEvents: world.pointerEvents, order: world.aboveCanvasBelowMarkers }));
      for (const [label, lon, lat, zoom] of [["1.5–2.5", -80, 15, 1.6], ["2.5–3.5", 15, 48, 2.6], ["3.5–4.5", 12, 46, 3.6], ["≥ 4.5", 21, 40, 4.6]]) {
        const s = await namesAt(lon, lat, zoom);
        check(`${theme} explorer names @1440 tier ${label}: names shown, tier respected, no overlaps, none on markers/controls, inside the map`, s.placed > 0 && namesOk(s) && s.clickThrough === true, namesText(s) + ` clickThrough=${s.clickThrough} font=${s.font}`);
        if (zoom === 2.6) await shot(`${theme}-explorer-names-1440`);
      }
      const namesPoints = await namesAt(-120.62, 38.91, 10);
      check(`${theme} explorer names @ zoom 10: never cover a FIRMS detection point`, namesPoints.points > 0 && namesOk(namesPoints), namesText(namesPoints));
      const namesDensity = await namesAt(-8.02, 40.12, 4.6);
      check(`${theme} explorer names: drawn over density squares, not hidden by them (Portugal)`, namesDensity.onDensity.length > 0 && namesOk(namesDensity), `on density: ${namesDensity.onDensity.join(", ") || "none"}; ${namesText(namesDensity)}`);
      await shot(`${theme}-explorer-names-on-density`);
      await namesAt(15, 48, 2.6);
      await clickAt("#layer-borders");
      const off = await namesAt(15, 48, null);
      await clickAt("#layer-borders");
      const on = await namesAt(15, 48, null);
      check(`${theme} explorer: "Country borders and names" switch hides and shows the names`, off.placed === 0 && on.placed > 0, `off=${off.placed} on=${on.placed}`);

      // Density legend in plain language.
      const lg = await evaluate(`(() => { const l = document.querySelector('[data-density-legend]'); const d = [...document.querySelectorAll('details')].find((x) => x.querySelector('summary')?.textContent === 'Show density as a table');
        if (d) d.open = true; const head = d ? [...d.querySelectorAll('th')].map((t) => t.textContent) : [];
        return { text: l.textContent, rows: [...l.querySelectorAll('li')].map((li) => li.textContent), relOpen: l.querySelector('details').open, head,
          kinds: [...document.querySelectorAll('ul[aria-label="Points and squares"] li')].length }; })()`);
      check(`${theme} explorer legend: exact title, time window, permanent explanation, level words with ranges + unit, relative note collapsed, points vs squares, table Level column`,
        lg.text.includes("FIRMS detection density, not burned area") && lg.text.includes("Time window:") &&
          lg.text.includes("Stronger colours indicate more FIRMS detections within an area during the selected period. They do not show the size or intensity of a burned area.") &&
          lg.rows.length > 0 && lg.rows.every((r, i) => r.startsWith(["Lowest", "Low", "Middle", "High", "Highest"][i]) && r.includes("detections per cell")) &&
          !lg.relOpen && lg.kinds === 3 && lg.head.includes("Level"),
        JSON.stringify({ rows: lg.rows, relOpen: lg.relOpen, kinds: lg.kinds, head: lg.head }));
      const axeL = await runAxe();
      check(`${theme} axe /explorer with names and the density table open`, axeL.violations.length === 0, axeL.violations.length ? JSON.stringify(axeL.violations) : "0 violations");
      // The checks below start from a fresh page, as before.
      await goto("/explorer", theme);
      await waitFor(mapReady, 20000, "explorer reload (filters)");

      // Filters and search.
      await evaluate(`(() => { const s = [...document.querySelectorAll("select")].find((x) => x.labels[0]?.textContent === "Country"); s.value = "PRT"; s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
      await waitFor(`document.querySelectorAll('[data-event-item]').length === 1 && document.querySelectorAll('[data-event-marker]').length === 1`, 5000, "country filter");
      const country = await evaluate(`({ q: location.search, item: document.querySelector('[data-event-item]').dataset.eventItem })`);
      await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear filters").click(), true`);
      await waitFor(`document.querySelectorAll('[data-event-item]').length === 6`, 5000, "clear filters");
      await evaluate(`document.querySelector('input[type="search"]').focus(), true`);
      await cdp.send("Input.insertText", { text: "SYN-05" });
      await waitFor(`document.querySelectorAll('[data-event-item]').length === 1`, 5000, "search");
      const search = await evaluate(`({ q: new URLSearchParams(location.search).get("q"), item: document.querySelector('[data-event-item]').dataset.eventItem })`);
      check(`${theme} explorer: country filter (PRT → SYN-03) and search (SYN-05) update list, markers and URL`, country.item === "SYN-03" && country.q.includes("country=PRT") && search.item === "SYN-05" && search.q === "SYN-05", JSON.stringify({ country, search }));
      judgeStops(`${theme} focus /explorer page controls (filters, layers, map, list)`, await tabWalk(60));
      const storage = await evaluate(`Object.keys(localStorage).concat(Object.keys(sessionStorage))`);
      check(`${theme} explorer: no new storage keys`, storage.every((k) => ALLOWED_STORAGE_KEYS.includes(k)), JSON.stringify(storage));

      // 1024: zoomed to SYN-01 ("Show on map"), the other events are outside the map. Only markers fully visible
      // inside the map are Tab stops; off-map markers are skipped (tabindex -1, aria-hidden); Tab never moves the map.
      await viewport(1024, 768);
      await goto("/explorer", theme);
      await waitFor(mapReady, 20000, "explorer 1024");
      await waitFor(`[...document.querySelectorAll('[data-event-marker]')].every((m) => m.dataset.reachable !== undefined)`, 8000, "marker reach computed (world)");
      const worldAt1024 = await evaluate(`[...document.querySelectorAll('[data-event-marker]')].map((m) => m.dataset.reachable)`);
      await shot(`${theme}-explorer-page-1024`);
      await evaluate(`[...document.querySelectorAll('[data-event-item="SYN-01"] button')].find((b) => b.textContent.includes("Show on map")).click(), true`);
      await waitFor(`Number(document.querySelector('${MAP}').dataset.zoom) >= 6 && !document.querySelector('${MAP}').__awMap.isMoving()`, 10000, "zoomed to SYN-01");
      await sleep(500);
      await evaluate(`document.querySelector('main h1').focus(), true`);
      await waitFor(`[...document.querySelectorAll('[data-event-marker]')].every((m) => m.dataset.reachable !== undefined)`, 8000, "marker reach computed");
      const reach = await evaluate(`(() => {
        const box = document.querySelector('${MAP}').getBoundingClientRect();
        return [...document.querySelectorAll('[data-event-marker]')].map((m) => { const r = m.getBoundingClientRect();
          return { id: m.dataset.eventMarker, tab: m.tabIndex, hidden: m.getAttribute("aria-hidden"), inside: r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom }; });
      })()`);
      check(`${theme} explorer @1024: markers fully inside the map are Tab stops; the others are skipped and hidden`,
        reach.every((m) => (m.inside ? m.tab === 0 && m.hidden === null : m.tab === -1 && m.hidden === "true")) && reach.some((m) => !m.inside),
        reach.map((m) => `${m.id}:${m.inside ? "in" : "OUT"}/tab=${m.tab}`).join(" "));
      check(`${theme} explorer @1024: the whole world fits, so all 6 markers are reachable in the world view`, worldAt1024.length === 6 && worldAt1024.every((v) => v === "true"), worldAt1024.join(","));
      const centreBefore = await evaluate(`document.querySelector('${MAP}').__awMap.getCenter().toArray().map((v) => v.toFixed(4)).join(",")`);
      const markerStops = [];
      for (let i = 0; i < 60; i++) {
        await press("Tab");
        const info = await evaluate("window.__aw.focusInfoSettled()");
        if (info.none) break;
        if (info.name.startsWith("SYN-")) markerStops.push(info);
      }
      const centreAfter = await evaluate(`document.querySelector('${MAP}').__awMap.getCenter().toArray().map((v) => v.toFixed(4)).join(",")`);
      check(`${theme} explorer @1024: every marker Tab stop is visible, ≥3:1, uncovered and on screen`, markerStops.length > 0 && markerStops.every(ringOk), markerStops.map((i) => `${i.name.slice(0, 6)} ${ringText(i)}`).join("; "));
      check(`${theme} explorer @1024: Tab through the markers does not move the map`, centreBefore === centreAfter, `${centreBefore} → ${centreAfter}`);
      await shot(`${theme}-explorer-zoomed-1024`);
      await viewport(1440, 900);

      // Mobile 390: no horizontal scroll, world fits, card below the map, disclosures.
      await viewport(390, 844);
      await goto("/explorer?event=SYN-03", theme);
      await waitFor(mapReady, 20000, "explorer mobile");
      await sleep(800);
      const m = await evaluate(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, filtersHidden: getComputedStyle(document.querySelector('#explorer-filters')).display === "none", card: [...document.querySelectorAll('[data-selection="event"]')].filter((c) => c.getClientRects().length > 0).length, mapW: document.querySelector('${MAP}').clientWidth })`);
      check(`${theme} explorer @390: no horizontal scroll; filters folded; selection card below the map`, m.sw <= m.iw && m.filtersHidden && m.card === 1, JSON.stringify(m));
      await shot(`${theme}-explorer-390-selected`);
      await goto("/explorer", theme);
      await waitFor(mapReady, 20000, "explorer mobile world");
      await sleep(600);
      const worldZoom = await evaluate(`Number(document.querySelector('${MAP}').dataset.zoom)`);
      check(`${theme} explorer @390: whole world fits the map width`, worldZoom <= 0, `zoom ${worldZoom}`);
      await shot(`${theme}-explorer-page-390`);
      judgeStops(`${theme} focus /explorer page @390`, await tabWalk(40));
      const mobileWorld = await namesAt(0, 0, null);
      const mobileNames = await namesAt(15, 48, 2.6);
      check(`${theme} explorer names @390: none at world view; after zooming in, names without overlaps, inside the map`,
        mobileWorld.placed === 0 && mobileNames.placed > 0 && namesOk(mobileNames), `world=${mobileWorld.placed}; ${namesText(mobileNames)}`);
      await evaluate(`document.querySelector('[data-map-frame]').scrollIntoView({ block: "center" }), true`);
      await shot(`${theme}-explorer-names-390`);
      await viewport(1440, 900);
    }

    // 2. Shell at 1440: layout, Tab walk, collapse + persistence, Back/Forward
    await goto("/explorer", theme);
    await layoutCheck(`${theme} layout /explorer @1440`, { expectSidebar: 240 });
    await shot(`${theme}-explorer-1440-expanded`);
    const shellStops = judgeStops(`${theme} focus /explorer @1440 (banner link, header, sidebar)`, await tabWalk());
    check(`${theme} tab order starts with skip link then banner link`, shellStops[0]?.name === "Skip to main content" && shellStops[1]?.name === "About mock data", shellStops.slice(0, 3).map((s) => s.name).join(" → "));
    const bannerStop = shellStops.find((s) => s.name === "About mock data");
    check(`${theme} banner link focus ring ≥3:1 on yellow`, bannerStop && bannerStop.ratio >= 3, bannerStop ? `ratio ${bannerStop.ratio}` : "not reached");

    await clickAt('[data-sidebar="docked"] button[aria-controls="sidebar-nav"]');
    await sleep(450);
    await layoutCheck(`${theme} layout collapsed @1440`, { expectSidebar: 72 });
    await shot(`${theme}-explorer-1440-collapsed`);
    const axeCollapsed = await runAxe();
    check(`${theme} axe collapsed sidebar`, axeCollapsed.violations.length === 0, JSON.stringify(axeCollapsed.violations));
    // Mark the current document so the wait below only succeeds on the reloaded one (not before the reload starts).
    await evaluate("window.__awBeforeReload = true");
    await cdp.send("Page.reload");
    await waitFor("window.__awBeforeReload === undefined && document.readyState === 'complete' && !!document.querySelector('[data-sidebar]')", 10000, "reload completed");
    await sleep(200);
    await layoutCheck(`${theme} collapse remembered after reload`, { expectSidebar: 72 });
    // Tab walk from the top of the freshly loaded (still collapsed) page, not from the collapse button.
    const collapsedStops = judgeStops(`${theme} focus collapsed sidebar @1440 (inset rings, tooltips)`, await tabWalk());
    const navNames = ["Explorer", "Event Details", "Data Availability", "SAR Analysis", "Reports & Insights", "AI Assistant", "Data & Methodology"];
    check(`${theme} collapsed sidebar: all 7 items reachable by Tab`, navNames.every((n) => collapsedStops.some((s) => s.name === n)), collapsedStops.map((s) => s.name).join(" → "));
    await evaluate("localStorage.removeItem('astera-sidebar'), true");

    await goto("/explorer", theme);
    await evaluate(`[...document.querySelectorAll('[data-sidebar] a')].find((a) => a.textContent.trim() === "Reports & Insights").focus(), true`);
    await press("Enter");
    await waitFor(`location.pathname === "/reports" && document.activeElement?.tagName === "H1"`, 5000, "focus h1 after Enter on sidebar link");
    await evaluate("history.back(), true");
    await waitFor(`location.pathname === "/explorer" && document.activeElement?.textContent === "Global Fire Explorer"`, 5000, "Back");
    const backTitle = await evaluate("document.title");
    await evaluate("history.forward(), true");
    await waitFor(`location.pathname === "/reports" && document.activeElement?.textContent === "Reports & Insights"`, 5000, "Forward");
    const fwdTitle = await evaluate("document.title");
    check(`${theme} Back/Forward move focus to h1 and update the title`, backTitle === "Global Fire Explorer · Astera Watch" && fwdTitle === "Reports & Insights · Astera Watch", `${backTitle} | ${fwdTitle}`);

    // 3. 1024
    await viewport(1024, 768);
    await goto("/explorer", theme);
    await layoutCheck(`${theme} layout /explorer @1024`, { expectSidebar: 240 });
    await shot(`${theme}-explorer-1024`);
    judgeStops(`${theme} focus /explorer @1024`, await tabWalk());

    // 4. 390: drawer
    await viewport(390, 844);
    await goto("/explorer", theme);
    await layoutCheck(`${theme} layout /explorer @390`, { expectSidebar: null });
    await shot(`${theme}-explorer-390`);
    judgeStops(`${theme} focus /explorer @390`, await tabWalk());

    await goto("/explorer", theme);
    let stops = [];
    for (let i = 0; i < 6; i++) {
      await press("Tab");
      const info = await evaluate("window.__aw.focusInfoSettled()");
      stops.push(info);
      if (info.name === "Open navigation menu") break;
    }
    await press("Enter");
    await waitFor(`!!document.querySelector('[role="dialog"]')`, 4000, "drawer open");
    await sleep(150);
    await shot(`${theme}-explorer-390-drawer`);
    const axeDrawer = await runAxe();
    check(`${theme} axe open drawer`, axeDrawer.violations.length === 0, JSON.stringify(axeDrawer.violations));
    const drawerStops = await tabWalk(24);
    judgeStops(`${theme} focus inside drawer`, drawerStops);
    check(`${theme} drawer traps focus`, drawerStops.length === 24 && drawerStops.every((s) => s.inDialog), `${drawerStops.filter((s) => s.inDialog).length}/${drawerStops.length} stops inside`);
    await press("Escape");
    await waitFor(`!document.querySelector('[role="dialog"]')`, 4000, "drawer closed");
    await sleep(100);
    const afterEsc = await evaluate("window.__aw.focusInfoSettled()");
    check(`${theme} Esc closes drawer, focus back on menu button`, afterEsc.name === "Open navigation menu", afterEsc.name);

    await press("Enter");
    await waitFor(`!!document.querySelector('[role="dialog"]')`, 4000, "drawer reopen");
    await evaluate(`[...document.querySelectorAll('[role="dialog"] a')].find((a) => a.textContent.trim() === "Reports & Insights").focus(), true`);
    await press("Enter");
    await waitFor(`location.pathname === "/reports" && !document.querySelector('[role="dialog"]') && document.activeElement?.tagName === "H1"`, 5000, "drawer navigation");
    check(`${theme} navigating from the drawer closes it and focuses the new h1`, true, await evaluate("document.activeElement.textContent"));

    await goto("/analysis", theme);
    await evaluate(`document.querySelector('[aria-label="Open navigation menu"]').click(), true`);
    await waitFor(`!!document.querySelector('[role="dialog"]')`, 4000, "drawer open before resize");
    await viewport(1024, 768);
    await waitFor(`!document.querySelector('[role="dialog"]') && !!document.querySelector('[data-sidebar="docked"]')`, 4000, "drawer closed by resize");
    await sleep(150);
    const afterResize = await evaluate(`({ active: document.activeElement?.getAttribute("aria-current"), name: document.activeElement?.textContent?.trim() })`);
    check(`${theme} resize 390→1024 with drawer open: drawer closes, focus on active sidebar item`, afterResize.active === "page" && afterResize.name === "SAR Analysis", JSON.stringify(afterResize));
    await layoutCheck(`${theme} layout after resize to 1024`, { expectSidebar: 240 });

    // 5. Short screen (landscape phone): page scroll, nothing fixed
    await viewport(844, 390);
    await goto("/explorer", theme);
    const short = await evaluate(`({ main: getComputedStyle(document.querySelector("main")).overflowY, frameHeight: document.querySelector("[data-shell-mode]").getBoundingClientRect().height, inner: innerHeight })`);
    check(`${theme} short screen 844×390 uses page scrolling`, short.main === "visible", JSON.stringify(short));
    await shot(`${theme}-explorer-short-844x390`);
    judgeStops(`${theme} focus /explorer short screen`, await tabWalk());

    // 6. Login/Register: storage, cookie and network audit after form interaction
    await viewport(1440, 900);
    for (const path of ["/login", "/register"]) {
      await goto(path, theme);
      await evaluate("sessionStorage.clear(), true");
      netLog = []; // record only from here on (form interaction), not app/asset loading
      await tabWalk(30);
      for (const id of await evaluate(`[...document.querySelectorAll("form input")].map((i) => i.id)`)) {
        await clickAt(`#${id}`);
        await cdp.send("Input.insertText", { text: SECRET });
        await press("a");
      }
      await press("Enter");
      await evaluate(`document.querySelector("form").requestSubmit(), true`);
      await sleep(300);
      const audit = await evaluate(`(() => {
        const dump = (s) => Object.fromEntries([...Array(s.length).keys()].map((i) => [s.key(i), s.getItem(s.key(i))]));
        return { path: location.pathname, values: [...document.querySelectorAll("form input")].map((i) => i.value),
                 // :disabled includes inputs disabled by their <fieldset> (input.disabled does not).
                 disabled: [...document.querySelectorAll("form input")].every((i) => i.matches(":disabled")),
                 local: dump(localStorage), session: dump(sessionStorage), cookie: document.cookie };
      })()`);
      const requests = netLog;
      netLog = null;
      const keys = [...Object.keys(audit.local), ...Object.keys(audit.session)];
      const leaked = JSON.stringify([audit.local, audit.session]).includes("secret");
      check(
        `${theme} ${path}: nothing stored, nothing sent after typing and submit attempts`,
        audit.path === path && audit.disabled && audit.values.every((v) => v === "") && keys.every((k) => ALLOWED_STORAGE_KEYS.includes(k)) &&
          Object.keys(audit.session).length === 0 && !leaked && audit.cookie === "" && requests.length === 0,
        `path=${audit.path} disabled=${audit.disabled} keys=${JSON.stringify(keys)} cookie=${JSON.stringify(audit.cookie)} requests=${JSON.stringify(requests)} values=${JSON.stringify(audit.values)}`,
      );
    }
  }

  check("no uncaught page exceptions", exceptions.length === 0, exceptions.slice(0, 5).join(" | "));

  // shutdown
  try {
    const b = await Cdp.connect(version.webSocketDebuggerUrl);
    await b.send("Browser.close");
  } catch {
    browser.kill();
  }
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* profile still locked: harmless temp folder */
  }

  const failed = results.filter((r) => !r.pass);
  writeFileSync(join(OUT, "report.json"), JSON.stringify({ base: BASE, date: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Report: ${join(OUT, "report.json")}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("browser-checks aborted:", err);
  process.exit(2);
});
