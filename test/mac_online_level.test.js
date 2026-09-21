// MAC-LVL1 (2026-09-21, a player: "been jumping back and forth between
// online/offline, and it seems to me that leveling doesn't work
// properly online. I assume it probably has to do with how online
// changes the passage of time"). He was right about the cause. DFU's
// RaiseSkills (PlayerEntity.cs:1359-1414) opens its 360-minute gate
// (:1367) against world time, and its only two callers - the rest
// window (:731) and fast travel (:380) - have JUST raised that time.
// Online the world clock is the shared wall clock (WORLD5) and a rest
// no longer moves it: an 8-hour rest takes 3.6 real seconds = 43
// shared minutes, the gate stayed shut, and the second, third and
// fourth rests of a heal-up loop advanced nothing. The rest's
// simulated minutes are CREDITED to the skill-check clock now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { raisePlayerSkills, createRestDeps } from '../src/scenes/shared.js';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter } from '../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { SKILL_RAISE_CHECK_INTERVAL } from '../src/systems/advancement.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const SUB = REST_WAIT_PER_HOUR / MINUTES_PER_TICK;
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
function mkPlayer() {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  p.skillUses[SKILLS.LongBlade] = 20000;   // a raise waiting on the next pass
  return p;
}
const deps = (over = {}) => ({
  minutes: 0, advanceMinutes() {}, tickQuests() {}, tickVitals() { return false; },
  enemiesNearby: () => false, fullyHealed: () => false, dead: () => false, ...over,
});

test('MAC-LVL1: an ONLINE rest credits every simulated ten minutes to the skill-check clock; an offline rest credits nothing (its clock moved)', () => {
  let credited = 0;
  const on = new RestSession('timed', 1, deps({ sharedMinutes: () => 8000, creditSkillMinutes: (n) => { credited += n; } }));
  for (let i = 0; i < 6; i++) on.tick(SUB + 1e-6);
  assert.equal(credited, 60, 'mutants: the credit dropped, or not ten a sub-tick');
  credited = 0;
  const off = new RestSession('timed', 1, deps({ sharedMinutes: () => null, creditSkillMinutes: (n) => { credited += n; } }));
  for (let i = 0; i < 6; i++) off.tick(SUB + 1e-6);
  assert.equal(credited, 0, 'mutants: the offline lane credited too (double time)');
  // the deps the hosts hand the session accumulate it on the ENTITY
  const entity = { restSimMinutes: 0 };
  const d = createRestDeps(entity, {});
  d.creditSkillMinutes(10); d.creditSkillMinutes(10);
  assert.equal(entity.restSimMinutes, 20);
});

test('MAC-LVL1: raisePlayerSkills spends the credit - a night that moved the shared clock 43 minutes still opens the 360-minute gate, once', () => {
  const had = worldMinutes();
  try {
    const T0 = CLASSIC_GAME_START_TIME + 10000;
    // the stall: the last check was 43 shared minutes ago and nothing is credited
    const stalled = mkPlayer();
    stalled.lastSkillCheckTime = T0 - 43;
    setWorldMinutes(T0);
    assert.deepEqual(raisePlayerSkills(stalled, { rolls: seq(0) }), [], 'the gate is shut (43 <= 360) - the bug as the player saw it');
    // the fix: the rest simulated 480 minutes
    const rested = mkPlayer();
    rested.lastSkillCheckTime = T0 - 43;
    rested.restSimMinutes = 480;
    const raised = raisePlayerSkills(rested, { rolls: seq(0) });
    assert.ok(raised.length >= 1, 'mutants: the credit not spent - no pass after a night');
    assert.equal(rested.restSimMinutes, 0, 'the credit is spent, not kept (or the next check would be free)');
    assert.equal(rested.lastSkillCheckTime, T0, 'the marker is stamped NOW, in the shared clock, never in its future');
    // and it does not buy a second pass on its own
    assert.deepEqual(raisePlayerSkills(rested, { rolls: seq(0) }), []);
    assert.ok(SKILL_RAISE_CHECK_INTERVAL === 360);
  } finally { setWorldMinutes(had); }
});

test('MAC-LVL1: the credit rides the save envelope, and the marker it pulls back is never pushed past the clock', () => {
  assert.match(rd('src/systems/save.js'), /'lastSkillCheckTime',\n\s*'restSimMinutes',/, 'a save mid-rest keeps the owed minutes');
  assert.match(rd('src/scenes/shared.js'), /entity\.lastSkillCheckTime = \(entity\.lastSkillCheckTime \?\? 0\) - entity\.restSimMinutes;\n\s*entity\.restSimMinutes = 0;/,
    'spent by pulling the marker BACK - alignEntityClocks\' past() clamp (worldTick.js) would eat a marker stamped ahead of the shared clock');
  assert.match(rd('src/systems/restSession.js'), /this\.deps\.creditSkillMinutes\?\.\(MINUTES_PER_TICK\);/);
});
