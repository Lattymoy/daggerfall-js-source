// CSA-F (2026-09-27) - UNITY'S PARTICLE SYSTEM AS COME SAIL AWAY'S PREFABS USE IT: world/unityParticles.js over the
// vendored prefabs' own systems (Models/prefabs.json) - the curves, emission by time, distance and burst, the shapes,
// Local scaling, the size and force modules, plane collisions and their sub-emitters, Play and Stop. Every expectation
// is worked out here from the modules' documented behaviour and the serialized values.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instantiatePrefab } from '../../src/world/prefabNode.js';
import {
  instanceParticleSystems, evaluateKeyframes, evaluateMinMax, constantCurve, twoConstantsCurve, SPACE, SUB_EMITTER, RENDER_MODE, particleMeshRotation,
} from '../../src/world/unityParticles.js';
import { evaluateCurve } from '../../src/world/worldClock.js';
import { quatRotate } from '../../src/world/quat.js';

const P = JSON.parse(readFileSync(new URL('../../vendor/come-sail-away/Models/prefabs.json', import.meta.url), 'utf8'));
const near = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const nearV = (a, b, eps = 1e-6, msg = '') => a.forEach((v, i) => near(v, b[i], eps, `${msg}[${i}]`));
/** A draw sequence: each call the next value, round again. */
const draws = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const skiff = (random = draws(0.5)) => {
  const root = instantiatePrefab(P.prefabs['112411'], P.components);
  const systems = instanceParticleSystems(root, { random });
  const sys = (path) => root.find(path).getComponent('ParticleSystem').particleSystem;
  return { root, systems, sys };
};
const step = (systems, dt = 0.1, n = 1) => { for (let i = 0; i < n; i++) for (const s of systems) s.step(dt); };

test('CSA-F: AnimationCurve.Evaluate - a cubic Hermite on each span\'s outer slopes, held flat past the ends; MinMaxCurve\'s four modes', () => {
  const keys = P.components[28].SizeModule.curve.maxCurve.m_Curve;   // the wake's size: 0.25 up to 1 at the middle, down to 0
  assert.equal(evaluateKeyframes(keys, -1), 0.25);
  assert.equal(evaluateKeyframes(keys, 0), 0.25);
  assert.equal(evaluateKeyframes(keys, 2), 0);
  const [a, b] = keys;
  const h = (t) => { const d = b.time - a.time, s = (t - a.time) / d; return (2 * s ** 3 - 3 * s ** 2 + 1) * a.value + (s ** 3 - 2 * s ** 2 + s) * a.outSlope * d + (-2 * s ** 3 + 3 * s ** 2) * b.value + (s ** 3 - s ** 2) * b.inSlope * d; };
  near(evaluateKeyframes(keys, 0.25), h(0.25));
  near(evaluateKeyframes(keys, b.time), 1, 1e-6);
  assert.equal(evaluateKeyframes(keys, 0.3), evaluateCurve(keys.map((k) => [k.time, k.value, k.inSlope, k.outSlope]), 0.3), 'worldClock\'s evaluateCurve, the one home');
  assert.equal(evaluateKeyframes([], 0.5), 0, 'an empty curve: nought');
  // what that home does not read, the prefabs never carry: every key of every curve finite, unweighted, and after the last
  const all = [];
  const walk = (o) => { if (o && typeof o === 'object') { if (Array.isArray(o.m_Curve)) all.push(o.m_Curve); for (const v of Object.values(o)) walk(v); } };
  walk(P.components);
  assert.ok(all.flat().length > 50, `${all.flat().length} keys`);
  for (const c of all) c.forEach((k, i) => {
    assert.ok(Number.isFinite(k.inSlope) && Number.isFinite(k.outSlope), 'no stepped key');
    assert.ok(!k.weightedMode, 'no weighted key');
    assert.ok(i === 0 || k.time > c[i - 1].time, 'no two at one time');
  });
  assert.equal(evaluateMinMax(constantCurve(3), 0.7, 0.9), 3);
  assert.equal(evaluateMinMax(twoConstantsCurve(2, 6), 0, 0.25), 3);
  assert.equal(evaluateMinMax({ minMaxState: 1, scalar: 2, maxCurve: { m_Curve: keys } }, 0), 0.5);
  assert.equal(evaluateMinMax({ minMaxState: 2, scalar: 2, minCurve: { m_Curve: [{ time: 0, value: 0, inSlope: 0, outSlope: 0 }] }, maxCurve: { m_Curve: [{ time: 0, value: 1, inSlope: 0, outSlope: 0 }] } }, 0, 0.5), 1);
});

