// BOARD-UI (2026-10-06, Mac: "Some towns have double notice boards"; "overhaul the notice boards to enhance readability,
// Including each of the tabs"; "Enhance the speed at which the notice board and market loads"; "Enhance organization of
// the market"; "Reduce overusage of bloated text. Less AI like text"; "Enhance the guild war tab of the board for better
// organization, instruction and readability"): ONE NOTICE BOARD A TOWN (systems/bountyBoard.js noticeBoardIndex, read by
// every seam of the hosts), the board's tabs laid out to be read (ui/noticeWindow.js, ui/marketTab.js, ui/seatTab.js),
// the reads set out early and side by side, the words cut. The record: bible/06-Systems/Professions-Arc.md 10.11.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { questBoardIndices, noticeBoardIndex } from '../src/systems/bountyBoard.js';
import { mountNoticeBoard, BOARD_WORDS, GUILD_BOARD_EMPTY } from '../src/ui/noticeWindow.js';
import { createMarketTab, MARKET_VIEW_GROUPS, MARKET_WORDS } from '../src/ui/marketTab.js';
import { seatGuide, SEAT_PANELS, SEAT_TAB_WORDS } from '../src/ui/seatTab.js';
import { VENDOR_TEXT, createVendorTab } from '../src/ui/vendorTab.js';
import { WARM_CHUNKS } from '../src/ui/enhancedChunk.js';
import { createMarketBook } from '../src/net/marketBook.js';
import { MARKET_VIEWS } from '../src/net/marketLaw.js';
import { CLAIM_THRESHOLD, CLAIM_FEE, ACCOUNT_SEAT_WEEK_CAP, SEAT_PLEDGE_REGIONS_MAX } from '../src/net/townSeatLaw.js';
import { NOTICE_CSS, PROF_CSS } from '../src/ui/enhancedPlusStyle.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
/** A town's board book over one board, read at once. */
const bookOf = (board, seenAt = T - 1000) => ({
  seenAt: () => seenAt, read: async () => ({ board }), markSeen: () => {}, cached: () => board,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }),
  readGuild: async () => ({ data: null, error: 'no-guild' }),
});
const EMPTY = { notes: [], notices: [], me: {} };
/** A board at x (and z), a box a metre on a side. */
const at = (x, z = 0) => ({ box: [x, 0, z, x + 1, 2, z + 1] });

test('ONE-BOARD the town\'s one Notice Board: of the boards BOUNTY1 left, the one nearest the town\'s middle - the first by position on a tie or with no middle; a lone board is it; none where every board posts bounties (mutants: every board left; the bounty test; the nearest; the tie)', () => {
  assert.equal(noticeBoardIndex([at(5)]), 0, 'a lone board keeps its notices');
  const two = [at(40), at(10)];
  assert.deepEqual([...questBoardIndices(two)], [1], 'by position: the board at 10 posts the bounties');
  assert.equal(noticeBoardIndex(two), 0);
  // three: the split leaves two - ONE is the Notice Board, never both
  const three = [at(0), at(100), at(50)];
  assert.deepEqual([...questBoardIndices(three)], [0]);
  assert.equal(noticeBoardIndex(three), 2, 'no middle: the first left, by position');
  assert.equal(noticeBoardIndex(three, undefined, [100, 0]), 1, 'the one nearest the town\'s middle');
  assert.equal(noticeBoardIndex(three, questBoardIndices(three), [52, 0]), 2);
  assert.equal(noticeBoardIndex([at(0), at(10), at(20)], new Set([0]), [15.5, 0.5]), 1, 'equally near: the first by position');
  // five: two bounty boards, and one Notice Board of the three left
  const five = [at(1), at(2), at(3), at(4), at(5)];
  const bounty = questBoardIndices(five);
  assert.deepEqual([...bounty].sort(), [0, 2]);
  assert.equal(noticeBoardIndex(five, bounty, [4.4, 0.5]), 3);
  assert.equal(noticeBoardIndex([at(0), at(1)], new Set([0, 1])), -1, 'every board a bounty board: none');
  assert.equal(noticeBoardIndex([]), -1);
  assert.equal(noticeBoardIndex(null), -1);
});

