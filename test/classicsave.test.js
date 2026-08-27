// SAV1 - the classic .SAV reader (DFU API/Save, verbatim). Synthetic
// fixtures are built byte-for-byte to the C# layouts and pinned with
// deepEqual against literals, so a one-character mutation of any
// offset, width or constant in the readers breaks a pin. Real-save
// corpus validation is gated on classic SAVE0-SAVE5 directories
// sitting beside ARENA2 (the classic install layout SaveGames.cs
// walks) and skips without them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  SaveTree, RECORD_TYPES, ENVIRONMENTS, ITEM_FLAGS,
  SAVE_TREE_HEADER_LENGTH, SAVE_TREE_VERSION,
  RECORD_ROOT_LENGTH, LIGHT_DATA_LENGTH_MULTIPLIER,
  readSaveTreeHeader, readBuildingRecords, readRecordRoot,
  parseItemRecordData, parseGuildMembershipRecordData,
  parseDiseaseOrPoisonRecordData, isWagonRecord,
  readCStringFixed, readCStringScan,
} from '../src/formats/saveTreeFile.js';
import { parseCharacterRecordData, EQUIPPED_ITEM_COUNT } from '../src/formats/characterRecord.js';
import { readSpellRecord, SPELL_RECORD_SIZE } from '../src/formats/spellsStd.js';
import {
  SaveVars, TRAVEL_FLAGS, CHEAT_FLAGS, SHIP_TYPES, EMPEROR_SON_NAMES,
} from '../src/formats/saveVarsFile.js';
import { SaveImage, SAVE_IMAGE_WIDTH, SAVE_IMAGE_HEIGHT } from '../src/formats/saveImageFile.js';
import { BioFile } from '../src/formats/bioFile.js';
import {
  SaveGames, readMapSaveDiscovery, MAPSAVE_DISCOVERED_FLAG, CLASSIC_SAVE_COUNT,
} from '../src/formats/saveGames.js';
import { BsaFile } from '../src/formats/bsaFile.js';
import { stripTransformedRace, toCharacterDocument, TRANSFORMED_RACES } from '../src/systems/classicSave.js';
import { SKILLS } from '../src/systems/skills.js';
import { VAMPIRE_CLANS, LYCANTHROPY_TYPES } from '../src/systems/infection.js';

// ---------------------------------------------------------------- helpers

class Writer {
  constructor(size) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }
  u8(o, x) { this.bytes[o] = x; }
  i8(o, x) { this.view.setInt8(o, x); }
  u16(o, x) { this.view.setUint16(o, x, true); }
  i16(o, x) { this.view.setInt16(o, x, true); }
  u32(o, x) { this.view.setUint32(o, x, true); }
  i32(o, x) { this.view.setInt32(o, x, true); }
  str(o, s) { for (let i = 0; i < s.length; i++) this.bytes[o + i] = s.charCodeAt(i); }
}

const concat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// A 71-byte record root. Byte 0 is the record type (PeekRecordType's
// read); the field offsets are ReadRecordRoot's.
function buildRecordRoot({ type, recordId, parentRecordId = 0, spriteIndex = 0, questId = 0, time = 0 }) {
  const w = new Writer(RECORD_ROOT_LENGTH);
  w.u8(0, type);
  w.i16(1, -100); w.i16(3, 200); w.i16(5, -300);        // pitch/yaw/roll
  w.i32(7, 111); w.i32(11, -222); w.i32(15, 333);        // position
  w.u16(27, spriteIndex);
  w.u16(29, 0x5678);                                     // picture2
  w.u32(31, recordId);
  w.u8(38, questId);
  w.u32(39, parentRecordId);
  w.u32(43, time);
  w.u32(47, 1); w.u32(51, 2); w.u32(55, 3); w.u32(59, 4); w.u32(63, 5);
  w.i32(67, 0x21);                                       // parentRecordType
  return w.bytes;
}

// One RecordElement: i32 stored length + payload.
function buildElement(storedLength, payload) {
  const w = new Writer(4);
  w.i32(0, storedLength);
  return concat(w.bytes, payload);
}

// A 74-byte CLASS*.CFG record for the character's career.
function buildClassRecord() {
  const w = new Writer(74);
  w.u8(0, 1); w.u8(1, 2); w.u8(2, 3); w.u8(3, 4);
  w.u16(4, 0x1234);
  w.u8(6, 5); w.u8(7, 6); w.u8(8, 7); w.u8(9, 8); w.u8(10, 9);
  w.u16(11, 0x0102);
  w.u8(13, 0x11); w.u8(14, 0x22); w.u8(15, 0x33);
  w.str(28, 'TestClass');
  w.u16(52, 14);                 // hitPointsPerLevel
  w.u32(54, 0x00028000);         // 2.5 in 16.16
  for (let i = 0; i < 8; i++) w.u16(58 + i * 2, 40 + i);
  return w.bytes;
}

// The character record data (beyond the root): 0x230 + 74 bytes.
function buildCharacterData({ race = 1, race2 = 0, gender = 3, vampireClan = 0 } = {}) {
  const w = new Writer(0x230 + 74);
  w.str(0, 'Alaric');
  for (let i = 0; i < 8; i++) w.i16(0x20 + i * 2, 51 + i);   // currentStats
  for (let i = 0; i < 8; i++) w.i16(0x30 + i * 2, 41 + i);   // baseStats
  w.u8(0x40, gender);
  w.u8(0x41, 5);        // transportationFlags: foot + cart
  w.u8(0x42, 2);        // minMetalToHit
  w.u8(0x43, race);
  const armor = [-1, 2, -3, 4, -5, 6, -7];
  for (let i = 0; i < 7; i++) w.i8(0x44 + i, armor[i]);
  w.u32(0x50, 0xa1b2c3d4);
  w.u32(0x54, 7);
  w.i32(0x58, -123);
  w.i16(0x5c, 77);      // baseHealth
  w.u32(0x60, 111111);
  w.u32(0x64, 222222);
  w.i16(0x68, -5);
  w.i16(0x6c, 2);
  w.u32(0x74, 4242);
  w.u32(0x78, 0);
  w.i16(0x7c, 55);
  w.i16(0x7e, 90);      // maxHealth - deliberately NOT baseHealth
  w.u8(0x80, 6);
  w.u8(0x81, 13);
  w.u8(0x83, 4);
  w.u32(0x85, 100000);
  w.u8(0x89, 1); w.u8(0x8a, 2); w.u8(0x8b, 4); w.u8(0x8c, 8);
  w.i16(0x8d, 25);
  w.i16(0x8f, 40);
  // Reputation READ order: commoners, merchants, scholars, nobility,
  // underworld.
  w.i16(0x91, 10); w.i16(0x93, -20); w.i16(0x95, 30); w.i16(0x97, -40); w.i16(0x99, 50);
  w.u16(0x9b, 800);
  for (let i = 0; i < 35; i++) {
    w.i16(0x9d + i * 6, 20 + i);
    w.i16(0x9d + i * 6 + 2, i * 3);
    // third i16 stays zero
  }
  for (let i = 0; i < EQUIPPED_ITEM_COUNT; i++) w.u32(0x16f + i * 4, 1000 + i);
  w.u8(0x1f2, race2);
  w.u32(0x1f3, 333333);
  w.u8(0x1f8, 1);
  w.u32(0x1fd, 444444);
  w.u32(0x205, 555555);
  w.u32(0x209, 666666);
  w.u32(0x211, 777777);
  w.u32(0x215, 888888);
  w.u32(0x219, 99);
  w.u8(0x21d, vampireClan);
  w.u8(0x21f, 3);
  w.u8(0x222, 4);
  w.i8(0x224, -2);
  w.u8(0x225, 11); w.u8(0x226, 12); w.u8(0x227, 13); w.u8(0x228, 14); w.u8(0x229, 15);
  w.bytes.set(buildClassRecord(), 0x230);
  return w.bytes;
}

// The 107-byte native item data.
function buildItemData() {
  const w = new Writer(107);
  w.str(0, 'Iron Sword');
  w.str(11, 'junk after the NUL');   // must NOT reach the parsed name
  w.u16(32, 3);          // group
  w.u16(34, 0x1234);     // index
  w.u32(36, 999);        // value
  w.u16(40, 0xaaaa);     // unknown
  w.u16(42, ITEM_FLAGS.OneHandedWeapon | ITEM_FLAGS.Enchanted);
  w.u16(44, 750);        // currentCondition
  w.u16(46, 1000);       // maxCondition
  w.u8(48, 7);           // unknown2
  w.u8(49, 30);          // typeDependentData
  w.u16(50, 0x0102);     // image1
  w.u16(52, 0x0304);     // image2
  w.u16(54, 2);          // material
  w.u8(56, 9);           // color
  w.u32(57, 450);        // weight
  w.u16(61, 1500);       // enchantmentPoints
  w.u16(63, 4000);       // message
  w.u8(65, 2);           // variants
  w.u8(66, 1);           // drawOrderOrEffect
  for (let i = 0; i < 10; i++) {
    w.i16(67 + i * 4, i % 2 ? -1 : 100 + i);
    w.i16(69 + i * 4, 7 * i);
  }
  return w.bytes;
}

// An 89-byte spell record.
function buildSpellData({ types = [1, 3, -1] } = {}) {
  const w = new Writer(SPELL_RECORD_SIZE);
  const subTypes = [2, 4, -1];
  for (let i = 0; i < 3; i++) { w.i8(i * 2, types[i]); w.i8(i * 2 + 1, subTypes[i]); }
  w.u8(6, 2);            // element
  w.u8(7, 3);            // rangeType
  w.u16(8, 111);         // cost
  let o = 14;
  for (let i = 0; i < 3; i++) { w.u8(o++, 10 + i); w.u8(o++, 20 + i); w.u8(o++, 30 + i); }
  for (let i = 0; i < 3; i++) { w.u8(o++, 40 + i); w.u8(o++, 50 + i); w.u8(o++, 60 + i); }
  for (let i = 0; i < 3; i++) {
    w.u8(o++, 70 + i); w.u8(o++, 80 + i); w.u8(o++, 90 + i); w.u8(o++, 100 + i); w.u8(o++, 110 + i);
  }
  w.str(o, 'Test Spell'); o += 25;
  w.u8(o++, 9);          // icon
  w.u8(o++, 77);         // index
  return w.bytes;
}

