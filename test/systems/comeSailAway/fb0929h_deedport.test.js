// FIELD BUGS 2026-09-29h (DEED-PORT) - Swordsman: "Boat deed not working in Port towns. I have been ALL over the coast
// trying to drop my boat at a port so I could start doing pirate things and no matter where I try and put it, it tells
// me I'm not near a port." Mac, on the batch's first answer (that the rule is Come Sail Away's own): "Dont worry abour
// DFU."
//
// The deed asked IsNearPort: a location MAPS.BSA flags PortTownAndUnknown (343 of 15,251) inside the C#'s square - three
// pixels west and north of the player, one east and south. The map draws its harbours off Travel Options' list (378, the
// 343 among them - 28e measured it), so 35 of the ports a player was shown refused the deed, a flagged port two pixels
// east or south was never near, and the refusal said nothing of where to go. Now: the square is centred, a harbour the
// map draws is a port, and the refusal names the nearest one and the way to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_DEED_TEMPLATE } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { mintBoatItem } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { hasPort, hasPortFor, PORT_LOCATION_IDS } from '../../../src/systems/travel/travelPorts.js';
import { getPixelFromPixelID } from '../../../src/formats/mapsFile.js';

const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const f = Math.fround;

/** The host's own port test and nearest-port finder, lifted off world.js, over a map of the test's making. */
function hostPorts({ flagged = new Set(), dict, names, here, ether = null }) {
  const port = /\n {2}(const csaIsPortTown = \(x, y\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  const near = /\n {2}(const COMPASS_WAYS = [^\n]*;\n {2}const csaNearestPort = \(\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  assert.ok(port && near, 'the host\'s port test or its nearest-port finder moved');
  const maps = {
    getLocation: (r, i) => ({ exterior: { exteriorData: { portTownAndUnknown: flagged.has(`${r}:${i}`) ? 1 : 0 } } }),
    getRegion: (r) => ({ mapNames: names[r] ?? [] }),
  };
  const travelLocationSummaryAt = (d, x, y) => d.get(y * 1000 + x) ?? null;
  // eslint-disable-next-line no-new-func
  // SEAT2b part two (PIN MOVED): the port test asks hasPortFor - HasPort, or a members' Harbour at a seat (none set here)
  // PIN MOVED (ETHER-PORTS): past the Veil the port test asks the isle's port (world.js etherPortAt) - with the Eltheric Ocean
  // off (`etherSea` false: every host but the enhanced and online ones) it never asks; `ether` here is its box's west edge
  // and its ports' pixels
  return new Function('mapDict', 'maps', 'travelLocationSummaryAt', 'hasPort', 'hasPortFor', 'PORT_LOCATION_IDS', 'getPixelFromPixelID', 'playerTravelPixel',
    'etherSea', 'inEther', 'etherPortAt',
    `${port[1]}\n${near[1]}\nreturn { csaIsPortTown, csaNearestPort };`)(dict, maps, travelLocationSummaryAt, hasPort, hasPortFor, PORT_LOCATION_IDS, getPixelFromPixelID, () => here,
    !!ether, (x) => !!ether && x >= ether.x0, (x, y) => (ether?.ports.has(`${x},${y}`) ? { name: 'an isle\'s port' } : null));
}
/** A map-directory row as buildMapDict mints one: its id is the pixel's (mapId & 0xfffff). */
const row = (x, y, regionIndex, mapIndex) => [y * 1000 + x, { id: y * 1000 + x, regionIndex, mapIndex }];

test('DEED-PORT: a harbour the map draws is a port for the deed, a flagged location still is, anything else is not (mutant: the map\'s harbours not asked)', () => {
  const harbour = getPixelFromPixelID(PORT_LOCATION_IDS[0] & 0xfffff);   // one of Travel Options' own
  const dict = new Map([row(harbour.x, harbour.y, 0, 0), row(100, 100, 1, 0), row(101, 100, 1, 1)]);
  const { csaIsPortTown } = hostPorts({ flagged: new Set(['1:0']), dict, names: {}, here: { x: 0, y: 0 } });
  assert.equal(csaIsPortTown(harbour.x, harbour.y), true, 'the map\'s anchor - whatever its byte says');
  assert.equal(csaIsPortTown(100, 100), true, 'the byte, as the mod reads it');
  assert.equal(csaIsPortTown(101, 100), false, 'a town that is neither');
  assert.equal(csaIsPortTown(5, 5), false, 'no location there');
  // ETHER-PORTS: past the Veil an isle's port is a port for the deed, the open sea about it is not, and the Bay is as it was
  const ether = { x0: 1000, ports: new Set(['1200,40']) };
  const { csaIsPortTown: isleOrBay } = hostPorts({ flagged: new Set(['1:0']), dict, names: {}, here: { x: 0, y: 0 }, ether });
  assert.deepEqual([isleOrBay(1200, 40), isleOrBay(1201, 40), isleOrBay(100, 100), isleOrBay(101, 100)], [true, false, true, false]);
});

test('DEED-PORT: the nearest harbour by name and the way to it - map y runs south; the host hands it to the runtime', () => {
  const ids = PORT_LOCATION_IDS.slice(0, 3).map((id) => getPixelFromPixelID(id & 0xfffff));
  const dict = new Map(ids.map((p, i) => row(p.x, p.y, 0, i)));
  const names = { 0: ['First Haven', 'Second Haven', 'Third Haven'] };
  const at = (p, dx, dy) => hostPorts({ dict, names, here: { x: p.x + dx, y: p.y + dy } }).csaNearestPort();
  // beside each of the three, that one is the nearest - whichever the list holds first
  assert.deepEqual(ids.map((p) => at(p, 0, 1).name), names[0]);
  const p = ids[2];
  assert.deepEqual([at(p, 0, 1).way, at(p, 0, -1).way, at(p, -1, 0).way, at(p, 1, 0).way, at(p, 1, 1).way, at(p, -1, -1).way],
    ['north', 'south', 'east', 'west', 'north-west', 'south-east']);
  // PIN MOVED (AUDIT HOLDINGS, the mutants' run): the Fleet host's deps carry the same call (HOLDINGS - Send away names
  // the port), so the pin reads Come Sail Away's own line by its note - either alone no longer stood for both
  assert.match(W, /\n\s*nearestPort: \(\) => csaNearestPort\(\),   \/\/ DEED-PORT: the refusal names where to go\n/, 'Come Sail Away\'s deps carry it');
});

/** The runtime over the deed's doors, the rest inert. */
function runtime({ ports = new Set(), nearest = null } = {}) {
  const mid = [];
  const deps = {
    pool: { models: null, ready: () => true, spawnNow: () => null, remove: () => {} },
    player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => false,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => null, playerTerrain: () => null, terrainAt: () => null, terrains: () => [],
    heightMapValue: () => 255, worldCompensation: () => [0, 0, 0],
    hudText: () => {}, midScreenText: (t, s) => mid.push([t, s]), log: () => {},
    random: { range: (min) => min }, time: () => 0, persistentDungeonBoats: () => false,
    packedItems: { serialize: (i) => i, deserialize: (r) => r },
    setting: () => undefined,
    isPortTown: (x, y) => ports.has(`${x},${y}`),
    ...(nearest ? { nearestPort: () => nearest } : {}),
    closeInventory: () => {},
  };
  return { rt: createComeSailAwayRuntime(deps), mid };
}

test('DEED-PORT: the square is centred - a port two pixels east is near at the default range, four is not; the refusal names the nearest port (mutants: the C#\'s square; the nearest never said)', () => {
  const deed = mintBoatItem(BOAT_DEED_TEMPLATE, 7);
  const east = runtime({ ports: new Set(['12,20']) });
  assert.equal(east.rt.IsNearPort(3), true, 'two east: near (the C#\'s square stopped at one)');
  assert.equal(runtime({ ports: new Set(['8,22']) }).rt.IsNearPort(3), true, 'two west and two south');
  assert.equal(runtime({ ports: new Set(['14,20']) }).rt.IsNearPort(3), false, 'four east: not');
  const lost = runtime({ nearest: { name: 'Daggerfall', way: 'north-west' } });
  assert.equal(lost.rt.useBoatDeed(deed, [deed]), false);
  assert.deepEqual(lost.mid.at(-1), ['There is no port nearby. The nearest port is Daggerfall, to the north-west', f(4)]);
  const bare = runtime();
  bare.rt.useBoatDeed(deed, [deed]);
  assert.deepEqual(bare.mid.at(-1), ['There is no port nearby', f(1.5)], 'a host that names none: the mod\'s own line');
});
