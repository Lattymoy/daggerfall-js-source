// CharacterRecord parse (SAV1). 1:1 translation of DFU API/Save/
// CharacterRecord.cs ReadCharacterData (MIT, Daggerfall Workshop) - the
// player character as stored in a SAVETREE.DAT record of type 0x03.
// The record data (beyond the 71-byte record root) is read at DFU's
// exact seek offsets; the gaps between them are real unknown bytes.
//
// Shapes: stats are 8-wide arrays in DFCareer.Stats order (0 Strength
// .. 7 Luck, the statMods charter); skills/skillUses are 35-wide in
// DFCareer.Skills order (the skills.js charter). The career at 0x230
// reads through the ONE ClassFile reader (classFile.js), exactly as
// DFU's ReadCareer wraps ClassFile.Load.
//
// The vampire/lycanthrope strip (StripTransformedRace) and the
// CharacterDocument conversion live in systems/classicSave.js - they
// need the skill/race/clan enums, which are systems exports, and
// formats stays a leaf layer.

import { ClassFile } from './classFile.js';
import { readCStringFixed } from './saveTreeFile.js';

/** ReadEquippedItems' const - 27 equip slots of RecordID. */
export const EQUIPPED_ITEM_COUNT = 27;

/** ReadSkills' stride: value i16, uses-counter i16, then an i16 that
 *  "seems to always be 00". 35 skills. */
const SKILL_COUNT = 35;

/** CharacterRecord.ReadCharacterData.
 *  @param {Uint8Array} recordData - the record data AFTER the record
 *  root (SaveTreeBaseRecord.RecordData). */
export function parseCharacterRecordData(recordData) {
  const v = new DataView(recordData.buffer, recordData.byteOffset, recordData.byteLength);
  const d = {};

  d.characterName = readCStringFixed(recordData, 0, 32);

  // ReadStats x2 - permanent values, 8 x i16.
  const readStats = (o) => {
    const stats = new Array(8);
    for (let i = 0; i < 8; i++) stats[i] = v.getInt16(o + i * 2, true);
    return stats;
  };
  d.currentStats = readStats(0x20);
  d.baseStats = readStats(0x30);

  // ReadGender: "Daggerfall uses a wide range of gender values ... the
  // first bit maps 0 male / 1 female". 0=male 1=female, Genders order.
  d.gender = (recordData[0x40] & 1) === 1 ? 1 : 0;
  d.transportationFlags = recordData[0x41];   // x1 Foot, x2 Horse, x4 Cart
  d.minMetalToHit = recordData[0x42];
  d.race = recordData[0x43];                  // 0-based here; live race is +1 (EntityEnums.Races)

  const armorValues = new Array(7);
  for (let i = 0; i < 7; i++) armorValues[i] = v.getInt8(0x44 + i);
  d.armorValues = armorValues;

  d.skillsRaisedThisLevel1 = v.getUint32(0x50, true);   // flags, skills 0-31
  d.skillsRaisedThisLevel2 = v.getUint32(0x54, true);   // flags, skills 32-34
  d.startingLevelUpSkillSum = v.getInt32(0x58, true);
  d.baseHealth = v.getInt16(0x5c, true);

  d.lastTimeUrgeToHuntInnocentSatisfied = v.getUint32(0x60, true);
  d.timeAfterWhichShieldEffectWillEnd = v.getUint32(0x64, true);
  d.unknownLycanthropy = v.getInt16(0x68, true);
  d.incubatingLycanthropy = v.getInt16(0x6c, true);     // 0 none, 1 werewolf, 2 wereboar

  d.playerHouse = v.getUint32(0x74, true);              // building id, 0 = none
  d.playerShip = v.getUint32(0x78, true);
  d.currentHealth = v.getInt16(0x7c, true);
  d.maxHealth = v.getInt16(0x7e, true);
  d.faceIndex = recordData[0x80];
  d.level = recordData[0x81];
  d.reflexes = recordData[0x83];                        // PlayerReflexes value

  d.physicalGold = v.getUint32(0x85, true);
  d.magicEffects1 = recordData[0x89];   // x1 paralyzed .. x80 regenerating
  d.magicEffects2 = recordData[0x8a];   // x1 silenced .. x80 climbing
  d.magicEffects3 = recordData[0x8b];   // x1 jumping .. x80 detect
  d.magicEffects4 = recordData[0x8c];   // x1 darkness .. x80 resist magicka
  d.currentSpellPoints = v.getInt16(0x8d, true);
  d.maxSpellPoints = v.getInt16(0x8f, true);

  // The READ order is commoners, merchants, scholars, nobility,
  // underworld (ReadCharacterData:228-232) - the struct declares
  // nobility before scholars, but the stream doesn't.
  d.reputationCommoners = v.getInt16(0x91, true);
  d.reputationMerchants = v.getInt16(0x93, true);
  d.reputationScholars = v.getInt16(0x95, true);
  d.reputationNobility = v.getInt16(0x97, true);
  d.reputationUnderworld = v.getInt16(0x99, true);

  d.currentFatigue = v.getUint16(0x9b, true);

  // ReadSkills: 35 x { value i16, uses i16, always-zero i16 }.
  d.skills = new Array(SKILL_COUNT);
  d.skillUses = new Array(SKILL_COUNT);
  for (let i = 0; i < SKILL_COUNT; i++) {
    const o = 0x9d + i * 6;
    d.skills[i] = v.getInt16(o, true);
    d.skillUses[i] = v.getInt16(o + 2, true);
  }

  // ReadEquippedItems: 27 x u32 RecordIDs, straight after the skills.
  d.equippedItems = new Array(EQUIPPED_ITEM_COUNT);
  for (let i = 0; i < EQUIPPED_ITEM_COUNT; i++) {
    d.equippedItems[i] = v.getUint32(0x16f + i * 4, true);
  }

  d.race2 = recordData[0x1f2];   // original race while transformed
  d.timeToBecomeVampireOrWerebeast = v.getUint32(0x1f3, true);
  d.hasStartedInitialVampireQuest = recordData[0x1f8];
  d.lastTimeVampireNeedToKillSatiated = v.getUint32(0x1fd, true);
  d.lastTimePlayerAteOrDrankAtTavern = v.getUint32(0x205, true);
  d.lastTimePlayerBoughtTraining = v.getUint32(0x209, true);
  d.timeForThievesGuildLetter = v.getUint32(0x211, true);
  d.timeForDarkBrotherhoodLetter = v.getUint32(0x215, true);
  d.shieldEffectAmount = v.getUint32(0x219, true);
  d.vampireClan = recordData[0x21d];
  d.darkBrotherhoodRequirementTally = recordData[0x21f];
  d.thievesGuildRequirementTally = recordData[0x222];

  d.biographyReactionMod = v.getInt8(0x224);
  d.resistanceToFire = recordData[0x225];
  d.resistanceToFrost = recordData[0x226];
  d.resistanceToDiseaseAndPoison = recordData[0x227];
  d.resistanceToShock = recordData[0x228];
  d.resistanceToMagicka = recordData[0x229];

  // ReadCareer: a full CLASS*.CFG record at 0x230, through the one
  // ClassFile reader.
  const classFile = new ClassFile();
  classFile.load(recordData.subarray(0x230));
  d.career = classFile.career;

  return d;
}
