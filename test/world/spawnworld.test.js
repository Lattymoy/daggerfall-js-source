// SPAWN-WORLD (2026-10-26, bible/06-Systems/Systems-Arc.md SPAWN-WORLD; the audit NO SYSTEM LEFT BEHIND IN THE BAY item 25,
// A3): online, past the Bay only TESA8's lairs stood (some 1-2% of the land, none of them Elite), where on the Bay about 29%
// of empty land stands a spawned dungeon of the world roll, a quarter of them Elite. The owner's call taken ("Every single
// thing here needs to be addressed. No exceptions.", 2026-10-26): the spawns and their Elite tier past the Bay as on the
// Bay - the same roll, density, gates, clocks and tier - never on a place, their map ids in a world lane like the halls' (in DFU's 12 bits - the halls' high 4 bits are the Abyss Dungeons' salts' too).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CLIMATES } from '../../src/formats/mapsTables.js';
import { createSpawnGroundPlace } from '../../src/world/spawnGroundPlace.js';
import { SETTLEMENT_ROWS, settlementOnPixel } from '../../src/world/settlement/settlementPlaces.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import {
  spawnsDungeon, spawnedMapId, synthesizeDungeonLocation, isEliteSpawn, pickTemplate, pathFreePixel, createSpawnLedger,
  WORLD_SALT, ELITE_NAME_PREFIX, GENERAL_TTL_MINUTES,
} from '../../src/world/spawnedDungeons.js';
import { worldLaneMapId, worldLaneOf, isWorldLaneMapId, worldLanePixel, ABYSS_WORLD_LANE, SPAWN_WORLD_LANE, WORLD_LANE_RUN } from '../../src/world/worldWide/worldLanes.js';
import { WORLD_PIXEL_SPAN } from '../../src/world/worldWide/worldGrid.js';
import { setArenaRoads, beyondKey } from '../../src/world/arenaRoads.js';
import { spawnedHallMapId, isHallMapId, WORLD_PIXEL_BOUND, isWorldRoom, wdunHallOfRoom, seaRoomOf, owWireRow, validOwIn, validOwOut, worldRoom, OW_WORLD_RELAY_MIN, relaySupportsOwWorld, roomOf } from '../../src/net/wire.js';
import { owRowSane, owRowFits, owRowInCell, owSpawnsDungeon } from '../../src/net/overworldLaw.js';
import { instanceRoomOf, instanceOf } from '../../src/net/instanceRoom.js';
import { roomKeyFor } from '../../src/net/online.js';
import { discoverLocation, hasDiscoveredLocationId, restoreDiscovery, snapshotDiscovery, discoveryKeyOf } from '../../src/systems/discovery.js';
import { hasDock, nearDock, DOCK_PIXEL_IDS } from '../../src/systems/immersiveTravel.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A one-block dungeon, the shape spawnTemplates admits. */
const TEMPLATE = Object.freeze({
  name: 'Old Crypt', regionIndex: 17, regionName: 'Daggerfall', hasDungeon: true,
  mapTableData: { mapId: 0x00123456, locationType: 10 },
  exterior: { exteriorData: { width: 1, height: 1, locationId: 0x123456 } },
  dungeon: { blocks: [{ blockName: 'B0000001.RDB' }], recordElement: { header: { locationId: 0x123456 } } },
});
/** The host's clone (scenes/spawnGroundHost.js _spawnCloneAt) on the real producer. */
const cloneAt = (px, py) => synthesizeDungeonLocation(pickTemplate([TEMPLATE], WORLD_SALT, px, py), { salt: WORLD_SALT, px, py, where: { regionIndex: 64 }, elite: isEliteSpawn(WORLD_SALT, px, py) });
const rolledAt = (x0, y, wanted = true, elite = null) => { for (let x = x0; ; x++) if (spawnsDungeon(WORLD_SALT, x, y) === wanted && (elite === null || isEliteSpawn(WORLD_SALT, x, y) === elite)) return [x, y]; };
const law = (o = {}) => createSpawnGroundPlace({
  maps: { getClimateIndex: () => CLIMATES.Woodlands }, online: true, etherSea: false, plateauDry: () => true,
  terrainGen: { roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) }) }, cloneAt, spawnGone: () => false, zoneMask: () => null, ...o,
});

