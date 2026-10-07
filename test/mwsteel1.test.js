// MW-STEEL1 (2026-10-06, Mac: "These 2 files are for the armor replacement of the morrowind steel armor with a
// varient to toggle the helmet type"): MAC'S STEEL PLATE, THE WHOLE CLASSIC SET, ON THE MORROWIND BODY.
//
// Daggerfall's seven classic pieces in Steel wear Mac's plate in place of retail's steel_* records (Steel only - his
// answer); the helm comes closed (a visor and a plume) or open (a nasal helm), by the Steel Helm switch, closed by
// default. These pins hold the bake to the committed sources byte for byte, the sources to carrying none of the
// Morrowind body Mac's scene fitted the plate on, the item map to Steel alone, the composer's slots and shadows, the fit
// that keeps each piece to the scene's own body, the sided transfer, the first person's gauntlets solved on the
// third-person skeleton, and the switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { fitShift, shiftBatch, positionBounds, boneSide, rebindSkin, transferSkin, sourceSkin } from '../src/formats/mwSkinTransfer.js';
import { assembleFirstPersonArm, poseAssembly, sideOfPart } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, shadowSkinRows, fpWornAdds, mwArmorRecords, itemMapCoverage, mwItemReport, ARMO_PART } from '../src/formats/mwItemMap.js';
import { PART_BONES } from '../src/formats/mwNpc.js';
import { ownBodyPart, ownBodyPaths } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import {
  OWN_MW_ARMOR, CLASSIC_ARMOR_TEMPLATE, STEEL_PLATE_SCENE, STEEL_HELM_STYLES, STEEL_HELM_DEFAULT,
  ownArmorModelFor, ownArmorParts, ownArmorModelPaths, RRI_JERKIN_TEMPLATE,
} from '../src/characters/ownArmorModels.js';
import { readPng } from '../tools/pngIO.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { stripFbx, meshModelNames } from '../tools/fbxStrip.mjs';
import { SOURCE, TEXTURES, PIECES, REFERENCE_PARTS, bakeSteelPlate, bakeObject, meshFile, textureFile, textureName, objectTree } from '../tools/bakeSteelPlate.mjs';
import { plateSkeleton, plateBody } from './fixtures/mw/plateRig.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const STEEL = ARMOR_MATERIAL.Steel;
const SET = [102, 103, 104, 105, 106, 107, 108].map((templateIndex) => ({ templateIndex, material: STEEL }));
const DELTA = [0.5, 1.5, 4];

/** The third-person build's own path, on the fixture body: compose, shadow, and hand the binder each part with
 *  ownBodyPart - the very helper combat/fpArm.js builds with. */
async function wearSet({ helmStyle, delta = DELTA, pieces = SET, skeleton = null, solveOn = null, only = null } = {}) {
  const worn = composeWornArmor({ pieces, armors: [], bodyPool: [], helmStyle });
  const body = plateBody(delta);
  const files = new Map(body.map((r) => [`meshes/${r.slot}.nif`, r.bytes]));
  for (const a of worn.adds) files.set(`meshes/${a.model}`, onDisk(`src/assets/mw/meshes/${a.model}`));
  const rows = body.map((r) => ({ slot: r.slot, record: { model: `${r.slot}.nif` } }));
  const find = (p) => (files.has(p) ? { get: () => files.get(p) } : null);
  const skin = shadowSkinRows(rows.map((r) => ({ slot: r.slot, bones: PART_BONES[r.slot] ?? [], model: r.record.model })), worn.shadows);
  const adds = only ? only(worn.adds) : worn.adds;
  const parts = [...(only ? [] : skin), ...adds].map((row) => ({
    slot: row.slot, partName: row.partName, bones: row.bones, bytes: files.get(`meshes/${row.model}`), ...ownBodyPart(row, rows, find, solveOn),
  }));
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeleton ?? plateSkeleton(delta), parts });
  return { worn, asm, rows, files };
}
const zone = (asm, slot) => asm.pieces.filter((p) => p.slot === slot);
const bounds = (arrays) => positionBounds(arrays);

