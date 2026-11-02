// GATHER-SPEED and MARKET-SPEED (2026-10-11, Mac: "Can you look at gathering minigame performance and how the server
// affects it/slows down, same with the market", then "Do everything. A comprehensive improvement"). Neither waits on the
// relay: a harvest and every market look are the account service's, on D1, and every `first()` and `all()` there is a
// round trip from the Worker to the database's primary. A harvest asked fifteen to seventeen of them in a row before its
// player saw the goods; a market read eighteen to twenty-two; and a harvest under a Levy, a market read at a board and a
// buy each read every seat's witness rows whole, uncached. bible/06-Systems/Professions-Arc.md 10.12 (GATHER-SPEED,
// MARKET-SPEED). These pins count the round trips - a statement's own call one, a batch one - and hold the answers to
// the shape they had. On the client: the node goes as its act ends (the book's `gone`), and the frame's reads of the
// kept table are the last parse's. tools/mutants/gatherspeed.json.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { harvestNode, profState, profPixels } from '../../server-account/src/professions.js';
import { marketRead } from '../../server-account/src/market.js';
import { levyAt, titheAt } from '../../server-account/src/seatHolding.js';
import { listingsCapAt } from '../../server-account/src/seatForts.js';
import { herbPatches, nodeKey, veins, utcDayOfMs, WITNESS } from '../../src/net/nodeLaw.js';
import { seatReportText, seatWeekOf } from '../../src/net/townSeatLaw.js';
import { MARKET_LISTINGS_MAX, roadPixels } from '../../src/net/marketLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { CARRIED_MAX } from '../../src/net/bagLaw.js';
import { createProfBook, PUMP_IDLE_MAX_MS, PROF_KEPT_KEY } from '../../src/net/profBook.js';
import { MINE_ACT } from '../../src/net/professionLaw.js';
import { mineKind } from '../../src/scenes/mineHost.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { herbKind } from '../../src/scenes/herbHost.js';
import { createGatherHost, aimAt } from '../../src/scenes/gatherHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { createMarketBook } from '../../src/net/marketBook.js';
import { createMarketTab } from '../../src/ui/marketTab.js';
import { SEAT_ROWS_SQL, SEAT_JUDGED_SQL } from '../../server-account/src/townSeats.js';   // LEAN-WITNESS

const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;
const NOW = T0;
const TODAY = utcDay(NOW);
const realNow = Date.now;
Date.now = () => NOW * 1000;
test.after(() => { Date.now = realNow; });
const rand = (b) => globalThis.crypto.getRandomValues(b);
let _rid = 0;
const rid = (tag) => `${tag}-${String(++_rid).padStart(6, '0')}`;

/** THE ROUND TRIPS A DATABASE IS ASKED: each statement's own `first`, `all` or `run` one, and each batch one - over
 *  test/accountDb.mjs's D1, whose batch runs each statement's `_result`. */
function tripDb(db) {
  const c = { trips: 0 };
  const wrap = (st) => ({
    bind: (...a) => wrap(st.bind(...a)),
    first: (...a) => { c.trips++; return st.first(...a); },
    all: (...a) => { c.trips++; return st.all(...a); },
    run: (...a) => { c.trips++; return st.run(...a); },
    _result: () => st._result(),
  });
  const out = Object.create(db);
  out.prepare = (sql) => wrap(db.prepare(sql));
  out.batch = (list) => { c.trips++; return db.batch(list); };
  return { db: out, c };
}
async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  /** An account a week registered (it witnesses), and its row as the service reads it. */
  const player = async (handle) => {
    const w = await s.seated(handle);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOW - WITNESS.ageS, w.id);
    return { ...w, row: raw.prepare('SELECT * FROM players WHERE id = ?').get(w.id) };
  };
  return { ...s, raw, player };
}
/** The common herb patches of the day (a harvest's node each). */
const PATCHES = (() => {
  const out = [];
  for (let x = 300; x < 900 && out.length < 40; x++) for (const p of herbPatches({ x, y: 200, day: TODAY, climate: WOODS, confirmed: false })) if (p.tier === 1) out.push({ x, y: 200, ...p });
  return out;
})();
const harvestBody = (who, p, id = rid('harv')) => ({
  character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: TODAY, slot: p.slot }), kind: 'herbs',
  climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: NOW - 2, rid: id,
});

