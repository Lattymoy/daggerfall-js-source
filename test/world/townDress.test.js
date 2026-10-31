// TOWN-DRESS (OWN-WORK3, 2026-10-31; the owner: "removing mods from outside authors and instead replacing them with our
// own work"): a town dressed by our own law (world/townDress.js) in place of Beautiful Villages' and Beautiful Cities'
// edits, which are retired. Held here: the law's pieces and where each may stand - never on a road, before a door, in a
// wall or on a home's lot; our stall; the dressed copy of a block and the walkers kept off the stalls; the wiring; the
// retired layouts' records asleep. With ARENA2_PATH: a village, a town and a city of the Bay and a hamlet past it,
// dressed and swept by the true geometry of their buildings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  townDressOf, dressedBlock, dressLocation, carveTownDress, buildTownStall, doorReach, inDoorway, DRESS, DRESSED_TYPES,
  DRESS_PIECES, TRADE_GOODS, WELL_FLORA, STALL_WARES, TOWN_STALL, STALL_FOOT, TOWN_STALL_MODEL, WARE_Y, DRESS_FLAT_Y,
  DOOR_CLEAR_M,
} from '../../src/world/townDress.js';
import { CityNavigation, NAV_CELL, ROAD_WEIGHT } from '../../src/world/city/cityNavigation.js';
import { LOCATION_TYPES, CLIMATE_BASE_TYPES } from '../../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { miscModelMatrix } from '../../src/world/rmbLayout.js';
import { DOOR_APPROACH_M } from '../../src/world/curatedPlacements.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { CAPITAL_ARCHIVE } from '../../src/world/capitalShapes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- a town of our own: one block, a road along its middle, a shop and a house beside it, a well on the green ----

/** A building model: a box `w` x `d` (x, z), 5 m tall, its origin at its floor's middle, one door on its +z face. */
function houseModel(w, d) {
  const mb = new MeshBuilder();
  mb.box([0, 0], [0, 2.5, 0], [w, 5, d]);
  const m = mb.build();
  const z = d / 2;
  return { ...m, doors: [{ type: 0, index: 0, vert0: { x: -0.6, y: 0, z }, vert1: { x: 0.6, y: 0, z }, vert2: { x: 0.6, y: 2.2, z }, normal: { x: 0, y: 0, z: 1 } }] };
}
/** The block: its road the tile row 8 from the north (z 44.8-51.2 m), grass elsewhere; a shop and a house, each 10 x 8 m,
 *  their doors on their +z faces, at `shopAt` and `houseAt` (their floors' middles); a well at `wellAt`. */
