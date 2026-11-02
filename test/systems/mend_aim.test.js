// MEND-AIM (2026-09-30, Discord suggestion, kurkku: "Allow targeting field repair kit use" - "always repairing the most
// worn piece of equipment means fixing arrows or random loot you picked up most of the time. To fix the equipment you
// want to fix, you have to drop everything that's more worn than it"). A repair kit is AIMED: both packs ask which
// piece when there is more than one; the quick keys, which cannot ask, take what is worn first; an arrow is never
// mended. Each law is driven through the door a player reaches it by - the classic window's Use click and its list
// picker, the enhanced pack's card and chooser, the item-use door itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mintFieldRepairKit, mintPiece, useRepairKit, repairKitUse, repairKitTargets, kitMends, FIELD_KIT, installSmithing,
  MEND_WHICH_TEXT, mendTargetLabel,
} from '../../src/systems/smithItems.js';
import { useItem } from '../../src/systems/useItem.js';
import { weaponOfMaterial, armorOfMaterial, createWeapon, ARROW_TEMPLATE } from '../../src/combat/enemyEquipment.js';
import { NativeInventoryWindow } from '../../src/ui/native/nativeInventory.js';
import { ListPickerWindow, _setListPickerArtForTests } from '../../src/ui/listPicker.js';
import { mountEnhancedInventory, useResultAction } from '../../src/ui/enhanced/enhancedInventory.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { withDom } from '../invdrag.mjs';
import { _resetForTests } from '../../src/systems/uiPrefs.js';

installSmithing();

const LONGSWORD = 120, WAR_AXE = 127, CUIRASS = 102;
/** A piece at `pct` of its condition; `slot` marks it worn, as equip.js marks it. */
const at = (item, pct, slot = null) => {
  item.currentCondition = Math.round(item.maxCondition * pct / 100);
  if (slot != null) item.equipSlot = slot;
  return item;
};
const arrows = () => createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
/** The pack the suggestion describes: the sword in hand, a little worn; an axe off a corpse, badly worn; a quiver.
 *  KIT-CEILING: "a little worn" is below three quarters - a kit mends nothing past them. */
const kitPack = () => {
  const kit = mintFieldRepairKit();
  const sword = at(weaponOfMaterial(LONGSWORD, 5), 60, 0);
  const axe = at(weaponOfMaterial(WAR_AXE, 0), 20);
  const quiver = arrows();
  return { kit, sword, axe, quiver, items: [kit, sword, axe, quiver] };
};
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('MEND-AIM: an arrow is never mended - DFU mints a quiver at condition 0, so it was every kit\'s "most worn" piece', () => {
  const quiver = arrows();
  assert.equal(quiver.currentCondition, 0, 'the quiver is minted at nothing (ItemBuilder.CreateWeapon\'s arrow arm)');
  assert.ok(quiver.maxCondition > 0 && quiver.material === 0, 'an Iron weapon with condition to mend, by the old reading');
  assert.equal(kitMends(FIELD_KIT, quiver), false, 'not by a field kit');
  assert.equal(kitMends(0, quiver), false, 'nor by an Iron kit');
  const kit = mintFieldRepairKit();
  const axe = at(weaponOfMaterial(WAR_AXE, 0), 70);
  const done = useRepairKit(kit, [kit, quiver, axe]);
  assert.equal(done.item, axe, 'the axe is mended, not the arrows');
  assert.equal(quiver.currentCondition, 0);
});

test('MEND-AIM: unaimed, a kit takes what is WORN first, then the pack\'s, each the most worn first', () => {
  const { kit, sword, axe, items } = kitPack();
  const cuirass = at(armorOfMaterial(CUIRASS, 0x0200 + 1), 50, 1);
  items.push(cuirass);
  assert.deepEqual(repairKitTargets(kit, items), [cuirass, sword, axe], 'worn (the most worn of them first), then carried');
  const done = useRepairKit(kit, items);
  assert.equal(done.item, cuirass, 'the worn cuirass, never the looted axe at 20%');
  assert.equal(axe.currentCondition, Math.round(axe.maxCondition * 0.2), 'the axe untouched');
  assert.ok(!items.includes(kit), 'the kit spent');
  // a smith's kit keeps to its metal: the Iron kit sees the axe alone
  const iron = mintPiece({ recipe: 'kit:iron', quality: 0, seed: 1 }, '0000000000000001');
  assert.equal(iron.kitMetal, 0);
  assert.deepEqual(repairKitTargets(iron, [iron, sword, axe, arrows()]), [axe], 'Iron mends Iron - never its arrows');
  assert.deepEqual(repairKitTargets({ templateIndex: 1 }, items), [], 'nothing for anything but a kit');
});

