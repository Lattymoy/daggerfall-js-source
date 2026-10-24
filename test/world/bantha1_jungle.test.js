// BANTHA1 (2026-10-18, the owner: "Bantha, north of daggerfall is going to be the first region in the continent to
// recieve a biome expansion. Using the attached file, populate the area in a dense jungle like format. When traveling
// inside the area there should be a fog-like haze that reduces visability. This needs to be insanely detailed and not
// hurt performance. No band aids"): THE JUNGLE OF BANTHA - bible/03-World/Bantha-Jungle.md is the design and the record.
// The owner's trees read and measured off their own files, the field the layout and the haze share, the layout's laws, the
// haze's law and its shader twin, the bound the cull reads, the hosts, the renderer's second tree slot and the door.
// Mutants: tools/mutants/bantha1.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  JUNGLE_ARCHIVE, JUNGLE_SPECIES, JUNGLE_MEASURES, jungleFiles, jungleRecord, parseObj, parseMtl, measureTree,
  readJungleTrees, jungleCover, JUNGLE_ROOT_BAND, JUNGLE_CROWN_COVER, jungleMesh,
} from '../../src/world/jungle/jungleModels.js';
import { COVER_RADIUS_FRAC, createCoverIndex, rayCylinder } from '../../src/ai/cover.js';
import { trailRoom } from '../../src/world/jungle/jungleTrails.js';
import {
  JUNGLE_FIELD_REACH, JUNGLE_EDGE, JUNGLE_WANDER_MAX, jungleField, jungleNine, jungleSignedAt,
  jungleDepthAt, jungleShare,
} from '../../src/world/jungle/jungleRegion.js';
import { JUNGLE, JUNGLE_PALMS, JUNGLE_COVER, withJungle, canopySpecies, jungleWhole, jungleStandNoise, gladeField, canopySite } from '../../src/world/terrain/jungleNature.js';
import { layoutNature, TREE_RECORDS, isTreeRecord, tileDraw, groundAt, forestCover } from '../../src/world/terrain/terrainNature.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, SCALED_BEACH_ELEVATION, TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';
import {
  JUNGLE_HAZE, hazeShare, hazeDayFactor, hazeWeatherFactor, hazeDrift, hazeMean, hazeTransmittance, createHazeState, stepHaze,
  hazeUniforms, hazeDensityAt, hazeColumn, hazeColorOf, fogColorWith, hazeSkyUniform, hazeHides,
} from '../../src/world/jungle/jungleHaze.js';
import { HAZE_LAW_GLSL, HAZE_SKY_GLSL, RING_HAZE_GLSL } from '../../src/render/hazeGlsl.js';
import { FOG_GLSL } from '../../src/render/fogGlsl.js';
import { renderImpostor, buildTreeSet, LPT_IMPOSTOR_PER_M } from '../../src/world/lowPolyTrees.js';
import { createJungleTrees, JUNGLE_SCALE_MAX, JUNGLE_URLS, JUNGLE_SUN_LIFT } from '../../src/systems/jungleTreesAssets.js';
import { BUILD_RETRY_MS } from '../../src/world/streamingWorld.js';
import { createJungleHost } from '../../src/scenes/jungleHost.js';
import { createTreesHost } from '../../src/scenes/treesHost.js';
import { packNature, unpackNature, natureBuffers } from '../../src/world/terrain/natureWire.js';
import { jungleTreeMark, JUNGLE_MARK_CLEAR } from '../../src/scenes/treeHost.js';
import { nodeGlows, createNodeGlowState, NODE_GLOW_PULL } from '../../src/render/nodeGlow.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { ecoOrigin, ecoNoise } from '../../src/world/ecotone.js';
import { fogFactor } from '../../src/world/weather.js';
import { jungleOn, jungleHazeOn, createSkyController } from '../../src/scenes/shared.js';
import { FEATURES, checkFeature } from '../../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../../src/systems/uiSkin.js';
import { onlineForcedPref } from '../../src/systems/online/onlineLane.js';
import { glslFunctions } from '../glsl.mjs';
import { hostText } from '../hostText.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const SRC = 'src/assets/jungle/source';
const text = (p) => readFileSync(join(ROOT, p), 'utf8');
const sources = () => JUNGLE_SPECIES.map((s) => { const f = jungleFiles(s); return { obj: text(`${SRC}/${f.obj}`), mtl: text(`${SRC}/${f.mtl}`) }; });
const picture = (name) => { const p = PNG.sync.read(readFileSync(join(ROOT, SRC, name))); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const TREES = readJungleTrees(sources());

test('BANTHA1 the owner\'s trees, read: five prototypes of the rainforest\'s archive, each its OBJ\'s every polygon fanned, mirrored in x as Unity reads an OBJ, its root at the origin and its ground kept, cut at a half on both faces (mutants: the mirror lost; the root left where it stood; a fan turned)', () => {
  assert.equal(JUNGLE_ARCHIVE, 500);
  assert.deepEqual(JUNGLE_SPECIES.map((s) => [s.key, s.file, s.record]), [['banyan', 'jungle_tree', 12], ['kapok', 'jungle_tree2', 13], ['fig', 'jungle_tree3', 14], ['flame', 'jungle_tree4', 15], ['mahogany', 'jungle_tree5', 16]]);
  for (const s of JUNGLE_SPECIES) assert.ok(isTreeRecord(500, s.record), `${s.key} is a Tree of the rainforest - Logging fells it`);
  assert.deepEqual([...TREES.protos.keys()], JUNGLE_SPECIES.map((s) => `500_${jungleRecord(s)}`));
  assert.deepEqual(TREES.pictures, ['jungle_tree_252w.png', 'jungle_tree2_252w.png', 'jungle_tree3_252w.png', 'jungle_tree4_252w.png', 'jungle_tree5_252w.png'], 'each MTL\'s own picture');
  const tris = [], verts = [];
  JUNGLE_SPECIES.forEach((s, k) => {
    const obj = parseObj(sources()[k].obj);
    const m = TREES.models[k], p = TREES.protos.get(`500_${jungleRecord(s)}`);
    // the fan: every polygon of n corners is n - 2 triangles
    assert.equal(m.indices.length / 3, obj.faces.reduce((n, f) => n + f.corners.length - 2, 0), `${s.key}: every polygon fanned`);
    tris.push(m.indices.length / 3); verts.push(m.vertices.length / 8);
    // the root: the middle of its lowest JUNGLE_ROOT_BAND metres stands at the origin
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < m.vertices.length; i += 8) {
      if (m.vertices[i + 1] > m.min[1] + JUNGLE_ROOT_BAND) continue;
      x0 = Math.min(x0, m.vertices[i]); x1 = Math.max(x1, m.vertices[i]); z0 = Math.min(z0, m.vertices[i + 2]); z1 = Math.max(z1, m.vertices[i + 2]);
    }
    assert.ok(near((x0 + x1) / 2, 0, 1e-5) && near((z0 + z1) / 2, 0, 1e-5), `${s.key}: its root at the origin`);
    // mirrored: the file's first corner of its first face lands at -(x - root.x), y, z - root.z, its normal's x turned
    const c = obj.faces[0].corners[0], v0 = m.vertices.subarray(0, 8);
    assert.ok(near(v0[0], Math.fround(-(obj.positions[c[0] * 3] - m.root[0])), 1e-5) && near(v0[1], Math.fround(obj.positions[c[0] * 3 + 1]), 1e-6) && near(v0[2], Math.fround(obj.positions[c[0] * 3 + 2] - m.root[1]), 1e-5), `${s.key}: mirrored in x`);
    assert.ok(near(v0[3], Math.fround(-obj.normals[c[2] * 3]), 1e-6), `${s.key}: and its normal`);
    // every triangle wound as Unity's front is - a left-handed clockwise face, its right-handed cross along its corners'
    // normals (the renderer's frontFace CW): the mirror's reversal, and the owner's kapok, whose faces and normals the
    // export turned apart, wound as its normals say
    let agree = 0;
    const V = m.vertices;
    for (let t = 0; t < m.indices.length; t += 3) {
      const a = m.indices[t] * 8, b = m.indices[t + 1] * 8, d = m.indices[t + 2] * 8;
      const e1 = [V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]], e2 = [V[d] - V[a], V[d + 1] - V[a + 1], V[d + 2] - V[a + 2]];
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      let dot = 0;
      for (let c = 0; c < 3; c++) dot += fn[c] * (V[a + 3 + c] + V[b + 3 + c] + V[d + 3 + c]);
      if (dot > 0) agree++;
    }
    assert.equal(agree, m.indices.length / 3, `${s.key}: every face wound with its normals`);
    assert.deepEqual({ ...p.subs[0] }, { atlas: s.key, opaque: false, cutoff: 0.5, cull: 0, color: [1, 1, 1] });
    assert.ok(near(p.size.h, m.max[1]) && near(p.size.w, 2 * Math.max(-m.min[0], m.max[0], -m.min[2], m.max[2])));
  });
  assert.deepEqual(tris, [132, 103, 156, 156, 261], 'the owner\'s triangles, every one');
  assert.equal(TREES.json.vertexBytes, verts.reduce((a, b) => a + b, 0) * 32);
  assert.equal(TREES.treesBin.byteLength, TREES.json.vertexBytes + tris.reduce((a, b) => a + b, 0) * 6, 'every vertex, then every index');
  assert.deepEqual(parseMtl('newmtl A\nmap_Kd a.png\nmap_d b.png\nnewmtl B\n').get('A'), { mapKd: 'a.png', mapD: 'b.png' });
  // AUDIT BANTHA1 TREE-7: a map's file after its options, spaces and all; a comment ends a face's line; a tree is one picture
  assert.deepEqual(parseMtl('newmtl A\nmap_Kd -o 0.1 0.2 0 -clamp on bark tree.png\n').get('A').mapKd, 'bark tree.png');
  assert.deepEqual(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3 # one\n').faces[0].corners, [[0, -1, -1], [1, -1, -1], [2, -1, -1]]);
  assert.throws(() => jungleMesh(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nv 1 1 0\nusemtl A\nf 1 2 3\nusemtl B\nf 2 4 3\n')), /one picture/);
  assert.throws(() => readJungleTrees(sources().slice(1)), /5 trees expected/);
});

test('BANTHA1 each tree as it stands, MEASURED off what it draws - its foot, its crown, where its crown begins, its trunk and its height - and the table the stream reads is the measure, to the centimetre; a jungle tree\'s cover its own trunk and crown at its scale (mutants: a row drifted; the foot read at the crown\'s height)', () => {
  JUNGLE_SPECIES.forEach((s, k) => {
    const m = measureTree(TREES.models[k], picture(TREES.pictures[k]));
    const r2 = (v) => Math.round(v * 100) / 100;
    assert.deepEqual(Object.fromEntries(Object.entries(m).map(([key, v]) => [key, r2(v)])), { ...JUNGLE_MEASURES[k] }, s.key);
  });
  assert.ok(JUNGLE_MEASURES.every((m) => m.foot < m.crown + 0.01 && m.crownFrom < m.height && m.trunk >= 0.35 && m.trunk <= 1.6));
  const base = [1, 2, 3], [trunk, crown] = jungleCover(base, 2, 1.2), m = JUNGLE_MEASURES[2];
  assert.equal(trunk.c, base, 'by reference - a felled tree is no cover (FELLED keys on it)');
  assert.deepEqual([trunk.r, trunk.h, trunk.lift], [m.trunk * 1.2, m.crownFrom * 1.2, 0]);
  assert.deepEqual([crown.r, crown.h, crown.lift], [m.crown * JUNGLE_CROWN_COVER * 1.2, (m.height - m.crownFrom) * 1.2, m.crownFrom * 1.2]);
  assert.equal(JUNGLE_CROWN_COVER, 2 * COVER_RADIUS_FRAC, 'AUDIT BANTHA1 LAY-6: a crown\'s cover at TACT1\'s own share of its width');
});

test('AUDIT BANTHA1 TREE-3: a jungle tree\'s Logging mark stands outside what the tree draws about its root - its trunk at its scale, or where its crown hangs to the ground its foot - and the glow\'s card stands where its mark says (mutants: every mark the trunkless pull; the glow\'s pull a constant again)', () => {
  const kapok = jungleTreeMark({ jungle: 1, js: 1.1 }), banyan = jungleTreeMark({ jungle: 0, js: 0.9 });
  assert.ok(near(kapok.pull, JUNGLE_MEASURES[1].trunk * 1.1 + JUNGLE_MARK_CLEAR, 1e-12), 'the kapok\'s outside its trunk');
  assert.ok(near(banyan.pull, JUNGLE_MEASURES[0].foot * 0.9 + JUNGLE_MARK_CLEAR, 1e-12), 'the banyan\'s outside its hanging roots');
  assert.equal(jungleTreeMark({ jungle: 1, js: 1.1 }), kapok, 'made once a species and scale');
  const marks = [{ key: 'a', at: [0, 0, 0], w: 2.6, h: 3.4, pull: kapok.pull, profession: 'logging' }, { key: 'b', at: [1, 0, 0], w: 2.6, h: 3.4, profession: 'logging' }];
  const st = createNodeGlowState(), out = [];
  nodeGlows(marks, [0, 1.7, 10], 0, st, out);
  nodeGlows(marks, [0, 1.7, 10], 0.2, st, out);   // kindled
  assert.deepEqual(out.map((g) => g.pull), [kapok.pull, NODE_GLOW_PULL], 'a glow its mark\'s pull, or the node\'s own');
  assert.match(text('src/render/nodeGlow.js'), /if \(g\.pull !== pull\) \{ pull = g\.pull \?\? NODE_GLOW_PULL; gl\.uniform1f\(U\.uPull, pull\); \}/, 'sent a glow at a time');
  assert.match(text('src/scenes/treeHost.js'), /n\.flat\?\.jungle != null \? jungleTreeMark\(n\.flat\) : TREE_MARK/);
});

test('AUDIT BANTHA1 TREE-1: the cover index files a crown wider than its cell ONCE, in its wide grid, and answers every ray as a search of every proxy would - a jungle pixel\'s 10,000 proxies were 148,000 references and 26-99 ms of the main thread (mutants: a wide proxy searched only in its own cell; filed in the fine grid again)', () => {
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const items = [];
  for (let i = 0; i < 1500; i++) {
    const r = i % 3 === 0 ? 4.5 + rnd() * 11 : 0.3 + rnd() * 3.5;   // a third wider than a cell (the jungle's crowns), the rest trunks and flats
    items.push({ c: [rnd() * 800, rnd() * 20, rnd() * 800], r, h: 2 + rnd() * 20, lift: rnd() < 0.5 ? 0 : 3 + rnd() * 6 });
  }
  const idx = createCoverIndex({ enabled: () => true });
  idx.add('px', items);
  assert.equal(idx.size(), items.length);
  assert.ok(idx.refs() < items.length * 4, `a wide proxy filed once (${idx.refs()} references for ${items.length})`);
  for (let k = 0; k < 3000; k++) {
    const o = [rnd() * 800, 1 + rnd() * 25, rnd() * 800], a = rnd() * Math.PI * 2, e = (rnd() - 0.5) * 0.6;
    const d = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)], max = 10 + rnd() * 140, sight = k % 2 === 0;
    let brute = Infinity;
    for (const it of items) brute = Math.min(brute, rayCylinder(o, d, it, Math.min(max, brute), sight ? max : null));
    assert.equal(idx.hit(o, d, max, sight), brute, `ray ${k}`);
  }
});

