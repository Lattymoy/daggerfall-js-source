// WS1 (2026-09-17, Mac: "Can we implement this for the morrowind model" -
// Greatness7's Weapon Sheathing 1.6): the bone addon joins the skeleton,
// the scabbard's subtrees, the holster's decisions, the quiver's count,
// the hide law - and the wiring, by source. OWN-WORK4 (2026-10-31): the
// mod's files are retired; the addon and the scabbards are our own
// (systems/ownSheathing.js), on our own biped (tools/ownBiped.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, injectSkeletonNodes, hasBoneMarker, skeletonSpaceMatrices, poseSkeleton, INJECTED_REF_BASE } from '../../../src/formats/morrowind/mwSkin.js';
import { flattenNif } from '../../../src/formats/morrowind/mwNifMesh.js';
import { bindPart, findNodeByName } from '../../../src/formats/morrowind/mwCharacter.js';
import { assembleFirstPersonArm, MW_WEAPON_TYPE, TP_BASE_MODEL } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { sampleTrack } from '../../../src/formats/morrowind/mwAnim.js';
import { writeNifBytes } from '../../../src/formats/morrowind/mwNifWrite.js';
import {
  SHEATHING_BONE, SHEATH_WEAPON_NODE, SHEATH_AMMO_NODE, HOLSTER_SLOTS, sheathedMeshPath, animationsDirOf, boneSourcesFor, holsters,
  holsterPartPaths, resolveHolsterParts, holsterHidden, makeVendoredArchive, vendoredDataPath,
} from '../../../src/systems/weaponSheathing.js';
import {
  BELT, SHEATH_POINTS, SHEATH_NODE, SHEATHING_ADDON_PATH, QUIVER_SLOTS, SCABBARD_KIND, sheathingAddonBytes, sheathingAddonRecords, ownScabbardBytes, weaponExtent,
} from '../../../src/systems/ownSheathing.js';
import { weaponSheathingArchive, WEAPON_SHEATHING_URLS } from '../../../src/systems/weaponSheathingAssets.js';
import { mwLoosePath } from '../../../src/scenes/dataSource.js';
import { RETAIL_SKELETON_BYTES } from '../../fixtures/mw/retailRig.mjs';
import { weaponMesh } from '../../fixtures/mw/ownGear.mjs';
import { HIP_LANTERN_HOOK } from '../../../src/combat/fpArm.js';

const root = new URL('../../..', import.meta.url);
const rd = (p) => readFileSync(new URL(p, root), 'utf8');
const ADDON = sheathingAddonBytes();
const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