// ── the bake ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL1: every shipped mesh and texture is re-made from the committed sources byte for byte, and read back as the port reads it', () => {
  const pngs = Object.fromEntries(Object.entries(TEXTURES).map(([t, p]) => [t, raw(p)]));
  const baked = bakeSteelPlate({ open: raw(SOURCE.open), closed: raw(SOURCE.closed), pngs });
  assert.deepEqual(baked.pieces.map((p) => p.id), ['cuirass', 'skirt', 'pauldron_right', 'pauldron_left', 'gauntlet_right', 'gauntlet_left',
    'greave_right', 'greave_left', 'boot_right', 'boot_left', 'helm_open', 'helm_closed']);
  assert.deepEqual(baked.textures.map((t) => t.tex), ['cuirass', 'pauldron', 'gauntlet', 'greave', 'boot', 'helm', 'visor', 'skirt']);
  for (const p of baked.pieces) {
    assert.equal(Buffer.compare(Buffer.from(p.nif), raw(meshFile(p.id))), 0, `${meshFile(p.id)} is not what tools/bakeSteelPlate.mjs makes - re-run it`);
    const batches = flattenNif(parseNif(onDisk(meshFile(p.id))));
    const spec = PIECES.find((q) => q.id === p.id);
    assert.deepEqual(batches.map((b) => b.material.textureFile), spec.shapes.map((s) => textureName(s.texture)), `${p.id} names its paintings`);
    assert.ok(batches.every((b) => b.material.twoSided), `${p.id} is two-sided, as the bake writes every own part`);
    batches.forEach((b, i) => {
      for (let k = 0; k < p.meshes[i].positions.length; k++) assert.ok(Math.abs(b.positions[k] - p.meshes[i].positions[k]) < 1e-4);
    });
  }
  for (const t of baked.textures) {
    assert.equal(Buffer.compare(Buffer.from(t.dds), raw(textureFile(t.tex))), 0, `${textureFile(t.tex)} is not what tools/bakeSteelPlate.mjs makes`);
    assert.deepEqual(Array.from(decodeTextureImage(textureFile(t.tex), onDisk(textureFile(t.tex))).mips[0].rgba), Array.from(readPng(raw(TEXTURES[t.tex])).data), `the ${t.tex} DDS is its painting`);
  }
  // the closed helm is ONE part of two shapes - a shell in the helm's painting and a visor in the faceplate's
  assert.deepEqual(flattenNif(parseNif(onDisk(meshFile('helm_closed')))).map((b) => b.material.textureFile), ['steel_plate_helm.dds', 'steel_plate_visor.dds']);
  // every path the item map can ask for ships, and the own archive serves it at its game path
  for (const path of ownArmorModelPaths()) assert.ok(existsSync(new URL(`../src/assets/mw/${path}`, import.meta.url)), `${path} ships`);
});

test('MW-STEEL1: the sources are Mac\'s exports less the Morrowind body they were fitted on - held to their bytes, and refused when a piece is not where it was read', () => {
  assert.equal(sha(SOURCE.open), '7a4b20045a22b40f474be66119a1084f1ca1da9eab7dccb7469e9208252fb67d');   // MW-STEEL2: re-imported with the plate skirt kept
  assert.equal(sha(SOURCE.closed), '4efd294bdb4fba2a7f6a78286a8bd1d53c591a57d1337cdbedfe914b8752121a');
  for (const [name, bytes] of [['open', raw(SOURCE.open)], ['closed', raw(SOURCE.closed)]]) {
    for (const ref of Object.values(REFERENCE_PARTS)) assert.equal(meshModelNames(bytes).includes(ref), false, `the ${name} source carries no ${ref}`);
    assert.equal(bytes.includes(Buffer.from('tx_b_n_breton')), false, `the ${name} source names no Morrowind body texture`);
    assert.equal(readFbx(bytes).version, 7400);
  }
  assert.deepEqual(meshModelNames(raw(SOURCE.closed)), ['Sphere', 'Sphere.001 Remeshed Remeshed'], 'the second export is committed as its closed helm alone');
  // MW-STEEL2: the plate skirt under the breastplate is kept since its painting came, and baked as the set's skirt
  assert.ok(meshModelNames(raw(SOURCE.open)).includes('Imperial_Silver_Cuirass_67_Male.011'), 'the open source keeps the skirt');
  assert.deepEqual(PIECES.find((p) => p.id === 'skirt').shapes.map((x) => [x.object, x.texture]), [['Imperial_Silver_Cuirass_67_Male.011', 'skirt']]);
  // a piece moved past the slack is refused by name
  const tree = readFbx(raw(SOURCE.open));
  assert.throws(() => bakeObject(tree, 'Cube.024', [[0.32, -6.48, -0.21], [11.33, 14.61, 48.2]]), /"Cube\.024" stands at .* not where its piece was read/);
  assert.doesNotThrow(() => bakeObject(tree, 'Cube.024', [[0.32, -6.48, -0.21], [11.33, 14.61, 48.13]]));
  assert.throws(() => objectTree(tree, 'Breton_Male.003'), /no Mesh object "Breton_Male\.003"/);
});

