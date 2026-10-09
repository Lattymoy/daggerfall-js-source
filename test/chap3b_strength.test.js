// CHAP3b (2026-10-08, Mac: "Continue", on "Keep going with the arc/slices") - STRENGTH AND THE CHAPTER SHEET: each
// chapter's Strength, 0 to 100 from 50, moved at the week's Turning toward its members' Merit (+ min(10, merit /
// target), -3 a week with none), halfway back toward 50 at a Season's end; its band (Failing, Steady, Thriving,
// Ascendant) halves or adds half again to its hall writs; every chapter's state on the sheet, and the region's on the
// board. bible/11-Multiplayer/Chapters-Arc.md sections 5.2 and 5.3 (CHAP3b).
//
// The law against literals; the Turning over the real migrations (its key, its race, the weeks due, a Season's end);
// the sheet through the real route; the board's writs and lines; the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  STRENGTH_START, STRENGTH_MIN, STRENGTH_MAX, STRENGTH_STEP_MAX, STRENGTH_IDLE, STRENGTH_TARGET, strengthTarget, strengthAfter,
  strengthSeasonEnd, CHAPTER_BANDS, chapterBandOf, hallWritCountIn, hallWritCount, chapterLineOf, meritWeekOf,
} from '../src/net/npcChapterLaw.js';
import { seatWeekStartMs, SEAT_WEEK_MS, seasonEndingAt } from '../src/net/townSeatLaw.js';
import { settleChapterWeek, settleChaptersDue, allChapters, chapterSheet, CHAPTER_WEEKS_MAX, CHAPTER_TURNING_GRACE_S } from '../server-account/src/npcChapters.js';
import { forgetChapters } from '../server-account/src/npcHalls.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP3b Strength\'s numbers: from 50, 0 to 100, ten a week at most, three lost a week with no Merit, sixty Merit a point for each hundred active accounts (mutants: each number, the scale)', () => {
  assert.deepEqual([STRENGTH_START, STRENGTH_MIN, STRENGTH_MAX, STRENGTH_STEP_MAX, STRENGTH_IDLE, STRENGTH_TARGET], [50, 0, 100, 10, 3, 60]);
  assert.deepEqual([0, 1, 100, 101, 250, -5, NaN, '300'].map(strengthTarget), [60, 60, 60, 120, 180, 60, 60, 180]);
});

test('CHAP3b a week\'s Strength: + min(10, merit / target) rounded down, -3 for a week with no Merit at all, inside 0-100; a Season\'s end halfway back toward 50 (mutants: the step, the cap, the idle, the floor, the reset)', () => {
  assert.deepEqual([
    strengthAfter(50, 600, 60), strengthAfter(50, 6000, 60), strengthAfter(50, 59, 60), strengthAfter(50, 0, 60), strengthAfter(50, 125, 60),
    strengthAfter(95, 600, 60), strengthAfter(2, 0, 60), strengthAfter(0, 0, 60), strengthAfter(50, 600, 120), strengthAfter(NaN, 0, 60),
    strengthAfter(50, -10, 60), strengthAfter(50, 1, 0),
  ], [60, 60, 50, 47, 52, 100, 0, 0, 55, 47, 47, 51]);
  assert.deepEqual([50, 51, 49, 100, 0, 75, 25, 99].map(strengthSeasonEnd), [50, 50, 50, 75, 25, 62, 38, 74]);
});

test('CHAP3b the bands: Failing 0-19, Steady 20-69, Thriving 70-89, Ascendant 90-100 - their prices and their writs; half the writs (never none) Failing, half again Thriving (mutants: each floor, each number)', () => {
  assert.deepEqual(CHAPTER_BANDS.map((b) => [b.band, b.name, b.from, b.price, b.writs]), [
    ['failing', 'Failing', 0, 1.25, 0.5], ['steady', 'Steady', 20, 1, 1], ['thriving', 'Thriving', 70, 0.9, 1.5], ['ascendant', 'Ascendant', 90, 0.9, 1.5],
  ]);
  assert.deepEqual([0, 19, 20, 69, 70, 89, 90, 100, null, NaN, '80'].map((s) => chapterBandOf(s).band),
    ['failing', 'failing', 'steady', 'steady', 'thriving', 'thriving', 'ascendant', 'ascendant', 'steady', 'steady', 'steady']);
  assert.deepEqual([[0, 10], [0, 50], [0, 75], [0, 95], [150, 10], [150, 50], [150, 75], [450, 10], [450, 75]].map(([a, s]) => hallWritCountIn(a, s)),
    [1, 2, 3, 3, 2, 4, 6, 5, 15]);
  assert.equal(hallWritCount(450), 10);
  assert.equal(chapterLineOf({ faction: 41, strength: 74 }), 'The chapter of the Fighters Guild here is Thriving (Strength 74)');   // PIN MOVED (AUDIT CHAP4 C4): the chapter the subject
  assert.equal(chapterLineOf({ faction: 368, strength: 12 }), 'The chapter of the Knights of the Dragon here is Failing (Strength 12)');   // PIN MOVED (AUDIT CHAP4 C4)
});

