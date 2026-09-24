// LV1 — THE ASCENSION: the enhanced skin's level-up window.
//
// Mac, 2026-09-18: "the next enhanced UI window... a replication of the
// skyrim level up UI in our own constellation vision."
//
// WHAT THESE PINS ARE FOR. The window writes nothing: it READS a live
// rollout screen and presses that screen's own buttons. So the pins
// are about the reading and the pressing - that the rows report the
// LAW's answer rather than a copy of it, that a press lands on the
// attribute it was aimed at, that the figure can be drawn without two
// stars on top of each other, and that the one sentence this screen
// teaches a player about their own advancement is the sentence
// PlayerEntity.SetCurrentLevelUpSkillSum actually computes.
//
// A PIN MUST FAIL (bible/Home.md): every assertion below was checked
// against a one-character mutation of the law it claims to pin -
// noted at the pin where the mutation is not obvious.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAT_KEYS_ORDER, createCharacter } from '../src/systems/chargen.js';
import { MAX_STAT_VALUE } from '../src/ui/chargen.js';
import { SKILLS, SKILL_NAMES, setSkillRecentlyIncreased } from '../src/systems/skills.js';
import { levelUpSkillSum, LEVELUP_SKILL_SUM_PER_LEVEL, LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX } from '../src/systems/advancement.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { damageModifier, magicResist } from '../src/combat/formulas.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { LevelUpScreen, MUST_DISTRIBUTE_BONUS_POINTS } from '../src/ui/charsheet.js';
import { paintLevelUpWait, RISEN_WAIT_TEXT, OGHMA_WAIT_TEXT, LEVELUP_WAIT_MS } from '../src/ui/charSheetDoor.js';
import { VirtueLevelUpScreen, REMAINING_POINTS_ERROR } from '../src/ui/virtueLevelUp.js';
import { OGHMA_BONUS_POOL } from '../src/systems/artifactEffects.js';
import {
  levelingSettings, initVirtueLeveling, LEVELING_VIRTUE, LEVELUP_TOTAL,
  attributeOffset, canRaiseAttribute, ATTRIBUTE_INCREASE_LIMIT,
} from '../src/systems/oblivionLeveling.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { ORL_VENDOR } from '../src/systems/oblivionLeveling.js';
import {
  LANE_CLASSIC, LANE_OGHMA, LANE_VIRTUE, levelUpLane, rolloutRows, rolloutPool, poolLabel,
  canAscend, refusalText, corneredHint, pressAt, raiseAt, lowerAt, focusAt, focusedKey, ascend,
  allMaxed, ALL_MAX_LINE, levelUpFrame,
  levelUpCrown, levelProgress, levelSumRoles, riseRibbon, levelUpVitals, levelUpModel,
  STAR_FIGURE, STAR_MIN_APART_X, STAR_MIN_APART_Y, crowdedStarPairs,
  ATTRIBUTE_BLURB, attributeLabel, starBrightness,
  ROLE_COUNTS, ROLE_DROPPED, ROLE_BEST, ROLE_IDLE, ROLE_NOTE,
} from '../src/ui/levelUpView.js';

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
function player(over = {}) {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  p.name = 'Toshley'; p.race = 'Nord';
  p.readyToLevelUp = true; p.pendingLevel = (p.level ?? 1) + 1;
  return Object.assign(p, over);
}
const reader = (over = {}) => (k) => (k in over ? over[k] : MOD_SETTINGS[ORL_VENDOR].keys[k].default);
const S = (over = {}) => levelingSettings(reader(over));
function virtuePlayer(over = {}) {
  const p = player();
  initVirtueLeveling(p, LEVELING_VIRTUE);
  return Object.assign(p, over);
}

// ── THE LANE ──────────────────────────────────────────────────────

test('LV1: the window reads WHICH LAW is live off the screen, not off a setting', () => {
  const classic = new LevelUpScreen(player(), seq(0));
  assert.equal(levelUpLane(classic), LANE_CLASSIC);
  const book = new LevelUpScreen(player({ oghmaLevelUp: true }), seq(0));
  assert.equal(levelUpLane(book), LANE_OGHMA);
  assert.equal(rolloutPool(book), OGHMA_BONUS_POOL, 'the book is a FIXED thirty (AUDIT 39), never a 4..6 roll');
  const mod = new VirtueLevelUpScreen(virtuePlayer(), { settings: S(), rolls: seq(0) });
  assert.equal(levelUpLane(mod), LANE_VIRTUE);
  // DUCK TYPES, not instanceof: the scenes ask the same way, and a
  // type test here would drag two UI classes into every caller's
  // import graph.
  const v = src('src/ui/levelUpView.js');
  assert.match(v, /screen\.isVirtueLevelUp/);
  assert.doesNotMatch(v, /instanceof (Virtue)?LevelUpScreen/);
  assert.doesNotMatch(v, /^import .*(LevelUpScreen|VirtueLevelUpScreen)/m, 'neither screen class is imported at all');
});

