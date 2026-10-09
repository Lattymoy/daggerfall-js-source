// MWNPC9 (2026-10-09, the MW-NPC arc's ninth slice - bible/04-Characters/Morrowind-NPCs.md section 14): DAGGERFALL'S
// CREATURES IN MORROWIND CREATURE BODIES. 9a, the body: a CREA record (formats/mwFirstPerson.js readCreature - its
// flags as OpenMW's loadcrea.hpp numbers them), its model - which is its skeleton and its body at once - and its own
// .kf (xbase_anim's too for a bipedal one, creatureanimation.cpp). Each rigid shape rides the node it hangs under
// (formats/mwCharacter.js bindCreatureModel), each skinned one its bones, and the "Tri Bip" debug shapes are dropped
// as OpenMW drops them from a creature's root. Pinned on a creature fixture written the way retail's are
// (fixtures/mw/creatureRig.mjs): the rest is the file's own picture, a turned node turns its piece and nothing else, a
// walked root carries the whole body, and the sources are the reference's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { assembleCreature, poseAssembly, creatureAnimSources, TP_BASE_MODEL } from '../src/formats/mwFirstPerson.js';
import { bindCreatureModel, isTriBip } from '../src/formats/mwCharacter.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { attachmentTransform } from '../src/formats/mwCharacter.js';
import { effectPlacement } from '../src/combat/fpArm.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { creatureModel, creatureClip, CREATURE_MODEL, CREATURE_KF } from './fixtures/mw/creatureRig.mjs';

const near = (a, b, eps = 1e-4) => a.length === b.length && Array.from(a).every((v, i) => Math.abs(v - b[i]) < eps);
const byShape = (asm) => new Map(asm.pieces.map((p) => [p.kind === 'skinned' ? p.batch.name : p.shape, p]));

test('MWNPC9a-1 a creature\'s model is its skeleton and its body: every shape bound - the skinned by its bones, each rigid one on the node it hangs under - the "Tri Bip" debug shapes dropped; at rest each stands exactly where the file draws it', async () => {
  const bytes = creatureModel();
  const asm = await assembleCreature({ modelBytes: bytes });
  assert.equal(asm.ok, true, asm.error);
  const pieces = byShape(asm);
  assert.deepEqual([...pieces.keys()].sort(), ['Tri Body', 'Tri Head', 'Tri Tail']);
  assert.deepEqual(asm.dropped, ['Tri Bip01'], 'the debug shape left out (RemoveTriBipVisitor, a creature\'s alone)');
  assert.equal(pieces.get('Tri Body').kind, 'skinned');
  const nif = parseNif(bytes);
  const sk = buildSkeleton(nif);
  assert.equal(pieces.get('Tri Head').kind, 'rigid');
  assert.equal(pieces.get('Tri Head').attachRef, sk.byName.get('head'), 'the head rides Head');
  assert.equal(pieces.get('Tri Tail').attachRef, sk.byName.get('tail'), 'the tail rides Tail');
  assert.ok(asm.pieces.every((p) => p.slot === 'creature' && !p.mirrored && !p.boneOffset));
  // the rest: each piece where the flattener (the file's own transform chain) puts it
  const flat = new Map(flattenNif(nif).map((b) => [b.name, b]));
  for (const name of ['Tri Head', 'Tri Tail']) assert.ok(near(pieces.get(name).positions, flat.get(name).positions), `${name} at rest is the file's picture (${Array.from(pieces.get(name).positions)})`);
  assert.ok(near(pieces.get('Tri Body').positions, flat.get('Tri Body').positions), 'the skinned body stands as authored over its inverse binds');
  assert.ok(near(pieces.get('Tri Head').positions.slice(0, 3), [4, 1, 17]), 'the head\'s own offset turned by its node: (1,0,0) a quarter about z, at (4,0,17)');
});

test('MWNPC9a-2 posed by its own .kf: a turned node turns its piece and nothing else; the walked root carries every piece, rigid and skinned alike', async () => {
  const asm = await assembleCreature({ modelBytes: creatureModel() });
  const rest = new Map([...byShape(asm)].map(([k, p]) => [k, Float32Array.from(p.positions)]));
  const tracks = extractTracks(parseNif(creatureClip()));
  // t 0: the clip's first frame is the rest (the head's key IS its rest's quarter turn)
  poseAssembly(asm, { tracks, sampleTrack, time: 0 });
  for (const [k, p] of byShape(asm)) assert.ok(near(p.positions, rest.get(k)), `${k}: the clip's first frame is the rest`);
  // t 2.5: Attack1's hit - Head a half turn, everything else at rest
  poseAssembly(asm, { tracks, sampleTrack, time: 2.5 });
  const at = byShape(asm);
  assert.ok(near(at.get('Tri Tail').positions, rest.get('Tri Tail')), 'the tail did not move');
  assert.ok(near(at.get('Tri Body').positions, rest.get('Tri Body')), 'nor the body');
  assert.ok(!near(at.get('Tri Head').positions, rest.get('Tri Head')), 'the head turned');
  assert.ok(near(at.get('Tri Head').positions.slice(0, 3), [3, 0, 17]), `(1,0,0) a half turn about z from (4,0,17): (${Array.from(at.get('Tri Head').positions.slice(0, 3))})`);
  // t 2.1: WalkForward's last frame - Bip01 ten units forward; every piece under it with it
  poseAssembly(asm, { tracks, sampleTrack, time: 2.1 });
  for (const [k, p] of byShape(asm)) {
    const moved = Array.from(p.positions).map((v, i) => v - rest.get(k)[i]);
    for (let i = 0; i < moved.length; i += 3) assert.ok(near(moved.slice(i, i + 3), [0, 10, 0]), `${k}: carried ten forward (${moved.slice(i, i + 3)})`);
  }
});

