// CHAP4a (2026-10-08, Mac: "Your decision", on "Whats next") - THE SEATS: ranks 8 and 9, each chapter's one Master and
// three officers, placed at its Turning by its Eligible members' Merit over four weeks (bible/11-Multiplayer/
// Chapters-Arc.md sections 3.5 and 6). The law against literals; the Turning through the real service over the real
// migrations; the Roll's answer and its recorded rank; a deleted character's seats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAPTER_SEAT_KINDS, CHAPTER_SEATS, SEAT_RANK, ROLL_BOOK_RANK_MAX, SEAT_TENURE_S, SEAT_ACCOUNT_AGE_S, SEAT_MERIT_WEEKS,
  SEAT_HOLDER_CARRY, ROLL_SEAT_LINE, rollBookRankOf, seatEligibleAt, seatScoreOf, chapterSeatPlan, seatChangesOf, meritWeekOf,
} from '../src/net/npcChapterLaw.js';
import { SIEGE_DEFENCE_BONUS, seatWeekStartMs } from '../src/net/townSeatLaw.js';
import { settleChapterWeek, chapterSeatsOf } from '../server-account/src/npcChapters.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { gameDayAt } from '../src/net/gateLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, ANTICLERE = 21, DAGGERFALL = 17;
const NOW = T0 + 3 * DAY;
const WEEK = meritWeekOf(NOW);
const TURNING = seatWeekStartMs(WEEK + 1) / 1000;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP4a the seats\' numbers: a Master and three officers a chapter, ranks 9 and 8; the book stops at 7; fourteen days in the guild, an account seven days old, four weeks of Merit, a holder\'s 1.2 the seats\' own (mutants: each number)', () => {
  assert.deepEqual([CHAPTER_SEAT_KINDS, CHAPTER_SEATS, SEAT_RANK], [['master', 'officer'], { master: 1, officer: 3 }, { master: 9, officer: 8 }]);
  assert.deepEqual([ROLL_BOOK_RANK_MAX, SEAT_TENURE_S, SEAT_ACCOUNT_AGE_S, SEAT_MERIT_WEEKS, SEAT_HOLDER_CARRY], [7, 14 * DAY, 7 * DAY, 4, 1.2]);
  assert.equal(SEAT_HOLDER_CARRY, SIEGE_DEFENCE_BONUS, 'the seats\' carry, one number');
  assert.equal(ROLL_SEAT_LINE, 80);
});

test('CHAP4a the rank the Roll records: the book\'s, under its reputation\'s, never past 7 (mutants: the cap, the floor)', () => {
  assert.deepEqual([[9, 95], [9, 85], [8, 100], [9, 75], [3, 95], [7, 70], [-1, 50], [NaN, 50], ['8', 90], [9, -10]].map(([r, rep]) => rollBookRankOf(r, rep)),
    [7, 7, 7, 7, 3, 7, 0, 0, 0, 0]);
});

test('CHAP4a Eligible: a member, at the seat\'s line, fourteen days in the guild, its account seven days old - each bound at its edge (mutants: each clause)', () => {
  const at = 10_000_000;
  const ok = { member: 1, rep: 80, joinedAt: at - SEAT_TENURE_S, registeredAt: at - SEAT_ACCOUNT_AGE_S };
  assert.equal(seatEligibleAt(ok, at), true);
  assert.equal(seatEligibleAt({ ...ok, member: true }, at), true);
  for (const [why, row] of [
    ['not a member', { ...ok, member: 0 }], ['under the line', { ...ok, rep: 79 }], ['a day short in the guild', { ...ok, joinedAt: at - SEAT_TENURE_S + 1 }],
    ['an account a second too new', { ...ok, registeredAt: at - SEAT_ACCOUNT_AGE_S + 1 }], ['no account age', { ...ok, registeredAt: null }],
    ['no tenure', { ...ok, joinedAt: null }], ['a member by a string', { ...ok, member: '1' }],
  ]) assert.equal(seatEligibleAt(row, at), false, why);
  assert.equal(seatEligibleAt(null, at), false);
});

