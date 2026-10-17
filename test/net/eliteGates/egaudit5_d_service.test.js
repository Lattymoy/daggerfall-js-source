// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 5, 16.3, 19, 20
// and 23) - FIX GROUP D ("net"), THE SERVICE'S HALF, against the account service's real Worker (test/accountDb.mjs - every
// migration applied over node:sqlite, the relay's receipts minted with its own key, the orders verified with the
// service's):
//   L4-5   AN OPEN ASKED AGAIN BY ITS REQUEST ID signs its order as of the stake's own issue - never fresh, hours on;
//   L8-2   A PAID REDOUBT'S EMBERS REACH THE PACK: the claim's answer, rolled into its spoils, is a stack the Broker counts;
//   L8-4   A CIRCLE'S RELIQUARIES OPEN ONCE AN ACCOUNT AN ARENA WEEK, whatever order the receipts are claimed in;
//   L8-5   THE SPOILS ROLL ON A SEED THE CLAIM ANSWERS - the receipt's mixed with the service's own draw, so no page reads
//          a receipt's spoils before the week has said which receipt it pays;
//   L8-9   AN END KEEPS ITS WAGER, and the Depths' row names it;
//   L9-6   THE WEIR KEY'S ODDS AT THEIR EDGES: a gate kill's 1 in 6, the broken rite's 1 in 4, an Hour's 1 in 3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { mintEgReceipt, readEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { mintReceipt } from '../../../src/net/gate/gateReceipt.js';
import { verifyOrder, verifyEgOpenAnyAge } from '../../../src/net/identityToken.js';
import { ARENA_SEASON_EPOCH_S, ARENA_WEEK_S } from '../../../src/net/arena/arenaLaw.js';
import { egSpoilsSeed, egLegendaryShare } from '../../../src/net/eliteGates/egPay.js';
import { EG_KEY_ODDS, EG_KEY_ODDS_RITE, EG_KEY_ODDS_SD, EG_KEY_PITY, rollWeirKey } from '../../../server-account/src/eg.js';
import { egSpoilsList, egSpoilsSeedOf, rollEgSpoils } from '../../../src/systems/eliteGates/egSpoils.js';
import { stoneCount } from '../../../src/systems/sigil/sigilBroker.js';
import { egBoardLines } from '../../../src/ui/eliteGates/egBoardWindow.js';
import { _resetEgHonoursCache } from '../../../server-account/src/egHonours.js';

const { subtle } = globalThis.crypto;
const Z = 'zzzzzzzzzzzzzzzz';
/** A service on a driven clock (Date.now too), a week into the arena's tenth week; its answers' and rows' helpers. */
async function stood(t, at = ARENA_SEASON_EPOCH_S + 9 * ARENA_WEEK_S + 86_400) {
  let clock = at * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService({ MARKS_OPEN: 'on' });
  const now = () => Math.floor(clock / 1000);
  let n = 0;
  const breach = () => (++n).toString(16).padStart(16, '0');
  const claim = async (who, r) => (await S.call('/v1/eg/claim', { receipt: await r }, who.secret)).body;
  const w = (who, b, R, extra = {}) => mintEgReceipt({ q: 'w', b, s: who.id, z: Z, c: 1, w: R, h: R * 5, t: 900, n: 1, ew: 0, l: 12, ...extra }, S.gatePriv, { subtle, nowS: now() });
  const x = (who, b, rl, extra = {}) => mintEgReceipt({ q: 'x', b, s: who.id, z: Z, c: 9, h: 15, t: 2000, n: 1, ew: 0, l: 12, why: 'home', rl, ...extra }, S.gatePriv, { subtle, nowS: now() });
  return { S, raw: S.env.DB._raw, now, at: (s) => { clock = s * 1000; }, step: (s) => { clock += s * 1000; }, breach, claim, w, x };
}

