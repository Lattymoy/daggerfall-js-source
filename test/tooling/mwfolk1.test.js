// MW-FOLK1 (2026-10-13, the owner: "This is for the Townspeople outfits"; asked, each walker sprite's own outfit in that
// sprite's colours): THE TOWNSFOLK'S OUTFITS FOR THE MORROWIND BODY.
//
// One export of nine objects, each a sprite's whole outfit, committed less the 61 polygons of Morrowind's own groin one
// of them carried (tools/fbxStrip.mjs's cut); fourteen paintings; eleven outfits, each baked into one skinned part in the
// pose the outfits were made in (the symmetric pack's - its clavicles level, its arms falling half a unit to the
// wrist), each garment piece weighted by what it is, the hoods raised onto the game's head. A walker whose sprite has
// an outfit wears it - hiding the skin it covers all round, as a gauntlet hides its forearm - and the wardrobe dresses
// every other sprite as before. bible/04-Characters/Townsfolk-Outfits.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { flattenNif } from '../../src/formats/morrowind/mwNifMesh.js';
import { decodeTextureImage } from '../../src/formats/morrowind/mwTexture.js';
import { assembleFirstPersonArm, poseAssembly, playerBodyRows, bodyParts } from '../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor, composeWornModest, ARMO_PART } from '../../src/formats/morrowind/mwItemMap.js';
import { PART_BONES } from '../../src/formats/morrowind/mwNpc.js';
import { TOWNSFOLK_OUTFITS, townsfolkOutfitOf, ownOutfitFor, ownOutfitModelPaths, isOutfitSlot } from '../../src/characters/ownModels/ownClothingModels.js';
import { folkLookOf, spriteSex } from '../../src/characters/folkBodies.js';
import { residentLook } from '../../src/characters/rosterBodies.js';
import { PERSON_TEXTURES, GUARD_TEXTURE } from '../../src/characters/mobile/mobilePerson.js';
import { GENDERS } from '../../src/characters/nameHelper.js';
import { peerBuildOpts, peerBodyKey, outfitKeyOf } from '../../src/net/peer/peerBodies.js';
import { bareHeadRows, wornVerdicts, wornEquipKeyOf, buildFpArm } from '../../src/combat/fpArm.js';
import { npcHint } from '../../src/characters/wardrobe.js';
import { ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { bodyRec, retailBodyDeps, shippedArchive } from '../fixtures/mw/bodyRig.mjs';
import { readPng } from '../../tools/pngIO.mjs';
import { readFbx } from '../../tools/fbxRead.mjs';
import { stripFbx, meshModelNames } from '../../tools/fbxStrip.mjs';
import { S, I, dArr, iArr, writeFbx } from '../../tools/fbxWrite.mjs';   // AUDIT MW-FOLK1: the cut's refusals, on files written here
import { bakeMesh, objectMaterials } from '../../tools/fbxMesh.mjs';
import { objectTree, plateBind, RETAIL_SKELETON, HELM_LIFT, SCENE_BODY } from '../../tools/bakeSteelPlate.mjs';
import { SOURCE, PAINTINGS, OBJECTS, OUTFITS, RECOLOURS, CUT, PACK_ARM_FALL, HANG_TOP, HANG_SHARE, HANG_CENTRE, KNEE_BLEND, HIP_JOINTS, ARM_REACH, ARM_FADE, RIGS,
  packBind, hangOf, islandsOf, islandClass, liftHoods, materialMesh, checkObject, bakeTownsfolk, meshFile, textureFile, textureName } from '../../tools/bakeTownsfolk.mjs';
import { segmentDistance } from '../../tools/skinWeights.mjs';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';

const raw = (p) => readFileSync(new URL(`../../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const SKELETON = raw(RETAIL_SKELETON);
const tree = readFbx(raw(SOURCE));
const nifOf = (archive) => flattenNif(parseNif(onDisk(meshFile(archive))));
const ARCHIVES = [381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 398];
const outfitOf = (archive) => OUTFITS.find((o) => o.archive === archive);
/** Each shape's mesh as the bake reads it - its islands, its classes, the lifted hoods - index for index the NIF's. */
const shapeMeshes = new Map();
const shapeMesh = (o, s) => {
  const k = `${o.object}|${s.material}`;
  if (!shapeMeshes.has(k)) shapeMeshes.set(k, liftHoods(materialMesh(tree, o.object, s.material)));
  return shapeMeshes.get(k);
};
/** How many polygons of an object wear a material slot (0 where none does). */
const polygonsOf = (name, material) => {
  try {
    return bakeMesh(objectTree(tree, name), { name, placement: 'scene', forward: '+y', up: '+z', material }).bake.polygons;
  } catch (err) {
    if (/no polygon of this object wears material/.test(err.message)) return 0;
    throw err;
  }
};

test('MW-FOLK1: every outfit and painting re-made from the committed export, its fourteen paintings and retail\'s skeleton byte for byte, each DDS its painting; the export the owner\'s less Morrowind\'s own skin - every polygon it carries wears an owner\'s painting', () => {
  const baked = bakeTownsfolk({ source: raw(SOURCE), pngs: Object.fromEntries(Object.entries(PAINTINGS).map(([paint, p]) => [paint, raw(p.png)])), skeleton: SKELETON });
  assert.deepEqual(baked.outfits.map((o) => o.archive), ARCHIVES);
  for (const o of baked.outfits) {
    assert.equal(Buffer.compare(Buffer.from(o.nif), raw(meshFile(o.archive))), 0, `${meshFile(o.archive)} is not what tools/bakeTownsfolk.mjs makes - re-run it`);
    const batches = nifOf(o.archive);
    assert.deepEqual(batches.map((b) => [b.name, b.material.textureFile, b.skinned]), outfitOf(o.archive).shapes.map((s, i) => [`Tri Chest ${i}`, textureName(s.paint), true]),
      `${o.archive}: a skinned shape a painting, each its own`);
  }
  for (const t of baked.textures) {
    assert.equal(Buffer.compare(Buffer.from(t.dds), raw(textureFile(t.paint))), 0, `${textureFile(t.paint)} is not what the bake makes`);
    assert.deepEqual(Array.from(decodeTextureImage(textureFile(t.paint), onDisk(textureFile(t.paint))).mips[0].rgba), Array.from(t.png.data), `the ${t.paint} DDS is its painting`);
  }
  assert.deepEqual(Object.fromEntries(baked.textures.map((t) => [t.paint, t.png.width])), {
    tunic_bretonnpc: 256, hose_bretonnpc: 256, sleeves_bretonnpc: 256, tunic_nord1: 256, breeches_nord1: 256, tunic_nord2: 256, tunic_nord3: 256,
    shoulders_nord3: 256, kit_redguard1: 128, skirt_redguard2: 128, boots_redguard2: 128, robe_redguard3: 128, robe_redguard4: 128, dress_redguardwoman1: 256,
  });
  assert.ok(baked.textures.every((t) => t.png.height === t.png.width), 'square');
  // the export: clothes.fbx (sha256 ac676b04...) less the 61 polygons tools/fbxStrip.mjs cut (CUT) - nothing else
  assert.equal(sha(SOURCE), '91ac4544ebb7371c6c63a7628464647864158db748db80f79fa6edf830639368');
  assert.deepEqual(meshModelNames(raw(SOURCE)), Object.keys(OBJECTS));
  assert.deepEqual(Object.keys(OBJECTS), ['Breton_Male.018', 'Breton_Male.028', 'Breton_Male.038', 'Plane Remeshed', 'Redguard_Male.002', 'Redguard_Male.003',
    'Redguard_Male.007', 'Redguard_Male.010', 'Redguard_Male.028']);
  assert.deepEqual(Object.fromEntries(Object.entries(PAINTINGS).map(([paint, p]) => [paint, sha(p.png).slice(0, 16)])), {
    tunic_bretonnpc: '954544a22bc78f3d', hose_bretonnpc: '01788602101e9f20', sleeves_bretonnpc: 'd3e12f028cbfb4ac', tunic_nord1: 'f014ad01ab3cfd85',
    breeches_nord1: '508a99a73d029079', tunic_nord2: '90a1bfed628fa290', tunic_nord3: '5a06f42439427218', shoulders_nord3: '14d26abdf3a433a9',
    kit_redguard1: 'cb2dddf6c411e267', skirt_redguard2: '5e9dcfa12a26dcfa', boots_redguard2: '4acc09a67dba60e0', robe_redguard3: 'd3facf7da199ff40',
    robe_redguard4: '32308e4647f6941c', dress_redguardwoman1: 'a3cd1f7c5d3b05f9',
  });
  // every material slot that carries a polygon is one of the owner's paintings, and every painting is worn; the cut
  // slot - Morrowind's own groin painting - carries none
  const owners = new Set(Object.values(PAINTINGS).map((p) => p.named));
  const worn = new Set();
  for (const name of Object.keys(OBJECTS)) {
    assert.deepEqual(checkObject(tree, name), OBJECTS[name].materials, `${name}: the pictures it names, where it was read`);
    OBJECTS[name].materials.forEach((m, i) => {
      if (!polygonsOf(name, i)) return;
      assert.ok(owners.has(m), `${name} material ${i} (${m}): a polygon wears it, so it is an owner's painting`);
      worn.add(m);
    });
  }
  assert.deepEqual([...owners].filter((m) => !worn.has(m)), [], 'every painting is worn by a polygon of the export');
  assert.deepEqual(CUT, { 'Breton_Male.018': [6] });
  for (const [name, slots] of Object.entries(CUT)) {
    for (const i of slots) {
      assert.match(OBJECTS[name].materials[i], /\/tx_b_n_generic_m_g00\.png$/, 'the slot cut is Morrowind\'s own skin');
      assert.equal(polygonsOf(name, i), 0, `${name} material ${i}: no polygon wears it in the committed export`);
    }
  }
  // each shape wears the painting the export names on its material - but the two recolours
  assert.deepEqual(RECOLOURS, { 389: [0], 390: [10] });
  for (const o of OUTFITS) {
    for (const s of o.shapes) {
      const named = OBJECTS[o.object].materials[s.material];
      if ((RECOLOURS[o.archive] ?? []).includes(s.material)) assert.notEqual(PAINTINGS[s.paint].named, named, `${o.archive}: a recolour wears another painting`);
      else assert.equal(PAINTINGS[s.paint].named, named, `${o.archive} material ${s.material}: the painting the export names`);
    }
  }
  // a recolour is its twin's shapes, in another painting
  for (const [a, twin] of [[389, 388], [390, 386]]) {
    const [x, y] = [nifOf(a), nifOf(twin)];
    assert.deepEqual(x.map((b) => Array.from(b.positions)), y.map((b) => Array.from(b.positions)), `${a} is ${twin}'s outfit`);
    const differ = x.map((b, i) => b.material.textureFile !== y[i].material.textureFile);
    assert.deepEqual(differ.map((d, i) => (d ? outfitOf(a).shapes[i].material : null)).filter((m) => m !== null), RECOLOURS[a]);
  }
  assert.throws(() => bakeTownsfolk({ source: raw(SOURCE), pngs: {}, skeleton: null }), /no skeleton to skin the outfits in/);
  assert.throws(() => bakeTownsfolk({ source: raw(SOURCE), pngs: {}, skeleton: SKELETON }), /no painting for tunic_bretonnpc/);
  assert.throws(() => checkObject(tree, 'Breton_Male.003'), /no object "Breton_Male\.003" is read for an outfit/);
  // AUDIT MW-FOLK1 L3-F5: A RE-EXPORT THAT RESHAPED OR RE-PAINTED ONE IS REFUSED BY NAME - 385 less its hose stands short
  // of the box it was read at; a material renamed in place (same length, so the file still reads) names another picture
  const short = readFbx(stripFbx(raw(SOURCE), { cut: [{ object: 'Breton_Male.018', material: 0 }] }).bytes);
  assert.throws(() => checkObject(short, 'Breton_Male.018'), /"Breton_Male\.018" stands at .* not where it was read/);
  const bytes = Buffer.from(raw(SOURCE));
  const was = Buffer.from('bretonnpc\\Material.019', 'latin1');
  let n = 0;
  for (let at = bytes.indexOf(was); at >= 0; at = bytes.indexOf(was, at + 1), n++) Buffer.from('bretonnpc\\Material.091', 'latin1').copy(bytes, at);
  assert.equal(n, 5, 'the export names the tunic\'s painting five times (its two textures\' paths and its video\'s)');
  assert.throws(() => checkObject(readFbx(bytes), 'Breton_Male.018'), /"Breton_Male\.018" names .*Material\.091.* re-read the export before baking it/);
  for (const path of ownOutfitModelPaths()) assert.ok(existsSync(new URL(`../../src/assets/mw/${path}`, import.meta.url)), `${path} ships`);
});

