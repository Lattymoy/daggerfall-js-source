// AUDIT POI (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-2) - LANE B, THE GAME RUNTIME: the host that stands the
// approved POIs (scenes/poiHost.js), their pictures and models (poi/poiRuntime.js, poi/poiImageDecode.js), the feed
// (poi/poiFeed.js), their marks (ui/poi/poiMapMark.js through ui/bounty/bountyMapMark.js readBountyMarks) and the world's draw order
// (scenes/world.js). One test a finding, each red on the code the audit read (0c78d81a85).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPoiHost, POI_RETRY_MS, POI_STAND_BUDGET_MS } from '../../src/scenes/poiHost.js';
import { createPoiFeed, POI_FEED_CACHE_KEY, POI_FEED_POLL_MS } from '../../src/poi/poiFeed.js';
import { bakeAlbedo, poiPartModels, createTextureBook, materialLook } from '../../src/poi/poiRuntime.js';
import { decodePoiImageSteps } from '../../src/poi/poiImageDecode.js';
import { poiMapMarks, POI_MARKS_MAX } from '../../src/ui/poi/poiMapMark.js';
import { readBountyMarks, BOUNTY_MARKS_MAX } from '../../src/ui/bounty/bountyMapMark.js';
import { encodePoiMesh } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL } from '../../src/poi/poiLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const r3 = (v) => Math.round(v * 1e3) / 1e3 + 0;
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const mat = (over = {}) => ({ ...DEFAULT_MATERIAL, ...over });
const PIC = { width: 1, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]) };
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((res) => setImmediate(res)); };

const quad = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  submeshes: [{ start: 0, count: 3 }, { start: 3, count: 3 }],
});
/** A hall: the floor and the ceiling of a 10 x 3 x 10 box, one submesh. */
const hall = () => ({
  positions: new Float32Array([0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10, 0, 3, 0, 10, 3, 0, 10, 3, 10, 0, 3, 10]),
  normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]),
  uvs: new Float32Array(16),
  indices: new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7]),
  submeshes: [{ start: 0, count: 12 }],
});
/** One face of a 45-degree roof (the plane x + y = 0), its normal up and out. */
const roof = () => ({
  positions: new Float32Array([0, 0, 0, 0, 0, 1, 1, -1, 0]),
  normals: new Float32Array([Math.SQRT1_2, Math.SQRT1_2, 0, Math.SQRT1_2, Math.SQRT1_2, 0, Math.SQRT1_2, Math.SQRT1_2, 0]),
  uvs: new Float32Array(6),
  indices: new Uint16Array([0, 1, 2]),
  submeshes: [{ start: 0, count: 3 }],
});
const doc = (id, { px = 10, py = 20, name = 'Tower', parts, lights = [] } = {}) => ({
  v: 1, id, name, place: { px, py, x: 100, z: 100, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 },
  parts, lights, marker: { show: true, label: name },
});
const part = (key, mesh, materials = [mat()], over = {}) => ({ key, mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials, ...over });

function fakeRenderer() {
  const r = { meshes: new Set(), created: 0, destroyed: 0, uploads: new Map(), released: [], draws: [] };
  r.createMesh = (model) => { const m = { model, id: ++r.created }; r.meshes.add(m); return m; };
  r.destroyMesh = (m) => { r.destroyed++; r.meshes.delete(m); };
  r.uploadTexture = (a, rec, c32, o) => r.uploads.set(`${a}_${rec}`, { c32, o });
  r.uploadEmissionTexture = () => {};
  r.releaseTexture = (a, rec) => { r.released.push(`${a}_${rec}`); r.uploads.delete(`${a}_${rec}`); };
  r.evictEmissionTexture = () => {};
  r.drawMesh = (mesh, m, remap, o) => r.draws.push({ mesh, m: [...m], remap, o });
  r.recordShadowMesh = () => {};
  return r;
}
function fakeCollider(onAdd = () => {}) {
  const c = { buckets: new Map(), adds: 0, removes: 0 };
  c.addMesh = (key, positions, indices, matrix, riding) => { c.adds++; c.buckets.set(key, { matrix: [...matrix], riding }); onAdd(); };
  c.removeBucket = (key) => { if (c.buckets.delete(key)) c.removes++; };
  return c;
}

