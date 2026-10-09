// AUDIT CHAP4 (2026-10-09, Mac: "Lets do a deep audit on everything so far"): the Chapters arc read again, end to end,
// through six lenses (bible/01-Overview/Audit-Chapters-4.md). Each fix pinned here by its finding's id; the lens T's
// pins - laws no test could fail - after them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import {
  meritWeekOf, seatScoreOf, chapterSeatPlan, seatChangesOf, rollMembersOf, rollMembersOk, rollMembersKey, chapterLineOf,
  HIDDEN_HALL_FACTIONS, hallHidden, ROLL_SEATS_MS, MERIT_CAP_WEEK, SEAT_MERIT_WEEKS, rollBookCap,
} from '../src/net/npcChapterLaw.js';
import { seatWeekStartMs, seasonOf, SEASON_WEEKS } from '../src/net/townSeatLaw.js';
import {
  settleChapterWeek, settleChaptersDue, chapterTitlesOfAccount, chapterChronicle, masterSeatsIn, setChapterFocus, chapterSeatsOf, chapterSheet,
  CHAPTER_TURNING_GRACE_S, CHAPTER_CHRONICLE_ROWS,
} from '../server-account/src/npcChapters.js';
import { readRoll, claimRoll } from '../server-account/src/npcRoll.js';
import { createRollTracker, rollVampireOf } from '../src/net/npcRollTracker.js';
import { chapterFactionOf } from '../src/net/npcHallBook.js';
import { createChapterSheet, SHEET_KEPT_MS } from '../src/net/chapterSheet.js';
import { chapterRollTokens } from '../src/ui/chapterRoll.js';
import { hallOfRecordsTokens } from '../src/ui/hallOfRecords.js';
import { RSC } from '../src/formats/textRsc.js';
import { CHAPTER_NEWS } from '../src/systems/livingWorld/lines.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { guildHallOf, FIGHTERS_GUILD, MAGES_GUILD, DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { standService, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40, THIEVES = 42;
const NOW = T0 + 3 * DAY;
const WEEK = meritWeekOf(NOW);
const tick = () => new Promise((r) => setImmediate(r));

/** A service with the Chapters on, Anticlere and Daggerfall's chapters confirmed; members with realm characters (seeded
 *  at 85, joined fifteen days ago, accounts eight days old); Merit laid by hand; the seats and the Chronicle read raw. */
