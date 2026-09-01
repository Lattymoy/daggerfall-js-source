// ROAD TO 1:1, group a11 - the three advancement surfaces DFU has and
// the port did not:
//
//   1. THE MASTERY BOX AND FANFARE. PlayerEntity.RaiseSkills
//      :1389-1408 - a PRIMARY skill landing on exactly 100 raises
//      TEXT.RSC 4020 in a click-anywhere box and plays
//      SoundClips.ArenaFanfareLevelUp (32).
//   2. skillsRecentlyRaised. :70, :218-231 - a uint[2] bitmask set on
//      every raise, read by TextProvider.GetSkillSummary (:492) to
//      highlight the skill's row, cleared by the char sheet's
//      non-levelling close (CheckIfDoneLeveling :451).
//   3. THE LEVELLING ARM ON THE SHEET. DFU has no level-up window:
//      DaggerfallCharacterSheetWindow.UpdatePlayerValues :369-394
//      mounts a StatsRollout onto the sheet, and :433-455 refuses the
//      close until the pool is spent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import {
  SKILLS, getSkillRecentlyIncreased, setSkillRecentlyIncreased,
  resetSkillsRecentlyRaised, SKILLS_RECENTLY_RAISED_WORDS,
} from '../src/systems/skills.js';
import { raiseSkills, applyLevelUp } from '../src/systems/advancement.js';
import { createCharacter } from '../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { raisePlayerSkills, MASTERY_TEXT_ID } from '../src/scenes/shared.js';
import {
  CharSheet, MUST_DISTRIBUTE_BONUS_POINTS, SKILL_HIGHLIGHT_COLOR,
  STATS_ROLLOUT_SELECT, STATS_ROLLOUT_SPINNER, STAT_MODIFIED_COLOR,
} from '../src/ui/charsheet.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { OGHMA_BONUS_POOL } from '../src/systems/artifactEffects.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
/** A rolled character with `skillId` tallied to the raise threshold.
 *  `owed` pre-loads the level-up skill sum (the same +17 charsheet's
 *  own fixture uses) so the pass that raises also crosses a level. */
function mkPlayer(skillId = SKILLS.LongBlade, { owed = false } = {}) {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  if (owed) for (let k = 0; k < 17; k++) p.skills[SKILLS.LongBlade] += 1;
  p.skillUses[skillId] = 20000;
  return p;
}

/** A character standing at the sheet with a level owed - the raise
 *  has happened and RaiseSkills' tail has set the flag. */
function mkLevelling(skillId = SKILLS.Axe) {
  const p = mkPlayer(skillId, { owed: true });
  raiseSkills(p, CLASSIC_GAME_START_TIME + 400, seq(0), () => {});
  assert.equal(p.readyToLevelUp, true, 'fixture: the pass really owes a level');
  return p;
}

/** uisounds.test.js's spy shape: answers what was PLAYED. */
function capturePlays(fn) {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(); } finally { audio.playOneShot = orig; }
  return played;
}

// ── 1. The mastery box and fanfare ──────────────────────────────────

test('a11: ArenaFanfareLevelUp is 32 - the Arena tune, not the level-up chime', () => {
  // SoundClips.cs:64. RaiseSkills :1406 plays THIS; the char sheet's
  // own levelUpSound is SoundClips.LevelUp (96), a different record.
  assert.equal(SOUND.ArenaFanfareLevelUp, 32);
  assert.notEqual(SOUND.ArenaFanfareLevelUp, SOUND.LevelUp);
  assert.equal(MASTERY_TEXT_ID, 4020);   // youAreNowAMasterOfTextID (:1361)
});

test('a11: a PRIMARY skill reaching 100 raises TEXT.RSC 4020 and the fanfare', () => {
  const p = mkPlayer(SKILLS.Axe);
  p.skills[SKILLS.Axe] = 99;             // one raise from mastery
  const asked = [];
  const shown = [];
  const clock0 = worldMinutes();
  setWorldMinutes(CLASSIC_GAME_START_TIME + 400);
  const played = capturePlays(() => raisePlayerSkills(p, {
    rolls: () => 0.5,
    lines: (id) => { asked.push(id); return [{ text: 'You are now a master.', center: false }]; },
    box: (rows) => shown.push(rows),
  }));
  setWorldMinutes(clock0);
  assert.equal(p.skills[SKILLS.Axe], 100);
  assert.deepEqual(asked, [MASTERY_TEXT_ID], 'the box asks TEXT.RSC for 4020');
  // plainLines flattens the TEXT.RSC rows - ActionTextBox iterates
  // strings, which is V5b's finding, and this seam is not exempt.
  assert.deepEqual(shown, [['You are now a master.']]);
  assert.ok(played.includes(SOUND.ArenaFanfareLevelUp), 'the fanfare plays');
});

