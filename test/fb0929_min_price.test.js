// FB0929 (2026-09-29, Discord #bug-reports, lumin, relayed by Mac): "Vendors selling items for 0 gold. Some cheap items
// like bandages are selling for 0 gold from vendors in some instances. There should be a hard minimum of 1 gold for
// anything."
//
// Daggerfall's own law, ported verbatim: CalculateCost floors a piece at 2 gold (1 after a Buy-mode holiday's halving)
// and CalculateTradePrice's buying arm (FormulaHelper.cs:2000) scales the lot's cost by 66/256 to 256/256 and
// truncates. A piece worth 1 or 2 - a bandage, a candle, the General Store's parchment (a template worth 0), a
// Climates & Calories apple - went for NOTHING wherever the haggle fell under 128/256: a poor counter, a province
// under the 1000 pivot, a practised haggler. Mac's call: a purchase asks a gold a piece at least (Port-Ledger A).
// The sale is left Daggerfall's offline and REALM P0.4's online, and the pins below say why that side must not move.
import './modsOff.js';   // MO1: Daggerfall's own shelves and haggle - the one mod a case needs is switched on in it
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { modsOff } from './modsOff.js';
import { withDom } from './invdrag.mjs';
import { stockShopShelf, calculateTradePrice, ONLINE_SALE_SHARE } from '../src/systems/shopStock.js';
import { tradeCost, getTradePrice, MIN_PRICE_PER_PIECE } from '../src/systems/tradeModes.js';
import { BANDAGE_TEMPLATE } from '../src/systems/rriRealism.js';
import { RRI_VENDOR } from '../src/systems/rriItems.js';
import { onShopShelfStocked } from '../src/systems/rriKits.js';
import { setModSetting } from '../src/systems/modSettings.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { SURVIVAL_PREF } from '../src/systems/survival/switch.js';
import { HOLIDAYS } from '../src/systems/holidays.js';
import { GUILDS } from '../src/systems/guilds.js';
import { reducedRepairCost } from '../src/systems/guildServices.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { yardStock } from '../src/systems/merchantYards.js';   // MERCHANT-YARDS: the horse is the Stable's now
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A source file with its comments gone (disc25f_stack_split.test.js's reading). */
const code = (p) => rd(p).replace(/\/\*[^]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const SKILLS = Object.freeze({ mercantile: 50, personality: 50 });
const HAGGLER = Object.freeze({ mercantile: 100, personality: 100 });
/** A shop's shelf from its own producer, every stock roll a yes (DaggerfallLoot's Dice100 at 0). */
const shelfOf = (buildingType, quality) => stockShopShelf({ buildingType, quality }, {}, { rolls: () => 0, torchesFromItems: false });
const bandageOf = (shelf) => shelf.find((it) => it.templateIndex === BANDAGE_TEMPLATE);
/** Roleplay & Realism: Items as shipped (bandaging on), the General Store's shelf through the mod's OnLootSpawned -
 *  the host's own producer chain (worldModes.js: onShopShelfStocked(stockShopShelf(...), b)) - at quality 16, whose
 *  bandage stack is Range(1, 16 / 2) at its top: seven. */
const STACK_Q = 16;
const rriShelf = () => onShopShelfStocked(shelfOf(BUILDING_TYPES.GeneralStore, STACK_Q),
  { buildingType: BUILDING_TYPES.GeneralStore, quality: STACK_Q }, { rolls: () => 0.999 });
/** The counter the stack is bought at: that shop, a province at 750, a master haggler - 114/256. */
const STACK_CTX = Object.freeze({ quality: STACK_Q, priceAdjustment: 750, skills: HAGGLER });

test('FB0929: reproduced - a bandage off the General Store\'s own shelf went for nothing; the counter asks a gold a piece now', () => {
  const bandage = bandageOf(shelfOf(BUILDING_TYPES.GeneralStore, 10));
  assert.ok(bandage, 'the General Store shelves bandages (UselessItems2, chance 0x32)');
  assert.equal(bandage.value, 2, 'SetItem: the template\'s basePrice');
  // a quality-1 counter in a province under the 1000 pivot, an ordinary haggler: CalculateCost's floor (one gold
  // after the region, doubled) and the buying haggle's 100/256 of it
  const ctx = { quality: 1, priceAdjustment: 750, skills: SKILLS };
  const lot = tradeCost('Buy', [bandage], ctx);
  assert.deepEqual(lot, { cost: 2, modeActionEnabled: true, pieces: 1 });
  assert.equal(calculateTradePrice(lot.cost, 1, SKILLS, false), 0, 'Daggerfall\'s own price: nothing (FormulaHelper.cs:2000)');
  assert.equal(getTradePrice('Buy', lot.cost, 1, SKILLS, lot.pieces), 1, 'the counter asks a gold');
  assert.equal(MIN_PRICE_PER_PIECE, 1);
  // a caller with no walk to count still never asks nothing for something - and nothing for nothing
  assert.equal(getTradePrice('Buy', lot.cost, 1, SKILLS), 1);
  assert.equal(getTradePrice('Buy', 0, 1, SKILLS), 0);
});

test('FB0929: every piece on the cheap shelves - parchment worth 0 and Climates & Calories\' apple among them - asks a gold a piece at every quality, province and haggler, and Daggerfall\'s own price wherever that is more', () => {
  const SHOPS = [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop, BUILDING_TYPES.ClothingStore, BUILDING_TYPES.Alchemist];
  setPref(SURVIVAL_PREF, 'casual');   // SURV2: the General Store's provisions shelf, the apple at a gold
  const seen = new Set();
  let floored = 0, daggerfalls = 0;
  try {
    for (let q = 1; q <= 20; q++) {
      const shelf = SHOPS.flatMap((bt) => shelfOf(bt, q));
      for (const it of shelf) seen.add(it.name);
      for (const priceAdjustment of [250, 750, 1000, 4000]) {
        for (const mercantile of [0, 50, 100]) {
          for (const personality of [0, 50, 100]) {
            const skills = { mercantile, personality };
            for (const it of shelf) {
              const lot = tradeCost('Buy', [it], { quality: q, priceAdjustment, skills });
              const own = calculateTradePrice(lot.cost, q, skills, false);
              const price = getTradePrice('Buy', lot.cost, q, skills, lot.pieces);
              const at = `${it.name} x${lot.pieces} q${q} adj${priceAdjustment} m${mercantile} p${personality}`;
              assert.ok(price >= lot.pieces, `a gold a piece: ${at} asked ${price}`);
              if (own >= lot.pieces) { assert.equal(price, own, `Daggerfall's own where it is more: ${at}`); daggerfalls++; } else floored++;
            }
          }
        }
      }
    }
  } finally {
    setPref(SURVIVAL_PREF, false);
  }
  for (const name of ['Bandage', 'Candle', 'Parchment', 'Sandals', 'Apple']) assert.ok(seen.has(name), `${name} was on a shelf`);
  assert.ok(floored > 0 && daggerfalls > floored, `both arms reached: ${floored} floored, ${daggerfalls} Daggerfall's`);
});

test('FB0929: a stack pays a gold a piece - Roleplay & Realism: Items\' shelf of bandages, whole and at the Merchants Festival\'s half', () => {
  setModSetting(RRI_VENDOR, 'Enabled', true);
  try {
    const bandages = bandageOf(rriShelf());
    assert.equal(bandages.stackCount, 7, 'StackableBandages_OnLootSpawned: Range(1, 16 / 2) at its top');
    const lot = tradeCost('Buy', [bandages], STACK_CTX);
    assert.deepEqual(lot, { cost: 14, modeActionEnabled: true, pieces: 7 }, 'CalculateCost\'s 2 a piece, times the stack');
    assert.equal(calculateTradePrice(lot.cost, STACK_Q, HAGGLER, false), 6, 'Daggerfall: seven bandages for six gold');
    assert.equal(getTradePrice('Buy', lot.cost, STACK_Q, HAGGLER, lot.pieces), 7, 'seven gold');
    // the Merchants Festival halves the lot (:444-449); the floor counts the pieces, not the halved cost
    const fest = tradeCost('Buy', [bandages], { ...STACK_CTX, holidayId: HOLIDAYS.Merchants_Festival });
    assert.deepEqual([fest.cost, calculateTradePrice(fest.cost, STACK_Q, HAGGLER, false)], [7, 3]);
    assert.equal(getTradePrice('Buy', fest.cost, STACK_Q, HAGGLER, fest.pieces), 7);
    // the lot is haggled ONCE, as DFU haggles it (GetTradePrice over UpdateCostAndGold's total): the floor is the
    // LOT's pieces, and a lot dearer than that is Daggerfall's own number - so a cheap piece beside a horse rounds
    // into the horse's price like any piece of a lot (the reason the SALE is not floored). PIN MOVED (MERCHANT-YARDS,
    // 2026-10-10): the horse was the General Store shelf's own; it is the Stable's now, minted as a shelf mints it
    const shelf = rriShelf();
    const horse = yardStock('stable')[0];
    const candle = shelf.find((it) => it.name === 'Candle');
    const price = (lot) => { const w = tradeCost('Buy', lot, STACK_CTX); return getTradePrice('Buy', w.cost, STACK_Q, HAGGLER, w.pieces); };
    assert.equal(price([candle]), 1, 'a candle alone: a gold');
    assert.equal(price([horse, candle]), price([horse]), 'beside the horse it adds nothing - the lot\'s rounding');
    const both = tradeCost('Buy', [horse, bandages], STACK_CTX);
    assert.equal(both.pieces, 8);
    assert.equal(price([horse, bandages]), calculateTradePrice(both.cost, STACK_Q, HAGGLER, false), 'Daggerfall\'s lot price');
    assert.ok(price([horse, bandages]) < price([horse]) + price([bandages]), 'the stack rides the horse\'s rounding too');
  } finally {
    modsOff();
  }
});

/** The counter's hooks (nativetrade.test.js's shape) over one shelf, recording each commit's mode, pieces and price. */
function counter(shelf, ctx) {
  const committed = [];
  let gold = 1000;
  return {
    mode: 'Buy', committed, shelf,
    shelfItems: () => shelf, packItems: () => [], accepts: () => true, enchanted: () => false,
    priceCtx: () => ctx,
    gold: () => gold,
    rows: () => [{ text: 'I can sell for no less than %a gold pieces.', center: true }],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: (m, staged, price) => {
      committed.push({ m, pieces: staged.reduce((n, it) => n + (it.stackCount ?? 1), 0), price });
      gold -= price;
      for (const it of staged) { const i = shelf.indexOf(it); if (i >= 0) shelf.splice(i, 1); }
    },
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  };
}
const REMOTE_SLOT0 = [290, 48 + 20];
const MODE_ACTION = [226 + 15, 134 + 7];
/** The price the offer box quotes back (%a, TEXT.RSC 260's "no less than %a gold pieces"). */
const quoted = (text) => Number(/no less than (\d+) gold/.exec(text)?.[1]);

test('FB0929: the classic counter offers and charges the floored price - a bandage, one split off a stack, and the rest of the stack', () => {
  // Daggerfall's own shelf: one bandage, at the reproduction's counter
  const one = counter([bandageOf(shelfOf(BUILDING_TYPES.GeneralStore, 10))], { quality: 1, priceAdjustment: 750, skills: SKILLS });
  const w = new NativeTradeWindow(one);
  w.click(...REMOTE_SLOT0);
  assert.equal(w.basket.length, 1, 'staged');
  w.click(...MODE_ACTION);
  assert.equal(w.box.buttons, 'YesNo');
  assert.deepEqual([w.box.price, quoted(w.box.rows[0].text)], [1, 1], 'the offer says a gold, and means it');
  w.input('KeyY');   // Yes: the box goes, then the deal (_dismissBox)
  assert.deepEqual(one.committed, [{ m: 'Buy', pieces: 1, price: 1 }], 'and a gold is what it charges');

  setModSetting(RRI_VENDOR, 'Enabled', true);
  try {
    const h = counter([bandageOf(rriShelf())], STACK_CTX);
    const ws = new NativeTradeWindow(h);
    // the how-many box (DISC25-F): one off the stack of seven
    ws.input('ControlLeft');
    ws.click(...REMOTE_SLOT0);
    ws.inputBox.value = '1';
    ws.input('Enter');
    ws.keyup('ControlLeft');
    assert.deepEqual([ws.basket[0].stackCount, h.shelf[0].stackCount], [1, 6]);
    ws.click(...MODE_ACTION);
    assert.deepEqual([ws.box.price, quoted(ws.box.rows[0].text)], [1, 1], 'one bandage: Daggerfall\'s 0, a gold');
    ws.input('KeyY');
    // the six left: CalculateCost 12, Daggerfall's five
    ws.click(...REMOTE_SLOT0);
    ws.click(...MODE_ACTION);
    assert.deepEqual([ws.box.price, quoted(ws.box.rows[0].text)], [6, 6], 'six bandages: six gold');
    ws.input('KeyY');
    assert.deepEqual(h.committed, [{ m: 'Buy', pieces: 1, price: 1 }, { m: 'Buy', pieces: 6, price: 6 }]);
  } finally {
    modsOff();
  }
});

/** The first node under `root` matching `sel`, reading `text` if given (disc25f_stack_split.test.js's). */
const find = (root, sel, text = null) => root.querySelectorAll(sel).find((n) => text == null || n.textContent === text) ?? null;

test('FB0929: the enhanced counter quotes, offers and charges the one floored price', () => {
  setModSetting(RRI_VENDOR, 'Enabled', true);
  try {
    withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const h = counter([bandageOf(rriShelf())], STACK_CTX);
      const view = mountEnhancedTrade(host, h);
      const row = host.querySelectorAll('.itemrow').find((r) => /Bandage/.test(r.querySelector('.itemname')?.children?.[0]?.textContent ?? ''));
      row.onclick({ timeStamp: 1000 });   // one click: the strip's quote
      assert.equal(find(host, '.trade-quote')?.textContent, 'Buy for 7 gold', 'the quote is the lot\'s price - Daggerfall\'s 6, floored');
      find(host, '.act.primary', 'Buy').onclick();   // the pending selection, into the basket
      find(host, '.act.primary', 'Buy').onclick();   // the mode action: ShowTradePopup
      const said = find(host, '.sb-ask').querySelectorAll('.px-note').map((n) => n.textContent);
      assert.deepEqual(said.map(quoted), [7], 'the offer says the quote');
      find(host, '.act.primary', 'Yes').onclick();
      assert.deepEqual(h.committed, [{ m: 'Buy', pieces: 7, price: 7 }], 'and charges it');
      view.unmount();
    });
  } finally {
    modsOff();
  }
});