function oneBlock({ shop = BUILDING_TYPES.GeneralStore, house = BUILDING_TYPES.House2, shopAt = [30, 30], houseAt = [70, 30], wellAt = [50, 72] } = {}) {
  const autoMapData = new Uint8Array(4096);
  const mark = (x0, z0, x1, z1, v) => { for (let gz = Math.floor(z0 / NAV_CELL); gz <= Math.floor((z1 - 1e-6) / NAV_CELL); gz++) for (let gx = Math.floor(x0 / NAV_CELL); gx <= Math.floor((x1 - 1e-6) / NAV_CELL); gx++) autoMapData[(63 - gz) * 64 + gx] = v; };   // the cells a box covers, its far edge on a cell's own
  mark(shopAt[0] - 5, shopAt[1] - 4, shopAt[0] + 5, shopAt[1] + 4, shop + 1);
  mark(houseAt[0] - 5, houseAt[1] - 4, houseAt[0] + 5, houseAt[1] + 4, house + 1);
  mark(wellAt[0] - 0.5, wellAt[1] - 0.5, wellAt[0] + 0.5, wellAt[1] + 0.5, 0xfb);
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 ? 46 : 2 })));
  const at = (x, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1]);
  return {
    x: 0, y: 0, blockName: 'TESTAA00.RMB', originX: 0, originZ: 0,
    dfBlock: {
      name: 'TESTAA00.RMB', index: 7,
      rmbBlock: {
        fldHeader: { autoMapData, groundData: { groundTiles }, buildingDataList: [{ buildingType: shop }, { buildingType: house }] },
        subRecords: [], misc3dObjectRecords: [],
        miscFlatObjectRecords: [{ position: 0, xPos: Math.round(wellAt[0] / 0.025), yPos: -4, zPos: Math.round(wellAt[1] / 0.025) - 4096, textureArchive: 212, textureRecord: 0, factionID: 0, flags: 0 }],
      },
    },
    layout: { models: [{ modelId: '1', modelIdNum: 1, matrix: at(...shopAt), recordIndex: 0 }, { modelId: '2', modelIdNum: 2, matrix: at(...houseAt), recordIndex: 1 }], windmills: [] },
  };
}
const MODELS = new Map([[1, houseModel(10, 8)], [2, houseModel(10, 8)]]);
function town({ type = LOCATION_TYPES.TownHamlet, climate = CLIMATE_BASE_TYPES.Temperate, mapId = 0x51234, ...o } = {}) {
  const b = oneBlock(o);
  const loc = { width: 1, height: 1, blocks: [b] };
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, b.dfBlock.rmbBlock.fldHeader.autoMapData, (tx, ty) => b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles[tx][ty].textureRecord);
  const dfLocation = { name: 'Testham', mapTableData: { mapId, locationType: type }, climate: { climateType: climate } };
  return { loc, nav, dfLocation, dress: townDressOf(loc, dfLocation, { nav, modelOf: (id) => MODELS.get(id) ?? null }) };
}
/** Every piece of a dress, in the location's frame. */
function piecesOf(loc, dress) {
  const out = [];
  for (const [i, adds] of dress.blocks.entries()) {
    const b = loc.blocks[i];
    for (const f of adds.flats) out.push({ kind: `${f.textureArchive}_${f.textureRecord}`, x: f.xPos * 0.025 + b.originX, z: (f.zPos + 4096) * 0.025 + b.originZ, ware: f.yPos !== DRESS_FLAT_Y });
    for (const m of adds.models) out.push({ kind: 'stall', x: m.xPos * 0.025 + b.originX, z: (m.zPos + 4096) * 0.025 + b.originZ, yRotation: m.yRotation });
  }
  return out;
}
const width = (kind) => Object.values(DRESS_PIECES).find(([a, r]) => `${a}_${r}` === kind)?.[2] ?? 0;

test('TOWN-DRESS the law\'s measures: the door\'s approach HILL-HOUSE\'s four metres; every piece a classic picture of its own width; the trade goods by the building\'s type, two at the most, never a home\'s; the zone\'s plants by its climate; five stalls\' wares (mutants: a home dressed; the approach shortened)', () => {
  assert.equal(DOOR_CLEAR_M, DOOR_APPROACH_M);
  for (const [name, [archive, record, w]] of Object.entries(DRESS_PIECES)) assert.ok(archive >= 205 && archive <= 301 && record >= 0 && w > 0.05 && w < 3, name);
  for (const t of [BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3, BUILDING_TYPES.House4, BUILDING_TYPES.HouseForSale, BUILDING_TYPES.GuildHall]) assert.equal(TRADE_GOODS[t], undefined, `no goods at ${t}`);
  for (const goods of Object.values(TRADE_GOODS)) for (const g of goods) assert.ok(DRESS_PIECES[g], g);
  assert.deepEqual(Object.keys(WELL_FLORA).map(Number).sort((a, b) => a - b), [CLIMATE_BASE_TYPES.Desert, CLIMATE_BASE_TYPES.Mountain, CLIMATE_BASE_TYPES.Temperate, CLIMATE_BASE_TYPES.Swamp]);
  assert.equal(STALL_WARES.length, 5);
  for (const w of STALL_WARES) { assert.equal(w.counter.length, 3); for (const g of [...w.counter, w.ground]) assert.ok(DRESS_PIECES[g], g); }
  assert.deepEqual(Object.keys(DRESSED_TYPES).map(Number).sort((a, b) => a - b), [0, 1, 2, 3, 5, 6, 8], 'the towns, the farms, the manors, the temples and the taverns - no dungeon, graveyard, coven or ship');
  assert.equal(DRESSED_TYPES[LOCATION_TYPES.TownCity].stalls, 3);
  // a door's approach: its step and four metres out, the jambs widened by DRESS.doorSide
  const d = doorReach(MODELS.get(1).doors[0], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 30, 0, 30, 1]));
  assert.deepEqual([d.foot.map((v) => +v.toFixed(3)), d.out, +d.half.toFixed(3)], [[30, 34], [0, 1], 0.6]);
  assert.equal(inDoorway(d, 30, 34 + DOOR_CLEAR_M - 0.1, 0), true);
  assert.equal(inDoorway(d, 30, 34 + DOOR_CLEAR_M + 0.1, 0), false);
  assert.equal(inDoorway(d, 30 + 0.6 + DRESS.doorSide - 0.05, 36, 0), true);
  assert.equal(inDoorway(d, 30 + 0.6 + DRESS.doorSide + 0.05, 36, 0), false);
});

