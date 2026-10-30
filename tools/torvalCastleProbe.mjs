// FIELD BUGS 2026-10-30b (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 6) - TORVAL'S CASTLE, SEEN in the real
// game: the world host boots, jumps to the capital's pixel (`__tesaJump`), walks in through the palace's dungeon door,
// shoots the halls and reads the exits, then leaves by the first exit and reads where the way out landed (feet against
// the ground). Frame-synced on the shot-mode `__frame` counter, but for one wait before the first frame exists.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 OUT=<dir> node tools/torvalCastleProbe.mjs
//   CAPITAL=5          the capital (world/tamrielCapitals.js CAPITALS: 5 Torval, 1 Solitude, ...)
//   PORT=5183          the vite port
//   BOOT_MS=3600000    how long the boot may take
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'torval-shots';
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.PORT ?? 5183), K = Number(process.env.CAPITAL ?? 5);
const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
await page.addInitScript(() => { try { const k = 'dagger.ui.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.tutorialPopups = false; localStorage.setItem(k, JSON.stringify(o)); } catch { /* none */ } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`); });
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const frames = async (n) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((t) => window.__frame >= t, f0 + n, { timeout: 900000 }); };
const idle = async () => { await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000 }); await frames(2); };
const shot = async (name) => { await frames(2); await page.screenshot({ path: `${OUT}/${name}` }).catch((e) => console.log(`(shot ${name}: ${e.message.split('\n')[0]})`)); };
const untilMode = async (want, ms = 600000) => {
  for (const until = Date.now() + ms; Date.now() < until;) { if ((await ev(() => window.__mode?.())) === want) return true; await frames(1); }
  return false;
};

const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=13:00&weather=sunny`);
for (let i = 0; ; i++) {   // castleProbe.mjs's readiness: a mode and an idle stream (`&play` sets no __shotReady)
  if (await ev(() => !!window.__mode?.() && window.__streamIdle?.() === true).catch(() => false)) break;
  if (Date.now() - t0 > Number(process.env.BOOT_MS ?? 3600000)) throw new Error('the boot never settled');
  if (i % 60 === 0) await page.screenshot({ path: `${OUT}/boot-${i}.png` }).catch(() => null);
  await page.waitForTimeout(5000);   // before a frame exists to count
}
let at = null;
for (let i = 0; i < 900 && !at; i++) { at = await ev(async (k) => (await import('/src/world/tamrielCapitals.js')).capitalCentrePixel(k), K); if (!at) await frames(1); }
if (!at) throw new Error('the capital never stood');
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s; capital ${K} at ${at.px},${at.py}`);
await ev(([x, y]) => { window.__tesaJump(x, y); }, [at.px, at.py]);
await frames(2);
await idle();
console.log(`jumped and idle at ${((Date.now() - t0) / 1000).toFixed(0)} s, pixel ${await ev(() => window.__currentPixel())}`);
const entrances = (await ev(() => window.__doors())).filter((d) => d.type === 2);
console.log(`dungeon entrance doors: ${JSON.stringify(entrances)}`);
const d = entrances[0];
if (!d) throw new Error('no dungeon door stands');
const stand = [d.pos[0] + d.normal[0] * 1.0, d.pos[1], d.pos[2] + d.normal[2] * 1.0];
await ev(([p, y]) => window.__warpTo(p, y), [stand, Math.atan2(-d.normal[0], -d.normal[2])]);
await frames(3);
console.log(`at the door: ${await ev(() => window.__standing())}`);
await shot('1-door.png');
console.log(`__enter -> ${await ev(() => window.__enter())}`);
if (!(await untilMode('dungeon'))) throw new Error('the castle never opened');
await frames(10);
await shot('2-inside.png');
const probe = JSON.parse(await ev(() => window.__dungeonProbe()));
console.log(`inside: ${JSON.stringify({ feet: probe.feet, wall: probe.wall, exits: probe.exits, start: probe.startMarker, inCastle: probe.inCastle, key: probe.locationKey, hud: probe.hud })}`);
if (!probe.exits?.length) throw new Error('no way out stands');
for (const [i, ex] of probe.exits.entries()) {
  const st = [ex.pos[0] + ex.normal[0] * 0.8, ex.pos[1] - 0.5, ex.pos[2] + ex.normal[2] * 0.8];
  await ev(([p, y]) => window.__warpTo(p, y), [st, Math.atan2(-ex.normal[0], -ex.normal[2])]);
  await frames(3);
  await shot(`3-exit${i}.png`);
  const before = JSON.parse(await ev(() => window.__dungeonProbe()));
  console.log(`exit ${i}: pick ${before.pick?.key} feet ${JSON.stringify(before.feet)}`);
}
console.log(`__dungeonExit -> ${await ev(() => window.__dungeonExit())}`);
if (!(await untilMode('exterior'))) throw new Error('the way out never landed');
await frames(1);
const landed = JSON.parse(await ev(() => window.__standing()));
await shot('4-out.png');
await frames(30);
const later = JSON.parse(await ev(() => window.__standing()));
await shot('5-out-later.png');
console.log(`landed ${JSON.stringify(landed)}, a second later ${JSON.stringify(later)}, door ${JSON.stringify(d.pos)}`);
if (landed.y - later.y > 0.5) throw new Error(`TALL-DOOR: the way out stood the feet ${(landed.y - later.y).toFixed(2)} m over the ground`);
if (errors.length) throw new Error(`page errors: ${errors.slice(0, 5).join(' | ')}`);
console.log('zero page errors');
await browser.close();
await server.close();
