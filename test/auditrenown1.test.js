// AUDIT RENOWN1 (2026-09-25, Mac: "Lets audit this before we continue to build on it"): THE RENOWN, AUDITED - five
// lenses over RENOWN1 and RENOWN2 (security and trust, the game's hooks, the wire and the session, the data and the
// numbers, the displays and the records), every finding reproduced before it was fixed, and each fix pinned here:
//   THE SERVICE - the hour's window only moves forward (SEC-1/DATA-1), and so does the rate limiter's; the report is
//     ONE transaction that decides everything in SQL (DATA-3/4/5/7) under the report's own id (DATA-4/GAME-9);
//   THE RELAY - a renown order is taken only as a RISE, answered to its carrier otherwise, never in a channel, on the
//     room's own budget (SEC-2/SEC-3/WIRE-1), with the who answer and the channel's join carrying the level (UI-2);
//   THE SESSION - an order KEPT and delivered down each socket on that socket's own word until its room answers
//     (WIRE-2/WIRE-3); a level only ever rises on a renown frame; a peer re-introduced carries the level (UI-3);
//   THE TRACKER - one report HELD until it is answered, a refused one waits and doubles its wait (GAME-2), the page's
//     last word by keepalive (GAME-8), and one pure plan for the answer (UI-5/UI-7, WIRE-2c);
//   THE HOOKS - the watch and my own ally never pay (GAME-1/GAME-7), a scripted kill is nobody's blow (GAME-6), a
//     dungeon's class foe is worth the host's level (GAME-3), a rebuilt foe keeps my blows and a revived one forgets
//     them (GAME-10);
//   THE LAYER - above the lycanthrope's limiter, and the cure heals to it (GAME-4); never under the magery's third,
//     and a maximum of 0 holds nothing (GAME-5);
//   THE DISPLAYS - the account card's rows wrap (UI-1), its capped row says the level once (UI-6), its chip names
//     whose it is (UI-10), an empty box is never drawn (UI-8), the bitmap face is centred on its whole run (UI-9),
//     the box over a head follows a rise (UI-3 C1), and an open Inspect card follows it too (UI-3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest, overRate } from '../server-account/src/accounts.js';
import { reportRenownXp } from '../server-account/src/renownTracks.js';
import {
  RENOWN_XP_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX, RENOWN_REPORT_MS, RENOWN_RID_RE, renownRidOf,
  renownXpFor, renownProgressText,
} from '../src/net/renown.js';
import { mintRenownOrder, ORDER_TTL_S } from '../src/net/identityToken.js';
import {
  RENOWN_ROOM_HZ_MAX, RENOWN_RESEND_MS, RENOWN_ORDER_KEEP_MS, renownRoomGate, CHAT_WORLD_ROOM,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { withClock } from './placeWidest.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { call as accountCall, accountRenown, SESSION_KEY } from '../src/net/accountClient.js';
import {
  createRenownTracker, renownAnswer, renownRid, RENOWN_BACKOFF_MAX_MS, renownFoeStruck, renownFoeDied, renownFoeCarry,
  renownFoeRevived, renownFoeLevel, setRenownKillHandler, _resetRenownKillsForTests,
} from '../src/net/renownTracker.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';
import { setRenownLayer, offlineVitals, keepFraction } from '../src/systems/renownLayer.js';
import { defineLiveMaxHealth, defineLiveMaxMagicka } from '../src/systems/chargen.js';
import { lycanthropyMagicRound, cureLycanthropy, createLycanthropyCurse, currentMaxHealth, NEED_TO_KILL_PERIOD } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { passiveSpecialsMagicRound, setPassiveSpecialsHost } from '../src/systems/passiveSpecials.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { measureText } from '../src/ui/text.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { profileView, profileRenown } from '../src/ui/profileWindow.js';
import { accountCard } from '../src/ui/enhancedAccount.js';
import { AccountFlow } from '../src/ui/accountFlow.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** node:sqlite over the real migrations, in D1's shape - `batch` as D1 runs it: the statements in order, one transaction. */
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
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const T0 = 1_800_000_000;   // a clock hour's first second
const player = async (db) => ({ id: (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id });
const windowOf = (db, id) => db._raw.prepare('SELECT renown_hour AS h, renown_hour_xp AS xp FROM players WHERE id = ?').get(id);

// ── THE SERVICE ─────────────────────────────────────────────────────

test('AUDIT RENOWN1 SEC-1/DATA-1: the hour\'s window only moves FORWARD - a report stamped with an hour already past is charged to the window that is open, so reports alternating the old hour and the new take two hours\' bound no more than one hour\'s, and the window never steps back (mutants: `renown_hour = ?` restored; a late report given its own window)', async () => {
  const db = d1();
  const me = await player(db);
  const H = T0 + 3599, H1 = T0 + 3600;   // the last second of an hour, and the first of the next
  let credited = 0;
  for (let i = 0; i < 4; i++) credited += (await reportRenownXp({ db, nowS: H1 + i }, me, { character: 'char-aaaa', xp: 5000 })).credited;
  assert.equal(credited, RENOWN_XP_HOUR_MAX, 'the new hour, spent');
  for (let i = 0; i < 10; i++) {
    credited += (await reportRenownXp({ db, nowS: H }, me, { character: 'char-aaaa', xp: 5000 })).credited;   // a request that arrived in the old hour and landed late
    credited += (await reportRenownXp({ db, nowS: H1 + 20 + i }, me, { character: 'char-aaaa', xp: 5000 })).credited;
  }
  assert.equal(credited, RENOWN_XP_HOUR_MAX, 'twenty alternating reports took nothing more - it was 120,000 against a two-hour bound of 40,000');
  assert.deepEqual({ ...windowOf(db, me.id) }, { h: H1 / 3600, xp: RENOWN_XP_HOUR_MAX }, 'the window stands on the newest hour');
  // a late report into an OPEN window is charged to it, never lost
  const db2 = d1();
  const you = await player(db2);
  assert.equal((await reportRenownXp({ db: db2, nowS: H1 }, you, { character: 'char-bbbb', xp: 3000 })).credited, 3000);
  assert.equal((await reportRenownXp({ db: db2, nowS: H }, you, { character: 'char-bbbb', xp: 3000 })).credited, 3000, 'the honest player\'s late report still counts - in the window that is open');
  assert.deepEqual({ ...windowOf(db2, you.id) }, { h: H1 / 3600, xp: 6000 });
});

test('AUDIT RENOWN1 (DATA-1\'s neighbour): the rate limiter\'s window only moves forward too - a request stamped with a window already past is COUNTED in the one that is open, so alternating old-window and new-window requests cannot hold a count at 1 (the `login:` door shares this statement) (mutants: the equality reset restored)', async () => {
  const db = d1();
  const W = 900, start = Math.floor((T0 + 5000) / W) * W;
  const old = start - 1, now = start + 1;
  let over = false;
  for (let i = 0; i < 12 && !over; i++) {
    over = await overRate({ db, nowS: old }, 'login:mara', 10, W) || over;
    over = await overRate({ db, nowS: now }, 'login:mara', 10, W) || over;
  }
  assert.equal(over, true, 'the count ran past 10 - it reset to 1 on every alternation before');
  const row = db._raw.prepare("SELECT window_start AS w, count AS n FROM rate_limits WHERE key = 'login:mara'").get();
  assert.equal(row.w, start, 'and the window stands on the newest');
  assert.ok(row.n > 10);
  assert.equal(await overRate({ db, nowS: start + W + 1 }, 'login:mara', 10, W), false, 'a NEWER window still starts fresh');
});

test('AUDIT RENOWN1 DATA-3/DATA-7: the track bound is asked IN the write - fifty new characters reporting at once past 59 tracks make exactly one more; and a report the hour has spent makes no empty track (mutants: the bound read before the write; a track of 0 XP made)', async () => {
  const db = d1();
  const me = await player(db);
  for (let i = 0; i < RENOWN_TRACKS_MAX - 1; i++) {
    db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, NULL, 10, ?, ?)').run(me.id, `char-${String(i).padStart(4, '0')}`, T0, T0);
  }
  const answers = await Promise.all(Array.from({ length: 50 }, (_, i) => reportRenownXp({ db, nowS: T0 + 10 }, me, { character: `new-${String(i).padStart(4, '0')}`, xp: 10 })));
  assert.equal(answers.filter((a) => !a.error).length, 1, 'one fits');
  assert.equal(answers.filter((a) => a.error === 'renown-full').length, 49, 'every other is refused');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE player = ?').get(me.id).n, RENOWN_TRACKS_MAX, 'exactly the bound - it was 109');
  assert.equal(windowOf(db, me.id).xp, 10, 'and a refused report spends none of the hour');
  // the hour spent: an alt's kill is credited nothing, and makes no track to take one of the sixty places
  const db2 = d1();
  const you = await player(db2);
  for (let i = 0; i < 4; i++) await reportRenownXp({ db: db2, nowS: T0 + i }, you, { character: 'char-main', xp: 5000 });
  const alt = await reportRenownXp({ db: db2, nowS: T0 + 9 }, you, { character: 'char-alt1', xp: 10 });
  assert.deepEqual([alt.credited, alt.xp, alt.level, alt.rose], [0, 0, 1, false]);
  assert.deepEqual(db2._raw.prepare('SELECT char_id FROM renown_tracks').all().map((r) => r.char_id), ['char-main'], 'no empty track');
});

test('AUDIT RENOWN1 DATA-4/GAME-9: a report is ONE transaction under its own id - the same report sent again (its answer lost) is answered as a repeat and credited once; a new id is a new report; an id out of its shape is refused; and a report that fails half-way spends none of the hour (mutants: the id unread; the repeat credited; the hour spent outside the transaction)', async () => {
  const db = d1();
  const me = await player(db);
  const rid = '0123456789abcdef';
  assert.ok(RENOWN_RID_RE.test(rid) && renownRidOf(rid) === rid && renownRidOf('XYZ') === null && renownRidOf(null) === null);
  const a = await reportRenownXp({ db, nowS: T0 + 5 }, me, { character: 'char-aaaa', xp: 3000, rid });
  const b = await reportRenownXp({ db, nowS: T0 + 9 }, me, { character: 'char-aaaa', xp: 3000, rid });
  assert.deepEqual([a.credited, a.xp, a.rose, a.repeat], [3000, 3000, true, undefined]);
  assert.deepEqual([b.credited, b.xp, b.rose, b.repeat], [0, 3000, false, true], 'answered, credited nothing - it was 6,000 kept for 3,000 earned');
  assert.equal(windowOf(db, me.id).xp, 3000, 'and the hour charged once');
  const c = await reportRenownXp({ db, nowS: T0 + 12 }, me, { character: 'char-aaaa', xp: 100, rid: 'fedcba9876543210' });
  assert.deepEqual([c.credited, c.xp], [100, 3100], 'a new id is a new report');
  assert.deepEqual(await reportRenownXp({ db, nowS: T0 + 12 }, me, { character: 'char-aaaa', xp: 100, rid: 'not-an-id' }), { error: 'renown-xp' });
  assert.equal((await reportRenownXp({ db, nowS: T0 + 13 }, me, { character: 'char-aaaa', xp: 5 })).credited, 5, 'a report with no id (a client before the audit) is answered as it always was');
  // a failure between the hour and the track rolls the hour back with it
  db._raw.exec("CREATE TRIGGER boom BEFORE INSERT ON renown_tracks WHEN NEW.char_id = 'char-boom' BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  const before = windowOf(db, me.id).xp;
  await assert.rejects(reportRenownXp({ db, nowS: T0 + 20 }, me, { character: 'char-boom', xp: 500, rid: '1111111111111111' }));
  assert.equal(windowOf(db, me.id).xp, before, 'the hour is as it was: the report is one transaction');
  assert.match(src('server-account/src/renownTracks.js'), /const \[decided, , , after\] = await db\.batch\(\[/, 'ONE batch - D1 runs it as one transaction');
  assert.match(src('server-account/migrations/0009_renown.sql'), /\n {2}last_rid {3}TEXT,\n/, 'the track keeps the id of the last report it took');
});

test('AUDIT RENOWN1 DATA-5: reports racing near the cap are decided against the track as it stands INSIDE the transaction - the hour is charged what the track took, and only one says it rose (mutants: what the track can take read before the write)', async () => {
  const db = d1();
  const me = await player(db);
  db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)').run(me.id, 'char-capp', RENOWN_XP_MAX - 10, T0, T0);
  const both = await Promise.all([1, 2].map(() => reportRenownXp({ db, nowS: T0 + 1 }, me, { character: 'char-capp', xp: 5000 })));
  assert.deepEqual(both.map((r) => r.credited).sort((x, y) => x - y), [0, 10], 'one took the ten, the other nothing - it was ten each, both charged');
  assert.equal(windowOf(db, me.id).xp, 10, 'the hour charged the ten the track kept - it was charged twenty');
  assert.deepEqual(both.map((r) => r.rose).filter(Boolean), [true], 'one rise');
  assert.ok(both.every((r) => r.max === true && r.xp === RENOWN_XP_MAX));
  const lv2 = renownXpFor(2);
  const db2 = d1();
  const you = await player(db2);
  const rose = await Promise.all([60, 45].map((xp) => reportRenownXp({ db: db2, nowS: T0 + 1 }, you, { character: 'char-rise', xp })));
  assert.equal(rose.filter((r) => r.rose).length, 1, `one report crossed ${lv2}, and only it says so`);
});

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call, kp };
}

test('AUDIT RENOWN1 DATA-4 at the route: `rid` rides the body to the report, and a REPEAT carries a signed order when the level is past 1 - the answer that was lost may have been the one with the rise in it; the deploy asks D1 itself for a report and its repeat (mutants: the rid dropped at the route; no order on a repeat)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call } = await stand();
  const me = (await call('POST', '/v1/auth/guest', {})).body;
  const rid = 'aaaaaaaaaaaaaaaa';
  const first = (await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 5000, rid }, me.secret)).body;
  assert.deepEqual([first.credited, first.rose, typeof first.order], [5000, true, 'string']);
  const again = (await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 5000, rid }, me.secret)).body;
  assert.deepEqual([again.credited, again.repeat, again.level, typeof again.order], [0, true, 9, 'string'], 'a repeat is answered, credited nothing, and carries the order');
  const fresh = (await call('POST', '/v1/renown/xp', { character: 'char-bbbb', xp: 1, rid: 'bbbbbbbbbbbbbbbb' }, me.secret)).body;
  const freshAgain = (await call('POST', '/v1/renown/xp', { character: 'char-bbbb', xp: 1, rid: 'bbbbbbbbbbbbbbbb' }, me.secret)).body;
  assert.deepEqual([freshAgain.repeat, freshAgain.order], [true, null], 'a repeat at level 1 has no rise to carry');
  assert.equal(fresh.credited, 1);
  const yml = src('.github/workflows/account-deploy.yml');
  assert.match(yml, /"\$base\/v1\/renown\/xp"/, 'the deploy reports to the real D1');
  assert.match(yml, /grep -q '"credited":1' \/tmp\/renown\.json/);
  assert.match(yml, /grep -q '"repeat":true' \/tmp\/renown2\.json/);
});

