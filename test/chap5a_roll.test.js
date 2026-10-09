// CHAP5a (2026-10-09, Mac: "Continue", the Chapters arc's living world - bible/11-Multiplayer/Chapters-Arc.md sections
// 5.3 and 9): THE HALL'S ROLL - the chapter sheet carries each chapter's seats' holders, by the names their characters
// carry now; the playing tab keeps them; and a hall of the chapter names them on its own bookshelf's first book, which a
// stranger to the guild may read too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chapterRollSeatsOf, chapterRollTitle, chapterRollLines, CHAPTER_ROLL_NAME_MAX, meritWeekOf,
} from '../src/net/npcChapterLaw.js';
import { REALM_NAME_MAX } from '../server-account/src/realm.js';
import { createChapterSheet } from '../src/net/chapterSheet.js';
import { chapterRollTokens, chapterRollBook, CHAPTER_ROLL_AUTHOR } from '../src/ui/chapterRoll.js';
import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40, THIEVES = 42, DRAGON = 368;
const tick = () => new Promise((r) => setImmediate(r));
const S = (seat, name) => ({ seat, name });

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP5a the seats as the roll reads them: the Master\'s first, then the officers in the sheet\'s order; a known seat with a name, at most the chapter\'s seats, a name at the realm\'s cap (mutants: the order, the caps, the guards)', () => {
  assert.deepEqual(chapterRollSeatsOf([S('officer', 'Bryn'), S('master', 'Alda'), S('officer', 'Cael')]), [S('master', 'Alda'), S('officer', 'Bryn'), S('officer', 'Cael')]);
  assert.deepEqual(chapterRollSeatsOf([S('master', 'Alda'), S('master', 'Mira'), S('officer', 'A'), S('officer', 'B'), S('officer', 'C'), S('officer', 'D')]),
    [S('master', 'Alda'), S('officer', 'A'), S('officer', 'B'), S('officer', 'C')], 'one Master, three officers');
  assert.deepEqual(chapterRollSeatsOf([S('keeper', 'X'), S('officer', ''), S('officer', '  '), S('master', 7), null, S('officer', ' Bryn ')]), [S('officer', 'Bryn')]);
  assert.equal(CHAPTER_ROLL_NAME_MAX, REALM_NAME_MAX);
  assert.equal(chapterRollSeatsOf([S('master', 'x'.repeat(40))])[0].name.length, CHAPTER_ROLL_NAME_MAX);
  for (const v of [null, undefined, 'master', {}]) assert.deepEqual(chapterRollSeatsOf(v), []);
});

test('CHAP5a the roll\'s words: its title by guild and region; the chapter\'s state, its Master, its officers - or the seats empty; never a hidden guild\'s (mutants: the title\'s guards, each line, the list)', () => {
  assert.equal(chapterRollTitle(FIGHTERS, ANTICLERE), 'The Roll of the Fighters Guild, Anticlere');
  assert.equal(chapterRollTitle(DRAGON, DAGGERFALL), 'The Roll of the Knights of the Dragon, Daggerfall');
  for (const [f, r] of [[THIEVES, ANTICLERE], [99, ANTICLERE], [FIGHTERS, 999], [FIGHTERS, null], ['41', ANTICLERE]]) assert.equal(chapterRollTitle(f, r), null, `${f} ${r}`);
  assert.deepEqual(chapterRollLines(FIGHTERS, { strength: 74, seats: [S('officer', 'Bryn'), S('master', 'Alda'), S('officer', 'Cael'), S('officer', 'Dara')] }), [
    'The Fighters Guild here is Thriving (Strength 74).', 'Master of the chapter: Alda.', 'Its officers: Bryn, Cael and Dara.',
  ]);
  assert.deepEqual(chapterRollLines(MAGES, { strength: 12, seats: [S('officer', 'Bryn')] }), [
    'The Mages Guild here is Failing (Strength 12).', 'The Master\'s seat stands empty.', 'Its officer: Bryn.',
  ]);
  assert.deepEqual(chapterRollLines(FIGHTERS, { strength: 50, seats: [S('master', 'Alda'), S('officer', 'Bryn'), S('officer', 'Cael')] }).slice(2), ['Its officers: Bryn and Cael.']);
  assert.deepEqual(chapterRollLines(FIGHTERS, { seats: [] }), ['The Master\'s seat stands empty.', 'No officer\'s seat is held.'], 'no Strength, no state');
});

