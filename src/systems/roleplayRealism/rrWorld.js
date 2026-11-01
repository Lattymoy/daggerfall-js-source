// THE MASTER ARMORER'S WORLD, DFO'S OWN. The release's quest line reads three world-data files: a new location, its
// block and the armorer's rebuilt shop. All three are ours. The keep is a Bay palace block from the player's own
// BLOCKS.BSA, its court stood down and the lord's household stood in the court's places. The shop is the player's
// own smithy with Brannoc Hale at its quest marker.
import { blockToDfuJson, buildingToDfuJson } from '../../formats/worldData/worldDataJson.js';
import { registerWorldDataAsset, blockReplacementFilename, buildingReplacementFilename } from '../../formats/worldData/worldDataReplacement.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { REGION_NAMES } from '../../formats/mapsTables.js';
import { rrEnabled } from './rrRealism.js';
import { RR_FACTION_IDS, RR_FORT_PIXEL, RR_ARMORER_BLOCK, RR_ARMORER_RECORD } from './rrQuestLine.js';

/** The keep's name, ours. */
export const RR_KEEP_NAME = 'Grayhold';
/** Facts the release's quest tables and a save hold: the keep's location id and its hall's (the Places rows
 *  Northrock_Fort_Ext and Northrock_Fort), its block's name and the DFU names of the three files. */
export const RR_KEEP_LOCATION_ID = 0x73A0;
export const RR_KEEP_HALL_ID = 0x73A1;
export const RR_KEEP_BLOCK = 'RRFORT01.RMB';
export const RR_KEEP_FILE = 'locationnew-RRfort01-16.json';
export const RR_KEEP_BLOCK_FILE = blockReplacementFilename(RR_KEEP_BLOCK);
/** What each is made of: a block of the player's BLOCKS.BSA, by name and index (checked), and its record. */
export const RR_KEEP_FROM = Object.freeze({ block: 'PALAGA04.RMB', index: 78, record: 0 });
export const RR_ARMORY_FROM = Object.freeze({ block: RR_ARMORER_BLOCK, index: 765, record: RR_ARMORER_RECORD });
export const RR_ARMORY_FILE = buildingReplacementFilename(RR_ARMORY_FROM.block, RR_ARMORY_FROM.index, RR_ARMORY_FROM.record, '_master');
/** Our choices: the keep is its lord's house, kept well; the shop a master's armory; Brannoc Hale's picture. */
export const RR_KEEP_QUALITY = 16;
export const RR_ARMORY_QUALITY = 18;
export const RR_ARMORY_SEED = 1022;
export const RR_SMITH_FLAT = Object.freeze([182, 24]);   // FLATS.CFG: "bearded old man"
/** The quest places fourteen people at the hall's markers 0-13 (the armorer, the lord, the captain, the door guard and
 *  ten guards). */
export const RR_KEEP_MARKERS = 14;

const EDITOR = 199, QUEST = 11, ENTER = 8, POST = 20;
const isFlat = (f, record) => f.TextureArchive === EDITOR && f.TextureRecord === record;
const dist = (a, b) => Math.hypot(a.XPos - b.XPos, a.ZPos - b.ZPos);

/** The keep as DFU's World Data Editor writes a location: the site the release's quest logic is bound to (Aldleigh,
 *  its first quest's town, stands beside it), our name, a wealthy home on the map, hidden until the quest reveals it. */
export function rrKeepLocationJson() {
  const { x, y } = RR_FORT_PIXEL;
  // BAY-OWN: MAPS.BSA's own frame - the keep is a location of the Bay's region 16, keyed and placed as its towns are
  const mapId = y * 1000 + x, row = 499 - y;
  return {
    Loaded: true, Name: RR_KEEP_NAME, RegionName: REGION_NAMES[16], HasDungeon: false,
    MapTableData: { MapId: mapId, Latitude: row * 128, Longitude: x * 128, LocationType: 'HomeWealthy', DungeonType: 'NoDungeon', Discovered: false, Key: 0 },
    Exterior: {
      RecordElement: { Header: { X: x * 32768, Y: row * 32768, IsExterior: 32768, Unknown2: 0, LocationId: RR_KEEP_LOCATION_ID, IsInterior: 0, ExteriorLocationId: 0, LocationName: RR_KEEP_NAME } },
      BuildingCount: 1,
      Buildings: [{ NameSeed: 0, FactionId: RR_FACTION_IDS.LordVerathon, Sector: 0, LocationId: RR_KEEP_HALL_ID, BuildingType: 'House6', Quality: RR_KEEP_QUALITY }],
      ExteriorData: { AnotherName: RR_KEEP_NAME, MapId: mapId, LocationId: 0, Width: 1, Height: 1, PortTownAndUnknown: 0, BlockNames: [RR_KEEP_BLOCK] },
    },
    Climate: { WorldClimate: 226, ClimateType: 'Mountain', NatureSet: 'Nature_Mountains', GroundArchive: 102, NatureArchive: 510, SkyBase: 0, People: 'Nord', Names: null },
    Politic: 128 + 16, RegionIndex: 16, LocationIndex: 0,
  };
}

/** The hall's fourteen quest markers, from the palace's own interior: marker 0 its first quest marker (the armorer, kept
 *  apart), 1 the ruler's seat (the person of the building's faction), 2 the court's place nearest it, 3 the court's
 *  place nearest the door, then the court's other places, the palace's other quest markers and its guard posts, in the
 *  record's order. */
