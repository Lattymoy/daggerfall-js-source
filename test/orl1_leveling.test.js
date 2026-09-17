// ORL1 - OBLIVION REMASTER LIKE LEVELING 0.5.3, THE MOD, 1:1
// (2026-09-17, Mac: "So I've been analyzing morrowind mods to integrate
// and the first one I'd like to add is this. On new game, I want the
// player to receive a notification on which leveling system they would
// like to use").
//
// THE FIRST MORROWIND MOD IN THIS TREE, so the producer these pins read
// is Lua and a 487-byte OpenMW data file rather than a `.dfmod` and a
// `modsettings.json`. The convention is the same one IF1 and BA1 follow
// and it is the whole reason this file opens by parsing: THE DEFAULTS,
// THE MINIMA, THE TWO CAPS AND THE BAR'S SIZE ARE READ OUT OF THE
// VENDORED MOD AND COMPARED, never retyped. A pin that retypes the
// mod's numbers measures a constant against itself.
//
// Then the laws, each driven through the port's own producers
// (createCharacter for the entity, the real MOD_SETTINGS shape for the
// settings) and each written so a one-character change to the law it
// names fails it - tools/mutants/orl1.json is the campaign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORL_VENDOR, LEVELUP_TOTAL, ATTRIBUTE_INCREASE_LIMIT, MAX_ATTRIBUTE_VALUE, MAX_SKILL_VALUE,
  LEVELING_CLASSIC, LEVELING_VIRTUE, levelingSettings, oblivionLevelingEnabled, usesVirtueLeveling,
  skillTier, skillImpact, addSkillProgress, checkForVirtueLevelUp, rollOverLevelProgress,
  attributeOffset, attributeIncreaseLimit, virtuePurse, canRaiseAttribute, canLowerAttribute,
  commitVirtueLevelUp, virtueSpendPlan, virtueLevelUpHeadless, initVirtueLeveling,
  modVirtuePurse, LUCK,
} from '../src/systems/oblivionLeveling.js';
import { createCharSheetWindow } from '../src/ui/charSheetDoor.js';
import { LevelUpScreen } from '../src/ui/charsheet.js';
import {
  VirtueLevelUpScreen, REMAINING_POINTS_ERROR, REMAINING_POINTS_LABEL, chooseAttributesLabel,
  levelUpHitNative, ROW_TOP, ROW_PITCH, ROW_X, MINUS_X, PLUS_X, OK_X, PRESS_Y,
} from '../src/ui/virtueLevelUp.js';
import {
  LevelingChoiceScreen, LEVELING_OPTION_IDS, levelingOptions,
  choiceAtNative, choiceTop, choiceHeight, CHOICE_TOP, CHOICE_PITCH,
  CHOICE_TITLE_H, CHOICE_LINE_H,
} from '../src/ui/levelingChoice.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED, GROUPS } from '../src/systems/features.js';
import { CREDITS } from '../src/ui/credits.js';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter, hitPointsPerLevelUp, STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import {
  raiseSkills, skillUsesForAdvancement, calculatePlayerLevel, checkForLevelUp,
  LEVELUP_SKILL_SUM_PER_LEVEL, LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX,
} from '../src/systems/advancement.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../src/systems/gameDate.js';
import { createChargenWindow, finishChargen } from '../src/systems/chargenSession.js';
import { ChargenFlow } from '../src/ui/chargen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
// The mod's Lua and yaml ship with CRLF endings (OpenMW does not
// care and neither does the port); the parsers below read content,
// so the endings are normalised once rather than in five regexes.
const rdMod = (p) => rd(p).replace(/\r\n/g, '\n');
const V = ORL_VENDOR;
const MOD = `vendor/${V}`;
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// The mod's own settings, as an injected reader - the seam
// systems/unleveledLoot.js established, so a pin states a law without
// writing the player's store.
const reader = (over = {}) => (k) => (k in over ? over[k] : MOD_SETTINGS[V].keys[k].default);
const S = (over = {}) => levelingSettings(reader(over));

const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
/** A real character, from the port's own mint, levelling by the mod. */
function virtuePlayer(over = {}) {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  initVirtueLeveling(p, LEVELING_VIRTUE);
  return Object.assign(p, over);
}
const zeroDeltas = () => Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 0]));

// ── THE PRODUCER ───────────────────────────────────────────────────

test('ORL1: the bar\'s size is READ OUT OF THE .omwaddon - the mod\'s whole data layer is one GMST', () => {
  // OblivionRemasterLikeLeveling.omwaddon is a TES3 plugin carrying
  // exactly one record: GMST NAME "iLevelupTotal" INTV <int32>. The
  // port's LEVELUP_TOTAL is that number, so it is read rather than
  // trusted - and this is the only pin in the tree that parses an
  // OpenMW data file.
  const b = readFileSync(join(root, MOD, 'OblivionRemasterLikeLeveling.omwaddon'));
  const text = b.toString('latin1');
  assert.match(text, /^TES3/, 'the vendored file is a TES3 plugin');
  const nameAt = text.indexOf('NAME');
  assert.ok(nameAt > 0, 'the GMST carries a NAME subrecord');
  const len = b.readUInt32LE(nameAt + 4);
  const gmst = text.slice(nameAt + 8, nameAt + 8 + len).replace(/\0+$/, '');
  assert.equal(gmst, 'iLevelupTotal', 'the one record the mod overrides');
  const intvAt = text.indexOf('INTV', nameAt);
  assert.ok(intvAt > nameAt, 'and its value is an INTV');
  assert.equal(b.readUInt32LE(intvAt + 4), 4, 'a 4-byte integer');
  assert.equal(b.readInt32LE(intvAt + 8), LEVELUP_TOTAL, 'the port\'s bar IS the mod\'s iLevelupTotal');
  // ...and nothing else is in the file: one record, and the port is not
  // quietly ignoring a second override.
  assert.equal((text.match(/GMST/g) ?? []).length, 1, 'exactly one GMST in the plugin');
});

test('ORL1: every setting default and minimum is READ OUT OF settings.lua, and every description out of the author\'s en.yaml', () => {
  const lua = rdMod(`${MOD}/scripts/settings.lua`);
  const yaml = rdMod(`${MOD}/l10n/en.yaml`);
  // settings.lua declares each key as a block: key = '<name>' ... default = <v>,
  // with `min = <v>` inside its `argument` table where it has one.
  const blocks = lua.split(/\n    \{\n/).slice(1);
  const shipped = new Map();
  for (const b of blocks) {
    const key = /key = '([^']+)'/.exec(b)?.[1];
    if (!key) continue;
    const def = /default = ([^,\n]+)/.exec(b)?.[1]?.trim();
    const min = /min = (-?\d+)/.exec(b)?.[1];
    const name = /name = '([^']+)'/.exec(b)?.[1];
    const desc = /description = '([^']+)'/.exec(b)?.[1];
    shipped.set(key, { def, min: min === undefined ? undefined : Number(min), name, desc });
  }
  assert.equal(shipped.size, 7, 'the mod ships seven settings across its two groups');

  const ours = MOD_SETTINGS[V].keys;
  for (const [key, s] of shipped) {
    const k = ours[key];
    assert.ok(k, `${key} is declared in the port's store`);
    const want = s.def === 'true' ? true : s.def === 'false' ? false : Number(s.def);
    assert.equal(k.default, want, `${key}: the port's default is the mod's (${s.def})`);
    if (s.min !== undefined) assert.equal(k.min, s.min, `${key}: the port's minimum is the mod's`);
    // The pane shows the author's OWN English, out of the mod's l10n -
    // the same law every other mod row follows.
    const label = new RegExp(`^${s.desc}: "(.*)"$`, 'm').exec(yaml)?.[1];
    assert.ok(label, `${s.desc} is a string the mod ships`);
    assert.equal(k.description, label, `${key}: the description is the author's own words`);
  }

  // THE PORT'S OWN TWO, named as such. `Enabled` every vendored mod
  // carries; primarySkillsImpact exists because Daggerfall has a tier
  // of chosen skills Morrowind does not.
  const extra = Object.keys(ours).filter((k) => !shipped.has(k));
  assert.deepEqual(extra.sort(), ['Enabled', 'primarySkillsImpact']);
  assert.match(ours.primarySkillsImpact.description, /Daggerfall has a tier of skills Morrowind does not/,
    'the port\'s own knob says in the pane that it is the port\'s');
  // ...and it ships equal to the major skills', which is the mapping
  // the page argues for: Daggerfall's primary+major (6 skills) stands
  // where Morrowind's major (5) does.
  assert.equal(ours.primarySkillsImpact.default, ours.majorSkillsImpact.default);

  // EVERY MAXIMUM IS THE PORT'S - OpenMW's number renderer declares
  // only a minimum, and the port's store reads a numeric key only with
  // both bounds. The page records them as port-chosen; this holds that
  // none of them was taken from the mod.
  assert.equal(/max\s*=/.test(lua), false, 'the mod declares no maxima at all');
  for (const key of ['attributePoints', 'maxUpdatableAttribute', 'luckIncreaseCost',
    'primarySkillsImpact', 'majorSkillsImpact', 'minorSkillsImpact', 'miscSkillsImpact']) {
    assert.equal(typeof ours[key].max, 'number', `${key} carries a port-chosen maximum`);
    assert.ok(ours[key].max > ours[key].default, `${key}'s ceiling leaves the mod's default reachable`);
  }
});

test('ORL1: the two caps are constants.lua\'s, and the version cell is the author\'s changelog', () => {
  const c = rdMod(`${MOD}/scripts/constants.lua`);
  assert.equal(Number(/constants\.MAX_ATTRIBUTE_VALUE = (\d+)/.exec(c)[1]), MAX_ATTRIBUTE_VALUE);
  assert.equal(Number(/constants\.MAX_SKILL_VALUE = (\d+)/.exec(c)[1]), MAX_SKILL_VALUE);
  // the mod's own spelling of the name is kept in the port's comment;
  // the VALUE is what this holds.
  assert.equal(Number(/constants\.ATRIBUTE_INCREASE_LIMIT = (\d+)/.exec(c)[1]), ATTRIBUTE_INCREASE_LIMIT);
  // HARD4's manifest gate skips a directory with no `*.dfmod.json`, so
  // the registry's version cell is unchecked THERE. It is checked here,
  // against the newest release heading in the author's own README.
  const upstream = rdMod(`${MOD}/README.upstream.md`);
  const newest = /^## Release v(\d+\.\d+\.\d+)/m.exec(upstream)[1];
  assert.equal(newest, '0.5.3', 'the vendored archive is the version the row claims');
  assert.match(rd('bible/01-Overview/Mod-Registry.md'),
    new RegExp(`\\| \`${V}\` \\|[^\\n]*\\| ${newest.replace(/\./g, '\\.')} \\|`),
    'and the registry row says so');
});

// ── L1: THE BAR ────────────────────────────────────────────────────

test('ORL1 L1: a skill raise puts its TIER\'s points in the bar (player.lua:39-45)', () => {
  const p = virtuePlayer();
  const s = S();
  assert.equal(skillTier(p, SKILLS.LongBlade), 'primary');
  assert.equal(skillTier(p, SKILLS.Dodging), 'major');
  assert.equal(skillTier(p, SKILLS.Archery), 'minor');
  assert.equal(skillTier(p, SKILLS.Etiquette), 'misc');   // named by no tier: the DERIVED set, as the Lua derives it
  assert.equal(skillImpact('primary', s), 8);
  assert.equal(skillImpact('major', s), 8);
  assert.equal(skillImpact('minor', s), 6);
  assert.equal(skillImpact('misc', s), 2);
  // each tier really moves the bar by its own number, in order
  p.levelProgress = 0;
  assert.equal(addSkillProgress(p, SKILLS.LongBlade, s), 8);
  assert.equal(p.levelProgress, 8);
  assert.equal(addSkillProgress(p, SKILLS.Archery, s), 6);
  assert.equal(p.levelProgress, 14);
  assert.equal(addSkillProgress(p, SKILLS.Etiquette, s), 2);
  assert.equal(p.levelProgress, 16);
  // ...and the four are DISTINCT, so a mutation that folds one tier
  // into another fails here rather than passing on a shared number.
  const ladder = S({ primarySkillsImpact: 9, majorSkillsImpact: 7, minorSkillsImpact: 5, miscSkillsImpact: 3 });
  assert.deepEqual(['primary', 'major', 'minor', 'misc'].map((t) => skillImpact(t, ladder)), [9, 7, 5, 3]);
});

test('ORL1 L1: a skill standing at 100 feeds the bar NOTHING - the 0.5.3 fix, and it is law', () => {
  // The author's changelog: "Fixed ... Infinite Leveling increase and
  // roll over after a skill reach 100". The Lua's whole handler body
  // sits inside `if constants.MAX_SKILL_VALUE > skillbase`.
  assert.match(rdMod(`${MOD}/scripts/player.lua`), /if constants\.MAX_SKILL_VALUE > skillbase then/);
  assert.match(rdMod(`${MOD}/README.upstream.md`), /Infinite Leveling increase and roll over after a skill reach 100/);
  const p = virtuePlayer();
  p.skills[SKILLS.LongBlade] = MAX_SKILL_VALUE;
  p.levelProgress = 0;
  assert.equal(addSkillProgress(p, SKILLS.LongBlade, S()), 0, 'a mastered skill contributes nothing');
  assert.equal(p.levelProgress, 0);
  // ...and the boundary is the CAP itself, not one below it
  p.skills[SKILLS.LongBlade] = MAX_SKILL_VALUE - 1;
  assert.equal(addSkillProgress(p, SKILLS.LongBlade, S()), 8, 'at 99 it still counts');
});

