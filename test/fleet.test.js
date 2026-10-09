// HOLDINGS - THE FLEET (2026-10-03, Mac: "You can also do this with ships instead of relying on a deed item ... Ships
// show their values, current health, and option to repair if theres crew (even if youre away) etc ... Introducing the
// new ship upgrade system. Allowing you to improve capacity, speed, health, damage, etc. This can utilize foraging items
// used within the world. Loaned ships shouldnt be able to be upgraded until the loan is paid off. This also introduces
// the ability to change your ship name for others to see ... Ship deeds can now be replaced in favor of the new
// enhanced plus UI tabs on the pause menu" - bible/03-World/Holdings.md).
//
// The ledger (systems/fleet.js: the titles' book, the name's law, the refits' costs and effects, the bank's claim, the
// save); Come Sail Away over the book (systems/comeSailAway.js: a deed found there, a ship's parts placed spending her
// parts and keeping her title, SummonBoat, LayUpBoat - the real runtime over test/csaScene.mjs); the refits where the
// helm and the sea read them; the sea fight's away repairs, refit and berth (scenes/navalHost.js - test/navalSea.mjs);
// the host half (scenes/fleetHost.js - where she is, every refusal, every act); the names on the boats' word
// (systems/comeSailAwayWire.js `n`); the page (ui/fleetPage.js); the purchase and the prize into the book.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, terrain } from './csaScene.mjs';
import { sea } from './navalSea.mjs';
import {
  shipNameVerdict, shipLabel, upgradeCost, refitOf, materialCount, takeMaterials, loanOwed, titleDeed, titleDeedsIn, knowShip, renameShip, addRefit,
  retitle, fleetShip, fleetShips, fleetBook, titleOf, fleetSaveData, restoreFleetSaveData, newFleetSaveData, _resetFleetForTests,
  settleCredit, forgetShip,
  SHIP_NAME_MAX, UPGRADE_LINES, UPGRADE_TIERS, TIER_GOLD, TIER_MATS, HULL_UPGRADE_SCALE, MATERIALS, FLEET_SAVE_VENDOR, FLEET_MAX, SHIP_VALUE_MAX,
} from '../src/systems/fleet.js';
import { mintDeed, mintBoatItem, BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE } from '../src/systems/comeSailAwayItems.js';
import { HULL_PRICES } from '../src/systems/comeSailAwayBoat.js';
import { csaWireRecord, validCsaRecord, csaRecordKey } from '../src/systems/comeSailAwayWire.js';
import { createFleetHost, CREWED_HULLS, compassWay, hasGuns } from '../src/scenes/fleetHost.js';
import { hullBuild, firstBuildOf } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { FIELD_MEND_CAP, STORE_POINTS } from '../src/systems/naval/navalYard.js';
import { mintStores, storesIn, spendStore } from '../src/systems/naval/navalStores.js';
import { addItem } from '../src/systems/inventory.js';
import { drawFleetPage, whereWords, refitLine, resetFleetPage, fleetPageShown, FLEET_PAGE_SECTIONS } from '../src/ui/fleetPage.js';
import { setHoldingsProvider, _setHoldingsIconForTests } from '../src/ui/holdingsPages.js';
import { checkName } from '../src/net/nameFilter.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const AT = [100, 34, 200], DIR = [0, 0, 1];
const item = (templateIndex, n = 1) => ({ templateIndex, stackCount: n, UID: Math.floor(Math.random() * 1e9) });

// ── the ledger's law ─────────────────────────────────────────────────────────────────────────────────────────────────


/** SHIP-CREDIT WITHDRAWN (2026-10-08): no purchase stamps the bank's claim any more - a ship bought on credit before
 *  carries hers in the save, so a claimed ship is made the one way that remains: her record restored with it, beside
 *  the ledger's others. */
const claimedShip = ({ uid, hull, value, credit, port = null }) => {
  restoreFleetSaveData({ v: 1, ships: [...fleetSaveData().ships, { uid, hull, variant: 0, value, name: '', upgrades: {}, credit, port, title: true }] });
  return fleetShip(uid);
};

test('FLEET a name: printable ASCII, its runs of spaces closed, trimmed, SHIP_NAME_MAX at most; refused by the name filter every player\'s name passes; empty is her hull\'s again (mutants: the band, the bound, the filter)', () => {
  assert.equal(SHIP_NAME_MAX, 24);
  assert.deepEqual(shipNameVerdict('  The   Sea  Wolf '), { ok: true, name: 'The Sea Wolf', reason: null });
  assert.deepEqual(shipNameVerdict('Sea​Wolfé'), { ok: true, name: 'SeaWolf', reason: null }, 'the zero width and the accent stripped');
  assert.equal(shipNameVerdict('x'.repeat(40)).name.length, 24);
  const admin = shipNameVerdict('Admin');
  assert.equal(admin.ok, false);
  assert.equal(admin.reason, checkName('Admin').reason);
  assert.deepEqual(shipNameVerdict('   '), { ok: true, name: '', reason: null });
  assert.equal(shipLabel({ hull: 2, variant: 0, name: '' }), "Small Ship 'I'");
  assert.equal(shipLabel({ hull: 2, variant: 0, name: 'Gull' }), 'Gull');
});

test('FLEET the refits: four lines (Hold, Rigging, Hull, Guns), three tiers each; a tier\'s gold and each material\'s count a Small Ship\'s times her hull\'s share; refitOf her multiples (mutants: per tier, a cost\'s scale, a material\'s count)', () => {
  assert.deepEqual(UPGRADE_LINES.map((l) => [l.id, l.per, l.effect, [...l.mats], l.guns]), [
    ['hold', 0.2, 'cargo', ['timber', 'iron'], false], ['rigging', 0.04, 'speed', ['timber', 'pitch'], false],
    ['hull', 0.1, 'hull', ['timber', 'pitch', 'iron'], false], ['guns', 0.08, 'guns', ['iron', 'pitch'], true],
  ]);
  assert.equal(UPGRADE_TIERS, 3);
  assert.deepEqual([...TIER_GOLD], [600, 1500, 3500]);
  assert.deepEqual([...TIER_MATS], [3, 6, 10]);
  assert.deepEqual([...HULL_UPGRADE_SCALE], [0.5, 0.75, 1, 1.75, 2.5]);
  assert.deepEqual(upgradeCost(2, 'hull', 0), { gold: 600, mats: [{ kind: 'timber', n: 3 }, { kind: 'pitch', n: 3 }, { kind: 'iron', n: 3 }] });
  assert.deepEqual(upgradeCost(4, 'guns', 2), { gold: 8750, mats: [{ kind: 'iron', n: 25 }, { kind: 'pitch', n: 25 }] });
  assert.deepEqual(upgradeCost(0, 'hold', 1), { gold: 750, mats: [{ kind: 'timber', n: 3 }, { kind: 'iron', n: 3 }] });
  assert.equal(upgradeCost(2, 'hold', 3), null, 'past the last');
  assert.equal(upgradeCost(2, 'sails', 0), null);
  assert.deepEqual(refitOf({ upgrades: { hold: 2, rigging: 1, hull: 3, guns: 0 } }), { cargo: 1.4, speed: 1.04, hull: 1.3, guns: 1 });
  assert.deepEqual(refitOf(null), { cargo: 1, speed: 1, hull: 1, guns: 1 });
  assert.deepEqual(refitOf({ upgrades: { hold: 9 } }).cargo, 1 + 0.2 * 3, 'a tier past the last is the last');
});

