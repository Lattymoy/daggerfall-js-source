// LW-WALLS / LW-SPACE (bible/06-Systems/Living-World.md): THE GAME'S OWN TOWNS, AS THE STREAMING HOST BUILDS THEM - a town
// of ARENA2 replayed in Node with the host's own producers (scenes/world.js's population block, pinned word for word by
// test/lwwalls_city.test.js): its location laid out (`layoutLocation`, on the enhanced skin with its water and its
// mills - the living world's lane, each on by default), its navgrid off each block's automap and ground, every model's
// static doors by the host's law into the location frame, its buildings' summaries and its MAPS row. For the pins that
// read the game's data (skipped where ARENA2_PATH names none) and the probes that measure on it
// (tools/livingCrowdProbe.mjs). Read-only over the data; nothing is written.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CityNavigation, NAV_CELL } from '../src/world/cityNavigation.js';
import { MapsFile, getWorldClimateSettings, longitudeLatitudeToMapPixel, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { isCityGate } from '../src/world/rmbLayout.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { patchSeams } from '../src/world/arch3dSeams.js';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { trs, multiply } from '../src/world/mat4.js';
import { hasPort } from '../src/systems/travelPorts.js';

export const ARENA2 = process.env.ARENA2_PATH;
export const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

/** The game's data, read once: the maps, the blocks, and each model as the pipeline mints it (its seams closed). */
let _game = null;
export function game() {
  if (_game) return _game;
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const modelOf = (id) => {
    if (!models.has(id)) { const i = arch.getRecordIndex(id); models.set(id, i === -1 ? null : dfMeshToModel(patchSeams(id, arch.getMesh(i)), () => ({ width: 64, height: 64 }))); }
    return models.get(id);
  };
  _game = { maps, blocks, modelOf };
  return _game;
}

/** A town as the streaming host builds its living town (the population block, pinned above), on the enhanced skin with
 *  its water and its mills (the living world's lane, each on by default): the location frame is the location's own
 *  origin. And where its city gates stand, in navgrid cells. */
export function hostTown(dfLocation) {
  const { maps, blocks, modelOf } = game();
  const md = dfLocation.mapTableData;
  const p = longitudeLatitudeToMapPixel(md.longitude, md.latitude);
  const loc = layoutLocation(dfLocation, maps, blocks, { enhanced: true, windmills: true });
  const nav = new CityNavigation(loc.width, loc.height);
  for (const b of loc.blocks) {
    const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
    nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData, (tx, ty) => srcTiles[tx][ty].textureRecord, { enhancedWater: true });
  }
  const doors = [], gates = [];
  for (const b of loc.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const local = multiply(originMatrix, placed.matrix);
      if (isCityGate(placed.modelIdNum)) gates.push([Math.floor(local[12] / NAV_CELL), Math.floor(local[14] / NAV_CELL)]);
      const cpu = modelOf(placed.modelIdNum);
      if (!cpu?.doors?.length) continue;
      for (const door of getStaticDoors(cpu, b.dfBlock.index, placed.recordIndex, local)) {
        const m = door.matrix, c = door.centre, n = door.normal;
        doors.push({
          key: makeBuildingKey(b.x, b.y, placed.recordIndex),
          x: m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], z: m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14],
          nx: m[0] * n.x + m[4] * n.y + m[8] * n.z, nz: m[2] * n.x + m[6] * n.y + m[10] * n.z,
        });
      }
    }
  }
  const buildings = buildingSummaries(dfLocation.exterior?.buildings ?? [], loc.blocks, { locationIndex: dfLocation.locationIndex ?? 0, locationName: dfLocation.name })
    .map((b) => ({ key: b.buildingKey, type: b.buildingType, quality: b.quality, factionId: b.factionId }));
  const town = {
    mapId: md.mapId >>> 0, name: String(dfLocation.name ?? ''), px: p.x, py: p.y, type: md.locationType, region: dfLocation.regionIndex,
    people: getWorldClimateSettings(maps.getClimateIndex(p.x, p.y))?.people, blocks: Math.max(1, loc.width * loc.height), port: hasPort(md.mapId),
  };
  return { nav, doors, buildings, town, gates };
}

/** Every city of the game's own rows (a mod's appended rows never). */
export function cities() {
  const { maps } = game();
  const out = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (loc?.exterior?.exteriorData && loc.mapTableData?.locationType === LOCATION_TYPES.TownCity) out.push(loc);
    }
  }
  return out;
}

/** Every town of the game's own rows of the location types asked (a mod's appended rows never) - LW-SPACE: a village's
 *  and a hamlet's too. @param {readonly number[]} types */
export function townsOf(types) {
  const { maps } = game();
  const out = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (loc?.exterior?.exteriorData && types.includes(loc.mapTableData?.locationType)) out.push(loc);
    }
  }
  return out;
}

export { LOCATION_TYPES };
