// CSA-A (2026-09-27): A UNITY BUNDLE'S PREFABS, MESHES, MATERIALS AND ANIMATION,
// READ OFF ITS TYPE TREES INTO PLAIN DATA (tools/comeSailAwayExtract.mjs).
//
// src/formats/unity/unityBundle.js reads any object through its type tree; this
// module knows what a few classes MEAN, so a prefab comes out as the tree
// the mod's C# walks by name (GameObject, Transform, the components on each
// node) and the assets it points at come out as data the port can draw and
// animate without Unity:
//
// - MESHES (class 43): Unity 2019's VertexData - channels laid in streams,
//   each stream 16-byte aligned, a channel's format and dimension packed in
//   one byte (the low nibble the dimension) - or, for a big mesh, the same
//   bytes in the `.resS` at m_StreamData. Position, normal, uv0 and the
//   single-bone blend index are what the boats' shaders and skinning read;
//   the index buffer (16- or 32-bit) with its submeshes; the bind poses and
//   bone-name hashes of a skinned mesh.
// - MATERIALS (21): shader, textures, floats, colours, keywords.
// - ANIMATION CLIPS (74): Unity strips a Mecanim clip's editor curves from a
//   build and keeps its MUSCLE CLIP - curves as a streamed clip (Hermite
//   segments: at each key's time the curve's cubic coefficients a, b, c, d,
//   value = ((a t + b) t + c) t + d for t the time since the key), a dense
//   clip (samples at a rate) and a constant clip (one value a curve). The
//   curves are numbered streamed first, then dense, then constant, and the
//   genericBindings say what each is: a transform's position (3 curves),
//   rotation (4, a quaternion), scale (3) or euler angles (3), named by the
//   CRC32 of the transform's path from the Animator (AssetStudio's
//   AnimationClipConverter reads them the same way).
// - ANIMATOR CONTROLLERS (91) and OVERRIDES (221): the compiled state
//   machines - states, their motions (a clip or a blend tree), transitions
//   and conditions, the parameters - with every name taken from the
//   controller's own id table (m_TOS).

import zlib from 'node:zlib';
import { readUnityFs, readSerializedFile } from '../../src/formats/unity/unityBundle.js';

/** Unity's class ids this module reads. */
export const UCLASS = Object.freeze({
  GameObject: 1, Transform: 4, Material: 21, MeshRenderer: 23, Texture2D: 28, MeshFilter: 33, Mesh: 43, Shader: 48,
  MeshCollider: 64, BoxCollider: 65, AnimationClip: 74, AudioSource: 82, AudioClip: 83, AnimatorController: 91,
  Animator: 95, MonoBehaviour: 114, MonoScript: 115, SkinnedMeshRenderer: 137, AssetBundle: 142,
  ParticleSystem: 198, ParticleSystemRenderer: 199, AnimatorOverrideController: 221,
});

const key = (pptr) => (pptr && (pptr.m_PathID !== 0n && pptr.m_PathID !== 0) ? `${pptr.m_FileID}:${String(pptr.m_PathID)}` : null);

/** The bundle opened for reading: its objects by path id, each read once. */
export function openScene(bytes) {
  const fs = readUnityFs(bytes);
  const main = fs.files.find((f) => !/\.res(S|ource)$/.test(f.path));
  const sf = readSerializedFile(main, main.path);
  const byPath = new Map(sf.objects.map((o) => [`0:${String(o.pathId)}`, o]));
  const cache = new Map();
  const get = (pptr) => {
    const k = typeof pptr === 'string' ? pptr : key(pptr);
    if (!k) return null;
    if (!cache.has(k)) {
      const o = byPath.get(k);
      cache.set(k, o ? { classId: o.classId, pathId: String(o.pathId), v: o.read() } : null);
    }
    return cache.get(k);
  };
  const resource = (path, offset, size) => {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const f = fs.files.find((x) => x.path === base || x.path === path);
    if (!f) throw new Error(`the bundle has no stream ${path}`);
    return f.read(offset, size);
  };
  const ofClass = (classId) => sf.objects.filter((o) => o.classId === classId).map((o) => get(`0:${String(o.pathId)}`));
  return { sf, get, resource, ofClass };
}

