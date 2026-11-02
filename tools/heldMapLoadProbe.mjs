// MAP-WHOLE (2026-10-26, the owner: "The held map still struggles to load everything at once"; bible/03-World/
// Arena-Provinces.md MAP-WHOLE): THE HELD MAP'S TIME TO COMPLETE, BY ZOOM, IN THE REAL GAME.
//
// The world host boots in Daggerfall, the roads' forty-eight regions land (from the roads' cache after a first run - keep
// PROFILE between runs), the travel map (V) rises, and the sheet is set to a list of views - the whole continent, far over
// Skyrim, mid, near, and home - as a zoom or a pan sets them (the window's probe door, `__heldMapLoad`). After each, every
// frame is read (frame-synced on the shot-mode `__frame`): the window's paint, its milliseconds, and the past-the-Bay
// tiles' own count of what the frame showed - painted, stood in for by another level, and HOLES (a tile owed with nothing
// to show). A view is COMPLETE on the first frame nothing is owed. Then a wheel's zoom out and back in, a notch a frame
// (ZOOM_NOTCHES), timed the same way. Screenshots of the first frame after each set and of the complete sheet go to SHOTS
// for the eye (never into the repo: they are renders of the player's data).
//
// Run:  ARENA2_PATH=/home/claude/dfdata/arena2 PROFILE=<dir> node tools/heldMapLoadProbe.mjs
//   SHOTS=<dir>  (default: none taken)   OUT=<file> append the run's rows as one JSON line   TREE=<dir> another worktree
//   PORT=5182  W=1280 H=800  DPR=1  LAND=1 (the world's streamed radius)  CHROMIUM=<a browser other than the pinned Playwright's>
// The canvas is the CPU's (--disable-accelerated-2d-canvas, as tools/tesa15MapProbe.mjs: a headless software GPU runs an
// accelerated canvas ten times slower than a CPU's, and is no GPU's measure); the 3D world's draws are stubbed - the
// sheet is the subject. Figures are this shared machine's and only relative: compare like with like.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(join(A2, 'MAPS.BSA')))
  throw new Error('heldMapLoadProbe: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)');
const PORT = Number(process.env.PORT || 5182);
const W = Number(process.env.W || 1280),
  H = Number(process.env.H || 800),
  DPR = Number(process.env.DPR || 1);
const SHOTS = process.env.SHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PROFILE = process.env.PROFILE ?? mkdtempSync(join(tmpdir(), 'heldmapload-'));
const ZOOM_NOTCHES = 12;
const LAND = Number(process.env.LAND || 1);

const server = await createServer({
  root: ROOT,
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: W, height: H },
  deviceScaleFactor: DPR,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    ...(process.env.HEAP_MB ? [`--js-flags=--max-old-space-size=${process.env.HEAP_MB}`] : []),
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-accelerated-2d-canvas',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
const page = browser.pages()[0] ?? (await browser.newPage());
const errors = [],
  said = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('crash', () => {
  console.error('the page crashed (a renderer killed - out of memory on a shared box?): no measurement');
  process.exit(3);
});
page.on('console', (m) => {
  const t = m.text();
  if (/^\[roads\]/.test(t)) said.push(t);
  if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t))
    errors.push(`[console] ${t.slice(0, 300)}`);
});
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const t0 = Date.now();
await page.addInitScript((land) => {
  // the 3D world's draws stubbed from the first frame: the sheet is the subject
  // and the world streamed at LAND pixels a side (the Land view's own pref) - a page of the whole grid is 3.5 GB, more
  // than a shared box keeps for one probe; the sheet reads none of it
  try {
    const k = 'dagger.ui.v1',
      p = JSON.parse(localStorage.getItem(k) ?? '{}');
    localStorage.setItem(k, JSON.stringify({ ...p, landViewDistance: land }));
  } catch {
    /* the default */
  }
  if (typeof WebGL2RenderingContext === 'undefined') return;
  for (const f of [
    'drawArrays',
    'drawElements',
    'drawArraysInstanced',
    'drawElementsInstanced',
    'drawRangeElements',
    'clear',
    'blitFramebuffer',
  ])
    WebGL2RenderingContext.prototype[f] = function () {};
}, LAND);
await page.goto(
  `http://localhost:${PORT}/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12:00&skin=enhanced&touch=off&nofoes`,
);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
console.error(
  `  the world stands (${Math.round((Date.now() - t0) / 1000)} s), heap ${await ev(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576))} MB`,
);
for (let k = 0, until = Date.now() + 1800000; Date.now() < until && !said.some((t) => / all in /.test(t)); k++) {
  await page.waitForTimeout(1000);
  if (k % 30 === 29)
    console.error(
      `  ... ${said.filter((t) => /^\[roads\] region \(/.test(t)).length} region(s) landed, heap ${await ev(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576))} MB`,
    );
}
if (!said.some((t) => / all in /.test(t))) throw new Error("heldMapLoadProbe: the roads' regions never all landed");
const boot = Math.round((Date.now() - t0) / 1000);
const frame = () => ev(() => window.__frame);
const nextFrame = async (f0) => {
  await page.waitForFunction((f) => window.__frame > f, f0, { timeout: 600000, polling: 'raf' });
  return frame();
};
await ev(() => window.__arenaCloseOverlays?.());
await page.keyboard.press('KeyV');
for (let i = 0; i < 600; i++) {
  const s = await ev(() => window.__heldMapLoad?.state() ?? null);
  if (s?.phase === 'map') break;
  await nextFrame(await frame());
}
const risen = await ev(() => window.__heldMapLoad?.state() ?? null);
if (risen?.phase !== 'map') throw new Error(`heldMapLoadProbe: the travel map did not rise (${JSON.stringify(risen)})`);

