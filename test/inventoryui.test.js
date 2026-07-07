// U4: the three windows' pure behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryWindow, SpellbookWindow, knownSpells } from '../src/ui/inventory.js';

test('inventory window: cursor wrap, weapon equip via callback, arrows refused', () => {
  const entity = { items: [
    { group: 'Currency', name: 'Gold pieces', stackCount: 40, templateIndex: 0 },
    { group: 'Weapons', name: 'Short Bow', templateIndex: 129, material: 0 },
    { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 5 },
  ] };
  let equipped = null;
  const w = new InventoryWindow(entity, { equip: (it) => { equipped = it; } });
  w.input('up');
  assert.equal(w.cursor, 2);                      // wraps
  w.input('confirm');
  assert.equal(equipped, null);                   // arrows refuse equip
  assert.ok(!w.done);
  w.input('up');
  w.input('confirm');                             // the bow
  assert.equal(equipped.name, 'Short Bow');
  assert.ok(w.done);
  const g = new InventoryWindow(entity, {});
  g.input('confirm');                             // gold: not a weapon
  assert.ok(!g.done);
  g.input('back');
  assert.ok(g.done);
});

test('spellbook: the interim known list + ready callback', () => {
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  const byIndex = new Map([
    [1, { index: 1, name: 'Fireball', cost: 30, rangeType: 4, effects: [dmg] }],
    [2, { index: 2, name: 'Heal', cost: 10, rangeType: 0, effects: [{ type: 10, subType: 0 }] }],   // caster-only, non-damage: excluded
  ]);
  const list = knownSpells({ }, byIndex);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Fireball');
  // an entity WITH spells uses its own book
  const own = knownSpells({ spells: [{ index: 9, name: 'Own', cost: 5 }] }, byIndex);
  assert.equal(own[0].name, 'Own');
  let readied = null;
  const w = new SpellbookWindow(list, { magicka: 5, maxMagicka: 10 }, { ready: (sp) => { readied = sp; } });
  w.input('confirm');
  assert.equal(readied.index, 1);
  assert.ok(w.done);
  assert.equal(knownSpells({}, null).length, 0);
});