test('MEND-AIM: AIMED, the kit mends the piece chosen - and a piece it cannot mend keeps the kit', () => {
  const { kit, sword, axe, quiver, items } = kitPack();
  const before = axe.currentCondition;
  const done = useRepairKit(kit, items, { target: axe });
  assert.equal(done.item, axe);
  assert.equal(axe.currentCondition, before + Math.ceil(axe.maxCondition * 0.15));
  assert.equal(sword.currentCondition, Math.round(sword.maxCondition * 0.6), 'the worn sword was the unaimed choice - untouched');
  const again = mintFieldRepairKit();
  const list = [again, quiver, sword];
  assert.equal(useRepairKit(again, list, { target: quiver }), null, 'an arrow is refused');
  assert.equal(useRepairKit(again, list, { target: { group: 'Weapons', material: 0, currentCondition: 1, maxCondition: 9 } }), null, 'and a piece not in the pack');
  assert.ok(list.includes(again), 'the kit kept');
});

test('MEND-AIM: the use door ASKS a host that can ask, with the pieces in the law\'s order, and mends the one it is aimed at', () => {
  const { kit, sword, axe, items } = kitPack();
  const r = useItem(kit, items, { chooseTarget: true });
  assert.equal(r.kind, 'chooseTarget');
  assert.equal(r.item, kit);
  assert.deepEqual(r.targets, [sword, axe], 'the worn sword, then the axe - no arrows');
  assert.equal(r.title, MEND_WHICH_TEXT);
  assert.deepEqual(r.labels, [`${itemLongName(sword)} 60% (worn)`, `${itemLongName(axe)} 20%`]);
  assert.ok(items.includes(kit), 'asking spends nothing');
  const aimed = useItem(kit, items, { target: axe });
  assert.equal(aimed.kind, 'repairKit');
  assert.match(aimed.text, /is mended: 20% to 35%\.$/);
  assert.ok(!items.includes(kit));
  // the quick keys cannot ask: the worn piece, unasked
  const k2 = mintFieldRepairKit();
  items.push(k2);
  assert.match(useItem(k2, items).text, /is mended: 60% to 75%\./);
  // one piece to mend: nothing to ask, it is mended
  const k3 = mintFieldRepairKit();
  const lone = [k3, at(weaponOfMaterial(LONGSWORD, 1), 50)];
  assert.equal(useItem(k3, lone, { chooseTarget: true }).kind, 'repairKit');
  // the pieces are the PACK's, whichever list the kit was used from: a kit on a corpse mends the player's sword
  const k4 = mintFieldRepairKit();
  const corpse = [k4, at(weaponOfMaterial(WAR_AXE, 2), 10)];
  const pack = [at(weaponOfMaterial(LONGSWORD, 3), 40, 0)];
  const off = useItem(k4, corpse, { localItems: pack });
  assert.match(off.text, /40% to 55%/);
  assert.ok(!corpse.includes(k4), 'the kit left the corpse it was used from');
  assert.equal(mendTargetLabel(pack[0]), `${itemLongName(pack[0])} 55% (worn)`);
});