test('ONE-BOARD the hosts: the press, the count over the board, the town the player stands in, the town map and a seat\'s pennant all read the one law - one Notice Board a town, named on hover while it is open (mutants: each seam back on every board the split left)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const noticeBoardOf = \(p\) => \(p\._noticeBoard \?\?= noticeBoardIndex\(p\.boards \?\? \[\], boardSplitOf\(p\), townCentreOf\(p\.homeFrames\)\)\);/);
  assert.match(w, /const noticeAt = noticeTown \? noticeBoardOf\(p\) : -1;/);
  assert.match(w, /\.\.\.\(i === noticeAt \? \{ notice: noticeTown, named: noticeBook\.open === true \} : \{\}\),/);
  const count = w.slice(w.indexOf('const noticeCountPoints = ('), w.indexOf('const partyMarkers = ('));
  assert.match(count, /const at = noticeBoardOf\(p\);\n\s*if \(at < 0\) continue;/);
  assert.match(count, /if \(i !== at\) return;/);
  assert.doesNotMatch(count, /bountyAt/, 'the count over one board, never every board the split left');
  assert.match(w, /return noticeBoardOf\(p\) >= 0 \? noticeTownOf\(p\.px, p\.py, boardSplitOf\(p\)\.size > 0\) : null;/);
  assert.match(w, /return town \? townBoardRows\(p, noticeBoardOf\(p\), noticeBook\.unseen\(town\.mapId\)\) : \[\];/);
  assert.match(w, /notice: noticeBoardIndex\(pixelBoards, pixelBoardSplit, townCentreOf\(pixelHomeFrames\)\),/, 'the pennant: the build\'s own measure, the same law');
  assert.match(src('src/scenes/worldModes.js'), /const NOTICE_BOARD_TEXT = 'Notice Board';/);
});

test('BOARD-UI the Notices tab: the town\'s and the server\'s word under "News", then the players\' notes under their count; the tab names how many are new since this device last read the board (mutants: one grid; the count unsaid; the old notes counted; the read said twice)', async () => {
  const board = { notes: [{ id: 'a', subject: 'Party', body: 'x', from: 'Ann', at: T - 10 }, { id: 'b', subject: 'Old', body: 'y', from: 'Bo', at: T - 5000 }],
    notices: [{ id: 's', subject: 'Restart', body: 'z', from: 'Mac', at: T - 20 }], me: { canPin: true, live: 0, max: 3 } };
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, rumour: ['Grain is dear.'], book: bookOf(board), nowS: () => T, guilds: true });
  await tick();
  assert.deepEqual(byClass(host, 'notice-section').map((h) => h.textContent), [BOARD_WORDS.news, `${BOARD_WORDS.notes}2`]);
  assert.deepEqual(byClass(host, 'notice-grid').map((g) => byClass(g, 'notice-card').length), [2, 2], 'News: the rumour and the server\'s notice; the notes their own');
  const tab = byClass(host, 'notice-tab')[0];
  assert.equal(tab.textContent, 'Notices2', 'the note and the notice new since the last read - never the old note');
  assert.equal(tab.getAttribute('aria-label'), 'Notices, 2 new');
  v.unmount();
  // none from players: said under their name
  const host2 = document.createElement('div');
  mountNoticeBoard(host2, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf({ ...EMPTY, me: { canPin: true, live: 0, max: 3 } }), nowS: () => T });
  await tick();
  assert.match(host2.textContent, new RegExp(`${BOARD_WORDS.notes}0${BOARD_WORDS.noNotes} Pin the first\\.`));
  // a read under way: said once, in the window's head - never again under the notes
  const host3 = document.createElement('div');
  const v3 = mountNoticeBoard(host3, { town: { name: 'Anticlere', mapId: 1 }, book: { ...bookOf(EMPTY), read: () => new Promise(() => {}) }, nowS: () => T });
  await tick();
  assert.equal(host3.textContent.split(BOARD_WORDS.reading).length - 1, 1, `"${BOARD_WORDS.reading}" said once`);
  v3.unmount();
});

test('BOARD-UI the Work tab: the day\'s count stands over the cards, not under the last; the tab names the writs open to take (mutants: the day back at the foot; every writ counted)', async () => {
  const writs = [{ id: 'w1', material: 'ore:iron', qty: 3, pay: 9, renown: 5, expiresAt: T + 3600, state: 'open' }, { id: 'w2', material: 'ore:iron', qty: 3, pay: 9, renown: 5, expiresAt: T + 3600, state: 'taken' }];
  const book = { state: { open: true, writs: { today: 1, max: 3 } }, held: () => 0, writs: async () => ({ data: { writs, today: { filled: 1, max: 3 } }, error: null, stale: false }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, work: { book, region: 17, regionName: 'Daggerfall', countName: () => 'Iron Ore' } });
  await tick();
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  const cork = byClass(host, 'notice-cork')[0];
  assert.equal(cork.children[0].className, 'notice-worktoday');
  assert.equal(cork.children[0].textContent, 'Court writs today: 1 of 3');
  assert.equal(byClass(host, 'notice-tab')[1].textContent, 'Work1', 'the writ open, never the one taken');
});

