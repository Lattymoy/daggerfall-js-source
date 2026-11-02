// EMBERS-OWED and BROKER-RID (FB1024, 2026-10-24; AUDIT FB1024, 2026-10-25). The report, #bug-reports: "A few days ago, I
// tried to purchase my first battlemage piece ... the transaction never went through, the embers were not taken out and I
// didn't get the piece ... I was however locked out for the week ... I now have 52 deadlands embers on me, and it will not
// let me buy the aura, it says I have too few". A sale is two ledgers - the pack's embers and the account's purse - and a
// sale whose answer was lost AND whose question after went unheard gave the pack its embers back blind while the service had
// written it. EMBERS-OWED owed such a sale and asked after it by the week and the piece; the audit's lanes broke that (an
// honest sale answering for a press that never landed - pieces without end; the week turning; a save loaded again minting
// the piece again). So every press carries a request id, the service writes it beside the sale or FENCES it
// (server-account/src/brokerSales.js), and the owed sale is settled by that id alone (systems/sigil/sigilBroker.js).
// Record: bible/01-Overview/bugs/Field-Bugs-2026-10-24.md.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  panoplySale, insigniaSale, settleOwedSales, brokerOwedDoor, brokerOwed, validOwed, _resetOwed, stoneCount, spendableStonesIn,
  OWED_MAX, BROKER_OWED_VENDOR, BROKER_OWED_TEXT, brokerOwedText, insigniaUnheard,
} from '../../src/systems/sigil/sigilBroker.js';
import { modSaveRecords, restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import { sigilStone } from '../../src/systems/gate/gateSpoils.js';
import { panoplyPieceById } from '../../src/systems/aetheric.js';
import { EG_SINK_EMBERS, EG_PANOPLY_IDS } from '../../src/net/eliteGates/egPay.js';
import { INSIGNIA, BROKER_RID_RE, mintBrokerRid } from '../../src/net/insignia.js';
import { standService, sessionStorageOf } from '../accountDb.mjs';
import { accountEg, buyInsignia, settleBrokerSale, SESSION_KEY } from '../../src/net/accountClient.js';
import { ARENA_SEASON_EPOCH_S, ARENA_WEEK_S, arenaWeekOf } from '../../src/net/arena/arenaLaw.js';

const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
const count = (pack) => stoneCount(spendableStonesIn(pack));
const P = EG_PANOPLY_IDS[3];
const AURA = INSIGNIA.find((o) => o.kind === 'aura');
const BASE = 'https://accounts.invalid';
const isPiece = (id) => (it) => it.name === panoplyPieceById(id).name;
const pieces = (pack, id = P) => pack.filter(isPiece(id)).length;
const NOW0 = ARENA_SEASON_EPOCH_S + 9 * ARENA_WEEK_S + 86_400;

/** The service standing, the clock at `now` (moved with `at`), an account with `embers` earned, and its doors: `eg` the
 *  Panoply's (accountEg), `io` the account's (call's), each a `down` twin whose answers are lost after the service wrote. */
async function stood(t, { embers = 52, handle = 'Punch' } = {}) {
  let clock = NOW0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService({ MARKS_OPEN: 'on' });
  const raw = S.env.DB._raw;
  const me = await S.registered(handle);
  for (let i = 0; i < embers; i++) raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(3001 + i, me.id, 'sethrakul', 4, me.character, 0, `e${handle}${i}`, NOW0, 1);
  const storage = sessionStorageOf(SESSION_KEY, me);
  const lostAfter = async (u, i) => { await S.fetch(u, i); throw new TypeError('Failed to fetch'); };
  const never = async () => { throw new TypeError('Failed to fetch'); };
  return {
    S, raw, me, at: (s) => { clock = s * 1000; },
    eg: accountEg({ fetch: S.fetch, storage }), egLost: accountEg({ fetch: lostAfter, storage }), egNever: accountEg({ fetch: never, storage }),
    io: { fetch: S.fetch, base: BASE, secret: me.secret, account: me.id }, ioLost: { fetch: lostAfter, base: BASE, secret: me.secret, account: me.id },
    ioNever: { fetch: never, base: BASE, secret: me.secret, account: me.id },
    spent: () => Number(raw.prepare('SELECT insignia_spent FROM players WHERE id = ?').get(me.id).insignia_spent),
    sinks: () => raw.prepare('SELECT wk, piece FROM eg_sink WHERE account = ? ORDER BY wk').all(me.id).map((r) => [r.wk, r.piece]),
  };
}
/** The host's door (world.js) over one pack, its settles through `ioOf()`. */
const doorOf = (entity, ioOf, saved = { n: 0 }) => brokerOwedDoor(entity, { changed: () => { saved.n++; } }, panoplyPieceById, ioOf, settleBrokerSale);

beforeEach(() => _resetOwed());

test('BROKER-RID THE REPORT\'S CASE over the real Worker: the sale lands, its answer and the question after are both lost - the embers stay out and the sale is owed; the next open hands the piece, once; the pack\'s 32 is the account\'s too (mutants: refunded blind; the piece never added; the owed row unsaved)', async (t) => {
  const W = await stood(t);
  const entity = { items: [stack(52)] };
  const saved = { n: 0 };
  let io = W.ioLost;
  const door = doorOf(entity, () => io, saved);
  const r = await door.panoply(P, (p, rid) => W.egLost.sink(p, rid));
  assert.deepEqual([r, count(entity.items), saved.n], [{ ok: false, error: 'unheard' }, 32, 1], 'owed, saved at once');
  assert.equal(W.spent(), EG_SINK_EMBERS, 'the account was charged');
  const [row] = brokerOwed();
  assert.deepEqual([row.kind, row.id, row.embers, row.account, BROKER_RID_RE.test(row.rid)], ['panoply', P, EG_SINK_EMBERS, W.me.id, true]);
  assert.deepEqual(modSaveRecords()[BROKER_OWED_VENDOR], [row], 'and the save carries it');
  io = W.io;   // the service answers again
  const a = await door.settled(W.eg.keys);
  assert.equal(a.data.sink.piece, P, 'the window gets its own answer');
  assert.deepEqual([brokerOwed(), count(entity.items), pieces(entity.items)], [[], 32, 1], 'the piece; the pack 32, the account\'s purse 32');
  assert.equal(saved.n, 2, 'and saved at once - a page closed before its checkpoint would load the row again, and the piece is the first ask\'s alone');
  await door.settled(W.eg.keys);
  assert.equal(pieces(entity.items), 1, 'a second open hands nothing more');
});

test('BROKER-RID THE VOUCHER CLOSED (AUDIT FB1024 lane B4): a save that holds an owed sale, loaded again after it was settled, is told the piece was handed out - no second piece; a settle whose answer was lost counts as this page\'s, so the next one still hands it (mutants: every ask handed the piece; a lost ask forgotten)', async (t) => {
  const W = await stood(t);
  // the report's case, with this open's settle lost too
  const e2 = { items: [stack(52)] };
  let io = W.ioLost;
  const d2 = doorOf(e2, () => io);
  const r = await d2.panoply(EG_PANOPLY_IDS[5], (p, rid) => W.egLost.sink(p, rid));
  assert.equal(r.error, 'unheard');
  const save = structuredClone(modSaveRecords()[BROKER_OWED_VENDOR]);
  await d2.settled(async () => null);   // this open's settle reaches the service, its answer is lost
  assert.equal(brokerOwed().length, 1, 'unheard: still owed');
  io = W.io;
  await d2.settled(async () => null);
  assert.deepEqual([brokerOwed(), pieces(e2.items, EG_PANOPLY_IDS[5])], [[], 1], 'the lost ask was the first: this page\'s - the piece');
  // the save from before the settle, loaded again: the same owed sale, asked again - handed out already
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: save });
  const e3 = { items: [stack(32)] };
  await doorOf(e3, () => W.io).settled(async () => null);
  assert.deepEqual([brokerOwed(), pieces(e3.items, EG_PANOPLY_IDS[5]), count(e3.items)], [[], 0, 32], 'no second piece, no embers back');
});