/** The host over a fake feed, renderer and collider: `assets` by hash (a value, or a function answering one). */
function hostOver({ list: first, assets, ground = () => 50, feet = null, decodeImage = async () => PIC, clock, keepDecodedBytes, collider = fakeCollider() }) {
  let list = first;
  const feed = {
    tick: () => null,
    atPixel: (px, py) => list.filter((e) => e.doc.place.px === px && e.doc.place.py === py),
    all: () => list,
    asset: async (sha) => { await null; if (!assets.has(sha)) throw new Error(`missing ${sha.slice(0, 6)}`); const v = assets.get(sha); return typeof v === 'function' ? v() : v; },
    set: (l) => { list = l; },
  };
  const renderer = fakeRenderer();
  const H = { renderer, collider, feed, t: 0, built: [{ px: 10, py: 20 }], feet, off: [0, 0, 0] };
  H.host = createPoiHost({
    renderer, feed, decodeImage,
    pixels: () => H.built,
    translation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 10) * 819.2 + 1000 + H.off[0]; out[1] = 3 + H.off[1]; out[2] = -(py - 20) * 819.2 + 2000 + H.off[2]; return out; },
    groundAt: (x, z) => ground(x, z), collider: () => collider, riding: (px, py) => `ride:${px},${py}`, feet: () => H.feet, now: () => H.t, log: null,
    ...(clock ? { clock } : {}), ...(keepDecodedBytes != null ? { keepDecodedBytes } : {}),
  });
  H.frames = async (n) => { for (let f = 0; f < n; f++) { H.host.frame(); await ticks(); } };
  H.settle = () => H.frames(16);
  return H;
}
const meshAsset = async (mesh) => { const bytes = encodePoiMesh(mesh); return [await sha256(bytes), bytes]; };
const status = (H) => H.host.standing().map((s) => s.status).join(',');

// ── R1 ──────────────────────────────────────────────────────────────

test('AUDIT POI R1: a body inside a POI keeps its floor - the same POI handed back as a new document (any approval anywhere) re-files nothing, a recentre\'s ulp of ground re-files nothing, and a real move of the ground carries the standing collider to its new height at once (mutants: every new document placed again; the height compared exactly; the carry unread)', async () => {
  const [sha, bytes] = await meshAsset(hall());
  const D = () => doc('poi-000000000001', { parts: [part('hall', sha)] });
  let g = 50;
  const H = hostOver({ list: [{ id: 'poi-000000000001', rev: 1, doc: D() }], assets: new Map([[sha, bytes]]), ground: () => g });
  await H.settle();
  assert.ok(H.collider.buckets.has('poi:poi-000000000001:0'), 'stood, the body far off');
  H.feet = [1105, 50, 2105];   // in the hall (scene x 1100-1110, y 50-53, z 2100-2110)
  H.host.frame();
  const adds = H.collider.adds;
  // (a) the feed read again after an approval elsewhere: the same POI, a new object
  H.feed.set([{ id: 'poi-000000000001', rev: 1, doc: D() }]);
  await H.frames(3);
  assert.equal(H.collider.removes, 0, 'nothing taken down');
  assert.equal(H.collider.adds, adds, 'nothing filed again (addMesh is 53-194 ms on a big building)');
  // (b) a floating-origin recentre: the pixel's translation moves, the ground read again an ulp off
  H.off = [819.2, 0, 0]; H.feet = [1105 + 819.2, 50, 2105]; g = 50 + 3e-12;
  await H.frames(3);
  assert.equal(H.collider.removes, 0, 'a recentre restands nothing');
  assert.equal(H.collider.adds, adds);
  // (c) the ground truly moves under it (a pixel built finer): the collider carried to the new height, the same frame
  g = 50.5;
  for (let i = 0; i < 31; i++) H.host.frame();   // the ground is read again every POI_GROUND_EVERY frames
  const b = H.collider.buckets.get('poi:poi-000000000001:0');
  assert.ok(b, 'the floor under the body is never left out');
  assert.equal(r3(b.matrix[13]), 47.5, 'filed again at the new height (the ground 50.5 less the frame\'s 3)');
  assert.equal(H.collider.removes, 1);
});

// ── R2 ──────────────────────────────────────────────────────────────

test('AUDIT POI R2: a load that does not stand frees what it made - a later part that will not load, every retry; a POI taken down while it loads (mutants: the parts made left alive; a job given up never closed)', async () => {
  const [shaA, a] = await meshAsset(quad());
  const [shaB, b] = await meshAsset(hall());
  const missing = 'e'.repeat(64);
  const F = hostOver({ list: [{ id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { parts: [part('one', shaA, [mat(), mat({ alpha: 'blend' })]), part('two', missing)] }) }], assets: new Map([[shaA, a]]) });
  await F.settle();
  assert.equal(status(F), 'failed');
  assert.equal(F.renderer.meshes.size, 0, 'part one\'s two models freed when part two would not load');
  for (let k = 1; k <= 3; k++) { F.t = POI_RETRY_MS * k; await F.settle(); }
  assert.equal(F.renderer.meshes.size, 0, 'and on every retry');
  assert.ok(F.renderer.created >= 8);

  let release;
  const gate = new Promise((res) => { release = res; });
  const G = hostOver({ list: [{ id: 'poi-000000000002', rev: 1, doc: doc('poi-000000000002', { parts: [part('one', shaA, [mat(), mat()]), part('two', shaB)] }) }], assets: new Map([[shaA, a], [shaB, async () => { await gate; return b; }]]) });
  await G.frames(10);
  assert.equal(G.renderer.meshes.size, 1, 'part one made, part two waiting on its mesh');
  G.built = [];
  G.host.frame();   // the pixel streams out mid-load
  release();
  await G.frames(6);
  assert.deepEqual(G.host.standing(), []);
  assert.equal(G.renderer.meshes.size, 0, 'taken down mid-load: nothing left on the GPU');
});

