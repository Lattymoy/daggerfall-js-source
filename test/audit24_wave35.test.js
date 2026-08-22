// AUDIT 24, wave 35: the other two arms of GetDestination, and the
// `return true` that keeps an archer at its distance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EnemyAI, MELEE_DISTANCE, MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE,
  LAST_HAD_LOS_TICKS, SEARCH_MULT_MAX, CLEAR_PATH_DEFAULT_DIST,
  CLASSIC_UPDATE_INTERVAL,
} from '../src/characters/enemyMotor.js';
import { hasRangedSpell } from '../src/characters/enemyCasting.js';
import { Collider } from '../src/player/collider.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
function world({ wall = null } = {}) {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-60, 0, -60, 60, 0, -60, 60, 0, 60, -60, 0, 60]), quadIdx, I);
  if (wall) c.addMesh('wall', new Float32Array([-60, 0, wall, 60, 0, wall, 60, 6, wall, -60, 6, wall]), quadIdx, I);
  return c;
}
const clearStub = () => ({
  // the ground is under us (FallCheck's downward ray) and nothing else
  // is anywhere (canSeeTarget's line, the obstacle probe)
  raycast: (o, d) => (d[1] < -0.5 ? 1 : Infinity),
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: () => ({ grounded: true }),
});
const senses = () => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 });
const tick = (ai, target, s = senses()) => { for (let i = 0; i < 4; i++) ai.update(1 / 60, target, s, false); };

test('audit24 wave35: the ranged band has ONE home, and the import runs one way', () => {
  assert.equal(MIN_RANGED_DISTANCE, 240 * GLOBAL_SCALE, 'EnemyAttack.cs:28');
  assert.equal(MAX_RANGED_DISTANCE, 2048 * GLOBAL_SCALE, ':29');
  assert.equal(MIN_RANGED_DISTANCE, 6);
  assert.equal(MAX_RANGED_DISTANCE, 51.2);
  const motor = rd('src/characters/enemyMotor.js');
  const attack = rd('src/characters/enemyAttack.js');
  const casting = rd('src/characters/enemyCasting.js');
  assert.ok(motor.includes('export const MIN_RANGED_DISTANCE = 240 * GLOBAL_SCALE;'), 'declared in the motor');
  assert.ok(attack.includes("export { MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE } from './enemyMotor.js';"), 'and re-exported');
  // the reason it moved: enemyAttack.js imports FROM the motor, so
  // declaring the band there and importing it here would close a cycle -
  // the third in three waves.
  assert.ok(attack.includes("from './enemyMotor.js';"), 'enemyAttack -> enemyMotor');
  assert.equal(/from '\.\/enemyAttack\.js'/.test(motor), false, 'and never back');
  assert.equal((`${motor}${attack}${casting}`.match(/^export const M(IN|AX)_RANGED_DISTANCE = /gm) ?? []).length, 2,
    'declared once each');
});

test('audit24 wave35: an archer STANDS OFF - it does not walk up to melee range', () => {
  const mk = (opts) => {
    const ai = new EnemyAI(clearStub(), [0, 0, 0], 0, { liveSpeed: 50, ...opts });
    ai.detected = true;
    ai.inSight = true;
    ai.lastKnownTargetPos = [0, 0, 20];
    ai.predictedTargetPos = ai.lastKnownTargetPos;
    ai.destination = ai.lastKnownTargetPos;
    ai._dist = 20;
    return ai;
  };
  const archer = mk({ hasBowAttack: true });
  archer.moving = true;   // it was closing in when it entered the band
  archer._classicTick([0, 0, 20]);
  assert.equal(archer.moving, false,
    'EnemyMotor.cs:468-470 returns on DoRangedAttack - and the early return must CLEAR the pursuit it interrupts, not merely skip the decision that would have set it');

  // out of the band at either end, it closes like anything else
  const tooClose = mk({ hasBowAttack: true });
  tooClose._dist = MIN_RANGED_DISTANCE;          // STRICTLY greater is required
  tooClose._classicTick([0, 0, 20]);
  assert.equal(tooClose.moving, true, 'the near edge is exclusive');
  const tooFar = mk({ hasBowAttack: true });
  tooFar._dist = MAX_RANGED_DISTANCE;
  tooFar._classicTick([0, 0, 20]);
  assert.equal(tooFar.moving, true, 'and so is the far one');

  // and every other leg of the gate
  const blind = mk({ hasBowAttack: true });
  blind.inSight = false;
  blind._classicTick([0, 0, 20]);
  assert.equal(blind.moving, true, 'no sight, no stand-off');
  const unarmed = mk({});
  unarmed._classicTick([0, 0, 20]);
  assert.equal(unarmed.moving, true, 'no bow and no spell, no stand-off');
  const caster = mk({ canCastRangedSpell: () => true });
  caster._classicTick([0, 0, 20]);
  assert.equal(caster.moving, false, 'a ranged caster stands off too');
});

