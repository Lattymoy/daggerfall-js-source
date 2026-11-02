// IC-PROPS (2026-10-27, the owner: "Some doors in Imperial city can be entered but dont show the tooltip", then "a world
// wide issue": "Every enterable door shows its tooltip, world-wide"; bible/03-World/Arena-Provinces.md IC-PROPS) - EVERY
// DOOR A PLAYER CAN WALK THROUGH NAMES ITS BUILDING, AND THE BUILDING ITS OWN TOWN'S.
//
// Two causes, both world-wide: a house with no name of its own (every House1-4 and House6 of Daggerfall's blocks and both
// town packs - 6,325 of the 8,295 building doors with a room) showed no plaque wherever it listed no verbs, where DFU
// names every residence "Residence" (PlayerGPS.cs:1306-1309) and World Tooltips prints "To" and it over its door
// (Modded_HUDTooltipWindow.cs:719-728); and a door of a NEIGHBOURING location (an Imperial City slice beside the
// player's, a town across a pixel's edge) was read in the player's own town's book and directory - its plaque named
// another building, or none. The door's record carries its own town's book, name and building name now
// (scenes/world.js buildingDataForDoor), and a nameless house is a "Residence", a ship's deck its place's name.
//
// Driven through the real mode machine both town hosts build (worldModes' exteriorHoverName - test/systems/
// fb1013e_doorname.test.js's rig), with the real discovery store and the real door plaque words.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setModSetting } from '../../src/systems/modSettings.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { getDiscoveredBuilding, hasDiscoveredBuilding } from '../../src/systems/discovery.js';
import { homeDoorName } from '../../src/systems/online/onlineHomes.js';
import { hostText } from '../hostText.mjs';

const noop = () => {};
async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** One door on the street at z = -3, facing the eye. */
const door = (key) => ({ matrix: I, centre: { x: 0, y: 1.2, z: -3 }, normal: { x: 0, y: 0, z: 1 }, size: { x: 0.2, y: 2.4, z: 1.4 }, doorType: 0, buildingKey: key });

async function buildModes(data, here = 'imperial-slice-312') {
  const deep = () => new Proxy(function () {}, {
    get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : deep()),
    apply: () => deep(),
    construct: () => deep(),
  });
  globalThis.addEventListener ??= noop;
  globalThis.removeEventListener ??= noop;
  globalThis.fetch = async () => { throw new Error('no ARENA2 in this test'); };
  const { createWorldModes } = await import('../../src/scenes/worldModes.js');
  globalThis.window = globalThis;
  const canvas = { width: 640, height: 400, clientWidth: 640, clientHeight: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  const street = new Collider(() => 0);
  const player = new PlayerMotor(street);
  const cam = { yaw: 0, pitch: 0, pos: [0, 1.6, 0] };
  const entry = { door: door(data.buildingKey), dfBlock: { index: 1 }, recordIndex: 3, pixelKey: 0, climateBase: 300, season: 0, dfLocation: null, group: 'g' };
  return quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam, keys: new Set(), latch: { edge: deep() },
    blocks: null, pipeline: deep(), townTalk: { say: noop },
    doorTargets: () => [entry], baseCollider: () => street, buildingTargets: () => [],
    buildingDataForDoor: () => ({ ...data }),
    discoveryLocationId: () => here,
    currentLocation: () => ({ name: 'The Player\'s Town' }),
  }));
}
/** The plaque over the door the eye looks down at. */
function plaqueOf(modes) {
  const dir = [0, -0.524, -0.852], l = Math.hypot(...dir);
  return modes.exteriorHoverName(0, { eye: [0, 1.6, 0], dir: dir.map((v) => v / l) });
}

test('IC-PROPS A NAMELESS HOUSE IS A "RESIDENCE" - every house type with no name of its own (House1 to House6) is named as DFU discovers it, whatever its verbs; a shop or a quest\'s home keeps its own, and a building of no house type with no name its place\'s (mutant: the type unread)', () => {
  for (const type of [BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3, BUILDING_TYPES.House4, BUILDING_TYPES.House5, BUILDING_TYPES.House6]) {
    assert.equal(homeDoorName('', false, type), 'Residence', `type ${type}`);
  }
  assert.equal(homeDoorName('', true), 'Residence', 'a house with verbs, as before');
  assert.equal(homeDoorName('The Sated Wolf', false, BUILDING_TYPES.Tavern), 'The Sated Wolf');
  assert.equal(homeDoorName('Varric\'s Home', false, BUILDING_TYPES.House2), 'Varric\'s Home');
  assert.equal(homeDoorName('', false, BUILDING_TYPES.Ship), '');
  assert.equal(homeDoorName('', false), '');
});