test('ORL1 L1: the roll-over boundary is STRICTLY past 100 (helper.lua:132)', () => {
  const s = S();
  // landing EXACTLY on the total rolls nothing over
  const exact = virtuePlayer({ levelProgress: 92, levelRollUp: 0 });
  assert.equal(addSkillProgress(exact, SKILLS.LongBlade, s), 8);
  assert.equal(exact.levelProgress, LEVELUP_TOTAL);
  assert.equal(exact.levelRollUp, 0, 'exactly 100 is not "past" 100');
  // one point further and the excess - and ONLY the excess - carries
  const over = virtuePlayer({ levelProgress: 93, levelRollUp: 0 });
  assert.equal(addSkillProgress(over, SKILLS.LongBlade, s), 7, 'only the part that fits is added');
  assert.equal(over.levelProgress, LEVELUP_TOTAL);
  assert.equal(over.levelRollUp, 1);
  // a full bar keeps taking the whole raise into the roll-over
  const full = virtuePlayer({ levelProgress: LEVELUP_TOTAL, levelRollUp: 3 });
  assert.equal(addSkillProgress(full, SKILLS.LongBlade, s), 0);
  assert.equal(full.levelProgress, LEVELUP_TOTAL);
  assert.equal(full.levelRollUp, 11);
});

test('ORL1 L1: the bar full raises the SAME readyToLevelUp flag the Daggerfall path raises', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL - 1, level: 3 });
  assert.equal(checkForVirtueLevelUp(p), false, '99 is not a level');
  assert.ok(!p.readyToLevelUp);
  p.levelProgress = LEVELUP_TOTAL;
  assert.equal(checkForVirtueLevelUp(p), true);
  assert.equal(p.readyToLevelUp, true);
  assert.equal(p.pendingLevel, 4, 'the banner reads the level being gained');
  // ...and it KEEPS offering it, which is DFU's own shape: the hosts
  // have one overlay slot and the first offer may reach it busy
  // (ORL1's deep audit - this used to assert the opposite).
  assert.equal(checkForVirtueLevelUp(p), true, 'an owed level is re-offered until it is taken');
  assert.equal(p.pendingLevel, 4, 'and it still names the same level');
});

test('ORL1 L2: the roll-over on commit, including the bar that stays FULL (helper.lua:144-155)', () => {
  const small = virtuePlayer({ levelRollUp: 7 });
  rollOverLevelProgress(small);
  assert.equal(small.levelProgress, 7);
  assert.equal(small.levelRollUp, 0);
  // a roll-over that fills the next bar leaves it FULL, which is what
  // re-offers the next level at once
  const big = virtuePlayer({ levelRollUp: LEVELUP_TOTAL + 12 });
  rollOverLevelProgress(big);
  assert.equal(big.levelProgress, LEVELUP_TOTAL);
  assert.equal(big.levelRollUp, 12);
  // ...and the boundary is >=, so an exact bar's worth carries none on
  const edge = virtuePlayer({ levelRollUp: LEVELUP_TOTAL });
  rollOverLevelProgress(edge);
  assert.equal(edge.levelProgress, LEVELUP_TOTAL);
  assert.equal(edge.levelRollUp, 0);
});

// ── L3: THE PURSE ──────────────────────────────────────────────────

test('ORL1 L3: Luck costs more and is capped when the mod may not raise it (player.lua:53-69)', () => {
  const on = S();
  assert.equal(attributeOffset('luck', on), 4);
  assert.equal(attributeOffset('strength', on), 1);
  assert.equal(attributeIncreaseLimit('luck', on), ATTRIBUTE_INCREASE_LIMIT);
  const off = S({ allowLuckIncrease: false });
  assert.equal(attributeOffset('luck', off), 1, 'with the switch off Luck is priced like anything else');
  assert.equal(attributeIncreaseLimit('luck', off), 1, '...and may move by exactly one');
  assert.equal(attributeIncreaseLimit('strength', off), ATTRIBUTE_INCREASE_LIMIT, 'which is Luck\'s rule alone');
  // the price is the setting's, not the constant 4
  assert.equal(attributeOffset('luck', S({ luckIncreaseCost: 7 })), 7);
});

test('ORL1 L3: the MOD\'s own clamp, on its own - both arms, unclamped by the port\'s second pass', () => {
  // virtuePurse runs the mod's arithmetic and then the port's own
  // clamp over it (departure 6), which would MASK a change to either of
  // the mod's two arms. So the mod's arithmetic is pinned where it
  // lives: `modVirtuePurse`, the Lua's calculateAttributepoints and
  // nothing else.
  const stats = (v) => Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, v]));
  const s = S();

  // the per-row LIMIT caps what a row contributes, however much
  // headroom it has: seven ordinary rows at 5 points each, plus Luck's
  // five at four apiece, is 55 - not the 550 the raw headroom would be.
  assert.equal(modVirtuePurse(stats(50), S({ attributePoints: 60 })), 55,
    '5 x 7 ordinary + 5 x 4 Luck, never the whole headroom');

  // ARM ONE: a character who cannot absorb the purse gets a smaller one
  const tight = stats(MAX_ATTRIBUTE_VALUE);
  tight.strength = MAX_ATTRIBUTE_VALUE - 2;
  assert.equal(modVirtuePurse(tight, s), 2);
  assert.equal(modVirtuePurse(stats(MAX_ATTRIBUTE_VALUE), s), 0);

  // ARM TWO: a remainder only Luck could buy is rounded DOWN to whole
  // Luck. Everything maxed but Luck, so `others` is zero and the whole
  // purse has to be a multiple of Luck's price.
  const luckOnly = stats(MAX_ATTRIBUTE_VALUE);
  luckOnly.luck = 90;
  assert.equal(modVirtuePurse(luckOnly, S({ attributePoints: 14 })), 12, '14 buys three Luck, not three and a half');
  assert.equal(modVirtuePurse(luckOnly, S({ attributePoints: 3 })), 0, 'less than one Luck point buys none');
  // ...and with one ordinary point open, only what is left PAST it rounds
  luckOnly.strength = MAX_ATTRIBUTE_VALUE - 1;
  assert.equal(modVirtuePurse(luckOnly, S({ attributePoints: 14 })), 13);
});

test('ORL1 L3: the purse is the setting while the character can spend it', () => {
  const p = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  assert.equal(virtuePurse(p.stats, S()), 12, 'a middling character gets the whole twelve');
});

test('ORL1 L3: a character who cannot absorb the purse gets a SMALLER one (the first clamp)', () => {
  const p = virtuePlayer();
  // everything maxed but Strength, which has two points of headroom:
  // 2 * offset 1 = 2 spendable points in the whole character.
  for (const k of STAT_KEYS_ORDER) p.stats[k] = MAX_ATTRIBUTE_VALUE;
  p.stats.strength = MAX_ATTRIBUTE_VALUE - 2;
  assert.equal(virtuePurse(p.stats, S()), 2);
  // ...and a character with nothing to spend it on gets nothing, which
  // is what lets the window close at once instead of trapping them.
  for (const k of STAT_KEYS_ORDER) p.stats[k] = MAX_ATTRIBUTE_VALUE;
  assert.equal(virtuePurse(p.stats, S()), 0);
});

test('ORL1 L3: a remainder that could only buy Luck is rounded DOWN to whole Luck (the second clamp)', () => {
  const p = virtuePlayer();
  // Seven attributes maxed, Luck at 90. Only Luck can take anything:
  // limit 5 at cost 4 = 20 spendable points, so the purse is not
  // shrunk by the first clamp - but `others` is 0, so the whole purse
  // must be a multiple of 4.
  for (const k of STAT_KEYS_ORDER) p.stats[k] = MAX_ATTRIBUTE_VALUE;
  p.stats.luck = 90;
  assert.equal(virtuePurse(p.stats, S({ attributePoints: 14 })), 12, '14 buys three Luck, not three and a half');
  assert.equal(virtuePurse(p.stats, S({ attributePoints: 12 })), 12);
  assert.equal(virtuePurse(p.stats, S({ attributePoints: 3 })), 0, 'less than one Luck point buys none');
  // with ONE ordinary attribute open the remainder has somewhere else
  // to go, so the rounding applies only to what is left past it
  p.stats.strength = MAX_ATTRIBUTE_VALUE - 1;   // 1 ordinary point
  assert.equal(virtuePurse(p.stats, S({ attributePoints: 14 })), 13, '1 ordinary + three Luck');
});

/** The true answer, by exhaustive search over every legal assignment -
 *  an INDEPENDENT implementation, so a mutation of the port's own
 *  solver cannot hide behind the pin that checks it. */
function bestSpendable(stats, s, budget) {
  const rows = STAT_KEYS_ORDER.map((k) => ({
    off: attributeOffset(k, s),
    room: Math.max(0, Math.min(attributeIncreaseLimit(k, s), MAX_ATTRIBUTE_VALUE - stats[k])),
  }));
  let best = 0;
  const walk = (i, used, cost) => {
    if (cost > budget) return;
    if (cost > best) best = cost;
    if (i === rows.length) return;
    walk(i + 1, used, cost);
    if (used < s.maxUpdatableAttribute) {
      for (let d = 1; d <= rows[i].room; d++) walk(i + 1, used + 1, cost + d * rows[i].off);
    }
  };
  walk(0, 0, 0);
  return best;
}

test('ORL1 L3: the purse is THE MOST a player could legally spend - not what one greedy happened to place', () => {
  // THE FIRST VERSION OF THE PORT'S CLAMP FAILED THIS. It measured the
  // purse with a lowest-value-first greedy, which at the ceiling spends
  // the row budget on the rows with the least headroom and then calls
  // the rest unplaceable: eight attributes at 99 minted 11, could
  // legally take 6, and were handed 3. The pin that was here asked only
  // that the purse could be spent to zero, which 3 satisfies - so it
  // could not see the three virtues being destroyed. It asks for the
  // MAXIMUM now, against an independent exhaustive search.
  const worst = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) worst.stats[k] = 99;
  assert.equal(modVirtuePurse(worst.stats, S()), 11, 'the mod mints eleven');
  assert.equal(virtuePurse(worst.stats, S()), 6, 'and six of them can be spent: Luck +1 at four, two rows at one');

  let clamped = 0;
  for (const maxRows of [2, 3, 4, 8]) {
    for (const luckCost of [1, 3, 4, 7]) {
      for (const allowLuck of [true, false]) {
        for (const luck of [50, 90, 96, 99, 100]) {
          for (const rest of [50, 97, 98, 99, 100]) {
            const p = virtuePlayer();
            for (const k of STAT_KEYS_ORDER) p.stats[k] = rest;
            p.stats.luck = luck;
            const s = S({ luckIncreaseCost: luckCost, maxUpdatableAttribute: maxRows, allowLuckIncrease: allowLuck });
            const minted = modVirtuePurse(p.stats, s);
            const purse = virtuePurse(p.stats, s);
            const where = `maxRows ${maxRows}, luckCost ${luckCost}, allowLuck ${allowLuck}, luck ${luck}, rest ${rest}`;
            assert.equal(purse, bestSpendable(p.stats, s, minted), `${where}: the purse is not the maximum`);

            // ...and the plan that comes with it really pays for it,
            // inside every one of the mod's caps.
            const { cost, plan } = virtueSpendPlan(p.stats, s, minted);
            assert.equal(cost, purse, `${where}: the plan's cost is the purse`);
            let spent = 0, opened = 0;
            for (const k of STAT_KEYS_ORDER) {
              const d = plan[k] ?? 0;
              if (!d) continue;
              opened += 1;
              spent += d * attributeOffset(k, s);
              assert.ok(d <= attributeIncreaseLimit(k, s), `${where}: ${k} past its limit`);
              assert.ok(p.stats[k] + d <= MAX_ATTRIBUTE_VALUE, `${where}: ${k} past 100`);
            }
            assert.equal(spent, cost, `${where}: the plan pays exactly`);
            assert.ok(opened <= maxRows, `${where}: the plan opened ${opened} rows`);
            if (purse < minted) clamped += 1;
          }
        }
      }
    }
  }
  // ...and the port's clamp REALLY BITES somewhere in that walk, or the
  // whole pin would pass against a `virtuePurse` that is just the mod's
  // own arithmetic and proves nothing.
  assert.ok(clamped > 0, 'the port\'s second clamp never fired - the walk does not reach the case it exists for');
});


// ── L4: WHAT THE BUTTONS ALLOW ─────────────────────────────────────

