// FIELD BUGS 2026-10-25i NODE-CROWN (Discord #bug-reports, kvassdrit, "Big trees hide resource node particles": "Needs to
// be size aware or have a completely different visual like others have recommended").
//
// A Logging node near the eye is its 3D tree - Low Poly Trees (on by default) draws every wild tree within LPT_NEAR_M
// (140 m) in 3D, and a node glints within NODE_GLOW_M (120 m) - and NODE-GLINT (render/nodeGlint.js) lights it over a box
// about its root: its crown's reach and height, which through the frame's camera is the rectangle its mask, its glints
// and its sheen stand in. The height counted the prototype's own scale twice. The run's size is the prototype's standing
// size with its scale in it already (world/lowPolyTrees.js readLowPolyTrees: `m.max[1] * sy`), the mesh is drawn at that
// scale (renderer.js bbVertexShader's mesh mode: aCenter * uMeshScale * aScale), and the pass took the size times
// `run.scale[1]` once more. The climates stand 95 Tree records (TREE_RECORDS, with the woodland sets' winter archives -
// world/climateSwaps.js getNatureArchive), 93 with a prototype and 74 of those scaled (AUDIT FB1025i C2: this said 88 of
// 116, the pin's own loop's count): the temperate and mountain woods' (504-511) mostly 0.5 to 0.8 - lit to half to four
// fifths of their height, 504_16's 16 m tree to 8 m, the upper crown that shows over a wood never glinting - and the
// swamp's, the desert's and a winter wood's 15 (1.1 to 4.2) over a box up to four times as tall as they are, most of
// their glints' tries in the empty air above them and their sheen crossing it.
// AUDIT FB1025i C1 (the report's own "Needs to be size aware"): and a big crown's glints were a herb's six at a herb's
// reach - per pixel of its picture 7 times sparser than a near herb's at 30 m, 25 times at 12 m. They grow with the
// crown's size on screen now, up to twice as many reaching twice as far (nodeGlint.js glintCrownGrowth); a flat's stay. Not depth: the light is drawn after the
// trees, against the world's depth at the picture's own (tools/nodeGlintProbe.mjs - a half-scale prefab's top two fifths
// lit with the fix, none without).
// Pinned through the producers: the Low Poly Trees door over the vendored data makes the tree's handle and its frame
// (the run as the renderer reads it), the billboard program's own vertex stage places the mesh's highest vertex, and the
// glint pass's draw over a recording GL boxes the node. bible/06-Systems/Professions-Arc.md, NODE-GLINT (NODE-CROWN).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createLowPolyTrees } from '../../src/systems/lowPolyTreesAssets.js';
import { NodeGlintRenderer, GLINT_TREE_REACH } from '../../src/render/nodeGlint.js';
import { bbVertexShader } from '../../src/render/renderer.js';
import { TREE_RECORDS, isTreeRecord } from '../../src/world/terrain/terrainNature.js';
import { getNatureArchive, SEASON } from '../../src/world/climateSwaps.js';
import * as NG from '../../src/render/nodeGlint.js';
import { glslFunctions } from '../glsl.mjs';

const V = new URL('../../vendor/low-poly-trees/Trees/', import.meta.url);
const bytes = (name) => new Uint8Array(readFileSync(new URL(name, V)));
const JSON_ = JSON.parse(readFileSync(new URL('trees.json', V), 'utf8'));
const BIN = bytes('trees.bin');
/** The mod's vertices as its buffers read them (render/lowPolyTreesRender.js LowPolyTreesGpu: f32 x 8 a vertex, its
 *  position first). */
const VERTS = new Float32Array(BIN.buffer.slice(BIN.byteOffset, BIN.byteOffset + JSON_.vertexBytes));

/** A GL that answers what the door and the pass ask and records nothing; the viewport 1280 x 720. */
const quietGl = () => new Proxy({}, {
  get(_, k) {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({});
    if (k === 'getParameter') return (a) => (a === 'VIEWPORT' ? new Int32Array([0, 0, 1280, 720]) : null);
    if (typeof k === 'string' && k.toUpperCase() === k) return k;
    return () => {};
  },
});
/** A TEXTURE file the door paints its atlases from: every record 32 x 48 (the player's own pictures never enter this tree). */
const fakeTexture = (archive) => ({ archive, recordCount: 40, palette: { getRed: (i) => i, getGreen: (i) => i, getBlue: () => 9 },
  getDFBitmap: () => ({ width: 32, height: 48, data: new Uint8Array(32 * 48).fill(3) }) });

