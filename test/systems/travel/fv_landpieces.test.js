// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - the land's pieces kept across
// launches (systems/travel/landPiecesKept.js, fetched by livingWorld/ways.js for each network). Held here: kept pieces
// are adopted and equal the ones the fold makes, so no fold runs on the second launch; another ground or network refuses
// them; a malformed record is refused; and the way book waits on the fetch, then plans on the adopted pieces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeGround, planRoute } from '../../../src/systems/travel/travelRoute.js';
import { keepLandPieces, landPiecesKey } from '../../../src/systems/travel/landPiecesKept.js';
import { createWayBook } from '../../../src/systems/livingWorld/ways.js';

const W = 40, H = 24;
/** An island split by a strait at x 20, a road across one row of it. */
const heightOf = (x, y) => (x === 20 && y > 3 ? 0 : x < 2 || y < 2 || x >= W - 2 || y >= H - 2 ? 0 : 30);
const groundOf = (h = heightOf) => routeGround(() => 0, h, 10, W, H);
const ROADS = new Uint8Array(W * H);
function storeOf() {
  const m = new Map();
  return { m, async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, structuredClone(v)); return true; } };
}
/** A ground whose fold is counted. */
function counted(g) {
  const landPieces = g.landPieces;
  const c = Object.assign(g, { folds: 0 });
  c.landPieces = (r, t) => { c.folds++; return landPieces(r, t); };
  return c;
}

test('FIRST-VISIT land pieces: the second launch adopts the kept pieces - equal to the fold\'s - and folds nothing (mutant: the hit ignored)', async () => {
  const store = storeOf();
  const first = counted(groundOf());
  assert.equal(await keepLandPieces(first, { roads: ROADS }, store), false);
  assert.equal(first.folds, 1);
  const second = counted(groundOf());
  assert.equal(await keepLandPieces(second, { roads: ROADS }, store), true);
  assert.deepEqual(second.landPieces(ROADS, null), first.landPieces(ROADS, null));
  assert.equal(second.folds, 1, 'the one fold is the comparison\'s ask, answered from the adopted pieces');
  const from = { x: 5, y: 10 }, to = { x: 30, y: 10 };
  assert.equal(second.apart(from, to, { roads: ROADS }), first.apart(from, to, { roads: ROADS }));
});

test('FIRST-VISIT land pieces: another ground, another network or a malformed record refuses the kept pieces (mutants: a byte left out of the stamp; any record adopted)', async () => {
  const store = storeOf();
  await keepLandPieces(groundOf(), { roads: ROADS }, store);
  const raised = groundOf((x, y) => (x === 20 && y === 12 ? 30 : heightOf(x, y)));
  assert.notEqual(landPiecesKey(raised, ROADS, null), landPiecesKey(groundOf(), ROADS, null));
  assert.equal(await keepLandPieces(raised, { roads: ROADS }, store), false);
  const road = new Uint8Array(ROADS); road[10 * W + 19] = 1;
  assert.equal(await keepLandPieces(groundOf(), { roads: road }, store), false);
  const key = landPiecesKey(groundOf(), ROADS, null);
  store.m.set(key, new Int32Array(7));
  assert.equal(await keepLandPieces(groundOf(), { roads: ROADS }, store), false);
  assert.equal(store.m.get(key).length, W * H, 'the refused record is replaced by the fold');
});

test('FIRST-VISIT land pieces: no store, nothing to wait for; the way book waits on the fetch, then plans (mutant: the book plans before the pieces are in)', async () => {
  assert.equal(keepLandPieces(groundOf(), { roads: ROADS }, null), null);
  const store = storeOf();
  const ground = groundOf();
  const net = { roads: ROADS, tracks: null };
  const book = createWayBook({ roads: () => net, ground: () => ground, plan: planRoute, keep: (g, raw) => keepLandPieces(g, raw, store) });
  const a = { mapId: 1, px: 5, py: 10 }, b = { mapId: 2, px: 15, py: 10 };
  assert.equal(book.wayOf(a, b), undefined, 'waiting on the fetch');
  await book.keeping;
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(book.keeping, null);
  book.frame();
  assert.ok(book.wayOf(a, b)?.pixels.length > 0, 'planned once the pieces are in');
});
