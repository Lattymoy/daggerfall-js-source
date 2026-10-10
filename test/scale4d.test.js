// SCALE4d (2026-10-10, Mac: "we just hit 500 online people. I think its time to scale up our server and improve
// performance for more people"; bible/11-Multiplayer/Scale-Arc.md SCALE4d): THE TOKEN'S READS OFF THE ONE PRIMARY. A
// relay deploy asks every player's token in the same minute, and a mint is a dozen reads - the wave that overloaded the
// account database twice on 2026-10-06 (STORM-SHED). The mint now runs on ONE D1 session (server-account/src/service.js
// replicaDb, REPLICA_ROUTES): its first statement, the session lookup, the primary's; every read after it a read
// replica's that is at least as new (the Sessions API's sequential consistency) - so it reads exactly what the primary
// held when it began. Every other route stays on the binding. The service's half over the real Worker on node:sqlite
// (test/accountDb.mjs's fake opens a session over the same database, a database whose replication is off).
// tools/mutants/scale4d.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { REPLICA_ROUTES, REPLICA_CONSTRAINT, replicaDb, DB_ROOT } from '../server-account/src/service.js';
import { countedDb } from '../server-account/src/metrics.js';
import { verifyToken } from '../src/net/identityToken.js';

const { subtle } = globalThis.crypto;
const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

/** The fake's binding, every statement prepared on it DIRECTLY recorded - a session's own go to the fake beneath and
 *  are recorded by the session (`_sessions`), never here. */
function direct(raw) {
  const asked = [];
  const db = new Proxy(raw, {
    get(target, key) {
      if (key === 'prepare') return (sql) => { asked.push(sql); return target.prepare(sql); };
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return { db, asked };
}

/** A registered player with a realm character in a guild-less, seat-less world - the mint's dearest ordinary path. */
async function stood(extra = {}) {
  const S = await standService(extra);
  const who = await S.registered('Aldric');
  const R = await seatRealm(S.env, who.secret, 'Aldric', { name: 'Aldric', level: 9, goldPieces: 100, items: [] });
  return { S, who, R };
}

test('SCALE4d the mint runs on ONE D1 session opened first-primary - its first statement the session lookup, every statement of the request through it and none on the binding (mutants: the route set emptied; the route left on the binding; the constraint first-unconstrained)', async () => {
  assert.deepEqual([...REPLICA_ROUTES], ['/v1/auth/token'], 'the token alone');
  assert.equal(REPLICA_CONSTRAINT, 'first-primary');
  const { S, who, R } = await stood();
  const raw = S.env.DB;
  const { db, asked } = direct(raw);
  S.env.DB = db;
  raw._sessions.length = 0;
  const r = await S.call('/v1/auth/token', { character: R.id, guild: true }, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(raw._sessions.length, 1, 'one session a mint');
  const [s] = raw._sessions;
  assert.equal(s.constraint, 'first-primary', 'its first statement the primary\'s');
  assert.match(s.statements[0], /FROM sessions s LEFT JOIN players p/, 'and that first statement is the session lookup');
  assert.ok(s.statements.length >= 8, `a realm character's mint - the session, its arena, Renown, guild, three realm rows, rating and house - rides it (${s.statements.length})`);
  assert.deepEqual(asked, [], 'nothing of the mint on the binding');
});

test('SCALE4d every other route stays on the binding - no session opened (mutant: every route on a session)', async () => {
  const { S, who, R } = await stood();
  const raw = S.env.DB;
  raw._sessions.length = 0;
  for (const [path, body] of [['/v1/account/played', {}], ['/v1/heartbeat', { parts: { box: {} } }], ['/v1/realm/list', {}], ['/v1/renown/state', { character: R.id }]]) {
    const r = await S.call(path, body, who.secret);
    assert.ok(r.status < 500, `${path} answered (${r.status})`);
  }
  assert.equal(raw._sessions.length, 0, 'no session for any of them');
});

test('SCALE4d the claims a session mints are the claims the binding mints - byte for byte, the same token (mutant: none; the oracle is the binding)', async () => {
  const { S, who, R } = await stood();
  const viaSession = await S.call('/v1/auth/token', { character: R.id, guild: true }, who.secret);
  const keep = S.env.DB.withSession;
  S.env.DB.withSession = undefined;   // a binding with no sessions - the mint on the binding itself, as before this slice
  try {
    const viaBinding = await S.call('/v1/auth/token', { character: R.id, guild: true }, who.secret);
    assert.equal(viaBinding.status, 200);
    assert.deepEqual(viaSession.body, viaBinding.body, 'the same answer, the token included');
    const v = await verifyToken(viaSession.body.token, S.identityPublic, { subtle, nowS: T0 });
    assert.ok(v.ok && v.claims.rc === 1, 'a realm character\'s token, verified');
  } finally { S.env.DB.withSession = keep; }
});

test('SCALE4d a mint on a session is still a mint\'s statements on its metrics point (mutant: the session opened past the counter)', async () => {
  const points = [];
  const { S, who, R } = await stood({ METRICS: { writeDataPoint: (p) => points.push(p) } });
  const raw = S.env.DB;
  raw._sessions.length = 0;
  points.length = 0;
  assert.equal((await S.call('/v1/auth/token', { character: R.id, guild: true }, who.secret)).status, 200);
  const p = points.find((x) => x.indexes[0] === '/v1/auth/token');
  assert.ok(p, 'the mint wrote its point');
  assert.equal(p.doubles[2], raw._sessions[0].statements.length, 'every statement the session ran, counted');
  assert.ok(p.doubles[2] >= 8, `a realm character's mint (${p.doubles[2]})`);
});

test('SCALE4d the session answers DB_ROOT with the binding it came from, through the counter too - what an isolate keeps beside its database stays one store; a binding with no sessions is answered as it stands (mutants: DB_ROOT the session; the fallback dropped)', () => {
  const opened = [];
  const raw = { prepare: () => ({}), withSession(c) { opened.push(c); return { prepare: () => ({}), batch: async () => [] }; } };
  assert.equal(replicaDb(raw)[DB_ROOT], raw, 'the binding, not the session');
  const tally = { n: 0 };
  const counted = countedDb(raw, tally);
  const s = replicaDb(counted);
  assert.equal(s[DB_ROOT], raw, 'through the counter: the binding beneath it');
  s.prepare('SELECT 1'); s.prepare('SELECT 2');
  assert.equal(tally.n, 2, 'a session\'s statements counted where the binding\'s are');
  assert.deepEqual(opened, ['first-primary', 'first-primary']);
  const old = { prepare: () => ({}) };
  assert.equal(replicaDb(old), old, 'no sessions: the binding itself');
  assert.equal(replicaDb(null), null);
});