test('LV1: each lane is counted and refused IN ITS OWN WORDS, imported rather than typed', () => {
  const classic = new LevelUpScreen(player(), seq(0));
  const mod = new VirtueLevelUpScreen(virtuePlayer(), { settings: S(), rolls: seq(0) });
  assert.equal(refusalText(classic), MUST_DISTRIBUTE_BONUS_POINTS, 'Internal_Strings.csv:110, through ui/charsheet.js');
  assert.equal(refusalText(mod), REMAINING_POINTS_ERROR, 'l10n/en.yaml:34, through ui/virtueLevelUp.js');
  assert.match(poolLabel(mod), /virtue/i);
  assert.notEqual(poolLabel(classic), poolLabel(mod));
  // The strings are IMPORTED. A window that retyped a refusal is a
  // window that keeps saying it after the law's own words change.
  const v = src('src/ui/levelUpView.js');
  assert.doesNotMatch(v, /'You must distribute/, 'quoted, never copied');
  assert.doesNotMatch(v, /'You must distribute all your points/);
  assert.match(v, /import \{ MUST_DISTRIBUTE_BONUS_POINTS \} from '\.\/charsheet\.js'/);
});

// ── THE ROWS ASK THE LAW ──────────────────────────────────────────

test('LV1: canRaise/canLower are the LAW\'s answer - asked, never restated', () => {
  const p = player();
  const w = new LevelUpScreen(p, seq(0));
  const pool = w.pool;
  assert.ok(pool >= LEVELUP_BONUS_POOL_MIN && pool <= LEVELUP_BONUS_POOL_MAX);
  let rows = rolloutRows(w);
  assert.equal(rows.length, 8);
  assert.ok(rows.every((r) => r.canRaise), 'with a pool, every row can take a point');
  assert.ok(rows.every((r) => !r.canLower), 'and none can give one back before one is spent');

  // A row AT THE CEILING refuses even with a pool - statUp's own clamp
  // (MAX_STAT_VALUE), which a `pool > 0` restatement would have missed.
  w.working.strength = MAX_STAT_VALUE;
  rows = rolloutRows(w);
  assert.equal(rows.find((r) => r.key === 'strength').canRaise, false, 'statUp clamps at 100');
  assert.equal(rows.find((r) => r.key === 'agility').canRaise, true, 'and only that row');

  // Spend the pool out: nothing can be raised, everything spent can be
  // given back.
  const w2 = new LevelUpScreen(player(), seq(0));
  // THE BOUND IS READ ONCE. `i < w2.pool` re-reads a number the loop
  // is spending, so it stops half way - which is how this pin first
  // failed, on the test's arithmetic rather than the window's.
  const rolled = w2.pool;
  for (let i = 0; i < rolled; i++) w2.input('plus');   // all into the cursor's row
  const spent = rolloutRows(w2);
  assert.equal(rolloutPool(w2), 0);
  assert.ok(spent.every((r) => !r.canRaise), 'an empty pool raises nothing');
  assert.equal(spent[0].canLower, true, 'and the row that took them can give them back');
  assert.equal(spent[0].delta, rolled, 'every point went where it was aimed');
});

test('LV1: the mod\'s row carries the mod\'s PRICE and the mod\'s ceiling', () => {
  const p = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  const rows = rolloutRows(w);
  const luck = rows.find((r) => r.key === 'luck');
  assert.equal(luck.cost, attributeOffset('luck', S()), 'Luck is priced by the mod, not by the window');
  assert.ok(luck.cost > 1, 'and it is not one - the window would have nothing to say otherwise');
  assert.equal(rows.find((r) => r.key === 'strength').cost, 1);
  // The +5 ceiling: five presses land, the sixth is refused BY THE
  // PREDICATE, which is what the star reads to decide whether to light.
  for (let i = 0; i < ATTRIBUTE_INCREASE_LIMIT; i++) raiseAt(w, 'strength');
  assert.equal(rolloutRows(w).find((r) => r.key === 'strength').delta, ATTRIBUTE_INCREASE_LIMIT);
  assert.equal(rolloutRows(w).find((r) => r.key === 'strength').canRaise, false);
  assert.equal(
    canRaiseAttribute('strength', p.stats, w.deltas, w.purse, w.s), false,
    'the row and the law agree because the row IS the law',
  );
});

// ── THE PRESS ─────────────────────────────────────────────────────

test('LV1: a press lands on the attribute it was aimed at, however the cursor was left', () => {
  // ORL1's incident, one layer up: a window whose presses acted on a
  // cursor that had drifted raised LUCK on every click. Here the aim
  // and the cursor are the same act, in that order.
  const w = new LevelUpScreen(player(), seq(0));
  w.cursor = STAT_KEYS_ORDER.indexOf('luck');
  assert.equal(raiseAt(w, 'strength'), true);
  assert.equal(rolloutRows(w).find((r) => r.key === 'strength').delta, 1);
  assert.equal(rolloutRows(w).find((r) => r.key === 'luck').delta, 0, 'never the row the cursor happened to be on');
  assert.equal(focusedKey(w), 'strength', 'and the aim moved the focus with it');
  assert.equal(lowerAt(w, 'strength'), true);
  assert.equal(rolloutRows(w).find((r) => r.key === 'strength').delta, 0);
  // A refused press reports FALSE, so the view can stay silent.
  assert.equal(lowerAt(w, 'strength'), false, 'nothing to give back');
  assert.equal(pressAt(w, 'nonsense', 'plus'), false);
});

test('LV1: every press goes through the SCREEN\'s own input - one door, both lanes', () => {
  const calls = [];
  const fake = { cursor: 0, pool: 3, base: {}, working: {}, input: (a) => { calls.push([fake.cursor, a]); } };
  focusAt(fake, 'endurance');
  assert.equal(fake.cursor, STAT_KEYS_ORDER.indexOf('endurance'));
  raiseAt(fake, 'speed');
  lowerAt(fake, 'speed');
  assert.deepEqual(calls, [
    [STAT_KEYS_ORDER.indexOf('speed'), 'plus'],
    [STAT_KEYS_ORDER.indexOf('speed'), 'minus'],
  ], 'select, then press - the two moves the keyboard makes');
  // The view module never writes an entity. Every mutation is the
  // screen's, and the screen commits through its own law module.
  const v = src('src/ui/levelUpView.js');
  const w = src('src/ui/enhancedLevelUp.js');
  for (const [name, s] of [['levelUpView', v], ['enhancedLevelUp', w]]) {
    assert.doesNotMatch(s, /entity\.(level|maxHealth|stats)\s*[+-]?=[^=]/, `${name}: writes no entity state`);
    // The commits are NAMED in both files' reasoning and IMPORTED by
    // neither: the window presses a button, it does not call the law.
    assert.doesNotMatch(s, /^import[^\n]*(applyLevelUp|commitVirtueLevelUp)/m,
      `${name}: does not reach past the screen to the law`);
  }
});

test('LV1: the commit is the screen\'s, and it is refused until the pool is spent', () => {
  const p = player();
  const w = new LevelUpScreen(p, seq(0));
  const level = p.level, hp = p.maxHealth;
  assert.equal(canAscend(w), false);
  assert.equal(ascend(w), false, 'DFU\'s CheckIfDoneLeveling refuses while a point is owed');
  assert.equal(p.level, level, 'and nothing moved');
  const base = { ...p.stats };
  const pool = w.pool;
  for (let i = 0; i < pool; i++) { focusAt(w, STAT_KEYS_ORDER[i % 8]); raiseAt(w, STAT_KEYS_ORDER[i % 8]); }
  assert.equal(canAscend(w), true);
  assert.equal(ascend(w), true);
  assert.equal(p.level, level + 1, 'ONE level, never a jump (the L-slice law)');
  assert.ok(p.maxHealth > hp, 'the health roll landed');
  assert.equal(p.readyToLevelUp, false);
  assert.equal(
    STAT_KEYS_ORDER.reduce((a, k) => a + p.stats[k] - base[k], 0), pool,
    'exactly the pool the law rolled went into the stats',
  );
});

test('LV1: IN A CORNER, the window names the control that still works - and the corner is REAL', () => {
  // THE PIN THAT ASSERTED NOTHING. This read "if (w.purse > 0)" over a
  // virtue character with every attribute at 100 - and `virtuePurse`
  // clamps such a character's purse to ZERO (ORL1's own fix), so the
  // body never ran and the hint was never checked. LV1's audit found
  // it vacuous and replaced it with a corner a player can actually
  // spend their way into.
  const classic = new LevelUpScreen(player(), seq(0));
  assert.equal(corneredHint(classic), null, 'nothing is cornered before a point is spent');

  // A REAL CORNER, found by walking every reachable spend rather than
  // assumed: a character at 98 across the board is minted a purse of
  // twelve, and that purse IS fully spendable - but only through LUCK,
  // whose four-a-point price is the only way to lay twelve on three
  // rows that can take two points each. A player who spends the three
  // CHEAP rows instead - which is the obvious move - lands on six
  // virtues and nothing that will take them.
  const p = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) p.stats[k] = MAX_STAT_VALUE - 2;
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  assert.ok(w.purse > 0);
  for (const k of ['endurance', 'personality', 'speed']) { raiseAt(w, k); raiseAt(w, k); }
  const rows = rolloutRows(w);
  const stuck = w.purse > 0 && rows.every((r) => !r.canRaise);
  assert.ok(stuck, `a reachable corner: purse ${w.purse}, raisable ${rows.filter((r) => r.canRaise).map((r) => r.key)}`);
  assert.match(corneredHint(w) ?? '', /take a point back/i, 'and the minus is what still works');
  assert.equal(canAscend(w), false, 'a corner is not an exit - the mod\'s window refuses');
  // ...and the way out the hint names really is one.
  assert.equal(lowerAt(w, 'endurance'), true);
  assert.equal(corneredHint(w), null, 'one point back re-opens the row it came from');
});

test('LV1: ALL-MAX IS THE OTHER TERM OF CheckIfDoneLeveling, and the first cut had only one', () => {
  // `if (statsRollout.BonusPool > 0 && !PlayerEntity.Stats.IsAllMax())`
  // (DaggerfallCharacterSheetWindow.cs:437-443). Without the second
  // term a character at 100 across the board is SEALED IN: statUp
  // refuses every press, the pool never reaches zero, and the only
  // exit tested zero. The classic SHEET has had the term since AUDIT
  // 44; ui/charsheet.js's LevelUpScreen - what the enhanced skin
  // mounted until LV1 - did not, and the window inherited the wall.
  const p = player();
  for (const k of STAT_KEYS_ORDER) p.stats[k] = MAX_STAT_VALUE;
  const w = new LevelUpScreen(p, seq(0));
  assert.ok(w.pool > 0, 'the pool is still rolled');
  assert.ok(rolloutRows(w).every((r) => !r.canRaise), 'and nothing can take a point of it');
  assert.equal(allMaxed(w), true);
  assert.equal(canAscend(w), true, 'so the way out is open');
  assert.equal(corneredHint(w), ALL_MAX_LINE, 'and it says THAT, not "take a point back" - there is no elsewhere');
  const level = p.level;
  assert.equal(ascend(w), true);
  assert.equal(p.level, level + 1, 'the level still lands');
  assert.ok(STAT_KEYS_ORDER.every((k) => p.stats[k] === MAX_STAT_VALUE), 'and nothing went past the ceiling');

  // LESS ROOM THAN POOL, which is the same wall one step in: seven at
  // the ceiling and one at 98 against a roll of four or more.
  const q = player();
  for (const k of STAT_KEYS_ORDER) q.stats[k] = MAX_STAT_VALUE;
  q.stats.luck = MAX_STAT_VALUE - 2;
  const v = new LevelUpScreen(q, seq(0));
  const pool = v.pool;
  assert.equal(canAscend(v), false, 'while a row can still take one, the pool must be spent');
  raiseAt(v, 'luck'); raiseAt(v, 'luck');
  assert.equal(rolloutPool(v), pool - 2);
  assert.equal(canAscend(v), true, 'and the moment the room runs out, the leftover is voided');
  assert.equal(ascend(v), true);
  assert.equal(q.stats.luck, MAX_STAT_VALUE);

  // THE MOD'S LANE NEEDS NO SUCH ARM: virtuePurse clamps an all-max
  // character's purse to what a legal spend can pay for, which is
  // nothing, so the first term answers on its own.
  const m = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) m.stats[k] = MAX_STAT_VALUE;
  const mw = new VirtueLevelUpScreen(m, { settings: S(), rolls: seq(0) });
  assert.equal(mw.purse, 0, 'ORL1\'s clamp is the mod lane\'s answer to the same wall');
  assert.equal(allMaxed(mw), false, 'and the window does not invent a branch the mod has not got');
  assert.equal(canAscend(mw), true);
});

