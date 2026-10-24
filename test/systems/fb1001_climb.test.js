// FIELD BUGS 2026-10-01 #7 (CLIMB-PAST) - "Running jumping climbing dint work passed 100"; Mac: "I dont care about
// DFU. We're our own thing now".
//
// Past 100 a skill's points reach every formula through effectiveSkill (a quarter a point, plus the milestones), and
// the run, the swim and the jump all read it: run speed, swim speed and jump height grow, slowly, all the way to 200.
// Climbing did not. The skill drives exactly one thing in Daggerfall - CalculateClimbingChance - which clamps it to
// 5..95, and at 95 every check is already certain (Luck 40 or more); GetClimbingSpeed reads no skill at all. So a
// mastered Climbing climbed to 200 and climbed exactly like a 95: one of a character's five masteries spent on nothing.
// Past 100 its points now go to the climb's speed - each effective point over 100 climbs 1% faster, x1.4 at 200
// (effective 140) - read off the same live value the check reads; to 100 the climb is DFU's base / 3 untouched.
//
// Driven on the producers: a chargen'd character mastered through masterSkills.js, a real PlayerMotor on a real
// Collider with the climbing deps every host hands it (scenes/shared.js climbingDeps).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS, skillValue } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { CLIMB_OVERCAP_SPEED_PER_POINT, overcapClimbSpeed, EFFECTIVE_SKILL_MAX } from '../../src/systems/skillSoftcap.js';
import { climbingSpeed } from '../../src/player/climbing.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { motorStats, climbingDeps } from '../../src/scenes/shared.js';
import { playerEntity } from '../../src/characters/playerEntity.js';

const CLIMB = SKILLS.Climbing;
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({
  name: 'Climber', hp: 12, stats: STATS,
  skills: [SKILLS.Climbing, SKILLS.Running, SKILLS.Jumping, SKILLS.Swimming, SKILLS.Dodging, SKILLS.Stealth,
    SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking],
});

function climber(value, { mastered = true } = {}) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true;   // world.js stamps it: Master Skills is always in force online
  p.skills[CLIMB] = 100;
  if (mastered) assert.equal(masterSkill(p, CLIMB).ok, true);
  p.skills[CLIMB] = value;
  return p;
}

/** Press into a tall wall on a real motor; the height climbed in the five seconds after the climb takes hold. */
function climbed(p) {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  col.addMesh('world', [-20, 0, 1.5, 20, 0, 1.5, 20, 400, 1.5, -20, 400, 1.5], [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col, motorStats(p), { climbing: climbingDeps(p) });
  m.spawn(0, 0.05, 0);
  const press = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
  let f = 0;
  while (!m.climb.isClimbing && f++ < 600) m.update(1 / 60, press, 0);
  assert.ok(m.climb.isClimbing, 'the climb took hold');
  const y0 = m.pos[1];
  for (let i = 0; i < 300; i++) m.update(1 / 60, press, 0);
  assert.ok(m.climb.isClimbing, 'still climbing - every check at 95 and up passes');
  return m.pos[1] - y0;
}

test('CLIMB-PAST: a mastered Climbing of 200 climbs 1.4x as fast as a 100; to 100 the climb is DFU\'s', () => {
  const at100 = climbed(climber(100));
  const at95 = climbed(climber(95, { mastered: false }));
  assert.ok(Math.abs(at100 - at95) < 1e-6, 'GetClimbingSpeed reads no skill to 100: a 100 climbs as a 95');
  const p200 = climber(200);
  assert.equal(skillValue(p200, CLIMB), EFFECTIVE_SKILL_MAX, 'a 200 reads 140 in a formula');
  const at200 = climbed(p200);
  assert.ok(Math.abs(at200 / at100 - 1.4) < 1e-3, `200 climbed ${at200.toFixed(2)} m to the 100's ${at100.toFixed(2)} m`);
  const at150 = climbed(climber(150));
  assert.ok(Math.abs(at150 / at100 - (1 + (skillValue(climber(150), CLIMB) - 100) * 0.01)) < 1e-3, 'every effective point past 100 is 1%');
  assert.ok(Math.abs(climbed(climber(200, { mastered: false })) - at100) < 1e-6, 'an unmastered 200 reads 100, so it climbs as a 100');
});

test('CLIMB-PAST: the law - 1% an effective point over 100, bounded at the effective cap; the Climbing spell doubles on top', () => {
  assert.equal(CLIMB_OVERCAP_SPEED_PER_POINT, 0.01);
  assert.equal(overcapClimbSpeed(100), 1);
  assert.equal(overcapClimbSpeed(60), 1, 'nothing below 100');
  assert.equal(overcapClimbSpeed(117), 1.17);
  assert.equal(overcapClimbSpeed(140), 1.4);
  assert.equal(overcapClimbSpeed(170), 1.4, 'a curse or Fortify past the effective cap buys no more');
  assert.equal(overcapClimbSpeed(undefined), 1);
  assert.equal(climbingSpeed(4.5), 1.5, 'DFU: base / 3');
  assert.equal(climbingSpeed(4.5, true), 3, 'DFU: x2 under the Climbing effect');
  assert.ok(Math.abs(climbingSpeed(4.5, false, 140) - 2.1) < 1e-12);
  assert.ok(Math.abs(climbingSpeed(4.5, true, 120) - 3.6) < 1e-12);
});