// ═══ THE SERVICE: A HARVEST ══════════════════════════════════════════════════════════════════════════════════════════

test('GATHER-SPEED: a harvest is four round trips - its request asked before, the hour\'s acts with the ground and the track (asked together), and its decision with its row and every read of its answer in one batch; asked again, two - and the two answers say the same (mutants: the answer read one trip each; the ground and the track apart; the row read back alone; the repeat\'s reads one trip each)', async () => {
  const s = await stand();
  const mac = await s.player('Mac');
  const body = harvestBody(mac, PATCHES[0]);
  const first = tripDb(s.env.DB);
  const a = await harvestNode({ db: first.db, nowS: NOW, rand }, mac.row, s.env, body);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(first.c.trips, 4, 'the request, the hour\'s acts, the ground and the track, the decision with its answer');
  const again = tripDb(s.env.DB);
  const b = await harvestNode({ db: again.db, nowS: NOW, rand }, mac.row, s.env, body);
  assert.equal(again.c.trips, 2, 'asked again: the row, and its answer\'s reads in one batch');
  const { rose, ...said } = a;
  const { repeat, ...saidAgain } = b;
  assert.deepEqual([rose, repeat], [true, true]);
  assert.deepEqual(saidAgain, said, 'the same goods, the same track, the same Stores and the same find');
  assert.deepEqual([a.qty > 0, a.today, a.store.material], [true, 1, a.material]);
  // and through the Worker: the route's answer is the handler's
  const r = await s.call('/v1/prof/harvest', harvestBody(mac, PATCHES[1]), mac.secret);
  assert.deepEqual([r.status, r.body.today], [200, 2], JSON.stringify(r.body));
});

test('GATHER-SPEED: a carried harvest\'s answer says its carried counts from the same batch, and a full carried count is still said (mutant: the carried count read under another name)', async () => {
  const s = await stand();
  const mac = await s.player('Mac');
  const t = tripDb(s.env.DB);
  const a = await harvestNode({ db: t.db, nowS: NOW, rand }, mac.row, s.env, { ...harvestBody(mac, PATCHES[2]), carry: true, held: 0 });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(t.c.trips, 4);
  assert.deepEqual([a.carry, a.carried.material, a.carried.own], [true, a.material, a.qty], 'the bag\'s count, as the service now holds it');
  assert.deepEqual(a.store, { material: a.material, own: 0, bought: 0 }, 'nothing into the Stores');
  s.raw.prepare("INSERT INTO prof_carried (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?) ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty").run(mac.id, mac.character, a.material, CARRIED_MAX);
  const twin = PATCHES.find((p, i) => i > 4 && p.herb === PATCHES[2].herb);   // another patch of the same herb
  assert.ok(twin, 'a patch of the same herb');
  const full = await harvestNode({ db: s.env.DB, nowS: NOW, rand }, mac.row, s.env, { ...harvestBody(mac, twin), carry: true });
  assert.deepEqual(full, { error: 'carried-full', material: a.material });
});

test('GATHER-SPEED: the professions\' state is one round trip, and a pixels-and-dungeons read one (mutants: the state\'s reads one trip each; the pixels\' and the dungeons\' apart)', async () => {
  const s = await stand();
  const mac = await s.player('Mac');
  await harvestNode({ db: s.env.DB, nowS: NOW, rand }, mac.row, s.env, harvestBody(mac, PATCHES[4]));
  const t = tripDb(s.env.DB);
  const st = await profState({ db: t.db, nowS: NOW }, mac.row, s.env, { character: mac.character });
  assert.equal(t.c.trips, 1, 'the tracks, the Stores, the day\'s nodes, the carried count, the day, the writs, the hides and the hauls');
  assert.equal(st.today.herbalism, 1);
  assert.equal(st.taken.length, 1);
  assert.deepEqual([st.writs.today, st.hunt, st.hauls], [0, { hides: 0, high: 0 }, 0]);
  const p = tripDb(s.env.DB);
  const px = await profPixels({ db: p.db }, mac.row, s.env, { character: mac.character, pixels: [[PATCHES[4].x, 200], [PATCHES[4].x + 1, 200]], dungeons: [77] });
  assert.equal(p.c.trips, 1);
  assert.deepEqual([px.pixels.length, px.dungeons.map((d) => d.id)], [2, [77]]);
  const none = tripDb(s.env.DB);
  assert.deepEqual(await profPixels({ db: none.db }, mac.row, s.env, { character: mac.character, pixels: [], dungeons: [] }), { pixels: [], dungeons: [] });
  assert.equal(none.c.trips, 0, 'nothing asked, nothing sent');
});

