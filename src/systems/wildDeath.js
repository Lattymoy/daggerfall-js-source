// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - A DEATH IN THE OPEN ZONE: WHAT STAYS, WHAT DROPS, WHAT A KILLER MAY TAKE
// (bible/11-Multiplayer/Wild-Zone.md).
//
// The owner, of a player's death at another's hand: "cant get looted all of the items they have, except campfires,
// torches, potions etc ... players can choose 1 item of the equipped ones the killed player has"; asked what else is
// lost, "the bags" too (the mob death's law) "and the players can take the cart in to the zone and it also loses all
// loot in it". And of a death to a foe: "drops the loot he has in his bags ... (you dont drop your equipped stuff)".
//
// SO, EITHER DEATH:
//   KEPT, always: the consumables the owner named and their kin - potions, light sources (a torch, a lantern, a candle),
//     the camp's kit and its fire (Climates & Calories' gear, food and water), the rest consumables (REST6), arrows and
//     every other ammunition, bandages - and everything that may never change hands (a quest's item, a summoned or
//     bound piece, a boat's deed or parts, the Materials Bag, a vehicle, a deed, the spellbook, the wallet and the Embers
//     and Shards it holds - the trade's refusals and the decor's kept-back list, read, not rewritten).
//   DROPPED: every other thing in the bag and in the cart - into the room's remains (net/wildLaw.js), where anyone may
//     take it for ten minutes. A letter of credit too (LETTERS-DROP, 2026-10-09), ahead of the decor's kept-back list.
//   WORN: kept on a death to a foe. On a death at another player's hand the killer may take ONE worn piece the same
//     rules let go (`wornOffer`) - the fallen's own game gives it (net/wildFight.js).
// The purse is the death penalty's (systems/deathPenalty.js) and unchanged.
// ═══════════════════════════════════════════════════════════════════
import { isPotion, isLightSource, TEMPLATES } from './useItem.js';
import { isSurvivalItem } from './survival/items.js';
import { isFood, isWaterskin } from './survival/food.js';
import { isRestItem } from './restItems.js';
import { isAmmunition } from './itemTemplates.js';
import { BANDAGE_TEMPLATE } from './rriRealism.js';
import { tradeRefusal } from './tradePack.js';
import { isEquipped } from './equip.js';
import { DECOR_OWN_KEPT_BACK } from './decorItems.js';
import { WILD_ITEMS_MAX } from '../net/wire.js';
import { RECEIVER_MARKS } from '../net/realmTradeLaw.js';
import { goldStack } from './inventory.js';
import { isWalletItem, walletHolds } from './walletItem.js';   // KEEP-WALLET

/** The groups no death in the zone ever drops: a vehicle, a deed, a quest's own item. */
export const WILD_NEVER_GROUPS = Object.freeze(new Set(['Transportation', 'Deeds', 'QuestItems', 'Currency']));

/** "except campfires, torches, potions etc" - is this a consumable the fallen keep? */
export function keptOnWildDeath(item) {
  if (!item) return true;
  return isPotion(item) || isLightSource(item) || isSurvivalItem(item) || isFood(item) || isWaterskin(item)
    || isRestItem(item) || isAmmunition(item) || (item.group === 'UselessItems2' && item.templateIndex === BANDAGE_TEMPLATE);
}

/** May this piece leave its owner at a death in the zone at all? Worn or not - the trade's own refusals over a copy
 *  that is not worn (its `isEquipped` arm is the only one that asks where the piece is), and the kept-back list. */
export function wildCanLose(item) {
  if (!item || keptOnWildDeath(item)) return false;
  // LETTERS-DROP (the owner: "letter of credits should be dropped"): a letter of credit is the one piece of the wallet's
  // that a death in the zone takes, as a coin of the purse is - the Embers and the Shards stay
  if (item.group === 'MiscItems' && item.templateIndex === TEMPLATES.Letter_of_credit && !item.questItem) return tradeRefusal({ ...item, equipSlot: undefined }) === null;
  if (WILD_NEVER_GROUPS.has(item.group) || DECOR_OWN_KEPT_BACK.has(item.templateIndex) || item.templateIndex === TEMPLATES.Spellbook) return false;
  // KEEP-WALLET (2026-10-09, the owner: "the wallet shouldnt drop in the zone"): the wallet is an organizer - its pieces
  // lie in the pack itself; the Deadlands Embers and the Welkynd Shards stay with the fallen, as the wallet does (bound
  // already) - the letters of credit drop (LETTERS-DROP, above)
  if (isWalletItem(item) || walletHolds(item)) return false;
  return tradeRefusal({ ...item, equipSlot: undefined }) === null;
}

