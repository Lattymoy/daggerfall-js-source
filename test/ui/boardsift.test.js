// BOARD-SIFT (2026-10-21, feature-feedback: "Definitely need sorting/filtering functions for work writs considering there
// are thousands of them and you have to scroll through them all to find what you want. The notice board market also
// doesnt show everything if there are too many weapons/armor/etc listed it stops after a certain number"; "The notice
// board in general needs some TLC. The writs especially."): THE WORK TAB'S BAR (ui/workSift.js, wired by
// ui/noticeWindow.js workBody and ui/workTab.js entries) and THE MARKET'S PAGES, SEARCH AND ORDERS (ui/marketTab.js).
// AUDIT BOARD-SIFT (2026-10-22): every kind of work built in the shape its producer mints (server-account/src/
// professions.js writView, writs.js guildWritView and commissionView, contracts.js contractView), each one's fill law and
// words; the bar's own changes drawing the results alone, a composed word read whole; the market's every change from the
// first page, a search read as the names the rows wear, a page an act emptied stepping back, a choice drawn at once.
// The record: bible/06-Systems/Professions-Arc.md 10.13.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, Node_ } from '../chargenDom.mjs';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { createMarketTab, recipeShownName } from '../../src/ui/marketTab.js';
import { siftWork, kindCounts, freshSift, wordsOf, typedField, WORK_SHOWN, WORK_KINDS, WORK_SORTS } from '../../src/ui/workSift.js';
import { materialCountLabel } from '../../src/systems/professions/profItems.js';
import { RECIPES } from '../../src/net/recipeLaw.js';
import { MARKET_PAGES_MAX } from '../../src/net/marketLaw.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
const rest = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 1_800_000_000, DAY = 86_400, DF = 17;
const OAK = 'log:oak', IRON = 'metal:iron', RUBY = 'gem:ruby';
const FIGHTERS = 41;

const entry = (o) => ({ kind: 'court', open: true, fill: false, pay: 0, ends: T + DAY, name: 'x', words: 'x', card: () => null, ...o });

test('BOARD-SIFT the sift: a kind, every word of a search (or of the kind\'s name), what can be filled; the open before the done, then ending soonest (no end last), most silver or A to Z, ties as they came; a page of WORK_SHOWN and the count of every match; each kind\'s count what the search and the fill leave (mutants: one word enough; the kind unsearched; the done mixed in; the ties reordered; no end first; the page uncut; the counts blind to the search)', () => {
  assert.deepEqual([WORK_KINDS, WORK_SORTS, WORK_SHOWN], [['court', 'chapter', 'guild', 'contract', 'commission'], ['ending', 'pay', 'name'], 40]);
  assert.deepEqual(freshSift(), { kind: 'all', find: '', fill: false, sort: 'ending', shown: 40 });
  assert.equal(wordsOf('Oak Logs', null, 'The Silver Hand', undefined), 'oak logs the silver hand');
  const es = [
    entry({ name: 'Iron Ore', words: 'iron ore', pay: 30, ends: T + 3 * DAY }),
    entry({ name: 'Oak Logs', words: 'oak logs the hound', kind: 'guild', pay: 840, ends: T + 5 * DAY, fill: true }),
    entry({ name: 'Oak Logs', words: 'oak logs', open: false, pay: 999, ends: T + 1 }),
    entry({ name: 'Mithril Longsword', words: 'mithril longsword silas', kind: 'commission', pay: 900, ends: T + 2 * DAY, fill: true }),
    entry({ name: 'Ash Logs', words: 'ash logs', pay: 30, ends: T + 3 * DAY }),
    entry({ name: 'Bone', words: 'bone', pay: 1, ends: 0 }),
  ];
  const names = (sift) => siftWork(es, { ...freshSift(), ...sift }).rows.map((e) => `${e.name}${e.open ? '' : ' (done)'}`);
  assert.deepEqual(names({}), ['Mithril Longsword', 'Iron Ore', 'Ash Logs', 'Oak Logs', 'Bone', 'Oak Logs (done)'], 'ending soonest, one with no end after them, the done last, a tie as it came');
  assert.deepEqual(names({ sort: 'pay' }), ['Mithril Longsword', 'Oak Logs', 'Iron Ore', 'Ash Logs', 'Bone', 'Oak Logs (done)'], 'the done last, whatever it pays');
  assert.deepEqual(names({ sort: 'name' }), ['Ash Logs', 'Bone', 'Iron Ore', 'Mithril Longsword', 'Oak Logs', 'Oak Logs (done)']);
  assert.deepEqual(names({ kind: 'guild' }), ['Oak Logs']);
  assert.equal(names({ kind: 'nonsense' }).length, 6, 'a kind it does not know: all');
  assert.deepEqual(names({ fill: true }), ['Mithril Longsword', 'Oak Logs']);
  assert.deepEqual(names({ find: '  OAK  hound ' }), ['Oak Logs'], 'every word');
  assert.deepEqual(names({ find: 'commissions mithril' }), ['Mithril Longsword'], 'the kind\'s own name searched');
  assert.deepEqual(names({ find: 'logs' }), ['Ash Logs', 'Oak Logs', 'Oak Logs (done)']);
  const many = Array.from({ length: 95 }, (_, i) => entry({ name: `w${i}` }));
  assert.deepEqual([siftWork(many, freshSift()).rows.length, siftWork(many, freshSift()).matched, siftWork(many, { ...freshSift(), shown: 80 }).rows.length], [40, 95, 80]);
  assert.deepEqual([...kindCounts(es)], [['all', 6], ['court', 4], ['chapter', 0], ['guild', 1], ['contract', 0], ['commission', 1]]);
  assert.deepEqual([...kindCounts(es, { ...freshSift(), find: 'logs', kind: 'guild' })], [['all', 3], ['court', 2], ['chapter', 0], ['guild', 1], ['contract', 0], ['commission', 0]], 'what the search leaves, the kind aside');
  assert.deepEqual([...kindCounts(es, { ...freshSift(), fill: true })].filter(([, n]) => n), [['all', 2], ['guild', 1], ['commission', 1]]);
});