// ── THE RELAY ───────────────────────────────────────────────────────

test('AUDIT RENOWN1 SEC-2/WIRE-1: a room\'s renown fans are budgeted for the ROOM (RENOWN_ROOM_HZ_MAX) - five rises in one instant fan four, and the fifth is dropped unanswered until the budget refills; flapping two orders of one\'s own fans only the rise (mutants: the room budget unspent; any change fanned)', () => withClock(async (tick) => {
  assert.equal(RENOWN_ROOM_HZ_MAX, 4);
  const g = renownRoomGate(null, 0);
  assert.equal(g.pass, true);
  const r = fakeRoom('town:m11');
  const kp = await r.signer();
  const listener = r.connect(); await r.hello(listener, 'lstn-0009');
  const five = [];
  for (let n = 0; n < 5; n++) { const ws = r.connect(); await r.hello(ws, `rise-000${n}`, null, { lv: 2 }); five.push(ws); }
  const nowS = Math.floor(Date.now() / 1000);
  const orders = await Promise.all(five.map((_, n) => mintRenownOrder({ s: `acct-rise-000${n}`, lv: 3 }, kp.privateKey, { subtle, nowS })));
  for (let n = 0; n < 5; n++) await r.room.webSocketMessage(five[n], JSON.stringify({ t: 'renown', order: orders[n] }));
  assert.equal(ofType(listener, 'renown').length, 4, 'four fans in the instant');
  assert.equal(ofType(five[4], 'renown').filter((m) => m.id === 'rise-0004').length, 0, 'the fifth answered nothing - its carrier sends it again');
  assert.equal(five[4].att.lv, 2);
  tick(1500);
  await r.room.webSocketMessage(five[4], JSON.stringify({ t: 'renown', order: orders[4] }));
  assert.equal(ofType(listener, 'renown').length, 5, 'and it goes when the budget has refilled');
  assert.equal(five[4].att.lv, 3);
  // FLAP: one socket, two of its own orders, alternated
  const flap = r.connect(); await r.hello(flap, 'flap-0001', null, { lv: 1 });
  const lv2 = await mintRenownOrder({ s: 'acct-flap-0001', lv: 2 }, kp.privateKey, { subtle, nowS });
  const lv3 = await mintRenownOrder({ s: 'acct-flap-0001', lv: 3 }, kp.privateKey, { subtle, nowS });
  const heard = ofType(listener, 'renown').length;
  for (let k = 0; k < 10; k++) { tick(1100); await r.room.webSocketMessage(flap, JSON.stringify({ t: 'renown', order: k % 2 ? lv2 : lv3 })); }
  assert.equal(ofType(listener, 'renown').length - heard, 1, 'one rise fanned - ten flaps fanned ten before');
  assert.equal(flap.att.lv, 3, 'and the level never fell');
  assert.equal(flap.closed, null);
}));

