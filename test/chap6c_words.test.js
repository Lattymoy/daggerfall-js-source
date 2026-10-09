// @ts-nocheck
// CHAP6c (2026-10-09, Mac: "continue", the Chapters arc's sixth slice - bible/11-Multiplayer/Chapters-Arc.md 7 and 9):
// A CHAPTER'S SEASON ON THE CLIENT. The law: a chapter's Season as the sheet or the board says it, each field checked.
// The words: the candidates named by the event's roll (DFU's FullName on the region's bank, DFU's stream put back), the
// Season's lines for every event, the doctrine and shut halls, the choices a member may back and what a backing says.
// The tab: the sheet keeps the Season; the board says it and offers a member its choices (the door, the word, the
// list read again, a late answer in the chat); the town talks of it before its band; the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { chapterSeasonOf, chapterDoctrineWords } from '../src/net/npcChapterLaw.js';
import { chapterCandidateName, chapterSeasonLines, chapterBackChoices, chapterBackedLine, CHAPTER_CANDIDATE_SALT } from '../src/net/chapterEvents.js';
import { createChapterSheet } from '../src/net/chapterSheet.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { CHAPTER_EVENT_NEWS, CHAPTER_NEWS, CHAPTER_NEWS_DAYS, newsScript } from '../src/systems/livingWorld/lines.js';
import { getSeed, setSeed } from '../src/formats/dfRandom.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ANTICLERE = 21, DAGGERFALL = 17, FIGHTERS = 41, MAGES = 40, THIEVES = 42, JULIANOS = 27;
const tick = () => new Promise((r) => setImmediate(r));

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP6c a chapter\'s Season as the sheet says it: each field checked, anything else none - a rival only a Rivalry\'s, two sides only a Schism\'s, an heir only a Succession\'s (mutants: each check)', () => {
  const none = { event: null, season: null, rival: null, shut: false, doctrine: null, sides: null, heir: null };
  assert.deepEqual(chapterSeasonOf(null), none);
  assert.deepEqual(chapterSeasonOf({ event: 'schism', season: 3, sides: ['training', 'writs'], shut: true, doctrine: 'shelf' }),
    { event: 'schism', season: 3, rival: null, shut: true, doctrine: 'shelf', sides: ['training', 'writs'], heir: null });
  assert.deepEqual(chapterSeasonOf({ event: 'rivalry', rival: THIEVES }).rival, THIEVES);
  assert.deepEqual(chapterSeasonOf({ event: 'succession', season: 0, heir: 2 }), { ...none, event: 'succession', season: 0, heir: 2 });
  assert.deepEqual(chapterSeasonOf({ event: 'war', season: -1, rival: THIEVES, shut: 'yes', doctrine: 'gold', sides: ['training', 'writs'], heir: 1 }), none);
  assert.deepEqual([chapterSeasonOf({ event: 'rivalry', rival: 999 }).rival, chapterSeasonOf({ event: 'calm', rival: THIEVES }).rival], [null, null]);
  assert.deepEqual([chapterSeasonOf({ event: 'schism', sides: ['training'] }).sides, chapterSeasonOf({ event: 'schism', sides: ['training', 'gold'] }).sides,
    chapterSeasonOf({ event: 'succession', sides: ['training', 'writs'] }).sides], [null, null, null]);
  assert.deepEqual([chapterSeasonOf({ event: 'succession', heir: 3 }).heir, chapterSeasonOf({ event: 'schism', heir: 1 }).heir, chapterSeasonOf({ event: 'succession', season: 1.5 }).season], [null, null, null]);
  assert.deepEqual(['training', 'shelf', 'writs', 'gold', 'toString', 'constructor'].map(chapterDoctrineWords), ['cheaper training', 'a deeper shelf', 'more writs', null, null, null]);
  const sides = ['training', 'writs'];
  assert.notEqual(chapterSeasonOf({ event: 'schism', sides }).sides, sides, 'a copy');
});

// ── THE WORDS ───────────────────────────────────────────────────────

test('CHAP6c the candidates named by the event\'s roll: the same for every reader, its own for each place, Season, chapter and region; DFU\'s stream put back as it stood (mutants: the salt, the Season, the key, the place, the bank, the gender, the seed restored)', () => {
  assert.equal(CHAPTER_CANDIDATE_SALT, 0xca7d);
  assert.deepEqual([0, 1, 2].map((i) => chapterCandidateName(1, FIGHTERS, ANTICLERE, i)), ['Elyzyna Coppersly', 'Bedore Greenhart', 'Mordastyr Hearthhouse']);
  assert.deepEqual([0, 1, 2].map((i) => chapterCandidateName(1, FIGHTERS, DAGGERFALL, i)), ['Uthoryan Copperford', 'Morgausa Wicksmith', 'Agrynak Copperwing']);
  assert.deepEqual([0, 1].map((i) => chapterCandidateName(2, MAGES, ANTICLERE, i)), ['Agristyr Hearthhouse', 'Lysara Hawking']);
  setSeed(12345);
  chapterCandidateName(1, FIGHTERS, ANTICLERE, 0);
  assert.equal(getSeed(), 12345, 'the global stream as it stood');
});

