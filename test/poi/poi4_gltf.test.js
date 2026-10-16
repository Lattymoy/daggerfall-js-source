// POI-4 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE glTF 2.0 IMPORTER (src/poi/gltfImport.js).
// Mac, asked which formats the POI editor imports: "glTF / GLB". Every file here is built byte by byte to the Khronos
// specification, so each law is pinned by a file that exercises exactly it:
//   - the containers: a GLB's JSON and BIN chunks; a .gltf with its .bin beside it and an image as a data URI;
//   - accessors: interleaved (strided), normalized, sparse (with no buffer view under it);
//   - topology: lists, strips and fans; flat normals for a primitive with none;
//   - the node tree baked, a mirroring node, morph targets at their default weights;
//   - the frame turned to the game's (X mirrored, winding reversed - the renderer's gl.frontFace(CW));
//   - materials, samplers, KHR_texture_transform, EXT_texture_webp; and the refusals, each saying why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readGltf, bakeGltf, poiMaterialOf, applyTextureTransform, GltfError } from '../../src/poi/gltfImport.js';
import { encodePoiMesh, decodePoiMesh } from '../../src/poi/poiMesh.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));

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
/** A GLB around a JSON and a BIN chunk. */
function glb(json, bin) {
  const j = new TextEncoder().encode(JSON.stringify(json));
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
const asset = { version: '2.0', generator: 'test' };
/** The refusal a read ends in: its code and arguments. */
function refusal(fn) {
  try { fn(); } catch (e) { assert.ok(e instanceof GltfError, `not a GltfError: ${e}`); return { code: e.code, ...e.args }; }
  return assert.fail('it read');
}
/** The warnings' codes, in order. */
const codes = (model) => model.warnings.map((w) => w.code);
/** A number to six places, a negative zero as zero. */
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
/** linear -> sRGB, the IEC 61966-2-1 curve written out (AUDIT POI R10: the game's colours are sRGB, glTF's linear). */
const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
/** A GLB's two chunks back out: its JSON parsed, its BIN's bytes. */
function chunksOf(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jl = dv.getUint32(12, true);
  return { json: JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jl))), bin: bytes.subarray(28 + jl, 28 + jl + dv.getUint32(20 + jl, true)) };
}

/** A unit quad facing +Z (glTF's front), in two triangles, with normals, UVs and a textured material. */
function quadGlb({ texture = true, transform = null, sampler = { wrapS: 33071, wrapT: 10497, magFilter: 9728 }, node = {} } = {}) {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uv = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const idx = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const { bin, views } = bufferOf([pos, nrm, uv, idx, PNG]);
  const json = {
    asset, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, ...node }],
    meshes: [{ name: 'Quad', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    buffers: [{ byteLength: bin.byteLength }], bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    materials: [{ name: 'Stone', pbrMetallicRoughness: { baseColorFactor: [0.5, 0.6, 0.7, 1], ...(texture ? { baseColorTexture: { index: 0, ...(transform ? { extensions: { KHR_texture_transform: transform } } : {}) } } : {}) }, emissiveFactor: [0.1, 0.2, 0.3], extensions: { KHR_materials_emissive_strength: { emissiveStrength: 2 } }, alphaMode: 'MASK', alphaCutoff: 0.25, doubleSided: true }],
    textures: [{ source: 0, sampler: 0 }], samplers: [sampler], images: [{ bufferView: 4, mimeType: 'image/png' }],
  };
  return glb(json, bin);
}

test('POI-4 GLB: a textured quad read from its chunks and baked into the game\'s frame - X mirrored, winding reversed so its front stays the front, normals turned with it; its material, sampler and image; the mesh one the realm stores (mutants: the X kept; the winding kept)', () => {
  const model = readGltf(quadGlb());
  assert.deepEqual(model.warnings, []);
  assert.equal(model.images.length, 1);
  assert.deepEqual(model.images[0].bytes, PNG);
  assert.equal(model.images[0].mime, 'image/png');
  const [part] = bakeGltf(model);
  const m = part.mesh;
  assert.deepEqual([...m.positions], [0, 0, 0, -1, 0, 0, -1, 1, 0, 0, 1, 0], 'X mirrored');
  assert.deepEqual([...m.normals], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 'a +Z normal stays +Z');
  assert.deepEqual([...m.uvs], [0, 1, 1, 1, 1, 0, 0, 0], 'UVs as glTF writes them');
  assert.deepEqual([...m.indices], [0, 2, 1, 0, 3, 2], 'each triangle wound back');
  // the emitted order's normal is the vertex normal: (E1 - E0) x (E2 - E0) - the front the renderer culls by
  const P = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
  const [e0, e1, e2] = [P(m.indices[0]), P(m.indices[1]), P(m.indices[2])];
  const a = e1.map((v, k) => v - e0[k]), b = e2.map((v, k) => v - e0[k]);
  assert.deepEqual([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], [0, 0, 1]);
  assert.deepEqual(m.submeshes, [{ start: 0, count: 6 }]);
  assert.deepEqual(part.materials, [0]);
  assert.ok('mesh' in decodePoiMesh(encodePoiMesh(m)));
  const mat = poiMaterialOf(model.materials[0]);
  // PIN MOVED (AUDIT POI R10): the file's factors are glTF's LINEAR colours, the game's sRGB - [0.5, 0.6, 0.7] and the
  // glow [0.1, 0.2, 0.3] x its strength 2 were copied as they stood; now each colour turned, the glow's strength after
  assert.deepEqual(mat, {
    texture: 0, color: [...[0.5, 0.6, 0.7].map((c) => r6(srgb(c))), 1], emissive: null, emissiveColor: [0.1, 0.2, 0.3].map((c) => r6(srgb(c) * 2)), alpha: 'cutout', cutoff: 0.25,
    twoSided: true, wrap: ['clamp', 'repeat'], filter: 'nearest', uv: { offset: [0, 0], scale: [1, 1], rotation: 0 },
  });
});