test('BROKER-RID THE FENCE (lanes B2, C HIGH-1): a press the service never wrote is fenced by its settle - the embers back, and the press landing late writes nothing; an honest sale a week before answers for nothing; the week turning between a sale and its settle still finds it (mutants: no fence; a late press written; the week asked)', async (t) => {
  const W = await stood(t, { embers: 200 });
  // an honest sale in week 9, its piece handed over
  const entity = { items: [stack(200)] };
  const door = doorOf(entity, () => W.io);
  assert.equal((await door.panoply(P, (p, rid) => W.eg.sink(p, rid))).ok, true);
  // week 10: three presses of the same piece that never reach the service, and the window reopened after each
  W.at(NOW0 + ARENA_WEEK_S);
  let rid = null;
  for (let i = 0; i < 3; i++) {
    let io = W.ioNever;
    const d = doorOf(entity, () => io);
    const r = await d.panoply(P, (p, id) => { rid = id; return W.egNever.sink(p, id); });
    assert.equal(r.error, 'unheard');
    io = W.io;
    await d.settled(async () => null);
  }
  assert.deepEqual([pieces(entity.items), count(entity.items), brokerOwed()], [1, 180, []], 'one piece, the presses\' embers back (lane C: four pieces for one sale)');
  assert.deepEqual(W.sinks(), [[arenaWeekOf(NOW0), P]]);
  // the last press lands now, late: fenced, nothing written, nothing charged
  const late = await W.eg.sink(P, rid);
  assert.deepEqual([late.ok, late.error, W.spent(), W.sinks().length], [false, 'fenced', EG_SINK_EMBERS, 1]);
  // a sale on the last second of week 10, its answer and question lost, settled in week 11: found by its id
  W.at(NOW0 + 2 * ARENA_WEEK_S - 86_400 - 1);
  let io = W.ioLost;
  const d = doorOf(entity, () => io);
  assert.equal((await d.panoply(EG_PANOPLY_IDS[7], (p, id) => W.egLost.sink(p, id))).error, 'unheard');
  W.at(NOW0 + 2 * ARENA_WEEK_S);
  io = W.io;
  await d.settled(async () => null);
  assert.deepEqual([pieces(entity.items, EG_PANOPLY_IDS[7]), brokerOwed()], [1, []], 'the week turned (lanes B1, C MED-2): the piece');
});

