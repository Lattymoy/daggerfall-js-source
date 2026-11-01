// CSA-A (2026-09-27) - THE UNITY SCENE READER (tools/lib/unityScene.mjs): a mesh's channels in their streams, a clip's
// curves in their order, the path hash, a prefab's pointers - each over data made here. OWN-WORK4 (2026-10-31): Come
// Sail Away's vendored models and the extractor that wrote them are retired (bible/01-Overview/Own-Work.md); our boats'
// files are pinned by test/systems/comeSailAway/csa_own_assets.test.js. The reader stays: World of Daggerfall's Arena
// and the low-poly trees still read their bundles through it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decodeMesh, decodeClip, readStreamedFrames, pathHash, bindingCurves, BUILTIN_MESH, prefabTree, UCLASS } from '../../tools/lib/unityScene.mjs';
import { pathHash as runtimePathHash } from '../../src/world/unityAnimator.js';

test('CSA-A: the path hash is Unity\'s - CRC32 of the path from the Animator, its case kept - and the reader\'s is the runtime\'s (world/unityAnimator.js)', () => {
  for (const p of ['SkiffLargeStaySailBones/Base', 'SkiffLargeStaySailBones/Point1', "OarsLeft/T'avaTriremeOar.012"]) assert.equal(pathHash(p), runtimePathHash(p), p);
  assert.equal(pathHash('SkiffLargeStaySailBones/Base'), zlib.crc32(Buffer.from('SkiffLargeStaySailBones/Base', 'utf8')) >>> 0);
  assert.notEqual(pathHash('Base'), pathHash('base'), 'case is kept');
  assert.equal(pathHash(''), 0);
  assert.equal(pathHash('a'), 0xe8b7be43);
});

test('CSA-A: decodeMesh lays channels in their streams (each stream 16-aligned, a channel\'s dimension the low nibble) and reads float, half, unorm and integer formats; a submesh index past its vertices is refused', () => {
  // two vertices; stream 0: position f32x3 + normal f16x3 (+1 pad dim); stream 1: uv0 unorm16x2, blendIndices u32x1
  const n = 2;
  const s0 = 12 + 8, s1 = 4 + 4;
  const s1at = (n * s0 + 15) & ~15;
  const data = new Uint8Array(s1at + n * s1);
  const dv = new DataView(data.buffer);
  const h = (x) => (x === 1 ? 0x3c00 : x === -1 ? 0xbc00 : 0);   // half 1, -1, 0
  [[1, 2, 3, 0, 1, 0], [-4, 5.5, 6, 1, 0, -1]].forEach(([x, y, z, nx, ny, nz], v) => {
    dv.setFloat32(v * s0, x, true); dv.setFloat32(v * s0 + 4, y, true); dv.setFloat32(v * s0 + 8, z, true);
    dv.setUint16(v * s0 + 12, h(nx), true); dv.setUint16(v * s0 + 14, h(ny), true); dv.setUint16(v * s0 + 16, h(nz), true);
  });
  [[0, 65535, 7], [32768, 0, 300]].forEach(([u, w, b], v) => {
    dv.setUint16(s1at + v * s1, u, true); dv.setUint16(s1at + v * s1 + 2, w, true); dv.setUint32(s1at + v * s1 + 4, b, true);
  });
  const ch = (stream, offset, format, dimension) => ({ stream, offset, format, dimension });
  const none = ch(0, 0, 0, 0);
  // the uv channel's dimension byte carries a high nibble: only the low nibble is the dimension
  const channels = [ch(0, 0, 0, 3), ch(0, 12, 1, 4), none, none, ch(1, 0, 4, 0x32), none, none, none, none, none, none, none, none, ch(1, 4, 10, 1)];
  const idx = new Uint8Array(6);
  new DataView(idx.buffer).setUint16(0, 0, true); new DataView(idx.buffer).setUint16(2, 1, true); new DataView(idx.buffer).setUint16(4, 1, true);
  const mesh = {
    m_Name: 'Hand', m_MeshCompression: 0, m_VertexData: { m_VertexCount: n, m_Channels: channels, m_DataSize: data },
    m_IndexBuffer: idx, m_IndexFormat: 0, m_SubMeshes: [{ firstByte: 0, indexCount: 3, baseVertex: 0, topology: 0 }],
    m_BindPose: [], m_BoneNameHashes: [], m_RootBoneNameHash: 0, m_LocalAABB: { m_Center: { x: 0, y: 0, z: 0 }, m_Extent: { x: 1, y: 1, z: 1 } },
  };
  const d = decodeMesh(mesh, null);
  assert.deepEqual([...d.channels.position.data], [1, 2, 3, -4, 5.5, 6]);
  assert.deepEqual([...d.channels.normal.data], [0, 1, 0, 0, 1, 0, -1, 0]);
  assert.deepEqual([...d.channels.uv0.data], [0, 1, Math.fround(32768 / 65535), 0]);
  assert.deepEqual([...d.channels.blendIndices.data], [7, 300]);
  assert.deepEqual([...d.indices], [0, 1, 1]);
  mesh.m_SubMeshes[0].baseVertex = 1;
  assert.throws(() => decodeMesh(mesh, null), /an index past its 2 vertices/);
});

