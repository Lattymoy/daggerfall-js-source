import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MENU_KEY_BY_CLIMATE, menuKeyFor, menuTier, breakfastHours, KITCHEN_CLOSED_HOUR, MEAL_WORTH, DRINK_STRENGTH, MEAL_MINUTES, DRINK_MINUTES,
  FOOD_MENUS, DRINK_MENUS, drinkMenuFor, drinkKind, tavernMenu, tavernEat, tavernDrink, blackout, TAVERN_MENU_TEXT, BLACKOUT_WAKE_HOUR,
} from '../src/systems/survival/tavernMenu.js';
import { survivalHudChips, survivalStatusLines, survivalStatusRows, STATUS_TEXT, HUD_NEED_WORDS } from '../src/systems/survival/status.js';
import { newSurvival, survivalOf, runSurvivalMinutes, NEED } from '../src/systems/survival/needs.js';
import { STIFF_HOURS } from '../src/systems/survival/rest.js';
import { createSurvivalItem } from '../src/systems/survival/items.js';
import { TEMPLATE, FOOD_STAGE } from '../src/systems/survival/food.js';
import { survivalInfoTokens, itemInfoRows } from '../src/systems/itemInfo.js';
import { TavernWindow } from '../src/ui/tavernWindow.js';
import { NOT_ENOUGH_GOLD_ID } from '../src/systems/tavern.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';

// ═══ SURV5 (2026-09-18): WHAT THE PLAYER IS TOLD, AND THE TAVERN ═══
//
// The HUD's needs strip and the status page's third box
// (survival/status.js); the survival items' own info box; the mod's
// regional tavern menus with the meal's and the drink's laws and the
// blackout (survival/tavernMenu.js), in the tavern window's one picker.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('SURV5: the menus - the mod\'s six keys by climate, three tiers by quality, breakfast from six to ten and a closed kitchen at five; every dish priced; the bay drinks the south\'s', () => {
  assert.deepEqual(Object.keys(MENU_KEY_BY_CLIMATE).map(Number), [224, 225, 226, 227, 228, 229, 230, 231, 232, 233]);
  assert.equal(menuKeyFor(232), 'n'); assert.equal(menuKeyFor(225), 's'); assert.equal(menuKeyFor(229), 'se'); assert.equal(menuKeyFor(227), 'ne'); assert.equal(menuKeyFor(230), 'b'); assert.equal(menuKeyFor(999), 'n');
  assert.deepEqual([menuTier(1), menuTier(5), menuTier(6), menuTier(12), menuTier(13), menuTier(20)], ['low', 'low', 'mid', 'mid', 'high', 'high']);
  assert.equal(breakfastHours(6), true); assert.equal(breakfastHours(9), true); assert.equal(breakfastHours(10), false); assert.equal(KITCHEN_CLOSED_HOUR, 5);
  for (const key of ['n', 'ne', 'se', 's', 'b']) {
    for (const list of ['breakfast', 'low', 'mid', 'high']) {
      assert.ok(FOOD_MENUS[key][list].length >= 2, `${key}.${list} has dishes`);
      for (const d of FOOD_MENUS[key][list]) assert.ok(Number.isInteger(d.price) && d.price > 0 && d.name, `${d.name} is priced`);
    }
    for (const tier of ['low', 'mid', 'high']) for (const k of drinkMenuFor(key)[tier]) assert.ok(k.price > 0 && k.name);
  }
  assert.equal(drinkMenuFor('b'), DRINK_MENUS.s); assert.equal(drinkMenuFor('n'), DRINK_MENUS.n);
  assert.deepEqual(MEAL_WORTH, { breakfast: 120, low: 120, mid: 200, high: 240 });
  assert.deepEqual(DRINK_STRENGTH, { soft: 0, ale: 10, wine: 20, spirit: 35 });
  assert.deepEqual(['Goats Milk', 'Herbal Tea', 'Berry Juice', 'Coffee', 'Red Wine', 'Port', 'Moonshine', 'Rye Liquor', 'Acai Mazte', 'Cyrodiil Brandy', 'Rum', 'Orc Grog', 'Ale', 'Stout', 'Mead', 'Apple Cider'].map(drinkKind),
    ['soft', 'soft', 'soft', 'soft', 'wine', 'wine', 'spirit', 'spirit', 'spirit', 'spirit', 'spirit', 'spirit', 'ale', 'ale', 'ale', 'ale']);
  const m = tavernMenu({ climateIndex: 232, quality: 15, hour: 7 });
  assert.deepEqual([m.key, m.tier, m.list, m.closed], ['n', 'high', 'breakfast', false]);
  assert.equal(m.rows[0].text, ' 5 gold   Oatmeal with Berries'); assert.equal(m.rows[0].worth, 120);
  const header = m.rows.findIndex((r) => r.kind === 'header');
  assert.equal(m.rows[header].text, TAVERN_MENU_TEXT.drinksHeader); assert.equal(header, 3);
  assert.equal(m.rows.at(-1).text, '30 gold   Nereid Wine'); assert.equal(m.rows.at(-1).strength, 20);
  const noon = tavernMenu({ climateIndex: 232, quality: 15, hour: 12 });
  assert.equal(noon.list, 'high'); assert.equal(noon.rows[0].name, 'Gorapple Cheesecake'); assert.equal(noon.rows[0].worth, 240);
  const five = tavernMenu({ climateIndex: 232, quality: 3, hour: 5 });
  assert.equal(five.closed, true); assert.equal(five.rows[0].kind, 'header', 'no food at five, the drinks stand');
});