test('AUDIT RENOWN1 UI-2: the level rides the WHO answer in a place room and the join in a channel, as it rides the welcome and the place\'s join (mutants: the who answer stamped without its level; the channel\'s join without it)', async () => {
  const r = fakeRoom('world:3,12');
  const mara = r.connect(); await r.hello(mara, 'mara-0001', { x: 1, y: 0, z: 1, yaw: 0 }, { lv: 12 });
  const bob = r.connect(); await r.hello(bob, 'bobb-0002', { x: 2, y: 0, z: 1, yaw: 0 });
  await r.raw(bob, JSON.stringify({ t: 'who', id: 'mara-0001' }));
  const who = bob.sent.filter((m) => m.t === 'join' && m.id === 'mara-0001').at(-1);
  assert.equal(who?.lv, 12, 'the who answer wears the level');
  const c = fakeRoom(CHAT_WORLD_ROOM);
  const eve = c.connect(); await c.hello(eve, 'evee-0003');
  const ann = c.connect(); await c.hello(ann, 'anna-0004', null, { lv: 30 });
  const join = ofType(eve, 'join').find((j) => j.id === 'anna-0004');
  assert.equal(join?.lv, 30, 'the channel\'s join wears it too');
});

// ── THE SESSION ─────────────────────────────────────────────────────

