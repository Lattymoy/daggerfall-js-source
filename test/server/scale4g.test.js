// SCALE4g (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE4g): THE READS A TAB KEEPS ASKING, ON READ REPLICAS,
// WITH THE TAB'S OWN BOOKMARK. The heartbeat, the account view, the realm's list, the professions' state and the day's
// motherlodes run on a D1 session started from the bookmark the request carries (`x-d1-bookmark`) - every read at
// least as new as everything the tab saw and wrote - or at the primary when it carries none, and the answer carries the
// session's newest back. The arena's and Iliac Hand's #1, counted again and STORED where stale, stays on the binding
// wherever a session route asks it (AUDIT SCALE4d A1's law). The client keeps one bookmark per session secret, the
// newest, and sends it on every call. Over the real Worker on node:sqlite (test/accountDb.mjs: its sessions answer
// the database's position as their bookmark). tools/mutants/scale4g.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0, d1Position } from '../accountDb.mjs';
import { REPLICA_ROUTES, routeDb, d1BookmarkOf, D1_BOOKMARK_RE, DB_ROOT } from '../../server-account/src/service.js';
import { call, d1BookmarkFor, noteD1Bookmark, forgetD1Bookmark } from '../../src/net/accountClient.js';

const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

const MARK = (n) => `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;

test('SCALE4g the routes a replica may serve, by route AND method: the mint and the reads a tab keeps asking; each on a session started from the request\'s bookmark, or at the primary for none or one D1 will not take; every other route on the binding (mutants: a route\'s method unread; the bookmark unread; a refused bookmark thrown; a malformed bookmark taken)', () => {
  assert.deepEqual([...REPLICA_ROUTES], [['/v1/auth/token', 'POST'], ['/v1/heartbeat', 'POST'], ['/v1/account', 'GET'], ['/v1/realm', 'GET'], ['/v1/prof/state', 'POST'], ['/v1/prof/motherlodes', 'POST'],
    // PIN MOVED (DISPLAY-REPLICA, 2026-10-13): and the display reads and the arena's board (test/server/display_replica.test.js)
    ['/v1/homes/town', 'POST'], ['/v1/homes/mine', 'POST'], ['/v1/homes/rooms', 'POST'], ['/v1/homes/decor', 'POST'], ['/v1/prof/pixels', 'POST'],
    ['/v1/market/vendors', 'POST'], ['/v1/marks/balance', 'POST'], ['/v1/guilds/invites', 'POST'], ['/v1/realm/lineages', 'POST'], ['/v1/realm/unions', 'POST'],
    ['/v1/saves', 'GET'], ['/v1/arena/board', 'POST'],
    ['/v1/festival/town', 'POST']]);   // PIN MOVED (WITCH1): and a town's Hearth Offerings (test/server/display_replica.test.js)
  const opened = [];
  const raw = { prepare: () => ({}), withSession(c) { if (c === 'refused') throw new Error('D1_ERROR: bad bookmark'); opened.push(c); return { prepare: () => ({}), getBookmark: () => 'b' }; } };
  assert.equal(routeDb(raw, '/v1/renown/xp', 'POST', MARK(3)), raw, 'a write route: the binding');
  assert.equal(routeDb(raw, '/v1/account', 'POST', MARK(3)), raw, 'a listed route by another method: the binding');
  const s = routeDb(raw, '/v1/heartbeat', 'POST', MARK(3));
  assert.notEqual(s, raw);
  assert.equal(s[DB_ROOT], raw, 'the session names the binding beneath it');
  routeDb(raw, '/v1/account', 'GET', null);
  routeDb(raw, '/v1/realm', 'GET', 'refused');
  assert.deepEqual(opened, [MARK(3), 'first-primary', 'first-primary'], 'the bookmark; none: the primary; one D1 refuses: the primary');
  const req = (b) => new Request('https://accounts.invalid/v1/heartbeat', { method: 'POST', headers: b == null ? {} : { 'x-d1-bookmark': b } });
  assert.equal(d1BookmarkOf(req(MARK(9))), MARK(9));
  for (const bad of ['', '-leading', 'a b', 'x'.repeat(161), '<script>', 'mark;drop']) assert.equal(d1BookmarkOf(req(bad)), null, JSON.stringify(bad));
  assert.equal(d1BookmarkOf(req(null)), null);
  assert.ok(D1_BOOKMARK_RE.test('0000007f-0018eec1-00005100-e64ff3f326d6a57102822126be10d5fb'), 'D1\'s own, from #755\'s deploy log');
});

/** The binding with every statement prepared DIRECTLY on it recorded (a session's go to the fake beneath it). */
function direct(S) {
  const raw = S.env.DB;
  const asked = [];
  S.env.DB = new Proxy(raw, { get(t, k) { if (k === 'prepare') return (sql) => { asked.push(sql); return t.prepare(sql); }; const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
  return { raw, asked };
}
const send = (S, path, { method = 'POST', secret, body = {}, mark = null } = {}) => S.fetch(`https://accounts.invalid${path}`, {
  method, headers: { authorization: `Bearer ${secret}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...(mark ? { 'x-d1-bookmark': mark } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined,
});

test('SCALE4g a tab\'s reads ride the session of the bookmark it carries, and its answer carries the session\'s newest back, exposed to the page; a write route opens none and says none (mutants: no bookmark answered; the answer\'s header unexposed; the preflight refusing it)', async () => {
  const S = await standService();
  const who = await S.registered('Aldric');
  const { raw } = direct(S);
  raw._sessions.length = 0;
  const at = d1Position(raw);
  const hb = await send(S, '/v1/heartbeat', { secret: who.secret, body: { beat: true }, mark: at });
  assert.equal(hb.status, 200, await hb.clone().text());
  assert.equal(raw._sessions.length, 1);
  assert.equal(raw._sessions[0].constraint, at, 'the session starts from the tab\'s bookmark');
  const back = hb.headers.get('x-d1-bookmark');
  assert.ok(back && back > at, `the answer carries the newer position its beat wrote (${back} after ${at})`);
  assert.match(hb.headers.get('access-control-expose-headers') ?? '', /x-d1-bookmark/, 'exposed, so the page can read it');
  assert.equal((await hb.json()).beat?.ok ?? true, true);
  for (const [path, method] of [['/v1/account', 'GET'], ['/v1/realm', 'GET']]) {
    const r = await send(S, path, { method, secret: who.secret });
    assert.equal(r.status, 200, path);
    assert.equal(raw._sessions.at(-1).constraint, 'first-primary', `${path} with no bookmark: the primary first`);
    assert.ok(r.headers.get('x-d1-bookmark'), `${path}: its session's position`);
  }
  const n = raw._sessions.length;
  const w = await send(S, '/v1/account/played', { secret: who.secret, mark: at });
  assert.equal(w.status, 200);
  assert.equal(raw._sessions.length, n, 'a write route opens no session, whatever it carries');
  assert.equal(w.headers.get('x-d1-bookmark'), null, 'and says no bookmark');
  const pre = await S.fetch('https://accounts.invalid/v1/heartbeat', { method: 'OPTIONS' });
  assert.match(pre.headers.get('access-control-allow-headers'), /(^|, )x-d1-bookmark(,|$)/, 'the preflight lets a page send it');
});

