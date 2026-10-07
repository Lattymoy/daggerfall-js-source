// ---------------------------------------------------------------------------
// MW-SPELLFX1 - A MORROWIND EFFECT MESH, RUNNING (2026-10-07).
//
// Mac: "We need to implement morrowind spell casting effects and animations." The casting ANIMATIONS were MW-CAST1's;
// this is the other half - the meshes Morrowind's magic is drawn with (an MGEF's casting, bolt, hit and area visuals,
// VFX_Hands), run as OpenMW runs them: every controller on the effect's own clock from zero, the effect over at its
// longest controller's stop. formats/mwVfx.js is the runtime, pure; these pins hold it to the reference's laws on
// hand-built files (the flattener and the reader are data-in, as MAC-Q's flame pins have them), and zoo.nif - pyffi's,
// one of every record type the reader knows - goes through it whole.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import {
  vfxOf, createVfx, visAt, uvAt, flipIndex, shapeVertexColour, billboardRotation, vfxTextures, vfxCapacity,
  BILLBOARD_MODE, COLOR_TARGET, OVERRIDE_CLAMP_MODE,
} from '../src/formats/mwVfx.js';
import { VERTEX_COLOR_MODE } from '../src/formats/mwNifMesh.js';
import { PARTICLE_FLOATS } from '../src/formats/mwParticles.js';

const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;
const nearVec = (v, e, eps = 1e-4) => v.length === e.length && v.every((x, i) => near(x, e[i], eps));
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// ---- a hand-built effect file ----------------------------------------------
const node = (o = {}) => ({ type: 'NiNode', name: '', flags: 0, translation: [0, 0, 0], rotation: Float32Array.from(I3), scale: 1, properties: [], children: [], effects: [], controller: -1, extra: -1, ...o });
const shape = (o = {}) => ({ ...node(o), type: o.type ?? 'NiTriShape', data: o.data, skin: -1 });
/** A unit quad in the XY plane, facing +Z, its uvs the picture's corners. */
const quadData = (o = {}) => ({
  type: 'NiTriShapeData', numVertices: 4,
  vertices: Float32Array.from([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), normals: null, colors: null,
  uvSets: [Float32Array.from([0, 1, 1, 1, 1, 0, 0, 0])], triangles: Uint16Array.from([0, 1, 2, 0, 2, 3]), ...o,
});
const material = (o = {}) => ({ type: 'NiMaterialProperty', name: '', flags: 1, ambient: [0, 0, 0], diffuse: [1, 1, 1], specular: [0, 0, 0], emissive: [1, 1, 1], glossiness: 0, alpha: 1, controller: -1, ...o });
const texturing = (source, o = {}) => ({ type: 'NiTexturingProperty', name: '', flags: 0, applyMode: 2, textures: [{ source, clampMode: 3, filterMode: 1, uvSet: 0 }], controller: -1, ...o });
const source = (fileName) => ({ type: 'NiSourceTexture', name: '', external: true, fileName, pixelData: -1 });
const additive = () => ({ type: 'NiAlphaProperty', name: '', flags: 1 | (6 << 1) | (0 << 5), threshold: 0, controller: -1 });
const ctrl = (type, o = {}) => ({ type, next: -1, flags: 0x8, frequency: 1, phase: 0, startTime: 0, stopTime: 1, target: -1, ...o });
const linear = (keys) => ({ type: 1, keys });
const file = (records) => ({ roots: [0], records });

/** The positions of a stream's vertices. */
const positionsOf = (s) => {
  const out = [];
  for (let v = 0; v < s.count; v++) out.push([...s.packed.subarray(v * PARTICLE_FLOATS, v * PARTICLE_FLOATS + 3)]);
  return out;
};
const field = (s, v, at, n) => [...s.packed.subarray(v * PARTICLE_FLOATS + at, v * PARTICLE_FLOATS + at + n)];
const centre = (s) => positionsOf(s).reduce((a, p) => [a[0] + p[0] / s.count, a[1] + p[1] / s.count, a[2] + p[2] / s.count], [0, 0, 0]);
const affine = (t = [0, 0, 0], k = 1) => ({ a: Float32Array.from([k, 0, 0, 0, k, 0, 0, 0, k]), t });

test('MW-SPELLFX1: the first-root texture - the ROOT\'s first NiTexturingProperty is what an effect\'s particle texture replaces, on every OTHER node that lists that same record and over its whole subtree, clamped at the edge (nifloader.cpp :524-539, mwrender/util.cpp overrideTexture)', () => {
  const nif = file([
    node({ name: 'Root', properties: [1], children: [3, 6] }),
    texturing(2),
    source('textures\\vfx_root.dds'),
    node({ name: 'Marked', properties: [1], children: [4] }),   // lists the root's own record
    shape({ name: 'Swirl', data: 5, properties: [9] }),
    quadData(),
    shape({ name: 'Own', data: 5, properties: [7, 9] }),   // its own texturing property: not marked
    texturing(8),
    source('textures\\vfx_own.dds'),
    material(),
  ]);
  const desc = vfxOf(nif);
  assert.deepEqual(desc.shapes.map((s) => [s.name, s.override]), [['Swirl', true], ['Own', false]]);
  const fx = createVfx({ ...desc, length: 1 }, { textureOverride: 'textures\\vfx_frost.dds' });
  const { streams } = fx.update(0.1);
  assert.deepEqual(streams.map((s) => s.texture), ['textures\\vfx_frost.dds', 'textures\\vfx_own.dds']);
  assert.equal(streams[0].drawState.clampMode, OVERRIDE_CLAMP_MODE, 'overrideTexture clamps both axes');
  assert.equal(streams[1].drawState.clampMode, 3, 'the unmarked shape keeps its file\'s wrap');
  // no particle texture: the file's own
  const plain = createVfx({ ...desc, length: 1 }).update(0.1);
  assert.deepEqual(plain.streams.map((s) => s.texture), ['textures\\vfx_root.dds', 'textures\\vfx_own.dds']);
  // the ROOT itself is never marked - a shape that only inherits the root's texture keeps it
  const inherits = file([node({ name: 'Root', properties: [1], children: [3] }), texturing(2), source('textures\\vfx_root.dds'), shape({ name: 'Bare', data: 4 }), quadData()]);
  assert.equal(vfxOf(inherits).shapes[0].override, false);
  assert.deepEqual(vfxTextures(desc).sort(), ['textures\\vfx_own.dds', 'textures\\vfx_root.dds']);
});

test('MW-SPELLFX1: the effect\'s clock - its length is the longest ACTIVE controller\'s stop time, it is done the frame its clock reaches it ("Hide effect immediately"), a loop carries the remainder, and a file with no controller is gone at once (UpdateVfxCallback, EffectManager::update)', () => {
  const nif = file([
    node({ name: 'Root', children: [1], controller: 3 }),
    shape({ name: 'Q', data: 2 }),
    quadData(),
    ctrl('NiKeyframeController', { data: 5, stopTime: 2, next: 4 }),
    ctrl('NiVisController', { data: 6, stopTime: 9, flags: 0 }),   // inactive: never made, never counted
    { type: 'NiKeyframeData', rotationType: 0, rotationKeys: [], xyzRotations: null, translations: linear([{ time: 0, value: [0, 0, 0] }, { time: 2, value: [0, 0, 4] }]), scales: linear([]) },
    { type: 'NiVisData', keys: [{ time: 0, value: 0 }] },
  ]);
  const desc = vfxOf(nif);
  assert.equal(desc.length, 2);
  const fx = createVfx(desc);
  assert.equal(fx.update(1.5).done, false);
  const last = fx.update(0.5);
  assert.equal(last.done, true); assert.deepEqual(last.streams, [], 'hidden the frame it ends');
  assert.equal(fx.update(1).done, true, 'and it stays over');
  const loop = createVfx(desc, { loop: true });
  loop.update(1.5);
  const r = loop.update(1);
  assert.equal(r.done, false); assert.ok(near(r.time, 0.5), 'the remainder carried');
  const still = vfxOf(file([node({ children: [1] }), shape({ data: 2 }), quadData()]));
  assert.equal(still.length, 0);
  assert.equal(createVfx(still).update(0).done, true, 'no controller, no life');
});

test('MW-SPELLFX1: a keyframed node carries its shapes - translation keys move it, rotation keys replace its rotation, a missing rotation track IS the rest rotation ([B]); `place` and `view` compose outside it', () => {
  const rot90z = [0, -1, 0, 1, 0, 0, 0, 0, 1];
  const nif = file([
    node({ name: 'Root', children: [1] }),
    node({ name: 'Mover', children: [2], controller: 4, rotation: Float32Array.from(rot90z) }),
    shape({ name: 'Q', data: 3 }),
    quadData(),
    ctrl('NiKeyframeController', { data: 5, stopTime: 1 }),
    { type: 'NiKeyframeData', rotationType: 0, rotationKeys: [], xyzRotations: null, translations: linear([{ time: 0, value: [0, 0, 0] }, { time: 1, value: [10, 0, 0] }]), scales: linear([]) },
  ]);
  const fx = createVfx(vfxOf(nif));
  const s = fx.update(0.5).streams[0];
  assert.ok(nearVec(centre(s), [5, 0, 0]), 'halfway along its keys');
  // the rest rotation stands (no rotation keys): the quad's first corner (-1,-1,0) turned 90 degrees about Z
  assert.ok(nearVec(positionsOf(s)[0], [5 + 1, -1, 0]));
  // placed into the world and viewed out of it - outside the node's own motion
  const placed = createVfx(vfxOf(nif)).update(0.5, { place: affine([100, 0, 0], 2), view: affine([0, 0, 1]) }).streams[0];
  assert.ok(nearVec(centre(placed), [110, 0, 1]));
  // rotation keys REPLACE the rest rotation
  const keyed = file([...nif.records]);
  keyed.records[5] = { ...keyed.records[5], rotationType: 1, rotationKeys: [{ time: 0, value: [1, 0, 0, 0] }, { time: 1, value: [1, 0, 0, 0] }] };
  const k = createVfx(vfxOf(keyed)).update(0.5).streams[0];
  assert.ok(nearVec(positionsOf(k)[0], [5 - 1, -1, 0]), 'the identity key, not the file\'s turn');
});

test('MW-SPELLFX1: rule 57 - the hidden flag hides, a NiVisController overrides it every frame (the key at or before the time), and a hidden node with NO visibility controller skips every mesh beneath it for good (nifloader.cpp :826-843)', () => {
  const nif = file([
    node({ name: 'Root', children: [1, 3] }),
    node({ name: 'Blink', flags: 1, children: [2], controller: 6 }),
    shape({ name: 'Shown', data: 5 }),
    node({ name: 'Gone', flags: 1, children: [4] }),
    shape({ name: 'Never', data: 5 }),
    quadData(),
    ctrl('NiVisController', { data: 7, stopTime: 1 }),
    { type: 'NiVisData', keys: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }] },
  ]);
  const desc = vfxOf(nif);
  assert.deepEqual(desc.shapes.map((s) => s.name), ['Shown'], 'the hidden node with no controller left its meshes unmade');
  const fx = createVfx(desc);
  assert.equal(fx.update(0.25).streams.length, 0);
  assert.equal(fx.update(0.5).streams.length, 1);
  assert.equal(visAt([{ time: 0, value: 1 }, { time: 1, value: 0 }], -1), true, 'before the first key, the first key');
  assert.equal(visAt([{ time: 0, value: 1 }, { time: 1, value: 0 }], 1), false, 'AT a key, that key');
  assert.equal(visAt([], 5), true, 'no keys is visible');
});