test('CSA-F: an instance\'s systems - one a ParticleSystem component, the collision planes and sub-emitters linked within the instance, the flag\'s playOnAwake playing from the start and the others not', () => {
  const { systems, sys } = skiff();
  assert.equal(systems.length, 12);
  const rudder = sys('OldSkiffHull/RudderObject/OldSkiffRudder/RudderEffect');
  assert.equal(rudder.planes.length, 1);
  assert.equal(rudder.planes[0].name, 'Plane');
  assert.equal(rudder.subEmitters.length, 1);
  assert.equal(rudder.subEmitters[0].type, SUB_EMITTER.Collision);
  assert.equal(rudder.subEmitters[0].system, sys('OldSkiffHull/RudderObject/OldSkiffRudder/RudderEffect/Particle System (3)'));
  assert.equal(rudder.subEmitters[0].system.isSubEmitter, true);
  assert.equal(sys('OldSkiffHull/Variants/0/FlagObject/Particle System').isPlaying, true, 'playOnAwake');
  assert.equal(sys('WakeObject').isPlaying, false);
  assert.equal(sys('WakeObject').renderer.m_RenderMode, RENDER_MODE.HorizontalBillboard);
});

test('CSA-F: Play and Stop reach the children (withChildren) but never a system that is a sub-emitter; Stop ends the emitting, not the living', () => {
  const { sys } = skiff();
  const wake = sys('WakeObject');
  wake.play();
  assert.deepEqual(wake.node.children.map((c) => c.getComponent('ParticleSystem').particleSystem.isPlaying), [true, true], 'the two bow systems');
  const rudder = sys('OldSkiffHull/RudderObject/OldSkiffRudder/RudderEffect');
  rudder.play();
  assert.equal(rudder.subEmitters[0].system.isPlaying, false, 'its splash is its sub-emitter, played only through it');
  wake.stop();
  assert.equal(wake.isEmitting, false);
});

test('CSA-F: rate over distance - the emitter\'s world movement counted from the step after Play, a particle for each whole one the accumulator crosses, each born where the emitter stood at its fraction of the frame', () => {
  const { root, sys } = skiff();
  const wake = sys('WakeObject');   // 0.5 a metre, world space, speed nought
  wake.play();
  step([wake], 0.1);   // the first step: no last position, nothing moved
  assert.equal(wake.particleCount, 0);
  root.localPosition = [0, 0, 4];   // 4 m: 2 particles, at the frame's half and its end
  step([wake], 0.1);
  assert.equal(wake.particleCount, 2);
  const zs = wake.getParticles().map((q) => q.position[2]).sort((a, b) => a - b);
  near(zs[0], 2, 1e-4, 'the first where the emitter stood half way');
  near(zs[1], 4, 1e-4);
  assert.equal(wake.getParticles()[0].position[1] <= 0.1 + 0.05 && wake.getParticles()[0].position[1] >= 0.1 - 0.05, true, 'the Box: a point in its 0.01-tall volume, times the object\'s 10 (Local scaling)');
  root.localPosition = [0, 0, 5];   // 1 m more: the accumulator at 0.5
  step([wake], 0.1);
  assert.equal(wake.particleCount, 2);
  root.localPosition = [0, 0, 6];
  step([wake], 0.1);
  assert.equal(wake.particleCount, 3);
});

