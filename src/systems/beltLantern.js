// BELT-LANTERN (2026-10-20, Dudey: "can we add an lantern only slot in the inventroy here in the row for enhanced plus and
// here in dfo grimoire in the middle under crystals") - THE LANTERN'S OWN SLOT: a lantern hung at the belt.
//
// No new equip slot: DFU has none for a light, and the light in hand stays PlayerEntity.LightSource (HT5's law,
// ui/enhanced/enhancedInventory.js LIGHT_SLOT). What the slot holds is a MARK on the lantern itself - `beltLantern: true` on
// the item, which travels with it in the save as every item field does (save.js snap.items) - and a lantern so marked
// hangs at the waist whenever it is lit (systems/playerTorch.js lanternAtWaist, and Handheld Torches' own hand law), on
// either skin and with the mod's "lanterns at the waist" switch off, so it takes no hand. One lantern hangs at a time.
// Lighting another light puts it out as any light does (the one LightSource); it stays on the belt, unlit.
//
// BELT-WAIST (FIELD BUGS 2026-10-21b, the Discord's #bug-reports: "Equipping the lantern with O still puts it into your
// shield slot and not the lantern slot"): the lantern AT THE WAIST is the slot's, marked or not. With the mod's switch on
// (shipped on, HT-WAIST-ON) every lit lantern hangs at the hip in the world - lanternAtWaist - and the inventory read the
// mark alone, so a lantern lit by O, Use or the hotbar hung at the hip and was drawn in the shield's hand. waistLanternOf
// is the one question the inventory, the O key and the hotbar ask.
import { LANTERN_TEMPLATE, lanternAtWaist } from './playerTorch.js';

/** Is this a lantern (Handheld Torches' and DFU's own template)? */
export const isLanternItem = (item) => !!item && item.templateIndex === LANTERN_TEMPLATE;

/** The lantern on the belt, or null. */
export function beltLanternOf(entity) {
  for (const it of entity?.items ?? []) if (it?.beltLantern === true && isLanternItem(it)) return it;
  return null;
}

/** BELT-WAIST: the lantern at the waist, as the world draws it - the lit light where it hangs there (the mark, or the
 *  mod's switch: lanternAtWaist), else the one on the belt, unlit. Null when neither. */
export function waistLanternOf(entity) {
  const lit = entity?.lightSource;
  return lanternAtWaist(lit) ? lit : beltLanternOf(entity);
}

/** Hang `item` at the belt (another one there comes off it). Answers whether it hangs. The light is the caller's: a
 *  hung lantern is lit by the same act that lights any light (useItem), after this - so the hand law sees the belt. */
export function hangBeltLantern(entity, item) {
  if (!isLanternItem(item) || !(entity?.items ?? []).includes(item)) return false;
  for (const it of entity.items) if (it !== item && it?.beltLantern) delete it.beltLantern;
  item.beltLantern = true;
  return true;
}

/** Take `item` off the belt. Answers whether it was there. Dousing it is the caller's (the same act that douses). */
export function unhangBeltLantern(item) {
  if (!item?.beltLantern) return false;
  delete item.beltLantern;
  return true;
}
