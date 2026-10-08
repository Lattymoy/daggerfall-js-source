// LPT1 (2026-10-05, the owner: "Next mod to integrate is this ... Its important we make this compatible with seasons of
// daggerfall, ensure performance doesnt take a hit and draw distance can remain the same. A true visual overhaul with no
// performance loss"): LOW POLY TREES 5 (SquidKamer). bible/07-Rendering/Low-Poly-Trees.md is the design and
// bible/01-Overview/Audit-Low-Poly-Trees.md the audit; this file pins the pure module (world/lowPolyTrees.js), the
// vendored data, the renderer's mesh mode and handover, the host's door (systems/lowPolyTreesAssets.js) and the two
// exterior hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LPT_ORIENTATIONS, orientedSize, orientedSource, orientedStep, synthTop, tileCrop, fitRecord, fillCells, fillPicture, LPT_FILL_CELL,
  decodeErase, composeAtlas, paintAtlas, atlasMips, atlasMipSteps, LPT_MIP_TEXELS, readLowPolyTrees, lptProto, LPT_ARCHIVES,
  renderImpostor, impostorSteps, trimImpostor, LPT_IMPOSTOR_TEXELS, LPT_IMPOSTOR_TRIS, LPT_IMPOSTOR_MAX, LPT_IMPOSTOR_MIN, LPT_IMPOSTOR_PER_M,
  LPT_IMPOSTOR_LIGHT, LPT_SCALE_MIN, LPT_SCALE_MAX, lptVariety, LPT_NEAR_M, LPT_BAND_M, LPT_SET_FLOATS, LPT_INSTANCE_FLOATS,
  buildTreeSet, gatherNear, cullNear, runSteps, LPT_SNOW,
} from '../src/world/lowPolyTrees.js';
import { packErase } from '../tools/lowPolyTreesExtract.mjs';
import {
  createLowPolyTrees, LPT_REGATHER_M, LPT_IDLE_S, LPT_PIC_IDLE_S, LPT_ATLAS_BAND, nearestRgba, topDownOf, lptAlphaOf,
} from '../src/systems/lowPolyTreesAssets.js';
import { LowPolyTreesGpu } from '../src/render/lowPolyTreesRender.js';
import { LPT_FS_HEAD, LPT_FS_KEEP, LPT_FS_TEXEL } from '../src/render/lowPolyTreesGlsl.js';
import { Renderer, WORLD_FRAME, bbVertexShader, bbCornerX, LPT_SUN_FULL } from '../src/render/renderer.js';
import { EL_LANE, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { FOREST_STAMP, sinkFelled } from '../src/scenes/treeHost.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { SeasonHelper } from '../src/systems/seasonsIliacBay.js';
import { SEASONS } from '../src/systems/gameDate.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const bytes = (p) => new Uint8Array(readFileSync(join(ROOT, p)));
const V = 'vendor/low-poly-trees/Trees';
const JSON_ = JSON.parse(read(`${V}/trees.json`));
const LPT = readLowPolyTrees(JSON_, bytes(`${V}/trees.bin`), bytes(`${V}/atlases.bin`));

/** A record, top-down RGBA: each texel its own colour (x, y, and the record), so a misplaced copy shows. */
const rec = (w, h, id = 1, hole = null) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = (y * w + x) * 4;
    if (hole && hole(x, y)) continue;
    data[d] = x; data[d + 1] = y; data[d + 2] = id; data[d + 3] = 255;
  }
  return { width: w, height: h, data };
};
const px = (pic, x, y) => Array.from(pic.data.subarray((y * pic.width + x) * 4, (y * pic.width + x) * 4 + 4));
const near = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;

// ---- the vendored data --------------------------------------------------------------------------------------------

test('LPT1 the vendored data: 253 prototypes over the twelve nature archives, 116 meshes, 30 atlases each a spec - and no picture: only the manifest, the README, the geometry and the specs (a render of game data is game data)', () => {
  assert.equal(LPT.protos.size, 253);
  assert.equal(JSON_.meshes.length, 116);
  assert.equal(Object.keys(JSON_.atlases).length, 30);
  assert.ok(Object.values(JSON_.atlases).every((a) => !a.same && a.blits), 'thirty distinct specs');
  assert.deepEqual([...new Set([...LPT.protos.values()].map((p) => p.archive))].sort((a, b) => a - b), [...LPT_ARCHIVES]);
  for (const p of LPT.protos.values()) {
    assert.ok(JSON_.meshes[p.mesh], `${p.key}: its mesh`);
    assert.ok(p.size.w > 0 && p.size.h >= 0.5, `${p.key}: a standing size`);
    assert.equal(p.subs.length, JSON_.meshes[p.mesh].subs.length, `${p.key}: a material a submesh`);
    for (const s of p.subs) if (s.atlas) assert.ok(LPT.atlases[s.atlas]?.blits, `${p.key}: ${s.atlas} is a spec`);
  }
  // the five small pictures are classic records whole: one copy at the origin, no fill
  const whole = { Swamp_Stump1: [501, 19], Swamp_Stump2: [502, 25], Swamp_Tree: [502, 30], '1-0': [508, 1], '3-0.PNG.001': [506, 28] };
  for (const [name, [a, r]] of Object.entries(whole)) {
    const s = LPT.atlases[name];
    assert.deepEqual([s.blits.length, s.fills?.length ?? 0, s.blits[0].slice(0, 6)], [1, 0, [a, r, 0, 0, 0, 0]], name);
  }
  const files = readdirSync(join(ROOT, 'vendor/low-poly-trees'), { recursive: true }).map(String).filter((f) => /\.\w+$/.test(f)).sort();
  assert.deepEqual(files, ['README.md', 'Trees/atlases.bin', 'Trees/trees.bin', 'Trees/trees.json', 'lowpolytrees.dfmod.json'].sort());
  // the geometry's length is what the index says - vertices, then every submesh's u16 indices (padded to four)
  const idx = JSON_.meshes.reduce((n, m) => n + m.subs.reduce((k, s) => k + s[1], 0), 0);
  const bin = bytes(`${V}/trees.bin`);
  assert.equal(bin.length, JSON_.vertexBytes + idx * 2 + ((idx * 2) % 4 ? 2 : 0));
  const u16 = new Uint16Array(bin.buffer, bin.byteOffset + JSON_.vertexBytes, idx);
  for (const m of JSON_.meshes) for (const [at, n] of m.subs) for (let k = 0; k < n; k++) assert.ok(u16[m.index + at + k] < m.vertices);
  assert.equal(JSON.parse(read('vendor/low-poly-trees/lowpolytrees.dfmod.json')).ModVersion, '5');
  // a prototype's standing size is its mesh's box under its root's scale: 500_1 is mesh 0 at 0.2
  const m0 = JSON_.meshes[0], p1 = lptProto(LPT, 500, 1);
  assert.deepEqual(JSON_.prefabs['500_1'].scale, [0.2, 0.2, 0.2]);
  assert.ok(near(p1.size.w, 2 * 0.2 * Math.max(...[...m0.min, ...m0.max].filter((_, i) => i % 3 !== 1).map(Math.abs)), 1e-5) && near(p1.size.h, 0.2 * m0.max[1], 1e-5));
});

test('LPT1 each submesh carries its material whole (AUDIT LPT C6/A4/A6): its cut, the faces it draws and its colour', () => {
  const subs = [...LPT.protos.values()].flatMap((p) => p.subs);
  assert.deepEqual([...new Set(subs.map((s) => s.cutoff))].sort(), [0.333, 0.5], 'SpeedTree\'s _Cutoff: 0.5, and the 507-511 sets\' 0.333');
  assert.deepEqual([...new Set(subs.map((s) => s.cull))].sort(), [0, 2], 'a leaf card both faces, a trunk its front');
  const swamp = lptProto(LPT, 500, 11).subs;
  assert.deepEqual(swamp.map((s) => [s.atlas, s.opaque, s.cull, s.color]), [['swamp', false, 0, [1, 1, 1]], ['swamp_opaque', true, 2, [0.8, 0.8, 0.8]]], 'Atlas_Opaque: Standard, culled, _Color 0.8');
  assert.equal(lptProto(LPT, 507, 2).subs.find((s) => !s.opaque).cutoff, 0.333);
  assert.equal(lptAlphaOf({ opaque: true, cutoff: 0.5 }), 0, 'an opaque card: no cut');
  assert.equal(lptAlphaOf({ opaque: false, cutoff: 0.5 }), 1);
  assert.ok(near(lptAlphaOf({ opaque: false, cutoff: 0.333 }) * 0.333, 0.5), 'its cut brought to the flats\' 0.5');
});

test('LPT1 lptProto: an archive and record the mod has a tree for, else null - and null before the data is read', () => {
  assert.equal(lptProto(LPT, 504, 12)?.key, '504_12');
  assert.equal(lptProto(LPT, 504, 999), null);
  assert.equal(lptProto(null, 504, 12), null);
});

// ---- the atlases --------------------------------------------------------------------------------------------------

test('LPT1 orientations: the eight ways a record lands are a bijection of its texels, a quarter turn swaps the sides, bit 0 mirrors x', () => {
  const w = 5, h = 3;
  for (let o = 0; o < LPT_ORIENTATIONS; o++) {
    const [ow, oh] = orientedSize(w, h, o);
    assert.deepEqual([ow, oh], o & 2 ? [h, w] : [w, h]);
    const seen = new Set();
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const [sx, sy] = orientedSource(o, w, h, x, y);
      assert.ok(sx >= 0 && sx < w && sy >= 0 && sy < h);
      seen.add(sy * w + sx);
    }
    assert.equal(seen.size, w * h, `orientation ${o} reaches every texel once`);
  }
  assert.deepEqual(orientedSource(0, w, h, 1, 2), [1, 2]);
  assert.deepEqual(orientedSource(1, w, h, 1, 2), [3, 2], 'mirrored in x');
  assert.deepEqual(orientedSource(4, w, h, 0, 0), [w - 1, h - 1], 'a half turn');
  assert.deepEqual([orientedSource(2, w, h, 0, 0), orientedSource(6, w, h, 0, 0)], [[0, h - 1], [w - 1, 0]], 'a quarter turn one way, three quarters the other');
  // the blit's own form (AUDIT LPT B7): one affine step a blit, the same texel for every place and orientation
  for (let o = 0; o < LPT_ORIENTATIONS; o++) {
    const [sx0, sxdx, sxdy, sy0, sydx, sydy] = orientedStep(o, w, h), [ow, oh] = orientedSize(w, h, o);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) assert.deepEqual([sx0 + sxdx * x + sxdy * y, sy0 + sydx * x + sydy * y], orientedSource(o, w, h, x, y), `o ${o} at ${x},${y}`);
  }
});

test('LPT1 erase spans: packed by the tool (LEB128, rows as steps) and read back exactly by the game', () => {
  const spans = [10, 4, 9, 10, 20, 300, 12, 4, 5, 400, 2, 1000];
  const packed = Uint8Array.from(packErase(spans, 2, 8));
  assert.deepEqual(decodeErase(packed, 0, 4, 2, 8), spans);
  assert.throws(() => decodeErase(null, 0, 1, 0, 0), /no atlases\.bin/);
  assert.throws(() => packErase([5, 0, 3, 4, 0, 3], 0, 0), /out of order/, 'a span above the last is no step');
});

