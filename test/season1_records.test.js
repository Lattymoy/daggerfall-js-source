// SEASON1 part three (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE HALL OF RECORDS (bible/
// 11-Multiplayer/Seats-Arc.md 9.2: "A Hall of Records book in every seat's palace ... read it as prose, from templates in
// the law module ... The book is read through the enhanced book window the port already has") - the law (a row's week in
// its Season's words, the book's chapters), the book (its tokens through the reader's one door), the service's read
// (through the real Worker: oldest first, its bound, the week Season 0 began), the client's door and book, and the
// palace's shelves and the Seat tab by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { chronicleWhen, chronicleLine, hallOfRecordsChapters, hallOfRecordsTitle, HALL_OF_RECORDS_EMPTY, HALL_OF_RECORDS_ROWS, seatWeekOf, SEAT_CHRONICLE_SHOWN, seatReportText } from '../src/net/townSeatLaw.js';
import { hallOfRecordsTokens, hallOfRecordsBook, hallOfRecordsWindow, HALL_OF_RECORDS_AUTHOR } from '../src/ui/hallOfRecords.js';
import { createBookReaderWindow } from '../src/ui/bookDoor.js';
import { BookReaderWindow } from '../src/ui/bookReader.js';
import { RSC, TOKEN_TEXT } from '../src/formats/textRsc.js';
import { createTownSeatBook, SEAT_RECORDS_CACHE_MS } from '../src/net/townSeatBook.js';
import { HALL_OF_RECORDS_TEXT, HALL_OF_RECORDS_SHUT } from '../src/systems/onlineHomes.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SEASON1 THE HALL OF RECORDS\' LAW: a row\'s week in its Season\'s words - "the third week of the Season of Morning Star", Season 0\'s weeks too - and the week\'s number with none counted or before Season 0; the Chronicle\'s every line reads it; the book\'s chapters, one a Season in order, rows from no Season unheaded, a row with no words left out; its title and its empty page (mutants: the ordinal; the Season; the fallback; the chapters\' break; the heading; the drop)', () => {
  // Season 0 weeks 10-13, Season 1 (Morning Star) 14-21, Season 2 (Sun's Dawn) 22-29
  assert.deepEqual([chronicleWhen(12, null), chronicleWhen(9, 10), chronicleWhen(11, 10), chronicleWhen(14, 10), chronicleWhen(16, 10), chronicleWhen(21, 10), chronicleWhen(22, 10)],
    ['In week 12', 'In week 9', 'In the second week of Season 0', 'In the first week of the Season of Morning Star', 'In the third week of the Season of Morning Star', 'In the eighth week of the Season of Morning Star', 'In the first week of the Season of Sun\'s Dawn']);
  const claim = { kind: 'claim', week: 16, data: { guild: SH, total: 6200 } };
  assert.equal(chronicleLine(claim, ANTICLERE), 'In week 16, the Silver Hand <SH> took the Charter of Anticlere with 6,200 influence.', 'none counted: as before');
  assert.equal(chronicleLine(claim, ANTICLERE, 10), 'In the third week of the Season of Morning Star, the Silver Hand <SH> took the Charter of Anticlere with 6,200 influence.');
  assert.match(chronicleLine({ kind: 'siege-held', week: 23, data: { guild: SH, against: EO } }, ANTICLERE, 10), /^In the second week of the Season of Sun's Dawn, the Silver Hand <SH> held Anticlere against the siege of Ebon Oath <EO>\.$/);
  const rows = [
    { kind: 'claim', week: 8, data: { guild: EO, total: 6000 } },
    { kind: 'held', week: 11, data: { guild: EO, standing: 55 } },
    { kind: 'nonsense', week: 12, data: {} },
    claim,
    { kind: 'season-end', week: 21, data: { guild: SH, season: 1, kept: false } },
    { kind: 'edict', week: 23, data: { guild: SH, edict: 'festival' } },
  ];
  const chapters = hallOfRecordsChapters(rows, ANTICLERE, 10);
  assert.deepEqual(chapters.map((c) => [c.heading, c.lines.length]), [[null, 1], ['Season 0', 1], ['the Season of Morning Star', 2], ['the Season of Sun\'s Dawn', 1]]);
  assert.equal(chapters[3].lines[0], 'In the second week of the Season of Sun\'s Dawn, the Silver Hand <SH> proclaimed a Festival at Anticlere.');   // PIN MOVED (AUDIT-SEATS L7): 9.2's article
  assert.equal(chapters[2].lines[1], 'At the end of the Season of Morning Star, the Silver Hand <SH> held Anticlere.');
  assert.deepEqual(hallOfRecordsChapters(rows, ANTICLERE, null).map((c) => [c.heading, c.lines.length]), [[null, 5]], 'none counted: one chapter, unheaded');
  assert.deepEqual([hallOfRecordsChapters([], ANTICLERE), hallOfRecordsChapters(null, ANTICLERE)], [[], []]);
  assert.equal(hallOfRecordsTitle(ANTICLERE), 'The Hall of Records of Anticlere');
  assert.equal(HALL_OF_RECORDS_EMPTY, 'Nothing is written here yet.');
  assert.equal(HALL_OF_RECORDS_ROWS, 400);
});