// A whole SAVETREE.DAT.
function buildSaveTreeFile() {
  const header = new Writer(SAVE_TREE_HEADER_LENGTH);
  header.i32(0, SAVE_TREE_VERSION);
  header.i32(4, 1000); header.i32(8, 2000); header.i32(12, 3000);
  header.u16(16, 0xabcd);
  header.u8(18, ENVIRONMENTS.Dungeon);

  // Two 26-byte building records behind an i32 length.
  const buildings = new Writer(4 + 52);
  buildings.i32(0, 52);
  for (let i = 0; i < 2; i++) {
    const o = 4 + i * 26;
    buildings.u16(o, 1111 + i);
    buildings.u32(o + 2, 22222 + i);
    buildings.u16(o + 6, 1 + i); buildings.u16(o + 8, 2 + i);
    buildings.u32(o + 10, 3 + i); buildings.u32(o + 14, 4 + i);
    buildings.u16(o + 18, 510 + i);
    buildings.i16(o + 20, -6 - i);
    buildings.u16(o + 22, 7777 + i);
    buildings.u8(o + 24, 12 + i);
    buildings.u8(o + 25, 9 + i);
  }

  const worldRoot = buildRecordRoot({ type: RECORD_TYPES.World, recordId: 1 });
  const charData = buildCharacterData();
  const charRecord = concat(buildRecordRoot({ type: RECORD_TYPES.Character, recordId: 2, parentRecordId: 1 }), charData);
  const itemRecord = concat(buildRecordRoot({ type: RECORD_TYPES.Item, recordId: 3, parentRecordId: 2 }), buildItemData());
  const dupItem = concat(buildRecordRoot({ type: RECORD_TYPES.Item, recordId: 3, parentRecordId: 1 }), buildItemData());
  // A Light record: stored length 3, actual data 3 x 39 = 117 bytes.
  const lightData = new Uint8Array(3 * LIGHT_DATA_LENGTH_MULTIPLIER);
  lightData.set(buildRecordRoot({ type: RECORD_TYPES.Light, recordId: 4, parentRecordId: 1 }));
  const containerRecord = concat(
    buildRecordRoot({ type: RECORD_TYPES.Container, recordId: 5, parentRecordId: 2, spriteIndex: 4 }),
    Uint8Array.of(150));

  return concat(
    header.bytes,
    buildings.bytes,
    buildElement(worldRoot.length, worldRoot),
    buildElement(charRecord.length, charRecord),
    buildElement(itemRecord.length, itemRecord),
    Uint8Array.of(0, 0, 0, 0),                       // a zero-length record - skipped
    buildElement(dupItem.length, dupItem),           // duplicate RecordID - dropped
    buildElement(3, lightData),                      // the x39 light
    buildElement(containerRecord.length, containerRecord),
    // ReadRecords rejects a record ending exactly at EOF (`>=`), so a
    // real stream always has bytes after the last record; classic pads
    // and so do we.
    Uint8Array.of(0, 0, 0, 0),
  );
}

// ---------------------------------------------------------------- savetree

test('savetree: header parses at the C# offsets and pins the 0x126 version gate', () => {
  const bytes = buildSaveTreeFile();
  const header = readSaveTreeHeader(bytes);
  assert.deepEqual(
    {
      version: header.version,
      characterPosition: header.characterPosition,
      mapId: header.mapId,
      environment: header.environment,
    },
    {
      version: 0x126,
      characterPosition: { position: { worldX: 1000, worldY: 2000, worldZ: 3000 } },
      mapId: 0xabcd,
      environment: 3,
    });
  assert.equal(header.rawData.length, 19);

  const bad = bytes.slice();
  new DataView(bad.buffer).setInt32(0, 0x125, true);
  assert.throws(() => readSaveTreeHeader(bad), /0x126/);
});

test('savetree: building records are 26-byte BuildingData in the blocksFile shape', () => {
  const bytes = buildSaveTreeFile();
  const { record } = readBuildingRecords(bytes, SAVE_TREE_HEADER_LENGTH);
  assert.equal(record.recordLength, 52);
  assert.equal(record.numberOfBuildings, 2);
  assert.deepEqual(record.recordData[1], {
    nameSeed: 1112, serviceTimeLimit: 22223,
    unknown: 2, unknown2: 3, unknown3: 4, unknown4: 5,
    factionId: 511, sector: -7, locationId: 7778,
    buildingType: 13, quality: 10,
  });
});

test('savetree: the record root reads at its exact classic offsets', () => {
  const root = readRecordRoot(buildRecordRoot({
    type: RECORD_TYPES.Item, recordId: 9, parentRecordId: 4,
    spriteIndex: 21, questId: 8, time: 123456,
  }));
  assert.deepEqual(root, {
    pitch: -100, yaw: 200, roll: -300,
    position: { worldX: 111, worldY: -222, worldZ: 333 },
    spriteIndex: 21, picture2: 0x5678, recordId: 9, questId: 8,
    parentRecordId: 4, time: 123456,
    itemObject: 1, questObjectId: 2, nextObject: 3, childObject: 4,
    sublistHead: 5, parentRecordType: 0x21,
  });
});

test('savetree: the tree loads - links, duplicates, zero-length skip, the x39 light', () => {
  const tree = new SaveTree();
  tree.load(buildSaveTreeFile());

  assert.equal(tree.recordDictionary.size, 5);
  assert.equal(tree.duplicateKeysFound, 1);

  const world = tree.recordDictionary.get(1);
  const character = tree.recordDictionary.get(2);
  const item = tree.recordDictionary.get(3);
  const light = tree.recordDictionary.get(4);
  const container = tree.recordDictionary.get(5);

  // LinkChildren: parents by ParentRecordID, orphans under root.
  assert.equal(character.parent, world);
  assert.equal(item.parent, character);
  assert.ok(tree.rootRecord.children.includes(world));
  assert.ok(world.children.includes(light));

  // The light's stored length 3 became 117 bytes of stream data.
  assert.equal(light.streamLength, 3 * LIGHT_DATA_LENGTH_MULTIPLIER);
  assert.equal(light.streamData.length, 117);

  // Find / filter API.
  assert.equal(tree.findRecord(RECORD_TYPES.Character), character);
  const items = tree.findRecords(RECORD_TYPES.Item);
  assert.deepEqual(items, [item]);
  assert.deepEqual(tree.filterRecordsByParentType(items, RECORD_TYPES.Character), [item]);
  assert.deepEqual(tree.filterRecordsByParentType(items, RECORD_TYPES.World), []);

  // ContainerRecord.WagonCheck: root SpriteIndex 4.
  assert.equal(isWagonRecord(container), true);
  assert.deepEqual(container.parsedData, { unknown: Uint8Array.of(150) });
});

test('savetree: item record data parses field-for-field with its ten enchantments', () => {
  const d = parseItemRecordData(buildItemData());
  assert.deepEqual(d, {
    name: 'Iron Sword',
    group: 3, index: 0x1234, value: 999, unknown: 0xaaaa,
    flags: ITEM_FLAGS.OneHandedWeapon | ITEM_FLAGS.Enchanted,
    currentCondition: 750, maxCondition: 1000,
    unknown2: 7, typeDependentData: 30,
    image1: 0x0102, image2: 0x0304, material: 2, color: 9,
    weight: 450, enchantmentPoints: 1500, message: 4000,
    variants: 2, drawOrderOrEffect: 1,
    magic: Array.from({ length: 10 }, (_, i) => ({
      type: i % 2 ? -1 : 100 + i, param: 7 * i,
    })),
  });
});

test('savetree: guild membership and disease records parse to their C# layouts', () => {
  const g = new Writer(13);   // 1+1+1+2+4+1+1+2 - the C# read is 13 bytes
  g.u8(0, 4); g.u8(1, 5); g.u8(2, 6); g.u16(3, 368); g.u32(5, 99999);
  g.u8(9, 1); g.u8(10, 2); g.u16(11, 0x0708);
  assert.deepEqual(parseGuildMembershipRecordData(g.bytes), {
    rank: 4, notedByGuild: 5, guildType: 6, factionId: 368,
    timeOfLastRankChange: 99999, unused: 1, blessingMagnitude: 2, unused2: 0x0708,
  });

  const dz = new Writer(47);
  dz.u8(0, 3);
  for (let i = 0; i < 23; i++) dz.u16(1 + i * 2, 200 + i);
  assert.deepEqual(parseDiseaseOrPoisonRecordData(dz.bytes), {
    id: 3,
    damagesSTR: 200, damagesINT: 201, damagesWIL: 202, damagesAGI: 203,
    damagesEND: 204, damagesPER: 205, damagesSPD: 206, damagesLUC: 207,
    damagesHEA: 208, damagesFAT: 209, damagesSPL: 210,
    minDamage: 211, maxDamage: 212,
    daysOfSymptomsLeft: 213, incubationOver: 214,
    totaldamageSTR: 215, totaldamageINT: 216, totaldamageWIL: 217,
    totaldamageAGI: 218, totaldamageEND: 219, totaldamagePER: 220,
    totaldamageSPD: 221, totaldamageLUC: 222,
  });
});

test('savetree: cstring helpers pin the AUDIT 24 ReadCString law', () => {
  const bytes = Uint8Array.of(65, 66, 0, 67, 0, 0, 68, 69, 0);
  // Fixed length: full stride, trailing NULs trimmed, embedded kept.
  assert.equal(readCStringFixed(bytes, 0, 6), 'AB\0C');
  // Scan: stop at the first NUL.
  assert.equal(readCStringScan(bytes, 0), 'AB');
  assert.equal(readCStringScan(bytes, 3), 'C');
});

// ------------------------------------------------------------- character

