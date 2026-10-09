// CHAP4d (2026-10-09, Mac: "Continue", the Chapters arc's seats - bible/11-Multiplayer/Chapters-Arc.md section 6): THE
// FOCUS AND THE CHRONICLE - a chapter's Master names the material family its hall writs ask more of this week (every
// other writ, by the same slot's dice), on the Notice Board; and every change of a chapter's seats is read, in words, in
// the Hall of Records of a palace in its region, after the seat's own Chronicle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import {
  chapterFocusesOf, chapterFocusOk, chapterFocusLineOf, chapterChronicleLine, hallWrits, meritWeekOf,
} from '../src/net/npcChapterLaw.js';
import { regionWritTable, material, herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { CHAPTER_CHRONICLE_ROWS, setChapterFocus } from '../server-account/src/npcChapters.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { hallOfRecordsTokens, hallOfRecordsChapterLines, hallOfRecordsChaptersTitle, hallOfRecordsBook } from '../src/ui/hallOfRecords.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40;
const tick = () => new Promise((r) => setImmediate(r));
const TABLE = regionWritTable(ANTICLERE, [{ climate: 231, confirmed: true }, { climate: 226, confirmed: true }], 0);
const familyOf = (w) => material(w.material)?.family;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP4d the Focus\'s families: a guild\'s own, where it has more than one to choose - a temple, the Brotherhood none (mutants: the floor, the guard)', () => {
  assert.deepEqual([chapterFocusesOf(FIGHTERS), chapterFocusesOf(MAGES), chapterFocusesOf(42), chapterFocusesOf(108), chapterFocusesOf(99)],
    [['metals', 'wood'], ['herbs', 'metals'], ['metals', 'herbs', 'wood', 'stone'], [], []]);
  assert.deepEqual([chapterFocusOk(FIGHTERS, 'wood'), chapterFocusOk(FIGHTERS, 'herbs'), chapterFocusOk(108, 'herbs'), chapterFocusOk(FIGHTERS, null)], [true, false, false, false]);
  assert.equal(chapterFocusLineOf(FIGHTERS, 'metals'), 'The Fighters Guild\'s Master asks for metals this week.');
  assert.deepEqual([chapterFocusLineOf(FIGHTERS, 'herbs'), chapterFocusLineOf(FIGHTERS, null)], [null, null]);
});

test('CHAP4d a focused chapter\'s writs: every other writ, from the first, of its Focus\'s family, by the same slot\'s dice - the rest as they were; a Focus not its guild\'s, or one the table yields none of, moves nothing (mutants: the share, the dice, the guards)', () => {
  const day = 20_000;
  const plain = hallWrits(day, ANTICLERE, FIGHTERS, 6, TABLE);
  const wood = hallWrits(day, ANTICLERE, FIGHTERS, 6, TABLE, 'wood');
  assert.deepEqual(wood.map((w) => w.slot), [0, 1, 2, 3, 4, 5]);
  assert.ok([...plain, ...wood].every((w) => typeof w.material === 'string'), 'every writ a writ');
  assert.deepEqual(wood.filter((_, i) => i % 2 === 0).map(familyOf), ['wood', 'wood', 'wood']);
  assert.deepEqual(wood.filter((_, i) => i % 2 === 1), plain.filter((_, i) => i % 2 === 1), 'the odd writs untouched');
  assert.ok(plain.filter((_, i) => i % 2 === 0).some((w) => familyOf(w) !== 'wood'), 'unfocused, the even writs were not all wood');
  assert.deepEqual(hallWrits(day, ANTICLERE, FIGHTERS, 6, TABLE, 'wood'), wood, 'the same day, the same writs');
  assert.deepEqual(hallWrits(day, ANTICLERE, FIGHTERS, 6, TABLE, 'herbs'), plain, 'a family not the guild\'s');
  assert.deepEqual(hallWrits(day, ANTICLERE, FIGHTERS, 6, TABLE.filter((m) => familyOf(m) !== 'wood'), 'wood'),
    hallWrits(day, ANTICLERE, FIGHTERS, 6, TABLE.filter((m) => familyOf(m) !== 'wood')), 'a table with none of it');
  const woods = TABLE.filter((m) => familyOf(m) === 'wood');
  assert.deepEqual(hallWrits(day, ANTICLERE, FIGHTERS, 6, woods, 'wood'), hallWrits(day, ANTICLERE, FIGHTERS, 6, woods), 'a table all of it: the same slot\'s dice, the same writs');
});

