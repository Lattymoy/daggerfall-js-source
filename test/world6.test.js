// WORLD6a (Mac, 2026-09-14: "Lets tackle #1 next" - towns, cells and
// buildings keep nothing) - SLICE 6a: THE BUILDING IS A WORLD ROOM. A
// building interior has had a relay room of its own since ONLINE1 and
// carried presence alone, because the wire's world-room law admitted
// dungeons only. The law now admits `interior:m<mapId>.<buildingKey>` at
// both ends, and the interior mode has what the dungeon context has had
// since WORLD1, 3 and 4: a MEMORY the host publishes and a joiner restores
// (the opened shelves and cupboards with what is left and the day they
// were stocked, the doors' shared records), the doors as ACTS the moment
// they move, and a container the room has opened as the ROOM'S (claimed on
// the open, said again on a restock and on the close). Nothing of the
// player's own rides: a dropped pile, a treasure roll, an owned house or
// ship's storage. THE LAW EXECUTES: the wire at both ends; the real Room
// keeping a building's memory and handing it to the next joiner, and still
// ignoring a town's; the pure half (world/interiorShared.js) composing,
// projecting and landing on a bare context; and the hosts by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWorldRoom, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { relayVersionAtLeast } from './relayVersion.mjs';
import { roomKeyFor } from '../src/net/online.js';
import { BUILDING_KEY_0, makeBuildingKey } from '../src/systems/talkTopics.js';
import { LOOT_LIST_MAX } from '../src/systems/loot.js';
import { interiorLocationKey, interiorLootKeyOf, interiorLootTarget, interiorLootRecords, applyInteriorLoot, composeInteriorShared, applyInteriorShared, interiorActionRecords } from '../src/world/interiorShared.js';
import { fakeRoom } from './fakeRoom.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const PRIVATEERS = 187853213;
const bare = (list) => list.map(({ value, ...it }) => { void value; return it; });   // AUDIT WORLD6a B1: the projector floors `value` at the template's own; these pins are about the list, not the price
const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = warn; } };

test('WORLD6a: the wire - a building is a world room at both ends (the room roomKeyFor mints, the map id unsigned, the building key up to MakeBuildingKey\'s sentinel), a slugged location or a town is not, and the relay says which one it is', () => {
  assert.equal(isWorldRoom('interior:m187853213.4'), true);
  assert.equal(isWorldRoom(`interior:m1.${BUILDING_KEY_0}`), true, 'the 1<<24 sentinel, eight digits');
  assert.equal(isWorldRoom(`interior:m4294967295.${makeBuildingKey(7, 7, 31)}`), true, 'the unsigned bound and a real key');
  for (const k of ['interior:17.Privateer_s_Hold.4', 'interior:m1.123456789', 'interior:m1.', 'interior:m1', 'interior:m-1.4', 'town:m187853213', 'world:3,12', 'chat:world', 'interior:m1.4.5']) assert.equal(isWorldRoom(k), false, k);
  assert.equal(isWorldRoom('dungeon:m187853213'), true, 'the dungeon still');
  assert.equal(relay.isWorldRoom, isWorldRoom, 'one home');
  const key = roomKeyFor({ host: 'world', mode: 'interior', mapId: PRIVATEERS | 0, buildingKey: 4 });
  assert.equal(key, 'interior:m187853213.4'); assert.equal(isWorldRoom(key), true, 'the room the session joins IS a world room');
  assert.equal(interiorLocationKey(PRIVATEERS | 0, 4), key, 'and the memory\'s key is the same spelling (a signed id read unsigned, AUDIT WORLD34 A2)');
  assert.equal(interiorLocationKey(0, 4), null); assert.equal(interiorLocationKey(5, 0), null, 'no id, no key: no room');
  assert.ok(relayVersionAtLeast(66));   // SRV-N: at or past, never equal
});

test('WORLD6a: the real Room keeps a building\'s memory and hands it to the next joiner; a town\'s frame is still ignored', async () => {
  const r = fakeRoom('interior:m187853213.4');
  const a = r.connect(); const b = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1));
  const world = { locationKey: 'interior:m187853213.4', stamp: 'x1', world: { loot: [{ k: 'shelf:0', r: [], d: 5 }], actions: [{ key: 'door:3', state: 'end', t: 1 }] } };
  await r.world(a, world);
  assert.equal(r.store.get('world:meta')?.by, 'aaaa-0001', 'the host\'s memory, stored');
  await r.hello(b, 'bbbb-0002', at(1, 1));
  assert.deepEqual(ofType(b, 'welcome')[0].world, world, 'the joiner is handed the building as the host left it');
  assert.equal(ofType(b, 'welcome')[0].host, 'aaaa-0001');
  const town = fakeRoom('town:m187853213'); const t = town.connect();
  await town.hello(t, 'tttt-0001', at(1, 1));
  await town.world(t, world);
  assert.equal(town.store.has('world:meta'), false, 'a town keeps no world yet');
});