test('MW-FOLK1: a cut takes one material\'s polygons out of an object that stays - its vertices, normals and UVs only they used, its edges kept from the polygons left, every array left in its order - and nothing else; an object\'s slots cut in one pass; a slot no polygon wears, a slot named twice, a whole object and a dropped one are refused', () => {
  // the mesh a material bakes to - its geometry and its polygons (the record's counts of the whole object's vertices and
  // corners are the object's, and the cut changed those)
  const bake = (t, name, material) => {
    const m = bakeMesh(objectTree(t, name), { name, placement: 'scene', forward: '+y', up: '+z', material });
    return JSON.stringify([m.positions, m.normals, m.uvs, m.indices, m.bounds, m.bake.polygons]);
  };
  const geometryOf = (t, name) => {
    const objects = t.nodes.find((n) => n.name === 'Objects');
    const model = objects.children.find((c) => c.name === 'Model' && String(c.props[1]).split('\0')[0] === name);
    const conns = t.nodes.find((n) => n.name === 'Connections').children;
    const ids = conns.filter((c) => c.name === 'C' && String(c.props[2]) === String(model.props[0])).map((c) => String(c.props[1]));
    return objects.children.find((c) => c.name === 'Geometry' && ids.includes(String(c.props[0])));
  };
  const src = raw(SOURCE);
  assert.equal(Buffer.compare(stripFbx(src, {}).bytes, src), 0, 'an empty strip is the file');
  // the committed export already carries no polygon of the cut slot
  assert.throws(() => stripFbx(src, { cut: [{ object: 'Breton_Male.018', material: 6 }] }), /"Breton_Male\.018": no polygon wears material 6 - nothing to cut/);
  assert.throws(() => stripFbx(src, { cut: [{ object: 'Plane Remeshed', material: 0 }] }), /every polygon wears material 0 - drop the object instead/);
  assert.throws(() => stripFbx(src, { drop: ['Plane Remeshed'], cut: [{ object: 'Plane Remeshed', material: 0 }] }), /a dropped object has nothing to cut/);
  assert.throws(() => stripFbx(src, { cut: [{ object: 'Breton_Male.003', material: 0 }] }), /no Model named "Breton_Male\.003"/);
  // a cut of 385's pouch (the kit painting, material 7) out of the committed export
  const { bytes, dropped, cut } = stripFbx(src, { cut: [{ object: 'Breton_Male.018', material: 7 }] });
  assert.deepEqual(dropped, []);
  assert.deepEqual(cut, [{ object: 'Breton_Male.018', materials: [7], polygons: [92], vertices: 97 }]);
  const after = readFbx(bytes);
  // EVERY ARRAY LEFT IN ITS ORDER: the vertices the source holds less those only the cut polygons used, as they stood
  const arrays = (t, name) => {
    const geo = geometryOf(t, name);
    const get = (n, parent = geo) => parent.children.find((c) => c.name === n).props[0];
    const uv = geo.children.find((c) => c.name === 'LayerElementUV');
    return { verts: get('Vertices'), pvi: get('PolygonVertexIndex'), mats: get('Materials', geo.children.find((c) => c.name === 'LayerElementMaterial')), uv: get('UV', uv), uvIdx: get('UVIndex', uv) };
  };
  const was = arrays(tree, 'Breton_Male.018'), now = arrays(after, 'Breton_Male.018');
  const corners = []; for (let k = 0, s = 0; k < was.pvi.length; k++) if (was.pvi[k] < 0) { corners.push([s, k]); s = k + 1; }
  const cutCorner = new Set(corners.flatMap(([a, b], p) => (was.mats[p] === 7 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [])));
  const vAt = (k) => (was.pvi[k] < 0 ? ~was.pvi[k] : was.pvi[k]);
  const onlyCut = (of) => { const theirs = new Set([...cutCorner].map(of)); for (let k = 0; k < was.pvi.length; k++) if (!cutCorner.has(k)) theirs.delete(of(k)); return theirs; };
  const goneV = onlyCut(vAt), goneUv = onlyCut((k) => was.uvIdx[k]);
  assert.equal(goneV.size, 97);
  assert.deepEqual(Array.from(now.verts), Array.from(was.verts).filter((_, i) => !goneV.has(Math.floor(i / 3))), 'the vertices left, in their order');
  assert.deepEqual(Array.from(now.uv), Array.from(was.uv).filter((_, i) => !goneUv.has(Math.floor(i / 2))), 'the UV table left, in its order');
  assert.deepEqual(Array.from(now.mats), Array.from(was.mats).filter((m) => m !== 7), 'each polygon left its material');
  // AN OBJECT'S SLOTS IN ONE PASS (AUDIT MW-FOLK1 L1-F1: a second cut of one object re-wrote the first's arrays from the
  // file as it was - the first slot's polygons came back, both reported cut)
  const two = stripFbx(src, { cut: [{ object: 'Breton_Male.018', material: 7 }, { object: 'Breton_Male.018', material: 2 }] });
  assert.deepEqual(two.cut, [{ object: 'Breton_Male.018', materials: [7, 2], polygons: [92, 510], vertices: 379 }]);
  const both = readFbx(two.bytes);
  assert.deepEqual([7, 2].map((m) => { try { return bakeMesh(objectTree(both, 'Breton_Male.018'), { placement: 'scene', forward: '+y', up: '+z', material: m }).bake.polygons; } catch { return 0; } }), [0, 0], 'neither slot keeps a polygon');
  for (const m of [0, 1]) assert.equal(bake(both, 'Breton_Male.018', m), bake(tree, 'Breton_Male.018', m), `material ${m} bakes as it did`);
  assert.throws(() => stripFbx(src, { cut: [{ object: 'Breton_Male.018', material: 7 }, { object: 'Breton_Male.018', material: 7 }] }), /"Breton_Male\.018": material 7 named twice/);
  // A VERTEX NO POLYGON USES WAS NEVER THE CUT'S (AUDIT MW-FOLK1 L1-F9): Redguard_Male.010's two loose ones stay
  const red = stripFbx(src, { cut: [{ object: 'Redguard_Male.010', material: 2 }] });
  assert.deepEqual(red.cut, [{ object: 'Redguard_Male.010', materials: [2], polygons: [178], vertices: 197 }]);
  const loose = (t) => { const a = arrays(t, 'Redguard_Male.010'); return a.verts.length / 3 - new Set(Array.from(a.pvi, (v) => (v < 0 ? ~v : v))).size; };
  assert.deepEqual([loose(tree), loose(readFbx(red.bytes))], [2, 2]);
  for (const m of [0, 1, 2]) assert.equal(bake(after, 'Breton_Male.018', m), bake(tree, 'Breton_Male.018', m), `material ${m} bakes as it did`);
  assert.throws(() => bakeMesh(objectTree(after, 'Breton_Male.018'), { placement: 'scene', forward: '+y', up: '+z', material: 7 }), /no polygon of this object wears material 7/);
  assert.equal(bake(after, 'Plane Remeshed', 0), bake(tree, 'Plane Remeshed', 0), 'another object untouched');
  assert.deepEqual(objectMaterials(after, 'Breton_Male.018'), objectMaterials(tree, 'Breton_Male.018'), 'the slot stays - every index as it was');
  // the edges: exactly the edges of the polygons left, each once - in the committed export (cut once) and cut again
  // the galleon's hull (the one committed export whose materials share edges): 65 of the edges its material 10 shares
  // with material 0 are written from material 10's corners - a cut of 10 must write them again from 0's
  const ship = readFbx(stripFbx(raw('src/assets/galleon/source/New_Ship.fbx'), { cut: [{ object: 'Cube', material: 10 }] }).bytes);
  for (const [t, name] of [[tree, 'Breton_Male.018'], [after, 'Breton_Male.018'], [ship, 'Cube']]) {
    const geo = geometryOf(t, name);
    const pvi = geo.children.find((c) => c.name === 'PolygonVertexIndex').props[0];
    const edges = geo.children.find((c) => c.name === 'Edges').props[0];
    const v = (k) => (pvi[k] < 0 ? ~pvi[k] : pvi[k]);
    const next = []; for (let k = 0, s = 0; k < pvi.length; k++) { next[k] = pvi[k] < 0 ? s : k + 1; if (pvi[k] < 0) s = k + 1; }
    const key = (k) => [v(k), v(next[k])].sort((a, b) => a - b).join();
    const want = new Set(pvi.map((_, k) => key(k)));
    const have = edges.map(key);
    assert.equal(new Set(have).size, have.length, 'each edge once');
    assert.deepEqual(new Set(have), want, 'the polygons\' own edges, and no other');
    const vertices = geo.children.find((c) => c.name === 'Vertices').props[0].length / 3;
    assert.deepEqual([...new Set(pvi.map((_, k) => v(k)))].length, vertices, 'every vertex left is used');
  }
});

