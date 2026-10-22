// RENOWN1 (2026-09-24, Mac: "What if the leveling system was something seperate unique to online but compatible"; asked:
// the online health and magicka "On top" of Daggerfall's, a long "Grind", offline earning "No" - "Plus having their
// level appear on the left side of character name and profile main menu + ingame profile"): THE RENOWN,
// DRIVEN. The curve and the rules (net/renown.js - RENOWN-ACCOUNT's three quarters of every source); the service's
// track over the real migrations - one a CHARACTER (RENOWN-CHAR, where RENOWN-ACCOUNT made it one an account), the
// hour's bound the ACCOUNT's across its characters and spent in one statement, the tracks' bound, the cap
// (server-account/src/renownTracks.js; test/server/renown_char.test.js holds the character's own law) - and its routes and the token's `lv`; the token's and the order's law (a renown order never passes at
// the mute's door); the relay stamping the level beside the name and taking a renown order only from the account it
// names; the client session reading both; the tracker's one rule for a kill (a foe pays whoever struck last, if a blow
// of mine is recent) and its report; the online layer on top of the live maximums and never in a save; and the level
// left of the name - over a head in both faces, on the Inspect card, on the main menu's account card and the plaque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { createGuest } from '../../server-account/src/accounts.js';
import { reportRenownXp, renownTracksOf, renownTrackOf, renownNameOf, RENOWN_CARD_TRACKS } from '../../server-account/src/renownTracks.js';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';
import {
  RENOWN_MAX, RENOWN_XP_MAX, renownXpFor, renownForXp, renownProgress, renownProgressText, renownText,
  renownKillXp, renownQuestXp, renownPartyXp, renownBonus, RENOWN_XP_REPORT_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX, RENOWN_REPORT_MS,
  RENOWN_KILL_XP_PER_LEVEL, RENOWN_KILL_LEVEL_MAX, RENOWN_PARTY_COUNT_MAX, RENOWN_HP_PER_LEVEL, RENOWN_MP_PER_LEVEL, renownRate,
} from '../../src/net/renown.js';
import {
  claimsValid, mintToken, verifyToken, orderValid, mintOrder, mintRenownOrder, verifyOrder, renownIssuable, ORDER_KINDS,
} from '../../src/net/identityToken.js';
import { badged, readRenown, parseClient, renownGate, RENOWN_HZ_MAX, relaySupportsRenown, RENOWN_RELAY_MIN, RELAY_VERSION, CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { accountTokenMinter, accountRenown, SESSION_KEY, REFUSALS } from '../../src/net/accountClient.js';
import { createRenownTracker, renownFoeStruck, renownFoeDied, renownFoeLevel, setRenownKillHandler, RENOWN_ASSIST_MS, _resetRenownKillsForTests } from '../../src/net/renownTracker.js';
import { setRenownLayer, offlineVitals, keepFraction, renownHpOf, renownMpOf } from '../../src/systems/renownLayer.js';
import { defineLiveMaxHealth, defineLiveMaxMagicka } from '../../src/systems/chargen.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { createNameLayer } from '../../src/ui/nameLayer.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { profileView, createProfileWindow } from '../../src/ui/profileWindow.js';
import { accountCard } from '../../src/ui/enhanced/enhancedAccount.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked
import { r2, seatRealm } from '../realmSeat.mjs';   // INT16: a Renown report is a progression claim, asked of the account's seated realm character

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
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

test('RENOWN1 the rules: a kill is ten to its foe\'s level (clamped 1..30) and a quest 100 + 40 a character level at the full rate - RENOWN-ACCOUNT pays three quarters of both (7.5 a foe level, 75 + 30 a character level); a party adds 10% a head beyond the first up to its eight seats; the online bonus is 3 health and 2 magicka a level past the first - level 1 adds nothing, level 50 adds 147 and 98 (mutants: a party that SPLITS the kill; the bonus from level 0; a clamp unread)', () => {
  // RENOWN3 reads both against the Renown; at the cap's Renown nothing is read lower, so these are the RENOWN1 rules
  // themselves at RENOWN-ACCOUNT's rate (test/net/renown3.test.js holds the ceiling, test/server/renown_account.test.js the rate)
  assert.equal(renownKillXp(1, RENOWN_MAX), 7);
  assert.equal(renownKillXp(20, RENOWN_MAX), 150);
  assert.equal(renownKillXp(0, RENOWN_MAX), renownRate(RENOWN_KILL_XP_PER_LEVEL), 'a foe with no level is a level-1 foe');
  assert.equal(renownKillXp(99, RENOWN_MAX), renownRate(RENOWN_KILL_XP_PER_LEVEL * RENOWN_KILL_LEVEL_MAX));
  assert.equal(renownQuestXp(1, RENOWN_MAX), 105);
  assert.equal(renownQuestXp(10, RENOWN_MAX), 375);
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
  assert.equal(RENOWN_XP_HOUR_MAX, 15000, 'RENOWN-ACCOUNT: a quarter off the 20,000, as every source');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

test('RENOWN1 the track: one row a character, the level DERIVED from its total; the hour\'s bound is the ACCOUNT\'s across all its characters and a new clock hour opens it again; a report the hour spent is credited 0, answered, never refused; the track stops at the cap without spending the hour; `rose` says a level rose (mutants: the bound per character; the window never reset; the cap unread; rose always)', async () => {
  const db = d1();
  const P = await player(db);
  let r = await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-aaaa', xp: 150, name: 'Mara Venn' });
  assert.deepEqual(r, { character: 'char-aaaa', xp: 150, level: 2, credited: 150, rose: true, room: RENOWN_XP_HOUR_MAX - 150 });   // SCALE4h (PIN MOVED): what the hour still takes
  r = await reportRenownXp({ db, nowS: T0 + 1 }, P, { character: 'char-aaaa', xp: 50 });
  assert.deepEqual(r, { character: 'char-aaaa', xp: 200, level: 2, credited: 50, rose: false, room: RENOWN_XP_HOUR_MAX - 200 }, 'no new level, no rise');
  // the hour, across two characters: 200 + 5000*2 + (the rest) = RENOWN_XP_HOUR_MAX (15,000 since RENOWN-ACCOUNT)
  for (let i = 0; i < 2; i++) assert.equal((await reportRenownXp({ db, nowS: T0 + 2 + i }, P, { character: 'char-bbbb', xp: 5000 })).credited, 5000);
  r = await reportRenownXp({ db, nowS: T0 + 9 }, P, { character: 'char-bbbb', xp: 5000 });
  assert.equal(r.credited, RENOWN_XP_HOUR_MAX - 200 - 10000, 'the rest of the ACCOUNT\'s hour, not a fresh allowance for a second character');
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
  // the race: two reports at once against 15,000 - between them, exactly what the hour has left
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
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };   // INT16: SAVES, so the reporter seats a realm character
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
  const { env, call, kp } = await stand();
  assert.ok(ROUTES.has('/v1/renown/xp') && !OPEN_ROUTES.has('/v1/renown/xp'));
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  // INT16 (Integrity-Arc section 7): a report is asked of the account's SEATED realm character - the guest seats one (A),
  // and the offline id this pin reported for is refused before the route reads a word
  const A = (await seatRealm(env, me.secret, 'Mara')).id;
  assert.deepEqual(await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 10 }, me.secret), { status: 403, body: { error: 'progress-seat' } }, 'INT16: an offline id earns nothing');   // PIN MOVED (INT16, Integrity-Arc section 7): this pin's offline id was credited; a report names the account's seated realm character now
  assert.equal((await call('POST', '/v1/renown/xp', { character: A, xp: 10 })).status, 401, 'a stranger earns nothing');
  assert.equal((await call('POST', '/v1/renown/xp', { character: A, xp: 0 }, me.secret)).status, 400);
  // the token before any XP: level 1 for a named character; no level for none
  let tok = (await call('POST', '/v1/auth/token', { character: A, level: 50, lv: 50 }, me.secret)).body;
  assert.equal(tok.level, 1, 'the level is the track\'s, never the body\'s: a character that earned nothing is level 1');
  const pub = kp.publicKey;
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, 1);
  tok = (await call('POST', '/v1/auth/token', {}, me.secret)).body;
  assert.equal(tok.level, null);
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, undefined, 'an older build\'s mint carries no level');
  tok = (await call('POST', '/v1/auth/token', { character: 'not an id!' }, me.secret)).body;
  assert.equal(tok.level, null, 'a character outside the shape is no character');
  // a rise: the order, verified with the service's key as a RENOWN order and never as a mute
  let r = (await call('POST', '/v1/renown/xp', { character: A, xp: 5000, name: 'Mara', level: 50 }, me.secret)).body;
  assert.deepEqual([r.xp, r.level, r.credited, r.rose], [5000, 9, 5000, true], 'the level is the service\'s, whatever the body says');
  const ord = await verifyOrder(r.order, pub, { subtle, nowS: T0, kind: 'renown' });
  assert.ok(ord.ok);
  assert.deepEqual([ord.claims.o, ord.claims.s, ord.claims.lv], ['renown', me.id, 9]);
  assert.equal((await verifyOrder(r.order, pub, { subtle, nowS: T0, kind: 'mute' })).ok, false, 'a renown order carried to the mute\'s door is refused there');
  r = (await call('POST', '/v1/renown/xp', { character: A, xp: 1 }, me.secret)).body;
  assert.deepEqual([r.rose, r.order], [false, null], 'no rise, no order');
  // the next token carries the level the track has now
  tok = (await call('POST', '/v1/auth/token', { character: A }, me.secret)).body;
  assert.equal(tok.level, 9);
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, 9);
  tok = (await call('POST', '/v1/auth/token', { character: 'char-bbbb' }, me.secret)).body;
  assert.equal((await verifyToken(tok.token, pub, { subtle, nowS: T0 })).claims.lv, 1, 'RENOWN-CHAR: another character of the account is its own track - RENOWN-ACCOUNT signed the account\'s in');
  const acct = (await call('GET', '/v1/account', undefined, me.secret)).body.account;
  assert.deepEqual(acct.renown.map((x) => [x.character, x.name, x.xp, x.level]), [[A, 'Mara', 5001, 9]]);
  assert.equal(RENOWN_CARD_TRACKS, 5);
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct168"/);   // PIN MOVED: acct168, STAFF-PANEL1 (the staff panel sign-in - a password, a key only the Staff Panel extension holds and the role lists; staff keys, invites, sessions and an append-only audit, migration 0144); PIN MOVED: acct167, CAKE-CAP-SAID (a festival find answers the cakes found that day, and capped once they are all found; the account festival answers them too; acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge); PIN MOVED: acct166, ESSENCE-LOOSE (Arcane Essence of a piece made of loose goods is loose, never gold, and the Reforge spends it; migration 0142) and SOUL-LAW (item law 9 - a soul of the Enemy Expansion fifty lawful in a Soul Gem or Azura Star; migration 0143 lifts the holds law 8 laid on one), one release; PIN MOVED: acct165, WITCH1 (the Witches Festival - Soul Cakes, the Wyrd Sister sales, the Hearth Offerings, the profile icon) and STAR7 (the fallen stars held - /v1/star/claim, the star_spoils and stars_held of migration 0141, the star under the combat cap), one release; PIN MOVED: acct164, LEAN-READS (LEAN-WITNESS, YARD-SNAP, VENDOR-BOARD, WRIT-BOARD, ARENA-BOARD and SLOW-SHED - a hall's and a seat's late answers read no more, a town's yards, a region's traders and a season's arena board each one row, the writs by owner, a slow database shed as an overloaded one; migrations 0135-0139; acct159, acct160, acct161, acct162 then acct163 and 0133-0137 then 0134-0138 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges); PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP (staff mend a purse below nothing - realm-mend, the hold it made lifted - and a death in the zone takes the packs at the side off the record, a tab that never says it reads them refused; acct162 on its branch, renumbered past the acct162 of NAME-WORDS at the merge); PIN MOVED: acct162, NAME-WORDS (the name filter reads two more words anywhere - a handle holding either is refused; migration 0134 renames the account that held them); PIN MOVED: acct161, JUNGLE-WOODS (a jungle pixel stands 48 trees a day, every slot a tree, the service counting them as the law does; acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges); PIN MOVED: acct160, WB14g (a kill receipt says its night portents, and a portent receipt rolls the Weir Key at the rite odds; acct159 on its branch, renumbered past the acct159 of QL12 at the merge); PIN MOVED: acct159, QL12 (the questlines claim - /v1/ql/claim, the five titles and the Covens Hoard key on the row; migration 0133; acct157 on its branch, renumbered past PLAN-1000 and FOE-BOUNDS, acct157 and acct158, at the merge); PIN MOVED: acct158, FOE-BOUNDS (cases from the relay count - records it stripped, asks past a budget; one line an account a batch; the Discord card says the spawn grants opened it); PIN MOVED: acct157, PLAN-1000 (PRIMARY-FOLD - the door reads in one statement, the spend one step over its row, a week kept, a chapter claim reads in one batch - and SESSION-SIGN, a pass on the hot routes; no migration; acct155 on its branch, renumbered past GRANT2 and TOWN-ECON TE2 at the merge); PIN MOVED: acct156, TOWN-ECON TE2 (the town economy share - /v1/towns/*, migration 0132; LAW-3 counterPaid in the item law); PIN MOVED: acct155, GRANT2 (the spawn grant measure kept - /v1/mod/grant-feed, /v1/mod/realm-grants; migration 0131); PIN MOVED: acct154, PRIVATE-REPORT (the private reports - /v1/report/*, a reader count on the post box; migration 0130 - acct152 then acct153, and 0126 then 0127, on its branch, renumbered past SAFE and INT16-INT19 at the merges); PIN MOVED: acct153, INT16-INT19 (the progression claims' seat and play line, the legacy record's law, a crafted piece out of its seller's record; migrations 0127 and 0128 - acct151 then acct152, and 0125 then 0126 and 0127, on its branch, renumbered past KEY-LAW and SAFE at the merges); PIN MOVED: acct152, SAFE (the chat safety arc and its audit - blocks, reports and cases, bans, the reviewer, Discord; migration 0126 - acct150 and 0125 on its branch, renumbered past WIKIMAID and KEY-LAW at the merge); PIN MOVED: acct151, KEY-LAW (item law 7 - the Weir Key's row known to the service's law, so a key holds no trade; migration 0125 - acct150 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: acct150, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren granted by name - titles.js WIKIMAID_HANDLES, no migration); PIN MOVED: acct149, EG-PLAY (the Elite Breach's Weir Keys, open, admission and claims, migration 0124 - 0112, 0113, 0114, 0116, 0117, 0119, 0120, 0121 then 0123 on its branch, renumbered past SEAT-FACTS' 0112, LAMP-KEEPER II's 0113, FIRMAMENT-ON's 0114, KG6's 0115, POI-1's 0116, SUMMON-REPAIR's 0117, PVP-ESCROW's 0118, SERPENT5's 0119, AUTO-HOLD's 0120, FIELD BUGS 2026-10-16b's 0121 and 0122 and MAKER-KEPT's 0123; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED, D1-LOAD, BAL9, NAME-AS, HACKED-GOLD, ETHER-NODES, AUDIT ETHER-OW, MINE-PERKS, HOMES-SHED, BUSY-GATE, CRAFT-PROCS, SCHOOLS5, RECOVERY-SET, REVIVE, LAMP-KEEPER II, KG6, POI-1 and SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME at the merges; acct141 at the fifth merge, renumbered past AUTO-HOLD, DECOR-BATCH, BOOKMARK-SPIRAL, BUSY-HEART and SHED-LONG at the sixth, then acct146, renumbered past STOLEN-GOODS AUDIT and REZ-BLOODLINE AUDIT R1 at the seventh, then acct148, renumbered past MAKER-KEPT at the eighth); PIN MOVED: acct148, MAKER-KEPT (item law 6 - a maker-era Aetheric piece keeps its maker's rows; migration 0123); PIN MOVED: acct147, REZ-BLOODLINE AUDIT R1 (the realm holds a Bloodline fall for a Resurrect of the party - the hold of realmDie, the new /v1/realm/raise and the rez-holds close each minute, legacy.js; migration 0121; acct141 on its branch, acct142 at the first merge, renumbered past the SHED-LONG acct145 of main at the second); PIN MOVED: acct146, STOLEN-GOODS AUDIT (a patron of a town takes no stolen piece off a hired trader - net/patronLaw.js patronTakes; no migration); PIN MOVED: acct145, SHED-LONG (BOOKMARK-SPIRAL rolled back, the shed 10 s - service.js, busyLaw.js; no migration); PIN MOVED: acct144, BUSY-HEART (the heartbeat and the motherlodes stand back while the database is overloaded - busyLaw.js; no migration); PIN MOVED: acct143, BOOKMARK-SPIRAL (the polled display reads with no bookmark off any instance, a missed session lookup asks the primary - service.js, accounts.js; no migration); PIN MOVED: acct142, DECOR-BATCH (a home room one request, a shunned home shop one more - decor.js; no migration); PIN MOVED: acct141, AUTO-HOLD (a copy locks its piece, never the character; the third law hold is timed - migration 0120; acct139 on its branch, renumbered past PRIMARY-TRIPS and AUDIT GUILD-WORDS at the merge); PIN MOVED: acct140, AUDIT GUILD-WORDS (a new membership recorded off the standing before a claim loss or after it, and every Roll answer saying what it paid of what was owed - npcRoll.js, no migration; acct139 on its branch, renumbered past PRIMARY-TRIPS acct139 at the merge); PIN MOVED: acct139, PRIMARY-TRIPS (the account primary round trips cut - the seats list, a checkpoint and a badge honours each one batch, the yards off a replica, a heartbeat reads before its beat, a hall bump off its own key rows; no migration); PIN MOVED: acct138, CART-AWAY (a wagon away from a death in the zone keeps its cargo - wild.js, no migration); PIN MOVED: acct137, SERPENT5 (Coilbreaker and The Maelstrom rolled on a dealing ship serpent kill first write - serpents.js, migration 0119; acct135 on its branch, renumbered past POI-1 acct135 and SUMMON-REPAIR acct136 of main at the merge); PIN MOVED: acct136, SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME (staff mend one realm character - a FactionFile flag bit cleared and gold given back as a letter of credit, once a ticket; bible/06-Systems/Integrity-Arc.md INT6; migration 0117, 0113 on its branch and 0114 on the integration; a killer worn piece held in escrow until collected - wild_escrow and three wild routes; bible/11-Multiplayer/Wild-Zone.md section 4; migration 0118, 0113 on its branch and 0115 on the integration; the layouts read names every home by its building, so no quest picks a player home in a town never walked into; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; no migration; acct133 on each branch, one bump past LAMP-KEEPER II at the merge, acct134 on the integration, renumbered past KG6 acct134 and POI-1 acct135 at the merge of main); PIN MOVED: acct135, POI-1 + POI-4b + AUDIT POI (the POI store and the library's shelf - builders draft, an approver decides, the feed is live revisions only; bible/06-Systems/POI-Editor-Arc.md; migration 0116 - acct133, then acct134, and 0113, then 0114, on its branch, renumbered past LAMP-KEEPER II's and KG6's at the merges); PIN MOVED: acct134, KG6 (The King's Gambit's season board and its Grandmaster - gambit.js, the escrow's King's Gambit arm in cards.js; migration 0115 (0114 on its branch, renumbered past main's FIRMAMENT-ON 0114 at the merge); acct133 on its branch, renumbered past LAMP-KEEPER II's acct133 at the merge); PIN MOVED: acct133, LAMP-KEEPER II (I Love Lamp laid on the row) - before it acct132, REVIVE (a death taken back holds - putLineage takes the stored copy revived stamps into every copy sent; bible/06-Systems/Legacy-Arc.md REVIVE; no migration); PIN MOVED: acct131, RECOVERY-SET (eight recovery codes, each spent alone, and a new set from the profile behind the password and one current code - /v1/account/recovery-codes, recoveryLeft on the account view; bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md RECOVERY-SET; no migration, the same column); PIN MOVED: acct130, SCHOOLS5 (the specialisation a save carries judged - a path the table holds, both its schools mastered; bible/06-Systems/Arcane-Specialisations.md section 7; no migration; acct127 on its branch, renumbered past HOMES-SHED, BUSY-GATE and CRAFT-PROCS at the merge); PIN MOVED: acct129, CRAFT-PROCS (a crafted piece record carries its mint version - stamped at the craft, kept by a temper, read by the market piece; no migration; acct126, acct127, then acct128, on its branch - renumbered past MINE-PERKS, HOMES-SHED and BUSY-GATE at the merges); PIN MOVED: acct128, BUSY-GATE (the reads busyLaw names stand back while the database is overloaded - the client holds them, the isolate sheds them a moment, every overload answer says its Retry-After; no migration); PIN MOVED: acct127, HOMES-SHED (the homes of a town and its Open Gates one request to the database where they were two; the siege blackout question answering a throw as every route does - an overload a 503; no migration); PIN MOVED: acct126, MINE-PERKS (a Surveyor's own surface veins and their gem on unwitnessed ground, the Deep Delver's x2 - bible/06-Systems/Professions-Arc.md 43; no migration); PIN MOVED: acct125, AUDIT ETHER-OW (C2-1: a Motherlode site is a pixel a Watch receipt can name - never past the Veil, where none is minted; no migration); PIN MOVED: acct124, ETHER-NODES (an Eltheric isle's node, a haul and its pixels' witnesses taken - the nodes' ground the Eltheric Ocean's box beside the Bay's map; no migration); PIN MOVED: acct123, HACKED-GOLD (a purse, a letter of credit or a coin pile past one DFU int a law finding; staff read who gained past the bucket and whom a character traded with; no migration; acct121 then acct122 on its branch, renumbered past BAL9 and NAME-AS at the merges); PIN MOVED: acct122, NAME-AS (the account name or the played realm character name as the name the room reads, chosen on the profile card, migration 0111; a letter to a friend and a board note author found by account; acct121 on its branch, renumbered past BAL9 at the merge); PIN MOVED: acct121, BAL9 (item law 3 - the potency and wellspring lines and the arcane three lawful; no migration); PIN MOVED: acct120, D1-LOAD (the seat registry read from the kept rows of the isolate by every caller, the lease read before it is written; no migration; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED at the merge); PIN MOVED: acct119, GATHER-SPEED + MARKET-SPEED (a harvest's, the professions' state's and a market read's reads batched into a few round trips; the seats' places off the isolate's kept rows for a Levy, a Tithe and a board's listings; no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge); PIN MOVED: acct118, SEAT-LEASE (the Turning settled by one request at a time under a lease, migration 0110); PIN MOVED: acct117, YARD-SWEEP + HANDLE-EMAIL (the yard pieces above the height cap swept, migration 0109, and none served; a username never an email address, one chosen before read as its guest name); PIN MOVED: acct116, CRAFT-HOLD (the exploit audit: the INT3 hold follows a crafted piece, a held character with crafts at the account neither deleted nor depositing nor supplying, and the CRAFT-WORTH patron worth; no migration; acct115 on its branch, renumbered past BR5 at the merge); PIN MOVED: acct115, BR5 (the Patreon link page titled by the product name; acct113 on its branch, renumbered past GUILD-SEEN and GUILD3 at the merge); PIN MOVED: acct114, GUILD3 (the guilds made plain: the silver lines by kind and way, the whole list of holds, the Failing fall, the High Master by the band; no migration; acct112 then acct113 on its branch, renumbered past SCALE4f-h and GUILD-SEEN at the merges); PIN MOVED: acct113, GUILD-SEEN (the guild roster says when each member was last online); PIN MOVED: acct112, SCALE4f + SCALE4g + SCALE4h (acct111 on its branch, renumbered past HOME-VOTE at the merge); PIN MOVED: acct111, HOME-VOTE (a town's votes on its homes, migration 0108 - acct109, then acct110, on its branch, renumbered past PATRON-LOAD and PATRON-LOAD II at the merges); PIN MOVED: acct110, PATRON-LOAD II (the region's traders read by its own indexes - D1 overloaded; migration 0107); PIN MOVED: acct109, PATRON-LOAD (the region's traders read reckons no patrons - D1 overloaded; no migration); PIN MOVED: acct108, TECH1 (the item law's version 2 - a weapon's technique line, after LW15 took acct107; bible/05-Combat/Weapon-Techniques.md); PIN MOVED: acct107, LW15 (THE PATRONS, migration 0106 - acct105, then acct106, on its branch, renumbered past INT11-INT14 and SCALE4d at the merges); PIN MOVED: acct106, SCALE4d (the token's mint on a D1 session, no migration); PIN MOVED: acct105, INT11-INT14 (the INTEGRITY arc's lane 3, migration 0105); PIN MOVED: acct104, INT7-INT10 (the INTEGRITY arc's lane 2, migration 0104 - acct102 on its branch, renumbered past the Chapters' acct103 at the merge); CHAP1-CHAP7b moved it on last (acct103: the Chapters - the Roll, the halls and their writs, the receipts, Merit, Strength, the seats, their titles and their Focus, the hall's roll, the Seasons and the patrons; migrations 0098-0103; acct93 to acct102 on their branch, renumbered past CRAFT2-CRAFT5, SD9b, SCALE4, TAVERN CARDS, SERVER-POST, PERMADEATH-HOUSES, CARDS9-CARDS10, INT1-INT6, BAG-CRAFT and UNWITNESSED-ORE at the merges); UNWITNESSED-ORE moved it on (acct102: a vein on ground no witnesses vouched for drawn to the third tier, no migration); BAG-CRAFT moved it on (acct101: a station's put-in from the pack kept loose, migration 0097_loose_origin); INT1-INT6 moved it on (acct100: every realm checkpoint judged - bible/06-Systems/Integrity-Arc.md, migration 0096_integrity); CARDS9 and CARDS10 moved it on (acct99: Iliac Hand's season board, migration 0095_iliac_ladder); PERMADEATH-HOUSES moved it on (acct98: a fallen permadeath character's home to the heir of its line); SERVER-POST and HOURS-FIRST moved it on (acct97: the server's post and Hour's First, migrations 0093 and 0094); TAVERN CARDS moved it on (acct96: a gold table's stake order, migration 0092_card_stakes); SCALE4a, SCALE4b and SCALE4c before it (acct95: a session and its player one statement, the service's own clock, one heartbeat - acct94 on their branch, renumbered past SD9b at the merge); before them SD9b (acct94: the Hours broken - /v1/sd/claim and migration 0090, Hourbreaker and The Turning Hour rolled on a Brass Remnant's kill's first write; acct91 on its branch, renumbered past main's CAP-OFF, FOUNDER5 and CRAFT2-CRAFT5 at the merges); before it CRAFT2-CRAFT5's (acct93: a first make a pattern's at a tier, five crafts of eight and 0088's merge, the temper and the Reforge with Essence and 0089's tables, a Repair Kit's quality); before it FOUNDER5's (acct92: Founder to the end of 24 September on any clock, and by name); CAP-OFF before it (acct91: a harvest refused for the day's count no more - the day's cap gone, the unvouched dungeon's four veins and the three rare hides kept); TEXT-F1 moved it on (acct90: the words a player types starred as notes, guild notes and letters are kept and read, a rank name refused for a word the filter catches, a maker mark it catches left off); STORM-SHED 2 moved it on (acct89: the arena's reads on every token - the season's #1 kept, an account's own bouts, a Grand Champion's row - and the towns' layouts read again only once a home moved, migration 0086); STORM-SHED moved it on (acct88: the second overload, 2026-10-06 - a character's harvests today read off its own rows, migration 0085; the seats' witness rows kept a minute by one isolate); LEGACY7 moved it on (acct87 - acct84 on its branch, renumbered past SERPENT-SET's acct84, YARD-SHED's acct85 and YARD-HEIGHT's acct86 at the merges: the Project Legacy lines and the tombstone, migration 0084); YARD-HEIGHT moved it on (acct86 - a yard's piece placed or moved past 4 m over the ground refused); YARD-SHED moved it on (acct85 - every town yards kept per isolate and answered before a session, the 2026-10-06 outage); SERPENT-SET and SILVER-FINDS moved it on (acct84 - acct83 on its branch, renumbered past CRYSTAL-FIST at the merge: migration 0083 - a serpent's embers on its row, which the insignia's purse counts with a breach's; a serpent's silver under the day's combat cap; a gathering's find in the harvest's batch and /v1/marks/find, a loot find); CRYSTAL-FIST moved it on (acct83: CRYSTAL_FIST_HANDLES grants the Crystal Fist's title, its glyph and the Crystal Resonance together); AUDIT ARENA-LADDER moved it on (acct82: /v1/arena/attempt and migration 0082, the ladder attempt ticket - acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (acct81: DEVELOPER_HANDLES grants the Seraph Wings - DEVELOPER_AURA); SHADOW-CLOAK moved it on (acct80: SHADOW_FANG_HANDLES grants the Holo Shadow Cloak with the title - acct78 on its branch, renumbered past SERPENT1 and GLOBAL-MARKET at the merges); GLOBAL-MARKET moved it on (acct79: buy orders the Bay's - the Orders view reads every board's, and a fill from another region pays its courier out of its pay; no migration); SERPENT1 moved it on (acct78: /v1/serpent/claim and the serpents slain on the cards, migration 0081 - acct75, acct76 then acct77 on its branch, renumbered past HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges); FIELD BUGS 2026-10-04d KNIGHT-HOUSE moved it on (acct77: a deed the realm gave, held off the record - /v1/homes/deed and the release of a hold, migration 0079); PRIMARCH and FOUNDER4 moved it on (acct76: PRIMARCH_HANDLES grants the Primarch's title, glyph and aura; migration 0078 links an account to a row it shares a character with, for Founder - acct75 on its branch, which HOME-PRICE took first); HOME-PRICE moved it on (acct75: a home's price held to the online range, the town's sale refund; before it, BAG1 and GUILD2's acct74: the Materials Bag carried count and /v1/stores/deposit, migration 0076; a guild new name and its vault, /v1/guilds/rename and /v1/guilds/vault*, migration 0077); AEGIS moved it on (acct73: AEGIS_HANDLES grants the Aegis of Oblivion's title, glyph and aura); ARENA4, ARENA4b and WD3 moved it on (acct72 - acct66 on the arena branch, renumbered past PROF-541's acct70 and SILVER-WAYS' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid's silver under the day's combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541's acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit's fixes, the hall door set by rank alone - hallEntry; a jewel's first craft its piece and base's; no migration); PROF12 before it (acct69: Alchemy's brew, the Apothecaries' counter, a Transmuter's transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller's bench's pieces and the jeweller's hand, a Lapidary's cracked gem; no migration); PROF9 before it (acct67: the fire's dishes and a dish's cook's hand, migration 0069; acct67 past another branch's acct66); GUILD-YARD before it (acct65: a guild hall's outside and yard, its keepers'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID's route and migration 0067, STANDING-TREND's standing rows, the void's audit); GLYPH-WEAR before it (acct63); WB12d moved it on (acct62 - acct46 on its branch, past main's acct46-acct61); SEAT2b part two before it (acct61); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60 - the Seats arc's fourteen renumbered past main's PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59); SEASON1 part two, the banner ribbon before it (acct58); SEASON1 part two, the client's before it (acct57); SEASON1 part two, the economy before it (acct56); SEASON1 part two before it (acct55); SEASON1 part one before it (acct54); CROWN2 before it (acct53); CROWN1 part two before it (acct52); CROWN1 before it (acct51); SEAT2a part three before it (acct50); SEAT2a before it (acct49); SEAT1d before it (acct48); GUILD1d, GUILD1e and SEAT1a before it (acct47 - acct44, then acct45, on their branch, which MARKET-ANY and PATREON-LINK took first); part four before it (acct46: ANY-HOUR, HERB-XP); PATREON-LINK before it (acct45); MARKET-ANY before it (acct44); SCALE1 before it (acct43); REALM-GZIP before it (acct42); PROF8 before it (acct41); GOLD-MARKET before it (acct40); PINE-SHARE before it (acct39); WB9g before it (acct38: the Broker's insignia); HOUSING before it (acct37); the PROF7 merge before it (acct36, past main's FIELD BUGS 2026-09-30 acct33); AUDIT 32 S1 before it (acct35); AUDIT 32 before it (acct34); PROF7 before it (acct33); PROF-DELETE before it (acct32); RENOWN-CHAR before it (acct31: Renown a character's again); MERGE 2 before it (acct30: the professions branch - acct22 to acct29 on its branch, never deployed - past main's acct23); HOUSE-LOSS and RESTORE moved it on (acct23 - acct20, then acct21 and acct22, on their branch, which TERMS1, PENITENT and REALM-DOOR took first). acct9 on the branch; main's FOUNDER2 took acct9; WB5b's gates closed moved it on (acct11); BASE-HIDE (acct12); RENOWN4 and GUILD1c (acct13 - acct11 and acct12 on their branch); SHADOW-FANG (acct14 - acct12 on its branch); FOUNDER3 (acct15); FOUNDER3 (acct15), then HOME-STATIONS (acct16 - acct15 on its branch)
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
  assert.deepEqual([...ORDER_KINDS], ['mute', 'renown', 'guild', 'guildout', 'siege', 'stake', 'deck', 'remains', 'home', 'egopen', 'egadmit', 'ban']);   // SAFE4: a ban's end, the service's word (PIN MOVED)   // EG-PLAY: an Elite Breach's open and admission (PIN MOVED)   // QUEST-HOME: a town's homes moved, the service's word for every page online (PIN MOVED)   // INT9: a death's remains, the service's word on its records (PIN MOVED)   // CARDS10: a ranked seat's deck order (PIN MOVED)   // CARDS6: a gold table's stake (PIN MOVED)   // GUILD1c: a character's guild now, and a member or a guild gone   // SEAT2a: a battle's pass (PIN MOVED)
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
  assert.equal(RELAY_VERSION, 'world242');   // PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED: world185, INT7-INT10 (the INTEGRITY arc's lane 2 - world183, then world184, on its branch, renumbered past CHAP4c's world183 and PERF-RELAY1's world184 at the merges); CHAP4c moved it on last (world183: the chapters' seats' titles - five ids and their claim on the token; NOT YET DEPLOYED - world177, world178, world179, world180, world181 then world182 on its branch, renumbered past THE WROTHGARIAN ZONE's, TAVERN CARDS', HOURS-FIRST's, TAVERN-TABLES', TV-BEYOND's and CARDS10's at the merges of main); CARDS10 moved it on (world182: Iliac Hand's season board, its champion's title in the token's vocabulary); TV-BEYOND moved it on (world181: the world's pixels on the wire Tamriel's, not the Bay's); TAVERN-TABLES moved it on (world180: the gold table an index - two card tables a tavern); HOURS-FIRST moved it on (world179: Hour's First and The First Hour in the token's vocabulary); TAVERN CARDS moved it on (world178: the card tables); THE WROTHGARIAN ZONE moved it on (world177: the open zone, its halls and its giants); SUPER-DUNGEONS moved it on (world176: the Super Dungeons arc, one version - SD-ONLINE first: a dungeon re-laid at the size the world gives it, small or medium, stands in a room of its own, so a page that lays it whole shares no stream and no memory with it; world171 on its branch, renumbered past CRYSTAL-FIST's world171 at one merge and past WATCH-FIX's world172, SERPENT3's world173 and LEGACY7's world174 at the next, and past TEXT-F1's world175 at the one after; TEXT-F1 moved it on (world175: the words a player types starred in sanitizeChat and wordsLine, a custom class the filter catches dropped from a look); LEGACY7 moved it on (world174: the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's world172 and SERPENT3's world173 at the merge); SERPENT3 moved it on (world173: the sea serpent brain swims every leg it shows - no leap - a slept fight taken up where it was and a blow judged where it struck; its law version 2; world171 on its branch, renumbered past CRYSTAL-FIST's world171 and WATCH-FIX's world172 at the merges); WATCH-FIX moved it on (world172: the foe record names the living-world resident a watchman stands for, `lr`); CRYSTAL-FIST moved it on (world171: the Crystal Fist's title and glyph and the Crystal Resonance's aura join the token's vocabulary - a relay before it refuses Flylighter's token; world170 on its branch, renumbered past FEUD's world170 at the merge); FEUD moved it on (world170: the foe record's wind-ups, staggers and blow classes and a revenant's adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main's world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token's aura vocabulary - a relay before it refuses SirMcMobdon's token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub's party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub's live events gain the sun baby's word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch's title and glyph and the Golden Radiance's aura join the token's vocabulary - a relay before it refuses GA00250's token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion's title and glyph and the Oblivion Ward's aura join the token's vocabulary - a relay before it refuses Sureme's token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT's badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party's Overworld walk - world123 on its branch, renumbered past THE MERGE's); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main's TV3); before it TV3 (world122: a region's traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main's AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello's claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main's SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on its branch, renumbered past main's world114-117: the own lane and the pose's concealment bits); SHADOW-FANG's badge vocabulary moved it on (world117 - world114 on its branch, world116 at its first merge; main's Oblivion Gate WBX took world116 first); the Oblivion Gate's WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116 - world114 on its branch, renumbered past main's Enhanced Plus patch (world114) and GUILD1c (world115)); GUILD1c moved it on (world115 - world113 on its branch; the Enhanced Plus patch's pose fields took world114 first); WB3 and AUDIT WB moved it on (world113 - world110 and world111 on their branch); PARTY-TRAVEL before them (world112); RENOWN1 was world111 - world108 on the branch; main's HT-WAIST-NET, PROFILE2/SKIN2 and EVENT1 took world108-110
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
  assert.deepEqual(JSON.parse(sent[0].init.body), { character: 'char-aaaa', guild: true }, 'AUDIT MERGE-PLUS A6: and this build asks for the guild');
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
  assert.match(ex, /if \(f\.dead[^\n]*\) return;[^\n]*\n(?:\s+const bout = [^\n]*\n)?\s+if \(fromPlayer && !peer(?: && !bout)?\) renownFoeStruck\(f\);/,   // ARENA2: never a bout fighter's
    'the outdoor door stamps my blow before a puppet\'s divert');   // PIN MOVED (AUDIT NAV2 F55): the dead check carries the shipmate's guard now - a blow that lands nothing stamps nothing
  assert.match(ex, /f\.dead = true;\n(?:\s+if \(fromPlayer && !peer\) reportPlayerKill\([^\n]*\n)?\s+renownFoeDied\(f\);\s+\/\/ RENOWN1: whoever struck last/);   // SET2: the kill told as mine may stand between
  assert.match(ex, /function puppetDie\(f\) \{[\s\S]{0,400}?f\.dead = true;\n\s+renownFoeDied\(f\);/, 'an owner\'s foe that fell');
  assert.match(dg, /if \(foe\.dead[^\n]*\) return;[^\n]*\n(?:\s+const bout = [^\n]*\n)?\s+if \(fromPlayer && !peer(?: && !bout)?\) renownFoeStruck\(foe\);/,   // ARENA2: never a bout fighter's
    'the dungeon door stamps a joiner\'s blow before the divert');   // PIN MOVED (CREW-COMPANIONS): the dead check carries the companion's guard, as the outdoor door's carries the shipmate's
  assert.match(dg, /foe\.dead = true;\n(?:\s+if \(fromPlayer && !peer\) reportPlayerKill\([^\n]*\n)?\s+renownFoeDied\(foe\);/);   // SET2: as above
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
  assert.match(w, /setRenownKillHandler\(\(foe\) => \{ const party = 1 \+ \(partyNear\(\)\?\.length \?\? 0\); const xp = renownPartyXp\(renownKillXp\(renownFoeLevel\(foe\), renownNow\), Number\.isInteger\(foe\?\._fightN\) \? Math\.min\(party, foe\._fightN\) : party\); renownTracker\.earn\(xp\); sigilDrinks\(xp\); seatEdicts\.campCleared\(foe\?\.site\)\.catch\(\(\) => \{\}\); \}\);/, 'a kill with my party in the room counted - AUDIT PSCALE1 PLAY-4: no more of it than fought a shared foe');   // SEAT1d (PIN MOVED): a Bounty's camp claimed after
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
  assert.deepEqual(tag.children.map((c) => c.className), ['dfname-renown', 'dfname-who', 'dfname-guild', 'dfname-glyphs']);   // GUILD1c: the guild's tag between the name and the glyphs
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
  // GUILD1c: the name in the run is `named` - the name and the guild's tag after it
  assert.match(src('src/net/remotePlayers.js'), /const lead = renownText\(n\.lv\);\n(?:\s*\/\/[^\n]*\n)*\s+const named = [^\n]*\n\s+const run = `\$\{lead \? `\[\$\{lead\}\] ` : ''\}\$\{marks \? `\$\{named\} \$\{marks\}` : named\}`;/, 'the run the label is centred on starts with the level, boxed in brackets');
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
  assert.match(src('src/ui/enhanced/enhancedStyle.js'), /\.card h3 \.acctrenown \{/, 'the chip\'s colour is the skin\'s sheet, never the card\'s');
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
  const { resolveHover, frameSignature } = await import('../../src/systems/worldHover.js');
  const { showWorldPlaque, destroyWorldPlaque } = await import('../../src/ui/worldPlaque.js');
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
  assert.match(src('src/ui/enhanced/enhancedStyle.js'), /\.wplaque-renown \{[^}]*border: 1px solid rgba\(242, 196, 107, 0\.8\);/, 'the plaque\'s box is the one over their head');
});