test('TOWN-DRESS a town dressed: lamps beside its road, never on it and never nearer than its type\'s gap; the shop\'s goods against its wall, out of its door\'s approach; the house none, and nothing on its lot; plants round the well; a stall faced to the street with its wares on the counter (mutants: the road unread; the door unread; the lot unread)', () => {
  const { loc, nav, dress } = town();
  assert.ok(dress, 'a hamlet is dressed');
  const pieces = piecesOf(loc, dress), W = nav.width;
  const weightAt = (x, z) => nav.grid[Math.floor(z / NAV_CELL) * W + Math.floor(x / NAV_CELL)] >> 4;
  const lamps = pieces.filter((p) => p.kind === '210_29');
  assert.ok(lamps.length >= 2, `lamps along the road (${lamps.length})`);
  for (const l of lamps) {
    assert.notEqual(weightAt(l.x, l.z), ROAD_WEIGHT, 'a lamp beside the road, never on it');
    assert.ok(Math.min(Math.abs(l.z - 44.8), Math.abs(l.z - 51.2)) < 2, `at the road's edge (${l.z})`);
  }
  for (const a of lamps) for (const b of lamps) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= DRESSED_TYPES[LOCATION_TYPES.TownHamlet].lampGap - 1e-6);
  const doors = [...MODELS.values()].map((m, i) => doorReach(m.doors[0], loc.blocks[0].layout.models[i].matrix));
  const boxes = [[25, 26, 35, 34], [65, 26, 75, 34]];
  for (const p of pieces.filter((q) => q.kind !== 'stall' && !q.ware)) {
    const r = width(p.kind) / 2;
    assert.notEqual(weightAt(p.x, p.z), ROAD_WEIGHT, `${p.kind}: off the road`);
    for (const d of doors) assert.equal(inDoorway(d, p.x, p.z, r), false, `${p.kind} at (${p.x}, ${p.z}): out of a door's way`);
    for (const b of boxes) assert.ok(!(p.x > b[0] - r && p.x < b[2] + r && p.z > b[1] - r && p.z < b[3] + r), `${p.kind}: out of a wall`);
  }
  const goods = pieces.filter((p) => ['205_17', '205_0', '205_24', '205_19'].includes(p.kind));
  assert.ok(goods.length >= 1 && goods.length <= 2, `the General Store's goods (${goods.length})`);
  for (const g of goods) assert.ok(Math.abs(g.x - 30) < 8 && Math.abs(g.z - 30) < 8, 'against the shop');
  for (const p of pieces.filter((q) => q.kind !== '210_29')) assert.ok(!(p.x > 65 - DRESS.homeNear && p.x < 75 + DRESS.homeNear && p.z > 26 - DRESS.homeNear && p.z < 34 + DRESS.homeNear), `${p.kind}: off the home's walls`);
  const flora = pieces.filter((p) => WELL_FLORA[CLIMATE_BASE_TYPES.Temperate].some((n) => `${DRESS_PIECES[n][0]}_${DRESS_PIECES[n][1]}` === p.kind));
  assert.ok(flora.length >= 1, 'plants round the well');
  for (const f of flora) assert.ok(Math.hypot(f.x - 50, f.z - 72) < 4, 'by the well');
  const stall = pieces.find((p) => p.kind === 'stall');
  assert.ok(stall, 'a hamlet\'s market');
  const front = [Math.sin((-stall.yRotation * Math.PI) / 1024), Math.cos((-stall.yRotation * Math.PI) / 1024)];
  const ahead = [stall.x + front[0] * (STALL_FOOT[3] + 1.2), stall.z + front[1] * (STALL_FOOT[3] + 1.2)];
  assert.equal(weightAt(ahead[0], ahead[1]), ROAD_WEIGHT, 'its counter to the street');
  assert.equal(dress.stalls.length, DRESSED_TYPES[LOCATION_TYPES.TownHamlet].stalls, 'a hamlet\'s two, in a row along the street');
  assert.equal(pieces.filter((p) => p.ware).length, 3 * dress.stalls.length, 'three wares on each counter');
  assert.deepEqual(dress.counts, { lamps: lamps.length, goods: goods.length, flora: flora.length, stalls: dress.stalls.length, wares: dress.counts.wares });
  // the same town, the same dress (every client)
  assert.deepEqual(town().dress, dress);
});

