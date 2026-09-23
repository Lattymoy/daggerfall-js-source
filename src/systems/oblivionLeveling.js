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
//    (helper.lua:272-282). That is not the mod's rule - it is
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

/** constants.lua:56-65 - and `STAT_KEYS_ORDER` already spells all
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

/** settings.lua:10-64 + :66-108, resolved in one object - what the
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

/** helper.lua:24-42 isMajorSkill / isMinorSkill / isMiscSkill, over
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

/** player.lua:39-45 - the tier's points, and the `miscSkillsImpact > 0`
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
 * player.lua:29-51's handler and helper.lua:124-142
 * increaselevelUpProgress, together.
 *
 * Called with the skill id that is ABOUT TO BE RAISED, before the raise
 * lands - OpenMW calls its handler with the value the skill is leaving,
 * and the 0.5.3 guard below reads exactly that value. advancement.js
 * calls it from inside the cap gate, in that position.
 *
 * THE 0.5.3 FIX IS LAW, NOT AN ACCIDENT (the author's changelog:
 * "Infinite Leveling increase and roll over after a skill reach 100"):
 * the handler's whole body sits inside `if MAX_SKILL_VALUE > skillbase`,
 * so a skill standing at 100 feeds the bar nothing. Without it a
 * mastered skill re-raising every check drove the bar forever.
 *
 * THE COMPARISON IS STRICTLY `>` (helper.lua:132). Landing exactly on
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
  // NO `if (entity.readyToLevelUp) return false` GUARD, and the absence
  // is the law. DFU's checkForLevelUp returns true on EVERY pass while a
  // level is owed (advancement.js, the L-slice / AUDIT 23 entity-9 note),
  // because the hosts' one overlay slot may be busy when the first offer
  // arrives - worldModes mounts the level-up screen only
  // `if (!interiorOverlay)`, so a bar that fills behind a shop window is
  // announced into nothing. With the guard the virtue lane offered an
  // owed level ONCE and then went silent for good: measured over six
  // skill passes with the slot busy every time: SIX offers on the classic
  // lane and ONE here, with the character playing on at a full bar and the
  // carry piling up (measured, both lanes, same character). Nothing
  // was lost numerically; the player was simply never told again.
  // (ORL1's deep audit.)
  // THE OGHMA INFINIUM IS NOT THIS SYSTEM'S TO LEVEL, and the guard that
  // used to keep it out went with the one above. The book latches
  // `readyToLevelUp` AND `oghmaLevelUp` together (systems/artifactEffects.js);
  // with a full bar underneath it, the headless arm ran `commitVirtueLevelUp`,
  // which has no Oghma arm - a Level++ and a health roll the book forbids,
  // the mod's purse in place of the book's thirty, and `oghmaLevelUp` left
  // latched true afterwards. `applyLevelUp` gets that state right on the
  // classic side, and `ui/charSheetDoor.js`, `CharSheet._mountStatsRollout`
  // and both of worldModes' last-resort arms all carry this same exclusion.
  // This is the fourth place it belongs. The book is taken first; the bar is
  // still full afterwards, so the level it owes is offered on the next pass.
  // (ORL1's fix review.)
  if (entity.oghmaLevelUp) return false;
  if ((entity.levelProgress ?? 0) < LEVELUP_TOTAL) return false;
  entity.readyToLevelUp = true;
  entity.pendingLevel = entity.level + 1;
  return true;
}

/** helper.lua:144-155 levelUp - the roll-over on commit. A roll-over
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

/** player.lua:53-61 getOffset - what one point of this attribute
 *  COSTS. Luck costs more, and only while the mod is allowed to raise
 *  it by more than one. */
export function attributeOffset(attrKey, s) {
  return (attrKey === LUCK && s.allowLuckIncrease) ? s.luckIncreaseCost : 1;
}

/** player.lua:63-69 getAttributeIncreaseLimit - how far one attribute
 *  may move in one level. Luck is pinned to +1 when the mod is not
 *  allowed to raise it. */
export function attributeIncreaseLimit(attrKey, s) {
  return (attrKey === LUCK && !s.allowLuckIncrease) ? 1 : ATTRIBUTE_INCREASE_LIMIT;
}

/** What this one attribute could absorb, in PURSE POINTS - the inner
 *  loop of calculateAttributepoints (player.lua:647-668). */
function spendableOn(value, attrKey, s) {
  const limit = attributeIncreaseLimit(attrKey, s);
  const offset = attributeOffset(attrKey, s);
  const headroom = MAX_ATTRIBUTE_VALUE - value;
  if (headroom > limit) return limit * offset;
  if (headroom > 0) return headroom * offset;
  return 0;
}

