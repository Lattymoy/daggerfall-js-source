#!/usr/bin/env node
// AURUM-CACHES PROBE (2026-10-30, bible/06-Systems/Aurum.md section 3a): today's Aurum coffer in a Bay dungeon that holds
// one, on the real game files through the real renderer - shut, near and far; then opened (the service's yes answered at
// the network) - in each lighting lane. Frame-synced on the shot mode's __frame, never slept. Gated on the game data:
//
//   ARENA2_PATH=/path/to/arena2 node tools/aurumCacheProbe.mjs [outDir] [region]     (CHROMIUM=<a chrome> for another browser)
//
// The coffer stood in the page is the host's own (scenes/aurumCacheHost.js aurumCacheStood); its spot is checked against
// the law's, read here off the same files.
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { layoutDungeon } from '../src/world/dungeon/dungeonLayout.js';
import { floorLanding } from '../src/player/enterExit.js';
import { RANDOM_TREASURE_MARKER_RECORD } from '../src/systems/loot/loot.js';
import { aurumCachePlaceOf, aurumCacheFoot, AURUM_CACHE_KEY } from '../src/scenes/aurumCacheHost.js';
import { aurumCacheDayOf, aurumCacheHolds, aurumCacheId, aurumCacheSpotOf } from '../src/net/aurumCacheLaw.js';
import { hostFireCollider, hostModelReader } from './dungeonFireProbe.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ARENA2 = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
const outDir = process.argv[2] || 'tmp-shots';
const region = process.argv[3] || 'Daggerfall';
mkdirSync(outDir, { recursive: true });
const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));

// the law's coffer, off the files: the smallest dungeon of the region that holds one today, and its longest clear way out
const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
const getModel = hostModelReader(arch);
const day = aurumCacheDayOf(Date.now() / 1000);
let pick = null;
for (let r = 0; r < 62 && !pick; r++) {
  if (!maps.getRegion(r) || maps.getRegionName(r) !== region) continue;
  const found = [];
  for (let i = 0; i < maps.baseLocationCount(r); i++) {
    const loc = maps.getLocation(r, i), place = loc?.hasDungeon ? aurumCachePlaceOf(loc) : null;
    if (place && aurumCacheHolds(day, place)) found.push(loc);
  }
  for (const loc of found.sort((a, b) => a.dungeon.blocks.length - b.dungeon.blocks.length)) {
    const d = layoutDungeon(loc, blocks, getModel), col = hostFireCollider(d.blocks, getModel), piles = [];
    for (const b of d.blocks) for (const m of b.layout.markers) if (!m.archive && m.record === RANDOM_TREASURE_MARKER_RECORD) piles.push({ pos: floorLanding(col, [m.x + b.originX, m.y + 0.2, m.z + b.originZ]) });
    const id = aurumCacheId(day, aurumCachePlaceOf(loc)), foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), col);
    if (!foot) continue;
    // the longest way out from the coffer through every bucket (a shut door is a wall to a camera), never back over its pile
    const pile = piles.reduce((n, p) => (Math.hypot(p.pos[0] - foot[0], p.pos[2] - foot[2]) < Math.hypot(n.pos[0] - foot[0], n.pos[2] - foot[2]) ? p : n));
    const toPile = Math.atan2(pile.pos[0] - foot[0], pile.pos[2] - foot[2]);
    let way = null;
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8, off = Math.abs(Math.atan2(Math.sin(a - toPile), Math.cos(a - toPile)));
      if (off < Math.PI / 2.5) continue;
      const free = col.raycast([foot[0], foot[1] + 1.3, foot[2]], [Math.sin(a), 0, Math.cos(a)], 12);
      const f = Number.isFinite(free) ? free : 12;
      if (!way || f > way.free) way = { a, free: f };
    }
    if (way.free >= 4) { pick = { loc, id, foot, way }; break; }
  }
}
if (!pick) throw new Error(`no dungeon of ${region} holds a cache today with room to look at it`);
console.log(`[probe] ${pick.loc.name} (${region}) - ${pick.id}, the coffer at ${pick.foot.map((v) => v.toFixed(2))}, ${pick.way.free.toFixed(1)} m clear`);