test('SURV5: the meal and the drink - the mod\'s marker law (too full under the worth, four hours back past it, the worth banked); the counter by strength and the endurance bands; the blackout\'s morning', () => {
  const s = { ...newSurvival(1000), lastAte: 700, thirst: 60, notes: { 'hunger:peckish': 1 } };
  const r = tavernEat(s, 1000, 120);
  assert.deepEqual(r, { ok: true, text: TAVERN_MENU_TEXT.invigorated, minutes: MEAL_MINUTES }); assert.equal(MEAL_MINUTES, 30);
  assert.equal(s.lastAte, 820, 'the worth banks'); assert.deepEqual(Object.keys(s.notes), [], 'the hunger notes clear');
  assert.equal(tavernEat({ lastAte: 990 }, 1000, 120).ok, false);
  assert.equal(tavernEat({ lastAte: 990 }, 1000, 120).text, TAVERN_MENU_TEXT.tooFull);
  const far = { lastAte: 0, notes: {} };
  tavernEat(far, 2000, 200);
  assert.equal(far.lastAte, 2000 - NEED.PECKISH_AT + 200, 'past worth + 240 the marker starts four hours back');
  const d = { ...newSurvival(0), thirst: 60, drunk: 0 };
  assert.deepEqual(tavernDrink(d, 0, { endurance: 50 }), { text: TAVERN_MENU_TEXT.fortified, blackout: false, minutes: DRINK_MINUTES }); assert.equal(DRINK_MINUTES, 15);
  assert.equal(d.thirst, 20, 'a drink quenches forty'); assert.equal(d.drunk, 0, 'a soft drink counts nothing');
  assert.equal(tavernDrink(d, 35, { endurance: 50 }).text, TAVERN_MENU_TEXT.gettingDrunk); assert.equal(d.drunk, 35);
  d.drunk = 41; assert.equal(tavernDrink(d, 0, { endurance: 50 }).text, TAVERN_MENU_TEXT.veryDrunk, 'past endurance - 10');
  const b = tavernDrink(d, 10, { endurance: 50 });
  assert.equal(b.blackout, true); assert.equal(b.text, TAVERN_MENU_TEXT.blackout); assert.equal(d.drunk, 51);
  const night = blackout(d, 1440 + 23 * 60, { endurance: 50 });
  assert.equal(night.minutes, 7 * 60, 'to six the next morning'); assert.equal(d.drunk, 12, 'a hangover\'s worth'); assert.equal(BLACKOUT_WAKE_HOUR, 6);
  assert.equal(blackout({}, 1440 * 2 + 120).minutes, 4 * 60, 'blacked out at two in the morning, up at six the same day');
});