async function stand(extra = {}) {
  const s = await standService({ CHAPTERS_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  confirmChapters(raw, [ANTICLERE, DAGGERFALL], [MAGES, FIGHTERS, THIEVES]);
  let n = 0;
  const member = async (name, { factions = [FIGHTERS], members = null } = {}) => {
    const who = await s.registered(name);
    const R = await seatRealm(s.env, who.secret, name);
    await readRoll({ db: s.env.DB, nowS: NOW }, { id: who.id }, {
      character: R.id, lease: R.lease, seed: { factions: Object.fromEntries(factions.map((f) => [f, 85])), members: members ?? factions.map((f) => ({ f, rank: 7 })) },
    });
    raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ?').run(NOW - 15 * DAY, R.id);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOW - 8 * DAY, who.id);
    return { who, R, id: R.id };
  };
  const merit = (m, faction, region, amount, { week = WEEK } = {}) => raw.prepare(`INSERT INTO npc_chapter_merit
    (week, faction, region, account, char_id, source, amount, ref, at) VALUES (?, ?, ?, ?, ?, 'writ', ?, ?, ?)`).run(week, faction, region, m.who.id, m.id, amount, `w:${++n}`, NOW);
  const seats = () => raw.prepare('SELECT faction, region, char_id, seat, week FROM npc_chapter_seats ORDER BY faction, region, seat, char_id').all().map((r) => ({ ...r }));
  const history = () => raw.prepare('SELECT faction, region, week, char_id, data FROM npc_chapter_history ORDER BY seq').all().map((r) => ({ ...r, data: JSON.parse(r.data) }));
  const strength = (f, g) => raw.prepare('SELECT strength FROM npc_chapters WHERE faction = ? AND region = ?').get(f, g)?.strength ?? null;
  const weeks = () => raw.prepare('SELECT week, open FROM npc_chapter_weeks ORDER BY week').all().map((r) => ({ ...r }));
  return { ...s, raw, member, merit, seats, history, strength, weeks };
}
const turnOf = (w) => seatWeekStartMs(w + 1) / 1000 + CHAPTER_TURNING_GRACE_S + 1;   // a moment the week's Turning is due

// ── THE SERVICE ─────────────────────────────────────────────────────

test('AUDIT CHAP4 S1: the Chronicle\'s two readers ask its new indexes - a character\'s rows by week, a region\'s newest - never a scan of every row it ever kept (mutants: either index)', async () => {
  const s = await stand();
  const plan = (sql, ...binds) => s.raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...binds).map((r) => r.detail).join(' | ');
  const titles = plan(`SELECT x.char_id FROM npc_chapter_history x JOIN realm_characters c ON c.id = x.char_id AND c.player = ?1 AND c.dead_at IS NULL
    WHERE (?2 IS NULL OR x.char_id = ?2) AND x.kind = 'seat' AND x.week >= ?3`, 'p', null, 0);
  assert.match(titles, /idx_npc_chapter_history_char/, titles);
  const chronicle = plan('SELECT h.faction FROM npc_chapter_history h WHERE h.region = ?1 ORDER BY h.seq DESC LIMIT 60', ANTICLERE);
  assert.match(chronicle, /idx_npc_chapter_history_region/, chronicle);
});

test('AUDIT CHAP4 S2: the weeks the Chapters are shut are recorded shut and move nothing - reopened, the Turnings start past them: no -3 a week, no seat emptied, no Former Master (mutants: the off weeks unrecorded, the window, the opened)', async () => {
  const s = await stand();
  const a = await s.member('Alda'), b = await s.member('Bren');
  s.merit(a, FIGHTERS, ANTICLERE, 600);
  await settleChapterWeek(s.env.DB, WEEK, turnOf(WEEK));
  const st = s.strength(FIGHTERS, ANTICLERE);
  assert.deepEqual(s.seats().map((r) => [r.char_id, r.seat]), [[a.id, 'master']]);
  // five weeks off: a board read each week records them
  for (let w = WEEK + 1; w <= WEEK + 5; w++) await settleChaptersDue(s.env.DB, turnOf(w), null, 'off');
  assert.deepEqual(s.weeks().filter((r) => r.week > WEEK).map((r) => r.open), ['off', 'off', 'off', 'off', 'off']);
  assert.equal(s.strength(FIGHTERS, ANTICLERE), st, 'nothing moved while shut');
  // on again: the next week settles alone, and its window reaches back past the shut weeks to the holder's Merit
  s.merit(a, FIGHTERS, ANTICLERE, 100, { week: WEEK + 6 });
  s.merit(b, FIGHTERS, ANTICLERE, 300, { week: WEEK + 6 });   // more than Alda's week - less than her four open weeks
  assert.equal(await settleChaptersDue(s.env.DB, turnOf(WEEK + 6), null, 'on'), 1);
  assert.deepEqual(s.seats().map((r) => [r.char_id, r.seat, r.week]), [[a.id, 'master', WEEK + 6], [b.id, 'officer', WEEK + 6]], 'the seat stands');
  assert.equal(s.history().filter((h) => h.data.from === 'master').length, 0, 'no Former Master');
  assert.ok(s.strength(FIGHTERS, ANTICLERE) >= st - 3, `one week's move at most (${st} -> ${s.strength(FIGHTERS, ANTICLERE)})`);
  // a service that never settled a week records nothing shut
  const fresh = await stand();
  await settleChaptersDue(fresh.env.DB, turnOf(WEEK + 3), null, 'off');
  assert.deepEqual(fresh.weeks(), []);
});

test('AUDIT CHAP4 S2: an "off" week is no developers\' week - a week settled "on" after it starts no chapter from 50, and one after the developers\' and a shut gap does (mutants: the opened read)', async () => {
  const d = await stand();
  d.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 1, 'dev', 0)").run(WEEK - 2);
  d.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 0, 0, 'off', 0)").run(WEEK - 1);
  d.raw.prepare('INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (41, 21, 15, ?, 0, 0)').run(WEEK - 2);
  await settleChapterWeek(d.env.DB, WEEK, turnOf(WEEK), null, 'on');
  assert.ok(d.strength(FIGHTERS, ANTICLERE) >= 47, `the developers' 15 forgotten past the shut week (${d.strength(FIGHTERS, ANTICLERE)})`);
  const s = await stand();
  const a = await s.member('Alda');
  s.merit(a, FIGHTERS, ANTICLERE, 600);
  await settleChapterWeek(s.env.DB, WEEK, turnOf(WEEK));
  const st = s.strength(FIGHTERS, ANTICLERE);
  await settleChaptersDue(s.env.DB, turnOf(WEEK + 1), null, 'off');
  s.merit(a, FIGHTERS, ANTICLERE, 600, { week: WEEK + 2 });
  await settleChapterWeek(s.env.DB, WEEK + 2, turnOf(WEEK + 2), null, 'on');
  assert.ok(s.strength(FIGHTERS, ANTICLERE) > st, 'Strength moved on from where it stood, never from 50');
  assert.deepEqual(s.seats().map((r) => r.char_id), [a.id]);
});

test('AUDIT CHAP4 S3: the Chronicle leaves the hidden guilds out before it counts its newest - the underworld\'s moves neither shorten nor show (mutants: the filter after the limit)', async () => {
  const s = await stand();
  const a = await s.member('Alda');
  const row = (f, w) => s.raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'seat', ?, ?, ?)").run(f, ANTICLERE, w, a.id, JSON.stringify({ from: null, to: 'officer' }), NOW);
  for (let i = 0; i < 12; i++) row(FIGHTERS, 10 + i);
  for (let i = 0; i < CHAPTER_CHRONICLE_ROWS; i++) row(THIEVES, 30 + i);
  const r = await chapterChronicle({ db: s.env.DB }, null, s.env, { region: ANTICLERE });
  assert.equal(r.rows.length, 12);
  assert.ok(r.rows.every((x) => x.faction === FIGHTERS));
  assert.deepEqual([...HIDDEN_HALL_FACTIONS], [42, 108]);
  assert.ok(HIDDEN_HALL_FACTIONS.every(hallHidden));
});

