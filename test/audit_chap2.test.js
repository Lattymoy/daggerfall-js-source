// AUDIT CHAP2 (2026-10-08, Mac: "Lets do a deep comprehensive audit on everything so far") - CHAP0's record, CHAP1's
// Roll and CHAP2a's halls read again by six lenses at 915043c5 (bible/01-Overview/Audit-Chapters.md, AUDIT CHAP2): a pin
// a fix, and the pins the lens of the pins wrote for every law the arc's three files could not fail.
//
// The law against literals; the tab and the hall book against fakes shaped as the service answers; the service over the
// real migrations (test/accountDb.mjs); a real tracker through the real door to the real service; the board's card in a
// DOM; and the hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';

import * as L from '../src/net/npcChapterLaw.js';
import { createRollTracker, ROLL_STOPS, rollEntityDoors } from '../src/net/npcRollTracker.js';
import { createHallBook, HALL_REPORTED_KEY, HALL_DONE, parseHallCommand, hallAuditLines, HALL_USAGE } from '../src/net/npcHallBook.js';
import { regionWritTable, courtWrits, material, herbPatches, nodeKey, daySeason } from '../src/net/nodeLaw.js';
import { revealingMemberships } from '../src/systems/guildHallReveal.js';
import { readRoll, claimRoll, rollViewOf } from '../server-account/src/npcRoll.js';
import { regionChapters, forgetChapters, witnessHall, listHalls, strikeHall, hallFacts } from '../server-account/src/npcHalls.js';
import { deliverWrit } from '../server-account/src/professions.js';
import { accountRoll, SESSION_KEY } from '../src/net/accountClient.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21;
const ALL22 = Object.fromEntries(L.ROLL_FACTIONS.map((f) => [f, 0]));
const settle = () => new Promise((r) => setTimeout(r, 0));
/** Waits on a real round trip by what it moves, never by a count of turns (a loaded runner takes more of them). */
async function until(cond, what) {
  for (let i = 0; i < 2000; i++) { if (cond()) return; await settle(); }
  assert.fail(`never: ${what}`);
}
const table = regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: true }], 'summer');

// ── THE LAW ─────────────────────────────────────────────────────────

test('AUDIT CHAP2 T1/T2/T19: the shapes at their edges - a full twenty-two is a seed, a claim and a kept record; a rank-0 member is a member; a rank out of its shape, an inherited name, NaN and an empty origin read as the law says (mutants: the map\'s bound, rank 0, the members\' guards, hasOwn, the finite read, the empty origin)', () => {
  assert.equal(L.rollSeedOk(ALL22), true);
  assert.notEqual(L.rollKeptOf({ seq: 1, factions: ALL22 }), null, 'every real kept record carries all twenty-two');
  assert.equal(L.rollDeltasOk(Object.fromEntries(L.ROLL_FACTIONS.map((f) => [f, 1]))), true);
  assert.equal(L.rollSeedOk({ ...ALL22, 510: 0 }), false);
  assert.deepEqual(L.rollMembersOf({ mortal: { 11: { guild: 'FightersGuild', rank: 0 } }, vampire: {} }), [{ f: 41, rank: 0 }], 'every fresh join');
  assert.deepEqual(L.rollMembersOf({ mortal: { 11: { guild: 'FightersGuild', rank: -1 } }, vampire: {} }), []);
  assert.equal(L.rollMembersOk([{ f: 40, rank: -1 }]), false);
  assert.equal(L.rollMembersOk([{ f: 40, rank: 1.5 }]), false);
  assert.equal(L.rollFactionOfGuild('Temple:constructor'), null);
  assert.equal(L.rollFactionOfGuild('Order:toString'), null);
  assert.deepEqual([NaN, Infinity, -Infinity].map((v) => L.rollRep(v)), [0, 0, 0]);
  assert.equal(L.rollSeedCapOf({ origin: '', createdAt: L.ROLL_EPOCH_S + DAY }), 100, 'an empty origin is born online');
});

test('AUDIT CHAP2 E3: the Roll takes a book DFU can hold - one temple and one order a book, two books at most (mutants: the count, the bound)', () => {
  assert.equal(L.ROLL_BOOKS, 2);
  const temples = [21, 22, 24], orders = [368, 408, 409];
  assert.equal(L.rollMembersOk([{ f: 21, rank: 0 }, { f: 22, rank: 0 }, { f: 368, rank: 0 }, { f: 408, rank: 0 }, { f: 40, rank: 0 }, { f: 42, rank: 0 }]), true, 'the mortal\'s and the vampire\'s');
  assert.equal(L.rollMembersOk(temples.map((f) => ({ f, rank: 0 }))), false, 'three temples');
  assert.equal(L.rollMembersOk(orders.map((f) => ({ f, rank: 0 }))), false, 'three orders');
  assert.equal(L.rollMembersOk(L.ROLL_FACTIONS.map((f) => ({ f, rank: 0 }))), false, 'all twenty-two at once');
});

test('AUDIT CHAP2 D3/E6: a crossing member keeps its rank\'s band, never the seat\'s line - a rank 8 or 9 crossing keeps 79 (Mac: "You can decide whatever is best") (mutants: the band\'s top, the seat\'s line)', () => {
  assert.equal(L.ROLL_SEAT_LINE, 80);
  assert.deepEqual([0, 1, 4, 6, 7, 8, 9].map(L.rollRankKeepOf), [9, 19, 49, 69, 79, 79, 79]);
  assert.equal(L.rollRankCapOf(L.rollRankKeepOf(9)), 7, 'reviewed to rank 7, as 3.5 holds everyone at CHAP4');
  const seed = L.rollSeedOf({ 40: 100, 41: 100, 42: 100 }, 40, new Map([[40, 4], [41, 7]]));
  assert.deepEqual([seed[40], seed[41], seed[42]], [49, 79, 40]);
  assert.equal(L.rollSeedOf({ 40: 45 }, 40, new Map([[40, 4]]))[40], 45, 'never above what the save held');
});