/** A bare interior context: two shelves (one opened, one never), one cupboard, and an action graph that records. */
const ctxOf = () => {
  const ctx = {
    shelves: [{ items: [{ name: 'Dagger', templateIndex: 1 }, { name: 'Bread', templateIndex: 2 }], stockedDate: 12 }, { items: null, stockedDate: 0 }],
    containers: [{ items: null, stockedDate: 0 }],
    actions: {
      records: [{ key: 'door:0', state: 'start', t: 0, failedSkillLevel: 7 }, { key: 'door:1', state: 'end', t: 1, lock: 3 }],
      restored: [], applied: [],
      collectSaveData() { return this.records.map((r) => ({ ...r })); },
      restoreSaveData(list) { this.restored.push(...list); },
      applyRemote(list) { this.applied.push(...list); return list.length; },
    },
  };
  return ctx;
};

test('WORLD6a: the pure half - the vocabulary is the cache\'s own keys, one spelling each; an opened container is said with what is left and the day it was stocked, a never-opened one is not, and one past the cap stays this player\'s own, said once', () => {
  assert.equal(interiorLootKeyOf('shelf:0'), 'shelf:0'); assert.equal(interiorLootKeyOf('container:12'), 'container:12');
  for (const k of ['shelf:00', 'shelf:1e1', 'loot:0', 'corpse:1', 'droppedLoot:0', 'shelf:', 'shelf:123456', 3]) assert.equal(interiorLootKeyOf(k), null, String(k));
  const ctx = ctxOf();
  assert.equal(interiorLootTarget(ctx, 'shelf:1'), ctx.shelves[1]); assert.equal(interiorLootTarget(ctx, 'container:0'), ctx.containers[0]); assert.equal(interiorLootTarget(ctx, 'shelf:9'), null);
  assert.deepEqual(interiorLootRecords(ctx, ['shelf:0', 'shelf:1', 'container:0', 'loot:0']), [{ k: 'shelf:0', r: [{ name: 'Dagger', templateIndex: 1 }, { name: 'Bread', templateIndex: 2 }], d: 12 }], 'the opened shelf alone (the mint copies; the projection is the reader\'s)');
  assert.notEqual(interiorLootRecords(ctx, ['shelf:0'])[0].r[0], ctx.shelves[0].items[0], 'copies, not the live objects');
  ctx.shelves[0].items = Array.from({ length: LOOT_LIST_MAX + 1 }, () => ({ name: 'x', templateIndex: 6 }));
  const tooBig = new Set();
  const warned = [];
  const warn = console.warn; console.warn = (m) => warned.push(String(m));
  try { assert.deepEqual(interiorLootRecords(ctx, ['shelf:0'], tooBig), []); interiorLootRecords(ctx, ['shelf:0'], tooBig); } finally { console.warn = warn; }
  assert.equal(warned.length, 1, 'said once'); assert.ok(tooBig.has('shelf:0'));
});

test('WORLD6a: the pure half - the room\'s word lands IN PLACE on an opened container, WHOLE on one this client never opened (a second reader adopts the first\'s roll), with the day it was stocked, and never under this player\'s open window', () => {
  const ctx = ctxOf();
  const live = ctx.shelves[0].items;
  const seen = new Set();
  const n = applyInteriorLoot(ctx, [
    { k: 'shelf:0', r: [{ name: 'Bread', templateIndex: 2 }], d: 20 },
    { k: 'shelf:1', r: [{ name: 'Robe', templateIndex: 3 }, { name: 'Boots', templateIndex: 4 }], d: 20 },
    { k: 'container:0', r: [], d: 21 },
    { k: 'loot:0', r: [] }, { k: 'shelf:7', r: [] }, { k: 'shelf:0', r: 'x' },
  ], { seen });
  assert.equal(n, 3);
  assert.equal(ctx.shelves[0].items, live, 'the same array'); assert.deepEqual(bare(live), [{ name: 'Bread', templateIndex: 2 }]); assert.equal(ctx.shelves[0].stockedDate, 20);
  assert.deepEqual(bare(ctx.shelves[1].items), [{ name: 'Robe', templateIndex: 3 }, { name: 'Boots', templateIndex: 4 }], 'never opened here: the room\'s list, whole'); assert.equal(ctx.shelves[1].stockedDate, 20);
  assert.deepEqual(ctx.containers[0].items, [], 'an emptied cupboard is empty here too'); assert.equal(ctx.containers[0].stockedDate, 21);
  assert.deepEqual([...seen].sort(), ['container:0', 'shelf:0', 'shelf:1'], 'the room has spoken about these');
  const before = [...ctx.shelves[0].items];
  applyInteriorLoot(ctx, [{ k: 'shelf:0', r: [], d: 22 }], { seen, openKey: 'shelf:0' });
  assert.deepEqual(ctx.shelves[0].items, before, 'yours until you close it (AUDIT WORLD4 C1)');
});

