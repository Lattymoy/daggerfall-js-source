// ROAD-H MISSILES (2026-09-07) - the three DaggerfallMissile laws
// AUDIT 62's foes lane fixed the AIM for and deferred the rest of:
// where an arrow LEAVES the bow (both enemy pools and the player's own
// four hosts), the crouch dip an enemy archer takes against a crouching
// player, and the area-of-effect sweep's OverlapSphere against
// CharacterController capsules.
//
// Reference: Assets/Scripts/Game/DaggerfallMissile.cs -
//   GetAimPosition  :513-555   (the arrow origin, both arms)
//   GetAimDirection :557-589   (the crouch dip, :583-585)
//   DoAreaOfEffect  :477-510   (the OverlapSphere, :481)
//   ExplosionRadius :38        (4.0)
// and PlayerMotor.cs:132-136 (IsCrouching, the latched state).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  enemyArrowOrigin, enemyTransformPoint, arrowAimDirection,
  ARROW_ORIGIN_FORWARD, ARROW_ORIGIN_HEIGHT_DIVISOR, ARROW_CROUCH_DIP,
} from '../src/characters/enemyTargets.js';
import {
  playerArrowOrigin, PLAYER_ARROW_DOWN, PLAYER_ARROW_SIDE,
  sphereOverlapsCapsule, sweepFoes, missileHitsCapsule,
  EXPLOSION_RADIUS, MISSILE_COLLIDER_RADIUS, BODY_CAPSULE_RADIUS,
} from '../src/systems/spellcast.js';
import { sensesContext } from '../src/scenes/shared.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------
// A LIVE EXTERIOR ENCOUNTER POOL, headless. The review round found
// H1b's "only at the PLAYER" half and H2's live-capsule LATCH pinned
// only by their spelling: a source regex that stops before the option
// bag keeps matching when the call site is reverted. These drive the
// pool's own update and read what it HANDS the two laws, so the
// wiring is observed rather than quoted. No ARENA2 is needed - the
// spawn chain is never entered; the foe records are hand-built, which
// is what the pool's own fields amount to once the sprite is stubbed.
// ---------------------------------------------------------------
const stubTex = { getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) };
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async () => { throw new Error('the spawn chain is not entered'); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 0,
  playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null,
  onPlayerHurt: () => {},
  rolls: () => 0.5,
  ...extra,
});
/** One encounter foe, standing at `feet` with `target` selected. The
 *  transform is feet + 0.9 (the idle sprite's centre) and the capsule
 *  1.8, so a shot at a level target is dead flat and any Y in the
 *  direction can only have come from the dip. */
const foeRec = (feet, target) => ({
  dead: false, mobileType: 0,
  entity: { health: 10, maxHealth: 10, magicka: 50, maxMagicka: 50, level: 1, activeEffects: [], skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), stats: { speed: 50 }, items: [] },
  ai: {
    feet, yaw: 0, height: 1.8, centreOffset: 0.9, target,
    _armedTargeting: true, _dist: 10, landedFall: 0,
    detected: true, inSight: true, isHostile: true, moving: false, hurtKnock: false, flies: false,
    update: () => {}, _centre: () => [feet[0], feet[1] + 0.9, feet[2]],
  },
  mobile: {
    isPlayingOneShot: () => false, oneShotPauseActionsWhilePlaying: () => false,
    frameSpeedDivisor: 1, doMeleeDamage: false, shootArrow: false, basics: {}, update: () => ({}),
  },
  attack: { update: () => {}, machine: { state: 'Idle' }, firedRanged: false },
});

// ---------------------------------------------------------------
// H1 - THE ENEMY ARROW ORIGIN
// ---------------------------------------------------------------