test('BANTHA1 a jungle tree\'s far picture is LPT1\'s own (renderImpostor): the owner\'s tree drawn from the side at LPT_IMPOSTOR_PER_M texels a metre, its trunk standing on the middle of its bottom row - the root moved to the origin - and its picture cut as the owner\'s picture is', () => {
  for (const [key, p] of TREES.protos) {
    const pic = renderImpostor(TREES, p, (n) => picture(TREES.atlases[n].picture));
    assert.equal(Math.round(pic.height / pic.shareH), Math.round(Math.min(256, p.size.h * LPT_IMPOSTOR_PER_M)), key);
    let drawn = 0;
    for (let i = 3; i < pic.data.length; i += 4) { if (pic.data[i]) drawn++; assert.ok(pic.data[i] === 0 || pic.data[i] === 255); }
    assert.ok(drawn > pic.width * pic.height * 0.25, `${key}: a tree's worth (${drawn})`);
    const bottom = pic.height - 2, mid = pic.width >> 1;
    let trunk = false;
    for (let x = mid - 3; x <= mid + 3; x++) if (pic.data[(bottom * pic.width + x) * 4 + 3]) trunk = true;
    assert.ok(trunk, `${key}: its trunk on its root, the middle of its bottom row`);
  }
});

test('BANTHA1 the field: each pixel near Bantha its signed distance from the region\'s edge (its centre to the other side\'s nearest square, pixels), held at the reach, read only when asked; read between pixel centres it crosses zero on the shared edge and agrees across every pixel edge, the wander and all (mutants: the sign lost; an axis neighbour read as its diagonal; a ring stopped short; the wander off the world lattice)', () => {
  // BANTHA2: the field's sides are a set of map pixels (the owner's area, world/jungle/banthaArea.js - test/world/
  // bantha2_area.test.js); BANTHA1's were Glenpoint's political region
  const W = 24, H = 16, inside = (x, y) => x >= 6 && x < 14 && y >= 4 && y < 11;
  let reads = 0;
  const field = jungleField({ width: W, height: H, insideAt: (x, y) => { reads++; return inside(x, y); } });
  const d = (x, y) => field.at(x, y);
  assert.equal(reads, 0, 'nothing read until asked');
  // against the brute force: every pixel of the map, the nearest square of the other side
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = JUNGLE_FIELD_REACH + 0.5;
      for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) if (inside(u, v) !== inside(x, y)) best = Math.min(best, Math.hypot(Math.max(Math.abs(u - x) - 0.5, 0), Math.max(Math.abs(v - y) - 0.5, 0)));
      assert.ok(near(d(x, y), inside(x, y) ? best : -best, 1e-6), `${x},${y}`);
    }
  }
  assert.ok(reads <= W * H, 'each pixel\'s side read once');
  assert.equal(d(-1, 3), -(JUNGLE_FIELD_REACH + 0.5), 'off the map: outside');
  assert.equal(d(6, 7), 0.5, 'a border pixel inside: half a pixel to the edge');
  assert.equal(d(5, 7), -0.5, 'its neighbour outside');
  assert.equal(d(8, 7), 2.5);
  assert.equal(d(3, 7), -2.5);
  assert.ok(near(d(4, 2), -Math.hypot(1.5, 1.5), 1e-6), 'off the corner: to the corner of the nearest inside square');
  assert.equal(d(23, 15), -(JUNGLE_FIELD_REACH + 0.5), 'held at the reach');
  // a ring's nearest square is r - 0.5 off and its corner farther: a diagonal found in ring 3 (2.5 by 2.5, 3.54) loses
  // to an axis neighbour in ring 4 (3.5) - the search runs every ring that could still beat what it holds
  const holes = new Set(['13,13', '14,10']);
  const pocked = jungleField({ width: 24, height: 24, insideAt: (x, y) => !holes.has(`${x},${y}`) });
  assert.equal(pocked.at(10, 10), 3.5, 'the axis neighbour a ring out, not the diagonal a ring in');
  assert.equal(jungleNine(field, 23, 15), null, 'nowhere near: no job');
  // the edge between (5,7) and (6,7): x = 819.2 in pixel 5, 0 in pixel 6 - zero there, and the same either side
  const n5 = jungleNine(field, 5, 7), n6 = jungleNine(field, 6, 7);
  assert.ok(near(jungleSignedAt(n5, PIXEL_M, PIXEL_M / 2), 0, 1e-6) && near(jungleSignedAt(n6, 0, PIXEL_M / 2), 0, 1e-6));
  assert.ok(jungleSignedAt(n6, PIXEL_M / 2, PIXEL_M / 2) > 0 && jungleSignedAt(n5, PIXEL_M / 2, PIXEL_M / 2) < 0);
  for (let t = 0; t <= 1; t += 0.0625) {
    // across x (pixel 7 to 8, row 6) and across z (row 7 is south of row 6: its north edge is z = 819.2 in it, z = 0 in row 6)
    const ax = jungleDepthAt(7, 6, jungleNine(field, 7, 6), PIXEL_M, t * PIXEL_M), bx = jungleDepthAt(8, 6, jungleNine(field, 8, 6), 0, t * PIXEL_M);
    const az = jungleDepthAt(9, 7, jungleNine(field, 9, 7), t * PIXEL_M, PIXEL_M), bz = jungleDepthAt(9, 6, jungleNine(field, 9, 6), t * PIXEL_M, 0);
    assert.ok(near(ax, bx, 1e-6) && near(az, bz, 1e-6), `continuous at ${t}`);
  }
  let most = 0;
  for (let i = 0; i < 400; i++) {
    const x = (i * 37.3) % PIXEL_M, z = (i * 91.7) % PIXEL_M;
    most = Math.max(most, Math.abs(jungleDepthAt(9, 7, n6, x, z) - jungleSignedAt(n6, x, z)));
  }
  assert.ok(most > 30 && most <= JUNGLE_WANDER_MAX + 1e-9, `the line wanders, within its bound (${most.toFixed(1)} of ${JUNGLE_WANDER_MAX})`);
  assert.equal(jungleShare(-JUNGLE_EDGE.out), 0);
  assert.equal(jungleShare(JUNGLE_EDGE.in), 1);
});

/** A synthetic pixel: a gentle slope of grass (a dirt tile every seventh), a cliff along x 100-104, a sea below the beach
 *  line at y < 6, and a track down column 64. */
function pixelGround() {
  const H = HEIGHTMAP_DIMENSION, T = 128;
  const hm = new Float32Array(H * H);
  const beach = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT;
  for (let a = 0; a < H; a++) {
    for (let b = 0; b < H; b++) {
      // sample(x, y) = data[x * hDim + y]: a is x (east), b is y (the tile rows)
      let h = beach * 1.6 + 0.004 * Math.sin(a / 9) + 0.0002 * b;
      if (a >= 100 && a <= 104) h += (a - 99) * 0.03;   // a cliff
      if (a > 104) h += 0.15;
      if (b < 6) h = beach * 0.5;   // the sea
      hm[a * H + b] = h;
    }
  }
  const tm = new Uint8Array(T * T).fill(2);
  for (let i = 0; i < tm.length; i += 7) tm[i] = 1;
  const paths = new Uint8Array(T * T);
  for (let y = 0; y < T; y++) paths[y * T + 64] = 1;
  return { hm, tm, paths };
}
const PX = 400, PY = 100;
const WHOLE = Object.freeze([3, 3, 3, 3, 3, 3, 3, 3, 3]);
const layoutOf = (g, nine, extra = {}) => {
  const opts = { mapPixelX: PX, mapPixelY: PY, rawWorldHeight: 80, climateType: 400, locationRect: null, forests: { archive: 500, pois: [], paths: g.paths } };
  const own = layoutNature(g.hm, g.tm, opts);
  return { own, out: withJungle(own, g.hm, g.tm, { ...opts, jungle: nine ? { nine, pois: extra.pois ?? [], paths: g.paths } : null }) };
};

test('BANTHA1 the layout, four storeys: a canopy tree a cell where the jungle is whole (the emergents the kapok\'s and the mahogany\'s alone), young trees in the light gaps and under the crowns, the rainforest\'s palms and its floor - each a flat of archive 500 with a Tree record of the species it is (mutants: the canopy\'s chance whole; an emergent of any species; the young trees\' scale the canopy\'s)', () => {
  const g = pixelGround();
  const { own, out } = layoutOf(g, WHOLE);
  const trees = out.filter((f) => f.jungle != null), rest = out.filter((f) => f.jungle == null);
  const canopy = trees.filter((f) => f.js >= JUNGLE.canopyScale[0]), young = trees.filter((f) => f.js <= JUNGLE.underScale[1]);
  assert.equal(canopy.length + young.length, trees.length, 'every tree a storey');
  // PIN MOVED (SPREAD): a canopy tree a SITE - every other cell, a quincunx - where it was a tree a cell
  const sites = (128 / JUNGLE.cell) ** 2 / 2;
  assert.ok(canopy.length > sites * 0.45 && canopy.length < sites * JUNGLE.canopy, `a closed canopy (${canopy.length} of ${sites} sites)`);
  // ...and the gaps are the canopy's own chance: no site stands its tree on a draw past JUNGLE.canopy, whatever its ground
  const C = JUNGLE.cell, cellOf = (f) => [PX * 128 + Math.floor(f.x / 6.4 / C) * C, -PY * 128 + Math.floor(f.z / 6.4 / C) * C];
  assert.deepEqual(canopy.filter((f) => tileDraw(...cellOf(f), 22) >= JUNGLE.canopy), [], 'a site\'s gap is kept at JUNGLE.canopy');
  assert.deepEqual(canopy.filter((f) => !canopySite(...cellOf(f))), [], 'every canopy tree on a site');
  assert.ok(young.length > 400, `an understorey (${young.length})`);   // PIN MOVED (SPREAD): a cell's one young tree at most - it was 600 a tile's
  for (const f of trees) {
    assert.equal(f.archive, 500); assert.equal(f.wood, 1);
    assert.equal(f.record, JUNGLE_SPECIES[f.jungle].record);
    if (f.js > JUNGLE.canopyScale[1]) assert.ok([1, 4].includes(f.jungle) && f.js <= JUNGLE.emergentScale[1], 'an emergent is a kapok or a mahogany');
  }
  assert.ok(canopy.some((f) => f.js > JUNGLE.canopyScale[1]), 'emergents stand');
  assert.deepEqual([...new Set(canopy.map((f) => f.jungle))].sort(), [0, 1, 2, 3, 4], 'every species');
  const palms = rest.filter((f) => JUNGLE_PALMS.includes(f.record)), floor = rest.filter((f) => JUNGLE_COVER.includes(f.record));
  assert.equal(palms.length + floor.length, rest.length, 'the rest is the rainforest\'s own: its palms and its floor');
  assert.ok(rest.every((f) => f.archive === 500));
  assert.ok(floor.length > 16384 * 0.3 * 0.6, `a covered floor (${floor.length})`);
  assert.deepEqual(JUNGLE_PALMS, TREE_RECORDS[500]);
  assert.ok(own.length > 0 && !out.some((f) => own.includes(f)), 'where the jungle is whole the pixel\'s own layout gives way on every tile');
});

test('BANTHA1 where a jungle tree may not stand: on a track, in a place\'s clearing, up a cliff, under the beach line - and the storeys under the canopy keep their distance from its trunks (mutants: the track ignored; the slope test off; the trunk\'s clearance its own cell\'s alone)', () => {
  const g = pixelGround();
  const town = { xMin: 20, xMax: 30, yMin: 40, yMax: 50, hide: false };
  const { out } = layoutOf(g, WHOLE, { pois: [town] });
  const j = out.filter((f) => f.archive === 500 && (f.jungle != null || JUNGLE_PALMS.includes(f.record) || JUNGLE_COVER.includes(f.record)));
  const tile = (f) => [Math.floor(f.x / 6.4), Math.floor(f.z / 6.4)];
  for (const f of j) {
    const [x, y] = tile(f);
    assert.notEqual(x, 64, 'never on the track');
    assert.ok(!(x >= town.xMin - 4 && x < town.xMax + 4 && y >= town.yMin - 4 && y < town.yMax + 4), 'never in the clearing');
    assert.ok(y >= 6, 'never under the beach line');
    assert.ok(!(x >= 99 && x <= 104), `never up the cliff (${x})`);
  }
  const canopy = j.filter((f) => f.jungle != null && f.js >= JUNGLE.canopyScale[0]);
  const under = j.filter((f) => f.jungle != null && f.js <= JUNGLE.underScale[1]);
  const palms = j.filter((f) => f.jungle == null && JUNGLE_PALMS.includes(f.record)), floor = j.filter((f) => f.jungle == null && JUNGLE_COVER.includes(f.record));
  const clearOf = (list, clear) => list.every((f) => canopy.every((c) => Math.hypot(f.x - c.x, f.z - c.z) >= clear * c.js - 1e-9));
  assert.ok(clearOf(under, JUNGLE.underClear) && clearOf(palms, JUNGLE.underClear), 'a young tree and a palm keep JUNGLE.underClear of every canopy trunk, at its scale');
  assert.ok(clearOf(floor, JUNGLE.coverClear), 'a plant JUNGLE.coverClear');
  // the light: near the town the woods draw back, so its ring is open ground - few canopy trees, the flame tree's light
  const ring = canopy.filter((f) => { const [x, y] = tile(f); return Math.max(town.xMin - x, 0, x - town.xMax) + Math.max(town.yMin - y, 0, y - town.yMax) < 8; });
  assert.ok(ring.length < 8, `the town's fields stand few canopy trees (${ring.length})`);
});

