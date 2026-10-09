// @ts-nocheck
// CHAP6a (2026-10-09, Mac: "continue", the Chapters arc's sixth slice - bible/11-Multiplayer/Chapters-Arc.md section 7):
// THE SEASON'S EVENT. The law: the seven events and their weights, each modifier section 7's table names, the pure draw,
// the rivals' table (section 8), a Decline's week, a Rivalry's end, a Crackdown's pay and shut line, the Season's lines
// in words. The service: the draw at the Turning that opens a Season, a Decline's 2 a week, the Season's end (a Rivalry
// raced on the Season's Merit, a Crackdown's halls shut, the Chronicle's 'event' and 'season' rows), the opening week's
// clean slate, the board's and the sheet's events (a hidden rival named to no stranger), a shut hall's writs none and a
// Crackdown's half again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAPTER_EVENTS, CHAPTER_EVENT_EFFECTS, CHAPTER_RIVAL_PAIRS, chapterEventWeights, chapterEventOf, chapterEventOk, chapterEventName,
  chapterRivalsOf, chapterRivalPick, declineAfter, rivalryEnd, crackdownPay, crackdownShuts, chapterSeasonLine, chapterChronicleLine,
  chapterBandOf, meritWeekOf, strengthAfter, strengthSeasonEnd, ROLL_FACTIONS, memberWrit,
} from '../src/net/npcChapterLaw.js';
import { seatWeekStartMs } from '../src/net/townSeatLaw.js';
import { herbPatches, nodeKey, regionWritTable, daySeason } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { settleChapterWeek, settleChaptersDue, chapterChronicle, CHAPTER_TURNING_GRACE_S } from '../server-account/src/npcChapters.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { standService, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40, THIEVES = 42, BROTHERHOOD = 108, JULIANOS = 27;
const NOW = T0 + 3 * DAY;
const WEEK = meritWeekOf(NOW);
/** Season 0 the four weeks to WEEK, Season 1 the eight after it: WEEK's Turning ends Season 0 and opens Season 1. */
const ZERO = WEEK - 3;
const turnOf = (w) => seatWeekStartMs(w + 1) / 1000 + CHAPTER_TURNING_GRACE_S + 1;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP6a the events: seven, section 7\'s base weights in the table\'s order, a hundred in all; their names; anything else no event (mutants: a weight, the order, the check)', () => {
  assert.deepEqual(CHAPTER_EVENTS.map((e) => [e.id, e.weight]), [['calm', 30], ['schism', 15], ['succession', 10], ['crackdown', 10], ['rivalry', 15], ['decline', 10], ['ascendancy', 10]]);
  assert.deepEqual(CHAPTER_EVENTS.map((e) => chapterEventName(e.id)), ['Calm', 'Schism', 'Succession', 'Crackdown', 'Rivalry', 'Decline', 'Ascendancy']);
  assert.deepEqual([chapterEventOk('decline'), chapterEventOk('Decline'), chapterEventOk(null), chapterEventName('war')], [true, false, false, null]);
  assert.deepEqual(CHAPTER_EVENT_EFFECTS, {
    schismMasters: 2, schismMoved: 10, successionAscendant: 10, crackdownHidden: 2, crackdownCurfew: 10, crackdownPay: 1.5, crackdownShut: 30,
    rivalryThriving: 10, rivalrySwing: 10, declineFailing: 15, declineFall: 2, declineMeets: 2, ascendancyAscendant: 15, ascendancyPrice: 0.9,
  });   // PIN MOVED (CHAP6d): an Ascendancy's prices
});

test('CHAP6a the weights: each modifier of section 7\'s table - two Masters a Schism\'s, Ascendant a Succession\'s and an Ascendancy\'s, the underworld\'s Crackdown twice and a Curfew\'s more, no rival a Calm, a Thriving or Ascendant rival a Rivalry\'s, Failing a Decline\'s (mutants: each)', () => {
  const w = (o) => chapterEventWeights({ faction: FIGHTERS, rivalBand: 'steady', ...o });
  assert.deepEqual(w({}), [30, 15, 10, 10, 15, 10, 10]);
  assert.deepEqual(w({ masters: 1 }), w({}), 'one change of hands is no Schism\'s');
  assert.deepEqual(w({ masters: 2 }), [30, 25, 10, 10, 15, 10, 10]);
  assert.deepEqual(w({ band: 'ascendant' }), [30, 15, 20, 10, 15, 10, 25]);
  assert.deepEqual(w({ band: 'thriving' }), w({}), 'Thriving is no Ascendant');
  assert.deepEqual(w({ band: 'failing' }), [30, 15, 10, 10, 15, 25, 10]);
  assert.deepEqual(w({ curfew: true }), [30, 15, 10, 20, 15, 10, 10]);
  assert.deepEqual(chapterEventWeights({ faction: THIEVES, rivalBand: 'steady' }), [30, 15, 10, 20, 15, 10, 10]);
  assert.deepEqual(chapterEventWeights({ faction: BROTHERHOOD, rivalBand: 'steady', curfew: true }), [30, 15, 10, 30, 15, 10, 10], 'twice, then the Curfew\'s');
  assert.deepEqual(w({ rivalBand: null }), [45, 15, 10, 10, 0, 10, 10], 'CALL 5: no rival, the Rivalry\'s weight Calm\'s');
  assert.deepEqual(chapterEventWeights({ faction: FIGHTERS }), [45, 15, 10, 10, 0, 10, 10], 'no rival unless one is named');
  assert.deepEqual(w({ rivalBand: 'thriving' }), [30, 15, 10, 10, 25, 10, 10]);
  assert.deepEqual(w({ rivalBand: 'ascendant' }), [30, 15, 10, 10, 25, 10, 10]);
  assert.deepEqual(w({ rivalBand: 'failing' }), w({}));
});

