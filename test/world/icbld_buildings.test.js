// BLD (2026-10-26, the owner, having walked the Imperial City: "... no doors/interiors ..."; "No band aids for any of
// this"; bible/03-World/Arena-Provinces.md IC-GRAND, BLD) - THE FABRIC'S BUILDINGS ENTERED AS DAGGERFALL'S ARE, pinned:
// a record and a door for every street-front building its street lets one stand at; the door the game's own building
// door, laid by RMBLayout's own law where the building's door is; its interior a donor's from Daggerfall's own blocks of
// its type, laid so the landing is just inside that door; its name its own, never a classic building's draw; and against
// the player's own BLOCKS.BSA and ARCH3D where they are at hand, every donor as its table says and every building entered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fabricCell, fabricGroundIn, outwardOf, GROUND, BAY } from '../../src/world/imperialFabric.js';
import {
  fabricCellBuildings, fabricBuildingsIn, FABRIC_DONORS, DISTRICT_TRADE, DISTRICT_QUALITY, withFabricBuildings, fabricDoorModel,
  fabricDoorModelId, FABRIC_DOOR, blockLocal, automapByteOf, sectorOf, _resetFabricInteriors,
} from '../../src/world/imperialFabricBuildings.js';
import { imperialBlockJson, imperialOwnName, sliceOfCell } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell, imperialDistrictAt } from '../../src/world/imperialCity.js';
import { portBlockJson, startMarkerAt, miscModelAt } from '../../src/world/tamrielCapitals.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { getStaticDoors } from '../../src/world/staticDoors.js';
import { doorWorldPosition, doorWorldNormal, interiorLanding } from '../../src/player/enterExit.js';
import { DOOR_TYPE, dfMeshToModel } from '../../src/world/meshReader.js';
import { mergeNamedBuildings } from '../../src/systems/talk/talkTopics.js';
import { buildingSummaries } from '../../src/world/buildingSummaries.js';
import { BUILDING_TYPES, isNamedBuildingType } from '../../src/world/buildingNames.js';
import { GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';
import { layoutInterior, INTERIOR_MARKER } from '../../src/world/interior/interiorLayout.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { Arch3dFile } from '../../src/formats/arch3dFile.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
function sampleCell(x, z, n = 8) {
  const r0 = Math.floor(z / B + HALF), c0 = Math.floor(x / B + HALF);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    if (fabricCell(r, c).plots.length >= n) return [r, c];
  }
  return null;
}
const CELLS = [...IMPERIAL_SECTORS.flatMap(([, b]) => [[b + 22.5, 3000], [b + 37.5, 5300]]), [170, 7300]].map(([b, r]) => sampleCell(...polar(b, r))).filter(Boolean);
const DEPS = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: [], noGround: 255, rim: () => false };
/** A BLOCKS.BSA stand-in: every block's every record an interior that names where it was read from - PIN MOVED
 *  (IC-INTERIORS): on its one person, the cast a fabric building's own interior takes from its donor. */
const FAKE_BLOCKS = { getBlockByName: (name) => ({ rmbBlock: { subRecords: Array.from({ length: 40 }, (_, k) => ({ interior: { header: { num3dObjectRecords: 1 }, from: `${name}#${k}`, blockPeopleRecords: [{ xPos: 0, yPos: 0, zPos: 0, textureArchive: 182, textureRecord: k % 30, factionID: 0, flags: 0, from: `${name}#${k}` }], blockFlatObjectRecords: [] } })) } }) };
const ownBlock = (r, c, blocks = FAKE_BLOCKS) => { _resetFabricInteriors(); const name = imperialOwnName(r, c); return withFabricBuildings(imperialBlockJson(name, DEPS), name, blocks); };

