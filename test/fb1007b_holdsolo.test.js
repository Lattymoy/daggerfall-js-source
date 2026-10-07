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
import { isStartDungeon, isStartCell, isTutorialHold, SHIPPED_START_CELL } from '../src/systems/startDungeon.js';
import { mapPixelToLongitudeLatitude, MapsFile } from '../src/formats/mapsFile.js';
import { setValue } from '../src/systems/settings.js';
import { roomKeyFor } from '../src/net/online.js';
import { isWorldRoom, SOCIAL_ROOM, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { SOLO_LOCAL_TEXT } from '../src/net/chat.js';
import { withMe } from '../src/ui/partyPanel.js';
import { PAGE_NO_READERS_TEXT } from '../src/net/journalPage.js';
import { privateInteriorOf } from '../src/net/privateInterior.js';
import { worldCoordToMapPixel } from '../src/world/streamingWorld.js';
import { validStaffDestination } from '../src/net/staffTeleport.js';

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
const roomIdentityIn = (dungeonLoc) => Function('mode', 'dungeonLoc', 'isGateArena', 'isArenaFloor', 'isStartDungeon', 'isTutorialHold',
  `return ({${props.get('roomIdentity')}}).roomIdentity();`)('dungeon', dungeonLoc, () => false, () => false, isStartDungeon, isTutorialHold);

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
  assert.match(WM, /\.\.\.\(isTutorialHold\(dungeonLoc\) \? \{ solo: true \} : \{\}\)/);
  assert.doesNotMatch(WM, /getInt\('Startup', 'StartCell[XY]'\)/, 'no second reading of the start cell in the mode machine');
});

test('AUDIT FB1007b H1: the dungeon no one shares is the SHIPPED start\'s - a player\'s own start cell (a setting) takes no dungeon out of the shared world, and leaves the Hold their own', () => {
  assert.deepEqual(SHIPPED_START_CELL, { x: 109, y: 158 });
  assert.deepEqual([locationAt(109, 158), locationAt(108, 158), locationAt(109, 157), { name: 'no table' }, null].map(isTutorialHold), [true, false, false, false, false], 'both coordinates');
  const barrow = locationAt(958, 450, { name: 'Scourg Barrow', mapId: 701948302 });
  try {
    setValue('Startup', 'StartCellX', '958');
    setValue('Startup', 'StartCellY', '450');
    assert.equal(isStartDungeon(barrow), true, 'PH1\'s tutorial follows the configured start, as the classic start does');
    assert.equal(isTutorialHold(barrow), false);
    const there = roomIdentityIn(barrow);
    assert.equal(there.solo, undefined, 'the start cell a player set keys its dungeon\'s shared room all the same');
    assert.equal(keyIn(there), 'dungeon:m701948302');
    const hold = roomIdentityIn(locationAt(109, 158));
    assert.equal(hold.solo, true, 'and the Hold is their own still');
    assert.equal(keyIn(hold), null);
  } finally { setValue('Startup', 'StartCellX', '109'); setValue('Startup', 'StartCellY', '158'); }
});

test('AUDIT FB1007b H3: a staff /tp to a player in the Hold is refused as unavailable - the Hold is each character\'s own, and the staff landed in their own empty copy, told they stood at the player\'s exact position', () => {
  const at = W.indexOf('  function staffDestination() {');
  const end = W.indexOf('\n  }\n', at);
  assert.ok(at > 0 && end > at);
  const capture = (ident) => new Function('walkMode', 'playerSpawned', 'worldMoveBusy', 'modes', 'seatOut', 'playerEntity', 'siegeSession', 'royalSession', 'privateRoomHere',
    'state', 'player', 'cam', 'playerTravelPixel', 'ohAbyss', 'csaOn', 'validStaffDestination',
    `${W.slice(at, end + 4)} return staffDestination();`)(true, true, () => false,
    { mode: 'dungeon', transitioning: false, roomIdentity: () => ident, anchorContext: () => null, gateArenaGate: () => null, dungeonLocation: locationAt(109, 158) },
    () => false, { health: 10 }, null, null, () => null, { current: { x: 109, y: 158 } }, { pos: [1, 2, 3] }, { yaw: 0, pitch: 0 }, () => ({ x: 109, y: 158 }), null, () => false, validStaffDestination);
  const hold = roomIdentityIn(locationAt(109, 158));
  assert.deepEqual(capture(hold), { error: 'unavailable' }, 'the Hold: unavailable');
  const other = capture(roomIdentityIn(locationAt(120, 150, { name: 'Castle Necromoghan', mapId: 12345 })));
  assert.equal(other.dest?.kind, 'dungeon', 'any other dungeon: its place, as ever');
});