/** THE DOOR (systems/lowPolyTreesAssets.js createLowPolyTrees) over the vendored data, its frames kept as the renderer
 *  is handed them. */
async function door() {
  const frames = [];
  const renderer = { gl: quietGl(), uploadTexture: () => {}, releaseTexture: () => {}, setLowPolyTrees: (f) => frames.push(f),
    createAtlasTexture: () => ({}), uploadAtlasRows: () => {}, releaseAtlasTexture: () => {} };
  const lpt = createLowPolyTrees({ renderer, getTexture: async (a) => fakeTexture(a), fetchBytes: async (url) => bytes(url.split('/').pop()), breathe: async () => {}, warn: () => {}, now: () => 0 });
  await lpt.load();
  return { lpt, frames };
}

// a camera 30 m south of the root at a walker's eye, looking north (the gl's column-major)
const EYE = [0, 1.7, 30];
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const PROJ = persp((70 * Math.PI) / 180, 1280 / 720, 0.1, 4000);
const VIEW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -EYE[0], -EYE[1], -EYE[2], 1]);
const mul4 = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const ROOT = [2, 0.5, 0], YAW = 0.7, OWN = 1.2;   // a wild tree's own scale (DFU's 0.6..1.4) and turn

/** A Logging node's 3D tree of prototype `archive`_`record` near the eye: the door's handle and its frame (one tree at
 *  ROOT), the node's mark as the gathering host hands it (scenes/treeHost.js picturesOf: the forest flat, its centre and
 *  its pixel), and the glint pass's draw of it - its box, its span and the rectangle it stands in. */
async function glintOf(d, archive, record, own = OWN, eye = EYE, drawn = true) {
  const p = d.lpt.proto(archive, record);
  const h = await d.lpt.farPicture(p);
  const set = { ox: 0, oy: 0, oz: 0, handles: [h], trees: Float32Array.from([0, ...ROOT, own, YAW]), centers: [ROOT] };
  d.lpt.frame([set], eye[0], eye[1], eye[2], { stamp: 1 });
  const frame = d.frames.at(-1), run = frame.runs[0];
  const pass = new NodeGlintRenderer(/** @type {any} */ (quietGl()));
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1]);
  const r = { gl: pass.gl, _proj: PROJ, _view: view, _camPos: new Float32Array(eye), _bbRight: new Float32Array([1, 0, 0]), _bbUp: new Float32Array([0, 1, 0]),
    _fogMode: 0, _fogRange: [0, 1], _haze: new Float32Array(8), textures: new Map(), lptDrawnFrames: () => (drawn ? [frame, null] : []) };
  const batch = { archive, record: h.record, vao: null, size: h.size, origin: [0, 0, 0], lptProto: h };
  const lit = pass.draw([{ alpha: 1, seed: 0.5, at: ROOT, rgb: [1, 1, 1], mark: { pictures: [{ batch, first: 0, count: 1, centers: [ROOT], center: ROOT, entry: { lowPolyTrees: set } }] } }], r, 0);
  const s = pass._nodes[0];
  return { p, h, run, lit, trees: pass.trees, box: s.boxes[0].slice(), span: s.spans[0].slice(), anchor: Array.from(s.anchors.slice(0, 6)), inner: s.inner.slice(), rect: s.rect.slice(), count: s.count, glint: s.glint };
}
/** The mesh's highest vertex (its own frame). */
function highest(p) {
  const m = JSON_.meshes[p.mesh];
  let at = -1, y = -Infinity;
  for (let v = 0; v < m.vertices; v++) if (VERTS[(m.vertex + v) * 8 + 1] > y) { y = VERTS[(m.vertex + v) * 8 + 1]; at = m.vertex + v; }
  return [VERTS[at * 8], VERTS[at * 8 + 1], VERTS[at * 8 + 2]];
}
const near = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;

