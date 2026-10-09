// FIELD BUGS 2026-10-09b - ROCK-NEAR, the Discord's "Motherlode ore veins can spawn inside rocks! Which thus renders them
// unmineable!"
//
// A node was asked only of its OWN pixel's rock pieces (world.js pixelRocks, VEIN-CLEAR, NODE-CLEAR), and a World of
// Daggerfall field's pieces are hills scaled by hundreds that reach far past their pixel's edge (FOOT_INSET_M says so):
// a Motherlode, a vein, a boulder's foot, a herb patch or a tree stood under a NEIGHBOUR's piece - lit, on the compass,
// and past every look (gatherHost.js findTarget's ray is the rock's). The gathering host now hands every kind the
// pieces its eight built neighbours stand that reach in (nearRocks, in the pixel's own frame), and a neighbour built
// after stands its reached pixels again. The Motherlode's heart, stood unasked before standAnywhere, is asked too.
// `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundAt, insideRocks } from '../src/world/terrainNature.js';
import { standMotherlodes, standMineNodes, mineKind } from '../src/scenes/mineHost.js';
import { createGatherHost } from '../src/scenes/gatherHost.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const T = TERRAIN_SIZE;
const WOODS = CLIMATES.Woodlands, MOUNTAIN = CLIMATES.Mountain, GLENUMBRA = 59;
const PX = 405, PY = 150, DAY = 20500;
const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
const G = groundAt(samples, 400, 400);
const grass = new Uint8Array(128 * 128).fill(2);
const stone = new Uint8Array(128 * 128).fill(3);
/** A piece of the EAST neighbour's field, in the neighbour's own frame, reaching four fifths of the way across this pixel. */
const EAST_PIECE = [-0.8 * T, G, 0, 10, G + 60, T];
/** The same piece in this pixel's frame (the neighbour stands one pixel east: +T in x). */
const REACHED = [0.2 * T, G, 0, T + 10, G + 60, T];
const LODE = { key: 'ml:405:150:1', k: 1, material: 4 };

test('ROCK-NEAR: a Motherlode is never stood inside a neighbour\'s piece that reaches in - not at its heart, not on the stone nearest it; its own pixel\'s pieces are still the ones it stands beside (mutants: the heart unasked; the neighbours\' pieces unasked)', () => {
  for (const tilemap of [grass, stone]) {
    const [lode] = standMotherlodes({ lodes: [LODE], samples, tilemap, rocks: [], near: [REACHED] });
    assert.ok(lode, 'it stands');
    assert.equal(insideRocks([REACHED], lode.local[0], lode.local[2]), false, `outside the reaching piece (${lode.local[0].toFixed(1)}, ${lode.local[2].toFixed(1)})`);
    assert.ok(lode.local[0] >= 0 && lode.local[0] <= T && lode.local[2] >= 0 && lode.local[2] <= T, 'on its own pixel');
    assert.equal(lode.rock, null, 'never beside a neighbour\'s piece');
  }
  // without the neighbour the heart holds it, as it did
  const [alone] = standMotherlodes({ lodes: [LODE], samples, tilemap: grass, rocks: [] });
  assert.equal(insideRocks([REACHED], alone.local[0], alone.local[2]), true, 'the heart is under the reaching piece');
});

test('ROCK-NEAR: no vein or boulder\'s foot stands inside a neighbour\'s piece that reaches in (mutant: the stone asked of its own pieces alone)', () => {
  let veins = 0;
  for (let day = DAY; day < DAY + 40; day++) {
    for (const n of standMineNodes({ px: PX, py: PY, day, climate: MOUNTAIN, region: GLENUMBRA, samples, tilemap: stone, rocks: [[0.05 * T, G, 0.4 * T, 0.15 * T, G + 5, 0.5 * T]], near: [REACHED] })) {
      if (n.what === 'vein') veins++;
      assert.equal(insideRocks([REACHED], n.local[0], n.local[2]), false, `${n.key} outside the reaching piece`);
    }
  }
  assert.ok(veins > 0, 'veins stood to be asked');
});

test('ROCK-NEAR: the real gathering host hands the neighbours\' pieces in, in the pixel\'s own frame, and stands a pixel again when a neighbour whose pieces reach it is built after it (mutants: never handed; the offset unturned; the neighbour never stood again)', async () => {
  const book = { state: { open: true, today: {}, caps: { stores: 5000 } }, stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }),
    askPixels: async () => [], pump: () => {}, dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}) };
  const lodes = { standingOn: (x, y) => (x === PX && y === PY ? [LODE] : []), found: () => false };
  const here = { px: PX, py: PY, samples, tilemap: grass, locationRect: null, batches: [], rocks: [] };
  const east = { px: PX + 1, py: PY, samples, tilemap: grass, locationRect: null, batches: [], rocks: [EAST_PIECE] };
  const built = new Map();
  const host = createGatherHost({
    book, kinds: [mineKind({ book, lodes })], hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = x * T; out[1] = 0; out[2] = -y * T; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => (DAY * 86_400 + 43_200) * 1000, eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [] }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true,
  });
  const lodeHere = () => host.nodesOf(PX, PY).find((n) => n.what === 'motherlode');
  const settle = async () => { await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); };
  try {
    // this pixel first: its neighbour unbuilt, its piece neither drawn nor solid - the heart holds the Motherlode
    built.set(`${PX},${PY}`, here);
    host.onBuilt(here);
    await settle();
    assert.equal(insideRocks([REACHED], lodeHere().local[0], lodeHere().local[2]), true, 'under where the piece will stand');
    // the east neighbour built: its piece reaches in, and this pixel is stood again outside it
    built.set(`${PX + 1},${PY}`, east);
    host.onBuilt(east);
    await settle();
    assert.equal(insideRocks([REACHED], lodeHere().local[0], lodeHere().local[2]), false, 'stood again, outside the neighbour\'s piece');
    // the neighbour's piece on its north side instead (+z here is north: the pixel north is py - 1) - the frame turned
    const north = { ...east, px: PX, py: PY - 1, rocks: [[0, G, -0.8 * T, T, G + 60, 10]] };
    built.delete(`${PX + 1},${PY}`);
    built.set(`${PX},${PY - 1}`, north);
    host.onBuilt(north);
    await settle();
    assert.equal(insideRocks([[0, G, 0.2 * T, T, G + 60, T + 10]], lodeHere().local[0], lodeHere().local[2]), false, 'outside the north neighbour\'s piece, in this pixel\'s frame');
  } finally { host.dispose(); }
});