test('WORLD6a: the pure half - the memory is the opened containers the room knows of and every action record\'s SHARED half; it lands once, projected, never its own or another building\'s; a refused act\'s keys are re-read current', () => {
  const ctx = ctxOf();
  const seen = new Set(['shelf:0']);
  const shared = composeInteriorShared(ctx, { locationKey: 'interior:m5.9', stamp: 'me', seen });
  assert.deepEqual(shared, { locationKey: 'interior:m5.9', stamp: 'me', world: { loot: [{ k: 'shelf:0', r: [{ name: 'Dagger', templateIndex: 1 }, { name: 'Bread', templateIndex: 2 }], d: 12 }], actions: [{ key: 'door:0', state: 'start', t: 0 }, { key: 'door:1', state: 'end', t: 1, lock: 3 }] } }, 'the picker\'s latch stays home (AUDIT WORLD3 B1); the never-opened shelf and the cupboard are not the room\'s');
  assert.equal(composeInteriorShared(ctx, { locationKey: null, stamp: 'me' }), null, 'no key, no memory');
  const joiner = ctxOf(); joiner.shelves[0].items = [{ name: 'Own roll', templateIndex: 5 }]; joiner.shelves[0].stockedDate = 3;
  const jseen = new Set();
  const opts = { locationKey: 'interior:m5.9', stamp: 'them', seen: jseen };
  assert.equal(applyInteriorShared(joiner, { ...shared, locationKey: 'interior:m5.10' }, opts), false, 'another building\'s');
  assert.equal(applyInteriorShared(joiner, shared, { ...opts, stamp: 'me' }), false, 'its own, back from a reconnect (AUDIT WORLD B1)');
  assert.equal(applyInteriorShared(joiner, { ...shared, world: { ...shared.world, actions: [...shared.world.actions, { key: 'door:2', state: 'end', t: 'x' }, null] } }, opts), true);
  assert.deepEqual(joiner.actions.restored, [{ key: 'door:0', state: 'start', t: 0 }, { key: 'door:1', state: 'end', t: 1, lock: 3 }], 'RESTORED (where the doors stand as I walk in), projected - the bad tween and the null dropped (AUDIT WORLD3 A2)');
  assert.deepEqual(joiner.actions.applied, [], 'not heard as a swing');
  assert.deepEqual(bare(joiner.shelves[0].items), [{ name: 'Dagger', templateIndex: 1 }, { name: 'Bread', templateIndex: 2 }]); assert.equal(joiner.shelves[0].stockedDate, 12);
  assert.deepEqual([...jseen], ['shelf:0']);
  assert.deepEqual(interiorActionRecords(ctx, ['door:1', 'shelf:0', 'shelf:1', 'nope'], { locationKey: 'interior:m5.9' }), { k: 'interior:m5.9', a: [{ key: 'door:1', state: 'end', t: 1, lock: 3 }], l: [{ k: 'shelf:0', r: [{ name: 'Dagger', templateIndex: 1 }, { name: 'Bread', templateIndex: 2 }], d: 12 }] });
  assert.equal(interiorActionRecords(ctx, ['shelf:1'], { locationKey: 'interior:m5.9' }), null, 'nothing to say');
  assert.equal(interiorActionRecords(ctx, [], { locationKey: 'interior:m5.9' }), null);
});