/**
 * THE DROP: what a death in the zone takes out of the bag (`items`, never a worn piece) and the cart (`wagon`) -
 * REMOVED from both lists, in their order, and handed back to be deposited. Pure over the two arrays it is given.
 */
export function takeWildDrop(items, wagon = null) {
  const lift = (list, worn) => {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if ((worn && isEquipped(it)) || !wildCanLose(it)) continue;
      list.splice(i, 1);
      out.unshift(it);
    }
    return out;
  };
  return [...lift(items, true), ...lift(wagon, false)];
}

/** WILD GOLD: a death in the zone drops this share of the gold carried (no usual death penalty) into the remains. */
export const WILD_GOLD_LOSS = 0.5;

/** Take WILD_GOLD_LOSS of the purse (`entity.goldPieces`) AND of the cart's gold stack (the `Currency` item in
 *  `entity.wagonItems`), in place; answers the gold as ONE pile record (purse + cart share), or null. */
export function takeWildGold(entity) {
  let take = 0;
  const have = Math.max(0, Math.floor(entity?.goldPieces ?? 0));
  const purse = Math.floor(have * WILD_GOLD_LOSS);
  if (purse >= 1) { entity.goldPieces = have - purse; take += purse; }
  const cart = Array.isArray(entity?.wagonItems) ? entity.wagonItems.find((i) => i?.group === 'Currency') : null;
  if (cart) {
    const n = Math.max(0, Math.floor(cart.stackCount ?? 1));
    const share = Math.floor(n * WILD_GOLD_LOSS);
    if (share >= 1) { cart.stackCount = n - share; take += share; }
  }
  return take >= 1 ? goldStack(take) : null;
}

/** THE KILLER'S CHOICE: the worn pieces a body offers - worn, and a death may let them go - at most WILD_ITEMS_MAX. */
export const wornOffer = (items) => (Array.isArray(items) ? items.filter((it) => it && isEquipped(it) && wildCanLose(it)).slice(0, WILD_ITEMS_MAX) : []);

/** A record for the wire: a plain-data copy with the RECEIVER's marks off (its slot, its quest - loot.js's own clamp
 *  strips them too; never sent is better than stripped). */
export function wildRecord(item) {
  const copy = JSON.parse(JSON.stringify(item));
  for (const k of RECEIVER_MARKS) delete copy[k];   // ACQUIRE1's `acquired` among them; MARK-WIRE: one list (net/realmTradeLaw.js)
  return copy;
}

/** A list cut into the wire's chunks. */
export function wildChunks(list, size = WILD_ITEMS_MAX) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * THE RESPAWN'S CLEAR GROUND (the owner: "make sure it doesnt stuck the player when he spawns and other players"): a
 * spot near `centre` (a scene point, the start marker) for a player and the team that follows them - no other body
 * within `room` metres, and ground behind it (the way the horse and the wagon stand) that `clear(from, yaw)` says is
 * open. Rings of `step` metres out to `reach`, eight bearings a ring, the centre first. Answers `{ pos, yaw }`, or the
 * centre itself when nothing better was found (a respawn is never refused).
 * @param {number[]} centre
 * @param {{ bodies?: number[][], clear?: (from: number[], yaw: number) => boolean, yaw?: number, room?: number, step?: number, reach?: number }} [opts]
 * @returns {{ pos: number[], yaw: number }}
 */
export function wildSpawnSpot(centre, { bodies = [], clear = () => true, yaw = 0, room = 2.5, step = 2, reach = 8 } = {}) {
  const free = (p) => bodies.every((b) => !b || Math.hypot(b[0] - p[0], b[2] - p[2]) >= room);
  for (let r = 0; r <= reach; r += step) {
    const n = r === 0 ? 1 : 8;
    for (let k = 0; k < n; k++) {
      const a = yaw + (k * Math.PI * 2) / n;
      const p = [centre[0] + Math.sin(a) * r, centre[1], centre[2] + Math.cos(a) * r];
      if (!free(p)) continue;
      for (let t = 0; t < 4; t++) {
        const face = yaw + (t * Math.PI) / 2;
        if (clear(p, face)) return { pos: p, yaw: face };
      }
    }
  }
  return { pos: [centre[0], centre[1], centre[2]], yaw };
}
