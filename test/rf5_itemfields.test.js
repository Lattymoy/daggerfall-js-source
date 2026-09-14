// RF5 - THE ITEM FIELD SCHEMA (2026-09-14, Mac's refactor pass, the
// fifth). An item record is an open shape and the knowledge of what
// each field IS lived only in its readers; the wire's validator typed
// a record as "primitives, arrays and plain objects, bounded" and
// carried the exceptions by hand (the three array fields of AUDIT
// WORLD4 B1, LR4's affix check, the templateIndex bounds). Now
// systems/itemFields.js declares every field once - kind and bounds -
// the validator checks every DECLARED field against it, and the array
// list is derived. The laws pinned here:
//   - EVERY MINT WRITES DECLARED FIELDS: the loot factories, the
//     book, the potions, gold, the magic mints, loot rarity, equip,
//     repair, the quest link and the classic importer write nothing
//     the schema has no line for, and each value is its kind.
//   - A DECLARED FIELD'S SHAPE IS CLOSED on the wire: the wrong kind
//     refuses the item; a string is cut, not refused; an undeclared
//     field rides the clamp as before.
//   - ONE DECLARATION: LOOT_ARRAY_FIELDS derives from the kinds, the
//     validator carries no hand list, the look's six fields are
//     declared.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ITEM_FIELDS, ITEM_FIELD_NAMES, ITEM_STR_MAX, ITEM_EQUIP_SLOTS, itemFieldsOfKind, isDeclaredItemField,
  validItemField, validItemFields, validEnchantment, validRepairData,
} from '../src/systems/itemFields.js';
import {
  LOOT_MATRICES, generateItems, createRegularMagicItem, createArtifact, createPotion, createRandomPotion, CLASSIC_RECIPE_KEYS,
  validLootItem, LOOT_ARRAY_FIELDS, LOOT_STR_MAX,
} from '../src/systems/loot.js';
import { createRandomBook } from '../src/systems/books.js';
import { goldStack } from '../src/systems/inventory.js';
import { rollLootRarity, applyRarity, RARITY_ORDER, validAffix } from '../src/systems/lootRarity.js';
import { equipItem } from '../src/systems/equip.js';
import { leaveForRepair } from '../src/systems/repairService.js';
import { itemBaseValue } from '../src/systems/itemTemplates.js';
import { LOOK_ITEM_FIELDS } from '../src/net/wire.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import '../src/world/landView.js';
import '../src/world/outdoors.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** A seeded stream: the same items every run. */
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

/** A synthetic MAGIC.DEF: one regular item and one artifact per shape readMagicDef answers. */
const MAGIC_TEMPLATES = [
  { index: 0, name: 'Ring of Testing', type: 0, group: 6, groupIndex: 0, enchantments: [{ type: 0, param: 1 }, { type: -1, param: -1 }], uses: 0, value: 500, material: 0 },
  { index: 62, name: 'Testing Blade', type: 1, group: 3, groupIndex: 1, enchantments: [{ type: 1, param: 2 }, { type: -1, param: -1 }], uses: 0, value: 5000, material: 4 },
];

function assertDeclared(item, where) {
  for (const k of Object.keys(item)) {
    assert.ok(isDeclaredItemField(k), `${where}: '${k}' is not a declared item field (add it to ITEM_FIELDS)`);
    if (item[k] === undefined) continue;
    assert.notEqual(validItemField(k, item[k]), undefined, `${where}: '${k}' = ${JSON.stringify(item[k])} is not its declared kind (${ITEM_FIELDS[k].kind})`);
  }
}

