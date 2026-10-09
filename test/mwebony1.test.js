// MW-EBONY1 (2026-10-09, Mac: "This is next 1. The ebony armor set and its textures"; asked, Ebony only): MAC'S EBONY
// PLATE, DAGGERFALL'S SEVEN CLASSIC PIECES IN EBONY, SKINNED AS THE STEEL PLATE IS.
//
// One export, nothing of Bethesda's in it, committed as it came; seven paintings matched to their pieces by the UV
// islands they trace; every piece read where it stands, skinned at bake time on the steel plate's machinery (the bind,
// the rigs, the lift), the breastplate's tassets hanging over the thighs; worn by Ebony alone into the slots its steel
// twin fills. And the face the baker refused: a corner named twice, dropped (tools/fbxMesh.mjs earClipRepeated).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { assembleFirstPersonArm, poseAssembly, shapeMatchesBone } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, itemMapCoverage, ARMO_PART } from '../src/formats/mwItemMap.js';
import { ownBodyPart } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { CLASSIC_ARMOR_TEMPLATE, ownArmorModelFor, ownArmorModelPaths } from '../src/characters/ownArmorModels.js';
import { readPng } from '../tools/pngIO.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { meshModelNames } from '../tools/fbxStrip.mjs';
import { earClip, earClipRepeated } from '../tools/fbxMesh.mjs';
import { smoothstep } from '../tools/skinWeights.mjs';
import { HELM_LIFT, PLATE_RIG, RETAIL_SKELETON, bakeObject } from '../tools/bakeSteelPlate.mjs';
import { SOURCE, TEXTURES, PIECES, EBONY_RIG, MIDDLE_SLACK, bakeEbonyPlate, dropAcross, meshFile, pieceMeshes, textureFile, textureName } from '../tools/bakeEbonyPlate.mjs';
import { retailSkeleton } from './fixtures/mw/retailRig.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const EBONY = ARMOR_MATERIAL.Ebony;
const SET = Object.values(CLASSIC_ARMOR_TEMPLATE).map((templateIndex) => ({ templateIndex, material: EBONY }));
const nifOf = (id) => flattenNif(parseNif(onDisk(meshFile(id))));
const tree = readFbx(raw(SOURCE));

test('MW-EBONY1: every mesh and painting re-made from the committed export, its paintings and retail\'s skeleton byte for byte; the export Mac\'s as it came, with nothing of Bethesda\'s in it', () => {
  const pngs = Object.fromEntries(Object.entries(TEXTURES).map(([t, p]) => [t, raw(p)]));
  const baked = bakeEbonyPlate({ source: raw(SOURCE), pngs, skeleton: raw(RETAIL_SKELETON) });
  assert.deepEqual(baked.pieces.map((p) => p.id), ['cuirass', 'skirt', 'pauldron_right', 'pauldron_left', 'gauntlet_right', 'gauntlet_left',
    'greave_right', 'greave_left', 'boot_right', 'boot_left', 'helm']);
  for (const p of baked.pieces) {
    assert.equal(Buffer.compare(Buffer.from(p.nif), raw(meshFile(p.id))), 0, `${meshFile(p.id)} is not what tools/bakeEbonyPlate.mjs makes - re-run it`);
    assert.deepEqual(nifOf(p.id).map((b) => b.material.textureFile), PIECES.find((q) => q.id === p.id).shapes.map((s) => textureName(s.texture)));
  }
  for (const t of baked.textures) {
    assert.equal(Buffer.compare(Buffer.from(t.dds), raw(textureFile(t.tex))), 0, `${textureFile(t.tex)} is not what the bake makes`);
    assert.deepEqual(Array.from(decodeTextureImage(textureFile(t.tex), onDisk(textureFile(t.tex))).mips[0].rgba), Array.from(readPng(raw(TEXTURES[t.tex])).data), `the ${t.tex} DDS is its painting`);
  }
  assert.deepEqual(baked.textures.map((t) => [t.tex, t.png.width]), [['cuirass', 512], ['skirt', 256], ['pauldron', 256], ['gauntlet', 256], ['greave', 256], ['boot', 256], ['helm', 256]]);
  assert.equal(sha(SOURCE), 'd537cc40214fb85a53fd6fc59a04b828eb919da8fb4304d76645dd8ca9e2a00d');
  assert.deepEqual(meshModelNames(raw(SOURCE)), ['Breton_Male.001', 'Breton_Male.007', 'Cube.022', 'Cube.024', 'Cube.027', 'Cube.028', 'Imperial_Silver_Cuirass_67_Male.011',
    'Imperial_Steel_Left_Gauntlet_20_Male.004', 'Imperial_Steel_Left_Gauntlet_20_Male.005', 'Plane.001', 'Sphere.007']);
  assert.equal(raw(SOURCE).includes(Buffer.from('tx_b_n_breton')), false, 'no Morrowind body painting named');
  // the paintings as Mac sent them, each under the piece its UV islands trace
  assert.deepEqual(Object.fromEntries(Object.entries(TEXTURES).map(([t, p]) => [t, sha(p).slice(0, 16)])), {
    cuirass: '4a566f6c480da866', skirt: '4a8e9624011e6c40', pauldron: '24ece0b5af05e8be', gauntlet: '3165290e4f5bde7a', greave: '01f6b3e118afcece', boot: 'a5a36188b84da58c', helm: '2a412ea3230f9b32',
  });
  for (const path of ownArmorModelPaths()) assert.ok(existsSync(new URL(`../src/assets/mw/${path}`, import.meta.url)), `${path} ships`);
});

