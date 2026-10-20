import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MENU_KEY_BY_CLIMATE, menuKeyFor, menuTier, breakfastHours, KITCHEN_CLOSED_HOUR, MEAL_WORTH, DRINK_ALCOHOL, MEAL_MINUTES, DRINK_MINUTES,
  TAVERN_DISHES, FOOD_MENUS, BREAKFAST_MENUS, TAVERN_DRINKS, DRINK_MENUS, tavernMenu, tavernEat, tavernDrink, blackout, TAVERN_MENU_TEXT, BLACKOUT_WAKE_HOUR,
} from '../../../src/systems/survival/tavernMenu.js';
import { survivalHudChips, survivalStatusLines, survivalStatusRows, STATUS_TEXT, HUD_NEED_WORDS, needLevel } from '../../../src/systems/survival/status.js';
import { newSurvival, survivalOf, runSurvivalMinutes, NEED } from '../../../src/systems/survival/needs.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';   // BOONS-DEFAULT: Casual's levels named, not the default's
import { STIFF_HOURS } from '../../../src/systems/survival/rest.js';
import { createSurvivalItem } from '../../../src/systems/survival/items.js';
import { TEMPLATE, FOOD_STAGE } from '../../../src/systems/survival/food.js';
import { survivalInfoTokens, itemInfoRows } from '../../../src/systems/item/itemInfo.js';
import { TavernWindow } from '../../../src/ui/tavernWindow.js';
import { NOT_ENOUGH_GOLD_ID } from '../../../src/systems/tavern.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';   // MENU-CLIMATE (FIELD BUGS 2026-09-30, PIN MOVED): the menus read by the enum's names

// ═══ SURV5 (2026-09-18): WHAT THE PLAYER IS TOLD, AND THE TAVERN ═══
//
// The HUD's needs strip and the status page's third box
// (survival/status.js); the survival items' own info box; the mod's
// regional tavern menus with the meal's and the drink's laws and the
// blackout (survival/tavernMenu.js), in the tavern window's one picker.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('SURV5: the menus - the mod\'s keys (the climate\'s where the region names none), three tiers by quality, breakfast from six to ten and a closed kitchen at five; every dish priced; the drinks\' alcohol by their place', () => {
  // MENU-CLIMATE (FIELD BUGS 2026-09-30, PIN MOVED): the keys are the CLIMATES enum's, each read by its name.
  // PIN MOVED (AUDIT C&C I8): the table is the mod's own climate fallback now (regionMenuDay's second switch, the region
  // first - test/systems/survival/auditcc_tavern.test.js): it names nine climates, the Ocean is its default's, the mountains eat the
  // North's and the subtropics the South's; quality 5 is a mid tavern; every meal is worth 240; the dishes, the
  // drinks and their alcohol are the mod's own lists (TAVERN_DISHES, TAVERN_DRINKS, DRINK_ALCOHOL), not keys of the port's
  assert.deepEqual(Object.keys(MENU_KEY_BY_CLIMATE).map(Number), [224, 225, 226, 227, 228, 229, 230, 231, 232]);
  assert.equal(menuKeyFor(CLIMATES.Woodlands), 'n'); assert.equal(menuKeyFor(CLIMATES.Desert), 's'); assert.equal(menuKeyFor(CLIMATES.Swamp), 'se'); assert.equal(menuKeyFor(CLIMATES.Mountain), 'n'); assert.equal(menuKeyFor(CLIMATES.Subtropical), 's'); assert.equal(menuKeyFor(999), 'n');
  assert.deepEqual([menuTier(1), menuTier(4), menuTier(5), menuTier(12), menuTier(13), menuTier(20)], ['low', 'low', 'mid', 'mid', 'high', 'high']);
  assert.equal(breakfastHours(6), true); assert.equal(breakfastHours(9), true); assert.equal(breakfastHours(10), true, 'the mod\'s hour <= 10 (AUDIT SURV D)'); assert.equal(breakfastHours(11), false); assert.equal(KITCHEN_CLOSED_HOUR, 5);
  for (const tier of ['low', 'mid', 'high']) {
    for (const list of [BREAKFAST_MENUS[tier], ...Object.values(FOOD_MENUS[tier])]) {
      assert.ok(TAVERN_DISHES[list].length >= 1, `${tier}: ${list} has dishes`);
      for (const d of TAVERN_DISHES[list]) assert.ok(Number.isInteger(d.price) && d.price > 0 && d.name, `${d.name} is priced`);
    }
    for (const list of Object.values(DRINK_MENUS[tier])) {
      assert.equal(TAVERN_DRINKS[list].length, DRINK_ALCOHOL[tier].length, `${tier}: ${list} has a place for each of the tier's alcohols`);
      for (const k of TAVERN_DRINKS[list]) assert.ok(k.price > 0 && k.name);
    }
  }
  assert.equal(MEAL_WORTH, 240);
  assert.deepEqual(DRINK_ALCOHOL, { low: [0, 0, 10, 12, 25], mid: [0, 0, 10, 12, 15, 20, 30], high: [0, 0, 0, 10, 12, 15, 20, 20, 40] });
  const m = tavernMenu({ climateIndex: 232, quality: 15, hour: 7 });
  assert.deepEqual([m.key, m.tier, m.list, m.closed], ['n', 'high', 'breakHigh', false]);
  assert.equal(m.rows[0].text, ' 5 gold   Oatmeal with Berries'); assert.equal(m.rows[0].worth, 240);
  const header = m.rows.findIndex((r) => r.kind === 'header');
  assert.equal(m.rows[header].text, TAVERN_MENU_TEXT.drinksHeader); assert.equal(header, 3);
  assert.equal(m.rows.at(-1).text, '30 gold   Nereid Wine'); assert.equal(m.rows.at(-1).strength, 40);
  const noon = tavernMenu({ climateIndex: 232, quality: 15, hour: 12 });
  assert.equal(noon.list, 'nHigh'); assert.equal(noon.rows[0].name, 'Gorapple Cheesecake'); assert.equal(noon.rows[0].worth, 240);
  const five = tavernMenu({ climateIndex: 232, quality: 3, hour: 5 });
  assert.equal(five.closed, true); assert.equal(five.rows[0].kind, 'header', 'no food at five, the drinks stand');
});

