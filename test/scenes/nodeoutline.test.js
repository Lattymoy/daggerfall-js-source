// NODE-OUTLINE (2026-10-19, the owner: "Overhaul gathering material visuals. Actually outline the sprite itself instead of
// a faint sparkle like it is now").
//
// EVERY GATHERING NODE RINGED ALONG ITS OWN PICTURE. NODE-MARKS lit a node with a card before it - a halo, a shimmer and
// motes - which the eye read as a faint sparkle near the node, not as the node. Now (render/nodeOutline.js):
//   - the gathering host's marks carry each node's PICTURES (scenes/gatherHost.js): the flats it stood for the node (a
//     herb patch's, a vein's, a boulder's, a school's - which flats of which batch, and their centres), a dungeon vein's
//     own batches, and a tree's forest flat with its centre (treeHost.js picturesOf - the 3D tree that stands for it near
//     the eye is found by that centre in its pixel's tree set);
//   - each frame the pass draws those pictures, unmoved, into a tile of a depth-only atlas (the silhouette), then rings
//     the node on screen where a pixel is outside the silhouette and within the ring's width of it, at the silhouette's
//     depth (a wall before the node hides the ring, a tree behind it shows it), in the profession's colour;
//   - a node with no picture (a body drawn as a 3D character) keeps the glow.
// tools/nodeOutlineProbe.mjs draws it in a real WebGL2. bible/06-Systems/Professions-Arc.md, NODE-OUTLINE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createProfBook } from '../../src/net/profBook.js';
import { veins, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { SKINNING_KNIFE } from '../../src/net/professionLaw.js';
import { mineKind } from '../../src/scenes/mineHost.js';
import { herbKind } from '../../src/scenes/herbHost.js';
import { huntKind } from '../../src/scenes/huntHost.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { createGatherHost } from '../../src/scenes/gatherHost.js';
import { nodeMarkRgb } from '../../src/ui/nodeMarks.js';
import { NODE_GLOW_MAX } from '../../src/render/nodeGlow.js';
import {
  OUTLINE_PX, OUTLINE_PX_MIN, OUTLINE_REF_ROWS, OUTLINE_MAX, OUTLINE_TILE, OUTLINE_GRID, OUTLINE_TAPS, OUTLINE_BREATH, OUTLINE_ALPHA,
  OUTLINE_RING_BACK, OUTLINE_QUAD_INDEX_BYTES, outlinePx, outlineBreath, screenRect, snapRect, treeInstanceOf,
  NODE_MASK_VS, NODE_MASK_FS, NODE_RING_FS, NodeOutlineRenderer, createNodeOutlinePass,
} from '../../src/render/nodeOutline.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const WOODS = 231, GLENUMBRA = 59;
const NOON = 20500 * 86_400 + 43_200;
const DAY = utcDayOfMs(NOON * 1000);
const TR = Object.freeze([-1000, 2, 500]);
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

/** The gathering host over one grass pixel (400, 150) with its veins on rock and a body, every batch it makes kept with
 *  the arguments it was made of (`made`). */
async function rig() {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25);
  const law = veins({ x: 400, y: 150, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: 400, py: 150, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: DAY, character: 'c1', tracks: [], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async () => ({ ok: false, error: 'offline' }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const entity = { items: [{ templateIndex: SKINNING_KNIFE.templateIndex, currentCondition: 50, maxCondition: 50 }], stats: {} };   // a body is a node while the knife is carried
  const made = [];
  const kinds = [herbKind({ book }), mineKind({ book }), huntKind({ book, bodies: () => [{ key: 'body:20500:abcdefabcdef', foe: 1, tier: 1, hide: 'hide:wolf', at: () => [TR[0] + 10, TR[1], TR[2] + 10], lift: 0.2, reach: 3, lootKey: () => null }] })];
  const host = createGatherHost({
    book, hud, kinds,
    renderer: { createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers: centers.map((c) => [...c]) }; made.push(b); return b; }, destroyBatch: () => {} },
    getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map([['400,150', entry]]), pixelTranslation: (x, y, out) => { out[0] = TR[0]; out[1] = TR[1]; out[2] = TR[2]; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON * 1000,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0],
    entity: () => entity, keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => true, activeDungeon: () => true,
  });
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  return { host, made, kinds, nodes: () => host.nodesOf(400, 150), entry };
}

// ─── THE PICTURES ────────────────────────────────────────────────────

test('NODE-OUTLINE the host\'s pictures: every herb patch\'s and vein\'s mark carries the flats the host stood for it - which batch, which of its flats (from `first`, `count` of them) and their centres - its own and never a neighbour\'s, though nodes share a batch; a body\'s none (the glow) (mutants: the owners unrecorded; the range off by one; the pictures never handed)', async () => {
  const t = await rig();
  const all = t.nodes();
  assert.ok(all.length > 4, 'the pixel stands its herbs and veins');
  let shared = 0;
  for (const n of all) {
    const at = [n.local[0] + TR[0], n.local[1] + TR[1], n.local[2] + TR[2]];
    const m = t.host.marks(at).find((x) => x.key === n.key);
    if (!m) continue;
    const kind = t.kinds.find((k) => k.id === n.kind);
    const want = kind.flatsOf(n).flatMap((f) => f.centers);
    assert.ok(m.pictures?.length > 0, `${n.key}: its pictures`);
    const got = m.pictures.flatMap((p) => {
      assert.ok(t.made.includes(p.batch), 'a batch the host made');
      assert.equal(p.count, p.centers.length);
      assert.deepEqual(p.batch.centers.slice(p.first, p.first + p.count), p.centers.map((c) => [...c]), `${n.key}: its flats in the batch, from first`);
      if (p.first > 0 || p.batch.centers.length > p.count) shared++;
      return p.centers;
    });
    assert.deepEqual(got.map((c) => [...c]), want.map((c) => [...c]), `${n.key}: exactly its own flats`);
  }
  assert.ok(shared > 0, 'some node shares its batch - its range is its own');
  const body = t.host.marks([TR[0] + 10, TR[1], TR[2] + 10]).find((x) => x.key.startsWith('body:'));
  assert.ok(body, 'the body is marked');
  assert.equal(body.pictures, null, 'a loose body hands no picture: the glow lights it');
});

test('NODE-OUTLINE a tree\'s pictures (treeKind picturesOf): its forest\'s own flat - the group\'s batch, the flat\'s index, its centre (the very array its pixel\'s tree set holds) and its pixel - one list a node, made again only when its batch or its centre changes (none made a frame); none where the flat is gone (mutants: a flat\'s index not its own; made every call)', () => {
  const kind = treeKind({ book: { taken: () => false, counting: () => false, state: {} } });
  const c = [10, 0, 20], batch = { archive: 504, record: 3 };
  const entry = { forest: { groups: new Map([['g', { batch, centers: [[0, 0, 0], c], size: { w: 3, h: 6 } }]]) } };
  const n = { key: 'tree:1:2:3:0', flat: { group: 'g', i: 1 } };
  const p = kind.picturesOf(n, entry);
  assert.deepEqual(p, [{ batch, first: 1, count: 1, centers: [c], center: c, entry }]);
  assert.equal(p[0].center, c, 'the centre itself, not a copy: the 3D tree is found by it');
  assert.equal(kind.picturesOf(n, entry), p, 'the same list next frame');
  const again = { archive: 504, record: 3 };
  entry.forest.groups.get('g').batch = again;
  assert.notEqual(kind.picturesOf(n, entry), p, 'a new batch (the pixel stood again): a new list');
  assert.equal(kind.picturesOf(n, entry)[0].batch, again);
  assert.equal(kind.picturesOf({ key: 'x', flat: { group: 'h', i: 0 } }, entry), null, 'no such group');
  assert.equal(kind.picturesOf({ key: 'y', flat: { group: 'g', i: 9 } }, entry), null, 'no such flat');
});

test('NODE-OUTLINE treeInstanceOf: a tree\'s 3D instance this frame by its centre - its row in its pixel\'s set (Low Poly Trees\' or the jungle\'s) at the set\'s translation, its run in the frame that drew its handle; none when no frame drew it, or the centre is no tree of the sets (mutants: the translation forgotten; a stale frame trusted)', () => {
  const h0 = { id: 'oak' }, h1 = { id: 'kapok' };
  const c0 = [1, 2, 3], c1 = [4, 5, 6];
  const set = { trees: new Float32Array([0, 1, 2, 3, 1.1, 0.5, 1, 4, 5, 6, 0.9, 2.5]), centers: [c0, c1], handles: [h0, h1], ox: 100, oy: 10, oz: -50 };
  const run = { run: { handle: h1 }, scale: [1, 1, 1], size: [8, 20], subs: [] };
  const frame = { cut: new Set([h1]), runs: [{ run: { handle: h0 } }, run] };
  const rows = new WeakMap(), out = new Float32Array(5);
  const got = treeInstanceOf({ batch: null, first: 0, count: 1, center: c1, entry: { jungleTrees: set } }, [null, frame], rows, out);
  assert.equal(got.frame, frame); assert.equal(got.run, run);
  assert.deepEqual([...out], [104, 15, -44, 2.5, 0.9].map((v) => Math.fround(v)), 'x, y, z at the set\'s translation, yaw, scale');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: c0, entry: { lowPolyTrees: set } }, [frame], rows, out), null, 'its handle not drawn this frame');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: c1, entry: { lowPolyTrees: set } }, [], rows, out), null, 'no frame drew a tree');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: [4, 5, 6], entry: { lowPolyTrees: set } }, [frame], rows, out), null, 'an equal array is not its centre');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: c1, entry: {} }, [frame], rows, out), null, 'a pixel with no set');
});

