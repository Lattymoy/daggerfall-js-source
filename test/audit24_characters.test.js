// AUDIT 24 (the full-codebase parity sweep), characters group: three
// divergences the sweep confirmed against DFU C#, each pinned at the
// seam that carried it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import {
  EnemyAttack, BOW_SHOT_CHANCE, MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE,
} from '../src/characters/enemyAttack.js';
import { MELEE_DISTANCE } from '../src/characters/enemyMotor.js';
import { STRIKES } from '../src/characters/anims.js';
import { Collider } from '../src/player/collider.js';
import { rand, setSeed, getSeed } from '../src/formats/dfRandom.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { readFileSync } from 'node:fs';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
const mkC = () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  return c;
};

test('audit24 characters-1: a hovering flyer re-anchors LastGroundedY to its ALTITUDE', () => {
  // EnemyMotor.ApplyFallDamage:1414-1417 - `else if ((flies &&
  // !flyerFalls) || IsLevitating || IsSlowFalling) LastGroundedY =
  // transform.position.y`, with the source's own note "for flying
  // enemies, lastGroundedY is really lastAltitudeControlY". The bug:
  // the port only wrote the anchor on GROUND contact, so a bat that
  // ground-spawned and climbed measured its knocked-out-of-the-air
  // drop from the floor - i.e. zero - and was billed nothing.
  const ground = new EnemyAI(mkC(), [0, 0, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  assert.equal(ground.lastGroundedY, 0, 'spawns anchored at its own feet');
  // climb: a hovering flyer that is pursuing gets pulled toward the
  // target face, so drive it straight up by hand through the branch.
  ground.moving = false;
  for (let i = 0; i < 8; i++) { ground.feet[1] += 1; ground.update(1 / 60, [0, 0, -30]); }
  assert.equal(ground.feet[1], 8, 'the fixture climbed to 8');
  assert.equal(ground.lastGroundedY, 8, 'the anchor followed the altitude, not the floor');
  // and it keeps following while the flyer MOVES, too (post-move).
  const mover = new EnemyAI(mkC(), [0, 6, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  for (let i = 0; i < 60; i++) mover.update(1 / 60, [0, 0, 10]);
  assert.ok(mover.moving || mover.feet[1] !== 6, 'the fixture actually pursued');
  assert.equal(mover.lastGroundedY, mover.feet[1], 'the anchor is the post-move altitude');
  // the payoff: the knocked flyer's drop is measured from the sky.
  const s = { feet: [0, 0, 0], lastGroundedY: 8, landedFall: 0, _airborne: true };
  EnemyAI.prototype._trackFall.call(s, true);
  assert.equal(s.landedFall, 8, 'an 8-unit fall out of the air is billed');
});

test('audit24 characters-2: the DFRandom byte draws mid-swing, and the timer re-arms with it', () => {
  // EnemyAttack.FixedUpdate:81 - `DFRandom.rand() % speed >= (speed >>
  // 3) + 6 && MeleeTimer == 0`. The draw is the LEFT operand and the
  // only early return above it is the SeducerTransform one-shot
  // (MobileUnit.OneShotPauseActionsWhilePlaying:174-183), never an
  // attack anim. The port used to skip the whole tick body while a
  // swing played, so the shared global LCG desynced for ~16 ticks
  // per swing.
  const ai = { _dist: 1.0, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200 };
  const player = [0, 0, 10];
  const a = new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0.0 });
  a.meleeTimer = 0;
  // one update lands the strike; the machine is now busy
  setSeed(12345);
  a.update(1 / 15, ai, player);
  assert.notEqual(a.machine.state, 'Idle', 'a swing is in flight');
  assert.ok(a.meleeTimer > 0, 'and the timer was re-armed on the strike');
  // TEN more classic ticks, all mid-swing: TEN draws, no more, no less
  const before = getSeed();
  const TICKS = 10;
  a.update(TICKS / 16, ai, player);
  const after = getSeed();
  setSeed(before);
  for (let i = 0; i < TICKS; i++) rand();
  assert.equal(getSeed(), after, 'exactly one DFRandom draw per mid-swing classic tick');
  // ...and MeleeAnimation returning true re-arms the timer even when
  // ChangeEnemyState (MobileUnit:143-146, "only change if in a
  // different state") does nothing to a swing already playing.
  const b = new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0.0 });
  b.meleeTimer = 0;
  setSeed(999);
  for (let i = 0; i < 60 && b.machine.state === 'Idle'; i++) b.update(1 / 16, ai, player);
  assert.notEqual(b.machine.state, 'Idle', 'the fixture has a swing in flight');
  b.meleeTimer = 0;                       // the timer runs out mid-swing
  let prevFrame = b.machine.frame, restarted = false, rearmed = false;
  for (let i = 0; i < 40; i++) {
    b.update(1 / 16, ai, player);
    if (b.machine.state === 'Idle') break;
    if (b.machine.frame < prevFrame) restarted = true;
    prevFrame = b.machine.frame;
    if (b.meleeTimer > 0) { rearmed = true; break; }
  }
  assert.ok(rearmed, 'a passing roll mid-swing re-armed the timer (FixedUpdate :85)');
  assert.equal(restarted, false, 'and the anim never restarted - ChangeEnemyState is a no-op there');
});

