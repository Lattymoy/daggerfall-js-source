// AUDIT CHAP (2026-10-07, Mac: "Lets do a deep audit on everything so far before we continue"): CHAP0's record and
// CHAP1's Roll read by five lenses - the service (S), the playing tab (C), Daggerfall's law (D), the record (R) and the
// pins (T) - at 1100fec1. bible/01-Overview/Audit-Chapters.md holds every finding; these pins hold every fix, each
// named by its finding's ID, and tools/mutants/audit_chap1.json is their mutants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ROLL_EPOCH_S, ROLL_EVENTS_KEEP_S, ROLL_RETRY_MS, ROLL_RETRY_MAX_MS, ROLL_CLAIM_MS, ROLL_KEPT_VENDOR,
  rollCredit, rollDrain, rollSeedOf, rollSeedOk, rollRankCapOf, rollDeltasOf, rollAdopt, rollKeptOf, rollMembersKey, rollCeilingLine, rollFactionName,
} from '../src/net/npcChapterLaw.js';
import { createRollTracker, rollEntityDoors, rollRid, ROLL_STOPS } from '../src/net/npcRollTracker.js';
import { createFactionRep } from '../src/systems/factionRep.js';
import { createRealmSession } from '../src/systems/realmSaves.js';
import { accountRoll, SESSION_KEY, accountRefusalText, REFUSALS } from '../src/net/accountClient.js';
import { readRoll, claimRoll } from '../server-account/src/npcRoll.js';
import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400;
const DAYN = Math.floor(T0 / DAY);

async function stand({ origin = null, createdAt = ROLL_EPOCH_S + DAY } = {}) {
  const svc = await standService({ CHAPTERS_OPEN: 'on' });
  const who = await svc.registered('Audra');
  const R = await seatRealm(svc.env, who.secret, 'Audra');
  const raw = svc.env.DB._raw;
  raw.prepare('UPDATE realm_characters SET created_at = ?, origin_id = ? WHERE id = ?').run(createdAt, origin, R.id);
  const ctx = (nowS, db = svc.env.DB) => ({ db, nowS });
  const body = (extra = {}) => ({ character: R.id, lease: R.lease, ...extra });
  const rep = (f) => raw.prepare('SELECT rep, owed FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(R.id, f);
  const events = () => raw.prepare('SELECT COUNT(*) AS n FROM npc_rep_events').get().n;
  const seq = () => raw.prepare('SELECT seq FROM npc_roll_heads WHERE char_id = ?').get(R.id)?.seq;
  return { ...svc, who, R, raw, ctx, body, rep, events, seq, player: { id: who.id } };
}

// ── S: THE SERVICE ──────────────────────────────────────────────────

test('AUDIT CHAP S1: a claim sent twice at once is credited once - the twin that loses writes nothing under the winner\'s tag and is answered as a repeat (mutants: the tag guard)', async () => {
  const s = await stand();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 10, 41: 0 }, members: [] } }));
  const claim = s.body({ rid: 'twin-000001', deltas: { 40: 5, 41: -20 }, members: [] });
  let twin = null;
  // the twin lands between this one's read and its write
  const racing = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (list) => { twin ??= await claimRoll(s.ctx(T0), s.player, claim); return s.env.DB.batch(list); } };
  const r = await claimRoll(s.ctx(T0, racing), s.player, claim);
  assert.equal(twin.credited[40], 5);
  assert.equal(r.repeat, true, 'the loser is the same claim, landed');
  assert.deepEqual([s.rep(40).rep, s.rep(41).rep], [15, -20], 'once, not twice');
  assert.equal(s.events(), 2, 'two lines recorded, not four');
});

test('AUDIT CHAP S4: a lease another tab took, or a death, between a claim\'s read and its write moves nothing and says why (mutants: the write\'s own lease check)', async () => {
  for (const [why, change] of [['lease', (s) => s.raw.prepare('UPDATE realm_characters SET lease = ? WHERE id = ?').run('e'.repeat(32), s.R.id)],
    ['dead', (s) => s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(T0, s.R.id)]]) {
    const s = await stand();
    await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 10 }, members: [] } }));
    const late = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (list) => { change(s); return s.env.DB.batch(list); } };
    const r = await claimRoll(s.ctx(T0, late), s.player, s.body({ rid: `late-${why}-01`, deltas: { 40: 10 }, members: [] }));
    assert.deepEqual(r, { error: why });
    assert.equal(s.rep(40).rep, 10, `${why}: nothing moved`);
  }
});

