// AUDIT 61 - THE HOSTS AND ENCOUNTERS LANE (2026-09-07).
//
// Seven findings against the two walkable outdoor hosts and the mode
// machine they both mount. What is pinned here is the REFERENCE's own
// answer in each case - PlayerEntity.Update's catch-up loop consuming
// each minute as it passes (:479-522), WabbajackEffect's unconditional
// re-stand (:86-88), SpawnCityGuards' outer dungeon gate (:625) and its
// indoor arm (:628-642), MakeNPCGuards' three `isActiveAndEnabled`
// continues, CreateFoe's OverlapSphere over ANY collider (:319-323),
// EnemySenses' IsPlayerInside band pick (:267-306), and BLBSkybox's
// Interior/ExteriorTransitionEvent (:1247-1299).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { intermittentEnemySpawn, timeForSpawn } from '../src/systems/encounters.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import {
  wouldBeSpawnedInClassic, CLASSIC_SPAWN_XZ, CLASSIC_SPAWN_Y_UPPER,
  CLASSIC_SPAWN_DESPAWN_EXTERIOR,
} from '../src/characters/enemyMotor.js';
import { LightningFlash } from '../src/systems/dynamicSkies.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

/** A deterministic uniform stream, so the trial counts below are the
 *  same on every machine. */
const rngFrom = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
};

// ─────────────────────────────────────────────────────────────────────
// F11 - the catch-up loop must run in the modal modes
// ─────────────────────────────────────────────────────────────────────

test('AUDIT 61 F11: an indoor minute rolls NOTHING, and the door must not replay it as an outdoor one', () => {
  // The tavern night the finding names: enter at 20:00 on a town pixel,
  // sleep eight hours, walk back out. PlayerEntity.Update runs its loop
  // every Update whatever PlayerEnterExit says (PlayerEntity.cs:486-492)
  // and advances lastGameMinutes at :521, so those 480 minutes are
  // CONSUMED as they pass - and IntermittentEnemySpawn refuses every one
  // of them, because :564's outdoor block is guarded by
  // `if (!GameManager.Instance.PlayerEnterExit.IsPlayerInside)` and the
  // inside block below it spawns only for IsPlayerInsideDungeon && resting.
  const DAY = 1440;
  const from = DAY * 3 + 20 * 60;          // 20:00 on the fourth day
  const span = 480;                         // eight hours
  const minutes = (inside) => ({
    inside, inDungeon: false, isResting: false, inLocationRect: true,
    climateIndex: CLIMATES.Woodlands, playerLevel: 3,
  });
  const walk = (seed, inside) => {
    const rolls = rngFrom(seed);
    let hits = 0;
    for (let l = 0; l < span; l++) {
      if (intermittentEnemySpawn({ ...minutes(inside), gameMinutes: from + l + 1 }, rolls)) hits++;
    }
    return hits;
  };
  // The 144-minute cadence opens forty of those minutes (:559) - the
  // span really is a live one, so "zero" below is the inside arm and
  // not an empty loop.
  let eligible = 0;
  for (let l = 0; l < span; l++) if (timeForSpawn(from + l + 1)) eligible++;
  assert.equal(eligible, 36, 'thirty-six spawn windows in these eight hours ((minutes/12) % 12 == 0)');

  // DFU, for every seed: an indoor minute spawns nothing.
  for (let seed = 1; seed <= 200; seed++) {
    assert.equal(walk(seed, true), 0, `seed ${seed}: IsPlayerInside refuses the roll (PlayerEntity.cs:564)`);
  }
  // And the shape the unreachable call left behind - the same minutes
  // banked and replayed at the door with inside:false - is not
  // harmless: most nights stand a foe on the doorstep.
  let banked = 0;
  for (let seed = 1; seed <= 200; seed++) if (walk(seed, false) > 0) banked++;
  assert.ok(banked > 120, `the banked replay spawns on most nights (${banked}/200) - that is the divergence`);
});

