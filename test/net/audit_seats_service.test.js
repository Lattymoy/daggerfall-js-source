// AUDIT-SEATS (2026-10-01, Mac: "We need to do a comprehensive audit on everything and finish the not done") - THE SEATS'
// SERVICE, ITS AUDITED FINDINGS FIXED: a Bounty's refund that could hold the Turning back for good (S1) and the settle that
// moved past a week that failed; a Sellsword's purse that could roll a result back (S2); a battle no result reached void at
// its Turning, its escrow home and its Right carried, a late result refused (S3); a struck seat's Charter (S4) and the
// strikes Season 0's wipe keeps (S5); the gate's and Renown's caps an account's week, every seat together (S7); a Tourney's
// dead heat as its Turning counted it (S8); a barred challenger's rows voided, never deleted (S9); a window in the
// Reckoning and heraldry in a siege week refused (S10); the standings summed in SQL, the Tithe's walk bounded by its days,
// old rows pruned (S11); the Throne reached (T1); a disputed seat on the audit at once (T2).
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/11-Multiplayer/Seats-Arc.md 3.2, 4.2, 5.1, 5.2, 6.5-6.8, 7.3, 8.1, 9.2, 16, 17, 18, Appendix B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import {
  seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs, CLAIM_FEE, STANDING_START, chronicleLine,
  siegeAftermath, GATE_WEEK_RECEIPTS, RENOWN_WEEK_XP, SIEGE_WHY, SIGN_WHY, turningPlan,
} from '../../src/net/townSeatLaw.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { _b64url } from '../../src/net/identityToken.js';
import { SIEGE_RECEIPT_V, SIEGE_RECEIPT_TTL_S, verifySiegeReceipt } from '../../src/net/siege/siegeReceipt.js';
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import { mintReceipt } from '../../src/net/gate/gateReceipt.js';
import { gameDayAt, gateTimes } from '../../src/net/gate/gateLaw.js';
import { settleWeek, settleDue, seatBadgeOf, INFLUENCE_KEPT_WEEKS } from '../../server-account/src/seatTurning.js';
import { gatherStandings } from '../../server-account/src/seatInfluence.js';
import { siegeClaimSettles } from '../../src/net/siege/siegeClaims.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const BETONY = { key: 1919, name: 'Betony', region: 19, tier: 'palace', pixel: [300, 200] };
const GLENPOINT = { key: 1818, name: 'Glenpoint', region: 18, tier: 'palace', pixel: [250, 120] };
const SEATS = [ANTICLERE, ASHFIELD, ALCAIRE, BETONY, GLENPOINT];
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);   // T0 is a Friday morning: the Muster of week W
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const S = (ms) => Math.floor(ms / 1000);
const START = S(siegeStartMs(W + 1, 0, 20));   // the default window, Wednesday 20:00 of W+1
const enc = new TextEncoder();

/** A siege receipt minted as the relay mints one, with the Throne's `th` carried in the signed claims (the mint helper of
 *  net/siege/siegeReceipt.js names only the fields it knew - AUDIT-SEATS T1's `th` is the relay half's to add there). */
