// G1: city guards (PlayerEntity.SpawnCityGuards / SpawnCityGuard,
// verbatim) - the spawn law over real CLASS18.CFG data with faked
// renderer/collider seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createCityGuards, GUARD_MOBILE_TYPE, MAX_ACTIVE_GUARD_SPAWNS,
  GUARD_NPC_SPAWN_RANGE, GUARD_BEHIND_ANGLE,
} from '../src/scenes/cityGuards.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

/** The batch-free counter every makeDeps hands its stub renderer. */
const destroyed = { n: 0 };

function makeDeps(rand) {
  destroyed.n = 0;
  return {
    // AUDIT 24 (wave 6, EVERY ALLOCATION HAS AN OWNER): a released
    // guard frees its billboard batch. The stub predated that call and
    // threw when it landed - and because this file is ARENA2-gated, CI
    // never saw it. Counted rather than swallowed, so the pin proves
    // the free HAPPENS instead of merely tolerating it.
    renderer: {
      createBillboardBatch: () => ({}),
      destroyBillboardBatch: () => { destroyed.n++; },
      textures: new Map(),
    },
    collider: { heightAt: () => 0, raycast: () => Infinity },
    fetchBytes: async (name) => new Uint8Array(readFileSync(join(ARENA2, name))),
    getTexture: async () => ({
      getFrameCount: () => 4,
      getSize: () => ({ width: 64, height: 100 }),
      getScale: () => ({ width: 0, height: 0 }),
    }),
    uploadRecordFrame: () => {},
    currentMinute: () => 523530,   // AUDIT 23 (hosts-3): the clock is REQUIRED now
    playerEntity: { level: 1, reflexes: 2, skills: 30, stats: { strength: 50, agility: 50, luck: 50 } },
    audio: null,
    onPlayerHurt: () => {},
    rand,
  };
}

test('guards: constants + immediate spawn converts the guard NPC first and disables it', { skip: skipReal }, async () => {
  assert.equal(GUARD_MOBILE_TYPE, 146);
  assert.equal(MAX_ACTIVE_GUARD_SPAWNS, 5);
  assert.equal(GUARD_NPC_SPAWN_RANGE, 77.5);
  assert.ok(Math.abs(GUARD_BEHIND_ANGLE - 105.469) < 1e-6);
  const g = createCityGuards(makeDeps(() => 0.9));
  let disabled = 0;
  const pool = [
    { pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => disabled++ },
    { pos: [200, 0, 200], fwdYaw: 0, guard: true, disable: () => disabled++ },   // out of the 77.5 range
  ];
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool });
  assert.equal(g.activeCount(), 1, 'the in-range wandering guard converted');
  assert.equal(disabled, 1, 'classic disables the source NPC');
  const dbg = g._debug();
  assert.ok(dbg[0].hp > 0, 'a live Knight_CityWatch entity from CLASS18.CFG');
});

test('guards audit pin: the seen-by-guard MASS conversion quirk (verbatim)', { skip: skipReal }, async () => {
  // DFU's non-immediate loop: once ANY guard NPC has seen the crime,
  // EVERY REMAINING pool NPC converts (in range or not, guard or
  // not) - the `if (seenByGuard)` sits outside the range/LOS gate.
  const g = createCityGuards(makeDeps(() => 0.9));
  let disabled = 0;
  const pool = [
    { pos: [0, 0, 500], fwdYaw: 0, guard: false, disable: () => disabled++ },   // BEFORE the seer: untouched
    { pos: [0, 0, 10], fwdYaw: Math.PI, guard: true, disable: () => disabled++ },  // faces the player, sees
    { pos: [0, 0, 900], fwdYaw: 0, guard: false, disable: () => disabled++ },   // far civilian: converts anyway
  ];
  await g.spawnCityGuards(false, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool });
  assert.equal(g.activeCount(), 2, 'the seer AND every subsequent NPC convert');
  assert.equal(disabled, 2, 'the pre-seer civilian is untouched');
});

test('guards G3: killed guards are loot targets, walk-aways are not, loot takes once', { skip: skipReal }, async () => {
  const deps = makeDeps(() => 0.9);
  const g = createCityGuards(deps);
  const pool = () => [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }];
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool() });
  g.guards[0].entity.items = [{ name: 'Gold', group: 'Currency', stackCount: 5 }];
  // crimeCommitted is falsy -> the stand-down law marks the guard dead
  // WITHOUT a corpse (they walk away) - never a loot target
  g.update(0, [0, 0, 0], [0, 1.7, 0]);
  assert.ok(g.guards[0].dead && !g.guards[0].corpse);
  // AUDIT 24 wave 6's law, now observable: the walk-away RELEASES its
  // billboard batch. Silently stubbing the free would have let a leak
  // pass here, which is how this file came to throw on it at all.
  assert.equal(destroyed.n, 1, 'the released guard frees its batch');
  assert.equal(g.lootTargets().length, 0, 'walk-aways vanish with their items');
  // a KILLED guard leaves a lootable corpse through the real death path
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool() });
  g.guards[1].entity.items = [
    { name: 'Gold', group: 'Currency', stackCount: 7 },
    { name: 'Longsword', group: 'Weapons' },
  ];
  g._damage(1, 9999);
  assert.ok(g.guards[1].dead && g.guards[1].corpse);
  const targets = g.lootTargets();
  assert.equal(targets.length, 1);
  assert.equal(targets[0].key, 'guardCorpse:1');
  let said = null;
  assert.equal(g.takeLoot('guardCorpse:1', (l) => { said = l; }), 2);
  assert.equal(said, 'You take 2 items.');
  assert.ok(deps.playerEntity.items.some((it) => it.group === 'Currency' && it.stackCount === 7));
  assert.equal(g.takeLoot('guardCorpse:1'), 0, 'a looted corpse is empty');
  assert.equal(g.lootTargets().length, 0);
});