test('ORL1: a row the player has ALREADY raised costs the plan no new row slot', () => {
  // `virtueSpendPlan` takes the live deltas so a caller can ask "what
  // can still be done from here". The window's font-less escape re-plans
  // from scratch instead (a player can spend into a corner that only the
  // minus button gets out of), so nothing in the shipping game passes
  // deltas today - which left the contract with no pin and its mutant
  // alive. It is a law of the function either way, and the next caller
  // to want it should find it held rather than assumed.
  const p = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  const s = S();   // three rows, twelve points, Luck at four

  // three rows already open: a plan may still top THEM up...
  const open3 = { ...zeroDeltas(), strength: 1, agility: 1, speed: 1 };
  const more = virtueSpendPlan(p.stats, s, 9, open3);
  assert.ok(more.cost > 0, 'an open row can still take more');
  for (const k of STAT_KEYS_ORDER) {
    if (more.plan[k] > 0) assert.ok(open3[k] > 0, `${k} was already open - the plan opened no fourth row`);
  }
  // ...and their REMAINING room is what is on offer, not the whole limit
  const atLimit = { ...zeroDeltas(), strength: ATTRIBUTE_INCREASE_LIMIT };
  const capped = virtueSpendPlan(p.stats, s, 12, atLimit);
  assert.equal(capped.plan.strength, 0, 'a row at its limit takes nothing more');

  // one row open leaves TWO slots, not three
  const open1 = { ...zeroDeltas(), strength: 1 };
  const after = virtueSpendPlan(p.stats, s, 12, open1);
  const opened = STAT_KEYS_ORDER.filter((k) => after.plan[k] > 0 && !open1[k]).length;
  assert.ok(opened <= s.maxUpdatableAttribute - 1, `the plan opened ${opened} new rows with one already open`);
});

test('ORL1 L4: each of the five reasons the PLUS is withheld, one at a time (player.lua:599-603)', () => {
  const p = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  const s = S();
  const d = zeroDeltas();
  assert.equal(canRaiseAttribute('strength', p.stats, d, 12, s), true, 'the baseline is allowed');

  // 1. an empty purse
  assert.equal(canRaiseAttribute('strength', p.stats, d, 0, s), false);
  // 2. a purse that cannot pay THIS attribute's price
  assert.equal(canRaiseAttribute('luck', p.stats, d, 3, s), false, 'three points cannot buy a four-point Luck');
  assert.equal(canRaiseAttribute('strength', p.stats, d, 3, s), true, '...but can buy anything else');
  // 3. the row is at its own limit
  assert.equal(canRaiseAttribute('strength', p.stats, { ...d, strength: ATTRIBUTE_INCREASE_LIMIT }, 12, s), false);
  assert.equal(canRaiseAttribute('strength', p.stats, { ...d, strength: ATTRIBUTE_INCREASE_LIMIT - 1 }, 12, s), true);
  // 4. the row is at 100 - counting the points already added this level
  const maxed = virtuePlayer();
  for (const k of STAT_KEYS_ORDER) maxed.stats[k] = MAX_ATTRIBUTE_VALUE - 2;
  assert.equal(canRaiseAttribute('strength', maxed.stats, { ...d, strength: 1 }, 12, s), true);
  assert.equal(canRaiseAttribute('strength', maxed.stats, { ...d, strength: 2 }, 12, s), false);
  // 5. the "at most N attributes" count, which withholds only from the
  //    rows NOT already raised
  const three = { ...d, strength: 1, agility: 1, speed: 1 };
  assert.equal(canRaiseAttribute('endurance', p.stats, three, 12, s), false, 'a fourth row is refused');
  assert.equal(canRaiseAttribute('strength', p.stats, three, 12, s), true, '...and a raised one is not');
  const two = { ...d, strength: 1, agility: 1 };
  assert.equal(canRaiseAttribute('endurance', p.stats, two, 12, s), true, 'under the count, any row is open');
  // ...and the count is the SETTING's
  assert.equal(canRaiseAttribute('endurance', p.stats, two, 12, S({ maxUpdatableAttribute: 2 })), false);
});

test('ORL1 L4: the MINUS is shown exactly while a row has something to give back', () => {
  const d = zeroDeltas();
  assert.equal(canLowerAttribute('strength', d), false);
  assert.equal(canLowerAttribute('strength', { ...d, strength: 1 }), true);
});

// ── L5: THE COMMIT ─────────────────────────────────────────────────

test('ORL1 L5: the commit lands the attributes, DAGGERFALL\'s health, the level and the roll-over', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, levelRollUp: 5, level: 3 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  p.maxHealth = 60; p.health = 40;
  checkForVirtueLevelUp(p);
  const deltas = { ...zeroDeltas(), strength: 5, agility: 5, luck: 0 };
  // 10 ordinary points out of a twelve purse leaves 2; spend them
  deltas.speed = 2;
  const hp0 = p.maxHealth;
  assert.equal(commitVirtueLevelUp(p, deltas, 0, S(), seq(0)), true);
  assert.equal(p.stats.strength, 55);
  assert.equal(p.stats.agility, 55);
  assert.equal(p.stats.speed, 52);
  assert.equal(p.stats.endurance, 50, 'a row nobody touched is untouched');
  // THE HEALTH RULE IS DAGGERFALL'S, not `Endurance * fLevelUpHealthEndMult` -
  // and so is its POSITION. applyLevelUp rolls hit points BEFORE it hands
  // out the pool, on the endurance the character came in with; the mod
  // rolls AFTER its attribute loop, on the endurance just bought. Taking
  // the mod's order with Daggerfall's formula would pay a virtue
  // character for their own Endurance purchase in the same breath.
  assert.equal(p.maxHealth, hp0 + hitPointsPerLevelUp(career, 50, seq(0)));
  assert.ok(p.maxHealth > hp0);
  assert.equal(p.health, 40, 'the live pool is only ever clamped down');
  assert.equal(p.level, 4, 'ONE level, never a jump');
  assert.equal(p.levelProgress, 5, 'and the roll-over opens the next bar');
  assert.equal(p.levelRollUp, 0);
  assert.equal(p.readyToLevelUp, false);
  assert.equal(p.pendingLevel, null);
});

test('ORL1: the two lanes hand the same character the same hit points', () => {
  // The whole of departure 2 in one pin: buying Endurance at a virtue
  // level-up must not pay its own hit points. hitPointsPerLevelUp reads
  // `floor(END/10) - 5`, so a character at 58 who buys 5 crosses a ten
  // boundary - which is exactly where the two orders disagree.
  const mk = () => {
    const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 4 });
    for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
    p.stats.endurance = 58;
    p.maxHealth = 90; p.health = 90;
    checkForVirtueLevelUp(p);
    return p;
  };
  const bought = mk();
  commitVirtueLevelUp(bought, { ...zeroDeltas(), endurance: 5, strength: 5, agility: 2 }, 0, S(), seq(0));
  assert.equal(bought.stats.endurance, 63, 'the purchase landed');

  const untouched = mk();
  commitVirtueLevelUp(untouched, { ...zeroDeltas(), strength: 5, agility: 5, speed: 2 }, 0, S(), seq(0));
  assert.equal(untouched.stats.endurance, 58);

  assert.equal(bought.maxHealth, untouched.maxHealth,
    'the Endurance purchase must not pay its own hit points - the roll reads the endurance the level began with');
  // ...and it reads ENDURANCE, not whichever stat happens to sit beside
  // it: the pins lens showed `entity.stats.strength` in that line passed
  // the whole suite. Two characters alike but for endurance must differ.
  const lowEnd = mk(); lowEnd.stats.endurance = 38;
  commitVirtueLevelUp(lowEnd, { ...zeroDeltas(), strength: 5, agility: 5, speed: 2 }, 0, S(), seq(0));
  assert.equal(lowEnd.maxHealth, 90 + hitPointsPerLevelUp(career, 38, seq(0)));
  assert.notEqual(lowEnd.maxHealth, untouched.maxHealth,
    'endurance is what the roll reads - a character ten points lower gets less');
  // ...and that IS what the Daggerfall lane would have rolled
  assert.equal(bought.maxHealth, 90 + hitPointsPerLevelUp(career, 58, seq(0)));
});

test('ORL1 L5: an unspent purse is REFUSED, and no level is owed without the flag', () => {
  const p = virtuePlayer({ level: 3 });
  p.readyToLevelUp = true;
  assert.equal(commitVirtueLevelUp(p, zeroDeltas(), 1, S(), seq(0)), false, 'one point left is a refusal');
  assert.equal(p.level, 3, 'and nothing moved');
  const none = virtuePlayer({ level: 3 });
  assert.equal(commitVirtueLevelUp(none, zeroDeltas(), 0, S(), seq(0)), false, 'no owed level, no commit');
  assert.equal(none.level, 3);
});

test('ORL1: the headless spend obeys the MOD\'s caps, which spendPoolLowest would not', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 1 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  p.stats.strength = 40; p.stats.agility = 42; p.stats.speed = 44;   // the three lowest
  checkForVirtueLevelUp(p);
  assert.equal(virtueLevelUpHeadless(p, S(), seq(0)), true);
  const raised = STAT_KEYS_ORDER.filter((k) => p.stats[k] !== (k === 'strength' ? 40 : k === 'agility' ? 42 : k === 'speed' ? 44 : 50));
  assert.ok(raised.length <= S().maxUpdatableAttribute, 'never more rows than the mod allows');
  for (const k of STAT_KEYS_ORDER) assert.ok(p.stats[k] <= MAX_ATTRIBUTE_VALUE, `${k} is inside the cap`);
  assert.equal(p.level, 2);
  // and it never pushes a row past 100 even when every row is near it -
  // the defect chargen.spendPoolLowest has and this does not.
  const tight = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 1 });
  for (const k of STAT_KEYS_ORDER) tight.stats[k] = MAX_ATTRIBUTE_VALUE - 1;
  checkForVirtueLevelUp(tight);
  assert.equal(virtueLevelUpHeadless(tight, S(), seq(0)), true);
  for (const k of STAT_KEYS_ORDER) assert.ok(tight.stats[k] <= MAX_ATTRIBUTE_VALUE, `${k} never passes the cap`);
  // ...and the THREE-ROW cap still holds at the ceiling: eight rows a
  // point short of 100 is eleven points of headroom, and the character
  // may still only take three of them.
  assert.equal(STAT_KEYS_ORDER.filter((k) => tight.stats[k] === MAX_ATTRIBUTE_VALUE).length, S().maxUpdatableAttribute);
});

// ── THE SEAM INTO ADVANCEMENT ──────────────────────────────────────

test('ORL1: raiseSkills feeds the BAR for a virtue character and the SUM for a classic one', () => {
  const lb = SKILLS.LongBlade;
  const armed = (system) => {
    const p = { isPlayer: true, reflexes: 2, items: [] };
    createCharacter(p, career, 16, { rolls: seq(0) });
    initVirtueLeveling(p, system);
    p.skillUses[lb] = skillUsesForAdvancement(p.skills[lb], 2, 1.0, p.level);
    return p;
  };
  const v = armed(LEVELING_VIRTUE);
  const before = v.currentLevelUpSkillSum;
  assert.deepEqual(raiseSkills(v, T0 + 361, seq(0), () => {}), [lb]);
  assert.equal(v.levelProgress, 8, 'a primary raise put its eight points in');
  assert.ok(v.currentLevelUpSkillSum > before, 'and the DFU sum is still maintained, untouched');

  const c = armed(LEVELING_CLASSIC);
  assert.deepEqual(raiseSkills(c, T0 + 361, seq(0), () => {}), [lb]);
  assert.equal(c.levelProgress, 0, 'a classic character\'s bar never moves');
  assert.equal(c.levelRollUp, 0);
});

test('ORL1: the bar reads the value the skill is LEAVING, so a raise to 100 still counts', () => {
  // OpenMW calls the handler before the raise lands, and the 0.5.3
  // guard reads that value. A port that fed the bar after the raise
  // would silently drop the point that takes a skill to 100.
  const lb = SKILLS.LongBlade;
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  initVirtueLeveling(p, LEVELING_VIRTUE);
  p.skills[lb] = 99;
  p.level = 1;
  p.skillUses[lb] = skillUsesForAdvancement(99, 2, 1.0, 1);
  assert.deepEqual(raiseSkills(p, T0 + 361, seq(0), () => {}), [lb]);
  assert.equal(p.skills[lb], 100);
  assert.equal(p.levelProgress, 8, 'the raise TO 100 counted; only a raise FROM 100 would not');
});

test('ORL1: a full bar opens the host\'s own level-up door, and the headless arm commits by the mod\'s law', () => {
  const lb = SKILLS.LongBlade;
  const armed = () => {
    const p = { isPlayer: true, reflexes: 2, items: [] };
    createCharacter(p, career, 16, { rolls: seq(0) });
    initVirtueLeveling(p, LEVELING_VIRTUE);
    p.levelProgress = LEVELUP_TOTAL - 8;
    p.skillUses[lb] = skillUsesForAdvancement(p.skills[lb], 2, 1.0, p.level);
    return p;
  };
  // with a host hook: the hook is called and NOTHING is applied yet
  const hosted = armed();
  let opened = 0;
  raiseSkills(hosted, T0 + 361, seq(0), () => { opened++; });
  assert.equal(opened, 1, 'the host opens its door');
  assert.equal(hosted.readyToLevelUp, true);
  assert.equal(hosted.level, 1, 'and the level waits for the window');
  // without one: the headless arm commits, BY THE MOD'S LAW. Both arms
  // reach level 2, so the level alone cannot tell them apart - what
  // does is that the mod's arm rolls the bar over and never moves more
  // rows than the mod allows, and applyLevelUp's DFU pool does neither.
  const head = armed();
  const before = { ...head.stats };
  head.levelRollUp = 3;
  raiseSkills(head, T0 + 361, seq(0), null);
  assert.equal(head.level, 2);
  assert.equal(head.readyToLevelUp, false);
  assert.equal(head.levelProgress, 3, 'the bar rolled over - applyLevelUp would have left it full');
  assert.equal(head.levelRollUp, 0);
  const moved = STAT_KEYS_ORDER.filter((k) => head.stats[k] !== before[k]);
  assert.ok(moved.length > 0 && moved.length <= S().maxUpdatableAttribute,
    `the mod's three-row cap held (${moved.length} rows moved)`);
});

