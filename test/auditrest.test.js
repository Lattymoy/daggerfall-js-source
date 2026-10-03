// AUDIT REST (2026-10-03, bible/06-Systems/Rest-Arc.md "As built"; Mac: "Go" - the arc's own audit, every lens: the act,
// the Campfire, the dungeon fires, the party's night, the consumables, online skew, the words). Each finding fixed is
// pinned here by execution where it can be: a Campfire left in a dungeon comes out with its owner (F1); the Draught
// only makes a ROUGH night a bed's and an hour's rest spends it (F3); a lit Candle is the pack's (F4); a loiter is no
// night (F5, by source); an older build's rest open carries no member into a night (F7); a worn-through tent is no
// fire (F8); the Salts read the stage (F9); the laid Bedroll follows the origin and the pack (F10); an old save's kit
// fire burns away (F12); the Pawn Shop's Campfires and the essentials' half price (REST2's section 3); the dungeon
// fires measured in squares and never in a palace.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCamps } from '../src/scenes/camps.js';
import { createSurvivalItem, campfireStock } from '../src/systems/survival/items.js';
import { TEMPLATE } from '../src/systems/survival/food.js';
import { CAMP_TEXT } from '../src/systems/survival/camp.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setSharedClock, setWorldMinutes, setOwnMinutes } from '../src/systems/worldTick.js';
import { createRestItem, REST_ITEM, useCandle, litCandle, meditate, snuffCandle, useSalts, useDraught, draughtTaken, REST_ITEM_TEXT } from '../src/systems/restItems.js';
import { newSurvival } from '../src/systems/survival/needs.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { buyItemPrice } from '../src/systems/tradeModes.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { fireCandidates } from '../src/world/dungeonFires.js';
import { RDB_SIDE } from '../src/world/rdbLayout.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);
afterEach(() => { setSharedClock(null); _resetForTests(); snuffCandle(); });
const pool = (entity, said = [], place = {}) => createCamps({
  entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => place,
  say: (l) => said.push(l), openRest: () => {}, showOverlay: () => {},
});

test('AUDIT REST F1: leaving a dungeon, my own Campfire comes back into the pack with its fuel; an Ember Jar\'s goes with the dungeon', () => {
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const jar = createRestItem(REST_ITEM.EmberJar);
  const entity = { items: [fire, jar] };
  const said = [];
  const p = pool(entity, said, { insideDungeon: true });
  assert.equal(p.placeItem(fire, entity.items), true);
  assert.equal(p.placeItem(jar, entity.items), true);
  p.camps[0].rec.wear = 5;
  assert.deepEqual(entity.items, []);
  assert.equal(p.packOwnFires(), 1);
  assert.deepEqual(entity.items.map((i) => [i.templateIndex, i.currentCondition]), [[TEMPLATE.Campfire, 5]]);
  assert.equal(said.at(-1), CAMP_TEXT.carriedOut);
  assert.deepEqual(p.camps.map((c) => !!c.rec.jar), [true], 'the Campfire left the pool; the Ember Jar\'s fire goes with the dungeon\'s teardown');
  assert.match(rd('src/scenes/dungeonContext.js'), /\n\s+camps\.packOwnFires\(\);   \/\/ AUDIT REST F1[^\n]*\n\s+camps\.destroyAll\(\);/, 'the dungeon\'s teardown, before its pool goes');
});

test('AUDIT REST F3: the Draught makes only a ROUGH night a bed\'s (a fire or a tent prices as one already, and keeps its tent tended); an hour\'s rest under it spends it, offline too', () => {
  _resetForTests(); setPref('survival', true);
  const body = () => ({ health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [], survival: newSurvival(0) });
  const atCamp = body();
  const d1 = createRestItem(REST_ITEM.Draught);
  useDraught(d1, [d1], atCamp);
  const camp = createRestDeps(atCamp, { restKind: () => 'camp', endLines: () => null });
  setOwnMinutes(10_000); camp.setResting(true);
  assert.equal(atCamp.restKind, 'camp', 'the fire\'s rest stays the fire\'s');
  setOwnMinutes(10_480); camp.setResting(false);
  assert.equal(draughtTaken(atCamp), true, 'and the draught is kept for a rough night');
  const rough = body();
  const d2 = createRestItem(REST_ITEM.Draught);
  useDraught(d2, [d2], rough);
  const deps = createRestDeps(rough, { restKind: () => 'rough', endLines: () => null });
  setOwnMinutes(20_000); deps.setResting(true);
  assert.equal(rough.restKind, 'bed');
  setOwnMinutes(20_060); deps.setResting(false);
  assert.equal(draughtTaken(rough), false, 'an offline hour under it spends it - no endless bed-rate naps');
});

test('AUDIT REST F4: a lit Candle is the pack\'s - sold, dropped or a load since, the next rest is no kneel and no other copy is spent', () => {
  const candle = createRestItem(REST_ITEM.Candle);
  const entity = { magicka: 0, maxMagicka: 40, items: [candle] };
  useCandle(candle, entity.items);
  assert.equal(litCandle(entity)?.item, candle);
  const shop = [entity.items.pop()];   // sold
  assert.equal(litCandle(entity), null);
  assert.equal(meditate(entity), null);
  assert.equal(entity.magicka, 0);
  assert.equal(shop[0].currentCondition, 3, 'the shop\'s copy keeps its uses');
  const deps = createRestDeps(entity, { endLines: () => null });
  useCandle(candle, shop);
  assert.equal(deps.restAct(), null, 'offline: DFU\'s window, not a kneel by a candle you do not hold');
});