// ── THE BOOK ────────────────────────────────────────────────────────

test('CHAP5a the roll as a book: its title centred in the title face, each line a paragraph; one page, its clerk the author (mutants: the title, the lines)', () => {
  const roll = { title: 'The Roll of the Fighters Guild, Anticlere', lines: ['Master of the chapter: Alda.', 'Its officer: Bryn.'] };
  const t = chapterRollTokens(roll);
  assert.deepEqual(t.filter((x) => typeof x.text === 'string').map((x) => x.text), [roll.title, ...roll.lines]);
  assert.deepEqual(t.slice(0, 2).map((x) => x.formatting !== undefined), [true, true]);
  assert.equal(t[1].x, 5, 'the title face');
  const b = chapterRollBook(roll);
  assert.deepEqual([b.title, b.author, b.pageCount], [roll.title, CHAPTER_ROLL_AUTHOR, 1]);
  assert.deepEqual(b.getPageTokens(0), t);
});

// ── THE SHEET THE TAB HOLDS ─────────────────────────────────────────

test('CHAP5a the sheet keeps the seats: a chapter\'s `{ strength, seats }`, a copy, the seats as the roll reads them; none for a chapter it does not name; Strength read as before; forgotten at a stop (mutants: the seats kept, the copy, the stop)', async () => {
  let answer = { ok: true, data: { week: 3, chapters: [
    { f: FIGHTERS, region: ANTICLERE, strength: 74, band: 'thriving', seats: [S('officer', 'Bryn'), S('master', 'Alda'), S('keeper', 'X')] },
    { f: MAGES, region: DAGGERFALL, strength: 12, band: 'failing' },
  ] } };
  let t = 0;
  const sheet = createChapterSheet({ door: { list: async () => answer }, nowMs: () => t });
  assert.equal(sheet.chapterOf(FIGHTERS, ANTICLERE), null, 'nothing before the read lands');
  await tick(); await tick();
  assert.deepEqual(sheet.chapterOf(FIGHTERS, ANTICLERE), { strength: 74, seats: [S('master', 'Alda'), S('officer', 'Bryn')] });
  assert.deepEqual(sheet.chapterOf(MAGES, DAGGERFALL), { strength: 12, seats: [] }, 'a sheet with no seats: none');
  assert.equal(sheet.chapterOf(FIGHTERS, DAGGERFALL), null);
  assert.deepEqual([sheet.strengthOf(FIGHTERS, ANTICLERE), sheet.strengthOf(MAGES, DAGGERFALL)], [74, 12]);
  sheet.chapterOf(FIGHTERS, ANTICLERE).seats[0].name = 'Nobody';
  sheet.chapterOf(FIGHTERS, ANTICLERE).seats.length = 0;
  assert.deepEqual(sheet.chapterOf(FIGHTERS, ANTICLERE).seats, [S('master', 'Alda'), S('officer', 'Bryn')], 'a reader\'s copy');
  t = 10 * 60_000;
  answer = { ok: false, error: 'chapters-closed' };
  sheet.refresh();
  await tick(); await tick();
  assert.equal(sheet.chapterOf(FIGHTERS, ANTICLERE), null, 'the Chapters shut to the account: forgotten');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

/** Anticlere's hall 77 witnessed with the Fighters, the Mages and the Thieves; three accounts with a realm character each. */
async function stand() {
  const s = await standService({ CHAPTERS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const nowS = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(nowS - 8 * 86_400, w.id);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions: [MAGES, FIGHTERS, THIEVES] } }, w.secret)).status, 200);
  }
  /** @type {Record<string, { who: any, id: string }>} */
  const chars = {};
  for (const name of ['Alda', 'Bryn', 'Cael']) {
    const who = await s.registered(name);
    chars[name] = { who, id: (await seatRealm(s.env, who.secret, name)).id };
  }
  const week = meritWeekOf(nowS);
  raw.prepare("INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, 'on', 0)").run(week - 1);   // nothing due: no Turning re-places the seats
  const seat = (name, f, region, kind, since) => raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(f, region, chars[name].id, chars[name].who.id, kind, since, week, nowS);
  return { ...s, raw, chars, seat, week };
}

