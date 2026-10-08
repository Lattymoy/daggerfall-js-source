// MERC-CAP (FIELD BUGS 2026-09-29f, ValenValarys on Discord, MERC-RISE's reporter again): "Right now, I'm trading with
// 346 Mercantile ... I feel like no matter how much someone exploits, there should at least be some kind of soft cap or
// hard cap in place. Having to pay gold just to sell items feels a bit too punishing!"
//
// CalculateTradePrice turns a Mercantile or a Personality of 0..100 into a factor of 128..256 in 256
// (FormulaHelper.cs:1992-2000), and DFU never bounds the Mercantile it reads (DaggerfallSkills.cs:140, "TODO: Any other
// clamping or processing") - Enhances Skill pieces and the rarity affixes stack it past 100, and there the buying arm
// runs through 0 at 200 and the ask is nothing by 233 (Personality 100). MERC-RISE's online half followed the seller's
// own ask past 100, so a sale fell with the skill there and then went under nothing: at the field's counter (quality 5,
// a lot costing 17397) a seller at 346 was offered -2311 gold, and the sale's addGold took it from the purse. Every
// purchase fell with it - the counter's gold a piece, a room and a cure free and then paying the buyer. Online the
// haggle reads its own range now, 0 to 100; offline, DFU's reads stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTradePrice, calculateCost, ONLINE_SALE_SHARE, ONLINE_HAGGLE_MAX, essentialPrice } from '../src/systems/shopStock.js';
import { getTradePrice } from '../src/systems/tradeModes.js';
import { rentalDecision } from '../src/systems/tavern.js';
import { cureDiseaseOffer } from '../src/systems/guildServiceActions.js';
import { GUILDS } from '../src/systems/guilds.js';
import { SKILLS } from '../src/systems/skills.js';
import { startDisease } from '../src/systems/diseases.js';

const price = (cost, q, m, p, selling, online) => calculateTradePrice(cost, q, { mercantile: m, personality: p }, selling, { online });
const sale = (cost, q, m, p, online = true) => price(cost, q, m, p, true, online);
const ask = (cost, q, m, p, online = true) => price(cost, q, m, p, false, online);
/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function onlinePage(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    return fn();
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
}
const [Q, COST] = [5, 17397];   // the field's counter and lot (MERC-RISE, Field-Bugs-2026-09-29d)

test('MERC-CAP: the field\'s seller at 346 Mercantile - offered -2311 gold for the lot, now what the best haggler is paid', () => {
  // the root, in DFU's own numbers (offline, where they stand): past 100 the ask keeps falling, and at 346 it is under nothing
  assert.equal(ask(COST, Q, 100, 100, false), 5436);
  assert.equal(ask(COST, Q, 346, 100, false), -4622);
  // MERC-RISE's half of that ask - the offer the field was made, which the sale's addGold took from the purse
  assert.equal(Math.min(sale(COST, Q, 346, 100, false), Math.floor(ask(COST, Q, 346, 100, false) * ONLINE_SALE_SHARE)), -2311);
  // online now: past 100 the haggle reads 100, so every seller dressed past it is paid the counter's own figure
  for (const m of [100, 105, 150, 233, 346, 1000]) assert.equal(sale(COST, Q, m, 100), 2718, `Mercantile ${m}`);
  // through the trade window's own door, both ways
  onlinePage(() => {
    assert.equal(getTradePrice('Sell', COST, Q, { mercantile: 346, personality: 100 }), 2718);
    assert.equal(getTradePrice('Buy', COST, Q, { mercantile: 346, personality: 100 }, 6), 5436, 'what the counter asks the best haggler - not a gold a piece');
  });
});

