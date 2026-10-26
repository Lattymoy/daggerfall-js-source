// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md YC1) - THE PAGE'S YARDS, ASKED AND STOOD A BLOCK AT A TIME.
// Over the real cell sync (scenes/yardCellSync.js) and the real yards host (scenes/homeYards.js): only the cells that
// hold a listed home within reach are asked, nearest town first; a poll sends the versions held and keeps what did not
// move; no poll goes while the yards cannot be seen, but a cell coming into reach is asked; a cell out of reach is let
// go; a failure backs off; and strangers' yards stand nearest first on the frame's budget, the owner's never waiting.
// Replaces YARD-TOWN's four-a-frame test (yardtown.test.js) and YARD-SHED's client tests (yardshed.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createYardCellSync, YARD_TOWN_TTL_MS, YARD_RETRY_MS, YARD_RETRY_MAX_MS, yardRetryMs, YARD_ASK_M, YARD_KEEP_MARGIN_M } from '../../src/scenes/yardCellSync.js';
import { createHomeYards, YARD_STAND_BUDGET_MS, YARD_SYNC_S } from '../../src/scenes/homeYards.js';
import { yardCellOf } from '../../src/net/yardCellLaw.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';
import { settle } from '../decorFakes.mjs';

const piece = (id) => ({ id, model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });

/** A fake cell route over `cellsOf(mapId)` - { [cell]: { ver, yards } } - recording each request. */
function cellRoute(cellsOf, { failing = () => false } = {}) {
  const asked = [];
  const yardCells = async (mapId, cells) => {
    asked.push({ mapId, cells: cells.map((pair) => [...pair]) });
    if (failing(mapId)) return { ok: false, error: 'server' };
    const town = cellsOf(mapId);
    const out = [];
    for (const [cell, have] of cells) {
      const held = town[cell];
      if (held && held.ver > have) out.push({ cell, ver: held.ver, yards: held.yards });
    }
    return { ok: true, data: { mapId, cells: out, more: [] } };
  };
  return { yardCells, asked };
}

test('YARD-CELL the sync asks the cells it is given within YARD_ASK_M, nearest town first, nearest cell first; a cell held past the reach but inside the margin is kept, one past it let go (mutants: the reach, the town order, the margin)', async () => {
  const a = makeBuildingKey(1, 1, 1);
  const b = makeBuildingKey(4, 4, 1);
  const route = cellRoute(() => ({ [yardCellOf(a)]: { ver: 3, yards: [{ buildingKey: a, pieces: [piece('a')] }] }, [yardCellOf(b)]: { ver: 1, yards: [] } }));
  const sync = createYardCellSync({ api: route, now: () => 0 });
  sync.update([
    { mapId: 8, cell: yardCellOf(b), distance: 200 },
    { mapId: 7, cell: yardCellOf(b), distance: 120 },
    { mapId: 7, cell: yardCellOf(a), distance: 40 },
    { mapId: 9, cell: yardCellOf(a), distance: YARD_ASK_M + 1 },
  ]);
  await settle();
  assert.deepEqual(route.asked.map((r) => r.mapId), [7, 8], 'the nearer town first; a town only past the reach not asked');
  assert.deepEqual(route.asked[0].cells, [[yardCellOf(a), 0], [yardCellOf(b), 0]], 'its nearest cell first, no version held');
  assert.deepEqual(sync.piecesOf(7, a).map((p) => p.id), ['a']);
  assert.deepEqual(sync.piecesOf(7, makeBuildingKey(1, 1, 9)), null, 'a home of the cell with no yard: none');
  sync.update([{ mapId: 7, cell: yardCellOf(a), distance: YARD_ASK_M + YARD_KEEP_MARGIN_M - 1 }]);
  assert.ok(sync.piecesOf(7, a), 'inside the margin: kept');
  sync.update([{ mapId: 7, cell: yardCellOf(b), distance: 10 }]);
  assert.equal(sync.piecesOf(7, a), null, 'out of reach while its town is in it: that cell let go');
  sync.update([]);
  assert.equal(sync.piecesOf(7, a), null, 'out of every wish: let go');
});

