// AUDIT 657 (2026-10-07, Mac: "Lets do an audit on everything so far"): THE BOARD'S FINDINGS, PINNED - lens B of PR
// #657's audit (BOARD-UI: the tabs' sheet, the market's early read, the stall's form, the words) and lens D's D4 (the
// Seat guide's fold). Each fix carries an `AUDIT 657 <ID>` comment where it stands. The record:
// bible/01-Overview/Audit-657.md.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { MARKET_WORDS } from '../src/ui/marketTab.js';
import { seatGuide } from '../src/ui/seatTab.js';
import { createVendorTab } from '../src/ui/vendorTab.js';
import { createMarketBook } from '../src/net/marketBook.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { siegeFieldOf } from '../src/systems/siegeField.js';
import { noticeBoardIndex } from '../src/systems/bountyBoard.js';
import { SEAT_MEMBER_WAIT_S, CLAIM_THRESHOLD, CLAIM_FEE } from '../src/net/townSeatLaw.js';
import { NOTICE_CSS, PROF_CSS } from '../src/ui/enhancedPlusStyle.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const EMPTY = { notes: [], notices: [], me: {} };
/** board_ui.test.js's board book: one board, read at once. */
const bookOf = (board) => ({
  seenAt: () => T - 1000, read: async () => ({ board }), markSeen: () => {}, cached: () => board,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }),
  readGuild: async () => ({ data: null, error: 'no-guild' }),
});
/** A market host over a real market book whose door answers `answer()`. */
function marketOver(answer) {
  let reads = 0;
  const door = { account: () => 'acct-1', read: async (b) => { reads++; return answer(b); } };
  const book = createMarketBook({ door, character: () => 'c', now: () => 1_000_000, sleep: async () => {} });
  const market = { book, stores: () => new Map(), region: 17, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {},
    name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece',
    weavers: [], stock: async () => ({ ok: true }) };
  return { market, reads: () => reads };
}
/** The window's own tabs - the strip's, never the Market's views, which wear the tab's dress. */
const strip = (host) => byClass(byClass(host, 'notice-tabs')[0], 'notice-tab');
const tabNames = (host) => strip(host).map((t) => t.textContent);
const press = (host, name) => strip(host).find((t) => t.textContent === name).onclick();

