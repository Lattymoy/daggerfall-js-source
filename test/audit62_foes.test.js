// AUDIT 62 - THE FOES AND THE MOTOR. Five transform-space laws that
// the REVIEW 2026-09-05 rewrite either left half-converted or left
// unpinned, each pinned here against the REFERENCE's own value:
//
//   F17  one transform-space y term feeds BOTH wouldBeSpawnedInClassic
//        arguments (EnemySenses.cs:288-290 + :376-377).
//   F18  getTargets measures transform to transform (:816-818), and the
//        ordering it drives flips when either offset is dropped.
//   F37  CanHearTarget casts from THIS foe's transform to the TARGET's
//        (:942 + :425-427), through the live call site.
//   F21  an enemy missile aims at the target's transform and an
//        AreaAroundCaster spell blows at the caster's
//        (DaggerfallMissile.cs:571-581/:280-282/:513-525).
//   F23  the PLAYER target's capsule is the LIVE controller, not 1.8
//        (EnemyMotor.cs:532/:544/:562, EnemySenses.cs:896-898,
//        PlayerHeightChanger.cs:54-57/:475-478).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnemyAI, wouldBeSpawnedInClassic, CLASSIC_SPAWN_Y_UPPER, CLASSIC_SPAWN_XZ } from '../src/characters/enemyMotor.js';
import { enemyControllerHeight } from '../src/characters/enemyAnchor.js';
import { getTargets, runTargetMachine, targetAimPoint, isPlayerTarget } from '../src/characters/enemyTargets.js';
import { missileHitsFoe, missileHitsCapsule, MISSILE_COLLIDER_RADIUS, BODY_CAPSULE_RADIUS } from '../src/systems/spellcast.js';
import { sensesContext } from '../src/scenes/shared.js';
import { Collider } from '../src/player/collider.js';
import { CAPSULE_HEIGHT, CROUCH_HEIGHT } from '../src/player/motor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quad = new Uint32Array([0, 1, 2, 0, 2, 3]);
const floored = () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), quad, I4);
  return c;
};
/** A wall at z = 5 whose top sits at 1.3: a standing player's eye-to-eye
 *  ray (1.5 level) clears it, a crouched player's (1.5 -> 0.75) does not. */