test('YARD-CELL a poll every YARD_TOWN_TTL_MS sends the versions held and keeps the cells that did not move; a version older than one held never takes a cell back (mutants: the versions unsent, the TTL, the older version believed)', async () => {
  const a = makeBuildingKey(2, 2, 1);
  const cell = yardCellOf(a);
  const town = { [cell]: { ver: 5, yards: [{ buildingKey: a, pieces: [piece('five')] }] } };
  const route = cellRoute(() => town);
  const clock = { t: 0 };
  const sync = createYardCellSync({ api: route, now: () => clock.t });
  const wish = [{ mapId: 7, cell, distance: 10 }];
  sync.update(wish);
  await settle();
  clock.t = YARD_TOWN_TTL_MS - 1;
  sync.update(wish);
  assert.equal(route.asked.length, 1, 'not due');
  clock.t = YARD_TOWN_TTL_MS;
  sync.update(wish);
  await settle();
  assert.deepEqual(route.asked[1].cells, [[cell, 5]], 'the version held sent');
  assert.deepEqual(sync.piecesOf(7, a).map((p) => p.id), ['five'], 'unchanged: kept');
  // a replica behind what the page holds answers an older version: never believed
  const answers = [{ cell, ver: 5, yards: [{ buildingKey: a, pieces: [piece('five')] }] }, { cell, ver: 4, yards: [] }];
  const stale = { yardCells: async () => ({ ok: true, data: { mapId: 7, cells: [answers.shift()], more: [] } }) };
  const behind = createYardCellSync({ api: stale, now: () => clock.t });
  behind.update(wish);
  await settle();
  clock.t += YARD_TOWN_TTL_MS;
  behind.update(wish);
  await settle();
  assert.deepEqual(behind.piecesOf(7, a).map((p) => p.id), ['five'], 'version 4 after 5: the page keeps 5');
  town[cell] = { ver: 6, yards: [{ buildingKey: a, pieces: [piece('six')] }] };
  clock.t = 2 * YARD_TOWN_TTL_MS;
  sync.update(wish);
  await settle();
  assert.deepEqual(sync.piecesOf(7, a).map((p) => p.id), ['six'], 'moved: the new answer');
});

test('YARD-CELL no poll goes while the yards cannot be seen - but a cell coming into reach is asked; the poll that came due meanwhile goes the moment they can (mutants: the poll unasked, the first ask held back)', async () => {
  const a = makeBuildingKey(1, 1, 1);
  const b = makeBuildingKey(6, 6, 1);
  const route = cellRoute(() => ({}));
  const clock = { t: 0 };
  const seen = { now: true };
  const sync = createYardCellSync({ api: route, now: () => clock.t, polling: () => seen.now });
  sync.update([{ mapId: 7, cell: yardCellOf(a), distance: 10 }]);
  await settle();
  seen.now = false;
  clock.t = 2 * YARD_TOWN_TTL_MS;
  sync.update([{ mapId: 7, cell: yardCellOf(a), distance: 10 }]);
  assert.equal(route.asked.length, 1, 'indoors: no poll');
  sync.update([{ mapId: 7, cell: yardCellOf(a), distance: 10 }, { mapId: 7, cell: yardCellOf(b), distance: 30 }]);
  await settle();
  assert.deepEqual(route.asked.at(-1).cells, [[yardCellOf(b), 0]], 'a cell new in reach is asked all the same - alone');
  seen.now = true;
  sync.update([{ mapId: 7, cell: yardCellOf(a), distance: 10 }, { mapId: 7, cell: yardCellOf(b), distance: 30 }]);
  await settle();
  assert.deepEqual(route.asked.at(-1).cells, [[yardCellOf(a), 0], [yardCellOf(b), 0]], 'back outside: the poll that came due goes at once');
});

test('YARD-CELL a failed ask backs off: each failure in a row doubles a town\'s wait from YARD_RETRY_MS, to YARD_RETRY_MAX_MS (mutants: the doubling, the cap, the count)', async () => {
  assert.deepEqual([1, 2, 3, 4].map(yardRetryMs), [YARD_RETRY_MS, 2 * YARD_RETRY_MS, 4 * YARD_RETRY_MS, 8 * YARD_RETRY_MS]);
  assert.equal(yardRetryMs(40), YARD_RETRY_MAX_MS);
  const route = cellRoute(() => ({}), { failing: (m) => m === 7 });
  const clock = { t: 0 };
  const sync = createYardCellSync({ api: route, now: () => clock.t });
  const wish = [{ mapId: 7, cell: 1, distance: 1 }];
  const step = async (ms) => { clock.t += ms; sync.update(wish); await settle(); };
  await step(0);
  assert.equal(route.asked.length, 1);
  await step(YARD_RETRY_MS);
  assert.equal(route.asked.length, 2, 'the first wait');
  await step(YARD_RETRY_MS);
  assert.equal(route.asked.length, 2, 'the second failure: twice the wait');
  await step(YARD_RETRY_MS);
  assert.equal(route.asked.length, 3);
});