test('MW-STEEL1: the strip copies every record it keeps byte for byte - nothing dropped is nothing changed, and a dropped object takes only what hangs from it alone', () => {
  const src = raw(SOURCE.open);
  assert.equal(Buffer.compare(stripFbx(src, { drop: [] }).bytes, src), 0, 'an empty strip is the file');
  const { bytes, dropped } = stripFbx(src, { drop: ['Sphere.002'] });
  assert.deepEqual(dropped.map((d) => [d.kind, d.name]), [['Geometry', 'Sphere.003'], ['Model', 'Sphere.002'], ['Material', 'Material.037'], ['Texture', 'base_color_texture'], ['Video', 'DefaultMaterial_2D_View_<UDIM>.png.003']]);
  assert.equal(meshModelNames(bytes).includes('Sphere.002'), false);
  // the boots share one material between two objects: dropping one keeps it for the other
  const one = stripFbx(src, { drop: ['Cube.019'] });
  assert.deepEqual(one.dropped.map((d) => d.kind), ['Geometry', 'Model'], 'a material a kept object wears stays');
  // what stays bakes as it did, and the definitions count what is left
  const tree = readFbx(bytes);
  assert.equal(JSON.stringify(bakeObject(tree, 'Cube.024')), JSON.stringify(bakeObject(readFbx(src), 'Cube.024')));
  const count = (t, kind) => t.nodes.find((n) => n.name === 'Definitions').children.find((c) => c.name === 'ObjectType' && c.props[0] === kind).children.find((c) => c.name === 'Count').props[0];
  assert.equal(count(tree, 'Model'), count(readFbx(src), 'Model') - 1);
  assert.equal(count(tree, 'Geometry'), count(readFbx(src), 'Geometry') - 1);
  assert.throws(() => stripFbx(src, { drop: ['Breton_Male.003'] }), /no Model named "Breton_Male\.003"/);
});

// ── the item map and the composer ─────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL1: Steel alone wears the plate - the seven classic pieces; Silver and Elven keep retail\'s steel, and so does every mod piece but the brigandine', () => {
  assert.deepEqual(CLASSIC_ARMOR_TEMPLATE, Object.fromEntries(Object.entries(ARMOR_ENUM).filter(([, v]) => v <= 108)), 'the restated templates are the enum\'s');
  assert.deepEqual(SET.map((p) => ownArmorModelFor(p)?.id), ['daggerfall_steel_cuirass', 'daggerfall_steel_gauntlets', 'daggerfall_steel_greaves',
    'daggerfall_steel_left_pauldron', 'daggerfall_steel_right_pauldron', 'daggerfall_steel_helm', 'daggerfall_steel_boots']);
  for (const [name, m] of Object.entries(ARMOR_MATERIAL)) {
    if (m === STEEL) continue;
    for (const t of Object.values(CLASSIC_ARMOR_TEMPLATE)) assert.equal(ownArmorModelFor({ templateIndex: t, material: m }), null, `${name} ${t} keeps its retail record`);
  }
  for (let t = 515; t <= 526; t++) if (t !== RRI_JERKIN_TEMPLATE) assert.equal(ownArmorModelFor({ templateIndex: t, material: STEEL }), null, `template ${t} in Steel keeps retail's`);
  assert.equal(ownArmorModelFor({ templateIndex: RRI_JERKIN_TEMPLATE, material: STEEL }).id, 'daggerfall_brigandine_steel');
  const R = (id) => ({ id, model: `m/${id}.nif`, parts: [] });
  assert.equal(mwArmorRecords([R('steel_cuirass')], ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Silver).records[0].id, 'steel_cuirass', 'Silver still finds retail\'s steel');
  // the census and the report say the port's own
  const own = itemMapCoverage().filter((c) => c.kind === 'own' && c.via === 'armor');
  assert.deepEqual(own.map((c) => `${c.material} ${c.item}`), ['Steel Cuirass', 'Steel Gauntlets', 'Steel Greaves', 'Steel Left_Pauldron', 'Steel Right_Pauldron', 'Steel Helm', 'Steel Boots']);
  assert.equal(own.find((c) => c.item === 'Helm').model, 'steel_plate_helm_closed.nif + steel_plate_helm_open.nif', 'the helm names both its styles');
  const report = mwItemReport([R('steel_helmet')]).filter((r) => r.item.startsWith('Steel '));
  assert.deepEqual(report.find((r) => r.item === 'Steel Helm').found, ['steel_plate_helm_closed.nif', 'steel_plate_helm_open.nif']);
  assert.match(report.find((r) => r.item === 'Steel Helm').note, /the port's own model/);
  assert.deepEqual(mwItemReport([R('steel_helmet')]).find((r) => r.item === 'Silver Helm').found, ['steel_helmet']);
});

