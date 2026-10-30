// AUDIT TAMRIEL-WIDE (2026-10-28; the owner: "I want to do an audit on anything that could be broken and ensure pur future
// development isnt just Daggerfall anymore and is the entirety of tamriel"). The findings fixed on the integrated head,
// each run on the real code past the Bay beside the Bay's own answer (bible/01-Overview/audits/Audit-Tamriel-Wide.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRaidHost } from '../../../src/scenes/raidHost.js';
import { raidRegionNow, setRaidingPartiesHost } from '../../../src/systems/raidingParties.js';
import { nearRoad } from '../../../src/world/road/roadBand.js';
import { pointNearPath, UNITS_PER_METRE } from '../../../src/world/road/roadClearance.js';
import { setArenaRoads, beyondKey } from '../../../src/world/arenaRoads.js';
import { E, W } from '../../../src/world/road/pathData.js';
import { sdRumor } from '../../../src/systems/superDungeon/sdOmen.js';
import { placeOfRow } from '../../../src/world/worldWide/worldPlaces.js';
import { createMapPlaces } from '../../../src/scenes/mapPlacesHost.js';
import { addPastBayPlaces, resetPastBayPlaces } from '../../../src/world/pastBayPlaces.js';
import { discoverLocation, snapshotDiscovery, restoreDiscovery } from '../../../src/systems/discovery.js';
import { pastBayStamp } from '../../../src/ui/tamrielInk.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { zonePortFree, teleportLanding } from '../../../src/systems/wild/zoneSafe.js';
import { buildWildMask } from '../../../src/systems/wild/wildZone.js';
import { locationWorldRect } from '../../../src/world/streamingWorld.js';
import { standingRace, figureLook } from '../../../src/characters/peopleBodies.js';
import { setFolkPlace } from '../../../src/characters/provinceFolk.js';
import { regionOfTheatre } from '../../../src/formats/mapsTables.js';
import { lotOfFrame, yardLot, yardWhyNot, YARD_MARGIN, createHomeYards } from '../../../src/scenes/homeYards.js';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle, townCellsApi } from '../../decorFakes.mjs';
import { offerDecorFigures } from '../../../src/scenes/decor/decorRoom.js';
import { lairPlaceId } from '../../../src/world/tamrielDungeons.js';
import { readFileSync } from 'node:fs';

test('AUDIT TAMRIEL-WIDE C1: the raid host names the region the player stands in past the Bay - a province\'s politic is its region\'s, as the Bay\'s is - and the sea none, on either side (mutant: the province\'s politic unread)', () => {
  const at = (pol, region, x = 2441, y = -600) => {
    createRaidHost({ maps: { getPoliticIndex: () => pol }, playerTravelPixel: () => ({ x, y }), etherSea: null, _questRegionIndex: () => region });
    return raidRegionNow();
  };
  try {
    assert.equal(at(128 + 64, 64), 64, 'Skyrim: its region, so its raids are told and its row is home');
    assert.equal(at(128 + 70, 70), 70, 'Cyrodiil');
    assert.equal(at(128 + 17, 17, 400, 200), 17, 'a Bay region, as before');
    assert.equal(at(128 + 105, 16, 400, 200), 16, 'the Wrothgarians\' bad politic, as before');
    assert.equal(at(64, 0, 400, 200), -1, 'the Bay\'s sea, as before');
    assert.equal(at(64, 0), -1, 'the sea past the Bay');
    assert.equal(at(128 + 71, 71), -1, 'no region past the provinces');
  } finally { setRaidingPartiesHost(null); }
});

