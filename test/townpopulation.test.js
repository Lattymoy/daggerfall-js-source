// T1 towns: CityNavigation + MobilePerson + TownPopulation (DFU
// CityNavigation / MobilePersonMotor / PopulationManager, verbatim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CityNavigation, NAV_CELL, NAV_CELLS_PER_BLOCK, tileWeight } from '../src/world/cityNavigation.js';
import { MobilePerson, PERSON_TEXTURES, GUARD_TEXTURE, PERSON_MOVE_SPEED, PERSON_IDLE_DISTANCE, PERSON_IDLE_RECORD, personWantsToStop } from '../src/characters/mobilePerson.js';
import { areEnemiesNearby } from '../src/systems/encounters.js';   // the ONE home for GameManager.AreEnemiesNearby
import { TownPopulation, maxPopulationFor, POP_RECYCLE_DISTANCE, POP_SPAWN_RANGE_OUTSIDE_RECT } from '../src/systems/townPopulation.js';

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
  // NT2 (F022): the SPAWN sets no occupancy flag - DFU's spawn path
  // only positions the transform (PopulationManager.cs:150-166) and
  // Occupied is written solely in SetTargetPosition (:438-439), so
  // other walkers may enter this tile until the first target claims one.
  assert.equal(nav.occupied(33, 30), false, 'no flag at spawn');
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
  // Deterministic pool rand: spawn probes land at (13,13) every tick
  // (the +-96 radius over a 64-cell grid fails ~28% of Math.random
  // probes - audit 2026-08-17 hardened the suite against the flake).
  const pop = new TownPopulation(nav, {
    totalBlocks: 16, race: 'Breton', rand: () => 0.4,
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

test('population audit pins: single tick, range gate, RandomiseNPC per spawn + guards', () => {
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, new Uint8Array(64 * 64), () => 46);   // all roads
  const player = [32 * NAV_CELL, 0, 32 * NAV_CELL];
  // A slow frame ticks ONCE (PopulationManager resets the timer to 0)
  {
    const pop = new TownPopulation(nav, {
      totalBlocks: 16, race: 'Breton', rand: () => 0.5,
      makePerson: (a) => new MobilePerson(nav, { archive: a, frameCount: () => 4, groundY: () => 0 }),
    });
    pop.update(0.5, player, 0, player, true);
    assert.equal(pop.pool.filter((it) => it.active).length, 1, 'one spawn per frame no matter the dt');
  }
  // maxPlayerDistanceOutsideRect: past rect + 62.5 nothing spawns
  {
    const pop = new TownPopulation(nav, {
      totalBlocks: 16, race: 'Breton',
      makePerson: (a) => new MobilePerson(nav, { archive: a, frameCount: () => 4, groundY: () => 0 }),
    });
    pop.update(0.1001, [1000, 0, 1000], 0, player, true);
    assert.equal(pop.pool.length, 0, 'no spawn attempt outside the rect margin');
    assert.equal(POP_SPAWN_RANGE_OUTSIDE_RECT, 62.5);
    // Just inside the margin spawns fine (origin clamps onto the grid probes)
    pop.update(0.1001, [-60, 0, 32 * NAV_CELL], 0, player, true);
    assert.ok(pop.pool.length <= 1);
  }
  // RandomiseNPC at EVERY spawn: roll 0 on the 1/32 -> a guard (399);
  // a recycled item re-rolls into a townsperson next spawn.
  {
    // draws per spawn: spawnX, spawnY, guardRoll[, gender, variant]
    const rolls = seq(
      0.5, 0.5, 0.0,             // spawn 1: guard (floor(0*32) === 0)
      0.5, 0.5, 0.9, 0.9, 0.0,   // spawn 2 (reuses the item): female table, variant 0
    );
    const pop = new TownPopulation(nav, {
      totalBlocks: 16, race: 'Breton', rand: rolls,
      makePerson: (a) => new MobilePerson(nav, { archive: a, frameCount: () => 4, groundY: () => 0, rand: () => 0.9 }),
    });
    pop.update(0.1001, player, 0, player, true);
    const it = pop.pool[0];
    assert.equal(it.person.archive, GUARD_TEXTURE);
    assert.equal(it.person.guard, true);
    // recycle by hand, then the next tick re-rolls the SAME item
    it.person.release();
    it.active = false; it.scheduleEnable = false; it.visible = false;
    pop.update(0.1001, player, 0, player, true);
    assert.equal(pop.pool.length, 1, 'the shell is reused');
    assert.equal(it.person.archive, 453, 'Breton female variant 0 after the re-roll');
    assert.equal(it.person.guard, false);
  }
});

test('mobilePerson audit pins: the self-target place + the N/S/E-only best scan', () => {
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, new Uint8Array(64 * 64), () => 2);   // all grass
  // place() targets SELF: an idle resume before the first seek arrives
  // instantly and rederives the nav cell (never marches to origin)
  const p = new MobilePerson(nav, { archive: 385, frameCount: () => 4, groundY: () => 0, rand: () => 0.9 });
  p.place(30, 30);
  p.update(1 / 60, [0, 0, 0], true);    // politeness idle straight from seek
  assert.equal(p.state, 'idle');
  p.update(1 / 60, [0, 0, 0], false);   // resume -> move toward SELF
  const d0 = Math.hypot(p.pos[0] - 30 * NAV_CELL - NAV_CELL / 2, p.pos[2] - 30 * NAV_CELL - NAV_CELL / 2);
  assert.ok(d0 < 0.2, `stays on its cell (moved ${d0.toFixed(2)})`);
  p.update(1 / 60, [0, 0, 0], false);   // arrival -> seek rederives gx,gy
  assert.equal(p.gx, 30); assert.equal(p.gy, 30);
  // The DFU quirk: the downgrade-leave best scan covers N/S/E only -
  // with the only upgrade WEST, the person keeps its downgrade course.
  const nav2 = new CityNavigation(1, 1);
  // road COLUMN at tiles tx 0..1 (gx 0..7), grass elsewhere
  nav2.setBlockData(0, 0, new Uint8Array(64 * 64), (tx) => (tx <= 1 ? 46 : 2));
  const q = new MobilePerson(nav2, { archive: 385, frameCount: () => 4, groundY: () => 0, rand: seq(0.3, 0.9, 0.9, 0.9, 0.9, 0.9) });
  // ctor dir roll 0.3 -> dir 1 (south); at gx 8 (grass, weight 12) the
  // road upgrade is WEST (gx 7, weight 15) but the scan never sees it
  q.place(8, 30);
  q.update(1 / 60, [0, 0, 0]);
  assert.equal(q.state, 'move');
  assert.notEqual(q.tx, 7, 'west is never chosen as a best direction (DFU Range(0,3))');
});

