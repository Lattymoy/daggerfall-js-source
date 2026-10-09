// @ts-nocheck
// AUDIT CHAP5 (2026-10-09, Mac: "I think we do a deep comprehensive audit across everything"): the Chapters arc read
// again, end to end - CHAP0 to CHAP7b, the four audits before it and the merges - through six lenses
// (bible/01-Overview/Audit-Chapters-5.md). Each fix pinned here by its finding's id; the lens T's pins - laws no test
// could fail - after them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import {
  meritWeekOf, chapterEventOf, chapterEventWeights, CHAPTER_EVENTS, CHAPTER_EVENT_EFFECTS, crackdownMerit, drawOf, chapterDoctrinesFor,
  schismDoctrinesOf, CHAPTER_DOCTRINES, seatedBook, ROLL_BOOK_RANK_MAX, ROLL_FACTIONS, patronWinnerOf, patronEscrowId, successionHeir,
  strengthAfter, strengthTarget, strengthSeasonEnd, rivalryEnd, MERIT_WRIT,
} from '../src/net/npcChapterLaw.js';
import { chapterSeasonLines } from '../src/net/chapterEvents.js';
import { gateHash } from '../src/net/gateLaw.js';
import { GUILD_FOUND_RENOWN } from '../src/net/guildLaw.js';
import { utcDay } from '../src/net/marksLaw.js';
import { seatWeekStartMs } from '../src/net/townSeatLaw.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { accountRoll, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { calculateTradePrice } from '../src/systems/shopStock.js';
import { cureOfferMessageOffset } from '../src/systems/guildServiceActions.js';
import { SpellbookWindow } from '../src/ui/spellbookWindow.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../src/systems/spellMaker.js';
import { createChapterBanners } from '../src/scenes/chapterBanners.js';
import { hallBannerAnchors } from '../src/scenes/hallBanners.js';
import { BANNERS_MAX } from '../src/render/bannerPass.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { settleChaptersDue, settleChapterWeek, chapterChronicle, CHAPTER_TURNING_GRACE_S } from '../server-account/src/npcChapters.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { standService, sessionStorageOf, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40, THIEVES = 42, BROTHERHOOD = 108;
const ARKAY = 21, STENDARR = 33, KYNARETH = 35, JULIANOS = 27, HAWK = 417;
const NOW = T0 + 30 * 7 * DAY;
const WEEK = meritWeekOf(NOW);
/** Season 1 from WEEK - 1 (Season 0 four weeks): NOW is its second week; its last week LAST, whose Turning opens Season 2. */
const ZERO = WEEK - 5;
const LAST = WEEK + 6;
const turnOf = (w) => seatWeekStartMs(w + 1) / 1000 + CHAPTER_TURNING_GRACE_S + 1;
const ARMS = { field: 'azure', border: 'gold', device: 'tower' };
const tick = () => new Promise((r) => setImmediate(r));
let _rid = 0;
const rid = () => `chap5-${String(++_rid).padStart(6, '0')}`;

// ── THE LAW ─────────────────────────────────────────────────────────

test('AUDIT CHAP5 E1: a Crackdown\'s half again is its members\' own writs\' Merit, never Marks - the effect named for it, its words (mutants: the effect, the rounding, the line)', () => {
  assert.equal(CHAPTER_EVENT_EFFECTS.crackdownMerit, 1.5);
  assert.equal(CHAPTER_EVENT_EFFECTS.crackdownPay, undefined, 'no pay of it at all');
  assert.deepEqual([crackdownMerit(MERIT_WRIT), crackdownMerit(33), crackdownMerit(-1), crackdownMerit('x')], [150, 50, 0, 0]);
  assert.deepEqual(chapterSeasonLines(FIGHTERS, ANTICLERE, { event: 'crackdown' }), ['The watch hunts the chapter this Season: its members\' own writs earn half again Merit.']);
});

test('AUDIT CHAP5 E3: the draw scaled over the weights\' sum, never its remainder - a Curfew\'s weight moves few chapters\' events, as its share says (mutants: the scale, the remainder)', () => {
  assert.deepEqual([drawOf(0, 100), drawOf(2 ** 32 - 1, 100), drawOf(2 ** 31, 100), drawOf(2 ** 31, 3)], [0, 99, 50, 1]);
  const keys = [];
  for (const f of ROLL_FACTIONS) for (let g = 0; g < 40; g++) keys.push([f, g]);
  const base = chapterEventWeights({ faction: MAGES, rivalBand: 'steady' });
  const curfew = chapterEventWeights({ faction: MAGES, rivalBand: 'steady', curfew: true });
  const moved = keys.filter(([f, g]) => chapterEventOf(4, f, g, base) !== chapterEventOf(4, f, g, curfew)).length / keys.length;
  assert.ok(moved < 0.25, `a Curfew moved ${moved}`);
  const total = base.reduce((a, b) => a + b, 0);
  const remainder = keys.filter(([f, g]) => (gateHash(0x5ea6, 4, f * 100 + g) % total) !== (gateHash(0x5ea6, 4, f * 100 + g) % (total + 10))).length / keys.length;
  assert.ok(remainder > 0.5, `the remainder's law moved ${remainder} - the finding`);
  assert.equal(chapterEventOf(4, FIGHTERS, ANTICLERE, [1, 0, 0, 0, 0, 0, 0]), 'calm');
});

test('AUDIT CHAP5 D3: a guild\'s doctrines are what DFU\'s hall sells - an order and a hidden guild more writs alone (no Schism, its weight Calm\'s), the Fighters and Kynareth training and writs, the rest all three (mutants: each guild, the weight, the two)', () => {
  assert.deepEqual([chapterDoctrinesFor(HAWK), chapterDoctrinesFor(THIEVES), chapterDoctrinesFor(BROTHERHOOD)], [['writs'], ['writs'], ['writs']]);
  assert.deepEqual([chapterDoctrinesFor(FIGHTERS), chapterDoctrinesFor(KYNARETH)], [['training', 'writs'], ['training', 'writs']]);
  assert.deepEqual([chapterDoctrinesFor(MAGES), chapterDoctrinesFor(JULIANOS), chapterDoctrinesFor(ARKAY)], [[...CHAPTER_DOCTRINES], [...CHAPTER_DOCTRINES], [...CHAPTER_DOCTRINES]]);
  for (let s = 0; s < 30; s++) {
    assert.deepEqual(schismDoctrinesOf(s, FIGHTERS, ANTICLERE), ['training', 'writs']);
    assert.deepEqual([schismDoctrinesOf(s, HAWK, ANTICLERE), schismDoctrinesOf(s, THIEVES, ANTICLERE)], [[], []]);
    assert.equal(schismDoctrinesOf(s, MAGES, ANTICLERE).length, 2);
  }
  const order = chapterEventWeights({ faction: HAWK, rivalBand: 'steady', masters: 2 });
  assert.deepEqual([order[0], order[1]], [30 + 25, 0], 'an order\'s Schism, two Masters\' too, Calm\'s');
  assert.deepEqual(chapterEventWeights({ faction: FIGHTERS, rivalBand: 'steady' }).slice(0, 2), [30, 15], 'two doctrines: a Schism');
  for (let s = 0; s < 300; s++) assert.notEqual(chapterEventOf(s, HAWK, ANTICLERE, order), 'schism');
});

test('AUDIT CHAP5 D1: a seat lifts only a book row DFU\'s own review holds at 7 - never a rank-2 member past the skills DFU\'s ranks ask (mutants: the 7, the lift)', () => {
  const book = (rank) => ({ MagesGuild: { guild: 'MagesGuild', rank, reputation: 85 } });
  assert.equal(ROLL_BOOK_RANK_MAX, 7);
  const low = book(2);
  assert.equal(seatedBook(low, 'MagesGuild', 9), low, 'rank 2: the book itself');
  assert.equal(seatedBook(book(6), 'MagesGuild', 8).MagesGuild.rank, 6);
  const held = seatedBook(book(7), 'MagesGuild', 9);
  assert.deepEqual([held.MagesGuild.rank, held.MagesGuild.reputation], [9, 85], 'held at 7: the seat\'s 9');
  assert.equal(seatedBook(book(7), 'MagesGuild', 8).MagesGuild.rank, 8);
});

test('AUDIT CHAP5 T17: a Succession\'s heir is a whole side - a top backer\'s side that is no whole is the hall\'s own first (mutants: CHAP6B-HEIR-TOP)', () => {
  assert.deepEqual([successionHeir(null, 1.5), successionHeir(null, 2), successionHeir(1, 2), successionHeir(null, null)], [0, 2, 1, 0]);
});

// ── THE SERVICE: THE TURNING ────────────────────────────────────────

/** A service counting Seasons from ZERO, Anticlere's and Daggerfall's chapters confirmed (every guild), one week settled. */
async function turning(t, { open = 'on' } = {}) {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const s = await standService({ CHAPTERS_OPEN: open, MARKS_OPEN: 'on', SEASON_ZERO_WEEK: String(ZERO) });
  const raw = s.env.DB._raw;
  confirmChapters(raw, [ANTICLERE, DAGGERFALL]);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 1);
  const put = (f, g, strength, { event = null, season = null, data = {}, patron = null, patronSeason = null } = {}) => raw.prepare(`INSERT INTO npc_chapters
    (faction, region, strength, week, merit, at, event, event_season, event_data, patron, patron_season) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
    ON CONFLICT (faction, region) DO UPDATE SET strength = excluded.strength, event = excluded.event, event_season = excluded.event_season,
      event_data = excluded.event_data, patron = excluded.patron, patron_season = excluded.patron_season`).run(f, g, strength, WEEK - 1, event, season, JSON.stringify(data), patron, patronSeason);
  const row = (f, g) => { const r = raw.prepare('SELECT * FROM npc_chapters WHERE faction = ? AND region = ?').get(f, g); return r ? { ...r, event_data: JSON.parse(r.event_data) } : null; };
  let n = 0;
  const merit = (f, g, week, amount) => raw.prepare(`INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at)
    VALUES (?, ?, ?, 'acc', 'cx', 'writ', ?, ?, 0)`).run(week, f, g, amount, `w:${++n}`);
  const week = (w, o) => raw.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, ?, 0)').run(w, o);
  const settle = (w, o = 'on') => settleChapterWeek(s.env.DB, w, turnOf(w), ZERO, o);
  const seasons = () => raw.prepare("SELECT faction, region, char_id FROM npc_chapter_history WHERE kind = 'season' ORDER BY faction, region").all().map((r) => ({ ...r }));
  const seat = (char, account, f, g, seat, since) => raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
    .run(f, g, char, account, seat, since, LAST - 1);
  const moved = (char, f, g, w, from, to) => raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'seat', ?, ?, 0)")
    .run(f, g, w, char, JSON.stringify({ from, to }));
  const guild = async (handle, name, tag, marks) => {
    const who = await s.registered(handle, { renown: GUILD_FOUND_RENOWN });
    const r = await s.found(who, { name, tag });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const id = r.body.guild.id;
    if (marks) raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(id, marks, `seed-${id}`);
    return { who, id };
  };
  const bid = (g, faction, region, marks, r = rid()) => s.call('/v1/chapters/patron', { character: g.who.character, faction, region, marks, rid: r }, g.who.secret);
  const treasury = (g) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(g.id)?.balance ?? 0);
  return { ...s, raw, put, row, merit, week, settle, seasons, seat, moved, guild, bid, treasury };
}

