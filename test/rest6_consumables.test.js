// REST6 (2026-10-03, bible/06-Systems/Rest-Arc.md section 6; Mac: "introduce other type of consumables that can fill
// in the gaps when a campfire isn't available"): THE SEVEN THAT FILL THE GAPS - 1700-1706, registered at import and
// known to the save; each answers one gap and none replaces the fire. The Bedroll (a rough rest point, a 10 s channel,
// ten nights), the Ember Jar (a one-night fire, never picked up), Firewood (+3 to a Campfire), the Tonic (fatigue, the
// sleep need), the Candle (a kneel for magicka), the Salts (an hour's wakefulness, the debt after), the Draught (the
// next night a bed's). Online the shelves, piles and foes wait for REST_ITEMS_ONLINE - the templates ship a release
// ahead (section 6's last rule); offline they come with Climates & Calories.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REST_ITEM, REST_ITEM_ROWS, REST_ITEMS_ONLINE, restItemsAvailable, createRestItem, restItemLines, useTonic, useSalts,
  useDraught, useCandle, litCandle, meditate, snuffCandle, draughtTaken, restItemsStock, rollRestLoot, REST_PILE_CHANCES,
  REST_FOE_CHANCES, isDeepPileKey, REST_ITEM_TEXT, BEDROLL_CHANNEL_SECONDS, spendCharge,
} from '../src/systems/restItems.js';
import { templateByIndex, itemUseHandler } from '../src/systems/itemTemplates.js';
import { wakingHeld, landWakingDebt, survivalStatMods, newSurvival, WAKING_DEBT_HOURS } from '../src/systems/survival/needs.js';
import { placeCampItem, campMenu, campExpired, fireLit, CAMP_KIND, newCamp } from '../src/systems/survival/camp.js';
import { createSurvivalItem, CAMPFIRE_USES } from '../src/systems/survival/items.js';
import { TEMPLATE } from '../src/systems/survival/food.js';
import { createCamps } from '../src/scenes/camps.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setSharedClock, setWorldMinutes, setOwnMinutes } from '../src/systems/worldTick.js';
import { survivalInfoTokens } from '../src/systems/itemInfo.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { REST_ACT_TEXT, REST_CHANNEL_SECONDS } from '../src/systems/restAct.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);
afterEach(() => { setSharedClock(null); _resetForTests(); snuffCandle(); });

test('REST6 the seven: 1700-1706 registered with their weights, charges and prices; the charged ones never stack; the save knows them', () => {
  assert.deepEqual(REST_ITEM_ROWS.map((r) => [r.index, r.name, r.baseWeight, r.hitPoints, r.basePrice, r.stackable]), [
    [1700, 'Bedroll', 2.5, 10, 80, false], [1701, 'Ember Jar', 0.5, 1, 15, true], [1702, 'Firewood', 1.5, 1, 8, true],
    [1703, 'Restorative Tonic', 0.2, 1, 30, true], [1704, 'Meditation Candle', 0.3, 3, 35, false], [1705, 'Waking Salts', 0.1, 3, 40, false],
    [1706, 'Sleeping Draught', 0.2, 1, 45, true],
  ]);
  for (const r of REST_ITEM_ROWS) assert.equal(templateByIndex(r.index)?.name, r.name);
  const bed = createRestItem(REST_ITEM.Bedroll);
  assert.deepEqual([bed.name, bed.currentCondition, bed.group], ['Bedroll', 10, 'UselessItems2']);
  assert.equal(createRestItem(REST_ITEM.Firewood, { stackCount: 4 }).stackCount, 4);
  assert.match(rd('src/systems/save.js'), /import '\.\/restItems\.js';/);
  for (const t of Object.values(REST_ITEM)) assert.equal(typeof itemUseHandler(t), 'function', `${t} has its use`);
});

