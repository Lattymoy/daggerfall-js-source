// STORM-SHED (2026-10-06 evening, the account service overloaded a second time - "D1_ERROR: D1 DB is overloaded.
// Requests queued for too long." - and players' decorations missing): read off the database and the service's own
// metrics (bible/06-Systems/Online-Arc.md STORM-SHED), the overload came in waves - a relay deploy, midnight, a burst of
// reconnects at 20:10 - and the clients' own asking again held each wave up:
//   A. a token mint slower than the session's TOKEN_WAIT_MS was marked as its room's though that room's hello went
//      without it, so the room's retry minted again (net/accountClient.js `opened`); and a failed mint was asked again
//      by every room within seconds (MINT_COOL_MS, which the session waits out - net/online.js _afterMintHold);
//   B. a Watch claim that failed was claimed again the frame after its answer (net/townSeatBook.js SEAT_WATCH_RETRY_MS);
//   C. the reads those asks multiplied: every seat's witness rows read whole on each list, claim and report (one isolate
//      keeps them SEAT_ROWS_KEPT_S - server-account/src/townSeats.js), and a character's harvests today read off every
//      player's (migration 0085's index).
// Each pin failed on the build before it. tools/mutants/stormshed.json.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

import { accountTokenMinter, SESSION_KEY, MINT_COOL_MS, MINT_COOL_MAX_MS } from '../src/net/accountClient.js';
import { OnlineSession, TOKEN_WAIT_MS, BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { CLOSE_POLICY } from '../src/net/wire.js';
import { createTownSeatBook, SEAT_WATCH_RETRY_MS, SEAT_WATCH_CLAIM_EVERY_MS } from '../src/net/townSeatBook.js';
import { SEAT_WATCH_CLAIM_MAX, seatReportText } from '../src/net/townSeatLaw.js';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';
import { listSeats, confirmedSeats, witnessSeat, strikeSeat, SEAT_ROWS_KEPT_S } from '../server-account/src/townSeats.js';
import { claimWatch } from '../server-account/src/seatInfluence.js';
import { countedDb } from '../server-account/src/metrics.js';
import { d1, standService, T0 } from './accountDb.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const subtle = webcrypto.subtle;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const DAY = 86400;

// ═══ A. THE TOKEN ════════════════════════════════════════════════════════════════════════════════════════════════════

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
/** The token route: each mint a new token (`n` counts the asks), or `fail`'s refusal; `held` a promise each ask waits on. */
function service({ fail = null } = {}) {
  const box = { n: 0, fail, held: /** @type {Promise<any>|null} */ (null), fetch: /** @type {any} */ (null) };
  box.fetch = async () => {
    box.n += 1;
    const n = box.n;
    if (box.held) await box.held;
    if (box.fail) return { ok: false, status: 503, headers: { get: () => 'application/json' }, json: async () => ({ error: box.fail }) };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ token: `v1.claims${n}.sig${n}`, name: 'Mac', kind: 'linked', expiresAt: 1 }) };
  };
  return box;
}
const SESSION = { id: 'p1', secret: 'a-secret-long-enough-0001' };
const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const ROOMS = ['world:3,12', 'world:4,12', 'chat:world', 'chat:region.17'];