test('AUDIT CHAP5 S1/E2: a Season\'s Master is the one who held the Master\'s seat the whole of it - an officer who rose to it in the Season is none, though its seat\'s `since` is its officer\'s (mutants: the continuity, its weeks, its kind)', async (t) => {
  const s = await turning(t);
  const who = await s.registered('Alda');
  const whole = await seatRealm(s.env, who.secret, 'Alda');
  const rose = await seatRealm(s.env, who.secret, 'Bryn');
  const back = await seatRealm(s.env, who.secret, 'Cade');
  s.seat(whole.id, who.id, FIGHTERS, ANTICLERE, 'master', WEEK - 3);
  s.seat(rose.id, who.id, MAGES, ANTICLERE, 'master', WEEK - 3);
  s.moved(rose.id, MAGES, ANTICLERE, LAST - 1, 'officer', 'master');   // an officer from before the Season, the Master in its last week
  s.seat(back.id, who.id, FIGHTERS, DAGGERFALL, 'master', WEEK - 3);
  s.moved(back.id, FIGHTERS, DAGGERFALL, WEEK + 1, 'master', 'officer');
  s.moved(back.id, FIGHTERS, DAGGERFALL, WEEK + 2, 'officer', 'master');   // lost it and won it back in the Season
  s.moved(whole.id, FIGHTERS, ANTICLERE, WEEK - 2, null, 'master');   // its seat taken at the Turning that opened the Season: whole
  s.moved(whole.id, MAGES, ANTICLERE, WEEK + 1, 'officer', 'master');   // another chapter's Master's seat in the Season - not this one's
  s.moved(whole.id, FIGHTERS, DAGGERFALL, WEEK + 1, 'officer', 'master');  assert.deepEqual(await s.settle(LAST), { settled: true, chapters: ROLL_FACTIONS.length * 2 });
  assert.deepEqual(s.seasons(), [{ faction: FIGHTERS, region: ANTICLERE, char_id: whole.id }]);
});