// ---- The POLITENESS GATE (MobilePersonMotor.cs:216-230) -------------
// AUDIT 18's row: the port built the gate out of four terms in two
// untestable hosts and dropped DFU's AreEnemiesNearby() clause, so a
// townsperson idled beside a hostile guard where DFU keeps it
// walking. The law is personWantsToStop now and these run it.

const openGate = { playerStandingStill: true, distanceToPlayer: 1, sheathed: true, invisible: false, inBeastForm: false };

test('politeness gate: all six terms of wantsToStop, each one flipped alone', () => {
  assert.equal(personWantsToStop(openGate), true, 'five terms hold, no foes -> the person stops');
  // :224, term by term
  assert.equal(personWantsToStop({ ...openGate, playerStandingStill: false }), false, 'a walking player');
  assert.equal(personWantsToStop({ ...openGate, sheathed: false }), false, 'a drawn weapon');
  assert.equal(personWantsToStop({ ...openGate, invisible: true }), false, 'an invisible player');
  assert.equal(personWantsToStop({ ...openGate, inBeastForm: true }), false, 'a were-creature');
  // withinIdleDistance is STRICT `<` against idleDistance (:32, :218)
  assert.equal(PERSON_IDLE_DISTANCE, 2.5);
  assert.equal(personWantsToStop({ ...openGate, distanceToPlayer: 2.4999 }), true);
  assert.equal(personWantsToStop({ ...openGate, distanceToPlayer: 2.5 }), false, 'exactly idleDistance is NOT within it');
  assert.equal(personWantsToStop({ ...openGate, distanceToPlayer: undefined }), false, 'no measurement is not "near"');
  // THE TERM AUDIT 18 FOUND MISSING (:226-230)
  assert.equal(personWantsToStop({ ...openGate, enemiesNearby: () => true }), false, 'a hostile in range keeps it walking');
  assert.equal(personWantsToStop({ ...openGate, enemiesNearby: () => false }), true);
  // and the whole thing answers a boolean, never a stray falsy input
  assert.equal(personWantsToStop({ ...openGate, playerStandingStill: null }), false);
  assert.equal(personWantsToStop(), false, 'an empty bag is not an open gate');
});