test('AUDIT 657 B1 the chosen tab\'s line and the focus ring stand inside the tab - BOARD-UI\'s strip scrolls sideways and clips what stands past it, and the line was a border pulled 2px under it; under forced colours the chosen one is outlined, a shadow being painted over there (mutants: the line a border under the strip again; the ring left to the browser; the forced colours\' outline gone)', () => {
  assert.match(NOTICE_CSS, /\.notice-tab\.on \{ color: #f3cf86; box-shadow: inset 0 -2px 0 #c08a3e; \}/);
  assert.doesNotMatch(NOTICE_CSS, /\.notice-tab\.on \{[^}]*margin-bottom: -2px/, 'nothing pulled past the strip it scrolls in');
  assert.match(NOTICE_CSS, /\.notice-tab:focus-visible \{ outline: 2px solid #f3cf86; outline-offset: -2px; \}/);
  assert.match(NOTICE_CSS, /@media \(forced-colors: active\) \{ \.notice-tab\.on \{ outline: 2px solid Highlight; outline-offset: -2px; \} \}/);
  assert.match(NOTICE_CSS, /\.notice-tabs \{ flex: none;[^}]*overflow-x: auto; overflow-y: hidden;/, 'the strip it stands in still scrolls - the reason');
});

test('AUDIT 657 B2 a suppliers\' counter row at a phone\'s width: its name across the row, the price, the count and the press under it - its four columns left the name none, a letter a line (mutant: the four columns kept)', () => {
  const phone = PROF_CSS.slice(PROF_CSS.indexOf('@media (max-width: 640px) { .market-row, .market-piece'));
  const block = phone.slice(0, phone.indexOf('@media (prefers-reduced-motion'));
  assert.match(block, /\.market-counterrow \{ grid-template-columns: minmax\(0, 1fr\) 4\.5em auto; \} \.market-counterrow > b \{ grid-column: 1 \/ -1; \}/);
  assert.match(PROF_CSS, /\.market-counterrow \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto 4\.5em auto;/, 'the four columns where there is room');
});

test('AUDIT 657 B3 a stall\'s "Put up a piece" form: its fields under their names in one row of fields, the press beside them, as the List form\'s - in the List form\'s dress its select and its press stood each the window\'s width (mutant: the controls loose in the form again)', async () => {
  const did = [];
  const tab = createVendorTab({ mode: 'stall', own: true, read: async () => ({ ok: true, data: { rows: [] } }), nameOf: (i) => i, purse: () => 100,
    goods: () => [{ item: 'Leather Cuirass' }], put: async (it, p) => { did.push([it, p]); return { ok: true }; } },
  { busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true });
  await tab.open();
  const form = byClass(tab.body(), 'market-listform')[0];
  const fields = form.children.find((c) => c.className === 'market-fields');
  assert.ok(fields, 'a row of fields');
  assert.deepEqual(fields.children.map((c) => [c.tagName, c.tagName === 'BUTTON' ? c.textContent : c.className]), [['LABEL', 'market-field market-field-wide'], ['LABEL', 'market-field'], ['BUTTON', 'Put up for sale']]);
  assert.deepEqual(byClass(fields, 'notice-label').map((l) => l.textContent), ['Piece', 'Price in gold']);
  assert.equal(byClass(fields, 'market-field-wide').length, 1, 'the piece\'s field the wide one');
  fields.children[2].onclick();
  await tick();
  assert.deepEqual(did, [['Leather Cuirass', 100]], 'the press still puts it up');
});

test('AUDIT 657 B4 a read the board\'s early read was refused is asked again when the Market is pressed - the book keeps a failed read its minute too, and the first press said "did not load" of a market back up since (mutant: the press answered from the failed early read)', async () => {
  let up = false;
  const m = marketOver((b) => (up ? { ok: true, data: { view: b.view, rows: [], balance: 10 } } : { ok: false, error: 'offline' }));
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, market: m.market });
  await tick();
  const early = m.reads();
  assert.ok(early >= 1, 'read as the board opened');
  up = true;
  press(host, 'Market');
  await tick();
  assert.ok(m.reads() > early, 'asked again on the press');
  assert.doesNotMatch(host.textContent, new RegExp(MARKET_WORDS.slow.replace('.', '\\.')));
  assert.match(host.textContent, new RegExp(MARKET_WORDS.noMaterials.replace('.', '\\.')));
});

test('AUDIT 657 B5 + B12 a Market the board showed as it opened stays for that opening - its early read heard the market shut, and the tab went with no word; pressed, it says why and nothing more (no "Your silver: -" over it); the next opening knows, and shows no Market (mutants: the tab hidden on the early read\'s word; the silver\'s strip over a shut market)', async () => {
  const m = marketOver(() => ({ ok: false, error: 'market-closed' }));
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, market: m.market });
  await tick();
  assert.equal(m.market.book.state.open, false, 'the early read heard it shut');
  v.repaint();   // a redraw after its word - the board's own read answering later, as on a slow line
  assert.deepEqual(tabNames(host), ['Notices', 'Market'], 'the tab it opened with');
  press(host, 'Market');
  await tick();
  assert.match(host.textContent, new RegExp(accountRefusalText('market-closed').replace('.', '\\.')));
  assert.equal(byClass(host, 'market-wallet').length, 0, 'the shut word alone');
  v.unmount();
  const again = document.createElement('div');
  mountNoticeBoard(again, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, market: m.market });
  await tick();
  assert.deepEqual(tabNames(again), ['Notices'], 'known shut: no tab to say so');
});

test('AUDIT 657 B5 MARKET-AUDIT U4\'s arm where B5 does not reach: a market known shut as the board opened shows no tab; heard open since, its tab is pressed, and it shuts while read - the tab stays, its shut word said, never the reader thrown back to the Notices (mutant: U4\'s tab read dropped)', async () => {
  let open = true;
  const m = marketOver((b) => (open ? { ok: true, data: { view: b.view, rows: [], balance: 10 } } : { ok: false, error: 'market-closed' }));
  m.market.book.state.open = false;
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 1 }, book: bookOf(EMPTY), nowS: () => T, market: m.market });
  await tick();
  assert.deepEqual(tabNames(host), ['Notices'], 'known shut: no tab');
  assert.equal(m.reads(), 0, 'and no early read of it');
  m.market.book.state.open = true;   // heard open since (the book is the session's)
  v.repaint();
  assert.deepEqual(tabNames(host), ['Notices', 'Market']);
  open = false;
  press(host, 'Market');
  await tick();
  assert.equal(m.market.book.state.open, false);
  assert.deepEqual(tabNames(host), ['Notices', 'Market'], 'the tab stays while it is read');
  assert.match(host.textContent, new RegExp(accountRefusalText('market-closed').replace('.', '\\.')));
  v.unmount();
});