test('AUDIT CHAP4 S4: the Focus is set by the Master LAST week\'s Turning placed, after the Turnings due - between the boundary and its Turning the outgoing Master is refused, and the board offers it nothing (mutants: the settle, the seat\'s week)', async () => {
  const s = await stand();
  const a = await s.member('Alda'), b = await s.member('Bren');
  s.merit(a, FIGHTERS, ANTICLERE, 600);
  s.merit(b, FIGHTERS, ANTICLERE, 100);
  await settleChapterWeek(s.env.DB, WEEK, turnOf(WEEK));
  // week WEEK+1: Alda is Master by WEEK's Turning; Bren out-earns her
  s.merit(b, FIGHTERS, ANTICLERE, 600, { week: WEEK + 1 });
  s.merit(b, FIGHTERS, ANTICLERE, 500, { week: WEEK });
  const inGrace = seatWeekStartMs(WEEK + 2) / 1000 + 60;   // a minute into WEEK+2: its Turning (of WEEK+1) not yet due
  const body = (m) => ({ character: m.id, faction: FIGHTERS, region: ANTICLERE, focus: 'wood' });
  assert.deepEqual(await setChapterFocus({ db: s.env.DB, nowS: inGrace }, { id: a.who.id }, s.env, body(a)), { error: 'not-master' }, 'the seats WEEK placed are no seats of WEEK+2');
  assert.deepEqual([...await masterSeatsIn(s.env.DB, a.id, ANTICLERE, meritWeekOf(inGrace))], [], 'nor offered');
  const after = turnOf(WEEK + 1);
  const ok = await setChapterFocus({ db: s.env.DB, nowS: after }, { id: b.who.id }, s.env, body(b));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.deepEqual(await setChapterFocus({ db: s.env.DB, nowS: after }, { id: a.who.id }, s.env, body(a)), { error: 'not-master' });
  assert.deepEqual([...await masterSeatsIn(s.env.DB, b.id, ANTICLERE, meritWeekOf(after))], [FIGHTERS]);
});

test('AUDIT CHAP4 S5: a character deleted while its Turning was in flight is never seated again, nor said to take a seat - one that lost its seat is (mutants: the seats\' guard, the Chronicle\'s)', async () => {
  const s = await stand();
  const a = await s.member('Alda'), b = await s.member('Bren');
  s.merit(a, FIGHTERS, ANTICLERE, 600);
  s.merit(b, FIGHTERS, ANTICLERE, 100);
  // the delete lands between the plan's reads and the batch
  const db = s.env.DB;
  const racing = { prepare: (...a2) => db.prepare(...a2), batch: async (list) => { s.raw.prepare('DELETE FROM realm_characters WHERE id = ?').run(a.id); return db.batch(list); } };
  await settleChapterWeek(racing, WEEK, turnOf(WEEK));
  assert.deepEqual(s.seats().map((r) => [r.char_id, r.seat]), [[b.id, 'officer']]);
  assert.deepEqual(s.history().map((h) => [h.char_id, h.data.to]), [[b.id, 'officer']]);
});

test('AUDIT CHAP4 S6: the first week settled "on" after the developers\' starts EVERY chapter from 50 - one that week does not name too (mutants: the reset)', async () => {
  const s = await stand();
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 1, 'dev', 0)").run(WEEK - 1);
  s.raw.prepare('INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (40, 99, 15, ?, 0, 0)').run(WEEK - 1);   // a trial chapter no town names now
  await settleChapterWeek(s.env.DB, WEEK, turnOf(WEEK), null, 'on');
  assert.equal(s.strength(MAGES, 99), 50);
});

test('AUDIT CHAP4 E1 (decided): no holder\'s carry - a holder at 2000 of the four weeks\' 2400 loses to a challenger at the cap; an equal standing stays with the holder (mutants: the carry back, the tie)', () => {
  const c = (char, merit, joinedAt) => ({ faction: FIGHTERS, region: ANTICLERE, char, account: char.toUpperCase(), merit, joinedAt });
  const sat = [{ faction: FIGHTERS, region: ANTICLERE, char: 'h', seat: 'master' }];
  const cap = MERIT_CAP_WEEK * SEAT_MERIT_WEEKS;
  assert.equal(cap, 2400);
  const master = (cands) => chapterSeatPlan(cands, sat).find((p) => p.seat === 'master').char;
  assert.equal(master([c('h', 2000, 90), c('x', cap, 10)]), 'x', 'the challenger at the cap');
  assert.equal(master([c('h', cap, 90), c('x', cap, 10)]), 'h', 'an equal standing: the holder, before a longer tenure');
  assert.equal(master([c('h', 1800, 90), c('x', 1801, 90)]), 'x');
  assert.equal(seatScoreOf(2000, true), seatScoreOf(2000));
});

