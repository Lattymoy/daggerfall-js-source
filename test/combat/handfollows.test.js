// FIELD BUGS 2026-10-29f HAND-FOLLOWS (#feature-feedback, "long sword bugged": "long sword, broad sword, saber don't
// mastering long blade"). Every Long Blade arm reads the template, and all six long blades train alike. What differs is
// the hand: a one-hander can stand alone in the LEFT hand (a second weapon's free hand, SWAP-HANDS, the hand panel's
// drop), and DFU's used hand stays right - so on the classic lane the swing was fists and trained Hand-to-Hand. The
// two-handers (Claymore, Dai-katana) never leave the right hand, which is why they trained. Now, when what the hands hold
// changes, an empty hand in use gives way to a lone weapon in the other; H still picks the bare hand after, and a hand
// a save restored is kept.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { equipItem, swapHands, unequipSlot, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { PlayerWeapon, applyWeaponPose, weaponPoseOf } from '../../src/combat/playerWeapon.js';
import { fpArm } from '../../src/combat/fpArm.js';
import { tallySwingSkills } from '../../src/scenes/hostCombat.js';
import { SKILLS } from '../../src/systems/skills.js';

const W = { Dagger: 113, Broadsword: 118, Saber: 119, Longsword: 120, Katana: 121, Claymore: 122 };
const player = (items) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: { speed: 50 }, items,
  skills: new Array(35).fill(30), skillUses: new Array(35).fill(0) });
function classic(fn) {
  const saved = fpArm.ready;
  fpArm.ready = () => false;
  try { return fn(); } finally { fpArm.ready = saved; }
}
const rigOf = (entity) => createWeaponRig({ renderer: null, canvas: null, entity, audio: { playOneShot() {} }, say() {} });

test('HAND-FOLLOWS the report, on the classic lane: a one-handed long blade moved alone to the left hand (SWAP-HANDS) is the weapon swung, and its swing trains Long Blade - never Hand-to-Hand - for the Broadsword, the Saber, the Longsword and the Katana alike (mutants: HANDFOLLOWS-never, HANDFOLLOWS-every-frame-unchanged)', () => {
  classic(() => {
    for (const t of [W.Broadsword, W.Saber, W.Longsword, W.Katana]) {
      const blade = createWeapon(t, 0, () => 0.5);
      const e = player([blade]);
      equipItem(e, blade);
      const rig = rigOf(e);
      rig.refreshWorn();
      assert.equal(rig.playerWeapon.weapon, blade, `${t}: the right hand's`);
      assert.equal(swapHands(e).ok, true);
      assert.equal(e.equip.slots[EQUIP_SLOTS.LeftHand], blade);
      rig.refreshWorn();
      assert.equal(rig.playerWeapon.weapon, blade, `${t}: alone in the left hand, still the weapon swung`);
      tallySwingSkills(e, rig.playerWeapon.weapon, rig.playerWeapon.blowWeight);
      assert.deepEqual([e.skillUses[SKILLS.LongBlade], e.skillUses[SKILLS.HandToHand]], [1, 0], `${t}: Long Blade trained`);
    }
  });
});

test('HAND-FOLLOWS a second weapon\'s free hand: a dagger in the right and a longsword in the left, the dagger taken off - the longsword is swung; the two-hander never left the right hand at all', () => {
  classic(() => {
    const dagger = createWeapon(W.Dagger, 0, () => 0.5);
    const sword = createWeapon(W.Longsword, 0, () => 0.5);
    const e = player([dagger, sword]);
    equipItem(e, dagger);
    equipItem(e, sword);
    assert.equal(e.equip.slots[EQUIP_SLOTS.LeftHand], sword, 'GetFirstSlot: the second one-hander in the free left hand');
    const rig = rigOf(e);
    rig.refreshWorn();
    assert.equal(rig.playerWeapon.weapon, dagger, 'two weapons: the lead stays the player\'s');
    unequipSlot(e, EQUIP_SLOTS.RightHand);
    rig.refreshWorn();
    assert.equal(rig.playerWeapon.weapon, sword);
    const big = createWeapon(W.Claymore, 0, () => 0.5);
    const b = player([big]);
    equipItem(b, big);
    assert.equal(swapHands(b).ok, false, 'a two-hander stays right');
  });
});

test('HAND-FOLLOWS H is still the player\'s: after the hand followed, H picks the bare hand and it is kept while the hands hold the same; a pose a save restored is kept through the next UpdateHands (mutants: HANDFOLLOWS-restore-ignored, HANDFOLLOWS-restore-kept-forever)', () => {
  classic(() => {
    const sword = createWeapon(W.Saber, 0, () => 0.5);
    const e = player([sword]);
    equipItem(e, sword);
    swapHands(e);
    const rig = rigOf(e);
    rig.refreshWorn();
    assert.equal(rig.playerWeapon.weapon, sword);
    assert.equal(rig.switchHand(), true);
    rig.refreshWorn();
    rig.refreshWorn();
    assert.equal(rig.playerWeapon.weapon, null, 'fists, by H');
  });
  const sword = createWeapon(W.Longsword, 0, () => 0.5);
  const w = new PlayerWeapon({});
  applyWeaponPose(w, { weaponDrawn: true, usingRightHand: true, handKept: true });   // PIN MOVED (AUDIT FB1029f D4): a pose saved under HAND-FOLLOWS says so
  w.updateHands(null, sword);
  assert.equal(w.usingRightHand, true, 'the restored hand, kept as the save had it');
  const other = createWeapon(W.Broadsword, 0, () => 0.5);
  w.updateHands(null, other);
  assert.equal(w.usingRightHand, false, 'and the next change of the hands follows again');
  // AUDIT FB1029f D4: a pose from before HAND-FOLLOWS - the report's own save, its lone weapon in the left - follows once
  const old = new PlayerWeapon({});
  applyWeaponPose(old, { weaponDrawn: true, usingRightHand: true });
  old.updateHands(null, sword);
  assert.equal(old.usingRightHand, false, 'an old save\'s lone left-hand weapon is swung');
  assert.deepEqual(weaponPoseOf(old), { weaponDrawn: true, usingRightHand: false, handKept: true }, 'and the next save says it was chosen so');
});
