// @ts-check
// WAGONS4 (2026-10-11, the owner: "Wagons have durability and require upkeep to keep from breaking down and becoming
// unusable.") - WAGON UPKEEP (bible/06-Systems/Wagon-Upkeep.md). The law, pure: a wagon's soundness, what wears it,
// and what it costs to mend. The wagon's durability is the condition every
// wagon has always carried (DFU's Small Cart, template 93: 1400 of 1400 - itemTemplates.js mintCondition), so a wagon
// owned before WAGONS4 is a sound one, and the item card's Condition and a sale's condition price (RRI's
// conditionCostBase) were already reading it. Its VALUE never falls (systems/item/itemLaw.js holds a marked wagon to its
// kind's floor): wear is its condition alone.
//
//  - WEAR: by the kilometre it rolls - on a road WEAR_A_KM of its condition, off one OFFROAD times that, and a load more
//    (LOAD_WEAR at full); a bigger wagon is built heavier and wears slower (KIND_WEAR). A journey on the travel map it
//    goes on wears it by the day (JOURNEY_WEAR_A_DAY, JOURNEY_WEAR_MAX a journey at most). The watch carrying it off
//    (scenes/wagonWarden.js) knocks THROWN_WEAR off. No wear takes it under WEAR_FLOOR.
//  - SOUNDNESS (WAGON_STATES): Sound, Worn, Rickety (its pace 0.85), Failing (0.7) - and no lower. WAGON-MEND (2026-10-12,
//    the owner: "wagons shouldnt entirely break down to become unusable"): WAGONS4's Broken, at nought, which no team
//    pulled, is retired - a wagon worn to its last point is Failing, slow, and still goes where its owner goes. A wagon a
//    save holds at nought from before is Failing too.
//  - MENDING: a Wagon Yard mends it whole for MEND_SHARE of its kind's value at most, by what it lacks - MEND_FETCH more
//    to send a wright to where it stands; a Wagon Repair Kit (systems/upkeep/upkeepItemRows.js) mends KIT_MEND of it in the
//    field over KIT_MINUTES, to WAGON_KIT_CEILING at most.
//  - WAGON-TIERS (2026-10-15, Mac: "Yes, same tiers"): WHAT WEAR COSTS is its tier's (systems/upkeep/upkeepTiers.js - Boons,
//    the default: nothing, never worse than DFU's plain wagon; Hard: the system as it stood). The laws below that charge
//    take the tier's rules as an argument, and one handed none runs Hard.

import { isWagonItem, wagonKindOf, WAGON_KINDS } from './wagonKinds.js';
import { templateByIndex, mintCondition, TRANSPORT_SMALL_CART } from '../item/itemTemplates.js';
import { WAGON_UPKEEP_HARD } from '../upkeep/upkeepTiers.js';   // WAGON-TIERS: what a law handed no rules runs
import { t } from '../textManager.js';   // WAGON-TIERS: Boons' two words in the player's language

/** A wagon's condition at most - its template's (93's 1400), or the item's own where it carries one. */
export const wagonConditionMax = (item) => (Number.isInteger(item?.maxCondition) && item.maxCondition > 0 ? item.maxCondition : (templateByIndex(TRANSPORT_SMALL_CART)?.hitPoints ?? 1400));
/** A wagon's condition now - whole where it carries none (minted before its condition was). */
export const wagonCondition = (item) => (Number.isInteger(item?.currentCondition) ? Math.max(0, Math.min(wagonConditionMax(item), item.currentCondition)) : wagonConditionMax(item));
/** Its condition as a share of whole (0-1). */
export const wagonSoundness = (item) => wagonCondition(item) / wagonConditionMax(item);

/** The states, soundest first: each from `min` of whole (a share), its word, its tone on the Stable's chip and the pace
 *  its team pulls it at. The last is the floor: every wagon rolls (WAGON-MEND). */
export const WAGON_STATES = Object.freeze([
  Object.freeze({ key: 'sound', min: 0.6, name: 'Sound', tone: '', pace: 1 }),
  Object.freeze({ key: 'worn', min: 0.3, name: 'Worn', tone: '', pace: 1 }),
  Object.freeze({ key: 'rickety', min: 0.1, name: 'Rickety', tone: 'is-hurt', pace: 0.85 }),
  Object.freeze({ key: 'failing', min: 0, name: 'Failing', tone: 'is-hurt', pace: 0.7 }),
]);
/** A wagon's state (WAGON_STATES' row) - Failing at its last point and under it. */
export function wagonState(item) {
  const s = wagonSoundness(item);
  return WAGON_STATES.find((w) => s >= w.min) ?? WAGON_STATES[WAGON_STATES.length - 1];
}