test('AUDIT CHAP5 S6: the opening is the first week ever settled \'on\' - a developers\' trial after it ends no Season\'s Strength, seats or patron; a Season the developers settled any week of crowns no one (mutants: the first-ever, the trial)', async (t) => {
  const s = await turning(t);
  s.put(FIGHTERS, ANTICLERE, 80, { patron: 'gabcdefghij', patronSeason: 1 });
  s.week(WEEK, 'dev');
  assert.deepEqual(await s.settle(WEEK + 1), { settled: true, chapters: ROLL_FACTIONS.length * 2 });
  const r = s.row(FIGHTERS, ANTICLERE);
  assert.deepEqual([r.strength, r.patron, r.patron_season], [strengthAfter(80, 0, strengthTarget(0)), 'gabcdefghij', 1], 'on, dev, on: nothing wiped');
  const who = await s.registered('Alda');
  const R = await seatRealm(s.env, who.secret, 'Alda');
  s.seat(R.id, who.id, FIGHTERS, ANTICLERE, 'master', WEEK - 3);
  assert.equal((await s.settle(LAST)).settled, true);
  assert.deepEqual(s.seasons(), [], 'the Season held a developers\' week: no Master crowned');
  const c = await turning(t);
  const cw = await c.registered('Alda');
  const cR = await seatRealm(c.env, cw.secret, 'Alda');
  c.seat(cR.id, cw.id, FIGHTERS, ANTICLERE, 'master', WEEK - 3);
  assert.equal((await c.settle(LAST)).settled, true);
  assert.deepEqual(c.seasons(), [{ faction: FIGHTERS, region: ANTICLERE, char_id: cR.id }], 'the control: no developers\' week, crowned');
});

test('AUDIT CHAP5 S6: at the opening every bid goes home and none wins - a developers\' bid buys nobody the Season, though the opening is its Turning (mutants: the opening\'s draw)', async (t) => {
  const s = await turning(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 5000);
  assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 2000)).status, 200);
  assert.equal(s.treasury(a), 3000);
  s.raw.prepare("UPDATE npc_chapter_weeks SET open = 'dev'").run();
  assert.equal((await s.settle(LAST)).settled, true);
  assert.deepEqual({ ...s.raw.prepare('SELECT state FROM npc_chapter_patron_bids').get() }, { state: 'lost' });
  assert.equal(s.treasury(a), 5000, 'home');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM npc_chapter_history WHERE kind = 'patron'").get().n, 0);
  assert.deepEqual([s.row(FIGHTERS, ANTICLERE).patron, s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'patron'").get().n], [null, 0]);
});

test('AUDIT CHAP5 S4: a Season of thousands of bids decides in one batch well inside its time - each list read once (mutants: the correlated reads)', async (t) => {
  const s = await turning(t);
  const keys = ROLL_FACTIONS.filter((f) => ![THIEVES, BROTHERHOOD].includes(f)).flatMap((f) => [[f, ANTICLERE], [f, DAGGERFALL]]);
  const ins = s.raw.prepare("INSERT INTO npc_chapter_patron_bids (faction, region, season, guild_id, amount, at) VALUES (?, ?, 2, ?, ?, ?)");
  let n = 0;
  for (let i = 0; i < 4000; i++) { const [f, g] = keys[i % keys.length]; ins.run(f, g, `g${String(++n).padStart(10, '0')}`, 1000 + (i % 97), i); }
  const t0 = performance.now();
  assert.equal((await s.settle(LAST)).settled, true);
  const took = performance.now() - t0;
  assert.ok(took < 4000, `the Turning took ${took} ms`);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM npc_chapter_patron_bids WHERE state = 'open'").get().n, 0);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind IN ('patron', 'patron-return')").get().n, 4000);
  const nc = src('server-account/src/npcChapters.js');
  assert.match(nc, /SET state = CASE WHEN \(faction, region, guild_id, season\) IN \(SELECT json_extract\(value, '\$\[0\]'\),/);
  assert.match(nc, /UPDATE npc_chapters SET patron = w\.guild, patron_season = \?2\n\s+FROM \(SELECT json_extract\(value, '\$\[0\]'\) AS f, json_extract\(value, '\$\[1\]'\) AS g, json_extract\(value, '\$\[2\]'\) AS guild FROM json_each\(\?1\)\) w/);
});

