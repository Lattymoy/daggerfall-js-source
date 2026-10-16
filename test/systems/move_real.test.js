// MOVE-REAL (Mac, 2026-09-30): RUNNING, JUMPING, SWIMMING AND CLIMBING PAST 100 COUNT REAL MOVEMENT, NOT A SPAM
// COUNTER - and MASTER-DOOR: the Master Skills button opens the Master Skills page.
//
//   "No spam protection, because running a lot is the normal way to use the skill. Instead, only real movement counts
//    past 100. Holding the run key while standing still or running against a wall won't count, so nobody can train
//    it AFK."
//
// Three layers, each pinned by behaviour: the motor's odometer (its own steps only - a wall, a carry, a spawn add
// nothing), the tally's weight (skillSoftcap.js movementTallyWeight), and the tick that hands one to the other. The
// times the patch notes promise are computed here from the law's own constants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  movementTallyWeight, MOVEMENT_SKILLS, MOVE_CREDIT_CAP, isMovementSkill, SOFTCAP_TIERS, softcapCostMultiplier,
  SPAM_FREE_BURST,
} from '../../src/systems/skillSoftcap.js';
import { SKILLS, tallySkill, tallyMovementSkill } from '../../src/systems/skills.js';
import { skillUsesForAdvancement, SKILL_ADVANCEMENT_MULTIPLIER } from '../../src/systems/advancement.js';
import { tickPlayerMinutes } from '../../src/systems/worldTick.js';
import { PlayerMotor, FIXED_DT, ODOMETER_MAX_SPEED } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A character with `id` at `value`, mastered, Master Skills on (offline's switch; online is always on). */
function master(id, value = 100) {
  const skills = new Array(35).fill(30);
  skills[id] = value;
  return {
    chargenDone: true, skillUses: new Array(35).fill(0), skills, stats: { strength: 50, endurance: 50 },
    activeEffects: [], lastSkillCheckTime: 0, fatigue: 3200, health: 50, maxHealth: 50,
    masterSkills: true, masteredSkills: [id], career: { primarySkills: [id], majorSkills: [], minorSkills: [] },
  };
}
const sinks = () => ({ drainFatigue() {}, hurt() {}, heal() {}, drainMagicka() {}, restoreFatigue() {}, restoreMagicka() {}, say() {} });

// ---- the law ------------------------------------------------------------------------------------------------------

test('MOVE-REAL: the four movement skills, on their own axes, and nothing else', () => {
  assert.deepEqual(Object.keys(MOVEMENT_SKILLS).map(Number).sort((a, b) => a - b),
    [SKILLS.Jumping, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Running].sort((a, b) => a - b));
  assert.equal(MOVEMENT_SKILLS[SKILLS.Running].axis, 'h', 'a run is across the ground');
  assert.equal(MOVEMENT_SKILLS[SKILLS.Jumping].axis, 'h', 'a jump in place goes nowhere');
  assert.equal(MOVEMENT_SKILLS[SKILLS.Climbing].axis, 'v', 'a climb is up or down the wall');
  assert.equal(MOVEMENT_SKILLS[SKILLS.Swimming].axis, 'hv', 'a swim is through the water, diving too');
  for (const id of [SKILLS.Stealth, SKILLS.Dodging, SKILLS.Mercantile, SKILLS.Destruction]) assert.equal(isMovementSkill(id), false);
});

test('MOVE-REAL: a run that covers the ground counts whole, four uses a second, with no spam damping', () => {
  const e = master(SKILLS.Running);
  e._odometer = { h: 0, v: 0 };
  assert.equal(movementTallyWeight(e, SKILLS.Running, 1, 100), 0, 'the first use only sets the mark (nothing is banked from before)');
  let sum = 0;
  const n = 4 * 600;   // ten minutes of running - 60x the utility burst the spam counter would allow
  for (let i = 0; i < n; i++) {
    e._odometer.h += 9 * 0.25;   // a 9 m/s run, one quarter second a use
    sum += movementTallyWeight(e, SKILLS.Running, 1, 100);
  }
  assert.equal(sum, n, 'every use whole');
  assert.ok(n > 10 * SPAM_FREE_BURST.utility, 'far past where the spam counter would have damped it');
});

test('MOVE-REAL: the run key held standing still or into a wall counts nothing, and a walk banks at most the cap', () => {
  const e = master(SKILLS.Running);
  e._odometer = { h: 0, v: 0 };
  movementTallyWeight(e, SKILLS.Running, 1, 100);
  let sum = 0;
  for (let i = 0; i < 4 * 3600; i++) sum += movementTallyWeight(e, SKILLS.Running, 1, 100);   // an hour AFK
  assert.equal(sum, 0, 'an hour of the run key held going nowhere');
  // a long walk (no run tallies), then the key held in place again: no more than MOVE_CREDIT_CAP uses
  e._odometer.h += 500;
  sum = 0;
  for (let i = 0; i < 400; i++) sum += movementTallyWeight(e, SKILLS.Running, 1, 100);
  assert.equal(sum, MOVE_CREDIT_CAP);
  // sliding along a wall at a third of the stride counts a third
  const s = master(SKILLS.Running);
  s._odometer = { h: 0, v: 0 };
  movementTallyWeight(s, SKILLS.Running, 1, 100);
  s._odometer.h += MOVEMENT_SKILLS[SKILLS.Running].stride / 3;
  assert.ok(Math.abs(movementTallyWeight(s, SKILLS.Running, 1, 100) - 1 / 3) < 1e-9);
});

test('MOVE-REAL: each skill reads its own axis and its own mark', () => {
  const e = master(SKILLS.Climbing);
  e._odometer = { h: 0, v: 0 };
  for (const id of [SKILLS.Climbing, SKILLS.Jumping, SKILLS.Swimming]) movementTallyWeight(e, id, 1, 100);
  e._odometer.h += 50;   // across the ground only
  assert.equal(movementTallyWeight(e, SKILLS.Climbing, 1, 100), 0, 'a climb check pressed under a ledge went nowhere up');
  assert.equal(movementTallyWeight(e, SKILLS.Jumping, 1, 100), 1, 'a jump that carried you counts');
  assert.equal(movementTallyWeight(e, SKILLS.Jumping, 1, 100), 1, '...and 50 m banks the cap, two jumps\' worth');
  e._odometer.v += 2;   // straight up the wall
  assert.equal(movementTallyWeight(e, SKILLS.Climbing, 1, 100), 1);
  assert.equal(movementTallyWeight(e, SKILLS.Jumping, 1, 100), 0, 'the jump spent its bank; the climb is not its ground');
  assert.equal(movementTallyWeight(e, SKILLS.Swimming, 1, 100), 1, 'through the water: either axis');
});

test('MOVE-REAL: no odometer, or a different motor\'s, counts nothing until it has moved', () => {
  const e = master(SKILLS.Running);
  assert.equal(movementTallyWeight(e, SKILLS.Running, 1, 100), 0, 'a host that handed none: nothing is known to have moved');
  e._odometer = { h: 1000, v: 0 };
  movementTallyWeight(e, SKILLS.Running, 1, 100);
  e._odometer = { h: 5, v: 0 };   // another host's motor, its own reading
  assert.equal(movementTallyWeight(e, SKILLS.Running, 1, 100), 0, 'a swap re-marks and banks nothing');
  e._odometer.h += 2;
  assert.equal(movementTallyWeight(e, SKILLS.Running, 1, 100), 1);
});

// ---- the tally door --------------------------------------------------------------------------------------------------

test('MOVE-REAL: below 100 the motion tally is TallySkill verbatim - the run key held in place still tallies (AUDIT 64 F7)', () => {
  const e = master(SKILLS.Running, 60);
  e._odometer = { h: 0, v: 0 };
  for (let i = 0; i < 40; i++) tallyMovementSkill(e, SKILLS.Running);
  assert.equal(e.skillUses[SKILLS.Running], 40);
});

test('MOVE-REAL: an unmastered skill at 100, or Master Skills off, is DFU\'s tally too', () => {
  const e = master(SKILLS.Running);
  e.masteredSkills = [];
  for (let i = 0; i < 40; i++) tallyMovementSkill(e, SKILLS.Running);
  assert.equal(e.skillUses[SKILLS.Running], 40, 'a skill that cannot pass 100 never spends the uses anyway');
});

test('MOVE-REAL: a trainer\'s or a quest\'s tally is no motion and keeps the general law', () => {
  const e = master(SKILLS.Running);
  e._odometer = { h: 0, v: 0 };   // standing in the guild hall
  tallySkill(e, SKILLS.Running, 1);
  assert.equal(e.skillUses[SKILLS.Running], 1, 'the utility law counts a lone use in full - no movement asked');
  assert.equal(e._moveMark, undefined, 'and it never touched the movement marks');
});

test('MOVE-REAL: the tick counts a moving run and refuses a standing one', () => {
  for (const [moving, want] of [[true, 4 * 60 - 1], [false, 0]]) {
    const e = master(SKILLS.Running);
    const odometer = { h: 0, v: 0 };
    for (let f = 0; f < 60 * 10; f++) {   // a minute at 10 frames a second
      if (moving) odometer.h += 9 * 0.1;
      tickPlayerMinutes({ entity: e, classicMinutes: 0, dt: 0.1, sinks: sinks(), activity: { runningTally: true, running: moving, standing: !moving, odometer }, rolls: () => 0.5 });
    }
    const got = e.skillUses[SKILLS.Running];
    assert.ok(Math.abs(got - want) <= 1, `${moving ? 'moving' : 'standing'}: ${got} uses, want ~${want}`);
  }
});

test('MOVE-REAL: a swim that goes nowhere, treading water, teaches a master nothing; a swim across does', () => {
  for (const [moving, min, max] of [[true, 1, Infinity], [false, 0, 0]]) {
    const e = master(SKILLS.Swimming);
    const odometer = { h: 0, v: 0 };
    for (let minute = 0; minute < 12; minute++) {
      for (let f = 0; f < 50; f++) {   // 5 real seconds - one game minute at 12x
        if (moving) odometer.h += 3 * 0.1;
        tickPlayerMinutes({ entity: e, classicMinutes: minute + f / 50, dt: 0.1, sinks: sinks(), activity: { swimming: true, odometer }, rolls: () => 0.5 });
      }
    }
    const got = e.skillUses[SKILLS.Swimming];
    assert.ok(got >= min && got <= max, `${moving ? 'swimming across' : 'treading water'}: ${got} uses`);
  }
});

test('MOVE-REAL: the tick and the climb route their motion tallies through the movement door', () => {
  const tick = read('src/systems/worldTick.js');
  assert.match(tick, /if \(activity\.odometer\) entity\._odometer = activity\.odometer;/);
  for (const id of ['Jumping', 'Running', 'Swimming']) assert.match(tick, new RegExp(`tallyMovementSkill\\(entity, SKILLS\\.${id}\\)`));
  assert.doesNotMatch(tick, /tallySkill\(entity, SKILLS\.(Jumping|Running|Swimming)\)/);
  assert.match(read('src/scenes/shared.js'), /tally: \(\) => tallyMovementSkill\(entity, SKILLS\.Climbing\),/);
  // every host that feeds the tick hands it the motor's odometer
  assert.match(read('src/scenes/world.js'), /odometer: player\.odometer,   \/\/ MOVE-REAL/);
  assert.match(read('src/scenes/exterior.js'), /odometer: player\.odometer,   \/\/ MOVE-REAL/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /odometer: player\.odometer,   \/\/ MOVE-REAL/, 'the interior');
  assert.match(wm, /fell: player\.landedFallDistance, odometer: player\.odometer \}\);/, 'the world-hosted dungeon\'s report');
  assert.match(read('src/scenes/dungeon.js'), /fell: player\.landedFallDistance, odometer: player\.odometer \}\);/, 'the standalone dungeon\'s report');
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /_activity\.odometer = odometer;/);
  assert.match(dc, /reportActivity\(\{[^}]*odometer = null \} = \{\}\)/);
});

