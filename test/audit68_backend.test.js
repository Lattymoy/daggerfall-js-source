// AUDIT 68 (2026-09-24), cluster "backend": the relay (server/src) and the account service (server-account/src).
// Mac: "a deep comprehensive audit across the entirety of the codebase ... No band aids." Every pin here fails on the
// base (ad238de0) and names its finding. The relay is driven over test/fakeRoom.mjs with real signed tokens; the
// account service over node:sqlite with its real migrations, through its own functions and its own worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  SOCIAL_ROOM, PARTY_OFFLINE_MS, ACCOUNT_IDLE_MS, DROP_STRIKES_MAX, PARK_TTL_MS, PIXEL_UNITS, parkRegistryRoom, parkKeyOf,
} from '../src/net/wire.js';
import { fakeRoom, fakeRooms } from './fakeRoom.mjs';
import worker from '../server-account/src/index.js';
import { createGuest, resolveSession, register, recover, changePassword, LOGIN_MAX } from '../server-account/src/accounts.js';
import { putCard } from '../server-account/src/saves.js';
import { SAVES_MAX, SHOT_MAX_BYTES } from '../server-account/src/service.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.info = info; console.warn = warn; } };
/** Date.now held at `clock.t` for the body; `clock.t += ms` moves it. */
async function frozen(fn, t = 1e12) {
  const realNow = Date.now; const clock = { t }; Date.now = () => clock.t;
  try { return await fn(clock); } finally { Date.now = realNow; }
}

// ------------------------------------------------------------ THE RELAY ------------------------------------------------------------

test('AUDIT 68 S01-hello-writes-before-token: a hello the relay refuses writes NOTHING - no secret, no look, in a place and in the hub - so a tokenless squatter cannot refuse the real player "id taken" (X8-hello-writes-before-verify)', async () => {
  for (const key of ['world:3,12', 'chat:world']) {
    const r = fakeRoom(key);
    const anchor = r.connect(), victim = r.connect();
    await r.hello(anchor, 'anchor01'); await r.hello(victim, 'victim01');
    await r.drop(victim);
    assert.equal(r.store.has('secret:victim01'), false, `${key}: the victim's leave took its secret`);
    const att = r.connect();
    await r.hello(att, 'victim01', null, { tok: null, secret: 'attackersecret1' });
    assert.equal(att.sent.at(-1).m, 'sign in to play online', `${key}: refused`);
    assert.equal(r.store.has('secret:victim01'), false, `${key}: and it planted no secret`);
    assert.equal(r.store.has('look:victim01'), false, `${key}: nor a look`);
    assert.equal(r.room._looks.has('victim01'), false, `${key}: nor a look in memory`);
    const back = r.connect();
    await r.hello(back, 'victim01');
    assert.equal(back.sent[0].t, 'welcome', `${key}: the real player is welcomed back`);
  }
});

test('AUDIT 68 S01-hello-writes-before-token: a reconnect whose token does not verify does not replace the LIVE holder of the id - it closed the holder, then was refused, and the room kept a ghost', async () => {
  const r = fakeRoom('world:3,12');
  const holder = r.connect(), other = r.connect();
  await r.hello(holder, 'holder01'); await r.hello(other, 'other002');
  other.sent.length = 0;
  const liar = r.connect();
  await r.hello(liar, 'holder01', null, { tok: 'v1.aaaa.bbbb' });
  assert.equal(liar.sent.at(-1).t, 'error', 'refused');
  assert.equal(holder.closed, null, 'the holder stands');
  assert.equal(other.sent.filter((m) => m.t === 'leave').length, 0, 'and nobody left');
});

test('AUDIT 68 S01-hello-writes-before-token: a flood of tokenless hellos at the hub leaves no secret behind - the hub never drains, so each was permanent', async () => {
  await frozen(async () => {
    const r = fakeRoom('chat:world');
    const keeper = r.connect();
    await r.hello(keeper, 'keeper01');
    for (let i = 0; i < 20; i++) await r.hello(r.connect(), `flood${String(i).padStart(3, '0')}`, null, { tok: null });
    assert.deepEqual([...r.store.keys()].filter((k) => k.startsWith('secret:')), ['secret:keeper01']);
  });
});