// ═══ THE SERVICE: THE SEATS' PLACES ══════════════════════════════════════════════════════════════════════════════════

const SEAT = { key: 3021, name: 'Anticlere', region: ANTICLERE, tier: 'palace', pixel: [402, 151] };
const seatRead = (sql) => sql === SEAT_ROWS_SQL || sql === SEAT_JUDGED_SQL;   // LEAN-WITNESS (PIN MOVED): the rows the law judges by are a read of them
test('GATHER-SPEED / MARKET-SPEED: a Levy\'s seat, a Tithe\'s and a board\'s Market Hall read the seats\' witness rows off the isolate\'s kept minute - once for all six asks, where each read them whole (mutants: the Levy unkept; the Tithe unkept; the Market Hall unkept)', async () => {
  const s = await stand({ SEATS_OPEN: 'on' });
  const raw = s.raw;
  raw.exec('PRAGMA foreign_keys = OFF');
  for (const a of ['w1', 'w2', 'w3']) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(SEAT.key), a, seatReportText(SEAT), SEAT.region, NOW - DAY);
  const week = seatWeekOf(NOW * 1000);
  raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'levy', 'g1', 'x', 'law', ?)").run(SEAT.key, week, NOW);
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, at, tithe) VALUES (?, 'g1', ?, 'palace', ?, ?, 5)").run(SEAT.key, SEAT.region, week - 1, NOW);
  raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'market', 1, ?)").run(SEAT.key, NOW);
  const base = s.env.DB;
  const c = { n: 0 };
  const db = Object.create(base);
  db.prepare = (sql) => { if (seatRead(sql)) c.n++; return base.prepare(sql); };
  for (let i = 0; i < 2; i++) {
    assert.equal(await levyAt(db, NOW + i, SEAT.region, SEAT.pixel), SEAT.key, 'the Levy\'s seat');
    assert.deepEqual(await titheAt(db, NOW + i, SEAT.region, SEAT.pixel), { key: SEAT.key, guild: 'g1', pct: 5 }, 'the Tithe\'s');
    assert.ok((await listingsCapAt(db, NOW + i, SEAT.pixel)) > MARKET_LISTINGS_MAX, 'a Market Hall\'s listings');
  }
  assert.equal(c.n, 1, 'six asks within the minute: the rows read once');
});

// ═══ THE SERVICE: A MARKET READ ══════════════════════════════════════════════════════════════════════════════════════

const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
test('MARKET-SPEED: a market read is three round trips - the settle\'s reads with the auctions due, the view\'s rows with the account\'s own, and their couriers with their medians; the view as it was (mutants: the settle\'s reads one trip each; the auctions due asked apart; the account\'s own read one trip each; the couriers and the medians apart)', async () => {
  const s = await stand();
  const mac = await s.player('Mac');
  const ann = await s.player('Ann');
  s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 50)").run(ann.id, ann.character);
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 500)').run(ann.id);
  const listed = await s.call('/v1/market/list', { character: ann.character, region: WR, kind: 'material', material: 'ore:mithril', units: 10, price: 8, hubs: HUBS, rid: rid('mkt') }, ann.secret);
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const t = tripDb(s.env.DB);
  const r = await marketRead({ db: t.db, nowS: NOW, rand }, mac.row, s.env, { character: mac.character, region: DF, view: 'materials', hubs: HUBS });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(t.c.trips, 3, 'three round trips, where it was eighteen');
  assert.deepEqual(r.rows.map((l) => [l.material, l.units, l.price, l.region]), [['ore:mithril', 10, 8, WR]]);
  assert.equal(r.rows[0].road.road, roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 }), 'its courier\'s road, off the hubs');
  assert.ok(r.medians['ore:mithril'], 'its median');
  assert.deepEqual([r.counts, r.balance, r.road, r.listingsMax, r.held, r.goldHeld, r.stores], [{ listings: 0, orders: 0, bids: 0 }, 0, [], MARKET_LISTINGS_MAX, 0, 0, []]);
  // a view with no rows asks after nothing: two
  const mine = tripDb(s.env.DB);
  const m = await marketRead({ db: mine.db, nowS: NOW, rand }, mac.row, s.env, { character: mac.character, region: DF, view: 'mine', hubs: HUBS });
  assert.deepEqual([m.ok, m.rows, m.orders, m.auctions, m.bids, m.ways], [true, [], [], [], [], {}]);
  assert.equal(mine.c.trips, 2);
  // the seller's own: past its hours, the listing expires and its units come back in the same read - one batch for the
  // expiry with its rows read again, one for every row's work
  const later = NOW + 4 * DAY;
  const back = tripDb(s.env.DB);
  const rb = await marketRead({ db: back.db, nowS: later, rand }, ann.row, s.env, { character: ann.character, region: WR, view: 'mine', hubs: HUBS });
  assert.equal(rb.ok, true);
  assert.deepEqual(rb.stores, [{ material: 'ore:mithril', own: 50, bought: 0 }], 'the units back in the Stores, said');
  assert.equal(rb.rows[0].state, 'expired');
  assert.equal(back.c.trips, 5, 'the settle\'s reads, the expiry with its rows, the returns in one batch, the Stores said, the view');
});

