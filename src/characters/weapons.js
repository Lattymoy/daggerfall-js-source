// Weapons, 1:1 with Daggerfall Unity. Enums, the classic damage table,
// the material modifier, and material application (value/weight/
// condition multipliers + dye) are translated verbatim from DFU:
// ItemEnums.cs (Weapons, WeaponMaterialTypes), ItemBuilder.cs
// (SetItemPropertiesByMaterial + the three multiplier arrays,
// ApplyWeaponMaterial incl. the female archive-1 rule),
// DaggerfallUnityItem.GetWeaponMaterialModifier and
// GetWeaponSkillUsed/GetWeaponSkillIDAsShort, ItemHelper.
// GetWeaponDyeColor, FormulaHelper.CalculateWeaponMin/MaxDamage and
// CalculateWeaponToHit (modifier * 10). Constants byte-exact.
import templates from './itemTemplates.json' with { type: 'json' };
import { DYE_COLORS, DYE_TARGETS, getDyeColorTable } from './dyes.js';
import { SKILLS } from '../systems/skills.js';   // GetWeaponSkillIDAsShort's return set
import { SOUND } from '../systems/soundClips.js';   // F023: GetEquipSound's clips (soundClips is a leaf)

export const WEAPONS = Object.freeze({
  Dagger: 113, Tanto: 114, Staff: 115, Shortsword: 116, Wakazashi: 117,
  Broadsword: 118, Saber: 119, Longsword: 120, Katana: 121, Claymore: 122,
  Dai_Katana: 123, Mace: 124, Flail: 125, Warhammer: 126, Battle_Axe: 127,
  War_Axe: 128, Short_Bow: 129, Long_Bow: 130, Arrow: 131,
});

/** DaggerfallUnityItem.GetEquipSound's WEAPONS arm (:839-867) - the
 *  sound a drawn weapon makes, which is what FPSWeapon actually plays
 *  on ToggleSheath (WeaponManager.SetWeapon :780 overwrites
 *  DrawWeaponSound with it; the declared 78 default never survives an
 *  applied weapon). AUDIT 26 F023: every draw used to sound alike.
 *
 *  Switched on templateIndex exactly as the C# is - NOT on the port's
 *  weaponTypeForItem, whose grouping differs (it folds Claymore and
 *  Dai-katana in with the long blades where DFU gives them the
 *  two-handed clip), and not on names, which carry casing drift.
 *  Anything else - a bare hand, an arrow, the werecreature claws -
 *  answers null, DFU's SoundClips.None. */
export function equipSoundFor(item) {
  const W = WEAPONS;
  if (!item || item.werecreatureClaws) return null;
  switch (item.templateIndex) {
    case W.Battle_Axe: case W.War_Axe:
      return SOUND.EquipAxe;
    case W.Broadsword: case W.Longsword: case W.Saber: case W.Katana:
      return SOUND.EquipLongBlade;
    case W.Claymore: case W.Dai_Katana:
      return SOUND.EquipTwoHandedBlade;
    case W.Dagger: case W.Tanto: case W.Wakazashi: case W.Shortsword:
      return SOUND.EquipShortBlade;
    case W.Flail:
      return SOUND.EquipFlail;
    case W.Mace: case W.Warhammer:
      return SOUND.EquipMaceOrHammer;
    case W.Staff:
      return SOUND.EquipStaff;
    case W.Short_Bow: case W.Long_Bow:
      return SOUND.EquipBow;
    default:
      return null;   // SoundClips.None
  }
}

export const WEAPON_MATERIALS = Object.freeze({
  None: -1, Iron: 0, Steel: 1, Silver: 2, Elven: 3, Dwarven: 4,
  Mithril: 5, Adamantium: 6, Ebony: 7, Orcish: 8, Daedric: 9,
});