test('POI-4 TRANSFORMS: the node tree baked whole (a child\'s TRS under its parent\'s); a mirroring node keeps its own winding; `nodes` keeps each instance a part, its turn baked and its translation its position; KHR_texture_transform baked into the UVs in the extension\'s order (mutants: the parent unread; the mirror unread; the normal by the plain matrix)', () => {
  // a parent moved 10 along X and turned 90 degrees about Y, its child moved 2 along Z
  const half = Math.SQRT1_2;
  const base = readGltf(quadGlb());
  const { json, bin } = chunksOf(quadGlb());
  json.nodes = [{ translation: [10, 0, 0], rotation: [0, half, 0, half], children: [1] }, { mesh: 0, translation: [0, 0, 2] }];
  json.scenes = [{ nodes: [0] }];
  const tree = readGltf(glb(json, bin));
  const [whole] = bakeGltf(tree);
  // the child's origin: R(90 about Y) * (0, 0, 2) + (10, 0, 0) = (12, 0, 0); mirrored, -12
  const p0 = [whole.mesh.positions[0], whole.mesh.positions[1], whole.mesh.positions[2]];
  assert.deepEqual(p0.map(r6), [-12, 0, 0]);
  // vertex 1 (1, 0, 0) turned 90 about Y is (0, 0, -1): (12, 0, -1) -> (-12, 0, -1)
  assert.deepEqual([whole.mesh.positions[3], whole.mesh.positions[4], whole.mesh.positions[5]].map(r6), [-12, 0, -1]);
  // the normal (0, 0, 1) turned is (1, 0, 0), mirrored (-1, 0, 0)
  assert.deepEqual([...whole.mesh.normals.subarray(0, 3)].map(r6), [-1, 0, 0]);

  const [byNode] = bakeGltf(tree, { split: 'nodes' });
  assert.deepEqual(byNode.position.map(r6), [-12, 0, 0], 'its translation the part\'s position');
  assert.deepEqual([...byNode.mesh.positions.subarray(0, 3)].map(r6), [0, 0, 0], 'its vertices about its own origin');

  // a mirroring node (scale -1 on X): glTF says its winding is already reversed - with ours, twice reversed is kept
  const mirrored = bakeGltf(readGltf(quadGlb({ node: { scale: [-1, 1, 1] } })))[0];
  assert.deepEqual([...mirrored.mesh.indices], [0, 1, 2, 0, 2, 3]);
  assert.deepEqual([...mirrored.mesh.positions.subarray(3, 6)], [1, 0, 0], 'mirrored twice: back where it was');
  assert.equal(base.instances.length, 1);

  // a non-uniform scale carries a normal by the inverse-transpose: the plane x + y = 1 stretched 2 along X leans its
  // normal toward Y - (1/2, 1, 0) normalised - never the plain matrix's (2, 1, 0); mirrored, X negated
  const slant = (() => {
    const { json: j, bin: b } = chunksOf(quadGlb({ node: { scale: [2, 1, 1] } }));
    const s2 = Math.SQRT1_2;
    const nb = new Float32Array([s2, s2, 0, s2, s2, 0, s2, s2, 0, s2, s2, 0]);
    const off = j.bufferViews[1].byteOffset;
    const bytes = new Uint8Array(b); bytes.set(new Uint8Array(nb.buffer), off);
    return bakeGltf(readGltf(glb(j, bytes)))[0];
  })();
  const want = [0.5, 1, 0].map((v) => v / Math.hypot(0.5, 1));
  assert.deepEqual([...slant.mesh.normals.subarray(0, 3)].map(r6), [-want[0], want[1], 0].map(r6));

  // KHR_texture_transform: offset (0.5, 0), rotation 0, scale (2, 2) - uv * 2 + offset
  const tt = bakeGltf(readGltf(quadGlb({ transform: { offset: [0.5, 0], scale: [2, 2] } })))[0];
  assert.deepEqual([...tt.mesh.uvs], [0.5, 2, 2.5, 2, 2.5, 0, 0.5, 0]);
  const [u, v] = applyTextureTransform({ rotation: Math.PI / 2 }, 1, 0);
  assert.deepEqual([Math.round(u * 1e9) / 1e9, Math.round(v * 1e9) / 1e9], [0, -1], 'rotation as the extension writes it');
});

