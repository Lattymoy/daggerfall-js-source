// AUDIT PRE-MERGE 1003 (2026-10-03) - LENS U: THE ARENA'S WINDOW AND ITS HUD, read on real Chromium before #545 merges
// (src/ui/arenaWindow.js, arenaDoor.js, arenaHud.js, hudFoeTarget.js; src/systems/arenaBoard.js, arenaText.js; the sheets
// in src/ui/enhancedPlusStyle.js, enhancedStyle.js, partyPanel.js; the hosts' arena HUD in src/scenes/world.js and
// exterior.js). Each pin FAILED on the unfixed tree for its finding's reason; each fix carries an `AUDIT PRE-MERGE 1003
// <ID>` comment. What a fake page cannot measure (where a rule puts a box) was measured in Chromium and its rule is pinned
// here, the numbers in the audit's record: U1 the window draws itself online and keeps the hall while it stands; U2 a
// redraw keeps the keyboard's place; U3 the bar wears the HUD's scale and steps under the target frame; U4 the quest card
// and the party list step aside for it; U5 a phone's leaderboards keep the names; U6 a short screen keeps the bar off the
// crosshair; U7 a banner said, not only shown; U8 the HUD's toggle takes the bar; U9 forced colours keep the chosen; U10
// the offer's clock; U11 the banners' board's own headers; U12 the purses chip said; U13 every tab on a phone; U14 a
// screen reader's names; U15 the stands' presses keep the focus.
import './chargenDom.mjs';   // a page with a focus (AUDIT 31 U1's: a node taken out takes the focus with it)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeDom, withDom } from './invdrag.mjs';
import * as AB from '../src/systems/arenaBoard.js';
import * as LG from '../src/systems/arenaLeague.js';
import { newArenaLadder, ladderAfter, nextLadderBout } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { arenaLadderOf } from '../src/net/arenaLaw.js';
import { mountArenaWindow } from '../src/ui/arenaWindow.js';
import * as Door from '../src/ui/arenaDoor.js';
import { createArenaOnline, HALL_IDLE_MS } from '../src/scenes/arenaOnline.js';
import { arenaHudModel, drawArenaHud, destroyArenaHud, ARENA_HUD_CSS, ARENA_HUD_WIDTH } from '../src/ui/arenaHud.js';
import { newBout, boutTick, boutAtMarks, boutHealth, callMs, COUNT_MS } from '../src/systems/arenaBout.js';
import { newCrowd } from '../src/systems/arenaCrowd.js';
import { markFoeStruck, foeTarget, tickFoeTarget } from '../src/ui/hudFoeTarget.js';
import { ARENA_WINDOW_CSS, TRAVEL_CSS } from '../src/ui/enhancedPlusStyle.js';
import { PARTY_CSS } from '../src/ui/partyPanel.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = ARENA_TEXT.window, O = ARENA_TEXT.online, T = ARENA_TEXT.teams;
const START = 523530;
const noon = (d = 1) => START - (START % MINUTES_PER_DAY) + d * MINUTES_PER_DAY + 12 * 60;

// ── THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────────────────
// chargenDom's page, dressed for these windows: a node's dataset, a class list that toggles and removes, an attribute
// taken off - and Chromium's focus fixup: a focused control made `disabled` lets the focus fall to the page.
const plainMake = document.createElement;
document.createElement = (t) => {
  const n = plainMake(t);
  n.dataset = {};
  const cls = () => n.className.split(/\s+/).filter(Boolean);
  const list = {
    add: (...c) => { n.className = [...new Set([...cls(), ...c])].join(' '); },
    remove: (...c) => { n.className = cls().filter((x) => !c.includes(x)).join(' '); },
    toggle: (c, on = !cls().includes(c)) => { if (on) list.add(c); else list.remove(c); return on; },
    contains: (c) => cls().includes(c),
  };
  Object.defineProperty(n, 'classList', { get: () => list });
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  const set = n.setAttribute.bind(n);
  n.setAttribute = (k, v) => { set(k, v); if (k === 'disabled' && document.activeElement === n) document.activeElement = document.body; };
  return n;
};
/** Every element under `n` (chargenDom's and invdrag's both keep `children`). */
const all = (n) => (n?.children ?? []).flatMap((c) => (c?.tagName ? [c, ...all(c)] : []));
const has = (n, c) => String(n?.className ?? '').split(/\s+/).includes(c);
const kids = (n, c) => all(n).filter((x) => has(x, c));
const one = (n, c) => kids(n, c)[0] ?? null;
const textOf = (n) => (n?.children?.length ? `${n._text ?? ''}${n.children.map(textOf).join('')}` : String(n?.textContent ?? ''));
const attr = (n, k) => n?.attrs?.[k];
const nameOf = (b) => attr(b, 'aria-label') ?? textOf(b);

