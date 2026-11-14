// Real-browser journey checks (headless Microsoft Edge over the DevTools protocol) against the running dev server.
// Usage: node scripts/journey-checks.mjs [screenshotDir]
//   Needs `npm run dev` on http://localhost:5173 and Edge installed. No extra dependencies.
// Covers, in Light and Dark at 1440, 1024 and 390 px: layout (no sideways scrolling, one demo label, right menu),
// axe-core WCAG A/AA on the rendered page INCLUDING colour contrast, and the main journeys: country search → map
// zooms → density squares → select a possible fire → Fire Story → history → My places (still reachable by its links,
// no longer in the menu) → Research Center (labels only, no controls) → Help (Guide, Ask Astera).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ? resolve(process.argv[2]) : null;
if (OUT) mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5173";
const PORT = 9381;
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"];
const AXE = readFileSync(resolve(here, "../node_modules/axe-core/axe.min.js"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edgePath = EDGE.find((p) => {
  try {
    readFileSync(p, { flag: "r" });
    return true;
  } catch {
    return false;
  }
});
if (!edgePath) throw new Error("Microsoft Edge not found");
const profileDir = mkdtempSync(join(tmpdir(), "aw-journeys-"));
const browser = spawn(
  edgePath,
  ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, "--no-first-run", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--disable-extensions", "about:blank"],
  { stdio: "ignore" },
);

// Guaranteed cleanup: on Windows the spawned msedge.exe hands off to another process and exits, so browser.kill()
// alone leaves the real headless browser running. On every exit (success, failed checks, thrown errors, Ctrl+C) close
// the Edge processes started with THIS run's unique temporary profile, and nothing else (other Edge windows never use
// that profile folder).
let ws = null;
let cleanedUp = false;
function closeBrowser() {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    ws?.close();
  } catch {
    /* already closed */
  }
  try {
    browser.kill();
  } catch {
    /* launcher already gone */
  }
  if (process.platform === "win32") {
    const profileName = basename(profileDir); // aw-journeys-XXXXXX: unique per run
    spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*--user-data-dir=*${profileName}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore", timeout: 20000 },
    );
  }
}
process.on("exit", closeBrowser);
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(signal, () => process.exit(130));
process.on("uncaughtException", (e) => {
  console.error(e);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  process.exit(1);
});

for (let i = 0; i < 100; i++) {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/version`);
    break;
  } catch {
    await sleep(150);
  }
}
const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0;
const pending = new Map();
const pageErrors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
});
// Every DevTools command has a time limit: a stuck page fails that step instead of hanging the whole run.
const send = (method, params = {}, ms = 30000) =>
  new Promise((ok, fail) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      fail(new Error(`DevTools command timed out: ${method}`));
    }, ms);
    pending.set(id, (m) => {
      clearTimeout(timer);
      if (m.error) fail(new Error(m.error.message));
      else ok(m.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expr, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await ev(expr)) return true;
    } catch {
      /* page navigating */
    }
    await sleep(100);
  }
  throw new Error(`timeout: ${expr}`);
};
const MAP_IDLE = `(() => { const m = document.querySelector('[data-explorer-map]')?.__awMap; return !!m && m.loaded() && !m.isMoving() && m.areTilesLoaded(); })()`;
await send("Page.enable");
await send("Runtime.enable");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const shot = async (name) => {
  if (!OUT) return;
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
};
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    check(name, false, String(e.message ?? e).slice(0, 300));
  }
};

async function open(path, theme, w, h, { welcome = false, places = null } = {}) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: `${BASE}/planned` });
  await waitFor("document.readyState==='complete'");
  await ev(`(() => { localStorage.setItem('astera-theme', ${JSON.stringify(theme)});
    ${welcome ? "localStorage.removeItem('astera-watch-welcome-dismissed')" : "localStorage.setItem('astera-watch-welcome-dismissed','1')"};
    ${places === null ? "" : `localStorage.setItem('astera-watch-places', ${JSON.stringify(JSON.stringify(places))});`}
    return true; })()`);
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitFor("document.readyState==='complete' && !!document.querySelector('[data-page-heading]')");
  await sleep(400);
}

async function axe(label) {
  await ev(`window.axe ? true : (eval(${JSON.stringify(AXE)}), true)`);
  const v = await ev(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
    .then(r => r.violations.map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0,3).map(n => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ') })))`);
  check(`${label}: axe WCAG A/AA incl. colour contrast`, v.length === 0, v.map((x) => `${x.id}×${x.n}: ${x.t}`).join(" ;; ").slice(0, 600));
}

