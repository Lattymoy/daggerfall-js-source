// AUDIT POI, lane E (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-4 and POI-6's A MODEL BACK OUT) - THE glTF READER
// AND WRITER, AUDITED. Mac: "Audit everything. Ensure perfection." Each finding pinned by a file that exercises exactly it,
// built byte by byte to the Khronos specification or written by the editor's own export (src/poi/gltfExport.js) and read
// back by its own importer (src/poi/gltfImport.js, src/poi/poiImport.js):
//   - G1 a large model baked (its arrays were spread into a call, past V8's limit on arguments);
//   - G2 a primitive emits only the vertices its indices use (a shared accessor was copied whole into every primitive);
//   - G3 a hostile file refused by code, at once - counts held to bounds before anything is allocated, a node met twice,
//     the roots found once, the tree walked by a stack, every error a GltfError, the warnings said once by a set;
//   - G4 a glow picture at no strength glows nowhere; G5 a glow-only material's placement, UV set and sampler read;
//   - G6 a skin in its saved pose; G7 lights in KHR_lights_punctual's units and back; G8 an extension used, unread, said;
//   - R10 colours from the game's sRGB to glTF's linear and back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGltf, bakeGltf, poiMaterialOf, GltfError, GLTF_READ_LIMITS } from '../../src/poi/gltfImport.js';
import { writeGlb } from '../../src/poi/gltfExport.js';
import { prepareImport, uploadImport } from '../../src/poi/poiImport.js';
import { poiMeshError, POI_MESH_LIMITS } from '../../src/poi/poiMesh.js';
import { DEFAULT_MATERIAL } from '../../src/poi/poiLaw.js';
import { newLight } from '../../src/poi/poiEdit.js';
import { bakeAlbedo, bakeEmission } from '../../src/poi/poiRuntime.js';
import { gltfErrorText, gltfWarningText } from '../../src/poi/poiText.js';

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
const asset = { version: '2.0', generator: 'test' };
const txt = (o) => new TextEncoder().encode(JSON.stringify(o));
/** A number to six places, a negative zero as zero. */
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
/** The IEC 61966-2-1 curves, written out here - the oracle the code is held to, not the code's own. */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const close = (a, b, eps = 1e-9) => a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) <= eps);

/** A binary buffer built from typed arrays, each 4-aligned - and the views over it. */
function bufferOf(parts) {
  let size = 0;
  const views = parts.map((p) => {
    const bytes = p instanceof Uint8Array ? p : new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
    const v = { byteOffset: size, byteLength: bytes.byteLength, bytes };
    size += bytes.byteLength + ((4 - (bytes.byteLength % 4)) % 4);
    return v;
  });
  const out = new Uint8Array(size);
  for (const v of views) out.set(v.bytes, v.byteOffset);
  return { bin: out, views: views.map(({ byteOffset, byteLength }) => ({ buffer: 0, byteOffset, byteLength })) };
}
/** A GLB around a JSON and a BIN chunk (the JSON given as text when it is not an object). */
function glb(json, bin) {
  const j = new TextEncoder().encode(typeof json === 'string' ? json : JSON.stringify(json));
  const jl = j.byteLength + ((4 - (j.byteLength % 4)) % 4);
  const bl = bin ? bin.byteLength + ((4 - (bin.byteLength % 4)) % 4) : 0;
  const total = 12 + 8 + jl + (bin ? 8 + bl : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jl); out.set(j, 20);
  if (bin) { dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004e4942, true); out.set(bin, 28 + jl); }
  return out;
}
/** A GLB's JSON chunk, parsed. */
const jsonOf = (bytes) => JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true))));
/** The refusal a read ends in: its code and arguments - and a GltfError, whatever went wrong. */
function refusal(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof GltfError, `not a GltfError: ${e?.constructor?.name} ${e?.message}`); return { code: e.code, ...e.args }; }
  return assert.fail('it read');
}
const codes = (model) => model.warnings.map((w) => w.code);

