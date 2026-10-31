// A BAY PORT'S PLACING GROUND AS THE WORLD HOST BUILDS IT (scenes/world.js townPlacesFor, scenes/pixelBuild.js),
// off the player's own ARENA2, in Daggerfall's layout (OWN-WORK3: the town packs are retired, so the old `packs`
// option is gone): the pixel's terrain job, the yards' walk shut (TS7) and
// measures, the yards placed, and the sea's field. `ground()` answers a fresh ground each call - a ground is placed on once.
// Built as test/world/fb1028_walls.test.js placedYards builds it.
import { join } from 'node:path';

/** @param {string} arena2 @param {(p: string) => Uint8Array} readFileSync @param {string} [name] */
export async function bayPortGround(arena2, readFileSync, name) {
  const R = (p) => import(new URL(`../src/${p}`, import.meta.url).href);
  const W = await R('formats/worldData/worldDataReplacement.js');
  const { MapsFile, longitudeLatitudeToMapPixel } = await R('formats/mapsFile.js');
  const { BlocksFile } = await R('formats/blocksFile.js');
  const { Arch3dFile } = await R('formats/arch3dFile.js');
  const { WoodsFile } = await R('formats/woodsFile.js');
  const { installTownOutline } = await R('world/townOutline.js');
  const { installArena, ARENA_BLOCK } = await R('world/arena/arenaCity.js');
  const walls = await R('world/townWalls.js');
  const ys = await R('world/merchantYards/merchantYardSites.js');
  const ps = await R('world/portSites.js');
  const { townGateRoads } = await R('world/townGates.js');
  const { setLocationTiles } = await R('world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await R('world/terrain/terrainGen.js');
  const { shapeBefore } = await R('world/terrain/townBlendBefore.js');
  const { layoutLocation } = await R('world/locationLayout.js');
  const { collectBlockFlats } = await R('world/rmbFlats.js');
  const { classicModelIdOf } = await R('world/customModels.js');
  const { flatFieldFor } = await R('world/flatFields.js');
  const { townYardsOf } = await R('world/merchantYards/townYards.js');
  const { fabricWalkShut } = await R('world/urban/townFabricStand.js');
  const { BODY } = await R('world/windmillMesh.js');
  const { localAabb, transformedAabb } = await R('render/frustum.js');
  const { blockBuildingCount } = await R('systems/talk/talkTopics.js');
  const { BUILDING_TYPES } = await R('world/buildingNames.js');
  const { isWaterPixel } = await R('ui/overworldModel.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(arena2, f)));
  const { bayRoads } = await import('./bayRoads.mjs');   // OWN-WORK2: the Bay's own network, off the same ARENA2
  const { roads: roadsB, tracks: tracksB } = bayRoads();
  walls.setTownWallPaths(walls.townWallPathsReader({ bay: () => ({ roads: roadsB, tracks: tracksB }) }));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  installArena({ readBin: async () => { throw new Error('no colosseum in a test'); }, log: null });
  installTownOutline();
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  let loc = null;
  // BAY-OWN: a Bay town, found in MAPS.BSA's own regions (walled on its outline in Daggerfall's layout)
  for (let r = 0; r < maps.regionCount && !loc; r++) {
    const reg = maps.getRegion(r);
    for (let l = 0; reg && l < reg.locationCount && !loc; l++) { const c = maps.getLocation(r, l); if (c?.name === name) loc = c; }
  }
  if (!loc) throw new Error(`no Bay town named ${name}`);
  const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude), px = p.x, py = p.y;
  const tm = new Uint8Array(128 * 128), rect = setLocationTiles(loc, maps, blocks, tm);
  rect.gateRoads = townGateRoads(loc, maps, blocks);
  rect.shapeWas = shapeBefore(rect.shape, loc.mapTableData.mapId >>> 0);
  const job = generatePixelTerrain({ woods, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads: roadsB, tracks: tracksB, smooth: true } });
  const yl = layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true });
  const size = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : arch.getMesh(i)?.size ?? null; };
  const palaceIn = (b) => { const list = b.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? []; for (let i = 0; i < Math.min(list.length, blockBuildingCount(b.dfBlock)); i++) if (list[i]?.buildingType === BUILDING_TYPES.Palace) return true; return false; };
  const shut = walls.yardWalkShut(fabricWalkShut(walls.townWalkShut(loc, job.yardGround, job.yardPaths, true), loc), fabricWalkShut(walls.townWalkShut(loc, job.townGround, job.paths), loc), loc);
  const measures = {
    ...ys.yardMeasuresOf(shut.yardLayout(yl), {
      boxOf: (id, at) => ys.placedModelBox(id, at, { custom: () => null, classic: (cid) => size(classicModelIdOf(cid)) }),
      fieldOf: flatFieldFor, flatsOf: (b) => collectBlockFlats(b.dfBlock, 0), closedBlock: (b) => b.blockName === ARENA_BLOCK || palaceIn(b),
      millBox: (at) => { const box = transformedAabb(localAabb(BODY.positions), at); return [box[0], box[2], box[3], box[5]]; },
    }),
    keep: [],
  };
  const sea = ps.openSeaOf((x, y) => isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)), 1000, 500);
  const bearing = ps.seaBearing(px, py, (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && sea[y * 1000 + x] === 1);
  const ground = () => { const g = ys.townGroundOf(yl, measures, shut, townYardsOf(loc)); ys.yardSitesOn(g); return g; };
  const g0 = ground();
  return { loc, yl, ground, mapId: loc.mapTableData.mapId >>> 0, field: ps.seaField(g0.width, g0.height, ps.townSeaOf(yl, bearing), bearing) };
}
