// CSA-A (2026-09-27) - COME SAIL AWAY'S BOATS AS DATA (vendor/come-sail-away/Models/),
// what tools/comeSailAwayExtract.mjs read out of the bundle through
// tools/lib/unityScene.mjs: the twelve prefabs the assembly asks DFU for as
// the trees its C# walks by name, the meshes, the materials and the
// animation. The pins hold the files to themselves (every pointer lands, every
// index is in range, every binding resolves but the six the author's clips
// aim at no bone) and the decoders to Unity's layouts on hand-built input:
// a two-stream mesh, a muscle clip's streamed-dense-constant order, the path
// hash against the bundle's own.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { decodeMesh, decodeClip, readStreamedFrames, pathHash, bindingCurves, BUILTIN_MESH, prefabTree, UCLASS } from '../../tools/lib/unityScene.mjs';
import { PREFABS, MESH_WRITTEN } from '../../tools/comeSailAwayExtract.mjs';

const DIR = new URL('../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const { prefabs, components } = json('prefabs.json');
const ANIM = json('animation.json');
const MATERIALS = json('materials.json');
const MESHES = json('meshes.json');
const BIN = readFileSync(new URL('meshes.bin', DIR));

const nodes = function* (n, path = n.name) { yield [n, path]; for (const c of n.children) yield* nodes(c, `${path}/${c.name}`); };
/** Every pointer a value holds, as [kind, key]. */
const pointers = function* (v) {
  if (Array.isArray(v)) { for (const x of v) yield* pointers(x); return; }
  if (!v || typeof v !== 'object') return;
  const ks = Object.keys(v);
  if (ks.length === 2 && ks[0] === 'node' && ks[1] === 'component') { yield ['component', v]; return; }
  if (ks.length === 1 && ['mesh', 'material', 'controller', 'audio', 'texture', 'shader', 'script', 'clip', 'node', 'builtin', 'external', 'object'].includes(ks[0])) { yield [ks[0], v[ks[0]]]; return; }
  for (const x of Object.values(v)) yield* pointers(x);
};

test('CSA-A: the twelve prefabs the assembly asks DFU for - the seven one-box triggers and the five hulls - each hull carrying the nodes GetBoatTransforms looks for by name', () => {
  assert.deepEqual(Object.keys(prefabs).map(Number).sort((a, b) => a - b), [...PREFABS]);
  for (const id of [112400, 112401, 112402, 112403, 112404, 112405, 112406]) {
    const t = prefabs[id];
    assert.deepEqual([t.name, t.children.length, t.components.length], [String(id), 0, 1]);
    const box = components[t.components[0]];
    assert.deepEqual([box.type, box.m_IsTrigger, box.m_Size, box.m_Center], ['BoxCollider', true, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }], `${id}: a unit trigger box`);
  }
  const has = (id, name) => [...nodes(prefabs[id])].some(([n]) => n.name === name);
  const ALL = ['WakeObject', 'Modifiers', 'DriveTrigger', 'DrivePosition', 'RudderObject', 'IdleObject', 'ActiveObject', 'CargoTrigger', 'BoardTrigger', 'FireObject'];
  for (const id of [112410, 112411, 112412, 112413, 112414]) {
    assert.equal(prefabs[id].name, String(id));
    for (const n of ALL) assert.ok(has(id, n), `${id} has ${n}`);
    const mods = prefabs[id].children.find((c) => c.name === 'Modifiers');
    for (const m of ['HandlingOar', 'HandlingSail', 'HandlingAnimation', 'HandlingRudder', 'Audio']) assert.ok(mods.children.some((c) => c.name === m), `${id}: Modifiers/${m}`);
  }
  assert.ok(has(112411, 'Variants') && has(112411, 'VariantTrigger'), 'the skiff\'s variants');
  assert.ok(!has(112414, 'Packable') && has(112410, 'Packable') && has(112411, 'Packable'), 'only the dinghy and the skiff pack up');
  // the hull root's helper plane is inert: both its renderer and its collider are off
  const plane = prefabs[112410].children.find((c) => c.name === 'Plane');
  const pc = plane.components.map((i) => components[i]);
  assert.deepEqual(pc.map((c) => [c.type, c.m_Enabled]), [['MeshFilter', undefined], ['MeshRenderer', false], ['MeshCollider', false]]);
  assert.deepEqual(pc[0].m_Mesh, { builtin: 'Plane' });
});

