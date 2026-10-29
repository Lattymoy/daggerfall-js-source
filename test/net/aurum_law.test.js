// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md). The law both ends read
// (src/net/aurumLaw.js): the day's wares, the packs' shares, the weeks, the pass's Aurum and the card as the client takes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AURUM_DAILY, AURUM_DAILY_SLOTS, AURUM_DAILY_FROM, AURUM_PACKS, AURUM_DEEDS, AURUM_MAX, aurumDailyOf, aurumDailyById, aurumPriceOf,
  aurumBonusOf, aurumWeekOf, aurumWeekEndMs, aurumDayEndMs, aurumCardOf, aurumSwitchOf,
} from '../../src/net/aurumLaw.js';
import { SHOP_WARES, shopWareById } from '../../src/net/shopLaw.js';
import { PASS_REWARDS, PASS_SEASONS, passAurumGrant, passAurumOf, passGrants, PASS_XP_PER_LEVEL } from '../../src/net/battlePassLaw.js';

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

test('AURUM what the daily wares sell: shop wares only, never a season\'s (the pass is how those are had), the icons for Aurum alone and every other for money too; each price a whole hundred, and one sold for money too a little under its money at the smallest pack\'s rate (mutants: a pass reward in the pool; an icon sold for money; a daily ware dearer than its money)', () => {
  const seasonal = new Set(Object.values(PASS_REWARDS).flat().map((r) => r.grant));
  for (const d of AURUM_DAILY) {
    const w = shopWareById(d.id);
    assert.ok(w, d.id);
    assert.ok(!w.season && !seasonal.has(d.id), `${d.id}: never a season's`);
    assert.equal(w.cash, d.slot !== 'icon', `${d.id}: an icon for Aurum alone`);
    assert.ok(Number.isSafeInteger(d.aurum) && d.aurum > 0 && d.aurum % 100 === 0);
    assert.equal(aurumPriceOf(d.id), d.aurum);
    // AUDIT-STOREFRONT II: Aurum never the dearer way to buy a ware, nor a giveaway
    const atBase = w.cents * AURUM_PACKS[0].aurum / AURUM_PACKS[0].cents;
    if (w.cash) assert.ok(d.aurum < atBase && d.aurum >= 0.75 * atBase, `${d.id}: ${d.aurum} Aurum against ${atBase.toFixed(1)}`);
  }
  assert.equal(aurumPriceOf('pass:s1premium'), 0);
  assert.deepEqual(SHOP_WARES.filter((w) => !w.cash).map((w) => w.id).sort(), AURUM_DAILY.filter((d) => d.slot === 'icon').map((d) => d.id).sort(), 'every ware not sold for money is a daily icon');
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

test('AURUM the pass\'s Aurum: Season One\'s free track gives 525 and its premium 1,350, counted from the level reached and never a worn reward; the premium\'s only with the pass held (mutants: an Aurum grant handed to the wardrobe; the premium counted without the pass)', () => {
  const sum = (track) => PASS_REWARDS.s1.filter((r) => r.track === track).reduce((a, r) => a + (passAurumGrant(r.grant) ?? 0), 0);
  assert.equal(sum('free'), 525);
  assert.equal(sum('premium'), 1350);
  const s1 = PASS_SEASONS.find((s) => s.id === 's1'), mid = s1.toMs - 86_400_000;   // the last stage open: every level reachable
  const top = 50 * PASS_XP_PER_LEVEL;
  assert.equal(passAurumOf('s1', top, [], mid), 525);
  assert.equal(passAurumOf('s1', top, ['pass:s1premium'], mid), 525 + 1350);
  assert.equal(passAurumOf('s1', top, [], s1.fromMs + 86_400_000), 100, 'the first stage open: its levels alone (5 and 15)');
  assert.equal(passAurumOf('s1', 4 * PASS_XP_PER_LEVEL, ['pass:s1premium'], mid), PASS_REWARDS.s1.filter((r) => r.level <= 4 && r.track === 'premium').reduce((a, r) => a + (passAurumGrant(r.grant) ?? 0), 0));
  for (const g of passGrants('s1', top, ['pass:s1premium'], mid)) assert.ok(!g.startsWith('aurum:'), `${g}: never a worn reward`);
  // NO OVERABUNDANCE (the owner: "No overbundence of titles and profile icons"): a title or two a track, an icon or two
  const kinds = (track, kind) => PASS_REWARDS.s1.filter((r) => r.track === track && r.grant.startsWith(`${kind}:`)).length;
  assert.ok(kinds('free', 'title') <= 1 && kinds('premium', 'title') <= 1, 'one title a track at most');
  assert.ok(kinds('free', 'icon') <= 1 && kinds('premium', 'icon') <= 2, 'an icon or two');
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