test('AUDIT CHAP5 E5: a chapter races once a Season - the Brotherhood, two temples\' rival, races the first and the other\'s rivalry ends even (mutants: the once, the even)', async (t) => {
  const s = await turning(t);
  s.put(BROTHERHOOD, ANTICLERE, 50, { event: 'rivalry', season: 1, data: { rival: ARKAY } });
  s.put(ARKAY, ANTICLERE, 50, { event: 'rivalry', season: 1, data: { rival: BROTHERHOOD } });
  s.put(STENDARR, ANTICLERE, 50, { event: 'rivalry', season: 1, data: { rival: BROTHERHOOD } });
  s.merit(ARKAY, ANTICLERE, WEEK, 500);
  s.merit(STENDARR, ANTICLERE, WEEK, 500);
  assert.equal((await s.settle(LAST)).settled, true);
  const after = strengthAfter(50, 0, strengthTarget(0));
  const end = rivalryEnd([after, after], [500, 0]);
  assert.deepEqual([s.row(ARKAY, ANTICLERE).strength, s.row(BROTHERHOOD, ANTICLERE).strength, s.row(STENDARR, ANTICLERE).strength],
    [strengthSeasonEnd(end.a), strengthSeasonEnd(end.b), strengthSeasonEnd(after)], 'one sting, not two');
  const won = (f) => JSON.parse(s.raw.prepare("SELECT data FROM npc_chapter_history WHERE kind = 'event' AND faction = ? AND region = ?").get(f, ANTICLERE).data).won;
  assert.deepEqual([won(ARKAY), won(BROTHERHOOD), won(STENDARR)], [true, false, null]);
});

// ── THE SERVICE: THE DOORS ──────────────────────────────────────────

test('AUDIT CHAP5 S3: a hidden guild\'s chapter\'s Season is its members\' - a stranger is answered "no event" whatever it holds, a member its own answers (mutants: the hidden ask)', async (t) => {
  const s = await turning(t);
  s.put(THIEVES, ANTICLERE, 50, { event: 'succession', season: 1 });
  const back = (who, R, side) => s.call('/v1/chapters/back', { character: R.id, faction: THIEVES, region: ANTICLERE, side }, who.secret);
  const stranger = await s.registered('Bryn');
  const sR = await seatRealm(s.env, stranger.secret, 'Bryn');
  assert.deepEqual([(await back(stranger, sR, 0)).body.error, (await back(stranger, sR, 9)).body.error], ['no-event', 'no-event'], 'no "not-member", no "no-side"');
  s.put(THIEVES, DAGGERFALL, 50, {});
  assert.equal((await s.call('/v1/chapters/back', { character: sR.id, faction: THIEVES, region: DAGGERFALL, side: 0 }, stranger.secret)).body.error, 'no-event');
  const who = await s.registered('Alda');
  const R = await seatRealm(s.env, who.secret, 'Alda');
  await readRoll({ db: s.env.DB, nowS: NOW }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 42: 85 }, members: [{ f: 42, rank: 7 }] } });
  assert.deepEqual([(await back(who, R, 9)).body.error, (await back(who, R, 1)).body], ['no-side', { ok: true, event: 'succession', side: 1 }]);
  s.raw.prepare('UPDATE npc_roll SET member = 0 WHERE char_id = ? AND faction_id = 42').run(R.id);
  assert.equal((await back(who, R, 9)).body.error, 'no-event', 'a member no longer: a stranger');
  s.raw.prepare('UPDATE npc_roll SET member = 1, dormant = 1 WHERE char_id = ? AND faction_id = 42').run(R.id);
  assert.equal((await back(who, R, 9)).body.error, 'no-event', 'a dormant membership: no active one');
});

test('AUDIT CHAP5 S2: the Chronicle never names a hidden rival - a public chapter\'s Rivalry with one sent without it, a public rival kept (mutants: the strip)', async (t) => {
  const s = await turning(t);
  const row = (f, data) => s.raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'event', '', ?, 0)").run(f, ANTICLERE, WEEK - 2, JSON.stringify(data));
  row(FIGHTERS, { season: 0, event: 'rivalry', rival: THIEVES, won: true });
  row(MAGES, { season: 0, event: 'rivalry', rival: JULIANOS, won: false });
  row(ARKAY, { season: 0, event: 'rivalry', rival: BROTHERHOOD, won: null });
  const { rows } = await chapterChronicle({ db: s.env.DB }, null, s.env, { region: ANTICLERE });
  assert.deepEqual(rows.map((r) => [r.faction, r.data]), [[FIGHTERS, { season: 0, event: 'rivalry', won: true }], [MAGES, { season: 0, event: 'rivalry', rival: JULIANOS, won: false }],
    [ARKAY, { season: 0, event: 'rivalry', won: null }]]);
});