// ---- meshes -----------------------------------------------------------------

/** VertexFormat (2019.x): Float, Float16, UNorm8, SNorm8, UNorm16, SNorm16, UInt8, SInt8, UInt16, SInt16, UInt32, SInt32. */
const FORMAT_SIZE = [4, 2, 1, 1, 2, 2, 1, 1, 2, 2, 4, 4];
/** The 14 channels of 2019's VertexData, in order. */
export const MESH_CHANNELS = Object.freeze(['position', 'normal', 'tangent', 'color', 'uv0', 'uv1', 'uv2', 'uv3', 'uv4', 'uv5', 'uv6', 'uv7', 'blendWeight', 'blendIndices']);

const half = (h) => {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
};

/**
 * A Mesh's vertex channels, index buffer and submeshes.
 * @returns {{ name:string, vertexCount:number, channels: Object<string,{dim:number,format:number,data:Float32Array|Int32Array}>,
 *   indices: Uint16Array|Uint32Array, submeshes: {start:number,count:number,baseVertex:number,topology:number}[],
 *   bindPoses:number[][], boneNameHashes:number[], rootBoneNameHash:number, aabb:{center:number[],extent:number[]} }}
 */
export function decodeMesh(m, resource) {
  const vd = m.m_VertexData;
  const n = vd.m_VertexCount;
  let data = vd.m_DataSize;
  if ((!data || !data.length) && m.m_StreamData?.size) data = resource(m.m_StreamData.path, Number(m.m_StreamData.offset), Number(m.m_StreamData.size));
  if (m.m_MeshCompression) throw new Error(`${m.m_Name}: a compressed mesh (${m.m_MeshCompression}) - this reader takes raw vertex data`);
  const chans = vd.m_Channels;
  const streamCount = 1 + Math.max(...chans.map((c) => c.stream));
  const streams = [];
  let offset = 0;
  for (let s = 0; s < streamCount; s++) {
    let stride = 0;
    for (const c of chans) if (c.stream === s && (c.dimension & 0xf) > 0) stride += (c.dimension & 0xf) * FORMAT_SIZE[c.format];
    streams.push({ offset, stride });
    offset += n * stride;
    offset = (offset + 15) & ~15;
  }
  if (offset > data.length + 15) throw new Error(`${m.m_Name}: the streams need ${offset} bytes, the vertex data has ${data.length}`);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const channels = {};
  chans.forEach((c, ci) => {
    const dim = c.dimension & 0xf;
    if (!dim) return;
    const st = streams[c.stream];
    const integer = c.format >= 6;
    const arr = integer ? new Int32Array(n * dim) : new Float32Array(n * dim);
    for (let v = 0; v < n; v++) {
      for (let d = 0; d < dim; d++) {
        const p = st.offset + c.offset + st.stride * v + d * FORMAT_SIZE[c.format];
        let x;
        switch (c.format) {
          case 0: x = dv.getFloat32(p, true); break;
          case 1: x = half(dv.getUint16(p, true)); break;
          case 2: x = dv.getUint8(p) / 255; break;
          case 3: x = Math.max(dv.getInt8(p) / 127, -1); break;
          case 4: x = dv.getUint16(p, true) / 65535; break;
          case 5: x = Math.max(dv.getInt16(p, true) / 32767, -1); break;
          case 6: x = dv.getUint8(p); break;
          case 7: x = dv.getInt8(p); break;
          case 8: x = dv.getUint16(p, true); break;
          case 9: x = dv.getInt16(p, true); break;
          case 10: x = dv.getUint32(p, true); break;
          case 11: x = dv.getInt32(p, true); break;
          default: throw new Error(`${m.m_Name}: vertex format ${c.format}`);
        }
        arr[v * dim + d] = x;
      }
    }
    channels[MESH_CHANNELS[ci]] = { dim, format: c.format, data: arr };
  });
  const ib = m.m_IndexBuffer;
  const is32 = m.m_IndexFormat === 1;
  const idv = new DataView(ib.buffer, ib.byteOffset, ib.byteLength);
  const indices = is32 ? new Uint32Array(ib.length / 4) : new Uint16Array(ib.length / 2);
  for (let i = 0; i < indices.length; i++) indices[i] = is32 ? idv.getUint32(i * 4, true) : idv.getUint16(i * 2, true);
  const submeshes = m.m_SubMeshes.map((s) => ({ start: s.firstByte / (is32 ? 4 : 2), count: s.indexCount, baseVertex: s.baseVertex, topology: s.topology }));
  for (const s of submeshes) {
    if (s.topology !== 0) throw new Error(`${m.m_Name}: submesh topology ${s.topology} (this reader takes triangles)`);
    for (let i = s.start; i < s.start + s.count; i++) if (indices[i] + s.baseVertex >= n) throw new Error(`${m.m_Name}: an index past its ${n} vertices`);
  }
  const v3 = (p) => [p.x, p.y, p.z];
  return {
    name: m.m_Name, vertexCount: n, channels, indices, submeshes,
    bindPoses: (m.m_BindPose ?? []).map((b) => [b.e00, b.e01, b.e02, b.e03, b.e10, b.e11, b.e12, b.e13, b.e20, b.e21, b.e22, b.e23, b.e30, b.e31, b.e32, b.e33]),
    boneNameHashes: [...(m.m_BoneNameHashes ?? [])],
    rootBoneNameHash: m.m_RootBoneNameHash ?? 0,
    aabb: { center: v3(m.m_LocalAABB.m_Center), extent: v3(m.m_LocalAABB.m_Extent) },
  };
}

