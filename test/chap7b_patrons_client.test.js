// @ts-nocheck
// CHAP7b (2026-10-09, Mac: "continue", the Chapters arc's last slice - bible/11-Multiplayer/Chapters-Arc.md section 8,
// CALL 6): THE PATRONS ON THE CLIENT. A patron's members pay the Thriving band's prices in its chapter's halls whatever
// the chapter's Strength, the Season's tenths on it as on anyone's; the sheet keeps each chapter's patron and its arms;
// its banners hang beside the doors of the chapter's halls; the board names the patron and offers its own guild's
// guildmaster the bid for the Season after (the door, the word, the list read again, a late answer in the chat).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import {
  CHAPTER_PATRON_PRICE, CHAPTER_PATRON_BAND, CHAPTER_PATRON_RAISES, chapterPatronMember, chapterHallFactor, chapterPriceFactor, chapterPatronBidsOf,
  chapterPatronSheetLine, chapterPatronBidLine, chapterPatronBidSaid, CHAPTER_BANDS,
} from '../src/net/npcChapterLaw.js';
import { MARKS_MAX } from '../src/net/marksLaw.js';
import { seatSeasonName } from '../src/net/townSeatLaw.js';
import { createChapterSheet } from '../src/net/chapterSheet.js';
import { createChapterBanners } from '../src/scenes/chapterBanners.js';
import { bannerKeyOf, BANNER_REFRESH_MS } from '../src/scenes/hallBanners.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ANTICLERE = 21, FIGHTERS = 41, MAGES = 40, THIEVES = 42;
const GL = 'gabcdefghij', IW = 'gzyxwvutsrq';
const ARMS = { field: 'azure', border: 'gold', device: 'tower' };
const tick = () => new Promise((r) => setImmediate(r));

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP7b a patron\'s members pay the Thriving band\'s price whatever the chapter\'s Strength - an Ascendancy\'s and the training doctrine\'s tenths on it as on anyone\'s; another guild, none, the band\'s own (mutants: the band, the member, the guards)', () => {
  assert.equal(CHAPTER_PATRON_BAND, 'thriving');
  assert.equal(CHAPTER_PATRON_PRICE, CHAPTER_BANDS.find((b) => b.band === 'thriving').price);
  assert.equal(CHAPTER_PATRON_PRICE, 0.9);
  const c = (strength, o = {}) => ({ strength, patron: { id: GL, name: 'Grey Lanterns', tag: 'GLN' }, ...o });
  assert.deepEqual([chapterPatronMember(c(10), GL), chapterPatronMember(c(10), IW), chapterPatronMember(c(10), null), chapterPatronMember(c(10), ''), chapterPatronMember({ strength: 10 }, GL),
    chapterPatronMember(null, GL), chapterPatronMember({ strength: 10, patron: { id: '' } }, ''), chapterPatronMember({ strength: 10, patron: {} }, undefined)],
  [true, false, false, false, false, false, false, false], 'no guild is never a patron\'s, nor a patron with no id');
  assert.equal(chapterHallFactor(c(10), 'training', GL), 0.9, 'a Failing chapter: its patron\'s members the Thriving price');
  assert.equal(chapterHallFactor(c(10), 'training', IW), chapterPriceFactor(10), 'another guild: the band\'s');
  assert.equal(chapterHallFactor(c(10), 'spells'), chapterPriceFactor(10), 'no guild: the band\'s');
  assert.equal(chapterHallFactor(c(50), 'spells', GL), 0.9, 'a Steady chapter too');
  assert.equal(chapterHallFactor(c(10, { event: 'ascendancy' }), 'spells', GL), 0.9 * 0.9);
  assert.equal(chapterHallFactor(c(10, { doctrine: 'training' }), 'training', GL), 0.9 * 0.9);
  assert.equal(chapterHallFactor(c(10, { doctrine: 'training' }), 'spells', GL), 0.9);
  assert.equal(chapterHallFactor(null, 'training', GL), 1, 'no chapter: DFU\'s own');
});