test('audit24 wave35: the stand-off turns to face, and comes BEFORE the melee stop', () => {
  const ai = new EnemyAI(clearStub(), [0, 0, 0], Math.PI, { liveSpeed: 50, hasBowAttack: true });
  ai.detected = true; ai.inSight = true;
  ai.lastKnownTargetPos = [0, 0, 20];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  ai.destination = ai.lastKnownTargetPos;
  ai._dist = 20;
  const yaw0 = ai.yaw;
  ai._classicTick([0, 0, 20]);
  assert.notEqual(ai.yaw, yaw0, 'facing the wrong way, it turns');
  assert.equal(ai.moving, false);

  // the ordering matters: DoRangedAttack is called ahead of the
  // advance/retreat decision, so an archer that has somehow ended up
  // inside melee range is NOT handled by the ranged arm (the band's
  // near edge excludes it) but by the ordinary stop.
  const src = rd('src/characters/enemyMotor.js');
  const body = src.slice(src.indexOf('  _classicTick(playerFeet) {'));
  assert.ok(body.indexOf('_doRangedAttack(dx, dz)') < body.indexOf('distance <= MELEE_DISTANCE'),
    'ranged first, melee stop second');
  assert.ok(body.indexOf('if (detouring)') < body.indexOf('_doRangedAttack(dx, dz)'),
    'and the detour override first of all');
});