test('a11: the mastery is PRIMARY-only, EXACTLY 100, and once', () => {
  // :1391-1393 - the box is gated on GetPrimarySkills().Contains, and
  // the 100 test is equality inside the raise, so a skill that was
  // already 100 cannot raise again (:1384) and never re-fires.
  const major = mkPlayer(SKILLS.BluntWeapon);
  major.skills[SKILLS.BluntWeapon] = 99;
  let fired = 0;
  raiseSkills(major, CLASSIC_GAME_START_TIME + 400, seq(0), () => {}, () => fired++);
  assert.equal(major.skills[SKILLS.BluntWeapon], 100, 'a MAJOR skill still masters');
  assert.equal(fired, 0, 'but it is not the mastery the box celebrates');

  const already = mkPlayer(SKILLS.Axe);
  already.skills[SKILLS.Axe] = 100;
  let again = 0;
  raiseSkills(already, CLASSIC_GAME_START_TIME + 400, seq(0), () => {}, () => again++);
  assert.equal(again, 0, 'a skill already at 100 does not raise, so nothing fires');

  // and the fanfare plays even when the host has no box to show it in
  // (PlayOneShot sits OUTSIDE the `tokens != null` gate, :1395-1406)
  const p = mkPlayer(SKILLS.Axe);
  p.skills[SKILLS.Axe] = 99;
  const clock0 = worldMinutes();
  setWorldMinutes(CLASSIC_GAME_START_TIME + 400);
  const played = capturePlays(() => raisePlayerSkills(p, { rolls: () => 0.5 }));
  setWorldMinutes(clock0);
  assert.ok(played.includes(SOUND.ArenaFanfareLevelUp));
});

test('a11: every host that can rest hands the mastery box a presenter', () => {
  // THE FOUR HOSTS RULE. createRestDeps forwards `box` and reuses the
  // host's own endLines for the rows, so a host that forgets the
  // presenter masters a skill in silence.
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    assert.match(src(`src/${h}`), /\n\s*box: \(rows\) => /, `${h} passes no mastery box`);
  }
  assert.match(src('src/scenes/shared.js'),
    /onRestFinished: \(\) => raisePlayerSkills\(entity, \{ say, onLevelUp, lines: rest\.endLines, box \}\)/,
    'the rest-end raise carries the rows and the presenter');
});

// ── 2. skillsRecentlyRaised ─────────────────────────────────────────

test('a11: skillsRecentlyRaised is a uint[2] bitmask, Axe (31) included', () => {
  assert.equal(SKILLS_RECENTLY_RAISED_WORDS, 2);
  const e = {};
  // GetSkillRecentlyIncreased :218-221 - word = id/32, bit = id%32.
  setSkillRecentlyIncreased(e, SKILLS.Medical);      // 0  -> word 0, bit 0
  setSkillRecentlyIncreased(e, SKILLS.Axe);          // 31 -> word 0, bit 31
  setSkillRecentlyIncreased(e, SKILLS.CriticalStrike);   // 34 -> word 1, bit 2
  assert.equal(e.skillsRecentlyRaised.length, 2);
  assert.equal(e.skillsRecentlyRaised[0], 0x80000001,
    'bit 31 stores UNSIGNED - `1 << 31` is negative in JS and the save writes a uint');
  assert.ok(e.skillsRecentlyRaised[0] > 0);
  assert.equal(e.skillsRecentlyRaised[1], 0b100);
  for (const id of [SKILLS.Medical, SKILLS.Axe, SKILLS.CriticalStrike]) {
    assert.equal(getSkillRecentlyIncreased(e, id), true, `skill ${id} reads back raised`);
  }
  assert.equal(getSkillRecentlyIncreased(e, SKILLS.LongBlade), false);
  resetSkillsRecentlyRaised(e);   // Array.Clear over both words (:230)
  assert.deepEqual(e.skillsRecentlyRaised, [0, 0]);
});