// ── L4-5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-5 AN OPEN ASKED AGAIN BY ITS REQUEST ID IS THE SAME ORDER (sections 6.1 and 23 - the stake\'s `until` is set "so no breach outlives it"): a request id asked again inside its minute answers an order the hub still takes; asked again three hours on (no `again`), the order is still signed as of the stake\'s own issue - it opens nothing, and no breach runs past the stake\'s `until` (mutant: re-signed as of now)', async (t) => {
  const { S, now, step } = await stood(t, T0);
  const me = await S.registered('Opener');
  await S.claim(me, 700, now());
  const o1 = (await S.call('/v1/eg/open', { rq: 'rqaaaaaaaaaaaaaaaa' }, me.secret)).body;
  assert.ok(o1.order);
  const at = now();
  step(30);
  const again = (await S.call('/v1/eg/open', { rq: 'rqaaaaaaaaaaaaaaaa' }, me.secret)).body;
  assert.equal(again.b, o1.b);
  assert.ok((await verifyOrder(again.order, S.identityPublic, { subtle, nowS: now(), kind: 'egopen' })).ok, 'inside its minute: the hub still takes it');
  step(3 * 3600);
  const late = (await S.call('/v1/eg/open', { rq: 'rqaaaaaaaaaaaaaaaa' }, me.secret)).body;
  assert.equal(late.b, o1.b, 'the same stake');
  const v = await verifyEgOpenAnyAge(late.order, S.identityPublic, { subtle });
  assert.equal(v.claims.i, at, 'signed as of the stake\'s own issue');
  assert.equal((await verifyOrder(late.order, S.identityPublic, { subtle, nowS: now(), kind: 'egopen' })).ok, false, 'three hours on it opens nothing');
});

// ── L8-4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-4 A CIRCLE\'S RELIQUARIES OPEN ONCE AN ACCOUNT AN ARENA WEEK (section 16.3 - "A Redoubt already paid this week seals none"): three breaches in one week, each taking Redoubts 1 to 3, their Redoubt receipts held back and each end claimed first - the first end opens its three circles, the next two none; asked again, the first answers the same; the held receipts claimed after pay the first breach\'s; the next arena week opens again; the honest order (receipts first) unchanged (mutants: no week\'s record; the record never read; every end writing it)', async (t) => {
  const { S, breach, claim, w, x, step } = await stood(t);
  const me = await S.registered('Withholder');
  const held = [], opened = [];
  let first = null;
  for (let k = 0; k < 3; k++) {
    const b = breach();
    for (const R of [1, 2, 3]) held.push([b, R]);
    const r = x(me, b, [1, 1, 2, 3]);
    first ??= r;
    opened.push((await claim(me, r)).rl);
    step(3600);
  }
  assert.deepEqual(opened, [[1, 1, 2, 3], [], []], 'the first end opens its circles, the week\'s others none');
  assert.deepEqual((await claim(me, first)).rl, [1, 1, 2, 3], 'the first end asked again: the same');
  const paid = [];
  for (const [b, R] of held) paid.push((await claim(me, w(me, b, R))).paid);
  assert.deepEqual(paid, [true, true, true, false, false, false, false, false, false], 'the held receipts: the week pays the first claimed');
  step(ARENA_WEEK_S);
  const b2 = breach();
  assert.deepEqual((await claim(me, x(me, b2, [1, 2]))).rl, [1, 2], 'a new week opens again');
  // the honest order: receipts first, then the end - a fresh account
  const ann = await S.registered('Honest');
  const b3 = breach();
  for (const R of [1, 2, 3]) assert.equal((await claim(ann, w(ann, b3, R))).paid, true);
  assert.deepEqual((await claim(ann, x(ann, b3, [1, 2, 3]))).rl, [1, 2, 3]);
  const b4 = breach();
  for (const R of [1, 2]) assert.equal((await claim(ann, w(ann, b4, R))).paid, false);
  assert.deepEqual((await claim(ann, x(ann, b4, [1, 2, 4]))).rl, [4], 'paid circles seal none; an unpaid circle opens once');
});

