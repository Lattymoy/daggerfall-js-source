// U40: the trade window's mode flow, law half - against
// DaggerfallTradeWindow.cs and FormulaHelper's two cost formulas.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  WINDOW_MODES, MODE_ACTION_ART, SELL_GOLD_ART, modeActionArt,
  GOLD_PIECE_WEIGHT_KG, IDENTIFY_COST_MULTIPLIER,
  TRADE_MESSAGE_BASE_ID, NOT_ENOUGH_GOLD_ID,
  calculateItemIdentifyCost, buyHolidayHalvesPrice, buyItemPrice,
  tradeCost, getTradePrice, tradeMessageOffset, tradeDecision, sellProceeds,
} from '../src/systems/tradeModes.js';
import { calculateCost, calculateTradePrice } from '../src/systems/shopStock.js';
import { HOLIDAYS } from '../src/systems/holidays.js';
import { GUILDS } from '../src/systems/guilds.js';
import { cureOfferMessageOffset } from '../src/systems/guildServiceActions.js';

const skills = { mercantile: 50, personality: 50 };
const it = (value, over = {}) => ({ value, group: 'Weapons', stackCount: 1, ...over });

test('U40: WindowModes is DFU\'s numbering, Inventory included (:133-141)', () => {
  assert.deepEqual({ ...WINDOW_MODES },
    { Inventory: 0, Sell: 1, Buy: 2, Repair: 3, Identify: 4, SellMagic: 5 });
  // Inventory is DFU's own "should never get used" - it is kept
  // because dropping it would renumber every mode after it
  assert.equal(WINDOW_MODES.Inventory, 0);
  assert.equal(WINDOW_MODES.Sell, 1, 'Sell comes BEFORE Buy in the enum');
});

test('U40: the action-panel art per mode (:78-83, :755-764)', () => {
  assert.equal(MODE_ACTION_ART.Buy, 'INVE08I0.IMG');
  assert.equal(MODE_ACTION_ART.Repair, 'INVE12I0.IMG');
  assert.equal(MODE_ACTION_ART.Identify, 'INVE14I0.IMG');
  // Sell and SellMagic SHARE a panel - one texture, two modes
  assert.equal(MODE_ACTION_ART.Sell, 'INVE10I0.IMG');
  assert.equal(MODE_ACTION_ART.SellMagic, MODE_ACTION_ART.Sell);
  // Inventory mode has NO overlay, which is what DFU's null guard
  // at :213 exists for - it must answer null, not the buy panel
  assert.equal(modeActionArt('Inventory'), null);
  assert.equal(modeActionArt('Buy'), 'INVE08I0.IMG');
  // INVE11 is the GOLD panel, loaded in every mode as the source of
  // the select button's selected state - not as a mode's own art
  assert.equal(SELL_GOLD_ART, 'INVE11I0.IMG');
  assert.equal(Object.values(MODE_ACTION_ART).includes(SELL_GOLD_ART), false);
});

