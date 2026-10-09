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
  itemFindings, lawfulItem, itemWorth, worthCeiling, templateGroups, lawTemplate, classicPiece, CUSTOM_TEMPLATE_GROUPS, ITEM_LAW_VERSION,
  REGULAR_MAGIC_TYPES, ARTIFACT_RECORDS,
} from '../src/systems/itemLaw.js';
import { validLootItem, validLootList, createArtifact, ITEM_GROUP_NAME_BY_CLASS } from '../src/systems/loot.js';
import { AFFIX_RANGES, legendaryById, isCursed } from '../src/systems/lootRarity.js';
import { liftCurse } from '../src/systems/lootCurse.js';
import { ENCHANTMENT_TYPES as T, readMagicDef } from '../src/formats/magicDef.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { seededRng } from '../src/systems/wind.js';
import { itemBaseValue } from '../src/systems/itemTemplates.js';
import { POISON_START_VALUE, POISONS } from '../src/systems/poisons.js';
import { enchantmentSettings } from '../src/systems/enchantmentCatalogue.js';
import { DFU_MAGIC_ITEMS } from './dfuMagicItems.mjs';

const SWEEP = honestItems({ seeds: 4 });
/** A row as the item maker lays it (enchanting.js applyEnchantments): the catalogue's settings, its type the classic number. */
const made = (key, param) => { const r = enchantmentSettings(key, param); return { type: T[key], param, enchantCost: r.enchantCost, parentEnchantment: r.parentEnchantment ?? 0, key: `${key}:${param}` }; };
/** A drawback only a weapon takes (WeaponOnly) - its cost below nothing, so every item's budget fits it. */
const MADE_LOW_DAMAGE = made('LowDamageVs', 0);
/** Soul 27's SoulBound row, and the set it forces (its three drawbacks). */
const SOUL_27 = made('SoulBound', 27);
const SOUL_27_FORCED = [
  { type: T.LowDamageVs, param: 1, enchantCost: -900, parentEnchantment: 'SoulBound:27', key: 'LowDamageVs:1' },
  { type: T.BadReactionsFrom, param: 2, enchantCost: -120, parentEnchantment: 'SoulBound:27', key: 'BadReactionsFrom:2' },
  { type: T.ItemDeteriorates, param: 2, enchantCost: -500, parentEnchantment: 'SoulBound:27', key: 'ItemDeteriorates:2' },
];
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
  // PIN MOVED (its audit): the producers counted exactly - a producer dropped from the sweep is a hole, never a pass
  assert.equal(sources.size, 83, `the sweep's producers: ${sources.size}`);
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
  const claymore = createWeapon(122, 9, seededRng(7));
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
    // PIN MOVED (its audit): each held by the one rule it names - a drawback a weapon alone takes (every budget fits it; its
    // control on a dagger, below, is lawful), and a soul's whole forced set laid with no soul (its control with the soul)
    ['a weapon\'s made row on armour', { ...commonArmor, enchantments: [MADE_LOW_DAMAGE] }, 'enchantments'],
    ['a soul\'s rows with no soul', { ...claymore, enchantments: SOUL_27_FORCED }, 'enchantments'],
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
  // the two controls: the same rows where the maker lays them
  assert.deepEqual(itemFindings({ ...common, enchantments: [MADE_LOW_DAMAGE] }), [], 'the drawback on a weapon');
  assert.deepEqual(itemFindings({ ...claymore, enchantments: [SOUL_27, ...SOUL_27_FORCED] }), [], 'the soul with its set');
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

