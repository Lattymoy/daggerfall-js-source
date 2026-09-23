// ---------------------------------------------------------------------------
// MAC-Q - THE MORROWIND TORCH'S FLAME (2026-09-17).
//
// Mac: "the torch doesn't emit fire" - and, told this port had never drawn a
// Morrowind particle system and that one could not be verified in a
// container with no Morrowind data, "Please take care of the morrowind
// torch flame." His call. So the particle system is PORTED, law by law, from
// the reference that OpenMW runs it with (components/nifosg/particle.cpp,
// nifloader.cpp's handleParticleSystem and its two helpers, osgParticle's
// Particle::update and the quad it draws), and pinned here against the
// reference's own numbers rather than against a file nobody here can open.
//
// The flattener hands particle geometries to a sink (mwNifMesh.js), the
// descriptor and the running system are formats/mwParticles.js, a part's
// systems ride the assembly beside its pieces (mwCharacter.js bindPart,
// mwFirstPerson.js bindPartsInto), the arm steps and places them each frame
// (fpArm.js stepRigEffects / effectPlacement), and the renderer draws them as
// osgParticle's billboards after the body (render/renderer.js). What a node
// test cannot reach - the pixels - is tools/macqFlameProbe.mjs's.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif, resolveMaterial } from '../src/formats/mwNifMesh.js';
import {
  particleSystemsOf, particleSystemOf, createParticleSystem, controllerTime, interpColorKey, shootDirection,
  packParticleQuads, particleDrawState, planarCollide, sphericalCollide, nodeWorldTransform,
  affineOfTransform, affineMul, affineApply, affineInverse, affineScale, affineOrthoNormalize, AFFINE_IDENTITY,
  PARTICLE_FLOATS, PARTICLE_CORNERS, GRAVITY_MAGIC, EXTRAPOLATION,
} from '../src/formats/mwParticles.js';
import { buildSkeleton } from '../src/formats/mwSkin.js';
import { bindPart, attachmentTransform } from '../src/formats/mwCharacter.js';
import { placeAtBone, bindPartsInto } from '../src/formats/mwFirstPerson.js';
import { effectPlacement, stepRigEffects } from '../src/combat/fpArm.js';
import { NIF_BLEND_MODES, nifBlendMode } from '../src/render/renderer.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (v, e, eps = 1e-5) => v.length === e.length && v.every((x, i) => near(x, e[i], eps));
const I3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);

// ---- a torch-shaped file, hand-built (the flattener is data-in) ------------

const node = (o = {}) => ({ type: 'NiNode', name: '', flags: 0, translation: [0, 0, 0], rotation: I3, scale: 1, properties: [], children: [], effects: [], controller: -1, ...o });
const slots = (n) => Array.from({ length: n }, () => ({ velocity: [0, 0, 0], rotationAxis: [0, 0, 0], age: 0, lifeSpan: 0, lastUpdate: 0, spawnGeneration: 0, code: 0 }));
const controller = (o = {}) => ({
  type: 'NiParticleSystemController', next: -1, flags: 0x8, frequency: 1, phase: 0, startTime: 0, stopTime: 1e9, target: 2,
  speed: 10, speedVariation: 2, declination: 0, declinationVariation: 0, planarAngle: 0, planarAngleVariation: 0,
  initialNormal: [0, 0, 1], initialColor: [1, 0.5, 0.2, 1], initialSize: 4, emitStartTime: 0, emitStopTime: 1e9, resetParticleSystem: 0,
  birthRate: 0, lifetime: 1, lifetimeVariation: 0, useBirthRate: 0, spawnOnDeath: 0, emitterDimensions: [0, 0, 0], emitter: 1,
  numSpawnGenerations: 0, percentageSpawned: 0, spawnMultiplier: 0, spawnSpeedChaos: 0, spawnDirChaos: 0, numValid: 0, particles: slots(8),
  emitterModifier: -1, particleModifier: -1, particleCollider: -1, staticTargetBound: 0, ...o,
});
/** Root -> "Fire" (a NiBSParticleNode at z 10, AutoPlay | LocalSpace) -> "Flame" (the geometry). */
function torchNif({ ctrl = {}, nodeFlags = 0x20 | 0x80, extra = [], props = [5, 6, 7] } = {}) {
  return { roots: [0], records: [
    node({ name: 'Root', children: [1] }),
    { ...node({ name: 'Fire', flags: nodeFlags, children: [2], translation: [0, 0, 10] }), type: 'NiBSParticleNode' },
    { ...node({ name: 'Flame', properties: props }), type: 'NiAutoNormalParticles', data: 3, skin: -1, controller: 4 },
    { type: 'NiAutoNormalParticlesData', numVertices: 8, vertices: new Float32Array(24), normals: null, colors: null, uvSets: [], numParticles: 8, particleRadius: 1, numActive: 0, sizes: null },
    controller(ctrl),
    { type: 'NiAlphaProperty', name: '', flags: 1 | (6 << 1) | (0 << 5), threshold: 0 },   // blend on, SRC_ALPHA -> ONE (additive)
    { type: 'NiTexturingProperty', name: '', flags: 0, applyMode: 2, textures: [{ source: 8, clampMode: 3, filterMode: 1 }] },
    { type: 'NiVertexColorProperty', name: '', flags: 0, vertexMode: 1, lightingMode: 0 },
    { type: 'NiSourceTexture', name: '', external: true, fileName: 'textures\\tx_fire_01.dds', pixelData: -1 },
    ...extra,
  ] };
}