test('SEASON1 THE HALL OF RECORDS AS A BOOK: the title centred in the title face, each Season\'s name centred and capitalised over its chapter, each line a paragraph with a blank row after; an empty Hall says so; the reader\'s one door reads it as any book - its title, its author, its lines (mutants: the title\'s face; the centring; the capital; the blank rows; the empty page; the book\'s shape)', () => {
  const rows = [{ kind: 'held', week: 11, data: { guild: EO, standing: 55 } }, { kind: 'claim', week: 16, data: { guild: SH, total: 6200 } }];
  const t = hallOfRecordsTokens(ANTICLERE, rows, 10);
  assert.deepEqual(t.slice(0, 5), [{ formatting: RSC.JustifyCenter }, { formatting: RSC.FontPrefix, x: 5 }, { formatting: TOKEN_TEXT, text: 'The Hall of Records of Anticlere' }, { formatting: RSC.NewLine }, { formatting: RSC.NewLine }]);
  const book = hallOfRecordsBook(ANTICLERE, rows, 10);
  assert.deepEqual([book.title, book.author, book.pageCount, book.getPageTokens(0)], ['The Hall of Records of Anticlere', 'the Chronicle of the Seats', 1, t]);
  assert.equal(HALL_OF_RECORDS_AUTHOR, 'the Chronicle of the Seats');
  const w = hallOfRecordsWindow(ANTICLERE, rows, 10);
  assert.ok(w instanceof BookReaderWindow, 'through the reader\'s one door');
  assert.deepEqual(w.lines.map((l) => [l.text, l.center, l.font]), [
    ['The Hall of Records of Anticlere', true, 5], ['', false, 0],
    ['Season 0', true, 0], ['', false, 0],
    ['In the second week of Season 0, Ebon Oath <EO> held Anticlere unchallenged.', false, 0], ['', false, 0],
    ['The Season of Morning Star', true, 0], ['', false, 0],
    ['In the third week of the Season of Morning Star, the Silver Hand <SH> took the Charter of Anticlere with 6,200 influence.', false, 0], ['', false, 0],
  ]);
  assert.deepEqual(createBookReaderWindow(hallOfRecordsBook(ANTICLERE, [], 10)).lines.map((l) => l.text), ['The Hall of Records of Anticlere', '', HALL_OF_RECORDS_EMPTY]);
  assert.deepEqual(createBookReaderWindow(hallOfRecordsBook(ANTICLERE, rows, null)).lines.map((l) => l.text).filter(Boolean).slice(1), [
    'In week 11, Ebon Oath <EO> held Anticlere unchallenged.', 'In week 16, the Silver Hand <SH> took the Charter of Anticlere with 6,200 influence.'], 'no Season counted: no headings');
});

