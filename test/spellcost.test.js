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
  // unknown family: the zero-component fudge (60,100,160) -> 160+60+100=320
  const unk = { type: 99, subType: 99 };
  assert.equal(effectCost(unk, () => 50).gold, 320);
  // Parity fix 2026-08-16d: real records read subType 0xFF as -1 -
  // the table lookup normalizes to the BYTE key (a real Slowfall
  // record must hit '25,255', not the fudge)
  const slowReal = { ...slow, subType: -1 };
  assert.equal(effectCost(slowReal, (id) => skills[id]).gold, 160);
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
