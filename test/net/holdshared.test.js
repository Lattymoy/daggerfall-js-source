// HOLD-SHARED (2026-10-12, asked: "I want to revert the change we made to privateers hold making it instanced"):
// HOLD-SOLO (FIELD BUGS 2026-10-07b) and AUDIT FB1007b's H1-H5 reverted. Online, Privateer's Hold keys its shared world
// room by its map id - `dungeon:m187853213` (net/online.js roomKeyFor) - as every dungeon does: its memory, foes, doors,
// loot and presence are the room's again. `01-Overview/bugs/Field-Bugs-2026-10-07b.md` HOLD-SOLO says what was reverted.
//
// Fixtures from the producers: MapsFile's own pixel math for the location, worldModes.js's roomIdentity and world.js's
// key block, staffDestination and chatSend executed from their source, the real roomKeyFor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { isStartDungeon, isStartCell } from '../../src/systems/startDungeon.js';
import * as startDungeon from '../../src/systems/startDungeon.js';
import { builtDungeonSize } from '../../src/world/smallerDungeons.js';
import { mapPixelToLongitudeLatitude } from '../../src/formats/mapsFile.js';
import { setValue } from '../../src/systems/settings/settings.js';
import { roomKeyFor } from '../../src/net/online.js';
import { isWorldRoom, seaVaultRoomId } from '../../src/net/wire.js';
import * as chat from '../../src/net/chat.js';
import { withMe } from '../../src/ui/partyPanel.js';
import { privateInteriorOf } from '../../src/net/privateInterior.js';
import { worldCoordToMapPixel } from '../../src/world/streamingWorld.js';
import { validStaffDestination } from '../../src/net/staffTeleport.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const HOLD_MAP_ID = 187853213;   // DaggerfallDungeon.cs:151 `case 187853213: // Daggerfall/Privateer's Hold`
/** A location as MapsFile mints it, standing on map pixel (x, y). */
function locationAt(x, y, { name = "Privateer's Hold", mapId = HOLD_MAP_ID, regionIndex = 17 } = {}) {
  const { x: longitude, y: latitude } = mapPixelToLongitudeLatitude(x, y);
  return { name, regionIndex, mapTableData: { mapId, longitude, latitude } };
}

test('HOLD-SHARED: the tutorial dungeon is still the location on the classic start\'s own cell (Startup.StartCellX/Y, 109/158) for PH1 and TUT1 - read off the configured cell, so a custom start moves it', () => {
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
  assert.deepEqual(['isTutorialHold', 'SHIPPED_START_CELL'].filter((n) => n in startDungeon), [], 'HOLD-SOLO\'s isTutorialHold and SHIPPED_START_CELL gone');
});

// worldModes.js's roomIdentity, executed from its source
const WM = read('src/scenes/worldModes.js');
const props = new Map();
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'Property' && n.key?.name) props.set(n.key.name, WM.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
})(parse(WM, { ecmaVersion: 'latest', sourceType: 'module' }));
const roomIdentityIn = (dungeonLoc) => Function('mode', 'dungeonLoc', 'isGateArena', 'isSdRealm', 'isEgHall', 'isArenaFloor', 'isStartDungeon', 'builtDungeonSize', 'host', 'placeInstance',
  `return ({${props.get('roomIdentity')}}).roomIdentity();`)('dungeon', dungeonLoc, () => false, () => false, () => false, () => false, isStartDungeon, builtDungeonSize, {}, null);   // PIN MOVED (INSTANCES' audit): `placeInstance`, the mode's own - null, the public room   // INSTANCES: `host` - no door, so no instance (the public room this pins)

// world.js's key block, executed from its source - the one the frame names its room by
const W = hostText('src/scenes/world.js');
const KEY_FROM = W.indexOf("    const mode = modes?.mode ?? 'exterior';   // audit24_wave37");
const KEY_TO = W.indexOf('    // ONLINE-MVFLICKER1', KEY_FROM);
function keyIn(ident) {
  const args = {
    modes: { mode: 'dungeon', sailingCabin: null, roomIdentity: () => ident },
    state: { compensation: [0, 0, 0], localFromWorld: (x, z) => [x, z], worldCoords: (p) => ({ x: p[0], z: p[2] }) },
    player: { pos: [1, 2, 3] }, cam: { yaw: 0, pitch: 0 }, worldCoordToMapPixel, roomKeyFor, privateInteriorOf,
    _questLoc: () => null, privateRoomHere: () => assert.fail('a dungeon is never a private room'), siegeSession: null, royalSession: null, campToWire: (p) => p,
    seaVaultRoomId, _wdunInside: null, seaVentures: { vaultHere: () => null },   // PIN MOVED (AUDIT SEA VENTURES D7, D8): a vault of the deep's room its own lane - a dungeon of the Bay its own map id, as before
  };
  return new Function(...Object.keys(args), `let onlineToScene, sceneToOnline; ${W.slice(KEY_FROM, KEY_TO)} return key;`)(...Object.values(args));
}

test('HOLD-SHARED: Privateer\'s Hold\'s room identity is every dungeon\'s, and the world host keys it its shared world room by its map id - `dungeon:m187853213`', () => {
  assert.ok(KEY_FROM > 0 && KEY_TO > KEY_FROM, 'the key block');
  const hold = roomIdentityIn(locationAt(109, 158));
  assert.deepEqual(hold, { kind: 'dungeon', mapId: HOLD_MAP_ID, regionIndex: 17, name: "Privateer's Hold", size: 'full', instance: null });   // PIN MOVED (INSTANCES): its public room - no door entered it as an instance
  assert.equal(keyIn(hold), `dungeon:m${HOLD_MAP_ID}`);
  assert.equal(isWorldRoom(keyIn(hold)), true, 'a shared world room - its memory, foes, acts and loot');
  const other = roomIdentityIn(locationAt(120, 150, { name: 'Castle Necromoghan', mapId: 12345 }));
  assert.deepEqual(other, { kind: 'dungeon', mapId: 12345, regionIndex: 17, name: 'Castle Necromoghan', size: 'full', instance: null });
  assert.equal(keyIn(other), 'dungeon:m12345');
  assert.doesNotMatch(WM, /isTutorialHold|solo: true/, 'no solo dungeon in the mode machine');
  assert.doesNotMatch(W, /ident\?\.solo|identity\?\.solo|SoloMemory|soloHere/, 'nor in the world host');
});

test('HOLD-SHARED: worldModes\' online death in the Hold (PH1) asks the one helper - one reading of the tutorial dungeon in the mode machine', () => {
  assert.match(WM, /const isPrivateersHold = isStartDungeon\(dfLocation\);/);
  assert.doesNotMatch(WM, /getInt\('Startup', 'StartCell[XY]'\)/, 'no second reading of the start cell in the mode machine');
});

test('HOLD-SHARED: a staff /tp to a player in the Hold lands at their place, as in any dungeon (AUDIT FB1007b H3\'s refusal reverted)', () => {
  const at = W.indexOf('  function staffDestination() {');
  const end = W.indexOf('\n  }\n', at);
  assert.ok(at > 0 && end > at);
  const capture = (loc) => new Function('walkMode', 'playerSpawned', 'worldMoveBusy', 'modes', 'seatOut', 'playerEntity', 'siegeSession', 'royalSession', 'privateRoomHere',
    'state', 'player', 'cam', 'playerTravelPixel', 'ohAbyss', 'csaOn', 'validStaffDestination',
    `${W.slice(at, end + 4)} return staffDestination();`)(true, true, () => false,
    { mode: 'dungeon', transitioning: false, roomIdentity: () => roomIdentityIn(loc), anchorContext: () => null, gateArenaGate: () => null, dungeonLocation: loc },
    () => false, { health: 10 }, null, null, () => null, { current: { x: 109, y: 158 } }, { pos: [1, 2, 3] }, { yaw: 0, pitch: 0 }, () => ({ x: 109, y: 158 }), null, () => false, validStaffDestination);
  assert.equal(capture(locationAt(109, 158)).dest?.kind, 'dungeon', 'the Hold: its place');
  assert.equal(capture(locationAt(120, 150, { name: 'Castle Necromoghan', mapId: 12345 })).dest?.kind, 'dungeon', 'any other dungeon: its place, as ever');
});

test('HOLD-SHARED: in the Hold a Local line goes to the room, two party members there are together, and nothing says the Hold is the player\'s own (AUDIT FB1007b H5 reverted)', () => {
  const at = W.indexOf('  const chatSend = (tabId, text, from = tabId, { me = false } = {}) => {');
  const end = W.indexOf('\n  };\n', at);
  assert.ok(at > 0 && end > at, 'chatSend');
  const sent = [];
  const ok = new Function('online', 'chatLog', 'chanOld', 'guildOld', 'socialLink', 'chatLinks', 'social', 'myGuildTag',
    'CHAN_OLD_RELAY_TEXT', 'GUILD_OLD_RELAY_TEXT', 'EMOTE_OLD_RELAY_TEXT', 'NO_PARTY_TEXT', 'NO_GUILD_TEXT',
    `${W.slice(at, end + 5)} return chatSend('local', 'hello');`)(
    { status: 'open', emoteOk: true, sendChat: (t) => { sent.push(t); return true; } }, { push: () => assert.fail('nothing said in its stead'), tab: () => null },
    () => false, () => false, () => null, new Map(), null, () => null, 'old', 'old', 'old', 'no party', 'no guild');
  assert.deepEqual({ ok, sent }, { ok: true, sent: ['hello'] }, 'the room hears it');
  assert.equal('SOLO_LOCAL_TEXT' in chat, false);
  const inHold = { px: 109, py: 158, in: 1, loc: "Privateer's Hold" };
  assert.equal(withMe({ ...inHold }, { ...inHold }), true, 'two members in the Hold: together');
  assert.doesNotMatch(read('src/ui/enhanced/enhancedMenu.js'), /Privateer\\u2019s Hold, where every character begins, is each player\\u2019s own/, 'the Online pane');
  assert.doesNotMatch(read('src/systems/tutorialCatalogue.js'), /starting cave is yours alone/, 'the Playing Online page');
});
