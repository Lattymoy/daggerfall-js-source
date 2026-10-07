// FIELD BUGS 2026-10-07b HOLD-SOLO (nObOdy on Discord, #feature-feedback, "Lock privateer's hold.": "The first dungeon
// is a tutorial area. New players loading in in front of 50 players in a dead dungeon with no enemies ruins the magic.
// ... I couldnt even get gear or experience for my character cause i had to zoom past dead enemies and already open
// doors to get out and i sure as heck don't want to be given stuff i didn't earn by players standing there waiting all
// day."). `01-Overview/Field-Bugs-2026-10-07b.md`.
//
// Every character online stood in ONE relay room in Privateer's Hold - `dungeon:m187853213` (net/online.js roomKeyFor,
// by the dungeon's map id) - so every one of them saw the others, inherited the room's memory (WORLD1: the dead stay
// dead, the doors stay open), its simulation (WORLD2), its acts (WORLD3) and its loot (WORLD4), and could be handed
// things (a trade needs a peer in the room). The tutorial dungeon now keys no room: the world host's `!key` arm leaves
// the room (AUDIT ONLINE D4's law), and every shared lane asks isWorldRoom of the room it is in.
//
// Fixtures from the producers: MapsFile's own pixel math for the location, worldModes.js's roomIdentity and world.js's
// key block executed from their source, the real roomKeyFor; with ARENA2, the player's own MAPS.BSA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';
import { isStartDungeon, isStartCell } from '../src/systems/startDungeon.js';
import { mapPixelToLongitudeLatitude, MapsFile } from '../src/formats/mapsFile.js';
import { setValue } from '../src/systems/settings.js';
import { roomKeyFor } from '../src/net/online.js';
import { isWorldRoom } from '../src/net/wire.js';
import { privateInteriorOf } from '../src/net/privateInterior.js';
import { worldCoordToMapPixel } from '../src/world/streamingWorld.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const HOLD_MAP_ID = 187853213;   // DaggerfallDungeon.cs:151 `case 187853213: // Daggerfall/Privateer's Hold`
/** A location as MapsFile mints it, standing on map pixel (x, y). */
function locationAt(x, y, { name = "Privateer's Hold", mapId = HOLD_MAP_ID, regionIndex = 17 } = {}) {
  const { x: longitude, y: latitude } = mapPixelToLongitudeLatitude(x, y);
  return { name, regionIndex, mapTableData: { mapId, longitude, latitude } };
}

test('HOLD-SOLO: the tutorial dungeon is the location on the classic start\'s own cell (Startup.StartCellX/Y, 109/158) - read off the configured cell, so a custom start moves it', () => {
  assert.equal(isStartCell({ x: 109, y: 158 }), true);
  assert.equal(isStartCell({ x: 110, y: 158 }), false);
  assert.equal(isStartCell({ x: 109, y: 157 }), false);
  assert.equal(isStartCell(null), false);
  assert.equal(isStartDungeon(locationAt(109, 158)), true);
  assert.equal(isStartDungeon(locationAt(108, 158)), false);
  assert.equal(isStartDungeon({ name: 'no table' }), false);
  assert.equal(isStartDungeon(null), false);
  try {
    setValue('Startup', 'StartCellX', '200');
    assert.equal(isStartDungeon(locationAt(109, 158)), false, 'a custom start cell takes the tutorial with it');
    assert.equal(isStartDungeon(locationAt(200, 158)), true);
  } finally { setValue('Startup', 'StartCellX', '109'); }
});

// worldModes.js's roomIdentity, executed from its source
const WM = read('src/scenes/worldModes.js');
const props = new Map();
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'Property' && n.key?.name) props.set(n.key.name, WM.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
})(parse(WM, { ecmaVersion: 'latest', sourceType: 'module' }));
const roomIdentityIn = (dungeonLoc) => Function('mode', 'dungeonLoc', 'isGateArena', 'isArenaFloor', 'isStartDungeon',
  `return ({${props.get('roomIdentity')}}).roomIdentity();`)('dungeon', dungeonLoc, () => false, () => false, isStartDungeon);

// world.js's key block, executed from its source - the one the frame names its room by
const W = read('src/scenes/world.js');
const KEY_FROM = W.indexOf("    const mode = modes?.mode ?? 'exterior';   // audit24_wave37");
const KEY_TO = W.indexOf('    // ONLINE-MVFLICKER1', KEY_FROM);
function keyIn(ident) {
  const args = {
    modes: { mode: 'dungeon', sailingCabin: null, roomIdentity: () => ident },
    state: { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z], worldCoords: (p) => ({ x: p[0], z: p[2] }) },
    player: { pos: [1, 2, 3] }, cam: { yaw: 0, pitch: 0 }, worldCoordToMapPixel, roomKeyFor, privateInteriorOf,
    _questLoc: () => null, privateRoomHere: () => assert.fail('a dungeon is never a private room'), siegeSession: null, royalSession: null, campToWire: (p) => p,
  };
  return new Function(...Object.keys(args), `let onlineToScene, sceneToOnline; ${W.slice(KEY_FROM, KEY_TO)} return key;`)(...Object.values(args));
}

test('HOLD-SOLO: the tutorial dungeon\'s room identity says it is every character\'s own (`solo`), and the world host keys it NO room - where every other dungeon keys its shared world room by its map id', () => {
  assert.ok(KEY_FROM > 0 && KEY_TO > KEY_FROM, 'the key block');
  const hold = roomIdentityIn(locationAt(109, 158));
  assert.deepEqual(hold, { kind: 'dungeon', mapId: HOLD_MAP_ID, regionIndex: 17, name: "Privateer's Hold", solo: true });
  assert.equal(keyIn(hold), null, 'no room in the Hold');
  // the room it was: everyone's
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: HOLD_MAP_ID }), `dungeon:m${HOLD_MAP_ID}`);
  assert.equal(isWorldRoom(`dungeon:m${HOLD_MAP_ID}`), true, 'a shared world room - its memory, foes, acts and loot');
  // every other dungeon keeps its shared room
  const other = roomIdentityIn(locationAt(120, 150, { name: 'Castle Necromoghan', mapId: 12345 }));
  assert.deepEqual(other, { kind: 'dungeon', mapId: 12345, regionIndex: 17, name: 'Castle Necromoghan' });
  assert.equal(keyIn(other), 'dungeon:m12345');
  // the null key is the host's leave: no presence, no chat's Local tab, no trade, no shared world
  assert.match(W.slice(KEY_TO), /\n {4}if \(!key\) \{ if \(online\.room\) online\.leave\(\); \}/, 'AUDIT ONLINE D4: a place keyed no room is no room');
});

test('HOLD-SOLO: worldModes\' online death in the Hold (PH1) asks the same helper - one reading of the tutorial dungeon in the mode machine', () => {
  assert.match(WM, /const isPrivateersHold = isStartDungeon\(dfLocation\);/);
  assert.match(WM, /\.\.\.\(isStartDungeon\(dungeonLoc\) \? \{ solo: true \} : \{\}\)/);
  assert.doesNotMatch(WM, /getInt\('Startup', 'StartCell[XY]'\)/, 'no second reading of the start cell in the mode machine');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('HOLD-SOLO with ARENA2: of every location in the world, the start cell holds one - Daggerfall\'s Privateer\'s Hold, map id 187853213 - and it alone keys no room', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); assert.ok(maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')));
  const solo = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r); if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (loc.hasDungeon && roomIdentityIn(loc).solo) solo.push(`${loc.regionName}/${loc.name}:${loc.mapTableData.mapId}`);
    }
  }
  assert.deepEqual(solo, [`Daggerfall/Privateer's Hold:${HOLD_MAP_ID}`]);
});
