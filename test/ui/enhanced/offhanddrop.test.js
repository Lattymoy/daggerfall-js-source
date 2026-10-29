// HAND-DROP (FIELD BUGS 2026-10-29, #feature-feedback "Equipping offhand weapon"): "Dragging a weapon from the
// inventory to the L-Hand slot pushes the weapon that was previously there to the right hand and unequips what was your
// main weapon. It should just replace the offhand weapon."
//
// Driven through the mounted pack (test/invdrag.mjs), with weapons and shields from the item makers and the real
// equip.js: a pack piece dropped on a hand's panel goes in that hand and takes off only that hand's piece.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { withDom } from '../../invdrag.mjs';
import { mountEnhancedInventory } from '../../../src/ui/enhanced/enhancedInventory.js';
import { equipItem, equipTableOf, unequipSlot, isEquipped, mayHold, addEquipChangeListener, EQUIP_SLOTS } from '../../../src/systems/equip.js';
import { createWeapon, armorOfMaterial, ARMOR_ENUM } from '../../../src/combat/enemyEquipment.js';
import { WEAPONS } from '../../../src/characters/weapons.js';
import { PAGE_IDS, pageOf } from '../../../src/ui/packPages.js';

const IRON = 0;
const R = EQUIP_SLOTS.RightHand, L = EQUIP_SLOTS.LeftHand;
const weapon = (t) => createWeapon(t, IRON);
const kiteShield = () => armorOfMaterial(ARMOR_ENUM.Kite_Shield, IRON);
const hero = () => ({ name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] });

/** The hands set the table's own way - the right first, so the next one-hander takes the left - and a hand meant
 *  empty emptied after, so the setup does not lean on the fix. */
function dress(e, { right = null, left = null }) {
  const filler = right ?? (left ? weapon(WEAPONS.Tanto) : null);
  for (const it of [filler, left]) if (it) { e.items.push(it); assert.notEqual(equipItem(e, it), null, `${it.name} goes on`); }
  if (!right && filler) { unequipSlot(e, R); e.items.splice(e.items.indexOf(filler), 1); }
  assert.equal(equipTableOf(e)[R], right, 'the right hand as set');
  assert.equal(equipTableOf(e)[L], left, 'the left hand as set');
}

/** The pane mounted over one pack piece and the hands given; `drop(fam)` drags the piece onto that hand's panel. */
function withHands(hands, piece, fn) {
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero();
    dress(e, hands);
    e.items.push(piece);
    mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    const panel = (fam) => dom.doc.querySelectorAll('.wornrow').find((n) => n.dataset.fam === fam);
    const label = () => dom.doc.querySelectorAll('.dragghost')[0]?.querySelector('.ghostact')?.textContent ?? null;
    const refused = () => dom.doc.querySelectorAll('.dragghost')[0]?.classList.contains('refused') ?? null;
    const drag = (node, fam) => {
      const over = panel(fam);
      assert.ok(over, `the ${fam} panel is drawn`);
      dom.doc.elementFromPoint = () => over;
      node.onpointerdown?.({ pointerId: 7, button: 0, pointerType: 'mouse', clientX: 100, clientY: 100 });
      dom.win.fire('pointermove', { pointerId: 7, clientX: 140, clientY: 160 });
      const seen = { label: label(), refused: refused(), lit: over.classList.contains('dragover') };
      dom.win.fire('pointerup', { pointerId: 7, clientX: 140, clientY: 160 });
      return seen;
    };
    const drop = (fam) => {
      dom.doc.querySelectorAll('.packtab')[PAGE_IDS.indexOf(pageOf(piece))].onclick();   // the piece's own page (a shield's is Armor)
      const rows = dom.doc.querySelectorAll('.itemrow');
      assert.equal(rows.length, 1, 'the one pack piece is the one row');
      return drag(rows[0], fam);
    };
    const hand = (slot) => equipTableOf(e)[slot] ?? null;
    return fn({ e, drop, drag, panel, hand });
  });
}
const inPack = (e, it) => e.items.includes(it) && !isEquipped(it);

test('HAND-DROP: the report - a sword dropped on the left hand replaces the dagger there, and the main weapon stays', () => {
  const longsword = weapon(WEAPONS.Longsword), dagger = weapon(WEAPONS.Dagger), shortsword = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword, left: dagger }, shortsword, ({ e, drop, hand }) => {
    let told = 0;
    addEquipChangeListener((who) => { if (who === e) told++; });
    const seen = drop('lhand');
    assert.deepEqual(seen, { label: 'Left hand', refused: false, lit: true });
    assert.equal(hand(R), longsword, 'the main weapon is still in the right hand');
    assert.equal(hand(L), shortsword, 'the sword is in the left hand');
    assert.ok(inPack(e, dagger), 'the dagger went to the pack');
    assert.equal(told, 1, 'one equip act, told once');
  });
});