test('SURV5: the meal and the drink - the mod\'s marker law (too full under the worth, four hours back past it, the worth banked); the counter by strength and the endurance bands; the blackout\'s morning', () => {
  const s = { ...newSurvival(1000), lastAte: 700, thirst: 60, notes: { hunger: 'peckish' } };
  const r = tavernEat(s, 1000, 120);
  assert.deepEqual(r, { ok: true, text: TAVERN_MENU_TEXT.invigorated, minutes: MEAL_MINUTES }); assert.equal(MEAL_MINUTES, 30);
  assert.equal(s.lastAte, 820, 'the worth banks'); assert.deepEqual(s.notes, { hunger: 'peckish' }, 'AUDIT SURV-TIERS (the third pass): the meal leaves the stage record to the minute law - its wipe re-announced the milder stage it left');
  assert.equal(tavernEat({ lastAte: 990 }, 1000, 120).ok, false);
  assert.equal(tavernEat({ lastAte: 990 }, 1000, 120).text, TAVERN_MENU_TEXT.tooFull);
  const far = { lastAte: 0, notes: {} };
  tavernEat(far, 2000, 200);
  // PIN MOVED (AUDIT C&C I3): at the meal's END - its half hour passes first, as TavernFood passes it
  assert.equal(far.lastAte, 2000 + MEAL_MINUTES - NEED.PECKISH_AT + 200, 'past worth + 240 the marker starts four hours back');
  const d = { ...newSurvival(0), thirst: 60, drunk: 0 };
  // PIN MOVED (AUDIT C&C I6): a soft drink refreshes - five fatigue, no magicka - where "fortifies" was said over the milk
  assert.deepEqual(tavernDrink(d, 0, { endurance: 50 }), { text: TAVERN_MENU_TEXT.refreshed, blackout: false, minutes: DRINK_MINUTES, fatigue: 5, magicka: 0 }); assert.equal(DRINK_MINUTES, 15);
  // TAVERN-DRINK (FIELD BUGS 2026-09-30, PIN MOVED): 20 -> 0 - a tavern drink quenches the thirst whole, whatever its kind (test/systems/survival/fb0930_cc_drink.test.js)
  assert.equal(d.thirst, 0, 'a drink quenches the thirst whole'); assert.equal(d.drunk, 0, 'a soft drink counts nothing');
  assert.equal(tavernDrink(d, 35, { endurance: 50 }).text, TAVERN_MENU_TEXT.gettingDrunk); assert.equal(d.drunk, 35);
  d.drunk = 41; assert.equal(tavernDrink(d, 0, { endurance: 50 }).text, TAVERN_MENU_TEXT.veryDrunk, 'past endurance - 10');
  const b = tavernDrink(d, 10, { endurance: 50 });
  assert.equal(b.blackout, true); assert.equal(b.text, TAVERN_MENU_TEXT.blackout); assert.equal(d.drunk, 51);
  const night = blackout(d, 1440 + 23 * 60, { endurance: 50 });
  assert.equal(night.minutes, 7 * 60, 'to six the next morning'); assert.equal(d.drunk, 12, 'a hangover\'s worth'); assert.equal(BLACKOUT_WAKE_HOUR, 6);
  assert.equal(blackout({}, 1440 * 2 + 120).minutes, 4 * 60, 'blacked out at two in the morning, up at six the same day');
});

