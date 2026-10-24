// CSA-B (2026-09-27) - COME SAIL AWAY'S BOATS BUILT: world/prefabNode.js (a
// Unity prefab instanced - the Transform rules the C# leans on),
// systems/comeSailAway/comeSailAwayModels.js (the vendored meshes read back, and which
// Daggerfall texture each renderer's slot wears) and systems/comeSailAway/comeSailAwayBoat.js
// (SpawnBoat, GetBoatTransforms, the variants and the helpers in the C#'s
// order). The rules are pinned on hand-built trees; the five hulls on the
// vendored prefabs, each against an expectation this file works out for
// itself from the prefab tree (the active walk, the names, the boxes) rather
// than from the builder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PrefabNode, instantiatePrefab, resolveNodePointer } from '../../../src/world/prefabNode.js';
import {
  comeSailAwayModels, decodeMeshGeometry, matrixFromUnityRows, applyRuntimeMaterials, bundleSlots, gameTextureFromName,
  rendererModel, rendererModelKey, isDfMaterial,
} from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import {
  Boat, spawnBoat, setBoatVariant, applyBoatVariant, setLights, boatAssetNeeds, helperField, billboardHelperFields, modelHelperFields,
  importCustomGameobject, worldBounds, colliderBounds, meshLocalBounds, goFlatName, goModelName, applyGameTextures,
  FIRST_HULL_MODEL_ID, TRIGGER_MODEL, LANTERN_LIGHT, NEW_GAME_OBJECT, HULL_NAMES, AUDIO_CLIPS, BED_MODEL_ID,
} from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const FILES = { prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') };
const MODELS = comeSailAwayModels(FILES);
const { prefabs, components } = FILES.prefabs;

const close = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps = 1e-5, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(close(v, b[i], eps), `${msg} [${i}] ${v} vs ${b[i]}`)); };
const SIZE = [0.8, 1.6];
const BOX = { min: [-1, 0, -2], max: [1, 1.5, 2] };
const ctxFor = (models, player = { position: [0, 0, 0], rotation: [0, 0, 0, 1] }) => ({
  models, player: () => player, billboardSize: () => SIZE, modelBounds: () => BOX,
});
/** The prefab tree's nodes, depth first, with their paths. */
const nodes = function* (n, path = n.name) { yield [n, path]; for (const c of n.children) yield* nodes(c, `${path}/${c.name}`); };
/** The C#'s walk as this file reads it: the active children only, and never into an inactive one - plus the chosen variant. */
const activeWalk = function* (n, variant, path = n.name) {
  for (const c of n.children) {
    const p = `${path}/${c.name}`;
    const on = c.active || (n.name === 'Variants' && n.children.indexOf(c) === variant);
    if (!on) continue;
    yield [c, p];
    yield* activeWalk(c, variant, p);
  }
};
const isSail = (s) => s.includes('Sail') && !s.includes('Skelly') && !s.includes('Mesh') && !s.includes('Bones') && !s.includes('Handling');

test('CSA-B: a PrefabNode keeps Unity\'s transform rules - T*R*S down the chain, active in hierarchy, GetComponentInChildren on active objects only and depth first, SetParent(p, false) against `parent = p`', () => {
  const q90y = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const root = new PrefabNode('root', { position: [1, 2, 3], rotation: q90y, scale: [2, 2, 2] });
  const kid = new PrefabNode('kid', { position: [1, 0, 0] }).setParent(root);
  // (1,0,0) in the kid is (1+1,0,0) in the root's frame, scaled 2, turned +90 about Y (x -> -z), moved (1,2,3)
  closeV(kid.position, [1, 2, 3 - 2], 1e-5, 'kid origin');
  closeV(kid.transformPoint([1, 0, 0]), [1, 2, 3 - 4], 1e-5);
  closeV(kid.inverseTransformPoint(kid.transformPoint([0.3, -0.2, 0.7])), [0.3, -0.2, 0.7], 1e-5, 'round trip');
  // active in hierarchy, and the components found only on active objects, self first, depth first
  const a = new PrefabNode('a', { components: [{ type: 'MeshCollider', m_Enabled: false, id: 'a' }] });
  const b = new PrefabNode('b', { active: false, components: [{ type: 'MeshCollider', id: 'b' }] }).setParent(a);
  const b1 = new PrefabNode('b1', { components: [{ type: 'MeshCollider', id: 'b1' }] }).setParent(b);
  const c = new PrefabNode('c', { components: [{ type: 'MeshCollider', id: 'c' }] }).setParent(a);
  assert.equal(a.getComponentInChildren('MeshCollider').id, 'a', 'self first, a switched-off collider still found (Unity checks the object, not the component)');
  a.components.length = 0;
  assert.equal(a.getComponentInChildren('MeshCollider').id, 'c', 'the inactive child and everything under it are skipped');
  assert.equal(b1.activeInHierarchy, false);
  b.setActive(true);
  assert.equal(a.getComponentInChildren('MeshCollider').id, 'b', 'depth first, in child order');
  assert.deepEqual(a.getComponentsInChildren('MeshCollider').map((x) => x.id), ['b', 'b1', 'c']);
  c.setActive(false);
  assert.deepEqual(a.getComponentsInChildren('MeshCollider').map((x) => x.id), ['b', 'b1'], 'an inactive child is passed over by the plural too');
  c.setActive(true);
  assert.equal(a.find('b/b1'), b1);
  assert.equal(b1.pathFrom(a), 'b/b1');
  // SetParent(p, false) keeps the local transform; `parent = p` keeps the world one (Transform.SetWorldRotationAndScale)
  const p = new PrefabNode('p', { position: [1, 0, 0], scale: [2, 2, 2] });
  const keep = new PrefabNode('keep', { position: [0, 0, 0] }).setParent(p);
  assert.deepEqual(keep.localScale, [1, 1, 1]);
  const world = new PrefabNode('world');
  world.setParentKeepWorld(p);
  closeV(world.localScale, [0.5, 0.5, 0.5]);
  closeV(world.localPosition, [-0.5, 0, 0]);
  closeV(world.position, [0, 0, 0]);
  closeV(world.lossyScale, [1, 1, 1]);
  assert.equal(p.getChild(p.childCount - 1), world, 'a new child goes last');
  // a turned, unevenly scaled parent: the scale re-derived off the product's diagonal
  const r = new PrefabNode('r', { rotation: q90y, scale: [1, 2, 1] });
  const w3 = new PrefabNode('w3', { scale: [3, 1, 1] });
  w3.setParentKeepWorld(r);
  closeV(w3.localScale, [3, 0.5, 1]);
  closeV(w3.lossyScale, [3, 1, 1]);
  closeV(w3.rotation, [0, 0, 0, 1], 1e-6, 'the world rotation kept');
});