test('FLEET the materials: what in the world each is - the Wood-Axe\'s Wood Bundle, DFU\'s Iron and Pine Branch, the Stores\' planks, logs, ingots and resin withdrawn online; counted over the pack and her hold, stacks and all; taken all or none, the first list first', () => {
  assert.deepEqual([...MATERIALS.timber.templates], [1604, 645, 646, 647, 648, 649, 650, 651, 635, 636, 637, 638, 639, 640, 641]);
  assert.deepEqual([...MATERIALS.iron.templates], [71, 620, 621]);
  assert.deepEqual([...MATERIALS.pitch.templates], [14, 653]);
  const T = JSON.parse(read('src/characters/itemTemplates.json'));
  assert.deepEqual([71, 14].map((i) => T.find((t) => t.index === i).name), ['Iron', 'Pine Branch'], 'DFU\'s own ingredients');
  const F = JSON.parse(read('vendor/foraging/ItemTemplates.json'));
  assert.equal(F.find((t) => t.index === 1604).name, 'Wood Bundle');
  const pack = [item(1604, 2), item(50), item(645)], hold = [item(1604, 4)];
  assert.equal(materialCount([pack, hold], 'timber'), 7);
  assert.equal(takeMaterials([pack, hold], 'timber', 8), false);
  assert.equal(materialCount([pack, hold], 'timber'), 7, 'none taken');
  assert.equal(takeMaterials([pack, hold], 'timber', 4), true);
  assert.deepEqual(pack.map((i) => i.templateIndex), [50], 'the pack\'s first, its stack and its plank');
  assert.equal(hold[0].stackCount, 3, 'the hold\'s stack thinned');
});

test('FLEET the bank\'s claim: she is owed for while her region\'s bank is owed anything - borrowing more (its due date later) or the Empire calling the debt in (its due date now) never lifts it; cleared for good once the Fleet sees that bank owed nothing, a later loan there no claim of hers (PIN MOVED, AUDIT HOLDINGS F4: the due date read lifted it with the loan unpaid)', () => {
  _resetFleetForTests();
  const accounts = Array.from({ length: 62 }, () => ({ loanTotal: 0, loanDueDate: 0 }));
  const rec = claimedShip({ uid: 1700, hull: 2, value: 100000, credit: { region: 17, due: 5000 } });
  accounts[17] = { loanTotal: 66000, loanDueDate: 5000 };
  assert.deepEqual(loanOwed(rec, accounts), { region: 17, owed: 66000 });
  accounts[17].loanDueDate = 9000;   // borrowed more: the due date put later
  assert.deepEqual(loanOwed(rec, accounts), { region: 17, owed: 66000 }, 'more borrowed - still hers');
  accounts[17].loanDueDate = 1200;   // callInEmpireDebt: due now, unpaid
  assert.deepEqual(loanOwed(rec, accounts), { region: 17, owed: 66000 }, 'the debt called in - still hers');
  assert.equal(settleCredit(accounts), 0, 'owed: nothing settled');
  accounts[17] = { loanTotal: 0, loanDueDate: 0 };
  assert.equal(loanOwed(rec, accounts), null, 'paid');
  assert.equal(settleCredit(accounts), 1, 'her claim cleared');
  assert.equal(rec.credit, null);
  accounts[17] = { loanTotal: 9000, loanDueDate: 99999 };
  assert.equal(loanOwed(rec, accounts), null, 'a later loan there is no claim of hers');
  assert.equal(loanOwed({ credit: null }, accounts), null);
});

test('FLEET the book: a deed entered is out of the pack and in the book, her record made (hull, variant, worth off the deed); a port stamped, never a claim (SHIP-CREDIT WITHDRAWN); never entered twice; titleDeedsIn sweeps a pack; retitle makes a spent title again', () => {
  _resetFleetForTests();
  const pack = [item(50), mintDeed(3, 0, 801, 200000), mintDeed(2, 0, 802, 25000)];
  const r = titleDeed(pack[1], { from: pack, credit: { region: 4, due: 77 }, port: { name: 'Sentinel' } });
  assert.deepEqual({ ...r }, { uid: 801, hull: 3, variant: 0, value: 200000, name: '', upgrades: { hold: 0, rigging: 0, hull: 0, guns: 0 }, credit: null, port: { name: 'Sentinel' } });
  assert.equal(pack.length, 2);
  assert.equal(titleOf(801)?.templateIndex, BOAT_DEED_TEMPLATE);
  titleDeed(titleOf(801));
  assert.equal(fleetBook().length, 1, 'not entered twice');
  assert.equal(titleDeedsIn(pack), 1);
  assert.deepEqual(pack.map((i) => i.templateIndex), [50]);
  assert.equal(titleDeed({ templateIndex: BOAT_PARTS_TEMPLATE, UID: 9 }), null, 'parts are no deed');
  // a spent title (a small boat placed) made again
  fleetBook().splice(fleetBook().indexOf(titleOf(802)), 1);
  assert.equal(titleOf(802), null);
  const t = retitle(802);
  assert.deepEqual([t.UID, t.message, t.value], [802, 20, 25000]);
  assert.equal(retitle(802), t, 'one title');
});