test('character record: parses at the C# seek offsets, career through the one ClassFile', () => {
  const d = parseCharacterRecordData(buildCharacterData());
  const { career, ...rest } = d;
  assert.deepEqual(rest, {
    characterName: 'Alaric',
    currentStats: [51, 52, 53, 54, 55, 56, 57, 58],
    baseStats: [41, 42, 43, 44, 45, 46, 47, 48],
    gender: 1,                       // 3 & 1 - only the first bit speaks
    transportationFlags: 5,
    minMetalToHit: 2,
    race: 1,
    armorValues: [-1, 2, -3, 4, -5, 6, -7],
    skillsRaisedThisLevel1: 0xa1b2c3d4,
    skillsRaisedThisLevel2: 7,
    startingLevelUpSkillSum: -123,
    baseHealth: 77,
    lastTimeUrgeToHuntInnocentSatisfied: 111111,
    timeAfterWhichShieldEffectWillEnd: 222222,
    unknownLycanthropy: -5,
    incubatingLycanthropy: 2,
    playerHouse: 4242,
    playerShip: 0,
    currentHealth: 55,
    maxHealth: 90,
    faceIndex: 6,
    level: 13,
    reflexes: 4,
    physicalGold: 100000,
    magicEffects1: 1, magicEffects2: 2, magicEffects3: 4, magicEffects4: 8,
    currentSpellPoints: 25,
    maxSpellPoints: 40,
    reputationCommoners: 10,
    reputationMerchants: -20,
    reputationScholars: 30,
    reputationNobility: -40,
    reputationUnderworld: 50,
    currentFatigue: 800,
    skills: Array.from({ length: 35 }, (_, i) => 20 + i),
    skillUses: Array.from({ length: 35 }, (_, i) => i * 3),
    equippedItems: Array.from({ length: 27 }, (_, i) => 1000 + i),
    race2: 0,
    timeToBecomeVampireOrWerebeast: 333333,
    hasStartedInitialVampireQuest: 1,
    lastTimeVampireNeedToKillSatiated: 444444,
    lastTimePlayerAteOrDrankAtTavern: 555555,
    lastTimePlayerBoughtTraining: 666666,
    timeForThievesGuildLetter: 777777,
    timeForDarkBrotherhoodLetter: 888888,
    shieldEffectAmount: 99,
    vampireClan: 0,
    darkBrotherhoodRequirementTally: 3,
    thievesGuildRequirementTally: 4,
    biographyReactionMod: -2,
    resistanceToFire: 11,
    resistanceToFrost: 12,
    resistanceToDiseaseAndPoison: 13,
    resistanceToShock: 14,
    resistanceToMagicka: 15,
  });
  assert.equal(career.name, 'TestClass');
  assert.equal(career.hitPointsPerLevel, 14);
  assert.equal(career.advancementMultiplier, 2.5);
});

test('character document: the untransformed path is race + 1 and maxHealth is BASEhealth', () => {
  const d = parseCharacterRecordData(buildCharacterData({ race: 1, race2: 0 }));
  const doc = toCharacterDocument(d);
  assert.equal(doc.raceTemplate.id, 2);                   // Redguard
  assert.equal(doc.classicTransformedRace, TRANSFORMED_RACES.None);
  // ToCharacterDocument: doc.maxHealth = parsedData.BASEhealth.
  assert.equal(doc.maxHealth, 77);
  assert.equal(doc.currentHealth, 55);
  assert.equal(doc.name, 'Alaric');
  assert.deepEqual(doc.workingStats, [51, 52, 53, 54, 55, 56, 57, 58]);
  assert.deepEqual(doc.armorValues, [-1, 2, -3, 4, -5, 6, -7]);
  assert.equal(doc.biographyReactionMod, -2);
});

test('character document: the Anthotis vampire strip - +20 stats INCLUDING Int, +30 the six skills', () => {
  // race byte 8 -> live race 9 = Vampire; race2 0 -> restored Breton.
  const d = parseCharacterRecordData(buildCharacterData({
    race: 8, race2: 0, vampireClan: VAMPIRE_CLANS.Anthotis,
  }));
  const { liveRace, classicTransformedRace } = stripTransformedRace(d);
  assert.equal(liveRace, 1);
  assert.equal(classicTransformedRace, TRANSFORMED_RACES.Vampire);
  // Str, Int, Wil, Agi, End, Per, Spd, Luck all -20 (Int only because
  // Anthotis).
  assert.deepEqual(d.currentStats, [31, 32, 33, 34, 35, 36, 37, 38]);
  const expectSkills = Array.from({ length: 35 }, (_, i) => 20 + i);
  for (const s of [SKILLS.Jumping, SKILLS.Running, SKILLS.Stealth,
    SKILLS.CriticalStrike, SKILLS.Climbing, SKILLS.HandToHand]) {
    expectSkills[s] -= 30;
  }
  assert.deepEqual(d.skills, expectSkills);
});

test('character document: a non-Anthotis vampire keeps Intelligence', () => {
  const d = parseCharacterRecordData(buildCharacterData({
    race: 8, race2: 2, vampireClan: VAMPIRE_CLANS.Lyrezi,
  }));
  const { liveRace } = stripTransformedRace(d);
  assert.equal(liveRace, 3);                              // Nord restored
  assert.deepEqual(d.currentStats, [31, 52, 33, 34, 35, 36, 37, 38]);
});

test('character document: the werewolf strip - four stats -40, seven skills -30', () => {
  // race byte 9 -> live race 10 = Werewolf.
  const d = parseCharacterRecordData(buildCharacterData({ race: 9, race2: 3 }));
  const { liveRace, classicTransformedRace } = stripTransformedRace(d);
  assert.equal(liveRace, 4);                              // DarkElf restored
  assert.equal(classicTransformedRace, TRANSFORMED_RACES.Werewolf);
  assert.deepEqual(d.currentStats, [11, 52, 53, 14, 15, 56, 17, 58]);
  const expectSkills = Array.from({ length: 35 }, (_, i) => 20 + i);
  for (const s of [SKILLS.Swimming, SKILLS.Running, SKILLS.Stealth,
    SKILLS.CriticalStrike, SKILLS.Climbing, SKILLS.HandToHand, SKILLS.Jumping]) {
    expectSkills[s] -= 30;
  }
  assert.deepEqual(d.skills, expectSkills);
});

test('character document: stripLycanthropyType strips a NOT-transformed were-character', () => {
  const d = parseCharacterRecordData(buildCharacterData({ race: 1, race2: 0 }));
  const { liveRace, classicTransformedRace } =
    stripTransformedRace(d, LYCANTHROPY_TYPES.Werewolf);
  assert.equal(liveRace, 2);
  assert.equal(classicTransformedRace, TRANSFORMED_RACES.None);
  assert.deepEqual(d.currentStats, [11, 52, 53, 14, 15, 56, 17, 58]);
});

// ----------------------------------------------------------------- spell

test('spell record: the save parse is DaggerfallSpellReader.ReadSpellData, single-sourced', () => {
  const rec = readSpellRecord(buildSpellData());
  assert.deepEqual(rec, {
    effects: [
      {
        type: 1, subType: 2,
        durationBase: 10, durationMod: 20, durationPerLevel: 30,
        chanceBase: 40, chanceMod: 50, chancePerLevel: 60,
        magnitudeBaseLow: 70, magnitudeBaseHigh: 80,
        magnitudeLevelBase: 90, magnitudeLevelHigh: 100, magnitudePerLevel: 110,
      },
      {
        type: 3, subType: 4,
        durationBase: 11, durationMod: 21, durationPerLevel: 31,
        chanceBase: 41, chanceMod: 51, chancePerLevel: 61,
        magnitudeBaseLow: 71, magnitudeBaseHigh: 81,
        magnitudeLevelBase: 91, magnitudeLevelHigh: 101, magnitudePerLevel: 111,
      },
      {
        type: -1, subType: -1,
        durationBase: 12, durationMod: 22, durationPerLevel: 32,
        chanceBase: 42, chanceMod: 52, chancePerLevel: 62,
        magnitudeBaseLow: 72, magnitudeBaseHigh: 82,
        magnitudeLevelBase: 92, magnitudeLevelHigh: 102, magnitudePerLevel: 112,
      },
    ],
    element: 2, rangeType: 3, cost: 111,
    name: 'Test Spell', icon: 9, index: 77,
  });

  // The SetSpellTypes gate: all three types -1 fails the whole parse.
  assert.equal(readSpellRecord(buildSpellData({ types: [-1, -1, -1] })), null);
  // A buffer shorter than one record fails, as the C# length guard does.
  assert.equal(readSpellRecord(buildSpellData().subarray(0, SPELL_RECORD_SIZE - 1)), null);
});

test('spell record: a Spell save-tree record carries the parse, no Free Action patch', () => {
  // Index 10 + effect (3,2) is exactly the shape EntityEffectBroker
  // patches in SPELLS.STD - a save record must keep it unpatched.
  const data = buildSpellData({ types: [3, -1, -1] });
  data[73] = 10;                       // index (offset 47 name + 25, icon, then index)
  const rec = readSpellRecord(data);
  assert.equal(rec.effects[0].type, 3);
  assert.equal(rec.effects[0].subType, 2);
  assert.equal(rec.index, 10);

  // A minimal SAVETREE: header, an EMPTY buildings block, one spell.
  const header = buildSaveTreeFile().subarray(0, SAVE_TREE_HEADER_LENGTH);
  const root = buildRecordRoot({ type: RECORD_TYPES.Spell, recordId: 6 });
  const tree = new SaveTree();
  tree.load(concat(
    header,
    Uint8Array.of(0, 0, 0, 0),                                      // buildings length 0
    buildElement(RECORD_ROOT_LENGTH + data.length, concat(root, data)),
    Uint8Array.of(0, 0, 0, 0),
  ));
  const spell = tree.findRecord(RECORD_TYPES.Spell);
  assert.equal(spell.parsedData.effects[0].subType, 2);
  assert.equal(spell.parsedData.index, 10);
});

// -------------------------------------------------------------- savevars