test('BLD EVERY STREET-FRONT BUILDING ITS RECORD AND ITS DOOR - each building of a cell with a street front a record (its type its district\'s trade or a residence by its footprint, its quality its district\'s, a guild\'s faction, a name seed of its own) and a door on its widest street at a bay\'s middle with the street open before it; the same on every client, and handed on by its plot\'s key (mutants: a door before a way up; the quality off its district; a guild hall of no guild)', () => {
  let fronts = 0, recs = 0, shops = 0;
  const pools = new Set();
  for (const [r, c] of CELLS) {
    const L = fabricCell(r, c), list = fabricCellBuildings(r, c);
    fronts += L.plots.filter((p) => p.out).length;
    recs += list.length;
    assert.deepEqual(list.map((x) => x.recordIndex), list.map((_, i) => i));
    for (const x of list) {
      const p = x.plot, d = FABRIC_DONORS[x.donor], district = imperialDistrictAt(...p.q.reduce((m, v) => [m[0] + v[0] / 4, m[1] + v[1] / 4], [0, 0]));
      pools.add(x.pool);
      assert.ok(L.plots.includes(p) && p.out & (1 << x.door.edge), 'its own cell\'s, on a street front');
      assert.equal(x.type, d.type);
      assert.equal(x.pool, d.pool);
      const [lo, hi] = DISTRICT_QUALITY[district];
      assert.ok(x.quality >= lo && x.quality <= hi, `quality ${x.quality} in ${district}`);
      assert.equal(x.factionId, x.pool === 'mages' ? GUILD_FACTION_IDS.MagesGuild : x.pool === 'fighters' ? GUILD_FACTION_IDS.FightersGuild : 0);
      if (d.type === BUILDING_TYPES.GuildHall) assert.equal(DISTRICT_TRADE[district].guild, x.pool, 'a guild keeps house where its district says');
      if (isNamedBuildingType(x.type) && x.type !== BUILDING_TYPES.Tavern && d.type !== BUILDING_TYPES.GuildHall) { shops++; assert.ok(DISTRICT_TRADE[district].shops.includes(x.pool), `${x.pool} in ${district}`); }
      assert.ok(x.nameSeed >= 1 && x.nameSeed <= 65535);
      // the door: a bay's middle on its edge, the street open a hand and two metres out
      const a = p.q[x.door.edge], b = p.q[(x.door.edge + 1) & 3], len = Math.hypot(b[0] - a[0], b[1] - a[1]), bays = Math.max(1, Math.round(len / BAY));
      const s = ((x.door.at[0] - a[0]) * (b[0] - a[0]) + (x.door.at[1] - a[1]) * (b[1] - a[1])) / len, k = s / (len / bays) - 0.5;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-6 && Math.round(k) >= 0 && Math.round(k) < bays, 'a bay\'s middle');
      assert.deepEqual(x.door.n, outwardOf(p.q, x.door.edge));
      for (const out of [0.8, 2]) assert.ok([GROUND.street, GROUND.square].includes(fabricGroundIn(L, x.door.at[0] + x.door.n[0] * out, x.door.at[1] + x.door.n[1] * out)), 'the street open before the door');
    }
    assert.deepEqual(fabricCellBuildings(r, c), list, 'kept, the same');
  }
  assert.ok(recs >= fronts * 0.85, `the street fronts entered (${recs} of ${fronts})`);
  assert.ok(shops > 10 && pools.has('tavern') && pools.has('house2'), 'shops, taverns and homes among them');
  // the census's hand-off: a slice's buildings by their plots' keys, each its record and its door
  const [r, c] = CELLS[0], s = sliceOfCell(r, c), all = fabricBuildingsIn(s), mine = all.filter((x) => x.r === r && x.c === c);
  assert.deepEqual(mine.map((x) => [x.key, x.recordIndex, x.type]), fabricCellBuildings(r, c).map((x) => [x.key, x.recordIndex, x.type]));
  assert.equal(new Set(all.map((x) => x.key)).size, all.length, 'a plot\'s key names one building');
  // a guild hall where its guild keeps house, under its guild's faction - and nowhere else
  let halls = 0;
  for (const [b, rad] of [[210, 3300], [100, 4000], [330, 3300], [40, 3300]]) {
    const [x, z] = polar(b, rad), ss = sliceOfCell(Math.floor(z / B + HALF), Math.floor(x / B + HALF));
    for (const y of fabricBuildingsIn(ss)) {
      if (y.type !== BUILDING_TYPES.GuildHall) continue;
      halls++;
      const p = fabricCellBuildings(y.r, y.c)[y.recordIndex].plot, district = imperialDistrictAt(...p.q.reduce((m, v) => [m[0] + v[0] / 4, m[1] + v[1] / 4], [0, 0]));
      assert.equal(y.factionId, GUILD_FACTION_IDS[DISTRICT_TRADE[district].guild === 'mages' ? 'MagesGuild' : 'FightersGuild'], `a guild hall's faction in ${district}`);
    }
  }
  assert.ok(halls >= 3, `guild halls (${halls})`);
});