test('CHAP6c the Season\'s lines: a Schism\'s two and their doctrines, a Succession\'s three or its heir, a Crackdown, a Rivalry (a hidden rival unnamed, an unknown one a rival chapter), a Decline, an Ascendancy; the doctrine; shut halls; Calm none (mutants: each line)', () => {
  const L = (c, f = FIGHTERS, g = ANTICLERE) => chapterSeasonLines(f, g, c);
  const n = (i, s = 1) => chapterCandidateName(s, FIGHTERS, ANTICLERE, i);
  assert.deepEqual(L({ event: 'schism', season: 1, sides: ['training', 'writs'] }), [`The chapter is split this Season: ${n(0)} stands for cheaper training, ${n(1)} for more writs.`]);
  assert.deepEqual(L({ event: 'schism', sides: ['training', 'writs'] }), ['The chapter is split this Season.'], 'no Season, no names');
  assert.deepEqual(L({ event: 'succession', season: 1 }), [`The hall's head steps down this Season: ${n(0)}, ${n(1)} and ${n(2)} stand to follow.`]);
  assert.deepEqual(L({ event: 'succession', season: 1, heir: 2 }), [`${n(2)} is the hall's new head.`]);
  assert.deepEqual(L({ event: 'succession' }), ['The hall\'s head steps down this Season.']);
  assert.deepEqual(L({ event: 'crackdown' }), ['The watch hunts the chapter this Season: its writs pay half again.']);
  assert.deepEqual(L({ event: 'rivalry', rival: JULIANOS }, MAGES), ['The chapter races the Temple of Julianos for Merit this Season.']);
  assert.deepEqual(L({ event: 'rivalry', rival: THIEVES }), ['The chapter races a rival in the shadows for Merit this Season.']);
  assert.deepEqual(L({ event: 'rivalry' }), ['The chapter races a rival chapter for Merit this Season.']);
  assert.deepEqual(L({ event: 'decline' }), ['The chapter is in decline this Season: it loses Strength each week its Merit falls short of twice the target.']);
  assert.deepEqual(L({ event: 'ascendancy' }), ['The chapter is ascendant this Season.']);
  assert.deepEqual(L({ event: 'calm', doctrine: 'writs', shut: true }), ['The chapter holds to more writs this Season.', 'The chapter\'s halls are shut this Season, by the watch\'s order.']);
  assert.deepEqual([L({ event: 'calm' }), L(null)], [[], []]);
});

test('CHAP6c a member\'s choices: a Schism\'s two sides named with their doctrines, a Succession\'s three until its heir is named; none otherwise; what a backing says (mutants: each)', () => {
  const n = (i) => chapterCandidateName(1, FIGHTERS, ANTICLERE, i);
  const schism = { event: 'schism', season: 1, sides: ['shelf', 'writs'] };
  assert.deepEqual(chapterBackChoices(FIGHTERS, ANTICLERE, schism), [{ side: 0, label: `${n(0)}, for a deeper shelf` }, { side: 1, label: `${n(1)}, for more writs` }]);
  assert.deepEqual(chapterBackChoices(FIGHTERS, ANTICLERE, { event: 'succession', season: 1 }).map((c) => c.label), [n(0), n(1), n(2)]);
  assert.deepEqual([chapterBackChoices(FIGHTERS, ANTICLERE, { event: 'succession', season: 1, heir: 0 }), chapterBackChoices(FIGHTERS, ANTICLERE, { event: 'schism', sides: ['shelf', 'writs'] }),
    chapterBackChoices(FIGHTERS, ANTICLERE, { event: 'rivalry', season: 1 }), chapterBackChoices(FIGHTERS, ANTICLERE, { event: 'schism', season: 1 })], [[], [], [], []]);
  assert.equal(chapterBackedLine(FIGHTERS, ANTICLERE, schism, 1), `You back ${n(1)}, for more writs.`);
  assert.equal(chapterBackedLine(FIGHTERS, ANTICLERE, { event: 'succession', season: 1 }, 2), `You name ${n(2)} to follow as the hall's head.`);
  assert.equal(chapterBackedLine(FIGHTERS, ANTICLERE, schism, 2), null);
});