test('LV1: DaggerfallStats.IsAllMax has ONE home, and both faces read it', () => {
  const cs = src('src/ui/charsheet.js');
  assert.match(cs, /import \{ statUp, statDown, allStatsMax \} from '\.\/chargen\.js'/,
    'and MAX_STAT_VALUE left with the copy that used it - this file\'s last reader WAS that copy');
  assert.match(cs, /_workingAllMax\(\) \{\n\s*return allStatsMax\(this\.working\);/,
    'the sheet\'s private copy delegates rather than restating the law');
  assert.match(cs, /action === 'confirm' && \(this\.pool === 0 \|\| this\.allMax\(\)\)/,
    'and the canvas screen carries both of CheckIfDoneLeveling\'s terms');
  assert.doesNotMatch(cs, /STAT_KEYS_ORDER\.every\(\(k\) => this\.working\[k\] === MAX_STAT_VALUE\)/,
    'no second copy of IsAllMax');
  assert.match(src('src/ui/chargen.js'), /export const allStatsMax =/, 'the one home is beside statUp/statDown');
  // The VIEW asks the screen rather than re-deriving it from the rows.
  assert.match(src('src/ui/levelUpView.js'), /typeof screen\?\.allMax === 'function' && screen\.allMax\(\)/);
});

// ── THE CROWN AND THE BAR ─────────────────────────────────────────

test('LV1: the crown promises a level - except over the Oghma Infinium, which grants none', () => {
  const p = player();
  const c = levelUpCrown(p, new LevelUpScreen(p, seq(0)));
  assert.equal(c.to, c.from + 1);
  assert.equal(c.name, 'Toshley');
  assert.equal(c.race, 'Nord');
  const b = player({ oghmaLevelUp: true, pendingLevel: null });
  const cb = levelUpCrown(b, new LevelUpScreen(b, seq(0)));
  assert.equal(cb.lane, LANE_OGHMA);
  assert.equal(cb.to, cb.from, 'applyLevelUp\'s oghma arm takes no Level++ (AUDIT 39), so the window promises none');
});

test('LV1: the bar under the level is the LAW\'s remainder, in both lanes', () => {
  const p = player({ startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 119 });
  const g = levelProgress(p, new LevelUpScreen(p, seq(0)));
  // (119 - 100 + 28) = 47; 47 mod 15 = 2, and 47/15 floors to level 3.
  assert.equal(g.max, LEVELUP_SKILL_SUM_PER_LEVEL);
  assert.equal(g.now, 47 % LEVELUP_SKILL_SUM_PER_LEVEL);
  assert.equal(g.now, 2, 'the remainder, not the whole sum');
  // The DIVISOR is imported: a screen that quotes a law by copying its
  // number goes stale the day the law moves (ORL1's deep audit).
  assert.doesNotMatch(src('src/ui/levelUpView.js'), /\/ 15\b/, 'the 15 is LEVELUP_SKILL_SUM_PER_LEVEL, never a literal');
  const vp = virtuePlayer({ levelProgress: 38, levelRollUp: 6 });
  const vg = levelProgress(vp, new VirtueLevelUpScreen(vp, { settings: S(), rolls: seq(0) }));
  assert.deepEqual([vg.now, vg.max, vg.carried], [38, LEVELUP_TOTAL, 6]);
});

// ── THE ONE THING THIS SCREEN TEACHES ─────────────────────────────

test('LV1: the ribbon\'s roles RECONSTRUCT levelUpSkillSum exactly, over every shape of career', () => {
  // THE PIN THAT MATTERS. The window tells a player which of their
  // skills count toward the next level - a rule Daggerfall never
  // states anywhere - and that sentence is a SECOND reading of
  // PlayerEntity.SetCurrentLevelUpSkillSum. So it is held against the
  // first: sum(the skills the window says count) + the one it calls
  // the best minor must equal levelUpSkillSum, for every career and
  // every spread of values.
  //
  // MUTATION-CHECKED: marking the HIGHEST major dropped instead of the
  // lowest, or the lowest minor best instead of the highest, fails
  // this within two iterations.
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let iter = 0; iter < 200; iter++) {
    const ids = [...Array(35).keys()].sort(() => rnd() - 0.5);
    const e = {
      skills: [...Array(35)].map(() => Math.floor(rnd() * 100)),
      career: {
        primarySkills: ids.slice(0, 3),
        majorSkills: ids.slice(3, 6),
        minorSkills: ids.slice(6, 12),
      },
    };
    const roles = levelSumRoles(e);
    let sum = 0;
    for (const [id, role] of roles) {
      if (role === ROLE_COUNTS || role === ROLE_BEST) sum += e.skills[id];
    }
    assert.equal(sum, levelUpSkillSum(e), `iteration ${iter}`);
  }
  // ...and the four roles each say something different, so a player
  // reading the ribbon is reading four distinct facts.
  assert.equal(new Set(Object.values(ROLE_NOTE)).size, 4);
  assert.match(ROLE_NOTE[ROLE_IDLE], /does not count/i);
  assert.match(ROLE_NOTE[ROLE_DROPPED], /dropped/i);
});