// ── R3 ──────────────────────────────────────────────────────────────

test('AUDIT POI R3: a look that would not load is let go of at once - two POIs sharing a picture that failed at different moments both stand once it comes back, and the failed one let go never releases its successor\'s texture (mutants: the failed look kept; its record released)', async () => {
  const [shaA, a] = await meshAsset(quad());
  const tex = 'c'.repeat(64);
  let up = false;
  const M = [mat({ texture: tex }), mat()];
  const H = hostOver({
    list: [{ id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { px: 10, parts: [part('body', shaA, M)] }) }, { id: 'poi-000000000002', rev: 1, doc: doc('poi-000000000002', { px: 11, parts: [part('body', shaA, M)] }) }],
    assets: new Map([[shaA, a], [tex, async () => { if (!up) throw new Error('offline'); return new Uint8Array([1]); }]]),
  });
  await H.settle();   // t = 0: the first fails
  H.t = 10_000; H.built = [{ px: 10, py: 20 }, { px: 11, py: 20 }];
  await H.settle();   // t = 10 s: the second stands, and fails
  assert.equal(status(H), 'failed,failed');
  up = true;
  for (let t = 11_000; t <= 200_000; t += 10_000) { H.t = t; await H.settle(); }
  assert.equal(status(H), 'ready,ready', 'the picture back: both stand');
  // the first's failed look let go after the second's fresh one uploaded under the same record: that texture stays
  const rec = [...H.renderer.uploads.keys()].find((k) => H.renderer.uploads.get(k).c32.width === 1 && H.renderer.uploads.get(k).c32.height === 2);
  assert.ok(rec, 'the picture\'s look uploaded');
  assert.ok(!H.renderer.released.includes(rec), 'never released while the POIs wearing it stand');
});

// ── R4, R14 (the world's draw) ──────────────────────────────────────

test('AUDIT POI R4, R14: the world draws a POI\'s glass after the grass, the banners, the Windfall, the haze and the held flats - every pass that writes depth the glass does not - sorted from the view\'s own eye; the editor\'s lines after it (mutants: the glass before the grass; sorted from the traveller\'s head)', () => {
  const w = src('src/scenes/world.js');
  const at = (needle) => { const i = w.indexOf(needle); assert.ok(i > 0, needle); return i; };
  const glass = at('poiHost?.drawTranslucent(');
  for (const before of ['    frameGrass();\n', '    frameBanners();\n', 'windfall.draw(proj, view', '    frameHaze();\n', '    renderer.drawHeld(camRight, bbUp);']) assert.ok(at(before) < glass, `${before.trim()} before the glass`);
  assert.ok(glass < at('    drawFalling();'), 'and the rain after it, as before');
  assert.ok(w.includes('poiHost?.drawTranslucent(renderer, mwv.eye, yardCull);'), 'the view\'s own eye');
  assert.ok(at('if (poiEditor?.drawLines(proj, view)) renderer.markForeignPass();') > glass, 'the handles over the glass');
  assert.ok(w.includes("if (_torchesMode === 'exterior') poiHost?.standDown();"), 'R8: the street left keeps the models');
  assert.ok(w.includes('decodeImage: decodePoiImageSteps,'), 'R8: the decoder\'s steps under the host\'s budget');
});

test('AUDIT POI R14: a two-sided blended submesh lays its back faces first; a translucent part the view test sees off screen is not drawn; the far one first whatever the order they stand in (mutants: the front faces first; a shadow-only verdict drawn)', async () => {
  const book = createTextureBook();
  const recordOf = (m) => book.recordOf(materialLook(m));
  const glass = poiPartModels(quad(), [mat({ alpha: 'blend', twoSided: true }), mat({ alpha: 'blend', twoSided: true })], recordOf).translucent;
  const corner = (i) => [glass.positions[i * 3], glass.positions[i * 3 + 1], glass.positions[i * 3 + 2]].join(',');
  assert.deepEqual([...glass.indices.subarray(0, 3)].map(corner), ['0,0,0', '1,1,0', '1,0,0'], 'the back face first');
  assert.deepEqual([...glass.indices.subarray(3, 6)].map(corner), ['0,0,0', '1,0,0', '1,1,0'], 'then the front');
  assert.deepEqual([...glass.normals.subarray(0, 3)], [0, 0, 1], 'the back\'s normal turned');
  const opaqueTwo = poiPartModels(quad(), [mat({ twoSided: true }), mat()], recordOf).opaque;
  assert.deepEqual([...opaqueTwo.indices.subarray(0, 3)], [0, 1, 2], 'an opaque two-sided one keeps its front first');

  const [sha, bytes] = await meshAsset(quad());
  const pane = (id, x) => ({ id, rev: 1, doc: { ...doc(id, { parts: [part('pane', sha, [mat({ alpha: 'blend' }), mat({ alpha: 'blend' })])] }), place: { ...doc(id).place, x } } });
  const H = hostOver({ list: [pane('poi-000000000001', 100), pane('poi-000000000002', 400), pane('poi-000000000003', 250)], assets: new Map([[sha, bytes]]) });
  await H.settle();
  H.renderer.draws.length = 0;
  H.host.drawTranslucent(H.renderer, [1100, 50, 2100]);
  assert.deepEqual(H.renderer.draws.map((d) => r3(d.m[12])), [1400, 1250, 1100], 'the farthest first');
  H.renderer.draws.length = 0;
  H.host.drawTranslucent(H.renderer, [1400, 50, 2100]);
  assert.deepEqual(H.renderer.draws.map((d) => r3(d.m[12])), [1100, 1250, 1400], 'and from another eye, the next frame');
  H.renderer.draws.length = 0;
  H.host.drawTranslucent(H.renderer, [1100, 50, 2100], (box) => (box[0] > 1300 ? 1 : 0));
  assert.deepEqual(H.renderer.draws.map((d) => r3(d.m[12])), [1250, 1100], 'off screen (a shadow alone): a pane casts none, so not drawn');
});