/** The Market tab over a fake book - its body drawn into the page at each redraw. */
function marketRig(data, extra = {}) {
  const book = { state: { open: true, balance: 50, road: [], counts: {} }, pending: 0, cached: () => null,
    read: async (view) => ({ ok: true, data: data[view] ?? { rows: [] } }), settle: async () => ({ ok: true, settled: 0 }), ...extra };
  const m = { book, stores: () => new Map([['ore:iron', { material: 'ore:iron', own: 5, bought: 0 }]]), region: 17, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {},
    name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece',
    weavers: [{ key: 'cloth:linen', marks: 2 }], stock: async () => ({ ok: true }) };
  let root = null;
  const draw = () => { root?.remove?.(); root = tab.body(); document.body.append(root); };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => start(), rerender: () => draw(), nowS: () => 0, alive: () => true });
  return { tab, m, draw, root: () => root };
}

test('BOARD-UI the Market tab: Your silver at the top; the views in their parts - Buy, Sell, then History - every view once; the columns named over the rows; the suppliers\' counters folded under one line, kept open across a redraw; the List press never the lists\' class (mutants: the wallet at the foot; a view in no part; the fold\'s state lost; the class clash)', async () => {
  const r = marketRig({ materials: { rows: [{ id: 'A', kind: 'material', material: 'ore:iron', units: 9, price: 3, region: 17, road: { courier: 0, seconds: 0, road: 0 } }], medians: {} } });
  await r.tab.open();
  const root = r.root();
  assert.equal(root.children[0].className, 'market-wallet');
  assert.equal(root.children[0].textContent, 'Your silver: 50 silver');
  assert.deepEqual(byClass(root, 'market-viewpart').map((p) => p.textContent), ['Buy', 'Sell']);
  assert.deepEqual(byClass(root, 'market-viewgroup').map((g) => byClass(g, 'market-view').map((b) => b.textContent)),
    [['Materials', 'Crafted', 'Auctions', 'Goods'], ['Orders', 'My listings'], ['History']]);
  assert.deepEqual(MARKET_VIEW_GROUPS.flatMap(([, ids]) => ids).sort(), MARKET_VIEWS.map(([v]) => v).sort(), 'every view in one part, once');
  assert.equal(byClass(root, 'market-listhead')[0].textContent, 'MaterialPriceFrom7-day median');
  const fold = byClass(root, 'market-suppliers')[0];
  assert.equal(fold.tagName, 'DETAILS');
  assert.equal(fold.open, false, 'folded until opened');
  assert.match(fold.textContent, new RegExp(`^${MARKET_WORDS.suppliers}The Weavers' counter`));
  fold.open = true;
  fold.dispatch('toggle', {});
  r.draw();
  assert.equal(byClass(r.root(), 'market-suppliers')[0].open, true, 'kept open across the window\'s redraw');
  [...r.root().querySelectorAll('button')].find((b) => b.textContent === 'My listings').onclick();
  await tick();
  const list = [...r.root().querySelectorAll('button')].find((b) => b.textContent === 'List');
  assert.equal(list.className.split(/\s+/).includes('market-list'), false, 'the lists\' class took the press\'s padding');
  assert.ok(byClass(r.root(), 'market-field').length >= 3, 'the form\'s fields under their names');
  // the Vendors tab names its columns as the Market does
  const vendors = createVendorTab({ mode: 'board', read: async () => ({ ok: true, data: { rows: [{ id: 'v', item: 'Iron Dagger', price: 9, owner: 'Eve', map: 1, buildingKey: 2, expiresAt: 99 }] } }), nameOf: (i) => i, townOf: () => 'Daggerfall' },
    { busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true });
  await vendors.open();
  assert.equal(byClass(vendors.body(), 'market-listhead')[0].textContent, 'ItemConditionPriceSold at');
});

