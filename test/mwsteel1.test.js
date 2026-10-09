// MW-STEEL1 (2026-10-06, Mac: "These 2 files are for the armor replacement of the morrowind steel armor with a
// varient to toggle the helmet type"): MAC'S STEEL PLATE, THE WHOLE CLASSIC SET, ON THE MORROWIND BODY.
//
// Daggerfall's seven classic pieces in Steel wear Mac's plate in place of retail's steel_* records (Steel only - his
// answer); the helm comes closed (a visor and a plume) or open (a nasal helm), by the Steel Helm switch, closed by
// default. These pins hold the bake to the committed sources and retail's skeleton byte for byte, the sources to
// carrying none of the Morrowind body Mac's scene fitted the plate on, the item map to Steel alone, the composer's
// slots and shadows, the plate skirt's slot, and the switch. How the plate is rigged and worn - skinned at bake time,
// as retail's armour is - is test/mwsteel4.test.js's (MW-STEEL4, which retired MW-STEEL1-3's runtime fit and solve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { composeWornArmor, mwArmorRecords, itemMapCoverage, mwItemReport, ARMO_PART } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import {
  CLASSIC_ARMOR_TEMPLATE, STEEL_HELM_STYLES, STEEL_HELM_DEFAULT, ownArmorModelFor, ownArmorParts, ownArmorModelPaths, RRI_JERKIN_TEMPLATE,
} from '../src/characters/ownArmorModels.js';
import { readPng } from '../tools/pngIO.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { stripFbx, meshModelNames } from '../tools/fbxStrip.mjs';
import {
  SOURCE, TEXTURES, PIECES, REFERENCE_PARTS, SCENE_BODY, RETAIL_SKELETON, bakeSteelPlate, bakeObject, meshFile, textureFile, textureName, objectTree,
} from '../tools/bakeSteelPlate.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const STEEL = ARMOR_MATERIAL.Steel;
const SET = [102, 103, 104, 105, 106, 107, 108].map((templateIndex) => ({ templateIndex, material: STEEL }));

// ── the bake ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL1: every shipped mesh and texture is re-made from the committed sources byte for byte, and read back as the port reads it', () => {
  const pngs = Object.fromEntries(Object.entries(TEXTURES).map(([t, p]) => [t, raw(p)]));
  const baked = bakeSteelPlate({ set: raw(SOURCE.set), openHelm: raw(SOURCE.openHelm), pngs, skeleton: raw(RETAIL_SKELETON) });   // MW-STEEL4: skinned in retail's bind; MW-STEEL5: two sources
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
  assert.equal(sha(SOURCE.set), '4a68e08da934267f7675fb19af441d4ec8dac58274a1e27a77e46650754ea303');   // MW-STEEL5: Mac's steel_armor.fbx as it came
  assert.equal(sha(SOURCE.openHelm), 'f51a41c3d3a150c4ee46e012ddb6ce52fa3b816b9e4fbb717bc3901acf2d0a58');   // MW-STEEL5: the open helm alone, out of MW-STEEL2's source
  for (const [name, bytes] of [['set', raw(SOURCE.set)], ['open helm', raw(SOURCE.openHelm)]]) {
    for (const ref of Object.values(REFERENCE_PARTS)) assert.equal(meshModelNames(bytes).includes(ref), false, `the ${name} source carries no ${ref}`);
    assert.equal(bytes.includes(Buffer.from('tx_b_n_breton')), false, `the ${name} source names no Morrowind body texture`);
    assert.equal(readFbx(bytes).version, 7400);
  }
  assert.deepEqual(meshModelNames(raw(SOURCE.openHelm)), ['Sphere.002'], 'the open helm is committed alone');
  // MW-STEEL2: the plate skirt under the breastplate is kept since its painting came, and baked as the set's skirt
  assert.ok(meshModelNames(raw(SOURCE.set)).includes('Imperial_Silver_Cuirass_67_Male.011'), 'the set\'s source keeps the skirt');
  assert.deepEqual(PIECES.find((p) => p.id === 'skirt').shapes.map((x) => [x.object, x.texture]), [['Imperial_Silver_Cuirass_67_Male.011', 'skirt']]);
  // a piece moved past the slack is refused by name
  const tree = readFbx(raw(SOURCE.set));
  assert.throws(() => bakeObject(tree, 'Cube.024', [[0.32, -6.48, -0.21], [11.33, 14.61, 48.2]]), /"Cube\.024" stands at .* not where its piece was read/);
  assert.doesNotThrow(() => bakeObject(tree, 'Cube.024', [[0.32, -6.48, -0.21], [11.33, 14.61, 48.13]]));
  assert.throws(() => objectTree(tree, 'Breton_Male.003'), /no Mesh object "Breton_Male\.003"/);
});

test('MW-STEEL1: the strip copies every record it keeps byte for byte - nothing dropped is nothing changed, and a dropped object takes only what hangs from it alone', () => {
  const src = raw(SOURCE.set);
  assert.equal(Buffer.compare(stripFbx(src, { drop: [] }).bytes, src), 0, 'an empty strip is the file');
  const { bytes, dropped } = stripFbx(src, { drop: ['Sphere'] });
  assert.deepEqual(dropped.map((d) => [d.kind, d.name]), [['Geometry', 'Sphere.003'], ['Model', 'Sphere'], ['Material', 'Material.037'], ['Texture', 'base_color_texture'], ['Video', 'DefaultMaterial_2D_View_<UDIM>.png.003']]);
  assert.equal(meshModelNames(bytes).includes('Sphere'), false);
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

test('MW-STEEL1: the scene\'s body is measured - the bounds of the Breton head and neck the import stripped, the twelve numbers it printed', () => {
  assert.deepEqual(SCENE_BODY, {
    head: { min: [-4.764463, -5.649226, 113.146219], max: [4.764463, 9.197224, 129.199977] },
    neck: { min: [-3.895279, -4.097911, 109.962381], max: [3.895279, 3.687286, 121.834567] },
  });
  assert.deepEqual(Object.keys(REFERENCE_PARTS), Object.keys(SCENE_BODY), 'a bound for every part stripped');
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
  // MW-STEEL2: the plate skirt is the Steel Cuirass's second part - Morrowind's skirt slot, which hides no skin
  assert.deepEqual(ownArmorModelFor(SET[0]).parts.map((p) => [p.part, p.model]), [['cuirass', 'steel_plate_cuirass.nif'], ['skirt', 'steel_plate_skirt.nif']]);
  assert.deepEqual(ARMO_PART.find((r) => r.name === 'skirt'), { name: 'skirt', bones: ['groin'], shadows: null });
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