test('CSA-B: a component\'s node pointer resolves in its own instance by the prefab\'s path - a renamed root still answers, and of two same-named siblings the first (Transform.Find\'s), which no pointer in the files ever needs', () => {
  const t = (name, kids = []) => ({ name, active: true, layer: 0, tag: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1], components: [], children: kids });
  const root = instantiatePrefab(t('9', [t('Bone', [t('a')]), t('Bone', [t('b')])]), []);
  root.name = 'DaggerfallMesh [ID=9] [Replacement]';
  assert.equal(resolveNodePointer(root.getChild(1), { node: '9/Bone' }), root.getChild(0));
  assert.equal(resolveNodePointer(root, { node: '9/Bone/b' }), root.getChild(1).getChild(0));
  assert.equal(resolveNodePointer(root, { node: '9/Nope' }), null);
  assert.equal(resolveNodePointer(root, { mesh: 'x' }), null);
  // and in the vendored prefabs no pointer names a path two nodes share
  const ptrs = function* (v) { if (Array.isArray(v)) { for (const x of v) yield* ptrs(x); return; } if (!v || typeof v !== 'object') return; if (typeof v.node === 'string') { yield v.node; return; } for (const x of Object.values(v)) yield* ptrs(x); };
  for (const [id, tree] of Object.entries(prefabs)) {
    const count = new Map();
    for (const [, p] of nodes(tree)) count.set(p, (count.get(p) ?? 0) + 1);
    for (const [n] of nodes(tree)) for (const i of n.components) for (const q of ptrs(components[i])) assert.equal(count.get(q), 1, `${id}: ${q}`);
  }
});

test('CSA-B: instancing a prefab copies its components - an instance\'s edits are its own and the shared table never changes', () => {
  const tree = { name: 'x', active: true, layer: 0, tag: 0, position: [0, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1], components: [0], children: [
    { name: 'y', active: false, layer: 0, tag: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [2, 2, 2], components: [0, 1], children: [] }] };
  const table = [{ type: 'BoxCollider', m_Size: { x: 1, y: 1, z: 1 } }, { type: 'MeshFilter', m_Mesh: { mesh: 'm' } }];
  const one = instantiatePrefab(tree, table), two = instantiatePrefab(tree, table);
  one.components[0].m_Size.x = 9;
  assert.equal(two.components[0].m_Size.x, 1);
  assert.equal(table[0].m_Size.x, 1);
  assert.notEqual(one.getChild(0).components[0], one.components[0], 'two nodes sharing a table row get two copies');
  assert.deepEqual([one.getChild(0).name, one.getChild(0).activeSelf, one.getChild(0).localScale], ['y', false, [2, 2, 2]]);
});

