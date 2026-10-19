// HOUSE-BUSH (FIELD BUGS 2026-10-18f, thread T6 "Collection: Broken world objects", æther: "Small bush in a house wall,
// near east gate of Penwall Derry" - a bush standing half inside a vine-covered house wall, the automap crop beside a
// building block, two taverns named on it).
//
// Penwall Derry is Beautiful Cities' (location-23-591, six blocks wide), and the block at its east gate is the author's
// composite WALLAA09.TVRNAS01: the city's east wall on its west side, a roadside tavern block outside the gate - two
// taverns among its houses. The author wrote that block's ground scenery whole, and one cell of it (record 4, JSON row 4
// column 15) stands inside a House2's footprint as the block's own automap draws it, a cell from every side. DFU's
// RMBLayout.AddNatureFlats reads no building and no automap, so DFU stands it there too; the port did, verbatim. The
// author's own fix for the class is in the same pack: TVRNAL01's edit sets two classic scenery cells to -1, and both
// stood on a House2's footprint. HOUSE-BUSH (world/rmbFlats.js sceneryUnderRoof): a ground-scenery cell whose foot the
// block's automap puts inside a building's footprint - all four automap cells round it architecture, by the town map's
// own ladder (ui/town/townQuarters.js quarterOf) - is not stood. A cell on a footprint's edge is left as authored.
//
// No game data: the blocks' ground scenery and automap are carried WHOLE in the vendored packs and built by the door's
// own converter (blockFromJson); the flats are collectBlockFlats' - the producer the two town hosts run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import * as RMB from '../../src/world/rmbFlats.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';