test('LV1: the ribbon leads with what rose, and is never empty', () => {
  const p = player();
  setSkillRecentlyIncreased(p, SKILLS.Archery);      // a MAJOR skill, id 33 - the second mask word
  setSkillRecentlyIncreased(p, SKILLS.Lockpicking);  // MISCELLANEOUS - in no career group
  const ribbon = riseRibbon(p);
  assert.ok(ribbon.length >= 12, 'the career\'s own twelve are always there');
  assert.ok(ribbon.slice(0, 2).every((r) => r.risen), 'what rose leads');
  assert.deepEqual(new Set(ribbon.slice(0, 2).map((r) => r.name)),
    new Set([SKILL_NAMES[SKILLS.Archery], SKILL_NAMES[SKILLS.Lockpicking]]));
  const lock = ribbon.find((r) => r.name === SKILL_NAMES[SKILLS.Lockpicking]);
  assert.equal(lock.group, 'Miscellaneous');
  assert.equal(lock.role, ROLE_IDLE, 'a misc skill is not in the sum, and the ribbon says so rather than hiding it');
  // The mask is DFU's uint[2] and the word index is the trap: Archery
  // is skill 33, so a naive `1 << 33` marks Etiquette instead.
  assert.equal(riseRibbon(player()).some((r) => r.risen), false, 'nothing rose on a fresh character');
  // A character with no career at all is a strip of nothing rather
  // than a crash - the Oghma can open this window on any save.
  assert.deepEqual(riseRibbon({}), []);
});