// ═══ THE CLIENT: THE NODE GOES WITH ITS ACT ══════════════════════════════════════════════════════════════════════════

const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); const st = { reads: 0, getItem: (k) => { st.reads++; return m.get(k) ?? null; }, setItem: (k, v) => m.set(k, String(v)) }; return st; };
const PX = 405, GLENUMBRA = 59;
const NOON = 20500 * 86_400 + 43_200;
const OUTDOORS = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
/** A host over one flat Woodlands pixel, its book a real one whose door's harvest answers when `release` is called. */
function rig() {
  const day = utcDayOfMs(NOON * 1000);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap = new Uint8Array(128 * 128).fill(2);
  const law = veins({ x: PX, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: PX, py: 150, samples, tilemap, locationRect: null, batches: [], rocks };
  const gate = { answers: /** @type {any[]} */ ([]) };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'mining', xp: 0, rank: 0, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: (b) => new Promise((res) => gate.answers.push((r) => res(r ?? { ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 22, track: { profession: 'mining', xp: 22, rank: 1 }, today: 1 } }))),
  };
  const clock = { ms: NOON * 1000 };
  const storage = memStorage();
  const book = createProfBook({ door, storage, character: () => 'c1', now: () => clock.ms, sleep: () => Promise.resolve() });
  const said = [];
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: (t) => said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const built = new Map([[`${PX},150`, entry]]);
  const entity = { items: [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book })],
    renderer: { createBillboardBatch: (a, r, size, centers, o) => ({ centers: centers.length, dynamic: !!o?.dynamic }), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.ms,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => true,
  });
  const face = (node) => {
    const [x, y, z] = node.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x, y + (node.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
  };
  const centers = () => entry.batches.reduce((a, b) => a + (b.dynamic ? 0 : b.centers ?? 0), 0);   // PIN MOVED (VEIN-CRACKS, GATHER-FEEL II, 2026-10-13): a blow's chunks are a dynamic batch on the pixel's list, no node's flats
  /** The act played to its end at `v`: the press, then a strike each swing. */
  const work = (v) => {
    face(v);
    host.tick(0.016);
    assert.equal(host.press(), true);
    for (let i = 0; i < 8 && host.acting(); i++) { input = { held: false, attack: true, choice: false }; host.tick(MINE_ACT.swingS + 0.01); input = { held: false, attack: false, choice: false }; host.tick(0.01); }
    assert.equal(host.acting(), false, 'the act played to its end');
    host.tick(MINE_ACT.swingS);   // GATHER-FEEL (PIN MOVED): the act's end is its last blow LANDING - the node goes then
  };
  return { host, book, said, entry, gate, clock, storage, centers, work };
}
async function ready(t) {
  setForagingHost({ world: () => OUTDOORS });
  await t.book.refresh();
  t.host.onBuilt(t.entry);
  for (let i = 0; i < 4; i++) await tick();
  return t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
}

