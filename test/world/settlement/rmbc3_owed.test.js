// THE CARVE UNDER A RECORD. No record's height carries a settlement's carve: the frame host takes the carve's move under
// it off as it writes and puts its pixel's build's move back on as it re-stands, so a save reads right whichever row
// loads it. A record re-stood on a settlement's pixel not built stands without the move, its pixel owed, and the build
// pays it; a pixel streamed out keeps its last build's move for the records still on it. A Hammerfell settlement, a Bay
// village, and a grown village on both rows of the kernel. Pins mutation-checked (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { owePads, payPads, padsOwedAt, padsOwed, padsOwedFrom, clearPadsOwed, padsOwedBuilt, owedEpoch, keepCarve, carveKept, cropMoved } from '../../../src/world/settlement/settlementOwed.js';
import { recordFrame, createGroundFrame } from '../../../src/scenes/groundFrameHost.js';
import { SETTLEMENT_ROWS, settlementPixel } from '../../../src/world/settlement/settlementPlaces.js';
import { settlementMovedAt } from '../../../src/world/settlement/settlementStand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, GROUND_FRAME_LAW, MAX_TERRAIN_HEIGHT } from '../../../src/world/terrain/terrainSampler.js';

const read = (f) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');
const D = HEIGHTMAP_DIMENSION, CELL = TERRAIN_SIZE / (D - 1);

test('OWED the ledger: a pixel owed until paid, listed sorted; a load begins it afresh, once a save; a new world forgets it (mutants: begun twice, the debt kept through a load, the read save kept)', () => {
  clearPadsOwed();
  owePads('20,5');
  owePads('-3,7');
  assert.deepEqual(padsOwed(), ['-3,7', '20,5']);
  assert.equal(payPads('20,5'), true);
  assert.equal(payPads('20,5'), false, 'paid once');
  assert.equal(padsOwedAt('-3,7'), true);
  const save = { groundFrame: GROUND_FRAME_LAW }, begun = owedEpoch();
  padsOwedFrom(save);
  assert.deepEqual(padsOwed(), [], 'a load\'s records replace whatever stood');
  assert.equal(owedEpoch(), begun + 1);
  owePads('9,9');   // owed while the same save re-stands: its next re-stand keeps it
  padsOwedFrom(save);
  assert.deepEqual(padsOwed(), ['9,9']);
  assert.equal(owedEpoch(), begun + 1, 'begun once a save');
  padsOwedFrom(null);
  assert.equal(owedEpoch(), begun + 1, 'no save, no load');
  clearPadsOwed();
  assert.equal(owedEpoch(), begun + 2, 'a new world moves the count too');
  assert.deepEqual(padsOwed(), []);
  padsOwedFrom(save);
  assert.equal(owedEpoch(), begun + 3, 'the same save read again in a new world is read afresh');
  clearPadsOwed();
});

test('OWED a kept carve: cropped to what it moved, read as the whole field was; kept through a load only where its pixel stands built; gone with a new world or a build that carved nothing (mutants: the crop, kept through every load, kept by none, the new world keeping it)', () => {
  clearPadsOwed();
  const moved = new Float32Array(D * D);
  for (let x = 10; x <= 14; x++) for (let y = 30; y <= 33; y++) moved[x * D + y] = x - y / 10;
  const box = cropMoved(moved, D);
  assert.deepEqual([box.x0, box.y0, box.x1, box.y1, box.field.length], [10, 30, 14, 33, 20]);
  assert.equal(cropMoved(new Float32Array(D * D), D), null, 'nothing moved');
  for (const [x, z] of [[11.3 * CELL, 31.6 * CELL], [9.5 * CELL, 30.2 * CELL], [14.9 * CELL, 33.9 * CELL], [12.2 * CELL, 33.7 * CELL], [60 * CELL, 60 * CELL]]) {
    assert.equal(settlementMovedAt({ box }, [0, 0, 0], x, z, CELL), settlementMovedAt({ moved }, [0, 0, 0], x, z, CELL), `${x}, ${z}`);
  }
  keepCarve('1,1', moved, D);
  keepCarve('2,2', moved, D);
  assert.deepEqual(carveKept('1,1'), box);
  padsOwedBuilt((key) => key === '2,2');
  padsOwedFrom({ groundFrame: GROUND_FRAME_LAW });
  assert.equal(carveKept('1,1'), null, 'streamed out before the load: no record of it stands there');
  assert.deepEqual(carveKept('2,2'), box, 'built through the load: its records stood again on it');
  keepCarve('2,2', null, D);
  assert.equal(carveKept('2,2'), null, 'rebuilt with no carve');
  keepCarve('3,3', moved, D);
  clearPadsOwed();
  assert.equal(carveKept('3,3'), null, 'a new world');
});