function buildSaveVarsFile() {
  const w = new Writer(0x17d0 + 2 * 92);
  w.i32(0x30, 1); w.i32(0x34, -2); w.i32(0x38, 3); w.i32(0x3c, -4); w.i32(0x40, 5);
  w.u8(0x7c, 2);                               // Uriel
  w.i16(0xf5, 0x15);                           // cautious + foot/horse + inns
  w.i32(0x33f, 10); w.i32(0x343, 20); w.u32(0x347, 30); w.u32(0x34b, 40);
  for (let i = 0; i < 64; i++) w.u8(0x34f + i, (i * 5) & 0xff);
  w.i16(0x38f, 123);
  w.u8(0x391, 1);                              // isDay
  w.u8(0x3a3, 5);                              // crimeCommitted
  w.u8(0x3a6, 1);                              // inDungeonWater
  w.i32(0x3ab, 42);                            // breathRemaining
  w.u8(0x3bf, 0x42);                           // weaponDrawn: 0x40 set
  w.u32(0x3c9, 987654321);                     // gameTime
  w.u8(0x3d9, 1);                              // usingLeftHandWeapon
  w.u8(0x173b, CHEAT_FLAGS.AllMapLocationsRevealedMode | CHEAT_FLAGS.GodMode);
  w.i32(0x1750, 25600000);                     // small ship
  w.u32(0x179a, 13579);                        // lastSkillCheckTime
  for (let i = 0; i < 6; i++) w.u8(0x17a2 + i, i);   // the DUPLICATE weathers block

  // Region 0 with distinct values; region 61 with a marker legalRep.
  let o = 0x3da;
  for (let j = 0; j < 29; j++) w.u8(o + j, j + 1);
  for (let j = 0; j < 29; j++) w.u8(o + 29 + j, j % 2);
  for (let j = 0; j < 14; j++) w.u8(o + 58 + j, j % 3 === 0 ? 1 : 0);
  w.u8(o + 72, 7); w.u8(o + 73, 9);
  w.i16(o + 74, -12); w.u16(o + 76, 0x1234); w.u16(o + 78, 1024);
  o = 0x3da + 61 * 80;
  w.i16(o + 74, 99);

  // Two factions.
  for (let i = 0; i < 2; i++) {
    const f = 0x17d0 + i * 92;
    w.u8(f, 4); w.i8(f + 1, 17 + i); w.i8(f + 2, -1);
    w.str(f + 3, i === 0 ? 'The Blades' : 'Sentinel');
    w.i16(f + 29, -3); w.i16(f + 31, 60); w.i16(f + 33, 368 + i); w.i16(f + 35, 150);
    w.i16(f + 37, 0x0a0b);
    w.u32(f + 39, 0xdeadbeef); w.i32(f + 43, 45);
    w.i16(f + 47, 2570); w.i16(f + 49, -1);
    w.i8(f + 51, 30); w.i8(f + 52, -1);
    w.i8(f + 53, 3); w.i8(f + 54, 1); w.i8(f + 55, 15);
    w.i32(f + 56, 101); w.i32(f + 60, 102); w.i32(f + 64, 103);
    w.i32(f + 68, 201); w.i32(f + 72, 202); w.i32(f + 76, 203);
    w.i32(f + 80, 301); w.i32(f + 84, 302); w.i32(f + 88, 303);
  }
  return w.bytes;
}

test('savevars: every named offset reads to its field, deepEqual against the fixture', () => {
  const sv = new SaveVars();
  sv.load(buildSaveVarsFile());

  assert.equal(sv.biographyResistDiseaseMod, 1);
  assert.equal(sv.biographyResistMagicMod, -2);
  assert.equal(sv.biographyAvoidHitMod, 3);
  assert.equal(sv.biographyResistPoisonMod, -4);
  assert.equal(sv.biographyFatigueMod, 5);
  assert.equal(sv.emperorSonName, 'Uriel');
  assert.deepEqual(EMPEROR_SON_NAMES,
    ['Pelagius', 'Cephorus', 'Uriel', 'Cassynder', 'Voragiel', 'Trabbatus']);
  assert.equal(sv.cautiousTravel, true);
  assert.equal(sv.footOrHorseTravel, true);
  assert.equal(sv.innsTravel, true);
  assert.equal(sv.maceOfMolagBalSpellPointBonus, 10);
  assert.equal(sv.maceOfMolagBalStrengthBonus, 20);
  assert.equal(sv.maceOfMolagBalSpellPointBonusTimeLimit, 30);
  assert.equal(sv.maceOfMolagBalStrengthBonusTimeLimit, 40);
  assert.deepEqual(sv.globalVars,
    Uint8Array.from({ length: 64 }, (_, i) => (i * 5) & 0xff));
  assert.equal(sv.lastSpellCost, 123);
  assert.equal(sv.isDay, true);
  assert.equal(sv.crimeCommitted, 5);
  assert.equal(sv.inDungeonWater, true);
  assert.equal(sv.breathRemaining, 42);
  assert.deepEqual(sv.climateWeathers, Uint8Array.of(0, 1, 2, 3, 4, 5));
  assert.equal(sv.weaponDrawn, true);
  assert.equal(sv.gameTime, 987654321);
  assert.equal(sv.usingLeftHandWeapon, true);
  assert.equal(sv.playerOwnedShip, SHIP_TYPES.Small);
  assert.equal(sv.allMapLocationsRevealedMode, true);
  assert.equal(sv.godMode, true);
  assert.equal(sv.lastSkillCheckTime, 13579);

  assert.equal(sv.regionData.length, 62);
  assert.deepEqual(sv.regionData[0], {
    values: Uint8Array.from({ length: 29 }, (_, j) => j + 1),
    flags: Array.from({ length: 29 }, (_, j) => j % 2 === 1),
    flags2: Array.from({ length: 14 }, (_, j) => j % 3 === 0),
    precipitationOverride: 7,
    severePunishmentFlags: 9,
    legalRep: -12,
    idOfPersecutedTemple: 0x1234,
    priceAdjustment: 1024,
  });
  assert.equal(sv.regionData[61].legalRep, 99);

  assert.equal(sv.factions.length, 2);
  assert.deepEqual(sv.factions[0], {
    type: 4, region: 17, ruler: -1, name: 'The Blades',
    rep: -3, power: 60, id: 368, vam: 150, flags: 0x0a0b,
    rulerNameSeed: 0xdeadbeef, rulerPowerBonus: 45,
    flat1: 2570, flat2: -1, face: 30,
    race: 3, sgroup: 1, ggroup: 15,
    ally1: 101, ally2: 102, ally3: 103,
    enemy1: 201, enemy2: 202, enemy3: 203,
    ptrToNextFactionAtSameHierarchyLevel: 301,
    ptrToFirstChildFaction: 302,
    ptrToParentFaction: 303,
  });
  assert.equal(sv.factions[1].name, 'Sentinel');
  assert.equal(sv.factions[1].id, 369);
});

test('savevars: ship sentinels - Large, and anything else stays None', () => {
  const bytes = buildSaveVarsFile();
  const v = new DataView(bytes.buffer);
  v.setInt32(0x1750, 51200000, true);
  let sv = new SaveVars();
  sv.load(bytes);
  assert.equal(sv.playerOwnedShip, SHIP_TYPES.Large);

  v.setInt32(0x1750, 12345, true);
  sv = new SaveVars();
  sv.load(bytes);
  assert.equal(sv.playerOwnedShip, SHIP_TYPES.None);
});

test('savevars: travel/cheat flag tables pin the C# values', () => {
  assert.deepEqual(TRAVEL_FLAGS, {
    Cautiously: 0x01, Recklessly: 0x02, FootOrHorse: 0x04,
    Ship: 0x08, Inns: 0x10, CampOut: 0x20,
  });
  assert.deepEqual(CHEAT_FLAGS, {
    AllMapLocationsRevealedMode: 0x08, NoCollision: 0x20,
    GodMode: 0x40, EnemiesCantCastSpells: 0x80,
  });
});

// ---------------------------------------------------- image / bio / games

test('save image: an 80x50 raw with ART_PAL.COL, data verbatim', () => {
  const raw = Uint8Array.from({ length: 4000 }, (_, i) => i & 0xff);
  const img = new SaveImage();
  assert.equal(img.load(raw, 'image.raw'), true);        // case-insensitive
  assert.equal(img.paletteName, 'ART_PAL.COL');
  assert.equal(img.recordCount, 1);
  assert.deepEqual(img.getSize(0), { width: SAVE_IMAGE_WIDTH, height: SAVE_IMAGE_HEIGHT });
  assert.deepEqual(img.getSize(1), { width: 0, height: 0 });
  assert.equal(img.getFrameCount(0), 1);
  assert.equal(img.getFrameCount(1), 0);
  const bmp = img.getDFBitmap();
  assert.equal(bmp.width, 80);
  assert.equal(bmp.height, 50);
  assert.equal(bmp.data, raw);

  const wrongName = new SaveImage();
  assert.equal(wrongName.load(raw, 'IMAGE.IMG'), false);
});

test('bio file: NUL-split keeps every piece, empties included', () => {
  const bio = new BioFile();
  bio.load(Uint8Array.from('line one\0line two\0', (c) => c.charCodeAt(0)));
  assert.deepEqual(bio.lines, ['line one', 'line two', '']);
});

// A minimal NameRecord BSA: header(4) + records + 18-byte entries.
function buildNameRecordBsa(records) {
  const header = new Writer(4);
  header.i16(0, records.length);
  header.u16(2, 0x0100);
  const dir = new Writer(18 * records.length);
  records.forEach(([name, bytes], i) => {
    dir.str(i * 18, name);
    dir.i32(i * 18 + 14, bytes.length);
  });
  return concat(header.bytes, ...records.map(([, b]) => b), dir.bytes);
}

function buildMapSave({ missingRegion = -1 } = {}) {
  const records = [];
  for (let r = 0; r < 62; r++) {
    if (r === missingRegion) continue;
    const data = new Uint8Array(8);
    // The LITERAL 0x40 - building with the exported constant would let
    // a mutated flag pass its own test. data[0]'s lone 0x01 bit must
    // NOT read as discovered.
    if (r === 5) { data[0] = 0x01; data[2] = 0x40; data[7] = 0x41; }
    records.push([`MAPSAVE.${String(r).padStart(3, '0')}`, data]);
  }
  return buildNameRecordBsa(records);
}

