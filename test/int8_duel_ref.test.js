// INT8 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): THE DUEL REFEREED. DUEL1 left every blow to the defender's own machine and every result to the
// loser's own word - a client that never took damage never fell (the player's report: "no damage"), and one that never
// said it lost never did. Now the relay that routes a duel holds it (net/duelRef.js): it sets the bout on the start it
// watched being asked and answered, judges every blow and cast (routed to nobody), holds the ring, ends the bout, and
// hands both fighters a signed receipt naming the winner (net/duelReceipt.js `d1`), which the account service counts
// once (test/duel_record.test.js). Pinned: the receipt's law, the referee's law, and the relay over the real Room
// (test/fakeRoom.mjs) - a crafted client's every lie it used to tell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { mintDuelReceipt, readDuelReceipt, verifyDuelReceipt, duelReceiptValid, DUEL_RECEIPT_V, DUEL_RECEIPT_TTL_S, DUEL_RECEIPT_MAX } from '../src/net/duelReceipt.js';
import { newDuelRef, duelNote, duelOpen, duelBlow, duelPose, duelForfeit, duelStep, duelBoutOf, duelVitals, DUEL_REF } from '../src/net/duelRef.js';
import { ROYAL_RING, SIEGE_UNITS_PER_M, SIEGE_HIT, siegeVitality, siegeBlowMax, SIEGE_CASTS } from '../src/net/siegeRef.js';
import { mintRoyalReceipt, verifyRoyalReceipt } from '../src/net/siegeReceipt.js';
import { validDuelRefOut, DUEL_REF_RECEIPT_MAX, parseClient } from '../src/net/wire.js';
import { DUEL_START_WAIT_MS, DUEL_OUT_MS, DUEL_GONE_MS } from '../src/net/duelSession.js';
import { createDuelClaims, duelClaimSettles } from '../src/net/siegeClaims.js';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000;
const keys = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

test('INT8 THE RECEIPT: `d1` names the two fighters and the winner\'s place, the bout\'s id, a day\'s life; the version is inside the signature (a Royal Tourney\'s `t1` never reads as one, nor one as it), another receipt\'s fields refused outright; unsigned with no key, which the service declines (mutants: the version outside the signed bytes; a foreign field admitted; the winner\'s place unbounded; a self-duel)', async () => {
  const kp = await keys();
  const rc = await mintDuelReceipt({ f: ['acct-aaaa', 'acct-bbbb'], w: 1, n: '0123456789ab' }, kp.privateKey, { subtle, nowS: T });
  assert.ok(rc.startsWith(`${DUEL_RECEIPT_V}.`) && rc.length <= DUEL_RECEIPT_MAX);
  assert.deepEqual(readDuelReceipt(rc), { f: ['acct-aaaa', 'acct-bbbb'], w: 1, n: '0123456789ab', i: T, e: T + DUEL_RECEIPT_TTL_S, signed: true });
  const v = await verifyDuelReceipt(rc, kp.publicKey, { subtle, nowS: T + 10 });
  assert.equal(v.ok, true);
  assert.equal((await verifyDuelReceipt(rc, kp.publicKey, { subtle, nowS: T + DUEL_RECEIPT_TTL_S })).why, 'expired');
  // the version is signed: the body of a d1 under t1's version, and a t1 offered as a d1
  const [, body, sig] = rc.split('.');
  assert.equal((await verifyRoyalReceipt(`t1.${body}.${sig}`, kp.publicKey, { subtle, nowS: T })).ok, false, 'a duel\'s receipt is no Royal Tourney\'s');
  const t1 = await mintRoyalReceipt({ s: 'acct-aaaa', l: 'acct-bbbb', sk: 1, sw: 2, n: 3 }, kp.privateKey, { subtle, nowS: T });
  assert.equal((await verifyDuelReceipt(t1, kp.publicKey, { subtle, nowS: T })).why, 'version');
  const [, tb, ts] = t1.split('.');
  assert.equal((await verifyDuelReceipt(`d1.${tb}.${ts}`, kp.publicKey, { subtle, nowS: T })).ok, false, 'nor a t1\'s body under d1');
  // the claims' own law
  const ok = { f: ['acct-aaaa', 'acct-bbbb'], w: 0, n: '0123456789ab', i: T, e: T + 60 };
  assert.equal(duelReceiptValid(ok), true);
  for (const bad of [{ w: 2 }, { w: '0' }, { f: ['acct-aaaa', 'acct-aaaa'] }, { f: ['acct-aaaa'] }, { n: 'zz' }, { e: T + DUEL_RECEIPT_TTL_S + 1 }, { s: 'acct-aaaa' }, { l: 'acct-bbbb' }, { a: 'p' }, { r: 1 }, { sk: 1 }]) {
    assert.equal(duelReceiptValid({ ...ok, ...bad }), false, JSON.stringify(bad));
  }
  const unsigned = await mintDuelReceipt({ f: ['acct-aaaa', 'acct-bbbb'], w: 0, n: '0123456789ab' }, null, { subtle, nowS: T });
  assert.equal(readDuelReceipt(unsigned).signed, false);
  assert.equal((await verifyDuelReceipt(unsigned, kp.publicKey, { subtle, nowS: T })).why, 'unsigned');
  assert.equal(DUEL_REF_RECEIPT_MAX, DUEL_RECEIPT_MAX, 'the wire carries the longest one');
});

