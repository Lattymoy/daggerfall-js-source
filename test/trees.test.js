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
  opaqueBox, sideStream, topStream, scaleFor, phaseAt, synthesizeCrownTop, treesUrl, TreeModelRenderer,
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
  // TR6: the flat's stored position IS its base - flatBatchAabb spans
  // minY..minY + h and the billboard stands on it - so the host hands
  // the centres as they are, and the flat's height as `size.h` (the size
  // is an OBJECT; TR1 read `size[1]`, which is undefined, so every base
  // and every scale was NaN and no tree ever had a position). Pinned by
  // source, and the old reads pinned OUT.
  const host = rd('src/scenes/world.js');
  assert.ok(/treeModels\.build\(key, archive, record, rec, centers, size\.h, bm, \{/.test(host), 'the host does not hand the pixel key, the centres as bases, and size.h');
  assert.ok(/const bm = t\.getDFBitmap\(record, 0\);/.test(host), 'the host does not hand the bitmap');
  assert.ok(!/size\[1\]/.test(host), 'a numeric index into the {w, h} size is back');
  assert.ok(!/cy - size/.test(host), 'the base is lowered by half a height again - the position already IS the base');
  assert.match(rd('src/render/frustum.js'), /return \[minX - hw, minY, minZ - hw, maxX \+ hw, maxY \+ size\.h, maxZ \+ hw\];/, 'the flat AABB law this rests on moved');
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
  assert.ok(/if \(tb\) \{ tb\._box = flatBatchAabb\(centers, size\); unionBox\(tb\._box\); treeBatches\.push\(tb\); continue; \}/.test(host), 'a built tree does not skip its flat, keep the flat\u2019s EV3 box, and join the pixel\u2019s bounds');
  assert.ok(/console\.warn\('\[trees\] fell back to the flat:'/.test(host), 'a failed tree does not fall back');
  // The pixel carries its trees and frees them with everything else.
  assert.ok(/batches, treeBatches, flatAnims/.test(host), 'the pixel record does not carry its trees');
  assert.ok(/treeModels\?\.disposePixel\(key\);/.test(host), 'destroyPixel does not free the pixel\u2019s own trees');
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
  const colors = new Uint8ClampedArray(w * h * 4);   // TR6: getColor32's shape
  for (let y = 0; y < h; y++) {
    const crown = y < crownRows;
    const half = crown ? Math.round((w / 2) * Math.sin((y + 1) / crownRows * Math.PI)) : trunkW / 2;
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - w / 2) > half) continue;
      const o = (y * w + x) * 4;
      if (crown) { colors[o] = 30; colors[o + 1] = 120; colors[o + 2] = 40; } else { colors[o] = 110; colors[o + 1] = 70; colors[o + 2] = 30; }
      colors[o + 3] = 255;
    }
  }
  return { width: w, height: h, colors };
}

test('TR2: the crown-top is remade from the sprite - square, four-fold, and crown only', () => {
  const sp = treeSprite();
  const bm = { width: sp.width, height: sp.height, data: new Uint8Array(sp.width * sp.height).map((_, i) => (sp.colors[i * 4 + 3] ? 1 : 0)) };
  const top = synthesizeCrownTop(sp, opaqueBox(bm));
  assert.ok(top && top.width === top.height, 'the raster is not square');
  assert.ok(top.width <= CROWN_MAX_SIZE);
  const S = top.width, at = (x, y) => top.colors[(y * S + x) * 4 + 3];
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
  for (let i = 0; i < S * S; i++) if (top.colors[i * 4 + 3] > 127 && top.colors[i * 4] > 90) brown++;
  assert.equal(brown, 0, `${brown} trunk pixels reached the crown-top`);
  assert.equal(CROWN_TURNS, 4);
  assert.ok(CROWN_WIDTH_FRACTION > 0.2 && CROWN_WIDTH_FRACTION < 0.8);
});