test('MWNPC9a-3 the binder: a rigid shape whose node the skeleton lacks rides the root; isTriBip is a case-blind prefix', () => {
  const nif = parseNif(creatureModel({ withTriBip: false }));
  const sk = buildSkeleton(nif);
  const b = bindCreatureModel(sk, nif);
  assert.deepEqual(b.dropped, []);
  assert.equal(b.rigid.length, 2);
  assert.ok(b.rigid.every((r) => r.pre && sk.nodes.has(r.attachRef)), 'every rigid shape on a node, with its rest undone');
  assert.equal(isTriBip('Tri Bip01 Head'), true);
  assert.equal(isTriBip('tri bip'), true);
  assert.equal(isTriBip('Tri Body'), false);
  assert.equal(isTriBip('Tri Tail Bip01'), false, 'a prefix, not anywhere in the name');
  assert.equal(isTriBip(null), false);
});

test('MWNPC9a-5 a creature\'s particle system (an atronach\'s flame) rides its node as its rigid shapes do: at rest placed where the file puts it, posed with the node', () => {
  // the flame test's shape (macq_flame.test.js torchNif), data-in: Root -> Fire (z 10, under Body) -> Flame
  const I3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const node = (o) => ({ type: 'NiNode', name: '', flags: 0, translation: [0, 0, 0], rotation: I3, scale: 1, properties: [], children: [], effects: [], controller: -1, ...o });
  const slots = Array.from({ length: 4 }, () => ({ velocity: [0, 0, 0], rotationAxis: [0, 0, 0], age: 0, lifeSpan: 0, lastUpdate: 0, spawnGeneration: 0, code: 0 }));
  const nif = { roots: [0], records: [
    node({ name: 'Root', children: [1] }),
    node({ name: 'Body', translation: [0, 0, 5], children: [2] }),
    { ...node({ name: 'Fire', flags: 0x20, children: [3], translation: [0, 2, 10] }), type: 'NiBSParticleNode' },
    { ...node({ name: 'Flame' }), type: 'NiAutoNormalParticles', data: 4, skin: -1, controller: 5 },
    { type: 'NiAutoNormalParticlesData', numVertices: 4, vertices: new Float32Array(12), normals: null, colors: null, uvSets: [], numParticles: 4, particleRadius: 1, numActive: 0, sizes: null },
    { type: 'NiParticleSystemController', next: -1, flags: 0x8, frequency: 1, phase: 0, startTime: 0, stopTime: 1e9, target: 3,
      speed: 10, speedVariation: 0, declination: 0, declinationVariation: 0, planarAngle: 0, planarAngleVariation: 0, initialNormal: [0, 0, 1], initialColor: [1, 1, 1, 1],
      initialSize: 1, emitStartTime: 0, emitStopTime: 1e9, resetParticleSystem: 0, birthRate: 0, lifetime: 1, lifetimeVariation: 0, useBirthRate: 0, spawnOnDeath: 0,
      emitterDimensions: [0, 0, 0], emitter: 2, numSpawnGenerations: 0, percentageSpawned: 0, spawnMultiplier: 0, spawnSpeedChaos: 0, spawnDirChaos: 0, numValid: 0,
      particles: slots, emitterModifier: -1, particleModifier: -1, particleCollider: -1, staticTargetBound: 0 },
  ] };
  const sk = buildSkeleton(nif);
  const b = bindCreatureModel(sk, nif);
  assert.equal(b.effects.length, 1);
  const e = { ...b.effects[0], mirrored: false, boneOffset: null, hang: null };
  assert.equal(e.attachRef, sk.byName.get('fire'), 'on the node it hangs under, not the root');
  const rest = skeletonSpaceMatrices(sk, poseSkeleton(sk, null, null, 0, {}), GRAPH_ROOT);
  const placed = effectPlacement(e, rest, attachmentTransform);
  assert.ok(near(placed.t, [0, 2, 15]), `at rest, where the file puts it (${placed.t})`);
  // Body raised two: the flame with it
  const pose = poseSkeleton(sk, null, null, 0, {});
  pose.set(sk.byName.get('body'), { ...pose.get(sk.byName.get('body')), translation: [0, 0, 7] });
  assert.ok(near(effectPlacement(e, skeletonSpaceMatrices(sk, pose, GRAPH_ROOT), attachmentTransform).t, [0, 2, 17]), 'and posed with its node');
});

test('MWNPC9a-4 the sources (creatureanimation.cpp): a bipedal creature takes xbase_anim first, then its own .kf - the corrected x-model\'s; any other its own alone; a missing file dropped', () => {
  const have = new Set([CREATURE_KF, 'meshes/xbase_anim.kf']);
  const exists = (p) => have.has(p);
  assert.deepEqual(creatureAnimSources(CREATURE_MODEL, exists), [CREATURE_KF]);
  assert.deepEqual(creatureAnimSources(CREATURE_MODEL, exists, { bipedal: true }), ['meshes/xbase_anim.kf', CREATURE_KF], `${TP_BASE_MODEL}'s first - the last pushed wins`);
  have.delete(CREATURE_KF);
  assert.deepEqual(creatureAnimSources(CREATURE_MODEL, exists), [], 'no .kf: no source (the build refuses at its clip)');
});
