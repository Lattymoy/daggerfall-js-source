// WHAT A RECORD STILL OWES A SETTLEMENT'S CARVE. A record written before the carve law, on a settlement's pixel not built
// yet, stands without the carve; its pixel is owed, the save carries the debt, a load re-stands the save's owed records
// by the carve again, and the pixel's first build pays it with the build's own move. A Hammerfell settlement and a Bay
// village. Pins mutation-checked (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { owePads, payPads, padsOwedAt, padsOwed, padsOwedFrom, savedPadsOwed, clearPadsOwed } from '../../../src/world/settlement/settlementOwed.js';
import { recordFrame, createGroundFrame } from '../../../src/scenes/groundFrameHost.js';
import { SETTLEMENT_ROWS, settlementPixel } from '../../../src/world/settlement/settlementPlaces.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, PADS_FRAME_LAW } from '../../../src/world/terrain/terrainSampler.js';

const read = (f) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');

test('OWED the ledger: a pixel owed until paid, listed sorted for a save; a save\'s debt read once, malformed keys dropped, what stood before replaced (mutants: read twice, the keys unchecked)', () => {
  clearPadsOwed();
  owePads('20,5');
  owePads('-3,7');
  assert.deepEqual(padsOwed(), ['-3,7', '20,5']);
  assert.equal(payPads('20,5'), true);
  assert.equal(payPads('20,5'), false, 'paid once');
  assert.equal(padsOwedAt('-3,7'), true);
  const save = { padsOwed: ['1,2', 'x', 7, '3,4'] };
  padsOwedFrom(save);
  assert.deepEqual(padsOwed(), ['1,2', '3,4'], 'the save\'s own debt, whatever stood before it');
  assert.equal(savedPadsOwed('1,2') && !savedPadsOwed('-3,7'), true);
  owePads('9,9');   // owed while the same save re-stands: a second read of it keeps it
  padsOwedFrom(save);
  assert.deepEqual(padsOwed(), ['1,2', '3,4', '9,9']);
  padsOwedFrom({ groundFrame: 6 });
  assert.deepEqual(padsOwed(), [], 'a save that owes nothing');
  clearPadsOwed();
});

test('OWED the frame\'s law: a record stamped before the carve law rides it; one stamped with it rides it only where its save owed it, the save\'s debt read from its stamp (mutants: the debt unread, the stamp unread)', () => {
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  const reads = [];
  const law = recordFrame({ landform: false, liftAt: () => 0, heightAt: () => 100, state, bayAt: () => false, padsMovedAt: () => -2.5, owesAt: (x) => x > 50, readOwed: (s) => reads.push(s) });
  const save = { groundFrame: PADS_FRAME_LAW, padsOwed: ['1,1'] };
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, PADS_FRAME_LAW - 1), 101 - 2.5, 'an older law');
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, PADS_FRAME_LAW), 101, 'stamped with it, a number');
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, save), 101, 'stamped with it, not owed there');
  assert.equal(law.restandHeight(101, 60, 0, STREAMING_TERRAIN_SCALE, save), 101 - 2.5, 'owed there');
  assert.ok(reads.length === 2 && reads.every((s) => s === save), 'the save\'s envelope handed to the ledger');
});

/** A world of one origin: `built` and the place a pixel's build stands in the host's hands. */
function world(origin, placeAt = () => null) {
  const built = new Map();
  const state = {
    compensation: [0, 0, 0], mapOrigin: { x: origin[0], y: origin[1] },
    pixelTranslation: (px, py) => [(px - origin[0]) * TERRAIN_SIZE, 0, (origin[1] - py) * TERRAIN_SIZE],
    localFromWorld: (x, z) => [x, z],
  };
  const frame = createGroundFrame({
    _liftLocationAt: placeAt, blocks: null, built, heightAt: () => NaN, heightCell: TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1), landform: false,
    landformsHere: () => null, beyondSites: { generation: () => 0, beyond: () => null }, maps: null, terrainGen: { roads: () => null },
    get state() { return state; }, get woods() { return {}; },
  });
  return { frame, built };
}

