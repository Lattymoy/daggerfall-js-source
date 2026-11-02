// ENDLESS PROVISIONS (2026-10-04, Mac: "campfires should be unlimited, rations should be available in stores where it
// makes sense and unlimited as well", then "i can use and find all those without climates and calories" -> "do that";
// the Plenty-Rations-Campfirekits handoff, ported onto ENDLESS-STOCK and REST2): a General Store's and a Pawn Shop's
// counter shelf has a Campfire Kit and a stack of 99 Rations in every tier, Climates & Calories Off and offline too
// (shopStock.js, survival/items.js ensureEndlessProvisions); online a purchase stands them again (restockEndless, Rations
// now among isEndlessStock's rows) and no shop buys them back; offline they sell out until the day's restock
// (ENDLESS-STOCK F4, the owner's call 2026-10-04: "Online only"). An Off meal is eaten, never refused for hunger, and
// gives stamina back (eatFood's offMeal; useItem.js passes it with the arc Off). A camp is every tier's (camps.js:
// auditsurv, survtiers and survtiers3 pin it).
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { stockShopShelf, isEndlessStock, restockEndless, shopBuysItem } from '../../src/systems/shopStock.js';
import { createSurvivalItem, useSurvivalItem, TEMPLATE, ENDLESS_RATIONS_STACK, OFF_MEAL_FULL_MINUTES, ensureEndlessProvisions } from '../../src/systems/survival/items.js';
import { FOOD_STAGE } from '../../src/systems/survival/food.js';
import { useItem } from '../../src/systems/useItem.js';
import { SURVIVAL_PREF } from '../../src/systems/survival/switch.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { maxFatigue } from '../../src/systems/statMods.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const kits = (shelf) => shelf.filter((i) => i.templateIndex === TEMPLATE.Campfire);
const rations = (shelf) => shelf.find((i) => i.templateIndex === TEMPLATE.Rations);
/** A shop's counter shelf (shelfIndex 0), online or not, the arc at `tier`. */
function shelfOf(type, { online = false, tier = false, shelfIndex = 0 } = {}) {
  globalThis.location = { search: online ? '?online' : '' };
  setSharedClock(online ? () => 1000 : null);
  setPref(SURVIVAL_PREF, tier);
  return stockShopShelf({ buildingType: type, quality: 1 }, { items: [], level: 1 }, { rolls: () => 0.99, torchesFromItems: false, shelfIndex });
}
afterEach(() => { globalThis.location = { search: '' }; setSharedClock(null); _resetForTests(); });

test('ENDLESS PROVISIONS: a General Store\'s and a Pawn Shop\'s counter shelf has a Campfire Kit and 99 Rations in every tier, online or off, on the poorest roll; an armorer neither, and a back shelf is not the counter (mutants: the pair stocked on no shelf, the arc gating it, a back shelf stocked)', () => {
  for (const type of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop]) {
    for (const online of [false, true]) {
      for (const tier of [false, 'casual', 'hard']) {
        const shelf = shelfOf(type, { online, tier });
        const at = `${type === BUILDING_TYPES.GeneralStore ? 'General Store' : 'Pawn Shop'} ${online ? 'online' : 'offline'} ${tier || 'Off'}`;
        assert.ok(kits(shelf).length >= 1, `${at}: a kit`);
        assert.equal(rations(shelf)?.stackCount, ENDLESS_RATIONS_STACK, `${at}: the rations stack`);
      }
    }
  }
  assert.equal(ENDLESS_RATIONS_STACK, 99);
  const armorer = shelfOf(BUILDING_TYPES.Armorer, { tier: 'casual' });
  assert.ok(!armorer.some((i) => i.templateIndex === TEMPLATE.Campfire || i.templateIndex === TEMPLATE.Rations), 'an armorer sells neither');
  const back = shelfOf(BUILDING_TYPES.PawnShop, { shelfIndex: 1 });
  assert.ok(!back.some((i) => i.templateIndex === TEMPLATE.Rations), 'a back shelf is its own container, stocked whole - not the counter\'s');
});

test('ENDLESS PROVISIONS: online, Rations are endless stock - a stack bought whole or in part is filled back to 99, a kit stands again; and no shop buys them back (mutants: Rations not endless, the stack not refilled, a bought-out stack not stood again)', () => {
  const shelf = shelfOf(BUILDING_TYPES.GeneralStore, { online: true, tier: false });
  const stack = rations(shelf);
  assert.equal(isEndlessStock(stack), true);
  // a part bought: the trade split five off the stack
  stack.stackCount -= 5;
  const lot = createSurvivalItem(TEMPLATE.Rations, { stackCount: 5 });
  assert.equal(restockEndless(shelf, [lot]), 1);
  assert.equal(rations(shelf).stackCount, ENDLESS_RATIONS_STACK, 'filled back');
  // the whole stack bought: it left the shelf
  shelf.splice(shelf.indexOf(rations(shelf)), 1);
  restockEndless(shelf, [stack]);
  assert.equal(rations(shelf)?.stackCount, ENDLESS_RATIONS_STACK, 'stood again');
  const before = kits(shelf).length;
  const kit = kits(shelf)[0];
  shelf.splice(shelf.indexOf(kit), 1);
  restockEndless(shelf, [kit]);
  assert.equal(kits(shelf).length, before, 'a kit bought stands again');
  assert.equal(shopBuysItem(BUILDING_TYPES.GeneralStore, createSurvivalItem(TEMPLATE.Rations)), false, 'online no shop buys back what never runs out');
  assert.equal(isEndlessStock(createSurvivalItem(TEMPLATE.Bread)), false, 'bread is not endless');
});

