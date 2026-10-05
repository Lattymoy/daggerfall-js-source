// SHIP-PACK (2026-10-01, the review before the merge: "Allow larger ships to be picked up, just like smaller vessels")
// - EVERY HULL PACKS, AND HER PARTS ARE HER (systems/comeSailAway.js PackBoat, takePlaceItem; systems/comeSailAwayBoat.js
// packedHullWeight; systems/csaBoatMenu.js; bible/03-World/Come-Sail-Away.md SHIP-PACK). The Small Ship, the Large Galley
// and the Carrack are picked up as the Rowboat and the Large Boat are: a deed ship with her deed in the pack, which goes
// with her into her parts; placed again, her parts are spent and her deed is given back in their place. Her parts keep
// her number (her naval state, her crew and her hands ashore are found by it), her worth (what placed her - a claimed
// prize's papers, never the shelf's price) and a weight a bearer can carry. Come Sail Away's real runtime over
// test/csaScene.mjs, the world host's item seams given as scenes/world.js gives them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, terrain } from './csaScene.mjs';
import { TRIGGER_MODEL, HULL_PRICES, HULL_WEIGHTS, PACKED_WEIGHT_MAX, packedHullWeight } from '../src/systems/comeSailAwayBoat.js';
import { DEED_NOT_HELD_TEXT, PASSENGERS_ABOARD_TEXT } from '../src/systems/comeSailAway.js';
import { mintDeed, mintBoatItem, BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE } from '../src/systems/comeSailAwayItems.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const AT = [1000, 34, 50], DIR = [0, 0, 1];

/** The runtime of test/csaScene.mjs with the world host's item seams: the mint (the host's UIDs from 7001), the pack the
 *  parts go to the back of, and the pack itself - a ship's deed is found in it and taken from it. */
function withPack(opts = {}) {
  const s = scene({ terrains: [terrain(10, 20), terrain(11, 20)], ...opts });
  const pack = [];
  let uid = 7000;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack };
  s.deps.cargoWeight = (items) => items.reduce((a, it) => a + (it.weightInKg ?? 0), 0);
  return Object.assign(s, { pack });
}
/** A ship stood from her deed, as a bought one is (the deed kept - she is crewed). */
function shipFromDeed(s, hull = 4, uid = 600, value = HULL_PRICES[hull]) {
  const deed = mintDeed(hull, 0, uid, value);
  s.pack.push(deed);
  const b = s.rt.LaunchFromDeed(deed, () => s.pack, AT, DIR, s.terrains[1]);
  assert.ok(b && b.crewed, 'a ship, crewed');
  assert.ok(s.pack.includes(deed), 'her deed kept, as the mod keeps a crewed hull\'s');
  return { b, deed };
}
const steal = (s, b) => s.rt.activate(TRIGGER_MODEL.drive, { root: b.GameObject, node: b.DriveTrigger, distance: 1 }, 'steal');

test('SHIP-PACK every hull packs - the three ships beside the Rowboat and the Large Boat; only the ships are crewed; packed, a hull weighs the table\'s weight but never more than the Large Boat\'s parts (the ships\' 2,400 to 240,000 kg were never an item\'s) (mutants: a ship left unpackable, the cap lifted, the cap a ship\'s)', () => {
  const s = withPack();
  const hulls = [0, 1, 2, 3, 4].map((h) => s.place(h, 0));
  assert.deepEqual(hulls.map((b) => b.packable), [true, true, true, true, true]);
  assert.deepEqual(hulls.map((b) => b.crewed), [false, false, true, true, true]);
  assert.equal(PACKED_WEIGHT_MAX, HULL_WEIGHTS[1]);
  assert.deepEqual([0, 1, 2, 3, 4].map(packedHullWeight), [30, 120, 120, 120, 120]);
});

