// WS1 (2026-09-17, Mac: "Can we implement this for the morrowind model" -
// Greatness7's Weapon Sheathing 1.6): the bone addon joins the skeleton,
// the scabbard's subtrees, the holster's decisions, the quiver's count,
// the vendored tree, the hide law - and the wiring, by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseNif, deref } from '../src/formats/mwNifFile.js';
import { buildSkeleton, injectSkeletonNodes, skeletonSpaceMatrices, poseSkeleton, INJECTED_REF_BASE } from '../src/formats/mwSkin.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { bindPart, nodeTransformOf, findNodeByName } from '../src/formats/mwCharacter.js';
import { assembleFirstPersonArm, MW_WEAPON_TYPE, TP_BASE_MODEL } from '../src/formats/mwFirstPerson.js';
import { sampleTrack } from '../src/formats/mwAnim.js';
import {
  SHEATHING_BONE, SHEATH_WEAPON_NODE, SHEATH_AMMO_NODE, HOLSTER_SLOTS, sheathedMeshPath, animationsDirOf, boneSourcesFor, holsters,
  holsterPartPaths, resolveHolsterParts, holsterHidden, makeVendoredArchive, vendoredDataPath,
} from '../src/systems/weaponSheathing.js';
import { weaponSheathingArchive, WEAPON_SHEATHING_URLS } from '../src/systems/weaponSheathingAssets.js';
import { mwLoosePath } from '../src/scenes/dataSource.js';

const root = new URL('..', import.meta.url);
const rd = (p) => readFileSync(new URL(p, root), 'utf8');
const VENDOR = 'vendor/weapon-sheathing/Data Files/';
const bytes = (p) => new Uint8Array(readFileSync(new URL(VENDOR + p, root)));
const ADDON = bytes('Animations/xbase_anim/xbase_anim_sh.nif');
const LONGSWORD = bytes('Meshes/w/w_iron_longsword_sh.nif');
const LONGBOW = bytes('Meshes/w/w_longbow_sh.nif');
const CRESCENT = bytes('Meshes/w/w_art_blade_crescent_sh.nif');
const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

/** The addon's fourteen, with the retail node each hangs under. */
const ADDON_BONES = Object.freeze({
  'Bip01 AttachWeapon': 'Bip01',
  'Bip01 AxeOneHand': 'Bip01 Pelvis', 'Bip01 BluntOneHand': 'Bip01 Pelvis', 'Bip01 LongBladeOneHand': 'Bip01 Pelvis',
  'Bip01 MarksmanThrown': 'Bip01 Pelvis', 'Bip01 ShortBladeOneHand': 'Bip01 Pelvis', 'Bip01 MarksmanCrossbow': 'Bip01 Pelvis',
  'Bip01 AttachShield': 'Bip01 Spine2', 'Bip01 AxeTwoClose': 'Bip01 Spine2', 'Bip01 BluntTwoClose': 'Bip01 Spine2',
  'Bip01 LongBladeTwoClose': 'Bip01 Spine2', 'Bip01 MarksmanBow': 'Bip01 Spine2', 'Bip01 SpearTwoWide': 'Bip01 Spine2', 'Bip01 BluntTwoWide': 'Bip01 Spine2',
});
/** A "retail" skeleton: the addon's own hierarchy with its fourteen taken out (thirteen carry a "BONE"
 *  NiStringExtraData; "Bip01 AttachWeapon" does not, so the list is by name). */
function retailSkeleton() {
  const nif = parseNif(ADDON);
  const skel = buildSkeleton(nif);
  for (const [ref, node] of [...skel.nodes]) {
    if (ADDON_BONES[node.name]) { skel.nodes.delete(ref); skel.byName.delete(node.name.toLowerCase()); }
  }
  const marked = [...skel.nodes.keys()].filter((ref) => { const rec = deref(nif, ref); const e = rec?.extra >= 0 ? deref(nif, rec.extra) : null; return e?.string === 'BONE'; });
  assert.deepEqual(marked, [], 'every BONE-marked node is one of the fourteen');
  return { nif, skel };
}

test('WS1: the sheathing-bone column names the addon\'s nodes for the twelve weapon types; thrown never holsters; the paths', () => {
  assert.equal(Object.keys(SHEATHING_BONE).length, 12);
  assert.equal(SHEATHING_BONE[MW_WEAPON_TYPE.LongBladeTwoHand], 'Bip01 LongBladeTwoClose');
  assert.equal(SHEATHING_BONE[MW_WEAPON_TYPE.AxeTwoHand], 'Bip01 AxeTwoClose');
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
});

