// SD-ONLINE (2026-10-05, Mac: "So medium dungeons will be the new by default option thats on (online only)", then "On
// second thought. Large, medium and small should all play into account online" - and, asked which, "World mixes
// sizes"; bible/11-Multiplayer/Super-Dungeons.md section 13): ONLINE EVERY DUNGEON HAS ITS OWN SIZE, THE WORLD'S.
//
// THE DELVE ARC shipped Medium Dungeons (DSIZE1) as an Enhanced row, refused online - every peer in a dungeon's room
// must lay one layout, and the settings are each player's own (AUDIT WORLD34 B2 made that layout the whole dungeon).
// Online the size is the world's now: one draw of the port's seeded die on the dungeon's map id gives it small, medium
// or large - half of them medium - the same on every client and every visit, whatever either switch says
// (world/smallerDungeons.js onlineDungeonSize). A quest started online is stamped with the world's sizes, so offline it
// builds its dungeons at them too; a quest stamped at another size is re-laid on the room's build when loaded online
// (quest/questRepair.js relayOnlineDungeons - test/dsize1_mediumdungeons.test.js holds its arms); offline the
// `world-dungeon-sizes` row asks for the world's sizes, and online the lane forces it on, so the sync copies it home.
// And since an older page lays every dungeon whole while the relay keeps a room's memory for thirty days, A DUNGEON'S
// ROOM IS ITS LAYOUT'S (net/online.js roomKeyFor; net/wire.js WORLD_ROOM and DUNGEON_ROOM_TAGS), as a building's is
// (WD3): `dungeon:m<id>.s`, `dungeon:m<id>.m`, or the plain room for the whole dungeon, which keeps its memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  dungeonLocationFor, dungeonSizeFor, builtDungeonSize, generateMediumDungeon, generateSmallerDungeon, onlineDungeonSize,
  smallerDungeonsStateNow, ONLINE_DUNGEON_SIZES, ONLINE_DUNGEON_SIZE_SALT, ONLINE_DUNGEONS_STATE, MEDIUM_DUNGEONS_STATE,
  SMALLER_DUNGEONS_STATE, MEDIUM_DUNGEON_THRESHOLD, SMALLER_DUNGEON_THRESHOLD, WORLD_DUNGEON_SIZES_PREF, worldDungeonSizesWanted,
} from '../src/world/smallerDungeons.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { UNDERCROFT_LOCATION_ID } from '../src/world/arenaCity.js';
import { seededFirst } from '../src/systems/wind.js';
import { roomKeyFor, OnlineSession } from '../src/net/online.js';
import { isWorldRoom, dungeonRoomTag, DUNGEON_ROOM_TAGS, roomOf, PIXEL_UNITS, WORLD_PREFIX } from '../src/net/wire.js';
import { FEATURES } from '../src/systems/features.js';
import { ONLINE_FORCED_PREFS } from '../src/systems/onlineLane.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const stored = (r) => { const meta = r.store.get('world:meta'); return meta ? JSON.parse(Array.from({ length: meta.chunks }, (_, i) => r.store.get('world:' + i)).join('')) : null; };

const PRIVATEERS_HOLD = 187853213;   // a main-story keep (world/dungeonTextures.js MAIN_STORY_DUNGEON_IDS)
// three map ids the draw sends to each size (pinned below, so a changed salt or weight moves them loudly)
const SMALL_ID = 700, MEDIUM_ID = 701, LARGE_ID = 704;
const block = (name) => ({ blockName: name, x: 9, z: 9, isStartingBlock: false });
/** n blocks, a third of them border blocks (`B...`), the rest the interior pools' names. */
const loc = (n, mapId) => ({
  name: `Keep ${mapId}`, regionIndex: 17, hasDungeon: true, mapTableData: { mapId },
  dungeon: { blocks: Array.from({ length: n }, (_, i) => block(`${i % 3 === 0 ? 'B' : i % 3 === 1 ? 'N' : 'W'}00000${String(i).padStart(2, '0')}.RDB`)) },
});
const room = (l) => roomKeyFor({ host: 'world', mode: 'dungeon', mapId: l.mapTableData.mapId, regionIndex: l.regionIndex, locationName: l.name, size: builtDungeonSize(l) });

