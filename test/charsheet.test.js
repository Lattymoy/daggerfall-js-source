// U3: applyLevelUp (HP + hand distribution), the ready-flag path
// (no auto-apply with a sink), the level-up screen clamps + confirm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raiseSkills, applyLevelUp } from '../src/systems/advancement.js';
import { createCharacter } from '../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { SKILLS } from '../src/systems/skills.js';
import { LevelUpScreen } from '../src/ui/charsheet.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
const mkReady = () => {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  for (let k = 0; k < 17; k++) p.skills[SKILLS.LongBlade] += 1;
  p.skillUses[SKILLS.Axe] = 20000;
  return p;
};

test('levelup: with a sink, raiseSkills sets ready + pending, no auto-apply', () => {
  const p = mkReady();
  const hp0 = p.maxHealth, statTotal0 = Object.values(p.stats).reduce((a, b) => a + b, 0);
  let sank = 0;
  raiseSkills(p, CLASSIC_GAME_START_TIME + 500, seq(0), () => sank++);
  assert.equal(sank, 1);
  assert.equal(p.readyToLevelUp, true);
  assert.equal(p.pendingLevel, 3);
  assert.equal(p.level, 1);                              // NOT applied
  assert.equal(p.maxHealth, hp0);
  assert.equal(Object.values(p.stats).reduce((a, b) => a + b, 0), statTotal0);
  // headless path (no sink) still applies immediately
  const q = mkReady();
  raiseSkills(q, CLASSIC_GAME_START_TIME + 500, seq(0));
  assert.equal(q.level, 3);
  assert.equal(q.readyToLevelUp, false);
});

test('levelup: applyLevelUp - HP roll, hand distribution, flags cleared, idempotent', () => {
  const p = mkReady();
  raiseSkills(p, CLASSIC_GAME_START_TIME + 500, seq(0), () => {});
  const hp0 = p.maxHealth;
  const ok = applyLevelUp(p, (stats, pool) => { stats.luck += pool; }, seq(0));
  assert.ok(ok);
  assert.equal(p.level, 3);
  assert.equal(p.maxHealth, hp0 + 7);                    // Range(6,12 incl) roll 0 -> 6, +END mod 1
  assert.equal(p.stats.luck, 50 + 4);                    // pool roll 0 -> 4, all to luck
  assert.equal(p.readyToLevelUp, false);
  assert.ok(!applyLevelUp(p, () => {}, seq(0)));         // idempotent
});

test('levelup: the screen shares the verbatim clamps and gates confirm on pool 0', () => {
  const p = mkReady();
  raiseSkills(p, CLASSIC_GAME_START_TIME + 500, seq(0), () => {});
  const scr = new LevelUpScreen(p, seq(0));              // pool 4
  assert.equal(scr.pool, 4);
  scr.input('confirm');
  assert.ok(!scr.done);                                  // gated
  scr.input('minus');
  assert.equal(scr.pool, 4);                             // floor = pre-level value
  for (let i = 0; i < 4; i++) scr.input('plus');
  assert.equal(scr.pool, 0);
  const before = scr.working.strength;
  scr.input('plus');
  assert.equal(scr.working.strength, before);            // pool 0 blocks
  scr.input('confirm');
  assert.ok(scr.done);
  assert.equal(p.level, 3);
  assert.equal(p.stats.strength, before);                // the hand-built stats landed
});
