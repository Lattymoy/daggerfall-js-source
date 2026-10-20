// WAGONS4 (2026-10-11, the owner: "Wagons have durability and require upkeep to keep from breaking down and becoming
// unusable") - WAGON UPKEEP (bible/06-Systems/Wagon-Upkeep.md): the law (systems/wagon/wagonUpkeep.js) - a wagon's soundness
// off the condition it always carried, what wears it, what mends it and what it costs; the runtime's wear by the metres
// rolled and the journey's days (systems/upkeep/upkeepRuntime.js); WAGON-MEND (2026-10-12): no wagon ever broken - worn to
// Failing at the worst, slow and still driven; the Wagon Yard's Mend (systems/merchantYards.js, scenes/merchantYardsHost.js, scenes/world.js mendAtYard) and its kits; a smith's
// counter refusing a horse and a wagon (systems/repairService.js); and the hosts wiring it.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORSE_CARE_HARD as HARD, WAGON_UPKEEP_HARD as WHARD } from '../../src/systems/upkeep/upkeepTiers.js';   // HORSE-TIERS / WAGON-TIERS (PIN MOVED): the upkeep is handed each tier's rules - these pins pin the system as it stood, Hard
import { readFileSync } from 'node:fs';
import {
  wagonCondition, wagonConditionMax, wagonSoundness, wagonState, WAGON_STATES, rollWear, journeyWear, wearWagon, WEAR_FLOOR,
  createWearAccount, mendPrice, mendWagon, kitMendWagon, wagonPace, WAGON_UPKEEP_TEXT, WEAR_A_KM, OFFROAD, LOAD_WEAR,
  KIND_WEAR, JOURNEY_WEAR_A_DAY, JOURNEY_WEAR_MAX, THROWN_WEAR, MEND_SHARE, MEND_LEAST, MEND_FETCH, KIT_MEND, WAGON_KIT_CEILING, KIT_MINUTES,
} from '../../src/systems/wagon/wagonUpkeep.js';
import { createUpkeep, registerUpkeepUses } from '../../src/systems/upkeep/upkeepRuntime.js';
import { newWagonItem, WAGON_KINDS, wagonTeamShort } from '../../src/systems/wagon/wagonKinds.js';
import { mintCondition, setItemFields, itemUseHandler } from '../../src/systems/item/itemTemplates.js';
import { UPKEEP_ITEM } from '../../src/systems/upkeep/upkeepItemRows.js';
import { repairRefusal, TRANSPORT_CANNOT_BE_REPAIRED_TEXT } from '../../src/systems/repairService.js';
import { yardRowsFor, YARD_ROWS, YARD_MEND_ROW } from '../../src/systems/merchantYards.js';
import { TRANSPORT, WAGON_MODE, HORSE_MODE } from '../../src/systems/horse/horseCartLaw.js';
import { makeWorld } from '../hccWorld.mjs';
import { FEATURES } from '../../src/systems/features.js';
import { itemStatRows } from '../../src/systems/item/itemInfo.js';
import { repairsObjectsTarget } from '../../src/systems/enchantments.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const rd = (p) => hostText(p);
const wagon = (kind = 'cart', condition = null) => { const w = mintCondition(setItemFields(newWagonItem(kind))); if (condition != null) w.currentCondition = condition; return w; };

test('WAGONS4 SOUNDNESS: the condition every wagon carried all along (template 93\'s 1400) - none carried is whole; Sound from 60%, Worn from 30, Rickety from 10 (its team 0.85 the pace), Failing (0.7) under it - WAGON-MEND: and no lower, a wagon a save holds at nought Failing too (mutants: WAGON-MEND-a-state-under-failing)', () => {
  const w = wagon();
  assert.deepEqual([wagonConditionMax(w), wagonCondition(w), wagonSoundness(w)], [1400, 1400, 1]);
  assert.equal(wagonCondition({ templateIndex: 93 }), 1400, 'a wagon minted before its condition was: whole');
  assert.deepEqual(WAGON_STATES.map((s) => [s.key, s.min, s.pace]), [['sound', 0.6, 1], ['worn', 0.3, 1], ['rickety', 0.1, 0.85], ['failing', 0, 0.7]]);
  const at = (c) => wagonState(wagon('cart', c)).key;
  assert.deepEqual([1400, 840, 839, 420, 419, 140, 139, 1, 0].map(at), ['sound', 'sound', 'worn', 'worn', 'rickety', 'rickety', 'failing', 'failing', 'failing']);
  assert.deepEqual([wagonPace(wagon('cart', 150)), wagonPace(wagon('cart', 100)), wagonPace(wagon('cart', 0)), wagonPace({ templateIndex: 94 })], [0.85, 0.7, 0.7, 1]);
});

