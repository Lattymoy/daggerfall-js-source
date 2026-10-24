// FIELD BUGS 2026-10-01 #7 (MOVE-BANK) - "Running jumping climbing dint work passed 100"; Mac: "I dont care about DFU.
// We're our own thing now".
//
// The report reproduces whole on the code before MOVE-REAL (#475): there the spam counter let ten minutes of running at
// Running 110 count 41 uses (~2% of the run), a jump about a quarter of the jumps and a climb a quarter of its checks.
// MOVE-REAL fixed that (ten minutes now count ~2400 uses, every jump, every climbing check). What still failed a runner
// past 100 was the BUCKET: a mastered skill's uses still rode DFU's 20000 tally clamp (PlayerEntity.TallySkill's, which
// keeps the int32 `(uses * reflexesMod) >> 16` shift in range) and raiseSkills' past-100 arm kept less than a point of
// carry - so at four uses a second everything a runner ran past 83 minutes between two rests was thrown away, at level
// 30 a full bucket was 0.68 of the first point however long the run, and a pass that banked more than a point kept 0.99
// of the rest. Past 100 the count is progress's, spent in float: no bucket, and what a pass does not land is kept whole
// (re-priced at the next point's cost) for the next pass to land - one point a pass, as before.
//
// Driven on the producers: a chargen'd character (systems/chargen.js createCharacter over a custom career), mastered
// through systems/masterSkills.js masterSkill, a real PlayerMotor on a real Collider for its speed and its odometer
// object, the real tick (worldTick.js tickPlayerMinutes) for the run's tallies and the real raiseSkills for the rest.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS, tallyMovementSkill } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { raiseSkills, skillUsesForAdvancement, SKILL_ADVANCEMENT_MULTIPLIER, SKILL_RAISE_CHECK_INTERVAL } from '../../src/systems/advancement.js';
import { softcapCostMultiplier } from '../../src/systems/skillSoftcap.js';
import { tickPlayerMinutes } from '../../src/systems/worldTick.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { motorStats } from '../../src/scenes/shared.js';
import { playerEntity } from '../../src/characters/playerEntity.js';

const RUN = SKILLS.Running;
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({
  name: 'Runner', hp: 12, stats: STATS,
  skills: [SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming, SKILLS.Dodging, SKILLS.Stealth,
    SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking],
});

/** A chargen'd runner, Running mastered at `value` (online: Master Skills always in force - world.js stamps it). */
function runner(level, value = 100) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true;
  p.skills[RUN] = 100;
  assert.equal(masterSkill(p, RUN).ok, true, 'a primary skill at 100 can be mastered');
  p.skills[RUN] = value;
  p.level = level;
  return p;
}
const cost = (p, v = p.skills[RUN]) => skillUsesForAdvancement(v, SKILL_ADVANCEMENT_MULTIPLIER[RUN], p.career.advancementMultiplier, p.level) * softcapCostMultiplier(v);
const sinks = () => ({ drainFatigue() {}, hurt() {}, heal() {}, drainMagicka() {}, restoreFatigue() {}, restoreMagicka() {}, say() {} });

/** A real motor's run on open ground: its speed, and its own odometer object (the shape every host hands the tick). */
function realRun() {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', [-400, 0, -400, 400, 0, -400, 400, 0, 400, -400, 0, 400], [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col, motorStats(runner(1)));
  m.spawn(0, 0.05, 0);
  const go = { forward: 1, strafe: 0, run: true, jump: false, up: false, down: false };
  for (let f = 0; f < 30; f++) m.update(1 / 60, go, 0);
  const h0 = m.odometer.h;
  for (let f = 0; f < 120; f++) m.update(1 / 60, go, 0);   // two seconds
  assert.ok(m.isRunning);
  return { odometer: m.odometer, speed: (m.odometer.h - h0) / 2 };
}

