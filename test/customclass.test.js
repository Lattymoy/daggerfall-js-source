// U20a: the CUSTOM-CLASS BUILDER - CreateCharCustomClass +
// CreateCharReputationWindow (MIT, Daggerfall Workshop) and the
// wizard's CreateCharCustomClassWindow_OnClose arm. The last chargen
// screen the port did not have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HP_MIN, HP_MAX, HP_DEFAULT, DIFFICULTY_MIN, DIFFICULTY_MAX,
  FREE_EDIT_MIN, FREE_EDIT_MAX, STAT_DEFAULT,
  difficultyPoints, advancementMultiplier, daggerY, availableSkills,
  buildCustomCareer, classAffinityIndex, customSpellSetIndex,
  roundNearestBarHeight, repClick, repPointsToDistribute,
  REP_BAR_TOP, REP_BAR_BOTTOM, REP_BAR_MIDDLE, HELP_TOPICS,
} from '../src/systems/customClass.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { chargenHit, CUSTOM_SKILL_RECTS, CUSTOM_HP_UP, CUSTOM_HP_DOWN, CUSTOM_HELP, CUSTOM_REP, CUSTOM_EXIT } from '../src/ui/chargenArt.js';
import { SKILLS, SKILL_NAMES, SKILL_COUNT, MAGIC_SKILLS } from '../src/systems/skills.js';   // the six schools live here now
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { createChargenWindow } from '../src/systems/chargenSession.js';
import { readFileSync } from 'node:fs';

// ---- the difficulty laws ----

test('U20a: difficulty points - +1 per HP above the default, -2 per HP below', () => {
  // UpdateDifficulty (:481-490)
  assert.equal(difficultyPoints(HP_DEFAULT), 0);
  assert.equal(difficultyPoints(HP_DEFAULT + 1), 1);
  assert.equal(difficultyPoints(HP_MAX), 22, '30 hp -> +22');
  assert.equal(difficultyPoints(HP_DEFAULT - 1), -2, 'BELOW the default costs TWO points each');
  assert.equal(difficultyPoints(HP_MIN), -8, '4 hp -> -8');
  // the advantage/disadvantage terms ride the same tally (U20b)
  assert.equal(difficultyPoints(HP_DEFAULT, 5, -3), 2);
});

test('U20a: the advancement multiplier is 0.3 + 2.7*(pts+12)/52', () => {
  // :498 - the level-up curve the whole class economy rides
  assert.equal(advancementMultiplier(0), 0.3 + (2.7 * 12) / 52);
  assert.ok(Math.abs(advancementMultiplier(-12) - 0.3) < 1e-12, 'the floor of the legal band is exactly 0.3');
  assert.ok(Math.abs(advancementMultiplier(40) - 3.0) < 1e-12, 'the ceiling is exactly 3.0');
  // a default-HP class with no advantages sits where the classic
  // careers do (CLASS*.CFG multipliers cluster near 0.9)
  assert.ok(Math.abs(advancementMultiplier(difficultyPoints(HP_DEFAULT)) - 0.923076923) < 1e-6);
});

test('U20a: the difficulty dagger clamps to the gauge and truncates like C#', () => {
  // :500-511 - (int) casts TRUNCATE toward zero, they do not round
  assert.equal(daggerY(0), 115, 'the default sits at defaultDaggerY');
  assert.equal(daggerY(40), Math.max(46, Math.trunc(115 - 37)), 'max difficulty -> the top of the gauge');
  assert.equal(daggerY(40), 78);
  assert.equal(daggerY(-12), Math.min(186, Math.trunc(115 + 41)), 'min difficulty -> the bottom');
  assert.equal(daggerY(-12), 156);
  // the visual clamps exist for out-of-band values the gates refuse
  assert.equal(daggerY(1000), 46, 'clamped at minDaggerY');
  assert.equal(daggerY(-1000), 186, 'clamped at maxDaggerY');
  // TRUNCATION, not rounding - pinned where the two DIFFER, or the
  // assertion proves nothing: 7 points -> 115 - 6.475 = 108.525,
  // which truncates to 108 and would ROUND to 109
  assert.equal(daggerY(7), 108);
  // and on the negative arm: -2 -> 115 + 6.833 = 121.83 -> 121, not 122
  assert.equal(daggerY(-2), 121);
});

// ---- the skill picker ----