const SWORD = weaponMesh();
const DAGGER = weaponMesh({ grip: 4, guard: 2, blade: 12 });
const BOW = weaponMesh({ grip: 40, guard: 1, blade: 40, width: 1, thick: 1 });
const LONGSWORD = ownScabbardBytes({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponBytes: SWORD });
const LONGBOW = ownScabbardBytes({ mwType: MW_WEAPON_TYPE.MarksmanBow, weaponBytes: BOW });
/** A stand-in `_sh` file of the mod's shape, the player's own: its weapon node CARRIES geometry (a blade under it). */
const PLAYERS_SH = writeNifBytes([
  { type: 'NiNode', name: 'w_sh', children: [1, 4] },
  { type: 'NiNode', name: SHEATH_NODE, children: [2] },
  { type: 'NiTriShape', name: '', data: 3 },
  { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
  { type: 'NiNode', name: SHEATH_WEAPON_NODE, translation: [0, 1, 2], children: [5, 7] },
  { type: 'NiTriShape', name: '', data: 6 },
  { type: 'NiTriShapeData', positions: [0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 0], normals: null, uvs: null, indices: [0, 1, 2, 1, 3, 2] },
  { type: 'NiTriShape', name: '', data: 8 },
  { type: 'NiTriShapeData', positions: [0, 0, 1, 3, 0, 1, 0, 3, 1], normals: null, uvs: null, indices: [0, 1, 2] },
]);

/** Our addon's eleven MARKED nodes ("BONE" NiStringExtraData), with the game's bone each hangs under. */
const ADDON_BONES = Object.freeze({
  'Bip01 ShortBladeOneHand': 'Bip01 Pelvis', 'Bip01 LongBladeOneHand': 'Bip01 Pelvis', 'Bip01 BluntOneHand': 'Bip01 Pelvis',
  'Bip01 MarksmanThrown': 'Bip01 Pelvis', 'Bip01 MarksmanCrossbow': 'Bip01 Pelvis',
  'Bip01 LongBladeTwoClose': 'Bip01 Spine2', 'Bip01 AxeTwoClose': 'Bip01 Spine2', 'Bip01 BluntTwoClose': 'Bip01 Spine2',
  'Bip01 BluntTwoWide': 'Bip01 Spine2', 'Bip01 SpearTwoWide': 'Bip01 Spine2', 'Bip01 MarksmanBow': 'Bip01 Spine2',
});
/** The skeleton the game already has - our biped stands for it, with no sheathing bones of its own. */
function retailSkeleton() {
  const skel = buildSkeleton(parseNif(RETAIL_SKELETON_BYTES));
  for (const name of Object.keys(ADDON_BONES)) assert.equal(skel.byName.has(name.toLowerCase()), false, `${name} is the addon's to bring`);
  return { nif: parseNif(ADDON), skel };
}

test('WS1: the sheathing-bone column names our addon\'s nodes for the twelve weapon types; thrown never holsters; the paths', () => {
  assert.equal(Object.keys(SHEATHING_BONE).length, 12);
  assert.equal(SHEATHING_BONE[MW_WEAPON_TYPE.LongBladeTwoHand], 'Bip01 LongBladeTwoClose');
  assert.equal(SHEATHING_BONE[MW_WEAPON_TYPE.AxeTwoHand], 'Bip01 AxeTwoClose');
  assert.equal(SHEATHING_BONE[MW_WEAPON_TYPE.AxeOneHand], 'Bip01 LongBladeOneHand', 'AUDIT-WS F1: weapontype.hpp:115, not the addon\'s "Bip01 AxeOneHand"');
  assert.equal(SHEATHING_BONE[MW_WEAPON_TYPE.MarksmanCrossbow], 'Bip01 MarksmanCrossbow');
  for (const name of Object.values(SHEATHING_BONE)) assert.ok(ADDON_BONES[name], `${name} is a node the addon carries`);
  assert.equal(holsters(MW_WEAPON_TYPE.MarksmanThrown), false); assert.equal(holsters(MW_WEAPON_TYPE.ShortBladeOneHand), true);
  assert.equal(holsters(MW_WEAPON_TYPE.Arrow), false); assert.equal(holsters(MW_WEAPON_TYPE.None), false);
  assert.equal(sheathedMeshPath('meshes/w/w_saber.nif'), 'meshes/w/w_saber_sh.nif');
  assert.equal(sheathedMeshPath('meshes/w.dir/noext'), 'meshes/w.dir/noext_sh'); assert.equal(sheathedMeshPath(''), '');
  assert.equal(animationsDirOf('meshes/xbase_anim.nif'), 'animations/xbase_anim/');
  assert.equal(animationsDirOf('Meshes\\xbase_anim_female.NIF'), 'animations/xbase_anim_female/');
  assert.equal(animationsDirOf(TP_BASE_MODEL), 'animations/xbase_anim/');
  assert.deepEqual(holsterPartPaths({ weaponModel: 'w\\w_saber.nif' }), ['meshes/w\\w_saber_sh.nif']);
  assert.deepEqual(holsterPartPaths({ weaponModel: null }), []);
  assert.deepEqual(HOLSTER_SLOTS, ['holster', 'sheath', 'quiver']);
  assert.equal(holsterHidden('holster', true), true); assert.equal(holsterHidden('holster', false), false);
  assert.equal(holsterHidden('sheath', true), false); assert.equal(holsterHidden('quiver', true), false); assert.equal(holsterHidden('weapon', true), null);
  // AUDIT-WS F4: a round on the string empties the LAST quiver slot, and only that one
  assert.equal(holsterHidden('quiver', true, { arrowShown: true, tag: { i: 6, n: 7 } }), true);
  assert.equal(holsterHidden('quiver', true, { arrowShown: true, tag: { i: 5, n: 7 } }), false);
  assert.equal(holsterHidden('quiver', true, { arrowShown: false, tag: { i: 6, n: 7 } }), false);
  assert.equal(holsterHidden('quiver', false, { arrowShown: true, tag: null }), false);
});

test('WS1: our addon joins the skeleton - the eleven BONE-marked nodes under the node of their addon parent\'s name, their own transform, refs past any record; an unmarked node is never added, a known name is skipped, a missing parent is skipped', () => {
  const { nif, skel } = retailSkeleton();
  const before = skel.nodes.size;
  const r = injectSkeletonNodes(skel, nif);
  assert.deepEqual([...r.added].sort(), Object.keys(ADDON_BONES).sort());
  assert.deepEqual(r.skipped, []);
  assert.equal(skel.nodes.size, before + 11);
  for (const [name, parent] of Object.entries(ADDON_BONES)) {
    const ref = skel.byName.get(name.toLowerCase());
    assert.ok(ref >= INJECTED_REF_BASE, `${name}: a minted ref`);
    const node = skel.nodes.get(ref);
    assert.equal(skel.nodes.get(node.parent).name, parent, `${name} hangs under ${parent}`);
    assert.ok(node.injected);
    const src = findNodeByName(nif, name).rec;
    assert.deepEqual([...node.rest.translation], [...src.translation]);
    assert.deepEqual([...node.rest.rotation], [...src.rotation]);
  }
  // posed at rest, the injected node stands on its parent: the parent's matrix times its own
  const mats = skeletonSpaceMatrices(skel, poseSkeleton(skel, null, sampleTrack, 0), -1);
  const bow = skel.nodes.get(skel.byName.get('bip01 marksmanbow'));
  const P = mats.get(bow.parent), at = mats.get(skel.byName.get('bip01 marksmanbow'));
  const t = bow.rest.translation, want = [0, 1, 2].map((k) => P.a[k * 3] * t[0] + P.a[k * 3 + 1] * t[1] + P.a[k * 3 + 2] * t[2] + P.t[k]);
  for (let i = 0; i < 3; i++) assert.ok(near(at.t[i], want[i], 1e-3), `t[${i}] ${at.t[i]} vs ${want[i]}`);
  // again: a name already here is a dead copy in the reference (rule 16's first answers) and a skip here
  const r2 = injectSkeletonNodes(skel, nif);
  assert.deepEqual(r2.added, []); assert.equal(r2.skipped.length, 11); assert.match(r2.skipped[0], /\(already here\)$/);
  assert.equal(skel.nodes.size, before + 11);
  // an UNMARKED node is not a custom bone (AUDIT-WS F2, GetExtendedBonesVisitor, animation.cpp:218-236): a stand-in addon with one
  {
    const { skel: s1 } = retailSkeleton();
    const recs = sheathingAddonRecords();
    const pelvisAt = recs.findIndex((x) => x.name === 'Bip01 Pelvis');
    recs[pelvisAt].children.push(recs.length);
    recs.push({ type: 'NiNode', name: 'Bip01 AttachWeapon', children: [] });
    const r1 = injectSkeletonNodes(s1, parseNif(writeNifBytes(recs)));
    assert.equal(r1.added.length, 11); assert.equal(s1.byName.has('bip01 attachweapon'), false);
  }
  // a marked node whose parent the actor lacks is skipped, by name (the reference's FindByNameVisitor finds nothing and moves on)
  {
    const { nif: n4, skel: s4 } = retailSkeleton();
    const spine2 = s4.byName.get('bip01 spine2');
    s4.byName.delete('bip01 spine2'); s4.nodes.get(spine2).name = 'Bip01 Spine2x'; s4.byName.set('bip01 spine2x', spine2);
    const r4 = injectSkeletonNodes(s4, n4);
    assert.equal(r4.added.length, 5, 'the pelvis five');
    assert.equal(r4.skipped.length, 6); assert.ok(r4.skipped.every((x) => /\(no "Bip01 Spine2" here\)$/.test(x)), r4.skipped.join('; '));
  }
  // the marker: the reference's own test (nifloader.cpp:630-633)
  assert.equal(hasBoneMarker(nif, findNodeByName(nif, 'Bip01 MarksmanBow').rec), true);
  assert.equal(hasBoneMarker(nif, findNodeByName(nif, 'Bip01 Pelvis').rec), false, 'the parent rides unmarked');
  assert.equal(hasBoneMarker(nif, { extra: -1 }), false); assert.equal(hasBoneMarker(nif, null), false);
  // ...and it is the STRING that marks, found anywhere down the extra chain (nifloader.cpp:618-640 walks it whole)
  const chain = { records: [{ type: 'NiStringExtraData', string: 'MRK', next: 1 }, { type: 'NiStringExtraData', string: 'BONE', next: -1 }, { type: 'NiStringExtraData', string: 'NCO', next: -1 }], roots: [] };
  assert.equal(hasBoneMarker(chain, { extra: 0 }), true, 'BONE second in the chain');
  assert.equal(hasBoneMarker(chain, { extra: 2 }), false, 'another string is not the marker');
  // a marked bone's SUBTREE rides with it (DEEP_COPY_NODES, animation.cpp:1300): a tip node hung under the bow's bone in a stand-in addon
  {
    const { nif: n5, skel: s5 } = retailSkeleton();
    const bowRef = n5.records.findIndex((x) => x?.type === 'NiNode' && x.name === 'Bip01 MarksmanBow');
    const tip = { type: 'NiNode', name: 'Bip01 MarksmanBow Tip', flags: 0, children: [], translation: [1, 2, 3], rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), scale: 1, extra: -1, properties: [] };
    const addon = { records: n5.records.map((x, i) => (i === bowRef ? { ...x, children: [...(x.children ?? []), n5.records.length] } : x)).concat([tip]), roots: n5.roots };
    const r5 = injectSkeletonNodes(s5, addon);
    assert.equal(r5.added.length, 12); assert.ok(r5.added.includes('Bip01 MarksmanBow Tip'));
    const tipRef = s5.byName.get('bip01 marksmanbow tip');
    assert.equal(s5.nodes.get(s5.nodes.get(tipRef).parent).name, 'Bip01 MarksmanBow', 'under the bone it came with, not under the actor\'s Spine2');
    assert.deepEqual([...s5.nodes.get(tipRef).rest.translation], [1, 2, 3]);
  }
});