test('MW-SPELLFX1: the material\'s ramps - NiAlphaController is the alpha uniform over the diffuse alpha (1 with no keys), NiMaterialColorController writes the channel its flags name ((flags >> 4) & 3), and a surface\'s colour is its emission plus its ambient under the effect\'s white light', () => {
  const nif = file([
    node({ name: 'Root', children: [1] }),
    shape({ name: 'Q', data: 2, properties: [3, 7] }),
    quadData(),
    material({ alpha: 0.8, emissive: [0, 0, 0], ambient: [0, 0, 0], controller: 4 }),
    ctrl('NiAlphaController', { data: 5, next: 6, stopTime: 1 }),
    { type: 'NiFloatData', data: linear([{ time: 0, value: 0 }, { time: 1, value: 1 }]) },
    ctrl('NiMaterialColorController', { data: 8, flags: 0x8 | (COLOR_TARGET.Emissive << 4), stopTime: 1 }),
    additive(),
    { type: 'NiPosData', data: linear([{ time: 0, value: [1, 0, 0] }, { time: 1, value: [1, 0, 0] }]) },
  ]);
  const s = createVfx(vfxOf(nif)).update(0.5).streams[0];
  assert.ok(nearVec(field(s, 0, 7, 4), [1, 0, 0, 0.4]), 'red emission, and 0.8 x 0.5 alpha');
  assert.equal(s.drawState.blend, true); assert.equal(s.drawState.dstBlend, 0, 'the NiAlphaProperty\'s additive function rides along');
  // rule 63's substitution: the vertex colour IS the channel its mode names
  const m = { vertexColorMode: VERTEX_COLOR_MODE.AmbientAndDiffuse, emissive: [0.1, 0, 0], ambient: [0, 0, 0], alpha: 0.5 };
  const vc = Float32Array.from([0, 0.5, 0, 0.25]);
  assert.ok(nearVec(shapeVertexColour(m, vc, 0), [0.1, 0.5, 0, 0.25]), 'ambient AND diffuse alpha from the vertex');
  assert.ok(nearVec(shapeVertexColour({ ...m, vertexColorMode: VERTEX_COLOR_MODE.Emission }, vc, 0), [0, 0.5, 0, 0.5]), 'the vertex as the emission, the material\'s alpha');
  assert.ok(nearVec(shapeVertexColour({ ...m, vertexColorMode: VERTEX_COLOR_MODE.None }, null, 0, 0.5), [0.1, 0, 0, 0.25]), 'the uniform multiplies');
});