const server = await createServer({ server: { port: 5197, strictPort: true, watch: { ignored: ['**/tmp-shots/**', '**/node_modules/**'] } }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const failures = [];
/** An eye `dist` metres out along the clear way, `up` over the coffer's foot, looking back at `aim` metres over its foot
 *  (above the coffer, so no plaque stands over it; at its middle, for the plaque and the press). */
const eyeAt = (dist, up, aim) => {
  const { a } = pick.way, f = pick.foot, eye = [f[0] + Math.sin(a) * dist, f[1] + up, f[2] + Math.cos(a) * dist];
  return { eye, yaw: Math.atan2(f[0] - eye[0], f[2] - eye[2]), pitch: Math.atan2(f[1] + aim - eye[1], dist) };
};
try {
  for (const lane of ['', 'classic']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
    // a signed-in account (the coffer stands for one alone), and the tutorial's popups off - a page over the shot hides it
    await page.addInitScript(() => {
      localStorage.setItem('dagger.account.session', JSON.stringify({ secret: 'probe', id: 'probe-account', kind: 'user', name: 'Probe' }));
      localStorage.setItem('dagger.ui.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('dagger.ui.v1') || '{}'), tutorialPopups: false }));
    });
    await page.route('**/v1/aurum/cache', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, id: pick.id, aurum: 15, today: 1, max: 3 }) }));
    const q = `shot&online&region=${encodeURIComponent(region)}&dungeon=${encodeURIComponent(pick.loc.name)}${lane ? `&lighting=${lane}` : ''}`;
    await page.goto(`http://localhost:5197/play/?${q}`);
    // the bench's `class` skip reads no class today (scenes/dungeon.js hands it inside a comment): the character is made
    // done here, before the level asks, so no wizard stands over the shot
    await page.evaluate(async () => { (await import('/src/characters/playerEntity.js')).playerEntity.chargenDone = true; });
    // the level drawn - and any window still over it closed
    await page.waitForFunction(() => window.__frame >= 5, null, { timeout: 300_000 });
    for (let i = 0; i < 6; i++) {
      const up = await page.evaluate(() => JSON.parse(window.__overlay?.() ?? 'null'));
      if (!up?.kind) break;
      console.log('[probe] closing', up.kind);
      await page.evaluate(() => { window.__overlayKey('Escape'); window.__overlayKey('Enter'); });
      await page.waitForFunction((f) => window.__frame >= f, (await page.evaluate(() => window.__frame)) + 2, { timeout: 120_000 });
    }
    const stood = await page.evaluate(async () => { const c = (await import('/src/scenes/aurumCacheHost.js')).aurumCacheStood(); return c && { id: c.id, foot: c.foot, open: c.open }; });
    if (!stood) { failures.push(`${lane || 'lane'}: no coffer stood`); await page.close(); continue; }
    if (stood.id !== pick.id || stood.foot.some((v, i) => Math.abs(v - pick.foot[i]) > 1e-6)) failures.push(`${lane || 'lane'}: the page's coffer ${JSON.stringify(stood)} is not the law's`);
    const frames = async (n) => { const f0 = await page.evaluate(() => window.__frame); await page.waitForFunction((f) => window.__frame >= f, f0 + n, { timeout: 120_000 }); };
    const shoot = async (name, dist, up, aim, crop) => {
      const { eye, yaw, pitch } = eyeAt(dist, up, aim);
      await page.evaluate(([e, y, p]) => window.__pose(e[0], e[1], e[2], y, p), [eye, yaw, pitch]);
      await frames(4);
      const file = join(outDir, `aurum-coffer-${name}-${lane || 'lane'}.png`);
      await page.screenshot({ path: file, clip: { x: 640 - crop[0] / 2, y: 400 - crop[1] / 2 + crop[2], width: crop[0], height: crop[1] }, timeout: 180_000 });
      await page.screenshot({ path: file.replace('.png', '-full.png'), timeout: 180_000 });
      console.log('[probe]', file);
    };
    await shoot('shut-near', 1.8, 1.0, 0.75, [560, 420, 90]);
    await shoot('shut-far', Math.min(pick.way.free - 0.6, 8), 1.4, 0.75, [360, 240, 30]);
    // the plaque, and the press through the bench's own ladder (its loot arm, the context's takeLoot), the crosshair on it
    await shoot('plaque', 1.8, 1.0, 0.3, [560, 420, 0]);
    const key = await page.evaluate(() => window.__activate());
    if (key !== AURUM_CACHE_KEY) failures.push(`${lane || 'lane'}: the press took ${key}, not the coffer`);
    await page.waitForFunction(async () => (await import('/src/scenes/aurumCacheHost.js')).aurumCacheStood()?.open === true, null, { timeout: 30_000 });
    await frames(6);
    await shoot('open-said', 1.8, 1.0, 0.3, [560, 420, 0]);
    await shoot('open-near', 1.8, 1.0, 0.75, [560, 420, 90]);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