test('STORM-SHED A: a failed mint holds the page\'s next one off - every room asking meanwhile is answered at once with the failure\'s word, nothing on the wire; the hold doubles with each failure in a row to MINT_COOL_MAX_MS, a token lets it go, and another sign-in is never held by this one\'s (mutants: no hold; undoubled; uncapped; kept past a token; another sign-in held)', async () => quiet(async () => {
  let t = 1_000_000;
  const svc = service({ fail: 'server' });
  const storage = fakeStorage(SESSION);
  const mint = accountTokenMinter({ fetch: svc.fetch, storage, now: () => t, rand: () => 0.5 });
  assert.equal(await mint('world:3,12'), null);
  assert.equal(svc.n, 1);
  assert.equal(mint.lastWhy, 'server');
  assert.equal(mint.coolMs(), MINT_COOL_MS, 'held MINT_COOL_MS (the jitter at its middle)');
  for (const room of ROOMS) assert.equal(await mint(room), null, room);
  assert.equal(svc.n, 1, 'every room meanwhile: answered at once, nothing asked');
  assert.equal(mint.lastWhy, 'server', 'with the failure\'s word');
  let hold = MINT_COOL_MS;
  for (let i = 0; i < 6; i++) {
    t += hold;
    assert.equal(await mint('world:3,12'), null, 'past the hold: asked, and failed again');
    hold = Math.min(MINT_COOL_MAX_MS, hold * 2);
    assert.equal(mint.coolMs(), hold, `failure ${i + 2} in a row: held ${hold} ms`);
  }
  assert.equal(hold, MINT_COOL_MAX_MS, 'capped');
  assert.equal(svc.n, 7);
  svc.fail = null;
  t += hold;
  assert.ok(await mint('world:3,12'), 'the service back: minted');
  assert.equal(mint.coolMs(), 0, 'a token lets the hold go');
  svc.fail = 'server';
  await mint(null);
  assert.equal(mint.coolMs(), MINT_COOL_MS, 'the next failure counted from the start');
  storage.setItem(SESSION_KEY, JSON.stringify({ id: 'p2', secret: 'another-secret-long-enough' }));
  assert.equal(mint.coolMs(), 0, 'another sign-in on the device is not held');
  const n = svc.n;
  await mint('world:3,12');
  assert.equal(svc.n, n + 1, 'and is asked for');
  assert.deepEqual([MINT_COOL_MS, MINT_COOL_MAX_MS], [2_000, 60_000]);
}));

test('STORM-SHED A: rooms waiting on a mint that fails are answered with its word, never each minting again (mutant: the hold unasked by the rooms that waited)', async () => quiet(async () => {
  let release = () => {};
  const svc = service({ fail: 'server' });
  svc.held = new Promise((r) => { release = r; });
  const mint = accountTokenMinter({ fetch: svc.fetch, storage: fakeStorage(SESSION), rand: () => 0.5 });
  const asked = ROOMS.map((room) => mint(room));
  await settle();
  assert.equal(svc.n, 1, 'one on the wire');
  release();
  assert.deepEqual(await Promise.all(asked), [null, null, null, null]);
  assert.equal(svc.n, 1, 'and only that one: the four failed together');
}));

test('STORM-SHED A: a token opens a room when a hello carries it there - one the session gave up waiting for opened nothing, and that room is handed it again; a hello\'s word of another token changes nothing (mutants: the room marked at the mint; `opened` unheard; any token\'s word taken)', async () => quiet(async () => {
  const svc = service();
  const mint = accountTokenMinter({ fetch: svc.fetch, storage: fakeStorage(SESSION) });
  const late = await mint('world:3,12');   // its hello went without it - the session's wait ran out first
  assert.ok(late);
  assert.equal(await mint('world:3,12'), late, 'the room\'s next socket: the same token, no second mint');
  assert.equal(svc.n, 1);
  mint.opened('world:3,12', 'v1.another.token');
  assert.equal(await mint('world:3,12'), late, 'a hello that carried another token is no word of this one');
  mint.opened('world:3,12', late);
  const fresh = await mint('world:3,12');
  assert.notEqual(fresh, late, 'a hello carried it there: the room is minted afresh');
  assert.equal(svc.n, 2);
}));

test('STORM-SHED A, driven: a mint slower than TOKEN_WAIT_MS sends the room\'s hello without it - and the room\'s next socket opens on THAT token, one mint in all, where every retry minted again (hundreds an hour a client while the database queued) (mutant: the room marked at the mint; the hello\'s word unsaid)', async () => quiet(async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let release = () => {};
    const svc = service();
    svc.held = new Promise((r) => { release = r; });
    const mintToken = accountTokenMinter({ fetch: svc.fetch, storage: fakeStorage(SESSION) });
    const { FakeWS, sockets } = fakeSocketClass();
    let now = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now, rand: () => 0.5, mintToken });
    s.join('world:3,12', pose);
    sockets[0].open();
    await settle();
    mock.timers.tick(TOKEN_WAIT_MS);
    await settle();
    assert.equal('tok' in JSON.parse(sockets[0].sent[0]), false, 'the wait ran out: the hello went without');
    sockets[0].drop(CLOSE_POLICY);
    release();   // the slow mint lands after its room's hello was refused
    await settle();
    now += 2 * BACKOFF_MAX_MS;
    s.tick();
    assert.equal(sockets.length, 2, 'the room asked again');
    sockets[1].open();
    await settle();
    assert.equal(JSON.parse(sockets[1].sent[0]).tok, 'v1.claims1.sig1', 'the late token opens the room');
    assert.equal(svc.n, 1, 'one mint in all');
    // that hello spent it there: the room's next socket is minted afresh
    sockets[1].drop(1006);
    now += 2 * BACKOFF_MAX_MS;
    s.tick();
    sockets[2].open();
    await settle();
    assert.equal(JSON.parse(sockets[2].sent[0]).tok, 'v1.claims2.sig2', 'opened by its hello: a fresh one');
    assert.equal(svc.n, 2);
  } finally { mock.timers.reset(); }
}));

