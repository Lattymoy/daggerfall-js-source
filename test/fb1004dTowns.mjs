// FIELD BUGS 2026-10-04d: A REGION THE SIZE OF A TEST, in the port's own shapes - towns laid out from RMB blocks
// (BlocksFile.readClassicBlock's DFBlock), their buildings' interiors carrying quest markers (editor flats 199.11 and
// 199.18), a dungeon of one RDB block, and the world seam a running host hands the quest machine (machine.js's
// contract) - for the LOOT-CLICK, RESEAT-DECLARED, RESEAT-GAPS and QUEST-MARKERS pins. No game data: every block is
// built here. A town's blocks are served by NAME through `world.getBlock`, so a test lays a town out again (a town mod
// switched on or off, a pack that could not load) by handing the world another block under the same name.
import { readFileSync, readdirSync } from 'node:fs';
import { BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';

export const SPAWN = 11, ITEM = 18, ENTER = 8;

/** The vendored quest tables, loaded once (the parser's Quests-Places, -Factions, -Items...). */
export function loadTables() {
  const T = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(T)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, T), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}
/** A quest script out of the vendored corpus, as lines. */
export const questScript = (name) => readFileSync(new URL(`../vendor/dfu-quests/Quests/${name}.txt`, import.meta.url), 'utf8').replace(/^﻿/, '').split(/\r?\n/);

/** An editor flat (archive 199) at raw block units - a quest spawn (11), a quest item (18) or an enter marker (8). */
export const mark = (record, x = 0, y = 0, z = 0) => ({ position: 0, xPos: x, yPos: y, zPos: z, textureArchive: 199, textureRecord: record, factionID: 0, flags: 0 });
const half = (flats = []) => ({
  header: { num3dObjectRecords: flats.length ? 1 : 0, numFlatObjectRecords: flats.length, numSection3Records: 0, numPeopleRecords: 0, numDoorRecords: 0 },
  block3dObjectRecords: flats.length ? [{ modelId: '0', modelIdNum: 0, objectType: 3, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }] : [],
  blockFlatObjectRecords: flats, blockSection3Records: [], blockPeopleRecords: [], blockDoorRecords: [],
});

/** An RMB block of `buildings` - each `{ type, faction = 0, seed = 1, markers = [mark(SPAWN)] }` - in the port's DFBlock
 *  shape; `fromWorldData` as the door's converter marks a mod's block. */
export function rmbBlock(name, buildings, { index = 0, fromWorldData = false } = {}) {
  return {
    position: 0, index, name, type: BLOCK_TYPES.Rmb, rdbBlock: null, rdiBlock: null, ...(fromWorldData ? { fromWorldData: true } : {}),
    rmbBlock: {
      fldHeader: {
        numBlockDataRecords: buildings.length, numMisc3dObjectRecords: 0, numMiscFlatObjectRecords: 0,
        blockPositions: buildings.map(() => ({ xPos: 0, zPos: 0, yRotation: 0 })),
        buildingDataList: buildings.map((b, i) => ({ nameSeed: b.seed ?? 100 + i, factionId: b.faction ?? 0, sector: 0, locationId: 0, buildingType: b.type, quality: 10 })),
        name, otherNames: null,
      },
      subRecords: buildings.map((b) => ({ xPos: 0, zPos: 0, yRotation: 0, exterior: half(), interior: half(b.markers ?? [mark(SPAWN, 10, 0, 10)]) })),
      misc3dObjectRecords: [], miscFlatObjectRecords: [],
    },
  };
}

/** A dungeon's RDB block with one quest spawn marker (EnumerateDungeonQuestMarkers' shape). */
export const rdbBlock = (position = 100) => ({ position, rdbBlock: { objectRootList: [{ rdbObjects: [{ type: 3, position: 7, xPos: 0, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: SPAWN } } }] }] } });

/** A town of the region: `grid` its block names, row by row `width` wide. */
export function town({ name, locationIndex, mapId, type = 2, grid, width = grid.length, regionIndex = 17, regionName = 'Daggerfall' }) {
  return {
    loaded: true, name, regionIndex, regionName, locationIndex, hasDungeon: false, dungeon: null,
    mapTableData: { mapId, locationType: type, dungeonType: -1 },
    exterior: { buildings: [], recordElement: { header: { x: 0, y: 0 } }, exteriorData: { locationId: mapId & 0xffff, width, height: Math.ceil(grid.length / width), blockNames: [...grid] } },
  };
}
/** A dungeon of the region, of DFRegion dungeon type `dungeonType`, one RDB block. */
export function dungeon({ name, locationIndex, mapId, dungeonType, block = 'DUNG.RDB', regionIndex = 17, regionName = 'Daggerfall' }) {
  return {
    loaded: true, name, regionIndex, regionName, locationIndex, hasDungeon: true, dungeon: { blocks: [{ x: 0, z: 0, blockName: block }] },
    mapTableData: { mapId, locationType: 7, dungeonType },
    exterior: { buildings: [], recordElement: { header: { x: 0, y: 0 } }, exteriorData: { locationId: mapId & 0xffff, width: 1, height: 1, blockNames: [] } },
  };
}

const faction = (id) => ({ id, type: 2, name: `Faction ${id}`, race: -1, flat1: (182 << 7) | 1, flat2: (182 << 7) | 2 });

/** The world seam over `locations` (index = locationIndex) and `blocks` (a Map name -> DFBlock, read at every ask), the
 *  player out in the wilds unless `current` names a location; `inside()` answers what PlayerEnterExit would. */
export function worldOf({ locations, blocks, current = null, inside = () => null, regionIndex = 17, regionName = 'Daggerfall' }) {
  const region = { name: regionName, locationCount: locations.length, mapTable: locations.map((l) => l.mapTableData), mapNameLookup: new Map(locations.map((l, i) => [l.name, i])) };
  return {
    maps: {
      regionCount: regionIndex + 1, getRegion: (r) => (r === regionIndex ? region : null), getLocation: (_r, i) => locations[i] ?? null,
      getLocationByName: (_r, n) => locations.find((l) => l.name === n) ?? null,
      getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * loc.exterior.exteriorData.width + x],
      readLocationIdFast: (_r, i) => locations[i]?.exterior.exteriorData.locationId ?? 0,
      getClimateIndex: () => 231,   // a clock's travel time walks the climates between here and there (clock.js travelTimeSeconds)
    },
    getBlock: (name) => blocks.get(name) ?? null,
    currentLocation: () => current ?? { loaded: false }, currentRegionIndex: () => regionIndex, currentLocationIndex: () => current?.locationIndex ?? -1,
    currentRegionName: () => regionName, isPlayerInLocationRect: () => !inside() && !!current, playerInside: inside, isHouseOwned: () => false,
    playerPixel: () => ({ x: 1, y: 1 }), buildingNameOpts: () => ({}), getFactionData: faction, findFactionsOfType: (type) => [{ ...faction(201), type }],
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3,
  };
}

/** A building key's three parts (BuildingDirectory.ReverseBuildingKey). */
export const keyParts = (key) => [(key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff];
/** The type of the building a site's key names in its town as `world` lays it out now, or null for none. */
export function typeAtKey(world, location, key) {
  const [x, y, rec] = keyParts(key);
  const b = world.getBlock(world.maps.getRmbBlockName(location, x, y));
  return b?.rmbBlock?.fldHeader?.buildingDataList?.[rec]?.buildingType ?? null;
}
