// POI-2 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE APPROVED POIS, STANDING IN THE GAME.
// Mac: "POI Tool (General Map Editor) ... even placement onto our actual map"; "I need to be able to approve changes".
//   - the renderer's own new reach (render/meshAlpha.js): a translucent mesh draw, and a texture's wrap per axis and
//     filter - run on a recording GL, the shader's law on the GLSL evaluator;
//   - the runtime's arithmetic (poi/poiRuntime.js): looks, the pictures baked, the models, the matrices;
//   - the feed (poi/poiFeed.js): ETag'd asks, the law again, the kept copy, assets checked by their hash;
//   - the host (scenes/poiHost.js): a POI stood on its built pixel, on its ground, collided (never round a body), drawn
//     opaque and translucent, lit, moved without a reload, taken down and its textures let go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Renderer } from '../../src/render/renderer.js';
import { EL_MESH_FS } from '../../src/render/enhancedLighting.js';
import { MESH_ALPHA_GLSL, samplerParams, samplerKey } from '../../src/render/meshAlpha.js';
import { glslFunctions } from '../glsl.mjs';
import {
  POI_TEXTURE_ARCHIVE, materialLook, createTextureBook, bakeAlbedo, bakeEmission, poiPartModels, placeMatrix, partMatrix,
  boxThrough, lightsOf, xform,
} from '../../src/poi/poiRuntime.js';
import { mat4FromQuatPosScale } from '../../src/world/quat.js';
const trsQuat = (t, q, s) => mat4FromQuatPosScale(q, t, s);
import { createPoiFeed, POI_FEED_POLL_MS, POI_FEED_CACHE_KEY } from '../../src/poi/poiFeed.js';
import { createPoiHost, sameBuild, POI_RETRY_MS, rayBox, rayTriangles } from '../../src/scenes/poiHost.js';
import { encodePoiMesh } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL } from '../../src/poi/poiLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A GL that records every call and gives every constant a number of its own (so a wrap mode is told from another). */
function recordingGl() {
  let ids = 0;
  const log = [];
  const consts = new Map();
  const sources = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'getParameter') return () => new Float32Array(4);
      if (k === 'shaderSource') return (_s, text) => sources.push(text);
      if (k.startsWith('create')) return () => ({ id: ++ids });
      if (k.toUpperCase() === k) { if (!consts.has(k)) consts.set(k, 5000 + consts.size); return consts.get(k); }
      return (...a) => { log.push([k, ...a]); };
    },
  });
  return { gl, log, sources, C: (k) => gl[k], canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

// ── THE RENDERER'S NEW REACH ────────────────────────────────────────

test('POI-2 RENDERER: a translucent draw blends straight alpha over, tests depth and writes none, casts no shadow, and puts every bit of its state back; an opaque draw is untouched (mutants: the depth written; the state left; the shadow cast)', () => {
  const { canvas, log } = recordingGl();
  const r = new Renderer(canvas);
  r.textures.set('1_1', { id: 't' });
  const mesh = r.createMesh({ positions: new Float32Array(9), normals: new Float32Array(9), uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] });
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  let shadowed = 0;
  r._shadows = { recordMesh: () => { shadowed++; } };   // a shadow pass installed: _casting answers true
  log.length = 0;
  r.drawMesh(mesh, I, null, { translucent: 0.5 });
  const calls = log.map((c) => c[0]);
  const at = (name, ...args) => log.findIndex((c) => c[0] === name && args.every((a, i) => c[i + 1] === a));
  const blendOn = at('enable', r.gl.BLEND), draw = calls.indexOf('drawElements'), blendOff = at('disable', r.gl.BLEND);
  assert.ok(blendOn >= 0 && blendOn < draw && draw < blendOff, 'blending brackets the draw');
  assert.ok(at('blendFuncSeparate', r.gl.SRC_ALPHA, r.gl.ONE_MINUS_SRC_ALPHA, r.gl.ONE, r.gl.ONE_MINUS_SRC_ALPHA) >= 0 && at('blendFuncSeparate') < draw);
  assert.ok(at('depthMask', false) < draw && at('depthMask', true) > draw, 'depth tested, never written, then written again');
  assert.ok(at('uniform1f', 'uMeshAlpha', 0.5) < draw && at('uniform1f', 'uMeshAlpha', 0) > draw, 'its share, then nought again');
  assert.equal(shadowed, 0, 'a pane casts no shadow');
  log.length = 0;
  r.drawMesh(mesh, I, null);
  assert.equal(log.filter((c) => c[0] === 'enable' && c[1] === r.gl.BLEND).length, 0, 'an opaque draw blends nothing');
  assert.equal(log.filter((c) => c[0] === 'uniform1f' && c[1] === 'uMeshAlpha').length, 0);
  assert.equal(shadowed, 1, 'and casts its shadow as ever');
});