// ── THE TURNING ─────────────────────────────────────────────────────

const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (x) => { _now = x; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `chap3b-${String(++_rid).padStart(6, '0')}`;

/** Confirmed towns of `towns` ([key, region, factions]), the ground of Anticlere witnessed, a member of `members`. */
async function stand({ open = 'on', towns = [[77, ANTICLERE, [41, 108, 368]]], members = [41], extra = {} } = {}) {
  clock(NOON);
  forgetChapters();
  const s = await standService({ CHAPTERS_OPEN: open, PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra,Wit0,Wit1,Wit2,Ground', ...extra });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const wits = [];
  for (let i = 0; i < 3; i++) { const w = await s.registered(`Wit${i}`); age(w, 8); wits.push(w); }
  for (const [key, region, factions] of towns) {
    for (const w of wits) {
      clock(_now + 1);
      assert.equal((await s.call('/v1/chapters/witness', { hall: { key, region, factions } }, w.secret)).status, 200);
    }
  }
  const g = await s.registered('Ground');
  age(g, 8);
  const p = herbPatches({ x: 300, y: 200, day: utcDay(_now), climate: WOODS, confirmed: false })[0];
  assert.equal((await s.call('/v1/prof/harvest', {
    character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
    climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid(),
  }, g.secret)).status, 200);
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 41: 10, 108: 0, 368: 5 }, members: members.map((f) => ({ f, rank: 0 })) } });
  const merit = (week, faction, region, amount, ref = `x:${++_rid}`) => raw.prepare(`INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at)
    VALUES (?, ?, ?, ?, ?, 'raid', ?, ?, ?)`).run(week, faction, region, who.id, R.id, amount, ref, _now);   // PIN MOVED (AUDIT CHAP3 E1): a raid's - a gate's counts only where its day's claims agree
  const strengths = () => raw.prepare('SELECT faction, region, strength, week, merit FROM npc_chapters ORDER BY region, faction').all().map((r) => ({ ...r }));
  const weeks = () => raw.prepare('SELECT week, active, target, chapters FROM npc_chapter_weeks ORDER BY week').all().map((r) => ({ ...r }));
  return { ...s, raw, who, R, merit, strengths, weeks };
}

test('CHAP3b every region\'s chapters at once: the towns confirmed for each region - as each region\'s own read - each region computed once a change (PIN MOVED, AUDIT CHAP3 S3: its row, not the isolate\'s minute) (mutants: the region, the confirmation, the row)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41, 108]], [78, 17, [368]], [79, ANTICLERE, [40, 41]]] });
  const row = s.raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('npchall', ?, ?, ?, ?, ?)");
  row.run('1:90', s.who.id, '[90,21,[42]]', ANTICLERE, _now);   // one account's word: unconfirmed
  row.run('1:78', s.who.id, '[78,21,[368]]', ANTICLERE, _now - 5);   // an early word for this region, three confirmed for Daggerfall
  assert.deepEqual(await allChapters(s.env.DB, _now), [{ faction: 368, region: 17 }, { faction: 40, region: 21 }, { faction: 41, region: 21 }, { faction: 108, region: 21 }]);
  // a region whose answer stands is its row - no report read
  let reads = 0;
  const spy = { prepare: (sql) => { if (/FROM world_witness/.test(sql)) reads++; return s.env.DB.prepare(sql); }, batch: (l) => s.env.DB.batch(l) };
  assert.equal((await allChapters(spy, _now + 30)).length, 4);
  assert.equal(reads, 0, 'computed once, read as its row after');
  // a strike tells every region its town's reports named: Daggerfall's, and Anticlere's (the early word)
  const dev = await s.registered('Devra');
  assert.equal((await s.call('/v1/chapters/strike', { key: 78 }, dev.secret)).status, 200);
  assert.deepEqual((await allChapters(spy, _now + 60)).map((c) => c.region), [21, 21, 21], 'computed again once told');
  assert.ok(reads > 0);
});

