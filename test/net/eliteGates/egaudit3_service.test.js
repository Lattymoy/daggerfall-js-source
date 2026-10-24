// AUDIT EG III (2026-10-13, the audit of the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 5, 6.1, 20, 22
// and 23) - THE SERVICE GROUP, THE ACCOUNT'S HALF: the stake a void gives back (lane3 #1), the first breach's mercy decided
// by the breach's end and paid on the account's first breach alone (#6), a voided Rehearsal's day (#14), an admission to a
// breach the service staked and is still open (#9, #15), the recap's standing keyed as the board keys a company (#4) and
// the boards' rankings kept a minute (#18). The real Worker over node:sqlite with every migration (test/accountDb.mjs);
// every end receipt here is THE PRODUCER'S - the relay's director (net/eliteGates/egBrain.js oweEnd) ending a breach the service's own
// open staked, its claims minted as the room mints them (TEST THE SHAPE THE PRODUCER MINTS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { mintEgReceipt, readEgReceipt, egReceiptValid, egCompanyTag } from '../../../src/net/eliteGates/egReceipt.js';
import { egBreachNew, egEnter, egFall, egForsake, egEnd, egStep } from '../../../src/net/eliteGates/egBrain.js';
import { EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { verifyOrder } from '../../../src/net/identityToken.js';
import { EG_LIVE_S, EG_ADMIT_WINDOW_S, EG_OPEN_WINDOW_S, EG_LIVE_SLACK_S } from '../../../server-account/src/eg.js';
import { EG_BOARD_CACHE_S, egBoardOf, _resetEgHonoursCache } from '../../../server-account/src/egHonours.js';

const { subtle } = globalThis.crypto;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
let rqs = 0;
const rq = () => `rq${String(++rqs).padStart(16, '0')}`;
async function stood(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  _resetEgHonoursCache();
  const S = await standService();
  const raw = S.env.DB._raw;
  return { S, raw, at: (s) => { clock = s * 1000; }, now: () => Math.floor(clock / 1000) };
}
const keysOf = (raw, id) => raw.prepare('SELECT eg_keys AS k FROM players WHERE id = ?').get(id).k;
const stateOf = (raw, ez) => raw.prepare('SELECT state FROM eg_stakes WHERE ez = ?').get(ez).state;
const mercyOf = (raw, id) => raw.prepare('SELECT eg_mercy AS m FROM players WHERE id = ?').get(id).m;
/** An account that has closed a gate (proven) holding `keys` Weir Keys. */
async function bearer(S, raw, handle, keys, day) {
  const p = await S.registered(handle);
  assert.equal((await S.claim(p, day, T0)).body.weir.found, true, `${handle} proven`);
  raw.prepare('UPDATE players SET eg_keys = ? WHERE id = ?').run(keys, p.id);
  return p;
}
/** The service's own open, answered. */
async function opened(S, who, body = {}) {
  const r = await S.call('/v1/eg/open', { rq: rq(), ...body }, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
/**
 * THE RELAY'S DIRECTOR ON THAT OPEN: a breach (net/eliteGates/egBrain.js egBreachNew) under the service's breach id and order, its
 * company `members` (the opener first) entered in the open window and its first hall woken (test/net/eliteGates/egz_recap.test.js `play`'s
 * way) - `owed()` the receipts it owes since last asked, each minted with its seed as the room mints it (`mint`).
 */
function directorFor(S, open, opener, members = [], { now: t0 = T0 * 1000 } = {}) {
  const co = [opener, ...members].map((p, i) => [p.id, p.handle, i + 1]);
  const B = egBreachNew({ b: open.b, ez: open.ez, s: opener.id, o: opener.handle, ew: 0, rh: open.rh === 1 ? 1 : 0, seed: 7, op: t0, co, site: SITE, wg: [] });
  const t = t0 + EG_SEALED_MS + 100;
  co.forEach(([sub], i) => assert.equal(egEnter(B, sub, `${'o'.repeat(19)}${i}`, 20, t), null));
  B.h = 1; B.sg = 'trial'; B.wk = t; B.hw = t; B.cnt = { left: 1_800_000, at: t };
  let seed = 100;
  const owed = () => { const o = B.owe; B.owe = []; return o; };
  const mint = async (o, nowS) => mintEgReceipt({ ...o.claims, ...(o.claims.q === 'v' ? {} : { c: ++seed }) }, S.gatePriv, { subtle, nowS });
  return { B, owed, mint, t };
}
const claim = async (S, who, r) => (await S.call('/v1/eg/claim', { receipt: r }, who.secret)).body;
/** A Redoubt's `w` for `who` on that breach, as the room's redoubt() owes it (net/eliteGates/egBrain.js - the Court's earners). */
const wOf = (S, open, who, nowS, co) => mintEgReceipt({ q: 'w', b: open.b, s: who.id, z: open.ez, c: 77, w: 1, h: 5, t: 900, n: co.length, ew: 0, l: 20, co: egCompanyTag(co) }, S.gatePriv, { subtle, nowS });

test('AUDIT EG III (lane3 #1, section 23 RETURNED: "an x with why:\'void\', even after w receipts"): A VOID GIVES THE KEY BACK AFTER ANY REDOUBT - the company took Redoubt 1 (the stake spent), then a force deploy voided the breach: the opener\'s own `void` end gives the key back and the company keeps its Redoubt; a `v` to an opener who never entered, after the company\'s Redoubt, the same; a void carried again pays nothing more, nor a Redoubt claimed after it (mutants: a void that gives back a held stake alone; the void paying twice; a Redoubt after the void spending it again)', async (t) => {
  const { S, raw, now } = await stood(t);
  const mac = await bearer(S, raw, 'Opener', 2, 700), ann = await S.registered('Member');
  // an entered opener: the end's own void
  const o1 = await opened(S, mac);
  assert.equal(keysOf(raw, mac.id), 1, 'staked');
  const D = directorFor(S, o1, mac, [ann]);
  assert.equal((await claim(S, ann, await wOf(S, o1, ann, now(), [mac.id, ann.id]))).recorded, true, 'the company took Redoubt 1');
  assert.equal(stateOf(raw, o1.ez), 'spent', 'its first Redoubt spent the stake');
  egEnd(D.B, 'void', D.t + 60_000, []);   // the room woken under a force deploy's stamp (server/src/index.js _egResume)
  const ends = await Promise.all(D.owed().map((o) => D.mint(o, now())));
  const mine = ends.find((r) => readEgReceipt(r).s === mac.id);
  assert.deepEqual([readEgReceipt(mine).q, readEgReceipt(mine).why], ['x', 'void'], 'the producer: the opener\'s end says void');
  const c1 = await claim(S, mac, mine);
  assert.deepEqual([c1.recorded, c1.keys, stateOf(raw, o1.ez)], [true, 2, 'returned'], 'the key back, though the Redoubt spent it');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM eg_redoubts WHERE b = ?').get(o1.b).n, 1, 'the company keeps its Redoubt');
  assert.equal((await claim(S, mac, mine)).keys, 2, 'carried again: nothing more');
  const annEnd = ends.find((r) => readEgReceipt(r).s === ann.id);
  assert.equal((await claim(S, ann, annEnd)).keys, 0, 'a member\'s void end: the key given once, to its opener');
  assert.equal(keysOf(raw, mac.id), 2);
  // an opener who never entered: the void itself, after the company's Redoubt
  const o2 = await opened(S, mac);
  const E = directorFor(S, o2, mac, [ann]);
  E.B.mem[mac.id].in = 0;   // the opener stood at the arch and never stepped through (egEnd's `!B.mem[B.s]?.in`)
  assert.equal((await claim(S, ann, await wOf(S, o2, ann, now(), [mac.id, ann.id]))).recorded, true);
  assert.equal(stateOf(raw, o2.ez), 'spent');
  egEnd(E.B, 'void', E.t + 60_000, []);
  const v = (await Promise.all(E.owed().map((o) => E.mint(o, now())))).find((r) => readEgReceipt(r).q === 'v');
  assert.ok(v, 'the producer: the opener who never entered is owed the void');
  assert.deepEqual([(await claim(S, mac, v)).keys, stateOf(raw, o2.ez)], [2, 'returned']);
  assert.equal((await claim(S, mac, v)).keys, 2, 'the void pays once');
  // a Redoubt claimed after the void: the stake stays returned
  assert.equal((await claim(S, ann, await mintEgReceipt({ q: 'w', b: o2.b, s: ann.id, z: o2.ez, c: 78, w: 2, h: 10, t: 1900, n: 2, ew: 0, l: 20 }, S.gatePriv, { subtle, nowS: now() }))).recorded, true);
  assert.deepEqual([stateOf(raw, o2.ez), keysOf(raw, mac.id)], ['returned', 2]);
});

test('AUDIT EG III (lane3 #6, section 5 "The first breach\'s mercy"): THE MERCY WAITS FOR THE BREACH\'S END - the relay says an end of a breach over with no Redoubt taken (`nr`, the producer\'s: the last member living, or the end\'s own); the opener\'s own end while the company played on holds the stake, which the company\'s Redoubt 1 then spends (no mercy, none used); a solo first breach\'s fall gives it back; a company\'s first breach whose opener fell first is given back by the member\'s end that closed it; a breach after a voided first is still the first; any breach after the first kept nothing - and the mercy is once ever (mutants: the mercy on the opener\'s early end; the word never read; "first" unenforced; a void counted as the first; the mercy twice)', async (t) => {
  const { S, raw, now } = await stood(t);
  // A: the opener forsakes in Hall 1, the company takes Redoubt 1 after
  const a = await bearer(S, raw, 'Alpha', 1, 700), am = await S.registered('AlphaMate');
  const oA = await opened(S, a);
  const A = directorFor(S, oA, a, [am]);
  egFall(A.B, a.id, A.t + 30_000, [], null);
  assert.equal(egForsake(A.B, a.id, A.t + 31_000, []), true);
  const [aEnd] = await Promise.all(A.owed().map((o) => A.mint(o, now())));
  assert.deepEqual([readEgReceipt(aEnd).why, readEgReceipt(aEnd).nr], ['forsake', undefined], 'the producer: a forsaking while the company lives - no word of the end');
  assert.deepEqual([(await claim(S, a, aEnd)).keys, stateOf(raw, oA.ez)], [0, 'held'], 'held for the breach\'s end');
  assert.equal((await claim(S, am, await wOf(S, oA, am, now(), [a.id, am.id]))).recorded, true, 'the company takes Redoubt 1');
  assert.deepEqual([stateOf(raw, oA.ez), keysOf(raw, a.id), mercyOf(raw, a.id)], ['spent', 0, 0], 'spent by the Redoubt - no mercy paid');
  // ...and its next breach is no first: a solo fall that closes it spends the key
  raw.prepare('UPDATE players SET eg_keys = 1 WHERE id = ?').run(a.id);
  const oA2 = await opened(S, a);
  const A2 = directorFor(S, oA2, a);
  egFall(A2.B, a.id, A2.t + 30_000, [], null);
  egForsake(A2.B, a.id, A2.t + 31_000, []);
  const [a2End] = await Promise.all(A2.owed().map((o) => A2.mint(o, now())));
  assert.equal(readEgReceipt(a2End).nr, 1, 'the producer: the last member living - the breach is over, no Redoubt');
  assert.deepEqual([(await claim(S, a, a2End)).keys, stateOf(raw, oA2.ez), mercyOf(raw, a.id)], [0, 'spent', 0], 'not the account\'s first breach: spent');
  // B: a solo first breach - the fall that ends it gives the key back, once ever
  const b = await bearer(S, raw, 'Bravo', 1, 701);
  const oB = await opened(S, b);
  const Bd = directorFor(S, oB, b);
  egFall(Bd.B, b.id, Bd.t + 30_000, [], null);
  egForsake(Bd.B, b.id, Bd.t + 31_000, []);
  const [bEnd] = await Promise.all(Bd.owed().map((o) => Bd.mint(o, now())));
  assert.deepEqual([(await claim(S, b, bEnd)).keys, stateOf(raw, oB.ez), mercyOf(raw, b.id)], [1, 'returned', 1], 'the first breach\'s mercy');
  // C: a company's first breach - the opener falls first, the member's end closes it
  const c = await bearer(S, raw, 'Charlie', 1, 702), cm = await S.registered('CharlieMate');
  const oC = await opened(S, c);
  const Cd = directorFor(S, oC, c, [cm]);
  egFall(Cd.B, c.id, Cd.t + 30_000, [], null);
  egForsake(Cd.B, c.id, Cd.t + 31_000, []);
  const [cEnd] = await Promise.all(Cd.owed().map((o) => Cd.mint(o, now())));
  assert.deepEqual([(await claim(S, c, cEnd)).keys, stateOf(raw, oC.ez)], [0, 'held'], 'the opener\'s end: held');
  egFall(Cd.B, cm.id, Cd.t + 60_000, [], null);   // the last living member falls (a witness, the recall unspent)
  egStep(Cd.B, Cd.t + 60_250, [], () => 0.5);   // the director's next beat: nobody living - the end
  assert.equal(Cd.B.end, 'wipe');
  const [cmEnd] = await Promise.all(Cd.owed().map((o) => Cd.mint(o, now())));
  assert.deepEqual([readEgReceipt(cmEnd).s, readEgReceipt(cmEnd).why, readEgReceipt(cmEnd).nr], [cm.id, 'wipe', 1], 'the producer: the end\'s own word');
  assert.equal((await claim(S, cm, cmEnd)).recorded, true);
  assert.deepEqual([keysOf(raw, c.id), stateOf(raw, oC.ez), mercyOf(raw, c.id)], [1, 'returned', 1], 'the member\'s end gave the opener\'s key back');
  // D: a first breach voided - the breach after it is still the first
  const d = await bearer(S, raw, 'Delta', 1, 703);
  const oD1 = await opened(S, d);
  assert.equal((await claim(S, d, await mintEgReceipt({ q: 'v', b: oD1.b, s: d.id, z: oD1.ez }, S.gatePriv, { subtle, nowS: now() }))).keys, 1);
  const oD2 = await opened(S, d);
  const Dd = directorFor(S, oD2, d);
  egFall(Dd.B, d.id, Dd.t + 30_000, [], null);
  egForsake(Dd.B, d.id, Dd.t + 31_000, []);
  const [dEnd] = await Promise.all(Dd.owed().map((o) => Dd.mint(o, now())));
  assert.deepEqual([(await claim(S, d, dEnd)).keys, stateOf(raw, oD2.ez)], [1, 'returned'], 'a voided breach is given back whole: the next is the first');
  // once ever: Bravo's mercy spent (its first breach given back by it is no breach the Spire kept - the mercy's own mark holds)
  const oB2 = await opened(S, b);
  assert.equal(keysOf(raw, b.id), 0);
  const B2 = directorFor(S, oB2, b);
  egFall(B2.B, b.id, B2.t + 30_000, [], null);
  egForsake(B2.B, b.id, B2.t + 31_000, []);
  const [b2End] = await Promise.all(B2.owed().map((o) => B2.mint(o, now())));
  assert.deepEqual([(await claim(S, b, b2End)).keys, stateOf(raw, oB2.ez)], [0, 'spent'], 'the mercy is once ever');
  // the word is an end's alone
  assert.equal(egReceiptValid({ q: 'w', b: oA.b, s: a.id, z: oA.ez, c: 1, w: 1, h: 5, t: 9, n: 1, ew: 0, l: 3, i: 1, e: 2, nr: 1 }), false, 'a Redoubt says no end');
  assert.equal(egReceiptValid({ ...readEgReceipt(bEnd), nr: 2 }), false, 'one word, 1');
});

test('AUDIT EG III (lane3 #14): A VOIDED REHEARSAL GIVES BACK ITS DAY - a Rehearsal the room never took (its void the producer\'s: the opener never entered) frees the day\'s Rehearsal again; a void of yesterday\'s Rehearsal frees nothing of today\'s (mutants: the day never given back; any day given back)', async (t) => {
  const { S, raw, at, now } = await stood(t);
  const me = await S.registered('Rehearser');
  const o1 = await opened(S, me, { rh: 1 });
  const D = directorFor(S, o1, me);
  D.B.mem[me.id].in = 0;
  egEnd(D.B, 'void', D.t + 1000, []);
  const v = (await Promise.all(D.owed().map((o) => D.mint(o, now())))).find((r) => readEgReceipt(r).q === 'v');
  assert.ok(v);
  assert.equal((await claim(S, me, v)).recorded, true);
  assert.equal((await S.call('/v1/eg/keys', {}, me.secret)).body.rehearsal, true, 'the day\'s Rehearsal free again');
  const o2 = await opened(S, me, { rh: 1 });
  assert.equal(o2.rh, 1, 'and opened again the same day');
  // yesterday's void after today's Rehearsal
  at(T0 + 86_400);
  raw.prepare('UPDATE players SET eg_live_b = NULL, eg_live_until = 0 WHERE id = ?').run(me.id);
  await opened(S, me, { rh: 1 });
  raw.prepare('UPDATE players SET eg_live_b = NULL, eg_live_until = 0 WHERE id = ?').run(me.id);
  assert.equal((await claim(S, me, await mintEgReceipt({ q: 'v', b: o2.b, s: me.id, z: o2.ez }, S.gatePriv, { subtle, nowS: now() }))).recorded, true);
  assert.deepEqual((await S.call('/v1/eg/open', { rq: rq(), rh: 1 }, me.secret)).body, { error: 'rehearsed' }, 'yesterday\'s void gives back nothing of today');
});

test('AUDIT EG III (lane3 #9, #15; sections 6.1 and 23): AN ADMISSION IS TO A BREACH THE SERVICE STAKED, WHILE IT IS OPEN - an id no open staked is refused `breach` (its start had read as Hall 1); the live breach it sets ends with its stake (`until`, never the ask\'s three hours twenty); past the open window, or a stake settled, `spent` - and no account is locked out by it (mutants: the stake unread; the window unchecked; the ask\'s own bound; a settled stake admitting)', async (t) => {
  const { S, raw, at, now } = await stood(t);
  const mac = await bearer(S, raw, 'Opener', 2, 700), ann = await S.registered('Ann'), bob = await S.registered('Bob');
  assert.deepEqual(await S.call('/v1/eg/admit', { b: '0123456789abcdef' }, ann.secret), { status: 400, body: { error: 'breach' } }, 'no stake, no breach');
  const o = await opened(S, mac);
  at(T0 + 300);
  const a = await S.call('/v1/eg/admit', { b: o.b }, ann.secret);
  assert.equal(a.status, 200);
  assert.equal((await verifyOrder(a.body.order, S.identityPublic, { subtle, nowS: now(), kind: 'egadmit' })).claims.ew, 0);
  assert.deepEqual((await S.call('/v1/eg/keys', {}, ann.secret)).body.live, { b: o.b, until: T0 + EG_LIVE_S }, 'the stake\'s own until');
  assert.equal(EG_ADMIT_WINDOW_S, EG_OPEN_WINDOW_S + EG_LIVE_SLACK_S);
  at(T0 + EG_ADMIT_WINDOW_S);
  assert.equal((await S.call('/v1/eg/admit', { b: o.b }, ann.secret)).status, 200, 'the window\'s last second');
  at(T0 + EG_ADMIT_WINDOW_S + 1);
  assert.deepEqual(await S.call('/v1/eg/admit', { b: o.b }, bob.secret), { status: 409, body: { error: 'spent' } }, 'the breach has closed behind its company');
  assert.equal((await S.call('/v1/eg/keys', {}, bob.secret)).body.live, null, 'and locked nobody out');
  // a settled stake admits nobody
  const o2 = await opened(S, await bearer(S, raw, 'Other', 1, 701));
  raw.prepare("UPDATE eg_stakes SET state = 'returned' WHERE ez = ?").run(o2.ez);
  assert.deepEqual((await S.call('/v1/eg/admit', { b: o2.b }, bob.secret)).body, { error: 'spent' });
});

test('AUDIT EG III (lane3 #4, section 27.6): THE RECAP\'S STANDING IS THE BOARD\'S OWN COMPANY - two members\' ends of one breach, the producer\'s (each carrying the company\'s tag, `co`), answer the Descent\'s rank of the row the board shows; keyed by its claimers, the standing found no row for any company the relay tagged and fell to the Depths (mutants: the claimers\' key)', async (t) => {
  const { S, raw, now } = await stood(t);
  const lead = await bearer(S, raw, 'Lead', 1, 700), mate = await S.registered('Mate');
  const o = await opened(S, lead);
  const D = directorFor(S, o, lead, [mate]);
  D.B.cleared = 7; D.B.td = 1500;   // the deepest hall cleared, and its seconds (net/eliteGates/egBrain.js clearHall)
  egEnd(D.B, 'tear', D.t + 1_800_000, []);
  const ends = await Promise.all(D.owed().map((x) => D.mint(x, now())));
  assert.deepEqual(ends.map((r) => readEgReceipt(r).co), [egCompanyTag([lead.id, mate.id]), egCompanyTag([lead.id, mate.id])], 'the producer tags the company');
  const by = Object.fromEntries(ends.map((r) => [readEgReceipt(r).s, r]));
  assert.deepEqual((await claim(S, lead, by[lead.id])).board, { k: 'descent', br: 'few', rank: 1 });
  assert.deepEqual((await claim(S, mate, by[mate.id])).board, { k: 'descent', br: 'few', rank: 1 }, 'the same company, one row');
  const board = (await S.call('/v1/eg/board', {}, mate.secret)).body;
  assert.deepEqual(board.descent.few.rows.map((r) => [r.rank, r.h, r.you]), [[1, 7, true]], 'the row the board shows');
});

test('AUDIT EG III (lane3 #18): THE BOARDS\' RANKINGS KEPT A MINUTE - a crowd at the board reads the season\'s ends, its depths and every Redoubt ever taken once a Worker each EG_BOARD_CACHE_S, each caller still pinned its own row; a Redoubt or an end this Worker records forgets them at once (mutants: never kept; never coalesced; never forgotten at a claim; one caller\'s row marked on another\'s)', async (t) => {
  const { S, raw, at, now } = await stood(t);
  const me = await bearer(S, raw, 'Reader', 1, 700), you = await S.registered('Other');
  let deep = 0;
  const prepare = S.env.DB.prepare.bind(S.env.DB);
  S.env.DB.prepare = (sql) => { if (/PARTITION BY account ORDER BY w DESC/.test(sql)) deep++; return prepare(sql); };
  const o = await opened(S, me);
  assert.equal((await claim(S, me, await wOf(S, o, me, now(), [me.id]))).recorded, true);
  // two boards asked together, at the service's own door (egHonours.js egBoardOf, as the route calls it)
  const ctx = { db: S.env.DB, nowS: now() };
  const [b1, b2] = await Promise.all([egBoardOf(ctx, { id: me.id, handle: me.handle }, S.env), egBoardOf(ctx, { id: you.id, handle: you.handle }, S.env)]);
  assert.equal(deep, 1, 'read once for two callers asking together (one read, shared)');
  assert.deepEqual([b1.deepest.rows.map((r) => r.you), b2.deepest.rows.map((r) => r.you)], [[true], [false]], 'each caller its own row');
  at(T0 + EG_BOARD_CACHE_S - 1);
  await S.call('/v1/eg/board', {}, me.secret);
  assert.equal(deep, 1, 'kept within the minute');
  at(T0 + EG_BOARD_CACHE_S);
  await S.call('/v1/eg/board', {}, me.secret);
  assert.equal(deep, 2, 'read again past it');
  assert.equal((await claim(S, me, await mintEgReceipt({ q: 'w', b: o.b, s: me.id, z: o.ez, c: 79, w: 2, h: 10, t: 1900, n: 1, ew: 0, l: 20 }, S.gatePriv, { subtle, nowS: now() }))).recorded, true);
  const b3 = (await S.call('/v1/eg/board', {}, me.secret)).body;
  assert.deepEqual([deep, b3.deepest.rows[0].w], [3, 2], 'a claim recorded here: read again, the new Redoubt on it');
  assert.equal(EG_BOARD_CACHE_S, 60);
});