test('POI-2 RENDERER: a texture\'s own sampler - a wrap per axis (repeat, clamp, mirror) and its filter (nearest\'s mips nearest, linear\'s trilinear) - keyed apart from the same picture under another; its emission map keyed and sampled with it (mutants: the sampler unkeyed; one wrap for both axes)', () => {
  const { canvas, log, C } = recordingGl();
  const r = new Renderer(canvas);
  const pic = { width: 1, height: 1, colors: new Uint8Array([255, 255, 255, 255]) };
  log.length = 0;
  r.uploadTexture(600000, 3, pic, { sampler: { wrapS: 'mirror', wrapT: 'clamp', filter: 'linear' } });
  const params = log.filter((c) => c[0] === 'texParameteri').map((c) => [c[2], c[3]]);
  assert.deepEqual(params.find(([p]) => p === C('TEXTURE_WRAP_S')), [C('TEXTURE_WRAP_S'), C('MIRRORED_REPEAT')]);
  assert.deepEqual(params.find(([p]) => p === C('TEXTURE_WRAP_T')), [C('TEXTURE_WRAP_T'), C('CLAMP_TO_EDGE')]);
  assert.deepEqual(params.find(([p]) => p === C('TEXTURE_MIN_FILTER')), [C('TEXTURE_MIN_FILTER'), C('LINEAR_MIPMAP_LINEAR')]);
  assert.deepEqual(params.find(([p]) => p === C('TEXTURE_MAG_FILTER')), [C('TEXTURE_MAG_FILTER'), C('LINEAR')]);
  assert.ok(r.textures.has('600000_3#s:mirror,clamp,linear'));
  r.uploadTexture(600000, 3, pic, { sampler: { wrapS: 'repeat', wrapT: 'repeat', filter: 'nearest' } });
  assert.ok(r.textures.has('600000_3#s:repeat,repeat,nearest'), 'the same picture under another sampler is another texture');
  r.uploadEmissionTexture(600000, 3, pic, { white: true, sampler: { wrapS: 'mirror', wrapT: 'clamp', filter: 'linear' } });
  assert.ok(r.emissionTextures.has('600000_3#s:mirror,clamp,linear'), 'the emission map under its albedo\'s resolved key');
  assert.equal(samplerKey({}), '#s:repeat,repeat,nearest');
  const p = samplerParams(r.gl, { filter: 'nearest' }, true);
  assert.equal(p.min, C('NEAREST_MIPMAP_NEAREST'));
  assert.equal(samplerParams(r.gl, { filter: 'linear' }, false).min, C('LINEAR'));
});

test('POI-2 SHADER: both mesh programs end on the translucency - alpha one for the opaque world (nought, the uniform\'s own start), the texel\'s alpha times the share in a translucent draw (mutants: the alpha always one; the share unread)', () => {
  const fns = glslFunctions(MESH_ALPHA_GLSL, { uMeshAlpha: 0 });
  assert.equal(fns.meshAlphaOf(0.25), 1);
  fns.globals.uMeshAlpha = 0.5;
  assert.equal(fns.meshAlphaOf(0.25), 0.125);
  assert.match(EL_MESH_FS, /uniform float uMeshAlpha;/);
  assert.match(EL_MESH_FS, /outColor = vec4\(elFinish\(lit \+ emission, vWorldPos\), meshAlphaOf\(tex\.a\)\);/);
  const { canvas, sources } = recordingGl();
  void new Renderer(canvas);
  const classic = sources.find((s) => s.includes('meshAlphaOf(tex.a)') && s.includes('dwWaterFog(mix(uFogColor, lit + emission'));
  assert.ok(classic, 'the classic mesh program compiles with it');
  assert.match(classic, /uniform float uMeshAlpha;/);
});

