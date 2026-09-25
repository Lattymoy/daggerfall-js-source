// RENOWN1 (2026-09-24, Mac: "What if the leveling system was something seperate unique to online but compatible"; asked:
// the online health and magicka "On top" of Daggerfall's, a long "Grind", offline earning "No" - "Plus having their
// level appear on the left side of character name and profile main menu + ingame profile"): THE RENOWN,
// DRIVEN. The curve and the rules (net/renown.js); the service's track over the real migrations - the hour's bound
// the ACCOUNT's across its characters and spent in one statement, the tracks' bound, the cap (server-account/src/
// renownTracks.js) - and its routes and the token's `lv`; the token's and the order's law (a renown order never passes at
// the mute's door); the relay stamping the level beside the name and taking a renown order only from the account it
// names; the client session reading both; the tracker's one rule for a kill (a foe pays whoever struck last, if a blow
// of mine is recent) and its report; the online layer on top of the live maximums and never in a save; and the level
// left of the name - over a head in both faces, on the Inspect card, on the main menu's account card and the plaque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest } from '../server-account/src/accounts.js';
import { reportRenownXp, renownTracksOf, renownTrackOf, renownNameOf, RENOWN_CARD_TRACKS } from '../server-account/src/renownTracks.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import {
  RENOWN_MAX, RENOWN_XP_MAX, renownXpFor, renownForXp, renownProgress, renownProgressText, renownText,
  renownKillXp, renownQuestXp, renownPartyXp, renownBonus, RENOWN_XP_REPORT_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX, RENOWN_REPORT_MS,
  RENOWN_KILL_XP_PER_LEVEL, RENOWN_KILL_LEVEL_MAX, RENOWN_PARTY_COUNT_MAX, RENOWN_HP_PER_LEVEL, RENOWN_MP_PER_LEVEL,
} from '../src/net/renown.js';
import {
  claimsValid, mintToken, verifyToken, orderValid, mintOrder, mintRenownOrder, verifyOrder, renownIssuable, ORDER_KINDS,
} from '../src/net/identityToken.js';
import { badged, readRenown, parseClient, renownGate, RENOWN_HZ_MAX, relaySupportsRenown, RENOWN_RELAY_MIN, RELAY_VERSION, CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { accountTokenMinter, accountRenown, SESSION_KEY, REFUSALS } from '../src/net/accountClient.js';
import { createRenownTracker, renownFoeStruck, renownFoeDied, renownFoeLevel, setRenownKillHandler, RENOWN_ASSIST_MS, _resetRenownKillsForTests } from '../src/net/renownTracker.js';
import { setRenownLayer, offlineVitals, keepFraction, renownHpOf, renownMpOf } from '../src/systems/renownLayer.js';
import { defineLiveMaxHealth, defineLiveMaxMagicka } from '../src/systems/chargen.js';
import { snapshotPlayer } from '../src/systems/save.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { profileView, createProfileWindow } from '../src/ui/profileWindow.js';
import { accountCard } from '../src/ui/enhancedAccount.js';
import { AccountFlow } from '../src/ui/accountFlow.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
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
    // D1's batch: the statements in order, as ONE transaction (AUDIT RENOWN1 - the report is one)
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const T0 = 1_800_000_000;   // a clock hour's first second: T0 / 3600 is whole
const player = async (db) => ({ id: (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id });

// ── THE LAW ─────────────────────────────────────────────────────────

test('RENOWN1 the curve: EverQuest\'s shape in integers - level 2 at 100, 10 at 5,510, 20 at 68,200, 50 at 2,318,660; every level dearer than the last; the level a total makes is the inverse at every boundary and stops at the cap (mutants: a level off by one at its boundary; the cap unread; a flat curve)', () => {
  assert.equal(RENOWN_MAX, 50);
  const table = { 1: 0, 2: 100, 3: 230, 5: 690, 10: 5510, 15: 23350, 20: 68200, 30: 319950, 40: 972770, 50: 2318660 };
  for (const [l, xp] of Object.entries(table)) assert.equal(renownXpFor(Number(l)), xp, `level ${l}`);
  assert.equal(RENOWN_XP_MAX, 2318660);
  let lastStep = 0;
  for (let l = 2; l <= RENOWN_MAX; l++) {
    const at = renownXpFor(l);
    assert.ok(Number.isSafeInteger(at) && at % 10 === 0, 'whole tens: every engine agrees on every boundary');
    const step = at - renownXpFor(l - 1);
    assert.ok(step > lastStep, `level ${l} costs more than level ${l - 1} did - a grind, not a stair`);
    lastStep = step;
    assert.equal(renownForXp(at), l, `exactly ${at} is level ${l}`);
    assert.equal(renownForXp(at - 1), l - 1, `one short of ${at} is still level ${l - 1}`);
  }
  assert.equal(renownForXp(0), 1);
  assert.equal(renownForXp(-5), 1);
  assert.equal(renownForXp(Number.NaN), 1);
  assert.equal(renownForXp(RENOWN_XP_MAX * 10), RENOWN_MAX, 'the cap holds past its total');
  assert.equal(renownXpFor(0), 0);
  assert.equal(renownXpFor(99), RENOWN_XP_MAX, 'a level past the cap is the cap');
  assert.deepEqual(renownProgress(150), { level: 2, xp: 150, into: 50, need: 130, frac: 50 / 130 });
  assert.deepEqual(renownProgress(RENOWN_XP_MAX + 5), { level: 50, xp: RENOWN_XP_MAX, into: 0, need: 0, frac: 1 });
  assert.equal(renownProgressText(150), '50 / 130 XP to Renown 3');
  assert.equal(renownProgressText(6000), '490 / 2,150 XP to Renown 11', 'thousands grouped');
  assert.equal(renownProgressText(RENOWN_XP_MAX), 'the highest there is', 'AUDIT RENOWN1 UI-6: the row names the level already');
  assert.equal(renownText(12), '12', 'the number alone - every face puts it in a box (Mac: "Just have it read 12 inside a box")');
  for (const bad of [0, 51, 1.5, '12', null, undefined]) assert.equal(renownText(bad), null, `${bad} is no level`);
});

test('RENOWN1 the rules: a kill is ten to its foe\'s level (clamped 1..30), a quest 100 + 40 a character level, a party adds 10% a head beyond the first up to its eight seats; the online bonus is 3 health and 2 magicka a level past the first - level 1 adds nothing, level 50 adds 147 and 98 (mutants: a party that SPLITS the kill; the bonus from level 0; a clamp unread)', () => {
  // RENOWN3 reads both against the character's Renown; at the cap's Renown nothing is read lower, so these are the
  // RENOWN1 rules themselves (test/renown3.test.js holds the ceiling)
  assert.equal(renownKillXp(1, RENOWN_MAX), 10);
  assert.equal(renownKillXp(20, RENOWN_MAX), 200);
  assert.equal(renownKillXp(0, RENOWN_MAX), RENOWN_KILL_XP_PER_LEVEL, 'a foe with no level is a level-1 foe');
  assert.equal(renownKillXp(99, RENOWN_MAX), RENOWN_KILL_XP_PER_LEVEL * RENOWN_KILL_LEVEL_MAX);
  assert.equal(renownQuestXp(1, RENOWN_MAX), 140);
  assert.equal(renownQuestXp(10, RENOWN_MAX), 500);
  assert.equal(renownQuestXp(99, RENOWN_MAX), renownQuestXp(30, RENOWN_MAX));
  assert.equal(renownPartyXp(100, 1), 100, 'alone: the kill');
  assert.equal(renownPartyXp(100, 4), 130, 'four in the room: MORE a head, never a share');
  assert.equal(renownPartyXp(100, 99), 100 + 10 * (RENOWN_PARTY_COUNT_MAX - 1));
  assert.equal(renownPartyXp(100, 0), 100);
  assert.deepEqual(renownBonus(1), { hp: 0, mp: 0 });
  assert.deepEqual(renownBonus(2), { hp: RENOWN_HP_PER_LEVEL, mp: RENOWN_MP_PER_LEVEL });
  assert.deepEqual(renownBonus(50), { hp: 147, mp: 98 });
  assert.deepEqual(renownBonus(99), renownBonus(50));
  assert.equal(RENOWN_XP_REPORT_MAX, 5000);
  assert.equal(RENOWN_XP_HOUR_MAX, 20000);
});

// ── THE SERVICE ─────────────────────────────────────────────────────

test('RENOWN1 the track: one row a character, the level DERIVED from its total; the hour\'s bound is the ACCOUNT\'s across all its characters and a new clock hour opens it again; a report the hour spent is credited 0, answered, never refused; the track stops at the cap without spending the hour; `rose` says a level rose (mutants: the bound per character; the window never reset; the cap unread; rose always)', async () => {
  const db = d1();
  const P = await player(db);
  let r = await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-aaaa', xp: 150, name: 'Mara Venn' });
  assert.deepEqual(r, { character: 'char-aaaa', xp: 150, level: 2, credited: 150, rose: true });
  r = await reportRenownXp({ db, nowS: T0 + 1 }, P, { character: 'char-aaaa', xp: 50 });
  assert.deepEqual(r, { character: 'char-aaaa', xp: 200, level: 2, credited: 50, rose: false }, 'no new level, no rise');
  // the hour, across two characters: 200 + 5000*3 + (the rest) = RENOWN_XP_HOUR_MAX
  for (let i = 0; i < 3; i++) assert.equal((await reportRenownXp({ db, nowS: T0 + 2 + i }, P, { character: 'char-bbbb', xp: 5000 })).credited, 5000);
  r = await reportRenownXp({ db, nowS: T0 + 9 }, P, { character: 'char-bbbb', xp: 5000 });
  assert.equal(r.credited, RENOWN_XP_HOUR_MAX - 200 - 15000, 'the rest of the ACCOUNT\'s hour, not a fresh allowance for a second character');
  r = await reportRenownXp({ db, nowS: T0 + 10 }, P, { character: 'char-aaaa', xp: 100 });
  assert.deepEqual([r.credited, r.xp], [0, 200], 'the hour is spent: credited nothing, answered');
  r = await reportRenownXp({ db, nowS: T0 + 3600 }, P, { character: 'char-aaaa', xp: 100 });
  assert.equal(r.credited, 100, 'the next clock hour is a new window');
  // the tracks, the card's order, the names
  const cards = await renownTracksOf({ db }, P.id);
  assert.deepEqual(cards.map((t) => [t.character, t.name, t.level]), [['char-aaaa', 'Mara Venn', 3], ['char-bbbb', null, renownForXp(RENOWN_XP_HOUR_MAX - 200)]], 'most recently earned first; a report with no name keeps none');
  assert.deepEqual(await renownTrackOf({ db }, P.id, 'char-aaaa'), { xp: 300, level: 3 });
  assert.equal(await renownTrackOf({ db }, P.id, 'char-none'), null, 'a character that earned nothing has no track: level 1');
  assert.equal(renownNameOf('  Mara \n Venn '), 'Mara Venn');
  assert.equal(renownNameOf('x'.repeat(33)), null);
  assert.equal(renownNameOf(''), null);
  // the cap: a track at RENOWN_XP_MAX earns nothing and spends none of the hour
  const Q = await player(db);
  db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(Q.id, 'char-capp', 'Old', RENOWN_XP_MAX - 10, T0, T0);
  r = await reportRenownXp({ db, nowS: T0 + 7200 }, Q, { character: 'char-capp', xp: 500 });
  assert.deepEqual([r.xp, r.level, r.credited, r.rose, r.max], [RENOWN_XP_MAX, 50, 10, true, true], 'the last ten, and the top level');
  r = await reportRenownXp({ db, nowS: T0 + 7201 }, Q, { character: 'char-capp', xp: 500, name: 'New' });
  assert.deepEqual([r.xp, r.credited, r.rose, r.max], [RENOWN_XP_MAX, 0, false, true]);
  assert.equal(db._raw.prepare('SELECT renown_hour_xp AS n FROM players WHERE id = ?').get(Q.id).n, 10, 'the hour paid only the ten the track could take, and nothing at the cap');
  assert.equal((await renownTracksOf({ db }, Q.id))[0].name, 'New', 'but it is still the character last played');
});

test('RENOWN1 the service\'s refusals and the race: a character id outside the saves\' shape, an amount outside 1..RENOWN_XP_REPORT_MAX, a new character past RENOWN_TRACKS_MAX; two reports in flight at once never spend the same remainder (mutants: a report of 0 or a fraction taken; the tracks unbounded; read-then-write)', async () => {
  const db = d1();
  const P = await player(db);
  for (const c of ['x', 'a b c d', '', null, 42]) assert.deepEqual(await reportRenownXp({ db, nowS: T0 }, P, { character: c, xp: 10 }), { error: 'renown-character' });
  for (const xp of [0, -1, 1.5, '10', RENOWN_XP_REPORT_MAX + 1, null]) assert.deepEqual(await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-aaaa', xp }), { error: 'renown-xp' });
  for (let i = 0; i < RENOWN_TRACKS_MAX; i++) db._raw.prepare('INSERT INTO renown_tracks (player, char_id, xp, created_at, updated_at) VALUES (?, ?, 0, ?, ?)').run(P.id, `char-${String(i).padStart(4, '0')}`, T0, T0);
  assert.deepEqual(await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-new1', xp: 10 }), { error: 'renown-full' });
  assert.equal((await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-0003', xp: 10 })).credited, 10, 'a character it already keeps still earns');
  // the race: two reports at once against 20,000 - between them, exactly what the hour has left
  const R = await player(db);
  const both = await Promise.all([15000, 15000].map((xp, i) => reportRenownXp({ db, nowS: T0 + 60 }, R, { character: `char-rac${i}`, xp: Math.min(xp, RENOWN_XP_REPORT_MAX) })));
  const more = await Promise.all([1, 2, 3].map(() => reportRenownXp({ db, nowS: T0 + 61 }, R, { character: 'char-rac0', xp: RENOWN_XP_REPORT_MAX })));
  const credited = [...both, ...more].reduce((a, r) => a + r.credited, 0);
  assert.equal(credited, RENOWN_XP_HOUR_MAX, 'five reports racing: the hour, exactly');
  for (const w of ['renown-character', 'renown-xp', 'renown-full']) assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
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

test('RENOWN1 the worker: /v1/renown/xp behind a session, the account the session\'s - a rise answers a SIGNED renown order, a report that did not rise answers none; the token names the character\'s level when the mint names a character (1 before it earns), none when it names none; /v1/account carries the tracks (mutants: the route open to strangers; the order minted for a non-rise; the level off the body)', async (t) => {
  const clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { call, kp } = await stand();
  assert.ok(ROUTES.has('/v1/renown/xp') && !OPEN_ROUTES.has('/v1/renown/xp'));
  const me = (await call('POST', '/v1/auth/guest', {})).body;
  assert.equal((await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 10 })).status, 401, 'a stranger earns nothing');
  assert.equal((await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 0 }, me.secret)).status, 400);
  // the token before any XP: level 1 for a named character; no level for none
  let tok = (await call('POST', '/v1/auth/token', { character: 'char-aaaa', level: 50, lv: 50 }, me.secret)).body;
  assert.equal(tok.level, 1, 'the level is the track\'s, never the body\'s: a character that earned nothing is level 1');
  const pub = kp.publicKey;
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, 1);
  tok = (await call('POST', '/v1/auth/token', {}, me.secret)).body;
  assert.equal(tok.level, null);
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, undefined, 'an older build\'s mint carries no level');
  tok = (await call('POST', '/v1/auth/token', { character: 'not an id!' }, me.secret)).body;
  assert.equal(tok.level, null, 'a character outside the shape is no character');
  // a rise: the order, verified with the service's key as a RENOWN order and never as a mute
  let r = (await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 5000, name: 'Mara', level: 50 }, me.secret)).body;
  assert.deepEqual([r.xp, r.level, r.credited, r.rose], [5000, 9, 5000, true], 'the level is the service\'s, whatever the body says');
  const ord = await verifyOrder(r.order, pub, { subtle, nowS: T0, kind: 'renown' });
  assert.ok(ord.ok);
  assert.deepEqual([ord.claims.o, ord.claims.s, ord.claims.lv], ['renown', me.id, 9]);
  assert.equal((await verifyOrder(r.order, pub, { subtle, nowS: T0, kind: 'mute' })).ok, false, 'a renown order carried to the mute\'s door is refused there');
  r = (await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 1 }, me.secret)).body;
  assert.deepEqual([r.rose, r.order], [false, null], 'no rise, no order');
  // the next token carries the level the track has now
  tok = (await call('POST', '/v1/auth/token', { character: 'char-aaaa' }, me.secret)).body;
  assert.equal(tok.level, 9);
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, 9);
  const acct = (await call('GET', '/v1/account', undefined, me.secret)).body.account;
  assert.deepEqual(acct.renown.map((x) => [x.character, x.name, x.xp, x.level]), [['char-aaaa', 'Mara', 5001, 9]]);
  assert.equal(RENOWN_CARD_TRACKS, 5);
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct11"/);   // acct9 on the branch; main's FOUNDER2 took acct9; WB5b's gates closed moved it on (acct11)
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/renown\.js"/, 'the Worker bundles the curve, so a change to it deploys');
});