test('FLEET the save: her record round-trips whole, her title by a flag; an older save has none; a hand-made record put right (an unknown hull dropped, a refused name emptied, a tier past the last the last, a claim with no region dropped) - AUDIT HOLDINGS F7: one record a number (a second title never), a variant her hull has, her worth within bounds, a port\'s name printable, FLEET_MAX at most', () => {
  _resetFleetForTests();
  claimedShip({ uid: 901, hull: 4, value: 37500, credit: { region: 2, due: 10 }, port: { name: 'Wayrest' } });
  knowShip(902, 1, 3, 8000);
  renameShip(901, 'Mara\'s Grace');
  addRefit(901, 'guns'); addRefit(901, 'guns');
  const saved = JSON.parse(JSON.stringify(fleetSaveData()));
  assert.equal(FLEET_SAVE_VENDOR, 'Fleet');
  assert.deepEqual(saved, { v: 1, ships: [
    { uid: 901, hull: 4, variant: 0, value: 37500, name: 'Mara\'s Grace', upgrades: { hold: 0, rigging: 0, hull: 0, guns: 2 }, credit: { region: 2, due: 10 }, port: { name: 'Wayrest' }, title: true },
    { uid: 902, hull: 1, variant: 3, value: 8000, name: '', upgrades: { hold: 0, rigging: 0, hull: 0, guns: 0 }, credit: null, port: null, title: false },
  ] });
  restoreFleetSaveData(newFleetSaveData());
  assert.equal(fleetShips().length, 0);
  restoreFleetSaveData(saved);
  assert.deepEqual(JSON.parse(JSON.stringify(fleetSaveData())), saved);
  assert.equal(titleOf(901)?.message, 40);
  // PIN MOVED (AUDIT HOLDINGS F4): a claim is her region's - its due date no longer read, a claim with none kept
  restoreFleetSaveData({ ships: [{ uid: 5, hull: 9 }, { uid: 6, hull: 2, name: 'Admin', upgrades: { hull: 7 }, credit: { region: 1 } }, { uid: -1, hull: 2 }, { uid: 7, hull: 2, credit: { due: 5 } }] });
  assert.deepEqual(fleetShips().map((r) => [r.uid, r.name, r.upgrades.hull, r.credit]), [[6, '', 3, { region: 1, due: 0 }], [7, '', 0, null]]);
  // AUDIT HOLDINGS F7: a hostile save
  restoreFleetSaveData({ ships: [
    { uid: 20, hull: 2, title: true, value: -50 }, { uid: 20, hull: 2, title: true, value: 9 },   // one number twice
    { uid: 21, hull: 1, variant: 8, title: true, value: 1e308 },                                   // a variant no Large Boat has
    { uid: 22, hull: 2, variant: 3, port: { name: 'Way\u202erest\u0007  of\nthe Bay' } },        // a Small Ship has one rig; a port's name with controls
  ] });
  assert.equal(fleetBook().filter((d) => d.UID === 20).length, 1, 'one title a number');
  assert.equal(fleetShip(20).value, 0, 'her worth never under nought');
  assert.deepEqual([fleetShip(21).variant, fleetShip(21).value, titleOf(21).message], [0, SHIP_VALUE_MAX, 10], 'a variant her hull has, her worth capped');
  assert.deepEqual([fleetShip(22).variant, fleetShip(22).port], [0, { name: 'Wayrest of the Bay' }]);
  restoreFleetSaveData({ ships: Array.from({ length: FLEET_MAX + 40 }, (_, i) => ({ uid: 100 + i, hull: 0 })) });
  assert.equal(fleetShips().length, FLEET_MAX, 'FLEET_MAX at most');
});

// ── Come Sail Away over the book ─────────────────────────────────────────────────────────────────────────────────────

/** Come Sail Away's runtime with the world host's item seams: the pack, the Fleet's book and its retitle. */
function csaWithBook(opts = {}) {
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20), terrain(11, 20)], ...opts });
  const pack = [];
  let uid = 7000;
  s.deps.items = {
    create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack,
    titles: () => fleetBook(), retitle: (boat, parts) => { knowShip(boat.uid, boat.hull, boat.variant, parts?.value); return !!retitle(boat.uid); },
  };
  s.deps.cargoWeight = (items) => items.reduce((a, it) => a + (it.weightInKg ?? 0), 0);
  s.deps.isPortTown = () => true;
  return Object.assign(s, { pack });
}

test('FLEET a ship\'s title in the book is her deed to every law that asked the pack: she is picked up (PackBoat) and her title leaves the book with her - her parts are her; placed again, her parts are spent, her title back in the book and no deed in the pack (PIN MOVED, AUDIT HOLDINGS F1: a title kept while her parts lay elsewhere stood her twice)', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(2, 0, 600, 100000));
  const b = s.rt.LaunchFromDeed(titleOf(600), () => fleetBook(), AT, DIR, s.terrains[0]);
  assert.ok(b?.crewed);
  assert.ok(titleOf(600), 'a crewed ship keeps her title on placing');
  assert.equal(s.rt.deedMissing(b), false, 'her deed found in the book');
  assert.equal(s.rt.PackBoat(b, true), true);
  assert.equal(titleOf(600), null, 'her title goes with her - her parts are her');
  assert.ok(fleetShip(600), 'her record kept: her name, her refits');
  const parts = s.pack.at(-1);
  assert.deepEqual([parts.templateIndex, parts.UID], [BOAT_PARTS_TEMPLATE, 600]);
  const again = s.rt.LaunchFromParts(parts, () => s.pack, AT, DIR, s.terrains[0]);
  assert.equal(again.uid, 600);
  assert.deepEqual(s.pack, [], 'her parts spent, no deed into the pack');
  assert.equal(fleetBook().filter((d) => d.UID === 600).length, 1, 'one title, the book\'s');
});

test('FLEET an older save\'s ship packed with her deed (her parts in the pack, no title anywhere): placed, her title is made in the book and her parts spent - never a deed in the pack (the old swap only without the book)', () => {
  const s = csaWithBook();
  const parts = Object.assign(mintBoatItem(BOAT_PARTS_TEMPLATE, 650), { message: 30, value: 200000 });
  s.pack.push(parts);
  const b = s.rt.LaunchFromParts(parts, () => s.pack, AT, DIR, s.terrains[0]);
  assert.ok(b.crewed);
  assert.deepEqual(s.pack, []);
  assert.deepEqual([titleOf(650)?.message, fleetShip(650)?.value], [30, 200000]);
  // without the book's seam, the mod's own swap stands (SHIP-PACK)
  const plain = scene({ terrains: [terrain(10, 20)] });
  const pk = [Object.assign(mintBoatItem(BOAT_PARTS_TEMPLATE, 651), { message: 30, value: 5 })];
  plain.deps.items = { create: (t) => mintBoatItem(t, 1), addToPlayer: (it) => pk.push(it), player: () => pk };
  plain.rt.LaunchFromParts(pk[0], () => pk, AT, DIR, plain.terrains[0]);
  assert.deepEqual(pk.map((i) => [i.templateIndex, i.UID]), [[BOAT_DEED_TEMPLATE, 651]]);
});