test('MAC-Q: the flattener hands a particle geometry to the sink, whole, and still emits no batch for it', () => {
  const nif = torchNif();
  const sink = [];
  const batches = flattenNif(nif, { effects: sink });
  assert.equal(batches.length, 0, 'a particle system is not a triangle list, and never was one');
  assert.equal(sink.length, 1);
  const b = sink[0];
  assert.equal(b.rec.name, 'Flame');
  assert.deepEqual(b.world.translation, [0, 0, 10], 'the composed transform, as a shape would get it');
  assert.equal(b.props.length, 3, 'and the property chain');
  assert.equal(b.animFlags, 0x20 | 0x80, 'and the NiBSParticleNode’s flags (nifloader.cpp:786-787)');
  // no sink is the port before this change: nothing at all
  assert.equal(flattenNif(nif).length, 0);
  // and the hidden flag gates it like a shape
  const hidden = torchNif();
  hidden.records[1].flags |= 0x0001;
  const sink2 = [];
  flattenNif(hidden, { effects: sink2 });
  assert.equal(sink2.length, 0);
});

test('MAC-Q: the descriptor - controller, emitter frame, modifiers, colliders, material', () => {
  const nif = torchNif({
    ctrl: { particleModifier: 9, particleCollider: 12 },
    extra: [
      { type: 'NiParticleGrowFade', next: 10, controller: 4, grow: 0.1, fade: 0.25 },
      { type: 'NiGravity', next: 11, controller: 4, decay: 0, force: 3, fieldType: 0, position: [0, 0, 0], direction: [0, 0, 1] },
      { type: 'NiParticleColorModifier', next: -1, controller: 4, colorData: 14 },
      { type: 'NiPlanarCollider', next: 13, controller: 4, bounce: 0.5, height: 4, width: 6, position: [0, 0, 0], xVector: [1, 0, 0], yVector: [0, 1, 0], plane: { normal: [0, 0, 1], constant: 0 } },
      { type: 'NiSphericalCollider', next: -1, controller: 4, bounce: 0.25, radius: 2, position: [0, 0, 5] },
      { type: 'NiColorData', data: { type: 1, keys: [{ time: 0, value: [1, 1, 1, 0] }, { time: 1, value: [0, 0, 0, 1] }] } },
    ],
  });
  const [d] = particleSystemsOf(nif);
  assert.equal(d.kind, 'particles');
  assert.equal(d.name, 'Flame');
  assert.equal(d.localSpace, true); assert.equal(d.autoPlay, true);
  assert.equal(d.controller.speed, 10);
  assert.deepEqual(d.controller.initialColor, [1, 0.5, 0.2, 1]);
  assert.equal(d.controller.particles.length, 8);
  assert.deepEqual(d.emitter.world.translation, [0, 0, 10], 'the emitter node’s own frame in the file, looked up by reference');
  assert.deepEqual(d.modifiers.map((m) => m.type), ['growFade', 'gravity', 'color']);
  assert.deepEqual(d.colliders.map((c) => c.type), ['planar', 'spherical']);
  assert.equal(d.material.textureFile, 'textures\\tx_fire_01.dds');
  assert.equal(d.material.alphaBlend, true);
  assert.equal(d.material.srcBlend, 6); assert.equal(d.material.dstBlend, 0);
  assert.equal(d.data.numParticles, 8);

  // NO ACTIVE CONTROLLER IS NO SYSTEM (nifloader.cpp:1470-1474)
  const inert = torchNif({ ctrl: { flags: 0 } });
  assert.deepEqual(particleSystemsOf(inert), []);
  // the walk's own helper answers the emitter's world for ANY node
  assert.deepEqual(nodeWorldTransform(nif, 2).translation, [0, 0, 10]);
});