/** A save with something on every page: the Red Banner, a ladder some bouts up, the league's own record of them. */
function save() {
  const gm = noon(200);
  let ladder = newArenaLadder();
  let league = LG.joinBanner(LG.newArenaLeague(), 'red', gm - 60 * MINUTES_PER_DAY).league;
  const opps = ['Mirabelle Ashfield', 'Gorlak gro-Mazgulbarz', 'Uthyrick Kingston', 'Senna Varo', 'Tozca of Totambu'];
  for (let i = 0; i < 5; i++) {
    const next = nextLadderBout(ladder);
    ladder = ladderAfter(ladder, { won: true, how: 'fall', purse: next.purse }).ladder;
    league = LG.leagueAfterBout(league, { gameMinutes: gm - (30 - i * 4) * MINUTES_PER_DAY, tier: next.tier, label: next.label, opp: opps[i], won: true, how: 'fall', purse: next.purse, champion: next.champion });
  }
  return { ladder, league, gm };
}
const boardOf = (s, more = {}) => () => AB.arenaBoard({ ladder: s.ladder, league: s.league, gameMinutes: s.gm, name: 'Aldric', atGate: true, gold: 640, healthShare: 1, ...more });
/** The window mounted on chargenDom's page. */
function mounted(board, act = () => ({ ok: false, text: 'Refused.' }), page = 'bouts') {
  const host = document.createElement('div');
  document.body.append(host);
  const v = mountArenaWindow(host, { board, act, page, onExit: () => {} });
  return { host, v, done: () => { v.unmount(); host.remove(); } };
}
const tab = (host, p) => kids(host, 'aw-tab').find((t) => t.dataset.page === p);

// ── U1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** invdrag's page installed for an async test (withDom puts its globals back at the first await). */
async function withPage(fn) {
  const dom = fakeDom();
  const saved = { doc: globalThis.document, add: globalThis.addEventListener, rem: globalThis.removeEventListener };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  try { return await fn(dom); } finally {
    globalThis.document = saved.doc;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.rem;
  }
}
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
/** The realm's board, as the account service answers it (`/v1/arena/board`) - a season with nothing fought yet. */
const onlineRigBoard = () => ({
  season: 4, day: 12, endsAt: 0, champion: null,
  pvp: { rows: [], pinned: null, total: 0 }, pve: { rows: [], pinned: null, total: 0 }, fast: { rows: [], pinned: null, total: 0 },
  team: { standings: { red: 31, blue: 44 }, last: null, laurel: null, members: { red: 3, blue: 4 }, rosters: { red: { rows: [], pinned: null, total: 0 }, blue: { rows: [], pinned: null, total: 0 } } },
  hall: [], me: { ladder: arenaLadderOf([], { wins: 0, losses: 0, best: 0 }), pvp: { rating: 1000, wins: 0, losses: 0, draws: 0, bouts: 0 }, rank: null, banner: 'red', points: 0, record: { pveWins: 0, pveLosses: 0, pvpWins: 0, pvpLosses: 0, pvpDraws: 0, best: 0 }, recent: [] },
});
/** The arena online on a fake relay: the hall a socket that opens when told, the board the account service's at once. */
function onlineRig() {
  const clock = { t: 1000 };
  const links = [], sent = [];
  const makeHall = () => {
    const l = { status: 'connecting', onArena: null, join() {}, leave() { this.status = 'closed'; }, sendArena(w) { if (this.status !== 'open') return false; sent.push(w); return true; } };
    links.push(l);
    return l;
  };
  const board = onlineRigBoard();
  const on = createArenaOnline({
    now: () => clock.t, session: () => ({ status: 'open', arenaOk: true, room: null }), makeHall,
    account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true }), me: () => null },
    bouts: { setRealm() {}, relay: () => null, dismiss() {} }, enterFloor: () => true, say: () => {}, level: () => 5,
  });
  const s = save();
  const overlay = Door.createArenaOverlay({ page: 'bouts', board: () => AB.arenaBoard({ ladder: newArenaLadder(), league: LG.newArenaLeague(), gameMinutes: s.gm, name: 'Aldric', atGate: true, gold: 640, healthShare: 1, online: on.model() }), act: (k, d) => on.act(k, d) ?? { ok: false } });
  return { clock, links, sent, on, overlay };
}
const challengeOf = (dom) => kids(dom.body, 'aw-bout-card').find((c) => c.dataset.kind === 'challenge') ?? null;