test('SPAWN-WORLD the lanes (world/worldWide/worldLanes.js): a world pixel\'s key over a run of DFU\'s 12-bit lanes, under the port\'s own 0x80000 - every id unique per pixel and lane, and none of any other lane\'s: MAPS.BSA\'s, a Bay spawn\'s, the Abyss Dungeons\', the Bay\'s abyss, Arena\'s, the isles\', the countryside\'s, the halls\' (mutants: a lane\'s number, the flag, the run)', () => {
  assert.equal(WORLD_PIXEL_SPAN, WORLD_PIXEL_BOUND);
  assert.deepEqual([SPAWN_WORLD_LANE, ABYSS_WORLD_LANE, WORLD_LANE_RUN], [0x380, 0x600, 512]);
  for (const [x, y] of [[0, 0], [1400, -300], [-8191, -8191], [8191, 8191], [-8191, 8191], [8191, -8191], [2215, -371], [-1, 500]]) {
    for (const lane of [ABYSS_WORLD_LANE, SPAWN_WORLD_LANE]) {
      const id = worldLaneMapId(lane, x, y), high = id >>> 20;
      assert.deepEqual([worldLaneOf(id), worldLanePixel(id)], [lane, [x, y]], `${lane.toString(16)} ${x},${y}`);
      assert.ok(high >= lane && high < lane + WORLD_LANE_RUN && (id & 0xfffff) >= 0x80000, 'its run, and its low bits 500,000 and up (TESA II P6)');
      assert.ok(id >= 0 && id <= 0xffffffff && isWorldRoom(`dungeon:m${id}`), 'an unsigned 32-bit room the relay keeps');
      assert.equal(isHallMapId(id), false, 'no hall');
    }
    assert.ok(worldLaneMapId(SPAWN_WORLD_LANE, x, y) < 0x60000000, 'a spawn under the abyss\'s 0x600');
    const abyss = worldLaneMapId(ABYSS_WORLD_LANE, x, y);
    assert.ok(abyss >= 0x60000000 && abyss < 0x80000000, 'an abyss in the abyss\'s own range (0x600 to 0x7ff), where its readers know it');
  }
  // every other lane's id, whatever its pixel: MAPS.BSA's (high 12 to 0x728, a Bay pixel low), the Bay's spawns (salt 1)
  // and the Abyss Dungeons\' (2049..4095), the Bay's abyss (0x600), Arena's (0xa7) and the isles\' (0xe7, 0xe8) over 500,000
  // and up, the countryside's, a lair's and a capital's (0x300..0x341, 0x80000), a hall's (0xf...)
  const others = [0, 1, (0x728 << 20) | 499999, 0x7283288c, (0x400 << 20) | 499999, (0x57f << 20) | 499999, (0x7ff << 20) | 499999, spawnedMapId(1, 999, 499), spawnedMapId(2049, 0, 0), spawnedMapId(4095, 999, 499),
    (0x60000000 | 499999) >>> 0, ((0xa7 << 20) | 500000 + 431) >>> 0, ((0xe7 << 20) | 902193) >>> 0, ((0xe8 << 20) | 902193) >>> 0,
    ((0x33f << 20) | 0xfffff) >>> 0, ((0x340 << 20) | 0xfffff) >>> 0, ((0x341 << 20) | 0x80000 | 21) >>> 0, spawnedHallMapId(2215, -371), spawnedHallMapId(-8192, -8192), -1, 2 ** 32, 0.5];
  for (const id of others) assert.deepEqual([isWorldLaneMapId(id), worldLaneOf(id), worldLanePixel(id)], [false, -1, null], String(id));
  assert.throws(() => worldLaneMapId(0x381, 0, 0), RangeError);
  assert.throws(() => worldLaneMapId(SPAWN_WORLD_LANE, 8192, 0), RangeError);
  const seen = new Set();
  for (let y = -3; y <= 3; y++) for (let x = 997; x <= 1003; x++) seen.add(spawnedMapId(WORLD_SALT, x, y + 500));
  assert.equal(seen.size, 49, 'every pixel its own id across the Bay\'s edge');
  const lanes = new Set();
  for (const [x, y] of [[-8191, -8191], [8191, 8191], [0, -1], [-1, 0]]) for (const lane of [SPAWN_WORLD_LANE, ABYSS_WORLD_LANE]) lanes.add(worldLaneMapId(lane, x, y));
  assert.equal(lanes.size, 8, 'and every lane its own');
});

