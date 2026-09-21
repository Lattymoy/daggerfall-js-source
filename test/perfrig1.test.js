// PERF-RIG1 + PERF-ZONE2 (2026-09-21, Mac: "continue looking into fixing
// exterior performance issues"). PERF-TOWN1 left `world` as the other
// spiky CPU zone (2.25 -> 8.51 ms). Reading what that zone covers found
// the Morrowind rig's whole geometry pipeline running on the CPU every
// frame for every body in view - the player's arm, the third-person body,
// and each peer's: poseAssembly skins every vertex (mwSkin.skinBatch),
// then packFpArm de-indexes every triangle into the character stream.
// Measured on the fixture rig inflated to 3,006 vertices, ONE skin call
// minted ~156 KB of typed-array garbage (`acc`, `wsum`, `touched`, two
// scratches and an affine per bone, all reallocated per call - and none
// of it visible to the heap meter, because backing stores are off-heap),
// and the pack built three small arrays PER CORNER (`[a, b, c]`, a
// diffuse triple, an emissive triple) - ten thousand a frame for one
// body. The skin loop keeps its accumulators on the batch now, and the
// pack keeps each piece's eight static floats a corner in a lane buffer
// on the piece and mints nothing per vertex. After: 0.8 KB per skin call,
// the pack a third faster, every value written bit-for-bit the one it was.
//
// The pins here are about BIT-IDENTITY and NOT MINTING, never speed (the
// PERF-TOWN1/STREAM1 law). The pre-change code is transcribed below as
// the reference: what it computed is the specification.
//
// PERF-ZONE2: the `world` CPU zone was three spans the renderer's own
// 'world' mark and the sky's swallowed - the bodies, the far ring and
// the water, and everything from the grass to the HUD's first quad. Five
// marks name them now, so the next `?perf=cpu` line says which.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif, diffuseAt, emissiveAt, mat33Mul, mat33Apply } from '../src/formats/mwNifMesh.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinToSkelMatrix, skinBatch, accumRootRef } from '../src/formats/mwSkin.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { packFpArm, FP_FLOATS } from '../src/combat/fpArm.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ANIMATED = f('animated.nif');