test('TR2: a bush with no trunk is all crown, and nothing opaque is nothing', () => {
  const bush = treeSprite({ crownRows: 60, trunkW: 0 });
  const bm = { width: bush.width, height: bush.height, data: new Uint8Array(bush.width * bush.height).map((_, i) => (bush.colors[i * 4 + 3] ? 1 : 0)) };
  const top = synthesizeCrownTop(bush, opaqueBox(bm));
  assert.ok(top, 'a bush has a top');
  assert.equal(synthesizeCrownTop(bush, null), null, 'no box, no raster');
  const empty = { width: 8, height: 8, colors: new Uint8ClampedArray(256) };
  assert.equal(synthesizeCrownTop(empty, opaqueBox({ width: 8, height: 8, data: new Uint8Array(64) })), null);
});

test('TR2: the host remakes the top from the record and the renderer draws it after the sides', () => {
  const host = rd('src/scenes/world.js'), trees = rd('src/render/treeModels.js');
  assert.ok(/color32: t\.getColor32\(bm, 0\)/.test(host), 'the host does not hand the record\u2019s RGBA');
  assert.ok(/upload: \(k2, raster\) => renderer\.uploadTexture\(archive, k2, raster\)/.test(host), 'the host does not hand an upload');
  assert.ok(/topKey = `\$\{record\}#top`/.test(trees), 'the top is not keyed record#top');
  // the tops draw AFTER the sides in the same batch, in their own texture
  const sideDraw = trees.indexOf('gl.drawArraysInstanced(gl.TRIANGLES, 0, g.count, b.instances);');
  const topDraw = trees.indexOf('gl.drawArraysInstanced(gl.TRIANGLES, 0, g.top.count, b.instances);');
  assert.ok(sideDraw > 0 && topDraw > sideDraw, 'the tops do not draw after the sides');
  assert.ok(/gl\.uniform4f\(u\.box, 0, 0, 1, 1\);/.test(trees), 'the top raster is not drawn whole');
  // and die with the batch
  // TR6: a batch's top VAO dies with the batch; the record's top BUFFER is
  // geometry, shared, and stays for the next pixel
  assert.ok(/if \(b\.topVao\) gl\.deleteVertexArray\(b\.topVao\);/.test(trees), 'the top VAO leaks on dispose');
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


// ── TR6: the integration, rebuilt ──────────────────────────────────

/** A WebGL2 stand-in that records every call and answers the queries
 *  the renderer makes; the trees' GL is otherwise unreachable here. */
function glStub() {
  const calls = [];
  const consts = { TRIANGLES: 4, FLOAT: 5126, ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714, TEXTURE_2D: 3553, TEXTURE0: 33984, DEPTH_TEST: 2929, BLEND: 3042, CULL_FACE: 2884 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, name) {
      if (name in consts) return consts[name];
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
      if (name === 'getUniformLocation') return (_p, n) => n;
      if (/^create/.test(String(name))) return () => ({ id: ++ids, kind: String(name).slice(6) });
      return (...args) => { calls.push([String(name), ...args]); };
    },
  });
  return { gl, calls };
}
const REC = { height: 10, base: 0, radius: 5, coverage: 1, side: { pos: [0, 0, 0, 1, 0, 0, 0, 1, 0], uv: [0, 0, 1, 0, 0, 1] }, top: { pos: [0, 1, 0, 1, 1, 0, 0, 1, 1], uv: [0, 0, 1, 0, 0, 1] } };
const BM = { width: 4, height: 4, data: new Uint8Array(16).fill(1) };
const stubRenderer = (textures) => ({
  textures, _pointLights: new Float32Array(0), _pointColorData: () => new Float32Array(0), _indirect: new Float32Array(4), _indirectColor: new Float32Array(3),
  _fogColor: new Float32Array(3), _fogMode: 0, _fogDensity: 0, _fogRange: new Float32Array(2), _camPos: new Float32Array(3),
});

