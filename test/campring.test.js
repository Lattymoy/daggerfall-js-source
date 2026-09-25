import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CAMP_CHANCE_ON_CHUNK_LOAD, CAMP_GROUPS_ON_CHUNK_LOAD, MIN_CAMP_SPAWN_DISTANCE, MAX_CAMP_SPAWN_DISTANCE,
  campGroupBearings, campAnchorSpot, rollCampEncountersOnChunkLoad } from '../src/systems/campEncounters.js';

test('CAMP-RING: 50% per chunk, three groups', () => {
  assert.equal(CAMP_CHANCE_ON_CHUNK_LOAD, 0.50);
  assert.equal(CAMP_GROUPS_ON_CHUNK_LOAD, 3);
});

test('CAMP-RING: three bearings - one in front, one to the right, one to the left', () => {
  assert.deepEqual(campGroupBearings(60, 3), [0, 90, 270]);
  assert.deepEqual(campGroupBearings(60, 1), [0]);
  // Unity yaw: forward is (sin, cos); +90 from facing north is east - the right hand
  const feet = [0, 0, 0];
  const at = (bearingDegrees) => campAnchorSpot({ feet, yawRad: 0, fovDegrees: 60, groundAt: () => 0, bearingDegrees, rolls: () => 0.5 });
  const front = at(0), right = at(90), left = at(270);
  assert.ok(front.z > 99 && Math.abs(front.x) < 1, 'ahead');
  assert.ok(right.x > 99 && Math.abs(right.z) < 1, 'to the right (east when facing north)');
  assert.ok(left.x < -99 && Math.abs(left.z) < 1, 'to the left');
});

test('CAMP-RING: a group handed a bearing stands on it, 100-150 m out', () => {
  const feet = [0, 0, 0];
  for (const bearing of campGroupBearings(60, 3)) {
    for (let i = 0; i < 50; i++) {
      const s = campAnchorSpot({ feet, yawRad: 0, fovDegrees: 60, groundAt: () => 0, bearingDegrees: bearing });
      const d = Math.hypot(s.x, s.z);
      assert.ok(d >= MIN_CAMP_SPAWN_DISTANCE - 1e-9 && d <= MAX_CAMP_SPAWN_DISTANCE + 1e-9, `distance ${d}`);
      const deg = ((Math.atan2(s.x, s.z) * 180 / Math.PI) + 360) % 360;
      const diff = Math.abs(((deg - bearing + 540) % 360) - 180);
      assert.ok(diff <= 2 + 1e-9, `bearing ${deg} vs ${bearing}`);
    }
  }
});

test('CAMP-RING: a hit returns up to three independently rolled groups, each with its own bearing', () => {
  const ctx = { climateIndex: 231, playerLevel: 5, gameMinutes: 600, inside: false, inLocationRect: false, preventEnemySpawns: false };
  let hits = 0, groupsSeen = 0;
  for (let i = 0; i < 400; i++) {
    const r = rollCampEncountersOnChunkLoad(ctx, Math.random, { fovDegrees: 60 });
    if (!r) continue;
    hits++; groupsSeen += r.length;
    assert.ok(r.length >= 1 && r.length <= 3);
    const bearings = new Set(r.map((g) => g.bearingDegrees));
    assert.equal(bearings.size, r.length, 'no two groups share a bearing');
    for (const g of r) assert.ok(g.mobileTypes.length >= 2);
  }
  assert.ok(hits > 120 && hits < 280, `about half the chunks: ${hits}/400`);
  assert.ok(groupsSeen / hits > 2.5, 'nearly always all three groups');
  assert.equal(rollCampEncountersOnChunkLoad({ ...ctx, inLocationRect: true }, () => 0), null, 'never in a town');
});