test('MW-EBONY1: every piece is its object in the scene\'s placement, the helm raised HELM_LIFT; each NIF a skinned shape named for its slot over its own side\'s bones, weights summing to one; the tassets hang over the thighs', () => {
  const slotOf = { cuirass: 'cuirass', skirt: 'skirt', pauldron_right: 'right pauldron', pauldron_left: 'left pauldron', gauntlet_right: 'right hand', gauntlet_left: 'left hand',
    greave_right: 'right upper leg', greave_left: 'left upper leg', boot_right: 'right foot', boot_left: 'left foot', helm: 'hair' };
  assert.deepEqual(Object.keys(EBONY_RIG), PIECES.map((p) => p.id));
  for (const p of PIECES) {
    const scene = p.shapes.map((s) => bakeObject(tree, s.object, s.box));
    const batches = nifOf(p.id);
    const row = ARMO_PART.find((r) => r.name === slotOf[p.id]);
    const filter = row.name === 'hair' ? 'hair' : row.bones[0];
    const side = /_right$/.test(p.id) ? ' r ' : /_left$/.test(p.id) ? ' l ' : null;
    batches.forEach((b, i) => {
      let worst = 0;
      for (let k = 0; k < b.positions.length; k++) worst = Math.max(worst, Math.abs(b.positions[k] - scene[i].positions[k] - (k % 3 === 2 ? p.lift ?? 0 : 0)));
      assert.ok(worst < 1e-4, `${p.id}: the scene's${p.lift ? `, ${p.lift} up` : ''} (worst ${worst})`);
      assert.equal(b.skinned, true);
      assert.equal(b.name, `${EBONY_RIG[p.id].shape} ${i}`);
      assert.ok(shapeMatchesBone(b.name, filter), `${p.id}: rule 15 passes it for ${filter}`);
      const sum = new Float64Array(b.positions.length / 3);
      for (const bone of b.skin.bones) {
        if (side) assert.ok(!` ${bone.name} `.includes(side === ' r ' ? ' l ' : ' r '), `${p.id}: ${bone.name} is not the other side's`);
        bone.indices.forEach((v, k) => { sum[v] += bone.weights[k]; });
      }
      for (let v = 0; v < sum.length; v++) assert.ok(Math.abs(sum[v] - 1) < 1e-5, `${p.id} vertex ${v} weighs ${sum[v]}`);
    });
  }
  assert.deepEqual(PIECES.filter((p) => p.lift).map((p) => [p.id, p.lift]), [['helm', HELM_LIFT]]);
  // AUDIT MW-EBONY: the left boot's object carries a seven-triangle island of the right boot's, across the middle -
  // dropped; what is left mirrors the right boot but for three corners at its own inner edge
  const [left] = pieceMeshes(tree, PIECES.find((p) => p.id === 'boot_left'));
  const [right] = pieceMeshes(tree, PIECES.find((p) => p.id === 'boot_right'));
  assert.equal(left.bake.dropped, 7);
  assert.equal(bakeObject(tree, 'Cube.024').indices.length / 3 - left.indices.length / 3, 7);
  assert.equal(left.indices.length / 3, 450);
  assert.ok(Math.max(...Array.from(left.positions).filter((_, i) => i % 3 === 0)) < MIDDLE_SLACK, 'nothing of the left boot stands across the middle');
  const mirrored = new Set(Array.from({ length: right.positions.length / 3 }, (_, v) => [-right.positions[v * 3], right.positions[v * 3 + 1], right.positions[v * 3 + 2]].map((x) => x.toFixed(2)).join()));
  const lone = Array.from({ length: left.positions.length / 3 }, (_, v) => [left.positions[v * 3], left.positions[v * 3 + 1], left.positions[v * 3 + 2]]).filter((q) => !mirrored.has(q.map((x) => x.toFixed(2)).join()));
  assert.ok(lone.length <= 3 && lone.every((q) => Math.abs(q[0]) < 0.25), `${lone.length} corners mirror no right one, all at the inner edge`);
  assert.equal(dropAcross(right, 'right'), right, 'the right boot has nothing across');
  // the breastplate: the steel cuirass's spine and clavicles, and below the waist the thighs' share over them
  const [plate] = nifOf('cuirass');
  const share = (v) => plate.skin.bones.filter((b) => b.name.endsWith('thigh')).reduce((s, b) => { const k = Array.from(b.indices).indexOf(v); return s + (k < 0 ? 0 : b.weights[k]); }, 0);
  let tassets = 0; let chest = 0;
  for (let v = 0; v < plate.positions.length / 3; v++) {
    const z = plate.positions[v * 3 + 2];
    const want = 0.7 * smoothstep((84 - z) / (84 - 62));
    assert.ok(Math.abs(share(v) - want) < 1e-3, `the breastplate's vertex ${v} (z ${z.toFixed(1)}) swings with the thighs by ${want.toFixed(3)}, not ${share(v).toFixed(3)}`);
    if (want > 0.5) tassets++;
    if (z > 100) { chest++; assert.equal(share(v), 0); }
  }
  assert.ok(tassets > 20 && chest > 100, `${tassets} tasset and ${chest} chest vertices`);
  assert.deepEqual(EBONY_RIG.cuirass.bones.map((b) => b.name), [...PLATE_RIG.cuirass.bones.map((b) => b.name), 'Bip01 L Thigh', 'Bip01 R Thigh']);
  assert.equal(EBONY_RIG.skirt.hang.bottom, 60, 'the skirt hangs to its own hem');
  assert.equal(EBONY_RIG.helm, PLATE_RIG.helm_closed, 'the helm rides the head alone');
});