// ── THE RUNTIME'S ARITHMETIC ────────────────────────────────────────

const mat = (over = {}) => ({ ...DEFAULT_MATERIAL, ...over });
/** A 2x1 picture, top row first: red, then green-and-half-transparent. */
const PIC = { width: 1, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]) };

test('POI-2 LOOKS AND PICTURES: two materials alike share a look, any drawn difference parts them; the albedo turned to color32 order and tinted; a cutout thresholded at ITS cutoff, a blend\'s alpha kept times the tint\'s, an opaque one opaque; the emission its picture times its colour, clamped (mutants: the rows unturned; the cutoff a half; the tint unread)', () => {
  assert.equal(materialLook(mat()), materialLook(mat({ uv: { offset: [1, 0], scale: [1, 1], rotation: 0 }, twoSided: true })), 'the UVs and the sides are the mesh\'s');
  for (const over of [{ color: [0.5, 1, 1, 1] }, { alpha: 'cutout' }, { wrap: ['clamp', 'repeat'] }, { filter: 'nearest' }, { emissiveColor: [1, 0, 0] }, { texture: 'a'.repeat(64) }]) {
    assert.notEqual(materialLook(mat(over)), materialLook(mat()), JSON.stringify(over));
  }
  const book = createTextureBook();
  assert.equal(book.recordOf('x'), 0); assert.equal(book.recordOf('y'), 1); assert.equal(book.recordOf('x'), 0);

  const op = bakeAlbedo(PIC, mat({ color: [0.5, 1, 1, 1] }));
  assert.deepEqual([...op.colors], [0, 255, 0, 255, 128, 0, 0, 255], 'row 0 the bottom (green), red tinted to half; opaque');
  const cut = bakeAlbedo(PIC, mat({ alpha: 'cutout', cutoff: 0.6 }));
  assert.deepEqual([cut.colors[3], cut.colors[7]], [0, 255], '0.5 under its 0.6 cut, gone');
  assert.deepEqual([bakeAlbedo(PIC, mat({ alpha: 'cutout', cutoff: 0.4 })).colors[3]], [255]);
  const blend = bakeAlbedo(PIC, mat({ alpha: 'blend', color: [1, 1, 1, 0.5] }));
  assert.deepEqual([blend.colors[3], blend.colors[7]], [64, 128]);
  assert.deepEqual([...bakeAlbedo(null, mat({ color: [0.2, 0.4, 0.6, 1] })).colors], [51, 102, 153, 255], 'a plain colour, one texel');
  assert.equal(bakeEmission(PIC, mat(), PIC), null, 'nothing to emit');
  assert.deepEqual([...bakeEmission(PIC, mat({ emissive: 'b'.repeat(64), emissiveColor: [2, 0.5, 0] }), PIC).colors], [0, 128, 0, 255, 255, 0, 0, 255], 'times its colour, clamped at one, rows turned');
  assert.deepEqual([...bakeEmission(null, mat({ emissiveColor: [1, 0, 0] }), { width: 1, height: 1 }).colors], [255, 0, 0, 255]);
});

/** A quad in two submeshes (the poi1 test's), and a glTF-style UV down from the top. */
const quad = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  submeshes: [{ start: 0, count: 3 }, { start: 3, count: 3 }],
});

