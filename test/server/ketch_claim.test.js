// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9): THE KETCHMASTER'S HOLD - the relay's `y1` receipt
// (net/ketch/ketchReceipt.js) minted, read and verified rung for rung, never another boss's; the account service's claim
// (server-account/src/ketch.js claimKetch, migration 0166): one row a (voyage, account) - the first receipt takes the
// week's share, the same ship again is the same kill, another crew's ship that voyage is `taken`; the route behind a
// session; the voyages sailed on the account card and the Inspect card; the device's book (net/ketch/ketchClaims.js) -
// kept, offered, paid, let go. tools/mutants/ketch_claim.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1 } from '../accountDb.mjs';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { createGuest } from '../../server-account/src/accounts.js';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';
import { claimKetch, ketchRecordOf } from '../../server-account/src/ketch.js';
import { QL_WITNESS_SQL } from '../../server-account/src/questlines.js';
import {
  KT_RECEIPT_V, KT_RECEIPT_TTL_S, KT_RECEIPT_BOSS, KT_EARNED, ketchReceiptValid, mintKetchReceipt, readKetchReceipt, verifyKetchReceipt,
} from '../../src/net/ketch/ketchReceipt.js';
import { mintSdReceipt, verifySdReceipt } from '../../src/net/superDungeon/sdReceipt.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../src/net/identityToken.js';
import { accountKetch, REFUSALS } from '../../src/net/accountClient.js';
import { createKetchClaims, ketchClaimVerdict, ketchRecordText, KT_CLAIMS_KEY, KT_CLAIM_RETRY_MS, KT_CLAIM_TEXT } from '../../src/net/ketch/ketchClaims.js';
import { profileKetchLine, profileRecordLines } from '../../src/ui/profileWindow.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const T0 = 1_800_000_000;
const SHIP_A = '0123456789abcdef', SHIP_B = 'fedcba9876543210';
let _handles = 0;
const member = async (db, { guest = false } = {}) => {
  const id = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  if (guest) return { id, handle: null };
  const h = `Skyfarer${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }), pub, kp };
}
const voyage = (s, d, o, key, { c = 4242, x = 'dealt', l = 30, nowS = T0, m } = {}) => mintKetchReceipt({ d, o, s, c, x, l, ...(m ? { m } : {}) }, key, { subtle, nowS });

test('KETCH THE RECEIPT: a `y1` - the voyage, the Warden, the crew\'s ship, the account, the seed, how it was earned, the level, issued and a week to expiry - minted signed or unsigned, read by the page either way, verified rung for rung; never an Hour\'s receipt nor one carrying another\'s fields (mutants: another boss believed; the ship unread; an expired one good; an Hour\'s h1 let through)', async () => {
  const { priv, pubKey, kp } = await relayPair();
  assert.deepEqual([KT_RECEIPT_V, KT_RECEIPT_TTL_S, KT_RECEIPT_BOSS, [...KT_EARNED]], ['y1', 7 * 24 * 3600, 'warden', ['dealt', 'stood']]);
  const r = await voyage('acct-ann', 3, SHIP_A, priv);
  const c = readKetchReceipt(r);
  assert.deepEqual({ ...c }, { d: 3, b: 'warden', o: SHIP_A, s: 'acct-ann', c: 4242, x: 'dealt', l: 30, i: T0, e: T0 + KT_RECEIPT_TTL_S, signed: true });
  assert.deepEqual(await verifyKetchReceipt(r, pubKey, { subtle, nowS: T0 + 10 }), { ok: true, claims: { d: 3, b: 'warden', o: SHIP_A, s: 'acct-ann', c: 4242, x: 'dealt', l: 30, i: T0, e: T0 + KT_RECEIPT_TTL_S } });
  const u = await voyage('acct-ann', 3, SHIP_A, null);
  assert.equal(readKetchReceipt(u).signed, false, 'unsigned is a real answer to the page');
  assert.deepEqual(await verifyKetchReceipt(u, pubKey, { subtle, nowS: T0 }), { ok: false, why: 'unsigned' });
  assert.deepEqual(await verifyKetchReceipt(r, pubKey, { subtle, nowS: T0 + KT_RECEIPT_TTL_S }), { ok: false, why: 'expired' });
  assert.deepEqual(await verifyKetchReceipt(r, pubKey, { subtle, nowS: T0 - 3600 }), { ok: false, why: 'future' });
  const other = await relayPair();
  assert.deepEqual(await verifyKetchReceipt(await voyage('acct-ann', 3, SHIP_A, other.priv), pubKey, { subtle, nowS: T0 }), { ok: false, why: 'signature' });
  const h1 = await mintSdReceipt({ d: 3, s: 'acct-ann', c: 1, x: 'dealt', l: 30 }, priv, { subtle, nowS: T0 });
  assert.deepEqual(await verifyKetchReceipt(h1, pubKey, { subtle, nowS: T0 }), { ok: false, why: 'version' });
  assert.equal(readKetchReceipt(h1), null);
  assert.equal((await verifySdReceipt(r, kp.publicKey, { subtle, nowS: T0 })).ok, false, 'and an Hour\'s verifier refuses a y1');
  const good = { d: 3, b: 'warden', o: SHIP_A, s: 'acct-ann', c: 1, x: 'stood', l: 1, i: T0, e: T0 + 60 };
  assert.equal(ketchReceiptValid(good), true);
  for (const bad of [{ b: 'remnant' }, { o: 'ABCDEF0123456789' }, { o: SHIP_A.slice(1) }, { x: 'witnessed' }, { l: 0 }, { d: -1 }, { e: T0 }, { e: T0 + KT_RECEIPT_TTL_S + 1 }, { n: 3 }, { t: 1 }]) assert.equal(ketchReceiptValid({ ...good, ...bad }), false, JSON.stringify(bad));
  await assert.rejects(voyage('acct-ann', 3, 'nope', priv), /refused a claim set/);
});

test('KETCH THE RECEIPT\'S VERSION IS ITS OWN: `y1` is no other relay-signed word\'s - every verifier refuses another\'s at its first rung, before a byte of the body (AUDIT KETCH L2-8: `k1` was the Watch\'s too; mutants: the Watch\'s letter)', async () => {
  const others = await Promise.all([
    ['../../src/net/gate/gateReceipt.js', 'RECEIPT_V'], ['../../src/net/serpent/serpentReceipt.js', 'SERPENT_RECEIPT_V'], ['../../src/net/siege/siegeReceipt.js', 'SIEGE_RECEIPT_V'],
    ['../../src/net/siege/siegeReceipt.js', 'ROYAL_RECEIPT_V'], ['../../src/net/eliteGates/egReceipt.js', 'EG_RECEIPT_V'], ['../../src/net/arena/arenaReceipt.js', 'ARENA_RECEIPT_V'],
    ['../../src/net/card/cardReceipt.js', 'CARD_RECEIPT_V'], ['../../src/net/productRecord.js', 'PRODUCT_RECORD_V'], ['../../src/net/watchReceipt.js', 'WATCH_RECEIPT_V'],
    ['../../src/net/superDungeon/sdReceipt.js', 'SD_RECEIPT_V'], ['../../src/net/gambit/gambitReceipt.js', 'GAMBIT_RECEIPT_V'], ['../../src/net/iliac/iliacReceipt.js', 'ILIAC_RECEIPT_V'],
    ['../../src/net/wild/wildReceipt.js', 'WILD_RECEIPT_V'], ['../../src/net/wild/wildReceipt.js', 'WILD_COLLECT_V'], ['../../src/net/wild/wildReceipt.js', 'SEA_WRECK_V'],
    ['../../src/net/duel/duelReceipt.js', 'DUEL_RECEIPT_V'], ['../../src/net/starfall/starReceipt.js', 'STAR_RECEIPT_V'], ['../../src/net/raid/raidReceipt.js', 'RAID_RECEIPT_V'],
    ['../../src/net/identityToken.js', 'TOKEN_V'],
  ].map(async ([f, k]) => (await import(f))[k]));
  assert.equal(KT_RECEIPT_V, 'y1');
  assert.ok(others.every((v) => typeof v === 'string' && v.length === 2), 'every version read');
  assert.ok(!others.includes(KT_RECEIPT_V), `the Ketch's letter is its own (taken: ${others.join(' ')})`);
  const { pubKey } = await relayPair();
  const watch = `${others[8]}.${Buffer.from(JSON.stringify({ d: 3 })).toString('base64url')}.`;
  assert.deepEqual(await verifyKetchReceipt(watch, pubKey, { subtle, nowS: T0 }), { ok: false, why: 'version' }, 'a Watch tick refused at its first rung');
});