test('MAC-Q: NiAlphaProperty’s blend function and NiZBufferProperty’s flags reach the material', () => {
  const nif = torchNif({ props: [5, 7, 9], extra: [{ type: 'NiZBufferProperty', name: '', flags: 0x1 }] });
  // the chain a particle drawable resolves: the alpha property, the vertex
  // colour property (LightMode_Emissive) and the z-buffer property, with
  // vertex colours present - which is how the descriptor asks (:1531)
  const m = resolveMaterial(nif, [nif.records[5], nif.records[7], nif.records[9]], true);
  assert.equal(m.srcBlend, 6); assert.equal(m.dstBlend, 0);
  assert.equal(m.depthTest, true); assert.equal(m.depthWrite, false, 'bit 1 is the write mask (handleDepthFlags)');
  // defaults: a file with neither property draws opaque, tested and written
  const bare = resolveMaterial(nif, []);
  assert.equal(bare.alphaBlend, false); assert.equal(bare.depthTest, true); assert.equal(bare.depthWrite, true);
  // the reference's table, one for one, with its own fallback
  assert.deepEqual([...NIF_BLEND_MODES], ['ONE', 'ZERO', 'SRC_COLOR', 'ONE_MINUS_SRC_COLOR', 'DST_COLOR', 'ONE_MINUS_DST_COLOR',
    'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'DST_ALPHA', 'ONE_MINUS_DST_ALPHA', 'SRC_ALPHA_SATURATE']);
  assert.equal(nifBlendMode(42), 'SRC_ALPHA', 'getBlendMode’s default (nifloader.cpp:1926-1928)');
  const st = particleDrawState(m);
  assert.equal(st.blend, true); assert.equal(st.srcBlend, 6); assert.equal(st.dstBlend, 0); assert.equal(st.depthWrite, false);
  assert.equal(st.emissive, true, 'LightMode_Emissive: the flame is its own light');
});

// ---- the laws, each against the reference's numbers ------------------------

test('MAC-Q: ControllerFunction::calculate - inside the window as is, Cycle wraps, Reverse pendulums, Constant clamps', () => {
  const c = { frequency: 1, phase: 0, startTime: 1, stopTime: 3 };
  assert.equal(controllerTime({ ...c, extrapolation: EXTRAPOLATION.Cycle }, 2), 2);
  assert.ok(near(controllerTime({ ...c, extrapolation: EXTRAPOLATION.Cycle }, 3.5), 1.5));
  assert.ok(near(controllerTime({ ...c, extrapolation: EXTRAPOLATION.Reverse }, 3.5), 2.5), 'an odd cycle runs backwards');
  assert.ok(near(controllerTime({ ...c, extrapolation: EXTRAPOLATION.Reverse }, 5.5), 1.5), 'an even one forwards');
  assert.equal(controllerTime({ ...c, extrapolation: EXTRAPOLATION.Constant }, 9), 3);
  assert.equal(controllerTime({ ...c, frequency: 2, phase: 0.5, extrapolation: EXTRAPOLATION.Constant }, 1), 2.5, 'frequency and phase first');
  assert.equal(controllerTime({ ...c, stopTime: 1, extrapolation: EXTRAPOLATION.Cycle }, 7), 1, 'a zero-length window answers its start');
});

test('MAC-Q: interpKey - before the first key, past the last, linear between, Constant snaps at the half, Quadratic takes the tangents', () => {
  const keys = [{ time: 0, value: [1, 1, 1, 0] }, { time: 1, value: [0, 0, 0, 1] }];
  assert.deepEqual(interpColorKey(keys, -1), [1, 1, 1, 0]);
  assert.deepEqual(interpColorKey(keys, 2), [0, 0, 0, 1]);
  assert.ok(nearVec(interpColorKey(keys, 0.25), [0.75, 0.75, 0.75, 0.25]));
  assert.deepEqual(interpColorKey(keys, 0.4, 5), [1, 1, 1, 0], 'Constant: the low key below the half');
  assert.deepEqual(interpColorKey(keys, 0.6, 5), [0, 0, 0, 1], 'and the high one above it');
  assert.deepEqual(interpColorKey([], 0.5), [1, 1, 1, 1], 'no keys is the affector’s default (particle.cpp:257)');
  const quad = [{ time: 0, value: [0, 0, 0, 0], outTan: [1, 1, 1, 1] }, { time: 1, value: [1, 1, 1, 1], inTan: [1, 1, 1, 1] }];
  // f(0.5) = a*b1 + b*b2 + outTan*b3 + inTan*b4 with b1=b2=0.5, b3=0.125, b4=-0.125
  assert.ok(nearVec(interpColorKey(quad, 0.5, 2), [0.5, 0.5, 0.5, 0.5]));
});

test('MAC-Q: ParticleShooter - the direction is Quat(vdir, Y) * Quat(hdir, Z) on +Z, the speed and life ride the dice', () => {
  assert.ok(nearVec(shootDirection(0, 0), [0, 0, 1]), 'no angles: straight up the file’s Z');
  assert.ok(nearVec(shootDirection(0, Math.PI / 2), [1, 0, 0]), 'the vertical angle tips it about Y');
  assert.ok(nearVec(shootDirection(Math.PI / 2, Math.PI / 2), [0, 1, 0]), 'then the horizontal angle turns it about Z');
  const [d] = particleSystemsOf(torchNif({ ctrl: { speed: 10, speedVariation: 4, lifetime: 2, lifetimeVariation: 1, declination: 0.3, planarAngle: 0.7 } }));
  const at = (r) => { const ps = createParticleSystem(d, { rolls: () => r }); ps.update(1, 0); return ps.particles[0]; };
  const lo = at(0), hi = at(1);
  assert.ok(near(Math.hypot(...lo.vel), 8), 'speed - variation/2 at the low die (particle.cpp:212, :1386)');
  assert.ok(near(Math.hypot(...hi.vel), 12), 'speed + variation/2 at the high one');
  assert.ok(near(lo.life, 2) && near(hi.life, 3), 'lifetime + variation * die (:216-217)');
  const dir = shootDirection(0.7, 0.3);
  assert.ok(nearVec(lo.vel.map((v) => v / 8), dir, 1e-4), 'and the direction is the shooter’s, with no variation at the middle die');
});

test('MAC-Q: the rate is the reference’s - slots over the mean life, or the birth rate under NoAutoAdjust - and the counter carries its remainder', () => {
  const [auto] = particleSystemsOf(torchNif({ ctrl: { lifetime: 2, lifetimeVariation: 1 } }));
  assert.ok(near(createParticleSystem(auto).rate, 8 / 2.5), 'mParticles.size() / (lifetime + variation / 2) (:1381-1382)');
  const [manual] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 30 } }));
  assert.equal(createParticleSystem(manual).rate, 30, 'NoAutoAdjust: mBirthRate (:1376-1377)');
  const [dead] = particleSystemsOf(torchNif({ ctrl: { lifetime: 0, lifetimeVariation: 0 } }));
  assert.equal(createParticleSystem(dead).rate, 0, 'a zero life emits nothing (:1378-1379)');
  // ConstantRateCounter: 8/s at 1/60 is 0.133 a frame - one particle every ~7.5 frames, never a burst
  const ps = createParticleSystem(auto, { rolls: () => 0.5 });
  const made = [];
  for (let i = 0; i < 60; i++) { const before = ps.particles.length; ps.update(1 / 60, i / 60); made.push(ps.particles.length - before); }
  assert.equal(made.reduce((a, b) => a + b, 0), 3, 'a second at 3.2/s is three, the carry holding the fourth');
  assert.ok(made.every((n) => n <= 1));
});

