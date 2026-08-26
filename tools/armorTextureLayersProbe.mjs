import assert from 'node:assert/strict';
import fs from 'node:fs';

const viewer = fs.readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
const armorTex = fs.readFileSync(new URL('../src/tools/paperdoll/armorTexture.js', import.meta.url), 'utf8');

for (const api of ['buildClassicBodyArmorSampler', 'buildClassicArmorPieceTexture'])
  assert.ok(armorTex.includes(`export async function ${api}`), `missing ${api}`);
assert.ok(armorTex.includes('DYE_TARGETS.WeaponsAndArmor'), 'armor must use the classic weapons/armor dye band');
assert.ok(armorTex.includes('armorArchive(gender, race)'), 'armor must resolve the classic gender/race archive');
assert.ok(armorTex.includes('clampArmorVariant(item.index, material'), 'armor must use the concrete classic material variant clamp');
assert.ok(armorTex.includes("profileForArmor() { return 'armor-front'; }"), 'armor must use detail-preserving front registration');

assert.ok(viewer.includes('armorBodyOwnerMap()'), 'body armor needs explicit face ownership');
assert.ok(viewer.includes("return armor?.ownsFace?.(f) ? armor(f, u, v) : null"), 'armor must suppress clothing on owned faces');
assert.ok(viewer.includes("ARMOR_OUTER_DRAPES = new Set(['Casual Cloak', 'Formal Cloak', 'Dwynnen Surcoat', 'Anticlere Surcoat'])"), 'outer drape exception set missing');
assert.ok(viewer.includes('const armorAllows = !armorOn.size || ARMOR_OUTER_DRAPES.has(cur)'), 'non-outer drapes must hide under armor');
assert.ok(viewer.includes('buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, material, variant })'), 'piece armor must receive concrete material + variant source textures');
console.log('armor texture/layer probe: PASS');
