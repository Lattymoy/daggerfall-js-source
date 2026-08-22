// AUDIT 24 (the full-codebase parity sweep), characters group: three
// divergences the sweep confirmed against DFU C#, each pinned at the
// seam that carried it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
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
