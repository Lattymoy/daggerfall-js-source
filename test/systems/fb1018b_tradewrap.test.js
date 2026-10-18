// TRADE-WRAP and NO-NAN-PAY (FIELD BUGS 2026-10-18b - bible/01-Overview/bugs/Field-Bugs-2026-10-18b.md; shaman, "Letter
// of Credit vanishing from wallet": "i grinded tens of dungeons for daedric items to sell just for it to simply vanish").
// TRADE-WRAP: CalculateTradePrice's last step - the haggle's factor times the lot's whole cost, `>> 8` - was int32, so a
// sale of a big enough lot of Daedric pieces (a cost of about 9.6 to 18 million, by the shop and the skills) paid about
// -8,400,000 gold into the purse, and a purchase as large paid the buyer. NO-NAN-PAY: deductGold, given a price that is no
// number, spent every letter of credit in the pack and answered "paid". Pinned on the real counter: a lot of real Daedric
// claymores through tradeCost, getTradePrice and sellProceeds; the price unchanged for every lot that never wrapped; and
// the payment's refusals.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { tradeCost, getTradePrice, sellProceeds } from '../../src/systems/tradeModes.js';
import { calculateTradePrice } from '../../src/systems/shopStock.js';
import { deductGold } from '../../src/systems/court.js';
import { letterOfCredit } from '../../src/systems/inventory.js';

const DAEDRIC = 9, CLAYMORE = 122;
const lot = (n) => Array.from({ length: n }, () => createWeapon(CLAYMORE, DAEDRIC, () => 0.5));
const SKILLS = { mercantile: 100, personality: 100 };
/** DFU's arithmetic as it stood, C#'s int: the reference for every lot that never wrapped (offline, where the port is
 *  FormulaHelper.CalculateTradePrice verbatim). */
function int32Price(cost, q, { mercantile, personality }, selling) {
  const ml = 5 * (q - 10) + 50;
  if (selling) {
    const dm = ((Math.trunc(((100 - ml) << 8) / 200) + 128) * (Math.trunc((mercantile << 8) / 200) + 128)) >> 8;
    const dp = ((Math.trunc(((100 - ml) << 8) / 200) + 128) * (Math.trunc((personality << 8) / 200) + 128)) >> 8;
    return ((((179 * dm) >> 8) + ((51 * dp) >> 8)) * cost) >> 8;
  }
  const dm = ((Math.trunc((ml << 8) / 200) + 128) * (Math.trunc(((100 - mercantile) << 8) / 200) + 128)) >> 8;
  const dp = (((Math.trunc((ml << 8) / 200) + 128) * (Math.trunc(((100 - personality) << 8) / 200) + 128)) >> 8) << 6;
  return ((((192 * dm) >> 8) + (dp >> 8)) * cost) >> 8;
}

test('TRADE-WRAP THE SALE: a lot of 250 Daedric claymores sells for a price past the old wrap - positive, more than 100 of them, and paid as a letter of credit; the old arithmetic paid it as millions below nothing (mutants: the sale\'s wrap back)', () => {
  for (const online of [true, false]) {
    for (const q of [1, 10, 20]) {
      const big = tradeCost('Sell', lot(250), { quality: q, online }).cost, less = tradeCost('Sell', lot(100), { quality: q, online }).cost;
      assert.ok(big > 16_800_000, `the fixture is past the wrap at quality ${q} (its first at most 16.8 million)`);
      const price = calculateTradePrice(big, q, SKILLS, true, { online });
      assert.ok(price > calculateTradePrice(less, q, SKILLS, true, { online }) && price > 0, `quality ${q}, ${online ? 'online' : 'offline'}: more pieces, more gold`);
      if (!online) assert.ok(int32Price(big, q, SKILLS, true) < price, 'the old arithmetic paid less - below nothing at quality 1 and 10');
      assert.deepEqual(sellProceeds(price, { carriedWeightKg: 0, maxEncumbranceKg: 300 }), { kind: 'letterOfCredit', amount: price }, 'the lot pays in paper');
    }
  }
  assert.ok(int32Price(tradeCost('Sell', lot(150), { quality: 10, online: false }).cost, 10, SKILLS, true) < -1_000_000, 'the field\'s price: 150 claymores at a quality-10 shop sold for millions below nothing');
  assert.equal(getTradePrice('Sell', 13_000_000, 10, SKILLS), calculateTradePrice(13_000_000, 10, SKILLS, true), 'the window\'s door asks the same');
});

test('TRADE-WRAP THE SAME BELOW IT: for every lot that never wrapped, bought or sold, at every shop and skill, the price is DFU\'s to the gold (mutants: the floor not the shift)', () => {
  for (const q of [1, 5, 10, 15, 20]) {
    for (const s of [0, 37, 100]) {
      const sk = { mercantile: s, personality: 100 - s };
      for (const cost of [0, 1, 2, 7, 255, 256, 999, 46_080, 1_234_567, 7_000_000]) {
        for (const selling of [true, false]) {
          const old = int32Price(cost, q, sk, selling);
          if (old < 0) continue;
          assert.equal(calculateTradePrice(cost, q, sk, selling, { online: false }), old, `q${q} skills ${s} cost ${cost} ${selling ? 'sold' : 'bought'}`);
        }
      }
    }
  }
});

test('TRADE-WRAP THE PURCHASE: a lot as large bought asks a price, never pays the buyer (mutants: the purchase\'s wrap back)', () => {
  for (const q of [1, 10, 20]) {
    const cost = 40_000_000;
    assert.ok(int32Price(cost, q, { mercantile: 0, personality: 0 }, false) < cost / 4, `quality ${q}: the old arithmetic wrapped`);
    const price = calculateTradePrice(cost, q, { mercantile: 0, personality: 0 }, false, { online: false });
    assert.ok(price >= cost / 4 && price <= cost, `quality ${q}: a quarter to the whole of the cost`);
    assert.equal(getTradePrice('Buy', cost, q, { mercantile: 0, personality: 0 }) > 0, true);
  }
});

test('NO-NAN-PAY: a price that is no number, or below nothing, takes nothing - every letter and coin kept; a payment still spends letters first where the coins fall short (mutants: the guard dropped)', () => {
  const pack = () => ({ goldPieces: 100, items: [letterOfCredit(650_000), letterOfCredit(700_000)] });
  for (const amount of [NaN, undefined, null, -500, 0]) {
    const p = pack();
    assert.equal(deductGold(p, amount), 0);
    assert.deepEqual([p.goldPieces, p.items.map((it) => it.value)], [100, [650_000, 700_000]], `${amount}: nothing taken, nothing minted`);
  }
  const p = pack();
  assert.equal(deductGold(p, 50), 0);
  assert.deepEqual([p.goldPieces, p.items.length], [50, 2], 'the coins cover it');
  assert.equal(deductGold(p, 200), 0);
  assert.deepEqual([p.goldPieces, p.items[0].value], [50, 649_800], 'the coins do not: a letter pays (DFU\'s order)');
});