// ── R5, R6 ──────────────────────────────────────────────────────────

test('AUDIT POI R5: a part\'s own scale is baked into its model - positions times it, normals through its inverse - and drawn through its turn alone, so a stretched 45-degree roof is lit by its true normal (N.L 0.970, not 0.243); a scale moved is modelled again, drawn meanwhile through the difference (mutants: the scale unbaked; the normal through the scale; the scale moved never modelled again)', async () => {
  const [sha, bytes] = await meshAsset(roof());
  const D = (s) => doc('poi-000000000001', { parts: [part('roof', sha, [mat()], { s })] });
  const H = hostOver({ list: [{ id: 'poi-000000000001', rev: 1, doc: D([4, 1, 1]) }], assets: new Map([[sha, bytes]]), clock: () => 0 });   // a budget never spent: the work lands in its frame
  await H.settle();
  const shaderNormal = () => {
    H.renderer.draws.length = 0;
    H.host.draw(H.renderer);
    const { mesh, m } = H.renderer.draws[0];
    const n = [...mesh.model.normals.subarray(0, 3)];
    const v = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
    const l = Math.hypot(...v);
    return { n: v.map((c) => r3(c / l)), mesh, m };
  };
  const first = shaderNormal();
  assert.deepEqual(first.n, [0.243, 0.97, 0], 'the face\'s true normal (its edges through the stretch, crossed): N.L 0.970 for an overhead sun');
  assert.deepEqual([...first.mesh.model.positions.subarray(6, 9)], [4, -1, 0], 'the corner (1, -1, 0) stretched four times along x');
  assert.deepEqual([first.m[0], first.m[5], first.m[10]].map(r3), [1, 1, 1], 'drawn through the turn and the place\'s size alone');
  assert.equal(r3(H.host.partOf('poi-000000000001', 'roof').scene[0]), 4, 'the part\'s matrix (the pick, the gizmo) keeps its scale');
  // a scale moved (an approval, a drag's end): modelled again, the first models freed
  H.feed.set([{ id: 'poi-000000000001', rev: 2, doc: D([2, 1, 1]) }]);
  H.host.frame();   // modelled again inside this frame's slice - and drawn, this frame, through the scale the new model carries
  const swap = shaderNormal();
  assert.equal(r3(swap.m[0] * swap.mesh.model.positions[6] + swap.m[12]), 1102, 'the corner where the new scale stands it (x 2 from 1100)');
  await H.settle();
  const again = shaderNormal();
  assert.deepEqual([...again.mesh.model.positions.subarray(6, 9)], [2, -1, 0], 'modelled for its new scale');
  assert.deepEqual(again.n, [0.447, 0.894, 0]);
  assert.equal(H.renderer.meshes.size, 1, 'the old model freed');
});

test('AUDIT POI R5, R6: while a part\'s new scale is being modelled its old model is drawn through what makes up the difference, never through a mirror its faces are not wound for - a part whose scale turns negative is not drawn until its faces are wound back (mutants: drawn inside out; the scale\'s sign not the model\'s)', async () => {
  const [sha, bytes] = await meshAsset(quad());
  const D = (s) => doc('poi-000000000001', { parts: [part('wall', sha, [mat(), mat()], { s })] });
  let ck = 0;
  const H = hostOver({ list: [{ id: 'poi-000000000001', rev: 1, doc: D([1, 1, 1]) }], assets: new Map([[sha, bytes]]), clock: () => (ck += 10) });   // every step spends the frame
  await H.frames(30);
  const drawsNow = () => { H.renderer.draws.length = 0; H.host.draw(H.renderer); return H.renderer.draws; };
  assert.equal(drawsNow().length, 1);
  // stretched: drawn at once through the difference (positions exact), before its new model is made
  H.feed.set([{ id: 'poi-000000000001', rev: 2, doc: D([3, 1, 1]) }]);
  H.host.frame();
  const mid = drawsNow();
  assert.equal(mid.length, 1);
  assert.equal(r3(mid[0].m[0]), 3, 'the old model (scale one) through the new scale');
  // mirrored: its faces are wound for the other hand - not drawn until modelled again
  await H.frames(10);
  H.feed.set([{ id: 'poi-000000000001', rev: 3, doc: D([-1, 1, 1]) }]);
  H.host.frame();
  assert.equal(drawsNow().length, 0, 'never drawn inside out');
  await H.frames(10);
  const after = drawsNow();
  assert.equal(after.length, 1);
  const m = after[0].m;
  assert.ok(m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]) > 0, 'drawn through no mirror: the mirror is in the model');
  const model = after[0].mesh.model;
  const corner = (i) => [model.positions[i * 3], model.positions[i * 3 + 1], model.positions[i * 3 + 2]].join(',');
  assert.deepEqual([...model.indices.subarray(0, 3)].map(corner), ['0,0,0', '-1,1,0', '-1,0,0'], 'mirrored in x and wound back');
});

