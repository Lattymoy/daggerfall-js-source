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
