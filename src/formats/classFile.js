// CLASS*.CFG reader (E3a). Verbatim port of DFU API/ClassFile.cs
// ReadFile + DFCareer.StructureData attribute mapping (MIT,
// Daggerfall Workshop). One sequential 74-byte record:
//   u8  ResistanceFlags, ImmunityFlags, LowToleranceFlags,
//       CriticalWeaknessFlags
//   u16 AbilityFlagsAndSpellPointsBitfield
//   u8  RapidHealing, Regeneration, Unknown1, SpellAbsorptionFlags,
//       AttackModifierFlags
//   u16 ForbiddenMaterialsFlags
//   u8 a, u8 b, u8 c -> WeaponArmorShields = (a<<16)|(c<<8)|b
//       (the source's exact byte shuffle)
//   u8 x3 primary skills, u8 x3 major, u8 x6 minor
//   16-byte C-string name
//   8 unknown bytes
//   u16 HitPointsPerLevel
//   u32 AdvancementMultiplier
//   u16 x8 attributes -> Strength, Intelligence, Willpower, Agility,
//       Endurance, Personality, Speed, Luck (DFCareer.StructureData
//       order, indices 0..7)
// All values little-endian (classic x86 data).

export class ClassFile {
  /** @param {Uint8Array} bytes - a CLASS*.CFG record */
  load(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let o = 0;
    const u8 = () => v.getUint8(o++);
    const u16 = () => { const x = v.getUint16(o, true); o += 2; return x; };
    const u32 = () => { const x = v.getUint32(o, true); o += 4; return x; };
    const c = {};
    c.resistanceFlags = u8();
    c.immunityFlags = u8();
    c.lowToleranceFlags = u8();
    c.criticalWeaknessFlags = u8();
    c.abilityFlagsAndSpellPointsBitfield = u16();
    c.rapidHealing = u8();
    c.regeneration = u8();
    c.unknown1 = u8();
    c.spellAbsorptionFlags = u8();
    c.attackModifierFlags = u8();
    c.forbiddenMaterialsFlags = u16();
    const a = u8(), b = u8(), cc = u8();
    c.weaponArmorShieldsBitfield = ((a << 16) | (cc << 8) | b) >>> 0;
    c.primarySkills = [u8(), u8(), u8()];
    c.majorSkills = [u8(), u8(), u8()];
    c.minorSkills = [u8(), u8(), u8(), u8(), u8(), u8()];
    let name = '';
    for (let i = 0; i < 16; i++) name += String.fromCharCode(u8());
    c.name = name.split('\0')[0];
    o += 8;   // Unknown2
    c.hitPointsPerLevel = u16();
    c.advancementMultiplier = u32();
    c.strength = u16();
    c.intelligence = u16();
    c.willpower = u16();
    c.agility = u16();
    c.endurance = u16();
    c.personality = u16();
    c.speed = u16();
    c.luck = u16();
    this.career = c;
    return true;
  }
}
