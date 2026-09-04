// U8e: dropped loot - the ground pile module + the inventory
// window's remote side (DFU CreateDroppedLootContainer +
// DaggerfallInventoryWindow's droppedItems/loot-target laws).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  // FA1 slice 3: the record is BARE and the frame is a field. This
  // used to pin the hand-written '20#0', which is the same texture key
  // by a different route - and it was exactly what stopped these
  // batches being armed, since appending a frame to a record that
  // already ends in one reads '20#0#2'. Pin the KEY the draw builds,
  // which is the thing that has to stay true.
  assert.equal(pile.batch.record, 20);
  assert.equal(pile.batch.frame, 0);
  assert.equal(`${pile.batch.archive}_${pile.batch.record}#${pile.batch.frame}`, '216_20#0',
    'the same texture key as before, built by the one rule');
  assert.deepEqual(pile.batch.centers, [[10, 2, 30]]);
  // the activation box wraps the drop position (the corpse shape)
  const t = dl.lootTargets();
  assert.equal(t.length, 1);
  // AUDIT 17e F28: pile keys are STABLE IDS now - releaseEmptied
  // splices the array, so an index-based key would rebind to a
  // different pile after a cleanup.
  assert.equal(t[0].key, `droppedLoot:${pile.id}`);
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

test('droppedLoot P2 (items-2): a pile dies WITH its pixel; other pixels stand', async () => {
  const freed = [];
  const deps = {
    renderer: {
      createBillboardBatch: (archive, record, size, centers) => ({ archive, record, size, centers }),
      destroyBillboardBatch: (b) => freed.push(b),
    },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: () => {},
    pick: () => 1,
  };
  const dl = createDroppedLoot(deps);
  dl.dropPile([{ name: 'A' }], [1, 0, 1], '10,20');
  dl.dropPile([{ name: 'B' }], [2, 0, 2], '10,20');
  dl.dropPile([{ name: 'C' }], [3, 0, 3], '11,20');
  await Promise.resolve(); await Promise.resolve();
  // the sweep: pixel 10,20 tears down - BOTH its piles die, batches freed
  dl.collectPixel('10,20');
  assert.equal(dl._piles.length, 1, 'only the other pixel survives');
  assert.equal(dl._piles[0].items[0].name, 'C');
  assert.equal(freed.length, 2, 'the collected batches are freed (EVERY ALLOCATION HAS AN OWNER)');
  // a dungeon-shaped pile (no pixelKey) never collects
  dl.dropPile([{ name: 'D' }], [4, 0, 4]);
  dl.collectPixel('11,20');
  assert.equal(dl._piles.length, 1);
  assert.equal(dl._piles[0].items[0].name, 'D', 'pixel-less piles are outside the sweep');
});

test('droppedLoot P2 (items-2): the world-save halves round-trip in NATIVES, records unrerolled', async () => {
  let pickVal = 3;   // record 23 at drop; poisoned before restore so a reroll is DISTINGUISHABLE
  const deps = {
    renderer: { createBillboardBatch: (a, r, sz, c) => ({ record: r, centers: c }), destroyBillboardBatch: () => {} },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: () => {},
    pick: () => pickVal,
  };
  const dl = createDroppedLoot(deps);
  dl.dropPile([{ name: 'Gold', stackCount: 50 }], [100, 4, 200], '5,6');
  const empt = dl.dropPile([{ name: 'gone' }], [7, 0, 7], '5,6');
  empt.items.length = 0;   // an emptied pile must not serialize
  await Promise.resolve(); await Promise.resolve();
  // snapshot through a fake native mapper (local + 1000)
  const snap = dl.snapshotWorld((pos) => ({ x: pos[0] + 1000, z: pos[2] + 1000 }));
  assert.equal(snap.length, 1, 'empties are skipped');
  assert.equal(snap[0].nativeX, 1100);
  assert.equal(snap[0].nativeZ, 1200);
  assert.equal(snap[0].record, 23);
  assert.equal(snap[0].pixelKey, '5,6');
  // restore through the inverse under a DIFFERENT origin (+ a y shift);
  // the roll seam now yields record 0 - only the SAVED record may win
  pickVal = 0;
  dl.restoreWorld(snap, (nx, nz) => [nx - 900, nz - 900], 2);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(dl._piles.length, 1);
  assert.deepEqual(dl._piles[0].pos, [200, 6, 300], 'natives re-localize under the new origin; y gains the offset');
  assert.equal(dl._piles[0].record, 23, 'the restore must not reroll the icon');
  assert.equal(dl._piles[0].pixelKey, '5,6');
});

test('droppedLoot P2 (items-2): the world host wiring - collect at teardown, stamps at drop, the envelope', () => {
  const s = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(s.includes('droppedLoot.collectPixel(key)'), 'the pixel teardown sweeps its piles');
  // ROAD-G G5 put the drop icon and OnPop's container re-position
  // (:710-714) through the same door; the PIXEL STAMP is what this pin
  // is about and it still rides both sites.
  assert.ok(/dropPile\(\s*items, containerDropPos\(at, dropFeet\(\)\), `\$\{playerTravelPixel\(\)\.x\},\$\{playerTravelPixel\(\)\.y\}`, icon\)/.test(s),
    'the OnPop drop stamps the map pixel');
  assert.ok(/dropPile\(\[dfItem\], dropFeet\(\), `\$\{playerTravelPixel\(\)\.x\},\$\{playerTravelPixel\(\)\.y\}`\)/.test(s),
    'and so does the quest-reward one');
  assert.ok(s.includes('piles: droppedLoot.snapshotWorld((pos) => state.worldCoords(pos))'), 'the F9 envelope carries the piles in natives');
  assert.ok(s.includes('droppedLoot.restoreWorld(w.piles, (nx, nz) => state.localFromWorld(nx, nz), state.compensation[1])'),
    'the F11 load re-mints them after the teleport');
});