test('TOWN-DRESS the refusals, each one, over forty towns\' seeds: a shop at the road\'s edge and one with its door to the green, a home two metres from it and a well by the home - no piece within its clearance of a road, in a door\'s approach or within DRESS.homeNear of a home\'s walls (mutants: the road unread; the door unread; the lot unread; a House2 no home)', () => {
  const roadZ = [44.8, 51.2];
  let pieces = 0;
  for (let seed = 0; seed < 80; seed++) {
    const [shopAt, houseAt, wellAt] = seed % 2 ? [[30, 40], [46, 30], [46, 37.5]] : [[30, 20], [42, 22], [52, 30]];
    const homeBox = [houseAt[0] - 5, houseAt[1] - 4, houseAt[0] + 5, houseAt[1] + 4];
    const t = town({ mapId: 0x60000 + seed * 7919, shopAt, houseAt, wellAt });
    const doors = [...MODELS.values()].map((m, i) => doorReach(m.doors[0], t.loc.blocks[0].layout.models[i].matrix));
    for (const p of piecesOf(t.loc, t.dress)) {
      if (p.kind === 'stall' || p.ware) continue;
      pieces++;
      const r = width(p.kind) / 2, lamp = p.kind === '210_29';
      const toRoad = p.z < roadZ[0] ? roadZ[0] - p.z : p.z > roadZ[1] ? p.z - roadZ[1] : 0;
      assert.ok(toRoad >= r + (lamp ? DRESS.lampRoad : DRESS.roadClear) - NAV_CELL - 1e-6, `seed ${seed} ${p.kind} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): ${toRoad.toFixed(2)} m from the road`);
      if (!lamp) assert.ok(toRoad >= r + DRESS.roadClear - 0.05 || Math.floor((p.z + r + DRESS.roadClear) / NAV_CELL) * NAV_CELL < roadZ[0], `seed ${seed} ${p.kind}: its clearance off the road's cells`);
      for (const d of doors) assert.equal(inDoorway(d, p.x, p.z, r), false, `seed ${seed} ${p.kind} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): in a door's way`);
      const near = DRESS.homeNear + r;
      if (!lamp) assert.ok(!(p.x > homeBox[0] - near && p.x < homeBox[2] + near && p.z > homeBox[1] - near && p.z < homeBox[3] + near), `seed ${seed} ${p.kind} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): on the home's lot`);
    }
  }
  assert.ok(pieces > 160, `the towns stood pieces to test (${pieces})`);
});

test('TOWN-DRESS where the law stands nothing: a dungeon, a graveyard and a capital; a home or a guild hall takes no goods; the zone\'s climate picks the plants - a desert\'s urns (mutants: a capital dressed; the climate unread)', () => {
  for (const type of [LOCATION_TYPES.DungeonKeep, LOCATION_TYPES.Graveyard, LOCATION_TYPES.Coven, LOCATION_TYPES.HomePoor]) assert.equal(town({ type }).dress, null, `type ${type}`);
  const { loc, nav, dfLocation } = town();
  assert.equal(townDressOf(loc, { ...dfLocation, capital: { k: 1 } }, { nav, modelOf: (id) => MODELS.get(id) }), null, 'a capital is its own plan');
  const homes = town({ shop: BUILDING_TYPES.GuildHall });
  assert.equal(piecesOf(homes.loc, homes.dress).filter((p) => p.kind.startsWith('205') && Math.abs(p.x - 30) < 8 && Math.abs(p.z - 30) < 8).length, 0, 'no goods at a hall');
  const desert = town({ climate: CLIMATE_BASE_TYPES.Desert });
  const kinds = new Set(piecesOf(desert.loc, desert.dress).filter((p) => Math.hypot(p.x - 50, p.z - 72) < 4).map((p) => p.kind));
  assert.ok(kinds.size && [...kinds].every((k) => ['205_41', '205_38'].includes(k)), `a desert well's urns and palms (${[...kinds]})`);
  const zone = town({ climate: CLIMATE_BASE_TYPES.Desert });
  const asZone = townDressOf(zone.loc, { ...zone.dfLocation, climate: { climateType: CLIMATE_BASE_TYPES.Desert, zoneClimateType: CLIMATE_BASE_TYPES.Swamp } }, { nav: zone.nav, modelOf: (id) => MODELS.get(id) });
  const zk = new Set(piecesOf(zone.loc, asZone).filter((p) => Math.hypot(p.x - 50, p.z - 72) < 4).map((p) => p.kind));
  assert.ok([...zk].every((k) => ['213_5', '301_11', '301_17'].includes(k)), 'past the Bay a town wears its province\'s stone, its plants its zone\'s (URBANIZER zoneClimateType)');
});

