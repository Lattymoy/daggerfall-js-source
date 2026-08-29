// AUDIT 26 - THE ECONOMY PARITY BATCH (F103-F105/F178, F066,
// F129/F130, F156/F157/F158), the fourth themed sweep of the audit's
// parity queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCourt, CRIMES } from '../src/systems/court.js';
import { createBankAccounts, purchaseHouse, purchaseShip, repayLoan, borrowLoan, TRANSACTION_RESULT, SHIP_TYPES, shipPrice } from '../src/systems/banking.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { setMagicItemTemplates, getMagicItemTemplates } from '../src/systems/loot.js';
import { planStore, planTake, applyTransfer, clearLightSourceOnLeave } from '../src/systems/itemTransfer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

const LETTER = 275;   // LETTER_OF_CREDIT_TEMPLATE (the real template)
const mkPlayer = (coins, letterValue = 0) => ({
  level: 5, gender: 'male', stats: { luck: 50 }, skills: [],
  items: [
    ...(coins > 0 ? [{ group: 'Currency', templateIndex: 131, stackCount: coins }] : []),
    ...(letterValue > 0 ? [{ templateIndex: LETTER, group: 'MiscItems', value: letterValue }] : []),
  ],
});

// ---------------------------------------------------------------
// F103-F105/F178 - PlayerEntity.GetGoldAmount is coins PLUS letters
// of credit (:1313-1316), and DFU gates the court's fine clamp
// (DaggerfallCourtWindow.cs:169), RepayLoan (:516), PurchaseHouse
// (:415), PurchaseShip (:474) and both tavern gates on it. Every one
// of those read coins alone - while the payment past the gate spends
// letters - so the gate and the payment disagreed with each other.
// ---------------------------------------------------------------
test('audit26 F178: the court fine clamp counts letters of credit', () => {
  // A defendant with 10 coins and a 5000-gold letter: DFU clamps the
  // fine against GetGoldAmount = 5010 (DaggerfallCourtWindow.cs:169),
  // so a rolled fine stands whole - the port cut it to the 10 coins
  // and billed the difference as ~3 days per lost 40 gold.
  // dfRand odd = fine += 40 on every penalty tick; rolls high keeps
  // the trial in the fine/days arm.
  const rich = mkPlayer(10, 5000);
  const v = startCourt(rich, 17, CRIMES.Pickpocketing, { rolls: () => 0.5, dfRand: () => 1 });
  assert.ok(v && v.fine > 10, `every penalty tick rolled fine (+40): with letters counted the clamp never cuts to 10 coins (fine=${v?.fine})`);
  const poor = mkPlayer(10, 0);
  const v2 = startCourt(poor, 17, CRIMES.Pickpocketing, { rolls: () => 0.5, dfRand: () => 1 });
  assert.equal(v2.fine, 10, 'coins alone still clamp, with the shortfall as prison days');
  assert.ok(v2.daysInPrison > v.daysInPrison, 'and the poorer defendant serves longer');
});

test('audit26 F103-F105: loans, houses and ships gate on coins PLUS letters', () => {
  const accounts = createBankAccounts();
  const region = 17;
  borrowLoan(accounts, region, 1000, { level: 5 });
  const purse = {
    gold: () => 10,
    totalGold: () => 5010,
    deductGold: (n) => n,
    addGold: () => {},
  };
  // the borrow put 1000 in the ACCOUNT; a 1200 repayment needs the
  // player's half - 10 coins fail it, a 5000 letter carries it.
  const r = repayLoan(accounts, region, 1200, purse);
  assert.notEqual(r.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD,
    'RepayLoan (:516) reads GetGoldAmount - a letter-holder is not refused');
  const accounts2 = createBankAccounts();
  borrowLoan(accounts2, region, 1000, { level: 5 });
  const poor = { ...purse, totalGold: () => 10 };
  const r2 = repayLoan(accounts2, region, 1200, poor);
  assert.equal(r2.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD, 'coins alone still refuse');
  // ship: gate on totalGold too
  const price = shipPrice(SHIP_TYPES.Small);
  const shipPurse = { gold: () => 0, totalGold: () => price, deductGold: (n) => n, addGold: () => {} };
  const accounts3 = createBankAccounts();   // clean of the loan traffic above
  const buy = purchaseShip(accounts3, region, SHIP_TYPES.Small, { ships: [] }, shipPurse, {});
  assert.notEqual(buy.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD, 'PurchaseShip (:474) counts the letter');
});

