// SOLITUDE-RELIEF (bible/03-World/Arena-Provinces.md SOLITUDE-RELIEF) - SOLITUDE, SEEN in the real game: the world host
// boots, the land past the Bay lands, the probe jumps to Solitude's pixel (a fast travel's landing, `__tesaJump`), waits
// for the stream to go idle and stands the camera at each station - a point of the city's own metres (x east, z south of
// its anchor, world/tamrielCapitals.js SOLITUDE), a height over the sea, a yaw and a pitch - then takes the shot once the
// shot-mode `__frame` counter has moved (never a sleep). Headless runs on SwiftShader: its milliseconds are only relative.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 OUT=<dir> node tools/solitudeProbe.mjs
//   PORT=5182          the vite port
//   STATIONS=a,b       the stations to stand at (default: all)
//   REGION=, LOC=      where the boot stands before the jump (default Daggerfall; a farm boots in a fraction of it)
//   BOOT_MS=3600000    how long the boot may take
//   W=, H=             the viewport (default 1280 x 720)
//   CHROMIUM=<path>    a browser other than the pinned Playwright's
//   WALK=1             after the shots, walk the main gate's road to the docks and the gate to the palace (`__pose` in
//                      walk mode, the ground under each step read back) and print each step's height
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 5182);
const OUT = process.env.OUT ?? null;
if (OUT) mkdirSync(OUT, { recursive: true });
const deg = (d) => (d * Math.PI) / 180;
/** [label, x east, z south (the anchor's metres), eye over the sea (metres), yaw (degrees clockwise from north), pitch
 *  (degrees, negative down)] */
const STATIONS = [
  ['skyrim-view', 620, 760, 230, -40, -22],
  ['image-view', 560, -380, 150, -125, -16],   // the owner's picture's own view: the city left, the arch and the palace right
  ['arch-river', -95, 420, 9, -6, 9],
  ['arch-under', -60, 150, 4, -20, 22],
  ['docks-sea', 560, -330, 22, -120, -4],
  ['docks-quay', 260, -150, 4.2, 75, 6],
  ['docks-way', 120, -125, 34, 80, -8],
  ['terraces', 160, 300, 70, 0, -22],
  ['lane-stair', 318, 300, 49, 0, 4],
  ['gate-road', 330, 560, 'ground', 0, 4],
  ['gate-street', 318, 360, 'ground', 0, 1],
  ['avenues', 330, -30, 'ground', -90, 2],
  ['palace-court', 40, 0, 'ground', -90, 4],
  ['castle-dour', 250, 230, 'ground', 90, 6],
  ['arch-deck', -90, 0, 'ground', 90, -2],
  ['city-air', 200, 200, 620, 0, -88],
  ['west-bank', -380, 260, 70, 50, -8],
];
const want = process.env.STATIONS ? new Set(process.env.STATIONS.split(',')) : null;

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
page.setDefaultTimeout(900000);
page.on('crash', () => { console.log('  the page crashed'); process.exit(3); });
await page.addInitScript(() => { try { const k = 'dagger.ui.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.tutorialPopups = false; localStorage.setItem(k, JSON.stringify(o)); } catch { /* none */ } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`); if (/^\[(capitals|solitude)\]/.test(t)) console.log(`  console: ${t.slice(0, 200)}`); });
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const frames = async (n) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((t) => window.__frame >= t, f0 + n, { timeout: 900000 }); };
const idle = async () => { await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000 }); await frames(2); };