const lowWalled = () => {
  const c = floored();
  c.addMesh('low', new Float32Array([-80, 0, 5, 80, 0, 5, 80, 1.3, 5, -80, 1.3, 5]), quad, I4);
  return c;
};
const mkSenses = (o = {}) => ({ gameMinutes: 0, playerStealth: 0, movingLessThanHalfSpeed: false, rolls: () => 0.5, ...o });
/** A collider that records every ray and blocks none. */
const rayStub = () => {
  const cap = [];
  return { cap, raycast: (o, d, len) => { cap.push({ o: [...o], d: [...d], len }); return Infinity; }, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
};

// ── F17 ───────────────────────────────────────────────────────────

test('AUDIT 62 F17: one TRANSFORM-space y feeds both wouldBeSpawnedInClassic arguments', () => {
  // EnemySenses.cs:288-290 takes YDiffToPlayer from the transforms and
  // rebuilds the XZ leg as sqrt(distanceToPlayer^2 - YDiffAbs^2), with
  // :376-377's distanceToPlayer also transform-to-transform. Two
  // measures cannot share one Pythagorean identity, so the pair must be
  // ONE value. A 3.2m bat: capsule halved to 1.6, transform 1.6 up.
  const bat = (feet) => new EnemyAI(floored(), feet, 0, {
    liveSpeed: 50, behaviour: 'Flying', height: enemyControllerHeight(3.2, 'Flying'), centreOffset: 1.6,
  });
  assert.equal(CLASSIC_SPAWN_Y_UPPER, 3.2, 'row 0 upperY = 128 units');
  // perched 2.9 above the player's feet: DFU's yDiff is (2.9 + 1.6) -
  // 0.9 = 3.6, PAST the row-0 band. Feet-to-feet says 2.9 and spawns it.
  const high = bat([0, 2.9, 1]);
  high._classicSenses([0, 0, 0], mkSenses());
  assert.equal(high.wouldBeSpawned, false, 'yDiff 3.6 > 3.2 - dormant in classic (feet-to-feet would have woken it)');
  // ...and the band is not simply always shut
  const low = bat([0, 1.0, 1]);
  low._classicSenses([0, 0, 0], mkSenses());
  assert.equal(low.wouldBeSpawned, true, 'yDiff 2.6 is inside the band');
  // the XZ RECONSTRUCTION: with one y term, xz collapses to the true
  // horizontal leg, so the XZ band edge is exact. A transform-space
  // yDiff against a FEET-space distance shortens it and lets a foe past
  // 25.6 through.
  assert.equal(CLASSIC_SPAWN_XZ, 25.6, 'row 0 upperXZ = 1024 units');
  const far = bat([25.63, 1.0, 0]);
  far._classicSenses([0, 0, 0], mkSenses());
  assert.equal(far.wouldBeSpawned, false, 'xz 25.63 > 25.6 - a feet-space distance would have reported 25.59 and spawned it');
  // and the identity itself, stated against the function
  const yDiff = (2.9 + 1.6) - 0.9, dist = Math.hypot(0, yDiff, 1);
  assert.ok(near(Math.sqrt(dist * dist - yDiff * yDiff), 1), 'sqrt(d^2 - y^2) is the horizontal leg exactly');
  assert.equal(wouldBeSpawnedInClassic(dist, yDiff, false, 0, true), false);
});

// ── F18 ───────────────────────────────────────────────────────────

test('AUDIT 62 F18: getTargets measures transform to transform, and the PRIORITY ordering it drives says so', () => {
  // EnemySenses.cs:816-818 `toTarget = targetBehaviour.transform
  // .position - transform.position` - each side lifted by its OWN
  // centre offset. The distance feeds targetPriority (:829-841), so the
  // ordering is where the law is observable.
  const col = floored();
  const mkAi = (feet, centreOffset, height = 1.6) => Object.assign(new EnemyAI(col, feet, 0, { liveSpeed: 50, height, centreOffset }), { wouldBeSpawned: true });
  // the hunter is a bat: its transform sits 1.6 over its feet
  const self = { ai: mkAi([0, 0, 0], 1.6), entity: { team: 'Orcs' } };
  // A is a rat 9.95 away in XZ; B another bat, 10.0 away. Feet to feet
  // A is the nearer, so the pre-fix reading picks A; transform to
  // transform A is 10.016 and B is 10.0, so DFU picks B.
  const A = { ai: mkAi([0, 0, 9.95], 0.45), entity: { team: 'Bears' } };
  const B = { ai: mkAi([0, 0, 10.0], 1.6), entity: { team: 'Vermin' } };
  const got = getTargets(self, [A, B], [0, 0, 60], { noTargetMode: true, infighting: true });
  assert.equal(got.target, B, 'the transform-space nearer candidate wins (feet to feet would have said A)');
  assert.ok(near(got.distanceToTarget, Math.hypot(0, 1.6 - 1.6, 10.0)), `B's distance: ${got.distanceToTarget}`);
  // and each offset is load-bearing on its own: drop only the SELF lift
  // and A is 9.960 to B's 10.127; drop only the TARGET lift and A is
  // 10.078 to B's 10.127 - both pick A.
  assert.ok(Math.hypot(0, 0.45, 9.95) < Math.hypot(0, 1.6, 10.0), 'the self-lift-only mutant reverses it');
  assert.ok(Math.hypot(0, 1.6, 9.95) < Math.hypot(0, 1.6, 10.0), 'the target-lift-only mutant reverses it');
});

// ── F37 ───────────────────────────────────────────────────────────

test('AUDIT 62 F37: CanHearTarget casts from THIS transform to the TARGET transform, through the live call site', () => {
  // EnemySenses.cs:942 `new Ray(transform.position, directionToTarget)`
  // with :425-427 `directionToTarget = (target.transform.position -
  // transform.position).normalized`. Both ends are TRANSFORMS - a bat's
  // is 1.6 up where half its (halved, floored) capsule is 0.8, and a rat
  // TARGET's is 0.45 where the player's half-capsule is 0.9.
  const s = mkSenses();
  // arm 1 - the ORIGIN is this foe's centreOffset. yaw PI faces it away,
  // so the FOV gate (:881) refuses sight without casting, and the
  // hearing ray is the only cast.
  const c1 = rayStub();
  const bat = new EnemyAI(c1, [0, 0, 0], Math.PI, {
    liveSpeed: 50, behaviour: 'Flying', height: enemyControllerHeight(3.2, 'Flying'), centreOffset: 1.6,
  });
  bat.detected = true;                 // hearing runs only for an already-detected, unseen target
  bat._senses([0, 0, 5], s);
  assert.equal(bat.inSight, false, 'facing away: no sight ray');
  assert.equal(c1.cap.length, 1, 'the hearing ray is the only cast');
  assert.ok(near(c1.cap[0].o[1], 1.6), `origin = transform.position: ${c1.cap[0].o[1]} (half the capsule would say 0.8)`);
  assert.equal(bat.detected, true, 'and the clear ray keeps it detected');
  // arm 2 - the ray END is the FOE target's own transform, not the
  // player's half-capsule. Only a foe target can separate them.
  const c2 = rayStub();
  const rat = new EnemyAI(c2, [0, 0, 5], 0, { liveSpeed: 50, height: 1.6, centreOffset: 0.45 });
  const w = new EnemyAI(c2, [0, 0, 0], Math.PI, { liveSpeed: 50 });
  w._armedTargeting = true;
  w._targetCandidate = { isPlayer: false, ai: rat, entity: {} };
  w.detected = true;
  w._senses([0, 0, 5], s);
  const r = c2.cap[c2.cap.length - 1];
  assert.ok(near(r.o[1], 0.9), 'a plain walker casts from its own 0.9 transform');
  assert.ok(near(r.o[1] + r.d[1] * r.len, 0.45), `the ray ends at the FOE target's transform: ${r.o[1] + r.d[1] * r.len} (the player's half-capsule would say 0.9)`);
  // the WIRING is what regressed before, so pin the call site too
  assert.match(src('src/characters/enemyMotor.js'),
    /canHearTarget\(this\.collider, this\.feet, this\.height, playerFeet, this\._dist, this\.centreOffset, this\._targetCentreOffset\(\)\)/,
    'both offsets reach canHearTarget from _senses');
});

// ── F21 ───────────────────────────────────────────────────────────

test('AUDIT 62 F21: an enemy missile aims at the TARGET transform, and the contact test is the capsule', () => {
  const d = src('src/scenes/dungeonContext.js');
  // DaggerfallMissile.cs:571-581 aims at enemySenses.LastKnownTargetPos,
  // which EnemySenses.cs:453/:465 sets to target.transform.position.
  // REVIEW: ONE body of that law now (enemyTargets.targetAimPoint) -
  // this host's own copy converted only the FOE arm and left the
  // player arm at a hardcoded standing half-capsule.
  assert.match(d, /const aim = m\.aimFoe \? foeDeps\.targetAimPoint\(m\.aimFoe, playerFeet, playerHeight\) : target;/,
    'the foe aim goes through the shared law, with the live player height alongside');
  assert.match(d, /const target = \[playerFeet\[0\], playerFeet\[1\] \+ playerHeight \/ 2, playerFeet\[2\]\];/,
    "the PLAYER arm is the player's transform, at the live capsule");
  assert.doesNotMatch(d, /playerFeet\[1\] \+ 0\.9, playerFeet\[2\]\];   \/\/ mid-capsule/, 'the 0.9 aim is gone');
  assert.match(d, /function updateMissiles\(dt, playerFeet, playerHeight = CAPSULE_HEIGHT\)/);
  assert.match(d, /updateMissiles\(dt, playerFeet, playerHeight\);/, 'and the frame hands it the live one');
  // ...and the contact test is now the CAPSULE DaggerfallMissile.cs:339
  // spherecasts into, or a tall flyer would be unhittable once the
  // flight line left the capsule centre.
  assert.equal([...d.matchAll(/if \(missileHitsFoe\(m\.pos, af\)\) \{/g)].length, 2, 'both foe-vs-foe arms (arrow and spell) use it');
  assert.equal([...d.matchAll(/if \(missileHitsCapsule\(m\.pos, playerFeet, playerHeight\)\) \{/g)].length, 2,
    "and both PLAYER arms sweep the player's own live capsule");
  assert.doesNotMatch(d, /const ay = af\.ai\.feet\[1\] \+ \(af\.ai\.height \?\? 1\.8\) \/ 2 - m\.pos\[1\];/, 'the single-point arrow test is gone');
  assert.doesNotMatch(d, /const sy = af\.ai\.feet\[1\] \+ \(af\.ai\.height \?\? 1\.8\) \/ 2 - m\.pos\[1\];/, 'and the single-point spell test');
  // a 4.0m flyer: capsule halved to 2.0, transform 2.0 up. The flight
  // line runs at the TRANSFORM, a metre over the capsule centre - past
  // the 0.9 point-sphere the old test used, and well inside the capsule.
  const bat = { ai: { feet: [0, 0, 0], height: 2.0, centreOffset: 2.0 } };
  assert.equal(Math.hypot(0, 2.0 - 2.0 / 2, 0) > MISSILE_COLLIDER_RADIUS + 0.45, true,
    'the old point test would never have registered this shot');
  assert.equal(missileHitsFoe([0, 2.0, 0], bat), true, 'the capsule test takes it at the transform');
  assert.equal(missileHitsFoe([0, 1.0, 0], bat), true, '...and anywhere else along the axis');
  assert.equal(missileHitsFoe([0, 3.5, 0], bat), false, 'but not a shot passing over its head');
  assert.equal(missileHitsFoe([0, 0, 2], bat), false, 'nor one two metres in front of it');
});

test('AUDIT 62 F21 (review): the swept capsule is the INNER segment, feet+r .. feet+h-r', () => {
  // The prefab's CharacterController is m_Height 1.8, m_Radius 0.4,
  // m_SkinWidth 0.05, m_Center {0,0,0} (DaggerfallEnemy [Game
  // Serializable].prefab:442-448) - so 0.45 is the surface a cast
  // meets, and DaggerfallMissile.cs:339's SphereCast(ColliderRadius)
  // reaches it at 0.45 + 0.45.
  assert.equal(BODY_CAPSULE_RADIUS, 0.45, "m_Radius 0.4 + m_SkinWidth 0.05");
  // A Unity capsule's SURFACE spans feet..feet+h; its two hemisphere
  // CENTRES are inset by r. So for a 1.6 rat DFU's swept volume runs
  // feet-0.45 .. feet+2.05 - NOT feet-0.9 .. feet+2.5, which is what
  // taking [feet, feet+h] as the axis produces.
  const rat = { ai: { feet: [0, 0, 0], height: 1.6, centreOffset: 0.3 } };
  const lo = 0 + Math.min(BODY_CAPSULE_RADIUS, 1.6 / 2) - (MISSILE_COLLIDER_RADIUS + BODY_CAPSULE_RADIUS);
  const hi = 1.6 - Math.min(BODY_CAPSULE_RADIUS, 1.6 / 2) + (MISSILE_COLLIDER_RADIUS + BODY_CAPSULE_RADIUS);
  assert.equal(lo, -0.45, 'DFU reaches 0.45 below the feet, not 0.9');
  assert.ok(near(hi, 2.05), '...and 2.05 above them, not 2.5');
  assert.equal(missileHitsFoe([0, -0.3, 0], rat), true, 'just inside the bottom cap');
  assert.equal(missileHitsFoe([0, -0.7, 0], rat), false, 'a shot into the floor under a rat does NOT hit it');
  assert.equal(missileHitsFoe([0, 2.0, 0], rat), true, 'just inside the top cap');
  assert.equal(missileHitsFoe([0, 2.3, 0], rat), false, 'and one over its head does not');
  // Unity refuses a capsule shorter than its own diameter: under 2r the
  // two hemisphere centres coincide and it is a sphere.
  const imp = { ai: { feet: [0, 0, 0], height: 0.6 } };
  assert.equal(missileHitsCapsule([0, 0.3, 0], imp.ai.feet, 0.6), true, 'the degenerate capsule is a sphere at its centre');
  assert.equal(missileHitsCapsule([0, 1.3, 0], imp.ai.feet, 0.6), false, '...and reaches exactly 0.9 from it, no further');
});

test('AUDIT 62 F21 (review): ONE aim-point law, and the player arm of it is the LIVE transform', () => {
  // DaggerfallMissile.cs:571-581 -> EnemySenses.cs:453: the aim point is
  // target.transform.position, with no arrow-specific variation (the
  // forward*0.6 + height/3 lift at :518-527 is GetAimPosition, the
  // ORIGIN). A FOE's transform is feet + centreOffset; the PLAYER's is
  // feet + the LIVE height/2 (PlayerHeightChanger.cs:477-478).
  const bat = { ai: { feet: [1, 10, 2], height: 2.0, centreOffset: 1.6 } };
  assert.deepEqual(targetAimPoint(bat, [0, 0, 0], CAPSULE_HEIGHT), [1, 11.6, 2],
    "a bat is aimed at its transform - 0.7 above the player's half-capsule the hosts used to use");
  const rat = { ai: { feet: [1, 10, 2], height: 1.6, centreOffset: 0.3 } };
  assert.deepEqual(targetAimPoint(rat, [0, 0, 0], CAPSULE_HEIGHT), [1, 10.3, 2], '...and a rat 0.6 below it');
  assert.deepEqual(targetAimPoint(null, [5, 1, 7], CAPSULE_HEIGHT), [5, 1.9, 7], 'a standing player: feet + 0.9');
  assert.deepEqual(targetAimPoint(null, [5, 1, 7], CROUCH_HEIGHT), [5, 1.45, 7],
    'crouched: feet + 0.45, the crown of the capsule under the old constant');
  assert.deepEqual(targetAimPoint(null, [5, 1, 7], 2.6), [5, 2.3, 7], 'mounted: controllerRideHeight/2');
  assert.equal(isPlayerTarget(null), false, 'a null target is the player by fallback, not by identity');
  // the four hosts that carried their own copy of the constant
  assert.match(src('src/scenes/exteriorFoes.js'),
    /return _targetFeet\(f, playerFeet\) \? targetAimPoint\(f\.ai\.target, playerFeet, playerHeight\) : null;/,
    'the exterior pool aims through the shared law');
  assert.match(src('src/scenes/exteriorFoes.js'),
    /const aim = _targetAim\(f, playerFeet, senses\.playerHeight \?\? CAPSULE_HEIGHT\);/, '...at the live player height');
  assert.doesNotMatch(src('src/scenes/exteriorFoes.js'), /_tgt\[1\] \+ 0\.9/, "and the player's half-capsule is gone from its arrow");
  assert.match(src('src/scenes/dungeonContext.js'),
    /const d = \[playerFeet\[0\] - from\[0\], playerFeet\[1\] \+ playerHeight \/ 2 - from\[1\], playerFeet\[2\] - from\[2\]\];/,
    "the dungeon archer aims at the player's live transform");
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(src(f), /player\.pos\[1\] \+ player\.height \/ 2 - from\[1\]/, `${f}: the fireMissile hook too`);
    assert.doesNotMatch(src(f), /player\.pos\[1\] \+ 0\.9 - from\[1\]/, `${f}: and not the standing constant`);
  }
  assert.match(src('src/scenes/hostMagic.js'), /if \(missileHitsCapsule\(m\.pos, playerFeet, playerHeight\)\) \{/,
    "the shared engine sweeps the player's live capsule");
});

test('AUDIT 62 F21: a foe casts from - and blows an AreaAroundCaster at - its own TRANSFORM', () => {
  const c = src('src/characters/enemyCasting.js');
  // DaggerfallMissile.cs:513-525 GetAimPosition: caster.transform
  // .position for a non-player caster (the forward*0.6 + height/3 lift
  // is the ARROW arm only); :280-282 DoAreaOfEffect(caster.transform
  // .position, true).
  assert.match(c, /const casterTransformY = f\.ai\.feet\[1\] \+ \(f\.ai\.centreOffset \?\? \(f\.ai\.height \?\? 1\.8\) \/ 2\);/);
  assert.match(c, /const from = \[f\.ai\.feet\[0\], casterTransformY, f\.ai\.feet\[2\]\];/, 'the loose point is the transform');
  assert.match(c, /explodeAt\?\.\(\[f\.ai\.feet\[0\], casterTransformY, f\.ai\.feet\[2\]\]/, 'and so is the AoC blast centre');
  assert.doesNotMatch(c, /f\.ai\.feet\[1\] \+ 1\.2/, 'the 1.2 guess is gone');
  assert.doesNotMatch(c, /f\.ai\.feet\[1\] \+ 0\.9/, "the player's half-capsule is gone from the foe caster");
});

// ── F23 ───────────────────────────────────────────────────────────

test('AUDIT 62 F23: the senses context carries the LIVE player capsule, and every host fills it', () => {
  // PlayerHeightChanger.cs:54-57 - standing 1.8, crouch 0.9, ride 2.6,
  // swim 0.30 - and :475-478 keeps the capsule bottom planted while the
  // transform moves by heightChange/2.
  const entity = { level: 1, skills: [], skillUses: [] };
  assert.equal(sensesContext(entity, 0).playerHeight, CAPSULE_HEIGHT, 'the headless default is the standing capsule');
  assert.equal(sensesContext(entity, 0, { playerHeight: CROUCH_HEIGHT }).playerHeight, 0.9);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(src(f), /sensesContext\([\s\S]{0,400}?playerHeight: player\.height,/, `${f}: the live motor height reaches the foes`);
  }
  assert.match(src('src/scenes/dungeonContext.js'), /\.\.\._activity, playerHeight,/, 'the dungeon passes the height drawFoes already holds');
  // and the target machine's player arms take it too
  const t = src('src/characters/enemyTargets.js');
  assert.match(t, /playerHeight = CAPSULE_HEIGHT,/);
  assert.match(t, /const tOff = isPlayer \? playerHeight \/ 2 :/);
  assert.match(t, /isPlayer \? playerHeight : targetAi\.height, null, distance\)/);
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(src(f), /playerHeight: (?:sn|senses)\.playerHeight,/, `${f}: the targeting closure forwards it`);
  }
});

test('AUDIT 62 F23: a crouched player is a 0.9 capsule to every foe - transform, eye and destination', () => {
  // EnemyMotor.cs:532 reads senses.Target's CharacterController LIVE;
  // :544/:562 measure against its height, and EnemySenses.cs:896-898
  // builds the target eye at controller.center + height/3.
  const ai = new EnemyAI(floored(), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(ai._targetHeight(), CAPSULE_HEIGHT, 'headless: the standing capsule, unchanged');
  assert.equal(ai._targetCentreOffset(), CAPSULE_HEIGHT / 2);
  ai.update(0.05, [0, 0, 10], mkSenses({ playerHeight: CROUCH_HEIGHT }));
  assert.equal(ai._targetHeight(), 0.9, 'crouched: targetController.height is 0.9');
  assert.equal(ai._targetCentreOffset(), 0.45, '...and the transform sits at feet + 0.45');
  const mounted = new EnemyAI(floored(), [0, 0, 0], 0, { liveSpeed: 50 });
  mounted.update(0.05, [0, 0, 10], mkSenses({ playerHeight: 2.6 }));
  assert.equal(mounted._targetCentreOffset(), 1.3, 'controllerRideHeight 2.6 the other way');
  // the SIGHT eye, behaviourally: a wall topping out at 1.3 hides a
  // crouched player (eye 0.75) from a foe whose own eye is 1.5, and
  // hides nothing from a standing one (eye 1.5).
  const standing = new EnemyAI(lowWalled(), [0, 0, 0], 0, { liveSpeed: 50 });
  standing.update(0.05, [0, 0, 10], mkSenses({ playerHeight: CAPSULE_HEIGHT }));
  assert.equal(standing.inSight, true, 'a standing player is seen over the low wall');
  const crouched = new EnemyAI(lowWalled(), [0, 0, 0], 0, { liveSpeed: 50 });
  crouched.update(0.05, [0, 0, 10], mkSenses({ playerHeight: CROUCH_HEIGHT }));
  assert.equal(crouched.inSight, false, 'a crouched one is not - the port aimed at feet + 1.50 where DFU aims at feet + 0.75');
  // and the spawn band's distanceToPlayer reads the same live capsule
  assert.match(src('src/characters/enemyMotor.js'),
    /const yDiff = \(this\.feet\[1\] \+ this\.centreOffset\) - \(playerFeet\[1\] \+ this\._playerHeight \/ 2\);/,
    'EnemySenses.cs:288 against the LIVE player transform');
});

test("AUDIT 62 F23 (review): the OUT-OF-BAND player-LOS check reads the live capsule too", () => {
  // EnemySenses.cs:377-383 - outside the classic spawn area a foe still
  // checks direct LOS to the PLAYER, and only that check opens the
  // GetTargets gate at :391-395. The ray is CanSeeTarget's
  // (:896-898): both eyes at controller.center + height/3, and the
  // player's controller is the LIVE one (PlayerHeightChanger.cs
  // :54-57/:475-478).
  //
  // The wall tops out at 1.3. A standing player's eye is 0.9 + 0.6 =
  // 1.5 and clears it; a crouched player's is 0.45 + 0.3 = 0.75 and
  // does not. The foe's own eye is 1.5 either way. Nothing else in the
  // machine can tell them apart: the PLAYER candidate has no senses,
  // so GetTargets' own `!targetSenses.WouldBeSpawnedInClassic && !see`
  // reject (:823-825) never fires on it - it would hand back the
  // player blind. The gate is the only thing that stops it.
  const mkFoe = () => {
    const ai = new EnemyAI(lowWalled(), [0, 0, 0], 0, { liveSpeed: 50 });
    ai.wouldBeSpawned = false;   // :377 - the out-of-classic-area arm
    return { ai, entity: { team: 'PlayerEnemy', mobileTeam: 'PlayerEnemy', health: 20, basics: { team: 'PlayerEnemy' } } };
  };
  const run = (playerHeight) => {
    const self = mkFoe();
    // a classicDt past the 5-unit senses interval, so the gate resolves
    return runTargetMachine(self, [self], [0, 0, 10], 600, {
      infighting: true, playerEntity: { health: 100 }, playerHeight,
    });
  };
  assert.deepEqual(run(CAPSULE_HEIGHT), [0, 0, 10], 'a standing player is seen over the wall and taken as the target');
  assert.equal(run(CROUCH_HEIGHT), null, 'a crouched one is not seen, the gate holds, and no target is selected');
  assert.deepEqual(run(2.6), [0, 0, 10], 'mounted (controllerRideHeight 2.6), taller still, is seen');
  // and the wiring: the out-of-band check is its OWN call site, not
  // getTargets' - the parameter declaration alone pinned nothing here.
  assert.match(src('src/characters/enemyTargets.js'),
    /playerInSight = canSeeTarget\(ai\.collider, ai\.feet, ai\.yaw, ai\.height, playerFeet, playerHeight\);/,
    'the :377-383 LOS check takes the live player height');
});