test('audit24 wave35: ClearPathToPosition is the two probes plus a cast, and it is a GATE', () => {
  const clear = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(clear._clearPathToPosition([0, 0.9, 20]), true, 'open floor is a clear path');

  // a wall inside the probe's reach fails on the obstacle flag alone
  const blocked = new EnemyAI(world({ wall: 0.3 }), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(blocked._clearPathToPosition([0, 0.9, 20]), false);
  assert.equal(blocked.obstacleDetected, true, 'and it leaves the flags set, as DFU does');

  // a wall BEYOND the probe but inside the cast fails on the cast
  const far = new EnemyAI(world({ wall: 8 }), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(far.obstacleDetected, false);
  assert.equal(far._clearPathToPosition([0, 0.9, 20]), false, 'the sphere cast reaches where the probe does not');
  assert.equal(far.obstacleDetected, false, 'without the probe having fired');
  // ...and the cast's reach is the ARGUMENT, so a short one does not see it
  assert.equal(far._clearPathToPosition([0, 0.9, 20], 4), true, 'a four-unit gate stops short of an eight-unit wall');
  assert.equal(CLEAR_PATH_DEFAULT_DIST, 30, 'the default GetDestination never uses');
});

test('audit24 wave35: GetDestination - reachable, unreachable, and the search ramp', () => {
  // ARM 2: a clear path takes the predicted position and resets the ramp.
  const near = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  near.inSight = true;
  near.lastKnownTargetPos = [0, 0, 12];
  near.predictedTargetPos = near.lastKnownTargetPos;
  near.searchMult = 5;
  near._getDestination([0, 0, 12]);
  assert.ok(Math.abs(near.destination[2] - 12) < 1e-9, 'straight at the target');
  assert.equal(near.searchMult, 0, 'and the search resets');

  // ARM 3: no path and no bow - walk to where it was last seen, then
  // past it along the way it was going, further each pass.
  const lost = new EnemyAI(world({ wall: 0.3 }), [0, 0, 0], 0, { liveSpeed: 50 });
  lost.inSight = false;
  lost.lastKnownTargetPos = [0, 0, 1];
  lost.predictedTargetPos = lost.lastKnownTargetPos;
  lost.lastPositionDiff = [0, 0, 3];     // it was heading +z
  lost.searchMult = 0;
  lost._getDestination([0, 0, 40]);
  assert.ok(Math.abs(lost.destination[2] - 1) < 1e-9, 'the first pass IS the last known position');
  assert.equal(lost.searchMult, 1, 'and the ramp starts');
  lost._getDestination([0, 0, 40]);
  assert.ok(Math.abs(lost.destination[2] - 2) < 1e-9, 'one unit further along the direction it was moving');

  // ...and only while the search position is still inside the stop
  // distance, so a foe standing still stops ramping as soon as the
  // point it is searching has walked out of its own melee reach.
  for (let i = 0; i < 40; i++) lost._getDestination([0, 0, 40]);
  assert.equal(lost.searchMult, 2, 'search 3 is 3 units out, past the 2.25 stop distance');
  assert.ok(SEARCH_MULT_MAX === 10, 'the ceiling exists for a foe that keeps up with its own search');

  // ...and it only climbs while the search position is inside the stop
  // distance, so a foe far from the last known position stops ramping
  const away = new EnemyAI(world({ wall: 0.3 }), [0, 0, 0], 0, { liveSpeed: 50 });
  away.inSight = false;
  away.lastKnownTargetPos = [0, 0, 30];
  away.predictedTargetPos = away.lastKnownTargetPos;
  away.lastPositionDiff = [0, 0, 1];
  away.searchMult = 0;
  away._getDestination([0, 0, 40]);
  assert.equal(away.searchMult, 0, 'thirty units away, the ramp holds');

  // THE SHOOTER OVERRIDE (:539-540): a bow-armed foe with the target in
  // sight heads for it whether the path is clear or not.
  const shooter = new EnemyAI(world({ wall: 0.3 }), [0, 0, 0], 0, { liveSpeed: 50, hasBowAttack: true });
  shooter.inSight = true;
  shooter.lastKnownTargetPos = [0, 0, 12];
  shooter.predictedTargetPos = shooter.lastKnownTargetPos;
  shooter.searchMult = 7;
  shooter._getDestination([0, 0, 12]);
  assert.ok(Math.abs(shooter.destination[2] - 12) < 1e-9, 'blocked, but it is a shooter');
  assert.equal(shooter.searchMult, 0);

  // THE CAST'S REACH is the distance to the PREVIOUS destination, not
  // ClearPathToPosition's default 30 (:539). A foe whose last
  // destination was close by must not see a wall far beyond it.
  const shortGate = new EnemyAI(world({ wall: 20 }), [0, 0, 0], 0, { liveSpeed: 50 });
  shortGate.inSight = false;
  shortGate.lastKnownTargetPos = [0, 0, 3];
  shortGate.predictedTargetPos = shortGate.lastKnownTargetPos;
  shortGate.destination = [0, 0, 3];          // prevDist = 3
  shortGate.lastPositionDiff = [0, 0, 1];
  shortGate.searchMult = 7;
  shortGate._getDestination([0, 0, 3]);
  assert.equal(shortGate.searchMult, 0,
    'a three-unit gate does not see a wall twenty units out, so the target is reachable');
  shortGate.destination = [0, 0, 40];         // now the gate reaches past it
  shortGate.searchMult = 7;                   // only the CLEAR-PATH arm resets this
  shortGate._getDestination([0, 0, 3]);
  assert.equal(shortGate.searchMult, 7,
    'and a forty-unit gate does see it, so the search arm runs instead');

  // THE CAST IS AIMED AT THE TARGET'S CENTRE, not its feet. Aimed at
  // feet the ray tilts down half a body over its whole length and
  // strikes the floor a few metres out - every distant target reads as
  // unreachable, and every foe searches instead of pursuing.
  const flat = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  flat.inSight = false;
  flat.lastKnownTargetPos = [0, 0, 40];
  flat.predictedTargetPos = flat.lastKnownTargetPos;
  flat.destination = [0, 0, 40];
  flat.lastPositionDiff = [0, 0, 1];
  flat.searchMult = 0;
  flat._getDestination([0, 0, 40]);
  assert.ok(Math.abs(flat.destination[2] - 40) < 1e-9,
    'forty units of open floor is a clear path');
  assert.equal(flat.searchMult, 0, 'so it pursues rather than searching');

  // ARM 1 still wins over both
  const detour = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  detour.lastKnownTargetPos = [0, 0, 12];
  detour.predictedTargetPos = detour.lastKnownTargetPos;
  detour.avoidObstaclesTimer = 0.5;
  detour.detourDestination = [3, 0, 0];
  detour._getDestination([0, 0, 12]);
  assert.deepEqual(detour.destination, [3, 0, 0]);
});

test('audit24 wave35: the aim bump is applied ONCE, in GetDestination', () => {
  // The first cut left it in _dir3 as well, and the flyer aimed 1.8
  // above the target's head - it stopped 3.6 short of melee range
  // instead of at it.
  const flyer = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  flyer.inSight = true;
  flyer.lastKnownTargetPos = [0, 0, 12];
  flyer.predictedTargetPos = flyer.lastKnownTargetPos;
  flyer._getDestination([0, 0, 12]);
  assert.ok(Math.abs(flyer.destination[1] - 1.8) < 1e-9, 'a flyer aims at the target FACE, once');
  const d = flyer._dir3(flyer.destination);
  const expect = Math.hypot(0, 1.8, 12);
  assert.ok(Math.abs(d[1] - 1.8 / expect) < 1e-9, 'and _dir3 adds nothing of its own');

  const walker = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50 });
  walker.inSight = true;
  walker.lastKnownTargetPos = [0, 0, 12];
  walker.predictedTargetPos = walker.lastKnownTargetPos;
  walker._getDestination([0, 0, 12]);
  assert.ok(Math.abs(walker.destination[1]) < 1e-9, 'a grounded foe aims at its own height');
});