/** A cube, each face its own corners, wound so (b - a) x (c - a) is its outward normal (the import's way); two submeshes. */
function cube() {
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  const pos = [], nor = [], uv = [], idx = [];
  for (const [n, a, b] of faces) {
    const base = pos.length / 3;
    for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push(...[0, 1, 2].map((k) => n[k] * 0.5 + (i - 0.5) * b[k] + (j - 0.5) * a[k])); nor.push(...n); uv.push(i, 1 - j); }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: 12 }, { start: 12, count: 24 }] };
}
/** A flat grid of V vertices facing +Z, its triangles (each three vertices of its own) split evenly over S submeshes. */
function grid(V, S) {
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2);
  for (let i = 0; i < V; i++) { pos[i * 3] = (i % 300) * 0.01; pos[i * 3 + 1] = Math.floor(i / 300) * 0.01; nor[i * 3 + 2] = 1; uv[i * 2] = (i % 300) / 300; }
  const tris = Math.floor(V / 3), per = Math.floor(tris / S);
  const idx = [], submeshes = [];
  for (let s = 0; s < S; s++) { const start = idx.length; for (let t = 0; t < per; t++) { const k = (s * per + t) * 3; idx.push(k, k + 1, k + 2); } submeshes.push({ start, count: idx.length - start }); }
  return { positions: pos, normals: nor, uvs: uv, indices: V > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx), submeshes };
}
const partOf = (mesh, materials, extra = {}) => ({ key: 'p', name: 'P', mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], materials, ...extra });
const plain = (n) => Array.from({ length: n }, () => ({ ...DEFAULT_MATERIAL }));
/** Each corner of `a` and `b`, triangle by triangle in order, where it stood (the same winding), to `eps`. */
function sameCorners(a, b, eps = 1e-6) {
  if (a.indices.length !== b.indices.length) return false;
  for (let i = 0; i < a.indices.length; i++) {
    const u = a.indices[i], v = b.indices[i];
    for (let k = 0; k < 3; k++) if (Math.abs(a.positions[u * 3 + k] - b.positions[v * 3 + k]) > eps) return false;
  }
  return true;
}

// ── G1 ──────────────────────────────────────────────────────────────

test('AUDIT POI G1 A LARGE MODEL: a part of 60,000 vertices in one material bakes, and the editor\'s own 70,002-vertex part comes back in, every corner where it stood - each material\'s run set into arrays sized once, never spread into a call past V8\'s limit on arguments (mutant: the runs spread again)', () => {
  // one material, 60,000 vertices: 180,000 numbers spread into push() threw "Maximum call stack size exceeded"
  const one = grid(60000, 1);
  const [a] = bakeGltf(readGltf(writeGlb({ name: 'One', parts: [partOf(one, plain(1))] })), { split: 'nodes' });
  assert.equal(a.mesh.positions.length / 3, 60000);
  assert.equal(poiMeshError(a.mesh), null);
  assert.ok(sameCorners(one, a.mesh), 'every corner where it stood');
  // the auditor's: 70,002 vertices in two submeshes, u32 indices
  const V = 70002;
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3);
  for (let i = 0; i < V; i++) { pos[i * 3] = (i % 300) * 0.01; pos[i * 3 + 1] = Math.floor(i / 300) * 0.01; nor[i * 3 + 2] = 1; }
  const idx = new Uint32Array(V); for (let i = 0; i < V; i++) idx[i] = i;
  const big = { positions: pos, normals: nor, uvs: new Float32Array(V * 2), indices: idx, submeshes: [{ start: 0, count: 35001 }, { start: 35001, count: 35001 }] };
  const [b] = bakeGltf(readGltf(writeGlb({ name: 'Big', parts: [partOf(big, plain(2))] })), { split: 'nodes' });
  assert.equal(b.mesh.positions.length / 3, V);
  assert.ok(b.mesh.indices instanceof Uint32Array);
  assert.deepEqual(b.mesh.submeshes, big.submeshes);
  assert.ok(sameCorners(big, b.mesh));
});

// ── G2 ──────────────────────────────────────────────────────────────

test('AUDIT POI G2 A SHARED ACCESSOR: a primitive emits only the vertices its indices use, in the file\'s order - the editor\'s own export shares one POSITION across a part\'s submeshes, and a cube of 24 vertices in two came back as 48, 9,000 in 32 as 288,000 (refused); an index past its primitive\'s vertices refused by code (mutants: every vertex of the accessor emitted; the index unchecked)', () => {
  const m = cube();
  for (const split of ['whole', 'nodes']) {
    const [back] = bakeGltf(readGltf(writeGlb({ name: 'Cube', parts: [partOf(m, plain(2))] })), { split });
    assert.equal(back.mesh.positions.length / 3, 24, `${split}: 24 vertices, not 48`);
    assert.ok(sameCorners(m, back.mesh));
  }
  // each submesh's run holds the vertices that submesh uses, no more: a grid's 9,000 in 32 submeshes - 8,928 used
  const g = grid(9000, 32);
  const model = readGltf(writeGlb({ name: 'Grid', parts: [partOf(g, plain(32))] }));
  const prep = prepareImport(model, bakeGltf(model));
  assert.deepEqual(prep.refused, [], 'never past the vertex limit');
  const [whole] = bakeGltf(model);
  assert.equal(whole.mesh.positions.length / 3, 8928);
  assert.ok(sameCorners(g, whole.mesh));
  // an index that names no vertex of its primitive: refused, never baked as NaN
  const { bin, views } = bufferOf([new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), new Uint16Array([0, 1, 3])]);
  const bad = { asset, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], buffers: [{ byteLength: bin.byteLength }], bufferViews: views,
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }] };
  assert.deepEqual(refusal(() => readGltf(glb(bad, bin))), { code: 'missing', what: 'vertex', index: 3 });
});

