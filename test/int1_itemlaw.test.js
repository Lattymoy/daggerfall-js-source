// INT1 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and do it
// properly"): THE ITEM LAW - could an honest client of this port have minted this item? Pinned both ways: every item every
// honest producer mints (test/honestItems.mjs: the loot doors, the ladder and its passes, the spoils, the Broker, the
// records, the Reforge, the shelves, chargen, the crafts, the item maker, every port item home) carries no finding, as
// it lies in the save and as it rides the wire; and every forgery the arc's research fed the wire's old validator - each
// taken from an honest piece and moved by one field - carries the finding that names it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { honestItems, honestItemsSkipped } from './honestItems.mjs';
import {
  itemFindings, lawfulItem, itemWorth, worthCeiling, templateGroups, lawTemplate, CUSTOM_TEMPLATE_GROUPS, ITEM_LAW_VERSION,
} from '../src/systems/itemLaw.js';
import { validLootItem } from '../src/systems/loot.js';
import { AFFIX_RANGES, legendaryById } from '../src/systems/lootRarity.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';

const SWEEP = honestItems({ seeds: 4 });
const copy = (v) => JSON.parse(JSON.stringify(v));
/** The first honest item a predicate takes - a copy, so a forgery never touches the sweep. */
const honest = (pred, what) => {
  const hit = SWEEP.find(({ item }) => pred(item));
  assert.ok(hit, `the sweep mints ${what}`);
  return copy(hit.item);
};

test('INT1: every item every honest producer mints carries no finding - in the save and on the wire; the sweep covers every producer, none skipped', () => {
  assert.deepEqual(honestItemsSkipped, [], 'every producer ran headless');
  const sources = new Set(SWEEP.map((s) => s.source));
  assert.ok(sources.size >= 80, `the sweep's producers: ${sources.size}`);
  assert.ok(SWEEP.length >= 30_000, `the sweep's items: ${SWEEP.length}`);
  for (const wire of [false, true]) {
    const bad = (wire ? honestItems({ seeds: 4, wire: true }) : SWEEP).map(({ source, item }) => ({ source, f: itemFindings(item), item })).filter((x) => x.f.length);
    assert.deepEqual(bad.slice(0, 5).map((b) => `${b.source}: ${b.f.join(',')} ${JSON.stringify(b.item).slice(0, 200)}`), [], `${wire ? 'wire' : 'save'}: ${bad.length} honest items with findings`);
  }
  assert.equal(ITEM_LAW_VERSION, 1);
});