// ── THE TOKEN, THE ORDER, THE WIRE ──────────────────────────────────

test('RENOWN1 the token and the order: `lv` optional and within 1..50 when there; a renown order carries `lv` and never `mu`, a mute order `mu` and never `lv`; verifyOrder asks for its KIND by name and refuses the other (mutants: a level of 0 or 51 signed; a renown order read as an unmute; a kind unnamed trusted)', async () => {
  const id = { s: 'acct-mara', n: 'Mara', k: 'guest', i: T0, e: T0 + 60 };
  assert.ok(claimsValid(id), 'no level: an older mint');
  assert.ok(claimsValid({ ...id, lv: 1 }));
  assert.ok(claimsValid({ ...id, lv: 50 }));
  for (const lv of [0, 51, 1.5, '9', null]) assert.equal(claimsValid({ ...id, lv }), false, `lv ${lv}`);
  assert.equal(renownIssuable(12), true);
  assert.deepEqual([...ORDER_KINDS], ['mute', 'renown']);
  const lvOrder = { o: 'renown', s: 'acct-mara', lv: 9, i: T0, e: T0 + 30 };
  assert.ok(orderValid(lvOrder));
  assert.equal(orderValid({ ...lvOrder, mu: 0 }), false, 'a renown order carrying a mute is neither');
  assert.equal(orderValid({ ...lvOrder, lv: 51 }), false);
  assert.equal(orderValid({ o: 'mute', s: 'acct-mara', mu: 0, lv: 9, i: T0, e: T0 + 30 }), false, 'a mute carrying a level is neither');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-mara', n: 'Mara', k: 'guest', lv: 12 }, kp.privateKey, { subtle, nowS: T0 });
  assert.equal((await verifyToken(tok, kp.publicKey, { subtle, nowS: T0 })).claims.lv, 12);
  const plain = await mintToken({ s: 'acct-mara', n: 'Mara', k: 'guest' }, kp.privateKey, { subtle, nowS: T0 });
  assert.equal((await verifyToken(plain, kp.publicKey, { subtle, nowS: T0 })).claims.lv, undefined, 'no level: the bytes it always minted');
  await assert.rejects(mintToken({ s: 'acct-mara', n: 'Mara', k: 'guest', lv: 0 }, kp.privateKey, { subtle, nowS: T0 }), /refused/);
  const order = await mintRenownOrder({ s: 'acct-mara', lv: 9 }, kp.privateKey, { subtle, nowS: T0 });
  const mute = await mintOrder({ s: 'acct-mara', mu: 0 }, kp.privateKey, { subtle, nowS: T0 });
  assert.ok((await verifyOrder(order, kp.publicKey, { subtle, nowS: T0, kind: 'renown' })).ok);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: T0, kind: 'mute' })).ok, false, 'THE HOLE THIS SHUTS: a player\'s own renown order carried as a mute would have read as `mu` undefined - an unmute');
  assert.equal((await verifyOrder(mute, kp.publicKey, { subtle, nowS: T0, kind: 'renown' })).ok, false);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: T0 })).ok, false, 'no kind named, nothing verified');
  await assert.rejects(mintRenownOrder({ s: 'acct-mara', lv: 0 }, kp.privateKey, { subtle, nowS: T0 }), /refused/);
});

