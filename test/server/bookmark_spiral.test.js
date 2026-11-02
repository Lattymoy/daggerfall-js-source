// BOOKMARK-SPIRAL (2026-10-16, the account database's primary "overloaded. Requests queued for too long." from 13:50 UTC,
// every route 5 to 60 s; bible/11-Multiplayer/Scale-Arc.md BOOKMARK-SPIRAL): six polled display reads, asked with no
// bookmark, had started their D1 session at any instance (server-account/src/service.js ANY_REPLICA_ROUTES, REPLICA_ANY).
// SHED-LONG (2026-10-16, acct145; Scale-Arc.md SHED-LONG) rolled that back - the replica's sessions waited 31 s on the
// database for every 5.6 s the primary's did, and the six had moved some 40 lookups a second onto it - so the set is
// empty and every replica route with no bookmark starts at the primary again. Kept: a session lookup that misses on a
// session at any instance asks the primary (accounts.js resolveSession), so a session minted a moment ago is never refused
// wherever such a session is opened. Each pin failed on the build before it. tools/mutants/bookmark_spiral.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { laggy } from '../laggyD1.mjs';
import { REPLICA_ROUTES, ANY_REPLICA_ROUTES, REPLICA_ANY, REPLICA_CONSTRAINT, PRIMARY_FIRST_ROUTES, DB_ANY, DB_ROOT, routeDb, replicaDb } from '../../server-account/src/service.js';
import { resolveSession } from '../../server-account/src/accounts.js';

const MARK = (n) => `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;
const send = (S, path, { method = 'POST', secret, body = {}, mark = null } = {}) => S.fetch(`https://accounts.invalid${path}`, {
  method, headers: { authorization: `Bearer ${secret}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...(mark ? { 'x-d1-bookmark': mark } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined,
});
const WHO = /FROM sessions s LEFT JOIN players p/;

/** The primary's own session lookups, counted - `P` accountDb's binding, before laggyD1 wraps it. */
function lookupsOn(P) {
  const n = { who: 0 };
  const prep = P.prepare.bind(P);
  P.prepare = (sql) => { if (WHO.test(sql)) n.who += 1; return prep(sql); };
  return n;
}

test('SHED-LONG: BOOKMARK-SPIRAL rolled back - no route starts at any instance; every replica route with no bookmark, and one D1 refuses, at the primary; with one, at it; the mint at the primary whatever it carries (mutants: a route back in the set; every one at any instance)', () => {
  assert.equal(REPLICA_ANY, 'first-unconstrained');
  assert.deepEqual([...ANY_REPLICA_ROUTES], [], 'none');
  const opened = [];
  const raw = { prepare: () => ({}), withSession(c) { if (c === 'refused') throw new Error('D1_ERROR: bad bookmark'); opened.push(c); return { prepare: () => ({}), getBookmark: () => null }; } };
  for (const [path, method] of REPLICA_ROUTES) {
    opened.length = 0;
    const s = routeDb(raw, path, method, null);
    assert.deepEqual(opened, [REPLICA_CONSTRAINT], `${path} with no bookmark: the primary first`);
    assert.equal(s[DB_ANY], false, `${path}: not a session at any instance`);
    assert.equal(s[DB_ROOT], raw, `${path}: the binding beneath it`);
    opened.length = 0;
    routeDb(raw, path, method, MARK(7));
    assert.deepEqual(opened, [PRIMARY_FIRST_ROUTES.has(path) ? REPLICA_CONSTRAINT : MARK(7)], `${path} with a bookmark`);
    opened.length = 0;
    routeDb(raw, path, method, 'refused');
    assert.deepEqual(opened, [REPLICA_CONSTRAINT], `${path} with a bookmark D1 refuses: as with none`);
  }
  assert.equal(replicaDb(raw, REPLICA_ANY)[DB_ANY], true, 'a session opened at any instance says so');
});

test('SHED-LONG: a heartbeat and a town read with no bookmark look their session up on the primary again (mutant: a route back in the set)', async () => {
  const S = await standService();
  const primary = lookupsOn(S.env.DB);
  const L = laggy(S.env.DB);
  S.env.DB = L.db;
  try {
    const who = await S.registered('Aldric');
    L.sync();
    primary.who = 0;
    for (const [path, body] of [['/v1/heartbeat', { board: 1 }], ['/v1/homes/town', { mapId: 1 }]]) {
      const r = await send(S, path, { secret: who.secret, body });
      assert.equal(r.status, 200, `${path}: ${await r.clone().text()}`);
      assert.equal(L.log.at(-1).constraint, REPLICA_CONSTRAINT, `${path}: the primary first`);
      assert.deepEqual(L.log.at(-1).statements.filter(([, q]) => WHO.test(q)).map(([on]) => on), ['primary'], `${path}: its lookup the primary's`);
    }
    assert.equal(primary.who, 2);
  } finally { L.close(); }
});

test('BOOKMARK-SPIRAL (kept): on a session at any instance, a session the replica holds is found there and the primary never asked; one minted after the replica\'s last catch-up is found on the primary, asked once; a secret nobody holds refused (mutants: no primary on a miss; the primary asked on every lookup; the miss asked of the replica again; the flag unread)', async () => {
  const S = await standService();
  const primary = lookupsOn(S.env.DB);
  const L = laggy(S.env.DB);
  S.env.DB = L.db;
  try {
    const old = await S.registered('Aldric');
    L.sync();
    const fresh = await S.guest();   // minted on the primary; the replica has not heard of it
    const ctx = () => ({ db: replicaDb(L.db, REPLICA_ANY), subtle: crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
    primary.who = 0;
    const a = await resolveSession(ctx(), old.secret);
    assert.equal(a?.player?.id, old.id, 'the replica holds it');
    assert.equal(L.log.at(-1).replica, true);
    assert.equal(primary.who, 0, 'the primary never asked');
    const b = await resolveSession(ctx(), fresh.secret);
    assert.equal(b?.player?.id, fresh.id, 'a session minted a moment ago: found');
    assert.equal(primary.who, 1, 'the primary asked once, for the one the replica had not heard of');
    assert.equal(await resolveSession(ctx(), 'not-a-session-anyone-holds-0001'), null, 'a secret nobody holds: refused');
    assert.equal(primary.who, 2);
  } finally { L.close(); }
});