test('U20a: the picker offers every UNASSIGNED skill, alphabetical', () => {
  // :196-199 sorts the list "a la classic"; SkillPicker_OnItemPicked
  // (:337-342) removes the pick and returns the replaced skill.
  const none = availableSkills(Array(12).fill(null));
  assert.equal(none.length, SKILL_COUNT, 'nothing assigned -> all 35');
  const names = none.map((id) => SKILL_NAMES[id]);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'alphabetical by DISPLAY name');
  const some = availableSkills([SKILLS.Archery, SKILLS.Dodging, null, null, null, null, null, null, null, null, null, null]);
  assert.equal(some.length, SKILL_COUNT - 2);
  assert.ok(!some.includes(SKILLS.Archery) && !some.includes(SKILLS.Dodging), 'assigned skills leave the list');
  // and a replaced skill comes BACK: the list is derived, never stale
  assert.ok(availableSkills([SKILLS.Dodging, ...Array(11).fill(null)]).includes(SKILLS.Archery));
});

// ---- the career the builder mints ----

const twelve = [
  SKILLS.Archery, SKILLS.LongBlade, SKILLS.CriticalStrike,
  SKILLS.Dodging, SKILLS.Running, SKILLS.Stealth,
  SKILLS.Climbing, SKILLS.Jumping, SKILLS.Swimming,
  SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise,
];
const stats = Object.fromEntries(STAT_KEYS_ORDER.map((k, i) => [k, 40 + i]));

test('U20a: the built career carries the DFCareer defaults, the skills and the stats', () => {
  const c = buildCustomCareer({ name: 'Scout', hp: 10, skills: twelve, stats });
  assert.equal(c.name, 'Scout');
  assert.equal(c.hitPointsPerLevel, 10);
  assert.deepEqual(c.primarySkills, twelve.slice(0, 3));
  assert.deepEqual(c.majorSkills, twelve.slice(3, 6));
  assert.deepEqual(c.minorSkills, twelve.slice(6, 12));
  // a fresh DFCareer is all-zero flags with the x0.50 spell-point
  // multiplier (:161-165) - Times_0_50 = 20 in the 0x1C00 band
  assert.equal(c.abilityFlagsAndSpellPointsBitfield, 20 << 8);
  for (const f of ['resistanceFlags', 'immunityFlags', 'lowToleranceFlags', 'criticalWeaknessFlags',
    'rapidHealing', 'regeneration', 'spellAbsorptionFlags', 'attackModifierFlags',
    'forbiddenMaterialsFlags', 'weaponArmorShieldsBitfield']) {
    assert.equal(c[f], 0, `${f} defaults to 0, as a fresh DFCareer does`);
  }
  // the multiplier rides the class's OWN hp, not the default
  assert.equal(c.advancementMultiplier, advancementMultiplier(difficultyPoints(10)));
  // and the wizard copies the WORKING stats onto the base attributes
  for (const k of STAT_KEYS_ORDER) assert.equal(c[k], stats[k]);
});

test('U20a: the x0.50 multiplier decodes through the port\'s OWN reader path', () => {
  // TEST THE SHAPE THE PRODUCER MINTS: the bitfield must decode to
  // 0.5 through spellPointMultiplier, or a custom class's magicka is
  // silently wrong.
  const c = buildCustomCareer({ name: 'X', hp: HP_DEFAULT, skills: twelve, stats });
  return import('../src/systems/chargen.js').then(({ spellPointMultiplier }) => {
    assert.equal(spellPointMultiplier(c.abilityFlagsAndSpellPointsBitfield), 0.5);
  });
});

// ---- the affinity index (the biography quiz) ----

const career = (skills) => ({ career: { primarySkills: skills.slice(0, 3), majorSkills: skills.slice(3, 6), minorSkills: skills.slice(6, 12) } });

test('U20a: GetClassAffinityIndex picks the HIGHEST overlap, first on a tie', () => {
  // BiogFile.cs:519-558 - strictly-greater, so index 0 keeps a tie.
  const a = career(twelve);                                   // identical -> 12
  const b = career([...twelve.slice(0, 6), ...Array(6).fill(SKILLS.Mysticism)]);   // 6
  assert.equal(classAffinityIndex(twelve, [b, a]), 1, 'the better match wins wherever it sits');
  assert.equal(classAffinityIndex(twelve, [a, b]), 0);
  // a tie keeps the EARLIER index (affinity > highestAffinity)
  assert.equal(classAffinityIndex(twelve, [b, b]), 0);
  // no overlap at all -> index 0, DFU's initialized selectedIndex
  const none = career(Array(12).fill(SKILLS.Mysticism));
  assert.equal(classAffinityIndex([SKILLS.Archery], [none, none]), 0);
});