test('SD-ONLINE: the world\'s sizes - small 1, medium 2, large 1, frozen; one draw of the port\'s seeded die on the map id and its own salt; the same answer every time, for the unsigned id', () => {
  assert.deepEqual(ONLINE_DUNGEON_SIZES.map((r) => [...r]), [['small', 1], ['medium', 2], ['full', 1]]);
  assert.ok(Object.isFrozen(ONLINE_DUNGEON_SIZES) && ONLINE_DUNGEON_SIZES.every(Object.isFrozen));
  assert.equal(ONLINE_DUNGEON_SIZE_SALT, 0x5d1e5a2b);
  assert.equal(onlineDungeonSize(loc(20, SMALL_ID)), 'small');
  assert.equal(onlineDungeonSize(loc(20, MEDIUM_ID)), 'medium');
  assert.equal(onlineDungeonSize(loc(20, LARGE_ID)), 'full');
  // the law, recomputed from the die itself: the draw is the salted id's first, scaled by the weights' sum
  for (const id of [SMALL_ID, MEDIUM_ID, LARGE_ID, PRIVATEERS_HOLD, 1291010263, 0x80000001]) {
    const u = seededFirst(id ^ ONLINE_DUNGEON_SIZE_SALT) * 4;
    assert.equal(onlineDungeonSize(loc(5, id)), u < 1 ? 'small' : u < 3 ? 'medium' : 'full', `map ${id}`);
  }
  assert.equal(onlineDungeonSize(loc(5, -1)), onlineDungeonSize(loc(5, 4294967295)), 'a map id read signed is the same dungeon (AUDIT WORLD34 A1)');
  assert.equal(onlineDungeonSize({ mapTableData: {} }), 'full', 'no map id: the whole dungeon');
  assert.equal(onlineDungeonSize(null), 'full');
  // and across the Bay's number range the weights hold: a quarter small, half medium, a quarter large
  const n = { small: 0, medium: 0, full: 0 };
  const N = 40000;
  for (let i = 1; i <= N; i++) n[onlineDungeonSize({ mapTableData: { mapId: Math.imul(i, 2654435761) >>> 0 } })]++;
  assert.ok(Math.abs(n.small / N - 0.25) < 0.02, `small ${n.small}`);
  assert.ok(Math.abs(n.medium / N - 0.5) < 0.02, `medium ${n.medium}`);
  assert.ok(Math.abs(n.full / N - 0.25) < 0.02, `large ${n.full}`);
});

test('SD-ONLINE: the size law - online the world\'s size whatever either switch or a quest\'s copy says, the guards first; offline a quest stamped with the world\'s sizes builds at them, and the world-sizes ask sits under Smaller and over Medium', () => {
  for (const id of [SMALL_ID, MEDIUM_ID, LARGE_ID]) {
    const l = loc(20, id);
    for (const setting of [false, true]) for (const medium of [false, true]) {
      assert.equal(dungeonSizeFor(l, { setting, medium, world: false, online: true }), onlineDungeonSize(l), `online ${id}: the world's, setting ${setting} medium ${medium}`);
    }
    const machine = (state) => ({ getSiteLinks: () => [{ questUID: 1 }], getQuest: () => ({ smallerDungeonsState: state }) });
    assert.equal(dungeonSizeFor(l, { online: true, setting: false, medium: false, questMachine: machine(SMALLER_DUNGEONS_STATE.Enabled) }), onlineDungeonSize(l), 'online, not even a quest\'s frozen copy');
    // offline: a quest stamped with the world's sizes builds its dungeon at the world's size for it
    assert.equal(dungeonSizeFor(l, { setting: true, medium: true, world: false, questMachine: machine(ONLINE_DUNGEONS_STATE) }), onlineDungeonSize(l), 'the size its markers know');
    // offline asks: Smaller wins, then the world's sizes, then medium, then the whole
    assert.equal(dungeonSizeFor(l, { setting: true, medium: true, world: true }), 'small');
    assert.equal(dungeonSizeFor(l, { setting: false, medium: true, world: true }), onlineDungeonSize(l));
    assert.equal(dungeonSizeFor(l, { setting: false, medium: true, world: false }), 'medium');
    assert.equal(dungeonSizeFor(l, { setting: false, medium: false, world: false }), 'full');
  }
  // the guards come first, online too: the main story's keeps and the arena's undercroft stay whole
  assert.equal(onlineDungeonSize(loc(20, PRIVATEERS_HOLD)), 'medium', 'its draw is medium...');
  assert.equal(dungeonSizeFor(loc(20, PRIVATEERS_HOLD), { online: true }), 'full', '...and the main story never shrinks');
  const undercroft = { ...loc(32, SMALL_ID), arenaUndercroft: true, dungeon: { ...loc(32, SMALL_ID).dungeon, recordElement: { header: { locationId: UNDERCROFT_LOCATION_ID } } } };
  assert.equal(dungeonSizeFor(undercroft, { online: true }), 'full', 'the fighters\' hall keeps its blocks (ARENA5)');
  assert.equal(dungeonSizeFor({ hasDungeon: false }, { online: true }), 'full');
  // the quest stamp: online the world's sizes, whatever the switches say; offline too when they are asked for
  assert.equal(smallerDungeonsStateNow(true, true, true, false), ONLINE_DUNGEONS_STATE);
  assert.equal(smallerDungeonsStateNow(false, false, true, false), ONLINE_DUNGEONS_STATE);
  assert.equal(smallerDungeonsStateNow(false, true, false, true), ONLINE_DUNGEONS_STATE, 'offline, asked for: the world\'s');
  assert.equal(smallerDungeonsStateNow(true, true, false, true), SMALLER_DUNGEONS_STATE.Enabled, 'Smaller wins');
  assert.equal(smallerDungeonsStateNow(false, true, false, false), MEDIUM_DUNGEONS_STATE);
  assert.equal(ONLINE_DUNGEONS_STATE, 4, 'appended past the medium size (3), itself past DFU\'s three');
});