test('OWN-WORK4: our own points - a one-handed weapon on the belt at the hip, a two-hander and the bow across the back; blades hilt up on the left hip, a staff\'s and a spear\'s head over the right shoulder', () => {
  const { nif, skel } = retailSkeleton();
  injectSkeletonNodes(skel, nif);
  const mats = skeletonSpaceMatrices(skel, poseSkeleton(skel, null, sampleTrack, 0), -1);
  const at = (n) => mats.get(skel.byName.get(n.toLowerCase()));
  const pelvis = at('Bip01 Pelvis').t, chest = at('Bip01 Spine2').t;
  const yAxis = (n) => { const a = at(n).a; return [a[1], a[4], a[7]]; };
  for (const n of ['Bip01 ShortBladeOneHand', 'Bip01 LongBladeOneHand', 'Bip01 BluntOneHand']) {
    const t = at(n).t;
    assert.ok(t[0] < -7 && Math.abs(t[2] - pelvis[2] - BELT) < 1, `${n}: on the belt at the left hip (${t.map((v) => v.toFixed(1))})`);
  }
  assert.ok(yAxis('Bip01 LongBladeOneHand')[2] < -0.8 && yAxis('Bip01 LongBladeOneHand')[1] < 0, 'the sword hangs tip down and back');
  assert.ok(yAxis('Bip01 BluntOneHand')[2] > 0.9, 'a mace stands head up through its ring');
  assert.ok(at('Bip01 MarksmanThrown').t[0] > 7, 'the darts at the right hip');
  for (const n of ['Bip01 LongBladeTwoClose', 'Bip01 AxeTwoClose', 'Bip01 BluntTwoClose', 'Bip01 BluntTwoWide', 'Bip01 SpearTwoWide', 'Bip01 MarksmanBow']) {
    assert.ok(at(n).t[1] < chest[1] - 5, `${n}: across the back`);
  }
  assert.ok(yAxis('Bip01 LongBladeTwoClose')[0] > 0.3 && yAxis('Bip01 LongBladeTwoClose')[2] < -0.8, 'the greatsword\'s hilt over the left shoulder, its tip to the right hip');
  assert.ok(yAxis('Bip01 SpearTwoWide')[0] > 0 && yAxis('Bip01 SpearTwoWide')[2] > 0.9, 'the spear\'s head over the right shoulder');
  assert.equal(BELT, HIP_LANTERN_HOOK[2], 'the belt is the waist lantern\'s hook height');
  assert.deepEqual(Object.keys(SHEATH_POINTS).sort(), [...new Set(Object.values(SHEATHING_BONE))].sort(), 'a point for every bone the column names, and no other');
  assert.equal(weaponSheathingArchive().has(SHEATHING_ADDON_PATH), true);
});

