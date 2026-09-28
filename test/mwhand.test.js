// MW-HAND (2026-09-26, Mac: "Weapons when swapped into left hand dont work showing fists - id say remove the ability
// when in morrowind since its not visible"; asked, "Never on an empty hand"): the Morrowind arm draws one weapon and no
// second hand, so a weapon in the hand not in use was a weapon that would not show, over fists. In that lane the hand
// in use follows the weapons, and H moves only between two held weapons. The classic lane keeps DFU's ToggleHand whole
// - an empty left hand is still how a classic player fights with fists.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { fpArm } from '../src/combat/fpArm.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';

const SWORD = { name: 'Longsword', templateIndex: 120, material: 0 };
const DAGGER = { name: 'Dagger', templateIndex: 113, material: 0 };
const KITE = { name: 'Kite Shield', templateIndex: 111, material: 0 };

test('MW-HAND: an empty hand in use gives way to the other when it holds a weapon - and to nothing else', () => {
  const w = new PlayerWeapon();
  w.updateHands(null, DAGGER);
  assert.equal(w.followHeldHand(), true);
  assert.equal(w.usingRightHand, false, 'the dagger\'s hand');
  assert.equal(w.applyWeapon(), DAGGER, 'the weapon, never fists');
  w.updateHands(SWORD, null);
  assert.equal(w.followHeldHand(), true);
  assert.equal(w.usingRightHand, true, 'back to the sword\'s');
  w.updateHands(SWORD, DAGGER);
  w.usingRightHand = false;
  assert.equal(w.followHeldHand(), false, 'two weapons: the hand is the player\'s choice');
  assert.equal(w.usingRightHand, false);
  w.updateHands(null, null);
  assert.equal(w.followHeldHand(), false, 'bare hands stay bare');
  w.updateHands(null, KITE);
  assert.equal(w.followHeldHand(), false, 'a shield is no weapon (UpdateHands forces the right hand)');
  assert.equal(w.usingRightHand, true);
});

function withArm(ready, fn) {
  const saved = { ready: fpArm.ready };
  fpArm.ready = () => ready;
  try { return fn(); } finally { Object.assign(fpArm, saved); }
}
const rigFor = (right, left) => {
  const entity = { items: [], stats: { speed: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: right, [EQUIP_SLOTS.LeftHand]: left } } };
  const said = [];
  const r = createWeaponRig({ renderer: null, canvas: null, entity, audio: { playOneShot() {} }, say: (t) => said.push(t) });
  return { r, entity, said };
};

test('MW-HAND: under the Morrowind arm the hand follows the weapons - a dagger equipped in the left hand is the weapon, not fists', () => {
  withArm(true, () => {
    const { r, entity } = rigFor(null, DAGGER);
    r.refreshWorn();
    assert.equal(r.playerWeapon.usingRightHand, false);
    assert.equal(r.playerWeapon.weapon, DAGGER);
    // a sword arrives in the right: two weapons, the hand stays where it is until the player moves it
    entity.equip.slots[EQUIP_SLOTS.RightHand] = SWORD;
    r.refreshWorn();
    assert.equal(r.playerWeapon.weapon, DAGGER);
    // the dagger goes: the hand follows the sword
    entity.equip.slots[EQUIP_SLOTS.LeftHand] = null;
    r.refreshWorn();
    assert.equal(r.playerWeapon.usingRightHand, true);
    assert.equal(r.playerWeapon.weapon, SWORD);
  });
});

test('MW-HAND: under the Morrowind arm H moves only between two held weapons', () => {
  withArm(true, () => {
    const one = rigFor(SWORD, null);
    assert.equal(one.r.switchHand(), false, 'nothing in the other hand to move to');
    assert.equal(one.r.playerWeapon.weapon, SWORD, 'never fists');
    assert.deepEqual(one.said, [], 'refused without a line, as the shield\'s refusal is');
    const two = rigFor(SWORD, DAGGER);
    assert.equal(two.r.switchHand(), true);
    assert.equal(two.r.playerWeapon.weapon, DAGGER);
    assert.equal(two.r.switchHand(), true);
    assert.equal(two.r.playerWeapon.weapon, SWORD);
    const shield = rigFor(SWORD, KITE);
    assert.equal(shield.r.switchHand(), false, 'the shield refuses, as in DFU');
  });
});

test('MW-HAND: the classic lane keeps DFU\'s ToggleHand whole - H to an empty left hand is fists', () => {
  withArm(false, () => {
    const { r, said } = rigFor(SWORD, null);
    assert.equal(r.switchHand(), true);
    assert.equal(r.playerWeapon.usingRightHand, false);
    assert.equal(r.playerWeapon.weapon, null, 'fists');
    assert.equal(said.length, 1, 'with its line');
    const left = rigFor(null, DAGGER);
    left.r.refreshWorn();
    assert.equal(left.r.playerWeapon.usingRightHand, true, 'the hand does not follow');
    assert.equal(left.r.playerWeapon.weapon, null);
  });
});