test('REST6 a release ahead: online no source mints one until REST_ITEMS_ONLINE; offline with Climates & Calories', () => {
  assert.equal(REST_ITEMS_ONLINE, false);
  assert.equal(restItemsAvailable(true), false);
  _resetForTests(); setPref('survival', false);
  assert.equal(restItemsAvailable(false), false, 'offline without the arc: none');
  setPref('survival', true);
  assert.equal(restItemsAvailable(false), true);
  assert.deepEqual(restItemsStock('GeneralStore', 10, () => 0.99, { online: true }), [], 'online: an empty shelf');
  const shelf = restItemsStock('GeneralStore', 10, () => 0.99, { online: false });
  assert.deepEqual([...new Set(shelf.map((i) => i.templateIndex))], [REST_ITEM.Bedroll, REST_ITEM.EmberJar, REST_ITEM.Firewood, REST_ITEM.Tonic]);
  assert.deepEqual([...new Set(restItemsStock('Alchemist', 10, () => 0.99, { online: false }).map((i) => i.templateIndex))], [REST_ITEM.Tonic, REST_ITEM.Salts, REST_ITEM.Draught, REST_ITEM.Candle]);
  assert.deepEqual(restItemsStock('Armorer', 10, () => 0.99, { online: false }), []);
  const pile = rollRestLoot([], REST_PILE_CHANCES, () => 0.01, { online: false });
  assert.deepEqual(pile.map((i) => i.templateIndex), [REST_ITEM.EmberJar, REST_ITEM.Tonic], 'a deep pile at its 4%');
  assert.deepEqual(rollRestLoot([], REST_PILE_CHANCES, () => 0.05, { online: false }), [], 'and not above it');
  assert.deepEqual(rollRestLoot([], REST_FOE_CHANCES, () => 0.01, { online: true }), [], 'online: no foe drops one yet');
  assert.deepEqual(['J', 'O', 'I', 'P', '-'].map(isDeepPileKey), [true, true, false, false, false]);
});

test('REST6 the Tonic: forty percent of fatigue at once, and with Climates & Calories four hours off the sleep debt; one off the stack', () => {
  _resetForTests(); setPref('survival', true);
  const e = { stats: { strength: 50, endurance: 50 }, fatigue: 0, survival: newSurvival(0) };
  e.survival.sleepDebt = 10;
  const tonic = createRestItem(REST_ITEM.Tonic, { stackCount: 2 });
  const list = [tonic];
  const r = useTonic(tonic, list, e, 0);
  assert.equal(e.fatigue, Math.round(100 * 64 * 0.4));
  assert.equal(e.survival.sleepDebt, 6);
  assert.equal(r.text, REST_ITEM_TEXT.tonicSleep);
  assert.equal(tonic.stackCount, 1);
  useTonic(tonic, list, e, 0);
  assert.deepEqual(list, [], 'the last one off the list');
});

test('REST6 the Salts: an hour of the character\'s clock with the sleep penalties held, the debt growing; then two hours land at once; refused when not tired', () => {
  _resetForTests(); setPref('survival', true);
  const e = { survival: newSurvival(0) };
  const salts = createRestItem(REST_ITEM.Salts);
  assert.equal(useSalts(salts, [salts], e, 100).text, REST_ITEM_TEXT.saltsNotTired, 'not tired: nothing spent');
  assert.equal(salts.currentCondition, 3);
  e.survival.sleepDebt = 14;   // exhausted
  const list = [salts];
  assert.equal(useSalts(salts, list, e, 100).text, REST_ITEM_TEXT.salts);
  assert.equal(salts.currentCondition, 2);
  assert.equal(wakingHeld(e.survival, 159), true);
  const held = survivalStatMods(e.survival, null, 150, {});
  const after = survivalStatMods({ ...e.survival, wakingUntil: 0 }, null, 150, {});
  assert.equal(held.strength ?? 0, 0, 'the penalties held');
  assert.ok((after.strength ?? 0) < 0, 'and without the salts they are there');
  assert.equal(landWakingDebt(e.survival, 159), false);
  assert.equal(landWakingDebt(e.survival, 160), true);
  assert.equal(e.survival.sleepDebt, 14 + WAKING_DEBT_HOURS);
  assert.equal(landWakingDebt(e.survival, 161), false, 'once');
});