async function mintSiege(claims, key, nowS) {
  const c = { ...claims, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S };
  const body = _b64url.encode(enc.encode(JSON.stringify(c)));
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, key, enc.encode(`${SIEGE_RECEIPT_V}.${body}`)));
  return `${SIEGE_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

async function stood(t, extra = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Devra', ...extra });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of SEATS) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.seated(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, week = W) => {
    const m = await svc.seated(handle, { renown: 5 });
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, 2, handle, T0 - 30 * DAY);
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, m.id, g.gid, m.character, T0);
    return m;
  };
  let seed = 0;
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-g-${++seed}`);
  const drain = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('guild', ?, 'burn', NULL, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-d-${++seed}`);
  const mintTo = (who, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(who.id, n, `seed-a-${++seed}`);
  const purse = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const marks = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const earn = async (gid, seat, amount, week = W) => {
    while (amount > 0) {
      const a = await svc.guest();
      const n = Math.min(2000, amount);
      raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, n, seat.region, `t:${a.id}:${week}:${seat.key}`, now);
      amount -= n;
    }
  };
  const pledge = (gid, seat, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', T0);
  const hold = (seat, gid, since = W - 2) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(seat.key, gid, seat.region, seat.tier, since, T0 - 14 * DAY);
  const holdOf = (seat = ANTICLERE) => { const h = raw.prepare('SELECT guild_id, standing, since_week, truce_week FROM town_seat_holds WHERE key = ?').get(seat.key); return h ? { ...h } : null; };
  const battle = (seat = ANTICLERE, week = W + 1) => { const b = raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, seat.key); return b ? { ...b } : null; };
  const history = (kind, seat = ANTICLERE) => raw.prepare('SELECT kind, week, data FROM town_seat_history WHERE key = ? AND kind = ? ORDER BY seq').all(seat.key, kind).map((r) => ({ kind: r.kind, week: r.week, data: JSON.parse(r.data) }));
  const call = (path, body, who) => svc.call(path, body, who.secret);
  const list = (who) => call('/v1/seats/list', {}, who);
  const receipt = (who, o = {}) => mintSiege({ s: who.id, sk: ANTICLERE.key, sw: W + 1, sd: 'attack', r: 'attack', a: 1, h: 1, th: 0, ...o }, svc.gateKey, now);
  const claim = async (who, o = {}) => call('/v1/seats/siege/claim', { receipt: await receipt(who, o), character: who.character }, who);
  const s = {
    svc, raw, guild, member, treasury, drain, mintTo, purse, marks, earn, pledge, hold, holdOf, battle, history, call, list, receipt, claim,
    setNow: (n) => { now = n; }, getNow: () => now,
  };
  return s;
}

/** THE SIEGE OF ANTICLERE: the Silver Hand holds it, the Ebon Oath wins a Right at W's Turning, Wednesday 20:00 of W+1; an
 *  attacker and a defender signed. */
async function siegeWeek(s) {
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10000);
  await s.earn(sh.gid, ANTICLERE, 500);
  s.pledge(eo.gid, ANTICLERE);
  await s.earn(eo.gid, ANTICLERE, 7000);
  const a1 = await s.member(eo, 'Arden'), d1 = await s.member(sh, 'Dorran');
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.equal(s.battle()?.state, 'scheduled', 'the siege placed');
  for (const who of [a1, d1]) assert.equal((await s.call('/v1/seats/siege/sign', { character: who.character, key: ANTICLERE.key }, who)).status, 200);
  return { sh, eo, a1, d1 };
}

// ─── S1 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S1: a Bounty\'s unspent escrow is burnt where its guild\'s treasury is full - the Turning settles all the same (it rolled back on every retry); home where it fits; and settleDue stops at a week whose settle failed, never settling a later one over it (mutants: the CASE; the full treasury; the gone guild; the break; the failed flag)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  // a Bounty that ruled week W - 5,000 set aside, 1,200 spent - and its guild's treasury topped to the cap meanwhile
  const bounty = (week, setAside, spent) => s.raw.prepare(`INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, set_aside, spent, state, cost, at)
    VALUES (?, ?, 'bounty', ?, 'x', ?, ?, 'law', ?, ?)`).run(ANTICLERE.key, week, sh.gid, setAside, spent, setAside, T0);
  bounty(W, 5000, 1200);
  s.treasury(sh.gid, MARKS_MAX);
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), 'the week settled');
  const line = (week) => { const l = s.raw.prepare("SELECT src_kind, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = 'bounty-return' AND src_id = ?").get(`bounty:${ANTICLERE.key}:${week}`); return l ? { ...l } : null; };
  assert.deepEqual(line(W), { src_kind: 'escrow', dst_kind: 'burn', dst_id: null, amount: 3800 }, 'burnt: the treasury holds the cap');
  assert.equal(s.purse(sh.gid), MARKS_MAX);
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W).state, 'returned');
  // the next week's, where it fits: home to the treasury
  bounty(W + 1, 1000, 0);
  s.drain(sh.gid, 2000);
  s.setNow(AFTER(W + 1));
  await s.list(sh.gm);
  assert.deepEqual(line(W + 1), { src_kind: 'escrow', dst_kind: 'guild', dst_id: sh.gid, amount: 1000 });
  assert.equal(s.purse(sh.gid), MARKS_MAX - 2000 + 1000);
  // a guild gone: burnt, never a line to no treasury
  const gone = await s.guild('Gwen', 'Gone Guild', 'GG');
  s.raw.prepare(`INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, set_aside, spent, state, cost, at) VALUES (?, ?, 'bounty', ?, 'x', 700, 0, 'law', 700, ?)`).run(ASHFIELD.key, W + 2, gone.gid, T0);
  s.raw.prepare('PRAGMA foreign_keys = OFF').run();
  s.raw.prepare('DELETE FROM guilds WHERE id = ?').run(gone.gid);
  s.raw.prepare('PRAGMA foreign_keys = ON').run();
  s.setNow(AFTER(W + 2));
  await s.list(sh.gm);
  assert.deepEqual({ ...s.raw.prepare("SELECT dst_kind, amount FROM marks_ledger WHERE kind = 'bounty-return' AND src_id = ?").get(`bounty:${ASHFIELD.key}:${W + 2}`) }, { dst_kind: 'burn', amount: 700 });
  // SETTLE DUE STOPS AT A FAILED WEEK: three weeks due, the middle one's batch failing - the first settled, the rest left
  // for the next read, which settles them in order (the probe's "weeks settled [9, 11]" never again)
  const db = s.svc.env.DB;
  const failing = new Set([W + 4]);
  const wrapped = {
    prepare(sql) {
      const st = db.prepare(sql);
      const bind = st.bind;
      st._sql = sql;
      st.bind = (...a) => { st._args = a; bind(...a); return st; };
      return st;
    },
    batch(list) {
      const first = list[0];
      if (/^INSERT INTO town_seat_weeks/.test(first?._sql ?? '') && failing.has(first._args?.[0])) return Promise.reject(new Error('a batch that fails'));
      return db.batch(list);
    },
  };
  const weeks = () => s.raw.prepare('SELECT week FROM town_seat_weeks WHERE week > ? ORDER BY week').all(W + 2).map((r) => r.week);
  const r = await settleWeek(wrapped, W + 4, AFTER(W + 5));
  assert.deepEqual([r.settled, r.failed], [false, true], 'a batch that rolled back for a reason of its own says so');
  assert.equal(await settleDue(wrapped, AFTER(W + 5)), 1);
  assert.deepEqual(weeks(), [W + 3], 'W+3 settled; W+4 failed; W+5 left with it');
  assert.equal(await settleDue(db, AFTER(W + 5)), 2);
  assert.deepEqual(weeks(), [W + 3, W + 4, W + 5], 'the next read settles the failed week first, then the rest');
  // a racing reader's key is no failure
  const race = await settleWeek(db, W + 5, AFTER(W + 5));
  assert.deepEqual([race.settled, race.failed], [false, undefined]);
});

// ─── S2 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S2: a Sellsword\'s fee to a full account and a contract\'s escrow home to a full treasury are BURNT - the result is written and the seat taken, where they rolled the whole result back and every fighter\'s claim was a 500 (a defender kept its seat with a 1-Drake dummy and a full treasury) (mutants: the account\'s fit; the treasury\'s fit; one statement a contract)', async (t) => {
  const s = await stood(t);
  const { sh, eo, a1 } = await siegeWeek(s);
  const dummy = await s.svc.seated('Dummy'), sword = await s.svc.seated('Swordo');
  await s.svc.seated('Dummytwo');
  s.setNow(START - 3600);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: sh.gm.character, key: ANTICLERE.key, handle: 'Dummy', fee: 1 }, sh.gm)).status, 200, 'the defender\'s dummy, never signed');
  assert.equal((await s.call('/v1/seats/siege/hire', { character: sh.gm.character, key: ANTICLERE.key, handle: 'Dummytwo', fee: 2 }, sh.gm)).status, 200, 'and a second');
  s.treasury(eo.gid, 300);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: eo.gm.character, key: ANTICLERE.key, handle: 'Swordo', fee: 300 }, eo.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/sign', { character: sword.character, key: ANTICLERE.key }, sword)).status, 200);
  s.mintTo(sword, MARKS_MAX - 100);
  s.treasury(sh.gid, MARKS_MAX - s.purse(sh.gid));   // the defender's treasury topped to the cap
  s.setNow(START + 1500);
  const r = await s.claim(a1);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.result, r.body.applied], ['attack', true]);
  assert.equal(s.holdOf().guild_id, eo.gid, 'the seat taken');
  const lines = s.raw.prepare("SELECT kind, src_kind, dst_kind, dst_id, amount FROM marks_ledger WHERE kind IN ('sellsword-fee', 'sellsword-return') ORDER BY amount").all().map((l) => ({ ...l }));
  assert.deepEqual(lines, [
    { kind: 'sellsword-return', src_kind: 'escrow', dst_kind: 'burn', dst_id: null, amount: 1 },
    { kind: 'sellsword-return', src_kind: 'escrow', dst_kind: 'burn', dst_id: null, amount: 2 },
    { kind: 'sellsword-fee', src_kind: 'escrow', dst_kind: 'burn', dst_id: null, amount: 300 },
  ], 'each contract its own line, burnt where its purse is full');
  assert.equal(s.marks(sword), MARKS_MAX - 100);
  assert.equal(s.purse(sh.gid), MARKS_MAX);
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_hires WHERE account = ?').get(dummy.id).state, 'withdrawn');
});

// ─── S3 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S3: A BATTLE NO RESULT REACHED BY ITS TURNING IS VOID - its Sellswords\' escrow home (a signed contract\'s too), the siege\'s Right carried to the holder\'s window the next week as the challenger\'s one Right and the seat\'s one challenge, the Chronicle saying so; a void Tourney carries nothing; a receipt that comes after is refused whole - no Charter moved, no Honours (mutants: the void; the carry; the one Right; the one challenge; the escrow home; the signed home; the refusal; the Tourney\'s none)', async (t) => {
  const s = await stood(t);
  const { sh, eo, a1, d1 } = await siegeWeek(s);
  const oa = await s.guild('Orla', 'The Oath', 'OA');
  const ic = await s.guild('Cyril', 'Iron Circle', 'IC');
  const rv = await s.guild('Rhea', 'Raven Vale', 'RV');
  const rw = await s.guild('Bran', 'Red Wolves', 'RW');
  s.hold(ALCAIRE, oa.gid);
  s.treasury(oa.gid, 10000);
  // the holder's window, moved in W+1's Muster: Thursday 21:00 - the window the carried Right is fought in
  s.setNow(START - 3600);
  assert.equal((await s.call('/v1/seats/window', { character: sh.gm.character, key: ANTICLERE.key, day: 1, hour: 21 }, sh.gm)).status, 200);
  // the holder's two contracts: one signed (300), one offered and never signed (200)
  const sword = await s.svc.seated('Swordo'), idle = await s.svc.seated('Idris');
  assert.equal((await s.call('/v1/seats/siege/hire', { character: sh.gm.character, key: ANTICLERE.key, handle: 'Swordo', fee: 300 }, sh.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/hire', { character: sh.gm.character, key: ANTICLERE.key, handle: 'Idris', fee: 200 }, sh.gm)).status, 200);
  assert.equal((await s.call('/v1/seats/siege/sign', { character: sword.character, key: ANTICLERE.key }, sword)).status, 200);
  // a Tourney at Ashfield the same week, no result either
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'tourney', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(W + 1, ASHFIELD.key, rv.gid, rw.gid, START, START + 1200, T0);
  // W+1's week: the Oath back at Anticlere, and past the Oath's defence at Alcaire - its strongest; the Circle past the Hand's
  for (const [g, seat, n] of [[eo, ANTICLERE, 7000], [eo, ALCAIRE, 9000], [ic, ANTICLERE, 8000]]) { s.pledge(g.gid, seat, W + 1); await s.earn(g.gid, seat, n, W + 1); }
  await s.earn(oa.gid, ALCAIRE, 500, W + 1);
  const right = { ...s.raw.prepare('SELECT guild_id, against, total, defence FROM town_seat_rights WHERE week = ? AND key = ?').get(W + 1, ANTICLERE.key) };
  const shPurse = s.purse(sh.gid);
  // no result ever comes: the Turning
  s.setNow(AFTER(W + 1));
  await s.list(sh.gm);
  assert.equal(s.battle().state, 'void', 'void at its Turning');
  assert.equal(s.battle(ASHFIELD).state, 'void', 'the Tourney too');
  // the Right carried: the Oath's one, the seat's one, at the holder's window next week
  const rights = s.raw.prepare('SELECT key, kind, guild_id, against, total, defence FROM town_seat_rights WHERE week = ? ORDER BY key').all(W + 2).map((r) => ({ ...r }));
  assert.deepEqual(rights, [{ key: ANTICLERE.key, kind: 'siege', guild_id: eo.gid, against: sh.gid, total: right.total, defence: right.defence }],
    'the carried Right alone - the Oath none at Alcaire, the Circle none at Anticlere, nothing at the void Tourney\'s seat');
  const next = s.battle(ANTICLERE, W + 2);
  assert.deepEqual([next.attacker, next.defender, next.starts_at], [eo.gid, sh.gid, S(siegeStartMs(W + 2, 1, 21))], 'fought in the holder\'s window');
  assert.deepEqual(s.history('siege-void').map((h) => [h.week, h.data.battle, h.data.carried, h.data.guild.tag, h.data.holder.tag]), [[W + 1, 'siege', true, 'EO', 'SH']]);
  assert.deepEqual(s.history('siege-void', ASHFIELD).map((h) => [h.data.battle, h.data.carried]), [['tourney', false]]);
  assert.equal(s.history('right').filter((h) => h.week === W + 1).length, 0, 'the void row says it carries - no second Right row');
  assert.equal(s.history('held').filter((h) => h.week === W + 1).length, 0, 'a seat whose Right carries is not held unchallenged');
  assert.equal(chronicleLine(s.history('siege-void')[0], ANTICLERE), `In week ${W + 1}, no result of the siege of Anticlere came; it is void, the Silver Hand <SH> keeps it for now, and Ebon Oath <EO>'s Right of Siege carries to the next week.`);
  assert.equal(chronicleLine(s.history('siege-void', ASHFIELD)[0], ASHFIELD), `In week ${W + 1}, no result of the Tourney for Ashfield came; it is void, and the Charter of Ashfield stays unheld.`);
  // the escrow home, the signed contract's too (DECIDED: a void battle pays no fee)
  const home = s.raw.prepare("SELECT dst_kind, dst_id, amount FROM marks_ledger WHERE kind = 'sellsword-return' ORDER BY amount").all().map((l) => ({ ...l }));
  assert.deepEqual(home, [{ dst_kind: 'guild', dst_id: sh.gid, amount: 200 }, { dst_kind: 'guild', dst_id: sh.gid, amount: 300 }]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'sellsword-fee'").get().n, 0);
  assert.equal(s.marks(sword), 0);
  assert.equal(s.purse(sh.gid), shPurse + 500 - 2500, 'the escrow home, the week\'s upkeep paid');
  assert.deepEqual(s.raw.prepare('SELECT state FROM town_seat_hires WHERE account IN (?, ?) ORDER BY fee').all(idle.id, sword.id).map((h) => h.state), ['withdrawn', 'withdrawn']);
  // a receipt that comes after the Turning: refused whole
  s.setNow(AFTER(W + 1) + 60);
  const late = await s.claim(a1);
  assert.deepEqual([late.status, late.body.error], [409, 'battle-void']);
  assert.equal(s.holdOf().guild_id, sh.gid, 'no Charter moved');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_results').get().n, 0);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_honours').get().n, 0, 'no Honours (16: a void siege - "nobody earns Honours")');
  assert.equal((await s.claim(d1, { s: d1.id, sd: 'defend', r: 'defend' })).body.error, 'battle-void');
  // the words, and the device lets the receipt go
  assert.equal(accountRefusalText('battle-void'), SIEGE_WHY['battle-void']);
  assert.equal(siegeClaimSettles({ ok: false, error: 'battle-void' }), true, 'let go - it can never be claimed');
  // the carried siege is a siege like any other: its result taken in its own week
  s.setNow(S(siegeStartMs(W + 2, 1, 21)) + 1500);
  s.raw.prepare('INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(W + 2, a1.id, eo.gid, a1.character, T0);
  // PIN MOVED (AUDIT SEATS-3): A3 - Honours go to the character on the battle's roster, so a1 signs the carried siege's
  s.raw.prepare("INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, at) VALUES (?, ?, ?, ?, ?, 'attack', ?)").run(W + 2, ANTICLERE.key, a1.id, a1.character, eo.gid, T0);
  const fought = await s.claim(a1, { sw: W + 2 });
  assert.deepEqual([fought.status, fought.body.result, s.holdOf().guild_id], [200, 'attack', eo.gid]);
});