test('AUDIT 61 F11: the mode machine rings the loop once per modal frame, and from the interior rest', () => {
  const wm = src('src/scenes/worldModes.js');
  const fi = wm.indexOf('  function frame(dt, now) {');
  assert.ok(fi > 0);
  const call = wm.indexOf('host.encounterTick?.();', fi);
  const dungeonSplit = wm.indexOf("    if (mode === 'dungeon') {", fi);
  const exitReturn = wm.indexOf("    if (mode === 'exterior') return true;", fi);
  assert.ok(call > fi, 'the modal frame calls the host\'s catch-up loop');
  assert.ok(call < dungeonSplit, 'ABOVE the render split, so one line covers the interior and dungeon arms');
  assert.ok(call < exitReturn, 'and above the exit-transition return, so the minutes are still indoor minutes');
  assert.match(wm.slice(call - 40, call + 24), /if \(!overlayHeld\) host\.encounterTick\?\.\(\);/,
    'under the same gate the interior ticker rides - a paused game runs no Update');
  // TickRest's minutes pass indoors too (the outdoor hosts' rest deps
  // have consumed theirs since ROAD-G TAIL).
  assert.match(wm, /advanceMinutes: \(n\) => \{ interiorTicker\.advance\(n\); host\.encounterTick\?\.\(\); \},/,
    'the interior rest consumes its own minutes');
  // and both hosts hand the dep in
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(h);
    const bag = s.slice(s.indexOf('var modes = createWorldModes({'));
    assert.match(bag, /encounterTick: \(\) => runEncounterTick\(/, `${h}: the host offers its loop to the mode machine`);
  }
});

test('AUDIT 61 F11: the NPC-guard conversion sweep is EXTERIOR only in both hosts', () => {
  // MakeNPCGuardsIntoEnemiesIfGuardsSpawned (PlayerEntity.cs:764-780)
  // walks PopulationManager.PopulationPool and skips every
  // `!npc.isActiveAndEnabled` entry; PlayerEnterExit.cs:1047 disables
  // the whole ExteriorParent on an interior transition, so the sweep
  // converts nobody indoors - and :768-770 returns underground on the
  // null location object. Now that the loop runs in the modal modes,
  // "not a dungeon" would have converted street townsfolk while the
  // player stood in a shop.
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(h);
    const fn = s.slice(s.indexOf('function runEncounterTick'), s.indexOf('\n  }\n', s.indexOf('function runEncounterTick')));
    assert.ok(fn.includes("if (_m === 'exterior') cityGuards.makeNpcGuardsIntoEnemies("), `${h}: the sweep is exterior-only`);
    assert.equal(/_m !== 'dungeon'/.test(fn), false, `${h}: the "not a dungeon" gate is gone`);
  }
});

// ─────────────────────────────────────────────────────────────────────
// F12 - the Wabbajack re-stand is a REPLACEMENT, not an addition
// ─────────────────────────────────────────────────────────────────────

const stubTex = {
  getFrameCount: () => 1,
  getSize: () => ({ width: 1, height: 1 }),
  getScale: () => ({ width: 0, height: 0 }),
};
/** A live encounter pool whose spawn path stops at the career load, so
 *  "did the cap let this through" is observable with no ARENA2. */
const poolRig = (calls) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => 0.5, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async () => { calls.n++; throw new Error('REACHED THE SPAWN'); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 0,
  playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
  audio: null,
  onPlayerHurt: () => {},
  rolls: () => 0.5,
  rand: () => 0.5,
});
const deadRecord = () => ({ mobileType: 0, dead: false, ai: { feet: [0, 0, 0], height: 1.8 }, entity: {} });

test('AUDIT 61 F12: a saturated pool refuses a plain spawn and ACCEPTS the transform\'s re-stand', async () => {
  const calls = { n: 0 };
  const pool = createExteriorFoes(poolRig(calls));
  for (let i = 0; i < MAX_ACTIVE_ENCOUNTER_FOES; i++) pool.foes.push(deadRecord());
  assert.equal(pool.foes.filter((f) => !f.dead).length, 8, 'the street is full');

  // the port's own bound, unchanged for an ordinary spawn
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(await pool.spawnFoe(0, [1, 0, 1]), null, 'the encounter bound still refuses an ADDITION');
    assert.equal(calls.n, 0, 'and refuses it before the spawn chain');
    // WabbajackEffect.cs:86-88 destroys one entity and mints one in its
    // place - slot-neutral, and unconditional in the reference. The
    // struck entity is often a WATCHMAN, whose removal frees a slot in
    // the OTHER pool, so without this the strike erased him and stood
    // nothing at all.
    assert.equal(await pool.spawnFoe(0, [1, 0, 1], { replacing: true }), null, 'the stub career aborts the stand');
    assert.equal(calls.n, 1, 'but the transform got past the cap and into the spawn chain');
  } finally { console.error = err; }
});