test('WAGONS4 WEAR: a kilometre of road 1% of whole, off it 2.5 times, a full load 1.75 times, the bigger wagons built heavier (0.85, 0.7); points come off whole, the metres owed kept; a journey 1% a day to 20%; the watch\'s throw 10%; WAGON-MEND: no wear under its last point (mutants: the road unread, the load, the kind, the account\'s remainder, WAGON-MEND-worn-to-nought)', () => {
  assert.deepEqual([WEAR_A_KM, OFFROAD, LOAD_WEAR, JOURNEY_WEAR_A_DAY, JOURNEY_WEAR_MAX, THROWN_WEAR, WEAR_FLOOR], [0.01, 2.5, 0.75, 0.01, 0.2, 0.1, 1]);
  assert.deepEqual(KIND_WEAR, { cart: 1, openWagon: 0.85, caravan: 0.7 });
  assert.equal(rollWear(1000), 0.01);
  assert.equal(rollWear(1000, { road: false }), 0.025);
  assert.equal(rollWear(1000, { load: 1 }), 0.0175);
  assert.ok(Math.abs(rollWear(1000, { kind: 'caravan', road: false, load: 0.5 }) - 0.01 * 2.5 * 1.375 * 0.7) < 1e-12);
  assert.deepEqual([rollWear(0), rollWear(-5), rollWear(NaN)], [0, 0, 0]);
  // the account: centimetres a frame, a point at a time
  const w = wagon(), acc = createWearAccount();
  let r = null;
  for (let i = 0; i < 1000; i++) r = acc.add(w, rollWear(0.5)) ?? r;   // half a kilometre in half-metre frames
  assert.equal(w.currentCondition, 1400 - 7, 'half a percent: seven points of 1400');
  assert.ok(acc.owed(w) >= 0 && acc.owed(w) < 1, 'the rest owed, never lost');
  assert.deepEqual([r.before.key, r.after.key], ['sound', 'sound']);
  // a journey: by the day, to its cap, never to nought
  assert.deepEqual([journeyWear(0), journeyWear(5), journeyWear(30)], [0, 0.05, 0.2]);
  const old = wagon('cart', 10);
  const j = wearWagon(old, journeyWear(30));
  assert.equal(old.currentCondition, 1, 'a journey always arrives');
  assert.deepEqual([j.before.key, j.after.key], ['failing', 'failing']);
  assert.equal(wearWagon(old, journeyWear(30)), null, 'at its floor: no more');
  const thrown = wagon('cart', 50), t = wearWagon(thrown, THROWN_WEAR);
  assert.deepEqual([thrown.currentCondition, t.after.key], [1, 'failing'], 'WAGON-MEND: a throw never breaks one');
  assert.equal(wearWagon(wagon('cart', 0), 0.5), null, 'a wagon a save holds at nought: no lower');
  assert.equal(wearWagon({ templateIndex: 94 }, 0.5), null, 'a horse is no wagon');
  const fresh = { group: 'Transportation', templateIndex: 93 };
  wearWagon(fresh, 0.5);
  assert.deepEqual([fresh.maxCondition, fresh.currentCondition], [1400, 700], 'its condition minted where it carried none');
  // a 100 km haul of the caravan, half loaded on the road, wears it to its last point - and it rolls on, worn no lower
  const caravan = wagon('caravan'), acc2 = createWearAccount();
  let km = 0;
  while (caravan.currentCondition > WEAR_FLOOR && km < 1000) { acc2.add(caravan, rollWear(100, { kind: 'caravan', load: 0.5 })); km += 0.1; }
  assert.ok(km > 90 && km < 120, `a caravan half loaded is worn to its last point some 104 km of road from new (${km.toFixed(1)})`);
  for (let i = 0; i < 1000; i++) acc2.add(caravan, rollWear(100, { kind: 'caravan', load: 0.5 }));
  assert.deepEqual([caravan.currentCondition, wagonState(caravan).key, wagonPace(caravan)], [1, 'failing', 0.7], 'a hundred km more: Failing, still rolling');
});