/** Two fighters' sides for the referee's law, a few metres apart at the ring's centre. */
const at = (x, z = 0) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M + z * M });
const C = [1000 * M, 0, 1000 * M];
function opened({ now = 10_000, a = at(-2), b = at(2) } = {}) {
  const st = newDuelRef();
  duelNote(st, 'ask', 'acct-a', 'acct-b', 'duel123456', now);
  duelNote(st, 'yes', 'acct-b', 'acct-a', 'duel123456', now + 100);
  const r = duelOpen(st, { a: { sub: 'acct-a', id: 'peer-a', pose: a, lv: 10 }, b: { sub: 'acct-b', id: 'peer-b', pose: b, lv: 50 }, s: 'duel123456', c: C, n: 'aaaaaaaaaaaa' }, now + 200);
  assert.ok(r.bout, JSON.stringify(r));
  return { st, bout: r.bout, t0: now + 200 };
}

test('INT8 THE REFEREE\'S LAW, THE BOUT: set only on a start whose ask and yes it saw, with this duel\'s id, inside their windows; neither fighter in another bout; both bodies inside the ring; both whole at the Royal Tourney\'s vitality (mutants: a start with no yes set; a stale yes set; a fighter in two bouts; a ring far from the bodies)', () => {
  const { st, bout, t0 } = opened();
  assert.deepEqual(duelVitals(bout), [['peer-a', siegeVitality(10), siegeVitality(10)], ['peer-b', siegeVitality(50), siegeVitality(50)]]);
  assert.deepEqual([bout.startMs, bout.endMs], [t0 + ROYAL_RING.countdownMs, t0 + ROYAL_RING.countdownMs + ROYAL_RING.boutMs]);
  assert.equal(duelBoutOf(st, 'acct-a'), bout);
  const tryOpen = (notes, { a = at(-2), b = at(2), c = C, now = 50_000, s = 'duel999999' } = {}) => {
    const x = newDuelRef();
    for (const [k, from, to, sid, t] of notes) duelNote(x, k, from, to, sid, t);
    return duelOpen(x, { a: { sub: 'acct-a', id: 'peer-a', pose: a, lv: 1 }, b: { sub: 'acct-b', id: 'peer-b', pose: b, lv: 1 }, s, c, n: 'bbbbbbbbbbbb' }, now);
  };
  const both = [['ask', 'acct-a', 'acct-b', 'duel999999', 49_000], ['yes', 'acct-b', 'acct-a', 'duel999999', 49_500]];
  assert.ok(tryOpen(both).bout);
  assert.deepEqual(tryOpen([both[0]]), { no: 'timeout' }, 'no yes seen');
  assert.deepEqual(tryOpen([both[1]]), { no: 'timeout' }, 'no ask seen');
  assert.deepEqual(tryOpen([both[0], ['yes', 'acct-b', 'acct-a', 'another12', 49_500]]), { no: 'timeout' }, 'a yes to another duel');
  assert.deepEqual(tryOpen([both[0], ['yes', 'acct-b', 'acct-a', 'duel999999', 50_000 - DUEL_REF.startWaitMs - 1]]), { no: 'timeout' }, 'a yes past its wait');
  assert.deepEqual(tryOpen(both, { b: at(ROYAL_RING.radiusM + 1) }), { no: 'range' }, 'a body outside the ring');
  assert.deepEqual(tryOpen(both, { c: [C[0] + 50 * M, 0, C[2]] }), { no: 'range' }, 'a ring far from both');
  // one bout a fighter
  duelNote(st, 'ask', 'acct-a', 'acct-c', 'duel777777', t0);
  duelNote(st, 'yes', 'acct-c', 'acct-a', 'duel777777', t0);
  assert.deepEqual(duelOpen(st, { a: { sub: 'acct-a', id: 'peer-a', pose: at(0), lv: 1 }, b: { sub: 'acct-c', id: 'peer-c', pose: at(1), lv: 1 }, s: 'duel777777', c: C, n: 'cccccccccccc' }, t0 + 10), { no: 'busy' });
  assert.equal(DUEL_REF.startWaitMs, DUEL_START_WAIT_MS, 'the client\'s wait, pinned equal');
  assert.equal(DUEL_REF.outMs, DUEL_OUT_MS);
  assert.equal(ROYAL_RING.goneMs, DUEL_GONE_MS);
});