/**
 * AUDIT MW-FOLK1 (L3-F8): A CUT'S GEOMETRY, WRITTEN HERE - a quad and two triangles over five positions and one loose
 * one, the quad wearing material 1: its own corner the only one on UV entry 0 and position 0 its alone; normals Direct
 * with their W. `geo` changes one record of the Geometry, `objects` and `links` add to the file.
 */
function cutFixture({ geo = (g) => g, objects = [], links = [] } = {}) {
  const verts = [0, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 2, 2, 0, 0, 9, 9, 9];
  const pvi = [0, 1, 2, ~3, 1, 4, ~2, 3, 2, ~4];
  const layer = (name, map, ref, rows) => ({ name, props: [I(0)], children: [{ name: 'MappingInformationType', props: [S(map)] }, { name: 'ReferenceInformationType', props: [S(ref)] }, ...rows] });
  const children = geo([
    { name: 'Vertices', props: [dArr(verts)] },
    { name: 'PolygonVertexIndex', props: [iArr(pvi)] },
    layer('LayerElementNormal', 'ByPolygonVertex', 'Direct', [{ name: 'Normals', props: [dArr(Array.from({ length: 30 }, (_, i) => i))] }, { name: 'NormalsW', props: [dArr(Array.from({ length: 10 }, (_, i) => 100 + i))] }]),
    layer('LayerElementUV', 'ByPolygonVertex', 'IndexToDirect', [{ name: 'UV', props: [dArr([0.9, 0.9, 0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0.5])] }, { name: 'UVIndex', props: [iArr([0, 2, 3, 4, 2, 1, 3, 4, 5, 1])] }]),
    layer('LayerElementMaterial', 'ByPolygon', 'IndexToDirect', [{ name: 'Materials', props: [iArr([1, 0, 0])] }]),
    { name: 'Layer', props: [I(0)] },
  ]);
  return writeFbx([
    { name: 'Objects', children: [
      { name: 'Geometry', props: [I(1), S('Fixture\u0000\u0001Geometry'), S('Mesh')], children },
      { name: 'Model', props: [I(2), S('Fixture\u0000\u0001Model'), S('Mesh')] },
      ...objects,
    ] },
    { name: 'Connections', children: [[1, 2], ...links].map(([c, p]) => ({ name: 'C', props: [S('OO'), I(c), I(p)] })) },
  ], 7400, { blender: true });
}

