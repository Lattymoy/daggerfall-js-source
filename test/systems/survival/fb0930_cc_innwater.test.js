// FIELD BUGS 2026-09-30 (INN-WATER) - #bug-reports, "Climates & Calories Bugs": "3 - Waterskins should be refillable at
// an inn/tavern. ... since water is rare in some regions like Sentinel, but inns are plentiful, this should be added".
//
// A skin filled only at a fountain, a well or a trough (items.js drinkAtSource). Every tavern menu - the classic window's
// picker and the enhanced window's list alike - carries a row now, "Fill your waterskins", priced at the list's cheapest
// soft drink (its cheapest drink if it pours none). It is the fountain's own law: every skin the player carries filled,
// the thirst quenched, the fountain's own words, no time passed. The house refuses before any coin moves when there is
// no skin ("You carry no waterskin.") or every skin is full as food.js reads one ("Your waterskins are full."). The coin
// goes the way the menu's other rows take it: the gold asked first, then the house (tavernOrder), then deductGold - the
// same door online, where a tavern row is the character's own purse and never a realm act.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  tavernMenu, tavernOrder, tavernWater, innWaterPrice, menuKeyFor, menuTier, TAVERN_DRINKS, DRINK_MENUS, DRINK_ALCOHOL, TAVERN_MENU_TEXT,
} from '../../../src/systems/survival/tavernMenu.js';
import { newSurvival, NEED } from '../../../src/systems/survival/needs.js';
import { createSurvivalItem, SURVIVAL_USE_TEXT } from '../../../src/systems/survival/items.js';
import { TEMPLATE, WATERSKIN_CAPACITY_KG } from '../../../src/systems/survival/food.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { NOT_ENOUGH_GOLD_ID } from '../../../src/systems/tavern.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../../../src/systems/inventory.js';
import { TavernWindow } from '../../../src/ui/tavernWindow.js';
import { mountEnhancedTavern } from '../../../src/ui/enhanced/enhancedTavern.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { withDom } from '../../invdrag.mjs';

afterEach(() => { _resetForTests(); });

const NOW = 1440 * 10 + 13 * 60;
const skin = (water) => createSurvivalItem(TEMPLATE.Waterskin, { water });
const guest = (items, extra = {}) => ({
  name: 'Mac', goldPieces: 100, health: 20, maxHealth: 40, stats: { endurance: 50 }, rentedRooms: [], items, activeEffects: [],
  lastTimePlayerAteOrDrankAtTavern: 0, survival: { ...newSurvival(NOW), thirst: NEED.PARCHED + 10 }, ...extra,
});
const hooks = (passed) => ({
  rows: (id) => [{ text: `r${id}`, center: true }], now: () => NOW, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Sand Lantern',
  quality: () => 10, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
  heal: () => {}, rolls: () => 0.5, climateIndex: () => CLIMATES.Desert, advanceMinutes: (n) => passed.push(n), endurance: () => 50,
});
const waterRow = () => tavernMenu({ climateIndex: CLIMATES.Desert, quality: 10, hour: 13 }).rows.find((r) => r.kind === 'water');
/** The classic window's pick of the water row: [the box said, the gold after, the minutes passed]. */
const classicWater = (entity) => {
  const passed = [];
  const w = new TavernWindow({ entity, ...hooks(passed), onTalk: () => {}, onClose: () => {} });
  w._food();
  const i = w.flow.top.picker.findIndex((t) => t.endsWith(TAVERN_MENU_TEXT.water));
  assert.ok(i >= 0, 'the classic picker offers the water');
  const out = w.flow.top.onPick(i);
  return { said: out?.[0]?.rows?.[0]?.text, passed };
};

