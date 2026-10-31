// SMITH-RRI (FIELD FEEDBACK 2026-10-31; Sammy, Discord #feature-feedback: "Add missing weapon types to be smithable
// (Light flail etc)") - every DFU weapon was already made at the anvil; Roleplay & Realism: Items' Light Flail (514) and
// Archer's Axe (513) were not. They are now (net/recipeLaw.js WEAPON_PRODUCTS): the Light Flail on the Mace's and the
// Flail's row, the Archer's Axe the axes' fittings at half the Battle Axe's ingots (3 kg to its 6). The anvil lists them
// only while the mod's weapon class stands (ui/professions/profPages.js anvilRecipes) - always online. Pinned through the
// real Worker. bible/06-Systems/Professions-Arc.md 59.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { WEAPON_PRODUCTS, recipeById, patternsOf, firstCraftKey, craftXp } from '../../src/net/recipeLaw.js';
import { temperRecipeOf, temperCost } from '../../src/net/temperLaw.js';
import { mintPieces } from '../../src/systems/smithItems.js';
import { weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { weaponSkillUsed } from '../../src/characters/weapons.js';
import { SKILLS } from '../../src/systems/skills.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { onlineForcedModSetting } from '../../src/systems/online/onlineLane.js';
import { anvilRecipes } from '../../src/ui/professions/profPages.js';

installRoleplayRealismItems({ fetchBytes: async () => new Uint8Array(0) });
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const ins = (id) => recipeById(id).inputs.map((i) => [i.key, i.n]);

test('SMITH-RRI law: the Light Flail (514) 3 ingots, 1 Copper and 1 Cured Leather - the Mace\'s and the Flail\'s row; the Archer\'s Axe (513) 2 ingots, 1 Copper and 1 Oak Plank - half the Battle Axe\'s 4, at half its weight; each at all eleven metals, its tier\'s rank (mutants: an ingot moved; a fitting moved; a template swapped)', () => {
  const two = WEAPON_PRODUCTS.filter((p) => p.templateIndex > 512).map((p) => [p.id, p.name, p.templateIndex, p.ingots, p.also.map(([k, n]) => [k, n])]);
  assert.deepEqual(two, [
    ['lightflail', 'Light Flail', 514, 3, [['metal:copper', 1], ['leather:cured', 1]]],
    ['archersaxe', 'Archer\'s Axe', 513, 2, [['metal:copper', 1], ['plank:oak', 1]]],
  ]);
  const row = (id) => WEAPON_PRODUCTS.find((p) => p.id === id);
  assert.deepEqual([row('lightflail').ingots, row('lightflail').also], [row('mace').ingots, row('flail').also], 'the Mace\'s and the Flail\'s row');
  assert.equal(row('archersaxe').ingots, row('battleaxe').ingots * templateByIndex(513).baseWeight / templateByIndex(127).baseWeight, 'half the Battle Axe\'s ingots at half its weight');
  assert.deepEqual(row('archersaxe').also, row('battleaxe').also, 'the axes\' fittings');
  assert.deepEqual([ins('lightflail:iron'), ins('archersaxe:daedric')], [
    [['ingot:iron', 3], ['metal:copper', 1], ['leather:cured', 1]], [['ingot:daedric', 2], ['metal:copper', 1], ['plank:oak', 1]]]);
  const metals = ['iron', 'steel', 'silver', 'moonstone', 'dwarven', 'mithril', 'adamantium', 'ebony', 'orichalcum', 'daedric', 'warforged'];
  assert.deepEqual(metals.map((m) => recipeById(`lightflail:${m}`).material), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 7]);
  assert.deepEqual(metals.map((m) => recipeById(`archersaxe:${m}`).rank), [0, 10, 25, 40, 40, 55, 70, 70, 70, 90, 70]);
  assert.deepEqual([recipeById('archersaxe:moonstone').name, recipeById('lightflail:orichalcum').name, recipeById('lightflail:warforged').name], ['Elven Archer\'s Axe', 'Orcish Light Flail', 'Warforged Light Flail']);
  assert.deepEqual([recipeById('lightflail:steel').family, recipeById('archersaxe:steel').templateIndex], ['weapons', 513]);
  assert.deepEqual([firstCraftKey(recipeById('lightflail:ebony')), firstCraftKey(recipeById('archersaxe:iron'))], ['lightflail@6', 'archersaxe@1'], 'a pattern of its own at a tier - its own first-makes');
});