test('MOVE-BANK: a level-30 master runs 100 minutes and rests - the pass banks the whole run, not the 20000 bucket', () => {
  const p = runner(30);
  const { odometer, speed } = realRun();
  assert.ok(speed > 8, `the real run covers ${speed.toFixed(2)} m/s`);
  let cm = p.lastSkillCheckTime;
  const dt = 0.25;
  for (let t = 0; t < 100 * 60; t += dt) {   // 100 minutes of running, the odometer moving at the motor's own speed
    odometer.h += speed * dt;
    cm = tickPlayerMinutes({ entity: p, classicMinutes: cm, dt, sinks: sinks(), rolls: () => 0.5,
      activity: { running: true, runningTally: true, standing: false, odometer } }).classicMinutes;
  }
  const ran = 4 * 100 * 60 - 1;   // four uses a second; the first only marks the odometer
  assert.ok(Math.abs(p.skillUses[RUN] - ran) <= 1, `every quarter second counted: ${p.skillUses[RUN]} of ${ran}`);
  assert.ok(cost(p) > p.skillUses[RUN], 'at level 30 the first point past 100 costs more than this whole run');
  assert.deepEqual(raiseSkills(p, Math.floor(cm), () => 0.5, () => {}), [], 'no point yet');
  const banked = p.skillProgress[RUN];
  assert.ok(Math.abs(banked - ran / cost(p)) < 2 / cost(p), `the pass banked ${banked.toFixed(3)} of a point, the run is ${(ran / cost(p)).toFixed(3)}`);
  assert.ok(banked > 20000 / cost(p) + 0.1, 'more than the 20000 bucket held');
  assert.equal(p.skillUses[RUN], 0, 'spent');
});

test('MOVE-BANK: a pass lands one point and keeps the rest whole, so the next passes land it with no more running', () => {
  const p = runner(20);
  const { odometer } = realRun();
  p._odometer = odometer;   // what the tick puts there from the host's activity
  for (let i = 0; i < 60000; i++) { odometer.h += 2.4; tallyMovementSkill(p, RUN); }   // a long day's running, no rest
  assert.equal(p.skillUses[RUN], 59999, 'no 20000 bucket past 100');
  const c100 = cost(p, 100), c101 = cost(p, 101);
  let t = p.lastSkillCheckTime;
  const pass = () => { t += SKILL_RAISE_CHECK_INTERVAL + 1; return raiseSkills(p, t, () => 0.5, () => {}); };
  assert.deepEqual(pass(), [RUN]);
  assert.equal(p.skills[RUN], 101, 'one point a pass, as ever');
  assert.ok(Math.abs(p.skillProgress[RUN] - (59999 / c100 - 1) * c100 / c101) < 1e-9, 'the rest kept whole, re-priced at 101\'s cost');
  // the bank, landed a point a pass and re-priced each time: 59999 uses at level 20 are three points of 100's cost and
  // just over two once each point is priced at its own value
  let prog = 59999 / c100, v = 100;
  while (prog >= 1) { prog = (prog - 1) * cost(p, v) / cost(p, v + 1); v++; }
  assert.equal(v, 102);
  assert.deepEqual(pass(), [RUN], 'the next rest lands the banked point without another step run');
  assert.equal(p.skills[RUN], v);
  assert.ok(Math.abs(p.skillProgress[RUN] - prog) < 1e-9, 'what is left stays banked');
  assert.deepEqual(pass(), [], 'and stops when the bank is short of a point');
  const short = Math.ceil((1 - prog) * cost(p, v)) + 1;   // a little more running tops the bank past a point
  for (let i = 0; i < short; i++) { odometer.h += 2.4; tallyMovementSkill(p, RUN); }
  assert.deepEqual(pass(), [RUN], 'the bank and the new run land the next point together');
  assert.equal(p.skills[RUN], v + 1);
  // ...while below 100, an unmastered skill at 100 or Master Skills off keep DFU's 20000 bucket
  const below = runner(20, 60);
  const off = runner(20);
  off._online = false;   // offline with the switch off: a skill above 100 reads 100 and tallies as Daggerfall did
  const unmastered = runner(20);
  unmastered.masteredSkills = [];
  for (const q of [below, off, unmastered]) {
    q._odometer = { h: 0, v: 0 };
    for (let i = 0; i < 25000; i++) { q._odometer.h += 2.4; tallyMovementSkill(q, RUN); }
    assert.equal(q.skillUses[RUN], 20000, 'PlayerEntity.TallySkill\'s clamp');
  }
});