test('CSA-A: every component index is in range and every pointer lands - a node of the same prefab, a mesh, material or controller the files carry, or one of Unity\'s own primitives - and the only script is DFU\'s RuntimeMaterials', () => {
  const kinds = new Set();
  for (const [id, t] of Object.entries(prefabs)) {
    const paths = new Set([...nodes(t)].map(([, p]) => p));
    for (const [n, p] of nodes(t)) {
      for (const ci of n.components) {
        assert.ok(Number.isInteger(ci) && ci >= 0 && ci < components.length, `${p}: component ${ci}`);
        for (const [kind, k] of pointers(components[ci])) {
          kinds.add(kind);
          if (kind === 'node') assert.ok(paths.has(k), `${p}: node ${k}`);
          else if (kind === 'component') {
            const [tn] = [...nodes(t)].find(([, q]) => q === k.node) ?? [];
            assert.ok(tn && tn.components.some((i) => components[i].type === k.component), `${p}: ${k.component} on ${k.node}`);
          }
          else if (kind === 'mesh') assert.ok(MESHES[k], `${p}: mesh ${k}`);
          else if (kind === 'material') assert.ok(MATERIALS[k], `${p}: material ${k}`);
          else if (kind === 'controller') assert.ok(ANIM.controllers[k] || ANIM.overrides[k], `${p}: controller ${k}`);
          else if (kind === 'builtin') assert.ok(Object.values(BUILTIN_MESH).includes(k), `${p}: builtin ${k}`);
          else if (kind === 'script') assert.equal(k, 'RuntimeMaterials');
          else if (kind === 'audio') assert.equal(k, 'oars_cut_1', 'the rudder\'s own clip, never played');
          else assert.fail(`${p}: a ${kind} pointer (${JSON.stringify(k)})`);
        }
      }
    }
    assert.ok(paths.size >= 1, id);
  }
  assert.deepEqual([...kinds].sort(), ['audio', 'builtin', 'component', 'controller', 'material', 'mesh', 'node', 'script']);
});

test('CSA-A: each mesh reads back out of meshes.bin - the four channels the boats read, every index inside its vertices, every position inside its box', () => {
  assert.equal(Object.keys(MESHES).length, 209);
  let verts = 0;
  for (const [k, m] of Object.entries(MESHES)) {
    const f32 = (a, n) => new Float32Array(BIN.buffer, BIN.byteOffset + a.offset, n);
    assert.ok(m.attributes.position && m.attributes.uv0, `${k}: position and uv0`);
    for (const [ch, a] of Object.entries(m.attributes)) {
      assert.ok(MESH_WRITTEN.includes(ch), `${k}: ${ch} is a written channel`);
      assert.equal(a.offset % 4, 0);
      assert.ok(a.offset + m.vertexCount * a.dim * (a.type === 'f32' ? 4 : 2) <= BIN.length, `${k}: ${ch} inside the file`);
    }
    const pos = f32(m.attributes.position, m.vertexCount * 3);
    const { center, extent } = m.aabb;
    for (let v = 0; v < m.vertexCount; v++) {
      for (let d = 0; d < 3; d++) assert.ok(Math.abs(pos[v * 3 + d] - center[d]) <= extent[d] * (1 + 1e-5) + 1e-4, `${k}: vertex ${v} axis ${d} outside its box`);
    }
    const idx = m.indices.type === 'u32' ? new Uint32Array(BIN.buffer, BIN.byteOffset + m.indices.offset, m.indices.count) : new Uint16Array(BIN.buffer, BIN.byteOffset + m.indices.offset, m.indices.count);
    for (const s of m.submeshes) {
      assert.ok(s.start + s.count <= m.indices.count && s.count % 3 === 0, `${k}: a submesh of whole triangles in range`);
      for (let i = s.start; i < s.start + s.count; i++) assert.ok(idx[i] + s.baseVertex < m.vertexCount, `${k}: index ${i}`);
    }
    if (m.bindPoses) assert.equal(m.bindPoses.length, m.boneNameHashes.length, `${k}: a bind pose per bone`);
    verts += m.vertexCount;
  }
  assert.equal(verts, 38238);
  assert.ok(Object.values(MESHES).some((m) => m.attributes.blendIndices), 'the skinned sails carry their one-bone index');
  assert.ok(MESHES.Carrack.vertexCount === 3327 && MESHES.Carrack.submeshes.length === 17, 'a hull streamed from the .resS reads whole');
});