// ---- animation -------------------------------------------------------------

/** How many curves a Transform binding's attribute carries (AnimationClipConverter's FindBinding). */
export function bindingCurves(b) {
  if (b.typeID !== UCLASS.Transform) return 1;
  return b.attribute === 2 ? 4 : (b.attribute === 1 || b.attribute === 3 || b.attribute === 4) ? 3 : 1;
}
export const TRANSFORM_ATTRIBUTE = Object.freeze({ 1: 'position', 2: 'rotation', 3: 'scale', 4: 'euler' });

/** A streamed clip's frames: each a time and the keys that start there (a curve index and its cubic's a, b, c, d). */
export function readStreamedFrames(words) {
  const buf = new DataView(new Uint32Array(words).buffer);
  const frames = [];
  let o = 0;
  while (o < buf.byteLength) {
    const time = buf.getFloat32(o, true);
    const count = buf.getInt32(o + 4, true);
    o += 8;
    const keys = [];
    for (let k = 0; k < count; k++) {
      keys.push({ index: buf.getInt32(o, true), a: buf.getFloat32(o + 4, true), b: buf.getFloat32(o + 8, true), c: buf.getFloat32(o + 12, true), d: buf.getFloat32(o + 16, true) });
      o += 20;
    }
    frames.push({ time, keys });
  }
  return frames;
}

/**
 * An AnimationClip's muscle clip as curves: for each binding, its path hash,
 * what it animates and, per component, either a constant or the streamed
 * segments [time, a, b, c, d] (value = ((a t + b) t + c) t + d, t from the
 * segment's time) or dense samples.
 */