const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/play/?world&shot&region=${process.env.REGION ?? 'Daggerfall'}&loc=${encodeURIComponent(process.env.LOC ?? 'Daggerfall')}&class=1&novideo&tod=${process.env.TOD ?? '13:00'}&weather=${process.env.WEATHER ?? 'sunny'}&skin=enhanced&touch=off`);
for (let i = 0; ; i++) {
  const ready = await ev(() => window.__shotReady === true).catch(() => false);
  if (ready) break;
  if (i % 12 === 0) {
    const st = await ev(() => ({ frame: window.__frame ?? null, idle: window.__streamIdle?.() ?? null, built: window.__builtCount?.() ?? null, text: document.body?.innerText?.slice(0, 160) ?? '' })).catch((e) => ({ error: String(e?.message ?? e).slice(0, 120) }));
    console.log(`  boot ${((Date.now() - t0) / 1000).toFixed(0)} s ${JSON.stringify(st)}`);
    if (OUT && i % 24 === 0) await page.screenshot({ path: `${OUT}/boot-${i}.png` }).catch(() => null);
  }
  if (Date.now() - t0 > Number(process.env.BOOT_MS ?? 3600000)) throw new Error('the boot never settled');
  await page.waitForTimeout(5000);   // before a frame exists to count
}
const at = await (async () => {
  for (let i = 0; i < 900; i++) {
    const p = await ev(async () => (await import('/src/world/tamrielCapitals.js')).capitalCentrePixel(1));
    if (p) return p;
    await frames(1);
  }
  return null;
})();
if (!at) throw new Error('Solitude never stood (no pixel)');
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s; Solitude's pixel ${at.px},${at.py}`);
await ev(([x, y]) => { window.__tesaJump(x, y); }, [at.px, at.py]);
await frames(2);
await idle();
console.log(`jumped and idle at ${((Date.now() - t0) / 1000).toFixed(0)} s, pixel ${await ev(() => window.__currentPixel())}`);

// the scene's frame: the jump re-inits the stream on Solitude's pixel, its south-west corner the scene's origin, x east,
// z north; the anchor is the plan's grid point (2, 3) from its north-west corner
const [cx, cy] = (await ev(() => window.__currentPixel())).split(',').map(Number);
const A = await ev(async () => { const m = await import('/src/world/tamrielCapitals.js'); const c = m.CAPITALS[1]; return [c.anchor[0] * m.BLOCK_M, c.anchor[1] * m.BLOCK_M]; });
const scene = (x, z) => [(at.px - cx) * 819.2 + A[0] + x, -(at.py - cy) * 819.2 + 819.2 - A[1] - z];
const sea = await ev(() => window.__seaY?.() ?? null);
// the ground at a scene point: the player warped there (no frame drawn between) and the floor under its feet read back
// (`__standing`'s heightAt), the player put back where it stood
const ground = (sx, sz) => ev(([x, z]) => {
  const was = window.__player.pos;
  window.__player.warp(x, was[1], z);
  const g = JSON.parse(window.__standing()).ground;
  window.__player.warp(...was);
  return Number.isFinite(g) ? g : null;
}, [sx, sz]);
console.log(`the sea's scene height ${sea}`);
for (const [label, x, z, h, yaw, pitch] of STATIONS) {
  if (want && !want.has(label)) continue;
  const [sx, sz] = scene(x, z);
  const g = h === 'ground' ? await ground(sx, sz) : null;
  const y = h === 'ground' ? (g ?? sea ?? 0) + 1.7 : (sea ?? 0) + h;
  await ev(([x, y, z, yaw, pitch]) => window.__pose(x, y, z, yaw, pitch), [sx, y, sz, deg(yaw), deg(pitch)]);
  await frames(2);
  await idle();
  if (OUT) await page.screenshot({ path: `${OUT}/${label}.png` });
  console.log(JSON.stringify({ shot: label, at: [x, z], eye: +(y - (sea ?? 0)).toFixed(1), ground: g == null ? null : +(g - (sea ?? 0)).toFixed(1) }));
}
if (process.env.WALK) {
  // the heights along the city's ways: the docks to the gate by its road, the gate to the palace by the Avenues
  const WAYS = process.env.WAYS ? JSON.parse(process.env.WAYS) : [
    ['gate-road', [[204.8, 500], [230, 498], [300, 478], [380, 462], [440, 450], [468, 440], [450, 430], [380, 428], [330, 426], [318.4, 418]]],
    ['lane-to-castle', [[318, 410], [318, 300], [318, 240], [318, 225], [318, 214], [318, 205]]],
    ['well-to-avenues', [[150, 260], [150, 215], [150, 206], [150, 200], [150, 150], [150, 50]]],
    ['docks-way', [[250, -118], [160, -118], [90, -118], [70, -125], [90, -131], [200, -131], [300, -131], [390, -140], [300, -150]]],
  ];
  for (const [name, pts] of WAYS) {
    const out = [];
    for (const [x, z] of pts) { const [sx, sz] = scene(x, z); const g = await ground(sx, sz); out.push(g == null ? null : +(g - (sea ?? 0)).toFixed(1)); }
    console.log(JSON.stringify({ way: name, heights: out }));
  }
}
console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log(`  ${e.slice(0, 400)}`);
await browser.close();
await server.close();