test('SHIP-PACK a ship picked up goes with her deed: Steal mode at her helm packs her - her deed out of the pack, her parts in it with HER number, her deed\'s worth, a carried weight, her hull in their message and name; she is off the list and out of the water (mutants: the deed kept, a new number, the shelf\'s price, the table\'s weight)', () => {
  const s = withPack();
  const { b, deed } = shipFromDeed(s, 4, 600, 37500);   // a claimed Carrack's papers - never the shelf's 150,000
  s.pack.unshift({ name: 'rope', templateIndex: 50, UID: 1 });
  steal(s, b);
  assert.deepEqual(s.out.hud.at(-1), 'You store the boat in your inventory');
  assert.ok(!s.pack.includes(deed), 'her deed goes with her');
  const parts = s.pack.at(-1);
  assert.deepEqual({ t: parts.templateIndex, UID: parts.UID, value: parts.value, kg: parts.weightInKg, message: parts.message, name: parts.name },
    { t: BOAT_PARTS_TEMPLATE, UID: 600, value: 37500, kg: PACKED_WEIGHT_MAX, message: 40, name: "Parts of Carrack 'I'" });
  assert.deepEqual(s.pack.map((it) => it.templateIndex), [50, BOAT_PARTS_TEMPLATE], 'the rope kept, her parts at the back');
  assert.ok(!s.rt.AllBoats.includes(b) && s.rt.GetPlacedBoatWithUID(600) === null, 'gone from the water');
});

test('SHIP-PACK without her deed in the pack a ship is not picked up - the press says why and nothing moves; PackBoat itself refuses (false) for every caller; the mod\'s own refusals come first; a ship no item placed (number 0) and every small boat pack with no deed (mutants: the deed unasked, the refusal unsaid, PackBoat unguarded, a small boat asked for a deed)', () => {
  const s = withPack();
  const { b, deed } = shipFromDeed(s, 2, 610, 100000);
  s.pack.splice(s.pack.indexOf(deed), 1);
  assert.equal(s.rt.deedMissing(b), true);
  steal(s, b);
  assert.deepEqual(s.out.mid.at(-1), [DEED_NOT_HELD_TEXT, 1.5]);
  assert.equal(s.rt.PackBoat(b, true), false, 'refused for every caller');
  assert.ok(s.rt.AllBoats.includes(b), 'she stays where she lies');
  assert.deepEqual(s.pack, [], 'nothing packed');
  // the mod's own refusals first
  s.deps.passengersAboard = () => 1;
  steal(s, b);
  assert.deepEqual(s.out.mid.at(-1), [PASSENGERS_ABOARD_TEXT, 1.5]);
  s.deps.passengersAboard = () => 0;
  // the deed back in the pack: she packs
  s.pack.push(deed);
  assert.equal(s.rt.deedMissing(b), false);
  assert.equal(s.rt.PackBoat(b, true), true);
  assert.equal(s.pack.at(-1).UID, 610);
  // a ship no item placed has no deed to want: her parts take a fresh number, at her hull's price
  const bare = s.place(3, 0);
  assert.equal(bare.uid, 0);
  assert.equal(s.rt.deedMissing(bare), false);
  assert.equal(s.rt.PackBoat(bare, true), true);
  assert.deepEqual([s.pack.at(-1).value, s.pack.at(-1).UID > 7000], [HULL_PRICES[3], true]);
  // a small boat placed by a deed (spent) is never asked for one
  const small = mintDeed(1, 2, 620, 8000);
  s.pack.push(small);
  const lb = s.rt.LaunchFromDeed(small, () => s.pack, AT, DIR, s.terrains[0]);
  assert.equal(s.rt.deedMissing(lb), false);
  steal(s, lb);
  assert.equal(s.pack.at(-1).UID, 620, 'packed, her number kept');
});