test('SPAWN-WORLD the spawn law past the Bay (world/spawnGroundPlace.js): the same roll and Elite tier as the Bay\'s, cloned under the spawn lane - never on a place, past the Veil, in the open zone or on a road past the Bay (TESA\'s layer) (mutants: the place gate, the zone and the Veil in spawnAt, the roads past the Bay)', () => {
  const [sx, sy] = rolledAt(2200, -371, true, false), [ex, ey] = rolledAt(2200, -371, true, true);
  const plain = law().spawnAt(sx, sy), elite = law().spawnAt(ex, ey);
  assert.deepEqual([plain.mapTableData.mapId, plain.spawned, plain.elite, plain.name], [worldLaneMapId(SPAWN_WORLD_LANE, sx, sy), true, false, `Old Crypt (${sx},${sy})`]);
  assert.deepEqual([elite.elite, elite.name], [true, `${ELITE_NAME_PREFIX}Old Crypt (${ex},${ey})`], 'the Elite tier past the Bay, by the same roll');
  assert.equal(law({ placeAt: (x, y) => x === sx && y === sy }).spawnAt(sx, sy), null, 'a place past the Bay stands first');
  const r0 = SETTLEMENT_ROWS[0];   // a fit that sets a settlement on the rolled pixel: the roll never takes it, nor shapes its ground
  setTamrielFit({ ox: r0.at[0] * 18.75 - (sx + 0.5), oy: r0.at[1] * 18.75 - (sy + 0.5), ppu: 18.75 });
  try {
    assert.equal(settlementOnPixel(sx, sy), r0);
    assert.deepEqual([law().spawnAt(sx, sy), law().groundLocationAt(sx, sy, null)], [null, null], 'a settlement past the Bay stands first');
  } finally { setTamrielFit(null); }
  const [bx, by] = rolledAt(500, 250);
  assert.equal(law({ placeAt: () => true }).spawnAt(bx, by).mapTableData.mapId, spawnedMapId(WORLD_SALT, bx, by), 'on the Bay the places are the index\'s (`stood`) - the gate is past the Bay\'s alone, and the Bay\'s id its own');
  // the Eltheric Ocean's box past the Veil: its isles stand their own places
  const veil = law({ etherSea: true });
  const [vx, vy] = rolledAt(1000, -5000);
  assert.equal(veil.spawnAt(vx, vy), null, 'past the Veil: none, as the ground\'s place says');
  assert.ok(law().spawnAt(vx, vy), 'with no Eltheric Ocean that box is land like any');
  // the roads past the Bay are TESA's layer, its roads and tracks: no ruin on one
  try {
    setArenaRoads({ roads: new Map([[beyondKey(sx, sy), 0x88]]), tracks: new Map([[beyondKey(ex, ey), 0x20]]) });
    assert.deepEqual([pathFreePixel(null, sx, sy), pathFreePixel(null, ex, ey), pathFreePixel(null, sx + 1, sy)], [false, false, true]);
    assert.deepEqual([law().spawnAt(sx, sy), law().spawnAt(ex, ey)], [null, null], 'a road past the Bay, a track past the Bay: none');
    assert.ok(law().spawnAt(...rolledAt(sx + 1, sy)), 'beside them: the spawn');
    const crossed = { roads: new Uint8Array(1000 * 500).fill(1), tracks: new Uint8Array(1000 * 500) };
    assert.equal(pathFreePixel(crossed, 10, 10), false, 'the Bay\'s own arrays on the Bay, as before');
    assert.equal(pathFreePixel(crossed, sx + 1, sy), true, 'and never read past it');
  } finally { setArenaRoads(null); }
});