test('INT8 THE REFEREE\'S LAW, THE BLOWS: none before the count runs; a strike clipped to the weapon\'s bucket and the signed arms, a cast to sixty three a five seconds; only at the opponent; a fall at none left (mutants: a blow in the count; the clip unread; the arms unread; a third body struck; the cast\'s rate unread)', () => {
  const { st, bout } = opened();
  const s = bout.startMs;
  assert.equal(duelBlow(st, 'acct-a', 'peer-b', { d: 50, held: { w: -1, m: 0 } }, s - 1).why, 'not-live', 'the count');
  const r = duelBlow(st, 'acct-a', 'peer-b', { d: 999, held: { w: 123, m: 9 } }, s);
  assert.deepEqual([r.ok, r.dealt], [true, siegeBlowMax(123, 9)], 'clipped to a Daedric Dai-Katana\'s bucket');
  const signed = duelBlow(st, 'acct-a', 'peer-b', { d: 999, held: { w: 123, m: 9 }, wa: [16, 0] }, s + 300);
  assert.equal(signed.dealt, siegeBlowMax(123, 9, [16, 0]), 'INT7: and the pack\'s signed reach');
  assert.equal(duelBlow(st, 'acct-a', 'peer-c', { d: 10, held: { w: -1, m: 0 } }, s + 600).why, 'not-opponent');
  assert.equal(duelBlow(st, 'acct-a', 'peer-b', { d: 10, held: null }, s + 900).why, 'weapon', 'a weapon the look does not hold');
  const casts = [1, 2, 3, 4].map((k) => duelBlow(st, 'acct-b', 'peer-a', { d: 999, r: SIEGE_HIT.Spell }, s + 1000 + k * 100));
  assert.deepEqual(casts.map((c) => c.dealt), [SIEGE_CASTS.damageMax, SIEGE_CASTS.damageMax, SIEGE_CASTS.damageMax, 0], 'three casts a five seconds, each to sixty');
  // the fall
  const far = { st, t: s + 10_000 };
  let res;
  for (let k = 0; k < 20 && !(res?.fell); k++) { far.t += 300; res = duelBlow(st, 'acct-b', 'peer-a', { d: 999, held: { w: -1, m: 0 } }, far.t); }
  assert.equal(res.fell, true);
  assert.equal(bout.a.f.hp, 0);
});