// ── THE TWO SCREENS ────────────────────────────────────────────────

test('ORL1: the level-up window spends by the mod\'s law and commits through the one home', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 2 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  checkForVirtueLevelUp(p);
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  assert.equal(w.purse, 12);
  assert.equal(w.done, false);
  // strength up five, and the sixth is refused by the row's own limit
  for (let i = 0; i < 6; i++) w.input('plus');
  assert.equal(w.deltas.strength, ATTRIBUTE_INCREASE_LIMIT);
  assert.equal(w.purse, 7);
  // LUCK COSTS FOUR, in the window as in the law
  const luckAt = w.purse;
  w.cursor = STAT_KEYS_ORDER.indexOf('luck');
  w.input('plus');
  assert.equal(w.deltas.luck, 1);
  assert.equal(w.purse, luckAt - 4, 'one point of Luck cost four virtues');
  w.input('minus');
  assert.equal(w.deltas.luck, 0);
  assert.equal(w.purse, luckAt, 'and gave four back');
  w.cursor = STAT_KEYS_ORDER.indexOf('strength');
  // minus gives it back
  w.input('minus');
  assert.equal(w.deltas.strength, 4);
  assert.equal(w.purse, 8);
  w.input('char:-');   // the OTHER spelling of the same key (ui/input.js:232)
  assert.equal(w.deltas.strength, 3);
  // confirming with a purse left is refused, loudly, and changes nothing
  assert.equal(w.confirm(), false);
  assert.equal(w.refused, true);
  assert.equal(p.level, 2);
  // spend the rest and it commits
  w.cursor = STAT_KEYS_ORDER.indexOf('agility');
  for (let i = 0; i < 5; i++) w.input('plus');
  w.cursor = STAT_KEYS_ORDER.indexOf('speed');
  // BOUNDED ON PURPOSE. An unbounded `while (w.purse > 0)` here hung
  // the mutation runner for twenty minutes on the one mutant that
  // makes every row refuse a press: the pin never finished, so the
  // mutant neither died nor survived, it just stopped the campaign.
  // A pin that cannot fail is bad; a pin that cannot RETURN is worse.
  for (let guard = 0; w.purse > 0 && guard < 64; guard++) w.input('plus');
  assert.equal(w.purse, 0, 'the purse really can be spent down from here');
  w.input('confirm');
  assert.equal(w.done, true);
  assert.equal(p.level, 3);
  assert.equal(p.stats.strength, 53);
  assert.equal(p.stats.agility, 55);
});

test('ORL1: the window HIDES a press it will not honour, as the mod does', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 2 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  checkForVirtueLevelUp(p);
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  // a fresh row offers PLUS and no MINUS
  assert.deepEqual(w.rowMarkers('strength'), { minus: false, plus: true });
  // ...and the WORDS carry the markers, in their own columns
  assert.equal(w.rowText('strength'), '  Strength      50      0 +', 'a space where minus would be, a plus where plus is');
  // raise it and MINUS appears
  w.cursor = STAT_KEYS_ORDER.indexOf('strength');
  w.input('plus');
  assert.deepEqual(w.rowMarkers('strength'), { minus: true, plus: true });
  assert.equal(w.rowText('strength'), '  Strength      51   - +1 +');
  // a row at its per-level limit loses PLUS
  for (let i = 0; i < 4; i++) w.input('plus');
  assert.equal(w.deltas.strength, ATTRIBUTE_INCREASE_LIMIT);
  assert.deepEqual(w.rowMarkers('strength'), { minus: true, plus: false },
    'plus is HIDDEN at the row limit, not shown and refused');
  assert.equal(w.rowText('strength'), '  Strength      55   - +5  ', 'and the plus column is a SPACE, not a dimmed plus');
  // ...and a row the three-attribute cap shuts out loses it too
  w.cursor = STAT_KEYS_ORDER.indexOf('agility'); w.input('plus');
  w.cursor = STAT_KEYS_ORDER.indexOf('speed'); w.input('plus');
  assert.deepEqual(w.rowMarkers('endurance'), { minus: false, plus: false }, 'a fourth row is not offered a press');
  // Luck's price is on its row and nowhere else
  assert.match(w.rowText('luck'), /\(4 per point\)/);
  assert.ok(!w.rowText('strength').includes('per point'));
  // and the selected row is the one marked
  assert.ok(w.rowText('luck', true).startsWith('>'));
  assert.ok(w.rowText('luck', false).startsWith(' '));
});

test('ORL1: the window\'s cursor walks every row, in both directions', () => {
  // The pins lens: the window test used to WRITE `w.cursor` by hand, so
  // both navigation arms were unreachable and `(cursor + 7) % 8` could
  // become `+ 6` - which makes half the attributes unselectable going
  // up - without a single assertion failing.
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 2 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  checkForVirtueLevelUp(p);
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  assert.equal(w.cursor, 0);
  const seenDown = [];
  for (let i = 0; i < STAT_KEYS_ORDER.length; i++) { seenDown.push(w.cursor); w.input('down'); }
  assert.deepEqual(seenDown, [...STAT_KEYS_ORDER.keys()], 'down visits every row in order and wraps home');
  assert.equal(w.cursor, 0);
  const seenUp = [];
  for (let i = 0; i < STAT_KEYS_ORDER.length; i++) { w.input('up'); seenUp.push(w.cursor); }
  assert.deepEqual(seenUp, [7, 6, 5, 4, 3, 2, 1, 0], 'and up walks back through every one of them');
  // ...and the cursor really selects: a plus lands on the row it names
  w.input('down');   // -> 1, intelligence
  w.input('plus');
  assert.equal(w.deltas[STAT_KEYS_ORDER[1]], 1);
  assert.equal(w.deltas[STAT_KEYS_ORDER[0]], 0);
});

test('ORL1: the refusal line clears the moment the player acts on it', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 2 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  checkForVirtueLevelUp(p);
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  w.input('confirm');
  assert.equal(w.refused, true, 'a purse with points left refuses');
  w.input('plus');
  assert.equal(w.refused, false, 'spending clears it - it must not sit under a purse that now reads 0');
  w.input('confirm');
  assert.equal(w.refused, true);
  w.input('minus');
  assert.equal(w.refused, false, 'and so does taking a point back');
});

test('ORL1: the window\'s three strings are the AUTHOR\'S OWN, out of en.yaml', () => {
  // The settings descriptions are pinned against the mod's l10n; these
  // three said the same thing about themselves and were pinned by
  // nothing (the pins lens). Same file, same law.
  const yaml = rdMod(`${MOD}/l10n/en.yaml`);
  const line = (k) => new RegExp(`^${k}: "(.*)"$`, 'm').exec(yaml)?.[1];
  assert.equal(REMAINING_POINTS_ERROR, line('remaining_points_error'));
  assert.equal(REMAINING_POINTS_LABEL, line('remaining_points_label'));
  // the count label is the author's with {count} filled in, not re-worded
  const tmpl = line('choose_attributes_label');
  assert.ok(tmpl.includes('{count}'), 'the mod\'s string really is a template');
  assert.equal(chooseAttributesLabel(3), tmpl.replace('{count}', '3'));
  assert.equal(chooseAttributesLabel(5), tmpl.replace('{count}', '5'));
});

test('ORL1: the question\'s UP arm is bound, both spellings', () => {
  // Two options, so either direction moves between them - but a table
  // that advertises Up and does not answer it strands a player who has
  // walked onto the second option and wants the first (the pins lens).
  for (const key of ['up', 'ArrowUp', 'down', 'ArrowDown']) {
    const got = [];
    const q = new LevelingChoiceScreen((id) => got.push(id));
    assert.equal(q.cursor, 0);
    q.input(key);
    assert.equal(q.cursor, 1, `${key} moves the choice`);
    q.input(key);
    assert.equal(q.cursor, 0, `${key} moves it back`);
    q.input('confirm');
    assert.deepEqual(got, [LEVELING_CLASSIC]);
  }
});

test('ORL1: the interior host\'s two level-up arms, and the dungeon host\'s font-less escape', () => {
  // The pins lens: reverting either interior arm, or the dungeon's
  // virtue escape, passed the whole suite - the only coverage was a
  // substring check against a COMMENT in another file. These are source
  // laws because the hosts are not constructible in a unit test, and
  // they are held by CONTENT rather than by a file name.
  const wm = rd('src/scenes/worldModes.js');
  const arms = wm.match(/\?\? \(usesVirtueLeveling\(playerEntity\) && !playerEntity\.oghmaLevelUp\n\s*\? new VirtueLevelUpScreen\(playerEntity\)\n\s*: new LevelUpScreen\(playerEntity\)\)/g) ?? [];
  assert.equal(arms.length, 2, 'BOTH interior level-up arms know whose law levels this character');
  assert.match(wm, /import \{ VirtueLevelUpScreen \} from '\.\.\/ui\/virtueLevelUp\.js';/);

  const dc = rd('src/scenes/dungeonContext.js');
  // the virtue arm comes BEFORE the classic ones, or the purse would be
  // spent by a policy that does not know the mod's caps
  const virtue = dc.indexOf('activeOverlay?.isVirtueLevelUp');
  const classic = dc.indexOf('activeOverlay instanceof LevelUpScreen');
  assert.ok(virtue > 0 && classic > 0 && virtue < classic,
    'the font-less escape asks about the mod\'s window FIRST');
  assert.match(dc, /activeOverlay\.spendRemainingHeadless\(\);/);
});

test('ORL1: the window\'s font-less escape spends within the caps and closes', () => {
  const p = virtuePlayer({ levelProgress: LEVELUP_TOTAL, level: 2 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  checkForVirtueLevelUp(p);
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: seq(0) });
  assert.equal(w.spendRemainingHeadless(), true);
  assert.equal(w.done, true);
  assert.equal(p.level, 3);
  const moved = STAT_KEYS_ORDER.filter((k) => p.stats[k] !== 50);
  assert.ok(moved.length > 0 && moved.length <= S().maxUpdatableAttribute);
  for (const k of moved) assert.ok(p.stats[k] - 50 <= ATTRIBUTE_INCREASE_LIMIT);
});

test('ORL1: the question can be answered with the MOUSE, which is how the wizard can be finished', () => {
  // The classic wizard is completable by pointer alone and has been
  // since U8b; a screen the door puts in front of its OK that swallows
  // every click dead-ends that player entirely (ORL1's review).
  const OPTS = levelingOptions(S());
  const mid = (i) => choiceTop(i) + 4;
  assert.equal(CHOICE_TOP, choiceTop(0), 'the table\'s first row IS the first option');
  assert.ok(CHOICE_PITCH > choiceHeight(OPTS[1]), 'the pitch must clear the taller option\'s whole block');
  assert.equal(choiceAtNative(160, mid(0), OPTS), 0);
  assert.equal(choiceAtNative(160, mid(1), OPTS), 1);
  assert.equal(choiceAtNative(160, 8, OPTS), -1, 'the headline is not an answer');
  assert.equal(choiceAtNative(2, mid(0), OPTS), -1, 'nor is the margin');
  assert.equal(choiceAtNative(160, choiceTop(2), OPTS), -1, 'nor is the footer');

  let got = [];
  const q = new LevelingChoiceScreen((id) => got.push(id));
  assert.equal(q.click(2, mid(0)), false, 'a click outside the rows answers nothing');
  assert.deepEqual(got, []);
  assert.equal(q.click(160, mid(1)), true);
  assert.deepEqual(got, [LEVELING_VIRTUE], 'one press picks AND answers');
  assert.equal(q.done, true);
  q.click(160, mid(0));
  assert.deepEqual(got, [LEVELING_VIRTUE], 'and it answers once');

  // the highlight follows the pointer
  const q2 = new LevelingChoiceScreen(() => {});
  q2.hover(160, mid(1));
  assert.equal(q2.cursor, 1);
  q2.hover(160, mid(0));
  assert.equal(q2.cursor, 0);
  q2.hover(160, 8);
  assert.equal(q2.cursor, 0, 'a hover off the rows leaves the choice where it was');

  // ...and the chargen door really forwards it
  const cs = rd('src/systems/chargenSession.js');
  assert.match(cs, /click\(vx, vy\) \{ if \(prompt\) prompt\.click\(vx, vy\); else inner\.click\?\.\(vx, vy\); \},/);
  assert.match(cs, /hover\(vx, vy, e = null\) \{ if \(prompt\) prompt\.hover\(vx, vy\); else inner\.hover\?\.\(vx, vy, e\); \},/);
});