test('CHAP4d the Chronicle in words: a seat taken, risen to, given up for an officer\'s, lost - a member gone since; never a hidden guild\'s, nor a row it has no words for (mutants: each arm, the hidden, the name)', () => {
  const row = (data, extra = {}) => ({ kind: 'seat', faction: FIGHTERS, week: 40, data, name: 'Alda', ...extra });
  assert.deepEqual([
    chapterChronicleLine(row({ from: null, to: 'master' })), chapterChronicleLine(row({ from: null, to: 'officer' })),
    chapterChronicleLine(row({ from: 'officer', to: 'master' })), chapterChronicleLine(row({ from: 'master', to: 'officer' })),
    chapterChronicleLine(row({ from: 'master', to: null })), chapterChronicleLine(row({ from: 'officer', to: null }, { name: null, faction: 368 })),
  ], [
    'In week 40, Alda took the Master\'s seat of the Fighters Guild.', 'In week 40, Alda took an officer\'s seat of the Fighters Guild.',
    'In week 40, Alda rose to the Master\'s seat of the Fighters Guild.', 'In week 40, Alda gave the Master\'s seat of the Fighters Guild up, and kept an officer\'s.',
    'In week 40, Alda lost the Master\'s seat of the Fighters Guild.', 'In week 40, A member since gone lost an officer\'s seat of the Knights of the Dragon.',
  ]);
  assert.equal(chapterChronicleLine(row({ from: null, to: 'master' }), 36), 'In the first week of the Season of Morning Star, Alda took the Master\'s seat of the Fighters Guild.', 'the Season\'s words where one is counted (Season 0 four weeks from 36)');
  for (const [why, r] of [['a hidden guild', row({ from: null, to: 'master' }, { faction: 42 })], ['no change', row({ from: 'master', to: 'master' })],
    ['another kind', { ...row({ from: null, to: 'master' }), kind: 'strike' }], ['no seat', row({ from: null, to: null })], ['no guild', row({ from: null, to: 'master' }, { faction: 99 })]]) {
    assert.equal(chapterChronicleLine(r), null, why);
  }
  assert.equal(chapterChronicleLine({ kind: 'seat', faction: FIGHTERS, data: { from: null, to: 'officer' }, name: 'Bryn' }), 'Bryn took an officer\'s seat of the Fighters Guild.', 'no week, no when');
});