test('TOWN-DRESS the dressed block: a copy with the dress after its own records - the block read stays untouched, its buildings and their keys as they were; the stalls laid out as RMBLayout lays a misc model; the walkers kept off a stall (mutants: the block edited in place; the stall uncarved)', () => {
  const { loc, nav, dress } = town();
  const b = loc.blocks[0], own = b.dfBlock, ownFlats = own.rmbBlock.miscFlatObjectRecords.length;
  assert.equal(dressLocation(loc, dress), 1);
  const now = loc.blocks[0];
  assert.notEqual(now.dfBlock, own);
  assert.equal(own.rmbBlock.miscFlatObjectRecords.length, ownFlats, 'the block read is untouched');
  assert.equal(now.dfBlock.rmbBlock.miscFlatObjectRecords.length, ownFlats + dress.blocks[0].flats.length);
  assert.equal(now.dfBlock.rmbBlock.subRecords, own.rmbBlock.subRecords, 'its buildings the same records');
  assert.equal(now.dfBlock.rmbBlock.fldHeader, own.rmbBlock.fldHeader, 'its town map and building list the same');
  assert.equal(now.dfBlock.index, own.index);
  const stall = now.layout.models.find((m) => m.modelIdNum === TOWN_STALL_MODEL);
  assert.deepEqual([...stall.matrix], [...miscModelMatrix(dress.blocks[0].models[0])]);
  assert.equal(stall.recordIndex, undefined, 'no building of its own');
  assert.equal(dressedBlock(own, { flats: [], models: [] }), own, 'nothing to add: the block as it is');
  const before = nav.grid.slice();
  const n = carveTownDress(nav, dress);
  assert.ok(n > 0);
  const [x0, z0, x1, z1] = dress.stalls[0];
  assert.equal(nav.grid[Math.floor((z0 + z1) / 2 / NAV_CELL) * nav.width + Math.floor((x0 + x1) / 2 / NAV_CELL)], 0);
  assert.equal(nav.grid.filter((v, i) => v !== before[i]).length, n);
});

test('TOWN-DRESS our stall: the port\'s own shapes in the capitals\' own pictures - four posts in the ground, a counter at its height, an awning over the posts sloping to the front; within its footprint (mutants: the counter moved; the awning off the frame)', () => {
  const m = buildTownStall();
  assert.ok(m.positions.length > 0 && m.indices.length % 3 === 0);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === CAPITAL_ARCHIVE), 'our own pictures');
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); }
  assert.ok(lo[0] >= STALL_FOOT[0] - 1e-6 && hi[0] <= STALL_FOOT[2] + 1e-6 && lo[2] >= STALL_FOOT[1] - 1e-6 && hi[2] <= STALL_FOOT[3] + 1e-6, 'within its footprint');
  assert.ok(lo[1] < 0, 'its posts in the ground');
  assert.ok(Math.abs(hi[1] - (TOWN_STALL.backH + ((TOWN_STALL.backH - TOWN_STALL.frontH) / (TOWN_STALL.front - TOWN_STALL.back)) * TOWN_STALL.overhang + 0.02)) < 1e-6, 'the awning\'s back edge its top');
  assert.equal(WARE_Y, -43, 'a ware\'s foot on the counter: (-YPos - 6) units, 0.925 m');
  assert.ok(Math.abs((-WARE_Y - 6) * 0.025 - TOWN_STALL.counterY) < 0.01);
});