test('AUDIT-SEATS S3: THE TURNING AND A RESULT RACE - one statement decides on each side: a result that landed between the settle\'s read and its write rolls the settle back (the next read settles with the result in hand, nothing void); a battle voided between a claim\'s read and its write, or whose week is settled, takes no result and moves no Charter (mutants: the settle\'s guard; the result\'s two guards; the result\'s must-change)', async (t) => {
  const s = await stood(t);
  const { sh, eo, a1 } = await siegeWeek(s);
  const db = s.svc.env.DB;
  // the settle's side: a result lands as the settle's batch is about to run
  let landed = false;
  const racing = {
    prepare: (sql) => db.prepare(sql),
    batch(list) {
      if (!landed) {
        landed = true;
        s.raw.prepare("INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at) VALUES (?, ?, 'absent', 0, 'defend', 'r', ?)").run(W + 1, ANTICLERE.key, AFTER(W + 1));
        s.raw.prepare("UPDATE town_seat_battles SET state = 'fought' WHERE week = ? AND key = ?").run(W + 1, ANTICLERE.key);
      }
      return db.batch(list);
    },
  };
  const r = await settleWeek(racing, W + 1, AFTER(W + 1));
  assert.deepEqual([r.settled, r.failed], [false, true], 'rolled back whole');
  assert.equal(s.battle().state, 'fought');
  assert.equal((await settleWeek(db, W + 1, AFTER(W + 1))).settled, true, 'the next read settles it');
  assert.equal(s.battle().state, 'fought', 'nothing void');
  assert.deepEqual([s.history('siege-void').length, s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_rights WHERE week = ?').get(W + 2).n], [0, 0]);

  // the claim's side: a battle the Turning voids between the claim's read and its write
  const t2 = await stood(t);
  const w2 = await siegeWeek(t2);
  const db2 = t2.svc.env.DB;
  const prepare = db2.prepare;
  let voided = false;
  db2.prepare = (sql) => {
    const st = prepare(sql);
    if (!voided && sql === 'SELECT * FROM town_seat_battles WHERE week = ? AND key = ?') {
      const first = st.first;
      st.first = async () => { const row = await first(); voided = true; t2.raw.prepare("UPDATE town_seat_battles SET state = 'void' WHERE week = ? AND key = ?").run(W + 1, ANTICLERE.key); return row; };
    }
    return st;
  };
  t2.setNow(START + 1500);
  const c = await t2.claim(w2.a1);
  db2.prepare = prepare;
  assert.ok(voided);
  assert.deepEqual([c.status, c.body.error], [409, 'battle-void']);
  assert.equal(t2.holdOf().guild_id, w2.sh.gid, 'no Charter moved');
  assert.equal(t2.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_results').get().n, 0);
  assert.equal(t2.history('siege-taken').length, 0);
  // a battle still `scheduled` whose week was settled (a row from before the void): no result, no Charter
  t2.raw.prepare("UPDATE town_seat_battles SET state = 'scheduled' WHERE week = ? AND key = ?").run(W + 1, ANTICLERE.key);
  t2.raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W + 1, T0);
  const d = await t2.claim(w2.a1);
  assert.deepEqual([d.status, d.body.error], [409, 'battle-void']);
  assert.equal(t2.holdOf().guild_id, w2.sh.gid);
  assert.equal(t2.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_results').get().n, 0);
  void sh; void eo; void a1;
});

test('AUDIT-SEATS S3: a void siege whose challenger is gone carries nothing (16: "its siege is void: the holder keeps the seat") - the settle stands, no Right to a guild that is not there (mutants: the challenger standing)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const gone = await s.guild('Gwen', 'Gone Guild', 'GG');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10000);
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(W, ANTICLERE.key, gone.gid, sh.gid, T0 + DAY, T0 + DAY + 1800, T0);
  s.raw.prepare('PRAGMA foreign_keys = OFF').run();
  s.raw.prepare('DELETE FROM guilds WHERE id = ?').run(gone.gid);   // by a path no refusal covers (an account's deletion cascading)
  s.raw.prepare('PRAGMA foreign_keys = ON').run();
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), 'settled');
  assert.equal(s.battle(ANTICLERE, W).state, 'void');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_rights WHERE week = ?').get(W + 1).n, 0);
  assert.deepEqual(s.history('siege-void').map((h) => [h.data.carried, h.data.guild]), [[false, { name: '', tag: '' }]]);
  assert.equal(chronicleLine(s.history('siege-void')[0], ANTICLERE), `In week ${W}, no result of the siege of Anticlere came; it is void, and the Silver Hand <SH> keeps it.`);
});

