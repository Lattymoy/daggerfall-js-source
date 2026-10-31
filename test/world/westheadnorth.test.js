// WESTHEAD-NORTH (the owner, 2026-10-29; bible/01-Overview/bugs/Field-Bugs-2026-10-28.md, The shipyard): players bought
// homes by Westhead Moor's north shipyard, and TS7 (#1184) put it on the west side in both of its layouts. Its old places are
// off the town's ground now, so it stands as near them as fits (world/portSites.js PORT_PLACES_NEAR, a row a layout).
// Held here: a `near` place stands as near its cell as fits - the distance a square root, a front with no road its cost -
// the sea's law left for every other town; a row is handed only in its own layout; the cache keys on the row's value; and,
// on ARENA2, Westhead Moor's shipyard on the north strip in Daggerfall's layout (the packs' layout:
// westheadnorth_bc.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { portSitesOn, portSite, seaField, PORT_PLACES_NEAR, portPlacesNear } from '../../src/world/portSites.js';
import { keptPortSitesOn, prefetchPortSites, _resetPortSites } from '../../src/world/portSitesKept.js';
import { NO_ROAD_COST } from '../../src/world/merchantYards/merchantYardSites.js';
import { layoutsMatch } from '../../src/systems/layoutPins.js';
import { hostText } from '../hostText.mjs';

const W = 96, H = 80;
function groundOf(blockedAt = () => false, roadAt = () => false) {
  const blocked = new Uint8Array(W * H), road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) { blocked[gy * W + gx] = blockedAt(gx, gy) ? 1 : 0; road[gy * W + gx] = roadAt(gx, gy) ? 1 : 0; }
  return { width: W, height: H, blocked, road };
}
// a town with the sea to the west, a block of houses in its middle: the sea's law puts the shipyard on its west edge
const HOUSES = (x, y) => x > 30 && x < 70 && y > 15 && y < 65;
const field = seaField(W, H, null, [-4, 0]);
const mid = (s) => [s.gx + s.nx / 2, s.gy + s.nz / 2];
const WESTHEAD = 1368614887;

test('WESTHEAD-NORTH: a `near` shipyard stands as near its cell as fits, its back still to the sea; with none the sea\'s law places it as before, and the lighthouse is placed after it (mutants: near unread; the sea\'s distance kept with it; the shipyard\'s row to every kind)', () => {
  const law = portSitesOn(groundOf(HOUSES), field);
  assert.equal(law[0].kind, 'shipyard');
  assert.ok(law[0].gx < 10, `the sea's law: the west edge (${law[0].gx})`);
  const want = [50, 72];   // the north strip, over the houses
  const near = portSitesOn(groundOf(HOUSES), field, { shipyard: want });
  const [cx, cy] = mid(near[0]);
  assert.ok(Math.abs(cx - want[0]) <= 1 && Math.abs(cy - want[1]) <= 1, `on its cell: ${cx}, ${cy}`);
  assert.equal(near[1]?.kind, 'lighthouse', 'the lighthouse after it');
  assert.ok(Math.hypot(mid(near[1])[0] - cx, mid(near[1])[1] - cy) > 10, 'and standing off it');
  assert.ok(near[1].gx < 10, `the lighthouse by the sea's law, its row the shipyard's alone: ${near[1].gx}`);
  // a cell that cannot be stood on (the houses): the nearest place that fits, never over a closed cell
  const g = groundOf(HOUSES), s = portSite(g, 'shipyard', field, null, [50, 40]);
  for (let y = s.gy; y < s.gy + s.nz; y++) for (let x = s.gx; x < s.gx + s.nx; x++) assert.equal(g.blocked[y * W + x], 0, 'off the houses');
  assert.deepEqual(portSitesOn(groundOf(HOUSES), field, null), law, 'no row: the sea\'s law');
  assert.deepEqual(portSitesOn(groundOf(HOUSES), field, { lighthouse: null }), law, 'a row for another kind: the shipyard by the sea\'s law');
});

test('WESTHEAD-NORTH: a near place\'s score is its distance - a square root, exact on every engine - and a front onto no road costs it NO_ROAD_COST, as the sea\'s law\'s (mutants: the distance squared; the road cost skipped for a near place)', () => {
  const middle = seaField(W, H, null, [0, 0]);   // no sea to face: the score is the distance and the road alone
  const anchor = [50, 40];   // inside the houses: the place stands off them, a few cells away
  const s = portSite(groundOf(HOUSES), 'shipyard', middle, null, anchor);
  const [cx, cy] = mid(s), d = Math.sqrt((cx - anchor[0]) ** 2 + (cy - anchor[1]) ** 2);
  assert.ok(d > 1, `off its cell: ${d}`);
  assert.equal(s.score, d + NO_ROAD_COST, 'its distance, and no road at its front');
  // a road below the cell: the place backs off it, its front onto the road, and the cost is gone
  const r = portSite(groundOf(HOUSES, (x, y) => y === 30 && x < 28), 'shipyard', middle, null, [10, 40]);
  const [rx, ry] = mid(r);
  assert.equal(r.score, Math.sqrt((rx - 10) ** 2 + (ry - 40) ** 2), 'a front onto a road: the distance alone');
});