test('RENOWN1 the wire: `badged` stamps `lv` beside the badge only within the bound, `readRenown` reads it back; the renown frame is its own arm after the hello with a bounded order; world108 is the first relay that knows it; one a second (mutants: a level out of bounds stamped; the frame before the hello; an old relay trusted)', () => {
  assert.deepEqual(badged({ id: 'a' }, { lv: 12 }), { id: 'a', lv: 12 });
  assert.deepEqual(badged({ id: 'a' }, { lv: 0 }), { id: 'a' });
  assert.deepEqual(badged({ id: 'a' }, { lv: 51 }), { id: 'a' });
  assert.deepEqual(badged({ id: 'a' }, { title: 'founder', lv: 3 }), { id: 'a', title: 'founder', lv: 3 });
  assert.equal(readRenown({ lv: 7 }), 7);
  for (const lv of [0, 51, '7', 7.5, null]) assert.equal(readRenown({ lv }), null);
  assert.equal(readRenown(null), null);
  assert.deepEqual(parseClient('{"t":"renown","order":"v1.a.b"}', { hasHello: true }), { t: 'renown', order: 'v1.a.b' });
  assert.deepEqual(parseClient('{"t":"renown","order":"v1.a.b"}', { hasHello: false }), { error: 'renown before hello' });
  assert.deepEqual(parseClient('{"t":"renown"}', { hasHello: true }), { error: 'bad renown' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'renown', order: 'x'.repeat(1025) }), { hasHello: true }), { error: 'bad renown' });
  assert.equal(RELAY_VERSION, 'world113');   // WB3 and AUDIT WB moved it on (world113 - world110 and world111 on their branch); PARTY-TRAVEL before them (world112); RENOWN1 was world111 - world108 on the branch; main's HT-WAIST-NET, PROFILE2/SKIN2 and EVENT1 took world108-110
  assert.equal(RENOWN_RELAY_MIN, 111);
  assert.equal(relaySupportsRenown('world111'), true);
  assert.equal(relaySupportsRenown('world110'), false);
  assert.equal(relaySupportsRenown(null), false);
  assert.equal(RENOWN_HZ_MAX, 1);
  const g1 = renownGate(null, 1000);
  assert.equal(g1.pass, true);
  assert.equal(renownGate(g1.bucket, 1100).pass, false);
});