test('CHAP7b the board\'s words: the patron\'s line, a guildmaster\'s bid and what a bid made says; what it may bid - none standing the least, twice and five times it, else 500, 1,000 and 5,000 more, under the cap (mutants: the words, the offers, the guards)', () => {
  const season = seatSeasonName(2);
  assert.equal(chapterPatronSheetLine({ id: GL, name: 'Grey Lanterns', tag: 'GLN' }), 'Its patron this Season: Grey Lanterns [GLN].');
  assert.equal(chapterPatronSheetLine({ id: GL, name: 'Grey Lanterns', tag: '' }), 'Its patron this Season: Grey Lanterns.');
  assert.deepEqual([chapterPatronSheetLine(null), chapterPatronSheetLine({ id: 'nope', name: 'X' })], [null, null]);
  assert.equal(chapterPatronBidLine({ season: 2, marks: 1500 }), `Your guild bids 1,500 silver for its patronage in ${season}.`);
  assert.equal(chapterPatronBidLine({ season: 2, marks: 0 }), `Your guild has not bid for its patronage in ${season}.`);
  assert.deepEqual([chapterPatronBidLine(null), chapterPatronBidLine({ season: -1, marks: 0 }), chapterPatronBidLine({ season: 2, marks: -5 }), chapterPatronBidLine({ season: 2, marks: 1.5 })], [null, null, null, null]);
  assert.equal(chapterPatronBidSaid(FIGHTERS, 2, 12000), `Your guild bids 12,000 silver for the patronage of the Fighters Guild in ${season}.`);
  assert.deepEqual([chapterPatronBidSaid(THIEVES, 2, 1000), chapterPatronBidSaid(FIGHTERS, null, 1000), chapterPatronBidSaid(FIGHTERS, 2, 1.5)], [null, null, null]);
  assert.deepEqual(CHAPTER_PATRON_RAISES, [500, 1000, 5000]);
  assert.deepEqual(chapterPatronBidsOf({ season: 2, marks: 0 }), [1000, 2000, 5000]);
  assert.deepEqual(chapterPatronBidsOf(null), [1000, 2000, 5000]);
  assert.deepEqual(chapterPatronBidsOf({ season: 2, marks: 1500 }), [2000, 2500, 6500]);
  assert.deepEqual(chapterPatronBidsOf({ season: 2, marks: MARKS_MAX - 600 }), [MARKS_MAX - 100], 'never past the cap');
});

// ── THE SHEET ───────────────────────────────────────────────────────

test('CHAP7b the sheet keeps each chapter\'s patron - its id, name and tag checked, its arms as every face draws them (none where they are not arms), a copy (mutants: the read, the arms, the copy)', async () => {
  const chapters = [
    { f: FIGHTERS, region: ANTICLERE, strength: 50, band: 'steady', seats: [], patron: { id: GL, name: 'Grey Lanterns', tag: 'GLN', heraldry: ARMS } },
    { f: MAGES, region: ANTICLERE, strength: 50, band: 'steady', seats: [], patron: { id: IW, name: 'Iron Wolves', tag: 'IW', heraldry: { field: 'nope' } } },
    { f: 36, region: ANTICLERE, strength: 50, band: 'steady', seats: [], patron: { id: 'bad', name: 'X' } },
  ];
  const sheet = createChapterSheet({ door: { list: async () => ({ ok: true, data: { chapters } }) } });
  sheet.refresh();
  await tick(); await tick();
  const f = sheet.chapterOf(FIGHTERS, ANTICLERE);
  assert.deepEqual(f.patron, { id: GL, name: 'Grey Lanterns', tag: 'GLN', heraldry: ARMS });
  f.patron.name = 'changed';
  assert.equal(sheet.chapterOf(FIGHTERS, ANTICLERE).patron.name, 'Grey Lanterns', 'a copy');
  assert.deepEqual(sheet.chapterOf(MAGES, ANTICLERE).patron, { id: IW, name: 'Iron Wolves', tag: 'IW', heraldry: null }, 'arms that are not: none');
  assert.equal(sheet.chapterOf(36, ANTICLERE).patron, null);
});