async function layout(label, w) {
  const l = await ev(`(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    demoBars: document.querySelectorAll('[data-demo-bar]').length,
    headerNav: !!document.querySelector('header nav[aria-label=Main]'),
    bottomNav: !!document.querySelector('[data-bottom-nav]'),
    theme: document.documentElement.dataset.theme,
    h1: document.querySelector('h1')?.textContent ?? '',
  }))()`);
  check(`${label}: no sideways scrolling`, !l.overflowX);
  check(`${label}: exactly one demo label`, l.demoBars === 1, `found ${l.demoBars}`);
  check(`${label}: ${w < 768 ? "phone tab bar" : "header menu"}`, w < 768 ? l.bottomNav && !l.headerNav : l.headerNav && !l.bottomNav);
  return l;
}

const VIEWS = [
  [1440, 900, "desktop"],
  [1024, 768, "laptop"],
  [390, 844, "phone"],
];

for (const theme of ["light", "dark"]) {
  for (const [w, h, tag] of VIEWS) {
    const L = `${theme} ${tag} ${w}px`;

    await step(`${L}: homepage`, async () => {
      await open("/", theme, w, h, { welcome: true });
      await waitFor(MAP_IDLE);
      await sleep(500);
      const l = await layout(`${L} Fire map`, w);
      check(`${L}: theme applied`, l.theme === theme);
      check(`${L}: welcome explains the journey`, await ev(`!!document.querySelector('[data-welcome]') && document.querySelector('[data-welcome]').textContent.includes('Fire Story')`));
      const world = await ev(`(() => { const m = document.querySelector('[data-explorer-map]').__awMap; return { zoom: m.getZoom(), squares: m.queryRenderedFeatures({ layers: ['density-fill'] }).length, markers: document.querySelectorAll('[data-event-marker]').length }; })()`);
      check(`${L}: world scale shows possible-fire markers, no density squares`, world.markers === 6 && world.squares === 0, JSON.stringify(world));
      await shot(`${theme}-${tag}-01-home`);
      await axe(`${L} Fire map`);
    });

    await step(`${L}: country search`, async () => {
      await open("/", theme, w, h);
      await waitFor(MAP_IDLE);
      await ev(`(() => { const i = document.querySelector('input[role=combobox]'); i.focus(); return true; })()`);
      await send("Input.insertText", { text: "Portu" });
      await waitFor(`document.querySelector('[data-country-option="PRT"]')?.getAttribute('aria-selected') === 'true'`);
      if (theme === "light" && tag === "desktop") await shot(`${theme}-${tag}-02-search-suggestions`);
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await waitFor(`location.search.includes('country=PRT')`);
      await sleep(1500);
      await waitFor(MAP_IDLE);
      await sleep(500);
      // Portugal's mainland box (Natural Earth): every corner on screen, and not under a floating panel (map key).
      const r = await ev(`(() => { const el = document.querySelector('[data-explorer-map]'); const m = el.__awMap; const box = el.getBoundingClientRect();
        const pts = [[-9.5, 36.9], [-6.2, 36.9], [-9.5, 42.2], [-6.2, 42.2]].map(p => m.project(p)).map(p => ({ x: p.x + box.left, y: p.y + box.top }));
        const panels = [...document.querySelectorAll('[data-map-key][data-map-overlay]')].map(o => o.getBoundingClientRect());
        const inside = pts.every(p => p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom);
        const covered = pts.some(p => panels.some(k => p.x >= k.left && p.x <= k.right && p.y >= k.top && p.y <= k.bottom));
        return { zoom: m.getZoom(), inside, covered, squares: m.queryRenderedFeatures({ layers: ['density-fill'] }).length, list: [...document.querySelectorAll('[data-event-item]')].map(e => e.dataset.eventItem), hidden: !!document.querySelector('[data-density-hidden]') }; })()`);
      check(`${L}: search moves the map to Portugal (whole country visible, not under the key)`, r.zoom >= 4 && r.inside && !r.covered, `zoom ${r.zoom.toFixed(1)} inside=${r.inside} covered=${r.covered}`);
      check(`${L}: regional zoom shows density squares and their legend`, r.squares > 0 && !r.hidden, `${r.squares} squares`);
      check(`${L}: list narrowed to Portugal`, JSON.stringify(r.list) === '["SYN-03"]', JSON.stringify(r.list));
      if (w >= 1024) await shot(`${theme}-${tag}-03-country-density`);
      else {
        await shot(`${theme}-${tag}-03-country-density`);
        await ev(`(() => { const m = document.getElementById('main'); const k = document.querySelector('[data-map-key]'); m.scrollTop = k.offsetTop - 8; return true; })()`);
        await sleep(300);
        await shot(`${theme}-${tag}-04-legend`);
      }
    });

    await step(`${L}: select a possible fire`, async () => {
      await open("/?event=SYN-01", theme, w, h);
      await waitFor(MAP_IDLE);
      await sleep(1200);
      await waitFor(MAP_IDLE);
      const s = await ev(`(() => { const c = document.querySelector('[data-selection=event]'); return c ? c.textContent : ''; })()`);
      check(`${L}: selection card says what is known and not known`, s.includes("What we know") && s.includes("What we don't know yet") && s.includes("not confirmed"));
      check(`${L}: selection card links to the Fire Story`, await ev(`!!document.querySelector('[data-selection=event] a[href="/events/SYN-01"]')`));
      if (w < 1024) {
        await ev(`(() => { const m = document.getElementById('main'); const s = document.querySelector('[data-selection]'); m.scrollTop = s.offsetTop - 8; return true; })()`);
        await sleep(300);
      }
      await shot(`${theme}-${tag}-05-selected-fire`);
      await axe(`${L} Fire map with a selection`);
    });

    await step(`${L}: Fire Story`, async () => {
      await open("/events/SYN-01", theme, w, h);
      await waitFor(`document.querySelectorAll('[data-story-section]').length === 7 && !!document.querySelector('[data-known]')`);
      await waitFor(MAP_IDLE);
      await sleep(800);
      await layout(`${L} Fire Story`, w);
      check(`${L}: Fire Story title`, (await ev(`document.title`)) === "SYN-01 · Fire Story · Astera Watch");
      await shot(`${theme}-${tag}-06-story-top`);
      for (const [id, n] of [["known", "07"], ["heat-spots", "08"], ["radar-data", "09"], ["analysis", "10"]]) {
        await ev(`(() => { const m = document.getElementById('main'); const s = document.getElementById('${id}'); m.scrollTop = s.offsetTop - 8; return true; })()`);
        await sleep(350);
        await shot(`${theme}-${tag}-${n}-story-${id}`);
      }
      const a = await ev(`document.getElementById('analysis').textContent`);
      check(`${L}: analysis is an estimate with range, not burned area`, a.includes("Estimated 18.4 km²") && a.includes("Not a burned-area measurement"));
      await axe(`${L} Fire Story`);
    });

    await step(`${L}: Fire Story without a usable pair`, async () => {
      await open("/events/SYN-04", theme, w, h);
      await waitFor(`!!document.getElementById('analysis') && document.getElementById('analysis').textContent.includes('not possible')`);
      check(`${L}: locked analysis shows no number`, !(await ev(`document.getElementById('analysis').textContent.includes('km²')`)));
    });

    await step(`${L}: Fire history`, async () => {
      await open("/history", theme, w, h);
      await waitFor(`document.querySelectorAll('[data-history-item]').length === 6 && document.querySelector('[data-history-item="SYN-01"]').textContent.includes('km²')`);
      await layout(`${L} Fire history`, w);
      await shot(`${theme}-${tag}-11-history`);
      await axe(`${L} Fire history`);
    });

    await step(`${L}: My places`, async () => {
      await open("/places", theme, w, h, { places: ["PRT", "USA"] });
      await waitFor(`document.querySelectorAll('[data-place]').length === 2 && document.querySelector('[data-place="PRT"]').textContent.includes('Possible fires')`);
      await layout(`${L} My places`, w);
      check(`${L}: alerts marked not available, no contact fields`, await ev(`document.querySelector('[data-alerts]').textContent.includes('Not available yet') && !document.querySelector('input[type=email],input[type=tel]')`));
      await shot(`${theme}-${tag}-12-places`);
      await axe(`${L} My places`);
    });

    await step(`${L}: Research Center`, async () => {
      for (const [path, n] of [["/research", "12b-research"], ["/research/models", "12c-research-models"]]) {
        await open(path, theme, w, h);
        await waitFor(`!!document.querySelector('[data-page-heading]')`);
        await layout(`${L} ${path}`, w);
        check(
          `${L} ${path}: labelled not available/planned, no controls in the page`,
          await ev(`(() => { const m = document.getElementById('main'); const t = m.textContent;
            return (t.includes('Not available yet') || t.includes('Planned')) && !m.querySelector('form, input, textarea, select, button'); })()`),
        );
        await shot(`${theme}-${tag}-${n}`);
        await axe(`${L} ${path}`);
      }
      check(
        `${L}: main navigation has Research Center, not My places`,
        await ev(`(() => { const t = [...document.querySelectorAll('nav[aria-label="Main"] a')].map(a => a.textContent.trim());
          return t.some(x => x.startsWith('Research')) && !t.some(x => x.includes('My places')); })()`),
      );
      check(`${L}: header items fit without overflow`, await ev(`(() => { const hd = document.querySelector('header'); return hd.scrollWidth <= hd.clientWidth; })()`));
    });

    await step(`${L}: research project create → details → delete`, async () => {
      const PK = "astera-watch-research-projects";
      await open("/research/projects", theme, w, h, { places: ["PRT"] });
      await ev(`(() => { localStorage.removeItem(${JSON.stringify(PK)}); return true; })()`);
      await open("/research/projects", theme, w, h, { places: ["PRT"] });
      await waitFor(`document.body.textContent.includes('No projects yet')`);
      await layout(`${L} projects list`, w);
      await axe(`${L} projects list (empty)`);
      await open("/research/projects/new", theme, w, h, { places: ["PRT"] });
      await layout(`${L} new project form`, w);
      await axe(`${L} new project form`);
      await ev(`(() => { const t = document.querySelector('form input[aria-required=true]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(t, 'Browser check project');
        t.dispatchEvent(new Event('input', { bubbles: true }));
        [...document.querySelectorAll('form button[type=submit]')][0].click(); return true; })()`);
      await waitFor(`location.pathname.startsWith('/research/projects/P-') && document.querySelector('h1')?.textContent === 'Browser check project'`);
      check(`${L}: project saved in this browser`, await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(PK)})).projects.length === 1`));
      await sleep(300);
      await layout(`${L} project details`, w);
      await shot(`${theme}-${tag}-12d-project`);
      await axe(`${L} project details`);
      await ev(`(() => { [...document.querySelectorAll('main button')].find(b => b.textContent.includes('Delete project')).click(); return true; })()`);
      await waitFor(`!!document.querySelector('[data-delete-dialog]')`);
      await sleep(300);
      await shot(`${theme}-${tag}-12e-delete-dialog`);
      await axe(`${L} delete dialog`);
      await ev(`(() => { [...document.querySelectorAll('[data-delete-dialog] button')].find(b => b.textContent.includes('Delete project')).click(); return true; })()`);
      await waitFor(`location.pathname === '/research/projects' && document.body.textContent.includes('No projects yet')`);
      check(
        `${L}: project deleted after confirmation; saved places untouched`,
        await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(PK)})).projects.length === 0 && localStorage.getItem('astera-watch-places') === '["PRT"]'`),
      );
    });

    await step(`${L}: datasets catalog → details → add to a project → remove`, async () => {
      const PK = "astera-watch-research-projects";
      const project = { id: "P-browser-check", title: "Dataset check", description: null, objectives: [], status: "planning",
        studyArea: { geometry: null, bbox: null, countriesIso3: [], description: null }, period: null, linkedEventIds: [], datasetIds: [],
        annotationIds: [], modelRunIds: [], reportIds: [], createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z", storage: "browser" };
      await open("/research/data", theme, w, h, { places: ["PRT"] });
      await ev(`(() => { localStorage.setItem(${JSON.stringify(PK)}, ${JSON.stringify(JSON.stringify({ version: 1, projects: [project] }))}); return true; })()`);
      await open("/research/data", theme, w, h, { places: ["PRT"] });
      await waitFor(`document.querySelectorAll('[data-dataset]').length > 0`);
      check(
        `${L}: catalog separates real, demo and unconnected sources`,
        await ev(`!!document.querySelector('[data-dataset-group="real"]') && !!document.querySelector('[data-dataset-group="demo"]') && document.querySelectorAll('[data-sources] [data-source]').length === 3 && !document.querySelector('[data-sources] a, [data-sources] button')`),
      );
      await layout(`${L} datasets catalog`, w);
      await shot(`${theme}-${tag}-12f-datasets`);
      await axe(`${L} datasets catalog`);
      await open("/research/data/demo-heat-spots", theme, w, h, { places: ["PRT"] });
      await waitFor(`[...document.querySelectorAll('main button')].some(b => b.textContent.includes('Add to project'))`);
      await layout(`${L} dataset details`, w);
      await shot(`${theme}-${tag}-12g-dataset`);
      await axe(`${L} dataset details`);
      await ev(`(() => { [...document.querySelectorAll('main button')].find(b => b.textContent.includes('Add to project')).click(); return true; })()`);
      await waitFor(`document.querySelector('[data-add-message]')?.textContent.includes('Added to')`);
      check(`${L}: dataset linked to the project (browser storage)`, await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(PK)})).projects[0].datasetIds.join() === 'demo-heat-spots'`));
      await open("/research/projects/P-browser-check", theme, w, h, { places: ["PRT"] });
      await waitFor(`!!document.querySelector('[data-project-dataset="demo-heat-spots"] a')`);
      await axe(`${L} project with a dataset`);
      await ev(`(() => { document.querySelector('[data-project-dataset="demo-heat-spots"] button').click(); return true; })()`);
      await waitFor(`!document.querySelector('[data-project-dataset="demo-heat-spots"]')`);
      check(
        `${L}: dataset removed; project and saved places otherwise unchanged`,
        await ev(`(() => { const p = JSON.parse(localStorage.getItem(${JSON.stringify(PK)})).projects[0]; return p.datasetIds.length === 0 && p.title === 'Dataset check' && localStorage.getItem('astera-watch-places') === '["PRT"]'; })()`),
      );
      await ev(`(() => { localStorage.removeItem(${JSON.stringify(PK)}); return true; })()`);
    });

    await step(`${L}: User Guide, How It Works, What's planned`, async () => {
      for (const [path, n] of [["/guide", "13-guide"], ["/how-it-works", "14-how-it-works"], ["/planned", "15-planned"]]) {
        await open(path, theme, w, h);
        await layout(`${L} ${path}`, w);
        await shot(`${theme}-${tag}-${n}`);
        await axe(`${L} ${path}`);
      }
    });

    await step(`${L}: Help (Guide and Ask Astera)`, async () => {
      await open("/", theme, w, h);
      await waitFor(MAP_IDLE);
      await ev(`(() => { document.querySelector('[data-help-trigger]').click(); return true; })()`);
      await waitFor(`!!document.getElementById('help-panel')`);
      await sleep(400);
      await shot(`${theme}-${tag}-16-help-guide`);
      await ev(`(() => { const t = [...document.querySelectorAll('#help-panel [role=tab]')].find(t => t.textContent.includes('Ask')); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); t.click(); t.focus(); return true; })()`);
      await sleep(400);
      const ask = await ev(`document.getElementById('help-panel').textContent`);
      check(`${L}: Ask Astera says 'Coming soon' and offers Guide answers, no question box`, ask.includes("Coming soon") && ask.includes("Is a possible fire a real wildfire?") && !(await ev(`!!document.querySelector('#help-panel textarea, #help-panel input[type=text]')`)));
      await shot(`${theme}-${tag}-17-help-ask`);
      await axe(`${L} Help open`);
    });
  }
}

