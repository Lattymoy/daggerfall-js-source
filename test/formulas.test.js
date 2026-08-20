// C8 E3b: the FormulaHelper core, deterministic rolls, source-pinned.
import { WEAPONS } from '../src/characters/weapons.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dice100, damageModifier, handToHandMinDamage, handToHandMaxDamage,
  WEAPON_MIN_DAMAGE, WEAPON_MAX_DAMAGE, WEAPON_MATERIAL_MODIFIER,
  calculateStruckBodyPart, careerAttackModifier, ENEMY_GROUPS,
  bonusOrPenaltyByEnemyType, statsToHit, skillsToHit,
  calculateSuccessfulHit, adjustmentsToHit, handToHandAttackDamage, weaponAttackDamage,
  backstabDamage, calculateAttackDamage, meleeHitConnects, SKELETAL_WARRIOR_INDEX,
} from '../src/combat/formulas.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('formulas: primitives verbatim', () => {
  assert.equal(dice100(50, 0.49), true);            // Range(0,100)=49 < 50
  assert.equal(dice100(50, 0.50), false);           // 50 < 50 fails
  assert.equal(damageModifier(50), 0);
  assert.equal(damageModifier(75), 5);
  assert.equal(damageModifier(40), -2);             // floor((-10)/5)
  assert.equal(handToHandMinDamage(35), 4);         // 35/10+1
  assert.equal(handToHandMaxDamage(35), 8);         // 35/5+1 (sheet rule)
  assert.equal(WEAPON_MIN_DAMAGE['Dai-Katana'], 3);
  assert.equal(WEAPON_MAX_DAMAGE['Dai-Katana'], 21);
  assert.equal(WEAPON_MIN_DAMAGE['Long Bow'], 4);
  assert.equal(WEAPON_MAX_DAMAGE.Dagger, 6);
  assert.deepEqual(WEAPON_MATERIAL_MODIFIER, [-1, 0, 0, 1, 2, 3, 3, 4, 5, 6]);
  assert.equal(calculateStruckBodyPart(0), 0);
  assert.equal(calculateStruckBodyPart(0.999), 6);  // last slot (head)
});

test('formulas: career attack-modifier bits + enemy-type bonus', () => {
  assert.equal(careerAttackModifier(0x01, ENEMY_GROUPS.Undead), 1);
  assert.equal(careerAttackModifier(0x10, ENEMY_GROUPS.Undead), -1);
  assert.equal(careerAttackModifier(0x40, ENEMY_GROUPS.Humanoid), -1);
  assert.equal(careerAttackModifier(0x08, ENEMY_GROUPS.Animals), 1);
  assert.equal(careerAttackModifier(0, ENEMY_GROUPS.Daedra), 0);
  const atk = { level: 7, attackModifierFlags: 0x04 };
  // AUDIT 18: the second argument is the TARGET ENTITY - DFU derives
  // the group inside GetBonusOrPenaltyByEnemyType, from the affinity
  // for the Humanoid arm and from GetEnemyGroup() for the other three.
  assert.equal(bonusOrPenaltyByEnemyType(atk, { isPlayer: false, careerIndex: 0, affinity: 'Human' }), 7);
  assert.equal(bonusOrPenaltyByEnemyType(atk, null), 0);
});

test('formulas: to-hit chain (dodging/4 bug, the -50/+40 adjustments, clamp 3..97)', () => {
  const A = { skills: 40, stats: { strength: 50, agility: 60, luck: 50 } };
  const T = { skills: 40, stats: { strength: 50, agility: 50, luck: 50 }, armor: 0 };
  assert.equal(statsToHit(A, T), 1);                // (60-50)/10
  assert.equal(skillsToHit(A, T, 0.99), -10);       // -40/4, crit roll fails
  assert.equal(skillsToHit(A, T, 0.0), -10 + 4);    // crit passes: +40/10
  // adjustmentsToHit (F1): flat -50 always; +40 only vs enemy MONSTERS
  assert.equal(adjustmentsToHit(T), -50);                                   // player-shaped/stub target
  assert.equal(adjustmentsToHit({ isPlayer: false, isClass: false }), -10); // monster: +40 - 50
  assert.equal(adjustmentsToHit({ isPlayer: false, isClass: true }), -50);  // class enemy: no +40
  // MEASURED: chance = 40 + 0 + 1 + (-10) [crit 0.99 fails] - 50 = -19 -> clamp 3
  assert.equal(calculateSuccessfulHit(A, T, 40, 0, seq(0.99, 0.02)), true);
  assert.equal(calculateSuccessfulHit(A, T, 40, 0, seq(0.99, 0.03)), false);
  // MEASURED vs a monster: 40 + 0 + 1 - 10 + (40 - 50) = 21
  const M = { ...T, isPlayer: false, isClass: false };
  assert.equal(calculateSuccessfulHit(A, M, 40, 0, seq(0.99, 0.20)), true);
  assert.equal(calculateSuccessfulHit(A, M, 40, 0, seq(0.99, 0.21)), false);
  // clamp ceiling 97: 40 + 200 armor-ish -> only a 0.97+ roll misses
  const T3 = { ...T, armor: 200 };
  assert.equal(calculateSuccessfulHit(A, T3, 40, 0, seq(0.99, 0.96)), true);
  assert.equal(calculateSuccessfulHit(A, T3, 40, 0, seq(0.99, 0.97)), false);
});