test('FLEET SummonBoat: a ship standing anywhere is moved to the place given (RepositionBoat); one laid up is placed from her title (the book her collection - a small boat\'s title spent as the mod spends its deed, a ship\'s kept); never the boat at the helm', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(2, 0, 700, 1));
  const ship = s.rt.SummonBoat(700, titleOf(700), fleetBook(), [500, 34, 500], [1, 0, 0], s.terrains[0]);
  assert.ok(ship && s.rt.GetPlacedBoatWithUID(700) === ship);
  assert.ok(titleOf(700), 'a ship\'s title kept');
  const moved = s.rt.SummonBoat(700, titleOf(700), fleetBook(), [600, 34, 600], [0, 0, 1], s.terrains[0]);
  assert.equal(moved, ship, 'the same boat');
  assert.deepEqual([ship.GameObject.position[0], ship.GameObject.position[2]], [600, 600]);
  assert.equal(s.rt.AllBoats.length, 1);
  titleDeed(mintDeed(1, 2, 701, 8000));
  const small = s.rt.SummonBoat(701, titleOf(701), fleetBook(), [700, 34, 700], [0, 0, 1], s.terrains[0]);
  assert.equal(small.variant, 2);
  assert.equal(titleOf(701), null, 'a small boat\'s title spent on placing');
  s.rt.StartSailing(ship);
  assert.equal(s.rt.SummonBoat(700, titleOf(700), fleetBook(), [1, 34, 1], [0, 0, 1]), null, 'not the boat at the helm');
  assert.equal(s.rt.SummonBoat(999, null, fleetBook(), [1, 34, 1], [0, 0, 1]), null, 'no title, no boat');
});

test('FLEET LayUpBoat: her hold into PackedCargoes under her number (onto what a pick-up left there), her boat gone from the world; placed again her hold comes back aboard; refused at the helm, with another player aboard, and with no number', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(2, 0, 710, 1));
  const b = s.rt.SummonBoat(710, titleOf(710), fleetBook(), AT, DIR, s.terrains[0]);
  b.Cargo.Items.push(mintStores(3), { templateIndex: 50, name: 'rope', weightInKg: 1 });
  assert.equal(s.rt.LayUpBoat(b), true);
  assert.equal(s.rt.GetPlacedBoatWithUID(710), null);
  assert.equal(storesIn(s.rt.laidUpHold(710)), 3);
  assert.equal(s.rt.laidUpHold(710).length, 2);
  const back = s.rt.SummonBoat(710, titleOf(710), fleetBook(), AT, DIR, s.terrains[0]);
  assert.equal(storesIn(back.Cargo.Items), 3, 'her hold aboard again');
  assert.equal(s.rt.laidUpHold(710).length, 0);
  s.deps.passengersAboard = () => 1;
  assert.equal(s.rt.LayUpBoat(back), false);
  s.deps.passengersAboard = () => 0;
  s.rt.StartSailing(back);
  assert.equal(s.rt.LayUpBoat(back), false);
  const none = s.place(1);
  assert.equal(s.rt.LayUpBoat(none), false, 'no number');
});

test('FLEET her Rigging refit on her way under sail and its coming on, never her oars; her Hold refit on the threshold her load is weighed against (the deps seam, read where the rates are read)', () => {
  const s = csaWithBook();
  const b = s.place(2);
  s.rt.StartSailing(b);
  const P = s.rt.properties;
  s.rt.state.sailPosition = 1;
  const sail = P.moveSpeed();
  s.deps.refit = () => ({ speed: 1.12, cargo: 1 });
  assert.ok(Math.abs(P.moveSpeed() / sail - 1.12) < 1e-5, `${P.moveSpeed() / sail}`);
  s.rt.state.sailPosition = 0;
  const oar = P.moveSpeed();
  s.deps.refit = () => null;
  assert.equal(P.moveSpeed(), oar, 'oars unrefitted');
  // the hold: a load that slows her unrefitted (half again her threshold) does not at +60%
  s.deps.cargoWeight = () => 1.5 * 500 * b.modifierCargoThreshold;
  s.rt.UpdateBoatCargoMod(b);
  const slow = s.rt.state.boatCargoMod;
  assert.ok(slow < 1);
  s.deps.refit = () => ({ speed: 1, cargo: 1.6 });
  s.rt.UpdateBoatCargoMod(b);
  assert.ok(s.rt.state.boatCargoMod > slow, `${s.rt.state.boatCargoMod} > ${slow}`);
});

// ── the names on the word ────────────────────────────────────────────────────────────────────────────────────────────

test('FLEET a named boat says her name on the boats\' word (`n`, a name for each of `b`\'s) only while one is named - an unnamed fleet\'s record is the older build\'s to the letter; a reader takes each through the ledger\'s law and never drops the boats for a bad `n`; a rename changes the key', () => {
  const v = (name) => ({ hull: 2, variant: 0, position: [1, 2, 3], rotation: [0, 0, 0, 1], sails: 0, helm: false, light: false, name });
  const plain = csaWireRecord([v(''), v(undefined)]);
  assert.deepEqual(Object.keys(plain), ['b']);
  const named = csaWireRecord([v('  Gull '), v(''), v('Admin')]);
  assert.deepEqual(named.n, ['Gull', '', '']);
  const read = validCsaRecord(JSON.parse(JSON.stringify(named)));
  assert.deepEqual(read.boats.map((b) => b.name), ['Gull', undefined, undefined], 'an unnamed boat\'s shape the older build\'s');
  // a bad n: the boats stand, nameless
  for (const n of [['a'], 'Gull', [1, 2, 3], ['x'.repeat(200), '', '']]) {
    const r = validCsaRecord({ ...JSON.parse(JSON.stringify(named)), n });
    assert.equal(r?.boats.length, 3, JSON.stringify(n).slice(0, 30));
    assert.equal(r.boats[0].name, undefined);
  }
  // a peer's word claiming a refused name reads as none
  assert.equal(validCsaRecord({ ...named, n: ['Fuck', '', ''] }).boats[0].name, undefined);
  assert.notEqual(csaRecordKey(named), csaRecordKey(csaWireRecord([v('Tern'), v(''), v('')])));
  assert.equal(csaRecordKey(plain), JSON.stringify(plain.b), 'an unnamed, unmoving fleet\'s key the older one');
});

// ── the sea fight's half ─────────────────────────────────────────────────────────────────────────────────────────────