test('LPT1 composeAtlas: a blit paints its oriented record at its place inside its clip, the first paint holds a texel, an erase span keeps the copy off, a clear texel stays clear, and a record the player lacks paints nothing and is counted (AUDIT LPT B9)', () => {
  const A = rec(4, 3, 1, (x, y) => x === 3 && y === 2), B = rec(4, 3, 2);
  const spec = { size: [16, 8], blits: [
    [500, 1, 0, 0, 2, 1, 0, 0, 16, 8, [1, 3, 4]],   // upright at (2,1), its (1,0) erased (atlas y 1, x 3)
    [500, 2, 0, 1, 3, 1, 0, 0, 16, 8],   // mirrored, overlapping: the first paint holds
    [500, 2, 0, 2, 10, 2, 10, 2, 12, 8],   // a quarter turn (3 wide, 4 tall), clipped to two columns
    [500, 9, 0, 0, 0, 0, 0, 0, 16, 8],   // a record the player's data lacks
  ] };
  const pic = composeAtlas(spec, (a, r) => (r === 1 ? A : r === 2 ? B : null));
  assert.deepEqual(px(pic, 2, 1), [0, 0, 1, 255]);
  assert.deepEqual(px(pic, 3, 1), [3, 0, 2, 255], 'erased from the first copy, so the second (mirrored: its x 0 the record\'s 3) paints it');
  assert.deepEqual(px(pic, 4, 2), [2, 1, 1, 255], 'the first paint holds');
  assert.deepEqual(px(pic, 5, 3), [1, 2, 2, 255], 'the first copy\'s clear texel left for the second');
  assert.deepEqual(px(pic, 6, 3), [0, 2, 2, 255], 'the mirrored copy\'s last column');
  const [sx, sy] = orientedSource(2, 4, 3, 0, 0);
  assert.deepEqual(px(pic, 10, 2), [sx, sy, 2, 255], 'turned a quarter');
  assert.equal(px(pic, 12, 2)[3], 0, 'outside its clip, nothing');
  assert.equal(px(pic, 0, 0)[3], 0, 'the lacking record paints nothing');
  assert.equal(pic.missing, 1, '...and is counted');
  assert.equal(composeAtlas(spec, (a, r) => (r === 9 ? A : r === 1 ? A : B)).missing, 0);
  // the steps are the blits and fills, one a step - and the generator's answer is composeAtlas's
  const g = paintAtlas(spec, (a, r) => (r === 1 ? A : r === 2 ? B : null));
  let n = 0, r = g.next();
  while (!r.done) { n++; r = g.next(); }
  assert.equal(n, spec.blits.length - 1, 'a step a blit painted (the lacking record none)');
  assert.deepEqual(r.value.data, pic.data);
});

test('LPT1 fills: a top folds the record\'s crown (a disc, snow-capped in winter), a tile repeats a crop mirrored, a fit stretches the record\'s drawn box (mirrored when it says); each paints only its own cells and never over a copy', () => {
  const tree = rec(16, 24, 3, (x, y) => (y < 8 && (x < 4 || x > 11)) || y > 18);
  const top = synthTop(tree, 12, 12);
  assert.equal(px(top, 0, 0)[3], 0, 'a disc: the corner is clear');
  assert.equal(px(top, 6, 6)[3], 255);
  const snowy = synthTop(tree, 12, 12, { snow: true });
  const c = px(snowy, 6, 6), plain = px(top, 6, 6);
  assert.ok(c[0] > plain[0] && Math.abs(c[0] - LPT_SNOW[0]) < Math.abs(plain[0] - LPT_SNOW[0]), 'snow whitens the middle');
  const tile = tileCrop(rec(8, 8, 4), 6, 3, 2, 2, 2, 2);
  assert.deepEqual([px(tile, 0, 0)[0], px(tile, 1, 0)[0], px(tile, 2, 0)[0], px(tile, 3, 0)[0]], [2, 3, 3, 2], 'mirrored at every other repeat');
  assert.deepEqual([px(tile, 0, 0)[1], px(tile, 0, 1)[1], px(tile, 0, 2)[1]], [2, 3, 3], '...down as across');
  assert.deepEqual(fillPicture(['top', 500, 3, 0, 0, 12, 12, 1], tree).data, snowy.data, 'a top\'s snow flag reaches the fold');
  assert.deepEqual(fillPicture(['top', 500, 3, 0, 0, 12, 12, 0], tree).data, top.data);
  // a fit: the drawn box (x 2..5, y 1..2 of an 8 x 4 record) over 8 x 4 - each texel the box's at its share
  const boxed = rec(8, 4, 5, (x, y) => x < 2 || x > 5 || y < 1 || y > 2);
  const fit = fitRecord(boxed, 8, 4);
  assert.deepEqual([px(fit, 0, 0), px(fit, 7, 3)], [[2, 1, 5, 255], [5, 2, 5, 255]], 'corner to corner');
  assert.deepEqual(px(fitRecord(boxed, 8, 4, true), 0, 0), [5, 1, 5, 255], 'mirrored');
  assert.equal(fitRecord(rec(2, 2, 1, () => true), 4, 4).data.some((v) => v), false, 'a clear record fits nothing');
  assert.deepEqual(fillPicture(['fit', 500, 1, 0, 0, 8, 4, 1], boxed).data, fitRecord(boxed, 8, 4, true).data);
  assert.throws(() => fillPicture(['blur', 500, 1, 0, 0, 2, 2], boxed), /a fill of kind blur/);
  // cells: 16 x 8 in 8-texel cells is two cells; '8' sets only the first - a top's and a fit's map is its ninth field, a tile's its twelfth
  assert.deepEqual(Array.from(fillCells(['tile', 500, 1, 0, 0, 16, 8, 0, 0, 2, 2, '8'])), [1, 0]);
  assert.deepEqual(Array.from(fillCells(['fit', 500, 1, 0, 0, 16, 8, 0, '4'])), [0, 1]);
  assert.deepEqual(Array.from(fillCells(['top', 500, 1, 0, 0, 16, 8, 0, 'c'])), [1, 1]);
  assert.equal(fillCells(['top', 500, 1, 0, 0, 16, 8, 0]), null, 'no map: the whole rectangle');
  const spec = { size: [16, 8], blits: [[500, 1, 0, 0, 0, 0, 0, 0, 2, 2]], fills: [['tile', 500, 2, 0, 0, 16, 8, 0, 0, 2, 2, '8']] };
  const pic = composeAtlas(spec, (a, r) => (r === 1 ? rec(2, 2, 1) : rec(4, 4, 2)));
  assert.equal(px(pic, 0, 0)[2], 1, 'the copy holds its texel');
  assert.equal(px(pic, 5, 5)[2], 2, 'the fill paints its cell');
  assert.equal(px(pic, 12, 4)[3], 0, 'and nothing outside its cells');
  assert.equal(LPT_FILL_CELL, 8);
});

test('LPT1 every vendored atlas paints from records of the classic sizes without a throw, every fill a top, a tile or a fit, the steps a blit or a fill each', () => {
  const recs = new Map();
  const recordRgba = (a, r) => { const k = `${a}_${r}`; if (!recs.has(k)) recs.set(k, rec(48 + (r % 5) * 8, 64 + (r % 3) * 16, r)); return recs.get(k); };
  for (const [name, spec] of Object.entries(LPT.atlases)) {
    let steps = 0;
    const g = paintAtlas(spec, recordRgba, LPT.atlasesBin);
    let r = g.next();
    while (!r.done) { steps++; r = g.next(); }
    assert.equal(steps, spec.blits.length + (spec.fills?.length ?? 0), name);
    assert.deepEqual([r.value.width, r.value.height, r.value.missing], [...spec.size, 0], name);
    for (const f of spec.fills ?? []) assert.ok(['top', 'tile', 'fit'].includes(f[0]), `${name}: ${f[0]}`);
  }
});

test('LPT1 atlasMips: the chain halves to 1x1, a level\'s colour is its DRAWN texels\' mean (a clear texel never darkens a leaf\'s edge) and its alpha the four\'s mean; a step is LPT_MIP_TEXELS texels\' whole rows (AUDIT LPT B7)', () => {
  const pic = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4) };
  for (let i = 0; i < 8; i++) pic.data.set([90, 90, 90, 0], i * 4);   // clear texels with a colour of their own, which must not bleed in
  pic.data.set([200, 100, 50, 255], 0);   // one drawn texel of the first 2x2, three clear
  pic.data.set([10, 20, 30, 255, 30, 40, 50, 255], 8);   // two of the second's top row
  const mips = atlasMips(pic);
  assert.deepEqual(mips.map((m) => [m.width, m.height]), [[4, 2], [2, 1], [1, 1]]);
  assert.deepEqual(px(mips[1], 0, 0), [200, 100, 50, 64], 'the drawn colour, a quarter alpha');
  assert.deepEqual(px(mips[1], 1, 0), [20, 30, 40, 128]);
  // an odd edge: the last column and row read themselves again
  const odd = atlasMips({ width: 3, height: 1, data: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 40, 80, 120, 255]) });
  assert.deepEqual(px(odd[1], 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(odd.map((m) => m.width), [3, 1]);
  const big = { width: 512, height: 512, data: new Uint8Array(512 * 512 * 4) };
  let n = 0;
  const g = atlasMipSteps(big);
  let r = g.next();
  while (!r.done) { n++; r = g.next(); }
  assert.equal(LPT_MIP_TEXELS, 16384);
  assert.equal(n, 256 / (LPT_MIP_TEXELS / 256) - 1 + 128 / (LPT_MIP_TEXELS / 128) - 1, 'a breath every LPT_MIP_TEXELS texels of whole rows, in each level with more');
  assert.equal(r.value.length, 10);
});

// ---- the far picture ----------------------------------------------------------------------------------------------

/**
 * A ONE-PROTOTYPE MOD, built here: `quads` - each { x0, x1, y0, y1, z, flip } a quad facing -z (the viewer of the far
 * picture) with uv 0..1, its own submesh and material ({ cutoff, cull, color, opaque }); `flip` winds it away.
 */
