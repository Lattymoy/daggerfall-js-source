// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections
// 5, 16.6, 18 and 23): THE START WINDOW AS THE ACCOUNT SERVICE ANSWERS IT - the preflight `/v1/eg/starts` (each member of
// the opener's party: which starts they may make - the Redoubts taken this season, else half the best; a guest none),
// the open carrying the window's start and Wager into its stake and its order, every admission held to the breach's
// start (no carries), and the relay's public half handed to every signed-in client. The real Worker over node:sqlite with
// every migration (test/accountDb.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { verifyOrder } from '../../../src/net/identityToken.js';
import { egSeasonStartS, egStartsFor, EG_STARTS_ASK_MAX } from '../../../server-account/src/egStarts.js';
import { ARENA_SEASON_EPOCH_S, ARENA_SEASON_S, arenaSeasonOf } from '../../../src/net/arena/arenaLaw.js';

const { subtle } = globalThis.crypto;
async function stood(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService();
  return { S, at: (s) => { clock = s * 1000; } };
}
let _b = 0;
/** A Redoubt `w` taken by account `id` at `at` (epoch seconds) - the row a claimed `w` receipt writes. */
const redoubt = (S, id, w, at) => S.env.DB._raw.prepare('INSERT INTO eg_redoubts (b, account, w, h, t, at) VALUES (?, ?, ?, ?, ?, ?)').run((++_b).toString(16).padStart(16, '0'), id, w, w * 5, 600, at);

test('EG-F THE PREFLIGHT: /v1/eg/starts answers, for the opener and each member it names, the starts they may make - this season\'s Redoubts deepest first and Hall 1, else half the all-time best; a guest none; with the opener\'s keys, the day\'s Rehearsal and the relay\'s public half (mutants: last season\'s Redoubts counted; the half best taken while a Redoubt stands this season; a guest answered Hall 1)', async (t) => {
  const { S } = await stood(t);
  assert.equal(arenaSeasonOf(T0), 2);
  assert.equal(egSeasonStartS(T0), ARENA_SEASON_EPOCH_S + ARENA_SEASON_S, 'the arena\'s season, its first second');
  const me = await S.registered('Opener'), mara = await S.registered('Mara'), tor = await S.registered('Tor'), g = await S.guest();
  const now = T0, last = egSeasonStartS(T0) - 100;
  redoubt(S, mara.id, 3, now - 500); redoubt(S, mara.id, 7, now - 400); redoubt(S, mara.id, 7, now - 300); redoubt(S, mara.id, 20, last);
  redoubt(S, tor.id, 12, last); redoubt(S, tor.id, 9, last);
  const a = await S.call('/v1/eg/starts', { subs: [mara.id, tor.id, g.id] }, me.secret);
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, {
    starts: { [me.id]: [0], [mara.id]: [7, 3, 0], [tor.id]: [6, 0], [g.id]: null },
    keys: 0, rehearsal: true, rk: S.env.GATE_PUBLIC_KEY,
  });
  assert.deepEqual(await egStartsFor(S.env.DB, mara.id, now), [7, 3, 0], 'this season\'s alone - her 20 of last season waits on none of them');
  assert.deepEqual(await egStartsFor(S.env.DB, 'acct-nobody', now), null);
  assert.deepEqual((await S.call('/v1/eg/starts', {}, me.secret)).body.starts, { [me.id]: [0] }, 'the opener always');
  assert.deepEqual((await S.call('/v1/eg/starts', { subs: 'all' }, me.secret)).body, { error: 'subs' });
  assert.deepEqual((await S.call('/v1/eg/starts', { subs: Array.from({ length: EG_STARTS_ASK_MAX + 1 }, (_, i) => `acct-${i}xxxx`) }, me.secret)).body, { error: 'subs' });
  assert.deepEqual((await S.call('/v1/eg/starts', { subs: ['../x'] }, me.secret)).body, { error: 'subs' });
  assert.equal((await S.call('/v1/eg/starts', { subs: [] }, g.secret)).status, 403, 'a guest opens nothing');
  assert.equal((await S.call('/v1/eg/starts', { subs: [] })).status, 401);
  assert.equal((await S.call('/v1/eg/keys', {}, me.secret)).body.rk, S.env.GATE_PUBLIC_KEY, 'every signed-in client is handed the relay\'s public half');
});