test('SPAWN-WORLD the open zone in the spawn law: a spawn the Overworld\'s far reads ask for (tvSpawnAt, tvLocationAt) never stands in Cyrodiil\'s halls\' zone, as the ground never shaped one there (mutant: the zone asked by the ground alone)', async () => {
  const { buildWildMask, wildInside } = await import('../../src/systems/wild/wildZone.js');
  const mask = buildWildMask({ width: 1000, height: 500, inZone: () => true });
  let zoned = null;
  for (let y = 0; y < 500 && !zoned; y++) for (let x = 0; x < 1000 && !zoned; x++) if (wildInside(mask, x, y) && spawnsDungeon(WORLD_SALT, x, y)) zoned = [x, y];
  assert.ok(zoned);
  assert.ok(law().spawnAt(...zoned), 'no zone: the roll stands');
  assert.equal(law({ zoneMask: () => mask }).spawnAt(...zoned), null, 'in the zone: only a hall stands');
});

/** The stand as the host has it (scenes/spawnStandHost.js), lifted and run over fakes. */
function stand({ places = new Set(), online = true } = {}) {
  const src = rd('src/scenes/spawnStandHost.js');
  const lift = (head, close) => { const i = src.indexOf(head); assert.ok(i > 0, head); return src.slice(i, src.indexOf(close, i) + close.length); };
  const d = { index: new Map(), ledger: createSpawnLedger(), now: 0, inside: null, gen: 0, roads: { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) } };
  // the spawn asks a settlement's pixel first - the real one, handed in
  const make = new Function('d', 'places', 'online', 'cloneAt', 'pathFreePixel', 'spawnsDungeon', 'CLIMATES', 'settlementOnPixel', `
    const params = { has: (k) => k === 'online' && online }, _spawnSalt = 1, maps = { getClimateIndex: () => 231 }, _spawnGround = () => true;
    const terrainGen = { roads: () => d.roads }, _spawnUnroaded = new Set(), _spawnLedger = d.ledger, _insideSpawn = (k) => k === d.inside, locationIndex = d.index;
    const cyrodiilMask = () => null, wildInside = () => false, zoneHalls = { standOf: () => null, standIn: () => null };
    const etherSea = false, inEther = () => false, etherPlaceAt = () => null, onTheBay = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500;
    const _arenaTemplates = {}, _countryTemplates = {}, _capitalBase = {};
    const farm = { name: 'The Ulfgar Farmstead', country: { type: 0 } };
    const host = { get _locIndexGen() { return d.gen; }, set _locIndexGen(v) { d.gen = v; }, _spawnClock: () => d.now, _spawnCloneAt: cloneAt,
      capitalLocationAt: () => null, arenaLocationAt: () => null, countryLocationAt: (x, y) => (places.has(x + ',' + y) ? farm : null), lairLocationAt: () => null,
      provinceQuestPlaces: { placeOnPixel: (x, y) => places.has(x + ',' + y) } };
    ${lift('  const spawnedDungeonAt = (px, py) => {', '\n  };\n')}
    ${lift('  function _locationToBuild(px, py) {', '\n  }\n')}
    ${lift('  function spawnPastBayAt(px, py) {', '\n  }\n')}
    return { _locationToBuild, spawnedDungeonAt };`);
  return { d, ...make(d, places, online, cloneAt, pathFreePixel, spawnsDungeon, CLIMATES, settlementOnPixel) };
}

