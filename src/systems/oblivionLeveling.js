// ORL1 (2026-09-17, Mac: "So I've been analyzing morrowind mods to
// integrate and the first one I'd like to add is this. On new game, I
// want the player to receive a notification on which leveling system
// they would like to use") - OBLIVION-REMASTER-LIKE LEVELING 0.5.3,
// ported 1:1 from the author's own Lua (vendor/oblivion-remaster-leveling/).
//
// THE FIRST MORROWIND MOD IN THIS TREE. Every other vendored mod is a
// Daggerfall Unity mod read off a `.dfmod`; this one is OpenMW Lua, so
// the port is read off the shipped source line for line and every
// function below names the Lua member and line it restates.
//
// WHAT THE MOD IS. Morrowind levels you by counting ten major/minor
// skill raises; the mod replaces that with a POINT BAR - every skill
// raise puts points in, and at 100 you level. The level-up screen then
// stops handing out Morrowind's multiplier-driven attribute gains and
// hands you a PURSE OF VIRTUES to spend where you like, which is what
// Oblivion Remastered does. The whole data layer is one GMST in a
// 487-byte `.omwaddon`: `iLevelupTotal = 100`, which is LEVELUP_TOTAL
// below.
//
// ── THE TWO SYSTEMS LIVE SIDE BY SIDE, PER CHARACTER ───────────────
// `entity.levelingSystem` is the character's own answer, taken once at
// chargen (systems/chargenSession.js) and carried by the save. A save
// written before this slice has no field, so `usesVirtueLeveling`
// reads it as CLASSIC - the port's own Daggerfall law - and nothing
// about an existing character changes. advancement.js keeps DFU's
// arithmetic byte for byte and simply asks this module first.
//
// ── WHAT MORROWIND HAS THAT DAGGERFALL DOES NOT ───────────────────
// Three of the mod's laws have no Daggerfall twin, and each is
// recorded here rather than guessed at (the page carries the long
// form):
//
// 1. SKILL TIERS. Morrowind has Major(5)/Minor(5)/Misc; Daggerfall has
//    Primary(3)/Major(3)/Minor(6)/Misc. The port keeps the mod's three
//    numbers on the tiers whose COUNTS match - Daggerfall's primary and
//    major together are six skills where Morrowind's major is five, and
//    Daggerfall's minor is six where Morrowind's minor is five - so
//    primary and major both default to the mod's 8, minor to its 6 and
//    misc to its 2. `primarySkillsImpact` is the port's own fourth knob
//    so a player who wants their primaries to outrun their majors can
//    say so; the mod has no such key because Morrowind has no such tier.
//
// 2. HEALTH. The mod raises health by `Endurance * fLevelUpHealthEndMult`
//    (helper.lua:275-283). That is not the mod's rule - it is
//    MORROWIND'S OWN engine rule, which the mod has to restate because
//    it took over the level-up dialog. Daggerfall's own rule is
//    FormulaHelper's hit-points-per-level roll, which this port already
//    carries verbatim, so the VIRTUE PATH RAISES HEALTH THE DAGGERFALL
//    WAY (chargen.hitPointsPerLevelUp). Porting Morrowind's constant
//    into Daggerfall would be importing the wrong game's engine.
//
// 3. WHEN YOU LEVEL. Morrowind makes you sleep; the mod rides that.
//    Daggerfall levels you at the character sheet the moment the skill
//    check raises the flag, and this port already does (advancement.js
//    RaiseSkills' tail). The bar therefore sets the SAME
//    `readyToLevelUp` flag the DFU path sets, and the same hosts open
//    the same door.
//
// Everything else is the mod's, and is pinned against the Lua in
// test/orl1_leveling.test.js.

import { modSetting } from './modSettings.js';
import { STAT_KEYS_ORDER, hitPointsPerLevelUp } from './chargen.js';

