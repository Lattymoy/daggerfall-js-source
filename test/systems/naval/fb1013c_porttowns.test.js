// FIELD BUGS 2026-10-13c (PORT-TOWNS) - the owner: "Even the port quests sending you to non port places".
//
// The harbourmaster's board (CAPT-BOARD) read Travel Options' port table as "every port of the map" (world.js
// navalPortList). That table is every place a ship may put in at: MAPS.BSA's 343 locations flagged PortTownAndUnknown
// and Hazelnut's 35 more - and on the real map 223 of its 378 are tombs, farms, inns, temples, manors, graveyards and
// ruins. A cargo was posted "to Corranoth's Tomb's harbourmaster". And the flag's 0x10 is the region capitals' mark,
// not a coast (its low four bits name the sides the sea lies on): 31 of the 39 capitals stand with no sea within six
// pixels, so a cargo went to a capital in the mountains no ship can lie at.
//
// Now: the board's ports are the TOWNS among the table's (portPlaces.js isPortTownType - the towns that stand the port's
// places), a cargo goes only to a port with the sea beside it (harbourBoard.js deliveryPort - fortLaw.js coastalAt), and a
// cargo already held for a place that is no such port is void, no regard lost, and said in the player's language.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor, deliveryPort, advance, takeContract } from '../../../src/systems/naval/harbourBoard.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { PORT_LOCATION_IDS, hasPort } from '../../../src/systems/travel/travelPorts.js';
import { isPortTownType, isPortTown, PORT_TOWN_TYPES } from '../../../src/systems/portPlaces.js';
import { openSeaOf, seaBears, portTownOnSea, SEA_RING, boardPortAt } from '../../../src/world/portSites.js';   // FIELD BUGS 2026-10-14 INLAND-PORTS; FB1020c BERTH-RING: the berth's ring
import { MapsFile, LOCATION_TYPES, getPixelFromPixelID } from '../../../src/formats/mapsFile.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { buildMapDict } from '../../../src/systems/map/mapDirectory.js';
import { isWaterPixel } from '../../../src/ui/overworldModel.js';
import { crownOf } from '../../../src/systems/naval/navalShips.js';

const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');

/** The host's port list and the port it says the captain lies at, lifted off world.js, over a map directory of the
 *  test's making (or the real one) - the crowns the naval table's own, no capitals, the Eltheric Ocean off. */