test('AUDIT CHAP5 S5: the boards\' and the Turning\'s reads on their own indexes - an account\'s backings, the Season\'s Masters, a guild\'s bids, a region\'s patrons (mutants: each index)', async (t) => {
  const s = await turning(t);
  const plan = (sql, ...b) => s.raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...b).map((r) => r.detail).join(' | ');
  const backs = plan('SELECT faction, side FROM npc_chapter_backing WHERE region = ?1 AND season = ?2 AND account = ?3', ANTICLERE, 1, 'acc');
  assert.match(backs, /idx_npc_chapter_backing_season/, backs);
  const season = plan('SELECT faction, region, account, char_id, side FROM npc_chapter_backing WHERE season = ?1 ORDER BY account', 1);
  assert.match(season, /idx_npc_chapter_backing_season/, season);
  const masters = plan(`SELECT faction, region, COUNT(*) AS n FROM npc_chapter_history WHERE kind = 'seat' AND week BETWEEN ?1 AND ?2
      AND json_extract(data, '$.to') = 'master' GROUP BY faction, region`, 1, 2);
  assert.match(masters, /idx_npc_chapter_history_week/, masters);
  const bids = plan("SELECT faction, amount FROM npc_chapter_patron_bids WHERE region = ?1 AND season = ?2 AND guild_id = ?3 AND state = 'open'", ANTICLERE, 2, 'g');
  assert.match(bids, /idx_npc_chapter_patron_bids_guild/, bids);
  const keeps = plan("SELECT 1 FROM npc_chapter_patron_bids WHERE guild_id = ?1 AND state = 'open'", 'g');
  assert.match(keeps, /idx_npc_chapter_patron_bids_guild/, keeps);
  const patrons = plan('SELECT c.faction FROM npc_chapters c JOIN guilds g ON g.id = c.patron WHERE c.region = ?2 AND c.patron_season = ?1', 1, ANTICLERE);
  assert.match(patrons, /idx_npc_chapters_region/, patrons);
  // a token's mint still reads a character's own rows - the week-led index never draws it
  const who = 'JOIN realm_characters c ON c.id = x.char_id AND c.player = ?1 AND c.dead_at IS NULL WHERE (?2 IS NULL OR x.char_id = ?2)';
  const whole = plan(`SELECT x.char_id FROM npc_chapter_history x ${who} AND x.kind = 'season'`, 'p', null);
  assert.match(whole, /idx_npc_chapter_history_char/, whole);
  assert.doesNotMatch(src('server-account/src/npcChapters.js'), /\?2 IS NULL OR c\.region = \?2/);
});

test('AUDIT CHAP5 E4: a guild whose bid for a chapter\'s patronage stands does not go - its escrow was burnt with it; decided, it goes (mutants: the keep, the word)', async (t) => {
  const s = await turning(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 5000);
  assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 2000)).status, 200);
  const disband = () => s.call('/v1/guilds/disband', { character: a.who.character }, a.who.secret);
  let r = await disband();
  assert.deepEqual([r.status, r.body.error], [409, 'guild-patron']);
  assert.equal(accountRefusalText('guild-patron'), 'The guild has bid for a chapter\'s patronage. It cannot go until the Season opens and the bid is decided.');
  assert.ok(s.raw.prepare('SELECT 1 FROM guilds WHERE id = ?').get(a.id), 'it stands');
  assert.equal(await settleChaptersDue(s.env.DB, turnOf(LAST), ZERO, 'on'), 7);
  r = await disband();
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

// ── THE SERVICE: A CRACKDOWN'S WRITS (E1) ───────────────────────────

const hourAt = (sec) => Math.floor((((Math.floor(sharedClassicMinutes(sec * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let x = from; x < from + 2 * 7200; x += 30) if (hourAt(x) === want && hourAt(x - 60) === want && hourAt(x + 60) === want) return x;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);

/** A town of Anticlere with Fighters, Mages and Thieves halls witnessed, its ground, NOON in Season 1 (none counted
 *  where `season` is false), and Alda - a member of the Fighters a week and a day (and of the Thieves, its guild's
 *  guildmaster, where `guildmaster`); the Fighters' chapter under `event` this Season. */
async function board(t, event, { season = true, guildmaster = false } = {}) {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const week = meritWeekOf(NOON);
  const s = await standService({ CHAPTERS_OPEN: 'on', PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', ...(season ? { SEASON_ZERO_WEEK: String(week - 5) } : {}) });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOON - days * DAY, who.id);
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`); age(w, 8);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [MAGES, FIGHTERS, THIEVES] } }, w.secret)).status, 200);
  }
  const g = await s.registered('Ground'); age(g, 8);
  const p = herbPatches({ x: 300, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false })[0];
  assert.equal((await s.call('/v1/prof/harvest', {
    character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(NOON), slot: p.slot }), kind: 'herbs',
    climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: NOON - 2, rid: rid(),
  }, g.secret)).status, 200);
  const who = await s.registered('Alda', { renown: GUILD_FOUND_RENOWN });
  const R = await seatRealm(s.env, who.secret, 'Alda');
  await readRoll({ db: s.env.DB, nowS: NOON }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 41: 10, 42: 10 }, members: [{ f: 41, rank: 0 }, { f: 42, rank: 0 }] } });
  if (guildmaster) {
    const f = await s.found(who, { name: 'The Iron Wolves', tag: 'IWLF' });
    assert.equal(f.status, 200, JSON.stringify(f.body));
    raw.prepare('UPDATE guild_members SET char_id = ? WHERE player = ?').run(R.id, who.id);   // the board's reader its guildmaster
  }
  raw.prepare('UPDATE npc_roll SET joined_at = joined_at - ? WHERE char_id = ?').run(8 * DAY, R.id);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(week - 1);
  raw.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at, event, event_season, event_data) VALUES (41, 21, 50, ?, 0, 0, ?, 1, '{}')`).run(week - 1, event);
  const list = async () => (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, who.secret)).body;
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, R.id, m, qty);
  const deliver = (id) => s.call('/v1/writs/deliver', { character: R.id, id, rid: rid() }, who.secret);
  return { ...s, raw, who, R, list, give, deliver };
}

test('AUDIT CHAP5 E1: a Crackdown\'s chapter\'s member\'s own writ earns half again Merit, its pay the writ\'s own; a Calm one\'s the plain 100 (mutants: the Crackdown read, the Merit bound)', async (t) => {
  const s = await board(t, 'crackdown');
  const w = (await s.list()).writs.find((x) => x.kind === 'member');
  s.give(w.material, w.qty);
  const r = await s.deliver(w.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.merit, r.body.pay], [crackdownMerit(MERIT_WRIT), w.pay]);
  const calm = await board(t, 'calm');
  const c = (await calm.list()).writs.find((x) => x.kind === 'member');
  calm.give(c.material, c.qty);
  assert.equal((await calm.deliver(c.id)).body.merit, MERIT_WRIT);
});

// ── THE CLIENT ──────────────────────────────────────────────────────

/** A guild's spellbook in buy mode, as CHAP3c's pins make one. */
function shop(over = {}) {
  const entity = { name: 'Nyra', magicka: 20, maxMagicka: 40, spells: [], stats: { personality: 50 }, goldPieces: 5000,
    items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }] };
  const spell = { name: 'Arc Bolt', cost: 20, index: 1, icon: 3, element: 0, rangeType: 2, effects: [{ type: 4, subType: 0 }, { type: -1, subType: -1 }, { type: -1, subType: -1 }] };
  return new SpellbookWindow({
    spells: () => entity.spells, entity, castCost: (sp) => sp.cost, offered: () => [spell], buildingQuality: () => 10,
    shopName: () => 'The Mages Guild', skills: () => ({ mercantile: 30, personality: 50 }), classicMinutes: () => 0,
    rows: (id) => [{ text: `[${id}] %a gold, %pct.`, center: true }], ...over,
  }, { buyMode: true });
}