/** The vendor key - the registry row, the Mods pane and the store. */
export const ORL_VENDOR = 'oblivion-remaster-leveling';

/** `iLevelupTotal`, and the whole of the mod's data layer: the single
 *  GMST record in OblivionRemasterLikeLeveling.omwaddon (INTV 0x64). */
export const LEVELUP_TOTAL = 100;

/** constants.lua:9 ATRIBUTE_INCREASE_LIMIT - the mod's own spelling. */
export const ATTRIBUTE_INCREASE_LIMIT = 5;

/** constants.lua:7-8. Both are 100, and both are the port's own cap
 *  already (statMods.MAX_STAT_VALUE, advancement's skill ceiling), so
 *  the mod asks for nothing new here. */
export const MAX_ATTRIBUTE_VALUE = 100;
export const MAX_SKILL_VALUE = 100;

/** constants.lua:47-54 - and `STAT_KEYS_ORDER` already spells all
 *  eight the same way. The mod's ATRIBUTES table is that list in
 *  Morrowind's display order; the port draws Daggerfall's order, which
 *  is STAT_KEYS_ORDER's. */
export const LUCK = 'luck';

/** The character's answer, taken once at chargen. */
export const LEVELING_CLASSIC = 'classic';
export const LEVELING_VIRTUE = 'virtue';

// ── the settings ───────────────────────────────────────────────────
// The mod's seven keys plus `Enabled` (the port's, as every vendored
// mod carries one) plus `primarySkillsImpact` (the port's, for
// Daggerfall's third tier). `r` is a test's own reader, the same seam
// systems/unleveledLoot.js uses - a pin must never have to write the
// player's store to state a law.
const read = (k, r = null) => (r ? r(k) : modSetting(ORL_VENDOR, k));

/** Is the mod switched on at all? While it is off no character is ever
 *  asked the question and every character levels the Daggerfall way. */
export const oblivionLevelingEnabled = (r = null) => !!read('Enabled', r);

/** settings.lua:20-66 + :71-107, resolved in one object - what the
 *  mod's two `storage.playerSection` handles read. */
export function levelingSettings(r = null) {
  return Object.freeze({
    attributePoints: read('attributePoints', r) | 0,
    maxUpdatableAttribute: read('maxUpdatableAttribute', r) | 0,
    allowLuckIncrease: !!read('allowLuckIncrease', r),
    luckIncreaseCost: read('luckIncreaseCost', r) | 0,
    primarySkillsImpact: read('primarySkillsImpact', r) | 0,
    majorSkillsImpact: read('majorSkillsImpact', r) | 0,
    minorSkillsImpact: read('minorSkillsImpact', r) | 0,
    miscSkillsImpact: read('miscSkillsImpact', r) | 0,
  });
}

/** THE ONE READER of the character's answer. A save written before
 *  this slice carries no field and reads as classic, which is the
 *  port's own law and the safe side of the fork. */
export function usesVirtueLeveling(entity) {
  return entity?.levelingSystem === LEVELING_VIRTUE;
}

// ── the skill tiers ────────────────────────────────────────────────

/** helper.lua:23-42 isMajorSkill / isMinorSkill / isMiscSkill, over
 *  Daggerfall's four tiers instead of Morrowind's three. Misc is the
 *  DERIVED set, exactly as the Lua derives it: every skill the career
 *  did not name. */
export function skillTier(entity, skillId) {
  const c = entity?.career;
  if (!c) return 'misc';
  if (c.primarySkills?.includes(skillId)) return 'primary';
  if (c.majorSkills?.includes(skillId)) return 'major';
  if (c.minorSkills?.includes(skillId)) return 'minor';
  return 'misc';
}

/** player.lua:36-45 - the tier's points, and the `miscSkillsImpact > 0`
 *  gate the Lua writes as an `elseif` (a misc skill with its impact set
 *  to 0 contributes NOTHING, which is also what 0 points would do; the
 *  gate is kept because it is the mod's shape). */