test('guards G4: civilian strike = one-hit Murder; wandering guard = Assault + conversion; guard kill = Murder', { skip: skipReal }, async () => {
  const deps = makeDeps(() => 0.9);
  const g = createCityGuards(deps);
  let disabled = 0, murder = 0;
  const fakeWeapon = { resolveHit: () => [] };
  const eye = [0, 1.7, 0], fwd = [0, 0, 1], feet = [0, 0, 0];
  // A CIVILIAN in weapon reach dies to ONE hit: disabled + Murder + the response
  const civ = () => ({ pos: [0, 0, 1.5], fwdYaw: 0, guard: false, disable: () => disabled++ });
  const r1 = await g.resolveCivilianHit(fakeWeapon, eye, fwd, feet, [civ()], { onMurder: () => murder++ });
  assert.deepEqual(r1, { crime: 'murder' });
  assert.equal(disabled, 1);
  assert.equal(murder, 1, 'SpawnCityGuards(true) fired');
  assert.equal(deps.playerEntity.crimeCommitted, 5, 'Crimes.Murder');
  // Out of reach: no strike, no crime
  deps.playerEntity.crimeCommitted = 0;
  assert.equal(await g.resolveCivilianHit(fakeWeapon, eye, fwd, feet,
    [{ pos: [0, 0, 5], fwdYaw: 0, guard: false, disable: () => disabled++ }], {}), false);
  assert.equal(deps.playerEntity.crimeCommitted, 0);
  // A wall strictly in front blocks the strike
  const gWall = createCityGuards({ ...deps, collider: { heightAt: () => 0, raycast: () => 0.5 } });
  assert.equal(await gWall.resolveCivilianHit(fakeWeapon, eye, fwd, feet, [civ()], {}), false);
  // A wandering GUARD NPC: Assault + on-the-spot conversion, the
  // swing carried onto the fresh foe (DFU re-points the hit)
  let carried = 0;
  const carryWeapon = { resolveHit: () => { carried++; return []; } };
  const r2 = await g.resolveCivilianHit(carryWeapon, eye, fwd, feet,
    [{ pos: [0, 0, 1.5], fwdYaw: 0, guard: true, disable: () => disabled++ }], {});
  assert.equal(r2.crime, 'assault');
  assert.equal(deps.playerEntity.crimeCommitted, 4, 'Crimes.Assault');
  assert.equal(g.activeCount(), 1, 'converted to a live foe');
  assert.equal(carried, 1, 'the swing resolved against the fresh guard');
  // Killing the watch through the real death path IS Murder
  g._damage(0, 9999);
  assert.equal(deps.playerEntity.crimeCommitted, 5);
});

test('guards: behind-player civilians convert at 1/4; none seen -> the 2-5 ring fallback', { skip: skipReal }, async () => {
  // Civilian BEHIND the player (angle >= 105.469 from fwd +z), the
  // 1/4 roll passes (floor(0*4) === 0).
  const g1 = createCityGuards(makeDeps(seq(0.0, 0.9, 0.9, 0.9)));
  const pool1 = [{ pos: [0, 0, -10], fwdYaw: 0, guard: false, disable: () => {} }];
  await g1.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool1 });
  assert.equal(g1.activeCount(), 1, 'the behind civilian converted on the 1/4');
  // A civilian IN FRONT never converts; the ring fallback spawns
  // 2 + floor(rand*4) guards instead.
  const g2 = createCityGuards(makeDeps(() => 0.5));   // count = 2 + 2 = 4
  const pool2 = [{ pos: [0, 0, 10], fwdYaw: 0, guard: false, disable: () => {} }];
  await g2.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool2 });
  assert.equal(g2.activeCount(), 4, 'the foe-spawner ring: 2 + floor(0.5*4)');
  // The max-active gate: 4 active <= 5 allows one more call; push to
  // 8 (4 + ring 4), then the NEXT call refuses (8 > 5).
  await g2.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  assert.equal(g2.activeCount(), 8);
  await g2.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  assert.equal(g2.activeCount(), 8, 'over maxActiveGuardSpawns nothing spawns');
});