/** A stub world whose LINE OF SIGHT can be switched, so the two senses
 *  arms - sight/earshot and the bare stealth check - can be driven
 *  apart. canSeeTarget reads raycastHit; the ground ray and the
 *  obstacle probe are answered separately. */
function sightStub() {
  const o = {
    los: true,
    raycast: (a, d) => (d[1] < -0.5 ? 1 : Infinity),
    raycastHit: () => ({ dist: o.los ? Infinity : 0.5, key: null }),
    capsuleCast: () => ({ dist: Infinity, key: null }),
    move: () => ({ grounded: true }),
  };
  return o;
}

test('audit24 wave35: the target-position MEMORY, and the LOS timer that guards it', () => {
  const c = sightStub();
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const s = senses();
  ai._targetPosPredict = true;
  ai._senses([0, 0, 5], s);
  assert.equal(ai.inSight, true, 'the fixture really can see');
  assert.deepEqual(ai.lastKnownTargetPos, [0, 0, 5], 'sight writes the live position');
  assert.equal(ai.lastHadLOSTimer, LAST_HAD_LOS_TICKS, 'EnemySenses.cs:455');
  assert.equal(ai.predictedTargetPos, ai.lastKnownTargetPos,
    'and in the CLASSIC path the predicted position IS the last known one (:475-476)');

  // A STEALTH-ONLY detection must NOT overwrite it while the LOS timer
  // stands - "enemies go to the last spot they saw the player instead
  // of walking into walls" (:461-465). Sight blocked, and far enough
  // away that hearing cannot stand in for it either.
  c.los = false;
  ai._stealthCheck = () => true;
  const far = [40, 0, 40];
  ai._senses(far, s);
  assert.equal(ai.inSight, false, 'the fixture really cannot see');
  assert.equal(ai.detected, true, 'but the stealth check found it');
  assert.deepEqual(ai.lastKnownTargetPos, [0, 0, 5], 'held');
  ai.lastHadLOSTimer = 0;
  ai._senses(far, s);
  assert.deepEqual(ai.lastKnownTargetPos, far, 'and released once the timer runs out');

  // the timer decays on the CLASSIC tick, not the fixed step (:445-449)
  const t = new EnemyAI(sightStub(), [0, 0, 0], 0, { liveSpeed: 50 });
  t.lastHadLOSTimer = 3;
  t._classicSenses([0, 0, 5], null);
  assert.equal(t.lastHadLOSTimer, 2);
});

