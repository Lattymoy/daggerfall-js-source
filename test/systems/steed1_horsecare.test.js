// STEED1 (2026-10-11, the owner: "Horse should have stamina, feeding them grows your bond and improves their stats. Every
// horse should have different stats") - HORSE CARE (bible/06-Systems/Horse-Care.md): the law (systems/steedCare.js) -
// each horse's born stats off its seed, the bond and what grows it, hunger and what it costs, the keep (the stable's,
// grazing, the packs' oats through a span skipped), the breath under a gallop; the runtime (systems/upkeep/upkeepRuntime.js) -
// the gallop's gate, the ride's pace, the HUD's bar, the Stable's model and acts, an inventory's Use; the transport's
// gate (systems/transport.js), the motor's pace (player/motor.js), the yard's horses (systems/merchantYards.js), the
// item's law, fields and card; the Stable page; and the hosts wiring it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORSE_CARE_HARD as HARD, WAGON_UPKEEP_HARD as WHARD } from '../../src/systems/upkeep/upkeepTiers.js';   // HORSE-TIERS (PIN MOVED): the upkeep is handed a tier's rules - these pins pin the system as it stood, Hard
import { readFileSync } from 'node:fs';
import {
  bornStats, horseBornStats, STEED_STATS, STEED_BORN_MIN, STEED_BORN_MAX, bondTier, bondBonus, BOND_TIERS, BOND_STEP, BOND_TENTHS_MAX,
  hungerOf, HUNGER, STARVING_AFTER, NEW_HORSE_FED, FULL_AHEAD, FED_AHEAD_MAX, DAY_BOND_TENTHS, STARVING_BOND_TENTHS_A_DAY, MINUTES_A_DAY,
  feedHorse, tendHorses, steedStats, steedSpeedScale, teamDraftScale, stepBreath, freshBreath, breathMax, breathShare, canGallop,
  GALLOP_SPEND, BREATH_BACK, RIDDEN_BACK, WINDED_UNTIL, STAMINA_BASE, STAMINA_PER_POINT, chooseRiddenHorse, horsesIn, bondAt,
  OATS_TEMPLATE, APPLE_TEMPLATES, STEED_FOODS, steedValue, STEED_PRICE, SKIP_MINUTES, STABLE_FED, STEED_TEXT,
} from '../../src/systems/steedCare.js';
import { createUpkeep, horseWhereOf, upkeepReach, registerUpkeepUses, BREATH_LOW } from '../../src/systems/upkeep/upkeepRuntime.js';
import { UPKEEP_ITEM, UPKEEP_ITEM_ROWS, UPKEEP_ITEMS_ONLINE, upkeepItemsAvailable } from '../../src/systems/upkeep/upkeepItemRows.js';
import { setGallopGate, setCanRunOverride, canRunUnlessRiding, TRANSPORT_MODES, DF_RIDE_BASE, DF_CART_BASE } from '../../src/systems/transport.js';
import { PlayerMotor, rideSpeed, runSpeed } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { activeHorseItem, birthHorses } from '../../src/systems/horse/horseCoats.js';
import { stableHorses, yardStock, STABLE_HORSES_OFFERED } from '../../src/systems/merchantYards.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { validItemField } from '../../src/systems/item/itemFields.js';
import { RECEIVER_MARKS, TRADE_VOLATILE_FIELDS } from '../../src/net/realm/realmTradeLaw.js';
import { itemStatRows } from '../../src/systems/item/itemInfo.js';
import { itemUseHandler } from '../../src/systems/item/itemTemplates.js';
import { HORSE_MODE, WAGON_MODE, TRANSPORT } from '../../src/systems/horse/horseCartLaw.js';
import { FEATURES } from '../../src/systems/features.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const horse = (seed, extra = {}) => ({ group: 'Transportation', templateIndex: 94, horseSeed: seed, ...extra });
const oats = (n = 1) => ({ group: 'UselessItems2', templateIndex: OATS_TEMPLATE, ...(n > 1 ? { stackCount: n } : {}) });
const apple = (n = 1) => ({ group: 'UselessItems2', templateIndex: APPLE_TEMPLATES[0], ...(n > 1 ? { stackCount: n } : {}) });
const T0 = 2_000_000;

test('STEED1 EVERY HORSE ITS OWN: four stats off the seed - the same horse the same stats, every client, every load; born 20-80, most near 50; no field holds them, so a horse born before STEED1 had its stats all along (mutants: one draw, not two; a stat off another\'s draw; the range)', () => {
  assert.deepEqual(STEED_STATS, ['speed', 'stamina', 'endurance', 'strength']);
  assert.deepEqual([STEED_BORN_MIN, STEED_BORN_MAX], [20, 80]);
  assert.deepEqual(bornStats(77), bornStats(77), 'the seed is the horse');
  assert.deepEqual(bornStats(1), { speed: 48, stamina: 28, endurance: 44, strength: 52 }, 'the first seed\'s, pinned');
  assert.deepEqual(bornStats(2), { speed: 63, stamina: 59, endurance: 56, strength: 49 });
  assert.equal(bornStats(0), null); assert.equal(bornStats(65536), null); assert.equal(bornStats(1.5), null);
  const hist = new Map();
  let lo = 100, hi = 0, sum = 0, n = 0, same = 0;
  for (let s = 1; s <= 65535; s++) {
    const b = bornStats(s);
    for (const k of STEED_STATS) { lo = Math.min(lo, b[k]); hi = Math.max(hi, b[k]); sum += b[k]; n++; hist.set(b[k], (hist.get(b[k]) ?? 0) + 1); }
    if (b.speed === b.stamina && b.stamina === b.endurance && b.endurance === b.strength) same++;
  }
  assert.deepEqual([lo, hi], [20, 80], 'the whole range, and never past it');
  assert.ok(Math.abs(sum / n - 50) < 0.2, `the mean the middle (${(sum / n).toFixed(2)})`);
  assert.ok((hist.get(50) ?? 0) > 5 * (hist.get(25) ?? 0), 'the mean of two draws - most near the middle, few at the ends');
  assert.ok(same < 200, 'the four apart (each its own draws)');
  const distinct = new Set(Array.from({ length: 500 }, (_, i) => JSON.stringify(bornStats(i + 1))));
  assert.ok(distinct.size > 490, `every horse different (${distinct.size} of 500)`);
  assert.equal(horseBornStats({ group: 'Transportation', templateIndex: 94 }), null, 'not yet born: none');
  assert.equal(horseBornStats({ templateIndex: 93, horseSeed: 5 }), null, 'a wagon has none');
  const h = horse(77);
  horseBornStats(h);
  assert.deepEqual(Object.keys(h).sort(), ['group', 'horseSeed', 'templateIndex'], 'read, never written');
});

