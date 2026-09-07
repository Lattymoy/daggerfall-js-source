// ROAD-H TAIL (2026-09-07) - the three items Wave H's missiles lane
// recorded and left: the enemy shaft's contact with the player is the
// player's CAPSULE (DaggerfallMissile.cs:339's SphereCast into the
// CharacterController), not a point 0.9 up; the flight raycast reaches
// `displacement.magnitude + ColliderRadius` (:332-336) along the
// normalised direction, so a crouch-dipped, non-unit direction (:583-585)
// lengthens the reach with it; and the dungeon archer takes BowDamage's
// two-arm split (EnemyAttack.cs:136-143) - it aims at its SELECTED target
// and the missile remembers that foe, as the exterior pool's has since
// MT-ii. Every pin here dies under the mutation that reverts its law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { MISSILE_SPEED, MISSILE_COLLIDER_RADIUS, missileReach, missileHitsCapsule } from '../src/systems/spellcast.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const open = (raycast = () => Infinity) => new ArrowFlight({ getGpuMesh: () => null, collider: { raycast, heightAt: () => -100 } });

test('ROAD-H tail: an enemy shaft meets the player CAPSULE at its LIVE height - a crouched player is a shorter target', () => {
  // The old law tested a point at feet + 0.9 against 0.45 + 0.45: a shaft
  // flying at y = 1.6 over a CROUCHED player (0.9 controller,
  // PlayerHeightChanger.cs:54-57) was 0.7 from that point and HIT. The
  // capsule of height 0.9 collapses to a sphere at feet + 0.45
  // (min(r, h/2)); the shaft is 1.15 from it - a MISS in DFU.
  const crouched = open();
  const hits = [];
  crouched.fire([0, 1.6, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) crouched.update(0.05, { playerFeet: [0, 0, 5], playerHeight: 0.9, onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 0, 'over a crouched player the shaft sails through (the capsule is 0.9 tall)');
  // the same shaft at a STANDING player (1.8): the axis runs 0.45..1.35,
  // the shaft at 1.6 is 0.25 from its top - a hit
  const standing = open();
  standing.fire([0, 1.6, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) standing.update(0.05, { playerFeet: [0, 0, 5], playerHeight: 1.8, onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 1, 'at a standing player the same shaft lands');
  // and the default height is the standing capsule (the bare callers)
  const bare = open();
  bare.fire([0, 1.6, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) bare.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 2, 'no playerHeight given: the standing 1.8 capsule');
});

test('ROAD-H tail: a shaft meets a FOE at its capsule, not at its centre - a tall foe is hit near its head', () => {
  // A 3.2 sprite (a giant) has its capsule centre at 1.6; the old law
  // MISSED a shaft at y = 2.9 (1.3 from the centre). DFU's SphereCast
  // meets the capsule's inner axis, which tops out at 3.2 - 0.45 = 2.75:
  // the shaft is 0.15 from it - a hit.
  const f = open();
  const landed = [];
  const giant = { ai: { feet: [0, 0, 5], height: 3.2 }, dead: false };
  f.fire([0, 2.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 9 }, weapon: {} });
  for (let i = 0; i < 4; i++) f.update(0.05, { foeTargets: [{ feet: giant.ai.feet, ref: giant }], onFoeHit: (m, t) => landed.push(t) });
  assert.equal(landed.length, 1, 'the giant is struck near its head');
  assert.equal(landed[0], giant);
  // a RAT (1.0) under the same shaft: axis 0.45..0.55, the shaft 2.35 up - nothing
  const r = open();
  const rat = { ai: { feet: [0, 0, 5], height: 1.0 }, dead: false };
  r.fire([0, 2.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 9 }, weapon: {} });
  for (let i = 0; i < 4; i++) r.update(0.05, { foeTargets: [{ feet: rat.ai.feet, ref: rat }], onFoeHit: (m, t) => landed.push(t) });
  assert.equal(landed.length, 1, 'and sails over a rat');
  // the one body: the flight's test IS spellcast's capsule test
  assert.equal(missileHitsCapsule([0, 2.9, 5], [0, 0, 5], 3.2), true);
  assert.equal(missileHitsCapsule([0, 2.9, 5], [0, 0, 5], 1.0), false);
});

test('ROAD-H tail: the flight reach is displacement.magnitude + ColliderRadius along the NORMALISED direction', () => {
  // DaggerfallMissile.cs:332-336 - `displacement = direction * MovementSpeed
  // * fixedDeltaTime`, cast for `displacement.magnitude + ColliderRadius`
  // along `direction` (which Physics normalises). A crouch-dipped
  // direction (:583-585, +down*0.05 after the normalise) has magnitude
  // sqrt(1 + 0.0025); the reach grows with it and the ray is unit.
  const dt = 0.05, step = MISSILE_SPEED * dt;
  const dipped = [0, -0.05, 1];
  const len = Math.hypot(0, -0.05, 1);
  const { unit, reach } = missileReach(dipped, step);
  assert.ok(Math.abs(reach - (step * len + MISSILE_COLLIDER_RADIUS)) < 1e-12, 'the reach carries |dir|');
  assert.ok(Math.abs(Math.hypot(...unit) - 1) < 1e-12, 'the ray is unit');
  assert.ok(Math.abs(unit[1] * len - dipped[1]) < 1e-12, 'and points where the dipped direction points');
  // a unit direction is handed back untouched (no allocation, no drift)
  const u = [0, 0, 1];
  assert.equal(missileReach(u, step).unit, u);
  assert.equal(missileReach(u, step).reach, step + MISSILE_COLLIDER_RADIUS);
  // and the three flights ask the collider for exactly that
  const asked = [];
  const a = open((pos, dir, max) => { asked.push({ dir: [...dir], max }); return Infinity; });
  a.fire([0, 1, 0], dipped, { enemy: true, shooterFoe: { id: 2 }, weapon: {} });
  a.update(dt, {});
  assert.equal(asked.length, 1);
  assert.ok(Math.abs(asked[0].max - reach) < 1e-12, 'arrowFlight casts for the scaled reach');
  assert.ok(Math.abs(Math.hypot(...asked[0].dir) - 1) < 1e-12, 'with a unit ray');
  // the position still advances by dir * step - the full, dipped vector (:293)
  assert.ok(Math.abs(a.arrows[0].pos[1] - (1 - 0.05 * step)) < 1e-12, 'the dip is flown, not renormalised away');
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/hostMagic.js']) {
    const s = src(f);
    assert.match(s, /const \{ unit: _unit, reach \} = missileReach\(m\.dir, step\);\s*\/\/[^\n]*\n\s+const hitWall = collider\.raycast\(m\.pos, _unit, reach\);\n\s+if \(Number\.isFinite\(hitWall\) && hitWall <= reach\) \{/,
      `${f}: the missile flight casts for the scaled reach along the unit ray`);
    assert.doesNotMatch(s, /raycast\(m\.pos, m\.dir, step \+ MISSILE_COLLIDER_RADIUS\)/, `${f}: no flight casts the bare step`);
  }
});

test('ROAD-H tail: the dungeon archer takes BowDamage\'s two-arm split - the shaft flies at the SELECTED target and the missile remembers a foe target', () => {
  const d = src('src/scenes/dungeonContext.js');
  // EnemyAttack.cs:136-137 - BowDamage returns at `senses.Target == null`:
  // the arm is gated on the live target, the shape the melee arm and the
  // exterior pool already carry.
  assert.match(d, /else if \(_tgt && !_fParalyzed && f\.mobile\.shootArrow\) \{/, 'gated on the live target');
  assert.doesNotMatch(d, /else if \(playerFeet && !_fParalyzed && f\.mobile\.shootArrow\) \{/, 'no longer on the player alone');
  // :139-143 - the player arm or the non-player arm, by the selected target
  assert.match(d, /const _at = f\.ai\.target \?\? foeDeps\.PLAYER_TARGET, _atPlayer = foeDeps\.isPlayerTarget\(_at\);/, 'the target is read');
  assert.match(d, /const aim = foeDeps\.targetAimPoint\(_at, _pf, playerHeight\);/, 'the aim point is the target\'s transform through the one law');
  assert.match(d, /arrowAimDirection\(foeDeps\.enemyTransformPoint\(f\.ai\), aim, \{ targetIsPlayer: _atPlayer, playerCrouching: !!_senses\.playerCrouching \}\)/,
    'the crouch dip keys on WHO the target is (DaggerfallMissile.cs:584), not on a constant');
  assert.match(d, /fireArrow\(from, dir, f\.entity\.weapon, false, f, _atPlayer \? null : _at\);/, 'a foe target rides the missile');
  assert.match(d, /function fireArrow\(from, dir, weapon, fromPlayer, shooterFoe = null, aimFoe = null\)/, 'fireArrow carries aimFoe');
  assert.match(d, /missiles\.push\(\{ arrow: true, weapon, fromPlayer, shooterFoe, aimFoe, pos:/, 'and stores it, so the impact fork\'s `m.aimFoe` arm (BowDamage\'s non-player arm) can run for an arrow');
  // the exterior pool's arm is the model - it reads the same law
  const x = src('src/scenes/exteriorFoes.js');
  assert.match(x, /const aim = _targetAim\(f, playerFeet, senses\.playerHeight \?\? CAPSULE_HEIGHT\);/);
});
