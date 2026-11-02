// AUDIT FB1029f D1, D2 (FIELD BUGS 2026-10-29f HAND-FOLLOWS): THE SWAP SETS THE HAND, NEVER TOGGLES IT. HAND-FOLLOWS moves
// the hand in use to a lone weapon when the hands change, and the swap key's LH1 step then toggled it - back to the
// empty hand: a Longsword readied over fists, training Hand-to-Hand, the very report through another door. And the
// swap's bare-hands arm let the hand follow the off hand's weapon, so "bare hands" readied the dagger. Run on the real
// rig (combat/weapon/weaponRig.js createWeaponRig's hand door), the real equip table and the real quickslots.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { equipItem, swapHands, isEquipped, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { fpArm } from '../../src/combat/fpArm.js';
import { swapQuickslot, assignQuickslot, clearQuickslots } from '../../src/systems/quickslots.js';
import { tallySwingSkills } from '../../src/scenes/hostCombat.js';
import { SKILLS } from '../../src/systems/skills.js';

const player = (items) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: { speed: 50 }, items, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0) });
const rigOf = (entity) => createWeaponRig({ renderer: null, canvas: null, entity, audio: { playOneShot() {} }, say() {} });
const press = (e, rig) => { swapQuickslot({ entity: e, say: () => {}, hand: rig.handDoor() }); rig.refreshWorn(); };
let ready;
beforeEach(() => { ready = fpArm.ready; fpArm.ready = () => false; clearQuickslots(); });
test.afterEach(() => { fpArm.ready = ready; });

test('AUDIT FB1029f D1: a weapon readied by the swap from a lone left-hand weapon is the one swung - a one-hander and a two-hander alike - and it trains its own skill, never Hand-to-Hand (mutant: AUDITFB1029F-D1-toggled)', () => {
  for (const id of [120, 125]) {   // a Longsword, a Claymore
    const e = player([createWeapon(id, 0, () => 0.5), createWeapon(119, 0, () => 0.5)]);
    const [sword, saber] = e.items;
    equipItem(e, saber); swapHands(e);   // a Saber alone in the left hand: HAND-FOLLOWS swings it
    const rig = rigOf(e);
    rig.refreshWorn();
    assert.equal(rig.playerWeapon.weapon, saber);
    assignQuickslot('swap', sword);
    press(e, rig);
    assert.equal(rig.playerWeapon.weapon, sword, `${sword.name}: in hand and swung`);
    tallySwingSkills(e, rig.playerWeapon.weapon, rig.playerWeapon.blowWeight);
    assert.equal(e.skillUses[SKILLS.HandToHand], 0, `${sword.name}: no fists`);
  }
});

test('AUDIT FB1029f D2: the swap\'s bare hands are bare hands - a sword and fists in turn, the dagger in the off hand never readied nor put away (mutant: AUDITFB1029F-D2-bare-follows)', () => {
  const e = player([createWeapon(120, 0, () => 0.5), createWeapon(113, 0, () => 0.5)]);
  const [sword, dagger] = e.items;
  equipItem(e, dagger); swapHands(e);
  const rig = rigOf(e);
  rig.refreshWorn();
  if (!rig.playerWeapon.usingRightHand) { rig.switchHand(); rig.refreshWorn(); }   // the bare right hand in use
  assignQuickslot('swap', sword);
  const seen = [];
  for (let i = 0; i < 4; i++) { press(e, rig); seen.push(rig.playerWeapon.weapon === sword ? 'sword' : rig.playerWeapon.weapon == null ? 'fists' : 'other'); }
  assert.deepEqual(seen, ['sword', 'fists', 'sword', 'fists']);
  assert.equal(isEquipped(dagger), true, 'the dagger stays');
  assert.equal(e.equip.slots[EQUIP_SLOTS.LeftHand], dagger);
});