test('CHAP6a the draw: a pure function of the Season, the chapter and its weights - every event reached about as often as its weight says, a weight of none never; no Season or no weight Calm (mutants: the salt, the key, the walk, the bounds)', () => {
  const weights = chapterEventWeights({ faction: FIGHTERS, rivalBand: 'steady' });
  assert.equal(chapterEventOf(3, FIGHTERS, ANTICLERE, weights), chapterEventOf(3, FIGHTERS, ANTICLERE, weights), 'the same roll everywhere');
  // the roll itself, as every client and the service roll it - the salt, the key and the walk (a change is a new law)
  assert.deepEqual(Array.from({ length: 24 }, (_, n) => chapterEventOf(n, FIGHTERS, ANTICLERE, weights)), ['decline', 'schism', 'schism', 'decline', 'ascendancy', 'decline',
    'succession', 'calm', 'crackdown', 'ascendancy', 'rivalry', 'rivalry', 'calm', 'decline', 'ascendancy', 'schism', 'calm', 'decline', 'calm', 'calm', 'succession', 'schism', 'schism', 'calm']);
  assert.deepEqual(Array.from({ length: 24 }, (_, n) => chapterEventOf(n, MAGES, DAGGERFALL, [1, 1, 1, 1, 1, 1, 1])), ['succession', 'crackdown', 'decline', 'succession', 'succession',
    'rivalry', 'crackdown', 'calm', 'calm', 'decline', 'schism', 'decline', 'calm', 'calm', 'calm', 'rivalry', 'calm', 'ascendancy', 'schism', 'decline', 'decline', 'ascendancy', 'succession', 'calm']);
  const n = Object.fromEntries(CHAPTER_EVENTS.map((e) => [e.id, 0]));
  for (let s = 0; s < 4000; s++) n[chapterEventOf(s, FIGHTERS, ANTICLERE, weights)]++;
  for (const [i, e] of CHAPTER_EVENTS.entries()) assert.ok(Math.abs(n[e.id] / 4000 - weights[i] / 100) < 0.03, `${e.id}: ${n[e.id]}`);
  const byChapter = new Set(); const bySeason = new Set();
  for (const f of ROLL_FACTIONS) byChapter.add(chapterEventOf(5, f, ANTICLERE, weights));
  for (let s = 0; s < 22; s++) bySeason.add(chapterEventOf(s, FIGHTERS, DAGGERFALL, weights));
  assert.ok(byChapter.size > 3 && bySeason.size > 3, 'the chapter and the Season both in the roll');
  assert.notDeepEqual(ROLL_FACTIONS.map((f) => chapterEventOf(5, f, ANTICLERE, weights)), ROLL_FACTIONS.map((f) => chapterEventOf(5, f, DAGGERFALL, weights)), 'the region too');
  for (let i = 0; i < 7; i++) {
    const only = [0, 0, 0, 0, 0, 0, 0]; only[i] = 3;
    assert.equal(chapterEventOf(9, MAGES, ANTICLERE, only), CHAPTER_EVENTS[i].id);
  }
  const noRival = chapterEventWeights({ faction: MAGES });
  for (let s = 0; s < 500; s++) assert.notEqual(chapterEventOf(s, MAGES, ANTICLERE, noRival), 'rivalry');
  assert.deepEqual([chapterEventOf(-1, FIGHTERS, ANTICLERE, weights), chapterEventOf(1.5, FIGHTERS, ANTICLERE, weights), chapterEventOf(2, FIGHTERS, ANTICLERE, [0, 0, 0, 0, 0, 0, 0]), chapterEventOf(2, FIGHTERS, ANTICLERE, null)],
    ['calm', 'calm', 'calm', 'calm']);
  assert.equal(chapterEventOf(2, FIGHTERS, ANTICLERE, [-5, 0, 0, 0, 0, 0, 4]), 'ascendancy', 'a weight below none is none');
});