test('AUDIT CHAP5 D6: the spellbook\'s haggle line weighs the price against the cost the hall\'s chapter lists - a cheaper hall never reads as a bargain struck (mutants: the factor on the cost)', () => {
  const plain = shop();
  plain.buyButton();
  for (const f of [0.729, 0.9, 1.25]) {
    const w = shop({ priceFactor: () => f });
    w.buyButton();
    assert.equal(w._tradeOffset, plain._tradeOffset, `factor ${f}`);
  }
  const cheap = shop({ priceFactor: () => 0.729 });
  assert.notEqual(cureOfferMessageOffset(cheap.presentedCost || 80, cheap.tradePrice()), plain._tradeOffset, 'the finding: DFU\'s list against the hall\'s price');
  assert.equal(calculateTradePrice(80, 10, { mercantile: 30, personality: 50 }, false) > 0, true);
});

test('AUDIT CHAP5 C1/C2/C5/D2: the host\'s seams - the guild book asked again when old and at a patron\'s hall; the banners\' guild a temple\'s divine; the halls kept online alone; a shut hall\'s services refused, its popup standing (mutants: each seam)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /until it was opened\n\s+guildId: \(\) => \{ const g = guildBook; if \(g\?\.stale\?\.\(\)\) g\.refresh\(\)\.catch\(\(\) => \{\}\); return g\?\.guild\?\.id \?\? null; \},/);
  assert.match(world, /if \(c\?\.patron && guildBook\?\.stale\?\.\(\)\) guildBook\.refresh\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(world, /chapterOf: \(faction, region\) => chapterSheet\.chapterOf\(chapterFactionOf\(faction, townTalk\?\.factionDict \?\? null\) \?\? faction, region\),/);
  assert.match(world, /const pixelChapterHalls = new Map\(chapterSheet && dfLocation && locBlocks \? buildingSummaries\(/);
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /const shutBox = \(\) => \(chapterHallShut\(host\.chapterHere\?\.\(guild\.factionId\) \?\? null\) \? \{ rows: \[CHAPTER_HALL_SHUT_LINE\] \} : null\);\n\s+shutBox\(\);/);
  assert.match(modes, /onService: \(\) => \{\n\s+const shut = shutBox\(\);   \/\/ AUDIT CHAP5 D2\n\s+if \(shut\) return shut;\n\s+const access = serviceAccess\(/);
  assert.match(modes, /\? \(\) => shutBox\(\) \?\? \(openReforge\(\) \? \{ dispatched: true \} : null\) : null,/);
  assert.match(modes, /\? \(\) => shutBox\(\) \?\? \(openLift\(\) \? \{ dispatched: true \} : null\) : null,/);
  assert.match(modes, /healCurse: service === 'CureDisease' \? \(\) => shutBox\(\) \?\? healCurseBox\(\) : null,/);
  assert.doesNotMatch(modes, /townTalk\?\.say\?\.\(CHAPTER_HALL_SHUT_LINE\); return;/, 'the popup itself never refused');
});

// ── THE LENS T: LAWS NO TEST COULD FAIL ─────────────────────────────

test('AUDIT CHAP5 T4: the opening week clears a developers\' patron (mutants: CHAP7A-OPENED)', async (t) => {
  const s = await turning(t);
  s.raw.prepare("UPDATE npc_chapter_weeks SET open = 'dev'").run();
  s.put(FIGHTERS, 9, 50, { patron: 'gabcdefghij', patronSeason: 1 });
  await s.settle(WEEK);
  assert.deepEqual({ ...s.raw.prepare('SELECT patron, patron_season FROM npc_chapters WHERE faction = 41 AND region = 9').get() }, { patron: null, patron_season: null });
});

test('AUDIT CHAP5 T4: a bid landing between the Turning\'s read and its batch fails the Turning whole; the next read decides it (mutants: CHAP7A-GUARD)', async (t) => {
  const s = await turning(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 10_000);
  assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 2000)).status, 200);
  const db = s.env.DB, batch = db.batch.bind(db);
  let once = true;
  db.batch = async (stmts) => {
    if (once && stmts.length > 6) { once = false; s.raw.prepare('INSERT INTO npc_chapter_patron_bids (faction, region, season, guild_id, amount, at) VALUES (40, 21, 2, ?, 1500, 0)').run(a.id); }
    return batch(stmts);
  };
  s.week(LAST - 1, 'on');
  assert.equal(await settleChaptersDue(db, turnOf(LAST), ZERO, 'on'), 0, 'the Turning rolled back');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'patron'").get().n, 0, 'nothing burnt');
  assert.equal(await settleChaptersDue(db, turnOf(LAST), ZERO, 'on'), 1, 'the next read settles it');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM npc_chapter_patron_bids WHERE state = 'open'").get().n, 0, 'the late bid decided with it');
});

