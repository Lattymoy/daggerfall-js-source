// FIELD BUGS 2026-10-09b - MARK-WIRE, the Discord's "market isnt accepting my drops lol" ("confirmed by 3 others"): the
// List form answered "The realm does not hold that piece where your pack had it. Nothing was listed." for a Steel
// Dagger of the Oak, a piece from the pack.
//
// ACQUIRE1 (the loot banner) marks every weapon, piece of armour or clothing, jewellery, artifact and card in the pack
// `acquired: true` its first frame (systems/acquireWatch.js), and the mark rides the save - so the realm's record of the
// pack carries it. The wire's clamp (systems/loot.js validLootItem) strips it, as a RECEIVER's mark, so the offer the
// List form sends does not. The realm's trade law (net/realmTradeLaw.js recordIsOffered) compares every field but the
// volatile ones, and its volatile list named the two older receiver's marks and not the new one: every marked piece
// was "not the record's piece", at the market, a stall and a realm trade alike. The three now read ONE list
// (RECEIVER_MARKS). `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as law from '../src/net/realmTradeLaw.js';
import { validLootItem, validLootList, generateRandomLoot, LOOT_MATRICES } from '../src/systems/loot.js';
import { wildRecord } from '../src/systems/wildDeath.js';
import { createAcquireWatch, ACQUIRED_FIELD } from '../src/systems/acquireWatch.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { seededRng } from '../src/systems/wind.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';

// read off the namespace, so the code before the fix fails each pin on its own assertion rather than at the import
const { recordIsOffered, takeTradeGoods, TRADE_VOLATILE_FIELDS } = law;

test('MARK-WIRE: the receiver\'s marks are ONE list - the realm\'s volatile fields, the wire\'s clamp and a wild death\'s record all drop every one of them, `acquired` among them (mutants: the volatile list spelled out without it; the moved record keeps it)', () => {
  assert.deepEqual(law.RECEIVER_MARKS, ['equipSlot', 'questItem', ACQUIRED_FIELD]);
  const dagger = createWeapon(113, 1, () => 0.5);
  for (const k of law.RECEIVER_MARKS) {
    assert.ok(TRADE_VOLATILE_FIELDS.includes(k), `${k} is volatile to the realm`);
    const rec = { ...JSON.parse(JSON.stringify(dagger)), [k]: k === 'equipSlot' ? 3 : true };
    const wire = validLootItem(rec);
    assert.equal(k in wire, false, `the wire's clamp strips ${k}`);
    assert.equal(k in wildRecord(rec), false, `a wild death's record strips ${k}`);
    assert.ok(recordIsOffered(rec, wire), `a record carrying ${k} is its own wire projection`);
  }
  // a worn piece and a quest's never leave (tradeableRecord); a piece marked `acquired` does, and arrives unmarked
  const save = { items: [{ ...JSON.parse(JSON.stringify(dagger)), acquired: true }], goldPieces: 0 };
  const moved = takeTradeGoods(save, { items: [validLootItem(save.items[0])], gold: 0 }, [0]);
  assert.ok(moved, 'a marked record leaves when it is offered');
  assert.equal('acquired' in moved[0], false, 'the moved record carries no mark to its next owner - new to its taker');
  // the identity check still stands: a forged edge is no record's piece
  assert.equal(recordIsOffered({ ...dagger, acquired: true }, { ...validLootItem(dagger), currentCondition: 1 }), false);
});

test('MARK-WIRE: a looted weapon as the HUD marks it and the checkpoint records it lists - the pack\'s record carries `acquired`, the List form\'s offer does not, and the realm takes the one for the other (mutant: the volatile list spelled out without it)', () => {
  const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11));
  const weapon = items.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
  assert.ok(weapon, 'the drop carries a weapon');
  const entity = { items: [weapon], chargenDone: true };
  createAcquireWatch().observe(entity);
  assert.equal(weapon.acquired, true, 'the HUD marks the pack\'s weapon');
  const save = { items: JSON.parse(JSON.stringify(entity.items)), goldPieces: 0 };   // what the checkpoint records (save.js copies items whole)
  const offered = validLootList([entity.items[0]])[0];   // what the List form sends (tradePack.js wire)
  assert.equal('acquired' in offered, false);
  const moved = takeTradeGoods(save, { items: [offered], gold: 0 }, [0]);
  assert.ok(moved, 'the realm holds the piece where the pack had it');
  assert.deepEqual(save.items, [], 'out of the record');
});
