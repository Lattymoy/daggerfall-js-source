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

function makeDeps(rand) {
  return {
    renderer: { createBillboardBatch: () => ({}), textures: new Map() },
    collider: { heightAt: () => 0, raycast: () => Infinity },
    fetchBytes: async (name) => new Uint8Array(readFileSync(join(ARENA2, name))),
    getTexture: async () => ({
      getFrameCount: () => 4,
      getSize: () => ({ width: 64, height: 100 }),
      getScale: () => ({ width: 0, height: 0 }),
    }),
    uploadRecordFrame: () => {},
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