// ---- the custom starting-spell rule ----

test('U20a: a custom class gets the SPELLSWORD set only with a magic primary/major', () => {
  // StartGameBehaviour.SetStartingSpells (:809-823)
  const mundane = buildCustomCareer({ name: 'M', hp: 8, skills: twelve, stats });
  assert.equal(customSpellSetIndex(mundane), null, 'no magic skill -> no starting spells');
  const withMajor = buildCustomCareer({
    name: 'S', hp: 8, stats,
    skills: [...twelve.slice(0, 4), SKILLS.Destruction, ...twelve.slice(5)],
  });
  assert.equal(customSpellSetIndex(withMajor), 1, 'a magic MAJOR -> the Spellsword set');
  const withPrimary = buildCustomCareer({
    name: 'P', hp: 8, stats,
    skills: [SKILLS.Mysticism, ...twelve.slice(1)],
  });
  assert.equal(customSpellSetIndex(withPrimary), 1, 'a magic PRIMARY -> the Spellsword set');
  // a magic MINOR does NOT qualify - DFU tests only the six
  const withMinor = buildCustomCareer({
    name: 'N', hp: 8, stats,
    skills: [...twelve.slice(0, 6), SKILLS.Illusion, ...twelve.slice(7)],
  });
  assert.equal(customSpellSetIndex(withMinor), null, 'a magic MINOR is NOT enough');
  assert.equal(MAGIC_SKILLS.length, 6, 'DFCareer.MagicSkills is the six schools');
});

// ---- the reputation window ----

test('U20a: the bar rounding quirk - a remainder of 4 rounds UP, 1..3 DOWN', () => {
  // RoundNearestBarHeight (:243-259)
  assert.equal(roundNearestBarHeight(0), 0);
  assert.equal(roundNearestBarHeight(3), 0, '3 % 5 = 3, not > 3 -> down');
  assert.equal(roundNearestBarHeight(4), 5, '4 % 5 = 4 > 3 -> UP');
  assert.equal(roundNearestBarHeight(5), 5);
  assert.equal(roundNearestBarHeight(9), 10, '9 % 5 = 4 -> up');
  assert.equal(roundNearestBarHeight(8), 5, '8 % 5 = 3 -> down');
  assert.equal(roundNearestBarHeight(52), 50, 'capped at the bar length');
  assert.equal(roundNearestBarHeight(1000), 50);
});

test('U20a: a rep click picks its column by x and its sign by the middle line', () => {
  // RepPanel_OnMouseClick (:255-281) + UpdateRep (:261-281)
  const zero = { merchants: 0, peasants: 0, scholars: 0, nobility: 0, underworld: 0 };
  assert.equal(repClick(10, REP_BAR_TOP - 1, zero), null, 'above the band is dead');
  assert.equal(repClick(10, REP_BAR_BOTTOM + 1, zero), null, 'below the band is dead');
  // the four thresholds, verbatim
  assert.equal(repClick(0, 40, zero).group, 'merchants');
  assert.equal(repClick(34, 40, zero).group, 'merchants', 'x 34 is still merchants');
  assert.equal(repClick(35, 40, zero).group, 'peasants');
  assert.equal(repClick(68, 40, zero).group, 'scholars');
  assert.equal(repClick(101, 40, zero).group, 'nobility');
  assert.equal(repClick(134, 40, zero).group, 'underworld');
  // ABOVE the middle is positive, below negative, value = height/5
  assert.deepEqual(repClick(0, REP_BAR_MIDDLE - 25, zero), { group: 'merchants', value: 5 });
  assert.deepEqual(repClick(0, REP_BAR_MIDDLE + 25, zero), { group: 'merchants', value: -5 });
  // the rounding rides it: 24px up -> 25 -> 5 points
  assert.equal(repClick(0, REP_BAR_MIDDLE - 24, zero).value, 5);
  // 23px up -> 3 remainder -> 20 -> 4 points
  assert.equal(repClick(0, REP_BAR_MIDDLE - 23, zero).value, 4);
  // exactly ON the middle line matches NEITHER of UpdateRep's two
  // strict ifs, so no bar moves - but repVal is still computed, as
  // sign 1 * 0 / 5, and the group is ZEROED (:261-281)
  assert.deepEqual(repClick(0, REP_BAR_MIDDLE, { ...zero, merchants: 3 }), { group: 'merchants', value: 0 });
  // and a below-middle click that rounds to nothing gives 0, not -0:
  // C#'s short has no negative zero
  const tiny = repClick(0, REP_BAR_MIDDLE + 2, zero);
  assert.equal(tiny.value, 0);
  assert.ok(!Object.is(tiny.value, -0), 'never JS negative zero');
});