test('SD-ONLINE: the build says its size - builtDungeonSize reads the clone, so a dungeon at or under a size\'s threshold is whole whatever was asked', () => {
  assert.equal(builtDungeonSize(generateMediumDungeon(loc(20, 1))), 'medium');
  assert.equal(builtDungeonSize(generateSmallerDungeon(loc(20, 1))), 'small');
  assert.equal(builtDungeonSize(loc(20, 1)), 'full', 'the source is untouched');
  assert.equal(builtDungeonSize(generateMediumDungeon(loc(MEDIUM_DUNGEON_THRESHOLD, 1))), 'full', 'eight blocks: no regeneration, the whole dungeon');
  assert.equal(builtDungeonSize(generateSmallerDungeon(loc(SMALLER_DUNGEON_THRESHOLD, 1))), 'full');
  assert.equal(builtDungeonSize(null), 'full');
  assert.equal(builtDungeonSize({ dungeon: { medium: 'yes' } }), 'full', 'the flag is the boolean the clone writes (FT1), nothing looser');
});

test('SD-ONLINE: the room is the layout\'s - roomKeyFor mints `.m` and `.s` for the re-laid sizes and nothing for the whole; WORLD_ROOM admits exactly those', () => {
  assert.deepEqual({ ...DUNGEON_ROOM_TAGS }, { medium: '.m', small: '.s' });
  assert.ok(Object.isFrozen(DUNGEON_ROOM_TAGS));
  assert.equal(dungeonRoomTag('medium'), '.m');
  assert.equal(dungeonRoomTag('small'), '.s');
  assert.equal(dungeonRoomTag('full'), '');
  assert.equal(dungeonRoomTag(null), '');
  assert.equal(dungeonRoomTag('toString'), '', 'an own key alone - not the prototype\'s');
  const base = { host: 'world', mode: 'dungeon', mapId: PRIVATEERS_HOLD };
  assert.equal(roomKeyFor(base), `dungeon:m${PRIVATEERS_HOLD}`, 'no size: the room it always was');
  assert.equal(roomKeyFor({ ...base, size: 'full' }), `dungeon:m${PRIVATEERS_HOLD}`);
  assert.equal(roomKeyFor({ ...base, size: 'medium' }), `dungeon:m${PRIVATEERS_HOLD}.m`);
  assert.equal(roomKeyFor({ ...base, size: 'small' }), `dungeon:m${PRIVATEERS_HOLD}.s`);
  assert.equal(roomKeyFor({ ...base, mapId: -1 >>> 0, size: 'medium' }), 'dungeon:m4294967295.m', 'the unsigned bound, ten digits and the tag');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: PRIVATEERS_HOLD, buildingKey: 5, size: 'medium' }), `interior:m${PRIVATEERS_HOLD}.5`, 'a building\'s room reads its own layout (WD3), never a dungeon\'s size');
  for (const k of [`dungeon:m${PRIVATEERS_HOLD}`, `dungeon:m${PRIVATEERS_HOLD}.m`, `dungeon:m${PRIVATEERS_HOLD}.s`, 'dungeon:m4294967295.s']) assert.equal(isWorldRoom(k), true, `${k} keeps its own memory`);
  for (const k of [`dungeon:m${PRIVATEERS_HOLD}.l`, `dungeon:m${PRIVATEERS_HOLD}.mm`, `dungeon:m${PRIVATEERS_HOLD}.M`, `dungeon:m${PRIVATEERS_HOLD}.`, `dungeon:m${PRIVATEERS_HOLD}m`, 'dungeon:m0.m', 'dungeon:m01.s', 'dungeon:17.keep.m', `interior:m${PRIVATEERS_HOLD}.5.m`]) {
    assert.equal(isWorldRoom(k), false, `${k}: the wire admits exactly what the game names (AUDIT WORLD6a B4)`);
  }
  assert.equal(roomOf(`/room/dungeon:m${PRIVATEERS_HOLD}.s`), `dungeon:m${PRIVATEERS_HOLD}.s`, 'the worker routes the key');
});