test('WS1: the addon joins a retail skeleton - fourteen nodes under the node of their parent\'s name, the addon\'s own transform, refs past any record, known nodes untouched, a transparent root, nothing twice', () => {
  const { nif, skel } = retailSkeleton();
  assert.equal(skel.byName.has('bip01 longbladeonehand'), false, 'the fixture is retail: no sheathing bones');
  const before = skel.nodes.size;
  const r = injectSkeletonNodes(skel, nif);
  assert.deepEqual([...r.added].sort(), Object.keys(ADDON_BONES).sort());
  assert.deepEqual(r.skipped, []);
  assert.equal(skel.nodes.size, before + 14);
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
  // posed at rest, the injected node's skeleton-space matrix is the addon's own root-to-node chain
  const mats = skeletonSpaceMatrices(skel, poseSkeleton(skel, null, sampleTrack, 0), -1);
  const at = mats.get(skel.byName.get('bip01 marksmanbow'));
  const want = nodeTransformOf(nif, 'Bip01 MarksmanBow');
  for (let i = 0; i < 3; i++) assert.ok(near(at.t[i], want.t[i], 1e-3), `t[${i}] ${at.t[i]} vs ${want.t[i]}`);
  for (let i = 0; i < 9; i++) assert.ok(near(at.a[i], want.a[i], 1e-3), `a[${i}]`);
  // again: nothing is added twice, and a known node keeps the retail transform
  const pelvis = skel.nodes.get(skel.byName.get('bip01 pelvis'));
  const t0 = [...pelvis.rest.translation];
  const r2 = injectSkeletonNodes(skel, nif);
  assert.deepEqual(r2.added, []); assert.equal(skel.nodes.size, before + 14);
  assert.deepEqual([...pelvis.rest.translation], t0);
  // a skeleton whose ROOT is not the addon's ("Bip01" at the top, as retail rigs and other addons differ in
  // their root's name): the addon's root is transparent, its children matched by name beneath it
  {
    const { nif: n3, skel: s3 } = retailSkeleton();
    const rootRef = [...s3.nodes.entries()].find(([, n]) => n.parent < 0)[0];
    const rootNode = s3.nodes.get(rootRef);
    s3.byName.delete(rootNode.name.toLowerCase()); rootNode.name = 'Some Other Root'; s3.byName.set('some other root', rootRef);
    const r3 = injectSkeletonNodes(s3, n3);
    assert.equal(r3.added.length, 14, 'the addon\'s unknown root is looked through');
    assert.deepEqual(r3.skipped, []);
    assert.equal(s3.nodes.get(s3.nodes.get(s3.byName.get('bip01 attachweapon')).parent).name, 'Bip01');
  }
  // the three addons (male, female, beast) carry the same fourteen
  for (const dir of ['xbase_anim_female', 'xbase_animkna']) {
    const { skel: s2 } = retailSkeleton();
    const other = parseNif(bytes(`Animations/${dir}/xbase_anim_sh.nif`));
    assert.deepEqual([...injectSkeletonNodes(s2, other).added].sort(), Object.keys(ADDON_BONES).sort(), dir);
  }
});