test('STEED1 THE BOND: a day\'s food a day\'s bond (three points), its love times more - an apple loves 1.5 - in tenths to 100; five points a point on every stat; its word from Wary to Kindred (mutants: the love unread, the step, the cap, the tiers)', () => {
  assert.equal(DAY_BOND_TENTHS, 30); assert.equal(BOND_STEP, 5); assert.equal(BOND_TENTHS_MAX, 1000);
  assert.deepEqual(BOND_TIERS.map((t) => [t.min, t.name]), [[0, 'Wary'], [15, 'Accepting'], [35, 'Familiar'], [55, 'Trusting'], [75, 'Devoted'], [95, 'Kindred']]);
  assert.deepEqual([0, 14.9, 15, 34, 35, 55, 74.9, 75, 94, 95, 100].map(bondTier), ['Wary', 'Wary', 'Accepting', 'Accepting', 'Familiar', 'Trusting', 'Trusting', 'Devoted', 'Devoted', 'Kindred', 'Kindred']);
  assert.deepEqual([0, 4.9, 5, 49, 100].map(bondBonus), [0, 0, 1, 9, 20]);
  assert.deepEqual(STEED_FOODS[OATS_TEMPLATE], { key: 'oats', name: 'oats', hours: 24, love: 1, treat: false });
  assert.deepEqual(APPLE_TEMPLATES, [532, 1608], 'Climates & Calories\' Apple, and Foraging\'s');
  const h = horse(9, { horseFed: T0 });   // its food just run out
  const pack = [h, oats(3), apple(10)];
  const r = feedHorse(pack, h, 'oats', T0);
  assert.deepEqual([r.ok, r.gained, h.horseBond, h.horseFed], [true, 30, 30, T0 + 24 * 60]);
  assert.equal(pack[1].stackCount, 2, 'one sack spent');
  assert.match(r.text, /Your horse eats oats\. Your bond grows \(Wary\)\./);
  const a = feedHorse(pack, h, 'apple', T0);
  assert.deepEqual([a.ok, a.gained, h.horseFed], [true, 8, T0 + 28 * 60], 'four hours, at an apple\'s love: 4/24 x 30 x 1.5 = 7.5, rounded');
  // FULL: fed this far ahead it will not eat
  h.horseFed = T0 + FULL_AHEAD;
  const full = feedHorse(pack, h, 'oats', T0);
  assert.deepEqual([full.ok, full.text, pack[1].stackCount], [false, STEED_TEXT.full('Your horse'), 2], 'refused, and nothing spent');
  // and never more than FED_AHEAD_MAX ahead - the bond only for what it held
  h.horseFed = T0 + FULL_AHEAD - 60;
  const capped = feedHorse(pack, h, 'oats', T0);
  assert.equal(h.horseFed, T0 + FED_AHEAD_MAX);
  assert.equal(capped.gained, Math.round(((FED_AHEAD_MAX - FULL_AHEAD + 60) / MINUTES_A_DAY) * 30));
  // none carried, no horse
  assert.deepEqual(feedHorse([h], h, 'oats', T0 - 3 * MINUTES_A_DAY), { ok: false, text: STEED_TEXT.noFood('oats'), gained: 0 });
  assert.equal(feedHorse([oats()], horse(3), 'oats', T0).ok, false, 'a horse not in the pack');
  // the cap: a hundred, and no more
  const fat = horse(4, { horseBond: 995, horseFed: T0 });
  feedHorse([fat, oats()], fat, 'oats', T0);
  assert.equal(fat.horseBond, BOND_TENTHS_MAX);
  // a quest's apple is never fed
  assert.equal(feedHorse([h, { ...apple(), questItem: true }], h, 'apple', T0 - 5 * MINUTES_A_DAY).ok, false);
});

test('STEED1 HUNGER: fed, hungry the moment its food runs out, starving two days on - ten and twenty-five off every stat, the breath slower; starving fades the bond two points a day, taken off once, when its food clock next moves (mutants: the thresholds, the penalty, the fade taken twice)', () => {
  assert.equal(STARVING_AFTER, 2 * MINUTES_A_DAY);
  assert.deepEqual(Object.values(HUNGER).map((x) => [x.key, x.penalty, x.breath]), [['fed', 0, 1], ['hungry', 10, 0.7], ['starving', 25, 0.4]]);
  const h = horse(2, { horseFed: T0, horseBond: 500 });
  assert.deepEqual([hungerOf(h, T0 - 1), hungerOf(h, T0), hungerOf(h, T0 + STARVING_AFTER - 1), hungerOf(h, T0 + STARVING_AFTER)], ['fed', 'hungry', 'hungry', 'starving']);
  assert.equal(hungerOf(horse(2), T0), 'fed', 'a horse never seen fed comes fed');
  const born = bornStats(2);
  assert.deepEqual(steedStats(h, T0 - 1).stats, Object.fromEntries(STEED_STATS.map((k) => [k, born[k] + 10])), 'fed: born and its bond\'s ten');
  assert.deepEqual(steedStats(h, T0).stats, Object.fromEntries(STEED_STATS.map((k) => [k, born[k]])), 'hungry: ten off');
  const starving = steedStats(h, T0 + STARVING_AFTER);
  assert.deepEqual([starving.hunger, starving.penalty, starving.stats.speed], ['starving', 25, born.speed + 10 - 25]);
  // the fade: two points a day starving, read live...
  assert.equal(bondAt(h, T0 + STARVING_AFTER + MINUTES_A_DAY), 48, 'a day starving: 50 less 2');
  assert.equal(STARVING_BOND_TENTHS_A_DAY, 20);
  // ...and taken off once, when it eats
  const pack = [h, oats(2)];
  feedHorse(pack, h, 'oats', T0 + STARVING_AFTER + MINUTES_A_DAY);
  assert.equal(h.horseBond, 480 + 30, 'the fade off, then the meal on');
  assert.equal(bondAt(h, T0 + STARVING_AFTER + MINUTES_A_DAY), 51, 'and never taken again');
  // a stat is held to 1..100
  const weak = horse(1, { horseFed: T0 - 10 * MINUTES_A_DAY });
  assert.ok(STEED_STATS.every((k) => steedStats(weak, T0).stats[k] >= 1));
  const strong = horse(2, { horseBond: 1000, horseFed: T0 + 60 });
  assert.ok(STEED_STATS.every((k) => steedStats(strong, T0).stats[k] <= 100));
});