// ─── THE WORK TAB, EVERY KIND IN ITS PRODUCER'S SHAPE ────────────────
const HND = { id: 'g2', name: 'The Hound', tag: 'HND', heraldry: null };
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
/** professions.js writView */
const writ = (id, material, qty, pay, { kind = 'court', faction = null, state = 'open', ends = T + DAY } = {}) => ({ id, kind, ...(faction != null ? { faction } : {}), material, tier: 1, qty, pay, renown: 5, expiresAt: ends, state });
/** writs.js guildWritView */
const gwrit = (id, guild, material, left, ends, { seat = null, seatName = null, camp = false } = {}) => ({ id, kind: 'guild', guild, region: DF, material, units: 200, left, pay: 3, escrow: 600,
  at: 0, expiresAt: ends, state: 'open', mine: false, may: false, room: seat == null ? 500 : null, seat, camp, seatName });
/** contracts.js contractView */
const contract = (id, pay, left, ends) => ({ id, kind: 'raid', guild: HND, region: DF, pay, deeds: left + 3, left, escrow: pay * left, at: 0, expiresAt: ends, state: 'open', mine: false, may: false });
/** writs.js commissionView */
const commission = (id, poster, crafter, forMe, ends, recipe = 'longsword:mithril') => ({ id, kind: 'commission', region: DF, recipe, quality: 2, pay: 900, poster, crafter, at: 0, expiresAt: ends,
  state: 'open', mine: false, forMe, returned: false });
const SWORD = { item: { provenance: 'c0ffee00c0ffee01', quality: 3 }, where: 'pack', name: 'Merra\'s Mithril Longsword', take: () => true, putBack() {} };
const ALL_WORK = () => ({
  writs: [writ('C1', IRON, 10, 40), writ('C2', OAK, 20, 30), writ('C3', OAK, 80, 90), writ('C4', OAK, 5, 10, { state: 'taken' }),
    writ('H1', RUBY, 1, 25, { kind: 'hall', faction: FIGHTERS }), writ('M1', OAK, 5, 12, { kind: 'member', faction: FIGHTERS })],
  guildWrits: [gwrit('W1', HND, OAK, 100, T + 2 * DAY), gwrit('W2', HND, RUBY, 10, T + 3 * DAY), gwrit('W3', SH, OAK, 40, T + 4 * DAY, { seat: 3021, seatName: 'Anticlere', camp: true }),
    gwrit('W4', HND, IRON, 10, T + 3 * DAY)],
  contracts: [contract('X1', 40, 7, T + 5 * DAY), contract('X2', 20, 30, T + 2 * DAY)],
  commissions: [commission('K1', 'Ann', 'Merra', true, T + 3 * DAY), commission('K2', 'Bo', 'Silverthorn', false, T + 4 * DAY),
    commission('K3', 'Cy', 'Merra', true, T + 4 * DAY, 'dagger:iron')],
});

