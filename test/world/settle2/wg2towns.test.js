// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements"): World 2.0's prototype towns stood as the game
// reads a place - every building of every baked town one subrecord at its slot, its door at its record's door facing its
// way, its record the type the services read; the lanes its ids take; the block family serving its names alone; a shell
// id its shape; the ground blended nowhere and a terrace's floor on its pad; its row on the world's places. Built from the
// real bakes (public/worldgen2/). Mutation-checked (tools/mutants/wg2towns.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { gen2Install } from '../../../src/world/gen2/gen2Ground.js';
import { kernelUnits } from '../../../src/world/gen2/regionSampler.js';
import { WG2_SETTLEMENT_LANE } from '../../../src/world/gen2/settle/buildingRecord.js';
import * as W from '../../../src/formats/worldData/worldDataReplacement.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { layoutRmbBlock } from '../../../src/world/rmbLayout.js';
import { fabricDoorModel, isFabricDoorId, FABRIC_DONORS, IMPERIAL_DOOR_MODEL } from '../../../src/world/imperialFabricBuildings.js';
import { IMPERIAL_BLOCK_INDEX } from '../../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS } from '../../../src/world/imperialCity.js';
import { CAPITAL_INDEX_BASE } from '../../../src/world/tamrielCapitals.js';
import { getStaticDoors } from '../../../src/world/staticDoors.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { isMadePlaceId } from '../../../src/world/placeIds.js';
import { isNamedBuildingType } from '../../../src/world/buildingNames.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { setLocationTiles, locationOutlineBasis } from '../../../src/world/terrain/terrainTiles.js';
import { generatePixelTerrain } from '../../../src/world/terrain/terrainGen.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';
import { locationStartMarkers, locationArrivalLanding } from '../../../src/world/locationEntrance.js';
import { collectBlockFlats } from '../../../src/world/rmbFlats.js';
import * as T from '../../../src/world/settle2/settle2Towns.js';
import * as Bk from '../../../src/world/settle2/settle2Blocks.js';
import { shellModelId, shellShapeOf, shellModel, isShellId, SHELL_STOREY_M, SETTLE2_SHELL_MODEL } from '../../../src/world/settle2/settle2Shell.js';
import { synthesizeSettle2Location, settle2PlaceRows } from '../../../src/world/settle2/settle2Location.js';
import { createSettle2Places, SETTLE2_SOURCE } from '../../../src/scenes/settle2Host.js';

const bakes = ['hammerfell-test', 'blackmarsh-test'].map((id) => readBake(`${BAKE_DIR}/${id}.wg2.gz`)), fit = decodeBake(bakes[0]).header.fit;
const install = () => { gen2Install(bakes, fit); W.installWorldDataReplacement(); Bk.installSettle2(); };
install();
const TOWNS = T.settle2Towns();
const BASE = Object.freeze({ name: 'base', regionIndex: 0, climate: { climateType: 0 }, mapTableData: { mapId: 1, locationType: 0 }, exterior: { buildings: [], exteriorData: { width: 1, height: 1, blockNames: ['X.RMB'] } } });
/** A block as the game reads one: through the world-data door, by its name's index. */
const served = (name) => W.getDFBlockReplacementData(W.getNewDFBlockIndex(name), name);
const P = 819.2;