test('MW-EBONY1: Ebony alone wears it - the seven classic pieces into the slots the steel plate fills; Mithril and Adamantium keep the Morrowind ebony', () => {
  assert.deepEqual(SET.map((p) => ownArmorModelFor(p)?.id), ['daggerfall_ebony_cuirass', 'daggerfall_ebony_gauntlets', 'daggerfall_ebony_greaves',
    'daggerfall_ebony_left_pauldron', 'daggerfall_ebony_right_pauldron', 'daggerfall_ebony_helm', 'daggerfall_ebony_boots']);
  for (const m of [ARMOR_MATERIAL.Mithril, ARMOR_MATERIAL.Adamantium]) {
    for (const t of Object.values(CLASSIC_ARMOR_TEMPLATE)) assert.equal(ownArmorModelFor({ templateIndex: t, material: m }), null, `material ${m} template ${t} keeps its retail record`);
  }
  const worn = composeWornArmor({ pieces: SET, armors: [], bodyPool: [] });
  assert.deepEqual(worn.notes, []);
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.model]), [
    ['hair', 'ebony_plate_helm.nif'], ['cuirass', 'ebony_plate_cuirass.nif'], ['skirt', 'ebony_plate_skirt.nif'],
    ['right hand', 'ebony_plate_gauntlet_right.nif'], ['left hand', 'ebony_plate_gauntlet_left.nif'],
    ['right foot', 'ebony_plate_boot_right.nif'], ['left foot', 'ebony_plate_boot_left.nif'],
    ['right upper leg', 'ebony_plate_greave_right.nif'], ['left upper leg', 'ebony_plate_greave_left.nif'],
    ['right pauldron', 'ebony_plate_pauldron_right.nif'], ['left pauldron', 'ebony_plate_pauldron_left.nif'],
  ]);
  assert.deepEqual(worn.shadows, ['hair', 'chest', 'hand:right', 'hand:left', 'wrist:right', 'wrist:left', 'forearm:right', 'forearm:left',
    'foot:right', 'foot:left', 'ankle:right', 'ankle:left', 'knee:right', 'knee:left', 'upperleg:right', 'upperleg:left']);
  assert.ok(worn.adds.every((a) => !a.skinFrom && !a.fitTo), 'shipped skinned - no runtime fit');
  const own = itemMapCoverage().filter((c) => c.kind === 'own' && c.via === 'armor' && c.material === 'Ebony');
  assert.deepEqual(own.map((c) => c.item), ['Cuirass', 'Gauntlets', 'Greaves', 'Left_Pauldron', 'Right_Pauldron', 'Helm', 'Boots']);
});