test('AUDIT PRE-MERGE 1003 U1: online the standing window DRAWS ITSELF - the hall\'s offer comes in with no press and its Accept is drawn at the door\'s next second, its clock counting down a second a second; a second with nothing new draws nothing (mutants: the door\'s tick a no-op again; the window drawn whether or not its model moved)', () => withPage(async (dom) => {
  const R = onlineRig();
  try {
    await settle();
    assert.equal(R.overlay.page(), 'bouts', 'the window up');
    R.links[0].status = 'open';   // the hall's socket shook hands
    await settle();
    // the offer: the hall's word, and no press
    R.links[0].onArena({ k: 'of', o: 'abcd', vs: { n: 'Gorlak gro-Mazgulbarz', r: 1012 }, until: R.clock.t + 20_000 });
    R.overlay.tick(1.1);
    const card = challengeOf(dom);
    assert.ok(card, 'the challenge drawn - the board and the hall came in after the window opened');
    assert.ok(kids(card, 'aw-act').some((b) => b.dataset.act === 'accept'), 'Accept drawn at the next second, no press');
    assert.ok(kids(card, 'aw-line').some((l) => l.textContent === O.offerClock(20)), 'its clock');
    R.clock.t += 1000;
    R.overlay.tick(1);
    assert.ok(kids(challengeOf(dom), 'aw-line').some((l) => l.textContent === O.offerClock(19)), 'a second later, a second lower');
    // nothing new: nothing drawn (the same nodes)
    const before = one(dom.body, 'aw-body').children[0];
    R.overlay.tick(1);
    assert.equal(one(dom.body, 'aw-body').children[0], before, 'the same model - not drawn again');
    // and never more than once a second: the clock moved, the window asks at its second
    R.clock.t += 1000;
    R.overlay.tick(0.5);
    assert.ok(kids(challengeOf(dom), 'aw-line').some((l) => l.textContent === O.offerClock(19)), 'not before its second');
    R.overlay.tick(0.5);
    assert.ok(kids(challengeOf(dom), 'aw-line').some((l) => l.textContent === O.offerClock(18)), 'at it');
    assert.equal(Door.ARENA_DOOR_REFRESH_S, 1);
  } finally { R.overlay.dispose(); }
}));

test('AUDIT PRE-MERGE 1003 U1: the hall\'s socket is KEPT while the window stands - a window left idle past HALL_IDLE_MS still finds a match (it lost its hall under it, and Find a match said "Online only") (mutant: the door\'s tick a no-op again)', () => withPage(async () => {
  const R = onlineRig();
  try {
    await settle();
    R.links[0].status = 'open';
    await settle();
    for (let s = 0; s * 1000 <= HALL_IDLE_MS + 5000; s++) { R.clock.t += 1000; R.on.tick(); R.overlay.tick(1); }
    assert.equal(R.links.length, 1, 'one hall socket all along');
    assert.equal(R.links[0].status, 'open', 'never let go under the window');
    assert.deepEqual(R.on.act('queue'), { ok: true, text: O.queueState.queued }, 'Find a match answers');
    assert.ok(R.sent.some((w) => w.k === 'q'), 'the queue word went down the hall');
  } finally { R.overlay.dispose(); }
}));

// ── U2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U2: a press inside the window\'s body keeps the keyboard\'s place - after Enter (a click) on Wager, a side, a stake, a refused press, a tier and a sub-board the focus is that control in the redrawn body, not the page (AUDIT 28 B11, AUDIT 31 U1, AUDIT 32 P3) (mutant: the body redrawn without repaintKeepingScroll\'s focus)', () => {
  const s = save();
  const W1 = mounted(boardOf(s));
  try {
    const { host } = W1;
    const enter = (b) => { b.focus(); b.click(); return document.activeElement; };
    const inside = (n) => n !== document.body && host.contains(n);
    let a = enter(kids(host, 'aw-act').find((b) => b.dataset.act === 'wager'));
    assert.ok(inside(a) && a.dataset.act === 'wager', 'Wager');
    assert.ok(one(host, 'aw-wager'), 'its panel open');
    a = enter(kids(host, 'aw-side')[1]);
    assert.ok(inside(a) && has(a, 'aw-side') && attr(a, 'aria-pressed') === 'true', 'a side');
    a = enter(kids(host, 'aw-stake')[2]);
    assert.ok(inside(a) && has(a, 'aw-stake') && attr(a, 'aria-pressed') === 'true', 'a stake');
    a = enter(kids(host, 'aw-act').find((b) => b.dataset.act === 'fight'));
    assert.ok(inside(a) && a.dataset.act === 'fight', 'a refused press');
    assert.equal(one(host, 'aw-note').textContent, 'Refused.');
    tab(host, 'ladder').click();
    a = enter(kids(host, 'aw-tier')[5]);
    assert.ok(inside(a) && has(a, 'aw-tier') && attr(a, 'aria-pressed') === 'true', 'a tier');
    tab(host, 'boards').click();
    a = enter(kids(host, 'aw-subtab').find((b) => b.dataset.board === 'pvp'));
    assert.ok(inside(a) && a.dataset.board === 'pvp' && attr(a, 'aria-pressed') === 'true', 'a sub-board');
  } finally { W1.done(); }
});