const cell = () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  s.join('world:2,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  sockets[0].open();
  return { s, sockets, clock };
};
const renownSent = (w) => w.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'renown');

test('AUDIT RENOWN1 WIRE-3: each socket is sent a renown order on ITS OWN welcome\'s word - a halo whose relay is a version behind is sent none while the primary\'s is sent it; a halo promoted to the primary keeps its own state; the order goes nowhere past its keeping (mutants: a session-wide flag; a socket\'s state lost on promotion)', () => {
  const { s, sockets, clock } = cell();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world108' });
  s.setHalo(['world:3,12']);
  sockets[1].open();
  sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world107' });   // a relay mid-deploy
  assert.equal(s.sendRenownOrder('v1.a.b', 7), true);
  assert.deepEqual(renownSent(sockets[0]), [{ t: 'renown', order: 'v1.a.b' }]);
  assert.deepEqual(renownSent(sockets[1]), [], 'the world107 socket would be closed by the frame');
  clock.t += 5000; s.tick();
  assert.deepEqual(renownSent(sockets[1]), [], 'and it stays unsent however long it waits');
  sockets[0].receive({ t: 'renown', id: 'mac-0001', lv: 7 });
  const went = renownSent(sockets[0]).length;
  clock.t += 5000; s.tick();
  assert.equal(renownSent(sockets[0]).length, went, 'answered, never again');
  assert.equal(RENOWN_RESEND_MS, 3000);
  assert.equal(RENOWN_ORDER_KEEP_MS, (ORDER_TTL_S - 10) * 1000, 'inside the order\'s own minute (a number, not an expression: identityToken.js imports wire.js)');
});