test('MW-EBONY1: through the binder retail\'s armour takes - every piece a skinned part on retail\'s skeleton, no note; in the idle each on its bones, and striding the tassets go with the legs', async () => {
  const worn = composeWornArmor({ pieces: SET, armors: [], bodyPool: [] });
  const parts = worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: onDisk(`src/assets/mw/meshes/${a.model}`), ...ownBodyPart(a, [], () => null) }));
  const asm = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts });
  assert.ok(asm.ok, asm.error);
  assert.deepEqual(asm.notes, []);
  assert.ok(asm.pieces.every((p) => p.kind === 'skinned'));
  const B = (n) => asm.mats.get(asm.skeleton.byName.get(n.toLowerCase())).t;
  const zone = (slot) => asm.pieces.filter((p) => p.slot === slot);
  const verts = (slot) => zone(slot).flatMap((p) => Array.from({ length: p.positions.length / 3 }, (_, i) => [p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]]));
  const centroid = (vs) => [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // in retail's idle: the gauntlets on the hanging hands, the helm round the head bone, the boots under the knees
  for (const s of ['R', 'L']) {
    const c = centroid(verts(`${s === 'R' ? 'right' : 'left'} hand (daggerfall_ebony_gauntlets)`));
    assert.ok(dist(c, B(`Bip01 ${s} Hand`)) < 8 && dist(c, B(`Bip01 ${s} UpperArm`)) > 25, `the ${s} gauntlet on the hand`);
  }
  const helm = verts('hair (daggerfall_ebony_helm)'); const head = B('Bip01 Head');
  assert.ok([0, 1, 2].every((k) => Math.min(...helm.map((v) => v[k])) < head[k] && Math.max(...helm.map((v) => v[k])) > head[k]), 'the head bone inside the helm');
  for (const s of ['R', 'L']) assert.ok(centroid(verts(`${s === 'R' ? 'right' : 'left'} foot (daggerfall_ebony_boots)`))[2] < B(`Bip01 ${s} Calf`)[2], `the ${s} boot under the knee`);
  // a stride: the right thigh forward - the tassets over it go some way with it, the chest not at all
  // AUDIT MW-EBONY: the same vertices at rest and striding (a selection by height changed with the pose, so the centroid
  // moved with no vertex moving)
  const tassetIdx = (() => { const P = zone('cuirass (daggerfall_ebony_cuirass)')[0].positions; return Array.from({ length: P.length / 3 }, (_, i) => i).filter((i) => P[i * 3 + 2] < 70 && P[i * 3] > 3); })();
  const tassetAt = () => { const P = zone('cuirass (daggerfall_ebony_cuirass)')[0].positions; return centroid(tassetIdx.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])); };
  const restTassets = tassetAt();
  const restChest = centroid(verts('cuirass (daggerfall_ebony_cuirass)').filter((v) => v[2] > 100));
  const deg = Math.PI / 180; const sk = asm.skeleton;
  const rest = Array.from(sk.nodes.get(sk.byName.get('bip01 r thigh')).rest.rotation);
  const a = 35 * deg; const rz = [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const m = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => rest[r * 3] * rz[c] + rest[r * 3 + 1] * rz[3 + c] + rest[r * 3 + 2] * rz[6 + c]));
  const w = Math.sqrt(1 + m[0] + m[4] + m[8]) / 2;
  const q = [w, (m[7] - m[5]) / (4 * w), (m[2] - m[6]) / (4 * w), (m[3] - m[1]) / (4 * w)];
  const restThigh = B('Bip01 R Calf');
  poseAssembly(asm, { tracks: new Map([['bip01 r thigh', 1]]), sampleTrack: () => ({ rotation: q }) });
  const knee = dist(B('Bip01 R Calf'), restThigh);
  const tassets = dist(tassetAt(), restTassets);
  assert.ok(knee > 15, `the knee moved (${knee.toFixed(1)})`);
  assert.ok(tassets > 2 && tassets < knee, `the right tassets moved ${tassets.toFixed(1)} - with the leg, less than its knee`);
  assert.ok(dist(centroid(verts('cuirass (daggerfall_ebony_cuirass)').filter((v) => v[2] > 100)), restChest) < 1e-3, 'the chest stays');
});