// ─── THE LAWS ────────────────────────────────────────────────────────

test('NODE-OUTLINE the ring\'s width and breath: OUTLINE_PX at OUTLINE_REF_ROWS rows, with the image, never under OUTLINE_PX_MIN; its opacity whole at the clock\'s start, OUTLINE_BREATH less at its half-breath, whole over the glow\'s 60 s clock, and still under reduced motion (mutants: the width fixed; the breath\'s depth)', () => {
  assert.equal(outlinePx(OUTLINE_REF_ROWS), OUTLINE_PX);
  assert.equal(outlinePx(2160), OUTLINE_PX * 2);
  assert.equal(outlinePx(200), OUTLINE_PX_MIN, 'a retro image: a pixel and a half of its own');
  assert.ok(OUTLINE_PX >= 2 && OUTLINE_PX <= 3, 'an outline, not a beacon');
  assert.equal(outlineBreath(0), 1);
  assert.ok(Math.abs(outlineBreath(2) - (1 - OUTLINE_BREATH)) < 1e-12, 'the half-breath at 0.25 Hz');
  assert.ok(Math.abs(outlineBreath(60) - outlineBreath(0)) < 1e-9, 'whole over the wrapped clock');
  assert.equal(outlineBreath(2, true), 1, 'still');
  assert.ok(OUTLINE_ALPHA > 0.8 && OUTLINE_ALPHA <= 1, 'a line the eye finds');
});

