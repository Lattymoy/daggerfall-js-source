// SAVETREE.DAT reader (SAV1) - the fourteenth format reader. 1:1
// translation of DFU API/Save (MIT, Daggerfall Workshop): SaveTree.cs,
// SaveTreeHeader.cs, SaveTreeBaseRecord.cs, SaveTreeBuildingRecords.cs,
// and the small typed records - ItemRecord.cs, GuildMembershipRecord.cs,
// DiseaseOrPoisonRecord.cs, ContainerRecord.cs, TrappedSoulRecord.cs,
// SpellRecord.cs (whose parse is DaggerfallSpellReader.ReadSpellData,
// single-sourced in spellsStd.js). CharacterRecord.cs is big enough to
// be its own module: characterRecord.js.
//
// Layout (SaveTree.Open): 19-byte header (version 0x126, a position
// triple, mapId, environment), then the building records block (i32
// length, 26-byte DFLocation.BuildingData records), then RecordElements
// to end of stream: i32 length + [record root (71 bytes) + record data].
// ReadRecords' own quirks, preserved verbatim:
//   - length <= 0 records are SKIPPED (their 4-byte length still
//     consumed) - "empty records have no data";
//   - the overflow guard is `position + length >= stream.length`, so a
//     record that ends EXACTLY at EOF is rejected and reading stops;
//   - a Light record's stored length is multiplied by 39
//     (SaveTreeBaseRecord.LightDataLengthMultiplier) before the read;
//   - a duplicate RecordID is COUNTED and dropped (AddRecord), never
//     overwritten;
//   - children link to parents by ParentRecordID after all records are
//     read (LinkChildren); orphans hang off the root record.
//
// Departures (structure only, documented): file-path plumbing dropped -
// load() takes bytes like every reader here; records are plain objects,
// not a class hierarchy (the type switch lives in readRecords, as DFU's
// does); DFU's write-back path is unported because DFU's own
// SaveTree.Save() writes the header only ("TODO: Write other records").

import { readSpellRecord } from './spellsStd.js';
import { parseCharacterRecordData } from './characterRecord.js';

export const SAVETREE_FILENAME = 'SAVETREE.DAT';

/** SaveTreeHeader consts. */
export const SAVE_TREE_HEADER_LENGTH = 19;
export const SAVE_TREE_VERSION = 0x126;

/** SaveTreeBaseRecord consts. */
export const RECORD_ROOT_LENGTH = 71;
export const LIGHT_DATA_LENGTH_MULTIPLIER = 39;

/** SaveTree.Environments - player environment in the header. */
export const ENVIRONMENTS = Object.freeze({
  Outside: 1, Building: 2, Dungeon: 3,
});

/** SaveTree.RecordTypes - the full classic object-type table ("classic
 *  name" comments preserved in SaveTree.cs; values are FALL.EXE's). */
export const RECORD_TYPES = Object.freeze({
  Null: 0x00,
  World: 0x01,
  Item: 0x02,
  Character: 0x03,
  CharacterPositionRecord: 0x04,      // determines player position on load, NOT the header triple
  CharacterCamera: 0x05,
  Interactable3dObject: 0x06,
  Light: 0x07,                        // the x39 length record
  NPCFlat: 0x08,
  Spell: 0x09,
  GuildMembership: 0x0a,
  DiseaseOrPoison: 0x0b,
  UnusedClass: 0x0c,
  UnusedKeyword: 0x0d,
  QBNData: 0x0e,
  UnusedKeyHolder: 0x0f,
  QuestHolder: 0x10,
  UnusedNPC: 0x11,
  EnemyMobile: 0x12,
  Trap: 0x13,
  TrappedSoul: 0x14,
  SpellcastingCreatureListHead: 0x16,
  Options: 0x17,
  Logbook: 0x18,
  BankAccount: 0x19,
  UnusedBankInfo: 0x1a,
  UnusedSafetyBox: 0x1b,
  OldClass: 0x1c,                     // player's class before vampire/werething transform
  OldGuild: 0x1d,                     // guild affiliations before transform - parses as GuildMembership
  UnusedBless: 0x1e,
  Potion: 0x1f,
  Door: 0x20,
  Treasure: 0x21,
  Marker: 0x22,
  UnusedRumor: 0x23,
  Goods: 0x24,
  UnusedDeed: 0x25,
  House: 0x26,
  NonWorld: 0x27,
  RegionMark: 0x28,
  NPCMark: 0x29,
  OneShot: 0x2a,
  MysteryRecord2: 0x2b,
  Corpse: 0x2c,
  NPC: 0x2d,
  GenericNPC: 0x2e,
  DungeonAutomapData: 0x33,
  Container: 0x34,                    // 0 weapons&armor 1 magic 2 clothing&misc 3 ingredients 4 wagon 5 house 6 ship 7 tavern 8 repairer
  NPCMobile: 0x35,
  ItemLeftForRepair: 0x36,
  TavernRoom: 0x40,
  QuestNPC: 0x41,
});