test('WORLD6a: the hosts by source - the interior mode keys and stamps its room at the mount (an owned house or ship keeps none), wires the doors\' seam, claims a container on the open, says a restock and the close through the frame\'s settle, fires the leave before both teardowns, and the mode machine dispatches the PLACE; the world host walks the one path; the pane says it', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /const owned = b\?\.buildingType === BUILDING_TYPES\.Ship \|\| isHouseOwned\(playerEntity\.houses \?\? \[\], b\?\.regionIndex \?\? 0, b\?\.buildingKey\);\s*_intShared = mintInteriorShared\(interiorLocationKey\(questSceneCtx\?\.\(\)\?\.mapId \?\? 0, b\?\.buildingKey \?\? 0\), \{ owned \}\);[^\n]*\n\s*const key = _intShared\.locationKey;\s*if \(key\) ctx\.actions\.onChanged = \(recs\) => host\.onActions\?\.\(\{ k: key, a: recs \}\);/, 'the mount (AUDIT WORLD6a A1: the bag from the one mint; B6: any ship is owned)');
  assert.match(m, /fresh = true;   \/\/ AUDIT WORLD6a A5/, 'a cupboard\'s restock is said at the window');
  assert.match(m, /if \(win\) \{ interiorOverlay = win; if \(!owned\) interiorLootOpened\(key, win, \{ fresh \}\); \}/, 'a stranger\'s cupboard claimed on the open, an owner\'s never');
  assert.match(m, /const fresh = needsRestock\(shelf, today\);/, 'a shelf\'s restock is the open\'s word');
  assert.match(m, /if \(win\) \{ interiorOverlay = win; interiorLootOpened\(`shelf:\$\{i\}`, win, \{ fresh \}\); \}/, 'the closed shop\'s shelf, on the open');
  assert.match(m, /const w = openTradeWindow\(shelf, b, 'Buy'\);\s*if \(!w\) return;[^\n]*\n\s*interiorOverlay = w;\s*interiorLootOpened\(`shelf:\$\{i\}`, interiorOverlay, \{ fresh \}\);/, 'the trade window\'s shelf, on the open');   // DISC10-E L3 re-aim: a counter the door refused (null) claims nothing
  assert.match(m, /showShelfList\(shelf, 0, fresh\);/, 'the keyed fallback too (AUDIT WORLD6a A4)');
  assert.match(m, /if \(si >= 0\) interiorLootOpened\(`shelf:\$\{si\}`, interiorOverlay, \{ fresh \}\);/, 'every page of it an open');
  assert.match(m, /const at = shelf\.items\.indexOf\(it\);\s*if \(at < 0\) return undefined;/, 'a row the shelf no longer holds buys nothing');
  assert.match(m, /if \(shelf\) interiorLootOpened\('shelf:0', win, \{ fresh \}\);/, 'the merchant\'s sell screen');
  assert.match(m, /if \(mode === 'interior'\) interiorLootSettle\(\);/, 'the close is the frame\'s settle');
  assert.match(m, /function interiorLootSettle\(\) \{\s*const s = _intShared;\s*if \(!s\?\.openWin\) return;\s*if \(interiorWindows\.containsWindow\(s\.openWin\) && !s\.openWin\.done\) return;\s*const k = s\.openKey;\s*s\.openKey = null; s\.openWin = null;\s*interiorPublishLoot\(k\);\s*\}/, 'gone from the STACK, not from the slot (AUDIT WORLD6a A3)');
  assert.match(m, /if \(claim && s\.seen\.has\(canon\)\) return false;[\s\S]{0,400}?if \(first\) host\.onLootClaimed\?\.\(\);/, 'a claim speaks once; the memory is due on a first claim');
  assert.equal((m.match(/host\.onInteriorLeave\?\.\(\);/g) ?? []).length, 2, 'the two teardowns, no third');
  assert.match(m, /cacheInteriorScene\(\);\s*host\.onInteriorLeave\?\.\(\);   \/\/ WORLD6a[^\n]*\n\s*teardownQuestFlats\(\);/, 'the exit: after the cache, before the teardown');
  assert.match(m, /placeSharedWorld\(\) \{\s*if \(mode === 'dungeon'\) return dungeonCtx \? dungeonCtx\.sharedWorld\(\) : null;\s*return mode === 'interior' && interiorCtx && _intShared\?\.locationKey \? composeInteriorShared\(interiorCtx, _intShared\) : null;/);
  assert.match(m, /\{ kind: 'interior', buildingKey: _intShared\?\.owned \? 0 : \(interiorBuilding\?\.buildingKey \?\? 0\) \}/, 'an owned building keeps no room at all (AUDIT WORLD6a A6/B6)');
  assert.match(m, /restorePlaceSharedWorld\(shared\) \{[\s\S]*?if \(ok\) _intShared\.applied = true;/, 'the memory lands once per context');
  assert.match(m, /applyPlaceActions\(id, data\) \{[\s\S]*?data\.k !== _intShared\.locationKey\) return false;/, 'another building\'s act is not this one\'s');
  assert.match(m, /placeActionRecords\(keys\) \{[\s\S]*?interiorActionRecords\(interiorCtx, keys, \{ locationKey: _intShared\.locationKey, tooBig: _intShared\.tooBig \}\)/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /const shared = modes\?\.placeSharedWorld\?\.\(\);/); assert.match(w, /modes\?\.restorePlaceSharedWorld\?\.\(shared\)/); assert.match(w, /modes\?\.applyPlaceActions\?\.\(id, data\)/);
  assert.equal((w.match(/modes\?\.placeActionRecords\?\./g) ?? []).length, 2, 'the act and the flush');
  assert.match(w, /onInteriorLeave: \(\) => worldPublish\(performance\.now\(\), true\),/);
  assert.match(rd('src/ui/enhancedMenu.js'), /A building is a shared world too: its doors, and every shelf and cupboard anyone has opened, are the same for everyone in it, and it remembers\. Towns and the open country share who is there and the creatures that find you: what one player meets, everyone nearby sees and fights - and its creatures can hurt you too\./);
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## WORLD6 \(2026-09-14\)/, 'the record');
});
