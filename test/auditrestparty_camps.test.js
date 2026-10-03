// AUDIT REST-PARTY (2026-10-03, bible/06-Systems/Rest-Arc.md "AUDIT REST-PARTY"): the Campfire, the supplies and the act,
// each finding pinned by execution where it can be. B1: a load out of a dungeon drops my fire (the save's pack is the
// pack) where a leave packs it; B2: an offline night at my own Campfire keeps it lit and spends its charge; B3: my fire
// leaves before the room's memory goes, and a cold fire whose owner left the room goes too; B4: customs keeps the
// supplies offline and online none is used while their sources are shut; B5: an old save's kit fire is no Campfire to
// pick up, and a kit is fed to its own cap; B6: the Salts one hour at a time; B7: the hotbar's Campfire is a fuelled
// one. A3: a pressed bed prices as a bed; A4: a room that runs out mid-night is no whole night; A5: the channel asks the
// point again; C1: the ward is online's.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCamps } from '../src/scenes/camps.js';
import { createSurvivalItem } from '../src/systems/survival/items.js';
import { TEMPLATE } from '../src/systems/survival/food.js';
import { CAMP_TEXT, campMenu, newCamp, packCamp, CAMP_KIND, campWire } from '../src/systems/survival/camp.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setSharedClock, setWorldMinutes, setOwnMinutes, advanceOwnMinutes } from '../src/systems/worldTick.js';
import { createRestItem, REST_ITEM, REST_ITEM_TEXT, useSalts } from '../src/systems/restItems.js';
import { itemUseHandler } from '../src/systems/itemTemplates.js';
import { newSurvival } from '../src/systems/survival/needs.js';
import { applyCustoms, customsLines } from '../src/systems/realmCustoms.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { actAtChannelEnd, NIGHT_HOURS } from '../src/systems/restAct.js';
import { fireLayoutInputs } from '../src/world/dungeonFires.js';
import { resolveConsumable, clearQuickslots, setHotbarSlot, hotbarEntryForItem, hotbarPress } from '../src/systems/quickslots.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);
const realLocation = globalThis.location;
afterEach(() => { setSharedClock(null); _resetForTests(); globalThis.location = realLocation; });
const pool = (entity, said = [], place = {}, selfId = null) => createCamps({
  entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => place,
  say: (l) => said.push(l), openRest: () => {}, showOverlay: () => {}, selfId: () => selfId,
});

test('AUDIT REST-PARTY B1 + B3: every way out of a dungeon puts my fires away BEFORE the room\'s memory is published - a leave or a teleport packs them, a load drops them (the pack is already the save\'s)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /dungeonCtx\.camps\?\.packOwnFires\?\.\(\);[^\n]*\n    const pose = dungeonPose\(\);\n    host\.onDungeonLeave\?\.\(\);/, 'the walk out');
  assert.match(wm, /if \(dungeonCtx\) \{ if \(cacheScene\) dungeonCtx\.camps\?\.packOwnFires\?\.\(\); else dungeonCtx\.camps\?\.dropOwn\?\.\(\); \}\n      if \(dungeonCtx\) \{\n        host\.onDungeonLeave\?\.\(\);/, 'the forced exit: a teleport packs, a load drops - before the leave hook');
  // and on the pool: dropOwn after a load leaves the loaded pack as the save had it
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const entity = { items: [fire] };
  const p = pool(entity, [], { insideDungeon: true });
  assert.equal(p.placeItem(fire, entity.items), true);
  entity.items = [createSurvivalItem(TEMPLATE.Campfire)];   // restorePlayer: the save's pack, its Campfire in it
  p.dropOwn();
  assert.equal(p.packOwnFires(), 0, 'nothing left for the teardown to pack');
  assert.equal(entity.items.length, 1, 'one Campfire - the save\'s');
});

