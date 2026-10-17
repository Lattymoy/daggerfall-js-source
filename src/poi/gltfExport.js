// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-6 (2026-10-14) - A POI BACK OUT AS glTF 2.0: THE ROUND TRIP TO A BUILDER'S OWN MODELLING TOOL.
//
// Mac: "Allowing not just the creation of POI's using models, but also the ability to import models, texture, UV map"
// (bible/06-Systems/POI-Editor-Arc.md POI-6). What the editor imports (poi/gltfImport.js) it can write back: a POI's
// parts - or a library entry's - as one .glb a builder opens in Blender, changes, and imports again.
//
//   - THE FRAME, TURNED BACK: the game is Unity's left-handed frame (+Y up, +Z forward); glTF is right-handed, its asset
//     facing +Z. X is mirrored - a position's and a normal's x negated, a node's translation's x negated, its rotation
//     (x, y, z, w) written (x, -y, -z, w) (the same rotation seen in the mirror) - and every triangle's winding reversed
//     so its front stays its front: the importer's own conversion, which is its own inverse.
//   - ONE NODE A PART, under one root named for the POI: the part's offset, turn and size as the node's TRS, its mesh in
//     its own frame - so a builder sees the objects the editor showed, where it showed them. One mesh a part, a
//     primitive a submesh, each wearing its material; the vertices shared by its primitives.
//   - MATERIALS as the importer reads them: base colour factor and texture, emissive (normalised, the strength past one
//     in KHR_materials_emissive_strength) and its texture, alpha mode and cutoff, double-sidedness; metallic 0 and
//     roughness 1 (the game draws no PBR). Colours from the game's sRGB to glTF's linear. The picture's offset, repeats and turn as KHR_texture_transform on both
//     textures (the importer bakes it into the UVs). Samplers from the wrap and filter. Pictures embedded as stored -
//     PNG, JPEG, or WebP through EXT_texture_webp (then required: there is no fallback image).
//   - LIGHTS as KHR_lights_punctual point lights (colour, intensity, range = reach), on nodes of their own, in that
//     extension's units and the game's own numbers beside them - optional: a tool that does not read them leaves them.
//
// Pure - typed arrays in, bytes out. Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

// AUDIT POI R10: glTF's colour factors are LINEAR (the specification); the game's colours are sRGB (the editor's pickers,
// poiRuntime.js bakeAlbedo multiplying the picture's own bytes) - turned as Unity's Mathf.GammaToLinearSpace turns them,
// from its one home
import { srgbToLinear } from '../systems/dynamicSkies/dynamicSkies.js';

const GLB_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;
const WRAP_CODE = { repeat: 10497, clamp: 33071, mirror: 33648 };
const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const F32 = 5126, U16 = 5123, U32 = 5125;
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963;

/** The mirror across X, as a quaternion sees it: the same turn in the other hand. @param {number[]} q */
export const mirrorQuatX = (q) => [q[0], -q[1] + 0, -q[2] + 0, q[3]];

/**
 * A model as a .glb.
 * @param {{
 *   name: string,
 *   parts: { name?: string, key: string, mesh: { positions: ArrayLike<number>, normals: ArrayLike<number>, uvs: ArrayLike<number>, indices: ArrayLike<number>, submeshes: { start: number, count: number }[] },
 *     t: number[], r: number[], s: number[], materials: any[] }[],
 *   lights?: { t: number[], color: number[], radius: number, intensity: number, flicker?: boolean }[],
 *   pictures?: Map<string, { bytes: Uint8Array, format: 'png' | 'jpeg' | 'webp' }>,
 * }} model `pictures` each texture's stored bytes by its name (a picture not given is left out, its material plain)
 * @returns {Uint8Array}
 */
