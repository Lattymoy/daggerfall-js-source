// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 5 and 23): THE ELITE BREACH AS
// THE ACCOUNT SERVICE KEEPS IT - the Weir Keys on the account's row and the key rolled at a gate's claim, the open that
// stakes one (or the day's Rehearsal) and signs the order the hub opens on, idempotent on its request id; one live breach
// an account; a member's admission; the relay's `e1` receipts claimed once - a Redoubt, an end, a void - and the stake
// settled by them. The real Worker over node:sqlite with every migration (test/accountDb.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { verifyOrder, orderValid, mintEgOrder, ORDER_KINDS, EG_ORDER_FIELDS } from '../../../src/net/identityToken.js';
import { mintEgReceipt, readEgReceipt, verifyEgReceipt, egReceiptValid, EG_RECEIPT_V } from '../../../src/net/eliteGates/egReceipt.js';
import { EG_LIVE_S, EG_LAST_WORD_S, EG_KEY_PITY } from '../../../server-account/src/eg.js';
import { EG_LAST_WORD_MS } from '../../../src/net/eliteGates/egLaw.js';
import { arenaWeekOf } from '../../../src/net/arena/arenaLaw.js';   // EG-E1: the week the Panoply sink keeps
import { egSpoilsSeed } from '../../../src/net/eliteGates/egPay.js';   // AUDIT EG V: the spoils' seed a claim answers

const { subtle } = globalThis.crypto;
const RQ = 'rq0123456789abcdef';
/** A service standing, a registered account that has closed a gate (so it may stake), the clock at T0. */
async function stood(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService();
  const me = await S.registered('KeyBearer');
  return { S, me, at: (s) => { clock = s * 1000; } };
}
const keysOf = (S, id) => S.env.DB._raw.prepare('SELECT eg_keys AS k FROM players WHERE id = ?').get(id).k;

test('EG-PLAY THE KEYS: a fresh account holds none and may not stake (`unproven`); its first breach closed rolls one, certain (the gate claim answers `weir`); the open stakes it and signs an egopen order the relay verifies; the same request id asked again is the same breach, never a second key (mutants: the open without the stake; the request id ignored; the order unsigned)', async (t) => {
  const { S, me } = await stood(t);
  const k0 = (await S.call('/v1/eg/keys', {}, me.secret)).body;
  // PIN MOVED (EG-F, 2026-10-12): the keys' answer carries the relay's public half too (`rk`, GATE_PUBLIC_KEY - the key a
  // stranger's arch is verified with, bible/11-Multiplayer/Elite-Gates.md section 6.3)
  assert.deepEqual(k0, { keys: 0, live: null, rehearsal: true, proven: false, redoubts: 0, sink: { week: arenaWeekOf(T0), piece: null }, annals: 0, feats: {}, first: 0, rk: S.env.GATE_PUBLIC_KEY }, 'PIN MOVED (EG-E2): and what the account keeps of the Spire - the Annals\' pages and each lord\'s feats (egHonours.js egRecordOf); PIN MOVED (EG-ZF): and the first-time lines it has been shown (`first`, Elite-Gates.md section 27.7)');   // PIN MOVED (EG-E1): and the week's Panoply sink (server-account/src/egEconomy.js egSinkOf)
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ }, me.secret)).body, { error: 'unproven' });
  const g = (await S.claim(me, 700, T0)).body;
  assert.deepEqual(g.weir, { found: true, keys: 1 }, 'the first breach closed gives the Spire once');
  const open = await S.call('/v1/eg/open', { rq: RQ }, me.secret);
  assert.equal(open.status, 200);
  assert.equal(open.body.keys, 0, 'the key is staked');
  assert.match(open.body.b, /^[0-9a-f]{16}$/);
  assert.equal(open.body.until, T0 + EG_LIVE_S);
  const v = await verifyOrder(open.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egopen' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.s, v.claims.eb, v.claims.ez, v.claims.ew, v.claims.rh], [me.id, open.body.b, open.body.ez, 0, undefined]);
  const again = (await S.call('/v1/eg/open', { rq: RQ }, me.secret)).body;
  assert.deepEqual([again.b, again.ez, again.keys], [open.body.b, open.body.ez, 0], 'asked again: the same breach, no second key');
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM eg_stakes').get().n, 1);
  // ONE LIVE BREACH: another request is refused while this one holds
  const second = await S.call('/v1/eg/open', { rq: 'rq0123456789abcdeX'.toLowerCase().replace('x', 'z') }, me.secret);
  assert.deepEqual([second.status, second.body.error, second.body.b], [409, 'live', open.body.b]);
  assert.deepEqual((await S.call('/v1/eg/keys', {}, me.secret)).body.live, { b: open.body.b, until: T0 + EG_LIVE_S });
});