test('WG2-TOWNS BLOCKS: every building of every prototype town is one subrecord at its slot - its shell and its door, its record the building\'s type, sector and home key; its door at its record\'s door (5 cm) facing its way, through the layout the build runs (mutants: the turn\'s sign, the frame\'s z, a slot\'s record, the type)', () => {
  assert.equal(TOWNS.length, 5, 'four towns past the Bay in Hammerfell, one in Black Marsh');
  for (const at of TOWNS) {
    let subs = 0;
    for (let i = 0; i < 64; i++) {
      const block = served(T.settle2BlockName(at.town.ordinal, i % 8, Math.floor(i / 8)));
      assert.ok(block.ownNamedBuildings, 'the block names its own buildings');
      subs += block.rmbBlock.subRecords.filter((s) => s.exterior.block3dObjectRecords.length).length;
    }
    assert.equal(subs, at.town.buildings.length, `${at.town.id}: a subrecord a building, no more`);
    for (const b of at.town.buildings) {
      const [bx, by, rec] = b.slot, block = served(T.settle2BlockName(at.town.ordinal, bx, by)), sub = block.rmbBlock.subRecords[rec];
      const ids = sub.exterior.block3dObjectRecords.map((o) => o.modelIdNum);
      assert.ok(isShellId(ids[0]) && isFabricDoorId(ids[1]) && ids.length === 2, `${b.id}: its shell and its door`);
      const data = block.rmbBlock.fldHeader.buildingDataList[rec];
      assert.equal(data.buildingType, b.type, `${b.id}: its type`);
      assert.equal(data.sector, by * 8 + bx);
      if (b.role === 'house') assert.equal(b.home.key, makeBuildingKey(bx, by, rec), `${b.id}: its home key its slot's`);
      const door = layoutRmbBlock(block).models.find((m) => m.recordIndex === rec && isFabricDoorId(m.modelIdNum)), M = door.matrix, d = b.doors[0];
      const X = at.px + (bx * 102.4 + M[12]) / P, Y = at.py + 1 - (by * 102.4 + M[14]) / P;
      assert.ok(Math.hypot((X - d.x) * P, (Y - d.y) * P) < 0.05, `${b.id}: its door at its record's, ${Math.hypot((X - d.x) * P, (Y - d.y) * P)} m off`);
      const [face] = getStaticDoors(fabricDoorModel(door.modelIdNum), block.index, rec, M), n = fabricDoorModel(door.modelIdNum).doors[0].normal;
      assert.equal(face.recordIndex, rec);
      const east = M[0] * n.x + M[8] * n.z, north = M[2] * n.x + M[10] * n.z;
      assert.ok(east * d.dir[0] - north * d.dir[1] > 0.9999, `${b.id}: its door faces its way`);
    }
  }
});

test('WG2-TOWNS LANES: a town\'s map id its own (lane 0x342, a made place), its location index -(42,000,000 + ordinal), its blocks past the Imperial City\'s, its shells past the fabric\'s doors (mutants: the index base, the block base)', () => {
  for (const at of TOWNS) {
    const loc = synthesizeSettle2Location(at, BASE);
    assert.equal(loc.mapTableData.mapId, at.town.mapId);
    assert.equal(loc.exterior.exteriorData.mapId, at.town.mapId);
    assert.equal(at.town.mapId >>> 20, WG2_SETTLEMENT_LANE);
    assert.ok(isMadePlaceId(at.town.mapId));
    assert.equal(loc.locationIndex, -(42_000_000 + at.town.ordinal));
    assert.ok(-loc.locationIndex > CAPITAL_INDEX_BASE + 0x80000, 'past the capitals\' run');
    assert.deepEqual([loc.exterior.exteriorData.width, loc.exterior.exteriorData.height], [8, 8]);
    assert.equal(loc.exterior.exteriorData.blockNames[3 * 8 + 5], T.settle2BlockName(at.town.ordinal, 5, 3), 'the grid\'s rows from the south');
    assert.equal(T.settle2BlockIndex(at.town.ordinal, 0, 0), 2_300_000 + 64 * at.town.ordinal);
    assert.equal(loc.exterior.buildings.length, at.town.buildings.filter((b) => isNamedBuildingType(b.type)).length, 'its directory its named buildings');
  }
  assert.ok(T.SETTLE2_BLOCK_INDEX >= IMPERIAL_BLOCK_INDEX.lake + IMPERIAL_CELLS * IMPERIAL_CELLS);
  assert.ok(SETTLE2_SHELL_MODEL >= IMPERIAL_DOOR_MODEL + FABRIC_DONORS.length && shellModelId({ w: 63.5, d: 63.5, storeys: 7, roof: 1, wall: 3, roofRec: 3, foot: 15.5, stilts: true }) < 2 ** 31);
  // on the Bay no town, and none at a pixel past it with none
  assert.equal(T.settle2TownAt(500, 250), null);
  assert.equal(T.settle2TownAt(1046, 453), null);
  assert.equal(T.settle2TownAt(1046, 452).town.name, 'Tava Wells');
});