test('ENDLESS PROVISIONS: offline the pair sells out until the day\'s restock, as the rest of the shelf does (ENDLESS-STOCK F4; the owner\'s call: "Online only")', () => {
  const shelf = shelfOf(BUILDING_TYPES.GeneralStore, { online: false, tier: false });
  const stack = rations(shelf);
  shelf.splice(shelf.indexOf(stack), 1);
  assert.equal(restockEndless(shelf, [stack]), 0);
  assert.equal(rations(shelf), undefined, 'gone until the shop restocks');
});

test('ENDLESS PROVISIONS: the top-up - one FRESH kit and a full stack, idempotent; a worn kit sold back is just a used kit (mutants: a worn kit counted as the shelf\'s)', () => {
  const shelf = [createSurvivalItem(TEMPLATE.Campfire, { condition: 2 }), createSurvivalItem(TEMPLATE.Rations, { stackCount: 3 })];
  ensureEndlessProvisions(shelf);
  ensureEndlessProvisions(shelf);
  assert.equal(kits(shelf).length, 2, 'the worn one and a fresh one');
  assert.equal(rations(shelf).stackCount, ENDLESS_RATIONS_STACK);
  assert.equal(shelf.filter((i) => i.templateIndex === TEMPLATE.Rations).length, 1, 'one stack');
});

test('ENDLESS PROVISIONS: an Off meal is eaten - never "not hungry", stamina back by how filling it is, a putrid one still refused; on, the hunger gate is unchanged; useItem passes it with the arc Off (mutants: the Off meal never asked, the stamina never given, putrid eaten)', () => {
  const entity = { stats: { strength: 50, endurance: 50, willpower: 50, agility: 50 }, level: 1, fatigue: 100, items: [] };
  const pool = maxFatigue(entity);
  const pack = [createSurvivalItem(TEMPLATE.Rations, { stackCount: 3 })];
  const r = useSurvivalItem(pack[0], pack, { entity, now: 5000, offMeal: true });
  assert.equal(r.kind, 'ate');
  assert.equal(r.stamina, Math.min(pool - 100, Math.round(pool * Math.min(1, r.satiety / OFF_MEAL_FULL_MINUTES))));
  assert.ok(r.stamina > 0 && entity.fatigue === 100 + r.stamina, 'stamina came back');
  assert.equal(pack[0].stackCount, 2, 'one ration off the stack');
  assert.match(r.text, /^You eat some rations\. You feel your strength returning\.$/);
  const full = { ...entity, fatigue: pool };
  const pack2 = [createSurvivalItem(TEMPLATE.Rations, { stackCount: 2 })];
  const r2 = useSurvivalItem(pack2[0], pack2, { entity: full, now: 5000, offMeal: true });
  assert.deepEqual([r2.kind, r2.stamina, r2.text], ['ate', 0, 'You eat some rations.'], 'full already: eaten all the same, nothing to give');
  const rot = createSurvivalItem(TEMPLATE.Bread, { foodStage: FOOD_STAGE.Putrid });
  assert.equal(useSurvivalItem(rot, [rot], { entity, now: 5000, offMeal: true }).kind, 'notEaten', 'a putrid one is still refused');
  const fed = { items: [], survival: { lastAte: 5000, thirst: 0, notes: {} } };
  assert.equal(useSurvivalItem(createSurvivalItem(TEMPLATE.Rations), [], { entity: fed, now: 5000 }).kind, 'notEaten', 'on, the hunger gate is unchanged');
  // useItem: the arc Off hands offMeal - a fed body eats all the same
  setPref(SURVIVAL_PREF, false);
  const sack = createSurvivalItem(TEMPLATE.Rations, { stackCount: 2 });
  const off = { ...fed, stats: entity.stats, level: 1, fatigue: 10, items: [sack] };
  assert.equal(useItem(sack, off.items, { entity: off, nowMinute: 5000 }).kind, 'ate', 'Off: eaten, not "not hungry"');
  setPref(SURVIVAL_PREF, 'casual');
  const on = { ...fed, items: [createSurvivalItem(TEMPLATE.Rations)] };
  assert.equal(useItem(on.items[0], on.items, { entity: on, nowMinute: 5000 }).kind, 'notEaten', 'on: the tier\'s hunger');
  assert.match(src('src/systems/useItem.js'), /rules: survivalRules\(\) \?\? SURVIVAL_RULES\.casual, offMeal: survivalRules\(\) == null \}\);/);
});
