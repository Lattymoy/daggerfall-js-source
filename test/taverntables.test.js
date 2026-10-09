// TAVERN-TABLES (2026-10-09, bible/11-Multiplayer/Tavern-Cards.md section 30; the owner, told a tavern's one card table
// shut out whoever its first sitter was not - Discord: "it doesnt let him use gold tables" - "Two tables per tavern"):
// EVERY TAVERN STANDS TWO CARD TABLES, the chips table every player's and the GOLD table a realm character's stake's. The
// law: the gold table is an index (net/holdemTable.js HOLDEM_GOLD_TABLE), and the relay holds every sit to it - a staked
// sit at a chips table handed its stake back, one with no stake at the gold table refused, whoever sat first. The room:
// the second found by the first's own walk with the first stood and its ring kept off the first's
// (world/placedCardTable.js, scenes/interiorContext.js), its felt red. The host: the gold table refused before the sit to
// anyone who cannot stake at it, and a realm character plays for chips at the other (scenes/worldModes.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { placedTableSpot, TAVERN_CARD_TABLES, PLACE_RING_M } from '../src/world/placedCardTable.js';
import { cardTableSeats, seatFloorOk, SEAT_FLOOR_PROBE, nearestFreeSeat, takenSeats } from '../src/world/cardTables.js';
import { paintFelt, CARD_TABLE_ARCHIVE, FELT_RECORD, GOLD_FELT_RECORD, GOLD_FELT_RGB, FELT_RGB, CARD_TABLE_BOX } from '../src/world/cardTableProp.js';
import { HOLDEM_GOLD_TABLE, holdemGoldTable, HOLDEM_TABLES_MAX } from '../src/net/holdemTable.js';
import { HOLDEM_SEATS_MAX } from '../src/net/cardLaw.js';
import { buildInteriorContext } from '../src/scenes/interiorContext.js';
import { mintStakeOrder } from '../src/net/identityToken.js';
import { readCardReceipt } from '../src/net/cardReceipt.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import * as court from '../src/systems/court.js';
import * as sess from '../src/systems/cardTableSession.js';
import * as hudm from '../src/ui/cardTableHud.js';
import { holdCursor } from '../src/player/pointerLock.js';
import { regularsToStand, regularBark, BARK_MS } from '../src/world/cardRegulars.js';
import { fakeDoc } from './decorFakes.mjs';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = webcrypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('TAVERN-TABLES the law: the gold table is an index - the second a tavern stands, one of the relay\'s sixteen; every other plays for chips', () => {
  assert.equal(HOLDEM_GOLD_TABLE, 1);
  assert.equal(TAVERN_CARD_TABLES, HOLDEM_GOLD_TABLE + 1, 'a tavern stands the chips table, then the gold one - its last');
  assert.ok(HOLDEM_GOLD_TABLE < HOLDEM_TABLES_MAX);
  assert.deepEqual([0, 1, 2, 15].map(holdemGoldTable), [false, true, false, false]);
  // the gold table's felt: its own record and its own red, the chips table's green beside it
  assert.notEqual(GOLD_FELT_RECORD, FELT_RECORD);
  const red = paintFelt(GOLD_FELT_RGB).colors, green = paintFelt().colors;
  assert.ok(red[0] > red[1] * 2 && green[1] > green[0] * 2, 'red, and green');
  assert.deepEqual([...paintFelt(FELT_RGB).colors], [...green], 'the green the default');
});

// THE WALK'S SECOND TABLE: an open floor (the probes of test/taverntable.test.js's room, a floor and nothing on it)
const openFloor = { floor: (x, y, z) => (Math.abs(x) <= 10 && Math.abs(z) <= 10 && y >= 0 ? 0 : null), open: () => true };
const ringRect = (s) => ({ x0: s.cx - s.hx, x1: s.cx + s.hx, z0: s.cz - s.hz, z1: s.cz + s.hz });
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