/**
 * player.lua:638-677 calculateAttributepoints - the purse, clamped so
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
 * can spend, and the level-up window becomes a wall. With the mod's own
 * defaults and Luck barred from rising, a character at 98 across the
 * board is minted 12 points that three rows can take only 6 of. The mod
 * has that hole; the port must not ship it.
 *
 * THE FIRST VERSION OF THIS CLAMP WAS ITSELF THE BUG (found by ORL1's
 * adversarial review). It measured "what can be placed" by running a
 * LOWEST-VALUE-FIRST greedy and subtracting what that greedy failed to
 * place - and lowest-first is not a maximising packing under the mod's
 * predicate. At the ceiling the lowest-valued rows are the ones with
 * the least headroom, so the greedy spent the row budget on rows worth
 * one point each and reported the rest unplaceable: eight attributes at
 * 99 minted 11, could legally take 6, and were handed 3. It destroyed
 * virtues a player had every right to spend.
 *
 * So the clamp does not guess. Choosing at most N rows and a delta in
 * each is a bounded knapsack with a row-count constraint, over eight
 * rows, at most five points each and a purse of at most sixty - a state
 * space small enough to solve exactly, every time, in
 * `virtueSpendPlan`. The purse IS a reachable cost, by construction,
 * and the plan that reaches it is what the headless paths spend.
 *
 * The mod's own arithmetic is kept whole and exported as
 * `modVirtuePurse`, so the departure is a line you can read rather
 * than an edit inside a ported function.
 */
export function virtuePurse(stats, s) {
  return virtueSpendPlan(stats, s, modVirtuePurse(stats, s)).cost;
}

/**
 * THE EXACT ANSWER to "what can this character actually spend, and how".
 *
 * Returns `{ cost, plan }`: the largest purse not exceeding `budget`
 * that some legal assignment pays for, and one assignment that pays it.
 * A legal assignment opens at most `maxUpdatableAttribute` rows and
 * gives each a delta inside its own limit and its headroom.
 *
 * `deltas` lets the window ask the same question part-way through a
 * spend: a row the player has ALREADY raised is open, so it costs no
 * new row slot and only its remaining room is on offer.
 *
 * The table is `step[row][slots][cost]` holding the delta taken on that
 * row, or -1 where the state is unreachable, which is what lets the
 * plan be walked back out of it. Sixty is the largest purse the store
 * will mint and five the largest delta, so the whole table is a few
 * hundred bytes and it is rebuilt per level-up rather than cached.
 */
export function virtueSpendPlan(stats, s, budget, deltas = null) {
  const rows = STAT_KEYS_ORDER.map((k) => {
    const taken = deltas?.[k] ?? 0;
    const headroom = MAX_ATTRIBUTE_VALUE - stats[k] - taken;
    return {
      k,
      off: attributeOffset(k, s),
      room: Math.max(0, Math.min(attributeIncreaseLimit(k, s) - taken, headroom)),
      slot: taken > 0 ? 0 : 1,   // an already-open row costs no new slot
    };
  });
  const open = rows.reduce((n, r) => n + (r.slot === 0 ? 1 : 0), 0);
  // THE TABLE IS BOUNDED BY THE LAW, not by another file's slider.
  // These were `Math.max(0, ...)` alone, so the size of the DP came
  // straight off the caller's numbers: a budget of a billion asked for
  // nine Int8Arrays of a billion bytes apiece and the process was
  // OOM-killed. The only thing keeping that out was `modSettings`'
  // declared `max`, which departure 3 records as the PORT'S OWN with no
  // upstream warrant - a ceiling in a different file is not a bound on
  // this one. The most any legal spend can cost is every row at its own
  // limit, so nothing above that is reachable and nothing above that is
  // allocated. (ORL1's deep audit.)
  const slots = Math.min(rows.length, Math.max(0, (s.maxUpdatableAttribute | 0) - open));
  const reachable = rows.reduce((n, r) => n + r.room * r.off, 0);
  const B = Math.min(reachable, Math.max(0, budget | 0));

  // THE DP CARRIES TWO NUMBERS, AND THE SECOND ONE IS THE POINT OF IT.
  //
  // `best[n][c]` is the most ATTRIBUTE POINTS any legal assignment of the
  // rows seen so far can buy for exactly `c` of purse across `n` new rows
  // (-1 = unreachable); `take[n][c]` is the delta that row took to get
  // there, for the walk back.
  //
  // Maximising the cost alone is not enough, and the deep audit caught the
  // port shipping exactly that: a Luck point costs `luckIncreaseCost`, so
  // twelve of purse buys Luck +3 OR twelve ordinary points, and both pay
  // the same twelve. The first version kept whichever the DP reached
  // first, which was the fewest-rows one - at the shipped defaults a
  // character with every attribute at 50 was handed LUCK +3 and nothing
  // else. The purse was right and the spend was legal; it was just worth a
  // quarter of what the same purse could buy. The player at the window
  // never saw it (they press their own buttons), but every headless path
  // spends this plan, including the font-less escape a real player hits.
  const mk = () => Array.from({ length: slots + 1 }, () => new Int16Array(B + 1).fill(-1));
  let best = mk();
  best[0][0] = 0;
  const trail = [];
  for (const row of rows) {
    const nb = mk(), nt = mk();
    for (let n = 0; n <= slots; n++) {
      for (let c = 0; c <= B; c++) {
        const have = best[n][c];
        if (have < 0) continue;
        if (have > nb[n][c]) { nb[n][c] = have; nt[n][c] = 0; }   // leave this row alone
        const n2 = n + row.slot;
        if (n2 > slots) continue;
        for (let d = 1; d <= row.room; d++) {
          const cc = c + d * row.off;
          if (cc > B) break;
          if (have + d > nb[n2][cc]) { nb[n2][cc] = have + d; nt[n2][cc] = d; }
        }
      }
    }
    trail.push(nt);
    best = nb;
  }

  // The purse is the largest cost anything reaches; among the row counts
  // that reach it, the one that buys the most points.
  let cost = 0, usedSlots = 0;
  for (let c = B; c >= 0; c--) {
    let n = -1, pts = -1;
    for (let i = 0; i <= slots; i++) if (best[i][c] > pts) { pts = best[i][c]; n = i; }
    if (n >= 0 && pts >= 0) { cost = c; usedSlots = n; break; }
  }

  const plan = Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 0]));
  let c = cost, n = usedSlots;
  for (let i = rows.length - 1; i >= 0; i--) {
    const d = trail[i][n][c];
    if (d > 0) { plan[rows[i].k] = d; c -= d * rows[i].off; n -= rows[i].slot; }
  }
  return { cost, plan };
}

