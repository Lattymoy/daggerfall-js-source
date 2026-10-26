// TOWN-SHAPES TS10 (2026-10-26, the owner: "Sometimes locations like the horse stable, etc can be placed on pathways";
// bible/03-World/Town-Shapes.md TS10): the roads the terrain painted through a town's ground (an arm of the pixel's road or
// track across a cell a town past the Bay leaves open, or a Bay city's old wall ring) are roads of its grid - a yard stands
// beside them, never on them. Pinned on the grid's paving, on a town's yards placed over it, on the host's wiring, and on
// the cities and towns past the Bay with roads every way (ARENA2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { paveOnGrid, townWalkShut, PATH_WEIGHT } from '../../src/world/townWalls.js';
import { tileWeight, CityNavigation, TILE_FLAG_OCCUPIED } from '../../src/world/city/cityNavigation.js';
import { townGroundOf, yardSitesOn } from '../../src/world/merchantYards/merchantYardSites.js';
import { ROAD_WEIGHT } from '../../src/systems/gothwayBoards.js';
import { hostText } from '../hostText.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const D = 128;

test('TS10 a road\'s weight: CityNavigation\'s for a road tile, the weight a yard reads as a road', () => {
  for (const t of [46, 47, 55]) assert.equal(PATH_WEIGHT, tileWeight(t));
  assert.equal(PATH_WEIGHT, ROAD_WEIGHT);
});

/** A town of one block, all of it open grass (record 2), on a 128-tile pixel; its tiles from (56, 56). */
function grassTown() {
  const tiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2 })));
  const loc = { width: 1, height: 1, blocks: [{ x: 0, y: 0, dfBlock: { rmbBlock: { fldHeader: { autoMapData: new Uint8Array(4096), groundData: { groundTiles: tiles } } } } }] };
  const dfLocation = { mapTableData: { mapId: 77 }, exterior: { exteriorData: { width: 1, height: 1, blockNames: ['A.RMB'] } } };
  return { loc, dfLocation, origin: { x: 56, y: 56 } };
}

test('TS10 the paving: an open cell over a painted tile a road, its walker\'s flag kept; a closed cell closed; a tile off the pixel none (mutants: the paths unread; a closed cell opened; the flag lost)', () => {
  const nav = new CityNavigation(1, 1);
  nav.grid.fill(12 << 4);
  nav.grid[5 * 64 + 9] = 0;   // a building's cell over the path
  nav.grid[5 * 64 + 10] |= TILE_FLAG_OCCUPIED;
  const paths = new Uint8Array(D * D);
  paths[(56 + 2) + (56 + 1) * D] = 1;   // the tile over cells x 8-11, y 4-7
  paveOnGrid(nav, paths, { x: 56, y: 56 });
  assert.equal(nav.weightAt(8, 4), PATH_WEIGHT);
  assert.equal(nav.weightAt(11, 7), PATH_WEIGHT);
  assert.equal(nav.weightAt(12, 4), 12, 'the next tile\'s cell as it was');
  assert.equal(nav.weightAt(9, 5), 0, 'a building\'s cell stays closed');
  assert.equal(nav.grid[5 * 64 + 10] & TILE_FLAG_OCCUPIED, TILE_FLAG_OCCUPIED, 'a walker\'s flag kept');
  const off = new CityNavigation(1, 1);
  off.grid.fill(12 << 4);
  paveOnGrid(off, paths, { x: 120, y: 120 });
  assert.ok(off.grid.every((v) => v === 12 << 4), 'a grid past the pixel\'s edge reads nothing there');
});

test('TS10 a town\'s yards: a painted road across its open ground is no yard\'s ground - the Stable placed off it, beside it, where unpaved it stood on it; the walk\'s key says what it read (mutants: the walk unpaved; the key blind to the paths)', () => {
  const { loc, dfLocation } = grassTown();
  // a painted road north-south through the middle of the town, two tiles wide (the pixel's own centre: tiles 63, 64)
  const paths = new Uint8Array(D * D);
  for (let y = 0; y < D; y++) { paths[63 + y * D] = 1; paths[64 + y * D] = 1; }
  const onIt = (s) => { for (let gx = s.gx; gx < s.gx + s.nx; gx++) if ((gx >> 2) + 56 === 63 || (gx >> 2) + 56 === 64) return true; return false; };
  const bare = yardSitesOn(townGroundOf(loc, {}, townWalkShut(dfLocation, null)));
  assert.ok(bare.some(onIt), 'unpaved: a yard on the road (the middle of the town is the road)');
  const paved = yardSitesOn(townGroundOf(loc, {}, townWalkShut(dfLocation, null, paths)));
  assert.equal(paved.length, bare.length, 'every yard still placed');
  for (const s of paved) assert.ok(!onIt(s), `its ${s.kind} off the road`);
  const a = townWalkShut(dfLocation, null, paths).key, b = townWalkShut(dfLocation, null, Uint8Array.from(paths)).key;
  const other = Uint8Array.from(paths); other[10] = 1;
  assert.equal(a, b, 'the same paths, the same key');
  assert.notEqual(a, townWalkShut(dfLocation, null, other).key, 'other paths, another key');
  assert.notEqual(a, townWalkShut(dfLocation, null).key, 'none, another key');
});

