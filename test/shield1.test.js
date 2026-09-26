// SHIELD1 (2026-09-25): a shield on the hotbar straps on with one press and comes off with the next; a torch slot
// takes the shield off first and lights the torch - and puts the shield back if the light will not light.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as HB from '../src/systems/quickslots.js';
import { equipTableOf, EQUIP_SLOTS, equipItem, isEquipped } from '../src/systems/equip.js';
import { TEMPLATES } from '../src/systems/useItem.js';

const kite = () => ({ group: 'Armor', templateIndex: 111, material: 0, name: 'Kite Shield', currentCondition: 80, maxCondition: 100 });
const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', currentCondition: 40, maxCondition: 100 });
const lightDoors = (me) => ({ quickUse: () => { HB.useQuickslot('c1', { entity: me, items: me.items }); return true; } });
const body = (items) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items, lightSource: null });

test('SHIELD1: a shield is a hotbar kind; its press straps it into the left hand, the next takes it off; a save keeps the kind', () => {
  HB.clearQuickslots();
  const sh = kite();
  assert.equal(HB.hotbarKindOf(sh), 'shield');
  const me = body([sh]);
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(sh));
  const said = [];
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me), say: (l) => said.push(l) }).kind, 'equipped');
  assert.equal(equipTableOf(me)[EQUIP_SLOTS.LeftHand], sh, 'on the left hand');
  assert.equal(HB.hotbarView(me)[0].active, true, 'the slot shows it in hand');
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me), say: (l) => said.push(l) }).kind, 'unequipped');
  assert.equal(isEquipped(sh), false, 'and off again');
  assert.match(said.join(' | '), /strap on your .*Kite Shield.*take off your .*Kite Shield/i);
  const saved = HB.quickslotSaveData();
  HB.clearQuickslots(); HB.restoreQuickslotSaveData(saved);
  assert.equal(HB.hotbarEntry(0)?.kind, 'shield', 'the kind survives a save');
  HB.clearQuickslots();
});

test('SHIELD1: a broken shield refuses in words, and a shield no longer carried says so', () => {
  HB.clearQuickslots();
  const sh = { ...kite(), currentCondition: 0 };
  const me = body([sh]);
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(kite()));
  const said = [];
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me), say: (l) => said.push(l) }).kind, 'refused');
  assert.equal(isEquipped(sh), false);
  me.items = [];
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me), say: (l) => said.push(l) }).kind, 'gone');
  assert.match(said.join(' | '), /broken.*no Kite Shield/i);
  HB.clearQuickslots();
});

test('SHIELD1: a torch slot with the shield up takes the shield off and lights the torch (it was "Your off hand is full")', () => {
  HB.clearQuickslots();
  const sh = kite(), t = torch();
  const me = body([sh, t]);
  equipItem(me, sh);
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(t));
  HB.setHotbarSlot(1, HB.hotbarEntryForItem(sh));
  assert.equal(HB.hotbarPress(0, { entity: me, doors: lightDoors(me) }).kind, 'light');
  assert.equal(isEquipped(sh), false, 'the shield came off');
  assert.equal(me.lightSource, t, 'and the torch is lit');
  // and back: the shield slot straps it on again
  assert.equal(HB.hotbarPress(1, { entity: me, doors: lightDoors(me) }).kind, 'equipped');
  assert.equal(equipTableOf(me)[EQUIP_SLOTS.LeftHand], sh);
  HB.clearQuickslots();
});

test('SHIELD1: a light that will not light puts the shield back where it was', () => {
  HB.clearQuickslots();
  const sh = kite(), t = torch();
  const me = body([sh, t]);
  equipItem(me, sh);
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(t));
  const refusing = { quickUse: () => { HB.useQuickslot('c1', { entity: { ...me, items: [] }, items: [] }); return true; } };
  const r = HB.hotbarPress(0, { entity: me, doors: refusing });
  assert.equal(r.kind, 'refused');
  assert.equal(equipTableOf(me)[EQUIP_SLOTS.LeftHand], sh, 'the shield is back on');
  HB.clearQuickslots();
});
