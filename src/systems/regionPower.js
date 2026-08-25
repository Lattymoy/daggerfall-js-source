// S43: RegionPowerAndConditionsUpdate's POWER HALF (PlayerEntity.cs
// :1626-1685) - the part that runs on BOTH of DFU's two calls, where
// the conditions half runs only on `updateConditions`.
//
// This is the engine behind every faction's `power`, which the port has
// read for a while and never moved: S41's UpdateRegionalPrices tilts a
// region's prices by The Merchants' power against the region's own, and
// nothing anywhere raised or lowered either. Every faction sat at its
// FACTION.TXT value for the life of the character, so the merchants
// never gained ground on anybody and the price walk's whole tug-of-war
// term was a constant.
//
// The store is systems/regionConditions.js (S42); the CONDITIONS half of
// this member - wars, famines, plagues, crime waves, the new-ruler roll -
// is still unported and needs PersistentFactionData's alliance mutators
// first (GetNumberOfCommonAlliesAndEnemies, EndFactionAllies and their
// siblings), which the port does not have. FLAGGED in the Port-Ledger.

import { dice100 } from '../combat/formulas.js';
import { changePower } from './factionRep.js';
import { FACTION_TYPES } from '../formats/factionFile.js';

/** isFactionValidForRumorMill's thirteen exclusions (:2125-2137).
 *  DFU's own comment: "Classic does not do any check on factions
 *  included in rumor mill. Here we exclude all generic factions and
 *  those which should clearly not be included like Oblivion or The
 *  Septim Empire." So this list is DFU's addition over classic, and it
 *  is a DEVIATION FROM CLASSIC that the port inherits deliberately -
 *  the port is 1:1 with DFU, and DFU says why. */
export const RUMOR_MILL_EXCLUDED = Object.freeze(new Set([
  17,    // Oblivion
  514,   // Children
  844,   // Generic_Knightly_Order
  845,   // Smiths
  846,   // Questers
  847,   // Healers
  848,   // Seneschal
  240,   // Temple_Missionaries
  810,   // Temple_Treasurers
  813,   // Temple_Healers
  811,   // Temple_Blessers
  852,   // Random_Ruler
  350,   // The_Septim_Empire
]));

/** isFactionValidForRumorMill (:2117-2138): a Province, Group or
 *  Subgroup that is not one of the thirteen. */
export function isFactionValidForRumorMill(faction) {
  if (!faction) return false;
  const t = faction.type;
  if (t !== FACTION_TYPES.Province && t !== FACTION_TYPES.Group && t !== FACTION_TYPES.Subgroup) return false;
  return !RUMOR_MILL_EXCLUDED.has(faction.id);
}

/**
 * THE POWER WALK (:1631-1685), verbatim, for one faction.
 *
 *     chance = parentPower/10 + alliesPower/10 + rulerPowerBonus
 *              - enemiesPower/10
 *
 * and a FAILED roll against it costs a point of power while a passed
 * one gains a point. So a faction with powerful friends, a powerful
 * parent and a strong ruler climbs, and one ringed by powerful enemies
 * sinks. Then, separately, a faction any of whose CHILDREN outrank it
 * gains one more point - once, not once per child, because DFU breaks
 * out of that loop on the first hit.
 *
 * Three details that are easy to lose:
 *
 *  - all three /10 divisions are C# integer division on values that
 *    cannot go negative (power is clamped to 1..100 and the sums are of
 *    up to three of them), so Math.trunc and Math.floor agree here -
 *    trunc is used anyway because the C# cast is a truncation and the
 *    next reader should not have to re-derive that it is safe;
 *  - the PARENT lookup discards its success flag (:1664 is
 *    `GetFactionData(parent, out parent)` with no `if`), so a parent id
 *    that is not in the dictionary yields C#'s zero struct and a power
 *    mod of 0 rather than skipping the term. `parent != 0` is the only
 *    gate;
 *  - the CHILDREN comparison reads the faction's power AFTER the +/-1
 *    above has already landed, because DFU re-reads
 *    `factionData.FactionDict[key].power` inside the loop. A child
 *    exactly equal to the pre-change power therefore does or does not
 *    trigger depending on which way that roll went.
 *
 * @returns {number} the net power change applied (-1, +1 or +2)
 */
export function factionPowerStep(dict, faction, rolls = Math.random) {
  const powerOf = (id) => dict.get(id)?.power ?? 0;
  const sumOf = (ids) => ids.reduce((n, id) => n + powerOf(id), 0);

  const alliesPowerMod = Math.trunc(sumOf([faction.ally1, faction.ally2, faction.ally3]) / 10);
  const enemiesPowerMod = Math.trunc(sumOf([faction.enemy1, faction.enemy2, faction.enemy3]) / 10);
  // :1659-1666 - the `parent != 0` gate, and the missing-parent zero.
  const parentPowerMod = faction.parent !== 0 ? Math.trunc(powerOf(faction.parent) / 10) : 0;

  const chance = parentPowerMod + alliesPowerMod + faction.rulerPowerBonus - enemiesPowerMod;
  // Dice100.FailedRoll(chance) is !SuccessRoll(chance); dice100() here
  // IS SuccessRoll, so one roll is drawn either way.
  const store = { dict };
  let delta = 0;
  if (!dice100(chance, rolls())) { changePower(store, faction.id, -1); delta -= 1; }
  else { changePower(store, faction.id, 1); delta += 1; }

  // :1674-1685 - and this reads `power` AFTER the change above.
  if (faction.children) {
    for (const childID of faction.children) {
      const child = dict.get(childID);
      if (child && child.power > faction.power) {
        changePower(store, faction.id, 1); delta += 1;
        break;   // DFU's own break: ONE bonus point, however many children outrank it
      }
    }
  }
  return delta;
}

/**
 * RegionPowerAndConditionsUpdate's power half (:1626-1685), the whole
 * walk. DFU snapshots the key list before iterating
 * (`new List<int>(factionData.FactionDict.Keys)`) because the body can
 * mutate the dictionary; the port does the same with a spread, which
 * also fixes the iteration ORDER for the roll stream - every faction
 * draws exactly one roll, in dictionary order.
 *
 * `RefreshRumorMill()` is DFU's first line (:1630) and rides here, with
 * its own note: classic disables rumor updates while the player is
 * serving jail time and DFU deliberately does not reproduce that.
 *
 * @param {object} store  the faction store ({ dict })
 * @param {object} rumorMill  optional - anything with refreshRumorMill()
 * @returns {{walked: number, changed: number}}
 */
export function regionPowerUpdate(store, { rumorMill = null, rolls = Math.random } = {}) {
  const dict = store?.dict;
  if (!dict) return { walked: 0, changed: 0 };
  rumorMill?.refreshRumorMill?.();
  let walked = 0, changed = 0;
  for (const key of [...dict.keys()]) {
    const faction = dict.get(key);
    if (!isFactionValidForRumorMill(faction)) continue;
    walked++;
    if (factionPowerStep(dict, faction, rolls) !== 0) changed++;
  }
  return { walked, changed };
}