test('a11: a raise MARKS the skill, and the sheet clears the mask on close', () => {
  const p = mkPlayer(SKILLS.LongBlade);
  assert.deepEqual(p.skillsRecentlyRaised, [0, 0], 'a fresh character is minted with the field');
  const raised = raiseSkills(p, CLASSIC_GAME_START_TIME + 400, seq(0), () => {});
  assert.deepEqual(raised, [SKILLS.LongBlade]);
  assert.equal(getSkillRecentlyIncreased(p, SKILLS.LongBlade), true, 'RaiseSkills :1387');
  // Opening and closing the sheet is what clears it (:451) - and only
  // a close that is NOT a level-up close (that arm is the `if
  // (leveling)` branch above it).
  const sheet = new CharSheet(p, {});
  assert.equal(getSkillRecentlyIncreased(p, SKILLS.LongBlade), true, 'still lit while the sheet is open');
  sheet.input('Escape');
  assert.ok(sheet.done);
  assert.equal(getSkillRecentlyIncreased(p, SKILLS.LongBlade), false);
});

test('a11: a LEVEL-UP close leaves the highlights standing for the next visit', () => {
  // CheckIfDoneLeveling :435-455: ResetSkillsRecentlyRaised lives in
  // the ELSE arm, so the visit that spends bonus points does not also
  // eat the marks telling you what you raised.
  const p = mkPlayer(SKILLS.LongBlade, { owed: true });
  raiseSkills(p, CLASSIC_GAME_START_TIME + 400, seq(0), () => {});
  assert.equal(getSkillRecentlyIncreased(p, SKILLS.LongBlade), true);
  const sheet = new CharSheet(p, {}, seq(0));
  assert.equal(sheet.leveling, true);
  const pool = sheet.pool;
  for (let i = 0; i < pool; i++) sheet.input('plus');
  sheet.input('Escape');
  assert.ok(sheet.done);
  assert.equal(getSkillRecentlyIncreased(p, SKILLS.LongBlade), true, 'still lit after the level-up close');
});

test('a11: the skills page draws a raised row in the highlight colour', () => {
  // TextProvider.GetSkillSummary :492-495 formats the WHOLE row as
  // TextHighlight, which MultiFormatTextLabel paints in
  // DaggerfallUI.DaggerfallHighlightTextColor (DaggerfallUI.cs:54).
  assert.deepEqual(SKILL_HIGHLIGHT_COLOR.map((c) => Math.round(c * 255)), [219, 130, 40, 255]);
  const p = mkPlayer(SKILLS.LongBlade);
  raiseSkills(p, CLASSIC_GAME_START_TIME + 400, seq(0), () => {});
  // WHICH rows are lit is the law; the draw is a colour lookup over it.
  const lit = career.primarySkills.map((id) => [id, getSkillRecentlyIncreased(p, id)]);
  assert.deepEqual(lit, [[SKILLS.LongBlade, true], [SKILLS.Axe, false], [SKILLS.CriticalStrike, false]]);
  // and the page really asks, per row, rather than drawing one colour
  assert.match(src('src/ui/charsheet.js'),
    /getSkillRecentlyIncreased\(e, id\) \? SKILL_HIGHLIGHT_COLOR/);
});

// ── 3. The levelling arm, on the sheet ──────────────────────────────

test('a11: ReadyToLevelUp mounts the rollout ON the sheet - level, health, flags', () => {
  const p = mkLevelling();
  const level0 = p.level, hp0 = p.maxHealth;
  let first = null, second = null;
  const played = capturePlays(() => { first = new CharSheet(p, {}, seq(0)); });
  capturePlays(() => { second = new CharSheet(p, {}, seq(0)); });   // second mount is inert (flags cleared)
  assert.ok(played.includes(SOUND.LevelUp), 'levelUpSound at mount (:373)');
  assert.equal(first.leveling, true);
  assert.equal(second.leveling, false, 'the flags cleared on the FIRST mount (:392-393)');

  // re-run cleanly: one sheet, one mount
  const q = mkLevelling();
  const str0 = q.stats.strength;
  const w = new CharSheet(q, {}, seq(0));
  assert.equal(w.leveling, true);
  assert.equal(w.pool, 4, 'BonusPool() low end, drawn ONCE and shown');
  assert.equal(q.level, level0 + 1, 'Level++ at mount (:379)');
  assert.equal(q.maxHealth, hp0 + 7, 'and the health roll (:380)');
  assert.equal(q.readyToLevelUp, false);
  assert.equal(q.stats.strength, str0, 'the points have NOT landed yet - the rollout writes at close (:448)');
});