test('POI-2 MODELS: a part\'s mesh as createMesh takes it - v turned to the renderer\'s (1 - v), the material\'s UV transform first; a two-sided material\'s faces doubled back on their own vertices, normals turned; blended submeshes in a model of their own; a mirroring part wound back; every submesh the record of its look (mutants: v unturned; the back faces unwound; a blend drawn opaque; the mirror unwound)', () => {
  const book = createTextureBook();
  const recordOf = (m) => book.recordOf(materialLook(m));
  const a = mat(), b = mat({ alpha: 'blend' });
  const { opaque, translucent } = poiPartModels(quad(), [a, b], recordOf);
  assert.deepEqual([...opaque.indices], [0, 1, 2]);
  assert.deepEqual([...opaque.uvs], [0, 0, 1, 0, 1, 1], 'v turned: (0,1) -> (0,0)');
  assert.deepEqual(opaque.subMeshes, [{ textureArchive: POI_TEXTURE_ARCHIVE, textureRecord: 0, startIndex: 0, primitiveCount: 1 }]);
  assert.deepEqual(translucent.subMeshes.map((s) => s.textureRecord), [1]);
  assert.equal(translucent.positions.length, 9, 'its own vertices');

  const two = poiPartModels(quad(), [mat({ twoSided: true, uv: { offset: [0.5, 0], scale: [2, 1], rotation: 0 } }), a], recordOf).opaque;
  assert.equal(two.indices.length, 3 * 3, 'one face, doubled, and the second submesh\'s');
  const corner = (i) => [two.positions[i * 3], two.positions[i * 3 + 1], two.positions[i * 3 + 2]].join(',');
  assert.deepEqual([...two.indices.subarray(0, 3)].map(corner), ['0,0,0', '1,0,0', '1,1,0'], 'the front face as stored');
  assert.deepEqual([...two.indices.subarray(3, 6)].map(corner), ['0,0,0', '1,1,0', '1,0,0'], 'the back face wound back');
  assert.ok([...two.indices.subarray(3, 6)].every((i) => i >= 3), 'on vertices of its own');
  assert.deepEqual([...two.normals.subarray(9, 12)], [0, 0, 1], 'their normals turned');
  assert.deepEqual([...two.uvs.subarray(0, 2)], [0.5, 0], 'u * 2 + 0.5, then v turned');
  const mirrored = poiPartModels(quad(), [a, a], recordOf, { mirrored: true }).opaque;
  const mc = (i) => [mirrored.positions[i * 3], mirrored.positions[i * 3 + 1], mirrored.positions[i * 3 + 2]].join(',');
  assert.deepEqual([...mirrored.indices.subarray(0, 3)].map(mc), ['0,0,0', '1,1,0', '1,0,0'], 'wound back');
});

test('POI-2 MATRICES: the place in its pixel\'s frame (east x, north z, its height, its turn, its size), a part\'s transform after it; boxes through a matrix; lights through the place, their range with its size', () => {
  const q90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];   // 90 degrees about +Y
  const place = { px: 1, py: 2, x: 100, z: 200, y: 0, ground: 'snap', r: q90, s: 2 };
  const P = placeMatrix(place, 5);
  assert.deepEqual(xform(P, [0, 0, 0]).map(r6), [100, 5, 200]);
  assert.deepEqual(xform(P, [1, 0, 0]).map(r6), [100, 5, 198], 'turned and doubled: +x to -z');
  const M = partMatrix(P, { t: [0, 1, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
  assert.deepEqual(xform(M, [0, 0, 0]).map(r6), [100, 7, 200], 'the part\'s metre up, doubled by the place');
  const box = boxThrough(trsQuat([10, 0, 0], [0, 0, 0, 1], [1, 2, 1]), [-1, 0, -1], [1, 1, 1]);
  assert.deepEqual(box, { min: [9, 0, -1], max: [11, 2, 1] });
  const L = lightsOf({ place, lights: [{ t: [1, 0, 0], color: [1, 0.5, 0], radius: 4, intensity: 2, flicker: true }] }, P);
  assert.deepEqual(L[0].at.map(r6), [100, 5, 198]);
  assert.equal(L[0].range, 8);
  assert.deepEqual(L[0].color, [2, 1, 0]);
});

// ── THE FEED ────────────────────────────────────────────────────────

const doc = (id, { px = 10, py = 20, name = 'Tower', mesh = 'a'.repeat(64), parts = null, lights = [] } = {}) => ({
  v: 1, id, name, place: { px, py, x: 100, z: 100, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 },
  parts: parts ?? [{ key: 'body', mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [mat(), mat({ alpha: 'blend', color: [1, 1, 1, 0.5] })] }],
  lights, marker: { show: true, label: name },
});

/** A fake account service: the feed at a version, its ETag, the assets by hash. */
function fakeService() {
  const svc = { v: 0, pois: [], assets: new Map(), asks: [], down: false };
  svc.fetch = async (url, init = {}) => {
    svc.asks.push({ url, headers: init.headers ?? {} });
    if (svc.down) throw new Error('offline');
    const path = new URL(url).pathname;
    if (path === '/v1/poi/live') {
      const etag = `"poi-${svc.v}"`;
      if (init.headers?.['if-none-match'] === etag) return { status: 304, ok: false, headers: { get: () => etag } };
      return { status: 200, ok: true, headers: { get: (k) => (k === 'etag' ? etag : null) }, text: async () => JSON.stringify({ v: svc.v, pois: svc.pois }) };
    }
    const sha = path.split('/').pop();
    const bytes = svc.assets.get(sha);
    return bytes ? { status: 200, ok: true, arrayBuffer: async () => bytes.slice().buffer } : { status: 404, ok: false };
  };
  return svc;
}
const memCache = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, b) => { m.set(k, b); } }; };

