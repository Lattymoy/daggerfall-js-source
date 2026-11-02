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
//
// LIVED1 (2026-09-29) retired the credit and kept the law: the gate
// reads the CHARACTER's own clock (worldTick.js ownMinutes), which the
// rest's hours move online as the one clock moves offline - so a night
// opens it by RaiseSkills' own arithmetic, and nothing is banked on the
// entity, spent at the rest's end or carried in the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR } from '../../src/systems/rest/restSession.js';
import { raisePlayerSkills, createRestDeps, createPlayerTicker } from '../../src/scenes/shared.js';
import { SKILLS } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME } from '../../src/systems/gameDate.js';
import { setWorldMinutes, worldMinutes, setSharedClock, setOwnMinutes, ownMinutes, resetMagicRoundMarker } from '../../src/systems/worldTick.js';
import { SKILL_RAISE_CHECK_INTERVAL } from '../../src/systems/advancement.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
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

test('MAC-LVL1 (LIVED1): an ONLINE rest\'s hours are the character\'s own - the ticker\'s advance moves their clock by the night, the session credits nothing and the deps bank nothing', () => {
  const T0 = CLASSIC_GAME_START_TIME + 10000;
  const world = { t: T0 };
  try {
    setSharedClock(() => world.t);
    setOwnMinutes(T0);
    const p = mkPlayer();
    p.lastGameMinutes = T0;
    resetMagicRoundMarker(T0);
    const ticker = createPlayerTicker(p, {});
    const s1 = new RestSession('timed', 8, deps({ sharedMinutes: () => world.t, advanceMinutes: (n) => ticker.advance(n) }));
    for (let i = 0; i < 60; i++) s1.tick(SUB + 1e-6);
    assert.equal(Math.floor(ownMinutes()), T0 + 480, 'eight hours on the character\'s clock, the world\'s standing');
    assert.equal(worldMinutes(), T0, 'and the world\'s clock untouched');
    assert.equal('creditSkillMinutes' in createRestDeps({}, {}), false, 'the deps bank nothing');
  } finally { setSharedClock(null); }
});

test('MAC-LVL1 (LIVED1): the gate reads the character\'s clock - shut 43 minutes after a check (the bug as the player saw it), open after a rested night, stamped at the character\'s now, and one night is one pass', () => {
  const had = worldMinutes();
  const T0 = CLASSIC_GAME_START_TIME + 10000;
  try {
    setSharedClock(() => T0 + 43);
    setOwnMinutes(T0 + 43);
    const stalled = mkPlayer();
    stalled.lastSkillCheckTime = T0;
    assert.deepEqual(raisePlayerSkills(stalled, { rolls: seq(0) }), [], 'the gate is shut (43 <= 360)');
    setOwnMinutes(T0 + 43 + 480);   // the rested night, on the character's clock
    const raised = raisePlayerSkills(stalled, { rolls: seq(0) });
    assert.ok(raised.length >= 1, 'mutants: the gate read the world\'s clock - no pass after a night');
    assert.equal(stalled.lastSkillCheckTime, T0 + 43 + 480, 'the marker is stamped at the character\'s now');
    assert.deepEqual(raisePlayerSkills(stalled, { rolls: seq(0) }), [], 'and the night does not buy a second pass');
    assert.ok(SKILL_RAISE_CHECK_INTERVAL === 360);
  } finally { setSharedClock(null); setWorldMinutes(had); }
});

test('MAC-LVL1 (LIVED1) by source: no credit is banked, spent or saved - the gate reads the character\'s own clock', () => {
  assert.doesNotMatch(rd('src/systems/save/save.js'), /'restSimMinutes'/, 'the save carries no credit');
  const sh = rd('src/scenes/shared.js');
  assert.doesNotMatch(sh, /restSimMinutes/, 'nothing banks or spends it');
  assert.match(sh, /const raised = raiseSkills\(entity, Math\.floor\(ownMinutes\(\)\), rolls, levelUpHook,/, 'RaiseSkills\' gate on the character\'s clock');
  assert.doesNotMatch(rd('src/systems/rest/restSession.js'), /creditSkillMinutes/);
});
