// T1 towns: CityNavigation + MobilePerson + TownPopulation (DFU
// CityNavigation / MobilePersonMotor / PopulationManager, verbatim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CityNavigation, NAV_CELL, NAV_CELLS_PER_BLOCK, tileWeight } from '../src/world/cityNavigation.js';
import { MobilePerson, PERSON_TEXTURES, GUARD_TEXTURE, PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { TownPopulation, maxPopulationFor, POP_RECYCLE_DISTANCE } from '../src/systems/townPopulation.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('cityNav: the tile weights, the automap carve, and the per-block row flip', () => {
  // GetTileWeight verbatim: water family 0, stone 4, dirt 6, grass
  // 12, roads 15, default 7
  assert.equal(tileWeight(0), 0); assert.equal(tileWeight(30), 0);
  assert.equal(tileWeight(3), 4); assert.equal(tileWeight(1), 6);
  assert.equal(tileWeight(2), 12); assert.equal(tileWeight(46), 15);
  assert.equal(tileWeight(55), 15); assert.equal(tileWeight(9), 7);
  // A 1-block city: automap covers one cell; the ground grid is road
  // on RMB row 0 (which renders at the TOP of the block - world row
  // 63, the same flip the tilemap loop applies) and grass elsewhere.
  const nav = new CityNavigation(1, 1);
  const autoMap = new Uint8Array(64 * 64);
  autoMap[5 * 64 + 7] = 0x01;   // a building covers automap (7,5)
  nav.setBlockData(0, 0, autoMap, (tx, ty) => (ty === 0 ? 46 : 2));
  // RMB row 0 -> world row 63: roads live at gy 60..63 (4x4 spread)
  assert.equal(nav.weightAt(10, 63), 15);
  assert.equal(nav.weightAt(10, 30), 12);   // grass elsewhere
  // The covered automap cell (7,5) lands at world row 63-5=58, weight 0
  assert.equal(nav.weightAt(7, 58), 0);
  assert.equal(nav.weightAt(8, 58), 12, 'only the covered cell is carved');
  // Occupancy flags ride the low nibble
  nav.setOccupied(3, 3);
  assert.ok(nav.occupied(3, 3));
  nav.clearOccupied(3, 3);
  assert.ok(!nav.occupied(3, 3));
  // Spawn probe: any weight>0 cell wins; a covered origin retries
  const spawn = nav.getRandomSpawnPosition(32, 32, 4, 10, seq(0.5, 0.5));
  assert.ok(spawn && nav.weightAt(spawn[0], spawn[1]) > 0);
});

test('mobilePerson: seeks the best neighbor, marches, and the politeness idle', () => {
  const nav = new CityNavigation(1, 1);
  const autoMap = new Uint8Array(64 * 64);
  // All grass, one road COLUMN at tile tx=8 (world gx 32..35)
  nav.setBlockData(0, 0, autoMap, (tx) => (tx === 8 ? 46 : 2));
  const person = new MobilePerson(nav, {
    archive: 385, frameCount: () => 4, groundY: () => 0,
    rand: seq(0.9, 0.9, 0.9, 0.9, 0.9),   // no random shuffle, keep the downgrade branch live
  });
  person.place(33, 30);   // ON the road
  assert.ok(nav.occupied(33, 30));
  // Seek: current weight 15; stepping E/W is grass (12 < 15) - the
  // downgrade branch (rand .9 > .2 keeps the search) picks a
  // roadward best or marches N/S along the road.
  const out = person.update(1 / 60, [33 * NAV_CELL, 0, 0]);
  assert.equal(person.state, 'move');
  const onRoadTarget = person.tx >= 32 && person.tx <= 35;
  assert.ok(onRoadTarget, `the target stays on the road column: ${person.tx}`);
  assert.ok(out.record >= 0 && out.record <= 4, 'a move record');
  // March to the cell center: 1.6 units at 1.3 u/s
  for (let i = 0; i < 90; i++) person.update(1 / 60, [0, 0, 0]);
  assert.ok(person.moveCount >= 1, 'completed a tile move');
  // The politeness idle: record 5 while wantsToStop holds
  const idleOut = person.update(1 / 60, [0, 0, 0], true);
  assert.equal(person.state, 'idle');
  assert.equal(idleOut.record, 5);
  // Guards idle on record 15
  const guard = new MobilePerson(nav, { archive: GUARD_TEXTURE, guard: true, frameCount: () => 4, groundY: () => 0 });
  guard.place(34, 30);
  assert.equal(guard.update(1 / 60, [0, 0, 0], true).record, 15);
});

test('population: the pool laws - sizing, texture tables, spawn/recycle, anti-skate', () => {
  // clamp(blocks/16, 1, 4) * 24
  assert.equal(maxPopulationFor(4), 24);
  assert.equal(maxPopulationFor(16), 24);
  assert.equal(maxPopulationFor(32), 48);
  assert.equal(maxPopulationFor(200), 96);
  // The verbatim texture tables
  assert.deepEqual(PERSON_TEXTURES.Redguard.male, [381, 382, 383, 384]);
  assert.deepEqual(PERSON_TEXTURES.Nord.female, [392, 393, 451, 452]);
  assert.deepEqual(PERSON_TEXTURES.Breton.male, [385, 386, 391, 394]);
  assert.equal(GUARD_TEXTURE, 399);
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, new Uint8Array(64 * 64), () => 46);   // all roads
  const made = [];
  const pop = new TownPopulation(nav, {
    totalBlocks: 16, race: 'Breton',
    makePerson: (archive) => { const p = new MobilePerson(nav, { archive, frameCount: () => 4, groundY: () => 0 }); made.push(p); return p; },
  });
  // Daytime, player mid-grid facing +z: one spawn per 10Hz tick;
  // spawns behind/far promote instantly and are HIDDEN until the
  // first completed move (anti-skate: update returns nothing yet).
  const player = [32 * NAV_CELL, 0, 32 * NAV_CELL];
  let live = pop.update(0.1001, player, 0, player, true);
  assert.equal(made.length, 1, 'one spawn per tick');
  assert.equal(live.length, 0, 'anti-skate: hidden until the first tile move');
  for (let i = 0; i < 200 && !live.length; i++) live = pop.update(1 / 60, player, 0, player, true);
  assert.ok(live.length >= 1, 'visible after the first completed move');
  // Night recycles everyone (daytime-only townsfolk)
  for (let i = 0; i < 5; i++) pop.update(0.1001, player, 0, player, false);
  assert.equal(pop.update(1 / 60, player, 0, player, false).length, 0);
  assert.ok(pop.pool.every((it) => !it.active || it.scheduleRecycle));
  assert.ok(POP_RECYCLE_DISTANCE === 150 && PERSON_MOVE_SPEED === 1.3);
});