test('POI-2 FEED: asked at start, then with the version it holds (304: nothing read), again past its minute; a document the law refuses is not stood; the feed kept and read back by a start without the network; a failed ask backs off (mutants: the version not sent; the law unread; the kept copy unread)', async () => {
  const svc = fakeService();
  let t = 1000;
  const cache = memCache();
  const feed = createPoiFeed({ base: () => 'https://svc.invalid', fetch: svc.fetch, cache, now: () => t, log: null });
  svc.v = 3;
  svc.pois = [{ id: 'poi-000000000001', rev: 2, doc: doc('poi-000000000001') }, { id: 'poi-000000000002', rev: 1, doc: { ...doc('poi-000000000002'), name: '' } }];
  await feed.start();
  await feed.tick(t);
  assert.equal(svc.asks[0].headers['if-none-match'], undefined);
  assert.deepEqual(feed.atPixel(10, 20).map((e) => e.id), ['poi-000000000001'], 'the nameless one refused by the law');
  assert.equal(feed.version(), 3);
  assert.equal(feed.tick(t + 10), null, 'not again inside its minute');
  t += POI_FEED_POLL_MS;
  await feed.tick(t);
  assert.equal(svc.asks[1].headers['if-none-match'], '"poi-3"');
  assert.ok(cache.m.has(POI_FEED_CACHE_KEY));
  // a start without the network stands what was kept
  const svc2 = fakeService(); svc2.down = true;
  const kept = createPoiFeed({ base: () => 'https://svc.invalid', fetch: svc2.fetch, cache, now: () => t, log: null });
  await kept.start();
  assert.deepEqual(kept.atPixel(10, 20).map((e) => e.id), ['poi-000000000001']);
  await kept.tick(t);
  assert.equal(kept.tick(t + 4000), null, 'backed off after a failure');
  assert.ok(kept.tick(t + 5000) !== null);
});

test('POI-2 ASSETS: by their hash, once at a time; bytes that are not what they name refused; a kept copy read before the network (mutants: the hash unchecked; asked twice at once)', async () => {
  const svc = fakeService();
  const good = new Uint8Array([1, 2, 3]);
  const sha = await sha256(good);
  svc.assets.set(sha, good);
  const cache = memCache();
  const feed = createPoiFeed({ base: () => 'https://svc.invalid', fetch: svc.fetch, cache, log: null });
  const [a, b] = await Promise.all([feed.asset(sha), feed.asset(sha)]);
  assert.deepEqual(a, good); assert.equal(a, b);
  assert.equal(svc.asks.length, 1, 'asked once');
  const lie = 'f'.repeat(64);
  svc.assets.set(lie, good);
  await assert.rejects(feed.asset(lie), /not the ones it names/);
  const fresh = createPoiFeed({ base: () => 'https://svc.invalid', fetch: async () => { throw new Error('offline'); }, cache, log: null });
  assert.deepEqual(await fresh.asset(sha), good, 'the kept copy, without the network');
});

// ── THE HOST ────────────────────────────────────────────────────────