// ---- the pre-change skinBatch, verbatim in its arithmetic (mwSkin.js before PERF-RIG1)
function affineFromRef(rotation, translation, scale) {
  const a = new Float32Array(9);
  for (let i = 0; i < 9; i++) a[i] = rotation[i] * scale;
  return { a, t: [translation[0], translation[1], translation[2]] };
}
function affineMulRef(p, l) {
  const a = new Float32Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) a[r * 3 + c] = p.a[r * 3] * l.a[c] + p.a[r * 3 + 1] * l.a[3 + c] + p.a[r * 3 + 2] * l.a[6 + c];
  return { a, t: [
    p.a[0] * l.t[0] + p.a[1] * l.t[1] + p.a[2] * l.t[2] + p.t[0],
    p.a[3] * l.t[0] + p.a[4] * l.t[1] + p.a[5] * l.t[2] + p.t[1],
    p.a[6] * l.t[0] + p.a[7] * l.t[1] + p.a[8] * l.t[2] + p.t[2],
  ] };
}
function skinBatchRef(batch, skeleton, pose, skelMats, positionsOut) {
  const skin = batch.skin;
  let post = affineMulRef(affineFromRef(skin.transform.rotation, skin.transform.translation, skin.transform.scale), skinToSkelMatrix(skeleton, pose, skin.skeletonRoot, skin.rootBone));
  if (skin.shapeTransform) { const st = skin.shapeTransform; post = affineMulRef(affineFromRef(st.rotation, st.translation, st.scale), post); }
  const n = batch.positions.length / 3;
  const acc = new Float32Array(n * 12); const wsum = new Float32Array(n); const touched = new Uint8Array(n);
  for (const bone of skin.bones) {
    if (bone.ref == null) { for (let k = 0; k < bone.indices.length; k++) touched[bone.indices[k]] = 1; continue; }
    const m = affineMulRef(skelMats.get(bone.ref), bone.invBind);
    for (let k = 0; k < bone.indices.length; k++) {
      const v = bone.indices[k]; const w = bone.weights[k]; const o = v * 12;
      for (let i = 0; i < 9; i++) acc[o + i] += m.a[i] * w;
      acc[o + 9] += m.t[0] * w; acc[o + 10] += m.t[1] * w; acc[o + 11] += m.t[2] * w;
      wsum[v] += w; touched[v] = 1;
    }
  }
  const collapse = new Float32Array(12); collapse[9] = post.t[0]; collapse[10] = post.t[1]; collapse[11] = post.t[2];
  const composed = new Float32Array(12); const pa = post.a; const pt = post.t;
  const composePost = (o) => {
    for (let c = 0; c < 3; c++) { const x = acc[o + c]; const y = acc[o + 3 + c]; const z = acc[o + 6 + c]; composed[c] = pa[0] * x + pa[1] * y + pa[2] * z; composed[3 + c] = pa[3] * x + pa[4] * y + pa[5] * z; composed[6 + c] = pa[6] * x + pa[7] * y + pa[8] * z; }
    const tx = acc[o + 9]; const ty = acc[o + 10]; const tz = acc[o + 11];
    composed[9] = pa[0] * tx + pa[1] * ty + pa[2] * tz + pt[0]; composed[10] = pa[3] * tx + pa[4] * ty + pa[5] * tz + pt[1]; composed[11] = pa[6] * tx + pa[7] * ty + pa[8] * tz + pt[2];
    return composed;
  };
  for (let v = 0; v < n; v++) {
    const o = v * 12; const a = wsum[v] > 0 ? composePost(o) : touched[v] ? collapse : null;
    const x = batch.positions[v * 3]; const y = batch.positions[v * 3 + 1]; const z = batch.positions[v * 3 + 2];
    if (a) { positionsOut[v * 3] = a[0] * x + a[1] * y + a[2] * z + a[9]; positionsOut[v * 3 + 1] = a[3] * x + a[4] * y + a[5] * z + a[10]; positionsOut[v * 3 + 2] = a[6] * x + a[7] * y + a[8] * z + a[11]; }
    else { positionsOut[v * 3] = x; positionsOut[v * 3 + 1] = y; positionsOut[v * 3 + 2] = z; }
  }
}

// ---- the pre-change packFpArm, verbatim in its arithmetic (fpArm.js before PERF-RIG1)
function packRef(pieces) {
  let tris = 0; for (const p of pieces) tris += (p.indices ? p.indices.length : 0) / 3;
  const buf = new Float32Array(tris * 3 * FP_FLOATS); const ranges = []; let o = 0; let first = 0;
  for (const p of pieces) {
    const pos = p.positions; const idx = p.indices; if (!pos || !idx) continue;
    const uvs = p.uvs || null; const cols = p.colors || null; const mat = p.material || null; const flip = p.mirrored ? -1 : 1;
    const textured = !!(uvs && p.material && p.material.textureFile);
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a]; const uy = pos[b + 1] - pos[a + 1]; const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a]; const vy = pos[c + 1] - pos[a + 1]; const vz = pos[c + 2] - pos[a + 2];
      let nx = (uy * vz - uz * vy) * flip; let ny = (uz * vx - ux * vz) * flip; let nz = (ux * vy - uy * vx) * flip;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-8) { nx /= len; ny /= len; nz /= len; } else { nx = 0; ny = 1; nz = 0; }
      for (let k = 0; k < 3; k++) {
        const v = [a, b, c][k]; const vi = idx[i + k] * 2;
        buf[o++] = pos[v]; buf[o++] = pos[v + 1]; buf[o++] = pos[v + 2];
        const [dr, dg, db] = diffuseAt(mat, cols, idx[i + k]); buf[o++] = dr; buf[o++] = dg; buf[o++] = db;
        buf[o++] = nx; buf[o++] = ny; buf[o++] = nz;
        buf[o++] = uvs ? uvs[vi] : 0; buf[o++] = uvs ? uvs[vi + 1] : 0;
        const [er, eg, eb] = emissiveAt(mat, cols, idx[i + k]); buf[o++] = er; buf[o++] = eg; buf[o++] = eb;
      }
    }
    const count = (idx.length / 3) * 3;
    ranges.push({ first, count, slot: p.slot, piece: p, textureFile: textured ? p.material.textureFile : null, tex: null, hidden: false });
    first += count;
  }
  return { packed: buf, ranges };
}