test('AUDIT REST-PARTY B2: offline, a night at my own Campfire keeps it lit through the world\'s minutes, so its charge is spent at the wake; a kit fire is not tended', () => {
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const entity = { items: [fire], isResting: false, restKind: null };
  const p = pool(entity);
  assert.equal(p.placeItem(fire, entity.items), true);
  const rec = p.camps[0].rec;
  const before = rec.wear;
  entity.isResting = true; entity.restKind = 'camp';
  for (let m = 1005; m <= 1485; m += 10) { setWorldMinutes(m); p.tick(0.1); }
  entity.isResting = false; entity.restKind = null;
  assert.equal(p.spendNightNear([0, 1, 0]), true, 'lit at the wake, so the night is paid');
  assert.equal(rec.wear, before - 1);
  assert.match(rd('src/scenes/camps.js'), /const tended = c\.rec\.kind === CAMP_KIND\.Tent \|\| \(c\.rec\.kind === CAMP_KIND\.Fire && !!c\.rec\.fuel\);/);
  // and a fire with no fuel of its own - an old save's kit fire with uses on its record, an Ember Jar's - burns its own span
  _resetForTests(); setPref('survival', true); setWorldMinutes(2000);
  const sleeper = { items: [], isResting: true, restKind: 'camp' };
  const old = pool(sleeper);
  old.restore([{ id: 'me:9:1990', kind: 'fire', pos: [0, 1, 0], yaw: 0, litUntil: 2010, wear: 3, placedAt: 1990 }]);
  old.tick(0.1);
  assert.equal(old.camps[0].rec.litUntil, 2010, 'an old kit fire is not stoked by a rest beside it');
  const jar = createRestItem(REST_ITEM.EmberJar);
  const holder = { items: [jar], isResting: false, restKind: null };
  const jp = pool(holder);
  assert.equal(jp.placeItem(jar, holder.items), true);
  const until = jp.camps[0].rec.litUntil;
  holder.isResting = true; holder.restKind = 'camp';
  setWorldMinutes(2100); jp.tick(0.1);
  assert.equal(jp.camps[0].rec.litUntil, until, 'nor an Ember Jar\'s one night');
});

test('AUDIT REST-PARTY B3: a peer\'s fire gone cold whose owner is not in the room is swept; a lit one stands, and a present owner\'s cold one stands', () => {
  _resetForTests(); setPref('survival', true); setWorldMinutes(5000);
  const p = pool({ items: [] }, [], {}, 'me');
  const wire = (id, litUntil) => campWire({ ...newCamp({ id, kind: CAMP_KIND.Fire, pos: [5, 1, 5], now: 0, wear: 4 }), litUntil });
  p.applyOwner('ghost', [wire('g:1', 4000)]);   // cold
  p.applyOwner('gone-lit', [wire('l:1', 6000)]);   // lit
  p.applyOwner('here', [wire('h:1', 4000)]);   // cold, owner present
  assert.equal(p.camps.length, 3);
  assert.equal(p.sweepColdAbsent(new Set(['here'])), 1);
  assert.deepEqual(p.camps.map((c) => c.owner).sort(), ['gone-lit', 'here']);
  assert.equal(p.sweepColdAbsent(null), 0, 'no roster read: nothing swept');
  assert.match(rd('src/scenes/dungeonContext.js'), /camps\.tick\(dt\);[^\n]*\n    if \(onlineRoom\(\)\) \{ const peers = opts\.peers\?\.\(\); if \(peers\) camps\.sweepColdAbsent\(new Set\(peers\.map\(\(q\) => q\?\.id\)\)\); \}/, 'each frame, against the room\'s peers');
});