/** Town pixels of strangers' homes, each with a yard of two pieces, and the owner's own - for the yards host. */
function townsRig({ towns = [{ mapId: 7, px: 0, homes: 7 }], feet = [0, 0, 10], ownAt = null, cost = YARD_STAND_BUDGET_MS / 3 } = {}) {
  const built = new Map();
  const pieces = new Map();
  for (const { mapId, px, homes } of towns) {
    const keys = Array.from({ length: homes }, (_, i) => makeBuildingKey(i % 8, Math.floor(i / 8), 1 + i));
    const frames = new Map(keys.map((k, i) => [k, { at: [20 * i, 0, 10], box: [20 * i - 4, 0, 7, 20 * i + 4, 6, 13] }]));
    built.set(`${px},0`, { px, py: 0, homeTown: mapId, homeFrames: frames, homeRegion: 17 });
    pieces.set(mapId, keys);
  }
  const asked = [];
  const api = {
    yardCells: async (mapId, cells) => {
      asked.push(mapId);
      const keys = pieces.get(mapId) ?? [];
      const out = cells.map(([cell]) => ({ cell, ver: 1, yards: keys.filter((k) => yardCellOf(k) === cell).map((k) => ({ buildingKey: k, pieces: [piece(`a${k}`), piece(`b${k}`)] })) }));
      return { ok: true, data: { mapId, cells: out, more: [] } };
    },
  };
  const homes = { homeAt: (m, k) => (pieces.get(m)?.includes(k) ? { owner: k === ownAt ? 'Olga' : `Stranger ${k}`, own: k === ownAt, look: null } : null) };
  const clock = { ms: 0 };
  const yards = createHomeYards({
    api, homes, built: () => built, translation: (px) => [px * 1000, 0, 0], feet: () => feet, outside: () => false, eye: () => [feet[0], 1.6, feet[2]],
    collider: () => ({ addMesh() {}, removeBucket() {} }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    character: () => 'r0123456789abcdef0123', realm: () => null, wallet: () => ({ gold: 0, pay() {}, credit() {} }), regionOf: () => 17,
    doc: null, win: null, canvas: null, touch: false, actionOf: () => null, locked: () => false, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
    standClock: () => (clock.ms += cost),
  });
  const stood = () => yards.yards().filter((y) => y.pool.size() > 0).map((y) => y.bk);
  return { yards, stood, asked, pieces };
}
const cam = { pos: [0, 1.6, 10], yaw: 0, pitch: 0 };
const FRAME_S = 1 / 60;

test('YARD-CELL strangers\' yards stand NEAREST FIRST while the frame\'s standing time is under YARD_STAND_BUDGET_MS - always one a frame, the next frame syncing again - and the owner\'s own never waits (mutants: the order, the budget unasked, the own yard waiting)', async () => {
  // homes 20 m apart along x, the player at the far end: the nearest are the last made
  const own = makeBuildingKey(0, 0, 1);
  const w = townsRig({ towns: [{ mapId: 7, px: 0, homes: 7 }], feet: [6 * 20, 0, 10], ownAt: own });
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle(); await settle();
  assert.deepEqual(w.stood(), [], 'nothing before the answer');
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  const keys = w.pieces.get(7);
  // the clock moves a third of the budget a reading: three strangers a frame, nearest first, and the owner's at once
  assert.deepEqual(w.stood().sort((a, b) => a - b), [own, keys[4], keys[5], keys[6]].sort((a, b) => a - b), 'the three nearest and the owner\'s - its home the farthest');
  w.yards.frame({ dt: FRAME_S, cam, overlayUp: false });
  assert.equal(w.stood().length, 7, 'the rest the next frame - never half a second later');
  assert.ok(FRAME_S < YARD_SYNC_S);
  for (const y of w.yards.yards()) assert.equal(y.pool.size(), 2, `yard ${y.bk} whole`);
  // a budget spent before the first stand still stands one
  const slow = townsRig({ towns: [{ mapId: 7, px: 0, homes: 3 }], feet: [0, 0, 10], cost: 10 * YARD_STAND_BUDGET_MS });
  slow.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle(); await settle();
  slow.yards.frame({ dt: 1, cam, overlayUp: false });
  assert.deepEqual(slow.stood(), [slow.pieces.get(7)[0]], 'one a frame at least - the nearest');
});

test('YARD-CELL the yards host asks only the cells that hold a listed home within reach, the nearer town first across a town\'s edge (mutants: an unlisted home asked, the town order)', async () => {
  // town 7's nearest home 495 m off, town 8's 485 m across the edge - both within YARD_ASK_M
  const w = townsRig({ towns: [{ mapId: 7, px: 0, homes: 2 }, { mapId: 8, px: 1, homes: 2 }], feet: [515, 0, 10] });
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle();
  assert.deepEqual(w.asked, [8, 7], 'the town across the edge is nearer: asked first');
  const none = townsRig({ towns: [{ mapId: 7, px: 0, homes: 2 }], feet: [0, 0, 10] });
  none.pieces.set(7, []);   // no home of the town listed
  none.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle();
  assert.deepEqual(none.asked, [], 'no listed home: nothing asked');
});