/** Count typed arrays constructed while fn runs (the globals are what the modules resolve at call time). */
function countTyped(fn) {
  const names = ['Float32Array', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int16Array', 'Float64Array'];
  const real = Object.fromEntries(names.map((n) => [n, globalThis[n]]));
  let arrays = 0, bytes = 0;
  for (const n of names) globalThis[n] = new Proxy(real[n], { construct(t, args) { const a = new t(...args); arrays++; bytes += a.byteLength; return a; } });
  try { fn(); } finally { for (const n of names) globalThis[n] = real[n]; }
  return { arrays, bytes };
}

const bits = (fa) => Array.from(new Uint32Array(fa.buffer, fa.byteOffset, fa.length));

async function fixtureArm() {
  const arm = await assembleFirstPersonArm({ skeletonBytes: f('armskel.nif'), parts: [{ slot: 'hand', bytes: f('armhand.nif') }, { slot: 'upperarm', bytes: f('armcuff.nif') }] });
  const tracks = extractTracks(parseNif(f('armidle.kf')));
  return { arm, tracks, accumRoot: accumRootRef(arm.skeleton, tracks) };
}

test('PERF-RIG1a skinBatch: bit-for-bit the pre-change arithmetic, at several poses, across repeated calls', () => {
  const nif = parseNif(ANIMATED);
  const batch = flattenNif(nif).find((b) => b.skinned);
  const skeleton = buildSkeleton(nif);
  const tracks = extractTracks(nif);
  for (const t of [0, 0.4, 1.5, 2.2, 0.4]) {
    const pose = poseSkeleton(skeleton, tracks, sampleTrack, t);
    const mats = skeletonSpaceMatrices(skeleton, pose, batch.skin.skeletonRoot);
    const got = new Float32Array(batch.positions.length); const want = new Float32Array(batch.positions.length);
    skinBatch(batch, skeleton, pose, mats, got, null);
    skinBatchRef(batch, skeleton, pose, mats, want);
    assert.deepEqual(bits(got), bits(want), `time ${t}: every float is the one the old loop wrote`);
  }
});

test('PERF-RIG1b skinBatch: the accumulators are the batch\'s - made once, zeroed per call, and the second call mints no typed array', () => {
  const nif = parseNif(ANIMATED);
  const batch = flattenNif(nif).find((b) => b.skinned);
  const skeleton = buildSkeleton(nif);
  const tracks = extractTracks(nif);
  const pose = poseSkeleton(skeleton, tracks, sampleTrack, 1.5);
  const mats = skeletonSpaceMatrices(skeleton, pose, batch.skin.skeletonRoot);
  const out = new Float32Array(batch.positions.length);
  skinBatch(batch, skeleton, pose, mats, out, null);
  const sc = batch._skinScratch;
  assert.ok(sc && sc.acc.length === batch.positions.length * 4 && sc.n === batch.positions.length / 3, 'the scratch sits on the batch, sized to it');
  const first = bits(out);
  const counted = countTyped(() => skinBatch(batch, skeleton, pose, mats, out, null));
  // What is left is `post` - the skin transform composed with the
  // skin-to-skeleton chain, a handful of 9-float affines per PIECE per
  // frame, which follow the pose and cannot be cached. Nothing sized to
  // the mesh: the old loop made 12 floats a vertex here.
  assert.ok(counted.bytes <= 512, `the frame path constructs nothing sized to the mesh (${counted.arrays} arrays, ${counted.bytes} bytes; the old loop made ${batch.positions.length * 4 * 4 + batch.positions.length / 3 * 5} +)`);
  assert.equal(batch._skinScratch, sc, 'the same scratch');
  assert.deepEqual(bits(out), first, 'and the answer is the same - the accumulators were zeroed, not carried');
  // the null-skeleton door (MW-D31's pin) still stands on the scratch path
  const bare = { positions: new Float32Array([0, 0, 0]), normals: null, skin: { transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [2, 0, 0], scale: 1 }, shapeTransform: null, skeletonRoot: -1, rootBone: -1, bones: [{ ref: 7, indices: new Uint16Array([0]), weights: new Float32Array([0.5]), invBind: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] } }] } };
  const o3 = new Float32Array(3);
  skinBatch(bare, null, null, { get: () => ({ a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }) }, o3, null);
  assert.ok(Math.abs(o3[0] - 2) < 1e-6);
});