// ─── S4 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S4: A HELD SEAT STRUCK - its Charter void in the strike\'s own batch: the hold gone (no title, no glyph, no pledge through it, the guild free to pledge in the region), its proclaimed Edict and its battle void, its claim fee refunded within the Season (what the treasury has room for), none from an older Charter; the Chronicle says so (mutants: the hold; the Edict; the battle; the refund; the Season; the room)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const oa = await s.guild('Orla', 'The Oath', 'OA');
  const rw = await s.guild('Bran', 'Red Wolves', 'RW');
  const dev = await s.svc.seated('Devra');
  /** a Charter claimed at the Turning of `week - 1` (or won at `week`'s Tourney): its fee burnt from `gid` as the Turning
   *  (the Tourney) burns it */
  const claimed = (seat, gid, week, tourney = false) => {
    s.treasury(gid, CLAIM_FEE.palace);
    s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('guild', ?, 'burn', NULL, 'seat-claim', ?, 1, 1, 'seats', 'The Turning', ?)`).run(gid, CLAIM_FEE.palace, tourney ? `tourney-${week}-${seat.key}` : `claim-${week - 1}-${seat.key}`);
    s.hold(seat, gid, week);
  };
  claimed(ANTICLERE, sh.gid, W);   // this Season's (no Season counted: the last eight weeks)
  claimed(ALCAIRE, eo.gid, W - 10);   // older than the Season
  claimed(BETONY, oa.gid, W - 1);
  claimed(ASHFIELD, rw.gid, W - 2, true);   // won at a Tourney
  s.treasury(oa.gid, MARKS_MAX - 100);   // room for 100 of its fee
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'festival', ?, 'x', 'proclaimed', ?)").run(ANTICLERE.key, W + 1, sh.gid, T0);
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(W, ANTICLERE.key, eo.gid, sh.gid, T0 + DAY, T0 + DAY + 1800, T0);
  assert.deepEqual(await seatBadgeOf(s.svc.env.DB, sh.gm.id, sh.gm.character), { glyphs: ['tower'], title: 'warden', ts: [ANTICLERE.key, 0] });
  // the holder's Sellsword offered on the battle there (100, escrowed)
  s.treasury(sh.gid, 100);
  await s.svc.seated('Idris');
  assert.equal((await s.call('/v1/seats/siege/hire', { character: sh.gm.character, key: ANTICLERE.key, handle: 'Idris', fee: 100 }, sh.gm)).status, 200);
  assert.equal(s.purse(sh.gid), 0);
  const strike = async (seat) => (await s.call('/v1/seats/strike', { key: seat.key }, dev)).status;
  assert.equal(await strike(ANTICLERE), 200);
  assert.equal(s.holdOf(), null, 'the Charter void');
  assert.deepEqual(await seatBadgeOf(s.svc.env.DB, sh.gm.id, sh.gm.character), { glyphs: [], title: null, ts: null }, 'no tower, no Warden');
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 1).state, 'void');
  assert.equal(s.battle(ANTICLERE, W).state, 'void');
  assert.equal(s.purse(sh.gid), CLAIM_FEE.palace, 'the fee refunded');
  assert.deepEqual({ ...s.raw.prepare("SELECT src_kind, dst_kind, dst_id, amount, actor FROM marks_ledger WHERE kind = 'seat-strike-refund' AND dst_id = ?").get(sh.gid) },
    { src_kind: 'mint', dst_kind: 'guild', dst_id: sh.gid, amount: CLAIM_FEE.palace, actor: 'seats' });
  const row = s.history('strike')[0];
  assert.deepEqual([row.data.by, row.data.guild, row.data.refund], ['Devra', { name: 'The Silver Hand', tag: 'SH' }, CLAIM_FEE.palace]);
  // PIN MOVED: GUILD3a (bible/11-Multiplayer/Guilds-Made-Plain.md) - silver, never Marks; marked by AUDIT GUILD3 R4
  assert.equal(chronicleLine(row, ANTICLERE), `In week ${W}, Anticlere was struck from the registry, and the Silver Hand <SH>'s Charter with it - its claim fee of 8,000 silver refunded.`);
  // the guild pledges in the region again; a claim on the struck seat's battle is refused
  assert.equal((await s.call('/v1/seats/pledge', { character: sh.gm.character, key: ASHFIELD.key }, sh.gm)).status, 200, 'no longer seat-held-here');
  assert.equal((await s.claim(sh.gm, { sw: W, sd: 'defend', r: 'defend' })).body.error, 'battle-void');
  // older than the Season: no refund; a treasury near the cap: what it has room for
  assert.equal(await strike(ALCAIRE), 200);
  assert.deepEqual([s.holdOf(ALCAIRE), s.purse(eo.gid)], [null, 0]);
  assert.equal(s.history('strike', ALCAIRE)[0].data.refund, 0);
  assert.equal(await strike(BETONY), 200);
  assert.deepEqual([s.holdOf(BETONY), s.purse(oa.gid)], [null, MARKS_MAX]);
  assert.equal(s.history('strike', BETONY)[0].data.refund, 100);
  // a Charter won at a Tourney: the Tourney's fee
  assert.equal(await strike(ASHFIELD), 200);
  assert.deepEqual([s.holdOf(ASHFIELD), s.purse(rw.gid)], [null, CLAIM_FEE.palace]);
  // a seat held by none: the strike as before
  assert.equal(await strike(GLENPOINT), 200);
  assert.equal(chronicleLine(s.history('strike', GLENPOINT)[0], GLENPOINT), `In week ${W}, Glenpoint was struck from the registry.`);
  // the struck battle's Sellsword escrow goes home at its Turning
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.deepEqual({ ...s.raw.prepare("SELECT dst_kind, dst_id, amount FROM marks_ledger WHERE kind = 'sellsword-return'").get() }, { dst_kind: 'guild', dst_id: sh.gid, amount: 100 });
  assert.equal(s.purse(sh.gid), CLAIM_FEE.palace + 100, 'its escrow home, no upkeep for a Charter it no longer holds');
  assert.equal(s.history('siege-void').length, 0, 'struck void - the strike\'s row says so, and no Right carries');
});