// ---- the motor's odometer ------------------------------------------------------------------------------------------

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function floored({ wallAt = null } = {}) {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  if (wallAt != null) col.addMesh('world', [-20, 0, wallAt, 20, 0, wallAt, 20, 6, wallAt, -20, 6, wallAt], [0, 1, 2, 0, 2, 3], I);
  return col;
}
const input = (over = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...over });
function stood(col) {
  const m = new PlayerMotor(col);
  m.spawn(0, 0.05, 0);
  for (let f = 0; f < 6; f++) m.update(FIXED_DT, input(), 0);
  return m;
}

test('MOVE-REAL: the motor\'s odometer is the ground its own steps covered', () => {
  const m = stood(floored());
  const h0 = m.odometer.h, z0 = m.pos[2];
  for (let f = 0; f < 60; f++) m.update(FIXED_DT, input({ forward: 1, run: true }), 0);
  const moved = m.pos[2] - z0;
  assert.ok(m.isRunning, 'running');
  assert.ok(moved > 3, `a second's run covered ${moved.toFixed(2)} m`);
  assert.ok(Math.abs((m.odometer.h - h0) - moved) < 0.05, 'the odometer read the same ground');
});

test('MOVE-REAL: a run into a wall, a carry and a placement add nothing', () => {
  const m = stood(floored({ wallAt: 1.5 }));
  for (let f = 0; f < 60; f++) m.update(FIXED_DT, input({ forward: 1, run: true }), 0);   // reach the wall
  const atWall = m.odometer.h;
  for (let f = 0; f < 600; f++) m.update(FIXED_DT, input({ forward: 1, run: true }), 0);   // ten seconds pressed into it
  assert.ok(m.odometer.h - atWall < 0.05, `pressed into a wall: ${(m.odometer.h - atWall).toFixed(3)} m`);
  const o = { ...m.odometer };
  m.carryBy(12, 0, 0);            // a deck's carry (CSA-K)
  m.pinFeet(m.pos[0] + 30, m.pos[1], m.pos[2]);   // a helm pin (CSA-D)
  m.update(FIXED_DT, input(), 0);
  assert.ok(m.odometer.h - o.h < 0.01, 'none of it is the body\'s own');
  assert.ok(ODOMETER_MAX_SPEED * FIXED_DT >= 0.5, 'a step\'s bound stands well above any run');
});