export function skillImpact(tier, s) {
  if (tier === 'primary') return s.primarySkillsImpact;
  if (tier === 'major') return s.majorSkillsImpact;
  if (tier === 'minor') return s.minorSkillsImpact;
  return s.miscSkillsImpact > 0 ? s.miscSkillsImpact : 0;
}

// ── the bar ────────────────────────────────────────────────────────

/**
 * player.lua:28-50's handler and helper.lua:118-136
 * increaselevelUpProgress, together.
 *
 * Called with the skill id that has JUST been raised, after the raise.
 *
 * THE 0.5.3 FIX IS LAW, NOT AN ACCIDENT (the author's changelog:
 * "Infinite Leveling increase and roll over after a skill reach 100"):
 * the handler's whole body sits inside `if MAX_SKILL_VALUE > skillbase`,
 * so a skill standing at 100 feeds the bar nothing. Without it a
 * mastered skill re-raising every check drove the bar forever.
 *
 * THE COMPARISON IS STRICTLY `>` (helper.lua:126). Landing exactly on
 * 100 rolls nothing over; only passing it does.
 *
 * Returns the points actually added to the bar (what the Lua hands
 * back as `options.levelUpProgress`), so a pin can read the split
 * without reaching into the entity.
 */
export function addSkillProgress(entity, skillId, s) {
  if (!(MAX_SKILL_VALUE > (entity.skills?.[skillId] ?? 0))) return 0;
  const value = skillImpact(skillTier(entity, skillId), s);
  if (value <= 0) return 0;
  const progress = entity.levelProgress ?? 0;
  const newProgress = progress + value;
  let added = value;
  if (newProgress > LEVELUP_TOTAL) {
    const rollUp = newProgress - LEVELUP_TOTAL;
    added = value - rollUp;
    entity.levelRollUp = (entity.levelRollUp ?? 0) + rollUp;
  }
  entity.levelProgress = progress + added;
  return added;
}

/** The virtue system's CheckForLevelUp: the bar is full. Sets the same
 *  `readyToLevelUp` flag the DFU path sets, so every host's existing
 *  onLevelUp door opens on it unchanged. */
export function checkForVirtueLevelUp(entity) {
  if (entity.readyToLevelUp) return false;
  if ((entity.levelProgress ?? 0) < LEVELUP_TOTAL) return false;
  entity.readyToLevelUp = true;
  entity.pendingLevel = entity.level + 1;
  return true;
}

/** helper.lua:138-148 levelUp - the roll-over on commit. A roll-over
 *  big enough to fill the next bar leaves it FULL (progress = 100),
 *  which is what immediately re-offers the next level. */
export function rollOverLevelProgress(entity) {
  const rollUp = entity.levelRollUp ?? 0;
  if (rollUp >= LEVELUP_TOTAL) {
    entity.levelProgress = LEVELUP_TOTAL;
    entity.levelRollUp = rollUp - LEVELUP_TOTAL;
  } else {
    entity.levelProgress = rollUp;
    entity.levelRollUp = 0;
  }
}

// ── the purse ──────────────────────────────────────────────────────

/** player.lua:54-62 getOffset - what one point of this attribute
 *  COSTS. Luck costs more, and only while the mod is allowed to raise
 *  it by more than one. */
export function attributeOffset(attrKey, s) {
  return (attrKey === LUCK && s.allowLuckIncrease) ? s.luckIncreaseCost : 1;
}

/** player.lua:64-70 getAttributeIncreaseLimit - how far one attribute
 *  may move in one level. Luck is pinned to +1 when the mod is not
 *  allowed to raise it. */
export function attributeIncreaseLimit(attrKey, s) {
  return (attrKey === LUCK && !s.allowLuckIncrease) ? 1 : ATTRIBUTE_INCREASE_LIMIT;
}