test('BOARD-UI the market\'s speed: the board reads the Materials view the moment it opens and the tab answers from that read; the opening settle and the view\'s read set out together (mutants: no prefetch; the read after the settle)', async () => {
  let reads = 0;
  const door = { account: () => 'acct-1', read: async (b) => { reads++; return { ok: true, data: { view: b.view, rows: [], balance: 10 } }; } };
  const book = createMarketBook({ door, character: () => 'c', now: () => 1_000_000, sleep: async () => {} });
  const market = { ...marketRig({}).m, book, weavers: [] };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, market });
  assert.equal(reads, 1, 'read as the board opens - before its tab is pressed');
  await tick();
  byClass(host, 'notice-tab').find((t) => t.textContent === 'Market').onclick();
  await tick();
  assert.equal(reads, 1, 'the press answered from that read');
  assert.match(host.textContent, new RegExp(MARKET_WORDS.noMaterials.replace('.', '\\.')));
  // the opening settle and the read, side by side
  const order = [];
  let settled;
  const r = marketRig({}, { pending: 1, read: async () => { order.push('read'); return { ok: true, data: { rows: [] } }; },
    settle: () => { order.push('settle'); return new Promise((res) => { settled = res; }); } });
  const opened = r.tab.open();
  await tick();
  assert.deepEqual(order, ['settle', 'read'], 'the read set out while the settle was still out');
  settled({ ok: true, settled: 0 });
  await opened;
});

test('BOARD-UI the Seat tab: its parts each on a panel under its name, in order - the Charter, This week (the phase on its strip), the battle, the standings (a challenger\'s bar toward what it needs), your guild, How the seat war works (five steps, the law\'s own numbers), the Chronicle; the works read beside the standings (mutants: a panel unnamed; the strip\'s phase; the bar\'s target; the guide\'s numbers; the works read after)', async () => {
  const ANT = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
  const EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: null };
  const data = { seat: ANT, week: 6, phase: 'reckoning', reckoningAt: T - 3600, turningAt: T + 86400, defence: 8000,
    holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: null }, battle: { kind: 'siege', guild: EO, against: SH },
    standings: [{ guild: EO, influence: 9000 }, { guild: SH, influence: 4100 }, { guild: { id: 'g3', name: 'Hound', tag: 'HND', heraldry: null }, influence: 1500 }],
    mine: { guild: 'g3', rank: 2, seasoned: true, bound: 'g3', pledges: [{ region: 21, key: 3021 }], influence: 300 }, chronicle: [{ kind: 'held', week: 5, data: { guild: SH } }] };
  const asked = [];
  let answer;
  const seatBook = { open: true, data: { seats: [] },
    standings: () => { asked.push('standings'); return new Promise((r) => { answer = r; }); },
    forts: async () => { asked.push('forts'); return { data: { works: {}, stockpile: [] }, error: null }; } };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: bookOf(EMPTY), nowS: () => T, seat: { seat: ANT, book: seatBook } });
  await tick();
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  assert.deepEqual(asked, ['standings', 'forts'], 'the works asked while the standings are still out');
  answer({ data, error: null });
  await tick();
  const named = byClass(host, 'notice-panel').map((p) => (['H3', 'SUMMARY'].includes(p.children[0]?.tagName) ? p.children[0].textContent : null)).filter(Boolean);
  assert.deepEqual(named, [SEAT_PANELS.week, SEAT_PANELS.battle, SEAT_PANELS.standings, SEAT_PANELS.mine, SEAT_PANELS.guide, SEAT_PANELS.chronicle]);
  assert.match(byClass(host, 'seat-head')[0].textContent, /^The Charter of Anticlere: held by the Silver Hand <SH>Held by the Silver Hand <SH> since week 3\./);
  assert.deepEqual(byClass(host, 'seat-phases')[0].children.map((li) => [li.textContent, li.className === 'on']), [['Muster', false], ['Reckoning', true], ['Turning', false]]);
  // the bars: past the holder's defence of 8,000 (the claim's 6,000 is less) - never on the holder's own row
  const rows = byClass(host, 'notice-standing');
  const bar = (row) => byClass(row, 'seat-bar')[0] ?? null;
  assert.equal(bar(rows[1]), null, 'the holder\'s influence is its defence');
  assert.equal(bar(rows[0]).className, 'seat-bar past');
  assert.equal(bar(rows[0]).children[0].style.width, '100.0%');
  assert.equal(bar(rows[2]).children[0].style.width, `${((1500 / 8001) * 100).toFixed(1)}%`);
  assert.equal(bar(rows[2]).getAttribute('title'), '1,500 of 8,001 to win a Right of Siege');
  // the guide: five steps, folded, its numbers the law's
  const guide = byClass(host, 'seat-guide')[0];
  assert.equal(guide.tagName, 'DETAILS');
  assert.equal(guide.querySelectorAll('li').length, 5);
  const steps = seatGuide(ANT);
  assert.deepEqual(steps.map(([n]) => n), ['Pledge', 'Earn', 'Claim', 'Siege', 'Hold']);
  const n = (x) => x.toLocaleString('en-US');
  assert.match(steps[0][1], new RegExp(`in up to ${SEAT_PLEDGE_REGIONS_MAX} regions\\. Pledges lock at the Reckoning, Friday 18:00 UTC\\.`));
  assert.match(steps[1][1], new RegExp(`at most ${n(ACCOUNT_SEAT_WEEK_CAP)} a week at a seat`));
  // AUDIT 657 B9 (PIN MOVED): the law's taker - the strongest past the line whose treasury can pay the fee
  assert.match(steps[2][1], new RegExp(`the strongest guild with at least ${n(CLAIM_THRESHOLD.palace)} influence whose treasury can pay ${n(CLAIM_FEE.palace)} silver\\. Two guilds within 10% of each other meet in a Tourney`));
  assert.match(seatGuide({ tier: 'crown' })[2][1], new RegExp(`${n(CLAIM_THRESHOLD.crown)} influence whose treasury can pay ${n(CLAIM_FEE.crown)} silver`));
  assert.match(steps[3][1], new RegExp(`at least ${n(CLAIM_THRESHOLD.palace)}: the strongest challenger wins a Right of Siege`));
});