// ItemBuilder.cs statics, verbatim (indexed by WeaponMaterialTypes).
export const weightMultipliersByMaterial = Object.freeze([4, 5, 4, 4, 3, 4, 4, 2, 4, 5]);
export const valueMultipliersByMaterial = Object.freeze([1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
export const conditionMultipliersByMaterial = Object.freeze([4, 6, 6, 8, 12, 16, 20, 24, 28, 32]);

// FormulaHelper.CalculateWeaponMinDamage, verbatim case groups.
const W = WEAPONS;
const MIN_DAMAGE = new Map([
  [[W.Dagger, W.Tanto, W.Wakazashi, W.Shortsword, W.Broadsword, W.Staff, W.Mace], 1],
  [[W.Longsword, W.Claymore, W.Battle_Axe, W.War_Axe, W.Flail], 2],
  [[W.Saber, W.Katana, W.Dai_Katana, W.Warhammer], 3],
  [[W.Short_Bow, W.Long_Bow], 4],
].flatMap(([ws, v]) => ws.map((w) => [w, v])));
export function weaponMinDamage(weapon) { return MIN_DAMAGE.get(weapon) ?? 0; }

// FormulaHelper.CalculateWeaponMaxDamage, verbatim case groups.
const MAX_DAMAGE = new Map([
  [[W.Dagger], 6],
  [[W.Tanto, W.Shortsword, W.Staff], 8],
  [[W.Wakazashi], 10],
  [[W.Broadsword, W.Saber, W.Battle_Axe, W.Mace], 12],
  [[W.Flail], 14],
  [[W.Longsword, W.Katana, W.War_Axe, W.Short_Bow], 16],
  [[W.Claymore, W.Warhammer, W.Long_Bow], 18],
  [[W.Dai_Katana], 21],
].flatMap(([ws, v]) => ws.map((w) => [w, v])));
export function weaponMaxDamage(weapon) { return MAX_DAMAGE.get(weapon) ?? 0; }

/** DaggerfallUnityItem.GetWeaponSkillUsed + GetWeaponSkillIDAsShort
 *  (DaggerfallUnityItem.cs:910-962), verbatim: the switch is on
 *  TEMPLATE INDEX, which is immutable, and returns Skills.None for
 *  anything that is not one of the eighteen weapons.
 *
 *  AUDIT 18: the port keyed its table by the item's DISPLAY NAME
 *  instead (systems/skills.js WEAPON_SKILL). A name is not immutable -
 *  loot.createRegularMagicItem renames an enchanted weapon to its
 *  MAGIC.DEF name - and itemTemplates.json spells 117/123 "Wakizashi"
 *  and "Dai-katana" against the table's "Wakazashi"/"Dai-Katana", so
 *  an enchanted broadsword swung with LongBlade 70 was scored on
 *  HandToHand 20. Returns null (not HandToHand) for an unmapped
 *  template so callers keep DFU's own fallthrough. */
const WEAPON_SKILL_USED = new Map([
  [[W.Dagger, W.Tanto, W.Wakazashi, W.Shortsword], SKILLS.ShortBlade],
  [[W.Broadsword, W.Longsword, W.Saber, W.Katana, W.Claymore, W.Dai_Katana], SKILLS.LongBlade],
  [[W.Battle_Axe, W.War_Axe], SKILLS.Axe],
  [[W.Flail, W.Mace, W.Warhammer, W.Staff], SKILLS.BluntWeapon],
  [[W.Short_Bow, W.Long_Bow], SKILLS.Archery],
].flatMap(([ws, v]) => ws.map((w) => [w, v])));
export function weaponSkillUsed(templateIndex) { return WEAPON_SKILL_USED.get(templateIndex) ?? null; }

// DaggerfallUnityItem.GetWeaponMaterialModifier, verbatim.
export function weaponMaterialModifier(material) {
  const M = WEAPON_MATERIALS;
  switch (material) {
    case M.Iron: return -1;
    case M.Steel: case M.Silver: return 0;
    case M.Elven: return 1;
    case M.Dwarven: return 2;
    case M.Mithril: case M.Adamantium: return 3;
    case M.Ebony: return 4;
    case M.Orcish: return 5;
    case M.Daedric: return 6;
    default: return 0;
  }
}
// FormulaHelper.CalculateWeaponToHit, verbatim.
export function weaponToHit(material) { return weaponMaterialModifier(material) * 10; }

// ItemHelper.GetWeaponDyeColor, verbatim (default: Unchanged).
export function weaponDyeColor(material) {
  const M = WEAPON_MATERIALS, D = DYE_COLORS;
  switch (material) {
    case M.Iron: return D.Iron;
    case M.Steel: return D.Steel;
    case M.Silver: return D.Silver;
    case M.Elven: return D.Elven;
    case M.Dwarven: return D.Dwarven;
    case M.Mithril: return D.Mithril;
    case M.Adamantium: return D.Adamantium;
    case M.Ebony: return D.Ebony;
    case M.Orcish: return D.Orcish;
    case M.Daedric: return D.Daedric;
    default: return D.Unchanged;
  }
}

const byIndex = new Map(templates.map((t) => [t.index, t]));

// ItemBuilder.CalculateWeightForMaterial, verbatim (quarter-kg math).
// Unity Mathf.Round is round-half-to-EVEN (banker's), not JS half-up -
// 4.5kg Daedric hits 22.5 quarter-kgs exactly, DFU rounds to 22.
const roundHalfEven = (x) => { const f = Math.floor(x); return (x - f === 0.5) ? (f % 2 === 0 ? f : f + 1) : Math.round(x); };
export function weightForMaterial(weightInKg, material) {
  const quarterKgs = Math.trunc(weightInKg * 4);
  const matQuarterKgs = (quarterKgs * weightMultipliersByMaterial[material]) / 4;
  return roundHalfEven(matQuarterKgs) / 4;
}

/** ItemBuilder.ApplyWeaponMaterial as a pure builder: template row +
 *  material -> the item record. value *= 3 * valueMult; weight via the
 *  quarter-kg rule; maxCondition = hitPoints * condMult / 4 (int);
 *  dye from GetWeaponDyeColor; female uses playerTextureArchive - 1. */
export function buildWeapon(templateIndex, material, { female = false } = {}) {
  const t = byIndex.get(templateIndex);
  if (!t) return null;
  const maxCondition = Math.trunc((t.hitPoints * conditionMultipliersByMaterial[material]) / 4);
  return {
    templateIndex,
    name: t.name,
    nativeMaterialValue: material,
    value: t.basePrice * 3 * valueMultipliersByMaterial[material],
    weightInKg: weightForMaterial(t.baseWeight, material),
    maxCondition,
    currentCondition: maxCondition,
    dyeColor: weaponDyeColor(material),
    minDamage: weaponMinDamage(templateIndex),
    maxDamage: weaponMaxDamage(templateIndex),
    materialModifier: weaponMaterialModifier(material),
    toHitModifier: weaponToHit(material),
    isOneHanded: t.isOneHanded,
    playerTextureArchive: t.playerTextureArchive - (female ? 1 : 0),
    playerTextureRecord: t.playerTextureRecord,
  };
}

/** RGB shade ramp for a weapon material: the classic metal colour
 *  table (dyes.js METAL_TABLES, extraction-generated) resolved through
 *  ART_PAL. `palGet(index) -> {r,g,b}`. Dark -> light for shadePiece. */
export function weaponMaterialRamp(material, palGet) {
  const idx = getDyeColorTable(weaponDyeColor(material), DYE_TARGETS.WeaponsAndArmor);
  return idx.map((i) => { const c = palGet(i); return [c.r, c.g, c.b]; });
}