/** What this one attribute could absorb, in PURSE POINTS - the inner
 *  loop of calculateAttributepoints (player.lua:606-620). */
function spendableOn(value, attrKey, s) {
  const limit = attributeIncreaseLimit(attrKey, s);
  const offset = attributeOffset(attrKey, s);
  const headroom = MAX_ATTRIBUTE_VALUE - value;
  if (headroom > limit) return limit * offset;
  if (headroom > 0) return headroom * offset;
  return 0;
}

/**
 * player.lua:596-633 calculateAttributepoints - the purse, clamped so
 * that it is always exactly spendable.
 *
 * Two clamps, and the second is the subtle one. If the character
 * cannot absorb the whole purse at all, the purse shrinks to what they
 * can absorb. Otherwise, any part of the purse that could ONLY go into
 * Luck is rounded DOWN to a whole multiple of Luck's cost - because a
 * remainder smaller than one Luck point could never be spent, and the
 * window refuses to close until the purse reads zero.
 */
export function modVirtuePurse(stats, s) {
  let purse = s.attributePoints;
  let total = 0;
  let luckSpendable = 0;
  for (const key of STAT_KEYS_ORDER) {
    const spendable = spendableOn(stats[key], key, s);
    if (key === LUCK) luckSpendable = spendable;
    total += spendable;
  }
  if (total < purse) return total;
  const luckOffset = attributeOffset(LUCK, s);
  const others = total - luckSpendable;
  if (purse > others) purse = others + Math.floor((purse - others) / luckOffset) * luckOffset;
  return purse;
}

/**
 * THE PURSE THE PORT HANDS OUT - the mod's clamp, and then one more
 * the mod does not have.
 *
 * DEPARTURE, AND IT IS A SOFT-LOCK FIX. `calculateAttributepoints`
 * sums what all EIGHT attributes could absorb and never looks at
 * `maxUpdatableAttribute` - but the window will only let three of them
 * be raised, and it refuses to close on an unspent point. So a
 * late-game character can be handed a purse no legal set of three rows
 * can spend, and the level-up window becomes a wall: seven attributes
 * at 97 and Luck at 50 leaves three rows able to take 11 of the 12
 * points. The mod has that hole too; the port must not ship it.
 *
 * The second clamp is therefore "what the spend can actually place",
 * measured by running the headless policy on a scratch copy - which is
 * exact rather than another formula that could disagree with the
 * predicate. A player is never worse off than the headless path,
 * because they can always make the same choices it makes.
 *
 * The mod's own arithmetic is kept whole and exported as
 * `modVirtuePurse`, so the departure is a line you can read rather
 * than an edit inside a ported function.
 */
export function virtuePurse(stats, s) {
  const minted = modVirtuePurse(stats, s);
  const scratch = Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 0]));
  return minted - spendVirtuePurseLowest(stats, scratch, minted, s);
}

/**
 * player.lua:534-565 refreshAttributePoints, as a question rather than
 * a redraw: may this row's PLUS be pressed?
 *
 * `deltas` is the whole row set, so the "at most N attributes" law can
 * be read off it. The Lua HIDES the button rather than disabling it;
 * the port's window does the same, and this is the predicate both use.
 */
export function canRaiseAttribute(attrKey, stats, deltas, purse, s) {
  const delta = deltas[attrKey] ?? 0;
  if (purse === 0) return false;
  if (purse - attributeOffset(attrKey, s) < 0) return false;
  if (delta === attributeIncreaseLimit(attrKey, s)) return false;
  if (stats[attrKey] + delta === MAX_ATTRIBUTE_VALUE) return false;
  const raised = STAT_KEYS_ORDER.reduce((n, k) => n + ((deltas[k] ?? 0) > 0 ? 1 : 0), 0);
  if (s.maxUpdatableAttribute <= raised && delta === 0) return false;
  return true;
}

/** player.lua:568-572 - minus is shown exactly while this row has
 *  something to give back. */
