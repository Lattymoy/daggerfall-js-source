// ARMOR-MOUNT (2026-09-26, Mac: "Cant set down armor in house - Would be awesome to display armor as well so people
// can run shop and show collection"): DECOR2c hung a weapon or one of the four shields, and armour never stands
// (DECOR2a: it is mounted) - so a cuirass, a helm or boots had no way into a room at all. Every piece of armour hangs
// now, as a shield does: its pack picture (the owner's body's), flat on the surface it is set on, free and back to the
// pack whole when taken down. Worn armour stays refused, as a worn blade is.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorIsMount, decorWhatOf, DECOR_ARMOR_GROUP } from '../src/net/decorLaw.js';
import { decorMountOf, decorStandOf, decorOwnEntry, decorMountDye } from '../src/systems/decorItems.js';
import { inventoryItemImage, ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { itemDyeColor } from '../src/systems/itemDye.js';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { settle } from './decorFakes.mjs';

// Daggerfall's ItemGroups.Armor: Cuirass .. Tower_Shield, templates 102-112
const ARMOUR = ITEM_TEMPLATES.filter((t) => t.index >= 102 && t.index <= 112);
const piece = (t, extra = {}) => ({ templateIndex: t, group: 'Armor', material: 3, stackCount: 1, ...extra });

test('ARMOR-MOUNT: every piece of armour hangs as its own pack picture - the owner\'s body\'s - and none stands', () => {
  assert.deepEqual(ARMOUR.map((t) => t.name), ['Cuirass', 'Gauntlets', 'Greaves', 'Left Pauldron', 'Right Pauldron', 'Helm', 'Boots',
    'Buckler', 'Round Shield', 'Kite Shield', 'Tower Shield'], 'the eleven, shields among them');
  for (const t of ARMOUR) {
    for (const body of [undefined, { gender: 'female' }]) {
      const pic = inventoryItemImage(piece(t.index), body);
      const m = decorMountOf(piece(t.index), body);
      assert.ok(m, `${t.name} hangs`);
      assert.deepEqual(m.flat, [pic.archive, pic.record], `${t.name}: the pack's own picture`);
      assert.equal(m.light, null);
      assert.deepEqual([m.item.t, m.item.g, m.item.m], [t.index, DECOR_ARMOR_GROUP, 3], 'its own numbers');
    }
    assert.equal(decorStandOf(piece(t.index)), null, `${t.name} never stands - it is mounted`);
  }
  assert.deepEqual(decorMountOf(piece(102)).flat, [251, 4], 'a man\'s steel cuirass');
  assert.deepEqual(decorMountOf(piece(102), { gender: 'female' }).flat, [247, 4], 'a woman\'s');
});

test('ARMOR-MOUNT: worn armour, a quest\'s and a summoned piece stay in the pack', () => {
  assert.equal(decorMountOf(piece(107, { equipSlot: 'Head' })), null, 'take the helm off first');
  assert.equal(decorMountOf(piece(102, { questItem: true })), null);
  assert.equal(decorMountOf(piece(102, { timeForItemToDisappear: 100 })), null);
});

test('ARMOR-MOUNT: the decorator lists a cuirass as a thing that hangs, and every client reads the piece as a mount off its numbers', () => {
  const e = decorOwnEntry(piece(102), 4);
  assert.equal(e.mount, true, 'the row hangs it');
  assert.deepEqual(e.flat, [251, 4]);
  const onWire = decorWhatOf({ model: null, flat: e.flat, item: e.item });
  assert.ok(onWire, 'the law carries it');
  assert.equal(decorIsMount({ model: null, ...onWire }), true, 'a visitor sees it hang, not stand');
  assert.equal(decorMountDye(e.item), itemDyeColor({ group: 'Armor', material: 3 }), 'its material\'s dye, off its numbers');
});

test('ARMOR-MOUNT: the room hangs a cuirass as a picture on the decal pass', async () => {
  const calls = [];
  const textures = new Map();
  const tex = { recordCount: 40, getSize: () => ({ width: 40, height: 48 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() },
    renderer: {
      textures,
      createBillboardBatch: () => { calls.push(['billboard']); return {}; }, destroyBillboardBatch: () => {}, drawMesh: () => {},
      createDecalBatch: () => ({ id: 'mount' }), writeDecalSlot: () => true, destroyDecalBatch: () => {},
      drawDecals: (b, t) => calls.push(['film', b.id, t]),
      drawDecalPicture: (b, t) => calls.push(['picture', b.id, t]),
    },
    getTexture: async () => tex,
    uploadRecord: (a, r) => { textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`); return '#ui'; },
    collider: () => null, origin: () => [0, 0, 0], roomLights: () => [],
  });
  pool.put({ id: 'c1', model: null, flat: [251, 4], item: { t: 102, g: 2, m: 3, v: null, a: null, p: null }, pos: [0, 1.2, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  await settle();
  assert.equal(pool.drawMounts(), 1);
  assert.deepEqual(calls, [['picture', 'mount', 'tex:251.4']], 'hung flat as its picture - never a billboard turned to the eye');
});