test('AUDIT RENOWN1 UI-3: a peer RE-INTRODUCED (a join, a re-hello as another character) carries its level whatever it is; a level heard for a peer who has left rises in memory; a peer re-stood from memory wears it (mutants: `_refresh` leaving the level; the remembered level not raised; the re-stood level dropped)', () => {
  const { s, sockets } = cell();
  const ws = sockets[0];
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', lv: 12 }], n: 2, v: 'world108' });
  ws.receive({ t: 'join', id: 'bob-0002', name: 'Bob', lv: 14 });
  assert.equal(s.renownOf('bob-0002'), 14, 'a join re-introduces the level');
  ws.receive({ t: 'join', id: 'bob-0002', name: 'Bob', lv: 3 });
  assert.equal(s.renownOf('bob-0002'), 3, 'an introduction is the truth - a re-hello as another character may be lower');
  ws.receive({ t: 'leave', id: 'bob-0002' });
  assert.equal(s.peers.has('bob-0002'), false);
  assert.equal(s.renownOf('bob-0002'), 3, 'remembered');
  ws.receive({ t: 'renown', id: 'bob-0002', lv: 4 });
  assert.equal(s.renownOf('bob-0002'), 4, 'a rise heard for a remembered peer rises in memory');
  ws.receive({ t: 'renown', id: 'bob-0002', lv: 2 });
  assert.equal(s.renownOf('bob-0002'), 4, 'and never falls there');
  assert.match(src('src/net/online.js'), /const made = this\._peer\(knew \? \{ \.\.\.p, name: knew\.name, title: knew\.title, glyphs: knew\.glyphs, lv: knew\.lv,/, 'a re-stood peer wears the remembered level');
});

// ── THE TRACKER ─────────────────────────────────────────────────────

test('AUDIT RENOWN1 DATA-4/GAME-2: the tracker HOLDS one report until it is answered - sent again unchanged (its id, its XP) after a refusal, while what is earned meanwhile waits; a refused report waits a minute, then two, doubling to RENOWN_BACKOFF_MAX_MS, and a report\'s worth piled up skips the wait only after an answer; a repeat answer clears it (mutants: a new id for a retry; the XP re-formed with the new earnings; no backoff; the early report after a refusal)', async () => {
  let t = 0, answer = { ok: false, error: 'offline' };
  const sent = [];
  let n = 0;
  const k = createRenownTracker({ report: async (c, xp, name, rid) => { sent.push({ c, xp, rid, t }); return answer; }, character: () => 'char-aaaa', now: () => t, rid: () => `rid${String(++n).padStart(13, '0')}` });
  k.earn(RENOWN_XP_REPORT_MAX + 700);
  await k.tick(t);
  assert.deepEqual(sent.map((x) => [x.xp, x.rid]), [[RENOWN_XP_REPORT_MAX, 'rid0000000000001']]);
  k.earn(50);
  for (let f = 0; f < 600; f++) { t += 100; const p = k.tick(t); if (p) await p; }   // a minute of frames
  assert.equal(sent.length, 2, 'one retry in the minute - it was a report every frame');
  assert.deepEqual([sent[1].xp, sent[1].rid], [RENOWN_XP_REPORT_MAX, 'rid0000000000001'], 'the SAME report: its XP and its id');
  assert.equal(k.pending(), RENOWN_XP_REPORT_MAX + 750);
  const waits = [];
  for (let f = 0; f < 40 && waits.length < 5; f++) {
    const at = t;
    while (!k.due(t)) t += 1000;
    waits.push(t - at);
    await k.flush(t);
  }
  assert.deepEqual(waits.slice(0, 4), [2 * RENOWN_REPORT_MS, 4 * RENOWN_REPORT_MS, 8 * RENOWN_REPORT_MS, 15 * 60_000].map((w) => w - 0), 'the wait doubles: two minutes, four, eight, then the ceiling');
  assert.equal(RENOWN_BACKOFF_MAX_MS, 15 * 60_000);
  answer = { ok: true, data: { level: 9, credited: 0, repeat: true, rose: false } };   // the service had it all along
  t += RENOWN_BACKOFF_MAX_MS;
  await k.tick(t);
  assert.equal(k.pending(), 750, 'a repeat is an answer: the held report is done, and what was earned since remains');
  answer = { ok: true, data: { level: 9, credited: 750 } };
  t += 1;
  assert.equal(k.due(t), false, 'after an answer, a minute');
  k.earn(RENOWN_XP_REPORT_MAX);
  assert.equal(k.due(t), true, 'unless a report\'s worth has piled up - after an answer');
  await k.tick(t);
  assert.notEqual(sent.at(-1).rid, 'rid0000000000001', 'a new report, a new id');
});

test('AUDIT RENOWN1 GAME-8: the page\'s last word - `leave` sends the held report (or forms one from what is pending) by keepalive, under its own id, and clears nothing, so a page the back-forward cache brings back sends the same report again; the account client asks `call` for keepalive and adds the id only when there is one (mutants: leave clearing the report; keepalive dropped; a second credential door)', async () => {
  const left = [];
  let t = 0;
  const k = createRenownTracker({ report: async () => ({ ok: false, error: 'offline' }), leave: (c, xp, name, rid) => left.push({ c, xp, rid }), character: () => 'char-aaaa', now: () => t, rid: () => 'ffffffffffffffff' });
  assert.equal(k.leave(), false, 'nothing earned, nothing to send');
  k.earn(120);
  assert.equal(k.leave(), true);
  assert.deepEqual(left, [{ c: 'char-aaaa', xp: 120, rid: 'ffffffffffffffff' }]);
  assert.equal(k.pending(), 120, 'held, not cleared');
  const sent = [];
  await k.flush(t);
  assert.equal(k.pending(), 120);
  const fetch = async (url, init) => { sent.push({ url, init }); return { ok: true, status: 200, json: async () => ({ character: 'char-aaaa', xp: 120, level: 2, credited: 120, rose: true, order: null }) }; };
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Mac', kind: 'guest', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' })]]);
  const storage = { getItem: (x) => m.get(x) ?? null, setItem: (x, v) => m.set(x, v), removeItem: (x) => m.delete(x) };
  const acct = accountRenown({ fetch, storage });
  await acct.report('char-aaaa', 10, 'Mara');
  assert.equal('keepalive' in sent.at(-1).init, false, 'an ordinary report asks nothing of the browser');
  assert.equal('rid' in JSON.parse(sent.at(-1).init.body), false, 'and carries no id it was not given');
  await acct.leave('char-aaaa', 10, 'Mara', 'ffffffffffffffff');
  assert.equal(sent.at(-1).init.keepalive, true, 'the page\'s last word is finished after the page');
  assert.equal(sent.at(-1).init.headers.authorization, 'Bearer SECRETSECRETSECRETSECRET', 'through the one door: the credential in the header');
  assert.equal(JSON.parse(sent.at(-1).init.body).rid, 'ffffffffffffffff');
  assert.equal(JSON.parse(sent.at(-1).init.body).secret, undefined, 'and never in the body');
  assert.equal((await accountCall({ fetch, base: 'https://x.invalid' }, '/v1/health')).ok, true);
  assert.match(renownRid(), RENOWN_RID_RE, 'a report\'s own id, in its shape');
  assert.match(src('src/scenes/world.js'), /leave: \(c, xp, name, rid\) => renownAccount\.leave\(c, xp, name, rid\),/);
});