/** ItemRecord.ItemFlags. */
export const ITEM_FLAGS = Object.freeze({
  None: 0x00,
  IngredientRegular: 0x01,
  OneHandedWeapon: 0x04,
  IngredientLiquid: 0x09,
  BluntWeapon: 0x10,
  Enchanted: 0x20,
});

/** FileProxy.ReadCString with a non-zero readLength: the FULL length is
 *  consumed and only TRAILING NULs trim - an embedded NUL and whatever
 *  follows it stay in the string (the AUDIT 24 formats law rumorFile.js
 *  records). Classic bytes decode as latin1, the readers' charter. */
export function readCStringFixed(bytes, start, length) {
  let s = '';
  for (let i = start; i < start + length; i++) s += String.fromCharCode(bytes[i]);
  return s.replace(/\0+$/, '');
}

/** FileProxy.ReadCString with readLength 0: scan to the first NUL and
 *  read exactly that many bytes (the NUL itself is NOT consumed). */
export function readCStringScan(bytes, start) {
  let end = start;
  while (end < bytes.length && bytes[end] !== 0) end++;
  let s = '';
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** SaveTree.ReadPosition - i32 WorldX/WorldY/WorldZ. */
export function readPosition(view, offset) {
  return {
    worldX: view.getInt32(offset, true),
    worldY: view.getInt32(offset + 4, true),
    worldZ: view.getInt32(offset + 8, true),
  };
}

/**
 * SaveTreeHeader.Read/ReadRawData. Throws on a version other than
 * 0x126, as DFU does ("must be a .175 or later save").
 * @param {Uint8Array} bytes - full SAVETREE.DAT contents.
 */
export function readSaveTreeHeader(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = v.getInt32(0, true);
  if (version !== SAVE_TREE_VERSION)
    throw new Error('SaveTree file has an invalid version number, must be 0x126.');
  return {
    rawData: bytes.slice(0, SAVE_TREE_HEADER_LENGTH),
    version,
    // A CharacterPositionRecord (0x04) later in the file positions the
    // player on load, not this triple (DFU's own comment).
    characterPosition: { position: readPosition(v, 4) },
    mapId: v.getUint16(16, true),
    environment: bytes[18],
  };
}

/**
 * SaveTreeBuildingRecords - i32 length then length/26 BuildingData
 * records, field-for-field the shape blocksFile.js gives RMB building
 * lists (DFLocation.BuildingData is the one DFU struct behind both).
 * @returns {{record: object, nextOffset: number}}
 */
export function readBuildingRecords(bytes, offset) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const streamPosition = offset;
  const recordLength = v.getInt32(offset, true);
  let pos = offset + 4;
  const numberOfBuildings = recordLength > 0 ? Math.trunc(recordLength / 26) : 0;
  const recordData = new Array(numberOfBuildings);
  for (let i = 0; i < numberOfBuildings; i++) {
    recordData[i] = {
      nameSeed: v.getUint16(pos, true),
      serviceTimeLimit: v.getUint32(pos + 2, true),
      unknown: v.getUint16(pos + 6, true),
      unknown2: v.getUint16(pos + 8, true),
      unknown3: v.getUint32(pos + 10, true),
      unknown4: v.getUint32(pos + 14, true),
      factionId: v.getUint16(pos + 18, true),
      sector: v.getInt16(pos + 20, true),
      locationId: v.getUint16(pos + 22, true),
      buildingType: bytes[pos + 24],
      quality: bytes[pos + 25],
    };
    pos += 26;
  }
  return {
    record: { streamPosition, recordLength, numberOfBuildings, recordData },
    nextOffset: pos,
  };
}