test('ROAD-H H1: an enemy archer looses from transform + forward*0.6 + height/3, not feet + 1.2', () => {
  // DaggerfallMissile.cs:534-538 as VALUES:
  //   adjust  = caster.transform.forward * 0.6f
  //   adjust.y += casterController.height / 3
  assert.equal(ARROW_ORIGIN_FORWARD, 0.6);
  assert.equal(ARROW_ORIGIN_HEIGHT_DIVISOR, 3);

  // A giant bat: idle sprite 3.2, so SetupDemoEnemy halves the capsule
  // to 1.6 and the transform (the sprite's centre) sits at 1.6.
  const bat = { feet: [0, 0, 0], yaw: 0, height: 1.6, centreOffset: 1.6 };
  const b = enemyArrowOrigin(bat);
  assert.ok(near(b[1], 1.6 + 1.6 / 3), `bat loose height ${b[1]}`);   // 2.1333...
  assert.ok(near(b[2], 0.6), 'yaw 0 is +Z, so the whole 0.6 lean is forward');
  assert.ok(near(b[0], 0), 'and nothing sideways');
  assert.ok(!near(b[1], 1.2), 'the old constant was nearly a metre low on a bat');

  // A rat: idle 0.9 floors the capsule at 1.6, transform 0.45 - and the
  // SAME constant that was a metre low on the bat is now high.
  const rat = { feet: [0, 0, 0], yaw: 0, height: 1.6, centreOffset: 0.45 };
  const r = enemyArrowOrigin(rat);
  assert.ok(near(r[1], 0.45 + 1.6 / 3), `rat loose height ${r[1]}`);   // 0.98333...
  assert.ok(r[1] < 1.2, 'a hardcoded 1.2 shot OVER a rat, and UNDER a bat: one constant cannot be both');

  // transform.forward is [sin(yaw), 0, cos(yaw)] - enemyMotor's own
  // convention (yawOf = atan2(dx, dz)); the lean must FOLLOW the facing.
  const east = enemyArrowOrigin({ feet: [10, 0, -4], yaw: Math.PI / 2, height: 1.8, centreOffset: 0.9 });
  assert.ok(near(east[0], 10 + 0.6), 'facing +X the lean is +X');
  assert.ok(near(east[2], -4, 1e-9), '...and nothing on Z');
  const back = enemyArrowOrigin({ feet: [0, 0, 0], yaw: Math.PI, height: 1.8, centreOffset: 0.9 });
  assert.ok(near(back[2], -0.6, 1e-9), 'facing -Z the lean is -Z');

  // The height term is the CAPSULE's, not the sprite's: two flyers with
  // the same 1.6 capsule and different sprites loose at the same lift
  // above their own transforms.
  const tall = enemyArrowOrigin({ feet: [0, 0, 0], yaw: 0, height: 1.6, centreOffset: 2.0 });
  assert.ok(near(tall[1] - 2.0, b[1] - 1.6), 'the lift is height/3 either way');
});

test('ROAD-H H1: BOTH archer pools take the one law, and neither carries feet + 1.2', () => {
  const dc = src('scenes/dungeonContext.js');
  const ef = src('scenes/exteriorFoes.js');
  assert.match(dc, /const from = foeDeps\.enemyArrowOrigin\(f\.ai\);/, 'the dungeon archer');
  assert.match(ef, /const from = enemyArrowOrigin\(f\.ai\);/, 'the exterior/interior pool');
  for (const [name, body] of [['dungeonContext', dc], ['exteriorFoes', ef]]) {
    assert.ok(!/feet\[1\] \+ 1\.2/.test(body), `${name} still looses from the guessed feet + 1.2`);
  }
  // The NON-arrow enemy cast stays the BARE transform (AUDIT 62 F21) -
  // GetAimPosition adds the lean only inside `if (isArrow)` (:528).
  assert.match(src('characters/enemyCasting.js'),
    /const from = \[f\.ai\.feet\[0\], casterTransformY, f\.ai\.feet\[2\]\];/,
    'the spell loose point is untouched by the arrow arm');
});

// ---------------------------------------------------------------
// H1b - THE CROUCH DIP
// ---------------------------------------------------------------