test('CSA-B: a mesh decodes to the port\'s model shape - its submeshes\' baseVertex folded into 32-bit indices, the normal\'s first three of four, uv0 as it stands - and a bind pose from Unity\'s rows to the port\'s columns', () => {
  const f32 = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0];   // four positions
  const nrm = [0, 0, -1, 7, 0, 0, -1, 7, 0, 0, -1, 7, 0, 0, -1, 7];   // four normals, a fourth lane the reader drops
  const uv = [0, 0, 1, 0, 0, 1, 1, 1];
  const idx = [0, 1, 2, 0, 1, 2];   // the second submesh's triangle is the first's shifted by baseVertex 1
  const buf = new ArrayBuffer(12 * 4 + 16 * 4 + 8 * 4 + 6 * 2 + 2);
  new Float32Array(buf, 0, 12).set(f32); new Float32Array(buf, 48, 16).set(nrm); new Float32Array(buf, 112, 8).set(uv); new Uint16Array(buf, 144, 6).set(idx);
  const entry = { vertexCount: 4, attributes: { position: { offset: 0, type: 'f32', dim: 3 }, normal: { offset: 48, type: 'f32', dim: 4 }, uv0: { offset: 112, type: 'f32', dim: 2 } },
    indices: { offset: 144, type: 'u16', count: 6 }, submeshes: [{ start: 0, count: 3, baseVertex: 0 }, { start: 3, count: 3, baseVertex: 1 }], aabb: { center: [0.5, 0.5, 0], extent: [0.5, 0.5, 0] },
    bindPoses: [[1, 0, 0, 5, 0, 1, 0, 6, 0, 0, 1, 7, 0, 0, 0, 1]] };
  const g = decodeMeshGeometry(entry, new Uint8Array(buf));
  assert.deepEqual([...g.indices], [0, 1, 2, 1, 2, 3]);
  assert.deepEqual(g.subMeshes, [{ startIndex: 0, primitiveCount: 1 }, { startIndex: 3, primitiveCount: 1 }]);
  assert.deepEqual([...g.normals], [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  assert.deepEqual([...g.uvs], uv);
  assert.ok(g.indices instanceof Uint32Array, 'the renderer draws UNSIGNED_INT');
  assert.deepEqual([...g.bindPoses[0]].slice(12, 15), [5, 6, 7], 'the translation lands in the fourth column');
  assert.deepEqual([...matrixFromUnityRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])], [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15, 4, 8, 12, 16]);
  // the vendored hull streamed from the .resS reads whole, every index inside its vertices
  const carrack = MODELS.geometry('Carrack');
  assert.equal(carrack.subMeshes.length, 17);
  assert.ok([...carrack.indices].every((i) => i < carrack.vertexCount));
  assert.ok(MODELS.geometry('Carrack') === carrack, 'decoded once');   // by ===: a failing diff of a mesh's arrays never ends
  assert.equal(MODELS.geometry('no such mesh'), null);
});

test('CSA-B: which Daggerfall texture a slot wears - RuntimeMaterials in the component\'s order and then the next one\'s, ApplyGameTextures\' AAA_RRR child names, and Unity\'s draw rule when the materials and submeshes do not pair', () => {
  // the carrack's third mast carries two RuntimeMaterials: the second's 067_8 and 000_76 are what it wears
  const mast = [...nodes(prefabs[112414])].find(([n]) => n.name === 'CarrackMast3')[0];
  const inst = instantiatePrefab(mast, components);
  assert.equal(inst.getComponents('MonoBehaviour').length, 2);
  applyRuntimeMaterials(inst);
  assert.deepEqual(inst.getComponent('MeshRenderer').materials, [{ archive: 67, record: 8 }, { archive: 0, record: 76 }]);
  assert.equal(applyRuntimeMaterials(inst), 0, 'applied once (hasAppliedMaterials)');
  // an entry past the renderer's slots stops that component, and the next one still runs
  const odd = new PrefabNode('odd', { components: [
    { type: 'MeshRenderer', m_Materials: [{ material: 'a' }, null] },
    { type: 'MonoBehaviour', m_Script: { script: 'RuntimeMaterials' }, Materials: [{ Index: 5, Archive: 1, Record: 1 }, { Index: 0, Archive: 2, Record: 2 }] },
    { type: 'MonoBehaviour', m_Script: { script: 'RuntimeMaterials' }, Materials: [{ Index: 1, Archive: 3, Record: 3 }] },
  ] });
  applyRuntimeMaterials(odd);
  assert.deepEqual(odd.getComponent('MeshRenderer').materials, [{ bundle: 'a' }, { archive: 3, record: 3 }]);
  // CSA-J (the audit): and the C# writes into a COPY assigned past its loop - a good entry before the bad one lands nothing either
  const partial = new PrefabNode('partial', { components: [
    { type: 'MeshRenderer', m_Materials: [{ material: 'a' }, null] },
    { type: 'MonoBehaviour', m_Script: { script: 'RuntimeMaterials' }, Materials: [{ Index: 0, Archive: 4, Record: 4 }, { Index: 9, Archive: 5, Record: 5 }] },
  ] });
  assert.equal(applyRuntimeMaterials(partial), 0);
  assert.deepEqual(partial.getComponent('MeshRenderer').materials, [{ bundle: 'a' }, null], 'the copy never assigned');
  assert.equal(partial.getComponent('MonoBehaviour').hasAppliedMaterials, 1, 'and its finally marks it applied');
  // ApplyGameTextures reads Convert.ToInt32 either side of the first '_'
  assert.deepEqual(gameTextureFromName('050_007'), { archive: 50, record: 7 });
  assert.deepEqual(gameTextureFromName('050_007 '), { archive: 50, record: 7 }, 'the trailing space four of the skiff\'s sails carry');
  assert.equal(gameTextureFromName('50x_7'), null);
  assert.equal(gameTextureFromName('0507'), null);
  // Unity's pairing: fewer materials draw the first submeshes only, more draw the last submesh again, a slot with no Daggerfall material draws nothing
  const g = { positions: new Float32Array(9), normals: new Float32Array(9), uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]),
    subMeshes: [0, 3, 6, 9].map((s) => ({ startIndex: s, primitiveCount: 1 })) };
  assert.deepEqual(rendererModel(g, [{ archive: 1, record: 0 }, { archive: 1, record: 1 }]).subMeshes.map((s) => s.startIndex), [0, 3]);
  const five = [0, 1, 2, 3, 4].map((r) => ({ archive: 2, record: r }));
  assert.deepEqual(rendererModel(g, five).subMeshes.map((s) => [s.startIndex, s.textureRecord]), [[0, 0], [3, 1], [6, 2], [9, 3], [9, 4]]);
  assert.deepEqual(rendererModel(g, [{ bundle: 'WaterMaskMaterial' }, { archive: 7, record: 2 }]).subMeshes.map((s) => s.startIndex), [3]);
  assert.equal(rendererModel(g, [{ bundle: 'Default-Material' }, null]), null);
  assert.equal(rendererModelKey('m', [{ archive: 7, record: 2 }, null]), 'csa:m|7_2,-');
  // the galleon's anchor is the one renderer in the files that does not pair: four submeshes, two materials
  const anchor = [...nodes(prefabs[112412])].find(([n]) => n.name === 'GalleonAnchor')[0];
  assert.deepEqual([MODELS.meshes.GalleonAnchor.submeshes.length, components[anchor.components.find((i) => components[i].type === 'MeshRenderer')].m_Materials.length], [4, 2]);
});