test('CSA-A: decodeClip numbers the curves streamed, then dense, then constant, and hands each binding the next ones its attribute needs - a position\'s three, a rotation\'s four; a streamed frame\'s keys land on their curves and the -infinity sentinel\'s stray keys are dropped', () => {
  // streamed: curves 0 and 1 (a position's x, y); dense: curve 2 (its z); constant: 3-6 (a rotation), 7-9 (a scale)
  const words = [];
  const f = (x) => new Uint32Array(new Float32Array([x]).buffer)[0];
  const frame = (t, keys) => { words.push(f(t), keys.length); for (const [i, a, b, c, d] of keys) words.push(i, f(a), f(b), f(c), f(d)); };
  frame(-3.4028234663852886e38, [[0, 0, 0, 0, 1], [1, 0, 0, 0, 2], [5, 0, 0, 0, 9]]);
  frame(0, [[0, 1, 0, 0, 1], [1, 0, 0, 0, 2]]);
  frame(1, [[0, 0, 0, 0, 2]]);
  assert.equal(readStreamedFrames(words).length, 3);
  const clip = {
    m_Name: 'Hand', m_SampleRate: 30, m_WrapMode: 0, m_Events: [],
    m_MuscleClip: {
      m_StartTime: 0, m_StopTime: 1, m_LoopTime: 1,
      m_Clip: { data: {
        m_StreamedClip: { data: words, curveCount: 2 },
        m_DenseClip: { m_FrameCount: 2, m_CurveCount: 1, m_SampleRate: 30, m_BeginTime: 0, m_SampleArray: [10, 20] },
        m_ConstantClip: { data: [0, 0, 0, 1, 1, 1, 1] },
      } },
    },
    m_ClipBindingConstant: { genericBindings: [{ path: 111, attribute: 1, typeID: 4 }, { path: 222, attribute: 2, typeID: 4 }, { path: 222, attribute: 3, typeID: 4 }] },
  };
  const d = decodeClip(clip);
  assert.deepEqual(d.curves.map((c) => [c.path, c.attribute, c.components.length]), [[111, 'position', 3], [222, 'rotation', 4], [222, 'scale', 3]]);
  assert.deepEqual(d.curves[0].components[0].streamed.map((k) => [k[0] === 0 || k[0] === 1 ? k[0] : 'sentinel', k[1], k[4]]), [['sentinel', 0, 1], [0, 1, 1], [1, 0, 2]]);
  assert.deepEqual(d.curves[0].components[2], { dense: [10, 20] });
  assert.deepEqual(d.curves[1].components.map((c) => c.constant), [0, 0, 0, 1]);
  assert.deepEqual(d.curves[2].components.map((c) => c.constant), [1, 1, 1]);
  assert.equal(d.loop, true);
  assert.equal(bindingCurves({ typeID: 4, attribute: 4 }), 3);
  clip.m_MuscleClip.m_Clip.data.m_ConstantClip.data.push(5);
  assert.throws(() => decodeClip(clip), /name 10 curves, the clip holds 11/);
});

test('CSA-A: prefabTree names what a pointer lands on - a node of the prefab, another component on one (a sub-emitter\'s particle system), one of Unity\'s own primitives through the externals table, an asset through the collector', () => {
  const objs = new Map();
  const put = (id, classId, v) => objs.set(`0:${id}`, { classId, pathId: String(id), v });
  const P = (id, file = 0) => ({ m_FileID: file, m_PathID: BigInt(id) });
  put(1, UCLASS.GameObject, { m_Name: 'Root', m_IsActive: 1, m_Layer: 0, m_Tag: 0, m_Component: [{ component: P(2) }, { component: P(3) }] });
  put(2, UCLASS.Transform, { m_GameObject: P(1), m_LocalPosition: { x: 1, y: 2, z: 3 }, m_LocalRotation: { x: 0, y: 0, z: 0, w: 1 }, m_LocalScale: { x: 1, y: 1, z: 1 }, m_Children: [P(5)] });
  put(3, UCLASS.ParticleSystem, { m_GameObject: P(1), SubModule: { enabled: true, subEmitters: [{ emitter: P(7) }] }, NoiseModule: { enabled: false, strength: 3 } });
  put(4, UCLASS.GameObject, { m_Name: 'Child', m_IsActive: 0, m_Layer: 4, m_Tag: 0, m_Component: [{ component: P(5) }, { component: P(6) }, { component: P(7) }] });
  put(5, UCLASS.Transform, { m_GameObject: P(4), m_LocalPosition: { x: 0, y: 0, z: 0 }, m_LocalRotation: { x: 0, y: 0, z: 0, w: 1 }, m_LocalScale: { x: 2, y: 2, z: 2 }, m_Children: [] });
  put(6, UCLASS.MeshFilter, { m_GameObject: P(4), m_Mesh: P(10202, 1) });
  put(7, UCLASS.ParticleSystem, { m_GameObject: P(4), SubModule: { enabled: false } });
  put(8, UCLASS.Mesh, { m_Name: 'Hull' });
  const scene = { get: (p) => objs.get(typeof p === 'string' ? p : (p.m_PathID === 0n ? null : `${p.m_FileID}:${String(p.m_PathID)}`)) ?? null, sf: { externals: [{ path: 'Library/unity default resources' }] } };
  const refs = { ref: (p) => (String(p.m_PathID) === '8' ? { mesh: 'Hull' } : null) };
  const t = prefabTree(scene, P(1), refs);
  assert.deepEqual([t.name, t.active, t.position, t.children[0].name, t.children[0].active, t.children[0].layer, t.children[0].scale], ['Root', true, [1, 2, 3], 'Child', false, 4, [2, 2, 2]]);
  const [rootPs] = t.components;
  assert.deepEqual(rootPs.SubModule.subEmitters[0].emitter, { node: 'Root/Child', component: 'ParticleSystem' });
  assert.deepEqual(rootPs.NoiseModule, { enabled: false }, 'a module that is off keeps only its switch');
  assert.deepEqual(t.children[0].components[0].m_Mesh, { builtin: 'Cube' });
  objs.get('0:6').v.m_Mesh = P(8);
  assert.deepEqual(prefabTree(scene, P(1), refs).children[0].components[0].m_Mesh, { mesh: 'Hull' });
});