test('CHAP6a the rivals: section 8\'s table - the Fighters and the Thieves, the Brotherhood and Arkay, Stendarr and every knightly order, the Mages and Julianos; a pick the strongest, the lower guild at a tie (mutants: a pair, the pick, the tie)', () => {
  assert.deepEqual(chapterRivalsOf(FIGHTERS), [THIEVES]);
  assert.deepEqual(chapterRivalsOf(THIEVES), [FIGHTERS]);
  assert.deepEqual(chapterRivalsOf(BROTHERHOOD), [21, 33, 368, 408, 409, 410, 411, 413, 414, 415, 416, 417]);
  assert.deepEqual(chapterRivalsOf(21), [BROTHERHOOD]);
  assert.deepEqual(chapterRivalsOf(411), [BROTHERHOOD]);
  assert.deepEqual([chapterRivalsOf(MAGES), chapterRivalsOf(JULIANOS), chapterRivalsOf(26), chapterRivalsOf(null)], [[JULIANOS], [MAGES], [], []]);
  assert.equal(CHAPTER_RIVAL_PAIRS.length, 14);
  assert.equal(chapterRivalPick([{ faction: 409, strength: 40 }, { faction: 33, strength: 70 }, { faction: 21, strength: 60 }]), 33);
  assert.equal(chapterRivalPick([{ faction: 409, strength: 70 }, { faction: 33, strength: 70 }]), 33);
  assert.deepEqual([chapterRivalPick([]), chapterRivalPick(null)], [null, null]);
});

test('CHAP6a a Decline\'s week, a Rivalry\'s end, a Crackdown\'s pay and shut line (mutants: the fall, the twice, the floor, the swing, its caps, the tie, the pay, the line)', () => {
  assert.equal(declineAfter(50, 0, 60), 48);
  assert.equal(declineAfter(50, 119, 60), 48, 'once the target is not twice');
  assert.equal(declineAfter(50, 120, 60), 50, 'twice the target holds it');
  assert.equal(declineAfter(1, 0, 60), 0, 'never below 0');
  assert.equal(declineAfter(30, 0, 0), 28, 'a target of none asks one');
  assert.deepEqual(rivalryEnd([50, 50], [10, 5]), { a: 60, b: 40, won: 'a' });
  assert.deepEqual(rivalryEnd([50, 50], [5, 10]), { a: 40, b: 60, won: 'b' });
  assert.deepEqual(rivalryEnd([95, 50], [10, 5]), { a: 100, b: 40, won: 'a' }, 'the winner stops at 100, the loser\'s sting whole');
  assert.deepEqual(rivalryEnd([50, 4], [10, 5]), { a: 54, b: 0, won: 'a' }, 'the loser never below 0');
  assert.deepEqual(rivalryEnd([50, 70], [7, 7]), { a: 50, b: 70, won: null });
  assert.deepEqual([crackdownPay(100), crackdownPay(7), crackdownPay(-3)], [150, 11, 0]);
  assert.deepEqual([crackdownShuts(29), crackdownShuts(30), crackdownShuts(0)], [true, false, true]);
});

test('CHAP6a the Season\'s lines in words - each ending, a hidden rival named no guild, the Master who held it; none for a hidden guild, a Season that is none, a Succession with no heir (mutants: each word)', () => {
  const ev = (event, d = {}, f = FIGHTERS) => chapterSeasonLine({ kind: 'event', faction: f, data: { season: 1, event, ...d } });
  assert.equal(ev('decline', { fell: 6 }), 'At the end of the Season of Morning Star, the Fighters Guild\'s decline cost it 6 Strength.');
  assert.equal(ev('decline', { fell: 0 }), 'At the end of the Season of Morning Star, the Fighters Guild held against its decline.');
  assert.equal(ev('crackdown', { shut: true }), 'At the end of the Season of Morning Star, a crackdown shut the halls of the Fighters Guild for the Season after.');
  assert.equal(ev('crackdown', { shut: false }), 'At the end of the Season of Morning Star, the Fighters Guild weathered a crackdown.');
  assert.equal(ev('rivalry', { rival: JULIANOS, won: true }, MAGES), 'At the end of the Season of Morning Star, the Mages Guild won its rivalry with the Temple of Julianos.');
  assert.equal(ev('rivalry', { rival: JULIANOS, won: false }, MAGES), 'At the end of the Season of Morning Star, the Mages Guild lost its rivalry with the Temple of Julianos.');
  assert.equal(ev('rivalry', { rival: JULIANOS, won: null }, MAGES), 'At the end of the Season of Morning Star, the Mages Guild\'s rivalry with the Temple of Julianos ended even.');
  assert.equal(ev('rivalry', { rival: THIEVES, won: true }), 'At the end of the Season of Morning Star, the Fighters Guild won its rivalry with its rival in the shadows.');
  assert.equal(ev('rivalry', { rival: JULIANOS, won: 'a' }, MAGES), 'At the end of the Season of Morning Star, the Mages Guild\'s rivalry with the Temple of Julianos ended even.', 'a won no yes nor no is no win');
  assert.equal(ev('ascendancy'), 'At the end of the Season of Morning Star, the Fighters Guild stood ascendant.');
  assert.deepEqual([ev('succession'), ev('calm'), ev('decline', {}, THIEVES)], [null, null, null]);
  assert.equal(ev('schism'), 'At the end of the Season of Morning Star, the Fighters Guild\'s schism ended with neither side carried.');   // PIN MOVED (CHAP6b): the Schism worded
  assert.equal(chapterSeasonLine({ kind: 'event', faction: FIGHTERS, data: { season: -1, event: 'ascendancy' } }), null);
  assert.equal(chapterSeasonLine({ kind: 'event', faction: FIGHTERS, data: { season: 0, event: 'ascendancy' } }), 'At the end of Season 0, the Fighters Guild stood ascendant.');
  assert.equal(chapterChronicleLine({ kind: 'season', faction: MAGES, name: 'Alda', data: { season: 2 } }), 'Through the Season of Sun\'s Dawn, Alda held the Master\'s seat of the Mages Guild.');
  assert.equal(chapterChronicleLine({ kind: 'season', faction: MAGES, name: null, data: { season: 2 } }), 'Through the Season of Sun\'s Dawn, A member since gone held the Master\'s seat of the Mages Guild.');
  assert.equal(chapterChronicleLine({ kind: 'event', faction: MAGES, data: { season: 2, event: 'ascendancy' } }), 'At the end of the Season of Sun\'s Dawn, the Mages Guild stood ascendant.');
  assert.equal(chapterChronicleLine({ kind: 'season', faction: BROTHERHOOD, name: 'Alda', data: { season: 2 } }), null);
});