// ── U3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const F2 = [{ id: 'you', name: 'Hero', side: 0, maxHealth: 100, ai: false }, { id: 'f0', name: 'Gorlak gro-Mazgulbarz', side: 1, maxHealth: 80 }];
const F3 = [{ id: 'p0', name: 'Aldric', side: 0, maxHealth: 340, ai: false }, { id: 'p1', name: 'Gorlak', side: 1, maxHealth: 360, ai: false }];
function live(fighters) {
  const b = newBout({ id: 'p', fighters, ring: { centre: [0, 0], radius: 14 }, now: 0 });
  boutTick(b, callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, callMs(b));
  boutTick(b, callMs(b) + COUNT_MS);
  return { b, t: callMs(b) + COUNT_MS };
}
/** invdrag's page with a style that keeps custom properties, as a browser's does. */
function styledPage() {
  const dom = fakeDom();
  const mk = dom.doc.createElement;
  dom.doc.createElement = (t) => { const n = mk(t); const props = {}; n.style.setProperty = (k, v) => { props[k] = String(v); }; n.style.getPropertyValue = (k) => props[k] ?? ''; return n; };
  return dom;
}

test('AUDIT PRE-MERGE 1003 U3: the versus bar WEARS THE HUD\'S SCALE - `--hud-scale` copied onto it off `.hud` (a sibling on the page: the variable never reached it, and its top stood at scale 1 under a doubled compass, on the compass at 2), 1 with no enhanced HUD; its top the compass\'s foot at that scale (mutants: the scale never copied; the old 58px times the scale)', () => {
  destroyArenaHud();
  const dom = styledPage();
  const { b, t } = live(F2);
  const m = arenaHudModel(b, newCrowd({ fighters: b.fighters }), t, { you: 'you', stamina: 0.5 });
  drawArenaHud(m, { doc: dom.doc });
  const root = one(dom.body, 'arena-hud');
  assert.equal(root.style.getPropertyValue('--hud-scale'), '1', 'no `.hud` (the classic skin): 1');
  const hud = dom.doc.createElement('div');
  hud.className = 'hud';
  hud.style.setProperty('--hud-scale', '2');
  dom.body.append(hud);
  drawArenaHud(m, { doc: dom.doc });
  assert.equal(root.style.getPropertyValue('--hud-scale'), '2', 'the HUD\'s own');
  hud.style.setProperty('--hud-scale', '1.5');
  drawArenaHud(m, { doc: dom.doc });
  assert.equal(root.style.getPropertyValue('--hud-scale'), '1.5', 'and when it changes');
  destroyArenaHud();
  // the top: the compass's foot (.hud-top 18px, the strip and its rule 28px - scaled) and 12px - 58 at scale 1, as it was
  assert.match(ARENA_HUD_CSS, /\.arena-hud \{ position: fixed; left: 50%; top: calc\(18px \+ 28px \* var\(--hud-scale, 1\) \+ 12px\);/);
});

test('AUDIT PRE-MERGE 1003 U3: the bar STEPS UNDER THE TARGET FRAME while it stands - the travel panel\'s own step, the blade face\'s its own (measured in Chromium: no overlap with the frame at scales 1, 1.5, 2, nor with the compass at 2); and a fighter of the bout is the bar\'s - no target frame raised for it, the undercroft\'s chained beasts and every other foe keep theirs (mutants: the step gone; the bout fighter marked)', () => {
  const step = (sel) => new RegExp(`body:has\\(${sel.replace(/\./g, '\\.')}\\) \\.arena-hud \\{ top: calc\\(([^;]+)\\); \\}`).exec(ARENA_HUD_CSS)?.[1];
  const travel = (sel) => new RegExp(`body:has\\(${sel.replace(/\./g, '\\.')}\\) \\.travelpanel \\{ --tp-top: calc\\(([^;]+)\\); \\}`).exec(TRAVEL_CSS)?.[1];
  for (const sel of ['.hud-foe.on', '.hud-foe.on.blade']) {
    assert.ok(step(sel), `the bar's step under ${sel}`);
    assert.equal(step(sel), travel(sel), `the travel panel's own sum under ${sel}`);
  }
  tickFoeTarget(1e9);
  markFoeStruck({ entity: { name: 'Gorlak', health: 30, maxHealth: 80, bout: { id: 'p', side: 1, out: false, hold: true, hooks: {} } } });
  assert.equal(foeTarget(), null, 'a fighter of the bout: the bar names it - no frame');
  markFoeStruck({ entity: { name: 'Chained', health: 30, maxHealth: 80, bout: { id: 'undercroft:chain:1', chained: true, hooks: {} } } });
  assert.equal(foeTarget()?.name, 'Chained', 'the undercroft\'s chained beast keeps its frame');
  tickFoeTarget(1e9);
  markFoeStruck({ entity: { name: 'Rat', health: 3, maxHealth: 8 } });
  assert.equal(foeTarget()?.name, 'Rat', 'any other foe keeps its frame');
  tickFoeTarget(1e9);
});

// ── U4 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U4: while the bar stands it says so (`.on`), and the quest card (1100 and under) and the party list (561-980, its phone place at the foot clear of it) step aside for it - the house\'s step-aside; measured in Chromium at 800x600, 844x390, 740x360, 390x844: neither under the bar (mutants: `.on` never set; either rule gone)', () => withDom((dom) => {
  destroyArenaHud();
  const { b, t } = live(F2);
  const m = arenaHudModel(b, newCrowd({ fighters: b.fighters }), t, { you: 'you' });
  drawArenaHud(m, { doc: dom.doc });
  const root = one(dom.body, 'arena-hud');
  assert.ok(root.classList.contains('on'), 'on while it stands');
  drawArenaHud(m, { doc: dom.doc, hidden: true });
  assert.ok(!root.classList.contains('on'), 'off with the HUD');
  drawArenaHud(null, { doc: dom.doc });
  assert.ok(!root.classList.contains('on'), 'off with the bout');
  drawArenaHud(m, { doc: dom.doc });
  assert.ok(root.classList.contains('on'));
  destroyArenaHud();
  // the widths the rules are drawn from: the bar's half against the card's 260 (+8) and the list's 200 (+8)
  assert.ok(1100 >= 2 * (ARENA_HUD_WIDTH / 2 + 268) && 980 >= 2 * (ARENA_HUD_WIDTH / 2 + 208));
  assert.match(rd('src/ui/enhancedStyle.js'), /@media \(max-width: 1100px\) \{ body:has\(\.arena-hud\.on\) \.qtrack \{ visibility: hidden; \} \}/);
  assert.match(PARTY_CSS, /@media \(min-width: 561px\) and \(max-width: 980px\) \{ body:has\(\.arena-hud\.on\) \.dfparty \{ visibility: hidden; \} \}/);
}));

