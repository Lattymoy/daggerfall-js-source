// LEVEL-PCT (2026-09-28, Discord, dragonatg: "The level progress is inconsistent between the Uis. On GrimoireUi a
// level progress of 93% is only 12/100 on EnhancedPlus."). GrimoireUI is the classic skin under an art pack, so its
// Level box is the classic sheet's (ui/charsheet.js _showLevel), and that box always printed DFU's skill-sum fraction.
// A character ORL1's bar levels (the mod's law, chosen at creation) still has that sum kept (advancement.js
// raiseSkills) but it levels nothing: the Ascension's crown read the bar (12/100), the box the sum (93%). The box now
// reads the character's own law. And its DFU arithmetic is DFU's precision: `float currentLevel` is a single, and in
// a double two spans in fifteen read a point off what DFU's box reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CharSheet, CHARSHEET_RECTS, levelProgressPercent } from '../../src/ui/charsheet.js';
import { levelProgress, viewOnlyScreen, levelUpFrame, LANE_OGHMA } from '../../src/ui/levelUp/levelUpView.js';
import { createCharSheetWindow } from '../../src/ui/charSheetDoor.js';
import { SPECIAL_ARTIFACT_HANDLERS, ARTIFACTS } from '../../src/systems/artifactEffects.js';
import { initVirtueLeveling, LEVELING_VIRTUE, LEVELING_CLASSIC, LEVELUP_TOTAL } from '../../src/systems/oblivionLeveling.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { raiseSkills, skillUsesForAdvancement, SKILL_ADVANCEMENT_MULTIPLIER } from '../../src/systems/advancement.js';
import { SKILLS } from '../../src/systems/skills.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../../src/systems/gameDate.js';
import { codeHasOnce } from '../codeOnly.mjs';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
// The report's own history through the port's own producers: a character minted, its law answered, then one skill
// pass raising a primary (the bar +8, the sum +1) and two misc skills (the bar +2 each, the sum untouched) - the bar
// at 12 and the sum one past its anchor, which DFU's arithmetic reads as 93%.
function played(system) {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  initVirtueLeveling(p, system);
  const skills = [SKILLS.Etiquette, SKILLS.Backstabbing, SKILLS.LongBlade];
  for (const s of skills) p.skillUses[s] = skillUsesForAdvancement(p.skills[s], SKILL_ADVANCEMENT_MULTIPLIER[s], 1.0, p.level);
  assert.deepEqual(raiseSkills(p, T0 + 361, seq(0), () => {}), skills, 'one pass raises all three');
  return p;
}
const box = (entity) => {
  const w = new CharSheet(entity, {});
  const [x, y, ww, h] = CHARSHEET_RECTS.level;
  w.click(x + ww / 2, y + h / 2);
  return w.child.lines;
};

test('LEVEL-PCT: the report - a character the bar levels reads the bar on the classic Level box, as the Ascension does', () => {
  const v = played(LEVELING_VIRTUE);
  assert.equal(v.currentLevelUpSkillSum - v.startingLevelUpSkillSum, 1, 'the sum moved one, as it does for everyone');
  assert.equal(v.levelProgress, 12, 'the bar took 8 + 2 + 2');
  assert.deepEqual(levelProgress(v, viewOnlyScreen(v, true)), { now: 12, max: LEVELUP_TOTAL, carried: 0, label: 'Progress to next level' });   // PIN MOVED (AUDIT GROWTH LANE5-1)
  assert.deepEqual(box(v), ['Progress made to the next level: 12%'], 'the box reads the law that levels this character (was 93%)');
  // The same history on DFU's law: the bar never moved, and both screens read the sum - 93% and 14 of 15.
  const c = played(LEVELING_CLASSIC);
  assert.equal(c.levelProgress, 0);
  assert.deepEqual(box(c), ['Progress made to the next level: 93%']);
  assert.deepEqual(levelProgress(c, viewOnlyScreen(c, false)), { now: 14, max: 15, carried: 0, label: 'Skill progress to next level' });   // PIN MOVED (AUDIT GROWTH LANE5-1)
});

test('LEVEL-PCT: the Oghma Infinium\'s window reads the bar too - the crown asks the character\'s law, not the screen\'s lane', () => {
  // AUDIT 28e (the level lane): the book mounts the CLASSIC rollout for a character the mod's bar levels
  // (charSheetDoor: an Oghma level-up is never the mod's window), and its crown read the skill sum - 14 of 15 beside
  // the box's 12%, LEVEL-PCT's own mismatch inside Enhanced Plus.
  const v = played(LEVELING_VIRTUE);
  SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.OghmaInfinium).used({ entity: v, ctx: {} });
  const w = createCharSheetWindow({ entity: v });
  const frame = levelUpFrame(v, w);
  assert.equal(frame.lane, LANE_OGHMA, 'the book\'s own window');
  assert.deepEqual(frame.progress, { now: 12, max: LEVELUP_TOTAL, carried: 0, label: 'Progress to next level' });   // PIN MOVED (AUDIT GROWTH LANE5-1)
  assert.deepEqual(box(v), ['Progress made to the next level: 12%'], 'the box and the crown, one number');
  // The same book on DFU's law reads the sum, as before.
  const c = played(LEVELING_CLASSIC);
  SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.OghmaInfinium).used({ entity: c, ctx: {} });
  assert.deepEqual(levelUpFrame(c, createCharSheetWindow({ entity: c })).progress, { now: 14, max: 15, carried: 0, label: 'Skill progress to next level' });   // PIN MOVED (AUDIT GROWTH LANE5-1)
});

test('LEVEL-PCT: the bar reads the same on both screens at its ends - held to 0..100, a full bar 100%', () => {
  const v = played(LEVELING_VIRTUE);
  for (const [bar, pct] of [[0, 0], [99, 99], [LEVELUP_TOTAL, 100], [LEVELUP_TOTAL + 40, 100], [-5, 0]]) {
    v.levelProgress = bar;
    assert.equal(levelProgressPercent(v), pct, `bar ${bar}`);
    assert.equal(levelProgress(v, viewOnlyScreen(v, true)).now, pct, `the crown's bar ${bar}`);
  }
  // ...and the mod's own canvas window prints the same reading (AUDIT 28e: it printed the raw field).
  const src = readFileSync(new URL('../../src/ui/virtueLevelUp.js', import.meta.url), 'utf8');
  const at = src.indexOf('    at(`bar ');
  assert.ok(at > 0, 'the canvas window\'s bar line');
  codeHasOnce(src.slice(at, src.indexOf('\n', at)), /at\(`bar \$\{levelBarProgress\(this\.entity\)\}\/\$\{LEVELUP_TOTAL\}`/);
});

test('LEVEL-PCT: the classic box is LevelButton_OnMouseClick in DFU\'s own precision (`float currentLevel`, a single)', () => {
  // (current - starting + 28) / 15f, its fraction truncated to a percent - the values DFU's single-precision
  // arithmetic prints over a level's fifteen spans (the sum never falls below its start, so 28 to 42). A double reads
  // 36 as 39 and 39 as 60; DFU prints 40 and 59 (AUDIT 28e: the first pin's window began at 26, and its example, 27,
  // is a span no character reaches).
  const dfu = [86, 93, 0, 6, 13, 20, 26, 33, 40, 46, 53, 59, 66, 73, 79];
  const port = dfu.map((_, i) => levelProgressPercent({ startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 100 + i }));
  assert.deepEqual(port, dfu);
});