test('OWED the frame\'s law: the carve taken off as a record is written, never owing a pixel, and put back as one re-stands whatever its stamp; a save\'s envelope begins the ledger (mutants: the carve left on, put back by law, the envelope unread)', () => {
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  const reads = [], owes = [];
  for (const landform of [false, true]) {
    const law = recordFrame({ landform, liftAt: () => 0, heightAt: () => NaN, state, bayAt: () => false, padsMovedAt: (x, z, owe = true) => { owes.push(owe); return -2.5; }, readOwed: (s) => reads.push(s) });
    const save = { groundFrame: GROUND_FRAME_LAW };
    assert.equal(law.groundFrameHeight(101, 0, 0), 103.5, `row ${landform}: written off the carve`);
    assert.equal(law.restandHeight(103.5, 0, 0, STREAMING_TERRAIN_SCALE, save), 101, `row ${landform}: a save's record`);
    assert.equal(law.restandHeight(103.5, 0, 0, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW), 101, `row ${landform}: an anchor, a deck, a cached pile`);
    assert.equal(law.restandHeight(103.5, 0, 0, STREAMING_TERRAIN_SCALE, null), 101, `row ${landform}: a record before the stamp`);
  }
  assert.deepEqual(owes, [false, true, true, true, false, true, true, true]);
  assert.ok(reads.length === 2 && reads.every((s) => s.groundFrame === GROUND_FRAME_LAW), 'the save\'s envelope handed to the ledger');
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
    _liftLocationAt: placeAt, blocks: null, built, heightAt: () => NaN, heightCell: CELL, landform: false,
    landformsHere: () => null, beyondSites: { generation: () => 0, beyond: () => null }, maps: null, terrainGen: { roads: () => null },
    get state() { return state; }, get woods() { return {}; },
  });
  return { frame, built };
}