export function rrKeepMarkers(interior, rulerFaction) {
  const flats = interior.BlockFlatObjectRecords ?? [], court = [...(interior.BlockPeopleRecords ?? [])];
  const quest = flats.filter((f) => isFlat(f, QUEST));
  const enter = flats.find((f) => isFlat(f, ENTER));
  const take = (p) => { const i = court.indexOf(p); if (i >= 0) court.splice(i, 1); return p ?? null; };
  const nearest = (to) => (to ? court.reduce((best, p) => (!best || dist(p, to) < dist(best, to) ? p : best), null) : null);
  const ruler = take(court.find((p) => p.FactionID === rulerFaction) ?? court[0]);
  const captain = take(nearest(ruler));
  const door = take(nearest(enter ?? ruler));
  return [quest[0], ruler, captain, door, ...court, ...quest.slice(1), ...flats.filter((f) => isFlat(f, POST))]
    .filter(Boolean).slice(0, RR_KEEP_MARKERS).map((p) => ({ XPos: p.XPos, YPos: p.YPos, ZPos: p.ZPos }));
}

const classicOf = (blocksFile, from) => {
  const got = blocksFile.getBlockName(from.index);
  if (got !== from.block) throw new Error(`roleplay realism: wants ${from.block} at block ${from.index}, BLOCKS.BSA has ${got}`);
  return blocksFile.readClassicBlock(from.index);
};

/** The keep's block: the player's palace block under the keep's name, its building the lord's house, its court and
 *  quest markers taken out and the hall's fourteen markers put in. */
export function rrKeepBlockJson(blocksFile) {
  const from = RR_KEEP_FROM;
  const json = blockToDfuJson(classicOf(blocksFile, from));
  json.Name = RR_KEEP_BLOCK;
  json.RmbBlock.FldHeader.Name = RR_KEEP_BLOCK;
  const building = json.RmbBlock.FldHeader.BuildingDataList[from.record];
  const interior = json.RmbBlock.SubRecords[from.record].Interior;
  const markers = rrKeepMarkers(interior, building.FactionId);
  Object.assign(building, { NameSeed: 0, FactionId: RR_FACTION_IDS.LordVerathon, LocationId: RR_KEEP_HALL_ID, BuildingType: BUILDING_TYPES.House6, Quality: RR_KEEP_QUALITY });
  interior.BlockPeopleRecords = [];
  interior.BlockFlatObjectRecords = [
    ...interior.BlockFlatObjectRecords.filter((f) => !isFlat(f, QUEST)),
    ...markers.map((m) => ({ Position: 0, ...m, TextureArchive: EDITOR, TextureRecord: QUEST, FactionID: 0, Flags: 0 })),
  ];
  interior.Header.NumPeopleRecords = 0;
  interior.Header.NumFlatObjectRecords = interior.BlockFlatObjectRecords.length;
  return json;
}

/** The armorer's shop as the quest's `_master` variant: the player's own smithy record, an armory of the smith's
 *  faction, and Brannoc Hale standing at its quest marker (beside the keeper where it has none). */
export function rrArmoryJson(blocksFile) {
  const from = RR_ARMORY_FROM;
  const json = buildingToDfuJson(classicOf(blocksFile, from), from.record);
  Object.assign(json, { FactionId: RR_FACTION_IDS.OrthusDharjen, BuildingType: BUILDING_TYPES.Armorer, Quality: RR_ARMORY_QUALITY, NameSeed: RR_ARMORY_SEED });
  const interior = json.RmbSubRecord.Interior;
  const keeper = interior.BlockPeopleRecords[0] ?? null;
  const spot = interior.BlockFlatObjectRecords.find((f) => isFlat(f, QUEST)) ?? keeper;
  if (!spot) throw new Error(`roleplay realism: ${from.block} record ${from.record} has no place for its smith`);
  interior.BlockPeopleRecords.push({
    Position: RR_ARMORY_SEED, XPos: spot.XPos, YPos: spot.YPos, ZPos: spot.ZPos, TextureArchive: RR_SMITH_FLAT[0], TextureRecord: RR_SMITH_FLAT[1],
    FactionID: RR_FACTION_IDS.OrthusDharjen, Flags: (keeper?.Flags ?? 0) & ~32,   // the keeper's flags, a man's
  });
  interior.Header.NumPeopleRecords = interior.BlockPeopleRecords.length;
  return json;
}

/** The three files onto the world-data door, behind the mod's switch as a vendored mod's were: the location always,
 *  the block and the shop when the player's BLOCKS.BSA is bound. Answers how many landed. */
export function installRoleplayRealismWorld(blocksFile, isOn = () => rrEnabled()) {
  let n = registerWorldDataAsset(RR_KEEP_FILE, rrKeepLocationJson(), isOn) ? 1 : 0;
  if (!blocksFile) return n;
  try {
    if (registerWorldDataAsset(RR_KEEP_BLOCK_FILE, rrKeepBlockJson(blocksFile), isOn)) n++;
    if (registerWorldDataAsset(RR_ARMORY_FILE, rrArmoryJson(blocksFile), isOn)) n++;
  } catch (e) { console.error(`[worlddata] ${e?.message ?? e} - the Master Armorer's keep and shop stand unbuilt`); }
  return n;
}