test('PERF-RIG1c packFpArm: bit-for-bit the pre-change stream on the posed fixture arm, mirrored pieces included, and again after a re-pose', async () => {
  const { arm, tracks, accumRoot } = await fixtureArm();
  assert.ok(arm.pieces.some((p) => p.mirrored), 'the fixture carries a mirrored piece');
  let out = null;
  for (const t of [0.5, 2.0]) {
    poseAssembly(arm, { tracks, sampleTrack, time: t, accumRoot });
    out = packFpArm(arm.pieces, out);
    const ref = packRef(arm.pieces);
    assert.equal(out.packed.length, ref.packed.length);
    assert.deepEqual(bits(out.packed), bits(ref.packed), `time ${t}: every float the old pack wrote`);
    assert.deepEqual(out.ranges.map((r) => [r.first, r.count, r.slot, r.textureFile, r.piece === arm.pieces[arm.pieces.indexOf(r.piece)]]),
      ref.ranges.map((r) => [r.first, r.count, r.slot, r.textureFile, true]));
  }
});

test('PERF-RIG1d packFpArm: the frame path mints no typed array, the lanes are the piece\'s and follow its colours, the ranges keep their identity and follow the pieces', async () => {
  const { arm, tracks, accumRoot } = await fixtureArm();
  poseAssembly(arm, { tracks, sampleTrack, time: 1.0, accumRoot });
  const first = packFpArm(arm.pieces);
  const counted = countTyped(() => packFpArm(arm.pieces, first));
  assert.equal(counted.arrays, 0, `a warm pack constructs no typed array (${counted.arrays})`);
  const again = packFpArm(arm.pieces, first);
  assert.equal(again.packed, first.packed, 'the buffer is written in place');
  assert.equal(again.ranges, first.ranges, 'THE SAME RANGE OBJECTS come back - the mesh hung its textures on them');
  // the lanes are keyed on what they were read from: a piece handed new
  // colours (a wardrobe rebuild) packs the new colours, not the cached
  const p = arm.pieces.find((q) => q.indices && q.indices.length);
  const lanes0 = p._packLanes.lanes;
  const cols = new Float32Array((p.positions.length / 3) * 4).fill(0.25);
  const withCols = { ...p, colors: cols, material: { ...(p.material ?? {}), vertexColorMode: 1, diffuse: [1, 1, 1], emissive: [0, 0, 0] } };
  const swapped = arm.pieces.map((q) => (q === p ? withCols : q));
  const out2 = packFpArm(swapped, again);
  assert.notEqual(out2.ranges, first.ranges, 'a piece swapped out is a new range list');
  assert.deepEqual(bits(out2.packed), bits(packRef(swapped).packed), 'and the stream is the old pack\'s for the new pieces');
  assert.notEqual(withCols._packLanes.lanes, lanes0, 'new lanes for a new piece');
  const out3 = packFpArm(swapped, out2);
  assert.equal(out3.ranges, out2.ranges, 'and they hold from there');
  // a piece whose colours array is REPLACED in place refreshes its lanes
  const before = p._packLanes;
  p.colors = new Float32Array((p.positions.length / 3) * 4).fill(0.5);
  packFpArm(arm.pieces, first);
  assert.notEqual(p._packLanes, before, 'the lane key saw the new colours');
});