test('CSA-B: every renderer a built hull shows wears Daggerfall textures but the water masks (CSA-F) - the flag\'s cube, the dock planks and the root\'s helper plane that keep a bundle material are all hidden, and stay hidden', () => {
  const kept = [];
  for (let hull = 0; hull < 5; hull++) {
    const boat = spawnBoat(new Boat(hull, hull === 1 ? 0 : 0), ctxFor(MODELS));
    for (const n of boat.GameObject.walk()) {
      if (!n.activeInHierarchy) continue;
      for (const r of n.getComponents('MeshRenderer')) {
        if (r.m_Enabled === false || r.classicModel != null || r.materials?.[0]?.billboard) continue;
        const slots = r.materials ?? bundleSlots(r);
        if (!slots.every(isDfMaterial)) kept.push(`${hull}:${n.name}:${slots.map((s) => s?.bundle ?? `${s?.archive}_${s?.record}`).join(',')}`);
      }
    }
  }
  assert.deepEqual(kept, ['0:DingyWaterCull:WaterMaskMaterial', '1:OldSkiffHullWaterCull:WaterMaskMaterial']);
});

/** What SpawnBoat must find in a hull, worked out from the prefab tree alone. */
function expectedHull(hull, variant) {
  const root = prefabs[FIRST_HULL_MODEL_ID + hull];
  const walked = [...activeWalk(root, variant)];
  const names = walked.map(([n]) => n.name);
  const mods = Object.fromEntries(walked.filter(([n]) => ['HandlingOar', 'HandlingSail', 'HandlingRudder', 'HandlingAnimation', 'Audio', 'Cargo'].includes(n.name)).map(([n]) => [n.name, n]));
  return {
    sails: names.filter(isSail),
    // the C#'s two chains: Small, else Large; Square, else Lateen, else Gaff, else Stay
    small: names.filter((s) => isSail(s) && s.includes('Small')),
    large: names.filter((s) => isSail(s) && !s.includes('Small') && s.includes('Large')),
    square: names.filter((s) => isSail(s) && s.includes('Square')),
    lateen: names.filter((s) => isSail(s) && !s.includes('Square') && s.includes('Lateen')),
    gaff: names.filter((s) => isSail(s) && !s.includes('Square') && !s.includes('Lateen') && s.includes('Gaff')),
    stay: names.filter((s) => isSail(s) && !s.includes('Square') && !s.includes('Lateen') && !s.includes('Gaff') && s.includes('Stay')),
    booms: names.filter((s) => s.includes('Boom')).length,
    lanterns: names.filter((s) => s.startsWith('BillboardHelper-210')).length,
    board: names.filter((s) => s === 'BoardTrigger' || s === 'DoorTrigger').length,
    oars: names.filter((s) => s === 'OarEffect').length,
    rudderEffects: names.filter((s) => s === 'RudderEffect').length,
    crewed: names.includes('Crewed'), packable: names.includes('Packable'),
    has: (s) => names.includes(s),
    mods,
    meshObject: walked.find(([n]) => n.components.some((i) => components[i].type === 'MeshCollider'))[0],
  };
}

