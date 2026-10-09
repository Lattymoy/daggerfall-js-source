// @ts-nocheck
// CHAP6b (2026-10-09, Mac: "continue", the Chapters arc's sixth slice - bible/11-Multiplayer/Chapters-Arc.md section 7):
// THE SCHISM, THE SUCCESSION, THE DOCTRINE. The law: the three doctrines and what each does, a Schism's two by its own
// roll, the sides a member may back, a Schism's winner (a tie the Master's vote), a Succession's heir, the doctrine's writ,
// the lines in words. The service: a member's backing (`/v1/chapters/back` - its refusals, one an account a chapter a
// Season, changed until decided), the Succession named at the Season's third Turning, the Schism decided at its end and
// its doctrine holding the next Season, the doctrine's writ on the board, the sheet's and the board's sides, heir,
// doctrine and the reader's own backing, the opening's reset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTER_DOCTRINES, CHAPTER_DOCTRINE_EFFECTS, chapterDoctrineOk, schismDoctrinesOf, chapterSidesOf, chapterBackOk, schismWinner,
  successionHeir, doctrineWritCount, SUCCESSION_CANDIDATES, SUCCESSION_TURNING, chapterSeasonLine, chapterChronicleLine, meritWeekOf,
} from '../src/net/npcChapterLaw.js';
import { seatWeekStartMs } from '../src/net/townSeatLaw.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { settleChapterWeek, backChapter, chapterChronicle, CHAPTER_TURNING_GRACE_S } from '../server-account/src/npcChapters.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { standService, T0, confirmChapters } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const DAY = 86_400, WOODS = 231, ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40, THIEVES = 42;
const NOW = T0 + 3 * DAY;
const WEEK = meritWeekOf(NOW);
/** Season 1 from WEEK - 1: NOW is its second week; its third Turning closes WEEK + 1, its last WEEK + 6. */
const ZERO = WEEK - 5;
const START = WEEK - 1, LAST = START + 7;
const turnOf = (w) => seatWeekStartMs(w + 1) / 1000 + CHAPTER_TURNING_GRACE_S + 1;
const inWeek = (w) => seatWeekStartMs(w) / 1000 + 3600;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP6b the doctrines: training, the shelf, writs - what each does; a Schism\'s two by its own roll, the third left out, the two in order (mutants: the list, the effects, the salt, the key, the leaving out)', () => {
  assert.deepEqual(CHAPTER_DOCTRINES, ['training', 'shelf', 'writs']);
  assert.deepEqual(CHAPTER_DOCTRINE_EFFECTS, { training: 0.9, shelf: 2, writs: 1 });
  assert.deepEqual([chapterDoctrineOk('writs'), chapterDoctrineOk('Writs'), chapterDoctrineOk(null)], [true, false, false]);
  const n = { training: 0, shelf: 0, writs: 0 };
  for (let s = 0; s < 900; s++) {
    const two = schismDoctrinesOf(s, MAGES, ANTICLERE);   // PIN MOVED (AUDIT CHAP5 D3): a guild of the three (the Fighters keep no shelf)
    assert.equal(two.length, 2);
    assert.deepEqual(two, CHAPTER_DOCTRINES.filter((d) => two.includes(d)), 'in the doctrines\' order');
    n[CHAPTER_DOCTRINES.find((d) => !two.includes(d))]++;
  }
  for (const d of CHAPTER_DOCTRINES) assert.ok(Math.abs(n[d] - 300) < 60, `${d} left out ${n[d]}`);
  assert.deepEqual(Array.from({ length: 12 }, (_, s) => schismDoctrinesOf(s, MAGES, DAGGERFALL).join('+')), GOLDEN_MAGES);
  assert.notDeepEqual(Array.from({ length: 12 }, (_, s) => schismDoctrinesOf(s, MAGES, ANTICLERE).join('+')), GOLDEN_MAGES, 'the region in the roll');
});
/** The Mages of Daggerfall's Schisms' doctrines, Seasons 0 to 11 - the roll as every reader rolls it (a change is a new law). */
// PIN MOVED (AUDIT CHAP5 E3): the roll scaled (drawOf), never its remainder
const GOLDEN_MAGES = ['training+shelf', 'training+shelf', 'training+writs', 'shelf+writs', 'training+shelf', 'shelf+writs', 'training+writs', 'training+shelf', 'shelf+writs', 'training+writs', 'training+shelf', 'training+writs'];