test('NODE-OUTLINE screenRect and snapRect: a node\'s boxes through the camera to its rectangle on screen, widened by the pad and held to the screen; off it, none; a box behind the eye the whole screen; snapped out to whole pixels (mutants: a corner skipped; the pad unapplied; the clamp gone; the snap rounding in)', () => {
  // an identity projection: NDC is x, y
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const out = [0, 0, 0, 0];
  assert.deepEqual(screenRect([[-0.2, -0.1, 0, 0.4, 0.3, 0]], 1, I, [0.05, 0.1], out), [0.1, 0.1, 0.35, 0.3].map((v, i) => out[i]));
  assert.ok(Math.abs(out[0] - 0.1) < 1e-12 && Math.abs(out[1] - 0.1) < 1e-12 && Math.abs(out[2] - 0.35) < 1e-12 && Math.abs(out[3] - 0.3) < 1e-12);
  screenRect([[-0.2, -0.1, 0, 0, 0, 0], [0.1, 0.1, 0, 0.4, 0.3, 0]], 2, I, [0, 0], out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [0.1, 0.1, 0.3, 0.2], 'every box, every corner');
  screenRect([[-0.2, -0.1, 0, 0, 0, 0], [5, 5, 0, 6, 6, 0]], 1, I, [0, 0], out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [-0.1, -0.05, 0.1, 0.05], 'the first `count` alone');
  screenRect([[0.8, 0.8, 0, 1.5, 1.5, 0]], 1, I, [0.1, 0.1], out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [0.85, 0.85, 0.15, 0.15], 'held to the screen');
  assert.equal(screenRect([[2, 2, 0, 3, 3, 0]], 1, I, [0.1, 0.1], out), null, 'off the screen');
  const behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0];   // w = -z: z >= 0 is behind
  assert.deepEqual(screenRect([[0, 0, -1, 0.1, 0.1, 0.5]], 1, behind, [0, 0], out), [0, 0, 1, 1], 'reaching behind the eye: the whole screen');
  const r = [0.1, -0.2, 0.0731, 0.0517];
  const was = [r[0] - r[2], r[0] + r[2], r[1] - r[3], r[1] + r[3]];
  snapRect(r, 640, 480);
  const px = [(r[0] - r[2] + 1) * 320, (r[0] + r[2] + 1) * 320, (r[1] - r[3] + 1) * 240, (r[1] + r[3] + 1) * 240];
  for (const v of px) assert.ok(Math.abs(v - Math.round(v)) < 1e-9, `whole pixels (${v})`);
  assert.ok(r[0] - r[2] <= was[0] + 1e-12 && r[0] + r[2] >= was[1] - 1e-12 && r[1] - r[3] <= was[2] + 1e-12 && r[1] + r[3] >= was[3] - 1e-12, 'snapped out, never in');
});