test('FLEET her Hull refit on her hull\'s and canvas\'s whole (myBoatState\'s build); her Guns refit on her balls\' hull and canvas harm, never a barrel\'s (mutants: the build, the multiplier)', async () => {
  const s = await sea({ hull: 2 });
  s.deps.refit = (b) => (b?.uid === 42 ? { hull: 1.3, guns: 1.24, cargo: 1, speed: 1 } : null);
  const st = s.host.fleetStatus(s.boat);
  assert.deepEqual([st.maxHull, st.maxSail], [Math.round(hullBuild(2).hullHp * 1.3), Math.round(hullBuild(2).sailHp * 1.3)]);
  assert.equal(st.maxCrew, hullBuild(2).crew, 'her crew her build\'s');
  const src = read('src/scenes/navalHost.js');
  assert.match(src, /if \(byMe && e\.type !== 'blast'\) gunsRefit\(hurt, e\.shooter\);/);
  assert.match(src, /const uid = Number\(String\(shooter\)\.slice\(MY_BOAT\.length \+ 1\)\);/);
  assert.match(src, /if \(Number\.isFinite\(hurt\.hull\)\) hurt\.hull \*= k;\n    if \(Number\.isFinite\(hurt\.sail\)\) hurt\.sail \*= k;/);
});

test('FLEET a refit never heals her nor hurts her: her state built again on her new whole, her hurts the share they were, her powder kept (refitBoat); a waiting record is read on the new whole when she stands', async () => {
  const first = firstBuildOf(2);
  const save = { v: 2, boats: { 42: { hull: first.hullHp / 2, sail: first.sailHp, maxHull: first.hullHp, maxSail: first.sailHp, crew: hullBuild(2).crew, fire: 0, state: SHIP_STATES.afloat, credit: 0, barrels: 1 } } };
  let k = 1.2;
  const s = await sea({ hull: 2, save });
  s.deps.refit = () => ({ hull: k, guns: 1, cargo: 1, speed: 1 });
  const a = s.host.fleetStatus(s.boat);
  assert.equal(a.maxHull, Math.round(hullBuild(2).hullHp * 1.2), 'the waiting record read on her refitted whole');
  assert.ok(Math.abs(a.hull / a.maxHull - 0.5) < 1e-6, 'half her whole');
  k = 1.3;
  s.host.refitBoat(s.boat);
  const b = s.host.fleetStatus(s.boat);
  assert.equal(b.maxHull, Math.round(hullBuild(2).hullHp * 1.3));
  assert.ok(Math.abs(b.hull / b.maxHull - 0.5) < 0.01, `still half: ${b.hull} of ${b.maxHull}`);
  assert.equal(b.barrels, 1, 'her powder kept');
  s.host.refitBoat({ uid: 999, hull: 2 });   // no state: nothing to build again
});

