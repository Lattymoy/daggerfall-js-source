// AUDIT WORLD6a (Mac, 2026-09-14: "Audit before we move on") - three opus
// lenses over the building-as-a-world-room slice: the wire and the relay;
// the interior's live wiring; the pure half and the gaps. THE ONE ROOT
// (A1, CRITICAL): the building's memory was NEVER published - the interior
// mode's bag spelled its key `key`, the pure half read `locationKey`, and
// the only pin on the call site was a source regex that matched the broken
// line verbatim. The bag is minted in the pure half now and this file
// EXECUTES the composition through it. Beside it: a peer minted priced
// goods onto a shop's shelf (B1 - the projector floors an item's value at
// the template's own); the stocked day landed unread (A2/B2 - bounded by
// tomorrow and forward-only); a window pushed over an open shelf was taken
// for its close (A3 - the stack is asked); the keyed shop fallback claimed
// nothing and a stale row bought the wrong item (A4); a restock was said
// before the private-property prompt (A5 - said at the window); an owned
// house and any ship keep no room at all (A6/B6); the first act in a new
// building was dropped (A7); a building's foes frame was a dungeon
// heartbeat (B8); the law admitted keys no end mints (B4) and spelt a
// negative key two ways (B5); an interior's memory has its own, smaller
// cap at both ends (B3); the stamp is twelve digits always (B7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWorldRoom, worldFrameMaxFor, WORLD_FRAME_MAX, WORLD_FRAME_MAX_INTERIOR, mintSharedStamp, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { roomKeyFor, OnlineSession } from '../src/net/online.js';
import { validLootItem, validLootList } from '../src/systems/loot.js';
import { itemBaseValue, templateByIndex } from '../src/systems/itemTemplates.js';
import { needsRestock } from '../src/systems/shopStock.js';
import { mintInteriorShared, composeInteriorShared, applyInteriorShared, applyInteriorLoot, interiorLocationKey } from '../src/world/interiorShared.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const ctxOf = () => ({
  shelves: [{ items: [{ name: 'Dagger', templateIndex: 1 }], stockedDate: 12 }, { items: null, stockedDate: 0 }],
  containers: [{ items: null, stockedDate: 0 }],
  actions: { records: [{ key: 'door:0', state: 'end', t: 1, failedSkillLevel: 3 }], restored: [], collectSaveData() { return this.records.map((r) => ({ ...r })); }, restoreSaveData(l) { this.restored.push(...l); }, applyRemote(l) { return l.length; } },
});

test('AUDIT WORLD6a A1 (THE ROOT): the memory composes through THE BAG THE MODE HANDS IN - minted by the pure half, its key spelled as the pure half reads it - so the building is published; the bag refuses to compose without a key, and an owned building has none', () => {
  const bag = mintInteriorShared(interiorLocationKey(187853213, 4));
  assert.equal(bag.locationKey, 'interior:m187853213.4');
  assert.deepEqual(Object.keys(bag).sort(), ['applied', 'locationKey', 'openKey', 'openWin', 'owned', 'seen', 'stamp', 'tooBig']);
  bag.seen.add('shelf:0');
  const shared = composeInteriorShared(ctxOf(), bag);
  assert.ok(shared, 'the memory composes - before A1 every publish answered null and no building was ever remembered');
  assert.equal(shared.locationKey, 'interior:m187853213.4'); assert.equal(shared.stamp, bag.stamp);
  assert.deepEqual(shared.world.loot.map((r) => r.k), ['shelf:0']);
  assert.deepEqual(shared.world.actions, [{ key: 'door:0', state: 'end', t: 1 }]);
  assert.equal(composeInteriorShared(ctxOf(), { key: 'interior:m187853213.4', stamp: 'x', seen: new Set(['shelf:0']) }), null, 'a bag spelt the old way composes nothing - which is what the slice shipped');
  const owned = mintInteriorShared(interiorLocationKey(187853213, 4), { owned: true });
  assert.equal(owned.locationKey, null); assert.equal(owned.owned, true);
  assert.equal(composeInteriorShared(ctxOf(), owned), null, 'an owned house keeps no memory');
  assert.equal(applyInteriorShared(ctxOf(), shared, owned), false, 'and takes none');
  assert.equal(applyInteriorShared(ctxOf(), shared, mintInteriorShared('interior:m187853213.4')), true, 'another context in the same building takes it');
  assert.match(rd('src/scenes/worldModes.js'), /_intShared = mintInteriorShared\(interiorLocationKey\(questSceneCtx\?\.\(\)\?\.mapId \?\? 0, b\?\.buildingKey \?\? 0\), \{ owned \}\);/, 'the mode mints through the one home');
  assert.equal((rd('src/scenes/worldModes.js').match(/_intShared\??\.key\b/g) ?? []).length, 0, 'no site reads the old spelling');
});