test('SEASON1 THE HALL OF RECORDS IN THE SERVICE: a seat\'s Chronicle oldest first, its newest HALL_OF_RECORDS_ROWS, each row\'s data read back, beside the week Season 0 began (none where none is set); the standings keep their own few; a bad seat and the seats shut refused (mutants: the order; the bound; the zero; the refusals)', async (t) => {
  const W = seatWeekOf(T0 * 1000);
  t.mock.method(Date, 'now', () => T0 * 1000);
  for (const zero of [null, W - 2]) {
    const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', ...(zero != null ? { SEASON_ZERO_WEEK: String(zero) } : {}) });
    const raw = svc.env.DB._raw;
    raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
    const me = await svc.registered('Mara');
    const n = HALL_OF_RECORDS_ROWS + 5;
    for (let i = 0; i < n; i++) raw.prepare("INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, 'held', ?, ?)").run(ANTICLERE.key, i, JSON.stringify({ guild: SH, standing: i }), T0);
    raw.prepare("INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, 'held', 'not json', ?)").run(ANTICLERE.key, n, T0);
    raw.prepare("INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (5023, 3, 'held', '{}', ?)").run(T0);
    const r = await svc.call('/v1/seats/records', { key: ANTICLERE.key }, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.rows.length, HALL_OF_RECORDS_ROWS);
    assert.deepEqual(r.body.rows[0], { kind: 'held', week: n + 1 - HALL_OF_RECORDS_ROWS, data: { guild: SH, standing: n + 1 - HALL_OF_RECORDS_ROWS } }, 'the oldest of the newest');
    assert.deepEqual(r.body.rows.at(-1), { kind: 'held', week: n, data: {} }, 'the newest last, its unread data none');
    assert.equal(r.body.zero, zero, 'the week Season 0 began');
    assert.equal(r.body.key, ANTICLERE.key);
    assert.equal((await svc.call('/v1/seats/records', { key: 'x' }, me.secret)).body.error, 'bad-seat');
    // the standings keep their own few
    for (let i = 0; i < 3; i++) { const w = await svc.guest(); raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - 86400); }
    const st = await svc.call('/v1/seats/standings', { key: ANTICLERE.key }, me.secret);
    assert.equal(st.status, 200, JSON.stringify(st.body));
    assert.equal(st.body.chronicle.length, SEAT_CHRONICLE_SHOWN, 'the Seat tab\'s own few');
  }
  const shut = await standService({ SEATS_OPEN: 'off' });
  const g = await shut.registered('Gale');
  assert.equal((await shut.call('/v1/seats/records', { key: ANTICLERE.key }, g.secret)).body.error, 'seats-closed');
  assert.equal(SEAT_CHRONICLE_SHOWN, 8, 'the Seat tab\'s own few, untouched');
  assert.match(src('server-account/src/seatInfluence.js'), /chronicle: await chronicleOf\(db, key\)/);
});