test('SD-ONLINE: driven end to end - the online size law, the build and its room: each size its own room, a main-story keep and a dungeon no bigger than its size in the rooms they always had', () => {
  const small = dungeonLocationFor(loc(20, SMALL_ID), { online: true, setting: false, medium: true });
  assert.equal(small.dungeon.blocks.length, 5);
  assert.equal(room(small), `dungeon:m${SMALL_ID}.s`);
  const medium = dungeonLocationFor(loc(20, MEDIUM_ID), { online: true, setting: true, medium: false });
  assert.equal(medium.dungeon.blocks.length, 8);
  assert.equal(room(medium), `dungeon:m${MEDIUM_ID}.m`);
  const large = dungeonLocationFor(loc(20, LARGE_ID), { online: true, setting: true, medium: true });
  assert.equal(large.dungeon.blocks.length, 20, 'large: the dungeon as MAPS.BSA has it');
  assert.equal(room(large), `dungeon:m${LARGE_ID}`, '...in the room an older page stands in too - the same layout');
  for (const l of [small, medium, large]) assert.equal(isWorldRoom(room(l)), true);
  const keep = dungeonLocationFor(loc(20, PRIVATEERS_HOLD), { online: true });
  assert.equal(room(keep), `dungeon:m${PRIVATEERS_HOLD}`, 'the main story keeps its room and its memory');
  assert.equal(room(dungeonLocationFor(loc(8, MEDIUM_ID), { online: true })), `dungeon:m${MEDIUM_ID}`, 'at or under its size: the whole dungeon, the old room');
  assert.equal(room(dungeonLocationFor(loc(5, SMALL_ID), { online: true })), `dungeon:m${SMALL_ID}`);
});

test('SD-ONLINE: the hosts carry the size - the mode machine\'s identity reads the build, the world host hands it to roomKeyFor', () => {
  const m = rd('src/scenes/worldModes.js'), w = rd('src/scenes/world.js');
  assert.match(m, /import \{ dungeonLocationFor, builtDungeonSize \} from '\.\.\/world\/smallerDungeons\.js';/);
  assert.match(m, /\{ kind: 'dungeon', mapId: dungeonLoc\?\.mapTableData\?\.mapId \?\? null, regionIndex: dungeonLoc\?\.regionIndex \?\? -1, name: dungeonLoc\?\.name \?\? '', size: builtDungeonSize\(dungeonLoc\) \}/, 'the identity is the BUILT location\'s (dungeonLoc is the sized copy the context was built from)');
  assert.match(m, /dungeonLoc = dfLocation;/, '...which is the one the transition built');
  assert.match(w, /layout: ident\?\.layout \?\? null,[^\n]*\n\s*size: ident\?\.kind === 'dungeon' \? \(ident\.size \?\? null\) : null,/, 'the room is named with it');
  assert.match(rd('src/net/online.js'), /if \(mode === 'dungeon'\) return loc \? `dungeon:\$\{loc\}\$\{dungeonRoomTag\(size\)\}` : null;/);
});