// ── THE SERVICE: THE TURNING ────────────────────────────────────────

/** A service counting Seasons from ZERO, Anticlere's and Daggerfall's chapters confirmed (every guild), and one week settled. */
async function stand() {
  const s = await standService({ CHAPTERS_OPEN: 'on', SEASON_ZERO_WEEK: String(ZERO) });
  const raw = s.env.DB._raw;
  confirmChapters(raw, [ANTICLERE, DAGGERFALL]);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 1);
  const put = (f, g, strength, { event = null, season = null, data = {}, shut = null } = {}) => raw.prepare(`INSERT INTO npc_chapters
    (faction, region, strength, week, merit, at, event, event_season, event_data, shut_season) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    ON CONFLICT (faction, region) DO UPDATE SET strength = excluded.strength, event = excluded.event, event_season = excluded.event_season,
      event_data = excluded.event_data, shut_season = excluded.shut_season`).run(f, g, strength, WEEK - 1, event, season, JSON.stringify(data), shut);
  const row = (f, g) => { const r = raw.prepare('SELECT * FROM npc_chapters WHERE faction = ? AND region = ?').get(f, g); return r ? { ...r, event_data: JSON.parse(r.event_data) } : null; };
  let n = 0;
  const merit = (f, g, week, amount, char = 'cx') => raw.prepare(`INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at)
    VALUES (?, ?, ?, 'acc', ?, 'writ', ?, ?, 0)`).run(week, f, g, char, amount, `w:${++n}`);
  const history = (kind) => raw.prepare('SELECT faction, region, week, kind, char_id, data FROM npc_chapter_history WHERE kind = ? ORDER BY faction, region, seq').all(kind)
    .map((r) => ({ ...r, data: JSON.parse(r.data) }));
  const settle = (w) => settleChapterWeek(s.env.DB, w, turnOf(w), ZERO, 'on');
  return { ...s, raw, put, row, merit, history, settle };
}

