// C8 E3c: the player's melee - verbatim reach/gate, swing channels,
// gesture-to-strike, kill path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPON_REACH, DEFAULT_WEAPON_REACH, SPHERE_CAST_RADIUS, SWING_MODS,
  INTERIM_WEAPON, playerMeleeCanHit, PlayerWeapon,
} from '../src/combat/playerWeapon.js';
import { HIT_FRAME_MELEE } from '../src/characters/weaponStates.js';

test('playerWeapon: verbatim reach + hit rule + swing table', () => {
  assert.equal(DEFAULT_WEAPON_REACH, 2.25);        // WeaponManager.cs:35
  assert.equal(SPHERE_CAST_RADIUS, 0.25);          // WeaponManager.cs:51
  assert.equal(WEAPON_REACH, 2.5);
  assert.equal(playerMeleeCanHit(2.5, true, true), true);
  assert.equal(playerMeleeCanHit(2.51, true, true), false);
  assert.equal(playerMeleeCanHit(2.0, false, true), false);   // out of view
  assert.equal(playerMeleeCanHit(2.0, true, false), false);   // LOS blocked
  assert.deepEqual(SWING_MODS.StrikeUp, { damage: -4, toHit: 10 });
  assert.deepEqual(SWING_MODS.StrikeDown, { damage: 4, toHit: -10 });
  assert.deepEqual(SWING_MODS.StrikeDownLeft, { damage: 2, toHit: -5 });
  assert.deepEqual(SWING_MODS.StrikeDownRight, { damage: -2, toHit: 5 });
});

test('playerWeapon: drag gesture starts the mapped strike on the shared machine', () => {
  const w = new PlayerWeapon({});
  // downward drag (screen +y) past threshold on a 1000px dim -> StrikeDown
  // AUDIT 28 W11: the live gate is the SETTING (0.005 shipped); this pin
  // holds the field-default arithmetic, so it passes 0.05 explicitly.
  assert.equal(w.gesture(0, 30, true, 0.016, 1000, { attackThreshold: 0.05 }), null);      // 30/1000 < 0.05
  const strike = w.gesture(0, 30, true, 0.016, 1000, { attackThreshold: 0.05 });           // cumulative 60 -> fires
  assert.equal(strike, 'StrikeDown');
  assert.equal(w.machine.state, 'StrikeDown');
  // release resets tracking
  assert.equal(w.gesture(0, 0, false, 0.016, 1000), null);
});

test('playerWeapon: hit frame kills through the full chain (deterministic)', () => {
  const w = new PlayerWeapon({});
  w.gesture(60, 0, true, 0.016, 1000);              // rightward -> a strike starts
  assert.notEqual(w.machine.state, 'Idle');
  const player = { isPlayer: true, level: 1, skills: 90, armor: 0, stats: { strength: 75, agility: 50, luck: 50 } };
  const foeEntity = { isPlayer: false, careerIndex: 0, health: 3, maxHealth: 3, armor: 0, skills: 10, minMetalToHit: -1, affinity: 'Human', stats: { strength: 50, agility: 50, luck: 50 } };
  const foe = { entity: foeEntity, ai: { feet: [0, 0, 1.5] } };
  // step to the hit frame; resolve with roll 0 (min damage, hit passes vs low dodge)
  let hits = 0;
  for (let i = 0; i < 300 && hits === 0; i++) {
    for (const ev of w.update(1 / 60)) {
      if (ev !== 'hit') continue;
      hits++;
      assert.equal(w.machine.frame, HIT_FRAME_MELEE);
      const res = w.resolveHit([foe], player, () => ({ dist: 1.5, inView: true, losClear: true }), () => 0.0);
      assert.equal(res.length, 1);
      assert.ok(res[0].damage >= 1, `damage ${res[0].damage}`);
    }
  }
  assert.equal(hits, 1);
  // out of reach: no result
  w.machine.state = 'StrikeLeft';
  const far = w.resolveHit([foe], player, () => ({ dist: 3.0, inView: true, losClear: true }), () => 0.0);
  assert.equal(far.length, 0);
  // dead foes are skipped
  foe.dead = true;
  const dead = w.resolveHit([foe], player, () => ({ dist: 1.5, inView: true, losClear: true }), () => 0.0);
  assert.equal(dead.length, 0);
});
