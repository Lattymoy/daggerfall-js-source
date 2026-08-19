// S10: the verbatim cost formulas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectCost, calculateCastCost, CAST_COST_FLOOR, TARGET_COST_MULT } from '../src/systems/spellcost.js';

const caster = (skills) => ({ isPlayer: true, skills });

test('spellcost: component math, averaged magnitude, skill scaling per effect', () => {
  // DamageHealth mag (20,28): base avg (5+15)/2=10, plus avg (2+4)/2=3, per 2
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 15, magnitudeLevelBase: 2, magnitudeLevelHigh: 4, magnitudePerLevel: 2 };
  const skills = new Array(35).fill(0); skills[22] = 30;   // Destruction 30
  const c = effectCost(dmg, (id) => skills[id]);
  assert.equal(c.gold, 20 * 10 + 28 * Math.trunc(3 / 2));  // 228
  assert.equal(c.sp, Math.trunc(228 * (110 - 30) / 400));  // 45
  // Slowfall duration (20,100): base 3, mod 1, per 1 -> 20*3 + 100*1 = 160
  const slow = { type: 25, subType: 255, durationBase: 3, durationMod: 1, durationPerLevel: 1 };
  skills[25] = 70;                                          // Alteration 70
  const s = effectCost(slow, (id) => skills[id]);
  assert.equal(s.gold, 160);
  assert.equal(s.sp, Math.trunc(160 * 40 / 400));           // 16
  // AUDIT 18: a classic key with NO effect class in DFU is dropped
  // from the bundle by ClassicEffectRecordToEffectEntry and costs
  // nothing; the zero-component fudge is for CLASSES without
  // components (Teleport 43,255 / MorphSelf 29,255), which keep
  // their own magic skill - Mysticism and Illusion, never Destruction
  const unk = { type: 99, subType: 99 };
  assert.equal(effectCost(unk, () => 50).gold, 0);
  const tele = { type: 43, subType: -1 };
  const skillsSeen = [];
  assert.equal(effectCost(tele, (id) => { skillsSeen.push(id); return 50; }).gold, 320);   // 160+60*1+100*1
  assert.deepEqual(skillsSeen, [27]);                       // Mysticism, not the old 22 default
  // Parity fix 2026-08-16d: real records read subType 0xFF as -1 -
  // the table lookup normalizes to the BYTE key (a real Slowfall
  // record must hit '25,255', not the fudge)
  const slowReal = { ...slow, subType: -1 };
  assert.equal(effectCost(slowReal, (id) => skills[id]).gold, 160);
  // S19 Paralyze (0,255): duration (28,100) + chance (28,100) on
  // Spider Touch's real record - 28*1+100*1 + 28*5+100*15 = 1768
  const par = { type: 0, subType: -1, durationBase: 1, durationMod: 1, durationPerLevel: 1, chanceBase: 5, chanceMod: 15, chancePerLevel: 1 };
  assert.equal(effectCost(par, (id) => skills[id]).gold, 128 + 1640);
  // S19c cures (Restoration): Cure Disease/Poison chance (8,100),
  // Cure Paralyzation (20,140)
  const cureD = { type: 3, subType: 0, chanceBase: 5, chanceMod: 10, chancePerLevel: 2 };
  assert.equal(effectCost(cureD, () => 50).gold, 8 * 5 + 100 * 5);
  const cureP = { type: 3, subType: 2, chanceBase: 5, chanceMod: 10, chancePerLevel: 2 };
  assert.equal(effectCost(cureP, () => 50).gold, 20 * 5 + 140 * 5);
});

test('spellcost: target multipliers on the sums + the floor 5', () => {
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 15, magnitudeLevelBase: 2, magnitudeLevelHigh: 4, magnitudePerLevel: 2 };
  const skills = new Array(35).fill(0); skills[22] = 30;
  const e = caster(skills);
  const single = calculateCastCost({ rangeType: 2, effects: [dmg] }, e);
  assert.equal(single.sp, Math.trunc(45 * 1.5));            // 67
  assert.equal(single.gold, Math.trunc(228 * 1.5));         // 342
  const area = calculateCastCost({ rangeType: 4, effects: [dmg] }, e);
  assert.equal(area.sp, Math.trunc(45 * 2.5));              // 112
  assert.deepEqual(TARGET_COST_MULT[3], 2.0);
  // a master (skill 100) on a cheap spell hits the floor
  skills[22] = 100;
  const cheap = { type: 4, subType: 0, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  const f = calculateCastCost({ rangeType: 0, effects: [cheap] }, e);
  assert.equal(f.sp, CAST_COST_FLOOR);                      // 20*(110-100)/400 = 0 -> 5
});