// ── R7 ──────────────────────────────────────────────────────────────

test('AUDIT POI R7: every marked POI is on the map, past the bounty\'s eight - the POIs read under their own cap, the bounties under theirs (mutant: the reader\'s cap unread)', () => {
  const marks = Array.from({ length: 20 }, (_, i) => ({ px: 100 + i * 10, py: 200, label: `POI ${i}`, id: `poi-${i}` }));
  const read = readBountyMarks(() => poiMapMarks(marks), { width: 1000, height: 500 }, 'Point of interest', POI_MARKS_MAX);
  assert.equal(read.length, 20);
  assert.equal(readBountyMarks(() => poiMapMarks(marks), { width: 1000, height: 500 }).length, BOUNTY_MARKS_MAX, 'a hunter\'s map as it was');
  assert.ok(POI_MARKS_MAX > BOUNTY_MARKS_MAX);
  for (const f of ['src/ui/heldMap.js', 'src/ui/travel/travelMapWindow.js']) {
    const s = src(f);
    const reads = s.match(/readBountyMarks\(this\.deps\.pois,[^\n]*?poiLegendText\(\)(, POI_MARKS_MAX)?\)/g);
    assert.ok(reads.length >= 1 && reads.every((r) => r.endsWith(', POI_MARKS_MAX)')), `${f}: the POIs read under their cap`);
  }
});

// ── R8 ──────────────────────────────────────────────────────────────

test('AUDIT POI R8: the stand work is a time slice a frame - a POI with a big picture stands over many frames, POI_STAND_BUDGET_MS of steps each, never in one task (mutant: the budget unread)', async () => {
  const [sha, bytes] = await meshAsset(quad());
  const W = 2048, Hh = 1024;
  const big = { width: W, height: Hh, data: new Uint8Array(W * Hh * 4) };
  for (let i = 0; i < W * Hh; i++) { big.data[i * 4] = 200; big.data[i * 4 + 3] = (i % W) < W / 2 ? 255 : 0; }   // half of it clear
  const tex = 'b'.repeat(64);
  let ck = 0;
  const H = hostOver({ list: [{ id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { parts: [part('leaf', sha, [mat({ texture: tex, alpha: 'cutout' }), mat()])] }) }],
    assets: new Map([[sha, bytes], [tex, new Uint8Array([1])]]), decodeImage: async () => big, clock: () => ck++ });   // a millisecond a look at the clock
  assert.equal(POI_STAND_BUDGET_MS, 4);
  await H.frames(10);
  assert.equal(status(H), 'loading', 'ten frames in, the picture still baking a slice a frame (all of it in one task was the old way)');
  let f = 10;
  while (status(H) !== 'ready' && f < 200) { await H.frames(1); f++; }
  assert.equal(status(H), 'ready');
  assert.ok(f > 20, `stood after ${f} frames`);
});

test('AUDIT POI R8: the street left (standDown) takes the colliders down and keeps the models - coming back, the POIs are placed, not loaded, their first filings a turn a frame; a collider carried round the body never waits its turn (mutants: standDown a take-down; the filings unbudgeted; a carried filing waiting its turn)', async () => {
  const [sha, bytes] = await meshAsset(hall());
  let ck = 0;
  const collider = fakeCollider(() => { ck += 10; });   // a filing spends the frame's budget
  const three = ['poi-000000000001', 'poi-000000000002', 'poi-000000000003'].map((id, k) => ({ id, rev: 1, doc: { ...doc(id, { parts: [part('hall', sha)] }), place: { ...doc(id).place, x: 100 + k * 50 } } }));
  const H = hostOver({ list: three, assets: new Map([[sha, bytes]]), clock: () => ck++, collider });
  await H.frames(40);
  assert.equal(collider.buckets.size, 3);
  const made = H.renderer.created;
  H.host.standDown();
  assert.equal(collider.buckets.size, 0, 'no collider carried in');
  assert.equal(H.renderer.meshes.size, 3, 'the models kept');
  H.renderer.draws.length = 0; H.host.draw(H.renderer);
  assert.equal(H.renderer.draws.length, 0, 'and nothing drawn');
  H.host.frame();
  assert.equal(collider.buckets.size, 1, 'out again: one filing this frame');
  H.host.frame(); H.host.frame();
  assert.equal(collider.buckets.size, 3, 'a turn a frame');
  assert.equal(H.renderer.created, made, 'nothing loaded again');
  // two halls standing round the body, their ground moved: both carried in the one frame, whatever the budget
  const both = ['poi-000000000004', 'poi-000000000005'].map((id) => ({ id, rev: 1, doc: doc(id, { parts: [part('hall', sha)] }) }));
  let g = 50;
  const G = hostOver({ list: both, assets: new Map([[sha, bytes]]), clock: () => ck++, collider: fakeCollider(() => { ck += 10; }), ground: () => g });
  await G.frames(40);
  G.feet = [1105, 50, 2105];
  G.host.frame();
  g = 51;
  let lifted = 0;
  for (let i = 0; i < 31 && !lifted; i++) { G.host.frame(); lifted = G.collider.removes; }   // the ground read again
  assert.equal(lifted, 2, 'both floors moved in the one frame');
  assert.equal(G.collider.buckets.size, 2, 'and both filed again in it, the budget spent by the first');
});

