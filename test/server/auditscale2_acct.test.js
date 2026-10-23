// AUDIT SCALE II (2026-10-11, Mac: "Lets do an audit on everything. Ensure perfection") - the audit of SCALE4d-SCALE5d
// on pull request #757 (bible/11-Multiplayer/Scale-Arc.md). This file is lane A's: the account service, the client's
// doors to it and the load harness. Every finding fixed here was reproduced first against a snapshot of the pushed head
// (e729cea7), and each pin below fails on the code as it stood (tools/mutants/auditscale2_acct.json). The modules whose
// exports the audit added are imported whole (`* as`), so on the code as it stood each pin fails by itself rather than
// the file failing to load. test/laggyD1.mjs is a D1 with one read replica lagging the primary, as D1's Sessions API's
// contract says one may: test/accountDb.mjs's sessions have none, so no earlier pin could fail on WHERE a session
// starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { standService, T0, d1, d1Position, sessionStorageOf } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { laggy } from '../laggyD1.mjs';
import * as service from '../../server-account/src/service.js';
import * as admit from '../../server-account/src/admit.js';
import { MAX_BODY_BYTES } from '../../server-account/src/service.js';
import { motherlodesOf } from '../../server-account/src/motherlodes.js';
import worker from '../../server-account/src/index.js';
import * as client from '../../src/net/accountClient.js';
import { realmJoin, realmList } from '../../src/systems/realmSaves.js';
import { removeCloudSlot, cloudList } from '../../src/systems/cloudSaves.js';
import { insigniaSale } from '../../src/systems/sigil/sigilBroker.js';
import { sigilStone } from '../../src/systems/gate/gateSpoils.js';
import { insigniaById } from '../../src/net/insignia.js';
import { verifyToken } from '../../src/net/identityToken.js';
import { MOTHERLODE_CLIMATES } from '../../src/net/motherlodeLaw.js';
import { slimPose, wire2Batch } from '../../src/net/wire.js';
import * as harness from '../../tools/loadHarness.mjs';

const { call, noteD1Bookmark, d1BookmarkFor, forgetD1Bookmark, readAccount, buyInsignia, mintIdentity, SESSION_KEY } = client;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; forgetD1Bookmark(); });

const MARK = (n) => `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;
const BASE = 'https://accounts.invalid';
/** A request to the real Worker as a tab sends it - its secret, and the bookmark it carries. */
const send = (S, path, { method = 'POST', secret, body = {}, mark = null } = {}) => S.fetch(`${BASE}${path}`, {
  method, headers: { authorization: `Bearer ${secret}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...(mark ? { 'x-d1-bookmark': mark } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined,
});
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
/** A promise and the hand that settles it. */
const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; };

test('AUDIT SCALE II A-1 the mint starts at the primary whatever bookmark it carries - a realm join its bookmark never saw signs `rc` 1, a lease another tab took since signs `rc` 0 - and every other bookmark read keeps its bookmark (mutants: the mint started from its bookmark; the list emptied)', async () => {
  assert.deepEqual([...(service.PRIMARY_FIRST_ROUTES ?? [])], ['/v1/auth/token']);
  const opened = [];
  const raw = { prepare: () => ({}), withSession(c) { opened.push(c); return { prepare: () => ({}), getBookmark: () => 'b' }; } };
  service.routeDb(raw, '/v1/auth/token', 'POST', MARK(7));
  service.routeDb(raw, '/v1/heartbeat', 'POST', MARK(7));
  service.routeDb(raw, '/v1/account', 'GET', MARK(8));
  assert.deepEqual(opened, ['first-primary', MARK(7), MARK(8)], 'the mint at the primary; the reads at their bookmark');

  // over the real Worker, on a database whose one replica lags
  const S = await standService();
  const L = laggy(S.env.DB);
  S.env.DB = L.db;
  try {
    const who = await S.registered('Aldric');
    const A = await seatRealm(S.env, who.secret, 'Aldric');
    const B = await seatRealm(S.env, who.secret, 'Brynja');
    const join = async (id) => assert.equal((await send(S, '/v1/realm/join', { secret: who.secret, body: { id } })).status, 200);
    const leaseOf = (id) => S.env.DB._raw.prepare('SELECT lease FROM realm_characters WHERE id = ?').get(id).lease;
    const mint = async (id, mark) => {
      const r = await send(S, '/v1/auth/token', { secret: who.secret, body: { character: id, guild: true }, mark });
      assert.equal(r.status, 200, await r.clone().text());
      return (await verifyToken((await r.json()).token, S.identityPublic, { subtle, nowS: T0 })).claims;
    };
    // the tab plays B; its heartbeat's bookmark kept; the replica catches up to there, and lags
    await join(B.id);
    const hb1 = (await send(S, '/v1/heartbeat', { secret: who.secret, body: { beat: true } })).headers.get('x-d1-bookmark');
    assert.ok(hb1);
    L.sync();
    // the player picks A: the join answers no bookmark, so the tab's is still from before it
    await join(A.id);
    assert.ok(leaseOf(A.id) && !leaseOf(B.id), 'the primary: A in play');
    let c = await mint(A.id, hb1);
    assert.deepEqual([c.rc, c.ci], [1, A.id], 'the join the bookmark never saw: A is the realm\'s, as the relay\'s door must read it');
    assert.equal(L.log.at(-1).constraint, 'first-primary', 'the mint\'s session began at the primary');
    // the replica catches up again; then another tab takes B into play, and A's lease goes (INT9)
    const hb2 = (await send(S, '/v1/heartbeat', { secret: who.secret, body: { beat: true }, mark: hb1 })).headers.get('x-d1-bookmark');
    assert.equal(L.log.at(-1).constraint, hb1, 'a heartbeat keeps its bookmark');
    L.sync();
    await join(B.id);
    assert.equal(leaseOf(A.id), null);
    c = await mint(A.id, hb2);
    assert.equal(c.rc, 0, 'a lease another tab took: A is not this tab\'s to play');
    assert.equal(c.ci, undefined);
    const r = await send(S, '/v1/account', { method: 'GET', secret: who.secret, mark: hb2 });
    assert.equal(r.status, 200);
    assert.equal(L.log.at(-1).constraint, hb2, 'the account view keeps its bookmark');
    assert.equal(L.log.at(-1).replica, true, 'and a replica as new as it may serve it');
  } finally { L.close(); }
});

