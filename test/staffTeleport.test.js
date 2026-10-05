import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { validStaffDestination, validStaffTeleportIn, validStaffTeleportOut, staffDestinationKey, followStaffPlayer, createStaffTeleportClient, staffTeleportSupported } from '../src/net/staffTeleport.js';
import { parseClient, SOCIAL_ROOM, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { deckPose, localOf, worldOf } from '../src/scenes/comeSailAwayAboard.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { Collider } from '../src/player/collider.js';
import { capsuleFits } from '../src/player/parkour.js';

const ext = { kind: 'exterior', pixel: { x: 207, y: 213 }, pos: [123456.123456789, -14.87654321, 654321.987654321], yaw: 0.837, pitch: -0.35 };
const interior = { ...ext, kind: 'interior', door: { blockIndex: 4, recordIndex: 8, doorIndex: 1, buildingKey: 4294967295 } };
const dungeon = { ...ext, kind: 'dungeon', mapId: 1234, pos: [13.123456, -45.123456, 27.987654] };
const gate = { ...dungeon, kind: 'gate', gate: { day: 150123, px: 207, py: 213, spot: [35.34567, 68.76543], near: 'Daggerfall' } };
const abyss = { ...dungeon, kind: 'abyss', abyss: { Active: true, PitMapX: 600, PitMapY: 140, TemplateMapX: 207, TemplateMapY: 213, TemplateRegionIndex: 4, TemplateLocationIndex: 81, ReturnWorldX: 150123.456, ReturnWorldZ: 140456.123, HasReturnPitDepth: true, ReturnPitDepth: 15.5, DungeonName: 'The Drowned Abyss', RecallBinding: null } };
const boat = { ...ext, boat: { owner: 'peer-sailor', slot: 2, local: [-12.123456789, 4.987654321, 8.012345678] } };
const destinations = [ext, interior, dungeon, gate, abyss, boat].map(validStaffDestination);

for (const d of destinations) test(`STAFF-TP: lossless validated destination ${d.kind}${d.boat ? '/boat' : ''}`, () => {
  assert.deepEqual(validStaffDestination(d), d);
  assert.deepEqual(validStaffDestination({ ...d, inventory: ['never copy'], ownership: 'never copy' }), d);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'stp', k: 'answer', ticket: 'ticket-one', dest: d }), { hasHello: true }), { t: 'stp', k: 'answer', ticket: 'ticket-one', dest: d });
});

test('STAFF-TP: malformed positions, pixels, door identities and destinations fail closed', () => {
  for (const pos of [[NaN, 1, 2], [1, Infinity, 2], [1, 2], [1, 2, 3, 4], ['1', 2, 3], [1e10, 0, 0]]) assert.equal(validStaffDestination({ ...ext, pos }), null);
  for (const pixel of [{ x: -1, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 500 }, { x: 1.5, y: 0 }, null]) assert.equal(validStaffDestination({ ...ext, pixel }), null);
  for (const d of [{ ...interior, door: null }, { ...interior, door: { ...interior.door, buildingKey: -1 } }, { ...dungeon, mapId: null }, { ...gate, gate: { ...gate.gate, spot: [] } }, { ...boat, boat: { ...boat.boat, local: [0, NaN, 0] } }, { ...abyss, abyss: { ...abyss.abyss, TemplateRegionIndex: -1 } }, { ...ext, kind: 'made-up' }]) assert.equal(validStaffDestination(d), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'stp', k: 'ask', name: 'Bran', nonce: 'n' })), { error: 'stp before hello' });
  assert.equal(validStaffTeleportIn({ k: 'ask', name: 'Bran', id: 'peer-b', nonce: 'n' }), null);
  assert.equal(validStaffTeleportOut({ k: 'result', nonce: 'n', dest: ext, id: 'bad id', name: 'Bran' }), null);
});