// ── U5 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U5: a leaderboard\'s header row carries its columns\' classes - a phone\'s fixed table takes its widths from that first row, and the Fighter\'s 48% stood on its cells alone (names cut to four letters at 360); the rank\'s width by its class, how a bout ended let wrap (measured in Chromium at 360 and 414: every name its width or 100px and more) (mutants: the header\'s classes gone; the rank by :first-child)', () => {
  const s = save();
  const W1 = mounted(boardOf(s), undefined, 'boards');
  try {
    const ths = kids(W1.host, 'aw-table')[0].children[0].children[0].children;
    assert.deepEqual(ths.map((th) => th.textContent), [W.rank, W.name, ...W.cols.pve]);
    assert.deepEqual(ths.map((th) => th.className), ['aw-rank', 'aw-nm', '', '', 'opt'], 'each header its column\'s class');
  } finally { W1.done(); }
  const phone = /@media \(max-width: 720px\) \{([\s\S]*?)\n\}/.exec(ARENA_WINDOW_CSS)[1];
  assert.match(phone, /\.aw-table \.aw-rank \{ width: 34px; \}/);
  assert.match(phone, /\.aw-table \.aw-nm \{ width: 48%; \}/);
  assert.doesNotMatch(ARENA_WINDOW_CSS, /th:first-child/, 'never the first column by its place - the banners\' board has no rank');
  assert.match(phone, /\.aw-bt \{ white-space: normal; \}/);
});