test('HORSE-LIVES (2026-10-12, the owner: "Horses shouldnt die"): no keep and no span kills a horse - a year with its owner and no food leaves it in the pack, starving and slow, its stats held to 1 and its bond to nought, ridden at Speed\'s floor and valid to the item law; a sack of oats and it is fed again; left waiting or stabled it never starves at all', () => {
  const YEAR = 365 * MINUTES_A_DAY;
  let t = T0;
  const h = horse(1, { horseFed: T0, horseBond: 40 });
  const items = [h];
  const u = createUpkeep({ items: () => items, now: () => t, horseCare: () => HARD });
  u.tick(0.016, { mode: 'Horse' });
  for (let d = 1; d <= 365; d++) { t = T0 + d * MINUTES_A_DAY; u.tick(0.016, { mode: 'Horse' }); }
  assert.deepEqual([items.length, items[0], t - T0], [1, h, YEAR], 'a year on: still the pack\'s');
  const st = steedStats(h, t);
  assert.equal(st.hunger, 'starving');
  assert.ok(STEED_STATS.every((k) => st.stats[k] >= 1), 'its stats held to 1');
  assert.equal(bondAt(h, t), 0, 'its bond faded to nought, no lower');
  assert.ok(u.rideScale('Horse') >= 0.85, 'ridden, at Speed\'s floor at the worst');
  assert.equal(u.gallopGate('Horse', null), false, 'starving: no gallop - and nothing worse');
  assert.deepEqual(itemFindings(h), [], 'the item law keeps it');
  items.push(oats());
  assert.equal(feedHorse(items, h, 'oats', t).ok, true);
  assert.equal(steedStats(h, t).hunger, 'fed', 'a sack and it is fed again');
  for (const where of ['waiting', 'stabled']) {
    let tw = T0;
    const w = horse(3, { horseFed: T0 });
    const keep = createUpkeep({ items: () => [w], now: () => tw, horseCare: () => HARD, where: () => where });
    keep.tick(0.016);
    for (let d = 1; d <= 30; d++) { tw = T0 + d * MINUTES_A_DAY; keep.tick(0.016); }
    assert.notEqual(steedStats(w, tw).hunger, 'starving', `${where}: never starving`);
  }
});

test('STEED1 THE KEEP: a horse first seen comes fed; the stable feeds its own; a horse left waiting grazes - hungry, never starving; one with its owner through a span skipped eats the packs\' oats each time its food runs out, the bond grown as by hand - out of oats, it goes hungry (mutants: the stable unread, the grazing floor, the span\'s meals, the `since`)', () => {
  const a = horse(5);
  const r0 = tendHorses([a], T0);
  assert.deepEqual([r0.changed, a.horseFed], [true, T0 + NEW_HORSE_FED]);
  // the stable: topped to STABLE_FED whenever it falls under six hours, no bond
  const s = horse(6, { horseFed: T0 - 5 * MINUTES_A_DAY, horseBond: 300 });
  tendHorses([s], T0, { where: 'stabled' });
  assert.deepEqual([s.horseFed, hungerOf(s, T0)], [T0 + STABLE_FED, 'fed']);
  assert.ok(s.horseBond < 300, 'its starving before it came to the stable faded the bond, taken off as it was fed');
  const was = s.horseFed;
  tendHorses([s], T0 + 60, { where: 'stabled' });
  assert.equal(s.horseFed, was, 'topped only under six hours ahead - no write a minute');
  // waiting in the world: grazing, never starving
  const w = horse(7, { horseFed: T0 - 10 * MINUTES_A_DAY });
  tendHorses([w], T0, { where: 'waiting' });
  assert.equal(hungerOf(w, T0), 'hungry');
  assert.ok(T0 - w.horseFed < STARVING_AFTER);
  // AUDIT STEED1: a span the keep did not run across (an inn's rest, a dungeon - no frame ticks indoors) while it grazed
  // or was stabled: it never starved there - only a fade owed BEFORE the span is taken
  for (const where of ['waiting', 'stabled']) {
    const g = horse(9, { horseFed: T0, horseBond: 500 });
    tendHorses([g], T0 + 5 * MINUTES_A_DAY, { since: T0, where });
    assert.equal(g.horseBond, 500, `${where}: no fade for the span it grazed or was stabled`);
    const late = horse(10, { horseFed: T0 - 4 * MINUTES_A_DAY, horseBond: 500 });
    tendHorses([late], T0 + 5 * MINUTES_A_DAY, { since: T0, where });
    assert.equal(late.horseBond, 460, `${where}: the two days it starved before the span still fade it`);
  }
  // with its owner: a span skipped (a rest, a journey) - the packs' oats, eaten each time its food runs out
  const h = horse(8, { horseFed: T0 });
  const pack = [h, oats(3)];
  assert.equal(tendHorses(pack, T0 + 30, { since: T0, where: 'with' }).ate, 0, 'under SKIP_MINUTES: no span');
  assert.equal(SKIP_MINUTES, 60);
  const span = tendHorses(pack, T0 + 2.5 * MINUTES_A_DAY, { since: T0 - 60, where: 'with' });
  assert.deepEqual([span.ate, h.horseFed, h.horseBond], [3, T0 + 3 * MINUTES_A_DAY, 90], 'a sack each time its food ran out: three days fed, three days\' bond');
  assert.equal(pack.length, 1, 'the last sack taken out of the pack');
  // no oats left: the next span leaves it hungry
  tendHorses(pack, T0 + 4 * MINUTES_A_DAY, { since: T0 + 2.5 * MINUTES_A_DAY, where: 'with' });
  assert.equal(hungerOf(h, T0 + 4 * MINUTES_A_DAY), 'hungry');
  // ...unless the wagon's load carries them, where it is with its owner: the pack's first, then the wagon's
  const load = [oats(2)];
  const fromWagon = tendHorses(pack, T0 + 4.5 * MINUTES_A_DAY, { since: T0 + 4 * MINUTES_A_DAY, where: 'with', stores: load });
  assert.deepEqual([fromWagon.ate, load[0].stackCount, hungerOf(h, T0 + 4.5 * MINUTES_A_DAY), h.horseFed], [1, 1, 'fed', T0 + 5 * MINUTES_A_DAY], 'a sack out of the wagon, eaten as the span began');
  // the keep's word off Horse Cart and Cargo's view
  const v = (o) => ({ persistence: true, hasHorse: true, transport: TRANSPORT.Foot, horseMode: HORSE_MODE.WithPlayer, wagonMode: WAGON_MODE.WithPlayer, ...o });
  assert.equal(horseWhereOf(null), 'with', 'the mod off: always with its owner');
  assert.equal(horseWhereOf(v({ persistence: false })), 'with', 'no persistence: the classic transport');
  assert.equal(horseWhereOf(v({ transport: TRANSPORT.Horse })), 'with');
  assert.equal(horseWhereOf(v({ transport: TRANSPORT.Cart })), 'with');
  assert.equal(horseWhereOf(v({ horseMode: HORSE_MODE.FollowingPlayer })), 'with');
  assert.equal(horseWhereOf(v({ horseMode: HORSE_MODE.HitchedToWagon, wagonMode: WAGON_MODE.FollowingPlayer })), 'with');
  assert.equal(horseWhereOf(v({ horseMode: HORSE_MODE.LooseStationary })), 'waiting');
  assert.equal(horseWhereOf(v({ horseMode: HORSE_MODE.HitchedToWagon, wagonMode: WAGON_MODE.Deployed })), 'waiting');
  assert.equal(horseWhereOf(v({ horseStabled: true })), 'stabled', 'out of the world - the Stable card\'s own word');
  assert.equal(horseWhereOf(v({})), 'with', 'WAGON-STABLED (PIN MOVED): never sent to the stable, the mod\'s WithPlayer is beside its owner');
});