test('SEASON1 THE HALL OF RECORDS ON THE PAGE: the book asks its door for a seat\'s records once the seats are open, keeps the answer SEAT_RECORDS_CACHE_MS, and a shut answer closes the seats; the door\'s path; a seat\'s palace shelves are its Hall of Records while the seats are open (hover and press), the book opened in the interior\'s own reader slot or said where it cannot be read, its host reading the seat\'s records as a book; the Seat tab\'s Chronicle in its Season\'s words (mutants: the open gate; the cache; the shut; the path; the palace; the host; the slot; the words)', async () => {
  let now = 1_000_000, answer = { ok: true, data: { rows: [{ kind: 'held', week: 3, data: {} }], zero: 2 } };
  const asked = [];
  const door = { list: async () => ({ ok: true, data: { seats: [], red: [] } }), records: async (key) => { asked.push(key); return answer; } };
  const book = createTownSeatBook({ door, character: () => 'c1', storage: null, nowMs: () => now });
  assert.deepEqual(await book.records(3021), { data: null, error: 'seats-closed' }, 'the seats not known open');
  await book.read();
  assert.deepEqual(await book.records(3021), { data: { rows: [{ kind: 'held', week: 3, data: {} }], zero: 2 }, error: null });
  now += SEAT_RECORDS_CACHE_MS - 1;
  await book.records(3021);
  assert.deepEqual(asked, [3021], 'kept');
  now += 2;
  answer = { ok: true, data: { rows: 'x', zero: 'y' } };
  assert.deepEqual(await book.records(3021), { data: { rows: [], zero: null }, error: null }, 'a bad answer read as none');
  answer = { ok: false, error: 'seats-closed' };
  assert.deepEqual(await book.records(3022), { data: null, error: 'seats-closed' });
  assert.equal(book.open, false, 'a shut answer closes the seats');
  assert.equal(SEAT_RECORDS_CACHE_MS, 5 * 60_000);
  const posted = [];
  const { accountSeats } = await import('../src/net/accountClient.js');
  const seats = accountSeats({ fetch: async (u, i) => { posted.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true}', { status: 200 }); }, storage: { getItem: () => JSON.stringify({ id: 'p1', secret: 's' }), setItem() {}, removeItem() {} } });
  await seats.records(3021);
  assert.deepEqual(posted, [['/v1/seats/records', { key: 3021 }]]);
  assert.deepEqual([HALL_OF_RECORDS_TEXT, HALL_OF_RECORDS_SHUT], ['Hall of Records', 'The Hall of Records cannot be read now.']);
  // the palace's shelves, by source
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /const hallOfRecordsHere = \(b\) => b\?\.buildingType === BUILDING_TYPES\.Palace && !!host\.hallOfRecords\?\.here\?\.\(homeTownOf\(b\)\);/);
  assert.match(modes, /if \(key\.startsWith\('shelf:'\)\) \{\n\s+if \(hallOfRecordsHere\(b\)\) return \{ title: HALL_OF_RECORDS_TEXT \};/, 'the plaque, before the bookshelf\'s');
  assert.match(modes, /if \(!b \|\| !shelf\) return;\n\s+if \(hallOfRecordsHere\(b\)\) \{ openHallOfRecords\(b\); return; \}/, 'the press, before the shop\'s');
  // PIN MOVED (AUDIT-SEATS C11): a book that lands after the player left - or over a window opened meanwhile - is disposed
  assert.match(modes, /if \(interiorBuilding !== b \|\| interiorOverlay\) \{ dropRecords\(w\); return; \}\n\s+if \(w\) interiorOverlay = w;\n\s+else say\(HALL_OF_RECORDS_SHUT\);/);
  const world = src('src/scenes/world.js');
  assert.match(world, /hallOfRecords: \{\n\s+here: \(mapId\) => !!seatHere\(mapId\),\n\s+read: async \(mapId\) => \{\n\s+const seat = seatHere\(mapId\);\n\s+if \(!seat \|\| !seatBook\) return null;\n\s+return hallOfRecordsRead\(seat\);/);   // PIN MOVED (AUDIT CHAP4 C5): the one read both doors make
  assert.match(world, /const hallOfRecordsRead = async \(seat\) => \{\n\s+const \[r, ch\] = await Promise\.all\(\[\n\s+seatBook\.records\(seat\.key\),\n[^\n]*\n\s+\]\);\n\s+return r\?\.data \? hallOfRecordsWindow\(seat, r\.data\.rows, r\.data\.zero, seatArmsOf, ch\?\.ok \? ch\.data : null\) : null;/);
  assert.match(src('src/ui/seatTab.js'), /chronicleLine\(r, seat, book\.zero \?\? null\)/);
});
