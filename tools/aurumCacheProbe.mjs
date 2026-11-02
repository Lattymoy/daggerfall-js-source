#!/usr/bin/env node
// AURUM-CACHES PROBE (2026-10-30, bible/06-Systems/Aurum.md section 3a): a dungeon's Aurum coffer on the real game files
// through the real renderer - shut, near and far; its plaque; pressed with the crosshair on its middle (the service's
// yes answered at the network); open - in each lighting lane. Frame-synced on the shot mode's __frame, never slept.
// AUDIT-STOREFRONT III D6: by default a place past the Bay the game's `?spawn=` way - a lair of Morrowind at (3293,548),
// laid out online as the world enters it (smallerDungeons.js dungeonLocationFor) - or `--bay`, the named Bay dungeon whole
// as the bench lays it. The coffer's box is checked clear of every pile's, door's and mover's; the page's coffer must be
// the law's, its press must take it and send one claim.
//
//   ARENA2_PATH=/path/to/arena2 node tools/aurumCacheProbe.mjs [outDir] [--spawn px,py | --bay] [--region R] [--dungeon N]
//
// CACHES-ONCE: every dungeon holds its cache, so any day shows it. CHROMIUM=<a chrome> for another browser.
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { dungeonLocationFor } from '../src/world/smallerDungeons.js';
import { synthesizeDungeonLocation, WORLD_SALT } from '../src/world/spawnedDungeons.js';
import { aurumCachePlaceOf, aurumCacheFoot, aurumCofferBox, aurumPileBox, AURUM_CACHE_KEY } from '../src/scenes/aurumCacheHost.js';
import { aurumCacheSpotOf, aurumCacheAurumOf } from '../src/net/aurumCacheLaw.js';
import { pickActivatableHit, RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { hostModelReader } from './dungeonFireProbe.mjs';
import { cacheDungeon, cofferMeets, treasureTexture } from './aurumCacheLayout.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ARENA2 = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
const argv = process.argv.slice(2), flag = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
const outDir = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'tmp-shots';
const bay = argv.includes('--bay'), spawn = bay ? null : (flag('--spawn') ?? '3293,548');
const region = flag('--region') ?? 'Dragontail Mountains', name = flag('--dungeon') ?? 'Ruins of Chirtir Hall';
mkdirSync(outDir, { recursive: true });
const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));

// the law's coffer, off the files: the place laid out as the page lays it (scenes/delve/delveBench.js benchLocation)
const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
const template = maps.getLocationByName(region, name);
if (!template) throw new Error(`no dungeon ${region}/${name}`);
const [px, py] = (spawn ?? '').split(',').map(Number);
const loc = spawn ? dungeonLocationFor(synthesizeDungeonLocation(template, { salt: WORLD_SALT, px, py }), { online: true }) : template;
const id = aurumCachePlaceOf(loc);
if (!id) throw new Error(`${loc.name} holds no cache`);
const { col, piles } = cacheDungeon(loc, blocks, hostModelReader(arch), treasureTexture(ARENA2));
const foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), col);
if (!foot) throw new Error(`${loc.name} ${id}: no pile has room for a coffer`);
const failures = [];
const met = cofferMeets(foot, piles, col);
if (met.length) failures.push(`the coffer's box meets ${met}`);

// the eye: 1.8 m out and 1 m up over the foot, on a floor, the coffer in sight, where a press at its middle takes it in
// the law's own pick with every pile's target standing - the bearing with the longest clear way back, for the far shot
const coffer = { key: AURUM_CACHE_KEY, aabb: aurumCofferBox(foot), distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE };
const targets = piles.filter((p) => p.lawHalf).map((p, i) => ({ key: `loot:${i}`, aabb: aurumPileBox(p), distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE }));
let way = null;
for (let k = 0; k < 16; k++) {
  const a = (k * Math.PI) / 8, eye = [foot[0] + Math.sin(a) * 1.8, foot[1] + 1.0, foot[2] + Math.cos(a) * 1.8], aim = [foot[0], foot[1] + 0.3, foot[2]];
  const v = aim.map((x, i) => x - eye[i]), n = Math.hypot(...v), dir = v.map((x) => x / n);
  if (Number.isFinite(col.raycast(aim, dir.map((x) => -x), n)) || !Number.isFinite(col.raycast(eye, [0, -1, 0], 1.5))) continue;
  if (pickActivatableHit(eye, dir, [...targets, coffer], col)?.key !== AURUM_CACHE_KEY) continue;
  const free = col.raycast([foot[0], foot[1] + 1.3, foot[2]], [Math.sin(a), 0, Math.cos(a)], 12), f = Number.isFinite(free) ? free : 12;
  if (!way || f > way.free) way = { a, free: f };
}
if (!way) throw new Error(`${loc.name} ${id}: no eye round the coffer whose press takes it`);
console.log(`[probe] ${loc.name} (${spawn ? `spawned at ${spawn}, online` : 'the Bay, whole'}) - ${id}, the coffer at ${foot.map((v) => v.toFixed(2))}, ${piles.length} piles, ${way.free.toFixed(1)} m clear`);

