// STAFF-PANEL-SPEED (2026-10-23, mob: "slow when moving in menus", "The click takes a while before the new page shows
// (it's waiting on the server)", "it need to not hurt server performance") - THE TRIPS EVERY STAFF CLICK WAITS ON, core:
// staff.js's session (its lookup and its once-a-minute touch, one trip) and the routes staff.js answers itself - /v1/staff/me,
// /keys, /mods, /team and /audit - each a read and its audit row in one batch. Counted over the real Worker on
// test/accountDb.mjs with test/server/staffTrips.mjs; before this the touch was a trip of its own and every read page's
// audit row another (me 1-2, keys 2-3, mods, team and audit 3-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER, STAFF_IDLE_S, STAFF_TOUCH_S } from '../../server-account/src/staff.js';
import { countTrips } from './staffTrips.mjs';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

/** The Worker with mob an owner and Admin, signed in with the key the config names. */
async function stand() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  const s = await standService({ DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${pub}` });
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const ts = nowS();
  const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords('login', 'sirmcmobdon', ts)))));
  const login = await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: 'a good long one', pub, ts, sig });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { ...s, staff, token: login.body.session, raw: s.env.DB._raw };
}

test('STAFF-PANEL-SPEED core: the session and staff.js\'s own pages, each in the fewest trips - a stale session\'s touch rides the lookup, a read page\'s row its read (mutants: the touch its own trip; mods, team and audit their row a trip after)', async () => {
  const s = await stand();
  const stale = () => s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - STAFF_TOUCH_S - 5);
  /** [path, body, the most trips it may take] */
  const pages = [['/v1/staff/me', {}, 1], ['/v1/staff/me', { poll: true }, 1], ['/v1/staff/keys', {}, 2],
    ['/v1/staff/mods', {}, 2], ['/v1/staff/team', {}, 2], ['/v1/staff/audit', {}, 2], ['/v1/staff/audit', { act: 'login' }, 2]];
  for (const touch of [false, true]) {
    for (const [path, body, most] of pages) {
      if (touch) stale();
      const real = { prepare: s.env.DB.prepare, batch: s.env.DB.batch };
      const c = countTrips(s.env.DB);
      const r = await s.staff(path, body, s.token);
      const { trips } = c.take();
      Object.assign(s.env.DB, real);
      assert.equal(r.status, 200, `${path} ${JSON.stringify(body)}: ${JSON.stringify(r.body)}`);
      assert.ok(trips <= most, `${path} ${JSON.stringify(body)}${touch ? ', its session a minute stale' : ''}: ${trips} trips, ${most} at most`);
    }
  }
  // the read pages still wrote their rows, in the batch with their reads
  assert.deepEqual(['mods-read', 'team-read', 'audit-read'].map((a) => s.raw.prepare('SELECT COUNT(*) AS n FROM staff_audit WHERE act = ?').get(a).n), [1, 1, 2]);
});

test('STAFF-PANEL-SPEED core: the folded touch writes what the touch wrote - an act on a session a minute stale, never a fresher one, a poll, or one past its idle (mutants: the touch every act; the touch on a poll)', async () => {
  const s = await stand();
  const act = () => s.raw.prepare('SELECT last_act FROM staff_sessions').get()?.last_act;
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - STAFF_TOUCH_S + 20);
  const fresh = act();
  assert.equal((await s.staff('/v1/staff/me', {}, s.token)).status, 200);
  assert.equal(act(), fresh, 'inside a minute an act writes nothing');
  const idle = nowS() - 600;
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(idle);
  assert.equal((await s.staff('/v1/staff/me', { poll: true }, s.token)).status, 200);
  assert.equal(act(), idle, 'a poll writes nothing');
  const me = await s.staff('/v1/staff/me', {}, s.token);
  assert.equal(me.status, 200);
  assert.ok(act() >= nowS() - 1, 'a stale act writes now');
  assert.equal(me.body.idleAt, act() + STAFF_IDLE_S, 'and answers the idle it wrote');
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - STAFF_IDLE_S - 1);
  assert.equal((await s.staff('/v1/staff/me', {}, s.token)).status, 401, 'past its idle');
  assert.equal(act(), undefined, 'and gone, never touched alive');
});

test('STAFF-PANEL-SPEED core: the touch landing BEFORE the lookup answers the same - D1 runs two statements sent together in either order, and this database ran the lookup first every time, so its guard was never held (mutant: the touch\'s idle guard gone)', async () => {
  const s = await stand();
  const prepare = s.env.DB.prepare;
  s.env.DB.prepare = (/** @type {string} */ sql) => {
    const st = prepare.call(s.env.DB, sql);
    if (sql.includes('s.last_act AS s_act')) { const first = st.first.bind(st); st.first = async () => { await new Promise((r) => setImmediate(r)); return first(); }; }
    return st;
  };
  const act = () => s.raw.prepare('SELECT last_act FROM staff_sessions').get()?.last_act;
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - STAFF_TOUCH_S - 5);
  const me = await s.staff('/v1/staff/me', {}, s.token);
  assert.equal(me.status, 200);
  assert.ok(act() >= nowS() - 1, 'a stale act writes now');
  assert.equal(me.body.idleAt, act() + STAFF_IDLE_S, 'and answers the idle it wrote');
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - STAFF_IDLE_S - 1);
  assert.equal((await s.staff('/v1/staff/mods', {}, s.token)).status, 401, 'past its idle, never brought back by its own touch');
  assert.equal(act(), undefined, 'and gone');
});
