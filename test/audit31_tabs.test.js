// AUDIT 31 (2026-09-29, Mac: "let's first do a comprehensive audit and ensure everything so far is perfect") - THE
// WORK AND MARKET TABS, AUDITED: the field being typed in and the list's scroll kept through every redraw (U1 - the
// window emptied itself before the tabs looked, and the fake DOM never let the focus go); every field named on the
// page and every button that cannot be pressed saying why (U2, U10); Yours' Decline and where a commission naming you
// is filled (U4); nothing offered while commissions are shut (U5); a Fill's pieces named with their quality (U7); the
// note's commission handing the focus to its pay (U9); Decline pressed twice (U11); drafts that outlive the window,
// and Escape closing a form first (U12); the words (U13); one grid, and a form's opener saying it is open (U14); a
// filled commission's piece pointed to the Market tab (H6); a next bid past any balance said (L6); an empty auction
// view saying its filter (U14). bible/06-Systems/Online-Arc.md "AUDIT 31".
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byClass, keydown } from './chargenDom.mjs';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { createWorkTab, paidText, WORK_ARM_MS } from '../src/ui/workTab.js';
import { createMarketTab } from '../src/ui/marketTab.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { AUCTION_BID_MAX } from '../src/net/marketLaw.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
const DF = 17, WR = 23;
const OAK = 'log:oak';
const T = 1_800_000_000;
const DAY = 86_400;
const PV = 'c0ffee00c0ffee01';