export function decodeClip(c) {
  const mc = c.m_MuscleClip;
  const cl = mc.m_Clip.data ?? mc.m_Clip;
  const streamedCount = cl.m_StreamedClip.curveCount;
  const dense = cl.m_DenseClip;
  const constant = [...cl.m_ConstantClip.data];
  const perCurve = [];
  const frames = streamedCount ? readStreamedFrames(cl.m_StreamedClip.data) : [];
  for (let i = 0; i < streamedCount; i++) perCurve.push({ streamed: [] });
  for (const f of frames) {
    for (const k of f.keys) {
      if (k.index < 0 || k.index >= streamedCount) continue;   // Unity writes a sentinel frame at +/-infinity whose keys may name no curve
      perCurve[k.index].streamed.push([f.time, k.a, k.b, k.c, k.d]);
    }
  }
  for (let i = 0; i < dense.m_CurveCount; i++) {
    const samples = [];
    for (let fr = 0; fr < dense.m_FrameCount; fr++) samples.push(dense.m_SampleArray[fr * dense.m_CurveCount + i]);
    perCurve.push({ dense: samples });
  }
  for (const v of constant) perCurve.push({ constant: v });
  const bindings = c.m_ClipBindingConstant.genericBindings;
  const curves = [];
  let at = 0;
  for (const b of bindings) {
    const count = bindingCurves(b);
    if (b.typeID !== UCLASS.Transform || !TRANSFORM_ATTRIBUTE[b.attribute]) throw new Error(`${c.m_Name}: a binding of class ${b.typeID} attribute ${b.attribute} - this reader takes transform curves`);
    curves.push({ path: b.path >>> 0, attribute: TRANSFORM_ATTRIBUTE[b.attribute], components: perCurve.slice(at, at + count) });
    at += count;
  }
  if (at !== perCurve.length) throw new Error(`${c.m_Name}: the bindings name ${at} curves, the clip holds ${perCurve.length}`);
  return {
    name: c.m_Name,
    start: mc.m_StartTime, stop: mc.m_StopTime, sampleRate: c.m_SampleRate, loop: !!mc.m_LoopTime, wrapMode: c.m_WrapMode,
    denseRate: dense.m_SampleRate, denseBegin: dense.m_BeginTime,
    events: (c.m_Events ?? []).map((e) => ({ time: e.time, functionName: e.functionName, data: e.data, float: e.floatParameter, int: e.intParameter })),
    curves,
  };
}

/** Unity's path hash: CRC32 of the UTF-8 transform path from the Animator's node (`Bones/Mast/Yard`). */
export const pathHash = (path) => zlib.crc32(Buffer.from(path, 'utf8')) >>> 0;

/** Animator condition modes (AnimatorConditionMode). */
const CONDITION = Object.freeze({ 1: 'If', 2: 'IfNot', 3: 'Greater', 4: 'Less', 6: 'Equals', 7: 'NotEqual' });
/** Animator parameter types. */
const PARAM_TYPE = Object.freeze({ 1: 'Float', 3: 'Int', 4: 'Bool', 9: 'Trigger' });

/**
 * A compiled AnimatorController as data: its parameters, and per layer the
 * state machine's states (motion, speed, loop, transitions) - every id named
 * through the controller's own m_TOS.
 * @param {(index:number) => string|null} clipName the controller's m_AnimationClips[index], by name
 */