test('KETCH THE CLAIM: a `y1` the relay signed, naming the claiming account, one row a (voyage, account) - the first takes the week\'s share; the same ship again the same kill (`claimed`, its share still the page\'s to roll); another crew\'s ship that voyage `taken`, no share; the next voyage pays again; another\'s, an unsigned one, a forged one refused; no public half no claim; a guest\'s written and said (mutants: the voyage not the key; the ship not compared; another\'s receipt claimed; the guest unsaid)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db), G = await member(db, { guest: true });
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  const C1 = '0123456789abcdef', C2 = 'fedcba9876543210';
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey, C1), { recorded: true, voyage: 3, share: true, sailed: 1 });
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv, { c: 9 }), pubKey, C1), { recorded: false, why: 'claimed', share: true, sailed: 1 }, 'the same device again, the same kill - a lost answer');
  // AUDIT KETCH L2-1: the relay hands the receipt to every hello of the account - another browser or device is paid nothing
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey, C2), { recorded: false, why: 'claimed', share: false, sailed: 1 }, 'another device: its share given already');
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey), { recorded: false, why: 'claimed', share: false, sailed: 1 }, 'no claim id: none');
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey, 'NOT-A-CID'), { recorded: false, why: 'claimed', share: false, sailed: 1 });
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_B, priv), pubKey, C1), { recorded: false, why: 'taken', share: false, sailed: 1 }, 'a second crew this week');
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 4, SHIP_B, priv), pubKey, C2), { recorded: true, voyage: 4, share: true, sailed: 2 }, 'next week');
  assert.deepEqual(await claimKetch(ctx, B, await voyage(A.id, 5, SHIP_A, priv), pubKey), { error: 'not-yours' });
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 5, SHIP_A, null), pubKey), { error: 'receipt', why: 'unsigned' });
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 5, SHIP_A, (await relayPair()).priv), pubKey), { error: 'receipt', why: 'signature' });
  assert.deepEqual(await claimKetch(ctx, A, await voyage(A.id, 5, SHIP_A, priv), null), { error: 'no-gate-key' });
  assert.deepEqual(await claimKetch(ctx, G, await voyage(G.id, 3, SHIP_A, priv), pubKey), { recorded: true, voyage: 3, share: true, sailed: 1, guest: true }, 'a guest\'s week is its account\'s too');
  const row = db._raw.prepare('SELECT voyage, account, owner, earned, lv, cid FROM ketch_voyages WHERE account = ? ORDER BY voyage').all(A.id);
  assert.deepEqual(row.map((q) => [q.voyage, q.owner, q.earned, q.lv, q.cid]), [[3, SHIP_A, 'dealt', 30, C1], [4, SHIP_B, 'dealt', 30, C2]]);
  assert.deepEqual(await ketchRecordOf(ctx, A.id), { sailed: 2 });
  assert.deepEqual(await ketchRecordOf(ctx, B.id), { sailed: 0 });
  // the questline's witness: the voyage's row
  assert.match(QL_WITNESS_SQL.ketch, /FROM ketch_voyages k WHERE k\.account = \?1/);
  // an account gone takes its voyages
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(A.id);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM ketch_voyages WHERE account = ?').get(A.id).n, 0);
});