test('CHAP3b a week settled: each chapter moved by its week\'s Merit against the week\'s scale, an idle one down three, a chapter with Merit and no town still counted; written once - a second settle of the week changes nothing (mutants: the key, the merit\'s week, the scale, the union)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41, 108, 368]]] });
  const week = meritWeekOf(_now) - 1;
  s.raw.prepare('UPDATE players SET played_at = ?').run(_now);
  s.raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, played_at) VALUES (?, NULL, NULL, ?, ?, ?, ?)').run('p-guest', 'GuestOnly', _now, _now, _now);
  const handled = s.raw.prepare('SELECT COUNT(*) AS n FROM players WHERE handle IS NOT NULL').get().n;
  s.merit(week, 41, ANTICLERE, 600);
  s.merit(week, 41, ANTICLERE, 150);
  s.merit(week, 108, ANTICLERE, 100);
  s.merit(week, 40, 17, 300);   // a chapter of Daggerfall's whose town is no longer confirmed
  s.merit(week + 1, 368, ANTICLERE, 600);   // this week's: no part of last week's Turning
  assert.deepEqual(await settleChapterWeek(s.env.DB, week, _now), { settled: true, chapters: 4 });
  assert.deepEqual(s.strengths(), [
    { faction: 40, region: 17, strength: 55, week, merit: 300 },
    { faction: 41, region: 21, strength: 60, week, merit: 750 }, { faction: 108, region: 21, strength: 51, week, merit: 100 },
    { faction: 368, region: 21, strength: 47, week, merit: 0 },
  ]);
  const [w] = s.weeks();
  assert.deepEqual([w.week, w.active, w.target, w.chapters], [week, handled, 60, 4], 'every registered account that played, never a guest');
  assert.ok(handled >= 5);
  assert.deepEqual(await settleChapterWeek(s.env.DB, week, _now), { settled: false }, 'the week\'s own key');
  assert.equal(s.strengths()[1].strength, 60, 'never twice');
  // the next week starts from the last: Strength carried, an idle chapter down again
  assert.deepEqual(await settleChapterWeek(s.env.DB, week + 1, _now), { settled: true, chapters: 4 });
  assert.deepEqual(s.strengths().map((r) => [r.faction, r.strength]), [[40, 52], [41, 57], [108, 48], [368, 57]]);
});

test('CHAP3b the week\'s scale: the target grows with the accounts that played - sixty Merit a point for each hundred (mutants: the count)', async () => {
  const s = await stand();
  const week = meritWeekOf(_now) - 1;
  s.raw.prepare('UPDATE players SET played_at = ?').run(seatWeekStartMs(week) / 1000 + 3600);
  const add = s.raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, played_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < 120; i++) add.run(`p-scale-${i}`, `Scale${i}`, `scale${i}`, `Guest${i}`, _now, _now, seatWeekStartMs(week) / 1000 + 7200);
  add.run('p-guest', null, null, 'GuestOnly', _now, _now, seatWeekStartMs(week) / 1000 + 7200);   // a guest: no part of the scale
  s.merit(week, 41, ANTICLERE, 600);
  await settleChapterWeek(s.env.DB, week, _now);
  const [w] = s.weeks();
  assert.ok(w.active > 100 && w.active <= 200, String(w.active));
  assert.equal(w.target, 120);
  assert.equal(s.strengths().find((r) => r.faction === 41).strength, 55);
  // an account that last played before the week is no part of its scale
  s.raw.prepare('UPDATE players SET played_at = ?').run(seatWeekStartMs(week) / 1000 - 3600);
  await settleChapterWeek(s.env.DB, week + 1, _now);
  assert.equal(s.weeks()[1].active, 0);
});