test('AUDIT RENOWN1 UI-5/UI-7/WIRE-2c: the answer\'s plan - the order carried WHENEVER the service signed one, a rise announced against what was SAID (never against the page\'s level, which a token may have raised first), the hour\'s line only for a report the hour cut short (never at the cap, never for a repeat) (mutants: the order gated on the page\'s level; the announcement against the page\'s level; the cap line at the cap; the cap line for a repeat)', () => {
  assert.deepEqual(renownAnswer({ level: 6, rose: true, order: 'v1.o.s', credited: 500 }, 500, 5), { level: 6, order: 'v1.o.s', announce: 6, capped: false });
  assert.deepEqual(renownAnswer({ level: 6, rose: true, order: 'v1.o.s', credited: 500 }, 500, null).announce, 6, 'nothing said yet');
  assert.equal(renownAnswer({ level: 6, rose: true, order: 'v1.o.s', credited: 500 }, 500, 6).announce, null, 'said already');
  assert.equal(renownAnswer({ level: 6, rose: false, order: null, credited: 500 }, 500, 5).announce, null, 'no rise, nothing said');
  assert.equal(renownAnswer({ level: 6, rose: false, repeat: true, order: 'v1.o.s', credited: 0 }, 500, 5).order, 'v1.o.s', 'a repeat\'s order is carried');
  assert.equal(renownAnswer({ level: 6, rose: false, repeat: true, order: 'v1.o.s', credited: 0 }, 500, 5).capped, false, 'a repeat is not the hour');
  assert.equal(renownAnswer({ level: 9, credited: 100 }, 500, 9).capped, true, 'the hour cut it short');
  assert.equal(renownAnswer({ level: 50, credited: 0, max: true }, 500, 50).capped, false, 'at the cap there is no hour to speak of');
  assert.deepEqual(renownAnswer(null, 10, null), { level: null, order: null, announce: null, capped: false });
  const w = src('src/scenes/world.js');
  assert.match(w, /const a = renownAnswer\(data, sent, renownSaid\);/);
  assert.match(w, /if \(a\.order\) online\?\.sendRenownOrder\?\.\(a\.order, a\.level\);/, 'the order carried on the plan\'s word alone');
  assert.match(w, /if \(a\.announce !== null\) \{ renownSaid = a\.announce; townTalk\.say\(`Your Renown is now \$\{a\.announce\}\.`\); \}/);
  assert.match(w, /if \(renownNow !== null && level <= renownNow\) return renownNow;/, 'the page\'s own level only rises (UI-7 W2)');
  assert.match(w, /onStop: \(error\) => tradeSay\(`\$\{accountRefusalText\(error\)\} This character is earning no Renown\.`\),/, 'UI-4: a refusal that ends reporting is said');
});

// ── THE HOOKS ───────────────────────────────────────────────────────