test('CSA-B: SpawnBoat builds each of the five hulls as GetBoatTransforms walks it - the modifiers off the Handling nodes, the sails, booms, lanterns, triggers and effects of the active tree only, the five nodes off the hull collider\'s box, the two loops\' distances', () => {
  for (let hull = 0; hull < 5; hull++) {
    const variant = hull === 1 ? 3 : 0;
    const want = expectedHull(hull, variant);
    const boat = spawnBoat(new Boat(hull, variant), ctxFor(MODELS));
    const label = HULL_NAMES[hull];
    const replacement = boat.GameObject.getChild(0);
    assert.equal(replacement.name, `DaggerfallMesh [ID=${FIRST_HULL_MODEL_ID + hull}] [Replacement]`, label);
    assert.deepEqual([replacement.localPosition, replacement.localRotation], [[0, 0, 0], [0, 0, 0, 1]]);
    assert.equal(boat.MeshObject.name, want.meshObject.name, `${label}: the first active mesh collider, depth first`);
    assert.deepEqual(boat.Sails.map((s) => s.name), want.sails, `${label}: sails`);
    for (const [k, list] of [['small', 'SailsSmall'], ['large', 'SailsLarge'], ['square', 'SailsSquare'], ['lateen', 'SailsLateen'], ['gaff', 'SailsGaff'], ['stay', 'SailsStay']]) {
      assert.deepEqual(boat[list].map((s) => s.name), want[k], `${label}: ${list}`);
    }
    assert.equal(boat.Booms.length, want.booms, `${label}: booms`);
    assert.equal(boat.Lights.length, want.lanterns, `${label}: a light per lantern`);
    assert.equal(boat.BoardTriggers.length, want.board, `${label}: the board triggers and the doors' (the C# files both under BoardTriggers)`);
    assert.equal(boat.DoorTriggers.length, 0);
    assert.equal(boat.OarParticles.length, want.oars, `${label}: oars`);
    assert.equal(boat.RudderEmitters.length, want.rudderEffects);
    // SHIP-PACK (PIN MOVED): a crewed hull packs as the small boats do - the prefab's own `Packable` node, or its `Crewed`
    assert.deepEqual([boat.crewed, boat.packable], [want.crewed, want.packable || want.crewed], `${label}: crewed / packable`);
    for (const [k, t] of [['DriveTrigger', 'DriveTrigger'], ['CargoTrigger', 'CargoTrigger'], ['VariantTrigger', 'VariantTrigger'], ['StatusTrigger', 'StatusTrigger'], ['PositionTrigger', 'PositionTrigger'], ['BedObject', 'BedObject'], ['FireObject', 'FireObject'], ['FlagObject', 'FlagObject']]) {
      assert.equal(!!boat[k], want.has(t), `${label}: ${k}`);
    }
    const m = want.mods;
    assert.deepEqual([boat.modifierMoveSpeedOar, boat.modifierMoveAccelerationOar, boat.modifierTurnSpeedOar, boat.modifierTurnAccelerationOar],
      [m.HandlingOar.position[0], m.HandlingOar.position[1], m.HandlingOar.scale[0], m.HandlingOar.scale[1]], `${label}: oar handling`);
    assert.deepEqual([boat.modifierMoveSpeedSail, boat.modifierMoveAccelerationSail, boat.modifierTurnSpeedSail, boat.modifierTurnAccelerationSail],
      [m.HandlingSail.position[0], m.HandlingSail.position[1], m.HandlingSail.scale[0], m.HandlingSail.scale[1]], `${label}: sail handling`);
    assert.deepEqual([boat.modifierRudder, boat.modifierAnimation], [m.HandlingRudder.position[0], m.HandlingAnimation.position[0]]);
    assert.deepEqual([boat.modifierAudioVolume, boat.modifierAudioRange, boat.modifierAudioSpatialBlend], [1, m.Audio.position[1], m.Audio.position[2]]);
    assert.equal(boat.modifierCargoThreshold, m.Cargo ? m.Cargo.position[0] : 0, `${label}: a hull without a Cargo node keeps 0`);
    // the nodes: the hull collider's box in the boat's frame (the hull at the origin, unturned, unscaled)
    const aabb = MODELS.meshes[components[want.meshObject.components.find((i) => components[i].type === 'MeshCollider')].m_Mesh.mesh].aabb;
    let off = [0, 0, 0];
    for (let n = boat.MeshObject; n !== boat.GameObject; n = n.parent) off = off.map((v, d) => v + n.localPosition[d]);
    const cx = aabb.center.map((v, d) => v + off[d]);
    const e = aabb.extent;
    const nodesAt = boat.Nodes.map((n) => n.localPosition);
    closeV(nodesAt[0], cx, 1e-4, `${label}: Center`);
    closeV(nodesAt[1], [cx[0], cx[1], cx[2] + e[2]], 1e-4, `${label}: Fore`);
    closeV(nodesAt[2], [cx[0], cx[1], cx[2] - e[2]], 1e-4, `${label}: Aft`);
    closeV(nodesAt[3], [cx[0] + e[0], cx[1], cx[2]], 1e-4, `${label}: Starboard`);
    closeV(nodesAt[4], [cx[0] - e[0], cx[1], cx[2]], 1e-4, `${label}: Port`);
    assert.deepEqual(boat.Nodes.map((n) => n.name), ['Center', 'Fore', 'Aft', 'Starboard', 'Port']);
    assert.deepEqual(boat.NodeTileMapIndices, [-1, -1, -1, -1, -1]);
    assert.deepEqual([boat.AudioSourceSlow.clip, boat.AudioSourceFast.clip], [AUDIO_CLIPS[0], AUDIO_CLIPS[1]]);
    assert.equal(boat.AudioSourceSlow.minDistance, Math.fround(e[2] * 0.5));
    assert.equal(boat.AudioSourceFast.maxDistance, Math.fround(Math.fround(e[2] * 0.5) * 2));
    assert.deepEqual([boat.Cargo.ContainerImage, boat.Cargo.playerOwned], [6, true]);
    assert.deepEqual([boat.IdleObject.activeSelf, boat.ActiveObject.activeSelf], [true, false]);
    assert.deepEqual(boat.GameObject.children.map((c) => c.name).slice(1), ['Center', 'Fore', 'Aft', 'Starboard', 'Port', 'BoatSFXSlow', 'BoatSFXFast', 'BoatSFXOneShot', 'BoatCargo']);
    // the sails are asked to stow: CrossFade("Stowed", 2) and SetBool("Stowed", true) - CSA-E: of each sail's own
    // Animator, which takes the CrossFade at its next update
    for (const s of boat.Sails) {
      const an = s.getComponent('Animator')?.animator;
      if (!an) continue;
      assert.deepEqual([an.pending?.state.name, an.pending?.duration, an.GetBool('Stowed')], ['Stowed', 2, true], `${label}: ${s.name}`);
    }
    // the lights start off (LightOn false) - a boat without lanterns never records it
    for (const l of boat.Lights) assert.equal(l.enabled, false);
  }
});