test('INT1 (its audit): DFU\'s OWN MAGIC PROVEN by DFU\'s table - a regular magic item one row of a regular kind, an artifact its record\'s template and kinds (AUDIT INT: `magic: true` carried any ten rows at 127, `artifact: true` any power on any blade); the law\'s table is DFU\'s', () => {
  // the law's table, held to DFU's MagicItemTemplates.txt (test/dfuMagicItems.mjs)
  const regular = DFU_MAGIC_ITEMS.filter((r) => r.type === 0);
  assert.equal(regular.length, 36);
  assert.ok(regular.every((r) => r.ench.length === 1 && REGULAR_MAGIC_TYPES.includes(r.ench[0][0])), 'one row, of a kind the law takes');
  assert.deepEqual([...new Set(regular.map((r) => r.ench[0][0]))].sort((a, b) => a - b), [...REGULAR_MAGIC_TYPES].sort((a, b) => a - b), 'every kind the table carries, and no other');
  const artifacts = DFU_MAGIC_ITEMS.filter((r) => r.type !== 0);
  assert.deepEqual(ARTIFACT_RECORDS.map((a) => [a.group, a.index, [...a.types].sort()]), artifacts.map((r) => [r.group, r.groupIndex, r.ench.map(([k]) => k).sort()]));
  // every artifact as createArtifact mints it off DFU's table: lawful
  const magic = readMagicDef(dfuMagicDef());
  for (let i = 0; i < artifacts.length; i++) assert.deepEqual(itemFindings(createArtifact(magic, i)), [], `artifact ${i}: ${artifacts[i].name}`);
  const blade = createArtifact(magic, 22);   // the Ebony Blade
  const sword = createWeapon(113, 9, seededRng(7));
  const forgeries = [
    ['ten rows on a magic dagger', { ...sword, magic: true, enchantments: Array.from({ length: 10 }, (_, i) => ({ type: [T.PotentVs, T.VampiricEffect, T.RegensHealth, T.AbsorbsSpells][i % 4], param: 127 })) }, 'enchantments'],
    ['a magic dagger of a kind no regular item carries', { ...sword, magic: true, enchantments: [{ type: T.PotentVs, param: 3 }] }, 'enchantments'],
    ['a magic dagger of no row', { ...sword, magic: true }, 'enchantments'],
    ['an artifact\'s word on a plain dagger', { ...sword, artifact: true, trappedSoulType: 30 }, 'artifact'],
    ['the Ebony Blade on a dagger', { ...blade, templateIndex: 113 }, 'artifact'],
    ['the Ebony Blade with a row its record has not', { ...blade, enchantments: [...blade.enchantments, { type: T.VampiricEffect, param: 1 }] }, 'artifact'],
    ['an artifact past the table', { ...blade, artifactIndexBitfield: (23 << 1) | 1 }, 'artifact'],
    ['a soul in the Necromancer\'s Amulet', { ...createArtifact(magic, 13), trappedSoulType: 5 }, 'soul'],
  ];
  for (const [why, item, code] of forgeries) assert.ok(itemFindings(item).includes(code), `${why}: ${itemFindings(item).join(',') || 'no finding'}`);
  assert.deepEqual(itemFindings({ ...createArtifact(magic, 9), trappedSoulType: 5 }), [], 'Azura\'s Star holds a soul');
  assert.equal(ITEM_GROUP_NAME_BY_CLASS[25], 'Jewellery');
});

