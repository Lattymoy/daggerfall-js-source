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
// this member - the alliance and rivalry churn, the wars, the famines,
// plagues, persecuted temples, crime waves and witch burnings, and the
// new-ruler roll - is the `if (updateConditions)` body at :1697-2110 and
// runs here too, off PersistentFactionData's relation mutators
// (systems/factionRelations.js) and the condition store. It waited on
// both; both exist.

import { dice100 } from '../combat/formulas.js';
import { changePower, getFlag, FACTION_FLAGS, THE_DARK_BROTHERHOOD, THE_THIEVES_GUILD } from './factionRep.js';
import { FACTION_TYPES } from '../formats/factionFile.js';
import { REGION_TEMPLES } from '../formats/mapsFile.js';
import { MERCHANTS_FACTION_ID } from './guilds.js';               // FactionIDs.The_Merchants, one home
import { findFactionByTypeAndRegion } from './talk.js';           // PersistentFactionData.FindFactionByTypeAndRegion
import {
  getNumberOfCommonAlliesAndEnemies, endFactionAllies, endFactionEnemies,
  startFactionAllies, startFactionEnemies, isEnemyStatePermanentUntilWarOver,
  isFaction2AnAllyOfFaction1, isFaction2AnEnemyOfFaction1, getFaction2RelationToFaction1,
  isFaction2APotentialWarEnemyOfFaction1, setNewRulerData,
} from './factionRelations.js';
import {
  REGION_FLAGS, turnOnConditionFlag, turnOffConditionFlag, resetWarDataForRegion,
  conditionFlag, conditionGroupFlag,
} from './regionConditions.js';

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

/** C#'s ZERO FactionData STRUCT. Several lookups in the conditions body
 *  discard GetFactionData's bool (`FactionData.GetFactionData(x, out y);`
 *  with no `if` - :1974, :2029, :2035, :2046) and then read the struct
 *  anyway, so a miss reads id 0 / power 0 rather than skipping the arm.
 *  That is load-bearing: the `temple.id != 0` and `witches.id != 0`
 *  guards below exist precisely because the miss is silent. */
const ZERO_FACTION = Object.freeze({
  id: 0, power: 0, region: -1, type: FACTION_TYPES.None, parent: 0, rulerPowerBonus: 0,
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
});

/** The seven rumors the update always re-seeds (:2112-2118). */
export const ALWAYS_AVAILABLE_RUMORS = Object.freeze([1450, 1451, 1452, 1453, 1454, 1455, 1456]);

/** The ally/enemy slots and the allies' summed power, snapshotted at the
 *  TOP of the loop body (:1637-1651) - C# reads them once, before the
 *  power roll, and the conditions body works off that snapshot and
 *  re-reads the slots by hand where DFU refreshes them. */
function alliesEnemiesSnapshot(dict, faction) {
  const allies = [faction.ally1, faction.ally2, faction.ally3];
  const enemies = [faction.enemy1, faction.enemy2, faction.enemy3];
  let alliesPower = 0;
  for (let i = 0; i < 3; i++) alliesPower += dict.get(allies[i])?.power ?? 0;
  return { allies, enemies, alliesPower };
}

/**
 * The do-while that picks a partner for a new alliance or rivalry
 * (:1738-1747, :2000-2009), bug and all.
 *
 * `keys2.Remove(keys[randomKeyIndex])` removes from keys2 the value it
 * read out of the OUTER key list, not `keys2[randomKeyIndex]` - the two
 * lists start identical and diverge the moment one removal lands, so
 * after the first miss the walk starts removing the wrong entries (and
 * sometimes nothing at all). `count` decrements every pass regardless,
 * which is what keeps the index in range. DFU's, kept.
 */
function pickPartnerFaction(dict, keys, rolls) {
  const keys2 = [...keys];
  let count = keys2.length;
  let random = ZERO_FACTION;
  do {
    const randomKeyIndex = Math.floor(rolls() * count);
    const at = dict.get(keys2[randomKeyIndex]);
    random = (at ? dict.get(at.id) : null) ?? ZERO_FACTION;
    const removeAt = keys2.indexOf(keys[randomKeyIndex]);   // List<int>.Remove(value)
    if (removeAt >= 0) keys2.splice(removeAt, 1);
    count--;
  } while (!isFactionValidForRumorMill(random) && count > 0);
  return random;
}