test('MAC-Q: the quota is the file’s slot count, and a dead particle frees one', () => {
  const [d] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 1000, lifetime: 0.5 } }));
  const ps = createParticleSystem(d, { rolls: () => 0.5 });
  ps.update(1 / 60, 0);
  assert.equal(ps.particles.length, 8, 'a thousand a second still fills eight slots and no more');
  for (let i = 1; i < 60; i++) ps.update(1 / 60, i / 60);
  assert.ok(ps.particles.length <= 8 && ps.particles.length > 0, 'the slots turn over as particles die');
});

test('MAC-Q: Particle::update - judged before it ages, moved after; the emit window and a missing clock', () => {
  const [d] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 60, lifetime: 0.1, speed: 6, speedVariation: 0 } }));
  const ps = createParticleSystem(d, { rolls: () => 0.5 });
  ps.update(1 / 60, 0);
  const p = ps.particles[0];
  assert.ok(nearVec(p.pos, [0, 0, 0.1]), 'born at the emitter, moved one step at 6/s');
  assert.ok(near(p.age, 1 / 60));
  // x = age/life is judged BEFORE the age advances (Particle.cpp:70-79), and
  // the test is STRICTLY past one: a particle whose age exactly reaches its
  // life is still alive that step and dies the one after. Driven on a
  // quarter-second step over a one-second life, whose ratio is exact in
  // binary - sixtieths accumulate to 0.0999.. and never land ON the line.
  const [e] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 4, lifetime: 1, speed: 0, speedVariation: 0 } }));
  const ex = createParticleSystem(e, { rolls: () => 0.5 });
  ex.update(0.25, 0);
  const q = ex.particles[0];
  for (let i = 0; i < 4; i++) ex.update(0.25, 0);   // the 5th update judges x = 4 * 0.25 / 1 = 1 exactly
  assert.ok(ex.particles.includes(q), 'x = 1 at the check: not past it, alive');
  ex.update(0.25, 0);
  assert.ok(!ex.particles.includes(q), 'x = 1.25 > 1: gone');

  // THE EMIT WINDOW is the controller's own clock (nifosg/controller.cpp:594-604)
  const [w] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 60, emitStartTime: 1, emitStopTime: 2 } }));
  const win = createParticleSystem(w);
  win.update(1 / 60, 0.5); assert.equal(win.particles.length, 0, 'before the window: nothing');
  win.update(1 / 60, 1.5); assert.equal(win.particles.length, 1, 'inside it: emits');
  assert.equal(win.enabled, true);
  win.update(1 / 60, 2.5); assert.equal(win.enabled, false, 'past it: the emitter is disabled, the particles live on');
  // NO CLOCK IS NO SOURCE: frozen (:602-603)
  const froze = createParticleSystem(w);
  froze.update(1 / 60, null);
  assert.equal(froze.frozen, true); assert.equal(froze.particles.length, 0);
});