/** A renderer that keeps what it is asked. */
function fakeRenderer() {
  const r = { meshes: new Set(), uploads: new Map(), emissions: new Map(), released: [], draws: [] };
  r.createMesh = (model) => { const m = { model, id: r.meshes.size + 1 }; r.meshes.add(m); return m; };
  r.destroyMesh = (m) => r.meshes.delete(m);
  r.uploadTexture = (a, rec, c32, o) => r.uploads.set(`${a}_${rec}`, { c32, o });
  r.uploadEmissionTexture = (a, rec, c32, o) => r.emissions.set(`${a}_${rec}`, { c32, o });
  r.releaseTexture = (a, rec) => { r.released.push(`${a}_${rec}`); r.uploads.delete(`${a}_${rec}`); };
  r.evictEmissionTexture = () => {};
  r.drawMesh = (mesh, m, remap, o) => r.draws.push({ mesh, m: [...m], remap, o });
  r.recordShadowMesh = () => {};
  return r;
}
function fakeCollider() {
  const c = { buckets: new Map() };
  c.addMesh = (key, positions, indices, matrix, riding) => c.buckets.set(key, { matrix: [...matrix], riding });
  c.removeBucket = (key) => c.buckets.delete(key);
  return c;
}

async function hostOver(entries, { ground = 50, feetAt = null, collideDrafts = undefined } = {}) {
  const meshBytes = encodePoiMesh(quad());
  const meshSha = await sha256(meshBytes);
  const assets = new Map([[meshSha, meshBytes]]);
  let list = entries(meshSha);
  const feed = {
    tick: () => null,
    atPixel: (px, py) => list.filter((e) => e.doc.place.px === px && e.doc.place.py === py),
    all: () => list,
    asset: async (sha) => { if (!assets.has(sha)) throw new Error('missing'); return assets.get(sha); },
    set: (l) => { list = l; },
  };
  const renderer = fakeRenderer(), collider = fakeCollider();
  let built = [{ px: 10, py: 20 }];
  let feet = feetAt;
  let t = 0;
  const host = createPoiHost({
    renderer, feed, decodeImage: async () => PIC,
    pixels: () => built, translation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 10) * 819.2 + 1000; out[1] = 3; out[2] = -(py - 20) * 819.2 + 2000; return out; },
    groundAt: () => ground, collider: () => collider, riding: (px, py) => `ride:${px},${py}`, feet: () => feet, now: () => t, log: null,
    ...(collideDrafts ? { collideDrafts } : {}),
  });
  // PIN MOVED (AUDIT POI R8): the stand work is a time slice a frame and each wait (an asset, a look) ends in a frame of
  // its own - a POI stands a few frames after it is asked for, not at the next; settle runs frames until it has
  const settle = async () => { for (let f = 0; f < 12; f++) { host.frame(); for (let i = 0; i < 4; i++) await new Promise((res) => setImmediate(res)); } };
  return { host, renderer, collider, feed, meshSha, assets, settle, setBuilt: (b) => { built = b; }, setFeet: (f) => { feet = f; }, setNow: (v) => { t = v; } };
}

test('POI-2 HOST: a POI on a built pixel stands - loaded, on its ground (the snap\'s y above it), collided in its pixel\'s frame riding the pixel, drawn opaque with its remap and translucent after, far first; its pixel gone, it is taken down and its textures let go (mutants: the ground unread; the collider unridden; the translucent nearest first; the textures held)', async () => {
  const H = await hostOver((sha) => [{ id: 'poi-000000000001', rev: 1, doc: { ...doc('poi-000000000001', { mesh: sha }), lights: [{ t: [0, 2, 0], color: [1, 1, 1], radius: 5, intensity: 1, flicker: false }] } },
    { id: 'poi-000000000002', rev: 1, doc: { ...doc('poi-000000000002', { mesh: sha }), place: { ...doc('x').place, x: 400 } } }]);
  await H.settle();
  assert.deepEqual(H.host.standing().map((s) => [s.id, s.status, s.visible]), [['poi-000000000001', 'ready', true], ['poi-000000000002', 'ready', true]]);
  const b = H.collider.buckets.get('poi:poi-000000000001:0');
  assert.equal(b.riding, 'ride:10,20');
  assert.deepEqual(b.matrix.slice(12, 15).map(r6), [100, 47, 100], 'pixel-local: its spot, the ground (50) less the frame\'s 3');
  H.renderer.draws.length = 0;
  H.host.draw(H.renderer);
  assert.equal(H.renderer.draws.length, 2);
  const d = H.renderer.draws[0];
  assert.deepEqual(d.m.slice(12, 15).map(r6), [1100, 50, 2100], 'drawn at the pixel\'s translation');
  assert.deepEqual([...d.remap.entries()][0], [`${POI_TEXTURE_ARCHIVE}_0`, `${POI_TEXTURE_ARCHIVE}_0#s:repeat,repeat,linear`]);
  H.renderer.draws.length = 0;
  H.host.drawTranslucent(H.renderer, [1100, 50, 2100]);
  assert.deepEqual(H.renderer.draws.map((x) => r6(x.m[12])), [1400, 1100], 'the farther first');
  assert.ok(H.renderer.draws.every((x) => x.o.translucent === 1));
  const lights = H.host.lights([]);
  assert.deepEqual([lights[0].x, lights[0].y, lights[0].z].map(r6), [1100, 52, 2100]);
  assert.deepEqual(H.host.marks().map((m) => [m.px, m.py, m.label]), [[10, 20, 'Tower'], [10, 20, 'Tower']]);
  // the pixel gone
  H.setBuilt([]);
  H.host.frame();
  assert.deepEqual(H.host.standing(), []);
  assert.equal(H.collider.buckets.size, 0);
  assert.equal(H.renderer.meshes.size, 0);
  assert.deepEqual(H.renderer.released.sort(), [`${POI_TEXTURE_ARCHIVE}_0`, `${POI_TEXTURE_ARCHIVE}_1`]);
});