test('AUDIT REST F9: the Salts are refused while the stage reads Rested, debt or no debt', () => {
  _resetForTests(); setPref('survival', true);
  const e = { survival: newSurvival(0) };
  e.survival.sleepDebt = 0.5;
  const s = createRestItem(REST_ITEM.Salts);
  assert.equal(useSalts(s, [s], e, 100).text, REST_ITEM_TEXT.saltsNotTired);
  assert.equal(s.currentCondition, 3, 'nothing spent');
});

test('AUDIT REST F10: the laid Bedroll rides a recentre, and a pack replaced by a load lays no phantom', () => {
  _resetForTests(); setPref('survival', true);
  const bed = createRestItem(REST_ITEM.Bedroll);
  const entity = { items: [bed] };
  const p = pool(entity);
  assert.equal(p.placeItem(bed, entity.items), true);
  assert.ok(p.restPointAt([0, 1, 1]));
  p.offsetAll([100, 0, 0]);
  assert.equal(p.restPointAt([0, 1, 1]), null, 'the old frame\'s spot');
  assert.ok(p.restPointAt([100, 1, 1]), 'the spot moved with the origin');
  entity.items = [createRestItem(REST_ITEM.Bedroll)];   // a load: a new pack
  assert.equal(p.restPointAt([100, 1, 1]), null, 'no phantom');
});

test('AUDIT REST F8/F12: a worn-through tent is no fire; an old save\'s kit fire (no fuel of its own) burns away, mine alone', () => {
  _resetForTests(); setPref('survival', true); setWorldMinutes(5000);
  const entity = { items: [] };
  const p = pool(entity);
  p.restore([{ id: 'me:1:1', kind: 'fire', pos: [0, 0, 1], yaw: 0, litUntil: 4000, wear: 0, placedAt: 0 },
    { id: 'me:2:1', kind: 'tent', pos: [0, 0, 1], yaw: 0, litUntil: 4000, wear: 0, placedAt: 0 },
    { id: 'me:3:1', kind: 'fire', pos: [0, 0, 1], yaw: 0, litUntil: 4000, wear: 2, placedAt: 0, fuel: true }]);
  p.tick(0.1);
  assert.deepEqual(p.camps.map((c) => c.rec.id), ['me:2:1', 'me:3:1'], 'the old kit fire swept; the tent and the Campfire stand');
  const tent = p.camps.find((c) => c.rec.id === 'me:2:1');
  assert.equal(p.activate('camp:me:2:1', 'grab', 'stoke'), true);
  assert.equal(tent.rec.litUntil, 4000, 'a worn-through tent will not stoke');
  // and a Campfire placed now carries its mark: cold, it stands
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  entity.items.push(fire);
  assert.equal(p.placeItem(fire, entity.items), true);
  const placed = p.camps.at(-1);
  assert.equal(placed.rec.fuel, true);
  placed.rec.litUntil = 0;
  p.tick(0.1);
  assert.ok(p.camps.includes(placed), 'a placed Campfire gone cold still stands');
});

test('AUDIT REST: REST2\'s shops - online a Pawn Shop shelves 0-2 Campfires; online a Campfire and Firewood cost half, as a potion', () => {
  assert.deepEqual([0, 0.5, 0.999].map((r) => campfireStock(() => r, 0, 2).length), [0, 1, 2]);
  setSharedClock(() => 1000);
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.PawnShop, quality: 10 }, { level: 1 }, { rolls: () => 0.999, torchesFromItems: false });
  assert.ok(shelf.filter((i) => i.templateIndex === TEMPLATE.Campfire).length >= 2);
  setSharedClock(null);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const full = buyItemPrice(fire, { quality: 10, online: false });
  assert.equal(buyItemPrice(fire, { quality: 10, online: true }), Math.max(1, Math.ceil(full / 2)));
  const wood = createRestItem(REST_ITEM.Firewood);
  assert.ok(buyItemPrice(wood, { quality: 10, online: true }) < buyItemPrice(wood, { quality: 10, online: false }));
});

test('AUDIT REST: the dungeon fires - no candidate in a palace\'s block; every measure squared, never Math.hypot (one IEEE answer on every engine)', () => {
  const block = (castle) => ({ name: 'N1.RDB', originX: 0, originZ: 0, isStartingBlock: true, layout: { waterLevel: 10000, castleBlock: castle, markers: [{ record: 19, x: 5, y: 0.5, z: 5 }] } });
  assert.equal(fireCandidates([block(false)]).length, 2);
  assert.equal(fireCandidates([block(true)]).length, 0);
  assert.equal(RDB_SIDE > 0, true);
  assert.doesNotMatch(rd('src/world/dungeonFires.js').replace(/^\/\/.*$/gm, ''), /Math\.hypot\(/);
});

test('AUDIT REST: the words - "Rest with my party" says the night, /ready says there is no vote online, an Ember Jar\'s last night says its embers', () => {
  assert.match(rd('src/ui/enhancedMenu.js'), /'On: when a party member within 15 m sleeps a night at a fire, a tent or a bed, you sleep it too, with your own '/);
  assert.match(rd('src/net/chatCommands.js'), /'\/ready - how your party rests online \(no vote: a night at a fire carries the party\)',/);
  assert.match(rd('src/scenes/camps.js'), /say\(best\.rec\.jar \? CAMP_TEXT\.embersOut : best\.rec\.kind === CAMP_KIND\.Fire \? CAMP_TEXT\.outOfFuel : CAMP_TEXT\.campWorn\)/);
  assert.equal(CAMP_TEXT.embersOut, 'The embers die out.');
});
