// Collider.restand: a mover's bucket stood again keeps the broad filing standing (a lift is stood several times a
// frame), and every query answers as removeBucket then addMesh, which drops the filing, answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../src/player/collider.js';

const BOX = (() => {
  const positions = new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, -1, 1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { positions, indices };
})();
const at = (x, y, z, s = 1) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, x, y, z, 1]);

function scene() {
  const c = new Collider();
  c.addMesh('floor', BOX.positions, BOX.indices, at(0, -1, 0, 200));   // too wide for the fine cells
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) c.addMesh(`box${i},${j}`, BOX.positions, BOX.indices, at(i * 9 + 4, 0, j * 9 + 4));
  c.addMesh('lift', BOX.positions, BOX.indices, at(0, 0, 0, 1.5));
  c.addMesh('after', BOX.positions, BOX.indices, at(2, 0, 2));   // a bucket laid after the lift: the walk's order changes
  return c;
}

const ORIGINS = [];
for (let x = -14; x <= 14; x += 3.5) for (let z = -14; z <= 14; z += 3.5) ORIGINS.push([x, 3, z]);
const DIRS = [[0, -1, 0], [1, 0, 0], [0.6, -0.8, 0], [0, -0.6, 0.8], [-0.70710678, 0, 0.70710678]];

function answers(c) {
  const out = [];
  for (const o of ORIGINS) {
    for (const d of DIRS) {
      const h = c.raycastHit(o, d, 30);
      out.push([h.dist, h.key]);
      const cc = c.capsuleCast([o[0], o[1] - 0.6, o[2]], [o[0], o[1] + 0.6, o[2]], 0.3, d, 20);
      out.push([cc.dist ?? cc, cc.key ?? null]);
    }
    const feet = [o[0], 2.5, o[2]];
    c.move(feet, 0.4, -1.2, 0.3, 1.7, true);
    out.push(feet.map((v) => Math.round(v * 1e9) / 1e9));
  }
  return out;
}

const POSES = [];
for (let k = 0; k < 24; k++) POSES.push(at(Math.sin(k / 3) * 13, k * 0.2, k * 0.6 - 7, 1.5));

/** First answer the two colliders disagree on, or null (a deep diff of thousands of answers is too slow to print). */
function firstDiff(x, y) {
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) return { i, a: x[i], b: y[i] };
  return null;
}
const cellsOf = (broad) => [...broad.cells].filter(([, l]) => l.length).map(([k, l]) => `${k}:${l.map((b) => b.key).sort()}`).sort();

test('restand answers every raycast, capsule cast and move as removeBucket then addMesh, with the filing kept', () => {
  const a = scene(), b = scene();
  assert.equal(firstDiff(answers(a), answers(b)), null);
  const filing = a._broad;
  assert.ok(filing);
  for (let k = 0; k < POSES.length; k++) {
    const m = k % 7 === 3 ? null : POSES[k];   // a place(null) takes the bucket away
    const had = b._buckets.has('lift');
    a.restand('lift', BOX.positions, BOX.indices, m);
    b.removeBucket('lift');
    if (m) b.addMesh('lift', BOX.positions, BOX.indices, m);
    assert.equal(a._buckets.has('lift'), !!m);
    if (had) assert.ok(b._broad === null, 'remove and add drops the filing');
    assert.equal(firstDiff(answers(a), answers(b)), null, `pose ${k}`);
    assert.ok(a._broad === filing, `pose ${k}: the filing is not made again`);
    assert.deepEqual([...a._buckets.keys()], [...b._buckets.keys()], 'the walk keeps remove-then-add order');
    assert.deepEqual(a._broad.all.map((x) => x.key), [...a._buckets.keys()]);
    a._broad.all.forEach((x, i) => assert.equal(x.ord, i));
    assert.deepEqual(cellsOf(a._broad), cellsOf(b._broad), 'the lift is filed only where it stands now');
  }
});

test('restand of a held key, or with no filing standing, is removeBucket then addMesh', () => {
  const c = scene();
  c.restand('lift', BOX.positions, BOX.indices, at(0, 0, 0, 1.5));   // no filing yet
  assert.equal(c._broad, null);
  assert.equal(c.raycastHit([0, 5, 0], [0, -1, 0], 10).key, 'lift');
  c.hold('lift');
  c.restand('lift', BOX.positions, BOX.indices, at(0, 0, 0, 1.5));
  assert.ok(c._held.has('lift') && !c._buckets.has('lift'), 'a held key is laid aside');
  assert.notEqual(c.raycastHit([0, 5, 0], [0, -1, 0], 10).key, 'lift');
  c.restand('lift', BOX.positions, BOX.indices, null);
  assert.ok(!c._held.has('lift'));
});