test('BOARD-UI the board\'s chunk warmed: the Notice Board\'s window - its tabs with it - is one of the chunks the one home fetches in idle time once the world boots (ui/enhancedChunk.js WARM_CHUNKS), so the first press finds it in the module map; no door fetches a chunk on its own (MENU1) (mutant: left out of the warm)', async () => {
  const warm = WARM_CHUNKS.filter((f) => String(f).includes('noticeWindow.js'));
  assert.equal(warm.length, 1, 'warmed, once');
  assert.equal((await warm[0]()).mountNoticeBoard, mountNoticeBoard, 'the very module the door mounts');
  assert.match(src('src/ui/noticeDoor.js'), /load: \(\) => import\('\.\/noticeWindow\.js'\)/, 'the door still loads it through the one home');
});

test('BOARD-UI the words: every fixed word of the board\'s tabs short, and none says "counting-house" - the service by its in-world name in every refusal was the board\'s commonest line (mutants: a line run long)', () => {
  const words = [
    ...Object.values(BOARD_WORDS).map((w) => (typeof w === 'function' ? w('Daggerfall') : w)),
    ...Object.values(MARKET_WORDS), ...Object.values(SEAT_TAB_WORDS), ...Object.values(VENDOR_TEXT),
    ...Object.values(GUILD_BOARD_EMPTY).map((w) => (typeof w === 'function' ? w('The Silver Hand') : w)),
  ];
  for (const w of words) {
    assert.ok(w.length <= 120, `${w.length}: ${w}`);
    assert.doesNotMatch(w, /counting-house/, w);
  }
});

test('BOARD-UI the sheet: the cards stand straight and as tall as their own words; the tab strip scrolls sideways and never shrinks; words on the cork stand on a dark panel; a form\'s field takes no height from its select (mutants: the tilt back; the strip free to shrink; the stretch)', () => {
  assert.doesNotMatch(NOTICE_CSS, /rotate\(/, 'a tilted pixel face blurs');
  assert.match(NOTICE_CSS, /\.notice-grid \{[^}]*align-items: start;/);
  assert.match(NOTICE_CSS, /\n\.notice-tabs \{ flex: none;[^}]*overflow-x: auto;/);
  assert.match(NOTICE_CSS, /\n\.notice-head \{ flex: none;/);
  assert.match(NOTICE_CSS, /\n\.notice-panel \{[^}]*background: rgba\(12,10,8,0\.8\);/);
  assert.match(PROF_CSS, /\n\.market-field > \* \{ flex: 0 0 auto; \}/);
});