test('U20a: the balance ledger is the NEGATED sum, zero when spent', () => {
  // UpdatePointsToDistribute (:283-287)
  assert.equal(repPointsToDistribute({ merchants: 0, peasants: 0, scholars: 0, nobility: 0, underworld: 0 }), 0);
  assert.equal(repPointsToDistribute({ merchants: 5, peasants: -5, scholars: 0, nobility: 0, underworld: 0 }), 0);
  assert.equal(repPointsToDistribute({ merchants: 5, peasants: 0, scholars: 0, nobility: 0, underworld: 0 }), -5);
  assert.equal(repPointsToDistribute({ merchants: -3, peasants: -2, scholars: 0, nobility: 0, underworld: 0 }), 5);
});

// ---- the flow ----

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const CAREERS = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: { ...CAREER, name: `C${i}` } }));
const flow = () => {
  const f = new ChargenFlow(CAREERS, () => 0);
  f.describeText = (id) => [{ text: `record ${id}`, center: true }];
  return f;
};
/** a builder with everything the exit gates want */
const readyBuilder = () => {
  const f = flow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;   // the Custom row
  f.useClass();
  const c = f.custom;
  c.className = 'Scout';
  twelve.forEach((id, i) => { c.skills[i] = id; });
  return f;
};

test('U20a: the class list\'s LAST row is Custom, and it opens the builder without a description', () => {
  // CreateCharClassSelect.cs:66-67 appends Custom; :72-77 sets
  // selectedClass null and closes - no description box, no drums.
  const f = flow();
  assert.equal(f.classRowCount(), CAREERS.length + 1);
  assert.equal(f.classRowName(CAREERS.length), 'Custom');
  f.state = 'class';
  f.describeClass = () => [{ text: 'should not be shown', center: false }];
  f.classListIndex = CAREERS.length;
  f.useClass();
  assert.equal(f.state, 'customClass');
  assert.equal(f.classConfirm, null, 'the Custom row opens NO description box');
  // the keyboard walk reaches it by CLAMPING down the 19 rows -
  // ListBox.SelectPrevious/SelectNext guard their ends rather than
  // wrapping (ListBox.cs:709-740), which the port used to do
  const g = flow();
  g.state = 'class';
  g.input('up');
  assert.equal(g.classListIndex, 0, 'up from row 0 CLAMPS - the list does not wrap');
  for (let i = 0; i < 30; i++) g.input('down');
  assert.equal(g.classListIndex, CAREERS.length, 'walking down stops ON Custom, the last row');
  g.input('down');
  assert.equal(g.classListIndex, CAREERS.length, 'and stays there');
});

test('U20a: the reroll memo keys on the CAREER, not its index', () => {
  // DFU compares DFClass != characterDocument.career (:238) - an
  // object comparison. A CUSTOM class carries the AFFINITY index, so
  // an index-keyed memo restored the matching standard class's roll
  // instead of rolling for the new career.
  let n = 0;
  const f = new ChargenFlow(CAREERS, () => { n += 0.017; return n % 1; });
  f.describeText = (id) => [{ text: `record ${id}`, center: true }];
  f.classIndex = 5;
  f._enterStats();
  const asStandard = { ...f.stats };
  // build a custom class whose affinity lands on 5
  CAREERS[5] = { name: 'C5', career: { primarySkills: twelve.slice(0, 3), majorSkills: twelve.slice(3, 6), minorSkills: twelve.slice(6, 12) } };
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  f.useClass();
  f.custom.className = 'Scout';
  twelve.forEach((id, i) => { f.custom.skills[i] = id; });
  f.customExit();
  assert.equal(f.classIndex, 5, 'the affinity index collides with the rolled class');
  f._enterStats();
  assert.notDeepEqual(f.stats, asStandard, 'the CUSTOM career gets its own roll');
  // and the memo itself holds the CAREER, not an index - the shape is
  // pinned directly, because an index-keyed memo can still reroll by
  // accident and pass the behavioural half
  assert.equal(f._statsCareer, f.career, 'the stats memo keys on the career object');
  assert.equal(typeof f._statsCareer, 'object');
  // AUDIT 18: the SKILLS window has no such memo at all - it is gated
  // on skillsNeedReroll (DaggerfallStartNewGameWizard.cs:256), which
  // the custom accept raised on its way through SetChooseBioWindow.
  assert.equal(f.skillsNeedReroll, true);
  assert.equal(f._skillsCareer, undefined, 'the career memo is gone from the skills screen');
  CAREERS[5] = { name: 'C5', career: { ...CAREER, name: 'C5' } };
});