test('TR6: the geometry is per record and shared; the instances are per pixel and die with their pixel alone', () => {
  // TR1 keyed the batch on archive_record for the whole world: a
  // neighbouring pixel with the same record REPLACED the player's
  // pixel's trees, and a pixel leaving disposed the key and took every
  // other pixel's trees of that record with it. MUTANT: key on the
  // record again and the second build disposes the first.
  const { gl, calls } = glStub();
  const tm = new TreeModelRenderer(gl);
  const a = tm.build('0,0', 500, 3, REC, [[1, 0, 1], [2, 0, 2]], 12, BM);
  const b = tm.build('1,0', 500, 3, REC, [[5, 0, 5]], 12, BM);
  assert.ok(a && b && a !== b, 'two pixels, two batches');
  assert.equal(a.key, '0,0|500_3'); assert.equal(b.key, '1,0|500_3');
  assert.equal(tm.batches.size, 2);
  assert.equal(tm.geometry.size, 1, 'one geometry for the record');
  assert.equal(a.geom, b.geom, 'shared');
  assert.equal(a.geom.scale, 1.2, 'the height match is the record\u2019s (12 / 10)');
  assert.equal(a.instances, 2); assert.equal(b.instances, 1);
  // one side buffer for the record, then one instance buffer per pixel
  assert.equal(calls.filter((c) => c[0] === 'bufferData').length, 3, 'the side stream was uploaded once and the instances twice');
  // a pixel leaving frees ITS instances; the geometry and the other pixel stand
  calls.length = 0;
  tm.disposePixel('0,0');
  assert.equal(tm.batches.size, 1); assert.ok(tm.batches.has('1,0|500_3'));
  assert.equal(tm.geometry.size, 1, 'the record\u2019s geometry survives the pixel');
  assert.equal(calls.filter((c) => c[0] === 'deleteBuffer').length, 1, 'only the instance buffer was freed');
  assert.equal(tm.byPixel.has('0,0'), false);
  tm.disposePixel('nowhere');   // never traps
  // a rebuild of the same pixel and record replaces only its own batch
  tm.build('1,0', 500, 3, REC, [[6, 0, 6], [7, 0, 7]], 12, BM);
  assert.equal(tm.batches.size, 1); assert.equal(tm.batches.get('1,0|500_3').instances, 2);
  // no bases, no batch; no geometry, no batch
  assert.equal(tm.build('2,0', 500, 3, REC, [], 12, BM), null);
  assert.equal(tm.build('2,0', 500, 9, { side: { pos: [], uv: [] } }, [[0, 0, 0]], 12, BM), null);
});

test('TR6: the instances are PIXEL-LOCAL and the draw hands each batch its pixel\u2019s translation; the gust rides world-fixed coordinates', () => {
  // The streaming world keeps a pixel's content in the pixel's frame and
  // adds the translation at draw (`b.origin = t`, under the floating
  // origin's compensation). TR1's shader took aInst as world, so every
  // pixel's trees stood on the origin pixel. MUTANT: drop uOrigin.
  const trees = rd('src/render/treeModels.js'), host = rd('src/scenes/world.js');
  assert.match(trees, /uniform vec3 uOrigin;/); assert.match(trees, /uniform vec2 uGustOrigin;/);
  assert.match(trees, /vec3 base = aInst\.xyz \+ uOrigin;\s*\n\s*vec3 p = base \+ vec3\(aPos\.x, aPos\.y - uBase, aPos\.z\) \* uScale;/);
  assert.match(trees, /float along = dot\(aInst\.xz \+ uGustOrigin, wdir\);/, 'the gust\u2019s wave is not on world-fixed coordinates');
  // the host: collected in the pixel walk like the flats, culled like them, translated like them
  assert.match(host, /for \(const tb of p\.treeBatches \?\? \[\]\) \{\s*\n\s*if \(!pixelVisible \|\| \(cullOn && aabbOutside\(_planes, tb\._box, t\[0\], t\[1\], t\[2\]\)\)\) continue;/, 'the trees are not culled as the flats are');
  assert.match(host, /tb\.origin = t;\s*\n\s*\(tb\.gustOrigin \?\?= \[0, 0\]\)\[0\] = t\[0\] - state\.compensation\[0\]; tb\.gustOrigin\[1\] = t\[2\] - state\.compensation\[2\];\s*\n\s*_treeDraw\.push\(tb\);/, 'the translation and the grid translation are not handed per batch');
  assert.match(host, /_treeDraw\.length = 0;/, 'the frame\u2019s list is not emptied');
  assert.match(host, /treeModels\.draw\(r, proj, view, now \/ 1000, sceneWind\(\), tint, _treeDraw\);/, 'the draw does not take the frame\u2019s visible list');
  // the draw itself, through the stub: each batch's origin reaches the
  // shader, a batch with no origin (not collected this frame) is not
  // drawn, and a record's texture binds once however many pixels stand it
  const { gl, calls } = glStub();
  const tm = new TreeModelRenderer(gl);
  const a = tm.build('0,0', 500, 3, REC, [[1, 0, 1], [2, 0, 2]], 12, BM);
  const b = tm.build('1,0', 500, 3, REC, [[5, 0, 5]], 12, BM);
  const r = stubRenderer(new Map([['500_3', { tex: 1 }]]));
  const I = new Float32Array(16);
  a.origin = [800, 0, -1600]; a.gustOrigin = [800, -1600];
  calls.length = 0;
  tm.draw(r, I, I, 1, { windV: [1, 0] }, [1, 1, 1], [a, b]);
  assert.equal(tm.count, 2, 'only the collected batch drew');
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3fv' && c[1] === 'uOrigin').map((c) => c[2]), [[800, 0, -1600]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uGustOrigin').map((c) => [c[2], c[3]]), [[800, -1600]]);
  b.origin = [1600, 0, -1600]; b.gustOrigin = [1600, -1600];
  calls.length = 0;
  tm.draw(r, I, I, 1, { windV: [1, 0] }, [1, 1, 1], [a, b]);
  assert.equal(tm.count, 3);
  assert.equal(calls.filter((c) => c[0] === 'bindTexture').length, 1, 'the record\u2019s texture binds once for two pixels');
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 2);
  assert.ok(calls.some((c) => c[0] === 'enable' && c[1] === 2929) && calls.some((c) => c[0] === 'depthMask' && c[1] === true), 'a tree is drawn in the world\u2019s depth');
  // no texture uploaded yet: no tree this frame, no trap
  calls.length = 0;
  tm.draw(stubRenderer(new Map()), I, I, 1, { windV: [1, 0] }, [1, 1, 1], [a, b]);
  assert.equal(tm.count, 0);
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 0);
});