test('AUDIT 657 B6 a guild\'s raid contract says what earns it - a raider struck in the town and the town stood in until it is cleansed (raidLaw.js\'s receipt); "Fight off a raid" dropped the second (mutant: the condition cut again)', () => {
  const w = src('src/ui/workTab.js');
  assert.match(w, /`Strike a raider in a town here and stay until it is cleansed: paid when the raid is counted, less \$\{marksText\(saleTax\(x\.pay\)\)\} tax\.`/);
  assert.match(src('src/net/raidLaw.js'), /struck a raider \(said\) and stood in the town at the cleanse/, 'the law the words say');
});

test('AUDIT 657 B7 the siege field\'s Market banner stands at the town\'s Notice Board by ONE-BOARD\'s own choice - on an exact tie too, where the field walked the boards in their order and the Notice Board by their position (mutant: the field\'s own walk back)', () => {
  const frames = new Map([['palace', { door: { a: [-1, 0, 0], b: [1, 0, 0] }, box: [-10, 0, -20, 10, 10, 0] }]]);
  const at = (x) => ({ box: [x, 0, 0, x + 1, 2, 1] });
  const boards = [at(20), at(0), at(10)];   // the boards at 10 and 20 equally near the middle
  const centre = [15.5, 0.5];
  assert.equal(noticeBoardIndex(boards, new Set(), centre), 2, 'the Notice Board: the first by position');
  const field = siegeFieldOf({ frames, palaceKeys: ['palace'], boards, bounty: new Set(), centre });
  assert.deepEqual(field.banners[1], [10.5, 0.5], 'the Market at the Notice Board');
  const none = siegeFieldOf({ frames, palaceKeys: ['palace'], boards: [at(0)], bounty: new Set([0]), centre });
  assert.deepEqual(none.banners[1], centre, 'every board the bounties\': the middle');
});

test('AUDIT 657 B9 + D6 the words true to the law: a gold listing pays a 1% fee on its sale and none to list; a late bid adds minutes; the guide\'s Claim names the law\'s taker - the strongest past the line whose treasury can pay - and its Earn the law\'s wait, Tribute the Guildmaster\'s from the treasury (mutants: "No fee." again; the unit dropped; the top guild at the line; Tribute a member\'s earning)', () => {
  const m = src('src/ui/marketTab.js');
  assert.equal((m.match(/`No fee to list\. Up for 72 hours on every board\. If it (all )?sells you get \$\{goldGets\} \(after a 1% fee and \$\{saleTax\(100\)\}% tax\)/g) ?? []).length, 2, 'both gold forms');
  assert.doesNotMatch(m, /`No fee\. /);
  assert.match(m, /a bid in the last \$\{AUCTION_LATE_S \/ 60\} minutes adds \$\{AUCTION_ADD_S \/ 60\} minutes\. You get/);
  const n = (x) => x.toLocaleString('en-US');
  const [, earn, claim] = seatGuide({ tier: 'palace' });
  assert.match(earn[1], new RegExp(`^Members ${SEAT_MEMBER_WAIT_S / 86400} days in the guild earn influence`));
  assert.match(earn[1], /a home in the town, Renown and seat writs\. The Guildmaster adds Tribute from the treasury\./);
  assert.match(claim[1], new RegExp(`goes to the strongest guild with at least ${n(CLAIM_THRESHOLD.palace)} influence whose treasury can pay ${n(CLAIM_FEE.palace)} silver\\.`));
});

test('AUDIT 657 D4 the Seat guide kept open across the window\'s redraws, as the suppliers\' fold is - unpinned, a guide that shut on every redraw survived every pin (mutant: the guide\'s open state forgotten)', async () => {
  const ANT = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  const data = { seat: ANT, week: 6, phase: 'muster', reckoningAt: T + 3600, turningAt: T + 86400, defence: 0, holder: null, battle: null,
    standings: [], mine: null, chronicle: [] };
  const seatBook = { open: true, data: { seats: [] }, standings: async () => ({ data, error: null }), forts: async () => ({ data: { works: {}, stockpile: [] }, error: null }) };
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: bookOf(EMPTY), nowS: () => T, seat: { seat: ANT, book: seatBook } });
  await tick();
  press(host, 'Seat');
  await tick();
  const guide = byClass(host, 'seat-guide')[0];
  assert.equal(guide.open, false, 'folded until opened');
  guide.open = true;
  guide.dispatch('toggle', {});
  v.repaint();
  assert.equal(byClass(host, 'seat-guide')[0].open, true, 'kept open across the redraw');
  v.unmount();
});