test('BROKER-RID AN OWED SALE IS ITS ACCOUNT\'S (lanes B11, C MED-3): settled under the account that made it alone - another signed in leaves it owed; signed out, a press is refused as the door refused it (C MED-1) (mutants: any account settles; no-session owed)', async (t) => {
  const W = await stood(t);
  const entity = { items: [stack(52)] };
  await doorOf(entity, () => W.ioLost).panoply(P, (p, rid) => W.egLost.sink(p, rid));
  const other = await W.S.registered('Other');
  const otherIo = { fetch: W.S.fetch, base: BASE, secret: other.secret, account: other.id };
  await doorOf(entity, () => otherIo).settled(async () => null);
  assert.deepEqual([brokerOwed().length, count(entity.items), pieces(entity.items)], [1, 32, 0], 'another account asks nothing of it');
  await doorOf(entity, () => W.io).settled(async () => null);
  assert.deepEqual([brokerOwed().length, pieces(entity.items)], [0, 1]);
  // signed out: the door sends nothing, and the press takes nothing
  _resetOwed();
  const out = { items: [stack(52)] };
  const signedOut = accountEg({ fetch: W.S.fetch, storage: { getItem: () => null } });
  const r = await doorOf(out, () => null).panoply(P, (p, rid) => signedOut.sink(p, rid));
  assert.deepEqual([r.error, count(out.items), brokerOwed()], ['no-session', 52, []]);
  assert.equal(insigniaUnheard({ ok: false, error: 'no-session' }), false, 'the door sent nothing: nothing was written');
  // a press unheard with no account to ask under (a session gone mid-sale): given back as refused, never owed unaskable
  const lone = { items: [stack(52)] };
  const r2 = await panoplySale(P, { items: lone.items, buy: async () => ({ ok: false, error: 'offline' }), settle: async () => ({ ok: false, error: 'offline' }), mint: panoplyPieceById, save: () => {}, account: null });
  assert.deepEqual([r2.error, count(lone.items), brokerOwed()], ['no-session', 52, []]);
});

test('BROKER-RID THE INSIGNIA over the real Worker: a sale landed, both answers lost - owed, the next open finds it the account\'s; one never landed - fenced, the stones back; a second press while the first is owed pays once (mutants: the insignia settle never run; an owned insignia refunded)', async (t) => {
  const W = await stood(t, { embers: 120 });
  const entity = { items: [stack(120)] };
  let io = W.ioLost;
  const door = doorOf(entity, () => io);
  assert.equal((await door.insignia(AURA, (id, rid) => buyInsignia(W.ioLost, id, rid))).error, 'unheard');
  assert.equal(count(entity.items), 120 - AURA.price);
  // a second press now: the service owns it already (`owned`) - those stones straight back
  io = W.io;
  assert.deepEqual(await door.insignia(AURA, (id, rid) => buyInsignia(W.io, id, rid)), { ok: false, error: 'owned' });
  assert.equal(count(entity.items), 120 - AURA.price);
  const a = await door.settled(() => W.S.call('/v1/account', {}, W.me.secret).then((x) => ({ ok: true, data: x.body })));
  assert.ok(a.ok);
  assert.deepEqual([brokerOwed(), count(entity.items), W.spent()], [[], 120 - AURA.price, AURA.price], 'the account\'s: the stones stay spent, once');
  // a press that never landed: fenced at the next open, the stones back
  const title = INSIGNIA.find((o) => o.kind === 'title');
  io = W.ioNever;
  assert.equal((await door.insignia(title, (id, rid) => buyInsignia(W.ioNever, id, rid))).error, 'unheard');
  io = W.io;
  await door.settled(async () => null);
  assert.deepEqual([brokerOwed(), count(entity.items), W.spent()], [[], 120 - AURA.price, AURA.price]);
});