test('mapsave discovery: the 0x40 bit, clamped to the region location count', () => {
  assert.equal(MAPSAVE_DISCOVERED_FLAG, 0x40);
  const counts = new Array(62).fill(8);
  counts[5] = 6;                       // clamps out the flag at index 7
  const bsa = new BsaFile(buildMapSave());
  const discovered = readMapSaveDiscovery(bsa, counts);
  assert.equal(discovered.length, 62);
  assert.deepEqual(discovered[5], [2]);
  assert.deepEqual(discovered[0], []);

  // A missing region record fails the whole walk, as OpenSave does.
  const short = new BsaFile(buildMapSave({ missingRegion: 61 }));
  assert.equal(readMapSaveDiscovery(short, counts), null);
});

test('save games: enumeration wants SAVETREE + IMAGE.RAW and NOT SAVEVARS; open reads the set', () => {
  const treeBytes = buildSaveTreeFile();
  const varsBytes = buildSaveVarsFile();
  const image = new Uint8Array(4000);
  const name = Uint8Array.from('My Save\0junk', (c) => c.charCodeAt(0));
  const bio = Uint8Array.from('born poor\0', (c) => c.charCodeAt(0));

  const full = {
    'SAVETREE.DAT': treeBytes, 'SAVEVARS.DAT': varsBytes,
    'IMAGE.RAW': image, 'SAVENAME.TXT': name,
    'MAPSAVE.SAV': buildMapSave(), 'BIO.DAT': bio,
  };
  // No IMAGE.RAW - not a save (EnumerateSaves' filter).
  const broken = { 'SAVETREE.DAT': treeBytes, 'SAVEVARS.DAT': varsBytes };
  // No SAVEVARS.DAT - still ENUMERATES (DFU's check is commented out).
  const noVars = { 'SAVETREE.DAT': treeBytes, 'IMAGE.RAW': image, 'SAVENAME.TXT': name };

  const games = new SaveGames();
  assert.equal(games.openSavesPath({ 0: full, 1: broken, 2: noVars }), true);
  assert.equal(games.hasSave(0), true);
  assert.equal(games.hasSave(1), false);
  assert.equal(games.hasSave(2), true);
  assert.equal(CLASSIC_SAVE_COUNT, 6);

  assert.equal(games.lazyOpenSave(0), true);
  assert.equal(games.saveName, 'My Save');

  assert.equal(games.openSave(0), true);
  assert.equal(games.saveTree.header.mapId, 0xabcd);
  assert.equal(games.saveVars.gameTime, 987654321);
  assert.equal(games.mapSave.count, 62);
  assert.equal(games.rumorFile, null);               // absent RUMOR.DAT only logs in DFU
  assert.deepEqual(games.bioFile.lines, ['born poor', '']);
  assert.equal(games.saveImage.getDFBitmap().width, 80);

  // A qualifying save with no SAVEVARS throws at openSave, like DFU.
  assert.throws(() => games.openSave(2), /SaveVars/);
  assert.equal(games.tryOpenSave(2), false);
});

// ------------------------------------------------------------ real corpus

const ARENA2 = process.env.ARENA2_PATH;
const classicRoot = ARENA2 ? dirname(ARENA2) : null;
const realSaves = [];
if (classicRoot && existsSync(classicRoot)) {
  for (const entry of readdirSync(classicRoot)) {
    if (/^SAVE[0-5]$/i.test(entry) &&
        existsSync(join(classicRoot, entry, 'SAVETREE.DAT'))) {
      realSaves.push(join(classicRoot, entry));
    }
  }
}
const skipReal = realSaves.length === 0
  ? 'no classic SAVE0-SAVE5 beside ARENA2 - real-save validation skipped'
  : false;

test('corpus: every real classic save parses - version, character, savevars tables', { skip: skipReal }, () => {
  for (const dir of realSaves) {
    const tree = new SaveTree();
    tree.load(new Uint8Array(readFileSync(join(dir, 'SAVETREE.DAT'))));
    assert.equal(tree.header.version, SAVE_TREE_VERSION);
    assert.ok([1, 2, 3].includes(tree.header.environment), `${dir}: environment`);
    const character = tree.findRecord(RECORD_TYPES.Character);
    assert.ok(character, `${dir}: a character record`);
    assert.ok(character.parsedData.characterName.length > 0, `${dir}: a character name`);
    assert.ok(character.parsedData.career.hitPointsPerLevel > 0, `${dir}: a live career`);

    const varsPath = join(dir, 'SAVEVARS.DAT');
    if (existsSync(varsPath)) {
      const sv = new SaveVars();
      sv.load(new Uint8Array(readFileSync(varsPath)));
      assert.equal(sv.regionData.length, 62, `${dir}: 62 regions`);
      assert.ok(sv.factions.length > 300, `${dir}: the faction table`);
      assert.ok(EMPEROR_SON_NAMES.includes(sv.emperorSonName), `${dir}: a real son name`);
      assert.equal(sv.climateWeathers.length, 6, `${dir}: six climate weathers`);
    }
  }
});

// ═══════════════════════════ SAV2: the import core ═══════════════════════════

import {
  classicPitchDegrees, classicYawDegrees, convertClassicClimateWeathers,
  classicGlobalVars, classicBankAccounts, classicLycanthropyType,
  classicItemFromRecord, classicSpellsFromContainer, classicItemsAndSpells,
  classicGuildMemberships, classicFactionRep, classicRegionData,
  restoreOldClassSpecials, classicSaveToSnapshot,
} from '../src/systems/classicSave.js';
import { SAVE_VERSION } from '../src/systems/save.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';

// A parameterized 107-byte item record data block.
function itemData({ name = 'Thing', group = 3, index = 4, value = 100, flags = 0,
  currentCondition = 300, maxCondition = 400, typeDependentData = 0,
  image1 = 0x1234, image2 = 0x0304, material = 0, color = 0, weight = 400,
  enchantmentPoints = 0, message = 0, magic = null } = {}) {
  const w = new Writer(107);
  w.str(0, name);
  w.u16(32, group); w.u16(34, index); w.u32(36, value);
  w.u16(42, flags); w.u16(44, currentCondition); w.u16(46, maxCondition);
  w.u8(49, typeDependentData);
  w.u16(50, image1); w.u16(52, image2); w.u16(54, material); w.u8(56, color);
  w.u32(57, weight); w.u16(61, enchantmentPoints); w.u16(63, message);
  for (let i = 0; i < 10; i++) {
    const m = magic?.[i] ?? { type: 0, param: 0 };
    w.i16(67 + i * 4, m.type); w.i16(69 + i * 4, m.param);
  }
  return w.bytes;
}

function recordElement(type, recordId, parentRecordId, data = new Uint8Array(0), rootOpts = {}) {
  const body = concat(buildRecordRoot({ type, recordId, parentRecordId, ...rootOpts }), data);
  return buildElement(body.length, body);
}

// The import tree: a character with bag + wagon containers, a
// spellbook with one spell, a worn sword, arrows, a hacked item, a
// conjured item, a filled soul gem, guild + old-guild rows, an
// OldClass record, a bank record and the position record.
function buildImportTree({ charOpts = {}, diseaseId = null, guildTime = 1440 * 10,
  bankDataLength = 40, oldClassFlags = null, charName = null } = {}) {
  const header = new Writer(SAVE_TREE_HEADER_LENGTH);
  header.i32(0, SAVE_TREE_VERSION);
  header.i32(4, 0); header.i32(8, 0); header.i32(12, 0);
  header.u16(16, 0x123);
  header.u8(18, ENVIRONMENTS.Building);   // the import IGNORES this - always exterior

  const charData = buildCharacterData(charOpts);
  if (charName != null) {
    charData.fill(0, 0, 32);
    for (let i = 0; i < charName.length; i++) charData[i] = charName.charCodeAt(i);
  }
  // Worn: the sword (record 21) alone.
  new DataView(charData.buffer).setUint32(0x16f, 21, true);

  const guildRow = new Writer(13);
  guildRow.u8(0, 3); guildRow.u8(1, 1); guildRow.u8(2, 9); guildRow.u16(3, 368);
  guildRow.u32(5, guildTime); guildRow.u16(11, 0);
  const oldGuildRow = new Writer(13);
  oldGuildRow.u8(0, 5); oldGuildRow.u8(2, 9); oldGuildRow.u16(3, 400);
  oldGuildRow.u32(5, guildTime);

  const oldClass = buildClassRecord();
  if (oldClassFlags) {
    oldClass[0] = oldClassFlags.resistanceFlags;
    oldClass[1] = oldClassFlags.immunityFlags;
    oldClass[2] = oldClassFlags.lowToleranceFlags;
    oldClass[3] = oldClassFlags.criticalWeaknessFlags;
    new DataView(oldClass.buffer).setUint16(4, oldClassFlags.abilityFlagsAndSpellPointsBitfield, true);
  }

  const bank = new Writer(bankDataLength);
  bank.i32(0, 1000); bank.i32(4, 50); bank.u32(8, 777); bank.u8(12, 1);
  bank.i32(13, 2000); bank.i32(17, 0); bank.u32(21, 0); bank.u8(25, 0);
  bank.i32(26, 3000); bank.i32(30, 60); bank.u32(34, 888); bank.u8(38, 0);

  const parts = [
    header.bytes,
    Uint8Array.of(0, 0, 0, 0),                                     // empty buildings block
    recordElement(RECORD_TYPES.Character, 2, 0, charData),
    recordElement(RECORD_TYPES.Container, 10, 2, Uint8Array.of(0), { spriteIndex: 0 }),
    recordElement(RECORD_TYPES.Container, 11, 2, Uint8Array.of(0), { spriteIndex: 4 }),
    // The spellbook FIRST, so it is the container's children[0] -
    // ImportSpells reads children[0] REGARDLESS, DFU's own shape.
    recordElement(RECORD_TYPES.Item, 20, 10, itemData({ name: 'Spellbook', group: 27, index: 0 })),
    recordElement(RECORD_TYPES.Spell, 30, 20, buildSpellData()),
    recordElement(RECORD_TYPES.Item, 21, 10, itemData({ name: 'My Sword', group: 3, index: 4, material: 2, value: 999 })),
    recordElement(RECORD_TYPES.Item, 22, 10, itemData({ name: 'Arrows', group: 3, index: 18, typeDependentData: 24 })),
    recordElement(RECORD_TYPES.Item, 23, 10, itemData({ name: 'Hacked', image1: 0 })),
    recordElement(RECORD_TYPES.Item, 24, 10, itemData({ name: 'Conjured', group: 14, index: 2, flags: 0x1000 }), { time: 5555 }),
    recordElement(RECORD_TYPES.Item, 25, 10, itemData({ name: 'Soul gem', group: 27, index: 1 })),
    recordElement(RECORD_TYPES.TrappedSoul, 26, 25, Uint8Array.of(150), { spriteIndex: 9 }),
    recordElement(RECORD_TYPES.Item, 27, 11, itemData({ name: 'Wagon thing', group: 14, index: 1 })),
    recordElement(RECORD_TYPES.GuildMembership, 40, 2, guildRow.bytes),
    recordElement(RECORD_TYPES.OldGuild, 41, 2, oldGuildRow.bytes),
    recordElement(RECORD_TYPES.OldClass, 43, 2, oldClass),
    recordElement(RECORD_TYPES.BankAccount, 44, 0, bank.bytes),
    recordElement(RECORD_TYPES.CharacterPositionRecord, 45, 0, new Uint8Array(0), {}),
  ];
  if (diseaseId != null) {
    const dz = new Writer(47);
    dz.u8(0, diseaseId);
    parts.push(recordElement(RECORD_TYPES.DiseaseOrPoison, 46, 2, dz.bytes));
  }
  parts.push(Uint8Array.of(0, 0, 0, 0));
  const tree = new SaveTree();
  tree.load(concat(...parts));
  return tree;
}