// ── THE RELAY ───────────────────────────────────────────────────────

test('RENOWN1 the relay: the hello\'s token level rides the welcome\'s rows and the join in a PLACE room, where a name is drawn over a head; a renown order is taken ONLY from a socket whose account it names, and only as a RISE - fanned to the room, the carrier included; the same level again, or an older lower one, is answered to its carrier alone and fans nothing; one naming another account, one forged and a mute order at the level\'s door all do nothing; in a channel a renown order is nothing at all, and a renown order at the mute\'s door is no unmute (mutants: a renown order carried for somebody else; the mute arm reading a renown order as an unmute; a join stamped without its level; a level that does not rise fanned; a renown order taken in a channel)', async () => {
  // AUDIT RENOWN1 UI-2: this drove the world CHANNEL, where no name is drawn - and where no renown order is taken since
  const r = fakeRoom('town:m11');
  const mara = r.connect(); await r.hello(mara, 'mara-0001', null, { lv: 7 });
  const bob = r.connect(); await r.hello(bob, 'bobb-0002', null, { lv: 3 });
  const eve = r.connect(); await r.hello(eve, 'evee-0003');
  assert.equal(ofType(bob, 'welcome')[0].peers.find((p) => p.id === 'mara-0001').lv, 7, 'the welcome\'s row wears the signed level');
  assert.equal(ofType(mara, 'join').find((j) => j.id === 'bobb-0002').lv, 3, 'and so does the join');
  assert.equal(ofType(mara, 'join').find((j) => j.id === 'evee-0003').lv, undefined, 'a token with no level stamps none');
  assert.equal(mara.att.lv, 7);
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const carry = (ws, t, order) => r.room.webSocketMessage(ws, JSON.stringify({ t, order }));
  const aSecond = () => new Promise((res) => setTimeout(res, 1100));   // a socket's own gate, one order a second
  // Bob carries Mara's order: nothing - nobody carries another player's level
  await carry(bob, 'renown', await mintRenownOrder({ s: 'acct-mara-0001', lv: 9 }, kp.privateKey, { subtle, nowS }));
  assert.equal(ofType(mara, 'renown').length + ofType(bob, 'renown').length, 0);
  // Mara carries her own: the room hears it
  const nine = await mintRenownOrder({ s: 'acct-mara-0001', lv: 9 }, kp.privateKey, { subtle, nowS });
  await carry(mara, 'renown', nine);
  assert.deepEqual(ofType(bob, 'renown'), [{ t: 'renown', id: 'mara-0001', lv: 9 }]);
  assert.deepEqual(ofType(mara, 'renown'), [{ t: 'renown', id: 'mara-0001', lv: 9 }], 'the carrier too');
  assert.equal(mara.att.lv, 9, 'and the attachment keeps it for the next joiner\'s roster');
  // AUDIT RENOWN1 SEC-3/WIRE-1: the same order again, then an OLDER, lower one - neither is a rise
  await aSecond(); await carry(mara, 'renown', nine);
  await aSecond(); await carry(mara, 'renown', await mintRenownOrder({ s: 'acct-mara-0001', lv: 8 }, kp.privateKey, { subtle, nowS: nowS - 20 }));
  assert.equal(ofType(bob, 'renown').length, 1, 'the room hears no flap');
  assert.deepEqual(ofType(mara, 'renown').slice(1), [{ t: 'renown', id: 'mara-0001', lv: 9 }, { t: 'renown', id: 'mara-0001', lv: 9 }], 'the carrier is told, each time, the level the room holds');
  assert.equal(mara.att.lv, 9, 'an older order never lowers a level');
  // forged, and the wrong kind at the level's door
  await aSecond();
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  await carry(mara, 'renown', await mintRenownOrder({ s: 'acct-mara-0001', lv: 20 }, stranger.privateKey, { subtle, nowS }));
  await aSecond();
  await carry(mara, 'renown', await mintOrder({ s: 'acct-mara-0001', mu: 0 }, kp.privateKey, { subtle, nowS }));
  assert.equal(ofType(bob, 'renown').length, 1, 'a forged order and a mute order raise no level');
  assert.equal(ofType(mara, 'renown').length, 3, 'and answer nothing');
  // IN A CHANNEL (where a mute is heard): the mute's door takes no renown order as an unmute, and nothing takes a renown order
  const c = fakeRoom(CHAT_WORLD_ROOM);
  const ckp = await c.signer();
  const troll = c.connect(); await c.hello(troll, 'trol-0003', null, { mu: nowS + 600, lv: 4 });
  const listener = c.connect(); await c.hello(listener, 'lstn-0004');
  await c.room.webSocketMessage(troll, JSON.stringify({ t: 'mute', order: await mintRenownOrder({ s: 'acct-trol-0003', lv: 5 }, ckp.privateKey, { subtle, nowS }) }));
  assert.equal(ofType(troll, 'muted').filter((m) => m.until === 0).length, 0, 'no unmute');
  await c.chat(troll, 'free?');
  assert.equal(ofType(listener, 'chat').length, 0, 'still muted');
  await c.room.webSocketMessage(troll, JSON.stringify({ t: 'renown', order: await mintRenownOrder({ s: 'acct-trol-0003', lv: 5 }, ckp.privateKey, { subtle, nowS }) }));
  assert.equal(ofType(listener, 'renown').length + ofType(troll, 'renown').length, 0, 'AUDIT RENOWN1 WIRE-1: a channel of two thousand hears no level, and draws none');
  assert.equal(troll.att.lv, 4);
});

