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
import {
  opaqueBox, sideStream, topStream, scaleFor, phaseAt, synthesizeCrownTop, treesUrl,
  TREE_LEAN, TOP_VIEW_DOT, CROWN_TURNS, CROWN_WIDTH_FRACTION, CROWN_MAX_SIZE,
} from '../src/render/treeModels.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

import { readdirSync } from 'node:fs';
const TREE_FILES = readdirSync(new URL('../public/trees/', import.meta.url)).filter((f) => f.endsWith('.json')).sort();

test('TR3: every climate that has models ships one, and none is empty', () => {
  // The partner modelled 500-511 bar 507; 511's one model was refused by
  // the converter's coverage check, so ten files ship. A file with no
  // records would be a fetch for nothing.
  assert.deepEqual(TREE_FILES, ['500.json', '501.json', '502.json', '503.json', '504.json', '505.json', '506.json', '508.json', '509.json', '510.json']);
});

for (const file of TREE_FILES) test(`TR1/TR3: ${file} is GEOMETRY - positions, UVs, tags, and nothing that could be a pixel`, () => {
  const path = `public/trees/${file}`;
  assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  const raw = rd(path);
  // No base64, no data URIs, no PNG/RGBA blobs: a render of game data
  // is game data, and this file must not be one in any encoding.
  assert.ok(!/data:image|base64|iVBOR|\\u00|rgba/i.test(raw), 'the file carries something that could be pixels');
  const j = JSON.parse(raw);
  assert.equal(j.archive, Number(file.slice(0, -5)));
  const recs = Object.entries(j.records);
  assert.ok(recs.length >= 1, `only ${recs.length} records`);
  for (const [rec, m] of recs) {
    assert.ok(Number.isInteger(Number(rec)) && Number(rec) > 0, `record key ${rec}`);
    assert.deepEqual(Object.keys(m).sort(), ['base', 'coverage', 'height', 'radius', 'side', 'top'], `record ${rec} carries extra fields`);
    // The converter's self-check rode along: how often a side card's
    // centroid, re-based, lands on its island's opaque pixels. Under
    // 0.5 the converter refuses the record; nothing shipped is under it.
    assert.ok(m.coverage >= 0.5 && m.coverage <= 1, `record ${rec} coverage ${m.coverage}`);
    assert.ok(m.height > 0.3 && m.height < 60, `record ${rec} height ${m.height} is not a tree`);
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
  assert.ok(/treeModels\.build\(archive, record, rec, bases, size\[1\], bm, \{/.test(host) && /const bm = t\.getDFBitmap\(record, 0\);/.test(host), 'the host does not hand the billboard height and the bitmap');
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
  // CALIBRATED TO THE SKY'S RANGE. |windV| is 4.8 calm, ~11 sunny, 32
  // storm; push is 0.55..1.3 of it. The lean per metre of height is
  // push * TREE_LEAN: a storm must bend a crown under 16% of its
  // height and a sunny day must still show. TR4's probe found the first
  // constant put a storm at 75%. MUTANT: 0.018 fails the first bound.
  assert.ok(TREE_LEAN * 32 * 1.3 < 0.16, `a storm bends a crown ${(TREE_LEAN * 32 * 1.3 * 100).toFixed(0)}% of its height`);
  assert.ok(TREE_LEAN * 11 * 0.9 > 0.02, 'a sunny day does not move the crown at all');
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


// ── TR2: the crown from above ──────────────────────────────────────

/** A sprite: a wide green crown over a narrow brown trunk. */
function treeSprite({ w = 40, h = 60, crownRows = 36, trunkW = 4 } = {}) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const crown = y < crownRows;
    const half = crown ? Math.round((w / 2) * Math.sin((y + 1) / crownRows * Math.PI)) : trunkW / 2;
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - w / 2) > half) continue;
      const o = (y * w + x) * 4;
      if (crown) { data[o] = 30; data[o + 1] = 120; data[o + 2] = 40; } else { data[o] = 110; data[o + 1] = 70; data[o + 2] = 30; }
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

test('TR2: the crown-top is remade from the sprite - square, four-fold, and crown only', () => {
  const sp = treeSprite();
  const bm = { width: sp.width, height: sp.height, data: new Uint8Array(sp.width * sp.height).map((_, i) => (sp.data[i * 4 + 3] ? 1 : 0)) };
  const top = synthesizeCrownTop(sp, opaqueBox(bm));
  assert.ok(top && top.width === top.height, 'the raster is not square');
  assert.ok(top.width <= CROWN_MAX_SIZE);
  const S = top.width, at = (x, y) => top.data[(y * S + x) * 4 + 3];
  // FOUR-FOLD. Turning the raster a quarter turn about its centre must
  // reproduce its alpha. MUTANT: CROWN_TURNS = 1 and the trunk-less
  // crown's outline stops matching its own rotation.
  let mismatch = 0, opaque = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = at(x, y) > 127, b = at(S - 1 - y, x) > 127;
    if (a) opaque++;
    if (a !== b) mismatch++;
  }
  assert.ok(opaque > S * S * 0.15, 'the crown covers too little');
  assert.ok(mismatch <= S * S * 0.03, `the raster is not four-fold symmetric (${mismatch} px differ)`);
  // CROWN ONLY. The trunk is narrow, so it is cut by the width rule and
  // no brown reaches the raster. MUTANT: CROWN_WIDTH_FRACTION = 0 keeps
  // every row and the trunk shows as a brown cross.
  let brown = 0;
  for (let i = 0; i < S * S; i++) if (top.data[i * 4 + 3] > 127 && top.data[i * 4] > 90) brown++;
  assert.equal(brown, 0, `${brown} trunk pixels reached the crown-top`);
  assert.equal(CROWN_TURNS, 4);
  assert.ok(CROWN_WIDTH_FRACTION > 0.2 && CROWN_WIDTH_FRACTION < 0.8);
});

test('TR2: a bush with no trunk is all crown, and nothing opaque is nothing', () => {
  const bush = treeSprite({ crownRows: 60, trunkW: 0 });
  const bm = { width: bush.width, height: bush.height, data: new Uint8Array(bush.width * bush.height).map((_, i) => (bush.data[i * 4 + 3] ? 1 : 0)) };
  const top = synthesizeCrownTop(bush, opaqueBox(bm));
  assert.ok(top, 'a bush has a top');
  assert.equal(synthesizeCrownTop(bush, null), null, 'no box, no raster');
  const empty = { width: 8, height: 8, data: new Uint8ClampedArray(256) };
  assert.equal(synthesizeCrownTop(empty, opaqueBox({ width: 8, height: 8, data: new Uint8Array(64) })), null);
});

test('TR2: the host remakes the top from the record and the renderer draws it after the sides', () => {
  const host = rd('src/scenes/world.js'), trees = rd('src/render/treeModels.js');
  assert.ok(/color32: t\.getColor32\(bm, 0\)/.test(host), 'the host does not hand the record\u2019s RGBA');
  assert.ok(/upload: \(k, raster\) => renderer\.uploadTexture\(archive, k, raster\)/.test(host), 'the host does not hand an upload');
  assert.ok(/topKey = `\$\{record\}#top`/.test(trees), 'the top is not keyed record#top');
  // the tops draw AFTER the sides in the same batch, in their own texture
  const sideDraw = trees.indexOf('gl.drawArraysInstanced(gl.TRIANGLES, 0, b.count, b.instances);');
  const topDraw = trees.indexOf('gl.drawArraysInstanced(gl.TRIANGLES, 0, b.top.count, b.instances);');
  assert.ok(sideDraw > 0 && topDraw > sideDraw, 'the tops do not draw after the sides');
  assert.ok(/gl\.uniform4f\(u\.box, 0, 0, 1, 1\);/.test(trees), 'the top raster is not drawn whole');
  // and die with the batch
  assert.ok(/if \(b\.top\) \{ gl\.deleteVertexArray\(b\.top\.vao\); gl\.deleteBuffer\(b\.top\.vbo\); \}/.test(trees), 'the top VAO leaks on dispose');
  // topStream is the side stream's twin
  const rec = { top: { pos: [0, 0, 0, 1, 0, 0, 0, 0, 1], uv: [0, 0, 1, 0, 0, 1] } };
  assert.equal(topStream(rec).count, 3);
  assert.equal(topStream({ top: { pos: [], uv: [] } }), null);
});


test('TR5: the models are fetched from the SITE ROOT, not from under /play/', () => {
  // public/ is copied to the build root; the game page is at /play/. A
  // relative fetch from the page was /play/trees/500.json - a 404 in
  // production, so every load answered null and no tree ever drew.
  // MUTANT: fetch `trees/${archive}.json` relative again.
  assert.equal(treesUrl(500, 'https://daggerfalljs.dev/play/'), 'https://daggerfalljs.dev/trees/500.json');
  assert.equal(treesUrl(500, 'https://daggerfalljs.dev/play/index.html?world'), 'https://daggerfalljs.dev/trees/500.json');
  assert.equal(treesUrl(502, 'https://lattymoy.github.io/daggerfall-js-source/play/'), 'https://lattymoy.github.io/daggerfall-js-source/trees/502.json');
  assert.equal(treesUrl(500, 'http://localhost:5199/__treeprobe.html'), 'http://localhost:5199/trees/500.json');
  assert.equal(treesUrl(500, 'http://localhost:5173/play/'), 'http://localhost:5173/trees/500.json');
  assert.ok(/fetchJson\(treesUrl\(archive\)\)/.test(rd('src/render/treeModels.js')), 'load does not go through treesUrl');
});