test('PERF-RIG1e the minting law by content: the skin loop allocates only through its scratch, and the pack\'s triangle loop constructs nothing and reads the colour laws only when building lanes (derived)', () => {
  const skin = rd('src/formats/mwSkin.js');
  const body = skin.slice(skin.indexOf('export function skinBatch('), skin.indexOf('\n}\n', skin.indexOf('export function skinBatch(')));
  assert.doesNotMatch(body, /new (Float32Array|Uint8Array|Uint16Array|Array)\(/, 'no typed array is constructed in skinBatch itself');
  assert.match(body, /const sc = skinScratch\(batch, n\);/);
  for (const v of ['acc', 'wsum', 'touched']) assert.match(body, new RegExp(`const ${v} = sc\\.${v}; ${v}\\.fill\\(0\\);`), `${v} is zeroed, not replaced`);
  assert.match(body, /affineMulInto\(skelMats\.get\(bone\.ref\), bone\.invBind, boneMat\)/);
  const arm = rd('src/combat/fpArm.js');
  const pack = arm.slice(arm.indexOf('export function packFpArm('), arm.indexOf('\n}\n', arm.indexOf('export function packFpArm(')));
  const loop = pack.slice(pack.indexOf('for (const p of pieces) {'));
  assert.doesNotMatch(loop, /\bnew\b/, 'the pack loop constructs nothing');
  assert.doesNotMatch(loop, /\[a, b, c\]/, 'no per-corner index array');
  assert.doesNotMatch(loop, /diffuseAt\(|emissiveAt\(/, 'the colour laws are read when the lanes are built, not per frame');
  const lanesFn = arm.slice(arm.indexOf('function pieceLanes('), arm.indexOf('\n}\n', arm.indexOf('function pieceLanes(')));
  assert.match(lanesFn, /diffuseAt\(mat, cols, idx\[i\]\)/); assert.match(lanesFn, /emissiveAt\(mat, cols, idx\[i\]\)/);
  assert.match(lanesFn, /have\.idx === idx && have\.uvs === uvs && have\.cols === cols && have\.mat === mat/, 'keyed on every array the lanes are read from');
  // the whole file: every diffuseAt/emissiveAt call site is inside pieceLanes
  const sites = [...arm.matchAll(/(diffuseAt|emissiveAt)\(/g)].map((m) => m.index).filter((i) => !/import/.test(arm.slice(arm.lastIndexOf('\n', i), i)));
  const lo = arm.indexOf('function pieceLanes('), hi = lo + lanesFn.length;
  assert.ok(sites.length === 2 && sites.every((i) => i > lo && i < hi), 'ONE HOME for the colour law in this file');
});

test('PERF-ZONE2 the world frame\'s CPU zones tile in order, and each new mark sits on its subject', () => {
  const w = rd('src/scenes/world.js');
  const frame = w.slice(w.indexOf('  function frame(now) {'));
  const names = [...frame.matchAll(/meterFor\(renderer\.gl\)\?\.markCpu\('(\w+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(names, ['online', 'sim', 'bodies', 'batches', 'ring', 'flats', 'people', 'arrows', 'rig', 'hud']);
  const after = (mark, subject) => { const i = frame.indexOf(`markCpu('${mark}')`); const j = frame.indexOf(subject, i); assert.ok(i > 0 && j > i && j - i < 600, `${mark} sits directly on ${subject}`); };
  const before = (subject, mark) => { const j = frame.indexOf(subject); const i = frame.indexOf(`markCpu('${mark}')`, j); assert.ok(j > 0 && i > j && i - j < 400, `${mark} follows ${subject}`); };
  before('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);', 'bodies');
  after('bodies', 'mwViewDrawBody(canvas,');
  before('sky.draw(cam.yaw, cam.pitch, fieldOfView(), worldAspect,', 'ring');
  after('arrows', 'arrows.update(dt, {');
  after('rig', 'if (walkMode && playerSpawned) {');
  { const i = frame.indexOf("markCpu('rig')"); const j = frame.indexOf('weaponRig.frame(dt, { paralyzed })', i); const k = frame.indexOf("markCpu('hud')", i); assert.ok(j > i && j < k, 'the rig\'s frame is inside the rig span'); }
  after('hud', 'const _hfw = [-view[2], -view[10]];');
  { const i = frame.indexOf("markCpu('hud')"); const j = frame.indexOf('drawHud(renderer, canvas, hudArt, playerEntity,', i); const next = frame.indexOf('markCpu(', i + 1); assert.ok(j > i && (next < 0 || j < next), 'the HUD draw is inside the hud span - no other mark between'); }
});