test('STEED1 THE BREATH: a gallop spends it, Endurance slowing the spend; at nought winded until 30% is back; back at a walk, half at the ride\'s pace, slower hungry; a starving horse never gallops (mutants: the spend, the back, the winded threshold, the ridden share, the hunger)', () => {
  const mid = { speed: 50, stamina: 50, endurance: 50, strength: 50 };
  assert.equal(breathMax(mid), STAMINA_BASE + STAMINA_PER_POINT * 50);
  assert.equal(breathMax({ ...mid, stamina: 90 }), 40 + 108);
  let b = freshBreath(), t = 0;
  while (!b.winded && t < 300) { b = stepBreath(b, { stats: mid, galloping: true, dt: 0.1 }); t += 0.1; }
  assert.ok(Math.abs(t - breathMax(mid) / GALLOP_SPEND) < 0.15, `an average horse gallops some thirty seconds (${t.toFixed(1)})`);
  let t2 = 0, b2 = freshBreath();
  const hardy = { ...mid, endurance: 90 };
  while (!b2.winded && t2 < 300) { b2 = stepBreath(b2, { stats: hardy, galloping: true, dt: 0.1 }); t2 += 0.1; }
  assert.ok(t2 > t * 1.2, 'Endurance slows the spend');
  assert.equal(canGallop(b, 'fed'), false, 'winded');
  assert.ok(stepBreath(b, { stats: mid, galloping: true, dt: 1 }).spent < breathMax(mid), 'a winded horse gallops no more - its breath only comes back');
  let back = 0, w = b;
  while (w.winded) { w = stepBreath(w, { stats: mid, dt: 0.1 }); back += 0.1; }
  assert.ok(Math.abs(breathShare(w, mid) - WINDED_UNTIL) < 0.01, 'winded until 30% is back');
  assert.ok(Math.abs(back - (WINDED_UNTIL * breathMax(mid)) / BREATH_BACK) < 0.2, `back at a walk (${back.toFixed(1)} s)`);
  const ridden = stepBreath({ spent: 50, winded: false }, { stats: mid, ridden: true, dt: 1 });
  const rested = stepBreath({ spent: 50, winded: false }, { stats: mid, dt: 1 });
  assert.ok(Math.abs((50 - ridden.spent) - (50 - rested.spent) * RIDDEN_BACK) < 1e-9, 'half back at the ride\'s pace');
  const hungry = stepBreath({ spent: 50, winded: false }, { stats: mid, hunger: 'hungry', dt: 1 });
  assert.ok(Math.abs((50 - hungry.spent) - (50 - rested.spent) * 0.7) < 1e-9, 'slower hungry');
  assert.equal(canGallop(freshBreath(), 'starving'), false, 'starving: no gallop');
  assert.equal(canGallop(freshBreath(), 'hungry'), true);
  // SPEED and STRENGTH
  assert.deepEqual([20, 50, 80, 100, 1, 0].map((v) => Math.round(steedSpeedScale(v) * 1000) / 1000), [0.91, 1, 1.09, 1.15, 0.853, 0.85], '0.85 + 0.003 a point, held to [0.85, 1.15]');
  assert.equal(teamDraftScale(50, 0), 1, 'empty, nothing');
  assert.ok(Math.abs(teamDraftScale(50, 1) - 0.8) < 1e-9 && Math.abs(teamDraftScale(80, 1) - 0.86) < 1e-9 && Math.abs(teamDraftScale(35, 1) - 0.77) < 1e-9 && teamDraftScale(20, 1) === 0.75 && teamDraftScale(50, 0.5) === 0.9, 'a full load at 50 the pace 0.8, never under 0.75');
});

