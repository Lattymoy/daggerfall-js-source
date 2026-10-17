// PERF-NAMES1 bench (2026-10-10): THE NAME LAYER UNDER A CROWD, on the main thread's clock.
//
// PERF-ON4 measured the browser's own (native) time growing from 4.8 ms a frame alone to 18-20 with company and named
// the name layer's per-frame writes as the next measurement. This stands the REAL layer (ui/nameLayer.js
// createNameLayer) in headless Chromium with N peers milling about the screen - names, Renown, guild tags, a house line,
// a few bubbles - renders it once a frame for FRAMES frames, and reads Chromium's own counters over the run
// (Performance.getMetrics: the style recalcs, the layouts and the task time) and the frames' wall time.
//
// Usage: node tools/nameLayerBench.mjs [peers=60] [frames=300]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PEERS = Number(process.argv[2] || 60);
const FRAMES = Number(process.argv[3] || 300);
const PORT = Number(process.env.PORT || 5293);

const server = await createServer({ root: ROOT, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(`http://localhost:${PORT}/src/render/bounds.js`);
await page.evaluate(() => { document.documentElement.innerHTML = '<head></head><body style="margin:0;background:#334"></body>'; });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

await page.evaluate(async ({ PEERS, STATIC }) => {
  window.__staticScale = STATIC;
  const { createNameLayer } = await import('/src/ui/nameLayer.js');
  const layer = createNameLayer({ doc: document });
  const names = ['Ysolde', 'Brannoc', 'Kaelith Dawnmere', 'Vex', 'Orrin the Grey', 'Talmira', 'Gudrun', 'Sable'];
  const peers = Array.from({ length: PEERS }, (_, i) => ({
    id: `p${i}`, name: `${names[i % names.length]} ${i}`, lv: 1 + (i * 7) % 50, gt: i % 3 === 0 ? 'HND' : null,
    house: i % 4 === 0 ? { n: 'Ysolde', g: 2, h: 'Hlaalu' } : null,
    a: (i / PEERS) * Math.PI * 2, r: 120 + (i * 37) % 300, s: 0.4 + ((i * 13) % 10) / 10,
  }));
  for (let i = 0; i < Math.min(4, PEERS); i++) layer.say(`p${i}`, `hello there number ${i}, how goes the road?`);
  let t = 0;
  window.__step = () => {
    t += 1 / 60;
    const points = peers.map((p) => {
      const a = p.a + t * 0.3 * p.s;
      const depth = window.__staticScale ? 6 + 30 * (0.5 + 0.5 * Math.sin(p.a)) : 6 + 30 * (0.5 + 0.5 * Math.sin(t * 0.7 + p.a));
      return { id: p.id, name: p.name, lv: p.lv, gt: p.gt, house: p.house, x: 800 + Math.cos(a) * p.r * 1.6, y: 450 + Math.sin(a) * p.r * 0.6, scale: Math.max(0.55, Math.min(1.5, 18 / depth)), depth };
    });
    layer.render({ points, viewport: 900, hudScale: 1 });
  };
  window.__run = (frames) => new Promise((resolve) => {
    const times = [];
    let n = 0, last = performance.now();
    const tick = () => {
      const now = performance.now(); times.push(now - last); last = now;
      const s0 = performance.now(); window.__step(); window.__scriptMs = (window.__scriptMs ?? 0) + performance.now() - s0;
      if (++n < frames) requestAnimationFrame(tick); else resolve(times);
    };
    requestAnimationFrame(tick);
  });
}, { PEERS, STATIC: process.env.STATIC === '1' });
await page.evaluate(() => window.__run(30));   // warm
const m0 = await metrics();
await page.evaluate(() => { window.__scriptMs = 0; });
const times = await page.evaluate((f) => window.__run(f), FRAMES);
const m1 = await metrics();
const script = await page.evaluate(() => window.__scriptMs);
const d = (k) => ((m1[k] - m0[k]) * 1000 / FRAMES);
const sorted = times.slice(1).sort((a, b) => a - b);
console.log(`peers ${PEERS}  frames ${FRAMES}: per frame - layer JS ${(script / FRAMES).toFixed(3)} ms, recalc style ${d('RecalcStyleDuration').toFixed(3)} ms (${((m1.RecalcStyleCount - m0.RecalcStyleCount) / FRAMES).toFixed(2)}x), layout ${d('LayoutDuration').toFixed(3)} ms (${((m1.LayoutCount - m0.LayoutCount) / FRAMES).toFixed(2)}x), task ${d('TaskDuration').toFixed(3)} ms; frame interval p50 ${sorted[sorted.length >> 1].toFixed(1)} p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)}`);
if (errors.length) console.log('errors:', errors.join(' | '));
// the bench judges its run (test/tooling/probehygiene.test.js T3): a page that threw, or a layer that did no work, is no measure
if (errors.length || !(script > 0) || !Number.isFinite(d('TaskDuration'))) process.exitCode = 1;
await browser.close(); await server.close();