test('AUDIT WORLD6a B1: the price is not the wire\'s - a landed item\'s value is floored at what the port itself mints for its template and material, an unknown template is no item, and an honest higher value stands', () => {
  const forged = { templateIndex: 120, group: 'Weapons', material: 9, value: 0, name: 'Dai-Katana' };   // Daedric, priced at nothing
  const out = validLootItem(forged);
  assert.ok(out && out.value === itemBaseValue(forged) && out.value > 1000, `a Daedric weapon lands at its own price (${out?.value}), not for two gold`);
  assert.equal(validLootItem({ templateIndex: 120, value: 999999 }).value, 999999, 'an honest value above the floor stands (an enchantment\'s worth)');
  assert.equal(validLootItem({ templateIndex: 120 }).value, itemBaseValue({ templateIndex: 120 }), 'no value: the template\'s');
  const unknown = [65535, 60000].find((i) => !templateByIndex(i));
  assert.equal(validLootItem({ templateIndex: unknown }), null, 'a template the port does not have is not an item');
  assert.equal(validLootList([{ templateIndex: 1 }, { templateIndex: unknown }]), null, 'one refuses the list');
});

test('AUDIT WORLD6a A2/B2/A3: the stocked day is projected like the list - refused whole past tomorrow, when not a number, or negative; landed no earlier than the day the shelf already had; a frozen shelf cannot be sold to a client', () => {
  const today = 405100;
  const ctx = ctxOf();
  const seen = new Set();
  assert.equal(applyInteriorLoot(ctx, [{ k: 'shelf:1', r: [], d: 1e15 }], { seen, today }), 0, 'a day from the far future is refused whole');
  assert.equal(ctx.shelves[1].items, null, 'and its list did not land either'); assert.equal(seen.size, 0);
  for (const d of ['20', NaN, -1, today + 2, Infinity]) assert.equal(applyInteriorLoot(ctx, [{ k: 'shelf:1', r: [], d }], { seen, today }), 0, `d=${d} refused`);
  assert.equal(applyInteriorLoot(ctx, [{ k: 'shelf:1', r: [], d: today + 1 }], { seen, today }), 1, 'tomorrow is a clock a day off, not the future');
  assert.equal(ctx.shelves[1].stockedDate, today + 1);
  assert.equal(applyInteriorLoot(ctx, [{ k: 'shelf:1', r: [{ templateIndex: 1 }], d: today - 5 }], { seen, today }), 1, 'a stale close lands its list...');
  assert.equal(ctx.shelves[1].stockedDate, today + 1, '...but never moves the day backwards - the new day\'s roll is not un-restocked');
  assert.equal(needsRestock(ctx.shelves[1], today), false);
  assert.equal(applyInteriorLoot(ctx, [{ k: 'shelf:0', r: [], d: 20.9 }], { seen }), 1, 'without a today (a test\'s bare context) the bound is the number\'s shape alone');
  assert.equal(ctx.shelves[0].stockedDate, 20, 'floored');
  assert.match(rd('src/scenes/worldModes.js'), /applyInteriorShared\(interiorCtx, shared, \{ \.\.\._intShared, today: stockedToday\(\) \}\)/, 'the mode hands today in, for the memory');
  assert.match(rd('src/scenes/worldModes.js'), /applyInteriorLoot\(interiorCtx, data\.l, \{ seen: _intShared\.seen, openKey: _intShared\.openKey, today: stockedToday\(\) \}\)/, 'and for an act');
});