test('TOWN-DRESS wired: the stall on the model door at every boot, behind no switch; the stand-ins at every boot; the pixel build dresses each town after its yards and port and before its blocks are drawn, and keeps its walkers off the stalls; the fixed city stands none (mutants: dressed before the yards; the walkers uncarved)', () => {
  const M = rd('src/scenes/modWorldData.js');
  assert.match(M, /\n {4}installTownDress\(\);[^\n]*\n {4}installTownStandIns\(\);/);
  const H = rd('src/scenes/townDressHost.js');
  assert.match(H, /registerCustomModel\(TOWN_STALL_MODEL, \(\) => buildTownStall\(\), \(\) => true, \{ climateFree: true \}\);/);
  const P = rd('src/scenes/pixelBuild.js');
  const at = (t) => { const i = P.indexOf(t); assert.ok(i >= 0, t); return i; };
  assert.ok(at('if (portTown) portSites = places.ports;') < at('townDress = farView ? null : await townDressFor(loc, dfLocation, {'), 'after the yards and the port');
  assert.ok(at('townDress = farView ? null : await townDressFor(') < at('for (const b of loc.blocks) {\n        // SOLITUDE-RELIEF'), 'before the blocks are drawn');
  assert.match(P, /carveCapitalWalks\(nav, dfLocation\);[^\n]*\n {8}carveTownDress\(nav, townDress\);/);
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /townDress/, 'the fixed city stands none, as it stands no yard');
});

test('OWN-WORK3 the retired layouts: a record a save made in Beautiful Villages\' town keeps its stamp; its pin is never honoured (no pack is in the build), so its town stands Daggerfall\'s and the record sleeps, and the player is told so (mutants: the pin honoured; the line unchanged)', async () => {
  const LP = await import('../../src/systems/layoutPins.js');
  const { ensureWorldDataPack } = await import('../../src/scenes/modWorldData.js');
  LP._resetLayoutPins();
  try {
    LP.configureLayoutPins({ vendorOn: () => false, locationKeyOfMapId: (id) => (id === 77 ? 4201 : null) });
    const pins = LP.pinsFrom(LP.layoutRecordsOf({ houses: [{ mapId: 77, buildingKey: 0x10203, layout: 'beautiful-villages@1.4.2' }] }));
    assert.deepEqual([...pins.get(4201).in], ['beautiful-villages']);
    const { dropped, heldBack } = await LP.admitPinnedPacks(pins, ensureWorldDataPack);
    assert.equal(dropped, 1);
    LP.setLayoutPins(pins, { heldBack });
    assert.equal(LP.recordHeldBack({ mapId: 77, layout: 'beautiful-villages@1.4.2' }), true, 'its records sleep');
    assert.equal(LP.recordStands({ mapId: 77, layout: 'beautiful-villages@1.4.2' }), false, 'never a stranger\'s building');
    assert.equal(LP.recordStands({ mapId: 77 }), true, 'a classic record stands');
    assert.match(LP.PINS_DROPPED_LINE, /no longer has/);
  } finally { LP._resetLayoutPins(); }
  for (const v of ['beautiful-villages', 'beautiful-cities']) assert.equal(existsSync(join(ROOT, 'vendor', v)), false, `${v}: retired`);
});