test('ORL1: the question describes the purse the game will actually hand out', () => {
  // THE SCREEN A CHARACTER CANNOT COME BACK TO must not describe a
  // level-up the settings do not give. `attributePoints` is a slider
  // from 0 to 60 and the Mods pane exposes it; the blurb used to say
  // "twelve virtues" whatever it was set to (ORL1's review).
  const words = (over) => levelingOptions(S(over)).find((o) => o.id === LEVELING_VIRTUE).lines.join(' ');
  assert.match(words({}), /12 virtues, to spend on at most 3 attributes/);
  assert.match(words({ attributePoints: 20, maxUpdatableAttribute: 5 }),
    /20 virtues, to spend on at most 5 attributes/);
  assert.match(words({ attributePoints: 1 }), /\b1 virtue\b/, 'and it counts in English');
  // ...and a purse of NOTHING says so rather than promising virtues
  const none = words({ attributePoints: 0 });
  assert.match(none, /purse to nothing/);
  assert.doesNotMatch(none, /\b0 virtues/);
  // the bar's size is the mod's own number, not a second copy of it
  assert.match(words({}), new RegExp(`At ${LEVELUP_TOTAL} you level`));

  // DAGGERFALL'S OWN HALF QUOTES THE PORT'S OWN LAW, and quotes it from
  // the law rather than from a typist. This pin used to read "fifteen
  // points" and "four to six points" as words, against a blurb that had
  // typed the same words - a constant measured against itself, and the
  // exact defect the first review fixed on the virtue half. The deep
  // audit found it still standing here.
  const classic = levelingOptions(S({})).find((o) => o.id === LEVELING_CLASSIC).lines.join(' ');
  assert.match(classic, new RegExp(`every ${LEVELUP_SKILL_SUM_PER_LEVEL} points of it is a level`));
  assert.match(classic, new RegExp(`rolls ${LEVELUP_BONUS_POOL_MIN} to ${LEVELUP_BONUS_POOL_MAX} attribute points`));
  // ...and those ARE the numbers the level-up they describe uses
  assert.equal(calculatePlayerLevel(0, LEVELUP_SKILL_SUM_PER_LEVEL * 3 - 28), 3,
    'the blurb\'s divisor is the one calculatePlayerLevel divides by');
});

test('ORL1: the new-game question offers Daggerfall FIRST and answers exactly once', () => {
  // AGAINST THE SCREEN, not against the two constants it is declared
  // from. This read `[LEVELING_CLASSIC, LEVELING_VIRTUE]` on both sides,
  // which is the same import twice - and the array is a hand-written
  // second copy of the order `levelingOptions` mints, so the two can
  // disagree and nothing noticed (ORL1's deep audit).
  assert.deepEqual([...LEVELING_OPTION_IDS], levelingOptions(S()).map((o) => o.id),
    'the id list IS the order the screen offers');
  assert.equal(LEVELING_OPTION_IDS[0], LEVELING_CLASSIC,
    'the port\'s own law is the default a player gets by pressing Enter');
  let got = [];
  const q = new LevelingChoiceScreen((id) => got.push(id));
  assert.equal(q.done, false);
  q.input('confirm');
  assert.deepEqual(got, [LEVELING_CLASSIC]);
  assert.equal(q.done, true);
  // THE MODAL CONTRACT: every key after the answer is inert, AND the
  // latch is on `answer` itself - a host that calls it directly gets
  // the same one answer, which is the half of the law a key-driven pin
  // cannot reach (input() returns early on the same flag).
  q.input('confirm'); q.input('down'); q.input('char:2');
  assert.equal(q.answer(LEVELING_VIRTUE), false, 'the answer fires once, however many doors call it');
  assert.deepEqual(got, [LEVELING_CLASSIC]);

  // the cursor, and the number keys
  got = [];
  const q2 = new LevelingChoiceScreen((id) => got.push(id));
  q2.input('down');
  q2.input('confirm');
  assert.deepEqual(got, [LEVELING_VIRTUE]);
  got = [];
  new LevelingChoiceScreen((id) => got.push(id)).input('char:2');
  assert.deepEqual(got, [LEVELING_VIRTUE]);

  // BOTH VOCABULARIES - a caller driving the whole wizard with raw key
  // codes must not fall off a cliff at the last screen.
  got = [];
  new LevelingChoiceScreen((id) => got.push(id)).input('Enter');
  assert.deepEqual(got, [LEVELING_CLASSIC]);
  got = [];
  const q3 = new LevelingChoiceScreen((id) => got.push(id));
  q3.input('ArrowDown');
  q3.input('Enter');
  assert.deepEqual(got, [LEVELING_VIRTUE]);
  // and an unknown key is inert rather than an answer
  got = [];
  const q4 = new LevelingChoiceScreen((id) => got.push(id));
  q4.input('KeyZ'); q4.input('Escape'); q4.input('char:9');
  assert.deepEqual(got, []);
  assert.equal(q4.done, false, 'there is no way out of this screen but an answer');
});

// ── THE SEAMS, AS SOURCE LAW ───────────────────────────────────────

test('ORL1: the wizard\'s window stays OPEN on the question, and the answer reaches the character', () => {
  // THE MODAL CONTRACT, one layer out. The hosts tear an overlay down
  // the moment it reports `done`, so a window that reported done when
  // the WIZARD finished would take the question off the screen before
  // anyone could answer it - and the host would then call finishChargen
  // with no answer at all. `done` stays false until the question is
  // answered, and this walks a real flow to prove it.
  let result = null;
  const w = createChargenWindow(new ChargenFlow([{ name: 'Warrior', career }], () => 0),
    { onDone: (r) => { result = r; } });
  const key = (code, n = 1) => { for (let i = 0; i < n; i++) w.input(code); };
  key('Enter');            // race
  key('KeyM');             // gender
  key('Enter');            // method
  key('Enter');            // class
  for (const c of 'KeyM KeyA KeyC'.split(' ')) w.input(c);
  key('Enter');            // name -> face
  key('Enter');            // face -> stats
  key('Equal', 6); key('Enter');
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('Enter');
  key('Enter');            // reflexes -> summary
  key('Enter');            // summary OK -> THE QUESTION

  assert.ok(w.flow.done, 'the wizard itself has finished');
  assert.ok(w.levelingPrompt, 'and the question is up');
  assert.equal(w.done, false, 'the window must NOT report done while the question is unanswered');
  assert.equal(result, null, 'and the host has not been handed a character yet');
  // the wizard wanted raw key codes; the question wants the shared
  // action names, and the flag the hosts read is a getter for that
  // reason (townTalk.js routes on it at the moment of the press).
  assert.equal(w.isChoiceWindow, false, 'the question is routed through overlayAction');

  w.input('ArrowDown');
  w.input('Enter');
  assert.equal(w.done, true);
  assert.ok(result, 'the host is handed the character now');
  assert.equal(result.levelingSystem, LEVELING_VIRTUE, 'carrying the answer');

  // ...and finishChargen puts it on the entity beside the DFU anchor
  const e = { gender: 'male', race: 'Breton' };
  finishChargen(e, result, null);
  assert.equal(e.levelingSystem, LEVELING_VIRTUE);
  assert.equal(e.levelProgress, 0);
  assert.equal(e.levelRollUp, 0);
  assert.ok(usesVirtueLeveling(e));
  // a result that carries no answer is a classic character
  const plain = { gender: 'male', race: 'Breton' };
  finishChargen(plain, { ...result, levelingSystem: undefined }, null);
  assert.equal(plain.levelingSystem, LEVELING_CLASSIC);
});

test('ORL1: a wizard torn down mid-question still hands its host an answer', () => {
  // A host may drop an overlay that is not done - townTalk's font-less
  // arm does, by the never-trap law - and the character is finished by
  // then. The question falls back to Daggerfall's own system rather
  // than swallowing the answer and the character with it.
  let result = null;
  let calls = 0;
  const w = createChargenWindow(new ChargenFlow([{ name: 'Warrior', career }], () => 0),
    { onDone: (r) => { calls += 1; result = r; } });
  const key = (code, n = 1) => { for (let i = 0; i < n; i++) w.input(code); };
  key('Enter'); key('KeyM'); key('Enter'); key('Enter');
  for (const c of 'KeyM KeyA KeyC'.split(' ')) w.input(c);
  key('Enter'); key('Enter');
  key('Equal', 6); key('Enter');
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('Enter');
  key('Enter'); key('Enter');
  assert.ok(w.levelingPrompt, 'the question is up and unanswered');
  assert.equal(calls, 0);

  w.dispose();
  assert.equal(calls, 1, 'the host is handed its character');
  assert.equal(result.levelingSystem, LEVELING_CLASSIC, 'under the port\'s own law');
  assert.equal(w.done, true);
  // ...and once, however many doors call it
  w.dispose();
  w.input('Enter');
  assert.equal(calls, 1);
});

test('ORL1: the choice rides the ONE chargen door, and every apply path answers it', () => {
  const cs = rd('src/systems/chargenSession.js');
  assert.match(cs, /return withLevelingChoice\(flow, \{ onDone, onCancel, hudScale \}\);/,
    'createChargenWindow wraps the wizard rather than each host wiring a prompt');
  assert.match(cs, /initVirtueLeveling\(playerEntity, result\.levelingSystem \?\? LEVELING_CLASSIC\);/,
    'finishChargen sets the answer beside the DFU level anchor');
  assert.match(cs, /initVirtueLeveling\(playerEntity, LEVELING_CLASSIC\);/,
    'and the ?class= skip takes the port\'s own law');
  // THE FOUR HOSTS, each named at this seam
  for (const host of ['world.js', 'exterior.js', 'worldModes.js', 'dungeonContext.js']) {
    assert.ok(cs.includes(host), `the leveling seam does not name ${host}`);
  }
  // the third apply path - the font-less creation - answers it too
  assert.match(rd('src/scenes/dungeonContext.js'), /initVirtueLeveling\(playerEntity, LEVELING_CLASSIC\);/);
});