test('TAVERN-TABLES the walk: a spot says its ring\'s half-extents; an avoid box keeps the next table\'s ring off it - exactly, along each axis', () => {
  const first = placedTableSpot(CARD_TABLE_BOX, [0, 0, 0], openFloor);
  assert.ok(first);
  const w = (CARD_TABLE_BOX.max[0] - CARD_TABLE_BOX.min[0]) / 2, d = (CARD_TABLE_BOX.max[2] - CARD_TABLE_BOX.min[2]) / 2;
  assert.deepEqual([first.hx, first.hz], [w + PLACE_RING_M, d + PLACE_RING_M], 'the table along x, PLACE_RING_M round it');
  const second = placedTableSpot(CARD_TABLE_BOX, [0, 0, 0], openFloor, [[first.cx, 0, first.cz, first.hx, first.hz]]);
  assert.ok(second, 'an open floor holds two');
  assert.equal(overlap(ringRect(first), ringRect(second)), false, 'its ring off the first\'s');
  // a square avoid (a door's, a person's) is still a square: [x, y, z, r] the old way
  const third = placedTableSpot(CARD_TABLE_BOX, [0, 0, 0], openFloor, [[first.cx, 0, first.cz, Math.max(first.hx, first.hz)]]);
  assert.ok(third && overlap(ringRect(first), ringRect(third)) === false);
  // the box is the box, not its bigger half each way: a box long in x and thin in z lets a table stand beside it in z
  // nearer than a square of its long half would
  const slab = [first.cx, 0, first.cz, first.hx, 0.01];
  const beside = placedTableSpot(CARD_TABLE_BOX, [0, 0, 0], openFloor, [slab]);
  const square = placedTableSpot(CARD_TABLE_BOX, [0, 0, 0], openFloor, [[first.cx, 0, first.cz, first.hx]]);
  assert.ok(beside && square);
  assert.ok(Math.hypot(beside.cx - first.cx, beside.cz - first.cz) < Math.hypot(square.cx - first.cx, square.cz - first.cz), 'nearer by the box than by its square');
});

// THE BUILD (test/taverntable.test.js's room): a floor and its enter marker, through the real collider
async function buildRoom(opts, floor = [-10, 10, -10, 10]) {
  const [x0, x1, z0, z1] = floor;
  const quad = {
    positions: new Float32Array([x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1]), normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    subMeshes: [{ textureArchive: 67, textureRecord: 0, startIndex: 0, primitiveCount: 2 }],
  };
  const models = new Map([[100, quad]]), cpuModels = new Map();
  const made = [], freed = [], uploaded = [];
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, createMesh: (m) => { const g = { m }; made.push(g); return g; }, destroyMesh: (g) => freed.push(g),
    uploadTexture: (a, r, c) => uploaded.push([a, r, [...c.colors.slice(0, 3)]]) };
  const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const deps = { renderer, getGpuMesh: async (id) => { const m = models.get(id); if (!m) return null; cpuModels.set(id, m); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const dfBlock = { name: 'TVRN.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 },
    block3dObjectRecords: [{ modelIdNum: 100, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
    blockFlatObjectRecords: [{ xPos: 0, yPos: -20, zPos: 0, textureArchive: 199, textureRecord: 8 }],
    blockDoorRecords: [], blockSection3Records: [], blockPeopleRecords: [] } }] } };
  const warned = [], warn = console.warn;
  console.warn = (m) => warned.push(String(m));
  try { return { ctx: await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, opts), made, freed, uploaded, warned }; } finally { console.warn = warn; }
}
const seatsOf = (ctx, t) => cardTableSeats(t, (from, to) => {   // the interior host's own probe (worldModes.js seatProbe)
  const c = ctx.collider, dv = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], len = Math.hypot(...dv);
  if (!(len > 0) || c.raycast(from, dv.map((v) => v / len), len) < len) return false;
  return seatFloorOk(c.raycast(to, [0, -1, 0], SEAT_FLOOR_PROBE));
});
const ringOf = (t) => ({ x0: t.aabb.min[0] - PLACE_RING_M, x1: t.aabb.max[0] + PLACE_RING_M, z0: t.aabb.min[2] - PLACE_RING_M, z1: t.aabb.max[2] + PLACE_RING_M });