test('INT1 (its audit): the honest shapes the law refused - a curse the temple LIFTED (its line kept, by design: every lifted Legendary and half the lifted Rares were findings), a PERSON\'s soul in a gem (the kill door traps any foe); a null row a finding, never a throw; the poisons pinned to their home', () => {
  const cursed = SWEEP.map(({ item }) => item).filter((it) => isCursed(it) && (it.rarity === 'rare' || it.rarity === 'legendary'));
  assert.ok(cursed.length > 100, `the sweep's cursed pieces: ${cursed.length}`);
  let lifted = 0;
  for (const c of cursed) {
    const piece = copy(c);
    const player = { items: [piece], goldPieces: 1e9 };
    const r = liftCurse(piece, player);
    if (!r.ok) continue;
    lifted++;
    assert.deepEqual(itemFindings(piece), [], `lifted: ${JSON.stringify(piece).slice(0, 200)}`);
  }
  assert.ok(lifted > 100, `lifted: ${lifted}`);
  const gem = honest((it) => it.templateIndex === 274, 'a Soul Gem');
  for (const soul of [0, 42, 128, 140, 146]) assert.deepEqual(itemFindings({ ...gem, trappedSoulType: soul }), [], `soul ${soul}`);
  for (const soul of [43, 127, 147]) assert.ok(itemFindings({ ...gem, trappedSoulType: soul }).includes('soul'), `soul ${soul}`);
  const common = honest((it) => it.group === 'Weapons' && it.templateIndex === 113 && !it.rarity && !it.magic && !(it.enchantments ?? []).length, 'a common dagger');
  assert.ok(itemFindings({ ...common, enchantments: [null] }).includes('enchantments'));
  assert.ok(itemFindings({ ...honest((it) => it.templateIndex === 582, 'a Card Binder'), decks: [null] }).includes('card'));
  // a foe's blade carries one of the eight weapon poisons (DFU's EnemyEntity: Nux Vomica to Thyrwort) - the four after
  // them are drugs, drunk and never on a blade
  assert.deepEqual(itemFindings({ ...common, poisonType: POISON_START_VALUE }), [], 'the first poison');
  assert.equal(POISONS.Nux_Vomica, POISON_START_VALUE);
  assert.deepEqual(itemFindings({ ...common, poisonType: POISONS.Thyrwort }), [], 'the eighth');
  assert.ok(itemFindings({ ...common, poisonType: POISONS.Indulcet }).includes('poison'), 'pinned equal: a drug on no blade');
  assert.ok(itemFindings({ ...common, poisonType: POISON_START_VALUE - 1 }).includes('poison'));
});

test('INT1 (its audit): a piece\'s worth is never under what it IS - its base and its lines (AUDIT INT: a forged piece priced at nothing was nothing to the budget); a classic save\'s piece told; the wire drops the piece the law refuses, never the list beside it', () => {
  const dagger = honest((it) => it.group === 'Weapons' && it.templateIndex === 113 && !it.rarity && !it.magic, 'a dagger');
  assert.equal(itemWorth({ ...dagger, value: 0 }), itemBaseValue(dagger, lawTemplate), 'a price of nothing counts its base');
  const rare = honest((it) => it.rarity === 'rare' && it.group === 'Weapons' && !it.sigil && !it.cursed, 'a Rare weapon');
  assert.ok(itemWorth({ ...rare, value: 0 }) > itemBaseValue(rare, lawTemplate), 'and its lines');
  const classicSlots = [{ type: T.PotentVs, param: 2 }, ...Array.from({ length: 9 }, () => ({ type: T.None, param: -1 }))];
  assert.equal(classicPiece({ ...dagger, enchantments: classicSlots }), true);
  assert.equal(classicPiece({ ...dagger, magic: true, enchantments: classicSlots }), false, 'DFU\'s own magic is the table\'s');
  assert.equal(classicPiece(rare), false);
  const forged = { ...dagger, affixes: [{ id: 'damage', value: 40 }] };
  const list = validLootList([dagger, forged, rare]);
  assert.equal(list.length, 2, 'the forged piece goes, the honest two stay (AUDIT INT: one cost the whole chest, "from a newer version")');
  assert.equal(validLootList([dagger, { name: 'no template' }]), null, 'a record of no shape is still a list this build cannot read');
});

/** DFU's table as MAGIC.DEF's bytes (formats/magicDef.js MagicItemsFile.ReadNextMagicItem's 62 a record). */
function dfuMagicDef() {
  const SIZE = 62;
  const buf = new Uint8Array(4 + DFU_MAGIC_ITEMS.length * SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, DFU_MAGIC_ITEMS.length, true);
  let o = 4;
  for (const r of DFU_MAGIC_ITEMS) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = r.material;
  }
  return buf;
}