test('NODE-CROWN the report\'s tree: a temperate wood\'s 504_16, its prototype at half scale - the glint\'s crown as tall as the tree its run draws (its highest vertex placed by the billboard program\'s own mesh mode), its glints\' highest spot the tree\'s top on screen, inside the rectangle it is lit in; it stood at half, the upper crown never lit (mutants: the scale counted twice; the row\'s scale unread; the width for the height; the anchors on the old height; the box on the old height)', async () => {
  const d = await door();
  assert.ok(isTreeRecord(504, 16), 'a Tree record of the temperate woods: a Logging node may be it');
  const g = await glintOf(d, 504, 16);
  assert.equal(g.lit, 1, 'the node lit');
  assert.equal(g.trees, 1, 'as its 3D tree');
  assert.deepEqual(g.run.scale, [0.5, 0.5, 0.5], 'the report\'s case: a prototype the mod scales');
  // the tree as the world draws it: the mesh's highest vertex through BB_VS's mesh mode at the run's scale and the row's
  const top = glslFunctions(bbVertexShader(), {
    uProj: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uView: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uRight: [1, 0, 0], uUp: [0, 1, 0], uOrigin: [0, 0, 0],
    uSize: g.run.size, uFlatWind: [0, 0, 0, 0], uSway: 0, uTip: [0, 0, 0], uFacePoint: [0, 0, 0, 0], uElitePad: [0, 0, 0, 0], uMesh: 1, uMeshScale: g.run.scale,
    uMeshColor: [1, 1, 1], uMeshAlpha: 1, uLptCut: [0, 0, 0, 0], uLptBand: 20, uLptSun: [0, 1, 0, 0], aNormal: [0, 1, 0], aCorner: [0, 0],
    aCenter: highest(g.p), aInst: [...ROOT, YAW], aScale: OWN,
  }, { fp32: true });
  top.main();
  const tall = top.globals.vBBWorld[1] - ROOT[1];
  assert.ok(near(tall, 16, 0.01), `the tree drawn 16 m tall (${tall.toFixed(3)})`);
  assert.ok(near(g.box[4] - ROOT[1], tall), `its crown's box to the tree's top (${(g.box[4] - ROOT[1]).toFixed(3)} m of ${tall.toFixed(3)})`);
  assert.equal(g.box[1], ROOT[1], 'from its root');
  assert.ok(near(g.span[4], tall) && near(g.anchor[4], tall), 'and its glints\' spots on the crown to its top');
  assert.deepEqual(g.box.map((v) => +v.toFixed(4)), [ROOT[0] - g.run.size[0] * GLINT_TREE_REACH * OWN, ROOT[1], ROOT[2] - g.run.size[0] * GLINT_TREE_REACH * OWN,
    ROOT[0] + g.run.size[0] * GLINT_TREE_REACH * OWN, ROOT[1] + tall, ROOT[2] + g.run.size[0] * GLINT_TREE_REACH * OWN].map((v) => +v.toFixed(4)), 'its reach as it was');
  // on screen: the highest spot a glint may take (the anchor's top, over the root) is the tree's top - the spots stand in
  // the plane through the root at a share of its height (NODE_GLINT_VS glintOf), so the half height lit the lower half
  // alone (tools/nodeGlintProbe.mjs: none of the light in a half-scale prefab's top two fifths); and the rectangle the
  // mask, the light and the sheen stand in holds it
  const vp = mul4(PROJ, VIEW), ndcY = (p) => { const c = [1, 3].map((i) => vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]); return c[0] / c[1]; };
  const treeTop = ndcY([ROOT[0], top.globals.vBBWorld[1], ROOT[2]]), spotTop = ndcY([g.anchor[0], g.anchor[1] + g.anchor[4], g.anchor[2]]);
  assert.ok(near(spotTop, treeTop, 1e-5), `its glints' highest spot the tree's top on screen (${spotTop.toFixed(4)} against ${treeTop.toFixed(4)} NDC)`);
  assert.ok(treeTop <= g.inner[1] + g.inner[3], 'inside the rectangle it is lit in');
});