/**
 * THE CONDITIONS HALF (:1697-2110), verbatim, for one faction - the
 * `if (updateConditions)` body that runs only on the 38-day cadence.
 *
 * In DFU order: end alliances, end rivalries, start one alliance, fight
 * the war, start one rivalry (and, between neighbours, a war), roll a
 * new ruler, then the province-only conditions - famine, plague,
 * persecuted temple, crime wave, witch burnings - and finally the
 * merchant/underworld power tallies.
 *
 * Four DFU details that read like typos and are not:
 *
 *  - `allies` and `enemies` are REFRESHED by hand after every arm that
 *    can change them (:1707-1710 and three more), because the arms
 *    below index the stale copy otherwise;
 *  - the new-alliance and new-rivalry loops `break` at the FIRST empty
 *    slot whether or not anything came of it, so a faction gains at
 *    most one of each per update;
 *  - the war arm's `combinedPower = -powerLoss` (:1840) is an
 *    assignment, not a `-=`, so the winner test that follows runs on a
 *    number that is not the side's power at all; and ChangePower is
 *    handed the loss as a POSITIVE amount (:1836-1837), so both sides
 *    GAIN power from the battle;
 *  - `numberOf*` are declared INSIDE the per-faction loop (:2065-2069),
 *    so they can only ever reach 1 and the `>= 3` merchant arms below
 *    them are unreachable. Classic presumably counted across regions.
 *
 * @param {Map} dict     the faction dictionary
 * @param {object} faction  the live record (already power-stepped)
 * @param {number[]} keys   the snapshotted key list the walk iterates
 * @param {object} snapshot alliesEnemiesSnapshot's answer
 * @returns {boolean} false when there is no region store to write to
 */