test('BROKER-RID THE PAGE\'S OWN RACES (lane B3, B8): a save loaded while a settle is asked - the answer lands in the pack and the list as they stand then; one ask a sale at once; the list full refuses a press before anything is taken (mutants: the pack read before the ask; two asks of one sale; the cap after the take)', async () => {
  const rid = mintBrokerRid();
  const row = { kind: 'panoply', id: P, embers: EG_SINK_EMBERS, rid, account: 'acct-1' };
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: [row] });
  const before = { items: [stack(32)] }, after = { items: [stack(32)] };
  let entity = before, release;
  const gate = new Promise((res) => { release = res; });
  let asks = 0;
  const settle = async (body) => { asks++; await gate; return { ok: true, data: { held: false, by: body.nonce } }; };
  const io = { settle, account: () => 'acct-1', items: () => entity.items, save: () => {}, mint: panoplyPieceById };
  const one = settleOwedSales(io), two = settleOwedSales(io);
  entity = after;   // a save loaded while the service is asked
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: [row] });
  release();
  await Promise.all([one, two]);
  assert.deepEqual([asks, count(before.items), count(after.items), brokerOwed()], [1, 32, 52, []], 'one ask; the embers back into the pack that is owed them');
  // the list full: a press refused before its price is taken
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: Array.from({ length: OWED_MAX }, () => ({ ...row, rid: mintBrokerRid() })) });
  const full = [stack(60)];
  let bought = 0;
  const r = await insigniaSale(AURA, { items: full, buy: async () => { bought++; return { ok: true }; }, settle, save: () => {}, account: 'acct-1' });
  assert.deepEqual([r, count(full), bought], [{ ok: false, error: 'unheard' }, 60, 0]);
});

test('BROKER-RID the owed list rides the save, each row whole and priced as its sale is - one a request id (lane B12) (mutants: the price unchecked; a duplicate id kept; the newest dropped)', () => {
  const rid = mintBrokerRid();
  const good = { kind: 'panoply', id: P, embers: EG_SINK_EMBERS, rid, account: 'acct-1' };
  const ins = { kind: 'insignia', id: AURA.id, embers: AURA.price, rid: mintBrokerRid(), account: 'acct-1' };
  restoreModSaveRecords({ [BROKER_OWED_VENDOR]: [good, ins] });
  assert.deepEqual(modSaveRecords()[BROKER_OWED_VENDOR], [good, ins]);
  assert.deepEqual(validOwed([
    { ...good, embers: 1000 }, { ...ins, embers: AURA.price + 1 }, { ...good, kind: 'gold' }, { ...good, rid: 'x' }, { ...good, account: '' },
    { ...good, id: 'title:gatebreaker' }, null, good, { ...good }, ins,
  ]), [good, ins], 'priced as sold, one a request id');
  const many = Array.from({ length: OWED_MAX + 3 }, (_, i) => ({ ...good, rid: `b${String(i).padStart(15, '0')}` }));
  assert.deepEqual(validOwed(many).map((o) => o.rid), many.slice(-OWED_MAX).map((o) => o.rid), 'the newest kept');
  assert.equal(brokerOwedText(), BROKER_OWED_TEXT);
  assert.match(BROKER_OWED_TEXT, /Your embers are held/);
});

test('BROKER-RID the host door (world.js) - both sales and both loads through brokerOwedDoor, the account an owed sale is settled under on the io', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const brokerOwed = brokerOwedDoor\(playerEntity, saveSoon, panoplyPieceById, insigniaIo, settleBrokerSale\);/);
  assert.ok(w.indexOf('const insigniaIo = () =>') < w.indexOf('const brokerOwed = brokerOwedDoor('), 'the io built before the door is');
  assert.match(w, /return ses \? \{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), base: serviceBase\(st\), secret: ses\.secret, account: ses\.id \?\? null \} : null;/);
  assert.match(w, /const r = await brokerOwed\.settled\(\(\) => readAccount\(io\)\); if \(r\.ok\) insigniaAdopt\(r\.data\?\.wardrobe\);/);
  assert.match(w, /load: async \(\) => \{ try \{ const a = await brokerOwed\.settled\(_accountEg\.keys\); if \(a\?\.ok\) _panoplySink = a\.data\?\.sink \?\? null; \}/);
  assert.match(w, /const r = await brokerOwed\.insignia\(offer, \(id, rid\) => buyInsignia\(io, id, rid\)\);/);
  assert.match(w, /const r = await brokerOwed\.panoply\(id, \(p, rid\) => _accountEg\.sink\(p, rid\)\);/);
  assert.equal((w.match(/r\.error === 'unheard' \? brokerOwedText\(\)/g) ?? []).length, 2, 'both sales say it');
});