test('WS1: a scabbard file flattens by subtree - under the weapon node, or everything but it - with the full chain kept', () => {
  const nif = parseNif(PLAYERS_SH);
  const all = flattenNif(nif);
  const weapon = flattenNif(nif, { underNode: SHEATH_WEAPON_NODE });
  const rest = flattenNif(nif, { excludeNode: SHEATH_WEAPON_NODE });
  assert.ok(weapon.length > 0 && rest.length > 0, 'both halves carry geometry');
  assert.equal(weapon.length + rest.length, all.length, 'the two halves are the file');
  const key = (b) => `${b.positions.length}:${[...b.positions.slice(0, 6)].map((v) => v.toFixed(4)).join(',')}`;
  assert.deepEqual([...weapon.map(key), ...rest.map(key)].sort(), all.map(key).sort());
  assert.deepEqual(flattenNif(nif, { underNode: 'no such node' }), []);
  assert.equal(flattenNif(nif, { excludeNode: 'no such node' }).length, all.length);
  assert.deepEqual(weapon.map((b) => b.positions.length), [4 * 3, 3 * 3], 'the two shapes under the weapon node');
  assert.deepEqual([...weapon[1].positions.slice(0, 3)], [0, 1, 3], 'composed through the weapon node\'s own transform');
  // ours: the weapon node is EMPTY - the weapon itself hangs there
  assert.deepEqual(flattenNif(parseNif(LONGSWORD), { underNode: SHEATH_WEAPON_NODE }), []);
  assert.equal(flattenNif(parseNif(LONGSWORD), { excludeNode: SHEATH_WEAPON_NODE }).length, 2, 'the sheath and its fittings');
});

test('WS1: a scabbard binds as a rigid part at an injected bone (rule 13: no mirror - no sheathing bone is "Left"), and refuses a bone the skeleton lacks', () => {
  const { nif, skel } = retailSkeleton();
  injectSkeletonNodes(skel, nif);
  const bound = bindPart(skel, parseNif(LONGSWORD), { attachBone: 'Bip01 LongBladeOneHand', excludeNode: SHEATH_WEAPON_NODE });
  assert.ok(bound.attached.length > 0 && bound.skinned.length === 0);
  assert.ok(bound.attachRef >= INJECTED_REF_BASE);
  assert.equal(skel.nodes.get(bound.attachRef).name, 'Bip01 LongBladeOneHand');
  for (const name of Object.keys(ADDON_BONES)) assert.ok(!name.includes('Left'));
  const { skel: bare } = retailSkeleton();
  assert.throws(() => bindPart(bare, parseNif(LONGSWORD), { attachBone: 'Bip01 LongBladeOneHand' }), /no bone "Bip01 LongBladeOneHand"/);
});

/** The player's data: no `_sh` file at all, or the one stand-in (`players`) at the iron longsword's name. */
function playersFind({ players = false } = {}) {
  const files = new Map(players ? [['meshes/w\\w_iron_longsword_sh.nif', PLAYERS_SH]] : []);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  return (p) => (arc.has(p) ? arc : null);
}
const ARROW = new Uint8Array([7, 7]);
const hasAll = () => true;
const ours = { ownScabbard: ownScabbardBytes };

test('WS1: the holster\'s decisions - the player\'s own scabbard first, then ours, then the bare mesh; the scabbard less its weapon node plus the weapon; no weapon node: the whole scabbard; thrown, none and no bone', () => {
  const find = playersFind({ players: true });
  const sword = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif, ...ours });
  assert.deepEqual(sword.parts.map((p) => [p.slot, p.bones[0], p.underNode ?? null, p.excludeNode ?? null]), [
    ['sheath', 'Bip01 LongBladeOneHand', null, SHEATH_WEAPON_NODE],
    ['holster', 'Bip01 LongBladeOneHand', SHEATH_WEAPON_NODE, null],
  ]);
  assert.equal(sword.parts[0].bytes, sword.parts[1].bytes, 'one file, two subtrees');
  assert.deepEqual(sword.info, { bone: 'Bip01 LongBladeOneHand', scabbard: 'meshes/w\\w_iron_longsword_sh.nif', own: false, weaponNode: true, weaponNodeEmpty: false, quiver: 0, thrown: false });
  assert.deepEqual(sword.notes, []);
  // no file of the player's: ours, sized to the weapon - its sheath, and the weapon itself under the empty node
  const mine = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_saber.nif', weaponBytes: SWORD, find: playersFind(), hasBone: hasAll, parseNif, ...ours });
  assert.deepEqual(mine.parts.map((p) => [p.slot, p.excludeNode ?? null, p.bytes === SWORD]), [['sheath', SHEATH_WEAPON_NODE, false], ['holster', null, true]]);
  assert.equal(mine.parts[0].bytes, LONGSWORD, 'one weapon\'s bytes, one scabbard');
  assert.equal(mine.info.own, true); assert.equal(mine.info.weaponNodeEmpty, true);
  // no file and no builder: the base mesh alone
  const bare = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.BluntOneHand, weaponModel: 'w\\w_no_such_club.nif', weaponBytes: SWORD, find: playersFind(), hasBone: hasAll, parseNif });
  assert.deepEqual(bare.parts.map((p) => [p.slot, p.bones[0], p.bytes]), [['holster', 'Bip01 BluntOneHand', SWORD]]);
  assert.equal(bare.info.scabbard, null);
  // no weapon node at all: the file stands whole, no holster (a stand-in with the node renamed)
  const sh = parseNif(PLAYERS_SH);
  const renamed = { records: sh.records.map((r) => (String(r?.name).toLowerCase() === 'bip01 weapon' ? { ...r, name: 'Blade' } : r)), roots: sh.roots };
  const whole = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif: () => renamed });
  assert.deepEqual(whole.parts.map((p) => [p.slot, p.underNode ?? null, p.excludeNode ?? null]), [['sheath', null, null]]);
  assert.equal(whole.info.weaponNode, false);
  // a SHAPE named as the weapon node is not found (findNodeByName's recorded delta on geometry): the file stands whole
  const geomNode = { records: sh.records.map((r) => (String(r?.name).toLowerCase() === 'bip01 weapon' ? { ...r, type: 'NiTriShape' } : r)), roots: sh.roots };
  assert.equal(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif: () => geomNode }).info.weaponNode, false);
  // AUDIT-WS F3: thrown - showHolsteredWeapons forced off (actoranimation.cpp:333-336): no bare mesh, none of ours, and a scabbard that exists stands with its weapon node masked
  const dart = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanThrown, weaponModel: 'w\\w_dart.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif, ...ours });
  assert.deepEqual(dart.parts, []); assert.equal(dart.info.thrown, true); assert.equal(dart.info.bone, 'Bip01 MarksmanThrown');
  const dartSh = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanThrown, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif });
  assert.deepEqual(dartSh.parts.map((p) => [p.slot, p.excludeNode ?? null]), [['sheath', SHEATH_WEAPON_NODE]]); assert.equal(dartSh.info.thrown, true);
  assert.deepEqual(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.None, weaponModel: 'w\\x.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif, ...ours }).parts, []);
  assert.deepEqual(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: null, weaponBytes: SWORD, find, hasBone: hasAll, parseNif, ...ours }).parts, []);
  const noBone = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find, hasBone: () => false, parseNif, ...ours });
  assert.deepEqual(noBone.parts, []); assert.match(noBone.notes[0], /no "Bip01 LongBladeOneHand"/);
  // a scabbard that will not parse: the base mesh, and a note
  const broken = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find: () => ({ get: () => new Uint8Array([1, 2, 3]) }), hasBone: hasAll, parseNif });
  assert.deepEqual(broken.parts.map((p) => p.slot), ['holster']); assert.equal(broken.parts[0].bytes, SWORD); assert.match(broken.notes[0], /^holster: /);
});