test('STAFF-TP: scene identity distinguishes repeated building keys, dungeons and abyss instances', () => {
  for (const d of destinations) assert.equal(staffDestinationKey(d), staffDestinationKey({ ...d, pos: [7, 8, 9], yaw: 2 }));
  assert.notEqual(staffDestinationKey(interior), staffDestinationKey({ ...interior, pixel: { x: 208, y: 213 } }));
  assert.notEqual(staffDestinationKey(dungeon), staffDestinationKey({ ...dungeon, mapId: 1235 }));
  assert.notEqual(staffDestinationKey(abyss), staffDestinationKey({ ...abyss, abyss: { ...abyss.abyss, PitMapX: 601 } }));
  assert.notEqual(staffDestinationKey(gate), staffDestinationKey({ ...gate, gate: { ...gate.gate, day: 150124 } }));
});

test('STAFF-TP: gate snapshots without a nearby label survive both wire projections', () => {
  const d = validStaffDestination({ ...gate, gate: { ...gate.gate, near: undefined } });
  assert.deepEqual(validStaffDestination(d), d);
});

for (const dest of destinations) test(`STAFF-TP: freshly samples ${dest.kind}${dest.boat ? '/boat' : ''} after load and lands exactly`, async () => {
  let loaded = false, landed = null;
  const fresh = { ...dest, pos: dest.pos.map((x) => x + 0.0123456789) };
  const asks = [];
  await followStaffPlayer('Bran', {
    ask: async (target) => { asks.push(target); return { id: 'peer-bran', name: 'Bran', dest: loaded ? fresh : dest }; },
    prepare: async (d) => { assert.deepEqual(d, dest); loaded = true; },
    place: (d) => { landed = d; },
  });
  assert.deepEqual(asks, [{ name: 'Bran' }, { id: 'peer-bran' }]);
  assert.deepEqual(landed, fresh);
});

test('STAFF-TP: follows a door/pixel transition during loading before applying local coordinates', async () => {
  const samples = [ext, dungeon, { ...dungeon, pos: [123.12345, -79.1, 0.00009] }];
  const loaded = [], placed = [];
  await followStaffPlayer('Bran', { ask: async () => ({ id: 'peer-bran', name: 'Bran', dest: samples.shift() }), prepare: async (d) => loaded.push(d.kind), place: (d) => placed.push(d) });
  assert.deepEqual(loaded, ['exterior', 'dungeon']);
  assert.deepEqual(placed[0].pos, [123.12345, -79.1, 0.00009]);
});

test('STAFF-TP: disconnected, continually transitioning or cancelled targets never get a false success', async () => {
  let i = 0, placed = 0;
  await assert.rejects(followStaffPlayer('Bran', { ask: async () => ({ id: 'peer-bran', dest: { ...ext, pixel: { x: ++i, y: 20 } } }), prepare: async () => {}, place: () => placed++ }), /kept changing/);
  assert.equal(i, 4); assert.equal(placed, 0);
  await assert.rejects(followStaffPlayer('Bran', { ask: async () => { throw new Error('offline'); }, prepare: async () => assert.fail(), place: () => assert.fail() }), /offline/);
  await assert.rejects(followStaffPlayer('Bran', { ask: async () => ({ id: 'peer-bran', dest: ext }), allowed: () => false, prepare: async () => assert.fail(), place: () => assert.fail() }), /cancelled/);
});

test('STAFF-TP client: correlated replies, no unsolicited teleport, bounded timeout and cancellation', async () => {
  const sent = [], timers = new Map(); let next = 0;
  const c = createStaffTeleportClient({ send: (m) => { sent.push(m); return true; }, capture: () => ({ dest: ext }), setTimer: (f) => { timers.set(++next, f); return next; }, clearTimer: (id) => timers.delete(id) });
  const p = c.ask({ name: 'Bran' });
  c.receive({ k: 'result', nonce: 'unknown', id: 'peer-bran', name: 'Bran', dest: ext });
  assert.equal(timers.size, 1);
  c.receive({ k: 'result', nonce: sent[0].nonce, id: 'peer-bran', name: 'Bran', dest: ext });
  assert.deepEqual((await p).dest, ext); assert.equal(timers.size, 0);
  c.receive({ k: 'capture', ticket: 'ticket' }); assert.deepEqual(sent.at(-1), { k: 'answer', ticket: 'ticket', dest: ext });
  const timed = c.ask({ name: 'Away' }); const rejected = assert.rejects(timed, /did not answer/); [...timers.values()][0](); await rejected;
  const cancelled = c.ask({ name: 'Bran' }); const cancelledCheck = assert.rejects(cancelled, /connection changed/); c.cancel(); await cancelledCheck;
});