test('U20a: the CUSTOM row has no career behind it - reading one must not THROW', () => {
  // The live probe caught this the moment its arrow walk landed on
  // the row: `careers[classIndex].career` with classIndex 18 threw.
  // DFU's selectedClass is NULL for that row (CreateCharClassSelect
  // .cs:74), so the getter answers null and every caller stays alive.
  //
  // AUDIT 17m: the two indices are separate now, so highlighting the
  // Custom row moves the LIST and leaves the DOCUMENT where it was -
  // which is DFU's own shape (:74 nulls the window's selectedClass;
  // characterDocument is untouched until an accept arm runs). The
  // getter's guard therefore cannot be reached from this row any
  // more, and the row must still name and draw without throwing.
  const f = flow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  assert.equal(f.classIndex, 0, 'the DOCUMENT does not follow the highlight');
  assert.doesNotThrow(() => f.classRowName(f.classListIndex));
  assert.doesNotThrow(() => f.result(), 'even a result read survives it');
  // the guard itself still answers null for a document index with no
  // career behind it, which is what it exists for
  const bare = flow();
  bare.classIndex = CAREERS.length;
  assert.equal(bare.career, null, 'no career behind that index -> null, not a throw');
  // and once the builder finishes, the getter serves the BUILT class
  f.useClass();
  f.custom.className = 'Scout';
  twelve.forEach((id, i) => { f.custom.skills[i] = id; });
  f.customExit();
  assert.equal(f.career.name, 'Scout');
});

test('U20a: the CUSTOM row is CLICKABLE, not keyboard-only', () => {
  // The list hit bounded on careers.length, so the last row - Custom -
  // answered the keyboard and NOTHING to a tap: the U14 keyboard-only
  // shape again, caught by the live probe. The bound is the LIST's
  // row count.
  const f = flow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  f._scrollToClass();
  f._classRowH = 7;                      // what the draw caches from the font
  const [plx, ply] = [26, 27];
  const [ox, oy] = [60, 36];             // PICK00I0 is 200x128, Center/Middle
  const visibleRow = CAREERS.length - f.classScroll;
  const hit = chargenHit(f, ox + plx + 60, oy + ply + visibleRow * 7 + 2);
  assert.deepEqual(hit, { setClass: CAREERS.length }, 'the Custom row answers a click');
  // and a double click USES it, opening the builder
  f.clickClassRow(CAREERS.length, 1000);
  f.clickClassRow(CAREERS.length, 1100);
  assert.equal(f.state, 'customClass');
});

test('U20a: a fresh builder starts at the DFU defaults', () => {
  const f = flow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  f.useClass();
  const c = f.custom;
  assert.equal(c.hp, HP_DEFAULT);
  assert.equal(c.className, '');
  assert.deepEqual(c.skills, Array(12).fill(null));
  assert.equal(c.statPool, 0);
  for (const k of STAT_KEYS_ORDER) assert.equal(c.stats[k], STAT_DEFAULT, 'DaggerfallStats defaults every attribute to 50');
  assert.deepEqual(c.reps, { merchants: 0, peasants: 0, scholars: 0, nobility: 0, underworld: 0 });
});

test('U20a: the HP spinner clamps at 4 and 30', () => {
  const f = readyBuilder();
  for (let i = 0; i < 50; i++) f.customHp(1);
  assert.equal(f.custom.hp, HP_MAX);
  for (let i = 0; i < 50; i++) f.customHp(-1);
  assert.equal(f.custom.hp, HP_MIN);
});