test('INT8 THE REFEREE\'S LAW, THE END: a fighter\'s own word is its loss once the count has run (a cancel before it); past the ring\'s edge DUEL_OUT_MS, its loss; gone ROYAL_RING.goneMs, a walkover (both gone, a draw); the clock a draw; a run faster than the referee allows is not where it stands (mutants: a forfeit before the count recorded; the ring unread; the walkover unread; a teleport believed for reach)', () => {
  let { st, bout } = opened();
  assert.deepEqual(duelForfeit(st, 'acct-a', 'yield', bout.startMs - 1), { s: bout.s, n: bout.n, f: ['acct-a', 'acct-b'], ids: ['peer-a', 'peer-b'], w: null, why: 'cancelled' }, 'a cancel in the count');
  ({ st, bout } = opened());
  assert.deepEqual(duelForfeit(st, 'acct-a', 'yield', bout.startMs).w, 1, 'a yield: the other wins');
  ({ st, bout } = opened());
  const e = duelForfeit(st, 'acct-b', 'dead', bout.startMs + 5);
  assert.deepEqual([e.w, e.why], [0, 'left'], 'fallen to something else: lost');   // AUDIT INT8 (the pins' own): its word read, never a literal beside it
  // the ring
  ({ st, bout } = opened());
  const out = at(ROYAL_RING.radiusM + ROYAL_RING.outSlackM + 1);
  let t = bout.startMs + 100;
  duelPose(st, 'acct-b', out, t);
  assert.deepEqual(duelStep(st, () => true, t + DUEL_REF.outMs - 1), [], 'a moment out is a trailing pose');
  duelPose(st, 'acct-b', at(2), t + DUEL_REF.outMs - 1);
  assert.deepEqual(duelStep(st, () => true, t + DUEL_REF.outMs + 5), [], 'back inside clears it');
  duelPose(st, 'acct-b', out, t + 4000);
  const ended = duelStep(st, () => true, t + 4000 + DUEL_REF.outMs);
  assert.deepEqual([ended[0].w, ended[0].why], [0, 'left'], 'out DUEL_OUT_MS: the other wins');
  // a run the referee does not believe: reach is measured from the last believed place
  ({ st, bout } = opened());
  t = bout.startMs + 100;
  duelPose(st, 'acct-a', at(-2), t);
  duelPose(st, 'acct-a', at(500), t + 50);   // 502 m in 50 ms
  assert.equal(Math.round((bout.a.pose.x - C[0]) / M), -2, 'the teleport is not where it stands');
  // gone: a walkover; both gone a draw
  ({ st, bout } = opened());
  t = bout.startMs + 100;
  duelStep(st, (sub) => sub !== 'acct-b', t);
  assert.deepEqual(duelStep(st, (sub) => sub !== 'acct-b', t + ROYAL_RING.goneMs - 1), []);
  assert.deepEqual(duelStep(st, (sub) => sub !== 'acct-b', t + ROYAL_RING.goneMs).map((e) => [e.w, e.why]), [[0, 'left']]);
  ({ st, bout } = opened());
  t = bout.startMs + 100;
  duelStep(st, () => false, t);
  assert.deepEqual(duelStep(st, () => false, t + ROYAL_RING.goneMs).map((e) => [e.w, e.why]), [[null, 'draw']]);
  // the clock
  ({ st, bout } = opened());
  assert.deepEqual(duelStep(st, () => true, bout.endMs).map((e) => [e.w, e.why]), [[null, 'draw']]);
  assert.equal(st.bouts.size + st.of.size, 0, 'and forgotten');
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

const S = 'duel123456';
const P = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M, yaw: 0, pitch: 0 });
const LOOK = (items = []) => ({ race: 'Nord', gender: 'male', faceIndex: 0, items });
const refs = (ws, k) => ws.sent.filter((m) => m.t === 'dref' && (!k || m.k === k));
async function withDuel(fn, { key = 'world:3,12' } = {}) {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  const r = fakeRoom(key, { now: () => clock });
  const relayKp = await keys();
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', relayKp.privateKey)).toString('base64');
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'duel', data: d }));
  const join = async (id, x, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK(), ...extra }); return ws; };
  /** a and b through the handshake: the ask, the yes, the start - the bout set */
  const fight = async (a, b) => {
    await say(a, { to: 'peer-0002', s: S, k: 'ask' });
    await say(b, { to: 'peer-0001', s: S, k: 'yes' });
    await say(a, { to: 'peer-0002', s: S, k: 'start', c: [1000 * M, 0, 1000 * M] });
    clock += ROYAL_RING.countdownMs + 1;
  };
  try { await fn({ r, say, join, fight, relayKp, step: (ms) => { clock += ms; }, now: () => clock }); } finally { Date.now = realNow; }
}