// ── THE FIGURE ────────────────────────────────────────────────────

test('LV1: the asterism is eight stars, one per attribute, inside its own box', () => {
  assert.deepEqual(Object.keys(STAR_FIGURE.stars).sort(), [...STAT_KEYS_ORDER].sort(),
    'every attribute has a star and no star has no attribute');
  for (const [k, p] of Object.entries(STAR_FIGURE.stars)) {
    assert.ok(p.x >= 0 && p.x <= STAR_FIGURE.box.w, `${k} x`);
    assert.ok(p.y >= 0 && p.y <= STAR_FIGURE.box.h, `${k} y`);
  }
  for (const [a, b] of STAR_FIGURE.edges) {
    assert.ok(STAR_FIGURE.stars[a] && STAR_FIGURE.stars[b], `${a}-${b} joins two real stars`);
  }
  // CONNECTED: a star with no line to it reads as a disabled control.
  const seen = new Set(['strength']);
  for (let i = 0; i < STAR_FIGURE.edges.length; i++) {
    for (const [a, b] of STAR_FIGURE.edges) {
      if (seen.has(a)) seen.add(b);
      if (seen.has(b)) seen.add(a);
    }
  }
  assert.equal(seen.size, 8, 'the figure is one constellation, not two');
});

test('LV1: no two stars can be drawn on top of each other', () => {
  // The figure is normalized and stretched to the stage, so the gaps
  // shrink with the window. tools/levelUpProbe.mjs caught the first
  // authored figure colliding at 390x844 and at 800x600 - a star under
  // another star is a point spent on the wrong attribute - and this is
  // that finding as a law the layout has to keep.
  assert.deepEqual(crowdedStarPairs(), [], 'every pair clears the floor in at least one axis');
  // AND THE PIN FAILS ON A MUTATION: move one star onto another.
  const broken = { ...STAR_FIGURE, stars: { ...STAR_FIGURE.stars, luck: { ...STAR_FIGURE.stars.willpower } } };
  assert.ok(crowdedStarPairs(broken).length > 0, 'the check is not vacuous');
  assert.ok(STAR_MIN_APART_X > 0 && STAR_MIN_APART_Y > 0);
});

test('LV1: a star\'s brightness is its VALUE, against the same ceiling the rollout clamps to', () => {
  assert.equal(starBrightness(0), 0);
  assert.equal(starBrightness(MAX_STAT_VALUE), 1);
  assert.equal(starBrightness(MAX_STAT_VALUE * 2), 1, 'a drained-then-fortified stat cannot overflow the star');
  assert.equal(starBrightness(undefined), 0);
});

// ── THE WORDS ─────────────────────────────────────────────────────

