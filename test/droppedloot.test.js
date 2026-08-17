// U8e: dropped loot - the ground pile module + the inventory
// window's remote side (DFU CreateDroppedLootContainer +
// DaggerfallInventoryWindow's droppedItems/loot-target laws).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDroppedLoot, RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS } from '../src/scenes/droppedLoot.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('droppedLoot: the verbatim treasure flat + empty-pile removal', async () => {
  // DaggerfallLootDataTables verbatim
  assert.equal(RANDOM_TREASURE_ARCHIVE, 216);
  assert.deepEqual([...RANDOM_TREASURE_ICONS], [0, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 37, 43, 44, 45, 46, 47]);
  const uploads = [];
  const deps = {
    renderer: { createBillboardBatch: (archive, record, size, centers) => ({ archive, record, size, centers }) },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: (a, r, f) => uploads.push([a, r, f]),
    pick: () => 1,   // -> record 20
  };
  const dl = createDroppedLoot(deps);
  const pile = dl.dropPile([{ templateIndex: 277, name: 'Book' }], [10, 2, 30]);
  await Promise.resolve(); await Promise.resolve();   // the warm settles
  assert.deepEqual(uploads, [[216, 20, 0]]);
  assert.equal(pile.batch.record, '20#0');
  assert.deepEqual(pile.batch.centers, [[10, 2, 30]]);
  // the activation box wraps the drop position (the corpse shape)
  const t = dl.lootTargets();
  assert.equal(t.length, 1);
  assert.equal(t[0].key, 'droppedLoot:0');
  assert.deepEqual(t[0].aabb.min, [9.5, 2, 29.5]);
  assert.deepEqual(t[0].aabb.max, [10.5, 2.6, 30.5]);
  assert.equal(dl.batches().length, 1);
  // EMPTIED piles vanish (SerializableLootContainer's removal law)
  pile.items.length = 0;
  assert.equal(dl.lootTargets().length, 0);
  assert.equal(dl.batches().length, 0);
  // an empty drop mints nothing
  assert.equal(dl.dropPile([], [0, 0, 0]), null);
});

test('nativeInventory: the remote side - Remove drops, pile clicks pick up, onDrop mints', () => {
  // plain open: Equip default; Remove-mode local click -> droppedItems;
  // close hands the session pile to onDrop (the OnPop world mint)
  const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
  let minted = null;
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, onDrop: (items) => { minted = items; } });
  assert.equal(w.mode, 'equip');
  assert.ok(w.click(226 + 5, 80 + 5));   // the Remove button
  assert.equal(w.mode, 'remove');
  assert.ok(w.click(163 + 9 + 5, 48 + 5));   // local slot 0 -> drops
  assert.equal(bag.length, 0);
  assert.equal(w.dropped.length, 1);
  // a remote click takes it straight back (RemoteItemListScroller)
  assert.ok(w.click(261 + 9 + 5, 48 + 5));
  assert.equal(bag.length, 1);
  assert.equal(w.dropped.length, 0);
  // drop again and close: onDrop receives the pile
  w.click(163 + 9 + 5, 48 + 5);
  w.input('Escape');
  assert.ok(w.done);
  assert.equal(minted?.length, 1);
  assert.equal(minted[0].name, 'Dagger');
  // loot-target open: REMOVE is the default ("so player does not
  // accidentially equip when picking up"); pile clicks transfer in
  const bag2 = [];
  const pile = [{ group: 'Books', templateIndex: 277, name: 'Book' }];
  const w2 = new NativeInventoryWindow({ items: () => bag2, icons: ICONS, loot: { items: () => pile } });
  assert.equal(w2.mode, 'remove');
  assert.ok(w2.click(261 + 9 + 5, 48 + 5));
  assert.equal(pile.length, 0);
  assert.equal(bag2.length, 1);
  // nothing dropped this session -> closing mints nothing
  let minted2 = false;
  w2.hooks.onDrop = () => { minted2 = true; };
  w2.input('Escape');
  assert.equal(minted2, false);
});