test('AUDIT-WS F6: every holster part is a bare instance (attachMesh is getInstance under the bone, actoranimation.cpp:66-83) - a weapon mesh with a BoneOffset node hangs at the sheathing bone without it', async () => {
  const find = playersFind({ players: true });
  const sword = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif });
  assert.ok(sword.parts.every((p) => p.bare === true), 'the scabbard and the weapon node');
  const mine = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_saber.nif', weaponBytes: SWORD, find: playersFind(), hasBone: hasAll, parseNif, ...ours });
  assert.ok(mine.parts.every((p) => p.bare === true), 'ours');
  // executed: the boneoffset fixture as a weapon mesh - bound as the HAND's weapon it takes its offset, holstered it does not
  const OFFSET = new Uint8Array(readFileSync(new URL('../../fixtures/mw/boneoffset.nif', import.meta.url)));
  const addon = [{ name: SHEATHING_ADDON_PATH, bytes: ADDON }];
  const held = await assembleFirstPersonArm({ skeletonBytes: RETAIL_SKELETON_BYTES, parts: [{ slot: 'weapon', bones: ['Weapon Bone'], bytes: OFFSET }], boneSources: addon });
  const holstered = await assembleFirstPersonArm({ skeletonBytes: RETAIL_SKELETON_BYTES, parts: resolveHolsterParts({ mwType: MW_WEAPON_TYPE.BluntOneHand, weaponModel: 'w\\w_no_such_club.nif', weaponBytes: OFFSET, find: playersFind(), hasBone: hasAll, parseNif }).parts, boneSources: addon });
  assert.ok(held.ok && holstered.ok);
  assert.ok(held.pieces.some((p) => p.boneOffset), 'the fixture carries a BoneOffset, and the hand takes it (rule 14)');
  assert.ok(holstered.pieces.length > 0 && holstered.pieces.every((p) => p.boneOffset === null && p.slot === 'holster'), 'the holster ignores it');
});

test('WS1: an empty weapon node takes the base mesh under the node\'s own transform, bare, on the scabbard\'s offset - every scabbard of ours', () => {
  const r = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_saber.nif', weaponBytes: SWORD, find: playersFind(), hasBone: hasAll, parseNif, ...ours });
  const holster = r.parts.find((p) => p.slot === 'holster');
  assert.equal(holster.bytes, SWORD); assert.equal(holster.bare, true); assert.equal(holster.inheritOffsetFrom, 'sheath');
  assert.ok(holster.preTransform && holster.preTransform.a.length === 9);
  // the mouth is the end of the guard's slice: the widest of the grip's half (16 slices of the 36-unit sword, 2.25 each)
  assert.ok(near(holster.preTransform.t[1], -0.75, 1e-4), `the guard at the scabbard's mouth (${holster.preTransform.t[1]})`);
  assert.equal(r.info.weaponNodeEmpty, true);
});

test('WS1: the quiver - one arrow per "Bip01 Ammo N" up to the count, arrows for a bow and bolts for a crossbow, none for the wrong round or no round', () => {
  const find = playersFind();
  const bow = (ammo, ammoCount) => resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanBow, weaponModel: 'w\\w_longbow.nif', weaponBytes: BOW, ammo, ammoCount, find, hasBone: hasAll, parseNif, ...ours });
  const three = bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Arrow }, 3);
  const q = three.parts.filter((p) => p.slot === 'quiver');
  assert.equal(q.length, 3); assert.equal(three.info.quiver, 3);
  for (const p of q) { assert.equal(p.bytes, ARROW); assert.equal(p.bare, true); assert.equal(p.inheritOffsetFrom, 'sheath'); assert.equal(p.bones[0], 'Bip01 MarksmanBow'); assert.ok(p.preTransform); }
  assert.deepEqual(q.map((p) => p.tag), [{ i: 0, n: 3 }, { i: 1, n: 3 }, { i: 2, n: 3 }], 'AUDIT-WS F4: each slot tagged with its index and the count');
  assert.notDeepEqual([...q[0].preTransform.t], [...q[1].preTransform.t], 'each under its own slot');
  const nif = parseNif(LONGBOW);
  assert.equal(findNodeByName(nif, SHEATH_AMMO_NODE).rec.children.filter((c) => c >= 0).length, QUIVER_SLOTS);
  assert.equal(QUIVER_SLOTS, 6);
  assert.equal(bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Arrow }, Number.MAX_SAFE_INTEGER).info.quiver, 6, 'never more than the quiver holds');
  assert.equal(bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Arrow }, 0).info.quiver, 0);
  assert.equal(bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Bolt }, 5).info.quiver, 0, 'bolts are not a bow\'s round');
  assert.equal(bow(null, 5).info.quiver, 0);
  const xbow = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanCrossbow, weaponModel: 'w\\w_crossbow.nif', weaponBytes: BOW, ammo: { bytes: ARROW, type: MW_WEAPON_TYPE.Bolt }, ammoCount: 4, find, hasBone: hasAll, parseNif, ...ours });
  assert.equal(xbow.info.quiver, 4);
  // the sheath binds first, so the bare parts find its offset (bindPartsInto's order)
  assert.equal(three.parts[0].slot, 'sheath');
});