/** Every call of `name(` in a text, its whole argument list (parens matched), a declaration's excepted. */
function callsOf(text, name) {
  const out = [];
  for (let at = text.indexOf(`${name}(`); at >= 0; at = text.indexOf(`${name}(`, at + 1)) {
    if (/function\s+$/.test(text.slice(Math.max(0, at - 12), at))) continue;
    let i = at + name.length + 1;
    for (let depth = 1; i < text.length && depth > 0; i++) depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0;
    out.push(text.slice(at, i));
  }
  return out;
}

test('FB0929: one law at every counter - the keyed shelf and repair rows price through the walk and GetTradePrice, and every GetTradePrice call hands the walk\'s pieces', () => {
  const wm = code('src/scenes/worldModes.js');
  const fn = (name) => { const at = wm.indexOf(`function ${name}(`); return wm.slice(at, wm.indexOf('\n  }\n', at)); };
  assert.match(fn('buyPrice'), /const lot = tradeCost\('Buy', \[it\], /, 'the keyed shelf (the fallback with no ARENA2)');
  assert.match(fn('buyPrice'), /return getTradePrice\('Buy', lot\.cost, /);
  assert.match(fn('repairPrice'), /const lot = tradeCost\('Repair', \[it\], /, 'the keyed repair list');
  assert.match(fn('repairPrice'), /return getTradePrice\('Repair', lot\.cost, /);
  for (const f of ['buyPrice', 'repairPrice']) assert.doesNotMatch(fn(f), /calculateTradePrice|calculateCost|calculateItemRepairCost/, `${f} keeps no copy of the haggle`);
  const calls = [];
  for (const f of readdirSync(new URL('../src/', import.meta.url), { recursive: true })) {
    if (!f.endsWith('.js') || !rd(`src/${f}`).includes('getTradePrice(')) continue;
    for (const c of callsOf(code(`src/${f}`), 'getTradePrice')) calls.push([f, c]);
  }
  assert.ok(calls.length >= 6, `the classic offer, the enhanced quote, offer and quick sale, the two keyed rows: ${calls.length}`);
  for (const [f, c] of calls) assert.match(c, /,\s*(?:lot\.)?pieces\)$/, `${f}: ${c}`);
});

test('FB0929: the sale is not floored - Daggerfall\'s offline, at most half the floored asking price online; the floor only raises an ask, so the loop that bought a bandage for nothing and sold it back for a gold nets nothing', () => {
  const bandage = bandageOf(shelfOf(BUILDING_TYPES.GeneralStore, 10));
  const ctx = { quality: 1, priceAdjustment: 750, skills: SKILLS };
  const ask = tradeCost('Buy', [bandage], ctx);
  const bid = tradeCost('Sell', [bandage], ctx);
  assert.equal(bid.pieces, 0, 'the sale counts no pieces');
  // THE LOOP THE FLOOR CLOSES, offline: this counter asked nothing and paid a gold back - REALM P0.4's inverted spread,
  // at a gold a turn, with the goods landing back on the shelf (T2) for the next one
  assert.deepEqual([calculateTradePrice(ask.cost, 1, SKILLS, false), getTradePrice('Sell', bid.cost, 1, SKILLS, bid.pieces)], [0, 1]);
  assert.equal(getTradePrice('Buy', ask.cost, 1, SKILLS, ask.pieces), 1, 'a gold in, a gold out: nothing made');
  // A SALE FLOOR WOULD MINT, so there is none: a raw seller at a quality-20 counter is offered Daggerfall's nothing
  const bid20 = tradeCost('Sell', [bandage], { quality: 20 });
  assert.equal(getTradePrice('Sell', bid20.cost, 20, { mercantile: 5, personality: 5 }, bid20.pieces), 0);
  // Identify keeps its cost: the Witches Festival's free identification is DFU's design (:1935-1955), not a truncation
  assert.equal(getTradePrice('Identify', 0, 10, SKILLS, 1), 0);

  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    assert.equal(getTradePrice('Sell', bid.cost, 1, SKILLS, bid.pieces), 0, 'online a counter asking a gold pays half of it: nothing');
    let checked = 0;
    for (let q = 1; q <= 20; q += 3) {
      const cheap = shelfOf(BUILDING_TYPES.GeneralStore, q).filter((it) => it.value <= 3);
      for (const priceAdjustment of [250, 750, 1000]) {
        for (const skills of [{ mercantile: 0, personality: 0 }, SKILLS, HAGGLER, { mercantile: 100, personality: 0 }]) {
          for (const it of cheap) {
            const c = { quality: q, priceAdjustment, skills };
            const a = tradeCost('Buy', [it], c);
            const s = tradeCost('Sell', [it], c);
            const asked = getTradePrice('Buy', a.cost, q, skills, a.pieces);
            const paid = getTradePrice('Sell', s.cost, q, skills, s.pieces);
            const at = `${it.name} q${q} adj${priceAdjustment} m${skills.mercantile} p${skills.personality}`;
            assert.ok(paid <= Math.floor(asked * ONLINE_SALE_SHARE), `half the floored ask at most: ${at} paid ${paid} of ${asked}`);
            assert.equal(paid, calculateTradePrice(s.cost, q, skills, true, { online: true }), `P0.4's own sale: ${at}`);
            checked++;
          }
        }
      }
    }
    assert.ok(checked > 500, `${checked}`);
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
});

test('FB0929: a repair is a purchase too (GetTradePrice :497-498) - a cheap blade mended at a poor counter, and a rank-9 Fighters Guild member\'s tenth, ask a gold a piece', () => {
  const dagger = shelfOf(BUILDING_TYPES.GeneralStore, 10).find((it) => it.group === 'Weapons' && it.name === 'Dagger');
  assert.equal(dagger.value, 3, 'ItemBuilder: basePrice 1, x3, iron');
  dagger.currentCondition = dagger.maxCondition - 1;   // a blow's wear
  const ctx = { quality: 1, priceAdjustment: 750, skills: SKILLS };
  const lot = tradeCost('Repair', [dagger], ctx);
  assert.deepEqual(lot, { cost: 1, modeActionEnabled: true, pieces: 1 }, 'CalculateItemRepairCost: a tenth of 3 floors to 1, then CalculateCost\'s 2 - REPAIR-EASE: two thirds of it, rounded, 1');
  assert.equal(calculateTradePrice(lot.cost, 1, SKILLS, false), 0, 'Daggerfall mends it for nothing');
  assert.equal(getTradePrice('Repair', lot.cost, 1, SKILLS, lot.pieces), 1);
  // FightersGuild.ReducedRepairCost at rank 9 is 25/256 of the cost: CalculateCost's 2 truncates to nothing
  const guild = tradeCost('Repair', [dagger], { quality: 10, reducedRepairCost: (p) => reducedRepairCost(GUILDS.FightersGuild, { rank: 9 }, p) });
  assert.deepEqual(guild, { cost: 0, modeActionEnabled: true, pieces: 1 });
  assert.equal(getTradePrice('Repair', guild.cost, 10, SKILLS, guild.pieces), 1);
  // a job the shop already holds is not bought again: no pieces, no price, no button
  assert.deepEqual(tradeCost('Repair', [dagger], { ...ctx, isBeingRepaired: () => true }), { cost: 0, modeActionEnabled: false, pieces: 0 });
});