test('audit24 wave35: lastPositionDiff needs TWO consecutive sighted prediction passes', () => {
  const c = sightStub();
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const s = senses();
  ai._targetPosPredict = true;
  ai._senses([0, 0, 5], s);
  assert.deepEqual(ai.lastPositionDiff, [0, 0, 0], 'the first sighting has nothing to difference');
  assert.equal(ai.awareOfTargetForLastPrediction, true);
  ai._senses([0, 0, 8], s);
  assert.deepEqual(ai.lastPositionDiff, [0, 0, 3], 'the second gives the movement');

  // sight lost between passes resets the pair, so the next difference
  // is not taken across the gap
  c.los = false;
  ai._stealthCheck = () => false;
  ai._senses([40, 0, 40], s);
  assert.equal(ai.awareOfTargetForLastPrediction, false);
  c.los = true;
  ai._senses([0, 0, 30], s);
  assert.deepEqual(ai.lastPositionDiff, [0, 0, 3], 'still the old one - this pass only re-anchors');
  ai._senses([0, 0, 34], s);
  assert.deepEqual(ai.lastPositionDiff, [0, 0, 4], 'and the pass after it differences again');

  // ...and nothing happens at all on a step that is not a prediction pass
  ai._targetPosPredict = false;
  ai._senses([0, 0, 99], s);
  assert.deepEqual(ai.lastPositionDiff, [0, 0, 4], 'off-cadence steps do not difference');
});

test('audit24 wave35: HandleNoAction - a target never seen means no action at all', () => {
  const ai = new EnemyAI(clearStub(), [0, 0, 0], 0, { liveSpeed: 50 });
  ai.detected = true;
  ai.searchMult = 6;
  assert.equal(ai.predictedTargetPos, null, 'the ResetPlayerPos sentinel');
  ai.moving = true;
  ai._classicTick([0, 0, 5]);
  assert.equal(ai.moving, false, 'EnemyMotor.cs:359-364 - CanAct goes false');
  assert.equal(ai.searchMult, 0, 'and the search ramp resets with it');
});

test('audit24 wave35: hasRangedSpell is the SELECTION-FREE half, and draws no roll', () => {
  let rolls = 0;
  const withRoll = () => { rolls++; return 0.5; };
  const ent = { magicka: 10, spells: [{ rangeType: 2 }] };
  assert.equal(hasRangedSpell(ent), true);
  assert.equal(hasRangedSpell({ magicka: 0, spells: [{ rangeType: 2 }] }), false, 'no magicka, no spell');
  assert.equal(hasRangedSpell({ magicka: 10, spells: [{ rangeType: 1 }] }), false, 'touch is not ranged');
  assert.equal(hasRangedSpell({ magicka: 10, spells: [{ rangeType: 4 }] }), true, 'AreaAtRange counts');
  assert.equal(hasRangedSpell(null), false);
  assert.equal(rolls, 0, 'and it never touches the stream');
  void withRoll;

  // the whole point: DFU's CanCastRangedSpell also SELECTS, and the
  // port's selection lives in EnemyCaster - a second pick here would
  // draw twice off the shared stream every frame.
  const casting = rd('src/characters/enemyCasting.js');
  assert.ok(casting.includes('export const hasRangedSpell ='), 'declared beside the picker it deliberately is not');
  const at = casting.indexOf('export const hasRangedSpell =');
  const decl = casting.slice(at, casting.indexOf(';', casting.indexOf('rangeType === 4', at)));
  assert.equal(/rolls/.test(decl), false, 'and takes no rolls argument');
});

test('audit24 wave35: every pool passes the two ranged deps', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/hasBowAttack: hasBowAttack\(basics\),/g) ?? []).length, 2, 'both dungeon branches');
  assert.equal((dc.match(/canCastRangedSpell: \(\) => foeDeps\.hasRangedSpell\(entity\),/g) ?? []).length, 2);
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.ok(xf.includes('hasBowAttack: hasBowAttack(basics),'));
  assert.ok(xf.includes('canCastRangedSpell: () => hasRangedSpell(entity),'));
  const cg = rd('src/scenes/cityGuards.js');
  // the watch has neither, and the literal sits beside the same literal
  // attack.rangedAttack that EnemyBasics justifies
  assert.ok(cg.includes('hasBowAttack: false,'));
  assert.ok(cg.includes('attack.rangedAttack = false;'));
  assert.equal(CLASSIC_UPDATE_INTERVAL, 0.0625, 'and the prediction cadence is the classic one');
});