test('STEED1 THE GALLOP\'S GATE: after the mod\'s word - Roleplay & Realism\'s no gallop in town stands; with no mod ruling, horse care lets a horse gallop on its breath; winded or starving, never; not a horse, or horse care off, no word (mutants: the mod\'s false overridden, the null kept, the gate unread)', () => {
  const items = [horse(2, { horseFed: T0 + 600 })];
  let care = true, now = T0;
  const u = createUpkeep({ items: () => items, now: () => now, horseCare: () => (care ? HARD : null) });
  try {
    setGallopGate((mode, mods) => u.gallopGate(mode, mods));
    setCanRunOverride(null);
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), true, 'no mod ruling: the horse gallops on its breath');
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Cart), false, 'the cart never - DFU\'s own');
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Foot), true);
    setCanRunOverride(() => false);
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false, 'the mod says no (a town): no');
    setCanRunOverride(() => true);
    for (let i = 0; i < 400; i++) u.tick(0.1, { mode: 'Horse', galloping: true, moving: true });
    assert.equal(u.breathOf().winded, true);
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false, 'winded: no, whatever the mod allows');
    for (let i = 0; i < 400; i++) u.tick(0.1, { mode: 'Horse', moving: false });
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), true, 'its breath back');
    now = T0 + 600 + STARVING_AFTER;
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false, 'starving: no');
    care = false;
    assert.equal(u.gallopGate(TRANSPORT_MODES.Horse, true), null, 'off: no word');
    setCanRunOverride(null);
    assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false, 'off, no mod: DFU\'s own - no run in the saddle');
  } finally { setGallopGate(null); setCanRunOverride(null); }
  assert.match(rd('src/systems/transport.js'), /const mods = _canRun\?\.\(mode\) \?\? null;\n\s*return _gallop\?\.\(mode, mods\) \?\? mods \?\? !isRiding\(mode\);/);
});

test('STEED1 THE RIDE\'S PACE IN THE MOTOR: the ride base and the gallop times the horse\'s Speed (rideSpeedScale), the half-speed base with them; a scale that is no number is 1 (mutants: the walk scaled, the gallop unscaled, the half-speed base unscaled)', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-50, 0, -50, 50, 0, -50, 50, 0, 50, -50, 0, 50]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const m = new PlayerMotor(col, { speed: 50, running: 40, agility: 50, strength: 50, endurance: 50, willpower: 50, swimming: 0, climbing: 0 });
  m.spawn(0, 0.1, 0);
  const still = { forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false };
  for (let f = 0; f < 5; f++) m.update(1 / 60, still, 0);
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  const walk = m.speed;
  m.rideSpeedScale = 1.1;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(near(m.speed, walk), 'on foot nothing');
  m.transportMode = TRANSPORT_MODES.Horse;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(near(m.speed, rideSpeed(50, DF_RIDE_BASE) * 1.1), `the ride at its horse's pace (${m.speed})`);
  assert.ok(near(m._halfSpeedBase(), rideSpeed(50, DF_RIDE_BASE) * 1.1), 'and the half-speed base');
  setGallopGate(() => true);
  try {
    m.update(1 / 60, { ...still, forward: 1, run: true }, 0);
    assert.equal(m.isRunning, true);
    assert.ok(near(m.speed, runSpeed(50, 40, false, DF_RIDE_BASE) * 1.1), 'the gallop too');
    assert.ok(m.speed < 30, 'never past the hitch\'s jump (HITCH_JUMP_SPEED 30)');
  } finally { setGallopGate(null); }
  m.transportMode = TRANSPORT_MODES.Cart; m.rideSpeedScale = 0.7;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(near(m.speed, rideSpeed(50, DF_CART_BASE) * 0.7), 'the cart at its wagon\'s');
  m.rideSpeedScale = NaN;
  m.update(1 / 60, { ...still, forward: 1 }, 0);
  assert.ok(near(m.speed, rideSpeed(50, DF_CART_BASE)), 'no number: 1');
});

test('STEED1 THE RUNTIME: the ridden horse\'s breath by its seed, back whole over a span skipped; the HUD\'s bar (short winded, under a quarter or starving); the rider pays no gallop fatigue under horse care; winded and back said once each; a hungry mount said at the mount; the ride\'s pace off Speed, the wagon\'s off its team\'s Strength under its load (mutants: the bar\'s low, the skip, the words said every frame, the team\'s mean)', () => {
  const said = [];
  const h1 = horse(2, { horseFed: T0 + 600 }), h2 = horse(3, { horseFed: T0 + 600 });
  const items = [h1, h2, { group: 'Transportation', templateIndex: 93, wagonKind: 'openWagon', value: 9000 }];
  let now = T0, care = true;
  const u = createUpkeep({ items: () => items, now: () => now, horseCare: () => (care ? HARD : null), wagonUpkeep: () => false, say: (t) => said.push(t) });
  assert.equal(u.bar('Foot'), null);
  assert.deepEqual(u.bar('Horse'), { amount: 1, low: false });
  assert.equal(u.riderPaysGallop('Horse'), false, 'the horse pays the gallop in breath');
  assert.equal(u.riderPaysGallop('Foot'), true);
  for (let i = 0; i < 400 && !u.breathOf().winded; i++) u.tick(0.1, { mode: 'Horse', galloping: true, moving: true });
  assert.equal(said.filter((s) => s === STEED_TEXT.winded).length, 1, 'winded, said once');
  assert.equal(u.bar('Horse').low, true);
  now += SKIP_MINUTES;
  u.tick(0.016, { mode: 'Horse' });
  assert.deepEqual(u.breathOf(), { spent: 0, winded: false }, 'an hour skipped: its breath back');
  assert.equal(said.filter((s) => s === STEED_TEXT.rested).length, 1, 'and said');
  // the pace
  const st1 = bornStats(2), st2 = bornStats(3);
  assert.equal(u.rideScale('Horse'), steedSpeedScale(st1.speed), 'the first horse\'s Speed');
  assert.equal(u.rideScale('Cart', 1), teamDraftScale((st1.strength + st2.strength) / 2, 1), 'the pair\'s mean Strength under a full load');
  assert.equal(u.rideScale('Cart', 0), 1);
  care = false;
  assert.deepEqual([u.rideScale('Horse'), u.rideScale('Cart', 1), u.bar('Horse'), u.riderPaysGallop('Horse')], [1, 1, null, true], 'off: DFU\'s own');
  care = true;
  // mounted hungry: said once at the mount
  now = h1.horseFed + 60; said.length = 0;
  u.tick(0.016, { mode: 'Foot' });
  u.tick(0.016, { mode: 'Horse' }); u.tick(0.016, { mode: 'Horse' });
  assert.deepEqual(said.filter((s) => /hungry/.test(s)), ['Your horse is hungry.']);
  assert.equal(BREATH_LOW, 0.25);
});