test('WAGONS4 MENDING: the Wagon Yard makes it whole for 12% of its kind\'s value (40 at the least) by what it lacks, half again sent out to it; a kit a quarter of whole to 60% at most - a wagon a save holds at nought too - an hour\'s work (mutants: the share, the least, the fetch, the ceiling, the kit\'s step)', () => {
  assert.deepEqual([MEND_SHARE, MEND_LEAST, MEND_FETCH, KIT_MEND, WAGON_KIT_CEILING, KIT_MINUTES], [0.12, 40, 0.5, 0.25, 0.6, 60]);
  assert.equal(mendPrice(wagon('caravan', 0)), Math.round(0.12 * WAGON_KINDS.caravan.value), 'whole from nought: 3000');
  assert.equal(mendPrice(wagon('caravan', 700)), 1500);
  assert.equal(mendPrice(wagon('caravan', 700), { away: true }), 2250);
  assert.equal(mendPrice(wagon('openWagon', 0)), 1080);
  assert.equal(mendPrice(wagon('cart', 0)), 40, 'the Small Cart\'s 150 x 12% is under the least');
  assert.equal(mendPrice(wagon('cart', 1390)), 1, 'a scratch: a coin');
  assert.equal(mendPrice(wagon()), 0, 'whole: nothing');
  const w = wagon('openWagon', 0);
  assert.equal(mendWagon(w), 0); assert.equal(w.currentCondition, 1400);
  const k = wagon('caravan', 0);
  const steps = [];
  for (let i = 0; i < 4; i++) { const r = kitMendWagon(k); steps.push([r.ok, k.currentCondition]); }
  assert.deepEqual(steps, [[true, 350], [true, 700], [true, 840], [false, 840]], 'a quarter at a time, to 60%');
  assert.equal(kitMendWagon(k).text, WAGON_UPKEEP_TEXT.kitCeiling('Caravan'));
  assert.deepEqual(kitMendWagon({ templateIndex: 94 }), { ok: false, text: WAGON_UPKEEP_TEXT.noWagon });
});

test('WAGON-MEND NEVER BROKEN, IT ALWAYS GOES (2026-10-12, the owner: "wagons shouldnt entirely break down to become unusable"): a wagon at its last point - or one a save holds at nought - is driven, its team at the failing pace, every door open; the hosts compose no broken word beside the short team\'s (mutants: WAGON-MEND-a-state-under-failing, WAGON-MEND-worn-to-nought)', () => {
  const items = [{ group: 'Transportation', templateIndex: 94, horseSeed: 5 }, wagon('cart', 0)];
  const u = createUpkeep({ items: () => items, now: () => 1e6, wagonUpkeep: () => WHARD });
  const { w, rt, step } = makeWorld();
  const host = () => { w.short = wagonTeamShort(items); };   // the hosts' own composition
  host(); step(2);
  assert.equal(w.short, null, 'nothing short');
  assert.equal(rt.canUseTransport(TRANSPORT.Cart).allowed, true, 'the window\'s Cart row lit');
  assert.equal(rt.tryUseTransport(TRANSPORT.Cart).succeeded, true, 'at nought: driven');
  for (let i = 0; i < 20; i++) { w.pos[2] += 0.1; host(); step(); }
  assert.equal(w.mode, TRANSPORT.Cart, 'and still on its bench');
  assert.equal(u.rideScale('Cart'), 0.7, 'its team at the failing pace');
  for (let i = 0; i < 100; i++) u.tick(0.016, { mode: 'Cart', metres: 10, road: false, load: 1, wagonGoes: true });
  assert.equal(wagonCondition(items[1]), 0, 'worn no lower than a save held it');
  items[1].currentCondition = 1;
  for (let i = 0; i < 100; i++) u.tick(0.016, { mode: 'Cart', metres: 10, road: false, load: 1, wagonGoes: true });
  assert.deepEqual([wagonCondition(items[1]), u.rideScale('Cart')], [1, 0.7], 'at its last point: worn no lower, still rolling');
  assert.equal('brokenWhy' in u, false, 'no broken word for a host to compose');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/player/mountRig.js']) assert.equal(/brokenWhy|cartRefusal/.test(rd(host)), false, host);
});

