// AUDIT 17e F32 / ONE DFU MEMBER, ONE EXPORT: the single home for
// DFU's armor material constants and the values derived from them
// (ItemEnums.ArmorMaterialTypes, DaggerfallUnityItem.
// GetMaterialArmorValue / GetShieldArmorValue /
// GetShieldProtectedBodyParts / GetBodyPartForEquipSlot, and
// ItemBuilder.SetVariant's material-family clamps).
//
// These were ported TWICE - systems/equip.js and ui/paperDoll.js each
// carried a copy - and the copies drifted: both invented Chain2 =
// 0x0101 where DFU has 0x0103, so a Chain2 piece took the PLATE
// variant clamp and a plate-family armor value. Latent (nothing mints
// Chain2 until classic-save import lands) but exactly the drift the
// rule exists to stop.

/** ItemEnums.cs:82-98 verbatim. */
export const ARMOR_MATERIAL = Object.freeze({
  None: -1,
  Leather: 0x0000,
  Chain: 0x0100,
  Chain2: 0x0103,
  Iron: 0x0200, Steel: 0x0201, Silver: 0x0202, Elven: 0x0203, Dwarven: 0x0204,
  Mithril: 0x0205, Adamantium: 0x0206, Ebony: 0x0207, Orcish: 0x0208, Daedric: 0x0209,
});
export const isLeather = (m) => m === ARMOR_MATERIAL.Leather;
export const isChain = (m) => m === ARMOR_MATERIAL.Chain || m === ARMOR_MATERIAL.Chain2;
export const isPlate = (m) => m >= ARMOR_MATERIAL.Iron;

/** BodyParts (ItemEnums.cs:140-150). */
export const BODY_PARTS = Object.freeze({ Head: 0, RightArm: 1, LeftArm: 2, Chest: 3, Hands: 4, Legs: 5, Feet: 6 });
export const NUMBER_BODY_PARTS = 7;

/** GetMaterialArmorValue (DaggerfallUnityItem.cs:1007-1050): leather
 *  3, chain 6, plate iron 7 .. daedric 21. */
const PLATE_ARMOR_VALUES = [7, 9, 9, 11, 13, 15, 15, 17, 19, 21];
export function materialArmorValue(material) {
  if (isLeather(material)) return 3;
  if (isChain(material)) return 6;
  if (isPlate(material)) return PLATE_ARMOR_VALUES[material - ARMOR_MATERIAL.Iron] ?? 0;
  return 0;
}

/** GetShieldArmorValue + GetShieldProtectedBodyParts
 *  (DaggerfallUnityItem.cs:1061-1096). Shields are MATERIAL-BLIND. */
export const SHIELD_VALUES = new Map([[109, 1], [110, 2], [111, 3], [112, 4]]);
export const SHIELD_PARTS = new Map([
  [109, [BODY_PARTS.LeftArm, BODY_PARTS.Hands]],
  [110, [BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs]],
  [111, [BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs]],
  [112, [BODY_PARTS.Head, BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs]],
]);
export const isShieldTemplate = (templateIndex) => SHIELD_VALUES.has(templateIndex);

/** ItemBuilder.SetVariant's material-family clamps
 *  (ItemBuilder.cs:856-908). */
export function clampArmorVariant(templateIndex, material, variant) {
  const leather = isLeather(material), chain = isChain(material);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (templateIndex === 102) return leather ? 0 : chain ? 4 : clamp(variant, 1, 3);       // Cuirass
  if (templateIndex === 104) return leather ? clamp(variant, 0, 1) : chain ? 6 : clamp(variant, 2, 5);   // Greaves
  if (templateIndex === 105 || templateIndex === 106) return leather ? 0 : chain ? 4 : clamp(variant, 1, 3);   // Pauldrons
  if (templateIndex === 103) return leather ? 0 : 1;                                      // Gauntlets
  if (templateIndex === 108) return leather ? 0 : clamp(variant, 1, 2);                   // Boots
  return variant;
}

/** ItemBuilder.ApplyArmorSettings + SetRace + GetBodyMorphology
 *  (ItemBuilder.cs:35-36, :466-485, :850-854, :910-925): armor art
 *  lives in a per-gender archive offset by the race's body
 *  morphology. AUDIT 17f / RETIRING A FLAG DELETES THE SENTENCE: the
 *  "other morphologies arrive with chargen (INTERIM)" note shipped
 *  out with S3c - every race picks its own morphology now. */
export const FIRST_FEMALE_ARCHIVE = 245;
export const FIRST_MALE_ARCHIVE = 249;

/** GetBodyMorphology's four values (ItemEnums.BodyMorphology). */
export const BODY_MORPHOLOGY = Object.freeze({ Argonian: 0, Elf: 1, Human: 2, Khajiit: 3 });
export const HUMAN_MORPHOLOGY = BODY_MORPHOLOGY.Human;

export const armorArchive = (gender = 'male', morphology = HUMAN_MORPHOLOGY) =>
  (gender === 'male' ? FIRST_MALE_ARCHIVE : FIRST_FEMALE_ARCHIVE) + morphology;

/** MATERIAL FAMILY - the C6a art axis (leather / chain / plate rows).
 *  AUDIT 17f / ONE DFU MEMBER, ONE EXPORT: 17e F32 collapsed equip.js
 *  and paperDoll.js onto this file but MISSED characters/
 *  paperdollArt.js, which kept a third copy of the SetVariant clamps
 *  keyed by family instead of material - and a SECOND export named
 *  `armorArchive` whose second argument was a RACE where this one
 *  takes a MORPHOLOGY. Same name, same DFU member, incompatible
 *  arguments: exactly the footgun the rule exists to stop. The clamps
 *  live here; paperdollArt re-exports the family-keyed adapter for
 *  the C6a callers that already speak families. */
export const MATERIAL_FAMILY = Object.freeze({ Leather: 0, Chain: 1, Plate: 2 });
export const armorFamilyOfMaterial = (material) =>
  isLeather(material) ? MATERIAL_FAMILY.Leather
  : isChain(material) ? MATERIAL_FAMILY.Chain
  : MATERIAL_FAMILY.Plate;
const MATERIAL_OF_FAMILY = [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Iron];
export const armorVariant = (templateIndex, family, requested = 0) =>
  clampArmorVariant(templateIndex, MATERIAL_OF_FAMILY[family] ?? ARMOR_MATERIAL.Iron, requested);