test('CHAP6b the sides: a Schism\'s two, a Succession\'s three candidates, no other event\'s (mutants: each count, the bounds)', () => {
  assert.deepEqual([chapterSidesOf('schism'), chapterSidesOf('succession'), chapterSidesOf('rivalry'), chapterSidesOf(null)], [2, SUCCESSION_CANDIDATES, 0, 0]);
  assert.equal(SUCCESSION_CANDIDATES, 3);
  assert.equal(SUCCESSION_TURNING, 3);
  assert.deepEqual([0, 1, 2, -1, 0.5, '1'].map((s) => chapterBackOk('schism', s)), [true, true, false, false, false, false]);
  assert.deepEqual([0, 1, 2, 3].map((s) => chapterBackOk('succession', s)), [true, true, true, false]);
  assert.equal(chapterBackOk('calm', 0), false);
});

test('CHAP6b a Schism\'s winner and a Succession\'s heir: more Merit carries it, a tie the Master\'s side (its vote), none with no Master; the Master\'s naming, else the most-Merit backer\'s, else the hall\'s first (mutants: each)', () => {
  assert.deepEqual([schismWinner([300, 200]), schismWinner([200, 300]), schismWinner([100, 100], 1), schismWinner([100, 100], 0), schismWinner([0, 0], null)], [0, 1, 1, 0, null]);
  assert.equal(schismWinner([300, 200], 1), 0, 'the Master\'s side carries nothing it did not earn');
  assert.deepEqual([schismWinner([5, 5], 2), schismWinner([NaN, 1]), schismWinner(null, 1)], [null, 1, 1]);
  assert.deepEqual([successionHeir(2, 1), successionHeir(0, 1), successionHeir(null, 1), successionHeir(null, 0), successionHeir(null, null)], [2, 0, 1, 0, 0]);
  assert.deepEqual([doctrineWritCount(4, 'writs'), doctrineWritCount(4, 'shelf'), doctrineWritCount(4, null)], [5, 4, 4]);
});