const FAKE_FACTIONS = new Map([
  [368, { id: 368, name: 'The Fighters Guild', type: 2, ggroup: GUILD_GROUPS.FightersGuild, rep: 0, flags: 3, power: 60, children: [] }],
  [400, { id: 400, name: 'The Mages Guild', type: 2, ggroup: GUILD_GROUPS.MagesGuild, rep: 5, flags: 1, power: 70, children: [] }],
]);

function importSaveGames(treeOpts = {}) {
  const tree = buildImportTree(treeOpts);
  const vars = new SaveVars();
  const varsBytes = buildSaveVarsFile();
  // The import's global vars must be classic-legal 0/1 (the general
  // savevars fixture uses a recognizable byte pattern instead).
  for (let i = 0; i < 64; i++) varsBytes[0x34f + i] = i % 2;
  vars.load(varsBytes);
  return {
    saveTree: tree, saveVars: vars, mapSave: null,
    bioFile: { lines: ['a scrappy urchin', ''] }, saveName: 'My Save',
  };
}

test('SAV2: the classic look conversions - +-256 pitch is +-45, 2048 yaw is 360', () => {
  assert.equal(classicPitchDegrees(256), 45);
  assert.equal(classicPitchDegrees(-256), -45);
  assert.equal(classicPitchDegrees(0), 0);
  assert.equal(classicYawDegrees(1024), 180);
  assert.equal(classicYawDegrees(2048), 360);
  assert.equal(classicYawDegrees(0), 0);
});

test('SAV2: the weather import masks 0x80 and swaps thunder/snow 5<->6', () => {
  assert.deepEqual(
    convertClassicClimateWeathers(Uint8Array.of(0x85, 5, 6, 3, 0x80, 2)),
    Uint8Array.of(6, 6, 5, 3, 0, 2));
});

test('SAV2: global vars are strictly 0/1 booleans, anything else throws', () => {
  const vars = { globalVars: Uint8Array.of(0, 1, 1, 0) };
  assert.deepEqual(classicGlobalVars(vars), [[0, false], [1, true], [2, true], [3, false]]);
  assert.throws(() => classicGlobalVars({ globalVars: Uint8Array.of(0, 2) }), /unexpected global variable/);
});

test('SAV2: bank rows read 13 bytes each and the guard DROPS a row ending exactly at the end', () => {
  const data = new Writer(40);
  data.i32(0, 1000); data.i32(4, 50); data.u32(8, 777); data.u8(12, 1);
  data.i32(13, 2000);
  data.i32(26, 3000); data.u8(38, 1);
  const record = { recordType: RECORD_TYPES.BankAccount, recordData: data.bytes };
  const accounts = classicBankAccounts(record, 62);
  assert.equal(accounts.length, 62);
  assert.deepEqual(accounts[0], { regionIndex: 0, accountGold: 1000, loanTotal: 50, loanDueDate: 777, hasDefaulted: true });
  assert.deepEqual(accounts[1], { regionIndex: 1, accountGold: 2000, loanTotal: 0, loanDueDate: 0, hasDefaulted: false });
  assert.equal(accounts[2].accountGold, 3000);
  assert.equal(accounts[3].accountGold, 0);

  // 39 bytes = exactly three rows, and `position + 13 < length` never
  // admits the third: DFU's own off-by-one, preserved.
  const short = { recordType: RECORD_TYPES.BankAccount, recordData: data.bytes.subarray(0, 39) };
  const clipped = classicBankAccounts(short, 62);
  assert.equal(clipped[1].accountGold, 2000);
  assert.equal(clipped[2].accountGold, 0, 'the last full row is dropped, verbatim');

  // No record / wrong type = fresh accounts.
  assert.equal(classicBankAccounts(null, 62)[0].accountGold, 0);
});

test('SAV2: item conversion - template mapping, arrows stack, enchantment discard', () => {
  const sword = classicItemFromRecord({ parsedData: {
    name: 'My Sword', group: 3, index: 4, value: 999, flags: 0,
    currentCondition: 300, maxCondition: 400, typeDependentData: 0,
    image1: 0x1234, material: 2, color: 0, enchantmentPoints: 0, message: 0,
    magic: Array.from({ length: 10 }, () => ({ type: 0, param: 0 })),
  } });
  assert.equal(sword.group, 'Weapons');
  assert.equal(sword.templateIndex, 117);              // Weapons[4]
  assert.equal(sword.material, 2);
  assert.equal(sword.value, 999);
  assert.equal(sword.stackCount, 1);
  assert.equal(sword.enchantments, undefined, 'an all-None magic array is discarded');

  const arrows = classicItemFromRecord({ parsedData: {
    name: 'Arrows', group: 3, index: 18, value: 1, flags: 0,
    currentCondition: 0, maxCondition: 0, typeDependentData: 24,
    image1: 0x1234, material: 0, color: 0, enchantmentPoints: 0, message: 0, magic: [],
  } });
  assert.equal(arrows.stackCount, 24, 'arrow typeDependentData is the stack');

  const magic = classicItemFromRecord({ parsedData: {
    name: 'Ring', group: 25, index: 0, value: 5000, flags: 0x20,
    currentCondition: 1, maxCondition: 1, typeDependentData: 0,
    image1: 0x1234, material: 0, color: 0, enchantmentPoints: 500, message: 0,
    magic: [{ type: 24, param: 7 }, { type: -1, param: -1 }],
  } });
  assert.deepEqual(magic.enchantments, [{ type: 24, param: 7 }, { type: -1, param: -1 }]);
});

test('SAV2: items and spells - discard law, wagon split, equip, soul, conjured time, gold', () => {
  const tree = buildImportTree();
  const spellsByIndex = new Map([[77, { name: 'Test Spell' }]]);
  const { items, wagonItems, spells } = classicItemsAndSpells(tree, { spellsByIndex });

  const names = items.map((i) => i.name);
  assert.ok(!names.includes('Hacked'), 'image1 == 0 is discarded');
  assert.ok(names.includes('Spellbook'));
  assert.deepEqual(wagonItems.map((i) => i.name), ['Wagon thing']);

  const sword = items.find((i) => i.name === 'My Sword');
  assert.equal(sword.equipSlot, EQUIP_SLOTS.RightHand, 'the worn sword lands in the hand');
  const book = items.find((i) => i.name === 'Spellbook');
  assert.equal(book.equipSlot, undefined);

  const soulGem = items.find((i) => i.name === 'Soul gem');
  assert.equal(soulGem.trappedSoulType, 9, 'the soul rides the child root SpriteIndex');

  const conjured = items.find((i) => i.name === 'Conjured');
  assert.equal(conjured.timeForItemToDisappear, 5555, 'flag 0x1000 takes the root Time');

  const gold = items.find((i) => i.group === 'Currency');
  assert.equal(gold.stackCount, 100000, 'physicalGold mints the one gold stack');

  // The stock spell matched by index AND name travels as its index.
  assert.deepEqual(spells, [77]);
});

test('SAV2: a renamed classic spell rides whole as a made spell', () => {
  const container = { children: [{ children: [
    { parsedData: { ...JSON.parse(JSON.stringify({ effects: [{ type: 1, subType: 2 }], element: 0, rangeType: 0, cost: 5, name: 'My Zap', icon: 1, index: 77 })) } },
  ] }] };
  const spellsByIndex = new Map([[77, { name: 'Test Spell' }]]);
  const spells = classicSpellsFromContainer(container, spellsByIndex);
  assert.equal(spells.length, 1);
  assert.equal(spells[0].custom, true);
  assert.equal(spells[0].name, 'My Zap');

  // No index match at all - also a made spell.
  const unknown = classicSpellsFromContainer(container, new Map());
  assert.equal(unknown[0].custom, true);
});

test('SAV2: guild memberships - group resolution, day conversion, the vampire book flip', () => {
  const tree = buildImportTree({ guildTime: 1440 * 123 });
  const mortalStore = classicGuildMemberships(tree, FAKE_FACTIONS, false);
  const fg = mortalStore.mortal[GUILD_GROUPS.FightersGuild];
  assert.ok(fg, 'the live membership lands in the mortal book');
  assert.equal(fg.guild, 'The Fighters Guild');
  assert.equal(fg.rank, 3);
  // 123 classic days from the epoch -> daySinceZero through the one
  // date home (epoch 3E405's own day count rides the conversion).
  assert.equal(typeof fg.lastRankChange, 'number');
  const mg = mortalStore.vampire[GUILD_GROUPS.MagesGuild];
  assert.ok(mg, 'the OldGuild membership lands in the OTHER book');
  assert.equal(mg.rank, 5);

  const vampStore = classicGuildMemberships(tree, FAKE_FACTIONS, true);
  assert.ok(vampStore.vampire[GUILD_GROUPS.FightersGuild], 'a vampire keeps the live book on the vampire side');
  assert.ok(vampStore.mortal[GUILD_GROUPS.MagesGuild]);
});