test('audit24 wave35: the wave-34 re-read - three corrections it produced', () => {
  const motor = rd('src/characters/enemyMotor.js');
  // (a) ObstacleCheck records a door only within 22.5 degrees of facing
  // (:1170-1175). Wave 34 recorded any door the probe struck, and
  // FindDetour probes 45/90/135 degrees off - so a detouring foe would
  // have the host open a door behind it.
  assert.ok(motor.includes('if (withinYaw(this.yaw, dir[0], dir[2], STOP_YAW_GATE_DEG)) this.doorKey = hit.key;'),
    'the door record is yaw-gated');
  const ai = new EnemyAI({
    raycast: () => Infinity,
    capsuleCast: () => ({ dist: 0.1, key: 'door:9' }),
  }, [0, 0, 0], 0, { liveSpeed: 50, isActionDoor: (k) => String(k).startsWith('door:') });
  ai._obstacleCheck([0, 0, 1]);            // dead ahead
  assert.equal(ai.foundDoor, true);
  assert.equal(ai.doorKey, 'door:9', 'a door in front is recorded');
  const behind = new EnemyAI({
    raycast: () => Infinity,
    capsuleCast: () => ({ dist: 0.1, key: 'door:9' }),
  }, [0, 0, 0], 0, { liveSpeed: 50, isActionDoor: (k) => String(k).startsWith('door:') });
  behind._obstacleCheck([0, 0, -1]);       // a detour probe, 180 degrees off
  assert.equal(behind.foundDoor, true, 'still not an obstacle');
  assert.equal(behind.doorKey, undefined, 'but NOT recorded for OpenDoors');

  // (b) the stop distance measures to the DESTINATION unless the target
  // is in sight (:479-482).
  const lost = new EnemyAI(clearStub(), [0, 0, 0], 0, { liveSpeed: 50 });
  lost.detected = true;
  lost.inSight = false;
  lost.lastKnownTargetPos = [0, 0, 30];
  lost.predictedTargetPos = lost.lastKnownTargetPos;
  lost.destination = lost.lastKnownTargetPos;
  lost._stealthCheck = () => true;
  lost._dist = 1;                          // the player is right beside it...
  lost._classicTick([0, 0, 1]);
  assert.equal(lost.moving, true, '...but unseen, so it keeps walking to where it last saw them');
  lost.inSight = true;
  lost._classicTick([0, 0, 1]);
  assert.equal(lost.moving, false, 'and stops the moment it can actually see them');

  // (c) melee-first, arrow as the else-if (EnemyAttack.cs:97-105)
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    const src = rd(f);
    const m = src.indexOf('mobile.doMeleeDamage');
    const a = src.indexOf('mobile.shootArrow');
    assert.ok(m > 0 && a > m, `${f}: melee is tested first`);
    assert.ok(/else if \([^\n]*mobile\.shootArrow/.test(src), `${f}: and the arrow is the else-if`);
  }
});

test('audit24 wave35: end to end - an archer holds its ground, a brawler closes', () => {
  const run = (opts) => {
    const ai = new EnemyAI(world({}), [0, 0, 0], 0, { liveSpeed: 50, ...opts });
    ai.detected = true;
    ai.inSight = true;
    for (let i = 0; i < 200; i++) tick(ai, [0, 0, 20]);
    return Math.hypot(ai.feet[0], ai.feet[2] - 20);
  };
  const brawler = run({});
  assert.ok(brawler <= MELEE_DISTANCE + 0.5, `a melee foe closes: ${brawler.toFixed(2)}`);
  const archer = run({ hasBowAttack: true });
  assert.ok(archer > MIN_RANGED_DISTANCE - 0.5, `an archer holds the band: ${archer.toFixed(2)}`);
});
