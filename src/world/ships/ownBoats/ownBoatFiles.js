// @ts-check
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): COME SAIL AWAY'S FILES, OURS - the
// twelve prefabs (the trigger boxes 112400-112406, the hulls 112410-112414), their shared component table, their meshes
// (records over one buffer, as systems/comeSailAway/comeSailAwayModels.js decodes them), materials and animation.
// Come Sail Away 2.1 carried its author's models; ours are built at the load by this folder's builders, nothing read
// off the author's files, every name and place the runtime reads kept (comeSailAwayBoat.js getBoatTransforms).
// `ownBoatFiles()` builds them once a process. Not a DFU member.
import { ownBench, triggerBox, nodeOf } from './ownBoatKit.js';
import { CONTROLLERS, baseClips } from './ownBoatAnimation.js';
import { buildRowboat } from './ownRowboat.js';
import { buildSkiff } from './ownSkiff.js';
import { buildSmallShip } from './ownSmallShip.js';
import { buildGalley } from './ownGalley.js';
import { buildCarrack } from './ownCarrack.js';

/** The seven trigger prefabs, each a unit trigger box (comeSailAwayBoat.js TRIGGER_MODEL's numbers). */
export const TRIGGER_PREFAB_IDS = Object.freeze([112400, 112401, 112402, 112403, 112404, 112405, 112406]);

/** The materials our boats' renderers and effects name: the effects' three and the waves', and the water mask's. */
export const OWN_MATERIALS = Object.freeze({
  WakeMaterial: Object.freeze({
    shader: 'Daggerfall/BillboardWaterMasked',
    textures: { _MainTex: { texture: '112395_0-0' } },
    floats: { _Cutoff: 0.5 },
  }),
  'Default-Particle': Object.freeze({
    shader: 'Particles/Alpha Blended Premultiply',
    textures: { _MainTex: { texture: 'Default-Particle' } },
  }),
  FlagMaterial: Object.freeze({ shader: 'Daggerfall/Default', colors: { _Color: [1, 0.5, 0, 1] } }),
  CurrentMaterial: Object.freeze({
    shader: 'Daggerfall/Dither/Wave',
    textures: { _MainTex: { texture: '112395_2-0', scale: [10, 10] } },
  }),
  WaterMaskMaterial: Object.freeze({ shader: 'WaterMask/Mask', colors: { _Color: [1, 1, 1, 1] } }),
  'Default-Material': Object.freeze({ shader: 'Standard', colors: { _Color: [1, 1, 1, 1] } }),
  'own-canvas': Object.freeze({ shader: 'Standard' }),
});

/** A column-major 4x4 as Unity serializes a Matrix4x4 (row by row). */
const unityRows = (matrix) => {
  const out = [];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) out.push(matrix[column * 4 + row]);
  return out;
};

/**
 * The meshes as meshes.json's records over one buffer (comeSailAwayModels.js decodeMeshGeometry reads them): each
 * channel at its offset (position f32x3, normal f32x3, uv0 f32x2, a skinned mesh's bone index u16), its indices u32,
 * its sub-meshes, its box and a skinned mesh's bind poses.
 * @param {Record<string, any>} geometries
 */
export function encodeMeshes(geometries) {
  const records = {};
  const parts = [];
  let at = 0;
  const put = (typed) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    parts.push(bytes);
    if (pad) parts.push(new Uint8Array(pad));
    const offset = at;
    at += bytes.length + pad;
    return offset;
  };
  for (const [key, geometry] of Object.entries(geometries)) {
    const n = geometry.vertexCount;
    const attributes = {
      position: { offset: put(Float32Array.from(geometry.positions)), type: 'f32', dim: 3 },
      normal: { offset: put(Float32Array.from(geometry.normals ?? new Float32Array(n * 3))), type: 'f32', dim: 3 },
      uv0: { offset: put(Float32Array.from(geometry.uvs ?? new Float32Array(n * 2))), type: 'f32', dim: 2 },
    };
    if (geometry.blendIndices)
      attributes.blendIndices = { offset: put(Uint16Array.from(geometry.blendIndices)), type: 'u16', dim: 1 };
    const indices = { offset: put(Uint32Array.from(geometry.indices)), type: 'u32', count: geometry.indices.length };
    const submeshes = geometry.subMeshes.map((subMesh) => ({
      start: subMesh.startIndex,
      count: subMesh.primitiveCount * 3,
      baseVertex: 0,
    }));
    const rec = {
      vertexCount: n,
      attributes,
      indices,
      submeshes,
      aabb: { center: [...geometry.aabb.center], extent: [...geometry.aabb.extent] },
    };
    if (geometry.bindPoses) rec.bindPoses = geometry.bindPoses.map(unityRows);
    records[key] = rec;
  }
  const bin = new Uint8Array(at);
  let cursor = 0;
  for (const part of parts) {
    bin.set(part, cursor);
    cursor += part.length;
  }
  return { meshes: records, bin };
}

/** Every node's transform in Unity's floats, as a prefab stores it. */
function inFloats(n) {
  for (const k of ['position', 'rotation', 'scale']) n[k] = n[k].map(Math.fround);
  for (const child of n.children) inFloats(child);
}

/** Every file, built afresh - the shapes comeSailAwayModels() takes (deterministic: the same to the byte each time). */
export function buildOwnBoatFiles() {
  const k = ownBench();
  const anim = { controllers: { ...CONTROLLERS }, overrides: {}, clips: baseClips() };
  const trigger = k.comp(triggerBox());
  /** @type {Record<string, any>} */
  const prefabs = {};
  for (const id of TRIGGER_PREFAB_IDS) prefabs[String(id)] = nodeOf(String(id), { c: [trigger] });
  const hulls = [
    buildRowboat(k, anim),
    buildSkiff(k, anim),
    buildSmallShip(k, anim),
    buildGalley(k, anim),
    buildCarrack(k, anim),
  ];
  k.finish(hulls);
  for (const hull of hulls) {
    inFloats(hull);
    prefabs[hull.name] = hull;
  }
  const { meshes, bin } = encodeMeshes(k.meshes);
  return {
    prefabs: { prefabs, components: k.components },
    meshes,
    bin,
    materials: OWN_MATERIALS,
    animation: anim,
  };
}

let _files = null;
/** The files, built once a process (a caller copies what it changes: comeSailAwayModels() never writes them). */
export function ownBoatFiles() {
  _files ??= buildOwnBoatFiles();
  return _files;
}