test('AUDIT CHAP S3: no Roll before the realm holds a save (no-data, 404); a customs undone takes its Roll (mutants: the landed-save check, the undo\'s delete)', async () => {
  const s = await stand();
  s.raw.prepare('UPDATE realm_characters SET bytes = 0 WHERE id = ?').run(s.R.id);
  const r = await s.call('/v1/chapters/roll', s.body({ seed: { factions: {}, members: [] } }), s.who.secret);
  assert.deepEqual([r.status, r.body.error], [404, 'no-data']);
  assert.match(src('server-account/src/realm.js'), /async function undoCustoms[\s\S]{0,900}DELETE FROM npc_roll WHERE player = \? AND char_id = \?[\s\S]{0,200}DELETE FROM npc_roll_heads[\s\S]{0,200}DELETE FROM npc_rep_events/);
});

test('AUDIT CHAP S5 + D1: a customs seed keeps a member\'s rank its reputation (the cap never under its rank\'s need), and the Roll never records a rank past what its own reputation allows (mutants: the member floor, the rank cap)', async () => {
  assert.deepEqual([rollRankCapOf(-5), rollRankCapOf(0), rollRankCapOf(39), rollRankCapOf(40), rollRankCapOf(95)], [0, 0, 3, 4, 9]);
  const s = await stand({ origin: 'off-audra' });
  const r = await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 95, 41: 95, 42: 0 }, members: [{ f: 40, rank: 9 }, { f: 42, rank: 9 }] } }));
  assert.equal(r.roll.factions[40], 79, 'a rank-9 member keeps 79 (PIN MOVED, AUDIT CHAP2 E6, Mac: "You can decide whatever is best": never a seat\'s 80 off an offline grind)');
  assert.equal(r.roll.factions[41], 40, 'no member: the customs cap');
  assert.deepEqual(r.roll.members.map((m) => [m.f, m.rank]), [[40, 7], [42, 0]], 'rank 9 claimed with 0 reputation is recorded at 0 - and at 79, rank 7 (PIN MOVED, E6)');
  const c = await claimRoll(s.ctx(T0 + 60), s.player, s.body({ rid: 'rank-000001', deltas: {}, members: [{ f: 40, rank: 9 }, { f: 42, rank: 7 }] }));
  assert.equal(c.roll.members.find((m) => m.f === 42).rank, 0);
});

test('AUDIT CHAP S6: an older claim replayed after a newer one is a repeat - the record holds its id (mutants: only the last id asked)', async () => {
  const s = await stand();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 40 }, members: [] } }));
  await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'old-0000001', deltas: { 40: -5 }, members: [] }));
  await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'new-0000002', deltas: { 40: -5 }, members: [] }));
  const again = await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'old-0000001', deltas: { 40: -5 }, members: [] }));
  assert.equal(again.repeat, true);
  assert.equal(s.rep(40).rep, 30);
});

test('AUDIT CHAP S7: a claim that changes nothing writes nothing; the record is pruned past 90 days by the character\'s own claims (mutants: the no-op written, the prune)', async () => {
  assert.equal(ROLL_EVENTS_KEEP_S, 90 * DAY);
  const s = await stand();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 40: 10 }, members: [{ f: 40, rank: 1 }] } }));
  const noop = await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'noop-000001', deltas: {}, members: [{ f: 40, rank: 1 }] }));
  assert.deepEqual([noop.roll.seq, s.seq()], [0, 0], 'the head never moved');
  await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'keep-000001', deltas: { 40: 1 }, members: null }));
  await claimRoll(s.ctx(T0 + ROLL_EVENTS_KEEP_S + 1), s.player, s.body({ rid: 'keep-000002', deltas: { 40: 1 }, members: null }));
  assert.deepEqual(s.raw.prepare('SELECT rid FROM npc_rep_events').all().map((e) => e.rid), ['keep-000002']);
});