test('MW-STEEL1: the set composes into retail\'s slots - the breastplate the cuirass, a gauntlet its hand over its wrist and forearm, a boot its foot over its ankle and knee, the helm the HAIR', () => {
  const worn = composeWornArmor({ pieces: SET, armors: [], bodyPool: [] });
  assert.deepEqual(worn.notes, []);
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.model]), [
    ['hair', 'steel_plate_helm_closed.nif'], ['cuirass', 'steel_plate_cuirass.nif'], ['skirt', 'steel_plate_skirt.nif'],
    ['right hand', 'steel_plate_gauntlet_right.nif'], ['left hand', 'steel_plate_gauntlet_left.nif'],
    ['right foot', 'steel_plate_boot_right.nif'], ['left foot', 'steel_plate_boot_left.nif'],
    ['right upper leg', 'steel_plate_greave_right.nif'], ['left upper leg', 'steel_plate_greave_left.nif'],
    ['right pauldron', 'steel_plate_pauldron_right.nif'], ['left pauldron', 'steel_plate_pauldron_left.nif'],
  ]);
  assert.deepEqual(worn.shadows, ['hair', 'chest', 'hand:right', 'hand:left', 'wrist:right', 'wrist:left', 'forearm:right', 'forearm:left',
    'foot:right', 'foot:left', 'ankle:right', 'ankle:left', 'knee:right', 'knee:left', 'upperleg:right', 'upperleg:left'],
  'the head is left - the open helm shows the face and the closed one\'s eye slit looks onto it; the skirt shadows nothing - the groin skin stays under it, as ARMO_PART\'s skirt row says');
  // every add carries the body it is skinned from and the fit that keeps it to the scene's body
  for (const a of worn.adds) {
    const own = OWN_MW_ARMOR.find((o) => o.id === a.recordId);
    const part = ownArmorParts(own).find((p) => p.model === a.model);
    assert.deepEqual(a.skinFrom, part.skinFrom ?? own.skinFrom, `${a.slot}: its part's own body, else its piece's`);
    assert.equal(a.fit, own.fit);
    assert.deepEqual(a.fitFrom, [...new Set(own.fit.map((r) => r.to))]);
    assert.equal(a.solvePose, 'bind', `${a.slot}: MW-STEEL2 - solved in the body's bind pose`);
  }
  assert.deepEqual(worn.adds.find((a) => a.partName === 'skirt').skinFrom, ['groin', 'upperleg'], 'the skirt is skinned from the groin and the thighs it hangs over');
  // the law stands over them: a worn skirt (clothing's, base priority 3) reserves the groin and both upper legs, so it
  // covers the greaves as it covers retail's
  const skirted = composeWornArmor({ pieces: [...SET, { kind: 'clothing', name: 'Short Skirt' }], armors: [], clothes: [{ id: 'common_skirt_01', type: 7, model: 'c/skirt.nif', parts: [{ part: 5, male: 'c_skirt' }] }],
    bodyPool: [{ id: 'c_skirt', model: 'c/c_skirt.nif' }] });
  assert.equal(skirted.adds.find((a) => a.partName === 'skirt').model, 'c/c_skirt.nif');
  assert.equal(skirted.adds.some((a) => a.partName === 'right upper leg' || a.partName === 'left upper leg'), false, 'the skirt\'s reserve covers the greaves');
});

test('MW-STEEL1: the Steel Helm switch picks the helm - closed by default, open on asking, and anything else is the default', () => {
  assert.deepEqual(STEEL_HELM_STYLES, ['closed', 'open']);
  assert.equal(STEEL_HELM_DEFAULT, 'closed', 'Mac\'s answer: closed by default');
  const helm = (helmStyle) => composeWornArmor({ pieces: [SET[5]], armors: [], bodyPool: [], helmStyle }).adds.map((a) => a.model);
  assert.deepEqual(helm(undefined), ['steel_plate_helm_closed.nif']);
  assert.deepEqual(helm('closed'), ['steel_plate_helm_closed.nif']);
  assert.deepEqual(helm('open'), ['steel_plate_helm_open.nif']);
  assert.deepEqual(helm('visor-up'), ['steel_plate_helm_closed.nif']);
  assert.deepEqual(ownArmorParts(ownArmorModelFor(SET[0]), { helmStyle: 'open' }).map((p) => p.model), ['steel_plate_cuirass.nif', 'steel_plate_skirt.nif'], 'a piece with no styles is its parts in either');
  // the switch is a Features row of the port's own, the viewer's, closed by default
  const row = FEATURES.find((f) => f.id === 'steel-helm');
  assert.deepEqual([row.group, row.kinds, row.control.key, row.control.initial, row.control.online, row.control.tiers], ['combat', ['enhanced'], 'mwSteelHelm', 'closed', 'player', [['closed', 'Closed'], ['open', 'Open']]]);
  assert.equal(FEATURE_PREF_DEFAULTS.mwSteelHelm, STEEL_HELM_DEFAULT);
  assert.deepEqual(row.control.tiers.map(([v]) => v), STEEL_HELM_STYLES, 'the switch\'s values are the helm\'s styles');
  // read where the worn set is composed, and the tile rebuilds the standing body
  const fp = sourceText('src/combat/fpArm.js');
  assert.match(fp, /const helmStyle = getPref\('mwSteelHelm'\);/);
  assert.match(fp, /bodyPool: parts, female, colourOf, helmStyle \}, showNudity\(\)\)/);
  assert.match(fp, /bodyPool: parts, female, colourOf: probe, helmStyle \}\)/);
  const menu = sourceText('src/ui/enhancedMenu.js');
  assert.match(menu, /\n  mwSteelHelm: rebuildMorrowindBody,/);
  assert.match(menu, /set: \(i\) => \{ \(c\.write \?\? \(\(v\) => setPref\(c\.key, v\)\)\)\(c\.tiers\[i\]\[0\]\); TILE_AFTER\[c\.key\]\?\.\(\); \} \};/, 'a choice\'s write takes its after-step too');
});

