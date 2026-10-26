// IC-GRAND (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY, MEASURED AND SEEN in the real game:
// the world host boots in Daggerfall, the land past the Bay lands, the probe jumps to the city's centre pixel (a fast
// travel's landing, `__tesaJump`) and times the stream to idle, then stands the camera at each station - a point of the
// city's own metres (x east, z south of its middle, `polar` bearings for the districts) at a height, looking a way - waits
// for the stream again (the crossing's builds), samples the frame counter over frames the shot-mode `__frame` counter
// says were drawn (never a sleep), and takes the shot. Headless runs on SwiftShader: its milliseconds are only relative.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 node tools/imperialCityProbe.mjs
//   PORT=5181          the vite port
//   OUT=<dir>          where the shots go (none: no shots)
//   STATIONS=a,b       the stations to stand at (default: all)
//   FRAMES=6           frames sampled at each station
//   JSON=<file>        the rows appended as JSON lines
//   CHROMIUM=<path>    a browser other than the pinned Playwright's
//   RADIUS=n           the land view's distance (default: the game's own)
//   W=, H=             the viewport (default 1280 x 720)
//   REGION=, LOC=      where the boot stands before the jump (default Daggerfall)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, appendFileSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 5181);
const OUT = process.env.OUT ?? null;
const FRAMES = Math.max(2, Number(process.env.FRAMES ?? 6));
if (OUT) mkdirSync(OUT, { recursive: true });

/** The stations: [label, bearing (degrees clockwise from north) or null for the middle, metres out, eye height, yaw
 *  (radians; 0 north as the camera reads it), pitch (radians, negative down)] - filled from the city's own measures in
 *  the page when a bearing names a district (IMPERIAL_DISTRICT_AT). */
const STATIONS = [
  ['centre-street', null, 520, 2, 0, 0.05],
  ['centre-air', null, 0, 1400, 0, -1.2],
  ['market-street', 30, 0.55, 2, Math.PI, 0.02],
  ['market-air', 30, 0.55, 260, Math.PI, -0.9],
  ['arena-street', 90, 0.55, 2, -Math.PI / 2, 0.02],
  ['arena-air', 90, 0.55, 260, -Math.PI / 2, -0.9],
  ['arboretum-street', 150, 0.55, 2, 0, 0.02],
  ['arboretum-air', 150, 0.55, 260, 0, -0.9],
  ['temple-street', 210, 0.55, 2, 0, 0.02],
  ['temple-air', 210, 0.55, 260, 0, -0.9],
  ['talos-street', 270, 0.55, 2, Math.PI / 2, 0.02],
  ['talos-air', 270, 0.55, 260, Math.PI / 2, -0.9],
  ['elven-street', 330, 0.55, 2, Math.PI, 0.02],
  ['elven-air', 330, 0.55, 260, Math.PI, -0.9],
  ['waterfront-air', 180, 0.97, 300, 0, -0.7],
  ['city-air', null, 0, 6000, 0, -1.5],
  // IC-GRAND: on the roofs (the eye on the nearest building's roof - world/imperialFabric.js fabricPlotAt), and from the
  // city wall back to the tower (the far ring's impostor past the stream)
  ['market-roofs', 37.5, 3000, 'roof', Math.PI / 4, -0.12],
  ['temple-roofs', 217.5, 3000, 'roof', 0, -0.12],
  ['wall-tower', 30, 6870, 48, Math.PI * (210 / 180), 0.06],
];
const want = process.env.STATIONS ? new Set(process.env.STATIONS.split(',')) : null;

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
page.setDefaultTimeout(600000);   // a shot waits for a frame, and SwiftShader on a loaded machine draws one in seconds
// a renderer the machine's memory took (an OOM kill) answers no evaluate again - said, and the run ends
page.on('crash', () => { console.log('  the page crashed (its renderer gone - out of memory?)'); process.exit(3); });
// RADIUS=n: the land view's distance (world/landView.js - the Features row's pref), the same for a before and an after
// and the tutorial's popups off (systems/uiPrefs.js tutorialPopups) - a page over the shot is no view of the city
await page.addInitScript((r) => { try { const k = 'dagger.ui.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); if (r) o.landViewDistance = r; o.tutorialPopups = false; localStorage.setItem(k, JSON.stringify(o)); } catch { /* none */ } }, Number(process.env.RADIUS ?? 0));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`); if (/^\[(capitals|imperial)\]/.test(t)) console.log(`  console: ${t.slice(0, 200)}`); });
const ev = (fn, ...args) => page.evaluate(fn, ...args);
page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log(`  page: ${f.url().slice(0, 140)}`); });
/** Frames drawn: wait until the shot-mode counter has moved `n` past where it stands. */
const frames = async (n) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((t) => window.__frame >= t, f0 + n, { timeout: 600000 }); };
const idle = async () => { await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 900000 }); await frames(2); };
const heap = () => ev(() => (performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null));