test('MW-FOLK1 (AUDIT): a cut on a file written here - its loose vertex kept, its Direct normals and their W kept corner for corner, an index table kept to the entries still used and re-pointed; a Geometry a deformer or another object hangs from, or holding what a cut does not read, refused by name; the command line cuts what the call does', () => {
  const at = (t, name) => {
    const geo = t.nodes.find((n) => n.name === 'Objects').children.find((c) => c.name === 'Geometry');
    const el = (n) => geo.children.find((c) => c.name === n);
    return name.includes('/') ? el(name.split('/')[0]).children.find((c) => c.name === name.split('/')[1]).props[0] : el(name).props[0];
  };
  const { bytes, cut } = stripFbx(cutFixture(), { cut: [{ object: 'Fixture', material: 1 }] });
  assert.deepEqual(cut, [{ object: 'Fixture', materials: [1], polygons: [1], vertices: 1 }], 'position 0 was the quad\'s alone');
  const t = readFbx(bytes);
  assert.deepEqual(Array.from(at(t, 'Vertices')), [1, 0, 0, 1, 0, 2, 0, 0, 2, 2, 0, 0, 9, 9, 9], 'positions 1-4 and the loose one, in their order');
  assert.deepEqual(Array.from(at(t, 'PolygonVertexIndex')), [0, 3, ~1, 2, 1, ~3], 'the triangles, re-pointed');
  assert.deepEqual(Array.from(at(t, 'LayerElementNormal/Normals')), Array.from({ length: 18 }, (_, i) => 12 + i), 'Direct normals: the kept corners\', in order');
  assert.deepEqual(Array.from(at(t, 'LayerElementNormal/NormalsW')), [104, 105, 106, 107, 108, 109], '...and their W');
  assert.deepEqual(Array.from(at(t, 'LayerElementUV/UV')), [0, 0, 1, 0, 1, 1, 0, 1, 0.5, 0.5], 'entry 0 was the quad corner\'s alone');
  assert.deepEqual(Array.from(at(t, 'LayerElementUV/UVIndex')), [1, 0, 2, 3, 4, 0], '...the rest re-pointed');
  assert.deepEqual(Array.from(at(t, 'LayerElementMaterial/Materials')), [0, 0]);
  // the refusals, each by name
  const refuse = (opts, cutOf, re) => assert.throws(() => stripFbx(cutFixture(opts), { cut: cutOf }), re);
  const one = [{ object: 'Fixture', material: 1 }];
  const swap = (name, rec) => (g) => g.map((c) => (c.name === name ? rec(c) : c));
  const mapped = (name, map, ref = null) => swap(name, (c) => ({ ...c, children: c.children.map((k) => (k.name === 'MappingInformationType' ? { ...k, props: [S(map)] } : k.name === 'ReferenceInformationType' && ref ? { ...k, props: [S(ref)] } : k)) }));
  refuse({}, [{ object: 'Fixture', material: 1 }, { object: 'Fixture', material: 0 }], /every polygon wears material 1 or 0 - drop the object instead/);
  refuse({}, [{ object: 'Fixture', material: 4 }], /no polygon wears material 4 - nothing to cut/);
  refuse({ objects: [{ name: 'Model', props: [I(3), S('Twin\u0000\u0001Model'), S('Mesh')] }], links: [[1, 3]] }, one, /Geometry is another object's too - a cut would cut both/);
  refuse({ objects: [{ name: 'Deformer', props: [I(4), S('Skin\u0000\u0001Deformer'), S('Skin')] }], links: [[4, 1]] }, one, /Geometry carries a Deformer that names its vertices by their index - a cut would leave it on the old numbering: refused/);
  refuse({ geo: (g) => [...g, { name: 'LayerElementSmoothing', props: [I(0)] }] }, one, /its Geometry holds "LayerElementSmoothing", which a cut does not know/);
  refuse({ geo: mapped('LayerElementMaterial', 'ByPolygon', 'Direct') }, one, /materials are not mapped ByPolygon, IndexToDirect/);
  refuse({ geo: swap('LayerElementMaterial', (c) => ({ ...c, children: c.children.map((k) => (k.name === 'Materials' ? { ...k, props: [iArr([1, 0])] } : k)) })) }, one, /2 material indices for 3 polygons/);
  refuse({ geo: mapped('LayerElementNormal', 'ByVertice') }, one, /its LayerElementNormal is not mapped ByPolygonVertex/);
  refuse({ geo: mapped('LayerElementUV', 'ByPolygonVertex', 'Direct') }, one, /its LayerElementUV is referenced Direct yet carries a UVIndex/);
  refuse({ geo: swap('LayerElementNormal', (c) => ({ ...c, children: c.children.map((k) => (k.name === 'Normals' ? { ...k, props: [dArr([0, 0, 1])] } : k)) })) }, one, /its Normals is not one value a corner/);
  refuse({ geo: swap('PolygonVertexIndex', (c) => ({ ...c, props: [iArr([0, 1, 2, ~3, 1, 4, ~2, 3, 2, 4])] })) }, one, /its PolygonVertexIndex does not close its last polygon/);
  // THE COMMAND LINE cuts what the call does (the doc's own `--cut=Breton_Male.018:6` made the committed export)
  const dir = mkdtempSync(join(tmpdir(), 'mwfolk1-cut-'));
  try {
    const out = join(dir, 'cut.fbx');
    const run = spawnSync(process.execPath, [new URL('../../tools/fbxStrip.mjs', import.meta.url).pathname, new URL(`../../${SOURCE}`, import.meta.url).pathname, out, '--cut=Breton_Male.018:7,Breton_Male.018:2'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /cut "Breton_Male\.018" material 7: 92 polygons, material 2: 510 polygons; 379 vertices/);
    assert.equal(Buffer.compare(readFileSync(out), stripFbx(raw(SOURCE), { cut: [{ object: 'Breton_Male.018', material: 7 }, { object: 'Breton_Male.018', material: 2 }] }).bytes), 0);
    assert.equal(spawnSync(process.execPath, [new URL('../../tools/fbxStrip.mjs', import.meta.url).pathname, 'a.fbx', 'b.fbx'], { encoding: 'utf8' }).status, 2, 'neither a drop nor a cut: the usage');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MW-FOLK1: the outfits\' pose - retail\'s bind with each clavicle turned level and each arm falling PACK_ARM_FALL from the shoulder to the wrist, every other bone retail\'s; the sleeves stand on its arm line, not retail\'s; every NIF\'s binds that pose\'s', () => {
  const pack = packBind(SKELETON);
  const retail = plateBind(SKELETON);
  const J = (b, n) => b.get(n).t;
  for (const S of ['R', 'L']) {
    const C = J(retail, `Bip01 ${S} Clavicle`), U = J(retail, `Bip01 ${S} UpperArm`);
    const fall = Math.atan2(C[2] - U[2], Math.abs(U[0] - C[0])) * 180 / Math.PI;
    assert.ok(Math.abs(fall - 11.46) < 0.005, `retail's clavicle falls 11.46 degrees (${fall})`);
    assert.ok(Math.abs(J(pack, `Bip01 ${S} UpperArm`)[2] - J(pack, `Bip01 ${S} Clavicle`)[2]) < 1e-9, `${S}: the pack's clavicle level`);
    assert.ok(Math.abs(J(pack, `Bip01 ${S} UpperArm`)[2] - J(pack, `Bip01 ${S} Hand`)[2] - PACK_ARM_FALL) < 1e-9, `${S}: the wrist PACK_ARM_FALL under the shoulder`);
    assert.ok(Math.abs(J(retail, `Bip01 ${S} UpperArm`)[2] - J(retail, `Bip01 ${S} Hand`)[2] - 1.83) < 0.005, 'retail\'s wrist 1.83 under its shoulder');
  }
  assert.equal(PACK_ARM_FALL, 0.5);
  for (const n of pack.keys()) {
    const arm = /^Bip01 [RL] (Clavicle|UpperArm|Forearm|Hand|Finger)/.test(n);
    if (!arm) assert.deepEqual(pack.get(n), retail.get(n), `${n}: retail's`);
    else if (n.startsWith('Bip01 R ')) {
      // the two arms turned alike: their joints mirror as retail's do (retail's own asymmetry, to 1e-4, is its file's)
      const mirror = (b) => { const r = J(b, n), l = J(b, n.replace('Bip01 R ', 'Bip01 L ')); return [r[0] + l[0], r[1] - l[1], r[2] - l[2]]; };
      const [p, q] = [mirror(pack), mirror(retail)];
      assert.ok([0, 1, 2].every((k) => Math.abs(p[k] - q[k]) < 1e-4), `${n}: the two arms turned alike`);
    }
  }
  // the tubes' centres, slab by slab along the arm: on the pack's line, off retail's
  const lineZ = (bind, x) => {
    const u = J(bind, 'Bip01 R UpperArm'), f = J(bind, 'Bip01 R Forearm'), h = J(bind, 'Bip01 R Hand');
    const [a, b] = x <= f[0] ? [u, f] : [f, h];
    return a[2] + (b[2] - a[2]) * (x - a[0]) / (b[0] - a[0]);
  };
  const off = (name, material, x0, x1, bind) => {
    const P = materialMesh(tree, name, material).positions;
    const r = [];
    for (let x = x0; x < x1; x += 1) {
      const zs = []; for (let i = 0; i < P.length; i += 3) if (P[i] >= x && P[i] < x + 1 && P[i + 2] > 100) zs.push(P[i + 2]);
      if (zs.length >= 8) r.push((Math.min(...zs) + Math.max(...zs)) / 2 - lineZ(bind, x + 0.5));
    }
    return { mean: r.reduce((s, v) => s + v, 0) / r.length, worst: Math.max(...r.map(Math.abs)), n: r.length };
  };
  const wraps = [off('Breton_Male.038', 0, 37, 48, pack), off('Breton_Male.038', 0, 37, 48, retail)];
  assert.ok(wraps[0].n === 3 && wraps[0].worst < 0.07, `the wraps over the wrists on the pack's line (${wraps[0].worst})`);
  assert.ok(wraps[1].mean > 3.1, `and 3.2 over retail's (${wraps[1].mean})`);
  const sleeve = [off('Breton_Male.018', 2, 12, 46, pack), off('Breton_Male.018', 2, 12, 46, retail)];
  assert.ok(Math.abs(sleeve[0].mean) < 0.1 && sleeve[0].worst < 0.4, `385's long sleeve on the pack's line (${sleeve[0].mean}, ${sleeve[0].worst})`);
  assert.ok(sleeve[1].mean > 2.5, `and over retail's (${sleeve[1].mean})`);
  // every NIF's bones bound in that pose: each inverse bind undoes the pack's bind
  for (const a of ARCHIVES) {
    for (const b of nifOf(a)) {
      for (const bone of b.skin.bones) {
        const name = [...pack.keys()].find((n) => n.toLowerCase() === bone.name);
        const m = pack.get(name);
        const ia = bone.invBind.a, it = bone.invBind.t;
        let worst = 0;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(ia[i * 3] * m.a[j] + ia[i * 3 + 1] * m.a[3 + j] + ia[i * 3 + 2] * m.a[6 + j] - (i === j ? 1 : 0)));
          worst = Math.max(worst, Math.abs(ia[i * 3] * m.t[0] + ia[i * 3 + 1] * m.t[1] + ia[i * 3 + 2] * m.t[2] + it[i]));
        }
        assert.ok(worst < 1e-4, `${a} ${b.name} ${name}: bound in the pack's pose (${worst})`);
      }
    }
  }
});

test('MW-FOLK1: each garment piece weighted by what it is - its island\'s class and that class\'s rig, cloth hanging round the legs the hang\'s one law of position (the thighs\' whole share from the hip joints down, the calves\' past the knees), a torso piece\'s arm bones within their reach; every vertex\'s weights whole; the hoods raised HELM_LIFT and nothing else moved', () => {
  const classes = {};
  const pack = packBind(SKELETON);
  const hang = hangOf(pack);
  assert.deepEqual([+hang.bottom.toFixed(2), +hang.knee.toFixed(2)], [76.37, 43.94], 'the hip joints and the knees, off the bind');
  const lifted = (scene, v) => [scene.positions[v * 3], scene.positions[v * 3 + 1], scene.positions[v * 3 + 2]];
  for (const o of OUTFITS) {
    const batches = nifOf(o.archive);
    classes[o.archive] = o.shapes.map((s, i) => {
      const mesh = shapeMesh(o, s);
      const scene = materialMesh(tree, o.object, s.material);
      const b = batches[i];
      const n = mesh.positions.length / 3;
      assert.equal(b.positions.length, mesh.positions.length, `${o.archive} ${s.paint}: the NIF's vertices are the bake's`);
      const weights = Array.from({ length: n }, () => new Map());
      for (const bone of b.skin.bones) bone.indices.forEach((v, k) => weights[v].set(bone.name, bone.weights[k]));
      const counts = {};
      const isles = islandsOf(mesh);
      assert.equal(isles.reduce((t, isl) => t + isl.verts.length, 0), n, 'every vertex in one island');
      for (const isl of isles) {
        const c = islandClass(isl);
        counts[c] = (counts[c] ?? 0) + 1;
        const rig = new Set(RIGS[c].bones.map((x) => x.name.toLowerCase()));
        for (const v of isl.verts) {
          const w = weights[v];
          const sum = [...w.values()].reduce((t, x) => t + x, 0);
          assert.ok(Math.abs(sum - 1) < 1e-5, `${o.archive} ${s.paint} vertex ${v}: weighs ${sum}`);
          for (const name of w.keys()) assert.ok(rig.has(name), `${o.archive} ${s.paint} (${c}) vertex ${v}: ${name} is no bone of its rig`);
          for (let k = 0; k < 3; k++) assert.ok(Math.abs(b.positions[v * 3 + k] - mesh.positions[v * 3 + k]) < 1e-4, `${o.archive} vertex ${v}: the bake's place`);
          const lift = c === 'hood' ? HELM_LIFT : 0;
          assert.ok(Math.abs(mesh.positions[v * 3 + 2] - scene.positions[v * 3 + 2] - lift) < 1e-6, `${o.archive} ${c} vertex ${v}: raised ${lift}`);
          if (RIGS[c].hang) {
            // ONE LAW OF POSITION (AUDIT MW-FOLK1 L1-F6, L2-F1): the legs' share by height alone - the whole of it from
            // the hip joints down, never a piece's own hem - split left and right by the middle, the calves' past the knees
            const [x, , z] = [0, 1, 2].map((k) => scene.positions[v * 3 + k]);
            const sm = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
            const legs = HANG_SHARE * sm((HANG_TOP - z) / (HANG_TOP - hang.bottom));
            const right = sm((x + HANG_CENTRE) / (2 * HANG_CENTRE)), low = sm((hang.knee + KNEE_BLEND - z) / (2 * KNEE_BLEND));
            const got = (n) => w.get(n) ?? 0;
            const want = { 'bip01 l thigh': legs * (1 - right) * (1 - low), 'bip01 r thigh': legs * right * (1 - low), 'bip01 l calf': legs * (1 - right) * low, 'bip01 r calf': legs * right * low };
            for (const [n, x0] of Object.entries(want)) assert.ok(Math.abs(got(n) - x0) < 2e-3, `${o.archive} ${s.paint} vertex ${v} (z ${z.toFixed(1)}): ${n} ${got(n)}, the law's ${x0}`);
          }
          if (c === 'torso' || c === 'skirt') {
            // AUDIT MW-FOLK1 L1-F5: past the arm bones' reach and its fade, the body's side is the ribcage's - no arm bone
            const far = ['R', 'L'].every((S) => [['Clavicle', 'UpperArm'], ['UpperArm', 'Forearm']].every(([a, b2]) => segmentDistance(lifted(scene, v), pack.get(`Bip01 ${S} ${a}`).t, pack.get(`Bip01 ${S} ${b2}`).t) >= ARM_REACH + ARM_FADE));
            if (far) for (const S of ['r', 'l']) assert.ok(!w.has(`bip01 ${S} clavicle`) && !w.has(`bip01 ${S} upperarm`), `${o.archive} ${s.paint} vertex ${v}: an arm bone past its reach`);
          }
        }
      }
      return Object.fromEntries(Object.entries(counts).sort());
    });
  }
  assert.deepEqual(classes, {
    381: [{ hip: 1, 'leg:L': 1, 'leg:R': 1 }, { 'arm:L': 1, 'arm:R': 1, skirt: 2 }],
    382: [{ 'arm:L': 1, 'arm:R': 1, hip: 1, 'leg:L': 1, 'leg:R': 1, skirt: 3, torso: 1 }],   // its pouch, 1.9 below the hip joints, hangs
    383: [{ hip: 1, 'leg:L': 1, 'leg:R': 1 }, { 'arm:L': 1, 'arm:R': 1, skirt: 2 }],
    384: [{ hip: 1, 'leg:L': 1, 'leg:R': 1, skirt: 2, torso: 1 }],   // AUDIT MW-FOLK1 L1-F4: its side flap hangs
    385: [{ 'leg:L': 1, 'leg:R': 1 }, { skirt: 1, torso: 1 }, { 'arm:L': 1, 'arm:R': 1 }, { hip: 1 }],
    386: [{ 'arm:L': 1, 'arm:R': 1, skirt: 1, torso: 1 }, { 'leg:L': 1, 'leg:R': 1 }, { hip: 1 }, { 'leg:L': 1, 'leg:R': 1 }],
    387: [{ 'leg:L': 1, 'leg:R': 1, skirt: 1 }, { hip: 1 }, { 'arm:L': 1, 'arm:R': 1 }, { 'arm:L': 1, 'arm:R': 1, torso: 1 }],
    388: [{ hood: 1, skirt: 1, torso: 1 }, { 'leg:L': 1, 'leg:R': 1 }],
    389: [{ hood: 1, skirt: 1, torso: 1 }, { 'leg:L': 1, 'leg:R': 1 }],
    390: [{ 'arm:L': 1, 'arm:R': 1, skirt: 1, torso: 1 }, { 'leg:L': 1, 'leg:R': 1 }, { hip: 1 }, { 'leg:L': 1, 'leg:R': 1 }],
    398: [{ 'arm:L': 1, 'arm:R': 1, hood: 1, 'leg:L': 1, 'leg:R': 1, skirt: 1, torso: 1 }],
  });
  // THE CLASS LAW AT ITS EDGES (AUDIT MW-FOLK1 L3-F7: every threshold read either side of it, within half a unit)
  const head = SCENE_BODY.head.max[2];
  const cls = (min, max) => islandClass({ min, max });
  assert.deepEqual([cls([-8, -5, 112.4], [8, 9, head + 1]), cls([-8, -5, 111.6], [8, 9, head + 1])], ['hood', 'torso'], 'a hood starts over the shoulders');
  assert.deepEqual([cls([-11.6, -5, 113], [11.6, 9, head + 1]), cls([-12.4, -5, 113], [12.4, 9, head + 1])], ['hood', 'torso'], 'narrower than 12 a side: a head\'s; wider, a collar');
  assert.deepEqual([cls([-6, -6, 113], [6, 8, head + 0.4]), cls([-6, -6, 113], [6, 8, head - 0.4])], ['hood', 'torso'], 'AUDIT L1-F4: and up over the crown - a narrow collar is no hood');
  assert.deepEqual([cls([6.4, -3, 100.4], [40, 3, 118]), cls([5.6, -3, 100.4], [40, 3, 118]), cls([6.4, -3, 99.6], [40, 3, 118])], ['arm:R', 'hip', 'hip'], 'out along the arm, over 100');
  assert.deepEqual([cls([-40, -3, 100.4], [-6.4, 3, 118]), cls([-40, -3, 100.4], [-5.6, 3, 118])], ['arm:L', 'hip']);
  assert.deepEqual([cls([-12, -8, HIP_JOINTS - 0.4], [12, 8, 90]), cls([-12, -8, HIP_JOINTS + 0.4], [12, 8, 90])], ['skirt', 'torso'], 'round both legs past the hip joints: it hangs');
  assert.deepEqual([cls([-3.4, -8, 60], [3.4, 8, 90]), cls([-2.6, -8, 60], [3.4, 8, 90])], ['skirt', 'leg:R'], 'both sides past x 3');
  assert.deepEqual([cls([2, -5, 69.6], [12, 9, 80]), cls([-12, -5, 69.6], [-2, 9, 80]), cls([2, -5, 70.4], [12, 9, 80])], ['leg:R', 'leg:L', 'skirt'], 'one leg\'s below 70; above it at one side, a flap');
  assert.deepEqual([cls([-9.3, 6.1, HIP_JOINTS - 0.4], [-2.6, 9.4, 85.8]), cls([6, -6, HIP_JOINTS + 0.4], [11, 2, 86])], ['skirt', 'hip'], 'AUDIT L1-F4: a flap past the hip joints hangs; a pouch on the belt is the pelvis\'s');
});

// ── MW-FIT1's measure: rays out of each part's bone line, in the pose the outfits were made in ─────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const lerp = (p, q, t) => [0, 1, 2].map((k) => p[k] + (q[k] - p[k]) * t);
/** Does a ray from `o` along `d` meet any of `tris` within `reach`? (Moller-Trumbore, both faces.) */
function meets(o, d, tris, reach) {
  for (const [a, b, c] of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det; if (t > 0 && t <= reach) return true;
  }
  return false;
}
/** Each skin part's bone span and reach, by side (the middle parts are the right's call alone). */
function spans(bind, S) {
  const T = (n) => bind.get(n).t;
  const local = (n, l) => { const m = bind.get(n); return [0, 1, 2].map((k) => m.a[k * 3] * l[0] + m.a[k * 3 + 1] * l[1] + m.a[k * 3 + 2] * l[2] + m.t[k]); };
  const b = (n) => `Bip01 ${S} ${n}`;
  return {
    chest: [T('Bip01 Spine'), T('Bip01 Neck'), 16], groin: [lerp(T('Bip01 Pelvis'), T('Bip01 Spine'), -0.6), T('Bip01 Spine'), 16], neck: [T('Bip01 Neck'), T('Bip01 Head'), 9],
    'upper arm': [T(b('UpperArm')), T(b('Forearm')), 7], forearm: [T(b('Forearm')), lerp(T(b('Forearm')), T(b('Hand')), 0.88), 6],
    wrist: [lerp(T(b('Forearm')), T(b('Hand')), 0.88), lerp(T(b('Hand')), local(b('Hand'), [3, 0, 0]), 0.5), 5], hand: [T(b('Hand')), local(b('Hand'), [9, 0, 0]), 5],
    'upper leg': [T(b('Thigh')), T(b('Calf')), 8], knee: [T(b('Calf')), lerp(T(b('Calf')), T(b('Foot')), 0.5), 7],
    ankle: [lerp(T(b('Calf')), T(b('Foot')), 0.5), T(b('Foot')), 6], foot: [T(b('Foot')), local(b('Foot'), [5.5, 9, 0]), 6],
  };
}
/** The share of 80 rays - 16 round the line at five places along it - that meet the outfit within the part's reach. */
function coverage(tris, [p, q, reach]) {
  const lo = [0, 1, 2].map((k) => Math.min(p[k], q[k]) - reach), hi = [0, 1, 2].map((k) => Math.max(p[k], q[k]) + reach);
  const near = tris.filter((t) => [0, 1, 2].every((k) => Math.max(t[0][k], t[1][k], t[2][k]) >= lo[k] && Math.min(t[0][k], t[1][k], t[2][k]) <= hi[k]));
  const ax = unit(sub(q, p)); const u = unit(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])); const v = cross(ax, u);
  let hit = 0;
  for (let i = 0; i <= 4; i++) {
    const o = lerp(p, q, 0.1 + 0.8 * i / 4);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; if (meets(o, [0, 1, 2].map((j) => u[j] * Math.cos(a) + v[j] * Math.sin(a)), near, reach)) hit++; }
  }
  return hit / 80;
}