// ── wear ────────────────────────────────────────────────────────────
/** A kilometre rolled on a road wears this share of whole. */
export const WEAR_A_KM = 0.01;
/** Off a road, this many times as much. */
export const OFFROAD = 2.5;
/** At its full load, this much more (x 1 + LOAD_WEAR x the load's share). */
export const LOAD_WEAR = 0.75;
/** A kind's wear, the Small Cart's 1: the wagons are built heavier. */
export const KIND_WEAR = Object.freeze({ cart: 1, openWagon: 0.85, caravan: 0.7 });
/** A day of a journey on the travel map wears this share of whole, JOURNEY_WEAR_MAX a journey at most. */
export const JOURNEY_WEAR_A_DAY = 0.01;
export const JOURNEY_WEAR_MAX = 0.2;
/** The watch's carrying a wagon off wears this share. */
export const THROWN_WEAR = 0.1;
/** WAGON-MEND: no wear takes a wagon under this many points - it is worn to Failing, never to nothing. */
export const WEAR_FLOOR = 1;

/** The share of whole `metres` rolled wear a wagon of `kind` - `road` on a road, `load` its load's share of its limit. */
export function rollWear(metres, { kind = 'cart', road = true, load = 0 } = {}) {
  if (!(metres > 0)) return 0;
  const l = Math.max(0, Math.min(1, Number(load) || 0));
  return (metres / 1000) * WEAR_A_KM * (road ? 1 : OFFROAD) * (1 + LOAD_WEAR * l) * (KIND_WEAR[kind] ?? 1);
}
/** The share a journey of `days` wears. */
export const journeyWear = (days) => Math.min(JOURNEY_WEAR_MAX, Math.max(0, Number(days) || 0) * JOURNEY_WEAR_A_DAY);

/**
 * THE WEAR, in place: `share` of whole off a wagon item's condition (its condition minted where it carries none),
 * never under WEAR_FLOOR (WAGON-MEND: a wagon is never worn to nothing). Answers `{ before, after }` - its state's
 * rows - or null for no wagon or no wear.
 * @param {any} item @param {number} share
 */
export function wearWagon(item, share) {
  if (!isWagonItem(item) || !(share > 0)) return null;
  mintCondition(item);
  const before = wagonState(item), max = wagonConditionMax(item), now = wagonCondition(item);
  const after = Math.max(Math.min(now, WEAR_FLOOR), Math.round(now - share * max));
  if (after === now) return null;
  item.currentCondition = after;
  return { before, after: wagonState(item) };
}

/**
 * THE WEAR'S ACCOUNT, a wagon's: rolled metres add up here (a frame's is a few centimetres - a point of 1400 is 0.07 %,
 * some seven metres of road) and come off the wagon a whole point at a time. One a wagon item (keyed by the item, so
 * a wagon sold is a fresh account). `add` answers what wearWagon answers when points came off, else null.
 */
export function createWearAccount() {
  /** @type {WeakMap<object, number>} */
  const owed = new WeakMap();
  return {
    add(item, share) {
      if (!isWagonItem(item) || !(share > 0)) return null;
      const max = wagonConditionMax(item);
      const total = (owed.get(item) ?? 0) + share * max;
      const whole = Math.floor(total);
      owed.set(item, total - whole);
      return whole > 0 ? wearWagon(item, whole / max) : null;
    },
    owed: (item) => owed.get(item) ?? 0,
  };
}

// ── mending ─────────────────────────────────────────────────────────
/** A Wagon Yard mends a wagon whole from nought for this share of its kind's value, MEND_LEAST at the least. */
export const MEND_SHARE = 0.12;
export const MEND_LEAST = 40;
/** A wright sent out to a wagon that is not at the yard: this much more. */
export const MEND_FETCH = 0.5;
/** A Wagon Repair Kit mends this share of whole, to WAGON_KIT_CEILING at most, over KIT_MINUTES. */
export const KIT_MEND = 0.25;
export const WAGON_KIT_CEILING = 0.6;
export const KIT_MINUTES = 60;

/** What the yard asks to mend `item` whole - by what it lacks of its kind's whole price - and more if `away`. 0 for a
 *  wagon already sound to its last point. */