test('IC-PROPS EVERY HOUSE DOOR SHOWS ITS PLAQUE - a nameless House2\'s door, offline and with no verbs, reads "Residence" and is discovered so (it read nothing, though the door entered); a ship\'s deck its place\'s name (mutants: the type unread at the plaque; no place for a nameless building)', async () => {
  setModSetting('world-tooltips', 'Enabled', true);
  const house = { buildingKey: 0x10202, name: '', buildingType: BUILDING_TYPES.House2, quality: 6, factionId: 0, nameSeed: 99, regionIndex: 17, locationIndex: 5, townBook: 'imperial-slice-312', townName: 'Imperial City' };
  const plaque = plaqueOf(await buildModes(house));
  assert.ok(plaque && typeof plaque.title === 'string', 'the door has a plaque');
  assert.match(plaque.title, /Residence/);
  assert.ok(getDiscoveredBuilding('imperial-slice-312', house.buildingKey), 'discovered, as the mod maps what it names');
  const ship = { buildingKey: 0x10303, name: '', buildingType: BUILDING_TYPES.Ship, quality: 1, factionId: 0, nameSeed: 7, regionIndex: 17, locationIndex: 5, townBook: 'imperial-slice-312', townName: 'Imperial City' };
  const deck = plaqueOf(await buildModes(ship));
  assert.ok(deck && /Imperial City/.test(deck.title), `a ship's deck its place's name (${deck?.title})`);
});

test('IC-PROPS A DOOR OF THE NEXT SLICE IS ITS OWN TOWN\'S - its building named and discovered in the town its door stands in, never the player\'s: the record the host hands carries that town\'s book, name and its building\'s own name (scenes/world.js buildingDataForDoor, scenes/townTalk.js buildingNameIn), and the plaque, the press and the Info say read them (mutants: the player\'s book; the player\'s town\'s name on a nameless door)', async () => {
  setModSetting('world-tooltips', 'Enabled', true);
  const shop = { buildingKey: 0x20404, name: 'The Gilded Quill', buildingType: BUILDING_TYPES.Bookseller, quality: 12, factionId: 0, nameSeed: 4321, regionIndex: 17, locationIndex: 6, townBook: 'imperial-slice-313', townName: 'Imperial City' };
  const plaque = plaqueOf(await buildModes(shop, 'imperial-slice-312'));
  assert.match(plaque.title, /The Gilded Quill/);
  assert.ok(getDiscoveredBuilding('imperial-slice-313', shop.buildingKey), 'discovered in the door\'s own town\'s book');
  assert.equal(hasDiscoveredBuilding('imperial-slice-312', shop.buildingKey), false, 'never the player\'s slice\'s');
  // a nameless building of the next town: its own town's name, not the player's
  const hall = { buildingKey: 0x20505, name: '', buildingType: BUILDING_TYPES.Ship, quality: 1, factionId: 0, nameSeed: 1, regionIndex: 17, locationIndex: 6, townBook: 'next-town', townName: 'Gothway Garden' };
  const p2 = plaqueOf(await buildModes(hall, 'here'));
  assert.match(p2.title, /Gothway Garden/);
  assert.doesNotMatch(p2.title, /The Player's Town/);
  // the host's record: the door's town's book, name and building name
  const world = hostText('src/scenes/world.js'), modes = hostText('src/scenes/worldModes.js');
  assert.match(world, /townBlocks: homeTownBlocks\(dfLoc\), \.\.\.townTalk\.doorTownOf\(dfLoc, d\) \};/);
  assert.equal((modes.match(/const locId = bd\??\.townBook \?\? discoveryLocationId\?\.\(\) \?\? null;/g) ?? []).length, 3, 'the hover, the press and the activation read the door\'s book');
  assert.match(modes, /homeDoorName\(db\.displayName, false, bd\.buildingType\)/, 'the Info say a nameless house\'s "Residence" too');
  const talk = hostText('src/scenes/townTalk.js');
  assert.match(talk, /function buildingNameIn\(place, data\) \{/);
  assert.match(talk, /const doorTownOf = \(place, data\) => \(\{ name: buildingNameIn\(place, data\), townBook: townBookOf\(place\), townName: place\?\.name \?\? '' \}\);/);
});