test('AUDIT 68 S01-stale-party-pointer-blocks-sweep: an idle account whose party is GONE is swept - the pointer nothing clears but its own next hello kept it for ever; an idle account a living party still seats is kept', () => quiet(() => frozen(async (clock) => {
  const r = fakeRoom(SOCIAL_ROOM);
  const tick = (ms = 600) => { clock.t += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); tick(10); return ws; };
  const a = await join('a'), b = await join('b'), c = await join('c');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick();
  await act(b, { k: 'party.accept', party: a.att.party }); tick();
  const pid = a.att.party;
  assert.ok(pid && r.store.get('party:' + pid).members.includes('acct-b'), 'a party of two');
  // a control: an idle account a LIVING party seats (c is online in it)
  r.store.set('party:q-live', { id: 'q-live', leader: 'acct-c', members: ['acct-c', 'acct-l1'], invites: [], away: { 'acct-l1': clock.t }, at: clock.t });
  r.store.set('acct:acct-l1', { name: 'l1', seen: clock.t, friends: [], in: [], out: [], invites: [], party: 'q-live' });
  r.store.set('asecret:acct-l1', 's'.repeat(8));
  await r.drop(a); await r.drop(b); tick();
  tick(PARTY_OFFLINE_MS + 1000);
  r.wake(); await r.fire();
  assert.equal(r.store.has('party:' + pid), false, 'every seat lapsed: the party is gone');
  assert.equal(r.store.get('acct:acct-a').party, pid, 'and the members\' records still point at it');
  tick(ACCOUNT_IDLE_MS + 1000);
  r.store.set('party:q-live', { ...r.store.get('party:q-live'), away: {} });   // the control's seat held all the while
  r.store.set('sweep:acct', null); r.store.set('sweep:party', null);
  r.wake(); await r.fire();
  for (const k of ['acct:acct-a', 'asecret:acct-a', 'acct:acct-b', 'asecret:acct-b']) assert.equal(r.store.has(k), false, `${k} swept`);
  assert.ok(r.store.has('acct:acct-l1') && r.store.has('asecret:acct-l1'), 'a seat in a living party keeps its account');
  assert.equal(c.closed, null);
})));

test('AUDIT 68 X8-park-registry-unbounded: an owner\'s registry is armed to forget its word PARK_TTL_MS after it was said, and forgets it when that comes - one object per account and character a client names was kept for ever', async () => {
  const w = fakeRooms();
  const X = 'world:6,9';
  const r = w.room(X);
  const ann = r.connect(); await r.hello(ann, 'ann1');
  const before = Date.now();
  await r.room.webSocketMessage(ann, JSON.stringify({ t: 'park', data: { c: 'char-ann-0001' } }));   // nothing parked: still a word the registry keeps
  const reg = w.made.get(parkRegistryRoom(await parkKeyOf('acct-ann1', 'char-ann-0001')));
  const word = reg.store.get('reg');
  assert.ok(word && word.at >= before, 'the registry holds the word');
  assert.equal(reg.alarm.at, word.at + PARK_TTL_MS, 'and its alarm is armed at the word\'s end');
  reg.store.set('reg', { cell: null, at: Date.now() - PARK_TTL_MS + 60_000 });
  await reg.fire();
  assert.ok(reg.store.has('reg'), 'a word still inside its life is kept');
  assert.ok(reg.alarm.at > Date.now(), 'and the alarm re-armed for its end');
  reg.store.set('reg', { cell: null, at: Date.now() - PARK_TTL_MS - 1 });
  await reg.fire();
  assert.equal(reg.store.has('reg'), false, 'a word past its life is forgotten');
});