/** SaveTreeBaseRecord.ReadRecordRoot - the 71-byte record header, at
 *  its exact classic offsets (the gaps are real). */
export function readRecordRoot(streamData) {
  const v = new DataView(streamData.buffer, streamData.byteOffset, streamData.byteLength);
  return {
    pitch: v.getInt16(1, true),
    yaw: v.getInt16(3, true),
    roll: v.getInt16(5, true),
    position: readPosition(v, 7),
    spriteIndex: v.getUint16(27, true),
    picture2: v.getUint16(29, true),
    recordId: v.getUint32(31, true),
    questId: streamData[38],
    parentRecordId: v.getUint32(39, true),
    time: v.getUint32(43, true),
    itemObject: v.getUint32(47, true),
    questObjectId: v.getUint32(51, true),
    nextObject: v.getUint32(55, true),
    childObject: v.getUint32(59, true),
    sublistHead: v.getUint32(63, true),
    parentRecordType: v.getInt32(67, true),
  };
}

/** ItemRecord.ReadNativeItemData - the 107-byte native item layout.
 *  The name is scanned to its NUL (ReadCString(reader, 0)) but the
 *  cursor strides the full 32 bytes. */
export function parseItemRecordData(recordData) {
  const v = new DataView(recordData.buffer, recordData.byteOffset, recordData.byteLength);
  const d = {
    name: readCStringScan(recordData, 0),
    group: v.getUint16(32, true),
    index: v.getUint16(34, true),
    value: v.getUint32(36, true),
    unknown: v.getUint16(40, true),
    flags: v.getUint16(42, true),
    currentCondition: v.getUint16(44, true),
    maxCondition: v.getUint16(46, true),
    unknown2: recordData[48],
    typeDependentData: recordData[49],     // arrow stack count; potion/recipe id
    image1: v.getUint16(50, true),
    image2: v.getUint16(52, true),
    material: v.getUint16(54, true),
    color: recordData[56],
    weight: v.getUint32(57, true),
    enchantmentPoints: v.getUint16(61, true),
    message: v.getUint16(63, true),
    variants: recordData[65],
    drawOrderOrEffect: recordData[66],
    magic: [],
  };
  for (let i = 0; i < 10; i++) {
    d.magic.push({
      type: v.getInt16(67 + i * 4, true),
      param: v.getInt16(69 + i * 4, true),
    });
  }
  return d;
}

/** GuildMembershipRecord.ReadNativeGuildMembershipData - 12 bytes.
 *  Parses records of type GuildMembership AND OldGuild (SaveTree's
 *  switch routes both here). */
export function parseGuildMembershipRecordData(recordData) {
  const v = new DataView(recordData.buffer, recordData.byteOffset, recordData.byteLength);
  return {
    rank: recordData[0],
    notedByGuild: recordData[1],
    guildType: recordData[2],
    factionId: v.getUint16(3, true),
    timeOfLastRankChange: v.getUint32(5, true),
    unused: recordData[9],
    blessingMagnitude: recordData[10],
    unused2: v.getUint16(11, true),
  };
}

/** DiseaseOrPoisonRecord.ReadNativeDiseaseOrPoisonData - 47 bytes: the
 *  id byte then 23 u16 in DFU's exact order. daysOfSymptomsLeft: 0xFF
 *  never-ending, 0xFE symptoms over. */