test('SURV5: the strip and the page - one chip a felt need, nothing while every need is met; the page\'s lines, the vampire\'s one, the mod\'s drunk bands', () => {
  const e = { survival: null };
  assert.deepEqual(survivalHudChips(e, 0), [], 'no record, no strip');
  e.survival = { ...newSurvival(0), lastAte: -10, felt: 0 };
  assert.deepEqual(survivalHudChips(e, 100), [], 'fed, watered, rested, dry, comfortable: nothing');
  e.survival = { ...newSurvival(0), lastAte: 0, thirst: 90, wet: 40, sleepDebt: 5, drunk: 45, felt: -35, stiffUntil: 5000 };
  assert.deepEqual(survivalHudChips(e, 800).map((c) => `${c.key}:${c.text}:${c.level}`),
    ['hunger:Hungry:warn', 'thirst:Parched:danger', 'sleep:Tired:warn', 'wet:Wet:warn', 'temp:Freezing:danger', 'stiff:Stiff:warn', 'drunk:Very drunk:danger']);
  assert.equal(HUD_NEED_WORDS.hunger.starving[1], 'danger');
  assert.deepEqual(survivalStatusLines(e, 800, { endurance: 50 }), [
    STATUS_TEXT.hunger.hungry, STATUS_TEXT.thirst.parched, STATUS_TEXT.sleep.tired, STATUS_TEXT.wet.wet, 'You feel freezing.', STATUS_TEXT.stiff, STATUS_TEXT.veryDrunk,
  ]);
  assert.equal(STATUS_TEXT.hunger.hungry, 'You could do with a decent meal.', 'the mod\'s own line');
  e.survival.drunk = 30; assert.equal(survivalStatusLines(e, 800, { endurance: 50 }).at(-1), STATUS_TEXT.drunk, 'past half the endurance: drunk');
  e.survival.drunk = 20; assert.equal(survivalStatusLines(e, 800, { endurance: 50 }).some((l) => /drunk/.test(l)), false);
  assert.deepEqual(survivalStatusLines(e, 800, { vampire: true }), [STATUS_TEXT.vampire]);
  const fed = { survival: { ...newSurvival(0), lastAte: 1000 - 30, felt: 0 } };
  assert.deepEqual(survivalStatusLines(fed, 1000), [STATUS_TEXT.invigorated, STATUS_TEXT.thirst.fine, STATUS_TEXT.sleep.rested, 'You are comfortable.']);
  assert.deepEqual(survivalStatusRows(fed, 1000)[0], { text: STATUS_TEXT.invigorated, center: true });
  // the felt reading rides the record from the minute law, so the strip needs no env
  const p = { stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, items: [], activeEffects: [], health: 50, fatigue: 3000, raceId: 1 };
  runSurvivalMinutes(p, 0, 2, { climateIndex: 225, month: 5, hour: 13, weather: 'sunny', inSunlight: true }, { worn: null, sinks: {} });
  assert.ok(Number.isFinite(survivalOf(p).felt), 'the record carries the felt temperature');
  assert.ok(survivalHudChips(p, 2).some((c) => c.key === 'temp'), 'a desert noon shows on the strip');
});

test('SURV5: the info box - a survival item\'s built tokens: the name, the weight, a food\'s worth and stage, a skin\'s water, the gear\'s uses, the skillet\'s word', () => {
  const rows = (id) => [{ text: `record ${id}`, center: true }];
  const bread = createSurvivalItem(TEMPLATE.Bread, { foodStage: FOOD_STAGE.Stale });
  const t = survivalInfoTokens(bread);
  assert.deepEqual(t.map((r) => r.text), ['Stale Bread', 'Weight: 1.50 kg', 'Nourishes for 90 minutes (stale)']);
  assert.deepEqual(itemInfoRows(bread, rows).map((r) => r.text), t.map((r) => r.text), 'the box reads the built tokens, not a record');
  const fish = createSurvivalItem(TEMPLATE.RawFish);
  assert.equal(survivalInfoTokens(fish).at(-1).text, 'Raw - cook it at a fire.');
  const skin = createSurvivalItem(TEMPLATE.Waterskin, { water: 1.25 });
  assert.deepEqual(survivalInfoTokens(skin).map((r) => r.text), ['Waterskin', 'Weight: 1.75 kg', 'Water: 1.3 of 2.0 kg']);
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.Campfire, { condition: 1 })).at(-1).text, '1 use left');
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.CampingEquipment)).at(-1).text, '50 uses left');
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.Skillet)).at(-1).text, 'Cooking at a campfire goes twice as fast.');
  assert.equal(itemInfoRows({ group: 'Weapons', templateIndex: 113 }, rows)[0].text, 'record 1001', 'DFU\'s own items keep their records');
});