test('MW-SPELLFX1: NiUVController (on the geometry alone) scales the uvs about their centre and then offsets them, U negated (controller.cpp :316-337); NiFlipController shows int(t / delta) % count, the first when delta is 0 (:567-578)', () => {
  assert.deepEqual(uvAt(1, 1, { uScale: 2, vScale: 2 }), [1.5, 1.5]);
  assert.deepEqual(uvAt(0.5, 0.5, { uTrans: 0.25, vTrans: 0.25 }), [0.25, 0.75]);
  assert.equal(flipIndex(0.6, 0.25, 3), 2);
  assert.equal(flipIndex(0.8, 0.25, 3), 0);
  assert.equal(flipIndex(5, 0, 3), 0);
  assert.equal(flipIndex(1, 0.25, 0), -1);
  const nif = file([
    node({ name: 'Root', children: [1], controller: 9 }),   // a UV controller on a NODE is nobody's (handleMeshControllers is the geometry's)
    shape({ name: 'Q', data: 2, properties: [4], controller: 3 }),
    quadData(),
    ctrl('NiUVController', { data: 8, stopTime: 1, textureSet: 0 }),
    texturing(5, { controller: 6 }),
    source('textures\\a.dds'),
    { ...ctrl('NiFlipController', { stopTime: 1 }), textureSlot: 0, accumTime: 0, delta: 0.25, sources: [5, 7] },
    source('textures\\b.dds'),
    { type: 'NiUVData', groups: [linear([{ time: 0, value: 0.25 }]), linear([{ time: 0, value: 0.25 }]), linear([]), linear([])] },
    ctrl('NiUVController', { data: 8, stopTime: 5, textureSet: 0 }),
  ]);
  const desc = vfxOf(nif);
  assert.equal(desc.length, 1, 'the node\'s UV controller was never made');
  const fx = createVfx(desc);
  const s = fx.update(0.3).streams[0];
  assert.equal(s.texture, 'textures\\b.dds');
  assert.ok(nearVec(field(s, 0, 5, 2), [0 - 0.25, 1 + 0.25]), 'the first corner\'s uv, offset');
  assert.equal(fx.update(0.25).streams[0].texture, 'textures\\a.dds', 'and round again');
  assert.deepEqual(vfxTextures(desc).sort(), ['textures\\a.dds', 'textures\\b.dds']);
});

test('MW-SPELLFX1: billboards are AutoTransform - AlwaysFaceCamera turns +Z to the eye whatever the base, RigidFaceCamera lays the camera\'s own axes over it, RotateAboutUp yaws about +Y toward the eye; a node keeps its translation and scale (nifosg/autotransform.cpp, rule 60)', () => {
  const look = [1, 0, 0], up = [0, 0, 1];
  const turned = Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]);   // 90 degrees about Z: its +Y lies back along the look
  for (const base of [Float32Array.from(I3), Float32Array.from([1, 0, 0, 0, 0, -1, 0, 1, 0])]) {
    const r = billboardRotation(BILLBOARD_MODE.AlwaysFaceCamera, base, [0, 0, 0], [-10, 0, 0], look, up);
    assert.ok(nearVec([r[2], r[5], r[8]], [-1, 0, 0]), '+Z faces back along the look');
  }
  // the reference's own guard (`norm > 1e-6`): a base whose +Y lies along the line of sight leaves the file's rotation
  assert.deepEqual([...billboardRotation(BILLBOARD_MODE.AlwaysFaceCamera, turned, [0, 0, 0], [-10, 0, 0], look, up)], [...turned]);
  const rigid = billboardRotation(BILLBOARD_MODE.RigidFaceCamera, Float32Array.from(I3), [0, 0, 0], [0, 0, 0], [0, 0, -1], [0, 1, 0]);
  assert.ok(nearVec([...rigid], [-1, 0, 0, 0, 1, 0, 0, 0, -1]), 'right = up x look, up re-crossed, forward the look');
  const yaw = billboardRotation(BILLBOARD_MODE.RotateAboutUp, Float32Array.from(I3), [1, 0, 0], [1, 7, 5], look, up);
  assert.ok(nearVec([yaw[2], yaw[5], yaw[8]], [0, 0, 1]) && nearVec([yaw[1], yaw[4], yaw[7]], [0, 1, 0]), 'the eye straight along +Z of the node: no turn, and +Y kept');
  const degenerate = billboardRotation(BILLBOARD_MODE.RotateAboutUp, turned, [0, 0, 0], [-3, 0, 0], look, up);   // on the node's own +Y
  assert.deepEqual([...degenerate], [...turned], 'an eye on the axis leaves the file\'s rotation alone');
  // in a file, under `place` and `view`: the quad faces the eye, at its node's place and scale
  const nif = file([node({ name: 'Root', children: [1] }), node({ name: 'Face', type: 'NiBillboardNode', flags: BILLBOARD_MODE.AlwaysFaceCamera << 5, children: [2], translation: [0, 0, 5], scale: 2 }), shape({ name: 'Q', data: 3 }), quadData()]);
  const desc = vfxOf(nif);
  assert.equal(desc.nodes.get(1).billboard, BILLBOARD_MODE.AlwaysFaceCamera);
  const s = createVfx({ ...desc, length: 1 }).update(0.1, { place: affine([10, 0, 0]), eye: { position: [0, 0, 5], look: [1, 0, 0], up: [0, 0, 1] } }).streams[0];
  const p = positionsOf(s);
  assert.ok(p.every((v) => near(v[0], 10)), 'the quad stands across the line of sight');
  assert.ok(nearVec(centre(s), [10, 0, 5]));
  assert.ok(near(Math.hypot(p[0][1] - p[2][1], p[0][2] - p[2][2]), 2 * Math.SQRT2 * 2), 'at its node\'s scale');
  // no eye: as authored
  const flat = createVfx({ ...desc, length: 1 }).update(0.1).streams[0];
  assert.ok(positionsOf(flat).every((v) => near(v[2], 5)));
});

/** Root -> "Burst" (a NiBSParticleNode at z 10) -> "Sparks" (the geometry), emitted from the Burst node. */
function sparksNif({ flags = 0x20 }) {
  const slots = Array.from({ length: 8 }, () => ({ velocity: [0, 0, 0], rotationAxis: [0, 0, 0], age: 0, lifeSpan: 0, lastUpdate: 0, spawnGeneration: 0, code: 0 }));
  return file([
    node({ name: 'Root', children: [1] }),
    node({ name: 'Burst', type: 'NiBSParticleNode', flags, children: [2], translation: [0, 0, 10] }),
    { ...node({ name: 'Sparks', properties: [5] }), type: 'NiAutoNormalParticles', data: 3, skin: -1, controller: 4 },
    { type: 'NiAutoNormalParticlesData', numVertices: 8, vertices: new Float32Array(24), normals: null, colors: null, uvSets: [], numParticles: 8, particleRadius: 1, numActive: 0, sizes: null },
    {
      ...ctrl('NiParticleSystemController', { stopTime: 4, target: 2 }),
      speed: 10, speedVariation: 0, declination: 0, declinationVariation: 0, planarAngle: 0, planarAngleVariation: 0,
      initialNormal: [0, 0, 1], initialColor: [1, 1, 1, 1], initialSize: 4, emitStartTime: 0, emitStopTime: 4, resetParticleSystem: 0,
      birthRate: 0, lifetime: 1, lifetimeVariation: 0, useBirthRate: 0, spawnOnDeath: 0, emitterDimensions: [0, 0, 0], emitter: 1,
      numSpawnGenerations: 0, percentageSpawned: 0, spawnMultiplier: 0, spawnSpeedChaos: 0, spawnDirChaos: 0, numValid: 0, particles: slots,
      emitterModifier: -1, particleModifier: -1, particleCollider: -1, staticTargetBound: 0,
    },
    texturing(6),
    source('textures\\vfx_spark.dds'),
  ]);
}

