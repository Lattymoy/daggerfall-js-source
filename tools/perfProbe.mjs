// PERF9 - THE PERFORMANCE PROBE (2026-09-11). Every PERF slice so far was
// read out of the frame, not measured: this session has no GPU and no
// ARENA2. This boots the real game on a machine that has both and logs
// the FPS counter's own numbers - frames a second, frame ms and worst,
// script ms and worst, draws and texture binds a frame - for three
// scenes: a city (Daggerfall), the open road (a random spawn) and a
// dungeon (Privateer's Hold, the ?shot boot). Run it before and after
// a change and the difference is the change.
//
// Run:  ARENA2_PATH=/path/to/arena2 npm run perf
//   HEADED=1      a visible browser on the machine's own GPU - the
//                 number that matters. Headless runs on SwiftShader
//                 (software GL) and its numbers are only relative.
//   SECONDS=8     how long each scene is sampled after it settles
//   SCENES=city,road,dungeon   which to run
//   OUT=perf.json where to append the rows (default: print only)
//
// The scene is settled when the world says so (`window.__shotReady`:
// the stream queue empty, nothing building); the probe then discards
// the first second and takes the mean of the rest.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { appendFileSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5237);
const SECONDS = Math.max(3, Number(process.env.SECONDS || 8));
const HEADED = process.env.HEADED === '1';
const WANT = (process.env.SCENES || 'city,road,dungeon').split(',').map((s) => s.trim()).filter(Boolean);

const SCENES = {
  city: `/play/?world&region=Daggerfall&loc=Daggerfall&class=1&novideo&shot&fps`,
  road: `/play/?world&spawn=random&class=1&novideo&shot&fps`,
  dungeon: `/play/?shot&class=0&fps`,
};

const server = await createServer({ root: ROOT, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(HEADED
  ? { headless: false }
  : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const rows = [];
for (const name of WANT) {
  const url = SCENES[name];
  if (!url) { console.warn(`perf: no scene "${name}"`); continue; }
  await page.goto(`http://localhost:${PORT}${url}`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 300000 });
  await page.waitForTimeout(1000);   // the first second after settling is the stream's tail, not the scene
  const samples = [];
  for (let s = 0; s < SECONDS; s++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => (window.__fpsStats ? window.__fpsStats() : null));
    if (st) samples.push(st);
  }
  const mean = (k) => { const v = samples.map((s) => s[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const worst = (k) => { const v = samples.map((s) => s[k]).filter((x) => x != null); return v.length ? Math.max(...v) : null; };
  const row = {
    scene: name, gpu: HEADED ? 'machine' : 'swiftshader', seconds: samples.length,
    fps: mean('fps'), frameMs: mean('meanMs'), frameWorstMs: worst('worstMs'),
    scriptMs: mean('scriptMs'), scriptWorstMs: worst('scriptWorstMs'),
    draws: mean('draws'), binds: mean('binds'),
    errors: errors.splice(0).length,
  };
  rows.push(row);
  const f = (x, d = 1) => (x == null ? '-' : Number(x).toFixed(d));
  console.log(`${name.padEnd(8)} ${f(row.fps, 0).padStart(4)} fps  frame ${f(row.frameMs)} ms (worst ${f(row.frameWorstMs, 0)})  script ${f(row.scriptMs)} ms (worst ${f(row.scriptWorstMs, 0)})  draws ${f(row.draws, 0)}  binds ${f(row.binds, 0)}${row.errors ? `  errors ${row.errors}` : ''}`);
}
if (process.env.OUT) appendFileSync(process.env.OUT, rows.map((r) => JSON.stringify({ at: new Date().toISOString(), ...r })).join('\n') + '\n');
await browser.close();
await server.close();
// The judgement: a scene that never reported a second, or threw on
// the page, is not a measurement - a probe that prints a dash and
// exits 0 is the disease test/probehygiene.test.js T3 names.
const bad = rows.filter((r) => !r.seconds || r.errors || !(r.fps > 0)).map((r) => r.scene);
if (bad.length || rows.length !== WANT.length) throw new Error(`perf: no measurement for ${bad.join(', ') || 'a scene'}`);