test('audit24 characters-3: the bow band carries DetectedTarget and the CanAct/GiveUpTimer gate', () => {
  // EnemyMotor.DoRangedAttack:573 gates on `inRange && TargetInSight &&
  // DetectedTarget`, and it is reached only through FixedUpdate:171
  // `if (CanAct) TakeAction()` - HandleNoAction:357-364 drops CanAct
  // the moment GiveUpTimer hits 0.
  const player = [0, 0, 10];
  const shoot = (over) => {
    const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2, rolls: () => 0.0 });
    a.rangedAttack = true; a.meleeTimer = 0;
    const ai = { _dist: 10, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200, ...over };
    let fired = false;
    for (let i = 0; i < 60; i++) if (a.update(1 / 15, ai, player).includes('hit')) fired = true;
    return fired || a.firedRanged;
  };
  assert.equal(shoot({}), true, 'a detected target inside the band is shot at');
  assert.equal(shoot({ detected: false }), false, 'a Chameleoned target is in sight but NOT detected');
  assert.equal(shoot({ giveUpTimer: 0 }), false, 'a foe that has given up cannot act at all');
  // ...and the bar is `> 0`, not `> 1`: HandleNoAction:359 drops CanAct
  // on `GiveUpTimer <= 0`, so the LAST tick before giving up still
  // acts. (The mutation campaign found this: every fixture above sits
  // at 200 or 0, and no fixture that never sits ON the bar can test
  // which side of it the code is.)
  assert.equal(shoot({ giveUpTimer: 1 }), true, 'one tick left is still a tick');
});

test('audit24 characters-3b: the bow roll is STRICT, and the strike index stays in range', () => {
  // DoRangedAttack:587 is `Random.value < 1/32f`. A roll landing
  // exactly ON the chance does NOT shoot - which no fixture at 0.0 or
  // 0.99 can tell you.
  const player = [0, 0, 10];
  const ai = { _dist: 10, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200 };
  const fire = (roll) => {
    const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2, rolls: () => roll });
    a.rangedAttack = true; a.meleeTimer = 0;
    for (let i = 0; i < 20; i++) a.update(1 / 15, ai, player);
    return a.firedRanged || a.machine.state !== 'Idle';
  };
  assert.equal(BOW_SHOT_CHANCE, 1 / 32);
  assert.equal(fire(BOW_SHOT_CHANCE), false, 'exactly 1/32 is NOT less than 1/32');
  assert.equal(fire(BOW_SHOT_CHANCE - 1e-12), true, 'a hair under it fires');
  // the strike pick is the port's own stand-in for classic's single
  // PrimaryAttack, and it must land inside STRIKES for EVERY roll in
  // [0,1). Driving the real code with a roll at the top of the range is
  // the only pin that says so: asserting Math.floor's arithmetic
  // separately is a pin on the test's own expression, and a mutant that
  // swapped the code to Math.round walked straight past it.
  // (liveSpeed 50, not 200: at 200 a whole strike completes inside one
  // 1/15 s update and the state is back to Idle before we can read it.)
  for (const roll of [0, 0.5, 0.9, 0.999999]) {
    const a = new EnemyAttack({ liveSpeed: 50, playerLevel: 1, reflexes: 2, rolls: () => roll });
    a.rangedAttack = false; a.meleeTimer = 0;
    setSeed(11);
    for (let i = 0; i < 40 && a.machine.state === 'Idle'; i++) {
      a.update(1 / 16, { ...ai, _dist: 1.0 }, player);
    }
    assert.notEqual(a.machine.state, 'Idle', `roll ${roll} started a strike`);
    assert.ok(STRIKES.includes(a.machine.state), `roll ${roll} picked ${a.machine.state}, not a STRIKE`);
  }
});