test('STEED1 THE STABLE\'S ACTS: oats and an apple fed by hand - beside the horse alone, never at the stable; a horse chosen to ride is the pack\'s first, so its look, its breath and its stats are the ridden ones (mutants: the reach unread, the stabled refusal, the reorder)', () => {
  const a = horse(11, { horseFed: T0 - 60 }), b = horse(12, { horseFed: T0 - 60 });
  const items = [oats(2), a, apple(3), b];
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => HARD });
  assert.equal(u.act('feed', 0, { near: false }).text, STEED_TEXT.notHere);
  assert.equal(u.act('feed', 0, { stabled: true }).text, STEED_TEXT.stabled);
  const r = u.act('feed', 1, { who: 'Shadowmere' });
  assert.equal(r.ok, true); assert.match(r.text, /^Your horse eats oats/, 'the second horse is not the named one');
  assert.equal(b.horseBond, 30);
  assert.equal(u.act('treat', 0, { who: 'Shadowmere' }).text.startsWith('Shadowmere eats an apple'), true);
  const wagonLoad = [oats(4)];
  const u2 = createUpkeep({ items: () => items, now: () => T0, horseCare: () => HARD, stores: () => wagonLoad });
  assert.equal(u2.model().oats, 5, 'the wagon\'s load counted with the pack\'s');
  const m = u.model({ near: true, name: 'Shadowmere' });
  assert.deepEqual([m.oats, m.apples, m.horses.length, m.horses[0].name, m.horses[1].ridden], [1, 2, 2, 'Shadowmere', false]);
  assert.deepEqual(m.horses[0].stats.map((s) => s.key), STEED_STATS);
  assert.equal(m.horses[0].stats[0].born, bornStats(11).speed);
  assert.equal(activeHorseItem(items), a);
  items.splice(items.findIndex((x) => x.templateIndex === OATS_TEMPLATE), 1);   // the pack's oats spent
  b.horseFed = T0 - 60;
  assert.equal(u2.act('feed', 1).ok, true, 'none in the pack: the wagon\'s');
  assert.equal(wagonLoad[0].stackCount, 3);
  assert.deepEqual(u.act('ride', 1), { ok: true, text: 'You will ride that horse now.' });
  assert.equal(activeHorseItem(items), b, 'the chosen one ridden');
  assert.deepEqual(horsesIn(items), [b, a]);
  assert.equal(chooseRiddenHorse(items, 0).text, 'You already ride that horse.');
  assert.equal(chooseRiddenHorse(items, 5).ok, false);
  // the reach off the mod's runtime
  const rt = (o) => ({ stableView: () => ({ persistence: true, hasHorse: true, transport: TRANSPORT.Foot, horseMode: HORSE_MODE.LooseStationary, wagonMode: WAGON_MODE.WithPlayer, horseName: 'Ash', ...o.view }), canMountHorseFromTransportWindow: () => o.mount, canAccessWagonInventory: () => ({ allowed: o.wagon }) });
  assert.deepEqual(upkeepReach(rt({ mount: true, wagon: false }), true), { near: true, stabled: false, wagonNear: false, who: 'Ash' });
  assert.deepEqual(upkeepReach(rt({ mount: false, wagon: true, view: { horseMode: HORSE_MODE.WithPlayer, horseStabled: true } }), true), { near: false, stabled: true, wagonNear: true, who: 'Ash' });   // WAGON-STABLED (PIN MOVED): sent away
  assert.deepEqual(upkeepReach(rt({ mount: false, wagon: false }), false), { near: true, stabled: false, wagonNear: true, who: 'Your horse' }, 'the mod off: always beside');
});

test('STEED1 AN INVENTORY\'S USE: the Sack of Oats feeds the horse ridden - out of the list it was used from, the wagon\'s load too; under the switch alone (mutants: the pack read for the wagon\'s, the switch unread)', () => {
  const h = horse(21, { horseFed: T0 - 60 });
  const items = [h], wagon = [oats(2)];
  let care = true;
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => (care ? HARD : null) });
  registerUpkeepUses(u, { reach: () => ({ near: true, stabled: false, wagonNear: true, who: 'Your horse' }), pass: () => {}, horseCare: () => (care ? HARD : null), wagonUpkeep: () => WHARD });
  const use = itemUseHandler(UPKEEP_ITEM.Oats);
  assert.equal(use.usable(), true);
  const r = use(wagon[0], wagon);
  assert.equal(r.kind, 'upkeep'); assert.match(r.text, /eats oats/);
  assert.equal(wagon[0].stackCount, 1, 'out of the wagon\'s load');
  care = false;
  assert.equal(use(wagon[0], wagon), null); assert.equal(use.usable(), false);
});

test('STEED1 THE STABLE\'S HORSES: three a day, each born at the yard on the town\'s and the day\'s seed - every client the same three, another day another three; one the buyer owns not stood again; priced by what it is (1000 at a mean of 50, a fiftieth a point) while horses are cared for (mutants: the seed\'s stall unread, the owned kept, the price flat)', () => {
  assert.equal(STABLE_HORSES_OFFERED, 3);
  const a = stableHorses(4242, 100), b = stableHorses(4242, 100), c = stableHorses(4242, 101), d = stableHorses(4243, 100);
  assert.deepEqual(a.map((h) => h.horseSeed), b.map((h) => h.horseSeed), 'one town, one day: the same three');
  assert.equal(new Set(a.map((h) => h.horseSeed)).size, 3, 'three different horses');
  assert.notDeepEqual(a.map((h) => h.horseSeed), c.map((h) => h.horseSeed), 'the next day, three more');
  assert.notDeepEqual(a.map((h) => h.horseSeed), d.map((h) => h.horseSeed), 'the next town, its own');
  assert.ok(a.every((h) => h.templateIndex === 94 && h.maxCondition > 0), 'each minted as a shelf mints it');
  assert.deepEqual(stableHorses(4242, 100, { owned: [a[1].horseSeed] }).map((h) => h.horseSeed), [a[0].horseSeed, a[2].horseSeed], 'the one bought is not stood again');
  assert.equal(a[0].value, 1000, 'unpriced: the template\'s');
  const priced = stableHorses(4242, 100, { priced: true });
  for (const h of priced) assert.equal(h.value, steedValue(bornStats(h.horseSeed)));
  assert.equal(STEED_PRICE, 1000);
  assert.equal(steedValue({ speed: 50, stamina: 50, endurance: 50, strength: 50 }), 1000);
  assert.equal(steedValue({ speed: 60, stamina: 60, endurance: 60, strength: 60 }), 1200);
  assert.equal(steedValue({ speed: 20, stamina: 20, endurance: 20, strength: 20 }), 400, 'never under 400');
  // births the rows' look too (COATS1's), off the same stream
  const re = { group: 'Transportation', templateIndex: 94 };
  birthHorses([re], () => 0.5);
  assert.ok(re.horseSeed > 0);
});