test('U20a: the freeEdit stat spinner clamps 10..75 and the pool is a ZERO-SUM ledger', () => {
  // StatsRollout.cs:231-276 with freeEdit: the VALUE clamps, the pool
  // is free to go negative - the exit gate is what demands balance.
  const f = readyBuilder();
  const c = f.custom;
  const key = STAT_KEYS_ORDER[0];
  for (let i = 0; i < 40; i++) f.customSpendStat(1);
  assert.equal(c.stats[key], FREE_EDIT_MAX, 'the value stops at 75');
  assert.equal(c.statPool, -(FREE_EDIT_MAX - STAT_DEFAULT), 'and every point came OUT of the pool');
  for (let i = 0; i < 100; i++) f.customSpendStat(-1);
  assert.equal(c.stats[key], FREE_EDIT_MIN, 'the value stops at 10');
  // 50 -> 75 spent 25 (pool -25), then 75 -> 10 returned 65
  assert.equal(c.statPool, 40);
  // the ledger's invariant: pool + sum(stats) is conserved
  const sum = STAT_KEYS_ORDER.reduce((a, k) => a + c.stats[k], 0);
  assert.equal(c.statPool + sum, STAT_DEFAULT * 8, 'nothing is created or destroyed');
});

test('U20a: the exit gates refuse in DFU\'s ORDER, each on its own record', () => {
  // ExitButton_OnMouseClick (:414-460): name 301, skills 300,
  // stats 302, difficulty 306 - each a ClickAnywhereToClose box.
  const f = flow();
  f.state = 'class'; f.classListIndex = CAREERS.length; f.useClass();
  const c = f.custom;
  f.customExit();
  assert.match(c.box[0].text, /301/, 'no name -> strNameYourClass');
  c.box = null;
  c.className = 'Scout';
  f.customExit();
  assert.match(c.box[0].text, /300/, 'a skill unset -> strSetSkills');
  c.box = null;
  twelve.forEach((id, i) => { c.skills[i] = id; });
  f.customSpendStat(1);                      // pool -1
  f.customExit();
  assert.match(c.box[0].text, /302/, 'an unbalanced pool -> strDistributeStats');
  c.box = null;
  f.customSpendStat(-1);                     // balanced again
  // the difficulty gate: 4 hp is -8 (legal); push the ADJUST out of band
  c.hp = HP_MIN;
  assert.ok(f.customDifficulty() >= DIFFICULTY_MIN, 'HP alone cannot leave the band');
  f.customExit();
  // with no biography source this flow skips to the name screen, as
  // every other class-accept path does
  assert.equal(f.state, 'name', 'all four gates passed -> the wizard moves on');
  // and WITH one it lands on U19's bio-method screen, like the list
  const g = readyBuilder();
  g.biogFor = () => ({ questions: [{ text: ['q', ''], answers: [{ text: 'a', effects: [] }] }] });
  g.customExit();
  assert.equal(g.state, 'bioMethod', 'SetChooseBioWindow, exactly as the list\'s accept arm does');
});

test('U20a: the finished class overrides the list, and the AFFINITY index rides classIndex', () => {
  // CreateCharCustomClassWindow_OnClose (:374-401)
  const f = readyBuilder();
  // make careers[5] the best skill match so the affinity is checkable
  CAREERS[5] = { name: 'C5', career: { primarySkills: twelve.slice(0, 3), majorSkills: twelve.slice(3, 6), minorSkills: twelve.slice(6, 12) } };
  f.custom.reps = { merchants: 2, peasants: -2, scholars: 0, nobility: 0, underworld: 0 };
  f.customExit();
  assert.equal(f.isCustom, true);
  assert.equal(f.career.name, 'Scout', 'the career getter serves the BUILT class');
  assert.equal(f.classIndex, 5, 'classIndex becomes the affinity index - the biography quiz\'s');
  // the document's reps in sGroupReputations order: commoners
  // (the window's PEASANTS column) first, then merchants
  assert.deepEqual(f.customReps, [-2, 2, 0, 0, 0]);
  assert.deepEqual(f.result().career.primarySkills, twelve.slice(0, 3));
  assert.equal(f.result().isCustom, true);
  CAREERS[5] = { name: 'C5', career: { ...CAREER, name: 'C5' } };   // restore
});