test('SMITH-RRI the piece is the mod\'s weapon: a made Light Flail swings the flail\'s sheet on Blunt Weapon, an Archer\'s Axe the battleaxe\'s on Axe; a found one is tempered by its recipe now, for half its ingots (mutants: the class unasked; the temper\'s recipe missed)', () => {
  const [flail] = mintPieces({ recipe: 'lightflail:steel', quality: 1, seed: 7, pieces: [{ provenance: '0000000000000514' }] });
  const [axe] = mintPieces({ recipe: 'archersaxe:dwarven', quality: 1, seed: 7, pieces: [{ provenance: '0000000000000513' }] });
  assert.deepEqual([flail.templateIndex, flail.material, flail.group, flail.recipe], [514, 1, 'Weapons', 'lightflail:steel']);
  assert.deepEqual([axe.templateIndex, axe.material], [513, 4]);
  assert.deepEqual([weaponTypeForItem(flail), weaponTypeForItem(axe)], [WEAPON_TYPES.Flail, WEAPON_TYPES.Battleaxe]);
  assert.deepEqual([weaponSkillUsed(flail.templateIndex), weaponSkillUsed(axe.templateIndex)], [SKILLS.BluntWeapon, SKILLS.Axe]);
  const found = weaponOfMaterial(513, 5);
  assert.equal(temperRecipeOf(found)?.id, 'archersaxe:mithril', 'a foe\'s Mithril Archer\'s Axe is tempered by the recipe that makes it');
  assert.deepEqual(temperCost(temperRecipeOf(found)), { key: 'ingot:mithril', n: 1 });
  assert.equal(temperRecipeOf(weaponOfMaterial(514, 9))?.id, 'lightflail:daedric');
});

test('SMITH-RRI the anvil lists the two while the mod\'s weapon class stands - online always (the room forces newWeapons on); with newWeapons off a piece swings as nothing, so the anvil does not offer it (mutants: the guard dropped; the guard reads the wrong switch)', () => {
  const names = () => patternsOf(anvilRecipes('weapons')).map((p) => p.name);
  try {
    assert.equal(names().length, 17);
    assert.deepEqual(names().slice(-2), ['Light Flail', 'Archer\'s Axe']);
    assert.equal(onlineForcedModSetting('roleplay-realism-items', 'newWeapons', '?online'), true, 'online the class always stands');
    setModSetting('roleplay-realism-items', 'newArmor', false);
    assert.equal(names().length, 17, 'the armour switch is not the weapons\'');
    setModSetting('roleplay-realism-items', 'newWeapons', false);
    assert.equal(weaponTypeForItem(weaponOfMaterial(514, 0)), WEAPON_TYPES.None, 'unregistered, no weapon');
    assert.equal(names().length, 15);
    assert.ok(!names().includes('Light Flail') && !names().includes('Archer\'s Axe'));
    assert.ok(anvilRecipes('armour').length > 0, 'the rest stands');
  } finally { _resetModSettings(); }
});

test('SMITH-RRI DONE WHEN, through the real Worker: a Steel Light Flail and an Iron Archer\'s Axe made at the anvil, each its first; the Stores spend their ingots and fittings; the pieces mint as the mod\'s weapons', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, mac.character, 'smithing', xpForRank(10));
  const stock = { 'ingot:steel': 3, 'ingot:iron': 2, 'metal:copper': 2, 'leather:cured': 1, 'plank:oak': 1 };
  for (const [m, n] of Object.entries(stock)) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, m, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const made = [];
  for (const id of ['lightflail:steel', 'archersaxe:iron']) {
    const r = await book.craft(id, { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, `${id}: ${JSON.stringify(r)}`);
    made.push([id, r.data.first, r.data.xp, mintPieces(r.data)[0].templateIndex]);
  }
  assert.deepEqual(made, [['lightflail:steel', true, craftXp(2, 10) + 500, 514], ['archersaxe:iron', true, craftXp(1, 10) + 500, 513]]);
  const left = raw.prepare('SELECT material, SUM(qty) AS n FROM prof_stores WHERE player = ? GROUP BY material ORDER BY material').all(mac.id).map((x) => [x.material, Number(x.n)]).filter(([, n]) => n > 0);
  assert.deepEqual(left, [], 'every ingot and fitting spent');
});