test('MW-SPELLFX1: particle systems ride the graph - a LocalSpace system moves with its node and is sized through the placement; a world-frame system keeps its particles where they were emitted, in the Morrowind world, at the file\'s own size and speed whatever the effect\'s scale (handleParticleSystem :1491-1563)', () => {
  const rolls = () => 0.5;
  const local = createVfx(vfxOf(sparksNif({ flags: 0x20 | 0x80 })), { rolls });
  assert.equal(local.desc.length, 4, 'the particle controller counts toward the life');
  const a = local.update(0.25, { place: affine([100, 0, 0], 2) }).streams[0];
  assert.equal(a.count, 12, 'eight a second, two quads');
  // emitted at the Burst node, flown 2.5 units up its +Z in its own space, then placed: (100,0,0) + 2 x (0,0,10+2.5)
  assert.ok(nearVec(field(a, 0, 0, 3), [100, 0, 25]));
  assert.equal(field(a, 0, 11, 1)[0], 8, 'the file\'s size through the placement\'s scale');
  const b = local.update(0, { place: affine([200, 0, 0], 2) }).streams[0];
  assert.ok(nearVec(field(b, 0, 0, 3), [200, 0, 25]), 'carried with the effect');

  const world = createVfx(vfxOf(sparksNif({ flags: 0x20 })), { rolls });
  const c = world.update(0.25, { place: affine([100, 0, 0], 2), view: affine([0, 0, 0], 0.5) }).streams[0];
  // the emitter's world frame, orthonormalised: at (100,0,20), the shot unscaled - 2.5 up - then viewed at half size
  assert.ok(nearVec(field(c, 0, 0, 3), [50, 0, 11.25]));
  assert.equal(field(c, 0, 11, 1)[0], 2, 'the file\'s size in the world, through the view alone');
  const d = world.update(0, { place: affine([300, 0, 0], 2), view: affine([0, 0, 0], 0.5) }).streams[0];
  assert.ok(nearVec(field(d, 0, 0, 3), [50, 0, 11.25]), 'left behind where it was emitted - a bolt\'s trail');
  assert.equal(c.texture, 'textures\\vfx_spark.dds');
  assert.deepEqual([...vfxCapacity(world.desc).entries()], [['particles:0', 48]]);
});

test('MW-SPELLFX1: zoo.nif - pyffi\'s file with one of every record type the reader knows - reads into an effect and runs frames without a throw', () => {
  const zoo = parseNif(new Uint8Array(readFileSync(new URL('./fixtures/mw/zoo.nif', import.meta.url))));
  const desc = vfxOf(zoo);
  assert.ok(desc.nodes.size > 10);
  const fx = createVfx({ ...desc, length: Math.max(desc.length, 1) }, { rolls: () => 0.5, loop: true });
  for (let i = 0; i < 5; i++) {
    const r = fx.update(0.1, { place: affine([1, 2, 3], 1.5), eye: { position: [0, -50, 0], look: [0, 1, 0], up: [0, 0, 1] } });
    for (const s of r.streams) assert.ok(s.packed.subarray(0, s.count * PARTICLE_FLOATS).every(Number.isFinite), `${s.key} packs finite numbers`);
  }
});

// ── the plan: which Morrowind visuals a Daggerfall spell wears ─────────────────────────────────────────────────────
import {
  mwEffectOf, mwEffectsOfSpell, spellFxPlan, mgefColour, areaVisualScale, boltAttitude, boltSpin, actorFxTransform,
  MW_EFFECT, ELEMENT_DAMAGE, VFX_DEFAULT, MGEF_FLAG, BOLT_SPIN_PER_S,
} from '../src/formats/mwSpellFx.js';
import { SKILLS } from '../src/systems/skills.js';
import { effectSchool, EFFECT_COST_TABLE } from '../src/systems/spellcost.js';

const fireMgef = { index: MW_EFFECT.FireDamage, color: [255, 64, 0], flags: 0, particle: 'vfx_firealpha.tga', casting: 'vfx_destructcast', bolt: 'vfx_destructbolt', hit: 'vfx_destructhit', area: 'vfx_destructarea' };
const healMgef = { index: MW_EFFECT.RestoreHealth, color: [0, 0, 255], flags: MGEF_FLAG.NegativeLight, particle: 'vfx_bluealpha.tga', casting: 'vfx_restorecast', bolt: '', hit: '', area: '' };
const MGEFS = new Map([[fireMgef.index, fireMgef], [healMgef.index, healMgef]]);
const MODELS = new Map([['vfx_destructcast', 'meshes/e/cast_dst.nif'], ['vfx_destructbolt', 'meshes/e/bolt_dst.nif'], ['vfx_destructhit', 'meshes/e/hit_dst.nif'], ['vfx_destructarea', 'meshes/e/area_dst.nif'], ['vfx_restorecast', 'meshes/e/cast_rst.nif'], ['vfx_defaulthit', 'meshes/e/hit_default.nif'], ['vfx_hands', 'meshes/e/hands.nif']]);
const modelOf = (id) => MODELS.get(id) ?? null;
const damage = (type = 4, subType = 0) => ({ type, subType });

test('MW-SPELLFX1: the mapping is only a look - Daggerfall\'s harm wears its element (Fire, Frost, Poison and Shock Damage; magic\'s is Damage Health), every other family the Morrowind effect nearest it, and a family nobody named its school\'s plainest member', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((el) => mwEffectOf(damage(), el)), [14, 16, 27, 15, 23]);
  assert.deepEqual([...ELEMENT_DAMAGE], [MW_EFFECT.FireDamage, MW_EFFECT.FrostDamage, MW_EFFECT.Poison, MW_EFFECT.ShockDamage, MW_EFFECT.DamageHealth]);
  assert.equal(mwEffectOf(damage(1, 1), 4), MW_EFFECT.DamageFatigue, 'magic harm keeps its own channel');
  assert.equal(mwEffectOf(damage(11, 8), 4), MW_EFFECT.AbsorbHealth, 'a transfer of health');
  assert.equal(mwEffectOf(damage(10, 8), 0), MW_EFFECT.RestoreHealth, 'a heal is a heal whatever the spell\'s element');
  assert.equal(mwEffectOf(damage(14, 255), 0), MW_EFFECT.Levitate);
  assert.equal(mwEffectOf(damage(8, 2)), MW_EFFECT.ResistPoison);
  assert.equal(mwEffectOf(damage(33, 2)), MW_EFFECT.CalmHumanoid); assert.equal(mwEffectOf(damage(33, 0)), MW_EFFECT.CalmCreature);
  assert.equal(mwEffectOf(damage(99, 0), 4, SKILLS.Restoration), MW_EFFECT.RestoreHealth, 'an unnamed family: its school');
  assert.equal(mwEffectOf(damage(99, 0), 4, SKILLS.Illusion), MW_EFFECT.Light);
  // every family the cost table prices has a look of its own, never the bare fallback by accident
  for (const key of Object.keys(EFFECT_COST_TABLE)) {
    const [type, subType] = key.split(',').map(Number);
    assert.ok(Number.isInteger(mwEffectOf({ type, subType }, 4, effectSchool({ type, subType }))), key);
  }
  assert.deepEqual(mwEffectsOfSpell({ element: 3, effects: [] }), [MW_EFFECT.ShockDamage], 'a peer\'s cast carries an element alone');
  assert.deepEqual(mwEffectsOfSpell({ element: 0, effects: [damage(), damage(10, 8)] }), [14, 75]);
});