test('GATHER-SPEED client: a node goes as its act ends - its flats down before the service answers, the book saying it gone (taken, or being counted); answered, it stays down; refused, it stands again (mutants: the book\'s `gone` the service\'s word alone; the act\'s end stands nothing; a refusal leaves it down)', async () => {
  try {
    const t = rig();
    const v = await ready(t);
    const before = t.centers();
    t.work(v);
    await tick();
    assert.equal(t.book.gone(v.key, 'ore'), true, 'being counted is gone');
    assert.equal(t.book.taken(v.key, 'ore'), false, 'not yet the service\'s word');
    assert.equal(t.centers(), before - 3, 'its flats down, the answer still to come');
    t.gate.answers.shift()();
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(t.book.taken(v.key, 'ore'), true);
    assert.equal(t.centers(), before - 3, 'answered: down');
    // the other tier-1 vein, refused
    const w = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1 && n.key !== v.key);
    assert.ok(w, 'a second vein stands');
    const twice = t.centers();
    t.work(w);
    await tick();
    assert.equal(t.centers(), twice - 3, 'down as its act ended');
    t.gate.answers.shift()({ ok: false, error: 'prof-rank' });
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(t.book.gone(w.key, 'ore'), false);
    assert.equal(t.centers(), twice, 'refused: it stands again');
  } finally { setForagingHost(null); }
});

test('GATHER-SPEED client: a kept harvest let go unanswered (its ten minutes out) stands its node again (mutant: the lapse stands nothing)', async () => {
  try {
    const t = rig();
    const v = await ready(t);
    const before = t.centers();
    t.work(v);
    await tick();
    t.gate.answers.shift()({ ok: false, error: 'offline' });
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(t.book.pendingHarvests, 1, 'kept');
    assert.equal(t.centers(), before - 3, 'kept: still down - being counted');
    t.clock.ms += 11 * 60_000;   // its ten minutes out: the pump lets it go
    for (let i = 0; i < 6; i++) { t.host.tick(0.016); await tick(); }
    assert.equal(t.book.pendingHarvests, 0);
    assert.equal(t.centers(), before, 'let go: it stands again');
  } finally { setForagingHost(null); }
});

test('GATHER-SPEED client: the frame\'s reads of the kept table are the last parse\'s - `counting` and the pump read the storage\'s text and parse it only when it changed, and an idle pump asks nothing until its next harvest is due or PUMP_IDLE_MAX_MS (mutants: the pump idle never kept; the idle kept past a write; counting parsing every time)', async () => {
  const storage = memStorage();
  const kept = { 'acct-1|c1': { harvests: [{ node: 'n1', kind: 'ore', rid: 'p1', nextAt: 5_000, queuedAt: 0, at: 0, character: 'c1', tries: 1 }], withdrawals: [] } };
  storage.setItem(PROF_KEPT_KEY, JSON.stringify(kept));
  let t = 1_000;
  const asked = [];
  const book = createProfBook({ door: { account: () => 'acct-1', harvest: async (b) => { asked.push(b.rid); return { ok: false, error: 'offline' }; } }, storage, character: () => 'c1', now: () => t, sleep: () => Promise.resolve() });
  const realParse = JSON.parse;   // parses counted (the idle's later writes parse their own copy, keptOf)
  let parses = 0;
  JSON.parse = (...a) => { parses++; return realParse(...a); };
  try {
    for (let i = 0; i < 50; i++) { assert.equal(book.counting('n1', 'ore'), true); assert.equal(book.pump(), null); }
    assert.ok(parses <= 1, `fifty frames: parsed ${parses} times`);
    const reads = storage.reads;
    for (let i = 0; i < 20; i++) book.pump();
    assert.equal(storage.reads, reads, 'idle: nothing read');
    t += PUMP_IDLE_MAX_MS;
    book.pump();
    assert.equal(storage.reads, reads + 1, 'PUMP_IDLE_MAX_MS on: read again');
    t = 5_000;
    const p = book.pump();
    assert.ok(p, 'its harvest due: asked');
    await p;
    assert.deepEqual(asked, ['p1']);
    // kept again - its next ask PROF_PUMP_MS on: idle, and nothing read; a harvest kept meanwhile is a write, read at once
    const idle = storage.reads;
    book.pump();
    book.pump();
    assert.equal(storage.reads, idle + 1, 'one look, then idle');
    await book.harvest({ node: 'n2', kind: 'ore', climate: 231, region: 59, act: {}, at: 5 });
    const wrote = storage.reads;
    book.pump();
    assert.ok(storage.reads > wrote, 'the table written since: read again');
  } finally { JSON.parse = realParse; }
  assert.equal(PUMP_IDLE_MAX_MS, 1_000);
});

