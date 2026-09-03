// TR1 - the trees: our partner's meshes wearing the player's own sprite.
//
// Everything here is pure or a read of the tree; the renderer itself is
// GL and a node test cannot reach it. What CAN be pinned is pinned: the
// shipped file's shape (and that it is geometry, not pixels), the
// opaque-box law, the height match, the wind law being the grass's
// term for term, and the host's switch, fallback and teardown.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { opaqueBox, sideStream, scaleFor, phaseAt, TREE_LEAN, TOP_VIEW_DOT } from '../src/render/treeModels.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('TR1: the shipped file is GEOMETRY - positions, UVs, tags, and nothing that could be a pixel', () => {
  const path = 'public/trees/500.json';
  assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  const raw = rd(path);
  // No base64, no data URIs, no PNG/RGBA blobs: a render of game data
  // is game data, and this file must not be one in any encoding.
  assert.ok(!/data:image|base64|iVBOR|\\u00|rgba/i.test(raw), 'the file carries something that could be pixels');
  const j = JSON.parse(raw);
  assert.equal(j.archive, 500);
  const recs = Object.entries(j.records);
  assert.ok(recs.length >= 5, `only ${recs.length} records`);
  for (const [rec, m] of recs) {
    assert.ok(Number.isInteger(Number(rec)) && Number(rec) > 0, `record key ${rec}`);
    assert.deepEqual(Object.keys(m).sort(), ['base', 'height', 'radius', 'side', 'top'], `record ${rec} carries extra fields`);
    assert.ok(m.height > 1 && m.height < 60, `record ${rec} height ${m.height} is not a tree`);
    for (const view of ['side', 'top']) {
      assert.equal(m[view].pos.length % 9, 0, `record ${rec} ${view} pos is not triangles`);
      assert.equal(m[view].uv.length, (m[view].pos.length / 3) * 2, `record ${rec} ${view} uv/pos mismatch`);
      for (const v of m[view].uv) assert.ok(v >= -0.02 && v <= 1.02, `record ${rec} ${view} uv ${v} off the sprite`);
      for (const v of m[view].pos) assert.ok(Number.isFinite(v) && Math.abs(v) < 100, `record ${rec} ${view} pos ${v}`);
    }
    assert.ok(m.side.pos.length > 0, `record ${rec} has no side cards`);
  }
});

test('TR1: opaqueBox measures the record\u2019s non-transparent extent as UV on the full texture', () => {
  // index 0 is the transparent palette entry; the box is everything else
  const bm = { width: 8, height: 4, data: new Uint8Array(32) };
  assert.equal(opaqueBox(bm), null, 'a fully transparent record has no box');
  bm.data[1 * 8 + 2] = 5; bm.data[2 * 8 + 5] = 7;          // (2,1) and (5,2)
  assert.deepEqual(opaqueBox(bm), [2 / 8, 1 / 4, 6 / 8, 3 / 4]);
  // MUTANT: treat index 0 as opaque and the box becomes the whole texture.
  const full = { width: 4, height: 4, data: new Uint8Array(16).fill(3) };
  assert.deepEqual(opaqueBox(full), [0, 0, 1, 1]);
});

test('TR1: the mesh is scaled to the billboard\u2019s height, and its base sits at the flat\u2019s bottom', () => {
  assert.equal(scaleFor({ height: 10 }, 15), 1.5);
  assert.equal(scaleFor({ height: 0 }, 15), 1, 'a flat mesh must not divide by zero');
  // The host hands the tree the flat's BOTTOM edge - centre minus half
  // the height - so a mesh stands where a flat stood. Pinned by source.
  const host = rd('src/scenes/world.js');
  assert.ok(/centers\.map\(\(\[cx, cy, cz\]\) => \[cx, cy - size\[1\] \/ 2, cz\]\)/.test(host), 'the host does not lower the base to the flat\u2019s bottom');
  assert.ok(/treeModels\.build\(archive, record, rec, bases, size\[1\], t\.getDFBitmap\(record, 0\)\)/.test(host), 'the host does not hand the billboard height and the bitmap');
});