test('NODE-OUTLINE the programs: the mask\'s vertex stage is the billboard program\'s own with the rectangle stretched over the tile after it, never moving a vertex given way; its fragment stage the picture\'s cut (a flat\'s 0.5 and margin, a tree\'s material and handover); the ring\'s discards inside the silhouette, takes the nearest of OUTLINE_TAPS x 2 taps, stands behind the silhouette it borders and fades in the fog and the haze (mutants: the remap moving a gone vertex; the inside rung; a tap ring missing; the ring in front of its node)', () => {
  const bb = src('src/render/renderer.js');
  assert.ok(NODE_MASK_VS.startsWith('#version 300 es'));
  assert.ok(NODE_MASK_VS.includes('if (uMesh > 0.5) {') && NODE_MASK_VS.includes('if (gone) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'), 'BB_VS whole');
  assert.ok(bb.includes('if (gone) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'));
  assert.match(NODE_MASK_VS, /if \(gone\) gl_Position = vec4\(2\.0, 2\.0, 2\.0, 1\.0\);[^\n]*\n\s*if \(!gone\) gl_Position\.xy = \(gl_Position\.xy - uMaskRect\.xy \* gl_Position\.w\) \* uMaskRect\.zw;/, 'the remap after the vertex is placed, a gone one left off the clip volume');
  assert.match(NODE_MASK_FS, /if \(a < 0\.5\) discard;/);
  assert.match(NODE_MASK_FS, /a = vAlpha > 0\.0 \? a \* vAlpha : 1\.0;/, 'a tree\'s material cut, an opaque card never');
  assert.match(NODE_MASK_FS, /bayer4\(gl_FragCoord\.xy\) \+ 0\.03125 >= vFade/, 'the handover\'s screen-door');
  assert.match(NODE_RING_FS, /if \(maskAt\(at, lo, hi\) < 1\.0\) discard;/, 'nothing over the node itself');
  assert.equal((NODE_RING_FS.match(/d = min\(d, min\(maskAt\(at \+ vec2\([^)]*\) \* uRing, lo, hi\), maskAt\(at \+ vec2\([^)]*\) \* \(0\.5 \* uRing\), lo, hi\)\)\);/g) ?? []).length, OUTLINE_TAPS, 'every tap, at the ring and half of it');
  assert.match(NODE_RING_FS, /if \(d >= 1\.0\) discard;/);
  assert.ok(NODE_RING_FS.includes(`* (${OUTLINE_RING_BACK.toFixed(4)} / max(length(away), 1e-4))`), 'stood behind the silhouette');
  assert.ok(OUTLINE_RING_BACK > 0.02 && OUTLINE_RING_BACK < 0.3);
  assert.match(NODE_RING_FS, /o = vec4\(uOutlineColor\.rgb, uOutlineColor\.a \* fogFactorAt\(at3\)\);/);
  assert.equal(OUTLINE_MAX, NODE_GLOW_MAX, 'a tile for every node the glow could light');
  assert.equal(OUTLINE_MAX, OUTLINE_GRID * OUTLINE_GRID);
  assert.equal(OUTLINE_QUAD_INDEX_BYTES, 6 * 4, 'six u32 indices a flat');
  assert.match(bb, /BB_QUAD_INDEX_BYTES = 6 \* 4;/);
});