test('EG-PLAY THE REHEARSAL: any registered account may open one a real day with no key (`rh` 1 on the order); a second the same day is `rehearsed`; a guest opens nothing; a bad request id is refused (mutants: the Rehearsal taking a key; the day never spent)', async (t) => {
  const { S, me, at } = await stood(t);
  const r = await S.call('/v1/eg/open', { rq: RQ, rh: 1 }, me.secret);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.keys, r.body.rh], [0, 1]);
  const v = await verifyOrder(r.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egopen' });
  assert.equal(v.claims.rh, 1);
  // its breach must end before another opens: clear the live breach as an end receipt would
  S.env.DB._raw.prepare('UPDATE players SET eg_live_b = NULL, eg_live_until = 0 WHERE id = ?').run(me.id);
  assert.deepEqual((await S.call('/v1/eg/open', { rq: 'rq1123456789abcdef', rh: 1 }, me.secret)).body, { error: 'rehearsed' });
  at(T0 + 86_400);
  assert.equal((await S.call('/v1/eg/open', { rq: 'rq2123456789abcdef', rh: 1 }, me.secret)).status, 200, 'a new day, a new Rehearsal');
  const g = await S.guest();
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ, rh: 1 }, g.secret)).body, { error: 'guest' });
  assert.deepEqual((await S.call('/v1/eg/open', { rq: 'BAD', rh: 1 }, me.secret)).body, { error: 'rq' });
  assert.equal((await S.call('/v1/eg/open', { rq: RQ })).status, 401, 'no session, no breach');
});