// ---- the times the patch notes promise --------------------------------------------------------------------------------

test('MOVE-REAL: running constantly, the climb from 100 takes the hours the notes print', () => {
  // four whole uses a second (worldTick's quarter-second cadence), a career multiplier of 1, average Reflexes (x1)
  const hoursTo = (from, to, level) => {
    let s = 0;
    for (let v = from; v < to; v++) {
      s += skillUsesForAdvancement(v, SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Running], 1, level) * softcapCostMultiplier(v) / 4;
    }
    return s / 3600;
  };
  const table = { 20: [35, 120, 540], 30: [50, 175, 800] };
  for (const [level, [a, b, c]] of Object.entries(table)) {
    const t125 = hoursTo(100, 125, +level), t150 = t125 + hoursTo(125, 150, +level), t200 = t150 + hoursTo(150, 200, +level);
    for (const [got, want] of [[t125, a], [t150, b], [t200, c]]) {
      assert.ok(Math.abs(got - want) / want < 0.06, `level ${level}: ${got.toFixed(0)} h against the notes' ~${want} h`);
    }
  }
  assert.deepEqual(SOFTCAP_TIERS.map((t) => t.mult), [4, 8, 16], 'the ladder the estimate stands on');
});

// ---- MASTER-DOOR ------------------------------------------------------------------------------------------------------

test('MASTER-DOOR: the stats page keeps the off-rail Master Skills page instead of turning it into Character', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  const at = menu.indexOf('function pauseStats(body)');
  const body = menu.slice(at, menu.indexOf('\n}\n', at));
  assert.match(body, /const offRail = statsSec === 'master' && !!m\.master;/);
  assert.match(body, /if \(!offRail && !statsSections\(\)\.some\(\(\[id\]\) => id === statsSec\)\) statsSec = 'character';/);
  assert.ok(body.indexOf('const offRail') < body.indexOf("b.onclick = () => { statsSec = 'master'"), 'the guard runs on the render the button asks for');
  // the page is still the one the door opens, and the rail still never lists it
  assert.match(body, /master: statsMaster/);
  assert.match(body, /b\.onclick = \(\) => \{ statsSec = 'master'; _masterNote = null; render\(\); \};/);
  assert.doesNotMatch(menu.slice(menu.indexOf('const STATS_SECTIONS'), menu.indexOf(']);', menu.indexOf('const STATS_SECTIONS'))), /'master'/);
});