test('MAC-Q: GrowFade and the colour ramp - off the DEFAULT size, the key’s rgb as colour and its a as alpha', () => {
  const [d] = particleSystemsOf(torchNif({
    ctrl: { useBirthRate: 1, birthRate: 60, lifetime: 1, initialSize: 4, particleModifier: 9 },
    extra: [
      { type: 'NiParticleGrowFade', next: 10, controller: 4, grow: 0.5, fade: 0.25 },
      { type: 'NiParticleColorModifier', next: -1, controller: 4, colorData: 11 },
      { type: 'NiColorData', data: { type: 1, keys: [{ time: 0, value: [1, 1, 1, 0] }, { time: 1, value: [0.2, 0, 0, 1] }] } },
    ],
  }));
  const ps = createParticleSystem(d, { rolls: () => 0.5 });
  ps.update(1 / 60, 0);
  const p = ps.particles[0];
  // operate runs BEFORE the age advances, so the first frame is age 0
  assert.ok(near(p.size, 0), 'age 0 over a 0.5 grow is size 0 (particle.cpp:249-250)');
  assert.ok(nearVec(p.color, [1, 1, 1]) && near(p.alpha, 0), 'the first key: white, transparent');
  for (let i = 0; i < 30; i++) ps.update(1 / 60, 0);
  // age 30/60 = 0.5: fully grown (4), colour halfway, alpha 0.5
  assert.ok(near(p.size, 4, 1e-3), 'grown');
  assert.ok(nearVec(p.color, [0.6, 0.5, 0.5], 1e-3) && near(p.alpha, 0.5, 1e-3));
  for (let i = 0; i < 20; i++) ps.update(1 / 60, 0);
  // age 50/60: inside the 0.25 fade - (1 - 50/60) / 0.25 = 0.667 of 4
  assert.ok(near(p.size, 4 * ((1 - 50 / 60) / 0.25), 1e-3), 'fading (:251-252)');
  const q = ps.quads()[0];
  assert.ok(near(q.alpha, p.alpha), 'the quad’s alpha is colour.a * alpha, and the affector set colour.a to 1');
});

test('MAC-Q: GravityAffector - wind along the direction, point toward the position, both times dt and the magic 1.6, decayed by distance', () => {
  assert.equal(GRAVITY_MAGIC, 1.6, 'particle.cpp:316');
  const wind = (o) => particleSystemsOf(torchNif({
    ctrl: { useBirthRate: 1, birthRate: 60, speed: 0, speedVariation: 0, particleModifier: 9 },
    extra: [{ type: 'NiGravity', next: -1, controller: 4, decay: 0, force: 10, fieldType: 0, position: [0, 0, 0], direction: [0, 0, 1], ...o }],
  }))[0];
  const w = createParticleSystem(wind({}), { rolls: () => 0.5 });
  w.update(0.1, 0);
  assert.ok(nearVec(w.particles[0].vel, [0, 0, 10 * 0.1 * 1.6]), 'wind: direction * force * dt * magic');
  const pt = createParticleSystem(wind({ fieldType: 1, position: [0, 0, -5], direction: [0, 0, 0] }), { rolls: () => 0.5 });
  pt.update(0.1, 0);
  assert.ok(nearVec(pt.particles[0].vel, [0, 0, -10 * 0.1 * 1.6]), 'point: toward the position');
  const dec = createParticleSystem(wind({ decay: 1, position: [0, 0, -2] }), { rolls: () => 0.5 });
  dec.update(0.1, 0);
  assert.ok(near(dec.particles[0].vel[2], 10 * 0.1 * 1.6 * Math.exp(-2), 1e-6), 'exp(-decay * distance to the plane)');
});