async function stand({ gateKey = null } = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: gateKey ?? '' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call };
}

test('KETCH THE BUDGET\'S FILL RIDES THE ROW: a recorded share fills the playing character\'s bucket once, in the claim\'s own batch; a claim again, another device\'s, a crew\'s taken - none (AUDIT KETCH L2-9; mutants: the fill unguarded)', async () => {
  const db = d1();
  const A = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  db._raw.prepare('INSERT INTO realm_characters (id, player, name, created_at, updated_at, lease, allowance, level_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('rc1', A.id, 'Hero', 1, 1, 'lease1', 0, 10);
  const allowance = () => db._raw.prepare('SELECT allowance FROM realm_characters WHERE id = ?').get('rc1').allowance;
  await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey, '0123456789abcdef');
  const once = allowance();
  assert.ok(once > 0, 'filled');
  await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey, '0123456789abcdef');
  await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_A, priv), pubKey, 'fedcba9876543210');
  await claimKetch(ctx, A, await voyage(A.id, 3, SHIP_B, priv), pubKey, 'fedcba9876543210');
  assert.equal(allowance(), once, 'once a voyage');
  await claimKetch(ctx, A, await voyage(A.id, 4, SHIP_A, priv), pubKey, '0123456789abcdef');
  assert.equal(allowance(), 2 * once, 'the next voyage fills again');
});

