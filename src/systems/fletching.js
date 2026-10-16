// FLETCH (2026-10-11, Mac: "Allow crafting of arrows"; bible/05-Combat/Arrow-Supply.md): THE PACK'S ARROW CRAFT.
//
// Online the arrows are Carpentry's (net/recipeLaw.js, twenty at a workbench - Professions-Arc.md 9.3); offline nothing
// made one, and a bow went quiet when the shops ran dry. Now the player whittles them from wood they carry, anywhere,
// online or off: USE (the inventory's Use mode - DaggerfallInventoryWindow.UseItem asks a registered handler first,
// ItemHelper.RegisterItemUseHandler, systems/item/itemTemplates.js) a piece of wood, and it becomes ITS OWN WEIGHT IN ARROWS -
// Daggerfall's Twigs (0.5 kg, two), its Pine Branch (1 kg, four), Foraging's Wood Bundle (2.5 kg, ten) - the weights the
// templates carry, over the Arrow's 0.25 kg, never a table of counts. One piece a Use, as a potion is one bottle; the
// arrows are CreateWeapon's (combat/enemyEquipment.js - the shelf's, the corpse's, the workbench's), so they join the
// quiver as one stack.
//
// A departure from DFU, which crafts no arrow. Not a quest's piece: a watched item keeps the ladder's own answer.

import { registerItemUseHandler, templateByIndex, ITEM_TEMPLATES } from './item/itemTemplates.js';
import { addItem, ARROW_TEMPLATE } from './inventory.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { FT } from './foraging/foragingLaw.js';   // Foraging's Wood Bundle (1604) - its template is registered when the mod is on

/** The wood an arrow is whittled from - Twigs (PlantIngredients1/2 8), Pine Branch (14), Foraging's Wood Bundle. */
export const FLETCH_TEMPLATES = Object.freeze([8, 14, FT.WoodBundle]);

/** How many arrows one piece of `item` makes: its template's weight over the Arrow's, whole arrows; 0 for anything else
 *  (and for a template the data does not carry - Foraging off). BENCH-ARROWS (FIELD BUGS 2026-10-15c): the Arrow's weight
 *  is the classic Arrow's, 0.25 kg - never a mod's patch: Roleplay & Realism: Items' 0.1 (on by default, forced online)
 *  made a Twig five arrows, so four were the workbench's twenty without its plank and its ingot. */
export function fletchYield(item) {
  if (!FLETCH_TEMPLATES.includes(item?.templateIndex)) return 0;
  const wood = templateByIndex(item.templateIndex)?.baseWeight ?? 0;
  const arrow = ITEM_TEMPLATES[ARROW_TEMPLATE]?.baseWeight ?? 0;
  return wood > 0 && arrow > 0 ? Math.floor(wood / arrow + 1e-9) : 0;
}

/** The handler: one piece off the list it lies in, its arrows into the pack (`localItems`, the ladder's - the list
 *  itself when there is no other). Null - the ladder's own answer - for a quest's piece or wood that makes none. */
export function fletch(item, list, ctx = {}) {
  const n = fletchYield(item);
  if (!n || item.questItem) return null;
  const pack = ctx?.localItems ?? list;
  if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
  else { const i = Array.isArray(list) ? list.indexOf(item) : -1; if (i < 0) return null; list.splice(i, 1); }
  addItem(pack, { ...createWeapon(ARROW_TEMPLATE, 0, () => 0), stackCount: n });   // the arrow arm's stack roll, answered
  const from = templateByIndex(item.templateIndex)?.name ?? 'wood';
  return { kind: 'text', text: `You fletch ${n} arrows from the ${from}.` };
}

for (const t of FLETCH_TEMPLATES) registerItemUseHandler(t, fletch);
