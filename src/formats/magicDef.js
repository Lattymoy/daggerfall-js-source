// MAGIC.DEF reader (Systems S4c). Verbatim port of DFU
// MagicItemsFile.cs (MIT, Daggerfall Workshop): an i32 record count,
// then per record: index = the record's STREAM POSITION (the source's
// own identity key), 32-byte C-string name, type u8
// (0 RegularMagicItem / 1 ArtifactClass1 / 2 ArtifactClass2),
// group u8, groupIndex u8, 10 x { type s8, param s8 } enchantments,
// uses i16, value i32, material u8 - 62 bytes per record.

export const MAGIC_ITEM_NAME_LENGTH = 32;
export const MAGIC_ITEM_RECORD_SIZE = 62;
export const MAGIC_ITEM_TYPES = Object.freeze({ RegularMagicItem: 0, ArtifactClass1: 1, ArtifactClass2: 2 });

/** EnchantmentTypes (ItemsFile.cs:111-141), verbatim. V3 re-homed it
 *  HERE from systems/enchantments.js (which re-exports): the enum is
 *  FallExe's - this file reads the records that carry it - and the
 *  artifact registry needs it without closing an import cycle with
 *  the enchantment system that consumes the registry. */
export const ENCHANTMENT_TYPES = Object.freeze({
  None: -1,
  CastWhenUsed: 0, CastWhenHeld: 1, CastWhenStrikes: 2, ExtraSpellPts: 3,
  PotentVs: 4, RegensHealth: 5, VampiricEffect: 6, IncreasedWeightAllowance: 7,
  RepairsObjects: 8, AbsorbsSpells: 9, EnhancesSkill: 10, FeatherWeight: 11,
  StrengthensArmor: 12, ImprovesTalents: 13, GoodRepWith: 14, SoulBound: 15,
  ItemDeteriorates: 16, UserTakesDamage: 17, VisionProblems: 18,
  WalkingProblems: 19, LowDamageVs: 20, HealthLeech: 21, BadReactionsFrom: 22,
  ExtraWeight: 23, WeakensArmor: 24, BadRepWith: 25, SpecialArtifactEffect: 26,
});

export function readMagicDef(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = v.getInt32(0, true);
  const items = [];
  let o = 4;
  for (let r = 0; r < count && o + MAGIC_ITEM_RECORD_SIZE <= bytes.byteLength; r++) {
    const index = o;   // stream position, per the source
    let name = '';
    for (let i = 0; i < MAGIC_ITEM_NAME_LENGTH; i++) name += String.fromCharCode(v.getUint8(o + i));
    name = name.split('\0')[0];
    o += MAGIC_ITEM_NAME_LENGTH;
    const type = v.getUint8(o++);
    const group = v.getUint8(o++);
    const groupIndex = v.getUint8(o++);
    const enchantments = [];
    for (let i = 0; i < 10; i++) enchantments.push({ type: v.getInt8(o++), param: v.getInt8(o++) });
    const uses = v.getInt16(o, true); o += 2;
    const value = v.getInt32(o, true); o += 4;
    const material = v.getUint8(o++);
    items.push({ index, name, type, group, groupIndex, enchantments, uses, value, material });
  }
  return items;
}