test('MW-SPELLFX1: the plan - a casting visual per model (playSpellCastingEffects\' addedEffects), a bolt for a target spell alone wearing the one effect\'s texture and the mean colour (NegativeLight inverted), each effect\'s hit and area, OpenMW\'s defaults where an effect names none, VFX_Hands wearing the LAST effect\'s texture', () => {
  const fire = spellFxPlan({ element: 0, rangeType: 2, effects: [damage()] }, MGEFS, modelOf);
  assert.deepEqual(fire.cast, [{ id: 'vfx_destructcast', model: 'meshes/e/cast_dst.nif', texture: 'vfx_firealpha.tga' }]);
  assert.deepEqual(fire.bolt, { id: 'vfx_destructbolt', model: 'meshes/e/bolt_dst.nif', texture: 'vfx_firealpha.tga', colour: [1, 64 / 255, 0] });
  assert.deepEqual(fire.hit.map((v) => v.id), ['vfx_destructhit']);
  assert.deepEqual(fire.area.map((v) => v.id), ['vfx_destructarea']);
  assert.deepEqual(fire.hands, { id: VFX_DEFAULT.hands, model: 'meshes/e/hands.nif', texture: 'vfx_firealpha.tga' });
  // two effects: both casting models, the bolt without a texture and the mean of the colours, the hands the last's
  const both = spellFxPlan({ element: 0, rangeType: 4, effects: [damage(), damage(10, 8)] }, MGEFS, modelOf);
  assert.deepEqual(both.cast.map((v) => v.id), ['vfx_destructcast', 'vfx_restorecast']);
  assert.equal(both.bolt.texture, null, 'the particle texture rides only a single projectile effect');
  assert.deepEqual(both.bolt.colour, [1, (64 / 255 + 1) / 2, 0], 'the mean of (1, 64/255, 0) and getColor\'s NegativeLight 1 - (0, 0, 1)');
  assert.deepEqual(both.hit.map((v) => v.id), ['vfx_destructhit', 'vfx_defaulthit'], 'Restore Health names no hit: VFX_DefaultHit');
  assert.deepEqual(both.area.map((v) => v.id), ['vfx_destructarea'], 'VFX_DefaultArea is in no archive here: left out, not a refusal');
  assert.equal(both.hands.texture, 'vfx_bluealpha.tga');
  const self = spellFxPlan({ element: 0, rangeType: 0, effects: [damage(10, 8), damage(10, 8)] }, MGEFS, modelOf);
  assert.equal(self.bolt, null, 'no bolt off the target range');
  assert.equal(self.cast.length, 1, 'one casting visual per model');
  assert.deepEqual(mgefColour({ color: [255, 0, 0], flags: MGEF_FLAG.NegativeLight }), [0, 1, 1]);
  assert.equal(spellFxPlan({ element: 0, rangeType: 2, effects: [damage()] }, new Map(), () => null).bolt, null, 'no records, no models: nothing to draw');
});

test('MW-SPELLFX1: the placements - an area at twice its feet (explodeSpell), a bolt turned so its +Y runs along the flight and spinning a turn a second about -Y (launchMagicBolt, RotateCallback), a creature\'s effect sized off its body (Animation::addEffect)', () => {
  assert.ok(near(areaVisualScale(4, 69.99125109), 2 * 4 * 69.99125109 / (64 / 3)));
  for (const d of [[0, 1, 0], [1, 0, 0], [0, -1, 0], [0.3, 0.4, -0.866], [0, 0, 1]]) {
    const r = boltAttitude(d);
    const l = Math.hypot(...d);
    assert.ok(nearVec([r[1], r[4], r[7]], d.map((v) => v / l)), `+Y along ${d}`);
    assert.ok(near(r[0] * r[0] + r[3] * r[3] + r[6] * r[6], 1), 'a rotation');
  }
  assert.equal(BOLT_SPIN_PER_S, Math.PI * 2);
  assert.ok(nearVec([...boltSpin(0)], I3));
  const q = boltSpin(0.25);
  assert.ok(nearVec([q[0], q[3], q[6]], [0, 0, 1]), 'a quarter turn about -Y carries +X to +Z');
  assert.ok(nearVec([q[1], q[4], q[7]], [0, 1, 0]), 'and leaves the axis');
  const person = actorFxTransform(1.8, 0.45, 69.99125109);
  assert.equal(person.scale, 1, 'a body under 64 units of reach is not scaled');
  assert.ok(near(person.offset, (1.8 * 69.99125109 - 128) * (0.9 * 69.99125109 / 64), 1e-3), 'and is set down off a 128-unit body');
  const ogre = actorFxTransform(2.4, 1.4, 69.99125109);
  assert.ok(near(ogre.scale, (2.8 * 69.99125109) / 64), 'max(x, y, z / 2) / 64');
  assert.ok(near(ogre.offset, (128 - 2.4 * 69.99125109) * ogre.scale, 1e-3), 'a body wider than it is tall: 128 - z, times the ratio');
});

// ── the world layer: loaded off the archives, run, drawn ───────────────────────────────────────────────────────────
import { writeNif } from '../tools/nifWrite.mjs';
import { createMwMagicFx, MW_TO_PASS, passToMw, passDirToMw } from '../src/scenes/mwMagicFx.js';