test('POI-2 HOST: never walls a body in - a part\'s collider held while the feet are in its box, stood once they leave; the ground unknown, it waits unseen; moved (the same build) it is not loaded again, only placed; another build is; a failure tried again after its wait (mutants: the body walled in; a move reloaded)', async () => {
  const H = await hostOver((sha) => [{ id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { mesh: sha }) }], { feetAt: [1100.5, 50, 2100.2] });
  await H.settle();
  assert.equal(H.collider.buckets.size, 0, 'held round the body');
  H.setFeet([1050, 50, 2050]);
  H.host.frame();
  assert.equal(H.collider.buckets.size, 1);
  const meshes = H.renderer.meshes.size;
  const moved = doc('poi-000000000001', { mesh: H.meshSha });
  moved.place = { ...moved.place, x: 300 };
  H.feed.set([{ id: 'poi-000000000001', rev: 2, doc: moved }]);
  H.host.frame();
  assert.equal(H.renderer.meshes.size, meshes, 'nothing made again');
  assert.deepEqual(H.collider.buckets.get('poi:poi-000000000001:0').matrix.slice(12, 15).map(r6), [300, 47, 100]);
  assert.equal(sameBuild(doc('a', { mesh: H.meshSha }), moved), true);
  const rebuilt = { ...moved, parts: [{ ...moved.parts[0], materials: [mat({ color: [1, 0, 0, 1] }), moved.parts[0].materials[1]] }] };
  assert.equal(sameBuild(moved, rebuilt), false);

  const G = await hostOver((sha) => [{ id: 'poi-000000000003', rev: 1, doc: doc('poi-000000000003', { mesh: sha }) }], { ground: -Infinity });
  await G.settle();
  assert.deepEqual(G.host.standing().map((s) => [s.status, s.visible]), [['ready', false]]);
  assert.equal(G.collider.buckets.size, 0);

  const F = await hostOver(() => [{ id: 'poi-000000000004', rev: 1, doc: doc('poi-000000000004', { mesh: 'e'.repeat(64) }) }]);
  await F.settle();
  assert.equal(F.host.standing()[0].status, 'failed');
  F.assets.set('e'.repeat(64), encodePoiMesh(quad()));
  F.setNow(POI_RETRY_MS - 1); await F.settle();
  assert.equal(F.host.standing()[0].status, 'failed');
  F.setNow(POI_RETRY_MS); await F.settle();
  assert.equal(F.host.standing()[0].status, 'ready');
});