test('MW-FOLK1: what each outfit hides is the skin it covers all round - every ray out of the part\'s bone line meeting it, in the pose it was made in; a leg inside cloth hanging round both legs past its span hidden too - every ray out of the line between the legs meeting it; a hood hides the hair; the hooded woman\'s open bodice covers her chest without hiding it', () => {
  const pack = packBind(SKELETON);
  const MIDDLE = ['chest', 'groin', 'neck'];
  const LEGS = ['upper leg', 'knee', 'ankle', 'foot'];
  // how far out of the line between the legs a skirt may flare and still close round them: 398's flares 16.5 a side;
  // nothing else stands within it of the legs in the pose the outfits were made in (the arms stand out level, 30 over)
  const BOTH_REACH = 24;
  const ARMO = { chest: 'cuirass', groin: 'groin', neck: 'neck' };
  const seen = {};
  for (const a of ARCHIVES) {
    const tris = nifOf(a).flatMap((b) => Array.from({ length: b.indices.length / 3 }, (_, t) => [0, 1, 2].map((k) => {
      const v = b.indices[t * 3 + k];
      return [b.positions[v * 3], b.positions[v * 3 + 1], b.positions[v * 3 + 2]];
    })));
    const R = spans(pack, 'R'), L = spans(pack, 'L');
    const hides = [];
    seen[a] = {};
    for (const part of Object.keys(R)) {
      if (MIDDLE.includes(part)) {
        const f = coverage(tris, R[part]);
        seen[a][part] = f;
        if (f === 1) hides.push(ARMO[part]);
        continue;
      }
      const [r, l] = [coverage(tris, R[part]), coverage(tris, L[part])];
      // AUDIT MW-FOLK1 L2-F1: BOTH LEGS IN ONE SKIRT. Each leg's rays crossed to the other inside it and met nothing, so
      // the dress closing round both hid neither; out of the line between them, reaching past either, every ray meets it
      const both = LEGS.includes(part) ? coverage(tris, [lerp(R[part][0], L[part][0], 0.5), lerp(R[part][1], L[part][1], 0.5), BOTH_REACH]) : 0;
      seen[a][part] = Math.min(r, l);
      seen[a][`both ${part}`] = both;
      if (r === 1 || both === 1) hides.push(`right ${part}`);
      if (l === 1 || both === 1) hides.push(`left ${part}`);
    }
    const hooded = outfitOf(a).shapes.some((s) => islandsOf(shapeMesh(outfitOf(a), s)).some((isl) => islandClass(isl) === 'hood'));
    if (hooded) hides.push('hair');
    const order = (xs) => [...xs].sort((x, y) => ARMO_PART.findIndex((p) => p.name === x) - ARMO_PART.findIndex((p) => p.name === y));
    assert.deepEqual(order(TOWNSFOLK_OUTFITS[a].hides), order(hides), `${a}: hides what it covers all round, and nothing it does not`);
    assert.ok(TOWNSFOLK_OUTFITS[a].hides.every((h) => ARMO_PART.some((p) => p.name === h && p.shadows)), `${a}: every hide a part with a skin`);
  }
  // the near misses that keep their skin: a V-neck, a cuff short of the wrist, the open bodice
  assert.deepEqual([seen[381].chest, seen[387].chest, seen[385].wrist, seen[398].chest, seen[398].neck], [77 / 80, 77 / 80, 60 / 80, 50 / 80, 47 / 80]);
  // the legs in one skirt: the dress closes round both thighs; its hem rises to 29.4 at the sides, over the knee's
  // lowest ray (27.1), so the knees are hers; every hem above the knee stops short of the thigh's span (its lowest ray,
  // 47.2 up), so the leg below a tunic is the body's
  assert.deepEqual([seen[398]['both upper leg'], seen[398]['both knee'] < 1], [1, true]);
  for (const a of [381, 382, 383, 384, 387]) assert.ok(seen[a]['both upper leg'] < 1 && seen[a]['upper leg'] < 1, `${a}: a hem above the knee hides no thigh`);
  assert.ok(ARCHIVES.every((a) => seen[a].neck < 1), 'no outfit closes round the neck');
  // covers: only the hooded woman's, her bodice over a chest it does not close round
  assert.deepEqual(Object.fromEntries(ARCHIVES.filter((a) => TOWNSFOLK_OUTFITS[a].covers.length).map((a) => [a, [...TOWNSFOLK_OUTFITS[a].covers]])), { 398: ['chest'] });
  assert.ok(seen[398].chest >= 0.5 && seen[398].chest < 1);
});

