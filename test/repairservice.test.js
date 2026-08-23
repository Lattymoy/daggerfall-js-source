// R1: THE REPAIR SERVICE - FormulaHelper.CalculateItemRepairCost/
// Time (:1901-1933), ItemRepairData's state machine, and the trade
// window's Repair-mode scheduler (UpdateRepairTimes :514-568) with
// its two quirks: the longest job's queue stretch and the
// never-decrease clamp.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemRepairCost, calculateItemRepairTime, updateRepairTimes,
  isBeingRepaired, isBeingRepairedAt, isRepairFinished, leaveForRepair,
  collectRepaired, repairJobsAt, repairRefusal, repairStatusLabel, daysUntil,
} from '../src/systems/repairService.js';
import { reducedRepairCost } from '../src/systems/guildServices.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const item = (condition, max = 1000, over = {}) => ({
  name: 'Test Item', templateIndex: 102, currentCondition: condition, maxCondition: max, value: 300, ...over,
});

test('R1 repair cost: 10% of value through CalculateCost; free at full condition; the FG rank discount (:1901-1922)', () => {
  // value 300 -> base 30 -> CalculateCost(30, quality 10, adj 1000):
  // regional x1, quality term zero, doubled = 60
  assert.equal(calculateItemRepairCost(300, 10, 500, 1000), 60);
  assert.equal(calculateItemRepairCost(300, 10, 1000, 1000), 0, 'condition == max is free (:1908)');
  // NOTE the damage level does NOT scale the price - half-broken and
  // nearly-whole cost the same (:1911 reads value alone)
  assert.equal(calculateItemRepairCost(300, 10, 1, 1000), 60);
  // the 1-gold floor before CalculateCost (:1913)
  assert.equal(calculateItemRepairCost(5, 10, 0, 100), 2, 'trunc(50/100)=0 floors to 1, doubled');
  // FightersGuild.ReducedRepairCost: classic <<8 fixed point - rank 2
  // is trunc(2048/10)=204, *60 >> 8 = 47 (NOT the naive 48)
  const fg = { name: 'FightersGuild' };
  assert.equal(reducedRepairCost(fg, { rank: 2 }, 60), 47);
  assert.equal(reducedRepairCost(fg, { rank: 10 }, 60), 0, 'free at rank 10');
  assert.equal(reducedRepairCost({ name: 'MagesGuild' }, { rank: 9 }, 60), 60, 'every other guild pays full');
  assert.equal(calculateItemRepairCost(300, 10, 500, 1000, { reducedRepairCost: (p) => reducedRepairCost(fg, { rank: 2 }, p) }), 47);
});

test('R1 repair time: 1000 points per day with a ONE-DAY floor, in classic minutes (:1924-1933)', () => {
  assert.equal(calculateItemRepairTime(500, 1000), MINUTES_PER_DAY, '500 damage would be 720 min - the floor is a full day');
  assert.equal(calculateItemRepairTime(0, 1000), MINUTES_PER_DAY, '1000 damage = exactly one day');
  assert.equal(calculateItemRepairTime(0, 2500), Math.trunc(2500 * MINUTES_PER_DAY / 1000), '2.5 days');
});

test('R1 scheduler: the longest job takes the queue stretch; committed times never decrease (:514-568)', () => {
  const a = item(0, 1000), b = item(0, 2000, { maxCondition: 2000 }), c = item(0, 3000, { maxCondition: 3000 });
  // times 1440/2880/4320, total 8640; the longest stretches to
  // 4320 + (8640-4320)/2 = 6480 (:552)
  const est = updateRepairTimes([a, b, c], { nowMinutes: 100 });
  assert.equal(est.get(a), 1440);
  assert.equal(est.get(b), 2880);
  assert.equal(est.get(c), 6480);
  assert.ok(!isBeingRepaired(a), 'estimate mode touches no record');

  updateRepairTimes([a, b, c], { commit: true, nowMinutes: 100, buildingKey: 55 });
  assert.equal(a.repairData.repairTime, 1440);
  assert.equal(c.repairData.repairTime, 6480);
  assert.equal(c.repairData.timeStarted, 100);
  assert.ok(isBeingRepairedAt(c, 55));

  // the never-decrease law (:561-567, forum t=2053): with a and b
  // gone, c alone would compute 4320 - the committed 6480 holds
  updateRepairTimes([c], { commit: true, nowMinutes: 200, buildingKey: 55 });
  assert.equal(c.repairData.repairTime, 6480);
  // InstantRepairs skips the whole pass (:516)
  assert.equal(updateRepairTimes([item(0, 1000)], { instantRepairs: true }).size, 0);
});

test('R1 state machine: leave is idempotent, finish heals through the shop filter, collect clears (ItemRepairData.cs)', () => {
  const it = item(200, 1000);
  leaveForRepair(it, 55, 1440, 100);
  leaveForRepair(it, 99, 9999, 500);   // idempotent (:59-67)
  assert.equal(it.repairData.buildingKey, 55);
  assert.ok(!isRepairFinished(it, 100 + 1439));
  assert.ok(isRepairFinished(it, 100 + 1440), 'GetTimeDone <= now');

  const entity = { otherItems: [it, item(0, 1000, { repairData: { buildingKey: 99, timeStarted: 0, repairTime: 999999 } })] };
  const here = repairJobsAt(entity, 55, 100 + 1440);
  assert.equal(here.length, 1, 'a job at ANOTHER shop is hidden (:718)');
  assert.equal(it.currentCondition, 1000, 'a finished job heals to max in the filter pass (:720-721)');
  assert.equal(repairStatusLabel(it, 100 + 1440), 'Repair done');
  collectRepaired(it);
  assert.ok(!isBeingRepaired(it));

  const pending = item(0, 3000, { maxCondition: 3000 });
  leaveForRepair(pending, 55, 4320, 0);
  assert.equal(repairStatusLabel(pending, 0), '3 days');
  assert.equal(daysUntil(4320, 1), 3, 'ceil of the time left');
});

test('R1 gates: magic unless AllowMagicRepairs, the isNotRepairable templates, full condition (:808-818)', () => {
  const magic = item(10, 1000, { enchantments: [{ type: 3, param: 0 }] });
  assert.equal(repairRefusal(magic), 'magic');
  assert.equal(repairRefusal(magic, { allowMagicRepairs: true }), null, 'the setting admits it');
  assert.equal(repairRefusal(item(10, 1000, { templateIndex: 247 })), 'notRepairable', 'a torch cannot be repaired');
  assert.equal(repairRefusal(item(1000, 1000)), 'undamaged');
  assert.equal(repairRefusal(item(10, 1000)), null);
});

test('R1 save: otherItems and their repairData ride the quicksave (SerializablePlayer.cs:132/:300)', () => {
  const it = item(200, 1000);
  leaveForRepair(it, 55, 1440, 100);
  const w = { name: 'W', health: 10, maxHealth: 10, level: 1, stats: {}, skills: [30], skillUses: [], items: [], otherItems: [it] };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(w, {})));
  const w2 = {};
  restorePlayer(w2, snap);
  assert.equal(w2.otherItems.length, 1);
  assert.deepEqual(w2.otherItems[0].repairData, { buildingKey: 55, timeStarted: 100, repairTime: 1440 });
  // a pre-R1 snapshot restores an empty collection
  delete snap.otherItems;
  const w3 = {};
  restorePlayer(w3, snap);
  assert.deepEqual(w3.otherItems, []);
});