export function canLowerAttribute(attrKey, deltas) {
  return (deltas[attrKey] ?? 0) > 0;
}

// ── the commit ─────────────────────────────────────────────────────

/**
 * player.lua:462-483 validateLevelUp, with Daggerfall's health rule in
 * place of Morrowind's (see the header's point 2).
 *
 * The purse must read ZERO. The Lua refuses with
 * `remaining_points_error` and leaves the window open; the caller does
 * the same, and this returns false rather than half-committing.
 *
 * ORDER IS THE LUA'S: the attributes land, then health, then the level
 * and the roll-over. Health reads the endurance the level-up just
 * raised - `increaseHealth` is called AFTER the attribute loop
 * (player.lua:472-474), and Daggerfall's own formula reads endurance
 * the same way, so the order carries across unchanged.
 */
export function commitVirtueLevelUp(entity, deltas, purse, s, rolls = Math.random) {
  if (!entity.readyToLevelUp) return false;
  if (purse !== 0) return false;
  for (const key of STAT_KEYS_ORDER) {
    const d = deltas[key] ?? 0;
    if (d > 0) entity.stats[key] = entity.stats[key] + d;
  }
  // Daggerfall's hit-points-per-level, not Morrowind's
  // Endurance * fLevelUpHealthEndMult - the header's point 2.
  entity.maxHealth += hitPointsPerLevelUp(entity.career, entity.stats.endurance, rolls);
  entity.health = Math.min(entity.health, entity.maxHealth);
  entity.level += 1;
  rollOverLevelProgress(entity);
  entity.readyToLevelUp = false;
  entity.pendingLevel = null;
  return true;
}

/**
 * THE HEADLESS SPEND, and the ONE home for it - the window's font-less
 * escape (ui/virtueLevelUp.js) and raiseSkills' no-host arm both call
 * this rather than keeping a policy each.
 *
 * It is chargen.spendPoolLowest's policy (one point at a time into the
 * lowest eligible value) run through the MOD'S predicate, so a
 * headless level-up cannot put an attribute somewhere the window would
 * have refused to. `spendPoolLowest` itself cannot be reused: it has no
 * cap at all (a known hazard of that function) and no notion of an
 * attribute costing more than one point.
 *
 * Terminates: every pass either spends - and an offset is at least 1,
 * so the purse strictly falls - or finds no legal row and stops.
 * Returns the purse that is left, which is 0 for any purse
 * `virtuePurse` minted.
 */
export function spendVirtuePurseLowest(stats, deltas, purse, s) {
  let left = purse;
  for (;;) {
    let low = null;
    for (const k of STAT_KEYS_ORDER) {
      if (!canRaiseAttribute(k, stats, deltas, left, s)) continue;
      if (low === null || stats[k] + (deltas[k] ?? 0) < stats[low] + (deltas[low] ?? 0)) low = k;
    }
    if (low === null) return left;
    deltas[low] = (deltas[low] ?? 0) + 1;
    left -= attributeOffset(low, s);
  }
}

/** raiseSkills' no-host arm under the mod's law: mint the purse, spend
 *  it lowest-first, commit. The DFU twin is the `spendPoolLowest` call
 *  beside it in advancement.js. */
export function virtueLevelUpHeadless(entity, s, rolls = Math.random) {
  const deltas = Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 0]));
  const purse = virtuePurse(entity.stats, s);
  const left = spendVirtuePurseLowest(entity.stats, deltas, purse, s);
  return commitVirtueLevelUp(entity, deltas, left, s, rolls);
}

/** The bar a character starts a new game on. Called once, beside
 *  finishChargen's level-up anchor, so the two systems' starting state
 *  is set in the same breath. */
export function initVirtueLeveling(entity, system) {
  entity.levelingSystem = system;
  entity.levelProgress = 0;
  entity.levelRollUp = 0;
}