test('CHAP4d the Hall of Records: the region\'s chapters after the seat\'s own, under their own heading, each row a paragraph; none offline (mutants: the section, the heading, the lines)', () => {
  const seat = { key: 3021, name: 'Anticlere', region: ANTICLERE, tier: 'palace' };
  const chapters = { rows: [{ kind: 'seat', faction: FIGHTERS, week: 40, data: { from: null, to: 'master' }, name: 'Alda' }, { kind: 'seat', faction: 42, week: 40, data: { from: null, to: 'master' }, name: 'Thief' }], zero: null };
  assert.equal(hallOfRecordsChaptersTitle(seat), 'The Chapters of Anticlere');
  assert.deepEqual(hallOfRecordsChapterLines(chapters), ['In week 40, Alda took the Master\'s seat of the Fighters Guild.']);
  assert.deepEqual(hallOfRecordsChapterLines({ ...chapters, zero: 36 }), ['In the first week of the Season of Morning Star, Alda took the Master\'s seat of the Fighters Guild.'], 'the Season the service counts');
  const texts = (t) => t.filter((x) => typeof x.text === 'string').map((x) => x.text);
  const withChapters = texts(hallOfRecordsTokens(seat, [], null, null, chapters));
  assert.deepEqual(withChapters.slice(1), ['Nothing is written here yet.', 'The Chapters of Anticlere', 'In week 40, Alda took the Master\'s seat of the Fighters Guild.'], 'the seat\'s own Chronicle empty, its region\'s chapters still said');
  assert.deepEqual(texts(hallOfRecordsBook(seat, [], null, null, chapters).getPageTokens()), texts(hallOfRecordsTokens(seat, [], null, null, chapters)), 'the book the window reads');
  assert.equal(texts(hallOfRecordsTokens(seat, [], null, null, null)).includes('The Chapters of Anticlere'), false);
  assert.equal(texts(hallOfRecordsTokens(seat, [], null, null, { rows: [], zero: null })).includes('The Chapters of Anticlere'), false, 'none to say, no heading');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _rid = 0;
const rid = () => `chap4d-${String(++_rid).padStart(6, '0')}`;

/** A town of Anticlere with Fighters and Mages halls witnessed, its ground, and a member of both - Alda - with a realm
 *  character; `seat` lays a seat row. */
async function stand(t) {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ CHAPTERS_OPEN: 'on', PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
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
  const week = meritWeekOf(NOON);
  raw.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?, 0, 60, 0, ?, 0)').run(week - 1, 'on');   // nothing due
  raw.prepare('INSERT INTO npc_chapters (faction, region, strength, week, merit, at) VALUES (41, 21, 50, ?, 0, 0), (40, 21, 50, ?, 0, 0)').run(week - 1, week - 1);
  const seat = (char, f, region, kind) => raw.prepare('INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(f, region, char, who.id, kind, week, week, NOON);
  return { ...s, raw, who, R, week, seat };
}

test('CHAP4d the Focus set: only by its chapter\'s Master, only a family its guild\'s, held for the week it was chosen in - an officer, another account, a dead Master refused (mutants: the seat asked, the account, the dead, the family, the week)', async (t) => {
  const s = await stand(t);
  const set = (body, who = s.who) => s.call('/v1/chapters/focus', { character: s.R.id, faction: FIGHTERS, region: ANTICLERE, focus: 'wood', ...body }, who.secret);
  assert.deepEqual([(await set({})).status, (await set({})).body?.error], [403, 'not-master'], 'no seat');
  s.seat(s.R.id, FIGHTERS, ANTICLERE, 'officer');
  assert.equal((await set({})).body?.error, 'not-master', 'an officer');
  s.raw.prepare("UPDATE npc_chapter_seats SET seat = 'master'").run();
  assert.deepEqual([(await set({ focus: 'herbs' })).status, (await set({ focus: 'herbs' })).body?.error], [400, 'no-focus']);
  assert.deepEqual([(await set({ region: 999 })).body?.error, (await set({ character: 'x' })).body?.error], ['body', 'body']);
  const ok = await set({});
  assert.deepEqual([ok.status, ok.body], [200, { ok: true, focus: 'wood', week: s.week }]);
  assert.deepEqual({ ...s.raw.prepare('SELECT focus, focus_week FROM npc_chapters WHERE faction = 41 AND region = 21').get() }, { focus: 'wood', focus_week: s.week });
  assert.equal((await set({ region: DAGGERFALL })).body?.error, 'not-master', 'another chapter of the guild');
  const other = await s.registered('Other');
  assert.equal((await setChapterFocus({ db: s.env.DB, nowS: NOON }, { id: other.id }, s.env, { character: s.R.id, faction: FIGHTERS, region: ANTICLERE, focus: 'metals' })).error, 'not-master', 'another account naming the Master');
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(NOON, s.R.id);
  assert.equal((await set({ focus: 'metals' })).body?.error, 'dead', 'a dead Master - the service\'s own door refuses it first');
  assert.equal((await setChapterFocus({ db: s.env.DB, nowS: NOON }, { id: s.who.id }, s.env, { character: s.R.id, faction: FIGHTERS, region: ANTICLERE, focus: 'metals' })).error, 'not-master', 'and the write asks it too');
});

test('CHAP4d the board and the writs: the day\'s hall writs read the week\'s Focus; the board says it, and offers its Master the choice - nobody else (mutants: the Focus read at the post, the week, the lines, the Master)', async (t) => {
  const s = await stand(t);
  s.seat(s.R.id, FIGHTERS, ANTICLERE, 'master');
  s.raw.prepare("UPDATE npc_chapters SET focus = 'wood', focus_week = ? WHERE faction = 41").run(s.week);
  s.raw.prepare("UPDATE npc_chapters SET focus = 'herbs', focus_week = ? WHERE faction = 40").run(s.week - 1);   // last week's: lapsed
  s.seat(s.R.id, MAGES, ANTICLERE, 'officer');   // an officer's chapter: no choice
  const l = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  const fighters = s.raw.prepare("SELECT slot, material FROM writs WHERE kind = 'hall' AND faction = 41 ORDER BY slot").all();
  assert.ok(fighters.length >= 2);
  assert.deepEqual(fighters.filter((w) => w.slot % 2 === 0).map(familyOf), fighters.filter((w) => w.slot % 2 === 0).map(() => 'wood'));
  assert.deepEqual(l.chapters.map((c) => [c.faction, c.focus, c.master ?? false, c.focuses ?? null]), [[MAGES, null, false, null], [FIGHTERS, 'wood', true, ['metals', 'wood']]]);
  const stranger = await s.registered('Stranger');
  const sl = (await s.call('/v1/writs/list', { character: stranger.character, region: ANTICLERE }, stranger.secret)).body;
  assert.deepEqual(sl.chapters.map((c) => [c.faction, c.focus, c.master ?? false]), [[MAGES, null, false], [FIGHTERS, 'wood', false]], 'the Focus said to all, the choice to its Master');
  s.raw.prepare("UPDATE npc_chapters SET focus = 'wood', focus_week = ? WHERE faction = 40").run(s.week);   // a family not its guild's, as written
  const l2 = (await s.call('/v1/writs/list', { character: s.R.id, region: ANTICLERE }, s.who.secret)).body;
  assert.equal(l2.chapters.find((c) => c.faction === MAGES).focus, null, 'a stored Focus not its guild\'s is none');
});

test('CHAP4d the Chronicle\'s read: a region\'s rows, oldest first, each character as it is named now (a gone one none), never a hidden guild\'s, never another region\'s; its newest at most (mutants: the region, the hidden, the order, the bound)', async (t) => {
  const s = await stand(t);
  const row = (f, region, week, char, data) => s.raw.prepare("INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at) VALUES (?, ?, ?, 'seat', ?, ?, ?)").run(f, region, week, char, JSON.stringify(data), NOON);
  row(FIGHTERS, ANTICLERE, 40, s.R.id, { from: null, to: 'master' });
  row(42, ANTICLERE, 40, s.R.id, { from: null, to: 'master' });
  row(FIGHTERS, DAGGERFALL, 40, s.R.id, { from: null, to: 'officer' });
  row(FIGHTERS, ANTICLERE + 1, 40, s.R.id, { from: null, to: 'officer' });
  row(MAGES, ANTICLERE, 41, 'r00000000000000000000', { from: null, to: 'officer' });
  const r = await s.call('/v1/chapters/history', { region: ANTICLERE }, s.who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.rows, [
    { faction: FIGHTERS, week: 40, kind: 'seat', data: { from: null, to: 'master' }, name: 'Alda' },
    { faction: MAGES, week: 41, kind: 'seat', data: { from: null, to: 'officer' }, name: null },
  ]);
  assert.equal((await s.call('/v1/chapters/history', { region: 999 }, s.who.secret)).status, 400);
  assert.equal(CHAPTER_CHRONICLE_ROWS, 60);
  for (let i = 0; i < CHAPTER_CHRONICLE_ROWS; i++) row(FIGHTERS, ANTICLERE, 50 + i, s.R.id, { from: null, to: 'officer' });
  const many = (await s.call('/v1/chapters/history', { region: ANTICLERE }, s.who.secret)).body.rows;
  assert.deepEqual([many.length, many[0].week, many.at(-1).week], [CHAPTER_CHRONICLE_ROWS, 50, 50 + CHAPTER_CHRONICLE_ROWS - 1], 'its newest, oldest first');
});

// ── THE CLIENT ──────────────────────────────────────────────────────

test('CHAP4d the board\'s Work tab: a chapter\'s Focus said under its line; its Master offered the families, the one held marked, a press setting it and reading the list again (mutants: the line, the offer, the press, the reload)', async () => {
  let reads = 0, set = null;
  const chapters = [{ faction: FIGHTERS, strength: 50, band: 'steady', focus: 'wood', master: true, focuses: ['metals', 'wood'] }, { faction: MAGES, strength: 50, band: 'steady', focus: null, focuses: ['herbs', 'metals'] }];
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => { reads++; return { data: { writs: [], receipts: [], merit: [], chapters, today: { filled: 0, max: 3 } }, error: null, stale: false }; },
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
    work: { book, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), setFocus: async (f, k) => { set = [f, k]; return { ok: true, data: { ok: true } }; } } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(byClass(host, 'notice-focus').map((n) => n.textContent), ['The Fighters Guild\'s Master asks for wood this week.']);
  const pick = byClass(host, 'notice-focus-pick');
  assert.equal(pick.length, 1, 'its Master alone is offered the choice');
  const buttons = [...pick[0].querySelectorAll('button')];
  assert.deepEqual(buttons.map((b) => [b.textContent, b.className.includes('on')]), [['metals', false], ['wood', true]]);
  const before = reads;
  buttons[0].click();
  for (let i = 0; i < 4; i++) await tick();
  assert.deepEqual(set, [FIGHTERS, 'metals']);
  assert.ok(reads > before, 'read again');
  // no door, no offer
  const h2 = document.createElement('div');
  mountNoticeBoard(h2, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n) } });
  await tick();
  byClass(h2, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.equal(byClass(h2, 'notice-focus-pick').length, 0);
});