test('AUDIT CHAP2 D2/S7: the join - the underworld two at any standing (their initiation quests), every other guild at 0, what the Roll owes counted (mutants: the hidden two, the floor)', () => {
  assert.deepEqual([[-95, 108], [-50, 42], [-1, 40], [0, 40], [-1, 368], [5, 21]].map(([r, f]) => L.joinRecordable(r, f)), [true, true, false, true, false, true]);
  assert.equal(L.joinRecordable(-1), false, 'no faction named: the floor');
});

test('AUDIT CHAP2 T5/T20: the hidden two are the Thieves Guild and the Brotherhood; every order by DFU\'s caption (mutants: the Thieves\' half, an order renamed)', () => {
  assert.deepEqual([42, 108, 41, 40, 21, 368].map(L.hallHidden), [true, true, false, false, false, false]);
  assert.deepEqual([408, 409, 410, 411, 413, 414, 415, 416, 417, 368].map(L.hallPosterName), [
    'Order of the Candle', 'Knights of the Rose', 'Knights of the Flame', 'Host of the Horn', 'Knights of the Owl', 'Order of the Raven',
    'Knights of the Wheel', 'Order of the Scarab', 'Knights of the Hawk', 'Knights of the Dragon']);
});

test('AUDIT CHAP2 T19/E7: a hall report\'s edges - map ids 0 and 0xffffffff, one foreign faction refusing it; the witness key carries the law\'s version (mutants: the bounds, every/some, the version)', () => {
  assert.notEqual(L.hallReportOf({ key: 0, region: ANTICLERE, factions: [40] }), null);
  assert.notEqual(L.hallReportOf({ key: 0xffffffff, region: ANTICLERE, factions: [40] }), null);
  assert.equal(L.hallReportOf({ key: 1, region: ANTICLERE, factions: [40, 510] }), null);
  assert.notEqual(L.hallReportOf({ key: 1, region: ANTICLERE, factions: L.ROLL_FACTIONS.slice() }), null, 'all twenty-two');
  assert.equal(L.HALL_REPORT_V, 1);
  assert.equal(L.hallWitnessKey(1234), '1:1234');
});

test('AUDIT CHAP2 E5/T15/T21: a chapter\'s writs are the Court\'s law\'s slots AFTER its top one, under the chapter\'s own dice - a golden draw, the region in the dice, two writs where the guild\'s kinds are absent (mutants: the top slot taken, the salt, the region, the fallback)', () => {
  assert.deepEqual(L.hallWrits(20000, ANTICLERE, 41, 2, table).map((w) => [w.slot, w.material, w.tier, w.units]), [[0, 'metal:copper', 1, 50], [1, 'metal:lodestone', 2, 20]]);
  assert.notDeepEqual(L.hallWrits(20000, ANTICLERE, 41, 4, table), L.hallWrits(20000, 22, 41, 4, table));
  // the Court's slot 0 is the table's top tier every day; a chapter's first writ is not
  const top = Math.max(...table.map((m) => m.tier));
  let below = 0;
  for (let d = 20000; d < 20030; d++) {
    assert.equal(courtWrits(d, ANTICLERE, 1, table)[0].tier, top);
    if (L.hallWrits(d, ANTICLERE, 42, 1, table)[0].tier < top) below++;
  }
  assert.ok(below > 0, 'the day\'s top writ stays the Court\'s');
  const stoneOnly = table.filter((m) => material(m.material).family === 'stone');
  const w = L.hallWrits(20000, ANTICLERE, 108, 2, stoneOnly);
  assert.equal(w.length, 2);
  assert.ok(w.every((x) => material(x.material).family === 'stone'));
});

// ── THE TAB ─────────────────────────────────────────────────────────

/** A door shaped as the service answers: `seq` the claim sequence, `from` and `seeded` on a read, a claim's credited. */
function door({ roll = null, record = (m) => m } = {}) {
  const calls = [];
  let state = roll;
  const d = {
    calls, refuse: null, hold: null,
    async read(character, lease, seed) {
      calls.push({ kind: 'read', seed });
      if (d.refuse) return { ok: false, error: d.refuse };
      if (!state) {
        state = { seq: 0, factions: L.rollSeedOf(seed.factions), members: record(seed.members ?? []) };
        return { ok: true, data: { roll: { ...state, factions: { ...state.factions } }, from: 0, seeded: true } };
      }
      return { ok: true, data: { roll: { ...state, factions: { ...state.factions } }, from: state.seq } };
    },
    async claim(character, lease, rid, deltas, members) {
      calls.push({ kind: 'claim', rid, deltas, members, lease });
      if (d.hold) await d.hold;
      if (d.refuse) return { ok: false, error: d.refuse };
      for (const [f, x] of Object.entries(deltas)) state.factions[f] += x;
      if (Object.keys(deltas).length) state.seq += 1;
      if (members) state.members = record(members);
      return { ok: true, data: { roll: { ...state, factions: { ...state.factions } }, credited: deltas } };
    },
    credit: (f, n) => { state.factions[f] += n; },
  };
  return d;
}
function tab(io, { held = { 40: 10 }, members = () => [], lease = () => 'a'.repeat(32) } = {}) {
  let t = 1_000_000;
  const h = { ...held };
  const stops = [];
  const tracker = createRollTracker({ io, character: () => 'r0123456789abcdef0123', lease, read: () => ({ ...h }),
    write: (v) => Object.assign(h, v), members, now: () => t, onStop: (e) => stops.push(e) });
  return { tracker, h, stops, at: (ms) => { t += ms; } };
}

test('AUDIT CHAP2 T4: a seed that landed after a failed first read is the standing - nothing counted twice (mutants: the seeded base)', async () => {
  const io = door();
  const p = tab(io);
  io.refuse = 'offline';
  p.tracker.tick(); await settle();
  p.h[40] = 25;
  io.refuse = null;
  p.at(30_000); p.tracker.tick(); await settle();
  assert.equal(p.h[40], 25);
  p.at(120_000); p.tracker.tick(); await settle();
  assert.equal(io.calls.filter((c) => c.kind === 'claim').length, 0, 'the seed carried it');
});

