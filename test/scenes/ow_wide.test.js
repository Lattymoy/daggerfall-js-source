// OW-WIDE (2026-10-30, the owner: "I want to improve overworld travel performance. It currently seems like there is
// stutter due to our larger map"; bible/07-Rendering/Performance-Priority.md OW-WIDE): OW-SEAT - a ground plant's mark rides
// its own array. OW-DEMOTE's pins are PERF-EXT26's (test/world/terrain/restrideworker.test.js), OW-RING's FAR-FLORA's
// (test/render/farflora.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standsOnGround, ringLifts } from '../../src/scenes/floraSeat.js';

test('OW-SEAT a ground plant\'s mark rides its own array - a centre marked carries it and a copy of its places does not - and the far ring lifts the marked alone (mutants: the mark kept in a table again; the mark unread)', () => {
  const c = [1, 2, 3], copy = [...c];
  standsOnGround(c);
  assert.equal(Object.getOwnPropertySymbols(c).length, 1, 'the mark is the array\'s own');
  assert.equal(Object.getOwnPropertySymbols(copy).length, 0);
  assert.deepEqual([...c], [1, 2, 3], 'its places untouched');
  // a rough field: the far ring's ground stands off the walk ground, so a marked centre lifts and an unmarked one does not
  const H = 129, samples = new Float32Array(H * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) samples[y * H + x] = ((x * 7 + y * 13) % 17) / 17;
  const centers = [];
  for (let k = 0; k < 64; k++) { const p = [5 + k * 11.3, 0, 7 + k * 9.7]; if (k % 2 === 0) standsOnGround(p); centers.push(p); }
  const lift = ringLifts(samples, centers, 4, null);
  assert.ok(lift, 'the far ring lifts its plants');
  assert.ok(centers.every((_, k) => k % 2 === 0 || lift[k] === 0), 'an unmarked centre never lifted');
  assert.ok(centers.some((_, k) => k % 2 === 0 && lift[k] !== 0), 'a marked one lifted');
});