test('TS10 the host\'s wiring: the pixel\'s walk shut reads the paths its terrain job painted, and a town\'s places are placed again when they change', () => {
  assert.match(rd('src/scenes/pixelBuild.js'), /const walkShut = dfLocation \? fabricWalkShut\(townWalkShut\(dfLocation, townGround, paths\), dfLocation\) : null;/);   // PIN MOVED (URBANIZER U3): the fabric's shut over the town's
  assert.match(hostText('src/scenes/world.js'), /\|\$\{shut\?\.key \?\? \(shut \? 'shut' : ''\)\}`;/);
});

test('TS10 with ARENA2: every twelfth city and town past the Bay on a pixel with roads every way - no yard on a painted road, every yard placed, where some stood on one unpaved', { skip: skipReal }, async () => {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { setLocationTiles, getLocationTerrainTileOrigin } = await import('../../src/world/terrain/terrainTiles.js');
  const { installWorldDataReplacement, bindWorldDataBlocks } = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { installTownOutline, outlineTownLocation, townOutlineBlockJson } = await import('../../src/world/townOutline.js');
  const { standTownWall } = await import('../../src/world/townWalls.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const { unwalledLocation } = await import('../../src/world/townShape.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { craftYardSitesOn } = await import('../../src/world/merchantYards/merchantYardSites.js');
  const { DIR } = await import('../../src/world/road/roadNetwork.js');
  const b = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); maps.load(b('MAPS.BSA'), b('CLIMATE.PAK'), b('POLITIC.PAK')); maps.autoDiscard = false;
  const woods = new WoodsFile(); woods.load(b('WOODS.WLD'));
  const blocks = new BlocksFile(); blocks.load(b('BLOCKS.BSA'));
  installWorldDataReplacement(); bindWorldDataBlocks(blocks); installTownOutline();
  const bay = maps.getLocationByName('Daggerfall', 'Gothway Garden');
  const p = longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude);
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(unwalledLocation(lc)); } }
  const T = arenaTemplates(rows);
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  let yards = 0, onBefore = 0;
  for (const kind of ['city-state', 'town']) {
    for (let j = 0; j < T[kind].length; j += 12) {
      const t = T[kind][j], mapId = ((0xa7 << 20) | (500000 + j + (kind === 'town' ? 5000 : 0))) >>> 0;
      const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId, longitude: bay.mapTableData.longitude, latitude: bay.mapTableData.latitude } }, io);
      if (loc.outline?.walled) standTownWall(loc, t.exterior.exteriorData.blockNames, io, townOutlineBlockJson);
      const tilemap = new Uint8Array(D * D), rect = setLocationTiles(loc, maps, blocks, tilemap);
      const roads = new Uint8Array(1000 * 500); roads[p.y * 1000 + p.x] = DIR.N | DIR.S | DIR.E | DIR.W | DIR.NE | DIR.SW;
      const g = generatePixelTerrain({ woods, px: p.x, py: p.y, tilemap, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks: new Uint8Array(1000 * 500), smooth: true } });
      const yl = layoutLocation(loc, maps, blocks), o = getLocationTerrainTileOrigin(loc);
      const on = (s) => { for (let gy = s.gy; gy < s.gy + s.nz; gy++) for (let gx = s.gx; gx < s.gx + s.nx; gx++) if (g.paths[(o.x + (gx >> 2)) + (o.y + (gy >> 2)) * D]) return true; return false; };
      const place = (shut) => { const ground = townGroundOf(yl, {}, shut); return ground ? [...yardSitesOn(ground), ...craftYardSitesOn(ground)] : []; };
      const before = place(townWalkShut(loc, g.townGround)), after = place(townWalkShut(loc, g.townGround, g.paths));
      assert.equal(after.length, before.length, `${t.name}: every yard placed`);
      for (const s of after) { yards++; assert.ok(!on(s), `${t.name}: its ${s.kind} off the painted road`); }
      onBefore += before.filter(on).length;
    }
  }
  assert.ok(yards > 300, `${yards} yards`);
  assert.ok(onBefore > 0, `unpaved, ${onBefore} stood on a painted road`);
});
