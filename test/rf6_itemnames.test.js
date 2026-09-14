// RF6 - THE ENHANCED SKIN READS THE ONE NAME RESOLVER (2026-09-14,
// Mac's refactor pass, the sixth). The enhanced inventory's line and
// the loot plaque rebuilt ResolveItemLongName's arms by hand -
// ResolveItemName for the name, materialName for the sub-line - and
// lost four of them: an arrow, a helm under HelmAndShieldMaterialDisplay,
// an artifact and a Legendary all showed a material DFU withholds; a
// potion read "Glass Bottle", a plant lost its (northern), a soul trap
// its soul, a quest letter its signoff. The wear notices and the HUD's
// held-weapon plaque read the record's raw `name`, which names an
// unidentified magic item. Now itemInfo.itemNameParts answers the two
// parts ONCE, itemLongName is their join, and the four readers read it.
// The laws pinned here:
//   - THE PARTS JOIN TO THE LONG NAME, over every mint and every arm.
//   - THE SKIN AND THE PLAQUE READ THE PARTS: the same name, the same
//     material, arm for arm; the notices and the HUD the long name.
//   - NO SECOND DERIVATION: no enhanced module reads materialName or
//     resolveItemName or the raw record name for a label.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemNameParts, itemLongName, resolveItemName, materialName, armorShouldShowMaterial, questLetterName } from '../src/systems/itemInfo.js';
import { LOOT_MATRICES, generateItems, createPotion, CLASSIC_RECIPE_KEYS } from '../src/systems/loot.js';
import { applyRarity } from '../src/systems/lootRarity.js';
import { mintCondition, templateByIndex } from '../src/systems/itemTemplates.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { SOUL_TRAP_TEMPLATE } from '../src/systems/mysticism.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { setValue, _resetForTests as resetSettings } from '../src/systems/settings.js';
import { itemLine } from '../src/ui/enhancedInventory.js';
import { hoverLines } from '../src/ui/lootHover.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

const sword = (over = {}) => mintCondition({ group: 'Weapons', templateIndex: 120, material: 4, name: templateByIndex(120)?.name, ...over });
const helm = (over = {}) => mintCondition({ group: 'Armor', templateIndex: TEMPLATES.Helm, material: ARMOR_MATERIAL.Iron, name: templateByIndex(TEMPLATES.Helm)?.name, ...over });
const letter = { group: 'UselessItems2', templateIndex: TEMPLATES.Parchment, questItem: true, questUID: 3, questSymbol: { name: '_letter_' } };
const quest = {
  uid: 3, hooks: {},
  getItem: () => ({ usedMessageID: 1016 }),
  getMessage: (id) => (id === 1016 ? { getTextTokens: () => [{ text: 'Meet me at the docks.' }, { text: '' }, { text: 'yours truly, Baron Snide' }] } : null),
  getResource: () => null,
};
const getQuest = () => quest;

/** Every arm, and the loot tables besides. */
function corpus() {
  const out = [
    sword(), sword({ enchantments: [{ type: 3, param: 1 }] }), sword({ enchantments: [{ type: 3, param: 1 }], isIdentified: true }),
    sword({ artifact: true, name: 'Azura\'s Star' }), applyRarity(sword(), 'legendary', lcg(2)), applyRarity(sword(), 'rare', lcg(3)),
    { group: 'Weapons', templateIndex: TEMPLATES.Arrow, material: 4, name: templateByIndex(TEMPLATES.Arrow)?.name, stackCount: 20 },
    helm(), helm({ material: ARMOR_MATERIAL.Leather }), helm({ material: ARMOR_MATERIAL.Chain }), helm({ material: ARMOR_MATERIAL.Daedric }),
    { group: 'PlantIngredients1', templateIndex: 8 }, { group: 'PlantIngredients2', templateIndex: 3 }, { group: 'PlantIngredients1', templateIndex: 20 },
    { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: 23 }, { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE },
    letter, { ...letter, questItem: false },
    ...CLASSIC_RECIPE_KEYS.map(createPotion),
  ];
  for (const key of Object.keys(LOOT_MATRICES)) for (let seed = 1; seed <= 6; seed++) out.push(...generateItems(key, { level: 14, gender: 'male' }, lcg(seed * 131 + key.charCodeAt(0))));
  return out;
}