test('SAV2: the faction merge copies ONLY the live reputation', () => {
  const store = { dict: new Map([
    [368, { id: 368, rep: 0, flags: 3, power: 60 }],
    [400, { id: 400, rep: 5, flags: 1, power: 70 }],
    [999, { id: 999, rep: 9, flags: 0, power: 10 }],
  ]) };
  const saveVars = { factions: [
    { id: 368, rep: -42, flags: 0x7777, power: 1 },     // flags/power must NOT copy
    { id: 12345, rep: 50 },                             // unknown id ignored
  ] };
  assert.deepEqual(classicFactionRep(saveVars, store), {
    ids: [368, 400, 999],
    rep: [-42, 5, 9],
    flags: [3, 1, 0],
    power: [60, 70, 10],
  });
  assert.equal(classicFactionRep(saveVars, null), null);
});

test('SAV2: the region table fans out to legalRep, prices and the condition snapshot', () => {
  const vars = new SaveVars();
  vars.load(buildSaveVarsFile());
  const { legalRep, regionPrices, regionConditions } = classicRegionData(vars);
  assert.equal(legalRep[0], -12);
  assert.equal(legalRep[61], 99);
  assert.equal(legalRep[5], undefined, 'a zero rep stays unwritten');
  assert.equal(regionPrices[0], 1024);
  assert.equal(regionConditions.length, 62);
  assert.deepEqual(regionConditions[0], {
    v: Array.from({ length: 29 }, (_, j) => j + 1),
    f: Array.from({ length: 29 }, (_, j) => (j % 2 === 1 ? 1 : 0)).join(''),
    g: Array.from({ length: 14 }, (_, j) => (j % 3 === 0 ? 1 : 0)).join(''),
    p: 7, s: 9, t: 0x1234,
  });
});

test('SAV2: RestoreOldClassSpecials copies the sun/holy and tolerance bits back', () => {
  const tree = buildImportTree({ oldClassFlags: {
    resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0,
    criticalWeaknessFlags: 0, abilityFlagsAndSpellPointsBitfield: 0,
  } });
  const career = {
    abilityFlagsAndSpellPointsBitfield: 0xffff,
    resistanceFlags: 0xff, immunityFlags: 0xff,
    lowToleranceFlags: 0xff, criticalWeaknessFlags: 0xff,
  };
  assert.equal(restoreOldClassSpecials(tree, career, TRANSFORMED_RACES.Vampire, LYCANTHROPY_TYPES.None), true);
  assert.equal(career.abilityFlagsAndSpellPointsBitfield, 0xffff & ~48, 'sunDamage(16) + holyDamage(32) restored');
  assert.equal(career.resistanceFlags, 0xff & ~65, 'Paralysis(1) + Disease(64) bits restored');
  assert.equal(career.criticalWeaknessFlags, 0xff & ~65);

  // The lycanthrope arm touches Disease alone.
  const career2 = { ...career, resistanceFlags: 0xff, abilityFlagsAndSpellPointsBitfield: 0xffff };
  assert.equal(restoreOldClassSpecials(tree, career2, TRANSFORMED_RACES.None, LYCANTHROPY_TYPES.Werewolf), true);
  assert.equal(career2.resistanceFlags, 0xff & ~64);
  assert.equal(career2.abilityFlagsAndSpellPointsBitfield, 0xffff, 'the ability bits stay');
});

test('SAV2: lycanthropy detection reads 101/102 and diseases import as nothing', () => {
  assert.equal(classicLycanthropyType(buildImportTree()), LYCANTHROPY_TYPES.None);
  assert.equal(classicLycanthropyType(buildImportTree({ diseaseId: 101 })), LYCANTHROPY_TYPES.Werewolf);
  assert.equal(classicLycanthropyType(buildImportTree({ diseaseId: 102 })), LYCANTHROPY_TYPES.Wereboar);
  assert.equal(classicLycanthropyType(buildImportTree({ diseaseId: 3 })), LYCANTHROPY_TYPES.None);
});

test('SAV2: classicSaveToSnapshot - the whole envelope, at SAVE_VERSION', () => {
  const games = importSaveGames({ charName: 'Alaric  ' });
  const spellsByIndex = new Map([[77, { name: 'Test Spell' }]]);
  const bundle = classicSaveToSnapshot(games, {
    spellsByIndex,
    factionStore: { dict: FAKE_FACTIONS },
  });
  const snap = bundle.snap;

  assert.equal(snap.v, SAVE_VERSION);
  assert.equal(snap.classicMinutes, 987654321, 'the clock IS classic minutes');
  assert.equal(snap.name, 'Alaric', 'the Trim law');
  assert.equal(snap.career.name, 'TestClass');
  assert.equal(snap.gender, 'female');
  assert.equal(snap.race, 'Redguard');
  assert.equal(snap.raceId, 2);
  assert.equal(snap.careerIndex, -1, 'the career rides whole');
  assert.equal(snap.level, 13);
  assert.equal(snap.maxHealth, 77, 'BASEhealth, the ToCharacterDocument law');
  assert.equal(snap.health, 55);
  assert.equal(snap.magicka, 25);
  assert.equal(snap.fatigue, 800);
  assert.equal(snap.currentBreath, 42);
  assert.deepEqual(snap.stats, {
    strength: 51, intelligence: 52, willpower: 53, agility: 54,
    endurance: 55, personality: 56, speed: 57, luck: 58,
  });
  assert.equal(snap.skills.length, 35);
  assert.equal(snap.chargenDone, true);

  // SetCurrentLevelUpSkillSum over the imported skills.
  assert.equal(snap.currentLevelUpSkillSum, levelUpSkillSumProbe(snap.career, snap.skills));

  assert.equal(snap.biographyResistDiseaseMod, 1);
  assert.equal(snap.biographyFatigueMod, 5);
  assert.equal(snap.biographyReactionMod, -2);
  assert.equal(snap.lastSkillCheckTime, 13579);
  assert.equal(snap.timeOfLastSkillTraining, 666666);

  assert.deepEqual(snap.sGroupReputations.slice(0, 5), [10, -20, 30, -40, 50]);
  assert.equal(snap.sGroupReputations.length, 11);
  assert.equal(snap.crimeCommitted, 5);
  assert.equal(snap.legalRep[0], -12);
  assert.equal(snap.regionPrices[0], 1024);
  assert.equal(snap.regionConditions.length, 62);

  assert.equal(snap.bankAccounts[0].accountGold, 1000);
  assert.equal(snap.ownedShip, 0, 'the small ship');
  assert.deepEqual(snap.spells, [77]);
  assert.ok(snap.items.some((i) => i.group === 'Currency'));
  assert.deepEqual(snap.backStory, ['a scrappy urchin', '']);
  // The savevars fixture's faction 368 matches the fake dict - its
  // LIVE rep (-3) merges in; 400 has no savevars row and keeps the
  // store's own rep (the Merge law end to end).
  assert.deepEqual(snap.factionRep.rep, [-3, 5]);

  // The pose: converted look, classic weaponDrawn.
  assert.equal(snap.pose.weaponDrawn, true);
  assert.equal(snap.pose.pitch, classicPitchDegrees(-100));
  assert.equal(snap.pose.yaw, classicYawDegrees(200));
  assert.equal(snap.pose.crouching, false);

  // The bundle's host-frame half.
  assert.deepEqual(bundle.position, { worldX: 111, worldY: -222, worldZ: 333 });
  assert.equal(bundle.environment, ENVIRONMENTS.Building, 'reported, though the import lands exterior');
  assert.deepEqual(bundle.climateWeathers, Uint8Array.of(0, 1, 2, 3, 4, 6), 'the 5->6 swap on zone 5');
  assert.equal(bundle.globalVars.length, 64);
  assert.equal(bundle.saveName, 'My Save');
  assert.equal(bundle.classicTransformedRace, TRANSFORMED_RACES.None);
});

// The advancement law re-derived locally so a drifted import breaks
// the pin (levelUpSkillSum's own body, over a bare career + skills).
function levelUpSkillSumProbe(career, skills) {
  let sum = 0;
  for (const id of career.primarySkills) sum += skills[id];
  let lowMaj = Infinity;
  for (const id of career.majorSkills) { sum += skills[id]; if (skills[id] < lowMaj) lowMaj = skills[id]; }
  let hiMin = -Infinity;
  for (const id of career.minorSkills) if (skills[id] > hiMin) hiMin = skills[id];
  return sum - lowMaj + hiMin;
}

test('SAV2: a vampire import strips, curses, and flips the guild books', () => {
  const games = importSaveGames({ charOpts: { race: 8, race2: 1, vampireClan: VAMPIRE_CLANS.Anthotis } });
  const bundle = classicSaveToSnapshot(games, { factionStore: { dict: FAKE_FACTIONS } });
  const snap = bundle.snap;

  assert.equal(bundle.classicTransformedRace, TRANSFORMED_RACES.Vampire);
  assert.equal(bundle.vampireClan, VAMPIRE_CLANS.Anthotis);
  assert.equal(snap.raceId, 2, 'race2 + 1 restored');
  // The Anthotis strip reached the envelope's stats.
  assert.equal(snap.stats.strength, 31);
  assert.equal(snap.stats.intelligence, 32);
  // The curse rides activeEffects with its clan.
  const curse = snap.activeEffects.find((a) => a.kind === 'racialOverride');
  assert.ok(curse, 'the vampirism curse re-applies through the effect system');
  assert.equal(curse.racial, 'vampirism');
  assert.equal(curse.clan, VAMPIRE_CLANS.Anthotis);
  // The live guild book sits on the vampire side.
  assert.ok(snap.guildMemberships.vampire[GUILD_GROUPS.FightersGuild]);
  assert.ok(snap.guildMemberships.mortal[GUILD_GROUPS.MagesGuild]);
});

