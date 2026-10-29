// WESTHEAD-NORTH (the owner, 2026-10-29; bible/01-Overview/bugs/Field-Bugs-2026-10-28.md, The shipyard): players bought
// homes by Westhead Moor's north-west shipyard, and TS7 (#1184) put it on the west side. Its old corner is off the town's
// ground now, so it stands on the north strip between the wall and the sea (world/portSites.js PORT_PLACES_NEAR). Held here: a `near` place stands
// as near its cell as fits, the sea's law left for every other town; the cache keys on it; the host hands the town's row;
// and, on ARENA2, Westhead Moor's shipyard on the north strip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { portSitesOn, portSite, seaField, PORT_PLACES_NEAR } from '../../src/world/portSites.js';
import { keptPortSitesOn, prefetchPortSites, _resetPortSites } from '../../src/world/portSitesKept.js';
import { hostText } from '../hostText.mjs';

const W = 96, H = 80;
function groundOf(blockedAt = () => false) {
  const blocked = new Uint8Array(W * H), road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) blocked[gy * W + gx] = blockedAt(gx, gy) ? 1 : 0;
  return { width: W, height: H, blocked, road };
}
// a town with the sea to the west, a block of houses in its middle: the sea's law puts the shipyard on its west edge
const HOUSES = (x, y) => x > 30 && x < 70 && y > 15 && y < 65;
const field = seaField(W, H, null, [-4, 0]);
const mid = (s) => [s.gx + s.nx / 2, s.gy + s.nz / 2];

test('WESTHEAD-NORTH: a `near` shipyard stands as near its cell as fits, its back still to the sea; with none the sea\'s law places it as before, and the lighthouse is placed after it (mutants: near unread; the sea\'s distance kept with it)', () => {
  const law = portSitesOn(groundOf(HOUSES), field);
  assert.equal(law[0].kind, 'shipyard');
  assert.ok(law[0].gx < 10, `the sea's law: the west edge (${law[0].gx})`);
  const want = [50, 72];   // the north strip, over the houses
  const near = portSitesOn(groundOf(HOUSES), field, { shipyard: want });
  const [cx, cy] = mid(near[0]);
  assert.ok(Math.abs(cx - want[0]) <= 1 && Math.abs(cy - want[1]) <= 1, `on its cell: ${cx}, ${cy}`);
  assert.equal(near[1]?.kind, 'lighthouse', 'the lighthouse after it');
  assert.ok(Math.hypot(mid(near[1])[0] - cx, mid(near[1])[1] - cy) > 10, 'and standing off it');
  // a cell that cannot be stood on (the houses): the nearest place that fits, never over a closed cell
  const g = groundOf(HOUSES), s = portSite(g, 'shipyard', field, null, [50, 40]);
  for (let y = s.gy; y < s.gy + s.nz; y++) for (let x = s.gx; x < s.gx + s.nx; x++) assert.equal(g.blocked[y * W + x], 0, 'off the houses');
  assert.deepEqual(portSitesOn(groundOf(HOUSES), field, null), law, 'no row: the sea\'s law');
  assert.deepEqual(portSitesOn(groundOf(HOUSES), field, { lighthouse: null }), law, 'a row for another kind: the shipyard by the sea\'s law');
});

test('WESTHEAD-NORTH: the kept record keys on the town\'s row - a near ask is never served a place kept without one (mutant: near out of the key)', async () => {
  const m = new Map(), store = { async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, structuredClone(v)); return true; } };
  _resetPortSites(); await prefetchPortSites(store);
  const law = keptPortSitesOn(groundOf(HOUSES), field);
  const near = keptPortSitesOn(groundOf(HOUSES), field, { shipyard: [50, 72] });
  assert.notDeepEqual(near[0], law[0], 'placed by its row');
  assert.deepEqual(keptPortSitesOn(groundOf(HOUSES), field, { shipyard: [50, 72] }), near, 'and kept under it');
  _resetPortSites();
});

test('WESTHEAD-NORTH: the table holds Westhead Moor\'s shipyard alone, and the world host hands each town its row (mutant: the row not handed)', () => {
  assert.deepEqual(Object.keys(PORT_PLACES_NEAR), ['1368614887']);
  assert.deepEqual(Object.keys(PORT_PLACES_NEAR[1368614887]), ['shipyard']);
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('ports = keptPortSitesOn(g, seaField(g.width, g.height, townSeaOf(yl, bearing), bearing), PORT_PLACES_NEAR[mapId]);'));
  const f0 = w.indexOf('  async function townPlacesFor('), at = (t) => w.indexOf(t, f0);
  assert.ok(at('const mapId = (dfLocation.mapTableData?.mapId ?? 0) >>> 0') < at('PORT_PLACES_NEAR[mapId]'), 'the town\'s own mapId');
});

// ── WITH ARENA2: Westhead Moor as the world host places it (the packs off - a town a home pins stands so online) ──
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('WESTHEAD-NORTH with ARENA2: Westhead Moor\'s shipyard on the north strip past its wall, its back to the sea, the lighthouse at the strip\'s west end; without its row TS7\'s west side (mutant: the row dropped)', { skip: skipReal, timeout: 900_000 }, async () => {
  const { bayPortGround } = await import('../bayPortGround.mjs');
  const { loc, yl, ground, field: sea, mapId } = await bayPortGround(ARENA2, readFileSync, 'Westhead Moor');
  assert.equal(mapId, 1368614887);
  const law = portSitesOn(ground(), sea);
  assert.deepEqual(law.map((s) => [s.kind, s.gx, s.gy, s.turn]), [['shipyard', 37, 365, 1], ['lighthouse', 61, 398, 1]], 'TS7\'s places: the west side');
  const now = portSitesOn(ground(), sea, PORT_PLACES_NEAR[mapId]);
  assert.deepEqual(now.map((s) => [s.kind, s.gx, s.gy, s.turn]), [['shipyard', 149, 401, 2], ['lighthouse', 57, 394, 1]]);
  const [yard] = now, rows = yl.height * 64;
  assert.ok(yard.gy > 384 && yard.gy + yard.nz < rows, 'past the town\'s last row of blocks: its north strip');
  const { townWallYardCellsOf } = await import('../../src/world/townWalls.js'), wall = townWallYardCellsOf(loc), Wd = yl.width * 64;
  let south = 0;
  for (let y = 0; y < yard.gy; y++) if (wall[y * Wd + yard.gx + 7]) south++;
  assert.ok(south > 0, 'the wall between it and the town, as at TS7\'s west place');
  assert.equal(yard.turn, 2, 'its gate to the town, its back to the north and the sea');
});