test('INN-WATER: every menu carries the water - one row under the drinks header, at the list\'s cheapest soft drink, every climate, tier and hour, the kitchen shut or open (mutants: no water row; the shut kitchen hides the water; priced at the dearest drink; the soft drinks not asked; no fallback when none is soft)', () => {
  for (const ci of Object.values(CLIMATES)) for (const quality of [1, 10, 15]) for (const hour of [2, 5, 7, 12, 23]) {
    const m = tavernMenu({ climateIndex: ci, quality, hour });
    const rows = m.rows.filter((r) => r.kind === 'water');
    assert.equal(rows.length, 1, `${ci}/${quality}/${hour}: one water row`);
    const at = m.rows.findIndex((r) => r.kind === 'water');
    assert.equal(m.rows[at - 1].kind, 'header', 'first under the drinks header');
    // PIN MOVED (AUDIT C&C I8): the list the mod pours (DoDrinks' switch over its key, the climate's here) and its soft
    // drinks by their alcohol - nought at their place in the tier (DRINK_ALCOHOL) - not by a name the port guessed at
    const tier = menuTier(quality), drinks = TAVERN_DRINKS[DRINK_MENUS[tier][menuKeyFor(ci)]];
    const soft = drinks.filter((k, i) => DRINK_ALCOHOL[tier][i] === 0).map((k) => k.price);
    const price = Math.min(...soft);
    assert.ok(soft.length > 0, 'every list the mod pours has a soft drink');
    assert.deepEqual(rows[0], { text: `${String(price).padStart(2)} gold   Fill your waterskins`, kind: 'water', name: 'Fill your waterskins', price }, `${ci}/${quality}/${hour}: the cheapest soft drink's price`);
  }
  const d = (name, price, strength) => ({ name, price, strength });   // PIN MOVED (AUDIT C&C I8): a row carries its alcohol
  assert.equal(innWaterPrice([d('Ale', 1, 10), d('Goats Milk', 3, 0), d('Mint Tea', 4, 0)]), 3, 'the cheapest SOFT drink, not the cheapest drink');
  assert.equal(innWaterPrice([d('Rum', 4, 25), d('Ale', 2, 10), d('Red Wine', 9, 20)]), 2, 'a list with no soft drink: its cheapest drink');
});

test('INN-WATER: the report - a parched traveller in a desert inn fills an empty skin and a half one at the classic window: paid, both full, the thirst quenched, the fountain\'s words, no time passed (mutants: the classic window pours a drink for the water; the water costs a quarter hour; the fill leaves the thirst; the classic window never names the skins; no water row)', () => {
  _resetForTests(); setPref(SURVIVAL_PREF, 'casual');
  const skins = [skin(0), skin(1)];
  const entity = guest(skins);
  const { said, passed } = classicWater(entity);
  assert.equal(entity.goldPieces, 100 - waterRow().price, 'paid the row\'s price');
  assert.deepEqual(skins.map((s) => [s.water, s.name]), [[WATERSKIN_CAPACITY_KG, 'Waterskin'], [WATERSKIN_CAPACITY_KG, 'Waterskin']], 'every skin full, and named so');
  assert.equal(entity.survival.thirst, 0, 'the thirst quenched, the fountain\'s way');
  assert.equal(entity.survival.drunk, 0, 'water is not a drink');
  assert.equal(said, `${SURVIVAL_USE_TEXT.quenched} ${SURVIVAL_USE_TEXT.refilled}`, 'the fountain\'s own words');
  assert.equal(passed.reduce((a, n) => a + n, 0), 0, 'no time passes, as at a fountain');
  const r = tavernWater(guest([skin(0.5)], { survival: { ...newSurvival(NOW), thirst: 0 } }), NOW);
  assert.deepEqual(r, { text: SURVIVAL_USE_TEXT.refilled, minutes: 0 }, 'no thirst: the refill alone is said');
});