test('AUDIT-SEATS S4: A CHARTER WHOSE SEAT THE REGISTRY NO LONGER CONFIRMS lapses at the Turning - no upkeep asked of it, its coming Edict void, the Chronicle saying so; the token wears it no more (mutants: the lapse; the Edict; the Season\'s Keeper)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ALCAIRE, sh.gid);
  s.treasury(sh.gid, 10000);
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'curfew', ?, 'x', 'proclaimed', ?)").run(ALCAIRE.key, W + 1, sh.gid, T0);
  // its witnesses gone (an account's reports cascaded away, say) - no strike, no history row of one
  s.raw.prepare("DELETE FROM world_witness WHERE kind = 'seat' AND key = ? AND rowid IN (SELECT rowid FROM world_witness WHERE kind = 'seat' AND key = ? LIMIT 1)").run(String(ALCAIRE.key), String(ALCAIRE.key));
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.equal(s.holdOf(ALCAIRE), null, 'lapsed');
  assert.equal(s.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ALCAIRE.key, W + 1).state, 'void');
  assert.equal(s.purse(sh.gid), 10000, 'no upkeep asked');
  const row = s.history('unregistered', ALCAIRE)[0];
  assert.deepEqual([row.week, row.data.guild.tag], [W, 'SH']);
  assert.equal(chronicleLine(row, ALCAIRE), `In week ${W}, the Charter of Alcaire Keep lapsed - Alcaire Keep is no longer confirmed in the registry.`);
  assert.deepEqual((await seatBadgeOf(s.svc.env.DB, sh.gm.id, sh.gm.character)).glyphs, []);
  // at a Season's end, a Charter that lapsed so keeps no Keeper's title
  const k = await stood(t, { SEASON_ZERO_WEEK: String(W - 11) });   // Season 1 runs W-7..W: W's Turning ends it
  const oa = await k.guild('Orla', 'The Oath', 'OA');
  k.hold(ALCAIRE, oa.gid, W - 8);
  k.treasury(oa.gid, 10000);
  k.raw.prepare("DELETE FROM world_witness WHERE kind = 'seat' AND key = ?").run(String(ALCAIRE.key));
  k.setNow(AFTER(W));
  await k.list(oa.gm);
  assert.equal(k.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_titles').get().n, 0, 'no Keeper of a seat the registry lost');
});

// ─── S5 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S5: Season 0\'s wipe keeps every strike - a seat struck in the beta stays struck, never witnessed again; the rest of the history goes (mutants: the kept strikes)', async (t) => {
  const s = await stood(t, { SEASON_ZERO_WEEK: String(W - 3) });   // Season 0 runs W-3..W: W's Turning ends it
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const dev = await s.svc.seated('Devra');
  assert.equal((await s.call('/v1/seats/strike', { key: BETONY.key }, dev)).status, 200);
  s.raw.prepare("INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, 'held', '{}', ?)").run(ANTICLERE.key, W - 1, T0);
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.deepEqual(s.raw.prepare('SELECT key, kind FROM town_seat_history').all().map((r) => [r.key, r.kind]), [[BETONY.key, 'strike']], 'the strike kept, the rest wiped');
  const w = await s.svc.seated('Wanda');
  assert.equal((await s.call('/v1/seats/witness', { seat: BETONY }, w)).body.error, 'seat-struck', 'never witnessed again');
});