export function decodeController(ctl, clipName) {
  const tos = new Map(ctl.m_TOS.map((p) => [p.first >>> 0, p.second]));
  const name = (id) => (id && (id >>> 0) !== 0xffffffff ? tos.get(id >>> 0) ?? `#${id >>> 0}` : null);
  const cc = ctl.m_Controller;
  const values = (cc.m_Values.data ?? cc.m_Values).m_ValueArray;
  const defaults = cc.m_DefaultValues.data ?? cc.m_DefaultValues;
  const params = values.map((v) => {
    const type = PARAM_TYPE[v.m_Type] ?? v.m_Type;
    const pool = type === 'Float' ? defaults.m_FloatValues : type === 'Int' ? defaults.m_IntValues : defaults.m_BoolValues;
    return { name: name(v.m_ID), type, default: pool?.[v.m_Index] ?? null };
  });
  const condition = (c) => ({ mode: CONDITION[c.m_ConditionMode] ?? c.m_ConditionMode, param: name(c.m_EventID), threshold: c.m_EventThreshold, exitTime: c.m_ExitTime });
  const transition = (t, states) => {
    const tr = t.data ?? t;
    const dest = tr.m_DestinationState;
    return {
      to: dest < states.length ? name(states[dest].m_NameID) : (dest >= 30000 ? 'Exit' : dest),
      duration: tr.m_TransitionDuration, offset: tr.m_TransitionOffset, exitTime: tr.m_ExitTime, hasExitTime: !!tr.m_HasExitTime,
      hasFixedDuration: !!tr.m_HasFixedDuration, interruption: tr.m_InterruptionSource, orderedInterruption: !!tr.m_OrderedInterruption,
      canTransitionToSelf: !!tr.m_CanTransitionToSelf, conditions: (tr.m_ConditionConstantArray ?? []).map((c) => condition(c.data ?? c)),
    };
  };
  const blendTree = (bt) => {
    const nodes = (bt.data ?? bt).m_NodeArray.map((nd) => nd.data ?? nd);
    const node = (nd) => ({
      type: nd.m_BlendType, param: name(nd.m_BlendEventID), paramY: name(nd.m_BlendEventYID), duration: nd.m_Duration,
      clip: nd.m_ClipID !== 0xffffffff && nd.m_ClipID !== -1 ? clipName(nd.m_ClipID) : null,
      children: [...(nd.m_ChildIndices ?? [])], thresholds: [...((nd.m_Blend1dData?.data ?? nd.m_Blend1dData)?.m_ChildThresholdArray ?? [])],
      positions: [...((nd.m_Blend2dData?.data ?? nd.m_Blend2dData)?.m_ChildPositionArray ?? [])].map((p) => [p.x, p.y]),
      timeScale: nd.m_CycleOffset, mirror: !!nd.m_Mirror,
    });
    return nodes.map(node);
  };
  const layers = cc.m_LayerArray.map((l) => {
    const layer = l.data ?? l;
    const sm = cc.m_StateMachineArray[layer.m_StateMachineIndex].data ?? cc.m_StateMachineArray[layer.m_StateMachineIndex];
    const states = sm.m_StateConstantArray.map((s) => s.data ?? s);
    return {
      name: name(layer.m_Binding), weight: layer.m_DefaultWeight, blending: layer.m_LayerBlendingMode,
      defaultState: states[sm.m_DefaultState] ? name(states[sm.m_DefaultState].m_NameID) : null,
      anyState: (sm.m_AnyStateTransitionConstantArray ?? []).map((t) => transition(t, states)),
      states: states.map((s) => ({
        name: name(s.m_NameID), fullPath: name(s.m_FullPathID), tag: name(s.m_TagID), speed: s.m_Speed, speedParam: name(s.m_SpeedParamID),
        cycleOffset: s.m_CycleOffset, loop: !!s.m_Loop, mirror: !!s.m_Mirror, writeDefaults: !!s.m_WriteDefaultValues,
        motion: s.m_BlendTreeConstantArray.length ? blendTree(s.m_BlendTreeConstantArray[0]) : null,
        transitions: s.m_TransitionConstantArray.map((t) => transition(t, states)),
      })),
    };
  });
  return { name: ctl.m_Name, params, layers, clips: ctl.m_AnimationClips.map((_, i) => clipName(i)) };
}

// ---- prefabs ---------------------------------------------------------------

/** Unity's own primitive meshes in "Library/unity default resources", by local id. */
export const BUILTIN_MESH = Object.freeze({ 10202: 'Cube', 10206: 'Cylinder', 10207: 'Sphere', 10208: 'Capsule', 10209: 'Plane', 10210: 'Quad' });
const UNITY_DEFAULT_RESOURCES = 'Library/unity default resources';