test('AUDIT CHAP4 E3: a struck chapter seats nobody and titles nobody - its holders sit nowhere at the next Turning, and its Masters\' loss gives no Former Master (mutants: the seats\' gate, the titles\' gate)', async () => {
  const s = await stand({ CHAPTER_TITLES: 'on' });
  const a = await s.member('Alda');
  s.merit(a, FIGHTERS, ANTICLERE, 600);
  await settleChapterWeek(s.env.DB, WEEK, turnOf(WEEK));
  assert.deepEqual((await chapterTitlesOfAccount(s.env.DB, a.who.id, turnOf(WEEK))).map((t) => t.title), ['chaptermaster']);
  confirmChapters(s.raw, [ANTICLERE], [MAGES]);   // the Fighters' hall struck
  assert.deepEqual(await chapterTitlesOfAccount(s.env.DB, a.who.id, turnOf(WEEK)), [], 'no title for a chapter struck');
  s.merit(a, FIGHTERS, ANTICLERE, 300, { week: WEEK + 1 });
  await settleChapterWeek(s.env.DB, WEEK + 1, turnOf(WEEK + 1));
  assert.deepEqual(s.seats(), [], 'no seat at a chapter no town keeps');
  assert.deepEqual(await chapterTitlesOfAccount(s.env.DB, a.who.id, turnOf(WEEK + 1)), [], 'and the loss titles nobody');
});