test('AUDIT CHAP5 T5/T9: a raise stands at its own time - at a tie the guild that reached the sum first wins; a request made twice answers what the first made (mutants: the upsert\'s at, the repeat\'s answer)', async (t) => {
  const clock = { s: NOW };
  const s = await turning(t);
  t.mock.method(Date, 'now', () => clock.s * 1000);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 10_000);
  const b = await s.guild('Bryn', 'Grey Lanterns', 'GLN', 10_000);
  clock.s = NOW + 10; assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 1000)).status, 200);
  clock.s = NOW + 20; assert.equal((await s.bid(b, FIGHTERS, ANTICLERE, 2000)).status, 200);
  const same = rid();
  clock.s = NOW + 30; assert.equal((await s.bid(a, FIGHTERS, ANTICLERE, 2000, same)).status, 200);
  assert.deepEqual((await s.bid(a, FIGHTERS, ANTICLERE, 2000, same)).body, { ok: true, repeat: true, season: 2, marks: 2000, guildMarks: 8000 });
  assert.equal(await settleChaptersDue(s.env.DB, turnOf(LAST), ZERO, 'on'), 7);
  assert.equal(s.raw.prepare("SELECT guild_id FROM npc_chapter_patron_bids WHERE state = 'won'").get().guild_id, b.id, 'Bryn\'s guild stood at 2,000 first');
});

test('AUDIT CHAP5 T6: the sheet carries a patron\'s arms (mutants: the heraldry read)', async (t) => {
  const s = await turning(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 1000);
  s.raw.prepare('UPDATE guilds SET heraldry = ? WHERE id = ?').run(JSON.stringify(ARMS), a.id);
  s.put(FIGHTERS, ANTICLERE, 50, { patron: a.id, patronSeason: 1 });
  const fa = (await s.call('/v1/chapters/list', {}, a.who.secret)).body.chapters.find((x) => x.f === FIGHTERS && x.region === ANTICLERE);
  assert.deepEqual(fa.patron.heraldry, ARMS);
});

test('AUDIT CHAP5 T7: the Turning that opens Season 0 draws every confirmed chapter\'s first event (mutants: the ended Season\'s guard)', async (t) => {
  const s = await turning(t);
  s.week(WEEK, 'on');
  const r = await settleChapterWeek(s.env.DB, WEEK + 1, turnOf(WEEK + 1), WEEK + 2, 'on');
  assert.equal(r.settled, true);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM npc_chapters WHERE event_season = 0').get().n, r.chapters);
});

test('AUDIT CHAP5 T14: a malformed bid is none even when it is the highest (mutants: the whole amount)', () => {
  assert.deepEqual(patronWinnerOf([{ guild: 'ga', amount: 9000.5, at: 1 }, { guild: 'gb', amount: 1000, at: 2 }]), { guild: 'gb', amount: 1000, at: 2 });
  assert.equal(patronEscrowId(2, MAGES, DAGGERFALL, 'gb'), 'patron:2:4017:gb');
});

/** The draw over Anticlere's and Daggerfall's chapters with the seats' `edicts` `[key, region, edict, state]` - or,
 *  `regions` given, over theirs with only the Fighters confirmed, the Thieves' rows `held` Ascendant there. */
async function drawn(t, edicts, { regions = null } = {}) {
  const s = await turning(t);
  if (regions) {
    s.raw.prepare('DELETE FROM npc_hall_regions').run();
    confirmChapters(s.raw, regions, [FIGHTERS]);
    for (const g of regions) s.put(THIEVES, g, 95);
  }
  s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('gcurfew', 'The Watch', 'the watch', 'WCH', '[]', 0, 1)").run();
  for (const [key, region, edict, state] of edicts) {
    s.raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, at) VALUES (?, 'gcurfew', ?, 'palace', 0, 50, 0)").run(key, region);
    s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, ?, 'gcurfew', 'x', ?, 0)").run(key, LAST, edict, state);
  }
  await s.settle(LAST);
  return s.raw.prepare('SELECT faction, region, event FROM npc_chapters ORDER BY faction, region').all().map((r) => `${r.faction}|${r.region}|${r.event}`);
}

test('AUDIT CHAP5 T8: the draw reads a Curfew only where it is law, and no other edict as one; its rival only a chapter confirmed now (mutants: the law, the edict, the rival confirmed)', async (t) => {
  const none = await drawn(t, []);
  assert.deepEqual(await drawn(t, [[900, ANTICLERE, 'curfew', 'proclaimed'], [901, DAGGERFALL, 'curfew', 'void']]), none, 'a curfew not law');
  assert.deepEqual(await drawn(t, [[900, ANTICLERE, 'festival', 'law'], [901, DAGGERFALL, 'levy', 'law']]), none, 'another edict');
  assert.notDeepEqual(await drawn(t, [[900, ANTICLERE, 'curfew', 'law'], [901, DAGGERFALL, 'curfew', 'law']]), none, 'the control: a law Curfew moves the draw');
  // the Thieves no longer confirmed, their rows held Ascendant: the Fighters draw as with no rival, in every region
  const regions = Array.from({ length: 30 }, (_, i) => i + 1);
  const events = await drawn(t, [], { regions });
  const alone = chapterEventWeights({ faction: FIGHTERS, band: 'steady' });
  assert.deepEqual(regions.map((g) => events.find((x) => x.startsWith(`${FIGHTERS}|${g}|`))), regions.map((g) => `${FIGHTERS}|${g}|${chapterEventOf(2, FIGHTERS, g, alone)}`), 'no rival: the Rivalry\'s weight Calm\'s');
  const rivalled = chapterEventWeights({ faction: FIGHTERS, band: 'steady', rivalBand: 'ascendant' });
  assert.ok(regions.some((g) => chapterEventOf(2, FIGHTERS, g, alone) !== chapterEventOf(2, FIGHTERS, g, rivalled)), 'the control: a rival would move some');
});