test('AUDIT 68 X8-hit-byte-budget-room-wide-starves-grants: one socket\'s junk blows spend ITS OWN hit bytes - an honest grant, whose items already left the corpse, still lands', () => frozen(async () => {
  const at = { x: PIXEL_UNITS + 10, y: 0, z: PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 };
  const r = fakeRoom('world:3,12');
  const owner = r.connect(), taker = r.connect(), evil = r.connect(), byst = r.connect();
  await r.hello(owner, 'ownr-0001', at); await r.hello(taker, 'takr-0002', at); await r.hello(evil, 'evil-0003', at); await r.hello(byst, 'byst-0004', at);
  const junk = JSON.stringify({ t: 'hit', data: { to: 'byst-0004', pad: 'z'.repeat(16000) } });
  for (let i = 0; i < 16; i++) await r.raw(evil, junk);
  assert.equal(byst.sent.filter((m) => m.t === 'hit').length, 16, 'the flood landed where it was aimed');
  const grant = JSON.stringify({ t: 'hit', data: { to: 'takr-0002', k: 'world:3,12', i: 1, grant: Array.from({ length: 40 }, () => ({ templateIndex: 7, name: 'x'.repeat(120), notes: 'y'.repeat(120) })), n: 1 } });
  await r.raw(owner, grant);
  assert.equal(taker.sent.filter((m) => m.t === 'hit').length, 1, 'the honest grant lands');
  await r.raw(evil, junk);
  assert.equal(byst.sent.filter((m) => m.t === 'hit').length, 16, 'the flooder starved only itself');
  assert.equal(evil.closed, null, 'and nobody was struck for it');
}));

test('AUDIT 68 X8-v-say-mute-unstruck: a flood of `say` (a stranger\'s or a developer\'s) and of `mute` is struck out like every other arm\'s; one stranger\'s say is still ignored in silence and a developer\'s first line still heard', () => frozen(async () => {
  const r = fakeRoom('chat:world');
  const a = r.connect(), b = r.connect(), dev = r.connect(), ear = r.connect();
  await r.hello(a, 'peer-0001'); await r.hello(b, 'peer-0002'); await r.hello(dev, 'peer-0003', null, { glyphs: ['dev'] }); await r.hello(ear, 'peer-0004');
  await r.raw(a, JSON.stringify({ t: 'say', text: 'FREE GOLD' }));
  assert.equal(a.closed, null, 'one stranger\'s say: ignored, not closed');
  for (let i = 0; i < DROP_STRIKES_MAX + 5 && !a.closed; i++) await r.raw(a, JSON.stringify({ t: 'say', text: 'FREE GOLD' }));
  assert.equal(a.closed?.reason, 'too many lines', 'a stranger\'s flood');
  for (let i = 0; i < DROP_STRIKES_MAX + 5 && !b.closed; i++) await r.raw(b, JSON.stringify({ t: 'mute', order: 'v1.aaaa.bbbb' }));
  assert.equal(b.closed?.reason, 'too many mute orders', 'a flood of orders');
  for (let i = 0; i < DROP_STRIKES_MAX + 5 && !dev.closed; i++) await r.raw(dev, JSON.stringify({ t: 'say', text: `line ${i}` }));
  assert.equal(dev.closed?.reason, 'too many lines', 'even a developer\'s');
  assert.deepEqual(ear.sent.filter((m) => m.t === 'red').map((m) => m.text), ['line 0'], 'whose first line was heard');
}));

// ------------------------------------------------------------ THE ACCOUNT SERVICE ------------------------------------------------------------

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** accountworker.test.js' D1-shaped face over node:sqlite and the real migrations - D1's surface and nothing more. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}
const NOW = 1_758_400_000;
const ctxOf = (db) => ({ db, subtle: globalThis.crypto.subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: NOW });
const CARD = { characterName: 'Nystul', gameTime: 123456, realTime: 1_758_400_000_000, dfuVersion: 'b123', saveVersion: 3 };