// First visit: Light by default, even when the device prefers dark; the choice is remembered.
await step("first visit: Light by default", async () => {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${BASE}/planned` });
  await waitFor("document.readyState==='complete'");
  await ev(`(() => { localStorage.clear(); return true; })()`);
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor("!!document.querySelector('[data-page-heading]')");
  check("first visit with a dark device setting opens in Light", (await ev(`document.documentElement.dataset.theme`)) === "light");
  check("Light is the selected theme button", await ev(`document.querySelector('[aria-label="Light theme"]').getAttribute('aria-pressed') === 'true'`));
  await ev(`(() => { document.querySelector('[aria-label="Dark theme"]').click(); return true; })()`);
  await send("Page.navigate", { url: `${BASE}/history` });
  await waitFor("!!document.querySelector('[data-page-heading]')");
  check("a chosen Dark theme is remembered on the next page load", (await ev(`document.documentElement.dataset.theme`)) === "dark");
  await send("Emulation.setEmulatedMedia", { features: [] });
});

// Natural basemap: relief tiles load; heat spots and squares over forest, dry land and boreal terrain.
const TERRAIN = [
  ["SYN-01", "forest (Sierra Nevada, USA)"],
  ["SYN-02", "forest (Blue Mountains, Australia)"],
  ["SYN-04", "boreal (Alberta, Canada)"],
  ["SYN-05", "dry Mediterranean (Greece)"],
];
for (const theme of ["light", "dark"]) {
  await step(`${theme}: relief basemap`, async () => {
    await open("/", theme, 1440, 900);
    await waitFor(MAP_IDLE);
    const r = await ev(`(() => { const m = document.querySelector('[data-explorer-map]').__awMap; return { has: !!m.getSource('relief'), loaded: m.isSourceLoaded('relief'), layer: m.getLayer('relief')?.type, sat: m.getPaintProperty('relief', 'raster-saturation'), max: m.getPaintProperty('relief', 'raster-brightness-max') }; })()`);
    check(`${theme}: relief raster loaded`, r.has && r.loaded && r.layer === "raster", JSON.stringify(r));
    check(`${theme}: relief softened for the theme`, theme === "light" ? r.sat === -0.3 && r.max === 1 : r.sat === 0.4 && r.max === 0.42, JSON.stringify(r));
    await shot(`${theme}-desktop-20-world-relief`);
  });
  for (const [id, terrain] of TERRAIN) {
    await step(`${theme} ${id}: fire symbols over ${terrain}`, async () => {
      await open(`/?event=${id}`, theme, 1440, 900);
      await waitFor(MAP_IDLE);
      await sleep(1200);
      await ev(`(() => { const m = document.querySelector('[data-explorer-map]').__awMap; const c = m.getBounds().getCenter(); m.jumpTo({ zoom: 9.5 }); return true; })()`);
      await sleep(600);
      await waitFor(MAP_IDLE);
      await sleep(500);
      const r = await ev(`(() => { const m = document.querySelector('[data-explorer-map]').__awMap; return { pts: m.queryRenderedFeatures({ layers: ['detection-points'] }).length, casing: m.queryRenderedFeatures({ layers: ['detection-casing'] }).length, sq: m.queryRenderedFeatures({ layers: ['density-fill'] }).length }; })()`);
      check(`${theme} ${id}: heat spots drawn with their two rings over ${terrain}`, r.pts > 0 && r.casing === r.pts, JSON.stringify(r));
      await shot(`${theme}-desktop-21-terrain-${id}`);
    });
  }
}

// Keyboard: real Tab presses; every focused control must show a visible focus ring (desktop, both themes).
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
const tab = async () => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
};
for (const theme of ["light", "dark"]) {
  for (const path of ["/", "/events/SYN-01", "/places"]) {
    await step(`${theme} ${path}: focus indicators`, async () => {
      await open(path, theme, 1440, 900, { places: ["PRT"] });
      if (path === "/") await waitFor(MAP_IDLE);
      await sleep(600);
      const missing = [];
      let n = 0;
      for (let i = 0; i < 40; i++) {
        await tab();
        await sleep(40);
        const f = await ev(`(() => { const el = document.activeElement; if (!el || el === document.body) return null;
          const s = getComputedStyle(el); const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
          const shadow = s.boxShadow && s.boxShadow !== 'none';
          return { name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), ring: ring || shadow }; })()`);
        if (!f) continue;
        n++;
        if (!f.ring) missing.push(f.name);
      }
      check(`${theme} ${path}: every Tab stop shows a focus ring (${n} stops)`, missing.length === 0 && n > 10, missing.join(", "));
    });
  }
}

check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 5).join(" | ").slice(0, 600));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0); // closeBrowser() runs on exit