test('CHAP5a the sheet\'s seats: each chapter\'s holders - its Master first, its officers by their tenure - by the names their characters carry now; never a hidden guild\'s; another region\'s its own (mutants: the join, the order, the key, the hidden)', async () => {
  const s = await stand();
  s.seat('Cael', FIGHTERS, ANTICLERE, 'officer', s.week - 1);
  s.seat('Bryn', FIGHTERS, ANTICLERE, 'officer', s.week - 5);
  s.seat('Alda', FIGHTERS, ANTICLERE, 'master', s.week);
  s.seat('Alda', MAGES, DAGGERFALL, 'officer', s.week);   // a chapter of no town the sheet names
  s.seat('Bryn', THIEVES, ANTICLERE, 'master', s.week);   // the underworld's: its members' alone
  const r = await s.call('/v1/chapters/list', {}, s.chars.Alda.who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.chapters.map((c) => [c.f, c.region, c.seats]), [
    [MAGES, ANTICLERE, []],
    [FIGHTERS, ANTICLERE, [S('master', 'Alda'), S('officer', 'Bryn'), S('officer', 'Cael')]],
  ]);
  s.raw.prepare('UPDATE realm_characters SET name = ? WHERE id = ?').run('Brynja', s.chars.Bryn.id);
  const again = (await s.call('/v1/chapters/list', {}, s.chars.Alda.who.secret)).body.chapters.find((c) => c.f === FIGHTERS);
  assert.deepEqual(again.seats.map((x) => x.name), ['Alda', 'Brynja', 'Cael'], 'named as it is now');
});

// ── THE HALL ────────────────────────────────────────────────────────

test('CHAP5a the wiring: the host\'s roll off the sheet in the politic region; the hall\'s shelf - the roll its first book, the books after it, a stranger refused the shelf reading the roll alone (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /chapterRoll: \(faction\) => \{\n\s+const px = playerTravelPixel\(\);\n\s+const region = \(\(\) => \{ try \{ return maps\.getRegionIndexAt\(px\.x, px\.y\); \} catch \{ return null; \} \}\)\(\);\n\s+const c = Number\.isInteger\(region\) \? chapterSheet\?\.chapterOf\(faction, region\) \?\? null : null;\n\s+const title = c \? chapterRollTitle\(faction, region\) : null;\n\s+return title \? \{ title, lines: chapterRollLines\(faction, c\) \} : null;/);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /const chapterRollOf = \(\/\*\* @type \{any\} \*\/ guild\) => \(guild \? host\.chapterRoll\?\.\(guild\.factionId\) \?\? null : null\);/);
  assert.match(m, /if \(!access\.allowed\) \{\n\s+const roll = chapterRollOf\(guild\);[^\n]*\n\s+interiorOverlay = roll \? chapterRollWindow\(roll\) : new ActionTextBox\(\[access\.text\]\);/);
  assert.match(m, /const roll = chapterRollOf\(guild\);   \/\/ CHAP5a: the shelf's first book\n\s+shelf\.books \?\?= populateBookshelf\(\);/);
  assert.match(m, /items: roll \? \[roll\.title, \.\.\.bookshelfTitles\(shelf\.books\)\] : bookshelfTitles\(shelf\.books\),/);
  assert.match(m, /if \(roll && i === 0\) \{ interiorOverlay = chapterRollWindow\(roll\); return; \}[^\n]*\n\s+_openBookById\(\{ message: shelf\.books\[roll \? i - 1 : i\] \}\);/);
  assert.match(src('src/ui/chapterRoll.js'), /export const chapterRollWindow = \([^)]*roll\) => createBookReaderWindow\(chapterRollBook\(roll\)\);/);
});