// ── R9 ──────────────────────────────────────────────────────────────

test('AUDIT POI R9: a cut-out or blended picture\'s clear texels take their colour from their nearest - no dark fringe where a filter or a mip reads them - their alpha untouched, an opaque picture untouched (mutant: the bleed skipped)', () => {
  // 4 x 1, top row first as decoded: red, red at alpha 0 (as a 2D canvas hands it back: black), clear, clear blue
  const strip = { width: 4, height: 1, data: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255]) };
  const cut = bakeAlbedo(strip, mat({ alpha: 'cutout' })).colors;
  assert.deepEqual([...cut], [255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 255, 0, 0, 0, 255, 255], 'each clear texel its nearest edge\'s colour, still clear');
  const blend = bakeAlbedo({ width: 3, height: 1, data: new Uint8Array([0, 0, 0, 0, 100, 200, 50, 64, 0, 0, 0, 0]) }, mat({ alpha: 'blend' })).colors;
  assert.deepEqual([...blend], [100, 200, 50, 0, 100, 200, 50, 64, 100, 200, 50, 0]);
  // a ring at a time: a texel two away takes the colour its nearer neighbour took
  const far = bakeAlbedo({ width: 3, height: 3, data: new Uint8Array(36).map((_, i) => (i < 4 ? [10, 20, 30, 255][i] : 0)) }, mat({ alpha: 'cutout' })).colors;
  for (let i = 0; i < 9; i++) assert.deepEqual([...far.subarray(i * 4, i * 4 + 3)], [10, 20, 30], `texel ${i}`);
  const op = bakeAlbedo(strip, mat()).colors;
  assert.deepEqual([...op.subarray(4, 8)], [0, 0, 0, 255], 'an opaque picture\'s texels are its own');
});