test('SURV5: the tavern window - the survival menu in the one picker: a meal charges and banks, a drink counts, the minutes pass, the kitchen closes at five, the blackout takes the night; the mod off is DFU\'s chain', () => {
  _resetForTests(); setPref('survival', true);
  const mk = ({ now = 1440 * 10 + 12 * 60, gold = 100, climate = 232, quality = 15 } = {}) => {
    const entity = { name: 'Mac', goldPieces: gold, health: 20, maxHealth: 40, stats: { endurance: 50 }, rentedRooms: [], items: [], activeEffects: [], lastTimePlayerAteOrDrankAtTavern: 0, survival: { ...newSurvival(now), lastAte: now - 600 } };   // ten hours since a meal
    const passed = [];
    const w = new TavernWindow({
      entity, rows: (id) => [{ text: `r${id}`, center: true }], now: () => now, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp',
      quality: () => quality, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
      heal: () => {}, onTalk: () => {}, onClose: () => {}, rolls: () => 0.5,
      climateIndex: () => climate, advanceMinutes: (n) => passed.push(n), endurance: () => 50,
    });
    return { w, entity, passed, now };
  };
  const a = mk();
  a.w._food();
  const picker = a.w.flow.top.picker;
  assert.ok(Array.isArray(picker) && picker[0] === '10 gold   Gorapple Cheesecake', 'the noon high menu');
  assert.equal(a.w.flow.top.picker.includes(TAVERN_MENU_TEXT.drinksHeader), true);
  const boxes = a.w.flow.top.onPick(0);
  assert.equal(boxes[0].rows[0].text, TAVERN_MENU_TEXT.invigorated);
  assert.equal(a.entity.goldPieces, 90); assert.deepEqual(a.passed, [MEAL_MINUTES]); assert.equal(a.entity.survival.lastAte, a.now - NEED.PECKISH_AT + 240, 'the marker four hours back, the worth banked');
  assert.equal(a.entity.lastTimePlayerAteOrDrankAtTavern, a.now, 'DFU\'s own stamp too');
  assert.equal(a.w.flow.top.onPick(picker.indexOf(TAVERN_MENU_TEXT.drinksHeader)), null, 'the header picks nothing');
  const wine = picker.indexOf('30 gold   Nereid Wine');
  a.w.flow.top.onPick(wine);
  assert.equal(a.entity.survival.drunk, 20); assert.equal(a.entity.goldPieces, 60); assert.deepEqual(a.passed, [MEAL_MINUTES, DRINK_MINUTES]);
  const poor = mk({ gold: 3 });
  poor.w._food();
  assert.equal(poor.w.flow.top.onPick(0)[0].rows[0].text, `r${NOT_ENOUGH_GOLD_ID}`, 'not enough gold');
  assert.equal(poor.entity.goldPieces, 3);
  const five = mk({ now: 1440 * 10 + 5 * 60 });
  five.w._food();
  assert.equal(five.w.flow.top.rows[0].text, TAVERN_MENU_TEXT.closed); assert.equal(five.w.flow.top.picker, undefined);
  const b = mk({ now: 1440 * 10 + 23 * 60, quality: 10 });   // a mid tavern pours Rye Liquor
  b.entity.survival = { ...newSurvival(b.now), drunk: 45 };
  b.w._food();
  const rum = b.w.flow.top.picker.findIndex((t) => /Moonshine|Brandy|Rum|Liquor/.test(t));
  const out = b.w.flow.top.onPick(rum);
  assert.equal(out[0].rows[0].text, TAVERN_MENU_TEXT.blackout);
  assert.deepEqual(b.passed, [DRINK_MINUTES, 7 * 60 - DRINK_MINUTES], 'the night passes to six');
  assert.equal(b.entity.survival.drunk, 12); assert.equal(b.entity.survival.stiffUntil, b.now + 7 * 60 + STIFF_HOURS * 60, 'a rough morning');
  setPref('survival', false);
  const off = mk();
  off.w._food();
  assert.equal(off.w.flow.top.picker.length, 11, 'DFU\'s eleven-line menu with the mod off');
  _resetForTests();
});

test('SURV5: by source - the four hosts chain the third box, the enhanced HUD carries the strip, the interior hands the tavern its climate and clock', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    assert.match(read(f), /if \(survivalOn\(\)\) _box\.addNext\(survivalStatusRows\(playerEntity, Math\.floor\(worldMinutes\(\)\), \{ vampire: !!liveVampirism\(playerEntity\), endurance: liveStat\(playerEntity, 'endurance'\) \}\)\);/, `${f}: the third box`);
  }
  const hud = read('src/ui/enhancedHud.js');
  assert.match(hud, /const needs = el\('div', 'hud-needs'\);/); assert.match(hud, /const chips = survivalOn\(\) \? survivalHudChips\(vitals, Math\.floor\(worldMinutes\(\)\)\) : \[\];/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.hud-need\.danger \{/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /climateIndex: \(\) => host\.climateIndex\?\.\(\) \?\? 232,\s*\n\s*advanceMinutes: \(n\) => interiorTicker\.advance\(n\),\s*\n\s*endurance: \(\) => liveStat\(playerEntity, 'endurance'\),/);
  assert.match(read('src/scenes/world.js'), /climateIndex: \(\) => maps\.getClimateIndex\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\),   \/\/ SURV5/);
  assert.match(read('src/scenes/exterior.js'), /climateIndex: \(\) => locClimateIndex,   \/\/ SURV5/);
  assert.match(read('src/ui/tavernWindow.js'), /if \(survivalOn\(\) && typeof h\.climateIndex === 'function'\) \{ this\._survivalFood\(\); return; \}/);
  assert.match(read('src/systems/itemInfo.js'), /if \(isSurvivalItem\(item\)\) record = survivalInfoTokens\(item\);/);
  assert.match(read('src/systems/survival/needs.js'), /s\.felt = temp\.felt;/);
  for (const f of ['status', 'tavernMenu']) {
    assert.doesNotMatch(read(`src/systems/survival/${f}.js`), /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/effects|document\.|window\./, `${f}.js is pure`);
  }
});