export function factionConditionsStep(dict, faction, keys, { allies, enemies, alliesPower }, {
  regionConditions = null, rumorMill = null, rolls = Math.random,
} = {}) {
  // DFU's regionData is a field of the same entity as factionData
  // (PlayerEntity.cs:99), so the two are never apart; the port's store
  // is minted at chargen (chargenSession.js) and restored by save.js. A
  // host holding factions without it has no region record to flip, and
  // the whole body is a no-op rather than a throw.
  if (!regionConditions) return false;
  const store = { dict };
  const rumor = (f1, f2, regionID, type, textId) => rumorMill?.addNonQuestRumor?.(f1, f2, regionID, type, textId);
  const powerOf = (id) => dict.get(id)?.power ?? 0;
  const factionPowerMod = Math.trunc(faction.power / 5);
  // The three arms that roll on it all recompute the same sum inline.
  const powerSum = () => factionPowerMod + faction.rulerPowerBonus;
  const common = (id) => getNumberOfCommonAlliesAndEnemies(dict, faction.id, id);
  const refreshAllies = () => { allies[0] = faction.ally1; allies[1] = faction.ally2; allies[2] = faction.ally3; };
  const refreshEnemies = () => { enemies[0] = faction.enemy1; enemies[1] = faction.enemy2; enemies[2] = faction.enemy3; };

  // :1697-1706 - chance to END an alliance, per filled slot. A FAILED
  // roll against a chance that starts at 70 ends it, so the odds are
  // deliberately long.
  for (let i = 0; i < 3; i++) {
    if (allies[i] !== 0) {
      if (!dice100(Math.trunc((powerSum() + common(allies[i]) * 3) / 5) + 70, rolls())) {
        endFactionAllies(dict, faction.id, allies[i]);
        rumor(faction.id, allies[i], -1, 100, 1402);   // End faction allies
      }
    }
  }
  refreshAllies();   // :1708-1711

  // :1713-1727 - chance to END a rivalry, but never one held open by a
  // war between neighbours (IsEnemyStatePermanentUntilWarOver).
  for (let i = 0; i < 3; i++) {
    const enemy = dict.get(enemies[i]) ?? null;
    if (enemy && !isEnemyStatePermanentUntilWarOver(faction, enemy)) {
      if (dice100(Math.trunc((powerSum() + common(enemies[i]) * 3) / 5), rolls())) {
        endFactionEnemies(dict, faction.id, enemies[i]);
        rumor(faction.id, enemies[i], -1, 100, 1403);   // End faction enemies
      }
    }
  }
  refreshEnemies();   // :1729-1732

  // :1734-1774 - chance to START one alliance, in the first empty slot.
  for (let i = 0; i < 3; i++) {
    if (allies[i] === 0) {
      const random = pickPartnerFaction(dict, keys, rolls);
      if (!isFaction2AnAllyOfFaction1(dict, faction.id, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.id, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.ally1, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.ally2, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.ally3, random.id)
        && !isFaction2AnAllyOfFaction1(dict, faction.enemy1, random.id)
        && !isFaction2AnAllyOfFaction1(dict, faction.enemy2, random.id)
        && !isFaction2AnAllyOfFaction1(dict, faction.enemy3, random.id)
        && getFaction2RelationToFaction1(dict, faction.id, random.id) === -1) {
        if (dice100(Math.trunc((powerSum() + common(random.id) * 3) / 5), rolls())) {
          if (faction.type === FACTION_TYPES.Province && faction.region !== -1) rumor(faction.id, random.id, faction.region, 26, 1481);
          if (random.type === FACTION_TYPES.Province && random.region !== -1) rumor(random.id, faction.id, random.region, 26, 1481);
          startFactionAllies(dict, faction.id, i, random.id);
          rumor(faction.id, random.id, -1, 100, 1400);   // Factions start alliance
        }
      }
      break;   // DFU's own break: the FIRST empty slot, and no more
    }
  }
  refreshAllies();   // :1776-1779

  // :1781-1789 - the war enemy is the FIRST enemy slot that is a
  // bordering province; the else-ifs stop at the first hit.
  let warEnemyID = 0;
  if (isFaction2APotentialWarEnemyOfFaction1(dict, faction.id, faction.enemy1)) warEnemyID = faction.enemy1;
  else if (isFaction2APotentialWarEnemyOfFaction1(dict, faction.id, faction.enemy2)) warEnemyID = faction.enemy2;
  else if (isFaction2APotentialWarEnemyOfFaction1(dict, faction.id, faction.enemy3)) warEnemyID = faction.enemy3;

  if (warEnemyID !== 0) {
    const warEnemy = dict.get(warEnemyID) ?? null;
    if (warEnemy) {
      // A potential war enemy is a Province with a real region, so
      // `faction.region` indexes the store safely here (:1795).
      const region = faction.region;
      if (conditionFlag(regionConditions, region, REGION_FLAGS.WarWon)
        || conditionFlag(regionConditions, region, REGION_FLAGS.WarLost)) {
        // :1797-1801 - the war is decided; clear both sides and part.
        resetWarDataForRegion(regionConditions, faction, FACTION_TYPES.Province);
        resetWarDataForRegion(regionConditions, warEnemy, FACTION_TYPES.Province);
        endFactionEnemies(dict, faction.id, warEnemyID);
      } else if (conditionFlag(regionConditions, region, REGION_FLAGS.WarBeginning)) {
        // :1803-1809 - and the TurnOnConditionFlag line is written
        // twice, on the same region, verbatim. The second call re-rolls
        // WarOngoing's duration and draws a second roll.
        rumor(faction.id, warEnemyID, region, 0, 1479);
        rumor(warEnemyID, faction.id, warEnemy.region, 0, 1479);
        turnOnConditionFlag(regionConditions, region, REGION_FLAGS.WarOngoing, rolls);
        turnOnConditionFlag(regionConditions, region, REGION_FLAGS.WarOngoing, rolls);
      } else if (conditionFlag(regionConditions, region, REGION_FLAGS.WarOngoing)) {
        if (!dice100(5, rolls())) {
          // :1815-1861 - a battle. 95% of updates fight one; the other
          // 5% put the war down (the else below).
          let combinedPower = faction.power + Math.trunc(alliesPower / 5);
          let warEnemyAlliesPower = 0;
          for (const id of [warEnemy.ally1, warEnemy.ally2, warEnemy.ally3]) warEnemyAlliesPower += powerOf(id);
          let combinedEnemyPower = warEnemy.power + Math.trunc(warEnemyAlliesPower / 5);

          // Random.Range(1, x/10 + 1): power is clamped to 1..100 so the
          // exclusive bound is never below the inclusive one, and
          // Range(1, 1) is 1 - which this expression already answers.
          const powerLoss = 1 + Math.floor(rolls() * Math.trunc(combinedEnemyPower / 10));
          const enemyPowerLoss = 1 + Math.floor(rolls() * Math.trunc(combinedPower / 10));

          // Both losses are handed to ChangePower as GAINS (:1836-1837).
          changePower(store, faction.id, powerLoss);
          changePower(store, warEnemy.id, enemyPowerLoss);

          combinedPower = -powerLoss;              // DFU's `=`, not `-=`
          combinedEnemyPower -= enemyPowerLoss;

          if (combinedPower - combinedEnemyPower > combinedEnemyPower) {
            rumor(faction.id, warEnemy.id, -1, 100, 1408);   // War over
            changePower(store, faction.id, Math.trunc(warEnemy.power / 2));
            turnOnConditionFlag(regionConditions, warEnemy.region, REGION_FLAGS.WarLost, rolls);
            turnOnConditionFlag(regionConditions, region, REGION_FLAGS.WarWon, rolls);
          } else if (combinedEnemyPower - combinedPower > combinedPower) {
            rumor(warEnemy.id, faction.id, -1, 100, 1408);   // War over
            changePower(store, warEnemy.id, Math.trunc(faction.power / 2));
            turnOnConditionFlag(regionConditions, warEnemy.region, REGION_FLAGS.WarWon, rolls);
            turnOnConditionFlag(regionConditions, region, REGION_FLAGS.WarLost, rolls);
          } else {
            rumor(faction.id, warEnemy.id, -1, 100, 1407);   // War started/ongoing
          }
        } else {
          turnOffConditionFlag(regionConditions, region, REGION_FLAGS.WarOngoing);
          turnOffConditionFlag(regionConditions, warEnemy.region, REGION_FLAGS.WarOngoing);
        }
      }
    }
  }
  refreshEnemies();   // :1866-1869

  // :1871-1935 - chance to START one rivalry, and between two bordering
  // provinces that rivalry IS a war beginning.
  for (let i = 0; i < 3; i++) {
    if (enemies[i] === 0) {
      const random = pickPartnerFaction(dict, keys, rolls);
      if (!isFaction2AnAllyOfFaction1(dict, faction.id, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.id, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.ally1, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.ally2, random.id)
        && !isFaction2AnEnemyOfFaction1(dict, faction.ally3, random.id)
        && !isFaction2AnAllyOfFaction1(dict, faction.enemy1, random.id)
        && !isFaction2AnAllyOfFaction1(dict, faction.enemy2, random.id)
        && !isFaction2AnAllyOfFaction1(dict, faction.enemy3, random.id)) {
        const relation = getFaction2RelationToFaction1(dict, faction.id, random.id);
        // Unrelated, or sharing an ancestor - and a shared ancestor is
        // TEN POINTS more likely to fall out (:1897-1899).
        if (relation === -1 || relation === 2) {
          const mod = relation === 2 ? 10 : 0;
          if (!dice100(mod + Math.trunc((powerSum() + common(random.id) * 3) / 5) + 70, rolls())) {
            if (faction.region !== -1 && faction.type === FACTION_TYPES.Province) rumor(faction.id, random.id, faction.region, 27, 1482);
            if (random.region !== -1 && random.type === FACTION_TYPES.Province) rumor(random.id, faction.id, random.region, 27, 1482);
            startFactionEnemies(dict, faction.id, i, random.id);
            rumor(faction.id, random.id, -1, 100, 1401);   // Faction rivalry started
            if (faction.region !== -1 && faction.type === FACTION_TYPES.Province
              && random.region !== -1 && random.type === FACTION_TYPES.Province
              && isEnemyStatePermanentUntilWarOver(faction, random)) {
              rumor(faction.id, random.id, -1, 100, 1407);                  // War started/ongoing
              rumor(faction.id, random.id, faction.region, 28, 1479);       // War started sign message
              rumor(random.id, faction.id, random.region, 28, 1479);
              turnOnConditionFlag(regionConditions, faction.region, REGION_FLAGS.WarBeginning, rolls);
              turnOnConditionFlag(regionConditions, random.region, REGION_FLAGS.WarBeginning, rolls);
            }
          }
        }
      }
      break;   // as above: the FIRST empty slot only
    }
  }

  // :1937-1949 - chance for a NEW RULER, unless the faction's record
  // carries RulerImmune. C# reads the flag off the dictionary KEY, which
  // is the faction id.
  if (!getFlag(store, faction.id, FACTION_FLAGS.RulerImmune)) {
    const mod = Math.trunc(faction.rulerPowerBonus / 3);
    if (!dice100(mod + 70, rolls())) {
      if (faction.region !== -1 && faction.type === FACTION_TYPES.Province) rumor(faction.id, 0, -1, 12, 1480);   // New ruler
      setNewRulerData(dict, faction.id);
    }
  }

  // :1951-2063 - "Handle other conditions", PROVINCES ONLY.
  if (faction.region !== -1 && faction.type === FACTION_TYPES.Province) {
    const region = faction.region;
    // :1954-1962 - alliesPower is RECOMPUTED here off the refreshed
    // slots, so the alliances this update started or ended count.
    let ap = 0;
    for (let i = 0; i < 3; i++) ap += powerOf(allies[i]);
    const alliesPowerMod = Math.trunc(ap / 10);

    // Famine (:1964-1984). The three-state walk runs one step per
    // update: Ending clears, Ongoing may end, Beginning becomes
    // Ongoing, and an unafflicted region has a 2% chance to start one -
    // gated a second time on a FAILED roll against the ruler's strength,
    // so a strong ruler with strong allies keeps famine away.
    if (conditionFlag(regionConditions, region, REGION_FLAGS.FamineEnding)) {
      turnOffConditionFlag(regionConditions, region, REGION_FLAGS.FamineEnding);
    } else if (conditionFlag(regionConditions, region, REGION_FLAGS.FamineOngoing)) {
      if (dice100(Math.trunc(faction.rulerPowerBonus / 5) + alliesPowerMod + Math.trunc(faction.power / 5), rolls())) {
        turnOnConditionFlag(regionConditions, region, REGION_FLAGS.FamineEnding, rolls);
        rumor(faction.id, 0, region, 7, 1477);   // Famine sign message
      }
    } else if (conditionFlag(regionConditions, region, REGION_FLAGS.FamineBeginning)) {
      turnOnConditionFlag(regionConditions, region, REGION_FLAGS.FamineOngoing, rolls);
      rumor(faction.id, 0, region, 7, 1477);
    } else if (dice100(2, rolls()) && !dice100(faction.rulerPowerBonus + alliesPowerMod, rolls())) {
      turnOnConditionFlag(regionConditions, region, REGION_FLAGS.FamineBeginning, rolls);
      rumor(faction.id, 0, region, 7, 1477);
    }

    // Plague (:1986-2020). Same three-state walk, and every live arm
    // costs the region's TEMPLE and the province a point of power.
    const temple = dict.get(REGION_TEMPLES[region]) ?? ZERO_FACTION;
    if (conditionFlag(regionConditions, region, REGION_FLAGS.PlagueEnding)) {
      turnOffConditionFlag(regionConditions, region, REGION_FLAGS.PlagueEnding);
    } else if (conditionFlag(regionConditions, region, REGION_FLAGS.PlagueOngoing)) {
      if (temple.id !== 0) changePower(store, temple.id, -1);
      changePower(store, faction.id, -1);
      if (dice100(Math.trunc(faction.power / 5) + Math.trunc(faction.rulerPowerBonus / 5) + alliesPowerMod, rolls())) {
        turnOnConditionFlag(regionConditions, region, REGION_FLAGS.PlagueEnding, rolls);
        rumor(faction.id, 0, region, 4, 1478);   // Plague sign message
      }
    } else if (conditionFlag(regionConditions, region, REGION_FLAGS.PlagueBeginning)) {
      if (temple.id !== 0) changePower(store, temple.id, -1);
      changePower(store, faction.id, -1);
      rumor(faction.id, 0, region, 4, 1478);
      turnOnConditionFlag(regionConditions, region, REGION_FLAGS.PlagueOngoing, rolls);
    } else if (dice100(2, rolls()) && !dice100(faction.rulerPowerBonus + alliesPowerMod, rolls())) {
      if (temple.id !== 0) changePower(store, temple.id, -1);
      changePower(store, faction.id, -1);
      rumor(faction.id, 0, region, 4, 1478);
      turnOnConditionFlag(regionConditions, region, REGION_FLAGS.PlagueBeginning, rolls);
    }

    // Persecuted temple (:2022-2036). The gate is on the TABLE entry,
    // not on the lookup - a region whose RegionTemples slot is 0 skips
    // the whole arm, and one whose temple faction is simply missing
    // still runs it against the zero struct.
    if (REGION_TEMPLES[region] !== 0) {
      if (!dice100(Math.trunc((temple.power - faction.power + 5) / 5), rolls())) {
        turnOffConditionFlag(regionConditions, region, REGION_FLAGS.PersecutedTemple);
      } else if (temple.power >= 2 * faction.power) {
        turnOffConditionFlag(regionConditions, region, REGION_FLAGS.PersecutedTemple);
      } else {
        regionConditions[region].idOfPersecutedTemple = temple.id & 0xFFFF;   // (ushort)
        turnOnConditionFlag(regionConditions, region, REGION_FLAGS.PersecutedTemple, rolls);
        changePower(store, temple.id, -1);
        rumor(faction.id, 0, region, 18, 1476);   // Persecuted temple sign message
      }
    }

    // Crime wave (:2038-2054). A standing wave costs the province a
    // point BEFORE the roll, and a wave that survives the roll costs it
    // a second one.
    if (conditionFlag(regionConditions, region, REGION_FLAGS.CrimeWave)) changePower(store, faction.id, -1);
    const thievesGuild = dict.get(THE_THIEVES_GUILD) ?? ZERO_FACTION;
    const darkBrotherhood = dict.get(THE_DARK_BROTHERHOOD) ?? ZERO_FACTION;
    if (!dice100(Math.trunc((Math.trunc((thievesGuild.power + darkBrotherhood.power) / 2) - faction.power + 5) / 5), rolls())) {
      turnOffConditionFlag(regionConditions, region, REGION_FLAGS.CrimeWave);
    } else {
      turnOnConditionFlag(regionConditions, region, REGION_FLAGS.CrimeWave, rolls);
      changePower(store, faction.id, -1);
      rumor(0, 0, region, 11, 1410);   // Crime wave
    }

    // Witch burnings (:2056-2062). ChangePower is called on the coven
    // BEFORE the `witches.id != 0` guard, so a region with no coven
    // still bills the zero id - a no-op, and DFU's.
    const witches = findFactionByTypeAndRegion(dict, FACTION_TYPES.WitchesCoven, region) ?? ZERO_FACTION;
    if (conditionFlag(regionConditions, region, REGION_FLAGS.WitchBurnings)) changePower(store, witches.id, -1);
    if (witches.id !== 0) {
      if (!dice100(Math.trunc((witches.power - faction.power + 5) / 5), rolls())) {
        turnOffConditionFlag(regionConditions, region, REGION_FLAGS.WitchBurnings);
      } else {
        turnOnConditionFlag(regionConditions, region, REGION_FLAGS.WitchBurnings, rolls);
        changePower(store, witches.id, -1);
        rumor(faction.id, 0, region, 10, 1475);   // Witch burnings sign message
      }
    }
  }

  // :2065-2110 - the tally. See the header: these are per-faction, so
  // they never reach 3 and only the crime-wave arm can move anything.
  let numberOfCrimeWaves = 0;
  let numberOfPricesHigh = 0;
  let numberOfPricesLow = 0;
  let numberOfFamines = 0;
  let numberOfWars = 0;
  if (faction.region !== -1 && faction.type === FACTION_TYPES.Province) {
    const region = faction.region;
    if (conditionFlag(regionConditions, region, REGION_FLAGS.CrimeWave)) numberOfCrimeWaves++;
    if (conditionFlag(regionConditions, region, REGION_FLAGS.PricesHigh)) numberOfPricesHigh++;
    if (conditionFlag(regionConditions, region, REGION_FLAGS.PricesLow)) numberOfPricesLow++;
    if (conditionGroupFlag(regionConditions, region, 2)) numberOfFamines++;   // the famine GROUP
    if (conditionGroupFlag(regionConditions, region, 0)) numberOfWars++;      // the war GROUP
  }
  changePower(store, (dict.get(THE_THIEVES_GUILD) ?? ZERO_FACTION).id, numberOfCrimeWaves);
  changePower(store, (dict.get(THE_DARK_BROTHERHOOD) ?? ZERO_FACTION).id, numberOfCrimeWaves);
  const merchants = dict.get(MERCHANTS_FACTION_ID) ?? ZERO_FACTION;
  if (numberOfPricesHigh >= 3) changePower(store, merchants.id, 1);
  if (numberOfPricesLow >= 3) changePower(store, merchants.id, -1);
  if (numberOfFamines >= 3) changePower(store, merchants.id, -1);
  if (numberOfWars >= 3) changePower(store, merchants.id, 1);
  return true;
}