test('CAMP-RIVALS: groups of the same kind never fight each other, different kinds do; campmates never do', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/characters/enemyTargets.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /rivalCamps/, 'no same-kind override');
  assert.match(src, /if \(targetEntity\.team === selfTeam\) continue;/, 'the same kind keeps the truce');
  assert.match(src, /if \(self\.entity\?\.campId != null && targetEntity\.campId === self\.entity\.campId\) continue;/, 'campmates still spared');
});

test('CAMP-SIGHT: a camp member sees 60 m; every other foe keeps DFU\'s 102.4', async () => {
  const { CAMP_SIGHT_RADIUS } = await import('../src/systems/campEncounters.js');
  const { canSeeTarget, SIGHT_RADIUS } = await import('../src/characters/enemyMotor.js');
  assert.equal(CAMP_SIGHT_RADIUS, 60);
  assert.ok(Math.abs(SIGHT_RADIUS - 102.4) < 1e-9, 'the default is untouched');
  const open = { raycast: () => Infinity };
  const see = (d, r) => canSeeTarget(open, [0, 0, 0], 0, 1.8, [0, 0, d], 1.8, null, d, r);
  assert.equal(see(80), true, '80 m: a normal foe sees you');
  assert.equal(see(80, CAMP_SIGHT_RADIUS), false, '80 m: a camp does not');
  assert.equal(see(59, CAMP_SIGHT_RADIUS), true, 'inside 60 m it does');
  const { readFileSync } = await import('node:fs');
  for (const f of ['../src/scenes/world.js', '../src/scenes/exterior.js']) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /if \(f\.ai\) f\.ai\.sightRadius = CAMP_SIGHT_RADIUS;/, `${f}: every camp member gets it`);
  }
});

test('CAMP-SIGHT: wilderness camps see 60 m; every other foe (WoD sites, dungeons, wanderers) keeps 102.4', async () => {
  const { CAMP_SIGHT_RADIUS } = await import('../src/systems/campEncounters.js');
  const { canSeeTarget, SIGHT_RADIUS } = await import('../src/characters/enemyMotor.js');
  const fs = await import('node:fs');
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.equal(CAMP_SIGHT_RADIUS, 60);
  assert.ok(Math.abs(SIGHT_RADIUS - 102.4) < 1e-9, 'the default is untouched');
  const open = { raycast: () => Infinity };
  const at = (d, r) => canSeeTarget(open, [0, 0, 0], 0, 1.8, [0, 0, d], 1.8, null, d, r);
  assert.equal(at(59, CAMP_SIGHT_RADIUS), true);
  assert.equal(at(61, CAMP_SIGHT_RADIUS), false, 'a camp does not see past 60 m');
  assert.equal(at(90, undefined), true, 'anyone else still sees 90 m');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    assert.equal((src.match(/\.sightRadius = CAMP_SIGHT_RADIUS/g) ?? []).length, 1, `${f}: set once, in the camp stand only`);
    const si = src.indexOf('const _standCampEncounter = (hit, feet) => {');
    assert.ok(src.slice(si, src.indexOf('\n  };', si)).includes('f.ai.sightRadius = CAMP_SIGHT_RADIUS'), `${f}: inside _standCampEncounter`);
  }
  assert.doesNotMatch(read('src/world/wodSpawner.js'), /sightRadius/, 'the WoD location spawner is untouched');
});

test('CAMP-TRAVEL: no camp rolls while a Travel Options journey is running', async () => {
  const fs = await import('node:fs');
  const w = fs.readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const ci = w.indexOf('stream: entered ${r.current.x}');
  const chunk = w.slice(ci, w.indexOf('\n    pump();', ci));
  assert.match(chunk, /!playerEntity\.isResting && !travelOptions\?\.isTravelActive && getPref\('wildernessCamps'\) !== false/, 'the chunk roll stands down during a journey');
  const to = fs.readFileSync(new URL('../src/systems/travelOptions.js', import.meta.url), 'utf8');
  assert.match(to, /get isTravelActive\(\) \{ return !!ui\?\.isShowing; \},/, 'the journey is the travel panel being up');
});
