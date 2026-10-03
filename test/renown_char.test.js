// RENOWN-CHAR (2026-09-29, Mac: "Can we make renown per character again"; asked how each character starts, Mac chose
// "Own + recent gains"): RENOWN A CHARACTER'S AGAIN. The service over the real migrations (server-account/src/
// renownTracks.js, raids.js, guilds.js, professions.js, index.js): a track a CHARACTER - two characters of an account
// keep two totals, the hour's bound still the ACCOUNT's across them (RENOWN-ACCOUNT's 15,000 and its three quarters
// stand), the tracks' bound (RENOWN_TRACKS_MAX) back, the token's level the named character's, the card a list of the
// characters' tracks, a raid paid to the character that fought it, a guild founded on the founding character's own
// Renown. The migration (0035): each track its own plus everything the account earned while Renown was the account's,
// a realm character with no track those gains alone - under the tracks' bound, the most recently played first - never
// past the cap, the card's order the realm's, a report in flight answered as a repeat, `renown_accounts` kept as
// history. A realm character deleted takes its own Renown with it. The client: the card's chip and a row a character,
// the page adopting a raid's credit only for the character that fought it, the delete dialog saying the Renown goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest, mintId } from '../server-account/src/accounts.js';
import { reportRenownXp, renownTrackOf, renownTracksOf, RENOWN_CARD_TRACKS } from '../server-account/src/renownTracks.js';
import { claimRaid } from '../server-account/src/raids.js';
import { createRealm, deleteRealm, CHARACTER_TABLES } from '../server-account/src/realm.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';
import {
  renownRaidXp, renownForXp, renownXpFor, RENOWN_XP_HOUR_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_MAX, RENOWN_MAX, RENOWN_TRACKS_MAX,
} from '../src/net/renown.js';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { importPublicKeyB64, verifyToken } from '../src/net/identityToken.js';
import { accountCard, renownTracksOfCard } from '../src/ui/enhancedAccount.js';
import { AccountFlow } from '../src/ui/accountFlow.js';
import { r2, seatRealm } from './realmSeat.mjs';   // AUDIT REALM2 S2: a founder is a realm character
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const CHAR_MIGRATION = '0035_renown_characters.sql';
const migrate = (db, files) => { for (const f of files) db.exec(src(`server-account/migrations/${f}`)); };
/** D1's shape over node:sqlite (auditrealm.test.js's): `batch` as ONE transaction, a write's changes() beside it. */
function wrap(db) {
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
/** The service's database, every migration applied. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db, MIGRATIONS);
  return wrap(db);
}
const T0 = 1_800_000_000;   // a clock hour's first second
const DAY = 500;
const player = async (db) => ({ id: (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id });
let _handles = 0;
/** A registered account (a raid is counted for one). */
const member = async (db) => {
  const { id } = await player(db);
  const h = `Crier${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
/** The relay's pair, as tools/mintGateKeys.mjs mints it (raid4_rewards.test.js's). */
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}
const raidFor = (s, key, priv) => mintRaidReceipt({ w: key, s, c: 777, y: 2 }, priv, { subtle, nowS: T0 });
const seatTrack = (db, id, charId, xp, name = null, at = T0) => db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, charId, name, xp, at, at);
const tracksOf = (raw, id) => raw.prepare('SELECT char_id, xp FROM renown_tracks WHERE player = ? ORDER BY char_id').all(id).map((x) => [x.char_id, x.xp]);

// ═══ THE SERVICE ═════════════════════════════════════════════════════════════════════════════════

test('RENOWN-CHAR the track: a CHARACTER\'s again - two characters\' reports keep two totals, each answered as its own; the hour is still the ACCOUNT\'s 15,000 across them; a report naming no character is refused, and a new character past RENOWN_TRACKS_MAX (60); the account\'s old row is never written (mutants: a report onto another character\'s track; the tracks unbounded)', async () => {
  const db = d1();
  const P = await player(db);
  let r = await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-aaaa', xp: 1000, name: 'Mara' });
  assert.deepEqual(r, { character: 'char-aaaa', xp: 1000, level: renownForXp(1000), credited: 1000, rose: true }, 'the answer names its character');
  r = await reportRenownXp({ db, nowS: T0 + 1 }, P, { character: 'char-bbbb', xp: 500, name: 'Tam' });
  assert.deepEqual([r.character, r.xp, r.credited], ['char-bbbb', 500, 500], 'the second character\'s report starts its OWN total - never onto the first\'s');
  assert.deepEqual(await renownTrackOf({ db }, P.id, 'char-aaaa'), { xp: 1000, level: renownForXp(1000) });
  assert.deepEqual(await renownTrackOf({ db }, P.id, 'char-bbbb'), { xp: 500, level: renownForXp(500) });
  assert.equal(await renownTrackOf({ db }, P.id, 'char-cccc'), null, 'a character that earned nothing has none: Renown 1');
  assert.deepEqual((await renownTracksOf({ db }, P.id)).map((t) => [t.character, t.name, t.xp]), [['char-bbbb', 'Tam', 500], ['char-aaaa', 'Mara', 1000]], 'the card\'s list, the most recently earned first');
  for (const character of [undefined, null, 'x', 42, 'a b c d']) {
    assert.deepEqual(await reportRenownXp({ db, nowS: T0 + 2 }, P, { character, xp: 10 }), { error: 'renown-character' }, `${JSON.stringify(character)}: no character, no track`);
  }
  // THE HOUR is the account's 15,000, whichever characters earn it (the Renown is the character's, the bound is not)
  const Q = await player(db);
  let got = 0;
  for (let i = 0; i < 5; i++) got += (await reportRenownXp({ db, nowS: T0 + 10 + i }, Q, { character: `char-q${i}xx`, xp: RENOWN_XP_REPORT_MAX })).credited;
  assert.equal(got, RENOWN_XP_HOUR_MAX, 'five characters, one hour: 15,000 - a second character is not a second allowance');
  assert.deepEqual((await renownTracksOf({ db }, Q.id, 10)).map((t) => t.xp).sort((a, b) => b - a), [5000, 5000, 5000], 'three characters\' tracks, the other two paid nothing and given none');
  // THE TRACKS' BOUND: sixty an account; a sixty-first character is refused, one it keeps still earns
  const B = await player(db);
  for (let i = 0; i < RENOWN_TRACKS_MAX; i++) seatTrack(db, B.id, `char-${String(i).padStart(4, '0')}`, 0);
  assert.deepEqual(await reportRenownXp({ db, nowS: T0 }, B, { character: 'char-new1', xp: 10 }), { error: 'renown-full' });
  assert.equal((await reportRenownXp({ db, nowS: T0 }, B, { character: 'char-0003', xp: 10 })).credited, 10, 'a character it keeps still earns');
  assert.equal(RENOWN_TRACKS_MAX, 60);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM renown_accounts').get().n, 0, 'RENOWN-ACCOUNT\'s table is history: no report writes it');
});

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
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

test('RENOWN-CHAR the worker: the token\'s level is the NAMED character\'s own - another character of the account stands at its own; a mint naming none carries none; a report answers its character\'s track; /v1/account says the characters\' tracks (a list, the most recently earned first); a realm character founds a guild on its OWN Renown - never its account\'s best; acct31 (mutants: the mint reading the account\'s best track; the card sent one track; the founding asking the account\'s best)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { env, call, kp } = await stand();
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.deepEqual((await call('GET', '/v1/account', undefined, me.secret)).body.account.renown, [], 'nothing earned: no track');
  let r = await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 5000, name: 'Mara' }, me.secret);
  assert.deepEqual([r.status, r.body.character, r.body.xp, r.body.level, typeof r.body.order], [200, 'char-aaaa', 5000, 9, 'string']);
  r = await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 510 }, me.secret);
  assert.deepEqual([r.body.xp, r.body.level, r.body.rose], [5510, 10, true]);
  clock += 1000;   // a second on: the card orders by the last earned
  r = await call('POST', '/v1/renown/xp', { character: 'char-bbbb', xp: 150, name: 'Tam' }, me.secret);
  assert.deepEqual([r.body.character, r.body.xp, r.body.level], ['char-bbbb', 150, 2], 'another character: its own track');
  for (const [character, level, xp] of [['char-aaaa', 10, 5510], ['char-bbbb', 2, 150], ['char-never-played', 1, 0]]) {
    const tok = (await call('POST', '/v1/auth/token', { character }, me.secret)).body;
    assert.deepEqual([tok.level, tok.xp], [level, xp], `${character}: its own Renown and total`);
    assert.equal((await verifyToken(tok.token, kp.publicKey, { subtle, nowS: T0 })).claims.lv, level, `${character}: signed in`);
  }
  const none = (await call('POST', '/v1/auth/token', {}, me.secret)).body;
  assert.deepEqual([none.level, none.xp], [null, null], 'a mint naming no character (an older build) carries none');
  const card = (await call('GET', '/v1/account', undefined, me.secret)).body.account.renown;
  assert.deepEqual(card.map((x) => [x.character, x.name, x.xp, x.level]), [['char-bbbb', 'Tam', 150, 2], ['char-aaaa', 'Mara', 5510, 10]], 'the card: the characters\' tracks, the most recently earned first');
  assert.equal(RENOWN_CARD_TRACKS, 5);
  assert.deepEqual([(await call('POST', '/v1/renown/xp', { xp: 10 }, me.secret)).status, (await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 0 }, me.secret)).status], [400, 400], 'no character, or an amount out of its bound');
  for (let i = 0; i < RENOWN_TRACKS_MAX; i++) env.DB._raw.prepare('INSERT OR IGNORE INTO renown_tracks (player, char_id, xp, created_at, updated_at) VALUES (?, ?, 0, 1, 1)').run(me.id, `char-f${String(i).padStart(3, '0')}`);
  assert.deepEqual(await call('POST', '/v1/renown/xp', { character: 'char-past', xp: 10 }, me.secret), { status: 409, body: { error: 'renown-full' } }, 'a character past the tracks\' bound: 409');
  // A GUILD is founded on the founding character's OWN Renown (AUDIT REALM2 S2: a realm character, on its record)
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Aldric', password: 'a good long one', ...ACCEPTED }, me.secret)).status, 200);
  const fresh = await seatRealm(env, me.secret, 'Fresh', { name: 'Fresh', level: 9, goldPieces: 100_000, items: [] });
  assert.deepEqual(await call('POST', '/v1/guilds/found', { character: fresh.id, name: 'The Hound', tag: 'HND', realm: fresh.at() }, me.secret), { status: 403, body: { error: 'guild-renown' } }, 'a character that never earned is Renown 1 - whatever the account\'s best (Mara\'s 10)');
  env.DB._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)').run(me.id, fresh.id, 'Fresh', renownXpFor(10));
  assert.equal((await call('POST', '/v1/guilds/found', { character: fresh.id, name: 'The Hound', tag: 'HND', realm: fresh.at() }, me.secret)).status, 200, 'at its own Renown 10, it founds');
  assert.equal(ACCOUNT_VERSION, 'acct72', 'ARENA4, ARENA4b and WD3 moved it on last (acct72 - acct66 on the arena branch, renumbered past PROF-541\'s acct70 and SILVER-WAYS\' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid\'s silver under the day\'s combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541\'s acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit\'s fixes, the hall door set by rank alone - hallEntry; a jewel\'s first craft its piece and base\'s; no migration); PROF12 before it (acct69: Alchemy\'s brew, the Apothecaries\' counter, a Transmuter\'s transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller\'s bench\'s pieces and the jeweller\'s hand, a Lapidary\'s cracked gem; no migration); PROF9 before it (acct67: the fire\'s dishes and a dish\'s cook\'s hand, migration 0069; acct67 past another branch\'s acct66); GUILD-YARD before it (acct65: a guild hall\'s outside and yard, its keepers\'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID\'s route and migration 0067, STANDING-TREND\'s standing rows, the void\'s audit); GLYPH-WEAR before it (acct63); WB12d moved it on (acct62 - acct46 on its branch, past main\'s acct46-acct61); SEAT2b part two before it (acct61); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60 - the Seats arc\'s fourteen renumbered past main\'s PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59); SEASON1 part two, the banner ribbon before it (acct58); SEASON1 part two, the client\'s before it (acct57); SEASON1 part two, the economy before it (acct56); SEASON1 part two before it (acct55); SEASON1 part one before it (acct54); CROWN2 before it (acct53); CROWN1 part two before it (acct52); CROWN1 before it (acct51); SEAT2a part three before it (acct50); SEAT2a before it (acct49); SEAT1d before it (acct48); GUILD1d, GUILD1e and SEAT1a before it (acct47 - acct44, then acct45, on their branch, which MARKET-ANY and PATREON-LINK took first); part four before it (acct46: ANY-HOUR, HERB-XP); PATREON-LINK before it (acct45); MARKET-ANY before it (acct44); SCALE1 before it (acct43); REALM-GZIP before it (acct42); PROF8 before it (acct41); GOLD-MARKET before it (acct40); PINE-SHARE before it (acct39); WB9g before it (acct38: the Broker\'s insignia); HOUSING before it (acct37); the PROF7 merge before it (acct36, past main\'s FIELD BUGS 2026-09-30 acct33); AUDIT 32 S1 before it (acct35); AUDIT 32 before it (acct34); PROF7 before it (acct33); PROF-DELETE before it (acct32); RENOWN-CHAR before it (acct31), past MERGE 2\'s acct30');
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct72"/);
});

test('RENOWN-CHAR the raid: a town defended is paid to the character that FOUGHT it, at its own Renown - never the account\'s best - another character\'s track untouched; a claim naming no character is refused (mutants: the raid read at the account\'s best track)', async () => {
  const db = d1();
  const A = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  seatTrack(db, A.id, 'char-best', renownXpFor(20), 'Best');
  const c1 = await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:7:${DAY}`, priv), character: 'char-newb', name: 'Newb' }, pubKey);
  assert.deepEqual(c1.renown, { character: 'char-newb', xp: renownRaidXp(1), level: renownForXp(renownRaidXp(1)), credited: renownRaidXp(1), rose: true }, 'paid at ITS Renown 1 (585) - never at the account\'s best\'s 20');
  assert.deepEqual(tracksOf(db._raw, A.id), [['char-best', renownXpFor(20)], ['char-newb', renownRaidXp(1)]], 'the best character\'s track untouched');
  const c2 = await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:8:${DAY}`, priv), character: 'char-best' }, pubKey);
  assert.deepEqual([c2.renown.character, c2.renown.credited, c2.renown.xp], ['char-best', renownRaidXp(20), renownXpFor(20) + renownRaidXp(20)], 'the best one paid at its own 20');
  assert.deepEqual(await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, priv) }, pubKey), { error: 'renown-character' }, 'no character to pay');
  assert.deepEqual(db._raw.prepare('SELECT char_id FROM raid_cleanses WHERE account = ? ORDER BY raid').all(A.id).map((x) => x.char_id), ['char-newb', 'char-best']);
});

// ═══ THE MIGRATION ═══════════════════════════════════════════════════════════════════════════════

test('RENOWN-CHAR the migration (0035), over the real migrations: each track its OWN plus everything the account earned while Renown was the account\'s (its total less the best track it began from); a realm character with no track those gains alone; an account that earned nothing since, or never held the account\'s Renown, untouched; never past the cap; the report in flight a repeat on every track; renown_accounts kept as history (mutants: the account\'s whole total added; the gains to the best track alone; a realm character left at nothing; the cap unread; the report in flight credited again)', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const at = MIGRATIONS.indexOf(CHAR_MIGRATION);
  assert.ok(at > MIGRATIONS.indexOf('0021_renown_account.sql') && MIGRATIONS.slice(at + 1).every((f) => f > CHAR_MIGRATION), '0035 after RENOWN-ACCOUNT\'s 0021 (PROF7\'s 0036 after it, HOUSING\'s 0037-0039 and WB9g\'s 0040)');
  migrate(raw, MIGRATIONS.slice(0, at));
  const db = wrap(raw);
  const acct = () => ({ id: (() => { const id = mintId(rand); raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?)').run(id, 'Guest', T0, T0); return id; })() });
  const track = raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const account = raw.prepare('INSERT INTO renown_accounts (player, xp, last_rid, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  const realm = (who, id, name, updated) => raw.prepare('INSERT INTO realm_characters (id, player, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, who.id, name, 100, updated);
  const rid = (c) => c.repeat(16);
  // A: three tracks as RENOWN-ACCOUNT found them (best 6,000), then 100 earned while Renown was the account's; a realm
  // character made since, with no track
  const A = acct();
  track.run(A.id, 'char-main', 'Main', 6000, rid('a'), 100, 500);
  track.run(A.id, 'char-alt1', 'Alt', 500, rid('b'), 200, 900);
  track.run(A.id, 'char-alt2', null, 300, null, 50, 400);
  account.run(A.id, 6100, rid('d'), 50, 2000);
  realm(A, 'r0000000000000000000a', 'Nystul', 1500);
  // B: tracks, but no account row (its tracks held nothing when 0021 ran, and it earned nothing since)
  const B = acct();
  track.run(B.id, 'char-zero', null, 0, null, 10, 10);
  // C: at the cap's total, and an alt 10 in: the account took the last 10
  const C = acct();
  track.run(C.id, 'char-capp', 'Old', RENOWN_XP_MAX - 10, null, 10, 20);
  track.run(C.id, 'char-newb', 'New', 10, rid('c'), 30, 40);
  account.run(C.id, RENOWN_XP_MAX, rid('e'), 10, 3000);
  // D: an account first seen while Renown was the account's - no track at all, 700 earned, two realm characters
  const D = acct();
  account.run(D.id, 700, rid('f'), 1000, 1100);
  realm(D, 'r0000000000000000000d', 'Dunmer', 1200);
  realm(D, 'r0000000000000000000e', 'Elden', 1300);
  // E: an account that earned nothing while Renown was the account's (its row the best track, no more), and a realm
  // character made since
  const E = acct();
  track.run(E.id, 'char-only', 'Only', 800, rid('7'), 10, 20);
  account.run(E.id, 800, rid('7'), 10, 20);
  realm(E, 'r0000000000000000000f', 'Idle', 30);
  const accountsBefore = raw.prepare('SELECT * FROM renown_accounts ORDER BY player').all().map((x) => ({ ...x }));
  migrate(raw, [CHAR_MIGRATION]);
  assert.deepEqual(tracksOf(raw, A.id), [['char-alt1', 600], ['char-alt2', 400], ['char-main', 6100], ['r0000000000000000000a', 100]], 'each its own plus the 100 - and the realm character made since, the 100 alone');
  assert.deepEqual(tracksOf(raw, B.id), [['char-zero', 0]], 'no account row: nothing to give');
  assert.deepEqual(tracksOf(raw, C.id), [['char-capp', RENOWN_XP_MAX], ['char-newb', 20]], 'never past the cap');
  assert.deepEqual(tracksOf(raw, D.id), [['r0000000000000000000d', 700], ['r0000000000000000000e', 700]], 'no track at all: every realm character the gains');
  assert.deepEqual(tracksOf(raw, E.id), [['char-only', 800]], 'nothing earned since: no gains, and no empty track for the realm character');
  assert.deepEqual(raw.prepare('SELECT char_id, name, last_rid FROM renown_tracks WHERE player = ? ORDER BY char_id').all(D.id).map((x) => ({ ...x })), [
    { char_id: 'r0000000000000000000d', name: 'Dunmer', last_rid: rid('f') }, { char_id: 'r0000000000000000000e', name: 'Elden', last_rid: rid('f') },
  ], 'the realm\'s names, and the report the account last took');
  assert.deepEqual(raw.prepare('SELECT * FROM renown_accounts ORDER BY player').all().map((x) => ({ ...x })), accountsBefore, 'renown_accounts stays as it stood - history');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'renown_char_seed'").get().n, 0, 'its working table gone');
  // THE REPORT IN FLIGHT across the deploy, sent again under the id the account last took: a repeat on any track
  for (const character of ['char-main', 'char-alt2', 'r0000000000000000000a']) {
    const again = await reportRenownXp({ db, nowS: T0 }, A, { character, xp: 50, rid: rid('d') });
    assert.deepEqual([again.credited, again.repeat], [0, true], `${character}: answered, never paid twice`);
  }
  const next = await reportRenownXp({ db, nowS: T0 + 1 }, A, { character: 'char-alt2', xp: 100, rid: rid('9') });
  assert.deepEqual([next.character, next.credited, next.xp], ['char-alt2', 100, 500], 'an alt earns onto its OWN 400 - never the best\'s');
  assert.deepEqual(await renownTrackOf({ db }, A.id, 'char-main'), { xp: 6100, level: renownForXp(6100) }, 'the best keeps its level and the gains');
});

test('RENOWN-CHAR the migration\'s bound and order: the new rows only into the room RENOWN_TRACKS_MAX leaves, the realm characters most recently played first; a realm character\'s track stamped with the later of its own time and its record\'s last move, so the card leads with the one played last; a best track deleted with its realm character leaves the gains read against the best that remains - more, never less; a gain is never below nothing (mutants: the bound unread; the realm characters played first taken last; the card\'s order left to the character ids; a negative gain taken)', () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  migrate(raw, MIGRATIONS.filter((f) => f !== CHAR_MIGRATION));
  const acct = () => { const id = mintId(rand); raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?)').run(id, 'Guest', T0, T0); return { id }; };
  const track = raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)');
  const realm = (who, id, updated) => raw.prepare('INSERT INTO realm_characters (id, player, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, who.id, `R${id.slice(-1)}`, 1, updated);
  // F: fifty-eight tracks, 50 earned since, three realm characters with none - room for two, the two played last
  const F = acct();
  for (let i = 0; i < RENOWN_TRACKS_MAX - 2; i++) track.run(F.id, `char-f${String(i).padStart(3, '0')}`, null, 10, 1, 1);
  raw.prepare('INSERT INTO renown_accounts (player, xp, created_at, updated_at) VALUES (?, ?, 1, 1)').run(F.id, 60);
  realm(F, 'r000000000000000000f1', 500);
  realm(F, 'r000000000000000000f2', 700);
  realm(F, 'r000000000000000000f3', 600);
  // G: a realm character's track older than its record's last move, and an old offline character's
  const G = acct();
  track.run(G.id, 'r000000000000000000g1', 'G1', 100, 10, 20);
  track.run(G.id, 'char-gold', 'Gold', 900, 10, 50);
  raw.prepare('INSERT INTO renown_accounts (player, xp, created_at, updated_at) VALUES (?, ?, 1, 1)').run(G.id, 950);
  realm(G, 'r000000000000000000g1', 4000);
  // H: its best (6,000) was a realm character deleted while Renown was the account's; 100 earned since
  const H = acct();
  track.run(H.id, 'char-left', 'Left', 500, 1, 1);
  raw.prepare('INSERT INTO renown_accounts (player, xp, created_at, updated_at) VALUES (?, ?, 1, 1)').run(H.id, 6100);
  // I: a track above the account's own row (none should be - the account began at its best): no gain, never a loss
  const I = acct();
  track.run(I.id, 'char-high', 'High', 900, 1, 1);
  raw.prepare('INSERT INTO renown_accounts (player, xp, created_at, updated_at) VALUES (?, ?, 1, 1)').run(I.id, 300);
  migrate(raw, [CHAR_MIGRATION]);
  assert.deepEqual(raw.prepare('SELECT xp FROM renown_tracks WHERE player = ?').all(I.id).map((x) => x.xp), [900], 'a gain is never below nothing');
  const f = raw.prepare("SELECT char_id, xp FROM renown_tracks WHERE player = ? AND char_id LIKE 'r%' ORDER BY char_id").all(F.id).map((x) => [x.char_id, x.xp]);
  assert.deepEqual(f, [['r000000000000000000f2', 50], ['r000000000000000000f3', 50]], 'room for two: the two played last');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE player = ?').get(F.id).n, RENOWN_TRACKS_MAX, 'the bound, exactly');
  assert.equal(raw.prepare("SELECT xp FROM renown_tracks WHERE player = ? AND char_id = 'char-f000'").get(F.id).xp, 60, 'and every old track its gains');
  assert.deepEqual(raw.prepare("SELECT updated_at FROM renown_tracks WHERE player = ? AND char_id = 'r000000000000000000f2'").get(F.id).updated_at, 700, 'a new track stamped when its character last played');
  const g = raw.prepare('SELECT char_id, xp, updated_at FROM renown_tracks WHERE player = ? ORDER BY updated_at DESC').all(G.id).map((x) => ({ ...x }));
  assert.deepEqual(g, [{ char_id: 'r000000000000000000g1', xp: 150, updated_at: 4000 }, { char_id: 'char-gold', xp: 950, updated_at: 50 }], 'the realm character played last leads the card; an offline character\'s time stands');
  assert.deepEqual(raw.prepare('SELECT char_id, xp FROM renown_tracks WHERE player = ?').all(H.id).map((x) => [x.char_id, x.xp]), [['char-left', 6100]], 'read against the best that remains: 5,600 - more than the 100, never less');
  const sql = src(`server-account/migrations/${CHAR_MIGRATION}`);
  assert.match(sql, /Mac's choice: "Own \+ recent gains"/, 'the choice is Mac\'s, written where it is made');
  assert.match(sql, /MIN\(2318660, /);
  assert.equal(RENOWN_XP_MAX, 2318660, 'the cap the migration writes is the law\'s');
  assert.match(sql, /60 - \(SELECT COUNT\(\*\) FROM renown_tracks t WHERE t\.player = r\.player\) AS room/);
});

test('RENOWN-CHAR a realm character deleted takes its OWN Renown with it and leaves the others\' be; RENOWN-ACCOUNT\'s table is no character table and realm.js writes it nowhere; a new realm character starts at Renown 1 (mutants: the track left behind by a delete)', async () => {
  const db = d1();
  const A = await player(db);
  const made = await createRealm({ db, rand, nowS: T0 }, A.id, { name: 'Nystul' });
  assert.ok(made.id, `made: ${JSON.stringify(made)}`);
  await reportRenownXp({ db, nowS: T0 }, A, { character: made.id, xp: 4000 });
  await reportRenownXp({ db, nowS: T0 + 1 }, A, { character: 'char-keep', xp: 900 });
  assert.deepEqual(await deleteRealm({ db, bucket: null }, A.id, made.id), { ok: true });
  assert.equal(await renownTrackOf({ db }, A.id, made.id), null, 'its Renown went with it');
  assert.deepEqual(await renownTrackOf({ db }, A.id, 'char-keep'), { xp: 900, level: renownForXp(900) }, 'another character\'s stays');
  assert.ok(CHARACTER_TABLES.includes('renown_tracks'), 'the track is a character\'s table');
  assert.equal(CHARACTER_TABLES.includes('renown_accounts'), false);
  assert.doesNotMatch(src('server-account/src/realm.js'), /(UPDATE|DELETE FROM|INSERT INTO|REPLACE INTO)\s+renown_accounts/i);
  const next = await createRealm({ db, rand, nowS: T0 + 2 }, A.id, { name: 'Tamsin' });
  assert.equal((await reportRenownXp({ db, nowS: T0 + 3 }, A, { character: next.id, xp: 10 })).xp, 10, 'a new character starts at its own nothing');
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════

const node = (tag) => {
  const n = {
    tag, className: '', title: '', children: [],
    append: (...kids) => n.children.push(...kids.filter(Boolean)),
    get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
  };
  Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
  return n;
};

test('RENOWN-CHAR the client: the account card draws the characters\' tracks - the level of the one played last left of the name, named in its title, and a row each; RENOWN-ACCOUNT\'s one Renown (a service from its day) draws none; the page adopts a raid\'s credit only for the character that fought it; the delete dialog says the Renown goes with the character (mutants: a track of any shape drawn; another character\'s raid adopted; the dialog\'s old word)', () => {
  const tracks = [{ character: 'char-aaaa', name: 'Mara Venn', xp: 6000, level: 10 }, { character: 'char-bbbb', name: null, xp: 150, level: 2 }];
  assert.deepEqual(renownTracksOfCard(tracks), tracks);
  for (const bad of [null, undefined, { xp: 6000, level: 10 }, 'Renown 10']) assert.deepEqual(renownTracksOfCard(bad), [], `${JSON.stringify(bad)}: no characters' tracks`);
  assert.deepEqual(renownTracksOfCard([{ xp: 1, level: 0 }, { xp: -1, level: 2 }, { xp: 1.5, level: 2 }, { level: 2 }, null, tracks[1]]), [tracks[1]], 'a track out of shape is not drawn');
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network'); } }, storage });
  const card = accountCard({ createElement: node }, flow);
  const base = { id: 'p1', name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy', playedS: 60 };
  flow.stage = 'in';
  flow.account = { ...base, renown: tracks };
  card.paint();
  const h3 = card.root.all.find((n) => n.tag === 'h3');
  assert.deepEqual(h3.children.map((c) => [c.className, c.textContent]), [['acctrenown', '10'], ['acctname', 'Lattymoy']], 'the level of the character played last, left of the name');
  assert.equal(h3.children[0].title, 'Renown 10 - Mara Venn', 'and whose it is');
  const values = () => card.root.all.filter((n) => n.className === 'acctval').map((n) => n.textContent);
  assert.ok(values().includes('Mara Venn - Renown 10, 490 / 2,150 XP to Renown 11'), values().join(' | '));
  assert.ok(values().includes('A character - Renown 2, 50 / 130 XP to Renown 3'), 'a character whose name the service never heard');
  flow.account = { ...base, renown: [{ character: 'char-capp', name: 'Old', xp: RENOWN_XP_MAX, level: RENOWN_MAX }] };
  card.paint();
  assert.ok(values().includes('Old - Renown 50, the highest there is'), 'the level said once at the cap (AUDIT RENOWN1 UI-6)');
  flow.account = { ...base, renown: { xp: 6000, level: 10 } };
  card.paint();
  const plain = card.root.all.find((n) => n.tag === 'h3');
  assert.deepEqual([plain.textContent, plain.children.length], ['Lattymoy', 0], 'RENOWN-ACCOUNT\'s one Renown: no character\'s, none drawn');
  // THE PAGE: a counted raid's Renown is the page's only for the character that fought it
  const w = src('src/scenes/world.js');
  assert.match(w, /onRecorded: \(data\) => \{\n\s+if \(data\?\.renown\?\.character !== characterIdOf\(playerEntity\)\) return;[^\n]*\n\s+const a = renownAnswer\(\{ \.\.\.data\.renown, order: data\.order \?\? null \}, data\.renown\.credited \?\? 0, renownSaid\);/);
  // THE DELETE DIALOG: the Renown goes with the character again
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /- its Renown, its professions and their Stores, its home and its guild place with it\. A copy you made offline stays\./);   // PROF-DELETE: and its professions
  assert.doesNotMatch(menu, /Your Renown belongs to your account/);
});
