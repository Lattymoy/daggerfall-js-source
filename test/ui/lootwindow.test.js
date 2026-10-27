// QUICK-LOOT-WINDOW (a player's report: the container window - opened with the activate key on a body or a crate - ignored the quick-loot
// key and the loot filter): its Take all leaves what the filter leaves, its rows dim what it would leave, and the take-everything key is its
// Take all. systems/quickLoot.js takeAllSplit / leftByFilter, and the window's wiring (by source).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setPref, resetPrefs, _resetForTests } from '../../src/systems/uiPrefs.js';
import { takeAllSplit, leftByFilter, QUICK_LOOT_LEFT } from '../../src/systems/quickLoot.js';
import { QL_RARITY_PREF, QL_MATERIAL_PREF, QL_SKIP } from '../../src/systems/quickLootFilter.js';
import { setJunk } from '../../src/systems/item/itemJunk.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { DEFAULT_BINDINGS } from '../../src/systems/inputActions.js';

beforeEach(() => { _resetForTests(); resetPrefs(); });
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const sword = (material, extra = {}) => ({ group: 'Weapons', templateIndex: 3, material, rarity: 'common', name: 'Sword', ...extra });
const gold = () => ({ group: 'Currency', templateIndex: 0, name: 'Gold Pieces', stackCount: 260 });

test('QUICK-LOOT-WINDOW the split: the window\'s Take all takes what the take-all key would and says how many stayed - an unticked rarity, a material, a skipped name, a junk mark; gold and the rest always taken; Quick loot off, everything (mutants: the filter unasked; the count off)', () => {
  const iron = sword(WEAPON_MATERIALS.Iron), daedric = sword(WEAPON_MATERIALS.Daedric), junk = sword(WEAPON_MATERIALS.Daedric, { name: 'Marked' });
  setJunk(junk, true);
  const pile = [gold(), iron, daedric, junk, { group: 'MiscItems', templateIndex: 300, name: 'Raw meat' }];
  let r = takeAllSplit(pile);
  assert.deepEqual(r.take, [pile[0], iron, daedric, pile[4]], 'by default only the marked piece stays');
  assert.equal(r.left, 1);
  for (const n of ['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Leather', 'Chain']) setPref(QL_MATERIAL_PREF(n), false);
  r = takeAllSplit(pile);
  assert.deepEqual(r.take, [pile[0], daedric, pile[4]], 'only Daedric of the gear, and the gold and the meat');
  assert.equal(r.left, 2);
  setPref(QL_SKIP, [{ mode: 'exact', text: 'raw meat' }]);
  assert.deepEqual(takeAllSplit(pile).take, [pile[0], daedric], 'a skipped name too');
  assert.equal(leftByFilter(iron), true);
  assert.equal(leftByFilter(daedric), false);
  assert.equal(leftByFilter(pile[0]), false, 'gold is never left');
  assert.equal(QUICK_LOOT_LEFT(3), '3 left by your quick-loot filter.');
  setPref('quickLoot', false);
  r = takeAllSplit(pile);
  assert.equal(r.take.length, pile.length, 'Quick loot off: the window is Daggerfall\'s, every row');
  assert.equal(r.left, 0);
  assert.equal(leftByFilter(iron), false);
});

test('QUICK-LOOT-WINDOW the key: the take-everything key resolves to QuickLootAll and the window answers it ahead of its modifier guard (a key bound to Control or Command is itself a modifier), for a container only and never in a text field or on a repeat (by source; mutants: the arm below the guard; a wagon\'s Take all filtered)', () => {
  assert.ok(DEFAULT_BINDINGS.some(([code, action]) => code === 'KeyP' && action === 'QuickLootAll'), 'the key is bound to the action the window reads (eventActions: a rebind to Control or Command resolves the same way)');
  const inv = rd('src/ui/enhanced/enhancedInventory.js');
  const fnAt = inv.indexOf('function containerTakeAllKey(e) {');
  const onKeyAt = inv.indexOf('function onKey(e) {');
  const callAt = inv.indexOf('if (containerTakeAllKey(e)) return;', onKeyAt);
  const guardAt = inv.indexOf("  if (e.metaKey || e.ctrlKey || e.altKey) return;", onKeyAt);
  assert.ok(fnAt > 0 && fnAt < onKeyAt && callAt > onKeyAt && guardAt > callAt, 'the arm stands ahead of the modifier guard');
  assert.match(inv, /if \(e\.repeat \|\| remote\?\.kind !== 'container' \|\| !quickLootOn\(\)\) return false;/);
  assert.match(inv, /t\.tagName === 'INPUT' \|\| t\.tagName === 'TEXTAREA' \|\| t\.isContentEditable\)\) return false;\n  if \(!eventActions\(e\)\.includes\('QuickLootAll'\)\) return false;\n  e\.preventDefault\(\); e\.stopPropagation\(\); bulkMove\('take'\);/);
  assert.match(inv, /taking && remote\?\.kind === 'container' \? takeAllSplit\(rows\) : \{ take: rows, left: 0 \}/, 'a container\'s Take all; a wagon\'s, a bag\'s and a chest\'s own stores are the player\'s');
  assert.match(inv, /if \(why \|\| left\) notice = \[why, left \? QUICK_LOOT_LEFT\(left\) : ''\]\.filter\(Boolean\)\.join\(' '\);/);
  assert.match(inv, /if \(from === 'remote' && remote\?\.kind === 'container' && leftByFilter\(item\)\) row\.dataset\.left = '';/);
  assert.match(rd('src/ui/enhanced/enhancedPlusStyle.js'), /\.pack-shell \[data-left\] \.tile > \* \{ opacity: 0\.5; filter: grayscale\(0\.7\); \}/);
});
