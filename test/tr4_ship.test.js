import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { existsSync, readFileSync as readBytes } from 'node:fs';
import { isOnShip, shipTransition, REPOSITION } from '../src/systems/ship.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { SHIP_TYPES, shipCoords, SHIP_COORDS, SHIP_INTERIOR_MAP_IDS } from '../src/systems/banking.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import {
  locationArrivalLanding, entranceOptionsForLocationType, LOCATION_TYPE_HOME_YOUR_SHIPS,
  EXTRA_DISTANCE,
} from '../src/world/locationEntrance.js';
import { RMB_SIDE } from '../src/world/locationLayout.js';
import { MapsFile, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';

// TR4 - THE SHIP: TransportManager's ship arm (:79-84, :360-402), the
// last slice of the transport arc. "Ship" is not a mode you travel IN -
// DFU's own comment on the enum says so - it is a TELEPORT that lands
// back on Foot, and `boardShipPosition` is the whole of its state.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const owner = () => ({ ownedShip: SHIP_TYPES.Small });
const at = (c) => ({ x: c.x, y: c.y });

test('TR4: IsOnShip is a remembered boarding AND standing on the ship\'s own pixel (:79-84)', () => {
  const p = owner();
  const c = shipCoords(p);
  assert.ok(c, 'an owner has coords');
  const memory = { mapPixel: { x: 40, y: 50 }, pos: [1, 2, 3], yaw: 0.5 };
  assert.equal(isOnShip(p, memory, at(c)), true);
  assert.equal(isOnShip(p, null, at(c)), false, 'no memory: not aboard');
  assert.equal(isOnShip(p, memory, { x: 40, y: 50 }), false, 'memory but standing elsewhere: not aboard');
  assert.equal(isOnShip({ ownedShip: SHIP_TYPES.None }, memory, at(c)), false, 'no ship at all');
});

test('TR4: boarding remembers where you were and lands at a start marker; disembarking goes back exactly and forgets', () => {
  const p = owner();
  const c = shipCoords(p);
  const here = { x: 40, y: 50 };
  const position = { mapPixel: here, pos: [10, 2, 30], yaw: 1.25 };
  const board = shipTransition(p, { boardShipPosition: null, mapPixel: here, position });
  assert.deepEqual(board.go, { x: c.x, y: c.y });
  assert.equal(board.reposition, REPOSITION.RandomStartMarker);
  assert.equal(board.restore, null, 'a start marker, not a remembered spot');
  assert.equal(board.boardShipPosition, position, 'and the memory is taken');
  assert.equal(board.mode, TRANSPORT_MODES.Foot, 'Ship is not a mode you travel in');
  // Now aboard: the same call disembarks.
  const off = shipTransition(p, { boardShipPosition: position, mapPixel: at(c), position: { mapPixel: at(c), pos: [0, 0, 0], yaw: 0 } });
  assert.deepEqual(off.go, here, 'back to the remembered pixel');
  assert.equal(off.reposition, REPOSITION.None, 'exactly where you were, no reposition');
  assert.equal(off.restore, position);
  assert.equal(off.boardShipPosition, null, 'and the memory is forgotten');
  assert.equal(off.mode, TRANSPORT_MODES.Foot);
});

test('TR4: no ship, no transition - the port answers null where DFU would reach a null coord', () => {
  assert.equal(shipTransition({ ownedShip: SHIP_TYPES.None }, { mapPixel: { x: 1, y: 1 } }), null);
  assert.equal(shipTransition({}, { mapPixel: { x: 1, y: 1 } }), null);
});

test('TR4: the boarding memory SURVIVES a save (SerializablePlayer :180, :425)', () => {
  const e = { ...owner(), stats: {}, skills: [], items: [] };
  const memory = { mapPixel: { x: 40, y: 50 }, pos: [10, 2, 30], yaw: 1.25 };
  e.boardShipPosition = memory;
  const snap = snapshotPlayer(e, { position: [0, 0, 0], classicMinutes: 0 });
  assert.deepEqual(snap.boardShipPosition, memory, 'saved beside the deed');
  const loaded = { stats: {}, skills: [], items: [] };
  restorePlayer(loaded, snap);
  assert.deepEqual(loaded.boardShipPosition, memory, 'and restored');
  // Without it, a save taken at sea loads with no way back: IsOnShip
  // would answer false and disembarking would BOARD again, overwriting
  // the real position. An older envelope restores null, which is the
  // "never boarded" state rather than a broken one.
  const older = { ...snap }; delete older.boardShipPosition;
  const old = { stats: {}, skills: [], items: [] };
  restorePlayer(old, older);
  assert.equal(old.boardShipPosition, null);
});

test('TR4: the picker\'s row is live for an owner, and Ship routes to the teleport rather than the mode', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /shipAvailable: ownsShip\(playerEntity\),/, 'the row the bank arc has been able to answer since H3');
  assert.match(world, /if \(mode === TRANSPORT_MODES\.Ship\) \{ boardOrDisembark\(\); return; \}/);
  // The host half: the decision comes from ship.js, the teleport and
  // the remembered yaw are the host's.
  assert.match(world, /const t = shipTransition\(playerEntity, \{/);
  // F-F1 (the parity audit): the host READS the reposition rather than
  // inferring it from `restore`, so the two encodings cannot drift.
  assert.match(world, /const localPos = t\.reposition === REPOSITION\.None \? t\.restore\.pos : null;/);
  assert.match(world, /await _teleportToPixel\(t\.go\.x, t\.go\.y, localPos, \{ reposition: t\.reposition \}\);/);
  assert.match(world, /playerEntity\.boardShipPosition = t\.boardShipPosition;/);
  assert.match(world, /setTransportModeHere\(t\.mode\);/, 'and it lands on Foot through the one seam');
});

// =====================================================================
// TR4-SHIPLAND - THE SHIP ARRIVAL IS A LOCATION ARRIVAL.
//
// The TR-AUDIT F-F1 note carried a FLAGGED assumption: "the ship coords
// are open sea, so the fallback (terrain origin) is the arm that runs".
// Measured against the owner's real MAPS.BSA on 2026-09-03, it is FALSE.
// Map pixel (2,2) carries region 31 ("High Rock sea coast") index 1,
// "Your Ship", mapId 1050578, LocationTypes.HomeYourShips (14), 1x1,
// block SHIPAA00.RMB; map pixel (5,5) carries region 31 index 2, "Your
// Ship", mapId 2102157, block SHIPAA01.RMB. So
// StreamingWorld.TeleportToCoordinates(x, y, RandomStartMarker) finds a
// location at the destination and PositionPlayerToLocation
// (:1437-1467) lands the player on the deck - the ordinary location
// arrival, not the terrain-origin fallback.
// =====================================================================

/** The "Your Ship" DFLocation shape, as MAPS.BSA carries it. The data
 *  gate below asserts these very fields off the real file. */
const yourShip = (mapId, blockName) => ({
  name: 'Your Ship',
  regionIndex: 31,
  mapTableData: { mapId, locationType: LOCATION_TYPE_HOME_YOUR_SHIPS },
  exterior: { exteriorData: { mapId, width: 1, height: 1, blockNames: [blockName] } },
});

test('TR4-SHIPLAND: the boarding arrival routes through the location arm, not the default landing', () => {
  // (1) THE LAW. HomeYourShips derives useNearestStartMarker TRUE and
  // grounded FALSE (:1462-1464), so the deck marker is taken and
  // FixStanding never drops the player through it into the sea.
  assert.deepEqual(entranceOptionsForLocationType(LOCATION_TYPE_HOME_YOUR_SHIPS),
    { useNearestStartMarker: true, grounded: false });
  const deck = [40, 6, 55];
  const origin = [100, 3, 200];
  const at = locationArrivalLanding(yourShip(1050578, 'SHIPAA00.RMB'),
    { origin, startMarkers: [deck], roll: () => 0 });
  assert.equal(at.grounded, false, 'a ship is never grounded to the terrain under it');
  assert.equal(at.usedStartMarker, true, 'the deck marker is taken');
  assert.deepEqual(at.pos, [origin[0] + deck[0], origin[1] + deck[1], origin[2] + deck[2]],
    'and the landing is that marker in world units, not a terrain origin');
  // Without a marker in the block the law still stands the player at a
  // random SIDE of the ship's 1x1 rectangle facing in - never the pixel
  // centre the default landing would give.
  const sideOnly = locationArrivalLanding(yourShip(2102157, 'SHIPAA01.RMB'),
    { origin, startMarkers: [], roll: () => 0 });
  assert.equal(sideOnly.side, 'north');
  assert.deepEqual(sideOnly.pos,
    [origin[0] + RMB_SIDE * 0.5, origin[1], origin[2] + RMB_SIDE * 0.5 + (RMB_SIDE * 0.5 + EXTRA_DISTANCE)]);
  // A pixel with NO location is the only place the fallback lives.
  assert.equal(locationArrivalLanding(null, { origin }), null);
  assert.equal(locationArrivalLanding({ mapTableData: {} }, { origin }), null);

  // (2) THE HOST. The ship arm hands the teleport core the reposition
  // method DFU's TeleportToMapPixel stores (:1076-1095), and the core
  // applies it after the destination pixel is built, exactly where
  // StreamingWorld.Update applies it (:266-295). Forcing the default
  // landing - dropping the `reposition` argument, or nulling `landing`
  // in the core - turns this red.
  const world = read('src/scenes/world.js');
  assert.match(world, /await _teleportToPixel\(t\.go\.x, t\.go\.y, localPos, \{ reposition: t\.reposition \}\);/,
    'the boarding carries RandomStartMarker into the teleport');
  assert.match(world, /const landing = reposition === REPOSITION\.RandomStartMarker \? locationLandingFor\(px, py\) : null;/,
    'and the core runs the location arm for it');
  assert.match(world, /const local = landing\?\.pos \?\? localPos;/,
    'the location landing OUTRANKS the caller\'s own local position');
  assert.match(world, /const raw = local \?\? \[TERRAIN_SIZE \/ 2, dest\.centerHeight/,
    'the default landing is only what is left when neither exists');
  assert.match(world, /const ground = landing \? landing\.grounded : grounded;/,
    'and grounded comes off the LocationType, not the caller');
  assert.match(world, /if \(landing\) cam\.yaw = landing\.yaw;/,
    'PositionPlayerToLocation sets the facing itself (:1552-1584)');
  // The FLAGGED sentence is retired into the measured fact.
  assert.ok(!/FLAGGED for the first session with/.test(world),
    'the flag is closed, not carried');
  assert.match(world, /MEASURED, 2026-09-03, against the owner's real MAPS\.BSA/,
    'and what closed it is recorded where it was flagged');
  // (3) THE INDEX. One location per map pixel, and the ONLY guard the
  // index loop applies is "the location loaded an exterior" - no
  // region filter, no LocationType filter, so region 31's hidden sea
  // coast and its HomeYourShips rows stand like any other.
  assert.match(world, /if \(!loc \|\| !loc\.exterior \|\| !loc\.exterior\.exteriorData\) continue;\s*\n\s*const p = longitudeLatitudeToMapPixel/,
    'the location index filters nothing DFU does not filter');
});

// ---------------------------------------------------------------------
// The MAPS-only data gate. MAPS.BSA alone answers all of this, so it
// runs the moment ARENA2_PATH holds that one file - CLIMATE.PAK and
// POLITIC.PAK are stubbed out, exactly as DFU's own MapsFile.Load takes
// them separately from the BSA.
// ---------------------------------------------------------------------

const ARENA2 = process.env.ARENA2_PATH;
const skipMaps = !ARENA2 || !existsSync(join(ARENA2, 'MAPS.BSA'))
  ? 'ARENA2_PATH holds no MAPS.BSA - ship-pixel data gate skipped'
  : false;

function loadMaps() {
  const mf = new MapsFile();
  mf.climatePak.load = () => {};    // no CLIMATE.PAK in this container
  mf.politicPak.load = () => {};    // no POLITIC.PAK either
  mf.autoDiscard = false;           // the sweep below walks all 62 regions
  assert.equal(mf.load(new Uint8Array(readBytes(join(ARENA2, 'MAPS.BSA')))), true);
  return mf;
}

test('TR4-SHIPLAND data: MAPS.BSA stands "Your Ship" on both ship pixels', { skip: skipMaps }, () => {
  const mf = loadMaps();
  assert.equal(mf.regionCount, 62);
  const region = mf.getRegion(31);
  assert.equal(region.name, 'High Rock sea coast');
  const expected = [
    { pixel: { x: 2, y: 2 }, index: 1, mapId: 1050578, block: 'SHIPAA00.RMB' },
    { pixel: { x: 5, y: 5 }, index: 2, mapId: 2102157, block: 'SHIPAA01.RMB' },
  ];
  for (const e of expected) {
    const loc = mf.getLocation(31, e.index);
    assert.equal(loc.name, 'Your Ship');
    assert.equal(loc.regionName, 'High Rock sea coast');
    assert.equal(loc.mapTableData.mapId, e.mapId);
    assert.equal(loc.mapTableData.locationType, LOCATION_TYPE_HOME_YOUR_SHIPS, 'HomeYourShips (14)');
    assert.deepEqual(longitudeLatitudeToMapPixel(
      loc.mapTableData.longitude, loc.mapTableData.latitude), e.pixel);
    assert.equal(loc.exterior.exteriorData.width, 1);
    assert.equal(loc.exterior.exteriorData.height, 1);
    assert.deepEqual([...loc.exterior.exteriorData.blockNames], [e.block]);
    assert.equal(loc.hasDungeon, false, 'the ship is an exterior block, nothing more');
    // ...and the arm the host will run on arrival is the location arm.
    const at = locationArrivalLanding(loc, { origin: [0, 0, 0], roll: () => 0 });
    assert.ok(at, 'the pixel has a location, so the terrain-origin fallback never fires');
    assert.equal(at.grounded, false);
  }
  // Nothing ELSE in the 62 regions stands on either pixel, so the one
  // location per map pixel the index keeps is this one.
  const hits = [];
  for (let r = 0; r < mf.regionCount; r++) {
    const reg = mf.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) {
      const row = reg.mapTable[l];
      const p = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      if (expected.some((e) => e.pixel.x === p.x && e.pixel.y === p.y)) hits.push(`${r}/${l}`);
    }
  }
  assert.deepEqual(hits, ['31/1', '31/2'], 'the ship pixels are the ships\' alone');
});

test('TR4-SHIPLAND data: SHIP_INTERIOR_MAP_IDS are the two locations\' own mapIds', { skip: skipMaps }, () => {
  // banking.js states the pair twice - SHIP_COORDS for the map pixel a
  // ShipType lands on, SHIP_INTERIOR_MAP_IDS for the mapId the interior
  // is keyed by - and MAPS.BSA is the one place they can be checked
  // against each other. Small ship first, large ship second, in
  // ShipType order, both ways round.
  const mf = loadMaps();
  const byPixel = new Map();
  for (let l = 0; l < mf.getRegion(31).locationCount; l++) {
    const loc = mf.getLocation(31, l);
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    byPixel.set(`${p.x},${p.y}`, loc);
  }
  assert.equal(SHIP_COORDS.length, SHIP_INTERIOR_MAP_IDS.length);
  SHIP_COORDS.forEach((c, i) => {
    const loc = byPixel.get(`${c.x},${c.y}`);
    assert.ok(loc, `SHIP_COORDS[${i}] (${c.x},${c.y}) carries a location`);
    assert.equal(loc.name, 'Your Ship');
    assert.equal(loc.mapTableData.mapId, SHIP_INTERIOR_MAP_IDS[i],
      `SHIP_INTERIOR_MAP_IDS[${i}] is the mapId of the location standing on SHIP_COORDS[${i}]`);
  });
});