test('WESTHEAD-NORTH: the kept record keys on the row\'s value - a moved row is placed again, never served the old place; the record unfetched places by the row too (mutants: near out of the key; the key a flag alone; the unkept path without the row)', async () => {
  _resetPortSites();
  const unkept = keptPortSitesOn(groundOf(HOUSES), field, { shipyard: [50, 72] });
  assert.deepEqual(unkept, portSitesOn(groundOf(HOUSES), field, { shipyard: [50, 72] }), 'no record fetched: the row still places');
  const m = new Map(), store = { async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, structuredClone(v)); return true; } };
  await prefetchPortSites(store);
  const law = keptPortSitesOn(groundOf(HOUSES), field);
  const near = keptPortSitesOn(groundOf(HOUSES), field, { shipyard: [50, 72] });
  assert.notDeepEqual(near[0], law[0], 'placed by its row');
  assert.deepEqual(keptPortSitesOn(groundOf(HOUSES), field, { shipyard: [50, 72] }), near, 'and kept under it');
  const moved = keptPortSitesOn(groundOf(HOUSES), field, { shipyard: [20, 72] });
  assert.deepEqual(moved, portSitesOn(groundOf(HOUSES), field, { shipyard: [20, 72] }), 'a moved row: placed again');
  assert.notDeepEqual(moved[0], near[0]);
  _resetPortSites();
});

test('WESTHEAD-NORTH: the table holds Westhead Moor\'s shipyard alone, a row for Daggerfall\'s layout (OWN-WORK3: Beautiful Cities\' went with the mod); a row is handed only in its own layout - the host asks the town\'s layout pins (mutants: the row not handed; a row in any layout)', () => {
  assert.deepEqual(Object.keys(PORT_PLACES_NEAR), [String(WESTHEAD)]);
  assert.deepEqual(PORT_PLACES_NEAR[WESTHEAD].map((r) => [r.layout, Object.keys(r).filter((k) => k !== 'layout')]), [['classic', ['shipyard']]]);
  const near = (stamp) => portPlacesNear(WESTHEAD, stamp, layoutsMatch)?.shipyard ?? null;
  assert.deepEqual(near('classic'), [156, 406]);
  assert.deepEqual(near(undefined), [156, 406], 'no stamp: Daggerfall\'s layout');
  assert.equal(near('beautiful-cities@0.5.0'), null, 'a retired layout: no row');
  assert.equal(near('beautiful-villages@1.4.2'), null, 'a layout with no row: none');
  assert.equal(portPlacesNear(7, 'classic', () => true), null, 'another town: none');
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('ports = keptPortSitesOn(g, seaField(g.width, g.height, townSeaOf(yl, bearing), bearing), portPlacesNear(mapId, layoutStampOfMapId(mapId), layoutsMatch));'));
  const f0 = w.indexOf('  async function townPlacesFor('), at = (t) => w.indexOf(t, f0);
  assert.ok(at('const mapId = (dfLocation.mapTableData?.mapId ?? 0) >>> 0') < at('portPlacesNear(mapId,'), 'the town\'s own mapId');
});

// ── WITH ARENA2: Westhead Moor as the world host places it in Daggerfall's layout (the packs off) ──
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('WESTHEAD-NORTH with ARENA2: in Daggerfall\'s layout the shipyard stands on the north strip past the wall, its back to the sea, the lighthouse by the old corner; without its row TS7\'s west side (mutants: the row dropped; the row moved)', { skip: skipReal, timeout: 900_000 }, async () => {
  const { bayPortGround } = await import('../bayPortGround.mjs');
  const { loc, yl, ground, field: sea, mapId } = await bayPortGround(ARENA2, readFileSync, 'Westhead Moor');
  assert.equal(mapId, WESTHEAD);
  const law = portSitesOn(ground(), sea);
  assert.deepEqual(law.map((s) => [s.kind, s.gx, s.gy, s.turn]), [['shipyard', 37, 365, 1], ['lighthouse', 61, 398, 1]], 'TS7\'s places: the west side');
  const row = portPlacesNear(mapId, 'classic', layoutsMatch);
  const now = portSitesOn(ground(), sea, row);
  assert.deepEqual(now.map((s) => [s.kind, s.gx, s.gy, s.turn]), [['shipyard', 149, 401, 2], ['lighthouse', 57, 394, 1]]);
  const [yard] = now, lastBlockRow = (yl.height - 1) * 64 - 1;   // the ring's row is open land since TS7
  assert.ok(yard.gy > lastBlockRow && yard.gy + yard.nz < yl.height * 64, 'past the town\'s last row of blocks: its north strip');
  const { townWallYardCellsOf } = await import('../../src/world/townWalls.js'), wall = townWallYardCellsOf(loc), Wd = yl.width * 64;
  let between = 0;
  for (let y = lastBlockRow + 1; y < yard.gy; y++) if (wall[y * Wd + yard.gx + 7]) between++;
  assert.ok(between > 0, 'the north wall between it and the town, as at TS7\'s west place');
  assert.equal(yard.turn, 2, 'its gate to the town, its back to the north and the sea');
});