/** A board whose Work tab holds `work`, read by an Officer (rank 1) of the Silver Hand holding 50 Oak and 3 Rubies, the
 *  sword K1 asks for in the pack (and nothing K3 asks). */
function workBoard(work = ALL_WORK(), { state = { open: true, writs: { today: 0, max: 3 } }, chapters = [{ faction: FIGHTERS, strength: 75, band: 'thriving' }], merit = [] } = {}) {
  const data = { writs: [], guildWrits: [], commissions: [], contracts: [], ...work, today: { filled: state.writs.today, max: 3 }, chapters, merit, yours: { commissions: [], guildWrits: [] },
    guild: { ...SH, rank: 1, mayPost: false, marks: 0, budget: 0, spent: 0, left: 0 }, balance: 0, writsOpen: true, me: 'Merra' };
  const profBook = { state, held: (k) => ({ [OAK]: 50, [RUBY]: 3 })[k] ?? 0, writs: async () => ({ data, error: null, stale: false }), forgetWrits() {} };
  const writBook = { busy: false, state: { workDrafts: null }, settle: async () => ({ ok: true, settled: 0 }) };
  const host = document.createElement('div');
  document.body.append(host);
  const v = mountNoticeBoard(host, {
    town: { name: 'Daggerfall', mapId: 5 },
    book: { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
      draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) },
    work: { book: profBook, region: DF, regionName: 'Daggerfall', countName: (k, n) => materialCountLabel(k, n), writs: writBook, regionNameOf: () => 'Daggerfall',
      pieces: (c) => (c.forMe && c.recipe === 'longsword:mithril' ? [SWORD] : []), settle: () => writBook.settle() },
    nowS: () => T,
  });
  return { host, v, profBook };
}
const openWork = async (host) => { await ticks(); byClass(host, 'notice-tab')[1].click(); await ticks(); };
const sel = (host, key) => host.querySelectorAll('select, input, button').find((n) => n.getAttribute('data-focus') === key);
const choose = (n, value) => { n.value = value; n.onchange(); };
const ids = (host) => byClass(byClass(host, 'notice-grid')[0], 'notice-writ').map((c) => CARD_ID.find(([, re]) => re.test(c.textContent))?.[0] ?? '?');
/** Each card known by its words. */
const CARD_ID = [['C1', /needs 10 Iron/], ['C2', /needs 20 Oak Logs/], ['C3', /needs 80 Oak Logs/], ['C4', /needs 5 Oak Logs/], ['H1', /Wanted: 1 Ruby/], ['M1', /Yours to fill: 5 Oak Logs/],
  ['W1', /Hound \[HND\] needs 100 more/], ['W2', /Hound \[HND\] needs 10 more Rubies/], ['W3', /Silver Hand \[SH\] needs 40 more/], ['W4', /Hound \[HND\] needs 10 more Iron/],
  ['X1', /40 silver each/], ['X2', /20 silver each/], ['K1', /For Merra only: a Mithril/], ['K2', /For Silverthorn only/], ['K3', /For Merra only: an Iron Dagger/]];
const find = async (host, words) => { const f = sel(host, 'worksift|find'); f.value = words; f.oninput(); await rest(200); };