test('AUDIT CHAP4 D1: a membership the active book does not hold is dormant - claimed so, kept on the Roll, earning no Merit, no member writ and no seat; the claim\'s mark checked and keyed (mutants: the mark, the column, each guard)', async () => {
  const store = { mortal: { 1: { guild: 'MagesGuild', rank: 4 } }, vampire: { 2: { guild: 'FightersGuild', rank: 7 } } };
  assert.deepEqual(rollMembersOf(store, true), [{ f: MAGES, rank: 4, d: 1 }, { f: FIGHTERS, rank: 7 }]);
  assert.deepEqual(rollMembersOf(store, false), [{ f: MAGES, rank: 4 }, { f: FIGHTERS, rank: 7, d: 1 }]);
  assert.deepEqual(rollMembersOf({ 1: { guild: 'MagesGuild', rank: 4 } }, true), [{ f: MAGES, rank: 4 }], 'a book of one: awake');
  assert.equal(rollMembersOk([{ f: MAGES, rank: 4, d: 1 }]), true);
  assert.equal(rollMembersOk([{ f: MAGES, rank: 4, d: 2 }]), false);
  assert.notEqual(rollMembersKey([{ f: MAGES, rank: 4, d: 1 }]), rollMembersKey([{ f: MAGES, rank: 4 }]), 'a swap of books is a change');
  assert.equal(rollVampireOf({ racialOverride: { racial: 'vampirism', ended: false } }), true);
  assert.equal(rollVampireOf({ racialOverride: { racial: 'vampirism', ended: true } }), false);
  assert.equal(rollVampireOf({}), false);
  // the service: Alda's Fighters membership dormant - no seat at a Turning however much Merit lies there
  const s = await stand();
  const a = await s.member('Alda', { factions: [FIGHTERS, MAGES], members: [{ f: FIGHTERS, rank: 7, d: 1 }, { f: MAGES, rank: 7 }] });
  assert.deepEqual(s.raw.prepare('SELECT faction_id, member, dormant FROM npc_roll WHERE char_id = ? AND member = 1 ORDER BY faction_id').all(a.id).map((r) => [r.faction_id, r.dormant]), [[MAGES, 0], [FIGHTERS, 1]]);
  s.merit(a, FIGHTERS, ANTICLERE, 600);
  s.merit(a, MAGES, ANTICLERE, 100);
  await settleChapterWeek(s.env.DB, WEEK, turnOf(WEEK));
  assert.deepEqual(s.seats().map((r) => [r.faction, r.seat]), [[MAGES, 'master']]);
  // the answer carries the mark back, and a claim that wakes it writes it
  const view = await readRoll({ db: s.env.DB, nowS: NOW }, { id: a.who.id }, { character: a.R.id, lease: a.R.lease });
  assert.deepEqual(view.roll.members.map((m) => [m.f, m.d ?? 0]), [[MAGES, 0], [FIGHTERS, 1]]);
  const r = await claimRoll({ db: s.env.DB, nowS: NOW }, { id: a.who.id }, { character: a.R.id, lease: a.R.lease, rid: 'k'.repeat(16), deltas: {}, members: [{ f: FIGHTERS, rank: 7 }, { f: MAGES, rank: 7 }] });
  assert.ok(r.roll, JSON.stringify(r));
  assert.equal(s.raw.prepare('SELECT dormant FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(a.id, FIGHTERS).dormant, 0);
  for (const [f, file, re] of [['Merit', 'server-account/src/npcMerit.js', /faction_id = \?3 AND member = 1 AND dormant = 0 AND joined_at/], ['members', 'server-account/src/npcReceipts.js', /member = 1 AND dormant = 0\n/],
    ['seats', 'server-account/src/npcChapters.js', /WHERE r\.member = 1 AND r\.dormant = 0 AND/]]) assert.match(src(file), re, f);
});

test('AUDIT CHAP4 D1: the tab claims by the active book - its members off the curse\'s own reading (mutants: the vampire read)', () => {
  assert.match(src('src/net/npcRollTracker.js'), /members: \(\) => rollMembersOf\(entityOf\(\)\?\.guildMemberships, rollVampireOf\(entityOf\(\)\)\),/);
});

// ── THE CLIENT ──────────────────────────────────────────────────────

test('AUDIT CHAP4 C1: with nothing to claim the tab asks again once ROLL_SEATS_MS old - a Turning\'s seats reach the page; never sooner (mutants: the beat, the first word\'s stamp)', async () => {
  let t = 1_000_000;
  const calls = [];
  let seats = [{ f: FIGHTERS, region: ANTICLERE, seat: 'master' }];
  const roll = () => ({ seq: 1, factions: { 40: 10, 41: 0 }, members: [], seats });
  const io = {
    read: async () => { calls.push('read'); return { ok: true, data: { roll: roll(), seeded: false, from: 1 } }; },
    claim: async (id, ls, rid, deltas) => { calls.push(['claim', Object.keys(deltas).length]); return { ok: true, data: { roll: roll(), credited: {} } }; },
  };
  const tracker = createRollTracker({
    io, character: () => 'r0123456789abcdef0123', lease: () => 'a'.repeat(32), read: () => ({ 40: 10, 41: 0 }), write: () => {}, members: () => null, now: () => t,
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  tracker.tick(); await settle();
  assert.deepEqual(tracker.seats, seats);
  t += ROLL_SEATS_MS - 1;
  tracker.tick(); await settle();
  assert.deepEqual(calls, ['read'], 'not yet');
  seats = [];   // the Turning unseated it
  t += 1;
  tracker.tick(); await settle();
  assert.deepEqual(calls, ['read', ['claim', 0]], 'an empty claim, once the beat is old');
  assert.deepEqual(tracker.seats, [], 'and the seat is gone from the page');
  assert.equal(ROLL_SEATS_MS, SHEET_KEPT_MS);
});

test('AUDIT CHAP4 C2, C3: the living town reads its chapters at its own pixel; the rank\'s ceiling holds from the page\'s first frame (mutants: the player\'s pixel, the held gate)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /chapterOf: chapterSheet \? \(faction\) => livingChapterOf\(faction, px, py\) : undefined,/);
  assert.match(w, /const livingChapterOf = \(\/\*\* @type \{number\} \*\/ faction, \/\*\* @type \{number\} \*\/ x, \/\*\* @type \{number\} \*\/ y\) => \{\n\s+const f = chapterFactionOf\(faction, townTalk\?\.factionDict \?\? null\) \?\? faction;\n\s+const region = \(\(\) => \{ try \{ return maps\.getRegionIndexAt\(x, y\); \} catch \{ return null; \} \}\)\(\);/);
  assert.match(w, /rollRankCeiling: \(\) => \(rollTracker && !rollTracker\.stopped \? ROLL_BOOK_RANK_MAX : null\),/);
});

test('AUDIT CHAP4 (D, worth a look): a hall building\'s faction read as its chapter\'s - a temple\'s templar order its divine\'s, a guild hall\'s its guild\'s, the hidden two as they are (mutants: the resolution)', () => {
  const STENDARR = 33;
  const dict = new Map([
    [STENDARR, { id: STENDARR, type: FACTION_TYPES.God, ggroup: GUILD_GROUPS.None, children: [990] }],
    [990, { id: 990, parent: STENDARR, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.HolyOrder, children: [] }],
    [FIGHTERS, { id: FIGHTERS, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.FightersGuild, children: [] }],
  ]);
  assert.equal(chapterFactionOf(990, dict), STENDARR);
  assert.equal(chapterFactionOf(STENDARR, dict), STENDARR);
  assert.equal(chapterFactionOf(FIGHTERS, dict), FIGHTERS);
  assert.equal(chapterFactionOf(THIEVES, null), THIEVES);
  assert.equal(chapterFactionOf(FIGHTERS, null), null, 'no faction file read: none');
  assert.equal(chapterFactionOf(12345, dict), null);
});

test('AUDIT CHAP4 C4: the chapter is the line\'s subject - an order\'s plural name reads right; the town\'s talk never opens on a lower-case guild (mutants: the words)', () => {
  assert.equal(chapterLineOf({ faction: 368, strength: 74 }), 'The chapter of the Knights of the Dragon here is Thriving (Strength 74)');
  for (const pool of Object.values(CHAPTER_NEWS)) for (const script of pool) for (const line of script) {
    assert.doesNotMatch(line, /(^|say )\{guild\}/, line);   // never the sentence's first word, nor its subject
  }
});

test('AUDIT CHAP4 C5, C6: both doors of a seat\'s Hall of Records read it one way - the seat\'s Chronicle and its region\'s chapters\', together (mutants: the board\'s door, the serial read)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const w = st && seatBook \? await hallOfRecordsRead\(st\) : null;/);
  assert.match(w, /if \(!seat \|\| !seatBook\) return null;\n\s+return hallOfRecordsRead\(seat\);/);
  assert.match(w, /const \[r, ch\] = await Promise\.all\(\[/);
});

test('AUDIT CHAP4 D3, D4, E2: a seat\'s title at its chapter\'s hall (the popup and its counter), DFU\'s refusal said under the roll, a knight\'s gifts by the book (mutants: each seam)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /guildTitle: \(\) => getTitle\(membershipOf\(seated\(\), guild\), playerEntity, guild\),/);
  assert.match(m, /return g \? getTitle\(membershipOf\(seatedBook\(activeMemberships\(playerEntity\), membershipKey\(g\), host\.chapterSeatRank\?\.\(g\.factionId\) \?\? null\), g\), playerEntity, g\) : null;/);
  assert.match(m, /chapterRollWindow\(\{ \.\.\.roll, lines: \[\.\.\.roll\.lines, access\.text\] \}\)/);
  assert.match(m, /const kept = guild \? membershipOf\(activeMemberships\(playerEntity\), guild\) : null;/);
  assert.match(m, /const decision = receiveArmorDecision\(kept, \{/);
  assert.match(m, /onChoose: \(\) => \{ claimArmor\(kept, decision\.mask\); surfacePlayer\(\); \},/);
  assert.match(m, /const decision = receiveHouseDecision\(kept, \{/);
});

// ── THE PINS (lens T) ───────────────────────────────────────────────

async function titled(t) {
  const ZERO = 2;   // server-account/wrangler.toml SEASON_ZERO_WEEK: production counts Seasons
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ CHAPTERS_OPEN: 'on', CHAPTER_TITLES: 'on', SEASON_ZERO_WEEK: String(ZERO) });
  const raw = svc.env.DB._raw;
  confirmChapters(raw, [ANTICLERE]);
  const who = await svc.registered('Alda');
  const R = await seatRealm(svc.env, who.secret, 'Alda');
  const week = meritWeekOf(T0);
  const season = seasonOf(week, ZERO);
  const block = Math.floor(week / SEASON_WEEKS) * SEASON_WEEKS;
  const lost = (w) => raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'seat', ?, ?, ?)").run(FIGHTERS, ANTICLERE, w, R.id, JSON.stringify({ from: 'master', to: null }), T0);
  return { svc, raw, who, R, week, season, block, lost, ZERO };
}

test('AUDIT CHAP4 T1: under a COUNTED Season (production\'s SEASON_ZERO_WEEK) a Former Master is titled from the Season\'s own first week, its claim the Season\'s number - through the wardrobe and the mint (mutants: the Season, its start, both routes\' zero)', async (t) => {
  const x = await titled(t);
  assert.ok(x.season.n > 0 && x.season.start < x.block, `T0 lies where the counted Season began before the eight-week block (${JSON.stringify(x.season)}, ${x.block})`);
  x.lost(x.season.start);
  const got = await chapterTitlesOfAccount(x.svc.env.DB, x.who.id, T0, x.ZERO);
  assert.deepEqual(got.map((g) => [g.title, g.ts]), [['formermaster', [FIGHTERS * 100 + ANTICLERE, x.season.n]]]);
  const equip = await x.svc.call('/v1/account/title', { title: 'formermaster' }, x.who.secret);
  assert.equal(equip.status, 200, JSON.stringify(equip.body));
  const m = (await x.svc.call('/v1/auth/token', { character: x.R.id }, x.who.secret)).body;
  assert.deepEqual([m.title, m.ts], ['formermaster', [FIGHTERS * 100 + ANTICLERE, x.season.n]]);
});

test('AUDIT CHAP4 T2: the Chronicle\'s read hands the Hall the counted Season\'s zero (mutants: the zero)', async (t) => {
  const x = await titled(t);
  const r = await x.svc.call('/v1/chapters/history', { region: ANTICLERE }, x.who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.zero, x.ZERO);
});

test('AUDIT CHAP4 T3: the board offers the Focus to its own chapter\'s Master - never the guild\'s Master of another region (mutants: the region)', async () => {
  const s = await stand();
  const a = await s.member('Alda');
  s.raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, 'master', ?, ?, ?)").run(FIGHTERS, DAGGERFALL, a.id, a.who.id, WEEK - 1, WEEK - 1, NOW);
  assert.deepEqual([...await masterSeatsIn(s.env.DB, a.id, ANTICLERE, WEEK)], []);
  assert.deepEqual([...await masterSeatsIn(s.env.DB, a.id, DAGGERFALL, WEEK)], [FIGHTERS]);
});

test('AUDIT CHAP4 T4, T9: the Work tab says a Focus press\'s answer - its line on a set, the refusal\'s words on a refusal - and a press while one is out is none (mutants: the word, the busy)', async () => {
  const chapters = [{ faction: FIGHTERS, strength: 50, band: 'steady', focus: 'wood', master: true, focuses: ['metals', 'wood'] }];
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters, today: { filled: 0, max: 3 } }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  for (const [answer, want] of [[{ ok: true }, 'The Fighters Guild\'s Master asks for metals this week.'], [{ ok: false, error: 'not-master' }, 'Only the chapter\'s Master sets its Focus.']]) {
    let sets = 0;
    const host = document.createElement('div');
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
      work: { book, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), setFocus: async () => { sets++; await tick(); return answer; } } });
    await tick();
    byClass(host, 'notice-tab')[1].click();
    for (let i = 0; i < 3; i++) await tick();
    const button = [...byClass(host, 'notice-focus-pick')[0].querySelectorAll('button')][0];
    button.click();
    button.click();   // pressed again while the first is out
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(sets, 1, 'one set');
    assert.equal(byClass(host, 'notice-word')[0]?.textContent, want);
  }
});