test('CSA-F: Local scaling - the wake\'s size is its start size times the size curve at its age times its object\'s local scale (the skiff\'s 10); its life the lifetime multiplier the C# sets', () => {
  const { root, sys } = skiff();
  const wake = sys('WakeObject');
  wake.main.startLifetimeMultiplier = 2;
  wake.main.startSize = constantCurve(0.2);
  wake.play();
  step([wake], 0.1);
  root.localPosition = [0, 0, 2];
  step([wake], 0.1);   // one particle, born at the frame's end
  const [q] = wake.renderList();
  assert.equal(wake.getParticles()[0].startLifetime, 2);
  near(q.size[0], 0.2 * evaluateKeyframes(P.components[28].SizeModule.curve.maxCurve.m_Curve, 0) * 10, 1e-5);
  step([wake], 0.5, 2);   // a second on: half its life
  near(wake.renderList()[0].size[0], 0.2 * evaluateKeyframes(P.components[28].SizeModule.curve.maxCurve.m_Curve, 0.5) * 10, 1e-5);
  step([wake], 0.5, 2);   // two seconds: dead
  assert.equal(wake.particleCount, 0);
  // the Box's volume, too, through the shape's scale and then the object's own: a draw off the middle (0.9) is 0.4 of
  // the shape's 0.01 up, times the skiff's 10
  const off = skiff(draws(0.9));
  const w2 = off.sys('WakeObject');
  w2.play();
  step([w2], 0.1);
  off.root.localPosition = [0, 0, 2];
  step([w2], 0.1);
  const s2 = w2.node.localScale;
  const lp = [0, (0.9 - 0.5) * P.components[28].ShapeModule.m_Scale.y, 0];
  const want = quatRotate(w2.node.rotation, lp.map((v, i) => v * s2[i])).map((v, i) => v + w2.node.position[i]);
  assert.equal(s2[1], 10);
  nearV(w2.getParticles()[0].position, want, 1e-6, 'born 0.04 off the emitter');
});

test('CSA-F: the drops - a zero-scale Box keeps its own axis (they fall along the rudder effect\'s forward at its 100 m/s); crossing the helper Plane they lose all their life and fire the splash at the crossing', () => {
  const { root, sys } = skiff();
  const rudder = sys('OldSkiffHull/RudderObject/OldSkiffRudder/RudderEffect');
  const splash = rudder.subEmitters[0].system;
  rudder.play();
  step([rudder, splash], 1 / 60);
  root.localPosition = [0, 0, 1];   // a metre: one drop, born at the frame's end
  rudder.step(1 / 60);
  assert.equal(rudder.particleCount, 1);
  const drop = rudder.getParticles()[0];
  nearV(drop.velocity, [0, 0, 100], 1e-4, 'local space: the shape\'s own +Z, 100 m/s');
  const fwd = quatRotate(rudder.node.rotation, [0, 0, 1]);
  const w0 = rudder.renderList()[0].position;
  nearV(w0.map((v, i) => v - rudder.node.position[i]), [0, 0, 0], 1e-6, 'born at the emitter');
  assert.ok(fwd[1] < -0.4, 'the rudder\'s forward points down into the water');
  // the drop falls 1.08 m to the plane at y = 0 along a forward half down: in about 2.2 m, 0.022 s
  rudder.step(1 / 60);
  assert.equal(rudder.particleCount, 1);
  rudder.step(1 / 60);
  assert.equal(rudder.particleCount, 0, 'crossed: its lifetime lost whole');
  assert.equal(splash.particleCount, 1, 'the splash sub-emitter\'s burst of one');
  near(splash.getParticles()[0].position[1], 0.125, 1e-3, 'where its collision sphere touched the plane - half its 0.25 size above it (radius scale 1)');
});

test('CSA-F: a system that does not loop emits its time-0 burst once and stops emitting at its duration; a burst of one at Play, again at the next Play once it has stopped', () => {
  const root = instantiatePrefab(P.prefabs['112410'], P.components);
  instanceParticleSystems(root, { random: draws(0.5) });
  const oar = root.find("Dingy/RudderObject/OarL/T'avaTriremeOar/OarEffect").getComponent('ParticleSystem').particleSystem;
  assert.equal(oar._sim.looping, false);
  oar.play();
  oar.step(0.01);
  assert.equal(oar.particleCount, 1, 'the burst');
  oar.step(0.01);
  assert.equal(oar.particleCount, 1, 'once');
  for (let i = 0; i < 60; i++) oar.step(0.1);
  assert.equal(oar.isEmitting, false, 'past its five seconds');
  assert.equal(oar.isPlaying, false, 'and nothing alive');
  oar.play();
  oar.step(0.01);
  assert.equal(oar.particleCount, 1, 'played again: the burst again');
});