async function hub(fn, key = SOCIAL_ROOM) {
  const r = fakeRoom(key), realNow = Date.now; let now = 1e12; Date.now = () => now;
  const tick = (ms = 1000) => { now += ms; };
  const join = async (id, name, glyphs = []) => { const ws = r.connect(); await r.hello(ws, id, null, { name, glyphs, acct: `acct-${id}`, asecret: `secret-${id}` }); tick(); return ws; };
  const send = (ws, m) => r.raw(ws, JSON.stringify({ t: 'stp', ...m }));
  try { await fn({ r, tick, join, send }); } finally { Date.now = realNow; }
}
const messages = (ws, k) => ws.sent.filter((m) => m.t === 'stp' && m.k === k);

for (const glyph of ['dev', 'dm', 'shadowfang']) test(`STAFF-TP relay: signed ${glyph} locates any hub player without region/party markers`, () => hub(async ({ join, send }) => {
  const staff = await join('peer-staff', 'Mac', [glyph]), target = await join('peer-bran', 'Bran'), bystander = await join('peer-other', 'Other');
  await send(staff, { k: 'ask', name: 'Bran', nonce: 'lookup-one', glyphs: ['anything'] });
  const capture = messages(target, 'capture').at(-1); assert.ok(capture);
  await send(target, { k: 'answer', ticket: capture.ticket, dest: dungeon });
  const result = messages(staff, 'result').at(-1);
  assert.equal(result.id, 'peer-bran'); assert.deepEqual(result.dest, dungeon);
  assert.ok(validStaffTeleportOut(result)); assert.equal(messages(bystander, 'result').length, 0);
}));

test('STAFF-TP relay: ordinary users cannot self-assert staff or request player coordinates', () => hub(async ({ join, send }) => {
  const normal = await join('peer-normal', 'Normal'), target = await join('peer-bran', 'Bran');
  await send(normal, { k: 'ask', name: 'Bran', nonce: 'lookup', glyphs: ['dev'], staff: true });
  assert.equal(messages(normal, 'result').at(-1).error, 'denied'); assert.equal(messages(target, 'capture').length, 0);
}));

test('STAFF-TP relay: ambiguous prefix, exact name priority, offline and stable-ID refresh', () => hub(async ({ join, send, tick }) => {
  const staff = await join('peer-staff', 'Mac', ['dm']), bran = await join('peer-bran', 'Bran'), brandon = await join('peer-brandon', 'Brandon');
  await send(staff, { k: 'ask', name: 'Bra', nonce: 'n1' }); assert.equal(messages(staff, 'result').at(-1).error, 'ambiguous'); tick();
  await send(staff, { k: 'ask', name: 'Bran', nonce: 'n2' }); assert.equal(messages(bran, 'capture').length, 1); assert.equal(messages(brandon, 'capture').length, 0); tick();
  await send(staff, { k: 'ask', id: 'peer-brandon', nonce: 'n3' }); assert.equal(messages(brandon, 'capture').length, 1); tick();
  await send(staff, { k: 'ask', name: 'Absent', nonce: 'n4' }); assert.equal(messages(staff, 'result').at(-1).error, 'offline');
}));

test('STAFF-TP relay: forged, replayed, expired and replaced-socket replies cannot move staff', () => hub(async ({ r, join, send, tick }) => {
  const staff = await join('peer-staff', 'Mac', ['dm']), bran = await join('peer-bran', 'Bran'), attacker = await join('peer-attacker', 'Attacker');
  await send(staff, { k: 'ask', name: 'Bran', nonce: 'n1' }); const ticket = messages(bran, 'capture').at(-1).ticket;
  await send(attacker, { k: 'answer', ticket, dest: ext }); assert.equal(messages(staff, 'result').length, 0);
  await send(bran, { k: 'answer', ticket, dest: ext }); assert.equal(messages(staff, 'result').length, 1);
  await send(bran, { k: 'answer', ticket, dest: dungeon }); assert.equal(messages(staff, 'result').length, 1); tick();
  await send(staff, { k: 'ask', name: 'Bran', nonce: 'n2' }); const expired = messages(bran, 'capture').at(-1).ticket; tick(9000);
  await send(bran, { k: 'answer', ticket: expired, dest: dungeon }); assert.equal(messages(staff, 'result').length, 1);
  await send(staff, { k: 'ask', name: 'Bran', nonce: 'n3' }); const replaced = messages(bran, 'capture').at(-1).ticket;
  await r.drop(staff); await send(bran, { k: 'answer', ticket: replaced, dest: ext }); assert.equal(messages(staff, 'result').length, 1);
}));