test('audit24 characters-3c: the band and the reach are STRICT at every bound', () => {
  // EnemyAttack.cs:28-29 - minRangedDistance 240/2048 and
  // maxRangedDistance 2048/2048 at GlobalScale, and DoRangedAttack:572
  // reads `> min && < max`. MeleeAnimation:158 refuses on
  // `DistanceToTarget > distance`. Every one of those bounds differs
  // from its opposite ONLY when the distance sits exactly on it, which
  // no fixture at 4 / 10 / 60 can arrange.
  const player = [0, 0, 10];
  const at = (dist, ranged) => {
    const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2, rolls: () => 0.0 });
    a.rangedAttack = ranged; a.meleeTimer = 0;
    const ai2 = { _dist: dist, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200 };
    setSeed(3);
    let hit = false;
    for (let i = 0; i < 60; i++) if (a.update(1 / 15, ai2, player).includes('hit')) hit = true;
    return { hit, ranged: a.firedRanged };
  };
  // ON the band floor: NOT in the band (strict >), so the bow is silent
  // and 6m is far past melee reach - nothing happens at all.
  assert.equal(at(MIN_RANGED_DISTANCE, true).hit, false, 'exactly 6m is outside the band');
  assert.equal(at(MIN_RANGED_DISTANCE + 0.01, true).ranged, true, 'a hair beyond it is inside');
  // ON the band ceiling: also outside (strict <)
  assert.equal(at(MAX_RANGED_DISTANCE, true).ranged, false, 'exactly 51.2m is outside the band');
  assert.equal(at(MAX_RANGED_DISTANCE - 0.01, true).ranged, true, 'a hair inside it is inside');
  // ON the melee reach: `dist > MeleeDistance` refuses only ABOVE it,
  // so exactly 2.25 still swings.
  assert.equal(at(MELEE_DISTANCE, false).hit, true, 'exactly 2.25 is within reach');
  assert.equal(at(MELEE_DISTANCE + 0.01, false).hit, false, 'a hair beyond it is not');
});

test('audit24 characters-3d: the yaw vector reads X and Z, not X and Y', () => {
  // `dx = playerFeet[0] - ai.feet[0], dz = playerFeet[2] - ai.feet[2]`
  // feeds withinYaw. A fixture with the player straight ahead on +z and
  // the foe at the origin cannot tell index 2 from index 1 - both read
  // zero - so the foe stands OFF the axis here.
  const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2, rolls: () => 0.0 });
  a.rangedAttack = false; a.meleeTimer = 0;
  // foe at the origin facing +x (yaw = PI/2), player 2m along +x and
  // 5m UP: the yaw gate must read the XZ bearing (dead ahead) and
  // ignore the height.
  const ai2 = { _dist: 2.0, feet: [0, 0, 0], yaw: Math.PI / 2, inSight: true, detected: true, giveUpTimer: 200 };
  setSeed(5);
  let hit = false;
  for (let i = 0; i < 60; i++) if (a.update(1 / 15, ai2, [2, 5, 0]).includes('hit')) hit = true;
  assert.equal(hit, true, 'the XZ bearing is dead ahead, whatever the height difference');
});

test('audit24 characters-0: entry 39 (Horse) carries the MobileTeams struct default', () => {
  // EnemyBasics.cs:1562 mints the Horse as `new MobileEnemy() { ID =
  // 39, }` - every other field is the struct default, and
  // MobileTeams' zero member is PlayerEnemy
  // (DaggerfallUnityEnums.cs), not "None".
  assert.equal(ENEMY_BASICS['39'].team, 'PlayerEnemy');
  // every entry now carries one, so nothing reaches a fallback...
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.team === undefined).length, 0);
  // ...and the fallback that remains answers with the struct default,
  // not a member MobileTeams does not have.
  assert.match(readFileSync(new URL('../src/characters/enemyEntity.js', import.meta.url), 'utf8'),
    /team: basics\.team \?\? 'PlayerEnemy'/);
});