test('MW-FOLK1: a walker whose sprite has an outfit wears it - each of the eleven, in the picture\'s sex, whatever the seed; the other thirteen, a beast, a picture of the other sex and the watch on duty are dressed as before', () => {
  assert.deepEqual(Object.keys(TOWNSFOLK_OUTFITS).map(Number), ARCHIVES);
  const all = Object.values(PERSON_TEXTURES).flatMap((t) => [...t.male, ...t.female]);
  for (const race of Object.keys(PERSON_TEXTURES)) {
    for (const [sex, g] of [['male', GENDERS.Male], ['female', GENDERS.Female]]) {
      for (const archive of PERSON_TEXTURES[race][sex]) {
        assert.equal(spriteSex(archive), sex);
        for (const seed of [1, 77, 0xdead]) {
          const l = folkLookOf({ archive, gender: g, personFaceRecordId: 3 }, race, seed);
          if (ARCHIVES.includes(archive)) {
            assert.deepEqual([l.outfit, l.items, l.race, l.gender], [`townsfolk_${archive}`, [], race, sex], `${race} ${sex} ${archive}`);
            assert.deepEqual(l.npc, npcHint(seed, 0), 'their own head and hair - the hint off their own seed (AUDIT MW-FOLK1 L3-F1)');
            assert.ok(l.faceIndex >= 0 && l.faceIndex <= 9, 'and a face');
          } else {
            assert.equal(l.outfit, undefined);
            assert.ok(l.items.length > 0, `${archive}: the wardrobe's`);
          }
        }
      }
    }
  }
  assert.deepEqual(all.filter((a) => townsfolkOutfitOf(a)).sort(), ARCHIVES, 'every outfit a walker\'s sprite');
  // AUDIT MW-FOLK1 (L3-F1): EVERY WALKER OF ONE PICTURE DRESSES ALIKE AND THEIR FACES DIFFER - a street of 385's Breton
  // men, read as the build reads them (the look's hint through peerBuildOpts to the walk), reaches every one of the
  // heads-and-hairs. PIN MOVED (MW-HEADS2 - the owner: "only the player Britons should recieve the new heads, not npcs"):
  // the data's, four heads and four hairs - the port's own nine are a player's
  const recs = [];
  for (let i = 0; i < 4; i++) for (const [slot, part] of [['head', 0], ['hair', 1]]) recs.push(bodyRec(`b_n_breton_m_${slot}_0${i}`, `b\\b_n_breton_m_${slot}_0${i}.nif`, 'Breton', part));
  const dataFaces = bodyParts(recs.reduce((a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }, new Uint8Array(0)));
  const street = new Set(Array.from({ length: 200 }, (_, i) => {
    const o = peerBuildOpts(folkLookOf({ archive: 385, gender: GENDERS.Male, personFaceRecordId: 3 }, 'Breton', (i + 1) * 2654435761 >>> 0));
    return playerBodyRows(dataFaces, 'Breton', false, { walk: o.npcFace }).filter((r) => r.slot === 'head' || r.slot === 'hair').map((r) => r.record.id).join();
  }));
  assert.equal(street.size, 16, 'four heads times four hairs');
  // AUDIT MW-FOLK1 (L3-F18): EVERY DOOR THAT STANDS A PICTURE'S PERSON IN A BODY mints the look through folkLookOf - the
  // street's walkers (folkBodies.js spawnOf), the residents (rosterBodies.js residentLook), the shipyard's and the
  // lighthouse's people (portHost.js) and the stable and wagon yards' keepers (merchantYardsHost.js): an outfit's picture
  // wears its outfit wherever it is drawn. A new door is named here
  const doors = [];
  const sweep = (dir) => {
    for (const e of readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })) {
      const at = `${dir}/${e.name}`;
      if (e.isDirectory()) sweep(at); else if (at.endsWith('.js') && raw(at).toString('utf8').includes('folkLookOf(')) doors.push(at);
    }
  };
  sweep('src');
  assert.deepEqual(doors.sort(), ['src/characters/folkBodies.js', 'src/characters/rosterBodies.js', 'src/scenes/merchantYardsHost.js', 'src/scenes/portHost.js']);
  assert.deepEqual([spriteSex(GUARD_TEXTURE), spriteSex(500)], [null, null]);
  // a picture of the other sex is not theirs to wear; nor is a beast's
  const her = folkLookOf({ archive: 385, gender: GENDERS.Female, personFaceRecordId: 3 }, 'Breton', 5);
  assert.deepEqual([her.outfit, her.gender, her.items.length > 0], [undefined, 'female', true]);
  for (const race of ['Khajiit', 'Argonian']) {
    const beast = residentLook({}, { id: 'L9.t1', cls: null, sex: 'male', gender: 0, race, archive: 386, face: 3, name: 'Ri', job: 'farmer' });
    assert.deepEqual([beast.outfit, beast.race], [undefined, race], `${race}: no boots on his feet - the wardrobe's, barefoot`);
    assert.ok(beast.items.length > 0);
  }
  // a resident wears their own sprite's, wherever drawn
  const res = residentLook({}, { id: 'L9.t2', cls: null, sex: 'female', gender: 1, race: 'Redguard', archive: 398, face: 3, name: 'Ana', job: 'farmer' });
  assert.deepEqual([res.outfit, res.items], ['townsfolk_398', []]);
  const watch = folkLookOf({ archive: GUARD_TEXTURE, gender: GENDERS.Male, personFaceRecordId: 3, guard: true }, 'Breton', 5);
  assert.equal(watch.outfit, undefined);
  assert.ok(watch.items.some((it) => it.group === 'Armor'), 'the watch in his plate');
});

test('MW-FOLK1: the look to the body - an outfit is a worn piece of its own kind, one more body; composed as the cloak is, one add claiming no slot, the skin it hides occupied at clothing\'s priority in the third person only; a second outfit and an unknown id are notes', () => {
  const look = folkLookOf({ archive: 385, gender: GENDERS.Male, personFaceRecordId: 3 }, 'Breton', 9);
  const opts = peerBuildOpts(look);
  assert.deepEqual(opts.armor, [{ kind: 'outfit', id: 'townsfolk_385' }], 'the producer\'s piece');
  assert.deepEqual(peerBuildOpts({ ...look, outfit: 'townsfolk_999' }).armor, [], 'an id the table does not hold is none');
  assert.deepEqual(peerBuildOpts(look, { wb: 1 }).armor, [], 'the wolf wears its robe');
  assert.equal(outfitKeyOf(look), '|outfit:townsfolk_385');
  assert.equal(outfitKeyOf({ outfit: 7 }), '');
  assert.notEqual(peerBodyKey(look), peerBodyKey({ ...look, outfit: 'townsfolk_386' }), 'another outfit, another body');
  assert.equal(peerBodyKey(look), peerBodyKey({ ...look }), 'the same outfit, the same body');
  const worn = composeWornArmor({ pieces: opts.armor, armors: [], clothes: [], bodyPool: [], female: false });
  assert.deepEqual(worn.adds.map((a) => [a.slot, a.partName, a.bones, a.model, a.recordId]), [['outfit (townsfolk_385)', 'outfit', [], 'townsfolk_385.nif', 'townsfolk_385']]);
  assert.ok(isOutfitSlot(worn.adds[0].slot) && !isOutfitSlot('cloak (townsfolk_385)'));
  assert.deepEqual(worn.shadows, ['chest', 'groin', 'forearm:right', 'forearm:left', 'upperarm:right', 'upperarm:left', 'foot:right', 'foot:left',
    'ankle:right', 'ankle:left', 'knee:right', 'knee:left', 'upperleg:right', 'upperleg:left']);
  assert.deepEqual(worn.fpShadows, [], 'the first person draws no outfit, so it hides nothing there');
  assert.deepEqual([worn.covers, worn.notes], [[], []]);
  assert.deepEqual(ownOutfitFor('townsfolk_385'), TOWNSFOLK_OUTFITS[385]);
  assert.equal(ownOutfitFor('townsfolk_391'), null);
  assert.deepEqual(ownOutfitModelPaths(), ARCHIVES.map((a) => `meshes/townsfolk_${a}.nif`), 'every outfit\'s mesh, and no other (AUDIT MW-FOLK1 L3-F10)');
  // AUDIT MW-FOLK1 (L2-F8): a look is data to the body - a beast's carries no outfit there either, whatever it says
  for (const race of ['Khajiit', 'Argonian']) {
    assert.deepEqual(peerBuildOpts({ ...look, race }).armor, [], `${race}: no boots on digitigrade feet`);
    assert.equal(outfitKeyOf({ ...look, race }), '');
  }
  // AUDIT MW-FOLK1 (L3-F3): AT CLOTHING'S PRIORITY, FIRST AS A ROBE IS - armour over it takes its slots (strictly
  // greater: the own steel cuirass and its skirt over the tunic's hidden chest and groin), and a garment after it at
  // clothing's priority takes none (the tie keeps the first claimant: the outfit's hidden chest, no shirt over it)
  const plate = composeWornArmor({ pieces: [...opts.armor, { kind: 'armor', templateIndex: ARMOR_ENUM.Cuirass, material: ARMOR_MATERIAL.Steel }], armors: [], clothes: [], bodyPool: [] });
  assert.deepEqual(plate.adds.map((a) => a.slot), ['cuirass (daggerfall_steel_cuirass)', 'skirt (daggerfall_steel_cuirass)', 'outfit (townsfolk_385)']);
  const shirtPool = [{ id: 'b_shirt', model: 'm/s.nif' }, { id: 'b_sleeve', model: 'm/sl.nif' }];
  const shirts = [{ id: 'common_shirt_01', model: 's.nif', name: '', type: 2, enchanted: false, parts: [{ part: 3, male: 'b_shirt', female: null }, { part: 13, male: 'b_sleeve', female: null }] }];
  const shirted = composeWornArmor({ pieces: [{ kind: 'clothing', templateIndex: 165, name: 'Short Shirt' }, ...opts.armor], armors: [], clothes: shirts, bodyPool: shirtPool });
  assert.deepEqual(shirted.adds.map((a) => a.slot), ['outfit (townsfolk_385)'], 'composed first whatever the order handed in');
  // a second outfit, an unknown id
  const two = composeWornArmor({ pieces: [{ kind: 'outfit', id: 'townsfolk_385' }, { kind: 'outfit', id: 'townsfolk_386' }, { kind: 'outfit', id: 'nobody' }], armors: [], bodyPool: [] });
  assert.deepEqual(two.adds.map((a) => a.slot), ['outfit (townsfolk_385)']);
  assert.deepEqual(two.notes, ['outfit townsfolk_386: a second outfit - the first (townsfolk_385) is the one drawn', 'outfit nobody: no outfit the port carries']);
  // the paperdoll card's rows and the rebuild key
  assert.deepEqual(wornVerdicts(opts.armor, worn), [{ label: 'outfit townsfolk_385', dressed: ['outfit (townsfolk_385)'], reason: null }]);
  assert.deepEqual(wornVerdicts([{ kind: 'outfit', id: 'nobody' }], two), [{ label: 'outfit nobody', dressed: [], reason: 'outfit nobody: no outfit the port carries' }]);
  assert.equal(wornEquipKeyOf(opts.armor), 'outfit:townsfolk_385::');
  assert.notEqual(wornEquipKeyOf(opts.armor), wornEquipKeyOf([{ kind: 'outfit', id: 'townsfolk_386' }]));
});