test('REST6 the Draught: taken once a night; the next night (the interval run out, or offline the next rest) sleeps as a bed; a night slept through spends it, a stopped rest keeps it', () => {
  _resetForTests(); setPref('survival', true);
  const e = { health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [], survival: newSurvival(0) };
  const d = createRestItem(REST_ITEM.Draught, { stackCount: 2 });
  assert.equal(useDraught(d, [d], e).text, REST_ITEM_TEXT.draught);
  assert.equal(useDraught(d, [d], e).text, REST_ITEM_TEXT.draughtHeld, 'one a night');
  assert.equal(d.stackCount, 1);
  assert.equal(draughtTaken(e), true);
  const deps = createRestDeps(e, { restKind: () => 'rough', endLines: () => null });
  setOwnMinutes(10_000);
  deps.setResting(true);
  assert.equal(e.restKind, 'bed', 'the rough ground sleeps as a bed');
  deps.setResting(false);
  assert.equal(draughtTaken(e), true, 'a rest stopped before its night keeps it');
  deps.setResting(true);
  setOwnMinutes(10_480);
  deps.setResting(false);
  assert.equal(draughtTaken(e), false, 'a night slept through spends it');
});

test('REST6 the Candle: lit from the pack, the next rest is its kneel - a six-second channel, offline too - and the kneel ends with half the magicka and a use; stopped, it stays unspent', () => {
  const candle = createRestItem(REST_ITEM.Candle);
  const list = [candle];
  const e = { magicka: 0, maxMagicka: 40, items: list };
  const r = useCandle(candle, list);
  assert.deepEqual([r.text, r.closesWindow], [REST_ITEM_TEXT.candleLit, true]);
  const deps = createRestDeps(e, { endLines: () => null });
  assert.deepEqual(deps.restAct(), { point: { kind: 'candle', where: 'candle' }, night: false, meditate: true, channelSeconds: REST_CHANNEL_SECONDS }, 'offline: the kneel, not DFU\'s window');
  const out = deps.restMeditate();
  assert.equal(e.magicka, 20);
  assert.equal(out.text, REST_ITEM_TEXT.meditated);
  assert.equal(candle.currentCondition, 2);
  assert.equal(deps.restAct(), null, 'the candle is out: the next rest is DFU\'s');
  useCandle(candle, list); deps.snuffCandle();
  assert.equal(litCandle(), null, 'a kneel stopped');
  assert.equal(candle.currentCondition, 2, 'unspent');
  useCandle(candle, list); meditate(e); useCandle(candle, list);
  assert.equal(meditate(e), `${REST_ITEM_TEXT.meditated} ${REST_ITEM_TEXT.candleOut}`);
  assert.deepEqual(list, [], 'burnt to nothing');
  assert.equal(REST_ACT_TEXT.meditating, 'Meditating by the candle...');
});

test('REST6 the Ember Jar: a one-night fire for 180 minutes, one off the stack; never relit or picked up; gone when its embers are', () => {
  const jar = createRestItem(REST_ITEM.EmberJar, { stackCount: 2 });
  const list = [jar];
  const r = placeCampItem(jar, list, { now: 100, feet: [0, 1, 0], probe: flat(), place: { insideDungeon: true }, standing: 0, id: 'me:1' });
  assert.equal(r.ok, true, 'in a dungeon too');
  assert.equal(r.text, REST_ITEM_TEXT.emberLit);
  assert.deepEqual([r.camp.kind, r.camp.wear, r.camp.jar, r.camp.litUntil], [CAMP_KIND.Fire, 1, true, 280]);
  assert.equal(jar.stackCount, 1);
  assert.deepEqual(campMenu(r.camp, 150, true).map((x) => x.key), ['rest', 'cook'], 'no pick-up');
  assert.deepEqual(campMenu(r.camp, 300, true).map((x) => x.key), ['rest', 'cook'], 'and no relight');
  assert.equal(campExpired(r.camp, 279), false);
  assert.equal(campExpired(r.camp, 280), true, 'swept with its embers');
  assert.equal(campExpired({ ...newCamp({ id: 'c', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0, wear: 0 }), fuel: true }, 10_000), false, 'a Campfire stands cold');
});