// ── G3 ──────────────────────────────────────────────────────────────

const meshOf = (accessors, extra = {}) => ({ asset, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors, ...extra });

test('AUDIT POI G3 COUNTS HELD BEFORE ANYTHING IS ALLOCATED: an accessor of no view asking for more numbers than any POI mesh array holds, one over a view too, and a file whose accessors together pass the reader\'s budget - each refused `too-large`; a stride shorter than its element, a sparse run past its view - refused by code; a picture in a view that view\'s own bytes, never a copy (mutants: the accessor uncapped; the total uncapped; the stride unheld; the sparse run unheld; a picture copied)', () => {
  const over = Math.floor(GLTF_READ_LIMITS.accessor / 3) + 1;   // VEC3: one vertex past the cap
  assert.equal(GLTF_READ_LIMITS.accessor, POI_MESH_LIMITS.indices, 'one accessor: the longest array the mesh law allows');
  assert.deepEqual(refusal(() => readGltf(txt(meshOf([{ componentType: 5126, count: over, type: 'VEC3' }])))), { code: 'too-large', what: 'accessor', index: 0 });
  // over a 12-byte view: refused by the cap before its view is even measured
  const { bin, views } = bufferOf([new Float32Array([0, 0, 0])]);
  const viewed = (acc) => glb({ ...meshOf([acc]), buffers: [{ byteLength: bin.byteLength }], bufferViews: views }, bin);
  assert.deepEqual(refusal(() => readGltf(viewed({ bufferView: 0, componentType: 5126, count: 100_000_000, type: 'MAT4' }))), { code: 'too-large', what: 'accessor', index: 0 });
  assert.deepEqual(refusal(() => readGltf(viewed({ bufferView: 0, componentType: 5126, count: 2, type: 'VEC3' }))), { code: 'past-end', what: 'accessor', index: 0 });
  // nine accessors each under the cap, together past the budget (eight such)
  const each = Math.floor(GLTF_READ_LIMITS.accessor / 3);
  const nine = { asset, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: Array.from({ length: 9 }, (_, i) => ({ attributes: { POSITION: i } })) }], accessors: Array.from({ length: 9 }, () => ({ componentType: 5126, count: each, type: 'VEC3' })) };
  assert.deepEqual(refusal(() => readGltf(txt(nine))), { code: 'too-large', what: 'model' });
  // a stride of 4 under a VEC3 of floats: every element read over the next
  const strided = bufferOf([new Float32Array(9)]);
  strided.views[0].byteStride = 4;
  assert.deepEqual(refusal(() => readGltf(glb({ ...meshOf([{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }]), buffers: [{ byteLength: strided.bin.byteLength }], bufferViews: strided.views }, strided.bin))), { code: 'accessor-type', index: 0 });
  // a sparse run of two over a view that holds one value
  const sp = bufferOf([new Uint8Array([0, 1]), new Float32Array([1, 2, 3])]);
  const sparse = { componentType: 5126, count: 3, type: 'VEC3', sparse: { count: 2, indices: { bufferView: 0, componentType: 5121 }, values: { bufferView: 1 } } };
  assert.deepEqual(refusal(() => readGltf(glb({ ...meshOf([sparse]), buffers: [{ byteLength: sp.bin.byteLength }], bufferViews: sp.views }, sp.bin))), { code: 'past-end', what: 'accessor', index: 0 });
  // two pictures over one view: each the view's own bytes (a thousand images over one view of a BIN were a thousand copies)
  const pics = bufferOf([PNG]);
  const file = glb({ asset, images: [{ bufferView: 0, mimeType: 'image/png' }, { bufferView: 0, mimeType: 'image/png' }], buffers: [{ byteLength: pics.bin.byteLength }], bufferViews: pics.views }, pics.bin);
  const im = readGltf(file).images;
  assert.deepEqual(im.map((x) => x.bytes.buffer === file.buffer), [true, true]);
  assert.deepEqual(im[0].bytes, PNG);
});

