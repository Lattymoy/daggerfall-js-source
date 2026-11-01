// WHAT A RECORD STILL OWES A SETTLEMENT'S CARVE. A record written before the carve law, on a settlement's pixel not built
// yet, stands without the carve; its pixel is owed, the save carries the debt, a load re-stands the save's owed records
// by the carve again, and the pixel's first build pays it with the build's own move. A Hammerfell settlement and a Bay
// village. Pins mutation-checked (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { owePads, payPads, padsOwedAt, padsOwed, padsOwedFrom, savedPadsOwed, clearPadsOwed, padsOwedBuilt } from '../../../src/world/settlement/settlementOwed.js';
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
  assert.match(build, /if \(host\.rideGround && payPads\(pkey\) && !groundWas && owedTown\?\.moved\) \{[^\n]*\n\s+const origin = host\.state\.pixelTranslation\(px, py\);\n\s+host\.rideGround\(origin, pkey, \(x, z\) => settlementMovedAt\(owedTown, origin, x, z, TERRAIN_SIZE \/ \(HEIGHTMAP_DIMENSION - 1\)\), key !== pkey\);/);
});

test('OWED every load reads its save\'s debt as it restores the save; a pixel built already is paid as its records re-stand, never owed on (mutants: the debt unread at the load, a built pixel owed)', async () => {
  const { restorePlayer, snapshotPlayer } = await import('../../../src/systems/save/save.js');
  clearPadsOwed();
  owePads('9,9');   // the session before the load
  padsOwedBuilt((k) => k === '4,4');
  const entity = { name: 'Owed', stats: {}, items: [], spells: [], activeEffects: [], skills: {} };
  const snap = { ...snapshotPlayer(entity, {}), padsOwed: ['3,3', '4,4'] };
  restorePlayer({}, snap);
  assert.deepEqual(padsOwed(), ['3,3'], 'the save\'s debt, the built pixel left to its re-stand');
  assert.equal(savedPadsOwed('4,4') && savedPadsOwed('3,3'), true, 'its records on both re-stand by the carve');
  clearPadsOwed();
});

test('OWED a record written on carved ground owes nothing: an anchor, a deck or a cached pile, stamped with the law by number, never reads the last save\'s debt (mutant: the debt read for every stamp)', () => {
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  const law = recordFrame({ landform: false, liftAt: () => 0, heightAt: () => 100, state, bayAt: () => false, padsMovedAt: () => -3, owesAt: () => true, readOwed: () => {} });
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, PADS_FRAME_LAW), 101, 'an anchor written under the carve law');
  assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, { groundFrame: PADS_FRAME_LAW, padsOwed: ['0,0'] }), 98, 'the save\'s own record');
});

test('OWED the carve is read as the ground is drawn: the two triangles of each quad, never a bilinear blend (mutant: the bilinear read)', async () => {
  const { settlementMovedAt } = await import('../../../src/world/settlement/settlementStand.js');
  const { surfaceHeightAt } = await import('../../../src/world/terrain/terrainSurface.js');
  const { MAX_TERRAIN_HEIGHT } = await import('../../../src/world/terrain/terrainSampler.js');
  const D = HEIGHTMAP_DIMENSION, cell = TERRAIN_SIZE / (D - 1), moved = new Float32Array(D * D);
  for (let i = 0; i < moved.length; i++) moved[i] = ((i * 7919) % 13) - 6;   // a rough field
  const ground = Float32Array.from(moved, (v) => v / MAX_TERRAIN_HEIGHT);
  for (const [x, z] of [[cell * 0.5, cell * 0.5], [cell * 10.3, cell * 4.8], [cell * 60.9, cell * 61.2], [cell * 127.6, cell * 3.1]]) {
    assert.ok(Math.abs(settlementMovedAt({ moved }, [0, 0, 0], x, z, cell) - surfaceHeightAt(ground, x, z)) < 1e-4, `${x}, ${z}`);
  }
});