// ── the fit ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL1: fitShift keeps a garment to the SCENE\'s body - per axis, the wearer\'s feature less the scene\'s; \'self\' is the garment\'s own; a later rule\'s axis wins; no part, no move', () => {
  const skeleton = buildSkeleton(parseNif(plateSkeleton([0, 0, 0])));
  const pose = poseSkeleton(skeleton, null, null, 0, {});
  const ctx = { skeleton, pose, mats: skeletonSpaceMatrices(skeleton, pose, GRAPH_ROOT), skinBatch };
  const at = (min, max) => sourceSkin({ positions: Float32Array.from([...min, ...max]), indices: new Uint16Array(0) }, { attachRef: skeleton.byName.get('bip01') });
  const anchors = new Map([['neck', [at([-4, -3, 120], [4, 5, 130])]], ['foot', [at([-2, -1, 2], [2, 6, 5])]]]);
  const garment = { positions: Float32Array.from([-10, -10, 50, 10, 10, 100]) };
  const scene = { min: [-3, -4, 110], max: [3, 4, 122] };
  const r = fitShift([garment], anchors, [{ to: 'neck', x: 'centre', y: 'max', z: 'min', scene }], ctx);
  assert.deepEqual(r.shift, [0, 1, 10]);
  assert.deepEqual(r.by, [{ to: 'neck', axes: ['x', 'y', 'z'] }]);
  const two = fitShift([garment], anchors, [{ to: 'neck', x: 'centre', y: 'centre', z: 'min', scene }, { to: 'foot', z: 'min', scene: 'self' }], ctx);
  assert.deepEqual(two.shift, [0, 1, -48], 'the feet set the height: the garment\'s own lowest point to the foot\'s');
  assert.equal(fitShift([garment], anchors, [{ to: 'head', z: 'max', scene }], ctx), null, 'no head, no move');
  assert.deepEqual(fitShift([garment], anchors, [{ to: 'head', z: 'max', scene }, { to: 'foot', z: 'max', scene: 'self' }], ctx).shift, [0, 0, -95]);
  const moved = shiftBatch(garment, [1, 2, 3]);
  assert.notEqual(moved.positions, garment.positions, 'a copy');
  assert.deepEqual(Array.from(moved.positions), [-9, -8, 53, 11, 12, 103]);
  assert.equal(garment.positions[0], -10);
});

test('MW-STEEL1: through the real binder, on a body standing off the scene\'s, every piece lands moved by exactly that much - the helm by the head, the boots by the feet, the rest by the neck - and the notes say so', async () => {
  const { asm, worn } = await wearSet({ helmStyle: 'closed' });
  assert.ok(asm.ok, asm.error);
  for (const a of worn.adds) {
    const baked = flattenNif(parseNif(onDisk(`src/assets/mw/meshes/${a.model}`))).map((b) => b.positions);
    const drawn = zone(asm, a.slot);
    assert.ok(drawn.length >= 1, `${a.slot} is drawn`);
    assert.ok(drawn.every((p) => p.kind === 'skinned'), `${a.slot} is drawn by skinBatch, the body's own door`);
    const b0 = bounds(baked); const b1 = bounds(drawn.map((p) => p.positions));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(b1.min[k] - b0.min[k] - DELTA[k]) < 0.01 && Math.abs(b1.max[k] - b0.max[k] - DELTA[k]) < 0.01, `${a.slot} moved ${b1.min[k] - b0.min[k]} on axis ${k}, not ${DELTA[k]}`);
  }
  assert.ok(asm.notes.includes('hair (daggerfall_steel_helm): fitted to the head (xyz) - moved 0.5, 1.5, 4.0'), asm.notes.join('; '));
  assert.ok(asm.notes.includes('cuirass (daggerfall_steel_cuirass): fitted to the neck (xyz) - moved 0.5, 1.5, 4.0'));
  assert.ok(asm.notes.includes('right foot (daggerfall_steel_boots): fitted to the neck (xy) and foot (z) - moved 0.5, 1.5, 4.0'));
  // the open helm too, by the same head
  const open = await wearSet({ helmStyle: 'open' });
  assert.equal(zone(open.asm, 'hair (daggerfall_steel_helm)').length, 1);
  assert.ok(open.asm.notes.includes('hair (daggerfall_steel_helm): fitted to the head (xyz) - moved 0.5, 1.5, 4.0'));
});