test('NODE-CROWN every climate\'s Tree records, its summer archive and its winter one (AUDIT FB1025i C2: the woodland sets\' alone have one - getNatureArchive): the glint\'s crown as tall as the tree drawn (its highest vertex at its prototype\'s scale and its row\'s), at a row scale under 1 and over it (C3) - 95 records, 93 with a prototype: 54 scaled under 1, 19 at 1 and 20 over it (mutants: the scale counted twice; the row\'s scale unread; the width for the height; the row\'s scale held at 1 and over)', async () => {
  const d = await door();
  const seen = { records: 0, none: 0, under: 0, one: 0, over: 0 }, wrong = [];
  for (const [base, records] of Object.entries(TREE_RECORDS)) {
    for (const archive of new Set([Number(base), getNatureArchive(Number(base), SEASON.Winter)])) {
      for (const record of records) {
        seen.records++;
        if (!d.lpt.proto(archive, record)) { seen.none++; continue; }   // a record the mod has no tree for stands as its classic flat
        for (const own of [0.8, 1.2]) {   // DFU's terrain scale is 0.6..1.4: a tree under its prototype's size and over it
          const g = await glintOf(d, archive, record, own);
          const sy = g.run.scale[1];
          if (own === 0.8) seen[sy < 1 ? 'under' : sy > 1 ? 'over' : 'one']++;
          const tall = highest(g.p)[1] * sy * own;
          if (g.lit !== 1 || !near(g.box[4] - ROOT[1], tall, 1e-3 * Math.max(1, tall)) || !near(g.span[4], tall, 1e-3 * Math.max(1, tall))) wrong.push(`${archive}_${record} at ${own}: ${(g.box[4] - ROOT[1]).toFixed(2)} m of ${tall.toFixed(2)} (scale ${sy})`);
        }
      }
    }
  }
  assert.deepEqual(wrong, [], 'every crown the height of its tree');
  assert.deepEqual(seen, { records: 95, none: 2, under: 54, one: 19, over: 20 }, 'the record\'s numbers are the climates\' own');
});

// ─── AUDIT FB1025i C1: A CROWN'S GLINTS BY ITS SIZE ─────────────────────

test('NODE-CROWN (AUDIT FB1025i C1) the law: a 3D crown\'s glints grow over a herb\'s from the side a herb\'s glint stops growing at (GLINT_PX / GLINT_SHARE, with the image), its share of it to the two thirds - so their light, count times reach squared, grows as the crown\'s area - between 1 and GLINT_CROWN_GROWTH (twice as many, reaching twice as far); its side the square root of its standing area at its root\'s depth (mutants: the growth unbounded; the growth under 1; the power the side\'s own; the image unscaled; the count unrounded; the reach ungrown; the area its width alone; a root behind the eye none)', () => {
  assert.deepEqual([NG.GLINT_CROWN_GROWTH, NG.GLINT_CROWN_COUNT], [2, 12], 'twice: twelve glints the most a node has');
  const ref = NG.GLINT_PX / NG.GLINT_SHARE;   // 40 px at 1080 rows
  assert.equal(NG.glintCrownGrowth(1080, ref), 1, 'a crown no bigger than a herb\'s capped picture: a herb\'s');
  assert.equal(NG.glintCrownGrowth(1080, ref / 2), 1, 'nor a smaller one');
  assert.ok(near(NG.glintCrownGrowth(1080, ref * 2), 2 ** (2 / 3), 1e-12), 'twice the side: the two thirds');
  assert.ok(near(NG.glintCrownGrowth(1080, ref * 2) ** 3 / NG.glintCrownGrowth(1080, ref * 1.25) ** 3, (2 / 1.25) ** 2, 1e-9), 'its light as its area');
  assert.ok(near(NG.glintCrownGrowth(1080, ref * 2 ** 1.5), 2, 1e-12) && NG.glintCrownGrowth(1080, 4000) === 2 && NG.glintCrownGrowth(1080, Infinity) === 2, 'the most, and no more');
  assert.ok(near(NG.glintCrownGrowth(540, ref), 2 ** (2 / 3), 1e-12), 'with the image');
  assert.deepEqual([ref / 2, ref, ref * 1.5, ref * 2, ref * 4].map((x) => NG.glintCrownCount(1080, x)), [6, 6, 8, 10, 12], 'the count, a whole one');
  assert.equal(NG.glintCrownPx(1080, ref * 4), NG.GLINT_PX * 2, 'the reach: twice a herb\'s most');
  assert.ok(near(NG.glintCrownPx(1080, ref / 2), NG.glintPx(1080, ref / 2), 1e-12), 'a small crown\'s a picture\'s share, as a flat\'s');
  // the side: sqrt(width px x height px) at the root's depth through the projection's own scales
  assert.ok(near(NG.crownSidePx([2, 0, 0, 0, 0, 3], 10, 4, 6, 800, 600), Math.sqrt(((4 * 2 * 800) / 20) * ((6 * 3 * 600) / 20)), 1e-9));
  assert.ok(near(NG.crownSidePx([-2, 0, 0, 0, 0, 3], 10, 4, 6, 800, 600), NG.crownSidePx([2, 0, 0, 0, 0, 3], 10, 4, 6, 800, 600), 1e-12), 'a mirrored projection the same');
  assert.equal(NG.crownSidePx([2, 0, 0, 0, 0, 3], 0, 4, 6, 800, 600), Infinity, 'its root at the eye: the most');
});