function synthLpt(quads, atlas, scale = [1, 1, 1]) {
  const verts = [], idx = [], subs = [], materials = {}, mats = [];
  quads.forEach((q, i) => {
    const v = verts.length / 8;
    verts.push(q.x0, q.y0, q.z, 0, 0, -1, 0, 0, q.x1, q.y0, q.z, 0, 0, -1, 1, 0, q.x1, q.y1, q.z, 0, 0, -1, 1, 1, q.x0, q.y1, q.z, 0, 0, -1, 0, 1);
    subs.push([idx.length, 6]);
    idx.push(...(q.flip ? [v, v + 1, v + 2, v, v + 2, v + 3] : [v, v + 2, v + 1, v, v + 3, v + 2]));
    materials[`m${i}`] = { tex: 'A', cutoff: q.cutoff ?? 0.5, cull: q.cull ?? 0, ...(q.color ? { color: q.color } : {}) };
    mats.push(`m${i}`);
  });
  const vb = new Float32Array(verts), ib = new Uint16Array(idx.length + (idx.length % 2));
  ib.set(idx);
  const bin = new Uint8Array(vb.byteLength + ib.byteLength);
  bin.set(new Uint8Array(vb.buffer), 0); bin.set(new Uint8Array(ib.buffer), vb.byteLength);
  const xs = quads.flatMap((q) => [q.x0, q.x1]), ys = quads.flatMap((q) => [q.y0, q.y1]);
  const json = {
    vertexBytes: vb.byteLength,
    meshes: [{ vertex: 0, vertices: verts.length / 8, index: 0, subs, min: [Math.min(...xs), Math.min(...ys), 0], max: [Math.max(...xs), Math.max(...ys), 0] }],
    materials, atlases: { A: { size: [atlas.width, atlas.height], alpha: !quads.some((q) => q.opaque), blits: [] } },
    prefabs: { '504_1': { mesh: 0, scale, materials: mats } },
  };
  const lpt = readLowPolyTrees(json, bin, new Uint8Array(0));
  return { lpt, proto: lptProto(lpt, 504, 1) };
}
/** A 2 x 2 atlas, top-down: red, green / blue, a pale grey of `alpha`. */
const quadAtlas = (alpha = 255) => ({ width: 2, height: 2, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 200, 200, 200, alpha]) });

test('LPT1 renderImpostor, texel for texel: the tree as the far picture\'s viewer sees it (from -z, +x to the right, its uv v=0 the picture\'s bottom), lit by LPT_IMPOSTOR_LIGHT, coloured by its material, cut at its own cut (AUDIT LPT A4/C6)', () => {
  const { lpt, proto } = synthLpt([{ x0: -1, x1: 1, y0: 0, y1: 2, z: 0, cutoff: 0.333, color: [0.5, 1, 1] }], quadAtlas(85));
  assert.deepEqual(proto.size, { w: 2, h: 2 });
  const H = Math.round(Math.max(LPT_IMPOSTOR_MIN, 2 * LPT_IMPOSTOR_PER_M));
  const sh = 0.72 + 0.28 * -LPT_IMPOSTOR_LIGHT[2];   // a face toward the viewer
  const pic = renderImpostor(lpt, proto, () => quadAtlas(85));
  assert.deepEqual([pic.width, pic.height, pic.shareW, pic.shareH], [H, H, 1, 1]);
  assert.deepEqual(px(pic, 0, 0), [Math.round(255 * sh * 0.5), 0, 0, 255], 'top-left: the atlas\'s top-left, its red halved by the material');
  assert.deepEqual(px(pic, H - 1, 0), [0, Math.round(255 * sh), 0, 255], 'top-right: green');
  assert.deepEqual(px(pic, 0, H - 1), [0, 0, Math.round(255 * sh), 255], 'bottom-left: blue');
  assert.deepEqual(px(pic, H - 1, H - 1), [Math.round(200 * sh * 0.5), Math.round(200 * sh), Math.round(200 * sh), 255], 'alpha 85 holds at a cut of 0.333');
  const cut = renderImpostor(lpt, proto, () => quadAtlas(84));
  assert.equal(px(cut, H - 1, H - 1)[3], 0, 'alpha 84 is cut');
  assert.equal(px(cut, 0, H - 1)[3], 255);
  // the root's scale: a half-size quad at twice the scale is the same tree, texel for texel
  const big = synthLpt([{ x0: -0.5, x1: 0.5, y0: 0, y1: 1, z: 0, cutoff: 0.333, color: [0.5, 1, 1] }], quadAtlas(85), [2, 2, 2]);
  assert.deepEqual(big.proto.size, { w: 2, h: 2 });
  assert.deepEqual(renderImpostor(big.lpt, big.proto, () => quadAtlas(85)).data, pic.data);
  // the nearer face holds its texel whichever is drawn first: the near quad (z -1, white) before the far (z 1, no red)
  const both = synthLpt([{ x0: -1, x1: 1, y0: 0, y1: 2, z: -1 }, { x0: -1, x1: 1, y0: 0, y1: 2, z: 1, color: [0, 1, 1] }], quadAtlas());
  assert.equal(px(renderImpostor(both.lpt, both.proto, () => quadAtlas()), 0, 0)[0], Math.round(255 * sh), 'the depth test');
});

test('LPT1 renderImpostor: a front-only material (cull 2) draws its front faces alone, a two-sided one both (AUDIT LPT A6); an opaque card is never cut; the picture is trimmed to what it draws, the root centred (AUDIT LPT B6)', () => {
  const both = synthLpt([{ x0: -1, x1: 1, y0: 0, y1: 2, z: 0, flip: true }], quadAtlas()).lpt;
  const front = synthLpt([{ x0: -1, x1: 1, y0: 0, y1: 2, z: 0, flip: true, cull: 2 }], quadAtlas()).lpt;
  const drawn = (l) => renderImpostor(l, lptProto(l, 504, 1), () => quadAtlas()).data.some((v, i) => i % 4 === 3 && v);
  assert.equal(drawn(both), true, 'two-sided: its back drawn');
  assert.equal(drawn(front), false, 'front-only: its back is not');
  assert.equal(drawn(synthLpt([{ x0: -1, x1: 1, y0: 0, y1: 2, z: 0, cull: 2 }], quadAtlas()).lpt), true, '...its front is');
  const clear = { width: 2, height: 2, data: new Uint8Array(16) };
  const opaque = synthLpt([{ x0: -1, x1: 1, y0: 0, y1: 2, z: 0, opaque: true }], clear).lpt;
  assert.equal(lptProto(opaque, 504, 1).subs[0].opaque, true);
  assert.equal(renderImpostor(opaque, lptProto(opaque, 504, 1), () => clear).data.some((v, i) => i % 4 === 3 && v), true, 'an opaque card is never cut');
  // a narrow trunk in a wide crown's reach: the picture keeps the trunk, a column either side alike, up to its top
  const { lpt, proto } = synthLpt([{ x0: -0.25, x1: 0.25, y0: 0, y1: 2, z: 0 }, { x0: -2, x1: -1.9, y0: 0, y1: 0.1, z: 1 }], quadAtlas());
  const full = renderImpostor(lpt, proto, () => quadAtlas());
  assert.ok(full.shareW === 1, 'the little card at the reach\'s edge keeps the whole width');
  const t = trimImpostor({ width: 8, height: 6, data: (() => { const d = new Uint8Array(8 * 6 * 4); for (const [x, y] of [[3, 2], [5, 5]]) d[(y * 8 + x) * 4 + 3] = 255; return d; })() });
  assert.deepEqual([t.width, t.height, t.shareW, t.shareH], [4, 4, 4 / 8, 4 / 6], 'the top\'s two clear rows off, and as many columns off each side as the nearer edge leaves (two), never the bottom');
  assert.deepEqual([t.data[(0 * 4 + 1) * 4 + 3], t.data[(3 * 4 + 3) * 4 + 3]], [255, 255], 'each texel where it was, less the side and the top');
  const none = trimImpostor({ width: 4, height: 4, data: new Uint8Array(64) });
  assert.deepEqual([none.width, none.shareW, none.shareH], [4, 1, 1], 'nothing drawn: as it was');
});

test('LPT1 impostorSteps: a step is LPT_IMPOSTOR_TEXELS texels of triangles\' reach or LPT_IMPOSTOR_TRIS triangles, whichever comes first (AUDIT LPT B7) - and its answer is renderImpostor\'s', () => {
  // eight strips of a 40 m tree: each triangle's box is the picture's width by an eighth of its height (+1 row)
  const quads = Array.from({ length: 8 }, (_, i) => ({ x0: -20, x1: 20, y0: i * 5, y1: (i + 1) * 5, z: 0 }));
  const { lpt, proto } = synthLpt(quads, quadAtlas());
  let steps = 0;
  const g = impostorSteps(lpt, proto, () => quadAtlas());
  let r = g.next();
  while (!r.done) { steps++; r = g.next(); }
  assert.deepEqual([LPT_IMPOSTOR_TEXELS, LPT_IMPOSTOR_TRIS], [4096, 256]);
  assert.equal(r.value.height, LPT_IMPOSTOR_MAX);
  assert.equal(steps, 15, 'sixteen triangles of 256 x 33 texels: a breath before each after the first');
  assert.deepEqual(r.value.data, renderImpostor(lpt, proto, () => quadAtlas()).data);
  // the mod's largest (509_11, 4,488 small triangles, a 55 x 24 picture): a breath every LPT_IMPOSTOR_TRIS of them
  const big = lptProto(LPT, 509, 11), solid = { width: 8, height: 8, data: new Uint8Array(256).fill(200) };
  let n = 0;
  const gb = impostorSteps(LPT, big, () => solid);
  let rb = gb.next();
  while (!rb.done) { n++; rb = gb.next(); }
  assert.equal(n, Math.ceil(4488 / LPT_IMPOSTOR_TRIS) - 1, `${n} breaths: one every LPT_IMPOSTOR_TRIS triangles, across its submeshes`);
  assert.ok(rb.value.data.subarray((rb.value.height - 1) * rb.value.width * 4).some((v, i) => i % 4 === 3 && v), 'it stands on the ground');
});

// ---- a tree's own draw, the near set --------------------------------------------------------------------------------

test('LPT1 lptVariety: a wilderness tree takes DFU\'s terrain scale (0.6-1.4) and any turn, and NO tint (AUDIT LPT C1: none of the mod\'s shaders reads _TreeInstanceColor); a location\'s the prefab as it is, turned; the same place answers the same tree on every client', () => {
  assert.deepEqual([LPT_SCALE_MIN, LPT_SCALE_MAX], [0.6, 1.4]);
  let lo = Infinity, hi = -Infinity;
  const yaws = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = lptVariety(10, 20, i * 0.73, i * 1.31, false);
    lo = Math.min(lo, v.scale); hi = Math.max(hi, v.scale);
    assert.deepEqual(Object.keys(v).sort(), ['scale', 'yaw']);
    assert.ok(v.yaw >= 0 && v.yaw < Math.PI * 2);
    yaws.add(Math.floor(v.yaw * 4));
  }
  assert.ok(lo < 0.65 && hi > 1.35, 'the whole range');
  assert.equal(yaws.size, 26, 'every turn');
  assert.deepEqual(lptVariety(10, 20, 3.5, 7.25, false), lptVariety(10, 20, 3.5, 7.25, false));
  assert.notDeepEqual(lptVariety(10, 20, 3.5, 7.25, false), lptVariety(11, 20, 3.5, 7.25, false), 'the pixel is in it');
  const l = lptVariety(10, 20, 3.5, 7.25, true);
  assert.equal(l.scale, 1);
  assert.equal(l.yaw, lptVariety(10, 20, 3.5, 7.25, false).yaw);
  assert.ok(!read('src/world/lowPolyTrees.js').includes('_TINT'), 'no tint left');
});