export function parseDiseaseOrPoisonRecordData(recordData) {
  const v = new DataView(recordData.buffer, recordData.byteOffset, recordData.byteLength);
  const u16 = (o) => v.getUint16(o, true);
  return {
    id: recordData[0],
    damagesSTR: u16(1), damagesINT: u16(3), damagesWIL: u16(5),
    damagesAGI: u16(7), damagesEND: u16(9), damagesPER: u16(11),
    damagesSPD: u16(13), damagesLUC: u16(15), damagesHEA: u16(17),
    damagesFAT: u16(19), damagesSPL: u16(21),
    minDamage: u16(23), maxDamage: u16(25),
    daysOfSymptomsLeft: u16(27), incubationOver: u16(29),
    totaldamageSTR: u16(31), totaldamageINT: u16(33), totaldamageWIL: u16(35),
    totaldamageAGI: u16(37), totaldamageEND: u16(39), totaldamagePER: u16(41),
    totaldamageSPD: u16(43), totaldamageLUC: u16(45),
  };
}

/** ContainerRecord.WagonCheck - a container whose root SpriteIndex is 4
 *  is the wagon (the Container comment's own slot table). */
export const isWagonRecord = (record) => record.recordRoot?.spriteIndex === 4;

/**
 * One RecordElement: SaveTreeBaseRecord.Open + ReadRecordRoot, plus the
 * typed parse SaveTree.ReadRecords' switch would run. Returns the
 * record and the offset after its data.
 */
export function readSaveTreeRecord(bytes, offset, length) {
  const record = {
    streamPosition: offset,
    streamLength: length,
    streamData: null,
    recordType: RECORD_TYPES.Null,
    recordRoot: null,
    recordData: null,
    parsedData: null,
    parent: null,
    children: [],
    failedRecord: false,
  };
  if (length <= 0) return { record, nextOffset: offset };

  // Peek record type and adjust for light size (Open).
  record.recordType = bytes[offset];
  if (record.recordType === RECORD_TYPES.Light)
    record.streamLength = length * LIGHT_DATA_LENGTH_MULTIPLIER;

  // ReadBytes at EOF returns what remains - a Light record's x39 length
  // can overrun the stream because ReadRecords' overflow guard checked
  // the UNmultiplied length. slice clamps the same way.
  record.streamData = bytes.slice(offset, offset + record.streamLength);

  // ReadRecordRoot refuses a record shorter than the root itself; the
  // C# record then carries its DEFAULT (all-zero) RecordRoot struct,
  // which AddRecord will key by RecordID 0. Preserved.
  if (record.streamData.length < RECORD_ROOT_LENGTH) {
    record.failedRecord = true;
    record.recordRoot = {
      pitch: 0, yaw: 0, roll: 0,
      position: { worldX: 0, worldY: 0, worldZ: 0 },
      spriteIndex: 0, picture2: 0, recordId: 0, questId: 0,
      parentRecordId: 0, time: 0, itemObject: 0, questObjectId: 0,
      nextObject: 0, childObject: 0, sublistHead: 0, parentRecordType: 0,
    };
    return { record, nextOffset: offset + record.streamLength };
  }
  record.recordRoot = readRecordRoot(record.streamData);
  record.recordData = record.streamData.subarray(RECORD_ROOT_LENGTH);

  // The ReadRecords type switch - each typed record's ReadNative* parse.
  switch (record.recordType) {
    case RECORD_TYPES.Item:
      record.parsedData = parseItemRecordData(record.recordData);
      break;
    case RECORD_TYPES.Character:
      record.parsedData = parseCharacterRecordData(record.recordData);
      break;
    case RECORD_TYPES.Spell:
      // SpellRecord.ReadNativeSpellData -> DaggerfallSpellReader.
      // ReadSpellData; null when the C# would return false and leave
      // the default (empty) instance.
      record.parsedData = readSpellRecord(record.recordData);
      break;
    case RECORD_TYPES.GuildMembership:
    case RECORD_TYPES.OldGuild:
      record.parsedData = parseGuildMembershipRecordData(record.recordData);
      break;
    case RECORD_TYPES.DiseaseOrPoison:
      record.parsedData = parseDiseaseOrPoisonRecordData(record.recordData);
      break;
    case RECORD_TYPES.TrappedSoul:
      // TrappedSoulRecord: the monster id rides the ROOT at 0x1B
      // (spriteIndex); the body "seems always a single byte = 150".
      record.parsedData = { unknown: record.recordData.slice() };
      break;
    case RECORD_TYPES.Container:
      // ContainerRecord: variable unknown bytes, often just one.
      record.parsedData = { unknown: record.recordData.slice() };
      break;
    default:
      break;
  }

  return { record, nextOffset: offset + record.streamLength };
}