test('CHAP3b the Turnings due: every week before this one not yet settled, oldest first, from the last settled - the last week alone on a service that settled none, never more than eight back; a week that fails stops the count (mutants: the start, the cap, the order)', async () => {
  const s = await stand();
  const now = meritWeekOf(_now);
  assert.equal(await settleChaptersDue(s.env.DB, _now), 1);
  assert.deepEqual(s.weeks().map((w) => w.week), [now - 1]);
  assert.equal(await settleChaptersDue(s.env.DB, _now), 0, 'nothing due');
  // three weeks later: the three since, in order, each from the last
  const later = _now + 3 * SEAT_WEEK_MS / 1000;
  assert.equal(await settleChaptersDue(s.env.DB, later), 3);
  assert.deepEqual(s.weeks().map((w) => w.week), [now - 1, now, now + 1, now + 2]);
  assert.deepEqual(s.strengths().map((r) => r.strength), [38, 38, 38], 'four idle weeks: 50 less twelve');
  // asleep for twenty weeks: eight settled, from twenty-less-eight
  const asleep = later + 20 * SEAT_WEEK_MS / 1000;
  assert.equal(CHAPTER_WEEKS_MAX, 8);
  assert.equal(await settleChaptersDue(s.env.DB, asleep), 8);
  assert.equal(s.weeks().at(-1).week, meritWeekOf(asleep) - 1);
  assert.equal(s.weeks()[4].week, meritWeekOf(asleep) - 8);
  // a week whose write fails is the next read's first - never one left behind under a later week
  const t = await stand();
  await settleChaptersDue(t.env.DB, _now);
  let once = true;
  const flaky = { prepare: (sql) => t.env.DB.prepare(sql), batch: async (list) => { if (once) { once = false; throw new Error('D1 down'); } return t.env.DB.batch(list); } };
  assert.equal(await settleChaptersDue(flaky, _now + 3 * SEAT_WEEK_MS / 1000), 0);
  assert.deepEqual(t.weeks().map((w) => w.week), [now - 1], 'the count stops at the week that failed');
  assert.equal(await settleChaptersDue(t.env.DB, _now + 3 * SEAT_WEEK_MS / 1000), 3);
  assert.deepEqual(t.weeks().map((w) => w.week), [now - 1, now, now + 1, now + 2]);
});

test('CHAP3b a Season\'s end: its last week\'s Turning moves every chapter halfway back toward 50 after the week\'s own step (mutants: the reset unread, read before the step)', async () => {
  const s = await stand();
  const week = meritWeekOf(_now) - 1;
  // a Season counted so that this week is its last
  let zero = null;
  for (let z = week - 40; z <= week; z++) if (seasonEndingAt(week, z)) { zero = z; break; }
  assert.notEqual(zero, null);
  s.raw.prepare("INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (41, 21, 90, 0, 0, 0), (368, 21, 10, 0, 0, 0)").run();
  s.merit(week, 41, ANTICLERE, 600);
  await settleChapterWeek(s.env.DB, week, _now, zero);
  assert.deepEqual(s.strengths().filter((r) => r.faction !== 108).map((r) => [r.faction, r.strength]), [[41, 75], [368, 29]], '100 to 75; 7 to 29');
  assert.equal(s.strengths().find((r) => r.faction === 108).strength, 49, 'a new chapter: 47, then halfway back');
  await settleChapterWeek(s.env.DB, week + 1, _now, zero);
  assert.equal(s.strengths().find((r) => r.faction === 41).strength, 72, 'no Season ends there');
});

// ── THE SHEET AND THE BOARD ─────────────────────────────────────────

test('CHAP3b the sheet: every chapter confirmed now, its Strength and band, after the Turnings due - never the underworld\'s two; the Chapters\' switch (mutants: the settle, the hidden two, the switch)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41, 42, 108, 368]], [78, 17, [40]]] });
  const week = meritWeekOf(_now) - 1;
  s.merit(week, 41, ANTICLERE, 6000);
  const r = await s.call('/v1/chapters/list', {}, s.who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { week: week + 1, chapters: [
    { f: 40, region: 17, strength: 47, band: 'steady', seats: [] },
    { f: 41, region: 21, strength: 60, band: 'steady', seats: [] }, { f: 368, region: 21, strength: 47, band: 'steady', seats: [] },
  ] });   // PIN MOVED (CHAP5a): and each chapter's seats' holders - none here
  s.raw.prepare('UPDATE npc_chapters SET strength = 91 WHERE faction = 41').run();
  s.raw.prepare('DELETE FROM npc_chapters WHERE faction = 368').run();   // a chapter no Turning has settled yet
  assert.deepEqual((await s.call('/v1/chapters/list', {}, s.who.secret)).body.chapters.slice(1), [
    { f: 41, region: 21, strength: 91, band: 'ascendant', seats: [] }, { f: 368, region: 21, strength: 50, band: 'steady', seats: [] },
  ]);   // PIN MOVED (CHAP5a): the seats
  assert.deepEqual(await chapterSheet({ db: s.env.DB, nowS: _now }, { id: s.who.id }, { CHAPTERS_OPEN: 'off' }), { error: 'chapters-closed' }, 'the module\'s own door');
  const shut = await stand({ open: 'dev' });
  const r2 = await shut.call('/v1/chapters/list', {}, shut.who.secret);
  assert.deepEqual([r2.status, r2.body.error], [403, 'chapters-closed']);
  assert.deepEqual(shut.weeks(), [], 'no Turning for a reader the switch keeps out');
});