test('BANTHA1 every tree its own dice, and the border\'s stands: the jungle\'s flats are a hash of their world tile, the same whatever the pixel\'s own layout was; past the line\'s reach the pixel\'s own layout is the answer itself; across the border the jungle comes in by tiles, thicker inward (mutants: a stream walked across the pixel; the reach test off)', () => {
  const g = pixelGround();
  const a = layoutOf(g, WHOLE).out.filter((f) => f.jungle != null);
  const opts = { mapPixelX: PX, mapPixelY: PY, locationRect: null };
  const b = withJungle([{ record: 1, x: 3, y: 0, z: 3 }], g.hm, g.tm, { ...opts, jungle: { nine: WHOLE, pois: [], paths: g.paths } }).filter((f) => f.jungle != null);
  assert.deepEqual(b, a, 'the same jungle over another layout');
  assert.deepEqual(withJungle([], g.hm, g.tm, { ...opts, jungle: { nine: WHOLE, pois: [], paths: g.paths } }).filter((f) => f.jungle != null), a, 'AUDIT BANTHA1 PERF-6: a pixel the jungle owns whole needs no layout of its own (the kernel lays none)');
  assert.equal(jungleWhole(WHOLE), true); assert.equal(jungleWhole([-0.5, 0.5, 1.5, -0.5, 0.5, 1.5, -0.5, 0.5, 1.5]), false);
  const own = [{ record: 1, x: 1, y: 0, z: 1 }];
  assert.equal(withJungle(own, g.hm, g.tm, { ...opts, jungle: { nine: [-3, -3, -3, -3, -3, -3, -3, -3, -3], pois: [], paths: null } }), own, 'out of reach: the pixel\'s own, untouched');
  assert.equal(withJungle(own, g.hm, g.tm, { ...opts, jungle: null }), own);
  // the border: the jungle's side to the east (the pixel's own centre on the line's west, -0.5 from it)
  const border = [-1.5, -0.5, 0.5, -1.5, -0.5, 0.5, -1.5, -0.5, 0.5].map((v) => v + 0.5);   // the line through the pixel's middle
  const { out } = layoutOf(g, border);
  const west = out.filter((f) => f.jungle != null && f.x < 300).length, east = out.filter((f) => f.jungle != null && f.x > 520 && f.x < 640).length;
  assert.ok(west === 0 && east > 60, `none past the line, thickening in (${west} west, ${east} east)`);
  const over = withJungle([{ record: 1, x: 3, y: 0, z: 3 }], g.hm, g.tm, { ...opts, jungle: { nine: border, pois: [], paths: g.paths } }).filter((f) => f.jungle != null);
  assert.deepEqual(over, out.filter((f) => f.jungle != null), 'the border\'s tiles the same over another layout - each tile its own dice');
  const mixed = out.filter((f) => f.x > 400 && f.x < 520);
  assert.ok(mixed.some((f) => f.jungle != null) && mixed.some((f) => f.jungle == null && !JUNGLE_COVER.includes(f.record) && f.archive !== 500), 'at the line both stand, tile by tile');
});

test('AUDIT BANTHA1 LAY-1/2/3/7/8/9: the groves and the stands on the world\'s lattice, continuous across every pixel edge; a hillside past 34 degrees stands its floor and palms to DFU\'s 50, never a tree; a town\'s fields are open ground, never a thicket; nothing under the canopy crowds a trunk across a pixel\'s edge; the field\'s first read the float32 every later one is (mutants: the grove\'s cell off the lattice; the floor held to the trees\' slope; the fields a light gap; the neighbour\'s trunks unseen; the stands a tile\'s white noise)', () => {
  // LAY-1 and LAY-9: the same world point read from either side of an edge
  assert.equal(128 % JUNGLE.grove.cell, 0, 'the grove\'s cell divides a pixel');
  for (const S of JUNGLE.stands.octaves) assert.equal(128 % S.cell, 0);
  for (let t = 0; t <= 128; t += 3.7) {
    for (let sp = 0; sp < 5; sp++) {
      const a = ecoNoise(ecoOrigin(PX, PY), 128, t, JUNGLE.grove.cell, JUNGLE.grove.salt + sp), b = ecoNoise(ecoOrigin(PX + 1, PY), 0, t, JUNGLE.grove.cell, JUNGLE.grove.salt + sp);
      assert.ok(near(a, b, 1e-12), `a grove across the east edge at ${t}`);
    }
    assert.ok(near(jungleStandNoise(ecoOrigin(PX, PY), t, 128), jungleStandNoise(ecoOrigin(PX, PY - 1), t, 0), 1e-12), `a stand across the north edge at ${t}`);
  }
  let same = 0, n = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 127; x++) { same += (jungleStandNoise(ecoOrigin(PX, PY), x + 0.5, y + 0.5) < 0.5) === (jungleStandNoise(ecoOrigin(PX, PY), x + 1.5, y + 0.5) < 0.5); n++; }
  assert.ok(same / n > 0.8, `a tile and its neighbour mostly one side of a half share - stands, not white noise (${(same / n).toFixed(2)})`);
  // LAY-2: a 40-degree hillside down the pixel's middle
  const g = pixelGround(), H = HEIGHTMAP_DIMENSION, yScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, cellM = 819.2 / (H - 1);
  const rise = Math.tan(40 * Math.PI / 180) * cellM / yScale;
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) g.hm[a * H + b] += a < 30 ? 0 : a < 60 ? (a - 30) * rise : 30 * rise;
  const onSlope = layoutOf(g, WHOLE).out.filter((f) => f.x > 34 * 6.4 && f.x < 56 * 6.4 && f.z > 10 * 6.4);
  assert.equal(onSlope.filter((f) => f.jungle != null).length, 0, 'no jungle tree up a 40-degree slope');
  assert.ok(onSlope.length > 200, `its floor and palms stand (${onSlope.length})`);
  // LAY-3: a town's fields against the deep jungle
  const g3 = pixelGround(), town = { xMin: 20, xMax: 30, yMin: 40, yMax: 50, hide: false };
  const out3 = layoutOf(g3, WHOLE, { pois: [town] }).out;
  const young = (f) => f.jungle != null && f.js <= JUNGLE.underScale[1];
  const tile = (f) => [Math.floor(f.x / 6.4), Math.floor(f.z / 6.4)];
  const ringD = (f) => { const [x, y] = tile(f); return Math.max(town.xMin - x, 0, x - (town.xMax - 1)) + Math.max(town.yMin - y, 0, y - (town.yMax - 1)); };
  const ringYoung = out3.filter((f) => young(f) && ringD(f) >= 4 && ringD(f) <= 8).length;
  const deepYoung = out3.filter((f) => young(f) && tile(f)[0] >= 70 && tile(f)[0] < 98 && tile(f)[1] >= 70 && tile(f)[1] < 98).length / (28 * 28);
  assert.ok(ringYoung / 220 < deepYoung, `a town's ring stands fewer young trees a tile than the deep jungle (${(ringYoung / 220).toFixed(3)} vs ${deepYoung.toFixed(3)})`);
  // LAY-7: two pixels side by side over flat grass - every cell at the west one's east edge whose young tree or palm a
  // trunk of the EAST pixel's crowds (and none of its own) stands nothing; such a cell is rare (a trunk stands 3.2 m
  // inside its site), so fifty edges are read. PIN MOVED (SPREAD): the understorey a cell's - its place in the cell and
  // its roll (salts 40-42), a light gap where no crown reaches - where it was a tile's
  const flat = { hm: new Float32Array(HEIGHTMAP_DIMENSION ** 2).fill(SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT * 1.6), tm: new Uint8Array(16384).fill(2), paths: new Uint8Array(16384) };
  const S7 = PIXEL_M / 128, C7 = JUNGLE.cell, [u0, u1] = JUNGLE.underInset, [i0, i1] = JUNGLE.inset;
  const lay = (px) => withJungle([], flat.hm, flat.tm, { mapPixelX: px, mapPixelY: PY, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: flat.paths } });
  const canopyOf = (l) => l.filter((f) => f.jungle != null && f.js >= JUNGLE.canopyScale[0]);
  let crowded = 0, shaded = 0, lit = 0;
  for (let px = 300; px < 350; px++) {
    const west = lay(px), east = lay(px + 1);
    const trunksE = canopyOf(east).filter((f) => f.x < 20).map((f) => [f.x + PIXEL_M, f.z, f.js]), trunksW = canopyOf(west).map((f) => [f.x, f.z, f.js]);
    const all = [...trunksW, ...trunksE];
    // the east pixel's first column as the west one reads it: every SITE's trunk where it would stand, by its pure tile
    // hashes - held as standing, grown or not (a glade's, the canopy's tenth unrolled)
    const held = [];
    for (let j = 0; j < 128 / C7; j++) {
      const i = 128 / C7, wx = (px + 1) * 128, wz = -PY * 128 + j * C7;
      if (!canopySite(wx, wz)) continue;
      const [s0, s1] = tileDraw(wx, wz, 23) < JUNGLE.emergent ? JUNGLE.emergentScale : JUNGLE.canopyScale;
      held.push([(i * C7 + C7 * (i0 + (i1 - i0) * tileDraw(wx, wz, 20))) * S7, (j * C7 + C7 * (i0 + (i1 - i0) * tileDraw(wx, wz, 21))) * S7, s0 + (s1 - s0) * tileDraw(wx, wz, 25)]);
    }
    for (let cy = 0; cy < 128 / C7; cy++) {
      const cx = 128 / C7 - 1, wx = px * 128 + cx * C7, wz = -PY * 128 + cy * C7;
      const mx = (cx * C7 + C7 * (u0 + (u1 - u0) * tileDraw(wx, wz, 40))) * S7, mz = (cy * C7 + C7 * (u0 + (u1 - u0) * tileDraw(wx, wz, 41))) * S7;
      const near = (ts, r) => ts.some(([tx, tz, js]) => Math.hypot(mx - tx, mz - tz) < r * js);
      const roll = tileDraw(wx, wz, 42), hit = (ts) => near(ts, JUNGLE.underClear);
      // SPREAD: a cell under a crown of the EAST pixel's alone is under a crown - a roll past the crown's young trees and
      // the palms, short of the gap's, stands nothing there (the gap's law would stand a young tree)
      if (near(trunksE, JUNGLE.crown) && !near(trunksW, JUNGLE.crown) && !hit(all) && roll >= JUNGLE.under + JUNGLE.palm && roll < JUNGLE.gapUnder) {
        shaded++;
        assert.ok(!west.some((f) => f.x === mx && f.z === mz), `pixel ${px}'s cell (${cx}, ${cy}) stands no young tree in its neighbour's shade`);
      }
      // and the other way: a cell no crown reaches - the west pixel's grown trees', the east one's held sites' - its roll
      // under the gap's young trees (whole jungle, grass), stands its young tree: a neighbour pixel's cell that is no
      // site holds no trunk to shade it (the north and south pixels' cells read too at the first and last rows: not here;
      // nor a cell a young tree's foot from a trail's dirt - JUNGLE-TRAILS keeps it off)
      const youngFoot = Math.max(...JUNGLE_MEASURES.map((m) => m.foot)) * JUNGLE.underScale[1];
      if (cy > 0 && cy < 128 / C7 - 1 && !near([...trunksW, ...held], JUNGLE.crown) && roll < JUNGLE.gapUnder * JUNGLE.ground[2] && trailRoom(px, PY, mx, mz) >= youngFoot) {
        lit++;
        assert.ok(west.some((f) => f.x === mx && f.z === mz && young(f)), `pixel ${px}'s cell (${cx}, ${cy}) stands its young tree in the light`);
      }
      {
        if (!hit(trunksE) || hit(trunksW)) continue;
        crowded++;
        assert.ok(!west.some((f) => f.x === mx && f.z === mz), `pixel ${px}'s cell (${cx}, ${cy}) stands nothing under its neighbour's crown`);
      }
    }
  }
  assert.ok(crowded + shaded >= 3, `the edges read (${crowded} cells crowded across them, ${shaded} shaded)`);
  assert.ok(lit >= 20, `the edges' light gaps read (${lit})`);
  // LAY-8: the field's first read is a float32
  const field = jungleField({ width: 24, height: 16, insideAt: (x, y) => x >= 6 && x < 14 && y >= 4 && y < 11 });
  for (const [x, y] of [[4, 2], [15, 12], [5, 3]]) { const v = field.at(x, y); assert.equal(v, Math.fround(v)); assert.equal(field.at(x, y), v); }
});

test('AUDIT BANTHA1 PERF-2: a pixel\'s nature crosses the worker\'s wire by column - its buffers transferred, every flat made again with the values it had (the common eight one shape, undefined where lacked), a list with a field no column holds crossing as it is (mutants: a column\'s NaN read as a value; the worker\'s reply cloned again)', () => {
  const g = pixelGround(), border = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const list = [...layoutOf(g, WHOLE).out, ...layoutOf(g, border).out, { record: 3, x: 1, y: 2, z: 3, archive: 302, extra: 7 }];
  const packed = packNature(list);
  assert.equal(packed.wire, 'nature');
  assert.equal(natureBuffers(packed).length, packed.keys.length, 'a buffer a column, to transfer');
  const back = unpackNature(structuredClone(packed));
  assert.equal(back.length, list.length);
  for (let i = 0; i < list.length; i++) {
    for (const [k, v] of Object.entries(list[i])) assert.equal(back[i][k], v, `flat ${i}'s ${k}`);
    for (const [k, v] of Object.entries(back[i])) if (v !== undefined) assert.equal(list[i][k], v, `flat ${i} gained ${k}`);
  }
  assert.equal(back.at(-1).extra, 7, 'a field past the eight by name');
  const odd = [{ record: 1, x: 0, y: 0, z: 0, tag: 'a' }];
  assert.equal(packNature(odd), odd, 'a field no column holds: the list as it is');
  assert.deepEqual(packNature([]), []);
  assert.equal(unpackNature(odd), odd);
  assert.match(text('src/world/terrain/terrainGenWorker.js'), /out\.nature = packNature\(out\.nature\);[^\n]*\n\s*transfer\.push\(\.\.\.natureBuffers\(out\.nature\)\);/);
  assert.match(text('src/world/terrain/terrainGenClient.js'), /out\.nature = unpackNature\(out\.nature\);/);
});