test('a11: the sheet refuses to close while bonus points are owed', () => {
  const p = mkLevelling();
  const sheet = new CharSheet(p, {}, seq(0));
  const str0 = sheet.working.strength;
  sheet.input('Escape');
  assert.equal(sheet.done, false, 'CheckIfDoneLeveling :437-443 refuses');
  assert.deepEqual(sheet.child?.lines, [MUST_DISTRIBUTE_BONUS_POINTS]);
  sheet.input('Enter');            // the box is ClickAnywhereToClose
  assert.equal(sheet.child, null);
  assert.equal(sheet.done, false, 'and the sheet is still up');
  // spend it: statUp/statDown are the same verbatim clamps chargen uses
  sheet.input('minus');
  assert.equal(sheet.pool, 4, 'the floor is the pre-level value');
  for (let i = 0; i < 4; i++) sheet.input('plus');
  assert.equal(sheet.pool, 0);
  sheet.input('plus');
  assert.equal(sheet.working.strength, str0 + 4, 'pool 0 blocks a fifth point');
  sheet.input('Escape');
  assert.ok(sheet.done);
  assert.equal(p.stats.strength, str0 + 4, 'PlayerEntity.Stats = WorkingStats (:448)');
});

test('a11: the rollout answers the raw e.code the native seam hands it', () => {
  // townTalk routes a "native" window the raw code and the dungeon's
  // routeKey routes an overlayAction name - the sheet is isChoiceWindow,
  // so it sees ArrowDown/Equal/Minus, not down/plus/minus.
  const p = mkLevelling();
  const sheet = new CharSheet(p, {}, seq(0));
  assert.equal(sheet.cursor, 0);
  sheet.input('ArrowDown');
  assert.equal(sheet.cursor, 1);
  const key = 'intelligence';
  const v0 = sheet.working[key];
  sheet.input('Equal');
  assert.equal(sheet.working[key], v0 + 1);
  assert.equal(sheet.pool, 3);
  sheet.input('Minus');
  assert.equal(sheet.working[key], v0);
  assert.equal(sheet.pool, 4);
  // and the skill pages still work while levelling - only the STAT
  // buttons are taken over (StatButton_OnMouseClick :925-939)
  sheet.input('Digit2');
  assert.equal(sheet.page, 2);
});

test('a11: the OGHMA arm on the sheet - thirty points, no level, no health', () => {
  // UpdatePlayerValues :374-383 and the AUDIT 39 law in advancement.js:
  // the sheet must hand applyLevelUp the pool it already drew.
  const p = mkPlayer();
  p.readyToLevelUp = true;
  p.oghmaLevelUp = true;
  const level0 = p.level, hp0 = p.maxHealth;
  const sheet = new CharSheet(p, {}, seq(0));
  assert.equal(sheet.oghma, true);
  assert.equal(sheet.pool, OGHMA_BONUS_POOL, 'oghmaBonusPool 30, not a 4..6 draw');
  assert.equal(p.level, level0, 'NO Level++ on the Oghma branch');
  assert.equal(p.maxHealth, hp0, 'and no health roll');
  assert.equal(p.oghmaLevelUp, false);
  const str0 = sheet.working.strength;
  for (let i = 0; i < OGHMA_BONUS_POOL; i++) sheet.input('plus');
  assert.equal(sheet.pool, 0, 'all thirty are spendable');
  sheet.input('Escape');
  assert.ok(sheet.done);
  assert.equal(p.stats.strength, str0 + OGHMA_BONUS_POOL);
});

test('a11: an all-max character closes with the pool unspent', () => {
  // CheckIfDoneLeveling :437 - `bonusPool > 0 && !WorkingStats.IsAllMax()`
  // (DaggerfallStats.IsAllMax :85-97). Without the second clause a
  // maxed character could never shut the sheet.
  const p = mkPlayer();
  for (const k of Object.keys(p.stats)) p.stats[k] = 100;
  p.readyToLevelUp = true;
  const sheet = new CharSheet(p, {}, seq(0));
  assert.equal(sheet.leveling, true);
  assert.ok(sheet.pool > 0, 'the pool is still drawn');
  sheet.input('Escape');
  assert.ok(sheet.done, 'and the sheet closes anyway');
});

