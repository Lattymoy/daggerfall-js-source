// DRESS1 (2026-09-30, Discord: "Add positive and negative reputation
// buffs for clothing items... common clothes would provide a positive
// reputation buff with the Commoner faction but a negative one with
// the Noble faction. A next step would be ... temple-specific robes
// with a positive buff for that temple faction."): DRESS FOR THE PART.
//
// A port feature, NOT classic - Daggerfall and DFU have no clothing
// reaction at all. What you WEAR in the five clothing slots now tints
// how people take you:
//   - COMMON wear (casual / plain / peasant / work clothes): +3 with
//     Commoners, -3 with Nobility, per garment.
//   - FINE wear (formal cloaks and tunics, gowns, surcoats, kimono,
//     toga, the Formal Eodoric): +3 with Nobility, +1 with Merchants,
//     -1 with Commoners, per garment.
//   - RELIGIOUS wear (Priest / Priestess Robes): +3 with every TEMPLE
//     faction (FactionFile type Temple, read in talk.js's
//     getReactionToPlayer) and +1 with Scholars, per garment.
// Every group's total is capped at +/-10. Everything else (boots,
// shoes, long shirts, the arena straps, the Khajiit suit...) is
// neutral.
//
// The social-group half rides DFU's own live channel: the player's
// `reactionMods` (PlayerEntity.cs:129, "do not serialize, set by live
// effects"), which enchantmentMagicRound clears at the head of every
// magic round and the worn items refill. applyDressStanding runs
// straight after that clear - BEFORE the no-enchanted-items early
// return - so a plain tunic counts with nothing magical worn, and
// nothing is ever saved: take the garment off and the next round
// forgets it. The temple half cannot live in a per-sgroup array (a
// temple is a faction TYPE, not a social group), so it sits on the
// same live snapshot, `entity._dressStanding`, beside the group
// figures the Enhanced Plus Standing page draws. Online and offline
// alike: the pump is worldTick's in both, and the reads are local.
//
// Leaf module on purpose: talk.js reads it, and equip.js's import
// graph is heavy - so the equip table is read by shape
// (`entity.equip.slots`, equipTableOf's own field) with the bag's
// `equipSlot` mark as the fallback, as equippedEnchantedItems does.

import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { ITEM_GROUPS } from '../characters/equipRules.js';
import { FACTION_TYPES } from '../formats/factionFile.js';

/** The five named social groups, by index (FactionFile.SocialGroups). */
export const DRESS_GROUP = Object.freeze({ Commoners: 0, Merchants: 1, Scholars: 2, Nobility: 3, Underworld: 4 });
export const DRESS_GROUP_COUNT = 5;

/** The slots clothing is worn in (paperdoll EquipSlots). */
export const DRESS_SLOTS = Object.freeze([
  EQUIP_SLOTS.Cloak1, EQUIP_SLOTS.Cloak2, EQUIP_SLOTS.ChestClothes, EQUIP_SLOTS.LegsClothes, EQUIP_SLOTS.Feet,
]);

export const DRESS_CLASS = Object.freeze({ Common: 'common', Fine: 'fine', Religious: 'religious' });

/** Template index -> class (itemTemplates.json names; MensClothing
 *  141-181, WomensClothing 182-216). */
const COMMON = [
  141, // Straps
  142, // Armbands
  150, 189, // Sandals
  151, 190, // Casual Pants
  152, // Breeches
  154, 191, // Casual Cloak
  162, 199, // Loincloth
  163, 200, // Plain Robes
  165, 166, 169, 170, 178, 202, 203, 206, 207, 214, // Short Shirt
  174, 211, // Wrap
  180, 216, // Vest
  184, // Peasant Blouse
  197, // Casual Dress
  198, // Strapless Dress
];
const FINE = [
  143, // Kimono
  144, // Fancy Armbands
  155, 192, // Formal Cloak
  157, // Dwynnen Surcoat
  159, // Formal Tunic
  160, // Toga
  176, // Anticlere Surcoat
  183, // Formal Brassiere
  194, // Formal Eodoric
  195, // Evening Gown
  196, // Day Gown
];
const RELIGIOUS = [164, 201];   // Priest Robes, Priestess Robes

