// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow; the weak spot "Follow isn't
// audited and hears private talk") - THE FOLLOW TOKEN (server-account/src/staffFollow.js), driven through the real Worker
// on the node:sqlite database every account pin stands on (test/accountDb.mjs): an Admin's and a Moderator's follow
// token, what it signs and what it never does, the audit rows, and every refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER, STAFF_STATUS } from '../../server-account/src/staff.js';
import { FOLLOW_ROUTES, FOLLOW_AUDIT_S, SPECTATOR_NAME, FOLLOW_SUBJECT_PREFIX, staffFollow, followSubject, privateRoomOf } from '../../server-account/src/staffFollow.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { verifyToken, claimsValid, MAX_TTL_S, ID_RE } from '../../src/net/identityToken.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up (staffpanel2.test.js's stand): mob (an Admin and owner) and Asynian (a Moderator)
 *  signed in, and Troll, a player. */
async function stand() {
  _resetKeyForTests();
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`,
  });
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const troll = await s.registered('Troll');
  const raw = s.env.DB._raw;
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const key = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Asynian')) })).body;
  const idOf = (h) => raw.prepare('SELECT id FROM players WHERE handle = ?').get(h).id;
  const rows = (act) => raw.prepare('SELECT * FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  const claims = async (token) => {
    const v = await verifyToken(token, s.identityPublic, { subtle, nowS: nowS() });
    assert.ok(v.ok, v.why);
    return v.claims;
  };
  return { ...s, raw, staff, mob, asy, troll, idOf, rows, claims };
}

test('STAFF-PANEL5-FOLLOW: the follow door is listed among the staff panel\'s, and none opens without a staff session', async () => {
  for (const r of FOLLOW_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  assert.equal(STAFF_STATUS['no-signing-key'], 503);
  const s = await stand();
  const res = await s.staff('/v1/staff/follow', { sub: s.troll.id });
  assert.deepEqual([res.status, res.body], [401, { error: 'staff-session' }]);
  assert.equal((await s.staff('/v1/staff/follow', { sub: s.troll.id }, s.troll.secret)).status, 401, 'a game secret is no staff session');
  assert.equal(s.rows('follow').length, 0);
});

test('STAFF-PANEL5-FOLLOW: an Admin\'s follow token - hidden, naming its target, on a subject of its session\'s own and never the staff member\'s; written down once a minute', async () => {
  const s = await stand();
  const r = await s.staff('/v1/staff/follow', { sub: s.troll.id }, s.mob.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sub, s.troll.id);
  assert.equal(r.body.name, 'Troll');
  assert.ok(Math.abs(r.body.expiresAt - (nowS() + MAX_TTL_S)) <= 2);
  const c = await s.claims(r.body.token);
  assert.equal(c.hd, 1);
  assert.equal(c.fo, s.troll.id);
  assert.equal(c.n, SPECTATOR_NAME);
  assert.equal(c.k, 'guest');
  assert.ok(c.s.startsWith(FOLLOW_SUBJECT_PREFIX) && ID_RE.test(c.s), c.s);
  assert.notEqual(c.s, s.idOf('SirMcMobdon'), 'never the staff member\'s own account');
  assert.equal(c.g, undefined, 'no glyph, no title: the socket says nothing of who watches');
  assert.equal(c.t, undefined);
  // the same session's next token: the same subject, and still one audit row inside the minute
  const again = await s.staff('/v1/staff/follow', { sub: s.troll.id, room: 'world:12,40' }, s.mob.session);
  assert.equal(again.status, 200);
  assert.equal((await s.claims(again.body.token)).s, c.s);
  const rows = s.rows('follow');
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].actor, rows[0].role, rows[0].target, rows[0].outcome, JSON.parse(rows[0].detail)], [s.idOf('SirMcMobdon'), 'admin', s.troll.id, 'ok', { sub: c.s }], 'STAFF-PANEL5-HIDDEN-FIX: with the subject a home entered names');
  // a minute on (the log is append-only: the clock moves instead), another row
  const real = Date.now;
  Date.now = () => real() + (FOLLOW_AUDIT_S + 1) * 1000;
  try { assert.equal((await s.staff('/v1/staff/follow', { sub: s.troll.id }, s.mob.session)).status, 200); } finally { Date.now = real; }
  assert.equal(s.rows('follow').length, 2);
});

test('STAFF-PANEL5-FOLLOW: a Moderator follows any player too (mob, 07:04Z), on a subject of their own session', async () => {
  const s = await stand();
  const r = await s.staff('/v1/staff/follow', { sub: s.troll.id }, s.asy.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = await s.claims(r.body.token);
  assert.deepEqual([c.hd, c.fo], [1, s.troll.id]);
  const mob = await s.claims((await s.staff('/v1/staff/follow', { sub: s.troll.id }, s.mob.session)).body.token);
  assert.notEqual(c.s, mob.s, 'two sessions, two subjects');
  assert.deepEqual(s.rows('follow').map((x) => x.role).sort(), ['admin', 'moderator']);
});

test('STAFF-PANEL5-FOLLOW: entering someone\'s home is written down by its room, every home its own row', async () => {
  const s = await stand();
  const home = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:12.34567`;
  assert.ok(privateRoomOf(home));
  assert.ok(!privateRoomOf('interior:m12.34567'));
  assert.ok(privateRoomOf(`caravan:${'c'.repeat(24)}`), 'a caravan is a home');
  assert.equal((await s.staff('/v1/staff/follow', { sub: s.troll.id, room: home }, s.asy.session)).status, 200);
  assert.equal((await s.staff('/v1/staff/follow', { sub: s.troll.id, room: home }, s.asy.session)).status, 200);
  assert.equal((await s.staff('/v1/staff/follow', { sub: s.troll.id, room: `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:12.99999` }, s.asy.session)).status, 200);
  const rows = s.rows('follow-home');
  assert.deepEqual(rows.map((x) => JSON.parse(x.detail).room), [home, `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:12.99999`]);
  assert.ok(rows.every((x) => x.target === s.troll.id && x.outcome === 'ok'));
  assert.equal(s.rows('follow').length, 0, 'a home is never folded into the minute\'s row');
});