/** An effect mesh as bytes: a root keyed for `stopTime` seconds over a textured quad. */
function effectNifBytes({ stopTime = 1, texture = 'tx_fixture.dds', quad = 1 } = {}) {
  return new Uint8Array(writeNif([
    { type: 'NiNode', name: 'Effect', controller: 1, children: [3] },
    { type: 'NiKeyframeController', flags: 8, stopTime, target: 0, data: 2 },
    { type: 'NiKeyframeData', rotationKeys: [], translations: { type: 1, keys: [{ time: 0, value: [0, 0, 0] }, { time: stopTime, value: [0, 0, 0] }] }, scales: { keys: [] } },
    { type: 'NiTriShape', name: 'Glow', data: 4, properties: [5, 6] },
    { type: 'NiTriShapeData', positions: [-quad, 0, -quad, quad, 0, -quad, quad, 0, quad, -quad, 0, quad], uvs: [0, 1, 1, 1, 1, 0, 0, 0], indices: [0, 1, 2, 0, 2, 3] },
    { type: 'NiMaterialProperty', emissive: [1, 1, 1], ambient: [0, 0, 0] },
    { type: 'NiTexturingProperty', textures: [{ source: 7 }] },
    { type: 'NiSourceTexture', fileName: texture },
  ], [0]));
}
const fixtureDds = () => new Uint8Array(readFileSync(new URL('./fixtures/mw/fixture.dds', import.meta.url)));
function fxCatalog({ withHands = true } = {}) {
  const files = new Map([
    ['meshes/e/cast_dst.nif', effectNifBytes({ stopTime: 1 })],
    ['meshes/e/bolt_dst.nif', effectNifBytes({ stopTime: 0.5 })],
    ['meshes/e/hit_dst.nif', effectNifBytes({ stopTime: 0.75 })],
    ['meshes/e/area_dst.nif', effectNifBytes({ stopTime: 2 })],
    ['textures/tx_fixture.dds', fixtureDds()],
  ]);
  if (withHands) files.set('meshes/e/hands.nif', effectNifBytes({ stopTime: 1, quad: 0.5 }));
  const statics = new Map([['vfx_destructcast', 'e/cast_dst.nif'], ['vfx_destructbolt', 'e/bolt_dst.nif'], ['vfx_destructhit', 'e/hit_dst.nif'], ['vfx_destructarea', 'e/area_dst.nif'], ...(withHands ? [['vfx_hands', 'e/hands.nif']] : [])]);
  return { gen: null, archives: [{ has: (p) => files.has(p), get: (p) => files.get(p) }], weapons: [], magic: { effects: new Map([[14, { ...fireMgef, particle: '' }]]), statics } };
}
function fakeGl() {
  const log = { made: 0, released: 0, texMade: 0, texFreed: 0, drawn: [], effects: [] };
  return {
    log,
    gl: {}, _proj: new Float32Array(16), _view: Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), _camPos: [0, 1.6, 5],
    createParticleEffect(capacity, state) { log.made++; const e = { capacity, count: 0, hidden: false, tex: null, ...state }; log.effects.push(e); return e; },
    updateParticleEffect(e, packed, count) { e.count = Math.min(count, e.capacity * 6); e.last = packed.slice(0, e.count * PARTICLE_FLOATS); },
    releaseParticleEffect(e) { log.released++; e.dead = true; },
    createCharacterTexture() { log.texMade++; return { tex: log.texMade }; },
    releaseCharacterTexture() { log.texFreed++; },
    drawWorldParticleEffects(list) { log.drawn.push(list.length); },
  };
}
const settle = async (until, tries = 50) => { for (let i = 0; i < tries && !until(); i++) await new Promise((r) => setTimeout(r, 0)); };
const fireBolt = { name: 'Fireball', element: 0, rangeType: 2, effects: [{ type: 4, subType: 0 }] };

test('MW-SPELLFX1: the world layer - the casting effects at the caster\'s feet and its hands told, a bolt that follows its missile and goes with it, the hit and the burst, each loaded off the archives, run on its own clock, drawn in the world pass and freed whole', async () => {
  const r = fakeGl();
  const hands = [];
  const fx = createMwMagicFx({ renderer: r, catalog: () => fxCatalog(), enabled: () => true, hands: (sp) => hands.push(sp) });
  assert.equal(fx.cast(fireBolt, [0, 0, 0], { player: true }), 1);
  assert.deepEqual(hands, [fireBolt], 'VFX_Hands is the arm\'s - told at the same moment');
  await settle(() => fx.count() === 1);
  assert.equal(fx.count(), 1);
  fx.update(0.1);
  assert.equal(fx.draw(), true);
  assert.deepEqual(r.log.drawn, [1]);
  // the bolt: placed at the missile in the pass, under MW_TO_PASS
  const b = fx.bolt(fireBolt);
  assert.equal(b.state(), 'pending');
  b.at([10, 1.5, -4], [0, 0, -1]);
  await settle(() => b.state() === 'live');
  assert.equal(b.state(), 'live');
  fx.update(0.1);
  const boltGpu = r.log.made;   // two effects now, one stream each
  assert.equal(boltGpu, 2);
  // RotateCallback: a turn a second about its own forward - a quarter second turns its corner a quarter about the flight
  const boltE = r.log.effects[1];
  const corner = () => [boltE.last[0] - 10, boltE.last[1] - 1.5, boltE.last[2] + 4];
  const c0 = corner();
  fx.update(0.25);
  const c1 = corner();
  assert.ok(near(Math.hypot(...c0), Math.hypot(...c1), 1e-5) && near(c0[0] * c1[0] + c0[1] * c1[1] + c0[2] * c1[2], 0, 1e-5), 'a quarter turn');
  assert.ok(near(c0[2], 0, 1e-6) && near(c1[2], 0, 1e-6), 'about the flight: the corner stays across it');
  const live = fx.count();
  b.end();
  fx.update(0.016);
  assert.equal(fx.count(), live - 1, 'a bolt goes the frame its missile does');
  // the hit and the burst
  assert.equal(fx.hit(fireBolt, [3, 0, 3]), 1);
  assert.equal(fx.area(fireBolt, [0, 0, -8], 4), 1);
  await settle(() => fx.count() === 3);
  fx.update(0.016);
  // the burst's scale: twice Daggerfall's radius in feet - its quad's half-width of 1 unit is ~26 units, in the pass
  // 26 / 70 metres; the casting effect's and the hit's stay one unit (1 / 70 m)
  assert.equal(fx.count(), 3);
  const extents = r.log.effects.map((e) => { let m = 0; for (let k = 0; k < (e.last?.length ?? 0); k += PARTICLE_FLOATS) m = Math.max(m, Math.abs(e.last[k] - 0), Math.abs(e.last[k + 2] - (-8))); return m; });
  const areaHalf = areaVisualScale(4, 69.99125109) / 69.99125109;
  assert.ok(extents.some((m) => near(m, areaHalf, 1e-3)), `the burst at area x 2 (${extents.map((m) => m.toFixed(3))} against ${areaHalf.toFixed(3)})`);
  // the cast ran out (1 s) after a second of frames; the area (2 s) outlives it
  for (let i = 0; i < 70; i++) fx.update(1 / 60);
  assert.equal(fx.count(), 1, 'the cast and the hit ran out; the burst still stands');
  fx.clear();
  assert.equal(fx.count(), 0);
  assert.equal(r.log.released, r.log.made, 'every GL effect freed');
  assert.equal(r.log.texFreed, r.log.texMade, 'and every texture this layer made');
  // the switch: off clears what runs and spawns nothing
  let on = true;
  const fx2 = createMwMagicFx({ renderer: fakeGl(), catalog: () => fxCatalog(), enabled: () => on, hands: () => {} });
  fx2.cast(fireBolt, [0, 0, 0]);
  await settle(() => fx2.count() === 1);
  on = false;
  fx2.update(0.016);
  assert.equal(fx2.count(), 0);
  assert.equal(fx2.cast(fireBolt, [0, 0, 0]), 0);
  // no Morrowind data: every door is quiet
  const none = createMwMagicFx({ renderer: fakeGl(), catalog: () => null, enabled: () => true, hands: () => { throw new Error('no hands without data'); } });
  assert.equal(none.cast(fireBolt, [0, 0, 0], { player: true }), 0);
  assert.equal(none.bolt(fireBolt).state(), 'failed', 'the classic flat stands in');
  assert.equal(none.draw(), false);
  // no GL (a test's renderer, a headless host): nothing loads at all
  const headless = createMwMagicFx({ renderer: {}, catalog: () => fxCatalog(), enabled: () => true });
  assert.equal(headless.bolt(fireBolt).state(), 'failed');
});

