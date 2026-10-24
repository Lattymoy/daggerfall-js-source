// CSA-H (2026-09-27) - COME SAIL AWAY'S ITEMS, SHELVES, CARGO AND PORTS: systems/comeSailAway/comeSailAwayItems.js (the two
// template rows, the mint, the names, AssignVariantsToShopItems) and systems/comeSailAway/comeSailAway.js over the real SpawnBoat
// (IsNearPort's square, PackBoat and the packed cargo, the cargo box, the variant picker, giveboat, the two classes'
// UseItem), the shelf's custom loop (systems/shopStock.js through itemTemplates.js's one GetCustomItemsForGroup) and the
// host's seams. Every expectation is worked out here from ComeSailAway.cs, ItemBoatParts.cs, ItemBoatDeed.cs and DFU.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat, setBoatVariant, TRIGGER_MODEL, HULL_NAMES, HULL_PRICES, HULL_WEIGHTS } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, CONSOLE } from '../../src/systems/comeSailAway/comeSailAway.js';
import { CSA_ITEM_TEMPLATES, BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE, mintBoatItem, mintShelfBoatUids, boatItemName, assignVariantsToShopItems, cargoLootTarget } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { remoteTarget, remoteTargetType } from '../../src/systems/inventorySession.js';
import { CONTAINER_IMAGES } from '../../src/ui/targetIconPanel.js';
import { customItemsForGroup, registerCustomItemGroup, templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { DEEP_WATERS_FISH_TEMPLATES } from '../../src/systems/deepWater/deepWatersFishItems.js';
import { isStackable } from '../../src/systems/inventory.js';
import { setModSetting, latchModLoaded, modLatchedOn } from '../../src/systems/modSettings.js';
import { effectKindLoaded, WATER_WALKING_SILENT_KIND } from '../../src/systems/effects.js';

const DIR = new URL('../../vendor/come-sail-away/Models/', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const f = Math.fround;
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }), particleRandom: () => 0.5 });
const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

function terrain(x, y) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
}

/** A scripted scene - the port towns a set, the draws a queue, every host door recorded. */
function scene(opts = {}) {
  const out = { mid: [], hud: [], log: [], removed: [], pack: [], cargo: [], pickers: [], pops: 0, sounds: [], variants: [], closed: 0, portAsks: [], ranges: [] };
  const terrains = [terrain(10, 20)];
  const world = { inside: false, water: NO_WATER_LEVEL, pixel: { X: 10, Y: 20 }, ports: new Set(opts.ports ?? []) };
  const draws = [...(opts.draws ?? [])];
  let uid = 100;
  const settings = { 'Waves.Enable': false, ...opts.settings };
  const deps = {
    pool: {
      models: MODELS, ready: () => true,
      spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; },
      remove: (b) => out.removed.push(b),
      setVariant: (b, v) => { out.variants.push([b, v]); setBoatVariant(b, v, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); },
    },
    player: () => ({ position: [1, 2, 3], rotation: [0, 0, 0, 1] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ ...world.pixel }),
    isPlayerInside: () => world.inside,
    blockWaterLevel: () => world.water,
    iliacPuddleNoMore: () => false,
    raycast: () => null,
    playerTerrain: () => terrains[0], terrainAt: () => terrains[0], terrains: () => terrains,
    heightMapValue: () => 255,
    worldCompensation: () => [0, 0, 0],
    hudText: (t) => out.hud.push(t), midScreenText: (t, s) => out.mid.push([t, s]), log: (t) => out.log.push(t),
    random: { range: (min, max) => { out.ranges.push([min, max]); const v = draws.length ? draws.shift() : min; assert.ok(v >= min && v < max, `a draw in [${min}, ${max}): ${v}`); return v; }, rangeFloat: (min) => min },
    time: () => 0, hour: () => 12, weatherType: () => 0, dt: () => 0.25,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (i) => i, deserialize: (r) => r },
    setting: (k) => settings[k],
    input: { has: () => false, started: () => false, horizontal: () => 0, vertical: () => 0, toggleAutorun: false },
    helm: { setPlayerPosition: () => {}, setFacing: () => {}, turnPlayer: () => {}, freeze: () => {}, frozen: () => false, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false, isOnShip: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: (items) => items.reduce((a, i) => a + (i.weightInKg ?? 0) * (i.stackCount ?? 1), 0),
    sphereCastAll: () => [], enemies: () => [], messageBox: () => {},
    enemiesNearby: () => false, travelOptionsActive: () => null, timeScale: () => 1, setTimeScale: () => {}, soundVolume: () => 1,
    // CSA-H
    isPortTown: (x, y) => { out.portAsks.push([x, y]); return world.ports.has(`${x},${y}`); },
    items: { create: (templateIndex) => mintBoatItem(templateIndex, uid++), addToPlayer: (item) => out.pack.push(item) },
    closeInventory: () => { out.closed++; },
    openCargo: (cargo) => out.cargo.push(cargo),
    openListPicker: (rows, onPick) => out.pickers.push({ rows, onPick }),
    popWindow: () => { out.pops++; },
    audio: { play: () => {}, stop: () => {}, oneShot: () => {}, dfOneShot: () => {}, dfClipAtPoint: () => {}, uiOneShot: (i) => out.sounds.push(i) },
  };
  const rt = createComeSailAwayRuntime(deps);
  const place = (hull = 1, variant = 0, at = [100, 34, 200]) => rt.PlaceBoat(at, [0, 0, 1], hull, variant, terrains[0]);
  return { rt, out, world, draws, place, settings };
}

