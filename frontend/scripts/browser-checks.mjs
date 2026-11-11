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
 * audit after form interaction. Exit code 1 if anything fails.
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
      "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "--disable-extensions", "about:blank"],
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
    await cdp.send("Page.reload");
    await waitFor("document.readyState === 'complete' && !!document.querySelector('[data-sidebar]')");
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
