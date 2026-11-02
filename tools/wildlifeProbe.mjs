// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures in the real game. Two ways in:
// - MODE=world (the default): the streamed world boots in Daggerfall at noon and shoots round the town, then jumps to
//   Solitude on Skyrim's coast and does the same. On SwiftShader a boot is most of an hour.
// - MODE=bench: the fixed city (`?exterior&play`) boots in about a minute; the player is set down in an open street
//   among the houses (found with the game's own collider) and the view turned up and round the roofs.
// Each place prints who stands (the host's `__wildlife`, shot mode alone) and the bodies' draws the renderer made (a
// spy on drawArraysInstanced: 39 vertices an instance). Frames are counted on `__frame`, never slept for. Exit 1 on a
// page error, or where a place stands no creature, no perch or no draw of them.
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 OUT=<dir> node tools/wildlifeProbe.mjs - and MODE=bench, PORT=5186,
// TOD=12:00, WAIT_FRAMES=150, BOOT_MS=3600000, CHROMIUM=<a browser other than the pinned Playwright's>.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 5186), OUT = process.env.OUT ?? 'wildlife-probe', WAIT = Number(process.env.WAIT_FRAMES ?? 150);
const BENCH = process.env.MODE === 'bench', TOD = process.env.TOD ?? '12:00';
mkdirSync(OUT, { recursive: true });

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(900000);
page.on('crash', () => { console.log('  the page crashed'); process.exit(3); });
await page.addInitScript(() => {
  try { const k = 'dagger.ui.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.tutorialPopups = false; localStorage.setItem(k, JSON.stringify(o)); } catch { /* none */ }
  // the bodies' draw (render/ambientLifePass.js AL_BODY_VERTS) counted as the renderer makes it
  const proto = WebGL2RenderingContext.prototype, draw = proto.drawArraysInstanced;
  window.__alDraws = { bodies: 0, instances: 0 };
  proto.drawArraysInstanced = function (mode, first, count, n) {
    if (count === 39) { window.__alDraws.bodies++; window.__alDraws.instances = n; }
    return draw.call(this, mode, first, count, n);
  };
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`); if (/^\[wildlife\]/.test(t)) console.log(`  console: ${t}`); });
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const frames = async (n) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((t) => window.__frame >= t, f0 + n, { timeout: 900000 }); };
const idle = async () => { await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000 }); await frames(2); };
const hold = async (key, n) => { await page.keyboard.down(key); await frames(n); await page.keyboard.up(key); };

/** Who stands: the host's counts, by state, and the draws so far. */
const census = () => ev(() => {
  const h = window.__wildlife;
  if (!h) return null;
  const f = h.life.flight, g = h.life.ground, by = {};
  for (const b of f.birds) by[`${b.kind.name}:${b.state}`] = (by[`${b.kind.name}:${b.state}`] ?? 0) + 1;
  return { drawn: h.drawn, town: h.life.town, coast: h.life.coast, sites: f.sites.length, birds: by, flocks: f.flocks.map((q) => [q.kind.name, q.mode, q.members.length]),
    runners: g.runners.map((r) => r.kind.name), butterflies: g.butterflies.length, fireflies: g.fireflies.length, cast: h.cast, draws: { ...window.__alDraws } };
});
/** A place: the creatures given WAIT frames to stand, then the census and a sweep of the view. */
const place = async (label, turn) => {
  await frames(WAIT);
  const c = await census();
  console.log(JSON.stringify({ place: label, ...c }));
  for (let k = 0; k < 6; k++) { await turn(k); await frames(3); await page.screenshot({ path: `${OUT}/${label}-${k}.png` }); }
  return c;
};

const t0 = Date.now();
const query = BENCH ? 'exterior&shot&play' : 'world&shot';
await page.goto(`http://localhost:${PORT}/play/?${query}&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=${TOD}&timescale=0&weather=sunny&skin=enhanced&touch=off`);
for (let i = 0; ; i++) {
  if (await ev(() => window.__shotReady === true).catch(() => false)) break;
  if (i % 12 === 0) console.log(`  boot ${((Date.now() - t0) / 1000).toFixed(0)} s frame ${await ev(() => window.__frame ?? null).catch(() => null)}`);
  if (Date.now() - t0 > Number(process.env.BOOT_MS ?? 3600000)) throw new Error('the boot never settled');
  await page.waitForTimeout(5000);   // before a frame exists to count
}
if (!BENCH) await idle();
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const places = [];
if (BENCH) {
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await frames(1); }   // a story's window pauses the game
  // an open street a few metres from the houses, nearest the town's middle - read off the game's own collider
  const spot = await ev(() => {
    const w = window.__wildlife.life.world, boxes = w.boxes();
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity], best = null;
    for (const b of boxes) { lo = [Math.min(lo[0], b.min[0]), Math.min(lo[1], b.min[2])]; hi = [Math.max(hi[0], b.max[0]), Math.max(hi[1], b.max[2])]; }
    const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    for (let x = mid[0] - 120; x <= mid[0] + 120; x += 4) {
      for (let z = mid[1] - 120; z <= mid[1] + 120; z += 4) {
        const g = w.ground(x, z), r = w.roof(x, z, 80);
        if (!Number.isFinite(g) || (Number.isFinite(r) && r > g + 0.3)) continue;
        let near = Infinity;
        for (const b of boxes) near = Math.min(near, Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2])));
        if (near > 7 && near < 14 && (!best || Math.hypot(x - mid[0], z - mid[1]) < Math.hypot(best[0] - mid[0], best[2] - mid[1]))) best = [x, g + 1, z];
      }
    }
    return best;
  });
  console.log(`set down at ${JSON.stringify(spot)}`);
  await ev((p) => window.__player.warp(p[0], p[1], p[2]), spot);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await frames(1); }
  places.push(['Daggerfall (the fixed city)', await place('bench', async (k) => { if (k === 0) await hold('Insert', 4); else await hold('ArrowLeft', 4); })]);
} else {
  const look = (yaw, pitch) => ev(([y, p]) => window.__look(y, p), [(yaw * Math.PI) / 180, (pitch * Math.PI) / 180]);
  const sweep = async (k) => look(k * 60, k === 5 ? 35 : 12);
  places.push(['Daggerfall', await place('daggerfall', sweep)]);
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
  places.push(['Solitude', await place('solitude', sweep)]);
}
await browser.close();
await server.close();
for (const e of errors) console.log(`  error: ${e}`);
const bad = places.filter(([, c]) => !c || !(c.drawn > 0) || !(c.sites > 0) || !(c.draws.bodies > 0));
for (const [name] of bad) console.log(`  ${name}: no creature drawn, no perch found, or no draw of them`);
process.exit(errors.length || bad.length ? 1 : 0);
