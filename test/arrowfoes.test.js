// AR1 - THE ARROW'S IMPACT LEARNS THE FOES (2026-08-28). MT-ii gave
// enemy archers infighting TARGET SELECTION and admitted, FLAGGED,
// that the impact still only knew the player - an arrow loosed at
// another foe flew true and landed nothing. The flight module tests
// every live foe but the SHOOTER now, and the landing runs BowDamage's
// non-player arm (EnemyAttack.cs:134-148 with :303's bowAttack=true)
// through the same applyDamageToNonPlayer payload the melee foe arm
// rides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { MISSILE_COLLIDER_RADIUS } from '../src/systems/spellcast.js';

const read = (p) => readFileSync(p, 'utf8');

const flight = () => new ArrowFlight({ getGpuMesh: () => null, collider: null });

test('AR1: an enemy arrow contacts a foe capsule and the hit hands over arrow AND target', () => {
  const f = flight();
  const shooter = { id: 'archer' };
  const bear = { id: 'bear', dead: false };
  f.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: shooter, weapon: { name: 'Short Bow' } });
  const hits = [];
  // one 0.05s step is 1.25 units; the bear at z=1.5 sits inside the
  // capsule sum from the post-step position (the contact is tested
  // AFTER the move, the player arm's own shape - no capsule sweep)
  f.update(0.05, {
    foeTargets: [{ feet: [0, 0, 1.5], ref: bear }],
    onFoeHit: (m, t) => hits.push([m.weapon.name, t.id]),
  });
  assert.deepEqual(hits, [['Short Bow', 'bear']]);
  assert.equal(f.arrows[0].dead, true, 'the landed arrow is spent');
});

test('AR1: the SHOOTER is excluded and a dead foe is no target', () => {
  const f = flight();
  const shooter = { id: 'archer' };
  f.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: shooter, weapon: {} });
  const hits = [];
  f.update(0.05, {
    // both stand INSIDE contact range on the release frame
    foeTargets: [
      { feet: [0, 0, 0.5], ref: shooter },
      { feet: [0, 0, 0.5], ref: { id: 'corpse', dead: true } },
    ],
    onFoeHit: (m, t) => hits.push(t.id),
  });
  assert.deepEqual(hits, [], 'an archer must not feather itself, nor a corpse');
  assert.equal(f.arrows[0].dead, false, 'the shaft flies on');
});

test('AR1: the player capsule is tested FIRST when both overlap', () => {
  const f = flight();
  f.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 'a' }, weapon: {} });
  const log = [];
  f.update(0.05, {
    playerFeet: [0, 0, 0.5],
    onPlayerHit: () => log.push('player'),
    foeTargets: [{ feet: [0, 0, 0.5], ref: { id: 'bear' } }],
    onFoeHit: (m, t) => log.push(t.id),
  });
  assert.deepEqual(log, ['player'], 'one arrow, one landing - the player arm keeps its precedence');
});

test('AR1: a PLAYER arrow ignores the foe list - its foe impacts resolve at the fire host', () => {
  const f = flight();
  f.fire([0, 0.9, 0], [0, 0, 1], {});   // no enemy marker: the player's shaft
  const hits = [];
  f.update(0.05, { foeTargets: [{ feet: [0, 0, 0.5], ref: { id: 'bear' } }], onFoeHit: (m, t) => hits.push(t.id) });
  assert.deepEqual(hits, [], 'the visible-flight-only law stands for player arrows');
});

test('AR1: the contact radius is the missile law - radius + the 0.45 body', () => {
  const mk = (z) => {
    const f = flight();
    f.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: {}, weapon: {} });
    let hit = false;
    // dt tiny: the step is ~0.025, so contact is decided by the radius
    f.update(0.001, { foeTargets: [{ feet: [0, 0, z], ref: { id: 'x' } }], onFoeHit: () => { hit = true; } });
    return hit;
  };
  assert.equal(mk(MISSILE_COLLIDER_RADIUS + 0.45 + 0.2), false, 'outside the capsule sum');
  assert.equal(mk(MISSILE_COLLIDER_RADIUS + 0.45 - 0.1), true, 'inside it');
});

// ── the mounts, source-pinned ────────────────────────────────────

test('AR1: exteriorFoes lands the hit on BowDamage\'s own payload', () => {
  const src = read('src/scenes/exteriorFoes.js');
  const from = src.indexOf('function arrowHitFoe(m, target) {');
  assert.ok(from > 0);
  const body = src.slice(from, from + 800);
  assert.match(body, /weapon: m\.weapon, direction: dir, bowAttack: true/,
    ':303 with bowAttack=true - the melee arm passes false by omission');
  assert.match(body, /dealDamage: \(t, d\) => \(t\.hurtFromFoe \? t\.hurtFromFoe\(d, dir\) : damageFoe\(t, d, null, dir\)\)/,
    'the target\'s own pool owns its death chain - the melee arm\'s exact split');
  assert.match(body, /addItem\(target\.entity\.items, \{ group: 'Weapons', name: 'Arrow', templateIndex: 131/,
    ':146-148 - the arrow recoverable from the TARGET, damage or not');
  assert.ok(!/FLAGGED: the arrow's IMPACT still only knows the player/.test(src),
    'retiring a flag deletes the sentence');
});

test('AR1: the world wires both pools in, shooter exclusion left to the flight module', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /foeTargets: \[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards\]\s*\n\s*\.filter\(\(t\) => !t\.dead && t\.ai\)\.map\(\(t\) => \(\{ feet: t\.ai\.feet, ref: t \}\)\),/,
    'encounter foes AND the watch are candidates');
  assert.match(world, /onFoeHit: \(m, t\) => exteriorFoes\.arrowHitFoe\(m, t\),/);
});