test('AUDIT TAMRIEL-WIDE C2: ROADS-CLEAR past the Bay - a camp on a road there is near it, by the curves\' band, and one a pixel\'s quarter off is not; on the Bay the straight arms\' answer, unchanged (mutant: the Bay\'s clamp answers past it)', () => {
  const bay = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) };
  for (const x of [699, 700, 701]) bay.roads[187 * 1000 + x] = E | W;
  const roads = new Map([[beyondKey(2699, 187), E | W], [beyondKey(2700, 187), E | W], [beyondKey(2701, 187), E | W], [beyondKey(1688, -488), E | W]]);
  setArenaRoads({ roads, tracks: new Map(), join: new Map() });
  try {
    const mid = 16384, r = 10 * UNITS_PER_METRE;
    assert.equal(pointNearPath(bay, 700, 187, mid, mid, r), true, 'the Bay: on the road');
    assert.equal(nearRoad(bay, 700, 187, mid, mid, r), pointNearPath(bay, 700, 187, mid, mid, r), 'the Bay\'s answer is pointNearPath\'s');
    assert.equal(nearRoad(bay, 700, 187, mid, 4096, r), pointNearPath(bay, 700, 187, mid, 4096, r), 'off it too');
    assert.equal(pointNearPath(bay, 2700, 187, mid, mid, r), false, 'the Bay\'s walk never asks past its edge');
    assert.equal(nearRoad(bay, 2700, 187, mid, mid, r), true, 'Skyrim: a camp on the road is near it');
    assert.equal(nearRoad(bay, 1688, -488, mid, mid, r), true, 'and north of the Bay');
    assert.equal(nearRoad(bay, 2700, 187, mid, 4096, r), false, 'a quarter of a pixel off the road is clear');
    assert.equal(nearRoad(bay, 2900, 300, mid, mid, r), false, 'no road there');
    assert.equal(nearRoad(null, 2700, 187, mid, mid, r), false, 'nothing painted yet');
  } finally { setArenaRoads(null); }
});

test('AUDIT TAMRIEL-WIDE C4: a province\'s Hollow is rumoured in its own city\'s taverns - the registry place\'s pixel, not its MapId\'s low bits (0,0) - and the Bay\'s in Daggerfall, as before (mutant: the MapId read again)', () => {
  const now = 1_000_000, rec = { s: 7, ph: 'risen', until: now + 3_600_000, r: 64 };
  const ask = (memo, px, py) => sdRumor(rec, memo, now, { px, py }, { numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false }, { rolls: () => 0 });
  const city = placeOfRow({ px: 1500, py: -200, mapId: 0x30012345, name: 'Solitude', type: 0, w: 8, h: 8 }, 'audit');
  const memo = { s: 7, site: { s: 7, px: 1503, py: -198, city, cityName: 'Solitude', cityRegion: city.region, region: 64 } };
  assert.ok(ask(memo, 1500, -200), 'in Solitude: the rumour');
  assert.equal(ask(memo, 0, 0), null, 'nowhere else - the MapId\'s low bits named (0,0)');
  const bay = { s: 7, site: { city: { name: 'Daggerfall', regionIndex: 17, mapTableData: { mapId: (1 << 20) | (300 * 1000 + 200) } }, cityName: 'Daggerfall' } };
  assert.ok(ask(bay, 200, 300), 'the Bay\'s Hollow in Daggerfall');
  assert.equal(ask(bay, 201, 300), null, 'and only there');
});

test('AUDIT TAMRIEL-WIDE D2: the held map past the Bay inks a place known as the Overworld knows it - a village by its kind, a lair once found - and a find moves the tiles\' stamp, so the sheet paints it (mutants: the find unread; the stamp blind to a find)', () => {
  const was = snapshotDiscovery();
  resetPastBayPlaces();
  try {
    const lair = { x: 1592, y: -412, type: LOCATION_TYPES.DungeonLabyrinth }, village = { x: 1600, y: -410, type: LOCATION_TYPES.TownVillage };
    addPastBayPlaces([lair, village]);
    // AUDIT TAMRIEL-WIDE II W6: a real lair's id - keyed whole (discoveryKeyOf), as the province's lairs are
    const LAIR = lairPlaceId(4660);
    const ids = new Map([['1592,-412', LAIR], ['1600,-410', 0x30054321]]);
    const { knownPastBayIn } = createMapPlaces({ provinceQuestPlaces: { rowAt: (x, y) => (ids.has(`${x},${y}`) ? { mapId: ids.get(`${x},${y}`) } : null) } });
    const shown = () => knownPastBayIn(1580, -420, 1610, -400).map((p) => p.type).sort();
    assert.deepEqual(shown(), [LOCATION_TYPES.TownVillage], 'the village by its kind; the lair not yet found');
    const stamp = pastBayStamp(1580, -420, 1610, -400);
    discoverLocation(LAIR & 0xfffff, { name: 'its low 20 bits alone' });
    assert.deepEqual(shown(), [LOCATION_TYPES.TownVillage], 'an id of its low 20 bits alone found: the lair still not');
    discoverLocation(LAIR, { name: 'The Haunt of Baringon' });
    assert.deepEqual(shown(), [LOCATION_TYPES.TownVillage, LOCATION_TYPES.DungeonLabyrinth], 'found: inked');
    assert.notEqual(pastBayStamp(1580, -420, 1610, -400), stamp, 'and its tile painted again');
  } finally { resetPastBayPlaces(); restoreDiscovery(was); }
});