test('NEED-TIER: every felt need says how bad on its own ladder - its stage of its stages, mildest first, the temperature\'s two ways each their own; Stiff one stage and no tier (Mac: "the debuffs you get from Climates and Calories no longer show the severity")', () => {
  const e = { survival: { ...newSurvival(0), lastAte: 0, thirst: 90, wet: 40, sleepDebt: 5, drunk: 45, felt: -35, stiffUntil: 5000 } };
  assert.deepEqual(survivalHudChips(e, 800).map((c) => `${c.key}:${c.tier}/${c.of}`),
    ['hunger:2/3', 'thirst:2/3', 'sleep:1/3', 'wet:2/4', 'temp:2/3', 'stiff:undefined/undefined', 'drunk:2/2']);
  const hot = { survival: { ...newSurvival(0), lastAte: -10, felt: 25 } };
  assert.deepEqual(survivalHudChips(hot, 0).filter((c) => c.key === 'temp').map((c) => [c.text, c.tier, c.of]), [['Warm', 1, 3]], 'the warm way\'s first stage, not the cold\'s fourth');
  e.survival.drunk = 30;
  assert.deepEqual(survivalHudChips(e, 800, { endurance: 50 }).filter((c) => c.key === 'drunk').map((c) => [c.text, c.tier, c.of]), [['Drunk', 1, 2]]);
});

