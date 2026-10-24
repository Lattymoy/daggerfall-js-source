// FB0930-FOE-RAYS (2026-09-30, player report: hundreds of "requestAnimationFrame handler took <N>ms" in a dungeon,
// CPU at 100%, far fewer once every foe was dead): every foe's sight ray and obstacle probe run through
// Collider.raycastHit, and the probe's capsuleCast is 27 of them. The ray now marks triangles with a stamp, skips a
// cell's triangles whose Y extent misses the ray's in that cell, and the capsule's spokes reach only to the nearest
// hit so far. These pin that the answers are the ones the plain walk gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A stacked dungeon column: three levels of floor and ceiling, one wall at x = 6 across all of them. */
function stacked() {
  const pos = [], idx = [];
  const quad = (a, b, c, d) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (let l = 0; l < 3; l++) {
    const y = l * 4;
    quad([0, y, 0], [8, y, 0], [8, y, 8], [0, y, 8]);
    quad([0, y + 3, 0], [8, y + 3, 0], [8, y + 3, 8], [0, y + 3, 8]);
    quad([6, y, 0], [6, y, 8], [6, y + 3, 8], [6, y + 3, 0]);
  }
  const c = new Collider();
  c.addMesh('dungeon', new Float32Array(pos), new Uint32Array(idx), I);
  return c;
}

test('FB0930-FOE-RAYS: a level ray between floor and ceiling still meets the wall, on every level', () => {
  const c = stacked();
  for (let l = 0; l < 3; l++) {
    const h = c.raycastHit([1, l * 4 + 1.5, 4], [1, 0, 0], 50);
    assert.ok(Math.abs(h.dist - 5) < 1e-9, `level ${l}: ${h.dist}`);
    assert.equal(h.key, 'dungeon');
    assert.deepEqual(h.normal.map((v) => Math.round(v)), [-1, 0, 0]);
  }
});

test('FB0930-FOE-RAYS: a straight-down ray meets its own floor, a steep one the floor a cell over', () => {
  const c = stacked();
  assert.ok(Math.abs(c.raycastHit([3, 5, 3], [0, -1, 0], 50).dist - 1) < 1e-9);
  const d = [Math.SQRT1_2, -Math.SQRT1_2, 0];
  const h = c.raycastHit([1, 5, 3], d, 50);   // lands on the level-1 floor at x = 2, a cell from where it starts
  assert.ok(Math.abs(h.dist - Math.SQRT2) < 1e-9, `${h.dist}`);
});

test('FB0930-FOE-RAYS: a triangle rejected in one cell is still tested in the cell the ray reaches it in', () => {
  // one long ramp over many cells, rising 0 -> 4 along x: a level ray at y = 3 enters its cells high above it and
  // meets it only at x = 6 - it must not have been marked seen in the cells it was skipped in
  const c = new Collider();
  c.addMesh('ramp', new Float32Array([0, 0, 0, 8, 4, 0, 8, 4, 8, 0, 0, 8]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const h = c.raycastHit([0.5, 3, 4], [1, 0, 0], 50);
  assert.ok(Math.abs(h.dist - 5.5) < 1e-9, `${h.dist}`);
  assert.equal(c.raycastHit([0.5, 5, 4], [1, 0, 0], 50).dist, Infinity, 'above the ramp: nothing');
});

test('FB0930-FOE-RAYS: the capsule cast answers as nine full-reach rays would', () => {
  const c = stacked();
  const dir = [1, 0, 0];
  const got = c.capsuleCast([5.7, 1, 4], [5.7, 2, 4], 0.175, dir, 0.247);
  assert.ok(Math.abs(got.dist - 0.125) < 1e-9, `${got.dist}`);   // the axis at 5.7, the cap 0.175 ahead of it, the wall at 6
  assert.equal(got.key, 'dungeon');
  assert.equal(c.capsuleCast([1, 1, 4], [1, 2, 4], 0.175, dir, 0.247).dist, Infinity, 'nothing in reach');
});

test('FB0930-FOE-RAYS: the source keeps the stamp and the Y reject, and the capsule mints no spoke arrays', () => {
  const src = read('src/player/collider.js');
  const ray = src.slice(src.indexOf('  raycastHit(origin, dirW'), src.indexOf('    // M3 climbing (GetClimbedWallInfo'));
  assert.match(ray, /const marks = rayMarks\(bucket\), stamp = RAY_STAMP;/);
  assert.match(ray, /if \(yHiOf\[ti\] < rLo \|\| yLoOf\[ti\] > rHi\) continue;   \/\/ not reachable in this cell - left unmarked\n\s+marks\[ti\] = stamp;/, 'the reject BEFORE the mark');
  const cap = src.slice(src.indexOf('  capsuleCast(p1, p2'), src.indexOf('   * A6 - `Physics.SphereCast`'));
  assert.doesNotMatch(cap, /for \(const \[ox, oy, oz\] of \[/);
  assert.match(cap, /this\.raycastHit\(CAP_ORIGIN, dir, Math\.min\(reach, best\), filter, CAP_HIT\)/);
});

test('FB0930-FOE-RAYS: the dungeon draw scales a caster\'s record on locals, never the shared size cache', () => {
  const d = read('src/scenes/dungeonContext.js');
  assert.doesNotMatch(d, /sz\.w \*= 1\.35/, 'the cached object is read, never written');
  assert.match(d, /const szK = f\.mobileArchive === 475 && out\.record >= 20 && out\.record <= 24 \? 1\.35 : 1;/);
  assert.match(d, /f\.batch\.size = \{ w: out\.flip \? -szW : szW, h: szH \};/);
});