function pool(entity, said = [], opened = []) {
  return createCamps({
    entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => ({}),
    say: (l) => said.push(l), openRest: () => opened.push('REST'), showOverlay: () => {},
  });
}

test('REST6 Firewood: three nights to your placed Campfire in reach (relit if cold), else the pack\'s emptiest; full, it is kept; none, it says so', () => {
  _resetForTests(); setPref('survival', true);
  setWorldMinutes(1000);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const wood = createRestItem(REST_ITEM.Firewood, { stackCount: 3 });
  const entity = { items: [fire, wood] };
  const said = [];
  const p = pool(entity, said);
  assert.equal(p.placeItem(wood, entity.items), false, 'a full Campfire in the pack takes none');
  assert.equal(said.at(-1), REST_ITEM_TEXT.firewoodFull);
  fire.currentCondition = 6;
  assert.equal(p.placeItem(wood, entity.items), true);
  assert.equal(fire.currentCondition, CAMPFIRE_USES, 'to its eight, no further');
  assert.equal(wood.stackCount, 2);
  p.placeItem(fire, entity.items);
  const [c] = p.camps;
  c.rec.wear = 2; c.rec.litUntil = 0;
  assert.equal(p.placeItem(wood, entity.items), true);
  assert.equal(c.rec.wear, 5, 'the placed fire first');
  assert.equal(fireLit(c.rec, 1000), true, 'relit');
  assert.equal(said.at(-1), REST_ITEM_TEXT.firewoodFed(5));
  c.rec.wear = 7;
  assert.equal(p.placeItem(wood, entity.items), true);
  assert.equal(c.rec.wear, CAMPFIRE_USES, 'the placed fire to its eight, no further');
  assert.equal(entity.items.includes(wood), false, 'the last stick');
  const stick = createRestItem(REST_ITEM.Firewood);
  const none = pool({ items: [stick] }, said);
  assert.equal(none.placeItem(stick, [stick]), false);
  assert.equal(said.at(-1), REST_ITEM_TEXT.firewoodNone);
});

test('REST6 the Bedroll: laid where a camp could stand - in a dungeon too, never in town - and the rest begins on it; its point is rough, ten seconds; a night on it spends one of its ten', () => {
  _resetForTests(); setPref('survival', false);
  const bed = createRestItem(REST_ITEM.Bedroll);
  const entity = { items: [bed] };
  const said = [], opened = [];
  const town = createCamps({ entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => ({ inTown: true }), say: (l) => said.push(l), openRest: () => opened.push('REST') });
  assert.equal(town.placeItem(bed, entity.items), false, 'never in town');
  const p = pool(entity, said, opened);
  assert.equal(p.placeItem(bed, entity.items), true, 'the arc Off too - a Bedroll is the rest\'s');
  assert.equal(said.at(-1), REST_ITEM_TEXT.bedrollLaid);
  assert.deepEqual(opened, ['REST'], 'and the rest begins on it');
  assert.deepEqual(p.restPointAt([0, 1, 1]), { kind: 'rough', where: 'bedroll', channelSeconds: BEDROLL_CHANNEL_SECONDS });
  assert.equal(p.restPointAt([0, 1, 30]), null, 'walked away from it');
  assert.equal(p.spendNightNear([0, 1, 1]), true);
  assert.equal(bed.currentCondition, 9);
  bed.currentCondition = 1;
  p.spendNightNear([0, 1, 1]);
  assert.deepEqual(entity.items, [], 'worn through');
  assert.equal(said.at(-1), REST_ITEM_TEXT.bedrollWorn);
  assert.equal(p.restPointAt([0, 1, 1]), null);
});