test('TR1: sideStream interleaves side cards only', () => {
  const rec = { side: { pos: [0, 0, 0, 1, 0, 0, 0, 1, 0], uv: [0, 0, 1, 0, 0, 1] }, top: { pos: [9, 9, 9, 9, 9, 9, 9, 9, 9], uv: [0, 0, 0, 0, 0, 0] } };
  const s = sideStream(rec);
  assert.equal(s.count, 3);
  assert.deepEqual([...s.verts], [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  assert.equal(sideStream({ side: { pos: [], uv: [] } }), null, 'no side cards is null, not an empty draw');
  assert.ok(TOP_VIEW_DOT > 0.5 && TOP_VIEW_DOT < 1);
});

test('TR1: a tree\u2019s phase is deterministic in its position, and twins differ', () => {
  assert.equal(phaseAt(10.5, 20.25), phaseAt(10.5, 20.25));
  assert.notEqual(phaseAt(10.5, 20.25), phaseAt(11.5, 20.25));
  for (const [x, z] of [[0, 0], [1e3, -1e3], [0.1, 0.2]]) {
    const p = phaseAt(x, z); assert.ok(p >= 0 && p < Math.PI * 2, `phase ${p} out of range`);
  }
});

test('TR1: the wind law is the grass\u2019s, term for term', () => {
  // The lean is copied from labGrass.js so the trees and the grass move
  // as one weather. Each of the four terms must match the grass's line
  // exactly, modulo the root's name. MUTANT: change any coefficient.
  const grass = rd('src/render/labGrass.js'), trees = rd('src/render/treeModels.js');
  const G = (re) => { const m = grass.match(re); assert.ok(m, `grass lost ${re}`); return m[0]; };
  const T = (re) => { const m = trees.match(re); assert.ok(m, `trees lack ${re}`); return m[0]; };
  assert.equal(T(/vec2 wdir = [^;]+;/), G(/vec2 wdir = [^;]+;/));
  assert.equal(T(/float gust = [^;]+;/), G(/float gust = [^;]+;/));
  assert.equal(T(/float push = [^;]+;/), G(/float push = [^;]+;/));
  assert.equal(T(/float along = dot\(([^,]+), wdir\);/).replace(/dot\([^,]+,/, 'dot(root,'), G(/float along = dot\(root, wdir\);/));
  // A tree is not a blade: it leans less than the grass's 0.055.
  assert.ok(TREE_LEAN > 0 && TREE_LEAN < 0.055);
  // ...and by the square of its height above the base, so trunks stand.
  assert.ok(/\* t \* t \* uHeight \* uScale/.test(trees), 'the lean is not weighted t^2');
});

test('TR1: the host\u2019s switch, fallback and teardown', () => {
  const host = rd('src/scenes/world.js');
  // The trees ride the grass's pref and add their own escape.
  assert.ok(/getPref\('enhancedEnvironments'\)[^\n]*get\('trees'\) !== 'off'/.test(host), 'the trees have no switch or no escape');
  // Only NATURE flats become trees, and only ones with a model.
  assert.ok(/treeModels && archive === natureArchive \? treeModels\.modelFor\(archive, record\) : null/.test(host), 'a non-nature flat could become a tree');
  // A tree that builds SKIPS the billboard; one that does not falls through to it.
  assert.ok(/if \(tb\) \{ treeBatches\.push\(tb\.key\); continue; \}/.test(host), 'a built tree does not skip its flat');
  assert.ok(/console\.warn\('\[trees\] fell back to the flat:'/.test(host), 'a failed tree does not fall back');
  // The pixel carries its trees and frees them with everything else.
  assert.ok(/batches, treeBatches, flatAnims/.test(host), 'the pixel record does not carry its trees');
  assert.ok(/for \(const k of p\.treeBatches \?\? \[\]\) treeModels\.dispose\(k\)/.test(host), 'destroyPixel does not free the trees');
  // ONE wind for the grass and the trees: one object built once a frame.
  assert.equal((host.match(/sceneWind\(\)/g) || []).length, 2, 'the wind is not read by exactly the grass and the trees');
  // The RAIN still builds its own copy of the vector (world.js ~6566),
  // with the pre-WIND1 gust envelope - a pre-existing second home this
  // slice does not touch, named here so nobody reads "one wind" as
  // "one wind everywhere". Two slider calls: the rain's and ours.
  assert.equal((host.match(/labWindSlider\(w\)/g) || []).length, 2, 'a third wind vector appeared');
});