test('SPAWN-WORLD the stand past the Bay (scenes/spawnStandHost.js, run): online the spawner stands last, after every place; kept in the index; its clocks the Bay\'s (gone past its time, never while the player is in it); a road landing on a provisional one takes it back - the index and its clocks; offline none (mutants: the spawner\'s tail, the clocks past the Bay, the roads\' take-back, the place gate)', () => {
  const [sx, sy] = rolledAt(2200, -371);
  const key = `${sx},${sy}`;
  let h = stand({ places: new Set([key]) });
  assert.equal(h._locationToBuild(sx, sy).name, 'The Ulfgar Farmstead', 'a place stands first');
  assert.equal(h.spawnedDungeonAt(sx, sy), null, 'and the spawner itself never stands on one');
  assert.equal(h.d.index.size, 0);
  h = stand();
  const loc = h._locationToBuild(sx, sy);
  assert.deepEqual([loc.spawned, loc.mapTableData.mapId, h.d.index.get(key)], [true, worldLaneMapId(SPAWN_WORLD_LANE, sx, sy), loc], 'no place: the spawn, stood in the index');
  assert.equal(h._locationToBuild(sx, sy), loc, 'the one it holds, again');
  assert.equal(h._locationToBuild(...rolledAt(2200, -371, false)), null, 'a pixel the roll stands none on');
  // the clocks
  h.d.ledger.note(key, 0);
  h.d.now = GENERAL_TTL_MINUTES;
  h.d.inside = key;
  assert.equal(h._locationToBuild(sx, sy), loc, 'never while the player is in it (TTL1)');
  h.d.inside = null;
  const gen = h.d.gen;
  assert.equal(h._locationToBuild(sx, sy), null, 'past its time: its pixel empty');
  assert.deepEqual([h.d.index.has(key), h.d.ledger.size, h.d.gen > gen], [false, 1, true], 'out of the index, its row kept (AUDIT OW5b D2), the index\'s generation moved');
  // the roads past the Bay landing on one stood before them
  h = stand();
  const again = h._locationToBuild(sx, sy);
  h.d.ledger.note(key, 0);
  try {
    setArenaRoads({ roads: new Map([[beyondKey(sx, sy), 0x81]]), tracks: new Map() });
    assert.equal(h._locationToBuild(sx, sy), null, 'a road past the Bay landed on it: taken back');
    assert.deepEqual([h.d.index.has(key), h.d.ledger.size], [false, 0], 'its index entry and its clocks (SPAWN-ROADS\' take-back)');
    h.d.index.set(key, again);
    h.d.inside = key;
    assert.equal(h._locationToBuild(sx, sy), again, 'never while the player stands in it');
  } finally { setArenaRoads(null); }
  assert.equal(stand({ online: false })._locationToBuild(sx, sy), null, 'offline the land past the Bay stands no spawn');
});