// ═══ THE CLIENT: THE MARKET'S MINUTE ═════════════════════════════════════════════════════════════════════════════════

test('MARKET-SPEED client: the book says whether its minute\'s cache would answer a read (`fresh`), as `read` itself decides (mutants: fresh past the minute; fresh on another view)', async () => {
  let t = 1_000_000;
  const book = createMarketBook({ door: { account: () => 'acct-1', read: async () => ({ ok: true, data: { rows: [] } }) }, storage: memStorage(), character: () => 'c1', now: () => t, sleep: () => Promise.resolve() });
  const q = { region: 17 };
  assert.equal(book.fresh('materials', q), false, 'never read');
  await book.read('materials', q);
  assert.equal(book.fresh('materials', q), true);
  assert.equal(book.fresh('orders', q), false, 'another view');
  t += 60_000;
  assert.equal(book.fresh('materials', q), false, 'the minute past');
});

test('MARKET-SPEED client: a view the minute\'s cache answers is drawn once, with its answer - never a "Reading the market..." frame first; an uncached one draws its wait (mutant: the wait drawn whatever the cache)', async () => {
  let fresh = false, draws = 0;
  const book = {
    state: { open: true, balance: 10, road: [], counts: {} }, pending: 0, busy: false, cached: () => null, fresh: () => fresh,
    read: async () => ({ ok: true, data: { rows: [], medians: {} } }), settle: async () => ({ ok: true, settled: 0 }),
  };
  const m = { book, stores: () => new Map(), region: 17, regionNameOf: () => 'Daggerfall', hubs: {}, name: (k) => k, countName: (k) => k, pieces: () => [], board: null };
  const tab = createMarketTab(m, { busy: () => false, run: async (f) => { await f(); }, rerender: () => { draws++; }, nowS: () => 0, alive: () => true });
  await tab.load(false);
  assert.equal(draws, 2, 'uncached: the wait, then the answer');
  fresh = true;
  draws = 0;
  await tab.load(false);
  assert.equal(draws, 1, 'cached: the answer alone');
  draws = 0;
  await tab.load(true);
  assert.equal(draws, 2, 'forced: the wait, then the answer');
});

// ═══ AUDIT GATHER-SPEED (2026-10-11, Mac: "audit this") ══════════════════════════════════════════════════════════════

test('AUDIT GATHER-SPEED G1: `gone` asked of every node near the player, every frame, reads the storage once - the set of nodes being counted kept until this book writes, the slot changes or PUMP_IDLE_MAX_MS (mutant: counting read off the storage each ask)', async () => {
  const storage = memStorage();
  storage.setItem(PROF_KEPT_KEY, JSON.stringify({ 'acct-1|c1': { harvests: [{ node: 'n7', kind: 'ore', rid: 'p7', nextAt: 0, queuedAt: 0, at: 0, character: 'c1', tries: 0 }], withdrawals: [] } }));
  let t = 1_000;
  const book = createProfBook({ door: { account: () => 'acct-1', harvest: async () => ({ ok: false, error: 'offline' }) }, storage, character: () => 'c1', now: () => t, sleep: () => Promise.resolve() });
  const reads = storage.reads;
  let gone = 0;
  for (let i = 0; i < 300; i++) gone += book.gone(`n${i}`, 'ore') ? 1 : 0;
  assert.equal(gone, 1, 'the one being counted');
  assert.ok(storage.reads - reads <= 1, `three hundred asks: ${storage.reads - reads} reads`);
  await book.harvest({ node: 'n8', kind: 'ore', climate: 231, region: 59, act: {}, at: 1 });
  assert.equal(book.gone('n8', 'ore'), true, 'a harvest this book kept: at once');
  // another tab's: within PUMP_IDLE_MAX_MS
  const other = JSON.parse(storage.getItem(PROF_KEPT_KEY));
  other['acct-1|c1'].harvests.push({ node: 'n9', kind: 'ore', rid: 'p9', nextAt: 0, queuedAt: 0, at: 0, character: 'c1', tries: 0 });
  storage.setItem(PROF_KEPT_KEY, JSON.stringify(other));
  t += PUMP_IDLE_MAX_MS;
  assert.equal(book.gone('n9', 'ore'), true, 'another tab\'s, PUMP_IDLE_MAX_MS on');
});