const server = await createServer({ server: { port: 5197, strictPort: true, watch: { ignored: ['**/tmp-shots/**', '**/node_modules/**'] } }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
/** An eye `dist` metres out along the clear way, `up` over the coffer's foot, looking back at `aim` metres over its foot
 *  (above the coffer, so no plaque stands over it; at its middle, for the plaque and the press). */
const eyeAt = (dist, up, aim) => {
  const eye = [foot[0] + Math.sin(way.a) * dist, foot[1] + up, foot[2] + Math.cos(way.a) * dist];
  return { eye, yaw: Math.atan2(foot[0] - eye[0], foot[2] - eye[2]), pitch: Math.atan2(foot[1] + aim - eye[1], dist) };
};
try {
  for (const lane of ['', 'classic']) {
    const L = lane || 'lane';
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
    // a signed-in account (the coffer stands for one alone), and the tutorial's popups off - a page over the shot hides it
    await page.addInitScript(() => {
      localStorage.setItem('dagger.account.session', JSON.stringify({ secret: 'probe', id: 'probe-account', kind: 'user', name: 'Probe' }));
      localStorage.setItem('dagger.ui.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('dagger.ui.v1') || '{}'), tutorialPopups: false }));
    });
    const claims = [];
    await page.route('**/v1/aurum/cache', (route) => { claims.push(route.request().postData()); route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, id, aurum: aurumCacheAurumOf(id) }) }); });
    const q = `shot&online&nofoes&region=${encodeURIComponent(region)}&dungeon=${encodeURIComponent(name)}${spawn ? `&spawn=${spawn}` : ''}${lane ? `&lighting=${lane}` : ''}`;
    await page.goto(`http://localhost:5197/play/?${q}`);
    // the bench's `class` skip reads no class today (scenes/dungeon.js hands it inside a comment): the character is made
    // done here, before the level asks, so no wizard stands over the shot
    await page.evaluate(async () => { (await import('/src/characters/playerEntity.js')).playerEntity.chargenDone = true; });
    // the level drawn - and any window still over it closed
    await page.waitForFunction(() => window.__frame >= 5, null, { timeout: 300_000 });
    const frames = async (n) => { const f0 = await page.evaluate(() => window.__frame); await page.waitForFunction((f) => window.__frame >= f, f0 + n, { timeout: 120_000 }); };
    for (let i = 0; i < 6; i++) {
      const up = await page.evaluate(() => JSON.parse(window.__overlay?.() ?? 'null'));
      if (!up?.kind) break;
      console.log('[probe] closing', up.kind);
      await page.evaluate(() => { window.__overlayKey('Escape'); window.__overlayKey('Enter'); });
      await frames(2);
    }
    const stood = await page.evaluate(async () => { const c = (await import('/src/scenes/aurumCacheHost.js')).aurumCacheStood(); return c && { id: c.id, foot: c.foot, open: c.open }; });
    if (!stood) { failures.push(`${L}: no coffer stood`); await page.close(); continue; }
    if (stood.id !== id || stood.foot.some((v, i) => Math.abs(v - foot[i]) > 1e-6)) failures.push(`${L}: the page's coffer ${JSON.stringify(stood)} is not the law's`);
    const shoot = async (shot, dist, up, aim, crop) => {
      const { eye, yaw, pitch } = eyeAt(dist, up, aim);
      await page.evaluate(([e, y, p]) => window.__pose(e[0], e[1], e[2], y, p), [eye, yaw, pitch]);
      await frames(4);
      const file = join(outDir, `aurum-coffer-${shot}-${L}.png`);
      await page.screenshot({ path: file, clip: { x: 640 - crop[0] / 2, y: 400 - crop[1] / 2 + crop[2], width: crop[0], height: crop[1] }, timeout: 180_000 });
      await page.screenshot({ path: file.replace('.png', '-full.png'), timeout: 180_000 });
      console.log('[probe]', file);
    };
    await shoot('shut-near', 1.8, 1.0, 0.75, [560, 420, 90]);
    await shoot('shut-far', Math.min(way.free - 0.6, 8), 1.4, 0.75, [360, 240, 30]);
    // the plaque, and the press through the bench's own ladder (its loot arm, the context's takeLoot), the crosshair on
    // the coffer's middle
    await shoot('plaque', 1.8, 1.0, 0.3, [560, 420, 0]);
    const key = await page.evaluate(() => window.__activate());
    if (key !== AURUM_CACHE_KEY) failures.push(`${L}: the press took ${key}, not the coffer`);
    else await page.waitForFunction(async () => (await import('/src/scenes/aurumCacheHost.js')).aurumCacheStood()?.open === true, null, { timeout: 30_000 });
    if (claims.length !== 1) failures.push(`${L}: ${claims.length} claims sent`);
    await frames(6);
    await shoot('open-said', 1.8, 1.0, 0.3, [560, 420, 0]);
    await shoot('open-near', 1.8, 1.0, 0.75, [560, 420, 90]);
    console.log(`[probe] ${L}: pressed ${key}, claims ${JSON.stringify(claims)}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