test('formulas: damage paths verbatim', () => {
  const A = { level: 1, skills: 35, stats: { strength: 75, agility: 50, luck: 50 }, attackModifierFlags: null, isPlayer: true };
  // H2H: min 4 max 8; roll 0 -> 4; +str mod 5 (player only)
  assert.equal(handToHandAttackDamage(A, null, 0, true, seq(0)), 9);
  assert.equal(handToHandAttackDamage(A, null, 0, false, seq(0)), 4);
  // weapon: dagger 1-6 roll max (0.999 -> 6), +str 5, +Daedric 6
  // AUDIT 18 F1: real items carry a template, not baked damage. AUDIT
  // 18: and flags 0, because SetItem gives every generated item flags 0.
  const dagger = { templateIndex: WEAPONS.Dagger, material: 9, flags: 0 };
  const foe = { isPlayer: false, careerIndex: 3, affinity: 'Animal' };
  assert.equal(weaponAttackDamage(A, foe, 0, dagger, seq(0.999)), 17);
  // skeletal warrior: the halving is on (flags & 0x10) == 0, which no
  // generated weapon fails - it halves BEFORE str/material; silver doubles
  const mace = { templateIndex: WEAPONS.Mace, material: 2, flags: 0 };
  const skel = { isPlayer: false, careerIndex: SKELETAL_WARRIOR_INDEX, affinity: 'Undead' };
  // roll max: 12 -> /2 = 6 -> *2 (silver) = 12 -> +5 str +0 silver = 17
  assert.equal(weaponAttackDamage(A, skel, 0, mace, seq(0.999)), 17);
  assert.equal(backstabDamage(10, 50, () => 0.4), 30);
  assert.equal(backstabDamage(10, 50, () => 0.6), 10);
  assert.equal(backstabDamage(10, 1, () => 0.0), 10);     // needs > 1
  // material gate: iron weapon vs Silver-required target -> 0
  const ghost = { minMetalToHit: 2, skills: 35, stats: { strength: 50, agility: 50, luck: 50 }, armor: 0 };
  assert.equal(calculateAttackDamage(A, ghost, { weapon: { templateIndex: WEAPONS.Dagger, material: 0, flags: 0 } }), 0);
});

test('formulas: monster multi-attack loop (F2) - basics spans, reflex gate, per-hit type bonus', () => {
  // A monster attacker with three damage spans; flat skills 40.
  const M = {
    isPlayer: false, isClass: false, level: 2, skills: 40,
    stats: { strength: 50, agility: 50, luck: 50 },
    attackModifierFlags: 0x04,   // Humanoid bonus bit -> +level per LANDED hit
    basics: { minDamage: 2, maxDamage: 2, minDamage2: 3, maxDamage2: 3, minDamage3: 0, maxDamage3: 0 },
  };
  const P = { isPlayer: true, reflexes: 2, armor: 0, skills: 0, stats: { strength: 50, agility: 50, luck: 50 } };
  // reflexesChance at average reflexes = 50 - 10*(2-2) = 50.
  // dfRand yields 0 (0 % 100 < 50 passes) for every attack.
  // rolls per attack: [crit .99 fail, hitRoll, damageRoll] after the
  // one struck roll up front. Hit chance MEASURED: 40 - 50 = -10 -> clamp 3.
  // Attack 1 hits (.02): 2 damage + humanoid bonus 2 (level). Attack 2
  // misses (.03). Attack 3 min 0: gate skips it entirely.
  const d = calculateAttackDamage(M, P, {
    dfRand: () => 0,
    rolls: seq(0, 0.99, 0.02, 0, 0.99, 0.03, 0.5),
  });
  assert.equal(d, 4);   // (2 + 2) + 0 + 0
  // The reflex gate: dfRand >= reflexesChance blocks every attack outright
  const blocked = calculateAttackDamage(M, P, {
    dfRand: () => 50,
    rolls: seq(0, 0.99, 0.02, 0),
  });
  assert.equal(blocked, 0);
  // A class enemy (isClass true) stays on the H2H skill path: skills 40
  // -> min 5 max 9; chance 40 - 50 -> clamp 3, roll .02 hits, damage
  // roll 0 -> 5 + humanoid bonus 2 = 7 (no reflex gate consulted)
  const C = { ...M, isClass: true, basics: undefined };
  const c = calculateAttackDamage(C, P, {
    dfRand: () => { throw new Error('class enemies never roll the reflex gate'); },
    rolls: seq(0, 0.99, 0.02, 0),
  });
  assert.equal(c, 7);
});

test('formulas: the classic melee hit gate', () => {
  assert.equal(meleeHitConnects(0.2, true, false), true);    // point blank ignores yaw
  assert.equal(meleeHitConnects(2.0, true, true), true);
  assert.equal(meleeHitConnects(2.0, true, false), false);
  assert.equal(meleeHitConnects(2.0, false, true), false);   // must be in sight
  assert.equal(meleeHitConnects(2.5, true, true), false);    // past MeleeDistance
});