// ─── S7 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S7: THE ACCOUNT\'S WEEK, EVERY SEAT TOGETHER - three gate claims a week, at any seats, the fourth answered capped; Renown 8,000 XP a week across every region, the last report banked to the cap and the next capped (4.2: "the Watch and Renown caps above are per account too") (mutants: the gate count; its week; the Renown sum; the clamp)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  for (const seat of [ANTICLERE, ALCAIRE, BETONY]) assert.equal((await s.call('/v1/seats/pledge', { character: sh.gm.character, key: seat.key }, sh.gm)).status, 200);
  const today = gameDayAt(T0 * 1000);
  const days = [today - 4, today - 3, today - 2, today - 1, today].filter((d) => seatWeekOf(gateTimes(d).riseAt) === W);
  assert.ok(days.length >= 4);
  const kill = async (day, region) => (await s.call('/v1/gate/claim', {
    receipt: await mintReceipt({ d: day, b: 'ruhn', s: sh.gm.id, c: 4242, x: 'dealt' }, s.svc.gateKey, { subtle, nowS: s.getNow() }), region, character: sh.gm.character,
  }, sh.gm)).body.seat;
  assert.deepEqual(await kill(days[0], 21), { counted: true, key: ANTICLERE.key });
  assert.deepEqual(await kill(days[1], 34), { counted: true, key: ALCAIRE.key });
  assert.deepEqual(await kill(days[2], 21), { counted: true, key: ANTICLERE.key });
  assert.equal(GATE_WEEK_RECEIPTS, 3);
  assert.deepEqual(await kill(days[3], 34), { counted: false, why: 'capped' }, 'a fourth, at another seat: capped');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_influence WHERE account = ? AND source = 'gate'").get(sh.gm.id).n, 3);
  // last week's rows are last week's: a new week, three again
  s.raw.prepare("UPDATE town_seat_influence SET week = week - 1 WHERE account = ? AND source = 'gate'").run(sh.gm.id);
  if (days[4] != null) assert.deepEqual(await kill(days[4], 21), { counted: true, key: ANTICLERE.key }, 'the cap is the week\'s');
  // Renown: 5,000 at Anticlere's region, 5,000 at Alcaire's - 3,000 of it banked; then nothing
  let n = 0;
  const report = (region, xp) => s.call('/v1/renown/xp', { character: sh.gm.character, xp, rid: `a1b2c3d4e5f6000${++n}`, region }, sh.gm);
  const banked = () => s.raw.prepare('SELECT region, xp FROM town_seat_renown WHERE account = ? ORDER BY region').all(sh.gm.id).map((r) => [r.region, r.xp]);
  assert.equal((await report(21, 5000)).status, 200);
  s.setNow(s.getNow() + 3600);
  assert.equal((await report(34, 5000)).status, 200);
  assert.deepEqual(banked(), [[21, 5000], [34, RENOWN_WEEK_XP - 5000]], 'banked to the account\'s week cap, every region together');
  s.setNow(s.getNow() + 3600);
  assert.equal((await report(19, 1000)).status, 200, 'the report itself stands');
  assert.deepEqual(banked(), [[21, 5000], [34, RENOWN_WEEK_XP - 5000]], 'capped - not even an empty row at a third region');
  const st = (await s.call('/v1/seats/standings', { key: ALCAIRE.key, character: sh.gm.character }, sh.gm)).body;
  assert.equal(st.standings[0].influence, (RENOWN_WEEK_XP - 5000) / 20, 'the Renown banked there (its gate day agreed by nobody else)');
});

// ─── S8 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S8: A TOURNEY\'S DEAD HEAT goes to the higher as the Turning that made it Contested counted it - the week before the Tourney\'s, each guild\'s standings total (Tribute inside its room, never its Marks) and the Legacy it carried in - never the rows\' raw sum, nor the Tourney\'s own week (mutants: the week; the total; the Legacy)', async (t) => {
  const s = await stood(t);
  const rv = await s.guild('Rhea', 'Raven Vale', 'RV');
  const rw = await s.guild('Bran', 'Red Wolves', 'RW');
  const r1 = await s.member(rv, 'Rook');
  s.treasury(rv.gid, 2 * CLAIM_FEE.palace); s.treasury(rw.gid, 2 * CLAIM_FEE.palace);
  const tourney = (week) => s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'tourney', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(week, ASHFIELD.key, rv.gid, rw.gid, START, START + 1200, T0);
  const tribute = (gid, week, marks) => s.raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, ref, at)
    VALUES (?, ?, ?, ?, 'c', 'tribute', ?, ?, ?, ?)`).run(week, ASHFIELD.key, gid, r1.id, marks, ASHFIELD.region, `tr:${gid}:${week}`, T0);
  const tie = async (week) => (await s.call('/v1/seats/siege/claim', {
    receipt: await mintSiege({ s: r1.id, sk: ASHFIELD.key, sw: week, sd: 'attack', r: 'tie', a: 0, h: 0, th: 0 }, s.svc.gateKey, s.getNow()), character: r1.character }, r1)).body;
  const held = () => s.raw.prepare('SELECT guild_id FROM town_seat_holds WHERE key = ?').get(ASHFIELD.key)?.guild_id ?? null;
  s.setNow(START + 1300);
  // the week that made it Contested (W+1): the Wolves 3,000 of watch; the Vale 25,000 Marks of Tribute (2,500 influence -
  // its room none, it earned nothing else) - and the same again in the Tourney's own week, where the raw sum reads the Vale
  for (const week of [W + 1, W + 2]) {
    for (const g of [rv, rw]) s.pledge(g.gid, ASHFIELD, week);
    await s.earn(rw.gid, ASHFIELD, 3000, week);
    tribute(rv.gid, week, 25000);
  }
  await s.earn(rv.gid, ASHFIELD, 4000, W + 2);   // in the Tourney's own week the Vale leads - a week no Turning has counted
  tourney(W + 2);
  const a = await tie(W + 2);
  assert.deepEqual([a.result, a.winner, held()], ['tie', 'defend', rw.gid], 'the Wolves\' 3,000 against the Vale\'s none');
  // the Legacy each carried in counts: the Vale's 4,000 carried into W+2 beats the Wolves' 3,000 there
  s.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(ASHFIELD.key);
  for (const g of [rv, rw]) s.pledge(g.gid, ASHFIELD, W + 3);
  await s.earn(rw.gid, ASHFIELD, 3000, W + 3);
  s.raw.prepare('INSERT INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').run(W + 3, ASHFIELD.key, rv.gid, 4000);
  tourney(W + 4);
  const b = await tie(W + 4);
  assert.deepEqual([b.winner, held()], ['attack', rv.gid], 'the Vale\'s Legacy');
});

// ─── S9 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS S9: A BARRED CHALLENGER\'S INFLUENCE IS VOIDED, NEVER DELETED - the standings count none of it, and the Watch\'s day cap still counts it (a lost siege no longer frees a fresh 60 ticks) (mutants: the void; the standings\' filter)', async (t) => {
  const s = await stood(t);
  const { sh, eo, a1, d1 } = await siegeWeek(s);
  s.setNow(START + 1800);
  s.pledge(eo.gid, ANTICLERE, W + 1);
  const day = utcDay(s.getNow());
  for (let i = 0; i < 60; i++) {
    s.raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', 1, ?, ?, ?, ?)`).run(W + 1, ANTICLERE.key, eo.gid, a1.id, a1.character, ANTICLERE.region, day, `w:${i}`, s.getNow());
  }
  const before = (await s.call('/v1/seats/standings', { key: ANTICLERE.key }, sh.gm)).body.standings.find((x) => x.guild.id === eo.gid);
  assert.equal(before.influence - before.legacy, 60, 'its 60 ticks (and the Legacy it carried in)');
  const r = await s.claim(d1, { s: d1.id, sd: 'defend', r: 'defend', a: 1 });
  assert.equal(r.body.result, 'defend');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_influence WHERE account = ? AND voided = 1').get(a1.id).n, 60, 'kept, voided');
  const after = (await s.call('/v1/seats/standings', { key: ANTICLERE.key }, sh.gm)).body.standings.find((x) => x.guild.id === eo.gid);
  assert.equal(after?.influence ?? 0, 0, 'counted for nothing');
  const tick = await mintWatchReceipt({ s: a1.id, x: ANTICLERE.pixel[0], y: ANTICLERE.pixel[1], c: 99 }, s.svc.gateKey, { subtle, nowS: s.getNow() });
  const w = (await s.call('/v1/seats/watch', { character: a1.character, receipts: [tick] }, a1)).body;
  assert.deepEqual([w.counted, w.why], [0, { capped: 1 }], 'the day\'s 60 spent all the same');
});