const rows = [];
const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/play/?world&shot&region=${process.env.REGION ?? 'Daggerfall'}&loc=${encodeURIComponent(process.env.LOC ?? 'Daggerfall')}&class=1&novideo&tod=12:00&skin=enhanced&touch=off&fps`);
// the boot's wait, said as it goes: the frame counter, the stream and the pixels built
for (let i = 0; ; i++) {
  const s = await ev(() => ({ ready: window.__shotReady === true, frame: window.__frame ?? null, idle: window.__streamIdle?.() ?? null, built: window.__builtCount?.() ?? null, at: location.search.slice(0, 60) })).catch((e) => ({ ready: false, error: String(e?.message ?? e).slice(0, 160) }));
  if (s.ready) break;
  if (i % 6 === 0) console.log(`  boot ${((Date.now() - t0) / 1000).toFixed(0)} s: ${JSON.stringify(s)}`);
  if (Date.now() - t0 > 1800000) throw new Error('the boot never settled');
  await page.waitForTimeout(5000);   // the boot's own pace, before a frame exists to count - no frame is sampled here
}
const at = await (async () => {
  for (let i = 0; i < 600; i++) {
    const p = await ev(async () => { const m = await import('/src/world/tamrielCapitals.js'); return m.capitalCentrePixel(0); });
    if (p) return p;
    await frames(1);
  }
  return null;
})();
if (!at) throw new Error('the Imperial City never stood (no centre pixel)');
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s; the Imperial City's centre pixel ${at.px},${at.py}`);
await page.addStyleTag({ content: '#fps-counter { visibility: hidden !important; }' });   // its numbers read (__fpsStats), its card off the shots
// Daggerfall's own arena, as it stands, before the jump (window.__arena: the stage's centre, the scene's frame) - the eye
// north-west of it looking south-east (the camera's forward is (sin yaw, cos yaw) east and north)
const dfArena = await ev(() => window.__arena?.()?.centre ?? null);
if (dfArena && OUT && (!want || want.has('daggerfall-arena'))) {
  await ev(([x, y, z]) => window.__pose(x - 70, y + 55, z + 70, (3 * Math.PI) / 4, -0.55), dfArena);
  await frames(2);
  await idle();
  await page.screenshot({ path: `${OUT}/daggerfall-arena.png` });
  console.log(`daggerfall-arena at ${dfArena.map((v) => v.toFixed(0))}`);
}
const tj = Date.now();
await ev(([x, y]) => { window.__tesaJump(x, y); }, [at.px, at.py]);
await frames(2);
await idle();
const jumpMs = Date.now() - tj;
const span = await ev(async () => (await import('/src/world/imperialCity.js')).IMPERIAL_SPAN);
rows.push({ row: 'jump', span, jumpMs, built: await ev(() => window.__builtCount()), heapMB: await heap() });
console.log(JSON.stringify(rows.at(-1)));
// the scene's frame: the jump re-inits the stream on the centre pixel, its south-west corner the scene's origin; its middle
// the city's anchor (x east, z north in the scene - the city's z runs south)
const cur = await ev(() => window.__currentPixel());
const base = await ev(() => window.__cam());
const [cx, cy] = cur.split(',').map(Number);
const sceneOf = (ex, sz) => [(at.px - cx) * 819.2 + 409.6 + ex, -(at.py - cy) * 819.2 + 409.6 - sz];
const polar = (b, r) => [r * Math.sin((b * Math.PI) / 180), -r * Math.cos((b * Math.PI) / 180)];
const wall = await ev(async () => (await import('/src/world/imperialCity.js')).IMPERIAL.cityWall.r);
const palace = await ev(async () => (await import('/src/world/imperialCity.js')).IMPERIAL.palaceWall.r);
for (const [label, b, out, h, yaw, pitch] of STATIONS) {
  if (want && !want.has(label)) continue;
  // a district's station: `out` the share of the way from the palace wall to the city wall
  let [ex, sz] = b == null ? [0, out] : polar(b, out < 1.5 ? palace + (wall - palace) * out : out);
  let eye = h;
  if (h === 'roof') {   // IC-GRAND: the nearest building's roof about the point, the eye on it
    const roof = await ev(async ([x0, z0]) => {
      const f = await import('/src/world/imperialFabric.js').catch(() => null);   // none before IC-GRAND
      if (!f) return null;
      for (let d = 0; d < 200; d += 4) for (let a = 0; a < 8; a++) { const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d, p = f.fabricPlotAt(x, z); if (p && p.roof === 'flat') return [x, z, p.h]; }
      return null;
    }, [ex, sz]);
    if (roof) { [ex, sz] = roof; eye = roof[2] + 1.7; } else eye = 20;
  }
  const [x, z] = sceneOf(ex, sz);
  const ts = Date.now();
  await ev(([x, y, z, yaw, pitch]) => window.__pose(x, y, z, yaw, pitch), [x, base[1] + eye, z, yaw, pitch]);
  await frames(2);
  await idle();
  const settleMs = Date.now() - ts;
  const stats = [];
  for (let i = 0; i < FRAMES; i++) { await frames(1); const s = await ev(() => window.__fpsStats?.() ?? null); if (s) stats.push(s); }
  const mean = (k) => { const v = stats.map((s) => s[k]).filter((q) => q != null); return v.length ? +(v.reduce((a, c) => a + c, 0) / v.length).toFixed(1) : null; };
  const row = { row: label, settleMs, built: await ev(() => window.__builtCount()), frameMs: mean('meanMs'), scriptMs: mean('scriptMs'), draws: mean('draws'), heapMB: await heap() };
  rows.push(row);
  console.log(JSON.stringify(row));
  if (OUT) await page.screenshot({ path: `${OUT}/${label}.png` });
}
// IC-GRAND: the Imperial City's arena (Daggerfall's block in the Arena District) from over its gate, its slice built near
if (OUT && (!want || want.has('ic-arena'))) {
  const [ax, az] = await ev(async () => (await import('/src/world/imperialCity.js')).imperialArenaAt?.() ?? (await import('/src/world/imperialCity.js')).polar(90, 1390));   // before IC-GRAND: TS5's Colosseum at 1390 m east
  const [x, z] = sceneOf(ax, az);
  await ev(([x, y, z]) => window.__pose(x - 60, y + 50, z + 60, (3 * Math.PI) / 4, -0.55), [x, base[1], z]);
  await frames(2);
  await idle();
  const icArena = await ev(() => window.__arena?.()?.centre ?? null);
  console.log(`ic-arena stage ${icArena ? icArena.map((v) => v.toFixed(0)) : 'none'}`);
  if (icArena) { await ev(([x, y, z]) => window.__pose(x - 70, y + 55, z + 70, (3 * Math.PI) / 4, -0.55), icArena); await frames(2); await idle(); }
  await page.screenshot({ path: `${OUT}/ic-arena.png` });
}
if (process.env.JSON) appendFileSync(process.env.JSON, rows.map((r) => JSON.stringify({ at: new Date().toISOString(), ...r })).join('\n') + '\n');
console.log(errors.length ? `page errors:\n${errors.slice(0, 5).join('\n')}` : 'no page errors');
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
