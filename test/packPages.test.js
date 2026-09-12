// PX31 - THE PACK'S PAGES (2026-09-12).
//
// Mac: "For the enhanced inventory, I think we need more tabs/sections
// for items. Like books currently go in clothing which doesn't make
// sense. Armor and weapons should be separate. Just take some autonomy
// and properly sort out everything."
//
// Nine pages for the enhanced pack, a PARTITION of what DFU's four
// tabs hold; the classic pack keeps DFU's four.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PACK_PAGES, PAGE_IDS, pageOf, filterByPage } from '../src/ui/packPages.js';
import { TABS, filterByTab } from '../src/ui/nativeInventory.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplates.js';
import { createPotion, POTION_TEMPLATE_INDEX } from '../src/systems/loot.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../src/systems/spellMaker.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** One of everything: every template of every group, plus the things
 *  a group alone does not say - a potion, an enchanted sword, the
 *  spellbook, a worn helm. */
const everything = () => {
  const bag = [];
  for (const [group, idx] of Object.entries(GROUP_TEMPLATE_INDICES)) {
    for (const templateIndex of new Set(idx)) bag.push({ group, templateIndex, name: `${group}#${templateIndex}` });
  }
  bag.push(createPotion('healing'));
  bag.push({ group: 'Weapons', templateIndex: 120, name: 'Enchanted Longsword', enchantments: [{ type: 1, param: 2 }] });
  bag.push({ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX, name: 'Spellbook' });
  bag.push({ group: 'Armor', templateIndex: 107, name: 'Worn Helm', equipSlot: 3 });
  return bag;
};

test('PX31: nine pages, a partition of exactly what DFU\'s four tabs hold', () => {
  assert.deepEqual(PAGE_IDS, ['weapons', 'armor', 'clothing', 'magic', 'potions', 'ingredients', 'books', 'valuables', 'misc']);
  assert.equal(new Set(PAGE_IDS).size, 9);
  assert.ok(PACK_PAGES.every(([, label]) => label && label[0] === label[0].toUpperCase()));
  const bag = everything();
  const onPages = PAGE_IDS.flatMap((p) => filterByPage(bag, p));
  const onTabs = TABS.flatMap((t) => filterByTab(bag, t));
  assert.equal(onPages.length, onTabs.length, 'the nine hold what the four hold - no item lost, none doubled');
  assert.equal(new Set(onPages).size, onPages.length, 'disjoint: an item lives on ONE page');
  assert.deepEqual(new Set(onPages), new Set(onTabs), 'and it is the same set');
  assert.ok(!onPages.some((it) => it.equipSlot != null), 'a worn item leaves the list (FilterLocalItems)');
  for (const it of bag) assert.ok(PAGE_IDS.includes(pageOf(it)), `${it.name}: every item answers a page`);
});

test('PX31: where things live - the pages a player looks for', () => {
  const p = (group, templateIndex, extra = {}) => pageOf({ group, templateIndex, ...extra });
  assert.equal(p('Weapons', 120), 'weapons');
  assert.equal(p('Armor', 102), 'armor');
  assert.equal(p('MensClothing', 163), 'clothing');
  assert.equal(p('WomensClothing', 200), 'clothing');
  assert.equal(p('Books', 277), 'books', 'a book is not a shirt');
  assert.equal(p('Maps', 287), 'books', 'a map is read');
  assert.equal(pageOf(createPotion('healing')), 'potions');
  assert.equal(p('UselessItems1', 82), 'misc', 'a glass jar shares the potion\'s group and is not a potion');
  assert.equal(p('Gems', 0), 'valuables', 'a ruby is an ingredient to DFU and a valuable to a player');
  assert.equal(p('Jewellery', 135), 'valuables');
  assert.equal(p('Currency', 276), 'valuables', 'a letter of credit');
  assert.equal(p('Deeds', 0), 'valuables', 'a deed reuses the gem indices and is not a gem');
  assert.equal(p('Paintings', 284), 'valuables');
  assert.equal(p('PlantIngredients1', 8), 'ingredients');
  assert.equal(p('MetalIngredients', 65), 'ingredients');
  assert.equal(p('Drugs', 78), 'misc');
  assert.equal(p('ReligiousItems', 258), 'misc');
  assert.equal(p('Transportation', 94), 'misc', 'the horse keeps its own strip (PX21a) and a page');
  assert.equal(p('QuestItems', 254), 'misc');
  assert.equal(p('MiscItems', SPELLBOOK_TEMPLATE_INDEX), 'magic', 'the spellbook, as DFU files it');
  assert.equal(p('Weapons', 120, { enchantments: [{ type: 1, param: 2 }] }), 'magic', 'an enchanted sword is a magic item on both skins');
  assert.equal(p('Armor', 102, { enchantments: [{ type: 1, param: 2 }] }), 'magic');
  assert.equal(pageOf(null), 'misc');
  assert.equal(POTION_TEMPLATE_INDEX, GROUP_TEMPLATE_INDICES.UselessItems1[1]);
});

test('PX31: the pack draws the pages; the classic keeps DFU\'s four', () => {
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /import \{ PACK_PAGES, PAGE_IDS, pageOf, filterByPage \} from '\.\/packPages\.js';/);
  assert.doesNotMatch(src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''), /filterByTab\(|\bTABS\b/, 'the pack no longer reads the four (its prose may still name them)');
  assert.match(src, /tabs: PACK_PAGES\.map\(\(\[tab, label\]\) => \(\{ tab, label, items: filterByPage\(items, tab\) \}\)\)/);
  assert.match(src, /for \(const \{ tab: t, label, items: rows \} of model\.tabs\) \{\s*\n\s*const n = rows\.length;\s*\n\s*const b = el\('button', `packtab\$\{t === tab \? ' on' : ''\}\$\{n \? '' : ' empty'\}`, label\);/, 'each page by its label, dimmed when empty');
  assert.match(src, /tab = pageOf\(taken\);/, 'the page follows what arrived');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.packtab\.empty \{ opacity: 0\.45; \}/);
  assert.match(css, /\.pack-shell \.pack-dock \.packcats \.packtabs \{ display: grid;\s*\n\s*grid-template-columns: repeat\(3, 1fr\);/, 'three by three on the phone dock');
  assert.deepEqual([...TABS], ['weapons', 'magic', 'clothing', 'ingredients'], 'DFU\'s four stand for the classic window');
});