test('AUDIT TAMRIEL-WIDE E1: a teleport into the open zone lands in a settlement\'s streets - a Mark beside a village\'s walls, on its own pixel, is refused; one in its streets, a city pick and the leader\'s feet there are free; a ship with no body is no street (mutants: the landing unread; the pixel\'s settlement for the landing)', () => {
  const at = { x: 2400, y: -300 }, bay = { x: 300, y: 300 };
  const village = { name: 'V', mapTableData: { mapId: 5, locationType: LOCATION_TYPES.TownVillage }, exterior: { exteriorData: { blockNames: ['A', 'B', 'C', 'D'], width: 2, height: 2 } } };
  const zone = buildWildMask({ width: 100, height: 100, ox: at.x - 50, oy: at.y - 50, inZone: () => true });
  const locAt = (x, y) => (x === at.x && y === at.y ? village : null);
  const r = locationWorldRect(village, at.x, at.y), cz = (r.minZ + r.maxZ) / 2;
  const free = (landing) => zonePortFree(zone, bay, at, null, undefined, new Map(), locAt, landing);
  assert.equal(free(teleportLanding({ nativeX: (r.minX + r.maxX) / 2, nativeZ: cz })), true, 'a Recall to a Mark in its streets');
  assert.equal(free(teleportLanding({ nativeX: r.maxX + 2 * 4096, nativeZ: cz })), false, 'a Mark two blocks past its walls, on its pixel: the open country');
  assert.equal(free(teleportLanding({ x: (r.minX + r.maxX) / 2, y: 3, z: cz })), true, 'the leader\'s feet in its streets');
  assert.equal(free(teleportLanding({ x: r.maxX + 2 * 4096, y: 3, z: cz })), false, 'and outside them');
  assert.equal(free(undefined), true, 'a city pick (a guild\'s, a stone\'s) lands at the city: its pixel');
  assert.equal(free(null), false, 'a ship whose body is not stood');
  assert.equal(zonePortFree(zone, bay, bay, null, undefined, new Map(), locAt, null), true, 'outside the zone, as ever');
});