test('INT8 THE RELAY: a start is routed only where the referee sets a bout on it - both fighters told the bout, whole; a start it never saw asked and answered goes nowhere and its challenger hears `no` (mutants: the start routed with no bout; the bout said to one; the `no` unsaid)', () => withDuel(async ({ say, join, fight }) => {
  const a = await join('peer-0001', -2), b = await join('peer-0002', 2);
  await say(a, { to: 'peer-0002', s: 'nohandshk1', k: 'start', c: [1000 * M, 0, 1000 * M] });
  assert.equal(b.sent.filter((m) => m.t === 'duel' && m.data.k === 'start').length, 0, 'no bout, no start');
  assert.deepEqual(refs(a, 'no'), [{ t: 'dref', k: 'no', s: 'nohandshk1', why: 'timeout' }]);
  await fight(a, b);
  assert.equal(b.sent.filter((m) => m.t === 'duel' && m.data.k === 'start').length, 1, 'the start routed');
  const whole = siegeVitality(10);
  for (const [ws, op] of [[a, 'peer-0002'], [b, 'peer-0001']]) {
    const g = refs(ws, 'bout')[0];
    assert.deepEqual(g, { t: 'dref', k: 'bout', s: S, op, ms: ROYAL_RING.countdownMs, h: [['peer-0001', whole, whole], ['peer-0002', whole, whole]] });
    assert.ok(validDuelRefOut(g), 'the client\'s law takes it');
  }
}));