test('CHAP6a the draw at the Turning that opens a Season: every confirmed chapter its event over the weights its last Season moved - its band as that Season ended, its Master\'s changes of hands, its strongest rival here, a Curfew in its region (mutants: each input, the Season, the rival\'s data)', async () => {
  const s = await stand();
  // the last Season as it ends: some chapters Failing, some Ascendant, a rival Thriving; two Masters at one chapter; a Curfew in Anticlere
  const strengths = new Map();
  // each a band's edge, so the week's own step moves it into the next band down: the band read is the Season's END
  ROLL_FACTIONS.forEach((f, i) => { for (const g of [ANTICLERE, DAGGERFALL]) { const v = [10, 21, 50, 71, 91][(i + g) % 5]; strengths.set(`${f}|${g}`, v); s.put(f, g, v); } });
  const took = (f, g, w, to = 'master') => s.raw.prepare(`INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'seat', 'cz', ?, 0)`)
    .run(f, g, w, JSON.stringify({ from: null, to }));
  // Season 0's Turnings are the weeks ZERO - 1 to WEEK - 1: every Daggerfall Master's seat changed hands at both its ends (the Fighters' once);
  // Anticlere's before it, and an officer's within it, count nothing
  for (const f of ROLL_FACTIONS) { took(f, DAGGERFALL, ZERO - 1); if (f !== FIGHTERS) took(f, DAGGERFALL, WEEK - 1); took(f, ANTICLERE, ZERO - 2); took(f, ANTICLERE, ZERO - 2); took(f, ANTICLERE, WEEK - 1, 'officer'); }
  s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('gcurfew', 'The Watch', 'the watch', 'WCH', '[]', 0, 1)").run();
  s.raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, at) VALUES (900, 'gcurfew', ?, 'palace', 0, 50, 0)").run(ANTICLERE);
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (900, ?, 'curfew', 'gcurfew', 'x', 'law', 0)").run(WEEK);
  s.raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, at) VALUES (901, 'gcurfew', ?, 'palace', 0, 50, 0)").run(DAGGERFALL);
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (901, ?, 'curfew', 'gcurfew', 'x', 'law', 0)").run(WEEK - 1);   // last week's, not this
  assert.deepEqual(await s.settle(WEEK), { settled: true, chapters: ROLL_FACTIONS.length * 2 });
  const after = (f, g) => strengthAfter(strengths.get(`${f}|${g}`), 0, 60);
  let rivalries = 0;
  for (const f of ROLL_FACTIONS) for (const g of [ANTICLERE, DAGGERFALL]) {
    const rivals = chapterRivalsOf(f).map((r) => ({ faction: r, strength: after(r, g) }));
    const rival = chapterRivalPick(rivals);
    const weights = chapterEventWeights({
      faction: f, band: chapterBandOf(after(f, g)).band, masters: g === ANTICLERE ? 0 : f === FIGHTERS ? 1 : 2,
      rivalBand: rival === null ? null : chapterBandOf(after(rival, g)).band, curfew: g === ANTICLERE,
    });
    const want = chapterEventOf(1, f, g, weights);
    const r = s.row(f, g);
    assert.deepEqual([r.event, r.event_season, r.event_data], [want, 1, want === 'rivalry' ? { rival } : {}], `${f}|${g}`);
    if (want === 'rivalry') rivalries++;
    assert.equal(r.strength, strengthSeasonEnd(after(f, g)), 'Season 0 ended: halfway to 50 after the draw read its band');
  }
  assert.ok(rivalries > 0, 'the stand reaches a Rivalry');
});

test('CHAP6a a draw only where a Season opens and is counted, and only for a chapter confirmed now; a Season opened while the Chapters were shut draws nothing (mutants: the opening, the confirmed)', async () => {
  const s = await stand();
  s.put(FIGHTERS, 5, 50);   // a chapter whose town is no longer confirmed
  await s.settle(WEEK);
  assert.equal(s.row(FIGHTERS, 5).event, null);
  assert.equal(s.row(FIGHTERS, ANTICLERE).event_season, 1);
  await s.settle(WEEK + 1);
  assert.equal(s.row(FIGHTERS, ANTICLERE).event_season, 1, 'mid-Season: no draw');
  const uncounted = await standService({ CHAPTERS_OPEN: 'on' });
  confirmChapters(uncounted.env.DB._raw, [ANTICLERE]);
  await settleChapterWeek(uncounted.env.DB, WEEK, turnOf(WEEK), null, 'on');
  assert.equal(uncounted.env.DB._raw.prepare('SELECT event FROM npc_chapters WHERE faction = 41 AND region = 21').get().event, null, 'no Season counted, no event');
  const shut = await stand();
  await settleChaptersDue(shut.env.DB, turnOf(WEEK + 1), ZERO, 'off');
  await settleChaptersDue(shut.env.DB, turnOf(WEEK + 2), ZERO, 'on');
  assert.equal(shut.row(FIGHTERS, ANTICLERE)?.event ?? null, null, 'the opening Turning passed shut');
});

test('CHAP6a a Decline\'s Season: 2 Strength more each week unless the week\'s Merit meets twice the target, the loss kept in its state; only the Season\'s own event (mutants: the event read, the Season, the Merit, the sum)', async () => {
  const s = await stand();
  s.put(FIGHTERS, ANTICLERE, 60, { event: 'decline', season: 1 });
  s.put(MAGES, ANTICLERE, 60, { event: 'decline', season: 1 });
  s.put(FIGHTERS, DAGGERFALL, 60, { event: 'decline', season: 0 });   // last Season's
  s.merit(MAGES, ANTICLERE, WEEK + 1, 120);
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK);
  await s.settle(WEEK + 1);
  assert.deepEqual([s.row(FIGHTERS, ANTICLERE).strength, s.row(FIGHTERS, ANTICLERE).event_data], [55, { fell: 2 }], '60 - 3 idle - 2');
  assert.deepEqual([s.row(MAGES, ANTICLERE).strength, s.row(MAGES, ANTICLERE).event_data], [62, { fell: 0 }], 'twice the target: the step alone');
  assert.equal(s.row(FIGHTERS, DAGGERFALL).strength, 57, 'last Season\'s Decline is over');
  s.merit(FIGHTERS, ANTICLERE, WEEK + 2, 119);
  await s.settle(WEEK + 2);
  assert.deepEqual([s.row(FIGHTERS, ANTICLERE).strength, s.row(FIGHTERS, ANTICLERE).event_data], [54, { fell: 4 }], '55 + 1 - 2');
});