test('AUDIT RENOWN1 GAME-1/GAME-7/GAME-10: the city watch never pays, whoever\'s it is; a foe that is my ally when my blow lands never pays, though the blow turns it; a foe stood again as a new record keeps my blows; one that stands up again forgets them and can pay again; the level is the one its owner streamed (mutants: the watch paying; the ally paying once turned; the carry lost; the revived foe never paying; the streamed level unread)', () => {
  _resetRenownKillsForTests();
  const paid = [];
  setRenownKillHandler((f) => paid.push(f.tag));
  const watch = { tag: 'watch', mobileType: KNIGHT_CITY_WATCH, entity: { level: 10 } };
  renownFoeStruck(watch, 1000);
  assert.equal(renownFoeDied(watch, 1500), false, 'another player\'s watchman, stood here as a puppet');
  const ally = { tag: 'ally', mobileType: 3, entity: { level: 5, team: 'PlayerAlly' } };
  renownFoeStruck(ally, 1000);
  ally.entity.team = 'Rat';   // the blow turns it (resetAllyTeamOnPlayerAttack)
  renownFoeStruck(ally, 1200);
  assert.equal(renownFoeDied(ally, 1300), false, 'my Skull\'s clone, struck and farmed');
  const old = { tag: 'old', mobileType: 3, entity: { level: 5 } }, next = { tag: 'next', mobileType: 20, entity: { level: 5 } };
  renownFoeStruck(old, 1000);
  renownFoeCarry(old, next);
  assert.equal(renownFoeDied(next, 5000), true, 'the Wabbajack\'s change is the same fight');
  const rat = { tag: 'rat', mobileType: 0, entity: { level: 1 } };
  renownFoeStruck(rat, 1000);
  assert.equal(renownFoeDied(rat, 2000), true);
  renownFoeRevived(rat);
  assert.equal(renownFoeDied(rat, 3000), false, 'a new life, no blow of mine yet');
  renownFoeStruck(rat, 4000);
  assert.equal(renownFoeDied(rat, 5000), true, 'and it pays again - it kept `paid` for ever before');
  assert.deepEqual(paid, ['next', 'rat', 'rat']);
  assert.equal(renownFoeLevel({ streamedLevel: 3, entity: { level: 30 } }), 3, 'the host\'s level, not the joiner\'s copy\'s');
  assert.equal(renownFoeLevel({ entity: { level: 30 } }), 30);
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /if \(f\.mobileType >= 128 && Number\.isInteger\(f\.entity\?\.level\) && f\.entity\.level >= 0 && f\.entity\.level <= FOE_LEVEL_MAX\) r\.l = f\.entity\.level;/, 'GAME-3: the host streams a class foe\'s level');
  assert.match(d, /if \(r\.l !== undefined && f\.mobileType >= 128\) f\.streamedLevel = r\.l;/, 'and the joiner keeps it');
  assert.match(d, /if \(landed && !f\.dead\) renownFoeCarry\(f, rec\);/, 'a live foe rebuilt keeps my blows; a dead one\'s rebuild does not');
  assert.match(d, /_lootAt\.delete\(`corpse:\$\{pi\}`\); \}\n\s*renownFoeRevived\(f\);/, 'un-death forgets them');
  assert.match(d, /nf\.entity\.health -= missing;[^\n]*\n\s*renownFoeCarry\(f, nf\);/, 'the dungeon\'s Wabbajack carries them');
  assert.match(src('src/scenes/world.js'), /nf\.entity\.health -= missing;[^\n]*\n\s*renownFoeCarry\(f, nf\);/, 'and the street\'s');
  for (const file of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(src(file), /zeroFoeHealth: \(f\) => \{ if \(!f\.dead(?: && !f\.puppet)?\) damageFoe\(f, f\.entity\.health, null, null, \{ fromPlayer: false, bypassShield: true \}\); \}/, `GAME-6: ${file}'s scripted kill is nobody's blow`);
  }
  setRenownKillHandler(null);
});

// ── THE LAYER ───────────────────────────────────────────────────────

const liveEntity = (over = {}) => {
  const e = { isPlayer: true, maxHealth: 100, health: 100, maxMagicka: 0, magicka: 0, career: { abilityFlagsAndSpellPointsBitfield: 0x1000 }, stats: { intelligence: 50, strength: 50, agility: 50, endurance: 50, speed: 50 }, activeEffects: [], spells: [], items: [], ...over };
  defineLiveMaxHealth(e);
  defineLiveMaxMagicka(e);
  e.magicka = e.maxMagicka;
  return e;
};

test('AUDIT RENOWN1 GAME-4: the layer rides ABOVE the lycanthrope\'s limiter - a Renown 50 werewolf keeps its 147 through the urge (it fell to 100 of 100), the urge\'s clamp and every full heal read the same ceiling, and the cure heals to the whole maximum (it left 100 of 247) (mutants: the limiter capping the layer; the cure to the raw value)', () => {
  const e = liveEntity();
  setRenownLayer(e, 50);
  assert.equal(e.maxHealth, 247);
  e.health = 247;
  createLycanthropyCurse(e, LYCANTHROPY_TYPES?.Werewolf ?? 1, { now: 0, rolls: () => 0.5 });
  const t = NEED_TO_KILL_PERIOD + 600;   // ten hours into the urge
  lycanthropyMagicRound(e, { nowMinutes: t, clockMinutes: t });
  const lim = e.maxHealthLimiter;
  assert.ok(lim >= 1 && lim < 100, `the urge has lowered the limit (${lim})`);
  assert.equal(e.maxHealth, lim + 147, 'Daggerfall\'s own maximum limited, the layer above it');
  assert.equal(e.health, lim + 147, 'the clamp reads the same ceiling');
  assert.equal(currentMaxHealth(e), lim + 147, 'and so does every full heal');
  e.health = 10;
  cureLycanthropy(e, { nowMinutes: t + 1 });
  assert.deepEqual([e.health, e.maxHealth], [247, 247], 'the cure\'s full heal');
  const plain = { maxHealth: 80, health: 80, maxHealthLimiter: 50 };
  assert.equal(currentMaxHealth(plain), 50, 'offline, a plain entity: the limiter alone, as before');
});

test('AUDIT RENOWN1 GAME-5: the magery\'s third is of Daggerfall\'s own maximum, never the layer - a save keeps the true offline magicka (it kept 2 of 34); and a maximum of 0 holds nothing (keepFraction answered 1) (mutants: the layer in the magery\'s raw; the floor above the bound)', () => {
  const e = liveEntity({ career: { abilityFlagsAndSpellPointsBitfield: 0x1000 | 0x80 } });   // light-powered: reduced in the dark
  setPassiveSpecialsHost({ now: () => 0, isInside: () => true, inPrison: () => false, isHolyPlace: () => false, inDungeon: () => true });
  passiveSpecialsMagicRound(e, { nowMinutes: 1, clockMinutes: 60 * 12 });
  const offMax = e.maxMagicka;
  setRenownLayer(e, 50);
  passiveSpecialsMagicRound(e, { nowMinutes: 2, clockMinutes: 60 * 12 });
  assert.equal(e.maxMagicka, offMax + 98, 'the whole layer on top, not two thirds of it');
  e.magicka = e.maxMagicka;
  assert.deepEqual(offlineVitals(e), { health: e.health * 100 / e.maxHealth, magicka: offMax, maxMagicka: offMax }, 'full online is full offline');
  assert.equal(keepFraction(5, 10, 0), 0, 'nothing held under a maximum of nothing');
  assert.equal(keepFraction(1, 200, 90), 1, 'a scale still never rounds the living to 0');
  setPassiveSpecialsHost(null);
});