test('AUDIT REST-PARTY B4: customs keeps the supplies offline while their sources are shut, and says so; online none is used, offline as ever', () => {
  _resetForTests(); setPref('survival', true);
  const sword = { templateIndex: 113, group: 'Weapons', value: 10 };
  const snap = { level: 1, goldPieces: 0, items: [createRestItem(REST_ITEM.Bedroll), sword, createRestItem(REST_ITEM.Tonic)], wagonItems: [], bankAccounts: [] };
  const r = applyCustoms(snap);
  assert.equal(r.restKept, 2);
  assert.deepEqual(snap.items, [sword], 'the copy carries none of them');
  assert.ok(customsLines(r).some((l) => /camping supplies stayed with your offline character/.test(l)));
  assert.ok(customsLines(r, { before: true }).some((l) => /will stay/.test(l)));
  const entity = { fatigue: 0, maxFatigue: 100, stats: { endurance: 50, strength: 50 }, survival: newSurvival(0) };
  const tonic = createRestItem(REST_ITEM.Tonic);
  const h = itemUseHandler(REST_ITEM.Tonic);
  globalThis.location = { search: '?online' };
  assert.equal(h.usable(tonic), false, 'online: the card offers no Use');
  assert.deepEqual(h(tonic, [tonic], { entity }), { kind: 'text', text: REST_ITEM_TEXT.notOnline }, 'and a hotbar press is told why');
  globalThis.location = { search: '' };
  assert.equal(h.usable(tonic), true);
  assert.notEqual(h(tonic, [tonic], { entity }).text, REST_ITEM_TEXT.notOnline, 'offline it is drunk');
  for (const t of Object.values(REST_ITEM)) assert.equal(typeof itemUseHandler(t)?.usable, 'function', `${t} is gated`);
});

test('AUDIT REST-PARTY B5: an old save\'s kit fire (no fuel of its own) offers no pick-up and packs into nothing; a Campfire does; Firewood feeds a kit to its own cap', () => {
  const kit = newCamp({ id: 'k', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0, wear: 3 });
  assert.deepEqual(campMenu(kit, 10, true).map((r) => r.key), ['rest', 'cook']);
  assert.deepEqual(packCamp(kit), { item: null, text: CAMP_TEXT.stamped });
  const fuelled = { ...kit, fuel: true };
  assert.deepEqual(campMenu(fuelled, 10, true).map((r) => r.key), ['rest', 'cook', 'pack']);
  assert.equal(packCamp(fuelled).item?.currentCondition, 3);
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const old = { ...createSurvivalItem(TEMPLATE.Campfire), maxCondition: 5, currentCondition: 4 };
  const wood = createRestItem(REST_ITEM.Firewood);
  const entity = { items: [old, wood] };
  const p = pool(entity);
  itemUseHandler(REST_ITEM.Firewood);
  assert.equal(p.placeItem(wood, entity.items), true);
  assert.equal(old.currentCondition, 5, 'to its own five, never 160%');
});

test('AUDIT REST-PARTY B6: the Salts one hour at a time - a second dose while one is held is refused and kept', () => {
  _resetForTests(); setPref('survival', true);
  const entity = { survival: { ...newSurvival(0), sleepDebt: 20 * 60 } };
  const salts = createRestItem(REST_ITEM.Salts);
  salts.stackCount = 3;
  const list = [salts];
  assert.equal(useSalts(salts, list, entity, 100).text, REST_ITEM_TEXT.salts);
  const left = salts.currentCondition ?? salts.stackCount;
  assert.equal(useSalts(salts, list, entity, 130).text, REST_ITEM_TEXT.saltsHeld);
  assert.equal(salts.currentCondition ?? salts.stackCount, left, 'nothing spent');
  assert.equal(useSalts(salts, list, entity, 161).text, REST_ITEM_TEXT.salts, 'the hour over, another');
});

test('AUDIT REST-PARTY B7: the hotbar\'s Campfire is one with fuel, the empty one kept in the pack by design passed over', () => {
  clearQuickslots();
  const empty = { ...createSurvivalItem(TEMPLATE.Campfire), currentCondition: 0 };
  const full = createSurvivalItem(TEMPLATE.Campfire);
  const entity = { items: [empty, full] };
  const entry = hotbarEntryForItem(full);
  assert.equal(entry?.kind, 'use', 'a Campfire rides the hotbar as a use - the c1 door, resolveConsumable');
  setHotbarSlot(0, entry);
  let picked = null;
  hotbarPress(0, { entity, doors: { quickUse: () => { picked = resolveConsumable(entity, 'c1'); return true; } } });
  assert.equal(picked?.item, full, 'the fuelled one, not the first');
  assert.equal(picked?.count, 2);
  clearQuickslots();
});