test('CHAP6a the Season\'s end: a Rivalry raced on the whole Season\'s Merit (its winner 10 of the loser\'s, once a pair), a Crackdown\'s chapter under 30 shut for the next Season, the halving after; an \'event\' row a chapter of no Calm (mutants: the race\'s Merit, the pair, the winner, the shut line, the shut Season, the rows)', async () => {
  const s = await stand();
  const LAST = WEEK + 8;   // Season 1's last week
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(LAST - 1);
  s.put(FIGHTERS, ANTICLERE, 60, { event: 'rivalry', season: 1, data: { rival: THIEVES } });
  s.put(THIEVES, ANTICLERE, 40, { event: 'rivalry', season: 1, data: { rival: FIGHTERS } });   // each drew the other: one race
  s.put(MAGES, ANTICLERE, 50, { event: 'rivalry', season: 1, data: { rival: JULIANOS } });
  s.put(JULIANOS, ANTICLERE, 50, { event: 'calm', season: 1 });
  s.put(MAGES, DAGGERFALL, 32, { event: 'crackdown', season: 1 });
  s.put(FIGHTERS, DAGGERFALL, 33, { event: 'crackdown', season: 1 });
  s.put(THIEVES, DAGGERFALL, 50, { event: 'rivalry', season: 1, data: { rival: FIGHTERS } });
  s.put(26, DAGGERFALL, 33, { event: 'crackdown', season: 1 });
  s.merit(FIGHTERS, ANTICLERE, WEEK + 1, 300);   // the Season's first week counts
  s.merit(THIEVES, ANTICLERE, WEEK + 3, 100);
  s.merit(JULIANOS, ANTICLERE, WEEK + 4, 50);
  s.merit(MAGES, ANTICLERE, WEEK - 1, 500);   // last Season's: no part of this race
  s.merit(THIEVES, DAGGERFALL, WEEK + 2, 10);
  confirmChapters(s.raw, [18], [MAGES]);   // Wayrest: the Mages' chapter confirmed, Julianos' no longer
  s.put(MAGES, 18, 50, { event: 'rivalry', season: 1, data: { rival: JULIANOS } });
  s.put(JULIANOS, 18, 50);
  s.merit(MAGES, 18, WEEK + 2, 10);
  await s.settle(LAST);
  assert.deepEqual([s.row(MAGES, 18).strength, s.row(JULIANOS, 18).strength], [strengthSeasonEnd(47), strengthSeasonEnd(47)], 'a rival no longer confirmed: no race (the Mages\' 10 of the Season would have won it)');
  assert.deepEqual(s.history('event').find((r) => r.region === 18).data, { rival: JULIANOS, won: null, season: 1, event: 'rivalry' });
  const half = strengthSeasonEnd;
  assert.deepEqual([s.row(FIGHTERS, ANTICLERE).strength, s.row(THIEVES, ANTICLERE).strength], [half(57 + 10), half(37 - 10)], 'one race, not two');
  assert.deepEqual([s.row(MAGES, ANTICLERE).strength, s.row(JULIANOS, ANTICLERE).strength], [half(47 - 10), half(47 + 10)]);
  assert.deepEqual([s.row(MAGES, DAGGERFALL).shut_season, s.row(MAGES, DAGGERFALL).strength], [2, half(29)]);
  assert.equal(s.row(26, DAGGERFALL).shut_season, null, '30 is no shut hall');
  assert.deepEqual([s.row(FIGHTERS, DAGGERFALL).shut_season, s.row(FIGHTERS, DAGGERFALL).strength], [2, half(30 - 10)],
    'the Season\'s end whole: the Thieves\' race in Daggerfall (10 Merit to none) took its 10 before the shut line was read');
  assert.deepEqual(s.history('event').filter((r) => r.region !== 18).map((r) => [r.faction, r.region, r.week, r.char_id, r.data]), [
    [26, DAGGERFALL, LAST, '', { shut: false, season: 1, event: 'crackdown' }],
    [MAGES, DAGGERFALL, LAST, '', { shut: true, season: 1, event: 'crackdown' }],
    [MAGES, ANTICLERE, LAST, '', { rival: JULIANOS, won: false, season: 1, event: 'rivalry' }],
    [FIGHTERS, DAGGERFALL, LAST, '', { shut: true, season: 1, event: 'crackdown' }],
    [FIGHTERS, ANTICLERE, LAST, '', { rival: THIEVES, won: true, season: 1, event: 'rivalry' }],
    [THIEVES, DAGGERFALL, LAST, '', { rival: FIGHTERS, won: true, season: 1, event: 'rivalry' }],
    [THIEVES, ANTICLERE, LAST, '', { rival: FIGHTERS, won: false, season: 1, event: 'rivalry' }],
  ], 'Calm writes none');
  assert.equal(s.row(FIGHTERS, ANTICLERE).event_season, 2, 'and Season 2 drawn in the same Turning - the row the new Season\'s, the ending the Chronicle\'s');
});