test('STORM-SHED A: a room refused for want of a token is asked again only once the minter\'s hold runs out - the primary and a halo; no hold, the retry it always had (mutants: the primary unheld; the halo unheld)', async () => quiet(async () => {
  const HOLD = 30_000;
  const make = (hold) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const clock = { now: 1_000_000 };
    const mintToken = Object.assign(async () => null, { lastWhy: 'server', coolMs: () => hold, opened: () => {} });
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now, rand: () => 0.5, mintToken });
    return { s, sockets, clock };
  };
  const p = make(HOLD);
  p.s.join('world:3,12', pose);
  p.sockets[0].open();
  await settle();
  p.sockets[0].drop(CLOSE_POLICY);
  assert.ok(p.s._retryAt >= p.clock.now + HOLD, 'the primary waits out the hold');
  p.clock.now += HOLD - 1;
  p.s.tick();
  assert.equal(p.sockets.length, 1, 'not before it ends');
  p.clock.now += BACKOFF_MIN_MS + 1;
  p.s.tick();
  assert.equal(p.sockets.length, 2, 'asked again once it has');
  // a halo
  const h = make(HOLD);
  h.s.join('world:3,12', pose);
  h.sockets[0].open();
  await settle();
  h.sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  h.s.setHalo(['world:2,12']);
  h.sockets[1].open();
  await settle();
  h.sockets[1].drop(CLOSE_POLICY);
  assert.ok(h.s._halo.get('world:2,12').retryAt >= h.clock.now + HOLD, 'a halo waits it out too');
  // no hold: the backoff the session always had
  const z = make(0);
  z.s.join('world:3,12', pose);
  z.sockets[0].open();
  await settle();
  z.sockets[0].drop(CLOSE_POLICY);
  assert.ok(z.s._retryAt < z.clock.now + BACKOFF_MAX_MS + BACKOFF_MIN_MS, 'within the backoff');
}));

// ═══ B. THE WATCH'S CLAIM ════════════════════════════════════════════════════════════════════════════════════════════

test('STORM-SHED B: a Watch claim that failed waits SEAT_WATCH_RETRY_MS before the next, doubling with each failure in a row to SEAT_WATCH_CLAIM_EVERY_MS - never the frame after its answer; an answer lets the wait go (mutants: no wait; the frame\'s test unheld; undoubled; uncapped; kept past an answer)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const now = { ms: 1_800_000_000 * 1000 };
  let answer = { ok: false, error: 'server' };
  const calls = [];
  const store = new Map();
  const book = createTownSeatBook({
    door: /** @type {any} */ ({ list: async () => ({ ok: true, data: { seats: [], me: {} } }), watch: async (...a) => { calls.push(a); return answer; } }),
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    nowMs: () => now.ms, me: () => 'acct-0001', character: () => 'char-1', isSeatPixel: (x, y) => x === 402 && y === 151,
    relayNowS: () => Math.floor(now.ms / 1000), rand: () => 0.5,
  });
  await book.read();
  const hold = async () => { for (let i = 0; i < SEAT_WATCH_CLAIM_MAX; i++) book.keepWatch(await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: Math.floor(Math.random() * 1e9) }, kp.privateKey, { subtle, nowS: Math.floor(now.ms / 1000) })); };
  await hold();
  assert.equal(book.claimWatchDue(), true, 'a claim\'s worth held');
  assert.equal(await book.claimWatch(), null);
  assert.equal(calls.length, 1);
  let wait = SEAT_WATCH_RETRY_MS;
  for (let i = 0; i < 6; i++) {
    assert.equal(book.claimWatchDue(), false, 'the frame after a failed claim: not due');
    assert.equal(await book.claimWatch(), null);
    assert.equal(calls.length, i + 1, 'nothing asked');
    now.ms += wait - 1;
    assert.equal(book.claimWatchDue(), false, 'not a moment early');
    now.ms += 1;
    assert.equal(book.claimWatchDue(), true, `due ${wait} ms on`);
    assert.equal(await book.claimWatch(), null);
    assert.equal(calls.length, i + 2);
    wait = Math.min(SEAT_WATCH_CLAIM_EVERY_MS, wait * 2);
  }
  assert.equal(wait, SEAT_WATCH_CLAIM_EVERY_MS, 'capped at the claim\'s own ten minutes');
  assert.equal(book.watchHeldCount(), SEAT_WATCH_CLAIM_MAX, 'kept through every failure');
  answer = { ok: true, data: { ok: true, counted: SEAT_WATCH_CLAIM_MAX } };
  now.ms += wait;
  assert.deepEqual(await book.claimWatch(), { ok: true, counted: SEAT_WATCH_CLAIM_MAX });
  assert.equal(book.watchHeldCount(), 0, 'an answer lets them go');
  answer = { ok: false, error: 'server' };
  await hold();
  assert.equal(await book.claimWatch(), null);
  const asked = calls.length;
  now.ms += SEAT_WATCH_RETRY_MS;
  assert.equal(book.claimWatchDue(), true, 'the answer let the wait go: a new failure waits SEAT_WATCH_RETRY_MS again');
  await book.claimWatch();
  assert.equal(calls.length, asked + 1);
  assert.equal(SEAT_WATCH_RETRY_MS, 30_000);
});