test('STAFF-PANEL5-FOLLOW: refusals - no account, a room out of its alphabet, oneself, nobody, and a service with no key', async () => {
  const s = await stand();
  const f = (body, token = s.mob.session) => s.staff('/v1/staff/follow', body, token);
  assert.deepEqual(await f({}), { status: 400, body: { error: 'body' } });
  assert.deepEqual(await f({ sub: 'x' }), { status: 400, body: { error: 'body' } });
  assert.deepEqual(await f({ sub: s.troll.id, room: 'bad room' }), { status: 400, body: { error: 'body' } });
  assert.deepEqual(await f({ sub: s.troll.id, room: 'x'.repeat(129) }), { status: 400, body: { error: 'body' } });
  assert.deepEqual(await f({ sub: s.troll.id, room: 7 }), { status: 400, body: { error: 'body' } });
  assert.deepEqual(await f({ sub: s.idOf('SirMcMobdon') }), { status: 409, body: { error: 'staff-self' } });
  assert.deepEqual(await f({ sub: 'nobodyAtAllHere' }), { status: 404, body: { error: 'no-player' } });
  assert.equal(s.rows('follow').length, 0, 'nothing minted, nothing written');
  // no signing key: refused, and the failed mint written down
  _resetKeyForTests();
  const pk = s.env.IDENTITY_PRIVATE_KEY;
  s.env.IDENTITY_PRIVATE_KEY = '';
  try {
    assert.deepEqual(await f({ sub: s.troll.id }), { status: 503, body: { error: 'no-signing-key' } });
  } finally { s.env.IDENTITY_PRIVATE_KEY = pk; _resetKeyForTests(); }
  const failed = s.rows('follow');
  assert.deepEqual(failed.map((x) => x.outcome), ['failed']);
});

test('STAFF-PANEL5-FOLLOW: only an Admin or a Moderator mints - any other role is refused and the refusal written down', async () => {
  const written = [];
  const audit = (act, target, detail, how = {}) => ({ run: async () => { written.push({ act, target, detail, ...how }); } });
  const ctx = { db: { prepare: () => assert.fail('no read before the role') }, subtle, nowS: nowS() };
  const r = await staffFollow(ctx, {}, '/v1/staff/follow', { sub: 'abcdefgh' }, { player: { id: 'me000000' }, role: 'helper', hash: 'h' }, audit);
  assert.deepEqual(r, { error: 'staff-admin' });
  assert.deepEqual(written, [{ act: 'refused', target: null, detail: { path: '/v1/staff/follow', need: 'moderator' }, outcome: 'denied' }]);
  assert.deepEqual(await staffFollow(ctx, {}, '/v1/staff/other', {}, { player: { id: 'me000000' }, role: 'admin', hash: 'h' }, audit), { error: 'body' });
});

test('STAFF-PANEL5-FOLLOW: a hidden subject is an id every end takes, never a player\'s length, and its session\'s own', async () => {
  const a = await followSubject('aaaa', subtle), b = await followSubject('bbbb', subtle);
  assert.ok(ID_RE.test(a) && a.startsWith(FOLLOW_SUBJECT_PREFIX));
  assert.equal(a.length, 27, 'a player id is 24 (accounts.js mintId)');
  assert.notEqual(a, b);
  assert.equal(a, await followSubject('aaaa', subtle));
  assert.ok(claimsValid({ s: a, n: SPECTATOR_NAME, k: 'guest', i: 1, e: 2, hd: 1, fo: 'abcdefgh' }));
});