test('WS1: a scabbard file flattens by subtree - under the weapon node, or everything but it - with the full chain kept', () => {
  const nif = parseNif(LONGSWORD);
  const all = flattenNif(nif);
  const weapon = flattenNif(nif, { underNode: SHEATH_WEAPON_NODE });
  const rest = flattenNif(nif, { excludeNode: SHEATH_WEAPON_NODE });
  assert.ok(weapon.length > 0 && rest.length > 0, 'both halves carry geometry');
  assert.equal(weapon.length + rest.length, all.length, 'the two halves are the file');
  // every shape in the file is nameless, so the halves are matched by their vertices: the transform is
  // composed from the root either way, and the two halves partition the file
  const key = (b) => `${b.positions.length}:${[...b.positions.slice(0, 6)].map((v) => v.toFixed(4)).join(',')}`;
  assert.deepEqual([...weapon.map(key), ...rest.map(key)].sort(), all.map(key).sort());
  assert.deepEqual(flattenNif(nif, { underNode: 'no such node' }), []);
  assert.equal(flattenNif(nif, { excludeNode: 'no such node' }).length, all.length);
  assert.deepEqual(weapon.map((b) => b.positions.length), [56 * 3, 48 * 3, 18 * 3, 15 * 3], 'the four shapes under the weapon node');
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

/** The archive the resolver reads: the vendored meshes by canonical path. */
function vendoredFind() {
  const files = new Map();
  const dir = new URL(`${VENDOR}Meshes/w/`, root);
  for (const f of readdirSync(dir)) files.set(`meshes/w/${f}`, new Uint8Array(readFileSync(new URL(f, dir))));
  const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase();   // the real archives normalise the slash, so does this stand-in
  const arc = { has: (p) => files.has(norm(p)), get: (p) => files.get(norm(p)) };
  return (p) => (arc.has(p) ? arc : null);
}
const WEAPON = new Uint8Array([9, 9, 9]);   // the base mesh's bytes, never parsed by the resolver
const ARROW = new Uint8Array([7, 7]);
const hasAll = () => true;

test('WS1: the holster\'s decisions - scabbard less its weapon node plus the weapon node; no scabbard: the base mesh; no weapon node: the whole scabbard; thrown, none and no bone', () => {
  const find = vendoredFind();
  const sword = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif });
  assert.deepEqual(sword.parts.map((p) => [p.slot, p.bones[0], p.underNode ?? null, p.excludeNode ?? null]), [
    ['sheath', 'Bip01 LongBladeOneHand', null, SHEATH_WEAPON_NODE],
    ['holster', 'Bip01 LongBladeOneHand', SHEATH_WEAPON_NODE, null],
  ]);
  assert.equal(sword.parts[0].bytes, sword.parts[1].bytes, 'one file, two subtrees');
  assert.deepEqual(sword.info, { bone: 'Bip01 LongBladeOneHand', scabbard: 'meshes/w\\w_iron_longsword_sh.nif', weaponNode: true, weaponNodeEmpty: false, quiver: 0 });
  assert.deepEqual(sword.notes, []);
  const bare = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.BluntOneHand, weaponModel: 'w\\w_no_such_club.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif });
  assert.deepEqual(bare.parts.map((p) => [p.slot, p.bones[0], p.bytes]), [['holster', 'Bip01 BluntOneHand', WEAPON]]);
  assert.equal(bare.info.scabbard, null);
  // the Crescent's weapon node is a NiBSAnimationNode with the blade under it and an EMPTY sheath node: still the two parts
  const crescent = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeTwoHand, weaponModel: 'w\\w_art_blade_crescent.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif });
  assert.deepEqual(crescent.parts.map((p) => [p.slot, p.underNode ?? null, p.excludeNode ?? null]), [['sheath', null, SHEATH_WEAPON_NODE], ['holster', SHEATH_WEAPON_NODE, null]]);
  assert.equal(findNodeByName(parseNif(CRESCENT), SHEATH_WEAPON_NODE).rec.type, 'NiBSAnimationNode');
  // no weapon node at all: the file stands whole, no holster (a stand-in file with the node renamed)
  const cres = parseNif(CRESCENT);
  const renamed = { records: cres.records.map((r) => (String(r?.name).toLowerCase() === 'bip01 weapon' ? { ...r, name: 'Blade' } : r)), roots: cres.roots };
  const whole = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeTwoHand, weaponModel: 'w\\w_art_blade_crescent.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif: () => renamed });
  assert.deepEqual(whole.parts.map((p) => [p.slot, p.underNode ?? null, p.excludeNode ?? null]), [['sheath', null, null]]);
  assert.equal(whole.info.weaponNode, false);
  // a SHAPE named as the weapon node is not found (findNodeByName's recorded delta on geometry): the file stands whole
  const geomNode = { records: cres.records.map((r) => (String(r?.name).toLowerCase() === 'bip01 weapon' ? { ...r, type: 'NiTriShape' } : r)), roots: cres.roots };
  assert.equal(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeTwoHand, weaponModel: 'w\\w_art_blade_crescent.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif: () => geomNode }).info.weaponNode, false);
  assert.deepEqual(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanThrown, weaponModel: 'w\\w_dart.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif }).parts, []);
  assert.deepEqual(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.None, weaponModel: 'w\\x.nif', weaponBytes: WEAPON, find, hasBone: hasAll, parseNif }).parts, []);
  assert.deepEqual(resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: null, weaponBytes: WEAPON, find, hasBone: hasAll, parseNif }).parts, []);
  const noBone = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: WEAPON, find, hasBone: () => false, parseNif });
  assert.deepEqual(noBone.parts, []); assert.match(noBone.notes[0], /no "Bip01 LongBladeOneHand"/);
  // a scabbard that will not parse: the base mesh, and a note
  const broken = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: WEAPON, find: () => ({ get: () => new Uint8Array([1, 2, 3]) }), hasBone: hasAll, parseNif });
  assert.deepEqual(broken.parts.map((p) => p.slot), ['holster']); assert.equal(broken.parts[0].bytes, WEAPON); assert.match(broken.notes[0], /^holster: /);
});

