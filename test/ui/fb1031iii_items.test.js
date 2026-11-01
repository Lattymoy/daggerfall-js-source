// AUDIT FB1031 III I3, I4 (bible/01-Overview/audits/Audit-FB1031.md, lane III): PACK-SORT keeps a quickslot on the
// piece it held, and BOUND-DESTROY says why a Yes destroyed nothing.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { sortInPlace, sortedItems } from '../../src/ui/packSort.js';
import { quickslotKey, assignQuickslot, resolveSwap, clearQuickslots } from '../../src/systems/quickslots.js';
import { itemLine } from '../../src/ui/enhanced/enhancedInventory.js';
import { soulCakes, restackSoulCakes } from '../../src/systems/festival/soulCake.js';
import { destroyPiece, destroyRefusalText } from '../../src/systems/item/itemDiscard.js';

const dagger = () => mintCondition(setItemFields({ group: 'Weapons', templateIndex: 113, material: 1 }));   // a Steel Dagger

test('AUDIT FB1031 III I3: Sort keeps each quickslot kind\'s records in their old order - a Masterwork named by its maker\'s mark stays the swap slot\'s, over its plain twin; the rest sorts as before (mutant: the kinds dealt back no more)', () => {
  const made = Object.assign(dagger(), { quality: 4, maker: 'Silverthorn', provenance: '0123456789abcdef' });
  const plain = dagger();
  const entity = { items: [made, plain] };
  assert.equal(quickslotKey(made), quickslotKey(plain), 'one quickslot kind');
  const nameOf = (it) => itemLine(it, entity).name;
  assert.ok(nameOf(made) !== nameOf(plain), `two names (${nameOf(made)} / ${nameOf(plain)})`);
  clearQuickslots();
  assignQuickslot('swap', made);
  sortInPlace(entity.items, { nameOf });
  assert.equal(resolveSwap(entity)?.item, made, 'the swap slot still the Masterwork');
  // the same kind spread among others: dealt back into the places the sort gave them, in their old order
  const gem = setItemFields({ group: 'Gems', templateIndex: 0 });
  const list = [plain, gem, made];
  const order = sortedItems(list, { nameOf: (it) => (it === gem ? 'A' : it === plain ? 'Z' : 'B') });
  assert.deepEqual(new Set(order), new Set(list), 'every record kept');
  assert.ok(order.indexOf(plain) < order.indexOf(made), 'the twin first, as it stood - by name the Masterwork (B) would go before it (Z)');
  clearQuickslots();
});

test('AUDIT FB1031 III I4: Destroy pressed on a face stack a festival answer restacked - nothing destroyed, and said so, on both skins\' words (mutant: \'gone\' unsaid)', () => {
  const items = [soulCakes(5)];
  const asked = items[0];
  restackSoulCakes(items, 6);
  const r = destroyPiece(asked, { items });
  assert.deepEqual(r, { ok: false, reason: 'gone' });
  assert.equal(items[0].stackCount, 6, 'nothing moved');
  assert.equal(destroyRefusalText('Soul Cake', 'gone'), 'Soul Cake has moved in your pack. Nothing was destroyed.');
  assert.equal(destroyRefusalText('Soul Cake', undefined), null, 'no reason, no words');
});