test('WG2-TOWNS FAMILY: the block family serves each installed town\'s 64 names at their indices, and nothing else - a name of no town, a cell off the grid, an index past it, every name once its region is gone (mutants: the name\'s pattern, the installed test)', () => {
  for (const at of TOWNS) for (let i = 0; i < 64; i++) {
    const bx = i % 8, by = Math.floor(i / 8), name = T.settle2BlockName(at.town.ordinal, bx, by), index = W.getNewDFBlockIndex(name);
    assert.equal(index, T.settle2BlockIndex(at.town.ordinal, bx, by));
    assert.equal(W.getNewDFBlockName(index), name);
    assert.equal(served(name).name, name);
  }
  for (const name of [T.settle2BlockName(77, 0, 0), 'WG2S0001.RMB', 'WG2S000180.RMB', 'WG2S000108.RMB', 'wg2s00010.rmb', 'RESIAL00.RMB']) assert.equal(Bk.settle2FamilyIndexOf(name), -1, name);
  for (const index of [T.settle2BlockIndex(77, 0, 0), T.SETTLE2_BLOCK_INDEX - 1, T.SETTLE2_BLOCK_INDEX + 63, IMPERIAL_BLOCK_INDEX.own]) assert.equal(Bk.settle2FamilyNameOf(index), null, String(index));
  assert.equal(Bk.settle2Block('RESIAL00.RMB', null), null);
  gen2Install([], fit);
  assert.equal(Bk.settle2FamilyIndexOf(T.settle2BlockName(1, 0, 0)), -1, 'its region gone, its names are no one\'s');
  install();
});

test('WG2-TOWNS SHELLS: a shell\'s id is its shape - the same shape the same id, every field read back - and its model stands its footprint, its storeys and its footing in its door\'s frame (mutants: a field\'s bits, a storey\'s height, the footing)', () => {
  const shapes = new Map();
  for (const at of TOWNS) for (const [i, r] of Bk.settle2TownRecords(at).entries()) {
    const b = at.town.buildings[i], s = shellShapeOf(r.shell);
    assert.deepEqual([s.w, s.d, s.storeys, s.stilts], [b.footprint[0], b.footprint[1], b.storeys, b.ground.kind === 'stilts'], b.id);
    assert.equal(shellModelId(s), r.shell, 'read back, the same id');
    const k = JSON.stringify(s);
    if (shapes.has(k)) assert.equal(shapes.get(k), r.shell); else shapes.set(k, r.shell);
  }
  assert.ok(shapes.size < TOWNS.reduce((n, at) => n + at.town.buildings.length, 0) / 3, 'shapes shared: one mesh for many buildings');
  const one = { w: 8, d: 9, storeys: 1, roof: 0, wall: 0, roofRec: 2, foot: 1, stilts: false };
  for (const k of ['w', 'd', 'storeys', 'roof', 'wall', 'roofRec', 'foot']) assert.notEqual(shellModelId({ ...one, [k]: one[k] + 1 }), shellModelId(one), k);
  assert.notEqual(shellModelId({ ...one, stilts: true }), shellModelId(one));
  const bounds = (m) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); } return [lo, hi]; };
  const [lo, hi] = bounds(shellModel(shellModelId(one)));
  assert.deepEqual([lo[0], hi[0], lo[2], hi[2]], [-4, 4, 0, 9], 'its walls its footprint, the door\'s front at z 0');
  assert.deepEqual([lo[1], Math.fround(hi[1])], [-1, Math.fround(3.7)], 'down its footing, up a storey of 3.2 m and its parapet');
  assert.equal(SHELL_STOREY_M, 3.2);
  assert.equal(shellShapeOf(shellModelId({ ...one, foot: 1.2 })).foot, 1.5, 'a footing kept up a step: its walls reach the ground');
  const gable = bounds(shellModel(shellModelId({ ...one, storeys: 2, roof: 1 })));
  assert.ok(gable[1][1] > 2 * SHELL_STOREY_M && gable[0][2] < 0, 'a gable over two storeys, its eaves out');
  const stilt = bounds(shellModel(shellModelId({ ...one, foot: 0, stilts: true })));
  assert.ok(stilt[0][1] === 0 && stilt[0][2] === 0, 'a stilt house starts at its floor: its legs, deck and stair its platform\'s (wg2towns_features.test.js)');
  assert.equal(shellModel(SETTLE2_SHELL_MODEL - 1), null);
});