test('ROAD-H H1b: the aim is measured from the BARE transform, and dips 0.05 at a crouching player', () => {
  assert.equal(ARROW_CROUCH_DIP, 0.05);   // DaggerfallMissile.cs:585, Vector3.down * 0.05f

  const ai = { feet: [0, 0, 0], yaw: 0, height: 1.6, centreOffset: 1.6 };
  // :581 subtracts caster.transform.position - NOT the offset loose
  // point GetAimPosition returns. The two functions do not share an
  // origin, and enemyTransformPoint is the one C# measures from.
  const t = enemyTransformPoint(ai);
  assert.deepEqual(t, [0, 1.6, 0]);
  assert.notDeepEqual(t, enemyArrowOrigin(ai), 'origin and aim origin are different points in DFU');

  const aim = [0, 1.6, 10];   // dead level with the transform
  const straight = arrowAimDirection(t, aim, { targetIsPlayer: true, playerCrouching: false });
  assert.deepEqual(straight, [0, 0, 1]);
  assert.ok(near(Math.hypot(...straight), 1), 'undipped it is a unit vector');

  const dipped = arrowAimDirection(t, aim, { targetIsPlayer: true, playerCrouching: true });
  assert.ok(near(dipped[1], -0.05), `the dip is exactly 0.05 below the normalised aim: ${dipped[1]}`);
  assert.deepEqual([dipped[0], dipped[2]], [0, 1], 'and nothing else moves');
  // THE TOOTH: :584-585 adds AFTER the .normalized and nothing
  // renormalises - DoMissile stores the vector as-is (:470) and the
  // flight is `direction * MovementSpeed * deltaTime` (:293).
  assert.ok(Math.hypot(...dipped) > 1, 'the dipped vector is NOT renormalised');
  assert.ok(near(Math.hypot(...dipped), Math.hypot(1, 0.05)), 'its length is exactly sqrt(1 + 0.05^2)');

  // The gate has two other halves: it is an arrow at THE PLAYER only.
  assert.deepEqual(arrowAimDirection(t, aim, { targetIsPlayer: false, playerCrouching: true }), [0, 0, 1],
    'a foe-vs-foe shaft takes no dip whoever is crouching (EntityType == Player, :584)');
});

test('ROAD-H H1b: the crouch flag is the LATCHED state, carried beside playerHeight - a swimmer at 0.9 draws no dip', () => {
  const entity = { skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), activeEffects: [] };
  // PlayerHeightChanger.cs:54-57 gives 0.9 to a CROUCH and 0.9-class
  // heights to the swim/sink case alike, so height cannot be the gate.
  const crouched = sensesContext(entity, 0, { playerHeight: 0.9, playerCrouching: true });
  const swimming = sensesContext(entity, 0, { playerHeight: 0.9, playerCrouching: false });
  assert.equal(crouched.playerHeight, swimming.playerHeight, 'same capsule');
  assert.equal(crouched.playerCrouching, true);
  assert.equal(swimming.playerCrouching, false);
  assert.equal(sensesContext(entity, 0, {}).playerCrouching, false, 'the headless default');

  const t = [0, 1.6, 0], aim = [0, 1.6, 10];
  const a = arrowAimDirection(t, aim, { targetIsPlayer: true, playerCrouching: crouched.playerCrouching });
  const b = arrowAimDirection(t, aim, { targetIsPlayer: true, playerCrouching: swimming.playerCrouching });
  assert.ok(near(a[1], -0.05), 'the crouched player draws the dip');
  assert.equal(b[1], 0, 'the swimming one at the SAME height does not');
});

