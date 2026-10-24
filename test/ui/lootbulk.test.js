// LOOT-BULK (2026-10-16): a container and a wagon filter by name, by the pack's pages and by rarity, and Take all /
// Stash all walk the list on screen from the top until the next row does not fit.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { filterStore, storeRarityOptions, storeRarityAccepts, storeMaterialOptions, storeMaterialAccepts, storeMaterialOf } from '../../src/ui/storeFilter.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { bulkVerdict, runBulk, listAtCap, CONTAINER_LIST_CAP } from '../../src/ui/storeBulk.js';
import { planTake, planStore, WAGON_KG_LIMIT } from '../../src/systems/item/itemTransfer.js';
import { wagonKgFor } from '../../src/systems/wagon/wagonKinds.js';
import { SMALL_CART_TEMPLATE } from '../../src/systems/inventorySession.js';
import { ITEM_TEMPLATES } from '../../src/characters/paperdoll/paperdoll.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';
import { RARITIES, applyRarity } from '../../src/systems/loot/lootRarity.js';
import { itemNameParts } from '../../src/systems/item/itemInfo.js';
import { isStolen } from '../../src/systems/stolenGoods.js';   // STOLEN-GOODS: a take off someone else's keeping
import { TEMPLATES } from '../../src/systems/useItem.js';
import { setValue, _resetForTests as resetSettings } from '../../src/systems/settings/settings.js';

const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
const mk = (name, group = 'Weapons', extra = {}) => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50, ...extra };
};
const arrows = (n) => mk('Arrow', 'Weapons', { stackCount: n });
const cart = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });
const hero = (items) => ({ name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 0 });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

function withLoot(items, lootItems, fn, { wagon = null, stolenFrom = null } = {}) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero(items);
    if (wagon) e.wagonItems = wagon;
    const loot = wagon ? null : { items: () => lootItems, ...(stolenFrom ? { stolenFrom } : {}) };
    const view = mountEnhancedInventory(host, {
      entity: e, items: () => e.items, wagonItems: () => e.wagonItems, onExit: () => {},
      ...(loot ? { loot } : {}),
    });
    const press = (label) => [...host.querySelectorAll('button')].find((b) => b.textContent === label).onclick();
    const rarity = () => [...host.querySelectorAll('select')].find((m) => m.className === 'storerarity') ?? null;
    const material = () => [...host.querySelectorAll('select')].find((m) => m.className === 'storemat') ?? null;
    const rows = () => [...host.querySelectorAll('.itemrow')].filter((r) => r.closest('.loot-win')).map((r) => textOf(r));
    try {
      if (wagon) {
        [...host.querySelectorAll('button')].find((b) => b.onclick && /cart|wagon/i.test(textOf(b)) && !b.closest('.loot-win .remotelist')).onclick();
      }
      return fn({ host, e, press, rarity, material, rows, lootItems });
    } finally { view.unmount(); }
  });
}

test('LOOT-BULK storeFilter: the rarity menu lists the tiers the container holds, with their counts, and keeps a chosen empty tier (mutants: every tier listed, a rare read as common)', () => {
  const rare = mk('Mace', 'Weapons', { rarity: 'rare' });
  const plain = mk('Dagger');
  assert.equal(storeRarityAccepts(rare, 'rare'), true);
  assert.equal(storeRarityAccepts(plain, 'rare'), false);
  assert.equal(storeRarityAccepts(plain, 'nonsense'), true, 'an id the ladder does not have shows everything');
  assert.deepEqual(filterStore([rare, plain], { rarity: 'rare' }, (it) => it.name), [rare]);
  assert.deepEqual(filterStore([rare, plain], { cat: 'weapons', rarity: 'common', query: 'dag' }, (it) => it.name), [plain]);
  assert.deepEqual(storeRarityOptions([rare, plain, plain], 'legendary').map((c) => `${c.id}:${c.label}:${c.count}`), ['all:Rarity:3', 'common:Common:2', 'rare:Rare:1', 'legendary:Legendary:0']);
  assert.equal(CONTAINER_LIST_CAP, 64);
});