test('TAVERN-TABLES the build: a tavern stands the chips table where it stood, then the gold table - red-felted, its own mesh and key, its ring off the first\'s, six seats each; freed with the room', async () => {
  const { ctx, made, freed, uploaded } = await buildRoom({ peopleVisible: true, placeCardTable: true });
  assert.equal(ctx.tables.length, TAVERN_CARD_TABLES);
  const [chips, gold] = ctx.tables;
  assert.equal(chips.gold, undefined, 'the first plays for chips');
  assert.equal(gold.gold, true, 'the second for gold - the relay\'s own index');
  assert.ok(holdemGoldTable(ctx.tables.indexOf(gold)));
  assert.equal(overlap(ringOf(chips), ringOf(gold)), false, 'its ring - its stools and a seated body - off the first\'s');
  for (const t of ctx.tables) assert.equal(seatsOf(ctx, t).length, HOLDEM_SEATS_MAX, 'six seats each, the other table in none of their ways');
  // the felt: the wood once, a felt each - the gold table's red
  assert.deepEqual(uploaded.map(([a, r]) => [a, r]), [[CARD_TABLE_ARCHIVE, 'wood'], [CARD_TABLE_ARCHIVE, FELT_RECORD], [CARD_TABLE_ARCHIVE, GOLD_FELT_RECORD]]);
  assert.ok(uploaded[2][2][0] > uploaded[2][2][1], 'its felt red');
  const props = made.filter((g) => g.m.subMeshes?.[0]?.textureArchive === CARD_TABLE_ARCHIVE);
  assert.deepEqual(props.map((g) => g.m.subMeshes.map((sm) => sm.textureRecord)), [['wood', FELT_RECORD], ['wood', GOLD_FELT_RECORD]]);
  const entries = props.map((g) => ctx.drawList.find((x) => x.mesh === g));
  assert.deepEqual(entries.map((e) => e.key), ['int:1', 'int:2'], 'each the next placement index past the record\'s own');
  assert.deepEqual(entries.map((e) => e.matrix), [chips.matrix, gold.matrix]);
  assert.ok(Math.abs(ctx.collider.raycast([gold.matrix[12], 2, gold.matrix[14]], [0, -1, 0], 3) - (2 - 0.802)) < 1e-5, 'the gold table collides too');
  ctx.destroy();
  assert.ok(props.every((g) => freed.includes(g)), 'both meshes freed with the room');
  // the same room again: the same two tables (every client the same walk)
  const again = await buildRoom({ peopleVisible: true, placeCardTable: true });
  assert.deepEqual(again.ctx.tables.map((t) => [...t.matrix]), [[...chips.matrix], [...gold.matrix]]);
  again.ctx.destroy();
});

test('TAVERN-TABLES a hall seven metres across: the second\'s ring kept off the first\'s - the walk alone, the first\'s stools in its way, turned it a quarter a quarter-metre into it', async () => {
  const { ctx } = await buildRoom({ peopleVisible: true, placeCardTable: true }, [-3, 4, -3, 6.76]);
  assert.equal(ctx.tables.length, 2);
  const [a, b] = ctx.tables.map(ringOf);
  assert.equal(overlap(a, b), false, 'its ring off the first\'s');
  assert.ok(Math.abs(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) < 1e-6 || Math.abs(Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) < 1e-6, 'as near as it may stand: the two rings meet, edge to edge');
  for (const t of ctx.tables) assert.equal(seatsOf(ctx, t).length, HOLDEM_SEATS_MAX);
  ctx.destroy();
});

test('TAVERN-TABLES a room with floor for one stands the chips table alone - and says so', async () => {
  const { ctx, warned } = await buildRoom({ peopleVisible: true, placeCardTable: true }, [-1, 5, -1.6, 1.6]);
  assert.equal(ctx.tables.length, 1, 'the chips table');
  assert.equal(ctx.tables[0].gold, undefined);
  assert.ok(warned.some((m) => m.includes('no gold card table stood') && m.includes('for a second')), warned.join(' | '));
  ctx.destroy();
});

// THE RELAY (server/src/index.js on the fake room): the report, and the index's law
const ROOM = 'interior:m100.200';
async function withRoom(fn) {
  const r = fakeRoom(ROOM);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000) }); } finally { Date.now = realNow; }
}
let n = 0;
const sid = () => (0xf0000000 + ++n).toString(16).padEnd(20, '0');
const order = async (r, nowS, s, ct = HOLDEM_GOLD_TABLE) => { const cj = sid(); return { cj, stake: await mintStakeOrder({ s, cj, cr: ROOM, ct, ca: 500, cb: 10 }, (await r.signer()).privateKey, { subtle, nowS }) }; };
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
const said = async (r, tick, ws, o) => { tick(300); ws.sent.length = 0; await r.raw(ws, JSON.stringify({ t: 'holdem', ...o })); return ws.sent.filter((m) => m.t === 'holdem'); };
const errOf = (msgs) => msgs.find((m) => m.error)?.error ?? null;
const SIX = { chairs: 6, bb: 10 };