test('MW-SPELLFX1: the Morrowind world and the pass - Z up and +Y forward become Y up and -Z forward under the third-person body\'s mirrored metre scale, and back again', () => {
  const u = 1 / 69.99125109;
  assert.ok(nearVec([...MW_TO_PASS.a], [-u, 0, 0, 0, 0, u, 0, -u, 0], 1e-7));
  const p = [3, 1.5, -7];
  const mw = passToMw(p);
  const back = [MW_TO_PASS.a[0] * mw[0] + MW_TO_PASS.a[1] * mw[1] + MW_TO_PASS.a[2] * mw[2], MW_TO_PASS.a[3] * mw[0] + MW_TO_PASS.a[4] * mw[1] + MW_TO_PASS.a[5] * mw[2], MW_TO_PASS.a[6] * mw[0] + MW_TO_PASS.a[7] * mw[1] + MW_TO_PASS.a[8] * mw[2]];
  assert.ok(nearVec(back, p, 1e-5), 'float32 of the metre scale, and no more');
  assert.deepEqual(passDirToMw([0, 0, -1]), [-0, 1, 0], 'the pass\'s forward is Morrowind\'s +Y');
  assert.deepEqual(passDirToMw([0, 1, 0]), [-0, -0, 1], 'and its up, +Z');
});

// ── the one engine's doors ─────────────────────────────────────────────────────────────────────────────────────────
import { createPlayerMagic } from '../src/scenes/hostMagic.js';

function engine({ foes = [], raycast = () => Infinity, boltState = 'live', startCastAnim = null } = {}) {
  const calls = [];
  const bolts = [];
  const world = { batchesMade: 0 };
  const fake = {
    prepare: (sp) => calls.push(['prepare', sp.name]),
    cast: (sp, feet, o) => { calls.push(['cast', sp.rangeType, feet && [...feet], !!o?.player, !!o?.body]); return 1; },
    bolt: (sp) => { const h = { spell: sp, at: [], ended: false, state: () => boltState }; h.at = []; h.end = () => { h.ended = true; }; const at = (p, d) => h.at.push([...p]); bolts.push(h); return { state: h.state, at, end: h.end, h }; },
    hit: (sp, feet, o) => { calls.push(['hit', feet && [...feet], !!o?.body]); return 1; },
    area: (sp, at, radius) => { calls.push(['area', [...at], radius]); return 1; },
    update: () => {},
    draw: () => { calls.push(['draw']); return true; },
    clear: () => calls.push(['clear']),
    destroy: () => calls.push(['destroy']),
  };
  const player = { isPlayer: true, level: 1, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => { world.batchesMade++; return { origin: null }; }, destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => foes,
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
    startCastAnim,
    mwMagicFx: fake,
  });
  return { magic, calls, bolts, world, player };
}
const dmg = { type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 };
const heal = { ...dmg, type: 10, subType: 8 };
const foeAt = (x, z) => ({ dead: false, ai: { feet: [x, 0, z], height: 1.8 }, entity: { level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] } });

test('MW-SPELLFX1: the one cast engine drives the layer at the reference\'s moments - the ready loads, the cast\'s start draws its casting effects at my feet (hands or none), my bolt follows my missile and ends with it, a landing is a hit on the foe it met, a burst is the area, and drawFx draws it with the impact pass', async () => {
  const foe = foeAt(0, 6);
  const { magic, calls, bolts, world } = engine({ foes: [foe] });
  magic.update(0, [0, 0, 0]);   // my feet, as every host's frame hands them
  const sp = { name: 'Firebolt', index: 91, element: 0, rangeType: 2, effects: [dmg] };
  magic.readySpell(sp);
  assert.deepEqual(calls.shift(), ['prepare', 'Firebolt']);
  magic.castInput([0, 1.6, 0], [0, 0, 1]);
  assert.deepEqual(calls.shift(), ['cast', 2, [0, 0, 0], true, false], 'no hands to start: the casting effects all the same, at my feet');
  assert.equal(bolts.length, 1, 'the missile flies as its bolt');
  assert.deepEqual(bolts[0].at[0], [0, 1.6, 0], 'placed where it leaves');
  magic.update(1 / 60, [0, 0, 0]);
  await new Promise((r) => setTimeout(r, 0));   // the flat's texture warms asynchronously - give it the chance
  assert.equal(world.batchesMade, 0, 'the classic flat does not stand in for a bolt that draws');
  for (let i = 0; i < 30 && !bolts[0].ended; i++) magic.update(1 / 30, [0, 0, 0]);
  assert.ok(bolts[0].at.length > 2 && bolts[0].at.at(-1)[2] > 1, 'moved with the flight');
  assert.equal(bolts[0].ended, true, 'and gone with it');
  assert.deepEqual(calls.find((c) => c[0] === 'hit'), ['hit', [0, 0, 6], true], 'the hit on the foe it met, sized as a creature');
  // a burst: an area at range that meets a wall
  const wall = engine({ raycast: (pos, dir, max) => { const d = dir[2] > 0 ? (2 - pos[2]) / dir[2] : Infinity; return d >= 0 && d <= max ? d : Infinity; } });   // a wall across z = 2
  wall.magic.update(0, [0, 0, 0]);
  wall.magic.setReadied({ name: 'Fireball', index: 92, element: 0, rangeType: 4, effects: [dmg] });
  wall.magic.castInput([0, 1.6, 0], [0, 0, 1]);
  for (let i = 0; i < 10 && !wall.bolts[0].ended; i++) wall.magic.update(1 / 30, [0, 0, 0]);
  const area = wall.calls.find((c) => c[0] === 'area');
  assert.ok(area && near(area[1][2], 2) && area[2] === 4, 'the area where it went off, at Daggerfall\'s radius');
  assert.equal(wall.bolts[0].ended, true);
  // a self heal: the hit about me
  const self = engine();
  self.magic.update(0, [5, 0, 5]);
  self.magic.readySpell({ name: 'Heal', index: 93, element: 4, rangeType: 0, effects: [heal] });
  assert.ok(self.calls.some((c) => c[0] === 'cast' && c[3] === true));
  assert.ok(self.calls.some((c) => c[0] === 'hit' && c[1][0] === 5 && c[2] === false), 'a person\'s hit: unscaled, at my feet');
  // a bolt with nothing to draw it with hands the missile back to the classic flat
  const bare = engine({ boltState: 'failed' });
  bare.magic.update(0, [0, 0, 0]);
  bare.magic.setReadied({ name: 'Firebolt', index: 91, element: 0, rangeType: 2, effects: [dmg] });
  bare.magic.castInput([0, 1.6, 0], [0, 0, 1]);
  bare.magic.update(1 / 60, [0, 0, 0]);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(bare.world.batchesMade, 1, 'a bolt with nothing to draw it: the classic flat stands in');
  // the draw, the clear, the teardown
  assert.equal(magic.drawFx(), true, 'drawn even when no impact burst is live');
  assert.ok(calls.some((c) => c[0] === 'draw'));
  magic.clearMissiles();
  assert.ok(calls.some((c) => c[0] === 'clear'));
  magic.destroy();
  assert.ok(calls.some((c) => c[0] === 'destroy'));
  // a peer's drawn cast: its casting effects at its feet, its bolt
  const peer = engine();
  peer.magic.spellVisual({ from: [1, 1.6, 1], dir: [0, 0, 1], element: 3, rangeType: 2, casterId: 'p1' });
  assert.ok(peer.calls.some((c) => c[0] === 'cast' && c[3] === false));
  assert.equal(peer.bolts.length, 1);
  assert.deepEqual(peer.bolts[0].spell, { element: 3, rangeType: 2 }, 'a peer\'s look is its element\'s');
  // an enemy's cast: its casting effects at its feet, sized as a creature, and its bolt
  const foeCast = engine();
  foeCast.magic.fireEnemyMissile([0, 1.5, 9], [0, 0, -1], { element: 1, rangeType: 2, effects: [dmg] }, 3, foeAt(0, 9));
  assert.deepEqual(foeCast.calls.find((c) => c[0] === 'cast'), ['cast', 2, [0, 0, 9], false, true]);
  assert.equal(foeCast.bolts.length, 1);
});