/** A woods of a slope: its bytes rising east, so a blend toward the mean moves it. */
const slope = { getHeightMapValuesRange1Dim: (x, y, d) => Uint8Array.from({ length: d * d }, (_, i) => 30 + ((i % d) + x) * 4), getLargeHeightMapValuesRange: () => new Uint8Array(81).fill(0), getHeightMapValue: (x) => 30 + x * 4 };
test('WG2-TOWNS GROUND: a town stands on its region\'s ground - the kernel blends nothing under it and stands it on its plane, its tiles stamp no outline - and a terrace building\'s floor lies on its pad\'s level, the region\'s ground there (mutants: the seam\'s own, its avg, the outline\'s skip, the plane\'s height)', () => {
  const at = T.settle2TownAt(1095, 420), loc = synthesizeSettle2Location(at, BASE), rect = { xMin: 20, xMax: 100, yMin: 20, yMax: 100 };
  const job = { woods: slope, px: 10, py: 10, tilemap: new Uint8Array(16384), climateType: 0 };
  const bare = generatePixelTerrain({ ...job, tilemap: new Uint8Array(16384) });
  const own = generatePixelTerrain({ ...job, tilemap: new Uint8Array(16384), hasLocation: true, locationRect: rect, flattenAt: loc.settle2.ground });
  const blended = generatePixelTerrain({ ...job, tilemap: new Uint8Array(16384), hasLocation: true, locationRect: rect });
  assert.deepEqual([...own.samples], [...bare.samples], 'nothing blended under a town of its own ground');
  assert.equal(own.avg, loc.settle2.ground.avg);
  assert.ok(Math.abs(own.avg * T.WORLD_HEIGHT - T.settle2Base(at.town)) < 1e-9, 'its plane its plaza\'s level');
  assert.notDeepEqual([...blended.samples], [...bare.samples], 'a location of none is blended');
  // its tiles: its roads stamped, no outline (a town's own ground)
  const blocks = { checkName: (n) => n, getBlockIndex: (n) => W.getNewDFBlockIndex(n), getBlock: (i) => W.getDFBlockReplacementData(i, W.getNewDFBlockName(i)) };
  const maps = { getRmbBlockName: (l, x, y) => l.exterior.exteriorData.blockNames[y * 8 + x] };
  const tiles = new Uint8Array(16384), r = setLocationTiles(loc, maps, blocks, tiles);
  assert.ok(Number.isFinite(r.xMin) && r.xMax > r.xMin && !r.shape, 'a rect of its streets, no outline');
  assert.equal(locationOutlineBasis(loc, () => ({})), null);
  assert.ok(tiles.some((t) => (t & 0x3f) === 3) && tiles.some((t) => (t & 0x3f) === 1), 'its streets\' stone and its lanes\' dirt');
  // every terrace building's floor on its pad: the layout's floor less the location's lift is the pad's level, the region's ground
  const base = T.settle2Base(at.town);
  let n = 0;
  for (const tw of TOWNS) for (const b of tw.town.buildings) {
    if (b.ground.kind !== 'terrace') continue;
    const [bx, by, rec] = b.slot, block = served(T.settle2BlockName(tw.town.ordinal, bx, by));
    const shell = layoutRmbBlock(block).models.find((m) => m.recordIndex === rec && isShellId(m.modelIdNum));
    const floor = T.settle2Base(tw.town) + 0.05 + shell.matrix[13];
    assert.ok(Math.abs(floor - 0.05 - (34 + b.ground.level)) < 0.0126, `${b.id}: floor ${floor} on its pad ${34 + b.ground.level}`);
    assert.ok(Math.abs(kernelUnits(tw.region.heightAt(b.at.x, b.at.y)) * STREAMING_TERRAIN_SCALE - T.sceneOf(b.ground.level)) < 1e-6, `${b.id}: the region's ground there is its pad`);
    n++;
  }
  assert.ok(n >= 40 && base > 1700, 'the terraced towns\' buildings, high in the Dragontails');
});

