// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures in the real game. The world boots in Daggerfall at
// noon, waits for the roofs to fill, and shoots round the town; then jumps to Solitude on Skyrim's coast and does the
// same. Each place prints who stands (the host's `__wildlife`, shot mode alone); frames are counted on `__frame`, never
// slept for. Exit 1 on a page error, or where a place stands no creature or no perch.
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 OUT=<dir> node tools/wildlifeProbe.mjs - and PORT=5186, TOD=12:00,
// WAIT_FRAMES=240, BOOT_MS=3600000, CHROMIUM=<a browser other than the pinned Playwright's>.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 5186), OUT = process.env.OUT ?? 'wildlife-probe', WAIT = Number(process.env.WAIT_FRAMES ?? 240);
mkdirSync(OUT, { recursive: true });
const deg = (d) => (d * Math.PI) / 180;

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(900000);
page.on('crash', () => { console.log('  the page crashed'); process.exit(3); });
await page.addInitScript(() => { try { const k = 'dagger.ui.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.tutorialPopups = false; localStorage.setItem(k, JSON.stringify(o)); } catch { /* none */ } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`); if (/^\[wildlife\]/.test(t)) console.log(`  console: ${t}`); });
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const frames = async (n) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((t) => window.__frame >= t, f0 + n, { timeout: 900000 }); };
const idle = async () => { await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000 }); await frames(2); };

/** Who stands: the host's counts, by state. */
const census = () => ev(() => {
  const h = window.__wildlife;
  if (!h) return null;
  const f = h.life.flight, g = h.life.ground, by = {};
  for (const b of f.birds) by[`${b.kind.name}:${b.state}`] = (by[`${b.kind.name}:${b.state}`] ?? 0) + 1;
  return { drawn: h.drawn, town: h.life.town, coast: h.life.coast, sites: f.sites.length, birds: by, flocks: f.flocks.map((q) => [q.kind.name, q.mode, q.members.length]),
    runners: g.runners.map((r) => r.kind.name), butterflies: g.butterflies.length, fireflies: g.fireflies.length, cast: h.cast };
});
const place = async (label) => {
  await frames(WAIT);
  const c = await census();
  console.log(JSON.stringify({ place: label, ...c }));
  for (const [yaw, pitch] of [[0, 12], [90, 12], [180, 12], [270, 12], [45, 35]]) {
    await ev(([y, p]) => window.__look(y, p), [deg(yaw), deg(pitch)]);
    await frames(3);
    await page.screenshot({ path: `${OUT}/${label}-${yaw}-${pitch}.png` });
  }
  return c;
};

const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/play/?world&shot&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=${process.env.TOD ?? '12:00'}&timescale=0&weather=sunny&skin=enhanced&touch=off`);
for (let i = 0; ; i++) {
  if (await ev(() => window.__shotReady === true).catch(() => false)) break;
  if (i % 12 === 0) console.log(`  boot ${((Date.now() - t0) / 1000).toFixed(0)} s frame ${await ev(() => window.__frame ?? null).catch(() => null)}`);
  if (Date.now() - t0 > Number(process.env.BOOT_MS ?? 3600000)) throw new Error('the boot never settled');
  await page.waitForTimeout(5000);   // before a frame exists to count
}
await idle();
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const bay = await place('daggerfall');
const at = await (async () => {
  for (let i = 0; i < 900; i++) {
    const p = await ev(async () => (await import('/src/world/tamrielCapitals.js')).capitalCentrePixel(1));
    if (p) return p;
    await frames(1);
  }
  return null;
})();
if (!at) throw new Error('Solitude never stood (no pixel)');
await ev(([x, y]) => { window.__tesaJump(x, y); }, [at.px, at.py]);
await frames(2);
await idle();
console.log(`jumped to Solitude's pixel ${at.px},${at.py} and idle at ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const skyrim = await place('solitude');
await browser.close();
await server.close();
for (const e of errors) console.log(`  error: ${e}`);
const bad = [['Daggerfall', bay], ['Solitude', skyrim]].filter(([, c]) => !c || !(c.drawn > 0) || !(c.sites > 0));
for (const [name] of bad) console.log(`  ${name}: no creature drawn, or no perch found`);
process.exit(errors.length || bad.length ? 1 : 0);
