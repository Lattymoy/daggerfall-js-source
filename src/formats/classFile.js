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

/**
 * HARD3 - ONE CAREER, as a CLASS*.CFG record carries it. DFCareer's
 * StructureData, field for field, and the shape the character import
 * hands the live entity (`systems/classicSave.js`).
 *
 * @typedef {object} ClassCareer
 * @property {string} name              16 bytes, NUL-terminated
 * @property {number} resistanceFlags
 * @property {number} immunityFlags
 * @property {number} lowToleranceFlags
 * @property {number} criticalWeaknessFlags
 * @property {number} abilityFlagsAndSpellPointsBitfield
 * @property {number} rapidHealing
 * @property {number} regeneration
 * @property {number} unknown1
 * @property {number} spellAbsorptionFlags
 * @property {number} attackModifierFlags
 * @property {number} forbiddenMaterialsFlags
 * @property {number} weaponArmorShieldsBitfield
 * @property {number[]} primarySkills   3
 * @property {number[]} majorSkills     3
 * @property {number[]} minorSkills     6
 * @property {number} hitPointsPerLevel
 * @property {number} advancementMultiplierRaw  the 16.16 fixed-point as stored
 * @property {number} advancementMultiplier     the same, rounded to two decimals as DFU formats it
 * @property {number} strength
 * @property {number} intelligence
 * @property {number} willpower
 * @property {number} agility
 * @property {number} endurance
 * @property {number} personality
 * @property {number} speed
 * @property {number} luck
 */

export class ClassFile {
  /** @type {ClassCareer|null} */
  career = null;

  /** @param {Uint8Array} bytes - a CLASS*.CFG record */
  load(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let o = 0;
    const u8 = () => v.getUint8(o++);
    const u16 = () => { const x = v.getUint16(o, true); o += 2; return x; };
    const u32 = () => { const x = v.getUint32(o, true); o += 4; return x; };
    const c = /** @type {ClassCareer} */ ({});
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
    // 16.16 fixed-point, then DFU rounds to two decimals via string
    // format (DFCareer.StructureData:585-588) - stored CONVERTED;
    // the raw u32 kept alongside for byte-parity checks.
    c.advancementMultiplierRaw = u32();
    {
      const v = (c.advancementMultiplierRaw >>> 16) + (c.advancementMultiplierRaw & 0xffff) / 65536;
      c.advancementMultiplier = Math.round(v * 100) / 100;
    }
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