test('U40: the shared ids come from ONE home, not a third copy', () => {
  assert.equal(TRADE_MESSAGE_BASE_ID, 260);
  assert.equal(NOT_ENOUGH_GOLD_ID, 454);
  // and the module re-exports rather than re-declaring - a second 260
  // is exactly the drift the one-home guard exists to catch
  const src = readFileSync(new URL('../src/systems/tradeModes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /const TRADE_MESSAGE_BASE_ID\s*=/);
  assert.doesNotMatch(src, /const NOT_ENOUGH_GOLD_ID\s*=/);
});

test('U40: CalculateItemIdentifyCost - a shift, free on the Witches Festival (:1935-1955)', () => {
  assert.equal(IDENTIFY_COST_MULTIPLIER, 25);
  // (25 * value) >> 8, which TRUNCATES - a cheap item identifies free
  assert.equal(calculateItemIdentifyCost(1000), (25 * 1000) >> 8);
  assert.equal(calculateItemIdentifyCost(1000), 97);
  assert.equal(calculateItemIdentifyCost(10), 0, 'a 10-gold item costs nothing to identify');
  // the Witches Festival is free OUTRIGHT, before the shift
  assert.equal(calculateItemIdentifyCost(100000, { holidayId: HOLIDAYS.Witches_Festival }), 0);
  // ...and no OTHER holiday is
  assert.equal(calculateItemIdentifyCost(1000, { holidayId: HOLIDAYS.Merchants_Festival }), 97);
  // the guild discount applies AFTER the shift, not before
  const half = (c) => Math.trunc(c / 2);
  assert.equal(calculateItemIdentifyCost(1000, { reducedIdentifyCost: half }), half(97));
});

test('U40: the three Buy-mode holiday arms are three DIFFERENT predicates (:444-449)', () => {
  const weapon = it(100, { group: 'Weapons' });
  const book = it(100, { group: 'Books' });
  const MAGES = GUILDS.MagesGuild.factionId;

  // Merchants Festival: everything, but ONLY outside a guild
  assert.equal(buyHolidayHalvesPrice(book, { holidayId: HOLIDAYS.Merchants_Festival }), true);
  assert.equal(buyHolidayHalvesPrice(book, { holidayId: HOLIDAYS.Merchants_Festival, guildFactionId: MAGES }), false,
    'a guild shop does not run the merchants festival');

  // Tales and Tallow: ONLY inside the Mages Guild
  assert.equal(buyHolidayHalvesPrice(book, { holidayId: HOLIDAYS.Tales_and_Tallow, guildFactionId: MAGES }), true);
  assert.equal(buyHolidayHalvesPrice(book, { holidayId: HOLIDAYS.Tales_and_Tallow }), false, 'not in a plain shop');
  assert.equal(buyHolidayHalvesPrice(book, { holidayId: HOLIDAYS.Tales_and_Tallow, guildFactionId: MAGES + 1 }), false,
    'and not in some OTHER guild - the faction id is checked');

  // Warriors Festival: weapons only, outside a guild only
  assert.equal(buyHolidayHalvesPrice(weapon, { holidayId: HOLIDAYS.Warriors_Festival }), true);
  assert.equal(buyHolidayHalvesPrice(book, { holidayId: HOLIDAYS.Warriors_Festival }), false, 'a book is not a weapon');
  assert.equal(buyHolidayHalvesPrice(weapon, { holidayId: HOLIDAYS.Warriors_Festival, guildFactionId: MAGES }), false);

  // an ordinary day halves nothing
  assert.equal(buyHolidayHalvesPrice(weapon, {}), false);
  assert.equal(buyHolidayHalvesPrice(weapon, { holidayId: HOLIDAYS.New_Life }), false);
});

test('U40: the holiday halving is EXACT, because CalculateCost is always even', () => {
  const stack = it(100, { stackCount: 3 });
  const full = buyItemPrice(stack, { quality: 10 });
  const cut = buyItemPrice(stack, { quality: 10, holidayId: HOLIDAYS.Merchants_Festival });
  assert.equal(full, calculateCost(100, 10) * 3);
  assert.equal(cut, full / 2);

  // WHY there is no truncation to pin: CalculateCost's last line is
  // `cost = 2 * (...)` (:1896), so EVERY price it returns is even, and
  // a stack multiply keeps it even. DFU's `itemPrice /= 2` is C#
  // integer division and would truncate - but it can never reach an
  // odd number to truncate. Swept rather than asserted on one case,
  // because the claim is about the formula and not about a fixture.
  for (const value of [1, 2, 3, 7, 99, 100, 1001, 65535]) {
    for (const q of [0, 1, 9, 10, 11, 20]) {
      assert.equal(calculateCost(value, q) % 2, 0, `calculateCost(${value}, ${q}) is even`);
    }
  }

  // EQUIVALENT MUTANT, recorded so nobody re-hunts it: halving PER
  // UNIT and then multiplying by the stack cannot be told apart from
  // halving the stack TOTAL. It would differ only on an odd unit
  // price, and the sweep above proves there is no such price. DFU
  // halves the total; the port matches the source, and the pin says
  // the two are indistinguishable rather than pretending otherwise.
  for (const n of [1, 2, 3, 5]) {
    const unit = calculateCost(100, 10);
    assert.equal(Math.trunc((unit * n) / 2), Math.trunc(unit / 2) * n, `stack ${n}`);
  }
});

test('U40: tradeCost walks the staged list per mode, and the button follows it (:425-489)', () => {
  const ctx = { quality: 10 };
  // BUY totals the basket
  const basket = [it(100), it(50)];
  const buy = tradeCost('Buy', basket, ctx);
  assert.equal(buy.cost, calculateCost(100, 10) + calculateCost(50, 10));
  assert.equal(buy.modeActionEnabled, true);
  // an EMPTY list leaves the button dead in every mode
  for (const m of ['Buy', 'Sell', 'Repair', 'Identify', 'SellMagic']) {
    assert.deepEqual(tradeCost(m, [], ctx), { cost: 0, modeActionEnabled: false }, m);
  }
  // SELL multiplies by the stack...
  const five = [it(100, { stackCount: 5 })];
  assert.equal(tradeCost('Sell', five, ctx).cost, calculateCost(100, 10) * 5);
  // ...and SELLMAGIC does NOT. DFU's own TODO sits on that line, so a
  // stack of five fences for the price of one. Verbatim.
  assert.equal(tradeCost('SellMagic', five, ctx).cost, calculateCost(100, 10));
  assert.notEqual(tradeCost('SellMagic', five, ctx).cost, tradeCost('Sell', five, ctx).cost);
});

test('U40: Sell does NOT price by condition, though the call site says it does (:462, :1884)', () => {
  // DFU passes item.ConditionPercentage into CalculateCost's third
  // parameter and CalculateCost's BODY NEVER READS IT. A battered
  // sword and a pristine one fetch exactly the same price.
  const battered = it(500, { currentCondition: 1, maxCondition: 100, conditionPercentage: 1 });
  const pristine = it(500, { currentCondition: 100, maxCondition: 100, conditionPercentage: 100 });
  const ctx = { quality: 12 };
  assert.equal(tradeCost('Sell', [battered], ctx).cost, tradeCost('Sell', [pristine], ctx).cost);
  assert.equal(tradeCost('Sell', [battered], ctx).cost, calculateCost(500, 12));
  // the port's third slot is the REGIONAL adjustment, so it must be
  // that - and passing a condition there would move the price
  assert.equal(tradeCost('Sell', [pristine], { quality: 12, priceAdjustment: 2000 }).cost,
    calculateCost(500, 12, 2000));
  assert.notEqual(calculateCost(500, 12, 2000), calculateCost(500, 12, 1000));
});

test('U40: Repair skips an item already in the shop; Identify skips one already known', () => {
  const ctx = { quality: 10, isBeingRepaired: (i) => !!i.inShop };
  const broken = it(1000, { currentCondition: 10, maxCondition: 100 });
  const already = it(1000, { currentCondition: 10, maxCondition: 100, inShop: true });
  // a list of NOTHING BUT skipped items totals zero AND cannot be
  // committed - one fact, because DFU sets the flag inside the arm
  assert.deepEqual(tradeCost('Repair', [already], ctx), { cost: 0, modeActionEnabled: false });
  const live = tradeCost('Repair', [broken], ctx);
  assert.ok(live.cost > 0);
  assert.equal(live.modeActionEnabled, true);
  // a MIXED list charges only for the live one but does enable
  assert.equal(tradeCost('Repair', [broken, already], ctx).cost, live.cost);
  assert.equal(tradeCost('Repair', [broken, already], ctx).modeActionEnabled, true);

  // Identify, same shape on isIdentified
  const known = it(1000, { isIdentified: true });
  assert.deepEqual(tradeCost('Identify', [known], { quality: 10 }), { cost: 0, modeActionEnabled: false });
  const unknown = it(1000);
  assert.equal(tradeCost('Identify', [unknown], { quality: 10 }).cost, calculateItemIdentifyCost(1000));
  // the SPELL identifies free but still ENABLES the button (:479-481)
  assert.deepEqual(tradeCost('Identify', [unknown], { quality: 10, usingIdentifySpell: true }),
    { cost: 0, modeActionEnabled: true });
});

test('U40: GetTradePrice - buy, sell, and the mode that does not haggle (:492-509)', () => {
  const cost = 500, q = 12;
  // Buy and Repair haggle as a PURCHASE
  assert.equal(getTradePrice('Buy', cost, q, skills), calculateTradePrice(cost, q, skills, false));
  assert.equal(getTradePrice('Repair', cost, q, skills), getTradePrice('Buy', cost, q, skills));
  // Sell and SellMagic as a SALE - a different formula, not a sign flip
  assert.equal(getTradePrice('Sell', cost, q, skills), calculateTradePrice(cost, q, skills, true));
  assert.equal(getTradePrice('SellMagic', cost, q, skills), getTradePrice('Sell', cost, q, skills));
  assert.notEqual(getTradePrice('Sell', cost, q, skills), getTradePrice('Buy', cost, q, skills));
  // Identify does not haggle AT ALL - the cost IS the price
  assert.equal(getTradePrice('Identify', cost, q, skills), cost);
  // and an unexpected mode THROWS, as DFU's own trailing throw does -
  // it does not quietly answer the cost
  assert.throws(() => getTradePrice('Inventory', cost, q, skills), /Unexpected windowMode/);
});

test('U40: the haggle message is the TEMPLE\'s three bands, +3 for selling (:1102-1113)', () => {
  // band 0: the player bargained below half
  assert.equal(tradeMessageOffset('Buy', 100, 40), 0);
  // band 1: between half and three quarters
  assert.equal(tradeMessageOffset('Buy', 100, 60), 1);
  // band 2: three quarters or more - the grudging one
  assert.equal(tradeMessageOffset('Buy', 100, 80), 2);
  // the boundaries are DFU's shifts, inclusive on the <=
  assert.equal(tradeMessageOffset('Buy', 100, 50), 1, 'exactly half is NOT band 0');
  assert.equal(tradeMessageOffset('Buy', 100, 75), 2, 'exactly three quarters IS band 2');
  // ONE HOME: this is literally cureOfferMessageOffset
  for (const price of [10, 40, 50, 60, 75, 80, 200]) {
    assert.equal(tradeMessageOffset('Buy', 100, price), cureOfferMessageOffset(100, price), `price ${price}`);
  }
  // ...and the SELL modes step three records on, both of them
  assert.equal(tradeMessageOffset('Sell', 100, 40), 3);
  assert.equal(tradeMessageOffset('SellMagic', 100, 80), 5);
  // Repair and Identify stay on the buying set
  assert.equal(tradeMessageOffset('Repair', 100, 40), 0);
  assert.equal(tradeMessageOffset('Identify', 100, 40), 0);
});

test('U40: a buyer who cannot pay is refused BEFORE the offer; a seller is never asked (:1116-1133)', () => {
  const poor = tradeDecision('Buy', { cost: 100, tradePrice: 80, gold: 5 });
  assert.equal(poor.kind, 'notEnoughGold');
  // the two records are CONCATENATED into one box - the haggle line
  // AND the refusal, with no Yes/No at all
  assert.deepEqual(poor.textIds, [TRADE_MESSAGE_BASE_ID + 2, NOT_ENOUGH_GOLD_ID]);
  // exactly enough IS enough
  assert.equal(tradeDecision('Buy', { cost: 100, tradePrice: 80, gold: 80 }).kind, 'offer');
  const offer = tradeDecision('Buy', { cost: 100, tradePrice: 40, gold: 1000 });
  assert.deepEqual(offer, { kind: 'offer', textId: TRADE_MESSAGE_BASE_ID, price: 40 });
  // SELLING never looks at gold - a penniless player can always sell
  assert.equal(tradeDecision('Sell', { cost: 100, tradePrice: 80, gold: 0 }).kind, 'offer');
  assert.equal(tradeDecision('SellMagic', { cost: 100, tradePrice: 80, gold: 0 }).kind, 'offer');
  // Repair and Identify are BUYING modes and do check
  assert.equal(tradeDecision('Repair', { cost: 100, tradePrice: 80, gold: 5 }).kind, 'notEnoughGold');
  assert.equal(tradeDecision('Identify', { cost: 100, tradePrice: 80, gold: 5 }).kind, 'notEnoughGold');
});

test('U40: a purse too heavy to carry becomes a LETTER OF CREDIT (:1035-1050)', () => {
  assert.equal(GOLD_PIECE_WEIGHT_KG, 0.0025);
  // light enough: paid in coin
  assert.deepEqual(sellProceeds(1000, { carriedWeightKg: 10, maxEncumbranceKg: 100 }),
    { kind: 'gold', amount: 1000 });
  // 100000 pieces is 250 kg - past any encumbrance
  assert.deepEqual(sellProceeds(100000, { carriedWeightKg: 10, maxEncumbranceKg: 100 }),
    { kind: 'letterOfCredit', amount: 100000 });
  // the letter carries the FULL price, not a remainder
  assert.equal(sellProceeds(100000, { carriedWeightKg: 99, maxEncumbranceKg: 100 }).amount, 100000);
  // the boundary is <=, so landing EXACTLY on the cap is still coin
  const room = 10;                       // kg of headroom
  const exact = room / GOLD_PIECE_WEIGHT_KG;   // 4000 pieces
  assert.equal(sellProceeds(exact, { carriedWeightKg: 90, maxEncumbranceKg: 100 }).kind, 'gold');
  assert.equal(sellProceeds(exact + 1, { carriedWeightKg: 90, maxEncumbranceKg: 100 }).kind, 'letterOfCredit');
  // and with no cap supplied nothing is ever too heavy
  assert.equal(sellProceeds(10 ** 9, {}).kind, 'gold');
});