test('TAVERN-TABLES the relay, the report: a realm character\'s stake at the gold table and a guest\'s chips at the other, both seated at once - neither shuts the other out', () => withRoom(async ({ r, tick, nowS }) => {
  const realm = await join(r, 'peer-realm'), guest = await join(r, 'peer-guest');
  assert.equal(errOf(await said(r, tick, realm, { op: 'sit', table: HOLDEM_GOLD_TABLE, chair: 0, ...SIX, stake: (await order(r, nowS(), 'acct-peer-realm')).stake })), null);
  assert.equal(errOf(await said(r, tick, guest, { op: 'sit', table: 0, chair: 3, ...SIX })), null, 'the guest plays for chips beside him');
  assert.equal(r.room._holdem.get(HOLDEM_GOLD_TABLE).gold, true);
  assert.equal(r.room._holdem.get(0).gold, false);
  assert.deepEqual([r.room._holdem.get(HOLDEM_GOLD_TABLE).seats[0]?.id, r.room._holdem.get(0).seats[3]?.id], ['peer-realm', 'peer-guest']);
}));

test('TAVERN-TABLES the relay, the index\'s law: no stake at the gold table refused even as its first sit; a stake at a chips table, even its first, spent and handed back whole; a dropped player back in his own gold chair asked no stake', () => withRoom(async ({ r, tick, nowS }) => {
  const g = await join(r, 'peer-g'), a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  const first = await said(r, tick, g, { op: 'sit', table: HOLDEM_GOLD_TABLE, chair: 0, ...SIX });
  assert.equal(errOf(first), 'gold table', 'the empty gold table: no first sitter makes it a chips table');
  assert.ok(hudm.HOLDEM_REFUSALS['gold table']);
  assert.equal(r.room._holdem.has(HOLDEM_GOLD_TABLE), false, 'nothing opened');
  const o = await order(r, nowS(), 'acct-peer-a', 2);
  const at2 = await said(r, tick, a, { op: 'sit', table: 2, chair: 0, ...SIX, stake: o.stake });
  assert.equal(errOf(at2), 'friendly table', 'an empty chips table: no first stake makes it gold');
  assert.deepEqual(at2.filter((m) => m.cashout).map((m) => readCardReceipt(m.cashout)).map((x) => [x.j, x.r, x.w]), [[o.cj, 500, 'refused']], 'the stake back, whole');
  assert.notEqual(r.store.get(`cstake:${o.cj}`), undefined, 'spent - it cannot be sat again');
  assert.equal(r.room._holdem.has(2), false);
  // the gold table seats its stakes; a seat dropped mid-hand sits back with no stake asked
  for (const [ws, s, chair] of [[a, 'acct-peer-a', 0], [b, 'acct-peer-b', 1], [c, 'acct-peer-c', 2]]) assert.equal(errOf(await said(r, tick, ws, { op: 'sit', table: HOLDEM_GOLD_TABLE, chair, ...SIX, stake: (await order(r, nowS(), s)).stake })), null);
  tick(3000); await r.fire();
  const t = r.room._holdem.get(HOLDEM_GOLD_TABLE);
  assert.ok(t.hand, 'dealt');
  t.seats[0].leaving = true;   // a blip the relay has not yet stood him up for
  assert.equal(errOf(await said(r, tick, a, { op: 'sit', table: HOLDEM_GOLD_TABLE, chair: 0, ...SIX })), null, 'his own chair, back - no stake asked');
  assert.equal(t.seats[0].leaving, undefined);
}));

test('TAVERN-TABLES the relay by source: the index\'s law before the table\'s chairs, its refusal handing a spent stake back; the relay bumped', () => {
  const src = read('server/src/index.js');
  const law = src.indexOf("      if (!back && !!stake !== holdemGoldTable(m.table)) { await no(stake ? 'friendly table' : 'gold table'); return; }");
  assert.ok(law > 0 && law > src.indexOf('      const no = async (why) => {') && law < src.indexOf("await no('table differs')"), 'after the stake is spent (its refusal hands it back), before the chairs');
  assert.ok(read('src/net/wire.js').includes("// world180:   TAVERN-TABLES"));   // PIN MOVED: the Chapters' CHAP4c took world181 past it at the merge, so TAVERN-TABLES' world180 is a line of the relay's history
});