test('LOOT-BULK storeFilter: the material menu lists the metals the container holds, with their counts, and keeps a chosen empty metal (mutants: every metal listed, an arrow read as iron)', () => {
  const ebony = mk('Longsword', 'Weapons', { material: 7 });
  const leather = mk('Cuirass', 'Armor', { material: ARMOR_MATERIAL.Leather });
  const book = { group: 'Books', templateIndex: 277, name: 'Book' };
  assert.equal(storeMaterialOf(ebony), 'Ebony');
  assert.equal(storeMaterialOf(leather), 'Leather');
  assert.equal(storeMaterialOf(arrows(4)), '', 'an arrow names no metal');
  assert.equal(storeMaterialOf(book), '', 'a book names no metal');
  assert.equal(storeMaterialAccepts(ebony, 'Ebony'), true);
  assert.equal(storeMaterialAccepts(leather, 'Ebony'), false);
  assert.equal(storeMaterialAccepts(book, 'nonsense'), true, 'an id the list does not have shows everything');
  assert.deepEqual(filterStore([ebony, leather, book], { material: 'Ebony' }, (it) => it.name), [ebony]);
  assert.deepEqual(storeMaterialOptions([ebony, leather, book], 'Steel').map((c) => `${c.id}:${c.count}`), ['all:3', 'Leather:1', 'Steel:0', 'Ebony:1']);
  assert.equal(storeMaterialOptions([ebony], 'all')[0].label, 'Material');
});

test('MAT-FILTER: the material menu finds a piece only by a metal its card says - never an unidentified piece below Rare, an artifact, or a helm under HelmAndShieldMaterialDisplay; an unidentified Rare says its metal and is found by it (mutants: the menu reads the raw metal)', () => {
  let seed = 7;
  const roll = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const magic = mk('Longsword', 'Weapons', { material: 9, enchantments: [{ type: 3, param: 1 }] });   // Daedric, enchanted, never identified
  assert.equal(itemNameParts(magic).material, '', 'its card withholds the metal');
  assert.equal(storeMaterialOf(magic), '', 'so the menu does not name it');
  assert.deepEqual(storeMaterialOptions([magic]).map((c) => c.id), ['all'], 'and lists no Daedric to pick it out by');
  assert.deepEqual(filterStore([magic], { material: 'Daedric' }, (it) => it.name), [], 'and the Daedric filter does not find it');
  assert.equal(storeMaterialOf({ ...magic, isIdentified: true }), 'Daedric', 'identified, it says its metal and is found by it');
  const artifact = mk('Longsword', 'Weapons', { material: 9, artifact: true });
  assert.equal(storeMaterialOf(artifact), '', 'an artifact keeps DFU\'s withhold');
  const rare = applyRarity(mk('Longsword', 'Weapons', { material: 7 }), 'rare', roll);
  assert.ok(itemNameParts(rare).material, 'an unidentified Rare says its metal on its card (MAT-SHOW)');
  assert.equal(storeMaterialOf(rare), 'Ebony', 'and the menu finds it by that metal');
  resetSettings();
  try {
    const helm = { group: 'Armor', templateIndex: TEMPLATES.Helm, material: ARMOR_MATERIAL.Steel, name: 'Helm', stackCount: 1 };
    setValue('GUI', 'HelmAndShieldMaterialDisplay', 0);
    assert.equal(storeMaterialOf(helm), '', 'a helm that names no metal is not found by one');
    setValue('GUI', 'HelmAndShieldMaterialDisplay', 3);
    assert.equal(storeMaterialOf(helm), 'Steel', 'and is, once the setting shows it');
  } finally { resetSettings(); }
});