test('politeness gate: AreEnemiesNearby is asked ONLY when the other five hold (:226-230)', () => {
  // DFU's own comment on that if/else: "greatly reduce # of calls to
  // AreEnemiesNearby() by short-circuit evaluation".
  let calls = 0;
  const spy = () => { calls++; return false; };
  assert.equal(personWantsToStop({ ...openGate, enemiesNearby: spy }), true);
  assert.equal(calls, 1, 'exactly one call when the gate is otherwise open');
  for (const shut of [{ playerStandingStill: false }, { distanceToPlayer: 9 }, { sheathed: false }, { invisible: true }, { inBeastForm: true }]) {
    calls = 0;
    assert.equal(personWantsToStop({ ...openGate, ...shut, enemiesNearby: spy }), false);
    assert.equal(calls, 0, `no scan with ${Object.keys(shut)[0]} shut`);
  }
});

test('politeness gate: the enemies term is the STRICT AreEnemiesNearby, over the host pool', () => {
  const gate = (foes) => personWantsToStop({ ...openGate, enemiesNearby: () => areEnemiesNearby(foes) });
  // An UNAWARE foe far away but inside the classic spawn band.
  // MobilePersonMotor calls AreEnemiesNearby() with NO arguments, so
  // `resting` takes its false default (GameManager.cs:684) and this
  // foe counts - the townsperson keeps walking.
  const unaware = [{ dead: false, ai: { detected: false, inSight: false, wouldBeSpawned: true, _dist: 900 } }];
  assert.equal(areEnemiesNearby(unaware), true, 'the strict variant counts it');
  assert.equal(areEnemiesNearby(unaware, { resting: true }), false, 'the RESTING variant skips it - a different question');
  assert.equal(gate(unaware), false, 'the gate asks the STRICT one');
  // A foe that can see you counts at any distance.
  assert.equal(gate([{ dead: false, ai: { detected: true, inSight: true, _dist: 40 } }]), false);
  // Half-seen is not seen, and a corpse is not a hostile.
  assert.equal(gate([{ dead: false, ai: { detected: true, inSight: false, _dist: 40 } }]), true);
  assert.equal(gate([{ dead: true, ai: { detected: true, inSight: true, _dist: 0 } }]), true);
  assert.equal(gate([]), true, 'an empty watch is a quiet street');
});

test('politeness gate: the motor obeys it, and both exterior hosts feed it their pool', () => {
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, new Uint8Array(64 * 64), () => 2);   // all grass
  const person = new MobilePerson(nav, { archive: 385, frameCount: () => 4, groundY: () => 0, rand: seq(0.9) });
  person.place(30, 30);
  const watch = [];
  const stop = () => personWantsToStop({ ...openGate, enemiesNearby: () => areEnemiesNearby(watch) });
  const quiet = person.update(1 / 60, [0, 0, 0], stop());
  assert.equal(person.state, 'idle', 'a quiet street with the player still and sheathed -> the person stops');
  assert.equal(quiet.record, PERSON_IDLE_RECORD, 'and it draws the idle record');
  watch.push({ dead: false, ai: { detected: true, inSight: true, _dist: 3 } });
  const alarmed = person.update(1 / 60, [0, 0, 0], stop());
  assert.notEqual(person.state, 'idle', 'a hostile in range puts it back on its feet');
  assert.ok(alarmed.record >= 0 && alarmed.record <= 4, `and back on the move wheel (got ${alarmed.record})`);
  // The wiring, which lives in two hosts a test cannot boot: each
  // must call the law and hand it its OWN live pool, and neither may
  // keep a hand-rolled four-term gate.
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    assert.match(src(f), /personWantsToStop\(\{/, f);
    assert.match(src(f), /enemiesNearby: \(\) => areEnemiesNearby\(/, f);
    assert.doesNotMatch(src(f), /_playerStill && pd < 2\.5/, `${f} still hand-rolls the gate`);
  }
  assert.match(src('src/scenes/exterior.js'), /enemiesNearby: \(\) => areEnemiesNearby\(cityGuards\.guards\)/);
  assert.match(src('src/scenes/world.js'), /enemiesNearby: \(\) => areEnemiesNearby\(enchantFoes\(\)\)/);
});