test('LV1: every attribute has the port\'s OWN sentence, and no ARENA2 is read to say it', () => {
  for (const k of STAT_KEYS_ORDER) {
    assert.ok((ATTRIBUTE_BLURB[k] ?? '').length > 20, `${k} has a line`);
    assert.equal(attributeLabel(k), k.charAt(0).toUpperCase() + k.slice(1));
  }
  assert.equal(new Set(Object.values(ATTRIBUTE_BLURB)).size, 8, 'eight different sentences');
  // TEXT.RSC records 0..7 are DFU's attribute descriptions and they are
  // GAME DATA. ui/charSheetDoor.js promises the enhanced skin reads
  // none, so neither of this window's two files may reach for it.
  for (const f of ['src/ui/levelUpView.js', 'src/ui/enhancedLevelUp.js']) {
    // The IMPORTS are the test: TEXT.RSC is named in the reasoning
    // above `ATTRIBUTE_BLURB`, which is exactly where it should be
    // named - as the thing these words exist INSTEAD of.
    assert.doesNotMatch(src(f), /^import[^\n]*(textRsc|formats\/|variantLinesById)/m, `${f} reads no game data`);
  }

  // AND EVERY LINE NAMES A CONSUMER, not a display. LV1's audit found
  // two that did not: willpower cited the %mr QUEST MACRO (which only
  // prints the number) where the consumer is the saving throw, and
  // agility cited `toHitModifier` - the CHARACTER SHEET's display
  // modifier, which the hit roll does not read - so the sentence
  // described a number that rides nothing. A blurb is a promise about
  // the code, so the code it points at has to be the code that runs.
  const v = src('src/ui/levelUpView.js');
  assert.match(v, /systems\/spellcast\.js:158/, 'willpower names the saving throw that consumes MagicResist');
  assert.match(v, /formulas\.js:306-307 statsToHit/, 'agility names the term inside the hit roll');
  assert.match(v, /player\/motor\.js:470 walkSpeed/, 'speed names the motor that reads it');
  assert.match(v, /unleveledLoot\.js:95/, 'luck names the rarity roll a player actually notices');
  assert.doesNotMatch(v, /toHitModifier = floor\(agility \/ 10\) - 5\.\n\s*agility:/,
    'and the sheet\'s display modifier is no longer offered as what rides a swing');
  // ...and no line promises a consequence this port does not apply:
  // encumbrance is DRAWN and never charged for (MAC-E).
  assert.doesNotMatch(ATTRIBUTE_BLURB.strength, /stagger|slow|encumber/i,
    'the strength line no longer promises an encumbrance penalty nothing implements');
  // THE CONSUMERS ARE NOT RE-DRIVEN HERE, and the first attempt to do
  // it is the reason why: `damageModifier` goes through PCO1's
  // override registry, so a vendored mod loaded by another import in
  // this file can legitimately answer something else, and the pin
  // failed against the port working correctly. The formulas have their
  // own suites; what this file owns is that the WORDS point at them.
  assert.equal(typeof magicResist, 'function');
  assert.equal(typeof damageModifier, 'function');
});

// ── THE SEAMS ─────────────────────────────────────────────────────