test('LOOT-BULK on a container: a material narrows the rows the same way a rarity does', () => {
  const ebony = mk('Longsword', 'Weapons', { material: 7, name: 'Ebony Blade' });
  const iron = mk('Dagger', 'Weapons', { material: 0 });
  withLoot([], [ebony, iron], ({ material, rows }) => {
    const menu = material();
    assert.ok(menu, 'the container has its material menu');
    assert.deepEqual([...menu.children].map((o) => o.textContent), ['Material', 'Iron (1)', 'Ebony (1)']);
    menu.value = 'Ebony'; menu.onchange();
    assert.equal(rows().length, 1, 'only the ebony row');
    assert.match(rows()[0], /Ebony Blade/);
  });
});

test('LOOT-BULK runBulk: a refusal is skipped, the first row with no room stops the walk, and a partial move is the last (mutants: a full row skipped, a partial continued)', () => {
  const moved = [];
  const stopped = runBulk(['no', 'yes', 'full', 'later'], (item) => {
    if (item === 'no') return { verdict: 'skip', refusal: { text: 'stays' } };
    if (item === 'full') return { verdict: 'stop', refusal: { text: 'no room' } };
    return { verdict: 'move' };
  }, (item) => moved.push(item));
  assert.deepEqual(moved, ['yes']);
  assert.equal(stopped.notice, 'no room');
  const part = [];
  runBulk(['stack', 'after'], (item) => (item === 'stack' ? { verdict: 'partial' } : { verdict: 'move' }), (item) => part.push(item));
  assert.deepEqual(part, ['stack']);
  assert.equal(bulkVerdict(mk('Mace'), { ok: false, refusal: { reason: 'cannotCarry' } }), 'stop');
  assert.equal(bulkVerdict(mk('Mace'), { ok: false, refusal: { reason: 'questItem' } }), 'skip');
  assert.equal(bulkVerdict(arrows(5), { ok: true, amount: 2 }), 'partial');
  assert.equal(listAtCap([mk('Dagger'), mk('Dagger')], mk('Mace'), 2), true);
  assert.equal(listAtCap([arrows(3)], arrows(4), 1), false, 'a stack that merges is not a new row');
});

test('LOOT-BULK on a container: rarity narrows the rows; Take all stops on the first row that does not fit and leaves the lighter row under it; a partial stack is the last row taken', () => {
  const rare = mk('Mace', 'Weapons', { rarity: 'rare', name: 'Rare Mace' });
  const plain = mk('Dagger');
  withLoot([], [rare, plain], ({ rarity, rows, press, e, lootItems }) => {
    const menu = rarity();
    assert.ok(menu, 'the container has its rarity menu');
    assert.deepEqual([...menu.children].map((o) => o.textContent), ['Rarity', 'Common (1)', 'Rare (1)']);
    menu.value = 'rare'; menu.onchange();
    assert.equal(rows().length, 1, 'only the rare row');
    press('Take all');
    assert.equal(e.items.length, 1);
    assert.equal(e.items[0], rare, 'only the row on screen');
    assert.deepEqual(lootItems, [plain]);
  });

  const bag = [];
  const e = hero(bag);
  const blocker = mk('Mace');
  while (planTake(blocker, { bag, entity: e }).ok) bag.push(mk('Mace'));
  while (!planTake(arrows(1), { bag, entity: e }).ok && bag.length) bag.pop();
  assert.equal(planTake(mk('Mace'), { bag, entity: e }).ok, false, 'the pack takes no mace');
  assert.equal(planTake(arrows(1), { bag, entity: e }).ok, true, 'and still takes an arrow');
  const left = mk('Mace');
  const quiver = arrows(1);
  withLoot(bag, [left, quiver], ({ press, lootItems }) => {
    press('Take all');
    assert.ok(lootItems.includes(left), 'the mace that does not fit stays, and stops the walk');
    assert.ok(lootItems.includes(quiver), 'the arrow under it stays too');
  });

  const pile = mk('Mace', 'Weapons', { stackCount: 40 });
  const fit = planTake(pile, { bag: [], entity: hero([]) });
  assert.ok(fit.ok && fit.amount > 0 && fit.amount < 40, `a part of the stack fits (${fit.amount})`);
  const dagger = mk('Dagger');
  withLoot([], [pile, dagger], ({ press, e: who, lootItems }) => {
    press('Take all');
    assert.equal(pile.stackCount, 40 - fit.amount, 'what fit was taken');
    assert.ok(lootItems.includes(pile) && lootItems.includes(dagger), 'the rest of the stack, and the dagger under it, stay');
    assert.equal(who.items.some((it) => it.name === 'Dagger'), false);
  });
});