test('WAGONS4 THE RUNTIME\'S WEAR: the driven wagon worn by the metres its team pulls it (driven, or following) - on the road or off, by its load - and nothing when it stays; its state\'s step down said once; a journey\'s days and the watch\'s throw; the cart\'s pace by its state (mutants: the wear when it stays, the road unread, the words every frame)', () => {
  const said = [];
  const w = wagon('cart');
  const items = [w];
  let on = true;
  const u = createUpkeep({ items: () => items, now: () => 1e6, wagonUpkeep: () => (on ? WHARD : null), say: (t) => said.push(t) });
  u.tick(0.016, { mode: 'Foot', metres: 500, wagonGoes: false });
  assert.equal(wagonCondition(w), 1400, 'it stayed: no wear');
  for (let i = 0; i < 100; i++) u.tick(0.016, { mode: 'Cart', metres: 10, road: true, wagonGoes: true });
  assert.equal(wagonCondition(w), 1386, 'a kilometre of road: 1%');
  for (let i = 0; i < 100; i++) u.tick(0.016, { mode: 'Cart', metres: 10, road: false, load: 1, wagonGoes: true });
  assert.equal(wagonCondition(w), 1386 - Math.round(1400 * 0.025 * 1.75), 'off it, fully loaded');
  u.tick(0.016, { mode: 'Cart', metres: 5000, wagonGoes: true });
  assert.equal(wagonCondition(w), 1386 - 61, 'a leap of kilometres in one frame is a placement, never a road');
  assert.deepEqual(said, [], 'sound to worn: nothing to say');
  w.currentCondition = 430;
  for (let i = 0; i < 100; i++) u.tick(0.016, { mode: 'Cart', metres: 10, wagonGoes: true });
  assert.deepEqual(said, [WAGON_UPKEEP_TEXT.rickety('Small Cart')], 'worn to rickety: said once');
  w.currentCondition = 145;
  for (let i = 0; i < 100; i++) u.tick(0.016, { mode: 'Cart', metres: 10, wagonGoes: true });
  assert.deepEqual(said, [WAGON_UPKEEP_TEXT.rickety('Small Cart'), WAGON_UPKEEP_TEXT.failing('Small Cart')], 'rickety to failing: said once');
  assert.equal(u.rideScale('Cart'), 0.7, 'a failing wagon: its team at 0.7');
  w.currentCondition = 1400;
  const j = u.journey(10);
  assert.equal(wagonCondition(w), 1260, 'ten days on the road: 10%');
  assert.equal(j.after.key, 'sound');
  w.currentCondition = 5;
  u.journey(30);
  assert.equal(wagonCondition(w), 1, 'a journey always arrives - never broken on the road');
  w.currentCondition = 100;
  const before = said.length;
  u.thrown();
  assert.equal(wagonCondition(w), 1, 'thrown: 10% of whole off - WAGON-MEND: to its last point, never to nought');
  assert.equal(said.length, before, 'failing to failing: nothing more said');
  assert.equal(u.mendPrice(), 40); assert.equal(u.mendPrice(true), 60);
  on = false;
  w.currentCondition = 1400;
  u.tick(0.016, { mode: 'Cart', metres: 900, wagonGoes: true });
  assert.deepEqual([wagonCondition(w), u.journey(10), u.thrown(), u.rideScale('Cart')], [1400, null, null, 1], 'Off: no wear, the cart its own pace');
});