// ── L8-5 / L8-2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-5 / L8-2 THE SPOILS ROLL ON THE CLAIM\'S SEED, AND ITS EMBERS REACH THE PACK (sections 16.1 and 19): a Redoubt\'s claim answers `seed` - its receipt\'s `c` mixed with the row\'s own draw (the service\'s), never readable off the receipt: two receipts of one Redoubt sharing a `c` answer different seeds, the one a page could have rolled ahead is neither, and asked again the same; an end\'s claim answers its Reliquaries\' seed the same way; and a paid Redoubt\'s embers, rolled into its spoils from the real answer, are a stack the Broker counts as many as were paid (mutants: the receipt\'s seed answered; a fresh draw each ask; no embers in the spoils)', async (t) => {
  const { S, raw, breach, claim, w, x } = await stood(t);
  const me = await S.registered('Shopper');
  const b1 = breach(), b2 = breach();
  const r1 = w(me, b1, 10, { c: 4242 }), r2 = w(me, b2, 10, { c: 4242 });
  const c1 = await claim(me, r1), c2 = await claim(me, r2);
  const nonceOf = (b) => raw.prepare('SELECT nonce FROM eg_redoubts WHERE b = ? AND account = ?').get(b, me.id).nonce;
  assert.equal(c1.seed, egSpoilsSeed(4242, nonceOf(b1)), 'the receipt\'s mixed with the row\'s draw');
  assert.notEqual(c1.seed, c2.seed, 'one `c`, two draws: two seeds');
  assert.ok(c1.seed !== 4242 && c2.seed !== 4242, 'never the seed the page could read');
  assert.equal(readEgReceipt(await r1).c, 4242);
  assert.equal((await claim(me, r1)).seed, c1.seed, 'asked again: the same');
  // the embers, end to end: a Valkynaz's Redoubt (10) first this season pays 3, and its spoils carry them
  assert.equal(c1.paid, true);
  assert.equal(c1.embers, 3);
  const c = readEgReceipt(await r1), spoils = egSpoilsList(egSpoilsSeedOf(c, c1), c.l, c.w, { embers: c1.embers, pity: c1.pity });
  assert.equal(stoneCount(spoils.filter((q) => q.kind === 'item').map((q) => q.item)), 3, 'the Broker\'s pack count: the embers paid');
  assert.equal(rollEgSpoils(c1.seed, c.l, c.w).length, 2, 'a Valkynaz\'s two passes on the claim\'s seed');
  assert.equal(c2.paid, false);
  assert.equal(stoneCount(egSpoilsList(egSpoilsSeedOf(c, c2), c.l, c.w, { embers: c2.embers, goldOnly: true }).filter((q) => q.kind === 'item').map((q) => q.item)), 0, 'gold alone: no embers');
  // an end's Reliquaries
  const e1 = await claim(me, x(me, b1, [10]));
  const eNonce = raw.prepare('SELECT nonce FROM eg_runs WHERE b = ? AND account = ?').get(b1, me.id).nonce;
  assert.match(eNonce, /^[0-9a-f]{16}$/);
  assert.equal(e1.seed, egSpoilsSeed(9, eNonce));
  assert.equal((await claim(me, x(me, b1, [10]))).seed, e1.seed, 'an end asked again: the same');
  assert.notEqual((await claim(me, x(me, b2, [10]))).seed, e1.seed, 'another end of the same `c`: its own draw');
});

// ── L8-9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-9 AN END KEEPS ITS WAGER, AND THE DEPTHS\' ROW NAMES IT (sections 18 and 20 - "the start Redoubt, the Wager"): an end wagered Chained Blows and Ashfall keeps their numbers (`eg_runs.wgs`), and the Depths\' row carries them (`wg`) for the window to name; an unwagered end none (mutants: the decrees unkept; the row unread)', async (t) => {
  _resetEgHonoursCache?.();
  const { S, raw, breach, claim, x } = await stood(t);
  const mac = await S.registered('Wagerer'), ann = await S.registered('Plain');
  const b1 = breach(), b2 = breach();
  assert.equal((await claim(mac, x(mac, b1, [], { h: 31, ew: 6, wg: [9, 0] }))).recorded, true);
  assert.equal((await claim(ann, x(ann, b2, [], { h: 20 }))).recorded, true);
  assert.equal(raw.prepare('SELECT wgs FROM eg_runs WHERE b = ?').get(b1).wgs, '0,9');
  assert.equal(raw.prepare('SELECT wgs FROM eg_runs WHERE b = ?').get(b2).wgs, '');
  const board = (await S.call('/v1/eg/board', {}, mac.secret)).body;
  const rows = board.depths.rows;
  assert.deepEqual(rows.map((r) => [r.name, r.h, r.wagered, r.wg]), [['Wagerer', 31, true, [0, 9]], ['Plain', 20, false, []]]);
  assert.match(egBoardLines(board, 'depths')[2], / - The Wager: Chained Blows, Ashfall/);
});