test('POI-4 ACCESSORS AND TOPOLOGY: an interleaved buffer view read by its stride; normalized shorts; a sparse accessor over none (zeros, then its values); a strip and a fan as lists; a primitive with no normals given flat ones, one vertex a corner; morph targets at the mesh\'s weights (mutants: the stride unread; the sparse values unread; the flat normals unflipped)', () => {
  // interleaved: position (3 floats) and UV (2 normalized u16) in 16-byte strides
  const stride = 16;
  const inter = new ArrayBuffer(stride * 3);
  const dv = new DataView(inter);
  [[0, 0, 0, 0, 65535], [1, 0, 0, 65535, 65535], [0, 1, 0, 0, 0]].forEach(([x, y, z, s, t], i) => {
    dv.setFloat32(i * stride, x, true); dv.setFloat32(i * stride + 4, y, true); dv.setFloat32(i * stride + 8, z, true);
    dv.setUint16(i * stride + 12, s, true); dv.setUint16(i * stride + 14, t, true);
  });
  // sparse positions for a second mesh: a count-3 accessor with no buffer view, two vertices set
  const spIdx = new Uint8Array([1, 2]);
  const spVal = new Float32Array([2, 0, 0, 0, 2, 0]);
  // a strip of 4 vertices and a fan of 4 (indices), the morph target moving every vertex up by 1
  const stripIdx = new Uint16Array([0, 1, 2, 3]);
  const quadPos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]);
  const morph = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const { bin, views } = bufferOf([new Uint8Array(inter), spIdx, spVal, stripIdx, quadPos, morph]);
  views[0].byteStride = stride;
  const json = {
    asset, scenes: [{ nodes: [0, 1, 2, 3] }],
    nodes: [{ mesh: 0 }, { mesh: 1 }, { mesh: 2 }, { mesh: 3 }],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 } }] },
      { primitives: [{ attributes: { POSITION: 2 } }] },
      { primitives: [{ attributes: { POSITION: 4 }, indices: 3, mode: 5 }] },
      { weights: [0.5], primitives: [{ attributes: { POSITION: 4 }, indices: 3, mode: 6, targets: [{ POSITION: 5 }] }] },
    ],
    buffers: [{ byteLength: bin.byteLength }], bufferViews: views,
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 0, byteOffset: 12, componentType: 5123, normalized: true, count: 3, type: 'VEC2' },
      { componentType: 5126, count: 3, type: 'VEC3', sparse: { count: 2, indices: { bufferView: 1, componentType: 5121 }, values: { bufferView: 2 } } },
      { bufferView: 3, componentType: 5123, count: 4, type: 'SCALAR' },
      { bufferView: 4, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 5, componentType: 5126, count: 4, type: 'VEC3' },
    ],
  };
  const model = readGltf(glb(json, bin));
  const parts = bakeGltf(model, { split: 'nodes' });
  assert.equal(parts.length, 4);
  // interleaved, flat (no normals): one vertex per corner, UVs from the normalized shorts
  const a = parts[0].mesh;
  assert.deepEqual([...a.positions], [0, 0, 0, -1, 0, 0, 0, 1, 0], 'the strided positions, X mirrored');
  assert.deepEqual([...a.uvs].map(r6), [0, 1, 1, 1, 0, 0], 'the normalized shorts read off the same strides');
  assert.deepEqual([...a.indices], [0, 2, 1], 'one vertex a corner, the triangle wound back');
  // the flat normal of a triangle facing +Z stays +Z, read off the emitted order
  assert.deepEqual([...a.normals].map(r6), [0, 0, 1, 0, 0, 1, 0, 0, 1]);
  // sparse: vertex 0 zero, 1 and 2 set
  const b = parts[1].mesh;
  const pts = new Set([...Array(3)].map((_, i) => [b.positions[i * 3], b.positions[i * 3 + 1], b.positions[i * 3 + 2]].join(',')));
  assert.deepEqual(pts, new Set(['0,0,0', '-2,0,0', '0,2,0']));
  // strip: 4 vertices -> 2 triangles; fan: 4 -> 2
  assert.equal(parts[2].mesh.indices.length, 6);
  assert.equal(parts[3].mesh.indices.length, 6);
  // the morph target at weight 0.5: every vertex half a unit up
  const ys = new Set(); for (let i = 1; i < parts[3].mesh.positions.length; i += 3) ys.add(parts[3].mesh.positions[i]);
  assert.deepEqual([...ys].sort(), [0.5, 1.5]);
});