test('AUDIT CHAP5 T10: a Season ending at the Chapters\' opening crowns no developers\' Master - the opening\'s seats are none (mutants: the opened)', async (t) => {
  const s = await turning(t);
  s.raw.prepare("UPDATE npc_chapter_weeks SET week = ?, open = 'dev'").run(WEEK - 2);   // the developers' last week before the Season; the Season's own unsettled
  const who = await s.registered('Eld');
  const R = await seatRealm(s.env, who.secret, 'Eld');
  s.seat(R.id, who.id, FIGHTERS, ANTICLERE, 'master', WEEK - 3);
  assert.equal((await s.settle(LAST)).settled, true);
  assert.deepEqual(s.seasons(), []);
});

test('AUDIT CHAP5 T15/T18: the client\'s doors reach the service - a bid through accountRoll\'s patron, a backing through its back (mutants: CHAP7B-CLIENT-ROUTE, CHAP6C-DOOR)', async (t) => {
  const s = await turning(t);
  const a = await s.guild('Alda', 'The Iron Wolves', 'IWLF', 5000);
  const io = accountRoll({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, a.who) });
  const r = await io.patron(a.who.character, FIGHTERS, ANTICLERE, 1500, rid());
  assert.deepEqual([r.ok, r.data?.season, r.data?.marks, r.data?.guildMarks], [true, 2, 1500, 3500], JSON.stringify(r));
  s.put(FIGHTERS, ANTICLERE, 50, { event: 'schism', season: 1 });
  const who = await s.registered('Bryn');
  const R = await seatRealm(s.env, who.secret, 'Bryn');
  await readRoll({ db: s.env.DB, nowS: NOW }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 41: 85 }, members: [{ f: 41, rank: 7 }] } });
  const b = await accountRoll({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) }).back(R.id, FIGHTERS, ANTICLERE, 1);
  assert.deepEqual([b.ok, b.data], [true, { ok: true, event: 'schism', side: 1 }], JSON.stringify(b));
});

test('AUDIT CHAP5 T11: each banner at the pixel\'s translation plus its anchor - every axis, its cloth\'s right and out; past BANNERS_MAX the nearest to the eye alone (mutants: the top\'s axes, the out, the cap, the sort)', () => {
  const frame = { box: [0, 0, 0, 10, 6, 10], door: { a: [4, 0, 10], b: [6, 0, 10] } };
  const pixel = { px: 100, py: 200, homeFrames: new Map([[1, frame]]), chapterHalls: new Map([[1, FIGHTERS]]) };
  const one = createChapterBanners({ built: () => new Map([['k', pixel]]), regionAt: () => ANTICLERE,
    chapterOf: () => ({ patron: { id: 'gabcdefghij', heraldry: ARMS } }), translation: () => [1000, 7, 2000], now: () => 0 });
  const want = hallBannerAnchors(frame);
  assert.ok(want.length > 0);
  assert.deepEqual(one.list().map((b) => [b.top, b.right, b.out]), want.map((a) => [[1000 + a.top[0], 7 + a.top[1], 2000 + a.top[2]], a.right, a.out]));
  const pixels = new Map();
  for (let i = 11; i >= 0; i--) pixels.set(`p${i}`, { px: i, py: 0, homeFrames: new Map([[1, frame]]), chapterHalls: new Map([[1, FIGHTERS]]) });
  const many = createChapterBanners({ built: () => pixels, regionAt: () => ANTICLERE, chapterOf: () => ({ patron: { id: 'gabcdefghij', heraldry: ARMS } }),
    translation: (px) => [px * 1000, 0, 0], eye: () => [0, 0, 0], now: () => 0 });
  const list = many.list();
  assert.equal(list.length, BANNERS_MAX);
  assert.ok(Math.max(...list.map((b) => b.top[0])) < Math.ceil(BANNERS_MAX / want.length) * 1000, 'the far pixels\' banners dropped');
});

/** The Notice Board's Work tab over `chapters`, the guildmaster's bid door `patron`. */
async function workBoard(chapters, patron) {
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters, today: { filled: 0, max: 3 } }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
    draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
    work: { book, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), patron } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  return host;
}

test('AUDIT CHAP5 T12: a bid press is one at a time, and the board takes the next once answered (mutants: the busy guard, its release)', async () => {
  const chapters = [{ faction: MAGES, strength: 50, band: 'steady', patronBid: { season: 2, marks: 0 } }];
  const calls = [];
  let answer = () => {};
  const host = await workBoard(chapters, (f, m) => { calls.push([f, m]); return new Promise((res) => { answer = () => res({ ok: true, data: { season: 2 } }); }); });
  const press = (i) => byClass(host, 'notice-patron-pick')[0].querySelectorAll('button')[i].click();
  press(0); await tick(); press(1); await tick();
  assert.deepEqual(calls, [[MAGES, 1000]], 'a second press while the first is out: none');
  answer();
  for (let i = 0; i < 6; i++) await tick();
  byClass(host, 'notice-patron-pick')[0].querySelectorAll('button')[1].click();
  await tick();
  assert.deepEqual(calls, [[MAGES, 1000], [MAGES, 2000]], 'answered: the next press goes');
});

test('AUDIT CHAP5 T13: a guildmaster\'s board offers its bid at a public chapter alone - never the Thieves\' it is a member of, nor any with no Season counted (mutants: the hidden bid, the Season\'s none, the guildmaster\'s rank)', async (t) => {
  const s = await board(t, 'calm', { guildmaster: true });
  const lines = (await s.list()).chapters;
  const by = (f) => lines.find((c) => c.faction === f);
  assert.ok(by(THIEVES), 'a member reads the Thieves\' line');
  assert.deepEqual([by(FIGHTERS).patronBid, by(MAGES).patronBid, by(THIEVES).patronBid], [{ season: 2, marks: 0 }, { season: 2, marks: 0 }, undefined]);
  s.raw.prepare('UPDATE guild_members SET rank = 1 WHERE player = ?').run(s.who.id);
  assert.ok((await s.list()).chapters.every((c) => c.patronBid === undefined), 'an officer: no bid of its guild\'s');
  const none = await board(t, 'calm', { season: false, guildmaster: true });
  assert.ok((await none.list()).chapters.every((c) => c.patronBid === undefined), 'no Season counted: none');
});