test('AUDIT 61 F12: all three Wabbajack re-stand sites pass it', () => {
  for (const [h, re] of [
    ['src/scenes/world.js', /exteriorFoes\.spawnFoe\(mobileType, feet, \{ replacing: true \}\)\.then\(stamp\)/],
    ['src/scenes/exterior.js', /exteriorFoes\.spawnFoe\(mobileType, feet, \{ replacing: true \}\)\.then\(stamp\)/],
    ['src/scenes/worldModes.js', /return interiorFoes\.spawnFoe\(mobileType, feet, \{ replacing: true \}\);/],
  ]) assert.match(src(h), re, `${h}: the transform is unconditional, as WabbajackEffect.cs:86-88 is`);
});

// ─────────────────────────────────────────────────────────────────────
// F13 / F14 - SpawnCityGuards' outer gate and its indoor arm
// ─────────────────────────────────────────────────────────────────────

/** cityGuards with every seam stubbed and a spawn path that THROWS, so
 *  "did this arm return early" is observable without ARENA2. */
const guardRig = (flags) => createCityGuards({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: {
    heightAt: () => 0, raycast: () => Infinity,
    raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
  },
  fetchBytes: async () => { throw new Error('SPAWNED'); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 0,
  playerEntity: { level: 1, reflexes: 2, skills: 30, stats: { strength: 50, agility: 50, luck: 50 } },
  audio: null,
  onPlayerHurt: () => {},
  rand: () => 0.9,
  enterExitFlags: () => flags,
});

test('AUDIT 61 F13: underground SpawnCityGuards does nothing - and the ?exterior host can now say so', async () => {
  // PlayerEntity.cs:625 encloses the WHOLE member in
  // `if (!GameManager.Instance.PlayerEnterExit.IsPlayerInsideDungeon && ...)`.
  const under = guardRig({ isPlayerInsideDungeon: true, isPlayerInside: true, insideOpenShop: false, insideTavern: false, insideResidence: false });
  await under.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  assert.equal(under.activeCount(), 0, 'no watch is minted underground');
  // the same call with the flags absent falls all the way to the ring
  // fallback, which is what the ?exterior host used to do in a dungeon
  const flagless = guardRig(null);
  await assert.rejects(
    flagless.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] }),
    /SPAWNED/, 'without the latches the street law runs wherever the player is');
  // so both mode-machine hosts must hand them in (world.js's shape, twice)
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(h);
    assert.match(s, /enterExitFlags: \(\) => \(\{\n\s*isPlayerInsideDungeon: \(modes\?\.mode \?\? 'exterior'\) === 'dungeon',\n\s*isPlayerInside: \(modes\?\.mode \?\? 'exterior'\) !== 'exterior',/,
      `${h}: the dungeon and inside latches`);
    assert.match(s, /insideOpenShop: modes\?\.insideOpenShop \?\? false,/, `${h}: IsPlayerInsideOpenShop`);
    assert.match(s, /insideTavern: modes\?\.insideTavern \?\? false,/, `${h}: IsPlayerInsideTavern`);
    assert.match(s, /insideResidence: modes\?\.insideResidence \?\? false,/, `${h}: IsPlayerInsideResidence`);
  }
});