// ── THE CLIENT ──────────────────────────────────────────────────────

test('RENOWN1 the session: a peer\'s level off the welcome, the join and a renown frame, which only ever raises it; mine off the service\'s answer; `renownOf` by id; a renown order is KEPT and goes down each socket once ITS OWN welcome names a relay that knows the frame, on its own gate, and again until that room answers with the level (mutants: a renown frame for a peer I do not hold standing one; an order sent to world107; a session-wide flag; a rise lost to the gate; an answered room sent again)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock });
  s.join('world:2,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', lv: 12 }, { id: 'eve-0003', name: 'Eve', lv: 99 }], n: 3, v: 'world110' });
  assert.equal(s.renownOf('bob-0002'), 12);
  assert.equal(s.renownOf('eve-0003'), null, 'a level outside the bound is none');
  ws.receive({ t: 'renown', id: 'bob-0002', lv: 13 });
  assert.equal(s.renownOf('bob-0002'), 13);
  ws.receive({ t: 'renown', id: 'bob-0002', lv: 11 });
  assert.equal(s.renownOf('bob-0002'), 13, 'AUDIT RENOWN1: a late frame from a slower room never steps a level back');
  ws.receive({ t: 'renown', id: 'ghost-0009', lv: 13 });
  assert.equal(s.peers.has('ghost-0009'), false, 'a level for a peer I do not hold stands nobody');
  ws.receive({ t: 'renown', id: 'bob-0002', lv: 0 });
  assert.equal(s.renownOf('bob-0002'), 13, 'a malformed frame changes nothing');
  assert.equal(s.adoptIdentity({ name: 'Mac', level: 4 }), true);
  assert.equal(s.renownOf('mac-0001'), 4);
  const renownSent = (w) => w.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'renown');
  assert.equal(s.sendRenownOrder('v1.a.b', 5), false, 'a world110 relay would close the socket on the frame');
  assert.equal(s.renownOf('mac-0001'), 5, 'but the level is mine either way');
  // AUDIT RENOWN1 WIRE-2/WIRE-3: the order was KEPT, and goes the moment this socket's own welcome names world111
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world111' });
  assert.deepEqual(renownSent(ws), [{ t: 'renown', order: 'v1.a.b' }]);
  // a second rise inside the second: the gate holds it - it is not lost, it goes on a tick
  assert.equal(s.sendRenownOrder('v1.a.c', 6), false, 'one a second, as the relay takes them');
  clock += 1000; s.tick();
  assert.deepEqual(renownSent(ws).at(-1), { t: 'renown', order: 'v1.a.c' }, 'the rise the gate held went on the next tick');
  // unanswered, it goes again after RENOWN_RESEND_MS - answered, never again
  clock += 1000; s.tick();
  assert.equal(renownSent(ws).length, 2, 'not before RENOWN_RESEND_MS');
  clock += 2500; s.tick();
  assert.equal(renownSent(ws).length, 3, 'again, unanswered');
  ws.receive({ t: 'renown', id: 'mac-0001', lv: 6 });
  clock += 10_000; s.tick();
  assert.equal(renownSent(ws).length, 3, 'the room answered with the level: nothing more goes down this socket');
  assert.equal(s.renownOf('mac-0001'), 6);
  ws.receive({ t: 'renown', id: 'mac-0001', lv: 5 });
  assert.equal(s.renownOf('mac-0001'), 6, 'my own echo never steps my level back either');
  // a HALO whose welcome has not come gets nothing; its welcome brings the kept order
  s.setHalo(['world:3,12']);
  const halo = sockets[1];
  halo.open();
  s.tick();
  assert.deepEqual(renownSent(halo), [], 'no word from this socket\'s relay yet');
  halo.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world111' });
  assert.deepEqual(renownSent(halo), [{ t: 'renown', order: 'v1.a.c' }], 'the rise this room never heard');
  // past its keeping the order is dropped, and nothing more is sent
  clock += 60_000; s.tick();
  assert.equal(renownSent(halo).length, 1);
  assert.equal(s.sendRenownOrder('', 7), false);
});

test('RENOWN1 the client\'s calls: the minter names the character it is bringing online and hands the signed level back; the report goes as a POST with the bearer and nothing with no session (mutants: the character unnamed; the level dropped from the answer)', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push({ url, init }); return { ok: true, status: 200, json: async () => (url.endsWith('/v1/auth/token') ? { token: 'v1.t.s', name: 'Mac', kind: 'guest', title: null, glyphs: [], level: 7 } : { character: 'char-aaaa', xp: 10, level: 1, credited: 10, rose: false, order: null }) }; };
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Mac', kind: 'guest', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' })]]);
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const issued = [];
  const mint = accountTokenMinter({ fetch, storage, onIssued: (w) => issued.push(w), character: () => 'char-aaaa' });
  assert.equal(await mint(), 'v1.t.s');
  assert.deepEqual(JSON.parse(sent[0].init.body), { character: 'char-aaaa' });
  assert.equal(issued[0].level, 7);
  const plain = accountTokenMinter({ fetch, storage });
  await plain();
  assert.deepEqual(JSON.parse(sent[1].init.body), {}, 'no character: the mint every older build made');
  const thrower = accountTokenMinter({ fetch, storage, character: () => { throw new Error('boom'); } });
  assert.equal(await thrower(), 'v1.t.s', 'a seam that throws costs the level, never the hello');
  const renown = accountRenown({ fetch, storage });
  const r = await renown.report('char-aaaa', 10, 'Mara');
  assert.equal(r.ok, true);
  assert.match(sent.at(-1).url, /\/v1\/renown\/xp$/);
  assert.equal(sent.at(-1).init.headers.authorization, 'Bearer SECRETSECRETSECRETSECRET');
  assert.deepEqual(JSON.parse(sent.at(-1).init.body), { character: 'char-aaaa', xp: 10, name: 'Mara' });
  m.clear();
  assert.deepEqual(await accountRenown({ fetch, storage }).report('char-aaaa', 10), { ok: false, error: 'no-session' });
});

