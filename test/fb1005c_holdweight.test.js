// HOLD-WEIGHT (FIELD BUGS 2026-10-05c, bible/01-Overview/Field-Bugs-2026-10-05c.md; the report: "Impossibly heavy boats
// can never be retrieved from storage" - "Parts of Small Ship 'I'" at 450 kg in a chest, the bearer's most 304).
// PackBoat lays her hold's weight on her parts (SHIP-PACK keeps it, as the mod's own did) and a hold has no ceiling but
// her speed: a ship packed off a plundered hold was ONE item heavier than the bearer could ever carry, AddItem took it
// unasked, and once it was set down every take of it (CanCarryAmount, systems/itemTransfer.js planTake) refused it for
// good. Parts no take could ever lift are not made now (systems/comeSailAway.js partsTooHeavy) - the pick-up says why,
// the boat menu says why, a fast travel and a landfall leave her where she lies, her hold aboard; a lost boat is packed
// whatever she weighs. Come Sail Away's real runtime over test/csaScene.mjs, the world host's seams as world.js gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, terrain } from './csaScene.mjs';
import { TRIGGER_MODEL, HULL_PRICES, PACKED_WEIGHT_MAX } from '../src/systems/comeSailAwayBoat.js';
import { HOLD_TOO_HEAVY_TEXT } from '../src/systems/comeSailAway.js';
import { mintDeed, BOAT_PARTS_TEMPLATE, mintBoatItem } from '../src/systems/comeSailAwayItems.js';
import { boatMenuRows, boatMenuRefusal, BOAT_MENU_TEXT, BOAT_MENU_WHY } from '../src/systems/csaBoatMenu.js';
import { canHoldAmount } from '../src/systems/inventory.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const AT = [1000, 34, 50], DIR = [0, 0, 1];
/** The report's bearer: 304 kg at most, 74.71 carried. */
const MOST = 304, CARRIED = 74.71;

function withPack(opts = {}) {
  const s = scene({ terrains: [terrain(10, 20), terrain(11, 20)], ...opts });
  const pack = [];
  let uid = 7000;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack };
  s.deps.cargoWeight = (items) => items.reduce((a, it) => a + (it.weightInKg ?? 0), 0);
  s.deps.entity.maxEncumbrance = () => MOST;
  s.deps.entity.carriedWeight = () => CARRIED;
  return Object.assign(s, { pack });
}
function shipFromDeed(s, uid) {
  const deed = mintDeed(2, 0, uid, HULL_PRICES[2]);
  s.pack.push(deed);
  const b = s.rt.LaunchFromDeed(deed, () => s.pack, AT, DIR, s.terrains[1]);
  assert.ok(b && b.crewed);
  return { b, deed };
}
const steal = (s, b) => s.rt.activate(TRIGGER_MODEL.drive, { root: b.GameObject, node: b.DriveTrigger, distance: 1 }, 'steal');
/** Whether a take of these parts out of a chest could ever pass - planTake's own arithmetic over an empty pack. */
const everTaken = (parts) => canHoldAmount(1, parts.weightInKg, MOST, 0) > 0;

test('HOLD-WEIGHT the report: a Small Ship over a 330 kg hold is not packed into 450 kg parts - the pick-up says why, she lies where she is, her hold and her deed untouched; lightened, she packs, and her parts are ones a take can lift (mutants: the gate unread, the hold unweighed, the refusal unsaid)', () => {
  const s = withPack();
  const { b, deed } = shipFromDeed(s, 680);
  b.Cargo.Items.push({ name: 'plunder', weightInKg: 330 });
  assert.equal(s.rt.partsTooHeavy(b), true);
  steal(s, b);
  assert.deepEqual(s.out.mid.at(-1), [HOLD_TOO_HEAVY_TEXT, 1.5], 'the pick-up says why');
  assert.equal(s.rt.PackBoat(b, true), false, 'every caller refused');
  assert.ok(s.rt.AllBoats.includes(b), 'she lies where she is');
  assert.ok(!s.pack.some((it) => it.templateIndex === BOAT_PARTS_TEMPLATE), 'no parts made');
  assert.ok(s.pack.includes(deed), 'her deed kept');
  assert.deepEqual(b.Cargo.Items.map((it) => it.name), ['plunder'], 'her hold aboard');
  b.Cargo.Items.splice(0, 1, { name: 'plunder', weightInKg: 150 });
  assert.equal(s.rt.partsTooHeavy(b), false);
  steal(s, b);
  const parts = s.pack.at(-1);
  assert.equal(parts.templateIndex, BOAT_PARTS_TEMPLATE);
  assert.equal(parts.weightInKg, Math.fround(PACKED_WEIGHT_MAX + 150), 'her hold\'s weight still rides her parts (SHIP-PACK)');
  assert.ok(everTaken(parts), 'a take can lift them from a chest');
});