const isPPtr = (v) => v && typeof v === 'object' && 'm_FileID' in v && 'm_PathID' in v && Object.keys(v).length === 2;
const ASSET_KIND = Object.freeze({
  [UCLASS.Mesh]: 'mesh', [UCLASS.Material]: 'material', [UCLASS.AnimatorController]: 'controller',
  [UCLASS.AnimatorOverrideController]: 'controller', [UCLASS.AudioClip]: 'audio', [UCLASS.Texture2D]: 'texture',
  [UCLASS.Shader]: 'shader', [UCLASS.MonoScript]: 'script', [UCLASS.AnimationClip]: 'clip',
});

/**
 * The assets a set of prefabs names, collected as they are met: each gets a
 * key (its name, or its name and path id where two share a name) and the
 * prefab JSON carries `{ <kind>: key }` where Unity held a pointer.
 */
export function assetRefs(scene) {
  const byKind = new Map();
  const names = new Map();   // kind -> name -> [pathIds]
  for (const o of scene.sf.objects) {
    const kind = ASSET_KIND[o.classId];
    if (!kind) continue;
    const v = scene.get(`0:${String(o.pathId)}`).v;
    const n = kind === 'script' ? v.m_ClassName : v.m_Name ?? '';
    const m = names.get(kind) ?? new Map();
    m.set(n, [...(m.get(n) ?? []), String(o.pathId)]);
    names.set(kind, m);
  }
  // two assets of one kind and one name share the name when they are the same asset byte for byte (a material
  // Unity copied into each prefab that used it); only a real collision is told apart by its path id
  const content = (pathId) => JSON.stringify(scene.get(`0:${pathId}`).v, (k, x) => (typeof x === 'bigint' ? String(x) : x instanceof Uint8Array ? Buffer.from(x).toString('base64') : x));
  const sameAll = new Map();
  // an asset the bundle lists by path is told apart by its folder (`rowboatanimations/Rudder Rowing Right`),
  // one it does not (a clip inside a model) by its path id
  const folderOf = new Map();
  const ab = scene.sf.objects.find((o) => o.classId === UCLASS.AssetBundle);
  if (ab) for (const e of scene.get(`0:${String(ab.pathId)}`).v.m_Container) {
    const parts = e.first.split('/');
    folderOf.set(String(e.second.asset.m_PathID), parts.length > 1 ? parts[parts.length - 2] : '');
  }
  const keyOf = (kind, n, pathId) => {
    const ids = names.get(kind)?.get(n) ?? [];
    if (ids.length <= 1) return n;
    const k = `${kind}\u0000${n}`;
    if (!sameAll.has(k)) { const first = content(ids[0]); sameAll.set(k, ids.every((id) => content(id) === first)); }
    if (sameAll.get(k)) return n;
    const folders = ids.map((id) => folderOf.get(id));
    const mine = folderOf.get(pathId);
    return mine != null && folders.filter((f) => f === mine).length === 1 ? `${mine}/${n}` : `${n}#${pathId}`;
  };
  const ref = (pptr) => {
    const t = scene.get(pptr);
    if (!t) return null;
    const kind = ASSET_KIND[t.classId];
    if (!kind) return null;
    const n = kind === 'script' ? t.v.m_ClassName : t.v.m_Name ?? '';
    const k = keyOf(kind, n, t.pathId);
    const m = byKind.get(kind) ?? new Map();
    if (!m.has(k)) m.set(k, t);
    byKind.set(kind, m);
    return { [kind]: k };
  };
  return { ref, used: (kind) => byKind.get(kind) ?? new Map(), keyOf };
}

/**
 * A prefab's tree, rooted at its GameObject: each node's name, active flag,
 * layer, tag, local position / rotation (x, y, z, w) / scale, components and
 * children, in Unity's order. A pointer to a node of the same prefab becomes
 * `{ node: 'Root/Child/...' }` (a component of one, `{ node, component: 'ParticleSystem' }`); to an asset, `{ mesh: key }` and the like
 * (assetRefs); to nothing, null; to one of Unity's own primitive meshes, `{ builtin: 'Cube' }`;
 * anywhere else outside the file, `{ external: [file, pathId] }`.
 */