// ─── THE DRAW ────────────────────────────────────────────────────────

/** A WebGL2 that records every call; the viewport 640 x 480 at (8, 4), the frame's target a token. */
function fakeGl() {
  const calls = [];
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, CULL_FACE: 11,
    DEPTH_TEST: 12, LESS: 13, VIEWPORT: 14, FRAMEBUFFER_BINDING: 15, FRAMEBUFFER: 16, TEXTURE_2D: 17, DEPTH_COMPONENT24: 18, DEPTH_ATTACHMENT: 19, NONE: 20,
    ELEMENT_ARRAY_BUFFER: 21, UNSIGNED_INT: 22, DYNAMIC_DRAW: 23, SCISSOR_TEST: 24, TEXTURE0: 25, DEPTH_BUFFER_BIT: 26, SRC_ALPHA: 27, ONE_MINUS_SRC_ALPHA: 28,
    TEXTURE_MIN_FILTER: 29, TEXTURE_MAG_FILTER: 30, NEAREST: 31, TEXTURE_WRAP_S: 32, TEXTURE_WRAP_T: 33, CLAMP_TO_EDGE: 34 };
  let n = 0;
  const gl = new Proxy(C, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k === 'getParameter') return a[0] === C.VIEWPORT ? new Int32Array([8, 4, 640, 480]) : a[0] === C.FRAMEBUFFER_BINDING ? 'frame-target' : null;
        if (k === 'isEnabled') return false;
        return { id: ++n, kind: k };
      };
    },
  });
  return { gl, calls };
}