test('BOARD-SIFT the Work tab, every kind as its producer mints it: the kinds and their counts; "Only what I can fill" each kind\'s own law - a Court or chapter writ held whole, a guild writ held and the reader free to deliver it, a commission naming the reader with a piece that answers it, a contract never - and none of the day\'s writs once its three are filled; the counts what the fill leaves (mutants: a chapter writ counted as the Court\'s; a commission as a guild\'s; a contract fillable; the day\'s allowance unread; the reader\'s own guild deliverable; a commission\'s piece unasked)', async () => {
  const r = workBoard();
  await openWork(r.host);
  const kinds = () => sel(r.host, 'worksift|kind').children.map((o) => o.textContent);
  assert.deepEqual(kinds(), ['All work (15)', 'Court writs (4)', 'Chapter writs (2)', 'Guild writs (4)', 'Guild contracts (2)', 'Commissions (3)']);
  const fill = sel(r.host, 'worksift|fill');
  fill.checked = true; fill.onchange();
  assert.deepEqual(ids(r.host).sort(), ['C2', 'H1', 'K1', 'M1', 'W1', 'W2'],
    'C2, the Ruby and the member\'s Oak held whole; W1 and W2 another guild\'s and held; K1 the reader\'s with its sword - never W3 (the reader\'s own guild), W4 (no Iron), the contracts, K2 (another\'s), K3 (no dagger)');
  assert.deepEqual(kinds(), ['All work (6)', 'Court writs (1)', 'Chapter writs (2)', 'Guild writs (2)', 'Commissions (1)'], 'the counts what the fill leaves; contracts none');
  r.v.unmount();
  const full = workBoard(ALL_WORK(), { state: { open: true, writs: { today: 3, max: 3 } } });
  await openWork(full.host);
  const f2 = sel(full.host, 'worksift|fill');
  f2.checked = true; f2.onchange();
  assert.deepEqual(ids(full.host).sort(), ['K1', 'W1', 'W2'], 'the day\'s three filled: no Court or chapter writ is fillable - the guild\'s and the commission\'s are no writ of the day');
  full.v.unmount();
});

test('BOARD-SIFT the Work tab\'s search finds a card by what it says - the material one and many, the kind as the card writes it, a seat writ\'s seat and camp, a guild\'s tag, a commission\'s crafter and poster, a contract\'s region; "Most silver" a contract\'s pay to one defender (mutants: the singular unindexed; the seat\'s words dropped; the crafter and poster dropped; the contract\'s region dropped; the card\'s own kind unindexed; the contract\'s silver its whole pool)', async () => {
  const r = workBoard();
  await openWork(r.host);
  const found = async (words) => { await find(r.host, words); return ids(r.host).sort(); };
  assert.deepEqual(await found('ruby'), ['H1', 'W2'], 'one - a chapter\'s writ and a guild\'s');
  assert.deepEqual(await found('rubies'), ['H1', 'W2'], 'and many');
  assert.deepEqual(await found('court writ'), ['C1', 'C2', 'C3', 'C4']);
  assert.deepEqual(await found('chapter writ'), ['H1', 'M1'], '"Your chapter writ" too');
  assert.deepEqual(await found('your'), ['M1'], 'as the card writes its kind - the bar\'s "Chapter writs" says no "your"');
  assert.deepEqual(await found('seat'), ['W3']);
  assert.deepEqual(await found('siege camp anticlere'), ['W3']);
  assert.deepEqual(await found('hnd'), ['W1', 'W2', 'W4', 'X1', 'X2']);
  assert.deepEqual(await found('silverthorn'), ['K2'], 'the crafter');
  assert.deepEqual(await found('ann'), ['K1'], 'the poster');
  assert.deepEqual(await found('daggerfall'), ['X1', 'X2'], 'a contract\'s region');
  await find(r.host, '');
  choose(sel(r.host, 'worksift|kind'), 'contract');
  choose(sel(r.host, 'worksift|sort'), 'pay');
  assert.deepEqual(ids(r.host), ['X1', 'X2'], '40 silver a defender before 20 - though the 20 holds more silver');
  r.v.unmount();
});