test('LPT1 buildTreeSet: a pixel\'s trees made from its far pictures\' groups when it comes near (AUDIT LPT B10) - [handle, x, y, z, scale, turn] a tree, the terrain\'s own flats alone varied, each tree\'s centre the flat\'s own', () => {
  const a = [1, 0, 2], b = [5, 1, 6], c = [9, 0, 9];
  const { trees, centers } = buildTreeSet(3, 4, [{ h: 0, centers: [a, b], wild: Uint8Array.from([1, 0]) }, { h: 1, centers: [c], wild: null }]);
  assert.equal(LPT_SET_FLOATS, 6);
  assert.equal(trees.length, 3 * LPT_SET_FLOATS);
  assert.deepEqual(centers, [a, b, c], 'the flats\' own arrays (FELLED holds them)');
  assert.strictEqual(centers[0], a);
  const v = lptVariety(3, 4, 1, 2, false), w = lptVariety(3, 4, 5, 6, true), x = lptVariety(3, 4, 9, 9, true);
  assert.deepEqual(Array.from(trees), [0, 1, 0, 2, v.scale, v.yaw, 0, 5, 1, 6, 1, w.yaw, 1, 9, 0, 9, 1, x.yaw].map(Math.fround));
});

test('LPT1 gatherNear: every standing tree within the radius and band of the eye, at its pixel\'s translation, grouped by handle as [x, y, z, turn, scale]; a skipped (felled) tree is none; the scratch is reused', () => {
  const ha = { key: 'a' }, hb = { key: 'b' };
  const set = { ox: 100, oy: 5, oz: -50, handles: [ha, hb], trees: Float32Array.from([
    0, 0, 1, 0, 1.2, 0.5,
    1, 10, 2, 0, 0.7, 1.5,
    0, 200, 0, 0, 1, 0,   // 200 m off
    0, 20, 3, 0, 1, 2.5,
  ]) };
  const g = gatherNear([set], 100, -50, LPT_NEAR_M, LPT_BAND_M);
  assert.equal(g.count, 3);
  assert.deepEqual(g.runs.map((r) => [r.handle.key, r.start, r.count, r.drawStart, r.drawCount]), [['a', 0, 2, 0, 2], ['b', 2, 1, 2, 1]]);
  assert.equal(LPT_INSTANCE_FLOATS, 5);
  assert.deepEqual(Array.from(g.data.subarray(0, 5)), [100, 6, -50, 0.5, Math.fround(1.2)]);
  assert.deepEqual(Array.from(g.data.subarray(10, 15)), [110, 7, -50, 1.5, Math.fround(0.7)]);
  const felled = gatherNear([set], 100, -50, LPT_NEAR_M, LPT_BAND_M, g.data, (s, i) => i === 0);
  assert.equal(felled.count, 2);
  assert.equal(felled.data, g.data, 'the scratch reused');
  assert.equal(gatherNear([set], 110, -50 + LPT_NEAR_M + LPT_BAND_M + 1, LPT_NEAR_M, LPT_BAND_M).count, 0, 'past the radius and the band: none');
  assert.equal(gatherNear([{ ...set, trees: null }], 100, -50, LPT_NEAR_M, LPT_BAND_M).count, 0, 'a set not yet made: none');
  assert.deepEqual([LPT_NEAR_M, LPT_BAND_M], [140, 20]);
});

test('LPT1 cullNear (AUDIT LPT B4): each run\'s trees whose sphere - about its middle, at its own scale - touches the view, packed run by run with drawStart/drawCount; no planes keep every tree; nothing allocated once grown', () => {
  const h = { proto: { size: { w: 6, h: 8 } } }, k = { proto: { size: { w: 2, h: 2 } } };
  const gathered = gatherNear([{ ox: 0, oy: 0, oz: 0, handles: [h, k], trees: Float32Array.from([
    0, 0, 0, 0, 1, 0,     // h at x 0: in
    0, -9, 0, 0, 1, 0,    // h at x -9: its sphere (5 m) short of the plane
    0, -9, 0, 0, 2, 0,    // h at x -9, twice the size: reaches it
    1, -3, 0, 0, 1, 0,    // k at x -3: its sphere (1.41 m) short
  ]) }], 0, 0, 100, 0);
  const planes = new Float32Array(24);
  for (let p = 0; p < 6; p++) planes[p * 4 + 3] = 1;   // five planes every tree is inside...
  planes.set([1, 0, 0, 0], 0);   // ...and x >= 0, less the sphere's radius
  const vis = cullNear(gathered, planes);
  assert.equal(vis.count, 2);
  assert.deepEqual(gathered.runs.map((r) => [r.drawStart, r.drawCount]), [[0, 2], [2, 0]]);
  assert.deepEqual([vis.data[0], vis.data[5], vis.data[9]], [0, -9, 2], 'the in tree, then the doubled one');
  const all = cullNear(gathered, null, vis.data);
  assert.equal(all.count, 4);
  assert.equal(all.data, vis.data, 'the scratch reused');
  assert.deepEqual(gathered.runs.map((r) => [r.drawStart, r.drawCount]), [[0, 3], [3, 1]]);
});

// ---- the renderer -------------------------------------------------------------------------------------------------

test('LPT1 a flat\'s scale rides on its corner: bbCornerX packs it and BB_VS reads it back (|x| twice over) - a classic flat\'s corner is its own', () => {
  assert.equal(bbCornerX(-0.5), -0.5);
  assert.equal(bbCornerX(0.5, 1), 0.5);
  for (const s of [1, 0.6 / 1.4, 0.43]) for (const x of [-0.5, 0.5]) {
    assert.ok(near(Math.abs(Math.fround(bbCornerX(x, s))) * 2, s), `scale ${s}`);
    assert.equal(Math.sign(bbCornerX(x, s)), Math.sign(x));
  }
});

const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BBU = { uProj: I16, uView: I16, uRight: [1, 0, 0], uUp: [0, 1, 0], uOrigin: [0, 0, 0], uSize: [2, 4], uFlatWind: [0, 0, 0, 0], uSway: 0, uTip: [0, 0, 0], uFacePoint: [0, 0, 0, 0], uElitePad: [0, 0, 0, 0], uMesh: 0, uMeshScale: [1, 1, 1], uMeshColor: [1, 1, 1], uMeshAlpha: 1, uLptCut: [0, 0, 0, 0], uLptBand: 20, uLptSun: [0, 1, 0, 0], aNormal: [0, 1, 0], aInst: [0, 0, 0, 0], aScale: 1 };
const bbAt = (b) => { const f = glslFunctions(bbVertexShader(), { ...BBU, ...b }, { fp32: true }); f.main(); return f.globals; };
const v3 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4 + 0);   // + 0: no -0

