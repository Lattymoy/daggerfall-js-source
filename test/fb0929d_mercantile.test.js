// MERC-RISE (FIELD BUGS 2026-09-29d, ValenValarys on Discord): "As the skill level increases, the sell price for items
// actually decreases instead of going up ... 100 Personality: on the first try with around level 60 Mercantile
// (3499g), and on the second try with around level 90 Mercantile (2888g)."
//
// REALM P0.4 capped an online sale at half of the SELLER's own ask. The ask falls as Mercantile and Personality rise
// (CalculateTradePrice's buying arm, FormulaHelper.cs:1996-2001), and the cap binds for nearly every seller online, so
// the payout fell with the skill. Reproduced to the gold: a quality-5 counter, a lot costing 17397, Personality 100 -
// the old cap is 3499 at Mercantile 60 and 2888 at 90. The half is of the LEAST the counter asks now: the best haggler's
// ask (100 in each, DFU's maximum, or the seller's own past it). That is still at most half of what the counter asks
// anyone, so the buy-back loop P0.4 shut stays shut, and it is a number of the counter and the piece - no skill lowers a
// sale. Offline, Daggerfall's haggle is untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTradePrice, ONLINE_SALE_SHARE, ONLINE_SALE_REFERENCE_SKILL } from '../src/systems/shopStock.js';
import { getTradePrice } from '../src/systems/tradeModes.js';

const sale = (cost, q, m, p, online = true) => calculateTradePrice(cost, q, { mercantile: m, personality: p }, true, { online });
const ask = (cost, q, m, p) => calculateTradePrice(cost, q, { mercantile: m, personality: p }, false, { online: false });

test('MERC-RISE: the field\'s counter - a higher Mercantile never sells for less (P0.4 paid 3499 at 60 and 2888 at 90)', () => {
  const [Q, COST] = [5, 17397];
  // the report's two offers were half of each seller's own ask - the old law, to the gold
  assert.deepEqual([Math.floor(ask(COST, Q, 60, 100) / 2), Math.floor(ask(COST, Q, 90, 100) / 2)], [3499, 2888]);
  assert.ok(sale(COST, Q, 90, 100) >= sale(COST, Q, 60, 100), `${sale(COST, Q, 90, 100)} at 90, ${sale(COST, Q, 60, 100)} at 60`);
  assert.equal(sale(COST, Q, 60, 100), 2718, 'half of the 5436 this counter asks the best haggler');
  assert.equal(ask(COST, Q, 100, 100), 5436);
  // the counter's own figure, whoever sells: half of its least ask, under Daggerfall's offer
  for (const m of [0, 30, 60, 90, 100]) assert.equal(sale(COST, Q, m, 100), Math.min(sale(COST, Q, m, 100, false), 2718), `Mercantile ${m}`);
  // through the trade window's own door
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    assert.equal(getTradePrice('Sell', COST, Q, { mercantile: 90, personality: 100 }), 2718);
    assert.equal(getTradePrice('Sell', COST, Q, { mercantile: 60, personality: 100 }), 2718);
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
});

test('MERC-RISE: online, a sale never falls as Mercantile or Personality rises - every counter, every lot', () => {
  let checked = 0;
  for (let q = 1; q <= 20; q++) {
    for (const cost of [7, 120, 777, 5000, 17397, 250000]) {
      for (let p = 0; p <= 100; p += 10) {
        let last = -1;
        for (let m = 0; m <= 100; m += 5) {
          const s = sale(cost, q, m, p);
          assert.ok(s >= last, `q${q} cost${cost} p${p}: Mercantile ${m} sells for ${s}, less than ${last} below it`);
          last = s;
          checked++;
        }
      }
      for (let m = 0; m <= 100; m += 10) {
        let last = -1;
        for (let p = 0; p <= 100; p += 5) {
          const s = sale(cost, q, m, p);
          assert.ok(s >= last, `q${q} cost${cost} m${m}: Personality ${p} sells for ${s}, less than ${last} below it`);
          last = s;
        }
      }
    }
  }
  assert.ok(checked > 20000, `${checked}`);
});

test('MERC-RISE: P0.4\'s law stands for every seller - online a counter pays at most half of what it asks that seller, a spell\'s lift past 100 included', () => {
  assert.equal(ONLINE_SALE_SHARE, 0.5);
  assert.equal(ONLINE_SALE_REFERENCE_SKILL, 100, 'DFU\'s maximum skill and stat');
  for (let q = 1; q <= 20; q += 1) {
    for (const cost of [3, 777, 17397]) {
      for (const m of [0, 50, 100, 115, 130]) {
        for (const p of [0, 50, 100, 120]) {
          const s = sale(cost, q, m, p);
          assert.ok(s <= Math.floor(ask(cost, q, m, p) * ONLINE_SALE_SHARE), `q${q} cost${cost} m${m} p${p}: ${s} against an ask of ${ask(cost, q, m, p)}`);
        }
      }
    }
  }
  // offline, Daggerfall's haggle - a quality-1 counter still pays more than it asks there
  assert.deepEqual([sale(1_000, 1, 2, 50, false), ask(1_000, 1, 2, 50)], [488, 484]);
});