test('SHIP-PACK placed again, a ship\'s parts are spent and her deed is given back where they lay - her number, their worth, her hull; the deed answers her (GetPlacedBoatWithUID) and packs her again, round and round; a small boat\'s parts are only spent, as ever (mutants: the parts kept, no deed back, the deed at the back, another number, the shelf\'s price)', () => {
  const s = withPack();
  const parts = Object.assign(mintBoatItem(BOAT_PARTS_TEMPLATE, 630), { message: 30, value: 50000, name: "Parts of Large Galley 'I'", weightInKg: 120 });
  s.pack.push({ name: 'potion', templateIndex: 60, UID: 1 }, parts, { name: 'rope', templateIndex: 50, UID: 2 });
  const b = s.rt.LaunchFromParts(parts, () => s.pack, AT, DIR, s.terrains[1]);
  assert.deepEqual([b.hull, b.uid, b.crewed, b.itemValue], [3, 630, true, 50000]);
  assert.deepEqual(s.pack.map((it) => it.templateIndex), [60, BOAT_DEED_TEMPLATE, 50], 'her deed where her parts lay');
  const deed = s.pack[1];
  assert.deepEqual({ UID: deed.UID, value: deed.value, message: deed.message, name: deed.name }, { UID: 630, value: 50000, message: 30, name: "Deed to Large Galley 'I'" });
  assert.ok(s.rt.GetPlacedBoatWithUID(630) === b, 'her deed answers her');
  // round and round: packed, placed, packed
  for (let i = 0; i < 2; i++) {
    const [ship] = s.rt.AllBoats.filter((x) => x.uid === 630);
    assert.equal(s.rt.PackBoat(ship, true), true);
    const p = s.pack.at(-1);
    assert.deepEqual([p.templateIndex, p.UID, p.value, s.pack.filter((it) => it.templateIndex === BOAT_DEED_TEMPLATE).length], [BOAT_PARTS_TEMPLATE, 630, 50000, 0]);
    s.rt.LaunchFromParts(p, () => s.pack, AT, DIR, s.terrains[1]);
    assert.deepEqual(s.pack.filter((it) => it.UID === 630).map((it) => it.templateIndex), [BOAT_DEED_TEMPLATE], 'one item for her at a time');
  }
  // a small boat's parts are only spent
  const oars = Object.assign(mintBoatItem(BOAT_PARTS_TEMPLATE, 640), { message: 0, value: 4000 });
  s.pack.push(oars);
  s.rt.LaunchFromParts(oars, () => s.pack, AT, DIR, s.terrains[0]);
  assert.ok(!s.pack.some((it) => it.UID === 640), 'spent, no deed');
});

test('SHIP-PACK her hold goes with her and comes back: packed under her number, aboard again when she stands; the spent entry it leaves is hers to fill at the next pick-up; one still holding goods under her number throws before her hold moves (Dictionary.Add) (mutants: the spent entry refused, the throw after the hold moved)', () => {
  const s = withPack();
  const { b } = shipFromDeed(s, 2, 650, 100000);
  b.Cargo.Items.push({ name: 'rope', weightInKg: 2 }, { name: 'net', weightInKg: 1.5 });
  assert.equal(s.rt.PackBoat(b, true), true);
  const parts = s.pack.at(-1);
  assert.equal(parts.weightInKg, Math.fround(PACKED_WEIGHT_MAX + 3.5), 'her weight and her hold\'s');
  assert.deepEqual(s.rt.state.PackedCargoes.get('650').map((it) => it.name), ['rope', 'net']);
  const again = s.rt.LaunchFromParts(parts, () => s.pack, AT, DIR, s.terrains[1]);
  assert.deepEqual(again.Cargo.Items.map((it) => it.name), ['rope', 'net'], 'aboard again');
  assert.deepEqual(s.rt.state.PackedCargoes.get('650'), [], 'emptied and kept, as TransferAll leaves it');
  assert.equal(s.rt.PackBoat(again, true), true, 'her spent entry refilled, no throw');
  assert.deepEqual(s.rt.state.PackedCargoes.get('650').map((it) => it.name), ['rope', 'net']);
  // a key still holding goods
  const third = s.rt.LaunchFromParts(s.pack.at(-1), () => s.pack, AT, DIR, s.terrains[1]);
  s.rt.state.PackedCargoes.set('650', [{ name: 'stray' }]);
  assert.throws(() => s.rt.PackBoat(third, true), /same key/);
  assert.deepEqual(third.Cargo.Items.map((it) => it.name), ['rope', 'net'], 'her hold never moved');
  assert.ok(s.rt.AllBoats.includes(third));
});