test('LPT1 BB_VS: a far picture\'s quad is its share of the batch\'s size about its base, its uv the picture\'s whole, its shade and alpha a flat\'s; inside the radius it is gone, across the band it fades', () => {
  const top = bbAt({ aCenter: [10, 0, 0], aCorner: [bbCornerX(0.5, 0.5), 0.5] });
  assert.deepEqual(v3(top.vBBWorld), [10.5, 2, 0], 'half the width and half the height');
  assert.deepEqual(top.vUV, [1, 1]);
  assert.deepEqual([top.vShade, top.vAlpha], [[1, 1, 1], 1]);
  const plain = bbAt({ aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  assert.deepEqual(plain.vBBWorld, [11, 4, 0], 'a classic flat as it was');
  const cut = (d) => bbAt({ aCenter: [d, 0, 0], aCorner: [0.5, -0.5], uLptCut: [0, 0, 0, 140] });
  assert.deepEqual(cut(100).gl_Position, [2, 2, 2, 1], 'inside the radius: off the clip volume');
  assert.ok(near(cut(150).vFade, 0.5, 1e-3), 'half across the band');
  assert.equal(cut(300).vFade, 1);
  assert.equal(bbAt({ aCenter: [100, 0, 0], aCorner: [0.5, -0.5] }).vFade, 1, 'no cut uniform, no cut');
  // a felled tree's far picture tips over at its own share (AUDIT LPT D4): its top corner laid down the fall's way
  const fell = bbAt({ aCenter: [10, 0, 0], aCorner: [bbCornerX(0.5, 0.5), 0.5], uTip: [0, 1, Math.PI / 2] });
  assert.deepEqual(v3(fell.vBBWorld), [10.5, 0, 2], 'half its width across, half its height along the ground');
  // a far picture's crown leans by its own share of the batch's size
  const leanAt = (s) => { const at = { aCenter: [10, 0, 0], aCorner: [bbCornerX(0.5, s), 0.5], uFlatWind: [2, 0, 0, 0] }; return bbAt({ ...at, uSway: 1 }).vBBWorld[0] - bbAt(at).vBBWorld[0]; };
  assert.ok(leanAt(1) > 0 && near(leanAt(0.5) / leanAt(1), 0.5, 1e-3), 'a smaller tree leans less');
});

test('LPT1 BB_VS mesh mode: the tree\'s vertex turned about +Y and scaled at its root by its own scale, its uv the mesh\'s, its alpha its material\'s; its share 2 + how far across the band it stands', () => {
  const g = bbAt({ uMesh: 1, uMeshScale: [2, 2, 2], aCenter: [1, 3, 0], aCorner: [0.25, 0.75], aInst: [50, 1, 7, Math.PI / 2], aScale: 1.5, uLptCut: [0, 0, 0, 140], uMeshAlpha: 1.5 });
  assert.deepEqual(v3(g.vBBWorld), [50, 10, 4]);
  assert.deepEqual(g.vUV, [0.25, 0.75]);
  assert.equal(g.vAlpha, 1.5);
  assert.equal(g.vFade, 3);
  assert.deepEqual(g.vBBBase, [50, 1, 7], 'its shadow and air read at its root');
  const banded = bbAt({ uMesh: 1, aCenter: [0, 1, 0], aCorner: [0, 0], aInst: [150, 0, 0, 0], uLptCut: [0, 0, 0, 140] });
  assert.ok(near(banded.vFade, 2.5, 1e-3));
});

test('LPT1 BB_VS mesh mode light (AUDIT LPT A2): at night a face takes the far picture\'s own law - LPT_IMPOSTOR_LIGHT turned to the eye - so the tree and its picture agree where they hand over; by day the sun\'s by its share; times its material\'s colour', () => {
  const shade = (n, sun = [0, 1, 0, 0], color = [1, 1, 1]) => bbAt({ uMesh: 1, aCenter: [0, 1, 0], aCorner: [0, 0], aNormal: n, aInst: [0, 0, 0, 0], uLptCut: [0, 0, 10, 140], uLptSun: sun, uMeshColor: color }).vShade;
  const law = (n) => Math.min(1, Math.max(0.5, 0.72 + 0.28 * (n[0] * LPT_IMPOSTOR_LIGHT[0] + n[1] * LPT_IMPOSTOR_LIGHT[1] + n[2] * LPT_IMPOSTOR_LIGHT[2])));
  // the eye is at +z: a face toward it is the far picture's face toward its viewer (-z there)
  assert.ok(near(shade([0, 0, 1])[0], law([0, 0, -1])), 'toward the eye');
  assert.ok(near(shade([0, 1, 0])[0], law([0, 1, 0])), 'up');
  assert.ok(near(shade([0, 0, -1])[0], 0.5), 'away: at the floor');
  assert.ok(near(shade([0, 1, 0], [0, 1, 0, 1])[0], 1), 'the sun overhead, whole');
  assert.ok(near(shade([0, 1, 0], [0, 1, 0, 0.5])[0], (law([0, 1, 0]) + 1) / 2), 'half the sun\'s share');
  assert.deepEqual(shade([0, 1, 0], [0, 1, 0, 1], [0.8, 0.8, 0.8]).map((x) => Math.round(x * 1e4) / 1e4), [0.8, 0.8, 0.8], 'Atlas_Opaque\'s _Color');
  assert.equal(LPT_SUN_FULL, 0.25);
});

test('LPT1 BB_VS mesh mode sway (AUDIT LPT A3): the crown leans by the height up THIS tree - a tree twice the size leans twice as far at the same share of its height', () => {
  const lean = (scale) => {
    const at = { uMesh: 1, aCorner: [0, 0], aCenter: [0, 5, 0], aInst: [3, 0, 4, 0], aScale: scale, uSize: [3, 10], uFlatWind: [2, 0, 0, 0] };
    return bbAt({ ...at, uSway: 1 }).vBBWorld[0] - bbAt(at).vBBWorld[0];
  };
  assert.ok(lean(1) > 0);
  assert.ok(near(lean(2) / lean(1), 2, 1e-3));
});

test('LPT1 the fragment: the far picture and its tree are complementary screen-door shares across the band - every pixel one or the other, never both, never neither - and the tree keeps its texel past the flats\' margin clear (AUDIT LPT A7), takes its shade, and its alpha its material\'s (0 an opaque card)', () => {
  const fs = `${LPT_FS_HEAD}\nfloat bayer4(vec2 p) { vec2 q = mod(floor(p), 4.0); return (q.x * 4.0 + q.y) / 16.0; }\nvec4 shade(vec4 tex, float margin) {\n${LPT_FS_KEEP}  if (margin > 0.5) tex = vec4(0.0);\n${LPT_FS_TEXEL}\n return tex; }`;
  const run = (fade, frag, { tex = [1, 1, 1, 1], margin = 0, alpha = 1, shadeV = [1, 1, 1] } = {}) => glslFunctions(fs, { vShade: shadeV, vAlpha: alpha, vFade: fade, gl_FragCoord: [...frag, 0, 1] }).shade(tex, margin);
  const kept = (fade, frag) => { try { run(fade, frag); return true; } catch (e) { if (e instanceof GlslDiscard) return false; throw e; } };
  for (const share of [0.1, 0.37, 0.5, 0.81]) {
    let both = 0, neither = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const far = kept(share, [x, y]), tree = kept(3 - share, [x, y]);   // BB_VS: a picture's share, and 2 plus its tree's (1 less the picture's)
      if (far && tree) both++;
      if (!far && !tree) neither++;
    }
    assert.deepEqual([both, neither], [0, 0], `share ${share}`);
  }
  assert.equal(kept(1, [0, 0]), true, 'a whole flat');
  assert.equal(kept(3, [0, 0]), true, 'a whole tree');
  assert.equal(kept(2, [1, 1]), false, 'a tree past the band: none');
  assert.deepEqual(run(3, [0, 0], { tex: [0.2, 0.4, 0.6, 1], margin: 1, shadeV: [0.5, 1, 1] }).map((x) => Math.round(x * 1e4) / 1e4), [0.1, 0.4, 0.6, 1], 'a tree\'s uv past 1 keeps its texel, shaded');
  assert.deepEqual(run(1, [0, 0], { tex: [0.2, 0.4, 0.6, 1], margin: 1 }), [0, 0, 0, 0], 'a flat\'s margin stays clear');
  assert.equal(run(3, [0, 0], { tex: [1, 1, 1, 0], alpha: 0 })[3], 1, 'an opaque card: whole whatever its alpha');
  assert.ok(near(run(3, [0, 0], { tex: [1, 1, 1, 0.4], alpha: 1.5 })[3], 0.6), 'a cut card: its alpha brought to the flats\' cut');
  const classic = read('src/render/renderer.js').split('const BB_FS = `')[1].split('`;')[0];
  for (const [name, src] of [['BB_FS', classic], ['EL_BB_FS', EL_BB_FS]]) {
    const has = (s, k) => (src.includes(`\${${k}}`) ? src.indexOf(`\${${k}}`) : src.indexOf(s));
    const keep = has(LPT_FS_KEEP, 'LPT_FS_KEEP'), texel = has(LPT_FS_TEXEL, 'LPT_FS_TEXEL'), clear = src.indexOf('tex = vec4(0.0);');
    assert.ok(has(LPT_FS_HEAD, 'LPT_FS_HEAD') >= 0, `${name} declares its inputs`);
    assert.ok(keep >= 0 && clear > keep && texel > clear, `${name}: the texel kept, the margin cleared, then the tree's own`);
  }
});

/** A recording fake GL (arena5_banners's shape). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE1: 33985, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
const R3 = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 4000));
const VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);

test('LPT1 createBillboardBatch / moveBillboardBatch: each flat\'s scale written on its corners, kept where it moves; the batch is born with its fields (no tint)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  calls.length = 0;
  const b = r.createBillboardBatch(504, '12#lpt', { w: 4, h: 8 }, [[0, 0, 0], [5, 0, 5]], { scales: [0.5, 1] });
  const data = calls.find((c) => c[0] === 'bufferData' && c[2].length === 40)[2];
  assert.equal(data[3], Math.fround(bbCornerX(-0.5, 0.5)));
  assert.equal(data[23], Math.fround(bbCornerX(-0.5, 1)));
  assert.ok('lptProto' in b && '_scales' in b && 'farH' in b && !('_tints' in b));
  calls.length = 0;
  r.moveBillboardBatch(b, [[0, -9, 0], [5, 0, 5]]);
  const moved = calls.find((c) => c[0] === 'bufferSubData')[3];
  assert.equal(moved[3], Math.fround(bbCornerX(-0.5, 0.5)), 'a sunk tree keeps its own size');
});

/** A renderer with a tree frame: one far-picture batch of `handle`, one plain batch, and the trees' fake buffers. */
function treeFrame(lane) {
  const { gl, calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  if (lane) r.setLightingLane(lane);
  r.textures.set('504_12#lpt', { id: 'far' }); r.textures.set('182_0', { id: 'plain' });
  const handle = { key: '504_12|' };
  const far = r.createBillboardBatch(504, '12#lpt', { w: 4, h: 8 }, [[0, 0, -3]], { scales: [0.7] });
  far.lptProto = handle;
  far.origin = new Float32Array([5, 0, 5]);   // a batch with an origin of its own: the trees must not stand on it
  const plain = r.createBillboardBatch(182, 0, { w: 1, h: 2 }, [[1, 0, -4]]);
  const gpu = { vao: { id: 'treeVao' }, pointInstances: (at) => calls.push(['pointInstances', at]) };
  const leaf = { id: 'atlas' }, bark = { id: 'bark' };
  const frame = { eye: [1, 2, 3], radius: 140, band: 20, gpu, cut: new Set([handle]), runs: [
    { run: null, scale: [1, 1, 1], size: [3, 9], sway: 0.6, drawStart: 4, drawCount: 7, subs: [
      { offset: 48, count: 30, tex: leaf, alpha: 1.5, color: [1, 1, 1], cull: 0 },
      { offset: 0, count: 0, tex: null, alpha: 1, color: [1, 1, 1], cull: 0 },
      { offset: 96, count: 12, tex: bark, alpha: 0, color: [0.8, 0.8, 0.8], cull: 2 },
    ] },
    { run: null, scale: [1, 1, 1], size: [2, 2], sway: 0, drawStart: 11, drawCount: 0, subs: [{ offset: 0, count: 6, tex: leaf, alpha: 1, color: [1, 1, 1], cull: 0 }] },
  ] };
  return { gl, calls, r, far, plain, frame, handle, leaf, bark };
}

test('LPT1 drawBillboards with a tree frame: the far picture of a drawn handle gives way near the eye, a plain flat never does; the trees go down after the opaque flats, a run\'s VISIBLE instances an instanced draw a submesh with a texture, each with its material - its alpha, its colour, its faces (AUDIT LPT A4/A6/C6) - on both lanes; the frame is spent in the call', () => {
  for (const lane of [null, EL_LANE]) {
    const { calls, r, far, plain, frame, leaf, bark } = treeFrame(lane);
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    r._clockLit = true; r._sunScale = LPT_SUN_FULL / 2;
    r.setLowPolyTrees(frame);
    calls.length = 0;
    r.drawBillboards([plain, far], R3, UP);
    const tag = lane ? 'EL' : 'classic';
    const seq = calls.filter((c) => (c[0] === 'uniform4f' && c[1] === 'uLptCut') || c[0] === 'drawElements' || c[0] === 'drawElementsInstanced' || (c[0] === 'uniform1f' && c[1] === 'uMesh'));
    const cutOn = seq.findIndex((c) => c[1] === 'uLptCut' && c[5] === 140);
    assert.ok(cutOn >= 0 && seq[cutOn + 1][0] === 'drawElements', `${tag}: the cut is on for the far picture`);
    const inst = calls.filter((c) => c[0] === 'drawElementsInstanced');
    assert.deepEqual(inst.map((c) => c.slice(1)), [['TRIANGLES', 30, 'UNSIGNED_INT', 48, 7], ['TRIANGLES', 12, 'UNSIGNED_INT', 96, 7]], `${tag}: no texture, no draw; a run with none visible, none`);
    assert.deepEqual(calls.filter((c) => c[0] === 'pointInstances'), [['pointInstances', 4]], 'pointed at its visible ones');
    const lastFlat = calls.map((c) => c[0]).lastIndexOf('drawElements');
    assert.ok(calls.indexOf(inst[0]) > lastFlat, 'after the opaque flats');
    assert.deepEqual(calls.filter((c) => c[1] === 'uMesh').map((c) => c[2]), [0, 1, 0], 'mesh mode for the trees alone (the frame block\'s 0 first)');
    const between = (a, b) => calls.slice(calls.indexOf(a) + 1, calls.indexOf(b));
    const first = calls.slice(0, calls.indexOf(inst[0]));
    assert.equal(first.filter((c) => c[0] === 'uniform1f' && c[1] === 'uMeshAlpha').at(-1)[2], 1.5);
    assert.deepEqual(first.filter((c) => c[0] === 'bindTexture' && c[1] === 3553).at(-1)[2], leaf);
    const second = between(inst[0], inst[1]);
    assert.deepEqual(second.filter((c) => c[1] === 'uMeshAlpha').map((c) => c[2]), [0], 'an opaque card');
    assert.deepEqual(second.filter((c) => c[1] === 'uMeshColor').map((c) => c.slice(2)), [[0.8, 0.8, 0.8]]);
    assert.deepEqual(second.filter((c) => c[0] === 'enable' || c[0] === 'disable').map((c) => c.join(':')), ['enable:CULL_FACE'], 'a front-only material culls its backs');
    assert.deepEqual(second.filter((c) => c[0] === 'bindTexture' && c[1] === 3553).map((c) => c[2]), [bark]);
    assert.deepEqual(calls.slice(calls.indexOf(inst[1])).filter((c) => c[0] === 'enable' || c[0] === 'disable').map((c) => c.join(':')).slice(0, 1), ['disable:CULL_FACE'], 'and the flats\' pass draws both faces again');
    const set = (name) => first.filter((c) => c[1] === name).at(-1)?.slice(2);
    assert.deepEqual([set('uOrigin'), set('uSize'), set('uSway'), set('uLptCut'), set('uMeshScale')], [[0, 0, 0], [3, 9], [0.6], [1, 2, 3, 140], [1, 1, 1]], `${tag}: the trees' own origin, size, sway, cut and scale`);
    assert.deepEqual(first.filter((c) => c[0] === 'bindVertexArray').at(-1)[1], { id: 'treeVao' }, 'the trees\' vertex array');
    const sun = calls.filter((c) => c[0] === 'uniform4f' && c[1] === 'uLptSun').at(-1);
    assert.ok(near(sun[2], 0.3) && near(sun[3], 0.8) && near(sun[4], 0.2) && near(sun[5], 0.5), `${tag}: the sun's direction, half its share at half LPT_SUN_FULL`);
    calls.length = 0;
    r.drawBillboards([far], R3, UP);
    assert.equal(calls.filter((c) => c[0] === 'drawElementsInstanced').length, 0, 'spent: a second call draws no tree');
    assert.ok(!calls.some((c) => c[0] === 'uniform4f' && c[1] === 'uLptCut' && c[5] === 140), 'and cuts no picture');
  }
});

test('LPT1 the trees take none of the last flat\'s own state (AUDIT LPT A1): a struck body\'s flash, an elite\'s glow and pad, a dissolve, a wash and a water column are put back before them', () => {
  const { calls, r, frame } = treeFrame(null);
  r.textures.set('182_1', { id: 'struck' });
  const struck = r.createBillboardBatch(182, 1, { w: 1, h: 2 }, [[1, 0, -4]]);
  Object.assign(struck, { hitFlash: 0.8, eliteGlow: 0.5, elitePad: [0.1, 0.1, 0.1, 0.1], dissolve: [0.5, 1, 0, 0], tint: [1, 0, 0] });
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.setLowPolyTrees(frame);
  calls.length = 0;
  r.drawBillboards([struck], R3, UP);
  const inst = calls.findIndex((c) => c[0] === 'drawElementsInstanced');
  const last = (name) => calls.slice(0, inst).filter((c) => c[1] === name).at(-1)?.slice(2);
  assert.deepEqual(last('uHitFlash'), [0]);
  assert.deepEqual(last('uEliteGlow'), [0]);
  assert.deepEqual(last('uElitePad'), [0, 0, 0, 0]);
  assert.deepEqual(last('uDissolve'), [0, 0, 0, 0]);
  assert.deepEqual(last('uBatchTint'), [1, 1, 1]);
  assert.ok(calls.slice(0, inst).some((c) => c[0] === 'bindTexture' && c[1] === 3553 && c[2] === r._blackTex) || r._tex1Bound === r._blackTex, 'a tree glows nowhere');
});

test('LPT1 a far picture whose handle is not drawn this frame stands whole - no hole where no tree stands', () => {
  const { calls, r, far, frame } = treeFrame(null);
  frame.cut = new Set(); frame.runs = [];
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.setLowPolyTrees(frame);
  calls.length = 0;
  r.drawBillboards([far], R3, UP);
  assert.ok(!calls.some((c) => c[0] === 'uniform4f' && c[1] === 'uLptCut' && c[5] === 140));
});

test('LPT1 the atlas texture (AUDIT LPT A4/A5): its chain allocated, sampled as the mod\'s Point (nearest, its mips nearest), wrapped, uploaded a band of rows at a time, under retro mode\'s mip switch, and freed by its owner', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  calls.length = 0;
  const tex = r.createAtlasTexture(1024, 512, 11);
  assert.deepEqual(calls.filter((c) => c[0] === 'texImage2D').map((c) => [c[2], c[4], c[5], c[9]]), Array.from({ length: 11 }, (_, i) => [i, Math.max(1, 1024 >> i), Math.max(1, 512 >> i), null]));
  const params = Object.fromEntries(calls.filter((c) => c[0] === 'texParameteri').map((c) => [c[2], c[3]]));
  assert.deepEqual(params, { TEXTURE_WRAP_S: 'REPEAT', TEXTURE_WRAP_T: 'REPEAT', TEXTURE_MIN_FILTER: 'NEAREST_MIPMAP_NEAREST', TEXTURE_MAG_FILTER: 'NEAREST', TEXTURE_MAX_LEVEL: 10 });
  assert.ok(r.lptAtlases.has(tex));
  calls.length = 0;
  r.uploadAtlasRows(tex, 2, 64, 256, new Uint8Array(256 * 4 * 3));
  assert.deepEqual(calls.find((c) => c[0] === 'texSubImage2D').slice(1, 8), [3553, 2, 0, 64, 256, 3, 'RGBA']);
  calls.length = 0;
  r._applyRetroMips(false);
  assert.ok(calls.some((c) => c[0] === 'bindTexture' && c[2] === tex) && calls.some((c) => c[0] === 'texParameteri' && c[2] === 'TEXTURE_MAX_LEVEL' && c[3] === 0), 'retro mode\'s no-mips reaches it');
  assert.equal(r.createAtlasTexture(4, 4, 3) && calls.filter((c) => c[0] === 'texParameteri' && c[2] === 'TEXTURE_MAX_LEVEL').at(-1)[3], 0, 'made under it: capped');
  calls.length = 0;
  r.releaseAtlasTexture(tex);
  r.releaseAtlasTexture(tex);
  assert.equal(calls.filter((c) => c[0] === 'deleteTexture').length, 1, 'freed once');
  assert.ok(!r.lptAtlases.has(tex));
});

test('LPT1 LowPolyTreesGpu: one vertex buffer as the billboard program reads it (vertex 0, uv 1, normal 2), the indices made whole-buffer u32 with each mesh\'s first vertex added, the instance at 3 ([x, y, z, turn]) and 4 (its scale) a divisor each; setInstances grows by doubling', () => {
  const { gl, calls } = recordingGl();
  const g = new LowPolyTreesGpu(gl, JSON_, bytes(`${V}/trees.bin`));
  const ptr = calls.filter((c) => c[0] === 'vertexAttribPointer').map((c) => c.slice(1));
  assert.deepEqual(ptr.slice(0, 3), [[0, 3, 'FLOAT', false, 32, 0], [2, 3, 'FLOAT', false, 32, 12], [1, 2, 'FLOAT', false, 32, 24]]);
  assert.deepEqual(ptr.slice(3), [[3, 4, 'FLOAT', false, 20, 0], [4, 1, 'FLOAT', false, 20, 16]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'vertexAttribDivisor').map((c) => c.slice(1)), [[3, 1], [4, 1]]);
  const ib = calls.find((c) => c[0] === 'bufferData' && c[1] === 'ELEMENT_ARRAY_BUFFER')[2];
  const m = JSON_.meshes[5], [at] = m.subs[0], [off] = g.subs[5][0];
  const u16 = new Uint16Array(bytes(`${V}/trees.bin`).buffer, JSON_.vertexBytes);
  assert.equal(off, (m.index + at) * 4);
  assert.equal(ib[m.index + at], u16[m.index + at] + m.vertex);
  calls.length = 0;
  g.pointInstances(3);
  assert.deepEqual(calls.filter((c) => c[0] === 'vertexAttribPointer').map((c) => c[6]), [60, 76], 'a run\'s first instance');
  calls.length = 0;
  g.setInstances(new Float32Array(5 * 2000), 2000);
  assert.equal(calls.find((c) => c[0] === 'bufferData')[2], 2000 * 5 * 4);
  calls.length = 0;
  g.setInstances(new Float32Array(5 * 2100), 2100);
  assert.equal(calls.find((c) => c[0] === 'bufferData')[2], 4000 * 5 * 4, 'doubled');
  calls.length = 0;
  g.destroy();
  assert.equal(calls.filter((c) => c[0] === 'deleteBuffer').length, 3);
  assert.equal(calls.filter((c) => c[0] === 'deleteVertexArray').length, 1);
});

// ---- the host's door --------------------------------------------------------------------------------------------

/** A fake TEXTURE file: `records` records, each 32 x 48, each texel index 1 + record (palette blue 9). */
const fakeTexture = (archive, records = 40) => ({
  archive, recordCount: records, palette: { getRed: (i) => i, getGreen: (i) => i * 2 % 256, getBlue: () => 9 },
  getDFBitmap: (record) => ({ width: 32, height: 48, data: new Uint8Array(32 * 48).fill(1 + record) }),
});
function door({ seasonal = null, records = 40, onAtlas = null } = {}) {
  const { gl, calls } = recordingGl();
  const uploads = [], released = [], frames = [], atlases = [], rows = [], freed = [];
  const clock = { t: 0 };
  let ids = 0, gets = 0;
  const renderer = {
    gl, uploadTexture: (a, r, c) => uploads.push([a, r, c.width, c.height]), releaseTexture: (a, r) => released.push([a, r]), setLowPolyTrees: (f) => frames.push(f),
    createAtlasTexture: (w, h, levels) => { const tex = { atlas: ++ids, w, h, levels }; atlases.push(tex); onAtlas?.(); return tex; },
    uploadAtlasRows: (tex, level, y, width, data) => rows.push({ tex, level, y, n: data.length / (width * 4), head: Array.from(data.subarray(0, width * 4)) }),
    releaseAtlasTexture: (tex) => freed.push(tex),
  };
  let breaths = 0;
  const lpt = createLowPolyTrees({
    renderer, getTexture: async (a) => { gets++; return fakeTexture(a, records); }, seasonal,
    fetchBytes: async (url) => bytes(`${V}/${url.split('/').pop()}`), breathe: async () => { breaths++; }, warn: () => {}, now: () => clock.t,
  });
  return { lpt, gl, calls, uploads, released, frames, atlases, rows, freed, clock, breaths: () => breaths, gets: () => gets };
}
/** The size renderImpostor draws a prototype at before its trim. */
const impostorSize = (p) => { const H = Math.round(Math.min(LPT_IMPOSTOR_MAX, Math.max(LPT_IMPOSTOR_MIN, p.size.h * LPT_IMPOSTOR_PER_M))); return [Math.max(4, Math.round((H * p.size.w) / p.size.h)), H]; };

test('LPT1 the door: the data read once; a prototype\'s HANDLE - its atlases painted between breaths, its far picture uploaded under its archive as `${record}#lpt${source}`, sized for the tallest tree and the picture\'s trimmed share - asked once', async () => {
  const d = door();
  assert.equal(d.lpt.loaded, false);
  await Promise.all([d.lpt.load(), d.lpt.load()]);
  assert.equal(d.lpt.loaded, true);
  const p = d.lpt.proto(504, 12);
  const h = await d.lpt.farPicture(p);
  assert.deepEqual([h.record, h.archive, h.source, h.proto, h.refs], ['12#lpt', 504, '', p, 0]);
  const [, , W, H] = d.uploads[0], [W0, H0] = impostorSize(p);
  assert.deepEqual(d.uploads.map((u) => u.slice(0, 2)), [[504, '12#lpt']]);
  assert.ok(near(h.size.w, p.size.w * (W / W0) * LPT_SCALE_MAX) && near(h.size.h, p.size.h * (H / H0) * LPT_SCALE_MAX), 'the trimmed share of the tallest tree');
  assert.ok(W < W0 || H < H0, `trimmed (${W} x ${H} of ${W0} x ${H0})`);
  assert.equal(await d.lpt.farPicture(p), h, 'once');
  assert.ok(d.breaths() > 50, 'painted a step at a time');
  assert.equal(d.lpt.sourceOf(p), '');
});

test('LPT1 the atlases\' upload (AUDIT LPT B7): the chain into one texture a band of LPT_ATLAS_BAND rows at a time - each level bottom-up (a mesh\'s uv v=0 is its picture\'s bottom) - a breath between bands', async () => {
  const d = door();
  await d.lpt.load();
  const p = d.lpt.proto(504, 12);
  await d.lpt.farPicture(p);
  assert.deepEqual(d.atlases.map((t) => [t.w, t.h, t.levels]), [[1024, 1024, 11], [1024, 1024, 11]], 'its two atlases, every level of each');
  const one = d.rows.filter((r) => r.tex === d.atlases[0]);
  assert.equal(LPT_ATLAS_BAND, 128);
  assert.equal(one.length, 8 + 4 + 2 + 1 + 7, 'a band at a time down to 128 rows, a level a call below it');
  assert.ok(one.every((r) => r.n <= LPT_ATLAS_BAND));
  const pic = d.lpt._atlases.get(`${p.subs[0].atlas}|`).pic;
  const top = one.find((r) => r.level === 0 && r.y === 1024 - LPT_ATLAS_BAND);
  assert.deepEqual(top.head, Array.from(pic.data.subarray((LPT_ATLAS_BAND - 1) * 1024 * 4, LPT_ATLAS_BAND * 1024 * 4)), 'the picture\'s top band lands at the top, its last row first');
  assert.notDeepEqual(top.head, Array.from(pic.data.subarray(0, 1024 * 4)), '(its first row is another)');
});

test('LPT1 the frame: the near set gathered and handed on, again only when the eye moves LPT_REGATHER_M, a pixel moves (a recentre), its set is made or let go, or a tree is felled; culled to the view EVERY frame (AUDIT LPT B4), each run its handle\'s', async () => {
  const d = door();
  await d.lpt.load();
  const h = await d.lpt.farPicture(d.lpt.proto(504, 12)), k = await d.lpt.farPicture(d.lpt.proto(500, 1));
  const edge = LPT_NEAR_M + LPT_BAND_M + LPT_REGATHER_M - 1;   // past the band, inside the way the eye may go before the next gather
  const set = { ox: 0, oy: 0, oz: 0, handles: [h, k], trees: Float32Array.from([0, 5, 0, 5, 1, 0, 1, 6, 0, 6, 1, 0, 0, 0, 0, edge, 1, 0]) };
  d.lpt.frame([set], 0, 0, 0, { stamp: 1, swayOf: (q) => (q === h.proto ? 0.4 : 0) });
  const f = d.frames.at(-1);
  assert.deepEqual(f.runs.map((r) => [r.run.handle, r.drawCount]), [[h, 2], [k, 1]], 'a tree the eye may walk into the band toward before the next gather is there');
  assert.ok(f.cut.has(h) && f.cut.has(k));
  // the run as the renderer reads it (AUDIT LPT D5): the prototype's root scale, its standing size, its sway, and each
  // submesh's buffer range, atlas texture, alpha, colour and faces
  const p = h.proto, at = d.lpt._lpt.meshes[p.mesh].subs;
  assert.deepEqual({ ...f.runs[0], run: null, subs: null }, { run: null, scale: p.scale, size: [p.size.w, p.size.h], sway: 0.4, windfall: 0, subs: null, drawStart: 0, drawCount: 2 });   // WINDFALL1: its share under Windfall's law (no windfallOf handed: none)
  assert.deepEqual(f.runs[0].subs.map((s) => [s.count, s.alpha, s.color, s.cull]), p.subs.map((s, i) => [at[i][1], lptAlphaOf(s), s.color, s.cull]));
  assert.deepEqual(f.runs[0].subs.map((s) => s.tex), p.subs.map((s) => d.lpt._atlases.get(`${s.atlas}|`).tex));
  assert.equal(LPT_REGATHER_M, 3);
  const runs = f.runs;
  d.lpt.frame([set], LPT_REGATHER_M - 0.5, 0, 0, { stamp: 1 });
  assert.equal(d.frames.at(-1).runs, runs, 'a step: no gather, no new runs - a frame between gathers allocates nothing');
  assert.equal(d.frames.at(-1).eye[0], LPT_REGATHER_M - 0.5, 'its eye moved');
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 1 });
  const moved = d.frames.at(-1).runs;
  assert.notEqual(moved, runs, 'moved: gathered');
  set.ox = 1;   // the floating origin moved the pixel
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 1 });
  const recentred = d.frames.at(-1).runs;
  assert.notEqual(recentred, moved, 'recentred: gathered');
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 2 });
  assert.notEqual(d.frames.at(-1).runs, recentred, 'a tree felled: gathered');
  const felled = d.frames.at(-1).runs;
  set.trees = Float32Array.from(set.trees);   // the pixel's set made again (it came near once more)
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 2 });
  assert.notEqual(d.frames.at(-1).runs, felled, 'a set made anew: gathered');
  // the cull: only z >= 50 (less a tree's sphere) - the two near ones go, the far one stays; each frame, no gather
  const planes = new Float32Array(24);
  for (let i = 0; i < 6; i++) planes[i * 4 + 3] = 1;
  planes.set([0, 0, 1, -50], 0);
  const before = d.frames.at(-1).runs;
  d.calls.length = 0;
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 2, planes });
  const c = d.frames.at(-1);
  assert.equal(c.runs, before, 'culled without a gather');
  assert.deepEqual(c.runs.map((r) => [r.drawStart, r.drawCount]), [[0, 1], [1, 0]]);
  assert.equal(d.calls.find((x) => x[0] === 'bufferSubData')[4], 0, 'the visible one uploaded');
  assert.equal(d.calls.find((x) => x[0] === 'bufferSubData')[5], LPT_INSTANCE_FLOATS);
  d.lpt.frame([], 0, 0, 0, { stamp: 2 });
  assert.equal(d.frames.at(-1), null, 'none near: no frame');
});