test('BLD THE DOOR IS THE GAME\'S DOOR - a cell\'s block carries each building as a record and a subrecord whose one model is its donor\'s door model, laid by RMBLayout\'s own law (world/rmbLayout.js) so its door face - a building door (DOOR_TYPE.BUILDING, the door the exterior\'s getStaticDoors files) - stands at the building\'s door facing its street; its interior its donor\'s record; its footprint on the town map its type\'s (mutants: the frame turned the other way; the donor\'s door not where the model stands it; the automap bytes left closed)', () => {
  let cells = 0;
  for (const [r, c] of CELLS) {
    const recs = fabricCellBuildings(r, c);
    if (!recs.length || cells >= 6) continue;
    cells++;
    const block = ownBlock(r, c), fh = block.rmbBlock.fldHeader;
    assert.equal(block.ownNamedBuildings, true);
    assert.equal(block.rmbBlock.subRecords.length, recs.length);
    assert.equal(fh.numBlockDataRecords, recs.length);
    const placed = layoutRmbBlock(block).models.filter((m) => m.recordIndex != null);
    assert.equal(placed.length, recs.length, 'one door model a building');
    for (const m of placed) {
      const x = recs[m.recordIndex], d = FABRIC_DONORS[x.donor];
      assert.equal(m.modelIdNum, fabricDoorModelId(x.donor));
      assert.deepEqual([fh.buildingDataList[m.recordIndex].buildingType, fh.buildingDataList[m.recordIndex].quality, fh.buildingDataList[m.recordIndex].nameSeed, fh.buildingDataList[m.recordIndex].sector], [x.type, x.quality, x.nameSeed, sectorOf(r, c)]);
      const doors = getStaticDoors(fabricDoorModel(m.modelIdNum), block.index, m.recordIndex, m.matrix);
      assert.equal(doors.length, 1);
      assert.equal(doors[0].doorType, DOOR_TYPE.BUILDING);
      const at = doorWorldPosition(doors[0]), n = doorWorldNormal(doors[0]), [bx, bz] = blockLocal(r, c, x.door.at[0], x.door.at[1]);
      assert.ok(Math.hypot(at[0] - (bx + x.door.n[0] * FABRIC_DOOR.proud), at[2] - (bz - x.door.n[1] * FABRIC_DOOR.proud)) < 0.04, `building ${m.recordIndex}'s door where it stands`);
      assert.ok(Math.hypot(n[0] - x.door.n[0], n[2] + x.door.n[1]) < 0.01, 'facing its street');
      // PIN MOVED (IC-INTERIORS): the interior is the building's own (world/interior/fabricInterior.js), its cast its donor's
      assert.equal(block.rmbBlock.subRecords[m.recordIndex].interior.blockPeopleRecords[0].from, `${d.block}#${d.record}`, 'its donor\'s cast');
    }
    // the town map: the footprint's automap bytes its type's (still shut to the walkers)
    for (const x of recs) {
      const m = x.plot.q.reduce((s, v) => [s[0] + v[0] / 4, s[1] + v[1] / 4], [0, 0]);
      const ax = Math.floor((m[0] - (c - HALF) * B) / (B / 64)), ay = 63 - Math.floor(((r + 1 - HALF) * B - m[1]) / (B / 64));
      assert.equal(fh.autoMapData[ay * 64 + ax], automapByteOf(x.type), 'its middle\'s automap byte');
    }
  }
  assert.equal(cells, 6);
  // no BLOCKS.BSA: the block as it came, no record, no door
  const [r, c] = CELLS[0], name = imperialOwnName(r, c), plain = imperialBlockJson(name, DEPS);
  assert.equal(withFabricBuildings(plain, name, null), plain);
});