test('FLEET REPAIRS MADE AWAY: her hands mend her free to FIELD_MEND_CAP of each whole, the rest paid out of her stores (a store STORE_POINTS of work, her hull first), a wreck refloated; refused with no crew, no hands, a fight, nothing to mend (mutants: the free reach, the budget)', async () => {
  const save = { v: 2, boats: { 42: { hull: 0, sail: firstBuildOf(2).sailHp * 0.2, maxHull: firstBuildOf(2).hullHp, maxSail: firstBuildOf(2).sailHp, crew: hullBuild(2).crew, fire: 0, state: SHIP_STATES.wrecked, credit: 0, barrels: 0 } } };
  const s = await sea({ hull: 2, save });
  const boat = s.boat;
  boat.Cargo.Items.length = 0;
  s.deps.stores = { count: (b) => storesIn(b?.Cargo?.Items), spend: (b) => spendStore(b?.Cargo?.Items), add: () => false };
  let st = s.host.fleetStatus(boat);
  assert.equal(st.wrecked, true);
  // no stores: the free half alone
  let r = s.host.repairAway(boat);
  st = s.host.fleetStatus(boat);
  assert.equal(r.ok, true);
  assert.match(r.text, /needs carpenter's stores for the rest/);
  assert.ok(Math.abs(st.hull - st.maxHull * FIELD_MEND_CAP) < 1e-6, `the free reach: ${st.hull}`);
  assert.ok(Math.abs(st.sail - st.maxSail * FIELD_MEND_CAP) < 1e-6);
  assert.equal(st.wrecked, false, 'refloated');
  // two stores: the hull first
  addItem(boat.Cargo.Items, mintStores(2));
  r = s.host.repairAway(boat);
  st = s.host.fleetStatus(boat);
  assert.ok(Math.abs(st.hull - (st.maxHull * FIELD_MEND_CAP + 2 * STORE_POINTS)) < 1e-6, `${st.hull}`);
  assert.equal(storesIn(boat.Cargo.Items), 0);
  assert.match(r.text, /2 stores spent/);
  // plenty: whole
  addItem(boat.Cargo.Items, mintStores(40));
  r = s.host.repairAway(boat);
  assert.match(r.text, /She's sound, Captain\./);
  assert.equal(s.host.fleetStatus(boat).wants, false);
  assert.deepEqual(s.host.repairAway(boat), { ok: false, text: 'She needs no repairs.', spent: 0 });
  // the refusals
  const row = await sea({ hull: 1 });
  assert.equal(row.host.repairAway(row.boat).text, 'She has no crew to make her repairs.');
});

test('FLEET the berth a summoned ship is brought to: the free berth of a known harbour nearest the player - none taken by a ship of the sea or a boat of mine - on the sea\'s top, her bow along it; none known, none (source pins over the harbour\'s own law)', () => {
  const src = read('src/scenes/navalHost.js');
  const at = src.indexOf('  function freeBerth(hull = HULL.Carrack) {');   // PIN MOVED (QUAYS): her hull asked
  assert.ok(at >= 0, 'freeBerth found');
  const body = src.slice(at, src.indexOf('\n  }\n', at));
  assert.match(body, /if \(!berthFree\(h\.key, i\) \|\| myBoats\(\)\.some\(\(m\) => Math\.hypot\(m\.GameObject\.position\[0\] - b\.pos\[0\], m\.GameObject\.position\[2\] - b\.pos\[1\]\) <= BERTH_SNAP_M\)\) continue;/);
  assert.match(body, /const d = Math\.hypot\(b\.pos\[0\] - f\[0\], b\.pos\[1\] - f\[2\]\);\n        if \(d < bestD\)/);
  // PIN MOVED (QUAYS): alongside the berth's quay for her own hull (shipLife.js alongside), where the berth's point stood
  assert.match(body, /const at = alongside\(b, hull, h\.harbour\.hull\); bestD = d; best = \{ position: \[at\[0\], deps\.seaY\(\), at\[1\]\], direction: forwardOfYaw\(b\.yaw\)/);
});

// ── the host half ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The host half over the real Come Sail Away runtime and a stand-in sea fight. */
function fleetWorld(opts = {}) {
  const s = csaWithBook();
  const w = { gold: opts.gold ?? 100000, nearPort: opts.nearPort ?? true, inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 190], accounts: Array.from({ length: 62 }, () => ({ loanTotal: 0, loanDueDate: 0 })), paid: [], berth: opts.berth ?? { position: [300, 34, 300], direction: [1, 0, 0], harbour: 'Sentinel' }, hostile: false, opened: [] };
  const states = new Map();
  const status = (b) => {
    if (!states.has(b.uid)) states.set(b.uid, { hull: 100, maxHull: 200, sail: 50, maxSail: 100, crew: 10, maxCrew: 20, wrecked: false, fire: false, stores: storesIn(b.Cargo?.Items ?? []), inFight: false, wants: true, barrels: 0 });
    return { ...states.get(b.uid), stores: storesIn(b.Cargo?.Items ?? []) };
  };
  const naval = {
    fleetStatus: status, hostileNear: () => w.hostile, freeBerth: (hull) => { w.berthHull = hull; return w.berth; }, boatInPlay: () => null,
    repairAway: (b) => { const st = states.get(b.uid); st.hull = st.maxHull; st.wants = false; return { ok: true, text: 'Mended.' }; },
    refitBoat: (b) => { w.refitted = b; }, openYard: (b) => { w.opened.push(b); return true; }, giveOrder: () => ({ ok: true, said: 'Aye.' }),
  };
  const host = createFleetHost({
    csa: () => s.rt, naval: () => naval, pack: () => s.pack, gold: () => w.gold, pay: (n) => { w.gold -= n; w.paid.push(n); }, accounts: () => w.accounts,
    regionName: (i) => ['Alik\'r', 'Anticlere'][i] ?? `Region ${i}`, where: () => ({ inside: w.inside, pixel: w.pixel, feet: w.feet }),
    nearPort: () => w.nearPort, nearestPort: () => ({ name: 'Daggerfall', way: 'north' }), terrainAt: () => s.terrains[0], changed: () => {},
  });
  return { s, w, host, states };
}

test('FLEET where she is, off the world each time: sailing, here (shown), away (another pixel, how far and which way), packed (her parts in the pack), laid up (her title and nothing standing) - and a ship with none of these drawn as no row', () => {
  const { s, host } = fleetWorld();
  titleDeed(mintDeed(2, 0, 1, 1)); titleDeed(mintDeed(3, 0, 2, 1)); titleDeed(mintDeed(4, 0, 3, 1)); knowShip(4, 1, 0, 1);
  const here = s.rt.SummonBoat(1, titleOf(1), fleetBook(), [100, 34, 220], DIR, s.terrains[0]);
  const away = s.rt.SummonBoat(2, titleOf(2), fleetBook(), [1000, 34, 200], DIR, s.terrains[1]);
  away.MapPixel = { X: 13, Y: 16 }; away.GameObject.activeSelf = false;
  const m = host.model();
  const by = Object.fromEntries(m.ships.map((r) => [r.uid, r]));
  assert.equal(by[1].where, 'here');
  assert.equal(by[1].metres, 30);
  assert.deepEqual([by[2].where, by[2].metres, by[2].way], ['away', Math.round(5 * 819.2), 'north-east']);
  assert.equal(by[3].where, 'laidup');
  assert.equal(by[4], undefined, 'no title, nothing standing, no parts: lost, no row');
  assert.deepEqual(m.ships.map((r) => r.where), ['here', 'laidup', 'away'], 'the ones at hand first');
  s.rt.StartSailing(here);
  assert.equal(host.model().ships[0].where, 'sailing');
  s.pack.push(Object.assign(mintBoatItem(BOAT_PARTS_TEMPLATE, 4), { message: 10 }));
  assert.equal(host.model().ships.find((r) => r.uid === 4).where, 'packed');
  assert.deepEqual([compassWay(1, 0), compassWay(0, -1), compassWay(-1, 1), compassWay(0, 0)], ['east', 'north', 'south-west', null]);
  assert.deepEqual(CREWED_HULLS, [2, 3, 4]);
  assert.deepEqual([0, 1, 2, 3, 4].map(hasGuns), [false, true, true, true, true]);
});

test('FLEET the model sweeps the pack: a deed found there (an older save\'s, the console\'s) is entered in the book; a boat standing with a number and parts in the pack are known to the ledger', () => {
  const { s, host } = fleetWorld();
  s.pack.push(mintDeed(2, 0, 50, 100000), Object.assign(mintBoatItem(BOAT_PARTS_TEMPLATE, 51), { message: 0, value: 4000 }));
  s.place(1).uid = 52;
  host.model();
  assert.deepEqual(s.pack.map((i) => i.templateIndex), [BOAT_PARTS_TEMPLATE], 'the deed out of the pack');
  assert.ok(titleOf(50));
  assert.deepEqual([fleetShip(51)?.hull, fleetShip(52)?.hull], [0, 1]);
});

test('FLEET Summon: brought round to the port\'s free berth (SummonBoat at it) - a laid-up ship and one afloat elsewhere; with no berth known, the deed\'s own placing (a door: the water clicked, the book her collection); refused here already, packed, indoors, at a helm, fighting, and away from any port', () => {
  const { s, w, host } = fleetWorld();
  titleDeed(mintDeed(2, 0, 1, 1));
  let r = host.act(1, 'summon');
  assert.deepEqual(r, { ok: true, text: "Small Ship 'I' is brought round to Sentinel's quay and made fast." });   // PIN MOVED (QUAYS)
  assert.equal(w.berthHull, 2, 'the berth asked for her own hull - alongside its quay');
  const b = s.rt.GetPlacedBoatWithUID(1);
  assert.deepEqual([b.GameObject.position[0], b.GameObject.position[2]], [300, 300]);
  assert.equal(host.act(1, 'summon').text, 'She is already here.');
  b.GameObject.activeSelf = false; b.MapPixel = { X: 15, Y: 20 };
  w.nearPort = false;
  assert.equal(host.act(1, 'summon').text, 'Your ships are brought round to a port - go to one.');
  w.nearPort = true; w.hostile = true;
  assert.equal(host.act(1, 'summon').text, 'Not while she is fighting.');
  w.hostile = false; w.inside = true;
  assert.equal(host.act(1, 'summon').text, 'Call her from outdoors.');
  w.inside = false;
  w.berth = null;
  r = host.act(1, 'summon');
  assert.equal(r.ok, true);
  assert.match(r.text, /click the water/);
  assert.equal(typeof r.door, 'function');
  r.door();
  assert.equal(s.rt.placing, true, 'the placing click, armed');
});

test('FLEET Send away: she sails for the nearest port and is laid up there (LayUpBoat; her title made again for a small boat); refused at her helm, fighting, for a small boat not here, with another player aboard', () => {
  const { s, w, host } = fleetWorld();
  titleDeed(mintDeed(2, 0, 1, 1));
  host.act(1, 'summon');
  const r = host.act(1, 'away');
  assert.deepEqual(r, { ok: true, text: "Small Ship 'I' sails for Daggerfall, and is laid up there." });
  assert.equal(s.rt.GetPlacedBoatWithUID(1), null);
  assert.deepEqual(fleetShip(1).port, { name: 'Daggerfall' });
  assert.equal(host.model().ships[0].where, 'laidup');
  // a small boat, away: refused; here: laid up, her title made again
  titleDeed(mintDeed(1, 0, 2, 1));
  host.act(2, 'summon');
  assert.equal(titleOf(2), null, 'spent on placing');
  const boat = s.rt.GetPlacedBoatWithUID(2);
  boat.GameObject.activeSelf = false;
  assert.equal(host.act(2, 'away').text, 'She has no crew to sail her to a port - go to her.');
  boat.GameObject.activeSelf = true;
  assert.equal(host.act(2, 'away').ok, true);
  assert.ok(titleOf(2), 'the book stands for her laid up');
  // AUDIT HOLDINGS T2: the refusals the title names, said (another player aboard: auditholdings.test.js D2)
  host.act(1, 'summon');
  const one = s.rt.GetPlacedBoatWithUID(1);
  w.hostile = true;
  assert.equal(host.act(1, 'away').text, 'Not while she is fighting.');
  w.hostile = false;
  s.rt.StartSailing(one);
  assert.equal(host.act(1, 'away').text, 'Not while you are at her helm.');
});

test('FLEET Repair: her hands wherever she lies (the sea fight\'s repairAway); refused for a boat with no crew; Shipwright: a door to the yard\'s window at a port, for a ship laid up (her stand-in: her number, her laid-up hold) or lying here', () => {
  const { s, w, host } = fleetWorld();
  titleDeed(mintDeed(2, 0, 1, 1));
  assert.deepEqual(host.act(1, 'repair'), { ok: true, text: 'Mended.' });
  assert.equal(host.act(1, 'repair').text, 'She needs no repairs.');
  titleDeed(mintDeed(1, 0, 2, 1));
  assert.equal(host.act(2, 'repair').text, 'She has no crew to make her repairs.');
  const r = host.act(1, 'yard');
  assert.equal(typeof r.door, 'function');
  r.door();
  assert.deepEqual([w.opened[0].uid, w.opened[0].laidUp, w.opened[0].crewed], [1, true, true]);
  assert.equal(w.opened[0].Cargo.Items, s.rt.laidUpHold(1), 'her laid-up hold, live');
  w.nearPort = false;
  assert.equal(host.act(1, 'yard').text, 'A shipwright works at a port.');
});

test('FLEET Refit: at a port, her loan paid; the shipwright\'s gold from the purse and her materials from the pack and her hold, all or none; her tier added, her state built on her new whole; refused past the last tier, short of gold or of a material (mutants: the loan, the port, the payment)', () => {
  const { s, w, host } = fleetWorld({ gold: 5000 });
  claimedShip({ uid: 1, hull: 2, value: 1, credit: { region: 1, due: 99 } });
  w.accounts[1] = { loanTotal: 1234, loanDueDate: 99 };
  assert.equal(host.act(1, 'refit', 'hull').text, "She was bought on the bank's credit: pay Anticlere's 1234 gold first.");
  assert.equal(host.offer(1).why, "She was bought on the bank's credit: pay Anticlere's 1234 gold first.");
  w.accounts[1].loanTotal = 0;
  w.nearPort = false;
  assert.equal(host.act(1, 'refit', 'hull').text, 'Ships are refitted at a port.');
  w.nearPort = true;
  assert.equal(host.act(1, 'refit', 'hull').text, 'The shipwright needs 3 Timber (you have 0).');
  s.pack.push(item(1604, 2), item(14, 3), item(71, 5));
  s.rt.laidUpHold(1).push(item(645));
  const o = host.offer(1);
  assert.deepEqual(o.rows.map((r) => r.id), ['hold', 'rigging', 'hull', 'guns']);
  const hull = o.rows.find((r) => r.id === 'hull');
  assert.deepEqual(hull.next.mats.map((m) => [m.kind, m.n, m.have]), [['timber', 3, 3], ['pitch', 3, 3], ['iron', 3, 5]]);
  assert.equal(hull.afford, true);
  const r = host.act(1, 'refit', 'hull');
  assert.deepEqual(r, { ok: true, text: "Small Ship 'I''s hull is refitted (I)." });
  assert.equal(fleetShip(1).upgrades.hull, 1);
  assert.deepEqual(w.paid, [600]);
  assert.equal(materialCount([s.pack, s.rt.laidUpHold(1)], 'iron'), 2);
  assert.equal(materialCount([s.pack, s.rt.laidUpHold(1)], 'timber'), 0, 'the hold\'s plank too');
  assert.equal(w.refitted?.uid, 1, 'her state built again on her new whole');
  w.gold = 10;
  assert.equal(host.act(1, 'refit', 'hull').text, 'The shipwright asks 1500 gold.');
  addRefit(1, 'hull'); addRefit(1, 'hull');
  w.gold = 1e9;
  assert.equal(host.act(1, 'refit', 'hull').text, 'She has every refit of that kind.');
  titleDeed(mintDeed(0, 0, 9, 1));
  assert.deepEqual(host.offer(9).rows.map((r) => r.id), ['hold', 'rigging', 'hull'], 'a Rowboat carries no guns to refit');
});

test('FLEET Rename: the ledger\'s law, said on her card; refused names say why', () => {
  const { host } = fleetWorld();
  titleDeed(mintDeed(2, 0, 1, 1));
  assert.deepEqual(host.act(1, 'rename', 'Gull'), { ok: true, text: 'She is the Gull now.' });
  assert.equal(host.model().ships[0].label, 'Gull');
  assert.equal(host.act(1, 'rename', 'Admin').ok, false);
  assert.deepEqual(host.act(1, 'rename', ''), { ok: true, text: "She is called by her hull again: Small Ship 'I'." });
  assert.equal(host.nameOf({ uid: 1 }), '');
});

// ── the page ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true, value: '', type: '', maxLength: 0, placeholder: '',
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const buttons = (root, label) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; };
const byTag = (root, tag) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === tag) out.push(c); walk(c); } }; walk(root); return out; };