test('AUDIT POI R9: a picture is read back through WebGL2 - its bitmap made unpremultiplied and unconverted, uploaded as it is and read a band a step through a framebuffer, every object deleted - never through a 2D canvas, which keeps its pixels premultiplied (mutant: the 2D canvas read)', () => {
  const W = 300, Hh = 500;
  const file = new Uint8Array(W * Hh * 4).map((_, i) => (i * 7) & 255);
  const calls = [];
  let deleted = 0;
  const C = { TEXTURE_2D: 1, RGBA8: 2, RGBA: 3, UNSIGNED_BYTE: 4, FRAMEBUFFER: 5, COLOR_ATTACHMENT0: 6, FRAMEBUFFER_COMPLETE: 7, NO_ERROR: 0, NONE: 8,
    UNPACK_FLIP_Y_WEBGL: 9, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 10, UNPACK_COLORSPACE_CONVERSION_WEBGL: 11, PACK_ALIGNMENT: 12, MAX_TEXTURE_SIZE: 13 };
  const gl = { ...C,
    getParameter: (k) => (k === C.MAX_TEXTURE_SIZE ? 4096 : 0), createTexture: () => ({}), createFramebuffer: () => ({}),
    bindTexture() {}, bindFramebuffer() {}, framebufferTexture2D() {}, checkFramebufferStatus: () => C.FRAMEBUFFER_COMPLETE, getError: () => C.NO_ERROR,
    pixelStorei: (k, v) => calls.push(['pixelStorei', k, v]), texImage2D: (...a) => calls.push(['texImage2D', ...a.slice(0, 5)]),
    readPixels: (x, y, w, h, f, t, out, off) => { calls.push(['readPixels', y, h]); out.set(file.subarray(y * W * 4, (y + h) * W * 4), off); },
    deleteTexture: () => { deleted++; }, deleteFramebuffer: () => { deleted++; },
  };
  let asked = null;
  const bmp = { width: W, height: Hh, close() { this.closed = true; } };
  const it = decodePoiImageSteps(new Uint8Array([1, 2, 3]), { gl, bitmap: (blob, o) => { asked = o; return Promise.resolve(bmp); } });
  let r = it.next();
  assert.ok(r.value && typeof r.value.then === 'function', 'first the bitmap, waited on');
  assert.deepEqual(asked, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  let steps = 0;
  r = it.next(bmp);
  while (!r.done) { steps++; r = it.next(); }
  assert.deepEqual(r.value.data, file, 'the file\'s own bytes, top row first');
  const reads = calls.filter((c) => c[0] === 'readPixels');
  assert.ok(reads.length > 1 && steps >= reads.length, `read in ${reads.length} bands, a step each`);
  assert.ok(reads.every((c) => c[2] * W <= 65_536 || c[2] === 1));
  assert.deepEqual(calls.find((c) => c[0] === 'texImage2D').slice(1), [C.TEXTURE_2D, 0, C.RGBA8, C.RGBA, C.UNSIGNED_BYTE]);
  assert.ok(calls.some((c) => c[0] === 'pixelStorei' && c[1] === C.UNPACK_PREMULTIPLY_ALPHA_WEBGL && c[2] === false));
  assert.equal(deleted, 2, 'its texture and framebuffer deleted');
  assert.equal(bmp.closed, true, 'the bitmap closed');
  assert.match(src('src/poi/poiImageDecode.js'), /AUDIT POI R9: NOT THROUGH A 2D CANVAS/);
});

// ── R11 ─────────────────────────────────────────────────────────────

test('AUDIT POI R11: the decoded pictures are kept to a budget of bytes, the oldest let go - one asked again after it went is decoded again, one kept is not (mutant: kept past the budget)', async () => {
  const [sha, bytes] = await meshAsset(quad());
  const texs = ['1', '2', '3'].map((c) => c.repeat(64));
  const decodes = [];
  const H = hostOver({
    list: texs.map((tx, k) => ({ id: `poi-00000000000${k + 1}`, rev: 1, doc: { ...doc(`poi-00000000000${k + 1}`, { parts: [part('p', sha, [mat({ texture: tx }), mat()])] }), place: { ...doc('x').place, x: 100 + k * 30 } } })),
    assets: new Map([[sha, bytes], ...texs.map((tx) => [tx, new Uint8Array([tx.charCodeAt(0)])])]),
    decodeImage: async (b) => { decodes.push(b[0]); return { width: 4, height: 4, data: new Uint8Array(64) }; }, keepDecodedBytes: 128,
  });
  await H.settle();
  assert.deepEqual(decodes.sort(), [49, 50, 51], 'three pictures, three decodes - 192 bytes against a keep of 128');
  // two new looks: a tint of the first picture (let go: decoded again) and of the third (kept: not)
  H.feed.set([...H.feed.all(), ...[texs[0], texs[2]].map((tx, k) => ({ id: `poi-00000000001${k}`, rev: 1, doc: { ...doc(`poi-00000000001${k}`, { parts: [part('p', sha, [mat({ texture: tx, color: [0.5, 0.5, 0.5, 1] }), mat()])] }), place: { ...doc('x').place, x: 300 + k * 30 } } }))]);
  decodes.length = 0;
  await H.settle();
  assert.deepEqual(decodes, [49], 'the oldest went; the newest was kept');
});

// ── R12 ─────────────────────────────────────────────────────────────

test('AUDIT POI R12: a frame makes nothing it can keep - an empty pixel\'s answer one shared array, a part\'s box and a light\'s row refilled in place (mutants: an array a pixel; a box a frame; a row a frame)', async () => {
  const feed = createPoiFeed({ base: () => null, log: null });
  assert.equal(feed.atPixel(1, 2), feed.atPixel(3, 4), 'one answer for every pixel with none');
  assert.ok(Object.isFrozen(feed.atPixel(1, 2)));
  const [sha, bytes] = await meshAsset(quad());
  const H = hostOver({ list: [{ id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { parts: [part('body', sha, [mat(), mat()])], lights: [{ t: [0, 2, 0], color: [1, 1, 1], radius: 5, intensity: 1, flicker: false }] }) }], assets: new Map([[sha, bytes]]) });
  await H.settle();
  const box = H.host.partOf('poi-000000000001', 'body').box, row = H.host.lights([])[0];
  H.off = [819.2, 0, 0];
  H.host.frame();
  assert.equal(H.host.partOf('poi-000000000001', 'body').box, box, 'the same box');
  assert.equal(r3(box[0]), 1100 + 819.2, 'refilled where it now stands');
  const row2 = H.host.lights([])[0];
  assert.equal(row2, row, 'the same row');
  assert.equal(r3(row2.x), 1100 + 819.2);
  assert.match(src('src/scenes/poiHost.js'), /want\.clear\(\);/);
});

// ── R13, R15, S11: the feed ─────────────────────────────────────────