test('SHIP-PACK her worth is what placed her: a boat stood from an item keeps its value (`itemValue`) and packs at it, never the shelf\'s price; a boat no item placed packs at her hull\'s price; the save keeps her worth (Value) and the load gives it back (mutants: the worth unkept, the shelf\'s price, the save, the load)', () => {
  const s = withPack();
  // a Large Boat placed by a deed worth a quarter (a claimed prize's papers): her deed is spent, her worth kept
  const papers = mintDeed(1, 0, 660, 2000);
  s.pack.push(papers);
  const lb = s.rt.LaunchFromDeed(papers, () => s.pack, AT, DIR, s.terrains[0]);
  assert.deepEqual([s.pack.length, lb.itemValue], [0, 2000]);
  const save = JSON.parse(JSON.stringify(s.rt.getSaveData()));
  assert.deepEqual(save.placedBoats.map((p) => [p.UID, p.Value]), [[660, 2000]], 'the save keeps it');
  const g = withPack();
  g.rt.restoreSaveData(save);
  const back = g.rt.GetPlacedBoatWithUID(660);
  assert.equal(back.itemValue, 2000, 'the load gives it back');
  assert.equal(g.rt.PackBoat(back, true), true);
  assert.equal(g.pack.at(-1).value, 2000, 'packed at her worth, not 8,000');
  // no item, no worth: the hull's price, and the save writes none
  const bare = s.place(1, 0);
  assert.equal(bare.itemValue, null);
  assert.ok(!('Value' in s.rt.getSaveData().placedBoats.at(-1)));
  s.rt.PackBoat(bare, true);
  assert.equal(s.pack.at(-1).value, HULL_PRICES[1]);
});

test('SHIP-PACK a fast travel packs the ship sailed when her deed is in the pack, as it packs a small boat; without it she stays where she lies, as a ship always did (mutants: the ship left, the deed unasked)', () => {
  const s = withPack();
  const { b } = shipFromDeed(s, 2, 670, 100000);
  s.helm(b);
  s.rt.OnPreFastTravel();
  assert.equal(s.rt.isSailing(), false);
  assert.ok(!s.rt.AllBoats.includes(b), 'packed');
  assert.deepEqual([s.pack.at(-1).templateIndex, s.pack.at(-1).UID], [BOAT_PARTS_TEMPLATE, 670]);
  const t = withPack();
  const { b: kept, deed } = shipFromDeed(t, 2, 671, 100000);
  t.pack.splice(t.pack.indexOf(deed), 1);
  t.helm(kept);
  t.rt.OnPreFastTravel();
  assert.ok(t.rt.AllBoats.includes(kept), 'left where she lies');
  assert.deepEqual(t.pack, []);
});

test('SHIP-PACK the world\'s seams: the pack handed to the runtime (where her deed is found); the boat menu told when her deed is not in the pack; a landfall packs a ship only with her deed, else she is left moored (mutants: the pack seam, the menu\'s word, the landfall unguarded)', () => {
  // PIN MOVED (HOLDINGS): the pack's seam, the Fleet's book's two after it (titles, retitle - test/fleet.test.js)
  assert.match(WORLD, /player: \(\) => \(playerEntity\.items \?\?= \[\]\),/);
  assert.match(WORLD, /noDeed: !!csaRuntime\?\.deedMissing\?\.\(boat\),/);
  // PIN MOVED (HOLD-WEIGHT, FIELD BUGS 2026-10-05c): the landfall asks her parts' weight after her deed (test/fb1005c_holdweight.test.js)
  assert.match(WORLD, /if \(tvSea\.means\?\.again && boat\.packable && csaPassengersOn\(boat\) === 0 && !csaRuntime\.deedMissing\(boat\) && !csaRuntime\.partsTooHeavy\(boat\)\) csaCall\(\(\) => csaRuntime\.PackBoat\(boat, true\)\);/);
});