test('AUDIT 61 F14: a NON-eligible interior is answered INSIDE the building, around the player', async () => {
  // The population is inactive indoors (PlayerEnterExit.cs:1047, and
  // the three `isActiveAndEnabled` continues at PlayerEntity.cs:653,
  // :707, :776), so guardsSpawnedFromNPCs is 0 and :687's
  // CreateFoeSpawner(true, Knight_CityWatch, Random.Range(2, 5+1),
  // 12.8f, 51.2f) rings the watch around the player, parented to the
  // Interior. An empty pool with `eligible:false` IS that arm.
  const temple = guardRig(null);
  await assert.rejects(
    temple.spawnCityGuards(true, {
      playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [],
      interior: { doors: [], origin: [0, 0, 0], eligible: false },
    }),
    /SPAWNED/, 'the ring fallback runs over THIS interior\'s collider');
  // and the witness arm finds nobody, because nobody is active
  const witness = guardRig(null);
  await witness.spawnCityGuards(false, {
    playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [],
    interior: { doors: [], origin: [0, 0, 0], eligible: false },
  });
  assert.equal(witness.activeCount(), 0, 'no crime is seen by an inactive population');
});

test('AUDIT 61 F14: the mode machine takes the call for EVERY interior, and the street pool is empty indoors', () => {
  const wm = src('src/scenes/worldModes.js');
  const fn = wm.slice(wm.indexOf('spawnCityGuardsInside(immediate) {'));
  const body = fn.slice(0, fn.indexOf('\n    },'));
  assert.match(body, /if \(mode !== 'interior' \|\| !interiorCtx \|\| !interiorGuards\) return false;/,
    'a dungeon still falls through, where SpawnCityGuards\' own outer gate refuses it');
  assert.equal(/if \(!eligible\) return false;/.test(body), false,
    'a temple, a guild hall or a palace is NOT handed back to the street');
  assert.match(body, /interior: \{ doors: interiorCtx\.doors, origin: interiorCtx\.parentPt\(0, 0, 0\), eligible \}/,
    'the eligibility rides the interior bag instead of gating the call');
  assert.match(body, /pool: \[\],/, 'the population is inactive indoors');
  assert.ok(body.trimEnd().endsWith('return true;'), 'and the host answers TRUE in both arms');
  // the other half: the street pool itself answers nobody indoors
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(h), /const _guardPool = \(\) => \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \? \[\] : _livePersons\.map/,
      `${h}: DFU's three isActiveAndEnabled continues, at the one place the pool is materialised`);
  }
});

// ─────────────────────────────────────────────────────────────────────
// F15 - CreateFoe's OverlapSphere is over ANY collider
// ─────────────────────────────────────────────────────────────────────

test('AUDIT 61 F15: both of world.js\'s placement arms test the watch too', () => {
  // CreateFoe.cs:319-323 - `Physics.OverlapSphere(testPoint,
  // overlapSphereRadius); if (colliders.Length > 0) return;`. A
  // watchman's capsule is a collider, so the quest arm may not ask the
  // encounter pool alone.
  const w = src('src/scenes/world.js');
  assert.equal((w.match(/isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, \(\) => exteriorFoePool\(\), feet\)/g) ?? []).length, 2,
    'the encounter arm and the quest arm both ask the whole street');
  assert.equal(/exteriorFoes\.foes, feet\)/.test(w), false, 'neither asks the encounter pool alone');
  assert.match(src('src/scenes/exterior.js'), /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, exteriorFoePool, feet\)/,
    'the ?exterior twin already asked it');
});

// ─────────────────────────────────────────────────────────────────────
// F22 - EnemySenses' band pick reads IsPlayerInside
// ─────────────────────────────────────────────────────────────────────