test('BOARD-SIFT the bar\'s own changes draw the results alone: the search field typed in is never replaced, keeps the focus, and a word composed is read whole - the window\'s paint waits on it; "Show more" keeps the focus on the board (mutants: the bar redrawn by its own search; the composition unread; the paint over a composed word; the focus dropped)', async () => {
  const writs = Array.from({ length: 95 }, (_, i) => writ(`C${i}`, OAK, 5, 10 + i, { ends: T + DAY + i }));
  const r = workBoard({ writs });
  await openWork(r.host);
  const field = sel(r.host, 'worksift|find');
  field.focus();
  field.value = 'oak'; field.oninput();
  await rest(200);
  assert.equal(sel(r.host, 'worksift|find'), field, 'the same field');
  assert.equal(document.activeElement, field, 'still in the reader\'s hands');
  assert.equal(byClass(r.host, 'work-sift-count')[0].textContent, 'Showing 40 of 95');
  // a word composed: nothing read, and no paint, until it is whole
  field.dispatch('compositionstart', {});
  field.value = 'oak zz'; field.oninput();
  await rest(200);
  assert.equal(byClass(r.host, 'work-sift-count')[0].textContent, 'Showing 40 of 95', 'mid-word: not read');
  assert.equal(field.getAttribute('data-composing'), '1');
  r.v.repaint();
  assert.equal(sel(r.host, 'worksift|find'), field, 'the window\'s paint waits on the word');
  field.dispatch('compositionend', {});
  await rest(200);
  assert.equal(field.getAttribute('data-composing'), undefined);
  assert.notEqual(sel(r.host, 'worksift|find'), field, 'the paint that waited, done');
  assert.match(byClass(r.host, 'work-sift-none')[0]?.textContent ?? '', /^No work matches\./, 'the whole word read');
  r.profBook.state.workSift.find = '';
  r.v.repaint();
  const more = () => byClass(r.host, 'work-sift-more')[0];
  more().focus();
  more().click();
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 80);
  assert.equal(document.activeElement, more(), 'the focus on the next "Show more"');
  r.v.unmount();
  // typedField alone: the rest's wait, never mid-word
  const input = document.createElement('input');
  let settled = 0;
  const typed = typedField(input, 10, () => { settled++; });
  typed(); typed();
  await rest(30);
  input.dispatch('compositionstart', {}); typed();
  await rest(30);
  assert.equal(settled, 1, 'once for the two keys; none mid-word');
  input.dispatch('compositionend', {});
  await rest(30);
  assert.equal(settled, 2);
});

test('BOARD-SIFT the Work tab draws a page of the work at a time and keeps the sift for the session; the chapters\' head over Merit lines alone; "No Court writs" only where the bar sifts nothing away, and "No work matches." only where work stands (mutants: every card drawn; the sift the window\'s own; the head lost with no card; the none-today word under a filter; no work said unmatched)', async () => {
  const writs = Array.from({ length: 95 }, (_, i) => writ(`C${i}`, OAK, 5, 10 + i, { ends: T + DAY + i }));
  const state = { open: true, writs: { today: 0, max: 3 } };
  const r = workBoard({ writs }, { state });
  await openWork(r.host);
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 40);
  byClass(r.host, 'work-sift-more')[0].click();
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 80);
  choose(sel(r.host, 'worksift|sort'), 'pay');
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 40, 'a change: the first page of it');
  r.v.unmount();
  const again = workBoard({ writs }, { state });
  await openWork(again.host);
  assert.equal(sel(again.host, 'worksift|sort').value, 'pay', 'the order kept');
  assert.equal(byClass(byClass(again.host, 'notice-grid')[0], 'writ-pay')[0].textContent.split(',')[0], 'Pays 104 silver');
  again.v.unmount();
  // Merit lines with no chapter card: still under their head
  const merit = workBoard({}, { chapters: [], merit: [{ faction: FIGHTERS, merit: 10, max: 600, elsewhere: false, from: null }] });
  await openWork(merit.host);
  assert.ok(byClass(merit.host, 'notice-section').some((h) => h.textContent === 'Chapters in Daggerfall'));
  assert.equal(byClass(merit.host, 'work-sift-none').length, 0, 'no work at all: nothing said unmatched');
  assert.match(byClass(merit.host, 'notice-grid')[0].textContent, /^No Court writs in Daggerfall today\./);
  merit.v.unmount();
  // no Court writs, guild writs standing: the none-today word with the whole list, never under a filter
  const guilds = workBoard({ guildWrits: [gwrit('W1', HND, OAK, 100, T + 2 * DAY)] }, { state: { open: true, writs: { today: 0, max: 3 } } });
  await openWork(guilds.host);
  assert.match(byClass(guilds.host, 'notice-grid')[0].textContent, /No Court writs in Daggerfall today\./);
  choose(sel(guilds.host, 'worksift|kind'), 'guild');
  assert.doesNotMatch(byClass(guilds.host, 'notice-grid')[0].textContent, /No Court writs/);
  guilds.v.unmount();
});

