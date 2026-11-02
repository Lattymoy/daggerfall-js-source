// DOOR-NAME (FIELD BUGS 2026-10-13e, SylviaBun: "Tavern in Issaqumbaa marked as a player house" - the town's map with
// the tavern on it, and the tavern's front door reading "To Residence / Lock Level: 6 / Go in / Buy it: 227,900 gold").
//
// A door's plaque named the building the ray's POINT fell in - the first StaticBuilding box of every loaded block that
// held it (buildingUnderRay) - while the click enters, prices and buys the DOOR'S OWN record (activateStaticDoor's
// `buildingDataForDoor(hit)`). A box is the AABB of a rotated building (DaggerfallStaticBuildings.cs:73-86), wider than
// its walls, and the mod tests the HIT block's buildings alone (GetBuildings(hit.transform)); the port tested every
// block's. So a neighbour house's box over the tavern's doorstep named the tavern's door - nameless, so "Residence", and
// online its buy row - while the click walked into the tavern. The plaque reads the door's own record now.
//
// Driven through the real mode machine both town hosts build (worldModes' exteriorHoverName, AUDIT 68's stub-host rig),
// with the real discovery store and the real door plaque words.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setModSetting } from '../../src/systems/modSettings.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { getDiscoveredBuilding, hasDiscoveredBuilding } from '../../src/systems/discovery.js';

const noop = () => {};
async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const TAVERN_RECORD = 3, HOUSE_RECORD = 2;
const TAVERN = Object.freeze({ buildingKey: 0x10303, name: 'The Sated Wolf', buildingType: BUILDING_TYPES.Tavern, quality: 12, factionId: 0, nameSeed: 4242, regionIndex: 17, locationIndex: 5 });
const HOUSE = Object.freeze({ buildingKey: 0x10202, name: '', buildingType: BUILDING_TYPES.House3, quality: 6, factionId: 0, nameSeed: 99, regionIndex: 17, locationIndex: 5 });
/** The tavern's front door: on the street at z = -3, facing the eye, in the tavern's record. */
const DOOR = { matrix: I, centre: { x: 0, y: 1.2, z: -3 }, normal: { x: 0, y: 0, z: 1 }, size: { x: 0.2, y: 2.4, z: 1.4 }, doorType: 0, buildingKey: TAVERN.buildingKey };
const ENTRY = { door: DOOR, dfBlock: { index: 1 }, recordIndex: TAVERN_RECORD, pixelKey: 0, climateBase: 300, season: 0, dfLocation: null, group: 'g' };
/** The neighbour: a House3 turned in the next block, whose AABB (wider than its walls) takes in the tavern's doorstep. */
const HOUSE_BOX = { dfBlock: { index: 0 }, recordIndex: HOUSE_RECORD, pixelKey: 0, matrix: I, aabb: { min: [-6, -1, -8], max: [6, 9, -2] } };

async function buildModes(asked) {
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
  return quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam, keys: new Set(), latch: { edge: deep() },
    blocks: null, pipeline: deep(), townTalk: { say: noop },
    doorTargets: () => [ENTRY], baseCollider: () => street,
    buildingTargets: () => [HOUSE_BOX],
    buildingDataForDoor: (e) => { asked.push(e.recordIndex); return e.recordIndex === TAVERN_RECORD ? { ...TAVERN } : e.recordIndex === HOUSE_RECORD ? { ...HOUSE } : null; },
    discoveryLocationId: () => 'issaqumbaa',
  }));
}

test('DOOR-NAME: the tavern\'s door is named for the tavern - its own record, the one its click enters - though a neighbour house\'s box holds the ray\'s point', async () => {
  setModSetting('world-tooltips', 'Enabled', true);
  const asked = [];
  const modes = await buildModes(asked);
  // the eye on the street looking down at the tavern's doorstep: the ray meets the ground at z -2.6, inside the house's box
  const eye = [0, 1.6, 0], dir = [0, -0.524, -0.852];
  const l = Math.hypot(...dir), d = dir.map((v) => v / l);
  const plaque = modes.exteriorHoverName(0, { eye, dir: d });
  assert.ok(plaque && typeof plaque.title === 'string', 'the door has a plaque');
  assert.doesNotMatch(plaque.title, /Residence/, 'not the neighbour\'s nameless house');
  assert.ok(!(plaque.actions ?? []).some((a) => /Buy it/.test(a)), 'and no buy row');
  assert.ok(getDiscoveredBuilding('issaqumbaa', TAVERN.buildingKey), 'the building the plaque discovered (the mod maps what it names) is the tavern');
  assert.equal(hasDiscoveredBuilding('issaqumbaa', HOUSE.buildingKey), false, 'and never the house the box held');
  assert.ok(asked.includes(TAVERN_RECORD), 'the door\'s own record was asked');
  assert.ok(!asked.includes(HOUSE_RECORD), 'the box was not asked to name a door');
  assert.match(plaque.title, /The Sated Wolf/, 'the plaque says the tavern\'s own name');
});