// ── U6 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U6: A SHORT SCREEN keeps the bar off the crosshair - under 520 tall the "vs" and the bark go, the rows tighten, the stamina and the crowd share a line and the yield hint (on the plate now) takes the stamina\'s place beside the crowd (measured in Chromium: a Grand Melee with the hint at 740x360 touch 58 to 157, 44%; the stands at 844x390 to 160) (mutants: the rule gone; the hint off the plate)', () => withDom((dom) => {
  destroyArenaHud();
  const { b, t } = live(F2);
  boutHealth(b, 'you', 10);
  drawArenaHud(arenaHudModel(b, newCrowd({ fighters: b.fighters }), t, { you: 'you', stamina: 0.5, bark: 'Again!' }), { doc: dom.doc });
  const plate = one(dom.body, 'arena-plate');
  const hint = one(dom.body, 'arena-hint');
  assert.equal(hint.parent, plate, 'the hint on the plate');
  assert.ok(!one(dom.body, 'arena-hud').children.some((c) => has(c, 'arena-hint')), 'not under it');
  assert.equal(hint.textContent, ARENA_TEXT.hud.yieldHint);
  destroyArenaHud();
  const short = /@media \(max-height: 520px\) \{([\s\S]*?)\n\}/.exec(ARENA_HUD_CSS)?.[1] ?? '';
  assert.match(short, /\.arena-hud \.arena-vs, \.arena-hud \.arena-bark \{ display: none; \}/);
  assert.match(short, /\.arena-hud \.arena-plate \{ display: flex; flex-wrap: wrap;/);
  assert.match(short, /\.arena-hud \.arena-stam, \.arena-hud \.arena-crowd \{ flex: 1 1 120px;/);
  assert.match(short, /\.arena-hud \.arena-plate:has\(\.arena-hint:not\(:empty\)\) \.arena-stam \{ display: none; \}/);
}));

// ── U7 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U7: A BANNER IS SAID - every pennant of a banner is an image named for it (the Red\'s crimson and the Blue\'s azure are one grey, 1.03:1), a pennant of none stays hidden; the exhibition\'s fighters carry their banner in words (mutants: the pennant hidden again; the word chip gone)', () => {
  const s = save();
  const W1 = mounted(boardOf(s));
  try {
    const check = () => {
      const ps = kids(W1.host, 'aw-pennant');
      assert.ok(ps.some((p) => p.dataset.banner === 'red') && ps.some((p) => p.dataset.banner === 'blue'));
      for (const p of ps) {
        if (p.dataset.banner === 'red' || p.dataset.banner === 'blue') assert.deepEqual([attr(p, 'role'), attr(p, 'aria-label'), attr(p, 'aria-hidden')], ['img', T.name[p.dataset.banner], undefined], p.dataset.banner);
        else assert.equal(attr(p, 'aria-hidden'), 'true');
      }
    };
    check();
    for (const box of kids(W1.host, 'aw-fighter')) assert.ok(kids(box, 'aw-bannerchip').some((c) => c.textContent === T.short[box.dataset.banner]), `the ${box.dataset.banner}'s fighter, said`);
    tab(W1.host, 'team').click();
    check();
  } finally { W1.done(); }
});

// ── U8 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U8: the HUD\'s toggle (F10) takes the bout\'s bar, the crowd\'s meter and the stands\' presses - both hosts\' arena HUD hidden while it is off, as every other HUD surface is (ui/hud.js) (mutant: one host\'s gate)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const S = rd(f);
    assert.match(S, /drawHud: \(m, o\) => drawArenaHud\(m, \{ \.\.\.o, hidden: !!o\?\.hidden \|\| !hudRenderEnabled\(\) \}\),/, f);
    assert.match(S, /import \{[^}]*\bhudRenderEnabled\b[^}]*\} from '\.\.\/ui\/hudShortcuts\.js';/, `${f} imports it`);
  }
});