test('BANTHA1 the species: banyans and figs crowd the low wet ground, kapoks and mahoganies the uplands, the flame tree the light - drawn from weights that are each species\' grove times its ground times its light (mutants: the ground ignored; the light ignored)', () => {
  const origin = ecoOrigin(PX, PY);
  const share = (above, light) => {
    const n = [0, 0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) n[canopySpecies(origin, (i * 7.31) % 128, (i * 3.17) % 128, above, light, (i + 0.5) / 4000)]++;
    return n.map((v) => v / 4000);
  };
  const low = share(0, 0), high = share(400, 0), lit = share(60, 1), shade = share(60, 0);
  assert.ok(low[0] + low[2] > high[0] + high[2] + 0.15, `low ground: banyan and fig (${(low[0] + low[2]).toFixed(2)} vs ${(high[0] + high[2]).toFixed(2)})`);
  assert.ok(high[1] + high[4] > low[1] + low[4] + 0.15, `high ground: kapok and mahogany (${(high[1] + high[4]).toFixed(2)} vs ${(low[1] + low[4]).toFixed(2)})`);
  assert.ok(lit[3] > shade[3] * 2, `the flame tree takes the light (${lit[3].toFixed(2)} vs ${shade[3].toFixed(2)})`);
});

test('BANTHA1 the haze\'s law: the mean density along a ray through a layer whole under its floor and falling off above it is exact (against a fine sum), the transmittance its exponential, and the shader\'s twin (render/hazeGlsl.js) is this function term for term, as the fog block carries it (mutants: the floor\'s share dropped; the clear start ignored; the sky\'s depth not over the ray\'s rise)', () => {
  for (const [a, b] of [[0, 0], [-2, -1], [-1, 2], [0.5, 3], [3, 0.2], [-3, 4], [1, 1.00001]]) {
    let sum = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) { const h = a + (b - a) * ((i + 0.5) / N); sum += h <= 0 ? 1 : Math.exp(-h); }
    assert.ok(near(hazeMean(a, b), sum / N, 2e-4), `${a} to ${b}`);
  }
  const u = Float32Array.from([0.006, 40, 1 / 90, 8, 1, 0, 0, 0]);
  const eye = [0, 41.7, 0];
  assert.equal(hazeTransmittance(u, eye, [0, 41.7, 7.9]), 1, 'inside the clear start');
  assert.ok(near(hazeTransmittance(u, eye, [0, 30, 300]), Math.exp(-u[0] * (Math.hypot(11.7, 300) - 8) * hazeMean((41.7 - 40) * u[2], (30 - 40) * u[2])), 1e-12));
  assert.equal(hazeTransmittance(Float32Array.from([0.006, 40, 1 / 90, 8, 0, 0, 0, 0]), eye, [0, 0, 5000]), 1, 'off');
  const fns = glslFunctions(HAZE_LAW_GLSL, { uJungleHaze: [[u[0], u[1], u[2], u[3]], [1, 0, 0, 0]] });
  for (let i = 0; i < 60; i++) {
    const p = [Math.sin(i) * 900, 20 + (i * 37) % 400, Math.cos(i * 1.7) * 900];
    assert.ok(near(fns.hazeAt(p, eye), hazeTransmittance(u, eye, p), 1e-9), `the GPU's hazeAt is the CPU's at ${p.map((v) => v.toFixed(0))}`);
  }
  assert.ok(FOG_GLSL.includes(HAZE_LAW_GLSL), 'every world program takes it in the fog block');
  assert.match(FOG_GLSL, /float fogFactorAt\(vec3 worldPos\) \{ return weatherFogAt\(worldPos\) \* hazeAt\(worldPos, focusOrigin\(\)\); \}/, '...and fogs by both, multiplied');
  const sky = glslFunctions(HAZE_SKY_GLSL, { uHazeSky: [0.5, 0.6, 0.55, 0.7] });
  for (const y of [-0.2, 0, 0.003, 0.1, 0.5, 1]) assert.ok(near(sky.hazeSkyMix(y), 1 - Math.exp(-0.7 / Math.max(y, 0.004)), 1e-12), `the sky at ${y}`);
  assert.ok(near(sky.hazeSkyMix(0), 1, 1e-12), 'the horizon is the haze');
  assert.equal(glslFunctions(HAZE_SKY_GLSL, { uHazeSky: [0.5, 0.6, 0.55, 0] }).hazeSkyMix(0.2), 0, 'no depth, no haze');
  assert.ok(near(hazeColumn(u, 41.7), u[0] * (Math.exp(-(41.7 - 40) * u[2]) / u[2]), 1e-9), 'the column over an eye above the floor');
  assert.ok(near(hazeColumn(u, 30), u[0] * (10 + 1 / u[2]), 1e-9), '...and under it');
});

/** A template literal's text from just after its opening backtick - its `${...}` expressions kept whole, a template
 *  inside one skipped - and the index past its closing backtick. */
function templateText(s, i) {
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { out += s.slice(i, i + 2); i += 2; continue; }
    if (c === '`') return [out, i + 1];
    if (c === '$' && s[i + 1] === '{') {
      let depth = 1, j = i + 2;
      while (j < s.length && depth > 0) {
        if (s[j] === '`') { j = templateText(s, j + 1)[1]; continue; }
        if (s[j] === '{') depth++; else if (s[j] === '}') depth--;
        j++;
      }
      out += s.slice(i, j); i = j; continue;
    }
    out += c; i++;
  }
  return [out, i];
}