// ═══ C. THE READS THE ASKS MULTIPLIED ════════════════════════════════════════════════════════════════════════════════

const ENV = { SEATS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra' };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ALCAIRE = { key: 3022, name: 'Alcaire', region: 21, tier: 'palace', pixel: [410, 160] };
const WITNESS_SQL = "SELECT key, account, report, at FROM world_witness WHERE kind = 'seat'";

/** The service's database with three witnesses agreeing on Anticlere, its seat witness reads counted - and, `gate.hold`
 *  set, each such read held until `gate.release()`. */
async function seatsDb() {
  const svc = await standService(ENV);
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  const base = svc.env.DB;
  const c = { n: 0 };
  const gate = { hold: false, release: () => {} };
  const db = Object.create(base);
  db.prepare = (sql) => {
    const st = base.prepare(sql);
    if (sql !== WITNESS_SQL) return st;
    c.n++;
    return { all: async () => { const r = await st.all(); if (gate.hold) await new Promise((res) => { gate.release = res; }); return r; } };
  };
  return { svc, db, c, gate };
}
const PLAYER = { id: 'p-somebody', handle: 'Somebody', registered_at: T0 - 30 * DAY };
const DEV = { id: 'p-devra', handle: 'Devra', registered_at: T0 - 30 * DAY };

test('STORM-SHED C: the seats\' witness rows are read once in SEAT_ROWS_KEPT_S by one isolate for a player\'s list and a Watch claim, every ask of one moment sharing the read; a developer\'s list and every other act read the table as it stands (mutants: the kept answer; the shared ask; the developer kept; the claim unkept)', async () => {
  const { db, c } = await seatsDb();
  const first = await listSeats({ db, nowS: T0 }, PLAYER, ENV);
  assert.deepEqual(first.seats.map((s) => s.key), [ANTICLERE.key]);
  assert.equal(c.n, 1);
  await listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S - 1 }, PLAYER, ENV);
  assert.equal(c.n, 1, 'a player\'s list within the minute: the kept rows');
  assert.equal((await confirmedSeats(db, T0 + 5, { kept: true })).has(ANTICLERE.key), true);
  assert.equal(c.n, 1, 'a Watch claim\'s seats: the kept rows');
  assert.equal((await confirmedSeats(db, T0 + 5)).has(ANTICLERE.key), true);
  assert.equal(c.n, 2, 'any other act: the table as it stands');
  await listSeats({ db, nowS: T0 + 5 }, DEV, ENV);
  assert.equal(c.n, 3, 'a developer\'s list: the table as it stands - the audit at once (AUDIT-SEATS T2)');
  await listSeats({ db, nowS: T0 + SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  assert.equal(c.n, 4, 'a minute on: read again');
  const later = T0 + 3 * SEAT_ROWS_KEPT_S;
  await Promise.all([listSeats({ db, nowS: later }, PLAYER, ENV), confirmedSeats(db, later, { kept: true }), listSeats({ db, nowS: later }, PLAYER, ENV)]);
  assert.equal(c.n, 5, 'three asks at one moment: one read');
  assert.equal(SEAT_ROWS_KEPT_S, 60);
});

test('STORM-SHED C: the kept rows are this isolate\'s news first - a witness\'s report or a strike written here lets them go at once, and a read begun before such a write is never kept (mutants: the report unforgotten; the strike unforgotten; the write unasked of a read in flight)', async () => {
  const { svc, db, c, gate } = await seatsDb();
  const wit = await svc.registered('Witness');
  await listSeats({ db, nowS: T0 }, PLAYER, ENV);
  assert.equal(c.n, 1);
  const reported = await witnessSeat({ db, nowS: T0 + 1 }, { id: wit.id, handle: 'Witness', registered_at: T0 - 30 * DAY }, ENV, { seat: ALCAIRE });
  assert.deepEqual(reported, { ok: true, counted: true });
  assert.equal(c.n, 1, 'the report read the kept rows');
  await listSeats({ db, nowS: T0 + 2 }, PLAYER, ENV);
  assert.equal(c.n, 2, 'the report written here: read afresh at once');
  await listSeats({ db, nowS: T0 + 3 }, PLAYER, ENV);
  assert.equal(c.n, 2, 'and kept again');
  assert.equal((await strikeSeat({ db, nowS: T0 + 4 }, DEV, ENV, { key: ANTICLERE.key })).ok, true);
  const after = await listSeats({ db, nowS: T0 + 5 }, PLAYER, ENV);
  assert.equal(c.n, 3, 'the strike written here: read afresh at once');
  assert.deepEqual(after.seats, [], 'the struck seat gone from the list');
  // a read in flight across a write: answered, never kept
  gate.hold = true;
  const inFlight = listSeats({ db, nowS: T0 + 2 * SEAT_ROWS_KEPT_S }, PLAYER, ENV);
  await settle();
  assert.equal((await strikeSeat({ db, nowS: T0 + 2 * SEAT_ROWS_KEPT_S }, DEV, ENV, { key: ALCAIRE.key })).ok, true);
  gate.hold = false;
  gate.release();
  await inFlight;
  const n = c.n;
  await listSeats({ db, nowS: T0 + 2 * SEAT_ROWS_KEPT_S + 1 }, PLAYER, ENV);
  assert.equal(c.n, n + 1, 'the read begun before the strike was not kept');
});

test('STORM-SHED C: a Watch claim reads the seats off the kept rows - the claim a client sends every few minutes, and a build before this one sent again on every failure (mutant: the claim unkept)', async () => {
  const { db, c } = await seatsDb();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const receipt = await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 1 }, kp.privateKey, { subtle, nowS: T0 });
  const claim = (nowS) => claimWatch({ db, nowS, subtle }, PLAYER, ENV, { character: 'char-1', receipts: [receipt] }, kp.publicKey);
  assert.deepEqual(await claim(T0), { ok: true, counted: 0, why: { 'not-yours': 1 } });
  assert.deepEqual(await claim(T0 + 1), { ok: true, counted: 0, why: { 'not-yours': 1 } });
  assert.equal(c.n, 1, 'two claims within the minute: one read');
});