export function prefabTree(scene, rootGo, refs) {
  const paths = new Map();   // transform key -> path, game object key -> path
  const components = new Map();   // component key -> { node, component }
  const walkPaths = (goPtr, prefix) => {
    const go = scene.get(goPtr).v;
    const path = prefix ? `${prefix}/${go.m_Name}` : go.m_Name;
    paths.set(key(goPtr), path);
    const tr = go.m_Component.map((c) => c.component).find((c) => scene.get(c)?.classId === UCLASS.Transform);
    paths.set(key(tr), path);
    // a pointer to another component of the prefab (a sub-emitter's particle system) names its node and its kind
    for (const c of go.m_Component.map((x) => x.component)) {
      if (c === tr) continue;
      const t = scene.get(c);
      if (t) components.set(key(c), { node: path, component: Object.entries(UCLASS).find(([, id]) => id === t.classId)?.[0] ?? `class${t.classId}` });
    }
    for (const ch of scene.get(tr).v.m_Children) walkPaths(scene.get(ch).v.m_GameObject, path);
  };
  walkPaths(rootGo, '');
  const resolve = (v) => {
    if (isPPtr(v)) {
      if (v.m_PathID === 0n || v.m_PathID === 0) return null;
      if (v.m_FileID !== 0) {
        const file = scene.sf.externals?.[v.m_FileID - 1]?.path ?? `#${v.m_FileID}`;
        const builtin = file === UNITY_DEFAULT_RESOURCES ? BUILTIN_MESH[String(v.m_PathID)] : null;
        return builtin ? { builtin } : { external: [file, String(v.m_PathID)] };
      }
      const k = key(v);
      if (paths.has(k)) return { node: paths.get(k) };
      if (components.has(k)) return { ...components.get(k) };
      const r = refs.ref(v);
      if (r) return r;
      const t = scene.get(v);
      return t ? { object: [t.classId, t.pathId] } : null;
    }
    if (typeof v === 'bigint') return String(v);
    if (v instanceof Uint8Array) return Buffer.from(v).toString('base64');
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === 'object') { const o = {}; for (const [k2, x] of Object.entries(v)) o[k2] = resolve(x); return o; }
    return v;
  };
  const component = (c) => {
    const t = scene.get(c);
    const v = { ...t.v };
    delete v.m_GameObject;
    if (t.classId === UCLASS.ParticleSystem) {
      // a module that is off does nothing: only its switch is kept
      for (const [k2, x] of Object.entries(v)) if (x && typeof x === 'object' && x.enabled === false && /Module$/.test(k2)) v[k2] = { enabled: false };
    }
    const type = Object.entries(UCLASS).find(([, id]) => id === t.classId)?.[0] ?? `class${t.classId}`;
    return { type, ...resolve(v) };
  };
  const node = (goPtr) => {
    const go = scene.get(goPtr).v;
    const comps = go.m_Component.map((c) => c.component);
    const trPtr = comps.find((c) => scene.get(c)?.classId === UCLASS.Transform);
    const tr = scene.get(trPtr).v;
    const q = tr.m_LocalRotation, p = tr.m_LocalPosition, sc = tr.m_LocalScale;
    return {
      name: go.m_Name, active: !!go.m_IsActive, layer: go.m_Layer, tag: go.m_Tag,
      position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w], scale: [sc.x, sc.y, sc.z],
      components: comps.filter((c) => c !== trPtr).map(component),
      children: tr.m_Children.map((ch) => node(scene.get(ch).v.m_GameObject)),
    };
  };
  return node(rootGo);
}

/** The AssetBundle's container: asset path -> pointer, for finding a prefab by its file name. */
export function bundleContainer(scene) {
  const ab = scene.ofClass(UCLASS.AssetBundle)[0].v;
  return new Map(ab.m_Container.map((p) => [p.first, p.second.asset]));
}