test('AUDIT POI G3 THE NODE TREE: a node of two parents refused `node-parents` (an ancestors-only check walked a 24-deep DAG 2^24 times), a root named twice too, its own ancestor still `node-cycle`; a chain of 20,000 walked by a stack of its own; 40,000 nodes with no scene rooted in one pass (mutants: a node of two parents walked once a path; the roots searched for every node)', () => {
  const dag = [];
  for (let i = 0; i < 16; i++) dag.push({ children: [2 * (i + 1), 2 * (i + 1) + 1] }, { children: [2 * (i + 1), 2 * (i + 1) + 1] });
  dag.push({}, {});
  // the walk goes deepest first: the first node met by its second parent is the last level's first (2 x 16)
  assert.deepEqual(refusal(() => readGltf(txt({ asset, scenes: [{ nodes: [0] }], nodes: dag }))), { code: 'node-parents', index: 32 });
  assert.deepEqual(refusal(() => readGltf(txt({ asset, scenes: [{ nodes: [0, 0] }], nodes: [{}] }))), { code: 'node-parents', index: 0 });
  assert.deepEqual(refusal(() => readGltf(txt({ asset, scenes: [{ nodes: [0] }], nodes: [{ children: [1] }, { children: [0] }] }))), { code: 'node-cycle', index: 0 });
  // a node's index said as text is no node (it would be a second name for one, past the check)
  assert.deepEqual(refusal(() => readGltf(txt({ asset, scenes: [{ nodes: [0] }], nodes: [{ children: ['1'] }, {}] }))), { code: 'missing', what: 'node', index: '1' });
  // a chain of 20,000: the recursion overflowed the call stack (a RangeError, not a GltfError)
  const chain = Array.from({ length: 20000 }, (_, i) => ({ children: [i + 1] }));
  chain.push({ mesh: 0 });
  const { bin, views } = bufferOf([new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])]);
  const deep = readGltf(glb({ asset, scenes: [{ nodes: [0] }], nodes: chain, meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: bin.byteLength }], bufferViews: views, accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }] }, bin));
  assert.equal(deep.instances.length, 1);
  // no scene: the roots are the nodes no node names a child - found once, not by a search of every node for each
  const many = Array.from({ length: 40000 }, () => ({}));
  many[0] = { children: [1], mesh: 0 };
  many[1] = { mesh: 0 };
  const t0 = performance.now();
  const flat = readGltf(glb({ asset, nodes: many, meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: bin.byteLength }], bufferViews: views, accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }] }, bin));
  const ms = performance.now() - t0;
  assert.equal(flat.instances.length, 2, 'the root and its child, each once');
  assert.ok(ms < 2000, `40,000 nodes rooted in ${Math.round(ms)} ms (the search took seconds)`);
});

test('AUDIT POI G3 EVERY ERROR SAID: a GLB whose JSON is no JSON, a data URI that decodes to nothing, a negative offset, a negative count, a field of the wrong type - each a GltfError the editor has a sentence for, never a SyntaxError, URIError, RangeError or TypeError; the warnings said once each by a set, eight thousand at once (mutants: an error passed through as it was; the warnings searched)', () => {
  assert.deepEqual(refusal(() => readGltf(glb('{"asset": {"version": "2.0"', null))), { code: 'glb-chunk' });
  assert.deepEqual(refusal(() => readGltf(txt({ asset, buffers: [{ uri: 'data:application/octet-stream,%E0%A4%A', byteLength: 3 }] }))), { code: 'data-uri' });
  const { bin, views } = bufferOf([new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])]);
  const at = (acc) => glb({ ...meshOf([acc]), buffers: [{ byteLength: bin.byteLength }], bufferViews: views }, bin);
  assert.deepEqual(refusal(() => readGltf(at({ bufferView: 0, byteOffset: -4, componentType: 5126, count: 3, type: 'VEC3' }))), { code: 'malformed', what: 'accessor', index: 0 });
  assert.deepEqual(refusal(() => readGltf(txt(meshOf([{ componentType: 5126, count: -1, type: 'VEC3' }])))), { code: 'malformed', what: 'accessor', index: 0 });
  const wrongType = refusal(() => readGltf(txt({ asset, scenes: [{ nodes: [0] }], nodes: [{ rotation: 5 }] })));
  assert.deepEqual(wrongType, { code: 'malformed' });
  for (const c of ['malformed', 'too-large', 'node-parents']) assert.doesNotMatch(gltfErrorText(c, {}), /Something is wrong/, `${c} said in words`);
  // the warnings: each once - by a set of their keys, not by a search of the list for every one (quadratic)
  const N = 8000;
  const file = txt({ asset, materials: Array.from({ length: N }, (_, i) => ({ name: `m${i}`, pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, normalTexture: { index: 0 } })), textures: [{}] });
  const t0 = performance.now();
  const model = readGltf(file);
  const ms = performance.now() - t0;
  assert.equal(model.warnings.length, N + 1, 'each material\'s own, the maps once');
  assert.equal(codes(model).filter((c) => c === 'maps').length, 1);
  assert.ok(ms < 2000, `eight thousand warnings in ${Math.round(ms)} ms (the search took seconds)`);
});