test('EG-PLAY THE ADMISSION: a member asks for breach b and is signed an egadmit order and its live breach set; a member held in another breach is refused `live`; the same breach again is admitted (a reload) (mutants: an admission over another live breach; the order for another account)', async (t) => {
  const { S, me } = await stood(t);
  // PIN MOVED (AUDIT EG III, lane3 #9): a breach is one a stake opened (an id no open staked is refused `breach`) - two
  // openers' breaches
  const op1 = await S.registered('OpenerOne'), op2 = await S.registered('OpenerTwo');
  await S.claim(op1, 700, T0); await S.claim(op2, 701, T0);
  const b = (await S.call('/v1/eg/open', { rq: RQ }, op1.secret)).body.b, other = (await S.call('/v1/eg/open', { rq: RQ }, op2.secret)).body.b;
  assert.deepEqual((await S.call('/v1/eg/admit', { b: '0123456789abcdef' }, me.secret)).body, { error: 'breach' }, 'no stake, no breach');
  const a = await S.call('/v1/eg/admit', { b }, me.secret);
  assert.equal(a.status, 200);
  const v = await verifyOrder(a.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egadmit' });
  assert.ok(v.ok);
  assert.deepEqual([v.claims.s, v.claims.eb], [me.id, b]);
  assert.equal((await S.call('/v1/eg/admit', { b }, me.secret)).status, 200, 'the same breach again');
  const no = await S.call('/v1/eg/admit', { b: other }, me.secret);
  assert.deepEqual([no.status, no.body.error, no.body.b], [409, 'live', b]);
  assert.deepEqual((await S.call('/v1/eg/admit', { b: 'nope' }, me.secret)).body, { error: 'breach' });
});

test('EG-PLAY THE CLAIM: a Redoubt\'s `w` is counted once a (breach, account, Redoubt) and spends the stake; the opener\'s end `x` clears the live breach; a void `v` gives the key back once; another\'s receipt 403, a forged one 400 with its rung (mutants: a Redoubt counted twice; the stake never spent; the void paid twice)', async (t) => {
  const { S, me } = await stood(t);
  await S.claim(me, 700, T0);
  const open = (await S.call('/v1/eg/open', { rq: RQ }, me.secret)).body;
  const w = await mintEgReceipt({ q: 'w', b: open.b, s: me.id, z: open.ez, c: 77, w: 1, h: 5, t: 900, n: 1, ew: 0, l: 12 }, S.gatePriv, { subtle, nowS: T0 });
  const c1 = await S.call('/v1/eg/claim', { receipt: w }, me.secret);
  // PIN MOVED (EG-E1): a Redoubt's answer says what it paid (server-account/src/egEconomy.js egRedoubtPay - the week's first:
  // paid, its first-this-season ember into the purse beside the gate's; Marks shut here) and, asked again, the same pay
  // PIN MOVED (AUDIT EG V, d: lane8 L8-5): and the seed its spoils roll on - the receipt's mixed with the row's own draw
  const nonce = S.env.DB._raw.prepare('SELECT nonce FROM eg_redoubts WHERE b = ? AND account = ?').get(open.b, me.id).nonce;
  const pay = { b: open.b, w: 1, paid: true, marks: null, deed: null, embers: 1, purse: 2, weir: null, pity: [], seed: egSpoilsSeed(77, nonce) };
  assert.match(nonce, /^[0-9a-f]{16}$/);
  assert.deepEqual(c1.body, { recorded: true, q: 'w', keys: 0, ...pay });
  assert.deepEqual((await S.call('/v1/eg/claim', { receipt: w }, me.secret)).body, { recorded: false, why: 'claimed', q: 'w', keys: 0, ...pay, again: true });
  assert.equal(S.env.DB._raw.prepare('SELECT state FROM eg_stakes WHERE ez = ?').get(open.ez).state, 'spent');
  const x = await mintEgReceipt({ q: 'x', b: open.b, s: me.id, z: open.ez, c: 78, h: 5, t: 960, n: 1, ew: 0, l: 12, why: 'home' }, S.gatePriv, { subtle, nowS: T0 });
  assert.equal((await S.call('/v1/eg/claim', { receipt: x }, me.secret)).body.recorded, true);
  assert.deepEqual((await S.call('/v1/eg/keys', {}, me.secret)).body.live, null, 'the end clears the live breach');
  assert.equal((await S.call('/v1/eg/keys', {}, me.secret)).body.redoubts, 1);
  // another's receipt, a forged one
  const them = await S.registered('Other');
  assert.equal((await S.call('/v1/eg/claim', { receipt: w }, them.secret)).status, 403);
  const forged = await S.call('/v1/eg/claim', { receipt: `${EG_RECEIPT_V}.e30.AAAA` }, me.secret);
  assert.equal(forged.status, 400);
  assert.equal(forged.body.error, 'receipt');
});

test('EG-PLAY THE STAKE SETTLED: a void returns the key once; the first breach\'s mercy returns it once ever when the opener\'s end comes before Redoubt 1 - the second such breach spends it; a member\'s own end never settles the opener\'s stake (mutants: the mercy every time; a member\'s fall spending the opener\'s key)', async (t) => {
  const { S, me, at } = await stood(t);
  await S.claim(me, 700, T0);
  S.env.DB._raw.prepare('UPDATE players SET eg_keys = 3 WHERE id = ?').run(me.id);
  // a void
  const o1 = (await S.call('/v1/eg/open', { rq: RQ }, me.secret)).body;
  assert.equal(keysOf(S, me.id), 2);
  const v = await mintEgReceipt({ q: 'v', b: o1.b, s: me.id, z: o1.ez }, S.gatePriv, { subtle, nowS: T0 });
  assert.equal((await S.call('/v1/eg/claim', { receipt: v }, me.secret)).body.recorded, true);
  assert.equal((await S.call('/v1/eg/claim', { receipt: v }, me.secret)).body.keys, 3, 'the void pays once');
  // the mercy: an end before Redoubt 1, once ever
  const o2 = (await S.call('/v1/eg/open', { rq: 'rq3123456789abcdef' }, me.secret)).body;
  const member = await S.registered('Member');
  const mx = await mintEgReceipt({ q: 'x', b: o2.b, s: member.id, z: o2.ez, c: 1, h: 1, t: 60, n: 2, ew: 0, l: 5, why: 'fall' }, S.gatePriv, { subtle, nowS: T0 });
  await S.call('/v1/eg/claim', { receipt: mx }, member.secret);
  assert.equal(S.env.DB._raw.prepare('SELECT state FROM eg_stakes WHERE ez = ?').get(o2.ez).state, 'held', 'a member\'s fall is not the opener\'s end');
  // PIN MOVED (AUDIT EG III, lane3 #6): the mercy waits for the relay's word that the BREACH ended with no Redoubt taken
  // (`nr` - net/eliteGates/egBrain.js oweEnd: here the opener's fall left nobody living)
  const x2 = await mintEgReceipt({ q: 'x', b: o2.b, s: me.id, z: o2.ez, c: 2, h: 2, t: 120, n: 2, ew: 0, l: 12, why: 'fall', nr: 1 }, S.gatePriv, { subtle, nowS: T0 });
  assert.equal((await S.call('/v1/eg/claim', { receipt: x2 }, me.secret)).body.keys, 3, 'the first breach\'s mercy');
  at(T0 + 10);
  const o3 = (await S.call('/v1/eg/open', { rq: 'rq4123456789abcdef' }, me.secret)).body;
  const x3 = await mintEgReceipt({ q: 'x', b: o3.b, s: me.id, z: o3.ez, c: 3, h: 2, t: 120, n: 1, ew: 0, l: 12, why: 'fall', nr: 1 }, S.gatePriv, { subtle, nowS: T0 + 10 });
  assert.equal((await S.call('/v1/eg/claim', { receipt: x3 }, me.secret)).body.keys, 2, 'mercy is once ever');
  assert.equal(S.env.DB._raw.prepare('SELECT state FROM eg_stakes WHERE ez = ?').get(o3.ez).state, 'spent');
});

test('EG-PLAY THE PITY: five recorded gate kills in a row with no key, and the sixth gives one, whatever the die (mutants: the pity never; the miss count never reset)', async (t) => {
  const { S, me } = await stood(t);
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => (b.length === 4 ? b.fill(0xff) : real(b)));   // the die always high: no key by chance
  assert.equal((await S.claim(me, 700, T0)).body.weir.found, true, 'the first is certain');
  const found = [];
  for (let d = 701; d <= 707; d++) found.push((await S.claim(me, d, T0)).body.weir.found);
  assert.deepEqual(found, [false, false, false, false, false, true, false]);
  assert.equal(EG_KEY_PITY, 5);
});

