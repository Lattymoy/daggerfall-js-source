// WG2 THE BUDGETS ("Browser budgets"): the streamed world past the Bay
// with a World 2.0 region and without - boot to a pixel of the Dragontails prototype, then the frames' script time and
// gaps over a window, the main thread's heap, and each of the 3 x 3 pixels' build time. `node tools/wg2Bench.mjs`
// (`AT=x,y`, `FRAMES=n`, `CHROMIUM=<browser>`). Judged: the region must stand in its arm and not in the other, every
// pixel must build.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { waitFrames, SWIFTSHADER_ARGS, editsPlugin, FRAME_PROBE_EDITS } from './frameProbe.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const PORT = Number(process.env.PORT || 5341);
const AT = (process.env.AT || '1100,430').split(',').map(Number);
const FRAMES = Number(process.env.FRAMES || 120);
const QUERY = 'world&shot&play&fps&region=Daggerfall&loc=Daggerfall&class=1&novideo&nofoes&tod=12:00&timescale=0&weather=sunny&season=summer&skin=enhanced&touch=off';

const die = (why) => { throw new Error(`wg2Bench: ${why}`); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

/** One arm: the world booted with or without the region, jumped to AT, measured. */
async function arm(browser, wg2) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const cdp = await page.context().newCDPSession(page);
  await page.addInitScript(() => {
    localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, tutorialPopups: false, survival: false }));
    localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
    const raf = window.requestAnimationFrame.bind(window), log = { on: false, cb: [], start: [] };
    window.__benchLog = log;
    window.requestAnimationFrame = (fn) => raf((t) => { const a = performance.now(); try { fn(t); } finally { if (log.on) { log.start.push(a); log.cb.push(performance.now() - a); } } });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/play/?${QUERY}${wg2 ? '&wg2=hammerfell-test' : ''}`);
  await page.waitForFunction(() => window.__shotReady === true && !!window.__journeyState, null, { timeout: 1800000, polling: 2000 });
  await page.evaluate(() => window.__arenaCloseOverlays?.());
  await page.waitForFunction(async () => !!(await import('/src/world/tamriel/tamrielLand.js')).tamrielTrace(), null, { timeout: 600000, polling: 2000 });
  const regions = await page.evaluate(async () => (await import('/src/world/gen2/gen2Ground.js')).gen2Regions().map((r) => r.id));
  if (wg2 && !regions.includes('hammerfell-test')) die(`the region did not stand (regions: ${regions.join(', ') || 'none'})`);
  if (!wg2 && regions.length) die(`a region stood without the flag: ${regions.join(', ')}`);
  await page.evaluate(([x, y]) => { window.__tesaJump(x, y); }, AT);
  await waitFrames(page, 2);
  await page.waitForFunction((at) => window.__streamIdle?.() === true && window.__currentPixel?.() === at && window.__journeyState().owed === 0 && window.__journeyState().failed === 0, `${AT[0]},${AT[1]}`, { timeout: 1800000, polling: 1000 });
  await waitFrames(page, 10);
  await page.evaluate(() => { window.__benchLog.on = true; });
  await waitFrames(page, FRAMES);
  const log = await page.evaluate(() => { const l = window.__benchLog; l.on = false; return { cb: l.cb, start: l.start }; });
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  // each pixel of the 3 x 3 about AT built alone, the frame held (pixelBuild's own clock)
  const builds = await page.evaluate(async ([x, y]) => {
    const { holdFrame } = await import('/src/scenes/shared.js');
    const out = [], release = holdFrame();
    try { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const r = await window.__pixelBuild(x + i, y + j, { again: true }); out.push({ at: `${x + i},${y + j}`, ms: r?.ms, error: r?.error ?? null }); } } finally { release(); }
    return out;
  }, AT);
  await page.close();
  const gaps = log.start.slice(1).map((t, i) => t - log.start[i]);
  if (builds.some((b) => b.error || !(b.ms >= 0))) die(`a pixel failed to build: ${JSON.stringify(builds.filter((b) => b.error || !(b.ms >= 0)))}`);
  return { wg2, frames: log.cb.length, scriptMean: log.cb.reduce((a, v) => a + v, 0) / Math.max(1, log.cb.length), scriptP95: pct(log.cb, 0.95), gapMean: gaps.reduce((a, v) => a + v, 0) / Math.max(1, gaps.length), gapP95: pct(gaps, 0.95), heapMB: heap.usedSize / 1048576, buildMean: builds.reduce((a, b) => a + b.ms, 0) / builds.length, buildMax: Math.max(...builds.map((b) => b.ms)), errors };
}

export async function bench() {
  const server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, plugins: [editsPlugin('wg2-bench', FRAME_PROBE_EDITS)], server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
  const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: [...SWIFTSHADER_ARGS, '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  try { return [await arm(browser, false), await arm(browser, true)]; } finally { await browser.close(); await server.close(); }
}

if (isMain(import.meta.url)) {
  const rows = await bench();
  console.table(rows.map(({ errors, ...r }) => ({ ...r, errors: errors.length })));
  if (rows.some((r) => r.frames < FRAMES / 2)) die('too few frames measured');
}
