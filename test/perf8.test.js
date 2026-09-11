// PERF8 (2026-09-11). The grass placer's keep()/ground() found the pixel
// under a blade by scanning every near pixel; the pixels are a grid, so
// the one under a point is one floor from a reference. EXECUTES against
// pieces laid as streamingWorld lays them; the host is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pieceIndex } from '../src/render/labGrass.js';

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

test('PERF8 pins: keep and ground take the piece from the index and no longer loop the pieces (mutant: the scan back)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const pieceAt = pieceIndex\(pieces, TERRAIN_SIZE\);/);
  assert.match(w, /const keep = \(x, z\) => \{\n\s+const hit = pieceAt\(x, z\);\n\s+if \(!hit\) return null;\n\s+const \{ p, t, grass \} = hit;/);
  assert.match(w, /const ground = \(x, z\) => \{\n\s+const hit = pieceAt\(x, z\);[^\n]*\n\s+if \(!hit\) return null;/);
  assert.doesNotMatch(w, /for \(const \{ p, t(, grass)? \} of pieces\)/, 'no scan left');
});