// ── the rows, the mint, the shelf ─────────────────────────────────────────────

test('CSA-H: the two rows are the bundle\'s ItemTemplates.json field for field (its trailing comma read as DFU\'s parser reads it), registered past the classic table; neither stacks; the mint is SetItem off the row - the template\'s name, price and weight - with the host\'s UID', () => {
  const raw = readFileSync(new URL('../../vendor/come-sail-away/ItemTemplates.json', import.meta.url), 'utf8');
  assert.deepEqual(CSA_ITEM_TEMPLATES, JSON.parse(raw.replace(/,(\s*)\]\s*$/, '$1]')));
  assert.deepEqual([BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE], [1320, 1321]);
  assert.deepEqual([templateByIndex(1320).name, templateByIndex(1320).basePrice, templateByIndex(1321).name, templateByIndex(1321).baseWeight], ['Parts of', 4000, 'Deed to', 0.5]);
  const deed = mintBoatItem(1321, 42);
  assert.deepEqual([deed.group, deed.templateIndex, deed.name, deed.value, deed.message, deed.UID, deed.stackCount], ['UselessItems2', 1321, 'Deed to', 6000, 0, 42, 1]);
  assert.equal(isStackable(deed), false, 'ItemBoatDeed.IsStackable');
  assert.equal(isStackable(mintBoatItem(1320, 43)), false, 'ItemBoatParts.IsStackable');
  assert.equal(boatItemName('Deed to', 3, 2), "Deed to Large Galley 'III'");
  assert.throws(() => boatItemName('Deed to', 5, 0), /IndexOutOfRangeException/, 'hullNames[5]');
  assert.throws(() => boatItemName('Deed to', 0, 10), /IndexOutOfRangeException/, 'variantNames[10]');
});