/**
 * RegionPowerAndConditionsUpdate (:1626-2120) WHOLE - the power half on
 * every call, the conditions half only when `updateConditions`, exactly
 * as DFU's one bool splits it. DFU snapshots the key list before
 * iterating (`new List<int>(factionData.FactionDict.Keys)`) because the
 * body can mutate the dictionary; the port does the same with a spread,
 * which also fixes the iteration ORDER for the roll stream - and the
 * conditions body's partner draw reads that same snapshot, which is
 * where its `keys`/`keys2` quirk lives.
 *
 * `RefreshRumorMill()` is DFU's first line (:1630) and rides here, with
 * its own note: classic disables rumor updates while the player is
 * serving jail time and DFU deliberately does not reproduce that. The
 * seven always-available rumors at the tail (:2112-2118) are the
 * conditions half's too.
 *
 * @param {object} store  the faction store ({ dict })
 * @param {object} rumorMill  optional - anything with refreshRumorMill()
 *   and addNonQuestRumor()
 * @param {boolean} updateConditions  DFU's own parameter: false on the
 *   7-day cadence, true on the 38-day one
 * @param {Array} regionConditions  the S42 region store, required by the
 *   conditions half and ignored by the power half
 * @returns {{walked: number, changed: number}}
 */
export function regionPowerUpdate(store, {
  rumorMill = null, rolls = Math.random, updateConditions = false, regionConditions = null,
} = {}) {
  const dict = store?.dict;
  if (!dict) return { walked: 0, changed: 0 };
  rumorMill?.refreshRumorMill?.();
  const keys = [...dict.keys()];
  let walked = 0, changed = 0;
  for (const key of keys) {
    const faction = dict.get(key);
    if (!isFactionValidForRumorMill(faction)) continue;
    walked++;
    // :1637-1651 - the slots and the allies' power are read BEFORE the
    // power roll, and the conditions body works off that reading.
    const snapshot = alliesEnemiesSnapshot(dict, faction);
    if (factionPowerStep(dict, faction, rolls) !== 0) changed++;
    if (updateConditions) {
      factionConditionsStep(dict, faction, keys, snapshot, { regionConditions, rumorMill, rolls });
    }
  }
  // :2112-2118 - outside the faction walk, once per conditions update.
  if (updateConditions) {
    for (const textId of ALWAYS_AVAILABLE_RUMORS) rumorMill?.addNonQuestRumor?.(0, 0, -1, 100, textId);
  }
  return { walked, changed };
}