test('WG2-TOWNS GROUND, STREAMED: with the Landforms row the kernel stands a town\'s pixel on its region\'s ground at every sample - its pads and its oasis\'s bowl - and paints the region\'s water across its streets\' rect, which a blended town keeps dry (mutants: the seam\'s own, the water\'s rect)', () => {
  setTamrielFit(fit);
  const at = T.settle2TownAt(1046, 452), loc = synthesizeSettle2Location(at, BASE);
  const blocks = { checkName: (n) => n, getBlockIndex: (n) => W.getNewDFBlockIndex(n), getBlock: (i) => W.getDFBlockReplacementData(i, W.getNewDFBlockName(i)) };
  const maps = { getRmbBlockName: (l, x, y) => l.exterior.exteriorData.blockNames[y * 8 + x] };
  const flat = { getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d).fill(40), getLargeHeightMapValuesRange: () => new Uint8Array(81).fill(0), getHeightMapValue: () => 40 };
  const run = (flattenAt) => { const tm = new Uint8Array(16384), rect = setLocationTiles(loc, maps, blocks, tm); return generatePixelTerrain({ woods: flat, px: at.px, py: at.py, tilemap: tm, climateType: 0, landform: true, hasLocation: true, locationRect: rect, flattenAt }); };
  const own = run(loc.settle2.ground), blended = run(null), D = 129;
  let worst = 0;
  for (let x = 0; x < D; x += 4) for (let y = 0; y < D; y += 4) worst = Math.max(worst, Math.abs(own.samples[x * D + y] * T.WORLD_HEIGHT - T.sceneOf(at.region.heightAt(at.px + x / 128, at.py + 1 - y / 128))));
  assert.ok(worst < 0.01, `the region's ground at every sample (${worst} m off)`);
  const wet = (o) => o.tilemapBytes.reduce((n, b) => n + ((b >> 2) === 0 ? 1 : 0), 0);
  assert.ok(wet(own) > wet(blended) && wet(own) > 1000, `the oasis's water across the town's rect too: ${wet(own)} tiles, blended ${wet(blended)}`);
});