test('INT8 THE RELAY, THE BLOWS: a strike is the referee\'s - routed to nobody, clipped to the weapon the striker\'s look holds and the arms its token signs, both fighters told what landed; a fall ends the bout with the winner named and the relay\'s signed receipt to BOTH; a crafted client\'s whole-health strike, a weapon it never held, a blow in the count, all clipped or nothing (mutants: the strike routed to the defender; the look unread; the arms unread; the receipt to the winner alone; the receipt unsigned)', () => withDuel(async ({ say, join, fight, relayKp, step }) => {
  const sword = [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }];
  const a = await join('peer-0001', -2, { look: LOOK(sword), rc: 1, ci: 'r00000000000000000a01', wa: [16, 0] });
  const b = await join('peer-0002', 2);
  await say(a, { to: 'peer-0002', s: S, k: 'ask' });
  await say(b, { to: 'peer-0001', s: S, k: 'yes' });
  await say(a, { to: 'peer-0002', s: S, k: 'start', c: [1000 * M, 0, 1000 * M] });
  await say(a, { to: 'peer-0002', s: S, k: 'strike', n: 1, by: 'melee', p: [P(-2).x, 0, P(-2).z], d: 999, w: { t: 123, m: 9, c: 100 } });
  assert.equal(refs(a, 'hp').length, 0, 'nothing lands in the count');
  step(ROYAL_RING.countdownMs + 1);
  await say(a, { to: 'peer-0002', s: S, k: 'strike', n: 2, by: 'melee', p: [P(-2).x, 0, P(-2).z], d: 999, w: { t: 123, m: 9, c: 100 } });
  const cap = siegeBlowMax(123, 9, [16, 0]), whole = siegeVitality(10);
  for (const ws of [a, b]) assert.deepEqual(refs(ws, 'hp').at(-1), { t: 'dref', k: 'hp', s: S, by: 'peer-0001', to: 'peer-0002', d: cap, r: SIEGE_HIT.Melee, h: [['peer-0001', whole, whole], ['peer-0002', whole - cap, whole]] }, 'the Dai-Katana its look holds, clipped to the Longsword its pack does');
  assert.equal(b.sent.filter((m) => m.t === 'duel' && (m.data.k === 'strike' || m.data.k === 'spell')).length, 0, 'routed to nobody: the defender resolves nothing');
  step(300);
  await say(b, { to: 'peer-0001', s: S, k: 'strike', n: 1, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999, w: { t: 123, m: 9, c: 100 } });
  assert.equal(refs(a, 'hp').length, 1, 'a Dai-Katana its look never held lands nothing');
  // B's fists until A falls
  let ended = null;
  for (let k = 0; k < 20 && !ended; k++) {
    step(300);
    await say(b, { to: 'peer-0001', s: S, k: 'strike', n: 10 + k, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999 });
    ended = refs(a, 'end')[0] ?? null;
  }
  assert.ok(ended, 'the fall ended the bout');
  assert.deepEqual([ended.w, ended.why], ['peer-0002', 'fell']);
  assert.deepEqual(refs(b, 'end')[0], ended, 'both told the same');
  const v = await verifyDuelReceipt(ended.rc, relayKp.publicKey, { subtle, nowS: T + 5 });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.f, v.claims.w], [['acct-peer-0001', 'acct-peer-0002'], 1], 'the relay\'s signature names the winner by its verified account');
  step(300);
  await say(b, { to: 'peer-0001', s: S, k: 'strike', n: 99, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999 });
  assert.equal(refs(a, 'end').length, 1, 'the bout is over: nothing more');
}));

test('INT8 THE RELAY, THE END: a fighter\'s own `end` is its loss once the count has run (nobody\'s duel to walk out of); a fighter whose socket is gone loses by walkover on the next frame the room takes; a client\'s own `dref` is never routed (mutants: a yield recorded for the other; the walkover unread; a forged referee word)', () => withDuel(async ({ r, say, join, fight, step }) => {
  let a = await join('peer-0001', -2), b = await join('peer-0002', 2);
  await fight(a, b);
  await say(a, { to: 'peer-0002', s: S, k: 'end', why: 'left' });
  assert.deepEqual(refs(b, 'end').map((g) => [g.w, g.why, !!g.rc]), [['peer-0002', 'left', true]], 'walked off: the other wins, signed');
  assert.equal(b.sent.filter((m) => m.t === 'duel' && m.data.k === 'end').length, 0, 'the end is the referee\'s word, not routed');
  // a walkover
  step(60_000);
  a = await join('peer-0003', -2);
  b = await join('peer-0004', 2);
  await say(a, { to: 'peer-0004', s: 'duel222222', k: 'ask' });
  await say(b, { to: 'peer-0003', s: 'duel222222', k: 'yes' });
  await say(a, { to: 'peer-0004', s: 'duel222222', k: 'start', c: [1000 * M, 0, 1000 * M] });
  step(ROYAL_RING.countdownMs + 1);
  await r.drop(b);
  await r.pose(a, P(-2)); step(ROYAL_RING.goneMs + 1); await r.pose(a, P(-1.5));
  assert.deepEqual(refs(a, 'end').map((g) => [g.w, g.why]), [['peer-0003', 'left']], 'a walkover on the next pose the room took');
  // a client's `dref` is no frame of a client's
  assert.equal(parseClient(JSON.stringify({ t: 'dref', k: 'end', s: S, w: 'peer-0003', why: 'fell' }), { hasHello: true }).t, undefined, 'the relay\'s parser refuses it');
}));