test('U20a: a standard class afterwards replaces the CAREER - and isCustom STICKS, verbatim', () => {
  // ClassSelectWindow_OnClose's else arm assigns career + classIndex
  // (:363-364) and nothing else. `isCustom` is assigned in exactly
  // ONE place in the whole DFU codebase - `= true` on the Custom row
  // (:358) - and the five reputations only in the builder's own
  // accept arm (:385-389). Neither is ever cleared, so a document
  // that has once been custom stays custom. Ported bug-for-bug: it
  // reaches ItemHelper.cs:1310 (the starting kit) and
  // StartGameBehaviour.cs:804-809 (the spell set).
  const f = readyBuilder();
  f.custom.reps = { merchants: 2, peasants: -2, scholars: 0, nobility: 0, underworld: 0 };
  f.customExit();
  assert.equal(f.isCustom, true);
  f.state = 'class';
  f.classListIndex = 3;
  f.describeClass = () => null;   // no art -> the pick stands at once
  f.useClass();
  assert.equal(f.career.name, 'C3', 'the LIST class is served again');
  assert.equal(f.customCareer, null, 'the custom CAREER is replaced');
  assert.equal(f.isCustom, true, 'but the document still says custom - DFU never clears it');
  assert.deepEqual(f.customReps, [-2, 2, 0, 0, 0], 'and the reputations ride along too');
});

test('U20a: cancelling the builder drops the half-built career, not the flag', () => {
  // The flag goes up at the ROW PICK, before the builder is even
  // constructed (:356-359), so cancelling out of it cannot lower it -
  // DFU has no code that does.
  const f = flow();
  f.state = 'class'; f.classListIndex = CAREERS.length; f.useClass();
  f.custom.className = 'Half';
  f.input('back');
  assert.equal(f.state, 'class', 'Escape returns to the list (the wizard\'s cancel arm)');
  assert.equal(f.customCareer, null, 'no half-built career survives');
  assert.equal(f.isCustom, true, 'the flag was raised at the row pick and stays - verbatim');
});

test('U20a: the skill picker and the help picker are modal sub-windows', () => {
  const f = readyBuilder();
  const c = f.custom;
  // the skill picker lists what is NOT assigned - here 35 - 12 = 23
  f.customOpenSkillPick(0);
  assert.equal(c.sub, 'skillPick');
  assert.equal(c.pickItems.length, SKILL_COUNT - 12);
  const first = c.pickItems[0];
  f.customPickSkill(0);
  assert.equal(c.skills[0], first, 'the pick lands on the slot the button opened');
  assert.equal(c.sub, null, 'and the picker closes');
  // the help picker's topics carry DFU's ids and open a box - and a
  // DaggerfallListPickerWindow raises OnItemPicked from the ListBox's
  // OnUseSelectedItem (:84,136-148), so it takes a DOUBLE click, the
  // same gesture law U17 pinned for the class list
  f.applyHit({ customHelp: true });
  assert.equal(c.sub, 'help');
  f.applyHit({ pickRow: 2, now: 1000 });
  assert.equal(c.sub, 'help', 'ONE click only selects');
  assert.equal(c.pickCursor, 2);
  assert.equal(c.box, null);
  f.applyHit({ pickRow: 2, now: 1100 });
  assert.equal(c.sub, null, 'the second click inside the window USES it');
  assert.match(c.box[0].text, /2400/, 'General -> TEXT.RSC 2400');
  assert.equal(HELP_TOPICS.length, 8);
  f.input('confirm');   // ClickAnywhereToClose
  assert.equal(c.box, null);
});

test('U20a: the rep sub-window\'s exit is gated on a ZERO balance', () => {
  const f = readyBuilder();
  const c = f.custom;
  f.applyHit({ customRep: true });
  assert.equal(c.sub, 'rep');
  f.applyHit({ repClick: [0, REP_BAR_MIDDLE - 25] });   // merchants +5
  assert.equal(c.reps.merchants, 5);
  f.customRepExit();
  assert.equal(c.sub, 'rep', 'an unbalanced ledger keeps the window open');
  assert.match(c.box[0].text, /303/, 'strBalanceMustEqualZero');
  c.box = null;
  f.applyHit({ repClick: [35, REP_BAR_MIDDLE + 25] });  // peasants -5
  assert.equal(repPointsToDistribute(c.reps), 0);
  f.customRepExit();
  assert.equal(c.sub, null, 'balanced -> the window closes');
});