test('HOLD-WEIGHT the edge is the take\'s own: parts weighing exactly the bearer\'s most pack, a step over does not; a full pack still packs her (the mod\'s AddItem), and a host that reads no MaxEncumbrance packs as the mod packs (mutants: the edge, the load counted)', () => {
  const s = withPack();
  const { b } = shipFromDeed(s, 681);
  b.Cargo.Items.push({ name: 'stone', weightInKg: MOST - PACKED_WEIGHT_MAX });
  assert.equal(s.rt.partsTooHeavy(b), false, 'exactly her most');
  b.Cargo.Items.push({ name: 'pebble', weightInKg: 0.25 });
  assert.equal(s.rt.partsTooHeavy(b), true, 'a step over');
  b.Cargo.Items.pop();
  s.deps.entity.carriedWeight = () => MOST;
  assert.equal(s.rt.partsTooHeavy(b), false, 'what is carried now is not asked');
  delete s.deps.entity.maxEncumbrance;
  b.Cargo.Items.push({ name: 'anchor', weightInKg: 5000 });
  assert.equal(s.rt.partsTooHeavy(b), false, 'no law read without the seam');
});

test('HOLD-WEIGHT a fast travel from her helm leaves her where she lies when her parts would outweigh the bearer; a lost boat is packed whatever she weighs (recoverLostBoats - left, no one could reach her) (mutants: the travel packs her, the lost boat left)', () => {
  const s = withPack();
  const { b } = shipFromDeed(s, 682);
  b.Cargo.Items.push({ name: 'plunder', weightInKg: 400 });
  s.helm(b);
  s.rt.OnPreFastTravel();
  assert.equal(s.rt.isSailing(), false);
  assert.ok(s.rt.AllBoats.includes(b), 'left where she lies');
  assert.ok(!s.pack.some((it) => it.templateIndex === BOAT_PARTS_TEMPLATE));
  // a Large Boat (no deed kept) restored under the ground (test/fb0929h_lostboat.test.js's report; csaScene's ground
  // stands at 20 m): lost, and packed though her hold is heavy
  const t = withPack();
  const save = { UID: 41, Hull: 1, Variant: 0, MapPixel: { X: 10, Y: 20 }, Position: { x: 300, y: -40, z: 400 }, Direction: { x: 0, y: 0, z: 1 }, Items: [{ name: 'plunder', weightInKg: 400 }], lights: false, inside: false };
  t.rt.restoreSaveData({ ...t.rt.newSaveData(), placedBoats: [save] });
  const [lost] = t.rt.AllBoats;
  assert.ok(lost && !lost.crewed && lost.Cargo.Items.length === 1);
  assert.equal(t.rt.partsTooHeavy(lost), true);
  t.rt.update();
  assert.ok(!t.rt.AllBoats.includes(lost), 'packed');
  assert.equal(t.pack.at(-1).templateIndex, BOAT_PARTS_TEMPLATE);
});

test('HOLD-WEIGHT the boat menu and the world: "Pick up" refused with her hold\'s reason, the runtime\'s own words on a press; the world hands the runtime PlayerEntity.MaxEncumbrance, tells the menu, and a landfall packs her only when her parts can be carried (mutants: the menu\'s word, the seam, the landfall unguarded)', () => {
  const rows = boatMenuRows({ boxes: new Set(['drive']), packable: true, tooHeavy: true });
  assert.deepEqual(rows.map((r) => (r.disabled ? `${r.label} (${r.why})` : r.label)), [BOAT_MENU_TEXT.helm, `${BOAT_MENU_TEXT.pack} (${BOAT_MENU_WHY.tooHeavy})`]);
  assert.equal(boatMenuRows({ boxes: new Set(['drive']), packable: true, tooHeavy: true, noDeed: true }).at(-1).why, BOAT_MENU_WHY.noDeed, 'her deed asked first, as PackBoat asks it');
  assert.equal(boatMenuRefusal(BOAT_MENU_WHY.tooHeavy), HOLD_TOO_HEAVY_TEXT);
  assert.match(WORLD, /maxEncumbrance: \(\) => entityMaxEncumbrance\(playerEntity\),/);
  assert.match(WORLD, /tooHeavy: !!csaRuntime\?\.partsTooHeavy\?\.\(boat\),/);
  assert.match(WORLD, /!csaRuntime\.deedMissing\(boat\) && !csaRuntime\.partsTooHeavy\(boat\)\) csaCall\(\(\) => csaRuntime\.PackBoat\(boat, true\)\);/);
});