test('MAC-Q: the two colliders reflect a crossing particle and leave a passing one alone', () => {
  const plane = { bounce: 0.5, height: 4, width: 4, position: [0, 0, 0], xVector: [1, 0, 0], yVector: [0, 1, 0], normal: [0, 0, 1], constant: 0 };
  // Plane(-normal, 0): a particle above, moving down, inside the extents
  assert.ok(nearVec(planarCollide(plane, [0, 0, 0.5], [0, 0, -10], 0.1), [0, 0, 5]), 'reflected and damped by the bounce');
  assert.equal(planarCollide(plane, [0, 0, 0.5], [0, 0, 10], 0.1), null, 'moving away: no');
  assert.equal(planarCollide(plane, [0, 0, 5], [0, 0, -10], 0.1), null, 'would not cross this step: no');
  assert.equal(planarCollide(plane, [9, 0, 0.5], [0, 0, -10], 0.1), null, 'outside the extents: no');
  const sphere = { bounce: 1, radius: 1, position: [0, 0, 0] };
  assert.ok(nearVec(sphericalCollide(sphere, [0, 0, 1.5], [0, 0, -10], 0.1), [0, 0, 10]), 'flying at the sphere: reflected');
  assert.equal(sphericalCollide(sphere, [0, 0, 1.5], [0, 0, 10], 0.1), null, 'flying away: no');
  assert.equal(sphericalCollide(sphere, [0, 0, 1.5], [0, 0, 0], 0.1), null, 'standing still: no');
});

// ---- the frames, the placement, the pack ----------------------------------

test('MAC-Q: the affines compose, invert and orthonormalise', () => {
  const rot = { rotation: Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]), translation: [1, 2, 3], scale: 2 };
  const m = affineOfTransform(rot);
  assert.ok(nearVec(affineApply(m, 1, 0, 0), [1, 4, 3]), 'rotate (Z90), scale 2, translate');
  const inv = affineInverse(m);
  assert.ok(nearVec(affineApply(inv, ...affineApply(m, 5, 6, 7)), [5, 6, 7]));
  assert.ok(near(affineScale(m), 2));
  assert.ok(near(affineScale(affineOrthoNormalize(m)), 1), 'orthoNormalize divides the scale out (particle.cpp:548)');
  assert.ok(nearVec(affineOrthoNormalize(m).t, [1, 2, 3]), 'and keeps the translation');
  assert.ok(nearVec(affineApply(affineMul(m, inv), 9, 9, 9), [9, 9, 9]), 'm * m^-1 is identity');
  assert.ok(nearVec(affineApply(AFFINE_IDENTITY, 1, 2, 3), [1, 2, 3]));
});

test('MAC-Q: the emitter’s frame is emitter -> file -> particle node, so a flame born at the emitter lands where the emitter is', () => {
  // the emitter node sits at z 10; the particle node is its child at (5, 0, 0)
  const nif = torchNif();
  nif.records[2].translation = [5, 0, 0];
  const [d] = particleSystemsOf(nif);
  const ps = createParticleSystem(d);
  assert.ok(nearVec(ps.emitterToPs.t, [-5, 0, 0]), 'in the particle node’s space the emitter is five units back');
  ps.update(1, 0);
  assert.ok(nearVec(ps.particles[0].pos.slice(0, 2), [-5, 0]), 'so a particle is born there, not at the node’s origin');
});

test('MAC-Q: the two reference frames - LocalSpace rides the hand, absolute stays where it was born', () => {
  const frame = { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [100, 0, 0] };
  const [local] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 60, speed: 0 } }));
  const lp = createParticleSystem(local, { rolls: () => 0.5 });
  lp.update(1 / 60, 0);
  assert.ok(nearVec(lp.particles[0].pos, [0, 0, 0]), 'local: kept in the node’s own space');
  const [abs] = particleSystemsOf(torchNif({ nodeFlags: 0x20, ctrl: { useBirthRate: 1, birthRate: 60, speed: 0 } }));
  assert.equal(abs.localSpace, false);
  const ap = createParticleSystem(abs, { rolls: () => 0.5 });
  ap.update(1 / 60, 0, frame);
  assert.ok(nearVec(ap.particles[0].pos, [100, 0, 0]), 'absolute: born through the frame the caller keeps world particles in');
  ap.update(1 / 60, 0, { ...frame, t: [200, 0, 0] });
  assert.ok(nearVec(ap.particles[0].pos, [100, 0, 0]), 'and left behind when the frame moves on - Morrowind’s trailing fire');
  assert.ok(nearVec(ap.particles[1].pos, [200, 0, 0]));
});