// THE HOST (scenes/worldModes.js's card block, sliced and run as test/auditcards2_host.test.js runs it): the two tables
const WM = read('src/scenes/worldModes.js');
const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));
function host({ online = true, relay = true, realm = false }) {
  const doc = fakeDoc();
  const playerEntity = { name: 'Mac', goldPieces: 5000, items: [], health: 50 };
  const said = [], sent = [];
  const seatList = Array.from({ length: 6 }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1, nearestFreeSeat, takenSeats,
    player: { pos: [0, 0, 0], eyeAt: () => [0, 1.6, 0] },
    host: {
      relock: () => {}, seatedPeers: () => [], realmAct: realm ? {} : null,
      cardOnline: { ok: () => relay, send: (w) => { sent.push(w); return true; }, id: () => 'peer-me', welcomes: () => 0, room: () => ROOM },
      cardStakes: realm ? { goldOk: () => true, purse: () => 1000, elsewhere: () => [], voidable: () => [], owed: () => [] } : null,
    },
    say: (s) => said.push(s), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount,
    holdCursor, renderer: {},
    createCardTableDraw: () => ({ draw() {}, destroy() {} }),
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.places = o.places; this.playerSeat = o.playerSeat; } onEvent() {} poses() { return { cards: [], chips: [] }; } settledAt() { return 0; } },
    tablePlaces: (frame, s, seatOf) => ({ seatOf, seats: seatOf.map(() => ({})) }), tableFrame: () => ({ centre: [0, 0.8, 0], axisYaw: 0, halfLong: 1, halfShort: 0.5 }), hashSeed: (...x) => x.join(':'),
    registerPlayerHurtListener: () => {},
    isOnlinePage: () => online,
    mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0,
    worldMinutes: () => 0, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS,
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }, { aabb: {}, gold: true }], collider: null }, interiorBuilding: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 } };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, get cardGame() { return cardGame; }, get cardSeat() { return cardSeat; } };`)(state, ...Object.values(scope));
  return { api, said, sent };
}

test('TAVERN-TABLES the host: online, the gold table refused before the sit to whoever cannot stake there (a guest; a relay not dealing) and said why; the chips table sits him - and a realm character plays for chips there, for gold at the other; offline both tables are the regulars\'', () => {
  const guest = host({});
  guest.api.sitAtCardTable(HOLDEM_GOLD_TABLE);
  assert.equal(guest.api.cardSeat, null, 'never seated');
  assert.equal(guest.api.cardGame, null);
  assert.deepEqual(guest.sent, [], 'no sit said to the relay');
  assert.match(guest.said.at(-1), /plays for gold - only a realm character may stake at it\. The green table plays for chips\./);
  guest.api.sitAtCardTable(0);
  assert.equal(guest.api.cardSeat?.table, 0);
  assert.deepEqual(guest.sent.map((w) => [w.op, w.table, 'stake' in w]), [['sit', 0, false]], 'the chips table: a sit with no stake, at once');
  guest.api.standFromCardTable();
  // a realm character: chips at the chips table, gold at the gold one
  const realm = host({ realm: true });
  realm.api.sitAtCardTable(0);
  assert.equal(realm.api.cardGame.goldOnline, false, 'a realm character plays for chips at the chips table');
  assert.equal(realm.api.cardGame.friendly, true);
  assert.deepEqual(realm.sent.map((w) => [w.op, w.table, 'stake' in w]), [['sit', 0, false]]);
  realm.api.standFromCardTable();
  realm.sent.length = 0;
  realm.api.sitAtCardTable(HOLDEM_GOLD_TABLE);
  assert.equal(realm.api.cardSeat?.table, HOLDEM_GOLD_TABLE);
  assert.equal(realm.api.cardGame.goldOnline, true, 'and for gold at the gold table');
  assert.equal(realm.api.cardGame.phase, 'buyin', 'his stake asked of the service first');
  assert.deepEqual(realm.sent.filter((w) => w.op === 'sit'), [], 'no sit before the stake');
  realm.api.standFromCardTable();
  // the relay not dealing: the gold table cannot take his stake
  const down = host({ realm: true, relay: false });
  down.api.sitAtCardTable(HOLDEM_GOLD_TABLE);
  assert.equal(down.api.cardSeat, null);
  assert.match(down.said.at(-1), /the relay is not dealing right now - the green table plays for chips\./);
  // offline: a table like the other - the regulars, for the purse's gold
  const offline = host({ online: false });
  offline.api.sitAtCardTable(HOLDEM_GOLD_TABLE);
  assert.equal(offline.api.cardSeat?.table, HOLDEM_GOLD_TABLE);
  assert.equal(offline.api.cardGame.friendly, false, 'the regulars, for gold');
  offline.api.standFromCardTable();
});