test('REST6 the cards: each item\'s lines under its name and weight', () => {
  const tok = (t, o) => survivalInfoTokens(createRestItem(t, o)).map((x) => x.text);
  assert.deepEqual(tok(REST_ITEM.Bedroll).slice(2), ['10 nights left', 'A rough night anywhere a camp could stand.']);
  assert.deepEqual(tok(REST_ITEM.Candle).slice(2), ['3 uses left', 'Meditate by it to restore 50% of your magicka.']);
  assert.equal(tok(REST_ITEM.Draught)[0], 'Sleeping Draught');
  assert.deepEqual(restItemLines(createRestItem(REST_ITEM.Firewood)), ['Feeds a Campfire 3 nights.']);
  const c = createRestItem(REST_ITEM.Candle); const l = [c];
  assert.equal(spendCharge(c, l), false); assert.equal(c.currentCondition, 2);
});

test('REST6 by source: the windows kneel by the candle, the hosts\' rest points read the Bedroll, the shelves stock at their end, the loot hooks subscribe last, the cards read the seven', () => {
  for (const f of ['src/ui/restWindow.js', 'src/ui/enhancedRest.js']) {
    const s = rd(f);
    assert.match(s, /meditate \? (this\.)?deps\.restMeditate\?\.\(\)/, f);
    assert.match(s, /REST_ACT_TEXT\.meditating/, f);
    assert.match(s, /deps\.snuffCandle\?\.\(\)/, f);
  }
  assert.match(rd('src/scenes/world.js'), /camps\.restPointAt\(walkMode && playerSpawned \? player\.pos : cam\.pos\)/);
  assert.match(rd('src/scenes/dungeonContext.js'), /restPoint: \(\) => \(_fpFeet \? camps\.restPointAt\(_fpFeet\) : null\),/);
  const shop = rd('src/systems/shopStock.js');
  const at = shop.indexOf("restItemsStock(buildingType === BUILDING_TYPES.GeneralStore ? 'GeneralStore' : 'Alchemist'");
  assert.ok(at > shop.indexOf("const pairs = SHOP_ITEM_GROUPS[buildingType]") && at < shop.indexOf('add(mintHealingPotion());'), 'after DFU\'s draws, before the healing supply');
  const shared = rd('src/scenes/shared.js');
  assert.ok(shared.indexOf('  installRestItemLoot();') > shared.indexOf('  installForaging();'), 'after Foraging\'s hooks');
  assert.match(shared, /installHealingSupply\(\);[^\n]*\n  installRestItemLoot\(\);/, 'and the healing supply\'s: the last draw on a pile');
  assert.match(shared, /if \(_rules && _place === REST_KIND\.Rough && draughtTaken\(entity\) && \(!sharedClockOn\(\) \|\| nightDue\(entity, ownMinutes\(\)\)\)\) \{ _place = REST_KIND\.Bed; _kind = REST_KIND\.Bed; _draughtFrom = ownMinutes\(\); \}/);
  assert.match(shared, /if \(_draughtFrom != null && ownMinutes\(\) - _draughtFrom >= DRAUGHT_SPENT_MINUTES\) spendDraught\(entity\); _draughtFrom = null;/);
  assert.match(rd('src/systems/itemInfo.js'), /if \(isSurvivalItem\(item\) \|\| isRestItem\(item\)\) record = survivalInfoTokens\(item\);/);
  assert.match(rd('src/ui/enhancedInventory.js'), /survival: isSurvivalItem\(item\) \|\| isRestItem\(item\) \?/);
});