test('STAFF-TP session: old servers are never sent an unknown frame; updated hub receives only valid frames', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-staff', secret: 'secret-staff', WebSocketImpl: FakeWS, presence: false });
  s.join(SOCIAL_ROOM); const ws = sockets[0]; ws.open();
  const welcome = (v) => ws.receive({ t: 'welcome', id: 'peer-staff', peers: [], n: 1, v });
  const ask = { k: 'ask', nonce: 'n1', name: 'Bran' };
  for (const version of [undefined, 'world154', 'world155', 'world156', 'world157', 'world158']) {
    welcome(version);
    assert.equal(staffTeleportSupported(version), false, `${version}: no combined relay law`);
    assert.equal(s.staffTeleportOk, false);
    assert.equal(s.sendStaffTeleport(ask), false);
  }
  assert.equal(ws.sent.map(JSON.parse).some((m) => m.t === 'stp'), false, 'unsupported relays receive no teleport frame');
  for (const version of ['world159', 'world160', 'world161', 'world162', 'world163', 'world164', 'world165', 'world166', 'world167', 'world168', 'world169', 'world170']) {   // the FEUD merge: and its own
    welcome(version);
    assert.equal(staffTeleportSupported(version), true, `${version}: combined relay law supported`);
    assert.equal(s.staffTeleportOk, true);
    assert.equal(s.sendStaffTeleport(ask), true);
  }
  welcome(RELAY_VERSION); assert.equal(s.sendStaffTeleport(ask), true);
  assert.equal(staffTeleportSupported(null), false);
  const heard = []; s.onStaffTeleport = (m) => heard.push(m);
  ws.receive({ t: 'stp', k: 'capture', ticket: 'valid-ticket' });
  ws.receive({ t: 'stp', k: 'capture', ticket: 'bad ticket' });
  assert.equal(heard.length, 1);
  s.leave();
});

// Execute the production host adapters with scene/network doubles. Parsing the
// AST avoids pretending a regex match is a runtime landing test.
const worldSource = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const functions = new Map();
const walk = (n) => {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && n.id) functions.set(n.id.name, worldSource.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
};
walk(parse(worldSource, { ecmaVersion: 'latest', sourceType: 'module' }));
const hostFunction = (name, supplied) => { const scope = { capsuleFits: () => true, player: { collider: {}, height: 1.8 }, ...supplied }; return Function(...Object.keys(scope), `return (${functions.get(name)});`)(...Object.values(scope)); };

test('STAFF-TP collision: real dungeon walls, low ceiling and buried feet reject placement; clear negative-height floor preserves exact feet', async () => {
  const col = new Collider(() => -1000);
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  col.addMesh('wall', new Float32Array([1, -50, -5, 1, -40, -5, 1, -40, 5, 1, -50, 5]), [0, 1, 2, 0, 2, 3], matrix);
  col.addMesh('ceiling', new Float32Array([-5, -43.8, -5, 5, -43.8, -5, 5, -43.8, 5, -5, -43.8, 5]), [0, 1, 2, 0, 2, 3], matrix);
  const placed = [], player = { collider: col, height: 1.8 };
  const scope = { player, capsuleFits, staffLanding: (d) => d.pos,
    modes: { setPlayerLocalPosition: (p) => placed.push(p), forceExitToExterior: () => {}, startInDungeon: async () => true, dungeonLocation: { mapTableData: { mapId: dungeon.mapId } } },
    _wodInside: false, playerSpawned: false, _teleportToPixel: async () => {}, ohAbyss: null,
    cam: {}, lookFilter: { settle: () => {} }, playerEntity: {}, surfacePlayer: () => {} };
  const place = hostFunction('placeStaffDestination', scope), prepare = hostFunction('prepareStaffDestination', scope);
  for (const pos of [[0.9, -48, 0], [0, -45, 0], [0, -1001, 0]]) {
    assert.throws(() => place({ ...dungeon, pos }), /landing is blocked/);
    await assert.rejects(prepare({ ...dungeon, pos }), /landing is blocked/);
    assert.deepEqual(placed, [], 'neither preview nor final placement enters geometry');
  }
  const safe = [0.123456789, -48.123456789, 0.987654321];
  place({ ...dungeon, pos: safe });
  assert.deepEqual(placed, [safe], 'no ground snapping or rounding');
});