test('LPT1 OWNERSHIP (AUDIT LPT B5): a pixel holds the handles it stands; one no pixel has held for LPT_IDLE_S gives its far picture back, an atlas no live handle reads its texture; an atlas\'s CPU picture is let go LPT_PIC_IDLE_S after a picture was last drawn from it, and painted again when one is', async () => {
  const d = door();
  await d.lpt.load();
  const p = d.lpt.proto(504, 12);
  const h = await d.lpt.farPicture(p);
  d.lpt.acquire(h); d.lpt.acquire(h);
  assert.equal(h.refs, 2);
  const key = `${p.subs[0].atlas}|`;
  assert.ok(d.lpt._atlases.get(key).pic);
  d.clock.t = 2000; d.lpt.frame([], 0, 0, 0);
  d.clock.t = LPT_PIC_IDLE_S * 1000 + 1001; d.lpt.frame([], 0, 0, 0);
  assert.equal(d.lpt._atlases.get(key).pic, null, 'the 4 MB picture let go');
  assert.ok(d.lpt._atlases.get(key).tex, '...its texture kept: the handle still stands');
  d.lpt.release(h);
  assert.equal(h.refs, 1);
  d.clock.t += LPT_IDLE_S * 1000 + 2000; d.lpt.frame([], 0, 0, 0);
  assert.deepEqual([d.released, d.freed], [[], []], 'still held: nothing given back');
  const gets = d.gets();
  await d.lpt.farPicture(d.lpt.proto(504, 13));   // another tree of the same atlases: the picture painted again
  assert.ok(d.gets() > gets && d.lpt._atlases.get(key).pic, 'painted again for it');
  d.lpt.release(h);
  assert.deepEqual([h.refs, h.idleAt], [0, d.clock.t]);
  d.clock.t += 1000 * LPT_IDLE_S - 500; d.lpt.frame([], 0, 0, 0);
  assert.deepEqual(d.released, [], 'idle, not yet long enough');
  d.clock.t += 2000; d.lpt.frame([], 0, 0, 0);
  assert.deepEqual(d.released.slice(0, 1), [[504, '12#lpt']], 'its far picture given back');
  assert.ok(!d.lpt._handles.has(`${p.key}|`));
  d.clock.t += 1000 * LPT_IDLE_S + 2000; d.lpt.frame([], 0, 0, 0);
  assert.equal(d.freed.length, 2, 'and, no live handle reading them, its atlases');
  assert.equal(d.lpt._atlases.size, 0);
  assert.equal(LPT_IDLE_S, 30);
  assert.equal(LPT_PIC_IDLE_S, 10);
});