test('FLEET the page: a card a ship - her name, hull, worth, the bank\'s claim, where she is, her hull, canvas and crew, her stores, her refits; the acts each where it can be pressed (a refused one says why on its title and under her card when pressed); a door handed to the menu; the refit panel and the name field in place', () => {
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  const { s, w, host } = fleetWorld();
  claimedShip({ uid: 1, hull: 2, value: 100000, credit: { region: 0, due: 7 } });
  w.accounts[0] = { loanTotal: 5000, loanDueDate: 7 };
  s.pack.push(mintStores(2));
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  assert.equal(fleetPageShown(), true);
  assert.deepEqual(FLEET_PAGE_SECTIONS, [['fleet', 'Fleet']]);
  resetFleetPage();
  const doors = [];
  const draw = () => { const d = el('div', 'px-qdetail'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: (a, b) => el('div', null, `${a}/${b}`), door: (fn) => doors.push(fn) }); return d; };
  let d = draw();
  assert.match(d.textContent, /Fleet \(1\)/);
  assert.match(d.textContent, /Small Ship 'I'Laid up/);
  assert.match(d.textContent, /worth 100,000 gold · the bank is owed 5,000 gold/);
  assert.match(d.textContent, /100\/200/);
  assert.match(d.textContent, /50\/100/);
  assert.match(d.textContent, /10\/20/);
  assert.match(d.textContent, /0 carpenter's stores aboard/);
  assert.deepEqual(['Summon', 'Repair', 'Shipwright', 'Refit', 'Rename', 'Send away'].map((l) => buttons(d, l).length), [1, 1, 1, 1, 1, 0]);
  buttons(d, 'Shipwright')[0].onclick();
  assert.equal(doors.length, 1, 'the yard\'s door handed to the menu');
  buttons(d, 'Refit')[0].onclick();
  d = draw();
  assert.match(d.textContent, /pay Alik'r's 5000 gold first/);
  assert.match(d.textContent, /You hold 0 Timber, 0 Iron, 0 Pitch \(your pack and her hold\), and 100,000 gold\./);
  assert.match(d.textContent, /Hull0 of 3Her hull and canvas: \+10% a refit\.Next: 600 gold, 3 Timber, 3 Pitch, 3 Iron\./);
  assert.equal((d.textContent.match(/Timber: Wood Bundles - a Wood-Axe gathers them - or planks and logs\./g) ?? []).length, 1, 'each short material\'s hint once');
  assert.equal(buttons(d, 'Refit').every((b) => b.attrs['aria-disabled'] === 'true'), true, 'every refit refused while the loan stands');
  buttons(d, 'Summon')[0].onclick();
  d = draw();
  assert.match(d.textContent, /brought round to Sentinel's quay/);
  assert.match(d.textContent, /Small Ship 'I'Afloat.*Lying 228 m away\./);
  buttons(d, 'Rename')[0].onclick();
  d = draw();
  const f = byTag(d, 'input')[0];
  assert.equal(f.maxLength, 24);
  f.value = 'Tern'; f.oninput();
  buttons(d, 'Name her')[0].onclick();
  d = draw();
  assert.match(d.textContent, /She is the Tern now\./);
  assert.match(d.textContent, /TernAfloat/);
  setHoldingsProvider(null);
  assert.equal(fleetPageShown(), false);
  // the words
  assert.equal(whereWords({ where: 'away', metres: 4096, way: 'north' }).line, 'Afloat 4.1 km away to the north.');
  assert.equal(refitLine({ hold: 2, rigging: 0, hull: 1, guns: 0 }), 'Hold II · Hull I');
  assert.equal(refitLine({}), null);
});

// ── the purchase and the prize ───────────────────────────────────────────────────────────────────────────────────────

test('FLEET a deed bought goes to the book at the counter, never the pack - stamped with the port she waits at (never a claim: SHIP-CREDIT WITHDRAWN); a prize\'s title to the book (the world host\'s packDeed), and its words say so', () => {
  const modes = read('src/scenes/worldModes.js');
  const at = modes.indexOf('// HOLDINGS (bible/03-World/Holdings.md): a ship\'s deed bought goes to the Fleet\'s book');
  assert.ok(at > modes.indexOf('if (!isFurnishing(it)) addItem(playerEntity.items, it);'), 'after the goods are in the pack');
  assert.match(modes, /const town = buildingDirectory\?\.\(\)\?\.locationName \?\? '';/);
  assert.match(modes, /\.map\(\(it\) => titleDeed\(it, \{ from: playerEntity\.items, port: town \? \{ name: town \} : null \}\)\)/);
  const world = read('src/scenes/world.js');
  assert.match(world, /packDeed: \(item\) => \{ titleDeed\(item, \{ port: null \}\); return \(\) => fleetBook\(\); \},/);
  // PIN MOVED (AUDIT HOLDINGS Q8): placed anew, her port of before cleared - the docking says hers again
  assert.match(world, /titles: \(\) => fleetBook\(\), retitle: \(boat, parts\) => \{ knowShip\(boat\.uid, boat\.hull, boat\.variant, parts\?\.value\); setShipPort\(boat\.uid, null\); return !!retitle\(boat\.uid\); \} \},/);
  // AUDIT HOLDINGS F8: a failed claim's record forgotten (F5's parts bought on the bank's credit went with SHIP-CREDIT)
  assert.doesNotMatch(modes, /creditShip/);
  assert.match(world, /forgetDeed: \(item\) => forgetShip\(item\?\.UID\),/);
  assert.match(world, /registerModSaveData\(FLEET_SAVE_VENDOR, fleetSaveSlot\);/);
  assert.ok(world.indexOf('let fleetHost = null;') < world.indexOf('const csaRuntime = csaOn() ? createComeSailAwayRuntime({'), 'declared before the boats read their refits through it');
  // the prize's words
  const host = read('src/scenes/navalHost.js');
  assert.match(host, /her title is in your Fleet ledger \(Holdings\)/);
  void HULL_PRICES;
});