test('WAGONS4 THE KIT: a Wagon Repair Kit spent on the wagon where its load is reached - an hour passed, out of the list it was used from; never past 60%; the Stable card\'s button and an inventory\'s Use alike (mutants: the reach unread, the hour, the kit not spent)', () => {
  const w = wagon('openWagon', 0);
  const items = [w, { group: 'UselessItems2', templateIndex: UPKEEP_ITEM.WagonKit, stackCount: 2 }];
  const passed = [];
  const u = createUpkeep({ items: () => items, now: () => 1e6, wagonUpkeep: () => WHARD });
  assert.equal(u.act('kit', 0, { wagonNear: false }).text, WAGON_UPKEEP_TEXT.kitNotNear('Open Wagon'));
  const r = u.act('kit', 0, { pass: (m) => passed.push(m) });
  assert.deepEqual([r.ok, wagonCondition(w), items[1].stackCount, passed], [true, 350, 1, [60]]);
  const m = u.model();
  assert.deepEqual([m.wagon.stateKey, m.wagon.kitWorks, m.kits], ['rickety', true, 1]);
  // the Use, out of the wagon's own load
  const load = [{ group: 'UselessItems2', templateIndex: UPKEEP_ITEM.WagonKit }];
  registerUpkeepUses(u, { reach: () => ({ near: true, stabled: false, wagonNear: true, who: 'Your horse' }), pass: (n) => passed.push(n), horseCare: () => HARD, wagonUpkeep: () => WHARD });
  const use = itemUseHandler(UPKEEP_ITEM.WagonKit);
  const r2 = use(load[0], load);
  assert.equal(r2.kind, 'upkeep'); assert.match(r2.text, /It is 50% sound\./);
  assert.deepEqual([load.length, items[1].stackCount, passed], [0, 1, [60, 60]], 'the wagon\'s kit spent, the pack\'s kept');
  w.currentCondition = 900;
  assert.equal(u.act('kit').ok, false, 'over 60%: a kit does no more');
  assert.match(itemStatRows(items[1]).map((x) => x.text).join(' '), /Repairs 25% of a wagon, up to 60%\. Takes an hour\./);
});

test('WAGONS4 THE WAGON YARD MENDS: its keeper\'s third row, the Stable\'s two; the press asks the host\'s wright (mutants: the row on the Stable, the press unread)', async () => {
  assert.deepEqual(yardRowsFor('stable'), [...YARD_ROWS]);
  assert.deepEqual(yardRowsFor('transport'), [...YARD_ROWS, YARD_MEND_ROW]);
  assert.deepEqual(YARD_MEND_ROW, { id: 'mend', label: 'Mend' });
  const host = rd('src/scenes/merchantYardsHost.js');
  assert.match(host, /actions: yardRowsFor\(p\.y\.site\.kind\)\.map\(\(r\) => \(\{ id: r\.id, label: r\.label \}\)\) \};/);
  assert.match(host, /if \(verb === 'mend' && p\.y\.site\.kind === 'transport' && \(p\.what === 'keeper' \|\| p\.what === 'sign'\)\) return mend\(p\.y\.site\) !== false;/);
  const w = hostText('src/scenes/world.js');
  assert.match(w, /mend: \(\) => mendAtYard\(\),/);
  assert.match(w, /const away = !!rt\?\.physicalPersistenceEnabled && !rt\.canAccessWagonInventory\?\.\(\)\?\.allowed;\n\s*const price = upkeep\.mendPrice\(away\);/, 'a wright sent out to a wagon out of the counter\'s reach');
  assert.match(w, /if \(totalGoldAmount\(playerEntity\) < price\) \{ townTalk\.say\(WAGON_UPKEEP_TEXT\.poor\(price\)\); return; \}\n\s*deductGold\(playerEntity, price\);\n\s*mendWagon\(w\);/, 'asked, then paid, then mended');
});