test('STAFF-TP collision: blocked moving-boat landing never attaches the passenger or places feet', () => {
  const place = hostFunction('placeStaffDestination', {
    capsuleFits: () => false, staffLanding: (d) => d.pos,
    csaPeers: { boatByUid: (_owner, id) => { assert.equal(id, 123); return {}; } },
    csaWorldOf: () => [1, 2, 3], csaDeckPose: () => ({}), csaSyncColliders: () => {},
    csaAboard: { board: () => assert.fail('must validate before boarding') },
    modes: { setPlayerLocalPosition: () => assert.fail('no blocked landing') },
  });
  assert.throws(() => place({ ...boat, boat: { ...boat.boat, uid: 123 } }), /landing is blocked/);
});

test('STAFF-TP dungeon identity selects the target dungeon; interior entry uses its safe marker before checking the exact position', async () => {
  const d = validStaffDestination({ ...dungeon, locationKey: 'dungeon:9812' });
  assert.equal(d.locationKey, 'dungeon:9812');
  assert.equal(validStaffDestination({ ...dungeon, locationKey: 'world' }), null);
  const calls = [];
  const modes = { forceExitToExterior: () => {}, setPlayerLocalPosition: () => {},
    dungeonLocation: { mapTableData: { mapId: dungeon.mapId } },
    startInDungeon: async (options) => { calls.push(options); return true; },
    restoreInterior: async (_saved, pos) => { assert.equal(pos, null, 'no unchecked target position during the build'); return true; } };
  const prepare = hostFunction('prepareStaffDestination', { modes, _wodInside: false, playerSpawned: false,
    _teleportToPixel: async () => {}, staffLanding: (d) => d.pos, ohAbyss: null });
  await prepare(d); assert.deepEqual(calls, [{ locationKey: 'dungeon:9812' }]);
  await prepare(interior);
});

test('STAFF-TP reported bug: /tp @player invokes exact player travel, never traveller-marker/guild travel', async () => {
  const calls = [], lines = [];
  const run = hostFunction('runStaffCommand', { chatLog: { push: (_tab, line) => lines.push(line) }, worldMoveBusy: () => false, modes: {}, staffTeleportClient: {}, teleportToStaffPlayer: async (name) => { calls.push(name); return { name }; }, console });
  run('world', { cmd: 'tp', player: 'Bran' }); await Promise.resolve();
  assert.deepEqual(calls, ['Bran']); assert.match(lines.at(-1).text, /exact position/);
});

test('STAFF-TP host: floating origin and vertical compensation are removed and restored without terrain snapping', () => {
  const state = new StreamingWorldState(); state.init(207, 213); state.compensation = [32.5, -70.125, -38.75];
  const local = [73.123456789, -19.87654321, 190.987654321]; const wc = state.worldCoords(local);
  const d = { ...ext, pos: [wc.x, local[1] - state.compensation[1], wc.z] };
  state.init(208, 214); state.compensation = [-16.5, 48.75, 81.25];
  const landed = hostFunction('staffLanding', { state })(d);
  const native = state.worldCoords(landed);
  assert.ok(Math.abs(native.x - wc.x) < 1e-8); assert.ok(Math.abs(native.z - wc.z) < 1e-8);
  assert.ok(Math.abs((landed[1] - state.compensation[1]) - (local[1] + 70.125)) < 1e-10);
  assert.deepEqual(hostFunction('staffLanding', { state })(dungeon), dungeon.pos);
});

