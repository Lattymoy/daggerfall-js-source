// ROAD-H TAIL (2026-09-07) - the three items Wave H's missiles lane
// recorded and left: the enemy shaft's contact with the player is the
// player's CAPSULE (DaggerfallMissile.cs:339's SphereCast into the
// CharacterController), not a point 0.9 up; the flight raycast reaches
// `displacement.magnitude + ColliderRadius` (:333 builds it, :337-339
// cast it) along the
// normalised direction, so a crouch-dipped, non-unit direction (:583-585)
// lengthens the reach with it; and the dungeon archer takes BowDamage's
// two-arm split (EnemyAttack.cs:136-143) - it aims at its SELECTED target
// and the missile remembers that foe, as the exterior pool's has since
// MT-ii. Every pin here dies under the mutation that reverts its law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { MISSILE_SPEED, MISSILE_COLLIDER_RADIUS, BODY_CAPSULE_RADIUS, PLAYER_BODY_RADIUS, missileReach, missileHitsCapsule } from '../src/systems/spellcast.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const open = (raycast = () => Infinity) => new ArrowFlight({ getGpuMesh: () => null, collider: { raycast, heightAt: () => -100 } });

test('ROAD-H tail: an enemy shaft meets the player CAPSULE at its LIVE height - a crouched player is a shorter target', () => {
  // The old law tested a point at feet + 0.9 against 0.45 + 0.45: a shaft
  // flying at y = 1.6 over a CROUCHED player (0.9 controller,
  // PlayerHeightChanger.cs:54-57) was 0.7 from that point and HIT. The
  // capsule of height 0.9 has its axis inset by the PLAYER's own radius
  // (AUDIT 65 CV-2: 0.35, PlayerAdvanced.prefab:82), so it runs
  // feet+0.35..feet+0.55 and the shaft is 1.05 above its crown against a
  // 0.45 + 0.35 reach - a MISS in DFU.
  const crouched = open();
  const hits = [];
  crouched.fire([0, 1.6, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) crouched.update(0.05, { playerFeet: [0, 0, 5], playerHeight: 0.9, onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 0, 'over a crouched player the shaft sails through (the capsule is 0.9 tall)');
  // the same shaft at a STANDING player (1.8): the axis runs 0.35..1.45,
  // the shaft at 1.6 is 0.15 from its top - a hit
  const standing = open();
  standing.fire([0, 1.6, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) standing.update(0.05, { playerFeet: [0, 0, 5], playerHeight: 1.8, onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 1, 'at a standing player the same shaft lands');
  // ...and the default height is the standing capsule for the bare
  // callers. REVIEW: a shaft at 1.6 only proves "tall enough to be
  // hit" - every default from about 1.6 up passes it, so it restated
  // the hit rather than pinning CAPSULE_HEIGHT's value. The default is
  // BRACKETED instead, at the exact height where a 1.8 capsule's reach
  // ends: the axis tops out at `h - r` and the contact band is
  // `MISSILE_COLLIDER_RADIUS + PLAYER_BODY_RADIUS`, so 1.8 reaches
  // 2.2500 and not a micron further. A shaft a tenth of a millimetre
  // UNDER that lands and one a tenth OVER it sails - which no other
  // default satisfies, in either direction.
  assert.equal(CAPSULE_HEIGHT, 1.8, 'the standing controller (PlayerMotor.controller.height)');
  const rim = CAPSULE_HEIGHT - PLAYER_BODY_RADIUS + MISSILE_COLLIDER_RADIUS + PLAYER_BODY_RADIUS;   // 2.25 - AUDIT 65 CV-2: the r cancels, but it is the PLAYER's r that does
  const bare = open();
  bare.fire([0, rim - 1e-4, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) bare.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 2, 'no playerHeight given: the standing capsule reaches the rim');
  const over = open();
  over.fire([0, rim + 1e-4, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
  for (let i = 0; i < 4; i++) over.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: (m) => hits.push(m) });
  assert.equal(hits.length, 2, '...and not past it - the default is 1.8 itself, not merely "tall enough"');
});

test('ROAD-H tail: a shaft meets a FOE at its capsule, not at its centre - a tall foe is hit near its head', () => {
  // A 3.2 sprite (a giant) has its capsule centre at 1.6; the old law
  // MISSED a shaft at y = 2.9 (1.3 from the centre). DFU's SphereCast
  // meets the capsule's inner axis, which tops out at 3.2 - 0.45 = 2.75:
  // the shaft is 0.15 from it - a hit.
  const f = open();
  const landed = [];
  const giant = { ai: { feet: [0, 0, 5], height: 3.2 }, dead: false };
  f.fire([0, 2.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 9 }, weapon: {}, aimFoe: giant });   // loosed AT the giant (the :669 gate, below)
  for (let i = 0; i < 4; i++) f.update(0.05, { foeTargets: [{ feet: giant.ai.feet, ref: giant }], onFoeHit: (m, t) => landed.push(t) });
  assert.equal(landed.length, 1, 'the giant is struck near its head');
  assert.equal(landed[0], giant);
  // a RAT (1.0) under the same shaft: axis 0.45..0.55, the shaft 2.35 up - nothing
  const r = open();
  const rat = { ai: { feet: [0, 0, 5], height: 1.0 }, dead: false };
  r.fire([0, 2.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 9 }, weapon: {}, aimFoe: rat });
  for (let i = 0; i < 4; i++) r.update(0.05, { foeTargets: [{ feet: rat.ai.feet, ref: rat }], onFoeHit: (m, t) => landed.push(t) });
  assert.equal(landed.length, 1, 'and sails over a rat');
  // the one body: the flight's test IS spellcast's capsule test
  assert.equal(missileHitsCapsule([0, 2.9, 5], [0, 0, 5], 3.2), true);
  assert.equal(missileHitsCapsule([0, 2.9, 5], [0, 0, 5], 1.0), false);
});

test('ROAD-H tail: the flight reach is displacement.magnitude + ColliderRadius along the NORMALISED direction', () => {
  // DaggerfallMissile.cs:333/:337-339 - `displacement = direction * MovementSpeed
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
    // REVIEW: ...and the WALL POINT is measured along the vector the
    // ray was actually cast along. The collider answers in its ray's
    // own parameter units (player/collider.js's rayTriangle returns
    // Moller-Trumbore's t for P = O + t*d, and the DDA's `walked` is
    // the same parameter), so once the ray became `_unit` the distance
    // became a WORLD distance - `m.pos + m.dir * hitWall` then
    // overshot the wall by a factor of |dir|. DFU stops the missile at
    // `direction.normalized * hitInfo.distance` (:347).
    assert.match(s, /const impact = \[m\.pos\[0\] \+ _unit\[0\] \* hitWall, m\.pos\[1\] \+ _unit\[1\] \* hitWall, m\.pos\[2\] \+ _unit\[2\] \* hitWall\]/,
      `${f}: the impact point rides the UNIT ray the collider was given`);
    assert.doesNotMatch(s, /const impact = \[m\.pos\[0\] \+ m\.dir\[0\] \* hitWall/,
      `${f}: and is not scaled a second time by |dir|`);
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

// ───────────────────────────────────────────────────────────────────
// ROAD-H TAIL, THE REVIEW ROUND (2026-09-07)
//
// Four things the round's own pins did not hold: the THIRD ArrowFlight
// host never got the live height at all; the host wiring of that height
// was unpinned in the two that did; two of the four converted contact
// sites had no pin of any kind; and the dungeon's enemy shaft, once it
// could carry a foe target, became transparent to the player.
// ───────────────────────────────────────────────────────────────────

test('ROAD-H tail (review): ALL THREE ArrowFlight hosts feed the player\'s LIVE height beside its feet', () => {
  // THE FOUR-HOSTS RULE. `ArrowFlight.update` is mounted by three
  // hosts and the round wired `playerHeight` into two of them, so a
  // CROUCHING player inside a building was still a 1.8 target - the
  // very divergence the round says it closed, left standing in the
  // interior host. The flight's arithmetic was pinned; its PRODUCERS
  // were not, so deleting or constant-folding either of the two that
  // had it was green. Both halves are held here.
  for (const [f, name] of [
    ['src/scenes/world.js', 'arrows'],
    ['src/scenes/exterior.js', 'arrows'],
    ['src/scenes/worldModes.js', 'interiorArrows'],
  ]) {
    const s = src(f);
    const at = s.indexOf(`${name}.update(dt, {`);
    assert.notEqual(at, -1, `${f}: ${name}.update is no longer the flight's tick`);
    assert.match(s.slice(at, at + 400), /playerFeet: [^\n]*\n\s*playerHeight: player\.height,/,
      `${f}: the flight is handed the LIVE capsule (player.height), not the standing constant`);
  }
});

test('ROAD-H tail (review): the player\'s OWN spell missile meets a foe at its CAPSULE, and the dungeon\'s shaft reads the same one law', () => {
  // Of the four sites the round moved onto missileHitsCapsule /
  // missileHitsFoe, only the shared flight's two were pinned by
  // behaviour: the player's shaft against a foe (dungeonContext) and
  // the player's spell against a foe (hostMagic) could both be reverted
  // in place to the pre-round capsule-CENTRE point and the suite stayed
  // green. The spell one is driven for real here.
  const player = {
    isPlayer: true, level: 1, health: 50, maxHealth: 50, magicka: 500, maxMagicka: 500,
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
    stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
  };
  const mkFoe = (height) => ({
    dead: false, ai: { feet: [0, 0, 5], height },
    entity: {
      level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0,
      skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [],
    },
  });
  const rig = (foe) => {
    const hurt = { n: 0 };
    const magic = createPlayerMagic({
      renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
      audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
      getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
      uploadRecord() {}, uploadRecordFrame() {},
      collider: { raycast: () => Infinity },
      playerEntity: player,
      playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: () => {} },
      say: () => {},
      surfacePlayer() {},
      foes: () => [foe],
      foeSinks: () => ({ hurt: (n) => { hurt.n += n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
      absorbCtx: () => ({ inside: true, day: false }),
      rolls: () => 0.99,
    });
    return { magic, hurt };
  };
  const spell = {
    name: 'Bolt', index: 92, element: 0, rangeType: 2,
    effects: [{ type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }],
  };
  // A 3.2 giant, the bolt level with the player's eye at 2.9: the
  // capsule's inner axis tops out at 2.75, so the bolt is 0.15 from it
  // - a hit. Its CENTRE is 1.6, and the point law that stood here was
  // 1.3 away: a miss. Mutate hostMagic's contact back to the centre and
  // this assertion is what fails.
  const giant = rig(mkFoe(3.2));
  giant.magic.readySpell(spell);
  assert.equal(giant.magic.castInput([0, 2.9, 0], [0, 0, 1]), true, 'the bolt is loosed');
  for (let i = 0; i < 4; i++) giant.magic.update(0.05, [0, 0, 0], [0, 0, 1], CAPSULE_HEIGHT);
  assert.ok(giant.hurt.n > 0, 'the giant is struck near its head, where DFU\'s SphereCast meets its capsule');
  // ...and a RAT (1.0) under the same bolt is not: axis 0.45..0.55.
  const rat = rig(mkFoe(1.0));
  rat.magic.readySpell(spell);
  assert.equal(rat.magic.castInput([0, 2.9, 0], [0, 0, 1]), true);
  for (let i = 0; i < 4; i++) rat.magic.update(0.05, [0, 0, 0], [0, 0, 1], CAPSULE_HEIGHT);
  assert.equal(rat.hurt.n, 0, 'and the same bolt sails over a rat - the height is read, not assumed');
  // The dungeon host is a whole scene, so its player-arrow site is held
  // by its call and by the absence of the point form it was converted
  // from (the ceiling-bats count carries the same law by number).
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /^\s*if \(missileHitsFoe\(m\.pos, f\)\) \{ {3}\/\/ ROAD-H tail: DaggerfallMissile\.cs:339/m,
    'the dungeon\'s PLAYER shaft meets a foe through the one capsule test');
  assert.doesNotMatch(d, /const fx = f\.ai\.feet\[0\] - m\.pos\[0\]/,
    'and not at the foe\'s capsule centre as a point');
  assert.doesNotMatch(src('src/scenes/hostMagic.js'), /const fx = f\.ai\.feet\[0\] - m\.pos\[0\]/,
    'nor does the player\'s spell missile');
});

test('ROAD-H tail (review): an enemy shaft STOPS on the body it meets, and pays only the archer\'s own target', () => {
  // Once `fireArrow` could carry `aimFoe`, the impact fork's arms were
  // mutually exclusive - `else if (m.aimFoe ...) else if (playerFeet)` -
  // so a shaft loosed at another foe never tested the player at all and
  // flew straight through. DFU has no such ordering: an ENEMY missile
  // casts with the DEFAULT layer mask (DaggerfallMissile.cs:250-253,
  // which is the mask a PLAYER missile drops the Player layer from at
  // :263), :337 meets whatever collider is first in space, and
  // DoCollision destroys the arrow there (:388-396). Only then does
  // AssignBowDamageToTarget ask `targetEntities[0] ==
  // caster.GetComponent<EnemySenses>().Target` (:669) before calling
  // BowDamage - the DAMAGE gate, not the contact gate.
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /const struckPlayer = !!playerFeet && missileHitsCapsule\(m\.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS\);/,
    'the player capsule is tested for EVERY enemy shaft, whatever it was aimed at');
  assert.match(d, /if \(!struckPlayer\) \{\n\s+for \(const f of foes\) \{\n\s+if \(f\.dead \|\| f === m\.shooterFoe\) continue;\n\s+if \(missileHitsFoe\(m\.pos, f\)\) \{ struckFoe = f; break; \}/,
    'and so is every live body but the shooter, which cannot feather itself on the release frame');
  assert.match(d, /if \(struckFoe && struckFoe === m\.aimFoe\) \{/,
    'BowDamage runs only when the struck body IS the archer\'s selected target (:669)');
  assert.match(d, /\} else if \(struckPlayer && !m\.aimFoe\) \{/,
    '...and the player arm only when the player IS that target');
  assert.match(d, /\} else if \(struckPlayer \|\| struckFoe\) \{\n\s+retireMissile\(m\);/,
    'a shaft that met the wrong body is spent on it - no damage, no recovered Arrow');
  assert.doesNotMatch(d, /\} else if \(m\.aimFoe && !m\.aimFoe\.dead\) \{\n\s+\/\/ MT-iv/,
    'the foe target is no longer the CONTACT gate');
});

test('ROAD-H tail (review): an enemy shaft is SPENT on whatever it meets and DAMAGES only the foe it was loosed at (DaggerfallMissile.cs:388-396, :669)', () => {
  // DoCollision destroys an arrow on any collider it meets (:388-396);
  // AssignBowDamageToTarget then runs BowDamage only when the struck
  // body IS the archer's Target (:669). So a shaft loosed at a bear
  // that the player steps into is spent on the player and deals
  // nothing - no BowDamage, no Dodging tally, no recovered Arrow.
  const bear = { id: 'bear', ai: { feet: [0, 0, 8], height: 1.8 }, dead: false };
  const wolf = { id: 'wolf', ai: { feet: [0, 0, 5], height: 1.8 }, dead: false };
  const log = [];
  // (1) the player in the way of a foe-aimed shaft: stopped, unhurt
  const a = open();
  a.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 'archer' }, weapon: {}, aimFoe: bear });
  for (let i = 0; i < 4; i++) a.update(0.05, { playerFeet: [0, 0, 5], playerHeight: 1.8, onPlayerHit: () => log.push('player hurt'), foeTargets: [{ feet: bear.ai.feet, ref: bear }], onFoeHit: (m, t) => log.push(t.id) });
  assert.deepEqual(log, [], 'the player took nothing');
  assert.equal(a.arrows[0].dead, true, 'and the shaft is spent on the player, not flown through');
  // (2) a NON-target foe in the way: stopped, unhurt, the target never reached
  const b = open();
  b.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 'archer' }, weapon: {}, aimFoe: bear });
  for (let i = 0; i < 4; i++) b.update(0.05, { foeTargets: [{ feet: wolf.ai.feet, ref: wolf }, { feet: bear.ai.feet, ref: bear }], onFoeHit: (m, t) => log.push(t.id) });
  assert.deepEqual(log, [], 'the wolf took nothing');
  assert.equal(b.arrows[0].dead, true, 'the shaft stopped on the wolf');
  // (3) the same shaft with the wolf out of the way reaches its target
  const c = open();
  c.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 'archer' }, weapon: {}, aimFoe: bear });
  for (let i = 0; i < 8; i++) c.update(0.05, { foeTargets: [{ feet: bear.ai.feet, ref: bear }], onFoeHit: (m, t) => log.push(t.id) });
  assert.deepEqual(log, ['bear'], 'the bear is struck');
  // (4) a shaft loosed at the PLAYER (aimFoe null) still lands on the player
  const d = open();
  d.fire([0, 0.9, 0], [0, 0, 1], { enemy: true, shooterFoe: { id: 'archer' }, weapon: {} });
  for (let i = 0; i < 4; i++) d.update(0.05, { playerFeet: [0, 0, 5], onPlayerHit: () => log.push('player hurt') });
  assert.deepEqual(log, ['bear', 'player hurt']);
  // (5) a PLAYER shaft has no such gate - WeaponDamage strikes what it hits
  const e = open();
  e.fire([0, 0.9, 0], [0, 0, 1], { fromPlayer: true });
  for (let i = 0; i < 4; i++) e.update(0.05, { foeTargets: [{ feet: wolf.ai.feet, ref: wolf }], onPlayerArrowHitFoe: (m, t) => log.push('player shaft: ' + t.id) });
  assert.deepEqual(log, ['bear', 'player hurt', 'player shaft: wolf']);
  // the pool decides the target ONCE and hands it to every host's fire
  const x = src('src/scenes/exteriorFoes.js');
  assert.match(x, /const _at = f\.ai\.target \?\? PLAYER_TARGET, _atPlayer = isPlayerTarget\(_at\);/);
  assert.match(x, /onArrow\(from, dir, f, _atPlayer \? null : _at\);/, 'the selected foe rides the shaft; the player is null');
  for (const [h, call] of [['src/scenes/world.js', 'arrows.fire'], ['src/scenes/exterior.js', 'arrows.fire'], ['src/scenes/worldModes.js', 'interiorArrows.fire']]) {
    const s = src(h);
    assert.match(s, /onArrow: \(from, dir, f, aimFoe = null\) => \{/, `${h}: the host takes the target`);
    assert.ok(s.includes(`${call}(from, dir, { enemy: true, shooterFoe: f, weapon: f.entity.weapon, aimFoe });`), `${h}: and stores it on the shaft`);
  }
});