// ── THE BANNERS ─────────────────────────────────────────────────────

test('CHAP7b a patron\'s banners hang beside the doors of its chapter\'s halls in the town\'s politic region - two a hall, its arms; none for another guild\'s hall, a patron with no arms, a door unmeasured, or no region (mutants: the read, the region, the arms, the anchors)', () => {
  const frame = { box: [0, 0, 0, 10, 6, 10], door: { a: [4, 0, 10], b: [6, 0, 10] } };
  const pixel = {
    px: 100, py: 200,
    homeFrames: new Map([[1, frame], [2, frame], [3, { box: [0, 0, 0, 1, 1, 1] }], [4, frame]]),
    chapterHalls: new Map([[1, FIGHTERS], [2, MAGES], [3, FIGHTERS], [4, 36]]),
  };
  let clock = 0, regionAsked = null, region = ANTICLERE;
  const askedOf = [];
  const chapterOf = (f, g) => (askedOf.push(g), g !== ANTICLERE ? null
    : f === FIGHTERS ? { patron: { id: GL, heraldry: ARMS } } : f === 36 ? { patron: { id: IW, heraldry: null } } : { patron: null });
  const banners = createChapterBanners({
    built: () => new Map([['k', pixel]]), regionAt: (px, py) => { regionAsked = [px, py]; return region; }, chapterOf,
    translation: () => [1000, 0, 2000], now: () => clock,
  });
  const list = banners.list();
  assert.deepEqual(regionAsked, [100, 200], 'the pixel\'s politic region asked');
  assert.equal(list.length, 2, 'the Fighters\' hall with a measured door: two; the Mages\' no patron; the hall unmeasured none; a patron with no arms none');
  assert.deepEqual(list.map((b) => [b.key, b.heraldry]), [[bannerKeyOf(ARMS), ARMS], [bannerKeyOf(ARMS), ARMS]]);
  assert.ok(list.every((b) => b.top[0] > 900 && b.top[2] > 1900), 'placed by the pixel\'s translation');
  region = null;
  clock += BANNER_REFRESH_MS;
  assert.equal(banners.list().length, 0, 'no region: none');
  assert.ok(askedOf.length && askedOf.every((g) => Number.isInteger(g)), 'never a chapter asked for no region');
});

// ── THE BOARD ───────────────────────────────────────────────────────

/** The board's Work tab over `chapters`; `patron` the door. */
async function board(chapters, { patron = null, sayLate = null } = {}) {
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters, today: { filled: 0, max: 3 } }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  let reads = 0;
  const counted = { ...book, writs: async (...a) => { reads++; return book.writs(...a); } };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  const b = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
    work: { book: counted, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), patron, sayLate } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  return { host, board: b, reads: () => reads };
}