test('MW-EBONY1: a face that names a corner twice is clipped once the repeat is dropped - where the plain clip refused, and nowhere else', () => {
  // a notched hexagon, its third corner standing twice
  const face = [[0, 0, 0], [4, 0, 0], [4, 3, 0], [4, 3, 0], [2, 1.5, 0], [0, 3, 0]];
  assert.throws(() => earClip(face), /no ear left to cut/);
  const tris = earClipRepeated(face);
  const area = (t) => { const [a, b, c] = t.map((i) => face[i]); return ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; };
  assert.equal(tris.length, 3, 'five kept corners, three triangles');
  assert.ok(tris.every((t) => !t.includes(3)), 'the repeat is in none of them');
  assert.ok(Math.abs(tris.reduce((s, t) => s + area(t), 0) - 9) < 1e-9, 'they cover the outline, 9, every one wound as the face is');
  assert.equal(earClipRepeated([[0, 0, 0], [4, 0, 0], [2, 1, 0], [0, 3, 0]]), null, 'no repeat: not this door');
  assert.equal(earClipRepeated([[0, 0, 0], [2, 2, 0], [2, 2, 0], [2, 0, 0], [0, 2, 0]]), null, 'a bow tie is still no face');
  // the breastplate's eight: baked, the record says so; another object's bake (the left boot) says nothing
  assert.equal(bakeObject(tree, 'Plane.001').bake.repeated, 8);
  assert.equal('repeated' in bakeObject(tree, 'Cube.024').bake, false);
});