test('AUDIT CHAP S8: a claim with no book (members null) leaves the memberships and their tenure; a seed that lost its race is not told it seeded (mutants: null read as none, seeded for the loser)', async () => {
  const s = await stand();
  const seed = { factions: { 41: 30 }, members: [{ f: 41, rank: 2 }] };
  const [a, b] = await Promise.all([readRoll(s.ctx(T0), s.player, s.body({ seed })), readRoll(s.ctx(T0), s.player, s.body({ seed }))]);
  assert.deepEqual([a.seeded, b.seeded].filter(Boolean), [true], 'one seed made the Roll');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM npc_roll').get().n, 22, 'one Roll of twenty-two');
  const r = await claimRoll(s.ctx(T0 + 60), s.player, s.body({ rid: 'nobook-0001', deltas: { 41: 1 }, members: null }));
  assert.deepEqual(r.roll.members, [{ f: 41, rank: 2, since: T0 }]);
});

test('AUDIT CHAP S8/T11: the shapes - a members list not a list, a missing id, no character, a bad seed membership - are refused whole and write nothing', async () => {
  const s = await stand();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: {}, members: [] } }));
  assert.deepEqual(await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'shape-00001', deltas: { 40: 1 }, members: 'all' })), { error: 'roll-claim' });
  assert.deepEqual(await claimRoll(s.ctx(T0), s.player, s.body({ deltas: { 40: 1 }, members: [] })), { error: 'roll-claim' });
  assert.deepEqual(await claimRoll(s.ctx(T0), s.player, { lease: s.R.lease, rid: 'shape-00002', deltas: { 40: 1 }, members: [] }), { error: 'body' });
  const t = await stand();
  assert.deepEqual(await readRoll(t.ctx(T0), t.player, t.body({ seed: { factions: {}, members: [{ f: 40, rank: 10 }] } })), { error: 'roll-seed' });
  assert.equal(s.seq(), 0);
});

test('AUDIT CHAP T13: the route - a GET is 405, a lost race is 409, a tombstone with the wrong lease is told it is dead (mutants: the method, the status, the order of the checks)', async () => {
  const s = await stand();
  const get = await s.fetch('https://accounts.invalid/v1/chapters/roll', { method: 'GET', headers: { authorization: `Bearer ${s.who.secret}` } });
  assert.equal(get.status, 405);
  await s.call('/v1/chapters/roll', s.body({ seed: { factions: {}, members: [] } }), s.who.secret);
  const real = s.env.DB.batch.bind(s.env.DB);
  s.env.DB.batch = async (list) => { s.env.DB.batch = real; s.raw.prepare('UPDATE npc_roll_heads SET seq = seq + 1 WHERE char_id = ?').run(s.R.id); return real(list); };
  const busy = await s.call('/v1/chapters/claim', s.body({ rid: 'route-00001', deltas: { 40: 1 }, members: [] }), s.who.secret);
  assert.deepEqual([busy.status, busy.body.error], [409, 'roll-busy']);
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(T0, s.R.id);
  const { error } = await claimRoll(s.ctx(T0), s.player, s.body({ lease: 'f'.repeat(32), rid: 'route-00002', deltas: { 40: 1 }, members: [] }));
  assert.equal(error, 'dead');
});

// ── D: DAGGERFALL'S LAW ─────────────────────────────────────────────