test('KETCH THE WORKER: /v1/ketch/claim behind a session and never open - the session the claimant, never the body; the voyages sailed on /v1/account and the Inspect card\'s record; no public half 503, another\'s 403, a forged one 400 with its rung (mutants: the route unlisted; the cards without the voyages)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { priv, pub } = await relayPair();
  assert.ok(ROUTES.has('/v1/ketch/claim') && !OPEN_ROUTES.has('/v1/ketch/claim'));
  const { call } = await stand({ gateKey: pub });
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const them = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const r = await voyage(me.id, 6, SHIP_A, priv);
  assert.equal((await call('POST', '/v1/ketch/claim', { receipt: r })).status, 401, 'a stranger claims nothing');
  assert.deepEqual((await call('POST', '/v1/ketch/claim', { receipt: r, account: them.id }, me.secret)).body, { recorded: true, voyage: 6, share: true, sailed: 1, guest: true });
  assert.equal((await call('POST', '/v1/ketch/claim', { receipt: r }, them.secret)).status, 403, 'another\'s receipt');
  const forged = await call('POST', '/v1/ketch/claim', { receipt: await voyage(me.id, 7, SHIP_A, (await relayPair()).priv) }, me.secret);
  assert.deepEqual([forged.status, forged.body], [400, { error: 'receipt', why: 'signature' }]);
  const acct = (await call('GET', '/v1/account', undefined, me.secret)).body;
  assert.deepEqual(acct.account.ketch, { sailed: 1 }, 'the account card reads it here');
  assert.deepEqual((await call('POST', '/v1/duel/record', { id: me.id }, them.secret)).body.ketch, { sailed: 1 }, 'and the Inspect card');
  const bare = await stand();
  const g = (await bare.call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  const no = await bare.call('POST', '/v1/ketch/claim', { receipt: await voyage(g.id, 6, SHIP_A, priv) }, g.secret);
  assert.deepEqual([no.status, no.body.error], [503, 'no-gate-key']);
  for (const w of ['no-gate-key', 'receipt', 'not-yours']) assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
});

