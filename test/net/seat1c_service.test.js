// SEAT1c (2026-09-30, Mac: "Finish the seats"): THE TURNING, AS THE SERVICE KEEPS IT - the week settled the first time a
// seat is read after its boundary, once however many readers race; the Charters claimed (the threshold, the fee burnt, the
// next claimant when the first cannot pay), the Contested seats, the holder's defence and the Rights of Siege (one a guild
// and one a seat, a new Charter in truce), the Legacy carried, a Charter relinquished, and a guild that holds one kept
// from going - driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/11-Multiplayer/Seats-Arc.md 5.2, 16; `06-Systems/Online-Arc.md` SEAT1c.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0, d1, D1_MAX_BOUND } from '../accountDb.mjs';   // SEAT-CAP: the fake refuses what D1 refuses
import { webcrypto } from 'node:crypto';
import { settleWeek, settleDueOnce, SETTLE_LEASE_S } from '../../server-account/src/seatTurning.js';   // SEAT-LEASE: the one settler
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import {
  seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, CLAIM_FEE, STANDING_START, STANDING_UNCHALLENGED,
} from '../../src/net/townSeatLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const NEXT_WEEK = Math.floor(seatWeekStartMs(W + 1) / 1000) + 3 * 3600;   // Sunday 21:00, three hours after the Turning
const AFTER_NEXT = NEXT_WEEK + 7 * DAY;

async function stood() {
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  const confirm = (seat) => { for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY); };
  confirm(ANTICLERE); confirm(ALCAIRE);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const pledge = (gid, seat, week = W, at = T0) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', at);
  /** `amount` influence for `gid` at `seat` in `week`, from fresh accounts bound to it - 2,000 each at most */
  const earn = async (gid, seat, amount, week = W) => {
    while (amount > 0) {
      const a = await svc.guest();
      const n = Math.min(2000, amount);
      raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, n, seat.region, `t:${a.id}`, T0);
      amount -= n;
    }
  };
  const list = async (who) => (await svc.call('/v1/seats/list', {}, who.secret)).body;
  const standings = async (who, seat = ANTICLERE) => (await svc.call('/v1/seats/standings', { key: seat.key, character: who.character }, who.secret)).body;
  const hold = (key) => raw.prepare('SELECT * FROM town_seat_holds WHERE key = ?').get(key) ?? null;
  return { svc, raw, guild, treasury, pledge, earn, list, standings, hold };
}

test('SEAT1c THE TURNING CLAIMS A CHARTER: the first read after the boundary settles the week - 6,000 at an unheld palace seat and 8,000 Drakes take it, the fee burnt, the Charter held from the next week at Standing 50 and in truce, a Chronicle row; a second read settles nothing (mutants: the threshold; the fee; the burn; the hold\'s week; the truce; the key)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, treasury, pledge, earn, list, standings, hold } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  pledge(sh.gid, ANTICLERE);
  treasury(sh.gid, 10000);
  await earn(sh.gid, ANTICLERE, 6000);
  assert.equal((await list(sh.gm)).seats.find((s) => s.key === ANTICLERE.key).holder, null, 'the week still running');
  now = NEXT_WEEK;
  const seats = (await list(sh.gm)).seats;
  const held = seats.find((s) => s.key === ANTICLERE.key).holder;
  assert.deepEqual([held.guild.id, held.guild.tag, held.since, held.standing], [sh.gid, 'SH', W + 1, STANDING_START]);
  assert.equal(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(sh.gid).balance, 10000 - CLAIM_FEE.palace, 'the fee burnt');
  assert.deepEqual({ ...raw.prepare("SELECT src_kind, dst_kind, kind, amount FROM marks_ledger WHERE kind = 'seat-claim'").get() }, { src_kind: 'guild', dst_kind: 'burn', kind: 'seat-claim', amount: CLAIM_FEE.palace });
  assert.equal(hold(ANTICLERE.key).truce_week, W + 1, 'in truce at the next Turning');
  assert.deepEqual(raw.prepare('SELECT week FROM town_seat_weeks ORDER BY week').all().map((r) => r.week), [W - 1, W], 'the week before it too: a service that has settled none starts at the last week');
  await list(sh.gm);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'seat-claim'").get().n, 1, 'settled once');
  const s = await standings(sh.gm);
  assert.equal(s.holder.guild.id, sh.gid);
  assert.match(JSON.stringify(s.chronicle[0]), /"kind":"claim"/);
  assert.equal(s.chronicle[0].data.total, 6000);
  // and the next week the holder counts at its seat with no pledge of its own (SEAT0 4.1) - its guildmaster's Watch
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_pledges WHERE week = ?').get(W + 1).n, 0);
  const tick = await mintWatchReceipt({ s: sh.gm.id, x: ANTICLERE.pixel[0], y: ANTICLERE.pixel[1], c: 7 }, svc.gateKey, { subtle: webcrypto.subtle, nowS: now });
  assert.equal((await svc.call('/v1/seats/watch', { character: sh.gm.character, receipts: [tick] }, sh.gm.secret)).body.counted, 1, 'counted at its own seat, pledged by holding it');
  assert.deepEqual(s.standings.map((x) => [x.guild.id, x.holder]), [[sh.gid, true]], 'the holder stands at its seat, pledged by holding it');
});