test('WAGONS4 A SMITH MENDS NO HORSE AND NO WAGON: a wagon left at a smith\'s counter left the pack for days - its horse and the mod\'s wagon in the world with it - so both are refused first, in their own words, at both counters (mutants: the refusal dropped, its words)', () => {
  assert.equal(repairRefusal({ templateIndex: 93, currentCondition: 10, maxCondition: 1400 }), 'transport');
  assert.equal(repairRefusal({ templateIndex: 94, currentCondition: 10, maxCondition: 100 }), 'transport');
  assert.equal(repairRefusal({ templateIndex: 113, group: 'Weapons', currentCondition: 10, maxCondition: 100 }), null);
  assert.match(TRANSPORT_CANNOT_BE_REPAIRED_TEXT, /Wagon Yard repairs wagons/);
  for (const f of ['src/ui/enhanced/enhancedTrade.js', 'src/ui/native/nativeTrade.js']) assert.match(rd(f), /transport: \[\{ text: TRANSPORT_CANNOT_BE_REPAIRED_TEXT, center: true \}\],/, f);
  assert.match(rd('src/scenes/worldModes.js'), /: refusal === 'transport' \? \[TRANSPORT_CANNOT_BE_REPAIRED_TEXT\]/);
});

test('WAGONS4 THE ROW AND THE HOSTS: a Features row beside horse care (its tiers WAGON-TIERS\', test/systems/wagontiers.test.js); the hosts hand the runtime the wear - the odometer\'s, a journey\'s days, the watch\'s throw (mutants: each door dropped)', () => {
  const f = FEATURES.find((x) => x.id === 'wagon-upkeep');
  assert.deepEqual([f.group, f.kinds, f.control.key], ['world', ['enhanced'], 'wagonUpkeep']);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /teamShort: \(\) => wagonTeamShort\(playerEntity\.items \?\? \[\]\),/, host);
    assert.match(s, /wagonGoes: mode === TRANSPORT_MODES\.Cart \|\| !!hccRuntimeOn\(\)\?\.view\?\.\(\)\?\.teamFollowing,/, `${host}: worn while it rolls with me`);
  }
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const upkeepWagonWent = hccOn\(\) \? !!hccRuntimeOn\(\)\?\.wagonGoesOnJourney\?\.\(\) : hasTransport\(TRANSPORT_SMALL_CART\);/);
  assert.match(w, /playerTicker\.advance\(computed\.minutes\);\n\s*if \(upkeepWagonWent\) upkeep\.journey\(travelDays\(computed\.minutes\)\);/, 'the journey\'s days on the wagon that went');
  assert.match(w, /thrown: \(\) => upkeep\.thrown\(\),/);
  assert.match(rd('src/scenes/wagon/wagonWardenHost.js'), /notify\(\[WARDEN_TEXT\.thrown\(town\), WARDEN_TEXT\.fetch\]\);\n\s*thrown\(\);/);
  // the item law: wear is condition alone - a marked wagon's value never falls under its kind's floor
  const worn = wagon('caravan', 0);
  assert.equal(worn.value, WAGON_KINDS.caravan.value);
});

test('AUDIT WAGONS4 NO HELD REPAIRS OBJECTS: the enchantment\'s pick passes a wagon and a horse by - the Wagon Yard\'s and the kit\'s alone (mutants: AUDIT-WAGONS4-enchantment-mends)', () => {
  const sword = { group: 'Weapons', templateIndex: 113, currentCondition: 900, maxCondition: 1000 };
  const worn = wagon('caravan', 1);
  const sore = { group: 'Transportation', templateIndex: 94, currentCondition: 10, maxCondition: 100 };
  assert.equal(repairsObjectsTarget([worn, sore, sword]), sword, 'past the wagon and the horse, to the sword');
  assert.equal(repairsObjectsTarget([worn, sore]), null);
});