test('STEED1 THE ITEM: `horseBond` (tenths, 1..1000) and `horseFed` (a minute, 1 up) on DFU\'s Horse alone; the bond the owner\'s mark, never carried to the next; the card says the horse\'s nature and its bond; the Sack of Oats a row the law knows, sold online only once its switch is on (mutants: the fields\' bounds, the law\'s list, the receiver\'s mark)', () => {
  assert.equal(validItemField('horseBond', 1000), 1000); assert.equal(validItemField('horseBond', 1001), undefined); assert.equal(validItemField('horseBond', 0), undefined);
  assert.equal(validItemField('horseFed', 1), 1); assert.equal(validItemField('horseFed', 0), undefined); assert.equal(validItemField('horseFed', 1.5), undefined);
  assert.deepEqual(itemFindings(horse(5, { horseBond: 420, horseFed: T0, value: 1000 })), []);
  assert.deepEqual(itemFindings({ group: 'Weapons', templateIndex: 113, horseBond: 30 }), ['horse']);
  assert.deepEqual(itemFindings({ group: 'Transportation', templateIndex: 93, horseFed: T0 }), ['horse']);
  // PIN MOVED (AUDIT STEED1): `horseFed` is a minute of its OWNER's character's clock - carried to a buyer a year behind
  // it came fed a year ahead (and one ahead, starving); so it is the owner's mark too, and the horse comes fed as a horse
  // first seen (NEW_HORSE_FED) - and a minute's grazing never makes an offered record mismatch its checkpoint
  assert.ok(RECEIVER_MARKS.includes('horseBond') && RECEIVER_MARKS.includes('horseFed'), 'the bond and the belly\'s clock its owner\'s');
  assert.ok(TRADE_VOLATILE_FIELDS.includes('horseFed'));
  const rows = itemStatRows(horse(77, { horseBond: 420 }));
  const born = bornStats(77);
  assert.deepEqual(rows.filter((r) => ['Speed', 'Stamina', 'Endurance', 'Strength', 'Bond'].includes(r.label)).map((r) => [r.label, r.text]),
    [['Speed', String(born.speed)], ['Stamina', String(born.stamina)], ['Endurance', String(born.endurance)], ['Strength', String(born.strength)], ['Bond', 'Familiar (42)']]);
  assert.match(itemStatRows(oats()).map((r) => r.text).join(' '), /A day’s food for a horse/);
  assert.deepEqual(UPKEEP_ITEM, { Oats: 1710, WagonKit: 1711 });
  assert.deepEqual(UPKEEP_ITEM_ROWS.map((r) => [r.index, r.name, r.rarity, r.stackable]), [[1710, 'Sack of Oats', 20, true], [1711, 'Wagon Repair Kit', 20, true]]);
  assert.equal(UPKEEP_ITEMS_ONLINE, true, 'UPKEEP-ONLINE: the templates shipped with #791 and every release since - online the yards sell them');
  assert.deepEqual([upkeepItemsAvailable(false), upkeepItemsAvailable(true)], [true, true]);
  assert.deepEqual(itemFindings({ ...oats(5), value: 4 }), []);
});

test('STEED1 THE SWITCH: a Features row of the World tab\'s Travel; the enhanced lane\'s alone. HORSE-TIERS (PIN MOVED): tiers on the one key, Boons the default, the player\'s online, read through the one accessor (test/systems/horsetiers.test.js holds the rest)', () => {
  const f = FEATURES.find((x) => x.id === 'horse-care');
  assert.deepEqual([f.group, f.kinds, f.control.store, f.control.key, f.control.initial, f.control.online], ['world', ['enhanced'], 'prefs', 'horseCare', 'boons', 'player']);
  assert.match(rd('src/systems/upkeep/upkeepSwitch.js'), /export const horseCareRules = \(\) => \(isEnhanced\(\) \? horseCareRulesForTier\(horseCareTierOfStored\(getPref\(HORSE_CARE_PREF\)\)\) : null\);/);
  assert.match(rd('src/ui/settings/settingsMap.js'), /"feat:mod-horse-cart-and-cargo", "feat:horse-care", "feat:wagon-upkeep"\]/);
});

test('STEED1 THE STABLE PAGE: each horse its card - its bond and hunger in words, the ridden one\'s breath, four stats with the bond\'s share beside, Feed oats and Give an apple (dark with none, full or away), Ride this one on every other (mutants: a horse dropped, the acts unwired)', async () => {
  globalThis.document = undefined;
  const { drawStablePage, stableProviderFor, setHoldingsProvider, resetHoldingsPages, _setHoldingsIconForTests } = await import('../../src/ui/holdingsPages.js');
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  const fakeEl = (tag) => {
    const classes = new Set();
    const n = { tag, children: [], attrs: {}, title: '', isConnected: true,
      classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
      get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
      _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; } };
    return n;
  };
  const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (t) => el('h4', 'px-divider', t), meter: (now, max) => el('div', 'px-meter', `${Math.round(now)}/${max}`) };
  const buttons = (root, label) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent.startsWith(label)) out.push(c); walk(c); } }; walk(root); return out; };
  const a = horse(31, { horseFed: T0 - 60, horseBond: 400 }), b = horse(32, { horseFed: T0 + 600 });
  const items = [a, b, oats(2)];
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => HARD });
  setHoldingsProvider(stableProviderFor({ runtime: null, on: () => false, hasHorse: () => true, hasCart: () => false, items: () => items, upkeep: u }));
  resetHoldingsPages();
  const draw = () => { const d = el('div', 'px-qdetail'); drawStablePage(d, () => {}, kit); return d; };
  let d = draw();
  assert.match(d.textContent, /Familiar - bond 40 of 100, \+8 to every stat\. Hungry/);
  assert.match(d.textContent, /Breath/);
  assert.match(d.textContent, /Another horse of yours/);
  for (const k of ['Speed', 'Stamina', 'Endurance', 'Strength']) assert.equal((d.textContent.match(new RegExp(k, 'g')) ?? []).length >= 2, true, `${k} on both cards`);
  assert.equal(buttons(d, 'Feed oats (2)').length, 2);
  assert.equal(buttons(d, 'Give an apple (0)')[0].attrs['aria-disabled'], 'true', 'no apples: dark');
  assert.equal(buttons(d, 'Ride this one').length, 1, 'the other horse alone');
  buttons(d, 'Feed oats')[0].onclick();
  d = draw();
  assert.match(d.textContent, /Your horse eats oats\. Your bond grows \(Familiar\)\./);
  assert.equal(a.horseBond, 430);
  buttons(d, 'Ride this one')[0].onclick();
  assert.equal(activeHorseItem(items), b);
  setHoldingsProvider(null);
});