test('CHAP4a a candidate\'s standing: tenths of Merit, a holder\'s carried 1.2, whole (mutants: the carry, the scale)', () => {
  assert.deepEqual([[100, true], [100, false], [83, true], [0, true], [-5, false], [NaN, true], [7.9, false]].map(([m, s]) => seatScoreOf(m, s)), [1200, 1000, 996, 0, 0, 0, 70]);
});

const c = (faction, region, char, account, merit, joinedAt = 0) => ({ faction, region, char, account, merit, joinedAt });
const seatsOf = (plan) => plan.map((p) => `${p.faction}|${p.region}|${p.seat}|${p.char}`);

test('CHAP4a the plan: a Master and three officers by Merit, a seat no one has Merit for vacant, ties to the longer tenure and the lower id, a holder\'s 1.2 (mutants: the order, the counts, the carry, the vacancy)', () => {
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'e', 'E', 200), c(41, 21, 'a', 'A', 600), c(41, 21, 'c', 'C', 400), c(41, 21, 'b', 'B', 500), c(41, 21, 'd', 'D', 300)])),
    ['41|21|master|a', '41|21|officer|b', '41|21|officer|c', '41|21|officer|d'], 'the fifth sits nowhere');
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'a', 'A', 600), c(41, 21, 'b', 'B', 0), c(41, 21, 'z', 'Z', -5)])), ['41|21|master|a'], 'no Merit, no seat: the rest vacant');
  assert.deepEqual(chapterSeatPlan([]), []);
  // ties: the longer tenure, then the lower character id
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'b', 'B', 300, 50), c(41, 21, 'a', 'A', 300, 90), c(41, 21, 'c', 'C', 300, 50)])),
    ['41|21|master|b', '41|21|officer|c', '41|21|officer|a']);
  // the holder's 1.2: a sitting officer at 90 stands above a newcomer at 100, and below one at 109
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'new', 'N', 100), c(41, 21, 'old', 'O', 90)], [{ faction: 41, region: 21, char: 'old', seat: 'officer' }])),
    ['41|21|master|old', '41|21|officer|new']);
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'new', 'N', 109), c(41, 21, 'old', 'O', 90)], [{ faction: 41, region: 21, char: 'old', seat: 'officer' }])),
    ['41|21|master|new', '41|21|officer|old']);
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'new', 'N', 100), c(41, 21, 'old', 'O', 90)], [{ faction: 41, region: 17, char: 'old', seat: 'officer' }])),
    ['41|21|master|new', '41|21|officer|old'], 'a seat at another chapter carries nothing here');
  // the chapters by guild then region, Master first; a candidate not a chapter's is none
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'a', 'A', 100), c(40, 21, 'b', 'B', 50), c(41, 17, 'c', 'C', 70), c(99, 21, 'x', 'X', 900), c(41, 999, 'y', 'Y', 900),
    { ...c(41, 21, 'w', 'W', 900), char: 5 }, { ...c(41, 21, 'v', 'V', 900), account: null }])),
  ['40|21|master|b', '41|17|master|c', '41|21|master|a']);
});

test('CHAP4a the plan\'s limits: one seat an account a guild, realm-wide - an alt sits nowhere its account sits; one Master\'s seat a character - its next chapter an officer\'s (mutants: the account, the guild, the Master, the passes)', () => {
  // an account's two characters in one chapter: the first takes the Master's seat, the alt none
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'a1', 'A', 600), c(41, 21, 'a2', 'A', 500), c(41, 21, 'b', 'B', 100)])), ['41|21|master|a1', '41|21|officer|b']);
  // ...and across regions: the account's better chapter of the guild; another guild is free
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'a1', 'A', 600), c(41, 17, 'a2', 'A', 900), c(40, 21, 'a1', 'A', 50)])), ['40|21|master|a1', '41|17|master|a2']);
  // one Master's seat a character: the lower of its two guilds' chapters makes it an officer, the next its Master
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'a', 'A', 600), c(40, 21, 'a', 'A', 500), c(40, 21, 'b', 'B', 100)])),
    ['40|21|master|b', '40|21|officer|a', '41|21|master|a']);
  // the Masters first, realm-wide: a character's lower chapter's Master's seat waits for the pass over every chapter
  assert.deepEqual(seatsOf(chapterSeatPlan([c(41, 21, 'a', 'A', 600), c(41, 21, 'b', 'B', 590), c(40, 21, 'b', 'B', 700)])),
    ['40|21|master|b', '41|21|master|a', '41|21|officer|b'], 'another guild\'s officer\'s seat is free to it');
});