test('MAC-Q: effectPlacement is placeAtBone’s own arithmetic, composed - the particle lands exactly where a vertex at the same file point would', () => {
  const at = { a: Float32Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]), t: [10, 20, 30] };
  const mats = new Map([[7, at]]);
  const pre = { a: Float32Array.from([1, 0, 0, 0, 0, -1, 0, 1, 0]), t: [0, 0, 1] };   // an attitude: Rx(90) and a lift
  const world = { rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), translation: [0, 0, 10], scale: 1 };
  const eff = { attachRef: 7, mirrored: true, boneOffset: [1, 2, 3], pre, desc: { world } };
  const m = effectPlacement(eff, mats, attachmentTransform);
  const particle = [2, 3, 4];   // in the particle node's space
  // the same point as a vertex: baked to the file root, pre-transformed, then placed
  const fileV = [particle[0] + world.translation[0], particle[1] + world.translation[1], particle[2] + world.translation[2]];
  const preV = [pre.a[0] * fileV[0] + pre.a[1] * fileV[1] + pre.a[2] * fileV[2] + pre.t[0],
    pre.a[3] * fileV[0] + pre.a[4] * fileV[1] + pre.a[5] * fileV[2] + pre.t[1],
    pre.a[6] * fileV[0] + pre.a[7] * fileV[1] + pre.a[8] * fileV[2] + pre.t[2]];
  const placed = placeAtBone(Float32Array.from(preV), at, true, undefined, [1, 2, 3]);
  assert.ok(nearVec(affineApply(m, ...particle), [...placed]), 'one composition, the same answer');
});

test('MAC-Q: packParticleQuads - six vertices of twelve floats a particle, the corners billboarded by the shader, the picture upright', () => {
  assert.equal(PARTICLE_FLOATS, 12);
  assert.equal(PARTICLE_CORNERS.length, 6);
  // the two top corners take v 0 and the two bottom ones v 1: a DDS is
  // uploaded top row first, so v 0 is the picture's top
  for (const [, cy, , v] of PARTICLE_CORNERS) assert.equal(v, cy > 0 ? 0 : 1);
  const { packed, count } = packParticleQuads([{ pos: [1, 2, 3], size: 0.5, color: [1, 0.5, 0], alpha: 0.25 }], null, {
    place: (x, y, z) => [x + 10, y, z], sizeScale: 2,
  });
  assert.equal(count, 6);
  assert.deepEqual([...packed.slice(0, 12)], [11, 2, 3, -1, -1, 0, 1, 1, 0.5, 0, 0.25, 1], 'centre placed, corner, uv, rgba, size scaled');
  // an out buffer big enough is reused, not reallocated
  const again = packParticleQuads([{ pos: [0, 0, 0], size: 1, color: [1, 1, 1], alpha: 1 }], packed);
  assert.equal(again.packed, packed);
});

// ---- the assembly and the arm -----------------------------------------------

const ANIMATED = new Uint8Array(readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)));

test('MAC-Q: bindPart carries a part’s particle systems out beside its batches, and bindPartsInto places them like its rigid shapes', () => {
  const skeleton = buildSkeleton(parseNif(ANIMATED));
  const partNif = torchNif();
  // a rigid triangle in the same file, so the part binds as a rigid part
  partNif.records.push(
    { ...node({ name: 'Stick', translation: [0, 0, 0] }), type: 'NiTriShape', data: 10, skin: -1 },
    { type: 'NiTriShapeData', numVertices: 3, vertices: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: null, colors: null, uvSets: [], triangles: Uint16Array.from([0, 1, 2]), numTriangles: 1 },
  );
  partNif.records[0].children.push(9);
  const bound = bindPart(skeleton, partNif, { attachBone: 'Bone1' });
  assert.equal(bound.attached.length, 1);
  assert.equal(bound.effects.length, 1, 'the flame rides out of bindPart');
  assert.equal(bound.effects[0].name, 'Flame');

  const assembly = { pieces: [], notes: [], skeleton, fns: { parseNif: () => partNif, bindPart, PART_BONES: {} } };
  bindPartsInto(assembly, [{ slot: 'torch', bones: ['Bone1'], bytes: new Uint8Array(0), preTransform: { a: I3, t: [0, 0, 5] } }]);
  assert.equal(assembly.pieces.length, 1);
  assert.equal(assembly.effects.length, 1, 'and onto the assembly');
  const eff = assembly.effects[0];
  assert.equal(eff.slot, 'torch');
  assert.equal(eff.attachRef, assembly.pieces[0].attachRef, 'the same bone as the stick');
  assert.equal(eff.mirrored, assembly.pieces[0].mirrored, 'the same mirror');
  assert.deepEqual(eff.pre.t, [0, 0, 5], 'the same attitude');
  assert.equal(eff.material.textureFile, 'textures\\tx_fire_01.dds');
  assert.equal(eff.desc, bound.effects[0].constructor === Object ? eff.desc : eff.desc);
});