test('ROAD-H H1b: all four hosts fill playerCrouching, and both archer sites read it', () => {
  assert.match(src('scenes/shared.js'), /playerHeight = CAPSULE_HEIGHT, playerCrouching = false \} = \{\}\)/,
    'sensesContext takes it beside playerHeight');
  assert.match(src('scenes/shared.js'), /^\s*playerCrouching,$/m, 'and answers it');
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js']) {
    assert.match(src(h), /playerCrouching: !!player\.crouching,/, `${h} fills it from PlayerMotor's latch`);
  }
  // The dungeon host takes it as a drawFoes argument (its senses
  // context is built inside the draw), and both of its mounts pass it.
  assert.match(src('scenes/dungeonContext.js'), /playerBobY = 0, playerCrouching = false\) \{/);
  assert.match(src('scenes/dungeonContext.js'), /\.\.\._activity, playerHeight, playerCrouching,/);
  for (const h of ['scenes/dungeon.js', 'scenes/worldModes.js']) {
    assert.match(src(h), /drawFoes\(dt, canvas[^\n]*!!player\.crouching\)/, `${h} passes the latch into drawFoes`);
  }
  assert.match(src('scenes/dungeonContext.js'), /playerCrouching: !!_senses\.playerCrouching/, 'the dungeon archer reads it');
  assert.match(src('scenes/exteriorFoes.js'), /playerCrouching: !!senses\.playerCrouching/, 'the exterior archer reads it');
  // ...and both measure the aim from the BARE transform (:581), not
  // from the offset loose point GetAimPosition returns (:534-538).
  assert.match(src('scenes/dungeonContext.js'),
    /foeDeps\.arrowAimDirection\(foeDeps\.enemyTransformPoint\(f\.ai\), aim,/);
  assert.match(src('scenes/exteriorFoes.js'),
    /arrowAimDirection\(enemyTransformPoint\(f\.ai\), aim,/);
});

test('ROAD-H H1b (review): the exterior pool LOOSES a level shaft at a foe while the player crouches', () => {
  // THE TOOTH THE SPELLING MISSED. DaggerfallMissile.cs:584 gates the
  // dip on three terms - `IsArrow && enemySenses.Target?.EntityType ==
  // EntityTypes.Player && gm.PlayerMotor.IsCrouching`. The middle one
  // is only live where a foe can select a foe, which is this pool; a
  // call site handing a hardcoded `true` would dip every shaft on the
  // street whenever the player happened to duck, which the reference
  // forbids. So drive the pool, with the player crouching, and read
  // the direction it actually hands the seam.
  const shots = [];
  const pool = createExteriorFoes(poolRig({ onArrow: (from, dir, f) => shots.push({ from, dir, f }) }));
  const victim = foeRec([0, 0, 10], null);
  const archer = foeRec([0, 0, 0], victim);
  archer.mobile.shootArrow = true;   // EnemyAttack's BowDamage frame
  pool.foes.push(archer);
  pool.update(0.016, [3, 0, 0], [3, 1.6, 0], { playerHeight: 0.9, playerCrouching: true });

  assert.equal(shots.length, 1, 'the shoot frame loosed');
  const { dir, from } = shots[0];
  // Both transforms sit at feet + 0.9, so the aim is dead level and
  // any Y at all could only have come from the dip.
  assert.equal(dir[1], 0, `a shaft at a FOE takes no dip while the PLAYER crouches: ${dir[1]}`);
  assert.ok(near(Math.hypot(...dir), 1), 'and it is still the bare unit aim vector');
  assert.deepEqual(dir, [0, 0, 1]);
  // ...and the same tick's loose point is still GetAimPosition's
  // (:534-537), so this drive covers H1's wiring at the same seam.
  assert.ok(near(from[1], 0.9 + 1.8 / 3), `the loose height is transform + height/3: ${from[1]}`);
  assert.ok(near(from[2], 0.6), 'with the whole forward lean at yaw 0');

  // The player arm of the SAME gate, through the SAME call site: the
  // archer selects the player and the shaft dips, so the assertion
  // above is the target term and not a dead branch.
  const atPlayer = foeRec([0, 0, 0], null);
  atPlayer.ai._armedTargeting = false;   // unarmed selection - the player is the target
  atPlayer.mobile.shootArrow = true;
  const pool2 = createExteriorFoes(poolRig({ onArrow: (fromP, dirP) => shots.push({ from: fromP, dir: dirP }) }));
  pool2.foes.push(atPlayer);
  pool2.update(0.016, [0, 0, 10], [0, 1.6, 10], { playerHeight: 1.8, playerCrouching: true });
  assert.equal(shots.length, 2, 'the second pool loosed too');
  assert.ok(near(shots[1].dir[1], -0.05), `at the CROUCHING player the same site dips 0.05: ${shots[1].dir[1]}`);
});

