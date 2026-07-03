// Paperdoll system data (Characters C5a).
// 1:1 from Daggerfall Unity (MIT, Daggerfall Workshop):
//   - EQUIP_SLOTS: ItemEnums.EquipSlots verbatim (the 27-slot classic
//     table; None = -1, comment names preserved in the source enum).
//   - itemTemplates.json: DFU's Resources/ItemTemplates.txt committed
//     verbatim (288 templates) - the classic item database. Each
//     wearable carries its own paperdoll layer via drawOrderOrEffect
//     (DaggerfallUnityItem.drawOrder assigns straight from it) and its
//     variant count; the paperdoll blits equipped items sorted by that
//     order (PaperDollRenderer.BlitItems).
// Dye tables (C5b) and the GetEquipSlot assignment rules (C5c) follow.

import templates from './itemTemplates.json' with { type: 'json' };

export const EQUIP_SLOTS = Object.freeze({
  None: -1,
  Amulet0: 0, Amulet1: 1,
  Bracelet0: 2, Bracelet1: 3,
  Ring0: 4, Ring1: 5,
  Bracer0: 6, Bracer1: 7,
  Mark0: 8, Mark1: 9,
  Crystal0: 10, Crystal1: 11,
  Head: 12,
  RightArm: 13,
  Cloak1: 14,
  LeftArm: 15,
  Cloak2: 16,
  ChestClothes: 17,
  ChestArmor: 18,
  RightHand: 19,
  Gloves: 20,
  LeftHand: 21,
  Unknown1: 22,
  LegsArmor: 23,
  LegsClothes: 24,
  Unknown2: 25,
  Feet: 26,
});

export const ITEM_TEMPLATES = templates;

/** Template by classic index (templates are index-keyed but sparse-safe). */
const byIndex = new Map(templates.map((t) => [t.index, t]));
export const getTemplate = (index) => byIndex.get(index);

/** Equipped list -> paperdoll draw order (BlitItems verbatim: ascending drawOrder). */
export function paperdollOrder(items) {
  return [...items].sort((a, b) => a.drawOrder - b.drawOrder);
}