test('STEED1 THE HOSTS (world.js, exterior.js): the upkeep built before the mod\'s runtime, the gallop gate set, the oats\' and the kit\'s Use registered; the motor handed its pace before its step, the frame\'s upkeep after the surface (the odometer\'s metres); a gallop under horse care no rider\'s fatigue; the HUD handed the horse\'s breath; the Stable page the upkeep and the clock\'s door. THE FOUR HOSTS: worldModes.js and dungeonContext.js stand no transport - a building or a dungeon puts the rider on foot (transport.js dismountOnTransition) - and are named, not wired (bible/06-Systems/Horse-Care.md)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.ok(s.indexOf('const upkeep = createUpkeep({') > 0 && s.indexOf('const upkeep = createUpkeep({') < s.indexOf('const hccRuntime = createHorseCartRuntime({'), `${host}: before the runtime`);
    assert.match(s, /horseCare: horseCareRules, wagonUpkeep: wagonUpkeepRules,\n\s*where: \(\) => horseWhereOf\(hccRuntimeOn\(\)\?\.stableView\(\) \?\? null\),/, host);   // HORSE-TIERS / WAGON-TIERS (PIN MOVED): the one accessor each
    assert.match(s, /setGallopGate\(\(mode, mods\) => upkeep\.gallopGate\(mode, mods\)\);\n\s*registerUpkeepUses\(upkeep, \{/, host);
    assert.match(s, /player\.rideSpeedScale = upkeep\.rideScale\(player\.transportMode, wagonLoadShare\(\)\);[^\n]*\n\s*playerBlowFrame\(\{ motor: player,[^\n]*\n\s*if \(_overlayHeld[^\n]*player\.holdFrame\(\);/, `${host}: the pace before the step (and before its blow frame - TELL6e's and DISC8-G's order kept)`);
    assert.match(s, /_surfPath = !!_surf\.path;\n[\s\S]{0,400}?const odo = player\.odometer\?\.h \?\? 0, metres = _upkeepOdo == null \? 0 : Math\.max\(0, odo - _upkeepOdo\);/, `${host}: the metres off the odometer, after the surface`);
    assert.match(s, /const galloping = !_overlayHeld && mode === TRANSPORT_MODES\.Horse && !!player\.isRunning && !player\.standing;\n\s*upkeep\.tick\(gamePaused\(\) \? 0 : dt, \{\n\s*mode, galloping, moving: !player\.standing,/, host);   // STEED-UI: the gallop named once, for the upkeep and the saddle panel
    assert.match(s, /running: player\.isRunning && !player\.standing && upkeep\.riderPaysGallop\(player\.transportMode\),/, `${host}: the gallop the horse's breath`);
    assert.match(s, /steed: [^\n]*upkeep\.bar\(player\.transportMode\) : null,/, `${host}: the HUD's bar`);
    assert.match(s, /upkeep, pass: upkeepPass \}\),/, `${host}: the Stable page's upkeep and its hour`);
    assert.match(s, /const upkeepPass = \(n\) => \{ playerTicker\.advance\(n\); runEncounterTick\(/, `${host}: the hour, one home - the Stable page's, the kit's Use, the saddle panel's (STEED-UI)`);
  }
  assert.match(rd('src/ui/hud/hud.js'), /drawGripBar\(renderer, canvas, art, grip \?\? steed, s\);/, 'the classic HUD: the horse\'s breath in the grip\'s place');
  assert.match(rd('src/ui/enhanced/enhancedHud.js'), /const gr = opts\.grip \?\? opts\.steed \?\? null;\n\s*const gripWord = opts\.grip \? 'Grip' : 'Horse';/, 'the enhanced HUD: under the horse\'s word');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.equal(/upkeep\.(tick|rideScale|bar)\(/.test(rd(host)), false, `${host}: no transport indoors`);
  assert.match(rd('src/systems/transport.js'), /dismountOnTransition = \(mode, transition\) =>\n\s*\(transition === 'ToBuildingInterior' \|\| transition === 'ToDungeonInterior' \? TRANSPORT_MODES\.Foot : mode\);/);
});

test('AUDIT STEED1 THE KEEP\'S CLOCK: a load and a new character start it afresh (upkeep.reset, at every door the hosts load through), and so does the switch turned off - a horse is never fed back the span from a minute another character, or another session, last kept it (mutants: AUDIT-STEED1-off-keeps-clock, AUDIT-STEED1-load-no-reset)', () => {
  let t = T0, on = true;
  const h = horse(12, { horseFed: T0 + 60 });
  const items = [h, oats(9)];
  const said = [];
  const u = createUpkeep({ items: () => items, now: () => t, horseCare: () => (on ? HARD : null), say: (l) => said.push(l) });
  u.tick(0.016, {});
  // the switch off six days, then on: nothing kept meanwhile, nothing to catch up
  on = false; t = T0 + 6 * MINUTES_A_DAY; u.tick(0.016, {});
  on = true; t += 1; u.tick(0.016, {});
  assert.equal(items[1].stackCount, 9, 'no sack eaten for the days the switch was off');
  // a load six days on: reset - its first frame keeps from now
  u.tick(0.016, {});
  u.reset();
  t += 6 * MINUTES_A_DAY;
  u.tick(0.016, {});
  assert.equal(items[1].stackCount, 9, 'no sack eaten back across the load');
  assert.deepEqual(said.filter((l) => /ate|sack/i.test(l)), [], 'and none said');
  const world = rd('src/scenes/world.js');
  assert.match(world, /hccRuntime\.handleStartLoad\(\);[^\n]*\n\s*wagonRiders\?\.clear\(\);[^\n]*\n\s*upkeep\.reset\(\);/, 'the load\'s OnStartLoad (after WAGONS2\'s riders)');
  assert.ok(world.includes('horseCartLoad: (rec) => { hccRuntime.handleStartLoad(); upkeep.reset();'), 'a same-dungeon load');
  assert.ok(world.includes('  if (!_loadedGame) upkeep.reset();'), 'a new character');
});
