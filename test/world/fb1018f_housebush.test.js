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
/** The block's ground-scenery flats as collectBlockFlats stands them: `x,z` (block metres) -> record. */
const sceneryOf = (block) => new Map(RMB.collectBlockFlats(block, TEMPERATE).map((f) => [`${Math.round(f.x / GLOBAL_SCALE)},${Math.round(f.z / GLOBAL_SCALE)}`, f.record]));
/** JSON cell (row r from the north, column c) -> the foot AddNatureFlats stands it at, in units. */
const footOf = (r, c) => `${c * 256},${(15 - r) * 256 + 256}`;

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