test('CHAP7b the board names each chapter\'s patron, and offers its own guild\'s guildmaster its bid - what it stands at, what it may bid; a press bids, says so and reads the list again; a refusal in its words; a late answer in the chat; none without the door or the bid (mutants: the lines, the offers, the press, the word)', async () => {
  const season = seatSeasonName(2);
  const chapters = [
    { faction: FIGHTERS, strength: 50, band: 'steady', patron: { id: GL, name: 'Grey Lanterns', tag: 'GLN' }, patronBid: { season: 2, marks: 1500 } },
    { faction: MAGES, strength: 50, band: 'steady', patronBid: { season: 2, marks: 0 } },
  ];
  const calls = [];
  const s = await board(chapters, { patron: async (f, m) => { calls.push([f, m]); return { ok: true, data: { season: 2, marks: m } }; } });
  assert.deepEqual(byClass(s.host, 'notice-patron').map((p) => p.textContent), [
    'Its patron this Season: Grey Lanterns [GLN].', `Your guild bids 1,500 silver for its patronage in ${season}.`, `Your guild has not bid for its patronage in ${season}.`,
  ]);
  const picks = byClass(s.host, 'notice-patron-pick');
  assert.deepEqual(picks.map((p) => [p.textContent.split(':')[0], [...p.querySelectorAll('button')].map((x) => x.textContent)]), [
    ['Raise the bid to', ['2,000 silver', '2,500 silver', '6,500 silver']], ['Bid for it', ['1,000 silver', '2,000 silver', '5,000 silver']],
  ]);
  const before = s.reads();
  picks[1].querySelectorAll('button')[1].click();
  for (let i = 0; i < 6; i++) await tick();
  assert.deepEqual(calls, [[MAGES, 2000]]);
  assert.equal(byClass(s.host, 'notice-word')[0]?.textContent, `Your guild bids 2,000 silver for the patronage of the Mages Guild in ${season}.`);
  assert.ok(s.reads() > before, 'the list read again');
  const refused = await board(chapters, { patron: async () => ({ ok: false, error: 'patron-low' }) });
  byClass(refused.host, 'notice-patron-pick')[0].querySelectorAll('button')[0].click();
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(byClass(refused.host, 'notice-word')[0]?.textContent, 'A bid for a patronage is at least 1,000 silver, and more than your guild bid before.');
  const late = [];
  let answer = () => {};
  const l = await board(chapters, { sayLate: (t) => late.push(t), patron: () => new Promise((res) => { answer = () => res({ ok: true, data: { season: 2 } }); }) });
  byClass(l.host, 'notice-patron-pick')[0].querySelectorAll('button')[0].click();
  await tick();
  l.board.unmount();
  answer();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(late, [`Your guild bids 2,000 silver for the patronage of the Fighters Guild in ${season}.`]);
  const shut = await board(chapters, { patron: null });
  assert.deepEqual([byClass(shut.host, 'notice-patron').length, byClass(shut.host, 'notice-patron-pick').length], [1, 0], 'no door: the patron alone');
  const member = await board([{ faction: FIGHTERS, strength: 50, band: 'steady', patron: { id: GL, name: 'Grey Lanterns', tag: 'GLN' } }], { patron: async () => ({ ok: true }) });
  assert.equal(byClass(member.host, 'notice-patron-pick').length, 0, 'no bid sent: not the guildmaster');
});

// ── THE HOST ────────────────────────────────────────────────────────

test('CHAP7b the wiring: the build keeps each town\'s halls by their guild; the banners on the halls\' pass; the hall priced with the reader\'s guild; the board\'s bid door (mutants: each seam)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /\.filter\(\(b\) => \(b\.buildingType === TALK_BUILDING_TYPES\.GuildHall \|\| b\.buildingType === TALK_BUILDING_TYPES\.Temple\) && b\.factionId > 0\)\n\s+\.map\(\(b\) => \[b\.buildingKey, b\.factionId\]\) : \[\]\);/);
  assert.match(world, /\n\s+chapterHalls: pixelChapterHalls,/);
  assert.match(world, /for \(const b of chapterBanners\?\.list\(\) \?\? \[\]\) all\.push\(b\);/);
  assert.match(world, /chapterOf: \(faction, region\) => chapterSheet\.chapterOf\(faction, region\),/);
  assert.match(world, /regionAt: \(px, py\) => \{ try \{ return maps\.getRegionIndexAt\(px, py\); \} catch \{ return null; \} \},\n\s+chapterOf:/);
  assert.match(world, /\n\s+guildId: \(\) => guildBook\?\.guild\?\.id \?\? null,/);
  assert.match(world, /patron: hallDoor && realmSession \? \(faction, marks\) => hallDoor\.patron\(realmSession\.id, faction, region, marks, mintMarksRid\(\)\) : null,/);
  assert.match(src('src/scenes/worldModes.js'), /chapterHallFactor\(chapterHere\(\), service, host\.guildId\?\.\(\) \?\? null\)/);
  assert.match(src('src/net/accountClient.js'), /patron: \(character, faction, region, marks, rid\) => post\('\/v1\/chapters\/patron', \{ character, faction, region, marks, rid \}\),/);
});