test('a11: the door sends the CLASSIC skin to the sheet and keeps the screen for enhanced', () => {
  const door = src('src/ui/charSheetDoor.js');
  assert.match(door, /if \(deps\.entity\?\.readyToLevelUp && isEnhanced\(\)\) return new LevelUpScreen\(deps\.entity\);/,
    'the separate screen is the ENHANCED skin door only');
  // and the classic sheet reads the same two flags DFU reads
  assert.match(src('src/ui/charsheet.js'), /if \(!e\?\.readyToLevelUp\) return;/);
  assert.match(src('src/ui/charsheet.js'), /applyLevelUp\(e, \(\) => \{\}, rolls, this\.pool\);/,
    'and hands applyLevelUp the ALREADY-ROLLED pool (AUDIT 39)');
});

test('a11: applyLevelUp is still the ONE home for the Level++ and the health roll', () => {
  // The sheet must not grow a second copy - that is the defect the
  // separate screen already demonstrated once.
  const sheet = src('src/ui/charsheet.js');
  assert.doesNotMatch(sheet, /entity\.level \+= 1|e\.level \+= 1/, 'no private Level++ on the sheet');
  assert.doesNotMatch(sheet, /hitPointsPerLevelUp/, 'and no private health roll');
  // the law itself still behaves
  const p = mkPlayer();
  p.readyToLevelUp = true;
  const hp0 = p.maxHealth;
  assert.ok(applyLevelUp(p, (stats, pool) => { stats.luck += pool; }, seq(0)));
  assert.equal(p.maxHealth, hp0 + 7);
});

test('a11: the rollout sits where DFU puts it on the sheet', () => {
  // StatsRollout.cs:88-131 (onCharacterSheet arm): the stat select
  // buttons are (141, 6 + 24*i) at 28x20 and the spinner rides beside
  // the SELECTED one at (176, 6 + 24*sel), 15x20. UpDownSpinner.cs
  // :96-116 splits it: up 15x7 at +0, the value label 15x6 at +7,
  // down 15x7 at +13.
  assert.deepEqual({ ...STATS_ROLLOUT_SELECT }, { x: 141, y: 6, w: 28, h: 20, step: 24 });
  assert.deepEqual({ ...STATS_ROLLOUT_SPINNER }, { x: 176, y: 6, w: 15, h: 20, step: 24 });
  // Color.green - StatsRollout.modifiedStatTextColor with freeEdit OFF
  // (:46), which is the sheet's `new StatsRollout(true)` (:218).
  assert.deepEqual([...STAT_MODIFIED_COLOR], [0, 1, 0, 1]);

  // and the two halves really click: the spinner tracks the selection
  const p = mkLevelling();
  const sheet = new CharSheet(p, {}, seq(0));
  const pool0 = sheet.pool;
  assert.equal(sheet.click(178, 8), true, 'the UP half spends a point');
  assert.equal(sheet.pool, pool0 - 1);
  assert.equal(sheet.click(178, 8 + 13), true, 'the DOWN half returns it');
  assert.equal(sheet.pool, pool0);
  // clicking a stat's select button moves the selection, and the
  // spinner MOVES WITH IT (SelectStat :211-216)
  assert.equal(sheet.click(145, STATS_ROLLOUT_SELECT.y + STATS_ROLLOUT_SELECT.step * 3), true);
  assert.equal(sheet.cursor, 3);
  assert.equal(sheet.click(178, 8), false, 'the spinner is no longer at the first stat');
  assert.equal(sheet.click(178, STATS_ROLLOUT_SPINNER.y + STATS_ROLLOUT_SPINNER.step * 3 + 2), true);
  assert.equal(sheet.working.agility, sheet.base.agility + 1, 'STAT_KEYS_ORDER[3]');
});

test('a11: ClickAnywhereToClose closes on a CLICK, not only a key', () => {
  // DaggerfallMessageBox.ClickAnywhereToClose. The level-up refusal is
  // the box a mouse-driven player meets first, and it was key-only.
  const box = new ActionTextBox(['one']).addNext(['two']);
  assert.equal(box.click(), true);
  assert.deepEqual(box.lines, ['two'], 'a chained box advances, exactly as a key does');
  assert.equal(box.done, false);
  box.click();
  assert.equal(box.done, true);
});