test('CSA-B: the variants - the skiff shows the one it was bought as, and SetBoatVariant swaps the sails and the flag without a second trigger, oar or light', () => {
  const ctx = ctxFor(MODELS);
  const boat = spawnBoat(new Boat(1, 3), ctx);
  const variants = boat.VariantObject;
  assert.equal(boat.GetVariantCount, 7);
  assert.deepEqual(variants.children.map((v) => v.activeSelf), [false, false, false, true, false, false, false]);
  assert.deepEqual(boat.Sails.map((s) => s.name), ['SkiffSmallSquareSail', 'SkiffLargeLateenSail']);
  assert.equal(boat.FlagObject.parent, variants.getChild(3));
  const before = { board: boat.BoardTriggers.length, lights: boat.Lights.length, drive: boat.DriveTrigger, rudder: boat.RudderEmitters.length };
  setBoatVariant(boat, 5, ctx);
  assert.deepEqual(variants.children.map((v) => v.activeSelf), [false, false, false, false, false, true, false]);
  assert.deepEqual(boat.Sails.map((s) => s.name), expectedHull(1, 5).sails);
  assert.equal(boat.FlagObject.parent, variants.getChild(5), 'ReinitializeBoat drops the flag and the walk finds the new one');
  assert.deepEqual({ board: boat.BoardTriggers.length, lights: boat.Lights.length, drive: boat.DriveTrigger, rudder: boat.RudderEmitters.length }, before);
  // each newly walked sail got its textures and its baked holder once; the old variant's keep theirs
  for (const v of [3, 5]) {
    for (const n of variants.getChild(v).walk()) {
      if (!n.getComponent('SkinnedMeshRenderer')) continue;
      assert.equal(n.getComponents('ApplyGameTextures').length, 1, `variant ${v}: ${n.name}`);
      assert.equal(n.children.filter((c) => c.name === NEW_GAME_OBJECT).length, 1);
    }
  }
  setBoatVariant(boat, 5, ctx);
  for (const n of variants.getChild(5).walk()) if (n.getComponent('SkinnedMeshRenderer')) assert.equal(n.getComponents('ApplyGameTextures').length, 1, 'never twice');
  assert.throws(() => spawnBoat(new Boat(1, 7), ctx), /out of bounds/, 'GetChild(variant) past the seven throws, as the C# does');
  const plain = spawnBoat(new Boat(0), ctx);
  applyBoatVariant(plain, ctx);   // no Variants: nothing happens
  assert.equal(plain.VariantObject, null);
});

test('CSA-B: the helpers - a billboard stood on or hung from its helper by half its height, a lantern\'s light with the mod\'s settings, the fire at a half scale, the bed, a classic model centred on its helper by its renderer\'s box - and SetLights', () => {
  const ctx = ctxFor(MODELS);
  const boat = spawnBoat(new Boat(3), ctx);   // the trireme: crew, lanterns, a model helper, a bed and a fire
  const helpers = [...boat.GameObject.walk()].filter((n) => n.name.includes('BillboardHelper') && n.activeInHierarchy);
  assert.ok(helpers.length > 20);
  for (const h of helpers) {
    const { archive, record, alignment } = billboardHelperFields(h.name);
    const flat = h.children.find((c) => c.name === goFlatName(archive, record));
    assert.ok(flat, h.name);
    const dy = alignment === 1 ? SIZE[1] / 2 : alignment === 2 ? -SIZE[1] / 2 : 0;
    closeV(flat.localPosition, [0, dy, 0], 1e-6, h.name);
    assert.deepEqual(flat.localScale, [1, 1, 1]);
    const light = flat.children.find((c) => c.getComponent('Light'));
    assert.equal(!!light, archive === 210, `${h.name}: a light for archive 210 only`);
    if (light) {
      const l = light.getComponent('Light');
      assert.deepEqual([l.color, l.intensity, l.range, l.lightType, l.shadows, l.shadowStrength, l.spotAngle], [[1, 147 / 255, 41 / 255, 1], 1, 20, 'Point', 'Hard', 1, 140]);
      closeV(light.position, flat.position, 1e-5);
      assert.ok(light.getComponent('DaggerfallLight') && light.getComponent('DungeonLightHandler'));
    }
  }
  assert.equal(goFlatName(210, 27), 'DaggerfallBillboard [TEXTURE.210, Index=27]');
  // the fire: 210/1 at half scale, a quarter of its height up, not drawn
  const fire = boat.FireObject;
  assert.deepEqual([fire.name, fire.localScale, fire.getComponent('MeshRenderer').m_Enabled], [goFlatName(210, 1), [0.5, 0.5, 0.5], false]);
  closeV(fire.localPosition, [0, SIZE[1] / 4, 0]);
  // the bed: model 41000 at its node, drawn, a plain collider (its node's name has no '0')
  assert.deepEqual([boat.BedObject.name, boat.BedObject.localPosition, boat.BedObject.getComponent('MeshRenderer').m_Enabled, boat.BedObject.getComponent('MeshCollider').m_Convex],
    [goModelName(BED_MODEL_ID), [0, 0, 0], true, false]);
  // the model helper: 41123's box centred on the helper, then up by its half height
  const mh = [...boat.GameObject.walk()].find((n) => n.name.startsWith('ModelHelper-'));
  const model = mh.children.find((c) => c.name === goModelName(41123));
  const wb = worldBounds(model, { center: [0, 0.75, 0], extent: [1, 0.75, 2] });
  closeV(wb.center, [mh.position[0], mh.position[1] + 0.75, mh.position[2]], 1e-4);
  assert.deepEqual(modelHelperFields(mh.name), { modelId: 41123, alignment: 1 });
  // SetLights: each light and its two behaviours, and the lantern flat's emission
  setLights(boat, true);
  assert.equal(boat.LightOn, true);
  for (const l of boat.Lights) {
    assert.deepEqual([l.enabled, l.node.getComponent('DaggerfallLight').enabled, l.node.getComponent('DungeonLightHandler').enabled], [true, true, true]);
    assert.deepEqual(l.node.parent.getComponent('MeshRenderer').emissionColor, [1, 1, 1, 1]);
  }
  setLights(boat, false);
  assert.ok(boat.Lights.every((l) => !l.enabled && l.node.parent.getComponent('MeshRenderer').emissionColor[0] === 0));
  const carrack = spawnBoat(new Boat(4), ctx);
  carrack.LightOn = 'untouched';
  setLights(carrack, true);
  assert.equal(carrack.LightOn, 'untouched', 'no lanterns: SetLights returns before it records the switch');
  // the helper names parse as Substring + Convert.ToInt32 and throw where those would
  assert.deepEqual(billboardHelperFields('BillboardHelper-182_025:1'), { archive: 182, record: 25, alignment: 1 });
  assert.throws(() => helperField('BillboardHelper-18', '-', 3), /ArgumentOutOfRange/);
  assert.throws(() => helperField('BillboardHelper-1x2_025:1', '-', 3), /FormatException/);
});