test('STAFF-TP host: live target capture retains height and unrounded moving-deck local position', () => {
  const state = { current: { x: 207, y: 213 }, compensation: [0, 40, 0], worldCoords: (p) => ({ x: p[0] * 100, z: p[2] * 100 }) };
  const hull = { GameObject: { position: [12, 5, 6], rotation: [0, 0, 0, 1] } };
  const pos = [12.123456789, 7.987654321, 8.012345678];
  const capture = hostFunction('staffDestination', { walkMode: true, playerSpawned: true, worldMoveBusy: () => false, modes: { mode: 'exterior', anchorContext: () => ({}) }, seatOut: () => false, playerEntity: { health: 100 }, siegeSession: null, royalSession: null, state, player: { pos }, cam: { yaw: 1, pitch: 0 }, playerTravelPixel: () => ({ x: 207, y: 213 }), csaOn: () => true, csaAboard: { aboard: { boat: hull, owner: 'peer-sailor', slot: 2 } }, csaLocalOf: localOf, csaDeckPose: deckPose, validStaffDestination });
  const d = capture().dest; assert.equal(d.pos[1], pos[1] - 40);
  assert.deepEqual(worldOf(deckPose(hull), d.boat.local), pos);
  assert.notEqual(d.boat.local[0], Math.round(d.boat.local[0] * 100) / 100);
});

for (const d of destinations.filter((d) => !d.boat)) test(`STAFF-TP host: loads ${d.kind} before exact placement`, async () => {
  const log = [], loc = { mapTableData: { mapId: dungeon.mapId }, regionIndex: abyss.abyss.TemplateRegionIndex, locationIndex: abyss.abyss.TemplateLocationIndex };
  const modes = { forceExitToExterior: () => log.push('exit'), setPlayerLocalPosition: (p) => log.push(['place', p]), restoreInterior: async (saved, p, opts) => { assert.deepEqual(saved, { door: interior.door }); assert.equal(opts.strictDoor, true); log.push('interior'); return true; }, startInDungeon: async () => { log.push('dungeon'); return true; }, enterGateArena: async (g) => { assert.deepEqual(g, gate.gate); log.push('gate'); return true; }, dungeonLocation: loc };
  const prepare = hostFunction('prepareStaffDestination', { modes, _wodInside: false, playerSpawned: false, _teleportToPixel: async (x, y) => log.push(['pixel', x, y]), staffLanding: (a) => [...a.pos], ohAbyss: { data: { RecallBinding: 'own-binding' }, restoreSaveData: (a) => { assert.equal(a.RecallBinding, 'own-binding'); log.push('abyss'); }, active: true, onRespawnerComplete: () => {} } });
  await prepare(d); assert.equal(log[0], 'exit'); assert.deepEqual(log[1], ['pixel', 207, 213]); assert.deepEqual(log.at(-1), ['place', d.pos]);
});

test('STAFF-TP host: failed interior/dungeon entry reports failure and never applies indoor coordinates outside', async () => {
  const log = [];
  const prepare = hostFunction('prepareStaffDestination', { modes: { forceExitToExterior: () => {}, restoreInterior: async () => false, setPlayerLocalPosition: () => assert.fail('no indoor spawn outside') }, _wodInside: false, _teleportToPixel: async () => log.push('safe exterior'), staffLanding: (a) => a.pos, ohAbyss: null });
  await assert.rejects(prepare(interior), /not completed/); assert.equal(log.length, 2);
});

test('STAFF-TP host: death/seat loss while the pixel loads cancels before entering or placing', async () => {
  let ready = true;
  const prepare = hostFunction('prepareStaffDestination', { modes: { forceExitToExterior: () => {}, restoreInterior: () => assert.fail('cancelled before interior build'), setPlayerLocalPosition: () => assert.fail('cancelled before placement') }, _wodInside: false, _teleportToPixel: async () => { ready = false; } });
  await assert.rejects(prepare(interior, () => ready), /cancelled/);
});

test('STAFF-TP host: final boat placement uses the moved/rotated hull, keeps deck binding and exact local point', () => {
  const hull = { GameObject: { position: [99, 7, -16], rotation: [0, Math.sin(0.35), 0, Math.cos(0.35)] } };
  let placed, bound, synced = false;
  const place = hostFunction('placeStaffDestination', { staffLanding: (a) => a.pos, csaPeers: { boatAt: () => hull }, csaAboard: { board: (b) => { bound = b; return true; } }, CSA_ABOARD_GRACE: 4, csaWorldOf: worldOf, csaDeckPose: deckPose, csaSyncColliders: () => { synced = true; }, modes: { setPlayerLocalPosition: (p) => { placed = p; } }, cam: {}, lookFilter: { settle: () => {} }, playerEntity: {}, surfacePlayer: () => {} });
  place(boat); assert.equal(bound, hull); assert.equal(synced, true); assert.deepEqual(placed, worldOf(deckPose(hull), boat.boat.local));
});