test('SEAT1c TWO READERS RACE THE TURNING: settleWeek keyed on the week - one settles, the other finds it settled and writes nothing; the fee burnt once (mutants: the plain INSERT on the key; the early read)', async (t) => {
  t.mock.method(Date, 'now', () => NEXT_WEEK * 1000);
  const { svc, raw, guild, treasury, pledge, earn } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  pledge(sh.gid, ANTICLERE); treasury(sh.gid, 10000);
  await earn(sh.gid, ANTICLERE, 7000);
  const db = svc.env.DB;
  const [a, b] = await Promise.all([settleWeek(db, W, NEXT_WEEK), settleWeek(db, W, NEXT_WEEK)]);
  assert.deepEqual([a.settled, b.settled].sort(), [false, true], 'one of the two');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'seat-claim'").get().n, 1);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_holds').get().n, 1);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM town_seat_history WHERE kind = 'claim'").get().n, 1);
  // and a third, later: the key already there, nothing more
  assert.equal((await settleWeek(db, W, NEXT_WEEK + 60)).settled, false);
  // a week with nothing in it: the key alone decides - one of two racing readers settles it
  const [c, d] = await Promise.all([settleWeek(db, W - 3, NEXT_WEEK), settleWeek(db, W - 3, NEXT_WEEK)]);
  assert.deepEqual([c.settled, d.settled].sort(), [false, true], 'an empty week settled once too');
});

test('SEAT1c CONTESTED, AND THE FEE: two claimants within 10% - nobody takes it, a Tourney is named; a first claimant short of the fee passes the Charter to the next who passed; none who can pay, unheld; a guild below the threshold never contests (mutants: the margin; the fee\'s pass; the threshold)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { raw, guild, treasury, pledge, earn, list } = await stood();
  const a = await guild('Adala', 'The Silver Hand', 'SH');
  const b = await guild('Bodil', 'Ebon Oath', 'EO');
  const c = await guild('Cyril', 'Iron Circle', 'IC');
  // Anticlere: 7,000 against 6,400 - within 10%
  pledge(a.gid, ANTICLERE); pledge(b.gid, ANTICLERE);
  await earn(a.gid, ANTICLERE, 7000); await earn(b.gid, ANTICLERE, 6400);
  // Alcaire Keep: 9,000 (no Drakes) against 6,500 (the Drakes) and 5,000 (below the line)
  pledge(c.gid, ALCAIRE, W, T0 + 5); pledge(a.gid, ALCAIRE);   // the Hand pledged in two regions
  const d = await guild('Dinah', 'Grey Host', 'GH');
  pledge(d.gid, ALCAIRE);
  await earn(c.gid, ALCAIRE, 9000); await earn(d.gid, ALCAIRE, 6500); await earn(a.gid, ALCAIRE, 5000);
  treasury(a.gid, 50000); treasury(d.gid, 8000);
  now = NEXT_WEEK;
  const seats = (await list(a.gm)).seats;
  const anticlere = seats.find((s) => s.key === ANTICLERE.key);
  assert.equal(anticlere.holder, null, 'Contested: nobody takes it');
  assert.deepEqual([anticlere.battle.kind, anticlere.battle.guild.tag, anticlere.battle.against.tag], ['tourney', 'SH', 'EO']);
  const alcaire = seats.find((s) => s.key === ALCAIRE.key);
  assert.equal(alcaire.holder.guild.tag, 'GH', 'the first could not pay; the next who passed did');
  assert.equal(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(d.gid).balance, 0);
  void c;
});