test('AUDIT POI G3 A PART NEVER BUILT PAST THE LAW: a model whose instances together pass the mesh law\'s vertex limit is refused by the law\'s own code before its vertices are made, and the import says so (mutant: built in full, then refused)', () => {
  // one mesh of 69,999 vertices (zeros: a valid accessor of no view) under four nodes - 279,996 baked whole
  const n = 69999;
  const json = { asset, scenes: [{ nodes: [0, 1, 2, 3] }], nodes: [0, 1, 2, 3].map(() => ({ mesh: 0 })), meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 0 } }] }], accessors: [{ componentType: 5126, count: n, type: 'VEC3' }] };
  const model = readGltf(txt(json));
  const [whole] = bakeGltf(model);
  assert.deepEqual([whole.refused, whole.mesh], ['too-many-vertices', null]);
  assert.deepEqual(prepareImport(model, [whole]).refused, [{ name: 'model', code: 'too-many-vertices' }]);
  // a part each, each within the law, all built
  assert.deepEqual(bakeGltf(model, { split: 'nodes' }).map((p) => p.mesh.positions.length / 3), [n, n, n, n]);
});

// ── G4, G5 ──────────────────────────────────────────────────────────

test('AUDIT POI G4 A GLOW AT NO STRENGTH: a glow picture whose strength is 0 (the editor\'s default) writes no emissive factor - glTF\'s glow is its factor times its picture, the game\'s its colour times its picture, and [1, 1, 1] laid under it came back glowing; a glow of strength 2 writes the factor and strength it has (mutant: the factor [1, 1, 1] under every glow picture)', () => {
  const sha = 'e'.repeat(64);
  const dark = { ...DEFAULT_MATERIAL, emissive: sha };
  const lit = { ...DEFAULT_MATERIAL, emissive: sha, emissiveColor: [2, 1, 0] };
  const bytes = writeGlb({ name: 'G', parts: [partOf(cube(), [dark, lit])], pictures: new Map([[sha, { bytes: PNG, format: 'png' }]]) });
  const [j0, j1] = jsonOf(bytes).materials;
  assert.equal(j0.emissiveFactor, undefined, 'no glow: glTF\'s default factor, [0, 0, 0]');
  assert.deepEqual(j0.emissiveTexture, { index: 0 });
  assert.ok(close(j1.emissiveFactor, [1, toLinear(0.5), 0]), 'the colour over its strength, linear');
  assert.deepEqual(j1.extensions.KHR_materials_emissive_strength, { emissiveStrength: 2 });
  const model = readGltf(bytes);
  const [a, b] = model.materials.map(poiMaterialOf);
  assert.deepEqual([a.emissive, a.emissiveColor], [0, [0, 0, 0]], 'its picture kept, glowing nowhere');
  assert.deepEqual(b.emissiveColor, [2, 1, 0]);
  // the game draws the first's glow black, as glTF now does
  const white = { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) };
  assert.deepEqual([...bakeEmission(white, { ...a, emissive: sha }, white).colors], [0, 0, 0, 255]);
});