test('EG-PLAY THE ORDERS AND THE RECEIPT, PURE: egopen and egadmit join ORDER_KINDS with their own exclusive fields (a stake carrying `eb` is refused, an admit carrying `rh`); e1 carries `q`, never an identity\'s `k`; the live bound is the law\'s last word (mutants: a breach field on another kind; the Rehearsal on an admit)', async () => {
  assert.ok(ORDER_KINDS.includes('egopen') && ORDER_KINDS.includes('egadmit'));
  assert.deepEqual([...EG_ORDER_FIELDS], ['eb', 'ez', 'ew', 'rh', 'ewg'], 'PIN MOVED (EG-F): `ewg`, the open\'s Wager, joins its own fields');
  const base = { s: 'acct-1234', i: 100, e: 160 };
  assert.ok(orderValid({ o: 'egopen', ...base, eb: '0123456789abcdef', ez: 'z'.repeat(16), ew: 0, rh: 1 }));
  assert.ok(!orderValid({ o: 'egadmit', ...base, eb: '0123456789abcdef', ez: 'z'.repeat(16), ew: 0, rh: 1 }), 'an admission is never a Rehearsal');
  assert.ok(!orderValid({ o: 'mute', ...base, mu: 0, eb: '0123456789abcdef' }), 'a mute carrying a breach');
  assert.ok(!orderValid({ o: 'egopen', ...base, eb: 'XYZ', ez: 'z'.repeat(16), ew: 0 }));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintEgOrder({ o: 'egadmit', s: 'acct-1234', eb: '0123456789abcdef', ez: 'z'.repeat(20) }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyOrder(tok, kp.publicKey, { subtle, nowS: 1000, kind: 'egopen' })).ok, false, 'an admission at the open\'s door');
  assert.equal((await verifyOrder(tok, kp.publicKey, { subtle, nowS: 1000, kind: 'egadmit' })).ok, true);
  const w = { q: 'w', b: '0123456789abcdef', s: 'acct-1234', z: 'z'.repeat(16), c: 1, w: 1, h: 5, t: 10, n: 1, ew: 0, l: 3, i: 1, e: 2 };
  assert.ok(egReceiptValid(w));
  assert.ok(!egReceiptValid({ ...w, k: 'w' }), 'never an identity\'s `k`');
  assert.ok(!egReceiptValid({ ...w, why: 'home' }), 'a Redoubt carries no end');
  const r = await mintEgReceipt({ q: 'x', b: '0123456789abcdef', s: 'acct-1234', z: 'z'.repeat(16), c: 9, h: 3, t: 10, n: 1, ew: 0, l: 3, why: 'tear' }, null, { subtle, nowS: 50 });
  assert.equal(readEgReceipt(r).signed, false);
  assert.deepEqual(await verifyEgReceipt(r, kp.publicKey, { subtle, nowS: 50 }), { ok: false, why: 'unsigned' });
  assert.equal(EG_LAST_WORD_S * 1000, EG_LAST_WORD_MS, 'the service\'s last word is the law\'s (pinned equal)');
});