// ── THE DISPLAYS ────────────────────────────────────────────────────

test('AUDIT RENOWN1 UI-1/UI-6/UI-8/UI-10: the account card\'s values shrink and wrap in the window (the Renown rows ran off a phone\'s window both ways); a capped row names the level once; the chip names whose Renown it is and is drawn only signed in; an empty box is never drawn (mutants: the value unshrinking; "Renown 50, Renown 50"; the chip on the password stage; a bordered empty box)', () => {
  const css = src('src/ui/enhancedStyle.js');
  assert.match(css, /\.px-win\.px-acctwin \.card\.acct ul\.acctfacts \.acctkey \{ flex: 0 0 auto; \}\n\.px-win\.px-acctwin \.card\.acct ul\.acctfacts \.acctval \{ flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; \}/);
  assert.match(css, /\.card ul\.acctfacts \.acctval \{ flex: 1 1 auto; min-width: 0; color: var\(--bone\); font-size: 15px; overflow-wrap: anywhere; \}/);
  assert.match(css, /\.card h3 \.acctrenown:empty \{ display: none; \}/);
  assert.match(src('src/ui/profileWindow.js'), /\.dfprofile-renown:empty \{ display: none; \}/);
  assert.equal(renownProgressText(RENOWN_XP_MAX), 'the highest there is');
  const mk = (tag) => {
    const n = {
      tag, className: '', title: '', children: [],
      append: (...kids) => n.children.push(...kids.filter(Boolean)),
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network'); } }, storage });
  const card = accountCard({ createElement: mk }, flow);
  flow.account = { id: 'p1', name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy', playedS: 60, renown: [{ character: 'char-cccc', name: 'Old Hand', xp: RENOWN_XP_MAX, level: 50 }] };
  flow.stage = 'in';
  card.paint();
  const rows = card.root.all.filter((n) => n.className === 'acctval').map((n) => n.textContent);
  assert.ok(rows.includes('Old Hand - Renown 50, the highest there is'), rows.join(' | '));
  const chip = card.root.all.find((n) => n.className === 'acctrenown');
  assert.equal(chip.title, 'Renown 50 - Old Hand');
  flow.stage = 'password';
  card.paint();
  assert.equal(card.root.all.some((n) => n.className === 'acctrenown'), false, 'only signed in');
});

test('AUDIT RENOWN1 UI-9: the bitmap face is centred on its WHOLE run - "[12] Mack" measured with the level in it, so the label sits over the head (mutants: the run measured without its lead)', () => {
  const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
  const runs = [];
  const rec = { drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs) => runs.push(qs) };
  const rp = new RemotePlayers({ renderer: rec, deps: null, compose: async () => null });
  rp.drawNamePoints(rec, { fnt: FNT, tex: 'T' }, [{ id: 'p', name: 'Mack', x: 800, y: 400, scale: 1, title: null, glyphs: [], lv: 12 }], 1);
  const left = Math.min(...runs.flat().map((q) => q.dst.x));
  assert.equal(left, Math.round(800 - measureText(FNT, '[12] Mack') / 2), 'the left edge of the whole run');
  assert.notEqual(left, Math.round(800 - measureText(FNT, 'Mack') / 2));
});

test('AUDIT RENOWN1 UI-3: the box over a head FOLLOWS a rise - 12, then 13, then none - and an open Inspect card is re-drawn with the level the session knows now (mutants: the box written once; the card\'s level frozen at its opening)', () => {
  const nodes = [];
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, style: {}, dataset: {},
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; }, replaceChildren(...cs) { n.children.length = 0; n.append(...cs); },
      remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; }, addEventListener() {}, focus() {} };
    let text = '', cls = '';
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; } });
    Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); } });
    nodes.push(n);
    return n;
  };
  const doc = { createElement: (t) => node(t), createElementNS: (ns, t) => node(t), head: node('head'), body: node('body'), getElementById: () => null };
  const layer = createNameLayer({ doc, now: () => 1000 });
  const find = (n, cls) => { if ((n.className ?? '').split(' ').includes(cls)) return n; for (const c of n.children ?? []) { const f = find(c, cls); if (f) return f; } return null; };
  const at = (lv) => { layer.render({ points: [{ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, title: null, glyphs: [], lv }] }); return find(layer.tagFor('peer-0001').node, 'dfname-renown').textContent; };
  assert.deepEqual([at(12), at(13), at(null)], ['12', '13', '']);
  const v = profileView({ name: 'Bran', peer: { lv: 12 } });
  assert.deepEqual([profileRenown(v, 13).level, profileRenown(v, 13).levelTitle], ['13', 'Renown 13']);
  assert.equal(profileRenown(v, null), v, 'a level the session does not know leaves the card\'s own');
  assert.equal(profileRenown(v, 12), v);
  const w = src('src/scenes/world.js');
  assert.match(w, /_profileView = profileRenown\(v, online\?\.renownOf\?\.\(peerId\) \?\? null\);/);
  assert.match(w, /if \(_profileView && profileWin\?\.isOpen\(\)\) \{ const lv = renownText\(online\?\.renownOf\?\.\(profileWin\.peerId\(\)\) \?\? null\); if \(lv && lv !== _profileView\.level\) repaintDuelProfile\(\); \}/);
});