function hostPorts({ dict, maps, here = { x: 0, y: 0 }, openSea = () => true }) {
  const list = /\n {2}(let _navalPortList = null;\n {2}const navalPortList = \(\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  const near = /\n {2}(let _navalPortHereAt = null;\n {2}const navalPortHere = \(\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  assert.ok(list && near, 'the host\'s port list or its port-here moved');
  // PIN MOVED (FIELD BUGS 2026-10-14 INLAND-PORTS): the list asks the open sea too (seaBears over the host's openSea) -
  // all sea here unless a test hands its own; test/systems/naval/fb1014_inlandports.test.js asks it of a capital in the hills
  // eslint-disable-next-line no-new-func
  return new Function('mapDict', 'maps', 'PORT_LOCATION_IDS', 'isPortTownType', 'getPixelFromPixelID', 'navalCrownOf', 'navalCapitals',
    'playerTravelPixel', 'etherSea', 'inEther', 'etherPortNear', 'etherPortOf', 'seaBears', 'openSea', 'boardPortAt',
    `${list[1]}\n${near[1]}\nreturn { navalPortList, navalPortHere };`)(dict, maps, PORT_LOCATION_IDS, isPortTownType, getPixelFromPixelID, crownOf, () => [],
    () => here, false, () => false, () => null, () => null, seaBears, openSea, boardPortAt);   // PIN MOVED (FB1020c BERTH-RING): the port-here's ring is SEA_RING; PIN MOVED (FIELD BUGS 2026-10-21b VOYAGE-HOLD): the port law's boardPortAt holds it
}

/** Eight of Travel Options' harbours, each given a kind of place: three towns, five that are no port of anyone's. */
const KINDS = [
  ['A City', LOCATION_TYPES.TownCity], ['A Hamlet', LOCATION_TYPES.TownHamlet], ['A Village', LOCATION_TYPES.TownVillage],
  ['Corranoth\'s Tomb', LOCATION_TYPES.DungeonLabyrinth], ['A Farmstead', LOCATION_TYPES.HomeFarms], ['An Inn', LOCATION_TYPES.Tavern],
  ['A Temple', LOCATION_TYPES.ReligionTemple], ['A Graveyard', LOCATION_TYPES.Graveyard],
];
const IDS = [...new Set(PORT_LOCATION_IDS)].slice(0, KINDS.length);
const fakeMap = () => ({
  dict: new Map(IDS.map((id, i) => [id, { id, mapID: id, regionIndex: 0, mapIndex: i, locationType: KINDS[i][1] }])),
  maps: { getRegion: () => ({ mapNames: KINDS.map((k) => k[0]) }) },
});

test('PORT-TOWNS: the board\'s ports are the TOWNS among Travel Options\' harbours - no tomb, farm, inn, temple or graveyard is a port with a harbourmaster, and none is the port a captain lies at (mutants: every harbour a port, a tomb a town)', () => {
  assert.deepEqual(PORT_TOWN_TYPES, [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
  assert.deepEqual(Object.values(LOCATION_TYPES).filter((t) => isPortTownType(t)), [0, 1, 2], 'a city, a town or a village - nothing else');
  const { dict, maps } = fakeMap();
  const { navalPortList } = hostPorts({ dict, maps });
  const list = navalPortList();
  assert.deepEqual(list.map((p) => p.name), ['A City', 'A Hamlet', 'A Village']);
  for (const p of list) {
    const at = getPixelFromPixelID(IDS[KINDS.findIndex((k) => k[0] === p.name)]);
    assert.deepEqual([p.key, p.px, p.py, p.region, typeof p.crown], [`${at.x},${at.y}`, at.x, at.y, 0, 'string'], 'its pixel, its region, its crown');
  }
  assert.equal(navalPortList(), list, 'found once');
  // lying at the tomb's pixel there is no harbourmaster; at the city's, the city's
  const tomb = getPixelFromPixelID(IDS[3]), city = getPixelFromPixelID(IDS[0]);
  assert.equal(hostPorts({ dict, maps, here: tomb }).navalPortHere(), null, 'no board at a tomb');
  assert.equal(hostPorts({ dict, maps, here: { x: city.x + 1, y: city.y - 1 } }).navalPortHere()?.name, 'A City', 'a pixel off the city, the city\'s');
});

// the sea lies south of row 100 (map y runs south)
const seaAt = (x, y) => y >= 101;
const HOME = { key: '100,100', name: 'Home', px: 100, py: 100, region: 23, crown: 'Wayrest' };
const COAST = { key: '120,100', name: 'Coast Town', px: 120, py: 100, region: 23, crown: 'Wayrest' };
const TWO_OFF = { key: '110,99', name: 'Daggerfall', px: 110, py: 99, region: 17, crown: 'Daggerfall' };   // the sea two pixels off it
const THREE_OFF = { key: '112,98', name: 'Tulune', px: 112, py: 98, region: 17, crown: 'Daggerfall' };   // FB1020c BERTH-RING: three off it
const INLAND = { key: '90,80', name: 'Wrothgaria', px: 90, py: 80, region: 16, crown: 'Wayrest' };

// PIN MOVED (FB1020c BERTH-RING): a port the sea bears on within SEA_RING takes a cargo - the berth names a port within it
// now (scenes/world.js navalPortHere) - so a capital two pixels off the sea does; three off, none
test('PORT-TOWNS: a cargo goes only to a port the sea bears on - its own pixel or one within SEA_RING of it, never a town three pixels off the sea or in the mountains; a board with no such port far enough posts no cargo (mutants: the sea not asked, the sea anywhere; FB1020c: the ring a pixel)', () => {
  assert.equal(SEA_RING, 2);
  assert.equal(deliveryPort({ px: 5, py: 5 }, (x, y) => x === 5 && y === 5), true, 'its own pixel');
  assert.equal(deliveryPort({ px: 5, py: 5 }, (x, y) => x === 6 && y === 6), true, 'a corner of the eight');
  assert.equal(deliveryPort({ px: 5, py: 5 }, (x, y) => x === 7 && y === 5), true, 'the sea two pixels off - SEA_RING\'s');
  assert.equal(deliveryPort({ px: 5, py: 5 }, (x, y) => x === 3 && y === 3), true, 'the ring\'s corner');
  assert.equal(deliveryPort({ px: 5, py: 5 }, (x, y) => x === 8 && y === 5), false, 'three off');
  assert.equal(deliveryPort({ px: 5, py: 5 }, null), false, 'no sea law, no port');
  assert.equal(deliveryPort(null, seaAt), false);
  assert.deepEqual([HOME, COAST, TWO_OFF, THREE_OFF, INLAND].map((p) => deliveryPort(p, seaAt)), [true, true, true, false, false]);
  const to = new Set();
  let cargoes = 0;
  for (let day = 0; day < 300; day++) {
    for (const o of boardFor({ port: HOME, crown: 'Wayrest', day, level: 5, ports: [HOME, COAST, TWO_OFF, THREE_OFF, INLAND], seaAt })) {
      if (o.kind !== 'delivery') continue;
      cargoes++;
      to.add(o.to.key);
      assert.match(o.words, /^.+, to (Coast Town|Daggerfall)'s harbormaster within \d+ days\./);
    }
  }
  assert.ok(cargoes > 20, `cargoes were posted (${cargoes})`);
  assert.deepEqual([...to].sort(), [COAST.key, TWO_OFF.key].sort(), 'every cargo for a port the sea bears on');
  let none = 0;
  for (let day = 0; day < 300; day++) none += boardFor({ port: HOME, crown: 'Wayrest', day, level: 5, ports: [HOME, THREE_OFF, INLAND], seaAt }).filter((o) => o.kind === 'delivery').length;
  assert.equal(none, 0, 'no port on the sea far enough: no cargo');
});

/** A cargo taken off a board, for `to`, in boat 7's hold. */
const cargo = (to, i) => takeContract({ id: `100,100:3:${i}`, kind: 'delivery', crown: 'Wayrest', port: HOME, title: `Cargo for ${to.name}`, words: '', pay: 140, standing: 4, days: 5, to, cargo: 'crates of glassware' }, { now: 0, boat: 7 });
const TOMB = { key: '121,101', name: 'Corranoth\'s Tomb', px: 121, py: 101 };   // on the sea - but no port of the board's

test('PORT-TOWNS: a held cargo for a place that is no port a cargo goes to - not among the map\'s ports, or with no sea beside it - is void, no regard lost, and said; asked only once the map\'s ports and the sea stand (mutants: never void, every cargo void, the list not asked, the sea not asked, an empty list voids all, said as a bounty)', () => {
  const kept = cargo(COAST, 0);
  assert.equal(advance({ ...kept }, { type: 'unported', port: COAST.key }), 'void');
  assert.equal(advance({ ...kept }, { type: 'unported', port: INLAND.key }), null, 'another port\'s word is not hers');
  assert.equal(advance({ kind: 'bounty', id: 'b' }, { type: 'unported', port: 'b' }), null);
  assert.equal(advance({ kind: 'hunt', crown: 'Wayrest', need: 2 }, { type: 'unported', port: COAST.key }), null);

  const ledger = createCaptainLedger();
  for (const [i, to] of [COAST, INLAND, TOMB].entries()) assert.equal(ledger.holdContract(cargo(to, i)), true);
  const mid = [];
  let ports = [];
  const office = (sea) => createHarbourOffice({ ledger, now: () => 0, day: () => 3, level: () => 5, gold: () => 0, mid: (t) => mid.push(t), say: () => {}, port: () => HOME, ports: () => ports, seaAt: sea });
  office(seaAt).tick();
  assert.equal(ledger.contracts().length, 3, 'the map\'s ports not yet standing: nothing void');
  ports = [HOME, COAST, TWO_OFF, INLAND];
  office(null).tick();
  assert.equal(ledger.contracts().length, 3, 'no sea law: nothing void');
  const before = ledger.standing('Wayrest');
  office(seaAt).tick();
  assert.deepEqual(ledger.contracts().map((c) => c.to.key), [COAST.key], 'the cargo for the port on the sea held');
  assert.equal(ledger.standing('Wayrest'), before, 'no regard lost');
  assert.deepEqual(mid, ['Contract void - Cargo for Wrothgaria. No ship can make port there.', 'Contract void - Cargo for Corranoth\'s Tomb. No ship can make port there.']);
  office(seaAt).tick();
  assert.equal(mid.length, 2, 'said once');
});

test('PORT-TOWNS: the void is said in the player\'s language - the text core\'s row, read when it is said (mutant: the words English always)', async () => {
  const tm = await import('../../../src/systems/textManager.js');
  const rows = tm.loadStringTableCsv(readFileSync(new URL('../../../locales/fr/Port_Strings.csv', import.meta.url), 'utf8'));
  const fr = new Map(rows).get('sea.board.cargoVoid');
  assert.ok(fr && fr.includes('{title}'), 'the French row carries its title');
  tm.patchLocaleTable('fr', 'Port_Strings', rows);
  const ledger = createCaptainLedger();
  ledger.holdContract(cargo(INLAND, 0));
  const mid = [];
  try {
    tm.setLocale('fr');
    createHarbourOffice({ ledger, now: () => 0, mid: (t) => mid.push(t), ports: () => [HOME, INLAND], seaAt }).tick();
  } finally {
    tm.setLocale('en');
  }
  assert.deepEqual(mid, [fr.replace('{title}', 'Cargo for Wrothgaria')]);
});

test('PORT-TOWNS: the world hands the harbour office its port list and the sea it sets its sites by', () => {
  // PIN MOVED (FIELD BUGS 2026-10-14 INLAND-PORTS, Mac: "Fix harbour seaAt too"): the sea it sets its sites by is the open
  // sea (world.js openSea - B10's edge its own; run by test/systems/naval/fb1014_inlandports.test.js)
  assert.match(W, /\n {4}ports: \(\) => navalPortList\(\),\n {4}seaAt: openSea, {3}\/\//);
});

// ─── THE REAL MAP ────────────────────────────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAS_ARENA2 = !!ARENA2 && existsSync(ARENA2);

test('PORT-TOWNS (ARENA2): on the real map - 378 harbours on Travel Options\' table, 155 of them towns, 106 of those on the open sea the board\'s ports (INLAND-PORTS), each the shipyard law\'s port town and every one of those on the table among them; every one takes a cargo (FB1020c BERTH-RING: the sea within SEA_RING); the flag\'s low four bits name sides the sea lies on and 0x10 is the capitals\' mark, 31 of them inland', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const maps = new MapsFile();
  assert.equal(maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK')))), true);
  maps.autoDiscard = false;
  const woods = new WoodsFile();
  assert.equal(woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD')))), true);
  const dict = buildMapDict(maps);
  const sea = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y));   // the world's seaAt, the Bay's map
  // PIN MOVED (FIELD BUGS 2026-10-14 INLAND-PORTS): the board's ports and the shipyard law's towns are the ones the open
  // sea bears on - 155 towns on the table, 106 of them on the open sea (test/systems/naval/fb1014_inlandports.test.js names the 49)
  const mask = openSeaOf(sea, 1000, 500), openSea = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && mask[y * 1000 + x] === 1;
  assert.equal(hostPorts({ dict, maps }).navalPortList().length, 155, 'the towns among them, the sea not asked');
  const list = hostPorts({ dict, maps, openSea }).navalPortList();
  const listed = new Set(list.map((p) => p.key));
  const harbours = [...new Set(PORT_LOCATION_IDS)].map((id) => dict.get(id)).filter(Boolean);
  assert.equal(harbours.length, 378);
  assert.equal(list.length, 106, 'the towns among them on the open sea');
  for (const s of harbours) {
    const at = getPixelFromPixelID(s.id), loc = maps.getLocation(s.regionIndex, s.mapIndex);
    assert.equal(listed.has(`${at.x},${at.y}`), isPortTown(loc, portTownOnSea(loc, hasPort, openSea)), `${loc.name}: the board's port iff the shipyard law's port town`);
  }
  const nonTowns = harbours.filter((s) => !isPortTownType(s.locationType));
  assert.equal(nonTowns.length, 223, 'tombs, farms, inns, temples, manors, graveyards and ruins');
  const tomb = nonTowns.find((s) => maps.getRegion(s.regionIndex).mapNames[s.mapIndex] === 'Corranoth\'s Tomb');
  assert.equal(tomb?.locationType, LOCATION_TYPES.DungeonLabyrinth, 'the report\'s kind of place: on the table, no port of the board\'s');
  assert.equal(listed.has(`${getPixelFromPixelID(tomb.id).x},${getPixelFromPixelID(tomb.id).y}`), false);
  const cargoPorts = list.filter((p) => deliveryPort(p, sea));
  assert.equal(cargoPorts.length, 106, 'PIN MOVED (INLAND-PORTS): 113 less the twelve by a lake inland; PIN MOVED (FB1020c BERTH-RING): every board port, the sea within SEA_RING of each');
  const capitals = [...dict.values()].filter((s) => (maps.getLocation(s.regionIndex, s.mapIndex).exterior.exteriorData.portTownAndUnknown ?? 0) === 0x10);
  assert.equal(capitals.length, 39);
  assert.ok(capitals.every((s) => s.locationType === LOCATION_TYPES.TownCity), 'the capitals\' mark is a city\'s');
  const ringOf = (x, y) => { for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && sea(x + dx, y + dy)) return r; return Infinity; };
  assert.equal(capitals.filter((s) => { const p = getPixelFromPixelID(s.id); return ringOf(p.x, p.y) === Infinity; }).length, 31, 'no sea within six pixels');
  const named = (n) => list.find((p) => p.name === n);
  assert.deepEqual(['Daggerfall', 'Sentinel', 'Wayrest', 'Wrothgaria'].map((n) => [!!named(n), deliveryPort(named(n), sea)]), [[true, true], [true, true], [true, true], [false, false]], 'PIN MOVED (FB1020c BERTH-RING): the crowns\' capitals two pixels off the sea take a cargo now - a berth names them within SEA_RING (INLAND-PORTS: and a capital in the mountains is no port of the board\'s)');
  let flagged = 0;
  for (const s of dict.values()) {
    const v = (maps.getLocation(s.regionIndex, s.mapIndex).exterior.exteriorData.portTownAndUnknown ?? 0) & 0x0f;
    if (!v) continue;
    flagged++;
    const p = getPixelFromPixelID(s.id);
    const sides = (sea(p.x + 1, p.y) ? 1 : 0) | (sea(p.x, p.y + 1) ? 2 : 0) | (sea(p.x - 1, p.y) ? 4 : 0) | (sea(p.x, p.y - 1) ? 8 : 0);
    assert.equal(v & sides, v, `${maps.getRegion(s.regionIndex).mapNames[s.mapIndex]}: the sea on every side its bits name (east 1, south 2, west 4, north 8)`);
  }
  assert.equal(flagged, 304);
});