test('CHAP6a the Season\'s Master: a \'season\' row for the Master placed at or before the Turning that opened the Season and sitting still - none for one placed after, a struck chapter\'s, Season 0\'s (mutants: the since, the seat, the confirmed, Season 0)', async () => {
  const s = await stand();
  const LAST = WEEK + 8;
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(LAST - 1);
  const who = await s.registered('Alda');
  const ids = [];
  for (const name of ['Alda', 'Bryn', 'Cael', 'Dara']) ids.push((await seatRealm(s.env, who.secret, name)).id);
  const seat = (char, f, g, kind, since) => s.raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').run(f, g, char, who.id, kind, since, since);
  seat(ids[0], FIGHTERS, ANTICLERE, 'master', WEEK);   // placed at the opening Turning
  seat(ids[1], MAGES, ANTICLERE, 'master', WEEK + 1);   // a week late
  seat(ids[2], FIGHTERS, ANTICLERE, 'officer', WEEK - 5);
  seat(ids[3], FIGHTERS, 5, 'master', WEEK - 5);   // a chapter not confirmed now
  await s.settle(LAST);
  assert.deepEqual(s.history('season').map((r) => [r.faction, r.region, r.char_id, r.data]), [[FIGHTERS, ANTICLERE, ids[0], { season: 1 }]]);
  const zero = await stand();
  const w = await zero.registered('Eld');
  const R = await seatRealm(zero.env, w.secret, 'Eld');
  zero.raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (41, 21, ?, ?, \'master\', ?, ?, 0)').run(R.id, w.id, ZERO - 1, ZERO - 1);
  await zero.settle(WEEK);
  assert.deepEqual(zero.history('season'), [], 'Season 0 crowns no one');
});

test('CHAP6a the opening week: no developers\' event nor shut hall past it (mutants: the reset)', async () => {
  const s = await stand();
  s.raw.prepare("UPDATE npc_chapter_weeks SET open = 'dev'").run();
  s.put(FIGHTERS, 9, 80, { event: 'crackdown', season: 0, shut: 1 });   // a chapter the opening Turning names not
  await settleChapterWeek(s.env.DB, WEEK + 2, turnOf(WEEK + 2), ZERO, 'on');
  assert.deepEqual({ ...s.raw.prepare('SELECT strength, event, event_season, event_data, shut_season FROM npc_chapters WHERE faction = 41 AND region = 9').get() },
    { strength: 50, event: null, event_season: null, event_data: '{}', shut_season: null });
});

test('CHAP6a the Chronicle reads a Season\'s lines - never a hidden guild\'s (mutants: none - the reader\'s own SQL)', async () => {
  const s = await stand();
  s.raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK + 7);
  s.put(FIGHTERS, ANTICLERE, 95, { event: 'ascendancy', season: 1 });
  s.put(THIEVES, ANTICLERE, 95, { event: 'ascendancy', season: 1 });
  await s.settle(WEEK + 8);
  const r = await chapterChronicle({ db: s.env.DB }, null, s.env, { region: ANTICLERE });
  assert.deepEqual(r.rows.filter((x) => x.kind === 'event').map((x) => chapterChronicleLine(x, r.zero)), ['At the end of the Season of Morning Star, the Fighters Guild stood ascendant.']);
});

// ── THE SERVICE: THE BOARD, THE SHEET, THE WRITS ────────────────────

