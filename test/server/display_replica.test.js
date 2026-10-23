// DISPLAY-REPLICA (2026-10-13, the account database's primary capped near 150 requests a second from 14:11 UTC - against
// 287 at 02:00 the same day - its own statements fast and every route waiting on it; bible/11-Multiplayer/Scale-Arc.md
// DISPLAY-REPLICA): the display reads and the arena's board run on a D1 session (server-account/src/service.js
// REPLICA_ROUTES, the client's D1_BOOKMARK_READS) - every statement a replica's with the bookmark the tab carries, and
// with none (a page from before this, or the read after a write, which the client forgets its bookmark for) the session's
// lookup the primary's and every read after it a replica's at least as new. The three reads an isolate keeps for every
// caller stay on the binding; a seat read asked from a request on a session opens its own off the binding. Each pin
// failed on the build before it. tools/mutants/display_replica.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, d1Position, T0 } from '../accountDb.mjs';
import { REPLICA_ROUTES, ANY_REPLICA_ROUTES, routeDb, replicaDb } from '../../server-account/src/service.js';
import { listSeats, strikeSeat, SEAT_ROWS_FROM } from '../../server-account/src/townSeats.js';
import { seatReportText } from '../../src/net/townSeatLaw.js';
import { call, forgetD1Bookmark, d1BookmarkFor } from '../../src/net/accountClient.js';

const DISPLAY_READS = [
  ['/v1/homes/town', 'POST', { mapId: 1 }], ['/v1/homes/mine', 'POST', {}], ['/v1/homes/rooms', 'POST', { mapId: 1, buildingKey: 1 }],
  ['/v1/homes/decor', 'POST', { mapId: 1, buildingKey: 1 }], ['/v1/prof/pixels', 'POST', { pixels: [[402, 151]] }],
  ['/v1/market/vendors', 'POST', { region: 17 }], ['/v1/marks/balance', 'POST', {}], ['/v1/guilds/invites', 'POST', {}],
  ['/v1/realm/lineages', 'POST', {}], ['/v1/realm/unions', 'POST', {}], ['/v1/saves', 'GET', null], ['/v1/arena/board', 'POST', {}],
  ['/v1/festival/town', 'POST', { mapId: 1 }],   // PIN MOVED (WITCH1): and a town's Hearth Offerings
];
const send = (S, path, { method = 'POST', secret, body = {}, mark = null } = {}) => S.fetch(`https://accounts.invalid${path}`, {
  method, headers: { authorization: `Bearer ${secret}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...(mark ? { 'x-d1-bookmark': mark } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined,
});

test('DISPLAY-REPLICA: the display reads and the arena\'s board are replica routes - each request on a session, from the bookmark it carries or the primary first with none, its answer carrying the session\'s newest back; the yards, the layouts and the seats\' list, which an isolate keeps for every caller, stay on the binding (mutants: the town dropped; the board dropped)', async () => {
  for (const [path, method] of DISPLAY_READS) assert.equal(REPLICA_ROUTES.get(path), method, `${path}: a replica's read`);
  const S = await standService({ SEATS_OPEN: 'on' });
  const who = await S.registered('Aldric');
  const raw = S.env.DB;
  for (const [path, method, body] of DISPLAY_READS) {
    const at = d1Position(raw);
    const r = await send(S, path, { method, secret: who.secret, body: body ?? {}, mark: at });
    assert.ok(r.status < 500, `${path}: answered (${r.status}) ${await r.clone().text()}`);
    assert.equal(raw._sessions.at(-1).constraint, at, `${path}: the session starts from the tab's bookmark`);
    assert.ok(raw._sessions.at(-1).statements.length > 0, `${path}: its statements the session's`);
    if (r.status === 200) assert.ok(r.headers.get('x-d1-bookmark'), `${path}: its session's position back`);
    await send(S, path, { method, secret: who.secret, body: body ?? {} });
    // PIN MOVED (BOOKMARK-SPIRAL, 2026-10-16; test/server/bookmark_spiral.test.js): the polled ones with none start at any instance
    assert.equal(raw._sessions.at(-1).constraint, ANY_REPLICA_ROUTES.get(path) === method ? 'first-unconstrained' : 'first-primary', `${path} with no bookmark: the primary first - the caller's own writes read - or, polled, any instance`);
  }
  const fake = { withSession: () => { throw new Error('opened'); } };
  for (const path of ['/v1/homes/yards', '/v1/homes/layouts', '/v1/seats/list']) {
    assert.equal(routeDb(fake, path, 'POST', d1Position(raw)), fake, `${path}: the binding - an isolate keeps its answer for every caller`);
  }
});

test('DISPLAY-REPLICA: a seat read asked from a request already on a session (a market\'s or a pixel\'s read asking a seat) opens its own off the binding - any instance\'s first, the primary\'s after a write here (mutant: the request\'s session read)', async () => {
  const ENV = { SEATS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra' };
  const svc = await standService(ENV);
  const base = svc.env.DB;
  const anticlere = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  for (const w of [await svc.guest(), await svc.guest(), await svc.guest()]) base._raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(anticlere.key), w.id, seatReportText(anticlere), anticlere.region, T0 - 86400);
  const request = replicaDb(base, d1Position(base));
  const player = { id: 'p-somebody', handle: 'Somebody', registered_at: T0 - 30 * 86400 };
  const seatSessions = () => base._sessions.filter((s) => s.statements.some((q) => /world_witness (?:INDEXED BY \w+ )?WHERE kind = 'seat'/.test(q))).map((s) => s.constraint);   // PIN MOVED (AUDIT LEAN-READS 2 A3): the judged read names its index
  const first = await listSeats({ db: request, nowS: T0 }, player, ENV);
  assert.deepEqual(first.seats.map((s) => s.key), [anticlere.key]);
  assert.deepEqual(seatSessions(), [SEAT_ROWS_FROM], 'its own session, off the binding - not the request\'s');
  assert.equal((await strikeSeat({ db: request, nowS: T0 + 1 }, { id: 'p-devra', handle: 'Devra', registered_at: T0 - 30 * 86400 }, ENV, { key: anticlere.key })).ok, true);
  await listSeats({ db: request, nowS: T0 + 2 }, player, ENV);
  assert.equal(seatSessions().at(-1), 'first-primary', 'the read after a write here: the primary\'s, whatever bookmark the request began from');
});

test('DISPLAY-REPLICA: the page carries its bookmark on a display read and keeps the one its answer says; a write forgets it, so the read after it starts at the primary (mutant: the client\'s town dropped)', async () => {
  forgetD1Bookmark();
  const secret = 'a-secret-long-enough-0001';
  const sent = [];
  let n = 0;
  const fetch = async (url, init) => {
    sent.push({ path: new URL(url).pathname, mark: init.headers['x-d1-bookmark'] ?? null });
    n += 1;
    const mark = `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;
    return { ok: true, status: 200, headers: { get: (h) => (h === 'x-d1-bookmark' ? mark : 'application/json') }, json: async () => ({}) };
  };
  await call({ fetch, secret }, '/v1/homes/town', { mapId: 1 });
  assert.ok(d1BookmarkFor(secret), 'a display read\'s answer: its position kept');
  await call({ fetch, secret }, '/v1/homes/town', { mapId: 1 });
  assert.match(sent[1].mark ?? '', /^00000001-/, 'the next display read carries it');
  await call({ fetch, secret }, '/v1/homes/claim', { mapId: 1 });
  await call({ fetch, secret }, '/v1/homes/town', { mapId: 1 });
  assert.equal(sent[3].mark, null, 'after a write: none - the primary first, which has the write');
  forgetD1Bookmark();
});