test('AUDIT FB1007b H4: in the Hold the presence session keys no room and hears no welcome - the hub\'s link hears the relay\'s clock for it, as the presence session\'s own welcome is heard', () => {
  const line = /\n {6}if \(tab\.room === SOCIAL_ROOM\) link\.onClock = (\(offsetMs\) => online\?\.onClock\?\.\(offsetMs\));\n/.exec(W)?.[1];
  assert.ok(line, 'the hub link\'s clock, handed to the presence session\'s handler');
  assert.match(W, /\n {4}online\.onClock = \(offsetMs\) => \{ const was = _sharedOffsetMs;[^\n]*hearSharedClock\(\); \};/, 'the handler: the offset, the arrival, the absence paid');
  const heard = [];
  const online = { onClock: (ms) => heard.push(ms) };
  const { FakeWS, sockets } = fakeSocketClass();
  const info = console.info; console.info = () => {};
  try {
    const link = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, presence: false });
    link.onClock = new Function('online', `return ${line};`)(online);
    link.join(SOCIAL_ROOM, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v: RELAY_VERSION, now: Date.now() + 5000 });
  } finally { console.info = info; }
  assert.equal(heard.length, 1, 'heard once, on the hub\'s welcome');
  assert.ok(Math.abs(heard[0] - 5000) < 500, `the relay's offset (${heard[0]})`);
});

test('AUDIT FB1007b H2: the tutorial dungeon keeps its own memory online - taken at the door out, laid back at the next door in (its dead stay dead, its emptied containers empty, WORLD8\'s hour on them) - and a load forgets it; offline, and every shared dungeon, as ever', () => {
  const from = W.indexOf('  let _soloMemory = null;');
  const to = W.indexOf('\n  };\n', W.indexOf('  const restoreSoloMemory = () => {', from));
  assert.ok(from > 0 && to > from, 'the memory\'s two doors');
  const host = (onlineOn) => new Function('onlineOn', 'modes', `let _loading = false; ${W.slice(from, to + 5)}
    return { keepSoloMemory, restoreSoloMemory, loading: (v) => { _loading = v; }, memory: () => _soloMemory };`)(onlineOn, modes);
  let ident = null, built = 0;
  const restored = [];
  const modes = { roomIdentity: () => ident, placeSharedWorld: () => ({ locationKey: 'dungeon:7', stamp: `build-${built}`, world: { foes: [] } }), restorePlaceSharedWorld: (m) => restored.push(m.stamp) };
  const hold = roomIdentityIn(locationAt(109, 158));
  // online: out of the Hold and in again
  const h = host(true);
  ident = hold; built = 1;
  h.keepSoloMemory();
  h.restoreSoloMemory();
  assert.deepEqual(restored, ['build-1'], 'the next door in lays the last visit\'s memory back');
  // a shared dungeon keeps nothing here - its room remembers it
  ident = roomIdentityIn(locationAt(120, 150, { name: 'Castle Necromoghan', mapId: 12345 }));
  h.restoreSoloMemory();
  assert.deepEqual(restored, ['build-1'], 'another dungeon is not the Hold');
  // a load is its own time
  ident = hold; built = 2;
  h.loading(true);
  h.keepSoloMemory();
  assert.equal(h.memory(), null, 'the load\'s leave forgets');
  h.restoreSoloMemory();
  h.loading(false);
  h.restoreSoloMemory();
  assert.deepEqual(restored, ['build-1'], 'and nothing is laid over the save\'s own dungeon');
  // offline the Hold is every dungeon's way - built whole at every entry, as DFU builds it
  const off = host(false);
  off.keepSoloMemory();
  assert.equal(off.memory(), null);
  // the doors: the dungeon's leave and its entry, and the load's reset
  assert.match(W, /onDungeonLeave: \(\) => \{[^\n]*keepSoloMemory\(\); gatherHost\?\.leaveDungeon\(\); worldPublish\(performance\.now\(\), true\); \},/, 'while the dungeon still stands');
  assert.match(W, /onTransitionDungeonInterior: \(ctx\) => \{[^\n]*navalTransition\(\); restoreSoloMemory\(\); \},/);
  assert.match(W.slice(W.indexOf('  function overworldLoadReset() {'), W.indexOf('  function applyPose(pose) {')), /\n {4}_soloMemory = null;/);
});