// ─── THE MARKET ──────────────────────────────────────────────────────
/** The Market tab over a book that answers `answer(view, q)`, every read's q kept. */
function marketRig(answer, { fresh = () => false, goldOk = false } = {}) {
  const asked = [];
  const book = { state: { open: true, balance: 50, road: [], counts: {} }, pending: 0, cached: () => null, fresh, goldOk, purse: () => 1000,
    read: async (view, q) => { asked.push({ view, ...q }); return { ok: true, data: answer(view, q) }; }, settle: async () => ({ ok: true, settled: 0 }) };
  const m = { book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {},
    name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: (p) => p.name,
    weavers: [], stock: async () => ({ ok: true }) };
  let root = null;
  const draw = () => { root?.remove?.(); root = tab.body(); document.body.append(root); };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => start(), rerender: () => draw(), nowS: () => 0, alive: () => true });
  return { tab, asked, root: () => root };
}
const far = { courier: 0, seconds: 60, road: 400 };   // one piece's courier over 400 pixels: 17 silver
const pieceRows = (page, n, price = (i) => i + 1, region = (i) => (i % 2 ? DF : 23)) => Array.from({ length: n }, (_, i) => ({ id: `p${page}-${i}`, kind: 'piece', region: region(i), price: price(i), units: 1,
  road: region(i) === DF ? { courier: 0, seconds: 0, road: 0 } : far, piece: { name: `piece ${i}`, quality: 2, wear: 1000 }, currency: 'marks' }));
const view = async (r, name) => { byClass(r.root(), 'market-view').find((b) => b.textContent === name).click(); await ticks(); };
const pager = (r) => byClass(r.root(), 'market-pager')[0];

test('BOARD-SIFT the Market\'s pages: "Page 1 of 3 · 250 in all", Previous and Next, a turn reading that page (one while it reads), its first row brought into view; one page, none; at most MARKET_PAGES_MAX pages; a page an act emptied read again as the last that stands (mutants: the page never sent; Next past the last; the pager on one page; the cap unread; the floor lost; the turn twice; the list left where it was; the emptied page shown)', async () => {
  let total = 250;
  const r = marketRig((v, q) => (v === 'crafted' ? { rows: (q.page ?? 0) * 100 < total ? pieceRows(q.page ?? 0, Math.min(100, total - (q.page ?? 0) * 100)) : [], page: q.page ?? 0, total } : { rows: [], medians: {} }));
  await r.tab.open();
  await view(r, 'Crafted');
  assert.deepEqual(r.asked.at(-1), { view: 'crafted', region: DF, hubs: {}, family: null }, 'the first page, its own order: nothing more asked');
  assert.equal(byClass(pager(r), 'market-pageof')[0].textContent, 'Page 1 of 3 · 250 in all');
  assert.deepEqual(byClass(pager(r), 'market-page').map((b) => [b.textContent, b.disabled]), [['Previous', true], ['Next', false]]);
  const scrolled = [];
  const was = Node_.prototype.scrollIntoView;
  Node_.prototype.scrollIntoView = function () { scrolled.push(this.className); };
  try {
    const next = byClass(pager(r), 'market-next')[0];
    const n0 = r.asked.length;
    next.click(); next.click();
    await ticks();
    assert.equal(r.asked.length, n0 + 1, 'one turn while the page is read');
    assert.equal(r.asked.at(-1).page, 1);
    assert.ok(scrolled.includes('market-rows'), 'its first row brought into view');
  } finally { Node_.prototype.scrollIntoView = was; }
  assert.equal(byClass(pager(r), 'market-pageof')[0].textContent, 'Page 2 of 3 · 250 in all');
  byClass(pager(r), 'market-next')[0].click();
  await ticks();
  assert.deepEqual(byClass(pager(r), 'market-page').map((b) => b.disabled), [false, true], 'the last page: no Next');
  // its last rows bought: the read again finds none past 200 - the last page that stands is read
  total = 200;
  await r.tab.load(true);
  await ticks();
  assert.deepEqual([r.asked.at(-2).page, r.asked.at(-1).page], [2, 1]);
  assert.equal(byClass(pager(r), 'market-pageof')[0].textContent, 'Page 2 of 2 · 200 in all');
  assert.equal(byClass(r.root(), 'market-row').length, 100);
  // the cap, and a page the service answers past its count
  const big = marketRig((v, q) => (v === 'goods' ? { rows: pieceRows(0, 3), page: q.page ?? 0, total: 1_000_000 } : { rows: [], medians: {} }));
  await big.tab.open();
  await view(big, 'Goods');
  assert.equal(byClass(pager(big), 'market-pageof')[0].textContent, `Page 1 of ${MARKET_PAGES_MAX} · 1,000,000 in all`);
  const odd = marketRig((v) => (v === 'goods' ? { rows: pieceRows(3, 3), page: 3, total: 150 } : { rows: [], medians: {} }));
  await odd.tab.open();
  await view(odd, 'Goods');
  assert.equal(byClass(pager(odd), 'market-pageof')[0].textContent, 'Page 4 of 4 · 150 in all', 'never a page past its own count');
  const one = marketRig((v) => (v === 'goods' ? { rows: pieceRows(0, 3), page: 0, total: 3 } : { rows: [], medians: {} }));
  await one.tab.open();
  await view(one, 'Goods');
  assert.equal(byClass(one.root(), 'market-pager').length, 0, 'one page: no pager');
});