test('RF5: every field the port\'s own mints write is declared, and each value is its declared kind', () => {
  const player = { level: 12, gender: 'female' };
  let n = 0;
  for (const key of Object.keys(LOOT_MATRICES)) {
    for (let seed = 1; seed <= 40; seed++) {
      for (const it of generateItems(key, player, lcg(seed * 7919 + key.charCodeAt(0)))) { assertDeclared(it, `generateItems('${key}')`); n++; }
    }
  }
  assert.ok(n > 500, `the tables minted enough to mean something (${n})`);
  for (let seed = 1; seed <= 20; seed++) {
    assertDeclared(createRandomBook(lcg(seed)), 'createRandomBook');
    assertDeclared(createRandomPotion(lcg(seed)), 'createRandomPotion');
    assertDeclared(createRegularMagicItem(MAGIC_TEMPLATES, 10, 'male', lcg(seed)), 'createRegularMagicItem');
  }
  for (const k of CLASSIC_RECIPE_KEYS) assertDeclared(createPotion(k), 'createPotion');
  assertDeclared(createArtifact(MAGIC_TEMPLATES, 0, { gender: 'female' }), 'createArtifact');
  assertDeclared(goldStack(250), 'goldStack');
  // loot rarity's three fields, on
  _resetForTests(); setPref('lootRarity', true);
  try {
    const tiers = { magic: 0, rare: 0, legendary: 0 };
    for (const key of Object.keys(LOOT_MATRICES)) {
      for (let seed = 1; seed <= 20; seed++) {
        const items = generateItems(key, player, lcg(seed * 31 + key.charCodeAt(0)));
        rollLootRarity(items, { kind: 'pile', tier: 21, boss: true }, { rolls: lcg(seed + 100), luck: 100 });
        for (const it of items) { if (it.rarity) tiers[it.rarity]++; assertDeclared(it, 'rollLootRarity'); }
      }
    }
    for (const t of ['magic', 'rare']) assert.ok(tiers[t] > 5, `the roll landed ${t} (${tiers[t]})`);
    // and a Legendary by hand, off its pool
    for (let seed = 1; seed <= 20; seed++) {
      const it = generateItems('K', player, lcg(seed)).find((x) => x.group === 'Weapons' || x.group === 'Armor');
      if (!it) continue;
      applyRarity(it, 'legendary', lcg(seed));
      if (it.rarity === 'legendary') tiers.legendary++;
      assertDeclared(it, 'applyRarity(legendary)');
    }
    assert.ok(tiers.legendary > 0, 'a Legendary was minted');
  } finally { _resetForTests(); }
  // the state writers: equip, repair, the quest link
  const e = { items: [], stats: {}, skills: new Array(35).fill(30), activeEffects: [] };
  const w = generateItems('K', player, lcg(3)).find((it) => it.group === 'Weapons') ?? createRandomBook(lcg(1));
  if (w.group === 'Weapons') { e.items.push(w); equipItem(e, w); assert.ok(Number.isInteger(w.equipSlot)); assertDeclared(w, 'equipItem'); }
  leaveForRepair(w, 'town:12', 720, 1000);
  assertDeclared(w, 'leaveForRepair');
  assertDeclared({ ...w, questItem: true, questUID: 4, questSymbol: { name: '_item_' } }, 'the quest link');
  // the classic importer writes only declared fields (its literal and its later assignments)
  const src = read('src/systems/classicSave.js');
  const body = src.slice(src.indexOf('export function classicItemFromRecord'), src.indexOf('export function', src.indexOf('export function classicItemFromRecord') + 10));
  const literal = body.slice(body.indexOf('const item = {'), body.indexOf('};', body.indexOf('const item = {')));
  const keys = new Set([...literal.matchAll(/^\s{4}([a-zA-Z]+):/gm)].map((m) => m[1]));
  for (const m of src.matchAll(/\bitem\.([a-zA-Z]+) = /g)) keys.add(m[1]);
  assert.ok(keys.size >= 18, `the importer's keys were found (${keys.size})`);
  for (const k of keys) assert.ok(isDeclaredItemField(k), `classicItemFromRecord writes '${k}', undeclared`);
});