test('MW-STEEL1: a sided piece copies its own side of the body - no right greave vertex rides the left thigh - and a body vertex\'s side is its heaviest bone\'s', async () => {
  assert.deepEqual(['bip01 l thigh', 'Bip01 R Forearm', 'left upper leg', 'right hand', 'bip01 pelvis', 'chest', 'bip01 spine1', ''].map(boneSide),
    ['left', 'right', 'left', 'right', null, null, null, null]);
  assert.deepEqual(['right hand', 'left pauldron', 'right upper leg', 'cuirass', 'skirt', 'hair'].map(sideOfPart), ['right', 'left', 'right', null, null, null]);
  const { asm, worn } = await wearSet({});
  const bonesOf = (slot) => new Set(zone(asm, slot).flatMap((p) => p.batch.skin.bones.map((b) => b.name)));
  for (const a of worn.adds) {
    const side = sideOfPart(a.partName);
    if (!side) continue;
    const other = side === 'right' ? 'left' : 'right';
    const crossed = [...bonesOf(a.slot)].filter((n) => boneSide(n) === other);
    assert.deepEqual(crossed, [], `${a.slot} copies no ${other} bone`);
  }
  assert.ok(bonesOf('right upper leg (daggerfall_steel_greaves)').has('right upper leg'));
  assert.ok(bonesOf('right upper leg (daggerfall_steel_greaves)').has('groin'), 'the midline serves both sides');
  // without the side, the right greave's inner face reaches the left thigh where the two meet - the defect. The thighs
  // in the binder's own order (PART_BONES: the left first), where the fixture's two thighs touch at x = 0 and a tie
  // goes to the first
  const skeleton = buildSkeleton(parseNif(plateSkeleton(DELTA)));
  const pose = poseSkeleton(skeleton, null, null, 0, {});
  const ctx = { skeleton, pose, mats: skeletonSpaceMatrices(skeleton, pose, GRAPH_ROOT), skinBatch };
  const thigh = plateBody(DELTA).find((r) => r.slot === 'upperleg');
  const nif = parseNif(thigh.bytes);
  assert.deepEqual(PART_BONES.upperleg, ['left upper leg', 'right upper leg']);
  const legs = PART_BONES.upperleg.map((bone) => {
    const b = flattenNif(nif)[0];
    const ref = skeleton.byName.get(bone);
    return sourceSkin(b, { attachRef: ref, mirrored: bone.startsWith('left'), attachName: bone });
  });
  const greave = flattenNif(parseNif(onDisk('src/assets/mw/meshes/steel_plate_greave_right.nif')))[0];
  const g = shiftBatch(greave, DELTA);
  const unsided = transferSkin(g, legs, ctx).flatMap((p) => p.skin.bones.map((b) => b.name));
  const sided = transferSkin(g, legs, ctx, { side: 'right' }).flatMap((p) => p.skin.bones.map((b) => b.name));
  assert.ok(unsided.includes('left upper leg'), 'unsided, a right greave vertex copies the left thigh');
  assert.deepEqual([...new Set(sided)], ['right upper leg']);
});

test('MW-STEEL1: posed, the plate rides the body - the gauntlet with the bent forearm, the greave with the striding thigh, the helm with the turning head', async () => {
  const { asm } = await wearSet({});
  const deg = Math.PI / 180;
  const q = (axis, a) => [Math.cos(a / 2), ...axis.map((c) => c * Math.sin(a / 2))];
  const keyed = new Map([['bip01 r forearm', q([0, 0, 1], 70 * deg)], ['bip01 l thigh', q([1, 0, 0], -35 * deg)], ['bip01 head', q([0, 0, 1], 35 * deg)]]);
  const skeleton = asm.skeleton;
  const rest = new Map(asm.pieces.map((p) => [p, Float32Array.from(p.positions)]));
  const restPose = poseSkeleton(skeleton, null, null, 0, {});
  const restMats = skeletonSpaceMatrices(skeleton, restPose, GRAPH_ROOT);
  poseAssembly(asm, { tracks: new Map([...keyed.keys()].map((k) => [k, k])), sampleTrack: (t) => ({ rotation: keyed.get(t) }), time: 0 });
  const posedMats = skeletonSpaceMatrices(skeleton, poseSkeleton(skeleton, new Map([...keyed.keys()].map((k) => [k, k])), (t) => ({ rotation: keyed.get(t) }), 0, {}), GRAPH_ROOT);
  // every vertex of a piece copied from ONE bone moves exactly as that bone moves
  const apply = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
  const inv = (m, p) => { const d = [p[0] - m.t[0], p[1] - m.t[1], p[2] - m.t[2]]; return [0, 1, 2].map((c) => m.a[c] * d[0] + m.a[3 + c] * d[1] + m.a[6 + c] * d[2]); };
  for (const [slot, bone] of [['right hand (daggerfall_steel_gauntlets)', 'right forearm'], ['left upper leg (daggerfall_steel_greaves)', 'left upper leg'], ['hair (daggerfall_steel_helm)', 'head']]) {
    let checked = 0; let worst = 0;
    for (const p of zone(asm, slot)) {
      const only = p.batch.skin.bones.filter((b) => b.indices.length);
      if (only.length !== 1 || only[0].name !== bone) continue;
      const ref = only[0].ref;
      const r0 = rest.get(p);
      for (let i = 0; i < p.positions.length; i += 3, checked++) {
        const want = apply(posedMats.get(ref), inv(restMats.get(ref), [r0[i], r0[i + 1], r0[i + 2]]));
        worst = Math.max(worst, Math.hypot(want[0] - p.positions[i], want[1] - p.positions[i + 1], want[2] - p.positions[i + 2]));
      }
    }
    assert.ok(checked > 20, `${slot} has vertices on ${bone} alone (${checked})`);
    assert.ok(worst < 1e-3, `${slot} rides ${bone} (worst ${worst.toFixed(5)})`);
    const moved = zone(asm, slot).some((p) => p.positions.some((v, i) => Math.abs(v - rest.get(p)[i]) > 1));
    assert.ok(moved, `${slot} moved with the pose`);
  }
});