test('AUDIT 61 F22: inside a building a foe two storeys up is NOT spawned in classic', () => {
  // EnemySenses.cs:267 reads PlayerEnterExit.IsPlayerInside - the
  // GENERIC flag (PlayerEnterExit.cs:111-113), true in a building
  // interior - and :269-286 takes classicSpawnDespawnExterior only when
  // it is false. Row 0 (the default ClassicSpawnDistanceType,
  // SetupDemoEnemy.cs:21) is spawn XZ 1024 (25.6m) / Yupper 128 (3.2m).
  assert.equal(CLASSIC_SPAWN_XZ, 25.6);
  assert.equal(CLASSIC_SPAWN_Y_UPPER, 3.2);
  assert.equal(CLASSIC_SPAWN_DESPAWN_EXTERIOR, 102.4);
  // a foe 5m above the player, 3m away in XZ: dist = hypot(3, 5)
  const dist = Math.hypot(3, 5);
  assert.equal(wouldBeSpawnedInClassic(dist, 5, false, 0, true), false,
    'the storey above is outside row 0\'s +3.2m upper band');
  assert.equal(wouldBeSpawnedInClassic(dist, 5, false, 0, false), true,
    'on the exterior band it is "spawned" - the band the interior pools used to wear');
  // and across a large interior, the XZ term alone refuses it (26m is
  // still inside EnemySenses' own 1094-unit ceiling at :262, so the two
  // answers below differ on the BAND and nothing else)
  assert.equal(wouldBeSpawnedInClassic(26, 0, false, 0, true), false, 'XZ 26m > 25.6m');
  assert.equal(wouldBeSpawnedInClassic(26, 0, false, 0, false), true, '...but well inside 102.4m outdoors');
});

test('AUDIT 61 F22: the two INTERIOR mounts declare it; the street pools keep the exterior band', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.equal((wm.match(/^\s*playerInside: true,$/gm) ?? []).length, 2,
    'makeInteriorFoes and makeInteriorGuards both stand inside a building');
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    const s = src(f);
    assert.match(s, /^\s*playerInside = false,$/m, `${f}: the dep exists, defaulting to the street`);
    assert.equal(/playerInside: false,/.test(s), false, `${f}: and the EnemyAI is no longer handed a literal`);
    assert.match(s, /^\s*playerInside,/m, `${f}: the mount's answer reaches the senses`);
  }
});

// ─────────────────────────────────────────────────────────────────────
// F29 - the sky's PlayerEnterExit transition
// ─────────────────────────────────────────────────────────────────────

test('AUDIT 61 F29: a flash in flight is killed at the door, not paid out on the way back', () => {
  // BLBSkybox.cs:1247-1284 (InteriorTransitionEvent): under Thunder the
  // handler stops the listener, stops the coroutine, and does
  // `lightningFlash.StopAllCoroutines(); lightningLight.enabled = false`.
  // Nothing ticks the sky in a modal mode, so without that teardown the
  // routine simply FREEZES and resumes lit on the first frame back
  // outside, from the position the player stood at before entering.
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  const frozen = new LightningFlash(seq([0.1, 0.9, 0.5]));
  assert.equal(frozen.startFlash([95, 30, 195]), true, 'the clap rolls a flash');
  assert.ok(frozen.tick(0.01), 'lit on the entering frame');
  // ... the player steps inside: no ticks at all for the whole visit ...
  assert.ok(frozen.tick(0.01), 'and it is STILL lit on the way back out - the defect');
  // with the transition event's teardown, there is nothing left to pay out
  const closed = new LightningFlash(seq([0.1, 0.9, 0.5]));
  closed.startFlash([95, 30, 195]);
  closed.tick(0.01);
  closed.stopAll();
  assert.equal(closed.tick(0.01), null, 'the door killed the routine and the light with it');
});

test('AUDIT 61 F29: the sky controller carries the door and both hosts latch the edge around modes.frame', () => {
  assert.match(src('src/scenes/shared.js'), /setInside\(inside\) \{ dynamic\?\.setInside\(inside\); \},/,
    'createSkyController publishes the transition door');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(h);
    assert.match(s, /const inside = \(modes\?\.mode \?\? 'exterior'\) !== 'exterior';[\s\S]{0,200}sky\.setInside\(inside\);/,
      `${h}: the same isPlayerInside predicate the guard pool is handed, held as an EDGE`);
    const modal = s.indexOf('if (modes.frame(dt, now)) {');
    const entering = s.indexOf('_skyEnterExit();', modal);
    const closes = s.indexOf('\n    }\n', modal);
    const leaving = s.indexOf('_skyEnterExit();', closes);
    const use = s.indexOf('sky.use(');
    assert.ok(modal > 0 && entering > modal && entering < closes,
      `${h}: the entering edge is read INSIDE the modal block - the mode flips inside modes.frame`);
    assert.ok(leaving > closes && leaving < use,
      `${h}: and the leaving edge on the frame that fell through, before anything ticks or draws the sky`);
  }
});