test('RENOWN1 a foe you fought: it pays once when it dies within RENOWN_ASSIST_MS of a blow of yours, whoever struck last; a foe you never struck, or struck too long ago, pays nothing; a handler that throws is contained; the level is the entity\'s, or an outdoor copy\'s built level (mutants: the window unread; paid twice; any death paying)', () => {
  _resetRenownKillsForTests();
  const paid = [];
  setRenownKillHandler((f) => paid.push(f.id));
  const a = { id: 'a', entity: { level: 6 } }, b = { id: 'b', builtLevel: 4 }, c = { id: 'c' };
  renownFoeStruck(a, 1000);
  assert.equal(renownFoeDied(a, 1000 + RENOWN_ASSIST_MS), true, 'at the edge of the window: mine');
  assert.equal(renownFoeDied(a, 1000 + RENOWN_ASSIST_MS), false, 'once');
  renownFoeStruck(b, 1000);
  assert.equal(renownFoeDied(b, 1001 + RENOWN_ASSIST_MS), false, 'a blow too long ago: not my fight any more');
  assert.equal(renownFoeDied(c, 1000), false, 'never struck');
  renownFoeStruck(c, 5000);
  renownFoeStruck(c, 9000);
  assert.equal(renownFoeDied(c, 9000 + RENOWN_ASSIST_MS), true, 'the NEWEST blow counts');
  assert.deepEqual(paid, ['a', 'c']);
  setRenownKillHandler(() => { throw new Error('boom'); });
  const d = { id: 'd' };
  renownFoeStruck(d, 0);
  const err = console.error; console.error = () => {};
  try { assert.equal(renownFoeDied(d, 1), true, 'a throwing handler is contained'); } finally { console.error = err; }
  assert.equal(renownFoeLevel(a), 6);
  assert.equal(renownFoeLevel(b), 4);
  assert.equal(renownFoeLevel(c), 1);
  _resetRenownKillsForTests();
  // THE DOORS: my blow stamps and every death asks - in both foe pools, a copy's death included; the watch never
  const ex = src('src/scenes/exteriorFoes.js'), dg = src('src/scenes/dungeonContext.js'), cg = src('src/scenes/cityGuards.js');
  assert.match(ex, /if \(f\.dead\) return;[^\n]*\n\s+if \(fromPlayer && !peer\) renownFoeStruck\(f\);/, 'the outdoor door stamps my blow before a puppet\'s divert');
  assert.match(ex, /f\.dead = true;\n\s+renownFoeDied\(f\);\s+\/\/ RENOWN1: whoever struck last/);
  assert.match(ex, /function puppetDie\(f\) \{[\s\S]{0,400}?f\.dead = true;\n\s+renownFoeDied\(f\);/, 'an owner\'s foe that fell');
  assert.match(dg, /if \(foe\.dead\) return;\n\s+if \(fromPlayer && !peer\) renownFoeStruck\(foe\);/, 'the dungeon door stamps a joiner\'s blow before the divert');
  assert.match(dg, /foe\.dead = true;\n\s+renownFoeDied\(foe\);/);
  assert.match(dg, /if \(r\.d === 1\) \{ if \(!f\.dead\) \{[^}]*renownFoeDied\(f\); \}/, 'a joiner\'s copy that the host\'s frame says fell');
  assert.doesNotMatch(cg, /renownFoe/, 'the city watch pays nothing: the law calls it murder');
});

test('RENOWN1 the tracker: nothing is earned while not earning (offline); a report carries at most RENOWN_XP_REPORT_MAX, is due every RENOWN_REPORT_MS or at once when a report\'s worth piles up; a lost report keeps what it held, an answered one gives its word, a permanent refusal stops the page (mutants: offline XP kept; the held XP dropped on a network error; a refused report retried forever)', async () => {
  let t = 0, online = false, answer = { ok: true, data: { level: 2, credited: 100, rose: true } };
  const sent = [], told = [], stops = [];
  const k = createRenownTracker({
    report: async (c, xp, name) => { sent.push([c, xp, name]); return answer; },
    character: () => 'char-aaaa', name: () => 'Mara', earning: () => online, now: () => t,
    onAnswer: (d, n) => told.push([d.level, n]), onStop: (e) => stops.push(e),
  });
  assert.equal(k.earn(100), 0, 'offline earns nothing');
  online = true;
  assert.equal(k.earn(100), 100);
  assert.equal(k.due(t), true, 'the first report is due at once');
  await k.tick(t);
  assert.deepEqual(sent, [['char-aaaa', 100, 'Mara']]);
  assert.deepEqual(told, [[2, 100]]);
  assert.equal(k.pending(), 0);
  k.earn(50);
  t += RENOWN_REPORT_MS - 1;
  assert.equal(k.due(t), false, 'a minute between reports');
  k.earn(RENOWN_XP_REPORT_MAX);
  assert.equal(k.due(t), true, 'unless a report\'s worth has piled up');
  answer = { ok: false, error: 'offline' };
  await k.flush(t);
  assert.equal(sent.at(-1)[1], RENOWN_XP_REPORT_MAX, 'one report\'s worth at most');
  assert.equal(k.pending(), RENOWN_XP_REPORT_MAX + 50, 'the network lost it: kept for the next');
  answer = { ok: false, error: 'renown-full' };
  t += RENOWN_REPORT_MS;
  await k.tick(t);
  assert.deepEqual(stops, ['renown-full']);
  assert.equal(k.stopped(), true);
  assert.equal(k.earn(10), 0, 'a refused character earns nothing more this page');
  // the world host's wiring (pinned by source: the host is not driveable in node)
  const w = src('src/scenes/world.js');
  assert.match(w, /const renownTracker = onlineOn \? createRenownTracker\(/, 'never built offline');
  assert.match(w, /setRenownKillHandler\(\(foe\) => \{ const party = 1 \+ \(partyNear\(\)\?\.length \?\? 0\); const xp = renownPartyXp\(renownKillXp\(renownFoeLevel\(foe\), renownNow\), Number\.isInteger\(foe\?\._fightN\) \? Math\.min\(party, foe\._fightN\) : party\); renownTracker\.earn\(xp\); sigilDrinks\(xp\); \}\);/, 'a kill with my party in the room counted - AUDIT PSCALE1 PLAY-4: no more of it than fought a shared foe');
  assert.match(w, /const xp = renownQuestXp\(playerEntity\.level, renownNow\);[^\n]*\n\s*renownTracker\.earn\(xp\);/, 'a quest by the character\'s level (RENOWN3: read against its Renown)');
  assert.match(w, /renownQuestEnded\?\.\(q\);/, 'the bridge\'s end reaches it');
  assert.match(w, /if \(!q\?\.questSuccess\) return;/, 'a failure pays nothing');
  assert.match(w, /renownTracker\?\.tick\(\);/);
  assert.match(w, /addEventListener\?\.\('pagehide', \(\) => \{ renownTracker\.leave\(\); \}\);/, 'what is held goes with the page (AUDIT RENOWN1 GAME-8: by keepalive, under its own id)');
  assert.match(w, /online\?\.sendRenownOrder\?\.\(/, 'a rise is carried to my rooms');
});

// ── THE LAYER ───────────────────────────────────────────────────────

const liveEntity = () => {
  const e = { maxHealth: 80, health: 60, maxMagicka: 0, magicka: 50, career: { abilityFlagsAndSpellPointsBitfield: 0x1000 }, stats: { intelligence: 50 } };
  defineLiveMaxHealth(e);
  defineLiveMaxMagicka(e);
  return e;
};

test('RENOWN1 the layer: "On top" - both live maximums read the level\'s bonus over everything they already sum, health and magicka keep their FRACTION as it goes on, rises and comes off; a level-up adds to the stored health and never the layer; the lycanthrope\'s limiter caps Daggerfall\'s own maximum and the layer rides above it; 0 stays 0 (mutants: the bonus in the stored value; current health left behind; the fraction lost)', () => {
  const e = liveEntity();
  assert.deepEqual([e.maxHealth, e.health, e.maxMagicka, e.magicka], [80, 60, 50, 50]);
  assert.deepEqual(setRenownLayer(e, 12), { hp: 33, mp: 22 });
  assert.deepEqual([e.maxHealth, e.health, e.maxMagicka, e.magicka], [113, 85, 72, 72], 'three quarters stays three quarters; full stays full');
  assert.equal(e.rawMaxHealth, 80, 'the stored health never takes the layer');
  e.maxHealth = e.rawMaxHealth + 10;   // a Daggerfall level-up (advancement.js adds to the raw value)
  assert.deepEqual([e.rawMaxHealth, e.maxHealth], [90, 123], 'the layer rides on top of the new stored value');
  e.maxHealthLimiter = 70;   // the unsated urge
  assert.equal(e.maxHealth, 103, 'AUDIT RENOWN1 GAME-4: the limiter caps Daggerfall\'s own maximum (70 of 90), and the layer rides above it - it capped the whole, and took the layer away');
  e.maxHealthLimiter = 0;
  setRenownLayer(e, null);
  assert.deepEqual([e.maxHealth, e.maxMagicka, renownHpOf(e), renownMpOf(e)], [90, 50, 0, 0], 'off: exactly Daggerfall\'s own');
  e.health = 0;
  setRenownLayer(e, 50);
  assert.equal(e.health, 0, 'a scale never raises the dead');
  assert.equal(keepFraction(1, 200, 90), 1, 'nor rounds the living to 0');
  assert.equal(keepFraction(50, 50, 72), 72);
  e.maxMagickaModifier = -10_000_000;   // a magery that makes the character unable
  assert.equal(e.maxMagicka, 0, 'the floor still holds: the bonus does not cast through "unable"');
});

test('RENOWN1 the save: a save written online is the save the character would have written offline - the stored maximum health, and current health, magicka and maximum magicka taken back through the layer at their fraction; nothing of the layer rides (mutants: the layered health saved; the layered magicka maximum saved)', () => {
  const e = liveEntity();
  Object.assign(e, { name: 'Mara', level: 3, stats: { intelligence: 50 }, skills: [], items: [], spells: [], activeEffects: [] });
  setRenownLayer(e, 20);   // +57 health, +38 magicka
  e.health = e.maxHealth;
  e.magicka = Math.round(e.maxMagicka / 2);
  const snap = snapshotPlayer(e, {});
  assert.equal(snap.maxHealth, 80, 'the stored maximum');
  assert.equal(snap.health, 80, 'full online is full offline');
  assert.equal(snap.maxMagicka, 50);
  assert.equal(snap.magicka, 25, 'half is half');
  assert.equal('renownHp' in snap || 'renownMp' in snap, false, 'the layer itself is on no whitelist');
  assert.deepEqual(offlineVitals(e), { health: 80, magicka: 25, maxMagicka: 50 });
  setRenownLayer(e, null);
  const off = snapshotPlayer(e, {});
  assert.equal(off.health, 80, 'with no layer, the entity\'s own');
});

// ── THE LEVEL LEFT OF THE NAME ──────────────────────────────────────

function fakeNode(tag, doc, ns = null) {
  const n = {
    tagName: tag.toUpperCase(), ns, children: [], parent: null, attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
    replaceChildren(...cs) { n.children.length = 0; n.append(...cs); },
    remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; },
    addEventListener() {}, focus() {},
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); } });
  n.style = {};
  n.dataset = {};
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (t) => fakeNode(t, doc);
  doc.createElementNS = (ns, t) => fakeNode(t, doc, ns);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  return doc;
}
const find = (n, cls) => { if ((n.className ?? '').split(' ').includes(cls)) return n; for (const c of n.children ?? []) { const f = find(c, cls); if (f) return f; } return null; };