test('CHAP6b the lines: a Schism\'s doctrine in words, or neither side carried; a Succession\'s new head (mutants: each word)', () => {
  const ev = (event, d = {}) => chapterSeasonLine({ kind: 'event', faction: FIGHTERS, data: { season: 1, event, ...d } });
  assert.equal(ev('schism', { doctrine: 'training' }), 'At the end of the Season of Morning Star, the Fighters Guild\'s schism ended, and it holds to cheaper training for the Season after.');
  assert.equal(ev('schism', { doctrine: 'shelf' }), 'At the end of the Season of Morning Star, the Fighters Guild\'s schism ended, and it holds to a deeper shelf for the Season after.');
  assert.equal(ev('schism', { doctrine: 'writs' }), 'At the end of the Season of Morning Star, the Fighters Guild\'s schism ended, and it holds to more writs for the Season after.');
  assert.equal(ev('schism', { doctrine: 'gold' }), 'At the end of the Season of Morning Star, the Fighters Guild\'s schism ended with neither side carried.');
  assert.equal(ev('succession', { heir: 0 }), 'At the end of the Season of Morning Star, the Fighters Guild\'s hall took a new head.');
  assert.equal(ev('succession', { heir: '1' }), null, 'no heir named, no line');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** Season 1 counted from START; Anticlere's and Daggerfall's chapters confirmed; members with realm characters. */
async function stand() {
  const s = await standService({ CHAPTERS_OPEN: 'on', SEASON_ZERO_WEEK: String(ZERO) });
  const raw = s.env.DB._raw;
  confirmChapters(raw, [ANTICLERE, DAGGERFALL]);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(WEEK - 1);
  const put = (f, g, { event = null, season = 1, data = {}, doctrine = null, doctrineSeason = null } = {}) => raw.prepare(`INSERT INTO npc_chapters
    (faction, region, strength, week, merit, at, event, event_season, event_data, doctrine, doctrine_season) VALUES (?, ?, 50, ?, 0, 0, ?, ?, ?, ?, ?)
    ON CONFLICT (faction, region) DO UPDATE SET event = excluded.event, event_season = excluded.event_season, event_data = excluded.event_data,
      doctrine = excluded.doctrine, doctrine_season = excluded.doctrine_season`).run(f, g, WEEK - 1, event, season, JSON.stringify(data), doctrine, doctrineSeason);
  const row = (f, g) => { const r = raw.prepare('SELECT * FROM npc_chapters WHERE faction = ? AND region = ?').get(f, g); return { ...r, event_data: JSON.parse(r.event_data) }; };
  const member = async (name, factions = [FIGHTERS, MAGES]) => {
    const who = await s.registered(name);
    const R = await seatRealm(s.env, who.secret, name);
    await readRoll({ db: s.env.DB, nowS: NOW }, { id: who.id }, {
      character: R.id, lease: R.lease, seed: { factions: Object.fromEntries(factions.map((f) => [f, 85])), members: factions.map((f) => ({ f, rank: 7 })) },
    });
    return { who, R, id: R.id };
  };
  let n = 0;
  const merit = (m, f, g, week, amount) => raw.prepare(`INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at)
    VALUES (?, ?, ?, ?, ?, 'writ', ?, ?, 0)`).run(week, f, g, m.who.id, m.id, amount, `w:${++n}`);
  const back = (m, f, g, side, nowS = NOW, character = m.id) => backChapter({ db: s.env.DB, nowS }, { id: m.who.id }, s.env, { character, faction: f, region: g, side });
  const backs = () => raw.prepare('SELECT faction, region, season, account, char_id, side FROM npc_chapter_backing ORDER BY faction, region, account').all().map((r) => ({ ...r }));
  const settle = (w) => settleChapterWeek(s.env.DB, w, turnOf(w), ZERO, 'on');
  const weekRow = (w) => raw.prepare("INSERT OR IGNORE INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(w);
  const master = (m, f, g) => raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, 'master', ?, ?, 0)").run(f, g, m.id, m.who.id, START - 1, START - 1);
  return { ...s, raw, put, row, member, merit, back, backs, settle, weekRow, master };
}

test('CHAP6b a member\'s backing: a Schism\'s side or a Succession\'s candidate, one an account a chapter a Season (changed, its last character\'s), through the route (mutants: the upsert, the account key, the season, the route)', async (t) => {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const s = await stand();
  s.put(FIGHTERS, ANTICLERE, { event: 'schism' });
  s.put(MAGES, ANTICLERE, { event: 'succession' });
  const a = await s.member('Alda');
  assert.deepEqual(await s.back(a, FIGHTERS, ANTICLERE, 1), { ok: true, event: 'schism', side: 1 });
  assert.deepEqual(await s.back(a, MAGES, ANTICLERE, 2), { ok: true, event: 'succession', side: 2 });
  assert.deepEqual(await s.back(a, FIGHTERS, ANTICLERE, 0), { ok: true, event: 'schism', side: 0 }, 'changed');
  const alt = await seatRealm(s.env, a.who.secret, 'Alda Two');
  await readRoll({ db: s.env.DB, nowS: NOW }, { id: a.who.id }, { character: alt.id, lease: alt.lease, seed: { factions: { 41: 85 }, members: [{ f: 41, rank: 7 }] } });
  assert.equal((await s.back(a, FIGHTERS, ANTICLERE, 1, NOW, alt.id)).ok, true);
  assert.deepEqual(s.backs().map((b) => [b.faction, b.region, b.season, b.account, b.char_id, b.side]),
    [[MAGES, ANTICLERE, 1, a.who.id, a.id, 2], [FIGHTERS, ANTICLERE, 1, a.who.id, alt.id, 1]], 'one an account a chapter a Season: the alt\'s backing the account\'s');
  const r = await s.call('/v1/chapters/back', { character: a.id, faction: FIGHTERS, region: ANTICLERE, side: 0 }, a.who.secret);
  assert.deepEqual([r.status, r.body], [200, { ok: true, event: 'schism', side: 0 }]);
  assert.deepEqual(s.backs().filter((x) => x.faction === FIGHTERS).map((x) => [x.char_id, x.side]), [[a.id, 0]], 'the change landed');
});

test('CHAP6b a backing refused: a bad body, no event to back (none counted, none drawn, last Season\'s), no such side, a Succession decided or past its third Turning, no member (none, dormant, dead, another\'s) - each its status through the route (mutants: each refusal)', async (t) => {
  t.mock.method(Date, 'now', () => NOW * 1000);
  const s = await stand();
  s.put(FIGHTERS, ANTICLERE, { event: 'schism' });
  s.put(MAGES, ANTICLERE, { event: 'succession' });
  s.put(FIGHTERS, DAGGERFALL, { event: 'schism', season: 0 });
  s.put(MAGES, DAGGERFALL, { event: 'rivalry', data: { rival: 27 } });
  const a = await s.member('Alda');
  const b = await s.member('Bryn', [MAGES]);
  const err = async (...x) => (await s.back(...x)).error;
  assert.deepEqual(await backChapter({ db: s.env.DB, nowS: NOW }, { id: a.who.id }, s.env, { character: 'x', faction: FIGHTERS, region: ANTICLERE, side: 0 }), { error: 'body' });
  assert.deepEqual([await err(a, FIGHTERS, ANTICLERE, 0.5), await err(a, FIGHTERS, 999, 0)], ['body', 'body']);
  assert.equal(await err(a, FIGHTERS, DAGGERFALL, 0), 'no-event', 'last Season\'s Schism');
  assert.equal(await err(a, MAGES, DAGGERFALL, 0), 'no-event', 'a Rivalry has no sides');
  assert.equal(await err(a, THIEVES, ANTICLERE, 0), 'no-event', 'no row at all');
  assert.deepEqual([await err(a, FIGHTERS, ANTICLERE, 2), await err(a, MAGES, ANTICLERE, 3)], ['no-side', 'no-side']);
  assert.equal(await err(b, FIGHTERS, ANTICLERE, 0), 'not-member', 'not the guild\'s');
  assert.equal(await err(a, FIGHTERS, ANTICLERE, 0, NOW, b.id), 'not-member', 'another account\'s character');
  s.raw.prepare('UPDATE npc_roll SET dormant = 1 WHERE char_id = ? AND faction_id = ?').run(b.id, MAGES);
  assert.equal(await err(b, MAGES, ANTICLERE, 0), 'not-member', 'a dormant membership');
  s.raw.prepare('UPDATE npc_roll SET dormant = 0').run();
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(NOW, b.id);
  assert.equal(await err(b, MAGES, ANTICLERE, 0), 'not-member', 'a dead character');
  assert.equal((await s.back(a, MAGES, ANTICLERE, 0, inWeek(START + 2))).ok, true, 'the third week: still open');
  assert.equal(await err(a, MAGES, ANTICLERE, 0, seatWeekStartMs(START + 3) / 1000 + 10), 'closed', 'past the third week, its Turning not yet settled (the grace)');
  assert.equal(s.row(MAGES, ANTICLERE).event_data.heir, undefined, 'the week alone closed it');
  s.put(MAGES, ANTICLERE, { event: 'succession', data: { heir: 1 } });
  assert.equal(await err(a, MAGES, ANTICLERE, 0), 'closed', 'named');
  const none = await standService({ CHAPTERS_OPEN: 'on' });
  confirmChapters(none.env.DB._raw, [ANTICLERE]);
  assert.deepEqual(await backChapter({ db: none.env.DB, nowS: NOW }, { id: 'x' }, none.env, { character: a.id, faction: FIGHTERS, region: ANTICLERE, side: 0 }), { error: 'no-event' }, 'no Season counted');
  const d = await s.member('Dara', [MAGES]);
  const st = async (body, who = a) => (await s.call('/v1/chapters/back', body, who.who.secret)).status;
  assert.deepEqual([
    await st({ character: a.id, faction: FIGHTERS, region: ANTICLERE, side: 5 }), await st({ character: a.id, faction: THIEVES, region: ANTICLERE, side: 0 }),
    await st({ character: a.id, faction: MAGES, region: ANTICLERE, side: 0 }), await st({ character: d.id, faction: FIGHTERS, region: ANTICLERE, side: 0 }, d),
  ], [400, 409, 409, 403]);
});

test('CHAP6b the Succession named at the Season\'s third Turning: the Master\'s naming, else the most-Merit backer\'s (its Season\'s Merit at the chapter alone), else the hall\'s first; a third Turning missed names at the next (mutants: the Turning, the Master, the Merit\'s window and chapter, the ranking, the order)', async () => {
  const s = await stand();
  for (const g of [ANTICLERE, DAGGERFALL]) for (const f of [FIGHTERS, MAGES]) s.put(f, g, { event: 'succession' });
  const [a, b, c] = [await s.member('Alda'), await s.member('Bryn'), await s.member('Cael')];
  s.master(a, FIGHTERS, ANTICLERE);
  // Fighters, Anticlere: the Master names 2 over a richer backer's 1
  await s.back(a, FIGHTERS, ANTICLERE, 2); await s.back(b, FIGHTERS, ANTICLERE, 1);
  s.merit(b, FIGHTERS, ANTICLERE, START, 500);
  // Mages, Anticlere: no Master's word - Cael earned the chapter more this Season than Bryn (whose Merit lies before it, and elsewhere)
  await s.back(b, MAGES, ANTICLERE, 1); await s.back(c, MAGES, ANTICLERE, 2);
  s.merit(c, MAGES, ANTICLERE, START + 1, 200);
  s.merit(b, MAGES, ANTICLERE, START + 1, 150);
  s.merit(b, MAGES, ANTICLERE, START - 1, 400);
  s.merit(b, MAGES, 18, START + 1, 400);   // another chapter's
  // Fighters, Daggerfall: backers with no Merit - the hall's own first
  await s.back(a, FIGHTERS, DAGGERFALL, 2);
  // Mages, Daggerfall: a tie - the lower account, whichever backed first (the higher backs first here)
  const [lo, hi] = [b, c].sort((x, y) => (x.who.id < y.who.id ? -1 : 1));
  await s.back(hi, MAGES, DAGGERFALL, hi === b ? 1 : 2); await s.back(lo, MAGES, DAGGERFALL, lo === b ? 1 : 2);
  s.merit(b, MAGES, DAGGERFALL, START, 100); s.merit(c, MAGES, DAGGERFALL, START, 100);
  await s.settle(START + 1);
  assert.equal(s.row(FIGHTERS, ANTICLERE).event_data.heir, undefined, 'the second Turning names none');
  s.master(a, FIGHTERS, ANTICLERE);   // the Turning placed the seats by Merit again: Alda seated for the third
  s.raw.prepare("INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, 'officer', ?, ?, 0)").run(MAGES, ANTICLERE, c.id, c.who.id, START, START);   // an officer's naming is a member's
  await s.settle(START + 2);
  assert.deepEqual(s.row(FIGHTERS, ANTICLERE).event_data, { heir: 2, named: 'master' });
  assert.deepEqual(s.row(MAGES, ANTICLERE).event_data, { heir: 2, named: 'member' });
  assert.deepEqual(s.row(FIGHTERS, DAGGERFALL).event_data, { heir: 0, named: 'hall' });
  assert.deepEqual(s.row(MAGES, DAGGERFALL).event_data, { heir: lo === b ? 1 : 2, named: 'member' });
  assert.equal((await s.back(a, FIGHTERS, ANTICLERE, 0, inWeek(START + 2))).error, 'closed', 'named: closed');
  s.raw.prepare('UPDATE npc_chapter_backing SET side = 0 WHERE account = ? AND faction = ? AND region = ?').run(a.who.id, FIGHTERS, ANTICLERE);   // a backing moved after (none can)
  s.weekRow(START + 2);
  await s.settle(START + 3);
  assert.deepEqual(s.row(FIGHTERS, ANTICLERE).event_data, { heir: 2, named: 'master' }, 'named once');
  const late = await stand();
  late.put(FIGHTERS, ANTICLERE, { event: 'succession' });
  late.weekRow(START + 2);
  await late.settle(START + 3);
  assert.deepEqual(late.row(FIGHTERS, ANTICLERE).event_data, { heir: 0, named: 'hall' }, 'a missed third Turning: the next names');
});

test('CHAP6b the Schism decided at the Season\'s end: its sides\' backers\' Merit that Season, a tie the Master\'s side, none carried none; the doctrine the next Season\'s; the Chronicle\'s line (mutants: the sums, the Master, the doctrine, its Season, the rows)', async () => {
  const s = await stand();
  s.weekRow(LAST - 1);
  for (const f of [FIGHTERS, MAGES]) for (const g of [ANTICLERE, DAGGERFALL]) s.put(f, g, { event: 'schism' });
  const [a, b, c] = [await s.member('Alda'), await s.member('Bryn'), await s.member('Cael')];
  // Fighters, Anticlere: side 1 carried, 300 to 250 (the Master's 50 on side 0 counted as any member's)
  s.master(a, FIGHTERS, ANTICLERE);
  await s.back(a, FIGHTERS, ANTICLERE, 0); await s.back(b, FIGHTERS, ANTICLERE, 0); await s.back(c, FIGHTERS, ANTICLERE, 1);
  s.merit(a, FIGHTERS, ANTICLERE, START, 50); s.merit(b, FIGHTERS, ANTICLERE, START + 3, 200); s.merit(c, FIGHTERS, ANTICLERE, LAST, 300);
  s.merit(b, FIGHTERS, ANTICLERE, START - 1, 999);   // last Season's
  // Mages, Anticlere: a tie, the Master's side
  s.master(b, MAGES, ANTICLERE);
  await s.back(b, MAGES, ANTICLERE, 1); await s.back(c, MAGES, ANTICLERE, 0);
  s.merit(b, MAGES, ANTICLERE, START, 100); s.merit(c, MAGES, ANTICLERE, START, 100);
  // Fighters, Daggerfall: a tie and no Master's backing - none carried
  await s.back(b, FIGHTERS, DAGGERFALL, 1); await s.back(c, FIGHTERS, DAGGERFALL, 0);
  await s.settle(LAST);
  const two = (f, g) => schismDoctrinesOf(1, f, g);
  assert.deepEqual([s.row(FIGHTERS, ANTICLERE).doctrine, s.row(FIGHTERS, ANTICLERE).doctrine_season], [two(FIGHTERS, ANTICLERE)[1], 2]);
  assert.deepEqual([s.row(MAGES, ANTICLERE).doctrine, s.row(MAGES, ANTICLERE).doctrine_season], [two(MAGES, ANTICLERE)[1], 2]);
  assert.deepEqual([s.row(FIGHTERS, DAGGERFALL).doctrine, s.row(MAGES, DAGGERFALL).doctrine], [null, null]);
  const rows = s.raw.prepare("SELECT faction, region, data FROM npc_chapter_history WHERE kind = 'event' ORDER BY faction, region").all().map((r) => [r.faction, r.region, JSON.parse(r.data)]);
  assert.deepEqual(rows, [
    [MAGES, DAGGERFALL, { sums: [0, 0], doctrine: null, season: 1, event: 'schism' }],
    [MAGES, ANTICLERE, { sums: [100, 100], doctrine: two(MAGES, ANTICLERE)[1], season: 1, event: 'schism' }],
    [FIGHTERS, DAGGERFALL, { sums: [0, 0], doctrine: null, season: 1, event: 'schism' }],
    [FIGHTERS, ANTICLERE, { sums: [250, 300], doctrine: two(FIGHTERS, ANTICLERE)[1], season: 1, event: 'schism' }],
  ]);
  const r = await chapterChronicle({ db: s.env.DB }, null, s.env, { region: ANTICLERE });
  assert.ok(r.rows.map((x) => chapterChronicleLine(x, r.zero)).includes(`At the end of the Season of Morning Star, the Fighters Guild's schism ended, and it holds to ${{ training: 'cheaper training', shelf: 'a deeper shelf', writs: 'more writs' }[two(FIGHTERS, ANTICLERE)[1]]} for the Season after.`));
});

test('CHAP6b the opening week: no developers\' doctrine past it (mutants: the reset)', async () => {
  const s = await stand();
  s.raw.prepare("UPDATE npc_chapter_weeks SET open = 'dev'").run();
  s.put(FIGHTERS, 9, { doctrine: 'writs', doctrineSeason: 1 });
  await settleChapterWeek(s.env.DB, WEEK + 1, turnOf(WEEK + 1), ZERO, 'on');
  assert.deepEqual({ ...s.raw.prepare('SELECT doctrine, doctrine_season FROM npc_chapters WHERE faction = 41 AND region = 9').get() }, { doctrine: null, doctrine_season: null });
});

// ── THE BOARD AND THE SHEET ─────────────────────────────────────────

const hourAt = (sec) => Math.floor((((Math.floor(sharedClassicMinutes(sec * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let x = from; x < from + 2 * 7200; x += 30) if (hourAt(x) === want && hourAt(x - 60) === want && hourAt(x + 60) === want) return x;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _rid = 0;
const rid = () => `chap6b-${String(++_rid).padStart(6, '0')}`;

async function board(t) {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const week = meritWeekOf(NOON);
  const s = await standService({ CHAPTERS_OPEN: 'on', PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', SEASON_ZERO_WEEK: String(week - 5) });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOON - days * DAY, who.id);
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`); age(w, 8);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [MAGES, FIGHTERS] } }, w.secret)).status, 200);
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
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(week - 1);
  const put = (f, o = {}) => raw.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at, event, event_season, event_data, doctrine, doctrine_season)
    VALUES (?, 21, 50, ?, 0, 0, ?, ?, ?, ?, ?)`).run(f, week - 1, o.event ?? null, o.season ?? 1, JSON.stringify(o.data ?? {}), o.doctrine ?? null, o.doctrineSeason ?? null);
  return { ...s, raw, who, R, week, put };
}

test('CHAP6b the board and the sheet: a Schism\'s two doctrines, a Succession\'s heir once named, the doctrine holding (last Season\'s none), the reader\'s own backing on the board (mutants: the sides, the heir, the doctrine\'s Season, the backing)', async (t) => {
  const s = await board(t);
  s.put(FIGHTERS, { event: 'schism', doctrine: 'shelf', doctrineSeason: 0 });
  s.put(MAGES, { event: 'succession', data: { heir: 2 }, doctrine: 'training', doctrineSeason: 1 });
  assert.equal((await s.call('/v1/chapters/back', { character: s.R.id, faction: FIGHTERS, region: ANTICLERE, side: 1 }, s.who.secret)).status, 200);
  s.raw.prepare("INSERT INTO npc_chapter_backing (faction, region, season, account, char_id, side, at) VALUES (?, ?, 1, 'another', 'cx', 0, 0)").run(MAGES, ANTICLERE);   // another account's
  const l = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  const view = (c) => [c.faction ?? c.f, c.event, c.sides ?? null, c.heir ?? null, c.doctrine ?? null, c.backed ?? null];
  assert.deepEqual(l.chapters.map(view), [[MAGES, 'succession', null, 2, 'training', null], [FIGHTERS, 'schism', schismDoctrinesOf(1, FIGHTERS, ANTICLERE), null, null, 1]]);
  assert.deepEqual(l.chapters.map((c) => c.season ?? null), [1, 1], 'CHAP6c: the Season their candidates are named on');
  const sheet = (await s.call('/v1/chapters/list', {}, s.who.secret)).body;
  assert.deepEqual(sheet.chapters.map((c) => c.season ?? null), [1, 1]);
  assert.deepEqual(sheet.chapters.map(view), [[MAGES, 'succession', null, 2, 'training', null], [FIGHTERS, 'schism', schismDoctrinesOf(1, FIGHTERS, ANTICLERE), null, null, null]], 'the sheet is no one\'s');
});

test('CHAP6b "more writs": a chapter whose doctrine it is posts one hall writ more a day (mutants: the count)', async (t) => {
  const s = await board(t);
  s.put(MAGES, { doctrine: 'writs', doctrineSeason: 1 });
  await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret);
  const twin = await board(t);
  twin.put(MAGES, {});
  await twin.call('/v1/writs/list', { character: twin.R.id, region: ANTICLERE }, twin.who.secret);
  const n = (x) => x.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'hall' AND faction = 40").get().n;
  assert.equal(n(s), n(twin) + 1);
});