test('NODE-OUTLINE the draw over a fake GL: nothing to ring touches nothing; each node\'s pictures drawn into its own tile of the atlas - a flat\'s own six indices (its batch\'s range, from its first), a 3D tree its run\'s every submesh as one instance - then the frame\'s target and viewport back and one quad a node in its colour, kindling and breath; the baseline handed back (mutants: the tile shared; the offset its batch\'s first flat; the target not given back; the viewport not given back)', () => {
  const { gl, calls } = fakeGl();
  const r = new NodeOutlineRenderer(/** @type {any} */ (gl));
  const proj = new Float32Array([1.5, 0, 0, 0, 0, 2, 0, 0, 0, 0, -1.001, -1, 0, 0, -0.1, 0]);
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.6, 0, 1]);
  const herbTex = { tex: 'herb' }, subTex = { tex: 'leaf' };
  const handle = { h: 1 }, c = [0, 0, -12];
  const frame = { eye: [0, 1.6, 0], radius: 140, band: 20, gpu: { vb: 'vb', ib: 'ib' }, cut: new Set([handle]), runs: [{ run: { handle }, scale: [1, 1, 1], size: [6, 10], sway: 0, subs: [{ offset: 96, count: 30, tex: subTex, alpha: 2, cull: 0 }, { offset: 216, count: 12, tex: subTex, alpha: 0, cull: 2 }] }] };
  const renderer = { gl, _proj: proj, _view: view, _camPos: new Float32Array([0, 1.6, 0]), _bbRight: new Float32Array([1, 0, 0]), _bbUp: new Float32Array([0, 1, 0]),
    _fogMode: 0, _fogRange: [0, 1], textures: new Map([['500_9', herbTex], ['504_3', { tex: 'far' }]]), lptDrawnFrames: () => [frame, null] };
  calls.length = 0;
  assert.equal(r.draw([], renderer, 0), 0);
  assert.equal(calls.length, 0, 'nothing to ring, nothing touched');
  const batch = { archive: 500, record: 9, frame: null, vao: 'herb-vao', _ibOff: 4800, size: { w: 1, h: 1 }, origin: [0, 0, 0] };
  const forest = { archive: 504, record: 3, frame: null, vao: 'forest-vao', _ibOff: 0, size: { w: 6, h: 10 }, origin: [0, 0, 0], lptProto: handle };
  const set = { trees: new Float32Array([0, ...c, 1, 0.3]), centers: [c], handles: [handle], ox: 0, oy: 0, oz: 0 };
  const list = [
    { alpha: 1, rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 2, count: 3, centers: [[1, 0, -6], [1.3, 0, -6.2], [0.8, 0, -5.8]] }] } },
    { alpha: 0.5, rgb: nodeMarkRgb('logging'), mark: { pictures: [{ batch: forest, first: 0, count: 1, centers: [c], center: c, entry: { lowPolyTrees: set } }] } },
    { alpha: 0, rgb: nodeMarkRgb('mining'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 0, -3]] }] } },
  ];
  calls.length = 0;
  assert.equal(r.draw(list, renderer, 2), 2, 'the unkindled one none');
  assert.equal(r.trees, 1);
  const at = (k, ...a) => calls.findIndex((x) => x[0] === k && a.every((v, i) => x[i + 1] === v));
  // the masks: into the atlas, a tile a node
  const toAtlas = at('bindFramebuffer', gl.FRAMEBUFFER, r.fb), back = at('bindFramebuffer', gl.FRAMEBUFFER, 'frame-target');
  assert.ok(toAtlas >= 0 && back > toAtlas, 'into the atlas, then the frame\'s own target back');
  const tiles = calls.slice(toAtlas, back).filter((x) => x[0] === 'viewport').slice(1).map((x) => x.slice(1, 3));
  assert.deepEqual(tiles, [[0, 0], [OUTLINE_TILE, 0]], 'its own tile each');
  const flats = calls.slice(toAtlas, back).filter((x) => x[0] === 'drawElements');
  assert.deepEqual(flats.map((x) => x.slice(2)), [[18, gl.UNSIGNED_INT, 4800 + 2 * 24], [6, gl.UNSIGNED_INT, 0]], 'the herb\'s three flats from its first; the tree\'s far picture');
  const trees = calls.slice(toAtlas, back).filter((x) => x[0] === 'drawElementsInstanced');
  assert.deepEqual(trees.map((x) => x.slice(2)), [[30, gl.UNSIGNED_INT, 96, 1], [12, gl.UNSIGNED_INT, 216, 1]], 'every submesh of its run, one instance');
  assert.ok(calls.some((x) => x[0] === 'bufferSubData' && x[3] instanceof Float32Array && x[3][0] === c[0] && x[3][2] === c[2]), 'its instance row written');
  assert.ok(calls.some((x) => x[0] === 'vertexAttribDivisor' && x[1] === 3 && x[2] === 1), 'the door\'s buffers under the pass\'s own instance');
  // the rings: on the frame's target, its viewport back
  assert.deepEqual(calls[back + 1], ['viewport', 8, 4, 640, 480], 'its viewport back');
  const rings = calls.slice(back).filter((x) => x[0] === 'drawArrays');
  assert.equal(rings.length, 2, 'one quad a node');
  const colours = calls.slice(back).filter((x) => x[0] === 'uniform4f' && x[1] === 'uOutlineColor').map((x) => x.slice(2));
  const breath = outlineBreath(2);
  assert.deepEqual(colours.map((v) => v.map((x) => +x.toFixed(6))), [[...nodeMarkRgb('herbalism'), OUTLINE_ALPHA * breath], [...nodeMarkRgb('logging'), OUTLINE_ALPHA * 0.5 * breath]].map((v) => v.map((x) => +x.toFixed(6))));
  // the baseline handed back
  const last = calls.length - 1 - [...calls].reverse().findIndex((x) => x[0] === 'drawArrays');
  const after = calls.slice(last).map((x) => x.slice(0, 2).join(':'));
  for (const want of [`disable:${gl.BLEND}`, `depthMask:true`, `enable:${gl.CULL_FACE}`]) assert.ok(after.includes(want), want);
  assert.ok(!calls.some((x) => x[0] === 'enable' && x[1] === gl.SCISSOR_TEST), 'no scissor where none stood');
  r.dispose();
  assert.ok(calls.some((x) => x[0] === 'deleteFramebuffer') && calls.some((x) => x[0] === 'deleteTexture') && calls.filter((x) => x[0] === 'deleteProgram').length === 2, 'EVERY ALLOCATION HAS AN OWNER');
});