test('SEAT1c THE HOLDER\'S DEFENCE AND THE RIGHTS OF SIEGE: a new Charter\'s truce keeps it from challenge at the next Turning; after it, a challenger past the threshold and the defence wins a Right - one a guild, at its strongest seat, the seat\'s next in line taking another; a seat no Right was granted against is held unchallenged, Standing +5; the holder pledges nowhere else in the region (mutants: the truce; the defence; one a guild; one a seat; the unchallenged Standing; seat-held-here)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, treasury, pledge, earn, list, standings } = await stood();
  const h1 = await guild('Hilda', 'The Silver Hand', 'SH');
  const h2 = await guild('Horst', 'Ebon Oath', 'EO');
  const ch = await guild('Cyril', 'Iron Circle', 'IC');
  const ch2 = await guild('Dinah', 'Grey Host', 'GH');
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);   // the week before is settled already
  // both seats held since week W (claimed at the Turning before) - the Hand's in truce this Turning, the Oath's not
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, 'palace', ?, 50, ?, ?)").run(ANTICLERE.key, h1.gid, 21, W, W, T0 - 7 * DAY);
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, 'palace', ?, 50, ?, ?)").run(ALCAIRE.key, h2.gid, 34, W - 1, W - 1, T0 - 14 * DAY);
  // the holder pledges nowhere else in its region
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, 'palace', ?, 50, NULL, ?)").run(9999, h2.gid, 21, W, T0);
  assert.equal((await svc.call('/v1/seats/pledge', { character: h2.gm.character, key: ANTICLERE.key }, h2.gm.secret)).body.error, 'seat-held-here');
  raw.prepare('DELETE FROM town_seat_holds WHERE key = 9999').run();
  // SEAT1d: each holder pays its week's upkeep, at a Tithe that moves Standing neither way - so the Turning's +5 stands alone
  raw.prepare('UPDATE town_seat_holds SET tithe = 6').run();
  treasury(h1.gid, 2500); treasury(h2.gid, 2500);
  // the Circle beats both holders; the Host beats the Oath alone
  pledge(ch.gid, ANTICLERE); pledge(ch.gid, ALCAIRE); pledge(ch2.gid, ALCAIRE);
  await earn(h1.gid, ANTICLERE, 4000); await earn(h2.gid, ALCAIRE, 5000);
  await earn(ch.gid, ANTICLERE, 9000); await earn(ch.gid, ALCAIRE, 8000); await earn(ch2.gid, ALCAIRE, 7000);
  treasury(ch.gid, 1);
  now = NEXT_WEEK;
  const seats = (await list(ch.gm)).seats;
  assert.equal(seats.find((s) => s.key === ANTICLERE.key).battle, null, 'the Hand\'s Charter in truce: no Right against it');
  const alc = seats.find((s) => s.key === ALCAIRE.key).battle;
  assert.deepEqual([alc.kind, alc.guild.tag, alc.against.tag], ['siege', 'IC', 'EO'], 'the Circle\'s one Right, at its strongest open seat');
  const r = raw.prepare('SELECT total, defence FROM town_seat_rights WHERE key = ?').get(ALCAIRE.key);
  assert.deepEqual([r.total, r.defence], [8000, 5000]);
  assert.equal(raw.prepare('SELECT standing FROM town_seat_holds WHERE key = ?').get(ANTICLERE.key).standing, STANDING_START + STANDING_UNCHALLENGED, 'held unchallenged: +5');
  assert.equal(raw.prepare('SELECT standing FROM town_seat_holds WHERE key = ?').get(ALCAIRE.key).standing, STANDING_START, 'challenged: no rise');
  // the next week: the Circle at both, the Host at the Oath's - the Circle's strongest is Anticlere now; the Host takes Alcaire's
  // PIN MOVED (AUDIT-SEATS): the week's siege at Alcaire comes to an end before its Turning (neither side came) - a siege no
  // result reached is void at its Turning now and its Right carries (S3, 17), which would hold the Circle to Alcaire
  raw.prepare("INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at) VALUES (?, ?, 'absent', 0, 'defend', 'r', ?)").run(W + 1, ALCAIRE.key, NEXT_WEEK);
  raw.prepare("UPDATE town_seat_battles SET state = 'fought' WHERE week = ? AND key = ?").run(W + 1, ALCAIRE.key);
  pledge(ch.gid, ANTICLERE, W + 1); pledge(ch.gid, ALCAIRE, W + 1); pledge(ch2.gid, ALCAIRE, W + 1);
  await earn(h1.gid, ANTICLERE, 4000, W + 1); await earn(h2.gid, ALCAIRE, 5000, W + 1);
  await earn(ch.gid, ANTICLERE, 9500, W + 1); await earn(ch.gid, ALCAIRE, 9000, W + 1); await earn(ch2.gid, ALCAIRE, 7000, W + 1);
  now = AFTER_NEXT;
  const later = (await list(ch.gm)).seats;
  assert.deepEqual([later.find((s) => s.key === ANTICLERE.key).battle.guild.tag, later.find((s) => s.key === ALCAIRE.key).battle.guild.tag], ['IC', 'GH'], 'one a guild: the Circle\'s at its strongest, the Host next in line at the other');
  const s = await standings(ch.gm, ALCAIRE);
  assert.equal(s.defence, 500, 'the defence, a week just begun: the Legacy the holder carried in (10% of its 5,000)');
});