test('MW-FOLK1: the hooded woman wears no modesty shirt - her bodice covers her chest; a hood hides the hair as a helm does, and one that bound nothing gives it back (HEAD-HELD)', async () => {
  const her = peerBuildOpts(folkLookOf({ archive: 398, gender: GENDERS.Female, personFaceRecordId: 3 }, 'Redguard', 4));
  const worn = composeWornModest({ pieces: her.armor, armors: [], clothes: [], bodyPool: [], female: true }, false);
  assert.deepEqual(worn.adds.map((a) => a.slot), ['outfit (townsfolk_398)']);
  assert.deepEqual(worn.notes, [], 'the weld never asked for a shirt');
  assert.deepEqual(worn.covers, ['chest']);
  assert.deepEqual(worn.shadows, ['hair', 'groin', 'foot:right', 'foot:left', 'upperleg:right', 'upperleg:left']);   // AUDIT MW-FOLK1 L2-F1: the thighs her dress closes round
  // the weld itself still stands: a bare chest with Show Nudity off asks for the plainest shirt (here no CLOT record
  // answers, and says so)
  const bare = composeWornModest({ pieces: [], armors: [], clothes: [], bodyPool: [], female: true }, false);
  assert.deepEqual(bare.notes, ['Short Shirt: no MW clothing of type 2 in these archives - the classic sprite stands']);
  // HEAD-HELD over a hood - the piece the producer mints for 388's walker (AUDIT MW-FOLK1 L3-F19)
  const hooded = composeWornArmor({ pieces: peerBuildOpts(folkLookOf({ archive: 388, gender: GENDERS.Male, personFaceRecordId: 3 }, 'Nord', 4)).armor, armors: [], bodyPool: [] });
  assert.ok(hooded.shadows.includes('hair') && !hooded.shadows.includes('head'), 'the hair under the hood; the face its own');
  const ROWS = [{ slot: 'head', record: { id: 'b_n_nord_m_head_01', model: 'b/head.nif' } }, { slot: 'hair', record: { id: 'b_n_nord_m_hair_01', model: 'b/hair.nif' } }];
  assert.deepEqual(bareHeadRows(ROWS, hooded, []), [{ slot: 'hair', bones: PART_BONES.hair ?? [], model: 'b/hair.nif' }], 'nothing of the outfit bound: the hair stands');
  // the hood drew - the pieces the binder hands back for 388's outfit on retail's skeleton (the binder test's own)
  const drew = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts: hooded.adds.map((x) => ({ slot: x.slot, partName: x.partName, bones: x.bones, bytes: onDisk(`src/assets/mw/meshes/${x.model}`) })) });
  assert.ok(drew.ok && drew.pieces.length > 0, drew.error);
  assert.deepEqual(bareHeadRows(ROWS, hooded, drew.pieces), [], 'the hood drew: it covers it');
  assert.deepEqual(bareHeadRows(ROWS, composeWornArmor({ pieces: [{ kind: 'outfit', id: 'townsfolk_385' }], armors: [], bodyPool: [] }), []), [], 'no hood, nothing hidden');
  const src = readFileSync(new URL('../../src/combat/fpArm.js', import.meta.url), 'utf8');
  assert.match(src, /const cap = worn\.adds\.find\(capsHead\);\n\s*missing\.push\(`\$\{cap\?\.partName === 'outfit' \? cap\.slot : 'helm'\}: none of it bound/, 'the note names the outfit');
});

test('MW-FOLK1: through the binder - every outfit the producer composes a skinned part on retail\'s skeleton, no note; in the idle each garment on its bones, the hood round the head; striding, a tunic\'s hem goes with the leg and its chest stays', async () => {
  const B = (asm, n) => asm.mats.get(asm.skeleton.byName.get(n.toLowerCase())).t;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const segDist = (p, a, b) => { const d = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d))); return dist(p, lerp(a, b, t)); };
  const centroid = (P, verts) => [0, 1, 2].map((k) => verts.reduce((s, v) => s + P[v * 3 + k], 0) / verts.length);
  const built = {};
  for (const a of ARCHIVES) {
    const female = spriteSex(a) === 'female';
    const race = female ? 'Redguard' : 'Nord';
    const opts = peerBuildOpts(folkLookOf({ archive: a, gender: female ? GENDERS.Female : GENDERS.Male, personFaceRecordId: 3 }, race, 11));
    const worn = composeWornArmor({ pieces: opts.armor, armors: [], clothes: [], bodyPool: [], female });
    const parts = worn.adds.map((x) => ({ slot: x.slot, partName: x.partName, bones: x.bones, bytes: onDisk(`src/assets/mw/meshes/${x.model}`) }));
    const asm = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts });
    assert.ok(asm.ok, asm.error);
    assert.deepEqual(asm.notes, [], `${a}: no note`);
    assert.deepEqual(asm.pieces.map((p) => [p.slot, p.kind, p.batch.name]), outfitOf(a).shapes.map((_, i) => [`outfit (townsfolk_${a})`, 'skinned', `Tri Chest ${i}`]));
    built[a] = asm;
    // in the idle: each arm piece on its own arm, each leg piece on its own leg, the hood round the head
    const o = outfitOf(a);
    asm.pieces.forEach((p, i) => {
      for (const isl of islandsOf(shapeMesh(o, o.shapes[i]))) {
        const c = islandClass(isl);
        const at = centroid(p.positions, isl.verts);
        if (c.startsWith('arm:')) {
          const S = c.at(-1);
          const near = segDist(at, B(asm, `Bip01 ${S} UpperArm`), B(asm, `Bip01 ${S} Hand`));
          const far = segDist(at, B(asm, `Bip01 ${S === 'R' ? 'L' : 'R'} UpperArm`), B(asm, `Bip01 ${S === 'R' ? 'L' : 'R'} Hand`));
          assert.ok(near < 9 && far > 20, `${a} ${o.shapes[i].paint} ${c}: on its arm (${near.toFixed(1)}), not the other (${far.toFixed(1)})`);
        } else if (c.startsWith('leg:')) {
          const S = c.at(-1);
          const near = Math.min(segDist(at, B(asm, `Bip01 ${S} Thigh`), B(asm, `Bip01 ${S} Calf`)), segDist(at, B(asm, `Bip01 ${S} Calf`), B(asm, `Bip01 ${S} Foot`)));
          assert.ok(near < 9, `${a} ${o.shapes[i].paint} ${c}: on its leg (${near.toFixed(1)})`);
        } else if (c === 'hood') {
          // the hood rides the head: it stands in the head bone's own frame where it stood in the bind - over the
          // crown, up the bone from the neck joint
          const inHead = (q, m) => { const d = sub(q, m.t); return [0, 1, 2].map((j) => m.a[j] * d[0] + m.a[3 + j] * d[1] + m.a[6 + j] * d[2]); };
          const idle = inHead(at, asm.mats.get(asm.skeleton.byName.get('bip01 head')));
          const bound = inHead(centroid(shapeMesh(o, o.shapes[i]).positions, isl.verts), packBind(SKELETON).get('Bip01 Head'));
          assert.ok([0, 1, 2].every((k) => Math.abs(idle[k] - bound[k]) < 1e-3), `${a}: the hood where the bind put it on the head (${idle} against ${bound})`);
          assert.ok(bound[0] > 10, `${a}: over the crown, ${bound[0].toFixed(1)} up the head bone`);
        }
      }
    });
  }
  // a stride: the right thigh forward - 385's tunic hem over it goes some way with it, the tunic's chest not at all
  const asm = built[385];
  const tunic = asm.pieces[1];
  const mesh = shapeMesh(outfitOf(385), outfitOf(385).shapes[1]);
  const hemIdx = [], chestIdx = [];
  for (let v = 0; v < mesh.positions.length / 3; v++) {
    if (mesh.positions[v * 3 + 2] < 70 && mesh.positions[v * 3] > 3) hemIdx.push(v);
    if (mesh.positions[v * 3 + 2] > 100) chestIdx.push(v);
  }
  assert.ok(hemIdx.length > 10 && chestIdx.length > 10);
  const hem0 = centroid(tunic.positions, hemIdx), chest0 = centroid(tunic.positions, chestIdx), knee0 = B(asm, 'Bip01 R Calf');
  const sk = asm.skeleton;
  const rest = Array.from(sk.nodes.get(sk.byName.get('bip01 r thigh')).rest.rotation);
  const ang = 35 * Math.PI / 180; const rz = [Math.cos(ang), -Math.sin(ang), 0, Math.sin(ang), Math.cos(ang), 0, 0, 0, 1];
  const m = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => rest[r * 3] * rz[c] + rest[r * 3 + 1] * rz[3 + c] + rest[r * 3 + 2] * rz[6 + c]));
  const w = Math.sqrt(1 + m[0] + m[4] + m[8]) / 2;
  poseAssembly(asm, { tracks: new Map([['bip01 r thigh', 1]]), sampleTrack: () => ({ rotation: [w, (m[7] - m[5]) / (4 * w), (m[2] - m[6]) / (4 * w), (m[3] - m[1]) / (4 * w)] }) });
  const knee = dist(B(asm, 'Bip01 R Calf'), knee0), hem = dist(centroid(tunic.positions, hemIdx), hem0);
  assert.ok(knee > 15, `the knee moved (${knee.toFixed(1)})`);
  assert.ok(hem > 1 && hem < knee, `the right hem moved ${hem.toFixed(1)} - with the leg, less than its knee`);
  assert.ok(dist(centroid(tunic.positions, chestIdx), chest0) < 1e-3, 'the chest stays');
});

/**
 * AUDIT MW-FOLK1 (L2-F1, L1-F4, L1-F5, L1-F6): THE RIG, MEASURED ON ITS BODY. Each outfit alone through the binder on
 * retail's skeleton, posed by local turns of its bones; the leg the body under the cloth - 385's hose, the leg mesh
 * itself skinned by the leg's rig - posed alike.
 */
test('MW-FOLK1 (AUDIT): striding, the leg stays inside the cloth that hangs round it - inside every tunic over hose, within a unit of every robe, kilt and skirt at a walk; in the idle the body\'s side stays on the ribcage; no seam opens between pieces; a flap rides outside the thigh', async () => {
  const pack = packBind(SKELETON);
  const asmOf = async (a) => assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts: [{ slot: `outfit (townsfolk_${a})`, partName: 'outfit', bones: [], bytes: onDisk(meshFile(a)) }] });
  const turn = (asm, name, deg) => {
    const sk = asm.skeleton; const rest = Array.from(sk.nodes.get(sk.byName.get(name)).rest.rotation);
    const g = deg * Math.PI / 180; const rz = [Math.cos(g), -Math.sin(g), 0, Math.sin(g), Math.cos(g), 0, 0, 0, 1];
    const m = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => rest[r * 3] * rz[c] + rest[r * 3 + 1] * rz[3 + c] + rest[r * 3 + 2] * rz[6 + c]));
    const w = Math.sqrt(1 + m[0] + m[4] + m[8]) / 2;
    return [w, (m[7] - m[5]) / (4 * w), (m[2] - m[6]) / (4 * w), (m[3] - m[1]) / (4 * w)];
  };
  /** A pose: [bone, degrees] turns over the idle. */
  const pose = (asm, turns) => { const rows = turns.map(([n, d]) => [n, turn(asm, n, d)]); poseAssembly(asm, { tracks: new Map(rows.map(([n], i) => [n, i + 1])), sampleTrack: (t) => ({ rotation: rows[t - 1][1] }) }); };
  const STRIDE = (deg, knee = 0, fwd = 'r') => { const back = fwd === 'r' ? 'l' : 'r'; return [[`bip01 ${fwd} thigh`, deg], [`bip01 ${back} thigh`, -deg], ...(knee ? [[`bip01 ${back} calf`, knee]] : [])]; };
  const at = (asm, n) => asm.mats.get(asm.skeleton.byName.get(n)).t;
  const P = (piece, v) => [piece.positions[v * 3], piece.positions[v * 3 + 1], piece.positions[v * 3 + 2]];
  const segPt = (p, a, b) => { const d = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d))); return lerp(a, b, t); };
  const first = (o, d, tris) => { let best = Infinity; for (const [a, b, c] of tris) { const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-12) continue; const q0 = sub(o, a), u = dot(q0, p) / det; if (u < 0 || u > 1) continue; const q = cross(q0, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue; const t = dot(e2, q) / det; if (t > 1e-6 && t < best) best = t; } return best; };
  const trisOf = (piece, verts) => { const set = new Set(verts); const out = []; for (let t = 0; t < piece.indices.length; t += 3) if (set.has(piece.indices[t])) out.push([0, 1, 2].map((k) => P(piece, piece.indices[t + k]))); return out; };
  // the leg: 385's hose, each side's island
  const hoseAsm = await asmOf(385);
  const hoseMesh = shapeMesh(outfitOf(385), outfitOf(385).shapes[0]);
  const legIsl = (S) => islandsOf(hoseMesh).find((isl) => islandClass(isl) === `leg:${S}`);
  const legOut = (asm, a, turns, lowest) => {
    pose(asm, turns); pose(hoseAsm, turns);
    const o = outfitOf(a);
    const tris = asm.pieces.flatMap((piece, i) => islandsOf(shapeMesh(o, o.shapes[i])).filter((isl) => islandClass(isl) === 'skirt').flatMap((isl) => trisOf(piece, isl.verts)));
    let worst = 0;
    for (const S of ['R', 'L']) {
      const s = S.toLowerCase(), th = at(hoseAsm, `bip01 ${s} thigh`), ca = at(hoseAsm, `bip01 ${s} calf`), fo = at(hoseAsm, `bip01 ${s} foot`);
      for (const v of legIsl(S).verts) {
        const z0 = hoseMesh.positions[v * 3 + 2]; if (z0 < lowest || z0 > 80) continue;
        const q = P(hoseAsm.pieces[0], v); const c1 = segPt(q, th, ca), c2 = segPt(q, ca, fo);
        const c = Math.hypot(...sub(q, c1)) <= Math.hypot(...sub(q, c2)) ? c1 : c2; const d = sub(q, c), L = Math.hypot(...d);
        const t = first(c, d.map((x) => x / L), tris); if (t < L) worst = Math.max(worst, L - t);
      }
    }
    return worst;
  };
  const hemTop = (a) => Math.max(...outfitOf(a).shapes.flatMap((sh) => islandsOf(shapeMesh(outfitOf(a), sh)).filter((isl) => islandClass(isl) === 'skirt').map((isl) => isl.min[2])));
  const built = {};
  for (const a of ARCHIVES) built[a] = await asmOf(a);
  // INSIDE EVERY TUNIC OVER HOSE, the hose itself the leg: the thigh's whole share from the hip joints down
  for (const a of [385, 386, 388, 389, 390]) {
    for (const turns of [STRIDE(35), STRIDE(35, 40), STRIDE(35, 40, 'l')]) assert.equal(legOut(built[a], a, turns, hemTop(a) + 1), 0, `${a}: the leg inside the tunic, ${JSON.stringify(turns)}`);
  }
  // WITHIN A UNIT OF EVERY ROBE, KILT AND SKIRT AT A WALK (their bare legs, over the highest point of their hems; the
  // share was 0.7 at each hem, and the legs stood out 2.4 to 3.3)
  for (const a of [381, 382, 383, 384, 387]) {
    const out = Math.max(legOut(built[a], a, STRIDE(20), hemTop(a) + 1), legOut(built[a], a, STRIDE(20, 0, 'l'), hemTop(a) + 1));
    assert.ok(out <= 1, `${a}: the leg out through the cloth by ${out.toFixed(2)} at a walk`);
  }
  // THE IDLE: past the arm bones' reach and fade, the body's side moves with the ribcage (in Spine2's frame, not a
  // tenth toward the spine); the old law took it 12 into the chest
  const inFrame = (q, m) => { const d = sub(q, m.t); return [0, 1, 2].map((j) => m.a[j] * d[0] + m.a[3 + j] * d[1] + m.a[6 + j] * d[2]); };
  for (const a of ARCHIVES) {
    const asm = built[a]; pose(asm, []);
    const sp = asm.mats.get(asm.skeleton.byName.get('bip01 spine2')), spb = pack.get('Bip01 Spine2');
    asm.pieces.forEach((piece, i) => {
      const mesh = shapeMesh(outfitOf(a), outfitOf(a).shapes[i]);
      for (const isl of islandsOf(mesh)) {
        if (!['torso', 'skirt'].includes(islandClass(isl))) continue;
        for (const v of isl.verts) {
          const p = [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
          if (p[2] < 95) continue;
          const far = ['R', 'L'].every((S) => [['Clavicle', 'UpperArm'], ['UpperArm', 'Forearm']].every(([x, y]) => segmentDistance(p, pack.get(`Bip01 ${S} ${x}`).t, pack.get(`Bip01 ${S} ${y}`).t) >= ARM_REACH + ARM_FADE));
          if (!far) continue;
          const pull = Math.abs(inFrame(p, spb)[2]) - Math.abs(inFrame(P(piece, v), sp)[2]);
          assert.ok(pull < 0.1, `${a} ${outfitOf(a).shapes[i].paint} [${p.map((x) => x.toFixed(1))}]: pulled ${pull.toFixed(2)} toward the spine in the idle`);
        }
      }
    });
  }
  // NO SEAM OPENS: pieces that touch (within a unit in the bind, of different islands or shapes - two legs aside) part
  // by less than a unit in the idle (the arms lowered from the pack's T-pose), a stride and the arms raised 80 - a
  // hard edge to the arm bones' reach opened 6.2 between 385's yoke and sleeve; what remains is the joint law's own
  // stretch across a joint's blend (398's bodice and sleeve, 0.6 apart at the armhole, part 0.63 with the arms raised,
  // as they did before the reach)
  for (const a of ARCHIVES) {
    const asm = built[a], o = outfitOf(a);
    const pts = asm.pieces.flatMap((piece, i) => islandsOf(shapeMesh(o, o.shapes[i])).flatMap((isl, k) => isl.verts.map((v) => ({ piece, v, key: `${i}.${k}`, cls: islandClass(isl), p: [0, 1, 2].map((j) => shapeMesh(o, o.shapes[i]).positions[v * 3 + j]) }))));
    const pairs = [];
    for (let x = 0; x < pts.length; x++) for (let y = x + 1; y < pts.length; y++) {
      const [e, f] = [pts[x], pts[y]];
      if (e.key === f.key || (e.cls.startsWith('leg:') && f.cls.startsWith('leg:') && e.cls !== f.cls)) continue;
      const d = Math.hypot(...sub(e.p, f.p)); if (d < 1) pairs.push([e, f, d]);
    }
    for (const turns of [[], STRIDE(35, 40), [['bip01 r upperarm', 80], ['bip01 l upperarm', 80]]]) {
      pose(asm, turns);
      for (const [e, f, d0] of pairs) {
        const grow = Math.hypot(...sub(P(e.piece, e.v), P(f.piece, f.v))) - d0;
        assert.ok(grow < 1, `${a}: ${e.cls} [${e.p.map((x) => x.toFixed(1))}] and ${f.cls} [${f.p.map((x) => x.toFixed(1))}] part by ${grow.toFixed(2)} (${JSON.stringify(turns)})`);
      }
    }
  }
  // A FLAP RIDES OUTSIDE THE THIGH: 384's at its left side, hung - the left thigh forward 25, every flap vertex outside
  // the leg's surface (rigid on the pelvis, the thigh swung 2.2 through it)
  const o384 = outfitOf(384), m384 = shapeMesh(o384, o384.shapes[0]);
  const flap = islandsOf(m384).find((isl) => isl.verts.length === 48 && isl.max[0] < 0);
  assert.equal(islandClass(flap), 'skirt');
  for (const deg of [0, 15, 25]) {
    pose(built[384], [['bip01 l thigh', deg]]); pose(hoseAsm, [['bip01 l thigh', deg]]);
    const legTris = trisOf(hoseAsm.pieces[0], legIsl('L').verts);
    const th = at(hoseAsm, 'bip01 l thigh'), ca = at(hoseAsm, 'bip01 l calf');
    for (const v of flap.verts) {
      const q = P(built[384].pieces[0], v), c = segPt(q, th, ca), d = sub(q, c), L = Math.hypot(...d);
      assert.ok(first(c, d.map((x) => x / L), legTris) < L, `384's flap [${[0, 1, 2].map((k) => m384.positions[v * 3 + k].toFixed(1))}] inside the thigh at ${deg}`);
    }
  }
});