test('WS1: the whole assembly - our addon in, the scabbard and the holster placed at the injected bone, the quiver on the bow', async () => {
  const find = playersFind();
  const addon = [{ name: SHEATHING_ADDON_PATH, bytes: ADDON }];
  const sword = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_saber.nif', weaponBytes: SWORD, find, hasBone: hasAll, parseNif, ...ours });
  const arm = await assembleFirstPersonArm({ skeletonBytes: RETAIL_SKELETON_BYTES, parts: sword.parts, boneSources: addon });
  assert.ok(arm.ok, `the assembly: ${arm.error}`);
  assert.equal(arm.injected.length, 1); assert.equal(arm.injected[0].added.length, 11); assert.deepEqual(arm.injected[0].skipped, []);
  const slots = arm.pieces.map((p) => p.slot);
  assert.deepEqual([slots.filter((x) => x === 'sheath').length, slots.filter((x) => x === 'holster').length], [2, 1], 'the sheath\'s two shapes, the sword\'s one');
  for (const p of arm.pieces) { assert.equal(p.kind, 'rigid'); assert.equal(p.mirrored, false); assert.equal(p.bone, 'Bip01 LongBladeOneHand'); assert.ok(p.positions.every(Number.isFinite), 'finite positions'); }
  assert.ok(!arm.notes.some((n) => /holster|sheath/.test(n)), arm.notes.join('; '));
  const bow = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanBow, weaponModel: 'w\\w_longbow.nif', weaponBytes: BOW, ammo: { bytes: DAGGER, type: MW_WEAPON_TYPE.Arrow }, ammoCount: 2, find, hasBone: hasAll, parseNif, ...ours });
  const arm2 = await assembleFirstPersonArm({ skeletonBytes: RETAIL_SKELETON_BYTES, parts: bow.parts, boneSources: addon });
  assert.ok(arm2.ok, `the bow's assembly: ${arm2.error}`);
  const quiver = arm2.pieces.filter((p) => p.slot === 'quiver');
  assert.ok(quiver.length >= 2, 'the two rounds bound');
  assert.ok(quiver.every((p) => p.bone === 'Bip01 MarksmanBow' && p.boneOffset === null), 'bare, and the scabbard carries no BoneOffset');
  assert.ok(quiver.some((p) => p.tag && p.tag.i === 1 && p.tag.n === 2), 'the tag rides the piece');
  // an addon that will not parse is a note, not a refusal
  const arm3 = await assembleFirstPersonArm({ skeletonBytes: RETAIL_SKELETON_BYTES, parts: sword.parts, boneSources: [...addon, { name: 'bad.nif', bytes: new Uint8Array([1, 2]) }] });
  assert.ok(arm3.ok, 'a bad addon is not a refusal'); assert.match(arm3.notes.find((n) => n.startsWith('bones: bad.nif')), /bad\.nif/);
});

test('OWN-WORK4: our scabbards, one kind a weapon kind - each sized to its own weapon, the file law kept (a sheath node, an EMPTY weapon node, a quiver\'s ammo slots); the mod\'s folder is gone', () => {
  const kinds = {};
  for (const [name, t] of Object.entries(MW_WEAPON_TYPE)) {
    const bytes = ownScabbardBytes({ mwType: t, weaponBytes: SWORD });
    kinds[name] = bytes ? SCABBARD_KIND[t] : null;
    if (!bytes) continue;
    const nif = parseNif(bytes);
    assert.ok(findNodeByName(nif, SHEATH_NODE), `${name}: ${SHEATH_NODE}`);
    assert.deepEqual(findNodeByName(nif, SHEATH_WEAPON_NODE).rec.children, [], `${name}: the weapon node is empty - the weapon hangs there`);
    assert.equal(!!findNodeByName(nif, SHEATH_AMMO_NODE), SCABBARD_KIND[t] === 'quiver', `${name}: ammo slots on a quiver alone`);
    assert.ok(flattenNif(nif).length >= 2 && flattenNif(nif).every((b) => b.positions.every(Number.isFinite)), `${name}: drawn`);
    assert.equal(ownScabbardBytes({ mwType: t, weaponBytes: SWORD }), bytes, `${name}: built once a weapon`);
  }
  assert.deepEqual(Object.entries(kinds).filter(([, k]) => k).map(([n, k]) => `${n}:${k}`), [
    'ShortBladeOneHand:sheath', 'LongBladeOneHand:sheath', 'LongBladeTwoHand:sheath', 'BluntOneHand:ring', 'BluntTwoClose:ring', 'BluntTwoWide:ring',
    'SpearTwoWide:ring', 'AxeOneHand:ring', 'AxeTwoHand:ring', 'MarksmanBow:quiver', 'MarksmanCrossbow:quiver',
  ]);
  // sized to the weapon: a dagger's sheath is shorter than a sword's, and both reach past the blade's tip
  const len = (w) => { const b = flattenNif(parseNif(ownScabbardBytes({ mwType: MW_WEAPON_TYPE.ShortBladeOneHand, weaponBytes: w })))[0].positions; let hi = -Infinity; for (let i = 1; i < b.length; i += 3) hi = Math.max(hi, b[i]); return hi; };
  assert.ok(len(DAGGER) < len(SWORD) - 10, `${len(DAGGER)} vs ${len(SWORD)}`);
  assert.ok(len(SWORD) > 30 - 0.75, 'past the sword\'s tip, hung from its guard');
  const ext = weaponExtent(SWORD);
  assert.deepEqual([ext.lo[1], ext.hi[1]], [-6, 30]);
  assert.equal(ownScabbardBytes({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponBytes: new Uint8Array([1, 2, 3]) }), null, 'a mesh that will not read takes none');
  assert.equal(existsSync(new URL('vendor/weapon-sheathing', root)), false, 'no file of the mod is carried');
});