test('AUDIT POI G5 A GLOW-ONLY MATERIAL: its picture\'s placement (repeats 4 x 4), its UV set and its sampler read from its glow picture, where the base picture was read alone (it came back 1 x 1, from TEXCOORD_0, repeating); a glow placed unlike its base picture said (mutants: the base\'s placement alone; the base\'s UV set alone; the base\'s sampler alone)', () => {
  const sha = 'e'.repeat(64);
  const glow = { ...DEFAULT_MATERIAL, emissive: sha, emissiveColor: [1, 1, 1], wrap: ['clamp', 'mirror'], filter: 'nearest', uv: { offset: [0.25, 0], scale: [4, 4], rotation: 0 } };
  const m = cube();
  const model = readGltf(writeGlb({ name: 'Sign', parts: [partOf(m, [glow, { ...DEFAULT_MATERIAL }])], pictures: new Map([[sha, { bytes: PNG, format: 'png' }]]) }));
  assert.deepEqual(model.warnings, []);
  const [part] = bakeGltf(model, { split: 'nodes' });
  for (let i = 0; i < 12; i++) {
    const u0 = m.uvs[m.indices[i] * 2], ub = part.mesh.uvs[part.mesh.indices[i] * 2];
    assert.ok(Math.abs(ub - (u0 * 4 + 0.25)) < 1e-6, `its glow's repeats baked in (${u0} -> ${ub})`);
  }
  const mat = poiMaterialOf(model.materials[0]);
  assert.deepEqual([mat.texture, mat.emissive, mat.wrap, mat.filter], [null, 0, ['clamp', 'mirror'], 'nearest']);
  // a third party's glow-only material on TEXCOORD_1: read from that set
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), uv0 = new Float32Array([0, 0, 0, 0, 0, 0]), uv1 = new Float32Array([0.5, 0.5, 1, 0.5, 0.5, 1]);
  const { bin, views } = bufferOf([pos, uv0, uv1, PNG]);
  const json = {
    asset, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1, TEXCOORD_1: 2 }, material: 0 }] }],
    materials: [{ emissiveFactor: [1, 1, 1], emissiveTexture: { index: 0, texCoord: 1 } }],
    textures: [{ source: 0 }], images: [{ bufferView: 3, mimeType: 'image/png' }],
    buffers: [{ byteLength: bin.byteLength }], bufferViews: views,
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }, { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' }],
  };
  const [second] = bakeGltf(readGltf(glb(json, bin)));
  assert.deepEqual(new Set(second.mesh.uvs), new Set([0.5, 1]), 'TEXCOORD_1, its glow\'s set');
  // a base picture and a glow placed apart: drawn as the base is, and said
  json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, emissiveFactor: [1, 1, 1], emissiveTexture: { index: 0, extensions: { KHR_texture_transform: { scale: [2, 2] } } } }];
  assert.deepEqual(readGltf(glb(json, bin)).warnings, [{ code: 'emission-transform', material: 'material0' }]);
  assert.doesNotMatch(gltfWarningText('emission-transform'), /Something is wrong/);
});

// ── G6 ──────────────────────────────────────────────────────────────

/** A skinned triangle: an armature at (3, 0, 0) scaled 0.01 (as an FBX round trip leaves one), its joints under it,
 *  the mesh's vertices in the armature's space - the specification places a vertex at sum w (joint world x IBM) v. */
function skinned({ second = null, weights = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], normals = false } = {}) {
  const pos = new Float32Array([0, 0, 0, 100, 0, 0, 0, 100, 0]);
  const joints = new Uint8Array([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]);
  const ibm = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const { bin, views } = bufferOf([pos, joints, new Float32Array(weights), ibm, nrm]);
  const json = {
    asset, scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Armature', translation: [3, 0, 0], scale: [0.01, 0.01, 0.01], children: [1, 2, 3] },
      { name: 'Bone' }, { name: 'Bone2', ...(second ?? {}) },
      { name: 'Body', mesh: 0, skin: 0, translation: [50, 50, 50] },   // its own transform: ignored by the specification
    ],
    skins: [{ joints: [1, 2], inverseBindMatrices: 3 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2, ...(normals ? { NORMAL: 4 } : {}) } }] }],
    buffers: [{ byteLength: bin.byteLength }], bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [100, 100, 0] },
      { bufferView: 1, componentType: 5121, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: 2, type: 'MAT4' },
      { bufferView: 4, componentType: 5126, count: 3, type: 'VEC3' },
    ],
  };
  return glb(json, bin);
}