test('CSA-A: the animation holds together - every controller\'s and override\'s clip is carried, each curve has the components its attribute needs and one kind of data, streamed keys in time order - and every binding resolves under every Animator that plays it, but the six the author\'s staysail clips aim at a bone the skiff has not got', () => {
  assert.deepEqual([Object.keys(ANIM.controllers).length, Object.keys(ANIM.overrides).length, Object.keys(ANIM.clips).length], [5, 26, 141]);
  for (const c of Object.values(ANIM.controllers)) for (const k of c.clips) assert.ok(ANIM.clips[k], `${c.name}: ${k}`);
  for (const [k, o] of Object.entries(ANIM.overrides)) {
    assert.ok(ANIM.controllers[o.base], `${k}: its base`);
    for (const [a, b] of o.clips) assert.ok(ANIM.clips[a] && (b == null || ANIM.clips[b]), `${k}: ${a} -> ${b}`);
  }
  const DIMS = { position: 3, rotation: 4, scale: 3, euler: 3 };
  for (const [k, c] of Object.entries(ANIM.clips)) {
    for (const cv of c.curves) {
      assert.equal(cv.components.length, DIMS[cv.attribute], `${k}: ${cv.attribute}`);
      for (const comp of cv.components) {
        assert.equal(['streamed', 'dense', 'constant'].filter((x) => x in comp).length, 1, `${k}: one kind`);
        if (comp.streamed) for (let i = 1; i < comp.streamed.length; i++) assert.ok(comp.streamed[i][0] >= comp.streamed[i - 1][0], `${k}: keys in order`);
      }
    }
  }
  const clipsOf = (key) => { const o = ANIM.overrides[key]; if (!o) return ANIM.controllers[key].clips; const m = new Map(o.clips); return ANIM.controllers[o.base].clips.map((c) => m.get(c) ?? c); };
  const unresolved = [];
  for (const [id, t] of Object.entries(prefabs)) {
    for (const [n, p] of nodes(t)) {
      for (const ci of n.components) {
        const c = components[ci];
        if (c.type !== 'Animator' || !c.m_Controller) continue;
        const hashes = new Set([...nodes({ name: '', children: n.children })].map(([, q]) => pathHash(q.replace(/^\//, ''))));
        for (const clip of clipsOf(c.m_Controller.controller)) for (const cv of ANIM.clips[clip].curves) if (!hashes.has(cv.path)) unresolved.push(`${p}|${clip}|${cv.attribute}`);
      }
    }
    assert.ok(id);
  }
  // one bone, its position, rotation and scale, in three clips, under the skiff's two large staysails
  const want = [];
  for (const sail of ['112411/OldSkiffHull/SkiffLargeStaySail', '112411/OldSkiffHull/Variants/4/SkiffLargeStaySail (1)']) {
    for (const clip of ['Large Staysail Unstowed Center', 'Large Staysail Unstowed CenterLeft', 'Large Staysail Unstowed CenterRight']) {
      for (const a of ['position', 'rotation', 'scale']) want.push(`${sail}|${clip}|${a}`);
    }
  }
  assert.deepEqual(unresolved.sort(), want.sort());
  assert.equal(new Set(ANIM.clips['Large Staysail Unstowed Center'].curves.map((c) => c.path)).size, 6, 'five bones resolve, one does not');
  // the door, as its controller was compiled: Closed <-> Opened on the Opened bool, a fixed one-second blend
  const door = ANIM.controllers['Door Controller'];
  assert.deepEqual(door.params, [{ name: 'Opened', type: 'Bool', default: false }]);
  const [closed, opened] = door.layers[0].states;
  assert.deepEqual([closed.name, opened.name, door.layers[0].defaultState], ['Closed', 'Opened', 'Closed']);
  assert.deepEqual([closed.transitions[0].to, closed.transitions[0].conditions, closed.transitions[0].duration, closed.transitions[0].hasFixedDuration], ['Opened', [{ mode: 'If', param: 'Opened', threshold: 0, exitTime: 0 }], 1, true]);
  assert.deepEqual(opened.transitions[0].conditions, [{ mode: 'IfNot', param: 'Opened', threshold: 0, exitTime: 0 }]);
  // the oar strokes: the three events the assembly answers, at the rowboat's rowing clip's own times; four boats ship their own clip of the name
  const row = ANIM.clips['rowboatanimations/Rudder Rowing Right'];
  assert.deepEqual(row.events.map((e) => e.functionName), ['OarEvent_Sweep', 'OarEvent_Out', 'OarEvent_In']);
  assert.deepEqual(Object.keys(ANIM.clips).filter((k) => /Rudder Rowing Right$/.test(k)).sort(), ['clips/Rudder Rowing Right', 'rowboatanimations/Rudder Rowing Right', 'skiffanimations/Rudder Rowing Right', 'triremeanimations/Rudder Rowing Right'],
    'a name four boats share is told apart by the folder the bundle lists it under');
  assert.ok(!Object.keys(ANIM.clips).some((k) => k.includes('#')), 'no clip falls back to a path id');
});

test('CSA-A: the path hash is Unity\'s - CRC32 of the path from the Animator - as the bundle\'s own clips carry it', () => {
  const sail = ANIM.clips['Large Staysail Unstowed Center'];
  const hashes = new Set(sail.curves.map((c) => c.path));
  for (const p of ['SkiffLargeStaySailBones/Base', 'SkiffLargeStaySailBones/Point1', 'SkiffLargeStaySailBones/Point4']) assert.ok(hashes.has(pathHash(p)), p);
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

test('CSA-A (bundle): the tool\'s models are the vendored files byte for byte', { skip: !(process.env.CSA_BUNDLE && existsSync(process.env.CSA_BUNDLE)) && 'CSA_BUNDLE is not set' }, async () => {
  const { comeSailAwayModels } = await import('../../tools/comeSailAwayExtract.mjs');
  const { out } = comeSailAwayModels(new Uint8Array(readFileSync(process.env.CSA_BUNDLE)));
  for (const [path, body] of Object.entries(out)) {
    const have = readFileSync(new URL(`../../vendor/come-sail-away/${path}`, import.meta.url));
    assert.ok(Buffer.from(typeof body === 'string' ? Buffer.from(body) : body).equals(have), path);
  }
});