// ---------------------------------------------------------------
// H1c - THE PLAYER'S OWN ARROW ORIGIN
// ---------------------------------------------------------------

test("ROAD-H H1c: the player's shaft leaves the bow hand - 0.11 down the CAMERA's up, 0.15 to the side", () => {
  assert.equal(PLAYER_ARROW_DOWN, 0.11);   // DaggerfallMissile.cs:543
  assert.equal(PLAYER_ARROW_SIDE, 0.15);   // :545

  const eye = [0, 1.7, 0];
  // Level, facing +Z: camera up is world up and camera right is +X.
  const level = playerArrowOrigin(eye, [0, 0, 1], false);
  assert.ok(near(level[0], 0.15), 'right-handed: 0.15 to the RIGHT (:546-547)');
  assert.ok(near(level[1], 1.7 - 0.11), '0.11 DOWN');
  assert.ok(near(level[2], 0), 'nothing forward - GetAimPosition adds no lean for the player');

  // FlipHorizontal (Controls/Handedness == 1) subtracts the same
  // vector (:548-549) - the sign is the whole of the difference.
  const left = playerArrowOrigin(eye, [0, 0, 1], true);
  assert.ok(near(left[0], -0.15), 'left-handed: 0.15 to the LEFT');
  assert.ok(near(left[1], level[1]), 'and the drop is unchanged');

  // Facing +X (yaw 90): right = (cos yaw, 0, -sin yaw) = (0, 0, -1).
  const east = playerArrowOrigin(eye, [1, 0, 0], false);
  assert.ok(near(east[2], -0.15) && near(east[0], 0), `the side offset follows the facing: ${east}`);

  // THE TOOTH: the drop is `MainCamera.rotation * -transform.up`, so it
  // tilts BACK with the pitch - it is not a world-space -Y.
  const p = Math.PI / 6;   // 30 degrees up
  const up = playerArrowOrigin(eye, [0, Math.sin(p), Math.cos(p)], false);
  assert.ok(near(up[1], 1.7 - 0.11 * Math.cos(p)), `pitched, the vertical drop shrinks to 0.11*cos(pitch): ${up[1]}`);
  assert.ok(near(up[2], 0.11 * Math.sin(p)), 'and the remainder goes BEHIND the eye, along the camera up');
  assert.ok(Math.abs(up[2]) > 1e-6, 'a world-space -Y drop would leave Z untouched');

  // Straight down: the side axis is degenerate and must not divide by
  // zero (the drop is then along +Z, camera up under a -Y forward).
  const down = playerArrowOrigin(eye, [0, -1, 0], false);
  assert.ok(down.every(Number.isFinite), `no NaN looking straight down: ${down}`);
});