// ── U9 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U9: under forced colours the chosen page, side, stake, board and tier carry the system\'s Highlight, and a won pip is filled with its ink (Chromium\'s forced-colors emulation: the chosen\'s outline solid, the rest none) (mutant: the block gone)', () => {
  const fc = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/.exec(ARENA_WINDOW_CSS)?.[1] ?? '';
  assert.match(fc, /\.aw-tab\.on, \.aw-side\.on, \.aw-stake\.on, \.aw-subtab\.on, \.aw-tier\.on \{ outline: 2px solid Highlight; outline-offset: -2px; \}/);
  assert.match(fc, /\.aw-pips i\.on \{ background: CanvasText; forced-color-adjust: none; \}/);
});

// ── U10 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U10: the offer\'s clock says "1 second", and at 0 the offer has lapsed - no Accept (the hall lapses it at its next beat, and an accept then cannot land) (mutants: "1 seconds"; Accept offered at 0)', () => {
  assert.equal(O.offerClock(1), 'Accept within 1 second.');
  assert.equal(O.offerClock(20), 'Accept within 20 seconds.');
  const hall = (until) => ({ status: 'open', queue: 'offer', offer: { o: 'x', vs: { n: 'Bob', r: 1000 }, until }, live: [] });
  const at = (until, now) => AB.onlineCards({ hall: hall(until), me: null, now })[1];
  const half = at(10_500, 10_000);
  assert.deepEqual(half.acts.map((a) => a.act), ['accept', 'decline']);
  assert.ok(half.lines.includes('Accept within 1 second.'));
  const gone = at(10_000, 10_000);
  assert.ok(!gone.acts.some((a) => a.act === 'accept'), 'no Accept at 0');
  assert.ok(gone.lines.includes(O.offerClock(0)) && !/Accept within/.test(O.offerClock(0)), 'it says the offer lapsed');
});

// ── U11 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U11: the banners\' board is headed by its own first column - Season, no Rank and no Fighter over a season\'s rows - offline and online (mutants: the board\'s heads dropped; the rank cell drawn for it)', () => {
  const s = save();
  assert.deepEqual(AB.boardsPage({ ladder: s.ladder, league: s.league, gameMinutes: s.gm, name: 'A' }).team.heads, [W.season]);
  assert.deepEqual(AB.boardsPageOnline(onlineRigBoard(), 'A').team.heads, [W.season], 'online too');
  const W1 = mounted(boardOf(s), undefined, 'boards');
  try {
    kids(W1.host, 'aw-subtab').find((b) => b.dataset.board === 'team').click();
    const t = one(W1.host, 'aw-table');
    const ths = t.children[0].children[0].children;
    assert.deepEqual(ths.map((th) => th.textContent), ['Season', ...W.cols.team]);
    assert.equal(kids(t, 'aw-rank').length, 0, 'no rank');
    assert.equal(kids(t, 'aw-row')[0].children.length, ths.length, 'a cell a header');
  } finally { W1.done(); }
});

// ── U12 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U12: the header\'s purses chip says what it counts - "Purses won", not a bare sum beside the name that read as the purse carried (mutant: the bare sum)', () => {
  const s = save();
  const W1 = mounted(boardOf(s));
  try {
    const purses = AB.arenaHeader({ ladder: s.ladder, league: s.league, gameMinutes: s.gm, name: 'A' }).purses;
    assert.ok(purses > 0);
    assert.equal(one(W1.host, 'aw-purse').textContent, `Purses won: ${purses} gold`);
  } finally { W1.done(); }
});

// ── U13 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U13: under 520 wide the six tabs wrap to a second row - Records and Rules stood past the edge with the scrollbar hidden and nothing to say so (measured in Chromium at 320, 360, 414 and 480: every tab inside the bar, the chosen too) (mutant: the rule gone)', () => {
  assert.match(ARENA_WINDOW_CSS, /@media \(max-width: 520px\) \{ \.aw-tabs \{ flex-wrap: wrap; row-gap: 4px; overflow-x: visible; \} \}/);
});

