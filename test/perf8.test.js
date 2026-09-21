// PERF8 (2026-09-11). The grass placer's keep()/ground() found the pixel
// under a blade by scanning every near pixel; the pixels are a grid, so
// the one under a point is one floor from a reference. EXECUTES against
// pieces laid as streamingWorld lays them; the host is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pieceIndex, pieceKey } from '../src/render/labGrass.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const TS = 819.2;

/** pixels around (100, 200) with the origin at (98, 198) and a floating-origin compensation, exactly pixelTranslation's arithmetic */
function lay(comp = [37.25, 5, -12.5], origin = [98, 198]) {
  const pieces = [];
  for (let py = 198; py <= 202; py++) for (let px = 98; px <= 102; px++) {
    pieces.push({ p: { px, py }, t: [(px - origin[0]) * TS + comp[0], comp[1], -(py - origin[1]) * TS + comp[2]] });
  }
  return pieces;
}
/** the scan the index replaces: the first piece whose square holds the point */
const scan = (pieces, x, z) => pieces.find(({ t }) => x - t[0] >= 0 && z - t[2] >= 0 && x - t[0] < TS && z - t[2] < TS) ?? null;

test('PERF8 pieceIndex: answers exactly what the scan answered, for every point inside the near square and none outside it (mutant: z sign, the floor, or the reference offset)', () => {
  const pieces = lay();
  const at = pieceIndex(pieces, TS);
  let checked = 0;
  for (let i = 0; i < 4000; i++) {
    const x = -3 * TS + Math.random() * 11 * TS, z = -3 * TS + Math.random() * 11 * TS;
    assert.equal(at(x, z), scan(pieces, x, z), `(${x.toFixed(1)}, ${z.toFixed(1)})`);
    checked++;
  }
  assert.equal(checked, 4000);
  // the edges: a point exactly on a piece's near corner is that piece; a hair before it is its neighbour
  const p = pieces[7];
  assert.equal(at(p.t[0], p.t[2]), p);
  assert.equal(at(p.t[0] - 1e-6, p.t[2]), scan(pieces, p.t[0] - 1e-6, p.t[2]));
  assert.equal(pieceIndex([], TS)(0, 0), null, 'no pieces, no piece');
  // the reference can be any piece: the shuffled list agrees with itself
  const shuffled = [...pieces].reverse();
  const at2 = pieceIndex(shuffled, TS);
  for (let i = 0; i < 500; i++) { const x = Math.random() * 6 * TS - TS, z = Math.random() * 6 * TS - TS; assert.equal(at2(x, z), at(x, z)); }
});

// GRASS4 (2026-09-18): THE KEY IS A NUMBER, and the whole point of it is
// that it allocates nothing. `pieceIndex` is asked once per blade
// candidate - six thousand a cell, two cells a frame while the eye walks
// - and it was minting a template string for every one of them, twelve
// thousand a frame, each hashed, looked up and dropped. Measured on the
// placer: 1.22 ms a cell to 0.40, 67% off, with byte-identical output.
test('GRASS4 pieceKey: a map pixel is one NUMBER, distinct for every pixel the map has, and no string is built to look one up', () => {
  // INJECTIVE over the Daggerfall map and well past it. The formula is
  // px * 65536 + py, which is unique for any integer px and a py inside
  // +/-32768; the map is 1000 x 500.
  const seen = new Map();
  for (let px = -600; px <= 600; px += 7) {
    for (let py = -600; py <= 600; py += 11) {
      const k = pieceKey(px, py);
      assert.equal(typeof k, 'number', 'a number, so the Map hashes it without allocating');
      assert.ok(Number.isSafeInteger(k), `${px},${py} stays a safe integer`);
      const prev = seen.get(k);
      assert.equal(prev, undefined, `${px},${py} collides with ${prev}`);
      seen.set(k, `${px},${py}`);
    }
  }
  // THE NEGATIVE HALF MATTERS: z runs the other way, so py goes below
  // zero for every pixel north of the reference, and a key that only
  // worked for positive py would fold half the world onto the other.
  assert.notEqual(pieceKey(1, -1), pieceKey(0, 1));
  assert.notEqual(pieceKey(-1, 0), pieceKey(0, 0));
  assert.notEqual(pieceKey(0, -1), pieceKey(-1, 65535 - 65536 + 1));
  // AND THE BOUND IS REAL, stated here rather than assumed: at |py| of
  // 32768 the halves meet and the formula stops being injective. That is
  // why 65536 is the stride and why this is safe - the Daggerfall map is
  // 1000 x 500 pixels, three orders of magnitude inside it.
  assert.equal(pieceKey(1, -1), pieceKey(0, 65535), 'out of range, the halves collide - the bound is not decoration');
  for (const py of [-32767, -1, 0, 1, 32767]) {
    assert.notEqual(pieceKey(0, py), pieceKey(1, py), 'inside the bound, neighbours never collide');
  }
  // and the source builds NO key string - the allocation was the cost
  const src = read('src/render/labGrass.js');
  assert.match(src, /byKey\.set\(pieceKey\(piece\.p\.px, piece\.p\.py\), piece\);/);
  assert.match(src, /return byKey\.get\(pieceKey\(px, py\)\) \?\? null;/);
  assert.ok(!/byKey\.get\(`/.test(src) && !/byKey\.set\(`/.test(src), 'no template string reaches the index');
});

test('PERF8 pins: keep and ground take the piece from the index and no longer loop the pieces (mutant: the scan back)', () => {
  const w = read('src/scenes/world.js');
  // PERF10 widened this from the old one-line spelling: the index is
  // built lazily now (a frame that fills no cell builds none at all), so
  // the law is that `pieceAt` IS pieceIndex over TERRAIN_SIZE, not which
  // statement mints it.
  assert.match(w, /pieceIndex\([\s\S]{0,400}TERRAIN_SIZE\)/);
  assert.match(w, /const keep = \(x, z\) => \{\n\s+const hit = pieceAt\(x, z\);\n\s+if \(!hit\) return null;\n\s+const \{ p, t, grass \} = hit;/);
  assert.match(w, /const ground = \(x, z\) => \{\n\s+const hit = pieceAt\(x, z\);[^\n]*\n\s+if \(!hit\) return null;/);
  assert.doesNotMatch(w, /for \(const \{ p, t(, grass)? \} of pieces\)/, 'no scan left');
});
