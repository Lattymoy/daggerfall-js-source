// MID-RING / FAR-FIELD (2026-10-26, the owner: "expand the overworld view distance without killing performance. Currently
// tiles visibly load in with distance"; bible/06-Systems/Travel-View.md MID-RING): THE OVERWORLD'S HORIZON, LAYER BY LAYER,
// IN THE REAL GAME.
//
// The world host boots (Knightstale, Wayrest, at noon in the sun by default), the Overworld is raised, and the probe waits -
// frame-synced on the shot-mode `__frame` - until the horizon's layers stand (`__horizonRings`: the far ring, the middle
// ring and the far field, none still being laid), then photographs the view; then the same page again with the two layers'
// kill doors shut (`&midring=off&farfield=off`: the far ring alone past the streamed grid, as before), photographed the
// same way - the A/B in one tree. Screenshots go to SHOTS for the eye (renders of the player's data: never the repo).
//
// Run:  ARENA2_PATH=/home/claude/dfdata/arena2 SHOTS=<dir> node tools/horizonProbe.mjs
//   REGION=Wayrest LOC=Knightstale TOD=12:00  PORT=5182  W=960 H=540  LAND=5 (the streamed radius)  CHROMIUM=<browser>
//   HEAP_MB=<the page's old space, MB: a shared machine's memory>
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(join(A2, 'MAPS.BSA')))
  throw new Error('horizonProbe: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)');
const SHOTS = process.env.SHOTS;
if (!SHOTS) throw new Error('horizonProbe: SHOTS=<dir> names where the photographs go');
mkdirSync(SHOTS, { recursive: true });
const PORT = Number(process.env.PORT || 5182);
const W = Number(process.env.W || 960),
  H = Number(process.env.H || 540),
  LAND = Number(process.env.LAND || 5);
const REGION = process.env.REGION || 'Wayrest',
  LOC = process.env.LOC || 'Knightstale',
  TOD = process.env.TOD || '12:00';
const QUERY = `world&region=${encodeURIComponent(REGION)}&loc=${encodeURIComponent(LOC)}&class=1&novideo&shot&play&tod=${TOD}&weather=sunny&nofoes&skin=enhanced&touch=off`;

const server = await createServer({
  root: ROOT,
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    ...(process.env.HEAP_MB ? [`--js-flags=--max-old-space-size=${process.env.HEAP_MB}`] : []),
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
const results = [];
for (const [arm, doors] of [
  ['layers', ''],
  ['before', '&midring=off&farfield=off'],
]) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('crash', () => {
    console.error(`${arm}: the page crashed (out of memory on a shared box?)`);
    process.exit(3);
  });
  await page.addInitScript((land) => {
    try {
      const k = 'dagger.ui.v1',
        p = JSON.parse(localStorage.getItem(k) ?? '{}');
      localStorage.setItem(k, JSON.stringify({ ...p, landViewDistance: land }));
    } catch {
      /* the default */
    }
  }, LAND);
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/play/?${QUERY}${doors}`);
  await page.waitForFunction(() => window.__shotReady === true && !!window.__journeyState, null, {
    timeout: 2400000,
    polling: 2000,
  });
  const frame = () => page.evaluate(() => window.__frame);
  const frames = async (n) => {
    const f0 = await frame();
    await page.waitForFunction((f) => window.__frame >= f, f0 + n, { timeout: 900000, polling: 500 });
  };
  let view = null;
  for (let i = 0; i < 20 && view !== 'up'; i++) {
    await page.evaluate(() => {
      window.__arenaCloseOverlays?.();
      window.__overworld();
    });
    await frames(3);
    view = await page.evaluate(() => window.__journeyState().view);
  }
  if (view !== 'up') throw new Error(`horizonProbe: ${arm}: the Overworld did not rise (${view})`);
  // the layers standing (or, doors shut, the far ring alone), the stream settled, and the view's ease done
  let st = null;
  for (let i = 0; i < 400; i++) {
    st = await page.evaluate(() => ({ rings: window.__horizonRings?.() ?? null, j: window.__journeyState() }));
    const r = st.rings;
    const layers = doors ? !!r?.far : !!(r?.far && r?.mid && r?.field && !r.laying);
    if (layers && st.j.owed === 0 && i > 10) break;
    await frames(2);
  }
  await frames(10);
  const path = join(SHOTS, `horizon-${arm}.png`);
  await page.screenshot({ path });
  results.push({
    arm,
    boot: Math.round((Date.now() - t0) / 1000),
    rings: st?.rings,
    owed: st?.j.owed,
    errors: errors.length,
    path,
  });
  console.log(`${arm}: ${JSON.stringify(st?.rings)}; owed ${st?.j.owed}; ${errors.length} page error(s); ${path}`);
  await page.close();
}
await browser.close();
await server.close();
const on = results.find((r) => r.arm === 'layers'),
  off = results.find((r) => r.arm === 'before');
if (!(on?.rings?.mid && on?.rings?.field))
  throw new Error('horizonProbe: the middle ring and the far field never stood');
if (off?.rings?.mid || off?.rings?.field) throw new Error('horizonProbe: the kill doors left a layer standing');
if (results.some((r) => r.errors)) throw new Error('horizonProbe: page errors');