test('STAFF-TP layout: bounded stamps survive both wire directions and malformed stamps fail closed', () => {
  for (const layout of ['classic', 'beautiful-cities@0.5.0', 'beautiful-villages@1.4.2', 'beautiful-cities@0.5.0+beautiful-villages@1.4.2']) {
    const dest = { ...interior, layout };
    assert.deepEqual(validStaffDestination(dest), dest);
    assert.equal(validStaffTeleportIn({ k: 'answer', ticket: 't', dest }).dest.layout, layout);
    assert.equal(validStaffTeleportOut({ k: 'result', nonce: 'n', id: 'peer', name: 'Target', dest }).dest.layout, layout);
  }
  for (const layout of ['', {}, 'unknown@1.0.0', 'classic+beautiful-cities@0.5.0', 'beautiful-cities@0.5.0+beautiful-cities@0.5.0', 'beautiful-cities@0.5.0\n', 'x'.repeat(129)]) {
    assert.equal(validStaffDestination({ ...interior, layout }), null);
  }
  assert.equal(staffDestinationKey(interior), staffDestinationKey({ ...interior, layout: 'classic' }));
  assert.equal(staffDestinationKey({ ...interior, layout: 'beautiful-villages@1.4.2+beautiful-cities@0.5.0' }), staffDestinationKey({ ...interior, layout: 'beautiful-cities@0.5.0+beautiful-villages@1.4.2' }));
});

test('STAFF-TP layout: changing town layouts during loading requires another preparation before placement', async () => {
  const samples = [{ ...interior, layout: 'classic' }, { ...interior, layout: 'beautiful-cities@0.5.0' }, { ...interior, layout: 'beautiful-cities@0.5.0', pos: [7, 8, 9] }];
  const prepared = [], placed = [];
  await followStaffPlayer('Target', { ask: async () => ({ id: 'peer', dest: samples.shift() }), prepare: async (d) => prepared.push(d.layout), place: (d) => placed.push(d) });
  assert.deepEqual(prepared, ['classic', 'beautiful-cities@0.5.0']);
  assert.equal(placed.length, 1);
  assert.deepEqual(placed[0].pos, [7, 8, 9]);
});

test('STAFF-TP layout: live capture and strict restore carry the visited layout; Arena targets are refused', async () => {
  const layout = 'beautiful-cities@0.5.0';
  let identity = { kind: 'interior', buildingKey: interior.door.buildingKey, layout };
  const modes = { mode: 'interior', roomIdentity: () => identity, anchorContext: () => ({ interior: { door: interior.door } }) };
  const capture = hostFunction('staffDestination', { walkMode: true, playerSpawned: true, worldMoveBusy: () => false, modes, seatOut: () => false, playerEntity: { health: 100 }, siegeSession: null, royalSession: null,
    state: { worldCoords: () => ({ x: 1, z: 3 }), compensation: [0, 0, 0] }, player: { pos: [1, 2, 3] }, cam: { yaw: 0, pitch: 0 }, playerTravelPixel: () => interior.pixel, validStaffDestination });
  const { dest } = capture();
  assert.equal(dest.layout, layout);
  let restored = null;
  const prepare = hostFunction('prepareStaffDestination', { modes: { forceExitToExterior() {}, restoreInterior: async (saved, position, options) => { restored = saved; assert.equal(position, null); assert.equal(options.strictDoor, true); return false; }, setPlayerLocalPosition: () => assert.fail('a mismatched layout must not place the player') }, _wodInside: false, _teleportToPixel: async () => {}, staffLanding: (d) => d.pos, ohAbyss: null });
  await assert.rejects(prepare(dest), /unavailable|entered|enter|ready/i);
  assert.equal(restored.layout, layout);
  assert.deepEqual(restored.door, interior.door);
  identity = { kind: 'arena' };
  assert.deepEqual(capture(), { error: 'battle' });
});
