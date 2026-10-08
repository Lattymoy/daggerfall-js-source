// RAID4 (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric +
// armor sets"): THE TOWNS DEFENDED - the first of the rewards. A raid's receipt the relay signed (net/raidReceipt.js) is
// honoured by the account service over the real migrations (one row a (raid, account), the day's bound, a guest's not
// counted, another's refused; the character that fought it paid its Renown in the same transaction, once, whoever
// claims it twice at once - the ACCOUNT's for a day under RENOWN-ACCOUNT, the character's again since RENOWN-CHAR); the worker's route behind a session, the order a rise earns, the count on /v1/account and
// on the Inspect card's record; the client's call; the device's queue of receipts (net/raidClaims.js - what settles one
// and what keeps it, its clock, its bounds); the cards' words; and the world host's seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest } from '../server-account/src/accounts.js';
import { claimRaid, raidRecordOf, RAID_CLAIMS_DAY_MAX } from '../server-account/src/raids.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { renownRaidXp, renownQuestXp, renownXpFor, renownForXp, RENOWN_RAID_QUESTS, RENOWN_QUEST_LEVEL_MAX, RENOWN_XP_MAX, RENOWN_TRACKS_MAX } from '../src/net/renown.js';
import { mintRaidReceipt, RAID_RECEIPT_TTL_S } from '../src/net/raidReceipt.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { importPublicKeyB64, verifyOrder } from '../src/net/identityToken.js';
import { accountRaids, SESSION_KEY } from '../src/net/accountClient.js';
import {
  createRaidClaims, raidClaimVerdict, raidRecordText, RAID_CLAIMS_KEY, RAID_CLAIMS_MAX, RAID_CLAIM_RETRY_MS, RAID_CLAIM_TEXT,
} from '../src/net/raidClaims.js';
import { profileView, profileRaidLine, createProfileWindow } from '../src/ui/profileWindow.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** D1 over node:sqlite, the real migrations - and its batch, as ONE transaction (renown1.test.js's). */
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
const T0 = 1_800_000_000;
const DAY = 500;
const guest = async (db) => (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
let _handles = 0;
const member = async (db) => {
  const id = await guest(db);
  const h = `Warden${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
/** The relay's pair, as tools/mintGateKeys.mjs mints it - the one key signs both receipts. */
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }), pub };
}
const raidFor = (s, key, priv, nowS = T0, y = 2) => mintRaidReceipt({ w: key, s, c: 777, y }, priv, { subtle, nowS });
const CH = 'char-0001', CH2 = 'char-0002';

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════

test('RAID4 the Renown a town pays: three quests\' worth at the top quest level, read no higher than the character\'s Renown allows - RENOWN-ACCOUNT\'s three quarters: 585 at Renown 1, 1,395 at 10, 2,925 from 27 (780, 1,860 and 3,900 at the full rate) (mutants: the ceiling unread; the count of quests off)', () => {
  assert.equal(RENOWN_RAID_QUESTS, 3);
  assert.equal(renownRaidXp(1), 585);
  assert.equal(renownRaidXp(10), 1395);
  assert.equal(renownRaidXp(27), 2925);
  assert.equal(renownRaidXp(50), 2925);
  assert.equal(renownRaidXp(null), renownRaidXp(1), 'a Renown not known is Renown 1, the strictest');
  assert.equal(renownRaidXp(10), RENOWN_RAID_QUESTS * renownQuestXp(RENOWN_QUEST_LEVEL_MAX, 10));
});

// ═══ THE SERVICE ═════════════════════════════════════════════════════════════════════════════════

test('RAID4 the claim: a receipt the relay signed, naming the claiming account, is one row a (raid, account) - counted once whatever happens to it, and the character that fought it paid its Renown in the same breath, once; another raid adds one; another account\'s, an unsigned one, a gate\'s, a forged one and an expired one are refused; no public half is the service\'s gap; a guest is not counted until it registers (mutants: the row unkeyed; the credit outside the row\'s own claim; the guest counted)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  const k1 = `3:7:${DAY}`, k2 = `3:8:${DAY}`;
  const r1 = await raidFor(A.id, k1, priv);
  const first = await claimRaid(ctx, A, { receipt: r1, character: CH, name: 'Ann' }, pubKey);
  assert.deepEqual(first, { recorded: true, defended: 1, spoils: false, renown: { character: CH, xp: 585, level: renownForXp(585), credited: 585, rose: true } }, 'a new track takes the raid\'s Renown at Renown 1 (no claim id: no thanks - AUDIT RAID R4)');
  assert.deepEqual(await claimRaid(ctx, A, { receipt: r1, character: CH, name: 'Ann' }, pubKey), { recorded: false, why: 'claimed', defended: 1, spoils: false }, 'once, whatever happens to it');
  assert.deepEqual(await claimRaid(ctx, A, { receipt: await raidFor(A.id, k1, priv, T0 + 5), character: CH2 }, pubKey), { recorded: false, why: 'claimed', defended: 1, spoils: false }, 'the raid is the key, not the bytes - nor the character');
  assert.equal(db._raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(A.id, CH).xp, 585, 'paid once');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE player = ? AND char_id = ?').get(A.id, CH2).n, 0, 'and nobody paid for a claim that counted nothing');
  const second = await claimRaid(ctx, A, { receipt: await raidFor(A.id, k2, priv), character: CH, name: 'Ann' }, pubKey);
  assert.equal(second.defended, 2, 'the next raid adds one');
  assert.equal(second.renown.credited, renownRaidXp(renownForXp(585)), 'paid at the track\'s own level');
  assert.deepEqual(await claimRaid(ctx, B, { receipt: r1, character: CH }, pubKey), { error: 'not-yours' });
  assert.deepEqual(await raidRecordOf({ db }, B.id), { defended: 0 });
  assert.deepEqual(await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, null), character: CH }, pubKey), { error: 'receipt', why: 'unsigned' });
  const gate = await mintReceipt({ d: DAY, b: 'ruhn', s: A.id, c: 1, x: 'dealt' }, priv, { subtle, nowS: T0 });
  assert.deepEqual(await claimRaid(ctx, A, { receipt: gate, character: CH }, pubKey), { error: 'receipt', why: 'version' }, 'a gate\'s receipt is not a raid\'s');
  const other = await relayPair();
  assert.deepEqual(await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, other.priv), character: CH }, pubKey), { error: 'receipt', why: 'signature' });
  assert.deepEqual(await claimRaid({ ...ctx, nowS: T0 + RAID_RECEIPT_TTL_S }, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, priv), character: CH }, pubKey), { error: 'receipt', why: 'expired' });
  assert.deepEqual(await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, priv), character: CH }, null), { error: 'no-gate-key' });
  assert.deepEqual(await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, priv), character: 'no such/id' }, pubKey), { error: 'renown-character' });
  const G = await guest(db);
  const rg = await raidFor(G, k1, priv);
  assert.deepEqual(await claimRaid(ctx, { id: G, handle: null }, { receipt: rg, character: CH }, pubKey), { recorded: false, why: 'guest', defended: 0, spoils: false });
  assert.equal((await claimRaid(ctx, { id: G, handle: 'Registered' }, { receipt: rg, character: CH }, pubKey)).recorded, true, 'registered, the same receipt counts');
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(A.id);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?').get(A.id).n, 0, 'the account gone, its towns with it');
  const sql = src('server-account/migrations/0016_raid_cleanses.sql');
  assert.match(sql, /PRIMARY KEY \(raid, account\)/);
  assert.match(sql, /FOREIGN KEY \(account\) REFERENCES players\(id\) ON DELETE CASCADE/);
});

test('RAID4 the claim\'s bounds: at most RAID_CLAIMS_DAY_MAX raids a game day (the relay holds no schedule), another day counts afresh; the same receipt claimed twice at once credits once; a track at the cap\'s total takes nothing more; a new character past the tracks\' bound is counted and paid nothing (mutants: the day unbounded; the credit by the account rather than by the claim\'s own row; the cap overrun)', async () => {
  const db = d1();
  const A = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  for (let i = 0; i < RAID_CLAIMS_DAY_MAX; i++) assert.equal((await claimRaid(ctx, A, { receipt: await raidFor(A.id, `4:${i}:${DAY}`, priv), character: CH }, pubKey)).recorded, true);
  const full = await claimRaid(ctx, A, { receipt: await raidFor(A.id, `4:99:${DAY}`, priv), character: CH }, pubKey);
  assert.deepEqual(full, { recorded: false, why: 'day-full', defended: RAID_CLAIMS_DAY_MAX, spoils: false });
  assert.equal((await claimRaid(ctx, A, { receipt: await raidFor(A.id, `4:99:${DAY + 1}`, priv), character: CH }, pubKey)).recorded, true, 'another day counts afresh');
  // two devices at once
  const B = await member(db);
  const rb = await raidFor(B.id, `5:1:${DAY}`, priv);
  const both = await Promise.all([claimRaid(ctx, B, { receipt: rb, character: CH }, pubKey), claimRaid(ctx, B, { receipt: rb, character: CH }, pubKey)]);
  assert.deepEqual(both.map((r) => r.recorded).sort(), [false, true]);
  assert.equal(db._raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(B.id, CH).xp, renownRaidXp(1), 'paid once');
  // the cap's total
  const C = await member(db);
  db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(C.id, CH, 'Cap', RENOWN_XP_MAX - 10, T0, T0);
  const capped = await claimRaid(ctx, C, { receipt: await raidFor(C.id, `6:1:${DAY}`, priv), character: CH }, pubKey);
  assert.equal(capped.renown.xp, RENOWN_XP_MAX); assert.equal(capped.renown.credited, 10, 'no further than the cap');
  assert.equal(capped.renown.rose, true, 'the last ten points are the cap\'s level');
  // a claim that does not cross a level does not rise
  const E = await member(db);
  db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(E.id, CH, 'Mid', renownXpFor(20), T0, T0);
  const mid = await claimRaid(ctx, E, { receipt: await raidFor(E.id, `6:2:${DAY}`, priv), character: CH }, pubKey);
  assert.equal(mid.renown.credited, renownRaidXp(20)); assert.equal(mid.renown.level, 20); assert.equal(mid.renown.rose, false);
  // the tracks' bound
  const D = await member(db);
  for (let i = 0; i < RENOWN_TRACKS_MAX; i++) db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(D.id, `char-t${i}`, 'T', 0, T0, T0);
  const noPlace = await claimRaid(ctx, D, { receipt: await raidFor(D.id, `7:1:${DAY}`, priv), character: 'char-new1' }, pubKey);
  assert.deepEqual(noPlace, { recorded: true, defended: 1, spoils: false, renown: { character: 'char-new1', xp: null, level: null, credited: 0, rose: false } }, 'counted, and no place to pay');
  assert.equal(renownXpFor(2), 100);
});

async function stand({ gateKey = '' } = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: gateKey };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call, identity: await importPublicKeyB64(pub, { subtle }) };
}

test('RAID4 the worker: /v1/raid/claim behind a session and never open - the session is the claimant, never the body; a rise comes back with a signed renown order; the count on /v1/account and on the Inspect card\'s record; no public half is 503, another\'s receipt 403, a forged one 400 (mutants: the route open; the account view without the towns; the order unminted)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { priv, pub } = await relayPair();
  const { call, identity } = await stand({ gateKey: pub });
  assert.ok(ROUTES.has('/v1/raid/claim') && !OPEN_ROUTES.has('/v1/raid/claim'));
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const them = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Warden', password: 'correct horse battery', ...ACCEPTED }, me.secret)).status, 200);
  const r = await raidFor(me.id, `3:7:${DAY}`, priv, T0);
  assert.equal((await call('POST', '/v1/raid/claim', { receipt: r, character: CH })).status, 401, 'a stranger claims nothing');
  const ok = await call('POST', '/v1/raid/claim', { receipt: r, character: CH, name: 'Ann' }, me.secret);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.recorded, true); assert.equal(ok.body.defended, 1); assert.equal(ok.body.renown.rose, true);
  const v = await verifyOrder(ok.body.order, identity, { subtle, nowS: T0, kind: 'renown' });
  assert.equal(v.ok, true, 'the rise carries a signed order');
  assert.equal(v.claims.lv, ok.body.renown.level);
  const again = await call('POST', '/v1/raid/claim', { receipt: r, character: CH }, me.secret);
  assert.deepEqual(again.body, { recorded: false, why: 'claimed', defended: 1, spoils: false, order: null });
  assert.equal((await call('POST', '/v1/raid/claim', { receipt: r, character: CH }, them.secret)).status, 403, 'another\'s receipt');
  assert.equal((await call('POST', '/v1/raid/claim', { receipt: 'w1.x.y', character: CH }, me.secret)).status, 400);
  assert.deepEqual((await call('GET', '/v1/account', undefined, me.secret)).body.account.raids, { defended: 1 });
  assert.deepEqual((await call('POST', '/v1/duel/record', { id: me.id }, them.secret)).body.raids, { defended: 1 }, 'the Inspect card\'s record');
  const bare = await stand();
  const g = (await bare.call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.equal((await bare.call('POST', '/v1/raid/claim', { receipt: r, character: CH }, g.secret)).status, 503, 'no public half: the service\'s gap');
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════

test('RAID4 the client\'s call: the receipt, the character and its name to /v1/raid/claim under the stored session; none, no knock (mutants: the character unsent; a call with no session)', async () => {
  const calls = [];
  const storage = new Map([[SESSION_KEY, JSON.stringify({ id: 'acct-0001', secret: 'sss' })]]);
  const store = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization }); return new Response(JSON.stringify({ recorded: true, defended: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const door = accountRaids({ fetch, storage: store });
  assert.equal(door.me(), 'acct-0001');
  const a = await door.claim('w1.r.s', CH, 'Ann');
  assert.equal(a.ok, true);
  assert.match(calls[0].url, /\/v1\/raid\/claim$/);
  assert.deepEqual(calls[0].body, { receipt: 'w1.r.s', character: CH, name: 'Ann' });
  assert.equal(calls[0].auth, 'Bearer sss');
  storage.delete(SESSION_KEY);
  assert.deepEqual(await door.claim('w1.r.s', CH), { ok: false, error: 'no-session' });
  assert.equal(calls.length, 1, 'no knock without a session');
});

test('RAID4 the device\'s queue: a signed receipt is kept with the character that fought it, one a raid and account, and offered at once; a counted one is let go, said and handed on with its Renown; a guest\'s kept and said once; the day full let go and said once; a refusal the service can mend kept, one it cannot let go; another account\'s waits; the retry and the sign-in (mutants: the character dropped; an unsigned one kept; the guest let go; the retry ignored)', async () => {
  const { priv } = await relayPair();
  const nowS = T0;
  const store = new Map();
  const st = { get: (k) => store.get(k), set: (k, v) => store.set(k, v) };
  const said = [], heard = [];
  let answer = { ok: true, data: { recorded: true, defended: 3, renown: { character: CH, xp: 900, level: 5, credited: 780, rose: true } } };
  let t = 0, mine = 'acct-a';
  const asked = [];
  const q = createRaidClaims({ claim: async (r, ch, nm) => { asked.push({ r, ch, nm }); return answer; }, store: st, nowS: () => nowS, nowMs: () => t, say: (x) => said.push(x), onRecorded: (d, e) => heard.push({ d, e }), me: () => mine });
  const ra = await raidFor('acct-a', `3:7:${DAY}`, priv, nowS);
  assert.equal(q.add(await raidFor('acct-a', `3:7:${DAY}`, null, nowS), CH), false, 'an unsigned receipt is never kept');
  assert.equal(q.add(ra, ''), false, 'nor one with no character to pay');
  assert.equal(q.add(ra, CH, 'Ann'), true);
  await q.flush();
  assert.deepEqual(asked.at(-1), { r: ra, ch: CH, nm: 'Ann' });
  assert.deepEqual(said, [RAID_CLAIM_TEXT.recorded(3, 780)]);
  assert.equal(said[0], 'The town will remember you. Towns defended: 3. +780 Renown XP.');
  assert.equal(heard[0].d.renown.credited, 780);
  assert.deepEqual(q.kept(), [], 'counted: let go');
  // a guest - kept, said once
  const rb = await raidFor('acct-a', `3:8:${DAY}`, priv, nowS);
  answer = { ok: true, data: { recorded: false, why: 'guest', defended: 0 } };
  q.add(rb, CH); await q.flush(); await q.flush();
  assert.equal(said.filter((x) => x === RAID_CLAIM_TEXT.guest).length, 1);
  assert.equal(q.kept().length, 1, 'a guest may still register - kept');
  // the day full (answered to the offer the next add makes at once)
  answer = { ok: true, data: { recorded: false, why: 'day-full', defended: 6 } };
  assert.equal(q.add(rb, CH2), true); assert.equal(q.kept().length, 1, 'one a raid and account');
  await new Promise((res) => setImmediate(res));
  assert.equal(said.filter((x) => x === RAID_CLAIM_TEXT.dayFull).length, 1);
  assert.deepEqual(q.kept(), []);
  // refusals
  assert.equal(raidClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep', 'the service\'s key not the relay\'s pair - mendable');
  assert.equal(raidClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }), 'done');
  assert.equal(raidClaimVerdict({ ok: false, error: 'renown-character' }), 'done');
  assert.equal(raidClaimVerdict({ ok: false, error: 'no-session' }), 'keep');
  assert.equal(raidClaimVerdict({ ok: false, error: 'offline' }), 'keep');
  assert.equal(raidClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed' } }), 'done');
  // another account's waits; the sign-in asks at once; the retry
  const rc = await raidFor('acct-b', `3:9:${DAY}`, priv, nowS);
  answer = { ok: false, error: 'offline' };
  const n = asked.length;
  q.add(rc, CH); await q.flush();
  assert.equal(asked.length, n, 'not the signed-in account\'s');
  t += 2000;
  mine = 'acct-b';
  assert.equal(q.tick(), true, 'another account signed in: asked at once');
  await new Promise((res) => setImmediate(res));
  t += 2000;
  assert.equal(q.tick(), false, 'kept, and not due');
  t += RAID_CLAIM_RETRY_MS;
  assert.equal(q.tick(), true, 'due again');
  // the store's bound
  for (let i = 0; i < RAID_CLAIMS_MAX + 2; i++) q.add(await raidFor('acct-z', `8:${i}:${DAY}`, priv, nowS), CH);
  assert.equal(q.kept().length, RAID_CLAIMS_MAX);
  assert.equal(RAID_CLAIMS_KEY, 'raid4.raidClaims');
});

test('RAID4 the cards: the account card\'s row and the Inspect card\'s line say the towns defended - none yet for an account that has none, nothing at all for a stranger\'s none (mutants: the count unread; a stranger\'s none said)', () => {
  assert.equal(raidRecordText({ defended: 3 }), '3');
  assert.equal(raidRecordText({ defended: 0 }), 'None yet');
  assert.equal(raidRecordText(null), null);
  assert.equal(raidRecordText({ defended: -1 }), null);
  assert.equal(profileRaidLine({ raids: { defended: 2 } }), 'Towns defended: 2');
  assert.equal(profileRaidLine({ raids: { defended: 0 } }), null);
  assert.equal(profileRaidLine(null), null);
  const v = profileView({ name: 'Ann', peer: null, look: null, card: null, state: 'silent', record: { raids: { defended: 4 } } });
  assert.equal(v.raids, 'Towns defended: 4');
  assert.equal(typeof createProfileWindow, 'function');
  const acct = src('src/ui/enhancedAccount.js');
  assert.match(acct, /const raids = raidRecordText\(flow\.account\.raids\);\n\s+if \(raids\) row\('Towns defended', raids\);/);
});

test('RAID4 the world host by source: my receipt goes to the queue with the character that fought it; the queue claims through the account\'s door and is offered on the frame\'s clock; a counted raid\'s Renown is the page\'s only for the character that earned it', () => {
  const w = src('src/scenes/world.js');
  const at = w.indexOf('  setRaidingPartiesHost({');
  const body = w.slice(at, w.indexOf('\n  });', at));
  assert.match(body, /onRaidReceipt: \(r\) => \{ raidClaims\?\.add\(r, characterIdOf\(playerEntity\), typeof playerEntity\?\.name === 'string' \? playerEntity\.name : null, playerEntity\?\.level \?\? 1\); \},/);   // AUDIT RAID R4: with its level - the thanks wait for the service's word (onSpoils)
  assert.match(w, /onSpoils: \(entry\) => grantRaidSpoils\(entry\),/);
  assert.match(w, /const raidClaims = params\.has\('online'\) \? createRaidClaims\(\{\n(?:\s+\/\/[^\n]*\n)*\s+claim: \(r, ch, \.\.\.a\) => _accountRaids\.claim\(r, ch, \.\.\.a\)\.then\([^\n]*\n\s+me: _accountRaids\.me,/);   // PIN MOVED (AUDIT CHAP3 C4: said on the fighting character's page); PIN MOVED (CHAP2b): the answer handed on to the Roll's refresh
  // SERPENT1 keeps its own guard beside it: this one is the raid queue's own, read inside its block
  const rq = w.slice(w.indexOf("const raidClaims = params.has('online') ? createRaidClaims({"), w.indexOf('  }) : null;', w.indexOf("const raidClaims = params.has('online') ? createRaidClaims({")));
  assert.match(rq, /onRecorded: \(data\) => \{\n\s+if \(data\?\.renown\?\.character !== characterIdOf\(playerEntity\)\) return;/);
  assert.match(w, /raidClaims\?\.tick\(\);/);
});