test('SD-ONLINE: the row - the world\'s sizes, Enhanced, off by default offline and forced ON online, under DFU\'s switch and the medium row; the medium row forced off online', () => {
  const ids = FEATURES.map((f) => f.id);
  assert.deepEqual(ids.slice(ids.indexOf('smaller-dungeons'), ids.indexOf('smaller-dungeons') + 3), ['smaller-dungeons', 'medium-dungeons', 'world-dungeon-sizes']);
  const f = FEATURES.find((x) => x.id === 'world-dungeon-sizes');
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual({ ...f.control }, { store: 'prefs', key: WORLD_DUNGEON_SIZES_PREF, initial: false, online: true });
  assert.match(f.note, /small, medium or large, half of them medium/);
  assert.match(f.note, /Online it is always on\./);
  assert.equal(ONLINE_FORCED_PREFS.worldDungeonSizes, true, 'the lane learned it from the row (RF4)');
  assert.equal(ONLINE_FORCED_PREFS.mediumDungeons, false);
  const skin = uiSkin(), pref = getPref(WORLD_DUNGEON_SIZES_PREF);
  try {
    setUiSkin('enhanced'); setPref(WORLD_DUNGEON_SIZES_PREF, true);
    assert.equal(worldDungeonSizesWanted(), true);
    setUiSkin('classic');
    assert.equal(worldDungeonSizesWanted(), false, 'the classic skin is DFU\'s (the room\'s law online asks no skin)');
  } finally { setUiSkin(skin); setPref(WORLD_DUNGEON_SIZES_PREF, pref); }
});

test('SD-ONLINE: the session - the medium and the small rooms are world rooms, so their host publishes the memory there', () => {
  for (const key of [`dungeon:m${MEDIUM_ID}.m`, `dungeon:m${SMALL_ID}.s`]) {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    quiet(() => s.join(key, at(1, 1))); const ws = sockets[0]; ws.open();
    quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null }));
    assert.equal(s.isHost(), true);
    assert.equal(s.sendWorld({ locationKey: 'dungeon:4', world: { foes: [] } }), true, `${key}: the memory goes`);
    assert.equal(ws.sent.filter((t) => String(t).startsWith(WORLD_PREFIX)).length, 1);
  }
});

test('SD-ONLINE: the relay - each size\'s room keeps its own memory, apart from the others\', and hands a joiner its own', async () => {
  const mem = (n) => ({ locationKey: 'dungeon:4', world: { foes: Array.from({ length: n }, (_, i) => ({ health: i })) } });
  const rooms = { whole: fakeRoom(`dungeon:m${LARGE_ID}`), medium: fakeRoom(`dungeon:m${LARGE_ID}.m`), small: fakeRoom(`dungeon:m${LARGE_ID}.s`) };
  const foes = { whole: 14, medium: 6, small: 3 };
  for (const [k, r] of Object.entries(rooms)) { const h = r.connect(); await r.hello(h, 'host-0001', at(1, 1)); await r.world(h, mem(foes[k])); }
  for (const [k, r] of Object.entries(rooms)) assert.deepEqual(stored(r), mem(foes[k]), `${k}: its own ${foes[k]} foes by index, never another layout's`);
  const j = rooms.small.connect(); await rooms.small.hello(j, 'join-0002', at(1, 1));
  assert.deepEqual(j.sent.find((m) => m.t === 'welcome')?.world, mem(3), 'the small room\'s joiner is handed the small memory');
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('SD-ONLINE against MAPS.BSA: every dungeon builds online at the world\'s size without a throw - the three sizes all stand in the Bay, the main story whole, every re-laid one in its own room', { skip: skipReal }, async () => {
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const built = { small: 0, medium: 0, full: 0 };
  const rooms = new Set();
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    for (let l = 0; l < (region?.locationCount ?? 0); l++) {
      const location = maps.getLocation(r, l);
      if (!location?.hasDungeon) continue;
      const out = dungeonLocationFor(location, { online: true });
      const size = builtDungeonSize(out);
      if (isMainStoryDungeon(location.mapTableData.mapId)) assert.equal(size, 'full', `${location.name}: the main story is whole`);
      built[size]++;
      const k = room(out);
      assert.equal(isWorldRoom(k), true, `${location.name}: ${k} keeps a world`);
      assert.ok(!rooms.has(k), `${k}: one dungeon, one room`);
      rooms.add(k);
    }
  }
  assert.ok(built.small > 400 && built.medium > 600 && built.full > 1500, `the three sizes all stand: ${JSON.stringify(built)}`);
});