test('AUDIT CHAP4 C (the lens\'s unproven, proven): a Focus answered after the board closed is said in the chat, as a Take is (mutants: the late word)', async () => {
  const chapters = [{ faction: FIGHTERS, strength: 50, band: 'steady', focus: 'wood', master: true, focuses: ['metals', 'wood'] }];
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters, today: { filled: 0, max: 3 } }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  /** @type {string[]} */
  const late = [];
  let answer = () => {};
  const host = document.createElement('div');
  const board = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
    work: { book, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), sayLate: (t) => late.push(t),
      setFocus: () => new Promise((res) => { answer = () => res({ ok: true }); }) } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  [...byClass(host, 'notice-focus-pick')[0].querySelectorAll('button')][0].click();
  await tick();
  board.unmount();
  answer();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(late, ['The Fighters Guild\'s Master asks for metals this week.']);
});

test('AUDIT CHAP4 T5: a failed read of the sheet is asked again at the next beat - never before (mutants: the read\'s stamp)', async () => {
  let t = 0, n = 0;
  const sheet = createChapterSheet({ door: { list: async () => { n++; throw new Error('offline'); } }, nowMs: () => t });
  sheet.refresh();
  await tick(); await tick();
  t += 1;
  assert.equal(sheet.refresh(), false);
  for (let i = 0; i < 5; i++) { sheet.strengthOf(FIGHTERS, ANTICLERE); await tick(); await tick(); }
  assert.equal(n, 1, 'one read through an outage, however many frames ask');
  t = SHEET_KEPT_MS;
  assert.equal(sheet.refresh(), true);
});

