import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ARMOR_MATERIAL,
  MATERIAL_FAMILY,
  armorFamilyOfMaterial,
  clampArmorVariant,
} from '../src/systems/armorMaterials.js';
import { CLOTHING_DYES } from '../src/characters/dyes.js';

const viewer = fs.readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
const armorTex = fs.readFileSync(new URL('../src/tools/paperdoll/armorTexture.js', import.meta.url), 'utf8');
const clothTex = fs.readFileSync(new URL('../src/tools/paperdoll/clothingTexture.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../viewer.html', import.meta.url), 'utf8');

const materialNames = Object.entries(ARMOR_MATERIAL).filter(([, value]) => value >= 0).map(([name]) => name);
assert.deepEqual(materialNames, [
  'Leather', 'Chain', 'Chain2', 'Iron', 'Steel', 'Silver', 'Elven', 'Dwarven',
  'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric',
]);
assert.equal(armorFamilyOfMaterial(ARMOR_MATERIAL.Leather), MATERIAL_FAMILY.Leather);
assert.equal(armorFamilyOfMaterial(ARMOR_MATERIAL.Chain), MATERIAL_FAMILY.Chain);
assert.equal(armorFamilyOfMaterial(ARMOR_MATERIAL.Chain2), MATERIAL_FAMILY.Chain);
assert.equal(armorFamilyOfMaterial(ARMOR_MATERIAL.Daedric), MATERIAL_FAMILY.Plate);

// Every legal classic armor record variant remains reachable through the viewer's
// requested 0..max axis, while SetVariant performs the per-slot material clamp.
assert.deepEqual([0,1,2,3,4,5,6].map((v) => clampArmorVariant(102, ARMOR_MATERIAL.Steel, v)), [1,1,2,3,3,3,3]);
assert.deepEqual([0,1,2,3,4,5,6].map((v) => clampArmorVariant(104, ARMOR_MATERIAL.Steel, v)), [2,2,2,3,4,5,5]);
assert.equal(clampArmorVariant(104, ARMOR_MATERIAL.Chain2, 0), 6);
assert.equal(CLOTHING_DYES.length, 10, 'all ten classic clothing dyes must be exposed');

for (const id of ['armormat', 'armorvariant', 'clothvariant', 'clothdye'])
  assert.ok(html.includes(`id="${id}"`), `viewer missing ${id} control`);
assert.ok(viewer.includes('ARMOR_MATERIAL_OPTIONS'), 'viewer must enumerate concrete armor materials');
assert.ok(viewer.includes('armorVariantMax'), 'viewer must expose the armor variant axis');
assert.ok(viewer.includes('classicClothingVariant'), 'viewer must expose clothing variants');
assert.ok(viewer.includes('CLOTHING_DYES[classicClothingDyeIx]'), 'viewer must apply clothing dyes');
assert.ok(armorTex.includes('dyeForMaterial(material)'), 'armor source must use material-specific classic dye');
assert.ok(armorTex.includes('clampArmorVariant(item.index, material'), 'armor source must clamp against concrete material');
assert.ok(clothTex.includes("profile === 'armor-front'"), 'armor front reconstruction profile missing');
assert.ok(clothTex.includes('Math.min(rawFrontRecovery, 0.58)'), 'armor detail-preserving perspective cap missing');

console.log('variant matrix probe: PASS');
