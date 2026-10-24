// TESA13 (bible/03-World/Arena-Provinces.md TESA13) - THE LAND PAST THE BAY ON THE HELD MAP, in the real game: the world
// host on the enhanced skin, the trace and Arena's roads landed, the countryside and the lairs read through the host's
// atlas (window.__tesaAtlas), and the travel map (V) opened and panned north past the Bay - photographed in to the Bay's
// scale and out on the continent.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 node tools/tesa13MapProbe.mjs   (SHOTS=dir, default tesa13-shots; CHROMIUM=path
// for a browser other than the pinned Playwright's)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS ?? 'tesa13-shots';
mkdirSync(SHOTS, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({ root: process.cwd(), server: { port: 5243, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const said = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (/^\[(tamriel|places|arena)\]/.test(t)) { said.push(t); console.log(`  console: ${t.slice(0, 220)}`); }
  if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`);
});
let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; return !!ok; };
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const shot = async (name) => { try { await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 120000 }); console.log(`  shot ${SHOTS}/${name}`); } catch (e) { console.log(`(screenshot ${name} skipped: ${e.message.split('\n')[0]})`); } };

await page.goto('http://localhost:5243/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12:00&skin=enhanced&touch=off');
let mode = null;
for (const until = Date.now() + 300000; Date.now() < until;) {
  mode = await ev(() => (window.__mode ? window.__mode() : null));
  const idle = await ev(() => (window.__streamIdle ? window.__streamIdle() : false));
  if (mode && idle) break;
  await page.waitForTimeout(1000);
}
check(mode === 'exterior', `booted in Daggerfall (mode ${mode})`);
for (const until = Date.now() + 240000; Date.now() < until && !said.some((t) => /the roads past the Bay landed/.test(t));) await page.waitForTimeout(1000);
check(said.some((t) => /the picture traced/.test(t)), 'the picture traced');
check(said.some((t) => /the roads past the Bay landed/.test(t)), 'Arena\'s roads landed');

const ink = await ev(async () => { const m = await import('/src/ui/tamrielInk.js'); const k = m.tamrielInkFor(null); return { roads: k.roads.length, tracks: k.tracks.length, cities: k.cities.length }; });
check(ink.roads > 0 && ink.tracks > 0, `the ink holds the roads past the Bay (${ink.roads} road chains, ${ink.tracks} track chains, ${ink.cities} cities)`);
const atlas = await ev(() => { const t0 = performance.now(); const a = window.__tesaAtlas(0, -420, 520, -20); const ms = performance.now() - t0; const t1 = performance.now(); window.__tesaAtlas(0, -420, 520, -20); return { n: a?.length ?? null, ms, again: performance.now() - t1, kinds: a ? Object.entries(a.reduce((o, p) => ((o[p.type] = (o[p.type] ?? 0) + 1), o), {})) : null, first: a?.slice(0, 3) ?? null }; });
check(atlas.n > 0, `the atlas holds the countryside and the lairs north of the Bay (${atlas.n} places over 520 x 400 pixels; first read ${atlas.ms.toFixed(0)} ms, again ${atlas.again.toFixed(1)} ms; by type ${JSON.stringify(atlas.kinds)}; ${JSON.stringify(atlas.first)})`);

for (let i = 0; i < 60; i++) {   // the headless start's tutorial (a Yes/No: No ends it) and the main quest's opening box
  const t = JSON.parse(await ev(() => window.__talk()));
  if (!t.overlay) break;
  await page.keyboard.press(/tutorial/i.test(t.overlayBox ?? '') ? 'KeyN' : 'Space');
  await page.waitForTimeout(300);
}
const state = async () => { const s = await ev(() => (globalThis.__heldMap ? globalThis.__heldMap() : null)); return s ? JSON.parse(s) : null; };
await page.keyboard.press('KeyV');
let st = null;
for (let i = 0; i < 20 && !st; i++) { await page.waitForTimeout(500); st = await state(); }
check(!!st, `the travel map opened (view ${JSON.stringify(st?.view)}, band ${st?.band})`);
if (st) {
  await page.waitForTimeout(2500);
  for (let i = 0; i < 30 && st.view.scale < 3; i++) { await page.keyboard.press('Equal'); await page.waitForTimeout(150); st = await state(); }
  // drags pan the sheet (the stage owns the pointer) until its middle is on High Rock's land north of the Bay
  const [TX, TY] = [600, -120];
  const mid = (v) => [v.view.ox + v.paper.w / v.view.scale / 2, v.view.oy + v.paper.h / v.view.scale / 2];
  for (let i = 0; i < 40; i++) {
    const [cx, cy] = mid(st);
    if (Math.abs(cx - TX) < 15 && Math.abs(cy - TY) < 15) break;
    const dx = Math.max(-300, Math.min(300, (cx - TX) * st.view.scale)), dy = Math.max(-300, Math.min(300, (cy - TY) * st.view.scale));
    await page.mouse.move(640, 400); await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(640 + (dx * k) / 6, 400 + (dy * k) / 6);
    await page.mouse.up(); await page.waitForTimeout(300); st = await state();
  }
  st = await state();
  console.log(`  in: view ${JSON.stringify(st.view)}, band ${st.band}, paper ${JSON.stringify(st.paper)}, middle ${mid(st).map(Math.round)}`);
  check(st.view.oy < -100 && st.band !== 'far', 'panned north past the Bay, in to the Bay\'s scale');
  // the marks filling in as the map rolls the view a frame's budget at a time: the atlas's kept places, asked with no
  // budget to spend, until they stop coming (a software GPU's frames are slow; the frame count says how many it took)
  const rect = [Math.floor(st.view.ox), Math.floor(st.view.oy), Math.ceil(st.view.ox + st.paper.w / st.view.scale), Math.ceil(st.view.oy + st.paper.h / st.view.scale)];
  const kept = () => ev((r) => window.__tesaAtlas(...r, 0)?.length ?? null, rect);
  const frame0 = await ev(() => window.__frame ?? null), t0 = Date.now();
  let n = await kept(), still = 0;
  while (still < 6 && Date.now() - t0 < 240000) { await page.waitForTimeout(1000); const m = await kept(); still = m === n ? still + 1 : 0; n = m; }
  const frames = (await ev(() => window.__frame ?? null)) - frame0;
  const whole = await ev((r) => { const t = performance.now(); const a = window.__tesaAtlas(...r); return { n: a?.length ?? null, ms: performance.now() - t }; }, rect);
  check(whole.n > 0 && n === whole.n, `the view's countryside and lairs filled in by the map (${n} of ${whole.n} over ${rect[2] - rect[0]} x ${rect[3] - rect[1]} pixels, in ${((Date.now() - t0) / 1000 - 6).toFixed(0)} s and ${frames} frames; ${whole.ms.toFixed(0)} ms left to roll)`);
  await page.waitForTimeout(3000);
  await shot('1-high-rock-north-of-the-bay.png');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Minus'); await page.waitForTimeout(200); }
  await page.waitForTimeout(2500);
  st = await state();
  console.log(`  out: view ${JSON.stringify(st.view)}, band ${st.band}`);
  await shot('2-the-continent.png');
  await page.keyboard.press('Escape');
}
check(errors.length === 0, errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'zero page errors');
await browser.close();
await server.close();
console.log(fails === 0 ? 'TESA13 MAP PROBE: ALL GREEN' : `TESA13 MAP PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
