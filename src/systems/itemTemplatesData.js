// GENERATED from DFU ItemEnums.cs (MIT, Daggerfall Workshop) by
// scratchpad/extract-item-templates.py. Regenerate rather than
// hand-edit.
//
// AUDIT 17e F9 / ONE DFU MEMBER, ONE EXPORT: the 288-row TEMPLATE_ROWS
// table that used to live here was a LOSSY second copy of
// characters/itemTemplates.json (DFU's ItemTemplates.txt verbatim) -
// it carried only the world texture, so every inventory icon drew the
// world sprite where DFU draws the player/inventory sprite. The two
// copies were verified field-for-field identical before this one was
// deleted; systems/itemTemplates.js now reads the JSON directly.
// What remains here is the ENUM extraction (group -> template
// indices), which ItemTemplates.txt does not carry.

export const GROUP_TEMPLATE_INDICES = Object.freeze({
  Drugs: Object.freeze([78, 79, 80, 81]),
  UselessItems1: Object.freeze([82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92]),
  Armor: Object.freeze([102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]),
  Weapons: Object.freeze([113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131]),
  MensClothing: Object.freeze([141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181]),
  Books: Object.freeze([277, 277, 277, 277]),
  Furniture: Object.freeze([217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245]),
  UselessItems2: Object.freeze([247, 248, 249, 252, 253, 279]),
  ReligiousItems: Object.freeze([258, 259, 260, 261, 262, 263, 264, 265, 267, 268, 269, 270, 271]),
  Maps: Object.freeze([287]),
  WomensClothing: Object.freeze([182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216]),
  Paintings: Object.freeze([284]),
  Gems: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]),
  PlantIngredients1: Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 25]),
  PlantIngredients2: Object.freeze([8, 9, 10, 11, 12, 13, 15, 16, 17, 21, 22, 24, 26, 27, 28, 29, 30, 31, 32]),
  CreatureIngredients1: Object.freeze([33, 35, 38, 39, 40, 41, 42, 43, 44, 45, 50, 51, 53, 54, 61]),
  CreatureIngredients2: Object.freeze([46, 47, 48, 49, 52]),
  CreatureIngredients3: Object.freeze([34, 36, 37]),
  MiscellaneousIngredients1: Object.freeze([55, 56, 57, 58, 59, 60, 62, 63, 64]),
  MetalIngredients: Object.freeze([65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75]),
  MiscellaneousIngredients2: Object.freeze([76, 77]),
  Transportation: Object.freeze([93, 94, 95, 96, 97, 98]),
  Deeds: Object.freeze([0, 1, 2]),
  Jewellery: Object.freeze([133, 134, 135, 136, 137, 138, 139, 140]),
  MiscItems: Object.freeze([132, 274, 275, 276, 278, 281, 285, 286, 287]),
  // Hand-added at Q2b-ii (the generator script predates the quest
  // mint and did not extract it; values verbatim from ItemEnums.cs
  // :580-590 `enum QuestItems`): Telescope, Scales, Globe, Skeleton,
  // Totem, Dead_body, Mantella, Finger.
  QuestItems: Object.freeze([254, 255, 256, 257, 280, 281, 282, 283]),
  // Hand-added at the Q2b-ii audit (same generator gap): the 1-entry
  // Currency enum (ItemEnums.cs:605-608, Gold_pieces = 276) - the
  // quest mint's "coins" (Quests-Items 28,0) resolves through it
  // where the port used to throw and C# mints gold pieces.
  Currency: Object.freeze([276]),
});