test('BOARD-SIFT the Market\'s Crafted controls: each change - a search, the least quality, the order, the family, the currency - reads from the first page; a default chosen asks nothing; a search is read as the recipes whose name or whose piece\'s name on its row holds its words; the cheapest order sorts by the landed price, any other keeps the service\'s (mutants: the search unsent; the shown names unread; the page kept through the order, the quality, the family or the currency; a default sent; the landed sort over every order, or lost)', async () => {
  // A here at 15 lands at 15; B from Wayrest at 10 lands at 27 (a 17-silver courier); C here at 12
  const rows = [{ ...pieceRows(0, 1, () => 15, () => DF)[0], id: 'A' }, { ...pieceRows(0, 1, () => 10, () => 23)[0], id: 'B' }, { ...pieceRows(0, 1, () => 12, () => DF)[0], id: 'C' }];
  const r = marketRig((v, q) => (v === 'crafted' ? { rows, page: q.page ?? 0, total: 400 } : { rows: [], medians: {} }), { goldOk: true });
  await r.tab.open();
  await view(r, 'Crafted');
  const prices = () => byClass(r.root(), 'market-row').map((b) => byClass(b, 'market-price')[0].textContent);
  assert.deepEqual(prices(), ['12 silver', '15 silver', '10 silver'], 'the cheapest landed: B\'s courier puts it last');
  const selects = () => r.root().querySelectorAll('select');
  const named = (label) => selects().find((s) => s.getAttribute('aria-label') === label);
  const turned = async () => { byClass(pager(r), 'market-next')[0].click(); await ticks(); assert.equal(r.asked.at(-1).page, 1); };
  await turned();
  const order = named('Order');
  assert.deepEqual(order.children.map((o) => o.textContent), ['Cheapest first', 'Dearest first', 'Newest first', 'Best quality first']);
  choose(order, 'dear'); await ticks();
  assert.deepEqual([r.asked.at(-1).sort, r.asked.at(-1).page], ['dear', undefined]);
  assert.deepEqual(prices(), ['15 silver', '10 silver', '12 silver'], 'the service\'s own order');
  choose(named('Order'), 'cheap'); await ticks();
  assert.equal('sort' in r.asked.at(-1), false, 'the default chosen: nothing asked');
  assert.deepEqual(prices(), ['12 silver', '15 silver', '10 silver'], 'and the landed sort again');
  await turned();
  const quality = named('Least quality');
  assert.deepEqual(quality.children.map((o) => o.textContent), ['Any quality', 'Standard or better', 'Fine or better', 'Superior or better', 'Masterwork']);
  choose(quality, '3'); await ticks();
  assert.deepEqual([r.asked.at(-1).quality, r.asked.at(-1).page], [3, undefined]);
  await turned();
  choose(named('Family'), 'staves'); await ticks();
  assert.deepEqual([r.asked.at(-1).family, r.asked.at(-1).page], ['staves', undefined]);
  await turned();
  choose(named('Currency'), 'gold'); await ticks();
  assert.deepEqual([r.asked.at(-1).currency, r.asked.at(-1).page], ['gold', undefined], 'the currency too');
  choose(named('Currency'), 'marks'); await ticks();
  await turned();
  const findField = r.root().querySelectorAll('input').find((n) => n.getAttribute('data-focus') === 'find|crafted');
  assert.deepEqual([findField.getAttribute('aria-label'), findField.maxLength], ['Search the pieces by name', 40]);
  findField.value = 'Iron Staff'; findField.oninput();
  await rest(350);
  assert.deepEqual([r.asked.at(-1).recipes, r.asked.at(-1).page], [['staff:pine', 'staff:ironwood'], undefined], 'the Pine Staff its row\'s "Iron Staff", the Ironwood its own name - of the family chosen');
  // the views' choices let go: Auctions opens on its own
  await view(r, 'Auctions');
  assert.deepEqual(Object.keys(r.asked.at(-1)).filter((k) => ['page', 'sort', 'recipes', 'quality'].includes(k)), []);
  assert.deepEqual(r.root().querySelectorAll('select').find((s) => s.getAttribute('aria-label') === 'Order').children.map((o) => o.textContent),
    ['Ending soonest', 'Cheapest first', 'Dearest first', 'Newest first']);
  const af = r.root().querySelectorAll('input').find((n) => n.getAttribute('data-focus') === 'find|auctions');
  af.value = 'wakazashi'; af.oninput();
  await rest(350);
  assert.ok(r.asked.at(-1).recipes.includes('wakizashi:iron'), 'DFU\'s spelling on the row finds the Wakizashi');
  assert.match(r.root().textContent, /No Masterwork of that kind is up for auction\./, 'none found by a search: said of its kind');
});