// ─── S10 ─────────────────────────────────────────────────────────────

test('AUDIT-SEATS S10: the holder\'s window moves in the Muster alone (5.1); a guild\'s heraldry changes in no week it fights a battle for a seat (8.1) - its first choice free all the same, and a battle its Turning voided no battle (mutants: the phase; the week\'s battle; the void; the write\'s own ask)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  const win = () => s.call('/v1/seats/window', { character: sh.gm.character, key: ANTICLERE.key, day: 2, hour: 22 }, sh.gm);
  s.setNow(turning(W) - 3600);   // Sunday 17:00: the Reckoning
  const locked = await win();
  assert.deepEqual([locked.status, locked.body.error], [409, 'window-reckoning']);
  assert.equal(accountRefusalText('window-reckoning'), SIGN_WHY['window-reckoning']);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_windows').get().n, 0);
  s.setNow(T0);   // Friday morning: the Muster
  assert.equal((await win()).status, 200);
  // heraldry: the Hand the defender of this week's siege
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(W, ANTICLERE.key, eo.gid, sh.gid, T0 + DAY, T0 + DAY + 1800, T0);
  const set = (who, heraldry, rid) => s.svc.call('/v1/guilds/heraldry', { character: who.character, heraldry, ...(rid ? { rid } : {}) }, who.secret);
  const wolf = { field: 'azure', border: 'gold', device: 'wolf' };
  assert.equal((await set(sh.gm, wolf)).status, 200, 'the first choice is no change - free, and stands');
  s.treasury(sh.gid, 2000);
  const bear = { ...wolf, device: 'bear' };
  const refused = await set(sh.gm, bear, 'herald-01');
  assert.deepEqual([refused.status, refused.body.error], [409, 'heraldry-siege']);
  assert.equal((await set(sh.gm, bear)).body.error, 'heraldry-siege', 'said before the Drakes are asked for');
  assert.equal(accountRefusalText('heraldry-siege'), SIEGE_WHY['heraldry-siege']);
  assert.equal(s.purse(sh.gid), 2000, 'nothing burnt');
  // the attacker the same
  const eoFirst = await set(eo.gm, wolf);
  assert.equal(eoFirst.status, 200);
  s.treasury(eo.gid, 2000);
  assert.equal((await set(eo.gm, bear, 'herald-02')).body.error, 'heraldry-siege');
  // a battle its Turning voided is none: the change made
  s.raw.prepare("UPDATE town_seat_battles SET state = 'void' WHERE week = ? AND key = ?").run(W, ANTICLERE.key);
  const made = await set(sh.gm, bear, 'herald-03');
  assert.equal(made.status, 200, JSON.stringify(made.body));
  // a battle placed between the read and the write: the write asks too
  s.raw.prepare("UPDATE town_seat_battles SET state = 'scheduled' WHERE week = ? AND key = ?").run(W, ANTICLERE.key);
  const db = s.svc.env.DB, prepare = db.prepare;
  db.prepare = (sql) => (/^SELECT 1 FROM town_seat_battles WHERE week = \? AND \(attacker = \? OR defender = \?\)/.test(sql) && !db._once
    ? (db._once = true, prepare(`${sql} AND 0`)) : prepare(sql));
  const raced = await set(sh.gm, wolf, 'herald-04');
  db.prepare = prepare;
  assert.deepEqual([raced.status, raced.body.error], [409, 'heraldry-siege']);
  assert.equal(s.purse(sh.gid), 2000 - 500, 'the raced change burnt nothing');
});

// ─── S11 ─────────────────────────────────────────────────────────────

test('AUDIT-SEATS S11: the standings are summed in SQL - one row an account a source a day, never one a Watch tick - and read the same; the Turning\'s Tithe walks the ledger by its days\' index; influence and Renown rows older than four weeks are pruned at the Turning (mutants: the GROUP BY; the gate count; the day bound; the prune\'s weeks)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const m = await s.member(sh, 'Mira');
  s.pledge(sh.gid, ANTICLERE);
  const day = utcDay(T0);
  const row = (source, amount, d, ref, region = ANTICLERE.region) => s.raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(W, ANTICLERE.key, sh.gid, m.id, m.character, source, amount, region, d, ref, T0);
  for (let i = 0; i < 50; i++) row('watch', 1, day, `a${i}`);
  for (let i = 0; i < 40; i++) row('watch', 1, day - 1, `b${i}`);
  // a gate day the claims agree on, the account's kill there
  const gd = gameDayAt(T0 * 1000);
  for (const who of [await s.svc.seated('Gatewit1'), await s.svc.seated('Gatewit2'), await s.svc.seated('Gatewit3')]) {
    s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'dealt', ?, ?)").run(gd, who.id, T0, ANTICLERE.region);
  }
  row('gate', 300, gd, `g:${gd}`);
  const db = s.svc.env.DB;
  let fetched = null;
  const counting = { ...db, prepare: (sql) => { const st = db.prepare(sql); if (/FROM town_seat_influence/.test(sql)) { const all = st.all; st.all = async () => { const r = await all(); fetched = r.results.length; return r; }; } return st; } };
  const [standing] = await gatherStandings(counting, { ...ANTICLERE }, W, T0);
  assert.equal(fetched, 3, 'one row a day of ticks, one for the gate - never 91');
  assert.equal(standing.total, 50 + 40 + 300, 'read the same');
  // the Tithe's walk: the week's days bound it, so the day index carries it
  const src = readFileSync(new URL('../../server-account/src/seatTurning.js', import.meta.url), 'utf8');
  const tithe = /SELECT dst_id, SUM\(amount\) AS n FROM marks_ledger[\s\S]*?GROUP BY dst_id/.exec(src)?.[0];
  assert.ok(tithe, 'the Tithe\'s query');
  const plan = s.raw.prepare(`EXPLAIN QUERY PLAN ${tithe}`).all().map((p) => p.detail).join(' | ');
  assert.match(plan, /idx_marks_day/, plan);
  // THE PRUNE: at W's Turning, the rows of W-4 and before go; W-3's stay
  assert.equal(INFLUENCE_KEPT_WEEKS, 4);
  for (const week of [W - 5, W - 4, W - 3]) {
    s.raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', 1, ?, 1, ?, ?)`).run(week, ANTICLERE.key, sh.gid, m.id, m.character, ANTICLERE.region, `old${week}`, T0);
    s.raw.prepare('INSERT INTO town_seat_renown (week, account, char_id, region, xp) VALUES (?, ?, ?, ?, 20)').run(week, m.id, m.character, ANTICLERE.region);
  }
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  const weeks = (table) => [...new Set(s.raw.prepare(`SELECT week FROM ${table} WHERE week < ? ORDER BY week`).all(W).map((r) => r.week))];
  assert.deepEqual(weeks('town_seat_influence'), [W - 3]);
  assert.deepEqual(weeks('town_seat_renown'), [W - 3]);
  assert.ok(s.raw.prepare('SELECT 1 FROM town_seat_influence WHERE week = ?').get(W), 'the week settled kept');
});