test('SPAWN-WORLD the clocks on the wire: a spawn past the Bay\'s row is its cell\'s - the ledger says it, the relay\'s law reads it (the roll its own copy, the cell its square), a client says it to the relay that reads it alone (mutants: the ledger\'s spelling, the relay\'s bound, the client\'s gate)', () => {
  const [sx, sy] = rolledAt(2200, -371);
  const L = createSpawnLedger();
  L.note(`${sx},${sy}`, 100);
  L.clear(`${sx},${sy}`, 150);
  assert.deepEqual(L.wireRow(`${sx},${sy}`), [sx, sy, 100, 150], 'the row past the Bay');
  L.note('0050,7', 1);
  assert.equal(L.wireRow('0050,7'), null, 'one spelling of a pixel alone');
  L.note('9000,1', 1);
  assert.equal(L.wireRow('9000,1'), null, 'and none off the world\'s grid');
  assert.equal(owSpawnsDungeon(sx, sy), true, 'the relay\'s copy of the roll agrees past the Bay');
  // pixel for pixel, either side of the Bay's corner and far out in each direction (the copy's hash takes a negative whole)
  for (const [x0, y0] of [[2200, -380], [-860, 1200], [4900, 2700], [-40, -40]]) {
    for (let y = y0; y < y0 + 40; y++) for (let x = x0; x < x0 + 40; x++) if (owSpawnsDungeon(x, y) !== spawnsDungeon(WORLD_SALT, x, y)) assert.fail(`the relay's roll at ${x},${y}`);
  }
  const [nx, ny] = rolledAt(2200, -371, false);
  assert.equal(owSpawnsDungeon(nx, ny), false);
  const row = [sx, sy, 100, 150];
  assert.deepEqual([owWireRow(row), owRowSane(row), owRowFits(row, 200)], [row, true, row]);
  assert.equal(owRowSane([nx, ny, 100]), false, 'a pixel the roll stands none on is junk');
  assert.equal(owRowInCell(row, worldRoom(sx, sy)), true, 'in its own cell, west and north of the Bay\'s corner');
  assert.deepEqual(validOwOut(validOwIn({ k: 'dg', rows: [row] })), { k: 'dg', rows: [row] }, 'the word round-trips');
  assert.equal(OW_WORLD_RELAY_MIN, 276);   // PIN MOVED (the eighth merge of main into #1184): world276, past main's world275 (SD-PARTY, live), which refuses; PIN MOVED (the seventh merge of main into #1184): world275, past main's world274 (LADDER-CUT), which refuses
  assert.deepEqual([relaySupportsOwWorld('world277'), relaySupportsOwWorld('world275'), relaySupportsOwWorld('x')], [true, false, false], 'world275 refuses the word whole - and closes the socket');   // PIN MOVED (the fourth merge of main into #1184): the gate is world274, past main's world273, which refuses; PIN MOVED (the third merge of main into #1184): the gate is world272, past MASTER-THREE's world271 (main's), which refuses; world271 at the second merge, past CHAT-POST's world270   // PIN MOVED: world277, YARD-CELL YC2 (2026-10-27, bible/11-Multiplayer/Yard-Cells.md section 11; world271 to world277, and acct198 to acct200 then acct205 and acct206, on its branch, renumbered past YC1 at the merges) (the yard arm of the hub: a carried YARD ORDER verified and fanned once a second, server/src/yardWords.js; yd in its welcome); PIN MOVED: world277, YARD-CELL (net/homeLaw.js HOME_TOWN_MAX 2,048 - a law of the relay import graph, no relay behaviour moves; world266 on its branch, renumbered past main at the merges, last past TESA and SHOP); PIN MOVED: world276, SHOP (Genesis, Eternal and Origin join the vocabulary, last; the token's body bound 896); PIN MOVED: world275, the merge of main (world274 on its branch, renumbered past world274 on main at the merge); PIN MOVED: world274, the merge of main (world272 on its branch, renumbered past world272-world273 on main at the merge)
  const online = rd('src/net/online.js');
  assert.match(online, /k === 'dg' \? validOwIn\(\{ k, rows: payload\.filter\(\(r\) => owRowSane\(r\) && owRowInCell\(r, room\) && \(this\.owWorldOk \|\| bayMapPixel\(r\?\.\[0\], r\?\.\[1\]\)\)\)/, 'a row past the Bay to the relay that reads it alone');
  assert.match(online, /if \(primary\) this\.owWorldOk = relaySupportsOwWorld\(relayV\);/);
  assert.match(online, /old\.owWorldOk = this\.owWorldOk; this\.owWorldOk = !!h\.owWorldOk;/, 'and its word moves with the cell a crossing makes mine');
});

test('SPAWN-WORLD the room, the discovered places and the docks: a spawn past the Bay entered is a world room the relay keeps - public and instanced - and no hall\'s nor the sea\'s; found, it is filed by its whole id and finds no Bay place; it is no dock (mutants: the lane\'s flag)', () => {
  const [sx, sy] = rolledAt(2200, -371);
  const id = spawnedMapId(WORLD_SALT, sx, sy);
  const room = roomKeyFor({ host: 'world', mode: 'dungeon', mapId: id });
  assert.equal(room, `dungeon:m${id}`);
  assert.deepEqual([roomOf(`/room/${room}`), isWorldRoom(room), wdunHallOfRoom(room), seaRoomOf(room)], [room, true, null, false], 'the relay\'s room law: a world room, no hall, not the sea');
  const inst = instanceRoomOf(room, { owner: '0f1e2d3c4b5a6978', epoch: '89abcdef' });
  assert.deepEqual(instanceOf(inst), { base: room, owner: '0f1e2d3c4b5a6978', epoch: '89abcdef' }, 'and an instance beside it');
  // found, filed by its whole id (TESA II P6's law: its low 20 bits 500,000 and up) - never a Bay place's key
  restoreDiscovery(null);
  try {
    assert.equal(discoveryKeyOf(id), id, 'its whole id');
    assert.equal(discoverLocation(id, { regionName: 'Skyrim', locationName: 'Old Crypt' }), true);
    assert.equal(hasDiscoveredLocationId(id), true);
    assert.equal(Object.keys(snapshotDiscovery().locations).length, 1);
    for (const bay of [id & 0xfffff, ((1 << 20) | ((id & 0xfffff) % 500000)) >>> 0]) assert.equal(hasDiscoveredLocationId(bay), false, `no Bay key (${bay})`);
    const snap = snapshotDiscovery();
    restoreDiscovery(null);
    restoreDiscovery(snap);
    assert.equal(hasDiscoveredLocationId(id), true, 'and a save keeps it');
    assert.equal(hasDiscoveredLocationId(spawnedMapId(WORLD_SALT, sx + 1, sy)), false, 'its neighbour its own');
    assert.equal(discoveryKeyOf(spawnedMapId(1, 300, 200)), 200 * 1000 + 300, 'a Bay spawn keeps DFU\'s mask');
  } finally { restoreDiscovery(null); }
  // Immersive Travel's docks: a lane's low 20 bits are no Bay pixel id, so no dock nor any beside it
  const dock = DOCK_PIXEL_IDS[0];
  assert.equal(hasDock(dock), true);
  for (let y = -380; y < -360; y++) for (let x = 2200; x < 2240; x++) { const i = spawnedMapId(WORLD_SALT, x, y); assert.ok(!hasDock(i) && !nearDock(i), `${x},${y}`); }
});

test('SPAWN-WORLD by source: the host hands the place law to the ground\'s and the stand\'s spawns; the stand ends in the spawner past the Bay; the boards keep a pack off a spawn past the Bay as on it', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /placeAt: \(x, y\) => !!provinceQuestPlaces\?\.placeOnPixel\(x, y\),/);
  assert.match(w, /get provinceQuestPlaces\(\) \{ return provinceQuestPlaces; \},   \/\/ SPAWN-WORLD/);
  assert.match(w, /\|\| host\.lairLocationAt\(px, py\) \|\| spawnPastBayAt\(px, py\);/);
  assert.match(w, /if \(!onTheBay\(px, py\) && host\.provinceQuestPlaces\?\.placeOnPixel\(px, py\)\) return null;/);
  assert.match(w, /: !provinceQuestPlaces\.placeOnPixel\(x, y\) && !spawnsDungeon\(_spawnSalt, x, y\)\)/, 'a board\'s pack never on a spawn past the Bay');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK', 'WOODS.WLD', 'TMAP00I0.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('SPAWN-WORLD with ARENA2: over the player\'s own maps, trace and woods, a spawn past the Bay stands as densely as the Bay\'s - the same share of the dry land no place takes, the same Elite share - its template the game\'s, its region and climate its province\'s', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile, getWorldClimateSettings } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { createSpawnGround, spawnTemplates } = await import('../../src/world/spawnedDungeons.js');
  const { REGION_NAMES } = await import('../../src/formats/mapsTables.js');
  const { arenaPlaceOnPixel } = await import('../../src/world/arenaPlaces.js');
  const { capitalOnPixel } = await import('../../src/world/tamrielCapitals.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { theatreAt } = await import('../../src/world/worldWide/worldGrid.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const raw = new WoodsFile(); raw.load(bytes('WOODS.WLD'));
    const woods = groundWoods(raw);
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const templates = spawnTemplates(rows);
    const host = (px, py) => {
      const regionIndex = maps.getRegionIndexAt(px, py);
      return synthesizeDungeonLocation(pickTemplate(templates, WORLD_SALT, px, py), { salt: WORLD_SALT, px, py, where: { regionIndex, regionName: REGION_NAMES[regionIndex], politic: maps.getPoliticIndex(px, py), climate: getWorldClimateSettings(maps.getClimateIndex(px, py)) }, elite: isEliteSpawn(WORLD_SALT, px, py) });
    };
    const ground = createSpawnGround(woods);
    const place = (px, py) => arenaPlaceOnPixel(px, py) || !!capitalOnPixel(px, py);
    const L = createSpawnGroundPlace({ maps, online: true, etherSea: false, plateauDry: ground, terrainGen: { roads: () => null }, cloneAt: host, spawnGone: () => false, zoneMask: () => null, placeAt: place });
    const held = new Set(rows.map((l) => (l.mapTableData.mapId >>> 0) & 0xfffff));
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const share = (pick, ok) => {
      let land = 0, stands = 0, elite = 0;
      while (land < 3000) {
        const [x, y] = pick();
        if (!ok(x, y) || isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y))) continue;
        land++;
        const s = spawnsDungeon(WORLD_SALT, x, y) ? L.spawnAt(x, y) : null;
        if (s) { stands++; if (s.elite) elite++; }
      }
      return { stands: stands / land, elite: elite / stands };
    };
    const bay = share(() => [Math.floor(rnd() * 1000), Math.floor(rnd() * 500)], (x, y) => !held.has(y * 1000 + x));
    // Skyrim and Hammerfell past the Bay (theatres 3 and 4 - TAMRIEL3's picker's numbering: the Nords' and the Redguards')
    const past = share(() => [Math.floor(-862 + rnd() * 6000), Math.floor(-975 + rnd() * 3750)], (x, y) => !(x >= 0 && y >= 0 && x < 1000 && y < 500) && theatreAt(x, y) > 0 && theatreAt(x, y) !== 9 && !place(x, y));
    assert.ok(Math.abs(bay.stands - 0.29) < 0.03, `the Bay: ${(100 * bay.stands).toFixed(1)}% of its empty land stands a spawn`);
    assert.ok(Math.abs(past.stands - bay.stands) < 0.04, `past the Bay: ${(100 * past.stands).toFixed(1)}%, the Bay's ${(100 * bay.stands).toFixed(1)}%`);
    assert.ok(Math.abs(past.elite - 0.25) < 0.04 && Math.abs(bay.elite - 0.25) < 0.04, `a quarter Elite either side (${(100 * past.elite).toFixed(1)}%, ${(100 * bay.elite).toFixed(1)}%)`);
    // one spawn past the Bay, built: the game's template, its province's region and climate, its id the lane's
    const [sx, sy] = (() => { for (let x = 2200; ; x++) { const s = spawnsDungeon(WORLD_SALT, x, -371) && L.spawnAt(x, -371); if (s) return [x, -371]; } })();
    const s = L.spawnAt(sx, sy);
    assert.deepEqual([s.regionIndex, s.regionName, s.mapTableData.mapId], [maps.getRegionIndexAt(sx, sy), REGION_NAMES[maps.getRegionIndexAt(sx, sy)], worldLaneMapId(SPAWN_WORLD_LANE, sx, sy)]);
    assert.ok(s.regionIndex >= 62 && s.regionIndex <= 70 && s.dungeon.blocks.length > 0 && rows.some((r) => r.name === s.name.replace(/^Elite /, '').replace(/ \(-?\d+,-?\d+\)$/, '')), 'a dungeon of the game\'s own, in its province\'s region');
    assert.equal(s.climate.worldClimate, maps.getClimateIndex(sx, sy), 'its climate the composed map\'s');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