test('AUDIT CHAP D2/D3: a reward past the day\'s pace is owed, not lost - paid at 15 a day by the next read or claim, a loss taken from what is owed first, never owed past 100 (mutants: the owed dropped, the drain, the loss\'s order)', async () => {
  assert.deepEqual(rollDrain({ rep: 15, gainedDay: 1, gained: 15, owed: 85 }, 2), { rep: 30, gainedDay: 2, gained: 15, owed: 70, credited: 15 });
  assert.deepEqual(rollDrain({ rep: 15, gainedDay: 2, gained: 15, owed: 70 }, 2), { rep: 15, gainedDay: 2, gained: 15, owed: 70, credited: 0 });
  assert.deepEqual(rollCredit({ rep: 15, gainedDay: 2, gained: 15, owed: 70 }, -20, 2), { rep: 15, gainedDay: 2, gained: 15, owed: 50, credited: 0 }, 'a loss eats the owed first');
  assert.deepEqual(rollCredit({ rep: 15, gainedDay: 2, gained: 15, owed: 10 }, -20, 2), { rep: 5, gainedDay: 2, gained: 5, owed: 0, credited: -10 });
  assert.deepEqual(rollCredit({ rep: 80, gainedDay: 2, gained: 15, owed: 0 }, 60, 2).owed, 20, 'never owed past 100');
  const s = await stand();
  await readRoll(s.ctx(T0), s.player, s.body({ seed: { factions: { 21: 0 }, members: [] } }));
  const c = await claimRoll(s.ctx(T0), s.player, s.body({ rid: 'worms-00001', deltas: { 21: 100 }, members: [] }));   // S0000106's +100
  assert.deepEqual([c.credited[21], c.roll.factions[21], c.roll.owed[21]], [15, 15, 85]);
  const next = await readRoll(s.ctx(T0 + DAY), s.player, s.body());
  // PIN MOVED (AUDIT CHAP2 C1): the answer's sequence is the CLAIM sequence - owed paid is the service's own credit
  assert.deepEqual([next.from, next.roll.seq, next.roll.factions[21], next.roll.owed[21]], [1, 1, 30, 70], 'the next day\'s read pays 15');
  const later = await claimRoll(s.ctx(T0 + 2 * DAY), s.player, s.body({ rid: 'worms-00002', deltas: { 40: 1 }, members: [] }));
  assert.deepEqual([later.roll.factions[21], later.roll.owed[21]], [45, 55], 'and a claim on any line pays it too');
});

test('AUDIT CHAP D4: a loss gives its day\'s room back - a crime and its penance on one day (mutants: gross gains counted)', () => {
  const after15 = { rep: 15, gainedDay: DAYN, gained: 15, owed: 0 };
  const lost = rollCredit(after15, -5, DAYN);
  assert.deepEqual(rollCredit(lost, 5, DAYN), { rep: 15, gainedDay: DAYN, gained: 15, owed: 0, credited: 5 });
});

// ── C: THE PLAYING TAB ──────────────────────────────────────────────