// ── THE TAB ─────────────────────────────────────────────────────────

test('CHAP6c the sheet keeps each chapter\'s Season beside its Strength and seats, a copy (mutants: the Season kept, the copy)', async () => {
  const sheet = createChapterSheet({ door: { list: async () => ({ ok: true, data: { chapters: [
    { f: FIGHTERS, region: ANTICLERE, strength: 60, seats: [], event: 'schism', season: 1, sides: ['training', 'writs'], doctrine: 'shelf' },
    { f: MAGES, region: ANTICLERE, strength: 40, seats: [], event: 'war', shut: true },
  ] } }) }, nowMs: () => 0 });
  sheet.refresh();
  await tick(); await tick();
  const c = sheet.chapterOf(FIGHTERS, ANTICLERE);
  assert.deepEqual(c, { strength: 60, seats: [], event: 'schism', season: 1, rival: null, shut: false, doctrine: 'shelf', sides: ['training', 'writs'], heir: null, patron: null });   // PIN MOVED (CHAP7b): and its patron
  c.sides[0] = 'gold';
  assert.deepEqual(sheet.chapterOf(FIGHTERS, ANTICLERE).sides, ['training', 'writs'], 'a copy');
  assert.deepEqual([sheet.chapterOf(MAGES, ANTICLERE).event, sheet.chapterOf(MAGES, ANTICLERE).shut], [null, true]);
});

/** The board's Work tab over `chapters` (the reader a member where `merit` says so); `back` the door. */
async function board(chapters, { merit = [], back = null, sayLate = null } = {}) {
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit, chapters, today: { filled: 0, max: 3 } }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  let reads = 0;
  const counted = { ...book, writs: async (...a) => { reads++; return book.writs(...a); } };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  const b = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
    work: { book: counted, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), back, sayLate } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  return { host, board: b, reads: () => reads };
}
const meritOf = (f) => ({ faction: f, merit: 0, max: 600, elsewhere: false, from: null });

test('CHAP6c the board says each chapter\'s Season, and offers a member of its guild its choices - the one it backs marked; a press backs it, says so and reads the list again; none to a stranger (mutants: the lines, the member, the door, the mark, the word, the read)', async () => {
  const n = (i) => chapterCandidateName(1, FIGHTERS, ANTICLERE, i);
  const chapters = [
    { faction: FIGHTERS, strength: 50, band: 'steady', event: 'schism', season: 1, sides: ['training', 'writs'], backed: 1 },
    { faction: MAGES, strength: 50, band: 'steady', event: 'crackdown', doctrine: 'writs' },
  ];
  const calls = [];
  const s = await board(chapters, { merit: [meritOf(FIGHTERS)], back: async (f, side) => { calls.push([f, side]); return { ok: true, event: 'schism', side }; } });
  const texts = byClass(s.host, 'notice-season').map((p) => p.textContent);
  assert.deepEqual(texts, [`The chapter is split this Season: ${n(0)} stands for cheaper training, ${n(1)} for more writs.`,
    'The watch hunts the chapter this Season: its writs pay half again.', 'The chapter holds to more writs this Season.']);
  const picks = byClass(s.host, 'notice-back-pick');
  assert.equal(picks.length, 1, 'the Mages\' chapter: no member here, no choices');
  const buttons = [...picks[0].querySelectorAll('button')];
  assert.deepEqual(buttons.map((x) => [x.textContent, x.classList.contains('on')]), [[`${n(0)}, for cheaper training`, false], [`${n(1)}, for more writs`, true]]);
  assert.ok(picks[0].textContent.startsWith('Back a side: '));
  const before = s.reads();
  buttons[1].click();
  for (let i = 0; i < 6; i++) await tick();
  assert.deepEqual(calls, [[FIGHTERS, 1]]);
  assert.equal(byClass(s.host, 'notice-word')[0]?.textContent, `You back ${n(1)}, for more writs.`);
  assert.ok(s.reads() > before, 'the list read again');
  const stranger = await board(chapters, { merit: [], back: async () => ({ ok: true }) });
  assert.equal(byClass(stranger.host, 'notice-back-pick').length, 0);
  const shut = await board(chapters, { merit: [meritOf(FIGHTERS)], back: null });
  assert.equal(byClass(shut.host, 'notice-back-pick').length, 0, 'no door, no choices');
});