export function mendPrice(item, { away = false } = {}) {
  if (!isWagonItem(item)) return 0;
  const lacks = 1 - wagonSoundness(item);
  if (lacks <= 0) return 0;
  const whole = Math.max(MEND_LEAST, Math.round(MEND_SHARE * (WAGON_KINDS[wagonKindOf(item)]?.value ?? 150)));
  return Math.max(1, Math.round(whole * lacks * (away ? 1 + MEND_FETCH : 1)));
}

export const WAGON_UPKEEP_TEXT = Object.freeze({
  failing: (name) => `Your ${name} is falling apart and slow. A Wagon Yard or a Wagon Repair Kit will mend it.`,
  rickety: (name) => `Your ${name} is rickety and slow. A Wagon Yard can mend it.`,
  noWagon: 'You do not own a wagon.',
  whole: (name) => `Your ${name} needs no mending.`,
  mended: (name, price) => `Your ${name} is mended${price ? ` for ${price} gold` : ''}.`,
  poor: (price) => `The wright asks ${price} gold. You don't have enough.`,
  kitCeiling: (name) => `A kit will do no more for your ${name}. A Wagon Yard can make it whole.`,
  kitNotNear: (name) => `Your ${name} is not here to mend.`,
  kitDone: (name, pct) => `You spend an hour mending your ${name}. It is ${pct}% sound.`,
  smith: 'A smith does not mend wagons. A town’s Wagon Yard does.',
  // WAGON-TIERS: Boons' words for a step down - the same news, and no slowness it does not have
  failingBoons: (name) => t('wagon.upkeep.boons.failing', 'Your {name} is falling apart. A Wagon Yard or a Wagon Repair Kit will mend it.', { name }),
  ricketyBoons: (name) => t('wagon.upkeep.boons.rickety', 'Your {name} is rickety. A Wagon Yard can mend it.', { name }),
});
/** A wagon's name in a sentence ("Small Cart", "Caravan"). */
export const wagonWord = (item) => WAGON_KINDS[wagonKindOf(item)]?.name ?? 'wagon';

/** Mend a wagon whole, in place (the yard's mend). Answers the condition it had. */
export function mendWagon(item) {
  if (!isWagonItem(item)) return null;
  mintCondition(item);
  const had = wagonCondition(item);
  item.currentCondition = wagonConditionMax(item);
  return had;
}
/** A kit's mend, in place: KIT_MEND of whole on, to WAGON_KIT_CEILING at most. Answers `{ ok, text }`; the kit is the
 *  caller's to spend (and the hour its to pass) on ok. */
export function kitMendWagon(item) {
  if (!isWagonItem(item)) return { ok: false, text: WAGON_UPKEEP_TEXT.noWagon };
  mintCondition(item);
  const max = wagonConditionMax(item), now = wagonCondition(item), top = Math.round(WAGON_KIT_CEILING * max);
  if (now >= top) return { ok: false, text: WAGON_UPKEEP_TEXT.kitCeiling(wagonWord(item)) };
  item.currentCondition = Math.min(top, now + Math.round(KIT_MEND * max));
  return { ok: true, text: WAGON_UPKEEP_TEXT.kitDone(wagonWord(item), Math.round(wagonSoundness(item) * 100)) };
}

/** The pace a wagon's state lets its team pull it at (1 for none) - WAGON-TIERS: its state's slowness only where its
 *  tier's wear slows it (Hard; on Boons every state rolls at DFU's pace), and a Sound wagon's earned pace where its tier
 *  pays one (Boons: upkeepTiers.js WAGON_SOUND_BOON - Mac, "Sound wagon rolls faster"). The team's own Strength under
 *  its load is horse care's, multiplied on after (upkeepRuntime.js rideScale), as every ride pace is. */
export function wagonPace(item, rules = WAGON_UPKEEP_HARD) {
  if (!isWagonItem(item)) return 1;
  const s = wagonState(item);
  return (rules.wearSlows ? s.pace : 1) * (s.key === 'sound' ? rules.soundPace : 1);
}
/** WAGON-TIERS: whether a counter buys `item` as a whole wagon - a wagon on a tier whose wear does not price it (Boons;
 *  and Off, `rules` null - DFU's plain wagon, which never wore). Hard prices it by its condition (systems/tradeModes.js
 *  saleConditionPercentage, Roleplay & Realism: Items' conditionCostBase). `rules` the live tier's (null for Off); a
 *  call handed none runs Hard. */
export const wagonSoldWhole = (item, rules = WAGON_UPKEEP_HARD) => isWagonItem(item) && !rules?.wearPrices;