test('OWED the frame host: a settlement\'s pixel not built owes its carve and answers none; built, its build\'s own move, the debt paid; a pixel no settlement stands on owes nothing - past the Bay and on it (mutants: never owed, the grown town never owed, the debt kept once read, a new world owing the old one\'s)', () => {
  setTamrielFit(null);
  const row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row), key = `${px},${py}`;
  owePads('77,77');   // a world before this one's debt
  const { frame, built } = world([px, py]);
  assert.deepEqual(padsOwed(), [], 'a new world owes nothing');
  assert.equal(frame.padsMovedAt(100, 100), 0);
  assert.deepEqual(padsOwed(), [key], 'Sahr Waters\' pixel owed');
  built.set(key, { settlement: { moved: new Float32Array(HEIGHTMAP_DIMENSION ** 2).fill(2) } });
  assert.ok(Math.abs(frame.padsMovedAt(100, 100) - 2 * STREAMING_TERRAIN_SCALE) < 1e-6, 'its build\'s own move');
  assert.deepEqual(padsOwed(), [], 'and paid');
  assert.equal(frame.padsMovedAt(100 + TERRAIN_SIZE, 100), 0, 'the next pixel east');
  assert.deepEqual(padsOwed(), [], 'no settlement there, nothing owed');
  const village = { mapTableData: { mapId: 5101, locationType: 2 }, name: 'Owedale', regionIndex: 17 }, dungeon = { mapTableData: { mapId: 5102, locationType: 7 }, name: 'Pit' };
  const bay = world([200, 200], (x) => (x === 200 ? village : x === 201 ? dungeon : null));
  bay.frame.padsMovedAt(10, 10);
  bay.frame.padsMovedAt(10 + TERRAIN_SIZE, 10);
  assert.deepEqual(padsOwed(), ['200,200'], 'a Bay village that grows is owed, a dungeon is not');
  // a save that owed the village: its record there re-stands by the carve the build hands back
  bay.built.set('200,200', { settlement: { moved: new Float32Array(HEIGHTMAP_DIMENSION ** 2).fill(-1) } });
  const save = { groundFrame: PADS_FRAME_LAW, padsOwed: ['200,200'] };
  assert.ok(Math.abs(bay.frame.restandHeight(50, 10, 10, STREAMING_TERRAIN_SCALE, save) - (50 - STREAMING_TERRAIN_SCALE)) < 1e-6);
  assert.equal(bay.frame.restandHeight(50, 10 + TERRAIN_SIZE, 10, STREAMING_TERRAIN_SCALE, save), 50, 'one it did not owe stands as written');
  clearPadsOwed();
});

test('OWED the wiring (by source): the save carries the debt and hands it back; each load re-stand passes the save\'s stamp; a pixel\'s first build pays it with the build\'s move (mutants: each seam)', () => {
  const save = read('systems/save/save.js'), world = read('scenes/world.js'), build = read('scenes/pixelBuild.js');
  assert.match(save, /groundFrame: GROUND_FRAME_LAW, padsOwed: padsOwed\(\) \};/);
  assert.match(save, /groundFrame: snap\.groundFrame \?\? null, padsOwed: snap\.padsOwed \?\? \[\] \};/);
  assert.equal(world.match(/restandHeight\([^)]*, extras\)/g)?.length, 3, 'the camps, the save\'s rows and its player');
  assert.match(build, /if \(host\.rideGround && payPads\(pkey\) && owedTown\?\.moved\) \{\n\s+const origin = host\.state\.pixelTranslation\(px, py\);\n\s+host\.rideGround\(origin, pkey, \(x, z\) => settlementMovedAt\(owedTown, origin, x, z, TERRAIN_SIZE \/ \(HEIGHTMAP_DIMENSION - 1\)\), key !== pkey\);/);
});