test('AUDIT REST-PARTY A3 + A4: a pressed bed prices as a bed; a room that runs out mid-night is no whole night - no top-up, no fuel, nobody carried', () => {
  assert.match(rd('src/scenes/world.js'), /restKind: \(\) => \(_restFromBed \? 'bed' : camps\.fireNear\(/);
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const e = { health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] };
  let slept = 0;
  const bag = createRestDeps(e, { restKind: () => 'bed', restPoint: () => ({ kind: 'bed', where: null }), advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null, onNightSlept: () => { slept++; } });
  bag.setResting(true);
  const r = bag.restNight({ rentedHours: 2 });
  bag.setResting(false);
  assert.equal(r.rentExpired, true);
  assert.ok(e.health < 60, 'two hours\' healing, no top-up');
  assert.equal(slept, 0, 'no fuel spent');
  assert.ok(NIGHT_HOURS > 2);
});

test('AUDIT REST-PARTY A5: the channel held to its end asks again - a fire gone or a blow taken interrupts; a bed stands; a night come due is a night', () => {
  const fire = { point: { kind: 'camp', where: 'fire' }, night: false };
  assert.equal(actAtChannelEnd(fire, { point: null, night: false }, 50, 50), null, 'the fire picked up');
  assert.equal(actAtChannelEnd(fire, { point: { kind: 'camp', where: 'fire' }, night: false }, 50, 49), null, 'hurt while holding');
  assert.deepEqual(actAtChannelEnd(fire, { point: { kind: 'camp', where: 'fire' }, night: true }, 50, 50), { ...fire, night: true });
  const bed = { point: { kind: 'bed', where: null }, night: true };
  assert.deepEqual(actAtChannelEnd(bed, { point: null, night: true }, 50, 60), bed, 'a ship\'s press lasts only the press - its bed stands');
  const candle = { point: { kind: 'candle', where: 'candle' }, meditate: true };
  assert.equal(actAtChannelEnd(candle, null, 50, 10), candle, 'a kneel is its own');
  for (const f of ['src/ui/restWindow.js', 'src/ui/enhancedRest.js']) {
    const s = rd(f);
    assert.match(s, /actAtChannelEnd\(/, `${f} asks`);
    assert.match(s, /text: REST_ACT_TEXT\.interrupted/, `${f} says it`);
    assert.match(s, /else if \(!ambushNight\(\)\) (this|overlay)\._pendingEnemySpawn = true;/, `${f}: A2 - a quest foe inside the night breaks it`);
  }
});

test('AUDIT REST-PARTY C1: the fire\'s ward is online\'s - offline the rest is DFU\'s, its ambushes with it', () => {
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(spot && sharedClockOn\(\) && inFireWard\(dungeonFires, spot\)\) spot = null;/);
});

test('AUDIT REST-PARTY C7: the fires\' law reads a hearth\'s CLASSIC foot - a texture mod\'s XML scale is one client\'s, and the law must stand the same fires on every client', () => {
  const { existing } = fireLayoutInputs([], [{ x: 1, y: 3, z: 2, foot: 2.2, lawFoot: 2.5 }, { x: 4, y: 3, z: 5, foot: 2.2 }, { x: 0, y: 1, z: 0, foot: 0, placed: true }]);
  assert.deepEqual(existing, [[1, 2.5, 2], [4, 2.2, 5]], 'the law\'s foot first; a placed fire is the law\'s own');
  assert.match(rd('src/scenes/dungeonContext.js'), /const lawSize = t && f\.record < t\.recordCount \? classicBillboardSize\(t, f\.record\) : null;/);
  assert.match(rd('src/scenes/dungeonContext.js'), /lawFoot: lawSize \? f\.y - lawSize\.h \/ 2 : undefined \}\);/);
});
