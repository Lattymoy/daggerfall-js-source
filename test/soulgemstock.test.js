// X6: THE SOUL GEM STOCK - the Mages Guild's Buy Soulgems service.
// X5 made Soul Trap fire and then could not be reached in play: no
// code path in the port minted a soul trap, so there was never an
// empty gem for a caught soul to enter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stockSoulGems, createEmptySoulTrap, createRandomlyFilledSoulTrap,
  dailyStockRolls, stockDayIndex, SOUL_TRAP_BASE_VALUE,
} from '../src/systems/shopStock.js';
import { SOUL_TRAP_TEMPLATE, fillEmptyTrap } from '../src/systems/mysticism.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const soulPointsOf = (t) => ENEMY_BASICS[t]?.soulPts ?? 0;

test('X6: the shelf size is the INCLUSIVE loop - trunc(quality/2) + 2 gems', () => {
  // `for (i = 0; i <= numOfItems; i++)` with numOfItems =
  // trunc(quality/2) + 1, so the shelf carries numOfItems + 1.
  for (const [quality, expect] of [[0, 2], [1, 2], [2, 3], [12, 8], [20, 12]]) {
    assert.equal(stockSoulGems({ quality, gameMinutes: 0 }).length, expect, `quality ${quality}`);
  }
});

test('X6: the shelf is DETERMINISTIC per game day and rotates at the day boundary', () => {
  // DFU seeds Random.InitState from ToClassicDaggerfallTime() /
  // MinutesPerDay so the stock does not flicker every time the window
  // is opened.
  const at = (m) => JSON.stringify(stockSoulGems({ quality: 10, gameMinutes: m }, { soulPointsOf }));
  const dayStart = 347 * 1440;   // a real day boundary, not an arbitrary minute
  assert.equal(at(dayStart), at(dayStart + 1439), 'every minute of one day is the same shelf');
  assert.notEqual(at(dayStart), at(dayStart + 1440), 'and midnight rotates it');
  assert.equal(stockDayIndex(0), 0);
  assert.equal(stockDayIndex(1439), 0);
  assert.equal(stockDayIndex(1440), 1);
});

test('X6: the stock is mostly EMPTY gems - FailedRoll(25) is true three times in four', () => {
  // Dice100.FailedRoll(25) is `Random.Range(0,100) >= 25`, and the
  // TRUE branch is the empty trap. It reads backwards until you notice
  // an empty gem is the one a Soul Trap caster actually needs.
  let empty = 0, filled = 0;
  for (let day = 0; day < 400; day++) {
    for (const g of stockSoulGems({ quality: 20, gameMinutes: day * 1440 }, { soulPointsOf })) {
      if (g.trappedSoulType === null) empty++; else filled++;
    }
  }
  const share = empty / (empty + filled);
  assert.ok(share > 0.68 && share < 0.82, `about three quarters empty, got ${share.toFixed(3)}`);
});

test('X6: an empty trap is a flat 5000, written over the template basePrice of 500', () => {
  const e = createEmptySoulTrap();
  assert.equal(e.group, 'MiscItems');
  assert.equal(e.templateIndex, SOUL_TRAP_TEMPLATE);
  assert.equal(e.trappedSoulType, null);
  assert.equal(e.value, SOUL_TRAP_BASE_VALUE);
  assert.equal(SOUL_TRAP_BASE_VALUE, 5000);
});

test('X6: a filled trap is 5000 + the creature SOUL POINTS', () => {
  // ItemBuilder:303 - `newItem.value = 5000 + mobileEnemy.SoulPts`.
  const lich = createRandomlyFilledSoulTrap(() => 32 / 43 + 1e-9, soulPointsOf);
  assert.equal(lich.trappedSoulType, 32, 'Lich');
  assert.equal(lich.value, 5000 + 100000);
  // and a SOULLESS creature yields a "filled" gem worth exactly what
  // an empty one is - DFU excludes only two ids from the draw, not the
  // eleven whose SoulPts are zero
  const zombie = createRandomlyFilledSoulTrap(() => 17 / 43 + 1e-9, soulPointsOf);
  assert.equal(zombie.trappedSoulType, 17, 'Zombie');
  assert.equal(soulPointsOf(17), 0, 'the Zombie is soulless in the bestiary');
  assert.equal(zombie.value, 5000, 'so its gem is worth what an empty one is');
});