test('ORL1: the mod\'s window is the door\'s, in BOTH lanes, and the classic sheet stands down', () => {
  const door = rd('src/ui/charSheetDoor.js');
  assert.match(door, /if \(deps\.entity\?\.readyToLevelUp && !deps\.entity\?\.oghmaLevelUp && usesVirtueLeveling\(deps\.entity\)\) \{\n\s*return new VirtueLevelUpScreen\(deps\.entity\);/,
    'the mod\'s window comes BEFORE the skin fork - it is not a sheet');
  // and it is ahead of the enhanced lane's own level-up screen
  assert.ok(door.indexOf('new VirtueLevelUpScreen') < door.indexOf('new LevelUpScreen'));
  const sheet = rd('src/ui/charsheet.js');
  assert.match(sheet, /if \(!e\.oghmaLevelUp && usesVirtueLeveling\(e\)\) return;/,
    'the classic rollout refuses a virtue level-up - the other half of the door');
  // a11's law still holds for the new window: no private Level++, no
  // private health roll in any UI module.
  const win = rd('src/ui/virtueLevelUp.js');
  assert.doesNotMatch(win, /\.level \+= 1/, 'no private Level++ in the window');
  assert.doesNotMatch(win, /hitPointsPerLevelUp/, 'and no private health roll');
  assert.match(win, /commitVirtueLevelUp/, 'the law module owns the change');
});

test('ORL1: the choice and the bar ride the SAVE, not the mod-settings store', () => {
  const save = rd('src/systems/save.js');
  for (const f of ['levelingSystem', 'levelProgress', 'levelRollUp']) {
    assert.match(save, new RegExp(`'${f}'`), `${f} is carried by the save`);
  }
  // a classic import is a classic character
  assert.match(rd('src/systems/classicSave.js'),
    /levelingSystem: LEVELING_CLASSIC, levelProgress: 0, levelRollUp: 0,/);
  // AND THE CHOICE IS NOT IN THE MOD STORE: that store is per-browser
  // and shared by every character, which is the wrong lifetime for it.
  assert.equal(Object.keys(MOD_SETTINGS[V].keys).includes('levelingSystem'), false);
  // a save written before this slice has no field, and reads as classic
  assert.equal(usesVirtueLeveling({}), false);
  assert.equal(usesVirtueLeveling({ levelingSystem: undefined }), false);
  assert.equal(usesVirtueLeveling({ levelingSystem: LEVELING_VIRTUE }), true);
});

test('ORL1: the tile, the group, the credit and the registry row', () => {
  const row = FEATURES.find((f) => f.control?.vendor === V);
  assert.ok(row, 'the mod has a Features row');
  assert.deepEqual(row.kinds, ['mod']);
  assert.equal(row.group, 'character');
  assert.ok(GROUPS.character, 'and the group it names exists');
  // ONE SOURCE - and the words themselves, because `row.note` IS that
  // property, so comparing the two is a constant against itself and
  // holds for an empty string (the pins lens). What the tile owes a
  // player is a note that says what the switch DOES.
  assert.equal(row.note, MOD_SETTINGS[V].keys.Enabled.description, 'the mod\'s own words, one source');
  assert.match(row.note, /100-point bar/, 'and the note says what the system is');
  assert.match(row.note, /virtues/);
  assert.match(row.note, /asked which system they want/, '...and that it is a choice, not a switch that converts anyone');
  assert.ok(row.note.length > 120, 'a placeholder is not a note');
  // the effect line is the one that had to say NEXT CHARACTER: every
  // other mod's switch lands on the running game.
  assert.match(row.effect, /^Takes effect on the next character you make/);
  // all eight knobs reach the tile
  assert.equal(MOD_CURATED[V].length, 8);
  for (const k of MOD_CURATED[V]) assert.ok(MOD_SETTINGS[V].keys[k], `${k} is a key the mod ships`);
  // the credit says what is true about the author
  const credit = CREDITS.mods.find((m) => m.vendor.includes(V));
  assert.ok(credit, 'the About screen credits it');
  assert.equal(credit.version, '0.5.3');
  assert.match(credit.author, /Unnamed/, 'the one row whose author the archive does not name');
  assert.match(credit.terms, /permission/i);
  // and the registry row still carries the open record, both ways
  assert.match(rd(`${MOD}/README.md`), /\[Mac: record the author's permission/);
  assert.match(rd('bible/01-Overview/Mod-Registry.md'), new RegExp(`\\| \`${V}\` \\|[^\\n]*RECORD OPEN`));
});

test('ORL1: the mod ships ON, and a switched-off mod asks nobody', () => {
  // MO1: every vendored mod's Enabled defaults true.
  assert.equal(MOD_SETTINGS[V].keys.Enabled.default, true);
  assert.equal(oblivionLevelingEnabled(reader()), true);
  assert.equal(oblivionLevelingEnabled(reader({ Enabled: false })), false);
  // ...and with it off the wizard's answer goes straight out, carrying
  // the port's own law rather than a question nobody was asked.
  assert.match(rd('src/systems/chargenSession.js'),
    /if \(!oblivionLevelingEnabled\(\)\) \{\n\s*return chargenWizard\(flow, \{\n\s*onCancel, hudScale, onDone: \(r\) => onDone\?\.\(\{ \.\.\.r, levelingSystem: LEVELING_CLASSIC \}\),/);
});

test('ORL1: neither screen claims native geometry it has no source for', () => {
  // THE NATIVE-WINDOW RULE: an element whose DFU value is unknown does
  // not draw. Neither screen has a DFU source at all - Daggerfall has
  // no purse dialog and never asked this question - so both stay in
  // LevelUpScreen's text idiom and neither loads native art.
  for (const f of ['src/ui/virtueLevelUp.js', 'src/ui/levelingChoice.js']) {
    const s = rd(f);
    const code = s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    // ART, not the LETTERBOX. `nativeMetrics` and `NATIVE_W` are how a
    // window learns where the 320x200 game area sits on this canvas, and
    // every clickable native window reads them; drawing WITHOUT them is
    // what put this screen's picture and its click target on different
    // pixels (ORL1's deep audit). What the rule forbids is claiming
    // GEOMETRY FROM ART there is no DFU source for, so that is what is
    // named here.
    assert.doesNotMatch(code, /loadImg|drawImg|drawRect|shadowText|messageBox|\.IMG|\.CIF/,
      `${f} draws no native art`);
    assert.match(code, /nativeMetrics/, `${f} paints where the pointer seam looks`);
    assert.match(s, /drawScreenQuad/, `${f} is the dim-and-text idiom`);
    assert.match(s, /NATIVE-WINDOW RULE/, `${f} says why it is not a native window`);
  }
});

// ───────────────────────────────────────────────────────────────────
// ORL1 THE DEEP AUDIT - the pins for the laws the first pass shipped
// with nothing holding them. The lens that mattered most reported
// that NEITHER NEW SCREEN'S `draw` WAS EVER CALLED: thirteen draw
// mutations survived, `draw() { return; }` among them, on two screens
// whose whole defect surface is geometry. Every pin below either runs
// a draw or measures the table a draw reads.
// ───────────────────────────────────────────────────────────────────

/** A font with a KNOWN, PESSIMISTIC metric: six pixels a glyph, where
 *  FONT0003 gives five for capitals (test/audit18_ui_native.test.js
 *  F1: measureText(f,'HELLO') === 25). A layout that fits this fits
 *  the real font with room to spare, and it needs no ARENA2. */
function stubFont() {
  return { tex: 'font', fnt: { fixedWidth: 6, fixedHeight: 8, glyphWidth: () => 5 } };
}
/** A renderer that records what was painted and where. */
function drawRecorder() {
  const quads = [];
  return { quads, drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, color }) };
}
const canvasOf = (width, height) => ({ width, height });
/** nativeMetrics' own arithmetic, restated so a pin can predict the paint. */
function metricsOf(width, height) {
  const s = Math.max(1, Math.floor(Math.min(width / 320, height / 200)));
  return { s, ox: Math.floor((width - 320 * s) / 2), oy: Math.floor((height - 200 * s) / 2) };
}

test('ORL1 deep audit: the question PAINTS where the hit test LOOKS, on every canvas', () => {
  // THE DEFECT THIS HOLDS. The question drew at `32 * s` from the CANVAS
  // ORIGIN while `choiceAtNative` read letterboxed 320x200 units. Through
  // townTalk - world.js's and exterior.js's pointer route - the two were
  // (ox, oy) apart, so a click on the painted Oblivion option selected
  // DAGGERFALL: 26% of its area on 1366x768, 32% on 1024x768, 60% on
  // 800x600. The wrong leveling system, chosen silently, on the one
  // screen a character can never come back to. No pin could see it
  // because no pin had ever called `draw`.
  const opts = levelingOptions(S());
  for (const [W, H] of [[1400, 900], [1920, 1080], [1366, 768], [1024, 768],
    [800, 600], [1600, 1000], [2560, 1440], [375, 667]]) {
    const m = metricsOf(W, H);
    const r = drawRecorder();
    const q = new LevelingChoiceScreen(() => {});
    q.draw(r, canvasOf(W, H), stubFont());
    assert.ok(r.quads.length > 1, `${W}x${H}: the screen painted nothing`);

    // every glyph of an option's block must read back as THAT option
    const glyphs = r.quads.filter((x) => x.tex === 'font');
    assert.ok(glyphs.length > 100, `${W}x${H}: ${glyphs.length} glyphs is not a screen`);
    let inside = 0;
    for (const g of glyphs) {
      const vx = (g.x - m.ox) / m.s, vy = (g.y - m.oy) / m.s;
      const i = choiceAtNative(vx, vy, opts);
      if (i >= 0) inside++;
      // and nothing painted for one option may read back as the other:
      // that is the wrong-system click, and it is what this asserts away.
      assert.ok(vx >= 0 && vx <= 320, `${W}x${H}: a glyph at native x ${vx.toFixed(1)} is off the game area`);
    }
    assert.ok(inside > 40, `${W}x${H}: only ${inside} painted glyphs fall inside an option's hit box`);
  }
});

test('ORL1 deep audit: every painted row of an option is inside THAT option, at every slider', () => {
  // CHOICE_HEIGHT was a literal 52 while the Oblivion option painted 62,
  // so its last line sat outside its own hit box. The height is derived
  // from the option now, and this is the assertion that keeps it so -
  // including at the extremes of three sliders, because the option's
  // text is built from them.
  for (const attributePoints of [0, 1, 12, 60]) {
    for (const maxUpdatableAttribute of [2, 3, 8]) {
      const s = S({ attributePoints, maxUpdatableAttribute });
      const opts = levelingOptions(s);
      opts.forEach((o, i) => {
        const top = choiceTop(i);
        assert.equal(choiceHeight(o), CHOICE_TITLE_H + o.lines.length * CHOICE_LINE_H);
        const rows = [top, ...o.lines.map((_, k) => top + CHOICE_TITLE_H + k * CHOICE_LINE_H)];
        for (const y of rows) {
          assert.equal(choiceAtNative(160, y, opts), i,
            `ap=${attributePoints} mu=${maxUpdatableAttribute}: option ${i}'s row at y=${y} is not in its own hit box`);
        }
        // ...and the blocks do not run into each other or off the screen
        if (i + 1 < opts.length) assert.ok(top + choiceHeight(o) <= choiceTop(i + 1), 'the blocks overlap');
      });
      assert.ok(choiceTop(opts.length) + 10 <= 200, 'the footer is off the bottom of the screen');
    }
  }
});

test('ORL1 deep audit: nothing the question paints runs off the 320-unit game area', () => {
  // It did. The subtitle was 73 characters and the longest body line 66
  // with its indent, which at five pixels a glyph is past 320 - clipped
  // on 1600x1000, 640x400 and 1024x768 through townTalk, and on EVERY
  // canvas in the dungeon host, which hands the draw a 320-unit width.
  // Measured here against a SIX-pixel font, so the real one has margin.
  for (const attributePoints of [0, 1, 12, 59, 60]) {
    for (const maxUpdatableAttribute of [2, 3, 8]) {
      const r = drawRecorder();
      const q = new LevelingChoiceScreen(() => {},
        { settings: S({ attributePoints, maxUpdatableAttribute }) });
      q.draw(r, canvasOf(1600, 1000), stubFont());   // ox = oy = 0, so native == painted
      const glyphs = r.quads.filter((x) => x.tex === 'font');
      for (const g of glyphs) {
        assert.ok(g.x >= 0 && g.x + g.w <= 1600,
          `ap=${attributePoints} mu=${maxUpdatableAttribute}: a glyph runs to ${g.x + g.w} of 1600`);
        assert.ok(g.y >= 0 && g.y + g.h <= 1000, 'a glyph runs off the bottom');
      }
    }
  }
});

test('ORL1 deep audit: the level-up window can be finished with the POINTER alone', () => {
  // In the classic skin this window stands in for the native sheet's
  // rollout, which IS clickable - so without a seam a player levelling a
  // virtue character by mouse could open it and never close it, and on a
  // touch screen there was no way in at all.
  const entity = {
    level: 4, pendingLevel: 5, readyToLevelUp: true, levelProgress: 100, levelRollUp: 0,
    health: 40, maxHealth: 40, career,
    stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50])),
  };
  const w = new VirtueLevelUpScreen(entity, { settings: S(), rolls: () => 0.5 });
  assert.equal(w.purse, 12);

  // the rects say what they mean
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(levelUpHitNative(ROW_X + 4, ROW_TOP + i * ROW_PITCH + 4), { row: i });
  }
  assert.deepEqual(levelUpHitNative(MINUS_X + 4, PRESS_Y + 4), { press: 'minus' });
  assert.deepEqual(levelUpHitNative(PLUS_X + 4, PRESS_Y + 4), { press: 'plus' });
  assert.deepEqual(levelUpHitNative(OK_X + 4, PRESS_Y + 4), { press: 'ok' });
  assert.equal(levelUpHitNative(4, ROW_TOP + 4), null, 'the margin is not a row');
  assert.equal(levelUpHitNative(160, 8), null, 'the headline is not a press');

  // OK REFUSES while the purse is unspent, and says so - the same law the
  // keyboard's ENTER obeys (player.lua:532-552 validateLevelUp)
  w.click(OK_X + 4, PRESS_Y + 4);
  assert.equal(w.done, false);
  assert.equal(w.refused, true);

  // ...and a finger can spend it and close it
  let guard = 0;
  while (w.purse > 0 && guard++ < 64) {
    let moved = false;
    for (let i = 0; i < 8 && !moved; i++) {
      w.click(ROW_X + 4, ROW_TOP + i * ROW_PITCH + 4);
      const before = w.purse;
      w.click(PLUS_X + 4, PRESS_Y + 4);
      if (w.purse < before) moved = true;
    }
    assert.ok(moved, `the pointer is stuck with ${w.purse} left`);
  }
  assert.equal(w.purse, 0);
  w.click(OK_X + 4, PRESS_Y + 4);
  assert.equal(w.done, true);
  assert.equal(entity.level, 5);
  assert.equal(entity.readyToLevelUp, false);

  // minus hands a point back
  const w2 = new VirtueLevelUpScreen(
    { ...entity, readyToLevelUp: true, level: 5, stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50])) },
    { settings: S(), rolls: () => 0.5 });
  w2.click(ROW_X + 4, ROW_TOP + 4);
  w2.click(PLUS_X + 4, PRESS_Y + 4);
  const spent = w2.purse;
  w2.click(MINUS_X + 4, PRESS_Y + 4);
  assert.equal(w2.purse, spent + 1, 'the minus button returns the point');

  // the cursor follows the pointer
  w2.hover(ROW_X + 4, ROW_TOP + 5 * ROW_PITCH + 4);
  assert.equal(w2.cursor, 5);
  w2.hover(160, 8);
  assert.equal(w2.cursor, 5, 'a hover off the rows leaves the cursor where it was');
});

test('ORL1 deep audit: the level-up window PAINTS where its hit test looks', () => {
  const entity = {
    level: 4, pendingLevel: 5, readyToLevelUp: true, levelProgress: 100, levelRollUp: 7,
    health: 40, maxHealth: 40, career,
    stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50])),
  };
  for (const [W, H] of [[1400, 900], [1920, 1080], [1366, 768], [1024, 768], [800, 600], [640, 400]]) {
    const m = metricsOf(W, H);
    const r = drawRecorder();
    const w = new VirtueLevelUpScreen(entity, { settings: S(), rolls: () => 0.5 });
    w.refused = true;   // the refusal line paints too
    w.draw(r, canvasOf(W, H), stubFont());
    const glyphs = r.quads.filter((x) => x.tex === 'font');
    assert.ok(glyphs.length > 100, `${W}x${H}: ${glyphs.length} glyphs is not a window`);
    let rows = 0;
    for (const g of glyphs) {
      const vx = (g.x - m.ox) / m.s, vy = (g.y - m.oy) / m.s;
      assert.ok(vx >= 0 && vx <= 320, `${W}x${H}: a glyph at native x ${vx.toFixed(1)} is off the game area`);
      assert.ok(vy >= 0 && vy <= 200, `${W}x${H}: a glyph at native y ${vy.toFixed(1)} is off the game area`);
      if (levelUpHitNative(vx, vy)) rows++;
    }
    assert.ok(rows > 40, `${W}x${H}: only ${rows} painted glyphs are reachable by the pointer`);
  }
});