test('RF6: the two parts join to ResolveItemLongName, arm for arm, over every mint', () => {
  const opts = { getQuest };
  let n = 0;
  for (const setting of [0, 1, 2, 3]) {
    resetSettings(); setValue('GUI', 'HelmAndShieldMaterialDisplay', setting);
    try {
      for (const it of corpus()) {
        const p = itemNameParts(it, opts);
        assert.equal(typeof p.name, 'string'); assert.equal(typeof p.material, 'string');
        assert.equal(itemLongName(it, opts), p.material ? `${p.material} ${p.name}` : p.name, `the join is the long name (${JSON.stringify(it).slice(0, 80)})`);
        n++;
      }
      // the helm's material follows the setting through the one arm
      for (const h of [helm(), helm({ material: ARMOR_MATERIAL.Leather }), helm({ material: ARMOR_MATERIAL.Chain }), helm({ material: ARMOR_MATERIAL.Daedric })]) {
        assert.equal(itemNameParts(h).material, armorShouldShowMaterial(h) ? materialName(h) : '', `helm under setting ${setting}`);
      }
    } finally { resetSettings(); }
  }
  assert.ok(n > 800, `the corpus (${n})`);
  // the arms DFU withholds a material from
  assert.deepEqual(itemNameParts({ group: 'Weapons', templateIndex: TEMPLATES.Arrow, material: 4, name: 'Arrow' }), { name: 'Arrow', material: '' }, 'an arrow');
  assert.equal(itemNameParts(sword({ artifact: true, name: 'Azura\'s Star' })).material, '', 'an artifact');
  const leg = applyRarity(sword(), 'legendary', lcg(2));
  assert.ok(leg.legendary); assert.equal(itemNameParts(leg).material, '', 'a Legendary (LR2)');
  const unid = sword({ enchantments: [{ type: 3, param: 1 }] });
  assert.deepEqual(itemNameParts(unid), { name: templateByIndex(120).name, material: '' }, 'unidentified: the bare template, no material');
  assert.equal(itemNameParts(sword()).material, materialName(sword()), 'a plain sword shows its material');
  // and the arms that REPLACE or APPEND
  assert.equal(itemNameParts(createPotion(221871)).name, 'Potion of Stamina', '%po');
  assert.equal(itemNameParts({ group: 'PlantIngredients1', templateIndex: 8 }).name, `${resolveItemName({ group: 'PlantIngredients1', templateIndex: 8 })} (northern)`);
  assert.equal(itemNameParts({ group: 'PlantIngredients2', templateIndex: 3 }).name, `${resolveItemName({ group: 'PlantIngredients2', templateIndex: 3 })} (southern)`);
  assert.equal(itemNameParts({ group: 'PlantIngredients1', templateIndex: 8 }, { differentiatePlantIngredients: false }).name, resolveItemName({ group: 'PlantIngredients1', templateIndex: 8 }));
  const trap = { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: 23 };
  assert.match(itemNameParts(trap).name, /^Soul Trap \(.+\)$/, 'the soul appended');
  assert.equal(itemNameParts(letter, { getQuest }).name, questLetterName(letter, getQuest), 'the signoff');
  assert.equal(itemNameParts(letter, { getQuest }).name, 'Letter: yours truly, Baron Snide ');
  assert.equal(itemNameParts(letter).name, resolveItemName(letter), 'no quest machine: the plain parchment');
});

test('RF6: the enhanced line and the plaque read the parts - the same name and material as the long name, arm for arm', () => {
  for (const it of corpus()) {
    if (!templateByIndex(it.templateIndex)) continue;
    const p = itemNameParts(it);
    const line = itemLine(it);
    assert.equal(line.name, p.name, `the line's name (${JSON.stringify(it).slice(0, 80)})`);
    assert.equal(line.material, p.material || null, `the line's material (${JSON.stringify(it).slice(0, 80)})`);
    assert.equal(hoverLines([it]).shown[0].name, p.name, 'the plaque\'s row');
  }
  // the four the skin used to get wrong
  assert.equal(itemLine(createPotion(221871)).name, 'Potion of Stamina', 'not "Glass Bottle"');
  assert.equal(hoverLines([createPotion(221871)]).shown[0].name, 'Potion of Stamina');
  assert.equal(itemLine({ group: 'Weapons', templateIndex: TEMPLATES.Arrow, material: 4, name: 'Arrow' }).material, null, 'an arrow names no material');
  assert.equal(itemLine(sword({ artifact: true, name: 'Azura\'s Star' })).material, null, 'nor an artifact');
  assert.equal(itemLine(applyRarity(sword(), 'legendary', lcg(2))).material, null, 'nor a Legendary');
  assert.match(itemLine({ group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: 23 }).name, /\(.+\)$/, 'a soul trap names its soul');
  assert.equal(itemLine({ templateIndex: -1 }).name, 'Unknown', 'U54: a real unknown still says so');
});

test('RF6: no second derivation - the enhanced modules read the resolver, never materialName, resolveItemName or the raw record name for a label', () => {
  const info = read('src/systems/itemInfo.js');
  assert.match(info, /export function itemLongName\(item, opts\) \{\s*const \{ name, material \} = itemNameParts\(item, opts\);\s*return material \? `\$\{material\} \$\{name\}` : name;\s*\}/, 'the long name IS the join');
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /const parts = itemNameParts\(item, \{ getQuest: deps\.getQuest \?\? null \}\);/, 'the line reads the parts, the quest machine through');
  assert.match(inv, /name: parts\.name \|\| t\?\.name \|\| 'Unknown',/);
  assert.match(inv, /material: parts\.material \|\| null,/);
  assert.match(inv, /const named = itemLongName\(item, \{ getQuest: deps\.getQuest \?\? null \}\);[\s\S]*?\$\{named\} is broken[\s\S]*?may not use \$\{named\}[\s\S]*?\$\{named\} cannot be worn/, 'the three notices name through the resolver');
  assert.match(read('src/ui/lootHover.js'), /name: itemNameParts\(it\)\.name \|\| 'Something',/, 'the plaque');
  assert.match(read('src/ui/enhancedHud.js'), /const weaponName = held2 \? itemLongName\(held2\) : null;/, 'the HUD\'s held weapon');
  const files = readdirSync(join(root, 'src/ui')).filter((f) => /^enhanced.*\.js$|^lootHover\.js$|^hud.*\.js$/.test(f));
  assert.ok(files.length >= 12);
  for (const f of files) {
    const src = read(`src/ui/${f}`).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /\bmaterialName\(|\bresolveItemName\(/, `${f} derives no name arm itself`);
    assert.doesNotMatch(src, /\$\{item\.name\}|held2\.name|\bit\.name \|\| 'Something'/, `${f} labels nothing by the raw record name`);
  }
});
