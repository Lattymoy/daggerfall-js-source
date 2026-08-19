// U4: the spellbook and death windows' pure behavior.
//
// U26 DELETED the keyed inventory window this file opened with. Its
// two laws did not go with it: the arrow exclusion is systems/equip.js's
// (pinned in test/audit18_ui_native.test.js F13, now against the
// native window), and cursor wrapping belongs to the list widgets the
// native window replaced. Nothing is left unpinned by the removal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpellbookWindow, knownSpells } from '../src/ui/inventory.js';

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