// ── U14 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U14: a screen reader meets a named page (its tab names it, each tab says which page it shows), the ladder\'s tiers as a list of items each holding its button, the wager\'s own press "Place wager", and no two presses of one name - each Watch the replay and each bout on the sand named for its own (mutants: the page unnamed; the tiers items-that-were-buttons; the place press "Wager"; the replays one name)', () => {
  const s = save();
  // Bouts online, two bouts on the sand, the wager open
  const live = [{ o: 'aa', kind: 'pvp', a: { n: 'Gorlak', r: 1010, b: 'red' }, b: { n: 'Senna', r: 990, b: 'blue' }, sp: 2 }, { o: 'bb', kind: 'pvp', a: { n: 'Uthyrick', r: 1100 }, b: { n: 'Tozca', r: 1000 }, sp: 0 }];
  const before = boardOf(s, { online: { board: null, hall: { status: 'open', queue: 'idle', live }, now: 0 } });   // online, the realm's board not yet in
  const W1 = mounted(before);
  try {
    const { host } = W1;
    const body = one(host, 'aw-body');
    const named = (p) => {
      const t = tab(host, p);
      assert.ok(t.id && body.id, 'the tab and its page have ids to name each other by');
      assert.equal(attr(t, 'aria-controls'), body.id, `${p} names its page`);
      assert.equal(attr(body, 'aria-labelledby'), t.id, `the page named by ${p}`);
    };
    named('bouts');
    kids(host, 'aw-act').find((b) => b.dataset.act === 'wager').click();
    assert.equal(one(host, 'aw-place').textContent, W.placeWager);
    const unique = (where) => {
      const names = kids(body, 'act').filter((b) => b.tagName === 'BUTTON' && attr(b, 'disabled') === undefined).map(nameOf);
      assert.equal(new Set(names).size, names.length, `${where}: ${names.join(' | ')}`);
    };
    unique('the Bouts page');
    assert.equal(kids(body, 'aw-act').filter((b) => b.dataset.act === 'spectate').length, 2, 'two bouts to watch');
    tab(host, 'ladder').click();
    named('ladder');
    const ol = one(host, 'aw-tiers');
    assert.equal(ol.children.length, 10);
    for (const li of ol.children) {
      assert.equal(li.tagName, 'LI');
      assert.equal(attr(li, 'role'), undefined, 'a list item, not a button');
      assert.deepEqual(li.children.map((c) => `${c.tagName}.${has(c, 'aw-tier')}`), ['BUTTON.true'], 'holding its press');
    }
  } finally { W1.done(); }
  // the Records page, its kept bouts each with Watch the replay
  const m0 = boardOf(s)();
  const withReplays = () => { const m = boardOf(s)(); m.records.bouts = m.records.bouts.map((b, i) => ({ ...b, replay: { act: 'replay', label: ARENA_TEXT.replay.press, i, why: '' } })); return m; };
  assert.ok(m0.records.bouts.length >= 3);
  const W2 = mounted(withReplays, undefined, 'records');
  try {
    const body = one(W2.host, 'aw-body');
    const presses = kids(body, 'aw-act').filter((b) => b.dataset.act === 'replay');
    assert.equal(presses.length, m0.records.bouts.length);
    const names = presses.map(nameOf);
    assert.equal(new Set(names).size, names.length, names.join(' | '));
    m0.records.bouts.forEach((b, i) => assert.equal(names[i], `${ARENA_TEXT.replay.press} - ${b.opp}, ${b.when}`, 'its words first, then its bout'));
  } finally { W2.done(); }
});

// ── U15 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 1003 U15: a keyboard\'s Cheer keeps its focus - the press shut by `aria-disabled` while the allowance runs (a disabled button lets the focus fall to the page), and a second press within it sends nothing (mutant: `disabled` again)', () => {
  destroyArenaHud();
  const { b, t } = live(F3);
  const crowd = newCrowd({ fighters: b.fighters });
  const pressed = [];
  const door = (d) => { pressed.push(d); return true; };
  drawArenaHud(arenaHudModel(b, crowd, t, { stands: { ready: true } }), { doc: document, cheer: door });
  const [cheer] = kids(document.body, 'arena-shout');
  cheer.focus();
  cheer.click();
  assert.deepEqual(pressed, [1]);
  drawArenaHud(arenaHudModel(b, crowd, t, { stands: { ready: false } }), { doc: document, cheer: door });   // the next frame: the allowance runs
  assert.equal(document.activeElement, cheer, 'the focus kept on the press');
  assert.equal(attr(cheer, 'aria-disabled'), 'true', 'said shut');
  assert.equal(attr(cheer, 'disabled'), undefined);
  cheer.click();
  assert.deepEqual(pressed, [1], 'a second press within the allowance sends nothing');
  drawArenaHud(arenaHudModel(b, crowd, t, { stands: { ready: true } }), { doc: document, cheer: door });
  assert.equal(attr(cheer, 'aria-disabled'), undefined, 'open again');
  cheer.click();
  assert.deepEqual(pressed, [1, 1]);
  assert.match(ARENA_HUD_CSS, /\.arena-shout\[aria-disabled="true"\] \{ opacity: 0\.55; cursor: default; \}/, 'drawn shut');
  destroyArenaHud();
});