test('AUDIT SCALE II A-4 a session revoked on the primary mints nothing, whatever bookmark its secret carries - the mint\'s session lookup is the primary\'s again, as SCALE4d made it (mutants: the mint started from its bookmark)', async () => {
  const S = await standService();
  const L = laggy(S.env.DB);
  S.env.DB = L.db;
  try {
    const who = await S.registered('Aldric');
    const phone = (await S.call('/v1/auth/login', { handle: 'Aldric', password: 'a good long one' })).body;
    assert.ok(phone?.secret);
    const hb = (await send(S, '/v1/heartbeat', { secret: who.secret, body: { beat: true } })).headers.get('x-d1-bookmark');
    L.sync();
    // the owner, on the phone, changes the password: every other device's session is closed
    const pw = await send(S, '/v1/account/password', { secret: phone.secret, body: { oldPassword: 'a good long one', password: 'another good long one' } });
    assert.equal(pw.status, 200);
    const r = await send(S, '/v1/auth/token', { secret: who.secret, mark: hb });
    assert.equal(r.status, 401, 'the closed session signs no token');
    assert.deepEqual(await r.json(), { error: 'auth' });
  } finally { L.close(); }
});

test('AUDIT SCALE II A-2 a call that is no bookmark read forgets the page\'s bookmark, before it is sent and once it is answered, and a read sent before a forget keeps nothing - so a Sigil Broker sale whose answer was lost is read back at the primary and its stones stay spent; the client\'s reads are the service\'s, one list (mutants: the forget before the send; after the answer; the era unread; a forget that moves no era; a read dropped from the list)', async () => {
  assert.deepEqual([...(client.D1_BOOKMARK_READS ?? [])], [...service.REPLICA_ROUTES], 'the client\'s bookmark reads are the service\'s, route and method - the mint among them');

  // the sale, by the real client over the real Worker on a lagging replica (scenes/world.js insigniaBuy's own `held`)
  const S = await standService();
  const L = laggy(S.env.DB);
  S.env.DB = L.db;
  try {
    const who = await S.registered('Aldric');
    S.env.DB._raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, stones) VALUES (1, ?, 'x', 'x', 1, 40)").run(who.id);
    forgetD1Bookmark();
    const io = { fetch: (u, i) => S.fetch(u, i), base: BASE, secret: who.secret };
    assert.equal((await call(io, '/v1/heartbeat', { beat: true })).ok, true);
    assert.ok(d1BookmarkFor(who.secret), 'the heartbeat\'s bookmark kept');
    L.sync();
    const lost = { ...io, fetch: async (u, i) => { await S.fetch(u, i); throw new TypeError('Failed to fetch'); } };   // the sale lands, its answer does not
    const items = [Object.assign(sigilStone(), { stackCount: 30 })];
    const held = async (id) => { const a = await readAccount(io); const w = a.ok ? a.data?.wardrobe : null; return Array.isArray(w?.insignia) && w.insignia.includes(id) ? w : null; };
    const r = await insigniaSale(insigniaById('title:gatebreaker'), { items, buy: (id) => buyInsignia(lost, id), held, save: () => {} });
    const row = S.env.DB._raw.prepare('SELECT insignia, insignia_spent FROM players WHERE id = ?').get(who.id);
    assert.deepEqual({ ...row }, { insignia: 'title:gatebreaker', insignia_spent: 30 }, 'the service kept the sale');
    assert.equal(r.ok, true, `the page reads it as kept (${JSON.stringify(r)})`);
    assert.equal(items.reduce((n, it) => n + (it.stackCount ?? 1), 0), 0, 'and its stones stay spent - none handed back for a sale the service kept');
  } finally { L.close(); }

  // the law, call by call
  const SEC = 'secret-a2-0123456789abcd';
  const asked = [];
  const answer = (mark = null) => json({}, 200, mark ? { 'x-d1-bookmark': mark } : {});
  forgetD1Bookmark();
  noteD1Bookmark(SEC, MARK(5));
  await call({ fetch: async (u, i) => { asked.push([u, i.headers['x-d1-bookmark'] ?? null]); return answer(MARK(6)); }, secret: SEC }, '/v1/auth/token', {});
  assert.deepEqual(asked.at(-1)[1], MARK(5), 'the mint is a bookmark read: it carries the bookmark');
  assert.equal(d1BookmarkFor(SEC), MARK(6), 'and its answer\'s position is kept');
  let during = 'unasked';
  await call({ fetch: async (u, i) => { during = [i.headers['x-d1-bookmark'] ?? null, d1BookmarkFor(SEC)]; return answer(); }, secret: SEC }, '/v1/account/insignia', { item: 'x' });
  assert.deepEqual(during, [null, null], 'a write carries none, and the page holds none while it is on the wire');
  assert.equal(d1BookmarkFor(SEC), null);
  // a read on the wire when a write is sent: its answer may predate the write, and is not kept
  noteD1Bookmark(SEC, MARK(5));
  const slow = deferred();
  const reading = call({ fetch: () => slow.p, secret: SEC }, '/v1/heartbeat', { beat: true });
  await call({ fetch: async () => answer(), secret: SEC }, '/v1/renown/xp', { xp: 1 });
  slow.resolve(answer(MARK(9)));
  assert.equal((await reading).ok, true);
  assert.equal(d1BookmarkFor(SEC), null, 'a read sent before the write keeps nothing it is answered after it');
  // a read answered while a write is on the wire is let go once the write is answered
  const writing = deferred();
  const w = call({ fetch: () => writing.p, secret: SEC }, '/v1/renown/xp', { xp: 1 });
  await call({ fetch: async () => answer(MARK(9)), secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.equal(d1BookmarkFor(SEC), MARK(9), 'a read sent after the write was sent keeps its answer for now');
  writing.resolve(answer());
  await w;
  assert.equal(d1BookmarkFor(SEC), null, 'and lets it go when the write is answered - it may have been read before the write landed');
  // a read alone keeps its answer (the law above is the write's, not every read's)
  await call({ fetch: async () => answer(MARK(11)), secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.equal(d1BookmarkFor(SEC), MARK(11));

  // the doors that write outside `call`: the realm's (a join, a checkpoint) and the cloud saves'
  const doors = [
    ['realm join', (f) => realmJoin({ fetch: f, base: BASE, secret: SEC, storage: null }, 'rc0123456789abcdef'), true],
    ['realm list', (f) => realmList({ fetch: f, base: BASE, secret: SEC, storage: null }), false],
    ['cloud delete', (f) => removeCloudSlot({ fetch: f, base: BASE, secret: SEC, storage: null }, { characterId: 'c1', saveName: 'one' }), true],
    ['cloud list', (f) => cloudList({ fetch: f, base: BASE, secret: SEC, storage: null }), false],
  ];
  for (const [name, door, writes] of doors) {
    forgetD1Bookmark();
    noteD1Bookmark(SEC, MARK(20));
    let held = 'unasked';
    await door(async () => {
      held = d1BookmarkFor(SEC);
      await call({ fetch: async () => answer(MARK(21)), secret: SEC }, '/v1/heartbeat', { beat: true });   // a read answered meanwhile
      return json({ ok: true, id: 'x', lease: 'l', seq: 0, saves: [], characters: [] });
    });
    if (writes) {
      assert.equal(held, null, `${name}: forgotten before it is sent`);
      assert.equal(d1BookmarkFor(SEC), null, `${name}: and once it is answered`);
    } else {
      assert.equal(held, MARK(20), `${name}: a read keeps it`);
      assert.equal(d1BookmarkFor(SEC), MARK(21));
    }
  }
  forgetD1Bookmark();
});

test('AUDIT SCALE II A-6 C-7 a call that could not be made forgets the page\'s bookmark, and so does a bookmark read answered with none under the same secret - a service rolled back to acct111 (no bookmark said, its preflight refusing the header) is reached again at once, never only after a reload (mutants: `offline` keeps it; a 2xx with no body keeps it; a read answered with none keeps it; another session\'s let go)', async () => {
  const SEC = 'secret-a6-0123456789abcd';
  // acct111's preflight, as a browser holds a page to it: a header it does not allow fails the fetch before it leaves
  const ALLOWS = ['content-type', 'authorization', 'x-realm-lease', 'x-realm-seq', 'x-realm-summary'];
  const sent = [];
  const browser = async (url, init) => {
    const extra = Object.keys(init.headers).map((h) => h.toLowerCase()).filter((h) => h !== 'accept');
    sent.push(extra);
    if (extra.some((h) => !ALLOWS.includes(h))) throw new TypeError('Failed to fetch (CORS preflight)');
    return json({ beat: { ok: true } });   // acct111 says no bookmark
  };
  forgetD1Bookmark();
  noteD1Bookmark(SEC, '0000007f-0018eec1-00005100-e64ff3f326d6a57102822126be10d5fb');
  const first = await call({ fetch: browser, secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.deepEqual(first, { ok: false, error: 'offline' });
  assert.ok(sent[0].includes('x-d1-bookmark'));
  assert.equal(d1BookmarkFor(SEC), null, 'a call that could not be made lets the bookmark go');
  const second = await call({ fetch: browser, secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.equal(second.ok, true, 'the next call reaches the rolled-back service');
  assert.ok(!sent[1].includes('x-d1-bookmark'));

  // C-7: a bookmark read answered with no bookmark (acct111 says none, and its preflight would refuse the next)
  noteD1Bookmark(SEC, MARK(5));
  const quiet = async () => json({ ok: true });
  await call({ fetch: quiet, secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.equal(d1BookmarkFor(SEC), null, 'a read answered with none lets the page\'s go');
  // ...under the same secret only: another session's kept one is not this answer's to drop
  noteD1Bookmark('secret-other-0123456789', MARK(5));
  await call({ fetch: quiet, secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.equal(d1BookmarkFor('secret-other-0123456789'), MARK(5));
  // a malformed one is no bookmark and is never kept - and lets nothing go (SCALE4g's own law)
  noteD1Bookmark(SEC, MARK(5));
  await call({ fetch: async () => json({}, 200, { 'x-d1-bookmark': 'not a bookmark!' }), secret: SEC }, '/v1/heartbeat', {});
  assert.equal(d1BookmarkFor(SEC), MARK(5));
  // a 2xx whose body never came is `offline` too (MARKET-AUDIT P1's law): the bookmark goes with it
  const cut = await call({ fetch: async () => new Response('{"beat":', { status: 200, headers: { 'content-type': 'application/json', 'x-d1-bookmark': MARK(6) } }), secret: SEC }, '/v1/heartbeat', { beat: true });
  assert.equal(cut.error, 'offline');
  assert.equal(d1BookmarkFor(SEC), null, 'an answer that never arrived whole forgets it');
  forgetD1Bookmark();
});

test('AUDIT SCALE II A-3 a heartbeat\'s parts are the service\'s word on the body it read - a body past MAX_BODY_BYTES is never read whole by the metrics, a stranger\'s heartbeat says none, and a real one says the parts it asked (mutants: the body read off a copy before the service; the route\'s word dropped; the parts said before the session)', async () => {
  const S = await standService();
  const points = [];
  const env = { ...S.env, METRICS: { writeDataPoint: (p) => points.push(p) } };
  const CHUNK = 64 * 1024, TOTAL = 4 * 1024 * 1024;
  const stream = (counter) => new ReadableStream({
    pull(c) { if (counter.n >= TOTAL) { c.close(); return; } counter.n += CHUNK; c.enqueue(new Uint8Array(CHUNK).fill(32)); },
  }, { highWaterMark: 0 });
  // a body that announces nothing: read only as far as the service's own cap
  const chunked = { n: 0 };
  let res = await worker.fetch(new Request(`${BASE}/v1/heartbeat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream(chunked), duplex: 'half' }), env);
  assert.equal(res.status, 400);
  assert.ok(chunked.n <= MAX_BODY_BYTES + CHUNK, `pulled ${chunked.n} bytes of a ${TOTAL}-byte body - the cap is ${MAX_BODY_BYTES}`);
  assert.equal(points.at(-1).blobs[5], '');
  // one that announces its size past the cap: refused before a byte is read
  const announced = { n: 0 };
  res = await worker.fetch(new Request(`${BASE}/v1/heartbeat`, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(TOTAL) }, body: stream(announced), duplex: 'half' }), env);
  assert.equal(res.status, 400);
  assert.equal(announced.n, 0, 'not a byte of it pulled');
  // a stranger's heartbeat: no session, so no word on its parts
  res = await worker.fetch(new Request(`${BASE}/v1/heartbeat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beat: true, mail: true }) }), env);
  assert.equal(res.status, 401);
  assert.equal(points.at(-1).blobs[5], '', 'a refused heartbeat says no parts');
  // a real one: its parts, in the heartbeat's order
  const who = await S.registered('Aldric');
  res = await worker.fetch(new Request(`${BASE}/v1/heartbeat`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify({ mail: true, beat: true }) }), env);
  assert.equal(res.status, 200);
  assert.equal(points.at(-1).blobs[5], 'beat,mail');
});

test('AUDIT SCALE II A-5 the day\'s Motherlodes are picked on the primary - a pixel confirmed in the old day\'s last second, which a lagging replica has not heard, is among them all day; a day kept is read where the request reads, and a day the replica missed but the primary kept is read there without a second pick (mutants: the pick on the request\'s session; the pick answered off it; the primary\'s mark unasked)', async () => {
  const P = d1();
  const L = laggy(P);
  try {
    const raw = P._raw;
    for (let i = 1; i <= 6; i++) raw.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'g', 1, 1)").run(`a${i}`);
    const D = 20000, before = D * 86400, c = MOTHERLODE_CLIMATES[0];
    const say = (key, acct, at) => raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, 5, ?)").run(key, acct, `${c},5`, at);
    for (const a of ['a1', 'a2', 'a3']) say('10,10', a, before - 86400);
    for (const a of ['a4', 'a5']) say('20,20', a, before - 3600);
    const mark = d1Position(P);   // the tab's bookmark, off its last answer of the old day
    L.sync();
    say('20,20', 'a6', before - 1);   // the third witness, a second before midnight: confirmed before the day began
    const onPrimary = [];
    const primary = new Proxy(L.db, { get(t, k) { if (k === 'prepare') return (sql) => { onPrimary.push(sql); return t.prepare(sql); }; const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
    // the ctx index.js hands the route: the session of the tab's bookmark, and the binding beside it
    const ctxOf = () => ({ db: service.routeDb(L.db, '/v1/prof/motherlodes', 'POST', mark), primary, rand: Math.random });
    const lodes = await motherlodesOf(ctxOf(), D);
    const at = (list) => list.map((l) => `${l.x},${l.y}`).sort();
    assert.deepEqual(at(lodes), ['10,10', '20,20'], 'answered: both confirmed pixels');
    assert.deepEqual(at(raw.prepare('SELECT x, y FROM motherlodes WHERE day = ?').all(D)), ['10,10', '20,20'], 'kept for the day: both');
    assert.ok(onPrimary.some((q) => /FROM world_witness/.test(q)), 'the witnesses read on the primary');
    assert.ok(!L.log.at(-1).statements.some(([, q]) => /world_witness/.test(q)), 'never on the session');
    // the replica still lags (it has not heard the mark): the next read finds the day kept on the primary, and picks nothing
    onPrimary.length = 0;
    const again = await motherlodesOf(ctxOf(), D);
    assert.deepEqual(at(again), ['10,10', '20,20']);
    assert.ok(!onPrimary.some((q) => /world_witness/.test(q)), 'no second pick: the primary\'s mark asked first');
    // once the replica holds the mark, the day is read where the request reads
    L.sync();
    onPrimary.length = 0;
    assert.deepEqual(at(await motherlodesOf(ctxOf(), D)), ['10,10', '20,20']);
    assert.deepEqual(onPrimary, [], 'a kept day the session can read costs the primary nothing');
    assert.equal(L.log.at(-1).replica, true);
  } finally { L.close(); }
});

test('AUDIT SCALE II L4a a place in the sign-in line holds the next mint for the line\'s own wait - within the line\'s bounds, never shorter than told, never doubled and no failure in a row - and every other failure keeps STORM-SHED\'s law; the call answers the place and the wait (mutants: the queue read as a failure; counted as one; the wait unpassed; the bounds; the jitter\'s sign; the twin drifted)', async () => {
  assert.equal(client.MINT_LINE_WAIT_MIN_MS, admit.ADMIT_WAIT_MIN_MS, 'the line\'s bounds, the client\'s twin of the service\'s');
  assert.equal(client.MINT_LINE_WAIT_MAX_MS, admit.ADMIT_WAIT_MAX_MS);
  const hold = client.lineHoldMs;
  assert.equal(hold?.(10_000, () => 0), 10_000, 'never shorter than told');
  assert.equal(hold(10_000, () => 0.5), 10_500);
  assert.ok(hold(10_000, () => 0.999) <= 11_000);
  assert.equal(hold(120_000, () => 0.99), admit.ADMIT_WAIT_MAX_MS, 'never past the line\'s longest');
  assert.equal(hold(5, () => 0), admit.ADMIT_WAIT_MIN_MS, 'nor under its shortest');
  assert.equal(hold(undefined, () => 0), admit.ADMIT_WAIT_MIN_MS);

  // the real line (AdmitGate) in front of the real Worker: one address took the quiet line's one place
  const gate = new admit.AdmitGate(null, { ADMIT_RATE: '0.1', ADMIT_BURST: '1' });
  const S = await standService({ ADMIT: { idFromName: () => 'line', get: () => ({ fetch: (u, i) => gate.fetch(new Request(u, i)) }) } });
  const who = await S.registered('Aldric');
  let down = false;
  const tab = async (u, i) => (down ? json({ error: 'server' }, 500) : S.fetch(u, { ...i, headers: { ...i.headers, 'cf-connecting-ip': '10.9.9.9' } }));
  const q = await mintIdentity({ fetch: tab, secret: who.secret }, null);
  assert.deepEqual({ error: q.error, position: q.position, wait: q.wait, status: q.status }, { error: 'queue', position: 1, wait: 10_000, status: 503 }, 'the call answers the line\'s place and wait');
  let clock = 1_000_000;
  const minter = client.accountTokenMinter({ fetch: tab, storage: sessionStorageOf(SESSION_KEY, who), now: () => clock, rand: () => 0.5 });
  assert.equal(await minter('world:13,13'), null);
  assert.equal(minter.lastWhy, 'queue');
  assert.equal(minter.coolMs(), 10_500, 'held the line\'s own wait (STORM-SHED\'s first hold would be 2000)');
  clock += 10_500;
  assert.equal(await minter('world:13,13'), null);
  assert.equal(minter.coolMs(), 10_500, 'told again, held again the same - never doubled');
  clock += 10_500;
  assert.equal(await minter('world:13,13'), null);
  // every other failure keeps STORM-SHED's law - and the places in line were no failures in a row
  down = true;
  clock += 10_500;
  assert.equal(await minter('world:13,13'), null);
  assert.equal(minter.lastWhy, 'server');
  assert.equal(minter.coolMs(), client.MINT_COOL_MS, 'the first failure in a row: MINT_COOL_MS (jittered by a middling rand to itself)');
  clock += client.MINT_COOL_MS;
  assert.equal(await minter('world:13,13'), null);
  assert.equal(minter.coolMs(), client.MINT_COOL_MS * 2, 'the second: doubled');
});

test('AUDIT SCALE II L2 the load harness\'s account entry exports every Durable Object class wrangler.toml binds - `wrangler dev` refuses an entry that does not, and from ADMIT-LINE on the harness could not boot the service (mutants: the classes not passed through)', async () => {
  const toml = src('server-account/wrangler.toml');
  const bound = new Set([...toml.matchAll(/^class_name\s*=\s*"([^"]+)"/gm)].map((m) => m[1]));
  for (const m of toml.matchAll(/^new_(?:sqlite_)?classes\s*=\s*\[([^\]]*)\]/gm)) for (const c of m[1].matchAll(/"([^"]+)"/g)) bound.add(c[1]);
  assert.ok(bound.has('AdmitGate'), 'ADMIT-LINE\'s gate among them');
  const entry = await import('../../tools/loadAccountEntry.mjs');
  const svc = await import('../../server-account/src/index.js');
  for (const c of bound) {
    assert.equal(typeof entry[c], 'function', `${c} exported by the harness's entry`);
    assert.equal(entry[c], svc[c], `${c}: the service's own class`);
  }
});

test('AUDIT SCALE II L3 a bot stands in the sign-in line as a player does - told its place, it waits the told wait and asks again, a bounded number of times - and its setup comes through a line past the burst (mutants: asked once; the told wait unread; setUp past the line)', async () => {
  const QUEUE = { error: 'queue', position: 3, wait: 2500 };
  const asked = [], waited = [];
  let left = 2;
  const fake = async (url, init) => {
    asked.push([url, init.method]);
    return left-- > 0 ? json(QUEUE, 503) : json({ id: 'p1', secret: 's'.repeat(24), name: 'Guest' });
  };
  const made = await harness.guestThroughLine?.(fake, { wait: async (ms) => { waited.push(ms); } });
  assert.equal(made?.secret, 's'.repeat(24));
  assert.deepEqual(asked, Array(3).fill([`${harness.LOAD_SERVICE}/v1/auth/guest`, 'POST']));
  assert.equal(waited.length, 2);
  for (const ms of waited) assert.ok(ms >= QUEUE.wait && ms <= QUEUE.wait * 1.1, `waited ${ms} for a told ${QUEUE.wait}`);
  // a line that never lets it in: LINE_ASKS_MAX asks, then the line's word
  let n = 0;
  const never = async () => { if (++n > 2 * harness.LINE_ASKS_MAX) throw new Error('asked without bound'); return json(QUEUE, 503); };
  const last = await harness.guestThroughLine(never, { wait: async () => {} });
  assert.equal(last.error, 'queue');
  assert.equal(n, harness.LINE_ASKS_MAX);

  // setUp itself, through the real line in front of the real Worker: another address took the quiet line's one place
  Date.now = realNow;
  try {
    const gate = new admit.AdmitGate(null, { ADMIT_RATE: '5', ADMIT_BURST: '1' });
    const S = await standService({ ADMIT: { idFromName: () => 'line', get: () => ({ fetch: (u, i) => gate.fetch(new Request(u, i)) }) } });
    assert.equal(admit.admitAsk(gate.line, '10.0.0.1', Date.now(), gate.rate, gate.burst).go, true);
    const ip = '10.0.0.2';
    const bot = { n: 7, name: 'Load Bot 7', registered: false, fetch: (u, i) => S.fetch(`${BASE}${String(u).slice(harness.LOAD_SERVICE.length)}`, { ...i, headers: { ...(i?.headers ?? {}), 'cf-connecting-ip': ip } }) };
    assert.equal(admit.admitAsk(gate.line, ip, Date.now(), gate.rate, gate.burst).go, false, 'the bot\'s address stands in line');
    await harness.setUp(bot, harness.parseArgs([]));
    assert.ok(bot.account?.secret, 'a guest, once its place came up');
    assert.ok(bot.realm?.id, 'and the rest of its setup');
  } finally { Date.now = () => T0 * 1000; }
});

test('AUDIT SCALE II L5 a bot\'s three sessions share ONE reconnect wave and speak the second wire, as the world host\'s do (`--wire 1` the first); the tally opens a second-wire batch as the client does - each `poses` entry a pose aged by its stamp, each frame of a frame batch its own, a refusal and a welcome in one counted - and the fleets\' sums carry it (mutants: a wave a session; the first wire; entries uncounted; a batch\'s frames uncounted; batches unparsed; the sum dropped; the knob unchecked)', async () => {
  assert.equal(harness.parseArgs([]).wire, 2, 'the game\'s wire by default');
  assert.equal(harness.parseArgs(['--wire', '1']).wire, 1);
  assert.throws(() => harness.parseArgs(['--wire', '3']), /wire/);

  class Base extends EventTarget {
    constructor(url) { super(); this.url = url; this.sent = []; this.readyState = 0; }
    send(d) { this.sent.push(d); }
    close() {}
  }
  const tally = harness.relayTally();
  const ctx = { svc: { accountPort: 8870 }, relayUrl: 'ws://127.0.0.1:8871', account: { byRoute: new Map(), at: [] }, runTag: 'tst', WS: harness.localWebSocket({ port: 8871, tally, Base }), clock: () => 0, ownerOf: new WeakMap() };
  const minter = Object.assign(async () => null, { lastWhy: null, coolMs: () => 0, opened() {}, unopened() {} });
  const botOf = (n, o) => {
    const b = harness.makeBot(n, o, ctx);
    b.account = { id: `p${n}`, secret: 's'.repeat(24), name: `Load Bot ${n}` };
    b.minter = minter;
    harness.connect(b, ctx, o);
    return b;
  };
  const two = harness.parseArgs([]);
  const a = botOf(0, two), b = botOf(1, two), first = botOf(2, harness.parseArgs(['--wire', '1']));
  try {
    assert.equal(a.sessions.length, 3);
    assert.equal(new Set(a.sessions.map((s) => s._wave)).size, 1, 'one wave for the bot\'s three sessions - its page\'s');
    assert.notEqual(a.sessions[0]._wave, b.sessions[0]._wave, 'each bot its own page');
    for (const s of a.sessions) assert.equal(s._helloFrame().w2, 1, 'each hello offers the second wire');
    for (const s of first.sessions) assert.equal(s._helloFrame().w2, undefined, '--wire 1: the first');
  } finally { for (const x of [a, b, first]) for (const s of x.sessions) s.leave(); }

  // the tally, over the frames the relay mints (wire.js slimPose, wire2Batch)
  const t = harness.relayTally();
  let now = 5000;
  const welcomes = [];
  t.onWelcome = (ws, room) => welcomes.push(room);
  const WS = harness.localWebSocket({ port: 8871, tally: t, Base, now: () => now });
  const ws = new WS('ws://127.0.0.1:8871/room/world:13,13');
  const hear = (data) => ws.dispatchEvent(Object.assign(new Event('message'), { data }));
  const pose = (ts) => ({ x: 1.2, y: 0, z: 2.4, yaw: 0.5, pitch: 0, ...(ts != null ? { ts } : {}) });
  const stamped = JSON.stringify(['pa', slimPose(pose(4970))]);
  const bare = JSON.stringify(['pb', slimPose(pose(null))]);
  hear(wire2Batch([stamped, bare]));
  hear(wire2Batch([JSON.stringify({ t: 'welcome', you: 'x' }), stamped, JSON.stringify({ t: 'error', m: 'the room is busy' }), stamped, bare, JSON.stringify({ t: 'leave', id: 'pc' })]));
  hear('{"t":"pose","id":"pd","p":{"x":1,"ts":4990}}');   // the first wire, as it always was
  assert.deepEqual(t.inByType, { poses: 1, fb: 1, pose: 1 }, 'the frames on the wire');
  assert.equal(t.inFrames, 3);
  assert.deepEqual(t.saidByType, { pose: 6, welcome: 1, error: 1, leave: 1 }, 'what they carried');
  assert.deepEqual(t.poseMs, [30, 30, 30, 10], 'every stamped pose aged, batched or alone');
  assert.deepEqual(t.refusals, { 'the room is busy': 1 });
  assert.deepEqual(welcomes, ['world:13,13']);
  // the fleets' sums carry it
  const fin = (said) => ({ bots: 1, account: [], relay: { ...harness.relayTally(), saidByType: said, poseMs: [], poseSeen: 0 } });
  assert.deepEqual(harness.mergeFleets([fin({ pose: 2, leave: 1 }), fin({ pose: 3 })]).relay.saidByType, { pose: 5, leave: 1 });
});

test('AUDIT SCALE II N-1 N-2 N-3 the record\'s own words: SCALE4d\'s docblock on replicaDb, no comment naming a function SCALE4f folded into realmMintFacts, and the version pins\' history as it happened - HOME-VOTE was acct111 (mutants: the docblock gone; a dead name back; the history renamed again)', () => {
  assert.match(src('server-account/src/service.js'), /\/\*\* SCALE4d: the binding as one D1 session \(`withSession`\)[^]*?every statement of a session is the primary's anyway\. \*\/\nexport function replicaDb\(/, 'the docblock stands on replicaDb');
  const gone = /\b(realmLevelOf|realmArmsOf|realmHouseOf)\b/;
  for (const f of ['server-account/src/index.js', 'src/net/houseLaw.js', 'src/net/identityToken.js']) assert.doesNotMatch(src(f), gone, f);
  for (const f of readdirSync(new URL('../../server-account/src', import.meta.url))) assert.doesNotMatch(src(`server-account/src/${f}`), /function (realmLevelOf|realmArmsOf|realmHouseOf)\b/, `${f}: the functions are gone`);
  const told = readdirSync(new URL('..', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.test.js')).map((f) => [f, src(`test/${f}`)]).filter(([, s]) => s.includes('HOME-VOTE'));
  assert.ok(told.length >= 4);
  for (const [f, s] of told) assert.doesNotMatch(s, /acct112,? HOME-VOTE/, `${f}: HOME-VOTE was acct111`);
  // PIN MOVED: acct164, LEAN-READS - the history's newest line its (acct159, acct160, acct161, acct162 then acct163 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges). PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP - the history's newest line its (acct162 on its branch, renumbered past NAME-WORDS at the merge). PIN MOVED: acct162, NAME-WORDS - the history's newest line its (acct159 on its branch, renumbered past QL12, WB14 and JUNGLE-WOODS at the merge). PIN MOVED: acct161, JUNGLE-WOODS - the history's newest line its (acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges). PIN MOVED: acct160, WB14g - the history's newest line its. PIN MOVED: acct159, QL12 - the history's newest line its (acct157 on its branch, renumbered past PLAN-1000 and FOE-BOUNDS at the merge). PIN MOVED: acct158, FOE-BOUNDS. PIN MOVED: acct157, PLAN-1000 - the history's newest line its (acct155 on its branch, renumbered past GRANT2 and TOWN-ECON TE2 at the merge). PIN MOVED: acct155, TOWN-ECON TE2 - the history's newest line its. PIN MOVED: acct154, PRIVATE-REPORT - the history's newest line its (acct152 then acct153 on its branch, renumbered past SAFE and
  // INT16-INT19 at the merges). PIN MOVED: acct153, INT16-INT19 - the history's newest line its (acct151 then acct152 on its branch, renumbered past KEY-LAW and SAFE at the merges). PIN MOVED: acct152, SAFE - the history's newest line the chat safety arc's (acct150 on its branch, renumbered past
  // WIKIMAID and KEY-LAW at the merge). PIN MOVED: acct151, KEY-LAW - the history's newest line its (acct150 on its branch, renumbered past WIKIMAID, which wrote none, at the merge). PIN MOVED: acct149, EG-PLAY - the history's newest line main's (acct148, MAKER-KEPT): the arc's own entry stands on the version pins, never in the history line (acct119 to acct148 on its branch, renumbered at the merges). PIN MOVED: acct148, MAKER-KEPT - the history's newest line its. PIN MOVED: acct147, REZ-BLOODLINE AUDIT R1 - the history's newest line its (acct141 on its branch, acct142 at the first merge, renumbered past the SHED-LONG acct145 of main at the second). PIN MOVED: acct146, STOLEN-GOODS AUDIT - the history's newest line its, then. PIN MOVED: acct145, SHED-LONG - the history's newest line its. PIN MOVED: acct144, BUSY-HEART - the history's newest line its, then. PIN MOVED: acct143, BOOKMARK-SPIRAL - the history's newest line its, then. PIN MOVED: acct142, DECOR-BATCH - the history's newest line its, then. PIN MOVED: acct141, AUTO-HOLD - the history's newest line its, then (acct139 on its branch, renumbered past PRIMARY-TRIPS and AUDIT GUILD-WORDS at the merge). PIN MOVED: acct140, AUDIT GUILD-WORDS - the history's newest line its, then (acct139 on its branch, renumbered past PRIMARY-TRIPS at the merge). PIN MOVED: acct139, PRIMARY-TRIPS (the account primary round trips cut - the seats list, a checkpoint and a badge honours each one batch, the yards off a replica, a heartbeat reads before its beat, a hall bump off its own key rows; no migration); PIN MOVED: acct138, CART-AWAY - the history's newest line its. PIN MOVED: acct137, SERPENT5 - the history's newest line its, then. PIN MOVED: acct136, SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME - the history's newest line its (acct133 on each branch, one bump past LAMP-KEEPER II at the merge, acct134 on the integration, renumbered past KG6 acct134 and POI-1 acct135 at the merge of main). PIN MOVED: acct135, POI-1 + POI-4b + AUDIT POI - the history's newest line its (acct133, then acct134, on its branch, renumbered past LAMP-KEEPER II's and KG6's at the merges). PIN MOVED: acct134, KG6 - the history's newest line its (acct133 on its branch, renumbered past LAMP-KEEPER II's acct133 at the merge). PIN MOVED: acct133, LAMP-KEEPER II - the history's newest line its. PIN MOVED: acct132, REVIVE - the history's newest line its. PIN MOVED: acct131, RECOVERY-SET - the history's newest line its. PIN MOVED: acct130, SCHOOLS5 - the history's newest line its (acct127 on its branch, renumbered past HOMES-SHED, BUSY-GATE and CRAFT-PROCS at the merge). PIN MOVED: acct129, CRAFT-PROCS - the history's newest line its. PIN MOVED: acct128, BUSY-GATE - the history's newest line its. PIN MOVED: acct127, HOMES-SHED - the history's newest line its. PIN MOVED: acct126, MINE-PERKS - the history's newest line its. PIN MOVED: acct125, AUDIT ETHER-OW - the history's newest line its. PIN MOVED: acct124, ETHER-NODES - the history's newest line its. PIN MOVED: acct123, HACKED-GOLD - the history's newest line its (acct121 then acct122 on its branch, renumbered past BAL9 and NAME-AS at the merges). PIN MOVED: acct122, NAME-AS - the history's newest line its (acct121 on its branch, renumbered past BAL9 at the merge). PIN MOVED: acct121, BAL9 - the history's newest line its. PIN MOVED: acct120, D1-LOAD - the history's newest line its (acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED at the merge). PIN MOVED: acct119, SEAT-LEASE - the history's newest line its. PIN MOVED: acct117, YARD-SWEEP + HANDLE-EMAIL - the history's newest line theirs. PIN MOVED: acct116, CRAFT-HOLD - the history's newest line CRAFT-HOLD's (acct115 on its branch, renumbered past BR5 at the merge). PIN MOVED: acct115, BR5 - the history's newest line BR5's (acct113 on its branch, renumbered past GUILD-SEEN and GUILD3 at the merge). PIN MOVED: acct114, GUILD3 - the history's newest line GUILD3's (acct112 then acct113 on its branch, renumbered past SCALE4f-h and GUILD-SEEN at the merges)   // PIN MOVED: acct119, GATHER-SPEED + MARKET-SPEED (a harvest's, the professions' state's and a market read's reads batched into a few round trips; the seats' places off the isolate's kept rows for a Levy, a Tithe and a board's listings; no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge)
  // PIN MOVED: acct176, STAFF-PANEL-SPEED - the history's newest line its.
  // PIN MOVED: acct175, STAFF-PANEL5 - the history's newest line its (acct174 on its branch, renumbered past STAFF-PANEL2-6 at its merge). PIN MOVED: acct174, STAFF-PANEL2-6 - the history's newest line its (acct171 on its branch, then acct172, renumbered past AUDIT COLLECTIONS-II, SEA VENTURES and LOST-SPOILS at the merges). PIN MOVED: acct173, LOST-SPOILS - the history's newest line its.
  // PIN MOVED: acct172, SEA VENTURES - the history's newest line its (acct168 on its branch, then acct169, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET and AUDIT COLLECTIONS-II at the merges; one release: the Eltheric Ocean's ventures).
  // PIN MOVED: acct171, AUDIT COLLECTIONS-II - the history's newest line its (acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge). PIN MOVED: acct170, PISTOLET - the history's newest line its (acct168 on its branch, renumbered past STAFF-PANEL1 and CRAFT-PAYS at the merge). PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release - the history's newest line its (acct168 on its branch, renumbered past STAFF-PANEL1 at the merge). PIN MOVED: acct168, STAFF-PANEL1 - the history's newest line its. PIN MOVED: acct167, CAKE-CAP-SAID - the history's newest line its (acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge). PIN MOVED: acct166, ESSENCE-LOOSE and SOUL-LAW, one release - the history's newest line its. PIN MOVED: acct165, WITCH1 and STAR7, one release - the history's newest line its.
  assert.match(src('test/server/renown_char.test.js'), /'PIN MOVED: acct176, STAFF-PANEL-SPEED \([^)]*\); PIN MOVED: acct175, STAFF-PANEL5 \([^)]*\); PIN MOVED: acct174, STAFF-PANEL2-6 \([^)]*\); PIN MOVED: acct173, LOST-SPOILS \([^)]*\); PIN MOVED: acct172, SEA VENTURES \([^)]*\); PIN MOVED: acct171, AUDIT COLLECTIONS-II \([^)]*\); PIN MOVED: acct170, PISTOLET \([^)]*\); PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release \([^)]*\); PIN MOVED: acct168, STAFF-PANEL1 \([^)]*\); PIN MOVED: acct167, CAKE-CAP-SAID \([^)]*\); PIN MOVED: acct166, ESSENCE-LOOSE \([^)]*\) and SOUL-LAW \([^)]*\), one release; PIN MOVED: acct165, WITCH1 \([^)]*\) and STAR7 \([^)]*\), one release; PIN MOVED: acct164, LEAN-READS \([^)]*\); PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP \([^)]*\); PIN MOVED: acct162, NAME-WORDS \([^)]*\); PIN MOVED: acct161, JUNGLE-WOODS \([^)]*\); PIN MOVED: acct160, WB14g \([^)]*\); PIN MOVED: acct159, QL12 \([^)]*\); PIN MOVED: acct158, FOE-BOUNDS \([^)]*\); PIN MOVED: acct157, PLAN-1000 \([^)]*\); PIN MOVED: acct156, TOWN-ECON TE2 \([^)]*\); PIN MOVED: acct155, GRANT2 \([^)]*\); PIN MOVED: acct154, PRIVATE-REPORT \([^)]*\); PIN MOVED: acct153, INT16-INT19 \([^)]*\); PIN MOVED: acct152, SAFE \([^)]*\); PIN MOVED: acct151, KEY-LAW \([^)]*\); PIN MOVED: acct148, MAKER-KEPT \([^)]*\); PIN MOVED: acct147, REZ-BLOODLINE AUDIT R1 \([^)]*\); PIN MOVED: acct146, STOLEN-GOODS AUDIT \([^)]*\); PIN MOVED: acct145, SHED-LONG \([^)]*\); PIN MOVED: acct144, BUSY-HEART \([^)]*\); PIN MOVED: acct143, BOOKMARK-SPIRAL \([^)]*\); PIN MOVED: acct142, DECOR-BATCH \([^)]*\); PIN MOVED: acct141, AUTO-HOLD \([^)]*\); PIN MOVED: acct140, AUDIT GUILD-WORDS \([^)]*\); PIN MOVED: acct139, PRIMARY-TRIPS \([^)]*\); PIN MOVED: acct138, CART-AWAY \([^)]*\); PIN MOVED: acct137, SERPENT5 \([^)]*\); PIN MOVED: acct136, SUMMON-REPAIR \+ PVP-ESCROW \+ QUEST-HOME \([^)]*\); PIN MOVED: acct135, POI-1 \+ POI-4b \+ AUDIT POI \([^)]*\); PIN MOVED: acct134, KG6 \([^)]*\); PIN MOVED: acct133, LAMP-KEEPER II \([^)]*\); PIN MOVED: acct132, REVIVE \([^)]*\); PIN MOVED: acct131, RECOVERY-SET \([^)]*\); PIN MOVED: acct130, SCHOOLS5 \([^)]*\); PIN MOVED: acct129, CRAFT-PROCS \([^)]*\); PIN MOVED: acct128, BUSY-GATE \([^)]*\); PIN MOVED: acct127, HOMES-SHED \([^)]*\); PIN MOVED: acct126, MINE-PERKS \([^)]*\); PIN MOVED: acct125, AUDIT ETHER-OW \([^)]*\); PIN MOVED: acct124, ETHER-NODES \([^)]*\); PIN MOVED: acct123, HACKED-GOLD \([^)]*\); PIN MOVED: acct122, NAME-AS \([^)]*\); PIN MOVED: acct121, BAL9 \([^)]*\); PIN MOVED: acct120, D1-LOAD \([^)]*\); PIN MOVED: acct119, SEAT-LEASE \([^)]*\); PIN MOVED: acct117, YARD-SWEEP \+ HANDLE-EMAIL \([^)]*\); PIN MOVED: acct116, CRAFT-HOLD \([^)]*\); PIN MOVED: acct115, BR5 \([^)]*\); PIN MOVED: acct114, GUILD3 \([^)]*\); PIN MOVED: acct113, GUILD-SEEN \(the guild roster says when each member was last online\); PIN MOVED: acct112, SCALE4f \+ SCALE4g \+ SCALE4h \(acct111 on its branch, renumbered past HOME-VOTE at the merge\); PIN MOVED: acct111, HOME-VOTE/);   // PIN MOVED: acct119, GATHER-SPEED + MARKET-SPEED (a harvest's, the professions' state's and a market read's reads batched into a few round trips; the seats' places off the isolate's kept rows for a Levy, a Tithe and a board's listings; no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge)
});