const noticesStub = (notes = []) => ({
  seenAt: () => null, read: async () => ({ board: { notes, notices: [], me: { canPin: true } } }), markSeen() {}, cached: () => null,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }),
});
const boardData = (extra = {}) => ({
  writs: [{ id: 'C1', material: OAK, qty: 10, pay: 12, renown: 5, expiresAt: T + DAY, state: 'open' }], today: { filled: 0, max: 3 },
  guildWrits: [
    { id: 'W1', kind: 'guild', guild: { id: 'g2', name: 'The Hound', tag: 'HND' }, region: DF, material: OAK, units: 800, left: 280, pay: 3, escrow: 840, at: 0, expiresAt: T + 5 * DAY, state: 'open', mine: false, may: false, room: 30 },
    { id: 'W2', kind: 'guild', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH' }, region: DF, material: OAK, units: 10, left: 10, pay: 1, escrow: 10, at: 0, expiresAt: T + 2 * DAY, state: 'open', mine: true, may: true, room: 500 },
  ],
  commissions: [
    { id: 'K1', kind: 'commission', region: DF, recipe: 'longsword:mithril', quality: 2, pay: 900, poster: 'Silas', crafter: 'Me', at: 0, expiresAt: T + 5 * DAY, state: 'open', mine: false, forMe: true, returned: false },
  ],
  yours: {
    commissions: [
      { id: 'K1', kind: 'commission', region: DF, recipe: 'longsword:mithril', quality: 2, pay: 900, poster: 'Silas', crafter: 'Me', at: 0, expiresAt: T + 5 * DAY, state: 'open', mine: false, forMe: true, returned: false },
      { id: 'K4', kind: 'commission', region: WR, recipe: 'kit:iron', quality: null, pay: 40, poster: 'Ann', crafter: 'Me', at: 0, expiresAt: T + 3 * DAY, state: 'open', mine: false, forMe: true, returned: false },
      { id: 'K5', kind: 'commission', region: DF, recipe: 'table-small:oak', quality: 1, pay: 60, poster: 'Me', crafter: 'Joiner', at: 0, expiresAt: T + DAY, state: 'filled', mine: true, forMe: false, returned: false },
    ],
    guildWrits: [],
  },
  guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', rank: 1, mayPost: true, marks: 5_000, budget: 0, spent: 0, left: 0 },
  balance: 500, writsOpen: true, me: 'Merra',
  ...extra,
});
function workRig({ data, pieces = [], notes = [], writsState = { workDrafts: null } } = {}) {
  const calls = [];
  let exits = 0;
  const profBook = {
    state: { open: true, writs: { today: 0, max: 3 } }, held: (k) => (k === OAK ? 50 : 0),
    writs: async () => ({ data, error: null, stale: false }), forgetWrits() {},
  };
  const writs = {
    busy: false, state: writsState,
    supply: async (req) => { calls.push(['supply', req]); return { ok: true, data: { fill: { pay: 114, tax: 6 } } }; },
    decline: async (id) => { calls.push(['decline', id]); return { ok: true, data: {} }; },
    commission: async (req) => { calls.push(['commission', req]); return { ok: true, data: {} }; },
    fulfil: async (req) => { calls.push(['fulfil', req]); return { ok: true, data: {} }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const host = document.createElement('div');
  document.body.append(host);
  const v = mountNoticeBoard(host, {
    town: { name: 'Daggerfall', mapId: 5 }, book: noticesStub(notes), answer: () => ({ ok: true }),
    work: {
      book: profBook, region: DF, regionName: 'Daggerfall', countName: (k, n) => materialCountLabel(k, n), writs,
      regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], pieces: () => pieces, settle: () => writs.settle(),
    },
    nowS: () => T, onExit: () => { exits++; },
  });
  return { host, v, calls, writs, exits: () => exits };
}
const openWork = async (host) => { await ticks(); byClass(host, 'notice-tab')[1].click(); await ticks(); };
const field = (root, key) => root.querySelectorAll('input, select').find((i) => i.getAttribute('data-focus') === key);
const btn = (root, text) => byClass(root, 'act').find((b) => b.textContent.startsWith(text));

test('AUDIT 31 U1: the field being typed in keeps the focus and its caret, and the list keeps its scroll, through every redraw of the window - the Work tab\'s and the Market tab\'s', async () => {
  const { host, v } = workRig({ data: boardData() });
  await openWork(host);
  const n = field(host, 'supply|W1');
  n.focus();
  n.value = '7'; n.oninput();
  const body = byClass(host, 'notice-cork')[0];
  body.scrollTop = 240;
  v.repaint();   // a read's answer, an act's word - the window draws itself again
  const now = field(host, 'supply|W1');
  assert.notEqual(now, n, 'a new field');
  assert.equal(document.activeElement, now, 'the focus handed to it');
  assert.equal(now.value, '7', 'the typed number kept');
  assert.equal(byClass(host, 'notice-cork')[0].scrollTop, 240, 'the list where it was');
  // nothing had the focus: nothing is given it
  document.body.focus?.();
  document.activeElement = document.body;
  v.repaint();
  assert.equal(document.activeElement, document.body);
  v.unmount();
  // the Market tab: the search field
  const book = {
    state: { open: true, balance: 100, road: [], counts: { listings: 0, orders: 0, bids: 0 }, held: 0 },
    read: async () => ({ ok: true, data: { rows: [], medians: {} } }), cached: () => null, forget() {}, busy: false, _kept: () => ({ lists: [], buys: [], cancels: [], collects: [] }),
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const mhost = document.createElement('div');
  document.body.append(mhost);
  const mv = mountNoticeBoard(mhost, {
    town: { name: 'Daggerfall', mapId: 5 }, book: noticesStub(), answer: () => ({ ok: true }), nowS: () => T,
    market: { book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {}, name: (k) => k, countName: (k) => k,
      pieces: () => [], take: () => true, putBack() {}, mint() {}, pieceName: () => 'a piece', drop() {}, weavers: [], stock: async () => ({ ok: true }) },
  });
  await ticks();
  byClass(mhost, 'notice-tab').find((t) => t.textContent === 'Market').click();
  await ticks();
  const s = field(mhost, 'search');
  assert.ok(s, 'the Materials view\'s search');
  s.focus();
  mv.repaint();
  assert.equal(document.activeElement?.getAttribute?.('data-focus'), 'search');
  assert.notEqual(document.activeElement, s);
  mv.unmount();
});

test('AUDIT 31 U14, U5: the guild writs and commissions stand in the Court\'s own grid; while commissions are not this account\'s nothing of them is offered - no card, no form, the note\'s button pressed for nothing', async () => {
  const r = workRig({ data: boardData() });
  await openWork(r.host);
  const grids = byClass(r.host, 'notice-grid');
  assert.equal(grids.length, 1, 'one grid');
  assert.deepEqual(byClass(grids[0], 'notice-writ').map((c) => c.className.match(/seal-\w+/)[0]), ['seal-court', 'seal-guild', 'seal-guild', 'seal-commission']);
  const opener = btn(r.host, 'Commission a piece');
  assert.equal(opener.getAttribute('aria-expanded'), 'false');
  opener.click(); await ticks();
  assert.equal(btn(r.host, 'Commission a piece').getAttribute('aria-expanded'), 'true');
  r.v.unmount();
  const shut = { writs: boardData().writs, today: { filled: 0, max: 3 } };   // the service's answer while the switches are shut
  const notes = [{ id: 'n1', from: 'Silverthorn', subject: 'Swords made', body: 'Mithril, to order.', button: 'commission', at: 1, expiresAt: T + DAY, mine: false }];
  const s = workRig({ data: shut, notes });
  await openWork(s.host);
  assert.equal(byClass(s.host, 'seal-guild').length + byClass(s.host, 'seal-commission').length, 0);
  assert.equal(btn(s.host, 'Commission a piece'), undefined, 'no form offered');
  byClass(s.host, 'notice-tab')[0].click(); await ticks();
  byClass(s.host, 'notice-card').find((c) => /Swords made/.test(c.textContent)).click();
  await ticks();
  const answer = byClass(s.host, 'notice-answer')[0];
  assert.deepEqual([answer.textContent, answer.disabled, answer.getAttribute('title')], ['Commission a piece', true, 'Commissions are not open to you here']);
  s.v.unmount();
});

test('AUDIT 31 U2, U10: every field under its visible name; a Post or a Commission the service would refuse is not offered, and says why - the budget none, one\'s own name, past the Marks, five standing; a Deliver no more than the guild Stores can take, none for one\'s own guild', async () => {
  const r = workRig({ data: boardData() });
  await openWork(r.host);
  // Deliver: the guild Stores can take 30 of W1's 280 - the field's most; one's own guild's (W2): not offered
  assert.equal(field(r.host, 'supply|W1').max, '30');
  assert.equal(btn(r.host, 'Deliver').textContent, 'Deliver 30');
  const own = byClass(r.host, 'seal-guild')[1];
  assert.equal(field(own, 'supply|W2'), undefined);
  assert.match(own.textContent, /Officers and the Guildmaster do not deliver to their own guild's writs\./);   // BOARD-UI (PIN MOVED)
  // the writ form: an Officer with no budget
  btn(r.host, 'Post a guild writ').click(); await ticks();
  const form = byClass(r.host, 'work-form')[0];
  assert.deepEqual(byClass(form, 'work-label-text').map((l) => l.textContent), ['Material', 'Units', 'Silver each']);
  const post = btn(form, 'Post');
  assert.deepEqual([post.disabled, post.getAttribute('title')], [true, 'The Guildmaster has set no writ budget for Officers this week.']);
  assert.match(form.textContent, /The Guildmaster has set no writ budget for Officers this week\./);
  // the commission form
  btn(r.host, 'Commission a piece').click(); await ticks();
  const cform = byClass(r.host, 'work-form')[0];
  assert.deepEqual(byClass(cform, 'work-label-text').map((l) => l.textContent), ['Crafter', 'Kind', 'Piece', 'Least quality', 'Pay (silver)']);
  const who = field(cform, 'comm|crafter');
  const go = () => btn(byClass(r.host, 'work-form')[0], 'Commission');
  assert.equal(go().getAttribute('title'), 'Name the crafter.');
  who.value = '1x'; who.oninput();
  assert.equal(go().getAttribute('title'), 'That is not a name a crafter could have.');
  who.value = 'merra'; who.oninput();
  assert.equal(go().getAttribute('title'), 'You cannot commission yourself.');
  who.value = 'Silverthorn'; who.oninput();
  const pay = field(cform, 'comm|pay');
  pay.value = '501'; pay.oninput();
  assert.equal(go().getAttribute('title'), 'You hold only 500 silver.');
  pay.value = '500'; pay.oninput();
  assert.equal(go().disabled, false);
  r.v.unmount();
  const five = boardData();
  five.yours.commissions = Array.from({ length: 5 }, (_, i) => ({ ...five.yours.commissions[2], id: `M${i}`, state: 'open' }));
  const f = workRig({ data: five, writsState: { workDrafts: { form: 'commission', writ: { material: OAK, units: 1, pay: 1 }, comm: { crafter: 'Silverthorn', family: 'weapons', recipe: 'longsword:mithril', quality: 2, pay: 10 }, supply: {}, pick: {}, arm: null, focus: null } } });
  await openWork(f.host);
  assert.equal(btn(byClass(f.host, 'work-form')[0], 'Commission').getAttribute('title'), 'You have 5 commissions posted already.');
  f.v.unmount();
});

test('AUDIT 31 U4, U11, H6, U13: Yours declines a commission naming you and says where it is filled; Decline arms on its first press; a filled commission of yours is collected at the Market tab; the words', async () => {
  const sword = { item: { provenance: PV, quality: 3 }, where: 'pack', name: 'Mithril Longsword', quality: 3, take: () => true, putBack() {} };
  const r = workRig({ data: boardData(), pieces: [sword] });
  await openWork(r.host);
  const yours = byClass(r.host, 'work-yours')[0];
  assert.match(yours.textContent, /Silas commissioned you: a Mithril Longsword, Fine or better, 900 silverhere · 5 days leftFill it on its card above\./);
  assert.match(yours.textContent, /Ann commissioned you: an Iron Repair Kit, 40 silverWayrest · 3 days leftFilled at the boards of Wayrest\./);
  assert.match(yours.textContent, /You commissioned Joiner: a Small Oak Table, Standard or better, 60 silverhere · filled - collect it at the Market tab/);
  const declines = byClass(yours, 'work-decline');
  assert.equal(declines.length, 2);
  declines[1].click(); await ticks();
  assert.equal(r.calls.length, 0, 'armed, not sent');
  const armed = byClass(byClass(r.host, 'work-yours')[0], 'work-decline')[1];
  assert.equal(armed.textContent, 'Decline - press again');
  armed.click(); await ticks();
  assert.deepEqual(r.calls.at(-1), ['decline', 'K4']);
  // the Fill's picker names its piece's quality; its aria a possessive
  const card = byClass(r.host, 'seal-commission')[0];
  const pick = field(card, 'select|The piece to fill Silas\' commission with');
  assert.ok(pick, 'Silas\' - never "fill Silas commission"');
  assert.equal(pick.children[0].textContent, 'Mithril Longsword (Superior)');
  assert.equal(paidText(114, 6), '114 silver struck to your account (6 silver tax taken)');
  assert.equal(paidText(19, 0), '19 silver struck to your account');
  assert.ok(WORK_ARM_MS > 0);
  r.v.unmount();
  // AUDIT 31 H8: the piece that answers it is equipped - said so
  const held = Object.assign([], { blocked: 1 });
  const h = workRig({ data: boardData(), pieces: held });
  await openWork(h.host);
  assert.match(byClass(h.host, 'seal-commission')[0].textContent, /Your piece for it is equipped, locked or bound - free it first\./);   // BOARD-UI (PIN MOVED)
  h.v.unmount();
});

test('AUDIT 31 U9, U12: the note\'s commission hands the focus to its pay; a draft outlives the window; Escape closes an open form before the window', async () => {
  const state = { workDrafts: null };
  const w = { writs: { state }, held: () => 0, region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', countName: (k) => k, pieces: () => [], reload() {} };
  const ui = { busy: () => false, run: async (f) => { await f(); }, rerender() {}, nowS: () => T };
  const a = createWorkTab(w, ui);
  a.openCommission('Silverthorn');
  const box = document.createElement('div');
  document.body.append(box);
  box.append(a.node(boardData()));
  await ticks();
  assert.equal(document.activeElement?.getAttribute?.('data-focus'), 'comm|pay', 'the pay, the next to fill');
  // the draft kept: a new tab over the same book
  const b = createWorkTab(w, ui);
  assert.deepEqual([b._state.form, b._state.comm.crafter], ['commission', 'Silverthorn']);
  // Escape: the form first, then the window
  const r = workRig({ data: boardData(), writsState: state });
  await openWork(r.host);
  assert.equal(byClass(r.host, 'work-form').length, 1, 'the kept draft\'s form open');
  keydown('Escape');
  assert.deepEqual([byClass(r.host, 'work-form').length, r.exits()], [0, 0], 'the form closed, the window up');
  assert.equal(state.workDrafts.comm.crafter, 'Silverthorn', 'its draft kept');
  keydown('Escape');
  assert.equal(r.exits(), 1, 'then the window');
  r.v.unmount();
});

test('AUDIT 31 L6, U14: a next bid past any balance is said, never a Bid greyed for no reason; an empty auction view says its filter', async () => {
  const a = { id: 'A1', kind: 'auction', region: DF, opening: 5, high: AUCTION_BID_MAX, bids: 9, next: AUCTION_BID_MAX + 1, fee: 1, wear: 1000, at: 0, endsAt: T + DAY, state: 'open', mine: false, leading: false,
    piece: { provenance: PV, recipe: 'longsword:mithril', quality: 4, seed: 1, maker: 'Smith' } };
  let data = { rows: [a] };
  const book = {
    state: { open: true, balance: 100, road: [], counts: { listings: 0, orders: 0, bids: 0 }, held: 0 },
    read: async (view) => ({ ok: true, data: view === 'auctions' ? data : { rows: [], medians: {} } }), cached: () => null, forget() {}, busy: false,
    _kept: () => ({ lists: [], buys: [], cancels: [], collects: [] }), settle: async () => ({ ok: true, settled: 0 }),
  };
  const root = document.createElement('div');
  const m = { book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {}, name: (k) => k, countName: (k) => k,
    pieces: () => [], take: () => true, putBack() {}, mint() {}, pieceName: () => 'Smith\'s Mithril Longsword', drop() {}, weavers: [], stock: async () => ({ ok: true }) };
  let tab;
  const redraw = () => { root.replaceChildren(tab.body()); };
  tab = createMarketTab(m, { busy: () => false, run: async (f) => { await f(); redraw(); }, rerender: redraw, nowS: () => T, alive: () => true });
  await tab.open();
  tab.state.view = 'auctions';
  await tab.load(true);
  redraw();
  byClass(root, 'market-row')[0].click();
  redraw();
  assert.match(root.textContent, /The next bid \(10,000,001 silver\) is more than an account can hold\./);   // BOARD-UI (PIN MOVED)
  assert.equal(byClass(root, 'market-bid').length, 0);
  data = { rows: [] };
  tab.state.family = 'weapons';
  await tab.load(true);
  redraw();
  assert.match(root.textContent, /No Masterwork of that kind is up for auction\./);
});