test('AUDIT POI G6 A SKIN IN ITS SAVED POSE: each vertex by its joints\' world matrices times their inverse bind matrices, weighted by JOINTS_0 / WEIGHTS_0 - the armature\'s scale and place kept, the mesh node\'s own transform ignored (the identity it was given came in a hundred times its size, at the origin); weights blended and made to sum to one; a mirroring joint winds its triangles back; the warning true (mutants: the skin unread; the joints\' world unread; the weights unblended)', () => {
  const model = readGltf(skinned());
  assert.deepEqual(model.warnings, [{ code: 'skin' }]);
  assert.match(gltfWarningText('skin'), /saved pose/);
  const [p] = bakeGltf(model);
  assert.deepEqual([...p.mesh.positions].map(r6), [-3, 0, 0, -4, 0, 0, -3, 1, 0], 'the armature at (3, 0, 0), a hundredth the size; X mirrored');
  const [byNode] = bakeGltf(model, { split: 'nodes' });
  assert.deepEqual(byNode.position, [0, 0, 0], 'a skinned part stands at the model\'s origin, its pose in its vertices');
  // the second joint moved 100 along X (200 in the armature's space under its scale): a vertex half on each moves half
  const blended = bakeGltf(readGltf(skinned({ second: { translation: [200, 0, 0] }, weights: [0.25, 0.25, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0] })))[0];
  // vertex 0: (0, 0, 0) a quarter on each (made a half on each, summing to one) - between the first joint's (3, 0, 0) and
  // the second's (5, 0, 0)
  assert.deepEqual([...blended.mesh.positions.subarray(0, 3)].map(r6), [-4, 0, 0]);
  assert.deepEqual([...blended.mesh.positions.subarray(6, 9)].map(r6), [-3, 1, 0], 'a weight of 2 alone is a weight of 1');
  // a joint scaled -1 on X mirrors its vertices: the triangle wound back so its front stays its front
  const plainOrder = [...bakeGltf(readGltf(skinned({ normals: true })))[0].mesh.indices];
  const mirrored = bakeGltf(readGltf(skinned({ normals: true, second: { scale: [-1, 1, 1] }, weights: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0] })))[0];
  assert.deepEqual([...mirrored.mesh.indices], [plainOrder[0], plainOrder[2], plainOrder[1]]);
  assert.deepEqual([...mirrored.mesh.normals.subarray(0, 3)].map(r6), [0, 0, 1], 'its normal turned with it');
});

// ── G7 ──────────────────────────────────────────────────────────────

test('AUDIT POI G7 LIGHTS IN THEIR UNITS: a light written in KHR_lights_punctual\'s - candela and a linear colour, as glTFast writes a Unity built-in light (intensity x pi, colour.linear), its reach the range - with the game\'s own numbers in its extras; read back by the importer as it was, its flicker too; changed in a tool, by the conversion turned back; a third party\'s endless light the editor\'s new light\'s reach; a spot set aside; the import carries them (mutants: the intensity written raw; the colour written raw; the extras unread; the lights left out)', async () => {
  // numbers past a millionth, which the conversion's way back rounds - the extras give them back exactly
  const light = { t: [1, 2, 3], color: [1, 0.5, 0.123456789], radius: 6.25, intensity: 1.2345678, flicker: true };
  const bytes = writeGlb({ name: 'Lamp', parts: [partOf(cube(), plain(2))], lights: [light] });
  const [l] = jsonOf(bytes).extensions.KHR_lights_punctual.lights;
  assert.equal(l.type, 'point');
  assert.ok(Math.abs(l.intensity - 1.2345678 * Math.PI) < 1e-12, `candela: ${l.intensity}`);
  assert.ok(close(l.color, [1, toLinear(0.5), toLinear(0.123456789)]), 'its colour linear');
  assert.equal(l.range, 6.25);
  assert.deepEqual(l.extras, { poi: { color: [1, 0.5, 0.123456789], intensity: 1.2345678, radius: 6.25, flicker: true } });
  const model = readGltf(bytes);
  assert.deepEqual(model.warnings, [], 'a point light is read, not set aside');
  const prep = prepareImport(model, bakeGltf(model, { split: 'nodes' }));
  assert.deepEqual(prep.lights, [light], 'back as it went');
  const up = await uploadImport(prep, async (b, kind) => ({ ok: true, data: { sha: kind === 'mesh' ? 'a'.repeat(64) : 'b'.repeat(64), meta: {} } }));
  assert.deepEqual(up.asset.lights, [light], 'placed with the model (poiEditorHost.js placeAsset)');
  // changed in a tool (its candela made 4 pi), its extras stale: the light's own word, turned back - the rest kept
  const json = jsonOf(bytes);
  json.extensions.KHR_lights_punctual.lights[0].intensity = 4 * Math.PI;
  const { bin } = (() => { const dv = new DataView(bytes.buffer, bytes.byteOffset); const jl = dv.getUint32(12, true); return { bin: bytes.subarray(28 + jl) }; })();
  const changed = readGltf(glb(json, bin));
  assert.deepEqual(prepareImport(changed, []).lights, [{ ...light, intensity: 4 }]);
  // a third party's: no extras, no range (an endless light), a spot beside it
  const third = readGltf(txt({ asset, scenes: [{ nodes: [0, 1] }],
    nodes: [{ translation: [2, 0, 1], extensions: { KHR_lights_punctual: { light: 0 } } }, { extensions: { KHR_lights_punctual: { light: 1 } } }],
    extensions: { KHR_lights_punctual: { lights: [{ type: 'point', color: [toLinear(0.5), 1, 1], intensity: 3 * Math.PI }, { type: 'spot', spot: {} }] } }, extensionsUsed: ['KHR_lights_punctual'] }));
  assert.deepEqual(third.warnings, [{ code: 'camera-light' }], 'the spot set aside, said');
  const fresh = newLight();
  assert.deepEqual(prepareImport(third, []).lights, [{ t: [-2, 0, 1], color: [0.5, 1, 1], radius: fresh.radius, intensity: 3, flicker: fresh.flicker }]);
});