test('RENOWN1 over a head: the box stands FIRST in the name row - "12" in its box, left of the name - and a point with no level leaves it empty; the bitmap face leads its run with the number in brackets, so the whole label stays centred (mutants: the plate after the name; a level-less label with an empty plate taking a word)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, title: null, glyphs: [], lv: 12 }, { id: 'peer-0002', name: 'Eve', x: 300, y: 300, scale: 1, title: null, glyphs: [] }] });
  const tag = find(layer.tagFor('peer-0001').node, 'dfname-tag');
  assert.deepEqual(tag.children.map((c) => c.className), ['dfname-renown', 'dfname-who', 'dfname-glyphs']);
  assert.equal(tag.children[0].textContent, '12');
  assert.match(src('src/ui/nameLayer.js'), /\.dfname-renown \{[^}]*border: 1px solid rgba\(242, 196, 107, \.8\);/, 'a box: a full border round the number');
  assert.equal(tag.children[1].textContent, 'Mack');
  assert.equal(find(layer.tagFor('peer-0002').node, 'dfname-renown').textContent, '', 'no level, no words: the plate takes no room (:empty)');
  assert.match(src('src/ui/nameLayer.js'), /\.dfname-renown:empty \{ display: none; \}/);
  // the bitmap face: the run it measures and draws
  const drawn = [];
  const rp = Object.create(RemotePlayers.prototype);
  const font = { fnt: { fixedHeight: 8, glyphs: [], charWidth: () => 4 } };
  try {
    rp.drawNamePoints({ draw: (...a) => drawn.push(a) }, font, [{ id: 'p', name: 'Mack', x: 100, y: 100, scale: 1, title: null, glyphs: [], lv: 12 }], 1);
  } catch { /* a stub font may not draw - the source pin below holds the run */ }
  assert.match(src('src/net/remotePlayers.js'), /const lead = renownText\(n\.lv\);\n\s+const run = `\$\{lead \? `\[\$\{lead\}\] ` : ''\}\$\{marks \? `\$\{n\.name\} \$\{marks\}` : n\.name\}`;/, 'the run the label is centred on starts with the level, boxed in brackets');
  assert.match(src('src/net/remotePlayers.js'), /lv: e\.peer\.lv \?\? null,/, 'the point carries the peer\'s level to both faces');
});