test('AUDIT CHAP2 T25: the host\'s doors with no entity - nothing read, nothing written, nothing thrown (mutants: the store guard)', () => {
  const doors = rollEntityDoors(() => null);
  assert.equal(doors.read(), null);
  assert.doesNotThrow(() => doors.write({ 40: 5 }));
  assert.equal(doors.members(), null);
});

test('AUDIT CHAP2 T12/T24: the stop list, literal, each entry a stop; a refresh before the first read asks nothing after it (mutants: an entry dropped, the base guard)', async () => {
  assert.deepEqual([...ROLL_STOPS], ['chapters-closed', 'lease', 'no-realm-character', 'no-data', 'dead', 'auth', 'no-session', 'body', 'roll-seed', 'roll-claim']);
  for (const e of ROLL_STOPS) {
    const io = door({ roll: { seq: 0, factions: { 40: 10 }, members: [] } });
    const p = tab(io);
    p.tracker.tick(); await settle();
    io.refuse = e; p.h[40] = 11;
    p.at(60_000); p.tracker.tick(); await settle();
    assert.deepEqual([p.stops, p.tracker.stopped], [[e], e], e);
  }
  const io = door();
  const p = tab(io);
  p.tracker.refresh();
  p.tracker.tick(); await settle();
  p.at(1000); p.tracker.tick(); await settle();
  assert.deepEqual(io.calls.map((c) => c.kind), ['read']);
});

test('AUDIT CHAP2 C2 (= D1): a book the Roll records by its own law (a rank past its reputation between DFU\'s reviews) is claimed once, not every minute (mutants: the sent key)', async () => {
  const io = door({ roll: { seq: 0, factions: { 40: 45 }, members: [{ f: 40, rank: 4 }] }, record: (m) => m.map((x) => ({ ...x, rank: Math.min(x.rank, 4) })) });
  const p = tab(io, { held: { 40: 45 }, members: () => [{ f: 40, rank: 5 }] });
  p.tracker.tick(); await settle();
  for (let i = 0; i < 10; i++) { p.at(60_000); p.tracker.tick(); await settle(); }
  assert.equal(io.calls.filter((c) => c.kind === 'claim').length, 1, 'once, then the book as sent stands');
});

test('AUDIT CHAP2 C3: a claim answered after a refresh leaves the refresh asked - the hall writ\'s +2 is still fetched (mutants: the generation)', async () => {
  const io = door({ roll: { seq: 0, factions: { 41: 10 }, members: [] } });
  const p = tab(io, { held: { 41: 10 } });
  p.tracker.tick(); await settle();
  let release;
  io.hold = new Promise((r) => { release = r; });
  p.h[41] = 11;
  p.at(60_000); p.tracker.tick(); await settle();   // the claim is out
  io.credit(41, 2);                                 // a hall writ lands on the service
  p.tracker.refresh();                              // and its answer asks for the Roll's word
  io.hold = null; release(); await settle(); await settle();
  p.at(1000); p.tracker.tick(); await settle();
  assert.deepEqual(io.calls.filter((c) => c.kind === 'claim').map((c) => c.deltas), [{ 41: 1 }, {}], 'the refresh still asked');
  assert.equal(p.h[41], 13);
});

test('AUDIT CHAP2 C4: a lease refusal ends the asking for that lease alone - a new lease (the page shown again) resumes it (mutants: the lease stop for ever)', async () => {
  let ls = 'a'.repeat(32);
  const io = door({ roll: { seq: 0, factions: { 40: 10 }, members: [] } });
  const p = tab(io, { lease: () => ls });
  p.tracker.tick(); await settle();
  io.refuse = 'lease'; p.h[40] = 12;
  p.at(60_000); p.tracker.tick(); await settle();
  assert.equal(p.tracker.stopped, 'lease');
  p.at(60_000); p.tracker.tick(); await settle();
  assert.equal(io.calls.length, 2, 'stopped under the same lease');
  io.refuse = null; ls = 'b'.repeat(32);
  p.at(60_000); p.tracker.tick(); await settle();
  assert.equal(p.tracker.stopped, null);
  assert.deepEqual(io.calls.at(-1).deltas, { 40: 2 }, 'the same claim, under the new lease');
  assert.equal(io.calls.at(-1).lease, ls);
});

// ── THE HALL BOOK ───────────────────────────────────────────────────

function mem() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }

test('AUDIT CHAP2 T22: the hall book\'s key, its two hundred newest, a stored key of the wrong shape, a door that throws (mutants: the key, the bound, the order, the shape)', async () => {
  assert.equal(HALL_REPORTED_KEY, 'chap2.halls');
  assert.equal(HALL_DONE, 1_000_000);
  const storage = mem();
  let ms = 20000 * 86_400_000;
  const book = createHallBook({ door: { witness: async () => ({ ok: true, data: { counted: false } }) }, storage, nowMs: () => ms });
  for (let i = 0; i < 201; i++) { ms += 86_400_000; await book.witness({ key: i, region: ANTICLERE, factions: [40] }); }
  const kept = JSON.parse(storage.getItem('chap2.halls'));
  assert.equal(Object.keys(kept).length, 200);
  assert.equal(Object.hasOwn(kept, '0'), false, 'the oldest dropped');
  assert.equal(Object.hasOwn(kept, '200'), true);
  for (const bad of ['5', '[1]', '"x"']) {
    const s = mem(); s.setItem('chap2.halls', bad);
    const b = createHallBook({ door: { witness: async () => ({ ok: true }) }, storage: s, nowMs: () => 0 });
    assert.equal(await b.witness({ key: 1, region: ANTICLERE, factions: [40] }), true, bad);
  }
  const thrown = createHallBook({ door: { witness: async () => { throw new Error('net'); } }, storage: mem(), nowMs: () => 0 });
  assert.equal(await thrown.witness({ key: 1, region: ANTICLERE, factions: [40] }), true);
  assert.equal(thrown.stopped, false);
});