export function writeGlb({ name, parts, lights = [], pictures = new Map() }) {
  /** @type {any} */
  const g = { asset: { version: '2.0', generator: 'daggerfall-js poi' }, scene: 0, scenes: [{ name, nodes: [0] }], nodes: [{ name, children: [] }], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const used = new Set(), required = new Set();
  const chunks = [];
  let binLength = 0;
  /** A buffer view of these bytes, four-byte aligned in the BIN chunk. */
  const view = (bytes, target) => {
    const pad = (4 - (binLength % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); binLength += pad; }
    const v = { buffer: 0, byteOffset: binLength, byteLength: bytes.byteLength, ...(target ? { target } : {}) };
    chunks.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    binLength += bytes.byteLength;
    g.bufferViews.push(v);
    return g.bufferViews.length - 1;
  };
  const accessor = (a) => { g.accessors.push(a); return g.accessors.length - 1; };

  // ── PICTURES, TEXTURES, SAMPLERS ──
  const imageOf = new Map(), textureOf = new Map(), samplerOf = new Map();
  const image = (sha) => {
    if (imageOf.has(sha)) return imageOf.get(sha);
    const pic = pictures.get(sha);
    if (!pic || !MIME[pic.format]) { imageOf.set(sha, null); return null; }
    (g.images ??= []).push({ name: sha.slice(0, 12), bufferView: view(pic.bytes, 0), mimeType: MIME[pic.format] });
    imageOf.set(sha, { index: g.images.length - 1, format: pic.format });
    return imageOf.get(sha);
  };
  const sampler = (m) => {
    const key = `${m.wrap[0]}|${m.wrap[1]}|${m.filter}`;
    if (!samplerOf.has(key)) {
      (g.samplers ??= []).push({ wrapS: WRAP_CODE[m.wrap[0]], wrapT: WRAP_CODE[m.wrap[1]], magFilter: m.filter === 'nearest' ? 9728 : 9729, minFilter: m.filter === 'nearest' ? 9984 : 9987 });
      samplerOf.set(key, g.samplers.length - 1);
    }
    return samplerOf.get(key);
  };
  const texture = (sha, m) => {
    const im = image(sha);
    if (!im) return null;
    const key = `${sha}|${sampler(m)}`;
    if (!textureOf.has(key)) {
      const tex = { sampler: sampler(m) };
      // WebP has no fallback here: the extension names its source, and is required
      if (im.format === 'webp') { tex.extensions = { EXT_texture_webp: { source: im.index } }; used.add('EXT_texture_webp'); required.add('EXT_texture_webp'); } else tex.source = im.index;
      (g.textures ??= []).push(tex);
      textureOf.set(key, g.textures.length - 1);
    }
    return textureOf.get(key);
  };
  const textureRef = (index, m) => {
    const ref = { index };
    const uv = m.uv;
    if (uv && (uv.rotation || uv.offset[0] || uv.offset[1] || uv.scale[0] !== 1 || uv.scale[1] !== 1)) {
      ref.extensions = { KHR_texture_transform: { offset: [...uv.offset], rotation: uv.rotation, scale: [...uv.scale] } };
      used.add('KHR_texture_transform');
    }
    return ref;
  };

  // ── MATERIALS ──
  const material = (m, label) => {
    // AUDIT POI R10: the colour turned to linear, its alpha (no colour) as it is
    const out = { name: label, pbrMetallicRoughness: { baseColorFactor: [srgbToLinear(m.color[0]), srgbToLinear(m.color[1]), srgbToLinear(m.color[2]), m.color[3]], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: !!m.twoSided };
    if (m.texture) { const ti = texture(m.texture, m); if (ti !== null) out.pbrMetallicRoughness.baseColorTexture = textureRef(ti, m); }
    const strength = Math.max(...m.emissiveColor, 0);
    if (strength > 0) {
      const k = Math.max(strength, 1);
      // AUDIT POI R10: the glow's colour turned to linear, its strength laid on after (the editor's glow is its colour times
      // its strength, the importer's poiMaterialOf the same turned back)
      out.emissiveFactor = m.emissiveColor.map((c) => srgbToLinear(c / k));
      if (k > 1) { out.extensions = { KHR_materials_emissive_strength: { emissiveStrength: k } }; used.add('KHR_materials_emissive_strength'); }
    }
    if (m.emissive) {
      const ti = texture(m.emissive, m);
      // AUDIT POI G4: glTF's glow is its factor times its picture, the game's its colour times its picture (poiRuntime.js
      // bakeEmission) - so the factor is the one written above, and a glow picture at no strength (the editor's default)
      // writes none, glTF's [0, 0, 0]: it glows no more in a builder's tool, nor back in the editor, than in the game. A
      // factor of [1, 1, 1] laid under it made a picture that did not glow come back glowing.
      if (ti !== null) out.emissiveTexture = textureRef(ti, m);
    }
    if (m.alpha === 'cutout') { out.alphaMode = 'MASK'; out.alphaCutoff = m.cutoff; } else if (m.alpha === 'blend') out.alphaMode = 'BLEND';
    g.materials.push(out);
    return g.materials.length - 1;
  };

  // ── PARTS: a node and a mesh each ──
  for (const part of parts) {
    const mesh = part.mesh, V = mesh.positions.length / 3;
    const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = Float32Array.from(mesh.uvs);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < V; v++) {
      // the mirror: x negated (a mirrored zero written as zero)
      pos[v * 3] = -mesh.positions[v * 3] + 0; pos[v * 3 + 1] = mesh.positions[v * 3 + 1]; pos[v * 3 + 2] = mesh.positions[v * 3 + 2];
      nor[v * 3] = -mesh.normals[v * 3] + 0; nor[v * 3 + 1] = mesh.normals[v * 3 + 1]; nor[v * 3 + 2] = mesh.normals[v * 3 + 2];
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[v * 3 + k]); hi[k] = Math.max(hi[k], pos[v * 3 + k]); }
    }
    const P = accessor({ bufferView: view(pos, ARRAY_BUFFER), componentType: F32, count: V, type: 'VEC3', min: V ? lo : [0, 0, 0], max: V ? hi : [0, 0, 0] });
    const N = accessor({ bufferView: view(nor, ARRAY_BUFFER), componentType: F32, count: V, type: 'VEC3' });
    const T = accessor({ bufferView: view(uv, ARRAY_BUFFER), componentType: F32, count: V, type: 'VEC2' });
    const wide = V > 65535;
    const label = part.name || part.key;
    const primitives = mesh.submeshes.map((sm, k) => {
      const idx = wide ? new Uint32Array(sm.count) : new Uint16Array(sm.count);
      // the winding reversed with the mirror: (a, b, c) written (a, c, b)
      for (let i = 0; i + 2 < sm.count; i += 3) {
        idx[i] = mesh.indices[sm.start + i]; idx[i + 1] = mesh.indices[sm.start + i + 2]; idx[i + 2] = mesh.indices[sm.start + i + 1];
      }
      const I = accessor({ bufferView: view(idx, ELEMENT_ARRAY_BUFFER), componentType: wide ? U32 : U16, count: sm.count, type: 'SCALAR' });
      return { attributes: { POSITION: P, NORMAL: N, TEXCOORD_0: T }, indices: I, material: material(part.materials[k], `${label} ${k + 1}`), mode: 4 };
    });
    g.meshes.push({ name: label, primitives });
    g.nodes.push({ name: label, mesh: g.meshes.length - 1, translation: [-part.t[0] + 0, part.t[1], part.t[2]], rotation: mirrorQuatX(part.r), scale: [...part.s] });
    g.nodes[0].children.push(g.nodes.length - 1);
  }

  // ── LIGHTS ──
  if (lights.length) {
    used.add('KHR_lights_punctual');
    // AUDIT POI G7: KHR_lights_punctual's point intensity is in candela and its colour linear; the game's intensity is a
    // multiplier (0 to 10) of a colour picked in sRGB - written as glTFast writes a light of Unity's built-in pipeline
    // (KhrLightsPunctual.cs ConvertToLight: `uLight.intensity * Mathf.PI`, `uLight.color.linear`), the game's frame's own,
    // and the game's own numbers beside them in `extras.poi`, which the importer takes back while the light still says
    // what they say (gltfImport.js poiLightOf). Written as it was, the intensity reached Blender as a four-hundredth of a
    // watt.
    g.extensions = { KHR_lights_punctual: { lights: lights.map((l) => ({
      type: 'point', color: l.color.map(srgbToLinear), intensity: l.intensity * Math.PI, range: l.radius,
      extras: { poi: { color: [...l.color], intensity: l.intensity, radius: l.radius, flicker: !!l.flicker } },
    })) } };
    lights.forEach((l, i) => {
      g.nodes.push({ name: `light ${i + 1}`, translation: [-l.t[0] + 0, l.t[1], l.t[2]], extensions: { KHR_lights_punctual: { light: i } } });
      g.nodes[0].children.push(g.nodes.length - 1);
    });
  }

  if (used.size) g.extensionsUsed = [...used].sort();
  if (required.size) g.extensionsRequired = [...required].sort();
  for (const k of ['meshes', 'materials', 'accessors', 'bufferViews']) if (!g[k].length) delete g[k];
  if (!g.nodes[0].children.length) delete g.nodes[0].children;
  const padTo4 = (n) => (n + 3) & ~3;
  const binTotal = padTo4(binLength);
  if (binTotal) g.buffers = [{ byteLength: binTotal }]; else delete g.buffers;

  // ── THE CONTAINER: header, JSON chunk (padded with spaces), BIN chunk (padded with zeros) ──
  const json = new TextEncoder().encode(JSON.stringify(g));
  const jsonLen = padTo4(json.byteLength);
  const total = 12 + 8 + jsonLen + (binTotal ? 8 + binTotal : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, GLB_MAGIC, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true); dv.setUint32(16, CHUNK_JSON, true);
  out.set(json, 20);
  out.fill(0x20, 20 + json.byteLength, 20 + jsonLen);
  if (binTotal) {
    let at = 20 + jsonLen;
    dv.setUint32(at, binTotal, true); dv.setUint32(at + 4, CHUNK_BIN, true);
    at += 8;
    for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  }
  return out;
}