test('AUDIT 68 S01-register-recover-lost-update: one guest registered from two devices at once - ONE wins, the other hears already-registered, and the winner\'s recovery code is the one that works', async () => {
  const ctx = ctxOf(d1());
  const g = await createGuest(ctx, {});
  const both = await Promise.all([
    register(ctx, g.id, { handle: 'Foo', password: 'password-one' }),
    register(ctx, g.id, { handle: 'Bar', password: 'password-two' }),
  ]);
  const won = both.filter((x) => x.recoveryCode), lost = both.filter((x) => x.error);
  assert.equal(won.length, 1, 'one recovery code handed out');
  assert.deepEqual(lost.map((x) => x.error), ['already-registered']);
  const back = await recover(ctx, { handle: won[0].handle, code: won[0].recoveryCode, password: 'password-three' });
  assert.ok(back.id === g.id && back.recoveryCode, 'the code the winner was shown works');
});

test('AUDIT 68 S01-register-recover-lost-update: two recoveries racing on ONE code - one succeeds, the other hears bad-code, and the winner\'s new code and session are live', async () => {
  const ctx = ctxOf(d1());
  const g = await createGuest(ctx, {});
  const reg = await register(ctx, g.id, { handle: 'Foo', password: 'password-one' });
  const both = await Promise.all([
    recover(ctx, { handle: 'Foo', code: reg.recoveryCode, password: 'password-two' }),
    recover(ctx, { handle: 'Foo', code: reg.recoveryCode, password: 'password-three' }),
  ]);
  const won = both.filter((x) => !x.error);
  assert.equal(won.length, 1, 'a single-use code spent once');
  assert.deepEqual(both.filter((x) => x.error).map((x) => x.error), ['bad-code']);
  assert.ok(await resolveSession(ctx, won[0].secret), 'the winner\'s session is live');
  assert.ok((await recover(ctx, { handle: 'Foo', code: won[0].recoveryCode, password: 'password-four' })).id, 'and so is its new code');
});

test('AUDIT 68 S01-changepw-unthrottled-oracle: a guess at the old password spends LOGIN\'s allowance - past LOGIN_MAX the change is refused `rate` (429), the session is not punished (X8-changepassword-no-rate-per-handle)', () => frozen(async () => {
  const env = { DB: d1() };
  const call = async (method, path, body, bearer) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const g = (await call('POST', '/v1/auth/guest', {})).body;
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Sheogorath', password: 'the first one' }, g.secret)).status, 200);
  for (let i = 0; i < LOGIN_MAX; i++) {
    assert.equal((await call('POST', '/v1/account/password', { oldPassword: `guess ${i} wrong`, password: 'a new password' }, g.secret)).status, 401, `guess ${i}`);
  }
  const right = await call('POST', '/v1/account/password', { oldPassword: 'the first one', password: 'a new password' }, g.secret);
  assert.equal(right.status, 429); assert.equal(right.body.error, 'rate');
  assert.equal((await call('GET', '/v1/account', undefined, g.secret)).status, 200, 'the session stands');
  // and a right answer inside the allowance forgives it, as a login does
  const ctx = ctxOf(d1());
  const h = await createGuest(ctx, {});
  await register(ctx, h.id, { handle: 'Jyggalag', password: 'the first one' });
  const { player, session } = await resolveSession(ctx, h.secret);
  for (let i = 0; i < LOGIN_MAX - 1; i++) assert.equal((await changePassword(ctx, player, session, { oldPassword: 'wrong wrong', password: 'a new password' })).error, 'bad-login');
  assert.deepEqual(await changePassword(ctx, player, session, { oldPassword: 'the first one', password: 'a new password' }), { ok: true });
  const fresh = (await resolveSession(ctx, h.secret)).player;
  assert.equal((await changePassword(ctx, fresh, session, { oldPassword: 'wrong wrong', password: 'another password' })).error, 'bad-login', 'the count started over');
}, NOW * 1000));