test('AUDIT CHAP2 E1: a developer\'s /hall word - the audit, a strike by map id, anything else its usage; the audit list in words (mutants: the parse)', () => {
  assert.deepEqual(parseHallCommand('/hall audit'), { op: 'audit' });
  assert.deepEqual(parseHallCommand('/HALL strike 4294967295'), { op: 'strike', key: 4294967295 });
  for (const bad of ['/hall', '/hall strike', '/hall strike x', '/hall strike 4294967296', '/hall strike 1 2', '/hall audit 5', '/hall burn 1']) assert.deepEqual(parseHallCommand(bad), { error: HALL_USAGE }, bad);
  assert.equal(parseHallCommand('/halls audit'), null);
  assert.equal(parseHallCommand('hello'), null);
  assert.deepEqual(hallAuditLines({ towns: [{ key: 9, state: 'confirmed', witnesses: 3, factions: [40, 108], audit: true }, { key: 8, audit: false }], ignored: 1 }, L.hallPosterName),
    ['Town 9: confirmed, 3 witnesses - Mages Guild, Dark Brotherhood']);
  assert.deepEqual(hallAuditLines({ towns: [], ignored: 2 }, L.hallPosterName), ['No town of this region is on the halls\' audit list (2 accounts ignored).']);
});

test('AUDIT CHAP2 D4: the hidden guilds\' halls are revealed for a membership in either book - DFU registers both on a load (mutants: the active book alone)', () => {
  const entity = { guildMemberships: { mortal: { 4: { guild: 'ThievesGuild', rank: 2 } }, vampire: {} }, racialOverride: { racial: 'vampirism', ended: false } };
  const m = revealingMemberships(entity);
  assert.equal(m[4]?.guild, 'ThievesGuild', 'the mortal book\'s Thieves Guild, while a vampire');
  const none = revealingMemberships({ guildMemberships: { mortal: { 11: { guild: 'FightersGuild', rank: 2 } }, vampire: {} }, racialOverride: { racial: 'vampirism', ended: false } });
  assert.equal(Object.hasOwn(none, 11), false, 'only the two that reveal');
});

// ── THE SERVICE: THE ROLL ───────────────────────────────────────────

async function roll({ origin = null } = {}) {
  const svc = await standService({ CHAPTERS_OPEN: 'on' });
  const who = await svc.registered('Probe');
  const R = await seatRealm(svc.env, who.secret, 'Probe');
  const raw = svc.env.DB._raw;
  raw.prepare('UPDATE realm_characters SET created_at = ?, origin_id = ? WHERE id = ?').run(L.ROLL_EPOCH_S + DAY, origin, R.id);
  const ctx = (nowS, db = svc.env.DB) => ({ db, nowS });
  const body = (extra = {}) => ({ character: R.id, lease: R.lease, ...extra });
  const head = () => raw.prepare('SELECT seq, kseq FROM npc_roll_heads WHERE char_id = ?').get(R.id);
  const row = (f) => ({ ...raw.prepare('SELECT rep, owed, member, rank FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(R.id, f) });
  return { ...svc, who, R, raw, ctx, body, head, row, player: { id: who.id } };
}

test('AUDIT CHAP2 T3/T6/T11/T14: the read and the claim at their edges - a claim answers the claim sequence it moved; a seed with no book is a seed; a read with nothing owed writes nothing; a read\'s lost race, a seed\'s lost lease and a character out of shape are refused; owed over 100 cleared; two seeds make one head (mutants: the answer\'s seq, the null book, the no-pay read, the races, the owed\'s change, the realm id, the heads\' key)', async () => {
  const s = await roll();
  assert.deepEqual(await readRoll(s.ctx(T0), s.player, { character: 'x', lease: s.R.lease }), { error: 'body' });
  const late = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (list) => { s.raw.prepare('UPDATE realm_characters SET lease = ? WHERE id = ?').run('e'.repeat(32), s.R.id); return s.env.DB.batch(list); } };
  assert.deepEqual(await readRoll(s.ctx(T0, late), s.player, s.body({ seed: { factions: { 40: 10 }, members: [] } })), { error: 'lease' });
  s.raw.prepare('UPDATE realm_characters SET lease = ? WHERE id = ?').run(s.R.lease, s.R.id);
  const seed = { factions: { 40: 10, 21: 0 }, members: null };
  const [a, b] = await Promise.all([readRoll(s.ctx(T0), s.player, s.body({ seed })), readRoll(s.ctx(T0), s.player, s.body({ seed }))]);
  assert.ok(a.seeded || b.seeded, 'a seed with no book is a seed');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM npc_roll_heads').get().n, 1, 'one head');
  const r = await readRoll(s.ctx(T0 + 60), s.player, s.body());
  assert.deepEqual([r.from, r.roll.seq, s.head().seq], [0, 0, 0], 'nothing owed: nothing written');
  assert.deepEqual(r.roll.owed, {}, 'the owed alone');
  const c = await claimRoll(s.ctx(T0 + 60), s.player, s.body({ rid: 'seq-0000001', deltas: { 40: 1 }, members: null }));
  assert.equal(c.roll.seq, s.head().kseq);
  assert.equal(c.roll.seq, 1);
  // owed over 100 cleared by the next read
  s.raw.prepare('UPDATE npc_roll SET rep = 100, owed = 5 WHERE char_id = ? AND faction_id = 40').run(s.R.id);
  await readRoll(s.ctx(T0 + 120), s.player, s.body());
  assert.equal(s.row(40).owed, 0);
  // a read that pays and loses its race says roll-busy and pays nothing
  await claimRoll(s.ctx(T0 + 180), s.player, s.body({ rid: 'race-000001', deltas: { 21: 100 }, members: null }));
  const racing = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (list) => { s.raw.prepare('UPDATE npc_roll_heads SET seq = seq + 1 WHERE char_id = ?').run(s.R.id); return s.env.DB.batch(list); } };
  const owedBefore = s.row(21).owed;
  assert.deepEqual(await readRoll(s.ctx(T0 + DAY, racing), s.player, s.body()), { error: 'roll-busy' });
  assert.equal(s.row(21).owed, owedBefore);
});

test('AUDIT CHAP2 C1: the claim sequence - owed paid and a claim with no line leave it where it stood; only a claim that credits a line moves it (mutants: kseq moved by the read, by every claim)', async () => {
  const s = await roll();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 21: 0 }, members: [] } }));
  const c = await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'worms-00001', deltas: { 21: 100 }, members: [] }));
  assert.deepEqual([c.roll.seq, s.head().kseq, s.head().seq], [1, 1, 1]);
  const next = await readRoll(s.ctx(T0 + DAY), s.player, s.body());
  assert.deepEqual([next.from, next.roll.seq, next.roll.factions[21], s.head().seq], [1, 1, 30, 2], 'owed paid: the guard moved, the claim sequence did not');
  assert.equal((await rollViewOf(s.env.DB, s.R.id)).seq, 1, 'the Roll as read names the claim sequence too (a twin\'s answer, a lost seed race)');
  const m = await claimRoll(s.ctx(T0 + DAY + 60), s.player, s.body({ rid: 'member-0001', deltas: {}, members: [{ f: 21, rank: 0 }] }));
  assert.deepEqual([m.roll.seq, s.head().kseq], [1, 1], 'a membership alone');
});