test('BLD A FABRIC BLOCK NAMES ITS OWN - a fabric shop keeps its own record and draws none of the location\'s list, so a classic block\'s shop after it in the grid still draws its own (RMBLayout GetCompleteBuildingData\'s pool, systems/talk/talkTopics.js); its directory row named, its interior there (mutant: the fabric drawing the pool)', () => {
  const [r, c] = CELLS[0], fabric = ownBlock(r, c), recs = fabricCellBuildings(r, c);
  const i = recs.findIndex((x) => isNamedBuildingType(x.type));
  assert.ok(i >= 0, 'a shop in the cell');
  const type = recs[i].type;
  const classic = { name: 'GENRAM00.RMB', index: 5, rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: type, nameSeed: 0, factionId: 0, sector: 0, locationId: 0, quality: 1 }], otherNames: null }, subRecords: [{}] } };
  const pool = [{ buildingType: type, nameSeed: 4321, factionId: 0, sector: 1, locationId: 77, quality: 9 }];
  const merged = mergeNamedBuildings(pool, [{ x: 0, y: 0, dfBlock: fabric }, { x: 1, y: 0, dfBlock: classic }]);
  assert.equal(merged.get([...merged.keys()][0])[i].nameSeed, recs[i].nameSeed, 'the fabric\'s own');
  assert.equal(merged.get([...merged.keys()][1])[0].nameSeed, 4321, 'the classic block\'s draw untouched');
  const rows = buildingSummaries(pool, [{ x: 0, y: 0, dfBlock: fabric }], { locationName: 'Imperial City', regionName: 'Imperial Province' });
  assert.equal(rows.length, recs.length);
  for (const row of rows) {
    assert.ok(row.hasInterior, 'every building a room');
    if (isNamedBuildingType(row.buildingType)) assert.ok(typeof row.name === 'string' && row.name.length > 2, `${row.buildingType} named`);
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - the donors against the freeware skipped' : false;
test('BLD THE DONORS AS THE FREEWARE HAS THEM, AND EVERY BUILDING ENTERED - each donor of FABRIC_DONORS is its block\'s record of its type, its cast in it (a keeper but in a home); and a city cell\'s every building, entered with the player\'s own BLOCKS.BSA and ARCH3D, lands just inside its street door (player/enterExit.js interiorLanding) - PIN MOVED (IC-INTERIORS): the donors\' own entrances (BLD\'s door and way-out columns) are gone with their interiors', { skip: skipReal }, () => {
  const bf = new BlocksFile(); bf.load(new Uint8Array(readFileSync(`${ARENA2}/BLOCKS.BSA`)));
  const af = new Arch3dFile(); af.load(new Uint8Array(readFileSync(`${ARENA2}/ARCH3D.BSA`)));
  const models = new Map();
  const getModel = (id) => { if (!models.has(id)) { let m = null; try { const k = af.getRecordIndex(id); if (k >= 0) m = dfMeshToModel(af.getMesh(k), () => ({ width: 64, height: 64 })); } catch { m = null; } models.set(id, m); } return models.get(id); };
  for (const d of FABRIC_DONORS) {
    const blk = bf.getBlockByName(d.block), bd = blk.rmbBlock.fldHeader.buildingDataList[d.record];
    assert.equal(bd.buildingType, d.type, `${d.block}#${d.record}`);
    if (!d.pool.startsWith('house')) assert.ok(blk.rmbBlock.subRecords[d.record].interior.blockPeopleRecords.length > 0, `${d.block}#${d.record}: its keeper in`);
  }
  const xf = (M, p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
  const mul = (A, Bm) => { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[k * 4 + i] * Bm[j * 4 + k]; o[j * 4 + i] = s; } return o; };
  let entered = 0;
  for (const [r, c] of CELLS.slice(0, 4)) {
    const block = ownBlock(r, c, bf);
    for (const m of layoutRmbBlock(block).models.filter((x) => x.recordIndex != null)) {
      const [door] = getStaticDoors(fabricDoorModel(m.modelIdNum), block.index, m.recordIndex, m.matrix), D = doorWorldPosition(door), N = doorWorldNormal(door);
      const inner = layoutInterior(block, block.index, m.recordIndex, getModel);
      const land = interiorLanding(D, inner.markers.filter((k) => k.type === INTERIOR_MARKER.ENTER).map((k) => xf(door.matrix, [k.x, k.y, k.z])), inner.doors.map((x) => ({ ...x, matrix: mul(door.matrix, x.matrix) })));
      assert.ok(land, `building ${m.recordIndex}: a landing`);
      assert.ok(Math.hypot(land[0] - D[0], land[2] - D[2]) < 3 && (land[0] - D[0]) * N[0] + (land[2] - D[2]) * N[2] < 0, `building ${m.recordIndex}: landed just inside its door`);
      entered++;
    }
  }
  assert.ok(entered > 50, `${entered} buildings entered`);
  _resetFabricInteriors();
});
