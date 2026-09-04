// R1: THE REPAIR SERVICE - verbatim from DFU
// FormulaHelper.CalculateItemRepairCost/CalculateItemRepairTime
// (:1901-1933), ItemRepairData.cs whole, and DaggerfallTradeWindow's
// Repair mode (the scheduler at :514-568, the gates at :808-818, the
// collection laws at :601-612/:705-728) - MIT, Daggerfall Workshop.
//
// CLOCK SUBSTITUTION (recorded: THE PORT'S CLOCK IS A SCALAR, Ledger A,
// by name): DFU's repair data runs on WORLD SECONDS
// (DaggerfallDateTime.ToSeconds). The
// port's one clock is the CLASSIC MINUTE (worldTick.worldMinutes), so
// every time here is minutes - `damage * MinutesPerDay / 1000` where
// DFU has `damage * SecondsPerDay / 1000`, identical at the clock's
// own granularity (the sub-minute remainder DFU keeps is below what a
// minute clock can observe).
//
// WHERE IN-REPAIR ITEMS LIVE: DFU moves them into
// PlayerEntity.OtherItems (the trade window's remoteItems in Repair
// mode, :392) and each shop shows only its own via
// IsBeingRepairedHere. The port's `entity.otherItems` array is that
// collection; the binding is the BUILDING KEY where DFU binds by the
// interior scene name (:63 - the port's buildingKey is the same
// identity, already minted per interior).
//
// THE RECORD: `item.repairData = { buildingKey, timeStarted,
// repairTime }` exists ONLY while the item is being repaired -
// exactly ItemRepairData.GetSaveData's null-unless-active shape
// (:95-106), so the quicksave's plain-JSON item spread carries it
// with no schema work. EstimatedRepairTime is NOT stored (DFU's DTO
// omits it too) - estimates recompute per refresh.

import { calculateCost } from './shopStock.js';
import { templateByIndex } from './itemTemplates.js';
import { isEnchantedItem } from './enchantments.js';
import { MINUTES_PER_DAY } from './gameDate.js';

/** CalculateItemRepairCost (:1901-1922): free at full condition; ten
 *  percent of the item's base value floored at 1, through the shop's
 *  CalculateCost (quality + regional adjustment), then the guild
 *  discount hook (guild.ReducedRepairCost - the Fighters Guild's
 *  rank scaling; every other guild returns the price unchanged).
 *  NOTE the condition/max pair gates the zero alone - DFU's repair
 *  price does NOT scale with how damaged the item is. */
export function calculateItemRepairCost(baseItemValue, shopQuality, condition, max, { reducedRepairCost = null, priceAdjustment = 1000 } = {}) {
  if (condition === max) return 0;
  let cost = Math.trunc(10 * baseItemValue / 100);
  if (cost < 1) cost = 1;
  cost = calculateCost(cost, shopQuality, priceAdjustment);
  return reducedRepairCost ? reducedRepairCost(cost) : cost;
}

/** CalculateItemRepairTime (:1924-1933): 1000 condition points per
 *  day, floored at one full day - in classic MINUTES (see the clock
 *  substitution above). */
export function calculateItemRepairTime(condition, max) {
  const damage = max - condition;
  const repairTime = Math.trunc(damage * MINUTES_PER_DAY / 1000);
  return Math.max(repairTime, MINUTES_PER_DAY);
}

// ---- ItemRepairData's state machine over the plain record ----------

export const isBeingRepaired = (item) => item?.repairData != null;
export const isBeingRepairedAt = (item, buildingKey) => isBeingRepaired(item) && item.repairData.buildingKey === buildingKey;
export const repairTimeDone = (item) => (item.repairData?.timeStarted ?? 0) + (item.repairData?.repairTime ?? 0);
export const isRepairFinished = (item, nowMinutes) => isBeingRepaired(item) && repairTimeDone(item) <= nowMinutes;

/** LeaveForRepair (:59-67): idempotent - an item already in repair
 *  keeps its stamp. */
export function leaveForRepair(item, buildingKey, repairTime, nowMinutes) {
  if (isBeingRepaired(item)) return;
  item.repairData = { buildingKey, timeStarted: nowMinutes, repairTime };
}

/** Collect (:69-76): the record leaves whole (the port's absent
 *  record IS DFU's timeStarted = 0 sentinel). */
export function collectRepaired(item) { delete item.repairData; }

/** DaysUntilRepaired's shape (:78-93): ceil of the time left in
 *  days - the label's "%d days" number. */
export const daysUntil = (timeMinutes, nowMinutes) => Math.ceil((timeMinutes - nowMinutes) / MINUTES_PER_DAY);

// ---- the entry gates (LocalItemListScroller_OnItemClick :808-818) --

