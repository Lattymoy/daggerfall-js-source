// SPELLS.STD reader (Systems S4a). Verbatim port of DFU
// DaggerfallSpellReader.cs (MIT, Daggerfall Workshop). One 0x59
// (89-byte) record per classic spell:
//   3 x { type s8, subType s8 }   - NOTE: the source's
//       `if (type == 0xFF) continue;` can NEVER be true (C# promotes
//       sbyte -1 to int -1, not 255), so subType is ALWAYS read -
//       the dead branch is documented, the LAYOUT is 6 bytes, and
//       the record arithmetic (6+1+1+2+4+9+9+15+25+1+1+15 = 89)
//       proves it
//   element u8, rangeType u8, cost u16, 4 skip
//   3 x { durationBase, durationMod, durationPerLevel } u8
//   3 x { chanceBase, chanceMod, chancePerLevel } u8
//   3 x { magnitudeBaseLow, magnitudeBaseHigh, magnitudeLevelBase,
//         magnitudeLevelHigh, magnitudePerLevel } u8
//   25-byte C-string name, icon u8, index u8, 15 skip
// A record is valid when any effect type > -1 (the reader's own
// gate); invalid records are skipped, matching ReadSpellsFile.

export const SPELL_RECORD_SIZE = 0x59;

export function readSpellsStd(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const spells = [];
  let o = 0;
  while (o + SPELL_RECORD_SIZE <= bytes.byteLength) {
    const start = o;
    const effects = [];
    for (let i = 0; i < 3; i++) {
      const type = v.getInt8(o++);
      const subType = v.getInt8(o++);   // always read (see the dead-branch note above)
      effects.push({ type, subType });
    }
    const element = v.getUint8(o++);
    const rangeType = v.getUint8(o++);
    const cost = v.getUint16(o, true); o += 2;
    o += 4;
    for (const e of effects) { e.durationBase = v.getUint8(o++); e.durationMod = v.getUint8(o++); e.durationPerLevel = v.getUint8(o++); }
    for (const e of effects) { e.chanceBase = v.getUint8(o++); e.chanceMod = v.getUint8(o++); e.chancePerLevel = v.getUint8(o++); }
    for (const e of effects) {
      e.magnitudeBaseLow = v.getUint8(o++); e.magnitudeBaseHigh = v.getUint8(o++);
      e.magnitudeLevelBase = v.getUint8(o++); e.magnitudeLevelHigh = v.getUint8(o++);
      e.magnitudePerLevel = v.getUint8(o++);
    }
    let name = '';
    for (let i = 0; i < 25; i++) name += String.fromCharCode(v.getUint8(o++));
    name = name.split('\0')[0];
    const icon = v.getUint8(o++);
    const index = v.getUint8(o++);
    o = start + SPELL_RECORD_SIZE;
    if (effects[0].type > -1 || effects[1].type > -1 || effects[2].type > -1) {
      spells.push({ effects, element, rangeType, cost, name, icon, index });
    }
  }
  return spells;
}