test('LOOT-BULK Stash all: the button sits under the pack list; a summoned piece is left and the next row goes; a full wagon stops and leaves the lighter row', () => {
  const summoned = mk('Dagger', 'Weapons', { timeForItemToDisappear: 1 });
  const mace = mk('Mace');
  const held = [];
  withLoot([cart(), summoned, mace], null, ({ press, e, host }) => {
    const onLootBar = [...host.querySelectorAll('.remoteacts')].filter((b) => b.closest('.loot-win')).some((b) => textOf(b).includes('Stash all'));
    assert.equal(onLootBar, false, 'not on the container bar');
    const foot = [...host.querySelectorAll('.stashfoot')].find((n) => n.closest('.pack-dock'));
    assert.equal(foot?.children?.[0]?.textContent, 'Stash all', 'centred under the pack list');
    press('Stash all');
    assert.deepEqual(held.map((it) => it.name), ['Mace']);
    assert.ok(e.items.includes(summoned), 'the summoned dagger stays in the pack');
  }, { wagon: held });

  const wagon = [];
  const holder = hero([cart()]);
  const kg = wagonKgFor(holder);
  const unit = mk('Mace');
  while (planStore(unit, { remote: wagon, usingWagon: true, wagonKg: kg }).ok) wagon.push(mk('Mace'));
  while (!planStore(arrows(1), { remote: wagon, usingWagon: true, wagonKg: kg }).ok && wagon.length) wagon.pop();
  assert.equal(planStore(mk('Mace'), { remote: wagon, usingWagon: true, wagonKg: kg }).ok, false);
  assert.equal(planStore(arrows(1), { remote: wagon, usingWagon: true, wagonKg: kg }).ok, true);
  assert.equal(kg, WAGON_KG_LIMIT);
  const stay = mk('Mace');
  const light = arrows(1);
  withLoot([cart(), stay, light], null, ({ press, e }) => {
    press('Stash all');
    assert.ok(e.items.includes(stay), 'the mace that does not fit stays');
    assert.ok(e.items.includes(light), 'the arrows under it stay');
  }, { wagon });
});

test('LOOT-BULK + STOLEN-GOODS: Take all off a stranger\'s cupboard marks every piece of the owner\'s it takes, as a single take does, and not the player\'s own piece put there (mutants: the walk\'s transfer without the owner\'s keeping)', () => {
  const theirs = mk('Dagger');
  const alsoTheirs = mk('Mace');
  const own = mk('Longsword');   // put there in this window: not in the keeping
  withLoot([], [theirs, own, alsoTheirs], ({ press, e, lootItems }) => {
    press('Take all');
    assert.deepEqual(lootItems, [], 'the cupboard is emptied');
    assert.deepEqual(e.items.map((it) => [it.name, isStolen(it)]), [['Dagger', true], ['Longsword', false], ['Mace', true]]);
  }, { stolenFrom: new Set([theirs, alsoTheirs]) });
  const body = [mk('Dagger')];
  withLoot([], body, ({ press, e }) => {
    press('Take all');
    assert.equal(isStolen(e.items[0]), false, 'a pile nobody keeps marks nothing');
  });
});