test('WG2-TOWNS WIRING: the build hands a town\'s own ground to the kernel and makes its blocks a breath at a time; past the Bay a town is asked before a capital, by the build and by the places\' stand; the places host lists the towns after the places past the Bay (mutants: each wire)', () => {
  const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
  const build = rd('src/scenes/pixelBuild.js'), stand = rd('src/scenes/spawnStandHost.js'), places = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(build, /flattenAt: dfLocation\?\.capital\?\.flattenAt \?\? dfLocation\?\.settle2\?\.ground \?\? null,/);
  assert.match(build, /if \(capitalViewOf\(dfLocation\) \|\| dfLocation\?\.settle2\) for \(const name of dfLocation\.exterior\.exteriorData\.blockNames\) \{ blocks\.getBlockByName\(name\); await breather\.breathe\(\); \}/);
  assert.match(stand, /\|\| settle2LocationAt\(px, py\) \|\| host\.capitalLocationAt\(px, py\) \|\|/);
  assert.match(places, /const standAt = \(px, py\) => \(inBay\(px, py\) \? null : settle2\.locationAt\(px, py\) \|\| capitalLocationAt\(px, py\)/);
  assert.ok(places.indexOf('worldPlaces.registerLive(PAST_BAY_SOURCE') < places.indexOf('const settle2 = createSettle2Places('), 'listed after the places past the Bay');
});

test('WG2-TOWNS PLACES: each town a row of the world\'s places on its pixel, its location stood once in the index - and where a place listed before it holds its pixel, the town says so and stands nowhere (mutants: the source test, the holder\'s test)', () => {
  const maps = { getRegionIndexAt: () => 63, getClimateIndex: () => 224 }, warn = console.warn, said = [];
  console.warn = (m) => said.push(String(m));
  try {
    const places = createWorldPlaces(), index = new Map(), host = { _locIndexGen: 0 };
    const s = createSettle2Places({ locationIndex: index, worldPlaces: places, maps, base: BASE, host, landform: true });
    assert.equal(settle2PlaceRows().length, 5);
    for (const at of TOWNS) {
      const p = places.at(at.px, at.py);
      assert.deepEqual([p.source, p.mapId, p.name, p.type, p.w], [SETTLE2_SOURCE, at.town.mapId, at.town.name, ['fortifiedTown', 'riverTown'].includes(at.town.type) ? LOCATION_TYPES.TownHamlet : LOCATION_TYPES.TownVillage, 8]);
      const loc = s.locationAt(at.px, at.py);
      assert.equal(loc.name, at.town.name);
      assert.equal(index.get(`${at.px},${at.py}`), loc);
      assert.equal(s.locationAt(at.px, at.py), loc, 'stood once');
    }
    assert.equal(s.locationAt(500, 250), null);
    // a place listed first on Sentry Hold's pixel keeps it
    const held = createWorldPlaces();
    held.register('tesa-past-bay', [{ mapId: 0x34180001, name: 'Holder', px: 1095, py: 420, type: 0 }]);
    const s2 = createSettle2Places({ locationIndex: new Map(), worldPlaces: held, maps, base: BASE, host, landform: true });
    assert.equal(s2.locationAt(1095, 420), null);
    assert.ok(said.some((m) => /Sentry Hold .* stands nowhere: Holder/.test(m)), 'said so');
    assert.equal(s2.locationAt(1046, 452).name, 'Tava Wells', 'the others stand');
  } finally { console.warn = warn; }
});

test('WG2-TOWNS ARRIVAL: a town\'s grid is its whole pixel, so an arrival lands at its nearest start marker - its plaza and a few metres in from each way in, each on the region\'s ground - never at the pixel\'s edge, where DFU stands a village\'s (mutants: the landing\'s departure, a marker\'s height)', () => {
  for (const at of TOWNS) {
    const loc = synthesizeSettle2Location(at, BASE), base = T.settle2Base(at.town), blocks = [];
    for (let i = 0; i < 64; i++) blocks.push({ originX: (i % 8) * 102.4, originZ: Math.floor(i / 8) * 102.4, flats: collectBlockFlats(served(loc.exterior.exteriorData.blockNames[i]), 0) });
    const markers = locationStartMarkers(blocks);
    assert.ok(markers.length >= 2 && markers.length <= 1 + at.town.entrances.length, `${at.town.id}: its plaza and its ways in`);
    for (const [x, y, z] of markers) {
      const wx = at.px + x / P, wy = at.py + 1 - z / P, ground = T.sceneOf(at.region.heightAt(wx, wy)) - base;
      assert.ok(Math.abs(y - ground) < 0.2, `${at.town.id}: a marker on the ground (${y} for ${ground})`);
      assert.equal(at.region.waterAt(wx, wy), null, `${at.town.id}: a marker over no water`);
      for (const b of at.town.buildings) {
        const dx = (wx - b.at.x) * P, dy = (wy - b.at.y) * P, n = b.at.dir, deck = b.ground.kind === 'stilts' ? 1.2 : 0;
        assert.ok(!(Math.abs(dx * -n[1] + dy * n[0]) < b.footprint[0] / 2 + 1 && Math.abs(dx * n[0] + dy * n[1]) < b.footprint[1] / 2 + 1 + deck), `${at.town.id}: a marker under ${b.id}`);
      }
    }
    for (const roll of [0.1, 0.4, 0.6, 0.9]) {
      const land = locationArrivalLanding(loc, { origin: [0, base, 0], startMarkers: markers, roll: () => roll });
      assert.ok(land.usedStartMarker && land.pos[0] > 0 && land.pos[0] < P && land.pos[2] > 0 && land.pos[2] < P, `${at.town.id}: landed on its own pixel at a marker`);
    }
  }
});