test('SURV5: the strip and the page - one chip a felt need, nothing while every need is met; the page\'s lines, the vampire\'s one, the mod\'s drunk bands', () => {
  const e = { survival: null };
  assert.deepEqual(survivalHudChips(e, 0), [], 'no record, no strip');
  e.survival = { ...newSurvival(0), lastAte: -10, felt: 0 };
  assert.deepEqual(survivalHudChips(e, 100), [], 'fed, watered, rested, dry, comfortable: nothing');
  e.survival = { ...newSurvival(0), lastAte: 0, thirst: 90, wet: 40, sleepDebt: 5, drunk: 45, felt: -35, stiffUntil: 5000 };
  assert.deepEqual(survivalHudChips(e, 800).map((c) => `${c.key}:${c.text}:${c.level}`),
    ['hunger:Hungry:warn', 'thirst:Parched:danger', 'sleep:Tired:warn', 'wet:Wet:warn', 'temp:Freezing:danger', 'stiff:Stiff:warn', 'drunk:Very drunk:danger']);
  assert.equal(HUD_NEED_WORDS.hunger.starving, 'Starving');   // PIN MOVED (AUDIT C&C S5): the table is words; the level is the tier's (needLevel)
  assert.equal(needLevel('hunger', 'starving'), 'warn', 'Starving costs nothing in the default tier - Boons since BOONS-DEFAULT');   // PIN MOVED
  assert.equal(needLevel('hunger', 'starving', { rules: SURVIVAL_RULES.casual }), 'danger', 'and costs in Casual');
  assert.deepEqual(survivalStatusLines(e, 800, { endurance: 50 }), [
    STATUS_TEXT.hunger.hungry, STATUS_TEXT.thirst.parched, STATUS_TEXT.sleep.tired, STATUS_TEXT.wet.wet, 'You feel freezing.',
    'Felt temperature: -35 (comfortable from -10 to +10).',   // PIN MOVED (TEMP-UI): the number under the word
    STATUS_TEXT.stiff, STATUS_TEXT.veryDrunk,
  ]);
  assert.equal(STATUS_TEXT.hunger.hungry, 'You could do with a decent meal.', 'the mod\'s own line');
  e.survival.drunk = 30; assert.equal(survivalStatusLines(e, 800, { endurance: 50 }).at(-1), STATUS_TEXT.drunk, 'past half the endurance: drunk');
  e.survival.drunk = 20; assert.equal(survivalStatusLines(e, 800, { endurance: 50 }).some((l) => /drunk/.test(l)), false);
  // PIN MOVED (AUDIT SURV-BOONS C12): the vampire's one line in the needs' place, then the body's own - the wet and the
  // temperature the strip shows a vampire too (the drink at 20 is under the band)
  assert.deepEqual(survivalStatusLines(e, 800, { vampire: true }), [STATUS_TEXT.vampire, STATUS_TEXT.wet.wet, 'You feel freezing.', 'Felt temperature: -35 (comfortable from -10 to +10).', STATUS_TEXT.stiff]);
  const fed = { survival: { ...newSurvival(0), lastAte: 1000 - 30, felt: 0 } };
  assert.deepEqual(survivalStatusLines(fed, 1000), [STATUS_TEXT.invigorated, STATUS_TEXT.thirst.fine, STATUS_TEXT.sleep.rested, 'You are comfortable.', 'Felt temperature: 0 (comfortable from -10 to +10).']);   // PIN MOVED (TEMP-UI)
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
  assert.deepEqual(t.map((r) => r.text), ['Stale Bread', 'Weight: 1.50 kilograms', 'Nourishes for 90 minutes (stale)']);
  assert.deepEqual(itemInfoRows(bread, rows).map((r) => r.text), t.map((r) => r.text), 'the box reads the built tokens, not a record');
  const fish = createSurvivalItem(TEMPLATE.RawFish);
  assert.equal(survivalInfoTokens(fish).at(-1).text, 'Raw. Cook it at a fire.');
  const skin = createSurvivalItem(TEMPLATE.Waterskin, { water: 1.25 });
  assert.deepEqual(survivalInfoTokens(skin).map((r) => r.text), ['Waterskin', 'Weight: 1.75 kilograms', 'Water: 1.3 of 2.0 kg']);
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.Campfire, { condition: 1 })).at(-1).text, '1 night of fuel', 'REST2: a Campfire\'s uses are nights of fuel');
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.CampingEquipment)).at(-1).text, '50 uses left');
  assert.equal(survivalInfoTokens(createSurvivalItem(TEMPLATE.Skillet)).at(-1).text, 'Cooking at a campfire goes twice as fast.');
  assert.equal(itemInfoRows({ group: 'Weapons', templateIndex: 113 }, rows)[0].text, 'record 1001', 'DFU\'s own items keep their records');
});