test('WS1: an empty weapon node takes the base mesh under the node\'s own transform, bare, on the scabbard\'s offset', () => {
  // no vendored file has an empty weapon node (the census below says so), so one is asked through a stand-in find
  const nif = parseNif(LONGSWORD);
  const at = nif.records.findIndex((r) => r?.type === 'NiNode' && r.name === SHEATH_WEAPON_NODE);
  assert.ok(at > 0);
  const fakeNif = { records: nif.records.map((r, i) => (i === at ? { ...r, children: [] } : r)), roots: nif.roots };
  const parse = () => fakeNif;
  const r = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: WEAPON, find: vendoredFind(), hasBone: hasAll, parseNif: parse });
  const holster = r.parts.find((p) => p.slot === 'holster');
  assert.equal(holster.bytes, WEAPON); assert.equal(holster.bare, true); assert.equal(holster.inheritOffsetFrom, 'sheath');
  assert.ok(holster.preTransform && holster.preTransform.a.length === 9);
  assert.equal(r.info.weaponNodeEmpty, true);
});

test('WS1: the quiver - one arrow per "Bip01 Ammo N" up to the count, arrows for a bow and bolts for a crossbow, none for the wrong round or no round', () => {
  const find = vendoredFind();
  const bow = (ammo, ammoCount) => resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanBow, weaponModel: 'w\\w_longbow.nif', weaponBytes: WEAPON, ammo, ammoCount, find, hasBone: hasAll, parseNif });
  const three = bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Arrow }, 3);
  const q = three.parts.filter((p) => p.slot === 'quiver');
  assert.equal(q.length, 3); assert.equal(three.info.quiver, 3);
  for (const p of q) { assert.equal(p.bytes, ARROW); assert.equal(p.bare, true); assert.equal(p.inheritOffsetFrom, 'sheath'); assert.equal(p.bones[0], 'Bip01 MarksmanBow'); assert.ok(p.preTransform); }
  assert.notDeepEqual([...q[0].preTransform.t], [...q[1].preTransform.t], 'each under its own slot');
  const nif = parseNif(LONGBOW);
  const slots = findNodeByName(nif, SHEATH_AMMO_NODE).rec.children.filter((c) => c >= 0).length;
  assert.equal(slots, 7);
  assert.equal(bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Arrow }, Number.MAX_SAFE_INTEGER).info.quiver, 7, 'never more than the quiver holds');
  assert.equal(bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Arrow }, 0).info.quiver, 0);
  assert.equal(bow({ bytes: ARROW, type: MW_WEAPON_TYPE.Bolt }, 5).info.quiver, 0, 'bolts are not a bow\'s round');
  assert.equal(bow(null, 5).info.quiver, 0);
  const xbow = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanCrossbow, weaponModel: 'w\\w_crossbow.nif', weaponBytes: WEAPON, ammo: { bytes: ARROW, type: MW_WEAPON_TYPE.Bolt }, ammoCount: 4, find, hasBone: hasAll, parseNif });
  assert.equal(xbow.info.quiver, 4);
  // the sheath binds first, so the bare parts find its offset (bindPartsInto's order)
  assert.equal(three.parts[0].slot, 'sheath');
});