const CLASS_OF = new Map([
  ...COMMON.map((t) => [t, DRESS_CLASS.Common]),
  ...FINE.map((t) => [t, DRESS_CLASS.Fine]),
  ...RELIGIOUS.map((t) => [t, DRESS_CLASS.Religious]),
]);

/** Per-garment figures: [Commoners, Merchants, Scholars, Nobility, Underworld] + temple. */
export const DRESS_EFFECT = Object.freeze({
  [DRESS_CLASS.Common]: Object.freeze({ groups: Object.freeze([3, 0, 0, -3, 0]), temple: 0 }),
  [DRESS_CLASS.Fine]: Object.freeze({ groups: Object.freeze([-1, 1, 0, 3, 0]), temple: 0 }),
  [DRESS_CLASS.Religious]: Object.freeze({ groups: Object.freeze([0, 0, 1, 0, 0]), temple: 3 }),
});
export const DRESS_CAP = 10;
/** LOOT14 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 6): THE WARDROBE'S STANDING - a garment's `standing`
 *  lines and a Legendary's Royal Bearing, summed by the loot ladder's fold onto `entity._mods.standing` (read here as a
 *  field, so this stays a leaf; empty with the ladder off) - held to its own cap a group, BESIDE the dress's: a fine
 *  outfit already at the dress's +10 with the Nobility still feels a Courtier's line. */
export const GEAR_STANDING_CAP = 10;

const CLOTHING_GROUPS = new Set([ITEM_GROUPS.MensClothing, ITEM_GROUPS.WomensClothing]);
const groupOf = (item) => (typeof item.group === 'string' ? ITEM_GROUPS[item.group] : item.group);

/** The class of one item, or null for anything neutral / not clothing. */
export function dressClassOf(item) {
  if (!item || !CLOTHING_GROUPS.has(groupOf(item))) return null;
  return CLASS_OF.get(item.templateIndex) ?? null;
}

/** The clothing actually worn in the clothing slots. */
export function wornClothing(entity) {
  const out = [];
  const slots = entity?.equip?.slots;
  if (slots) {
    for (const s of DRESS_SLOTS) if (slots[s]) out.push(slots[s]);
  } else {
    for (const it of entity?.items ?? []) if (it && DRESS_SLOTS.includes(it.equipSlot)) out.push(it);
  }
  return out;
}

const clamp = (v) => Math.max(-DRESS_CAP, Math.min(DRESS_CAP, v));

/** Pure read: { groups: [5], temple } for what the entity wears now. */
export function dressStanding(entity) {
  const groups = new Array(DRESS_GROUP_COUNT).fill(0);
  let temple = 0;
  for (const it of wornClothing(entity)) {
    const fx = DRESS_EFFECT[dressClassOf(it)];
    if (!fx) continue;
    for (let g = 0; g < DRESS_GROUP_COUNT; g++) groups[g] += fx.groups[g];
    temple += fx.temple;
  }
  const gear = entity?._mods?.standing;   // LOOT14
  const capGear = (v) => Math.max(-GEAR_STANDING_CAP, Math.min(GEAR_STANDING_CAP, Number(v) || 0));
  return { groups: groups.map((v, g) => clamp(v) + capGear(gear?.[g])), temple: clamp(temple) };
}

/** The magic-round hook: fold the dress into the (just-cleared) live
 *  reactionMods and keep the snapshot for the temple read and the UI.
 *  Player only - reactionMods is PlayerEntity's. */
export function applyDressStanding(entity) {
  if (!entity?.isPlayer) return null;
  const d = dressStanding(entity);
  const mods = entity.reactionMods;
  if (mods) for (let g = 0; g < DRESS_GROUP_COUNT && g < mods.length; g++) mods[g] += d.groups[g];
  entity._dressStanding = d;
  return d;
}

/** The temple half, read by getReactionToPlayer: the live bonus when
 *  the faction is a Temple, else 0. */
export function dressTempleBonus(faction, player) {
  if (!faction || faction.type !== FACTION_TYPES.Temple) return 0;
  return player?._dressStanding?.temple ?? 0;
}