test('CHAP3b the board: a chapter\'s hall writs by its band - one Failing, three Thriving; the region\'s chapters\' state, the underworld\'s to its members alone (mutants: the band unread, the lines, the hidden rule)', async () => {
  const s = await stand({ towns: [[77, ANTICLERE, [41, 108, 368]]], members: [41] });
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, at) VALUES (?, 0, 60, 0, 0)").run(meritWeekOf(_now) - 1);   // nothing due
  s.raw.prepare("INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (41, 21, 75, 0, 0, 0), (108, 21, 10, 0, 0, 0)").run();
  const l = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  const posted = (f) => s.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'hall' AND faction = ?").get(f).n;
  assert.deepEqual([41, 108, 368].map(posted), [3, 1, 2], 'Thriving, Failing, and a chapter no Turning has settled');
  assert.deepEqual(l.chapters, [{ faction: 41, strength: 75, band: 'thriving', focus: null }, { faction: 368, strength: 50, band: 'steady', focus: null }], 'the Brotherhood\'s to its members alone');   // PIN MOVED (CHAP4d): and each chapter's Focus this week
  // a Turning passed after the day's writs were written down: the lines read it
  const turning = seatWeekStartMs(meritWeekOf(_now) + 1) / 1000;
  const past = turning + CHAPTER_TURNING_GRACE_S + 60;   // PIN MOVED (AUDIT CHAP3 S1): a week settles its grace after its boundary
  assert.equal(utcDay(turning - 60), utcDay(past), 'the Turning falls inside a UTC day');
  clock(turning - 60);
  await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret);
  s.merit(meritWeekOf(_now), 41, ANTICLERE, 600);
  clock(past);
  const after = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  assert.deepEqual(after.chapters[0], { faction: 41, strength: 85, band: 'thriving', focus: null }, 'settled on the read, not the next day\'s writs');   // PIN MOVED (CHAP4d): and its Focus
  // the Chapters shut to the reader: no lines - and the day's hall writs still by the band the week's Turning left
  const shut = await stand({ open: 'dev', towns: [[77, ANTICLERE, [41]]] });
  shut.raw.prepare("INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (41, 21, 65, 0, 0, 0)").run();
  shut.merit(meritWeekOf(_now) - 1, 41, ANTICLERE, 600);
  const sl = (await shut.call('/v1/writs/list', { character: shut.R.id, region: ANTICLERE }, shut.who.secret)).body;
  assert.deepEqual(sl.chapters, []);
  assert.equal(shut.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'hall' AND faction = 41").get().n, 3, 'Thriving at 75, the Turning settled before the writs');
  const db = await stand({ towns: [[77, ANTICLERE, [41, 108]]], members: [108] });
  const m = (await db.call('/v1/writs/list', { character: db.R.id, region: ANTICLERE }, db.who.secret)).body;
  assert.deepEqual(m.chapters.map((c) => c.faction), [41, 108], 'a member of the Brotherhood reads its chapter');
});

test('CHAP3b the wiring: the sheet\'s route, the client\'s door, the board\'s chapter lines; the Chapters\' tables; the version note (mutants: the route, the door, the lines)', () => {
  assert.match(src('server-account/src/service.js'), /'\/v1\/chapters\/list'/);
  assert.match(src('server-account/src/index.js'), /path === '\/v1\/chapters\/list' \? await chapterSheet\(ctx, who\.player, env\)/);
  assert.match(src('src/net/accountClient.js'), /list: \(\) => post\('\/v1\/chapters\/list', \{\}\),/);
  assert.match(src('src/ui/noticeWindow.js'), /for \(const c of writs\?\.chapters \?\? \[\]\) \{\n\s+body\.append\(el\('p', 'notice-chapter', chapterLineOf\(c\)\)\);/);   // PIN MOVED (CHAP4d): the line, then its Focus
  const mig = src('server-account/migrations/0100_npc_chapters.sql');
  assert.match(mig, /week\s+INTEGER PRIMARY KEY/);
  assert.match(mig, /strength\s+INTEGER NOT NULL CHECK \(strength BETWEEN 0 AND 100\)/);
  assert.match(mig, /PRIMARY KEY \(faction, region\)/);
  assert.match(src('server-account/src/service.js'), /CHAP3b \(Mac: "Continue"; migration 0100_npc_chapters/);
});