test('NODE-OUTLINE the world host\'s pass (createNodeOutlinePass): a mark with pictures is ringed, one with none goes to the glow; the programs built at IDLE once a node is first ringed, nothing ringed until they stand; a ring that will not build hands every mark to the glow; a pass that drew is a foreign pass; null forgets (mutants: every mark to the glow; the build on the frame)', () => {
  const { gl } = fakeGl();
  let foreign = 0;
  const renderer = { gl, _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: new Float32Array([0, 1.6, 0]), markForeignPass: () => { foreign++; } };
  const glowed = [], ringed = [], idled = [];
  const glow = { draw: (m) => { glowed.push(m ? m.map((x) => x.key) : null); return 0; } };
  const fake = { draw: (list) => { ringed.push(list.map((g) => g.mark.key)); return list.length; }, dispose() {} };
  let t = 10, builds = 0;
  const pass = createNodeOutlinePass(renderer, { glow, now: () => t, build: () => { builds++; return /** @type {any} */ (fake); }, idle: (fn) => idled.push(fn), reduced: () => false });
  const herb = { key: 'herb:1', profession: 'herbalism', at: [0, 0, -5], w: 2, h: 1, pictures: [{ batch: {}, first: 0, count: 1 }] };
  const body = { key: 'body:1', profession: 'hunting', at: [1, 0, -5], w: 1, h: 1, pictures: null };
  assert.equal(pass.draw([herb, body]), 0, 'not built: nothing ringed');
  assert.deepEqual(glowed.at(-1), ['body:1'], 'the body to the glow at once');
  assert.equal(builds, 0, 'never built on a frame');
  assert.equal(idled.length, 1);
  idled[0]();
  assert.equal(builds, 1);
  t += 0.5;
  assert.equal(pass.draw([herb, body]), 1);
  assert.deepEqual(ringed.at(-1), ['herb:1']);
  assert.equal(foreign, 1, 'a foreign pass');
  pass.draw(null);
  assert.deepEqual(glowed.at(-1), null, 'null forgets, the glow\'s too');
  const broken = createNodeOutlinePass(renderer, { glow, now: () => t, build: () => { throw new Error('no GL'); }, idle: (fn) => fn(), reduced: () => false });
  broken.draw([herb]);
  broken.draw([herb, body]);
  assert.deepEqual(glowed.at(-1), ['herb:1', 'body:1'], 'an outline that will not build: every mark to the glow');
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('NODE-OUTLINE the wiring: the world host rings the marks through the outline, the glow its fallback, in the hook after each mode\'s opaque world (the street\'s, a dungeon\'s), none under the travel view; the renderer keeps the flats\' basis and the 3D trees its frame drew, forgotten each frame (mutants: the outline unwired; the drawn trees never forgotten)', () => {
  const w = src('src/scenes/world.js'), r = src('src/render/renderer.js');
  assert.match(w, /const nodeOutlinePass = createNodeOutlinePass\(renderer\);/);   // PIN MOVED (HOST-SPLIT): the outline builds its own fallback glow - no entry in bootWorld
  assert.match(src('src/render/nodeOutline.js'), /export function createNodeOutlinePass\(renderer, \{ glow = createNodeGlowPass\(renderer\), /, 'the fallback glow its own when the host hands none');
  assert.match(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); drawAuras\(\); nodeOutlinePass\.draw\(travelView\?\.active \? null : nodeMarksAt\(enchantFeet\(\)\)\); \};/);
  assert.doesNotMatch(w, /nodeGlowPass/, 'the glow is the outline\'s fallback alone');
  // PIN MOVED (the seams review's matrix-for-a-basis test): the three components the vec3 uniforms read, never a copy whole
  assert.match(r, /const bbR = \(this\._bbRight \?\?= new Float32Array\(3\)\), bbU = \(this\._bbUp \?\?= new Float32Array\(3\)\);\n\s*bbR\[0\] = camRight\[0\]; bbR\[1\] = camRight\[1\]; bbR\[2\] = camRight\[2\];\n\s*bbU\[0\] = camUp\[0\]; bbU\[1\] = camUp\[1\]; bbU\[2\] = camUp\[2\];/);
  assert.match(r, /for \(let i = 0; i < slots\.length; i\+\+\) drawn\[i\] = slots\[i\]\?\.runs\.length \? slots\[i\] : null;/);
  assert.match(r, /this\._lptDrawn\?\.fill\(null\);   \/\/ NODE-OUTLINE: and the 3D trees a frame drew/);
  assert.match(r, /lptDrawnFrames\(\) \{ return this\._lptDrawn \?\? \[\]; \}/);
  assert.match(src('src/scenes/gatherHost.js'), /for \(const r of out\) r\.pictures = r\.kind\.picturesOf\?\.\(r\.node, r\.src\?\.entry \?\? null\) \?\? r\.src\?\.pictures\?\.get\(r\.key\) \?\? null;/);
});