// ---- with the player's own data: the Bay's village, town and city, and a hamlet past the Bay ----
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('TOWN-DRESS with ARENA2: Baghissibu (a village), Chestering (a town) and Daggerfall (a city), and Riverwood past the Bay in Skyrim on a Bay hamlet\'s blocks - each dressed, and no piece stands on a road, in a door\'s approach or in any face of a building or a model, measured on the true triangles', { skip: HAVE ? false : 'ARENA2_PATH not set', timeout: 300000 }, async () => {
  const { loadMaps, loadBlocks, classicModels } = await import('../arena1Data.mjs');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { synthesizeCountryLocation } = await import('../../src/world/tamrielCountry.js');
  const maps = loadMaps(), blocks = loadBlocks(), raw = classicModels(), cache = new Map();
  const modelOf = (id) => { if (!cache.has(id)) cache.set(id, raw(id)); return cache.get(id); };
  const find = (name) => {
    for (let r = 0; r < maps.regionCount; r++) { const reg = maps.getRegion(r); for (let l = 0; reg && l < reg.locationCount; l++) if (reg.mapNames[l] === name) return maps.getLocation(r, l); }   // BAY-OWN: the Bay's own towns, by name
    return null;
  };
  const chestering = find('Chestering');
  const riverwood = synthesizeCountryLocation(chestering, { px: 1700, py: -398, type: LOCATION_TYPES.TownHamlet, name: 'Riverwood' }, { regionIndex: 64, regionName: 'Skyrim', climate: { ...chestering.climate, climateType: CLIMATE_BASE_TYPES.Mountain, zoneClimateType: CLIMATE_BASE_TYPES.Mountain } });
  const counts = {};
  for (const [label, dfl] of [['Baghissibu', find('Baghissibu')], ['Chestering', chestering], ['Daggerfall', find('Daggerfall')], ['Riverwood', riverwood]]) {
    assert.ok(dfl, label);
    const loc = layoutLocation(dfl, maps, blocks, { enhanced: true, windmills: true });
    const nav = new CityNavigation(loc.width, loc.height);
    for (const b of loc.blocks) { const f = b.dfBlock.rmbBlock.fldHeader; nav.setBlockData(b.x, b.y, f.autoMapData, (tx, ty) => f.groundData.groundTiles[tx][ty].textureRecord, { enhancedWater: true }); }
    const dress = townDressOf(loc, dfl, { nav, modelOf });
    assert.ok(dress, `${label} dressed`);
    counts[label] = dress.counts;
    // the town's true faces over the ground, and its doors
    const faces = [], doors = [];
    for (const b of loc.blocks) for (const m of b.layout.models) {
      const mod = modelOf(m.modelIdNum);
      if (!mod) continue;
      const M = m.matrix, P = mod.positions, at = (i) => [M[0] * P[i] + M[4] * P[i + 1] + M[8] * P[i + 2] + M[12] + b.originX, M[1] * P[i] + M[5] * P[i + 1] + M[9] * P[i + 2] + M[13], M[2] * P[i] + M[6] * P[i + 1] + M[10] * P[i + 2] + M[14] + b.originZ];
      for (let k = 0; k < mod.indices.length; k += 3) { const t = [at(mod.indices[k] * 3), at(mod.indices[k + 1] * 3), at(mod.indices[k + 2] * 3)]; if (Math.max(t[0][1], t[1][1], t[2][1]) > 0.2) faces.push(t); }
      if (m.recordIndex != null) for (const d of mod.doors ?? []) { const r = doorReach(d, M); doors.push({ ...r, foot: [r.foot[0] + b.originX, r.foot[1] + b.originZ] }); }
    }
    const seg = (x, z, a, c) => { const ex = c[0] - a[0], ez = c[2] - a[2], l2 = ex * ex + ez * ez, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / l2)) : 0; return Math.hypot(x - a[0] - ex * t, z - a[2] - ez * t); };
    const inside = (x, z, [a, c, e]) => {
      const area = (c[0] - a[0]) * (e[2] - a[2]) - (e[0] - a[0]) * (c[2] - a[2]);
      if (Math.abs(area) < 1e-6) return false;
      const s = (p, q, r) => (p[0] - r[0]) * (q[2] - r[2]) - (q[0] - r[0]) * (p[2] - r[2]), P = [x, 0, z];
      const d1 = s(P, a, c), d2 = s(P, c, e), d3 = s(P, e, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    for (const p of piecesOf(loc, dress)) {
      if (p.ware) continue;
      const r = p.kind === 'stall' ? 0.3 : 0.2;
      assert.notEqual(nav.weightAt(Math.floor(p.x / NAV_CELL), Math.floor(p.z / NAV_CELL)), ROAD_WEIGHT, `${label} ${p.kind}: off the road`);
      for (const d of doors) assert.equal(inDoorway(d, p.x, p.z, 0), false, `${label} ${p.kind} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}): out of a door's way`);
      for (const t of faces) assert.ok(!inside(p.x, p.z, t) && Math.min(seg(p.x, p.z, t[0], t[1]), seg(p.x, p.z, t[1], t[2]), seg(p.x, p.z, t[2], t[0])) >= r, `${label} ${p.kind} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}): out of every wall`);
    }
  }
  for (const [label, c] of Object.entries(counts)) assert.ok(c.lamps > 0 && c.stalls > 0, `${label}: lamps and a market (${JSON.stringify(c)})`);
  assert.equal(counts.Daggerfall.stalls, 3, 'a city\'s three');
});
