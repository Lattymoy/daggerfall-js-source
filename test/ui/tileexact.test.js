// TILE-EXACT (2026-10-29, bible/03-World/Arena-Provinces.md TILE-EXACT): the land past the Bay's kept tiles are painted
// at the view's own scale and laid pixel for pixel, smoothing off. Painted a quarter-doubling off and resampled, every
// line past the Bay was soft against the Bay's own ink.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTamrielTiles, TILE_PX } from '../../src/ui/tamrielTiles.js';

/** A canvas whose context takes the calls a tile's paint makes. */
const canvas = () => ({ width: 0, height: 0, getContext: () => ({ setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {} }) });
/** A sheet that records each tile drawn on it, with the smoothing it was drawn under. */
function sheet() {
  const drawn = [];
  const ctx = { imageSmoothingEnabled: true, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {} };
  ctx.drawImage = (c, x, y, w, h) => drawn.push({ x, y, w, h, smooth: ctx.imageSmoothingEnabled });
  return { ctx, drawn };
}
const make = (painted = []) => createTamrielTiles({ paint: (c, v) => { painted.push(v.scale); }, stamp: () => 'w', make: canvas, now: () => 0 });

test('TILE-EXACT a view\'s tiles are painted at its own scale and laid pixel for pixel - whole device pixels, smoothing off, each neighbour TILE_PX on - at one and two device pixels a point (mutants: the level quantized again; smoothing left on; the origin snapped a tile at a time)', () => {
  for (const dpr of [1, 2]) {
    const painted = [], tiles = make(painted), s = sheet();
    const view = { ox: 17.37, oy: -301.61, scale: 1.3 };
    const o = { paperW: 900, paperH: 500, dpr, key: 'k' };
    for (let i = 0; i < 60; i++) tiles.draw(s.ctx, view, o);
    assert.ok(painted.length && painted.every((v) => v === 1.3), 'painted at 1.3, not a quarter-doubling');
    s.drawn.length = 0;
    tiles.draw(s.ctx, view, o);
    assert.equal(tiles.stats().painted, 0, 'all kept');
    assert.ok(s.drawn.length > 4);
    for (const d of s.drawn) {
      assert.deepEqual([d.w, d.h, d.smooth], [TILE_PX / dpr, TILE_PX / dpr, false], 'its own size, smoothing off');
      assert.ok(Number.isInteger(d.x * dpr) && Number.isInteger(d.y * dpr), 'on whole device pixels');
    }
    const xs = [...new Set(s.drawn.map((d) => d.x * dpr))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.equal(xs[i] - xs[i - 1], TILE_PX, 'a neighbour TILE_PX on: no seam, no overlap');
    assert.equal(s.ctx.imageSmoothingEnabled, true, 'the sheet\'s smoothing given back');
  }
});

test('TILE-EXACT a stand-in is the kept scale nearest the view\'s, within two doublings, resampled; past them none (mutants: the reach; the nearest not chosen)', () => {
  const tiles = make(), s = sheet();
  const o = { paperW: 600, paperH: 400, dpr: 1, key: 'k' };
  for (const scale of [1.6, 1]) for (let i = 0; i < 40; i++) tiles.draw(s.ctx, { ox: 0, oy: 0, scale }, o);   // the nearer kept first
  const settle = { ...o, budgetMs: 0, force: false };
  s.drawn.length = 0;
  tiles.draw(s.ctx, { ox: 0, oy: 0, scale: 1.5 }, settle);
  assert.ok(s.drawn.length > 0 && s.drawn.every((d) => d.smooth), 'stood in, resampled');
  assert.ok(s.drawn.every((d) => Math.abs(d.w - TILE_PX * 1.5 / 1.6) < 1e-6), '1.6\'s tiles, the nearer');
  s.drawn.length = 0;
  tiles.draw(s.ctx, { ox: 0, oy: 0, scale: 3.9 }, settle);
  assert.ok(s.drawn.length > 0, '1.6 is within two doublings of 3.9');
  s.drawn.length = 0;
  tiles.draw(s.ctx, { ox: 0, oy: 0, scale: 6.5 }, settle);
  assert.equal(s.drawn.length, 0, 'past two doublings of every kept scale: none');
});