test('WS1: the archive duck and its canonical paths; the bone-source listing; the loose store keys animations/', async () => {
  assert.equal(vendoredDataPath('../../mods/sheathing/Data Files/Meshes/w/W_Saber_sh.nif'), 'meshes/w/w_saber_sh.nif');
  assert.equal(vendoredDataPath('mods\\sheathing\\Data Files\\Animations\\xbase_anim\\xbase_anim_sh.nif'), 'animations/xbase_anim/xbase_anim_sh.nif');
  assert.equal(vendoredDataPath('loose.nif'), 'loose.nif');
  const fetched = [];
  const arc = makeVendoredArchive({ 'meshes/w/w_saber_sh.nif': async () => 'u1', 'Animations/xbase_anim/xbase_anim_sh.nif': async () => 'u2' }, async (u) => { fetched.push(u); return new Uint8Array([u.length]); });
  assert.ok(arc.vendored); assert.deepEqual(arc.names, ['meshes/w/w_saber_sh.nif', 'animations/xbase_anim/xbase_anim_sh.nif']);
  assert.equal(arc.has('MESHES\\w\\w_saber_sh.nif'), true); assert.equal(arc.has('meshes/w/w_saber.nif'), false);
  assert.equal(arc.loaded('meshes/w/w_saber_sh.nif'), false); assert.equal(arc.get('meshes/w/w_saber_sh.nif'), null);
  const [a, b] = await Promise.all([arc.load('meshes/w/w_saber_sh.nif'), arc.load('meshes/w/w_saber_sh.nif')]);
  assert.equal(a, b); assert.deepEqual(fetched, ['u1'], 'one fetch for two loads in flight');
  assert.equal(arc.loaded('meshes/w/w_saber_sh.nif'), true); assert.equal(arc.get('meshes/w/w_saber_sh.nif'), a);
  assert.equal(await arc.load('meshes/w/nope.nif'), null);
  // OWN-WORK4: our door - the one addon, built in code, the same in node as in the browser
  assert.deepEqual(WEAPON_SHEATHING_URLS, { [SHEATHING_ADDON_PATH]: 'own:sheathing-bones' });
  assert.equal(SHEATHING_ADDON_PATH, 'animations/xbase_anim/dfo_sheathing.nif');
  assert.equal(weaponSheathingArchive().has('meshes/w/w_saber_sh.nif'), false, 'no scabbard file: ours are built per weapon');
  assert.equal(weaponSheathingArchive(), weaponSheathingArchive());
  assert.equal(await weaponSheathingArchive().load(SHEATHING_ADDON_PATH), ADDON);
  assert.deepEqual(boneSourcesFor(TP_BASE_MODEL, 'meshes/xbase_anim_female.nif', [weaponSheathingArchive()]), [SHEATHING_ADDON_PATH], 'every body takes it, off the base model\'s folder');
  // the bone sources: the base model's folder then the actor's own, .nif only, once each, off list() or names
  const bsa = { list: () => ['Animations/xbase_anim/xbase_anim_sh.nif', 'animations/xbase_anim/other.kf', 'meshes/xbase_anim.nif'] };
  const loose = { names: ['animations/xbase_anim_female/xbase_anim_sh.nif', 'animations/xbase_anim/xbase_anim_sh.nif', 'animations/xbase_anim/extra.nif'] };
  assert.deepEqual(boneSourcesFor(TP_BASE_MODEL, 'meshes/xbase_anim_female.nif', [loose, bsa]),
    ['animations/xbase_anim/xbase_anim_sh.nif', 'animations/xbase_anim/extra.nif', 'animations/xbase_anim_female/xbase_anim_sh.nif']);
  assert.deepEqual(boneSourcesFor(TP_BASE_MODEL, TP_BASE_MODEL, [bsa]), ['animations/xbase_anim/xbase_anim_sh.nif']);
  assert.deepEqual(boneSourcesFor(TP_BASE_MODEL, TP_BASE_MODEL, [{}]), []);
  assert.equal(mwLoosePath('Data Files/Animations/xbase_anim/xbase_anim_sh.nif'), 'animations/xbase_anim/xbase_anim_sh.nif');
});