test('CSA-F: a world-space force is added to the velocity each step; a local-space system\'s particles ride their emitter', () => {
  const { root, sys } = skiff();
  const wake = sys('WakeObject');
  wake.forceOverLifetime.space = SPACE.World;
  wake.forceOverLifetime.x = constantCurve(2);
  wake.play();
  step([wake], 0.1);
  root.localPosition = [0, 0, 2];
  step([wake], 0.1);
  const q = wake.getParticles()[0];
  const x0 = q.position[0];
  wake.step(0.5);
  near(q.velocity[0], 1, 1e-6, 'two a second for half a second');
  near(q.position[0], x0 + 0.5, 1e-6, 'the new velocity over the step');
  const bow = sys('WakeObject/Particle System (4)');   // local space
  bow.play();
  bow.step(0.1);
  root.localPosition = [0, 0, 3];
  bow.step(0.01);
  const before = bow.renderList().map((r) => r.position[2]);
  root.localPosition = [0, 0, 13];
  const after = bow.renderList().map((r) => r.position[2]);
  after.forEach((z, i) => near(z - before[i], 10, 1e-4, 'moved with the boat'));
});

test('CSA-F: the flag - Mesh particles, a streamer of cubes along its forward: per-axis sizes from the size module (0.2, 3 falling to nought, 0.2 of the start size) through its object\'s (1, 1, 2) scale, turned by its system and its own 45 degrees about y', () => {
  const { root, sys } = skiff();
  const variant = root.find('OldSkiffHull/Variants/0');
  variant.setActive(true);
  const flag = sys('OldSkiffHull/Variants/0/FlagObject/Particle System');
  assert.equal(flag.renderer.m_RenderMode, RENDER_MODE.Mesh);
  assert.deepEqual(flag.renderer.m_Mesh, { builtin: 'Cube' });
  flag.main.startSpeed = constantCurve(0.5);
  for (let i = 0; i < 10; i++) flag.step(0.02);   // 50 a second
  assert.ok(flag.particleCount >= 9 && flag.particleCount <= 10, `${flag.particleCount}`);
  const r = flag.renderList().sort((a, b) => a.position[2] - b.position[2])[0];
  const age = 1 - flag.getParticles().find((q) => true).remainingLifetime / 0.5;
  assert.ok(age >= 0);
  near(r.size[0], 0.2 * 0.2, 1e-6);
  near(r.size[2], 0.2 * 0.2 * 2, 1e-6, 'z doubled by the object');
  const oldest = flag.getParticles().reduce((a, b) => (a.remainingLifetime < b.remainingLifetime ? a : b));
  const t = 1 - oldest.remainingLifetime / oldest.startLifetime;
  const oldestSize = flag.renderList()[flag.getParticles().indexOf(oldest)].size;
  near(oldestSize[1], 0.2 * 3 * (1 - t), 1e-4, 'y: three times the start size, falling to nought over the life');
  assert.deepEqual(r.rotation.map((v) => +v.toFixed(4)), [0, 0.7854, 0]);
  const q = particleMeshRotation([0, 0, 0, 1], r.rotation);
  nearV(quatRotate(q, [1, 0, 0]), [Math.SQRT1_2, 0, -Math.SQRT1_2], 1e-5, 'Euler(0, 45, 0)');
  // the system's rotation first, then the particle's own: a system turned a quarter about x, the particle 45 about y
  const turned = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  nearV(quatRotate(particleMeshRotation(turned, [0, Math.PI / 4, 0]), [1, 0, 0]), quatRotate(turned, [Math.SQRT1_2, 0, -Math.SQRT1_2]), 1e-5, 'the particle\'s turn inside the system\'s frame');
});