test('LPT1 a record the player\'s data lacks (AUDIT LPT B9): no handle - the classic flat stands', async () => {
  const d = door({ records: 3 });
  await d.lpt.load();
  assert.equal(await d.lpt.farPicture(d.lpt.proto(504, 12)), null);
  assert.deepEqual([d.uploads, d.atlases.length], [[], 0], 'nothing uploaded');
  assert.equal(d.lpt._handles.size, 0, 'and nothing kept to answer the next ask with');
});

test('LPT1 SEASONS OF THE ILIAC BAY (AUDIT LPT C2/C3/B3): a prototype whose OWN archive the season re-skins is painted under it - each record of an archive it re-skins from its seasonal picture (resampled to the classic size), the rest classic - and keyed by the install; any other stays classic, never asking; a paint a new install overtook is never kept', async () => {
  const managed = new Set([504, 508]);
  let gen = 1;
  const asked = [];
  const seasonColour = (w, h) => { const c = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < c.length; i += 4) c.set([10, 200, 30, 255], i); return c; };
  const seasonal = {
    key: (a) => (managed.has(a) ? `sFall.${gen}` : ''),
    picture: (a, r) => { asked.push(a); return managed.has(a) ? { image: { width: 16, height: 24, colors: seasonColour(16, 24) } } : null; },
    generation: () => gen,
  };
  const d = door({ seasonal });
  await d.lpt.load();
  const p = d.lpt.proto(504, 12);
  const h = await d.lpt.farPicture(p);
  assert.deepEqual([h.record, h.source], ['12#lptsFall.1', 'sFall.1']);
  const pic = d.lpt._atlases.get(`${p.subs[0].atlas}|sFall.1`).pic;
  let season = 0, classic = 0;
  for (let i = 0; i < pic.data.length; i += 4) { if (!pic.data[i + 3]) continue; if (pic.data[i + 2] === 30 && pic.data[i + 1] === 200) season++; else if (pic.data[i + 2] === 9) classic++; }
  assert.ok(season > 10000 && classic > 1000, `the 504 and 508 records the season's (${season}), the 500, 501 and 503 classic (${classic})`);
  asked.length = 0;
  const q = await d.lpt.farPicture(d.lpt.proto(500, 1));
  assert.deepEqual([q.record, asked], ['1#lpt', []], 'a desert tree: classic, the season never asked');
  // an install overtaking a paint: nothing kept, and the next ask paints under the new install
  const p2 = d.lpt.proto(508, 25);
  const pending = d.lpt.farPicture(p2);
  gen = 2;
  assert.equal(await pending, null);
  assert.ok(!d.lpt._handles.has(`${p2.key}|sFall.1`));
  assert.equal((await d.lpt.farPicture(p2)).source, 'sFall.2');
  // resampled to the classic size, rows put top-down and the alpha cut as a flat's is
  const r = nearestRgba({ width: 2, height: 2, data: Uint8Array.from([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]) }, 4, 4);
  assert.deepEqual([px(r, 0, 0)[0], px(r, 3, 0)[0], px(r, 0, 3)[0]], [1, 2, 3]);
  const t = topDownOf({ width: 1, height: 2, colors: Uint8Array.from([9, 9, 9, 200, 5, 5, 5, 20]) });
  assert.deepEqual(Array.from(t.data), [5, 5, 5, 0, 9, 9, 9, 255]);
});