// ── the first person ──────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL1: in first person the gauntlets are solved on the third-person skeleton and worn on the first person\'s by name - their fit to the forearm unchanged by a different rest', async () => {
  const rot = (axis, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const [x, y, z] = axis;
    return [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s, y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s, z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]; };
  const tpSkel = plateSkeleton(DELTA);
  // the first person's rig: its arms at another rest, and its nodes at other refs (a camera node first)
  const fpSkel = plateSkeleton(DELTA, { rotations: { 'Bip01 R UpperArm': rot([0, 1, 0], 60), 'Bip01 R Forearm': rot([0, 0, 1], 80), 'Bip01 L UpperArm': rot([0, 1, 0], -60) }, extra: ['Camera'] });
  assert.notEqual(buildSkeleton(parseNif(fpSkel)).byName.get('right forearm'), buildSkeleton(parseNif(tpSkel)).byName.get('right forearm'), 'the two rigs\' bones stand at different refs');
  const gauntlets = [{ templateIndex: 103, material: STEEL }];
  assert.deepEqual(fpWornAdds(composeWornArmor({ pieces: gauntlets, armors: [], bodyPool: [] }).adds).map((a) => a.partName), ['right hand', 'left hand'], 'the first person keeps the gauntlets');
  // the forearm drawn beside them, so the fit can be read off the drawn rig
  const withForearm = (adds) => adds;
  const offsets = async (skeleton, solveOn) => {
    const { asm, files } = await wearSet({ pieces: gauntlets, skeleton, solveOn, only: withForearm });
    const forearm = await assembleFirstPersonArm({ skeletonBytes: skeleton, parts: [{ slot: 'forearm', bones: ['right forearm'], bytes: files.get('meshes/forearm.nif') }] });
    const f = forearm.pieces[0].positions;
    const out = [];
    for (const p of zone(asm, 'right hand (daggerfall_steel_gauntlets)')) {
      if (!p.batch.skin.bones.some((b) => b.name === 'right forearm' && b.indices.length)) continue;
      for (let i = 0; i < p.positions.length; i += 3) {
        let best = Infinity;
        for (let j = 0; j < f.length; j += 3) best = Math.min(best, Math.hypot(p.positions[i] - f[j], p.positions[i + 1] - f[j + 1], p.positions[i + 2] - f[j + 2]));
        out.push(best);
      }
    }
    return { out, asm };
  };
  const tp = await offsets(tpSkel, null);
  const fp = await offsets(fpSkel, tpSkel);
  assert.ok(tp.out.length > 50);
  assert.equal(fp.out.length, tp.out.length, 'the same vertices on the forearm');
  assert.ok(Math.max(...tp.out.map((v, i) => Math.abs(v - fp.out[i]))) < 1e-3, 'the gauntlet sits on the first person\'s forearm exactly as on the third person\'s');
  // solved on the first person's own rest instead, the T-posed gauntlet finds the wrong body under it
  const naive = await offsets(fpSkel, null);
  assert.notEqual(naive.out.length, tp.out.length, 'solved on a rest that is not the scene\'s, it binds to other parts');
  assert.deepEqual(fp.asm.notes.filter((n) => /rule 40/.test(n)), [], 'every bone the gauntlet copied is on the first person\'s rig');
  // rebindSkin by name, and a bone the rig lacks is a null ref, said
  const b = { skin: { bones: [{ ref: 3, name: 'right forearm', indices: [0], weights: [1] }, { ref: 4, name: 'bip01 r finger9', indices: [1], weights: [1] }] } };
  const skeleton = buildSkeleton(parseNif(fpSkel));
  const r = rebindSkin(b, skeleton);
  assert.deepEqual(r.batch.skin.bones.map((x) => x.ref), [skeleton.byName.get('right forearm'), null]);
  assert.deepEqual(r.missing, ['bip01 r finger9']);
  // the build hands the first person's own adds the third-person body and skeleton
  const src = sourceText('src/combat/fpArm.js');
  assert.match(src, /const tpRows = ownFp\.length \? playerBodyRows\(parts, race, female, \{ beast, faceIndex, faceMatch \}\) : \[\];/);
  assert.match(src, /const tpSkeletonFile = ownFp\.length \? correctActorModelPath\(tpSkeletonPath\(\{ female, beast, werewolf \}\),/);
  assert.match(src, /\.\.\.ownBodyPart\(add, tpRows, find, tpSkeletonBytes\) \}\);/);
  assert.match(src, /\.\.\.\(tpSkeletonFile \? \[tpSkeletonFile\] : \[\]\),   \/\/ MW-STEEL1: the skeleton they are solved on/);
});