test('RF5: a declared field\'s shape is closed on the wire - the wrong kind refuses the item, a string is cut, an undeclared field rides the clamp', () => {
  const ok = (v) => validLootItem({ templateIndex: 120, ...v });
  assert.ok(ok({}), 'the plain item');
  // AUDIT WORLD4 B1's three, by kind now
  for (const f of ['enchantments', 'customEnchantments', 'affixes']) {
    assert.equal(ok({ [f]: '!' }), null, `${f}: a string is not a list`);
    assert.equal(ok({ [f]: {} }), null, `${f}: nor an object`);
    assert.ok(ok({ [f]: [] }), `${f}: an empty list is`);
    assert.ok(ok({ [f]: null }), `${f}: and null is absent`);
  }
  assert.equal(ok({ enchantments: [{ type: 'x', param: 1 }] }), null, 'an enchantment is two integers');
  assert.equal(ok({ enchantments: [null] }), null);
  assert.ok(ok({ enchantments: [{ type: 3, param: -1 }] }));
  assert.equal(ok({ affixes: [{ id: 'armor', param: 1e9 }] }), null, 'LR4: a forged affix');
  assert.equal(ok({ rarity: 'epic' }), null, 'a rarity off the ladder');
  for (const r of RARITY_ORDER) assert.ok(ok({ rarity: r }));
  assert.equal(ok({ equipSlot: ITEM_EQUIP_SLOTS }), null, 'a slot past the table');
  assert.equal(ok({ equipSlot: -1 }), null);
  assert.ok(ok({ equipSlot: ITEM_EQUIP_SLOTS - 1 }));
  assert.equal(ok({ magic: 'yes' }), null, 'a flag is a boolean');
  assert.equal(ok({ value: '12' }), null, 'a price is a number');
  assert.equal(ok({ value: NaN }).value, itemBaseValue({ templateIndex: 120 }), 'a non-finite price is gone before the kinds, and floored (AUDIT WORLD6a B1)');
  assert.equal(ok({ stackCount: -1 }), null);
  assert.equal(ok({ stackCount: 2.5 }), null);
  assert.equal(ok({ group: 'Pets' }), null, 'a group the port has no templates for');
  assert.equal(ok({ questSymbol: {} }), null, 'a symbol carries a name');
  assert.ok(ok({ questSymbol: { name: '_x_' } }));
  assert.equal(ok({ repairData: { buildingKey: 1 } }), null, 'a ticket is a key and two minutes');
  assert.ok(ok({ repairData: { buildingKey: 'k', timeStarted: 1, repairTime: 2 } }));
  assert.equal(ok({ name: 'x'.repeat(ITEM_STR_MAX + 50) }).name.length, ITEM_STR_MAX, 'a string is cut, not refused');
  assert.equal(ok({ name: 12 }), null, 'but a number is not a name');
  assert.deepEqual(ok({ zzz: { a: 1 } }).zzz, { a: 1 }, 'an undeclared field rides the clamp');
  assert.equal(ok({ templateIndex: '120' }), null);
  assert.equal(validLootItem({ templateIndex: null }), null, 'no templateIndex is not an item');
  // the schema's own answers
  assert.equal(validItemField('name', 'x'.repeat(200)).length, ITEM_STR_MAX);
  assert.equal(validItemField('never-declared', 'anything'), 'anything', 'undeclared passes through');
  assert.equal(validItemField('dye', null), null, 'null is absent for every field');
  assert.equal(validItemFields(null), null);
  assert.equal(validItemFields({ dye: 'red' }), null);
  assert.ok(validEnchantment({ type: 1, param: 2 }) && !validEnchantment({ type: 1 }) && !validEnchantment([1, 2]));
  assert.ok(validRepairData({ buildingKey: 'k', timeStarted: 1, repairTime: 2 }) && !validRepairData({ buildingKey: 'k' }));
  assert.equal(ITEM_FIELDS.affixes.of, validAffix, 'the affix element check is loot rarity\'s own');
});

test('RF5: one declaration - the array list derives from the kinds, the validator carries no hand list, the look\'s fields are declared', () => {
  assert.deepEqual([...LOOT_ARRAY_FIELDS], itemFieldsOfKind('array'));
  assert.deepEqual(itemFieldsOfKind('array'), ['enchantments', 'customEnchantments', 'affixes']);
  assert.equal(LOOT_STR_MAX, ITEM_STR_MAX);
  assert.ok(Object.isFrozen(ITEM_FIELDS) && ITEM_FIELD_NAMES.length >= 40);
  for (const k of ITEM_FIELD_NAMES) assert.ok(['int', 'number', 'bool', 'string', 'enum', 'array', 'object'].includes(ITEM_FIELDS[k].kind), k);
  for (const k of LOOK_ITEM_FIELDS) assert.ok(isDeclaredItemField(k), `the look's '${k}' is declared`);
  const loot = read('src/systems/loot.js');
  assert.match(loot, /export const LOOT_ARRAY_FIELDS = Object\.freeze\(itemFieldsOfKind\('array'\)\);/);
  assert.match(loot, /if \(!validItemFields\(out\)\) return null;/, 'the validator checks every declared field');
  assert.doesNotMatch(loot, /\['enchantments', 'customEnchantments', 'affixes'\]/, 'no hand list');
  assert.doesNotMatch(loot, /validAffixList/, 'LR4\'s check rides the schema');
  assert.doesNotMatch(read('src/systems/itemFields.js'), /from '\.\/loot\.js'|from '\.\/inventory\.js'|from '\.\/equip\.js'/, 'the schema sits under the mints');
});