// ── G8 ──────────────────────────────────────────────────────────────

test('AUDIT POI G8 AN EXTENSION USED, UNREAD: EXT_mesh_gpu_instancing said in its own words (its 500 rocks came in as one, silently), any other unread extension by its name; those whose loss is said elsewhere or shows nothing the game draws kept quiet (mutants: extensionsUsed unread; instancing said by name alone)', () => {
  assert.deepEqual(readGltf(txt({ asset, extensionsUsed: ['EXT_mesh_gpu_instancing'] })).warnings, [{ code: 'instancing' }]);
  assert.deepEqual(readGltf(txt({ asset, extensionsUsed: ['VENDOR_odd_thing'] })).warnings, [{ code: 'extension-ignored', ext: 'VENDOR_odd_thing' }]);
  assert.deepEqual(readGltf(txt({ asset, extensionsUsed: ['KHR_texture_transform', 'KHR_materials_specular', 'KHR_lights_punctual', 'KHR_materials_ior'] })).warnings, []);
  assert.match(gltfWarningText('extension-ignored', { ext: 'VENDOR_odd_thing' }), /VENDOR_odd_thing/);
  assert.doesNotMatch(gltfWarningText('instancing'), /Something is wrong/);
});

// ── R10 ─────────────────────────────────────────────────────────────

test('AUDIT POI R10 COLOUR SPACE: the game\'s colours are sRGB, glTF\'s factors LINEAR - a base colour and a glow written linear (the alpha as it is, the glow\'s strength laid on after its colour is turned) and read back to where they were; a third party\'s untextured base colour of 0.5 bakes in the game as the 188 a glTF viewer shows, not 128 (mutants: the base colour written raw; read raw; the glow written raw; read raw)', () => {
  const mats = [{ ...DEFAULT_MATERIAL, color: [0.5, 0.25, 1, 0.5] }, { ...DEFAULT_MATERIAL, emissiveColor: [4, 2, 0.4] }];
  const bytes = writeGlb({ name: 'C', parts: [partOf(cube(), mats)] });
  const [j0, j1] = jsonOf(bytes).materials;
  assert.ok(close(j0.pbrMetallicRoughness.baseColorFactor, [toLinear(0.5), toLinear(0.25), 1, 0.5]), 'linear, its alpha as it was');
  assert.ok(close(j1.emissiveFactor, [1, toLinear(0.5), toLinear(0.1)]), 'the glow\'s colour linear, its strength apart');
  assert.equal(j1.extensions.KHR_materials_emissive_strength.emissiveStrength, 4);
  const [b0, b1] = readGltf(bytes).materials.map(poiMaterialOf);
  assert.deepEqual(b0.color, [0.5, 0.25, 1, 0.5]);
  assert.deepEqual(b1.emissiveColor, [4, 2, 0.4]);
  // a Blender base colour of 0.5 (linear, as glTF writes it)
  const blender = poiMaterialOf(readGltf(txt({ asset, materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.5, 0.5, 0.5, 1] } }] })).materials[0]);
  assert.deepEqual(blender.color, [r6(toSrgb(0.5)), r6(toSrgb(0.5)), r6(toSrgb(0.5)), 1]);
  assert.equal(bakeAlbedo(null, blender).colors[0], 188);
});