test('OWED the frame host: a settlement\'s pixel never built owes its carve as a record re-stands, never as one is written; built, its build\'s own move, paid; streamed out, its kept move, owing nothing; a pixel no settlement stands on owes nothing - past the Bay and on it (mutants: never owed, owed by a write, the grown town never owed, the kept move unread, a new world owing the old one\'s)', () => {
  setTamrielFit(null);
  const row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row), key = `${px},${py}`;
  owePads('77,77');   // a world before this one's debt
  const { frame, built } = world([px, py]);
  assert.deepEqual(padsOwed(), [], 'a new world owes nothing');
  assert.equal(frame.groundFrameHeight(50, 100, 100), 50, 'written before its pixel ever stood');
  assert.deepEqual(padsOwed(), [], 'a write owes nothing');
  assert.equal(frame.padsMovedAt(100, 100), 0);
  assert.deepEqual(padsOwed(), [key], 'Sahr Waters\' pixel owed');
  const moved = new Float32Array(D * D).fill(2);
  built.set(key, { settlement: { moved } });
  assert.ok(Math.abs(frame.padsMovedAt(100, 100) - 2 * STREAMING_TERRAIN_SCALE) < 1e-6, 'its build\'s own move');
  assert.deepEqual(padsOwed(), [], 'and paid');
  keepCarve(key, moved, D);
  built.delete(key);   // streamed out
  assert.ok(Math.abs(frame.padsMovedAt(100, 100) - 2 * STREAMING_TERRAIN_SCALE) < 1e-6, 'its kept move');
  assert.ok(Math.abs(frame.groundFrameHeight(50, 100, 100) - (50 - 2 * STREAMING_TERRAIN_SCALE)) < 1e-6, 'a record still on it written off the kept carve');
  assert.deepEqual(padsOwed(), [], 'nothing owed there');
  assert.equal(frame.padsMovedAt(100 + TERRAIN_SIZE, 100), 0, 'the next pixel east');
  assert.deepEqual(padsOwed(), [], 'no settlement there, nothing owed');
  const village = { mapTableData: { mapId: 5101, locationType: 2 }, name: 'Owedale', regionIndex: 17 }, dungeon = { mapTableData: { mapId: 5102, locationType: 7 }, name: 'Pit' };
  const bay = world([200, 200], (x) => (x === 200 ? village : x === 201 ? dungeon : null));
  assert.equal(carveKept(key), null, 'the old world\'s kept carve gone');
  bay.frame.padsMovedAt(10, 10);
  bay.frame.padsMovedAt(10 + TERRAIN_SIZE, 10);
  assert.deepEqual(padsOwed(), ['200,200'], 'a Bay village that grows is owed, a dungeon is not');
  bay.built.set('200,200', { settlement: { moved: new Float32Array(D * D).fill(-1) } });
  assert.ok(Math.abs(bay.frame.restandHeight(50, 10, 10, STREAMING_TERRAIN_SCALE, { groundFrame: GROUND_FRAME_LAW }) - (50 - STREAMING_TERRAIN_SCALE)) < 1e-6, 'its record stands on the carve its build hands back');
  assert.equal(bay.frame.restandHeight(50, 10 + TERRAIN_SIZE, 10, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW), 50, 'the dungeon\'s stands as written');
  clearPadsOwed();
});

test('OWED the frame host reads the build\'s move at its own pixel\'s place, cell by cell: an origin a pixel off, a field that differs east and north (mutants: the translation, the cell, the axes)', () => {
  setTamrielFit(null);
  const row = SETTLEMENT_ROWS[1], [px, py] = settlementPixel(row), key = `${px},${py}`;
  const { frame, built } = world([px - 1, py + 1]);
  const moved = Float32Array.from({ length: D * D }, (_, i) => Math.floor(i / D) + 1000 * (i % D));
  built.set(key, { settlement: { moved } });
  const at = (x, y) => frame.padsMovedAt(TERRAIN_SIZE + x * CELL, TERRAIN_SIZE + y * CELL);
  assert.ok(Math.abs(at(3, 7) - (3 + 7000) * STREAMING_TERRAIN_SCALE) < 1e-3, 'its sample three east, seven north');
  assert.ok(Math.abs(at(7, 3) - (7 + 3000) * STREAMING_TERRAIN_SCALE) < 1e-3, 'and the other way about');
  assert.equal(frame.padsMovedAt(3 * CELL, 7 * CELL), 0, 'the pixel west of it stands no settlement');
  clearPadsOwed();
});

test('OWED the carve is read as the ground is drawn: the two triangles of each quad, never a bilinear blend (mutant: the bilinear read)', async () => {
  const { surfaceHeightAt } = await import('../../../src/world/terrain/terrainSurface.js');
  const moved = new Float32Array(D * D);
  for (let i = 0; i < moved.length; i++) moved[i] = ((i * 7919) % 13) - 6;   // a rough field
  const ground = Float32Array.from(moved, (v) => v / MAX_TERRAIN_HEIGHT);
  for (const [x, z] of [[CELL * 0.5, CELL * 0.5], [CELL * 10.3, CELL * 4.8], [CELL * 60.9, CELL * 61.2], [CELL * 127.6, CELL * 3.1]]) {
    assert.ok(Math.abs(settlementMovedAt({ moved }, [0, 0, 0], x, z, CELL) - surfaceHeightAt(ground, x, z)) < 1e-4, `${x}, ${z}`);
  }
});