test('CSA-B: the trigger boxes - under the nodes that name them, the door\'s box sized to the door, the board box at a unit scale under a scaled node, and the variant, status and position boxes keeping the player\'s turn relative to the boat (kept bug for bug)', () => {
  const yaw45 = [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)];
  const ctx = ctxFor(MODELS, { position: [100, 5, -40], rotation: yaw45 });
  const galleon = spawnBoat(new Boat(2), ctx);
  const nameOf = (id) => `DaggerfallMesh [ID=${id}] [Replacement]`;
  assert.equal(galleon.DriveTrigger.name, nameOf(TRIGGER_MODEL.drive));
  assert.equal(galleon.DriveTrigger.parent.name, 'DriveTrigger');
  assert.deepEqual([galleon.DriveTrigger.localPosition, galleon.DriveTrigger.localRotation], [[0, 0, 0], [0, 0, 0, 1]]);
  for (const t of [galleon.VariantTrigger, galleon.StatusTrigger, galleon.PositionTrigger]) {
    closeV(t.localRotation, yaw45, 1e-6, `${t.parent.name}: the player's turn survives`);
    assert.deepEqual([t.localPosition, t.localScale], [[0, 0, 0], [1, 1, 1]]);
  }
  const board = galleon.BoardTriggers.filter((t) => t.name === nameOf(TRIGGER_MODEL.board));
  assert.equal(board.length, 2);
  for (const t of board) {
    assert.deepEqual(t.localScale, [1, 1, 1]);
    closeV(t.lossyScale, t.parent.lossyScale, 1e-6, 'a unit box scaled by its node');
  }
  // the door: 112403 under the door's own node (the DoorTrigger's parent), its box the door collider's bounds + 0.01
  const door = galleon.BoardTriggers.find((t) => t.name === nameOf(TRIGGER_MODEL.door));
  assert.equal(door.parent.name, 'GalleonInteriorEntrance');
  const col = door.parent.getComponent('MeshCollider');
  const b = colliderBounds(ctx, door.parent, col);
  const box = door.getComponent('BoxCollider');
  closeV([box.m_Center.x, box.m_Center.y, box.m_Center.z], door.inverseTransformPoint(b.center), 1e-5);
  closeV([box.m_Size.x, box.m_Size.y, box.m_Size.z], b.size.map((v) => v + 0.01), 1e-5);
  const aabb = meshLocalBounds(ctx, col.m_Mesh);
  closeV(b.size, aabb.extent.map((v) => v * 2), 1e-4, 'an unturned, unscaled door: its mesh\'s own box');
});