test('RENOWN1 the Inspect card and the plaque: the level the relay stamped stands left of the name ("Renown N" on hover), never the card\'s own Daggerfall level; none for a peer with none (mutants: the plate after the name; the card\'s level read)', () => {
  const v = profileView({ name: 'Bran', peer: { lv: 12, title: null, glyphs: [] }, card: { level: 30, attrs: Array(8).fill(50), vitals: [1, 2, 3], look: null }, state: 'answered' });
  assert.equal(v.level, '12');
  assert.equal(v.levelTitle, 'Renown 12');
  assert.match(v.line, /^Level 30/, 'the Daggerfall level stays where it was, on its own line');
  assert.equal(profileView({ name: 'Bran', peer: {} }).level, null);
  const doc = fakeDocument();
  const w = createProfileWindow({ doc, win: { addEventListener() {}, removeEventListener() {} } });
  w.show('peer-0002', v);
  const nm = find(w.root, 'dfprofile-name');
  assert.deepEqual(nm.children.map((c) => c.className).slice(0, 2), ['dfprofile-renown', 'dfprofile-nametext']);
  assert.equal(nm.children[0].textContent, '12');
  assert.equal(nm.children[0].title, 'Renown 12');
  assert.match(src('src/scenes/world.js'), /const renown = online\?\.renownOf\?\.\(id\) \?\? null;[^\n]*\n\s+return \{ title: marks \? `\$\{name\} \$\{marks\}` : name, renown, subs:/, 'the plaque over a player is handed it BESIDE the name, never in its text');
});

test('RENOWN1 the main menu\'s account card: the level of the character most recently played online, left of the name, and a row for each of the five most recently played characters with how far into its level it is; an account with no track draws the heading it always drew (mutants: the oldest track\'s level; the heading changed for everyone)', () => {
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
  flow.stage = 'in';
  flow.account = { id: 'p1', name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy', playedS: 60, renown: [
    { character: 'char-aaaa', name: 'Mara Venn', xp: 6000, level: 10 },
    { character: 'char-bbbb', name: null, xp: 150, level: 2 },
  ] };
  card.paint();
  const h3 = card.root.all.find((n) => n.tag === 'h3');
  assert.deepEqual(h3.children.map((c) => [c.className, c.textContent]), [['acctrenown', '10'], ['acctname', 'Lattymoy']], 'the level of the character most recently played online, left of the name');
  assert.equal(h3.children[0].title, 'Renown 10 - Mara Venn', 'AUDIT RENOWN1 UI-10: and whose it is');
  const rows = card.root.all.filter((n) => n.className === 'acctval').map((n) => n.textContent);
  assert.ok(rows.includes('Mara Venn - Renown 10, 490 / 2,150 XP to Renown 11'), rows.join(' | '));
  assert.ok(rows.includes('A character - Renown 2, 50 / 130 XP to Renown 3'), 'a character whose name the service never heard');
  flow.account = { id: 'p1', name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy', playedS: 60 };
  card.paint();
  const plain = card.root.all.find((n) => n.tag === 'h3');
  assert.deepEqual([plain.textContent, plain.children.length], ['Lattymoy', 0], 'no track: the heading it always drew');
  assert.match(src('src/ui/enhancedStyle.js'), /\.card h3 \.acctrenown \{/, 'the chip\'s colour is the skin\'s sheet, never the card\'s');
});

// ── THE PLAQUE (RENOWN2) ────────────────────────────────────────────

function plaqueEl(tag, body) {
  const classes = new Set();
  const n = {
    tag, children: [], dataset: {}, attrs: {}, props: {}, title: '',
    style: { setProperty(k, v) { n.props[k] = v; } },
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    get textContent() { return n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.length = 0; if (v) n.children.push({ textContent: v, children: [] }); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { n.removed = true; const i = body.indexOf(n); if (i >= 0) body.splice(i, 1); },
  };
  return n;
}
const plaqueFind = (n, cls, out = []) => { if (n?.classList?.contains?.(cls)) out.push(n); for (const c of n?.children ?? []) plaqueFind(c, cls, out); return out; };

test('RENOWN2 the plaque: a player\'s Renown rides the hover frame BESIDE the title and is drawn as the number in a box on the title\'s first line, left of the name; the repaint guard sees it change; no Renown, no box (mutants: the Renown dropped from the frame; the signature blind to it; the box after the name)', async () => {
  const { resolveHover, frameSignature } = await import('../src/systems/worldHover.js');
  const { showWorldPlaque, destroyWorldPlaque } = await import('../src/ui/worldPlaque.js');
  const hit = { key: 'peer:mara-0001', distance: 1, reach: 3 };
  const named = (renown) => () => ({ title: 'Mara', renown, subs: [], actions: [{ id: 'inspect', label: 'Inspect' }], actionsUnlit: true });
  const f = resolveHover(hit, { name: named(12) });
  assert.equal(f.renown, 12);
  assert.equal(f.title, 'Mara', 'never in the title\'s text');
  assert.notEqual(frameSignature(f), frameSignature(resolveHover(hit, { name: named(13) })), 'a Renown that rose repaints');
  assert.equal(resolveHover(hit, { name: named(null) }).renown, undefined);
  assert.equal(resolveHover(hit, { name: named(0) }).renown, undefined, 'no level is no box');
  const body = [];
  globalThis.document = {
    createElement: (t) => plaqueEl(t, body),
    body: { append: (...cs) => { for (const c of cs) body.push(c); } },
    head: { append() {}, appendChild() {}, querySelector: () => null },
    querySelector: () => null, getElementById: () => null,
  };
  globalThis.location = { search: '?skin=enhanced&touch=off' };
  globalThis.window = { location: globalThis.location, matchMedia: () => ({ matches: false }) };
  destroyWorldPlaque();
  try {
    showWorldPlaque(f);
    const root = body.find((e) => e.classList?.contains?.('wplaque'));
    const line = plaqueFind(root, 'wplaque-titleline')[0];
    assert.equal(line.children[0].className, 'wplaque-renown', 'the box first');
    assert.equal(line.children[0].textContent, '12');
    assert.equal(line.children[1].textContent, 'Mara', 'then the name');
    showWorldPlaque(resolveHover(hit, { name: named(null) }));
    assert.equal(plaqueFind(root, 'wplaque-renown').length, 0, 'no Renown, no box');
    assert.equal(plaqueFind(root, 'wplaque-titleline')[0].textContent, 'Mara');
  } finally {
    destroyWorldPlaque();
    delete globalThis.document; delete globalThis.window; delete globalThis.location;
  }
  assert.match(src('src/ui/enhancedStyle.js'), /\.wplaque-renown \{[^}]*border: 1px solid rgba\(242, 196, 107, 0\.8\);/, 'the plaque\'s box is the one over their head');
});