test('OWED the wiring (by source): a save carries no debt and its load begins the ledger; each load re-stand passes the save\'s stamp; every height stood again, the row off too; a build keeps its carve and pays a debt with its own move once, a rebuild within one load riding its kept ground instead (mutants: each seam)', () => {
  const save = read('systems/save/save.js'), world = read('scenes/world.js'), build = read('scenes/pixelBuild.js'), ship = read('scenes/shipBoardHost.js');
  assert.match(save, /groundFrame: GROUND_FRAME_LAW \};/);
  assert.match(save, /padsOwedFrom\(extras\);/);
  assert.equal(world.match(/restandHeight\([^)]*, extras\)/g)?.length, 3, 'the camps, the save\'s rows and its player');
  assert.ok(!/padsOwed/.test(world), 'no host line reads a debt');
  assert.match(ship, /if \(localPos && !legacy\) \{/, 'a deck stood again with the row off');
  assert.match(build, /const kept = _groundBefore\.get\(pkey\), groundWas = kept && KEPT_UNDER\.get\(kept\) === owedEpoch\(\) \? kept : null;/, 'ground kept from before a load is dropped');
  assert.match(build, /KEPT_UNDER\.set\(built\.get\(pkey\)\.samples, owedEpoch\(\)\);\n\s+keepCarve\(pkey, owedTown\?\.moved, HEIGHTMAP_DIMENSION\);/, 'each build\'s ground stamped, its carve kept');
  assert.match(build, /if \(host\.rideGround && payPads\(pkey\) && !groundWas && owedTown\?\.moved\) \{[^\n]*\n\s+const origin = host\.state\.pixelTranslation\(px, py\);\n\s+host\.rideGround\(origin, pkey, \(x, z\) => settlementMovedAt\(owedTown, origin, x, z, TERRAIN_SIZE \/ \(HEIGHTMAP_DIMENSION - 1\)\), key !== pkey\);/);
  assert.match(read('scenes/groundFrameHost.js'), /padsOwedBuilt\(\(key\) => built\.has\(key\)\);/);
});

test('OWED the row toggled: a grown village\'s doorsteps written with the Landforms row on stand on the ground the row off draws, and back - each at its own height over it (mutants: the carve left on a record, put back by the other row\'s move)', async () => {
  const { grow } = await import('../../groundPrintTown.mjs');
  const { dressSettlement } = await import('../../../src/world/settlement/settlementGen.js');
  const on = grow({ landform: true }), off = grow({ landform: false });
  const U = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, idx = (x, z) => Math.round(x / CELL) * D + Math.round(z / CELL);
  const uncarved = (b, i) => (b.samples[i] - b.settlement.moved[i] / MAX_TERRAIN_HEIGHT) * U;
  const liftAt = (x, z) => uncarved(on, idx(x, z)) - uncarved(off, idx(x, z));   // the two kernels' grounds apart before the carve
  const state = { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z] };
  const frameOf = (b, landform) => recordFrame({ landform, liftAt, heightAt: (x, z) => b.samples[idx(x, z)] * U, state, bayAt: () => true, padsMovedAt: (x, z) => b.settlement.moved[idx(x, z)] * STREAMING_TERRAIN_SCALE });
  const rowOn = frameOf(on, true), rowOff = frameOf(off, false);
  const plan = dressSettlement(on.settlement.input, on.settlement.layout, { check: false }).plan;
  let carved = 0;
  for (const b of plan.buildings) {
    const e = b.entrances[0], r = e.facing * Math.PI / 180, x = e.at[0] + Math.sin(r) * 1.5, z = e.at[1] + Math.cos(r) * 1.5, i = idx(x, z);
    if (on.settlement.moved[i] !== off.settlement.moved[i]) carved++;
    const ground = (b) => b.samples[i] * U;
    assert.ok(Math.abs(rowOff.restandHeight(rowOn.groundFrameHeight(ground(on) + 0.7, x, z), x, z, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW) - (ground(off) + 0.7)) < 1e-3, `on to off at ${b.id}`);
    assert.ok(Math.abs(rowOn.restandHeight(rowOff.groundFrameHeight(ground(off) + 0.7, x, z), x, z, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW) - (ground(on) + 0.7)) < 1e-3, `off to on at ${b.id}`);
  }
  assert.ok(carved > plan.buildings.length / 3, `${carved} of ${plan.buildings.length} doorsteps on ground the two rows carve apart`);
});