test('WS1: the whole assembly - the addon in, the scabbard and the holster placed at the injected bone, the quiver on the bow', async () => {
  const find = vendoredFind();
  const sword = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.LongBladeOneHand, weaponModel: 'w\\w_iron_longsword.nif', weaponBytes: LONGSWORD, find, hasBone: hasAll, parseNif });
  // the retail skeleton cannot be written back as a file, so the addon file itself stands as the skeleton (it carries the retail hierarchy) and is ALSO the bone source: every node known, nothing added, nothing lost
  const arm = await assembleFirstPersonArm({ skeletonBytes: ADDON, parts: sword.parts, boneSources: [{ name: 'animations/xbase_anim/xbase_anim_sh.nif', bytes: ADDON }] });
  assert.ok(arm.ok, `the assembly: ${arm.error}`);
  assert.deepEqual(arm.injected, [{ name: 'animations/xbase_anim/xbase_anim_sh.nif', added: [], skipped: [] }]);
  const slots = arm.pieces.map((p) => p.slot);
  assert.ok(slots.includes('sheath') && slots.includes('holster'), `slots ${slots}`);
  assert.deepEqual([slots.filter((x) => x === 'sheath').length, slots.filter((x) => x === 'holster').length], [4, 4], 'the file\'s eight shapes, four a side - each subtree once');
  for (const p of arm.pieces) { assert.equal(p.kind, 'rigid'); assert.equal(p.mirrored, false); assert.equal(p.bone, 'Bip01 LongBladeOneHand'); assert.ok(p.positions.every(Number.isFinite), 'finite positions'); }
  assert.ok(!arm.notes.some((n) => /holster|sheath/.test(n)), arm.notes.join('; '));
  const bow = resolveHolsterParts({ mwType: MW_WEAPON_TYPE.MarksmanBow, weaponModel: 'w\\w_longbow.nif', weaponBytes: LONGBOW, ammo: { bytes: LONGSWORD, type: MW_WEAPON_TYPE.Arrow }, ammoCount: 2, find, hasBone: hasAll, parseNif });
  const arm2 = await assembleFirstPersonArm({ skeletonBytes: ADDON, parts: bow.parts, boneSources: [] });
  assert.ok(arm2.ok, `the bow's assembly: ${arm2.error}`);
  const quiver = arm2.pieces.filter((p) => p.slot === 'quiver');
  assert.ok(quiver.length >= 2, 'the two rounds bound');
  assert.ok(quiver.every((p) => p.bone === 'Bip01 MarksmanBow' && p.boneOffset === null), 'bare, and the scabbard carries no BoneOffset');
  // an addon that will not parse is a note, not a refusal
  const arm3 = await assembleFirstPersonArm({ skeletonBytes: ADDON, parts: sword.parts, boneSources: [{ name: 'bad.nif', bytes: new Uint8Array([1, 2]) }] });
  assert.ok(arm3.ok, 'a bad addon is not a refusal'); assert.match(arm3.notes.find((n) => n.startsWith('bones: bad.nif')), /bad\.nif/);
});

test('WS1: the vendored tree - seventy-one scabbards and three addons, every one parses, every scabbard carries a sheath node and a weapon node with geometry, twelve quivers', () => {
  const dir = new URL(`${VENDOR}Meshes/w/`, root);
  const files = readdirSync(dir).filter((f) => f.endsWith('_sh.nif')).sort();
  assert.equal(files.length, 71);
  const quivers = [];
  const kinds = new Set();
  for (const f of files) {
    const nif = parseNif(new Uint8Array(readFileSync(new URL(f, dir))));
    assert.ok(findNodeByName(nif, 'Bip01 Sheath'), `${f}: Bip01 Sheath`);
    const w = findNodeByName(nif, SHEATH_WEAPON_NODE);
    assert.ok(w, `${f}: Bip01 Weapon`);
    kinds.add(w.rec.type);
    assert.ok(w.rec.children.some((c) => c >= 0), `${f}: a weapon node with geometry (none ships empty)`);
    const a = findNodeByName(nif, SHEATH_AMMO_NODE);
    if (a) quivers.push([f, a.rec.children.filter((c) => c >= 0).length]);
  }
  assert.deepEqual([...kinds].sort(), ['NiBSAnimationNode', 'NiNode'], 'the Crescent\'s weapon node is an animation node');
  assert.deepEqual(quivers, [
    ['w_art_longbow_shade_sh.nif', 5], ['w_crossbow_dwemer_sh.nif', 6], ['w_crossbow_sh.nif', 6], ['w_crossbow_steel_sh.nif', 6], ['w_huntsman_crossbow_sh.nif', 6],
    ['w_longbow_ariel_sh.nif', 6], ['w_longbow_bonemold_sh.nif', 6], ['w_longbow_daedric_sh.nif', 7], ['w_longbow_sh.nif', 7], ['w_longbow_steel_sh.nif', 7],
    ['w_shortbow_chitin_sh.nif', 7], ['w_shortbow_steel_sh.nif', 7],
  ]);
  for (const d of ['xbase_anim', 'xbase_anim_female', 'xbase_animkna']) assert.ok(parseNif(bytes(`Animations/${d}/xbase_anim_sh.nif`)).records.length > 0, d);
  assert.match(rd('vendor/weapon-sheathing/README.md'), /Greatness7/);
  assert.match(rd('vendor/weapon-sheathing/WeaponSheathing.txt'), /^Weapon Sheathing\s+By Greatness7/);
});