test('ROAD-H H1c: BOTH arrow spawn seams apply it, so every host inherits the bow hand', () => {
  // GetAimPosition runs INSIDE the missile (DaggerfallMissile.cs:471),
  // not at the caller, so the port applies it at the two spawn seams -
  // which is why the four hosts' loose lines are untouched and no host
  // can forget it. An ENEMY shaft arrives with its own origin already
  // applied (enemyArrowOrigin) and must NOT be offset again.
  assert.match(src('combat/arrowFlight.js'),
    /pos: meta\.fromPlayer \? playerArrowOrigin\(from, dir\) : \[\.\.\.from\],/);
  assert.match(src('scenes/dungeonContext.js'),
    /pos: fromPlayer \? playerArrowOrigin\(from, dir\) : \[\.\.\.from\],/);
  // FlipHorizontal is read LIVE at the loose, off the same stored
  // Controls/Handedness the screen weapon draws by (StartGameBehaviour
  // :269) - DFU reads the one ScreenWeapon field in both places too.
  assert.match(src('systems/spellcast.js'),
    /const bowHandFlipped = \(\) => getInt\('Controls', 'Handedness', 0, 3\) === 1;/);
  assert.match(src('systems/spellcast.js'),
    /export function playerArrowOrigin\(eye, lookDir, flipHorizontal = bowHandFlipped\(\)\) \{/);
});

// ---------------------------------------------------------------
// H2 - THE AREA-OF-EFFECT SWEEP
// ---------------------------------------------------------------

test('ROAD-H H2: DoAreaOfEffect is an OverlapSphere against CAPSULES - the rim is radius + the body', () => {
  assert.equal(EXPLOSION_RADIUS, 4.0);          // DaggerfallMissile.cs:38
  assert.equal(BODY_CAPSULE_RADIUS, 0.45);      // the prefab's 0.4 + 0.05 skin

  // THE PIN THE BRIEF ASKS FOR: a foe whose capsule EDGE is inside the
  // blast while its CENTRE is outside. DFU's OverlapSphere hits it;
  // the port's point-at-the-centre-within-4.0 measure did not.
  const edge = { dead: false, ai: { feet: [4.3, 0, 0], height: 1.8 } };
  assert.deepEqual(sweepFoes([0, 0.9, 0], EXPLOSION_RADIUS, [edge]), [edge],
    '4.3 out is inside 4.0 + 0.45');
  assert.ok(Math.hypot(4.3, 0) > EXPLOSION_RADIUS, '...and its centre is outside the bare radius, which is the point');
  const clear = { dead: false, ai: { feet: [4.46, 0, 0], height: 1.8 } };
  assert.deepEqual(sweepFoes([0, 0.9, 0], EXPLOSION_RADIUS, [clear]), [], 'past the rim it is clear');
  const corpse = { dead: true, ai: { feet: [0, 0, 0], height: 1.8 } };
  assert.deepEqual(sweepFoes([0, 0.9, 0], EXPLOSION_RADIUS, [corpse]), [], 'the dead are not swept');

  // The capsule is a SEGMENT, so a tall foe is caught along its whole
  // body, and the segment is the INNER one (feet + r .. feet + h - r).
  const giant = { dead: false, ai: { feet: [0, 0, 0], height: 3 } };
  assert.deepEqual(sweepFoes([0, 2.4, 0], 0.2, [giant]), [giant], 'a burst at its chest');
  assert.deepEqual(sweepFoes([0, 0.9, 0], 0.2, [giant]), [giant], '...and at its knee');
  assert.deepEqual(sweepFoes([0, -0.7, 0], 0.2, [giant]), [],
    'below the lower hemisphere centre by more than 0.2 + 0.45 it clears');
  assert.deepEqual(sweepFoes([0, 3.2, 0], 0.2, [giant]), [],
    'and above the upper one (the axis tops out at height - r, not at height)');

  // Unity refuses a capsule shorter than its own diameter: under 2r the
  // two hemisphere centres coincide and it is a sphere.
  const flat = { dead: false, ai: { feet: [0, 0, 0], height: 0.6 } };
  assert.equal(sphereOverlapsCapsule([0, 0.3, 0], 0.1, flat.ai.feet, 0.6), true);
  assert.equal(sphereOverlapsCapsule([0, 0.86, 0], 0.1, flat.ai.feet, 0.6), false,
    'the collapsed sphere sits at h/2, so 0.55 + 0.1 + 0.45 is the reach');

  // ONE body of arithmetic: the contact test is the same function at
  // the missile's own radius (AUDIT 62 F21's law, unmoved).
  const feet = [0, 0, 0];
  for (const y of [-1, 0, 0.44, 0.9, 1.8, 2.3]) {
    assert.equal(missileHitsCapsule([0.4, y, 0], feet, 1.8),
      sphereOverlapsCapsule([0.4, y, 0], MISSILE_COLLIDER_RADIUS, feet, 1.8),
      `missileHitsCapsule is sphereOverlapsCapsule at the missile radius (y=${y})`);
  }
  assert.match(src('systems/spellcast.js'),
    /export function missileHitsCapsule\(pos, feet, height\) \{\n\s*return sphereOverlapsCapsule\(pos, MISSILE_COLLIDER_RADIUS, feet, height\);\n\}/,
    'and it is a call, not a second copy');
});

test('ROAD-H H2: explodeAt measures the PLAYER as a capsule at its LIVE height, not a point at feet + 0.9', () => {
  const world = { hurt: 0, foeHurt: 0, said: [] };
  const player = {
    isPlayer: true, level: 1, health: 100, maxHealth: 100, magicka: 500, maxMagicka: 500,
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
    stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
  };
  const foe = {
    dead: false, ai: { feet: [4.3, 0, 0], height: 1.8 },
    entity: { level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] },
  };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt: (n) => { world.hurt += n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: () => {} },
    say: (l) => world.said.push(l),
    surfacePlayer() {},
    foes: () => [foe],
    foeSinks: () => ({ hurt: (n) => { world.foeHurt += n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
  });
  const spell = {
    name: 'Blast', index: 91, element: 4, rangeType: 4,
    effects: [{ type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }],
  };

  // A CROUCHED player 4.2 out, blast at its own mid-capsule height: the
  // sphere overlaps the 0.9 capsule (4.2 <= 4.0 + 0.45), where the old
  // point at feet + 0.9 sat 4.224 from the blast and was missed.
  magic.explodeAt([0, 0.45, 0], spell, 1, [4.2, 0, 0], null, { playerHeight: 0.9 });
  assert.ok(world.hurt > 0, 'the crouched player is caught');
  assert.ok(world.foeHurt > 0, 'and so is the foe whose capsule edge is inside the radius');

  // ...and the rim still ends: 4.46 out is past 4.0 + 0.45.
  const before = world.hurt;
  magic.explodeAt([0, 0.45, 0], spell, 1, [4.46, 0, 0], null, { playerHeight: 0.9 });
  assert.equal(world.hurt, before, 'past the rim nothing lands on the player');

  // The height is threaded, not assumed: a blast level with a MOUNTED
  // player's chest is inside its 2.6 capsule and outside a 0.9 one.
  const tallBefore = world.hurt;
  magic.explodeAt([0, 2.0, 0], spell, 1, [4.3, 0, 0], null, { playerHeight: 2.6 });
  assert.ok(world.hurt > tallBefore, 'the mounted player is struck at 2.0');
  const crouchBefore = world.hurt;
  magic.explodeAt([0, 5.0, 0], spell, 1, [0, 0, 0], null, { playerHeight: 0.9 });
  assert.equal(world.hurt, crouchBefore, 'a burst 5.0 overhead clears a CROUCHED capsule, whose crown is 0.45');
  magic.explodeAt([0, 5.0, 0], spell, 1, [0, 0, 0], null, { playerHeight: 1.8 });
  assert.ok(world.hurt > crouchBefore, '...and the same burst catches a STANDING one, whose crown is 1.35');
});

test('ROAD-H H2: the sweep and the player arm are wired through the one helper, and every explodeAt caller carries the height', () => {
  const sc = src('systems/spellcast.js');
  assert.match(sc, /if \(sphereOverlapsCapsule\(pos, radius, f\.ai\?\.feet, f\.ai\?\.height\)\) out\.push\(f\);/,
    'sweepFoes measures the capsule');
  assert.ok(!/f\.ai\.feet\[1\] \+ \(f\.ai\.height \?\? 1\.8\) \/ 2, f\.ai\.feet\[2\]\];\n\s*if \(Math\.hypot/.test(sc),
    'and no longer a point at the capsule centre within the bare radius');
  const hm = src('scenes/hostMagic.js');
  assert.match(hm, /if \(playerFeet && sphereOverlapsCapsule\(pos, EXPLOSION_RADIUS, playerFeet, playerHeight\)\)/);
  assert.ok(!/playerFeet\[1\] \+ 0\.9 - pos\[1\]/.test(hm), 'the feet + 0.9 point is gone');
  // Every caller of explodeAt hands it the live capsule.
  for (const m of hm.matchAll(/\bexplodeAt\((?!pos, spell)[^\n]*/g)) {
    assert.match(m[0], /playerHeight/, `hostMagic explodeAt caller carries the height: ${m[0].trim()}`);
  }
  for (const m of src('scenes/dungeonContext.js').matchAll(/magic\.explodeAt\([^\n]*/g)) {
    assert.match(m[0], /playerHeight/, `dungeon explodeAt caller carries the height: ${m[0].trim()}`);
  }
  // ...including the enemy AreaAroundCaster arm, which reaches
  // explodeAt through the shared cast executor.
  assert.match(src('characters/enemyCasting.js'), /\{ excludeFoe: f, playerHeight \}\);/);
  assert.match(src('scenes/dungeonContext.js'), /playerFeet: lastPlayerFeet, playerHeight: lastPlayerHeight,/);
  assert.match(src('scenes/exteriorFoes.js'), /playerFeet, playerHeight: _lastPlayerHeight,/);
  // ...and the PRODUCERS that keep those two latches live. The review
  // round found the consumers pinned and the producers not: delete
  // either assignment and both latches sit at the standing default
  // forever, so an AoC blast measures a 1.8 capsule for a crouched or
  // mounted player - exactly the defect H2 exists to close. The
  // exterior half is driven behaviourally below; the dungeon host is
  // a whole scene, so its frame-loop write is pinned by spelling.
  assert.match(src('scenes/dungeonContext.js'),
    /lastPlayerFeet = \[\.\.\.playerFeet\]; lastPlayerHeight = playerHeight;/,
    'the dungeon frame loop latches the LIVE capsule beside the feet');
  assert.match(src('scenes/exteriorFoes.js'),
    /_lastPlayerHeight = senses\.playerHeight \?\? CAPSULE_HEIGHT;/,
    'and the exterior tick latches it from the senses context');
});

test('ROAD-H H2 (review): the exterior pool CARRIES the tick\'s live capsule into the enemy AreaAroundCaster blast', () => {
  // DaggerfallMissile.cs:280-282 sends AreaAroundCaster through
  // DoAreaOfEffect, whose catch is an OverlapSphere against COLLIDERS
  // (:481) - the player's CharacterController capsule, whose height
  // PlayerHeightChanger drops to 0.9 crouched and raises on a mount.
  // The consumer spelling `playerHeight: _lastPlayerHeight` keeps
  // matching when the producer is deleted, so read what the pool
  // actually hands the seam after a tick at a crouched capsule.
  const bangs = [];
  const pool = createExteriorFoes(poolRig({
    magicHooks: { explodeAt: (...a) => bangs.push(a), fireMissile: () => {} },
  }));
  const spell = {
    name: 'Aura', index: 92, element: 4, rangeType: 3,   // TargetTypes.AreaAroundCaster
    effects: [{ type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }],
  };
  const foe = foeRec([0, 0, 0], null);
  foe.ai._armedTargeting = false;   // the player is the target
  foe.caster = { update: () => ({ spell }) };   // the S16 decision, already made
  pool.foes.push(foe);

  pool.update(0.016, [2, 0, 0], [2, 1.6, 0], { playerHeight: 0.9, playerCrouching: true });
  assert.equal(bangs.length, 1, 'the AreaAroundCaster arm reached the host blast seam');
  assert.equal(bangs[0][5].playerHeight, 0.9, 'the blast measures the CROUCHED capsule the tick carried');

  // ...and it follows the capsule up, so it is a live read and not a
  // second constant: a mounted player is 2.6 (PlayerHeightChanger's
  // horse arm), and a blast that clears 0.9 catches him.
  pool.foes[0].mobile.shootArrow = false;
  pool.update(0.016, [2, 0, 0], [2, 1.6, 0], { playerHeight: 2.6, playerCrouching: false });
  assert.equal(bangs.length, 2);
  assert.equal(bangs[1][5].playerHeight, 2.6, 'and the MOUNTED capsule on the next tick');
  assert.notEqual(bangs[1][5].playerHeight, bangs[0][5].playerHeight, 'the latch is live, not a default');
});