test('LPT1 SeasonHelper.installing: up while an install refills the cache (the port\'s - what the tree atlases read to paint nothing seasonal mid-install)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const helper = new SeasonHelper({ currentSeason: () => SEASONS.Winter, recordCount: async () => 33, load: async () => { await gate; return []; }, refresh: () => {}, warn: () => {} });
  assert.equal(helper.installing, false);
  const run = helper.apply(false);
  assert.equal(helper.installing, true);
  release();
  await run;
  assert.equal(helper.installing, false);
});

test('LPT1 a paint whose atlases were given back while it ran keeps nothing (EVERY ALLOCATION HAS AN OWNER)', async () => {
  const d = door();
  await d.lpt.load();
  const pending = d.lpt.farPicture(d.lpt.proto(504, 12));
  d.lpt.destroy();
  assert.equal(await pending, null);
  assert.deepEqual([d.uploads, d.atlases.length, d.lpt._atlases.size, d.lpt._handles.size], [[], 0, 0, 0], 'given back mid-paint: nothing even made');
  // ...and given back mid-upload: the texture made for it is given back as it finishes
  let e = null;
  e = door({ onAtlas: () => e.lpt.destroy() });
  await e.lpt.load();
  assert.equal(await e.lpt.farPicture(e.lpt.proto(504, 12)), null);
  assert.ok(e.atlases.length > 0);
  assert.deepEqual([e.uploads, e.freed], [[], e.atlases], 'each one freed');
});

test('LPT1 destroy: the buffers, every atlas and every far picture given back (EVERY ALLOCATION HAS AN OWNER)', async () => {
  const d = door();
  await d.lpt.load();
  await d.lpt.farPicture(d.lpt.proto(504, 12));
  d.lpt.destroy();
  assert.deepEqual(d.released, [[504, '12#lpt']]);
  assert.equal(d.freed.length, 2);
  assert.equal(d.calls.filter((c) => c[0] === 'deleteBuffer').length, 3);
  assert.equal(d.frames.at(-1), null);
});

// ---- the hosts ------------------------------------------------------------------------------------------------------

test('LPT1 the felled trees: a sink or a stand moves FOREST_STAMP (the near set gathered anew), and a low-poly tree falls as its own far picture at its own size', () => {
  const before = FOREST_STAMP.n;
  const c = [1, 0, 1];
  const g = { batch: {}, centers: [c], size: { w: 4, h: 8 } };
  sinkFelled({ groups: new Map([['504_12', g]]) }, new Set(['504_12#0']), { moveBillboardBatch: () => true });
  assert.equal(FOREST_STAMP.n, before + 1);
  sinkFelled({ groups: new Map([['504_12', g]]) }, new Set(), { moveBillboardBatch: () => true });
  assert.equal(FOREST_STAMP.n, before + 2, 'stood again');
  assert.match(read('src/scenes/treeHost.js'), /createBillboardBatch\(g\.batch\.archive, g\.batch\.record, g\.size, \[c\], g\.scales \? \{ scales: \[g\.scales\[n\.flat\.i\]\] \} : undefined\)/);
});

test('LPT1 the hosts: world.js and exterior.js stand the trees behind the mod\'s switch and ?trees=off, through the one door; a far-picture batch a handle, HELD while it stands (AUDIT LPT B5), MAC1\'s far rings reading the flat\'s own height (AUDIT LPT A8/B1); the near set handed on between the gibs\' call and the wind (WIND3 keeps the wind and the flats\' draw adjacent), culled to the view; the terrain\'s own flats alone take DFU\'s variety', () => {
  const w = read('src/scenes/world.js'), x = read('src/scenes/exterior.js');
  for (const [name, src] of [['world.js', w], ['exterior.js', x]]) {
    assert.match(src, /modSetting\('low-poly-trees', 'Enabled'\) && params\.get\('trees'\) !== 'off' \? createLowPolyTrees\(/, name);
    assert.match(src, /renderer\.createBillboardBatch\(archive, far\.record, far\.size, centers, \{ scales/, name);
    assert.match(src, /lowPolyTrees\.acquire\(far\); lptHandles\.push\(far\);/, name);
    assert.match(src, /batch\.lptProto = far;\n\s+batch\.farH = plain\.h;/, name);
    assert.match(src, /key: \(a\) => \([^)]*seasons\.lookup\(a, 1\) \? `s\$\{seasons\.installedSeason\}\.\$\{seasons\.generation\}` : ''\)/, `${name}: the season by the tree's own archive, keyed by the install`);
    assert.match(src, /generation: \(\) => seasons\.generation/, name);
    const flats = src.indexOf('renderer.drawBillboards(');
    const wind = src.lastIndexOf('renderer.setFlatWind(', flats), gibs = src.lastIndexOf('bloodMarks.draw(', flats);
    assert.match(src.slice(gibs, wind), /lowPolyTrees/, `${name}: the frame's trees between the gibs and the wind`);
  }
  assert.match(w, /!seasons\.installing && seasons\.lookup\(a, 1\)/, 'the streaming host paints nothing seasonal mid-install (AUDIT LPT B3)');
  // PIN MOVED (ECOTONE1, 2026-10-07): by the archive the flat is drawn in - a border's flat is a neighbour climate's
  assert.match(w, /if \(lowPolyTrees\) wildFlats\.add\(`\$\{archive\}_\$\{f\.record\}#\$\{i\}`\);/, 'the terrain layout\'s flats marked wild');
  assert.match(w, /wild\[i\] = wildFlats\.has\(`\$\{k\}#\$\{i\}`\) \? 1 : 0;\n\s+const v = lptVariety\(px, py, c\[0\], c\[2\], !wild\[i\]\)\.scale;\n[^\n]*\n\s+scales\[i\] = \(fit \? Math\.min\(v, fit\[i\]\) : v\) \/ LPT_SCALE_MAX;/);   // PIN MOVED (LPT-FIT): the variety read into `v`, the far picture the lesser of it and the tree's fit
  assert.match(x, /buildTreeSet\(0, 0, lptGroups\)/, 'the location host: one set, none of it wild');
  assert.match(x, /lptGroups\.push\(\{ h: lptHandles\.length - 1, centers, wild: null \}\);/);
  assert.match(w, /lowPolyTrees: lptGroups\.length \? \{ px, py, ox: 0, oy: 0, oz: 0, handles: lptHandles, groups: lptGroups, trees: null, centers: null \} : null/);
  assert.match(w, /if \(p\.lowPolyTrees\) for \(const h of p\.lowPolyTrees\.handles\) lowPolyTrees\?\.release\(h\);/, 'destroyPixel lets its handles go');
  assert.match(w, /made\.lptHandles = lptHandles;/, 'BUILD-FAIL1\'s ledger carries them...');
  assert.match(w, /for \(const h of m\.lptHandles \?\? \[\]\) lowPolyTrees\?\.release\(h\);/, '...and a build that throws lets them go');
  assert.match(w, /farFlatVisibleAt\(ring, b\.farH \?\? b\.size\?\.h \?\? 0, b\.frame != null\)/);
  assert.match(w, /skip: \(set, i\) => FELLED\.has\(set\.centers\[i\]\)/, 'a felled tree stands no 3D tree');
  const fr = w.slice(w.indexOf('function lowPolyTreesFrame('), w.indexOf('lowPolyTrees.frame(_lptSets'));
  assert.match(fr, /if \(p\._dist2 > 2\) \{ if \(p\._dist2 > 8 && set\.trees\) \{ set\.trees = null; set\.centers = null; \} continue; \}/, 'the eye\'s pixel and its eight; a set past the 5x5 let go (AUDIT LPT B10)');
  assert.match(fr, /if \(!set\.trees\) \{ const made = buildTreeSet\(set\.px, set\.py, set\.groups\);/, '...made as it comes near');
  assert.match(fr, /_lptOpts\.planes = planes;/);
  assert.match(w, /if \(lowPolyTrees\) lowPolyTreesFrame\(cullOn \? _planes : null\);/, 'the frame\'s normalised planes');
  assert.match(x, /if \(cullOn\) spherePlanes\(_pv, _lptPlanes\); lowPolyTrees\.frame\(lptSets, cam\.pos\[0\], cam\.pos\[1\], cam\.pos\[2\], lptOpts\);/, 'the location host normalises its own, at its eye');
  assert.match(x, /renderer\.createBillboardBatch\(archive, far\.record, far\.size, centers, \{ scales: centers\.map\(\(\) => 1 \/ LPT_SCALE_MAX\) \}\)/, 'a location\'s tree at its own size');
  assert.match(fr, /set\.ox = p\._t\[0\]; set\.oy = p\._t\[1\]; set\.oz = p\._t\[2\];/, 'each set at its pixel\'s translation this frame');
  assert.match(fr, /_lptOpts\.stamp = FOREST_STAMP\.n;/, 'a felling regathers');
  for (const [name, src] of [['world.js', w], ['exterior.js', x]]) {
    // PIN MOVED (ECOTONE1, 2026-10-07): the streaming host's pixel asks by its nature set (its climate's and a border's)
    assert.match(src, name === 'world.js' ? /batch\.sway = floraSwayOf\(archive, natureSet, plain\.h\);/ : /batch\.sway = floraSwayOf\(archive, natureArchive, plain\.h\);/, `${name}: the flat's sway share`);
    assert.match(src, /coverProxies\(c, plain, \{ tree:/, `${name}: the flat's cover (AUDIT LPT D3)`);
  }
  assert.ok(LPT_NEAR_M + LPT_BAND_M + LPT_REGATHER_M < 819.2, 'the 3x3 reaches every tree in reach');
});

test('LPT1 the mod\'s row: Low Poly Trees, SquidKamer, on by default - a switch that takes effect when the world next loads', () => {
  const m = MOD_SETTINGS['low-poly-trees'];
  assert.equal(m.title, 'Low Poly Trees');
  assert.equal(m.author, 'SquidKamer');
  assert.equal(m.keys.Enabled.default, true);
  assert.match(read('src/systems/features.js'), /modFeature\('low-poly-trees', 'Takes effect when the world next loads\.', 'sight'\)/);
});

test('LPT1 runSteps: a step generator\'s answer, whole', () => {
  assert.equal(runSteps((function* () { yield; yield; return 7; })()), 7);
});