test('HAND-DROP: an empty hand takes the piece, whichever hand it is', () => {
  const longsword = weapon(WEAPONS.Longsword), shortsword = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword }, shortsword, ({ drop, hand }) => {
    assert.equal(drop('lhand').label, 'Left hand');
    assert.deepEqual([hand(R), hand(L)], [longsword, shortsword], 'left empty: the sword goes left');
  });
  const dagger = weapon(WEAPONS.Dagger), sword2 = weapon(WEAPONS.Shortsword);
  withHands({ left: dagger }, sword2, ({ drop, hand }) => {
    assert.equal(drop('rhand').label, 'Right hand');
    assert.deepEqual([hand(R), hand(L)], [sword2, dagger], 'right empty: the sword goes right, the dagger stays');
  });
});

test('HAND-DROP: a full hand is replaced even when the other is empty - nothing moves across', () => {
  const dagger = weapon(WEAPONS.Dagger), shortsword = weapon(WEAPONS.Shortsword);
  withHands({ left: dagger }, shortsword, ({ e, drop, hand }) => {
    drop('lhand');
    assert.deepEqual([hand(R), hand(L)], [null, shortsword], 'right empty, left dagger: the sword replaces the dagger');
    assert.ok(inPack(e, dagger));
  });
  const longsword = weapon(WEAPONS.Longsword), sword2 = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword }, sword2, ({ e, drop, hand }) => {
    drop('rhand');
    assert.deepEqual([hand(R), hand(L)], [sword2, null], 'left empty: the sword replaces the main weapon, not beside it');
    assert.ok(inPack(e, longsword));
  });
});

test('HAND-DROP: a shield in the left hand - a sword dropped there replaces the shield; dropped right, the main weapon', () => {
  const longsword = weapon(WEAPONS.Longsword), shield = kiteShield(), shortsword = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword, left: shield }, shortsword, ({ e, drop, hand }) => {
    drop('lhand');
    assert.deepEqual([hand(R), hand(L)], [longsword, shortsword]);
    assert.ok(inPack(e, shield), 'the shield went to the pack');
  });
  const longsword2 = weapon(WEAPONS.Longsword), shield2 = kiteShield(), sword2 = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword2, left: shield2 }, sword2, ({ e, drop, hand }) => {
    drop('rhand');
    assert.deepEqual([hand(R), hand(L)], [sword2, shield2]);
    assert.ok(inPack(e, longsword2));
  });
});

test('HAND-DROP: a two-hander held right - a one-hander dropped on the left hand takes it off (EquipItem\'s shield arm), dropped right replaces it', () => {
  const claymore = weapon(WEAPONS.Claymore), shortsword = weapon(WEAPONS.Shortsword);
  withHands({ right: claymore }, shortsword, ({ e, drop, hand }) => {
    assert.equal(drop('lhand').label, 'Left hand');
    assert.deepEqual([hand(R), hand(L)], [null, shortsword], 'never a two-hander beside a sword');
    assert.ok(inPack(e, claymore));
  });
  const claymore2 = weapon(WEAPONS.Claymore), sword2 = weapon(WEAPONS.Shortsword);
  withHands({ right: claymore2 }, sword2, ({ e, drop, hand }) => {
    drop('rhand');
    assert.deepEqual([hand(R), hand(L)], [sword2, null]);
    assert.ok(inPack(e, claymore2));
  });
  const claymore3 = weapon(WEAPONS.Claymore), shield = kiteShield();
  withHands({ right: claymore3 }, shield, ({ e, drop, hand }) => {
    assert.equal(drop('lhand').label, 'Left hand');
    assert.deepEqual([hand(R), hand(L)], [null, shield], 'a shield takes the two-hander off, as DFU\'s EquipItem does');
    assert.ok(inPack(e, claymore3));
  });
});

