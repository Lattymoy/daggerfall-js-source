// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md). The law both ends read
// (src/net/aurumLaw.js): the day's wares, the packs' shares, the weeks and the card as the client takes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AURUM_DAILY, AURUM_DAILY_SLOTS, AURUM_DAILY_FROM, AURUM_PACKS, AURUM_DEEDS, AURUM_MAX, aurumDailyOf, aurumDailyById, aurumPriceOf,
  aurumBonusOf, aurumWeekOf, aurumWeekEndMs, aurumDayEndMs, aurumCardOf, aurumSwitchOf, AURUM_DEAL, aurumDealOf,
} from '../../src/net/aurumLaw.js';
import { SHOP_WARES, shopWareById } from '../../src/net/shopLaw.js';
import { PASS_ALL_GRANTS } from '../../src/net/battlePassLaw.js';

const all = () => true;
const slotOf = (id) => aurumDailyById(id).slot;

test('AURUM the day\'s wares: two effects, a name and two icons a day, decided the same on every machine from the first day; over a year no ware shows two days running and each comes back within six days (a name within four) (mutants: the nudge unbounded; seen never kept; a slot over its count)', () => {
  const days = 400;
  let prev = [];
  const last = new Map(), gap = new Map();
  for (let d = AURUM_DAILY_FROM; d < AURUM_DAILY_FROM + days; d++) {
    const picks = aurumDailyOf(d, all);
    assert.deepEqual(picks.map(slotOf), Object.entries(AURUM_DAILY_SLOTS).flatMap(([s, n]) => Array(n).fill(s)), `day ${d}: the slots in order`);
    assert.equal(new Set(picks).size, picks.length);
    for (const id of picks) {
      assert.ok(!prev.includes(id), `day ${d}: ${id} two days running`);
      if (last.has(id)) gap.set(id, Math.max(gap.get(id) ?? 0, d - last.get(id)));
      last.set(id, d);
    }
    prev = picks;
  }
  assert.equal(last.size, AURUM_DAILY.length, 'every ware comes round');
  for (const [id, g] of gap) assert.ok(g <= (slotOf(id) === 'name' ? 4 : 6), `${id} away ${g} days`);
});

test('AURUM the day\'s wares, cached or not: a day asked cold is the day asked after its neighbours, forwards and backwards; a day before the first is the first\'s; a ware the sale does not name never comes round (mutants: the cache kept across a step back; eligibility ignored)', () => {
  const cache = {};
  const run = [];
  for (let d = AURUM_DAILY_FROM; d < AURUM_DAILY_FROM + 40; d++) run.push(aurumDailyOf(d, all, cache));
  assert.deepEqual(aurumDailyOf(AURUM_DAILY_FROM + 39, all), run[39], 'cold, the same');
  assert.deepEqual(aurumDailyOf(AURUM_DAILY_FROM + 10, all, cache), run[10], 'a step back, the same');
  assert.deepEqual(aurumDailyOf(AURUM_DAILY_FROM - 30, all), run[0]);
  assert.deepEqual(aurumDailyOf(Number.NaN, all), []);
  const noPyre = (id) => id !== 'kill:pyre';
  for (let d = AURUM_DAILY_FROM; d < AURUM_DAILY_FROM + 60; d++) assert.ok(!aurumDailyOf(d, noPyre).includes('kill:pyre'));
  const someDay = (id, day) => !(id.startsWith('icon:') && day % 2);
  for (let d = AURUM_DAILY_FROM; d < AURUM_DAILY_FROM + 20; d++) assert.equal(aurumDailyOf(d, someDay).filter((id) => id.startsWith('icon:')).length, d % 2 ? 0 : 2, 'a day it may not, none');
});