test('MW-FOLK1 (AUDIT): a real build - an outfit that bound nothing hides nothing and dresses nothing: composed out again, the skin it hid stands, a woman\'s chest asks the weld for its shirt, and the card says why; one that bound is drawn as composed (mutants: the outfit never asked after; the second build dropped; the card reading the first composition)', async () => {
  // the hooded woman (398) on the fixture rig: a hair of her race (the hood hides it), and the dress where the port's
  // own archive loaded - or not, as on a page whose own chunk did not import
  const her = peerBuildOpts(folkLookOf({ archive: 398, gender: GENDERS.Female, personFaceRecordId: 3 }, 'Redguard', 4));
  const built = (own) => buildFpArm({
    race: 'fprace', female: true, armor: her.armor, reachSweep: false,
    deps: retailBodyDeps({
      records: [bodyRec('b_fprace_f_hair', 'fixture\\armfparm.nif', 'fprace', 1, { female: true })],
      before: own ? [shippedArchive(['meshes/townsfolk_398.nif', 'textures/townsfolk_dress_redguardwoman1.dds'])] : [],
    }),
  });
  const dressed = await built(true);
  assert.equal(dressed.third?.ok, true, dressed.third?.error);
  const bound = (res) => res.third.arm.pieces.map((p) => p.slot);
  assert.ok(bound(dressed).includes('outfit (townsfolk_398)') && !bound(dressed).includes('hair'), 'the dress drawn, the hair under its hood');
  assert.deepEqual(dressed.third.notes.filter((n) => !/no third-person record/.test(n)), [], 'no note');
  assert.deepEqual(dressed.worn, [{ label: 'outfit townsfolk_398', dressed: ['outfit (townsfolk_398)'], reason: null }]);
  const lost = await built(false);
  assert.equal(lost.third?.ok, true, lost.third?.error);
  assert.ok(!bound(lost).includes('outfit (townsfolk_398)') && bound(lost).includes('hair'), 'no dress: the hair it hid stands');
  assert.deepEqual(lost.third.notes.filter((n) => !/no third-person record/.test(n)), [
    'Short Shirt: no MW clothing of type 2 in these archives - the classic sprite stands',   // the weld asked (no CLOT record here answers)
    'outfit townsfolk_398: none of it bound - drawn without it',
  ]);
  assert.deepEqual(lost.worn, [{ label: 'outfit townsfolk_398', dressed: [], reason: 'outfit townsfolk_398: none of it bound - drawn without it' }], 'the card reads the composition the body was built from');
});