/**
 * player.lua:592-619 refreshAttributePoints, as a question rather than
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

/** player.lua:612-616 - minus is shown exactly while this row has
 *  something to give back. */
export function canLowerAttribute(attrKey, deltas) {
  return (deltas[attrKey] ?? 0) > 0;
}

// ── the commit ─────────────────────────────────────────────────────

/**
 * player.lua:532-552 validateLevelUp, with Daggerfall's health rule in
 * place of Morrowind's (see the header's point 2).
 *
 * The purse must read ZERO. The Lua refuses with
 * `remaining_points_error` and leaves the window open; the caller does
 * the same, and this returns false rather than half-committing.
 *
 * THE ORDER IS DAGGERFALL'S, NOT THE LUA'S, AND THAT IS DELIBERATE
 * (ORL1's adversarial review caught the first version claiming
 * otherwise). The mod calls `increaseHealth` AFTER its attribute loop,
 * so Morrowind's `Endurance * fLevelUpHealthEndMult` reads the
 * Endurance the player has just bought. But the port's health rule is
 * DAGGERFALL'S - departure 2 - and `advancement.applyLevelUp` rolls hit
 * points BEFORE it distributes the pool, on the endurance the character
 * had going in ("PERMANENT endurance, verbatim", audit F8). Taking the
 * mod's ORDER with Daggerfall's FORMULA would be half of each: a virtue
 * character who spent five points on Endurance would collect the hit
 * points for them in the same breath, and out-earn the identical
 * character on the Daggerfall path. So the roll comes first here too,
 * and the two lanes hand the same character the same hit points.
 */
export function commitVirtueLevelUp(entity, deltas, purse, s, rolls = Math.random) {
  if (!entity.readyToLevelUp) return false;
  if (purse !== 0) return false;
  // Daggerfall's hit-points-per-level, not Morrowind's
  // Endurance * fLevelUpHealthEndMult - the header's point 2 - and so
  // in Daggerfall's position, BEFORE the attributes land, reading the
  // endurance the character came in with.
  entity.maxHealth = (entity.rawMaxHealth ?? entity.maxHealth) + hitPointsPerLevelUp(entity.career, entity.stats.endurance, rolls);   // DISC10-E L4: onto the RAW maximum, never through the lycanthrope's limiter
  entity.health = Math.min(entity.health, entity.maxHealth);
  for (const key of STAT_KEYS_ORDER) {
    const d = deltas[key] ?? 0;
    if (d > 0) entity.stats[key] = entity.stats[key] + d;
  }
  entity.level += 1;
  rollOverLevelProgress(entity);
  entity.readyToLevelUp = false;
  entity.pendingLevel = null;
  return true;
}

/** raiseSkills' no-host arm under the mod's law: mint the purse, take
 *  the plan that pays for it, commit. The DFU twin is the
 *  `spendPoolLowest` call beside it in advancement.js - which cannot be
 *  reused here, because it has no cap at all (a known hazard of that
 *  function) and no notion of an attribute costing more than a point. */
export function virtueLevelUpHeadless(entity, s, rolls = Math.random) {
  const { plan } = virtueSpendPlan(entity.stats, s, modVirtuePurse(entity.stats, s));
  // The plan pays for exactly the purse `virtuePurse` would have handed
  // out, so there is nothing left over - which is what the commit asks.
  return commitVirtueLevelUp(entity, plan, 0, s, rolls);
}

/** The bar a character starts a new game on. Called once, beside
 *  finishChargen's level-up anchor, so the two systems' starting state
 *  is set in the same breath. */
export function initVirtueLeveling(entity, system) {
  entity.levelingSystem = system;
  entity.levelProgress = 0;
  entity.levelRollUp = 0;
}