test('SEAT1c THE LEGACY, RELINQUISHED, AND A GUILD THAT HOLDS ONE: 10% of a guild\'s week carries into the next and counts toward its claim; the guildmaster gives a Charter up at its board, a Chronicle row says so; a guild holding a Charter does not go (mutants: the share; the carried claim; the rank; the refusal)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, treasury, pledge, earn, list, standings } = await stood();
  const a = await guild('Adala', 'The Silver Hand', 'SH');
  pledge(a.gid, ANTICLERE);
  await earn(a.gid, ANTICLERE, 5600);   // below the line this week
  now = NEXT_WEEK;
  await list(a.gm);
  assert.equal(raw.prepare('SELECT amount FROM town_seat_legacy WHERE week = ? AND key = ? AND guild_id = ?').get(W + 1, ANTICLERE.key, a.gid).amount, 560);
  pledge(a.gid, ANTICLERE, W + 1);
  const s = await standings(a.gm);
  assert.deepEqual([s.standings[0].influence, s.standings[0].legacy], [560, 560], 'carried, and shown');
  // the next week: 5,500 more and the 560 carried pass the line
  await earn(a.gid, ANTICLERE, 5500, W + 1);
  treasury(a.gid, 9000);
  now = AFTER_NEXT;
  assert.equal((await list(a.gm)).seats.find((x) => x.key === ANTICLERE.key).holder.guild.id, a.gid, 'the Legacy counts toward the claim');
  // the guild cannot go while it holds it
  const off = await svc.registered('Ofelia');
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 1, ?, ?)').run(off.id, off.character, a.gid, 'Ofelia', T0);
  assert.equal((await svc.call('/v1/seats/relinquish', { character: off.character, key: ANTICLERE.key }, off.secret)).body.error, 'guild-rank', 'the guildmaster\'s alone');
  raw.prepare('DELETE FROM guild_members WHERE player = ?').run(off.id);
  const gone = await svc.call('/v1/guilds/leave', { character: a.gm.character, realm: a.gm.at() }, a.gm.secret);
  assert.equal(gone.body.error, 'guild-seat', 'a guild holding a Charter does not go');
  const r = await svc.call('/v1/seats/relinquish', { character: a.gm.character, key: ANTICLERE.key }, a.gm.secret);
  assert.deepEqual(r.body, { ok: true });
  assert.equal((await list(a.gm)).seats.find((x) => x.key === ANTICLERE.key).holder, null, 'unheld at once');
  assert.equal((await standings(a.gm)).chronicle[0].kind, 'relinquish');
  assert.equal((await svc.call('/v1/seats/relinquish', { character: a.gm.character, key: ANTICLERE.key }, a.gm.secret)).body.error, 'seat-not-held');
});