/** The three refusals in DFU's order; null = repairable now.
 *  'magic' speaks TEXT.RSC 33 (magicItemsCannotBeRepairedTextId),
 *  'notRepairable' the localized cannotBeRepaired line,
 *  'undamaged' TEXT.RSC 24 (doesNotNeedToBeRepairedTextId). */
export const MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID = 33;
export const DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID = 24;
export const CANNOT_BE_REPAIRED_TEXT = 'This cannot be repaired.';   // Internal_Strings.csv:974 (key cannotBeRepaired), verbatim
/** ConfirmInterruptRepairBox's line (DaggerfallTradeWindow.cs:845-848
 *  hands GetLocalizedText("interruptRepair") straight to the box, so
 *  the row IS the string: Internal_Strings.csv:819, verbatim - and
 *  note its sense, Yes = take the item back. Both the native Repair
 *  window and the keyed flow speak this one constant. */
export const INTERRUPT_REPAIR_TEXT = "Take back that item before it's repaired?";
export function repairRefusal(item, { allowMagicRepairs = false } = {}) {
  if (isEnchantedItem(item) && !allowMagicRepairs) return 'magic';
  if (templateByIndex(item.templateIndex)?.isNotRepairable) return 'notRepairable';
  if ((item.currentCondition ?? 0) === (item.maxCondition ?? 0)) return 'undamaged';
  return null;
}

// ---- the scheduler (UpdateRepairTimes :514-568) --------------------

/**
 * The repair-time pass over the shop's offered set, DFU's exact
 * shape: per-item times from CalculateItemRepairTime; the single
 * LONGEST job is stretched to longest + (total - longest)/2 (the
 * queue simulation, :552); a job already committed NEVER gets
 * shorter (:561-567, the forum-cited law). commit=true stamps
 * repairData (LeaveForRepair + RepairTime); commit=false answers
 * estimates without touching the records. InstantRepairs skips the
 * whole pass (:516). Returns Map(item -> minutes) of the pass's
 * answer for every unfinished item.
 */
export function updateRepairTimes(items, { commit = false, nowMinutes = 0, buildingKey = 0, instantRepairs = false } = {}) {
  const out = new Map();
  if (instantRepairs) return out;
  let totalRepairTime = 0, longestRepairTime = 0;
  let itemLongestTime = null;
  const previous = new Map();
  for (const item of items) {
    const repairDone = isBeingRepaired(item) ? isRepairFinished(item, nowMinutes) : item.currentCondition === item.maxCondition;
    if (repairDone) continue;
    if (isBeingRepaired(item)) previous.set(item, item.repairData.repairTime);
    const repairTime = calculateItemRepairTime(item.currentCondition, item.maxCondition);
    if (commit && !isBeingRepaired(item)) leaveForRepair(item, buildingKey, repairTime, nowMinutes);
    totalRepairTime += repairTime;
    if (repairTime > longestRepairTime) { longestRepairTime = repairTime; itemLongestTime = item; }
    if (commit) item.repairData.repairTime = repairTime;
    out.set(item, repairTime);
  }
  if (itemLongestTime) {
    const modifiedLongestTime = longestRepairTime + Math.trunc((totalRepairTime - longestRepairTime) / 2);
    if (commit) itemLongestTime.repairData.repairTime = modifiedLongestTime;
    out.set(itemLongestTime, modifiedLongestTime);
  }
  for (const [item, prev] of previous) {
    const clamped = Math.max(out.get(item) ?? prev, prev);
    if (commit) item.repairData.repairTime = clamped;
    out.set(item, clamped);
  }
  return out;
}

/** FilterRemoteItems' repair arm (:705-728) over entity.otherItems:
 *  the shop lists only jobs it holds ITSELF, and a FINISHED job's
 *  condition restores to max right in the filter pass, DFU's own
 *  side effect. */
export function repairJobsAt(entity, buildingKey, nowMinutes) {
  const out = [];
  for (const item of entity.otherItems ?? []) {
    if (!isBeingRepaired(item) || isBeingRepairedAt(item, buildingKey)) out.push(item);
    if (isRepairFinished(item, nowMinutes)) item.currentCondition = item.maxCondition;
  }
  return out;
}

/** The label half (RepairItemLabelTextHandler :282-288): 'done' or
 *  the estimated days out. estimate = the scheduler's answer for the
 *  item (or its committed time). */
export function repairStatusLabel(item, nowMinutes, estimateMinutes = null) {
  const repairDone = isBeingRepaired(item) ? isRepairFinished(item, nowMinutes) : item.currentCondition === item.maxCondition;
  if (repairDone) return 'DONE';   // Internal_Strings.csv:817 (key repairDone), verbatim
  const doneAt = isBeingRepaired(item)
    ? repairTimeDone(item)
    : nowMinutes + (estimateMinutes ?? calculateItemRepairTime(item.currentCondition, item.maxCondition));
  return `${daysUntil(doneAt, nowMinutes)} days`;   // key repairDays ("%d")
}