test('AUDIT CHAP2 S6: every claim that writes leaves its id - a membership-only claim replayed after a newer one is a repeat (mutants: the record\'s marker)', async () => {
  const s = await roll();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 30, 41: 10 }, members: [] } }));
  const x = s.body({ rid: 'memb-x00001', deltas: {}, members: [{ f: 40, rank: 2 }, { f: 41, rank: 0 }] });
  await claimRoll(s.ctx(T0 + 10), s.player, x);
  await claimRoll(s.ctx(T0 + 20), s.player, s.body({ rid: 'memb-y00001', deltas: {}, members: [{ f: 40, rank: 3 }] }));
  const replay = await claimRoll(s.ctx(T0 + 30), s.player, x);
  assert.equal(replay.repeat, true);
  assert.deepEqual([s.row(40).rank, s.row(41).member], [3, 0], 'the newer claim stands');
});

test('AUDIT CHAP2 S7/D2: the join recorded - a Brotherhood initiation from -95, a Mages Guild join whose reward the day\'s pace owes; a Mages Guild join below the floor not (mutants: the owed uncounted, the hidden two refused)', async () => {
  const s = await roll();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 108: -100, 40: -30, 41: -5 }, members: [] } }));
  const r = await claimRoll(s.ctx(T0 + 10), s.player, s.body({ rid: 'join-000001', deltas: { 108: 5, 40: 32 }, members: [{ f: 108, rank: 0 }, { f: 40, rank: 0 }, { f: 41, rank: 0 }] }));
  assert.deepEqual(r.roll.members.map((m) => m.f), [40, 108]);
  assert.deepEqual({ ...s.row(40), member: 1 }, { rep: -15, owed: 17, member: 1, rank: 0 }, 'owed 17: the standing the Roll has granted');
  assert.equal(s.row(41).member, 0, 'the Fighters Guild at -5: below DFU\'s join');
});

test('AUDIT CHAP2 E8: a claim with no book never leaves a recorded rank past what the Roll\'s reputation allows (mutants: the null branch)', async () => {
  const s = await roll();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 95 }, members: [{ f: 40, rank: 9 }] } }));
  await claimRoll(s.ctx(T0 + 10), s.player, s.body({ rid: 'loss-000001', deltas: { 40: -60 }, members: null }));
  assert.deepEqual([s.row(40).rep, s.row(40).rank], [35, 3]);
});

test('AUDIT CHAP2 E2: the claims\' hour is the service\'s - past 120 a character\'s claim is roll-rate, 429 at the route (mutants: the bound, the window)', async () => {
  assert.equal(L.ROLL_CLAIMS_HOUR, 120);
  const s = await roll();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 0 }, members: [] } }));
  for (let i = 0; i < 120; i++) {
    const r = await claimRoll(s.ctx(T0 + 1), s.player, s.body({ rid: `rate-${String(i).padStart(7, '0')}`, deltas: { 40: i % 2 ? -1 : 1 }, members: [] }));
    assert.ok(!r.error, JSON.stringify(r));
  }
  assert.deepEqual(await claimRoll(s.ctx(T0 + 2), s.player, s.body({ rid: 'rate-over001', deltas: { 40: 1 }, members: [] })), { error: 'roll-rate' });
  assert.match(src('server-account/src/index.js'), /'roll-rate': 429/);
});

// ── THE SERVICE: THE HALLS AND THEIR WRITS ──────────────────────────