// ── VFX_Hands on the arm ────────────────────────────────────────────────────────────────────────────────────────────
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY, VFX_HAND_BONES, mwVisualModel } from '../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { castClip } from './fixtures/mw/castClip.mjs';

const fx = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
/** armfp.nif with Morrowind's own two hand bones hung under the fixture's hands (the fixture names them its own way). */
function handsSkeleton() {
  const nif = parseNif(fx('armfp.nif'));
  const records = nif.records.map((r) => ({ ...r }));
  for (const [side, bone] of [['Left Hand', 'Bip01 L Hand'], ['Right Hand', 'Bip01 R Hand']]) {
    const parent = records.find((r) => r.name === side);
    parent.children = [...parent.children, records.length];
    records.push({ type: 'NiNode', name: bone, children: [], translation: [0, 0, 1] });
  }
  return new Uint8Array(writeNif(records, nif.roots));
}
const esmBytes = (recs) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  return Uint8Array.from(recs.flatMap(([type, subs]) => { const d = subs.flatMap(([n, v]) => sub(n, v)); return [...A(type), ...U(d.length), ...U(0), ...U(0), ...d]; }));
};
const Z = (s) => [...[...s].map((c) => c.charCodeAt(0)), 0];
const medt = () => { const b = new Uint8Array(36); const dv = new DataView(b.buffer); dv.setInt32(0, 2, true); dv.setInt32(12, 255, true); dv.setFloat32(28, 1, true); return [...b]; };

async function castingArmWithMagic({ hands = true } = {}) {
  const weap = (() => {
    const w = new Uint8Array(32); const dv = new DataView(w.buffer); dv.setInt16(8, MW_WEAPON_TYPE.LongBladeOneHand, true); dv.setFloat32(12, 1, true);
    return esmBytes([['WEAP', [['NAME', Z('iron longsword')], ['MODL', Z('w/blade.nif')], ['FNAM', Z('W')], ['WPDT', [...w]]]]]);
  })();
  const magic = esmBytes([
    ['MGEF', [['INDX', [14, 0, 0, 0]], ['MEDT', medt()], ['PTEX', Z('tx_fixture.dds')], ['CVFX', Z('VFX_DestructCast')]]],
    ...(hands ? [['STAT', [['NAME', Z('VFX_Hands')], ['MODL', Z('e\\hands.nif')]]]] : []),
  ]);
  const files = new Map([
    [fpSkeletonPath({}), handsSkeleton()],
    [FP_CLIP_PATH, new Uint8Array(castClip())],
    ['meshes/fixture/armfphand.nif', fx('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', fx('armfparm.nif')],
    ['meshes/w/blade.nif', fx('weapon.nif')],
    ['meshes/e/hands.nif', effectNifBytes({ stopTime: 1, quad: 0.5 })],
    ['textures/tx_fixture.dds', fixtureDds()],
  ]);
  const r = fakeGl();
  const renderer = { ...r, gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {} };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pitch: 0 }));
  const res = await arm.build({
    race: 'fprace', weapon: { templateIndex: 120 },
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm', 'weap.esm', 'magic.esm'],
      loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : n === 'magic.esm' ? magic : fx('armfp.esm')),
    },
  });
  assert.ok(res.ok, `build: ${res.stage} ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  return { arm, log: r.log };
}

test('MW-SPELLFX1: VFX_Hands - the cast that starts glows on Morrowind\'s two hand bones, wearing the last effect\'s texture; hands not casting do not glow; the glow runs its own length and is freed with its GPU (character.cpp :1593-1613)', async () => {
  const { arm, log } = await castingArmWithMagic();
  const cat = arm.mwMagicCatalog();
  assert.ok(cat, 'the build keeps the magic its catalog draws with');
  assert.equal(cat.magic.effects.get(14).particle, 'tx_fixture.dds');
  assert.equal(mwVisualModel(cat, 'VFX_Hands'), 'meshes/e/hands.nif');
  assert.deepEqual([...VFX_HAND_BONES], ['bip01 l hand', 'bip01 r hand']);
  assert.equal(arm.castHands(fireBolt), false, 'no cast in flight, no glow');
  assert.equal(arm.castSpell(2), true);
  const texBefore = log.texMade;   // the arm's own pieces' textures are made through the same door
  assert.equal(arm.castHands(fireBolt), true);
  await settle(() => arm.castFxCount() === 2);
  assert.equal(arm.castFxCount(), 2, 'one per hand');
  arm.update(1 / 60);
  assert.equal(log.made, 2, 'a GL effect per hand, hung after the parts\' own');
  for (let i = 0; i < 80; i++) arm.update(1 / 60);
  assert.equal(arm.castFxCount(), 0, 'gone at its length');
  assert.equal(log.released, 2);
  assert.equal(log.texFreed, log.texMade - texBefore, 'its textures its own, and freed');
  assert.equal(log.texFreed, 2, 'one texture per hand\'s glow');
  // a master with no VFX_Hands glows nothing - and casts as ever
  const bare = await castingArmWithMagic({ hands: false });
  assert.equal(bare.arm.castSpell(2), true);
  bare.arm.castHands(fireBolt);
  await settle(() => false, 10);
  assert.equal(bare.arm.castFxCount(), 0);
});