test('X6: the draw excludes exactly two ids, and re-draws rather than shifting', () => {
  // Range(Rat, Lamia + 1) is 0..42; Horse_Invalid (39) is an unused
  // career and Dragonling (34) is soulless by DFU's own note ("only
  // soul of Dragonling_Alternate (40) has a soul"). A port that
  // skipped by shifting the index would silently bias the whole table.
  const seen = new Set();
  for (let i = 0; i < 43; i++) {
    let n = 0;
    const g = createRandomlyFilledSoulTrap(() => { const v = (i + n * 7) % 43; n++; return v / 43 + 1e-9; }, soulPointsOf);
    seen.add(g.trappedSoulType);
  }
  assert.ok(!seen.has(34), 'Dragonling is never drawn');
  assert.ok(!seen.has(39), 'Horse_Invalid is never drawn');
  assert.ok(seen.has(40), 'but Dragonling_Alternate IS - it is the one with a soul');
  assert.ok(seen.has(0) && seen.has(42), 'and the range really is 0..42 inclusive');
});

test('X6: a bought gem is one fillEmptyTrap accepts - the chain closes', () => {
  // The whole point of the lane: X5's trap could catch nothing because
  // nothing minted a gem it recognised. A shelf gem must satisfy the
  // very predicate the kill-time fill uses.
  const shelf = stockSoulGems({ quality: 20, gameMinutes: 0 }, { soulPointsOf });
  const empties = shelf.filter((g) => g.trappedSoulType === null);
  assert.ok(empties.length > 0, 'the shelf carries empty gems to buy');
  const target = fillEmptyTrap(shelf, 15);
  assert.ok(target, 'and the trap law finds one');
  assert.equal(target.trappedSoulType, 15);
  assert.equal(target, empties[0], 'the FIRST empty one, in shelf order');
  // a full shelf fills nothing
  const allFull = shelf.map((g) => ({ ...g, trappedSoulType: g.trappedSoulType ?? 1 }));
  assert.equal(fillEmptyTrap(allFull, 15), null);
});

test('X6: the service destination is no longer a FLAGGED null', () => {
  assert.equal(serviceDestination('BuySoulgems'), 'guildServiceBuySoulgems');
  // X6 left its two neighbours null and this pin said so. G4 took
  // them, along with the other two trade-mode arms, so the sentence
  // is replaced rather than struck: all five ride ONE window now.
  assert.equal(serviceDestination('BuyMagicItems'), 'guildServiceBuyMagicItems');
  assert.equal(serviceDestination('BuyPotions'), 'guildServiceBuyPotions');
  assert.equal(serviceDestination('Identify'), 'guildServiceIdentify');
  assert.equal(serviceDestination('SellMagicItems'), 'guildServiceSellMagicItems');
});

test('X6: the daily stream is a real stream - spread, and not all one value', () => {
  const r = dailyStockRolls(12345);
  const xs = Array.from({ length: 200 }, () => r());
  assert.ok(xs.every((x) => x >= 0 && x < 1), 'every draw is in [0,1)');
  assert.ok(new Set(xs).size > 190, 'and they are not repeating');
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(mean > 0.4 && mean < 0.6, `roughly uniform, mean ${mean.toFixed(3)}`);
  // seeded: the same seed replays exactly
  assert.deepEqual(Array.from({ length: 5 }, dailyStockRolls(9)), Array.from({ length: 5 }, dailyStockRolls(9)));
});
