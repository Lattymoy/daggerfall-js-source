// AUDIT 29 (2026-09-28, Mac: "Lets audit everything so far before we continue") - THE PROFESSIONS' LAWS, AS THE AUDIT
// FOUND THEM: a node's id read only in its one spelling; the signatures beside a pixel's veins, never in their place;
// the unconfirmed patch held to tier 2 by the weights, as a vein is; a dispute only after the confirmation; the day's
// first writ the highest tier; the smelt's XP under the record's quarter; Motherlode Sense locked until its Motherlodes.
// Each pin failed on the code before its fix. bible/06-Systems/Online-Arc.md AUDIT 29.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseNodeKey, nodeKey, dveinKey, veins, vein, nodeCount, herbPatch, witnessedFact, courtWrits, regionSignature,
} from '../src/net/nodeLaw.js';
import { smeltXp, specOk, specOf, SPECIALISATIONS } from '../src/net/professionLaw.js';
import { CLIMATES } from '../src/formats/mapsTables.js';

const C = CLIMATES;
const DAY = 20500;
const DAGGERFALL = 17, WAYREST = 23;

test('AUDIT 29 A1: a node id is read only in its one spelling - a leading zero anywhere is another id, never the same node', () => {
  const k = nodeKey({ kind: 'vein', x: 10, y: 20, day: 20833, slot: 0 });
  assert.deepEqual(parseNodeKey(k), { kind: 'vein', x: 10, y: 20, day: 20833, slot: 0 });
  for (const bad of ['vein:010:20:20833:0', 'vein:10:020:20833:0', 'vein:10:20:020833:0', 'vein:10:20:20833:00', 'herb:005:005:020724:01']) {
    assert.equal(parseNodeKey(bad), null, bad);
  }
  assert.deepEqual(parseNodeKey('herb:0:0:0:0'), { kind: 'herb', x: 0, y: 0, day: 0, slot: 0 }, 'a zero is one digit');
  assert.deepEqual(parseNodeKey(dveinKey({ dungeon: 4321, day: 20833, slot: 1 })), { kind: 'dvein', dungeon: 4321, day: 20833, slot: 1 });
  for (const bad of ['dvein:04321:20833:1', 'dvein:4321:020833:1', 'dvein:4321:20833:01']) assert.equal(parseNodeKey(bad), null, bad);
});

test('AUDIT 29 A6: a signature is a vein BESIDE the climate\'s veins on confirmed ground (Daggerfall\'s two) - never in their place, so a novice keeps the ordinary ore', () => {
  for (const [climate, region] of [[C.Woodlands, DAGGERFALL], [C.Swamp, WAYREST], [C.Rainforest, WAYREST], [C.Mountain, WAYREST]]) {
    const n = nodeCount(climate, 'vein');
    const sig = regionSignature(region);
    const conf = veins({ x: 400, y: 150, day: DAY, climate, region, confirmed: true });
    const plain = conf.filter((v) => !v.signature);
    assert.equal(plain.length, n, `climate ${climate}: every ordinary vein stands on confirmed ground`);
    assert.deepEqual(conf.filter((v) => v.signature).map((v) => [v.slot, v.material]), Array.from({ length: sig.slots }, (_, i) => [n + i, sig.ore]), 'after them');
    assert.equal(vein({ x: 400, y: 150, day: DAY, slot: n + sig.slots, climate, region, confirmed: true }), null);
    assert.equal(vein({ x: 400, y: 150, day: DAY, slot: n, climate, region, confirmed: false }), null, 'an unconfirmed pixel has no signature slot');
    assert.equal(veins({ x: 400, y: 150, day: DAY, climate, region }).length, n);
  }
});

test('AUDIT 29 A8: an unconfirmed pixel\'s patch tier is drawn by the weights held to tier 2 (40 : 25), as a vein\'s is - not tier 3\'s draws clamped onto tier 2', () => {
  let t1 = 0, all = 0;
  // days of the three seasons that bare nothing a tier-2 draw needs (winter bares the uncommons - PROF0 4.3)
  for (let x = 100; x < 300; x++) for (let slot = 0; slot < nodeCount(C.Woodlands, 'herb'); slot++) {
    for (const day of [20400, 20415, 20423]) {
      const p = herbPatch({ x, y: 150, day, slot, climate: C.Woodlands, confirmed: false });
      if (!p) continue;
      all++;
      if (p.tier === 1) t1++;
      assert.ok(p.tier <= 2);
    }
  }
  const share = t1 / all;
  assert.ok(share > 0.56 && share < 0.68, `tier 1 is ${share.toFixed(3)} of ${all} (40 / 65 = 0.615)`);
});

test('AUDIT 29 A9: a dispute is two accounts giving another answer AFTER the confirmation - a dissent before it is no dispute', () => {
  const r = (account, report, at) => ({ account, report, at });
  const X = '231,59', Y = '231,21';
  assert.equal(witnessedFact([r('b', Y, 1), r('a', X, 2), r('d', X, 3), r('e', X, 4), r('c', Y, 5)]).state, 'confirmed', 'one before, one after');
  assert.equal(witnessedFact([r('b', Y, 1), r('c', Y, 2), r('a', X, 3), r('d', X, 4), r('e', X, 5)]).state, 'confirmed', 'both before');
  assert.equal(witnessedFact([r('a', X, 1), r('d', X, 2), r('e', X, 3), r('b', Y, 4), r('c', Y, 5)]).state, 'disputed', 'both after');
});

test('AUDIT 29 A10: the day\'s first Court writ asks the highest tier the table holds of 5-6', () => {
  const table = [1, 3, 4, 5, 6].map((tier) => ({ material: `m${tier}`, tier, value: tier }));
  for (let day = 20000; day < 20200; day++) assert.equal(courtWrits(day, WAYREST, 6, table)[0].tier, 6, `day ${day}`);
});

test('AUDIT 29 A7: a smelt\'s Smithing XP keeps the record\'s quarter (3.2) - a recipe more than two tiers below the rank\'s top gives a quarter', () => {
  assert.equal(smeltXp(1, 10), 100);
  assert.equal(smeltXp(1, 10, 0), 100);
  assert.equal(smeltXp(1, 10, 25), 100, 'rank 25 works tier 3: tier 1 is two below, not more');
  assert.equal(smeltXp(1, 10, 40), 25, 'rank 40 works tier 4: tier 1 is three below - harvestXp\'s own rule');
  assert.equal(smeltXp(6, 3, 100), 180);
});

test('AUDIT 29 A17: Motherlode Sense waited for its Motherlodes (PROF2b) - PIN MOVED (PROF2b, 2026-10-03): its Motherlodes built, it is chosen as any', () => {
  assert.equal(specOk('mining', 100, 'motherlode-sense'), true);
  assert.equal(specOk('mining', 100, 'stonebreaker'), true);
  assert.equal(specOf('mining', 100, 'motherlode-sense').later, undefined);
  assert.ok(SPECIALISATIONS.mining[100].some((s) => s.id === 'motherlode-sense'), 'the card still stands on the page');
});