test('MEND-AIM: the classic window pushes DFU\'s list picker over the pack; a row chosen mends that piece, a click outside keeps the kit', () => {
  _setListPickerArtForTests({ base: { tex: 'tex', w: 200, h: 128 } });
  try {
    const { kit, sword, axe, items } = kitPack();
    const w = new NativeInventoryWindow({ items: () => items, icons: ICONS });
    w._use(kit, items);
    assert.ok(w.inputBox instanceof ListPickerWindow, 'the picker is pushed');
    assert.deepEqual(w.inputBox.items, [`${itemLongName(sword)} 60% (worn)`, `${itemLongName(axe)} 20%`]);
    // keys: down to the axe, Enter picks it (ListBox.Update's Return is UseSelectedItem)
    w.input('ArrowDown');
    w.input('Enter');
    assert.equal(w.inputBox, null, 'the picker is gone');
    assert.equal(axe.currentCondition, Math.round(axe.maxCondition * 0.2) + Math.ceil(axe.maxCondition * 0.15), 'the axe was mended');
    assert.ok(!items.includes(kit), 'the kit spent');
    assert.match(w.topBox.rows[0].text, /is mended: 20% to 35%\./, 'and the pack says so');

    // cancelled: a click outside the picker's panel keeps the kit and mends nothing
    const k2 = mintFieldRepairKit();
    items.push(k2);
    w.boxes = [];
    w._use(k2, items);
    assert.ok(w.inputBox instanceof ListPickerWindow);
    const swordWas = sword.currentCondition;
    w.click(5, 5);
    assert.equal(w.inputBox, null);
    assert.ok(items.includes(k2), 'kept');
    assert.equal(sword.currentCondition, swordWas);
  } finally { _setListPickerArtForTests(null); }
  // with no picker art the window takes the law's own first choice, as the quick keys do
  const { kit, sword, items } = kitPack();
  const w = new NativeInventoryWindow({ items: () => items, icons: ICONS });
  w._use(kit, items);
  assert.equal(w.inputBox, null);
  assert.equal(sword.currentCondition, Math.min(Math.floor(sword.maxCondition * 0.75), Math.round(sword.maxCondition * 0.6) + Math.ceil(sword.maxCondition * 0.15)));   // KIT-CEILING
});

test('MEND-AIM: the enhanced pack\'s Use opens the chooser - the worn sword first, the axe, no arrows; a row mends it, Keep keeps the kit', () => {
  assert.deepEqual(useResultAction({ kind: 'chooseTarget', item: 1, targets: [2], labels: ['x'], title: 't' }),
    { kind: 'chooseTarget', item: 1, targets: [2], labels: ['x'], title: 't' });
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  withDom((dom) => {
    const { kit, sword, axe, items } = kitPack();
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 };
    let exits = 0;
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => { exits++; } });
    try {
      const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
      const kitRow = () => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes('Field Repair Kit')) ?? null;
      const useAct = () => host.querySelectorAll('.act').find((b) => b.textContent === 'Use' && b.closest('.acts')) ?? null;
      const chooser = () => dom.doc.querySelectorAll('.inv-target')[0] ?? null;
      let T = 900_000;
      const click = (n) => n.onclick({ timeStamp: (T += 1000), detail: 1, stopPropagation() {} });
      const openChooser = () => {
        if (!kitRow()) for (const tab of host.querySelectorAll('button')) if (!kitRow() && /all|misc|other|items/i.test(textOf(tab))) click(tab);
        assert.ok(kitRow(), 'the kit is on the pack\'s page');
        if (!useAct()) click(kitRow());   // the card stays open after Keep - a second press on the row would shut it
        assert.ok(useAct(), 'the kit\'s card offers Use');
        click(useAct());
        assert.ok(chooser(), 'the chooser is open');
        return chooser().querySelectorAll('.inv-menu-item');
      };
      const rows = openChooser();
      assert.deepEqual(rows.map((r) => r.textContent), [`${itemLongName(sword)} 60% (worn)`, `${itemLongName(axe)} 20%`]);
      assert.equal(textOf(chooser()).includes(MEND_WHICH_TEXT), true, 'it asks');
      click(rows[1]);
      assert.equal(chooser(), null, 'answered, it is gone');
      assert.equal(axe.currentCondition, Math.round(axe.maxCondition * 0.2) + Math.ceil(axe.maxCondition * 0.15), 'the axe mended');
      assert.equal(sword.currentCondition, Math.round(sword.maxCondition * 0.6), 'the sword untouched');
      assert.ok(!items.includes(kit), 'the kit spent');

      const k2 = mintFieldRepairKit();
      items.push(k2);
      view.repaint();
      const again = openChooser();
      assert.equal(again.length, 2);
      click(chooser().querySelectorAll('.act').find((b) => b.textContent === 'Keep'));
      assert.equal(chooser(), null);
      assert.ok(items.includes(k2), 'Keep keeps the kit');
      // Back (Escape, the pad's B) puts the chooser away and keeps the pack, as it does the dismantle's question
      openChooser();
      dom.win.fire('keydown', { key: 'Escape', code: 'Escape', repeat: false, preventDefault() {}, stopPropagation() {} });
      assert.equal(chooser(), null, 'Back closed the chooser');
      assert.equal(exits, 0, 'and not the pack under it');
      assert.ok(items.includes(k2), 'the kit kept');
    } finally { view.unmount(); }
  });
  delete globalThis.location;
});