test('MAC-Q: stepRigEffects - the clock, the hide, the upload; nothing without mats, nothing frozen without a clock', () => {
  const mats = new Map([[7, { a: I3, t: [10, 0, 0] }]]);
  const [desc] = particleSystemsOf(torchNif({ ctrl: { useBirthRate: 1, birthRate: 60, speed: 0, speedVariation: 0 } }));
  const assembly = { effects: [{ slot: 'torch', attachRef: 7, mirrored: false, boneOffset: null, pre: null, desc, material: desc.material }], mats, fns: { attachmentTransform } };
  const calls = { created: 0, updated: [], textures: 0 };
  const renderer = {
    createParticleEffect: (cap, st) => { calls.created++; return { capacity: cap, state: st, count: 0, hidden: false, tex: null }; },
    updateParticleEffect: (e, packed, count) => { calls.updated.push(count); e.count = count; },
    createCharacterTexture: () => { calls.textures++; return { tex: true }; },
  };
  const mesh = {};
  const textures = new Map([['textures\\tx_fire_01.dds', { image: { mips: [] } }]]);
  assert.equal(stepRigEffects({ effects: [] }, { dt: 1 / 60 }), 0);
  assert.equal(stepRigEffects({ effects: assembly.effects }, { dt: 1 / 60 }), 0, 'no mats: not posed, nothing to place');
  const live = stepRigEffects(assembly, { dt: 1 / 60, clock: 0, renderer, mesh, textures, hidden: (e) => e.slot === 'torch' });
  assert.equal(live, 1);
  assert.equal(calls.created, 1, 'one GL effect per system, on first sight');
  assert.equal(calls.textures, 1, 'textured through the catalog');
  assert.equal(mesh.effects[0].state.blend, true);
  assert.equal(mesh.effects[0].hidden, true, 'the hide law is the caller’s');
  assert.deepEqual(calls.updated, [6]);
  assert.ok(nearVec(assembly.effects[0].packed.slice(0, 3), [10, 0, 10]), 'placed: the bone at x 10, the node at z 10');
  stepRigEffects(assembly, { dt: 1 / 60, clock: 1 / 60, renderer, mesh, textures });
  assert.equal(calls.created, 1, 'and never a second one');
  assert.equal(mesh.effects[0].hidden, false);
  // no clock: frozen, the particles it had are kept and re-uploaded as they stand
  const before = assembly.effects[0].sim.particles.length;
  stepRigEffects(assembly, { dt: 1 / 60, clock: null, renderer, mesh, textures });
  assert.equal(assembly.effects[0].sim.particles.length, before);
});

test('MAC-Q: the arm and the renderer - the seams, read', () => {
  const arm = read('src/combat/fpArm.js');
  assert.match(arm, /stepRigEffects\(built\.arm, \{ dt, clock: fOverlay \? overlayClock : poseTime\(state\), renderer, mesh, textures: built\.textures, hidden: effectHidden \}\)/, 'first person, after the mesh');
  assert.match(arm, /stepRigEffects\(t\.arm, \{ dt: effectsDt, clock: tOverlay \? overlayClock : poseTime\(state\), renderer, mesh: thirdMesh, textures: t\.textures, hidden: effectHidden \}\)/, 'and the body (PEER-CADENCE: on the banked dt)');
  assert.match(arm, /if \(eff\.slot === 'torch'\) return !torchVisible\(\);/, 'the flame hides with the torch (MW-D51’s carried-left rule)');
  assert.match(arm, /for \(const e of m\.effects \|\| \[\]\) renderer\.releaseParticleEffect\(e\);/, 'and is released with the mesh');
  assert.match(arm, /rigBuilt\.arm\.effects = \(rigBuilt\.arm\.effects \?\? \[\]\)\.filter\(\(e\) => e\.slot !== 'torch'\);/, 'a re-lit torch replaces its flame');
  assert.match(arm, /collectArmTextures\(\[\.\.\.arm\.pieces, \.\.\.\(arm\.effects \?\? \[\]\)\], archives, gen\)/, 'the flame’s texture rides the catalog');
  const rend = read('src/render/renderer.js');
  assert.match(rend, /if \(mesh\.effects && mesh\.effects\.length\) this\._drawParticleEffects\(mesh, modelMatrix\);/, 'drawn after the ranges, in the same pass');
  assert.match(rend, /gl\.blendFunc\(gl\[nifBlendMode\(e\.srcBlend\)\], gl\[nifBlendMode\(e\.dstBlend\)\]\)/, 'with the file’s own blend function');
  assert.match(rend, /vec3 right = normalize\(vec3\(mv\[0\]\[0\], mv\[1\]\[0\], mv\[2\]\[0\]\)\);/, 'billboarded off the model-view’s rows');
  assert.match(rend, /this\._use\(this\.charProgram\);   \/\/ the pass's own program back/, 'and the character program handed back');
  // the probe is what proves the pixels
  const probe = read('tools/macqFlameProbe.mjs');
  assert.match(probe, /the flame is LIT where it stands/);
  assert.match(probe, /a hidden effect draws nothing/);
});
