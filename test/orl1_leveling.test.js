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
  commitVirtueLevelUp, spendVirtuePurseLowest, virtueLevelUpHeadless, initVirtueLeveling,
  modVirtuePurse,
} from '../src/systems/oblivionLeveling.js';
import { VirtueLevelUpScreen } from '../src/ui/virtueLevelUp.js';
import { LevelingChoiceScreen, LEVELING_OPTIONS } from '../src/ui/levelingChoice.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED, GROUPS } from '../src/systems/features.js';
import { CREDITS } from '../src/ui/credits.js';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter, hitPointsPerLevelUp, STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { raiseSkills, skillUsesForAdvancement } from '../src/systems/advancement.js';
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

test('ORL1 L1: a skill raise puts its TIER\'s points in the bar (player.lua:36-45)', () => {
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

test('ORL1 L1: the roll-over boundary is STRICTLY past 100 (helper.lua:126)', () => {
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
  assert.equal(checkForVirtueLevelUp(p), false, 'and it does not re-raise an already-owed level');
});

test('ORL1 L2: the roll-over on commit, including the bar that stays FULL (helper.lua:138-148)', () => {
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

test('ORL1 L3: Luck costs more and is capped when the mod may not raise it (player.lua:54-70)', () => {
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

test('ORL1 L3: every purse virtuePurse mints is EXACTLY spendable - the property the clamp exists for', () => {
  // The window refuses to close on an unspent point, so a purse that
  // cannot be spent to zero is a trap. This walks the awkward shapes.
  for (const luckCost of [1, 3, 4, 7]) {
    for (const luck of [50, 90, 96, 99, 100]) {
      for (const rest of [50, 97, 99, 100]) {
        const p = virtuePlayer();
        for (const k of STAT_KEYS_ORDER) p.stats[k] = rest;
        p.stats.luck = luck;
        const s = S({ luckIncreaseCost: luckCost });
        const purse = virtuePurse(p.stats, s);
        const deltas = zeroDeltas();
        assert.equal(spendVirtuePurseLowest(p.stats, deltas, purse, s), 0,
          `luckCost ${luckCost}, luck ${luck}, rest ${rest}: ${purse} left unspendable`);
      }
    }
  }
});

// ── L4: WHAT THE BUTTONS ALLOW ─────────────────────────────────────

test('ORL1 L4: each of the five reasons the PLUS is withheld, one at a time (player.lua:534-565)', () => {
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
  // THE HEALTH RULE IS DAGGERFALL'S, not `Endurance * fLevelUpHealthEndMult`.
  // hitPointsPerLevelUp reads the endurance the level-up just raised,
  // which is the order the Lua commits in too.
  assert.equal(p.maxHealth, hp0 + hitPointsPerLevelUp(career, p.stats.endurance, seq(0)));
  assert.ok(p.maxHealth > hp0);
  assert.equal(p.health, 40, 'the live pool is only ever clamped down');
  assert.equal(p.level, 4, 'ONE level, never a jump');
  assert.equal(p.levelProgress, 5, 'and the roll-over opens the next bar');
  assert.equal(p.levelRollUp, 0);
  assert.equal(p.readyToLevelUp, false);
  assert.equal(p.pendingLevel, null);
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
  while (w.purse > 0) w.input('plus');
  w.input('confirm');
  assert.equal(w.done, true);
  assert.equal(p.level, 3);
  assert.equal(p.stats.strength, 53);
  assert.equal(p.stats.agility, 55);
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

test('ORL1: the new-game question offers Daggerfall FIRST and answers exactly once', () => {
  assert.deepEqual(LEVELING_OPTIONS.map((o) => o.id), [LEVELING_CLASSIC, LEVELING_VIRTUE],
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
  assert.equal(row.note, MOD_SETTINGS[V].keys.Enabled.description, 'the mod\'s own words, one source');
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
    assert.doesNotMatch(code, /nativePanel|loadImg|drawImg|messageBox/, `${f} draws no native art`);
    assert.match(s, /drawScreenQuad/, `${f} is the dim-and-text idiom`);
    assert.match(s, /NATIVE-WINDOW RULE/, `${f} says why it is not a native window`);
  }
});