test('ORL1 deep audit: the window is NEVER A WALL - every reachable state has a legal press', () => {
  // Departure 6's actual promise. A state with points left and no legal
  // PLUS is allowed (the minus button is the way out, and the font-less
  // escape re-plans from scratch for exactly that reason) - but a state
  // with neither would be a level-up a player could not finish and could
  // not leave. Walked exhaustively: a delta vector is reachable iff it
  // opens at most `maxUpdatableAttribute` rows, each within its limit and
  // its headroom, and costs no more than the purse.
  const KEYS = STAT_KEYS_ORDER;
  const scan = (stats, s) => {
    const purse = virtuePurse(stats, s);
    if (purse === 0) return null;
    const room = KEYS.map((k) => Math.max(0, Math.min(attributeIncreaseLimit(k, s), MAX_ATTRIBUTE_VALUE - stats[k])));
    const off = KEYS.map((k) => attributeOffset(k, s));
    const d = Object.fromEntries(KEYS.map((k) => [k, 0]));
    let dead = null;
    const rec = (i, opened, spent) => {
      if (dead) return;
      if (i === KEYS.length) {
        const left = purse - spent;
        if (left > 0
          && !KEYS.some((k) => canRaiseAttribute(k, stats, d, left, s))
          && !KEYS.some((k) => canLowerAttribute(k, d))) dead = { ...d };
        return;
      }
      rec(i + 1, opened, spent);
      if (opened >= s.maxUpdatableAttribute) return;
      for (let v = 1; v <= room[i]; v++) {
        const c = spent + v * off[i];
        if (c > purse) break;
        d[KEYS[i]] = v; rec(i + 1, opened + 1, c);
      }
      d[KEYS[i]] = 0;
    };
    rec(0, 0, 0);
    return dead;
  };
  for (const attributePoints of [1, 3, 12, 25])
    for (const maxUpdatableAttribute of [2, 3, 5])
      for (const allowLuckIncrease of [true, false])
        for (const luckIncreaseCost of [1, 4, 20])
          for (const spread of [
            KEYS.map(() => 50), KEYS.map(() => 98), KEYS.map(() => 99), KEYS.map(() => 100),
            [100, 100, 100, 100, 100, 100, 100, 50], [96, 97, 98, 99, 100, 100, 100, 100],
            [99, 99, 99, 99, 99, 99, 99, 50], [97, 98, 99, 100, 50, 60, 70, 80],
          ]) {
            const s = S({ attributePoints, maxUpdatableAttribute, allowLuckIncrease, luckIncreaseCost });
            const stats = Object.fromEntries(KEYS.map((k, i) => [k, spread[i]]));
            assert.equal(scan(stats, s), null,
              `a wall at ${JSON.stringify({ attributePoints, maxUpdatableAttribute, allowLuckIncrease, luckIncreaseCost, spread })}`);
          }
});

test('ORL1 deep audit: the plan buys the MOST ATTRIBUTE POINTS, not merely the most purse', () => {
  // THE DEFECT THIS HOLDS. `virtueSpendPlan` maximised the COST paid and
  // kept whichever equal-cost plan the table reached first - the fewest
  // rows. A Luck point costs four, so at the shipped defaults a character
  // with every attribute at 50 was planned LUCK +3: three attribute
  // points, where twelve were affordable for the same twelve of purse.
  // The purse was right and the spend was legal; it was worth a quarter
  // of what it should have been. Every headless path spends this plan,
  // the font-less escape among them.
  const KEYS = STAT_KEYS_ORDER;
  const bestPointsAt = (stats, s, cost) => {
    const room = KEYS.map((k) => Math.max(0, Math.min(attributeIncreaseLimit(k, s), MAX_ATTRIBUTE_VALUE - stats[k])));
    const off = KEYS.map((k) => attributeOffset(k, s));
    let best = -1;
    const rec = (i, opened, spent, got) => {
      if (spent === cost) best = Math.max(best, got);
      if (i === KEYS.length || spent > cost) return;
      rec(i + 1, opened, spent, got);
      if (opened >= s.maxUpdatableAttribute) return;
      for (let v = 1; v <= room[i]; v++) {
        const c = spent + v * off[i];
        if (c > cost) break;
        rec(i + 1, opened + 1, c, got + v);
      }
    };
    rec(0, 0, 0, 0);
    return best;
  };
  // the headline case, named, so a reader sees the shape
  const flat = Object.fromEntries(KEYS.map((k) => [k, 50]));
  const headline = virtueSpendPlan(flat, S(), virtuePurse(flat, S()));
  assert.equal(headline.cost, 12);
  assert.equal(KEYS.reduce((n, k) => n + headline.plan[k], 0), 12,
    'twelve of purse must buy twelve attribute points, not three of Luck');

  for (const attributePoints of [1, 3, 12, 25, 60])
    for (const maxUpdatableAttribute of [2, 3, 8])
      for (const allowLuckIncrease of [true, false])
        for (const luckIncreaseCost of [1, 4, 20])
          for (const spread of [
            KEYS.map(() => 50), KEYS.map(() => 80), KEYS.map(() => 98), KEYS.map(() => 100),
            [96, 97, 98, 99, 100, 100, 100, 100], [99, 99, 99, 99, 99, 99, 99, 50],
          ]) {
            const s = S({ attributePoints, maxUpdatableAttribute, allowLuckIncrease, luckIncreaseCost });
            const stats = Object.fromEntries(KEYS.map((k, i) => [k, spread[i]]));
            const { cost, plan } = virtueSpendPlan(stats, s, virtuePurse(stats, s));
            const got = KEYS.reduce((n, k) => n + (plan[k] ?? 0), 0);
            assert.equal(got, bestPointsAt(stats, s, cost),
              `${JSON.stringify({ attributePoints, maxUpdatableAttribute, allowLuckIncrease, luckIncreaseCost, spread })}: `
              + `cost ${cost} bought ${got} points`);
          }
});

test('ORL1 deep audit: each of the question\'s answers has its own key, and the keys disagree', () => {
  // `1` and `2` each answer, and they answer DIFFERENTLY - a branch that
  // answered with the same option either way passed the whole suite,
  // because nothing drove the digits against each other.
  const got = [];
  const one = new LevelingChoiceScreen((id) => got.push(id));
  one.input('char:1');
  const two = new LevelingChoiceScreen((id) => got.push(id));
  two.input('char:2');
  assert.deepEqual(got, [LEVELING_CLASSIC, LEVELING_VIRTUE]);
  assert.notEqual(got[0], got[1], 'the two digits must not answer with the same system');
  // ...and the cursor's answer follows the cursor, both ways
  const c = [];
  const w = new LevelingChoiceScreen((id) => c.push(id));
  w.input('ArrowDown');
  w.input('Enter');
  assert.deepEqual(c, [LEVELING_VIRTUE], 'DOWN then ENTER takes the second option');
});

test('ORL1 deep audit: the longest stat name does not run into a three-digit value', () => {
  // `Intelligence` is exactly twelve characters and the column was twelve
  // wide, so a character with it at 100 read `Intelligence100`.
  const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 100;
  p.stats.personality = 99;
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: () => 0.5 });
  for (const k of STAT_KEYS_ORDER) {
    assert.doesNotMatch(w.rowText(k), /[A-Za-z]\d/, `${k}: the name runs into the value`);
  }
  assert.match(w.rowText('intelligence'), /Intelligence\s+100/);
});

test('ORL1 deep audit: a refusal with no legal plus names the control that still works', () => {
  // The mod's own line sends the player at the plus buttons; in a corner
  // there is no legal plus and the way out is the minus. The author's
  // string is kept and the port's own sentence is added under it.
  const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 99;
  p.stats.luck = 50;
  // Two rows at 99 take one point each and cap; Luck is the only row with
  // room left and opening it would be a third. With Luck priced at one,
  // the purse is minted for three and two of them can be placed.
  const w = new VirtueLevelUpScreen(p, {
    settings: S({ attributePoints: 3, maxUpdatableAttribute: 2, luckIncreaseCost: 1 }),
    rolls: () => 0.5,
  });
  w.raise('personality');
  w.raise('speed');
  assert.ok(w.purse > 0, 'the corner has points left');
  assert.ok(!STAT_KEYS_ORDER.some((k) => w.rowMarkers(k).plus), 'and no plus is legal');
  assert.ok(STAT_KEYS_ORDER.some((k) => w.rowMarkers(k).minus), 'but a minus always is');
  assert.equal(w.confirm(), false);
  assert.equal(w.refused, true);
  // ...and the draw says so
  const r = { quads: [], drawScreenQuad(tex, rect, uv, color) { this.quads.push({ tex, ...rect, color }); } };
  const font = { tex: 'font', fnt: { fixedWidth: 6, fixedHeight: 8, glyphWidth: () => 5 } };
  w.draw(r, { width: 1600, height: 1000 }, font);
  assert.ok(r.quads.length > 100, 'the window painted');
  assert.match(rd('src/ui/virtueLevelUp.js'), /TAKE_ONE_BACK_HINT/);
});

test('ORL1 deep audit: the font-less escape re-plans from SCRATCH, and a partly spent window still closes', () => {
  // THE RECORD THAT WAS WRONG. The escape's mutant - re-planning against
  // the REMAINING purse over the live deltas instead of the full one -
  // was recorded EQUIVALENT because no pin drove the escape from a window
  // a player had already touched. It is not equivalent: the escape
  // assigns the plan WHOLESALE and sets the purse to `fullPurse - cost`,
  // so a re-plan against the remainder leaves the purse non-zero,
  // `confirm` refuses, the window never closes - and
  // dungeonContext.js's font-less arm drops the overlay anyway, losing
  // the level-up with everything already spent in it.
  const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL, pendingLevel: 2 });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
  const level = p.level;
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: () => 0.5 });
  assert.equal(w.purse, 12);
  for (let i = 0; i < 5; i++) w.raise('strength');   // a player mid-spend
  assert.equal(w.purse, 7, 'five points are gone');

  assert.equal(w.spendRemainingHeadless(), true, 'the escape closes a partly spent window');
  assert.equal(w.done, true);
  assert.equal(w.purse, 0, 'and it leaves nothing unspent');
  assert.equal(p.level, level + 1);
  assert.equal(p.readyToLevelUp, false);
  // ...and it spent the WHOLE purse's worth, not the remainder's
  const gained = STAT_KEYS_ORDER.reduce((n, k) => n + (p.stats[k] - 50), 0);
  assert.equal(gained, 12, 'twelve of purse buys twelve points, whatever was pressed first');
});

test('ORL1 deep audit: the records\' count of the mod\'s SIZE is the mod\'s size', () => {
  // The page and the vendor README both quote it, and both have been
  // wrong once already: the first figure was the Lua PLUS the l10n yaml
  // counted as Lua (71 lines over), and the correction used `wc -l`,
  // which under-counts `templates.lua` because that file ends without a
  // newline. Counted here off the files, so neither record can drift.
  const files = ['player', 'helper', 'settings', 'constants', 'templates'];
  const lines = (p) => { const t = rdMod(p); return t === '' ? 0 : t.split('\n').length - (t.endsWith('\n') ? 1 : 0); };
  const lua = files.reduce((n, f) => n + lines(`${MOD}/scripts/${f}.lua`), 0);
  const yaml = ['en', 'fr'].reduce((n, f) => n + lines(`${MOD}/l10n/${f}.yaml`), 0);
  assert.equal(lua, 1314, 'the Lua');
  assert.equal(yaml, 72, 'the l10n yaml, which is NOT Lua and was once counted as it');
  const page = rd('bible/06-Systems/Oblivion-Remaster-Leveling.md');
  const readme = rd(`${MOD}/README.md`);
  for (const [name, text] of [['the page', page], ['the vendor README', readme]]) {
    assert.match(text, new RegExp(`1,3${String(lua).slice(2)} lines of Lua`), `${name} quotes the Lua count`);
    // the CLAIM, not the number: both records name the old figure in a
    // note saying it was wrong, and a note about a mistake is not the
    // mistake.
    assert.doesNotMatch(text, /1,384 lines of Lua and a/, `${name} must not still CLAIM the Lua-plus-yaml figure`);
  }
  assert.match(readme, new RegExp(`${yaml} more of l10n yaml`), 'and the README keeps the two apart');
});