test('MW-STEEL1: ownBodyPaths and ownBodyPart are the one reading of the body under an own model - its skin slots and its fit\'s, shadowed or not; nothing for a retail add', () => {
  const rows = [{ slot: 'neck', record: { model: 'b/neck.nif' } }, { slot: 'foot', record: { model: 'b/foot.nif' } }, { slot: 'ankle', record: { model: 'b/ankle.nif' } }, { slot: 'knee', record: null }];
  const boots = composeWornArmor({ pieces: [SET[6]], armors: [], bodyPool: [] }).adds[0];
  assert.deepEqual(ownBodyPaths(boots, rows), {
    skinFrom: [{ slot: 'foot', path: 'meshes/b/foot.nif' }, { slot: 'ankle', path: 'meshes/b/ankle.nif' }],
    fitFrom: [{ slot: 'neck', path: 'meshes/b/neck.nif' }, { slot: 'foot', path: 'meshes/b/foot.nif' }],
  });
  const bytes = new Map([['meshes/b/neck.nif', Uint8Array.of(1)], ['meshes/b/foot.nif', Uint8Array.of(2)], ['meshes/b/ankle.nif', Uint8Array.of(3)]]);
  const find = (p) => (bytes.has(p) ? { get: () => bytes.get(p) } : null);
  const part = ownBodyPart(boots, rows, find, Uint8Array.of(9));
  assert.deepEqual(part.skinFrom.map((b) => [b.slot, b.bytes[0]]), [['foot', 2], ['ankle', 3]]);
  assert.deepEqual(part.fitFrom.map((b) => [b.slot, b.bytes[0]]), [['neck', 1], ['foot', 2]]);
  assert.equal(part.fit, boots.fit);
  assert.equal(part.fitTo, null);
  assert.deepEqual(Array.from(part.solveOn), [9]);
  assert.deepEqual(ownBodyPart({ slot: 'x', model: 'm.nif', bones: ['chest'] }, rows, find), {}, 'a retail add takes nothing more');
  assert.equal('solveOn' in ownBodyPart(boots, rows, find), false, 'the third person solves on its own skeleton');
  // and both rigs read it
  const fp = sourceText('src/combat/fpArm.js');
  assert.match(fp, /\.\.\.ownBodyPart\(row, rows, find\) \}\);/);
  assert.match(fp, /\.\.\.ownBodyPart\(add, tpRows, find, tpSkeletonBytes\) \}\);/);
  assert.equal(ARMO_PART.find((r) => r.name === 'hair').shadows, 'hair', 'the helm\'s slot hides the hair and nothing else');
});

test('MW-STEEL1: the scene\'s body is measured - the fits name the head, the neck and the feet, the bounds are the twelve numbers the import printed', () => {
  assert.deepEqual(STEEL_PLATE_SCENE, {
    head: { min: [-4.764463, -5.649226, 113.146219], max: [4.764463, 9.197224, 129.199977] },
    neck: { min: [-3.895279, -4.097911, 109.962381], max: [3.895279, 3.687286, 121.834567] },
  });
  const fits = Object.fromEntries(OWN_MW_ARMOR.filter((a) => a.fit).map((a) => [a.id, a.fit.map((r) => `${r.to}:${['x', 'y', 'z'].map((k) => r[k] ?? '-').join('/')}:${r.scene === 'self' ? 'self' : r.scene === STEEL_PLATE_SCENE.neck ? 'neck' : 'head'}`)]));
  assert.deepEqual(fits, {
    daggerfall_steel_cuirass: ['neck:centre/centre/min:neck'],
    daggerfall_steel_gauntlets: ['neck:centre/centre/min:neck'],
    daggerfall_steel_greaves: ['neck:centre/centre/min:neck'],
    daggerfall_steel_left_pauldron: ['neck:centre/centre/min:neck'],
    daggerfall_steel_right_pauldron: ['neck:centre/centre/min:neck'],
    daggerfall_steel_helm: ['head:centre/min/max:head'],
    daggerfall_steel_boots: ['neck:centre/centre/-:neck', 'foot:-/-/min:self'],
  });
});