test('AUDIT FB1007b H5: in the Hold the game says the player is alone - never silence on the Local tab, never "not connected" on a page held out, never a party member "with me" in another\'s Hold, and the Online pane says the Hold is each player\'s own', () => {
  // the Local tab's door, executed: in the Hold a line is refused aloud; anywhere else it goes
  const cut = (head, tail = '\n  };\n') => { const at = W.indexOf(head); const end = W.indexOf(tail, at); assert.ok(at > 0 && end > at, head); return W.slice(at, end + tail.length); };
  const send = (ident) => {
    const pushed = [], sent = [];
    const ok = new Function('online', 'modes', 'chatLog', 'chanOld', 'guildOld', 'socialLink', 'chatLinks', 'social', 'myGuildTag',
      'SOLO_LOCAL_TEXT', 'CHAN_OLD_RELAY_TEXT', 'GUILD_OLD_RELAY_TEXT', 'EMOTE_OLD_RELAY_TEXT', 'NO_PARTY_TEXT', 'NO_GUILD_TEXT',
      `${cut('  const soloHere = () =>', ';\n')} ${cut('  const chatSend = (tabId, text, from = tabId, { me = false } = {}) => {')} return chatSend('local', 'hello');`)(
      { status: 'open', emoteOk: true, sendChat: (t) => { sent.push(t); return true; } }, { roomIdentity: () => ident }, { push: (tab, l) => pushed.push([tab, l.text]) },
      () => false, () => false, () => null, new Map(), null, () => null, SOLO_LOCAL_TEXT, 'old', 'old', 'old', 'no party', 'no guild');
    return { ok, pushed, sent };
  };
  assert.deepEqual(send(roomIdentityIn(locationAt(109, 158))), { ok: false, pushed: [['local', SOLO_LOCAL_TEXT]], sent: [] }, 'the Hold: said, and nothing sent');
  assert.deepEqual(send(roomIdentityIn(locationAt(120, 150, { mapId: 12345 }))), { ok: true, pushed: [], sent: ['hello'] }, 'another dungeon: the room hears it');
  assert.match(W, /if \(tabId === 'local' && soloHere\(\)\) return SOLO_LOCAL_TEXT;/, 'the strip says it before a line is typed');
  assert.match(cut('  const chatRoll = (tabId, spec) => {'), /if \(tabId === 'local' && soloHere\(\)\) return why\(SOLO_LOCAL_TEXT\);/, 'and a roll asked there');
  assert.match(cut('  const pageShareHere = () => {'), /: soloHere\(\) \? PAGE_NO_READERS_TEXT/, 'a page held out: nobody near, never "not connected"');
  assert.equal(PAGE_NO_READERS_TEXT, 'No one is near enough to show it to.');
  // the party card: two members, each in their own Hold, are not together
  const inHold = { px: 109, py: 158, in: 1, loc: "Privateer's Hold" };
  assert.equal(withMe({ ...inHold }, { ...inHold }), false, 'each in their own Hold: the place line is drawn');
  assert.equal(withMe({ ...inHold, px: 120, py: 150 }, { ...inHold, px: 120, py: 150 }), true, 'another dungeon: together');
  assert.equal(withMe({ ...inHold, in: 0 }, { ...inHold, in: 0 }), true, 'on the cell\'s ground outside: together');
  assert.match(read('src/ui/enhancedMenu.js'), /talk to each other anywhere\. Privateer\\u2019s Hold, where every character begins, is each player\\u2019s own\. Dungeons and buildings are shared:/);
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