test('SURV5: the tavern window - the survival menu in the one picker: a meal charges and banks, a drink counts, the minutes pass, the kitchen closes at five, the blackout takes the night; the mod off is DFU\'s chain', () => {
  _resetForTests(); setPref('survival', 'hard');   // SURV-TIERS: the blackout below is Hard's (Casual's barkeep stops pouring - survtiers.test.js)
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
  assert.equal(a.entity.goldPieces, 90); assert.deepEqual(a.passed, [MEAL_MINUTES]); assert.equal(a.entity.survival.lastAte, a.now + MEAL_MINUTES - NEED.PECKISH_AT + 240, 'the marker four hours back of the meal\'s end, the worth banked');   // PIN MOVED (AUDIT C&C I3): the end, its half hour passed first
  assert.equal(a.entity.lastTimePlayerAteOrDrankAtTavern, a.now, 'DFU\'s own stamp too');
  assert.equal(a.w.flow.top.onPick(picker.indexOf(TAVERN_MENU_TEXT.drinksHeader))?.[0]?.picker, a.w.flow.top.picker, 'the header picks nothing - the picker stands (AUDIT SURV C: a divider is not a door out)');
  const wine = picker.indexOf('30 gold   Nereid Wine');
  a.w.flow.top.onPick(wine);
  assert.equal(a.entity.survival.drunk, 40); assert.equal(a.entity.goldPieces, 60); assert.deepEqual(a.passed, [MEAL_MINUTES, DRINK_MINUTES]);   // PIN MOVED (AUDIT C&C I8): Nereid Wine is the mod's alcoHigh[8], 40 (the port's name guess made it a wine's 20)
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
    // STATUS-LIVE (2026-09-22): the readout does not PAUSE, so there is
    // nothing to route it a key and AddNextMessageBox cannot advance -
    // the three pages are one page, composed once in ui/statusBox.js.
    // What each host still owes is this arc's own half: the mod's
    // switch, the world's minutes, the vampirism and the endurance,
    // fed as SURV5's own bag or withheld as null when the mod is off.
    assert.match(read(f), /survival: survivalOn\(\) \? \{ minutes: Math\.floor\(ownMinutes\(\)\), vampire: !!liveVampirism\(playerEntity\), endurance: liveStat\(playerEntity, 'endurance'\) \} : null,/, `${f}: the third box (LIVED1: on the character's own clock)`);
  }
  // ...and the ONE place it becomes rows, so the page cannot be dropped
  // by a host that forgets it.
  assert.match(read('src/ui/statusBox.js'), /if \(survival\) rows\.push\('', \.\.\.survivalStatusRows\(entity, survival\.minutes, \{ rules: survivalRules\(\), \.\.\.survival \}\)\);/);   // PIN MOVED (AUDIT C&C S11): and the live tier, read once
  const hud = read('src/ui/enhanced/enhancedHud.js');
  // UI3: the needs are the status widget's tiles - a felt need amber, one that costs red
  assert.match(hud, /const needs = survivalOn\(\) \? survivalHudChips\(vitals, Math\.floor\(ownMinutes\(\)\), \{ vampire: !!liveVampirism\(vitals\), endurance: liveStat\(vitals, 'endurance'\), rules: survivalRules\(\), live \}\) : \[\];/);   // PIN MOVED (AUDIT SURV-BOONS C14): and the live tier   // PIN MOVED (AUDIT C&C S5/S9): its rules, and the frame's one live reading
  assert.match(hud, /const all = statusTiles\(\{ spells, powers, afflictions: afflictionRows\(vitals\), needs, rested \}\);/);   // REST1: and the Next night tile
  assert.match(read('src/ui/enhanced/enhancedStyle.js'), /\.hst-cell\.danger \{/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /climateIndex: \(\) => host\.climateIndex\?\.\(\) \?\? 232,\s*\n\s*advanceMinutes: \(n\) => interiorTicker\.advance\(n\),\s*\n\s*endurance: \(\) => liveStat\(playerEntity, 'endurance'\),/);
  assert.match(read('src/scenes/world.js'), /climateIndex: \(\) => maps\.getClimateIndex\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\),   \/\/ SURV5/);
  assert.match(read('src/scenes/exterior.js'), /climateIndex: \(\) => locClimateIndex,   \/\/ SURV5/);
  assert.match(read('src/ui/tavernWindow.js'), /if \(survivalOn\(\) && typeof h\.climateIndex === 'function'\) \{ this\._survivalFood\(\); return; \}/);
  assert.match(read('src/systems/item/itemInfo.js'), /if \(isSurvivalItem\(item\)(?: \|\| isRestItem\(item\))?\) record = survivalInfoTokens\(item\);/);
  assert.match(read('src/systems/survival/needs.js'), /s\.felt = temp\.felt;/);
  for (const f of ['status', 'tavernMenu']) {
    assert.doesNotMatch(read(`src/systems/survival/${f}.js`), /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/effects|document\.|window\./, `${f}.js is pure`);
  }
});