/** Represents a SAVETREE.DAT file (SaveTree.cs). */
export class SaveTree {
  constructor() {
    this.header = null;
    this.buildingRecords = null;
    this.rootRecord = this._emptyRecord();
    /** @type {Map<number, object>} RecordID -> record */
    this.recordDictionary = new Map();
    this.duplicateKeysFound = 0;
  }

  _emptyRecord() {
    return {
      streamPosition: 0, streamLength: 0, streamData: null,
      recordType: RECORD_TYPES.Null, recordRoot: null, recordData: null,
      parsedData: null, parent: null, children: [], failedRecord: false,
    };
  }

  /**
   * SaveTree.Open.
   * @param {Uint8Array|ArrayBuffer} buffer - full SAVETREE.DAT contents.
   * @returns {boolean} true (throws on a bad version, as DFU does).
   */
  load(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.header = readSaveTreeHeader(bytes);
    const buildings = readBuildingRecords(bytes, SAVE_TREE_HEADER_LENGTH);
    this.buildingRecords = buildings.record;
    this._readRecords(bytes, buildings.nextOffset);
    return true;
  }

  /** SaveTree.FindRecord - first record of type, or null. */
  findRecord(type, root = null) {
    const records = this.findRecords(type, root);
    return records.length === 0 ? null : records[0];
  }

  /** SaveTree.FindRecords - all records of type under root (depth-first,
   *  parent before children, as the recursion visits them). */
  findRecords(type, root = null) {
    const list = [];
    const walk = (record) => {
      if (record.recordType === type) list.push(record);
      for (const child of record.children) walk(child);
    };
    walk(root ?? this.rootRecord);
    return list;
  }

  /** SaveTree.FilterRecordsByParentType. */
  filterRecordsByParentType(source, parentType) {
    return source.filter((r) => r.parent !== null && r.parent.recordType === parentType);
  }

  // SaveTree.ReadRecords + AddRecord + LinkChildren.
  _readRecords(bytes, offset) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.recordDictionary.clear();
    this.duplicateKeysFound = 0;
    this.rootRecord = this._emptyRecord();
    let pos = offset;
    while (pos < bytes.length) {
      // Read record length and skip empty records as they have no data.
      // A tail shorter than the 4-byte length throws (DFU's ReadInt32
      // does the same at end of stream) - getInt32 ranges out.
      const length = v.getInt32(pos, true);
      pos += 4;
      if (length <= 0) continue;

      // Handle potential stream overflow (e.g. corrupt save) - `>=`,
      // so a record ending exactly at EOF is rejected too. Verbatim.
      if (pos + length >= bytes.length) break;

      const { record, nextOffset } = readSaveTreeRecord(bytes, pos, length);
      pos = nextOffset;

      // AddRecord: duplicate RecordIDs are counted and dropped. A
      // failed record keys by its zeroed root's RecordID 0, verbatim.
      const key = record.recordRoot.recordId;
      if (this.recordDictionary.has(key)) {
        this.duplicateKeysFound++;
        continue;
      }
      this.recordDictionary.set(key, record);
    }

    // LinkChildren: parent by ParentRecordID; orphans go under root.
    for (const record of this.recordDictionary.values()) {
      const parent = this.recordDictionary.get(record.recordRoot.parentRecordId);
      if (parent !== undefined) {
        record.parent = parent;
        parent.children.push(record);
      } else {
        this.rootRecord.children.push(record);
      }
    }
  }
}