/** A body that ANNOUNCES nothing: `total` bytes in 64 KiB chunks, counting what was pulled. */
function chunked(total) {
  const stats = { pulled: 0 };
  const body = new ReadableStream({
    pull(c) {
      if (stats.pulled >= total) { c.close(); return; }
      const n = Math.min(64 * 1024, total - stats.pulled);
      stats.pulled += n;
      c.enqueue(new Uint8Array(n).fill(0x20));
    },
  });
  return { body, stats };
}

test('AUDIT 68 X8-account-body-cap-not-enforced-without-content-length: a body with no content-length is refused as its bytes ARRIVE - on an open route and a blob route - never buffered whole first', async () => {
  const saves = new Map();
  const env = { DB: d1(), SAVES: { async put(k, b) { saves.set(k, b); }, async get() { return null; }, async delete() {} } };
  const guest = chunked(8 * 1024 * 1024);
  const res = await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: guest.body, duplex: 'half' }), env);
  assert.equal(res.status, 400); assert.deepEqual(await res.json(), { error: 'body' });
  assert.ok(guest.stats.pulled <= 4 * 64 * 1024, `pulled ${guest.stats.pulled} bytes of 8 MiB`);
  // a linked account, a slot, and a shot past its bound that says nothing of its length
  const call = async (method, path, body, bearer) => (await worker.fetch(new Request(`https://accounts.invalid${path}`, {
    method, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body),
  }), env)).json();
  const g = await call('POST', '/v1/auth/guest', {});
  await call('POST', '/v1/auth/register', { handle: 'Nystul', password: 'correct horse battery' }, g.secret);
  const slot = '/v1/saves/c0ffee00-1111-2222-3333-444455556666/QuickSave';
  assert.equal((await call('PUT', slot, CARD, g.secret)).ok, true);
  const shot = chunked(SHOT_MAX_BYTES * 8);
  const put = await worker.fetch(new Request(`https://accounts.invalid${slot}/shot`, { method: 'PUT', headers: { authorization: `Bearer ${g.secret}` }, body: shot.body, duplex: 'half' }), env);
  assert.equal(put.status, 413);
  assert.ok(shot.stats.pulled <= SHOT_MAX_BYTES + 128 * 1024, `pulled ${shot.stats.pulled} bytes of ${SHOT_MAX_BYTES * 8}`);
  assert.equal(saves.size, 0);
  // and one inside it, announcing nothing, lands whole
  const ok = chunked(100 * 1024);
  const fine = await worker.fetch(new Request(`https://accounts.invalid${slot}/shot`, { method: 'PUT', headers: { authorization: `Bearer ${g.secret}` }, body: ok.body, duplex: 'half' }), env);
  assert.equal(fine.status, 200);
  assert.equal([...saves.values()][0].byteLength, 100 * 1024);
});

test('AUDIT 68 X7-putcard-count-toctou: two NEW slots racing for the last place under SAVES_MAX - one lands, one hears too-many-saves, and the account holds SAVES_MAX; an existing slot is still written at the bound', async () => {
  const db = d1();
  const ctx = ctxOf(db);
  const g = await createGuest(ctx, {});
  for (let i = 0; i < SAVES_MAX - 1; i++) assert.equal((await putCard(ctx, g.id, { characterId: 'c', saveName: `save ${i}`, card: CARD })).ok, true);
  const both = await Promise.all([
    putCard(ctx, g.id, { characterId: 'c', saveName: 'N1', card: CARD }),
    putCard(ctx, g.id, { characterId: 'c', saveName: 'N2', card: CARD }),
  ]);
  assert.equal(both.filter((x) => x.ok).length, 1);
  assert.deepEqual(both.filter((x) => x.error).map((x) => x.error), ['too-many-saves']);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM saves WHERE player_id = ?').get(g.id).n, SAVES_MAX);
  assert.deepEqual(await putCard(ctx, g.id, { characterId: 'c', saveName: 'save 0', card: { ...CARD, gameTime: 7 } }), { ok: true, created: false }, 'an overwrite at the bound');
  assert.equal(db._raw.prepare('SELECT game_time FROM saves WHERE player_id = ? AND save_name = ?').get(g.id, 'save 0').game_time, 7);
});