test('audit26 F103: the tavern gates read totalGoldAmount', () => {
  const s = rd('src/ui/tavernWindow.js');
  assert.match(s, /if \(totalGoldAmount\(h\.entity\) < d\.price\)/, 'the room gate');
  assert.match(s, /gold: totalGoldAmount\(h\.entity\)/, 'and the food gate');
});

// ---------------------------------------------------------------
// F066 - PlayerActivate gates shelf activation on IsPlayerInsideOpenShop
// (:887-899): open opens Buy, CLOSED opens the inventory in
// shelf-stealing mode. DFU never opens a paying trade window in a
// closed shop; the port always did.
// ---------------------------------------------------------------
test('audit26 F066: a closed shop opens the steal-shaped inventory, never the Buy window', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorBuilding\) interiorBuilding\.insideOpenShop = insideOpenShop;/,
    'the door-time latch rides the building record (:1120, latched once)');
  const shelf = m.slice(m.indexOf('function openShelf'), m.indexOf('function openMerchantSell'));
  assert.ok(shelf.includes('if (b.insideOpenShop === false) {'), 'the closed arm gates BEFORE the trade window');
  // RE-ANCHORED at ID1 (F041): the host's inventory windows go through
  // ONE door now (`interiorInventory`, which folds in the drop pool and
  // the emptied-container free). What this asserts is unchanged - the
  // shelf is the Remove-mode remote, SetShopShelfStealing's shape.
  assert.ok(shelf.includes('loot: { items: () => shelf.items },'),
    'and opens the inventory with the shelf as the Remove-mode remote - SetShopShelfStealing\'s shape');
  assert.ok(shelf.includes('const win = interiorInventory({'), 'through the host\'s one inventory door (ID1)');
  assert.ok(shelf.indexOf('insideOpenShop === false') < shelf.indexOf('openTradeWindow(shelf, b, \'Buy\')'),
    'the gate precedes the Buy window');
});

// ---------------------------------------------------------------
// F129/F130 - StockShopShelf's two unbuilt arms whose dependencies
// shipped: RandomlyAddPotionRecipe(25) on the Alchemist arm
// (DaggerfallLoot.cs:163-166) and one random magic item for the
// MagicItems group (:240-243), which pawn shops carry at chanceMod 10.
// ---------------------------------------------------------------
test('audit26 F129: alchemists stock potion recipes at 25%', () => {
  // rolls: the recipe arm draws dice100(25) FIRST (the arm precedes
  // the group loop); a 0.0 draw passes it.
  const hi = stockShopShelf({ buildingType: 0, quality: 5 }, mkPlayer(0), { rolls: () => 0.999 });
  const low = stockShopShelf({ buildingType: 0, quality: 5 }, mkPlayer(0), { rolls: () => 0.0 });
  const recipes = (l) => l.filter((it) => it.potionRecipeKey != null).length;
  assert.equal(recipes(low), 1, 'a passing 25% roll stocks exactly one recipe (DaggerfallLoot.cs:163-166)');
  assert.equal(recipes(hi), 0, 'a failing roll stocks none');
});

test('audit26 F130: the MagicItems group mints a real magic item when the registry is loaded', () => {
  const prev = getMagicItemTemplates();
  try {
    setMagicItemTemplates([{ type: 0, group: 2, groupIndex: 0, enchantments: [{ type: 1, param: 0 }], uses: 100, value: 500 }]);
    const s = rd('src/systems/shopStock.js');
    assert.doesNotMatch(s, /if \(group === 'MagicItems'\) continue;\s+\/\/ INTERIM/, 'the INTERIM skip is gone');
    assert.match(s, /const templates = getMagicItemTemplates\(\);\s*\n\s*if \(templates\) add\(createRegularMagicItem\(templates, level, playerEntity\.gender \?\? 0, rolls\)\);/,
      'the arm mints through CreateRegularMagicItem, as CreateRandomMagicItem is (:517-520)');
  } finally {
    setMagicItemTemplates(prev);
  }
});