test('INT8 THE CLIENT\'S CARRIER: a duel\'s receipt is either fighter\'s to carry - kept, offered, let go on a settling answer (counted, not-yours, a receipt the service can never take) and kept on one it can mend; the client parses the referee\'s word on ANY socket it holds, with its room (PIN MOVED, AUDIT INT8: a bout asked through a halo is refereed there, and its every word was dropped) (mutants: the loser\'s receipt dropped; a mendable refusal let go)', async () => {
  const kp = await keys();
  const rc = await mintDuelReceipt({ f: ['acct-aaaa', 'acct-bbbb'], w: 1, n: '0123456789ab' }, kp.privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const asked = [];
  const answers = [{ ok: false, error: 'receipt', why: 'signature' }, { ok: true, data: { recorded: true } }];
  const c = createDuelClaims({ claim: async (r) => { asked.push(r); return answers.shift(); }, me: () => 'acct-aaaa', storage: null });
  assert.equal(c.keep(rc), true, 'the loser keeps it too');
  assert.equal(await c.offer({ force: true }), 0, 'a refusal the service can mend: kept');
  assert.equal(await c.offer({ force: true }), 1, 'counted: let go');
  assert.deepEqual(c.list(), []);
  assert.deepEqual(asked, [rc, rc], 'the loser offered it, twice');
  // AUDIT INT8 (the pins' own): a stranger's game keeps what a socket handed it, and offers none of it
  const strangerAsked = [];
  const stranger = createDuelClaims({ claim: async (r) => { strangerAsked.push(r); return { ok: true }; }, me: () => 'acct-cccc', storage: null });
  assert.equal(stranger.keep(rc), true);
  await stranger.offer({ force: true });
  assert.deepEqual(strangerAsked, [], 'a receipt naming neither fighter it plays: never offered');
  assert.equal(duelClaimSettles({ ok: false, error: 'not-yours' }), true);
  assert.equal(duelClaimSettles({ ok: false, error: 'offline' }), false);
  const online = rd('src/net/online.js');
  assert.match(online, /\} else if \(m\.t === 'dref'\) \{[\s\S]*?const g = validDuelRefOut\(m\);\s*\n\s*if \(g\) this\._deliver\('dref', \(\) => this\.onDuelRef\?\.\(g, room\)\);/);
  assert.equal(/m\.t === 'dref'\) \{[^}]*if \(!primary\) return;/.test(online), false, 'never the primary alone');
  assert.ok(rd('src/scenes/world.js').includes('send: (d) => online?.sendDuel(d, { room: duelMgr?.duel && _duelRoom ? _duelRoom : null }) === true,'), 'a bout\'s frames to the room that referees it');
  assert.match(online, /this\.duelOk = relaySupportsDuelRef\(relayV\);/, 'a client duels on a refereeing relay alone');
});

test('INT8 (AUDIT) THE DUEL\'S CAST PATH IS DORMANT: no caller hands a spell to the target\'s own effects as a duel\'s (`duelCast`) since the referee holds the duel - its floor and its strip in systems/effects.js stand unread, kept as they stand (bible/06-Systems/Integrity-Arc.md 5b) (mutants: a duel opponent\'s spell applied on its target\'s machine)', () => {
  const callers = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') && p !== 'src/systems/effects.js' && /duelCast:\s*true/.test(rd(p))) callers.push(p);
    }
  };
  walk('src');
  assert.deepEqual(callers, [], 'nothing sets a duel\'s cast');
});