// PIN MOVED (SHIPYARDS, 2026-10-11, Mac: "Shipyard only"): RegisterCustomItem's group no longer stocks the two - a port
// town's shipyard sells every hull and buys them back (systems/shipyards.js), a DECLARED departure (Ledger A, SHIPYARDS)
test('CSA-H x SHIPYARDS: the two rows stand on no shelf - GetCustomItemsForGroup answers neither, the mod on or off; the one home\'s Contains guard and the fish\'s rows stand', () => {
  try {
    setModSetting('come-sail-away', 'Enabled', true);
    assert.deepEqual(customItemsForGroup('UselessItems2').filter((i) => i === 1320 || i === 1321), [], 'the mod on: on no shelf');
    assert.ok(!customItemsForGroup('Weapons').includes(1320));
    setModSetting('come-sail-away', 'Enabled', false);
    assert.ok(!customItemsForGroup('UselessItems2').includes(1320) && !customItemsForGroup('UselessItems2').includes(1321));
    setModSetting('come-sail-away', 'Enabled', true);
    // a second registration of a row is DFU's Contains guard: no second row (a row of the test's own, kept off)
    registerCustomItemGroup(9931, 'UselessItems2', () => false);
    registerCustomItemGroup(9931, 'UselessItems2', () => true);
    assert.equal(customItemsForGroup('UselessItems2').filter((i) => i === 9931).length, 0, 'the first registration\'s switch stands');
    // found on the way: Iliac Puddle No More's DeepWaters.Init registers its fish into the same group (no class)
    const fish = DEEP_WATERS_FISH_TEMPLATES.map((t) => t.index);
    setModSetting('iliac-puddle-no-more', 'Enabled', true);
    assert.deepEqual(customItemsForGroup('UselessItems2').filter((i) => fish.includes(i)), fish, 'every fish, while its mod is on');
    setModSetting('iliac-puddle-no-more', 'Enabled', false);
    assert.equal(customItemsForGroup('UselessItems2').filter((i) => fish.includes(i)).length, 0);
  } finally { setModSetting('come-sail-away', 'Enabled', true); setModSetting('iliac-puddle-no-more', 'Enabled', false); }
});

test('CSA-H: AssignVariantsToShopItems (the OnLootSpawned subscriber) - a deed takes a hull of Range(1, 4), variant I, priced as the hull, its weight the row\'s; parts are a Rowboat \'I\' at its price and weight; anything else is untouched; the shelf\'s two take a UID of the host\'s, an item that has one keeps it', () => {
  const draws = [3, 1];
  const range = (min, max) => { assert.deepEqual([min, max], [1, 4]); return draws.shift(); };
  const items = [mintBoatItem(1321, 1), { group: 'UselessItems2', templateIndex: 50, name: 'Oil', value: 5 }, mintBoatItem(1320, 2), mintBoatItem(1321, 3)];
  assignVariantsToShopItems(items, range);
  assert.deepEqual([items[0].message, items[0].value, items[0].name, items[0].weightInKg], [30, HULL_PRICES[3], "Deed to Large Galley 'I'", undefined]);
  assert.deepEqual(items[1], { group: 'UselessItems2', templateIndex: 50, name: 'Oil', value: 5 });
  assert.deepEqual([items[2].message, items[2].value, items[2].weightInKg, items[2].name], [0, 4000, HULL_WEIGHTS[0], "Parts of Rowboat 'I'"]);
  assert.deepEqual([items[3].message, items[3].value, items[3].name], [10, 8000, "Deed to Large Boat 'I'"]);
  assert.equal(draws.length, 0, 'one draw per deed, in the shelf\'s order');
  // the shelf mints its items with no UID: the two take one each (DFU's construction gave them one), the rest none
  const shelf = [{ group: 'UselessItems2', templateIndex: 1321 }, { group: 'UselessItems2', templateIndex: 50 }, { group: 'UselessItems2', templateIndex: 1320 }, mintBoatItem(1321, 7)];
  let next = 100;
  assert.ok(mintShelfBoatUids(shelf, () => next++) === shelf);
  assert.deepEqual(shelf.map((i) => i.UID), [100, undefined, 101, 7], 'one each, in order; an item that has one keeps it');
});

// ── the ports ────────────────────────────────────────────────────────────────