test('NODE-CROWN (AUDIT FB1025i C1) the report\'s tree through the Low Poly Trees door and the pass: 504_16 at 30 m and at 12 m glints a big crown\'s twelve at twice a herb\'s most reach (its rectangle the room for them); a herb\'s flat and the same tree\'s far flat keep six at a picture\'s reach; a sapling far off grows part way (mutants: the crown never grown; every node grown; the count unsent; the room a flat\'s)', async () => {
  const d = await door();
  const rows = 720;   // quietGl's viewport: 1280 x 720
  for (const z of [30, 12]) {
    const g = await glintOf(d, 504, 16, 1, [0, 1.7, z]);
    assert.equal(g.trees, 1, `${z} m: as its 3D tree`);
    assert.deepEqual([g.count, +g.glint.toFixed(6)], [NG.GLINT_CROWN_COUNT, +(NG.glintPxMax(rows) * NG.GLINT_CROWN_GROWTH).toFixed(6)], `${z} m: twelve, twice a herb's reach`);
    // the room its rays take round its box (where the screen does not cut it): its own reach and two
    const room = ((NG.glintPxMax(rows) * NG.GLINT_CROWN_GROWTH + 2) * 2) / 1280;
    if (g.rect[0] - g.rect[2] > -1 + 1e-9) assert.ok((g.inner[0] - g.inner[2]) - (g.rect[0] - g.rect[2]) >= room - 1e-6, `${z} m: its rays' room`);
  }
  // the same tree past its 3D radius: its far flat (the frame drew no 3D tree of it) - a flat's six, a flat's reach
  const far = await glintOf(d, 504, 16, 1, [0, 1.7, 30], false);
  assert.equal(far.trees, 0);
  assert.equal(far.count, NG.GLINT_COUNT, 'its far flat: six');
  assert.equal(far.glint, NG.glintPx(rows, Math.max(far.inner[2] * 1280, far.inner[3] * rows)), 'at a picture\'s reach');
  // a small tree (506_24) 100 m off: grown part way
  const small = await glintOf(d, 506, 24, 0.8, [0, 1.7, 100]);
  assert.equal(small.trees, 1);
  assert.ok(small.count > NG.GLINT_COUNT && small.count < NG.GLINT_CROWN_COUNT, `a small far crown part way (${small.count})`);
  // by its standing area at its root's depth - 100 m before the level eye
  const side = NG.crownSidePx(PROJ, 100, small.run.size[0] * 0.8, highest(small.p)[1] * small.run.scale[1] * 0.8, 1280, rows);
  assert.deepEqual([small.count, +small.glint.toFixed(6)], [NG.glintCrownCount(rows, side), +NG.glintCrownPx(rows, side).toFixed(6)], 'its count and reach its size\'s');
  // a herb's patch flat 25 m off: as it was
  const pass = new NodeGlintRenderer(/** @type {any} */ (quietGl()));
  const herb = { archive: 254, record: 1, frame: null, vao: {}, _ibOff: 0, size: { w: 0.8, h: 0.8 }, origin: [0, 0, 0] };
  pass.draw([{ alpha: 1, seed: 0.5, at: [0, 0, 5], rgb: [1, 1, 1], mark: { pictures: [{ batch: herb, first: 0, count: 1, centers: [[0, 0, 5]] }] } }],
    { gl: pass.gl, _proj: PROJ, _view: VIEW, _camPos: new Float32Array(EYE), _bbRight: new Float32Array([1, 0, 0]), _bbUp: new Float32Array([0, 1, 0]), _fogMode: 0, _fogRange: [0, 1], _haze: new Float32Array(8), textures: new Map([['254_1', {}]]), lptDrawnFrames: () => [] }, 0);
  const s = pass._nodes[0];
  assert.equal(pass.drawn, 1);
  assert.deepEqual([s.count, s.glint], [NG.GLINT_COUNT, NG.glintPx(rows, Math.max(s.inner[2] * 1280, s.inner[3] * rows))], 'a herb: six at its picture\'s reach');
});