const hourAt = (sec) => Math.floor((((Math.floor(sharedClassicMinutes(sec * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let x = from; x < from + 2 * 7200; x += 30) if (hourAt(x) === want && hourAt(x - 60) === want && hourAt(x + 60) === want) return x;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _rid = 0;
const rid = () => `chap6a-${String(++_rid).padStart(6, '0')}`;

/** A town of Anticlere with Fighters, Mages and Julianos halls witnessed, its ground, NOON in Season 1, and Alda - a member of the Fighters and the Mages. */
async function board(t) {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const week = meritWeekOf(NOON);
  const zero = week - 5;   // Season 1 from week - 1
  const s = await standService({ CHAPTERS_OPEN: 'on', PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', SEASON_ZERO_WEEK: String(zero) });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOON - days * DAY, who.id);
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`); age(w, 8);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [MAGES, FIGHTERS, JULIANOS] } }, w.secret)).status, 200);
  }
  const g = await s.registered('Ground'); age(g, 8);
  const p = herbPatches({ x: 300, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false })[0];
  assert.equal((await s.call('/v1/prof/harvest', {
    character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(NOON), slot: p.slot }), kind: 'herbs',
    climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: NOON - 2, rid: rid(),
  }, g.secret)).status, 200);
  const who = await s.registered('Alda');
  const R = await seatRealm(s.env, who.secret, 'Alda');
  await readRoll({ db: s.env.DB, nowS: NOON }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: { 41: 85, 40: 85 }, members: [{ f: 41, rank: 7 }, { f: 40, rank: 7 }] } });
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(week - 1);   // nothing due
  const put = (f, strength, o = {}) => raw.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at, event, event_season, event_data, shut_season)
    VALUES (?, 21, ?, ?, 0, 0, ?, ?, ?, ?)`).run(f, strength, week - 1, o.event ?? null, o.season ?? null, JSON.stringify(o.data ?? {}), o.shut ?? null);
  return { ...s, raw, who, R, week, put };
}

test('CHAP6a the board and the sheet say each chapter\'s Season\'s event - a Rivalry\'s rival named where it is public, a hidden rival to no stranger, a shut hall shut; last Season\'s event none (mutants: the Season, the rival\'s hiding, the shut, the sheet\'s spread)', async (t) => {
  const s = await board(t);
  s.put(FIGHTERS, 50, { event: 'rivalry', season: 1, data: { rival: THIEVES } });
  s.put(MAGES, 50, { event: 'rivalry', season: 1, data: { rival: JULIANOS }, shut: 1 });
  s.put(JULIANOS, 50, { event: 'crackdown', season: 0, shut: 0 });   // last Season's event, and a shut that was last Season's
  const l = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  assert.deepEqual(l.chapters.map((c) => [c.faction, c.event ?? null, c.rival ?? null, c.shut ?? false]), [[JULIANOS, null, null, false], [MAGES, 'rivalry', JULIANOS, true], [FIGHTERS, 'rivalry', null, false]]);
  assert.ok(l.chapters.every((c) => c.season === undefined), 'CHAP6c: no Season sent where no candidate is named');
  const sheet = (await s.call('/v1/chapters/list', {}, s.who.secret)).body;
  assert.deepEqual(sheet.chapters.map((c) => [c.f, c.event ?? null, c.rival ?? null, c.shut ?? false]), [[JULIANOS, null, null, false], [MAGES, 'rivalry', JULIANOS, true], [FIGHTERS, 'rivalry', null, false]]);
});

test('CHAP6a a shut hall posts no writs this Season - nor its members their own; a Crackdown\'s writs pay half again (mutants: the shut, the pay, the member writ\'s)', async (t) => {
  const s = await board(t);
  s.put(FIGHTERS, 50, { shut: 1 });
  s.put(MAGES, 50, { event: 'crackdown', season: 1 });
  const l = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  const halls = l.writs.filter((w) => w.kind === 'hall');
  assert.deepEqual([...new Set(halls.map((w) => w.faction))], [JULIANOS, MAGES], 'none of the shut Fighters\'');
  const posted = s.raw.prepare("SELECT slot, pay FROM writs WHERE kind = 'hall' AND faction = 40 ORDER BY slot").all();
  const member = l.writs.filter((w) => w.kind === 'member');
  assert.deepEqual(member.map((w) => w.faction), [MAGES], 'the member writ of the shut chapter never posted');
  // the pay: the same day's writs posted without the Crackdown, in a twin service
  const twin = await board(t);
  twin.put(MAGES, 50, {});
  await twin.call('/v1/writs/list', { character: twin.R.id, region: ANTICLERE }, twin.who.secret);
  const base = twin.raw.prepare("SELECT slot, pay FROM writs WHERE kind = 'hall' AND faction = 40 ORDER BY slot").all();
  assert.deepEqual(posted.map((w) => w.pay), base.map((w) => crackdownPay(w.pay)));
  // the member writ is drawn over its own character: the law's own draw, with the region's one witnessed pixel
  const day = utcDay(NOON);
  const own = memberWrit(day, ANTICLERE, MAGES, s.R.id, regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: false }], daySeason(day)));
  assert.equal(s.raw.prepare("SELECT pay FROM writs WHERE kind = 'member' AND faction = 40").get().pay, crackdownPay(own.pay));
});

test('CHAP6a the wiring: the chapters\' event columns and their check; the Season\'s rows in the Turning\'s own batch (mutants: none - the record)', () => {
  const mig = src('server-account/migrations/0100_npc_chapters.sql');
  assert.match(mig, /event     TEXT CHECK \(event IS NULL OR event IN \('calm', 'schism', 'succession', 'crackdown', 'rivalry', 'decline', 'ascendancy'\)\),\n  event_season INTEGER,\n  event_data TEXT NOT NULL DEFAULT '\{\}',\n  shut_season INTEGER,/);
  assert.match(src('server-account/src/npcChapters.js'), /\/\/ CHAP6a: the Season's own lines - each event's ending, and each Master who held the seat the whole of it/);
});