test('SCALE4g the heartbeat\'s letterbox and board badge their authors with the arena\'s honours ON THE BINDING - a #1 found stale is counted again and stored, never off a replica (AUDIT SCALE4d A1\'s law) - and every other read on the session (mutants: the letterbox\'s honours on the session; the board\'s)', async () => {
  const S = await standService();
  const ann = await S.registered('Ann');
  const bob = await S.registered('Bob');
  assert.equal((await S.call('/v1/mail/send', { to: 'Bob', subject: 'A note', body: 'Meet me at the Rusty Relic.' }, ann.secret)).status, 200);
  const { raw, asked } = direct(S);
  raw._sessions.length = 0;
  const r = await send(S, '/v1/heartbeat', { secret: bob.secret, body: { mail: true }, mark: d1Position(raw) });
  assert.equal(r.status, 200);
  const box = (await r.json()).mail;
  assert.equal(box?.letters?.length, 1, JSON.stringify(box));
  const honours = /arena_pve|arena_champions|iliac_/;
  assert.ok(asked.some((q) => honours.test(q)), 'the honours on the binding');
  assert.deepEqual(raw._sessions[0].statements.filter((q) => honours.test(q)), [], 'none of them on the session');
  assert.ok(raw._sessions[0].statements.some((q) => /FROM letters/.test(q)), 'the box itself read on the session');
  const src = (await import('node:fs')).readFileSync(new URL('../../server-account/src/board.js', import.meta.url), 'utf8');
  assert.match(src, /withIliacHonoursAll\(\{ db: primary \}, await withArenaHonoursAll\(\{ db: primary \}, found, nowS\), nowS\)/, 'the board\'s honours on the binding as the box\'s are');
  assert.match(src, /export async function readBoard\(\{ db, nowS, primary = db \}/);
});

test('SCALE4g the client sends the newest bookmark its session has been answered, and only under that session - a sign-in, a new guest or another account starts with none; a malformed one is never kept (mutants: the bookmark sent under any secret; an older one kept over a newer; a malformed one kept; none sent)', async () => {
  forgetD1Bookmark();
  const seen = [];
  let answer = MARK(5);
  const fetch = async (url, init) => { seen.push(init.headers['x-d1-bookmark'] ?? null); return new Response('{}', { status: 200, headers: { 'content-type': 'application/json', ...(answer ? { 'x-d1-bookmark': answer } : {}) } }); };
  await call({ fetch, secret: 'secret-a' }, '/v1/heartbeat', {});
  assert.deepEqual(seen, [null], 'the first call carries none');
  assert.equal(d1BookmarkFor('secret-a'), MARK(5), 'and keeps its answer\'s');
  answer = MARK(3);
  await call({ fetch, secret: 'secret-a' }, '/v1/heartbeat', {});
  assert.equal(seen.at(-1), MARK(5), 'sent back');
  assert.equal(d1BookmarkFor('secret-a'), MARK(5), 'an older answer (one out of order) does not take its place');
  answer = MARK(12);
  await call({ fetch, secret: 'secret-a' }, '/v1/heartbeat', {});
  assert.equal(d1BookmarkFor('secret-a'), MARK(12), 'a newer one does');
  answer = 'not a bookmark!';
  await call({ fetch, secret: 'secret-a' }, '/v1/heartbeat', {});
  assert.equal(d1BookmarkFor('secret-a'), MARK(12), 'a malformed one is never kept');
  answer = MARK(1);
  await call({ fetch, secret: 'secret-b' }, '/v1/heartbeat', {});
  assert.equal(seen.at(-1), null, 'another session starts with none - its row may not have reached a replica yet');
  assert.equal(d1BookmarkFor('secret-a'), null, 'and the first session\'s is let go');
  assert.equal(d1BookmarkFor('secret-b'), MARK(1));
  noteD1Bookmark(null, MARK(99));
  assert.equal(d1BookmarkFor('secret-b'), MARK(1), 'nothing kept without a session');
  // PIN MOVED (AUDIT SCALE II A-2): asked before the call below, which is no bookmark read and forgets the page's
  // bookmark now (test/server/auditscale2_acct.test.js)
  await call({ fetch }, '/v1/health');
  assert.equal(seen.at(-1), null, 'no secret: no bookmark');
  forgetD1Bookmark();
});