test('audit24 characters-2b: a PACIFIED foe still burns its byte, and reads blind instead', () => {
  // EnemyAttack.FixedUpdate gates on `DisableAI || IsParalyzed`
  // (:55-56) and nothing else - a non-hostile foe still draws. What
  // stops it swinging is EnemySenses: :321-327 nulls the target for a
  // non-hostile motor and :410-414 forces targetInSight and
  // detectedTarget false.
  const c = mkC();
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const player = [0, 0, 2];
  ai.update(1 / 4, player);
  assert.equal(ai.inSight, true, 'hostile and looking straight at him');
  assert.equal(ai.detected, true);
  ai.isHostile = false;
  ai.update(1 / 4, player);
  assert.equal(ai.inSight, false, 'the target drop reads blind...');
  assert.equal(ai.detected, false, '...on both flags');
  // ...and the attack component, ticked with those blind senses, draws
  // its byte every classic tick and lands nothing.
  const a = new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0.0 });
  a.meleeTimer = 0;
  const blind = { _dist: 1.0, feet: [0, 0, 0], yaw: 0, inSight: false, detected: false, giveUpTimer: 200 };
  setSeed(4242);
  const before = getSeed();
  const TICKS = 8;
  const events = a.update(TICKS / 16, blind, player);
  const after = getSeed();
  setSeed(before);
  for (let i = 0; i < TICKS; i++) rand();
  assert.equal(getSeed(), after, 'eight ticks, eight draws - the stream keeps its place');
  assert.equal(a.machine.state, 'Idle', 'and nothing swung');
  assert.deepEqual(events, []);
});

test('audit24 characters-3e: the three gates a constant-roll fixture cannot separate', () => {
  // Three mutants outlived every fixture above, each for its own
  // reason. They are the campaign's whole point.
  const player = [0, 0, 10];
  const near = { _dist: 1.0, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200 };

  // (1) `attackRollPasses(...) && this.meleeTimer === 0` - swapped to
  // `||`, a foe whose timer is still running attacks anyway. Every
  // fixture so far sets meleeTimer 0, where && and || agree.
  const busy = new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0.0 });
  busy.meleeTimer = 5;                       // seconds still to run
  setSeed(11);
  let started = false;
  for (let i = 0; i < 30; i++) {
    busy.update(1 / 16, near, player);
    if (busy.machine.state !== 'Idle') { started = true; break; }
  }
  assert.equal(started, false, 'the timer gates the swing - both operands must hold');
  assert.ok(busy.meleeTimer > 0 && busy.meleeTimer < 5, 'and it only counted down');

  // (2) `dx = playerFeet[0] - ai.feet[0]` - swapped to index 1, the
  // yaw gate reads the player's HEIGHT as its x. A player dead ahead on
  // +z cannot tell the two apart (both read 0), and neither can one
  // off-axis in x with no height difference (the bearing's ratio is all
  // withinYaw sees). It takes height AND an off-axis bearing at once.
  const tall = new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0.0 });
  tall.meleeTimer = 0;
  setSeed(11);
  let hit = false;
  for (let i = 0; i < 30; i++) if (tall.update(1 / 16, { ...near, _dist: 2.0 }, [0, 9, 2]).includes('hit')) hit = true;
  assert.equal(hit, true, 'x=0, z=2 is dead ahead; the 9 units of height are not the x');

  // (3) the BOW arm's strike pick shares `rolls` with the 1/32 shot
  // gate, so a constant roll that opens the gate can only ever index
  // STRIKES[0] - the top of the roll domain is unreachable without a
  // SEQUENCE. Math.round there would index one past the end.
  const seq = (vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
  const archer = new EnemyAttack({
    liveSpeed: 50, playerLevel: 10, reflexes: 2,
    rolls: seq([0.0, 0.999999, 0.5]),        // gate opens, THEN the strike
  });
  archer.rangedAttack = true; archer.meleeTimer = 0;
  setSeed(11);
  const band = { ...near, _dist: 10 };
  for (let i = 0; i < 30 && archer.machine.state === 'Idle'; i++) archer.update(1 / 16, band, player);
  assert.equal(archer.firedRanged, true, 'the bow fired');
  assert.ok(STRIKES.includes(archer.machine.state),
    `the bow strike picked ${archer.machine.state}, not a STRIKE`);
});