test('LV1: the door hands this window to ALL FOUR HOSTS, and mounts it as a lazy chunk', () => {
  const door = src('src/ui/charSheetDoor.js');
  assert.match(door, /import\('\.\/enhancedLevelUp\.js'\)/, 'MENU1: through the one lazy-chunk door');
  assert.match(door, /mountEnhancedChunk\(\{\s*load: \(\) => import\('\.\/enhancedLevelUp\.js'\)/s);
  assert.match(door, /isEnhancedLevelUp: true/, 'the duck type the font-less escape asks for');
  // THE FOUR HOSTS RULE. Each of the four reaches a level-up screen
  // through the door and through nothing else - worldModes.js was the
  // one that did not, in two places, and would have kept handing out
  // canvas rollouts while the other three wore the new face.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(src(host), /from '\.\.\/ui\/charSheetDoor\.js'/, `${host} goes through the door`);
    assert.doesNotMatch(src(host), /new (Virtue)?LevelUpScreen\(/, `${host} builds no rollout of its own`);
  }
});

test('LV1: the font-less escape knows the DOM window, and knows it FIRST', () => {
  // A level-up that cannot draw must not silently eat the pool - and a
  // DOM overlay that is nulled rather than closed is left on the screen
  // over a game that has been handed back.
  const dc = src('src/scenes/dungeonContext.js');
  const enhanced = dc.indexOf('activeOverlay?.isEnhancedLevelUp');
  const virtue = dc.indexOf('activeOverlay?.isVirtueLevelUp');
  assert.ok(enhanced > 0 && virtue > 0);
  assert.ok(enhanced < virtue, 'the wrapper is tested before the screens it wraps');
  assert.match(dc, /activeOverlay\.spendRemainingHeadless\(\);/);
  const door = src('src/ui/charSheetDoor.js');
  assert.match(door, /spendRemainingHeadless\(\) \{/);
  assert.match(door, /screen\?\.isVirtueLevelUp.*screen\.spendRemainingHeadless\(\)/s,
    'the mod plans its own purse - spendPoolLowest would ignore its caps and Luck\'s price');
  assert.match(door, /spendPoolLowest\(screen\.working/, 'and the classic pool takes the headless policy');
});

test('LV1: the RETIRED sentence is gone from where it stood', () => {
  // RETIRING A FLAG DELETES THE SENTENCE (bible/Home.md): the enhanced
  // sheet's header said the level-up screen stays classic and is "not
  // this door's business". It is now.
  const sheet = src('src/ui/enhancedCharSheet.js');
  assert.doesNotMatch(sheet, /THE LEVEL-UP SCREEN stays classic/);
  assert.match(sheet, /LV1/, 'and says what replaced it');
});

test('LV1: the lab page is a real route, or it is dead the moment it is deployed', () => {
  assert.match(src('vite.config.js'), /levelUp: 'levelup\.html'/);
  assert.match(src('levelup.html'), /src\/tools\/levelUpLab\.js/);
  assert.match(src('package.json'), /"levelup": "node tools\/levelUpProbe\.mjs"/);
  // The lab mounts the SHIPPING window over a fake entity - not a copy
  // of it, which would be a second window to keep in step.
  const lab = src('src/tools/levelUpLab.js');
  // ...and it loads the view the way the DOOR loads it - a dynamic
  // import. A static one put the module in the lab's own graph, which
  // closed the very gap the door lane exists to show (LV1b).
  assert.match(lab, /await import\('\.\.\/ui\/enhancedLevelUp\.js'\)/);
  assert.doesNotMatch(lab, /^import \{ mountEnhancedLevelUp \}/m);
  assert.match(lab, /new LevelUpScreen|new VirtueLevelUpScreen/);
  assert.match(lab, /createCharSheetWindow\(\{ entity \}\)/, 'and one lane drives the real door');
});

// ── THE WHOLE READING ─────────────────────────────────────────────

test('LV1: levelUpModel is the whole window, and it holds together in every lane', () => {
  for (const [lane, mk] of [
    [LANE_CLASSIC, () => { const p = player(); return [p, new LevelUpScreen(p, seq(0))]; }],
    [LANE_OGHMA, () => { const p = player({ oghmaLevelUp: true, pendingLevel: null }); return [p, new LevelUpScreen(p, seq(0))]; }],
    [LANE_VIRTUE, () => { const p = virtuePlayer(); return [p, new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) })]; }],
  ]) {
    const [p, w] = mk();
    const m = levelUpModel(p, w);
    assert.equal(m.lane, lane);
    assert.equal(m.rows.length, 8);
    assert.equal(m.focus, STAT_KEYS_ORDER[0]);
    assert.equal(m.refusal, null, 'nothing has been refused yet');
    assert.equal(m.vitals.length, 3, 'health, fatigue and magicka - the sheet\'s own three');
    assert.ok(m.vitals.every((v) => Number.isFinite(v.now) && Number.isFinite(v.max)));
    assert.equal(m.canAscend, m.pool === 0);
    assert.equal(m.poolLabel, poolLabel(w));
  }
  // The classic rollout has NO refusal latch of its own, so the window
  // carries that half and hands it in - without this arm the enhanced
  // skin's OK button would decline in total silence.
  const p = player();
  const w = new LevelUpScreen(p, seq(0));
  assert.equal(levelUpModel(p, w, true).refusal, MUST_DISTRIBUTE_BONUS_POINTS);
  assert.equal(w.refused, undefined, 'the latch is the window\'s, not a new field on the law');
});

test('LV1: the vitals are the SHEET\'s numbers, read from the SHEET\'s own model', () => {
  // The first cut restated maxFatigue's arithmetic here, which is a
  // pin that cannot fail: it agreed with itself. The claim the file
  // makes is that this window and the pause window's Stats page read
  // ONE model, so that is what is held (LV1's audit).
  const p = player();
  const v = levelUpVitals(p);
  const sheet = sheetModel(p);
  assert.deepEqual(v.map((r) => r.label), ['Health', 'Fatigue', 'Magicka']);
  assert.deepEqual(v.map((r) => [r.now, r.max]), [
    [sheet.health.now, sheet.health.max],
    [sheet.fatigue.now, sheet.fatigue.max],
    [sheet.magicka.now, sheet.magicka.max],
  ], 'field for field, the sheet\'s');
  assert.ok(sheet.fatigue.max * FATIGUE_MULTIPLIER === (p.stats.strength + p.stats.endurance) * FATIGUE_MULTIPLIER,
    'and the sheet is the one that owns the /64 display divisor');
});

test('LV1: a repaint reads the FRAME, and the frame carries nothing a repaint does not use', () => {
  // The window painted the whole model on every keystroke - which put
  // riseRibbon and sheetModel (gold, encumbrance, thirty-five skills,
  // the class specials) on the keyboard's repeat rate for two fields
  // the repaint never reads, because both bands are built once at
  // mount (LV1's audit).
  const p = player();
  const w = new LevelUpScreen(p, seq(0));
  const frame = levelUpFrame(p, w);
  const model = levelUpModel(p, w);
  assert.equal('ribbon' in frame, false);
  assert.equal('vitals' in frame, false);
  assert.deepEqual(Object.keys(model).filter((k) => !(k in frame)), ['ribbon', 'vitals']);
  for (const k of Object.keys(frame)) assert.deepEqual(model[k], frame[k], `${k} agrees`);
  assert.match(src('src/ui/enhancedLevelUp.js'), /const m = levelUpFrame\(entity, screen, refused\);/,
    'and the repaint takes the frame');
});

// ── THE TWO THE AUDIT RECORDED, AND MAC ASKED FOR ────────────────

test('LV1b: the pause in front of the window is never blank, and never flashes either', () => {
  // AUDIT LV1 recorded this and did not fix it: every other enhanced
  // screen pays for its lazy chunk inside a key the player pressed,
  // and this one opens because the GAME decided - so the host paused
  // behind a transparent div with nothing on it, for a window nobody
  // asked for.
  //
  // THE WAIT IS ARMED, NOT DRAWN. A warmed chunk mounts inside
  // LEVELUP_WAIT_MS, so the common case never sees it; a cold one
  // shows it almost at once.
  assert.ok(LEVELUP_WAIT_MS > 0 && LEVELUP_WAIT_MS <= 250, `${LEVELUP_WAIT_MS}ms`);

  // INLINE STYLE ONLY - paintChunkNotice's doctrine, for its reason:
  // the thing that is still loading must not be a thing this needs.
  const made = [];
  const doc = { createElement: () => { const n = { style: {}, append() {}, remove() {} }; made.push(n); return n; } };
  const host = { ownerDocument: doc, append() {} };
  const risen = paintLevelUpWait(host, {});
  assert.equal(risen.textContent, RISEN_WAIT_TEXT);
  assert.equal(risen.id, 'levelup-wait');
  assert.match(risen.style.cssText, /position:fixed/);
  assert.doesNotMatch(risen.style.cssText, /var\(--/, 'it cannot depend on the skin sheet it may be waiting for');
  // THE BOOK GRANTS NO LEVEL (AUDIT 39), so it is not announced as one
  // even for the half second before the window can say it properly.
  assert.equal(paintLevelUpWait(host, { oghma: true }).textContent, OGHMA_WAIT_TEXT);
  assert.notEqual(RISEN_WAIT_TEXT, OGHMA_WAIT_TEXT);
  // A host with no document is no crash - the same guard
  // paintChunkNotice carries.
  assert.equal(paintLevelUpWait(null), null);
  assert.equal(paintLevelUpWait({}), null);

  // ...and the door clears it on ALL THREE exits: the window mounting,
  // the notice taking over, and a close that beat both.
  const door = src('src/ui/charSheetDoor.js');
  assert.match(door, /let waitTimer = setTimeout\(\(\) => \{ wait = paintLevelUpWait\(host, \{ oghma: !!screen\?\.oghma \}\); \}, LEVELUP_WAIT_MS\);/);
  assert.match(door, /mount: \(\{ mountEnhancedLevelUp \}\) => \{\n\s*stopWaiting\(\);/, 'the window is the wait\'s successor');
  assert.match(door, /notice: \(h, o\) => \{ stopWaiting\(\); return paintChunkNotice\(h, o\); \}/,
    'and so is the notice - two answers to one event is what this arm prevents');
  assert.match(door, /const close = \(\) => \{\n\s*if \(fired\) return;\n\s*stopWaiting\(\);/, 'and the timer has an owner');
});

test('LV1b: the chunk warms at boot, in the three hosts that warm the sheet - and the fourth is named', () => {
  const door = src('src/ui/charSheetDoor.js');
  assert.match(door, /export function warmLevelUpWindow\(\) \{/);
  assert.match(door, /if \(!isEnhanced\(\) \|\| typeof document === 'undefined'\) return null;/,
    'the classic skin pays for nothing, and node has no window to warm');
  assert.match(door, /import\('\.\/enhancedLevelUp\.js'\)\.catch\(/,
    'a rejection is SWALLOWED: a stale chunk is the door\'s to report when a player opens it, not the boot\'s');
  // THE FOUR HOSTS RULE: three wire it, the fourth is FLAGGED by name
  // rather than left unmentioned.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(src(host), /warmLevelUpWindow\(\);/, `${host} warms it`);
    assert.match(src(host), /import \{[^}]*warmLevelUpWindow[^}]*\} from '\.\.\/ui\/charSheetDoor\.js'/, `${host} imports it`);
  }
  assert.doesNotMatch(src('src/scenes/worldModes.js'), /warmLevelUpWindow/,
    'the interior host builds no windows and boots inside one of the other three');
  assert.match(door, /worldModes\.js needs none, and is NAMED here/, 'and the door says so where a reader will look');
  assert.doesNotMatch(door, /is FLAGGED here/,
    'in the FOUR HOSTS sense, not the open-flags one - that word is tools/regenOpenFlags.mjs\'s marker and this is not open work');
  // Beside the art it rides with, in both boot hosts.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(host), /preloadCharSheetArt\(\{ renderer, fetchBytes, palette \}\);[^\n]*\n\s*warmLevelUpWindow\(\);/,
      `${host}: the chunk warms where INFO00I0 warms`);
  }
});

test('LV1b: the CHRONICLE answers the key it is named after, off the registry', () => {
  // The audit's other recorded finding. MAC-C gave the sheet and the
  // pack this arm ("you can exit out of the F6 menu by pressing F6
  // again, but you cannot do the same for the F5 one") and the
  // chronicle was left out - so L opened it and L did nothing, a press
  // the host consumed (the overlay is `isChoiceWindow`, so both key
  // seams hand it the raw code and return) and nobody answered.
  const cr = src('src/ui/enhancedChronicle.js');
  assert.match(cr, /import \{ overlayAction, eventAction \} from '\.\/input\.js'/);   // AUDIT KB1: the event's own read
  assert.match(cr, /if \(eventAction\(e\) === 'LogBook'\) \{/, 'off the REGISTRY, never the literal KeyL (AUDIT KB1: eventAction - a combo closes what it opened)');
  assert.doesNotMatch(cr, /e\.code === 'KeyL'/, 'a rebound key that cannot close its own window is the same bug one layer down');
  // The arm sits BELOW the text-entry guard: the note composer is a
  // real <input> and 'l' belongs to it (CG2).
  const guard = cr.indexOf("t.tagName === 'INPUT'");
  const arm = cr.indexOf("eventAction(e) === 'LogBook'");
  assert.ok(guard > 0 && arm > guard, 'the composer keeps its own letters');
  // ...and it exits through the door's own close, not a second path.
  assert.match(cr, /if \(eventAction\(e\) === 'LogBook'\) \{\n\s*e\.preventDefault\(\);\n\s*e\.stopPropagation\(\);\n\s*if \(!e\.repeat\) onExit\(\);/, 'AUDIT KB1: the press exits, a held key\'s repeat is swallowed');
});