test('AUDIT WORLD6a B3/B4/B5: the law admits exactly what the game names (no zero, no leading zero, in either number); a building\'s memory has its own cap at the relay and at the client; the session spells a negative key as the memory does', async () => {
  for (const k of ['interior:m1.0', 'interior:m0.16777216', 'interior:m0187853213.4', 'interior:m187853213.04', 'dungeon:m0', 'dungeon:m0187']) assert.equal(isWorldRoom(k), false, k);
  for (const k of ['interior:m1.1', 'interior:m4294967295.16777216', 'dungeon:m1', 'dungeon:m4294967295']) assert.equal(isWorldRoom(k), true, k);
  assert.equal(relay.isWorldRoom, isWorldRoom);
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 5, buildingKey: -3 }), `interior:m5.${(-3) >>> 0}`, 'unsigned, as the map id is');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 5, buildingKey: -3 }), interiorLocationKey(5, -3), 'one spelling at both ends');
  assert.equal(worldFrameMaxFor('interior:m5.4'), WORLD_FRAME_MAX_INTERIOR); assert.equal(worldFrameMaxFor('dungeon:m5'), WORLD_FRAME_MAX);
  assert.ok(WORLD_FRAME_MAX_INTERIOR < WORLD_FRAME_MAX / 4);
  assert.equal(relay.worldFrameMaxFor, worldFrameMaxFor, 'one home');
  // the relay: a building's memory past its cap is ignored, not stored; under it, kept
  const r = fakeRoom('interior:m187853213.4');
  const a = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1));
  const big = { locationKey: 'interior:m187853213.4', stamp: 'x', world: { loot: [{ k: 'shelf:0', r: [], d: 1 }], pad: 'x'.repeat(WORLD_FRAME_MAX_INTERIOR) } };
  await r.world(a, big);
  assert.equal(r.store.has('world:meta'), false, 'past the interior\'s cap: ignored, and no offence'); assert.equal(a.closed, null);
  await r.world(a, { locationKey: 'interior:m187853213.4', stamp: 'x', world: { loot: [], actions: [] } });
  assert.equal(r.store.get('world:meta')?.by, 'aaaa-0001', 'under it: kept');
  // the client
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  quiet(() => s.join('interior:m187853213.4', at(1, 1))); sockets[0].open();
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, now: Date.now() }));
  assert.equal(s.sendWorld(big), false, 'the client keeps the building\'s cap too');
  assert.equal(s.sendWorld({ locationKey: 'interior:m187853213.4', world: {} }), true);
  assert.equal(RELAY_VERSION, 'world67');   // WORLD6b bumped it
  assert.match(rd('server/src/index.js'), /if \(message\.length > worldFrameMaxFor\(a\.key\)\) return;/);
});

test('AUDIT WORLD6a B7: the memory\'s stamp is twelve base-36 digits and a dash, always, at both contexts', () => {
  for (let i = 0; i < 200; i++) assert.match(mintSharedStamp(), /^[0-9a-z]+-[0-9a-z]{8}$/);
  assert.match(rd('src/scenes/dungeonContext.js'), /const _sharedStamp = mintSharedStamp\(\);/);
  assert.match(rd('src/world/interiorShared.js'), /stamp: mintSharedStamp\(\)/);
  assert.equal(relay.mintSharedStamp, mintSharedStamp);
});

test('AUDIT WORLD6a by source: the settle asks the stack (A3), the keyed shop fallback claims and a stale row buys nothing (A4), a restock is said at the window (A5), an owned house or any ship keeps no room (A6/B6), the first act in a new building pends (A7), a building\'s foes frame is no dungeon heartbeat (B8)', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorWindows\.containsWindow\(s\.openWin\) && !s\.openWin\.done\) return;/, 'A3');
  assert.match(m, /if \(si >= 0\) interiorLootOpened\(`shelf:\$\{si\}`, interiorOverlay, \{ fresh \}\);/, 'A4: claimed');
  assert.match(m, /const at = shelf\.items\.indexOf\(it\);\s*if \(at < 0\) return undefined;[\s\S]{0,200}?shelf\.items\.splice\(at, 1\);/, 'A4: a row the shelf no longer holds');
  assert.equal((m.match(/interiorPublishLoot\(key\);   \/\/ WORLD6a: the new day's stock/g) ?? []).length, 0, 'A5: no restock is said at the roll');
  assert.match(m, /function interiorLootOpened\(key, win, \{ fresh = false \} = \{\}\) \{[\s\S]*?interiorPublishLoot\(canon, \{ claim: !fresh \}\);/, 'A5: said at the window, a fresh roll not a claim');
  assert.match(m, /const owned = b\?\.buildingType === BUILDING_TYPES\.Ship \|\| isHouseOwned\(/, 'B6: any ship');
  assert.match(m, /buildingKey: _intShared\?\.owned \? 0 : \(interiorBuilding\?\.buildingKey \?\? 0\)/, 'A6: no room at all');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const _actRoom = \(\) => !!\(online && \(isWorldRoom\(online\.room\) \|\| isWorldRoom\(_onlineKey\)\)\);/, 'A7');
  assert.match(w, /online\.onFoes = \(id, data\) => \{\s*if \(isCellRoom\(online\.room\)\) \{[\s\S]*?if \(modes\?\.applyDungeonFoes\?\.\(id, data\) && modes\?\.mode === 'dungeon'\) _foesInAt = performance\.now\(\);/, 'B8 (WORLD6b: the cell\'s arm ahead of it)');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD6a \(2026-09-14\)/, 'the record');
});
