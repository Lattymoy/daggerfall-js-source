import '../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { strikingWeaponOf, computeCombatStats } from '../../src/combat/combatStats.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
for (const leftEmpty of [false, true]) test(`Stats agrees with the selected left hand, empty=${leftEmpty}`, () => {
  const right = { group: 'Weapons', templateIndex: 120 };
  const left = leftEmpty ? null : { group: 'Weapons', templateIndex: 121 };
  const slots = [];
  slots[EQUIP_SLOTS.RightHand] = right;
  slots[EQUIP_SLOTS.LeftHand] = left;
  const live = Object.create(PlayerWeapon.prototype);
  live.usingRightHand = false;
  live.currentRightHandWeapon = right;
  live.currentLeftHandWeapon = left;
  live.applyWeapon();
  assert.equal(strikingWeaponOf({ equip: { slots } }, false), live.strikingWeapon);
});


for (const usingRightHand of [true, false]) test(`Stats computes the selected hand at skill 200, right=${usingRightHand}`, () => {
  const slots = [];
  slots[EQUIP_SLOTS.RightHand] = { group: 'Weapons', templateIndex: 120, material: 1, flags: 0 };
  slots[EQUIP_SLOTS.LeftHand] = { group: 'Weapons', templateIndex: 113, material: 1, flags: 0 };
  const entity = { isPlayer: true, level: 30, skills: new Array(40).fill(200), stats: Object.fromEntries(['strength','intelligence','willpower','agility','endurance','personality','speed','luck'].map(k => [k,100])), equip: { slots }, health: 100, maxHealth: 100, items: [], activeEffects: [] };
  const weapon = slots[usingRightHand ? EQUIP_SLOTS.RightHand : EQUIP_SLOTS.LeftHand];
  assert.deepEqual(computeCombatStats(entity, { usingRightHand, core: 'classic' }), computeCombatStats(entity, { weapon, core: 'classic' }));
});
