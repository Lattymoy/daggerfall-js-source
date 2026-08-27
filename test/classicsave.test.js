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