test('POI-4 .gltf: a JSON file with its .bin beside it and its image as a data URI; a URI to a file not given refused by name; EXT_texture_webp\'s source taken', () => {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const { bin, views } = bufferOf([pos]);
  const json = {
    asset, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    buffers: [{ uri: 'model%20data.bin', byteLength: bin.byteLength }], bufferViews: views,
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0, extensions: { EXT_texture_webp: { source: 1 } } }],
    images: [{ uri: `data:image/png;base64,${Buffer.from(PNG).toString('base64')}` }, { uri: 'tex.webp' }],
    extensionsUsed: ['EXT_texture_webp'],
  };
  const text = new TextEncoder().encode(JSON.stringify(json));
  const webp = new Uint8Array([1, 2, 3]);
  const model = readGltf(text, { files: new Map([['model data.bin', bin], ['tex.webp', webp]]) });
  assert.deepEqual(model.images[0].bytes, PNG);
  assert.equal(model.images[0].mime, 'image/png');
  assert.equal(model.materials[0].base.image, 1, 'the WebP source, where the extension names one');
  assert.deepEqual(model.warnings, [{ code: 'no-uvs', material: 'material0' }]);
  assert.deepEqual(refusal(() => readGltf(text, { files: new Map([['model data.bin', bin]]) })), { code: 'file-missing', uri: 'tex.webp' });
});

test('POI-4 REFUSALS: not glTF 2.0; Draco and meshopt compression named and refused; any other required extension refused; an accessor past its view; a node its own ancestor - each a GltfError with its code; points and lines, vertex colours, skins and animation set aside with a warning', () => {
  const plain = (extra) => new TextEncoder().encode(JSON.stringify({ asset, ...extra }));
  assert.deepEqual(refusal(() => readGltf(new TextEncoder().encode('{"asset":{"version":"1.0"}}'))), { code: 'not-gltf2' });
  assert.deepEqual(refusal(() => readGltf(new Uint8Array([1, 2, 3]))), { code: 'not-gltf' });
  assert.deepEqual(refusal(() => readGltf(plain({ extensionsRequired: ['KHR_draco_mesh_compression'] }))), { code: 'compressed', ext: 'KHR_draco_mesh_compression' });
  assert.deepEqual(refusal(() => readGltf(plain({ extensionsRequired: ['EXT_meshopt_compression'] }))), { code: 'compressed', ext: 'EXT_meshopt_compression' });
  assert.deepEqual(refusal(() => readGltf(plain({ extensionsRequired: ['KHR_materials_volume'] }))), { code: 'extension', ext: 'KHR_materials_volume' });
  const { bin, views } = bufferOf([new Float32Array([0, 0, 0])]);
  const json = (acc, nodes = [{ mesh: 0 }]) => ({ asset, scenes: [{ nodes: [0] }], nodes, meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: bin.byteLength }], bufferViews: views, accessors: [acc] });
  assert.deepEqual(refusal(() => readGltf(glb(json({ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }), bin))), { code: 'past-end', what: 'accessor', index: 0 });
  assert.deepEqual(refusal(() => readGltf(glb(json({ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }, [{ children: [0] }]), bin))), { code: 'node-cycle', index: 0 });
  // PIN MOVED (AUDIT POI G6): skins are read now (their saved pose baked), so the node's skin is one the file has - a skin
  // named and missing is refused `missing`, as a missing texture or node is
  const warned = readGltf(glb({ ...json({ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }), meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 0 }, mode: 1 }, { attributes: { POSITION: 0, COLOR_0: 0 } }] }], animations: [{}], nodes: [{ mesh: 0, skin: 0 }], skins: [{ joints: [0] }] }, bin));
  assert.deepEqual(codes(warned), ['skin', 'animation', 'points-lines', 'vertex-colours']);
});

test('POI-4 RECORDS: the importer is pure (no DOM, no fetch) and names the specification it is written to', () => {
  const s = src('src/poi/gltfImport.js');
  assert.doesNotMatch(s, /\b(document|window|fetch|XMLHttpRequest)\b\s*[.(]/);
  assert.match(s, /registry\.khronos\.org\/glTF\/specs\/2\.0/);
});