test('POI-2 RECORDS: the POI archive owns its number - no other picture archive in the port is it (ONE ARCHIVE, ONE OWNER, test/world/superDungeon/sd26_render.test.js\'s law, walked); the host names the four hosts', () => {
  const owners = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.js')) for (const m of src(`${dir}/${e.name}`).matchAll(/ARCHIVE\w*\s*=\s*(\d+)\b/g)) if (Number(m[1]) === POI_TEXTURE_ARCHIVE) owners.push(`${dir}/${e.name}`);
    }
  };
  walk('src');
  assert.deepEqual(owners, ['src/poi/poiRuntime.js']);
  assert.match(src('src/scenes/poiHost.js'), /scenes\/world\.js - WIRED[\s\S]*scenes\/worldModes\.js - its interiors stand no street[\s\S]*scenes\/exterior\.js - FLAGGED[\s\S]*scenes\/dungeonContext\.js - stands no street/);
});

test('POI-3 THE HOST\'S PICK: the part a ray meets, by its own triangles through its drawn matrix - the nearest of two, from either side, none past its reach or beside it; the box asked first; a draft\'s colliders held while the editor drags and stood once it ends (mutants: the nearest not kept; the matrix uninverted; the drag\'s hold unread)', async () => {
  let dragging = false;
  const H = await hostOver((sha) => [
    { id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { mesh: sha }) },
    { id: 'poi-000000000002', rev: 0, draft: true, doc: { ...doc('poi-000000000002', { mesh: sha }), place: { ...doc('x').place, z: 110 } } },
  ], { collideDrafts: () => !dragging });
  await H.settle();
  // the quad: x and y 0 - 1 in its frame, at the scene's (1100, 50, 2100) and the draft's ten metres north of it
  assert.deepEqual(H.host.pick([1100.5, 50.5, 2090], [0, 0, 1]), { id: 'poi-000000000001', key: 'body', dist: 10, draft: false });
  assert.deepEqual(H.host.pick([1100.5, 50.5, 2120], [0, 0, -1]), { id: 'poi-000000000002', key: 'body', dist: 10, draft: true }, 'from the north, the draft is the nearer');
  assert.equal(H.host.pick([1100.5, 55, 2090], [0, 0, 1]), null, 'above the quad: nothing');
  assert.equal(H.host.pick([1100.5, 50.5, 2090], [0, 0, 1], 5), null, 'past the reach');
  assert.equal(H.host.pick([1102.5, 50.5, 2090], [0, 0, 1]), null, 'beside it');
  // a part whose BOX is met before the nearest hit but whose triangle lies past it: never taken for the nearer
  const turned45 = [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)];
  const H2 = await hostOver((sha) => [
    { id: 'poi-000000000001', rev: 1, doc: doc('poi-000000000001', { mesh: sha }) },
    { id: 'poi-000000000003', rev: 1, doc: { ...doc('poi-000000000003', { mesh: sha }), place: { ...doc('x').place, z: 100.3, r: turned45 } } },
  ]);
  await H2.settle();
  const near2 = H2.host.pick([1100.5, 50.5, 2120], [0, 0, -1]);
  assert.equal(near2.id, 'poi-000000000001', 'the flat quad, twenty metres off, before the turned one\'s 20.2');
  // the pure halves
  assert.equal(rayBox([0, 0, -5], [0, 0, 1], [-1, -1, -1, 1, 1, 1], 100), true);
  assert.equal(rayBox([0, 3, -5], [0, 0, 1], [-1, -1, -1, 1, 1, 1], 100), false);
  assert.equal(rayTriangles([0.25, 0.25, -2], [0, 0, 1], new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), new Uint16Array([0, 1, 2]), 100), 2);
  // a draft's colliders: stood while nothing is dragged, taken down by a drag's move and held until it ends
  assert.ok(H.collider.buckets.has('poi:poi-000000000002:0'), 'stood');
  dragging = true;
  H.feed.set([H.feed.all()[0], { ...H.feed.all()[1], doc: { ...H.feed.all()[1].doc, place: { ...H.feed.all()[1].doc.place, x: 120 } } }]);
  H.host.frame();
  assert.ok(!H.collider.buckets.has('poi:poi-000000000002:0'), 'moved under a drag: no collider filed');
  assert.ok(H.collider.buckets.has('poi:poi-000000000001:0'), 'the live POI keeps its own');
  dragging = false;
  H.host.frame();
  assert.ok(H.collider.buckets.has('poi:poi-000000000002:0'), 'the drag over: stood where it was left');
});