test('KETCH THE CLIENT\'S CALL: no session, no knock; with one the receipt goes as a POST with the bearer and nothing of mine (mutants: a knock with no session)', async () => {
  const sent = [];
  const fetch = async (u, i) => { sent.push([u, i]); return new Response(JSON.stringify({ recorded: true, voyage: 3, share: true, sailed: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const none = accountKetch({ fetch, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  assert.deepEqual(await none.claim('y1.x.'), { ok: false, error: 'no-session' });
  assert.equal(sent.length, 0);
  assert.equal(none.me(), null);
});

test('KETCH THE DEVICE\'S BOOK: a signed receipt the relay handed is kept (one a voyage, account and ship) with a claim id minted once, and offered at once with it; a share paid hands its claims to the hold; `taken` pays nothing and is said; counted, the count said; an unsigned or expired one never kept; another account\'s waits for its sign-in; a guest\'s counted and let go, told nothing false; the retry at most every ten minutes (mutants: the taken one paid; an unsigned one kept; another\'s offered; the claim id minted at every offer)', async () => {
  const { priv } = await relayPair();
  const store = new Map(), said = [], paid = [], offered = [];
  let me = 'acct-ann', clock = 0, n = 0, answer = { ok: false, error: 'offline' };
  const book = createKetchClaims({ claim: async (r, cid) => { offered.push([r, cid]); return answer; }, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, nowS: () => T0, nowMs: () => clock, say: (s) => said.push(s), me: () => me, paid: (c, d) => paid.push([c.d, c.o, d.why ?? 'recorded']), cid: () => (++n).toString(16).padStart(16, '0') });
  const r = await voyage('acct-ann', 3, SHIP_A, priv);
  assert.equal(book.add(r), true);
  await book.flush();
  clock += 11 * 60_000; book.tick(); await book.flush();
  await new Promise((go) => setImmediate(go));
  assert.ok(offered.length >= 2, 'offered again');
  assert.deepEqual([...new Set(offered.map(([, c]) => c))], ['0000000000000001'], 'one claim id a receipt, offered with it every time');
  answer = { ok: true, data: { recorded: true, voyage: 3, share: true, sailed: 1 } };
  clock += 11 * 60_000; book.tick(); await book.flush();
  assert.deepEqual(paid, [[3, SHIP_A, 'recorded']]);
  assert.deepEqual(said, [KT_CLAIM_TEXT.recorded(1)]);
  assert.deepEqual(store.get(KT_CLAIMS_KEY), [], 'counted: let go');
  answer = { ok: true, data: { recorded: false, why: 'taken', share: false, sailed: 1 } };
  book.add(await voyage('acct-ann', 3, SHIP_B, priv));
  await book.flush();
  assert.equal(paid.length, 1, 'taken: nothing thrown');
  assert.equal(said.at(-1), KT_CLAIM_TEXT.taken);
  assert.equal(book.add(await voyage('acct-ann', 4, SHIP_A, null)), false, 'unsigned: never kept');
  assert.equal(book.add(await voyage('acct-ann', 4, SHIP_A, priv, { nowS: T0 - KT_RECEIPT_TTL_S - 10 })), false, 'expired');
  answer = { ok: false, error: 'offline' };
  const theirs = await voyage('acct-bo', 5, SHIP_A, priv);
  book.add(theirs);
  await book.flush();
  assert.ok(!offered.some(([o]) => o === theirs), 'another\'s waits');
  assert.deepEqual(book.kept().map((e) => e.r), [theirs]);
  me = 'acct-bo';
  answer = { ok: true, data: { recorded: true, voyage: 5, share: true, sailed: 4, guest: true } };
  clock += 5000;
  assert.equal(book.tick(), true, 'signed in: offered');
  await book.flush();
  assert.ok(offered.some(([o]) => o === theirs));
  assert.equal(said.at(-1), KT_CLAIM_TEXT.recorded(4), 'a guest counted: told so, nothing false (AUDIT KETCH L2-7)');
  assert.deepEqual(book.kept(), [], 'and let go');
  clock += 1000;
  assert.equal(book.tick(), false, 'nothing kept: nothing offered');
  // the verdicts
  assert.equal(ketchClaimVerdict({ ok: true, data: { recorded: false, why: 'taken' } }), 'done');
  assert.equal(ketchClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed', guest: true } }), 'done');
  assert.equal(ketchClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep', 'a mendable rung');
  assert.equal(ketchClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }), 'done');
  assert.equal(ketchClaimVerdict({ ok: false, error: 'not-yours' }), 'done');
  assert.equal(ketchClaimVerdict({ ok: false, error: 'no-session' }), 'keep');
});

test('KETCH THE HOLD PAYS THIS DEVICE ONCE: a `claimed` answered with this device\'s share (a lost answer\'s retry) pays and says the questline\'s act; a crash after the act was kept says it never again; another device\'s `claimed` pays nothing and says nothing (AUDIT KETCH L2-1, L2-6; mutants: the act said only at `recorded`; the act said at every share)', async () => {
  const { priv } = await relayPair();
  const { hearActs } = await import('../../src/systems/questlines/qlActs.js');
  const acts = [];
  hearActs('ketch-test', (k) => { if (k === 'warden-felled') acts.push(k); });
  try {
    const store = new Map(), paid = [];
    let answer = { ok: true, data: { recorded: false, why: 'claimed', share: true, sailed: 1 } };
    const book = createKetchClaims({ claim: async () => answer, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, nowS: () => T0, nowMs: () => 0, me: () => 'acct-ann', paid: (c) => paid.push(c.d) });
    const r3 = await voyage('acct-ann', 3, SHIP_A, priv);
    book.add(r3);
    await book.flush();
    assert.deepEqual([paid, acts.length], [[3], 1], 'a retry\'s own share: paid, and its act said');
    store.set(KT_CLAIMS_KEY, [{ r: r3, cid: '00000000000000aa', a: 1 }]);   // a crash after the act was kept, before the receipt was let go
    await book.flush();
    assert.deepEqual([paid, acts.length], [[3, 3], 1], 'paid again (the pool\'s own mark makes it one), its act never again');
    answer = { ok: true, data: { recorded: false, why: 'claimed', share: false, sailed: 1 } };
    book.add(await voyage('acct-ann', 5, SHIP_A, priv));
    await book.flush();
    assert.deepEqual([paid, acts.length], [[3, 3], 1], 'another device\'s claimed: nothing');
  } finally { hearActs('ketch-test', null); }
});

test('KETCH THE WORDS AND THE CARDS: the account card\'s row says the count or "None yet" (a service from before it, nothing); the Inspect card says it once there is one, through the record\'s one door (mutants: the line said at none)', () => {
  assert.equal(ketchRecordText({ sailed: 3 }), '3');
  assert.equal(ketchRecordText({ sailed: 0 }), 'None yet');
  assert.equal(ketchRecordText(undefined), null);
  assert.equal(profileKetchLine({ ketch: { sailed: 2 } }), 'Voyages sailed: 2');
  assert.equal(profileKetchLine({ ketch: { sailed: 0 } }), null);
  assert.equal(profileRecordLines({ ketch: { sailed: 1 }, stars: { held: 2 } }).voyages, 'Voyages sailed: 1');
  assert.equal(profileRecordLines({ stars: { held: 2 } }).stars, 'Stars held: 2', 'the stars through the same door');
});

test('KETCH the hosts and the service by source: the route and its migration, the version\'s note, the cards\' rows, the world host\'s book (mutants: the migration\'s key not the week\'s)', () => {
  const mig = src('server-account/migrations/0166_ketch_voyages.sql');
  assert.match(mig, /PRIMARY KEY \(voyage, account\)/);
  assert.match(mig, /REFERENCES players\(id\) ON DELETE CASCADE/);
  assert.match(src('server-account/src/index.js'), /path === '\/v1\/ketch\/claim' && request\.method === 'POST'/);
  assert.match(src('server-account/src/service.js'), /acct181: KETCH/);   // PIN MOVED (the merge): acct181, KETCH - acct180 on its branch, renumbered past FOE-KEEPS'
  assert.match(src('src/ui/enhanced/enhancedAccount.js'), /ketchRecordText\(flow\.account\.ketch\)/);
  assert.match(src('src/scenes/world.js'), /\.\.\.profileRecordLines\(rec\)/);
  assert.match(src('src/scenes/ketch/ketchClient.js'), /createKetchClaims\(/);
});