test('WS1: the wiring, by source - the third-person build takes the addons and the holster, the swap re-resolves it, the three hide sites, the options, the pref, the card, the data path, the build', () => {
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /const boneSourcePaths = werewolf \? \[\] : boneSourcesFor\(TP_BASE_MODEL, skeletonPath, archives\);/);
  // PIN MOVED (MWNPC3): the binder takes the shared parse too
  // PIN MOVED (TWO-HANDS AUDIT): and asks for the left hand's weapon bone - made by the mirror after the addons, where the
  // skeleton (with them) has none
  assert.match(fp, /let arm = await assembleFirstPersonArm\(\{ skeletonBytes, parts: partBytes, boneSources, parseNif: parseNifOnce, offWeaponBone: true \}\);/);   // PIN MOVED (HEAD-HELD, FIELD BUGS 2026-10-12b): `let` - a helm that bound nothing assembles it again
  assert.match(fp, /hasBone: boneProbe\(skeletonBytes, boneSources\), parseNif: parseNifOnce,/);
  assert.match(fp, /ammoCount: ammoCount \?\? \(hasAmmo \? Number\.MAX_SAFE_INTEGER : 0\),/g);
  assert.equal((fp.match(/ammoCount: ammoCount \?\? \(hasAmmo \? Number\.MAX_SAFE_INTEGER : 0\),/g) || []).length, 2, 'the build and the swap');
  assert.match(fp, /const swapped = new Set\(\['weapon', 'arrow', \.\.\.HOLSTER_SLOTS\]\);/);
  assert.match(fp, /bindPartsInto\(t\.arm, \[\.\.\.tResolved\.parts, \.\.\.tHolster\.parts\]\);/);
  assert.equal((fp.match(/else if \(HOLSTER_SLOTS\.includes\(r\.slot\)\) r\.hidden = holsterHidden\(r\.slot, weaponShown, \{ arrowShown, tag: r\.piece\?\.tag \}\);/g) || []).length, 1, 'the world draw, with the round on the string');
  assert.equal((fp.match(/else if \(HOLSTER_SLOTS\.includes\(r\.slot\)\) r\.hidden = holsterHidden\(r\.slot, true, \{ arrowShown, tag: r\.piece\?\.tag \}\);/g) || []).length, 1, 'the portrait: the weapon is in the hand');
  // OWN-WORK4: the door serves our own addon, built in code - no glob, no file
  assert.doesNotMatch(rd('src/systems/weaponSheathingAssets.js'), /import\.meta\.glob/);
  assert.match(fp, /parseNif: parseNifOnce, ownScabbard: ownScabbardBytes,/, 'the build asks our scabbard where the player\'s data has none');
  assert.match(fp, /sheathing = true, ammoCount = null,/);
  const rig = rd('src/combat/weapon/weaponRig.js');
  assert.match(rig, /sheathing: getPref\('mwSheathing'\),/); assert.match(rig, /ammoCount: ammoCountFor\(entity\.items, worn\),/);
  const feat = rd('src/systems/features.js');
  assert.match(feat, /id: 'mod-weapon-sheathing',/);
  // MODS-ONLINE-3 (2026-09-22, Mac): the online answer is the PLAYER's
  // now. It was forced "so every body a peer sees wears its blade the
  // same way" - a claim about how MY machine DRAWS someone else, which
  // is `peerClassSprites`'s category and has always been the player's.
  // A scabbard stands no object, rolls nothing and never reaches the
  // wire; the pose's `wd` carries a peer's drawn weapon either way.
  assert.match(feat, /control: Object\.freeze\(\{ store: 'prefs', key: 'mwSheathing', initial: true, online: 'player' \}\),/, 'RF4: the switch declared once, on its row, on by default, and the player\'s online');
  assert.ok(!/mwSheathing: (true|false),/.test(rd('src/systems/uiPrefs.js')), 'and not on the shelf');
  // FT18: the card's own row drew NOTHING since FT13 (a moved key's prefRow answers null, and the bare append printed
  // "null" on the card) - the switch is the tile, and the tile's write rebuilds the standing body, as the row did
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.doesNotMatch(menu, /prefRow\('mwSheathing'/, 'no second switch, and no null on the card');
  // MW-STEEL1: the rebuild is one helper now, the Steel Helm's tile beside the sheathing's
  assert.match(menu, /const rebuildMorrowindBody = async \(\) => \{\s*\n\s*if \(!morrowindDataCount\(\) \|\| !playerEntity\?\.chargenDone\) return;[^\n]*\n\s*const \{ buildArmsFor \} = await import\('\.\.\/\.\.\/combat\/weapon\/weaponRig\.js'\);\s*\n\s*await buildArmsFor\(playerEntity\);/, 'the tile rebuilds the holster into a standing body');
  assert.match(menu, /\n  mwSheathing: rebuildMorrowindBody,\n/, 'the sheathing tile takes that rebuild');
  assert.match(menu, /set: \(i\) => \{ setPref\(c\.key, i === 1\); TILE_AFTER\[c\.key\]\?\.\(\); \} \};/, 'through the prefs switch\'s one write');
  const ds = rd('src/scenes/dataSource.js');
  const loosePush = ds.indexOf('archives.push(makeLooseArchive(loose));');
  const vendPush = ds.indexOf('archives.push(ws.weaponSheathingArchive());');
  const bsaPush = ds.indexOf('archives.push(await MwBsaFile.open(blob));');
  assert.ok(loosePush > 0 && vendPush > loosePush && bsaPush > vendPush, 'loose, then ours, then the .bsa archives');
  assert.match(ds, /'animations\/'\]/);
  // INLINE1 (2026-09-20): this pin matched the allow-list's literal text, the
  // enumeration INLINE1 retired. Re-aimed at what it MEANS: a vendored mod's art is
  // never inlined, through the real rule; and a folder no list has ever named
  // is refused too, so the pin goes red if the enumeration ever comes back.
  const vite = rd('vite.config.js');
  const m = /assetsInlineLimit: \(filePath\) => \((.*?)\),/.exec(vite);
  assert.ok(m, 'the inline rule is a callback');
  // eslint-disable-next-line no-new-func
  const rule = new Function('filePath', `return (${m[1]});`);
  assert.equal(rule('/x/vendor/eye-of-the-beholder/Textures/a.png'), false, 'a mod\'s art is a file, never base64');
  assert.equal(rule('/x/vendor/a-mod-no-list-has-named/a.png'), false, 'and so is every mod\'s - the rule is the class (test/ui/vendorinline.test.js walks it)');
  assert.match(rd('src/formats/morrowind/mwFirstPerson.js'), /if \(part\.slot === 'sheath'\) sheathBoneOffset = bound\.boneOffset \|\| null;/);
});
