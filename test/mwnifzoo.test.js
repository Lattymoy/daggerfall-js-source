import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif, deref } from '../src/formats/mwNifFile.js';

// MW-D9e: the registry grew from 27 record types to 59, because a 4.0.0.2
// record has NO size field - one unimplemented type ends the file rather
// than degrading it. That is how a NiCamera killed a first-person
// skeleton, and a particle emitter or a light would have killed the next
// one.
//
// zoo.nif is pyffi-authored (an independent NIF writer) and carries one
// of every type the slice added. extras.nif and collswitch.nif cover the
// eight types pyffi CANNOT write correctly at this version - see
// test/fixtures/mw/generate.py for which and why.
//
// THE DESYNC DETECTOR: parseNif refuses trailing bytes, and each fixture
// ends with a marker node whose translation is pinned. A reader that
// over- or under-reads ANY record here fails the whole file - so every
// assertion below rides on the record stream having stayed in step.
const load = (name) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/mw/${name}`, import.meta.url)));
const ZOO = load('zoo.nif');
const EXTRAS = load('extras.nif');
const COLLSWITCH = load('collswitch.nif');

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const only = (nif, type) => {
  const hits = nif.records.filter((r) => r.type === type);
  assert.equal(hits.length, 1, `${type} x${hits.length}`);
  return hits[0];
};

test('mwnifzoo: the marker node last says the whole record stream stayed in step', () => {
  const nif = parseNif(ZOO);
  // 58 records, and the second-to-last is the marker (the NiSequence root
  // is written after it).
  assert.equal(nif.records.length, 60);
  const marker = nif.records[58];
  assert.equal(marker.type, 'NiNode');
  assert.equal(marker.name, 'Marker');
  assert.deepEqual(Array.from(marker.translation), [11, 22, 33]);
  // Every type the slice added is present exactly once except the three
  // particle geometries' shared shapes and NiSourceTexture.
  const types = new Set(nif.records.map((r) => r.type));
  for (const t of [
    'NiSwitchNode', 'NiLODNode', 'NiSortAdjustNode', 'NiTriStrips',
    'NiTriStripsData', 'NiLines', 'NiLinesData', 'NiParticles',
    'NiParticlesData', 'NiAutoNormalParticles', 'NiAutoNormalParticlesData',
    'NiRotatingParticles', 'NiRotatingParticlesData',
    'NiParticleSystemController', 'NiBSPArrayController', 'NiGravity',
    'NiParticleBomb', 'NiParticleColorModifier', 'NiParticleGrowFade',
    'NiParticleRotation', 'NiPlanarCollider', 'NiSphericalCollider',
    'NiAlphaController', 'NiMaterialColorController', 'NiVisController',
    'NiRollController', 'NiLightColorController', 'NiFlipController',
    'NiGeomMorpherController', 'NiUVController', 'NiLookAtController',
    'NiPathController', 'NiBoneLODController', 'NiBSBoneLODController',
    'NiFloatData', 'NiPosData', 'NiColorData', 'NiUVData', 'NiVisData',
    'NiMorphData', 'NiPalette', 'NiPixelData', 'NiAmbientLight',
    'NiDirectionalLight', 'NiPointLight', 'NiSpotLight', 'NiTextureEffect',
    'NiFogProperty', 'NiVertWeightsExtraData', 'NiSequence',
  ]) {
    assert.ok(types.has(t), `zoo.nif is missing ${t}`);
  }
});

test('mwnifzoo: node kinds - the switch index, the LOD levels, the sort mode', () => {
  const nif = parseNif(ZOO);
  const sw = only(nif, 'NiSwitchNode');
  assert.equal(sw.name, 'Switch');
  assert.equal(sw.index, 0);

  // NiLODNode inherits NiSwitchNode, so its own fields come AFTER the
  // switch index - a reader that skips the index reads the centre from
  // the wrong four bytes.
  const lod = only(nif, 'NiLODNode');
  assert.equal(lod.index, 0);
  assert.deepEqual(Array.from(lod.lodCenter), [0, 0, 5]);
  assert.deepEqual(lod.lodLevels, [{ near: 0, far: 10 }, { near: 10, far: 99 }]);

  const sort = only(nif, 'NiSortAdjustNode');
  assert.equal(sort.sortingMode, 1);
  assert.equal(sort.accumulator, -1);
});

test('mwnifzoo: strips and lines - the per-strip point lists, the per-vertex flags', () => {
  const nif = parseNif(ZOO);
  const strips = only(nif, 'NiTriStrips');
  const sd = deref(nif, strips.data);
  assert.equal(sd.type, 'NiTriStripsData');
  assert.equal(sd.numVertices, 4);
  assert.equal(sd.numTriangles, 3);
  // Two strips of DIFFERENT lengths - each point list is sized by its own
  // entry, not by the first.
  assert.deepEqual(Array.from(sd.stripLengths), [4, 3]);
  assert.equal(sd.strips.length, 2);
  assert.deepEqual(Array.from(sd.strips[0]), [0, 1, 2, 3]);
  assert.deepEqual(Array.from(sd.strips[1]), [3, 2, 1]);

  const ld = deref(nif, only(nif, 'NiLines').data);
  assert.equal(ld.numVertices, 3);
  // One 32-bit bool per vertex at this version.
  assert.deepEqual(Array.from(ld.lines), [1, 1, 0]);
});

test('mwnifzoo: particle geometry - sizes on all three, rotations only on the rotating one', () => {
  const nif = parseNif(ZOO);
  const plain = only(nif, 'NiParticlesData');
  assert.equal(plain.numVertices, 2);
  assert.equal(plain.numParticles, 2);
  assert.ok(near(plain.particleRadius, 0.5));
  assert.equal(plain.numActive, 1);
  assert.deepEqual(Array.from(plain.sizes), [0.25, 0.75]);
  assert.equal(plain.rotations, undefined);

  const auto = only(nif, 'NiAutoNormalParticlesData');
  assert.ok(near(auto.particleRadius, 1.5));
  assert.equal(auto.rotations, undefined);

  // NiRotatingParticlesData is the ONLY one with the quaternion array,
  // and it is gated on its own bool - the second one has it switched off.
  const rots = nif.records.filter((r) => r.type === 'NiRotatingParticlesData');
  assert.equal(rots.length, 2);
  assert.ok(near(rots[0].particleRadius, 2.5));
  assert.deepEqual(Array.from(rots[0].rotations), [1, 0, 0, 0, 1, 1, 0, 0]);
  assert.ok(near(rots[1].particleRadius, 3.5));
  assert.equal(rots[1].rotations, null);
});

test('mwnifzoo: the particle controller, its modifier chain and both colliders', () => {
  const nif = parseNif(ZOO);
  const psys = only(nif, 'NiParticleSystemController');
  assert.ok(near(psys.speed, 1) && near(psys.speedVariation, 0.25));
  assert.ok(near(psys.initialSize, 0.75));
  assert.ok(near(psys.emitStartTime, 0.1, 1e-6) && near(psys.emitStopTime, 0.9, 1e-6));
  assert.equal(psys.resetParticleSystem, 1);
  assert.ok(near(psys.birthRate, 3) && near(psys.lifetime, 2));
  assert.ok(near(psys.lifetimeVariation, 0.5));
  assert.equal(psys.particles.length, 1);
  const p0 = psys.particles[0];
  assert.deepEqual(Array.from(p0.velocity), [2, 0, 0]);
  assert.deepEqual(Array.from(p0.rotationAxis), [0, 0, 3]);
  assert.ok(near(p0.age, 0.5) && near(p0.lifeSpan, 1.5) && near(p0.lastUpdate, 4));
  assert.equal(p0.code, 7);
  assert.equal(psys.staticTargetBound, 1);
  // The ten bytes pyffi splits as uint/uint/ushort and nif.xml + OpenMW
  // split as ushort + two floats. The port takes the second reading.
  assert.equal(psys.spawnMultiplier, 9);
  assert.ok(near(psys.spawnSpeedChaos, 0.5) && near(psys.spawnDirChaos, 1.5));

  // NiBSPArrayController adds no fields of its own - it IS this record.
  const bsp = only(nif, 'NiBSPArrayController');
  assert.ok(near(bsp.speed, 5) && near(bsp.lifetime, 6));

  // The modifier chain hangs off the controller, in order.
  const gravity = deref(nif, psys.particleModifier);
  assert.equal(gravity.type, 'NiGravity');
  assert.ok(near(gravity.decay, 0.5) && near(gravity.force, 9.8, 1e-5));
  assert.equal(gravity.fieldType, 1);
  assert.deepEqual(Array.from(gravity.position), [1, 0, 0]);
  assert.deepEqual(Array.from(gravity.direction), [0, 0, -1]);

  const bomb = deref(nif, gravity.next);
  assert.equal(bomb.type, 'NiParticleBomb');
  assert.ok(near(bomb.decay, 1) && near(bomb.duration, 2));
  assert.ok(near(bomb.deltaV, 3) && near(bomb.start, 4));
  assert.equal(bomb.decayType, 2);
  assert.deepEqual(Array.from(bomb.position), [0, 5, 0]);
  assert.deepEqual(Array.from(bomb.direction), [6, 0, 0]);

  const colour = deref(nif, bomb.next);
  assert.equal(colour.type, 'NiParticleColorModifier');
  assert.equal(deref(nif, colour.colorData).type, 'NiColorData');

  const growfade = deref(nif, colour.next);
  assert.equal(growfade.type, 'NiParticleGrowFade');
  assert.ok(near(growfade.grow, 0.1, 1e-6) && near(growfade.fade, 0.2, 1e-6));

  const prot = deref(nif, growfade.next);
  assert.equal(prot.type, 'NiParticleRotation');
  assert.equal(prot.randomInitialAxis, 1);
  assert.deepEqual(Array.from(prot.initialAxis), [0, 1, 0]);
  assert.ok(near(prot.rotationSpeed, 2.5));
  assert.equal(prot.next, -1);

  // The colliders hang off their own field, not the modifier chain.
  const planar = deref(nif, psys.particleCollider);
  assert.equal(planar.type, 'NiPlanarCollider');
  assert.ok(near(planar.bounce, 0.3, 1e-6));
  assert.ok(near(planar.height, 2) && near(planar.width, 3));
  assert.deepEqual(Array.from(planar.position), [1, 0, 0]);
  assert.deepEqual(Array.from(planar.xVector), [0, 1, 0]);
  assert.deepEqual(Array.from(planar.yVector), [0, 0, 1]);
  assert.deepEqual(Array.from(planar.plane.normal), [0, 0, 1]);
  assert.ok(near(planar.plane.constant, 4));

  // pyffi's nif.xml disagrees with nif.xml/OpenMW INSIDE this record
  // while agreeing on its width, so only the first field is pinned here -
  // the rest is pinned by the file staying in sync.
  const sphere = deref(nif, planar.next);
  assert.equal(sphere.type, 'NiSphericalCollider');
  assert.ok(near(sphere.bounce, 0.4, 1e-6));
});

test('mwnifzoo: the controller chain - every tail the base does not read', () => {
  const nif = parseNif(ZOO);
  const root = deref(nif, nif.roots[0]);
  const chain = [];
  for (let ref = root.controller; ref >= 0;) {
    const c = deref(nif, ref);
    chain.push(c.type);
    ref = c.next;
  }
  assert.deepEqual(chain, [
    'NiBoneLODController', 'NiBSBoneLODController', 'NiLookAtController',
    'NiPathController', 'NiUVController', 'NiVisController',
    'NiFlipController', 'NiAlphaController', 'NiMaterialColorController',
    'NiRollController', 'NiGeomMorpherController',
  ]);

  // THREE counts are written, and it is the SECOND word (Num LODs) that
  // sizes the array - the third (Num Node Groups) reads 3 here, so a
  // reader that picks it runs off the end of the record.
  const boneLod = only(nif, 'NiBoneLODController');
  assert.equal(boneLod.lod, 1);
  assert.equal(boneLod.numNodeGroups, 3);
  assert.equal(boneLod.nodeGroups.length, 1);
  assert.deepEqual(boneLod.nodeGroups[0], [0]);
  assert.equal(only(nif, 'NiBSBoneLODController').nodeGroups.length, 0);

  assert.equal(only(nif, 'NiLookAtController').lookAt, 0);

  const path = only(nif, 'NiPathController');
  assert.equal(path.bankDir, -3);              // signed, not unsigned
  assert.ok(near(path.maxBankAngle, 1.25) && near(path.smoothing, 2.5));
  assert.equal(path.followAxis, 2);
  assert.equal(deref(nif, path.pathData).type, 'NiPosData');
  assert.equal(deref(nif, path.percentData).type, 'NiFloatData');

  const uv = only(nif, 'NiUVController');
  assert.equal(uv.textureSet, 1);
  assert.equal(deref(nif, uv.data).type, 'NiUVData');

  const flip = only(nif, 'NiFlipController');
  assert.equal(flip.textureSlot, 4);
  assert.ok(near(flip.accumTime, 0.5) && near(flip.delta, 0.5));
  assert.equal(flip.sources.length, 2);
  assert.equal(deref(nif, flip.sources[0]).fileName, 'flip0.dds');
  assert.equal(deref(nif, flip.sources[1]).fileName, 'flip1.dds');

  // `Always Update` is ver1 exactly 4.0.0.2 - the one byte that makes
  // this the first version to carry it.
  const morpher = only(nif, 'NiGeomMorpherController');
  assert.equal(morpher.alwaysUpdate, 1);
  assert.equal(deref(nif, morpher.data).type, 'NiMorphData');

  assert.equal(deref(nif, only(nif, 'NiAlphaController').data).type, 'NiFloatData');
  assert.equal(deref(nif, only(nif, 'NiRollController').data).type, 'NiFloatData');
  assert.equal(
    deref(nif, only(nif, 'NiMaterialColorController').data).type, 'NiPosData',
  );
  assert.equal(deref(nif, only(nif, 'NiVisController').data).type, 'NiVisData');
  assert.equal(
    deref(nif, only(nif, 'NiLightColorController').data).type, 'NiPosData',
  );
});

test('mwnifzoo: the data records - key groups, the four UV groups, morph and vis', () => {
  const nif = parseNif(ZOO);
  const f = only(nif, 'NiFloatData').data;
  assert.equal(f.type, 1);
  assert.equal(f.keys.length, 1);
  assert.ok(near(f.keys[0].time, 0.5) && near(f.keys[0].value, 1.5));

  const pos = only(nif, 'NiPosData').data;
  assert.deepEqual(Array.from(pos.keys[0].value), [7, 0, 0]);

  const col = only(nif, 'NiColorData').data;
  assert.deepEqual(Array.from(col.keys[0].value), [1, 0, 0, 0.5]);

  // FOUR groups, always, even when three of them are empty.
  const uv = only(nif, 'NiUVData').groups;
  assert.equal(uv.length, 4);
  assert.equal(uv[0].keys.length, 1);
  assert.ok(near(uv[0].keys[0].time, 1) && near(uv[0].keys[0].value, 2));
  assert.deepEqual(uv.slice(1).map((g) => g.keys.length), [0, 0, 0]);

  // NiVisData is NOT a key group: no interpolation word, one byte a key.
  const vis = only(nif, 'NiVisData');
  assert.deepEqual(vis.keys, [{ time: 0, value: 1 }, { time: 1, value: 0 }]);

  // Morph writes its interpolation type even when the key count is zero,
  // which a KeyGroup does not.
  const morph = only(nif, 'NiMorphData');
  assert.equal(morph.numVertices, 2);
  assert.equal(morph.relativeTargets, 1);
  assert.equal(morph.morphs.length, 2);
  assert.equal(morph.morphs[0].keys.type, 1);
  assert.ok(near(morph.morphs[0].keys.keys[0].time, 0.75));
  assert.ok(near(morph.morphs[0].keys.keys[0].value, 0.5));
  assert.deepEqual(Array.from(morph.morphs[0].vectors), [0, 0, 0, 0, 0, 3]);
  // The SECOND morph has no keys and still writes its interpolation
  // word - read it as a KeyGroup and the vectors come out four bytes off.
  assert.equal(morph.morphs[1].keys.type, 2);
  assert.equal(morph.morphs[1].keys.keys.length, 0);
  assert.deepEqual(Array.from(morph.morphs[1].vectors), [5, 0, 0, 0, 0, 0]);
});

test('mwnifzoo: lights - the shared head, the attenuation tail, the spot tail', () => {
  const nif = parseNif(ZOO);
  const ambient = only(nif, 'NiAmbientLight');
  assert.equal(ambient.name, 'Ambient');
  // NiDynamicEffect's node list is raw uint32 pointers at this version.
  assert.deepEqual(ambient.affectedNodePointers, []);
  assert.ok(near(ambient.dimmer, 0.5));
  assert.ok(near(ambient.ambient[0], 0.1, 1e-6));
  assert.ok(near(ambient.diffuse[1], 0.2, 1e-6));
  assert.ok(near(ambient.specular[2], 0.3, 1e-6));
  assert.equal(ambient.constantAttenuation, undefined);

  assert.equal(only(nif, 'NiDirectionalLight').constantAttenuation, undefined);

  const point = only(nif, 'NiPointLight');
  assert.ok(near(point.constantAttenuation, 1));
  assert.ok(near(point.linearAttenuation, 2));
  assert.ok(near(point.quadraticAttenuation, 3));
  assert.equal(point.outerSpotAngle, undefined);

  const spot = only(nif, 'NiSpotLight');
  assert.ok(near(spot.quadraticAttenuation, 3));
  assert.ok(near(spot.outerSpotAngle, 45) && near(spot.exponent, 8));
  assert.equal(deref(nif, spot.controller).type, 'NiLightColorController');
});

test('mwnifzoo: the texture effect, the fog property and the internal texture', () => {
  const nif = parseNif(ZOO);
  const fx = only(nif, 'NiTextureEffect');
  assert.equal(fx.name, 'Effect');
  assert.deepEqual(Array.from(fx.modelProjectionMatrix), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(Array.from(fx.modelProjectionTranslation), [0, 0, 2]);
  assert.equal(fx.textureFiltering, 2);
  assert.equal(fx.textureClamping, 3);
  assert.equal(fx.textureType, 3);
  assert.equal(fx.coordinateGenerationType, 2);
  assert.equal(fx.enablePlane, 1);
  assert.deepEqual(Array.from(fx.plane.normal), [0, 1, 0]);
  assert.ok(near(fx.plane.constant, 0.25));
  // All three ver2-gated tails are still here at 4.0.0.2.
  assert.equal(fx.ps2L, 3);
  assert.equal(fx.ps2K, -4);
  assert.equal(fx.unknown, 5);

  const fog = only(nif, 'NiFogProperty');
  assert.equal(fog.name, 'Fog');
  assert.equal(fog.flags, 1);
  assert.ok(near(fog.fogDepth, 0.75));
  assert.deepEqual(Array.from(fog.fogColor), [0.5, 0.25, 0.125]);

  // NiPixelData and NiPalette only reach a file through an internal
  // NiSourceTexture, which is how they get here.
  const pixels = deref(nif, deref(nif, fx.sourceTexture).pixelData);
  assert.equal(pixels.type, 'NiPixelData');
  assert.equal(pixels.redMask, 0x000000ff);
  assert.equal(pixels.greenMask, 0x0000ff00);
  assert.equal(pixels.blueMask, 0x00ff0000);
  assert.equal(pixels.alphaMask, 0xff000000);
  assert.equal(pixels.oldFastCompare.length, 8);
  assert.equal(pixels.bytesPerPixel, 4);
  assert.deepEqual(pixels.mipmaps, [{ width: 1, height: 1, offset: 0 }]);
  assert.deepEqual(Array.from(pixels.pixels), [9, 8, 7, 6]);

  // 256 entries of RGBA, one per count.
  const palette = deref(nif, pixels.palette);
  assert.equal(palette.type, 'NiPalette');
  assert.equal(palette.hasAlpha, 1);
  assert.equal(palette.numEntries, 256);
  assert.equal(palette.palette.length, 1024);
  assert.deepEqual(Array.from(palette.palette.slice(4, 8)), [255, 0, 0, 0]);
});

test('mwnifzoo: NiSequence is a root of its own, with its controlled blocks', () => {
  const nif = parseNif(ZOO);
  assert.equal(nif.roots.length, 2);
  const seq = deref(nif, nif.roots[1]);
  assert.equal(seq.type, 'NiSequence');
  assert.equal(seq.name, 'ZooSeq');
  assert.equal(seq.accumRootName, 'Accum');
  assert.equal(seq.textKeys, -1);
  assert.deepEqual(seq.blocks, [{ targetName: 'Marker', controller: -1 }]);
});

test('mwnifzoo: NiCollisionSwitch reads as a node, and the record after it survives', () => {
  const nif = parseNif(COLLSWITCH);
  assert.deepEqual(nif.records.map((r) => r.type), [
    'NiNode', 'NiCollisionSwitch', 'NiNode',
  ]);
  const sw = nif.records[1];
  assert.equal(sw.name, 'Switcher');
  assert.deepEqual(Array.from(sw.translation), [0, 0, 1]);
  assert.equal(sw.children.length, 1);
  // The marker is the child of the switch, so a mis-sized switch payload
  // loses it.
  const marker = deref(nif, sw.children[0]);
  assert.equal(marker.name, 'Marker');
  assert.deepEqual(Array.from(marker.translation), [4, 5, 6]);
});

test('mwnifzoo: every extra-data record reads next + record size, then its own tail', () => {
  const nif = parseNif(EXTRAS);
  assert.deepEqual(nif.records.map((r) => r.type), [
    'NiNode', 'NiBinaryExtraData', 'NiBooleanExtraData', 'NiIntegerExtraData',
    'NiVectorExtraData', 'NiStringsExtraData', 'NiExtraData',
    'NiLightRadiusController', 'NiPalette', 'NiBoolData', 'NiNode',
  ]);
  const [, binary, boolean, integer, vector, strings, plain] = nif.records;

  // The chain link and the byte count are on the BASE - pyffi's nif.xml
  // omits them from these five, which is why this fixture is hand-written.
  assert.deepEqual(
    [binary.next, boolean.next, integer.next, vector.next, strings.next, plain.next],
    [2, 3, 4, 5, 6, -1],
  );
  assert.deepEqual(
    [binary.recordSize, boolean.recordSize, integer.recordSize,
      vector.recordSize, strings.recordSize, plain.recordSize],
    [7, 1, 4, 16, 23, 3],
  );

  assert.deepEqual(Array.from(binary.data), [1, 2, 3]);
  assert.equal(boolean.booleanData, 1);
  assert.equal(integer.integerData, 4242);
  assert.deepEqual(Array.from(vector.vectorData), [1, 2, 3, 4]);
  assert.deepEqual(strings.strings, ['first', 'second']);
  // The bare record spends its byte count on an opaque payload.
  assert.deepEqual(Array.from(plain.data), [7, 8, 9]);
});

test('mwnifzoo: NiLightRadiusController is the time-controller base and nothing else', () => {
  const nif = parseNif(EXTRAS);
  const ctrl = nif.records[7];
  assert.equal(ctrl.next, -1);
  assert.equal(ctrl.flags, 12);
  assert.ok(near(ctrl.frequency, 1) && near(ctrl.phase, 0.25));
  assert.ok(near(ctrl.startTime, 0.5) && near(ctrl.stopTime, 2));
  assert.equal(ctrl.target, 0);
  assert.equal(ctrl.data, undefined);       // no tail - the whole point

  // The palette's COUNT sizes its array - four entries here, which is
  // neither of the two lengths nif.xml names.
  const palette = nif.records[8];
  assert.equal(palette.numEntries, 4);
  assert.deepEqual(Array.from(palette.palette), [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]);

  // A byte-valued key group: no float value, no interpolation surprises.
  assert.deepEqual(nif.records[9].data, {
    type: 1,
    keys: [{ time: 0, value: 1 }, { time: 1.5, value: 0 }],
  });

  const marker = nif.records[10];
  assert.equal(marker.name, 'Marker');
  assert.deepEqual(Array.from(marker.translation), [7, 8, 9]);
});

test('mwnifzoo: an unimplemented type still names itself and its record index', () => {
  // The refusal is the whole reason the registry is worth growing: a
  // 4.0.0.2 record cannot be skipped, so the message has to say WHICH
  // type and WHERE. Rename one record's type in the byte stream, keeping
  // the length, and the file must refuse by that name.
  const raw = Buffer.from(COLLSWITCH);
  raw.write('NiCollisionSwitcx', raw.indexOf('NiCollisionSwitch'), 'ascii');
  assert.throws(() => parseNif(new Uint8Array(raw)), (err) => {
    assert.match(err.message, /unimplemented record type "NiCollisionSwitcx"/);
    assert.match(err.message, /\(record 1\)/);
    return true;
  });
});