test('SEAT-CAP PAST A HUNDRED GUILDS (from play, 2026-10-11: "charter seats are broken. Time to take a castle and nothing happens"): 120 guilds pledged at one seat - every guild list the standings and the Turning bind is read IN_CHUNK at a time, so the board reads them and the Turning still claims the Charter; D1 refuses a statement of 101 parameters, and so does this fake (mutants: any one list bound whole - the Turning\'s treasuries and names, the standings\' binds, homes, crowns and names)', async (t) => {
  assert.throws(() => d1().prepare('SELECT 1').bind(...Array(D1_MAX_BOUND + 1).fill(1)), /too many SQL variables/, 'the fake binds no more than D1 does');
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { raw, guild, treasury, pledge, earn, standings, hold } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  pledge(sh.gid, ANTICLERE); treasury(sh.gid, 10000);
  await earn(sh.gid, ANTICLERE, 6000);
  for (let i = 0; i < 120; i++) {
    raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES (?, ?, ?, ?, '[]', 1)").run(`gcap${i}`, `Crowd ${i}`, `crowd ${i}`, `C${i}`);
    pledge(`gcap${i}`, ALCAIRE); pledge(`gcap${i}`, ALCAIRE, W + 1);   // and the next week's board as crowded
  }
  const crowd = await standings(sh.gm, ALCAIRE);
  assert.equal(crowd.error, undefined, 'the crowded seat\'s board reads');
  assert.equal(crowd.standings.length, 120);
  now = NEXT_WEEK;
  const s = await standings(sh.gm);
  assert.equal(s.error, undefined, 'the board reads after the Turning');
  assert.equal(s.holder?.guild.id, sh.gid, 'the Turning claimed the Charter');
  assert.equal(hold(ANTICLERE.key)?.guild_id, sh.gid);
  assert.equal((await standings(sh.gm, ALCAIRE)).standings.length, 120);
});

test('SEAT-LEASE ONE SETTLER (from play, 2026-10-11: the service swamped an hour after seat week 2\'s Turning): while another holds the Turning\'s lease a due week is settled by nobody else - a seat read answers the state as it stands, an act is told `seats-settling` (503), the clock\'s settle answers pending; the lease run out, the next read settles and frees it; a settle that throws frees it too (mutants: the lease\'s WHERE; the pending answer; the reads let through; the release)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, treasury, pledge, earn, list, standings, hold } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  pledge(sh.gid, ANTICLERE); treasury(sh.gid, 10000);
  await earn(sh.gid, ANTICLERE, 6000);
  assert.equal((await standings(sh.gm)).holder, null, 'the week still running');   // and the week before settled, by its one settler
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_settling').get().n, 0, 'freed after it');
  now = NEXT_WEEK;
  raw.prepare("INSERT INTO town_seat_settling (id, holder, until) VALUES (1, 'another', ?)").run(now + 30);
  const s = await standings(sh.gm);
  assert.equal(s.error, undefined, 'a read answers while another settles');
  assert.equal(s.holder, null, 'the state as it stands - nobody else settles it');
  assert.ok(Array.isArray((await list(sh.gm)).seats), 'the list answers too');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_weeks WHERE week = ?').get(W).n, 0);
  const act = await svc.call('/v1/seats/pledge', { character: sh.gm.character, key: ALCAIRE.key }, sh.gm.secret);
  assert.deepEqual([act.status, act.body.error], [503, 'seats-settling'], 'an act asks again in a moment');
  assert.deepEqual(await settleDueOnce(svc.env.DB, now), { settled: 0, pending: true }, 'the clock\'s settle waits its turn');
  now += 31;   // the other settler cut off: its lease runs out
  const after = await standings(sh.gm);
  assert.equal(after.holder?.guild.id, sh.gid, 'the next read takes the lease and settles');
  assert.equal(hold(ANTICLERE.key)?.guild_id, sh.gid);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_settling').get().n, 0, 'and frees it');
  // nothing due: the one read it always cost, and no lease written - every seat request asks
  const db = svc.env.DB;
  const asked = [];
  const watched = { ...db, prepare: (sql) => { asked.push(sql); return db.prepare(sql); }, batch: (l) => db.batch(l) };
  assert.deepEqual(await settleDueOnce(watched, now), { settled: 0, pending: false });
  assert.deepEqual(asked, ['SELECT MAX(week) AS w FROM town_seat_weeks'], 'nothing due: no lease asked');
  // a settle that throws frees the lease on its way out
  const broken = { ...db, prepare: (sql) => { if (/FROM town_seat_pledges/.test(sql)) throw new Error('D1_ERROR: boom'); return db.prepare(sql); }, batch: (l) => db.batch(l) };
  await assert.rejects(settleDueOnce(broken, now + 7 * 86400), /boom/);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM town_seat_settling').get().n, 0, 'freed by a settle that threw');
  assert.ok(SETTLE_LEASE_S >= 30 && SETTLE_LEASE_S <= 120, 'a lease longer than a settle, shorter than a stall');
});