test('CHAP4a what a Turning changed: each character whose seat moved, from and to, by chapter then character; a seat that stands is none (mutants: the filter, the order)', () => {
  const before = [{ faction: 41, region: 21, char: 'a', seat: 'master' }, { faction: 41, region: 21, char: 'b', seat: 'officer' }, { faction: 41, region: 21, char: 'c', seat: 'officer' }];
  const after = [{ faction: 41, region: 21, char: 'b', seat: 'master' }, { faction: 41, region: 21, char: 'c', seat: 'officer' }, { faction: 40, region: 17, char: 'd', seat: 'officer' }];
  assert.deepEqual(seatChangesOf(before, after), [
    { faction: 40, region: 17, char: 'd', from: null, to: 'officer' },
    { faction: 41, region: 21, char: 'a', from: 'master', to: null },
    { faction: 41, region: 21, char: 'b', from: 'officer', to: 'master' },
  ]);
  assert.deepEqual(seatChangesOf(before, before), []);
});

// ── THE TURNING, THROUGH THE SERVICE ────────────────────────────────

/** A service with the Chapters open; `member` makes an Eligible member of `factions` (its reputation `rep`), `joined`
 *  days in the guild, its account `age` days old; `merit` lays a Merit line. */
async function stand(extra = {}) {
  const s = await standService({ CHAPTERS_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  let n = 0;
  const member = async (name, { factions = [41], rep = 85, joined = 15, age = 8 } = {}) => {
    const who = await s.registered(name);
    const R = await seatRealm(s.env, who.secret, name);
    await readRoll({ db: s.env.DB, nowS: NOW }, { id: who.id }, {
      character: R.id, lease: R.lease, seed: { factions: Object.fromEntries(factions.map((f) => [f, rep])), members: factions.map((f) => ({ f, rank: 7 })) },
    });
    raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ?').run(NOW - joined * DAY, R.id);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOW - age * DAY, who.id);
    return { who, R, id: R.id };
  };
  const merit = (m, faction, region, amount, { week = WEEK, source = 'writ', ref = `w:${++n}` } = {}) => raw.prepare(`INSERT INTO npc_chapter_merit
    (week, faction, region, account, char_id, source, amount, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(week, faction, region, m.who.id, m.id, source, amount, ref, NOW);
  const seats = () => raw.prepare('SELECT faction, region, char_id, seat, since, week FROM npc_chapter_seats ORDER BY faction, region, seat, char_id').all().map((r) => ({ ...r }));
  const history = () => raw.prepare('SELECT faction, region, week, kind, char_id, data FROM npc_chapter_history ORDER BY seq').all().map((r) => ({ ...r, data: JSON.parse(r.data) }));
  return { ...s, raw, member, merit, seats, history };
}

test('CHAP4a the Turning places the seats: the Eligible by their Merit over four weeks - never a member under the line, a day short, an account too new, a dead character, one who left; a Chronicle row a seat (mutants: each read, the window, the batch)', async () => {
  const s = await stand();
  const [a, b, c2, d] = [await s.member('Alda'), await s.member('Bren'), await s.member('Cass'), await s.member('Dov')];
  const low = await s.member('Low', { rep: 79 }), fresh = await s.member('Fresh'), young = await s.member('Young');
  const dead = await s.member('Dead'), left = await s.member('Left');
  s.raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ?').run(TURNING - SEAT_TENURE_S + 1, fresh.id);   // a second short at the Turning
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(TURNING - SEAT_ACCOUNT_AGE_S + 1, young.who.id);
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(NOW, dead.id);
  s.raw.prepare('UPDATE npc_roll SET member = 0 WHERE char_id = ?').run(left.id);
  s.merit(a, 41, ANTICLERE, 300);
  s.merit(a, 41, ANTICLERE, 300, { week: WEEK - 3 });
  s.merit(b, 41, ANTICLERE, 500);
  s.merit(c2, 41, ANTICLERE, 400, { week: WEEK - 1 });
  s.merit(d, 41, ANTICLERE, 100);
  s.merit(d, 41, ANTICLERE, 900, { week: WEEK - SEAT_MERIT_WEEKS });   // five weeks ago: outside the window
  for (const m of [low, fresh, young, dead, left]) s.merit(m, 41, ANTICLERE, 900);
  assert.deepEqual(await settleChapterWeek(s.env.DB, WEEK, NOW), { settled: true, chapters: 1 });
  assert.deepEqual(s.seats(), [
    { faction: 41, region: ANTICLERE, char_id: a.id, seat: 'master', since: WEEK, week: WEEK },
    { faction: 41, region: ANTICLERE, char_id: b.id, seat: 'officer', since: WEEK, week: WEEK },
    { faction: 41, region: ANTICLERE, char_id: c2.id, seat: 'officer', since: WEEK, week: WEEK },
    { faction: 41, region: ANTICLERE, char_id: d.id, seat: 'officer', since: WEEK, week: WEEK },
  ].sort((x, y) => (x.seat < y.seat ? -1 : x.seat > y.seat ? 1 : x.char_id < y.char_id ? -1 : 1)));
  assert.deepEqual(s.history().map((h) => [h.char_id, h.kind, h.week, h.data]).sort(), [
    [a.id, 'seat', WEEK, { from: null, to: 'master' }], [b.id, 'seat', WEEK, { from: null, to: 'officer' }],
    [c2.id, 'seat', WEEK, { from: null, to: 'officer' }], [d.id, 'seat', WEEK, { from: null, to: 'officer' }],
  ].sort());
  assert.deepEqual(await chapterSeatsOf(s.env.DB, a.id), [{ f: 41, region: ANTICLERE, seat: 'master', since: WEEK }]);
  assert.deepEqual(await chapterSeatsOf(s.env.DB, low.id), []);
});

test('CHAP4a the next Turning: a holder\'s 1.2 holds its seat against a newcomer\'s more, its since kept through a move; a seat that moved in the Chronicle, one that stood not; Merit out of the window, no seat (mutants: the carry read, the since, the changes)', async () => {
  const s = await stand();
  const a = await s.member('Alda'), b = await s.member('Bren'), c3 = await s.member('Cass');
  s.merit(a, 41, ANTICLERE, 500);
  s.merit(b, 41, ANTICLERE, 400);
  await settleChapterWeek(s.env.DB, WEEK, NOW);
  // a newcomer's 560 passes the Master's 500 - but 500 x 1.2 stands above it
  s.merit(c3, 41, ANTICLERE, 560, { week: WEEK + 1 });
  await settleChapterWeek(s.env.DB, WEEK + 1, NOW + 7 * DAY);
  assert.deepEqual(s.seats().map((r) => [r.char_id, r.seat, r.since, r.week]), [
    [a.id, 'master', WEEK, WEEK + 1], ...[[b.id, 'officer', WEEK, WEEK + 1], [c3.id, 'officer', WEEK + 1, WEEK + 1]].sort((x, y) => (x[0] < y[0] ? -1 : 1)),
  ]);
  assert.deepEqual(s.history().filter((h) => h.week === WEEK + 1).map((h) => [h.char_id, h.data]), [[c3.id, { from: null, to: 'officer' }]], 'the seats that stood wrote nothing');
  // seated, the newcomer's 610 x 1.2 passes the Master's carried 600: the two change places, each its since kept
  s.merit(c3, 41, ANTICLERE, 50, { week: WEEK + 2 });
  await settleChapterWeek(s.env.DB, WEEK + 2, NOW + 14 * DAY);
  assert.deepEqual(s.seats().filter((r) => r.char_id !== b.id).map((r) => [r.char_id, r.seat, r.since]), [[c3.id, 'master', WEEK + 1], [a.id, 'officer', WEEK]]);
  assert.deepEqual(s.history().filter((h) => h.week === WEEK + 2).map((h) => [h.char_id, h.data]).sort(), [[a.id, { from: 'master', to: 'officer' }], [c3.id, { from: 'officer', to: 'master' }]].sort());
  // four weeks on, the first week's Merit leaves the window: its two sit nowhere
  await settleChapterWeek(s.env.DB, WEEK + 3, NOW + 21 * DAY);
  assert.equal(s.history().filter((h) => h.week === WEEK + 3).length, 0);
  await settleChapterWeek(s.env.DB, WEEK + 4, NOW + 28 * DAY);
  assert.deepEqual(s.seats().map((r) => [r.char_id, r.seat]), [[c3.id, 'master']]);
  assert.deepEqual(s.history().filter((h) => h.week === WEEK + 4).map((h) => [h.char_id, h.data]).sort(), [[a.id, { from: 'officer', to: null }], [b.id, { from: 'officer', to: null }]].sort());
});

test('CHAP4a a gate\'s Merit counts toward a seat only where its day\'s claims agree; the developers\' weeks none once the Chapters are everyone\'s (mutants: the agreement, the developers\' floor)', async () => {
  const s = await stand();
  const a = await s.member('Alda'), b = await s.member('Bren');
  const day = gameDayAt(NOW * 1000);
  const wits = [await s.registered('Wit0'), await s.registered('Wit1'), await s.registered('Wit2')];
  for (const w of wits) s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'dealt', ?, ?)").run(day, w.id, NOW, ANTICLERE);
  s.merit(a, 41, DAGGERFALL, 600, { source: 'gate', ref: `gate:${day}` });   // named for Daggerfall; the claims say Anticlere
  s.merit(b, 41, ANTICLERE, 100, { source: 'gate', ref: `gate:${day}` });
  await settleChapterWeek(s.env.DB, WEEK, NOW);
  assert.deepEqual(s.seats().map((r) => [r.region, r.char_id, r.seat]), [[ANTICLERE, b.id, 'master']]);
  // a week settled 'dev', then one 'on': the developers' Merit and seats forgotten
  const t = await stand();
  const x = await t.member('Xan'), y = await t.member('Yeva');
  t.merit(x, 41, ANTICLERE, 600, { week: WEEK - 1 });
  await settleChapterWeek(t.env.DB, WEEK - 1, NOW - 7 * DAY, null, 'dev');
  assert.deepEqual(t.seats().map((r) => r.char_id), [x.id]);
  t.merit(y, 41, ANTICLERE, 50);
  await settleChapterWeek(t.env.DB, WEEK, NOW, null, 'on');
  assert.deepEqual(t.seats().map((r) => [r.char_id, r.seat, r.since]), [[y.id, 'master', WEEK]]);
  assert.deepEqual(t.history().filter((h) => h.week === WEEK).map((h) => [h.char_id, h.data]), [[y.id, { from: null, to: 'master' }]], 'the developers\' seats left no row');
  // ...and a week settled 'dev' after 'dev' counts the developers' weeks as any
  const u = await stand({ CHAPTERS_OPEN: 'dev' });
  const z = await u.member('Zed');
  u.merit(z, 41, ANTICLERE, 600, { week: WEEK - 1 });
  await settleChapterWeek(u.env.DB, WEEK - 1, NOW - 7 * DAY, null, 'dev');
  await settleChapterWeek(u.env.DB, WEEK, NOW, null, 'dev');
  assert.deepEqual(u.seats().map((r) => [r.char_id, r.since]), [[z.id, WEEK - 1]]);
});

test('CHAP4a Eligible at the Turning, not at the read: a tenure that reaches fourteen days by the week\'s end counts (mutants: the clock)', async () => {
  const s = await stand();
  const a = await s.member('Alda');
  s.raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ?').run(TURNING - SEAT_TENURE_S, a.id);
  s.merit(a, 41, ANTICLERE, 100);
  await settleChapterWeek(s.env.DB, WEEK, NOW);
  assert.deepEqual(s.seats().map((r) => r.char_id), [a.id]);
  s.raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ?').run(TURNING + 7 * DAY - SEAT_TENURE_S + 1, a.id);
  await settleChapterWeek(s.env.DB, WEEK + 1, NOW + 7 * DAY);
  assert.deepEqual(s.seats(), []);
});

// ── THE ROLL ────────────────────────────────────────────────────────

test('CHAP4a the Roll records no rank past 7 - a seed\'s, a claim\'s, a claim with no book - and its answer carries the character\'s seats (mutants: the cap at each write, the route)', async () => {
  const s = await stand();
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  const r = await s.call('/v1/chapters/roll', { character: R.id, lease: R.lease, seed: { factions: { 41: 95, 40: 85 }, members: [{ f: 41, rank: 9 }, { f: 40, rank: 8 }] } }, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.roll.members.map((m) => [m.f, m.rank]), [[40, 7], [41, 7]]);
  assert.deepEqual(r.body.roll.seats, []);
  s.raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (41, ?, ?, ?, 'master', ?, ?, ?)").run(ANTICLERE, R.id, who.id, WEEK, WEEK, NOW);
  const k = await s.call('/v1/chapters/claim', { character: R.id, lease: R.lease, rid: 'c4a-claim-000001', deltas: { 41: 1 }, members: [{ f: 41, rank: 9 }, { f: 40, rank: 8 }] }, who.secret);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  assert.deepEqual(k.body.roll.members.map((m) => [m.f, m.rank]), [[40, 7], [41, 7]]);
  assert.deepEqual(k.body.roll.seats, [{ f: 41, region: ANTICLERE, seat: 'master', since: WEEK }]);
  // a rank 9 recorded before CHAP4 is held at 7 by the next claim, book or none
  s.raw.prepare('UPDATE npc_roll SET rank = 9 WHERE char_id = ? AND faction_id = 41').run(R.id);
  const n = await s.call('/v1/chapters/claim', { character: R.id, lease: R.lease, rid: 'c4a-claim-000002', deltas: { 40: 1 }, members: null }, who.secret);
  assert.equal(n.status, 200, JSON.stringify(n.body));
  assert.equal(s.raw.prepare('SELECT rank FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(R.id).rank, 7);
  assert.deepEqual((await s.call('/v1/chapters/roll', { character: R.id, lease: R.lease }, who.secret)).body.roll.seats.map((x) => x.seat), ['master']);
});

test('CHAP4a a deleted character\'s seats go with it; the Chronicle keeps their story (mutants: the delete)', async () => {
  const s = await stand();
  const a = await s.member('Alda');
  s.merit(a, 41, ANTICLERE, 100);
  await settleChapterWeek(s.env.DB, WEEK, NOW);
  assert.equal(s.seats().length, 1);
  const del = await s.call('/v1/realm/delete', { id: a.id }, a.who.secret);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM realm_characters WHERE id = ?').get(a.id).n, 0, 'deleted');
  assert.deepEqual(s.seats(), []);
  assert.equal(s.history().length, 1);
  assert.match(src('server-account/src/realm.js'), /DELETE FROM npc_chapter_seats WHERE account = \? AND char_id = \?'\)\.bind\(playerId, id\),   \/\/ CHAP4a: and its seats \(the Chronicle keeps their story\)/);
  assert.match(src('server-account/src/realm.js'), /DELETE FROM npc_chapter_seats WHERE account = \? AND char_id = \?'\)\.bind\(playerId, id\),   \/\/ CHAP4a: and its seats\n/);
});