test('HAND-DROP: a piece the hand cannot hold is refused there - no label, no lit panel, nothing moves', () => {
  const longsword = weapon(WEAPONS.Longsword), dagger = weapon(WEAPONS.Dagger), claymore = weapon(WEAPONS.Claymore);
  withHands({ right: longsword, left: dagger }, claymore, ({ e, drop, hand }) => {
    assert.deepEqual(drop('lhand'), { label: '', refused: true, lit: false }, 'a two-hander on the left hand');
    assert.deepEqual([hand(R), hand(L)], [longsword, dagger]);
    assert.ok(inPack(e, claymore));
  });
  const longsword2 = weapon(WEAPONS.Longsword), dagger2 = weapon(WEAPONS.Dagger), claymore2 = weapon(WEAPONS.Claymore);
  withHands({ right: longsword2, left: dagger2 }, claymore2, ({ drop, hand }) => {
    assert.deepEqual(drop('rhand'), { label: 'Right hand', refused: false, lit: true }, 'and on the right hand it goes');
    assert.deepEqual([hand(R), hand(L)], [claymore2, null], 'both hands cleared for it');
  });
  const longsword3 = weapon(WEAPONS.Longsword), dagger3 = weapon(WEAPONS.Dagger), shield = kiteShield();
  withHands({ right: longsword3, left: dagger3 }, shield, ({ e, drop, hand }) => {
    assert.deepEqual(drop('rhand'), { label: '', refused: true, lit: false }, 'a shield on the right hand');
    assert.deepEqual([hand(R), hand(L)], [longsword3, dagger3]);
    assert.ok(inPack(e, shield));
  });
  const longsword4 = weapon(WEAPONS.Longsword), dagger4 = weapon(WEAPONS.Dagger), shield2 = kiteShield();
  withHands({ right: longsword4, left: dagger4 }, shield2, ({ drop, hand }) => {
    assert.equal(drop('lhand').label, 'Left hand');
    assert.deepEqual([hand(R), hand(L)], [longsword4, shield2]);
  });
});

test('HAND-DROP: a held piece dragged to the other hand still trades places (SWAP-HANDS), and is refused where either piece cannot cross', () => {
  const longsword = weapon(WEAPONS.Longsword), dagger = weapon(WEAPONS.Dagger), spare = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword, left: dagger }, spare, ({ e, drag, panel, hand }) => {
    assert.equal(drag(panel('rhand'), 'lhand').label, 'Left hand');
    assert.deepEqual([hand(R), hand(L)], [dagger, longsword]);
    assert.ok(inPack(e, spare), 'the pack piece was not touched');
  });
  const claymore = weapon(WEAPONS.Claymore), spare2 = weapon(WEAPONS.Shortsword);
  withHands({ right: claymore }, spare2, ({ drag, panel, hand }) => {
    assert.deepEqual(drag(panel('rhand'), 'lhand'), { label: '', refused: true, lit: false }, 'a two-hander never the left');
    assert.deepEqual([hand(R), hand(L)], [claymore, null]);
  });
  const longsword2 = weapon(WEAPONS.Longsword), shield = kiteShield(), spare3 = weapon(WEAPONS.Shortsword);
  withHands({ right: longsword2, left: shield }, spare3, ({ drag, panel, hand }) => {
    assert.equal(drag(panel('rhand'), 'lhand').refused, true, 'a shield never the right, so the trade is refused');
    assert.deepEqual([hand(R), hand(L)], [longsword2, shield]);
  });
});

test('HAND-DROP: equipItem\'s hand - the hand law refuses, and only that hand\'s piece comes off', () => {
  const e = hero();
  const longsword = weapon(WEAPONS.Longsword), dagger = weapon(WEAPONS.Dagger);
  dress(e, { right: longsword, left: dagger });
  const claymore = weapon(WEAPONS.Claymore), shield = kiteShield(), shortsword = weapon(WEAPONS.Shortsword);
  e.items.push(claymore, shield, shortsword);
  assert.equal(equipItem(e, claymore, L), null, 'a two-hander never the left hand');
  assert.equal(equipItem(e, shield, R), null, 'a shield never the right hand');
  assert.deepEqual([equipTableOf(e)[R], equipTableOf(e)[L]], [longsword, dagger], 'a refusal moves nothing');
  assert.deepEqual(equipItem(e, shortsword, L), [dagger], 'the left hand\'s piece alone comes off');
  assert.deepEqual([equipTableOf(e)[R], equipTableOf(e)[L]], [longsword, shortsword]);
  assert.deepEqual([[shortsword, L], [shortsword, R], [claymore, L], [claymore, R], [shield, L], [shield, R], [shortsword, EQUIP_SLOTS.Head]]
    .map(([it, h]) => mayHold(it, h)), [true, true, false, true, true, false, false], 'the hand law, one home');
});