const TEMPERATE = 504;   // ClimateTextureSet.Nature_TemperateWoodland
const PACKS = new Map();
const PACK = (v) => {
  if (!PACKS.has(v)) PACKS.set(v, JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8')));
  return PACKS.get(v);
};
const unRun = (r) => { const out = []; for (let i = 0; i < r.length; i += 2) for (let k = 0; k < r[i + 1]; k++) out.push(r[i]); return out; };
const opOf = (ops, path) => ops.find((o) => o[0] === 's' && o[1].join('.') === path)?.[2];

/** A block of a pack as the door serves its FLD header's ground and automap - the file's whole-list ops, decoded by the
 *  pack's own codecs, through blockFromJson - or null where the file does not carry both whole. `blankMap` serves it
 *  with no automap (every byte street). */
function packBlock(vendor, name, { blankMap = false } = {}) {
  const [, , ops] = JSON.parse(PACK(vendor).files[name]);
  const tiles = opOf(ops, 'RmbBlock.FldHeader.GroundData.GroundTiles')?.$t;
  const scenery = opOf(ops, 'RmbBlock.FldHeader.GroundData.GroundScenery')?.$g;
  const auto = opOf(ops, 'RmbBlock.FldHeader.AutoMapData');
  const subs = opOf(ops, 'RmbBlock.SubRecords');
  if (!scenery || !auto || !Array.isArray(subs)) return null;
  const autoMap = auto.$r ? unRun(auto.$r) : auto;
  // AUDIT FB1018f L4-2: the block's buildings as the pack carries them (each a node of its pool) - the law asks whether
  // one stands on the footprint, and a block built with none could never show a phantom
  const nodeOf = (v) => { const n = v?.$n !== undefined ? PACK(vendor).nodes[v.$n] : v; return typeof n === 'string' ? JSON.parse(n) : n; };
  return blockFromJson({
    Name: name.replace(/\.json$/, ''),
    RmbBlock: {
      FldHeader: {
        GroundData: { GroundTiles: (tiles ?? []).map(ROW_CODECS.$t), GroundScenery: scenery.map(ROW_CODECS.$g) },
        AutoMapData: blankMap ? new Array(4096).fill(0) : autoMap,
      },
      SubRecords: subs.map(nodeOf).map((s) => ({ XPos: s?.XPos ?? 0, ZPos: s?.ZPos ?? 0 })), Misc3dObjectRecords: [], MiscFlatObjectRecords: [],
    },
  }, 9300);
}
/** The block's ground-scenery flats as collectBlockFlats stands them: `x,z` (block metres) -> record. */
const sceneryOf = (block) => new Map(RMB.collectBlockFlats(block, TEMPERATE).map((f) => [`${Math.round(f.x / GLOBAL_SCALE)},${Math.round(f.z / GLOBAL_SCALE)}`, f.record]));
/** JSON cell (row r from the north, column c) -> the foot AddNatureFlats stands it at, in units. */
const footOf = (r, c) => `${c * 256},${(15 - r) * 256 + 256}`;

test('HOUSE-BUSH: the report - Penwall Derry\'s east gate is Beautiful Cities\' WALLAA09.TVRNAS01, two taverns among its houses, and its scenery bush (row 4, column 15) inside a House2\'s footprint is not stood; every other cell is', () => {
  const [, , locOps] = JSON.parse(PACK('beautiful-cities').files['location-23-591.json']);
  assert.equal(JSON.parse(PACK('beautiful-cities').files['location-23-591.json'])[1][3], 'Penwall Derry');
  const width = opOf(locOps, 'Exterior.ExteriorData.Width'), names = opOf(locOps, 'Exterior.ExteriorData.BlockNames');
  assert.equal(width, 6);
  assert.equal(names[2 * width + 5], 'WALLAA09.TVRNAS01.RMB', 'the east column\'s middle block: the gate');
  const [, , ops] = JSON.parse(PACK('beautiful-cities').files['WALLAA09.TVRNAS01.RMB.json']);
  assert.equal(opOf(ops, 'RmbBlock.FldHeader.BuildingDataList').filter((b) => b.BuildingType === 15).length, 2, 'two taverns, as the automap crop names');

  const block = packBlock('beautiful-cities', 'WALLAA09.TVRNAS01.RMB.json');
  const auto = block.rmbBlock.fldHeader.autoMapData;
  assert.deepEqual([auto[15 * 64 + 59], auto[15 * 64 + 60], auto[16 * 64 + 59], auto[16 * 64 + 60]], [19, 19, 19, 19], 'its foot\'s four automap cells: a House2 (BuildingType 18 + 1)');
  const g = opOf(ops, 'RmbBlock.FldHeader.GroundData.GroundScenery').$g;
  assert.equal(g[4 * 16 + 15], 4, 'the author\'s bush, record 4');

  const stood = sceneryOf(block);
  assert.equal(stood.has(footOf(4, 15)), false, 'the bush in the house is not stood');
  const authored = g.map((rec, i) => [rec, i]).filter(([rec]) => rec >= 1);
  assert.equal(stood.size, authored.length - 1, 'every other scenery cell is');
  for (const [rec, i] of authored) if (i !== 4 * 16 + 15) assert.equal(stood.get(footOf(Math.floor(i / 16), i % 16)), rec, `cell ${i} stands as authored`);
  assert.equal(sceneryOf(packBlock('beautiful-cities', 'WALLAA09.TVRNAS01.RMB.json', { blankMap: true })).has(footOf(4, 15)), true, 'with no footprint drawn there, it stands (DFU\'s own law)');
});

test('HOUSE-BUSH: the author\'s own hand - TVRNAL01\'s edit takes two classic scenery cells out, and both stood on a House2\'s footprint (one inside it, one on its edge)', () => {
  const [, , ops] = JSON.parse(PACK('beautiful-cities').files['TVRNAL01.RMB.json']);
  const cleared = ops.filter((o) => o[0] === 's' && o[1].join('.').startsWith('RmbBlock.FldHeader.GroundData.GroundScenery.') && o[2] === -1).map((o) => o[1][4]);
  assert.deepEqual(cleared, [165, 214]);
  const auto = unRun(opOf(ops, 'RmbBlock.FldHeader.AutoMapData').$r);
  const cells = (i) => { const r = Math.floor(i / 16), c = i % 16; return [auto[(4 * r - 1) * 64 + 4 * c - 1], auto[(4 * r - 1) * 64 + 4 * c], auto[4 * r * 64 + 4 * c - 1], auto[4 * r * 64 + 4 * c]]; };
  assert.deepEqual(cells(214), [19, 19, 19, 19], 'inside the house - what HOUSE-BUSH takes');
  assert.deepEqual(cells(165), [19, 19, 0, 0], 'on its edge - left to the author');
});

test('HOUSE-BUSH: the law - inside a footprint by the town map\'s ladder, never on its edge, never at the block\'s rim, never over scenery, a ship or a special', () => {
  assert.equal(typeof RMB.sceneryUnderRoof, 'function', 'world/rmbFlats.js sceneryUnderRoof');
  const map = (fill) => { const a = new Uint8Array(4096); for (let r = 20; r < 32; r++) for (let c = 20; c < 32; c++) a[r * 64 + c] = fill; return a; };
  // a scenery cell (x, y) of AddNatureFlats' walk stands its foot at automap column 4x and row (from the north) 60 - 4y
  const all = () => true;   // every footprint held (the footprint law is heldFootprints', below)
  const at = (a, col, row, held = all) => RMB.sceneryUnderRoof(a, col / 4, (60 - row) / 4, held);
  const house = map(19);
  assert.equal(at(house, 24, 24), true, 'deep inside');
  assert.equal(at(house, 28, 28), true);
  assert.equal(at(house, 20, 24), false, 'on the west edge: two of its four cells street');
  assert.equal(at(house, 24, 32), false, 'on the south edge');
  assert.equal(at(house, 32, 24), false, 'on the east edge');
  assert.equal(at(house, 20, 20), false, 'at a corner: one cell of four');
  assert.equal(at(house, 44, 44), false, 'out in the street');
  for (const [byte, inside] of [[1, true], [12, true], [15, true], [16, true], [24, true], [0, false], [25, false], [117, false], [224, false], [250, false], [251, false]]) {
    assert.equal(at(map(byte), 24, 24), inside, `byte ${byte}`);
  }
  const rim = new Uint8Array(4096).fill(19);
  assert.equal(RMB.sceneryUnderRoof(rim, 0, 5, all), false, 'the west rim: the cells west of the foot are the next block\'s');
  assert.equal(RMB.sceneryUnderRoof(rim, 5, 15, all), false, 'the north rim');
  assert.equal(RMB.sceneryUnderRoof(rim, 1, 0, all), true, 'a cell in from the rim reads its own block');
  assert.equal(RMB.sceneryUnderRoof(null, 5, 5, all), false, 'no automap: no footprint');
  assert.equal(RMB.sceneryUnderRoof(new Uint8Array(4095).fill(19), 5, 5, all), false, 'a short one is no automap');
  assert.equal(RMB.sceneryUnderRoof(new Uint8Array(4096).fill(19), 5, 5, all), true);
  assert.equal(RMB.sceneryUnderRoof(new Uint8Array(4096).fill(19), 5, 5, null), false, 'no buildings known: nothing taken');
  // AUDIT FB1018f L4-1: a footprint is held when a building of the block stands on it (xPos / 64, zPos / 64)
  const two = new Uint8Array(4096);
  for (let r = 10; r < 20; r++) for (let c = 10; c < 20; c++) two[r * 64 + c] = 19;
  for (let r = 40; r < 50; r++) for (let c = 40; c < 50; c++) two[r * 64 + c] = 19;
  const held = RMB.heldFootprints(two, [{ xPos: 12 * 64, zPos: 15 * 64 }]);
  assert.equal(held(14 * 64 + 14), true, 'the footprint its building stands on');
  assert.equal(held(44 * 64 + 44), false, 'a footprint no building stands on is a phantom');
  assert.equal(held(30 * 64 + 30), false, 'the street');
  assert.equal(RMB.heldFootprints(null, []), null);
});

test('HOUSE-BUSH: both town packs swept - every scenery cell the law takes stands inside a footprint a building of the block stands on, every other stands, and the count is the record\'s (10 in Beautiful Cities, 8 in Beautiful Villages - AUDIT FB1018f L4-1: the Villages\' 16 by the automap alone)', () => {
  for (const [vendor, want] of [['beautiful-cities', 10], ['beautiful-villages', 8]]) {
    let taken = 0, blocks = 0;
    for (const name of Object.keys(PACK(vendor).files)) {
      if (!name.endsWith('.RMB.json')) continue;
      const block = packBlock(vendor, name);
      if (!block) continue;
      blocks++;
      const open = sceneryOf(packBlock(vendor, name, { blankMap: true })), stood = sceneryOf(block);
      const auto = block.rmbBlock.fldHeader.autoMapData;
      for (const [key, rec] of open) {
        if (stood.get(key) === rec) continue;
        taken++;
        const [ux, uz] = key.split(',').map(Number), col = ux / 64, row = (4096 - uz) / 64;
        const cells = [auto[(row - 1) * 64 + col - 1], auto[(row - 1) * 64 + col], auto[row * 64 + col - 1], auto[row * 64 + col]];
        assert.ok(cells.every((b) => b >= 1 && b <= 24), `${vendor} ${name} ${key}: taken, its cells ${cells.join('/')}`);
      }
      assert.ok([...stood.keys()].every((k) => open.has(k)), `${vendor} ${name}: nothing stood the open block does not`);
    }
    assert.ok(blocks > 40, `${vendor}: ${blocks} blocks carry their ground and automap whole`);
    assert.equal(taken, want, `${vendor}: the cells taken`);
  }
});

test('HOUSE-BUSH THE PHANTOM HOUSES (AUDIT FB1018f L4-1): TEMPBSE0\'s automap draws houses its block does not have, and its author planted scenery on that open ground - every one of its scenery cells stands, as it did', () => {
  const block = packBlock('beautiful-villages', 'TEMPBSE0.RMB.json');
  assert.ok(block, 'carried whole');
  assert.equal(block.rmbBlock.subRecords.length, 8, 'eight buildings');
  const open = sceneryOf(packBlock('beautiful-villages', 'TEMPBSE0.RMB.json', { blankMap: true })), stood = sceneryOf(block);
  assert.deepEqual([...stood], [...open], 'nothing taken');
  // the automap alone would take six of them: their four cells are a footprint no building of the block stands on
  const auto = block.rmbBlock.fldHeader.autoMapData;
  const underMap = [...open.keys()].filter((k) => { const [x, z] = k.split(',').map(Number); return RMB.sceneryUnderRoof(auto, x / 256, (z - 256) / 256, () => true); });
  assert.equal(underMap.length, 6, 'six under the drawn footprints');
});