test('AUDIT GATHER-SPEED G2: a tree felled as its act ended and then refused takes back its fall and its logs - laid, or still to be laid (mutants: the refusal leaves the fall; the logs laid after it)', async () => {
  const made = [], destroyed = new Set();
  let release = null;
  const kind = treeKind({
    book: { taken: () => false, counting: () => false }, renderer: { createBillboardBatch: (a, r, size, centers) => { const b = { a, r, centers }; made.push(b); return b; }, destroyBatch: (b) => destroyed.add(b) },
    getTexture: () => new Promise((res) => { release = () => res({ recordCount: 99 }); }), billboardSize: () => ({ w: 1, h: 1 }), uploadRecord: () => {}, flatBatchAabb: () => [0, 0, 0, 1, 1, 1],
  });
  const forest = { base: 504, archive: 504, groups: new Map([['g', { batch: { archive: 504, record: 12 }, size: { w: 4, h: 8 }, centers: [[5, 0, 5], [9, 0, 9]] }]]) };
  const entry = { forest, batches: [] };
  const fell = (key, i) => kind.felled({ key, flat: { group: 'g', i } }, { entry, from: [0, 0, 0], tr: [0, 0, 0] });
  // refused after its logs lay
  const a = fell('tree:a', 0);
  release(); await a;
  assert.equal(entry.batches.length, 2, 'the fall and the logs');
  kind.refused('tree:a', 'prof-rank');
  assert.equal(entry.batches.length, 0, 'both gone');
  assert.equal(destroyed.size, 2);
  // refused while its logs' texture is under way: they are never laid
  const b = fell('tree:b', 1);
  assert.equal(entry.batches.length, 1, 'the fall, its logs to come');
  kind.refused('tree:b', 'lapsed');
  release(); await b;
  assert.deepEqual(entry.batches, [], 'nothing lies');
  assert.equal(made.length, 4, 'its logs were made, and let go at once');
});

test('AUDIT GATHER-SPEED G5: a fresh harvest whose dice found no silver asks after no find - its line, the day\'s finds and the balance are read only where a find was struck (mutant: the find\'s reads always asked)', async () => {
  const s = await stand();
  const mac = await s.player('Mac');
  const seen = { with: 0, without: 0 };
  for (const p of PATCHES.slice(20, 30)) {
    const sql = [];
    const db = Object.create(s.env.DB);
    db.prepare = (q) => { sql.push(q); return s.env.DB.prepare(q); };
    const a = await harvestNode({ db, nowS: NOW, rand }, mac.row, s.env, harvestBody(mac, p));
    assert.equal(a.ok, true, JSON.stringify(a));
    const asked = sql.filter((q) => q === 'SELECT * FROM marks_ledger WHERE actor = ? AND rid = ?').length;
    assert.equal(asked, a.marks ? 1 : 0, `a harvest ${a.marks ? 'with' : 'without'} a find`);
    seen[a.marks ? 'with' : 'without']++;
  }
  assert.ok(seen.without > 0, 'a harvest without a find was asked');
});

test('AUDIT GATHER-SPEED G7: a view chosen while some other market act runs draws its wait - only the read an act asks waits for the act\'s own draw (mutant: every read under an act undrawn)', async () => {
  let draws = 0, busy = true;
  const book = {
    state: { open: true, balance: 10, road: [], counts: {} }, pending: 0, busy: false, cached: () => null, fresh: () => false,
    read: async () => ({ ok: true, data: { rows: [], medians: {} } }), settle: async () => ({ ok: true, settled: 0 }),
  };
  const m = { book, stores: () => new Map(), region: 17, regionNameOf: () => 'Daggerfall', hubs: {}, name: (k) => k, countName: (k) => k, pieces: () => [], board: null };
  const tab = createMarketTab(m, { busy: () => busy, run: async (f) => { await f(); }, rerender: () => { draws++; }, nowS: () => 0, alive: () => true });
  await tab.load(false);
  assert.equal(draws, 2, 'chosen under another act: its wait, then its answer');
  draws = 0;
  await tab.load(true, { underAct: true });
  assert.equal(draws, 1, 'the act\'s own read: its answer alone (the act\'s end draws its wait)');
  busy = false;
});