test('BOARD-SIFT the names a recipe\'s piece wears on its row: every crafted recipe found by its own row\'s name - the Warforged in Ebony, the woods in metals, DFU\'s "Wakazashi" (mutant: the shown names unread)', () => {
  const shownOf = (id) => recipeShownName(RECIPES.find((r) => r.id === id));
  assert.deepEqual([shownOf('staff:pine'), shownOf('longsword:warforged'), shownOf('wakizashi:iron'), shownOf('shortbow:oak')], ['Iron Staff', 'Ebony Longsword', 'Iron Wakazashi', 'Steel Short Bow']);
});

test('BOARD-SIFT a choice made in a market list draws its answer at once, though the list keeps the focus - an answer the minute\'s cache gave stood behind the old rows until the reader clicked elsewhere (mutant: the chosen list held)', async () => {
  const r = marketRig((v, q) => (v === 'crafted' ? { rows: pieceRows(0, 2, (i) => (q.sort === 'dear' ? 900 - i : 100 + i), () => DF), page: 0, total: 2 } : { rows: [], medians: {} }), { fresh: () => true });
  await r.tab.open();
  await view(r, 'Crafted');
  const order = r.root().querySelectorAll('select').find((s) => s.getAttribute('aria-label') === 'Order');
  order.focus();
  choose(order, 'dear');
  await ticks();
  assert.deepEqual(byClass(r.root(), 'market-row').map((b) => byClass(b, 'market-price')[0].textContent), ['900 silver', '899 silver']);
});

test('BOARD-SIFT the board keeps the keyboard\'s focus on the Market\'s Next through the page\'s read (mutant: the pages unkeyed)', async () => {
  const book = { state: { open: true, balance: 50, road: [], counts: {} }, pending: 0, cached: () => null,
    read: async (v, q) => ({ ok: true, data: v === 'crafted' ? { rows: pieceRows(q.page ?? 0, 100), page: q.page ?? 0, total: 300 } : { rows: [], medians: {} } }), settle: async () => ({ ok: true, settled: 0 }) };
  const host = document.createElement('div');
  document.body.append(host);
  const v = mountNoticeBoard(host, {
    town: { name: 'Daggerfall', mapId: 5 }, nowS: () => T,
    book: { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
      draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) },
    market: { book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {}, name: (k) => k, countName: (k) => k,
      pieces: () => [], take: () => true, putBack() {}, mint() {}, pieceName: (p) => p.name, drop() {}, weavers: [], stock: async () => ({ ok: true }) },
  });
  await ticks();
  byClass(host, 'notice-tab').find((b) => b.textContent === 'Market').click();
  await ticks();
  byClass(host, 'market-view').find((b) => b.textContent === 'Crafted').click();
  await ticks();
  const next = byClass(host, 'market-next')[0];
  next.focus();
  next.click();
  await ticks();
  assert.equal(document.activeElement?.getAttribute?.('data-focus'), 'pager|next');
  assert.notEqual(document.activeElement, next, 'the new Next, after the page\'s read');
  assert.equal(byClass(host, 'market-pageof')[0].textContent, 'Page 2 of 3 · 300 in all');
  v.unmount();
});