test('BANTHA1 every shader that calls the haze takes its block - the skies the sky\'s half, the far rings the ring\'s, the rest the fog block - read on every template in src/ (a call with no block compiles nowhere, and no other reader in the suite asks) (mutants: the dome\'s block left out; the mod\'s skybox\'s left out)', () => {
  const NEEDS = [
    [/\bhazeSky(?:Mix)?\(/, ['HAZE_SKY_GLSL']],
    [/\bringHaze\(/, ['RING_HAZE_GLSL']],
    [/\bhazeAt\(v/, ['FOG_GLSL', 'EL_FOG_GLSL', 'HAZE_LAW_GLSL', 'RING_HAZE_GLSL']],
  ];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  const callers = [];
  for (const f of walk(join(ROOT, 'src'))) {
    const s = readFileSync(f, 'utf8');
    for (let at = s.indexOf('`#version 300 es'); at >= 0; at = s.indexOf('`#version 300 es', at + 1)) {
      const body = templateText(s, at + 1)[0];
      for (const [call, blocks] of NEEDS) {
        if (!call.test(body)) continue;
        callers.push(f);
        assert.ok(blocks.some((k) => body.includes(`\${${k}}`)), `${f}: a template calls ${call} with none of ${blocks.join(', ')} in it`);
      }
    }
  }
  for (const p of ['skyRenderer.js', 'enhancedSky.js', 'dynamicSkiesRenderer.js', 'volumetricClouds.js', 'farRing.js', 'enhancedLighting.js', 'waterSurface.js']) {
    assert.ok(callers.some((f) => f.endsWith(join('render', p))), `the sweep reads ${p}`);
  }
});

test('AUDIT BANTHA1 HAZE-3: every fogged pass that draws where the haze is armed looks its uniform up and uploads it from its fog, and every fog the hosts hand a pass carries the haze; the rest are named, each drawn only in a mode\'s frame (the court, the Abyss\'s realm, the Breach\'s halls), whose beginFrame clears the unarmed haze (mutants: a glow left unhazed; a host\'s fog without it)', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  const MODE_FRAMES_ONLY = new Set(['render/courtCrystals.js', 'render/gate/gateTelegraph.js', 'render/gate/gateFx.js', 'render/deadlands.js',
    'render/eliteGates/egMistPass.js', 'render/eliteGates/egMotes.js', 'render/eliteGates/egLightPass.js', 'render/eliteGates/egLinePass.js',
    'render/superDungeon/sdBeam.js', 'render/superDungeon/sdPillarPass.js', 'render/superDungeon/sdStompWall.js', 'render/superDungeon/sdRiftPass.js',
    'render/superDungeon/sdMotes.js', 'render/superDungeon/sdHalo.js', 'render/superDungeon/sdArenaGlow.js', 'render/superDungeon/sdStepsPass.js']);
  const fogged = [], unhazed = [], bare = [];
  for (const f of walk(join(ROOT, 'src'))) {
    const rel = f.slice(join(ROOT, 'src').length + 1).split('\\').join('/'), s = readFileSync(f, 'utf8');
    for (const l of s.split('\n')) if (/mode: [\w.]*_fogMode, density/.test(l) && !/haze: [\w.]*_haze\b/.test(l)) bare.push(`${rel}: ${l.trim().slice(0, 90)}`);
    if (!/'uFogMode'|u\('uFogMode'\)/.test(s)) continue;
    fogged.push(rel);
    if (!s.includes("'uJungleHaze'") && !MODE_FRAMES_ONLY.has(rel)) unhazed.push(rel);
  }
  assert.deepEqual(unhazed, [], 'a fogged pass that never takes the jungle\'s haze');
  assert.deepEqual(bare, [], 'a host\'s fog handed without the haze');
  for (const rel of MODE_FRAMES_ONLY) assert.ok(fogged.includes(rel), `${rel} is still a fogged pass (else drop it from the list)`);
  for (const p of ['render/nodeGlow.js', 'render/auraRing.js', 'render/spoilsGlow.js', 'render/gate/gatePass.js', 'render/riteSmoke.js', 'render/superDungeon/sdOmenPass.js', 'render/foeTelegraph.js']) {
    assert.match(text(`src/${p}`), /if \(U\.uJungleHaze\) gl\.uniform4fv\(U\.uJungleHaze, fog\?\.haze \?\? NO_HAZE\);/, `${p} uploads it`);
  }
  // AUDIT NODE-GLINT: the nodes' glint reads the frame's own (the renderer's), as its fog
  assert.match(text('src/render/nodeGlint.js'), /if \(L\.uJungleHaze\) gl\.uniform4fv\(L\.uJungleHaze, r\._haze\);/, 'render/nodeGlint.js uploads it');
});

test('AUDIT BANTHA1 HAZE-1: every program a module under src/render exports compiles whole in the repo\'s GLSL reader - a block\'s uniform redeclared beside it (the Deadlands\' sea declared its own uHaze under the fog block\'s, and on the branch the Burning Court\'s sky and sea would not build) is a type error there; the jungle\'s uniform has a name of its own (mutant: the jungle\'s uniform named uHaze again)', async () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  const PREPROCESSED = new Set(['render/dynamicSkiesRenderer.js FS']);   // Dynamic Skies' own #define - the reader takes no preprocessor
  const bad = [];
  let n = 0;
  for (const f of walk(join(ROOT, 'src', 'render'))) {
    const m = await import(f);
    for (const [k, v] of Object.entries(m)) {
      if (typeof v !== 'string' || !v.includes('#version 300 es')) continue;
      const key = `${f.slice(join(ROOT, 'src').length + 1).split('\\').join('/')} ${k}`;
      if (PREPROCESSED.has(key)) continue;
      n++;
      try { glslFunctions(v.replace(/^[\s\S]*?#version[^\n]*\n/, ''), {}, { eager: true }); } catch (e) { bad.push(`${key}: ${String(e.message).split('\n')[0]}`); }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(n > 140, `the sweep read the programs (${n})`);
  assert.match(HAZE_LAW_GLSL, /uniform vec4 uJungleHaze\[2\];/);
  assert.match(text('src/render/deadlands.js'), /uniform vec3 uHaze;/, 'the Deadlands keep their own');
});

test('BANTHA1 what the haze hides: a box is hidden only where every point of it sends less than JUNGLE_HAZE.cull of its light through the haze ALONE (AUDIT BANTHA1 HOST-4: the sky shown in its place is the fog colour only by the haze\'s own depth) - a bound read at its nearest point and its top, never a guess; near, high or with the haze off, it stands (mutants: the box\'s bottom read for its top; the bound turned)', () => {
  const u = Float32Array.from([0.0055, 30, 1 / 90, 8, 1, 0, 0, 0]);
  const eye = [0, 3.7, 0];
  let hidden = 0, standing = 0;
  for (let i = 0; i < 400; i++) {
    const cx = Math.sin(i * 2.3) * 4000, cz = Math.cos(i * 1.1) * 4000, w = 50 + (i % 7) * 120, top = (i % 5) * 300;
    const box = [cx - w, -20, cz - w, cx + w, top, cz + w], t = [0, 0, 0];
    if (!hazeHides(u, eye, box, t)) { standing++; continue; }
    hidden++;
    for (let k = 0; k < 40; k++) {
      const p = [box[0] + (box[3] - box[0]) * ((k * 0.37) % 1), box[1] + (box[4] - box[1]) * ((k * 0.61) % 1), box[2] + (box[5] - box[2]) * ((k * 0.83) % 1)];
      assert.ok(hazeTransmittance(u, eye, p) < JUNGLE_HAZE.cull, 'every point of a hidden box is past the cull');
    }
  }
  assert.ok(hidden > 50 && standing > 50, `both kinds (${hidden} hidden, ${standing} standing)`);
  assert.equal(hazeHides(u, eye, [-50, -10, -50, 50, 20, 50]), false, 'the box the eye stands in');
  assert.equal(hazeHides(u, eye, [1500, 0, -50, 1600, 4000, 50]), false, 'a peak over the haze: its top sends its light');
  assert.equal(hazeHides(u, eye, [1500, 0, -50, 1600, 20, 50]), true, 'the low ground there does not');
  assert.equal(hazeHides(Float32Array.from([0.0055, 30, 1 / 90, 8, 0, 0, 0, 0]), eye, [5000, 0, 0, 5100, 1, 100]), false, 'no haze, nothing hidden');
  assert.equal(hazeHides(u, eye, [900, 0, -10, 950, 1, 10], [0, 0, 0]), false, 'the haze leaves 950 m');
  // the haze's fringe: thin air (a fortieth of the jungle's) hides nothing 2.6 km off, whatever the weather's fog does there
  const thin = Float32Array.from([0.0055 / 40, 30, 1 / 90, 8, 1, 0, 0, 0]);
  assert.equal(hazeHides(thin, eye, [2600, 0, -10, 2700, 40, 10]), false, 'the fringe hides nothing the haze still shows');
  assert.equal(hazeHides.length, 3, 'no weather in the bound (its fourth argument, the translation, has a default)');
});

test('BANTHA1 the haze, eased and coloured: share, density and floor each follow their target by their own lag and snap on the first frame and a jump; by the hour (the dawn\'s mist the thickest), the weather and the drifting banks; its colour the weather\'s fog made humid, the frame\'s one colour the two weighed by their depths, the sky\'s uniform that colour and the column (mutants: no easing; the weight inverted; the dawn thinned)', () => {
  const s = createHazeState();
  stepHaze(s, { dt: 0.016, eye: [0, 0, 0], share: 1, density: 0.005, floor: 40 });
  assert.deepEqual([s.share, s.density, s.floor], [1, 0.005, 40], 'the first frame snaps');
  stepHaze(s, { dt: 1, eye: [3, 0, 0], share: 0, density: 0.01, floor: 0 });
  assert.ok(near(s.share, Math.exp(-1 / JUNGLE_HAZE.lag.share)) && near(s.density, 0.01 - 0.005 * Math.exp(-1 / JUNGLE_HAZE.lag.density)) && near(s.floor, 40 * Math.exp(-1 / JUNGLE_HAZE.lag.floor)), 'then eases, each by its own lag');
  stepHaze(s, { dt: 0.016, eye: [JUNGLE_HAZE.jump + 10, 0, 0], share: 0.25, density: 0.002, floor: 7 });
  assert.deepEqual([s.share, s.density, s.floor], [0.25, 0.002, 7], 'a jump snaps');
  const u = hazeUniforms(s);
  assert.ok(near(u[0], 0.25 * 0.002) && u[1] === 7 && near(u[2], 1 / JUNGLE_HAZE.falloff) && u[3] === JUNGLE_HAZE.start && u[4] === 1);
  assert.equal(hazeUniforms({ ...s, share: 0 })[4], 0, 'no share: off');
  assert.ok(near(hazeDensityAt(u, 7 + JUNGLE_HAZE.falloff), 0.25 * 0.002 * Math.exp(-1), 1e-9), 'a falloff over the floor: e less');
  // the clock: thickest at dawn, thinnest in the afternoon, round the clock
  const day = [0, 3, 6.5, 9, 13, 16, 20, 24].map(hazeDayFactor);
  assert.equal(Math.max(...day), hazeDayFactor(6.5));
  assert.equal(Math.min(...day), hazeDayFactor(13));
  assert.equal(hazeDayFactor(24), hazeDayFactor(0));
  assert.ok(near(hazeDayFactor(25.5), hazeDayFactor(1.5)));
  assert.ok(hazeWeatherFactor('rain') > hazeWeatherFactor('cloudy') && hazeWeatherFactor('cloudy') > hazeWeatherFactor('sunny') && hazeWeatherFactor('nonsense') === 1);
  // the banks drift: a factor within its amplitude, moving with time along the wind
  const at = [0, 1, 2, 3].map((k) => hazeDrift(1000, 2000, k * 120, [1, 0]));
  assert.ok(at.every((v) => v >= 1 - JUNGLE_HAZE.drift.amp - 1e-9 && v <= 1 + JUNGLE_HAZE.drift.amp + 1e-9) && new Set(at.map((v) => v.toFixed(6))).size > 2);
  assert.ok(near(hazeDrift(1000, 2000, 100, [5, 0]), hazeDrift(1000 - JUNGLE_HAZE.drift.speed * 100, 2000, 0, null)), 'blown along the wind\'s way, at its own pace (not the wind\'s)');
  // the colour
  const fog = Float32Array.from([0.62, 0.7, 0.8]);
  const hc = hazeColorOf(fog);
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  assert.ok(near(lum(hc), lum(fog), 0.02) && hc[1] > hc[0] && hc[1] > hc[2], 'humid: its brightness kept, leaned to green');
  const row = { mode: 'linear', density: 0, start: 0, end: 4000 };
  assert.deepEqual(Array.from(fogColorWith(fog, row, Float32Array.from([0, 0, 1, 8, 0, 0, 0, 0]), 1.7)), Array.from(fog), 'no haze: the weather\'s exactly');
  const thick = fogColorWith(fog, row, Float32Array.from([0.006, 40, 1 / 90, 8, 1, 0, 0, 0]), 1.7), thin = fogColorWith(fog, row, Float32Array.from([0.0003, 40, 1 / 90, 8, 1, 0, 0, 0]), 1.7);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(dist(thick, hc) < dist(thin, hc) && dist(thin, fog) < dist(thick, fog), 'the thicker the haze, the more its colour');
  const sky = hazeSkyUniform(thick, Float32Array.from([0.006, 40, 1 / 90, 8, 1, 0, 0, 0]), 1.7);
  assert.ok(near(sky[3], hazeColumn(Float32Array.from([0.006, 40, 1 / 90, 8, 1, 0, 0, 0]), 1.7), 1e-6) && sky[0] === thick[0]);
  assert.ok(hazeShare(-JUNGLE_HAZE.edge.out) === 0 && hazeShare(JUNGLE_HAZE.edge.in) === 1 && JUNGLE_HAZE.edge.out > JUNGLE_EDGE.out, 'the haze drifts out past the last trees');
});

/** A stream's state over a map of 24 x 16 with Bantha a block - for the host. */
function hostWorld() {
  const W = 24, H = 16, inside = (x, y) => x >= 6 && x < 14 && y >= 4 && y < 11;
  const maps = {};   // the world's key (BANTHA2: the jungle's pixels are `inside`, handed to the host)
  // the stream's own law (world/streamingWorld.js pixelTranslation): the origin pixel and the recentres' compensation
  const state = { mapOrigin: { x: 9, y: 5 }, compensation: [0, 0, 0],
    pixelTranslation(px, py, out = [0, 0, 0]) { const c = state.compensation; out[0] = (px - state.mapOrigin.x) * PIXEL_M + c[0]; out[1] = c[1]; out[2] = -(py - state.mapOrigin.y) * PIXEL_M + c[2]; return out; } };
  const built = new Map(), ground = { y: 10 };   // the ground under every point, in the world's frame
  const sent = [], skies = [];
  const renderer = { _focus: new Float32Array(4), setJungleHaze: (u) => sent.push(u ? Array.from(u) : null) };
  const sky = { setHazeSky: (v) => skies.push(v ? Array.from(v) : null) };
  const host = createJungleHost({ renderer, maps, mapWidth: W, mapHeight: H, stateOf: () => state, builtOf: () => built, heightAt: () => ground.y + state.compensation[1], trees: { door: true }, insideAt: inside });
  return { host, sent, skies, sky, built, state, ground };
}

test('AUDIT BANTHA1 HOST-1/HOST-2/HOST-3/HAZE-7: walked out of Bantha, the haze is gone and hides nothing anywhere; a recentre (x, z or y) moves nothing but the scene\'s numbers; a teleport inside it snaps; under the sea it is off (mutants: the uniforms left standing on the way out; the state in the scene\'s frame)', () => {
  const { host, sent, sky } = hostWorld();
  const fogColor = Float32Array.from([0.62, 0.7, 0.8]), fogRow = { mode: 'linear', density: 0, start: 0, end: 2400 };
  const frame = (eye, dt = 0.05) => host.haze({ fogColor, fogRow, eye, dt, minute: 13 * 60, weather: 'sunny', wind: null, sky });
  // HOST-1: a walk east out of the block at 5 m a frame (never a jump), then a minute on
  let x = 400;
  frame([x, 11.7, 400]);
  assert.equal(sent.at(-1)[4], 1, 'inside: on');
  for (; x < 9 * PIXEL_M; x += 5) frame([x, 11.7, 400]);
  for (let i = 0; i < 1200; i++) frame([x, 11.7, 400]);
  assert.equal(sent.at(-1), null, 'out: the renderer told none');
  assert.equal(host.uniforms[4], 0, 'and the host\'s own uniforms zeroed');
  assert.equal(host.hides([2600, 0, -10, 2700, 15, 10], [x, 0, 400]), false, 'nothing hidden 2.6 km off - nor anywhere');
  // HOST-2: deep inside, eased to rest; a VERTICAL recentre (-600 m - the eye past 500 up) moves the scene and the eye
  // together: the floor the shader is sent moves with them at once, never eased from the old frame's numbers
  const { host: h2, state: s2, sky: k2, ground: g2 } = hostWorld();
  const eye2 = [400, 11.7, 400];
  const f2 = (dt = 0.05) => h2.haze({ fogColor, fogRow, eye: eye2, dt, minute: 13 * 60, weather: 'sunny', wind: null, sky: k2 });
  for (let i = 0; i < 400; i++) f2();
  const before = Array.from(h2.uniforms);
  s2.compensation[1] -= 600; eye2[1] -= 600;
  f2();
  const after = Array.from(h2.uniforms);
  assert.ok(near(after[1], before[1] - 600, 1e-3), `the floor moved with the scene (${before[1]} -> ${after[1]})`);
  assert.ok(near(after[0], before[0], before[0] * 0.01), 'and the density only its banks\' drift of one frame');
  // ...and a horizontal recentre mid-ease is no jump: the ground rises 50 m, a frame eases toward it, the stream recentres
  // a pixel east - and the floor goes on easing, never snapped
  g2.y = 60; f2();
  s2.compensation[0] -= PIXEL_M; eye2[0] -= PIXEL_M;
  f2();
  assert.ok(h2._state.floor < 60 + JUNGLE_HAZE.layer - 40, `still easing (${h2._state.floor.toFixed(1)})`);
  // HOST-3: a Recall across the block (two pixels south, the scene eye moved 1.6 km) snaps the floor to its new ground
  const { host: h3, state: s3, sky: k3 } = hostWorld();
  for (let i = 0; i < 200; i++) h3.haze({ fogColor, fogRow, eye: [400, 11.7, 400], dt: 0.05, minute: 13 * 60, weather: 'sunny', wind: null, sky: k3 });
  s3.compensation[1] = 250;   // the new place's ground stands 250 m higher in the scene
  h3.haze({ fogColor, fogRow, eye: [400, 261.7, 400 - 2 * PIXEL_M], dt: 0.05, minute: 13 * 60, weather: 'sunny', wind: null, sky: k3 });
  assert.ok(near(h3.uniforms[1], 260 + JUNGLE_HAZE.layer, 1e-3), `snapped to the new floor (${h3.uniforms[1]})`);
  // HAZE-7: under the sea, off
  frame([400, 11.7, 400]); frame([400, 11.7, 400]);
  host.under(sky);
  assert.equal(sent.at(-1), null); assert.equal(host.uniforms[4], 0);
});

test('BANTHA1 the jungle\'s host: the terrain job a pixel\'s 3x3 of distances where the jungle can reach and none past it; the frame\'s haze set inside Bantha - the renderer\'s uniforms, the sky\'s, the frame\'s fog colour weighed with it - and taken off outside it; the cull asks the haze sent (mutants: the haze measured from the wrong pixel; the colour left the weather\'s)', () => {
  const { host, sent, skies, sky } = hostWorld();
  assert.deepEqual(host.job(9, 7, true).nine.length, 9);
  assert.equal(host.job(9, 7, true).hidden, true);
  assert.equal(host.job(23, 0), null, 'nowhere near');
  // a scene point's pixel: x east, z north (the map's rows count south) - the eye's pixel (9, 5) is inside, two north (9, 3)
  // outside, two south (9, 7) inside, five east (14, 5) outside
  assert.ok(host.depthAt(400, 400) > 0 && host.depthAt(400, 400 - 2 * PIXEL_M) > 0);
  assert.ok(host.depthAt(400, 400 + 2 * PIXEL_M) < 0 && host.depthAt(400 + 5 * PIXEL_M, 400) < 0);
  // ...and the depth is the field's read IN that pixel, at the point's place in it - the block's middle row (9, 7) the
  // deepest and (9, 8) under it shallower again, which no read off another pixel's 3x3 reaches
  const ref = jungleField({ width: 24, height: 16, insideAt: (x, y) => x >= 6 && x < 14 && y >= 4 && y < 11 });
  for (const [x, z] of [[400, 400 - 3 * PIXEL_M], [400 + 2 * PIXEL_M, 400 - 4 * PIXEL_M], [-300, 100], [700, 400 - 2 * PIXEL_M]]) {
    const px = 9 + Math.floor(x / PIXEL_M), py = 5 - Math.floor(z / PIXEL_M);
    const lx = x - (px - 9) * PIXEL_M, lz = z + (py - 5) * PIXEL_M;
    assert.ok(lx >= 0 && lx < PIXEL_M && lz >= 0 && lz < PIXEL_M);
    assert.ok(near(host.depthAt(x, z), jungleDepthAt(px, py, jungleNine(ref, px, py), lx, lz), 1e-6), `(${x}, ${z}) read in pixel (${px}, ${py})`);
  }
  const fogColor = Float32Array.from([0.62, 0.7, 0.8]), fogRow = { mode: 'linear', density: 0, start: 0, end: 4000 };
  const frame = (eye) => host.haze({ fogColor, fogRow, eye, dt: 0.016, minute: 13 * 60, weather: 'sunny', wind: null, sky });
  const inside = frame([400, 11.7, 400]);   // the middle of pixel (9, 5) - deep in the block
  assert.equal(sent.at(-1)[4], 1, 'on');
  assert.ok(near(sent.at(-1)[1], 10 + JUNGLE_HAZE.layer, 1e-4), 'its floor the canopy over the ground');
  assert.ok(sent.at(-1)[0] > JUNGLE_HAZE.density * 0.5, 'its density the jungle\'s');
  assert.notDeepEqual(Array.from(inside), Array.from(fogColor), 'the frame\'s colour the haze\'s');
  assert.ok(skies.at(-1)[3] > 0 && near(skies.at(-1)[0], inside[0]), 'the sky\'s the same colour');
  assert.ok(host.hides([4000, 0, -10, 4100, 15, 10], [0, 0, 0]), 'the low ground 4 km off is hidden');
  assert.ok(!host.hides([0, 0, 0, 50, 15, 50], [400, 0, 400]), 'the ground under the eye is not');
  for (let i = 0; i < 3; i++) frame([-6 * PIXEL_M, 11.7, 400]);   // pixel (3, 5): far west of the block - a jump, then out
  assert.equal(sent.at(-1), null, 'outside: off');
  assert.equal(skies.at(-1), null);
  assert.ok(!host.hides([4000, 0, -10, 4100, 15, 10], [0, 0, 0]), 'no haze, nothing hidden');
  const clear = createJungleHost({ renderer: { _focus: new Float32Array(4), setJungleHaze: (u) => sent.push(u) }, maps: {}, insideAt: () => true, mapWidth: 4, mapHeight: 4, stateOf: () => ({ mapOrigin: { x: 0, y: 0 }, compensation: [0, 0, 0], pixelTranslation: (px, py, o = [0, 0, 0]) => o }), builtOf: () => new Map(), heightAt: () => 0, haze: false, trees: { door: true } });
  assert.equal(clear.haze({ fogColor, fogRow, eye: [1, 1, 1], dt: 0.016, minute: 0, weather: 'rain', sky }), fogColor, '?junglehaze=off: the jungle under clear air');
  assert.equal(sent.at(-1), null);
});

/** A recording fake GL (lpt1_lowpolytrees's shape). */
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
const run = (n) => ({ run: null, scale: [1, 1, 1], size: [3, 9], sway: 0, drawStart: 0, drawCount: n, subs: [{ offset: 0, count: 6, tex: { id: 'leaf' }, alpha: 1, color: [1, 1, 1], cull: 0 }] });

test('BANTHA1 the renderer\'s two tree slots: Low Poly Trees\' frame and the jungle\'s each drawn, each with its own buffers; a far picture gives way to its OWN slot\'s trees at that slot\'s radius, and one no slot draws stands whole; both spent in the call (mutants: one slot drawn; the first slot\'s radius for every picture; the slots never spent)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.textures.set('504_12#lpt', { id: 'lptFar' }); r.textures.set('500_jungle-fig#lpt', { id: 'jungleFar' }); r.textures.set('500_13', { id: 'flat' });
  const a = { key: 'lpt' }, b = { key: 'jungle' };
  const lptFar = r.createBillboardBatch(504, '12#lpt', { w: 4, h: 8 }, [[0, 0, -3]], { scales: [0.7] }); lptFar.lptProto = a;
  const jFar = r.createBillboardBatch(500, 'jungle-fig#lpt', { w: 20, h: 30 }, [[2, 0, -6]], { scales: [0.6] }); jFar.lptProto = b;
  const plain = r.createBillboardBatch(500, 13, { w: 1, h: 2 }, [[1, 0, -4]]);
  const gpu = (id) => ({ vao: { id }, pointInstances: (at) => calls.push(['pointInstances', id, at]) });
  const fa = { eye: [1, 2, 3], radius: 140, band: 20, gpu: gpu('lptVao'), cut: new Set([a]), runs: [run(2)] };
  const fb = { eye: [1, 2, 3], radius: 155, band: 25, gpu: gpu('jungleVao'), cut: new Set([b]), runs: [run(3)], sunLift: JUNGLE_SUN_LIFT };
  jFar.sunLift = JUNGLE_SUN_LIFT;   // AUDIT BANTHA1 TREE-2: the jungle's far picture and its trees read their sun at the crown
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.setLowPolyTrees(fa); r.setLowPolyTrees(fb, 1);
  calls.length = 0;
  r.drawBillboards([plain, lptFar, jFar], R3, UP);
  const vaos = calls.filter((c) => c[0] === 'bindVertexArray' && typeof c[1]?.id === 'string' && c[1].id.endsWith('Vao')).map((c) => c[1].id);
  assert.deepEqual(vaos, ['lptVao', 'jungleVao'], 'each slot\'s own buffers, Low Poly Trees\' first');
  assert.deepEqual(calls.filter((c) => c[0] === 'drawElementsInstanced').map((c) => c[5]), [2, 3]);
  const cuts = calls.filter((c) => c[0] === 'uniform4f' && c[1] === 'uLptCut').map((c) => c[5]);
  assert.ok(cuts.includes(140) && cuts.includes(155), 'each picture its own slot\'s radius');
  // ...read at each picture's own draw: the texture it binds and the cut standing when it draws
  const atDraw = {}, liftAt = {}, treeLift = [];
  let tex = null, cut = 0, lift = NaN;
  for (const c of calls) {
    if (c[0] === 'bindTexture' && ['lptFar', 'jungleFar', 'flat'].includes(c[2]?.id)) tex = c[2].id;
    else if (c[0] === 'uniform4f' && c[1] === 'uLptCut') cut = c[5];
    else if (c[0] === 'uniform1f' && c[1] === 'uSunLift') lift = c[2];
    else if (c[0] === 'drawElements') { atDraw[tex] = cut; liftAt[tex] = lift; }
    else if (c[0] === 'drawElementsInstanced') treeLift.push(lift);
  }
  assert.deepEqual(atDraw, { flat: 0, lptFar: 140, jungleFar: 155 }, 'the plain flat whole, Low Poly Trees\' picture at its slot\'s 140, the jungle\'s at its own 155');
  assert.deepEqual(liftAt, { flat: 0, lptFar: 0, jungleFar: JUNGLE_SUN_LIFT }, 'AUDIT BANTHA1 TREE-2: the sun read at the root, but the jungle\'s far picture at its crown');
  assert.deepEqual(treeLift, [0, JUNGLE_SUN_LIFT], '...and its 3D trees with it, Low Poly Trees\' at their roots');
  const bands = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uLptBand').map((c) => c[2]);
  assert.ok(bands.includes(20) && bands.includes(25), '...and band');
  calls.length = 0;
  r.drawBillboards([jFar], R3, UP);
  assert.equal(calls.filter((c) => c[0] === 'drawElementsInstanced').length, 0, 'spent');
  assert.ok(!calls.some((c) => c[0] === 'uniform4f' && c[1] === 'uLptCut' && c[5] > 0), 'a picture no slot draws stands whole');
});

test('BANTHA1 the haze reaches every program: the frame\'s, armed by setJungleHaze - uploaded with the fog, to the mesh program at once - and cleared by the next beginFrame no setJungleHaze armed; a sprite drawn off the world borrows it off and gives it back (mutants: the arming ignored; the upload left out of the fog\'s; never sent off; sent every frame)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  const u = Float32Array.from([0.005, 30, 1 / 90, 8, 1, 0, 0, 0]);
  r.setJungleHaze(u);
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uJungleHaze' && c[2][4] === 1), 'the mesh program at once');
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uJungleHaze' && c[2][4] === 1), 'armed: kept by the frame it was set for, sent with its fog');
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  assert.equal(r._haze[4], 0, 'the next frame no host armed: gone (an interior, a dungeon, a panel)');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uJungleHaze' && c[2][4] === 0), 'and sent off, once, to a program that held it on');
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  assert.ok(!calls.some((c) => c[1] === 'uJungleHaze'), 'then never again while it stays off - a frame outside the jungle pays no call');
  r.setJungleHaze(u);
  const stamp = r._frameStamp;
  r.setJungleHaze(null); r.setJungleHaze(null);
  assert.equal(r._frameStamp, stamp + 1, 'off once, then nothing moves');
  const src = text('src/render/renderer.js');
  for (const borrow of src.split('this._fogMode = 0; this._dwFog[0] = 0;').slice(1)) assert.match(borrow.slice(0, 20), /^ this\._haze\[4\] = 0;/, 'every sprite\'s borrow takes the haze off with the fogs');
});

test('AUDIT BANTHA1 HAZE-2: what a program holds is the GL PROGRAM\'s - a world set re-installed between the haze on and the haze off (FAR-CLIP1\'s variant, a panel, RW1\'s view out make new location tables) still sends the off to the program that holds it on (mutant: the sent state on the location table)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setJungleHaze(Float32Array.from([0.005, 30, 1 / 90, 8, 1, 0, 0, 0]));
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r._installWorldSet(r._worldSet);   // the tables made anew; the programs keep what they were sent
  calls.length = 0;
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  assert.equal(r._haze[4], 0, 'no host armed it: off');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uJungleHaze' && c[2][4] === 0), 'the off reaches the program that held the haze on');
});

test('BANTHA1 the jungle\'s door: Low Poly Trees\' own over the owner\'s files - read once, each species a prototype, its far picture uploaded under the rainforest\'s archive and sized for the tallest emergent, its frame on the renderer\'s slot 1 (mutants: the slot 0; the scale ceiling Low Poly Trees\')', async () => {
  const uploads = [], frames = [], { gl, calls } = recordingGl();
  const renderer = {
    gl, uploadTexture: (a, rec, c) => uploads.push([a, rec, c.width, c.height]), releaseTexture: () => {}, setLowPolyTrees: (f, slot) => frames.push([f, slot]),
    createAtlasTexture: (w, h, levels) => ({ w, h, levels }), uploadAtlasRows: () => {}, releaseAtlasTexture: () => {},
  };
  const byUrl = new Map(Object.entries(JUNGLE_URLS).map(([name, url]) => [url, name]));
  let fetched = 0;
  const door = createJungleTrees({
    renderer, breathe: async () => {}, warn: (m) => assert.fail(m), now: () => 0,
    fetchBytes: async (url) => { fetched++; return new Uint8Array(readFileSync(join(ROOT, SRC, byUrl.get(url)))); },
    decode: async (bytes) => { const p = PNG.sync.read(Buffer.from(bytes)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await Promise.all([door.load(), door.load()]);
  assert.equal(fetched, 21, 'every file once');   // JUNGLE-ROADSIDE (PIN MOVED): the five trees' fifteen and the three roadside pairs' OBJs and MTLs
  assert.equal(door.loaded, true);
  // AUDIT BANTHA1 TREE-6: a load that failed is asked again on BUILD-RETRY's clock, never latched for the session
  let t = 0, drop = true, asked = 0;
  const warned = [];
  const flaky = createJungleTrees({
    renderer, breathe: async () => {}, warn: (m) => warned.push(m), now: () => t,
    fetchBytes: async (url) => { asked++; if (drop) throw new Error('dropped'); return new Uint8Array(readFileSync(join(ROOT, SRC, byUrl.get(url)))); },
    decode: async (bytes) => { const p = PNG.sync.read(Buffer.from(bytes)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  assert.equal(await flaky.load(), null, 'a dropped fetch: nothing loaded');
  await Promise.resolve();
  const first = asked;
  assert.equal(await flaky.load(), null); assert.equal(asked, first, 'inside its wait it is not asked again');
  drop = false; t = BUILD_RETRY_MS[0] + 1;
  assert.notEqual(await flaky.load(), null, 'past it, asked again - and loaded');
  assert.equal(flaky.loaded, true); assert.equal(warned.length, 1);
  const p = door.proto(2);
  assert.equal(p.key, '500_jungle-fig');
  const h = await door.farPicture(p);
  assert.deepEqual([h.archive, h.record], [500, 'jungle-fig#lpt']);
  const pic = renderImpostor(door._lpt, p, (n) => picture(door._lpt.atlases[n].picture));
  assert.ok(near(h.size.h, p.size.h * pic.shareH * JUNGLE_SCALE_MAX, 1e-9) && JUNGLE_SCALE_MAX === JUNGLE.emergentScale[1], 'sized for the tallest emergent');
  assert.deepEqual(uploads.at(-1).slice(0, 2), [500, 'jungle-fig#lpt']);
  const set = { ox: 0, oy: 0, oz: 0, handles: [h], ...buildTreeSet(PX, PY, [{ h: 0, centers: [[0, 0, 5]], wild: null, own: Float32Array.of(1.3) }]) };
  assert.equal(set.trees[4], Math.fround(1.3), 'the layout\'s own scale, not DFU\'s variety');
  door.frame([set], 0, 0, 0, { stamp: 1 });
  const [f, slot] = frames.at(-1);
  assert.equal(slot, 1);
  assert.ok(f.cut.has(h) && f.runs[0].drawCount === 1);
  // AUDIT BANTHA1 TREE-9: the tree walked away from - its instances let go once, then a frame with none near uploads nothing
  door.frame([], 0, 0, 0, { stamp: 2 });
  calls.length = 0;
  door.frame([], 0, 0, 0, { stamp: 3 }); door.frame([], 0, 0, 0, { stamp: 4 });
  assert.deepEqual(calls.filter((c) => /^(bindBuffer|bufferData|bufferSubData)$/.test(c[0])), [], 'none to show, none shown - no upload');
});

test('BANTHA1 the hosts: world.js builds the jungle\'s host behind its switch and the trees\' host with it, hands the pixel build the jungle, sets the haze before the fog and takes its colour, culls a pixel the haze hides whole, and hands the far ring the haze; the pixel build asks the kernel for the jungle and stands its trees as far pictures held by the pixel, Logging\'s and cover\'s; the kernel lays the jungle over the pixel\'s own layout (THE FOUR HOSTS: exterior.js, worldModes.js and dungeonContext.js stand no wilderness - FLAGGED in scenes/jungleHost.js)', () => {
  const w = hostText('src/scenes/world.js'), pb = text('src/scenes/pixelBuild.js'), tg = text('src/world/terrain/terrainGen.js'), jh = text('src/scenes/jungleHost.js');
  assert.match(w, /const jungle = jungleOn\(\) \? createJungleHost\(\{[^\n]*haze: jungleHazeOn\(\) \}\) : null;/);
  assert.match(w, /const trees = createTreesHost\(\{[^\n]*jungle, breathe: \(\) => breather\.breathe\(\), yards: \(\) => yards \}\);/);
  assert.match(w, /jungle, lowPolyTrees, maps, modelFeetOf/, 'the pixel build has the jungle');
  const fogAt = w.indexOf('const fogColor = jungle ? jungle.haze({ fogColor: sky.fogColorFor(fogNow), fogRow: fogNow, eye: mwv.eye, dt, minute, weather, wind: wd.on ? wd.windV : null, sky }) : sky.fogColorFor(fogNow);');   // AUDIT BANTHA1 HOST-7: the view's eye, as the fog's uCamPos
  assert.ok(fogAt > 0 && w.indexOf('renderer.setFog(fogNow.mode,', fogAt) - fogAt < 600, 'the haze, then the fog with its colour');
  assert.match(w, /const pixelVisible = !cullOn \|\| !\(aabbOutside\(_planes, p\._box, t\[0\], t\[1\], t\[2\]\) \|\| jungle\?\.hides\(p\._box, t\)\);/);
  assert.match(w, /haze: renderer\._haze, hazeEye: jungle\?\.eye/, 'the far ring');
  assert.match(pb, /jungle: jungle \? jungle\.job\(px, py, FOREST_HIDDEN_LOCATION_TYPES\.has\(dfLocation\?\.mapTableData\?\.locationType\)\) : null,/);
  assert.match(pb, /jungle\.door\.acquire\(far\); jungleHandles\.push\(far\);/);
  assert.match(pb, /made\.jungleHandles = jungleHandles;/, 'BUILD-FAIL1\'s ledger');
  assert.match(pb, /const young = f\.js <= JUNGLE\.underScale\[1\], gk = young \? `J\$\{f\.jungle\}y` : `J\$\{f\.jungle\}`;/, 'AUDIT BANTHA1 PERF-5: the young trees a group of their own');
  assert.match(pb, /batch\.farH = g\.young \? 0 : proto\.size\.h;/, '...which the far rings stand as the floor');
  assert.match(pb, /if \(pic\.h == null\) \{ jungle\.door\.acquire\(far\); jungleHandles\.push\(far\); pic\.h = jungleHandles\.length - 1; \}/, 'a species\' handle held once for its storeys');
  assert.match(pb, /forestGroups\.set\(gk, \{ batch, centers: g\.centers, size: far\.size, scales \}\);/, 'Logging fells it');
  assert.match(pb, /coverItems\.push\(\.\.\.jungleCover\(c, species, own\[i\]\)\)/, 'cover');
  assert.match(pb, /f\.jungle != null \? JUNGLE_MEASURES\[f\.jungle\]\.foot \* f\.js : natureReach/, 'the road keeps clear of its foot - loaded or not (AUDIT BANTHA1 LAY-5)');
  assert.match(pb, /jungleTrees: jungleSet\.length \? \{ px, py, ox: 0, oy: 0, oz: 0, handles: jungleHandles, groups: jungleSet, trees: null, centers: null \} : null,/);
  assert.match(tg, /const \{ flats: nature, pairs: roadside \} = jungleLayout\(jungle && jungleWhole\(jungle\.nine\) \? \[\] : layoutNature\(samples, tilemap, natureOpts\), samples, tilemap,\n\s+\{ \.\.\.natureOpts, jungle: jungle \? \{ nine: jungle\.nine, pois: placesFor\(jungle\.hidden\), paths, net: roads \} : null \}\);/);   // JUNGLE-ROADSIDE (PIN MOVED): and the network, its pairs astride the roads - handed back beside the flats (AUDIT JUNGLE-ROADSIDE PERF-2)
  assert.match(jh, /scenes\/dungeonContext\.js \(dungeons\) - FLAGGED: none stands the wilderness the jungle grows in/);
});

test('BANTHA1 the switch: the Jungle of Bantha row on the enhanced skin, on by default; `?jungle=off` the kill door offline; online the room\'s - its trees are where Logging\'s stand; `?junglehaze=off` the haze\'s door', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.banthaJungle;
  assert.equal(pref, true, 'on by default');
  try {
    setUiSkin('enhanced'); setPref('banthaJungle', true);
    assert.equal(jungleOn(''), true);
    assert.equal(jungleOn('?jungle=off'), false, 'the kill door');
    setPref('banthaJungle', false);
    assert.equal(jungleOn(''), false, 'the row is the switch');
    assert.equal(jungleOn('?online=1'), true, 'online: the room\'s jungle');
    setPref('banthaJungle', true); setUiSkin('classic');
    assert.equal(jungleOn(''), false, 'offline, the classic skin keeps DFU\'s rainforest');
    assert.equal(jungleOn('?online=1&jungle=off'), true);
  } finally { setUiSkin(skin); setPref('banthaJungle', pref); }
  assert.equal(onlineForcedPref('banthaJungle', '?online=1'), true);
  assert.equal(jungleHazeOn(''), true);
  assert.equal(jungleHazeOn('?junglehaze=off'), false);
  const row = FEATURES.find((f) => f.id === 'bantha-jungle');
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'banthaJungle', initial: true, online: true });
  assert.equal(STREAMING_TERRAIN_SCALE, 1.25, '(the beach line in metres the species read is the kernel\'s own scale)');
});

test('AUDIT BANTHA1 DOC-5: the four storeys\' laws, on a pixel with glades - no canopy tree in a glade\'s full light, the flame tree\'s light and the species\' height over the beach handed to every canopy tree (each recomputed), young trees thicker in a light gap than under a crown, the palms of the mid storey, the floor thicker in a glade\'s light (mutants: no mid storey; the glades off; the gap law swapped; the light not handed to the species; the height not over the beach; the floor\'s glade light ignored)', () => {
  const GX = 403, GY = 91, S = PIXEL_M / 128, C = JUNGLE.cell;
  const g = pixelGround();
  const opts = { mapPixelX: GX, mapPixelY: GY, rawWorldHeight: 80, climateType: 400, locationRect: null, forests: { archive: 500, pois: [], paths: g.paths } };
  const out = withJungle(layoutNature(g.hm, g.tm, opts), g.hm, g.tm, { ...opts, jungle: { nine: WHOLE, pois: [], paths: g.paths } });
  const glade = gladeField(GX, GY), origin = ecoOrigin(GX, GY), BEACH_M = SCALED_BEACH_ELEVATION * STREAMING_TERRAIN_SCALE;
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lightAt = (x, y) => 1 - ss(JUNGLE.glade.edge[0], JUNGLE.glade.edge[1], glade(x, y));
  const canopy = out.filter((f) => f.jungle != null && f.js >= JUNGLE.canopyScale[0]);
  // the glades: a fifth of this pixel in full light, and no canopy tree in it
  let full = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (lightAt(x, y) >= 1) full++;
  assert.ok(full > 16384 * 0.15, `glades (${full} tiles in full light)`);
  assert.deepEqual(canopy.filter((f) => lightAt(Math.floor(f.x / S), Math.floor(f.z / S)) >= 1), [], 'a glade stands no canopy tree');
  // the species: every canopy tree but an emergent is canopySpecies of its own light and its height over the beach
  let n = 0, lit = 0;
  for (const f of canopy) {
    const tx = f.x / S, tz = f.z / S, wx = GX * 128 + Math.floor(tx / C) * C, wz = -GY * 128 + Math.floor(tz / C) * C;
    if (tileDraw(wx, wz, 23) < JUNGLE.emergent) continue;
    const light = lightAt(Math.floor(tx), Math.floor(tz)), above = groundAt(g.hm, f.x, f.z) - BEACH_M, draw = tileDraw(wx, wz, 24);
    assert.equal(f.jungle, canopySpecies(origin, tx, tz, above, light, draw), `the canopy tree at ${f.x.toFixed(1)}, ${f.z.toFixed(1)}`);
    n++; if (canopySpecies(origin, tx, tz, above, 0, draw) !== f.jungle) lit++;
  }
  assert.ok(n > 500 && lit > 20, `the light chose ${lit} of ${n}`);   // PIN MOVED (SPREAD): a site's canopy, half the cells'
  // the understorey (PIN MOVED, SPREAD: a cell's spot, a light gap where no canopy crown reaches it - its young trees at
  // JUNGLE.gapUnder, under a crown JUNGLE.under), read a cell inside the pixel's edge, where every crown is this pixel's
  const crowned = new Set(canopy.map((f) => `${Math.floor(f.x / S / C)},${Math.floor(f.z / S / C)}`));
  const [u0, u1] = JUNGLE.underInset;
  const youngAt = new Set(out.filter((f) => f.jungle != null && f.js <= JUNGLE.underScale[1]).map((f) => `${f.x},${f.z}`));
  let gapCells = 0, crownCells = 0, gapYoung = 0, crownYoung = 0;
  for (let cy = 3; cy < 128 / C - 3; cy++) {
    for (let cx = 3; cx < 128 / C - 3; cx++) {
      const wx = GX * 128 + cx * C, wz = -GY * 128 + cy * C;
      const mx = (cx * C + C * (u0 + (u1 - u0) * tileDraw(wx, wz, 40))) * S, mz = (cy * C + C * (u0 + (u1 - u0) * tileDraw(wx, wz, 41))) * S;
      const gap = !canopy.some((f) => Math.hypot(mx - f.x, mz - f.z) < JUNGLE.crown * f.js);
      const stood = youngAt.has(`${mx},${mz}`);
      if (gap) { gapCells++; if (stood) gapYoung++; } else { crownCells++; if (stood) crownYoung++; }
    }
  }
  assert.ok(gapCells > 100 && crownCells > 1000, `both kinds of cell (${gapCells} in the light, ${crownCells} under crowns)`);
  assert.ok(gapYoung / gapCells > 2 * (crownYoung / crownCells), `thicker in the gaps (${gapYoung} of ${gapCells} cells, ${crownYoung} of ${crownCells})`);
  // the mid storey and the floor
  const palms = out.filter((f) => f.jungle == null && JUNGLE_PALMS.includes(f.record)), floor = out.filter((f) => f.jungle == null && JUNGLE_COVER.includes(f.record));
  const cells = (128 / C) ** 2;
  assert.ok(palms.length > cells * JUNGLE.palm * 0.4 && palms.length < cells * JUNGLE.palm, `the rainforest's palms (${palms.length})`);   // PIN MOVED (SPREAD): a cell's chance, where it was a tile's
  const planted = new Set(floor.map((f) => `${Math.floor(f.x / S)},${Math.floor(f.z / S)}`));
  let gT = 0, gF = 0, cT = 0, cF = 0;
  for (let y = 6; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      if (x === 64 || (x >= 99 && x <= 104) || g.tm[y * 128 + x] !== 2) continue;
      const L = lightAt(x, y), k = `${x},${y}`;
      if (L >= 1) { gT++; if (planted.has(k)) gF++; } else if (L <= 0 && crowned.has(`${Math.floor(x / C)},${Math.floor(y / C)}`)) { cT++; if (planted.has(k)) cF++; }
    }
  }
  assert.ok(gF / gT > 0.55 && cF / cT < 0.5, `the floor thicker in a glade's light (${(gF / gT).toFixed(3)} of ${gT}) than under a crown (${(cF / cT).toFixed(3)} of ${cT})`);
});

test('AUDIT BANTHA1 DOC-5: the border tile by tile - a tile is the jungle\'s exactly where its share is whole or beats its stand noise, and the pixel\'s own flats stand on every other tile and on none of the jungle\'s; the reach and the whole pixel each read the wander\'s full reach; the glade field the world\'s, read off the forests\' own field at its lattice and continuous across every edge (mutants: the own flats\' tile read x for z; the reach without the wander; the whole pixel without it; the glade field\'s rows mirrored)', () => {
  const g = pixelGround(), S = PIXEL_M / 128, origin = ecoOrigin(PX, PY);
  const opts = { mapPixelX: PX, mapPixelY: PY, rawWorldHeight: 80, climateType: 400, locationRect: null, forests: { archive: 500, pois: [], paths: g.paths } };
  const own = layoutNature(g.hm, g.tm, opts);
  const tileOf = (f) => Math.min(127, Math.floor(f.z / S + 1e-6)) * 128 + Math.min(127, Math.floor(f.x / S + 1e-6));
  for (const [what, nine] of [['the line through the middle', [-1, 0, 1, -1, 0, 1, -1, 0, 1]], ['just outside it (-0.08 px - the wander reaches in)', Array(9).fill(-0.08)], ['inside, not whole (0.7 px)', Array(9).fill(0.7)]]) {
    const whole = jungleWhole(nine), mine = new Uint8Array(16384);
    let owned = 0;
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const j = whole ? 1 : jungleShare(jungleDepthAt(PX, PY, nine, (x + 0.5) * S, (y + 0.5) * S));
        if (j > 0 && (j >= 1 || jungleStandNoise(origin, x + 0.5, y + 0.5) < j)) { mine[y * 128 + x] = 1; owned++; }
      }
    }
    assert.ok(owned > 0 && owned < 16384, `${what}: some tiles the jungle's, some not (${owned})`);
    const out = withJungle(own, g.hm, g.tm, { ...opts, jungle: { nine, pois: [], paths: g.paths } });
    assert.deepEqual(out.filter((f) => own.includes(f)), own.filter((f) => !mine[tileOf(f)]), `${what}: the pixel's own flats on every tile but the jungle's`);
    assert.ok(out.some((f) => f.jungle != null), `${what}: the jungle's trees stand`);
  }
  assert.equal(jungleWhole(Array(9).fill(0.7)), false, '0.7 px in is not whole once the wander is read');
  // the glade field: the forests' own field at its lattice, the same read from either side of an edge
  const a = gladeField(PX, PY), south = gladeField(PX, PY + 1), east = gladeField(PX + 1, PY);
  assert.equal(a(0, 0), forestCover(PX * 128 + JUNGLE.glade.off[0], -PY * 128 + JUNGLE.glade.off[1]));
  assert.equal(a(8, 12), forestCover(PX * 128 + 8 + JUNGLE.glade.off[0], -PY * 128 + 12 + JUNGLE.glade.off[1]));
  for (let t = 0; t <= 128; t += 2) {
    assert.ok(near(a(t, 0), south(t, 128), 1e-12), `the row edge at ${t}`);
    assert.ok(near(a(128, t), east(0, t), 1e-12), `the column edge at ${t}`);
  }
});

test('AUDIT BANTHA1 DOC-5/DOC-6: the haze\'s numbers the record gives - the share none 320 m outside the line and whole 760 m in, past the trees\' own band; thunder the thickest weather but the fog\'s, rain under it; the haze\'s own colour leaned to its grey and tinted; the cull\'s clear start (mutants: the haze\'s band the trees\'; thunder thinned; the grey lean dropped; the clear start ignored)', () => {
  assert.equal(hazeShare(-JUNGLE_HAZE.edge.out), 0); assert.ok(hazeShare(-JUNGLE_HAZE.edge.out + 1) > 0);
  assert.equal(hazeShare(JUNGLE_HAZE.edge.in), 1); assert.ok(hazeShare(JUNGLE_HAZE.edge.in - 1) < 1);
  assert.deepEqual({ ...JUNGLE_HAZE.edge }, { out: 320, in: 760 });
  assert.ok(hazeShare(-JUNGLE_EDGE.out) > 0.1 && hazeShare(JUNGLE_EDGE.in) < 0.9, 'the air drifts out past the last trees, and thickens further in');
  const wf = (w) => hazeWeatherFactor(w);
  assert.ok(wf('thunder') > wf('fog') && wf('fog') > wf('rain') && wf('rain') > wf('overcast') && wf('overcast') > wf('cloudy') && wf('cloudy') > wf('sunny'));
  const fog = [0.2, 0.45, 0.9], lum = 0.299 * fog[0] + 0.587 * fog[1] + 0.114 * fog[2], t = JUNGLE_HAZE.tint, tl = 0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2];
  const h = hazeColorOf(fog);
  for (let c = 0; c < 3; c++) assert.ok(near(h[c], Math.min(1, (fog[c] + (lum - fog[c]) * JUNGLE_HAZE.grey) * (t[c] / tl)), 1e-6), `channel ${c}`);
  assert.ok(Math.max(...h) - Math.min(...h) < Math.max(...fog) - Math.min(...fog), 'greyer than the weather\'s');
  // the clear start: a box whose run past it is just short of the cull stands, though its whole distance would pass it
  const u = Float32Array.from([0.005, 100, 1 / 90, 8, 1, 0, 0, 0]), eye = [0, 10, 0];
  const edge = Math.log(1 / JUNGLE_HAZE.cull) / u[0];
  assert.equal(hazeHides(u, eye, [edge + 4, 0, -5, edge + 50, 10, 5]), false, 'the run is the distance less the clear start');
  assert.equal(hazeHides(u, eye, [edge + 12, 0, -5, edge + 50, 10, 5]), true);
});

test('AUDIT BANTHA1 DOC-6: the host reads the haze off the world - its floor the land about the eye where that is lower, its drifting banks at the eye\'s WORLD place, its eye the travel view\'s focus where the renderer holds one (mutants: the 3x3 ignored; the banks read at the pixel\'s own place; the focus ignored)', () => {
  const fogColor = Float32Array.from([0.62, 0.7, 0.8]), fogRow = { mode: 'linear', density: 0, start: 0, end: 4000 };
  const first = (h, eye, sky) => h.haze({ fogColor, fogRow, eye, dt: 0.05, minute: 13 * 60, weather: 'sunny', wind: null, sky });
  // the floor: the eye's pixel (9, 5) and its eight about it built 50 m under the ground at the eye
  const a = hostWorld();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a.built.set(`${9 + dx},${5 + dy}`, { px: 9 + dx, py: 5 + dy, centerHeight: -40 });
  first(a.host, [400, 11.7, 400], a.sky);
  assert.ok(near(a.host.uniforms[1], -40 + JUNGLE_HAZE.layer, 1e-3), `the land about it, lower (${a.host.uniforms[1]})`);
  const b = hostWorld(); b.built.set('9,5', { px: 9, py: 5, centerHeight: 300 });
  first(b.host, [400, 11.7, 400], b.sky);
  assert.ok(near(b.host.uniforms[1], 10 + JUNGLE_HAZE.layer, 1e-3), 'the ground under the eye where the land about is higher');
  // the banks: the first frame snaps to the density at the eye's world place - pixel (9, 5), 400 m in each way
  for (const [x, z] of [[400, 400], [400 + PIXEL_M, 400 - PIXEL_M]]) {
    const c = hostWorld();
    first(c.host, [x, 11.7, z], c.sky);
    const px = 9 + Math.floor(x / PIXEL_M), py = 5 - Math.floor(z / PIXEL_M);
    const wx = px * PIXEL_M + (x - (px - 9) * PIXEL_M), wz = -py * PIXEL_M + (z + (py - 5) * PIXEL_M);
    const want = JUNGLE_HAZE.density * hazeDayFactor(13) * hazeWeatherFactor('sunny') * hazeDrift(wx, wz, 0.05, null);
    assert.ok(near(c.host.uniforms[0], want, want * 1e-6), `the banks at the world's ${wx.toFixed(0)}, ${wz.toFixed(0)}`);
  }
  // the travel view: the renderer's focus is the eye
  const d = hostWorld();
  const focus = Float32Array.from([1200, 40, -300, 1]);
  const host = createJungleHost({ renderer: { _focus: focus, setJungleHaze: () => {} }, maps: {}, insideAt: () => true, mapWidth: 24, mapHeight: 16, stateOf: () => d.state, builtOf: () => d.built, heightAt: () => 10, trees: { door: true } });
  host.haze({ fogColor, fogRow, eye: [5, 1, 5], dt: 0.05, minute: 600, weather: 'sunny', sky: null });
  assert.deepEqual(Array.from(host.eye), [1200, 40, -300], 'measured from the focus');
});

test('AUDIT BANTHA1 DOC-4: the trees\' host - the jungle\'s near sets gathered and framed on its own door, a gone pixel\'s jungle handles and a failed build\'s given back to it (mutants: the jungle never gathered; never framed; a gone pixel\'s handles kept; a failed build\'s kept)', () => {
  const framed = [], released = [];
  const door = { frame: (sets, x, y, z) => framed.push({ sets: sets.map((s) => ({ px: s.px, n: s.trees.length, at: [s.ox, s.oy, s.oz] })), eye: [x, y, z] }), release: (h) => released.push(h) };
  const host = createTreesHost({ renderer: {}, getTexture: async () => null, seasonsActive: () => false, lowPolyTreesOn: false, jungle: { door }, breathe: async () => {}, yards: () => null });
  const set = (px) => ({ px, py: 5, ox: 0, oy: 0, oz: 0, handles: [px * 10, px * 10 + 1], groups: [{ h: 0, centers: [[1, 2, 3], [4, 5, 6]], wild: null, own: Float32Array.from([1, 0.5]), fit: null }], trees: null, centers: null });
  const near1 = { _dist2: 0, _t: [10, 0, 20], jungleTrees: set(9), lowPolyTrees: null }, far1 = { _dist2: 4, _t: [900, 0, 0], jungleTrees: set(12), lowPolyTrees: null };
  host.frame([near1, far1], [1, 2, 3], null);
  assert.equal(framed.length, 1);
  assert.deepEqual(framed[0], { sets: [{ px: 9, n: 2 * 6, at: [10, 0, 20] }], eye: [1, 2, 3] }, 'the near pixel\'s jungle, at its translation, on the jungle\'s door');
  host.released({ jungleTrees: set(9), lowPolyTrees: null });
  assert.deepEqual(released, [90, 91], 'a gone pixel\'s far pictures');
  host.releasedBuild({ lptHandles: [], jungleHandles: [7, 8] });
  assert.deepEqual(released, [90, 91, 7, 8], 'a failed build\'s');
});

test('AUDIT BANTHA1 DOC-6: the far ring hazes its fog by the haze\'s own law; every pass that uploads the haze sends the frame\'s; the sky\'s controller hands it to its passes; the renderer\'s panel gives it back; the field keeps what it read; an OBJ\'s negative index reads back from the end; the pixel build stands the far picture at the batch\'s scale and shares its wind with the 3D tree (mutants: the ring\'s haze dropped; never uploaded - the ring\'s, the grass\'s; the sky never handed it; the panel drops it; the field\'s distance not kept; the negative index unread; the far picture at the emergents\' size; the sway and Windfall unshared; the fallback not Logging\'s)', () => {
  const u = [[0.006, 40, 1 / 90, 8], [1, 0, 0, 0]], eye = [0, 41.7, 0], p = [0, 30, 600];
  const ring = glslFunctions(RING_HAZE_GLSL, { uJungleHaze: u, uHazeEye: eye, vWorld: p });
  const T = hazeTransmittance(Float32Array.from(u.flat()), eye, p);
  for (const m of [0, 0.3, 0.9]) assert.ok(near(ring.ringHaze(m), 1 - (1 - m) * T, 1e-9), `the ring's fog ${m} taken further by the haze`);
  assert.ok(T < 0.5);
  const ups = [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  for (const f of walk(join(ROOT, 'src'))) for (const m of readFileSync(f, 'utf8').matchAll(/uniform4fv\(([\w.]*uJungleHaze), ([^;]*)\);/g)) ups.push([f.slice(ROOT.length + 1), m[2]]);
  assert.ok(ups.length >= 20, `the passes' uploads (${ups.length})`);
  for (const [f, arg] of ups) assert.match(arg, /^(fog\?\.haze \?\? NO_HAZE|haze \?\? NO_HAZE|r\._haze)\)?$/, `${f} sends the frame's haze`);
  const stubGl = new Proxy({}, { get: (_t, k) => (k === 'getShaderParameter' || k === 'getProgramParameter' ? () => true : () => ({})) });
  const skies = createSkyController(stubGl, new URLSearchParams('sky=classic'));
  skies.setHazeSky(Float32Array.from([0.4, 0.5, 0.45, 0.8]));
  assert.deepEqual(Array.from(skies.renderer.hazeSky), [0.4, 0.5, 0.45, 0.8].map(Math.fround), 'the sky\'s pass takes it');
  skies.setHazeSky(null);
  assert.equal(skies.renderer.hazeSky[3], 0, 'and none');
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  const hz = Float32Array.from([0.005, 30, 1 / 90, 8, 1, 0, 0, 0]);
  r.setJungleHaze(hz);
  r.beginPanelFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), { x: 0, y: 0, w: 64, h: 64 });
  r._haze[4] = 0;   // the panel's own frame - its beginFrame clears an unarmed haze
  r.endPanelFrame();
  assert.deepEqual(Array.from(r._haze), Array.from(hz), 'the panel gives the world its haze back');
  let reads = 0;
  const field = jungleField({ width: 20, height: 20, insideAt: (x) => { reads++; return x > 8; } });
  const d1 = field.at(5, 5), before = reads;
  assert.equal(field.at(5, 5), d1); assert.equal(reads, before, 'kept: the second read searches nothing');
  for (let k = 0; k < 400; k++) field.at(k % 20, Math.floor(k / 20));
  const n = reads; field.at(5, 5); field.at(12, 7); assert.equal(reads, n);
  assert.deepEqual(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvn 0 0 1\nf -3/-1/-1 -2/-1/-1 -1/-1/-1\n').faces[0].corners, [[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  const pb = text('src/scenes/pixelBuild.js');
  assert.match(pb, /scales = Float32Array\.from\(g\.own, \(v\) => v \/ JUNGLE_SCALE_MAX\);/, 'the far picture drawn for the tallest emergent, each tree its share of it');
  assert.match(pb, /batch\.sway = floraSwayOf\(JUNGLE_ARCHIVE, natureSet, proto\.size\.h\);\n\s+_lptSway\.set\(proto, Math\.max\(_lptSway\.get\(proto\) \?\? 0, batch\.sway\)\);/, 'its 3D tree leans as its far picture');
  assert.match(pb, /batch\.windfall = windfallResponse\(JUNGLE_ARCHIVE, record\);[^\n]*\n\s+_lptWindfall\.set\(proto, Math\.max\(_lptWindfall\.get\(proto\) \?\? 0, batch\.windfall\)\);/, '...and under Windfall\'s law');
  assert.match(pb, /batches\.push\(batch\);\n\s+forestGroups\.set\(gk, \{ batch, centers: g\.centers, size \}\);\n/, 'the fallback\'s Tree records are Logging\'s too');
});

test('AUDIT BANTHA1 HAZE-6/HAZE-7/HAZE-8: a window\'s view out keeps the street\'s haze with its fog and stands in it; under the sea the jungle\'s air is off with the air\'s; every dome mixes the haze AFTER its grades, whose colour it already wears (mutants: the view out unhazed; the haze stacked on the sea\'s fog; the dome grading it twice)', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  const hz = Float32Array.from([0.005, 30, 1 / 90, 8, 1, 0, 0, 0]);
  r.setJungleHaze(hz);
  r._rwKeepExterior();
  assert.deepEqual(Array.from(r._rwExterior.haze), Array.from(hz), 'kept with the street\'s fog');
  r.setJungleHaze(null); r._rwKeepExterior();
  assert.equal(r._rwExterior.haze[4], 0, '...and none where it has none');
  assert.match(text('src/render/renderer.js'), /this\.setFog\(FOG_MODE_NAMES\[k\.fogMode\] \?\? 'off', k\.fogDensity, k\.fogStart, k\.fogEnd, new Float32Array\(k\.fogColor\)\);\n\s+this\.setJungleHaze\(k\.haze\[4\] \? k\.haze : null\);/, 'the view out armed with it, after its fog');
  assert.match(hostText('src/scenes/world.js'), /if \(_uw\) \{ renderer\.setFog\(_uw\.mode, _uw\.density, _uw\.start, _uw\.end, new Float32Array\(_uw\.color\)\); jungle\?\.under\(sky\); \}/, 'under the sea, off');
  for (const f of ['src/render/skyRenderer.js', 'src/render/enhancedSky.js', 'src/render/dynamicSkiesRenderer.js']) {
    const src = text(f);
    assert.match(src, /outColor = vec4\(brassGrade\(dreadGrade\([^\n]*?, uDread\), uBrass\), 1\.0\);[^\n]*\n\s*outColor\.rgb = hazeSky\(outColor\.rgb, dir\);/, `${f}: the grades, then the haze`);
    assert.equal(src.split('hazeSky(').length - 1, 1, `${f}: the haze once`);
  }
});