test('AUDIT CHAP4 T6, T8: the orders the record states - a tied candidate\'s chapters by key, a Turning\'s changes by chapter then character, a character\'s seats by guild then region, the book\'s capped factions ascending (mutants: each order)', async () => {
  const c = (faction, region, char, account, merit) => ({ faction, region, char, account, merit, joinedAt: 0 });
  assert.deepEqual(chapterSeatPlan([c(41, 21, 'a', 'A', 600), c(40, 21, 'a', 'A', 600), c(40, 21, 'b', 'B', 100)]).map((p) => `${p.faction}|${p.seat}|${p.char}`),
    ['40|master|a', '40|officer|b', '41|officer|a']);
  assert.deepEqual(seatChangesOf([], [{ faction: 41, region: 21, char: 'b', seat: 'officer' }, { faction: 41, region: 21, char: 'a', seat: 'officer' }]).map((x) => x.char), ['a', 'b']);
  const s = await stand();
  const a = await s.member('Alda');
  for (const [f, g] of [[FIGHTERS, ANTICLERE], [MAGES, DAGGERFALL], [FIGHTERS, DAGGERFALL]]) {
    s.raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, 'officer', ?, ?, ?)").run(f, g, a.id, a.who.id, WEEK, WEEK, NOW);
  }
  assert.deepEqual((await chapterSeatsOf(s.env.DB, a.id)).map((x) => [x.f, x.region]), [[MAGES, DAGGERFALL], [FIGHTERS, DAGGERFALL], [FIGHTERS, ANTICLERE]]);
  const store = { mortal: { 1: { guild: 'FightersGuild', rank: 9 }, 2: { guild: 'MagesGuild', rank: 8 } }, vampire: {} };
  assert.deepEqual(rollBookCap(store), [MAGES, FIGHTERS]);
  // the sheet's roll: officers placed at one Turning (one `since`) by their character ids; an account's titles by character
  const b = await s.member('Bren'), c3 = await s.member('Cass');
  s.raw.prepare('DELETE FROM npc_chapter_seats').run();
  for (const m of [c3, b]) s.raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, 'officer', ?, ?, ?)").run(MAGES, ANTICLERE, m.id, m.who.id, WEEK, WEEK, NOW);
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(meritWeekOf(NOW - CHAPTER_TURNING_GRACE_S) - 1);   // nothing due
  const sheet = await chapterSheet({ db: s.env.DB, nowS: NOW }, { id: b.who.id }, s.env);
  const names = sheet.chapters.find((x) => x.f === MAGES && x.region === ANTICLERE).seats.map((x) => x.name);
  assert.deepEqual(names, [[b.id, 'Bren'], [c3.id, 'Cass']].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map((x) => x[1]));
  const R2 = await seatRealm(s.env, a.who.secret, 'Alba');
  // the larger id at the lower guild - the seats' own order (guild first) is not the characters'
  const [lo, hi] = [R2.id, a.id].sort();
  s.raw.prepare('DELETE FROM npc_chapter_seats WHERE account = ?').run(a.who.id);
  for (const [id, f] of [[hi, MAGES], [lo, FIGHTERS]]) s.raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, 'officer', ?, ?, ?)").run(f, ANTICLERE, id, a.who.id, WEEK, WEEK, NOW);
  assert.deepEqual((await chapterTitlesOfAccount(s.env.DB, a.who.id, NOW)).map((x) => x.char), [lo, hi]);
});