test('AUDIT TAMRIEL-WIDE E2: a person by a province\'s border is of the people where they stand, not where the player stood when they were first drawn - a Skyrim townsperson a Nord seen from High Rock\'s side; with no feet, the player\'s place as before (mutant: the feet unread)', () => {
  const player = { x: 1254, y: -256 };
  setFolkPlace((feet) => (feet ? { x: feet[0], y: feet[2] } : player), (x) => (x >= 1255 ? regionOfTheatre(3) : regionOfTheatre(1)));
  try {
    assert.equal(standingRace({ race: 1 }, null, [1300, 0, -256]), 'Nord', 'stood in Skyrim');
    assert.equal(standingRace({ race: 1 }, null, [1200, 0, -256]), 'Breton', 'stood in High Rock');
    assert.equal(standingRace({ race: 1 }, null), 'Breton', 'no feet: where the player stands');
    const flats = { getFlatData: () => ({ gender: '1', caption: 'merchant' }) };
    assert.equal(figureLook({ piece: { id: 'p1', flat: [182, 3] } }, { flats, race: 1 }, [1300, 0, -256])?.race, 'Nord', 'a figure the same');
    // AUDIT TAMRIEL-WIDE II W2: a figure an owner set in a yard, read where it stands as the street's are
    const yardFig = { piece: { id: 'p2', flat: [182, 3], pos: [100, 0, 0] }, o: [1200, 0, -256], batch: {} };
    offerDecorFigures([yardFig], { offer() {} }, true, { flats, race: 1 }, [0, 1.6, 0], 0);
    assert.equal(yardFig._mwLook?.race, 'Nord', 'a yard figure stood in Skyrim');
  } finally { setFolkPlace(null, null); }
  // AUDIT TAMRIEL-WIDE II W3: the host hands a townsperson's look its feet
  assert.match(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8'), /return personLook\(pn, staticNpcData\([^\n]*, dict\.get\(pn\.factionID\) \?\? null, feet\);/);
});

test('AUDIT TAMRIEL-WIDE A1: an Imperial City house\'s lot is never grown round its door - its frame is the door\'s - while a Bay house\'s lot is the one it was; the pixel\'s build marks a fabric house terraced (mutants: the mark unread; the host\'s mark dropped)', () => {   // PIN MOVED (IC-BACKYARD): "has no yard" - one with a court of its own has the court behind it (ic_backyard.test.js)
  const frame = { at: [10, 0, 10], box: [9, 0, 9, 11, 4, 11], rects: [[9, 9, 11, 11]] };
  assert.deepEqual(lotOfFrame(frame), yardLot(frame.at, frame.box, YARD_MARGIN, frame.rects), 'a house of Daggerfall\'s blocks: its lot as before');
  // PIN MOVED (AUDIT TAMRIEL-WIDE II W1): a terraced house's lot is its door's own box - no ground to place on, so what an
  // owner set down there before is still theirs to take back from the door. PIN MOVED (IC-BACKYARD): one with no court of
  // its own (here, no block named)
  const terraced = lotOfFrame({ ...frame, terraced: true });
  assert.deepEqual(terraced.lot, terraced.house, 'a terraced house: its lot the door\'s own box');
  for (let x = -10; x <= 10; x += 0.5) for (let z = -10; z <= 10; z += 0.5) assert.ok(yardWhyNot([x, 0, z], terraced), `nothing places at ${x},${z}`);
  const pb = readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(pb, /parts: \[\[cpu, local\]\], terraced: isFabricDoorId\(placed\.modelIdNum\), block: b\.blockName, record: placed\.recordIndex \}\);/, 'the frame marked by its door model');   // PIN MOVED (IC-BACKYARD): and its block and record
});

test('AUDIT TAMRIEL-WIDE II W1: a piece an owner set down by an Imperial City house before its lot shrank is drawn, and its owner at the door opens the decorator to take it back - as at a Bay house (mutant: a terraced house\'s lot none)', async () => {
  const piece = { id: 'yard1', model: 41000, flat: null, pos: [3, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 };
  const owner = { owner: 'Gwen', own: true, mine: true, character: 'r0123456789abcdef0123', hall: null, look: null };
  for (const terraced of [false, true]) {
    const homeFrames = new Map([[300, { at: [10, 0, 10], box: [9, 0, 9, 11, 4, 11], rects: [[9, 9, 11, 11]], terraced }]]);
    const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
    const api = {
      yardCells: townCellsApi(async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces: [piece] }] } })),
      place: async (b) => ({ ok: true, data: { piece: b.piece } }), move: async () => ({ ok: true, data: {} }), remove: async () => ({ ok: true, data: { piece, gold: 60 } }),
    };
    const feet = [13, 0, 10];   // by the door, on the piece
    const yards = createHomeYards({
      api, homes: { homeAt: (m, k) => (k === 300 ? owner : null), setLook: async () => ({ ok: true }) }, built: () => built, translation: () => [0, 0, 0],
      feet: () => feet, outside: () => true, eye: () => [feet[0], 1.6, feet[2]],
      collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: (o, d) => ({ dist: d[1] < 0 ? o[1] / -d[1] : Infinity, normal: [0, 1, 0] }) }),
      meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
      renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
      scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
      character: () => 'r0123456789abcdef0123', realm: () => null, wallet: () => ({ gold: 5000, pay() {}, credit() {} }), regionOf: () => 17,
      doc: fakeDoc(), win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
      say: () => {}, refusal: (w) => w, openSlot() {}, now: () => 0, look: { preview() {}, season: () => 0 },
    });
    const cam = { pos: [13, 1.6, 10], yaw: Math.PI, pitch: -0.6 };
    for (let i = 0; i < 3; i++) { yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); }
    assert.deepEqual(yards.yards()[0]?.pool.list().map((p) => p.id), ['yard1'], `terraced ${terraced}: the piece drawn`);
    assert.ok(yards.here(), `terraced ${terraced}: the owner's yard here`);
    assert.equal(yards.tool().openPanel?.(), true, `terraced ${terraced}: the decorator opens`);
  }
});