test('CHAP6c a Succession\'s names offered as "Name who follows"; a refusal said in its words; an answer after the board closed said in the chat (mutants: the heading, the refusal, the late word)', async () => {
  const n = (i) => chapterCandidateName(1, MAGES, ANTICLERE, i);
  const chapters = [{ faction: MAGES, strength: 50, band: 'steady', event: 'succession', season: 1 }];
  const s = await board(chapters, { merit: [meritOf(MAGES)], back: async () => ({ ok: false, error: 'closed' }) });
  const pick = byClass(s.host, 'notice-back-pick')[0];
  assert.ok(pick.textContent.startsWith('Name who follows: '));
  assert.deepEqual([...pick.querySelectorAll('button')].map((x) => x.textContent), [n(0), n(1), n(2)]);
  pick.querySelectorAll('button')[2].click();
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(byClass(s.host, 'notice-word')[0]?.textContent, 'That has already been decided.');
  const late = [];
  let answer = () => {};
  const l = await board(chapters, { merit: [meritOf(MAGES)], sayLate: (t) => late.push(t), back: () => new Promise((res) => { answer = () => res({ ok: true }); }) });
  byClass(l.host, 'notice-back-pick')[0].querySelectorAll('button')[1].click();
  await tick();
  l.board.unmount();
  answer();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(late, [`You name ${n(1)} to follow as the hall's head.`]);
});

test('CHAP6c the town talks of a chapter\'s Season before its band: shut halls first, then its event (Calm none), else its band; every Season\'s pool its own, worded with the chapter first (mutants: the order, the pools)', () => {
  assert.deepEqual(Object.keys(CHAPTER_EVENT_NEWS), ['schism', 'succession', 'crackdown', 'rivalry', 'decline', 'ascendancy', 'shut']);
  for (const pool of Object.values(CHAPTER_EVENT_NEWS)) for (const [a, b] of pool) { assert.ok(!a.startsWith('{guild}') && a.includes('{guild}')); assert.ok(typeof b === 'string' && b.length); }
  let chapter = null;
  // a town of one Fighters Guild hall, as LivingTown reads it (places.types and places.factions)
  const town = { o: { chapterOf: () => chapter, town: { mapId: 5 } }, places: { types: new Map([[1, B.GuildHall]]), factions: new Map([[1, FIGHTERS]]) }, dayOf: (t) => Math.floor(t / DAY_MIN) };
  const told = (c) => {
    chapter = c;
    const kinds = [];
    for (let d = 300; d < 307; d++) for (const n of LivingTown.prototype.chapterNews.call(town, d * DAY_MIN + 600)) kinds.push(n.kind);
    return kinds;
  };
  const days = CHAPTER_NEWS_DAYS;
  assert.deepEqual(told({ band: 'thriving', name: 'the Fighters Guild', event: 'schism', shut: true }), Array(days).fill('shut'));
  assert.deepEqual(told({ band: 'thriving', name: 'the Fighters Guild', event: 'schism', shut: false }), Array(days).fill('schism'));
  assert.deepEqual(told({ band: 'thriving', name: 'the Fighters Guild', event: 'calm', shut: false }), Array(days).fill('thriving'));
  assert.deepEqual(told({ band: 'thriving', name: 'the Fighters Guild', event: 'war' }), Array(days).fill('thriving'), 'an event with no words is its band\'s');
  assert.deepEqual(told({ band: 'steady', name: 'the Fighters Guild', event: 'calm' }), [], 'Calm and Steady: no news');
  assert.deepEqual(told({ band: 'steady', name: 'the Fighters Guild', event: 'decline' }), Array(days).fill('decline'), 'a Steady chapter\'s event is news');
  assert.ok(CHAPTER_NEWS.thriving);
  // and told in the Season's own words
  let got = null;
  for (let seed = 0; seed < 200 && !got; seed++) got = newsScript(seed, [{ kind: 'schism', chapter: true, guild: 'the Fighters Guild', who: '', foe: '', place: '' }]);
  assert.ok(got && CHAPTER_EVENT_NEWS.schism.includes(got.script), 'a Schism\'s words');
});

test('CHAP6c the wiring: the door to back, the board\'s door, the roll\'s Season lines, the town\'s chapter with its event (mutants: each seam)', () => {
  assert.match(src('src/net/accountClient.js'), /back: \(character, faction, region, side\) => post\('\/v1\/chapters\/back', \{ character, faction, region, side \}\),/);
  const w = src('src/scenes/world.js');
  assert.match(w, /back: hallDoor && realmSession \? \(faction, side\) => hallDoor\.back\(realmSession\.id, faction, region, side\) : null,/);
  assert.match(w, /lines: \[\.\.\.chapterRollLines\(faction, c\), \.\.\.chapterSeasonLines\(faction, \/\*\* @type \{number\} \*\/ \(region\), c\)\]/);
  assert.match(w, /event: c\.event \?\? null, shut: c\.shut === true \};/);
});