test('WS1: the vendored archive duck and its canonical paths; the bone-source listing; the loose store keys animations/', async () => {
  assert.equal(vendoredDataPath('../../vendor/weapon-sheathing/Data Files/Meshes/w/W_Saber_sh.nif'), 'meshes/w/w_saber_sh.nif');
  assert.equal(vendoredDataPath('vendor\\weapon-sheathing\\Data Files\\Animations\\xbase_anim\\xbase_anim_sh.nif'), 'animations/xbase_anim/xbase_anim_sh.nif');
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
  // node: no window, an empty table, an archive that has nothing
  assert.deepEqual(WEAPON_SHEATHING_URLS, {}); assert.equal(weaponSheathingArchive().has('meshes/w/w_saber_sh.nif'), false);
  assert.equal(weaponSheathingArchive(), weaponSheathingArchive());
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
  assert.match(fp, /const boneSourcePaths = boneSourcesFor\(TP_BASE_MODEL, skeletonPath, archives\);/);
  assert.match(fp, /const arm = await assembleFirstPersonArm\(\{ skeletonBytes, parts: partBytes, boneSources \}\);/);
  assert.match(fp, /hasBone: boneProbe\(skeletonBytes, boneSources\), parseNif: parseNifOnce,/);
  assert.match(fp, /ammoCount: ammoCount \?\? \(hasAmmo \? Number\.MAX_SAFE_INTEGER : 0\),/g);
  assert.equal((fp.match(/ammoCount: ammoCount \?\? \(hasAmmo \? Number\.MAX_SAFE_INTEGER : 0\),/g) || []).length, 2, 'the build and the swap');
  assert.match(fp, /const swapped = new Set\(\['weapon', 'arrow', \.\.\.HOLSTER_SLOTS\]\);/);
  assert.match(fp, /bindPartsInto\(t\.arm, \[\.\.\.tResolved\.parts, \.\.\.tHolster\.parts\]\);/);
  assert.equal((fp.match(/else if \(HOLSTER_SLOTS\.includes\(r\.slot\)\) r\.hidden = holsterHidden\(r\.slot, weaponShown\);/g) || []).length, 1, 'the world draw');
  assert.equal((fp.match(/else if \(HOLSTER_SLOTS\.includes\(r\.slot\)\) r\.hidden = holsterHidden\(r\.slot, true\);/g) || []).length, 1, 'the portrait: the weapon is in the hand');
  assert.match(fp, /sheathing = true, ammoCount = null,/);
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /sheathing: getPref\('mwSheathing'\),/); assert.match(rig, /ammoCount: daggerfallArrowCount\(entity\.items\),/);
  const feat = rd('src/systems/features.js');
  assert.match(feat, /id: 'mod-weapon-sheathing',/);
  assert.match(feat, /control: Object\.freeze\(\{ store: 'prefs', key: 'mwSheathing', initial: true, online: true \}\),/, 'RF4: the switch declared once, on its row, on by default and forced on online');
  assert.ok(!/mwSheathing: (true|false),/.test(rd('src/systems/uiPrefs.js')), 'and not on the shelf');
  assert.match(rd('src/ui/enhancedMenu.js'), /prefRow\('mwSheathing', 'Weapon sheathing',/);
  const ds = rd('src/scenes/dataSource.js');
  const loosePush = ds.indexOf('archives.push(makeLooseArchive(loose));');
  const vendPush = ds.indexOf('archives.push(ws.weaponSheathingArchive());');
  const bsaPush = ds.indexOf('archives.push(await MwBsaFile.open(blob));');
  assert.ok(loosePush > 0 && vendPush > loosePush && bsaPush > vendPush, 'loose, then vendored, then the .bsa archives');
  assert.match(ds, /'animations\/'\]/);
  assert.match(rd('vite.config.js'), /eye-of-the-beholder\|immersive-footsteps\|weapon-sheathing/);
  assert.match(rd('src/formats/mwFirstPerson.js'), /if \(part\.slot === 'sheath'\) sheathBoneOffset = bound\.boneOffset \|\| null;/);
});