test('EG-F THE OPEN CARRIES THE WINDOW\'S CHOICE: a start the opener may not make refused `start`; one it may stakes the key with its start and its Wager, signs both into the order (`ew`, `ewg`), and gives them back to a request asked again; a Wager of two of a family, or of four, refused `wager`; a Rehearsal starts at Hall 1 with none (mutants: the start unchecked; the Wager dropped from the order; the stake keeping neither)', async (t) => {
  const { S } = await stood(t);
  const me = await S.registered('Opener');
  assert.deepEqual((await S.claim(me, 700, T0)).body.weir, { found: true, keys: 1 });
  const RQ = 'rq0123456789abcdef';
  const no = await S.call('/v1/eg/open', { rq: RQ, ew: 7 }, me.secret);
  assert.deepEqual([no.status, no.body], [403, { error: 'start', w: 7 }], 'no carries - the opener\'s own start too');
  redoubt(S, me.id, 7, T0 - 60);
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ, ew: 7, wg: [0, 1] }, me.secret)).body, { error: 'wager' }, 'two of the blows');
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ, ew: 7, wg: [0, 4, 9, 13] }, me.secret)).body, { error: 'wager' }, 'a fourth');
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ, ew: 'deep' }, me.secret)).body, { error: 'start', w: 0 });
  const open = await S.call('/v1/eg/open', { rq: RQ, ew: 7, wg: [9, 0, 4] }, me.secret);
  assert.equal(open.status, 200);
  assert.equal(open.body.keys, 0, 'the key staked');
  const v = await verifyOrder(open.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egopen' });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.ew, v.claims.ewg], [7, [0, 4, 9]], 'the order says where it starts and what it wagered');
  assert.deepEqual({ ...S.env.DB._raw.prepare('SELECT ew, wg FROM eg_stakes WHERE ez = ?').get(open.body.ez) }, { ew: 7, wg: '0,4,9' }, 'and the stake keeps both');
  const again = await S.call('/v1/eg/open', { rq: RQ, ew: 7, wg: [9, 0, 4] }, me.secret);
  const v2 = await verifyOrder(again.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egopen' });
  assert.deepEqual([again.body.b, v2.claims.ew, v2.claims.ewg], [open.body.b, 7, [0, 4, 9]], 'asked again: the same breach, its start and its Wager');
  // a Rehearsal: Hall 1, no Wager
  const other = await S.registered('Rehearser');
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ, rh: 1, ew: 3 }, other.secret)).body, { error: 'start', w: 3 });
  assert.deepEqual((await S.call('/v1/eg/open', { rq: RQ, rh: 1, wg: [0] }, other.secret)).body, { error: 'wager' });
  const rh = await S.call('/v1/eg/open', { rq: RQ, rh: 1 }, other.secret);
  assert.equal(rh.status, 200);
  const vr = await verifyOrder(rh.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egopen' });
  assert.deepEqual([vr.claims.ew, vr.claims.ewg, vr.claims.rh], [0, undefined, 1]);
});

test('EG-F NO CARRIES: a member\'s admission to a breach that starts at Redoubt 7 is signed only for a member who may start there - its order naming the start - and refused `start` otherwise; a breach the service holds no stake for is refused, AUDIT EG III (mutants: the admission unchecked; the order\'s start left at Hall 1)', async (t) => {
  const { S } = await stood(t);
  const me = await S.registered('Opener'), mara = await S.registered('Mara'), ann = await S.registered('Ann');
  await S.claim(me, 700, T0);
  redoubt(S, me.id, 7, T0 - 60);
  redoubt(S, mara.id, 7, T0 - 60);
  const open = await S.call('/v1/eg/open', { rq: 'rq0123456789abcdef', ew: 7 }, me.secret);
  assert.equal(open.status, 200);
  const ok = await S.call('/v1/eg/admit', { b: open.body.b }, mara.secret);
  assert.equal(ok.status, 200);
  const v = await verifyOrder(ok.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'egadmit' });
  assert.deepEqual([v.claims.eb, v.claims.ew], [open.body.b, 7], 'her order names the breach\'s start');
  const no = await S.call('/v1/eg/admit', { b: open.body.b }, ann.secret);
  assert.deepEqual([no.status, no.body], [403, { error: 'start', w: 7 }], 'she has not taken Redoubt 7 this season');
  assert.equal(S.env.DB._raw.prepare('SELECT eg_live_b AS b FROM players WHERE id = ?').get(ann.id).b, null, 'and holds no live breach for it');
  // PIN MOVED (AUDIT EG III, lane3 #9): a breach the service holds no stake for is no breach - its start read as Hall 1
  // signed an order any room took
  const free = await S.call('/v1/eg/admit', { b: 'fedcba9876543210' }, ann.secret);
  assert.deepEqual([free.status, free.body], [400, { error: 'breach' }], 'no stake known: no breach, no order');
  assert.equal(S.env.DB._raw.prepare('SELECT eg_live_b AS b FROM players WHERE id = ?').get(ann.id).b, null, 'and no live breach for it');
});