test('CHAP4d the wiring: the host\'s Focus door and the Hall\'s Chronicle read; the routes; the writs\' post reads the Focus (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /setFocus: hallDoor && realmSession \? \(faction, focus\) => hallDoor\.focus\(realmSession\.id, faction, region, focus\) : null,/);
  assert.match(w, /const ch = hallDoor && rollTracker\?\.held \? await hallDoor\.history\(seat\.region\)\.catch\(\(\) => null\) : null;\n\s+return r\.data \? hallOfRecordsWindow\(seat, r\.data\.rows, r\.data\.zero, seatArmsOf, ch\?\.ok \? ch\.data : null\) : null;/);
  const ix = src('server-account/src/index.js');
  assert.match(ix, /: path === '\/v1\/chapters\/focus' \? await setChapterFocus\(ctx, who\.player, env, body\)/);
  assert.match(ix, /: path === '\/v1\/chapters\/history' \? await chapterChronicle\(ctx, who\.player, env, body\)/);
  assert.match(src('server-account/src/professions.js'), /hallWrits\(day, region, f, hallWritCountIn\(active, strengths\.get\(f\)\), table, focuses\.get\(f\) \?\? null\)/);
  assert.match(src('src/net/accountClient.js'), /focus: \(character, faction, region, focus\) => post\('\/v1\/chapters\/focus', \{ character, faction, region, focus \}\),\n\s+history: \(region\) => post\('\/v1\/chapters\/history', \{ region \}\),/);
});