// ─── T1 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS T1: THE THRONE REACHED - a siege held after the attackers reached the Throne gives the holder +15 less 5 (7.3, Appendix B), still only where a banner was raised; the Chronicle keeps it - "The Throne was never reached." where it was not (9.2) (mutants: the -5; the receipt\'s th; the row\'s throne; the words)', async (t) => {
  assert.deepEqual([siegeAftermath('siege', 'defend', 1, { throne: true }).standing, siegeAftermath('siege', 'defend', 1).standing, siegeAftermath('siege', 'defend', 0, { throne: true }).standing], [10, 15, 0]);
  const s = await stood(t);
  const { sh, eo, d1 } = await siegeWeek(s);
  s.setNow(START + 1800);
  const rc = await s.receipt(d1, { s: d1.id, sd: 'defend', r: 'defend', a: 1, th: 1 });
  const v = await verifySiegeReceipt(rc, await subtle.importKey('raw', Buffer.from(s.svc.env.GATE_PUBLIC_KEY, 'base64url'), { name: 'Ed25519' }, true, ['verify']), { subtle, nowS: s.getNow() });
  assert.equal(v.claims?.th, 1, 'the receipt carries th');
  const st0 = s.holdOf().standing;
  const r = await s.call('/v1/seats/siege/claim', { receipt: rc, character: d1.character }, d1);
  assert.equal(r.body.result, 'defend');
  assert.equal(s.holdOf().standing - st0, 10, 'held after the Throne was reached: +10');
  const reached = s.history('siege-held')[0];
  assert.equal(reached.data.throne, 1);
  assert.equal(chronicleLine(reached, ANTICLERE), `In week ${W + 1}, the Silver Hand <SH> held Anticlere against the siege of Ebon Oath <EO>, though its Throne was reached.`);
  // the next, the Throne never reached (th absent: 0)
  s.raw.prepare(`INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at)
    VALUES (?, ?, 'siege', 'palace', ?, ?, ?, ?, 0, 'scheduled', ?)`).run(W + 2, ANTICLERE.key, eo.gid, sh.gid, START + 7 * DAY, START + 7 * DAY + 1800, T0);
  const st1 = s.holdOf().standing;
  const plain = await mintSiege({ s: d1.id, sk: ANTICLERE.key, sw: W + 2, sd: 'defend', r: 'defend', a: 1, h: 0 }, s.svc.gateKey, s.getNow());
  assert.equal((await s.call('/v1/seats/siege/claim', { receipt: plain, character: d1.character }, d1)).body.result, 'defend');
  assert.equal(s.holdOf().standing - st1, 15, 'never reached: +15');
  const never = s.history('siege-held')[1];
  assert.equal(never.data.throne, 0);
  assert.equal(chronicleLine(never, ANTICLERE), `In week ${W + 2}, the Silver Hand <SH> held Anticlere against the siege of Ebon Oath <EO>. The Throne was never reached.`);
  // a row from before T1 keeps no Throne, and says neither
  assert.equal(chronicleLine({ kind: 'siege-held', week: W, data: { guild: { name: 'The Silver Hand', tag: 'SH' }, against: { name: 'Ebon Oath', tag: 'EO' } } }, ANTICLERE),
    `In week ${W}, the Silver Hand <SH> held Anticlere against the siege of Ebon Oath <EO>.`);
});

// ─── T2 ──────────────────────────────────────────────────────────────

test('AUDIT-SEATS T2: a DISPUTED seat goes on the developers\' audit at once (3.2), however many agree on what it stands as; a seat confirmed by four and never disputed stays off it (mutants: the disputed arm)', async (t) => {
  const s = await stood(t);
  const dev = await s.svc.seated('Devra');
  const four = [await s.svc.guest(), await s.svc.guest(), await s.svc.guest(), await s.svc.guest()];
  const SEAT = { key: 4040, name: 'Glenmoril', region: 40, tier: 'palace', pixel: [600, 300] };
  const wit = (who, seat, at) => s.raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(SEAT.key), who.id, seatReportText(seat), seat.region, at);
  four.forEach((w, i) => wit(w, SEAT, T0 - DAY + i));
  const audit = async () => (await s.call('/v1/seats/list', {}, dev)).body.audit;
  assert.equal((await audit()).includes(SEAT.key), false, 'four agree, nobody disputes: off the audit');
  const other = { ...SEAT, pixel: [601, 300] };
  wit(await s.svc.guest(), other, T0 - 100); wit(await s.svc.guest(), other, T0 - 50);
  const list = (await s.call('/v1/seats/list', {}, dev)).body;
  assert.equal(list.seats.find((x) => x.key === SEAT.key)?.state, 'disputed', 'disputed - it keeps every effect it had');
  assert.equal(list.audit.includes(SEAT.key), true, 'on the audit at once');
});

// ─── the law's half of S3 ────────────────────────────────────────────

test('AUDIT-SEATS S3 (the law): a carried Right is granted before every candidate - the challenger\'s one, the seat\'s one - and only where the holder keeps its Charter (mutants: the carried pass; the keeps)', () => {
  const holder = (guild, o = {}) => ({ guild, standing: 50, truceWeek: null, tithe: 6, owed: 0, watched: true, ...o });
  const seats = [
    { key: 1, tier: 'palace', holder: holder('H1'), carried: { guild: 'C', total: 7000, defence: 400 }, guilds: [{ guild: 'X', influence: 9000, legacy: 0, pledgedAt: 1 }] },
    { key: 2, tier: 'palace', holder: holder('H2'), guilds: [{ guild: 'C', influence: 9000, legacy: 0, pledgedAt: 1 }] },
    { key: 3, tier: 'palace', holder: holder('H3', { owed: 2500 }), carried: { guild: 'D', total: 7000, defence: 0 }, guilds: [] },
  ];
  const plan = turningPlan({ week: 5, seats, treasuries: new Map([['H1', 10000], ['H2', 10000], ['H3', 0]]) });
  assert.deepEqual(plan.rights, [{ key: 1, guild: 'C', total: 7000, defence: 400, carried: true }], 'the Circle\'s carried one; X none at seat 1, C none at seat 2; a lapsing holder\'s none');
  assert.deepEqual(plan.held.map((h) => h.key), [2], 'seat 2 held unchallenged; seat 1 challenged');
});