test('ORL1 deep audit: an owed level-up is RE-OFFERED, because the first offer may reach a busy slot', () => {
  // DFU's checkForLevelUp returns true on every pass while a level is
  // owed, and the port's own L-slice note says why: the hosts have ONE
  // overlay slot and worldModes mounts the level-up screen only
  // `if (!interiorOverlay)`. The virtue lane had a
  // `if (entity.readyToLevelUp) return false` guard, so a bar that
  // filled behind a shop window was announced once, into nothing, and
  // never again.
  const p = virtuePlayer();
  p.levelProgress = LEVELUP_TOTAL;
  assert.equal(checkForVirtueLevelUp(p), true, 'the first offer');
  assert.equal(p.readyToLevelUp, true);
  assert.equal(checkForVirtueLevelUp(p), true, 'and the second, because nothing took the first');
  assert.equal(checkForVirtueLevelUp(p), true, 'and every one after it');
  assert.equal(p.pendingLevel, p.level + 1, 'and it still names the level being offered');

  // ...and it STOPS once the level is taken
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: () => 0.5 });
  w.spendRemainingHeadless();
  assert.equal(p.readyToLevelUp, false);
  assert.ok((p.levelProgress ?? 0) < LEVELUP_TOTAL, 'the bar is no longer full');
  assert.equal(checkForVirtueLevelUp(p), false, 'a spent level is not re-offered');

  // ...unless the carry filled the next bar, which is the mod's own rule
  p.levelRollUp = LEVELUP_TOTAL + 5;
  rollOverLevelProgress(p);
  assert.equal(p.levelProgress, LEVELUP_TOTAL);
  assert.equal(checkForVirtueLevelUp(p), true, 'a carry of a whole level offers the next one');

  // and the SAME shape as the lane it sits beside
  const c = virtuePlayer({ levelingSystem: LEVELING_CLASSIC });
  c.startingLevelUpSkillSum = 0;
  c.currentLevelUpSkillSum = 200;
  assert.equal(checkForLevelUp(c), true);
  assert.equal(checkForLevelUp(c), true, 'the classic lane re-offers, which is the law this matches');
});

test('ORL1 deep audit: the `deltas` contract is held where it BINDS, not where it cannot', () => {
  // The pin that claimed this put every stat at 50 - headroom 50, and a
  // plan that opens fewer rows than the budget - so neither cap was ever
  // exercised through `deltas`. Dropping `- taken` from the headroom, or
  // from the per-row limit, survived the whole suite and planned an
  // attribute past 100 or a fourth row open.
  const KEYS = STAT_KEYS_ORDER;
  const legal = (stats, s, deltas, plan) => {
    const already = KEYS.filter((k) => (deltas[k] ?? 0) > 0);
    let fresh = 0;
    for (const k of KEYS) {
      const d = plan[k] ?? 0;
      if (d === 0) continue;
      if (!already.includes(k)) fresh++;
      assert.ok(stats[k] + (deltas[k] ?? 0) + d <= MAX_ATTRIBUTE_VALUE,
        `${k} planned past ${MAX_ATTRIBUTE_VALUE}`);
      assert.ok((deltas[k] ?? 0) + d <= attributeIncreaseLimit(k, s),
        `${k} planned past its own limit`);
    }
    // THE PLAN'S own share of the row budget: the rows the player has
    // already opened are spent, and a spend that has overrun the budget
    // is the caller's problem, not something the plan may make worse.
    assert.ok(fresh <= Math.max(0, s.maxUpdatableAttribute - already.length),
      `the plan opened ${fresh} new rows with ${already.length} of ${s.maxUpdatableAttribute} already open`);
  };
  for (const base of [98, 99, 100, 96])
    for (const taken of [{ strength: 1 }, { strength: 2, speed: 1 }, { luck: 1 }, { strength: 5, speed: 5, luck: 1 }])
      for (const mu of [2, 3])
        for (const lc of [1, 4]) {
          const s = S({ maxUpdatableAttribute: mu, luckIncreaseCost: lc });
          const stats = Object.fromEntries(KEYS.map((k) => [k, base]));
          const deltas = { ...zeroDeltas(), ...taken };
          const { cost, plan } = virtueSpendPlan(stats, s, 12, deltas);
          legal(stats, s, deltas, plan);
          // ...and the cost really is what the plan costs
          const paid = KEYS.reduce((n, k) => n + (plan[k] ?? 0) * attributeOffset(k, s), 0);
          assert.equal(paid, cost, 'the plan pays the cost it reports');
          // ...and every point of it is one the BUTTONS would allow
          const running = { ...deltas };
          let purse = cost;
          for (const k of KEYS) {
            for (let i = 0; i < (plan[k] ?? 0); i++) {
              assert.ok(canRaiseAttribute(k, stats, running, purse, s),
                `the plan raises ${k} where the plus button refuses`);
              running[k] += 1;
              purse -= attributeOffset(k, s);
            }
          }
          assert.equal(purse, 0);
        }
});

test('ORL1 deep audit: the solver\'s table is bounded by the LAW, not by another file\'s slider', () => {
  // It was sized straight off the budget, so a purse of a billion asked
  // for gigabytes and killed the process. Only modSettings' declared max
  // kept that out - and departure 3 records every max in this entry as
  // the PORT'S OWN, with no upstream warrant. A ceiling in another file
  // is not a bound on this function.
  const stats = Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50]));
  const s = S();
  const huge = virtueSpendPlan(stats, s, 1e9);
  const mostRowsCanTake = s.maxUpdatableAttribute * ATTRIBUTE_INCREASE_LIMIT * s.luckIncreaseCost;
  assert.ok(huge.cost <= mostRowsCanTake, `a billion planned ${huge.cost}`);
  assert.equal(huge.cost, virtueSpendPlan(stats, s, mostRowsCanTake).cost,
    'and it plans the same thing an honest ceiling does');
  // a negative budget is nothing, not a RangeError
  assert.equal(virtueSpendPlan(stats, s, -4).cost, 0);
  assert.equal(virtueSpendPlan(stats, s, 0).cost, 0);
});

test('ORL1 deep audit: the window really carries the flag the font-less escape routes on', () => {
  // `isVirtueLevelUp` is one half of a duck-typed seam and only the
  // DUNGEON half was pinned, as a source grep. Setting it false survived
  // the whole suite - and under it the font-less arm falls past every
  // branch and drops a virtue level-up silently, for ever, because the
  // door rebuilds the same window on the next sheet key.
  const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL });
  const w = new VirtueLevelUpScreen(p, { settings: S(), rolls: () => 0.5 });
  assert.equal(w.isVirtueLevelUp, true, 'the flag the dungeon host asks for');
  assert.equal(new LevelUpScreen(virtuePlayer({ readyToLevelUp: true })).isVirtueLevelUp, undefined,
    'and the screen it is told apart FROM does not carry it');
  // ...and the escape it gates really finishes the level-up
  assert.equal(w.spendRemainingHeadless(), true);
  assert.equal(p.readyToLevelUp, false, 'a font-less level-up is applied, not dropped');
});

test('ORL1 deep audit: the char-sheet door is driven, not grepped - a shadowed predicate cannot hide', () => {
  // The fork was held by a regex over charSheetDoor.js's source. Shadowing
  // `usesVirtueLeveling` with a local `() => false` leaves that text
  // byte-for-byte intact and sends every virtue level-up to DFU's own
  // screen, which takes the Level++, the health roll and a 4..6 DFU pool
  // and ignores the purse, the three-row cap and Luck's price entirely.
  // The house already drives this door headlessly (enhancedCharSheet)
  // and asserts on the class it hands back.
  const owed = (over) => virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL, ...over });
  const name = (entity) => createCharSheetWindow({ entity })?.constructor?.name;
  assert.equal(name(owed()), 'VirtueLevelUpScreen', 'a virtue character levels by the mod');
  assert.equal(name(owed({ levelingSystem: LEVELING_CLASSIC })), 'LevelUpScreen',
    'and a Daggerfall character does not');
  assert.equal(name(owed({ oghmaLevelUp: true })), 'LevelUpScreen',
    'and the Oghma is Daggerfall\'s own in both lanes');
  // ...and a character with nothing owed gets neither
  const sheet = name(virtuePlayer({ readyToLevelUp: false }));
  assert.ok(sheet !== 'VirtueLevelUpScreen' && sheet !== 'LevelUpScreen',
    `a character owed nothing was handed ${sheet}`);
});

test('ORL1 deep audit: the WINDOW obeys the settings, not only the law module does', () => {
  // Every `new VirtueLevelUpScreen` in this file passed the shipped
  // defaults, so dropping the settings injection entirely survived the
  // whole suite: headless, `levelingSettings()` mints the same numbers.
  // A player who moves the row cap and Luck's price was running a window
  // whose purse, plus predicate, refund and count label nothing had ever
  // exercised. (ORL1's deep audit.)
  for (const [attributePoints, maxUpdatableAttribute, luckIncreaseCost, allowLuckIncrease] of [
    [20, 5, 7, true], [6, 2, 1, true], [30, 8, 20, true], [12, 3, 4, false], [1, 2, 4, true],
  ]) {
    const s = S({ attributePoints, maxUpdatableAttribute, luckIncreaseCost, allowLuckIncrease });
    const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL });
    for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
    const w = new VirtueLevelUpScreen(p, { settings: s, rolls: () => 0.5 });
    const label = `ap=${attributePoints} mu=${maxUpdatableAttribute} lc=${luckIncreaseCost} luck=${allowLuckIncrease}`;

    // the count label names THIS window's row cap
    assert.match(chooseAttributesLabel(s.maxUpdatableAttribute), new RegExp(`\\b${maxUpdatableAttribute}\\b`), label);
    // the purse is this settings' purse
    assert.equal(w.purse, virtuePurse(p.stats, s), label);
    // Luck is priced by THIS window, in both directions
    const before = w.purse;
    if (w.raise(LUCK)) {
      assert.equal(before - w.purse, allowLuckIncrease ? luckIncreaseCost : 1, `${label}: Luck's price on the way out`);
      assert.ok(w.lower(LUCK));
      assert.equal(w.purse, before, `${label}: and the same on the way back`);
    }
    // the row cap is this window's row cap: open rows until it refuses
    const opened = new Set();
    for (let guard = 0; guard < 64; guard++) {
      const k = STAT_KEYS_ORDER.find((key) => !opened.has(key) && w.raise(key));
      if (!k) break;
      opened.add(k);
    }
    assert.ok(opened.size <= maxUpdatableAttribute, `${label}: ${opened.size} rows opened`);
    // ...and the row text prices Luck the same way the window does
    assert.equal(/\(\d+ per point\)/.test(w.rowText(LUCK)), allowLuckIncrease && luckIncreaseCost > 1, label);
  }
});

test('ORL1 deep audit: the corner hint is shown IN a corner and nowhere else', () => {
  // `if (true)` here - the hint on every refusal, including the ordinary
  // one where the plus buttons work perfectly well - survived the whole
  // campaign, because the condition lived inside the draw.
  const flat = () => {
    const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL });
    for (const k of STAT_KEYS_ORDER) p.stats[k] = 50;
    return p;
  };
  // an ORDINARY refusal: points left, and plenty of rows that will take them
  const w = new VirtueLevelUpScreen(flat(), { settings: S(), rolls: () => 0.5 });
  assert.equal(w.confirm(), false);
  assert.equal(w.refused, true);
  assert.equal(w.cornered(), false, 'a refusal with legal pluses is not a corner');

  // a CORNER: two rows at 99 take one point each and cap, and no third may open
  const p = virtuePlayer({ readyToLevelUp: true, levelProgress: LEVELUP_TOTAL });
  for (const k of STAT_KEYS_ORDER) p.stats[k] = 99;
  p.stats.luck = 50;
  const c = new VirtueLevelUpScreen(p, {
    settings: S({ attributePoints: 3, maxUpdatableAttribute: 2, luckIncreaseCost: 1 }),
    rolls: () => 0.5,
  });
  c.raise('personality');
  c.raise('speed');
  assert.equal(c.cornered(), true);
  assert.ok(STAT_KEYS_ORDER.some((k) => c.rowMarkers(k).minus), 'and the way out is open');
  // ...and a spent purse is not a corner either, whatever the rows say
  const done = new VirtueLevelUpScreen(flat(), { settings: S({ attributePoints: 0 }), rolls: () => 0.5 });
  assert.equal(done.purse, 0);
  assert.equal(done.cornered(), false, 'nothing owed is not a corner');

  // and the draw really asks the predicate
  assert.match(rd('src/ui/virtueLevelUp.js'), /if \(this\.cornered\(\)\) centre\(TAKE_ONE_BACK_HINT/);
});

test('ORL1 deep audit: the divisor the question quotes is DAGGERFALL\'s, not merely its own', () => {
  // `LEVELUP_SKILL_SUM_PER_LEVEL` was held by the blurb that prints it
  // and by `calculatePlayerLevel`, which divides BY it - so changing it
  // to 14 moved both and survived. DFU's arithmetic is the anchor: a
  // character whose level-up sums have not moved is level ONE, and
  // floor(28 / n) is 1 only from 15 to 28.
  assert.equal(LEVELUP_SKILL_SUM_PER_LEVEL, 15);
  assert.equal(calculatePlayerLevel(0, 0), 1, 'a character who has raised nothing is level 1');
  assert.equal(calculatePlayerLevel(0, 2), 2, 'and two points of sum past the start is level 2');
  assert.equal(calculatePlayerLevel(100, 100), 1, 'wherever the starting sum sits');
  assert.equal(calculatePlayerLevel(0, 17), 3);
  // ...and the four-to-six pool is DFU's own pair, not a number typed twice
  assert.equal(LEVELUP_BONUS_POOL_MIN, 4);
  assert.equal(LEVELUP_BONUS_POOL_MAX, 6);
});