test('CSA-H: IsNearPort walks the square round the player - FIELD BUGS 29h DEED-PORT centred it (Mac: "Dont worry abour DFU"; the C#\'s ran X - range while < X + range - 1), x outer (range 3: the pixels -3..+3), a port anywhere in it answers; PortLocationSearchRange is read live', () => {
  const s = scene();
  assert.equal(s.rt.IsNearPort(3), false);
  const xs = [...new Set(s.out.portAsks.map(([x]) => x))];
  const ys = [...new Set(s.out.portAsks.map(([, y]) => y))];
  assert.deepEqual(xs, [7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(ys, [17, 18, 19, 20, 21, 22, 23]);
  assert.equal(s.out.portAsks.length, 49);
  assert.deepEqual(s.out.portAsks.slice(0, 8), [[7, 17], [7, 18], [7, 19], [7, 20], [7, 21], [7, 22], [7, 23], [8, 17]]);
  const east = scene({ ports: ['12,20'] });
  assert.equal(east.rt.IsNearPort(3), true, 'two pixels east is near now (the C#\'s square stopped at one)');
  const far = scene({ ports: ['14,20'] });
  assert.equal(far.rt.IsNearPort(3), false, 'four is not');
  const west = scene({ ports: ['7,20'] });
  assert.equal(west.rt.IsNearPort(3), true, 'three pixels west is inside');
  const one = scene({ ports: ['10,20'] });
  assert.equal(one.rt.IsNearPort(1), true, 'range 1 asks the player\'s own pixel');
  assert.deepEqual(one.out.portAsks, [[9, 19], [9, 20], [9, 21], [10, 19], [10, 20]], 'range 1 walks X - 1..X + 1, and stops at the port');
  // the live setting: the variant box asks with it
  const set = scene({ settings: { 'Controls.PortLocationSearchRange': 5 } });
  set.rt.OpenBoatVariantPicker(set.place(1, 0));
  assert.equal(set.out.portAsks.length, 121, 'range 5: eleven columns of eleven');
});

// ── PackBoat and the cargo ───────────────────────────────────────────────────

test('CSA-H: PackBoat - the boat\'s parts ("hull * 10 + variant", the hull\'s price, weight and name) to the back of the pack with the HUD\'s line; a cargo aboard moved whole into PackedCargoes under the parts\' UID, its weight never on the parts (PARTS-WEIGHT, a departure from the C#\'s sum); the boat destroyed and off the list; a UID already keyed throws (Dictionary.Add)', () => {
  const s = scene();
  const boat = s.place(1, 3);
  boat.Cargo.Items.push({ name: 'rope', weightInKg: 2, stackCount: 3 }, { name: 'net', weightInKg: 1.5 });
  s.rt.PackBoat(boat, true);
  assert.deepEqual(s.out.hud, ['You store the boat in your inventory']);
  const [parts] = s.out.pack;
  assert.deepEqual([parts.templateIndex, parts.message, parts.value, parts.name], [1320, 13, HULL_PRICES[1], "Parts of Large Boat 'IV'"]);
  assert.equal(parts.weightInKg, HULL_WEIGHTS[1], 'the hull\'s weight alone (PARTS-WEIGHT: the C# adds the cargo\'s)');
  assert.deepEqual(s.rt.state.PackedCargoes.get(String(parts.UID)).map((i) => i.name), ['rope', 'net']);
  assert.equal(boat.Cargo.Items.length, 0, 'TransferAll empties the hold');
  assert.equal(boat.MapPixel, null);
  assert.ok(s.out.removed.includes(boat) && !s.rt.AllBoats.includes(boat));
  // an empty hold packs no cargo record; item: false only destroys
  const bare = s.place(0, 0);
  s.rt.PackBoat(bare, true);
  assert.equal(s.rt.state.PackedCargoes.size, 1);
  assert.equal(s.out.pack.at(-1).weightInKg, HULL_WEIGHTS[0]);
  const lost = s.place(0, 0);
  s.rt.PackBoat(lost, false);
  assert.equal(s.out.pack.length, 2, 'no item');
  assert.ok(!s.rt.AllBoats.includes(lost));
  // a UID the dictionary already holds
  const clash = scene();
  const b = clash.place(0, 0);
  b.Cargo.Items.push({ name: 'x', weightInKg: 1 });
  clash.rt.state.PackedCargoes.set('100', []);
  assert.throws(() => clash.rt.PackBoat(b, true), /same key/);
});

test('CSA-H: the cargo box opens the boat\'s own cargo as the inventory\'s loot target (OpenBoatCargo -> OpenCargo); the variant box opens a picker of the variants by number, never at the helm, refused without variants or a port', () => {
  const s = scene({ ports: ['9,19'] });
  const boat = s.place(1, 0);
  s.rt.activate(TRIGGER_MODEL.cargo, { root: boat.GameObject, node: boat.CargoTrigger, distance: 1 }, 'grab');
  assert.equal(s.out.cargo.length, 1);
  assert.ok(s.out.cargo[0] === boat.Cargo, 'the DaggerfallLoot itself');
  assert.deepEqual([boat.Cargo.ContainerImage, boat.Cargo.playerOwned], [6, true]);
  // ...as the pack reads a loot target: the live list (what it takes and stows), the Merchant's picture, the owner
  const lt = cargoLootTarget(boat.Cargo);
  assert.ok(remoteTarget({ loot: lt }, {}) === boat.Cargo.Items, 'the pack\'s remote list is the hold itself');
  assert.equal(remoteTargetType({ loot: lt }, {}), remoteTargetType({ loot: { items: () => [] } }, {}), 'a container, as any loot target');
  assert.deepEqual([lt.containerImage(), lt.playerOwned], [CONTAINER_IMAGES.Merchant, true]);
  boat.Cargo.Items.push({ name: 'rope' });
  assert.equal(remoteTarget({ loot: lt }, {}).length, 1, 'read live, not copied');
  boat.Cargo.Items.length = 0;
  // the picker
  const count = boat.GetVariantCount;
  assert.ok(count > 1, `the Large Boat has variants (${count})`);
  s.rt.activate(TRIGGER_MODEL.variant, { root: boat.GameObject, node: boat.VariantTrigger, distance: 1 }, 'grab');
  assert.equal(s.out.pickers.length, 1);
  assert.deepEqual(s.out.pickers[0].rows, Array.from({ length: count }, (_, i) => String(i)));
  assert.ok(s.rt.state.variantBoatTarget === boat);
  s.out.pickers[0].onPick(2);
  assert.deepEqual(s.out.sounds, [360], 'DaggerfallUI.PlayOneShot(360)');
  assert.equal(s.out.pops, 1, 'the picker popped');
  assert.ok(s.out.variants.length === 1 && s.out.variants[0][0] === boat && s.out.variants[0][1] === 2);
  assert.equal(boat.variant, 2);
  assert.ok(s.rt.state.variantBoatTarget === null, 'the target cleared (by identity: a failing equal would diff the boat)');
  // at the helm: nothing
  s.rt.StartSailing(boat);
  s.rt.activate(TRIGGER_MODEL.variant, { root: boat.GameObject, node: boat.VariantTrigger, distance: 1 }, 'grab');
  assert.equal(s.out.pickers.length, 1);
  // no port
  const far = scene();
  const fb = far.place(1, 0);
  far.rt.activate(TRIGGER_MODEL.variant, { root: fb.GameObject, node: fb.VariantTrigger, distance: 1 }, 'grab');
  assert.deepEqual([far.out.pickers.length, far.out.mid.at(-1)], [0, ['There is no port nearby', f(1.5)]]);
  // no variants (the Rowboat's VariantObject has none past... whichever hull answers zero)
  const none = scene({ ports: ['9,19'] });
  const nb = none.place(0, 0);
  nb.VariantObject = null;
  none.rt.OpenBoatVariantPicker(nb);
  assert.deepEqual(none.out.mid.at(-1), ['This boat has no variants', f(1.5)]);
  const empty = none.place(1, 0);
  empty.VariantObject = { childCount: 0 };
  none.rt.OpenBoatVariantPicker(empty);
  assert.deepEqual([none.out.mid.length, none.out.pickers.length], [2, 0], 'a variant holder with no children: the same refusal');
});

// ── giveboat ─────────────────────────────────────────────────────────────────

test('CSA-H: giveboat - no argument: a hull of Range(0, 4) (the Large Boat a variant of Range(0, 7)); one: that hull (the Large Boat\'s variant still drawn); two: both; three or more: the Rowboat \'I\'; the deed named, its message hull x 10 + variant, to the back of the pack; a hull past the table throws as hullNames[num] does', () => {
  assert.deepEqual([CONSOLE.giveboat.name, CONSOLE.giveboat.description, CONSOLE.giveboat.usage], ['giveboat', "Add a boat deed to the player's inventory", 'giveboat [hull] [variant]; No argument will result in random hull and variant.']);
  const s = scene();
  s.draws.push(1, 5, 2);
  s.out.ranges.length = 0;
  assert.equal(s.rt.console.giveboat([]), "Boat deed added to player's inventory");
  assert.deepEqual(s.out.ranges, [[0, 4], [0, 7]], 'Range(0, 4) for the hull, Range(0, 7) for the Large Boat\'s variant');
  assert.deepEqual([s.out.pack[0].templateIndex, s.out.pack[0].message, s.out.pack[0].name], [1321, 15, "Deed to Large Boat 'VI'"]);
  s.rt.console.giveboat([]);
  assert.deepEqual([s.out.pack[1].message, s.out.pack[1].name], [20, "Deed to Small Ship 'I'"], 'a hull other than 1 draws no variant');
  const t = scene();
  t.draws.push(4);
  t.rt.console.giveboat(['1']);
  assert.equal(t.out.pack[0].name, "Deed to Large Boat 'V'");
  t.rt.console.giveboat(['4', '2']);
  assert.equal(t.out.pack[1].name, "Deed to Carrack 'III'");
  t.rt.console.giveboat(['4', '2', 'x']);
  assert.equal(t.out.pack[2].name, "Deed to Rowboat 'I'", 'no arm for three');
  assert.throws(() => t.rt.console.giveboat(['7']), /IndexOutOfRangeException/);
  assert.throws(() => t.rt.console.giveboat(['a']), /FormatException/);
  assert.deepEqual([new Set(s.out.pack.map((i) => i.UID)).size, new Set(t.out.pack.map((i) => i.UID)).size], [2, 3], 'each deed its own UID (the host\'s mint)');
});

// ── the two classes' UseItem ─────────────────────────────────────────────────

test('CSA-H: ItemBoatParts.UseItem - refused in a dry interior (no close, no placing); in a dungeon\'s water or outdoors the inventory closes and the parts start placing', () => {
  const s = scene();
  const parts = mintBoatItem(1320, 7);
  s.world.inside = true;
  assert.equal(s.rt.useBoatParts(parts, [parts]), false);
  assert.deepEqual([s.out.closed, s.rt.placing], [0, false]);
  s.world.water = 60;
  assert.equal(s.rt.useBoatParts(parts, [parts]), true, 'a dungeon with water');
  assert.deepEqual([s.out.closed, s.rt.placing], [1, true]);
  assert.ok(s.rt.state.placeItem === parts);
  assert.deepEqual(s.out.log, ['COME SAIL AWAY - USING BOAT PARTS!', 'COME SAIL AWAY - USING BOAT PARTS!']);
});

test('CSA-H: ItemBoatDeed.UseItem - refused indoors; the inventory closed; a deed whose boat stands on another pixel wants a port nearby, a deed with no boat a port at all; its boat on this pixel repositions without one', () => {
  const s = scene();
  const deed = mintBoatItem(1321, 9);
  s.world.inside = true;
  assert.equal(s.rt.useBoatDeed(deed, [deed]), false);
  assert.equal(s.out.closed, 0, 'indoors: before the close');
  s.world.inside = false;
  assert.equal(s.rt.useBoatDeed(deed, [deed]), false);
  assert.deepEqual([s.out.closed, s.out.mid.at(-1), s.rt.placing], [1, ['There is no port nearby', f(1.5)], false], 'no boat, no port: closed and refused');
  // its boat, here
  const boat = s.place(1, 0);
  boat.uid = 9;
  assert.equal(s.rt.useBoatDeed(deed, [deed]), true, 'the boat on this pixel: no port wanted');
  assert.equal(s.rt.placing, true);
  s.rt.StopPlacing();
  // its boat elsewhere
  boat.MapPixel = { X: 30, Y: 40 };
  assert.equal(s.rt.useBoatDeed(deed, [deed]), false);
  assert.deepEqual(s.out.mid.at(-1), ['There is no port nearby or ship is in another location', f(1.5)]);
  s.world.ports.add('8,18');
  assert.equal(s.rt.useBoatDeed(deed, [deed]), true, '...a port nearby lets it come');
});

// ── the host ─────────────────────────────────────────────────────────────────

test('CSA-H: the host\'s seams - the two use handlers on the item-use door (the close riding the result, nothing when the mod is off), the shelf\'s subscriber after Roleplay Realism\'s, the port flag off the location, the cargo as a loot target, the picker in the mode\'s slot, giveboat registered first', () => {
  const w = src('scenes/world.js');
  assert.match(w, /for \(const \[templateIndex, use\] of \[\[CSA_PARTS_TEMPLATE, 'useBoatParts'\], \[CSA_DEED_TEMPLATE, 'useBoatDeed'\]\]\) \{\s*registerItemUseHandler\(templateIndex, Object\.assign\(\(item, collection\) => \{\s*if \(!csaOn\(\)\) return null;\s*_csaInventoryClosed = false;/);
  assert.match(w, /return used \|\| _csaInventoryClosed \? \{ kind: 'comeSailAway', closesWindow: _csaInventoryClosed \} : null;\s*\}, \{ usable: \(\) => csaOn\(\) \}\)\);/);
  assert.match(w, /closeInventory: \(\) => \{ _csaInventoryClosed = true; \},/);
  assert.match(w, /for \(const k of \['giveboat', 'placeboat', 'printboats', 'identifyboat', 'purgeboat'\]\) registerCommand/);
  assert.match(w, /return !!loc && \(loc\.exterior\?\.exteriorData\?\.portTownAndUnknown \?\? 0\) !== 0;/);
  assert.match(w, /const w = makeInventoryWindow\(\{ loot: cargoLootTarget\(cargo\) \}\);/);
  assert.match(w, /const win = new ListPickerWindow\(\{ items: rows, backdrop: 'none', onPick: \(i\) => onPick\(i\),/);   // DaggerfallPopupWindow's Color.clear: the world stays behind it
  assert.match(w, /if \(modes\?\.mountWindow\?\.\(win\)\) _csaPicker = win;/);
  assert.match(w, /const csaShelfStocked = \(items\) => \{ if \(csaOn\(\) && Array\.isArray\(items\)\) assignVariantsToShopItems\(mintShelfBoatUids\(items, csaNewItemUid\), \(min, max\) => min \+ Math\.floor\(Math\.random\(\) \* \(max - min\)\)\); return items; \};/);
  // SHIP-PACK (PIN MOVED): and the pack itself, which a ship's deed is found in and taken from as she is picked up
  // PIN MOVED (HOLDINGS, bible/03-World/Holdings.md): the items' seam carries the Fleet's book after the pack (titles, retitle) -
  // the pin reads the three the mod's own laws use, up to the pack, and test/systems/naval/fleet.test.js pins the two it added
  assert.match(w, /items: \{ create: \(templateIndex\) => mintBoatItem\(templateIndex, csaNewItemUid\(\)\), addToPlayer: \(item\) => addItem\(\(playerEntity\.items \?\?= \[\]\), item\), player: \(\) => \(playerEntity\.items \?\?= \[\]\),/);
  const m = src('scenes/worldModes.js');
  // THE MERGE: CSA-H's subscriber is one of PlayerActivate.OnLootSpawned's (FORAGE3's one home), by its mod's name, a
  // shop shelf's alone - and both shelf doors raise it, after Roleplay Realism's subscribers
  assert.match(w, /registerContainerLootHandler\(COME_SAIL_AWAY_VENDOR, \(a\) => \{ if \(a\.containerType === LOOT_CONTAINER_TYPES\.ShopShelves\) csaShelfStocked\(a\.items\); \}\);/);
  assert.equal((m.match(/shelfLootSpawned\(stockShopShelf\(\{ buildingType: b\.buildingType, quality: b\.quality \}, playerEntity(?:, \{ shelfIndex: i \})?\), b\)/g) ?? []).length, 2, 'both shelf doors (AUDIT ECON P1: the shelf hands its index)');
  assert.match(m, /mountWindow: \(win\) => mountSpellWindow\(win\),\s*closeWindow: \(win\) => closeSpellWindow\(win\),/);
  const pool = src('scenes/comeSailAway/comeSailAwayPool.js');
  assert.match(pool, /function setVariant\(boat, variant\) \{\s*setBoatVariant\(boat, variant, \{ models,/);
});

test('CSA-H x SHIPYARDS: the shelf\'s custom loop stocks neither row - a roll that always succeeds stocks everything a General Store\'s or a Pawn Shop\'s shelf can hold, and no boat; neither counter buys one (PIN MOVED: the General Store stocked both, parts first)', async () => {
  const { stockShopShelf, shopBuysItem } = await import('../../src/systems/shopStock.js');
  const { BUILDING_TYPES } = await import('../../src/world/buildingNames.js');
  const player = { level: 5, gender: 'male', race: 'Breton' };
  for (const buildingType of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop]) {
    const all = stockShopShelf({ buildingType, quality: 10 }, player, { rolls: () => 0 });
    assert.ok(all.length > 0, 'the shelf stocks');
    assert.equal(all.filter((i) => i.templateIndex === 1320 || i.templateIndex === 1321).length, 0, `building ${buildingType}: no boat on its shelf`);
    for (const t of [1320, 1321]) assert.equal(shopBuysItem(buildingType, mintBoatItem(t, 5)), false, `building ${buildingType}: buys no ${t}`);
  }
});

// AUDIT SHIPYARDS L6-11: the mod's switch now feeds its one effect kind alone (the shelf's rows retired) - and nothing
// pinned it, so CSA-H-group-always (the switch read as always on) survived; pinned here, the latch last (none clears it)
test('CSA-H x AUDIT SHIPYARDS: WaterWalkingSilent - the mod\'s own effect - is a kind the broker knows only while the mod is loaded: off and unlatched, none; on, known; latched off for the game, none whatever the switch says', () => {
  assert.equal(modLatchedOn('come-sail-away'), undefined, 'no host latched it in this file');
  try {
    setModSetting('come-sail-away', 'Enabled', false);
    assert.equal(effectKindLoaded(WATER_WALKING_SILENT_KIND), false, 'the mod off: no such kind');
    setModSetting('come-sail-away', 'Enabled', true);
    assert.equal(effectKindLoaded(WATER_WALKING_SILENT_KIND), true, 'the mod on: its kind');
    latchModLoaded('come-sail-away', false);
    assert.equal(effectKindLoaded(WATER_WALKING_SILENT_KIND), false, 'latched off for the game: none, the switch on');
  } finally { latchModLoaded('come-sail-away', true); setModSetting('come-sail-away', 'Enabled', true); }
});