// ── L9-5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L9-5 THE LEGENDARY\'S SHARE CLIMBS 3% A REDOUBT (section 19: "20% at Redoubt 1, +3% a Redoubt, to 65% (Redoubt 16)"): every Redoubt between its ends, not only the ends test/net/eliteGates/egeco_pay.test.js read (mutant: a steeper climb)', () => {
  for (const [w, v] of [[1, 0.2], [2, 0.23], [5, 0.32], [10, 0.47], [15, 0.62], [16, 0.65], [17, 0.65]]) assert.ok(Math.abs(egLegendaryShare(w) - v) < 1e-9, `Redoubt ${w}: ${egLegendaryShare(w)}`);
});

// ── L9-6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The service's 4-byte die fixed at `v` (a 32-bit draw; null: the platform's own). */
function die(t) {
  const d = { v: null };
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => {
    if (b.length !== 4 || d.v == null) return real(b);
    b[0] = d.v >>> 24; b[1] = (d.v >>> 16) & 0xff; b[2] = (d.v >>> 8) & 0xff; b[3] = d.v & 0xff;
    return b;
  });
  return d;
}
/** The first draw at or past odds `p` (drawUnder: a draw under p finds). */
const edgeOf = (p) => Math.ceil(4294967296 * p);
test('AUDIT EG V L9-6 THE WEIR KEY\'S ODDS AT THEIR EDGES (section 5\'s table): a recorded gate kill (not the account\'s first, the pity not due) finds a key on a draw just under 1 in 6 and none at it; one whose fighter broke the rite (`r` 1) at 1 in 4 instead; an Hour\'s claim (rollWeirKey \'sd\') at 1 in 3 (mutants: each odds moved; the rite\'s odds the kill\'s)', async (t) => {
  assert.deepEqual([EG_KEY_ODDS, EG_KEY_ODDS_RITE, EG_KEY_ODDS_SD], [1 / 6, 1 / 4, 1 / 3]);
  const d = die(t);
  const { S, raw, now } = await stood(t, T0);
  const keysOf = (id) => ({ ...raw.prepare('SELECT eg_keys AS k, eg_key_miss AS m FROM players WHERE id = ?').get(id) });
  const gate = async (who, day, extra = {}) => (await S.call('/v1/gate/claim', { receipt: await mintReceipt({ d: day, b: 'ruhn', s: who.id, c: 4242, x: 'dealt', ...extra }, S.gatePriv, { subtle, nowS: now() }) }, who.secret)).body;
  for (const [p, extra, name] of [[EG_KEY_ODDS, {}, 'a kill'], [EG_KEY_ODDS_RITE, { r: 1 }, 'the rite broken']]) {
    const who = await S.registered(`Gate${extra.r ? 'Rite' : 'Kill'}`);
    d.v = 0xffffffff;
    await gate(who, 700);   // the first ever: certain
    assert.deepEqual(keysOf(who.id), { k: 1, m: 0 });
    d.v = edgeOf(p);
    await gate(who, 701, extra);
    assert.deepEqual(keysOf(who.id), { k: 1, m: 1 }, `${name}: at the edge, none`);
    d.v = edgeOf(p) - 1;
    await gate(who, 702, extra);
    assert.deepEqual(keysOf(who.id), { k: 2, m: 0 }, `${name}: just under it, a key`);
    assert.ok(EG_KEY_PITY > 1);
  }
  const hour = await S.registered('HourWalker');
  for (const [v, found] of [[edgeOf(EG_KEY_ODDS_SD), false], [edgeOf(EG_KEY_ODDS_SD) - 1, true]]) {
    const draw = (b) => { b[0] = v >>> 24; b[1] = (v >>> 16) & 0xff; b[2] = (v >>> 8) & 0xff; b[3] = v & 0xff; return b; };
    assert.equal((await rollWeirKey({ db: S.env.DB, rand: draw }, { id: hour.id }, { kind: 'sd' })).found, found, `an Hour at ${v}: ${found}`);
  }
});