test('AUDIT CHAP4 T7: the town\'s talk of a chapter falls on two days three apart, drawn by the town AND the guild; the bands read once a clock MINUTE (mutants: the town\'s seed, the offsets, the minute)', () => {
  const town = (mapId, t, chapterOf) => {
    const halls = { 1006: [B.GuildHall, MAGES_GUILD], 1009: [B.GuildHall, FIGHTERS_GUILD], 1014: [B.GuildHall, 368] };
    const fx = synthTown({ blocksW: 6, blocksH: 6 });
    const buildings = fx.buildings.map((b) => (halls[b.key] ? { ...b, type: halls[b.key][0], factionId: halls[b.key][1] } : b));
    return new LivingTown(fx.nav, { town: { mapId, blocks: 36, region: 17, people: 3, port: false }, buildings, doors: fx.doors, makePerson: () => null,
      clock: () => t.now, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND, chapterOf });
  };
  const t = { now: 300 * DAY_MIN + DAY_START_MIN };
  const daysOf = (mapId) => {
    const lt = town(mapId, t, (f) => ({ band: 'thriving', name: `g${f}` }));
    const on = new Map();
    for (let day = 300; day < 307; day++) for (const n of lt.chapterNews(day * DAY_MIN + DAY_START_MIN + 600)) on.set(n.guild, [...(on.get(n.guild) ?? []), day % 7]);
    return on;
  };
  for (const [g, d] of daysOf(4242)) assert.ok([3, 4].includes(((d[1] - d[0]) + 7) % 7), `${g}: three apart (${d})`);
  const towns = [4242, 1, 77, 9001, 31337].map((m) => daysOf(m).get(`g${FIGHTERS_GUILD}`).join());
  assert.ok(new Set(towns).size > 1, `a guild's days differ by town (${towns.join(' | ')})`);
  let bands = { [FIGHTERS_GUILD]: 'failing' };
  const lt = town(4242, t, (f) => (bands[f] ? { band: bands[f], name: 'the guild' } : null));
  const res = lt.peopleOf(300).filter((r) => ['keeper', 'smith', 'clerk', 'scholar', 'helper'].includes(r.job) && (() => { const home = r.home != null ? lt.places.doors.get(r.home) : null; const h = home ? guildHallOf(r, lt.places, home) : null; return h && lt.places.factions.get(h.building) === FIGHTERS_GUILD; })());
  assert.ok(res.length > 0);
  const evenings = () => res.map((r) => { let n = 0; for (let day = 300; day < 307; day++) if (lt.planOf(r, day).some((e) => e.kind === 'guild')) n++; return n; });
  const before = evenings();
  bands = { [FIGHTERS_GUILD]: 'thriving' };
  t.now += 0.5;
  assert.deepEqual(evenings(), before, 'the same clock minute');
  t.now += 0.5;
  assert.notDeepEqual(evenings(), before, 'the next');
});

test('AUDIT CHAP4 T10: the roll\'s and the Hall\'s chapters\' lines flush left under a centred heading; each band\'s news its own; a Focus whose faction is no whole number a malformed body (mutants: the justification, the pools, the guard)', async () => {
  const lineFormat = (tokens, first) => {
    let f = null;
    for (const x of tokens) { if (x.formatting === RSC.JustifyCenter || x.formatting === RSC.JustifyLeft) f = x.formatting; if (x.text === first) return f; }
    return 'absent';
  };
  assert.equal(lineFormat(chapterRollTokens({ title: 'The Roll', lines: ['Master of the chapter: Alda.'] }), 'Master of the chapter: Alda.'), RSC.JustifyLeft);
  const seat = { key: 3021, name: 'Anticlere', region: ANTICLERE, tier: 'palace' };
  const line = 'In week 40, Alda took the Master\'s seat of the Fighters Guild.';
  assert.equal(lineFormat(hallOfRecordsTokens(seat, [], null, null, { rows: [{ kind: 'seat', faction: FIGHTERS, week: 40, data: { from: null, to: 'master' }, name: 'Alda' }], zero: null }), line), RSC.JustifyLeft);
  const all = (band) => CHAPTER_NEWS[band].map((x) => x.join(' ')).join(' | ');
  assert.doesNotMatch(all('failing'), /Full to the door|doing well|strongest|never stood higher/);
  assert.doesNotMatch(all('thriving'), /half empty|failing|Hard times/);
  const db = { prepare: () => { throw new Error('no read for a malformed body'); } };
  assert.deepEqual(await setChapterFocus({ db, nowS: 0 }, { id: 'p' }, {}, { character: 'r0123456789abcdef0123', faction: '41', region: ANTICLERE, focus: 'wood' }), { error: 'body' });
});

test('AUDIT CHAP4 S2: a board read while the Chapters are shut records the weeks shut (mutants: the post\'s mark)', async (t) => {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const s = await stand({ CHAPTERS_OPEN: 'off', PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 4);
  const who = await s.registered('Reader');
  const R = await seatRealm(s.env, who.secret, 'Reader');
  await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, who.secret);
  assert.deepEqual(s.weeks().filter((r) => r.week > WEEK - 4).map((r) => r.open), [WEEK - 3, WEEK - 2, WEEK - 1].filter((w) => w < meritWeekOf(NOW - CHAPTER_TURNING_GRACE_S)).map(() => 'off'));
  assert.ok(s.weeks().some((r) => r.open === 'off'));
});