test('STORM-SHED C: the kept rows are the isolate\'s, not a request\'s - each request counts its statements through a Proxy of its own (metrics.js countedDb), which names the binding it wraps, so two requests of one isolate read the rows once (mutant: the Proxy names no binding)', async () => {
  const { db, c } = await seatsDb();
  await listSeats({ db: countedDb(db, { n: 0 }), nowS: T0 }, PLAYER, ENV);
  await listSeats({ db: countedDb(db, { n: 0 }), nowS: T0 + 1 }, PLAYER, ENV);
  assert.equal(c.n, 1, 'two requests, two Proxies, one read');
});

test('STORM-SHED C: a character\'s harvests today are read off its own rows - the professions\' state read plans on idx_node_harvests_char_day by the player, the character and the day, never the primary key by the day alone (every player\'s harvests of the day, 8,021 rows a read in the outage) (mutant: migration 0085 unwritten)', () => {
  const sql = /'(SELECT node, kind FROM node_harvests WHERE player = \?1 AND char_id = \?2 AND day = \?3)'/.exec(src('server-account/src/professions.js'))?.[1];
  assert.ok(sql, 'the state\'s own read, as professions.js asks it');
  const plan = d1()._raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all('p', 'c', 1).map((r) => r.detail).join(' | ');
  assert.match(plan, /USING COVERING INDEX idx_node_harvests_char_day \(player=\? AND char_id=\? AND day=\?\)/);
});