function service() {
  const svc = { v: 0, pois: [], asks: [], gate: null, stale: null };
  svc.fetch = async (url, init = {}) => {
    svc.asks.push({ url, headers: init.headers ?? {} });
    if (svc.gate) await svc.gate;
    const body = svc.stale ?? { v: svc.v, pois: svc.pois };   // a stale isolate tags its own older version: the tags differ, 200
    const etag = `"poi-${body.v}"`;
    if (init.headers?.['if-none-match'] === etag) return { status: 304, ok: false, headers: { get: () => etag } };
    return { status: 200, ok: true, headers: { get: (k) => (k === 'etag' ? etag : null) }, text: async () => JSON.stringify(body) };
  };
  return svc;
}
const live = (id, rev = 1) => ({ id, rev, doc: doc(id, { parts: [part('body', 'a'.repeat(64), [mat()])] }) });
const memCache = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, b) => { m.set(k, b); } }; };

test('AUDIT POI R13 (C7): a refresh asked while an ask is out is asked again the moment that one answers - the approval it was for is not left a minute (mutant: the refresh dropped)', async () => {
  const svc = service();
  let t = 1000;
  const feed = createPoiFeed({ base: () => 'https://svc.invalid', fetch: svc.fetch, now: () => t, log: null });
  svc.v = 1; svc.pois = [live('poi-000000000001')];
  let open;
  svc.gate = new Promise((res) => { open = res; });
  const out = feed.tick(t);   // the minute's ask, out
  await ticks();
  svc.v = 2; svc.pois = [live('poi-000000000001'), live('poi-000000000002')];   // approved while it was out
  const again = feed.refresh();
  svc.gate = null; open();
  await out;
  await again;
  assert.equal(svc.asks.length, 2, 'asked again');
  assert.deepEqual(feed.atPixel(10, 20).map((e) => e.id), ['poi-000000000001', 'poi-000000000002'], 'the approval stands now');
  assert.equal(feed.tick(t + 10), null, 'and the minute runs from there');
  t += POI_FEED_POLL_MS;
  assert.ok(feed.tick(t) !== null);
});

test('AUDIT POI R15: the version, the tag and the kept copy are their service\'s - another service is asked afresh (no tag of the first sent: its 304 would keep the wrong set) and a kept copy is read back under its own service alone (mutants: the tag kept across services; the kept copy read under any)', async () => {
  const a = service(), b = service();
  let base = 'https://a.invalid';
  const fetch = (u, i) => (u.startsWith('https://a.invalid') ? a.fetch(u, i) : b.fetch(u, i));
  const cache = memCache();
  const feed = createPoiFeed({ base: () => base, fetch, cache, now: () => 0, log: null });
  a.v = 5; a.pois = [live('poi-000000000001')];
  b.v = 5; b.pois = [live('poi-000000000002')];
  await feed.tick(0);
  assert.deepEqual(feed.atPixel(10, 20).map((e) => e.id), ['poi-000000000001']);
  await new Promise((res) => setImmediate(res));
  assert.ok(cache.m.has(POI_FEED_CACHE_KEY));
  base = 'https://b.invalid';   // a stored override moves the service
  await feed.refresh();
  assert.equal(b.asks[0].headers['if-none-match'], undefined, 'the first service\'s tag is not the second\'s');
  assert.deepEqual(feed.atPixel(10, 20).map((e) => e.id), ['poi-000000000002'], 'the second\'s own set');
  await new Promise((res) => setImmediate(res));
  // a start under the first again, without the network: the kept copy is the second's, not the first's
  const off = createPoiFeed({ base: () => 'https://a.invalid', fetch: async () => { throw new Error('offline'); }, cache, now: () => 0, log: null });
  await off.start();
  assert.deepEqual(off.atPixel(10, 20), [], 'another service\'s kept set is not stood');
  const same = createPoiFeed({ base: () => 'https://b.invalid', fetch: async () => { throw new Error('offline'); }, cache, now: () => 0, log: null });
  await same.start();
  assert.deepEqual(same.atPixel(10, 20).map((e) => e.id), ['poi-000000000002'], 'its own, read back');
});

test('AUDIT POI S11 (the client\'s half): an answer older than one already taken - a stale isolate\'s - is not taken, the approval it would take down stands; a newer one is (mutant: any answer taken)', async () => {
  const svc = service();
  let t = 0;
  const feed = createPoiFeed({ base: () => 'https://svc.invalid', fetch: svc.fetch, now: () => t, log: null });
  svc.v = 3; svc.pois = [live('poi-000000000001'), live('poi-000000000002')];
  await feed.tick(t);
  svc.stale = { v: 2, pois: [live('poi-000000000001')] };   // an isolate still keeping the feed before the approval
  t += POI_FEED_POLL_MS; await feed.tick(t);
  assert.deepEqual(feed.atPixel(10, 20).map((e) => e.id), ['poi-000000000001', 'poi-000000000002'], 'the stale answer not taken');
  assert.equal(feed.version(), 3);
  svc.stale = null; svc.v = 4; svc.pois = [live('poi-000000000002')];
  t += POI_FEED_POLL_MS; await feed.tick(t);
  assert.deepEqual(feed.atPixel(10, 20).map((e) => e.id), ['poi-000000000002'], 'a newer one is');
});