test('U20a: the pointer path answers every control on the builder', () => {
  const f = readyBuilder();
  const at = (r) => [r[0] + 2, r[1] + 2];
  assert.deepEqual(chargenHit(f, ...at(CUSTOM_EXIT)), { customExit: true });
  assert.deepEqual(chargenHit(f, ...at(CUSTOM_HP_UP)), { customHp: 1 });
  assert.deepEqual(chargenHit(f, ...at(CUSTOM_HP_DOWN)), { customHp: -1 });
  assert.deepEqual(chargenHit(f, ...at(CUSTOM_HELP)), { customHelp: true });
  assert.deepEqual(chargenHit(f, ...at(CUSTOM_REP)), { customRep: true });
  for (let i = 0; i < 12; i++) {
    assert.deepEqual(chargenHit(f, ...at(CUSTOM_SKILL_RECTS[i])), { customSkill: i }, `skill button ${i}`);
  }
  // the freeEdit rollout answers on the stats screen's own geometry
  assert.deepEqual(chargenHit(f, 20, 22), { customStatCursor: 0 });
  assert.deepEqual(chargenHit(f, 51, 24), { customStatStep: 1 });
  // an open box eats every one of them
  f.custom.box = [{ text: 'x', center: true }];
  assert.deepEqual(chargenHit(f, ...at(CUSTOM_EXIT)), { customBox: true });
});

test('U20a: a typed name keeps its CAPITALS - the event rides with the code', () => {
  // codeToKey lowercases every letter ('KeyS' -> 's'), so a host that
  // hands the overlay only the CODE could never type a capital. The
  // window prefers the real event when it gets one; the live probe
  // caught the exterior host not passing it (typed "Scout", read back
  // "scout"), and this pin holds BOTH halves.
  const f = new ChargenFlow(CAREERS, () => 0);
  const w = createChargenWindow(f, {});
  f.state = 'name';
  w.input('KeyS', { key: 'S' });
  w.input('KeyC', { key: 'c' });
  assert.equal(f.name, 'Sc', 'the event\'s own case survives');
  // and without an event the code path still types, lowercased
  w.input('KeyO');
  assert.equal(f.name, 'Sco');
  // THE SEAM, swept rather than remembered: the exterior hosts' one
  // key router must hand the event along, or the case is lost again.
  const src = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(src, /overlay\.input\(e\.code,\s*e\)/,
    'townTalk must pass the EVENT with the code, or typed capitals die here');
});

test('U20a: the rep window\'s balance is its own FIELD, 0 until a bar is clicked', () => {
  // CreateCharReputationWindow is NEWed on every press of the
  // Reputations button and its `pointsToDistribute` is a field
  // initialised to 0; UpdatePointsToDistribute runs only on a BAR
  // CLICK (:136,255-281,283-287). So re-opening the window over an
  // unbalanced ledger reads 0 - and the exit gate reads that stale 0.
  // Classic really does let you leave it unspent this way.
  const f = readyBuilder();
  const c = f.custom;
  f.applyHit({ customRep: true });
  assert.equal(c.repPoints, 0);
  f.applyHit({ repClick: [0, REP_BAR_MIDDLE - 25] });      // merchants +5
  assert.equal(c.repPoints, -5, 'a bar click updates the field');
  f.customRepExit();
  assert.equal(c.sub, 'rep', 'and the gate refuses on it');
  c.box = null;
  // ESCAPE closes unconditionally (the popup's own cancel), leaving
  // the ledger unbalanced...
  f.input('back');
  assert.equal(c.sub, null);
  assert.equal(c.reps.merchants, 5, 'the values persist - UpdateRep wrote them straight into the builder');
  // ...and RE-OPENING reads the fresh field, so the gate now passes
  f.applyHit({ customRep: true });
  assert.equal(c.repPoints, 0, 'the new window starts at 0 regardless of the bars');
  f.customRepExit();
  assert.equal(c.sub, null, 'the stale-zero gate lets an unbalanced ledger out - verbatim');
  assert.equal(repPointsToDistribute(c.reps), -5, 'and the ledger really is still unbalanced');
});

test('U20a follow-up: the MINUS key reaches the stat and skill spinners', () => {
  // overlayAction tests the typed-character class FIRST and the
  // hyphen is a literal inside it (input.js:18), so '-' always
  // arrives as 'char:-'. The stats screen's `minus` arm was
  // unreachable from a keyboard: a point could be spent and never
  // taken back except by clicking.
  const f = flow();
  f.classIndex = 0;
  f._enterStats();
  const rolled = { ...f.stats };
  const pool = f.statPool;
  f.state = 'stats';
  f.input('plus');
  assert.notDeepEqual(f.stats, rolled);
  f.input('char:-');
  assert.deepEqual(f.stats, rolled, 'the typed hyphen spends BACK');
  assert.equal(f.statPool, pool);
  // and the skills screen shares the fix
  f._enterSkills();
  f.state = 'skills';
  const skills = [...f.skills];
  f.input('plus');
  assert.notDeepEqual(f.skills, skills);
  f.input('char:-');
  assert.deepEqual(f.skills, skills);
});