test('INT1: the forgeries the old wire validator took, each from an honest piece moved by one field - each named', () => {
  const magicSword = honest((it) => it.rarity === 'magic' && it.group === 'Weapons' && !it.sigil && (it.affixes ?? []).some((a) => a.id === 'damage') && it.affixes.length === 1, 'a Magic weapon of one damage line');
  const rare = honest((it) => it.rarity === 'rare' && it.group === 'Armor' && !it.cursed && !it.socket, 'a Rare piece of armour');
  const legendary = honest((it) => it.rarity === 'legendary' && it.group === 'Weapons' && it.exalted !== true && !it.cursed && !it.socket && !it.sigil, 'a plain Legendary weapon');
  const common = honest((it) => it.group === 'Weapons' && it.templateIndex === 113 && !it.rarity && !it.magic && !(it.enchantments ?? []).length, 'a common dagger');
  const commonArmor = honest((it) => it.group === 'Armor' && !it.rarity && !it.magic && !(it.enchantments ?? []).length && !it.sigil, 'a common piece of armour');
  const arrow = honest((it) => it.group === 'Weapons' && it.templateIndex === 131 && !it.rarity, 'arrows');
  const gem = honest((it) => it.group === 'Gems' && !it.rarity && !(it.enchantments ?? []).length, 'a gem');
  const broker = honest((it) => it.bound === true && Number.isInteger(it.stonesPaid), 'a Broker ware');
  const crafted = honest((it) => typeof it.provenance === 'string' && Number.isInteger(it.quality) && it.group === 'Weapons', 'a crafted weapon');
  for (const it of [magicSword, rare, legendary, common, commonArmor, arrow, gem, broker, crafted]) assert.deepEqual(itemFindings(it), [], `the honest piece: ${it.name}`);
  const rec = legendaryById(legendary.legendary);
  const cases = [
    ['no rarity, seven Legendary-band lines', { ...common, affixes: Array.from({ length: 7 }, (_, i) => ({ id: 'stat', param: ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed'][i], value: 15 })) }, 'rarity'],
    ['a Magic sword at +40% damage', { ...magicSword, affixes: [{ id: 'damage', value: AFFIX_RANGES.damage.legendary[1] }] }, 'affixes'],
    ['two damage lines', { ...magicSword, affixes: [{ id: 'damage', value: 6 }, { id: 'damage', value: 7 }] }, 'affixes'],
    ['an armour line on a sword', { ...magicSword, affixes: [{ id: 'armor', value: 4 }] }, 'affixes'],
    ['a Magic piece of five lines', { ...magicSword, affixes: [{ id: 'damage', value: 6 }, { id: 'stat', param: 'strength', value: 3 }, { id: 'stat', param: 'agility', value: 3 }, { id: 'stat', param: 'speed', value: 3 }, { id: 'skill', param: 0, value: 6 }] }, 'affixes'],
    ['a legendary that is no record', { ...legendary, legendary: 'nope' }, 'legendary'],
    ['a record on a common piece', { ...common, legendary: 'wyrmbane' }, 'rarity'],
    ['a mace record on a dagger', { ...legendary, templateIndex: 113, legendary: 'graveward' }, 'legendary'],
    ['a record on a gem', { ...gem, rarity: 'legendary', legendary: 'wyrmbane', affixes: rec.affixes }, 'rarity'],
    ['a signature raised', { ...legendary, affixes: legendary.affixes.map((a, i) => (i === 0 ? { ...a, value: a.value + 1 } : a)) }, 'legendary'],
    ['a rare arrow', { ...arrow, rarity: 'rare', affixes: [{ id: 'damage', value: 12 }, { id: 'stat', param: 'speed', value: 6 }, { id: 'skill', param: 0, value: 12 }] }, 'rarity'],
    ['Exalted on a Magic piece', { ...magicSword, exalted: true }, 'rarity'],
    ['a reforge past the lines', { ...magicSword, reforged: 9 }, 'reforged'],
    ['a hone on a common piece', { ...common, honed: 63 }, 'rarity'],
    ['a sigil of 12 on a Magic weapon', { ...magicSword, sigil: { power: 12, party: 1, xp: 0 } }, 'sigil'],
    ['a sigil on a common weapon', { ...common, sigil: { power: 2, party: 1, xp: 0 } }, 'sigil'],
    ['a world set on common armour', { ...commonArmor, sigil: { set: 'malacath', party: 1, xp: 0 } }, 'sigil'],
    ['the Broker\'s price with no binding', { ...broker, bound: undefined }, 'bound'],
    ['the Broker\'s price at 999', { ...broker, stonesPaid: 999 }, 'bound'],
    ['a provenance no service mints', { ...crafted, provenance: 'zzz' }, 'provenance'],
    ['a template the port has none of', { ...common, templateIndex: 9999 }, 'template'],
    ['a dagger in the Gems', { ...common, group: 'Gems' }, 'group'],
    ['a weapon of material 12', { ...common, material: 12 }, 'material'],
    ['armour of material 5', { ...commonArmor, material: 5 }, 'material'],
    ['a condition past its most', { ...common, currentCondition: common.maxCondition + 1 }, 'condition'],
    ['a stack of daggers', { ...common, stackCount: 40 }, 'stack'],
    ['arrows past the wire\'s bound', { ...arrow, stackCount: 70_000 }, 'stack'],
    ['a price that is no number', { ...common, value: -5 }, 'value'],
    ['an artifact\'s power on a dagger', { ...common, enchantments: [{ type: T.SpecialArtifactEffect, param: 3 }] }, 'artifact'],
    ['an enchantment on a plain dagger', { ...common, enchantments: [{ type: T.EnhancesSkill, param: 20 }] }, 'enchantments'],
    ['a made row past the dagger\'s power', { ...common, enchantments: Array.from({ length: 5 }, (_, i) => ({ type: T.EnhancesSkill, param: i, enchantCost: 1, parentEnchantment: 0, key: `EnhancesSkill:${i}` })) }, 'enchantments'],
    ['a weapon\'s made row on armour', { ...commonArmor, enchantments: [{ type: T.PotentVs, param: 0, enchantCost: 1, parentEnchantment: 0, key: 'PotentVs:0' }] }, 'enchantments'],
    ['a soul\'s row with no soul', { ...common, enchantments: [{ type: T.ExtraWeight, param: -1, enchantCost: 0, parentEnchantment: 'SoulBound:26', key: 'ExtraWeight:-1' }] }, 'enchantments'],
    ['a custom enchantment', { ...common, customEnchantments: [{ type: 1, param: 1 }] }, 'enchantments'],
    ['eleven Rare rows', { ...rare, enchantments: Array.from({ length: 12 }, () => rare.enchantments[0]) }, 'enchantments'],
    ['a poison past the eight', { ...common, poisonType: 200 }, 'poison'],
    ['a poisoned cuirass', { ...commonArmor, poisonType: 130 }, 'poison'],
    ['a soul in a dagger', { ...common, trappedSoulType: 30 }, 'soul'],
    ['an artifact\'s index on a dagger', { ...common, artifactIndexBitfield: 3 }, 'artifact'],
    ['the skeleton key\'s picture on a dagger', { ...common, worldTextureArchive: 432, worldTextureRecord: 20 }, 'artifact'],
    ['a sword that vanishes', { ...honest((it) => it.group === 'Weapons' && it.templateIndex === 121 && !it.rarity, 'a claymore'), timeForItemToDisappear: 10 }, 'summoned'],
    ['a classic flag on a port dagger', { ...common, flags: 0x10 }, 'flags'],
    ['a card no catalog prints', { ...honest((it) => typeof it.card === 'string', 'a card'), card: 'no-such-card' }, 'card'],
    ['a potion at 30% potent', { ...honest((it) => it.templateIndex === 83, 'a potion'), potent: 30 }, 'crafted'],
    ['a quality with no craft', { ...common, quality: 4 }, 'crafted'],
    ['an id that is no id', { ...magicSword, uid: 'x' }, 'uid'],
  ];
  for (const [why, item, code] of cases) assert.ok(itemFindings(item).includes(code), `${why}: ${itemFindings(item).join(',') || 'no finding'}`);
  assert.deepEqual(itemFindings(null), ['shape']);
  assert.deepEqual(itemFindings({ name: 'x' }), ['template']);
});

test('INT1: the wire\'s door asks the law - an honest piece lands, its forgery is no item; the receiver\'s own marks are stripped, never judged', () => {
  const sword = honest((it) => it.rarity === 'rare' && it.group === 'Weapons' && !it.sigil, 'a Rare weapon');
  assert.ok(validLootItem({ ...sword, equipSlot: 3, questItem: false, acquired: true }), 'the honest piece, its receiver\'s marks aside');
  assert.equal(validLootItem({ ...sword, affixes: sword.affixes.map((a) => ({ ...a, value: AFFIX_RANGES[a.id].legendary[1] })) }), null, 'its lines pushed to the top of the widest band');
  const id = validLootItem({ ...sword, uid: '0123456789abcdef' });
  assert.equal(id.uid, '0123456789abcdef', 'INT4: the id is the piece\'s - the wire carries it');
});

test('INT1: the templates the law knows - every custom index a producer mints in the group it mints it in, a row a headless reader never registers read beside the registry; worth capped by the ceiling and counted by the stack', () => {
  for (const { item } of SWEEP) {
    if (item.templateIndex < 288) continue;
    assert.ok(templateGroups(item.templateIndex).includes(item.group), `${item.templateIndex} in ${item.group}`);
    assert.ok(lawTemplate(item.templateIndex), `${item.templateIndex} known`);
  }
  assert.deepEqual(Object.keys(CUSTOM_TEMPLATE_GROUPS), ['Weapons', 'Armor', 'Gems', 'Jewellery', 'Furniture']);
  const dagger = honest((it) => it.group === 'Weapons' && it.templateIndex === 113 && !it.rarity && !it.magic, 'a dagger');
  assert.equal(itemWorth(dagger), dagger.value, 'an honest price counts whole');
  assert.equal(itemWorth({ ...dagger, value: 1e12 }), worthCeiling(dagger), 'a forged price counts no further than the ceiling');
  const arrows = honest((it) => it.templateIndex === 131 && it.stackCount > 1, 'a stack of arrows');
  assert.equal(itemWorth(arrows), Math.min(arrows.value, worthCeiling(arrows)) * arrows.stackCount);
  assert.equal(lawfulItem(dagger), true);
});