test('TR6: the crown-top speaks the pipeline\u2019s pixel shape - `colors` in, `colors` out - and the top raster is made once per record', () => {
  // getColor32 answers { colors, width, height }; TR1 read `.data` (every
  // alpha 0, an empty raster) and returned `.data`, which uploadTexture
  // (reading `.colors`) could not upload - so the try/catch dropped
  // every top. MUTANT: read `.data` again and the sprite below is empty.
  const sp = treeSprite();
  const bm = { width: sp.width, height: sp.height, data: new Uint8Array(sp.width * sp.height).map((_, i) => (sp.colors[i * 4 + 3] ? 1 : 0)) };
  const top = synthesizeCrownTop(sp, opaqueBox(bm));
  assert.ok(top.colors instanceof Uint8ClampedArray && top.colors.length === top.width * top.height * 4, 'the raster is not in uploadTexture\u2019s shape');
  assert.ok(!('data' in top), 'the raster carries the old name');
  assert.equal(synthesizeCrownTop({ width: sp.width, height: sp.height, data: sp.colors }, opaqueBox(bm)), null, 'the old shape is refused, never an empty raster');
  assert.match(rd('src/render/renderer.js'), /gl\.RGBA, gl\.UNSIGNED_BYTE, asBytes\(color32\.colors\)/, 'the upload law this rests on moved');
  assert.match(rd('src/formats/baseImageFile.js'), /return \{ colors, width: dstWidth, height: dstHeight \};/, 'getColor32\u2019s shape moved');
  // once per record: two pixels, one synthesis, one upload
  const { gl } = glStub();
  const tm = new TreeModelRenderer(gl);
  const uploads = [];
  const opts = { color32: sp, upload: (k, raster) => uploads.push([k, raster.width]) };
  const a = tm.build('0,0', 500, 3, REC, [[1, 0, 1]], 12, bm, opts);
  const b = tm.build('1,0', 500, 3, REC, [[5, 0, 5]], 12, bm, opts);
  assert.equal(uploads.length, 1, 'the top was remade per pixel');
  assert.equal(uploads[0][0], '3#top');
  assert.equal(a.geom.topKey, '500_3#top'); assert.ok(a.topVao && b.topVao, 'both pixels draw the shared top');
  assert.equal(a.geom.top.count, 3);
});