test('AURUM what the daily deals sell (PIN MOVED, AURUM-ONLY: the daily wares are the day\'s deals): shop wares only, never a season\'s (its tracks are how those are had), every one sold alone for Aurum and none for money; each a quarter off its own Aurum price, never dearer and never a giveaway (mutants: a track\'s item in the pool; a deal at the full price; a deal off the wrong price)', () => {
  assert.equal(AURUM_DEAL, 0.75);
  for (const d of AURUM_DAILY) {
    const w = shopWareById(d.id);
    assert.ok(w, d.id);
    assert.ok(!PASS_ALL_GRANTS.includes(d.id), `${d.id}: never a season's`);
    assert.ok(w.alone && !w.cash && w.price > 0, `${d.id}: sold alone, for Aurum (PIN MOVED, AURUM-ONLY: none for money)`);
    assert.equal(d.aurum, aurumDealOf(w.price), `${d.id}: its deal, off its own price`);
    assert.equal(d.aurum, Math.round(w.price * 3 / 4), `${d.id}: a quarter off`);
    assert.ok(d.aurum < w.price && d.aurum >= 0.75 * w.price - 0.5, `${d.id}: ${d.aurum} against ${w.price}`);
    assert.equal(aurumPriceOf(d.id), d.aurum);
  }
  assert.equal(aurumPriceOf('glyph:gearcrown'), 0, 'a track\'s item has no deal price');
  assert.equal(aurumPriceOf('kill:pyre'), aurumDealOf(shopWareById('kill:pyre').price));
  assert.ok(PASS_ALL_GRANTS.every((g) => !shopWareById(g)), 'nor is it a shop ware');
  // PIN MOVED (AURUM-ONLY): every ware but a pack is bought with Aurum, the packs alone with money
  assert.deepEqual(SHOP_WARES.filter((w) => w.cash).map((w) => w.id), AURUM_PACKS.map((w) => w.id), 'money buys the packs alone');
});

test('AURUM the packs: four, sold for money and never held, each a larger share than the smallest - 10, 20 and 30 more in a hundred (mutants: a bonus off the wrong base; a pack held)', () => {
  assert.deepEqual(AURUM_PACKS.map((w) => [w.id, w.aurum, w.cents]), [['aurum:500', 500, 499], ['aurum:1100', 1100, 999], ['aurum:2400', 2400, 1999], ['aurum:3900', 3900, 2999]]);
  assert.deepEqual(AURUM_PACKS.map((w) => aurumBonusOf(w.id)), [0, 10, 20, 30]);
  assert.equal(aurumBonusOf('kill:pyre'), 0);
  assert.ok(AURUM_PACKS.every((w) => w.cash && w.alone && !w.bit));
});

test('AURUM the weeks and days: a week from Monday 00:00 UTC to the next; a day\'s wares until its midnight (mutants: a Thursday week)', () => {
  const sun = Date.UTC(2026, 10, 15, 23, 59, 59) / 1000, mon = Date.UTC(2026, 10, 16) / 1000;
  assert.equal(aurumWeekOf(mon), aurumWeekOf(sun) + 1);
  assert.equal(aurumWeekOf(mon + 6 * 86_400 + 86_399), aurumWeekOf(mon));
  assert.equal(aurumWeekEndMs(aurumWeekOf(mon)), Date.UTC(2026, 10, 23));
  assert.equal(aurumDayEndMs(Math.floor(Date.UTC(2026, 10, 18, 12) / 86_400_000)), Date.UTC(2026, 10, 19));
  assert.deepEqual(Object.keys(AURUM_DEEDS), ['gate', 'eg', 'serpent', 'star', 'raid']);
  assert.deepEqual(['on', 'dev', 'off', 'ON', undefined, 1].map(aurumSwitchOf), ['on', 'dev', 'off', 'off', 'off', 'off']);
});

test('AURUM the card as the client takes it: checked on the way in - a ware not the law\'s dropped, one listed twice once, its price the law\'s never the wire\'s; a balance past the bound, a deed past its kind\'s Aurum, a shape that is no card all refused (mutants: the wire\'s price trusted; a duplicate kept)', () => {
  const c = aurumCardOf({ open: true, balance: 1450, daily: { until: 5, wares: [{ id: 'kill:pyre', held: true, aurum: 1 }, { id: 'kill:pyre' }, { id: 'nope:x' }, { id: 'icon:aurbis', held: 'yes' }] }, week: { until: 9, deeds: { gate: 30, eg: 999, star: -1, bogus: 5 } } });
  assert.deepEqual(c, {
    open: true, balance: 1450,
    daily: { until: 5, wares: [{ id: 'kill:pyre', aurum: aurumPriceOf('kill:pyre'), slot: 'effect', held: true }, { id: 'icon:aurbis', aurum: aurumPriceOf('icon:aurbis'), slot: 'icon', held: false }] },
    week: { until: 9, deeds: { gate: 30, eg: 0, serpent: 0, star: 0, raid: 0 } },
  });
  assert.equal(aurumCardOf({ open: true, balance: -300 }).balance, -300, 'below nothing, as a pack taken back leaves it');
  assert.equal(aurumCardOf({ open: true, balance: AURUM_MAX + 1 }).balance, 0);
  for (const bad of [null, 'card', 42, {}, { open: 'yes' }]) assert.equal(aurumCardOf(bad), null);
});