const hourAt = (sec) => Math.floor((((Math.floor(sharedClassicMinutes(sec * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) { for (let x = from; x < from + 2 * 7200; x += 30) if (hourAt(x) === want && hourAt(x - 60) === want && hourAt(x + 60) === want) return x; throw new Error('no hour'); }
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (x) => { _now = x; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `audit2-${String(++_rid).padStart(6, '0')}`;
const WITNESS = '/v1/chapters/witness';

async function stand(open = 'on') {
  clock(NOON);
  forgetChapters();
  const devs = ['Devra', ...Array.from({ length: 60 }, (_, i) => `Wit${i}`)].join(',');
  const s = await standService({ CHAPTERS_OPEN: open, PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: devs });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const give = (who, character, m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, character, m, qty);
  let wits = 0;
  const witness = async (hall) => {
    const w = await s.registered(`Wit${wits++}`);
    age(w, 8);
    clock(_now + 1);
    return { w, r: await s.call(WITNESS, { hall }, w.secret) };
  };
  const witnessTown = async (hall, n = 3) => {
    for (let i = 0; i < n; i++) { const { r } = await witness(hall); assert.equal(r.status, 200, JSON.stringify(r.body)); }
  };
  const ground = async () => {
    const w = await s.registered('Ground');
    age(w, 8);
    const p = herbPatches({ x: 300, y: 200, day: utcDay(_now), climate: WOODS, confirmed: false })[0];
    const r = await s.call('/v1/prof/harvest', { character: w.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
      climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid() }, w.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  };
  return { ...s, raw, age, give, witness, witnessTown, ground };
}

test('AUDIT CHAP2 T16/T9/T17: the halls\' hour is an hour and an account\'s own; a town confirmed for one region and then reported for another counts only where it was confirmed; chapters ascending (mutants: the rate\'s key and window, the subquery, the sort)', async () => {
  const s = await stand();
  const a = await s.registered('Walker'); s.age(a, 8);
  const b = await s.registered('Strider'); s.age(b, 8);
  for (let i = 0; i < 24; i++) assert.equal((await s.call(WITNESS, { hall: { key: 5000 + i, region: ANTICLERE, factions: [40] } }, a.secret)).status, 200);
  assert.equal((await s.call(WITNESS, { hall: { key: 7000, region: ANTICLERE, factions: [40] } }, b.secret)).status, 200, 'another account\'s first');
  clock(_now + 61);
  assert.equal((await s.call(WITNESS, { hall: { key: 6000, region: ANTICLERE, factions: [40] } }, a.secret)).status, 429, 'still the hour');
  await s.witnessTown({ key: 9, region: 18, factions: [40] });
  await s.witnessTown({ key: 9, region: 19, factions: [40] });
  await s.witnessTown({ key: 1, region: 18, factions: [108] });
  forgetChapters();
  assert.deepEqual(await regionChapters(s.env.DB, 18, _now * 1000), [40, 108], 'ascending, whatever the towns\' order');
  assert.deepEqual(await regionChapters(s.env.DB, 19, _now * 1000), [], 'the town is region 18\'s');
});

test('AUDIT CHAP2 E1/S4: the halls\' moderation - a developer reads a region\'s audit list and strikes a false town: its reports go, its chapters with them, and it is never witnessed again; a player may do neither (mutants: the strike\'s delete, its record, the refusal, the developer\'s door)', async () => {
  const s = await stand();
  await s.witnessTown({ key: 4242, region: ANTICLERE, factions: L.ROLL_FACTIONS.slice() });   // a fabricated town naming all twenty-two
  assert.equal((await regionChapters(s.env.DB, ANTICLERE, _now * 1000)).length, 22);
  const dev = await s.registered('Devra');
  const mac = await s.registered('Mac');
  const list = await s.call('/v1/chapters/halls', { region: ANTICLERE }, dev.secret);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.deepEqual(list.body.towns.map((t) => [t.key, t.state, t.witnesses, t.audit]), [[4242, 'confirmed', 3, true]], 'confirmed by exactly three: on the audit list');
  assert.deepEqual([(await s.call('/v1/chapters/halls', { region: ANTICLERE }, mac.secret)).status, (await s.call('/v1/chapters/strike', { key: 4242 }, mac.secret)).status], [403, 403]);
  const struck = await s.call('/v1/chapters/strike', { key: 4242 }, dev.secret);
  assert.deepEqual(struck.body, { ok: true, key: 4242, reports: 3 });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'npchall'").get().n, 0);
  assert.deepEqual({ ...s.raw.prepare('SELECT map_id, by FROM npc_hall_strikes').get() }, { map_id: 4242, by: 'Devra' });
  assert.deepEqual(await regionChapters(s.env.DB, ANTICLERE, _now * 1000), [], 'the chapters went with it');
  const again = await s.witness({ key: 4242, region: ANTICLERE, factions: [40] });
  assert.deepEqual([again.r.status, again.r.body.error], [409, 'hall-struck']);
  assert.deepEqual(await strikeHall({ db: s.env.DB, nowS: _now }, { handle: 'Mac' }, { DEVELOPER_HANDLES: 'Devra' }, { key: 1 }), { error: 'not-developer' });
  assert.deepEqual(await listHalls({ db: s.env.DB, nowS: _now }, { handle: 'Devra' }, { DEVELOPER_HANDLES: 'Devra' }, { region: 62 }), { error: 'bad-region' });
});

test('AUDIT CHAP2 E1: an account whose answers three times in a week stand alone against confirmed towns is ignored - its reports count for nothing, and its own report is answered so (mutants: the ignored set unread)', async () => {
  const s = await stand();
  for (const key of [1, 2, 3]) await s.witnessTown({ key, region: ANTICLERE, factions: [40] });
  const liar = await s.registered('Liar');
  s.age(liar, 8);
  for (const key of [1, 2, 3]) { clock(_now + 1); assert.equal((await s.call(WITNESS, { hall: { key, region: ANTICLERE, factions: [42] } }, liar.secret)).status, 200); }
  const { ignored, towns } = hallFacts((await (async () => s.raw.prepare("SELECT key, account, report, at FROM world_witness WHERE kind = 'npchall'").all())()).map((r) => ({ ...r, key: String(r.key), at: Number(r.at) })), _now);
  assert.equal(ignored.has(liar.id), true);
  assert.ok(towns.every((t) => t.fact.state === 'confirmed'), 'its dissent dropped, no town disputed');
  assert.deepEqual(towns.map((t) => t.witnesses), [3, 3, 3], 'and it counts as no witness of any town');
  clock(_now + 1);
  assert.deepEqual((await s.call(WITNESS, { hall: { key: 4, region: ANTICLERE, factions: [42] } }, liar.secret)).body, { ok: true, counted: false, why: 'ignored' });
});

test('AUDIT CHAP2 E7/E9: a report of another version is read by nobody; a report that changed nothing keeps the region\'s chapters kept (mutants: the version unread, the cache dropped on every report)', async () => {
  const s = await stand();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [40] });
  const acc = s.raw.prepare("SELECT account FROM world_witness WHERE kind = 'npchall' LIMIT 1").get().account;
  for (const a of s.raw.prepare("SELECT DISTINCT account FROM world_witness WHERE kind = 'npchall'").all()) {
    s.raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('npchall', '0:2', ?, '[2,21,[108]]', 21, ?)").run(a.account, _now);
  }
  forgetChapters();
  assert.deepEqual(await regionChapters(s.env.DB, ANTICLERE, _now * 1000), [40], 'an old version\'s town is no chapter');
  // a counted account's report again changes nothing - and throws nothing kept away
  s.raw.prepare("DELETE FROM world_witness WHERE kind = 'npchall' AND key = '1:1' AND account != ?").run(acc);
  const player = { ...s.raw.prepare('SELECT * FROM players WHERE id = ?').get(acc) };
  assert.deepEqual(await witnessHall({ db: s.env.DB, nowS: _now }, player, { CHAPTERS_OPEN: 'on' }, { hall: { key: 1, region: ANTICLERE, factions: [40] } }), { ok: true, counted: true });
  assert.deepEqual(await regionChapters(s.env.DB, ANTICLERE, _now * 1000 + 1000), [40], 'still the kept answer');
});

test('AUDIT CHAP2 T10/T5/T18: the board\'s hall writs are the law\'s draw; a Thieves Guild member sees its chapter\'s, and a writ one filled stays one\'s own after leaving; six a chapter at 201 active (mutants: tier and qty swapped, the count, the Thieves\' half, the filled arm)', async () => {
  const s = await stand();
  await s.ground();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [41, 42] });
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 42: 10 }, members: [{ f: 42, rank: 0 }] } });
  const list = async () => (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, who.secret)).body.writs.filter((w) => w.kind === 'hall');
  const day = utcDay(_now);
  const t = regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: false }], daySeason(day));
  const law = [41, 42].flatMap((f) => L.hallWrits(day, ANTICLERE, f, 2, t).map((w) => [f, w.material, w.tier, w.units, w.pay, w.renown]));
  const mine = await list();
  assert.deepEqual(mine.map((w) => [w.faction, w.material, w.tier, w.qty, w.pay, w.renown]), law);
  const t0 = mine.find((w) => w.faction === 42);
  s.give(who, R.id, t0.material, t0.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: t0.id, rid: rid() }, who.secret)).status, 200);
  s.raw.prepare('UPDATE npc_roll SET member = 0 WHERE char_id = ? AND faction_id = 42').run(R.id);
  assert.deepEqual((await list()).filter((w) => w.faction === 42).map((w) => [w.id, w.state]), [[t0.id, 'mine']]);
  // the next day, at 201 active
  const one = s.raw.prepare('SELECT * FROM players WHERE handle IS NOT NULL LIMIT 1').get();
  const cols = Object.keys(one);
  const ins = s.raw.prepare(`INSERT INTO players (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
  for (let i = 0; i < 201; i++) ins.run(...cols.map((c) => (c === 'id' ? `act-${i}-${one.id}` : c === 'handle' ? `Act${i}` : c === 'handle_lc' ? `act${i}` : typeof one[c] === 'string' && /secret|hash|token|email/.test(c) ? `${one[c]}-${i}` : one[c])));
  clock(_now + DAY);
  s.raw.prepare('UPDATE players SET played_at = ? WHERE handle IS NOT NULL').run(utcDay(_now) * DAY - 3600);
  forgetChapters();
  const next = (await s.call('/v1/writs/list', { character: who.character, region: ANTICLERE }, who.secret)).body.writs;
  assert.equal(next.filter((w) => w.kind === 'hall' && w.faction === 41).length, 6);
});

test('AUDIT CHAP2 T13/S5: a hall writ\'s credit never touches another account\'s character, a refused delivery or a dead one - the writ is paid, the Roll unmoved (mutants: the head\'s player, its fill, the death)', async () => {
  const s = await stand();
  await s.ground();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [41] });
  const a = await s.registered('Rolla');
  const R = await seatRealm(s.env, a.secret, 'Rolla');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: a.id }, { character: R.id, lease: R.lease, seed: { factions: { 41: 10 }, members: [] } });
  const roll41 = () => [s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(R.id).rep, s.raw.prepare('SELECT seq FROM npc_roll_heads WHERE char_id = ?').get(R.id).seq];
  const [h1, h2] = (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, a.secret)).body.writs.filter((w) => w.kind === 'hall');
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: h1.id, rid: rid() }, a.secret)).body.error, 'stores-short');
  assert.deepEqual(roll41(), [10, 0], 'refused: nothing');
  const b = await s.registered('Mallory');
  s.give(b, R.id, h1.material, h1.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: h1.id, rid: rid() }, b.secret)).status, 200);
  assert.deepEqual(roll41(), [10, 0], 'another account naming the character: paid, the Roll unmoved');
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(_now, R.id);
  s.give(a, R.id, h2.material, h2.qty);
  const r = await deliverWrit({ db: s.env.DB, nowS: _now, rand: (u) => u.fill(7) }, { ...s.raw.prepare('SELECT * FROM players WHERE id = ?').get(a.id) },
    { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', CHAPTERS_OPEN: 'on' }, { character: R.id, id: h2.id, rid: rid() });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(roll41(), [10, 0], 'dead: the Roll unmoved');
});

test('AUDIT CHAP2 S2/S3: a hidden guild\'s writ is no writ to a stranger whatever its day or fill; a hall writ refused for the switch is 403 (mutants: the order, the status)', async () => {
  const s = await stand('dev');
  await s.ground();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [108, 41] });
  const dev = await s.registered('Devra');
  const R = await seatRealm(s.env, dev.secret, 'Devra');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: dev.id }, { character: R.id, lease: R.lease, seed: { factions: { 108: 10 }, members: [{ f: 108, rank: 0 }] } });
  const halls = (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, dev.secret)).body.writs.filter((w) => w.kind === 'hall');
  const [d1, d2] = halls.filter((w) => w.faction === 108);
  s.give(dev, R.id, d1.material, d1.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: d1.id, rid: rid() }, dev.secret)).status, 200);
  const stranger = await s.registered('Wit59');
  for (const id of [d1.id, d2.id]) assert.deepEqual((await s.call('/v1/writs/deliver', { character: stranger.character, id, rid: rid() }, stranger.secret)).body, { error: 'no-writ' }, id);
  clock(_now + DAY);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: stranger.character, id: d2.id, rid: rid() }, stranger.secret)).body, { error: 'no-writ' }, 'yesterday\'s: still no writ');
  const mac = await s.registered('Mac');
  const fg = halls.find((w) => w.faction === 41);
  const r = await s.call('/v1/writs/deliver', { character: mac.character, id: fg.id, rid: rid() }, mac.secret);
  assert.deepEqual([r.status, r.body.error], [403, 'chapters-closed']);
});

test('AUDIT CHAP2 S1: a board read in a region with no chapter, once the Court\'s day is written, reads no ground (mutants: the chapters asked after the ground)', async () => {
  const s = await stand();
  await s.ground();
  const mac = await s.registered('Mac');
  let ground = 0;
  const real = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => { if (/kind = 'pixel'/.test(sql)) ground++; return real(sql); };
  await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret);
  assert.ok(ground >= 1, 'the spy sees a read of the ground when one comes');   // AUDIT CHAP3 T8: never a pass by a spy that sees nothing
  ground = 0;
  for (let i = 0; i < 3; i++) await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret);
  s.env.DB.prepare = real;
  assert.equal(ground, 0);
});

test('AUDIT CHAP2 C1: end to end - a hall writ\'s +2 between two pages never makes the second drop what the first page\'s save held unclaimed (mutants: the claim sequence)', async () => {
  const s = await stand();
  await s.ground();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [41] });
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  const io = accountRoll({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  let kept = null;
  const page = (held) => {
    let t = 1_000_000;
    const h = { ...held };
    const tracker = createRollTracker({ io, character: () => R.id, lease: () => R.lease, read: () => ({ ...h }), write: (v) => Object.assign(h, v),
      members: () => [], kept: () => kept, keep: (k) => { kept = k; }, now: () => t });
    return { tracker, h, at: (ms) => { t += ms; } };
  };
  const A = page({ ...ALL22, 41: 10 });
  A.tracker.tick();
  await until(() => kept?.seq === 0, 'page A\'s first read');
  A.h[41] = 15;
  A.at(60_000); A.tracker.tick();
  await until(() => kept?.seq === 1, 'page A\'s claim');
  assert.equal(kept?.factions?.[41], 15);
  // a hall writ delivered; its answer's refresh never ran (the board closed, the page went)
  const [h] = (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, who.secret)).body.writs.filter((w) => w.kind === 'hall');
  s.give(who, R.id, h.material, h.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: h.id, rid: rid() }, who.secret)).status, 200);
  A.h[41] = 18;   // +3 more on page A, saved, never claimed
  const B = page({ ...A.h });
  B.tracker.tick();
  await until(() => B.tracker.held, 'page B\'s first read');
  assert.equal(B.h[41], 20, 'the Roll\'s 17 and the save\'s unclaimed 3');
  B.at(60_000); B.tracker.tick();
  await until(() => kept?.seq === 2, 'page B\'s claim');
  assert.equal(s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(R.id).rep, 20);
});

test('AUDIT CHAP2 T8: the real hall book through the real door to the real service - the town witnessed under its version (mutants: the door\'s path and body)', async () => {
  const s = await stand();
  const who = await s.registered('Walker');
  s.age(who, 8);
  const book = createHallBook({ door: accountRoll({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), storage: null });
  assert.equal(await book.witness({ key: 77, region: ANTICLERE, factions: [41, 40] }), true);
  assert.equal(book.stopped, false);
  assert.deepEqual({ ...s.raw.prepare("SELECT key, report FROM world_witness WHERE kind = 'npchall'").get() }, { key: '1:77', report: '[77,21,[40,41]]' });
});

// ── THE BOARD AND THE WIRING ────────────────────────────────────────

test('AUDIT CHAP2 T23/C5: a hall writ\'s card under the guild\'s seal, named, its pay the guild\'s standing too; the day\'s count says Writs (mutants: the seal, the kind, the pay\'s standing, the label)', async () => {
  const tick = () => new Promise((r) => setImmediate(r));
  const writs = [{ id: 'h:1:21:40:0', kind: 'hall', faction: 40, material: 'p1:19', tier: 2, qty: 30, pay: 72, renown: 150, expiresAt: 2_000_000_000, state: 'open' }];
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 0,
    writs: async () => ({ data: { writs, today: { filled: 0, max: 3 } }, error: null, stale: false }), deliver: async () => ({ ok: true, data: {} }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book, region: 21, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n) } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  const [card] = byClass(host, 'notice-writ');
  assert.ok(card.className.includes('seal-guild') && !card.className.includes('seal-court'), card.className);
  assert.equal(byClass(card, 'writ-kind')[0].textContent, 'Hall writ');
  assert.equal(byClass(card, 'writ-need')[0].textContent, 'Wanted: 30 Red Roses, for the Mages Guild in Anticlere');
  assert.equal(byClass(card, 'writ-pay')[0].textContent, 'Pays 72 silver, 150 Renown and standing with the Mages Guild');
  assert.equal(byClass(host, 'notice-worktoday')[0].textContent, 'Writs today: 0 of 3');
});

test('AUDIT CHAP2 T7/C1/E1: the wiring - the kept adoption rides the save, the tracker plays the session\'s character through a signed-in door, the board hears a filled writ before it asks whether it still stands, /hall reaches the developer\'s doors (mutants: getSaveData, character, the door\'s storage, the onTaken order, the command)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /registerModSaveData\(ROLL_KEPT_VENDOR, \{\n\s+newSaveData: \(\) => null,\n\s+getSaveData: \(\) => rollKept,\n\s+restoreSaveData: \(rec\) => \{ rollKept = rollKeptOf\(rec\); \},/);
  assert.match(world, /createRollTracker\(\{\n\s+io: accountRoll\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\) \}\),\n\s+character: \(\) => realmSession\.id,/);
  assert.match(world, /const hallCmd = parseHallCommand\(text\);[\s\S]{0,700}hallDoor\.strike\(hallCmd\.key\)[\s\S]{0,700}hallDoor\.halls\(region\)/);
  const board = src('src/ui/noticeWindow.js');
  assert.match(board, /const said = r\?\.ok \? work\.onTaken\?\.\(r\) : null;\n\s+if \(!alive\) \{ if \(said\) work\.sayLate\?\.\(said\); return; \}/);   // PIN MOVED (AUDIT CHAP3 C5: and the line said in the chat)
  assert.match(src('server-account/src/index.js'), /path === '\/v1\/chapters\/strike' \? await strikeHall\(ctx, who\.player, env, body\)/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/chapters\/witness', '\/v1\/chapters\/halls', '\/v1\/chapters\/strike',/);
  assert.match(src('server-account/migrations/0099_npc_halls.sql'), /ALTER TABLE npc_roll_heads ADD COLUMN kseq INTEGER NOT NULL DEFAULT 0;/);
});