test('OWED only a pixel\'s first build rides its debt; a rebuild pays it, its own ride carrying what lies there (by source; mutant: a rebuild riding twice)', () => {
  assert.match(read('scenes/pixelBuild.js'), /if \(host\.rideGround && payPads\(pkey\) && !groundWas && owedTown\?\.moved\) \{/);
  assert.match(read('world/settlement/settlementOwed.js'), /for \(const key of list\) if \(!builtNow\(key\)\) owed\.add\(key\);/);
  assert.match(read('scenes/groundFrameHost.js'), /padsOwedBuilt\(\(key\) => built\.has\(key\)\);/);
  assert.match(read('scenes/shipBoardHost.js'), /\|\| landform \|\| !\(t\.restore\?\.groundFrame >= RECORD_GROUND_STAMP\.groundFrame\)\)\) \{/, 'a deck of an older frame stood again with the row off');
});

test('OWED a new world forgets the last one\'s save: its saved debt and the save it read; a save read again after it is read afresh; a pixel built when its save loads is never owed (mutants: the saved debt kept, the read save kept, the built pixel owed)', () => {
  clearPadsOwed();
  const save = { padsOwed: ['4,4', '5,5'] };
  padsOwedBuilt((key) => key === '5,5');
  padsOwedFrom(save);
  assert.deepEqual(padsOwed(), ['4,4'], 'its built pixel paid as its records re-stand');
  assert.ok(savedPadsOwed('5,5'), 'though its records were written without the carve');
  clearPadsOwed();
  assert.ok(!savedPadsOwed('4,4') && !savedPadsOwed('5,5'), 'the old save\'s debt gone with its world');
  padsOwedFrom(save);
  assert.deepEqual(padsOwed(), ['4,4', '5,5'], 'the same save read again in the new world, nothing built in it yet');
  clearPadsOwed();
});

test('OWED the frame\'s law past the law and with the Landforms row on: a save stamped before the carve law rides it everywhere; the row on, the carve rides as it does off (mutants: an old envelope\'s law unread, the row\'s branch unridden)', () => {
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  for (const landform of [false, true]) {
    const law = recordFrame({ landform, liftAt: () => 0, heightAt: () => NaN, state, bayAt: () => false, padsMovedAt: () => -2.5, owesAt: () => false, readOwed: () => {} });
    assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, { groundFrame: PADS_FRAME_LAW - 1, padsOwed: [] }), 101 - 2.5, `row ${landform}: an old save owes its carve wherever it stood`);
    assert.equal(law.restandHeight(101, 0, 0, STREAMING_TERRAIN_SCALE, { groundFrame: PADS_FRAME_LAW, padsOwed: [] }), 101, `row ${landform}: a new one only where it owed it`);
  }
});

test('OWED the frame host reads the build\'s move at its own pixel\'s place, cell by cell: an origin a pixel off, a field that differs east and north (mutants: the translation, the cell, the axes)', () => {
  setTamrielFit(null);
  const row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row), key = `${px},${py}`, D = HEIGHTMAP_DIMENSION, cell = TERRAIN_SIZE / (D - 1);
  const { frame, built } = world([px - 1, py + 1]);
  const moved = Float32Array.from({ length: D * D }, (_, i) => Math.floor(i / D) + 1000 * (i % D));
  built.set(key, { settlement: { moved } });
  const at = (x, y) => frame.padsMovedAt(TERRAIN_SIZE + x * cell, TERRAIN_SIZE + y * cell);
  assert.ok(Math.abs(at(3, 7) - (3 + 7000) * STREAMING_TERRAIN_SCALE) < 1e-3, 'its sample three east, seven north');
  assert.ok(Math.abs(at(7, 3) - (7 + 3000) * STREAMING_TERRAIN_SCALE) < 1e-3, 'and the other way about');
  assert.equal(frame.padsMovedAt(3 * cell, 7 * cell), 0, 'the pixel west of it stands no settlement');
  clearPadsOwed();
});