test('INN-WATER: the house refuses before any coin moves - no skin, every skin full; a full skin beside an empty one is served; the gold is asked first, and a letter of credit pays as it pays for a meal (mutants: the water sold to a player without a skin; to full skins; one full skin refuses all; the classic window never names the skins)', () => {
  _resetForTests(); setPref(SURVIVAL_PREF, 'casual');
  const none = guest([]);
  const a = classicWater(none);
  assert.deepEqual([a.said, none.goldPieces, a.passed], ['You carry no waterskin.', 100, []], 'no skin: refused, nothing charged, no time');
  const full = guest([skin(WATERSKIN_CAPACITY_KG), skin(WATERSKIN_CAPACITY_KG)]);
  const b = classicWater(full);
  assert.deepEqual([b.said, full.goldPieces, full.survival.thirst], ['Your waterskins are full.', 100, NEED.PARCHED + 10], 'every skin full: refused, nothing charged, nothing quenched');
  const half = [skin(WATERSKIN_CAPACITY_KG), skin(0)];
  const one = guest(half);
  classicWater(one);
  assert.deepEqual([one.goldPieces, half[1].water], [100 - waterRow().price, WATERSKIN_CAPACITY_KG], 'one skin with room is enough');
  const poor = guest([], { goldPieces: 0 });
  assert.equal(classicWater(poor).said, `r${NOT_ENOUGH_GOLD_ID}`, 'the gold is asked first, as for every row');
  const letter = { templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 50 };
  const credit = guest([skin(0), letter], { goldPieces: 0 });
  classicWater(credit);
  assert.deepEqual([letter.value, credit.items[0].water], [50 - waterRow().price, WATERSKIN_CAPACITY_KG], 'the letter pays - deductGold, the menu\'s own door');
  const order = (items) => tavernOrder(newSurvival(NOW), NOW, waterRow(), { endurance: 50, rules: SURVIVAL_RULES.hard, items });
  assert.deepEqual(order([]), { ok: false, text: TAVERN_MENU_TEXT.noSkin }, 'Hard refuses as Casual does');
  assert.deepEqual(order([skin(WATERSKIN_CAPACITY_KG - 0.01)]), { ok: true }, 'a skin short by a sip has room');
  assert.deepEqual(order(undefined), { ok: false, text: TAVERN_MENU_TEXT.noSkin }, 'no pack, no skin');
});

test('INN-WATER: the enhanced window offers and fills the same water, and a refusal keeps the menu up as the barkeep\'s other refusals do (mutants: the enhanced window pours a drink for the water; the enhanced window never names the skins; the fill leaves the thirst; sold without a skin; no water row)', () => {
  const run = (items) => {
    _resetForTests(); setPref(SURVIVAL_PREF, 'casual');
    const hadLoc = Object.hasOwn(globalThis, 'location'), loc = globalThis.location;
    globalThis.location = { search: '?skin=classic' };
    try {
      return withDom((dom) => {
        const entity = guest(items); const passed = [];
        const host = dom.mk('div'); dom.body.append(host);
        const view = mountEnhancedTavern(host, { entity, ...hooks(passed), onExit: () => {} });
        const text = (n) => (n.textContent || '') + n.children.map(text).join(' ');
        dom.doc.querySelectorAll('.tavern-act').find((b) => b.textContent === 'Food & drink').onclick();
        const row = (name) => dom.doc.querySelectorAll('.tavern-row').find((r) => text(r).includes(name));
        assert.ok(row('Fill your waterskins'), 'the list offers the water');
        assert.ok(text(row('Fill your waterskins')).includes(`${waterRow().price} gp`), 'at its price');
        row('Fill your waterskins').onclick();
        const said = dom.doc.querySelectorAll('.px-note').map((n) => n.textContent);
        const out = { entity, passed: [...passed], said, menuUp: !!row('Fill your waterskins') };
        view?.unmount?.();
        return out;
      });
    } finally {
      if (hadLoc) globalThis.location = loc; else delete globalThis.location;
    }
  };
  const filled = run([skin(0)]);
  assert.deepEqual([filled.entity.goldPieces, filled.entity.items[0].water, filled.entity.survival.thirst], [100 - waterRow().price, WATERSKIN_CAPACITY_KG, 0], 'paid, filled, quenched');
  assert.ok(filled.said.includes(`${SURVIVAL_USE_TEXT.quenched} ${SURVIVAL_USE_TEXT.refilled}`), 'the fountain\'s words');
  const none = run([]);
  assert.deepEqual([none.entity.goldPieces, none.passed], [100, []], 'no skin: nothing charged');
  assert.ok(none.said.includes(TAVERN_MENU_TEXT.noSkin), 'and the barkeep says why');
  assert.equal(none.menuUp, true, 'the menu stays up');
});