// ---------------------------------------------------------------
// F156/F157/F158 - the transfer arms.
// ---------------------------------------------------------------
test('audit26 F156: a map is intercepted in BOTH directions and never lands', () => {
  const map = { group: 'MiscItems', templateIndex: 287, stackCount: 1 };
  const store = planStore(map, {});
  assert.equal(store.ok, true);
  assert.equal(store.map, true, 'local -> remote is intercepted (:1471-1478)');
  const take = planTake(map, { bag: [], entity: null });
  assert.equal(take.map, true, 'remote -> local too');
  // the windows route a map plan to their use arm (the reveal), never
  // to applyTransfer
  const w = rd('src/ui/nativeInventory.js');
  assert.match(w, /if \(plan\.map\) \{ this\._use\(it, this\.hooks\.items\(\)\); return; \}/);
  assert.match(w, /if \(plan\.map\) \{ this\._use\(it, remote\); return; \}/);
});

test('audit26 F157: a lit light source leaving the pack goes out', () => {
  const torch = { group: 'UselessItems2', templateIndex: 247, stackCount: 1 };
  const entity = { lightSource: torch };
  clearLightSourceOnLeave(torch, entity, true);
  assert.equal(entity.lightSource, null, ':1506-1508 verbatim');
  const other = { group: 'UselessItems2', templateIndex: 247 };
  const e2 = { lightSource: other };
  clearLightSourceOnLeave(torch, e2, true);
  assert.equal(e2.lightSource, other, 'only the LIT one clears (LightSource == item)');
  const e3 = { lightSource: torch };
  clearLightSourceOnLeave(torch, e3, false);
  assert.equal(e3.lightSource, torch, 'and only when it LEAVES the pack (from == localItems)');
  // the sell staging clears too
  assert.match(rd('src/ui/nativeTrade.js'), /clearLightSourceOnLeave\(item, this\.hooks\.entity, true\);/);
});

test('audit26 F158: the basket takes the CanCarryAmount gate and splits', () => {
  const t = rd('src/ui/nativeTrade.js');
  const arm = t.slice(t.indexOf('_pickRemote(slot)'), t.indexOf('_clear()'));
  assert.ok(arm.includes('planTake(item, {'), 'the Buy-mode remote click routes through the ladder');
  assert.ok(arm.includes('bag: [...this.hooks.packItems(), ...this.basket]'),
    'the bag under test is pack + basket - the player walks out with both');
  assert.ok(arm.includes('applyTransfer(item, plan, this.hooks.shelfItems(), this.basket)'),
    'a partial fit splits through the same applyTransfer every screen uses');
  // and the split law itself: 3 fit of a 5-stack
  const stack = { group: 'Weapons', templateIndex: 128, stackCount: 5 };   // War Axe, 7.5kg each (the template's own weight)
  const entity = { stats: { strength: 50 }, items: [] };   // MaxEncumbrance = 75kg
  const bag = [{ group: 'Armor', templateIndex: 102, stackCount: 5 }];   // 5 cuirasses = 62.5kg -> 12.5 left -> 1 axe fits
  const plan = planTake(stack, { bag, entity });
  assert.equal(plan.ok, true);
  assert.ok(plan.amount >= 1 && plan.amount < 5, `a partial fit splits (took ${plan.amount})`);
  const remote = [stack];
  const taken = applyTransfer(stack, plan, remote, bag);
  assert.equal(taken.stackCount, plan.amount, 'the moved record carries what fit');
  assert.equal(remote[0].stackCount, 5 - plan.amount, 'the remainder stays on the shelf');
});