function door({ roll, seeded = false, from = 0 } = {}) {
  const calls = [];
  let state = roll ?? null;
  const d = {
    calls, refuse: null, seeded, from, credit: (x) => x,
    async read(character, lease, seed) {
      calls.push({ kind: 'read', seed });
      if (d.refuse) return { ok: false, error: d.refuse };
      if (!state) { state = { seq: 0, factions: rollSeedOf(seed.factions), members: seed.members ?? [] }; return { ok: true, data: { roll: { ...state, factions: { ...state.factions } }, from: 0, seeded: true } }; }
      return { ok: true, data: { roll: { ...state, factions: { ...state.factions } }, from: d.from } };
    },
    async claim(character, lease, rid, deltas, members) {
      calls.push({ kind: 'claim', rid, deltas, members });
      if (d.refuse) return { ok: false, error: d.refuse };
      const credited = {};
      for (const [f, x] of Object.entries(deltas)) { credited[f] = d.credit(x); state.factions[f] += credited[f]; }
      if (members) state.members = members;
      state.seq += 1;
      return { ok: true, data: { roll: { ...state, factions: { ...state.factions } }, credited } };
    },
  };
  return d;
}
function tab(io, { held = { 40: 10, 41: 0 }, kept = null, members = [{ f: 40, rank: 1 }] } = {}) {
  let t = 1_000_000;
  const h = { ...held };
  const box = { kept, said: [], stops: [], members };
  const tracker = createRollTracker({
    io, character: () => 'r0123456789abcdef0123', lease: () => box.lease === undefined ? 'a'.repeat(32) : box.lease,
    read: () => (box.noStore ? null : { ...h }), write: (v) => Object.assign(h, v), members: () => box.members,
    kept: () => box.kept, keep: (k) => { box.kept = k; }, now: () => t,
    onCeiling: (f) => box.said.push(f), onStop: (e) => box.stops.push(e),
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { tracker, h, box, settle, at: (ms) => { t += ms; } };
}

test('AUDIT CHAP C1/C2/C4: every adoption is kept; the next page, finding the Roll at the kept sequence, claims what the save holds past it; a Roll that moved on keeps only this page\'s moves (mutants: the kept base unread, the sequence unchecked, values0)', async () => {
  // the last page adopted 10 at seq 4 and then earned 6 it never claimed; the Roll still stands at 4
  const io = door({ roll: { seq: 4, factions: { 40: 10, 41: 0 }, members: [] }, from: 4 });
  const p = tab(io, { held: { 40: 16, 41: 0 }, kept: { seq: 4, factions: { 40: 10, 41: 0 } } });
  p.tracker.tick(); await p.settle();
  assert.equal(p.h[40], 16, 'the save\'s unclaimed 6 kept');
  assert.deepEqual(p.box.kept, { seq: 4, factions: rollAdopt({}, {}, {}, { 40: 10, 41: 0 }).base });
  p.tracker.tick(); await p.settle();
  assert.deepEqual(io.calls[1].deltas, { 40: 6 }, 'and claimed');
  // a Roll that moved on since the save (a claim the save never saw): the save's past is not this page's to claim
  const io2 = door({ roll: { seq: 7, factions: { 40: 20, 41: 0 }, members: [] }, from: 7 });
  const q = tab(io2, { held: { 40: 16, 41: 0 }, kept: { seq: 4, factions: { 40: 10, 41: 0 } } });
  q.tracker.tick(); await q.settle();
  assert.equal(q.h[40], 20);
  // C2: what moved while the first read failed is this page's, and kept
  const io3 = door({ roll: { seq: 2, factions: { 40: 10, 41: 0 }, members: [] }, from: 2 });
  const r = tab(io3);
  io3.refuse = 'offline';
  r.tracker.tick(); await r.settle();
  r.h[40] = 25;
  io3.refuse = null;
  r.at(ROLL_RETRY_MS); r.tracker.tick(); await r.settle();
  assert.equal(r.h[40], 25, 'the read that landed late kept the 15 moved before it');
});

test('AUDIT CHAP T3: the Roll\'s word is the standing - a seed the service capped is adopted over the save\'s (mutants: the save adopted)', async () => {
  const io = door({ roll: { seq: 0, factions: { 40: 40, 41: 0 }, members: [] }, from: 0 });
  const p = tab(io, { held: { 40: 90, 41: 0 } });
  const read = io.read;
  io.read = async (...a) => { const r = await read(...a); r.data.seeded = true; return r; };
  p.tracker.tick(); await p.settle();
  assert.equal(p.h[40], 40);
});

test('AUDIT CHAP C5: a faction this client has no row for is never claimed as a loss (mutants: the absent faction read as 0)', () => {
  assert.deepEqual(rollDeltasOf({ 40: 12 }, { 40: 10, 410: 30 }), { 40: 2 });
  const a = rollAdopt({ 40: 12 }, { 40: 10 }, {}, { 40: 10, 410: 30 });
  assert.equal(Object.hasOwn(a.local, 410), false, 'nothing written where the client has no row');
  assert.equal(a.base[410], 30);
});

test('AUDIT CHAP T4/T12: never two asks at once, and none with no lease or no store (mutants: the busy flag, the lease check)', async () => {
  const io = door();
  const p = tab(io);
  p.tracker.tick(); p.tracker.tick(); p.tracker.tick();
  await p.settle();
  assert.equal(io.calls.length, 1);
  const q = tab(door());
  q.box.lease = null; q.tracker.tick(); await q.settle();
  q.box.lease = undefined; q.box.noStore = true; q.tracker.tick(); await q.settle();
  assert.equal(q.tracker.held, false);
});

test('AUDIT CHAP T6/T10: a promotion alone is claimed; an uncut claim says nothing, a cut one says the rest will follow; a repeat\'s answer carries no credit and says nothing (mutants: the rank left out of the key, <= for <)', async () => {
  assert.equal(rollMembersKey([{ f: 40, rank: 1 }]) === rollMembersKey([{ f: 40, rank: 2 }]), false);
  assert.equal(rollMembersKey(null), null);
  const io = door();
  const p = tab(io);
  p.tracker.tick(); await p.settle();
  p.box.members = [{ f: 40, rank: 2 }];
  p.at(ROLL_CLAIM_MS); p.tracker.tick(); await p.settle();
  assert.deepEqual(io.calls[1].members, [{ f: 40, rank: 2 }]);
  p.h[40] += 5;
  p.at(ROLL_CLAIM_MS); p.tracker.tick(); await p.settle();
  assert.deepEqual(p.box.said, [], 'credited whole: nothing said');
  io.credit = (x) => Math.min(x, 1);
  p.h[40] += 5;
  p.at(ROLL_CLAIM_MS); p.tracker.tick(); await p.settle();
  assert.deepEqual(p.box.said, [[40]]);
  const claim = io.claim;
  io.claim = async (...a) => { const r = await claim(...a); delete r.data.credited; r.data.repeat = true; return r; };
  p.h[40] += 5;
  p.at(ROLL_CLAIM_MS); p.tracker.tick(); await p.settle();
  assert.deepEqual(p.box.said, [[40]], 'a repeat said nothing more');
  assert.equal(rollCeilingLine('The Mages Guild'), 'Your standing with the Mages Guild rises no further today. The rest will follow in the days to come.');
  assert.equal(rollFactionName(undefined), 'the guild');
});

test('AUDIT CHAP T8/T9: the wait doubles from 30 seconds to 15 minutes and resets on an answer; no Roll found reads again; a read with no Roll is a stop (mutants: the doubling, the cap, the reset, the unseeded reset)', async () => {
  assert.deepEqual([ROLL_RETRY_MS, ROLL_RETRY_MAX_MS], [30_000, 900_000]);
  const io = door();
  const p = tab(io);
  io.refuse = 'offline';
  const asks = () => io.calls.length;
  p.tracker.tick(); await p.settle();
  for (const [wait, n] of [[29_999, 1], [1, 2], [59_999, 2], [1, 3], [119_999, 3], [1, 4]]) {
    p.at(wait); p.tracker.tick(); await p.settle();
    assert.equal(asks(), n, `after ${wait}`);
  }
  for (let i = 0; i < 8; i++) { p.at(ROLL_RETRY_MAX_MS); p.tracker.tick(); await p.settle(); }
  const capped = asks();
  p.at(ROLL_RETRY_MAX_MS - 1); p.tracker.tick(); await p.settle();
  assert.equal(asks(), capped, 'never longer than the cap, never shorter');
  p.at(1); p.tracker.tick(); await p.settle();
  assert.equal(asks(), capped + 1);
  io.refuse = null;
  p.at(ROLL_RETRY_MAX_MS); p.tracker.tick(); await p.settle();
  io.refuse = 'roll-busy';
  p.h[40] += 1;
  p.at(ROLL_CLAIM_MS); p.tracker.tick(); await p.settle();
  const before = asks();
  p.at(ROLL_RETRY_MS); p.tracker.tick(); await p.settle();
  assert.equal(asks(), before + 1, 'an answer reset the wait to 30 seconds');
  io.refuse = 'roll-unseeded';
  p.at(ROLL_RETRY_MS * 2); p.tracker.tick(); await p.settle();
  io.refuse = null;
  p.at(ROLL_RETRY_MAX_MS); p.tracker.tick(); await p.settle();
  assert.equal(io.calls.at(-1).kind, 'read', 'no Roll after all: read again');
  const empty = { read: async () => ({ ok: true, data: { roll: null } }), claim: async () => ({ ok: false, error: 'x' }) };
  const q = tab(empty);
  q.tracker.tick(); await q.settle();
  assert.deepEqual([q.box.stops, q.tracker.stopped], [['roll-seed'], 'roll-seed']);
  assert.equal(ROLL_STOPS.includes('no-data'), true);
});

test('AUDIT CHAP T5: the host\'s glue - the entity\'s standing read off its store, the Roll written through DFU\'s own SetReputation (clamped), the memberships off its book or null (mutants: the store, the book, the door)', () => {
  const entity = { factionRep: createFactionRep(new Map([[40, { id: 40, rep: 5 }], [41, { id: 41, rep: -3 }]])), guildMemberships: { mortal: { 10: { guild: 'MagesGuild', rank: 2 } }, vampire: {} } };
  const doors = rollEntityDoors(() => entity);
  assert.deepEqual(doors.read(), { 40: 5, 41: -3 });
  doors.write({ 40: 120, 41: 7, 42: 9 });
  assert.deepEqual([entity.factionRep.dict.get(40).rep, entity.factionRep.dict.get(41).rep, entity.factionRep.dict.has(42)], [100, 7, false]);
  assert.deepEqual(doors.members(), [{ f: 40, rank: 2 }]);
  assert.equal(rollEntityDoors(() => ({})).members(), null);
  assert.equal(rollEntityDoors(() => null).read(), null);
});

test('AUDIT CHAP T7/T13: a seed of exactly 100 is a seed; -101 is not; a claim id is twenty-four hex digits whatever the bytes (mutants: < for <=, the pad)', () => {
  assert.equal(rollSeedOk({ 40: 100, 41: -100 }), true);
  assert.equal(rollSeedOk({ 40: -101 }), false);
  assert.equal(rollRid(() => new Uint8Array(12)), '0'.repeat(24));
  assert.equal(rollRid((b) => b.fill(15)), '0f'.repeat(12));
});

test('AUDIT CHAP: the kept record - its vendor, its shape, and anything else refused (mutants: the shape check)', () => {
  assert.equal(ROLL_KEPT_VENDOR, 'ChaptersRoll');
  assert.deepEqual(rollKeptOf({ seq: 3, factions: { 40: 10 } }), { seq: 3, factions: { 40: 10 } });
  for (const bad of [null, { seq: -1, factions: {} }, { seq: 1.5, factions: {} }, { seq: 1, factions: { 510: 1 } }, { seq: 1 }]) assert.equal(rollKeptOf(bad), null);
});

test('AUDIT CHAP T1: the realm session\'s lease is read while it plays, and null once it is lost', () => {
  const s = createRealmSession({ io: null, id: 'r0123456789abcdef0123', lease: 'b'.repeat(32), seq: 1, later: () => () => {}, watchHidden: () => {} });
  assert.equal(s.lease, 'b'.repeat(32));
  s.abandon('unknown');
  assert.equal(s.lease, null);
});

// ── T2: THE DOOR, END TO END ────────────────────────────────────────

test('AUDIT CHAP T2: the real tab through the real door to the real service - a customs seed capped and adopted, a claim cut and owed, a repeat answered (mutants: the door\'s paths and its seed)', async () => {
  const s = await stand({ origin: 'off-audra' });
  const io = accountRoll({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, s.who) });
  let t = 1_000_000;
  const held = { 40: 90, 41: 0 };
  const said = [];
  let kept = null;
  const tracker = createRollTracker({
    io, character: () => s.R.id, lease: () => s.R.lease, read: () => ({ ...held }), write: (v) => Object.assign(held, v),
    members: () => [], kept: () => kept, keep: (k) => { kept = k; }, now: () => t, onCeiling: (f) => said.push(f),
  });
  const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
  tracker.tick(); await settle();
  assert.equal(held[40], 40, 'the service capped the crossing\'s seed, and the tab holds the service\'s word');
  assert.deepEqual(kept?.seq, 0);
  held[40] += 25;
  t += ROLL_CLAIM_MS; tracker.tick(); await settle();
  assert.equal(held[40], 55, 'fifteen of twenty-five today');
  assert.deepEqual(said, [[40]]);
  assert.equal(s.rep(40).owed, 10, 'the rest owed');
  assert.equal(accountRefusalText('roll-busy'), REFUSALS['roll-busy']);
});