test('SAV2: a werewolf-infected import carries the strip and the lycanthropy curse', () => {
  const games = importSaveGames({ diseaseId: 101 });
  const bundle = classicSaveToSnapshot(games, { factionStore: { dict: FAKE_FACTIONS } });
  assert.equal(bundle.lycanthropyType, LYCANTHROPY_TYPES.Werewolf);
  // The stripLycanthropyType arm strips even an untransformed carrier.
  assert.equal(bundle.snap.stats.strength, 11);
  const curse = bundle.snap.activeEffects.find((a) => a.kind === 'racialOverride');
  assert.ok(curse, 'the lycanthropy curse re-applies');
});

test('SAV2: no character record throws, as the C# does', () => {
  const header = new Writer(SAVE_TREE_HEADER_LENGTH);
  header.i32(0, SAVE_TREE_VERSION);
  const tree = new SaveTree();
  tree.load(concat(header.bytes, Uint8Array.of(0, 0, 0, 0), Uint8Array.of(0, 0, 0, 0)));
  const vars = new SaveVars();
  vars.load(buildSaveVarsFile());
  assert.throws(
    () => classicSaveToSnapshot({ saveTree: tree, saveVars: vars, bioFile: null, saveName: '' }),
    /CharacterRecord not found/);
});

test('SAV2: MAPSAVE discovery lands in the envelope through the resolver seam', () => {
  const games = importSaveGames();
  games.mapSave = new BsaFile(buildMapSave());
  const counts = new Array(62).fill(8);
  const bundle = classicSaveToSnapshot(games, {
    factionStore: { dict: FAKE_FACTIONS },
    regionLocationCounts: counts,
    resolveLocation: (regionIndex, locationIndex) => ({
      mapId: (regionIndex << 8) | locationIndex,
      regionName: `R${regionIndex}`, locationName: `L${locationIndex}`,
    }),
  });
  assert.deepEqual(bundle.snap.discovery, {
    buildings: {},
    locations: {
      [(5 << 8) | 2]: { regionName: 'R5', locationName: 'L2' },
      [(5 << 8) | 7]: { regionName: 'R5', locationName: 'L7' },
    },
  });
});

// ═══════════════════════ SAV3: the window and the wiring ═══════════════════════

import {
  LoadClassicWindow, SAVE_IMAGE_RECTS, SAVE_TEXT_RECTS, OUTLINE_RECTS,
  LOAD_BUTTON_RECT, EXIT_BUTTON_RECT, LOAD_CLASSIC_IMG,
} from '../src/ui/loadClassicWindow.js';
import {
  importClimateWeathers, resetWeatherSim, tickWeather, currentWeatherEnum, WEATHER_ENUM,
} from '../src/systems/weatherSim.js';
import { bitmapToColor32 } from '../src/ui/hud.js';
import {
  setPendingClassicSave, takePendingClassicSave, peekPendingClassicSave,
} from '../src/systems/classicSave.js';

const CANVAS_320x200 = { width: 320, height: 200 };

test('SAV3: the load-classic window pins its DFU geometry WHOLE', () => {
  assert.equal(LOAD_CLASSIC_IMG, 'LOAD00I0.IMG');
  assert.deepEqual(SAVE_IMAGE_RECTS.map((r) => [...r]), [
    [40, 4, 80, 50], [40, 69, 80, 50], [40, 134, 80, 50],
    [200, 4, 80, 50], [200, 69, 80, 50], [200, 134, 80, 50],
  ]);
  assert.deepEqual(SAVE_TEXT_RECTS.map((r) => [...r]), [
    [1, 56, 158, 9], [1, 121, 158, 9], [1, 186, 158, 9],
    [162, 56, 158, 9], [162, 121, 158, 9], [162, 186, 158, 9],
  ]);
  assert.deepEqual(OUTLINE_RECTS.map((r) => [...r]), [
    [39, 3, 81, 51], [39, 68, 81, 51], [39, 133, 81, 51],
    [199, 3, 81, 51], [199, 68, 81, 51], [199, 133, 81, 51],
  ]);
  assert.deepEqual([...LOAD_BUTTON_RECT], [126, 5, 68, 11]);
  assert.deepEqual([...EXIT_BUTTON_RECT], [133, 150, 56, 19]);
});

test('SAV3: the window click law - first valid selected, slot picks, double-click loads', () => {
  const slots = [null, { name: 'SLOT ONE', tex: null }, null, { name: 'SLOT THREE', tex: null }, null, null];
  const win = new LoadClassicWindow(null, slots);
  assert.equal(win.selectedSaveGame, 1, 'the first VALID save starts selected');

  // A click inside slot 3's image rect selects it.
  assert.deepEqual(win.click(CANVAS_320x200, 210, 10), { action: 'select', index: 3 });
  assert.equal(win.selectedSaveGame, 3);
  // Its 158x9 name rect selects too.
  assert.deepEqual(win.click(CANVAS_320x200, 170, 60), { action: 'select', index: 3 });
  // An UNMOUNTED slot's rects answer nothing (:117-121 skips them).
  assert.equal(win.click(CANVAS_320x200, 45, 10), null);
  // The Load Game button loads the selection.
  assert.deepEqual(win.click(CANVAS_320x200, 130, 8), { action: 'load', index: 3 });
  // A double click on a slot selects AND loads (:225-230).
  assert.deepEqual(win.click(CANVAS_320x200, 45, 75, true), { action: 'load', index: 1 });
  assert.equal(win.selectedSaveGame, 1);
  // Exit.
  assert.deepEqual(win.click(CANVAS_320x200, 140, 160), { action: 'exit' });
  // Outside every rect: consumed, no action.
  assert.equal(win.click(CANVAS_320x200, 0, 0), null);
});

test('SAV3: with no valid slot, the Load button does not exist (:155-159)', () => {
  const win = new LoadClassicWindow(null, new Array(6).fill(null));
  assert.equal(win.selectedSaveGame, -1);
  assert.equal(win.click(CANVAS_320x200, 130, 8), null);
  assert.deepEqual(win.click(CANVAS_320x200, 140, 160), { action: 'exit' }, 'Exit always mounts');
});

test('SAV3: importClimateWeathers - the imported array wears on the next tick, no re-roll', () => {
  resetWeatherSim();
  assert.equal(importClimateWeathers(Uint8Array.of(4, 4, 4)), false, 'six zones or nothing');
  assert.equal(importClimateWeathers(Uint8Array.of(4, 4, 4, 4, 4, 4)), true);
  // tickWeather must NOT re-roll (the array is stamped rolled) and
  // must apply the imported zone value on the first exterior frame.
  const changed = tickWeather(0, 223, () => { throw new Error('a re-roll clobbered the imported array'); });
  assert.equal(changed, true);
  assert.equal(currentWeatherEnum(), WEATHER_ENUM.rain ?? 4);
  resetWeatherSim();
});

test('SAV3: bitmapToColor32 grows the GetColor32 alphaIndex - -1 draws index 0 opaque', () => {
  const bmp = { width: 2, height: 1, data: Uint8Array.of(0, 1) };
  const palette = { get: (i) => ({ r: i * 10, g: 0, b: 0 }) };
  const keyed = new Uint8Array(bitmapToColor32(bmp, palette).colors.buffer);
  assert.equal(keyed[3], 0, 'index 0 stays transparent by default');
  const opaque = new Uint8Array(bitmapToColor32(bmp, palette, -1).colors.buffer);
  assert.equal(opaque[3], 255, 'alphaIndex -1 keeps the screenshot whole');
  assert.equal(opaque[0], 0);
  assert.equal(opaque[4 + 0], 10);
});

test('SAV3: the pending hand-off - set, peek, and TAKE clears', () => {
  const marker = { saveName: 'X' };
  setPendingClassicSave(marker);
  assert.equal(peekPendingClassicSave(), marker);
  assert.equal(takePendingClassicSave(), marker);
  assert.equal(peekPendingClassicSave(), null, 'a consumed import cannot replay');
  assert.equal(takePendingClassicSave(), null);
});

// The host wiring cannot run headless (a live canvas, IDB and rAF);
// the seam is READ instead - the project's own idiom for host-side
// laws (the mysticism host sweeps' shape).
test('SAV3: the wiring source pins - menu arm, boot arm order, chargen gate, main routing', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // The classic arm sits BEFORE the load arm in the boot walk and is
  // gated on a REAL pending import.
  const classicArm = world.indexOf("params.has('classicload') && peekPendingClassicSave()");
  const loadArm = world.indexOf("} else if (params.has('load')) {");
  assert.ok(classicArm > -1 && loadArm > -1 && classicArm < loadArm,
    'the classicload arm precedes the load arm');
  // The chargen gate skips the wizard only for a REAL pending import.
  assert.match(world, /!\(params\.has\('classicload'\) && peekPendingClassicSave\(\)\)/);
  // The boot arm awaits the deps a fast boot would otherwise miss.
  assert.match(world, /if \(!spellsByIndex\) spellsByIndex = await loadSpellIndex\(fetchBytes\);/);
  assert.match(world, /await townTalk\.ensureFactions\?\.\(\);/);
  // The position lands through the streaming world's own converters.
  assert.match(world, /worldCoordToMapPixel\(bundle\.position\.worldX, bundle\.position\.worldZ\)/);
  assert.match(world, /importClimateWeathers\(bundle\.climateWeathers\)/);
  // The quest globals move ENTRY BY ENTRY - the machine's hooks hold
  // the Map reference.
  assert.match(world, /questBridge\.machine\.globalVars\.set\(i, v\)/);
  // The classic rumors reach the mill through ITS import member.
  assert.match(world, /rumorMill\.importClassicRumor\(rumor, /);

  const menu = readFileSync(new URL('../src/scenes/menu.js', import.meta.url), 'utf8');
  // Load with no quicksave runs the classic flow - the old dead end is gone.
  assert.match(menu, /const picked = await runClassicLoad\(canvas, renderer, status\);/);
  assert.doesNotMatch(menu, /no quicksave to load/);
  // The screenshot uploads OPAQUE (GetColor32 alphaIndex -1).
  assert.match(menu, /bitmapToColor32\(bmp, palette, -1\)/);

  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // SET on classicload, DELETE on anything else (the F12 law's shape).
  assert.match(main, /if \(action === 'classicload'\) params\.set\('classicload', '1'\);\n\s*else params\.delete\('classicload'\);/);
});