test('MERC-CAP: online the haggle reads 0..100 - a sale never falls with a skill or goes under nothing, no price is under the best haggler\'s, P0.4 holds for every seller, and inside the range nothing moves', () => {
  assert.equal(ONLINE_HAGGLE_MAX, 100, 'DFU\'s maximum skill and stat');
  let checked = 0;
  for (let q = 0; q <= 20; q++) {
    for (const cost of [7, 120, 777, 17397, 250000]) {
      const least = ask(cost, q, 100, 100, false);   // the best haggler's ask, Daggerfall's own
      const half = Math.floor(least * ONLINE_SALE_SHARE);
      for (const p of [-150, 0, 50, 100, 130]) {
        let last = -1;
        for (let m = -400; m <= 1000; m += 5) {
          const [s, a] = [sale(cost, q, m, p), ask(cost, q, m, p)];
          const [mm, pp] = [Math.min(Math.max(m, 0), 100), Math.min(Math.max(p, 0), 100)];
          const at = `q${q} cost${cost} m${m} p${p}`;
          assert.ok(s >= 0 && s >= last, `${at}: sells for ${s}, ${last} a step below`);
          assert.ok(a >= least, `${at}: asks ${a}, under the best haggler's ${least}`);
          assert.ok(s <= Math.floor(a * ONLINE_SALE_SHARE), `${at}: pays ${s} against an ask of ${a}`);
          // past either end the haggle reads the end; inside the range it is Daggerfall's, under MERC-RISE's half -
          // PIN MOVED (MERC-SLOPE, FIELD BUGS 2026-10-08): where the seller's own offer stands against the best haggler's,
          // at half its strength, under that half and never over Daggerfall's own offer
          assert.equal(a, ask(cost, q, mm, pp, false), at);
          const off = sale(cost, q, mm, pp, false), top = sale(cost, q, 100, 100, false);
          assert.equal(s, top > 0 ? Math.floor(half * (0.5 + (0.5 * Math.min(off, top)) / top)) : Math.min(off, half), at);
          assert.ok(s <= off, `${at}: never over Daggerfall's own offer (${s} against ${off})`);
          last = s;
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 30000, `${checked}`);
});

test('MERC-CAP: the purchases the haggle prices past the counter - a room, a cure - are never free or a payment to the buyer online; offline, DFU\'s reads stand', () => {
  const skills = (m) => ({ mercantile: m, personality: 100 });
  const DAY = { dayOfYear: 100 };
  const room = (m) => rentalDecision('30', { date: DAY, quality: 10, skills: skills(m) }).price;
  const diseased = (m) => {
    const e = {
      name: 'Valen', isPlayer: true, level: 20, health: 30, maxHealth: 30, goldPieces: 0, items: [],
      skills: { ...Object.fromEntries(Object.values(SKILLS).map((s) => [s, 50])), [SKILLS.Mercantile]: m },
      stats: { personality: 100 }, activeEffects: [],
    };
    startDisease(e, 0, 0, () => 0);
    return e;
  };
  const cure = (m) => cureDiseaseOffer(diseased(m), GUILDS.FightersGuild, null, { quality: 10 }).cost;
  // offline, Daggerfall's own: the 30 nights and the cure at 346 cost under nothing, and deductGold (DeductGoldAmount)
  // pays such a price to the buyer - put to Mac (Field-Bugs-2026-09-29f)
  // SOFTCAP3 (Master Skills): the cure reads the healer's customer through the LIVE skill, which is 100 for an unmastered
  // Mercantile - so offline the cure at 346 costs what 100 costs, not under nothing. The room is priced off a bare
  // skills bag (no entity to cap), and still reads Daggerfall's unbounded formula offline.
  assert.ok(room(346) < 0, `${room(346)}`);
  assert.equal(cure(346), cure(100));
  assert.ok(cure(346) > 0, `${cure(346)}`);
  assert.ok(calculateTradePrice(calculateCost(250, 10), 10, skills(346), false, { online: false }) < 0, 'the raw formula at 346 is still under nothing');
  onlinePage(() => {
    for (const m of [101, 200, 233, 346]) {
      assert.equal(room(m), room(100), `the room at Mercantile ${m}`);
      assert.equal(cure(m), cure(100), `the cure at Mercantile ${m}`);
    }
    assert.ok(room(100) > 0 && cure(100) > 0, `${room(100)} and ${cure(100)}`);
    // ESSENTIALS-HALF (2026-09-30): online a cure costs half the best haggler's own price (shopStock.js essentialPrice)
    assert.equal(cure(100), essentialPrice(calculateTradePrice(calculateCost(250, 10), 10, skills(100), false, { online: false }), { online: true }), 'the best haggler\'s own price, halved - inside the range nothing else moves');
  });
});