test('CSA-B: the walk reads the child count afresh - a trigger imported under the node being walked is walked too - and ImportCustomGameobject answers null for a prefab the mod does not carry', () => {
  const T = (name, kids = [], comps = [], extra = {}) => ({ name, active: true, layer: 0, tag: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1], components: comps, children: kids, ...extra });
  const table = [
    { type: 'MeshFilter', m_Mesh: { mesh: 'hull' } }, { type: 'MeshCollider', m_Mesh: { mesh: 'hull' } },
    { type: 'BoxCollider', m_Size: { x: 1, y: 1, z: 1 }, m_Center: { x: 0, y: 0, z: 0 } },
  ];
  const hull = T('112410', [T('Deck', [T('DoorTrigger'), T('IdleObject'), T('ActiveObject'),
    T('Audio', [], [], { position: [7, 2, 0.5] }),   // the volume is one whatever the node says; the range and blend its y and z
    T('HandlingOarSailRudder', [], [], { position: [3, 4, 0], scale: [5, 6, 1] }),   // the C#'s ifs do not exclude each other
  ], [0, 1])]);
  // the door's trigger prefab carries a child the walk would count - proof it is walked
  const doorPrefab = T('112403', [T('Packable')], [2]);
  const files = { prefabs: { prefabs: { 112410: hull, 112403: doorPrefab }, components: table }, meshes: { hull: { aabb: { center: [0, 1, 0], extent: [2, 1, 4] }, submeshes: [] } }, bin: new Uint8Array(0), materials: {}, animation: {} };
  const models = comeSailAwayModels(files);
  const ctx = ctxFor(models);
  const boat = spawnBoat(new Boat(0), ctx);
  assert.equal(boat.packable, true, 'the imported door trigger, appended to the node being walked, was walked');
  assert.deepEqual([boat.modifierAudioVolume, boat.modifierAudioRange, boat.modifierAudioSpatialBlend], [1, 2, 0.5]);
  assert.deepEqual([boat.modifierMoveSpeedOar, boat.modifierMoveAccelerationOar, boat.modifierTurnSpeedOar, boat.modifierTurnAccelerationOar], [3, 4, 5, 6]);
  assert.deepEqual([boat.modifierMoveSpeedSail, boat.modifierMoveAccelerationSail, boat.modifierTurnSpeedSail, boat.modifierTurnAccelerationSail], [3, 4, 5, 6]);
  assert.equal(boat.modifierRudder, 3);
  assert.equal(boat.BoardTriggers.length, 1);
  closeV(boat.Nodes[1].localPosition, [0, 1, 4]);
  assert.ok(importCustomGameobject(ctx, 112499, boat.GameObject) === null, 'no prefab of that id');
  assert.throws(() => spawnBoat(new Boat(3), ctx), /no hull prefab/);
});

test('CSA-B: ApplyGameTextures and FixDeformations on every walked sail - the slots off the AAA_RRR children, the skinned renderer switched off, the baked mesh\'s holder last under it at one over its lossy scale', () => {
  const ctx = ctxFor(MODELS);
  let sails = 0, want = 0;
  for (let hull = 0; hull < 5; hull++) {
    const variant = hull === 1 ? 4 : 0;
    want += [...activeWalk(prefabs[FIRST_HULL_MODEL_ID + hull], variant)].filter(([n]) => n.components.some((i) => components[i].type === 'SkinnedMeshRenderer')).length;
    const boat = spawnBoat(new Boat(hull, variant), ctx);
    for (const n of boat.GameObject.walk()) {
      const smr = n.getComponent('SkinnedMeshRenderer');
      if (!smr || !n.activeInHierarchy) continue;
      sails++;
      assert.equal(n.getComponent('ApplyGameTextures').hasAppliedMaterials, true);
      const names = n.children.filter((c) => c.name !== NEW_GAME_OBJECT).map((c) => c.name);
      assert.deepEqual(smr.materials, names.map(gameTextureFromName), `${n.name}: slot i is child i's name`);
      assert.equal(smr.m_Enabled, false, 'FixDeformations switched the skinned renderer off');
      const holder = n.getChild(n.childCount - 1);
      assert.equal(holder.name, NEW_GAME_OBJECT);
      const fix = holder.getComponent('FixDeformations');
      assert.deepEqual([fix.interval, fix.timer, fix.skinnedMeshRenderer], [0.1, 0, smr]);
      assert.deepEqual(holder.getComponent('MeshRenderer').materials, smr.materials);
      closeV(holder.lossyScale, [1, 1, 1], 1e-5, `${n.name}: the holder stands at a world scale of one`);
      closeV(holder.localScale, n.lossyScale.map((s) => 1 / s), 1e-5);
    }
  }
  assert.equal(sails, want, 'every skinned renderer of the active tree, and only those');
  assert.ok(sails >= 10);
  // the galleon's second lateen sail is the one under a scaled node (2.83): its holder's local scale is one over that
  const galleon = spawnBoat(new Boat(2), ctx);
  const l2 = [...galleon.GameObject.walk()].find((n) => n.name === 'GalleonLateen2SailMesh');
  assert.ok(l2.lossyScale[0] > 2.8 && l2.lossyScale[0] < 2.9);
  // a skinned node with fewer texture children than slots throws in the C#'s Awake: the slots stay as they were
  const odd = new PrefabNode('odd', { components: [{ type: 'SkinnedMeshRenderer', m_Materials: [{ material: 'a' }, { material: 'b' }] }] });
  new PrefabNode('050_007').setParent(odd);
  const script = { type: 'ApplyGameTextures', hasAppliedMaterials: false };
  assert.equal(applyGameTextures(script, odd), false);
  assert.equal(script.hasAppliedMaterials, false);
  assert.equal(odd.getComponent('SkinnedMeshRenderer').materials, undefined);
});

test('CSA-B: boatAssetNeeds names what a hull reads out of the player\'s ARENA2 before it is built - its helpers\' flats and models, the bed and the fire', () => {
  const ctx = ctxFor(MODELS);
  const tri = boatAssetNeeds(ctx, 3);
  assert.ok(tri.models.includes(41123) && tri.models.includes(41000));
  assert.ok(tri.flats.some(([a, r]) => a === 210 && r === 27) && tri.flats.some(([a, r]) => a === 210 && r === 1));
  const all = new Set();
  for (let h = 0; h < 5; h++) for (const [a] of boatAssetNeeds(ctx, h).flats) all.add(a);
  assert.deepEqual([...all].sort((x, y) => x - y), [182, 183, 210, 253, 346]);
  assert.deepEqual(boatAssetNeeds(ctx, 9), { flats: [], models: [] });
});