/** Frames read until the sheet is complete (nothing owed, nothing dirty) or `max` frames pass. */
async function settle(name, max = 900) {
  const rows = [];
  const w0 = Date.now();
  let f = await frame(),
    shotFirst = !!SHOTS;
  for (let i = 0; i < max; i++) {
    f = await nextFrame(f);
    const s = await ev(() => window.__heldMapLoad.state());
    rows.push({ ms: Date.now() - w0, paintMs: s.paintMs, owed: s.owed, dirty: s.dirty, ...(s.tiles ?? {}) });
    if (shotFirst) {
      shotFirst = false;
      await page.screenshot({ path: join(SHOTS, `${name}-first.png`) });
    }
    if (!s.owed && !s.dirty && i > 1) break;
  }
  const done = rows.at(-1);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}-complete.png`) });
  return {
    name,
    frames: rows.length,
    ms: done.ms,
    complete: !done.owed && !done.dirty,
    worstPaintMs: Math.round(Math.max(...rows.map((r) => r.paintMs))),
    sumPaintMs: Math.round(rows.reduce((a, r) => a + r.paintMs, 0)),
    holesFirst: rows[0].holes ?? 0,
    holeFrames: rows.filter((r) => r.holes > 0).length,
    standFrames: rows.filter((r) => r.stood > 0).length,
    want: rows[0].want ?? 0,
  };
}
const results = [];
const home = risen.view;
const VIEWS = [
  ['continent', { ox: -1400, oy: -1500, scale: 0.12 }],
  ['far', { ox: 948, oy: -457, scale: 0.73 }],
  ['mid', { ox: 1433, oy: -351, scale: 3.29 }],
  ['near', { ox: 1500, oy: -300, scale: 6 }],
  ['home', home],
];
results.push(await settle('open'));
for (const [name, v] of VIEWS) {
  await ev((x) => window.__heldMapLoad.view(x), v);
  results.push(await settle(name));
}
// a wheel's zoom out from home to the continent and back in, a notch a frame (the window's own zoom: the scale moved by
// a factor about the paper's middle), then the sheet left to complete
for (const [dir, name] of [
  [1 / 1.35, 'zoom-out'],
  [1.35, 'zoom-in'],
]) {
  let f = await frame();
  const notchPaint = [];
  for (let k = 0; k < ZOOM_NOTCHES; k++) {
    await ev((d) => {
      const s = window.__heldMapLoad.state();
      window.__heldMapLoad.view({ ...s.view, scale: s.view.scale * d });
    }, dir);
    f = await nextFrame(f);
    const s = await ev(() => window.__heldMapLoad.state());
    notchPaint.push({ paintMs: s.paintMs, holes: s.tiles?.holes ?? 0 });
  }
  const r = await settle(name);
  results.push({
    ...r,
    notchWorstMs: Math.round(Math.max(...notchPaint.map((n) => n.paintMs))),
    notchHoleFrames: notchPaint.filter((n) => n.holes > 0).length,
  });
}
await page.keyboard.press('Escape');
console.log(`boot ${boot} s; ${W}x${H} at ${DPR} device pixels a point`);
for (const r of results)
  console.log(
    `${r.name.padEnd(10)} ${r.complete ? 'complete' : 'OWED    '} in ${String(r.ms).padStart(6)} ms over ${String(r.frames).padStart(3)} frames; paint worst ${String(r.worstPaintMs).padStart(5)} ms, sum ${String(r.sumPaintMs).padStart(6)}; holes ${r.holesFirst}/${r.want} on the first frame, ${r.holeFrames} frame(s) with one${r.notchWorstMs != null ? `; a notch's worst ${r.notchWorstMs} ms, ${r.notchHoleFrames} with a hole` : ''}`,
  );
if (process.env.OUT)
  appendFileSync(
    process.env.OUT,
    JSON.stringify({ at: new Date().toISOString(), tree: ROOT, W, H, DPR, results }) + '\n',
  );
await browser.close();
await server.close();
if (errors.length)
  throw new Error(`heldMapLoadProbe: ${errors.length} page error(s): ${errors.slice(0, 3).join(' | ')}`);
const owed = results.filter((r) => !r.complete).map((r) => r.name);
if (owed.length) throw new Error(`heldMapLoadProbe: never complete: ${owed.join(', ')}`);
